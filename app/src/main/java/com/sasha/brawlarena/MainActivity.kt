package com.sasha.brawlarena
import android.app.Activity
import android.os.Bundle
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.graphics.Color
class MainActivity : Activity() {
  @Suppress("DEPRECATION")
  private fun enterImmersiveLandscape() {
    window.decorView.systemUiVisibility = (
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
      or View.SYSTEM_UI_FLAG_FULLSCREEN
      or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
      or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
      or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
      or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
    )
  }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    window.statusBarColor = Color.rgb(12, 18, 43)
    window.navigationBarColor = Color.rgb(12, 18, 43)
    enterImmersiveLandscape()
    val web = WebView(this)
    web.settings.javaScriptEnabled = true
    web.settings.domStorageEnabled = true
    web.webViewClient = WebViewClient()
    web.webChromeClient = WebChromeClient()
    web.setBackgroundColor(Color.rgb(12,18,43))
    setContentView(web)
    web.loadUrl("file:///android_asset/index.html")
  }
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) enterImmersiveLandscape()
  }
}