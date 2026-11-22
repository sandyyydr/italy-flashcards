const CACHE = 'iberia-planner-v3';
const PRECACHE = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function put(req, res) {
  if (res && res.status === 200) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isDoc = e.request.mode === 'navigate' ||
                url.pathname.endsWith('/') ||
                url.pathname.endsWith('/index.html');

  // 문서는 네트워크 우선(업데이트가 바로 반영), 오프라인이면 캐시
  if (isDoc) {
    e.respondWith(
      fetch(e.request).then(res => put(e.request, res))
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // 같은 오리진의 이미지·JS·manifest = 캐시 우선 → 오프라인에서도 사진이 뜬다
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(hit => {
        if (hit) return hit;
        return fetch(e.request).then(res => put(e.request, res))
          .catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // 외부(지도 타일·Leaflet) = 네트워크 우선, 실패하면 캐시
  e.respondWith(
    fetch(e.request).then(res => put(e.request, res))
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
