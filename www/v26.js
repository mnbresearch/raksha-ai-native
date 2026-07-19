/* =========================================================
   Raksha AI v26 — Evidence Chain (tamper-evident log)

   Each entry is hashed with SHA-256 over its own content PLUS
   the previous entry's hash. That creates a chain: changing,
   deleting or back-dating any past entry breaks every hash
   after it, and verification will say exactly where.

   Why it matters: survivors of domestic violence, stalking and
   harassment are routinely accused of fabricating or back-dating
   their records. A hash chain makes the log self-proving.
   100% on-device (WebCrypto) — no server, no account.
   ========================================================= */
"use strict";

const CHAIN_KEY = 'evchain';

function chainGet() { try { return store.get(CHAIN_KEY, []) || []; } catch (e) { return []; } }
function chainSet(c) { try { store.set(CHAIN_KEY, c); } catch (e) {} }

function chainEsc(s) {
  if (typeof esc === 'function') return esc(s);
  return String(s == null ? '' : s).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/* canonical serialisation — must be identical when re-verifying */
function chainCanon(e) {
  return [e.i, e.ts, e.type, e.note, (e.lat == null ? '' : e.lat), (e.lon == null ? '' : e.lon), e.prev].join('|');
}

async function sha256hex(str) {
  const buf = new TextEncoder().encode(str);
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function chainPos() {
  return new Promise(resolve => {
    const want = $('chainLoc') && $('chainLoc').checked;
    if (!want) return resolve({});
    try { if (S && S.pos) return resolve({ lat: +S.pos.lat.toFixed(5), lon: +S.pos.lon.toFixed(5) }); } catch (e) {}
    if (!navigator.geolocation) return resolve({});
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve({}); } }, 6000);
    navigator.geolocation.getCurrentPosition(
      p => { if (done) return; done = true; clearTimeout(t); resolve({ lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5) }); },
      () => { if (!done) { done = true; clearTimeout(t); resolve({}); } },
      { enableHighAccuracy: true, timeout: 6000 });
  });
}

async function chainAdd() {
  const note = (($('chainNote') && $('chainNote').value) || '').trim();
  if (!note) { alert('Describe what happened first — facts are what make the record useful.'); return; }
  const type = ($('chainType') && $('chainType').value) || 'Incident';
  const st = $('chainStatus'); if (st) st.textContent = 'Sealing…';

  const chain = chainGet();
  const pos = await chainPos();
  const e = {
    i: chain.length,
    ts: Date.now(),
    type, note,
    lat: pos.lat != null ? pos.lat : null,
    lon: pos.lon != null ? pos.lon : null,
    prev: chain.length ? chain[chain.length - 1].hash : 'GENESIS',
  };
  e.hash = await sha256hex(chainCanon(e));
  chain.push(e);
  chainSet(chain);

  if ($('chainNote')) $('chainNote').value = '';
  if (st) st.innerHTML = '✅ Entry #' + e.i + ' sealed. Hash <code>' + e.hash.slice(0, 16) + '…</code>';
  chainRender();
  try { brainLog('⛓️', 'Evidence entry sealed into chain (#' + e.i + ')', 0); } catch (err) {}
}

async function chainVerify() {
  const chain = chainGet();
  const st = $('chainStatus');
  if (!chain.length) { if (st) st.textContent = 'Chain is empty — nothing to verify yet.'; return; }
  if (st) st.textContent = 'Verifying ' + chain.length + ' entries…';
  let prev = 'GENESIS';
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i];
    if (e.i !== i || e.prev !== prev) {
      if (st) st.innerHTML = '❌ <b>Chain broken at entry #' + i + '</b> — an entry was inserted, removed or re-ordered.';
      chainRender(i); return;
    }
    const recomputed = await sha256hex(chainCanon(e));
    if (recomputed !== e.hash) {
      if (st) st.innerHTML = '❌ <b>Entry #' + i + ' was altered</b> — its contents no longer match its seal.';
      chainRender(i); return;
    }
    prev = e.hash;
  }
  if (st) st.innerHTML = '✅ <b>Verified.</b> All ' + chain.length + ' entries intact and in order — nothing added, edited, removed or back-dated since sealing.';
  chainRender(-1);
  try { brainLog('⛓️', 'Evidence chain verified intact (' + chain.length + ' entries)', 0); } catch (e) {}
}

