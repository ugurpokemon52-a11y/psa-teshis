package com.huseyin.psateshis;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.BluetoothSocket;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * ELM327 OBD-II adaptörü ile Bluetooth bağlantısı.
 * Klasik Bluetooth (SPP) ve Bluetooth Low Energy (BLE) adaptörleri desteklenir.
 * Adaptörün '>' istemine kadar gelen her yanıt JavaScript'e "obd" olayı olarak iletilir.
 */
@SuppressLint("MissingPermission")
public class ObdLink {
    static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    final Context ctx;
    final Bridge br;
    final BluetoothAdapter ad;
    final Handler main = new Handler(Looper.getMainLooper());

    BluetoothSocket sock;
    OutputStream out;
    BluetoothGatt gatt;
    BluetoothGattCharacteristic wch;
    BluetoothGattCharacteristic nch;
    final StringBuilder buf = new StringBuilder();
    volatile boolean connected;
    volatile int session = 0;
    ScanCallback scanCb;

    ObdLink(Context c, Bridge b) {
        ctx = c;
        br = b;
        BluetoothManager m = (BluetoothManager) c.getSystemService(Context.BLUETOOTH_SERVICE);
        ad = m != null ? m.getAdapter() : null;
    }

    boolean available() {
        return ad != null;
    }

    boolean enabled() {
        try {
            return ad != null && ad.isEnabled();
        } catch (Exception e) {
            return false;
        }
    }

    String bonded() {
        JSONArray a = new JSONArray();
        try {
            if (ad == null) return a.toString();
            Set<BluetoothDevice> set = ad.getBondedDevices();
            if (set != null) {
                for (BluetoothDevice d : set) {
                    JSONObject o = new JSONObject();
                    o.put("name", d.getName() == null ? "(adsız)" : d.getName());
                    o.put("address", d.getAddress());
                    o.put("type", d.getType());
                    a.put(o);
                }
            }
        } catch (Exception e) {
            br.emit("btError", "Eşleşmiş cihazlar okunamadı: " + e.getMessage());
        }
        return a.toString();
    }

    void scan() {
        try {
            if (ad == null) {
                br.emit("btError", "Bu telefonda Bluetooth yok");
                return;
            }
            final BluetoothLeScanner sc = ad.getBluetoothLeScanner();
            if (sc == null) {
                br.emit("btError", "Bluetooth kapalı olabilir");
                return;
            }
            stopScan();
            final Set<String> seen = new HashSet<>();
            scanCb = new ScanCallback() {
                @Override
                public void onScanResult(int callbackType, ScanResult r) {
                    try {
                        BluetoothDevice d = r.getDevice();
                        if (d == null || seen.contains(d.getAddress())) return;
                        seen.add(d.getAddress());
                        String n = d.getName();
                        if (n == null && r.getScanRecord() != null) n = r.getScanRecord().getDeviceName();
                        JSONObject o = new JSONObject();
                        o.put("name", n == null ? "(adsız)" : n);
                        o.put("address", d.getAddress());
                        o.put("rssi", r.getRssi());
                        br.emit("scan", o.toString());
                    } catch (Exception ignored) {
                    }
                }

                @Override
                public void onScanFailed(int errorCode) {
                    br.emit("btError", "Tarama başarısız (" + errorCode + ")");
                }
            };
            sc.startScan(scanCb);
            main.postDelayed(() -> {
                stopScan();
                br.emit("scanDone", "");
            }, 12000);
        } catch (Exception e) {
            br.emit("btError", "Tarama başlatılamadı: " + e.getMessage());
        }
    }

    void stopScan() {
        try {
            if (scanCb != null && ad != null && ad.getBluetoothLeScanner() != null) {
                ad.getBluetoothLeScanner().stopScan(scanCb);
            }
        } catch (Exception ignored) {
        }
        scanCb = null;
    }

    void connect(final String address, final boolean ble) {
        disconnect();
        final int my = ++session;
        new Thread(() -> {
            try {
                if (ad == null) throw new IOException("Bluetooth yok");
                stopScan();
                BluetoothDevice d = ad.getRemoteDevice(address);
                if (ble) connectBle(d, my);
                else connectClassic(d, my);
            } catch (Exception e) {
                br.emit("btError", "Bağlanamadı: " + e.getMessage());
            }
        }).start();
    }

    private void connectClassic(BluetoothDevice d, int my) throws Exception {
        try {
            ad.cancelDiscovery();
        } catch (Exception ignored) {
        }
        BluetoothSocket s = null;
        Exception last = null;
        for (int attempt = 0; attempt < 3 && s == null; attempt++) {
            BluetoothSocket t = null;
            try {
                if (attempt == 0) t = d.createRfcommSocketToServiceRecord(SPP);
                else if (attempt == 1) t = d.createInsecureRfcommSocketToServiceRecord(SPP);
                else {
                    Method m = d.getClass().getMethod("createRfcommSocket", int.class);
                    t = (BluetoothSocket) m.invoke(d, 1);
                }
                if (t == null) continue;
                t.connect();
                s = t;
            } catch (Exception e) {
                last = e;
                try {
                    if (t != null) t.close();
                } catch (Exception ignored) {
                }
            }
        }
        if (s == null) throw last != null ? last : new IOException("Soket açılamadı");
        if (my != session) {
            s.close();
            return;
        }
        sock = s;
        out = s.getOutputStream();
        final InputStream in = s.getInputStream();
        synchronized (buf) {
            buf.setLength(0);
        }
        connected = true;
        br.emit("btConnected", "classic");
        Thread reader = new Thread(() -> {
            byte[] b = new byte[1024];
            try {
                int n;
                while (my == session && (n = in.read(b)) > 0) onBytes(b, n);
            } catch (IOException ignored) {
            }
            if (my == session && connected) {
                connected = false;
                br.emit("btDisconnected", "lost");
            }
        });
        reader.start();
    }

