/* =========================================================
   Raksha AI v18 — install, updates & permissions
   • Install-to-phone (PWA) prompt pop-up + Dashboard install card
   • iOS "Add to Home Screen" guide + Android APK link
   • Update manager: detect new version → "Update now" banner;
     auto-applies on next open; security fixes always reachable
   • Permissions wizard: ask for ALL permissions up front
   • Version & security info
   ========================================================= */
"use strict";

const APP_VERSION = 'v22';
try { store.set('appversion', APP_VERSION); } catch (e) {}

/* ---------- install detection ---------- */
function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         store.get('installed', false);
}
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; }

/* ---------- install prompt ---------- */
let v18Prompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); v18Prompt = e;
  maybeShowInstallBanner(); refreshInstallStatus();
});
window.addEventListener('appinstalled', () => {
  store.set('installed', true); hideInstallBanner(); refreshInstallStatus();
  try { brainLog('📲', 'Raksha AI installed to home screen', 0); } catch (e) {}
});

function maybeShowInstallBanner() {
  if (isInstalled()) return;
  if (store.get('installDismissed', 0) > Date.now() - 3 * 86400000) return;   // snooze 3 days
  const b = $('installBanner'); if (b) b.style.display = 'flex';
}
function hideInstallBanner() { const b = $('installBanner'); if (b) b.style.display = 'none'; }
function dismissInstall() { store.set('installDismissed', Date.now()); hideInstallBanner(); }

async function doInstall() {
  if (isInstalled()) { alert('✅ Raksha AI is already installed — look for the shield icon on your home screen.'); return; }
  if (v18Prompt) {
    v18Prompt.prompt();
    const res = await v18Prompt.userChoice;
    if (res && res.outcome === 'accepted') { store.set('installed', true); hideInstallBanner(); }
    v18Prompt = null; refreshInstallStatus();
    return;
  }
  if (isIOS()) { $('iosModal').classList.add('show'); return; }
  alert('To install: open this page in Chrome → browser menu (⋮) → "Add to Home Screen" / "Install app".');
}
function getAndroidApp() {
  alert('The Android app (APK) is built free by GitHub. On the next screen: open the latest run → download the "raksha-ai-apk" artifact → install it. Full steps are in the repo README.');
  window.open('https://github.com/mnbresearch/raksha-ai-native/actions', '_blank');
}
function refreshInstallStatus() {
  const s = $('installStatus'); if (!s) return;
  s.textContent = isInstalled() ? '✅ Installed as an app on this device.'
    : (v18Prompt ? '📲 Ready to install — tap the button above.'
    : (isIOS() ? 'On iPhone: tap Share → Add to Home Screen.'
    : 'Open in Chrome to install, or use the browser menu → Add to Home Screen.'));
}

/* ---------- update manager ---------- */
let waitingSW = null, applyingUpdate = false;
async function initUpdates() {
  if (!('serviceWorker' in navigator)) return;
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) { try { reg = await navigator.serviceWorker.register('sw.js'); } catch (e) { return; } }
  if (reg.waiting && navigator.serviceWorker.controller) { waitingSW = reg.waiting; showUpdate(); }
  reg.addEventListener('updatefound', () => {
    const nw = reg.installing; if (!nw) return;
    nw.addEventListener('statechange', () => {
      if (nw.state === 'installed' && navigator.serviceWorker.controller) { waitingSW = nw; showUpdate(); }
    });
  });
  setInterval(() => reg.update().catch(() => {}), 60 * 60000);   // hourly check while open
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applyingUpdate && !reloaded) { reloaded = true; location.reload(); }
  });
  refreshVersion();
}
function showUpdate() { const b = $('updateBanner'); if (b) b.style.display = 'flex'; }
function applyUpdate() {
  if (waitingSW) { applyingUpdate = true; waitingSW.postMessage({ type: 'SKIP_WAITING' }); }
  else location.reload();
}
async function checkUpdate() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return alert('Offline engine not active yet — reopen the app once.');
  await reg.update();
  setTimeout(() => {
    if (reg.waiting || waitingSW) { showUpdate(); alert('🆕 An update is ready — tap "Update now" at the top.'); }
    else alert('✅ You have the latest version (Raksha AI ' + APP_VERSION + ').');
  }, 1500);
}
function refreshVersion() {
  const v = $('versionInfo'); if (!v) return;
  v.innerHTML = 'Current version: <b>Raksha AI ' + APP_VERSION + '</b><br>' +
    'Installed as app: ' + (isInstalled() ? 'yes ✅' : 'no (running in browser)') + '<br>' +
    'Offline-ready: ' + ((navigator.serviceWorker && navigator.serviceWorker.controller) ? 'yes ✅' : 'activating…');
}

