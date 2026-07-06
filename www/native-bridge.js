/* =========================================================
   Raksha AI — native bridge (Android via Capacitor)
   Gives the guardian true 24/7 powers:
   • Background GPS with a persistent foreground service
     (keeps working with the screen OFF and app minimized)
   • Trip watch, Family Live, and safe zones keep running
     in the background
   • Native notifications for check-ins and family SOS
   Loaded only when running inside the native Android shell.
   ========================================================= */
"use strict";

(function nativeBridge() {
  if (!window.Capacitor || !Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) return;

  const BG = Capacitor.Plugins.BackgroundGeolocation;
  const LN = Capacitor.Plugins.LocalNotifications;
  let watcherId = null;
  let lastFamPub = 0;

  async function notify(title, body, id) {
    try {
      await LN.requestPermissions();
      await LN.schedule({ notifications: [{ id: id || Math.floor(Math.random() * 100000), title, body, schedule: { at: new Date(Date.now() + 100) } }] });
    } catch (e) {}
  }

  /* ---- background GPS: replaces the browser watcher ---- */
  async function startNativeGuard() {
    if (watcherId) return;
    try {
      watcherId = await BG.addWatcher(
        {
          backgroundMessage: '🛡️ Guardian active — watching over you',
          backgroundTitle: 'Raksha AI',
          requestPermissions: true,
          stale: false,
          distanceFilter: 10
        },
        (location, error) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED' &&
                confirm('Raksha AI needs "Allow all the time" location permission for 24/7 protection. Open settings?')) {
              BG.openSettings();
            }
            return;
          }
          // Feed native GPS into the existing guardian engine
          S.pos = { lat: location.latitude, lon: location.longitude, speed: location.speed || 0, ts: Date.now() };
          S.speedHistory.push({ v: S.pos.speed, ts: Date.now() });
          if (S.speedHistory.length > 30) S.speedHistory.shift();
          try { sense('gps', 'native 24/7'); } catch (e) {}
          try { if (typeof meMarker !== 'undefined' && meMarker) meMarker.setLatLng([S.pos.lat, S.pos.lon]); } catch (e) {}
          try { tripTick(); } catch (e) {}
          try { updateGuardian(); } catch (e) {}
          // Family Live keeps publishing from the background
          try {
            if ($('famToggle') && $('famToggle').checked && Date.now() - lastFamPub > 15000) {
              lastFamPub = Date.now();
              famPublish();
            }
          } catch (e) {}
        }
      );
      brainLog('🤖', 'Native 24/7 guard started — background GPS + foreground service active', 0);
      notify('🛡️ Raksha AI Guardian active', 'Protecting you 24/7 — even with the screen off.', 1);
    } catch (e) {}
  }

  /* ---- native notifications for check-ins & emergencies ---- */
  const _nOpenCheckin = window.openCheckin;
  window.openCheckin = function (title, reason, secs) {
    notify('❓ ' + title, reason + ' — open Raksha AI to respond.');
    _nOpenCheckin(title, reason, secs);
  };
  const _nStartEmergency = window.startEmergency;
  window.startEmergency = function (reason) {
    notify('🚨 EMERGENCY ACTIVE', reason, 999);
    _nStartEmergency(reason);
  };

  /* ---- family SOS → loud native notification ---- */
  const _nBrainLog = window.brainLog;
  window.brainLog = function (icon, msg, w) {
    if (icon === '🚨' && msg.startsWith('FAMILY SOS')) notify('🚨 FAMILY SOS', msg, 998);
    _nBrainLog(icon, msg, w);
  };

  /* ---- boot ---- */
  document.addEventListener('deviceready', startNativeGuard);
  window.addEventListener('load', () => setTimeout(startNativeGuard, 2500));
})();
