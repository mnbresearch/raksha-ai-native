/* =========================================================
   Raksha AI v13 — robustness & daily practicality
   Offline SOS queue, GPS watchdog + last-known location,
   global error capture, battery % in Family Live, one-tap
   trip shortcuts from saved zones, Night Shield bundle,
   large-text mode, online/offline awareness.
   ========================================================= */
"use strict";

/* ================= GLOBAL ERROR CAPTURE ================= */
/* A safety app must never die silently. Errors are logged to the
   Guardian Brain instead of killing the page.                    */
window.addEventListener('error', e => {
  try { brainLog('🐞', 'Recovered from error: ' + String(e.message).slice(0, 80), 0); } catch (x) {}
});
window.addEventListener('unhandledrejection', e => {
  try { brainLog('🐞', 'Recovered from async error: ' + String(e.reason).slice(0, 80), 0); } catch (x) {}
  e.preventDefault();
});

/* ================= ONLINE / OFFLINE AWARENESS ================= */
let isOnline = navigator.onLine;
window.addEventListener('offline', () => {
  isOnline = false;
  brainLog('📵', 'Connection lost — alerts will queue and send automatically when back online', 5);
});
window.addEventListener('online', () => {
  isOnline = true;
  brainLog('📶', 'Back online — flushing queued alerts', 0);
  flushQueue();
});

/* ================= OFFLINE SOS QUEUE (with retry) ================= */
/* Any emergency network send that fails is queued and retried —
   critical for dead zones, basements, and elevators.             */
const NETQ = store.get('netq', []);
function queuedFetch(url, opts, label) {
  return fetch(url, opts).then(r => {
    if (!r.ok && r.status >= 500) throw new Error('server ' + r.status);
    return r;
  }).catch(() => {
    NETQ.push({ url, opts: { method: opts.method || 'POST', body: typeof opts.body === 'string' ? opts.body : null, headers: opts.headers || {} }, label, ts: Date.now() });
    while (NETQ.length > 40) NETQ.shift();
    store.set('netq', NETQ);
    brainLog('📮', 'Queued (offline): ' + label, 0);
  });
}
async function flushQueue() {
  if (!NETQ.length) return;
  const pending = NETQ.splice(0, NETQ.length);
  store.set('netq', NETQ);
  let sent = 0;
  for (const q of pending) {
    if (Date.now() - q.ts > 6 * 3600000) continue;          // stale after 6 h
    if (!q.opts.body) continue;
    try { await fetch(q.url, q.opts); sent++; } catch (e) { NETQ.push(q); }
  }
  store.set('netq', NETQ);
  if (sent) brainLog('📮', 'Flushed ' + sent + ' queued alert(s)', 0);
}
setTimeout(flushQueue, 6000);
setInterval(() => { if (isOnline) flushQueue(); }, 120000);

/* route ALL family publishes through one robust sender:
   battery included, SOS messages queued+retried when offline */
const _qFamPublish = famPublish;   // v12 battery-saver wrapper (its gate still applies for non-SOS)
famPublish = function (status, reason) {
  if (store.get('battsave', false) && status !== 'SOS' && Date.now() - (window.__lastPubTs || 0) < 55000) return;
  window.__lastPubTs = Date.now();
  const topic = famTopic();
  if (!topic) return;
  const m = { n: $('famName').value.trim() || 'Me', s: status || 'ok', ts: Date.now() };
  if (S.pos) { m.la = +S.pos.lat.toFixed(5); m.lo = +S.pos.lon.toFixed(5); }
  if (reason) m.r = reason;
  if (window.__battPct != null) m.b = window.__battPct;
  const opts = { method: 'POST', body: JSON.stringify(m), headers: { 'Priority': status === 'SOS' ? 'urgent' : 'min' } };
  if (status === 'SOS') queuedFetch('https://ntfy.sh/' + topic, opts, 'Family SOS');
  else fetch('https://ntfy.sh/' + topic, opts).catch(() => {});
};
const _qTgSend = tgSend;
tgSend = function (msg) {
  const token = store.get('tgtoken', ''), chat = store.get('tgchat', '');
  if (token && chat && /🚨|SOS/.test(msg)) {
    return queuedFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: msg })
    }, 'Telegram SOS').then(() => true);
  }
  return _qTgSend(msg);
};

/* ================= GPS WATCHDOG + LAST KNOWN LOCATION ================= */
/* Restore last fix instantly on open; restart a dead GPS watch. */
(function restoreLastFix() {
  const last = store.get('lastfix', null);
  if (last && !S.pos && Date.now() - last.ts < 12 * 3600000) {
    S.pos = { ...last, approx: true };
    brainLog('📍', 'Using last known location (approx) until GPS locks', 0);
    try { updateGuardian(); } catch (e) {}
  }
})();
setInterval(() => {
  if (S.pos && !S.pos.approx) store.set('lastfix', { lat: S.pos.lat, lon: S.pos.lon, speed: 0, ts: Date.now() });
}, 30000);
setInterval(() => {
  if (!S.pos || S.pos.approx) return;
  if (Date.now() - S.pos.ts > 150000) {                     // no fix for 2.5 min
    brainLog('🛠️', 'GPS watch stalled — restarting sensor', 0);
    try { navigator.geolocation.clearWatch(S.watchId); } catch (e) {}
    try { startGPS(); } catch (e) {}
  }
}, 60000);

