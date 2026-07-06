/* =========================================================
   Raksha AI v6 — Shield extensions
   Rescue Radio (live SOS audio to family), Volunteer Shield
   (city alert network), breadcrumb trail + GPX, ICE wallpaper,
   morning briefing, voice-guided emergency.
   ========================================================= */
"use strict";

/* ================= BREADCRUMB TRAIL ================= */
let trail = store.get('trail', []);
let trailLayer = null, lastCrumb = 0;
setInterval(() => {
  if (!S.pos) return;
  const active = (typeof walkActive !== 'undefined' && walkActive) || S.trip || S.emergencyActive;
  if (!active || Date.now() - lastCrumb < 10000) return;
  lastCrumb = Date.now();
  trail.push({ la: +S.pos.lat.toFixed(5), lo: +S.pos.lon.toFixed(5), ts: Date.now() });
  if (trail.length > 800) trail.shift();
  store.set('trail', trail);
}, 5000);

function showTrail() {
  if (!trail.length) return alert('No trail yet — it records during trips, Walk With Me, and emergencies.');
  if (!tripMap) return alert('Open once your GPS has locked.');
  if (trailLayer) tripMap.removeLayer(trailLayer);
  trailLayer = L.polyline(trail.map(p => [p.la, p.lo]), { color: '#ffb84d', weight: 4, dashArray: '4 7' }).addTo(tripMap);
  tripMap.fitBounds(trailLayer.getBounds(), { padding: [30, 30] });
  alert('🟠 Trail shown on the trip map: ' + trail.length + ' points from ' + new Date(trail[0].ts).toLocaleString());
}
function exportGPX() {
  if (!trail.length) return alert('No trail recorded yet.');
  const gpx = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Raksha AI" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>Raksha AI trail</name><trkseg>\n' +
    trail.map(p => `<trkpt lat="${p.la}" lon="${p.lo}"><time>${new Date(p.ts).toISOString()}</time></trkpt>`).join('\n') +
    '\n</trkseg></trk>\n</gpx>';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
  a.download = 'raksha-trail-' + new Date().toISOString().slice(0, 10) + '.gpx';
  a.click();
}
function clearTrail() {
  if (confirm('Delete the recorded trail?')) { trail = []; store.set('trail', trail); if (trailLayer && tripMap) tripMap.removeLayer(trailLayer); }
}

/* ================= RESCUE RADIO ================= */
/* During an emergency, 15-second audio clips are broadcast to  */
/* your Family Live channel — family hears what's happening.    */
let radioRec = null;
async function startRescueRadio() {
  const topic = (typeof famTopic === 'function') ? famTopic() : null;
  if (!topic || !$('famToggle').checked || radioRec) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    radioRec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined });
    let n = 0;
    radioRec.ondataavailable = async e => {
      if (!e.data.size || e.data.size > 900000) return;
      n++;
      try {
        await fetch('https://ntfy.sh/' + topic, {
          method: 'PUT',
          body: e.data,
          headers: { 'Filename': 'sos-audio-' + n + '.webm', 'X-Title': '🔴 Rescue Radio clip ' + n }
        });
      } catch (err) {}
    };
    radioRec.onstop = () => { stream.getTracks().forEach(t => t.stop()); radioRec = null; };
    radioRec.start(15000);   // one clip every 15 s
    brainLog('📻', 'Rescue Radio live — audio clips broadcasting to family channel', 0);
  } catch (e) {}
}
function stopRescueRadio() { if (radioRec && radioRec.state !== 'inactive') radioRec.stop(); }

/* ================= VOLUNTEER SHIELD ================= */
let volES = null;
$('volCity').value = store.get('volcity', '');
$('volBroadcast').checked = !!store.get('volbc', false);
$('volBroadcast').addEventListener('change', e => {
  store.set('volbc', e.target.checked);
  store.set('volcity', $('volCity').value.trim());
});
$('volToggle').addEventListener('change', e => {
  if (!e.target.checked) { if (volES) { volES.close(); volES = null; } $('volAlert').classList.remove('show'); return; }
  const city = cityTopic();
  if (!city) { alert('Enter your city first.'); e.target.checked = false; return; }
  store.set('volcity', $('volCity').value.trim());
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  volES = new EventSource('https://ntfy.sh/' + city + '/sse');
  volES.onmessage = ev => {
    try {
      const n = JSON.parse(ev.data);
      if (!n.message) return;
      const m = JSON.parse(n.message);
      if (m.type !== 'sos') return;
      const dist = S.pos && m.la ? ' · ' + (haversine(S.pos, { lat: m.la, lon: m.lo }) / 1000).toFixed(1) + ' km from you' : '';
      $('volAlert').classList.add('show');
      $('volAlert').innerHTML = '🚨 <b>Someone in your city needs help</b>' + esc(dist) +
        (m.la ? ' — <a style="color:#ffd9a0" target="_blank" href="https://maps.google.com/?q=' + m.la + ',' + m.lo + '">open location</a>. ' : '. ') +
        'If you go, tell someone where you\'re going, and call 112 on the way.';
      beep(5);
      if (navigator.vibrate) navigator.vibrate([400, 150, 400]);
      if ('Notification' in window && Notification.permission === 'granted')
        new Notification('🦺 Volunteer alert', { body: 'Someone in your city triggered SOS' + dist });
      brainLog('🦺', 'Volunteer alert received' + dist, 0);
    } catch (e) {}
  };
  $('volAlert').classList.add('show');
  $('volAlert').textContent = '🦺 Volunteering for "' + $('volCity').value.trim() + '" — you\'ll be alerted while the app is open.';
});
function cityTopic() {
  const c = $('volCity').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return c ? 'raksha-city-' + c : null;
}
function volBroadcastSOS(reason) {
  if (!store.get('volbc', false)) return;
  const city = cityTopic();
  if (!city) return;
  const m = { type: 'sos', ts: Date.now(), r: (reason || '').slice(0, 80) };
  if (S.pos) { m.la = +S.pos.lat.toFixed(4); m.lo = +S.pos.lon.toFixed(4); }
  fetch('https://ntfy.sh/' + city, { method: 'POST', body: JSON.stringify(m), headers: { 'Priority': 'urgent', 'X-Title': 'SOS in your city' } }).catch(() => {});
}

