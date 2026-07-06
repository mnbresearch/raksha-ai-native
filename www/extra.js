/* =========================================================
   Raksha AI v8 — final extensions
   Floating SOS bubble, voice-answered check-ins, Silent SOS,
   photo evidence burst, cab logger, weekly report share.
   ========================================================= */
"use strict";

/* ================= FLOATING SOS BUBBLE (all screens) ================= */
(function sosBubble() {
  const b = $('sosBubble');
  let holdT = null, moved = false, drag = null;
  b.addEventListener('pointerdown', e => {
    moved = false;
    drag = { x: e.clientX, y: e.clientY, r: parseInt(b.style.right) || 14, bt: parseInt(b.style.bottom) || 92 };
    holdT = setTimeout(() => { if (!moved) { navigator.vibrate && navigator.vibrate(200); startEmergency('Floating SOS bubble held'); } }, 1200);
    b.setPointerCapture(e.pointerId);
  });
  b.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = drag.x - e.clientX, dy = drag.y - e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 12) { moved = true; clearTimeout(holdT); }
    b.style.right = Math.max(4, drag.r + dx) + 'px';
    b.style.bottom = Math.max(60, drag.bt + dy) + 'px';
  });
  ['pointerup', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => {
    clearTimeout(holdT);
    if (!moved && !S.emergencyActive) go('emergency');
    drag = null;
  }));
})();

/* ================= VOICE-ANSWERED CHECK-INS ================= */
let chkRecog = null;
const _xOpenCheckin = openCheckin;
openCheckin = function (title, reason, secs) {
  _xOpenCheckin(title, reason, secs);
  if (!$('voiceCheckinToggle').checked) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || chkRecog) return;
  try {
    chkRecog = new SR();
    chkRecog.continuous = true; chkRecog.interimResults = false; chkRecog.lang = 'en-IN';
    chkRecog.onresult = ev => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript.toLowerCase();
        if (/i.?m (ok|okay|fine)|all good|thik|ठीक/.test(t)) { stopChk(); $('imOkBtn').click(); speak('Glad you\'re okay.'); return; }
        if (/help|bachao|बचाओ|emergency/.test(t)) { stopChk(); $('needHelpBtn').click(); return; }
      }
    };
    chkRecog.onend = () => { if (chkRecog && $('checkinModal').classList.contains('show')) { try { chkRecog.start(); } catch (e) {} } };
    chkRecog.start();
    const watch = setInterval(() => { if (!$('checkinModal').classList.contains('show')) { clearInterval(watch); stopChk(); } }, 800);
  } catch (e) {}
};
function stopChk() { if (chkRecog) { const r = chkRecog; chkRecog = null; r.onend = null; try { r.stop(); } catch (e) {} } }

/* ================= SILENT SOS (hold clock 3 s) ================= */
let silentActive = false, silentRec = null, silentIv = null, clockHold = null;
$('clockPill').addEventListener('pointerdown', () => { clockHold = setTimeout(toggleSilentSOS, 3000); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('clockPill').addEventListener(ev, () => clearTimeout(clockHold)));

async function toggleSilentSOS() {
  if (silentActive) {   // stop
    silentActive = false;
    clearInterval(silentIv);
    if (silentRec && silentRec.state !== 'inactive') silentRec.stop();
    if (navigator.vibrate) navigator.vibrate(60);
    brainLog('🤫', 'Silent SOS stopped', 0);
    return;
  }
  silentActive = true;
  if (navigator.vibrate) navigator.vibrate([60, 60, 60]);   // only feedback: tiny vibration
  brainLog('🤫', 'SILENT SOS — recording + alerting family/volunteers, no visible change', 50);
  // recording
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    silentRec = new MediaRecorder(stream);
    silentRec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    silentRec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const url = URL.createObjectURL(new Blob(chunks, { type: 'audio/webm' }));
      const div = document.createElement('div');
      div.className = 'rec-item';
      div.innerHTML = `<b>🤫 Silent SOS recording</b> — ${new Date().toLocaleString()}<audio controls src="${url}"></audio>`;
      const list = $('recList');
      if (list.querySelector('.hint')) list.innerHTML = '';
      list.prepend(div);
    };
    silentRec.start();
  } catch (e) {}
  // alert family + volunteers, repeat location every 30 s
  const fire = () => {
    if (!silentActive) return;
    try { famBroadcast('SOS', 'Silent SOS'); } catch (e) {}
    try { volBroadcastSOS('Silent SOS'); } catch (e) {}
  };
  fire();
  silentIv = setInterval(fire, 30000);
}

