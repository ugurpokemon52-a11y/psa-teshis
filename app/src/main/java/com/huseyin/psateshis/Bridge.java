package com.huseyin.psateshis;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class Bridge {
    final MainActivity act;
    final WebView web;
    final ObdLink obd;

    Bridge(MainActivity act, WebView web) {
        this.act = act;
        this.web = web;
        this.obd = new ObdLink(act.getApplicationContext(), this);
    }

    void emit(String ev, String payload) {
        final String js = "window.NativeCb&&NativeCb(" + JSONObject.quote(ev) + "," + JSONObject.quote(payload == null ? "" : payload) + ")";
        web.post(() -> web.evaluateJavascript(js, null));
    }

    String[] btPerms() {
        List<String> l = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 31) {
            l.add(Manifest.permission.BLUETOOTH_CONNECT);
            l.add(Manifest.permission.BLUETOOTH_SCAN);
        } else {
            l.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        return l.toArray(new String[0]);
    }

    @JavascriptInterface
    public boolean hasBtPermission() {
        for (String p : btPerms()) {
            if (act.checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) return false;
        }
        return true;
    }

    @JavascriptInterface
    public void requestBtPermission() {
        act.runOnUiThread(() -> act.requestPermissions(btPerms(), MainActivity.REQ_BT));
    }

    @JavascriptInterface
    public boolean btAvailable() {
        return obd.available();
    }

    @JavascriptInterface
    public boolean btEnabled() {
        return obd.enabled();
    }

    @JavascriptInterface
    @SuppressWarnings("MissingPermission")
    public void btEnable() {
        act.runOnUiThread(() -> {
            try {
                act.startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE));
            } catch (Exception e) {
                emit("btError", "Bluetooth açılamadı: " + e.getMessage());
            }
        });
    }

    @JavascriptInterface
    public void openBtSettings() {
        act.runOnUiThread(() -> {
            try {
                act.startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS));
            } catch (Exception ignored) {
            }
        });
    }

    @JavascriptInterface
    public void openAppSettings() {
        act.runOnUiThread(() -> {
            try {
                act.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + act.getPackageName())));
            } catch (Exception ignored) {
            }
        });
    }

    @JavascriptInterface
    public String btBonded() {
        return obd.bonded();
    }

    @JavascriptInterface
    public void btScan() {
        obd.scan();
    }

    @JavascriptInterface
    public void btConnect(String address, boolean ble) {
        obd.connect(address, ble);
    }

    @JavascriptInterface
    public void btSend(String cmd) {
        obd.send(cmd);
    }

    @JavascriptInterface
    public void btDisconnect() {
        obd.disconnect();
        emit("btDisconnected", "user");
    }

    @JavascriptInterface
    public boolean btConnected() {
        return obd.connected;
    }

    @JavascriptInterface
    public void keepScreenOn(boolean on) {
        act.runOnUiThread(() -> {
            if (on) act.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else act.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    @JavascriptInterface
    public void exportFile(String name, String content) {
        act.runOnUiThread(() -> act.startExport(name, content));
    }

    @JavascriptInterface
    public void shareText(String text) {
        act.runOnUiThread(() -> {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, text);
            act.startActivity(Intent.createChooser(i, "Paylaş"));
        });
    }

    @JavascriptInterface
    public String version() {
        try {
            return act.getPackageManager().getPackageInfo(act.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }
}
