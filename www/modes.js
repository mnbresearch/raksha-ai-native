/* =========================================================
   Raksha AI v2 — protection modes
   Safe Space vault (AES-256-GCM), Scam Shield, Elder, Child,
   Mind, Community Shield, Helplines, Dashboard, Settings.
   ========================================================= */
"use strict";

/* ================= SAFE SPACE VAULT (encrypted) ================= */
/* Key derivation: PBKDF2(PIN, salt, 150k iters) -> AES-256-GCM.   */
window.vaultKey = null;
let vaultDB = null;

function openDB() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open('raksha_vault', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('items', { keyPath: 'id' });
    rq.onsuccess = () => { vaultDB = rq.result; res(vaultDB); };
    rq.onerror = () => rej(rq.error);
  });
}
function dbPut(item){ return new Promise((res,rej)=>{ const t=vaultDB.transaction('items','readwrite'); t.objectStore('items').put(item); t.oncomplete=res; t.onerror=()=>rej(t.error); }); }
function dbAll(){ return new Promise((res,rej)=>{ const rq=vaultDB.transaction('items').objectStore('items').getAll(); rq.onsuccess=()=>res(rq.result); rq.onerror=()=>rej(rq.error); }); }
function dbDel(id){ return new Promise((res,rej)=>{ const t=vaultDB.transaction('items','readwrite'); t.objectStore('items').delete(id); t.oncomplete=res; t.onerror=()=>rej(t.error); }); }

async function deriveKey(pin, saltB64) {
  const enc = new TextEncoder();
  let salt;
  if (saltB64) salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  else { salt = crypto.getRandomValues(new Uint8Array(16)); store.set('vault_salt', btoa(String.fromCharCode(...salt))); }
  const km = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:150000, hash:'SHA-256' }, km,
    { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
async function pinHash(pin) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('raksha:' + pin));
  return btoa(String.fromCharCode(...new Uint8Array(d)));
}
async function encBlob(blob) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await blob.arrayBuffer();
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, window.vaultKey, data);
  return { iv: Array.from(iv), ct };
}
async function decBlob(rec, type) {
  const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv: new Uint8Array(rec.iv) }, window.vaultKey, rec.ct);
  return new Blob([pt], { type });
}

/* --- PIN gate --- */
let pinMode = 'unlock'; // or 'setup'
function openVaultGate() {
  const saved = store.get('vault_pin', null);
  if (window.vaultKey) { go('vault'); renderVault(); return; }
  pinMode = saved ? 'unlock' : 'setup';
  $('pinTitle').textContent = saved ? 'Enter Safe Space PIN' : 'Create a Safe Space PIN';
  $('pinHint').textContent = saved ? 'Your vault is encrypted with this PIN.' : 'Choose 4–8 digits. This PIN encrypts everything in your vault. If you forget it, vault items cannot be recovered.';
  $('pinOk').textContent = saved ? 'Unlock' : 'Create';
  $('pinInput').value = '';
  $('pinModal').classList.add('show');
  setTimeout(() => $('pinInput').focus(), 100);
}
function setupPin(fromSettings) {
  pinMode = 'setup';
  $('pinTitle').textContent = 'Set new Safe Space PIN';
  $('pinHint').textContent = 'Choose 4–8 digits.';
  $('pinOk').textContent = 'Save';
  $('pinInput').value = '';
  $('pinModal').classList.add('show');
}
function closePin(){ $('pinModal').classList.remove('show'); }
$('pinOk').addEventListener('click', async () => {
  const pin = $('pinInput').value.trim();
  if (pin.length < 4) return alert('PIN must be at least 4 digits.');
  const saved = store.get('vault_pin', null);
  if (pinMode === 'unlock') {
    const h = await pinHash(pin);
    const duress = store.get('duress_pin', null);
    if (duress && h === duress) {          // decoy: opens an empty-looking vault
      window.decoyMode = true;
      const raw = crypto.getRandomValues(new Uint8Array(32));
      window.vaultKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
      closePin(); go('vault'); renderVault();
      return;
    }
    if (h !== saved) { $('pinHint').textContent = '❌ Wrong PIN. Try again.'; return; }
    window.decoyMode = false;
    window.vaultKey = await deriveKey(pin, store.get('vault_salt', null));
  } else {
    store.set('vault_pin', await pinHash(pin));
    localStorage.removeItem('raksha_vault_salt');
    window.vaultKey = await deriveKey(pin, null);
  }
  closePin();
  go('vault'); renderVault();
});

