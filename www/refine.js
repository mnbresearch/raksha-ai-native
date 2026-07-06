/* =========================================================
   Raksha AI v9 — refinements + final features
   Bug fixes: trip re-baseline after "I'm OK", stale family list.
   Refinements: Hindi for newer features, richer scam patterns,
   more Assistant intents, Hindi companion voice lines.
   New: real flashlight, auto-call on SOS, trip start/arrival
   broadcast, danger-zone proximity alerts, protection streak.
   ========================================================= */
"use strict";

/* ================= FIX: TRIP RE-BASELINE AFTER "I'M OK" ================= */
/* Previously, answering "I'm OK" after a deviation could re-trigger the
   warning within seconds (still off the old route). Now the Guardian
   re-plans the route from your current position. */
$('imOkBtn').addEventListener('click', async () => {
  if (!S.trip || !S.pos) return;
  const t = S.trip;
  t.warned = true;                                     // hold warnings while re-planning
  try {
    const r = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${S.pos.lon},${S.pos.lat};${t.dest.lon},${t.dest.lat}?overview=full&geometries=geojson`)).json();
    if (r.code === 'Ok' && r.routes?.length) {
      t.route = { km: r.routes[0].distance / 1000, min: r.routes[0].duration / 60,
        coords: r.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lon: c[0] })) };
      t.startedAt = Date.now();
      t.expectedMin = t.route.min;
      brainLog('🔄', 'Route re-planned from your current position — trip watch reset', 0);
      $('tripDetail').textContent = 'Route re-planned: ' + t.route.km.toFixed(1) + ' km · ETA ' + Math.round(t.route.min) + ' min';
    }
  } catch (e) {}
  setTimeout(() => { if (S.trip) S.trip.warned = false; }, 90000);  // 90 s cooldown either way
});

/* ================= FIX: FAMILY LIST FRESHNESS ================= */
setInterval(() => {
  if (typeof famSeen !== 'undefined' && Object.keys(famSeen).length && $('page-circle').classList.contains('active')) renderFamList();
}, 30000);

/* ================= TRIP START/ARRIVAL → FAMILY LIVE ================= */
const _rEndTrip = endTrip;
endTrip = function (msg) {
  if (S.trip && msg && msg.includes('safely')) { try { famBroadcast('ok', 'Arrived safely ✅'); } catch (e) {} }
  _rEndTrip(msg);
};
$('tripBtn').addEventListener('click', () => {
  setTimeout(() => {
    if (S.trip) { try { famBroadcast('ok', 'Started a trip — Guardian watching (' + S.trip.route.km.toFixed(1) + ' km, ETA ' + (S.trip.expectedMin ? Math.round(S.trip.expectedMin) + ' min' : 'n/a') + ')'); } catch (e) {} }
  }, 400);
});

/* ================= DANGER-ZONE PROXIMITY ALERT ================= */
let lastZoneWarn = 0;
setInterval(() => {
  if (!S.pos || !S.reports.length || Date.now() - lastZoneWarn < 10 * 60000) return;
  const near = S.reports.filter(r => haversine(S.pos, r) < 300);
  if (near.length >= 1) {
    lastZoneWarn = Date.now();
    const types = [...new Set(near.map(r => r.type))].join(', ');
    brainLog('⚠️', 'Entering an area with community reports: ' + types, 12);
    beep(2);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    if ('Notification' in window && Notification.permission === 'granted')
      new Notification('⚠️ Stay alert', { body: 'This area has reports: ' + types + '. Consider a brighter route or Walk With Me.' });
  }
}, 30000);

/* ================= REAL FLASHLIGHT ================= */
let torchStream = null;
$('torchToggle').addEventListener('change', async e => {
  if (!e.target.checked) {
    if (torchStream) { torchStream.getTracks().forEach(t => t.stop()); torchStream = null; }
    stopStrobe();
    return;
  }
  try {
    torchStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const track = torchStream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (caps.torch) {
      await track.applyConstraints({ advanced: [{ torch: true }] });
      brainLog('🔆', 'Flashlight on', 0);
    } else {
      track.stop(); torchStream = null;
      // fallback: solid bright screen
      const o = $('strobeOverlay');
      o.style.display = 'block'; o.style.background = '#fff';
      keepAwake(true);
      alert('This device doesn\'t expose the camera torch to the browser — using full-brightness white screen instead. Tap the screen to turn off.');
    }
  } catch (err) { e.target.checked = false; alert('Camera permission needed for the flashlight.'); }
});

/* ================= AUTO-CALL PRIMARY ON SOS ================= */
$('autoCallToggle').checked = !!store.get('autocall', false);
$('autoCallToggle').addEventListener('change', e => store.set('autocall', e.target.checked));
const _rStartEmergency = startEmergency;
startEmergency = function (reason) {
  _rStartEmergency(reason);
  if (store.get('autocall', false) && S.contacts.length) {
    setTimeout(() => { if (S.emergencyActive) window.location.href = 'tel:' + S.contacts[0].phone; }, 5000);
  }
};

/* ================= PROTECTION STREAK ================= */
(function streak() {
  const today = new Date().toDateString();
  const s = store.get('streak', { last: '', n: 0 });
  if (s.last !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    s.n = (s.last === yesterday) ? s.n + 1 : 1;
    s.last = today;
    store.set('streak', s);
  }
  const el = $('dDays');
  if (el && el.parentElement) {
    const label = el.parentElement.querySelector('.label');
    if (label) label.textContent = 'Protection streak 🔥';
    el.textContent = s.n + ' day' + (s.n > 1 ? 's' : '');
  }
})();

/* ================= MORE SCAM PATTERNS (India 2024-26 wave) ================= */
SCAM_PATTERNS.push(
  { re: /\.apk\b/i, w: 45, tag: 'APK file attached/linked — wedding-invite & bank APK malware wave; NEVER install' },
  { re: /(fastag|fast tag).{0,40}(recharge|expire|kyc|block)/i, w: 30, tag: 'FASTag scam pattern' },
  { re: /(traffic|e-?challan).{0,40}(pay|pending|fine|link)/i, w: 30, tag: 'Fake traffic e-challan message' },
  { re: /(gas|lpg|cylinder).{0,40}(subsidy|kyc|block|update)/i, w: 28, tag: 'LPG subsidy/KYC scam' },
  { re: /(wedding|shaadi|invitation).{0,40}(card|link|download)/i, w: 30, tag: 'Wedding-invitation link malware pattern' },
  { re: /(telegram|whatsapp).{0,30}(admin|manager).{0,40}(salary|payment|task)/i, w: 32, tag: 'Fake employer task scam' },
  { re: /\+(92|234|880|84|62)\d/, w: 25, tag: 'Foreign number prefix commonly used in scam calls/messages' },
  { re: /(video call|whatsapp call).{0,50}(record|viral|delete|money)/i, w: 40, tag: 'Sextortion escalation pattern — do not pay, report 1930' }
);

/* ================= MORE ASSISTANT INTENTS ================= */
INTENTS.unshift(
  { k: /flood|earthquake|cyclone|disaster|landslide|baadh|bhookamp/i,
    a: 'Move to high/open ground as appropriate and follow local authority instructions. District disaster control: 1077. Ambulance: 108. Emergency: 112. Keep your phone charged and Family Live on so your family can track you.',
    b: [['📞 Call 1077', "location.href='tel:1077'"], ['🛰️ Family Live', "go('circle')"]] },
  { k: /train|railway|coach|station/i,
    a: 'Railway helpline 139 handles security, medical, and coach issues on trains — they can dispatch help to your exact coach at the next station. RPF security: also 139.',
    b: [['📞 Call 139', "location.href='tel:139'"]] },
  { k: /gas leak|lpg leak|cylinder leak/i,
    a: 'Don\'t switch anything on/off — no lights, no fans, no phones near the leak. Open windows, leave, then call. LPG emergency: 1906 (24×7).',
    b: [['📞 Call 1906', "location.href='tel:1906'"]] }
);

/* ================= HINDI FOR NEWER FEATURES ================= */
Object.assign(I18N.hi, {
  weather: 'मौसम', battery: 'बैटरी गार्जियन',
  walkme: 'वॉक विद मी', walkmep: 'लाइव एस्कॉर्ट मोड: अंगूठा स्क्रीन पर रखें। छोड़ने पर गार्जियन पूछता है — जवाब न मिलने पर मदद बुलाई जाती है।',
  stimer: 'सेफ्टी टाइमर — "मुझे तब तक सुरक्षित होना चाहिए…"', timerstart: 'शुरू करें',
  timerhint: 'समय पर खुद को सुरक्षित चिह्नित न करने पर गार्जियन चेक-इन करता है — फिर सर्कल को अलर्ट।',
  companion: 'AI साथी कॉल', escape: 'निकटतम सुरक्षित स्थान',
  scream: 'चीख पहचान', screamp: 'माइक्रोफ़ोन आवाज़ स्तर पर नज़र रखता है। तेज़ चीख पर चेक-इन।',
  shake: 'हिलाकर SOS', shakep: 'फ़ोन को 3 बार ज़ोर से हिलाएँ — चुपचाप इमरजेंसी शुरू।',
  strobe: 'स्ट्रोब बीकन', flash: 'चमक', torch: 'टॉर्च', torchp: 'असली कैमरा टॉर्च (Android Chrome)।',
  drill: 'SOS अभ्यास', practice: 'अभ्यास', autorec: 'स्वतः साक्ष्य रिकॉर्डिंग',
  burst: 'फोटो साक्ष्य बर्स्ट', burstp: 'आपातकाल में पिछला कैमरा हर 20 सेकंड में फोटो लेता है।',
  voicechk: 'आवाज़ से चेक-इन जवाब', voicechkp: 'चेक-इन आने पर बस "I\'m okay" बोलें — फ़ोन छूने की ज़रूरत नहीं।',
  silent: 'साइलेंट SOS:', silentp: 'घड़ी (ऊपर-दाएँ) को 3 सेकंड दबाए रखें — कुछ दिखेगा नहीं, पर रिकॉर्डिंग और अलर्ट शुरू।',
  ice: 'आपातकालीन मेडिकल कार्ड', icep: 'ऑफ़लाइन ICE कार्ड — ब्लड ग्रुप, एलर्जी — प्रथम उत्तरदाताओं के लिए।',
  tips: 'सेफ्टी प्लेबुक', tipsp: 'व्यावहारिक सुरक्षा ज्ञान: कैब, रात की सैर, ऑनलाइन सुरक्षा।',
  install: 'इस फ़ोन पर Raksha AI इंस्टॉल करें',
  m_brain: 'गार्जियन ब्रेन', m_brainp: 'देखें कि AI क्या देखता है: लाइव सेंसर फ्यूज़न, ख़तरा मीटर, और तर्क लॉग। यह आपकी सामान्य जगहें और समय भी सीखता है — पूरी तरह डिवाइस पर।',
  m_asst: 'गार्जियन असिस्टेंट', m_asstp: 'कुछ भी पूछें: "कोई मेरा पीछा कर रहा है", "KYC मैसेज आया है"। तुरंत मार्गदर्शन + वन-टैप एक्शन। ऑफ़लाइन काम करता है।',
  famlive: 'फैमिली लाइव (रीयल-टाइम)', famgo: 'परिवार के साथ लाइव जाएँ',
  famgop: 'चालू रहने पर हर 15 सेकंड में आपकी स्थिति साझा होती है।',
  famshare: 'परिवार को आमंत्रित करें', famqr: 'फैमिली QR', genqr: 'QR बनाएँ',
  volshield: 'वालंटियर शील्ड — शहर अलर्ट नेटवर्क', volbe: '🦺 वालंटियर बनें', volbc: '📡 मेरा SOS शहर के वालंटियर्स को भेजें',
  crumbs: 'ब्रेडक्रम्ब ट्रेल (मार्ग का साक्ष्य)', viewtrail: 'ट्रेल देखें', gpx: 'GPX निर्यात', cleartrail: 'हटाएँ',
  cablog: '🚖 कैब लॉगर — बैठने से पहले', logcab: 'लॉग करें और परिवार को बताएँ',
  syscheck: '🩺 गार्जियन सिस्टम चेक', runcheck: 'पूरी जाँच चलाएँ',
  pinstop: 'इमरजेंसी रोकने के लिए PIN ज़रूरी', pinstopp: 'हमलावर आपका SOS रद्द नहीं कर सकता।',
  autocall: 'SOS पर प्राथमिक संपर्क को स्वतः कॉल', autocallp: 'इमरजेंसी शुरू होने के 5 सेकंड बाद फ़ोन खुद डायल करता है।',
  sosmsg: 'कस्टम SOS संदेश', zones: 'सुरक्षित क्षेत्र (घर, दफ़्तर…)', addzone: 'यहाँ सहेजें',
  duress: 'ड्यूरेस PIN (डिकॉय वॉल्ट)', setduress: 'ड्यूरेस PIN सेट करें',
  backup: 'बैकअप और पुनर्स्थापना', exportd: 'निर्यात', importd: 'पुनर्स्थापित',
  stealth: 'स्टेल्थ लॉन्च', stealthp: 'ऐप हमेशा कैलकुलेटर के रूप में खुलता है। PIN फिर "=" से अनलॉक।',
  icewall: '🖼️ लॉक-स्क्रीन वॉलपेपर बनाएँ', sharewk: '📤 परिवार को सुरक्षा रिपोर्ट भेजें',
  send: 'भेजें', threat: 'एकीकृत ख़तरा स्तर', brainlog: 'तर्क लॉग — गार्जियन ऐसा क्यों सोचता है',
  baseline: 'आपकी सीखी हुई बेसलाइन (डिवाइस पर)', routines: 'गार्जियन रूटीन — दैनिक चेक-इन', addrout: 'रूटीन जोड़ें',
});
applyLang();

/* ================= HINDI COMPANION LINES ================= */
if (typeof COMP_LINES !== 'undefined') {
  const hiLines = ['मैं आपके साथ हूँ। रास्ता कैसा दिख रहा है?', 'आप बहुत अच्छा कर रही हैं। मंज़िल दिखे तो बताइए।', 'मैं अब भी साथ हूँ। जब चाहें "all good" कहें।', 'सेंसर से सब देख रही हूँ। सब ठीक लग रहा है।'];
  const _origStartCompanion = startCompanion;
  startCompanion = function () {
    if (lang === 'hi') { COMP_LINES.length = 0; hiLines.forEach(l => COMP_LINES.push(l)); }
    _origStartCompanion();
  };
}

/* ================= SYSTEM CHECK ADDITIONS (camera + voices) ================= */
const _rSystemCheck = systemCheck;
systemCheck = async function () {
  await _rSystemCheck();
  const out = $('sysCheckResult');
  let cam = 'unknown';
  try { const st = await navigator.permissions.query({ name: 'camera' }); cam = st.state; } catch (e) {}
  const voices = 'speechSynthesis' in window ? speechSynthesis.getVoices().length : 0;
  out.innerHTML += `<div>${cam === 'granted' ? '✅' : '❌'} <b>Camera permission</b> <span style="color:var(--muted)">— ${cam} (photo burst & flashlight)</span></div>` +
    `<div>${voices > 0 ? '✅' : '❌'} <b>TTS voices</b> <span style="color:var(--muted)">— ${voices} installed</span></div>`;
};

/* ================= boot ================= */
brainLog('🛠️', 'v9 refinements online — trip re-planning, flashlight, auto-call, danger-zone alerts, full Hindi', 0);
