// Raksha AI service worker — offline app shell + offline map tiles
const CACHE = 'raksha-v11';
const TILES = 'raksha-tiles-v1';
const TILE_CAP = 400;
const ASSETS = ['.', 'index.html', 'track.html', 'about.html', 'app.js', 'modes.js', 'features.js', 'brain.js', 'guardian.js', 'shield.js', 'check.js', 'extra.js', 'refine.js', 'v10.js', 'manifest.json', 'icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
  if (url.includes('ntfy.sh') || url.includes('overpass') || url.includes('project-osrm') || url.includes('open-meteo') || url.includes('qrserver')) return;
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