/* --- vault items --- */
async function vaultAdd(type, note, blob) {
  await openDB();
  const item = { id: Date.now() + '-' + Math.random().toString(36).slice(2,7), type, note, ts: Date.now() };
  if (blob) { const e = await encBlob(blob); item.iv = e.iv; item.ct = e.ct; item.mime = blob.type; }
  else if (note) {
    const e = await encBlob(new Blob([note], {type:'text/plain'}));
    item.iv = e.iv; item.ct = e.ct; item.mime = 'text/plain'; item.note = '';
  }
  await dbPut(item);
  renderVault();
}
function vaultAddBlob(blob, label, type) { vaultAdd(type, label, blob).catch(()=>{}); }

function vaultAddNote() {
  $('noteModal').classList.add('show');
  $('noteText').value = '';
}
$('noteSave').addEventListener('click', () => {
  const t = $('noteText').value.trim();
  if (!t) return;
  $('noteModal').classList.remove('show');
  vaultAdd('note', t, null);
});
$('vaultPhoto').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) (window.processPhoto ? window.processPhoto(f) : vaultAdd('photo', 'Photo evidence', f));
  e.target.value = '';
});

let vaultRec = null;
async function vaultRecord() {
  if (vaultRec) { vaultRec.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    vaultRec = new MediaRecorder(stream);
    vaultRec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    vaultRec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      vaultAdd('audio', 'Voice note', new Blob(chunks, {type:'audio/webm'}));
      vaultRec = null;
      $('vaultRecBtn').innerHTML = '🎙️ Voice';
    };
    vaultRec.start();
    $('vaultRecBtn').innerHTML = '⏹ Stop';
  } catch(e) { alert('Microphone access needed.'); }
}

async function renderVault() {
  await openDB();
  const list = $('vaultList');
  if (window.decoyMode) { list.innerHTML = '<p class="hint">Vault is empty.</p>'; return; }
  const items = (await dbAll()).sort((a,b) => b.ts - a.ts);
  if (!items.length) { list.innerHTML = '<p class="hint">Vault is empty.</p>'; return; }
  list.innerHTML = '';
  for (const it of items) {
    const d = document.createElement('div');
    d.className = 'rec-item';
    const icon = it.type === 'photo' ? '📷' : it.type === 'audio' ? '🎙️' : '📝';
    d.innerHTML = `<b>${icon} ${esc(it.note || it.type)}</b> — ${new Date(it.ts).toLocaleString()} <span class="badge g">encrypted</span>`;
    const open = document.createElement('button');
    open.className = 'btn small secondary'; open.style.marginTop = '8px';
    open.textContent = it.type === 'note' ? 'Read' : 'Open';
    open.onclick = async () => {
      try {
        const blob = await decBlob(it, it.mime);
        if (it.type === 'note') alert(await blob.text());
        else {
          const url = URL.createObjectURL(blob);
          if (it.type === 'audio') { const a = document.createElement('audio'); a.controls = true; a.src = url; d.appendChild(a); open.remove(); }
          else window.open(url, '_blank');
        }
      } catch(e) { alert('Decryption failed — wrong PIN session?'); }
    };
    const del = document.createElement('button');
    del.className = 'btn small danger'; del.style.marginTop = '8px'; del.textContent = 'Delete';
    del.onclick = async () => { if (confirm('Delete permanently?')) { await dbDel(it.id); renderVault(); } };
    d.appendChild(open); d.appendChild(del);
    list.appendChild(d);
  }
}

