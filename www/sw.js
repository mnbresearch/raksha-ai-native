// Raksha AI service worker — offline app shell + offline map tiles
const CACHE = 'raksha-v28';
const TILES = 'raksha-tiles-v1';
const TILE_CAP = 400;
// de-duplicated; each asset cached individually so one failure can't abort install
const ASSETS = [...new Set(['.', 'index.html', 'track.html', 'about.html', 'help.html', 'app.js', 'modes.js', 'features.js', 'brain.js', 'guardian.js', 'shield.js', 'check.js', 'extra.js', 'refine.js', 'v10.js', 'v12.js', 'robust.js', 'v14.js', 'v15.js', 'v16.js', 'v17.js', 'v18.js', 'v19.js', 'v20.js', 'v21.js', 'v22.js', 'v23.js', 'v24.js', 'v25.js', 'v26.js', 'v27.js', 'v28.js', 'manifest.json', 'icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'])];

self.addEventListener('install', e => {
  // Do NOT auto-skipWaiting: let the new version wait so the app can
  // show an "Update now" banner. It still applies on the next full
  // open, so users always reach the latest security fixes.
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(ASSETS.map(a => c.add(a).catch(() => {/* tolerate individual failures */})))
    )
  );
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

async function tileFetch(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req);
  const net = fetch(req).then(async res => {
    if (res.ok || res.type === 'opaque') {
      await cache.put(req, res.clone());
      // cap the tile cache
      const keys = await cache.keys();
      if (keys.length > TILE_CAP) await cache.delete(keys[0]);
    }
    return res;
  }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('tile.openstreetmap.org')) { e.respondWith(tileFetch(e.request)); return; }
  // never cache live APIs
  if (url.includes('ntfy.sh') || url.includes('overpass') || url.includes('project-osrm') || url.includes('open-meteo') || url.includes('qrserver') || url.includes('api.telegram.org') || url.includes('nominatim')) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit ||
      fetch(e.request).then(res => {
        if (res.ok && (url.startsWith(self.location.origin) || url.includes('unpkg.com') || url.includes('cdnjs.cloudflare.com'))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('index.html'))
    )
  );
});
