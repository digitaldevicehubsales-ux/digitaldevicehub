(() => {
  'use strict';
  const cfg=window.DDH_CONFIG||{};
  const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=String(cfg.supabasePublishableKey||'');
  const SESSION_KEY='ddh_supabase_session';
  const director=document.querySelector('#directorEntry');
  const admin=document.querySelector('#adminEntry');
  const adminTools=document.querySelector('#adminTools');
  const directorBanner=document.querySelector('#directorDashboardBanner');
  const directorBadge=document.querySelector('#directorAccountBadge');
  let s=null;try{s=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{}
  if(!s?.user?.id||!base||!key)return;

  const path=`/rest/v1/admin_users?select=role&user_id=eq.${encodeURIComponent(s.user.id)}&limit=1`;
  Promise.resolve(window.DDH_SESSION_COOKIE_READY).catch(()=>false)
    .then(async cookieReady=>{
      if(cookieReady){
        return fetch(`/api/supabase?path=${encodeURIComponent(path)}`,{headers:{Accept:'application/json'}});
      }
      if(!s?.access_token)return null;
      return fetch(`${base}${path}`,{headers:{apikey:key,Authorization:`Bearer ${s.access_token}`}});
    })
    .then(r=>r?.ok?r.json():[])
    .then(rows=>{
      const role=rows?.[0]?.role||'';
      const isAdmin=['admin','director'].includes(role);
      const isDirector=role==='director';
      if(admin&&isAdmin)admin.hidden=false;
      if(director&&isDirector)director.hidden=false;
      if(adminTools&&isAdmin)adminTools.hidden=false;
      if(directorBanner&&isDirector)directorBanner.hidden=false;
      if(directorBadge&&isDirector)directorBadge.hidden=false;
      if(isDirector)document.body.classList.add('role-director');
    }).catch(()=>{});
})();