async function vaultExport() {
  await openDB();
  const items = (await dbAll()).sort((a,b) => a.ts - b.ts);
  if (!items.length) return alert('Vault is empty.');
  let txt = 'RAKSHA AI — INCIDENT TIMELINE\nGenerated: ' + new Date().toLocaleString() + '\nItems: ' + items.length + '\n\n';
  for (const it of items) {
    txt += `[${new Date(it.ts).toLocaleString()}] ${it.type.toUpperCase()}`;
    if (it.type === 'note' && window.vaultKey) {
      try { txt += ': ' + await (await decBlob(it, 'text/plain')).text(); } catch(e){ txt += ' (locked)'; }
    } else txt += ': ' + (it.note || '');
    txt += '\n';
  }
  txt += '\nMedia evidence (photos/audio) is stored encrypted on the device — open each item in the app to export individually.\n';
  const url = URL.createObjectURL(new Blob([txt], {type:'text/plain'}));
  const a = document.createElement('a');
  a.href = url; a.download = 'raksha-timeline-' + Date.now() + '.txt'; a.click();
}

/* --- disguise calculator --- */
const CALC_KEYS = ['C','⌫','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','=',''];
let calcVal = '0';
function showDisguise() {
  if (!$('calcGrid').children.length) {
    CALC_KEYS.forEach(k => {
      if (k === '') return;
      const b = document.createElement('button');
      b.textContent = k;
      if ('÷×−+='.includes(k)) b.className = 'op';
      if ('C⌫%'.includes(k)) b.className = 'fn';
      b.onclick = () => calcPress(k);
      $('calcGrid').appendChild(b);
    });
  }
  calcVal = '0'; $('calcDisplay').textContent = '0';
  $('disguise').classList.add('show');
}
function calcPress(k) {
  const pin = store.get('vault_pin', null);
  if (k === '=') {
    // secret unlock: type your PIN then "=" — checked via hash
    const digits = calcVal.replace(/[^0-9]/g, '');
    if (digits.length >= 4) {
      pinHash(digits).then(h => {
        if (h === pin) { $('disguise').classList.remove('show'); return; }
        calcEval();
      });
      return;
    }
    calcEval(); return;
  }
  if (k === 'C') calcVal = '0';
  else if (k === '⌫') calcVal = calcVal.slice(0,-1) || '0';
  else calcVal = (calcVal === '0' && '0123456789'.includes(k)) ? k : calcVal + k;
  $('calcDisplay').textContent = calcVal;
}
function calcEval() {
  try {
    const expr = calcVal.replace(/÷/g,'/').replace(/×/g,'*').replace(/−/g,'-').replace(/%/g,'/100');
    if (/^[0-9+\-*/. ()]+$/.test(expr)) calcVal = String(Function('"use strict";return (' + expr + ')')());
  } catch(e) { calcVal = 'Error'; }
  $('calcDisplay').textContent = calcVal;
}

