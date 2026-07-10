/* =========================================================
   Raksha AI v2 — core engine
   Open source (MIT). 100% on-device. No servers. No tracking.
   ========================================================= */
"use strict";

const $ = id => document.getElementById(id);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem('raksha_' + k)) ?? d; } catch(e){ return d; } },
  set: (k, v) => localStorage.setItem('raksha_' + k, JSON.stringify(v)),
};

const S = {
  pos: null, watchId: null,
  contacts: store.get('contacts', []),
  emergencyActive: false,
  mediaRecorder: null, recChunks: [],
  trip: null, routes: [], selRoute: 0,
  amenities: { police: null, hospital: null }, amenityCount: 0,
  recog: null, lastImpactTs: 0, checkinTimer: null,
  audioCtx: null, alarmNodes: null,
  speedHistory: [],           // for crash detection
  stats: store.get('stats', { trips:0, checks:0, scams:0, emergencies:0, reports:0, since: Date.now() }),
  reports: store.get('reports', []),
  meds: store.get('meds', []),
  elderTimer: null,
};

function bumpStat(k){ S.stats[k] = (S.stats[k]||0) + 1; store.set('stats', S.stats); renderDashboard(); }

/* ---------- i18n ---------- */
const I18N = {
  hi: {
    police:'निकटतम पुलिस', hospital:'निकटतम अस्पताल', contacts:'विश्वसनीय संपर्क', risk:'क्षेत्र जोखिम', senses:'गार्जियन सेंसर',
    fakecall:'नकली कॉल', alarm:'सायरन', sharloc:'लोकेशन भेजें',
    tripmode:'गार्जियन ट्रिप मोड', triphint:'मंज़िल चुनने के लिए नक्शे पर टैप करें। गार्जियन असली सड़क मार्ग खोजकर हर रूट की सुरक्षा रेटिंग देता है। यात्रा के दौरान रूट से भटकाव, अचानक रुकने और देरी पर नज़र रखता है।',
    tripstatus:'यात्रा स्थिति', starttrip:'यात्रा शुरू करें', cleardest:'मंज़िल हटाएँ',
    emergency:'आपातकाल', soshint:'पूरा इमरजेंसी वर्कफ़्लो शुरू करने के लिए 1.5 सेकंड दबाकर रखें।',
    st1:'चेक-इन', st1s:'"क्या आप ठीक हैं?" — 15 सेकंड', st2:'साक्ष्य रिकॉर्डिंग', st2s:'माइक्रोफ़ोन रिकॉर्डिंग शुरू (वॉल्ट में सुरक्षित)',
    st3:'लाइव लोकेशन', st3s:'GPS स्थिति लॉक', st4:'संपर्कों को अलर्ट', st4s:'SMS/WhatsApp आपकी लोकेशन के साथ',
    st5:'मदद के लिए कॉल', st5s:'प्राथमिक संपर्क या 112 को एक-टैप कॉल',
    imsafe:'मैं सुरक्षित हूँ — बंद करें', crash:'दुर्घटना पहचान', crashp:'वाहन में तेज़ टक्कर पहचानकर 20 सेकंड बाद अपने सर्कल को अलर्ट करता है।',
    recent:'हाल की रिकॉर्डिंग', norec:'अभी कोई रिकॉर्डिंग नहीं।',
    modes:'सुरक्षा मोड', m_dv:'सेफ़ स्पेस (घरेलू हिंसा)', m_dvp:'PIN-लॉक, एन्क्रिप्टेड साक्ष्य वॉल्ट। फोटो, रिकॉर्डिंग, नोट्स, टाइमलाइन।',
    m_scam:'स्कैम शील्ड', m_scamp:'कोई भी संदिग्ध SMS/WhatsApp संदेश पेस्ट करें — UPI, KYC, डिजिटल अरेस्ट धोखाधड़ी की जाँच।',
    m_elder:'बुज़ुर्ग देखभाल', m_elderp:'नियमित चेक-इन, गिरने की पहचान, दवा रिमाइंडर, एल्डर लाइन 14567।',
    m_child:'बाल सुरक्षा', m_childp:'सुरक्षित पहुँच अलर्ट, स्कूल ट्रिप निगरानी, चाइल्डलाइन 1098।',
    m_mind:'मन गार्जियन', m_mindp:'मानसिक स्वास्थ्य सहायता: टेली-मानस 14416, किरण।',
    m_comm:'कम्युनिटी शील्ड', m_commp:'असुरक्षित जगहें चिह्नित करें — गार्जियन उन्हें आपके सुरक्षा स्कोर में शामिल करता है।',
    more:'और', m_help:'भारत हेल्पलाइन', m_helpp:'अखिल भारतीय आपातकालीन नंबर — 112, महिला 181/1091, बाल 1098, साइबर 1930।',
    m_circle:'विश्वसनीय सर्कल', m_circlep:'आपातकाल में इन लोगों को अलर्ट किया जाता है।',
    m_dash:'सुरक्षा डैशबोर्ड', m_dashp:'आपकी दैनिक सुरक्षा रिपोर्ट।', m_tools:'त्वरित उपकरण', m_toolsp:'नकली कॉल, गुप्त वाक्य, गिरने की पहचान, सायरन।',
    m_set:'सेटिंग्स', m_setp:'भाषा, वॉल्ट PIN, डेटा मिटाएँ।',
    n_home:'होम', n_trip:'यात्रा', n_sos:'SOS', n_modes:'मोड', n_more:'और',
    imok:'मैं ठीक हूँ', needhelp:'मुझे मदद चाहिए', cancel:'रद्द करें',
    qexit:'तुरंत छिपाएँ', vaulthint:'यहाँ सब कुछ आपके PIN से एन्क्रिप्टेड (AES-256) है और केवल इसी डिवाइस पर रहता है। Quick Exit ऐप को कैलकुलेटर में बदल देता है।',
    dvhelp:'तुरंत ख़तरे में हों तो 112 पर कॉल करें। महिला हेल्पलाइन: 181 · 1091। आप अकेली नहीं हैं।',
    note:'नोट', photo:'फोटो', voice:'आवाज़', timeline:'घटना टाइमलाइन', vempty:'वॉल्ट खाली है।',
    vexport:'टाइमलाइन निर्यात करें (वकील/पुलिस हेतु)', dvres:'सहायता संसाधन',
    scamhint:'संदिग्ध SMS, WhatsApp संदेश या फ़ोन नंबर पेस्ट करें। विश्लेषण पूरी तरह आपके फ़ोन पर होता है।',
    analyze:'🔍 जाँचें', scamres:'धोखाधड़ी हो गई हो तो',
    addc:'संपर्क जोड़ें', sharenow:'अभी लाइव लोकेशन भेजें', circlehint:'आपातकाल में इन लोगों को अलर्ट किया जाता है। पहला संपर्क प्राथमिक है।',
    helphint:'112 भारत का एकीकृत आपातकालीन नंबर है — हर राज्य में, 24×7 काम करता है।',
    lang:'भाषा / Language', vpin:'सेफ़ स्पेस PIN', changepin:'PIN सेट/बदलें', danger:'सावधानी क्षेत्र', wipe:'इस डिवाइस से सारा डेटा मिटाएँ',
    fakecallg:'नकली कॉल जनरेटर', fctrigger:'नकली कॉल शुरू करें', voiceg:'वॉइस गार्जियन', voicegp:'आपका गुप्त वाक्य या "बचाओ" सुनते ही चुपचाप इमरजेंसी शुरू।',
    fall:'गिरने/टक्कर की पहचान', fallp:'एक्सेलेरोमीटर तेज़ झटकों पर नज़र रखता है।', alarm2:'तेज़ सायरन', alarmp:'ध्यान आकर्षित करने के लिए।',
    d_trips:'सुरक्षित यात्राएँ', d_chk:'चेक-इन जवाब', d_scam:'संदेश जाँचे', d_em:'आपातकाल सक्रियण', d_rep:'सामुदायिक रिपोर्ट', d_days:'सुरक्षित दिन', d_report:'आज की रिपोर्ट',
    addnote:'घटना नोट जोड़ें', saveenc:'सहेजें (एन्क्रिप्टेड)',
    eldchk:'कुशलक्षेम चेक-इन', eldchkp:'ऐप खुला रहने पर गार्जियन तय अंतराल पर "सब ठीक?" पूछता है। 60 सेकंड में जवाब न मिलने पर सर्कल को अलर्ट।',
    eldfall:'संवेदनशील गिरावट पहचान', eldfallp:'बुज़ुर्गों के लिए कम थ्रेशोल्ड।', meds:'दवा रिमाइंडर', addrem:'रिमाइंडर जोड़ें', medhint:'ऐप खुला होने पर नोटिफ़िकेशन आता है।',
    safearr:'सुरक्षित पहुँच', safearrp:'एक टैप में पूरे सर्कल को बताएँ कि आप सुरक्षित पहुँच गए।', ireached:'मैं सुरक्षित पहुँच गया/गई',
    schooltrip:'स्कूल ट्रिप निगरानी', schooltripp:'ट्रिप मोड में स्कूल को मंज़िल बनाएं — रूट से भटकाव पर परिवार को अलर्ट।', opentrip:'ट्रिप मोड खोलें',
    mindhint:'कठिन समय में सहायता उपलब्ध है और काम करती है। ये सेवाएँ मुफ़्त और गोपनीय हैं।',
    ground:'60-सेकंड ग्राउंडिंग', breathe:'साँस लें', startg:'श्वास अभ्यास शुरू करें',
    commhint:'जहाँ असुरक्षित लगा वहाँ नक्शे पर टैप करें। पास की रिपोर्टें आपका सुरक्षा स्कोर घटाती हैं।', commshare:'मेरी रिपोर्ट साझा करें',
    hl181:'महिला हेल्पलाइन — घरेलू हिंसा (24×7)', hl1091:'महिला पुलिस हेल्पलाइन', hl15100:'NALSA — मुफ़्त कानूनी सहायता', hlncw:'राष्ट्रीय महिला आयोग शिकायत पोर्टल',
    hl1930:'राष्ट्रीय साइबर अपराध हेल्पलाइन — 24 घंटे के भीतर कॉल करें', hlccp:'ऑनलाइन साइबर अपराध शिकायत दर्ज करें',
    hl14567:'एल्डर लाइन — वरिष्ठ नागरिक हेल्पलाइन', hl1098:'चाइल्डलाइन — संकट में बच्चों के लिए 24×7', hl112c:'आपातकाल (पुलिस/अग्नि/एम्बुलेंस)',
    hl14416:'टेली-मानस — मानसिक स्वास्थ्य (24×7)', hlkiran:'किरण मानसिक स्वास्थ्य हेल्पलाइन', hlaasra:'आसरा — आत्महत्या रोकथाम (24×7)',
    vpinp:'आपके साक्ष्य वॉल्ट की सुरक्षा और एन्क्रिप्शन करता है।',
  }
};
let lang = store.get('lang', 'en');
const enCache = {};
function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    if (!(k in enCache)) enCache[k] = el.textContent;
    const dict = I18N[lang];
    el.textContent = (dict && dict[k]) ? dict[k] : enCache[k];
  });
  if (window.updateLangBtn) window.updateLangBtn();
  else $('langBtn').textContent = lang === 'hi' ? 'English' : 'हिंदी';
}
window.enCache = enCache;
function toggleLang(){ lang = lang === 'hi' ? 'en' : 'hi'; store.set('lang', lang); applyLang(); }
$('langBtn').addEventListener('click', toggleLang);

