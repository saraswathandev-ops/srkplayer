package com.skrplayer

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.uimanager.annotations.ReactProp

class VlcVideoPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = emptyList()

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        listOf(VlcVideoManager())
}

internal class VlcVideoManager : SimpleViewManager<VlcVideoView>() {
    override fun getName() = "SrkVlcVideo"
    override fun createViewInstance(context: ThemedReactContext) = VlcVideoView(context)

    @ReactProp(name = "uri")
    fun setUri(view: VlcVideoView, uri: String?) { view.source = uri }

    @ReactProp(name = "paused", defaultBoolean = true)
    fun setPaused(view: VlcVideoView, paused: Boolean) { view.paused = paused }

    @ReactProp(name = "backgroundPlay")
    fun setBackgroundPlay(view: VlcVideoView, enabled: Boolean) { view.backgroundPlay = enabled }

    @ReactProp(name = "repeat")
    fun setRepeat(view: VlcVideoView, repeat: Boolean) { view.repeat = repeat }

    @ReactProp(name = "volume", defaultFloat = 1f)
    fun setVolume(view: VlcVideoView, volume: Float) { view.volume = volume }

    @ReactProp(name = "muted")
    fun setMuted(view: VlcVideoView, muted: Boolean) { view.muted = muted }

    @ReactProp(name = "rate", defaultFloat = 1f)
    fun setRate(view: VlcVideoView, rate: Float) { view.rate = rate }

    @ReactProp(name = "audioTrack", defaultInt = -1)
    fun setAudioTrack(view: VlcVideoView, track: Int) { view.audioTrack = track.takeIf { it >= 0 } }

    @ReactProp(name = "subtitleTrack", defaultInt = -2)
    fun setSubtitleTrack(view: VlcVideoView, track: Int) { view.subtitleTrack = track.takeIf { it >= -1 } }

    @ReactProp(name = "subtitleFile")
    fun setSubtitleFile(view: VlcVideoView, uri: String?) { view.subtitleFile = uri }

    @ReactProp(name = "resizeMode")
    fun setResizeMode(view: VlcVideoView, mode: String?) { view.resizeMode = mode ?: "contain" }

    @ReactProp(name = "softwareDecoding")
    fun setSoftwareDecoding(view: VlcVideoView, enabled: Boolean) { view.softwareDecoding = enabled }

    override fun onAfterUpdateTransaction(view: VlcVideoView) {
        super.onAfterUpdateTransaction(view)
        view.applyPlayback()
    }

    override fun getCommandsMap() = mapOf("seek" to 1)

    override fun receiveCommand(view: VlcVideoView, commandId: String, args: ReadableArray?) {
        if (commandId == "seek" && args != null) view.seek(args.getDouble(0).toLong())
    }

    override fun receiveCommand(view: VlcVideoView, commandId: Int, args: ReadableArray?) {
        if (commandId == 1) receiveCommand(view, "seek", args)
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
        mapOf("topVlcEvent" to mapOf("registrationName" to "onVlcEvent"))

    override fun onDropViewInstance(view: VlcVideoView) {
        view.dispose()
        super.onDropViewInstance(view)
    }
}
