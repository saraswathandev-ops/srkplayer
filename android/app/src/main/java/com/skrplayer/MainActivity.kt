package com.skrplayer

import android.content.Intent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager

class MainActivity : ReactActivity() {
  private val lifecyclePrefs by lazy {
    getSharedPreferences("skrplayer_lifecycle", MODE_PRIVATE)
  }
  private var launchOptions: Bundle = Bundle()
  private var currentLaunchSessionId: String = ""

  override fun onCreate(savedInstanceState: Bundle?) {
    currentLaunchSessionId = "launch-" + System.currentTimeMillis().toString()
    launchOptions = buildLaunchOptions().apply {
      putString("currentLaunchSessionId", currentLaunchSessionId)
    }
    logLifecycle("onCreate", "savedInstanceState=${savedInstanceState != null}")
    enableEdgeToEdgeCutout()
    super.onCreate(null)
    enableEdgeToEdgeCutout()
  }

  override fun onResume() {
    super.onResume()
    logLifecycle("onResume")
    enableEdgeToEdgeCutout()
  }

  override fun onPause() {
    logLifecycle("onPause")
    super.onPause()
  }

  override fun onStop() {
    logLifecycle("onStop")
    super.onStop()
  }

  override fun onDestroy() {
    logLifecycle("onDestroy")
    super.onDestroy()
  }

  override fun onNewIntent(intent: Intent) {
    logLifecycle("onNewIntent", "data=${intent.dataString ?: "(none)"}")
    super.onNewIntent(intent)
  }

  override fun onUserLeaveHint() {
    logLifecycle("onUserLeaveHint")
    super.onUserLeaveHint()
  }

  override fun onBackPressed() {
    logLifecycle("onBackPressed")
    super.onBackPressed()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      logLifecycle("onWindowFocusChanged", "hasFocus=true")
      enableEdgeToEdgeCutout()
    }
  }

  private fun buildLaunchOptions(): Bundle {
    val previousEvent = lifecyclePrefs.getString("lastLifecycleEvent", null)
    val previousAt = lifecyclePrefs.getLong("lastLifecycleAt", 0L)
    val previousDetails = lifecyclePrefs.getString("lastLifecycleDetails", null)
    val previousIsFinishing = lifecyclePrefs.getBoolean("lastIsFinishing", false)
    val previousIsChangingConfigurations = lifecyclePrefs.getBoolean("lastIsChangingConfigurations", false)
    val previousIsTaskRoot = lifecyclePrefs.getBoolean("lastIsTaskRoot", true)

    return Bundle().apply {
      putString("previousLifecycleEvent", previousEvent)
      putLong("previousLifecycleAt", previousAt)
      putString("previousLifecycleDetails", previousDetails)
      putBoolean("previousIsFinishing", previousIsFinishing)
      putBoolean("previousIsChangingConfigurations", previousIsChangingConfigurations)
      putBoolean("previousIsTaskRoot", previousIsTaskRoot)
    }
  }

  private fun logLifecycle(event: String, extraDetails: String? = null) {
    val details = buildString {
      append("session=").append(currentLaunchSessionId)
      append(" finishing=").append(isFinishing)
      append(" changingConfigurations=").append(isChangingConfigurations)
      append(" taskRoot=").append(isTaskRoot)
      if (!extraDetails.isNullOrBlank()) {
        append(" ").append(extraDetails)
      }
    }
    Log.i("SKRPlayerLifecycle", "$event $details")
    lifecyclePrefs.edit()
      .putString("lastLifecycleEvent", event)
      .putLong("lastLifecycleAt", System.currentTimeMillis())
      .putString("lastLifecycleDetails", details)
      .putBoolean("lastIsFinishing", isFinishing)
      .putBoolean("lastIsChangingConfigurations", isChangingConfigurations)
      .putBoolean("lastIsTaskRoot", isTaskRoot)
      .apply()
  }

  private fun enableEdgeToEdgeCutout() {
    window.decorView.setBackgroundColor(Color.BLACK)
    window.statusBarColor = Color.TRANSPARENT
    window.navigationBarColor = Color.TRANSPARENT
    window.addFlags(
      WindowManager.LayoutParams.FLAG_FULLSCREEN or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
        WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS
    )

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isStatusBarContrastEnforced = false
      window.isNavigationBarContrastEnforced = false
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      window.attributes = window.attributes.apply {
        layoutInDisplayCutoutMode =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
          } else {
            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
          }
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.setDecorFitsSystemWindows(false)
      window.insetsController?.let { controller ->
        controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
        controller.systemBarsBehavior =
          WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      }
    } else {
      @Suppress("DEPRECATION")
      window.decorView.systemUiVisibility =
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
          View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
          View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_FULLSCREEN or
          View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "SKRPlayer"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
        override fun getLaunchOptions(): Bundle = Bundle().apply {
          putBundle("nativeLifecycleDiagnostics", launchOptions)
        }
      }
}

