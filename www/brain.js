/* =========================================================
   Raksha AI v4 — Guardian Brain
   Sensor-fusion threat engine with explainable reasoning log,
   on-device behavioral baseline learning, serverless Family
   Live tracking + SOS broadcast (ntfy.sh), Guardian Assistant,
   daily routines, stealth launch.
   ========================================================= */
"use strict";

/* ================= EXPLAINABLE REASONING LOG ================= */
const brainEvents = [];   // {ts, w, msg, icon}
function brainLog(icon, msg, weight) {
  brainEvents.unshift({ ts: Date.now(), w: weight || 0, msg, icon });
  if (brainEvents.length > 60) brainEvents.pop();
  renderBrainLog();
  updateThreat();
}
function renderBrainLog() {
  const l = $('brainLog');
  if (!l) return;
  if (!brainEvents.length) return;
  l.innerHTML = brainEvents.slice(0, 25).map(e =>
    `<div class="list-item"><div><b>${e.icon} ${esc(e.msg)}</b><div class="sub2">${new Date(e.ts).toLocaleTimeString()}${e.w ? ' · threat +' + e.w : ''}</div></div></div>`
  ).join('');
}

/* ================= UNIFIED THREAT METER ================= */
function threatLevel() {
  const now = Date.now();
  let t = 0;
  brainEvents.forEach(e => {
    const age = (now - e.ts) / 60000;              // minutes
    if (age < 10 && e.w) t += e.w * (1 - age / 10); // linear decay over 10 min
  });
  const { score } = computeScore();
  t += Math.max(0, (75 - score)) * 0.5;            // ambient risk feeds in
  return Math.min(100, Math.round(t));
}
function updateThreat() {
  const bar = $('threatBar'), lab = $('threatLabel');
  if (!bar) return;
  const t = threatLevel();
  const v = t >= 60 ? ['🔴 Danger suspected', 'var(--red)'] :
            t >= 30 ? ['🟠 Elevated — watching closely', 'var(--amber)'] :
            t >= 12 ? ['🟡 Mild signals', 'var(--amber)'] :
                      ['🟢 Calm', 'var(--green)'];
  lab.textContent = v[0];
  bar.style.width = Math.max(4, t) + '%';
  bar.style.background = v[1];
}
setInterval(updateThreat, 10000);

/* --- hook existing systems so every signal is logged --- */
const _bOpenCheckin = openCheckin;
openCheckin = function(title, reason, secs) { brainLog('❓', 'Check-in: ' + title + ' — ' + reason, 25); _bOpenCheckin(title, reason, secs); };
const _bStartEmergency = startEmergency;
startEmergency = function(reason) { brainLog('🚨', 'EMERGENCY: ' + reason, 60); famBroadcast('SOS', reason); _bStartEmergency(reason); };
const _bEndTrip = endTrip;
endTrip = function(msg) { brainLog('🚕', 'Trip ended: ' + msg, 0); _bEndTrip(msg); };
const _bFetchWeather = fetchWeather;
fetchWeather = async function() { await _bFetchWeather(); if (weatherReason) brainLog('🌧️', 'Weather factor: ' + weatherReason, 4); };

/* live gauges */
let lastG = 0;
window.addEventListener('devicemotion', ev => {
  const a = ev.accelerationIncludingGravity;
  if (a) lastG = Math.hypot(a.x||0, a.y||0, a.z||0);
}, { passive: true });
setInterval(() => {
  if (!$('page-brain').classList.contains('active')) return;
  $('gSpeed').textContent = S.pos ? (S.pos.speed * 3.6).toFixed(0) + ' km/h' : '—';
  $('gMotion').textContent = lastG ? lastG.toFixed(1) + ' m/s²' : '—';
  $('gSound').textContent = (typeof screamStream !== 'undefined' && screamStream) ? (loudSince ? '🔊 LOUD' : 'monitoring') : 'off';
}, 1000);

/* ================= BEHAVIORAL BASELINE (on-device learning) ================= */
const baseline = store.get('baseline', { cells: {}, hours: new Array(24).fill(0), samples: 0, started: Date.now() });
function cellOf(p) { return p.lat.toFixed(2) + ',' + p.lon.toFixed(2); }   // ~1.1 km cells
let unfamiliarFlag = false, unusualHourFlag = false;

