/* =========================================================
   Raksha AI v20 — WhatsApp SOS
   • One-tap WhatsApp message to a trusted contact with a live
     Google Maps location link. WhatsApp is the dominant messenger
     in India and often reaches people faster than SMS/calls.
   • "Reached safely" WhatsApp variant.
   • Works offline-to-app: opens the WhatsApp app directly.
   ========================================================= */
"use strict";

/* clean a phone number down to digits (WhatsApp wants country code, no +) */
function waClean(n) { return String(n || '').replace(/[^0-9]/g, ''); }

function waNumber() {
  const field = (typeof $ === 'function' && $('waSosNum')) ? $('waSosNum').value : '';
  const set = waClean(field || (typeof store !== 'undefined' ? store.get('waSosNum', '') : ''));
  if (set) return set;
  try { if (S && S.contacts && S.contacts[0] && S.contacts[0].phone) return waClean(S.contacts[0].phone); } catch (e) {}
  return '';
}

/* best-effort fresh location; falls back to the app's tracked S.pos */
function waLocation() {
  return new Promise(resolve => {
    let done = false;
    const fallback = () => {
      try { if (S && S.pos) return resolve(`https://maps.google.com/?q=${S.pos.lat},${S.pos.lon}`); } catch (e) {}
      resolve('(location unavailable — please share it manually)');
    };
    if (!navigator.geolocation) return fallback();
    const t = setTimeout(() => { if (!done) { done = true; fallback(); } }, 7000);
    navigator.geolocation.getCurrentPosition(p => {
      if (done) return; done = true; clearTimeout(t);
      resolve(`https://maps.google.com/?q=${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`);
    }, () => { if (!done) { done = true; clearTimeout(t); fallback(); } }, { enableHighAccuracy: true, timeout: 7000 });
  });
}

function waOpen(text) {
  const num = waNumber();
  const url = (num ? `https://wa.me/${num}` : 'https://wa.me/') + '?text=' + encodeURIComponent(text);
  window.open(url, '_blank');
}

async function waShareSOS() {
  try { store.set('waSosNum', waClean(($('waSosNum') && $('waSosNum').value) || store.get('waSosNum',''))); } catch (e) {}
  const loc = await waLocation();
  let custom = '';
  try { const c = (store.get('customSosMsg', '') || '').trim(); if (c) custom = '\n' + c; } catch (e) {}
  const msg = '🚨 EMERGENCY — I need help right now. This is not a test.' +
    '\nMy live location: ' + loc +
    '\nIf you can\'t reach me, please call 112 (police).' + custom +
    '\n\n— sent via Raksha AI';
  waOpen(msg);
  try { brainLog('💬', 'WhatsApp SOS opened with live location', 60); } catch (e) {}
}

async function waReached() {
  const loc = await waLocation();
  waOpen('✅ I reached safely! My location: ' + loc + '\n\n— sent via Raksha AI');
  try { brainLog('✅', 'WhatsApp "reached safely" sent', 0); } catch (e) {}
}

/* ---------- restore saved number ---------- */
(function () {
  try {
    const f = $('waSosNum');
    if (f) f.value = store.get('waSosNum', '');
  } catch (e) {}
})();

/* ---------- Hindi ---------- */
if (typeof I18N !== 'undefined' && I18N.hi) Object.assign(I18N.hi, {
  wasos: '💬 WhatsApp SOS',
  wasosp: 'एक टैप में WhatsApp खुलता है — आपातकालीन संदेश और आपकी लाइव लोकेशन के मैप लिंक के साथ, भरोसेमंद संपर्क को भेजने के लिए तैयार। जब कॉल करना सुरक्षित न लगे तब उपयोगी।',
  wasosbtn: 'WhatsApp SOS भेजें', wareach: 'WhatsApp पर "सुरक्षित पहुँच गया/गई"',
  wasosnote: 'नंबर खाली छोड़ें तो आप खुद चैट चुन सकते हैं। वरना सीधे उस संपर्क को जाएगा।',
});
if (typeof applyLang === 'function') applyLang();

try { brainLog('💬', 'v20 online — WhatsApp SOS ready', 0); } catch (e) {}