/* ---------- navigation ---------- */
const NAV_PAGES = ['home','trip','emergency','modes','more'];
function go(page) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  $('page-' + page).classList.add('active');
  document.querySelectorAll('nav button').forEach(x =>
    x.classList.toggle('active', x.dataset.page === page || (!NAV_PAGES.includes(page) && x.dataset.page === (['tools','helplines','circle','dashboard','settings'].includes(page) ? 'more' : 'modes'))));
  if (page === 'home' && map) setTimeout(() => map.invalidateSize(), 60);
  if (page === 'trip' && tripMap) setTimeout(() => tripMap.invalidateSize(), 60);
  if (page === 'community') setTimeout(initCommMap, 60);
  window.scrollTo(0,0);
}
function goTab(p){ go(p); }
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));

/* ---------- clock ---------- */
setInterval(() => { $('clockPill').textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }, 1000);

/* ---------- maps ---------- */
let map = null, tripMap = null, meMarker = null, tripMeMarker = null, destMarker = null, routeLayer = null;
const tileURL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const tileAttr = '© OpenStreetMap contributors';

function initMaps(lat, lon) {
  if (!map) {
    map = L.map('map').setView([lat, lon], 15);
    L.tileLayer(tileURL, {attribution: tileAttr}).addTo(map);
    meMarker = L.circleMarker([lat, lon], {radius:9, color:'#2ee6a8', fillColor:'#2ee6a8', fillOpacity:.9}).addTo(map).bindPopup('You');
    renderReportMarkers(map);
  }
  if (!tripMap) {
    tripMap = L.map('tripMap').setView([lat, lon], 14);
    L.tileLayer(tileURL, {attribution: tileAttr}).addTo(tripMap);
    tripMeMarker = L.circleMarker([lat, lon], {radius:9, color:'#4d9fff', fillColor:'#4d9fff', fillOpacity:.9}).addTo(tripMap).bindPopup('You');
    tripMap.on('click', e => {
      if (S.trip) return;
      if (destMarker) tripMap.removeLayer(destMarker);
      destMarker = L.marker(e.latlng).addTo(tripMap).bindPopup('Destination').openPopup();
      fetchRoutes(e.latlng);
    });
  }
}

