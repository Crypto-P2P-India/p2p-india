## Problem

Build was repeatedly failing at `:capacitor-android:compileReleaseJavaWithJavac` with:
```
error: invalid source release: 21
```

This is on our side (project config), not yours.

**Root cause:** the project was using Capacitor 8, whose Android module requires Java 21. The CI runner kept compiling with Java 17, so `invalid source release: 21` kept returning.

## Fix

Pin Capacitor to the stable Java-17-compatible v6 line and keep GitHub Actions on JDK 17. This avoids relying on Java 21 support in CI.

### Change

Changes applied:

- `@capacitor/core`, `@capacitor/cli`, and `@capacitor/android` pinned to `^6.2.1`
- `.github/workflows/build-apk.yml` uses Temurin JDK 17
- `android/app/capacitor.build.gradle` uses `JavaVersion.VERSION_17`

## Expected result

After this change, the workflow will:
1. Install JDK 17 (Temurin)
2. `compileReleaseJavaWithJavac` will compile Java 17 sources
3. APK builds and gets committed to `public/downloads/crypto-p2p.apk`