/* ================= SCAM SHIELD ================= */
const SCAM_PATTERNS = [
  { re: /\botp\b|one.?time.?password/i, w: 30, tag: 'Asks about OTP — banks NEVER ask for OTP' },
  { re: /kyc.{0,30}(expir|suspend|block|update|pending)/i, w: 35, tag: 'Fake KYC expiry/update threat' },
  { re: /(electricity|power).{0,40}(disconnect|cut)/i, w: 30, tag: 'Electricity disconnection scam pattern' },
  { re: /(digital arrest|cbi|narcotics|money launder|arrest warrant|police.{0,20}video call)/i, w: 45, tag: '"Digital arrest" scam — police NEVER arrest over video call' },
  { re: /(lottery|lucky draw|prize|winner|jackpot|kbc)/i, w: 35, tag: 'Lottery/prize fraud pattern' },
  { re: /(parcel|courier|customs|fedex|dhl).{0,40}(seized|illegal|drugs|held)/i, w: 40, tag: 'Courier/customs parcel scam' },
  { re: /(work from home|part.?time job|earn.{0,10}(daily|per day)|task.{0,20}(prepaid|commission))/i, w: 30, tag: 'Task/work-from-home fraud pattern' },
  { re: /(urgent|immediately|within 24|last warning|final notice|account.{0,20}(block|suspend|freeze))/i, w: 20, tag: 'Artificial urgency / threat' },
  { re: /(upi|paytm|phonepe|gpay|google pay).{0,40}(collect|request|approve|pin)/i, w: 35, tag: 'UPI collect-request fraud — approving a request SENDS money' },
  { re: /(anydesk|teamviewer|screen shar|remote access|quick support)/i, w: 40, tag: 'Remote-access app request — classic fraud step' },
  { re: /(refund|cashback|reward points).{0,30}(claim|expire|click)/i, w: 25, tag: 'Fake refund/cashback bait' },
  { re: /(bit\.ly|tinyurl|t\.co|cutt\.ly|rb\.gy|shorturl)/i, w: 20, tag: 'Shortened link hides real destination' },
  { re: /(aadhaar|pan).{0,30}(suspend|block|misuse|update|link)/i, w: 30, tag: 'Aadhaar/PAN threat scam' },
  { re: /(army|military|cisf|crpf).{0,40}(buy|sell|advance|olx|quikr)/i, w: 35, tag: 'Fake army-officer marketplace scam' },
  { re: /(loan.{0,20}approv|instant loan|pre.?approved)/i, w: 25, tag: 'Instant-loan bait (often predatory apps)' },
  { re: /(sextortion|nude|private video|morphed)/i, w: 40, tag: 'Sextortion pattern — do not pay, report to 1930' },
  { re: /(income tax|it refund|tds).{0,30}(refund|claim|verify)/i, w: 30, tag: 'Fake tax-refund message' },
  { re: /(click|verify|login).{0,20}(link|here)/i, w: 15, tag: 'Credential-phishing call to action' },
  { re: /(dear customer|dear user|valued customer)/i, w: 10, tag: 'Generic greeting typical of mass fraud' },
  { re: /(whatsapp|telegram).{0,30}(invest|trading|stock tips|guaranteed returns)/i, w: 35, tag: 'Investment/trading group fraud' },
];

function analyzeScam() {
  const txt = $('scamInput').value.trim();
  if (!txt) return;
  bumpStat('scams');
  let scoreV = 0; const hits = [];
  SCAM_PATTERNS.forEach(p => { if (p.re.test(txt)) { scoreV += p.w; hits.push(p.tag); } });
  if (/^\+?[0-9\s-]{7,15}$/.test(txt)) hits.push('Phone number alone can\'t be verified offline — search it online and never call back unknown international numbers (+92, +234, etc.)');
  scoreV = Math.min(98, scoreV);
  const verdict = scoreV >= 60 ? ['🚨 HIGH RISK — almost certainly a scam', 'var(--red)'] :
                  scoreV >= 30 ? ['⚠️ SUSPICIOUS — treat with extreme caution', 'var(--amber)'] :
                  hits.length ? ['🟡 Some risk signals found', 'var(--amber)'] :
                                ['🟢 No known fraud patterns detected (stay alert anyway)', 'var(--green)'];
  const r = $('scamResult');
  r.innerHTML = `
    <div class="card wide" style="margin-top:12px">
      <div class="value" style="color:${verdict[1]};font-size:15px">${verdict[0]}</div>
      <div class="gauge"><div style="width:${Math.max(4,scoreV)}%;background:${verdict[1]}"></div></div>
      ${hits.length ? '<div class="hint" style="margin-top:10px"><b>Signals detected:</b><br>• ' + hits.map(esc).join('<br>• ') + '</div>' : ''}
      <div class="hint" style="margin-top:10px"><b>Golden rules:</b> Never share OTP/PIN/CVV. Approving a UPI request sends money. Police never demand money on video calls. When in doubt, hang up and call the organisation's official number.</div>
    </div>`;
}