    private void connectBle(BluetoothDevice d, final int my) {
        final BluetoothGattCallback cb = new BluetoothGattCallback() {
            @Override
            public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
                if (my != session) {
                    try {
                        g.close();
                    } catch (Exception ignored) {
                    }
                    return;
                }
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    g.discoverServices();
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    boolean was = connected;
                    connected = false;
                    try {
                        g.close();
                    } catch (Exception ignored) {
                    }
                    if (gatt == g) gatt = null;
                    if (was) br.emit("btDisconnected", "lost");
                    else br.emit("btError", "BLE bağlantısı kurulamadı (kod " + status + ")");
                }
            }

            @Override
            public void onServicesDiscovered(BluetoothGatt g, int status) {
                pickCharacteristics(g);
                if (wch == null || nch == null) {
                    br.emit("btError", "Bu cihazda OBD veri kanalı bulunamadı. Klasik Bluetooth ile dene.");
                    return;
                }
                g.setCharacteristicNotification(nch, true);
                BluetoothGattDescriptor ds = nch.getDescriptor(CCCD);
                if (ds != null) {
                    byte[] v = (nch.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0
                            ? BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                            : BluetoothGattDescriptor.ENABLE_INDICATION_VALUE;
                    if (Build.VERSION.SDK_INT >= 33) {
                        g.writeDescriptor(ds, v);
                    } else {
                        ds.setValue(v);
                        g.writeDescriptor(ds);
                    }
                } else {
                    bleReady();
                }
            }

            @Override
            public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor descriptor, int status) {
                bleReady();
            }

            @Override
            public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch, byte[] value) {
                if (value != null) onBytes(value, value.length);
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch) {
                byte[] v = ch.getValue();
                if (v != null) onBytes(v, v.length);
            }
        };
        main.post(() -> {
            if (my != session) return;
            gatt = d.connectGatt(ctx, false, cb, BluetoothDevice.TRANSPORT_LE);
        });
    }

    private void bleReady() {
        if (connected) return;
        synchronized (buf) {
            buf.setLength(0);
        }
        connected = true;
        br.emit("btConnected", "ble");
    }

    private void pickCharacteristics(BluetoothGatt g) {
        wch = null;
        nch = null;
        BluetoothGattCharacteristic fw = null, fn = null;
        for (BluetoothGattService s : g.getServices()) {
            String su = s.getUuid().toString().toLowerCase();
            if (su.startsWith("00001800") || su.startsWith("00001801") || su.startsWith("0000180a")) continue;
            boolean preferred = su.contains("fff0") || su.contains("ffe0") || su.startsWith("e7810a71") || su.contains("18f0");
            BluetoothGattCharacteristic w = null, n = null;
            for (BluetoothGattCharacteristic c : s.getCharacteristics()) {
                int p = c.getProperties();
                if (w == null && (p & (BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE)) != 0) w = c;
                if (n == null && (p & (BluetoothGattCharacteristic.PROPERTY_NOTIFY | BluetoothGattCharacteristic.PROPERTY_INDICATE)) != 0) n = c;
            }
            if (w != null && n != null) {
                if (preferred) {
                    wch = w;
                    nch = n;
                    return;
                }
                if (fw == null) {
                    fw = w;
                    fn = n;
                }
            }
        }
        wch = fw;
        nch = fn;
    }

    private void onBytes(byte[] b, int n) {
        synchronized (buf) {
            for (int i = 0; i < n; i++) {
                char c = (char) (b[i] & 0xff);
                if (c == '>') {
                    String r = buf.toString();
                    buf.setLength(0);
                    br.emit("obd", r);
                } else if (c != 0) {
                    buf.append(c);
                }
            }
            if (buf.length() > 8192) buf.setLength(0);
        }
    }

    void send(String cmd) {
        byte[] data = (cmd + "\r").getBytes(StandardCharsets.US_ASCII);
        try {
            if (sock != null && out != null) {
                out.write(data);
                out.flush();
            } else if (gatt != null && wch != null) {
                int wt = (wch.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0
                        ? BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                        : BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT;
                if (Build.VERSION.SDK_INT >= 33) {
                    gatt.writeCharacteristic(wch, data, wt);
                } else {
                    wch.setWriteType(wt);
                    wch.setValue(data);
                    gatt.writeCharacteristic(wch);
                }
            } else {
                br.emit("btError", "Bağlı değil");
            }
        } catch (Exception e) {
            br.emit("btError", "Gönderilemedi: " + e.getMessage());
        }
    }

    void disconnect() {
        session++;
        connected = false;
        stopScan();
        try {
            if (sock != null) sock.close();
        } catch (Exception ignored) {
        }
        sock = null;
        out = null;
        final BluetoothGatt g = gatt;
        gatt = null;
        if (g != null) {
            main.post(() -> {
                try {
                    g.disconnect();
                    g.close();
                } catch (Exception ignored) {
                }
            });
        }
        wch = null;
        nch = null;
    }
}