function learnTick() {
  if (!S.pos) return;
  const c = cellOf(S.pos), h = new Date().getHours();
  baseline.cells[c] = (baseline.cells[c] || 0) + 1;
  baseline.hours[h]++;
  baseline.samples++;
  store.set('baseline', baseline);

  if (baseline.samples > 50) {
    const known = (baseline.cells[c] || 0) > 2;
    if (!known && !unfamiliarFlag) { unfamiliarFlag = true; brainLog('🗺️', 'You are in an area you rarely visit — staying more alert', 8); }
    if (known) unfamiliarFlag = false;
    const avg = baseline.hours.reduce((a,b)=>a+b,0) / 24;
    const rare = baseline.hours[h] < avg * 0.25;
    if (rare && !unusualHourFlag) { unusualHourFlag = true; brainLog('🌙', 'You are active at an hour that is unusual for you', 6); }
    if (!rare) unusualHourFlag = false;
  }
  renderBaseline();
}
setInterval(learnTick, 5 * 60000);
setTimeout(learnTick, 8000);

function renderBaseline() {
  const el = $('baselineInfo');
  if (!el) return;
  const days = Math.max(1, Math.ceil((Date.now() - baseline.started) / 86400000));
  const places = Object.keys(baseline.cells).length;
  el.textContent = `Learning for ${days} day(s) · ${places} familiar area(s) mapped · ${baseline.samples} observations. ` +
    (baseline.samples > 50
      ? 'Baseline active: unfamiliar places and unusual hours now raise your alert level.'
      : `Needs ${51 - baseline.samples} more observations before deviations affect your score. Everything stays on this phone.`);
}

/* baseline feeds the safety score */
const _bCompute = computeScore;
computeScore = function() {
  const r = _bCompute();
  if (unfamiliarFlag) { r.score = Math.max(5, r.score - 6); r.reasons.push('unfamiliar area for you'); }
  if (unusualHourFlag) { r.score = Math.max(5, r.score - 4); r.reasons.push('unusual hour for you'); }
  return r;
};

/* ================= FAMILY LIVE (serverless via ntfy.sh) ================= */
let famES = null, famPubIv = null, famMapObj = null;
const famMarkers = {};
$('famCode').value = store.get('famcode', '');
$('famName').value = store.get('famname', '');

$('famToggle').addEventListener('change', e => e.target.checked ? famStart() : famStop());

function famTopic() {
  const code = $('famCode').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  return code ? 'raksha-fam-' + code : null;
}
function famStart() {
  const topic = famTopic(), name = $('famName').value.trim();
  if (!topic || topic.length < 16) { alert('Enter a LONG private family code (min 6 characters, e.g. sharma-tigers-9481) and your name.'); $('famToggle').checked = false; return; }
  if (!name) { alert('Enter your name.'); $('famToggle').checked = false; return; }
  store.set('famcode', $('famCode').value.trim());
  store.set('famname', name);
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();

  // subscribe
  famES = new EventSource('https://ntfy.sh/' + topic + '/sse');
  famES.onmessage = ev => {
    try {
      const n = JSON.parse(ev.data);
      if (!n.message) return;
      const m = JSON.parse(n.message);
      if (!m || !m.n) return;
      famUpdateMember(m);
      if (m.s === 'SOS' && m.n !== name) {
        beep(6);
        if (navigator.vibrate) navigator.vibrate([600,200,600,200,600]);
        if ('Notification' in window && Notification.permission === 'granted')
          new Notification('🚨 ' + m.n + ' NEEDS HELP', { body: (m.r || 'SOS') + (m.la ? ' — tap Circle for live map' : '') });
        brainLog('🚨', 'FAMILY SOS from ' + m.n + ': ' + (m.r || ''), 40);
        alert('🚨 FAMILY SOS — ' + m.n + ' needs help!' + (m.la ? '\nLocation: https://maps.google.com/?q=' + m.la + ',' + m.lo : ''));
      }
    } catch(e) {}
  };
  // publish loop
  famPubIv = setInterval(famPublish, 15000);
  famPublish();
  $('famBanner').classList.add('show');
  $('famBanner').textContent = '🛰️ Live with family on channel "' + $('famCode').value.trim() + '". Positions update every 15 s while this app is open.';
  $('famMap').style.display = 'block';
  setTimeout(initFamMap, 80);
  brainLog('🛰️', 'Family Live started', 0);
}
function famStop() {
  if (famES) { famES.close(); famES = null; }
  clearInterval(famPubIv);
  $('famBanner').classList.remove('show');
  brainLog('🛰️', 'Family Live stopped', 0);
}
function famPublish(status, reason) {
  const topic = famTopic();
  if (!topic) return;
  const m = { n: $('famName').value.trim() || 'Me', s: status || 'ok', ts: Date.now() };
  if (S.pos) { m.la = +S.pos.lat.toFixed(5); m.lo = +S.pos.lon.toFixed(5); }
  if (reason) m.r = reason;
  fetch('https://ntfy.sh/' + topic, { method: 'POST', body: JSON.stringify(m), headers: { 'Priority': status === 'SOS' ? 'urgent' : 'min' } }).catch(()=>{});
}
function famBroadcast(status, reason) { if ($('famToggle') && $('famToggle').checked) famPublish(status, reason); }

