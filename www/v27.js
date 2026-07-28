/* =========================================================
   Raksha AI v27 — Complaint & FIR Helper
   Converts an incident (plus the tamper-proof Evidence Chain)
   into a properly formatted complaint the user can print & file:
   • Police FIR / general complaint
   • Cyber-crime complaint (NCRP / 1930)
   • Women's cell / harassment
   • Domestic incident (PWDVA)
   All on-device, template-based — no server, no AI call needed.
   Clearly a self-help draft, not legal advice.
   ========================================================= */
"use strict";

const COMP_HINTS = {
  fir: 'Addressed to the Station House Officer (SHO). Take it to your local police station, or file online where your state offers e-FIR.',
  cyber: 'For online fraud, UPI/KYC scams, or online harassment. Also call 1930 and file at cybercrime.gov.in — attach this as your written complaint.',
  women: 'For harassment, stalking or eve-teasing. File at the police station or the district Women\'s Cell. Women\'s helpline: 1091 / 181.',
  domestic: 'Under the Protection of Women from Domestic Violence Act, 2005. Can be filed with a Protection Officer, Magistrate, or police. Support: 181.',
  other: 'A general written complaint you can submit to the relevant authority.',
};

function compHint() {
  const h = $('compHint'); const type = $('compType') && $('compType').value;
  if (h) h.textContent = COMP_HINTS[type] || '';
}

function compChainSummary() {
  try {
    const chain = (typeof store !== 'undefined' ? store.get('evchain', []) : []) || [];
    if (!chain.length) return '';
    const lines = ['', 'ANNEXURE — TAMPER-EVIDENT EVIDENCE RECORD (Raksha AI Evidence Chain):',
      'The following entries were cryptographically sealed (SHA-256, hash-linked) at the time',
      'each was recorded. Any later edit, deletion or back-dating is detectable by re-verifying',
      'the hashes. ' + chain.length + ' entr' + (chain.length === 1 ? 'y' : 'ies') + ' on record:'];
    chain.forEach(e => {
      lines.push('  • #' + e.i + ' [' + new Date(e.ts).toLocaleString('en-IN') + '] ' + e.type + ': ' + e.note +
        (e.lat != null ? ' (loc ' + e.lat + ',' + e.lon + ')' : '') + '  seal:' + e.hash.slice(0, 12) + '…');
    });
    return lines.join('\n');
  } catch (e) { return ''; }
}

function compHeader(type) {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  if (type === 'cyber') return ['To,', 'The Investigating Officer,', 'Cyber Crime Cell / National Cyber Crime Reporting Portal',
    '(www.cybercrime.gov.in · Helpline 1930)', '', 'Date: ' + today, '',
    'Subject: Complaint regarding cyber-crime / online fraud'];
  if (type === 'women') return ['To,', 'The Station House Officer / Women\'s Cell,', '________________________ Police Station',
    '', 'Date: ' + today, '', 'Subject: Complaint regarding harassment / safety of a woman'];
  if (type === 'domestic') return ['To,', 'The Protection Officer / The Station House Officer,', '________________________',
    '', 'Date: ' + today, '', 'Subject: Complaint under the Protection of Women from Domestic Violence Act, 2005'];
  return ['To,', 'The Station House Officer,', '________________________ Police Station', '',
    'Date: ' + today, '', 'Subject: Complaint / request to register an FIR'];
}

function compPrayer(type) {
  if (type === 'cyber') return 'I request you to investigate this matter, trace the accused, freeze any fraudulent transactions where applicable, and take action under the Information Technology Act, 2000 and the applicable provisions of the law.';
  if (type === 'domestic') return 'I request appropriate protection and relief under the Protection of Women from Domestic Violence Act, 2005, and any other action the law provides.';
  if (type === 'women') return 'I request you to register my complaint, ensure my safety, and take strict action against the accused under the applicable provisions of the law.';
  return 'I therefore request you to kindly register an FIR, investigate the matter, and take appropriate action under the applicable provisions of the law.';
}

