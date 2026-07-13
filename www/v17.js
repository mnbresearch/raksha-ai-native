/* =========================================================
   Raksha AI v17 — more protection
   Nearby Safe Havens (police/hospital/pharmacy/petrol/ATM/transit),
   Deterrent Sound library (siren/horn/whistle/voice), Pre-recorded
   SOS message, proactive weather & heat alerts, expanded helplines.
   ========================================================= */
"use strict";

/* ================= NEARBY SAFE HAVENS ================= */
const HAVEN_TYPES = [
  { key: 'police',   emoji: '👮', label: 'Police', q: 'node["amenity"="police"]' },
  { key: 'hospital', emoji: '🏥', label: 'Hospital', q: 'node["amenity"="hospital"];way["amenity"="hospital"]' },
  { key: 'pharmacy', emoji: '💊', label: '24×7 Pharmacy', q: 'node["amenity"="pharmacy"]' },
  { key: 'fuel',     emoji: '⛽', label: 'Petrol Pump', q: 'node["amenity"="fuel"]' },
  { key: 'atm',      emoji: '🏧', label: 'ATM / Bank', q: 'node["amenity"="atm"];node["amenity"="bank"]' },
  { key: 'transit',  emoji: '🚉', label: 'Metro / Bus / Rail', q: 'node["railway"="station"];node["public_transport"="station"];node["highway"="bus_stop"]' },
];
let havenData = {}, havenFilter = 'all', havenLoaded = false;

function renderHavenFilters() {
  const f = $('havenFilters');
  if (!f || f.children.length) return;
  const mk = (key, emoji, label) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.style.cursor = 'pointer';
    b.dataset.k = key;
    b.textContent = emoji + ' ' + label;
    b.onclick = () => { havenFilter = key; document.querySelectorAll('#havenFilters .chip').forEach(c => c.style.borderColor = ''); b.style.borderColor = 'var(--green)'; renderHavens(); };
    f.appendChild(b);
  };
  mk('all', '📍', 'All');
  HAVEN_TYPES.forEach(t => mk(t.key, t.emoji, t.label));
  f.firstChild.style.borderColor = 'var(--green)';
}

async function loadHavens(force) {
  renderHavenFilters();
  if (!S.pos) { $('havenList').innerHTML = '<p class="hint">Waiting for GPS lock — allow location access.</p>'; return; }
  if (havenLoaded && !force) { renderHavens(); return; }
  $('havenList').innerHTML = '<p class="hint">🔎 Finding safe places within 3 km…</p>';
  const around = `(around:3000,${S.pos.lat},${S.pos.lon})`;
  const body = '[out:json][timeout:20];(' + HAVEN_TYPES.map(t => t.q.split(';').map(s => s + around + ';').join('')).join('') + ');out center 60;';
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(body) });
    const j = await r.json();
    havenData = {};
    j.elements.forEach(el => {
      const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
      if (lat == null) return;
      const t = el.tags || {};
      let key = null;
      if (t.amenity === 'police') key = 'police';
      else if (t.amenity === 'hospital') key = 'hospital';
      else if (t.amenity === 'pharmacy') key = 'pharmacy';
      else if (t.amenity === 'fuel') key = 'fuel';
      else if (t.amenity === 'atm' || t.amenity === 'bank') key = 'atm';
      else if (t.railway === 'station' || t.public_transport === 'station' || t.highway === 'bus_stop') key = 'transit';
      if (!key) return;
      (havenData[key] = havenData[key] || []).push({
        name: t.name || HAVEN_TYPES.find(x => x.key === key).label,
        lat, lon, dist: haversine(S.pos, { lat, lon }),
        open: t.opening_hours === '24/7' ? '24×7' : (t.opening_hours || '')
      });
    });
    Object.values(havenData).forEach(a => a.sort((x, y) => x.dist - y.dist));
    havenLoaded = true;
    if (typeof brainLog === 'function') brainLog('🏮', 'Safe Havens loaded', 0);
    renderHavens();
  } catch (e) {
    $('havenList').innerHTML = '<p class="hint">Could not reach the places service. Head toward any lit, busy area and call 112 if threatened.</p>';
  }
}

function renderHavens() {
  const l = $('havenList');
  if (!l) return;
  const types = havenFilter === 'all' ? HAVEN_TYPES.map(t => t.key) : [havenFilter];
  let html = '';
  types.forEach(key => {
    const t = HAVEN_TYPES.find(x => x.key === key);
    const list = (havenData[key] || []).slice(0, havenFilter === 'all' ? 2 : 8);
    list.forEach(h => {
      html += `<div class="helpline"><div class="hl-info"><b>${t.emoji} ${esc(h.name)}</b><div>${(h.dist / 1000).toFixed(1)} km${h.open ? ' · ' + esc(h.open) : ''}</div></div>` +
        `<a href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lon}&travelmode=walking" target="_blank">🧭</a></div>`;
    });
  });
  l.innerHTML = html || '<p class="hint">No places of this type found within 3 km. Try "All" or head toward a main road.</p>';
}
// auto-load when the page opens
const _v17Go = go;
go = function (p) { _v17Go(p); if (p === 'havens') setTimeout(() => loadHavens(false), 60); };

