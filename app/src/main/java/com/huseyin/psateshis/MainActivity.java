package com.huseyin.psateshis;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    static final int REQ_BT = 11;
    static final int REQ_EXPORT = 20;

    WebView web;
    Bridge bridge;
    String pendingExport;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xFF1B1D20);
        getWindow().setNavigationBarColor(0xFF1B1D20);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient());

        bridge = new Bridge(this, web);
        web.addJavascriptInterface(bridge, "Native");
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.evaluateJavascript("window.onAppResume&&onAppResume()", null);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("window.onBack?String(onBack()):'false'", value -> {
            if (value == null || !value.contains("true")) {
                MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean ok = grantResults.length > 0;
        for (int g : grantResults) if (g != PackageManager.PERMISSION_GRANTED) ok = false;
        if (bridge != null) bridge.emit("perm", "bt:" + (ok ? "ok" : "no"));
    }

    void startExport(String name, String content) {
        pendingExport = content;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(i, REQ_EXPORT);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (bridge == null || requestCode != REQ_EXPORT) return;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            bridge.emit("file", "cancel");
            pendingExport = null;
            return;
        }
        try (OutputStream os = getContentResolver().openOutputStream(data.getData())) {
            if (os != null && pendingExport != null) {
                os.write(pendingExport.getBytes(StandardCharsets.UTF_8));
            }
            bridge.emit("file", "exported");
        } catch (Exception e) {
            bridge.emit("file", "error:" + e.getMessage());
        }
        pendingExport = null;
    }

    @Override
    protected void onDestroy() {
        if (bridge != null) bridge.obd.disconnect();
        super.onDestroy();
    }
}