function chainRender(breakAt) {
  const box = $('chainList'); if (!box) return;
  const chain = chainGet();
  if (!chain.length) { box.innerHTML = '<p class="hint">No entries yet. Each one you add is sealed and time-stamped.</p>'; return; }
  box.innerHTML = chain.slice().reverse().map(e => {
    const bad = (breakAt != null && breakAt >= 0 && e.i >= breakAt);
    const when = new Date(e.ts).toLocaleString('en-IN');
    const loc = (e.lat != null && e.lon != null)
      ? '<a href="https://maps.google.com/?q=' + e.lat + ',' + e.lon + '" target="_blank" rel="noopener">📍 location</a>' : '';
    return '<div class="card wide" style="margin-top:8px;border-color:' + (bad ? 'var(--red)' : 'var(--line)') + '">' +
      '<div class="label">#' + e.i + ' · ' + chainEsc(e.type) + (bad ? ' — ⚠️ tampered' : '') + '</div>' +
      '<div style="font-size:14px;line-height:1.6;margin-top:4px">' + chainEsc(e.note) + '</div>' +
      '<div class="hint" style="margin-top:6px">🕒 ' + chainEsc(when) + ' ' + loc + '</div>' +
      '<div class="hint" style="word-break:break-all;margin-top:4px">🔒 <code>' + e.hash.slice(0, 24) + '…</code></div>' +
      '</div>';
  }).join('');
}

function chainExport() {
  const chain = chainGet();
  if (!chain.length) { alert('Nothing to export yet.'); return; }
  const lines = [
    'RAKSHA AI — EVIDENCE CHAIN (tamper-evident record)',
    'Generated: ' + new Date().toLocaleString('en-IN') + ' IST',
    'Entries: ' + chain.length,
    '',
    'HOW TO VERIFY: each entry\'s SHA-256 hash is computed over',
    'i|timestamp|type|note|lat|lon|previousHash. Re-computing any entry',
    'must reproduce its stored hash, and each entry\'s "prev" must equal',
    'the previous entry\'s hash. Any edit, deletion, insertion or change',
    'of date breaks the chain from that point onward.',
    '='.repeat(64), ''
  ];
  chain.forEach(e => {
    lines.push('ENTRY #' + e.i);
    lines.push('  Time      : ' + new Date(e.ts).toLocaleString('en-IN') + ' (epoch ' + e.ts + ')');
    lines.push('  Type      : ' + e.type);
    lines.push('  Account   : ' + e.note);
    if (e.lat != null) lines.push('  Location  : ' + e.lat + ', ' + e.lon + '  https://maps.google.com/?q=' + e.lat + ',' + e.lon);
    lines.push('  Prev hash : ' + e.prev);
    lines.push('  Hash      : ' + e.hash);
    lines.push('');
  });
  lines.push('='.repeat(64));
  lines.push('MACHINE-READABLE COPY (JSON):');
  lines.push(JSON.stringify(chain));

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'raksha-evidence-chain-' + new Date().toISOString().slice(0, 10) + '.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try { brainLog('⛓️', 'Evidence chain exported as proof file', 0); } catch (e) {}
}

/* ---------- make it findable in the v25 search ---------- */
try {
  if (typeof FIND_INDEX !== 'undefined') FIND_INDEX.push({
    e: '⛓️', label: 'Evidence Chain (tamper-proof log)',
    kw: ['evidence', 'chain', 'proof', 'court', 'tamper', 'log', 'record', 'fir', 'lawyer', 'case'],
    act: () => { try { go('chain'); } catch (e) {} }
  });
} catch (e) {}

/* ---------- Hindi ---------- */
if (typeof I18N !== 'undefined' && I18N.hi) Object.assign(I18N.hi, {
  chain: '⛓️ एविडेंस चेन',
  chainp: 'छेड़छाड़-प्रमाण घटना लॉग। हर प्रविष्टि पिछली से क्रिप्टोग्राफ़िक रूप से जुड़ी होती है, इसलिए बदलाव या बैक-डेटिंग पकड़ी जाती है — अदालत में विश्वसनीय सबूत, आपके फ़ोन पर।',
  chainadd: 'प्रविष्टि जोड़ें', chainseal: '🔒 चेन में सील करें',
  chainverify: '🔍 चेन जाँचें', chainexport: '⬇️ प्रूफ़ निर्यात करें',
  chainloc: 'मेरा वर्तमान स्थान संलग्न करें',
});
if (typeof applyLang === 'function') applyLang();

setTimeout(() => { try { chainRender(); } catch (e) {} }, 1000);
try { brainLog('⛓️', 'v26 online — Evidence Chain ready', 0); } catch (e) {}