/* ---------- permissions wizard ---------- */
const PERMS = [
  { key: 'geo',    emoji: '📍', name: 'Location',      why: 'SOS location, trip watch, family live and nearby safe places.' },
  { key: 'noti',   emoji: '🔔', name: 'Notifications', why: 'Check-in alerts, family SOS and reminders.' },
  { key: 'mic',    emoji: '🎙️', name: 'Microphone',    why: 'Evidence recording, scream detection and voice triggers.' },
  { key: 'cam',    emoji: '📷', name: 'Camera',        why: 'Photo evidence during emergencies and the flashlight.' },
  { key: 'motion', emoji: '📳', name: 'Motion sensors',why: 'Fall, crash and shake-to-SOS detection.' },
];
function openPermWizard() { renderPermList(); $('permModal').classList.add('show'); }
async function permState(key) {
  try {
    if (key === 'noti') return ('Notification' in window) ? Notification.permission : 'unsupported';
    if (navigator.permissions) {
      const map = { geo: 'geolocation', mic: 'microphone', cam: 'camera' };
      if (map[key]) { const s = await navigator.permissions.query({ name: map[key] }); return s.state; }
    }
  } catch (e) {}
  return 'unknown';
}
async function renderPermList() {
  const l = $('permList'); if (!l) return;
  l.innerHTML = '';
  for (const p of PERMS) {
    const st = await permState(p.key);
    const badge = st === 'granted' ? '✅' : (st === 'denied' ? '❌' : '•');
    const d = document.createElement('div'); d.className = 'list-item';
    d.innerHTML = `<div><b>${p.emoji} ${p.name} <span style="opacity:.8">${badge}</span></b><div class="sub2">${p.why}</div></div>`;
    if (st !== 'granted') {
      const b = document.createElement('button'); b.className = 'btn small'; b.style.margin = '0'; b.textContent = 'Allow';
      b.onclick = async () => { await requestPerm(p.key); renderPermList(); };
      d.appendChild(b);
    }
    l.appendChild(d);
  }
}
async function requestPerm(key) {
  try {
    if (key === 'geo') await new Promise(r => navigator.geolocation.getCurrentPosition(r, r, { timeout: 8000 }));
    else if (key === 'noti') { if ('Notification' in window) await Notification.requestPermission(); }
    else if (key === 'mic') { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); }
    else if (key === 'cam') { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach(t => t.stop()); }
    else if (key === 'motion') { if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') await DeviceMotionEvent.requestPermission(); }
  } catch (e) {}
}
async function grantAllPerms() {
  const btn = event && event.target; if (btn) btn.textContent = 'Requesting…';
  for (const p of PERMS) { await requestPerm(p.key); }
  store.set('permsDone', true);
  renderPermList();
  if (btn) btn.textContent = '✅ Grant all now';
  try { brainLog('🔐', 'Permission setup completed', 0); } catch (e) {}
}

/* ---------- Hindi for new strings ---------- */
if (typeof I18N !== 'undefined' && I18N.hi) Object.assign(I18N.hi, {
  installtitle: '📲 अपने फ़ोन पर इंस्टॉल करें', installp2: 'तुरंत एक-टैप एक्सेस के लिए Raksha AI को होम स्क्रीन पर जोड़ें — आपात स्थिति में ज़रूरी। इंस्टॉल के बाद ऑफ़लाइन काम करता है।',
  installbtn2: '📲 Raksha AI इंस्टॉल करें', getapk: '🤖 पूरा Android ऐप (APK) पाएँ',
  veupd: '🔄 वर्शन और अपडेट', chkupd: 'अपडेट जाँचें', privsec: '🔒 सुरक्षा और गोपनीयता',
  permsetup: 'अनुमतियाँ सेट करें', permbtn: 'अनुमतियाँ दें', grantall: '✅ अभी सभी दें',
});
if (typeof applyLang === 'function') applyLang();

/* ---------- boot ---------- */
refreshVersion(); refreshInstallStatus();
setTimeout(initUpdates, 2000);
setTimeout(() => { if (!isInstalled()) maybeShowInstallBanner(); }, 8000);
/* offer the permission wizard once, after the user has seen onboarding */
setTimeout(() => {
  if (store.get('toured', false) && !store.get('permsDone', false) && !store.get('permsNudged', false) && !store.get('stealth', false)) {
    store.set('permsNudged', true);
    openPermWizard();
  }
}, 3000);
try { brainLog('📲', 'v18 online — install prompt, update manager, permissions wizard', 0); } catch (e) {}
