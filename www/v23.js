/* =========================================================
   Raksha AI v23 — Home Safe
   Save your home once, then one tap: opens walking directions
   home, tells your circle you're on the way (Family Live), and
   lets you confirm safe arrival. A calm "get me home" button
   for late nights and unfamiliar areas.
   ========================================================= */
"use strict";

function homeGet() { try { return store.get('home', null); } catch (e) { return null; } }

function homeRender() {
  const el = $('homeSaved'); const h = homeGet();
  if (el) el.textContent = h
    ? '✅ Home saved: ' + (h.label || 'Home') + '  (' + h.lat.toFixed(4) + ', ' + h.lon.toFixed(4) + ')'
    : 'No home saved yet — tap "Set current location as home" while you\'re at home.';
  const lab = $('homeLabel');
  if (lab && h && h.label && !lab.value) lab.value = h.label;
}

function saveHomeCurrent() {
  const commit = (la, lo) => {
    const label = (($('homeLabel') && $('homeLabel').value) || 'Home').trim() || 'Home';
    try { store.set('home', { lat: la, lon: lo, label }); } catch (e) {}
    homeRender();
    try { brainLog('🏠', 'Home location saved (' + label + ')', 0); } catch (e) {}
    alert('✅ Home saved on this device.');
  };
  try { if (S && S.pos) { commit(S.pos.lat, S.pos.lon); return; } } catch (e) {}
  if (!navigator.geolocation) return alert('Location isn\'t available on this device.');
  navigator.geolocation.getCurrentPosition(
    p => commit(p.coords.latitude, p.coords.longitude),
    () => alert('Could not get your location. Turn on GPS and try again.'),
    { enableHighAccuracy: true, timeout: 9000 });
}

function headHome() {
  const h = homeGet();
  if (!h) return alert('Set your home first — tap "Set current location as home" when you\'re at home.');
  let origin = '';
  try { if (S && S.pos) origin = S.pos.lat + ',' + S.pos.lon; } catch (e) {}
  const url = 'https://www.google.com/maps/dir/?api=1' +
    (origin ? '&origin=' + origin : '') +
    '&destination=' + h.lat + ',' + h.lon + '&travelmode=walking';
  window.open(url, '_blank');
  try { if (typeof famBroadcast === 'function') famBroadcast('ok', 'Heading home now' + (origin ? ' — live location on' : '')); } catch (e) {}
  try { brainLog('🏠', 'Heading home — walking directions opened', 0); } catch (e) {}
}

function imHome() {
  try { if (typeof famBroadcast === 'function') famBroadcast('ok', 'Reached home safely ✅'); } catch (e) {}
  try { if (typeof bumpStat === 'function') bumpStat('checks'); } catch (e) {}
  try { brainLog('🏠', 'Marked home safe', 0); } catch (e) {}
  alert('✅ Marked home safe. Your circle was notified if Family Live is on.');
}

/* ---------- Hindi ---------- */
if (typeof I18N !== 'undefined' && I18N.hi) Object.assign(I18N.hi, {
  homesafe: '🏠 होम सेफ',
  homesafep: 'अपना घर एक बार सेव करें। फिर एक टैप में घर तक पैदल दिशा-निर्देश खुलते हैं, आपके सर्कल को पता चलता है कि आप रास्ते में हैं, और पहुँचने पर आप पुष्टि कर सकते हैं।',
  homeset: '📍 वर्तमान स्थान को घर सेट करें', homego: '🏠 सुरक्षित घर जाएँ', homearr: '✅ मैं सुरक्षित घर पहुँच गया/गई',
});
if (typeof applyLang === 'function') applyLang();

/* ---------- init ---------- */
setTimeout(homeRender, 900);
try { brainLog('🏠', 'v23 online — Home Safe ready', 0); } catch (e) {}
