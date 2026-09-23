(() => {
  'use strict';
  const cfg=window.DDH_CONFIG||{};
  const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=String(cfg.supabasePublishableKey||'');
  const SESSION_KEY='ddh_supabase_session';
  const director=document.querySelector('#directorEntry');
  const admin=document.querySelector('#adminEntry');
  let s=null;try{s=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{}
  if(!s?.user?.id||!s?.access_token||!base||!key)return;
  fetch(`${base}/rest/v1/admin_users?select=role&user_id=eq.${encodeURIComponent(s.user.id)}&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${s.access_token}`}})
    .then(r=>r.ok?r.json():[])
    .then(rows=>{
      const role=rows?.[0]?.role||'';
      if(admin&&['admin','director'].includes(role))admin.hidden=false;
      if(director&&role==='director')director.hidden=false;
    }).catch(()=>{});
})();
