/* =========================================================
   Raksha AI v25 — Feature Finder (search anything)
   With 100+ features, this lets anyone type "scam", "vault",
   "home", "medical", "walk"… and jump straight there. A simple
   command-palette that makes the whole app easy to navigate.
   ========================================================= */
"use strict";

function _go(p) { try { go(p); } catch (e) {} }
function _call(fn) { try { if (typeof window[fn] === 'function') window[fn](); } catch (e) {} }

/* label + emoji + search keywords + action. Labels/keywords are
   all constants (no user input) so innerHTML rendering is safe. */
const FIND_INDEX = [
  { e: '🚨', label: 'Emergency / SOS', kw: ['sos', 'emergency', 'panic', 'help', 'danger'], act: () => _go('emergency') },
  { e: '💬', label: 'WhatsApp SOS', kw: ['whatsapp', 'wa', 'sos', 'message', 'location'], act: () => _call('waShareSOS') },
  { e: '🚶‍♀️', label: 'Walk With Me', kw: ['walk', 'escort', 'deadman', 'night', 'follow'], act: () => _go('walk') },
  { e: '🚕', label: 'Guardian Trip Mode', kw: ['trip', 'cab', 'auto', 'taxi', 'route', 'ride'], act: () => _go('trip') },
  { e: '📞', label: 'Fake Call', kw: ['fake', 'call', 'excuse', 'ring', 'escape'], act: () => _call('showFakeCall') },
  { e: '🤝', label: 'Meet Safe (meeting someone)', kw: ['meet', 'date', 'stranger', 'olx', 'marketplace', 'interview', 'rental'], act: () => _go('tools') },
  { e: '🏠', label: 'Home Safe', kw: ['home', 'house', 'get home', 'directions'], act: () => _go('tools') },
  { e: '🧰', label: 'Quick Tools', kw: ['tools', 'alarm', 'siren', 'whistle', 'deterrent', 'voice'], act: () => _go('tools') },
  { e: '🕵️', label: 'Scam Shield', kw: ['scam', 'fraud', 'kyc', 'upi', 'otp', 'digital arrest', 'phishing', 'cyber'], act: () => _go('scam') },
  { e: '🔐', label: 'Safe Space (Domestic Violence vault)', kw: ['vault', 'domestic', 'abuse', 'evidence', 'safe space', 'hidden', 'pin'], act: () => _call('openVaultGate') },
  { e: '🧠', label: 'Guardian Brain', kw: ['brain', 'sensor', 'threat', 'ai', 'meter'], act: () => _go('brain') },
  { e: '💬', label: 'Guardian Assistant', kw: ['assistant', 'chat', 'ask', 'advice', 'guidance'], act: () => _go('assistant') },
  { e: '🧓', label: 'Elder Care', kw: ['elder', 'senior', 'parent', 'fall', 'medicine'], act: () => _go('elder') },
  { e: '🧒', label: 'Child Safety', kw: ['child', 'kid', 'school', 'childline'], act: () => _go('child') },
  { e: '💙', label: 'Mind Guardian', kw: ['mind', 'mental', 'stress', 'depress', 'tele-manas', 'kiran'], act: () => _go('mind') },
  { e: '🗺️', label: 'Community Shield', kw: ['community', 'unsafe', 'report', 'map', 'spot'], act: () => _go('community') },
  { e: '🏮', label: 'Nearby Safe Havens', kw: ['haven', 'police', 'hospital', 'pharmacy', 'atm', 'petrol', 'nearby'], act: () => _go('havens') },
  { e: '📞', label: 'India Helplines', kw: ['helpline', 'number', '112', '1091', '1098', '1930', 'women', 'police'], act: () => _go('helplines') },
  { e: '👥', label: 'Trusted Circle', kw: ['circle', 'contacts', 'family', 'trusted', 'add contact'], act: () => _go('circle') },
  { e: '🛰️', label: 'Family Live tracking', kw: ['family live', 'track', 'live location', 'map', 'share location'], act: () => _go('circle') },
  { e: '📊', label: 'Safety Dashboard', kw: ['dashboard', 'report', 'score', 'stats', 'install', 'update'], act: () => _go('dashboard') },
  { e: '🆘', label: 'Emergency Medical Card (ICE)', kw: ['medical', 'ice', 'blood', 'allergy', 'health'], act: () => _go('ice') },
  { e: '🔳', label: 'Emergency Medical QR', kw: ['qr', 'medical qr', 'scan', 'responder'], act: () => _go('ice') },
  { e: '➕', label: 'First-Aid Guide', kw: ['first aid', 'cpr', 'bleeding', 'choking', 'snakebite', 'burn'], act: () => _go('firstaid') },
  { e: '📖', label: 'Safety Playbook', kw: ['playbook', 'tips', 'advice', 'self defence', 'safety tips'], act: () => _go('tips') },
  { e: '⚙️', label: 'Settings', kw: ['settings', 'language', 'pin', 'stealth', 'permissions', 'wipe', 'backend'], act: () => _go('settings') },
  { e: '🔐', label: 'Set up permissions', kw: ['permission', 'location', 'camera', 'mic', 'grant'], act: () => _call('openPermWizard') },
  { e: '❓', label: 'How to use / Help', kw: ['help', 'how', 'guide', 'tutorial', 'start'], act: () => _call('openHelp') },
];

function openFind() {
  const q = $('findQ'); if (q) q.value = '';
  renderFind();
  const m = $('findModal'); if (m) m.classList.add('show');
  setTimeout(() => { const el = $('findQ'); if (el) el.focus(); }, 120);
  try { const b = $('findBar'); if (b) b.blur(); } catch (e) {}
}
function closeFind() { const m = $('findModal'); if (m) m.classList.remove('show'); }

function runFind(i) {
  closeFind();
  const it = FIND_INDEX[i];
  if (it) setTimeout(() => { try { it.act(); } catch (e) {} }, 60);
}

function renderFind() {
  const box = $('findResults'); if (!box) return;
  const q = (($('findQ') && $('findQ').value) || '').toLowerCase().trim();
  const hits = FIND_INDEX
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => !q || it.label.toLowerCase().includes(q) || it.kw.some(k => k.includes(q) || q.includes(k)));
  if (!hits.length) {
    box.innerHTML = '<p class="hint">No match. Try “scam”, “vault”, “walk”, “home”, “medical”, or “helpline”.</p>';
    return;
  }
  box.innerHTML = hits.map(({ it, i }) =>
    '<div class="list-item" onclick="runFind(' + i + ')" style="cursor:pointer">' +
    '<div><b>' + it.e + ' ' + it.label + '</b></div><div style="opacity:.6">›</div></div>'
  ).join('');
}

/* ---------- Hindi ---------- */
if (typeof I18N !== 'undefined' && I18N.hi) Object.assign(I18N.hi, {
  findbtn: '🔍 कोई भी फ़ीचर खोजें',
});
if (typeof applyLang === 'function') applyLang();

try { brainLog('🔍', 'v25 online — feature finder ready', 0); } catch (e) {}
