(() => {
  'use strict';
  const cfg=window.DDH_CONFIG||{};
  const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=String(cfg.supabasePublishableKey||'');
  const SESSION_KEY='ddh_supabase_session';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
  async function api(path,{method='GET',body,prefer=''}={}){const s=session();if(!s?.access_token)throw new Error('Please sign in first.');const headers={apikey:key,Authorization:`Bearer ${s.access_token}`};if(body!==undefined)headers['Content-Type']='application/json';if(prefer)headers.Prefer=prefer;const r=await fetch(`${base}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.message||e.error||`Request failed (${r.status})`)}if(r.status===204)return null;const t=await r.text();return t?JSON.parse(t):null}
  function money(a,c='NGN'){try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:4}).format(Number(a)||0)}catch{return `${c} ${Number(a||0).toLocaleString()}`}}

  function addNavigation(){
    const nav=document.querySelector('.dash-nav');if(!nav||nav.querySelector('[data-view="notifications"]'))return;
    const profile=nav.querySelector('[data-view="profile"]');
    const saved=document.createElement('button');saved.className='nav-item';saved.dataset.view='saved';saved.textContent='Saved & Recent';
    const notifications=document.createElement('button');notifications.className='nav-item';notifications.dataset.view='notifications';notifications.innerHTML='Notifications <span id="notificationBadge" class="nav-badge" hidden>0</span>';
    nav.insertBefore(saved,profile);nav.insertBefore(notifications,profile);
    const mobile=document.querySelector('.mobile-nav');if(mobile&&!mobile.querySelector('[data-view="saved"]')){const btn=document.createElement('button');btn.dataset.view='saved';btn.textContent='Saved';mobile.insertBefore(btn,mobile.lastElementChild)}
  }

  function addPanels(){
    const main=document.querySelector('.dashboard-main');if(!main||main.querySelector('[data-panel="saved"]'))return;
    const saved=document.createElement('section');saved.className='dash-view';saved.dataset.panel='saved';saved.innerHTML=`<div class="two-column"><article class="panel"><div class="panel-heading"><div><p class="eyebrow">Discovery tools</p><h2>Saved searches</h2><p>Return to searches you care about without rebuilding filters.</p></div><a class="primary-button" href="/marketplace.html">Find devices</a></div><div id="savedSearchList" class="activity-list"></div></article><article class="panel"><div class="panel-heading"><div><p class="eyebrow">Continue browsing</p><h2>Recently viewed</h2><p>Your most recent signed-in device views.</p></div></div><div id="recentlyViewedList" class="activity-list"></div></article></div>`;
    const notifications=document.createElement('section');notifications.className='dash-view';notifications.dataset.panel='notifications';notifications.innerHTML=`<article class="panel"><div class="panel-heading"><div><p class="eyebrow">Account updates</p><h2>Notifications</h2><p>Listing approvals, price drops and marketplace messages appear here.</p></div><button class="secondary-button" id="markAllNotifications">Mark all read</button></div><div id="notificationList" class="activity-list"></div></article>`;
    const profile=main.querySelector('[data-panel="profile"]');main.insertBefore(saved,profile);main.insertBefore(notifications,profile);
  }

  function hookNav(){
    document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{const name=btn.dataset.view;document.querySelectorAll('[data-panel]').forEach(el=>el.classList.toggle('active',el.dataset.panel===name));document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===name));const title={saved:'Saved & Recent',notifications:'Notifications'}[name];if(title)document.querySelector('#pageTitle').textContent=title;window.scrollTo({top:0,behavior:'smooth'})}));
  }

  function searchUrl(q){const p=new URLSearchParams();if(q.q)p.set('q',q.q);if(q.category&&q.category!=='all')p.set('category',q.category);if(q.brand&&q.brand!=='all')p.set('brand',q.brand);if(q.condition&&q.condition!=='all')p.set('condition',q.condition);if(q.location)p.set('location',q.location);if(q.min_price)p.set('min',q.min_price);if(q.max_price)p.set('max',q.max_price);return `/marketplace.html?${p.toString()}`}

  async function loadSaved(){const el=document.querySelector('#savedSearchList');if(!el)return;try{const rows=await api('/rest/v1/saved_searches?select=id,name,query,created_at&order=created_at.desc&limit=20');el.innerHTML=(rows||[]).map(x=>`<div class="activity-item engagement-row"><div><strong>${esc(x.name)}</strong><span>${new Date(x.created_at).toLocaleDateString()}</span></div><div class="engagement-actions"><a class="mini-button primary" href="${esc(searchUrl(x.query||{}))}">Open</a><button class="mini-button" data-delete-search="${esc(x.id)}">Delete</button></div></div>`).join('')||'<div class="empty-box">No saved searches yet. Use “Save search” in the marketplace.</div>';el.querySelectorAll('[data-delete-search]').forEach(btn=>btn.onclick=async()=>{await api(`/rest/v1/saved_searches?id=eq.${encodeURIComponent(btn.dataset.deleteSearch)}`,{method:'DELETE'});loadSaved()})}catch(err){el.innerHTML=`<div class="empty-box">${esc(err.message)}</div>`}}

  async function loadRecent(){const el=document.querySelector('#recentlyViewedList');if(!el)return;try{const rows=await api('/rest/v1/recently_viewed?select=listing_id,viewed_at&order=viewed_at.desc&limit=12');const ids=(rows||[]).map(x=>x.listing_id);if(!ids.length){el.innerHTML='<div class="empty-box">Devices you open while signed in will appear here.</div>';return}const list=ids.map(x=>`\"${x}\"`).join(',');const listings=await api(`/rest/v1/listings?select=id,title,price_amount,price_currency,status&id=in.(${encodeURIComponent(list)})`);const map=new Map((listings||[]).map(x=>[x.id,x]));el.innerHTML=rows.map(r=>{const x=map.get(r.listing_id);if(!x)return'';return `<a class="activity-item recent-link" href="/device.html?id=${encodeURIComponent(x.id)}"><div><strong>${esc(x.title)}</strong><span>${esc(money(x.price_amount,x.price_currency))} · ${new Date(r.viewed_at).toLocaleDateString()}</span></div><span>→</span></a>`}).join('')||'<div class="empty-box">No recently viewed public devices.</div>'}catch(err){el.innerHTML=`<div class="empty-box">${esc(err.message)}</div>`}}

  async function loadNotifications(){const el=document.querySelector('#notificationList');if(!el)return;try{const rows=await api('/rest/v1/notifications?select=id,kind,title,body,listing_id,read_at,created_at&order=created_at.desc&limit=50');const unread=(rows||[]).filter(x=>!x.read_at).length;const badge=document.querySelector('#notificationBadge');if(badge){badge.hidden=!unread;badge.textContent=String(unread)}el.innerHTML=(rows||[]).map(x=>`<button class="activity-item notification-item ${x.read_at?'':'unread'}" data-notification="${esc(x.id)}" data-listing="${esc(x.listing_id||'')}"><div><strong>${esc(x.title)}</strong><span>${esc(x.body)} · ${new Date(x.created_at).toLocaleString()}</span></div><span>${x.read_at?'':'New'}</span></button>`).join('')||'<div class="empty-box">No notifications yet.</div>';el.querySelectorAll('[data-notification]').forEach(btn=>btn.onclick=async()=>{await api(`/rest/v1/notifications?id=eq.${encodeURIComponent(btn.dataset.notification)}`,{method:'PATCH',body:{read_at:new Date().toISOString()},prefer:'return=minimal'});if(btn.dataset.listing)location.href=`/device.html?id=${encodeURIComponent(btn.dataset.listing)}`;else loadNotifications()})}catch(err){el.innerHTML=`<div class="empty-box">${esc(err.message)}</div>`}}

  async function markAllRead(){try{await api('/rest/v1/notifications?read_at=is.null',{method:'PATCH',body:{read_at:new Date().toISOString()},prefer:'return=minimal'});loadNotifications()}catch{}}

  async function init(){if(!session()?.access_token)return;addNavigation();addPanels();hookNav();document.querySelector('#markAllNotifications')?.addEventListener('click',markAllRead);await Promise.allSettled([loadSaved(),loadRecent(),loadNotifications()])}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();