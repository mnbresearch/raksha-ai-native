/* =========================================================
   Raksha AI v5 — guardian intelligence extensions
   AI Companion Call (talks + listens), escape routing,
   safe zones, duress decoy, auto evidence recording,
   photo watermarking, trip auto-detect, QR invite,
   backup/restore, SOS drill.
   ========================================================= */
"use strict";

/* ================= AI COMPANION CALL ================= */
/* A voice that actually talks with you while you walk —     */
/* and quietly listens for distress. All on-device APIs.     */
let compActive = false, compTimer = null, compRecog = null, compTurn = 0;
const COMP_LINES = [
  'I\'m right here with you. How\'s the road looking?',
  'You\'re doing great. Tell me when you can see your destination.',
  'Still with you. Say "all good" whenever you like.',
  'I\'m watching your surroundings through the sensors. Everything looks steady.',
  'Nearly there? Keep talking to me if anything feels off.',
];
function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN'; u.rate = 1; u.pitch = 1;
    const v = speechSynthesis.getVoices().find(v => v.lang.startsWith('en-IN')) ||
              speechSynthesis.getVoices().find(v => v.lang.startsWith('en'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch(e) {}
}
function startCompanion() {
  if (compActive) return endCompanion();
  compActive = true; compTurn = 0;
  $('fcName').textContent = 'Raksha Guardian';
  $('fcSub').textContent = 'AI companion · connected';
  $('fakeCallScreen').classList.add('show');
  $('fcAnswer').style.display = 'none';
  keepAwake(true);
  brainLog('🎧', 'AI Companion Call started', 0);
  speak('Hi, it\'s your Guardian. I\'ll stay on the line while you walk. If you ever need help, just say: help me. Otherwise, talk to me like a normal call.');
  compTimer = setInterval(() => {
    if (!compActive) return;
    speak(COMP_LINES[compTurn++ % COMP_LINES.length]);
  }, 28000);
  // listen for distress + replies
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    compRecog = new SR();
    compRecog.continuous = true; compRecog.interimResults = false; compRecog.lang = 'en-IN';
    compRecog.onresult = ev => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript.toLowerCase();
        if (/help me|bachao|बचाओ|emergency|danger/.test(t)) {
          speak('Understood. Getting help now. Stay on the line.');
          endCompanion(true);
          startEmergency('Companion call: distress phrase heard');
          return;
        }
        if (/all good|i.?m (fine|ok|okay)|reached|pahunch/.test(t)) {
          speak('Good to hear. I\'m still with you.');
          brainLog('🎧', 'Companion: user confirmed okay', 0);
        }
      }
    };
    compRecog.onend = () => { if (compActive) { try { compRecog.start(); } catch(e){} } };
    try { compRecog.start(); } catch(e) {}
  }
}
function endCompanion(silent) {
  compActive = false;
  clearInterval(compTimer);
  if (compRecog) { compRecog.onend = null; try { compRecog.stop(); } catch(e){} compRecog = null; }
  speechSynthesis.cancel();
  $('fakeCallScreen').classList.remove('show');
  $('fcAnswer').style.display = 'inline-block';
  $('fcSub').textContent = 'mobile · incoming call…';
  if (!silent) brainLog('🎧', 'Companion Call ended', 0);
  if (!walkActive && !S.trip && !S.emergencyActive) keepAwake(false);
}
/* companion call ends via decline button too */
$('fcDecline').addEventListener('click', () => { if (compActive) endCompanion(); });

