package com.skrplayer

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Native subtitle-generation bridge scaffold.
 *
 * This build registers the JS-visible module contract so the React Native
 * layer can distinguish between:
 * - module missing entirely
 * - module present but offline transcription engine not bundled/enabled
 *
 * The actual whisper.cpp / JNI streaming engine is not bundled in this repo
 * checkout yet, so runtime support currently reports false and generation
 * calls reject with a clear unsupported error instead of falling back to a
 * fake JS mock pipeline.
 */
class SubtitleGeneratorModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SubtitleGenerator"

    @ReactMethod
    fun isSupported(promise: Promise) {
        promise.resolve(false)
    }

    @ReactMethod
    fun generateSubtitles(videoUri: String, opts: com.facebook.react.bridge.ReadableMap, promise: Promise) {
        promise.reject(
            "UNSUPPORTED_ABI",
            "Offline subtitle generation engine is not bundled in this build."
        )
    }

    @ReactMethod
    fun cancelSubtitleGeneration(jobId: String, promise: Promise) {
        promise.resolve(null)
    }

    @ReactMethod
    fun getGenerationProgress(jobId: String, promise: Promise) {
        val map = Arguments.createMap().apply {
            putString("jobId", jobId)
            putString("status", "error")
            putDouble("progress", 0.0)
        }
        promise.resolve(map)
    }
}
