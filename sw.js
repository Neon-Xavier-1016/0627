// 最小可用的 Service Worker
// 它什么都不缓存，只负责"存在"—— 存在就够让 iOS 把你当 PWA
// 别小看这 12 行，iOS 就靠它决定要不要清你的数据

self.addEventListener('install', function(e) {
    self.skipWaiting();
});

self.addEventListener('activate', function(e) {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(e) {
    // 什么都不做，让所有请求正常走网络
    // 以后想加离线缓存，就在这里写
});