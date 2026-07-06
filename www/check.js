/* =========================================================
   Raksha AI v7 — System Check, onboarding tour, hardened SOS
   • Guardian System Check: 20+ user-runnable diagnostics
   • First-launch guided tour
   • 5-tap orb → SOS
   • PIN required to stop emergency (anti-coercion)
   • Custom SOS message
   • TTS follows app language (Hindi voice in Hindi mode)
   ========================================================= */
"use strict";

/* ================= GUARDIAN SYSTEM CHECK ================= */
async function systemCheck() {
  const out = $('sysCheckResult');
  out.innerHTML = '⏳ Running diagnostics…';
  const R = [];
  const add = (name, pass, note) => R.push({ name, pass, note });
  const timed = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms || 8000))]);

  /* device & permissions */
  add('GPS lock', !!S.pos, S.pos ? 'position acquired' : 'no fix yet — allow location & go near a window');
  add('Trusted contacts', S.contacts.length > 0, S.contacts.length + ' added');
  try { const st = await navigator.permissions.query({ name: 'geolocation' }); add('Location permission', st.state === 'granted', st.state); } catch (e) { add('Location permission', !!S.pos, 'unknown'); }
  try { const st = await navigator.permissions.query({ name: 'microphone' }); add('Microphone permission', st.state === 'granted', st.state + (st.state !== 'granted' ? ' — needed for evidence recording & scream detection' : '')); } catch (e) { add('Microphone permission', true, 'unknown (check on first use)'); }
  add('Notifications', 'Notification' in window && Notification.permission === 'granted', 'Notification' in window ? Notification.permission : 'unsupported');
  add('Motion sensors', 'DeviceMotionEvent' in window, 'DeviceMotionEvent' in window ? 'available' : 'unsupported');
  add('Voice recognition', !!(window.SpeechRecognition || window.webkitSpeechRecognition), 'for Voice Guardian & Companion Call');
  add('Voice output (TTS)', 'speechSynthesis' in window, 'for Companion Call');
  add('Vibration', 'vibrate' in navigator, '');
  add('Wake lock (screen-on)', 'wakeLock' in navigator, 'keeps Walk With Me alive');
  add('Offline cache', (await navigator.serviceWorker.getRegistrations()).length > 0, 'service worker');
  add('Battery API', !!navigator.getBattery, 'for Battery Guardian');

  /* crypto */
  try {
    const k = await deriveKey('check-' + Date.now(), null);
    const kept = window.vaultKey; window.vaultKey = k;
    const e = await encBlob(new Blob(['ping'], { type: 'text/plain' }));
    const d = await (await decBlob(e, 'text/plain')).text();
    window.vaultKey = kept;
    add('Vault encryption (AES-256)', d === 'ping', 'encrypt/decrypt round-trip');
  } catch (e) { add('Vault encryption (AES-256)', false, String(e).slice(0, 60)); }
  add('Vault PIN set', !!store.get('vault_pin', null), store.get('vault_pin', null) ? 'set' : 'not set — Safe Space locked features off');

  /* rescue services — live */
  const svc = async (name, fn) => { try { add(name, await timed(fn()), 'reachable'); } catch (e) { add(name, false, 'unreachable — ' + String(e.message).slice(0, 40)); } };
  await svc('Family Live relay (ntfy)', async () => {
    const t = 'raksha-syscheck-' + Math.random().toString(36).slice(2, 9);
    const ok1 = (await fetch('https://ntfy.sh/' + t, { method: 'POST', body: '{"sys":"check"}' })).ok;
    await new Promise(r => setTimeout(r, 900));
    const txt = await (await fetch('https://ntfy.sh/' + t + '/json?poll=1')).text();
    return ok1 && txt.includes('sys');
  });
  await svc('Road routing (OSRM)', async () => (await (await fetch('https://router.project-osrm.org/route/v1/driving/77.209,28.6139;77.2295,28.6129?overview=false')).json()).code === 'Ok');
  await svc('Nearby places (Overpass)', async () => (await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent('[out:json][timeout:8];node["amenity"="police"](around:2000,28.6139,77.209);out 1;') })).ok);
  await svc('Weather (Open-Meteo)', async () => !!(await (await fetch('https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&current_weather=true')).json()).current_weather);
  await svc('Map tiles (OpenStreetMap)', async () => { await fetch('https://tile.openstreetmap.org/1/1/1.png', { mode: 'no-cors' }); return true; });

  /* readiness summary */
  const passN = R.filter(r => r.pass).length;
  const pct = Math.round(passN / R.length * 100);
  out.innerHTML =
    `<div class="value" style="color:${pct >= 85 ? 'var(--green)' : pct >= 60 ? 'var(--amber)' : 'var(--red)'}">Guardian readiness: ${pct}% (${passN}/${R.length})</div>` +
    R.map(r => `<div>${r.pass ? '✅' : '❌'} <b>${r.name}</b>${r.note ? ' <span style="color:var(--muted)">— ' + r.note + '</span>' : ''}</div>`).join('');
  brainLog('🩺', 'System check: ' + passN + '/' + R.length + ' (' + pct + '%)', 0);
}

