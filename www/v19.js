/* =========================================================
   Raksha AI v19 — Access-request / lead capture
   • In-app "Request access & updates" form
   • Posts to the owner's Cloudflare Worker (Resend backend)
     with an x-app-secret header. The Resend API key lives ONLY
     on the server — never here.
   • If no worker is configured yet, gracefully falls back to
     opening the user's email app addressed to the owner, so
     lead capture works from day one.
   • Owner config (worker URL + APP_SECRET) saved in Settings.
   ========================================================= */
"use strict";

const OWNER_EMAIL = 'mnbgotyou@gmail.com';

// Baked-in backend URL so EVERY user's request reaches the owner
// automatically. Only the public worker URL ships in the app — no
// credential. The real secret (Resend API key) lives server-side on the
// worker and is never exposed. The owner can override from Settings, and
// can optionally set a shared secret on their own device if they add one
// to the worker later.
const DEFAULT_WORKER_URL = 'https://raksha-access.mridulnanda2004.workers.dev';

function accessCfg() {
  return {
    url: (store.get('reqWorkerUrl', '') || DEFAULT_WORKER_URL).trim(),
    secret: store.get('reqAppSecret', '').trim(),
  };
}
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim()); }

/* ---------- open the request modal ---------- */
function openAccessReq() {
  const f = $('reqForm'), d = $('reqDone');
  if (f) f.style.display = ''; if (d) d.style.display = 'none';
  const m = $('reqModal'); if (m) m.classList.add('show');
}

/* ---------- submit ---------- */
async function submitAccess() {
  const email = ($('reqEmail') && $('reqEmail').value || '').trim();
  if (!validEmail(email)) { alert('Please enter a valid email address so we can reach you.'); return; }
  const payload = {
    name:  ($('reqName')  && $('reqName').value  || '').trim(),
    email,
    phone: ($('reqPhone') && $('reqPhone').value || '').trim(),
    city:  ($('reqCity')  && $('reqCity').value  || '').trim(),
    org:   ($('reqOrg')   && $('reqOrg').value   || '').trim(),
    useCase: ($('reqUse') && $('reqUse').value   || '').trim(),
  };
  const btn = event && event.target;
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  const cfg = accessCfg();
  let sent = false;
  if (cfg.url) {
    try {
      const r = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-secret': cfg.secret },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      sent = r.ok && j && j.ok;
    } catch (e) { sent = false; }
  }

  // remember locally too (so the owner never loses a lead)
  try {
    const leads = store.get('leads', []);
    leads.push({ ...payload, at: Date.now(), delivered: sent });
    store.set('leads', leads.slice(-500));
  } catch (e) {}

  if (sent) { showReqDone(); }
  else { mailtoFallback(payload); showReqDone(); }   // fallback still counts as done for the user

  if (btn) { btn.disabled = false; btn.textContent = 'Send request'; }
  try { brainLog('🙌', 'Access request submitted' + (sent ? ' (emailed)' : ' (via email app)'), 0); } catch (e) {}
}

function showReqDone() {
  const f = $('reqForm'), d = $('reqDone');
  if (f) f.style.display = 'none'; if (d) d.style.display = '';
}

function mailtoFallback(p) {
  const subj = encodeURIComponent('Raksha AI — access request: ' + (p.name || p.email));
  const body = encodeURIComponent(
    'Name: ' + (p.name || '-') + '\nEmail: ' + p.email +
    (p.phone ? '\nPhone: ' + p.phone : '') +
    (p.city ? '\nCity: ' + p.city : '') +
    (p.org ? '\nOrganisation: ' + p.org : '') +
    (p.useCase ? '\nInterested as: ' + p.useCase : '') +
    '\n\n(Sent from Raksha AI)');
  try { window.location.href = 'mailto:' + OWNER_EMAIL + '?subject=' + subj + '&body=' + body; } catch (e) {}
}

/* ---------- owner config ---------- */
function loadAccessCfg() {
  const u = $('reqWorkerUrl'), s = $('reqAppSecret');
  if (u) u.value = store.get('reqWorkerUrl', '');
  if (s) s.value = store.get('reqAppSecret', '');
  const st = $('reqCfgStatus');
  if (st) st.textContent = accessCfg().url
    ? '✅ Backend connected — every request emails you automatically. (Leave blank to use the built-in default.)'
    : 'Not set — requests open the user\'s email app to ' + OWNER_EMAIL + '.';
}
async function saveAccessCfg() {
  const url = ($('reqWorkerUrl') && $('reqWorkerUrl').value || '').trim();
  const secret = ($('reqAppSecret') && $('reqAppSecret').value || '').trim();
  store.set('reqWorkerUrl', url);
  store.set('reqAppSecret', secret);
  const st = $('reqCfgStatus');
  if (!url) { if (st) st.textContent = 'Cleared. Requests will open the email app to ' + OWNER_EMAIL + '.'; return; }
  if (st) st.textContent = 'Sending a test…';
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-secret': secret },
      body: JSON.stringify({ name: 'Owner test', email: OWNER_EMAIL, city: '—', useCase: 'Backend test from app' }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.ok) { if (st) st.textContent = '✅ Saved & test sent — check ' + OWNER_EMAIL + ' inbox.'; }
    else if (r.status === 401) { if (st) st.textContent = '⚠️ Saved, but APP_SECRET does not match the worker. Fix it and retry.'; }
    else { if (st) st.textContent = '⚠️ Saved, but the worker returned an error (' + r.status + '). Check the deploy.'; }
  } catch (e) {
    if (st) st.textContent = '⚠️ Saved, but could not reach that URL. Check it is deployed and public.';
  }
}

/* ---------- i18n (Hindi) ---------- */
if (typeof I18N !== 'undefined' && I18N.hi) Object.assign(I18N.hi, {
  reqbtn: '🙌 एक्सेस और अपडेट का अनुरोध करें',
  reqtitle: 'एक्सेस और अपडेट का अनुरोध करें',
  reqp: 'ऑनबोर्डिंग मदद, नए फ़ीचर और ज़रूरी सुरक्षा अपडेट पाएँ। हम आपको ईमेल करेंगे — कभी स्पैम नहीं।',
  reqsend: 'अनुरोध भेजें', reqthx: 'धन्यवाद — अनुरोध भेजा गया!',
  reqthx2: 'हम संपर्क करेंगे। आप Raksha AI अभी मुफ़्त इस्तेमाल कर सकते हैं।',
  ownercfg: '👑 ओनर: एक्सेस-रिक्वेस्ट बैकएंड',
});
if (typeof applyLang === 'function') applyLang();

/* ---------- boot ---------- */
setTimeout(loadAccessCfg, 800);
try { brainLog('🙌', 'v19 online — access-request capture ready', 0); } catch (e) {}
