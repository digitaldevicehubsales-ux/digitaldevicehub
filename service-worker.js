const CACHE='ddh-v37';
const ASSETS=['/','/index.html','/site-v2.css','/config.js','/countries.js','/app.js','/home-preview-fix.js','/auth-ui.js','/account-ui.js','/localization.js','/locale-picker.js','/locale-ui.js','/analytics.js','/role-router.js','/open-signin.js','/mobile-nav.js','/marketplace.html','/marketplace-page.js','/marketplace-engagement.js','/device.html','/device-shell.html','/device-page.js','/device-state-fix.js','/sell.html','/sell-wizard.js','/sell-select-hardening.js','/seller.html','/seller-page.js','/trust.html','/help.html','/about.html','/contact.html','/phones.html','/laptops.html','/tablets.html','/accessories.html','/wearables.html','/compare.html','/compare.js','/404.html','/dashboard.html','/dashboard.js','/dashboard-state.js','/dashboard-state.css','/dashboard-engagement.js','/director-link.js','/director.html','/director.css','/director-ux.css','/director.js','/director-ux.js','/admin.html','/admin.css','/admin.js','/admin-v2.js','/manifest.webmanifest','/favicon.svg','/resend-confirmation.html','/resend-confirmation.js'];
const CACHEABLE_PATHS=new Set(ASSETS.map(path=>new URL(path,self.location.origin).pathname));

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  const url=new URL(request.url);

  // Never intercept or cache cross-origin traffic, authenticated proxy calls,
  // session endpoints, or dynamic API responses. The previous implementation
  // cached every successful GET, which could persist private dashboard data in
  // Cache Storage after sign-out and could return HTML as a failed API response.
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')||url.pathname==='/sitemap.xml')return;

  const isKnownStatic=CACHEABLE_PATHS.has(url.pathname);
  if(!isKnownStatic)return;

  event.respondWith((async()=>{
    try{
      const response=await fetch(request);
      if(response.ok&&response.type==='basic'){
        const cache=await caches.open(CACHE);
        cache.put(request,response.clone()).catch(()=>{});
      }
      return response;
    }catch{
      const cached=await caches.match(request);
      if(cached)return cached;
      if(request.mode==='navigate'){
        const fallback=await caches.match('/index.html');
        if(fallback)return fallback;
      }
      return Response.error();
    }
  })());
});