/* ================= ELDER ================= */
$('elderToggle').addEventListener('change', e => {
  clearInterval(S.elderTimer);
  if (e.target.checked) {
    const mins = parseInt($('elderInterval').value, 10);
    S.elderTimer = setInterval(() => openCheckin('👋 Well-being check', 'Regular elder-care check-in. All good?', 60), mins * 60000);
  }
});
function addMed() {
  const n = $('medName').value.trim(), t = $('medTime').value;
  if (!n || !t) return alert('Enter medicine name and time.');
  S.meds.push({ n, t });
  store.set('meds', S.meds);
  $('medName').value = '';
  renderMeds();
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}
function renderMeds() {
  const l = $('medList');
  l.innerHTML = '';
  S.meds.forEach((m, i) => {
    const d = document.createElement('div');
    d.className = 'list-item';
    d.innerHTML = `<div><b>💊 ${esc(m.n)}</b><div class="sub2">daily at ${esc(m.t)}</div></div>`;
    const x = document.createElement('button');
    x.className = 'xbtn'; x.textContent = '🗑';
    x.onclick = () => { S.meds.splice(i,1); store.set('meds', S.meds); renderMeds(); };
    d.appendChild(x);
    l.appendChild(d);
  });
}
setInterval(() => {
  const now = new Date();
  const hm = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  S.meds.forEach(m => {
    if (m.t === hm && m.last !== new Date().toDateString()) {
      m.last = new Date().toDateString();
      store.set('meds', S.meds);
      if ('Notification' in window && Notification.permission === 'granted') new Notification('💊 Medicine time', { body: m.n });
      beep(2);
      openCheckin('💊 Medicine reminder', 'Time to take: ' + m.n + '. Tap I\'m OK once taken.', 120);
    }
  });
}, 30000);

/* ================= MIND ================= */
let breathTimer = null;
function startBreath() {
  const c = $('breathCircle');
  clearInterval(breathTimer);
  let phase = 0;
  const cycle = () => {
    phase = 1 - phase;
    c.style.transform = phase ? 'scale(1.35)' : 'scale(1)';
    c.textContent = phase ? 'Breathe in…' : 'Breathe out…';
  };
  cycle();
  breathTimer = setInterval(cycle, 4000);
  setTimeout(() => { clearInterval(breathTimer); c.textContent = 'Well done 💙'; c.style.transform = 'scale(1)'; }, 60000);
}

/* ================= COMMUNITY ================= */
let commMap = null;
const REPORT_TYPES = ['Harassment', 'Poor lighting', 'Theft/snatching', 'Suspicious activity', 'Unsafe road'];
function initCommMap() {
  if (commMap) { commMap.invalidateSize(); return; }
  const center = S.pos ? [S.pos.lat, S.pos.lon] : [28.6139, 77.2090]; // Delhi default
  commMap = L.map('commMap').setView(center, S.pos ? 15 : 5);
  L.tileLayer(tileURL, {attribution: tileAttr}).addTo(commMap);
  renderReportMarkers(commMap);
  commMap.on('click', e => {
    const type = prompt('What happened here?\n1 Harassment\n2 Poor lighting\n3 Theft/snatching\n4 Suspicious activity\n5 Unsafe road\n\nEnter 1-5:');
    const i = parseInt(type, 10) - 1;
    if (isNaN(i) || i < 0 || i > 4) return;
    const rep = { lat: e.latlng.lat, lon: e.latlng.lng, type: REPORT_TYPES[i], ts: Date.now() };
    S.reports.push(rep);
    store.set('reports', S.reports);
    bumpStat('reports');
    renderReportMarkers(commMap);
    renderReportList();
    updateGuardian();
  });
  renderReportList();
}
function renderReportMarkers(m) {
  S.reports.forEach(r => {
    L.circleMarker([r.lat, r.lon], {radius:7, color:'#ffb84d', fillColor:'#ffb84d', fillOpacity:.7})
      .addTo(m).bindPopup('⚠️ ' + r.type + '<br>' + new Date(r.ts).toLocaleDateString());
  });
}
function renderReportList() {
  const l = $('commList');
  l.innerHTML = '';
  [...S.reports].reverse().slice(0, 20).forEach((r) => {
    const idx = S.reports.indexOf(r);
    const d = document.createElement('div');
    d.className = 'list-item';
    d.innerHTML = `<div><b>⚠️ ${esc(r.type)}</b><div class="sub2">${new Date(r.ts).toLocaleString()} · ${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}</div></div>`;
    const x = document.createElement('button');
    x.className = 'xbtn'; x.textContent = '🗑';
    x.onclick = () => { S.reports.splice(idx,1); store.set('reports', S.reports); renderReportList(); };
    d.appendChild(x);
    l.appendChild(d);
  });
}
function shareReports() {
  if (!S.reports.length) return alert('No reports yet — tap the map to add one.');
  const txt = '⚠️ Unsafe spots I marked (Raksha AI):\n' + S.reports.map(r =>
    `• ${r.type} — https://maps.google.com/?q=${r.lat},${r.lon}`).join('\n');
  if (navigator.share) navigator.share({ text: txt }).catch(()=>{});
  else prompt('Copy:', txt);
}

