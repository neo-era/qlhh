// QLHH service worker: network-first cho trang, cache-first cho tài nguyên tĩnh; KHÔNG cache API (script.google.com).
// Tăng C mỗi lần phát hành.
const C = 'qlhh-0.4.0';
const SHELL = ['./', 'app.css', 'app.js', 'config.js', 'core/validate.js', 'core/perm.js', 'core/price.js', 'core/search.js', 'core/stock.js', 'core/sx.js', 'core/bh.js', 'core/vnwords.js', 'vendor/xlsx.full.min.js', 'vendor/qrcode.js', 'manifest.webmanifest', 'icons/192.png', 'icons/512.png', 'icons/180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => Promise.allSettled(SHELL.map(u => c.add(u))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (r.mode === 'navigate' || /\.(js|css)$/.test(u.pathname)) {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put(r.mode === 'navigate' ? './' : r, cp)); return res; })
      .catch(() => caches.match(r.mode === 'navigate' ? './' : r, { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(x => x || fetch(r)));
});