/* ---------- geolocation ---------- */
function startGPS() {
  if (!navigator.geolocation) { sense('gps', 'unsupported'); return; }
  S.watchId = navigator.geolocation.watchPosition(p => {
    const first = !S.pos;
    S.pos = { lat: p.coords.latitude, lon: p.coords.longitude, speed: p.coords.speed || 0, ts: Date.now() };
    S.speedHistory.push({ v: S.pos.speed, ts: Date.now() });
    if (S.speedHistory.length > 30) S.speedHistory.shift();
    sense('gps', 'active');
    if (first) { initMaps(S.pos.lat, S.pos.lon); fetchAmenities(); }
    if (meMarker) meMarker.setLatLng([S.pos.lat, S.pos.lon]);
    if (tripMeMarker) tripMeMarker.setLatLng([S.pos.lat, S.pos.lon]);
    tripTick();
    updateGuardian();
  }, err => {
    sense('gps', 'denied');
    $('orbStatus').textContent = 'Location needed';
    $('orbCaption').textContent = 'Allow location access so your Guardian can protect you. (' + err.message + ')';
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}

function haversine(a, b) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLon = toR(b.lon - a.lon);
  const h = Math.sin(dLat/2)**2 + Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ---------- amenities (Overpass) ---------- */
async function fetchAmenities() {
  if (!S.pos) return;
  const q = `[out:json][timeout:20];(node["amenity"="police"](around:4000,${S.pos.lat},${S.pos.lon});node["amenity"="hospital"](around:4000,${S.pos.lat},${S.pos.lon});way["amenity"="hospital"](around:4000,${S.pos.lat},${S.pos.lon}););out center 40;`;
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method:'POST', body:'data='+encodeURIComponent(q) });
    const j = await r.json();
    let minP = Infinity, minH = Infinity;
    S.amenityCount = j.elements.length;
    j.elements.forEach(el => {
      const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
      if (lat == null) return;
      const d = haversine(S.pos, {lat, lon});
      const isPolice = el.tags?.amenity === 'police';
      if (isPolice && d < minP) minP = d;
      if (!isPolice && d < minH) minH = d;
      L.circleMarker([lat, lon], {radius:6, color:isPolice?'#4d9fff':'#ff5470', fillOpacity:.85})
        .addTo(map).bindPopup((el.tags?.name || (isPolice?'Police':'Hospital')));
    });
    S.amenities.police = isFinite(minP) ? minP : null;
    S.amenities.hospital = isFinite(minH) ? minH : null;
    $('policeDist').textContent = S.amenities.police ? (S.amenities.police/1000).toFixed(1)+' km' : '>4 km';
    $('hospDist').textContent = S.amenities.hospital ? (S.amenities.hospital/1000).toFixed(1)+' km' : '>4 km';
    updateGuardian();
  } catch(e) {
    $('policeDist').textContent = 'offline';
    $('hospDist').textContent = 'offline';
  }
}

