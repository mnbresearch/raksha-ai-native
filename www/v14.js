/* =========================================================
   Raksha AI v14 — practical life-savers
   Offline First-Aid guide, "Where am I?" reverse-geocoded
   address + spoken readout, test alert to circle,
   set-primary contact reordering.
   ========================================================= */
"use strict";

/* ================= OFFLINE FIRST-AID GUIDE ================= */
/* Basic, widely-accepted first-aid steps. Not a substitute for
   professional care — always call 108/112 first.               */
const FIRSTAID = [
  ['🫀 CPR (no breathing / no pulse)', [
    'Call 108/112 and shout for help. Ask someone to find an AED if available.',
    'Lay the person flat on their back on a firm surface.',
    'Place the heel of one hand in the centre of the chest, other hand on top, fingers interlocked.',
    'Push HARD and FAST: about 5–6 cm deep, 100–120 pushes per minute (to the beat of "Stayin\' Alive").',
    'Let the chest fully rise between pushes. Don\'t stop.',
    'If trained: give 2 rescue breaths after every 30 compressions. If not trained, keep doing continuous compressions.',
    'Continue until the person moves, help arrives, or you cannot continue.',
  ]],
  ['😮‍💨 Choking (adult/child, conscious)', [
    'Ask "Are you choking?" If they cannot speak, cough, or breathe — act now.',
    'Give up to 5 firm back blows between the shoulder blades with the heel of your hand.',
    'If that fails, do abdominal thrusts (Heimlich): stand behind, fist just above the navel, grasp with other hand, thrust sharply inward and upward.',
    'Alternate 5 back blows and 5 thrusts until the object clears.',
    'If they become unconscious, start CPR and call 108/112.',
    'For a pregnant or large person: give chest thrusts instead of abdominal.',
  ]],
  ['🩸 Severe bleeding', [
    'Call 108/112. Wear gloves or use a clean cloth/plastic to protect yourself.',
    'Press firmly and directly on the wound with a clean cloth or your hand.',
    'Keep pressing — do NOT keep lifting to check. Add more cloth on top if it soaks through.',
    'If possible, raise the injured part above heart level.',
    'Once bleeding slows, bind the pad firmly in place with a bandage or cloth strip.',
    'Only use a tight tourniquet above the wound for life-threatening limb bleeding that won\'t stop — note the time.',
    'Watch for shock: pale, cold, fast breathing — keep them warm and lying down.',
  ]],
  ['🔥 Burns', [
    'Move away from the source. For electrical burns, switch off power first.',
    'Cool the burn under cool (not ice-cold) running water for 20 minutes.',
    'Remove rings, watches, tight clothing near the area BEFORE it swells — unless stuck to the skin.',
    'Do NOT apply toothpaste, oil, butter, ghee, or ice. Do NOT burst blisters.',
    'Cover loosely with cling film or a clean, non-fluffy cloth.',
    'Call 108/112 for large, deep, facial, or electrical/chemical burns.',
  ]],
  ['🐍 Snakebite', [
    'Keep the person calm and STILL — movement spreads venom. Call 108/112 immediately.',
    'Keep the bitten limb below heart level and immobilise it like a fracture (splint).',
    'Remove rings, bangles, watches near the bite before swelling.',
    'Do NOT cut the wound, suck out venom, apply a tight tourniquet, or use ice or herbs.',
    'Note the time of the bite and the snake\'s appearance if safely seen — do not chase it.',
    'Get to a hospital with anti-venom fast. Most Indian snakebite deaths are preventable with timely care.',
  ]],
  ['⚡ Seizure / fits', [
    'Stay calm. Move hard or sharp objects away. Cushion the head with something soft.',
    'Do NOT hold them down and do NOT put anything (spoon, cloth, fingers) in the mouth.',
    'Gently turn them onto their side once jerking eases, to keep the airway clear.',
    'Time the seizure. Call 108/112 if it lasts over 5 minutes, repeats, or the person is injured, pregnant, diabetic, or doesn\'t wake up.',
    'Stay with them and reassure them as they recover — they may be confused.',
  ]],
  ['💔 Heart attack signs', [
    'Signs: chest pressure/pain (may spread to arm, jaw, back), sweating, nausea, shortness of breath. Women may have subtler symptoms.',
    'Call 108/112 immediately — say "possible heart attack".',
    'Help the person sit down, rest, and stay calm.',
    'If they are not allergic and it\'s available, an aspirin (300 mg) chewed slowly can help — only if conscious and able to swallow.',
    'If they collapse and stop breathing, start CPR.',
  ]],
  ['🌊 Drowning / rescued from water', [
    'Get them out of the water safely — don\'t become a second victim; use a pole, rope, or float.',
    'Call 108/112. Check for breathing.',
    'If not breathing, start CPR immediately — begin with 5 rescue breaths if trained, then compressions.',
    'Turn onto the side if they vomit (common).',
    'Keep them warm — remove wet clothes, cover with dry cloth.',
    'Everyone rescued from drowning needs a hospital check, even if they seem fine (secondary drowning).',
  ]],
  ['🤕 Fracture / suspected broken bone', [
    'Do not move the person unless they\'re in danger. Call 108/112 for major injuries.',
    'Support the injured part in the position found — do not try to straighten it.',
    'Immobilise with a splint (rolled newspaper, board) padded with cloth, tied above and below the break.',
    'Apply a cold pack wrapped in cloth to reduce swelling.',
    'For an open fracture, cover the wound with a clean cloth first; do not push bone back.',
  ]],
  ['🥵 Heat stroke', [
    'Signs: very hot skin, confusion, no sweating, fast pulse, collapse. This is life-threatening.',
    'Call 108/112. Move to shade / a cool place immediately.',
    'Cool them FAST: remove excess clothing, wet the skin, fan, place cold packs at neck, armpits, groin.',
    'If conscious and alert, give sips of water.',
    'Do not give fever medicine — it won\'t help heat stroke.',
  ]],
];
function renderFirstAid() {
  const q = ($('faSearch').value || '').toLowerCase();
  const l = $('firstaidList');
  l.innerHTML = '';
  FIRSTAID.filter(([t, steps]) => !q || (t + steps.join(' ')).toLowerCase().includes(q)).forEach(([title, steps]) => {
    const d = document.createElement('div');
    d.className = 'card wide';
    d.style.marginTop = '10px';
    d.innerHTML = `<div class="value" style="font-size:15px">${title}</div><ol style="margin:8px 0 0 18px;font-size:13.5px;line-height:1.6;color:var(--muted)">${steps.map(s => '<li style="margin:4px 0">' + esc(s) + '</li>').join('')}</ol>` +
      `<button class="btn small secondary" style="margin-top:8px" onclick="speakSteps(${FIRSTAID.indexOf(FIRSTAID.find(f => f[0] === title))})">🔊 Read steps aloud</button>`;
    l.appendChild(d);
  });
  if (!l.children.length) l.innerHTML = '<p class="hint">No match. Try: CPR, choking, bleeding, burn, snake, seizure, heart, drowning, fracture, heat.</p>';
}
function speakSteps(i) {
  const [title, steps] = FIRSTAID[i];
  try {
    speechSynthesis.cancel();
    speak(title.replace(/[^\w\s]/g, '') + '. ' + steps.join('. Next. '));
  } catch (e) {}
}

