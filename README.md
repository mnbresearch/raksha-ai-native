# 🛡️ Raksha AI

**Your Personal AI Safety Companion — free, open source, made for India 🇮🇳**

*Protecting Every Journey. Every Moment.*

**▶️ Use it now (any phone, no install): https://raksha-ai-guardian.netlify.app**
📖 [User guide](https://raksha-ai-guardian.netlify.app/help.html) · 🌐 [Landing page](https://raksha-ai-guardian.netlify.app/about.html) · 🛰️ [Family tracker](https://raksha-ai-guardian.netlify.app/track.html)

---

Raksha AI is a ~105-feature safety platform that runs entirely on your phone. **No accounts, no servers, no analytics, no data collection.** Your data lives on your device, encrypted where sensitive. Location sharing uses the open-source [ntfy.sh](https://ntfy.sh) relay only when you switch it on.

## What it does

- **🚨 Emergency SOS** — hold-button, silent (hold the clock), shake, voice-phrase, 5-tap orb, or floating bubble. Staged escalation: check-in → record evidence → lock GPS → alert circle → call for help. Crash detection, auto-call, PIN-protected stop.
- **🛰️ Family Live** — the whole family on one live map with instant SOS alerts, plus a no-install browser tracker link and optional Telegram push notifications.
- **🚶‍♀️ Walk With Me & AI Companion Call** — a deadman-switch escort and a voice that actually talks with you and listens for distress.
- **🚕 Guardian Trips** — real road routes rated for safety; deviation, stops, and delays trigger check-ins.
- **🔐 Safe Space** — AES-256 encrypted evidence vault for abuse survivors: photos, voice notes, incident timeline, court-ready PDF export, duress PIN, calculator disguise.
- **🕵️ Scam Shield** — 28 Indian fraud patterns detected on-device (UPI, KYC, digital arrest, wedding-APK malware…).
- **🧠 Guardian Brain** — explainable sensor-fusion threat meter that learns your normal, on-device.
- **🦺 Volunteer Shield, Elder Care, Child Safety, Mind Guardian, 18 national helplines, full Hindi**, and much more.

## 📱 Build the Android APK (free, no Android Studio)

The app runs great as a website, but the Android build adds **24/7 background protection** (GPS with the screen off).

1. Fork/clone this repo (or upload the files to your own GitHub repo).
2. Go to the **Actions** tab → the *Build Raksha AI Android APK* workflow runs automatically on every push (or click **Run workflow**).
3. When it finishes (~8 min), open the run → download the **raksha-ai-apk** artifact → install `app-debug.apk` on your phone.
4. On the phone: grant Location **“Allow all the time”**, and set Battery → **Unrestricted**.

GitHub's servers do the compiling for free. The only optional cost is Google's one-time $25 fee if you ever publish to the Play Store.

## 🔒 Privacy by architecture

There is no backend to breach and no user database to leak. Everything is client-side. The evidence vault uses WebCrypto (PBKDF2 + AES-256-GCM). Read the source — that's the point of open source.

## Project structure

```
www/                  the complete app (13 JS modules + tracker + landing + guide)
capacitor.config.json native shell config
patch-android.js      injects Android permissions during CI build
.github/workflows/    free cloud APK build pipeline
```

## License

MIT. Use it, fork it, improve it, share it. Built to help people stay safe.

*In any real emergency, call **112**. Raksha AI assists — it never replaces emergency services.*