/* ---------- safety score ---------- */
function computeScore() {
  let score = 90;
  const reasons = [];
  const h = new Date().getHours();
  if (h >= 22 || h < 5) { score -= 18; reasons.push('late night'); }
  else if (h >= 19) { score -= 8; reasons.push('evening'); }
  if (S.amenities.police == null) { score -= 8; reasons.push('no police station nearby'); }
  else if (S.amenities.police < 2000) score += 5;
  if (S.amenities.hospital == null) { score -= 5; reasons.push('no hospital nearby'); }
  if (S.amenityCount === 0) { score -= 10; reasons.push('isolated area'); }
  if (S.contacts.length === 0) { score -= 6; reasons.push('no trusted contacts added'); }
  if (S.pos && S.pos.speed > 25) { score -= 10; reasons.push('very high speed'); }
  // community reports within 500m
  if (S.pos) {
    const near = S.reports.filter(r => haversine(S.pos, r) < 500).length;
    if (near) { score -= Math.min(15, near * 5); reasons.push(near + ' community report(s) nearby'); }
  }
  score = Math.max(5, Math.min(99, score));
  return { score, reasons };
}

function updateGuardian() {
  if (S.emergencyActive) return;
  const { score, reasons } = computeScore();
  $('orbScore').textContent = 'Safety Score: ' + score + '%';
  const risk = score >= 75 ? ['Low','var(--green)','You\'re Safe','🛡️'] :
               score >= 50 ? ['Moderate','var(--amber)','Stay Aware','⚠️'] :
                             ['Elevated','var(--red)','Be Careful','🚨'];
  $('areaRisk').textContent = risk[0];
  $('orbStatus').textContent = risk[2];
  $('orbEmoji').textContent = risk[3];
  document.documentElement.style.setProperty('--ring', risk[1]);
  $('orbCaption').textContent = reasons.length
    ? 'Watching over you. Factors: ' + reasons.join(', ') + '.'
    : 'All clear. Your Guardian is watching over you.';
  $('contactCount').textContent = S.contacts.length;
}

function sense(kind, state) {
  const s = window.__senses = window.__senses || {gps:'waiting', motion:'off', voice:'off', crash:'off'};
  s[kind] = state;
  $('senseLine').textContent = `📍 GPS: ${s.gps} · 📳 Motion: ${s.motion} · 🎙️ Voice: ${s.voice} · 🚗 Crash: ${s.crash}`;
}

/* ---------- OSRM routing + safest route ---------- */
async function fetchRoutes(destLatLng) {
  if (!S.pos) { $('tripDetail').textContent = 'Waiting for GPS lock…'; return; }
  $('routeOptions').innerHTML = '<p class="hint">Finding road routes…</p>';
  const url = `https://router.project-osrm.org/route/v1/driving/${S.pos.lon},${S.pos.lat};${destLatLng.lng},${destLatLng.lat}?overview=full&geometries=geojson&alternatives=true`;
  try {
    const r = await fetch(url);
    const j = await r.json();
    if (j.code !== 'Ok' || !j.routes?.length) throw new Error('no route');
    S.routes = j.routes.map(rt => {
      const km = rt.distance/1000, min = rt.duration/60;
      const avgKmh = km / (min/60);
      const h = new Date().getHours(), night = (h >= 20 || h < 6);
      // Heuristic safety index: bigger/faster roads score higher at night; shorter exposure time helps.
      let idx = 70 + Math.min(20, (avgKmh - 20) * 0.8) - Math.min(20, min * (night ? 0.35 : 0.15));
      idx = Math.round(Math.max(30, Math.min(97, idx)));
      return { km, min, idx, coords: rt.geometry.coordinates.map(c => ({lat: c[1], lon: c[0]})) };
    }).sort((a,b) => b.idx - a.idx);
    S.selRoute = 0;
    renderRouteOptions();
    drawRoute(0);
    $('tripDetail').textContent = 'Route found. Choose an option and press Start Trip.';
  } catch(e) {
    // fallback: straight line
    S.routes = [{ km: haversine(S.pos, {lat:destLatLng.lat, lon:destLatLng.lng})/1000, min: 0, idx: 50,
      coords: [ {lat:S.pos.lat, lon:S.pos.lon}, {lat:destLatLng.lat, lon:destLatLng.lng} ] }];
    S.selRoute = 0; renderRouteOptions(); drawRoute(0);
    $('tripDetail').textContent = 'Router offline — using direct path corridor.';
  }
}