function initFamMap() {
  if (famMapObj) { famMapObj.invalidateSize(); return; }
  const c = S.pos ? [S.pos.lat, S.pos.lon] : [22.97, 78.65]; // India centroid
  famMapObj = L.map('famMap').setView(c, S.pos ? 13 : 4);
  L.tileLayer(tileURL, { attribution: tileAttr }).addTo(famMapObj);
}
function famUpdateMember(m) {
  if (!m.la || !famMapObj) { renderFamList(m); return; }
  const key = m.n;
  const color = m.s === 'SOS' ? '#ff5470' : '#b18cff';
  if (famMarkers[key]) { famMarkers[key].setLatLng([m.la, m.lo]); famMarkers[key].setStyle({ color, fillColor: color }); }
  else famMarkers[key] = L.circleMarker([m.la, m.lo], { radius: 9, color, fillColor: color, fillOpacity: .9 })
    .addTo(famMapObj).bindPopup(esc(m.n));
  famMarkers[key]._last = m;
  renderFamList(m);
}
const famSeen = {};
function renderFamList(m) {
  if (m) famSeen[m.n] = m;
  const l = $('famList');
  if (!l) return;
  l.innerHTML = '';
  Object.values(famSeen).forEach(x => {
    const d = document.createElement('div');
    d.className = 'list-item';
    const age = Math.round((Date.now() - x.ts) / 1000);
    d.innerHTML = `<div><b>${x.s === 'SOS' ? '🚨' : '🟣'} ${esc(x.n)}</b><div class="sub2">${x.s === 'SOS' ? 'NEEDS HELP · ' : ''}${age < 60 ? age + 's ago' : Math.round(age/60) + 'm ago'}${x.la ? ' · ' + x.la.toFixed(3) + ',' + x.lo.toFixed(3) : ''}</div></div>` +
      (x.la ? `<a href="https://maps.google.com/?q=${x.la},${x.lo}" target="_blank" style="color:var(--blue);text-decoration:none;font-size:13px">map ↗</a>` : '');
    l.appendChild(d);
  });
}
function shareFamCode() {
  const code = $('famCode').value.trim();
  if (!code) return alert('Set a family code first.');
  const txt = `🛡️ Join my Raksha AI family circle!\n1. Open ${location.origin + location.pathname}\n2. Go to More → Trusted Circle → Family Live\n3. Enter family code: ${code}\n4. Turn on "Go live with my family"\nWe'll see each other on the map and get instant SOS alerts.`;
  if (navigator.share) navigator.share({ text: txt }).catch(()=>{});
  else prompt('Copy and send:', txt);
}

