# Raksha AI 🛡️

**Your Personal AI Safety Companion — free, open source, 100% on-device.**

Tagline: *Protecting Every Journey. Every Moment.*

This is a working Progressive Web App (PWA). No servers, no accounts, no data collection. Everything runs in the browser using free open-source components: Leaflet + OpenStreetMap (maps), Overpass API (nearby police/hospitals), and native browser APIs (GPS, accelerometer, speech recognition, audio recording).

## What works today (v2 — full-scale)

- **Guardian home** — glowing AI Guardian orb, live safety score with transparent reasons (time of day, isolation, nearby police/hospitals, community reports), live map
- **Trip Mode with real routing** — real road routes via OSRM, alternative routes each rated with a night-aware safety index (safest vs fastest), deviation >500 m / unexpected stop / ETA-overrun detection → check-in → escalation
- **Emergency workflow** — hold-SOS → check-in → mic evidence recording → GPS lock → pre-filled SMS/WhatsApp to trusted circle → one-tap call to primary contact or 112
- **Crash/accident detection** — severe impact while moving at vehicle speed → 20 s countdown → auto-alert
- **Safe Space (domestic violence)** — PIN-locked evidence vault with real AES-256-GCM encryption (WebCrypto + PBKDF2), photos/voice notes/incident notes, exportable timeline for legal proceedings, **disguised quick-exit calculator** (type your PIN then `=` to return)
- **Scam Shield** — on-device analyzer for 20+ Indian fraud patterns: UPI collect requests, fake KYC, digital arrest, courier/customs, task fraud, sextortion, investment groups… with 1930 + cybercrime.gov.in reporting
- **Elder Care** — periodic well-being check-ins with auto-alert, sensitive fall detection, daily medicine reminders, Elder Line 14567
- **Child Safety** — one-tap safe-arrival to the whole circle, school trip watch, CHILDLINE 1098
- **Mind Guardian** — Tele-MANAS 14416, KIRAN, AASRA, guided breathing exercise
- **Community Shield** — mark unsafe spots (harassment, dark streets, theft…) on the map; nearby reports lower your safety score
- **India Helplines** — 17 verified national numbers with one-tap calling (112 unified, 181/1091 women, 1098 child, 1930 cyber, 14416 mental health…)
- **Voice Guardian** — secret phrase + "help me"/"bachao" (English & Hindi) silently triggers emergency
- **Fake call, loud alarm, fall detection, live-location share**
- **Safety Dashboard** — trips completed, check-ins, scams screened, days protected
- **Hindi / English** — full UI toggle
- **Trusted Circle** — on-device only

## ⚠️ Why your first deployment vanished

Netlify Drop sites deployed **without logging in** are auto-deleted after 1 hour. Deploy while logged into a free Netlify/Vercel/GitHub account and the site stays up permanently.

## Deploy for free (pick one, ~2 minutes)

Because the app needs GPS/microphone, it must be served over **HTTPS**. All of these are free:

**GitHub Pages**
1. Create a free GitHub account and a new public repository (e.g. `raksha-ai`)
2. Upload these 5 files (`index.html`, `manifest.json`, `sw.js`, `icon.svg`, `README.md`)
3. Repo Settings → Pages → Source: `main` branch → Save
4. Your app is live at `https://<username>.github.io/raksha-ai/`

**Netlify Drop** — go to https://app.netlify.com/drop and drag this folder in. Live instantly.

**Vercel / Cloudflare Pages** — same idea, drag-and-drop or connect the repo.

Then on your phone: open the URL in Chrome → menu → **Add to Home Screen**. It installs like a native app.

## Test locally

```
cd raksha-ai
python3 -m http.server 8080
```
Open http://localhost:8080 (localhost counts as secure, so GPS/mic work).

## Honest limitations (browser vs. native app)

- **Background monitoring**: browsers suspend pages when the screen is off. Continuous 24/7 monitoring (the full vision) needs a native app — see roadmap below.
- **SMS sending**: the web can't send SMS silently; it opens your SMS app pre-filled. True auto-send needs a native app or an SMS gateway.
- **Speech recognition**: best on Chrome for Android; on some browsers it routes audio through the browser vendor's speech service.
- **iOS**: motion sensors need a permission tap; speech recognition support is limited.

## Open-source roadmap to the full vision

| Feature | Free/open-source building block |
|---|---|
| Native app | React Native (Expo) or Flutter — both free |
| Background location & trips | expo-location / Android Foreground Service |
| On-device distress/scream detection | TensorFlow Lite + YAMNet audio model |
| Offline speech ("help me") | Vosk (offline, open source, supports Hindi) |
| Fall detection model | TFLite accelerometer models (open datasets: SisFall, MobiAct) |
| Safest-route scoring | OpenStreetMap + OSRM/Valhalla (self-hosted, free) |
| Crime/safety heatmaps | Open government data (data.gov.in, NCRB reports) |
| Encrypted evidence vault | libsodium / SQLCipher (open source) |
| Backend (if ever needed) | Supabase free tier / self-hosted PocketBase |
| Push alerts to family | ntfy.sh (open source, free) |

## Privacy principles (already enforced by design)

Everything is on-device. No analytics, no accounts, no uploads. Contacts live in localStorage; recordings live in browser memory until you download them. The only network calls are OpenStreetMap map tiles and the Overpass API for nearby police/hospitals.

## License

MIT — use it, fork it, build the mission.
