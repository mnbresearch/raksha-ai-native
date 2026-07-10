/* =========================================================
   Raksha AI v15 — multi-language for India
   Adds Tamil, Telugu, Bengali, Marathi for the critical
   safety strings (nav, emergency, key labels), plus a
   language picker. Untranslated strings fall back to English.
   ========================================================= */
"use strict";

/* Critical safety strings translated into 4 more Indian languages.
   English is used automatically for anything not listed here. */
Object.assign(I18N, {
  ta: { // Tamil
    n_home:'முகப்பு', n_trip:'பயணம்', n_sos:'SOS', n_modes:'முறைகள்', n_more:'மேலும்',
    police:'அருகில் காவல்', hospital:'அருகில் மருத்துவமனை', contacts:'நம்பகமான தொடர்புகள்', risk:'பகுதி ஆபத்து',
    emergency:'அவசரநிலை', imok:'நான் நலம்', needhelp:'எனக்கு உதவி வேண்டும்', imsafe:'நான் பாதுகாப்பு — நிறுத்து',
    starttrip:'பயணம் தொடங்கு', addc:'தொடர்பைச் சேர்', fakecall:'போலி அழைப்பு', alarm:'அலாரம்', sharloc:'இருப்பிடம் பகிர்',
    companion:'AI துணை அழைப்பு', escape:'அருகில் பாதுகாப்பான இடம்', firstaid:'முதலுதவி வழிகாட்டி', modes:'பாதுகாப்பு முறைகள்',
    more:'மேலும்', soshint:'முழு அவசர செயல்முறையைத் தொடங்க 1.5 வினாடிகள் அழுத்திப் பிடிக்கவும்.',
  },
  te: { // Telugu
    n_home:'హోమ్', n_trip:'ప్రయాణం', n_sos:'SOS', n_modes:'మోడ్‌లు', n_more:'మరిన్ని',
    police:'సమీప పోలీస్', hospital:'సమీప ఆసుపత్రి', contacts:'విశ్వసనీయ పరిచయాలు', risk:'ప్రాంత ప్రమాదం',
    emergency:'అత్యవసరం', imok:'నేను క్షేమం', needhelp:'నాకు సహాయం కావాలి', imsafe:'నేను సురక్షితం — ఆపు',
    starttrip:'ప్రయాణం ప్రారంభించు', addc:'పరిచయాన్ని జోడించు', fakecall:'నకిలీ కాల్', alarm:'అలారం', sharloc:'లొకేషన్ షేర్',
    companion:'AI సహచర కాల్', escape:'సమీప సురక్షిత స్థలం', firstaid:'ప్రథమ చికిత్స గైడ్', modes:'రక్షణ మోడ్‌లు',
    more:'మరిన్ని', soshint:'పూర్తి అత్యవసర ప్రక్రియను ప్రారంభించడానికి 1.5 సెకన్లు నొక్కి పట్టుకోండి.',
  },
  bn: { // Bengali
    n_home:'হোম', n_trip:'যাত্রা', n_sos:'SOS', n_modes:'মোড', n_more:'আরও',
    police:'কাছের পুলিশ', hospital:'কাছের হাসপাতাল', contacts:'বিশ্বস্ত পরিচিতি', risk:'এলাকা ঝুঁকি',
    emergency:'জরুরি', imok:'আমি ঠিক আছি', needhelp:'আমার সাহায্য দরকার', imsafe:'আমি নিরাপদ — বন্ধ করুন',
    starttrip:'যাত্রা শুরু', addc:'পরিচিতি যোগ করুন', fakecall:'নকল কল', alarm:'অ্যালার্ম', sharloc:'অবস্থান শেয়ার',
    companion:'AI সঙ্গী কল', escape:'কাছের নিরাপদ স্থান', firstaid:'প্রাথমিক চিকিৎসা গাইড', modes:'সুরক্ষা মোড',
    more:'আরও', soshint:'সম্পূর্ণ জরুরি প্রক্রিয়া শুরু করতে ১.৫ সেকেন্ড চেপে ধরে রাখুন.',
  },
  mr: { // Marathi
    n_home:'होम', n_trip:'प्रवास', n_sos:'SOS', n_modes:'मोड', n_more:'अधिक',
    police:'जवळचे पोलीस', hospital:'जवळचे रुग्णालय', contacts:'विश्वासू संपर्क', risk:'क्षेत्र धोका',
    emergency:'आणीबाणी', imok:'मी ठीक आहे', needhelp:'मला मदत हवी', imsafe:'मी सुरक्षित आहे — थांबवा',
    starttrip:'प्रवास सुरू करा', addc:'संपर्क जोडा', fakecall:'बनावट कॉल', alarm:'अलार्म', sharloc:'स्थान शेअर करा',
    companion:'AI सोबती कॉल', escape:'जवळचे सुरक्षित ठिकाण', firstaid:'प्रथमोपचार मार्गदर्शक', modes:'संरक्षण मोड',
    more:'अधिक', soshint:'संपूर्ण आणीबाणी प्रक्रिया सुरू करण्यासाठी 1.5 सेकंद दाबून धरा.',
  },
});

const LANGS = [
  ['en', 'English', 'English'],
  ['hi', 'हिंदी', 'Hindi'],
  ['bn', 'বাংলা', 'Bengali'],
  ['ta', 'தமிழ்', 'Tamil'],
  ['te', 'తెలుగు', 'Telugu'],
  ['mr', 'मराठी', 'Marathi'],
];

window.updateLangBtn = function () {
  const cur = LANGS.find(l => l[0] === lang);
  $('langBtn').textContent = '🌐 ' + (cur ? cur[1] : 'English');
};

function openLangPicker() {
  const host = $('langOptions');
  host.innerHTML = '';
  LANGS.forEach(([code, native, eng]) => {
    const b = document.createElement('button');
    b.className = 'btn' + (code === lang ? '' : ' secondary');
    b.style.marginTop = '8px';
    b.textContent = native + '  ·  ' + eng + (code === lang ? '  ✓' : '');
    b.onclick = () => { setLang(code); $('langModal').classList.remove('show'); };
    host.appendChild(b);
  });
  $('langModal').classList.add('show');
}
function setLang(code) {
  lang = code;
  store.set('lang', code);
  applyLang();
  updateLangBtn();
}

/* replace the old toggle behaviour with the picker */
window.toggleLang = openLangPicker;
(function rewireLangBtn() {
  const btn = $('langBtn');
  const fresh = btn.cloneNode(true);      // strips app.js's toggle listener
  btn.parentNode.replaceChild(fresh, btn);
  fresh.addEventListener('click', openLangPicker);
  updateLangBtn();
})();

/* auto-pick from device language on first run (covers the new languages) */
if (!localStorage.getItem('raksha_lang')) {
  const dev = (navigator.language || '').toLowerCase().slice(0, 2);
  if (LANGS.some(l => l[0] === dev)) setLang(dev);
}

/* ================= boot ================= */
applyLang();
brainLog('🌐', 'v15 online — 6 languages: English, Hindi, Bengali, Tamil, Telugu, Marathi', 0);
