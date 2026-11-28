package com.skrplayer

import android.content.res.AssetFileDescriptor
import android.net.Uri
import android.os.SystemClock
import android.widget.FrameLayout
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.interfaces.IMedia
import org.videolan.libvlc.util.VLCVideoLayout
import java.io.IOException

internal class VlcVideoView(private val reactContext: ThemedReactContext) :
    FrameLayout(reactContext), LifecycleEventListener {

    var source: String? = null
    var paused = true
    var backgroundPlay = false
    var repeat = false
    var rate = 1f
    var volume = 1f
    var muted = false
    var audioTrack: Int? = null
    var subtitleTrack: Int? = null
    var subtitleFile: String? = null
    var resizeMode = "contain"
    var softwareDecoding = false
    private val videoLayout = VLCVideoLayout(reactContext)
    private var core: LibVLC? = null
    private var player: MediaPlayer? = null
    private var sourceDescriptor: AssetFileDescriptor? = null
    private var playRequested = false
    private var hostPaused = false
    private var disposed = false
    private var failed = false
    private var loaded = false
    private var appliedSubtitleFile: String? = null
    private var ended = false
    private var pendingSeek: Long? = null
    private var lastProgress = 0L
    private var activeSource: String? = null
    private var activeSoftwareDecoding = false
    private var attemptedSubtitleFile: String? = null
    private var lastBuffering: Boolean? = null
    private var appliedRate: Float? = null
    private var appliedVolume: Int? = null
    private var appliedResizeMode: String? = null
    private data class TrackSnapshot(val id: Int, val title: String?, val selected: Boolean)
    private data class MetadataSnapshot(val duration: Long, val width: Int, val height: Int,
        val audio: List<TrackSnapshot>, val subtitles: List<TrackSnapshot>)
    private var lastMetadata: MetadataSnapshot? = null

    init {
        addView(videoLayout, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        reactContext.addLifecycleEventListener(this)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        applyPlayback()
    }

    override fun onDetachedFromWindow() {
        playRequested = false
        player?.pause()
        super.onDetachedFromWindow()
    }

    fun applyPlayback() {
        if (disposed || !isAttachedToWindow) return
        if (activeSource != source || activeSoftwareDecoding != softwareDecoding) {
            releasePlayer()
            activeSource = source
            activeSoftwareDecoding = softwareDecoding
            failed = false
            loaded = false
            ended = false
            playRequested = false
            appliedSubtitleFile = null
            attemptedSubtitleFile = null
            pendingSeek = null
            lastProgress = 0L
            lastBuffering = null
            appliedRate = null
            appliedVolume = null
            appliedResizeMode = null
            lastMetadata = null
        }
        if (failed) return
        val shouldPlay = !paused && (!hostPaused || backgroundPlay)
        val uri = source ?: return
        val current = player ?: if (shouldPlay) open(uri) ?: return else return
        if (appliedRate != rate) {
            current.setRate(rate)
            appliedRate = rate
        }
        applyVolume(current)
        if (appliedResizeMode != resizeMode) {
            current.setVideoScale(when (resizeMode) {
                "cover" -> MediaPlayer.ScaleType.SURFACE_FIT_SCREEN
                "stretch" -> MediaPlayer.ScaleType.SURFACE_FILL
                else -> MediaPlayer.ScaleType.SURFACE_BEST_FIT
            })
            appliedResizeMode = resizeMode
        }
        applyTracks(current)
        if (loaded) applySubtitleFile(current)
        if (shouldPlay == playRequested || ended) return
        playRequested = shouldPlay
        if (shouldPlay) current.play() else current.pause()
    }

    private fun open(uri: String): MediaPlayer? {
        try {
            val instance = LibVLC(context)
            core = instance
            val current = MediaPlayer(instance)
            player = current
            current.setEventListener { event ->
                if (player === current && !disposed && !failed) handleEvent(current, event)
            }
            val parsedUri = Uri.parse(uri)
            val media = if (parsedUri.scheme == "content") {
                val descriptor = context.contentResolver.openAssetFileDescriptor(parsedUri, "r")
                    ?: throw IOException("Unable to open content URI")
                sourceDescriptor = descriptor
                Media(instance, descriptor)
            } else {
                Media(instance, parsedUri)
            }
            try {
                media.setHWDecoderEnabled(!softwareDecoding, false)
                current.media = media
            } finally {
                media.release()
            }
            current.attachViews(videoLayout, null, false, true)
            emit("loadStart")
            return current
        } catch (error: IOException) {
            Log.e("SKRVlc", "Media open failed: " + error.javaClass.simpleName)
            failPlayback()
        } catch (error: RuntimeException) {
            Log.e("SKRVlc", "Native playback initialization failed: " + error.javaClass.simpleName)
            failPlayback()
        } catch (error: LinkageError) {
            Log.e("SKRVlc", "Native library linkage failed: " + error.javaClass.simpleName)
            failPlayback()
        }
        return null
    }

    fun seek(position: Long) {
        if (disposed || failed) return
        val safePosition = position.coerceAtLeast(0)
        val current = player
        if (current == null || !current.isSeekable) {
            pendingSeek = safePosition
            return
        }
        pendingSeek = null
        val length = current.length
        current.setTime(if (length > 0) safePosition.coerceAtMost(length) else safePosition)
    }

    private fun handleEvent(current: MediaPlayer, event: MediaPlayer.Event) {
        when (event.type) {
            MediaPlayer.Event.Buffering -> sendBuffering(event.buffering < 100)
            MediaPlayer.Event.Playing -> {
                ended = false
                appliedVolume = null
                applyVolume(current)
                if (!isAttachedToWindow || paused || (hostPaused && !backgroundPlay)) current.pause()
                sendLoad(current)
                sendBuffering(false)
            }
            MediaPlayer.Event.LengthChanged, MediaPlayer.Event.Vout -> {
                if (loaded) sendMetadata(current, "metadata")
            }
            MediaPlayer.Event.SeekableChanged -> {
                if (event.seekable) pendingSeek?.let(::seek)
            }
            MediaPlayer.Event.ESAdded, MediaPlayer.Event.ESDeleted, MediaPlayer.Event.ESSelected -> {
                applyTracks(current)
                if (loaded) sendMetadata(current, "tracks")
            }
            MediaPlayer.Event.TimeChanged -> {
                val now = SystemClock.elapsedRealtime()
                if (now - lastProgress >= 250) {
                    lastProgress = now
                    emit("progress") {
                        putDouble("positionMs", event.timeChanged.coerceAtLeast(0).toDouble())
                        putDouble("durationMs", current.length.coerceAtLeast(0).toDouble())
                    }
                }
            }
            MediaPlayer.Event.EndReached -> {
                if (repeat && isAttachedToWindow && !paused && (!hostPaused || backgroundPlay)) {
                    current.stop()
                    current.play()
                } else {
                    ended = true
                    emit("end")
                }
            }
            MediaPlayer.Event.EncounteredError -> failPlayback()
        }
    }

    private fun sendLoad(current: MediaPlayer) {
        if (loaded) return
        loaded = true
        applySubtitleFile(current)
        if (current.isSeekable) pendingSeek?.let(::seek)
        sendMetadata(current, "load")
    }

    private fun applySubtitleFile(current: MediaPlayer) {
        val file = subtitleFile ?: return
        if (file == appliedSubtitleFile || file == attemptedSubtitleFile) return
        attemptedSubtitleFile = file
        if (current.addSlave(IMedia.Slave.Type.Subtitle, Uri.parse(file), true)) {
            appliedSubtitleFile = file
        } else {
            emit("subtitleError")
        }
    }

    private fun applyVolume(current: MediaPlayer) {
        val target = if (muted) 0 else (volume * 100).toInt().coerceIn(0, 200)
        if (appliedVolume != target) {
            current.setVolume(target)
            appliedVolume = target
        }
    }

    private fun applyTracks(current: MediaPlayer) {
        audioTrack?.let { selected ->
            if (current.audioTrack != selected && current.audioTracks?.any { it.id == selected } == true) {
                current.setAudioTrack(selected)
            }
        }
        subtitleTrack?.let { selected ->
            if (current.spuTrack != selected && (selected == -1 || current.spuTracks?.any { it.id == selected } == true)) {
                current.setSpuTrack(selected)
            }
        }
    }

    private fun sendBuffering(buffering: Boolean) {
        if (!isAttachedToWindow || lastBuffering == buffering) return
        lastBuffering = buffering
        emit("buffer") { putBoolean("buffering", buffering) }
    }

    private fun sendMetadata(current: MediaPlayer, type: String) {
        if (!isAttachedToWindow) return
        val video = current.currentVideoTrack
        val snapshot = MetadataSnapshot(current.length.coerceAtLeast(0), video?.width ?: 0,
            video?.height ?: 0, snapshotTracks(current.audioTracks, current.audioTrack),
            snapshotTracks(current.spuTracks, current.spuTrack))
        if (type != "load" && snapshot == lastMetadata) return
        lastMetadata = snapshot
        emit(type) {
            putDouble("durationMs", snapshot.duration.toDouble())
            putInt("width", snapshot.width)
            putInt("height", snapshot.height)
            putArray("audioTracks", describeTracks(snapshot.audio))
            putArray("subtitleTracks", describeTracks(snapshot.subtitles))
        }
    }

    private fun snapshotTracks(tracks: Array<out MediaPlayer.TrackDescription>?, selected: Int) =
        tracks?.filter { it.id >= 0 }?.map { TrackSnapshot(it.id, it.name, it.id == selected) } ?: emptyList()

    private fun describeTracks(tracks: List<TrackSnapshot>) =
        Arguments.createArray().apply {
            tracks.forEach { track ->
                pushMap(Arguments.createMap().apply {
                    putInt("index", track.id)
                    putString("title", track.title)
                    putBoolean("selected", track.selected)
                })
            }
        }

    @Suppress("DEPRECATION")
    private fun emit(type: String, payload: WritableMap.() -> Unit = {}) {
        if (disposed || !isAttachedToWindow || !reactContext.hasActiveReactInstance()) return
        val event = Arguments.createMap().apply {
            putString("type", type)
            payload()
        }
        reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(id, "topVlcEvent", event)
    }

    private fun failPlayback() {
        failed = true
        emit("error")
        releasePlayer()
    }

    private fun releasePlayer() {
        val current = player
        player = null
        val instance = core
        core = null
        cleanup("listener") { current?.setEventListener(null) }
        cleanup("surface") { current?.detachViews() }
        cleanup("player") { current?.release() }
        cleanup("core") { instance?.release() }
        try {
            sourceDescriptor?.close()
        } catch (_: IOException) {
            // The playback session has already ended.
        } finally {
            sourceDescriptor = null
        }
    }

    private inline fun cleanup(resource: String, action: () -> Unit) {
        try {
            action()
        } catch (error: RuntimeException) {
            Log.w("SKRVlc", "Failed to release $resource: " + error.javaClass.simpleName)
        }
    }

    fun dispose() {
        if (disposed) return
        disposed = true
        reactContext.removeLifecycleEventListener(this)
        releasePlayer()
    }

    override fun onHostResume() {
        hostPaused = false
        applyPlayback()
    }

    override fun onHostPause() {
        hostPaused = true
        applyPlayback()
    }

    override fun onHostDestroy() = dispose()
}
