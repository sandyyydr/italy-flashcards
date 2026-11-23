const CACHE = 'seoul-1211-v2';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './offline-manifest.json',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './img/route_map_small.webp',
  './mag/p1.webp',
  './mag/p2.webp'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE && k.indexOf('seoul-1211-') === 0).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* 문서는 네트워크 우선(앱 열면 최신), 나머지는 캐시 우선 · 없으면 네트워크 */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (req.mode === 'navigate' || req.destination === 'document') {
      try {
        const res = await fetch(req);
        if (res && res.status === 200) c.put(req, res.clone());
        return res;
      } catch (err) {
        const fb = await c.match(req, { ignoreSearch: true });
        if (fb) return fb;
        throw err;
      }
    }
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') c.put(req, res.clone());
      return res;
    } catch (err) {
      const fb = await c.match(req, { ignoreSearch: true });
      if (fb) return fb;
      throw err;
    }
  })());
});
