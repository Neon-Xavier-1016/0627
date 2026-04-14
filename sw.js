// sw.js - Service Worker 后台推送核心

// 安装 Service Worker
self.addEventListener('install', function(event) {
    console.log('[SW] 安装中...');
    self.skipWaiting(); // 立即激活
});

// 激活 Service Worker
self.addEventListener('activate', function(event) {
    console.log('[SW] 激活中...');
    event.waitUntil(clients.claim());
});

// 监听推送消息（这是最关键的部分）
self.addEventListener('push', function(event) {
    console.log('[SW] 收到推送', event);

    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: '新消息', body: event.data.text() };
        }
    } else {
        data = { title: 'Xavier', body: '你收到了一条新消息' };
    }

    const options = {
        body: data.body,
        icon: data.icon || 'https://file.youtochat.com/images/20260216/1771224856844_qdqqd.jpeg',
        badge: data.badge || '',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/',
            timestamp: Date.now()
        },
        actions: [
            { action: 'open', title: '打开聊天' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Xavier', options)
    );
});

// 用户点击通知时打开页面
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/';
    event.waitUntil(
        clients.openWindow(urlToOpen)
    );
});