/* ================= GUARDIAN ASSISTANT ================= */
const INTENTS = [
  { k: /follow|following|stalk|peecha|chasing/i,
    a: 'Stay in lit, busy areas. Do NOT go home directly — head to a shop, petrol pump, or police station. I can start Walk With Me (deadman escort) and share your live location with family right now. If it escalates, hold SOS or just say your secret phrase.',
    b: [['🚶‍♀️ Start Walk With Me', "go('walk')"], ['📍 Share live location', 'shareLive()'], ['📞 Call 112', "location.href='tel:112'"]] },
  { k: /scam|fraud|otp|kyc|upi|paytm|refund|lottery|parcel|digital arrest|cyber|hack|blackmail|sextortion/i,
    a: 'Do not click links, do not share OTP/PIN, and do not pay — even "small verification fees". If money already left your account, call 1930 within 24 hours to freeze the transfer chain. Paste the message in Scam Shield and I\'ll analyze it.',
    b: [['🕵️ Open Scam Shield', "go('scam')"], ['📞 Call 1930', "location.href='tel:1930'"], ['🌐 cybercrime.gov.in', "window.open('https://cybercrime.gov.in')"]] },
  { k: /husband|wife|partner|boyfriend|in-?laws|beat|slap|hit me|abuse|dowry|control|violence at home|ghar/i,
    a: 'What\'s happening to you is not your fault, and it\'s legally actionable under the DV Act 2005 — you don\'t even need a lawyer to get a protection order (NALSA 15100 is free). Start documenting everything in your encrypted Safe Space vault: dates, photos, medical records. When you\'re ready: 181 is the 24×7 women helpline.',
    b: [['🔐 Open Safe Space', 'openVaultGate()'], ['📞 Call 181', "location.href='tel:181'"], ['⚖️ Free legal aid 15100', "location.href='tel:15100'"]] },
  { k: /suicide|kill myself|end my life|hopeless|no reason to live|die|self.?harm/i,
    a: 'I\'m really glad you told me. You deserve support, and talking to a trained person helps more than you\'d expect. Tele-MANAS (14416) is free, confidential, 24×7, in your language. Would you talk to them now? I can also start a 60-second breathing exercise with you.',
    b: [['📞 Call 14416 now', "location.href='tel:14416'"], ['💙 Breathing exercise', "go('mind');startBreath()"]] },
  { k: /accident|crash|bike|hit by|injured|bleeding/i,
    a: 'Call 108 (ambulance) or 112 immediately. Don\'t move a person with possible spine injury unless there\'s fire/traffic danger. The Good Samaritan law protects you when helping. Your ICE card shows responders your blood group and allergies.',
    b: [['📞 Call 108', "location.href='tel:108'"], ['🆘 My ICE card', "go('ice')"], ['🚨 Start SOS', "startEmergency('Assistant: accident reported')"]] },
  { k: /child|kid|son|daughter|missing|lost|school bus/i,
    a: 'For a missing child: call 1098 (CHILDLINE) AND 112 immediately — do not wait 24 hours, that\'s a myth. Note what they were wearing. For school-trip safety, set the school as a Trip Mode destination.',
    b: [['📞 Call 1098', "location.href='tel:1098'"], ['📞 Call 112', "location.href='tel:112'"], ['🚕 Trip Mode', "go('trip')"]] },
  { k: /theft|robbed|snatch|chain|phone stolen|pickpocket|loot/i,
    a: 'Your safety first — never chase. Call 112, then file an FIR (they cannot refuse — a "Zero FIR" can be filed at ANY police station). Block your SIM and cards immediately; for phone theft also block the IMEI at ceir.gov.in.',
    b: [['📞 Call 112', "location.href='tel:112'"], ['🌐 Block IMEI (CEIR)', "window.open('https://www.ceir.gov.in')"]] },
  { k: /fire|aag|burning/i,
    a: 'Get out, stay low under smoke, don\'t use lifts. Call 101 or 112 once you\'re moving to safety.',
    b: [['📞 Call 101', "location.href='tel:101'"]] },
  { k: /cab|taxi|uber|ola|auto|driver|rapido/i,
    a: 'Before boarding: match plate, driver photo, and OTP. During the ride: start Guardian Trip Mode — I\'ll watch the route and check on you if it deviates. Sit behind the driver. Share the trip with family too.',
    b: [['🚕 Start Trip Mode', "go('trip')"], ['🛰️ Family Live', "go('circle')"]] },
  { k: /unsafe|dark|scared|night|alone|akela|dar/i,
    a: 'I\'m with you. Options right now: Walk With Me (I escort you), Family Live (they see you moving), Fake Call (excuse to leave), or the loud alarm. Which do you want?',
    b: [['🚶‍♀️ Walk With Me', "go('walk')"], ['📞 Fake Call', 'showFakeCall()'], ['🔊 Alarm', 'toggleAlarm()']] },
  { k: /elder|grand|old|senior|budhe/i,
    a: 'Elder Care mode gives periodic check-ins, sensitive fall detection, and medicine reminders. Elder Line 14567 handles abuse, pension, and care issues for senior citizens.',
    b: [['🧓 Elder Care', "go('elder')"], ['📞 Call 14567', "location.href='tel:14567'"]] },
];
function chatAdd(who, html, buttons) {
  const box = $('chatBox');
  const d = document.createElement('div');
  d.style.cssText = 'margin:8px 0;display:flex;' + (who === 'me' ? 'justify-content:flex-end' : '');
  const b = document.createElement('div');
  b.style.cssText = 'max-width:85%;padding:10px 12px;border-radius:14px;font-size:13.5px;line-height:1.5;' +
    (who === 'me' ? 'background:var(--green);color:#08101f' : 'background:var(--card2);border:1px solid #2b3b63');
  b.innerHTML = html;
  if (buttons) buttons.forEach(([label, code]) => {
    const btn = document.createElement('button');
    btn.className = 'btn small secondary';
    btn.style.cssText = 'display:block;width:100%;margin:6px 0 0';
    btn.textContent = label;
    btn.onclick = () => { try { Function(code)(); } catch(e){} };
    b.appendChild(btn);
  });
  d.appendChild(b);
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}
function chatSend(preset) {
  const inp = $('chatInput');
  const txt = (preset || inp.value).trim();
  if (!txt) return;
  inp.value = '';
  chatAdd('me', esc(txt));
  const hit = INTENTS.find(i => i.k.test(txt));
  setTimeout(() => {
    if (hit) chatAdd('ai', esc(hit.a), hit.b);
    else chatAdd('ai', 'I can help with: being followed · cab safety · scams & fraud · domestic violence · accidents · missing children · theft · feeling unsafe at night · elder care · mental health. Describe your situation in a few words, in English or Hinglish.', [['🚨 This is an emergency', "startEmergency('Assistant: user declared emergency')"]]);
  }, 350);
}
$('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') chatSend(); });
(function chatWelcome() {
  chatAdd('ai', '🛡️ I\'m your Guardian. Tell me what\'s happening — "someone is following me", "I got a KYC message", "is this cab safe" — and I\'ll give you exact steps plus one-tap actions. Everything stays on your phone.');
  const q = $('chatQuick');
  ['Someone is following me', 'I got a suspicious message', 'I\'m walking alone at night', 'Domestic violence help'].forEach(t => {
    const b = document.createElement('button');
    b.className = 'btn small secondary';
    b.textContent = t;
    b.onclick = () => chatSend(t);
    q.appendChild(b);
  });
})();

