package com.skrplayer

import android.content.res.AssetFileDescriptor
import android.net.Uri
import android.os.SystemClock
import android.widget.FrameLayout
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
        if (disposed || failed || !isAttachedToWindow) return
        val shouldPlay = !paused && (!hostPaused || backgroundPlay)
        val uri = source ?: return
        val current = player ?: if (shouldPlay) open(uri) ?: return else return
        current.setRate(rate)
        applyVolume(current)
        current.setVideoScale(when (resizeMode) {
            "cover" -> MediaPlayer.ScaleType.SURFACE_FIT_SCREEN
            "stretch" -> MediaPlayer.ScaleType.SURFACE_FILL
            else -> MediaPlayer.ScaleType.SURFACE_BEST_FIT
        })
        applyTracks(current)
        if (loaded) applySubtitleFile(current)
        if (shouldPlay == playRequested || ended) return
        playRequested = shouldPlay
        if (shouldPlay) current.play() else if (current.isPlaying) current.pause()
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
        } catch (_: IOException) {
            failPlayback()
        } catch (_: RuntimeException) {
            failPlayback()
        } catch (_: LinkageError) {
            failPlayback()
        }
        return null
    }

    fun seek(position: Long) {
        val current = player
        if (current == null || !current.isSeekable) {
            pendingSeek = position
            return
        }
        pendingSeek = null
        current.setTime(position)
    }

    private fun handleEvent(current: MediaPlayer, event: MediaPlayer.Event) {
        when (event.type) {
            MediaPlayer.Event.Buffering -> emit("buffer") { putBoolean("buffering", event.buffering < 100) }
            MediaPlayer.Event.Playing -> {
                ended = false
                applyVolume(current)
                if (paused || (hostPaused && !backgroundPlay)) current.pause()
                sendLoad(current)
                emit("buffer") { putBoolean("buffering", false) }
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
                if (repeat && !paused && (!hostPaused || backgroundPlay)) {
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
        if (file == appliedSubtitleFile) return
        appliedSubtitleFile = file
        if (!current.addSlave(IMedia.Slave.Type.Subtitle, Uri.parse(file), true)) {
            emit("subtitleError")
        }
    }

    private fun applyVolume(current: MediaPlayer) {
        current.setVolume(if (muted) 0 else (volume * 100).toInt().coerceIn(0, 200))
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

    private fun sendMetadata(current: MediaPlayer, type: String) = emit(type) {
        putDouble("durationMs", current.length.coerceAtLeast(0).toDouble())
        val video = current.currentVideoTrack
        putInt("width", video?.width ?: 0)
        putInt("height", video?.height ?: 0)
        putArray("audioTracks", describeTracks(current.audioTracks, current.audioTrack))
        putArray("subtitleTracks", describeTracks(current.spuTracks, current.spuTrack))
    }

    private fun describeTracks(tracks: Array<out MediaPlayer.TrackDescription>?, selected: Int) =
        Arguments.createArray().apply {
            tracks?.filter { it.id >= 0 }?.forEach { track ->
                pushMap(Arguments.createMap().apply {
                    putInt("index", track.id)
                    putString("title", track.name)
                    putBoolean("selected", track.id == selected)
                })
            }
        }

    @Suppress("DEPRECATION")
    private fun emit(type: String, payload: WritableMap.() -> Unit = {}) {
        if (disposed || !reactContext.hasActiveReactInstance()) return
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
        current?.setEventListener(null)
        current?.detachViews()
        current?.release()
        core?.release()
        core = null
        try {
            sourceDescriptor?.close()
        } catch (_: IOException) {
            // The playback session has already ended.
        } finally {
            sourceDescriptor = null
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
