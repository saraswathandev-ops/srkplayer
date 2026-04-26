package com.skrplayer

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Window-level brightness control — no WRITE_SETTINGS permission required.
 * Sets screenBrightness on the current Activity's Window (local to the app).
 * Pass -1.0 to restore the window to follow the system brightness.
 */
class BrightnessModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "BrightnessModule"

    @ReactMethod
    fun setWindowBrightness(brightness: Double, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity available")
            return
        }
        activity.runOnUiThread {
            try {
                val lp = activity.window.attributes
                // Clamp: -1.0 = follow system, 0.0–1.0 = override
                lp.screenBrightness = brightness.toFloat().coerceIn(-1f, 1f)
                activity.window.attributes = lp
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("BRIGHTNESS_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    @ReactMethod
    fun getWindowBrightness(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity available")
            return
        }
        try {
            val brightness = activity.window.attributes.screenBrightness
            // -1 means "following system", map it to a visible 0.5 default
            promise.resolve(if (brightness < 0f) 0.5 else brightness.toDouble())
        } catch (e: Exception) {
            promise.reject("BRIGHTNESS_ERROR", e.message ?: "Unknown error")
        }
    }
}
