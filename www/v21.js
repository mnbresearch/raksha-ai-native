/* =========================================================
   Raksha AI v21 — Meet Safe
   A guardian for meeting someone new (dates, marketplace deals,
   rentals, interviews). Logs who/where/when as evidence, tells
   your circle, and auto-escalates to SOS if you don't confirm
   you're safe by the end of the meeting (+ a grace period).
   Survives reloads — resumes an active session automatically.
   ========================================================= */
"use strict";

const MEET_GRACE_MS = 5 * 60000;   // 5 min grace after end time before escalation
let meetIv = null;

function meetGet() { try { return store.get('meet', null); } catch (e) { return null; } }
function meetSet(m) { try { m ? store.set('meet', m) : store.set('meet', null); } catch (e) {} }

function fmtLeft(ms) {
  if (ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

function startMeet() {
  const who = ($('meetWho') && $('meetWho').value || '').trim();
  const where = ($('meetWhere') && $('meetWhere').value || '').trim();
  const dur = parseInt($('meetDur') && $('meetDur').value || '60', 10);
  if (!who && !where) { alert('Add at least who you\'re meeting or where, so your circle has context.'); return; }
  const m = {
    who, where, dur,
    startAt: Date.now(),
    endAt: Date.now() + dur * 60000,
    escalated: false,
    v: 1,
  };
  meetSet(m);
  try { brainLog('🤝', 'Meet Safe started — meeting ' + (who || 'someone') + (where ? ' at ' + where : '') + ' for ' + dur + ' min', 0); } catch (e) {}
  try { if (typeof famBroadcast === 'function') famBroadcast('ok', 'Meet Safe: meeting ' + (who || 'someone') + (where ? ' at ' + where : '') + ' (' + dur + ' min)'); } catch (e) {}
  meetRender();
  meetLoop();
}

function meetExtend() {
  const m = meetGet(); if (!m) return;
  m.endAt = Math.max(m.endAt, Date.now()) + 30 * 60000;
  m.escalated = false;
  meetSet(m);
  hideMeetCheck();
  try { brainLog('🤝', 'Meet Safe extended by 30 min', 0); } catch (e) {}
  meetRender();
}

function meetSafe() {
  const m = meetGet();
  meetSet(null);
  if (meetIv) { clearInterval(meetIv); meetIv = null; }
  hideMeetCheck();
  try { if (typeof famBroadcast === 'function') famBroadcast('ok', 'Meet Safe ended — reached safely ✅'); } catch (e) {}
  try { brainLog('✅', 'Meet Safe ended safely', 0); } catch (e) {}
  meetRender();
}

function meetHelp() {
  const m = meetGet();
  const reason = 'Meet Safe — help requested' + (m && m.who ? ' (meeting ' + m.who + ')' : '');
  hideMeetCheck();
  meetEscalate(reason, true);
}

function meetEscalate(reason, manual) {
  const m = meetGet();
  if (m) { m.escalated = true; meetSet(m); }
  try { if (typeof famBroadcast === 'function') famBroadcast('SOS', reason); } catch (e) {}
  try {
    if (typeof startEmergency === 'function') startEmergency(reason);
    else if (typeof go === 'function') go('emergency');
  } catch (e) {}
  try { brainLog('🚨', 'Meet Safe escalated: ' + reason, 80); } catch (e) {}
  // keep session so the user can still tap "I'm safe" to stand down after a manual help too
  if (!manual) meetRender();
}

function showMeetCheck(msg) {
  const el = $('meetCheck'); if (!el) return;
  const m = $('meetCheckMsg'); if (m && msg) m.textContent = msg;
  el.style.display = 'flex';
}
function hideMeetCheck() { const el = $('meetCheck'); if (el) el.style.display = 'none'; }

/* escape user-entered strings before putting them in innerHTML */
function meetEsc(s) {
  if (typeof esc === 'function') return esc(s);
  return String(s == null ? '' : s).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function meetRender() {
  const m = meetGet();
  const setup = $('meetSetup'), active = $('meetActive'), status = $('meetStatus');
  if (!setup || !active) return;
  if (!m) { setup.style.display = ''; active.style.display = 'none'; return; }
  setup.style.display = 'none'; active.style.display = '';
  if (status) {
    const left = m.endAt - Date.now();
    const who = meetEsc(m.who || 'someone');
    const where = m.where ? ' at ' + meetEsc(m.where) : '';
    const line = left > 0
      ? '🤝 Meeting ' + who + where + ' — check-in in <b>' + fmtLeft(left) + '</b>'
      : (m.escalated ? '🚨 No response — your circle was alerted. Tap "I\'m safe" to stand down.'
        : '⏰ Time\'s up — please confirm you\'re safe.');
    status.innerHTML = line;
  }
}

function meetLoop() {
  if (meetIv) clearInterval(meetIv);
  meetIv = setInterval(() => {
    const m = meetGet();
    if (!m) { clearInterval(meetIv); meetIv = null; return; }
    const now = Date.now();
    meetRender();
    if (now >= m.endAt && !m.escalated) {
      // show the check-in prompt as soon as time is up
      if ($('meetCheck') && $('meetCheck').style.display !== 'flex')
        showMeetCheck('Your Meet Safe time is up. Tap "I\'m safe" within 5 minutes or we\'ll alert your circle.');
      // escalate after the grace period with no response
      if (now >= m.endAt + MEET_GRACE_MS) {
        meetEscalate('Meet Safe check-in missed — meeting ' + (m.who || 'someone') + (m.where ? ' at ' + m.where : ''), false);
      }
    }
  }, 1000);
}

/* ---------- Hindi ---------- */
if (typeof I18N !== 'undefined' && I18N.hi) Object.assign(I18N.hi, {
  meetsafe: '🤝 मीट सेफ — किसी नए व्यक्ति से मिलना',
  meetsafep: 'डेट, मार्केटप्लेस डील, किराया या इंटरव्यू के लिए। दर्ज करें किससे और कहाँ मिल रहे हैं — रक्षा आप पर नज़र रखेगी और समय पर जवाब न देने पर आपके सर्कल को अलर्ट करेगी।',
  meetstart: 'मीट सेफ शुरू करें', meetok: '✅ मैं सुरक्षित हूँ — समाप्त', meethelp: '🚨 मुझे अभी मदद चाहिए',
  meetext: '+30 मिनट', meetq: 'क्या आप सुरक्षित हैं?', meetimok: 'मैं सुरक्षित हूँ',
  meetsendhelp: 'अभी मदद भेजें', meetext30: '+30 मिनट, मैं ठीक हूँ',
});
if (typeof applyLang === 'function') applyLang();

/* ---------- resume on load ---------- */
setTimeout(() => { if (meetGet()) { meetRender(); meetLoop(); } }, 1200);
try { brainLog('🤝', 'v21 online — Meet Safe ready', 0); } catch (e) {}
