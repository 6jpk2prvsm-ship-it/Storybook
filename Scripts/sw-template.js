const cacheName = 'where-pages-wander-__RELEASE__';
const urls = __ASSETS__;
const scope = new URL(self.registration.scope);
const assetUrls = new Set(urls.map(path => new URL(path, scope).href));

self.addEventListener('install', event => {
  // addAll succeeds as a batch. A partial release must never replace the live one.
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...assetUrls].map(url => new Request(url, {cache: 'reload'})));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('where-pages-wander-') && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin) return;
  const home = event.request.mode === 'navigate' &&
    (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html');
  const key = home ? scope.href : url.href;
  if (!assetUrls.has(key)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(cacheName)).match(key);
    return cached || fetch(event.request);
  })());
});
