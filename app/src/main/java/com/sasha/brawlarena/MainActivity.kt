package com.sasha.brawlarena
import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.graphics.Color
class MainActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = Color.rgb(12, 18, 43)
    window.navigationBarColor = Color.rgb(12, 18, 43)
    val web = WebView(this)
    web.settings.javaScriptEnabled = true
    web.settings.domStorageEnabled = true
    web.webViewClient = WebViewClient()
    web.webChromeClient = WebChromeClient()
    web.setBackgroundColor(Color.rgb(12,18,43))
    setContentView(web)
    web.loadUrl("file:///android_asset/index.html")
  }
}
