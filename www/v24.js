/* =========================================================
   Raksha AI v24 — Easier to use
   • Quick-actions bar at the very top of Home (one-tap SOS,
     WhatsApp SOS, Walk-with-me, Fake call, Share live, Helplines)
   • Welcome / getting-started strip with 3 quick steps
   • Plain-language Help overlay, reachable any time
   ========================================================= */
"use strict";

/* ---------- welcome strip ---------- */
function dismissHelp() {
  const s = $('helpStrip'); if (s) s.style.display = 'none';
  try { store.set('helpDismissed', true); } catch (e) {}
}
(function initHelpStrip() {
  try { if (store.get('helpDismissed', false)) { const s = $('helpStrip'); if (s) s.style.display = 'none'; } } catch (e) {}
})();

/* ---------- help overlay ---------- */
const HELP_SECTIONS = [
  ['🚨 In an emergency', 'Tap the red <b>SOS</b> at the top, or open Emergency and hold the SOS button 1.5 s. Raksha checks on you, records evidence, locks your location, and alerts your circle. You can also shake the phone or use the floating SOS bubble.'],
  ['💬 Reach people fast', '<b>WhatsApp SOS</b> and <b>Share live</b> send your live location to a trusted contact in one tap — useful when a call isn\'t safe.'],
  ['🚶‍♀️ Feeling unsafe walking', 'Use <b>Walk with me</b>: keep your thumb on the screen. If you let go and don\'t come back, help is called automatically.'],
  ['📞 Need an excuse to leave', '<b>Fake call</b> rings your phone with a realistic incoming call so you can step away from a bad situation.'],
  ['🤝 Meeting someone new', 'Open Quick Tools → <b>Meet Safe</b>. Log who and where; if you don\'t check in on time, your circle is alerted.'],
  ['🏠 Getting home', 'Quick Tools → <b>Home Safe</b>: save your home once, then one tap gives walking directions and tells your circle you\'re on the way.'],
  ['👥 Set up once', 'Add <b>Trusted Contacts</b> (they get your alerts), fill your <b>Emergency Medical Card</b>, and tap <b>Permissions</b> so everything works instantly when you need it.'],
  ['🔒 Your privacy', 'No account, no servers, no tracking. Your data stays encrypted on your phone. Location is shared only when you turn it on.'],
];

function openHelp() {
  const body = $('helpBody');
  if (body) {
    body.innerHTML = HELP_SECTIONS.map(s =>
      '<div style="margin:10px 0"><b>' + s[0] + '</b><div class="hint" style="margin-top:2px">' + s[1] + '</div></div>'
    ).join('');
  }
  const m = $('helpModal'); if (m) m.classList.add('show');
  try { brainLog('❓', 'Help opened', 0); } catch (e) {}
}
function closeHelp() { const m = $('helpModal'); if (m) m.classList.remove('show'); }

/* ---------- Hindi ---------- */
if (typeof I18N !== 'undefined' && I18N.hi) Object.assign(I18N.hi, {
  welcome: 'स्वागत है — आप सुरक्षित हैं', welcomep: '3 आसान चरणों में तैयार हो जाएँ। सरल गाइड के लिए कभी भी Help दबाएँ।',
  wsAdd: '① संपर्क जोड़ें', wsPerm: '② अनुमतियाँ', wsHelp: '❓ मदद',
  qatitle: 'त्वरित क्रियाएँ', qaSos: 'SOS', qaWa: 'WhatsApp SOS', qaWalk: 'मेरे साथ चलें',
  qaFake: 'नकली कॉल', qaShare: 'लाइव शेयर', qaHelp: 'हेल्पलाइन',
  helptitle: 'Raksha AI कैसे इस्तेमाल करें', helpintro: 'सब कुछ आपके फ़ोन पर चलता है — ज़रूरी चीज़ों के लिए कोई खाता या इंटरनेट नहीं चाहिए।',
});
if (typeof applyLang === 'function') applyLang();

try { brainLog('✨', 'v24 online — quick actions + help', 0); } catch (e) {}