/* ================= DETERRENT SOUND LIBRARY ================= */
let deterNodes = null, deterType = null;
function stopDeter() {
  if (deterNodes) { deterNodes.forEach(n => { try { n.stop(); } catch (e) {} }); deterNodes = null; deterType = null; }
}
function deter(kind) {
  if (deterType === kind) { stopDeter(); return; }
  stopDeter();
  deterType = kind;
  const c = ctx();
  if (kind === 'siren') {
    const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = 700;
    lfo.frequency.value = 0.7; lg.gain.value = 500; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.value = 0.55; o.connect(g); g.connect(c.destination); o.start(); lfo.start();
    deterNodes = [o, lfo];
  } else if (kind === 'horn') {
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = 250; o2.type = 'square'; o2.frequency.value = 254;
    g.gain.value = 0.5; o.connect(g); o2.connect(g); g.connect(c.destination); o.start(); o2.start();
    deterNodes = [o, o2];
  } else if (kind === 'whistle') {
    const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sine'; o.frequency.value = 2600;
    lfo.frequency.value = 6; lg.gain.value = 300; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.value = 0.5; o.connect(g); g.connect(c.destination); o.start(); lfo.start();
    deterNodes = [o, lfo];
  }
  if (navigator.vibrate) navigator.vibrate([400, 100, 400]);
}
function deterVoice() {
  try {
    const lines = ['Hey! Who is that? I can see you!', 'Ravi, come here quickly! Bring the others!', 'I am calling the police right now!', 'Guard! Someone is here!'];
    const u = new SpeechSynthesisUtterance(lines[Math.floor(Math.random() * lines.length)]);
    u.lang = 'en-IN'; u.rate = 1; u.pitch = 0.7; u.volume = 1;
    const v = speechSynthesis.getVoices().find(v => /male|ravi|hemant/i.test(v.name)) || speechSynthesis.getVoices().find(v => v.lang.startsWith('en'));
    if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    if (navigator.vibrate) navigator.vibrate(200);
  } catch (e) {}
}
/* stop deterrents when leaving tools */
const _v17Go2 = go;
go = function (p) { if (p !== 'tools') stopDeter(); _v17Go2(p); };

/* ================= PRE-RECORDED SOS MESSAGE ================= */
let prerec = null;
function refreshPrerec() {
  const saved = store.get('prerecMsg', null);
  const s = $('prerecStatus');
  if (!s) return;
  if (saved) {
    s.innerHTML = '✅ Message saved (' + new Date(saved.ts).toLocaleDateString() + '). It will be shared during an emergency.<audio controls src="' + saved.url + '" style="margin-top:6px"></audio>';
  } else s.textContent = 'No message recorded yet.';
}
async function prerecToggle() {
  if (prerec) { prerec.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    prerec = new MediaRecorder(stream);
    prerec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    prerec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: 'audio/webm' });
      // store as data URL so it survives reloads
      const dataUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      store.set('prerecMsg', { url: dataUrl, ts: Date.now() });
      prerec = null;
      $('prerecBtn').innerHTML = '🎙️ Record message';
      refreshPrerec();
    };
    prerec.start();
    $('prerecBtn').innerHTML = '⏹ Stop & save';
  } catch (e) { alert('Microphone access needed to record your message.'); }
}
function prerecShare() {
  const saved = store.get('prerecMsg', null);
  if (!saved) return alert('Record a message first.');
  fetch(saved.url).then(r => r.blob()).then(blob => {
    const file = new File([blob], 'raksha-emergency-message.webm', { type: 'audio/webm' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: 'Emergency message' }).catch(() => {});
    else { const a = document.createElement('a'); a.href = saved.url; a.download = 'raksha-emergency-message.webm'; a.click(); }
  });
}
/* attach the pre-recorded message to the emergency evidence + broadcast note */
const _v17StartEmergency = startEmergency;
startEmergency = function (reason) {
  _v17StartEmergency(reason);
  const saved = store.get('prerecMsg', null);
  if (saved) {
    const list = $('recList');
    const div = document.createElement('div');
    div.className = 'rec-item';
    div.innerHTML = '<b>📹 Your pre-recorded message</b><audio controls src="' + saved.url + '"></audio><button class="btn small secondary" style="margin-top:6px" onclick="prerecShare()">📤 Share to family</button>';
    if (list) { if (list.querySelector('.hint')) list.innerHTML = ''; list.prepend(div); }
  }
};