/* ================= VOICE-GUIDED EMERGENCY + hooks ================= */
const _sStartEmergency = startEmergency;
startEmergency = function (reason) {
  _sStartEmergency(reason);
  try { speak('Emergency activated. I am recording evidence, capturing your location, and alerting your circle. Help options are on screen.'); } catch (e) {}
  startRescueRadio();
  volBroadcastSOS(reason);
};
/* stop radio when user marks safe */
$('stopEmergency').addEventListener('click', stopRescueRadio);

/* ================= ICE LOCK-SCREEN WALLPAPER ================= */
function iceWallpaper() {
  const ice = store.get('ice', null);
  if (!ice || !ice.name) return alert('Fill and save your ICE card first.');
  const W = 1080, H = 1920;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#0b1220'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#141d30'; c.fillRect(60, 560, W - 120, 900);
  c.strokeStyle = '#ff5470'; c.lineWidth = 6; c.strokeRect(60, 560, W - 120, 900);
  c.fillStyle = '#ff5470'; c.font = 'bold 64px sans-serif'; c.textAlign = 'center';
  c.fillText('🆘 IN CASE OF EMERGENCY', W / 2, 680);
  c.fillStyle = '#e8eefc'; c.font = 'bold 58px sans-serif';
  c.fillText(ice.name + (ice.dob ? ' · ' + ice.dob : ''), W / 2, 800);
  c.font = '46px sans-serif'; c.fillStyle = '#c7d4f0';
  const lines = [];
  if (ice.blood) lines.push('🩸 Blood group: ' + ice.blood);
  if (ice.allergy) lines.push('⚠️ Allergies: ' + ice.allergy);
  if (ice.conditions) lines.push('🏥 ' + ice.conditions);
  if (ice.meds) lines.push('💊 ' + ice.meds);
  if (ice.contact) lines.push('📞 ' + ice.contact);
  lines.push('🚑 Ambulance 108 · Emergency 112');
  lines.forEach((t, i) => c.fillText(t.slice(0, 42), W / 2, 920 + i * 90));
  c.fillStyle = '#2ee6a8'; c.font = 'bold 40px sans-serif';
  c.fillText('Protected by Raksha AI', W / 2, 1400);
  cv.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'raksha-ice-lockscreen.png';
    a.click();
    alert('✅ Wallpaper downloaded. Set it as your LOCK SCREEN: Settings → Wallpaper → choose this image.');
  }, 'image/png');
}

/* ================= MORNING GUARDIAN BRIEFING ================= */
setTimeout(() => {
  const today = new Date().toDateString();
  if (store.get('lastbrief', '') === today) return;
  store.set('lastbrief', today);
  const { score, reasons } = computeScore();
  const st = S.stats;
  const msg = `☀️ Guardian briefing: Safety score ${score}%${reasons.length ? ' (' + reasons[0] + ')' : ''}. ` +
    `${S.contacts.length} contact(s) ready · ${st.trips || 0} safe trips so far · ` +
    ($('famToggle') && $('famToggle').checked ? 'Family Live ON.' : 'Tip: turn on Family Live before you head out.');
  const b = $('briefBanner');
  b.classList.add('show');
  b.textContent = msg;
  setTimeout(() => b.classList.remove('show'), 45000);
  if ('Notification' in window && Notification.permission === 'granted')
    new Notification('🛡️ Raksha AI — today\'s briefing', { body: msg.replace('☀️ Guardian briefing: ', '') });
  brainLog('☀️', 'Morning briefing delivered', 0);
}, 14000);

/* ================= boot ================= */
brainLog('🦺', 'Shield extensions online — Rescue Radio, Volunteer Shield, breadcrumbs ready', 0);