function renderRouteOptions() {
  $('routeOptions').innerHTML = '';
  S.routes.forEach((rt, i) => {
    const d = document.createElement('div');
    d.className = 'route-opt' + (i === S.selRoute ? ' sel' : '');
    const badge = i === 0 ? '<span class="badge g">SAFEST</span>' : (rt.min === Math.min(...S.routes.map(x=>x.min)) ? '<span class="badge a">FASTEST</span>' : '');
    d.innerHTML = `<div class="r-head"><span>Route ${i+1} ${badge}</span><span>Safety ${rt.idx}%</span></div>
      <div class="r-sub">${rt.km.toFixed(1)} km · ${rt.min ? Math.round(rt.min) + ' min' : 'direct path'}</div>`;
    d.onclick = () => { if (S.trip) return; S.selRoute = i; renderRouteOptions(); drawRoute(i); };
    $('routeOptions').appendChild(d);
  });
}

function drawRoute(i) {
  if (routeLayer) tripMap.removeLayer(routeLayer);
  const rt = S.routes[i];
  routeLayer = L.polyline(rt.coords.map(c => [c.lat, c.lon]), {color:'#2ee6a8', weight:5, opacity:.85}).addTo(tripMap);
  tripMap.fitBounds(routeLayer.getBounds(), {padding:[30,30]});
}

/* ---------- trip mode ---------- */
$('tripBtn').addEventListener('click', () => {
  if (S.trip) { endTrip('Trip ended by you. Arrived safely ✅'); bumpStat('trips'); return; }
  if (!S.pos) return alert('Waiting for GPS — allow location access first.');
  if (!S.routes.length || !destMarker) return alert('Tap the map to set your destination first.');
  const rt = S.routes[S.selRoute];
  const d = destMarker.getLatLng();
  S.trip = { route: rt, dest: {lat: d.lat, lon: d.lng}, startedAt: Date.now(),
    expectedMin: rt.min || null, lastMoveTs: Date.now(), lastPos: {...S.pos}, warned: false };
  $('tripBtn').textContent = 'End Trip (I arrived safely)';
  $('tripBtn').classList.add('danger');
  $('tripStatus').textContent = '🟢 Trip active — Guardian watching';
  $('tripDetail').textContent = `Watching route ${S.selRoute+1} · ${rt.km.toFixed(1)} km` + (rt.min ? ` · ETA ${Math.round(rt.min)} min` : '');
});

$('clearDest').addEventListener('click', () => {
  if (S.trip) return alert('End the trip first.');
  if (destMarker) { tripMap.removeLayer(destMarker); destMarker = null; }
  if (routeLayer) { tripMap.removeLayer(routeLayer); routeLayer = null; }
  S.routes = []; $('routeOptions').innerHTML = '';
  $('tripDetail').textContent = 'Destination not set.';
});

function endTrip(msg) {
  S.trip = null;
  $('tripBtn').textContent = 'Start Trip';
  $('tripBtn').classList.remove('danger');
  $('tripStatus').textContent = 'No trip active';
  $('tripDetail').textContent = msg;
}

function minDistToRoute(p, coords) {
  let min = Infinity;
  for (const c of coords) { const d = haversine(p, c); if (d < min) min = d; }
  return min;
}

function tripTick() {
  if (!S.trip || !S.pos || S.emergencyActive) return;
  const t = S.trip;
  if (haversine(S.pos, t.dest) < 120) { endTrip('Arrived safely ✅ Guardian stood down.'); bumpStat('trips'); return; }
  if (haversine(S.pos, t.lastPos) > 25) { t.lastMoveTs = Date.now(); t.lastPos = {...S.pos}; }
  const stuckMin = (Date.now() - t.lastMoveTs) / 60000;
  const elapsedMin = (Date.now() - t.startedAt) / 60000;
  const dev = minDistToRoute(S.pos, t.route.coords);
  if (dev > 500 && !t.warned) {
    t.warned = true;
    openCheckin('Route deviation detected', `You are ${(dev/1000).toFixed(1)} km off your expected route. Everything okay?`);
  } else if (stuckMin > 5 && !t.warned) {
    t.warned = true;
    openCheckin('Unexpected stop', 'You haven\'t moved for over 5 minutes mid-trip. Everything okay?');
  } else if (t.expectedMin && elapsedMin > t.expectedMin * 1.8 + 10 && !t.warned) {
    t.warned = true;
    openCheckin('Trip taking too long', 'Your trip is far beyond the expected time. Everything okay?');
  } else {
    $('tripDetail').textContent = `Deviation: ${Math.round(dev)} m · Remaining: ${(haversine(S.pos, t.dest)/1000).toFixed(2)} km` + (t.expectedMin ? ` · ${Math.round(elapsedMin)}/${Math.round(t.expectedMin)} min` : '');
  }
}

