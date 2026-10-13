const CACHE_NAME = 'mochi-v1';
// 只缓存核心脚本，其他的走网络
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './js/lib/localforage.min.js',
  './js/lib/jszip.min.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CORE_FILES).catch(function() {});
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
  const url = new URL(e.request.url);
  // 只对核心文件用缓存优先，其他走网络
  const isCore = CORE_FILES.some(function(f) {
    return url.pathname.endsWith(f.replace('./', '/'));
  });
  if (isCore) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(res) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(e.request, copy); });
          return res;
        });
      })
    );
  }
  // 其他请求走网络（不缓存，保证代码永远最新）
});