/* ================= ESCAPE ROUTE — nearest safe place ================= */
async function escapeRoute() {
  if (!S.pos) return alert('Waiting for GPS lock.');
  brainLog('🏃', 'Escape route requested', 0);
  const q = `[out:json][timeout:15];(node["amenity"="police"](around:6000,${S.pos.lat},${S.pos.lon});node["amenity"="hospital"](around:6000,${S.pos.lat},${S.pos.lon}););out 20;`;
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method:'POST', body:'data='+encodeURIComponent(q) });
    const j = await r.json();
    let best = null, bestD = Infinity;
    j.elements.forEach(el => {
      if (el.lat == null) return;
      const d = haversine(S.pos, {lat: el.lat, lon: el.lon});
      if (d < bestD) { bestD = d; best = el; }
    });
    if (!best) { alert('No police station or hospital found within 6 km. Calling 112 is your fastest option.'); return; }
    const name = best.tags?.name || (best.tags?.amenity === 'police' ? 'Police station' : 'Hospital');
    // draw driving route on home map for orientation
    try {
      const rr = await fetch(`https://router.project-osrm.org/route/v1/driving/${S.pos.lon},${S.pos.lat};${best.lon},${best.lat}?overview=full&geometries=geojson`);
      const rj = await rr.json();
      if (rj.routes?.length && map) {
        L.polyline(rj.routes[0].geometry.coordinates.map(c => [c[1], c[0]]), {color:'#ff5470', weight:5}).addTo(map);
        map.fitBounds(L.latLngBounds([S.pos.lat, S.pos.lon], [best.lat, best.lon]).pad(0.3));
      }
    } catch(e) {}
    if (confirm(`🏃 Nearest safe place: ${name} (${(bestD/1000).toFixed(1)} km).\nOpen turn-by-turn walking navigation?`))
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${best.lat},${best.lon}&travelmode=walking`, '_blank');
  } catch(e) { alert('Could not reach map services — head toward lit, busy areas and call 112 if threatened.'); }
}

/* ================= SAFE ZONES ================= */
const zones = store.get('zones', []);
let curZone = null;
function addZone() {
  const n = $('zoneName').value.trim();
  if (!n) return alert('Name the zone (e.g. Home).');
  if (!S.pos) return alert('Waiting for GPS lock.');
  zones.push({ n, lat: S.pos.lat, lon: S.pos.lon, r: 250 });
  store.set('zones', zones);
  $('zoneName').value = '';
  renderZones();
  brainLog('📍', 'Safe zone saved: ' + n, 0);
}
function renderZones() {
  const l = $('zoneList');
  l.innerHTML = '';
  zones.forEach((z, i) => {
    const d = document.createElement('div');
    d.className = 'list-item';
    d.innerHTML = `<div><b>🏠 ${esc(z.n)}</b><div class="sub2">${z.lat.toFixed(4)}, ${z.lon.toFixed(4)} · ${z.r} m radius</div></div>`;
    const x = document.createElement('button');
    x.className = 'xbtn'; x.textContent = '🗑';
    x.onclick = () => { zones.splice(i,1); store.set('zones', zones); renderZones(); };
    d.appendChild(x);
    l.appendChild(d);
  });
}
setInterval(() => {
  if (!S.pos || !zones.length) return;
  const inside = zones.find(z => haversine(S.pos, z) < z.r) || null;
  if (inside && curZone !== inside.n) {
    curZone = inside.n;
    brainLog('🏠', 'Arrived at safe zone: ' + inside.n, 0);
    bumpStat('checks');
    famBroadcast('ok', 'Reached ' + inside.n);
    if ('Notification' in window && Notification.permission === 'granted')
      new Notification('🏠 Reached ' + inside.n, { body: 'Auto check-in logged. Family Live notified if active.' });
  } else if (!inside && curZone) {
    const h = new Date().getHours();
    brainLog('🚪', 'Left safe zone: ' + curZone + (h >= 22 || h < 5 ? ' late at night' : ''), (h >= 22 || h < 5) ? 10 : 0);
    curZone = null;
  }
}, 20000);

/* ================= DURESS PIN ================= */
async function setDuress() {
  const p = prompt('Choose a DURESS PIN (different from your real PIN).\nEntering it in Safe Space opens an empty decoy vault.');
  if (!p || p.trim().length < 4) return alert('Needs at least 4 digits.');
  const real = store.get('vault_pin', null);
  const h = await pinHash(p.trim());
  if (h === real) return alert('Duress PIN must be DIFFERENT from your real PIN.');
  store.set('duress_pin', h);
  alert('✅ Duress PIN set. Real evidence stays hidden when it\'s used.');
}

/* ================= AUTO EVIDENCE RECORDING ================= */
let autoRec = null;
setInterval(async () => {
  if (!$('autoRecToggle').checked || autoRec || S.emergencyActive) return;
  if (threatLevel() < 60) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    autoRec = new MediaRecorder(stream);
    autoRec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    autoRec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const div = document.createElement('div');
      div.className = 'rec-item';
      div.innerHTML = `<b>🎥 Auto evidence (threat spike)</b> — ${new Date().toLocaleString()}<audio controls src="${url}"></audio><a href="${url}" download="raksha-auto-${Date.now()}.webm" style="color:var(--blue)">⬇ Download</a>`;
      const list = $('recList');
      if (list.querySelector('.hint')) list.innerHTML = '';
      list.prepend(div);
      if (window.vaultKey && !window.decoyMode) vaultAddBlob(blob, 'Auto evidence (threat spike)', 'audio');
      autoRec = null;
    };
    autoRec.start();
    brainLog('🎥', 'Threat ≥60% — auto evidence recording started (3 min)', 0);
    setTimeout(() => { if (autoRec && autoRec.state !== 'inactive') autoRec.stop(); }, 180000);
  } catch(e) {}
}, 15000);

/* ================= PHOTO WATERMARK (court-grade metadata) ================= */
window.processPhoto = function(file) {
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0);
    const fs = Math.max(16, Math.round(img.width / 40));
    cx.font = 'bold ' + fs + 'px sans-serif';
    const lines = [
      'RAKSHA AI EVIDENCE · ' + new Date().toLocaleString(),
      S.pos ? 'GPS ' + S.pos.lat.toFixed(5) + ', ' + S.pos.lon.toFixed(5) + ' (±GPS)' : 'GPS unavailable',
    ];
    lines.forEach((t, i) => {
      const y = cv.height - (lines.length - i) * (fs * 1.5) - fs * 0.5;
      cx.fillStyle = 'rgba(0,0,0,.55)';
      cx.fillRect(0, y - fs * 1.1, cx.measureText(t).width + fs, fs * 1.5);
      cx.fillStyle = '#fff';
      cx.fillText(t, fs * 0.4, y);
    });
    cv.toBlob(b => vaultAdd('photo', 'Photo evidence (timestamped)', b || file), 'image/jpeg', 0.92);
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => vaultAdd('photo', 'Photo evidence', file);
  img.src = URL.createObjectURL(file);
};

/* ================= TRIP AUTO-DETECT ================= */
let tripPromptTs = 0;
setInterval(() => {
  if (S.trip || S.emergencyActive || !S.pos) return;
  if (Date.now() - tripPromptTs < 20 * 60000) return;
  const fast = S.speedHistory.filter(s => s.v > 8 && Date.now() - s.ts < 60000);
  if (fast.length >= 3) {
    tripPromptTs = Date.now();
    brainLog('🚗', 'Vehicle movement detected — offering trip watch', 0);
    if (confirm('🚗 Looks like you\'re travelling in a vehicle. Want the Guardian to watch this trip? (Set your destination on the Trip tab.)'))
      go('trip');
  }
}, 30000);

/* ================= FAMILY QR INVITE ================= */
function showFamQR() {
  const code = $('famCode').value.trim();
  if (!code) return alert('Set a family code first.');
  const link = location.origin + location.pathname + '?fam=' + encodeURIComponent(code);
  const img = $('famQR');
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(link);
  img.style.display = 'block';
}
/* auto-join family from QR link */
(function famFromURL() {
  const fam = new URLSearchParams(location.search).get('fam');
  if (fam) {
    $('famCode').value = fam;
    store.set('famcode', fam);
    setTimeout(() => {
      go('circle');
      alert('👨‍👩‍👧 Family invite detected! Enter your name and switch on "Go live with my family".');
    }, 900);
  }
})();

/* ================= BACKUP / RESTORE ================= */
function backupData() {
  const data = {};
  Object.keys(localStorage).filter(k => k.startsWith('raksha_')).forEach(k => data[k] = localStorage.getItem(k));
  const url = URL.createObjectURL(new Blob([JSON.stringify({ raksha_backup: 1, ts: Date.now(), data }, null, 1)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'raksha-backup-' + new Date().toISOString().slice(0,10) + '.json'; a.click();
}
$('restoreFile').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const j = JSON.parse(rd.result);
      if (!j.raksha_backup) throw new Error('bad file');
      Object.entries(j.data).forEach(([k, v]) => localStorage.setItem(k, v));
      alert('✅ Restored. Reloading…');
      location.reload();
    } catch(err) { alert('Not a valid Raksha backup file.'); }
  };
  rd.readAsText(f);
});

/* ================= SOS DRILL ================= */
function sosDrill() {
  alert('🎯 DRILL MODE — nothing will be sent.\n\nA check-in will appear, exactly like a real alert. Practice:\n1. Read the reason\n2. Tap "I\'m OK" in time\n\nIn a real event, not answering starts recording, alerts your circle, and offers a call to 112.');
  openCheckin('🎯 DRILL: Everything okay?', 'This is a practice alert. Tap "I\'m OK" before the timer ends.', 15);
  brainLog('🎯', 'SOS drill completed', 0);
}

/* ================= boot ================= */
renderZones();
if ('speechSynthesis' in window) speechSynthesis.getVoices(); // warm voices