/* ================= ONBOARDING TOUR ================= */
const TOUR = [
  ['🛡️ Welcome to Raksha AI', 'Your personal AI safety companion. Free, open source, and everything stays on your phone — no accounts, no tracking. This 30-second tour shows you the 4 things that matter most.'],
  ['👥 1. Add your Trusted Circle', 'Go to More → Trusted Circle and add 2-3 people. Every emergency feature alerts them. This is the single most important setup step.'],
  ['🚨 2. The SOS button', 'Hold the red button on the SOS tab for 1.5 seconds. It records evidence, locks your GPS, messages your circle, and offers a one-tap call to 112. Try the practice drill in Quick Tools first!'],
  ['🛰️ 3. Family Live', 'In Trusted Circle, set a family code and go live — your whole family sees each other on one map and gets instant SOS alerts. Works across the world, free.'],
  ['🚶‍♀️ 4. Before you walk alone', 'Use Walk With Me (thumb on screen) or the AI Companion Call (a voice that talks with you). Say "help me" any time and the Guardian takes over. Stay safe. 💚'],
];
let tourStep = 0;
function showTour() {
  const [t, b] = TOUR[tourStep];
  $('tourTitle').textContent = t;
  $('tourBody').textContent = b;
  $('tourNext').textContent = tourStep === TOUR.length - 1 ? 'Start using Raksha AI' : 'Next (' + (tourStep + 1) + '/' + TOUR.length + ')';
  $('tourModal').classList.add('show');
}
$('tourNext').addEventListener('click', () => {
  tourStep++;
  if (tourStep >= TOUR.length) { $('tourModal').classList.remove('show'); store.set('toured', true); go('circle'); return; }
  showTour();
});
$('tourSkip').addEventListener('click', () => { $('tourModal').classList.remove('show'); store.set('toured', true); });
if (!store.get('toured', false) && !store.get('stealth', false)) setTimeout(showTour, 1500);

/* ================= 5-TAP ORB → SOS ================= */
let orbTaps = [];
$('orb').addEventListener('pointerdown', () => {
  const now = Date.now();
  orbTaps = orbTaps.filter(t => now - t < 2500);
  orbTaps.push(now);
  if (orbTaps.length >= 5) { orbTaps = []; startEmergency('5-tap Guardian orb'); }
});

/* ================= PIN-PROTECTED EMERGENCY STOP ================= */
$('pinStopToggle').checked = !!store.get('pinstop', false);
$('pinStopToggle').addEventListener('change', e => {
  if (e.target.checked && !store.get('vault_pin', null)) {
    alert('Set a Safe Space PIN first (Settings → Set / change PIN).');
    e.target.checked = false;
    return;
  }
  store.set('pinstop', e.target.checked);
});
/* intercept BEFORE the original handler using capture phase */
(function hardenStop() {
  const btn = $('stopEmergency');
  btn.addEventListener('click', async ev => {
    if (!store.get('pinstop', false) || !S.emergencyActive) return;
    ev.stopImmediatePropagation();
    const pin = prompt('🔒 Enter your PIN to stop the emergency:');
    if (pin && (await pinHash(pin.trim())) === store.get('vault_pin', null)) {
      store.set('pinstop', false);            // temporarily disarm
      btn.click();                            // run the real stop
      store.set('pinstop', true);             // re-arm
    } else {
      alert('Wrong PIN — emergency stays active.');
    }
  }, true);
})();

/* ================= CUSTOM SOS MESSAGE ================= */
$('customSosMsg').value = store.get('sosmsg', '');
$('customSosMsg').addEventListener('change', e => store.set('sosmsg', e.target.value.trim()));
/* weave into emergency SMS by wrapping startEmergency chain is complex —
   instead patch the sms: URL at source via a tiny helper the engine already uses */
const _cStartEmergency = startEmergency;
startEmergency = function (reason) {
  const extra = store.get('sosmsg', '');
  _cStartEmergency(extra ? reason + '. ' + extra : reason);
};

/* ================= TTS FOLLOWS APP LANGUAGE ================= */
const _cSpeak = window.speak;
window.speak = function (text) {
  try {
    if (lang === 'hi') {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'hi-IN';
      const v = speechSynthesis.getVoices().find(v => v.lang.startsWith('hi'));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
      return;
    }
  } catch (e) {}
  _cSpeak(text);
};

/* ================= boot ================= */
brainLog('🩺', 'System Check module online — run diagnostics in Settings', 0);