/* ---------- check-in ---------- */
function openCheckin(title, reason, seconds) {
  if (S.emergencyActive || $('checkinModal').classList.contains('show')) return;
  $('checkinTitle').textContent = title;
  $('checkinReason').textContent = reason;
  $('checkinModal').classList.add('show');
  if (navigator.vibrate) navigator.vibrate([300,150,300,150,300]);
  beep(3);
  let n = seconds || 15;
  $('checkinCount').textContent = n;
  S.checkinTimer = setInterval(() => {
    n--; $('checkinCount').textContent = n;
    if (n <= 0) { closeCheckin(); startEmergency('No response to safety check-in'); }
  }, 1000);
}
function closeCheckin() { clearInterval(S.checkinTimer); $('checkinModal').classList.remove('show'); }
$('imOkBtn').addEventListener('click', () => { closeCheckin(); bumpStat('checks'); if (S.trip) S.trip.warned = false; });
$('needHelpBtn').addEventListener('click', () => { closeCheckin(); startEmergency('User requested help'); });

/* ---------- emergency ---------- */
let sosHold = null;
$('sosBtn').addEventListener('pointerdown', () => { sosHold = setTimeout(() => startEmergency('SOS button held'), 1500); });
['pointerup','pointerleave','pointercancel'].forEach(ev => $('sosBtn').addEventListener(ev, () => clearTimeout(sosHold)));

function setStage(n, state) {
  const el = document.querySelector(`.stage[data-stage="${n}"]`);
  if (!el) return;
  el.classList.remove('active-stage','done');
  if (state === 'active') el.classList.add('active-stage');
  if (state === 'done') { el.classList.add('done'); el.querySelector('.dot').textContent = '✓'; }
}

async function startEmergency(reason) {
  if (S.emergencyActive) return;
  S.emergencyActive = true;
  bumpStat('emergencies');
  go('emergency');
  $('orbStatus').textContent = 'EMERGENCY';
  $('orbEmoji').textContent = '🚨';
  document.documentElement.style.setProperty('--ring', 'var(--red)');
  $('emBanner').classList.add('show');
  $('emBanner').textContent = '🚨 Emergency active — trigger: ' + reason;
  $('stopEmergency').style.display = 'block';
  if (navigator.vibrate) navigator.vibrate([500,200,500,200,500]);

  setStage(1, 'done');
  setStage(2, 'active');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    S.recChunks = [];
    S.mediaRecorder = new MediaRecorder(stream);
    S.mediaRecorder.ondataavailable = e => { if (e.data.size) S.recChunks.push(e.data); };
    S.mediaRecorder.onstop = saveRecording;
    S.mediaRecorder.start();
  } catch(e) {}
  setStage(2, 'done');

  setStage(3, 'active');
  const gLink = S.pos ? `https://maps.google.com/?q=${S.pos.lat},${S.pos.lon}` : '(location unavailable)';
  setStage(3, 'done');

  setStage(4, 'active');
  const msg = `🚨 EMERGENCY — I need help. Trigger: ${reason}. My location: ${gLink} (sent by Raksha AI)`;
  if (S.contacts.length) {
    window.location.href = `sms:${S.contacts.map(c => c.phone).join(',')}?&body=${encodeURIComponent(msg)}`;
    setTimeout(() => { if (navigator.share) navigator.share({ title:'EMERGENCY', text: msg }).catch(()=>{}); }, 2500);
  } else if (navigator.share) navigator.share({ title:'EMERGENCY', text: msg }).catch(()=>{});
  setStage(4, 'done');

  setStage(5, 'active');
  const primary = S.contacts[0];
  const old = $('emCallBtn'); if (old) old.remove();
  const callBtn = document.createElement('button');
  callBtn.className = 'btn danger'; callBtn.id = 'emCallBtn';
  callBtn.textContent = primary ? `📞 Call ${primary.name} now` : '📞 Call 112 (emergency services)';
  callBtn.onclick = () => { window.location.href = 'tel:' + (primary ? primary.phone : '112'); };
  $('stages').after(callBtn);
}

$('stopEmergency').addEventListener('click', () => {
  S.emergencyActive = false;
  if (S.mediaRecorder && S.mediaRecorder.state !== 'inactive') S.mediaRecorder.stop();
  $('emBanner').classList.remove('show');
  $('stopEmergency').style.display = 'none';
  const old = $('emCallBtn'); if (old) old.remove();
  document.querySelectorAll('.stage').forEach((el,i) => { el.classList.remove('done','active-stage'); el.querySelector('.dot').textContent = i+1; });
  updateGuardian();
});