function compGen() {
  const type = ($('compType') && $('compType').value) || 'fir';
  const g = id => (($(id) && $(id).value) || '').trim();
  const name = g('compName') || (function () { try { const ice = store.get('ice', null); return ice && ice.name ? ice.name : ''; } catch (e) { return ''; } })();
  const addr = g('compAddr'), phone = g('compPhone');
  const when = g('compWhen') || '(date & time of incident)';
  const where = g('compWhere') || '(place of incident)';
  const who = g('compWho') || 'unknown person(s)';
  const what = g('compWhat');
  if (!what) { alert('Please describe what happened — that\'s the heart of the complaint.'); return; }

  const L = [];
  L.push(...compHeader(type));
  L.push('');
  L.push('Respected Sir/Madam,');
  L.push('');
  L.push('I, ' + (name || '____________________') + ', ' +
    (addr ? 'resident of ' + addr + ', ' : '') +
    (phone ? 'contactable at ' + phone + ', ' : '') +
    'wish to lodge the following complaint.');
  L.push('');
  L.push('On ' + when + ', at ' + where + ', the following incident took place involving ' + who + ':');
  L.push('');
  L.push(what);
  L.push('');
  L.push(compPrayer(type));

  const chain = ($('compChain') && $('compChain').checked) ? compChainSummary() : '';
  if (chain) L.push(chain);

  L.push('');
  L.push('I declare that the above is true to the best of my knowledge and belief.');
  L.push('');
  L.push('Yours faithfully,');
  L.push(name || '____________________');
  if (phone) L.push('Phone: ' + phone);
  if (addr) L.push('Address: ' + addr);
  L.push('');
  L.push('— — — — — — — — — — — — — — — — — — — — — — — — —');
  L.push('Emergency: 112 · Women: 1091/181 · Cyber: 1930 · Child: 1098');
  L.push('Prepared with Raksha AI (self-help draft — not legal advice). Please verify details and consult a lawyer or the police if needed.');

  const out = $('compOut');
  if (out) out.textContent = L.join('\n');   // textContent — safe, no HTML injection
  const wrap = $('compOutWrap'); if (wrap) wrap.style.display = 'block';
  if (wrap && wrap.scrollIntoView) setTimeout(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  try { brainLog('📝', 'Complaint draft generated (' + type + ')', 0); } catch (e) {}
}

function compText() { return ($('compOut') && $('compOut').textContent) || ''; }

function compCopy() {
  const t = compText(); if (!t) return;
  try { navigator.clipboard.writeText(t).then(() => alert('✅ Copied. Paste it anywhere, or into cybercrime.gov.in.'), () => compFallbackCopy(t)); }
  catch (e) { compFallbackCopy(t); }
}
function compFallbackCopy(t) {
  try { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); alert('✅ Copied.'); } catch (e) {}
}
function compDownload() {
  const t = compText(); if (!t) return;
  const blob = new Blob([t], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'raksha-complaint-' + new Date().toISOString().slice(0, 10) + '.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function compPrint() {
  const t = compText(); if (!t) return;
  const w = window.open('', '_blank');
  if (!w) { alert('Allow pop-ups to print, or use Download instead.'); return; }
  w.document.write('<pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:14px;line-height:1.6;padding:24px">' +
    t.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])) + '</pre>');
  w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch (e) {} }, 300);
}

/* make it findable in search */
try {
  if (typeof FIND_INDEX !== 'undefined') FIND_INDEX.push({
    e: '📝', label: 'Complaint & FIR Helper',
    kw: ['fir', 'complaint', 'police', 'cyber', '1930', 'file', 'report', 'ncrp', 'women cell', 'lawyer', 'case'],
    act: () => { try { go('complaint'); } catch (e) {} }
  });
} catch (e) {}

/* Hindi */
if (typeof I18N !== 'undefined' && I18N.hi) Object.assign(I18N.hi, {
  comp: '📝 शिकायत और FIR सहायक',
  compp: 'किसी घटना को दाखिल करने-योग्य पुलिस FIR, साइबर-क्राइम (1930) या महिला-सेल शिकायत में बदलें — भारत के लिए सही शब्दों में, आपकी एविडेंस चेन के साथ।',
  compgen: '📝 शिकायत ड्राफ़्ट बनाएँ', compcopy: '📋 कॉपी', compdl: '⬇️ डाउनलोड', compprint: '🖨️ प्रिंट',
  compchain: 'मेरी एविडेंस चेन (छेड़छाड़-प्रमाण रिकॉर्ड) संलग्न करें',
});
if (typeof applyLang === 'function') applyLang();

setTimeout(compHint, 900);
try { brainLog('📝', 'v27 online — Complaint & FIR Helper ready', 0); } catch (e) {}
