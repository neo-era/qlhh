// App shell: network-first cho trang (luôn lấy bản mới khi có mạng), cache-first cho icon/manifest.
// KHÔNG cache API (script.google.com). Tăng C mỗi lần phát hành.
const C='qlhh-spike-v2',SHELL=['./','manifest.webmanifest','icons/192.png','icons/512.png','icons/180.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
 if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put('./',cp));return res}).catch(()=>caches.match('./')));return}
 e.respondWith(caches.match(r,{ignoreSearch:true}).then(x=>x||fetch(r)))});
