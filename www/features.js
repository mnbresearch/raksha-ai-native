/* =========================================================
   Raksha AI v3 — advanced guardian features
   Walk With Me, scream detection, battery guardian, shake-SOS,
   strobe beacon, safety timer, ICE card, weather, trip history,
   safety playbook, install prompt, app shortcuts, wake lock.
   ========================================================= */
"use strict";

/* ================= WAKE LOCK ================= */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch(e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (walkActive || S.trip || S.emergencyActive)) keepAwake(true);
});

/* ================= WALK WITH ME (deadman switch) ================= */
let walkActive = false, walkReleaseTimer = null;

$('walkBtn').addEventListener('pointerdown', () => {
  clearTimeout(walkReleaseTimer);
  if (!walkActive) startWalk();
  $('walkBtn').style.background = 'var(--green)';
  $('walkBtn').style.color = '#08101f';
  $('walkStatus').textContent = '🟢 Escorting — thumb detected';
  $('walkDetail').textContent = 'Guardian is walking with you. Scream detection + wake lock active.';
});
['pointerup','pointercancel','pointerleave'].forEach(ev => $('walkBtn').addEventListener(ev, () => {
  if (!walkActive) return;
  $('walkBtn').style.background = 'var(--card2)';
  $('walkBtn').style.color = 'var(--text)';
  $('walkStatus').textContent = '🟡 Thumb released…';
  $('walkDetail').textContent = 'Return your thumb within 3 seconds.';
  clearTimeout(walkReleaseTimer);
  walkReleaseTimer = setTimeout(() => {
    if (walkActive && !S.emergencyActive) openCheckin('Thumb released', 'You let go of the Walk With Me button. Everything okay?', 10);
  }, 3000);
}));

function startWalk() {
  walkActive = true;
  keepAwake(true);
  startScream(true);
  if (navigator.vibrate) navigator.vibrate(80);
}
function stopWalk() {
  if (!walkActive) return;
  walkActive = false;
  clearTimeout(walkReleaseTimer);
  keepAwake(false);
  if (!$('screamToggle').checked) stopScream();
  $('walkStatus').textContent = 'Not active';
  $('walkDetail').textContent = 'Press and hold the button to begin.';
  $('walkBtn').style.background = 'var(--card2)';
  $('walkBtn').style.color = 'var(--text)';
  bumpStat('checks');
}

/* ================= SCREAM / LOUD-NOISE DETECTION ================= */
let screamCtx = null, screamStream = null, screamRAF = null, loudSince = 0;
async function startScream(silent) {
  if (screamStream) return;
  try {
    screamStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    screamCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = screamCtx.createMediaStreamSource(screamStream);
    const an = screamCtx.createAnalyser();
    an.fftSize = 2048;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const loop = () => {
      if (!screamStream) return;
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i]-128)/128; sum += v*v; }
      const rms = Math.sqrt(sum / buf.length);
      if (rms > 0.45) {                       // very loud sustained sound
        if (!loudSince) loudSince = Date.now();
        else if (Date.now() - loudSince > 700 && !S.emergencyActive && !$('checkinModal').classList.contains('show')) {
          loudSince = 0;
          openCheckin('📢 Loud noise detected', 'A scream or very loud sound was detected. Are you okay?', 12);
        }
      } else loudSince = 0;
      screamRAF = requestAnimationFrame(loop);
    };
    loop();
    sense('voice', 'scream-watch');
    if (!silent) alert('Scream detection active. All audio analysis stays on your phone — nothing is recorded or uploaded.');
  } catch(e) { $('screamToggle').checked = false; alert('Microphone access needed for scream detection.'); }
}
function stopScream() {
  cancelAnimationFrame(screamRAF);
  if (screamStream) { screamStream.getTracks().forEach(t => t.stop()); screamStream = null; }
  if (screamCtx) { screamCtx.close().catch(()=>{}); screamCtx = null; }
  if (!S.recog) sense('voice', 'off');
}
$('screamToggle').addEventListener('change', e => e.target.checked ? startScream() : (walkActive ? null : stopScream()));

