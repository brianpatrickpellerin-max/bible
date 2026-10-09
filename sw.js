const C="bible-v15",D="bible-data";
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(["./","icon.png","manifest.json","worker.1ef424f8dd.js"])));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C&&k!==D).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
function timeout(ms){return new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),ms));}
self.addEventListener("fetch",e=>{const req=e.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.origin!==location.origin)return;
  if(req.mode==="navigate"){
    // network first (so updates arrive right away), cached page when offline or slow
    e.respondWith(Promise.race([fetch(req),timeout(3000)]).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put("./",cp));}return res;})
      .catch(()=>caches.match("./",{cacheName:C}).then(r=>r||caches.match(req,{ignoreSearch:true})).then(r=>r||fetch(req))));
    return;}
  if(url.pathname.includes("/data/")){e.respondWith(caches.match(req).then(r=>r||fetch(req)));return;}
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(r=>r||fetch(req).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(req,cp));}return res;})));
});