/* ================= PROACTIVE WEATHER & HEAT ALERTS ================= */
async function wxCheck() {
  if (!S.pos) return;
  try {
    const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${S.pos.lat}&longitude=${S.pos.lon}&current_weather=true&hourly=temperature_2m,precipitation_probability&forecast_days=1`)).json();
    const w = j.current_weather; if (!w) return;
    const code = w.weathercode, temp = w.temperature;
    let msg = '', advice = '';
    if (temp >= 42) { msg = '🥵 Extreme heat (' + Math.round(temp) + '°C)'; advice = 'Avoid the sun 12–4pm, carry water, watch for dizziness. Heat stroke helpline steps are in First-Aid.'; }
    else if (temp >= 38) { msg = '☀️ High heat (' + Math.round(temp) + '°C)'; advice = 'Stay hydrated and take shade breaks.'; }
    else if (code >= 95) { msg = '⛈️ Thunderstorm nearby'; advice = 'Avoid open ground and trees; delay travel if you can. Roads may be risky.'; }
    else if (code >= 80 || (code >= 61 && code <= 67)) { msg = '🌧️ Heavy rain likely'; advice = 'Lower visibility and slippery roads — start Trip Mode and share live location if travelling.'; }
    else if (code === 45 || code === 48) { msg = '🌫️ Fog / low visibility'; advice = 'Travel carefully; keep Family Live on.'; }
    const el = $('wxAlert');
    if (el) {
      if (msg) { el.classList.add('show'); el.innerHTML = '<b>' + msg + '</b> — ' + advice; }
      else el.classList.remove('show');
    }
  } catch (e) {}
}
setTimeout(() => { const w = setInterval(() => { if (S.pos) { clearInterval(w); wxCheck(); } }, 3000); }, 5000);
setInterval(wxCheck, 30 * 60000);

/* ================= EXPANDED HELPLINES ================= */
if (typeof HELPLINES !== 'undefined') {
  HELPLINES.push(
    { n: '1066', d: 'Poison Control / poisoning emergencies' },
    { n: '1078', d: 'National Disaster Management (NDMA)' },
    { n: '1070', d: 'State disaster / relief control room' },
    { n: '1363', d: 'Tourist helpline (24×7, multilingual)' },
    { n: '1906', d: 'LPG gas leak emergency' },
    { n: '1800111139', d: 'Railway security / RPF (also 139)', show: '139' },
    { n: '1800116888', d: 'Anti-human-trafficking / child (also 1098)', show: '1098' },
  );
  if (typeof renderHelplines === 'function') renderHelplines();
}
/* add a blood-bank finder link to the helplines page */
setTimeout(() => {
  const l = $('helplineList');
  if (l && !$('bloodBankLink')) {
    const d = document.createElement('div');
    d.className = 'helpline'; d.id = 'bloodBankLink';
    d.innerHTML = '<div class="hl-info"><b>🩸 Blood banks (eRaktKosh)</b><div>Find blood availability near you — Govt. of India</div></div><a href="https://www.eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/nearbyBB.cnt" target="_blank">🌐</a>';
    l.appendChild(d);
  }
}, 1500);

/* ================= i18n (Hindi for the headline strings) ================= */
if (typeof I18N !== 'undefined' && I18N.hi) Object.assign(I18N.hi, {
  m_havens: 'निकटतम सुरक्षित स्थान', m_havensp: 'निकटतम पुलिस, अस्पताल, 24×7 फार्मेसी, पेट्रोल पंप, ATM और स्टेशन — रोशन, खुली जगहें, एक टैप में दिशा।',
  havenshint: 'असुरक्षित महसूस होने पर जाने योग्य रोशन, भीड़भाड़ वाली, आमतौर पर खुली जगहें। दिशा के लिए किसी भी कार्ड पर टैप करें।',
  refreshhavens: '🔄 मेरे स्थान से रीफ्रेश करें', deter: '📢 डराने वाली आवाज़ें', d_siren: 'पुलिस सायरन', d_horn: 'एयर हॉर्न', d_whistle: 'सीटी', d_voice: 'नकली "कोई आ रहा है" आवाज़',
  prerec: '📹 पूर्व-रिकॉर्डेड SOS संदेश', recmsg: '🎙️ संदेश रिकॉर्ड करें', sharemsg: '📤 अभी भेजें',
});
if (typeof applyLang === 'function') applyLang();

/* ================= boot ================= */
refreshPrerec();
if (typeof brainLog === 'function') brainLog('🏮', 'v17 online — Safe Havens, deterrent sounds, pre-recorded message, weather alerts, +7 helplines', 0);
