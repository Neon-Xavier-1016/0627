const CACHE_NAME = 'xavier-v1';

// 只缓存真正的静态资源，别把可能 404 的文件塞进来
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // 逐个 add，某个失败不影响其他的
      return Promise.all(
        CORE_FILES.map(function(url) {
          return cache.add(url).catch(function() {});
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // 跨域资源（CDN 上的 localforage / font-awesome 等）→ 直接走网络
  if (url.origin !== self.location.origin) return;

  // 只对 html / manifest 用缓存优先，其他（js/css/图片）用"网络优先，失败回退缓存"
  const isHtml = url.pathname.endsWith('/') ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('manifest.json');

  if (isHtml) {
    // 缓存优先
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(res) {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(e.request, copy); });
          }
          return res;
        });
      }).catch(function() { return caches.match('./index.html'); })
    );
  } else {
    // 网络优先，失败时用缓存
    e.respondWith(
      fetch(e.request).then(function(res) {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
  }
});