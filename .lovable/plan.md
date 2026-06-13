## Why the error happens

Your GitHub Actions log shows this single step running:

```
Run node --version
  node --version
  npx cap sync android
```

That is the **old** `Sync Capacitor Android` step. The new `Add Android platform if missing` step (which runs `npx cap add android`) is **not in the workflow file on GitHub yet** — otherwise the log would show it executing before the sync step.

This is not a keystore/secrets issue. Your secrets are fine. The problem is simply that the updated `.github/workflows/build-apk.yml` hasn't reached GitHub, so the runner is still using the old version that tries to sync before the `android/` folder exists.

## Root cause

The `android/` folder is in `.gitignore` (or was never committed), so every fresh GitHub runner starts without it. Capacitor needs `npx cap add android` to generate it before `npx cap sync` will work.

The fix (already written locally) adds this step **before** sync:

```yaml
- name: Add Android platform if missing
  run: |
    if [ ! -d "android" ]; then
      npx cap add android
    fi
```

## Plan

1. Verify the current local `.github/workflows/build-apk.yml` already contains the `Add Android platform if missing` step (it does, per codebase context lines 48-52).
2. Make sure the file is pushed to GitHub `main` branch — that's the missing piece. The Lovable → GitHub sync should handle this automatically, but the log proves GitHub is still running the old YAML.
3. Once pushed, manually trigger **Build Android APK** via `workflow_dispatch` (Actions tab → Run workflow).
4. Expected new log order:
   - Checkout
   - Setup Node 22.12.0 → `v22.12.0`
   - Setup Java/Android SDK
   - npm install / build
   - **Add Android platform if missing** → runs `npx cap add android`
   - Sync Capacitor Android → succeeds
   - Build signed APK

## What you need to do

- Confirm in your GitHub repo that `.github/workflows/build-apk.yml` contains the `Add Android platform if missing` step (lines ~48-52). If not, the Lovable→GitHub sync hasn't pushed it — re-trigger sync or copy the file manually.
- Then re-run the workflow.

No code changes are needed from my side — the fix is already in the local file. The issue is purely that GitHub is running a stale version.