/* ================= HELPLINES ================= */
const HELPLINES = [
  { n:'112', d:'National Emergency Number — police, fire, ambulance (all India, 24×7)', red: true },
  { n:'100', d:'Police' }, { n:'101', d:'Fire' }, { n:'102', d:'Ambulance' },
  { n:'108', d:'Emergency ambulance & disaster response' },
  { n:'1091', d:'Women Helpline' },
  { n:'181', d:'Women Helpline — domestic abuse support' },
  { n:'1098', d:'CHILDLINE — children in distress (24×7)' },
  { n:'14567', d:'Elder Line — senior citizens' },
  { n:'1930', d:'Cyber Crime / financial fraud — call within 24h of fraud', red: true },
  { n:'14416', d:'Tele-MANAS — mental health support (24×7)' },
  { n:'18005990019', d:'KIRAN — mental health rehabilitation', show:'1800-599-0019' },
  { n:'139', d:'Railway passenger helpline' },
  { n:'1073', d:'Road accident emergency' },
  { n:'1033', d:'Highway emergency (NHAI)' },
  { n:'15100', d:'NALSA — free legal aid' },
  { n:'1094', d:'Missing persons' },
  { n:'1077', d:'District disaster management' },
];
function renderHelplines() {
  const l = $('helplineList');
  l.innerHTML = '';
  HELPLINES.forEach(h => {
    const d = document.createElement('div');
    d.className = 'helpline';
    d.innerHTML = `<div class="hl-info"><b>${h.show || h.n}</b><div>${h.d}</div></div><a href="tel:${h.n}" class="${h.red?'red':''}">📞</a>`;
    l.appendChild(d);
  });
}

/* ================= DASHBOARD ================= */
function renderDashboard() {
  const st = S.stats;
  $('dTrips').textContent = st.trips || 0;
  $('dChecks').textContent = st.checks || 0;
  $('dScams').textContent = st.scams || 0;
  $('dEmergencies').textContent = st.emergencies || 0;
  $('dReports').textContent = st.reports || 0;
  $('dDays').textContent = Math.max(1, Math.ceil((Date.now() - (st.since || Date.now())) / 86400000));
  const { score } = computeScore();
  $('dailyReport').textContent =
    `Current safety score ${score}%. ${st.trips||0} trip(s) completed safely, ${st.checks||0} check-in(s) answered, ` +
    `${st.scams||0} message(s) screened for fraud, ${st.reports||0} community report(s) filed. ` +
    (S.contacts.length ? `Your circle of ${S.contacts.length} is ready.` : 'Tip: add trusted contacts to strengthen your protection.');
}

/* ================= SETTINGS ================= */
function wipeAll() {
  if (!confirm('This permanently deletes ALL Raksha AI data on this device — contacts, vault evidence, reports, settings. Continue?')) return;
  if (!confirm('Are you absolutely sure? Encrypted vault items cannot be recovered.')) return;
  Object.keys(localStorage).filter(k => k.startsWith('raksha_')).forEach(k => localStorage.removeItem(k));
  indexedDB.deleteDatabase('raksha_vault');
  location.reload();
}

/* ================= boot ================= */
renderHelplines();
renderMeds();
renderDashboard();
