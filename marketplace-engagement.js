(() => {
  'use strict';
  const cfg=window.DDH_CONFIG||{},base=String(cfg.supabaseUrl||'').replace(/\/$/,''),key=String(cfg.supabasePublishableKey||''),SESSION_KEY='ddh_supabase_session';
  const button=document.querySelector('#saveSearch'),toast=document.querySelector('#marketToast');const COMPARE_KEY='ddh_compare_devices';
  if(!base||!key)return;
  const val=id=>document.querySelector(id)?.value||'';
  const session=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
  function notify(message){if(!toast)return;toast.textContent=message;toast.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>toast.classList.remove('show'),2500)}
  function queryObject(){return {q:val('#searchInput'),category:val('#categoryFilter'),brand:val('#brandFilter'),condition:val('#conditionFilter'),min_price:val('#minPrice'),max_price:val('#maxPrice'),country:val('#countryFilter'),location:val('#locationFilter'),sort:val('#sortFilter')}}
  function nameFor(q){const parts=[q.q,q.brand&&q.brand!=='all'?q.brand:'',q.category&&q.category!=='all'?q.category:'',q.condition&&q.condition!=='all'?(q.condition==='new'?'New':'Used'):'',q.country&&q.country!=='all'?(window.DDH_COUNTRIES?.name?.(q.country)||q.country):''].filter(Boolean);return parts.join(' · ')||'Marketplace search'}
  async function api(path,{method='GET',body,prefer='return=minimal'}={}){const s=session();if(!s?.user?.id||!s?.access_token)throw new Error('Sign in to continue.');const r=await fetch(`${base}${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>null);if(!r.ok)throw new Error(data?.message||data?.error||'Request failed.');return data}
  button?.addEventListener('click',async()=>{
    const s=session();if(!s?.user?.id||!s?.access_token){location.href='/?signin=1';return}
    const query=queryObject();
    try{await api('/rest/v1/saved_searches',{method:'POST',body:{user_id:s.user.id,name:nameFor(query),query}});notify('Search saved. We will keep it in your account.')}catch(err){notify(err.message)}
  });
  function compareIds(){try{return JSON.parse(sessionStorage.getItem(COMPARE_KEY)||'[]').filter(x=>/^[0-9a-f-]{36}$/i.test(x)).slice(0,4)}catch{return []}}
  function setCompare(ids){try{sessionStorage.setItem(COMPARE_KEY,JSON.stringify(ids))}catch{}updateCompareTray()}
  function updateCompareTray(){
    const ids=compareIds(),tray=document.querySelector('#compareTray'),textEl=document.querySelector('#compareTrayText'),link=document.querySelector('#compareNow');
    if(!tray)return;tray.hidden=ids.length<2;textEl.textContent=`${ids.length} device${ids.length===1?'':'s'} selected`;link.href='/compare.html?ids='+encodeURIComponent(ids.join(','));
    document.querySelectorAll('[data-compare-id]').forEach(b=>b.classList.toggle('selected',ids.includes(b.dataset.compareId)));
  }
  document.addEventListener('click',event=>{
    const compare=event.target.closest?.('[data-compare-id]');if(!compare)return;
    event.preventDefault();event.stopPropagation();
    const id=compare.dataset.compareId,ids=compareIds(),at=ids.indexOf(id);
    if(at>=0)ids.splice(at,1);else if(ids.length>=4)return notify('Compare up to 4 devices at a time.');else ids.push(id);
    setCompare(ids);notify(at>=0?'Removed from comparison.':'Added to comparison.');
  });
  document.querySelector('#compareClear')?.addEventListener('click',()=>setCompare([]));
  new MutationObserver(updateCompareTray).observe(document.querySelector('#marketplaceGrid'),{childList:true});
  updateCompareTray();

  document.addEventListener('click',async event=>{
    const save=event.target.closest?.('[data-save-id]');if(!save)return;
    event.preventDefault();event.stopPropagation();
    const s=session();if(!s?.user?.id||!s?.access_token){location.href='/?signin=1';return}
    const listingId=save.dataset.saveId;
    try{
      await api('/rest/v1/favorites',{method:'POST',body:{user_id:s.user.id,listing_id:listingId}});
      save.textContent='♥';save.classList.add('saved');save.setAttribute('aria-label','Saved device');notify('Saved to favorites.');
    }catch(err){
      if(/duplicate|unique/i.test(err.message)){save.textContent='♥';save.classList.add('saved');notify('Already in your favorites.')}
      else notify(err.message);
    }
  });
})();