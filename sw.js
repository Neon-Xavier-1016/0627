// 首页与静态资源：联网时检查新版，网络失败时使用已访问过的缓存。
// 只操作本网站的 Cache Storage，不操作 IndexedDB / localStorage。
const SCOPE_URL = self.registration.scope;
const SCOPE = new URL(SCOPE_URL);
const HOME_URL = new URL('index.html', SCOPE_URL).href;
const CACHE_PREFIX = 'xavier-static-' + encodeURIComponent(SCOPE_URL) + '-';
const CACHE_NAME = CACHE_PREFIX + 'v2';
const LEGACY_CACHE = 'xavier-v1';
const CORE_FILES = [SCOPE_URL, HOME_URL, new URL('manifest.json', SCOPE_URL).href];

function inScope(value) {
  const url = new URL(value);
  return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);
}

function isHome(value) {
  const url = new URL(value);
  return url.pathname === SCOPE.pathname || url.pathname === new URL(HOME_URL).pathname;
}

async function remember(request, response) {
  if (response.status !== 200) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const url = typeof request === 'string' ? request : request.url;
    if (isHome(url)) {
      // 带版本参数的首页也更新标准入口，避免断网后回退到旧首页。
      await cache.put(SCOPE_URL, response.clone());
      await cache.put(HOME_URL, response.clone());
    } else {
      await cache.put(request, response.clone());
    }
  } catch (error) {
    console.warn('[SW] 缓存写入失败，继续使用网络响应:', error);
  }
}

self.addEventListener('install', function(event) {
  event.waitUntil((async function() {
    await Promise.all(CORE_FILES.map(async function(url) {
      try {
        const response = await fetch(url, { cache: 'reload' });
        await remember(url, response);
      } catch (error) { /* 单个资源失败不阻断安装，激活时保留旧缓存兜底。 */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function(event) {
  event.waitUntil((async function() {
    try {
      const current = await caches.open(CACHE_NAME);
      const names = await caches.keys();
      for (const name of names) {
        if (name === CACHE_NAME || (name !== LEGACY_CACHE && !name.startsWith(CACHE_PREFIX))) continue;
        const old = await caches.open(name);
        for (const request of await old.keys()) {
          if (!inScope(request.url)) continue;
          const response = await old.match(request);
          // 已下载的新资源优先，旧资源保留作首次升级后的离线兜底。
          if (response && !(await current.match(request))) await current.put(request, response);
          // 旧 xavier-v1 可能与同域其他网页共用，只删除当前路径的条目。
          if (name === LEGACY_CACHE) await old.delete(request);
        }
        if (name !== LEGACY_CACHE) await caches.delete(name);
      }
    } catch (error) {
      console.warn('[SW] 旧缓存整理未完成，下次升级可重试:', error);
    }
    await self.clients.claim();
  })());
});

async function offlineResponse(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const exact = await cache.match(request);
    if (exact) return exact;
    if (request.mode === 'navigate' || isHome(request.url)) {
      return await cache.match(HOME_URL) || await cache.match(SCOPE_URL);
    }
  } catch (error) { /* 无缓存时由调用方返回网络错误。 */ }
  return null;
}

async function networkFirst(request) {
  try {
    // 强制验证浏览器 HTTP 缓存，防止旧首页或旧 JS 长期不更新。
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.status >= 500) return await offlineResponse(request) || response;
    // 404 等真实部署错误直接返回，便于发现漏传文件。
    await remember(request, response);
    return response;
  } catch (error) {
    // JS 缺失时不拿 HTML 冒充脚本。
    return await offlineResponse(request) || Response.error();
  }
}

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET' || !inScope(event.request.url)) return;
  // 分段音视频请求由浏览器处理，避免缓存残缺内容。
  if (event.request.headers.has('range')) return;
  event.respondWith(networkFirst(event.request));
});
