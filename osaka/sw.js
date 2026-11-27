const CACHE = 'osaka-planner-v72';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './offline-manifest.json',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './tiles/14/14358/6507.png',
  './tiles/13/7176/3256.png'
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
    await Promise.all(ks.filter(k => k !== CACHE && k.indexOf('osaka-planner-') === 0).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* 캐시 우선 · 없으면 네트워크 → 성공하면 저장. 네트워크 실패 시 캐시에서 즉시 반환 */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // 외부(구글맵 등)는 그대로 네트워크로
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    /* 문서(HTML)는 네트워크 우선 — 앱을 새로 열면 항상 최신 페이지, 오프라인이면 캐시 */
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
    /* 오프라인 목록은 항상 최신으로 — 예전 목록이 캐시에 남아 '준비 완료'로 잘못 보이던 문제 방지 */
    if (url.pathname.endsWith('/offline-manifest.json')) {
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res && res.status === 200) c.put(req, res.clone());
        return res;
      } catch (err) {
        if (hit) return hit;
        throw err;
      }
    }
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

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'skip-waiting') self.skipWaiting();
});
