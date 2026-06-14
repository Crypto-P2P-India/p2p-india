package com.cryptop2p.chat;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1209;
    private static final String PREFS_NAME = "crypto_p2p_native";
    private static final String PERMISSIONS_PROMPTED_KEY = "runtime_permissions_prompted";

    @Override
    protected void load() {
        super.load();
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openWalletOrDefault(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openWalletOrDefault(Uri.parse(url));
            }
        });
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        new Handler(Looper.getMainLooper()).postDelayed(this::requestStartupPermissionsOnce, 1700);
    }

    private boolean openWalletOrDefault(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null) return bridge.launchIntent(uri);

        Uri target = uri;
        if ("wc".equalsIgnoreCase(scheme)) {
            target = Uri.parse("okex://main/wc?uri=" + Uri.encode(uri.toString()));
        }

        if ("okx".equalsIgnoreCase(scheme) || "okex".equalsIgnoreCase(scheme) || "wc".equalsIgnoreCase(scheme)) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, target);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
        }

        return bridge.launchIntent(uri);
    }

    private void requestStartupPermissionsOnce() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (prefs.getBoolean(PERMISSIONS_PROMPTED_KEY, false)) return;

        List<String> permissions = new ArrayList<>();
        permissions.add(Manifest.permission.CAMERA);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS);
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES);
            permissions.add(Manifest.permission.READ_MEDIA_VIDEO);
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }

        prefs.edit().putBoolean(PERMISSIONS_PROMPTED_KEY, true).apply();
        ActivityCompat.requestPermissions(this, permissions.toArray(new String[0]), PERMISSION_REQUEST_CODE);
    }
}