/* ================= PHOTO EVIDENCE BURST ================= */
let burstIv = null, burstStream = null, burstN = 0;
const _xStartEmergency2 = startEmergency;
startEmergency = function (reason) {
  _xStartEmergency2(reason);
  if ($('photoBurstToggle').checked) startBurst();
};
async function startBurst() {
  if (burstIv) return;
  try {
    burstStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.createElement('video');
    video.srcObject = burstStream; video.muted = true;
    await video.play();
    burstN = 0;
    const snap = () => {
      if (!S.emergencyActive || burstN >= 6) return stopBurst();
      burstN++;
      const cv = document.createElement('canvas');
      cv.width = video.videoWidth || 640; cv.height = video.videoHeight || 480;
      cv.getContext('2d').drawImage(video, 0, 0);
      cv.toBlob(b => {
        if (!b) return;
        const url = URL.createObjectURL(b);
        const div = document.createElement('div');
        div.className = 'rec-item';
        div.innerHTML = `<b>📸 Evidence photo ${burstN}</b> — ${new Date().toLocaleTimeString()}<br><a href="${url}" target="_blank"><img src="${url}" style="width:100%;border-radius:8px;margin-top:6px"></a>`;
        const list = $('recList');
        if (list.querySelector('.hint')) list.innerHTML = '';
        list.prepend(div);
        if (window.vaultKey && !window.decoyMode) vaultAddBlob(b, 'Emergency photo ' + burstN, 'photo');
      }, 'image/jpeg', 0.85);
    };
    snap();
    burstIv = setInterval(snap, 20000);
    brainLog('📸', 'Photo evidence burst started (max 6 frames)', 0);
  } catch (e) {}
}
function stopBurst() {
  clearInterval(burstIv); burstIv = null;
  if (burstStream) { burstStream.getTracks().forEach(t => t.stop()); burstStream = null; }
}
$('stopEmergency').addEventListener('click', stopBurst);

/* ================= CAB LOGGER ================= */
const cabs = store.get('cabs', []);
function logCab() {
  const plate = $('cabPlate').value.trim().toUpperCase(), driver = $('cabDriver').value.trim();
  if (!plate) return alert('Enter the plate number.');
  const entry = { plate, driver, ts: Date.now(), la: S.pos ? +S.pos.lat.toFixed(4) : null, lo: S.pos ? +S.pos.lon.toFixed(4) : null };
  cabs.unshift(entry);
  store.set('cabs', cabs.slice(0, 20));
  $('cabPlate').value = ''; $('cabDriver').value = '';
  renderCabs();
  brainLog('🚖', 'Cab logged: ' + plate + (driver ? ' (' + driver + ')' : ''), 0);
  try { famBroadcast('ok', 'Boarding cab ' + plate + (driver ? ' — ' + driver : '')); } catch (e) {}
  const msg = `🚖 I'm boarding cab ${plate}${driver ? ' (' + driver + ')' : ''}${entry.la ? ' at https://maps.google.com/?q=' + entry.la + ',' + entry.lo : ''} (Raksha AI)`;
  if (navigator.share) navigator.share({ text: msg }).catch(() => {});
}
function renderCabs() {
  const l = $('cabList');
  if (!l) return;
  l.innerHTML = '';
  cabs.slice(0, 5).forEach(c => {
    const d = document.createElement('div');
    d.className = 'list-item';
    d.innerHTML = `<div><b>🚖 ${esc(c.plate)}</b><div class="sub2">${esc(c.driver || '')} · ${new Date(c.ts).toLocaleString()}</div></div>`;
    l.appendChild(d);
  });
}

/* ================= WEEKLY REPORT SHARE ================= */
function shareWeekly() {
  const st = S.stats;
  const { score } = computeScore();
  const hist = store.get('triphist', []);
  const weekTrips = hist.filter(h => Date.now() - h.ts < 7 * 86400000);
  const txt = `🛡️ My Raksha AI safety report\n` +
    `Current safety score: ${score}%\n` +
    `This week: ${weekTrips.length} safe trip(s) (${weekTrips.reduce((a, b) => a + b.km, 0).toFixed(1)} km)\n` +
    `All time: ${st.trips || 0} trips · ${st.checks || 0} check-ins answered · ${st.scams || 0} messages screened\n` +
    `Days protected: ${Math.max(1, Math.ceil((Date.now() - (st.since || Date.now())) / 86400000))}\n` +
    `Get protected free: ${location.origin + location.pathname}`;
  if (navigator.share) navigator.share({ text: txt }).catch(() => {});
  else prompt('Copy:', txt);
}

/* ================= boot ================= */
renderCabs();
brainLog('🧩', 'v8 extensions online — bubble SOS, silent SOS, voice check-ins, photo burst, cab logger', 0);