/* ================= SHAKE TO SOS ================= */
let shakeTimes = [];
$('shakeToggle').addEventListener('change', async e => {
  if (!e.target.checked) { window.removeEventListener('devicemotion', onShake); return; }
  if (!(await motionPermission())) { e.target.checked = false; return; }
  window.addEventListener('devicemotion', onShake);
});
function onShake(ev) {
  const a = ev.acceleration;
  if (!a || S.emergencyActive) return;
  const g = Math.hypot(a.x||0, a.y||0, a.z||0);
  const now = Date.now();
  if (g > 22 && (!shakeTimes.length || now - shakeTimes[shakeTimes.length-1] > 180)) {
    shakeTimes.push(now);
    shakeTimes = shakeTimes.filter(t => now - t < 1600);
    if (shakeTimes.length >= 3) { shakeTimes = []; startEmergency('Shake-to-SOS triggered'); }
  }
}

/* ================= STROBE BEACON ================= */
let strobeIv = null;
function startStrobe() {
  const o = $('strobeOverlay');
  o.style.display = 'block';
  let on = true;
  strobeIv = setInterval(() => { on = !on; o.style.background = on ? '#fff' : '#000'; }, 90);
  keepAwake(true);
}
function stopStrobe() {
  clearInterval(strobeIv);
  $('strobeOverlay').style.display = 'none';
  if (!walkActive && !S.trip && !S.emergencyActive) keepAwake(false);
}

/* ================= SAFETY TIMER ================= */
let safeTimer = null, safeTimerEnd = 0, safeTimerIv = null;
$('timerBtn').addEventListener('click', () => {
  if (safeTimer) {   // acting as "I'm safe" button
    clearTimeout(safeTimer); clearInterval(safeTimerIv);
    safeTimer = null;
    $('timerBtn').textContent = 'Start';
    $('timerBtn').classList.remove('danger');
    $('timerStatus').textContent = '✅ Marked safe. Timer cleared.';
    bumpStat('checks');
    return;
  }
  const mins = parseInt($('timerMins').value, 10);
  safeTimerEnd = Date.now() + mins * 60000;
  safeTimer = setTimeout(() => {
    safeTimer = null;
    $('timerBtn').textContent = 'Start';
    $('timerBtn').classList.remove('danger');
    openCheckin('⏰ Safety timer expired', 'You didn\'t mark yourself safe in time. Everything okay?', 30);
  }, mins * 60000);
  $('timerBtn').textContent = "✅ I'm safe";
  $('timerBtn').classList.add('danger');
  safeTimerIv = setInterval(() => {
    if (!safeTimer) return clearInterval(safeTimerIv);
    const left = Math.max(0, safeTimerEnd - Date.now());
    $('timerStatus').textContent = `⏳ ${Math.floor(left/60000)}m ${Math.floor(left%60000/1000)}s left — tap "I'm safe" when you arrive.`;
  }, 1000);
});

/* ================= BATTERY GUARDIAN ================= */
let lowBattWarned = false;
if (navigator.getBattery) {
  navigator.getBattery().then(b => {
    const upd = () => {
      const pct = Math.round(b.level * 100);
      $('batteryVal').textContent = (b.charging ? '⚡ ' : '🔋 ') + pct + '%' + (pct <= 15 && !b.charging ? ' — low!' : ' — armed');
      if (pct <= 15 && !b.charging && !lowBattWarned && S.contacts.length) {
        lowBattWarned = true;
        if (confirm('🔋 Battery at ' + pct + '%. Send your last known location to your trusted circle before the phone dies?')) {
          const loc = S.pos ? `https://maps.google.com/?q=${S.pos.lat},${S.pos.lon}` : '(no GPS fix)';
          window.location.href = `sms:${S.contacts.map(c=>c.phone).join(',')}?&body=${encodeURIComponent('🔋 My phone is at ' + pct + '% and may switch off. Last location: ' + loc + ' (Raksha AI)')}`;
        }
      }
      if (pct > 30) lowBattWarned = false;
    };
    b.addEventListener('levelchange', upd);
    b.addEventListener('chargingchange', upd);
    upd();
  });
} else { $('batteryVal').textContent = 'n/a'; }

