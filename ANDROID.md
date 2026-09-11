# Android Kiosk & Auto-start Strategy

The screens already run Android. **No external hardware** (TV box, Raspberry Pi, mini-PC)
is required. The player is a web app now and can become a thin APK later **without
rewriting any playback logic**, because all playback lives in the React player and talks
to the backend over REST/WS.

## Phase 1 — Web player in a managed kiosk browser (ship today)

Use a managed kiosk browser (e.g. **Fully Kiosk Browser**) or Android Enterprise / a
managed WebView pointed at:

```
https://display.example.com/player/
```

Configure on the device:
- **Start on boot** + **Restart on crash** (Fully Kiosk options, or an MDM kiosk profile).
- **Screen pinning / Lock Task** so users can't leave the app.
- Keep screen on / disable sleep.

The player itself already:
- requests the **Fullscreen API** on load/interaction/visibility change;
- renders edge-to-edge (`100vw/100vh`, `object-fit: cover`, `overflow: hidden`);
- blocks context menu, text selection, pinch-zoom, pull-to-refresh and **back navigation**;
- hides all admin UI (the player build is a separate app served under `/player/`);
- caches media + playlist for **offline** playback and **auto-reconnects**;
- runs a **freeze watchdog** that self-reloads a wedged main thread.

Auto-start after reboot needs no login: the device token is stored on first pairing and
re-authenticated automatically.

## Phase 2 — Dedicated APK (WebView shell, no playback rewrite)

A single-Activity Android app wrapping the same hosted `/player/` build:

```
MainActivity (WebView, loadUrl "https://display.example.com/player/")
├── AndroidManifest: <intent-filter> LAUNCHER
├── BootReceiver: <receiver> RECEIVE_BOOT_COMPLETED → start MainActivity
├── Lock Task Mode: startLockTask() (device owner via ADB `dpm set-device-owner` or EMM)
├── WakeLock / FLAG_KEEP_SCREEN_ON
└── JS bridge (window.AndroidBridge):
      • secure token storage (EncryptedSharedPreferences)  → swap deviceStore
      • restartApp()   → handles RESTART_PLAYER command
      • enterFullscreen(), setWakeLock(true)
```

Only the small adapters change:
- `apps/player/src/storage/deviceStore.ts` → back it with `AndroidBridge` when present,
  falling back to `localStorage` in a plain browser.
- `RESTART_PLAYER` → call `AndroidBridge.restartApp()` if available, else `location.reload()`.

Because the player reads the backend for all content and state, the APK is a thin shell;
the playback engine, offline cache, WS handling and kiosk behaviours are unchanged.

### Recommended manifest snippets

```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>
<activity android:name=".MainActivity" android:screenOrientation="sensorLandscape"
          android:configChanges="orientation|screenSize|keyboardHidden">
  <intent-filter>
    <action android:name="android.intent.action.MAIN"/>
    <category android:name="android.intent.category.HOME"/>   <!-- optional: act as launcher -->
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.LAUNCHER"/>
  </intent-filter>
</activity>
<receiver android:name=".BootReceiver" android:exported="true">
  <intent-filter><action android:name="android.intent.action.BOOT_COMPLETED"/></intent-filter>
</receiver>
```

No **Exit Kiosk** button is exposed to normal users; exit is possible only via the
device owner / ADB, matching a dedicated-signage device.