/* ================= GUARDIAN ROUTINES ================= */
const routines = store.get('routines', []);
function addRoutine() {
  const label = $('routLabel').value.trim(), t = $('routTime').value;
  if (!label || !t) return alert('Enter a name and time.');
  routines.push({ label, t });
  store.set('routines', routines);
  $('routLabel').value = '';
  renderRoutines();
}
function renderRoutines() {
  const l = $('routList');
  l.innerHTML = '';
  routines.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'list-item';
    d.innerHTML = `<div><b>⏰ ${esc(r.label)}</b><div class="sub2">daily at ${esc(r.t)}</div></div>`;
    const x = document.createElement('button');
    x.className = 'xbtn'; x.textContent = '🗑';
    x.onclick = () => { routines.splice(i,1); store.set('routines', routines); renderRoutines(); };
    d.appendChild(x);
    l.appendChild(d);
  });
}
setInterval(() => {
  const now = new Date();
  const hm = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  routines.forEach(r => {
    if (r.t === hm && r.last !== now.toDateString()) {
      r.last = now.toDateString();
      store.set('routines', routines);
      openCheckin('⏰ ' + r.label, 'Daily routine check-in. All good?', 60);
    }
  });
}, 30000);

/* ================= STEALTH LAUNCH ================= */
$('stealthToggle').checked = !!store.get('stealth', false);
$('stealthToggle').addEventListener('change', e => {
  if (e.target.checked && !store.get('vault_pin', null)) {
    alert('Set a Safe Space PIN first (Settings → Set / change PIN) — it\'s how you unlock the calculator.');
    e.target.checked = false;
    return;
  }
  store.set('stealth', e.target.checked);
});
if (store.get('stealth', false) && store.get('vault_pin', null)) showDisguise();

/* ================= boot ================= */
renderRoutines();
renderBaseline();
brainLog('🧠', 'Guardian Brain online — all senses connected', 0);