/* ================= BATTERY % IN FAMILY LIVE ================= */
window.__battPct = null;
if (navigator.getBattery) navigator.getBattery().then(b => {
  const upd = () => { window.__battPct = Math.round(b.level * 100); };
  b.addEventListener('levelchange', upd); upd();
});
/* show battery in the family list */
const _rFamList = renderFamList;
renderFamList = function (m) {
  _rFamList(m);
  const l = $('famList');
  if (!l) return;
  l.querySelectorAll('.list-item').forEach(item => {
    const name = item.querySelector('b')?.textContent.replace(/^[^ ]+ /, '');
    const member = Object.values(famSeen).find(x => x.n === name);
    if (member && member.b != null && !item.querySelector('.batt')) {
      const s = document.createElement('span');
      s.className = 'badge batt';
      s.textContent = '🔋' + member.b + '%';
      if (member.b <= 20) { s.style.color = 'var(--red)'; s.style.borderColor = 'var(--red)'; }
      item.querySelector('div').appendChild(s);
    }
  });
};

/* ================= ONE-TAP TRIP SHORTCUTS FROM ZONES ================= */
function renderTripShortcuts() {
  const host = $('routeOptions');
  if (!host || S.trip || typeof zones === 'undefined' || !zones.length || !S.pos) return;
  if ($('tripShortcuts')) return;
  const d = document.createElement('div');
  d.id = 'tripShortcuts';
  d.style.marginTop = '8px';
  d.innerHTML = '<div class="hint" style="margin-bottom:4px">Quick destinations:</div>';
  zones.forEach(z => {
    const b = document.createElement('button');
    b.className = 'btn small secondary';
    b.textContent = '→ ' + z.n;
    b.onclick = () => {
      if (destMarker) tripMap.removeLayer(destMarker);
      destMarker = L.marker([z.lat, z.lon]).addTo(tripMap).bindPopup(z.n).openPopup();
      fetchRoutes({ lat: z.lat, lng: z.lon });
    };
    d.appendChild(b);
  });
  host.parentElement.insertBefore(d, host);
}
setInterval(renderTripShortcuts, 4000);

/* ================= NIGHT SHIELD (one-toggle protection bundle) ================= */
(function nightShield() {
  const card = document.createElement('div');
  card.className = 'toggle-card';
  card.innerHTML = '<div class="t-info"><b>🌙 Night Shield</b><p>One switch arms the full night bundle: fall & impact detection, scream detection, and crash detection. Suggested automatically after 9 PM.</p></div>' +
    '<label class="switch"><input type="checkbox" id="nightToggle"><span class="slider"></span></label>';
  const anchor = document.querySelector('#page-home .mode-card');
  if (anchor) anchor.after(card);
  $('nightToggle').addEventListener('change', async e => {
    const on = e.target.checked;
    if (on && !(await motionPermission())) { e.target.checked = false; return; }
    ['motionToggle', 'crashToggle'].forEach(id => {
      const t = $(id);
      if (t && t.checked !== on) { t.checked = on; t.dispatchEvent(new Event('change')); }
    });
    const sc = $('screamToggle');
    if (sc && sc.checked !== on) { sc.checked = on; sc.dispatchEvent(new Event('change')); }
    brainLog('🌙', on ? 'Night Shield armed — falls, screams, and crashes monitored' : 'Night Shield disarmed', 0);
  });
  // gentle nightly suggestion
  const h = new Date().getHours();
  if ((h >= 21 || h < 5) && store.get('nightsuggest', '') !== new Date().toDateString()) {
    store.set('nightsuggest', new Date().toDateString());
    setTimeout(() => {
      if (!$('nightToggle').checked && confirm('🌙 It\'s late. Arm Night Shield (fall + scream + crash detection) for the night?')) {
        $('nightToggle').checked = true;
        $('nightToggle').dispatchEvent(new Event('change'));
      }
    }, 20000);
  }
})();

/* ================= LARGE TEXT (elder-friendly) ================= */
(function largeText() {
  const card = document.createElement('div');
  card.className = 'toggle-card';
  card.innerHTML = '<div class="t-info"><b>🔎 Large text</b><p>Bigger fonts and buttons across the app — easier for elders.</p></div>' +
    '<label class="switch"><input type="checkbox" id="bigTextToggle"><span class="slider"></span></label>';
  const anchor = document.querySelector('#page-settings .toggle-card');
  if (anchor) anchor.before(card);
  const apply = on => {
    document.documentElement.style.fontSize = on ? '19px' : '';
    document.body.style.fontSize = on ? '17px' : '';
  };
  $('bigTextToggle').checked = !!store.get('bigtext', false);
  apply($('bigTextToggle').checked);
  $('bigTextToggle').addEventListener('change', e => { store.set('bigtext', e.target.checked); apply(e.target.checked); });
})();

/* ================= GPS ACCURACY VISIBILITY ================= */
setInterval(() => {
  if (!S.pos || S.pos.approx) return;
  const age = Math.round((Date.now() - S.pos.ts) / 1000);
  if (age > 60) sense('gps', 'stale ' + age + 's');
}, 20000);

/* ================= boot ================= */
brainLog('🛡️', 'v13 robustness online — offline queue, GPS watchdog, Night Shield, battery-aware family', 0);