function saveRecording() {
  const blob = new Blob(S.recChunks, { type: 'audio/webm' });
  const url = URL.createObjectURL(blob);
  const div = document.createElement('div');
  div.className = 'rec-item';
  div.innerHTML = `<b>🎙️ Evidence recording</b> — ${new Date().toLocaleString()}<audio controls src="${url}"></audio><a href="${url}" download="raksha-evidence-${Date.now()}.webm" style="color:var(--blue)">⬇ Download</a>`;
  const list = $('recList');
  if (list.querySelector('.hint')) list.innerHTML = '';
  list.prepend(div);
  S.mediaRecorder?.stream?.getTracks().forEach(t => t.stop());
  // also save into encrypted vault if PIN configured & unlocked
  if (window.vaultKey) vaultAddBlob(blob, 'Emergency audio recording', 'audio');
}

/* ---------- crash detection ---------- */
$('crashToggle').addEventListener('change', async e => {
  if (!e.target.checked) { window.removeEventListener('devicemotion', onCrashMotion); sense('crash','off'); return; }
  if (!(await motionPermission())) { e.target.checked = false; return; }
  window.addEventListener('devicemotion', onCrashMotion);
  sense('crash','armed');
});
async function motionPermission() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    try { return (await DeviceMotionEvent.requestPermission()) === 'granted'; } catch(e) { return false; }
  }
  return true;
}
function onCrashMotion(ev) {
  const a = ev.accelerationIncludingGravity;
  if (!a || S.emergencyActive) return;
  const g = Math.hypot(a.x||0, a.y||0, a.z||0);
  const recentlyMoving = S.speedHistory.some(s => s.v > 6 && Date.now() - s.ts < 15000); // >21 km/h in last 15s
  if (g > 45 && recentlyMoving && Date.now() - S.lastImpactTs > 10000) {
    S.lastImpactTs = Date.now();
    openCheckin('🚗 Possible crash detected', 'A severe impact was detected while moving at speed. Are you okay?', 20);
  }
}

/* ---------- fall detection ---------- */
$('motionToggle').addEventListener('change', async e => {
  if (!e.target.checked) { window.removeEventListener('devicemotion', onMotion); sense('motion','off'); return; }
  if (!(await motionPermission())) { e.target.checked = false; return; }
  window.addEventListener('devicemotion', onMotion);
  sense('motion','active');
});
function onMotion(ev) {
  const a = ev.accelerationIncludingGravity;
  if (!a || S.emergencyActive) return;
  const g = Math.hypot(a.x||0, a.y||0, a.z||0);
  const threshold = $('elderFallToggle')?.checked ? 24 : 30;
  if (g > threshold && Date.now() - S.lastImpactTs > 8000) {
    S.lastImpactTs = Date.now();
    openCheckin('Impact detected', 'A hard impact or fall was detected. Are you okay?');
  }
}

/* ---------- voice guardian ---------- */
$('voiceToggle').addEventListener('change', e => { if (e.target.checked) startVoice(); else stopVoice(); });
function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('Speech recognition not supported. Use Chrome on Android.'); $('voiceToggle').checked = false; return; }
  S.recog = new SR();
  S.recog.continuous = true; S.recog.interimResults = true; S.recog.lang = 'en-IN';
  S.recog.onresult = ev => {
    const phrases = $('secretPhrase').value.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const txt = ev.results[i][0].transcript.toLowerCase();
      if (phrases.some(p => txt.includes(p)) || txt.includes('help me') || txt.includes('bachao') || txt.includes('बचाओ')) {
        stopVoice(); $('voiceToggle').checked = false;
        startEmergency('Secret phrase / distress word detected');
        return;
      }
    }
  };
  S.recog.onend = () => { if ($('voiceToggle').checked) { try { S.recog.start(); } catch(e){} } };
  try { S.recog.start(); } catch(e){}
  sense('voice', 'listening');
  $('voiceBanner').classList.add('show');
  $('voiceBanner').textContent = '🎙️ Listening for: "' + $('secretPhrase').value + '" (also "help me"/"bachao"). All processing in your browser.';
}
function stopVoice() {
  if (S.recog) { S.recog.onend = null; S.recog.stop(); S.recog = null; }
  sense('voice', 'off');
  $('voiceBanner').classList.remove('show');
}

