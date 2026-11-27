package com.whatmeal.app

import android.app.Activity
import android.graphics.Bitmap
import android.net.http.SslError
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import java.io.ByteArrayInputStream

class MainActivity : Activity() {
    private val origin = HttpsOrigin(BuildConfig.SERVICE_ORIGIN)
    private val entryUrl = "${BuildConfig.SERVICE_ORIGIN}/android"
    private lateinit var webView: WebView
    private lateinit var errorPanel: View
    private var mainFrameUrl = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webViewClient = ServiceClient()
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)
        errorPanel = LinearLayout(this).apply {
            gravity = Gravity.CENTER
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            addView(TextView(context).apply {
                setText(R.string.load_error)
                accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
            })
            addView(Button(context).apply {
                setText(R.string.retry)
                setOnClickListener { openService() }
            })
        }
        setContentView(FrameLayout(this).apply {
            setOnApplyWindowInsetsListener { view, insets ->
                val safe = insets.getInsets(
                    WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime()
                )
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
                WindowInsets.CONSUMED
            }
            addView(webView)
            addView(errorPanel, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
            ))
        })
        window.insetsController?.setSystemBarsAppearance(
            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
        )
        openService()
    }

    override fun onStop() {
        CookieManager.getInstance().flush()
        super.onStop()
    }

    override fun onDestroy() {
        (webView.parent as? FrameLayout)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    private fun openService() {
        errorPanel.visibility = View.GONE
        webView.visibility = View.VISIBLE
        mainFrameUrl = entryUrl
        webView.loadUrl(entryUrl)
    }

    private fun showLoadError() {
        webView.visibility = View.GONE
        errorPanel.visibility = View.VISIBLE
    }

    private inner class ServiceClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url.toString()
            if (!origin.allows(url)) return true
            if (request.isForMainFrame) mainFrameUrl = url
            return false
        }

        // shouldOverrideUrlLoading omits POST requests.
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            if (!request.isForMainFrame || origin.allows(request.url.toString())) return null
            return WebResourceResponse(
                "text/plain", "UTF-8", 403, "Forbidden", emptyMap(), ByteArrayInputStream(byteArrayOf())
            )
        }

        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            mainFrameUrl = url
            if (!origin.allows(url)) {
                showLoadError()
                view.stopLoading()
            }
        }

        override fun onPageCommitVisible(view: WebView, url: String) {
            if (!origin.allows(url)) showLoadError()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) showLoadError()
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
            if (request.isForMainFrame) showLoadError()
        }

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
            handler.cancel()
            if (error.url == mainFrameUrl) showLoadError()
        }
    }
}
