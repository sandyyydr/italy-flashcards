const CACHE = 'osaka-planner-v87';
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
  /* 새 워커가 준비되는 즉시 대기 상태를 건너뛰고 활성화 단계로 넘어가요 */
  self.skipWaiting();
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    /* 현재 버전만 남기고 이 오사카 앱의 모든 예전 캐시를 삭제 */
    const ks = await caches.keys();
    await Promise.all(ks
      .filter(k => k !== CACHE && /osaka/i.test(k))
      .map(k => caches.delete(k)));
    await self.clients.claim();
    /* 열려 있는 화면에 새 버전이 켜졌다고 알림 (index.html이 1회 자동 새로고침) */
    try{
      const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      cs.forEach(c => { try{ c.postMessage({ type: 'sw-activated', cache: CACHE }); }catch(err){} });
    }catch(err){}
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