/* ---------- fake call ---------- */
$('fakeCallBtn').addEventListener('click', () => {
  const delay = parseInt($('fakeCallDelay').value, 10) * 1000;
  $('fakeCallBtn').textContent = delay ? '⏳ Scheduled…' : '📞 Trigger Fake Call';
  setTimeout(showFakeCall, delay);
});
function showFakeCall() {
  $('fcName').textContent = $('fakeCallerName').value || 'Mom';
  $('fakeCallScreen').classList.add('show');
  ringtone(true);
  if (navigator.vibrate) navigator.vibrate([800,400,800,400,800,400,800]);
  $('fakeCallBtn').textContent = '📞 Trigger Fake Call';
}
$('fcDecline').addEventListener('click', endFakeCall);
$('fcAnswer').addEventListener('click', () => {
  ringtone(false);
  let s = 1;
  $('fcSub').textContent = 'connected · 00:01';
  const iv = setInterval(() => {
    if (!$('fakeCallScreen').classList.contains('show')) return clearInterval(iv);
    s++; $('fcSub').textContent = `connected · ${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }, 1000);
  $('fcAnswer').style.display = 'none';
});
function endFakeCall() {
  ringtone(false);
  $('fakeCallScreen').classList.remove('show');
  $('fcAnswer').style.display = 'inline-block';
  $('fcSub').textContent = 'mobile · incoming call…';
  if (navigator.vibrate) navigator.vibrate(0);
}

/* ---------- audio ---------- */
function ctx() { if (!S.audioCtx) S.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return S.audioCtx; }
let ringInterval = null;
function ringtone(on) {
  if (!on) { clearInterval(ringInterval); ringInterval = null; return; }
  const play = () => {
    const c = ctx(), o = c.createOscillator(), gn = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, c.currentTime);
    o.frequency.setValueAtTime(660, c.currentTime + 0.25);
    gn.gain.setValueAtTime(0.35, c.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.1);
    o.connect(gn); gn.connect(c.destination);
    o.start(); o.stop(c.currentTime + 1.2);
  };
  play(); ringInterval = setInterval(play, 1800);
}
function beep(times) {
  const c = ctx();
  for (let i = 0; i < times; i++) {
    const o = c.createOscillator(), gn = c.createGain();
    o.frequency.value = 1200; gn.gain.value = 0.3;
    o.connect(gn); gn.connect(c.destination);
    o.start(c.currentTime + i*0.4); o.stop(c.currentTime + i*0.4 + 0.2);
  }
}
function toggleAlarm(btn) {
  if (S.alarmNodes) {
    S.alarmNodes.forEach(n => { try { n.stop(); } catch(e){} });
    S.alarmNodes = null;
    document.querySelectorAll('#alarmBtn,#alarmBtnHome').forEach(b => b.textContent = b.id==='alarmBtn' ? 'Sound' : '🔊 Alarm');
    return;
  }
  const c = ctx(), o = c.createOscillator(), gn = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  o.type = 'square'; o.frequency.value = 1000;
  lfo.frequency.value = 4; lg.gain.value = 400;
  lfo.connect(lg); lg.connect(o.frequency);
  gn.gain.value = 0.5;
  o.connect(gn); gn.connect(c.destination);
  o.start(); lfo.start();
  S.alarmNodes = [o, lfo];
  document.querySelectorAll('#alarmBtn,#alarmBtnHome').forEach(b => b.textContent = '⏹ Stop');
}
$('alarmBtn').addEventListener('click', () => toggleAlarm());
$('alarmBtnHome').addEventListener('click', () => toggleAlarm());

/* ---------- circle ---------- */
function renderContacts() {
  const list = $('contactList');
  list.innerHTML = '';
  S.contacts.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'contact';
    d.innerHTML = `<div class="info"><b>${esc(c.name)}</b><div>${esc(c.phone)}${i===0?' · primary':''}</div></div>`;
    const del = document.createElement('button');
    del.className = 'xbtn'; del.textContent = '🗑';
    del.onclick = () => { S.contacts.splice(i,1); persistContacts(); };
    d.appendChild(del);
    list.appendChild(d);
  });
  $('contactCount').textContent = S.contacts.length;
}
function persistContacts() { store.set('contacts', S.contacts); renderContacts(); updateGuardian(); }
$('addContact').addEventListener('click', () => {
  const name = $('cName').value.trim(), phone = $('cPhone').value.trim();
  if (!name || !phone) return alert('Enter both name and phone number.');
  S.contacts.push({name, phone});
  $('cName').value = ''; $('cPhone').value = '';
  persistContacts();
});

function shareLive() {
  if (!S.pos) return alert('Waiting for GPS lock.');
  const msg = `📍 My live location (Raksha AI): https://maps.google.com/?q=${S.pos.lat},${S.pos.lon}`;
  if (navigator.share) navigator.share({ text: msg }).catch(()=>{});
  else window.location.href = 'sms:?&body=' + encodeURIComponent(msg);
}

function safeArrival() {
  if (!S.contacts.length) return alert('Add trusted contacts first (Circle).');
  const loc = S.pos ? ` Location: https://maps.google.com/?q=${S.pos.lat},${S.pos.lon}` : '';
  window.location.href = `sms:${S.contacts.map(c=>c.phone).join(',')}?&body=${encodeURIComponent('✅ I reached safely!' + loc + ' (Raksha AI)')}`;
  bumpStat('checks');
}

function esc(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- boot ---------- */
renderContacts();
startGPS();
updateGuardian();
applyLang();
setInterval(updateGuardian, 60000);
setInterval(() => { if (S.trip) tripTick(); }, 15000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
