// Little Star — oflayn ishlash uchun. Yangilanganda VERSION ni o'zgartiring.
const VERSION='ls-v3';
const FILES=['/','/index.html','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/apple-touch-icon.png','/icons/favicon-48.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);if(u.origin===self.location.origin&&(u.pathname.startsWith('/api/')||u.pathname.startsWith('/admin')||u.pathname.startsWith('/files/')))return; // API, admin va yuklangan fayllar (video) har doim internetdan
  if(u.origin===self.location.origin&&u.pathname.endsWith('.js')){e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(VERSION).then(ca=>ca.put(r,c));return res}).catch(()=>caches.match(r)));return} // skriptlar: avval internetdan
  if(r.mode==='navigate'){ // sahifa: avval internetdan (yangilanish darhol ko'rinadi), bo'lmasa keshdan
    e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(VERSION).then(ca=>ca.put('/index.html',c));return res}).catch(()=>caches.match('/index.html')));return}
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok&&(r.url.startsWith(self.location.origin)||r.url.includes('fonts.g'))){const c=res.clone();caches.open(VERSION).then(ca=>ca.put(r,c))}return res})));
});