/* ================= WEATHER (Open-Meteo, free) ================= */
let weatherPenalty = 0, weatherReason = '';
async function fetchWeather() {
  if (!S.pos) return;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${S.pos.lat}&longitude=${S.pos.lon}&current_weather=true`);
    const j = await r.json();
    const w = j.current_weather;
    if (!w) return;
    const code = w.weathercode;
    let label = '☀️ Clear';
    weatherPenalty = 0; weatherReason = '';
    if (code >= 95) { label = '⛈️ Thunderstorm'; weatherPenalty = 12; weatherReason = 'thunderstorm'; }
    else if (code >= 80 || (code >= 61 && code <= 67)) { label = '🌧️ Rain'; weatherPenalty = 7; weatherReason = 'rain'; }
    else if (code === 45 || code === 48) { label = '🌫️ Fog'; weatherPenalty = 6; weatherReason = 'low visibility (fog)'; }
    else if (code >= 71 && code <= 77) { label = '🌨️ Snow'; weatherPenalty = 8; weatherReason = 'snow'; }
    else if (code >= 1 && code <= 3) label = '⛅ Cloudy';
    $('weatherVal').textContent = `${label} · ${Math.round(w.temperature)}°C`;
    updateGuardian();
  } catch(e) { $('weatherVal').textContent = 'offline'; }
}
setInterval(fetchWeather, 15 * 60000);
const _origCompute = computeScore;
computeScore = function() {
  const r = _origCompute();
  if (weatherPenalty) { r.score = Math.max(5, r.score - weatherPenalty); r.reasons.push(weatherReason); }
  return r;
};
// first weather fetch once GPS locks
const weatherWaiter = setInterval(() => { if (S.pos) { clearInterval(weatherWaiter); fetchWeather(); } }, 2000);

/* ================= ICE CARD ================= */
function renderIce() {
  const ice = store.get('ice', null);
  if (!ice || !ice.name) { $('iceView').innerHTML = '<span class="hint">Not filled yet — add your details below.</span>'; return; }
  $('iceView').innerHTML =
    `<b style="font-size:18px">${esc(ice.name)}</b> ${ice.dob ? '· ' + esc(ice.dob) : ''}<br>` +
    (ice.blood ? `🩸 Blood group: <b style="color:var(--red)">${esc(ice.blood)}</b><br>` : '') +
    (ice.allergy ? `⚠️ Allergies: ${esc(ice.allergy)}<br>` : '') +
    (ice.conditions ? `🏥 Conditions: ${esc(ice.conditions)}<br>` : '') +
    (ice.meds ? `💊 Medications: ${esc(ice.meds)}<br>` : '') +
    (ice.contact ? `📞 Emergency contact: <b>${esc(ice.contact)}</b>` : '');
  ['iceName','iceBlood','iceDob','iceAllergy','iceConditions','iceMeds','iceContact'].forEach(id => {
    const k = id.slice(3).toLowerCase();
    if (ice[k] !== undefined) $(id).value = ice[k];
  });
}
function saveIce() {
  store.set('ice', {
    name: $('iceName').value.trim(), blood: $('iceBlood').value, dob: $('iceDob').value.trim(),
    allergy: $('iceAllergy').value.trim(), conditions: $('iceConditions').value.trim(),
    meds: $('iceMeds').value.trim(), contact: $('iceContact').value.trim(),
  });
  renderIce();
  alert('✅ ICE card saved on this device (works offline).');
}

/* ================= SAFETY PLAYBOOK ================= */
const TIPS = [
  ['🚕 Cabs & autos', [
    'Match the number plate, driver photo, and OTP before getting in — never board if they don\'t match.',
    'Share the trip from the cab app AND start Guardian Trip Mode.',
    'Sit behind the driver, not beside. Keep the window slightly open.',
    'If the route feels wrong, say your location aloud on a (real or fake) call: "Haan, main abhi X ke paas hoon."',
    'Late night? Note the plate before boarding and text it to a friend.',
  ]],
  ['🚶‍♀️ Walking at night', [
    'Use Walk With Me mode — deadman button + scream detection.',
    'Walk against traffic flow so cars approach you head-on.',
    'One earphone max. Awareness beats music.',
    'Choose lit main roads over dark shortcuts — Raksha\'s route safety index rates bigger roads higher at night.',
    'Keys between fingers is a myth that can injure you; a loud alarm + running is far more effective.',
  ]],
  ['📱 Phone & online', [
    'Never share OTP, UPI PIN, or CVV — banks and police NEVER ask.',
    'Approving a UPI collect request SENDS money, it doesn\'t receive it.',
    '"Digital arrest" video calls are always fake. Police don\'t arrest over video. Hang up, call 1930.',
    'Turn off location metadata when posting photos in real time.',
    'Video call requests from strangers → assume recording/sextortion. Never comply, never pay, report to 1930.',
  ]],
  ['🏠 Domestic safety', [
    'Document everything in the Safe Space vault — dates, photos, medical reports. Timelines win cases.',
    'Memorize two numbers: 181 (women helpline) and one trusted person.',
    'Keep a "go bag": documents, some cash, spare phone/SIM if possible.',
    'Protection orders under the DV Act 2005 don\'t require a lawyer — NALSA (15100) helps for free.',
  ]],
  ['🛡️ If confronted', [
    'Your goal is escape, not victory. Run toward light, people, and noise.',
    'Yell "FIRE!" — it draws more attention than "help".',
    'Give up belongings instantly; nothing you carry is worth your life.',
    'Target eyes, throat, knees, groin if you must strike — then run.',
    'Afterwards: 112 first, then preserve evidence (don\'t wash, don\'t delete).',
  ]],
  ['🚑 Accidents & medical', [
    'Fill your ICE card in Raksha — responders check phones for it.',
    'Good Samaritan law protects you when helping accident victims — you cannot be harassed for helping.',
    '1073 for road accidents, 108 for ambulance, 112 for everything.',
    'Learn the recovery position and CPR basics — 10 minutes of learning saves lives.',
  ]],
];
function renderTips() {
  const l = $('tipsList');
  l.innerHTML = '';
  TIPS.forEach(([title, items]) => {
    const d = document.createElement('div');
    d.className = 'card wide';
    d.style.marginTop = '10px';
    d.innerHTML = `<div class="value" style="font-size:15px">${title}</div><div class="hint" style="margin-top:8px">• ${items.map(esc).join('<br>• ')}</div>`;
    l.appendChild(d);
  });
}

/* ================= INSTALL PROMPT ================= */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  $('installBtn').style.display = 'block';
});
$('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('installBtn').style.display = 'none';
});

/* ================= APP SHORTCUTS (?action=…) ================= */
(function handleShortcut() {
  const action = new URLSearchParams(location.search).get('action');
  if (!action) return;
  setTimeout(() => {
    if (action === 'sos') startEmergency('Launched via SOS shortcut');
    else if (action === 'fakecall') showFakeCall();
    else if (action === 'walk') go('walk');
    else if (action === 'share') shareLive();
  }, 800);
})();

/* ================= TRIP HISTORY ================= */
const _origEndTrip = endTrip;
endTrip = function(msg) {
  if (S.trip && msg && msg.includes('safely')) {
    const hist = store.get('triphist', []);
    hist.unshift({ ts: Date.now(), km: S.trip.route.km });
    store.set('triphist', hist.slice(0, 30));
  }
  _origEndTrip(msg);
};
(function addHistCard(){
  const hist = store.get('triphist', []);
  if (!hist.length) return;
  const dash = $('dailyReport');
  if (dash) {
    const extra = document.createElement('div');
    extra.className = 'hint';
    extra.style.marginTop = '8px';
    extra.innerHTML = '<b>Recent safe trips:</b><br>' + hist.slice(0,5).map(h =>
      `✅ ${new Date(h.ts).toLocaleDateString()} · ${h.km.toFixed(1)} km`).join('<br>');
    dash.parentElement.appendChild(extra);
  }
})();

/* ================= WAKE LOCK ON TRIP/EMERGENCY ================= */
const _origStartEmergency = startEmergency;
startEmergency = function(reason) { keepAwake(true); _origStartEmergency(reason); };

/* ================= boot ================= */
renderIce();
renderTips();
