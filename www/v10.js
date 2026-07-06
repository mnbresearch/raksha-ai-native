/* =========================================================
   Raksha AI v10 — reach & evidence
   No-install family tracker links, court-ready PDF case file,
   phone contact import, safety score history chart, auto-Hindi.
   ========================================================= */
"use strict";

/* ================= TRACKER LINKS EVERYWHERE ================= */
function trackerLink() {
  const code = ($('famCode').value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  return code ? location.origin + location.pathname.replace(/index\.html$/, '') + 'track.html?fam=' + encodeURIComponent(code) : null;
}
/* emergency messages include the live-tracker link (works without the app) */
const _vStartEmergency = startEmergency;
startEmergency = function (reason) {
  const t = trackerLink();
  _vStartEmergency(t && $('famToggle').checked ? reason + '. LIVE TRACKER (no app needed): ' + t : reason);
};
/* invite text includes it too */
const _vShareFam = shareFamCode;
shareFamCode = function () {
  const code = $('famCode').value.trim();
  if (!code) return alert('Set a family code first.');
  const t = trackerLink();
  const txt = `🛡️ Join my Raksha AI family circle!\nApp (best): ${location.origin + location.pathname}\nOr just watch me live in any browser — no install: ${t}\nFamily code: ${code}`;
  if (navigator.share) navigator.share({ text: txt }).catch(() => {});
  else prompt('Copy and send:', txt);
};

/* ================= COURT-READY PDF CASE FILE ================= */
let jsPDFReady = null;
function loadJsPDF() {
  if (jsPDFReady) return jsPDFReady;
  jsPDFReady = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  return jsPDFReady;
}
async function vaultExportPDF() {
  if (!window.vaultKey || window.decoyMode) return alert('Unlock the vault with your real PIN first.');
  await openDB();
  const items = (await dbAll()).sort((a, b) => a.ts - b.ts);
  if (!items.length) return alert('Vault is empty.');
  try { await loadJsPDF(); } catch (e) { return alert('Could not load the PDF library — check your connection.'); }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  let y = 20;
  const line = (txt, size, style) => {
    doc.setFontSize(size || 11);
    doc.setFont('helvetica', style || 'normal');
    doc.splitTextToSize(txt, W - 28).forEach(l => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(l, 14, y); y += size ? size * 0.55 : 6;
    });
  };
  line('RAKSHA AI — INCIDENT CASE FILE', 16, 'bold'); y += 2;
  line('Generated: ' + new Date().toLocaleString() + '  ·  Items: ' + items.length, 10); y += 2;
  line('All items below were stored AES-256 encrypted on the owner\'s device and decrypted locally for this export. Timestamps are device timestamps.', 9, 'italic'); y += 6;
  let idx = 0;
  for (const it of items) {
    idx++;
    line(idx + '. [' + new Date(it.ts).toLocaleString() + '] ' + it.type.toUpperCase(), 12, 'bold');
    if (it.type === 'note') {
      try { line(await (await decBlob(it, 'text/plain')).text(), 11); } catch (e) { line('(could not decrypt with current PIN)', 10, 'italic'); }
    } else if (it.type === 'photo') {
      try {
        const blob = await decBlob(it, it.mime);
        const dataURL = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
        const img = await new Promise((r, j) => { const im = new Image(); im.onload = () => r(im); im.onerror = j; im.src = dataURL; });
        const w = Math.min(120, W - 28), h = w * img.height / img.width;
        if (y + h > 275) { doc.addPage(); y = 20; }
        doc.addImage(dataURL, 'JPEG', 14, y, w, h); y += h + 6;
      } catch (e) { line('(photo could not be embedded)', 10, 'italic'); }
    } else {
      line((it.note || 'Audio recording') + ' — audio evidence is stored in the app; export individually if needed.', 10, 'italic');
    }
    y += 4;
  }
  line('— end of case file —', 10, 'italic');
  doc.save('raksha-case-file-' + new Date().toISOString().slice(0, 10) + '.pdf');
  brainLog('📄', 'Court-ready PDF case file exported (' + items.length + ' items)', 0);
}

/* ================= PHONE CONTACT IMPORT (Contact Picker API) ================= */
async function importContacts() {
  if (!('contacts' in navigator && 'select' in navigator.contacts)) {
    return alert('Contact import needs Chrome on Android. On other devices, add contacts manually above.');
  }
  try {
    const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true });
    let added = 0;
    picked.forEach(c => {
      const phone = (c.tel && c.tel[0]) || '';
      const name = (c.name && c.name[0]) || phone;
      if (phone && !S.contacts.some(x => x.phone === phone)) { S.contacts.push({ name, phone }); added++; }
    });
    persistContacts();
    alert('✅ Imported ' + added + ' contact(s).');
  } catch (e) {}
}

/* ================= SAFETY SCORE HISTORY ================= */
const scoreHist = store.get('scorehist', []);
setInterval(() => {
  const { score } = computeScore();
  scoreHist.push({ ts: Date.now(), s: score });
  while (scoreHist.length > 96 * 7) scoreHist.shift();
  store.set('scorehist', scoreHist);
}, 15 * 60000);

function drawScoreChart() {
  const cv = $('scoreChart');
  if (!cv || !scoreHist.length) return;
  const c = cv.getContext('2d');
  const W = cv.width = cv.clientWidth * 2, H = cv.height = 120;
  c.clearRect(0, 0, W, H);
  const pts = scoreHist.slice(-96);
  c.beginPath();
  c.strokeStyle = '#2ee6a8'; c.lineWidth = 3;
  pts.forEach((p, i) => {
    const x = i / Math.max(1, pts.length - 1) * (W - 20) + 10;
    const y = H - 10 - (p.s - 0) / 100 * (H - 25);
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  });
  c.stroke();
  c.fillStyle = '#8fa3c8'; c.font = '20px sans-serif';
  c.fillText('last 24h · now ' + pts[pts.length - 1].s + '%', 10, 20);
}
setInterval(() => { if ($('page-dashboard').classList.contains('active')) drawScoreChart(); }, 3000);

/* ================= AUTO-HINDI ON FIRST RUN ================= */
if (!localStorage.getItem('raksha_lang') && (navigator.language || '').toLowerCase().startsWith('hi')) {
  lang = 'hi'; store.set('lang', 'hi'); applyLang();
}

/* ================= boot ================= */
(function seedScore() { const { score } = computeScore(); if (!scoreHist.length) { scoreHist.push({ ts: Date.now(), s: score }); store.set('scorehist', scoreHist); } })();
brainLog('🌐', 'v10 online — no-install tracker links, PDF case file, contact import, score history', 0);