/* ================= WHERE AM I? (reverse geocode, free Nominatim) ================= */
let lastAddress = '';
async function whereAmI() {
  if (!S.pos) return alert('Waiting for GPS lock.');
  $('whereAddr').textContent = 'Finding your address…';
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${S.pos.lat}&lon=${S.pos.lon}&zoom=18`, {
      headers: { 'Accept': 'application/json' }
    });
    const j = await r.json();
    lastAddress = j.display_name || (S.pos.lat.toFixed(5) + ', ' + S.pos.lon.toFixed(5));
    $('whereAddr').textContent = '📍 ' + lastAddress;
    brainLog('📍', 'Address resolved', 0);
  } catch (e) {
    lastAddress = S.pos.lat.toFixed(5) + ', ' + S.pos.lon.toFixed(5);
    $('whereAddr').textContent = '📍 ' + lastAddress + ' (address service offline)';
  }
}
function speakAddr() {
  if (!lastAddress) { whereAmI().then(() => setTimeout(speakAddr, 1500)); return; }
  try { speak('Your current location is: ' + lastAddress); } catch (e) {}
}

/* ================= TEST ALERT TO CIRCLE ================= */
function sendTestAlert() {
  if (!S.contacts.length) return alert('Add trusted contacts first.');
  const loc = S.pos ? ` My location: https://maps.google.com/?q=${S.pos.lat},${S.pos.lon}` : '';
  const msg = `✅ TEST ALERT from Raksha AI — this is only a test, I am safe. (Checking that emergency messages reach you.)${loc}`;
  if (confirm('This sends a TEST message to your ' + S.contacts.length + ' contact(s) so you can confirm the alert chain works. Tell them it\'s a test. Continue?')) {
    window.location.href = `sms:${S.contacts.map(c => c.phone).join(',')}?&body=${encodeURIComponent(msg)}`;
    // also test family + telegram if configured
    try { if ($('famToggle') && $('famToggle').checked) famPublish('ok', 'Test alert (safe)'); } catch (e) {}
    try { tgSend('✅ Raksha AI test alert — the person is safe, verifying alerts work.'); } catch (e) {}
    brainLog('✅', 'Test alert sent to circle', 0);
  }
}

/* ================= SET-PRIMARY CONTACT REORDERING ================= */
const _v14RenderContacts = renderContacts;
renderContacts = function () {
  _v14RenderContacts();
  const list = $('contactList');
  if (!list) return;
  [...list.children].forEach((row, i) => {
    if (i === 0 || row.querySelector('.mkprimary')) return;
    const btn = document.createElement('button');
    btn.className = 'xbtn mkprimary';
    btn.title = 'Make primary';
    btn.textContent = '⬆';
    btn.style.color = 'var(--green)';
    btn.onclick = () => {
      const c = S.contacts.splice(i, 1)[0];
      S.contacts.unshift(c);
      persistContacts();
    };
    row.appendChild(btn);
  });
};
renderContacts();

/* ================= show Where-am-I card once GPS ready ================= */
setInterval(() => {
  const card = $('whereCard');
  if (card && S.pos && $('whereAddr').textContent === 'Tap to find your address' && !window.__whereAuto) {
    window.__whereAuto = true; // leave it for manual tap; just ensure visible
  }
}, 5000);

/* ================= boot ================= */
renderFirstAid();
brainLog('➕', 'v14 online — offline First-Aid guide, Where-am-I address, test alert, contact reordering', 0);
