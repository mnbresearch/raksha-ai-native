# Raksha AI — Native Android App 📱

The full Raksha AI app in a native Android shell with **true 24/7 background protection**:

- 🛰️ Background GPS with a persistent foreground service — **works with the screen OFF**
- 🚕 Trip watch, Family Live, and safe zones keep running when the app is minimized
- 🔔 Native notifications for check-ins, emergencies, and family SOS alerts
- Everything from the web app: Guardian Brain, Safe Space vault, Scam Shield, Companion Call, all of it

**Total cost: ₹0.** GitHub builds the APK for you in the cloud, free.

## Build the APK (10 minutes, no coding, no Android Studio)

1. **Create a free GitHub account** (github.com) if you don't have one.
2. **Create a new repository** → name it `raksha-ai-native` → Public → Create.
3. **Upload everything in this folder** to the repository:
   - Easiest way: on the repo page, "uploading an existing file" → drag ALL files/folders in (including the hidden `.github` folder — if drag-drop skips it, use "Add file → Create new file", type `.github/workflows/build-apk.yml` as the name, and paste that file's contents).
4. GitHub **Actions** tab → the "Build Raksha AI Android APK" workflow runs automatically (or press "Run workflow").
5. Wait ~8 minutes → click the finished run → download the **raksha-ai-apk** artifact.
6. Unzip it, copy `app-debug.apk` to your phone, tap to install (allow "Install from unknown sources").

## First-run setup on the phone (important)

1. Open Raksha AI → grant **Location** → choose **"Allow all the time"** (this is what enables 24/7 protection).
2. Allow **Notifications** and **Microphone**.
3. **Disable battery optimization** for Raksha AI: Settings → Apps → Raksha AI → Battery → Unrestricted. (Xiaomi/Oppo/Vivo also: enable "Autostart".) Without this, Android may kill the guardian overnight.
4. You'll see a permanent "🛡️ Guardian active" notification — that's the foreground service keeping you protected.

## What's still honest to know

- The **debug APK** is fine for personal/family use. For Play Store release you'd add a signing key (free) and pay Google's one-time $25 developer fee — optional.
- Silent auto-SMS is restricted by Android policy (only default SMS apps may send silently); emergencies still open a pre-filled SMS instantly, and **Family Live SOS broadcasts work fully automatically** in the background.
- Updating the app: edit files in `www/` on GitHub (or re-upload), Actions rebuilds a fresh APK automatically.

## Project layout

- `www/` — the complete Raksha AI web app + `native-bridge.js` (background powers)
- `capacitor.config.json`, `package.json` — native shell config (Capacitor, MIT-licensed)
- `patch-android.js` — injects Android permissions during the build
- `.github/workflows/build-apk.yml` — the free cloud build pipeline

MIT license. Made for India 🇮🇳
