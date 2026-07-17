/* =========================================================
   Raksha AI v22 — Emergency Medical QR
   Turns the offline ICE card into a QR code any first responder
   can scan with a plain phone camera (no app) to instantly read
   blood group, allergies, conditions, medications and the
   emergency contact. Printable for wallet / bag / helmet.
   Uses the free api.qrserver.com generator (already SW-whitelisted).
   ========================================================= */
"use strict";

function iceQrText() {
  const ice = (typeof store !== 'undefined' ? store.get('ice', null) : null) || {};
  const L = [];
  L.push('EMERGENCY MEDICAL INFO (ICE)');
  if (ice.name) L.push('Name: ' + ice.name);
  if (ice.dob) L.push('Age/DOB: ' + ice.dob);
  if (ice.blood) L.push('Blood group: ' + ice.blood);
  L.push('Allergies: ' + (ice.allergy || 'not specified'));
  if (ice.conditions) L.push('Conditions: ' + ice.conditions);
  if (ice.meds) L.push('Medications: ' + ice.meds);
  if (ice.contact) L.push('Emergency contact: ' + ice.contact);
  // add trusted contacts if present
  try {
    if (S && S.contacts && S.contacts.length) {
      const nums = S.contacts.slice(0, 3).map(c => (c.name ? c.name + ' ' : '') + c.phone).join(' | ');
      if (nums) L.push('Trusted: ' + nums);
    }
  } catch (e) {}
  L.push('In emergency call 112 (India). — via Raksha AI');
  return L.join('\n');
}

function iceQrUrl(size) {
  const data = encodeURIComponent(iceQrText());
  return 'https://api.qrserver.com/v1/create-qr-code/?size=' + (size || 300) + 'x' + (size || 300) +
    '&margin=8&ecc=M&data=' + data;
}

function iceQR() {
  const ice = (typeof store !== 'undefined' ? store.get('ice', null) : null);
  if (!ice || !ice.name) { alert('Fill and save your ICE card first, then generate the QR.'); return; }
  const box = $('iceQrBox'), img = $('iceQrImg'), cap = $('iceQrCap');
  if (img) img.src = iceQrUrl(300);
  if (cap) cap.textContent = 'Scan with any phone camera. Contains no login — just your emergency medical details.';
  if (box) box.style.display = 'block';
  try { brainLog('🔳', 'Emergency medical QR generated', 0); } catch (e) {}
  if (box && box.scrollIntoView) setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
}

async function iceQrDownload() {
  try {
    const res = await fetch(iceQrUrl(600));
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'raksha-emergency-qr.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) {
    // fallback: open in a new tab so the user can long-press to save
    window.open(iceQrUrl(600), '_blank');
  }
}

/* ---------- Hindi ---------- */
if (typeof I18N !== 'undefined' && I18N.hi) Object.assign(I18N.hi, {
  iceqr: '🔳 आपातकालीन QR कोड दिखाएँ',
  iceqrp: 'कोई भी रिस्पॉन्डर इसे सामान्य फ़ोन कैमरे से स्कैन कर सकता है — बिना ऐप के — और तुरंत आपका ब्लड ग्रुप, एलर्जी, बीमारियाँ, दवाएँ और आपातकालीन संपर्क पढ़ सकता है। इसे बटुए, बैग या हेलमेट के लिए प्रिंट करें।',
  iceqrdl: '⬇️ QR डाउनलोड करें',
});
if (typeof applyLang === 'function') applyLang();

try { brainLog('🔳', 'v22 online — emergency medical QR ready', 0); } catch (e) {}
