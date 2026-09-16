(() => {
  'use strict';
  const cfg=window.DDH_CONFIG||{};
  const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=String(cfg.supabasePublishableKey||'');
  const SESSION_KEY='ddh_supabase_session';
  const button=document.querySelector('#saveSearch');
  const toast=document.querySelector('#marketToast');
  if(!button||!base||!key)return;

  const val=id=>document.querySelector(id)?.value||'';
  const session=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
  function notify(message){if(!toast)return;toast.textContent=message;toast.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>toast.classList.remove('show'),2500)}
  function queryObject(){return {q:val('#searchInput'),category:val('#categoryFilter'),brand:val('#brandFilter'),condition:val('#conditionFilter'),min_price:val('#minPrice'),max_price:val('#maxPrice'),location:val('#locationFilter'),sort:val('#sortFilter')}}
  function nameFor(q){const parts=[q.q,q.brand&&q.brand!=='all'?q.brand:'',q.category&&q.category!=='all'?q.category:'',q.condition&&q.condition!=='all'?(q.condition==='new'?'New':'Used'):''].filter(Boolean);return parts.join(' · ')||'Marketplace search'}

  button.addEventListener('click',async()=>{
    const s=session();
    if(!s?.user?.id||!s?.access_token){location.href='/?signin=1';return;}
    const query=queryObject();
    try{
      const res=await fetch(`${base}/rest/v1/saved_searches`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({user_id:s.user.id,name:nameFor(query),query})});
      if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.message||'Could not save this search.');}
      notify('Search saved to your account.');
    }catch(err){notify(err.message)}
  });
})();