## Problem

Build fails at `:capacitor-android:compileReleaseJavaWithJavac` with:
```
error: invalid source release: 21
```

This is on our side (project config), not yours.

**Root cause:** Capacitor 7+ generates `android/app/capacitor.build.gradle` with `sourceCompatibility/targetCompatibility = JavaVersion.VERSION_21`, but the GitHub Actions workflow installs **JDK 17**. JDK 17 cannot compile Java 21 sources.

## Fix

Upgrade the workflow's Java version from 17 → 21. This is the cleanest fix and matches what Capacitor expects.

### Change

In `.github/workflows/build-apk.yml`, the `Setup Java JDK` step:

```yaml
- name: Setup Java JDK 21
  uses: actions/setup-java@v4
  with:
    distribution: 'temurin'
    java-version: '21'
```

(Just bumps `java-version: '17'` → `'21'` and renames the step label.)

No other files need to change. `android/app/capacitor.build.gradle` stays at Java 21 (Capacitor will regenerate it anyway on every sync), and Gradle 8.14.3 already supports JDK 21.

## Expected result

After this change, the workflow will:
1. Install JDK 21 (Temurin)
2. `compileReleaseJavaWithJavac` will accept `source release: 21`
3. APK builds and gets committed to `public/downloads/crypto-p2p.apk`

Shall I apply it?