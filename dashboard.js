(() => {
  'use strict';

  const cfg = window.DDH_CONFIG || {};
  const supabaseUrl = String(cfg.supabaseUrl || '').replace(/\/$/, '');
  const supabaseKey = String(cfg.supabasePublishableKey || '');
  const SESSION_KEY = 'ddh_supabase_session';
  const dialog = document.querySelector('#dashboardDialog');
  const dialogContent = document.querySelector('#dashboardDialogContent');
  const toast = document.querySelector('#toast');

  let session = null;
  let profile = null;
  let listings = [];
  let images = new Map();
  let stats = new Map();
  let trend = [];
  let conversations = [];
  let messages = [];
  let favorites = [];
  let favoriteListings = [];

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const titleCase = value => String(value || '').replace(/^./, c => c.toUpperCase());
  const validCurrency = value => /^[A-Z]{3}$/.test(String(value || '').toUpperCase()) ? String(value).toUpperCase() : '';
  const money = (amount,currency='NGN') => {
    const code = validCurrency(currency) || 'NGN';
    try{return new Intl.NumberFormat(undefined,{style:'currency',currency:code,maximumFractionDigits:4}).format(Number(amount)||0)}
    catch{return `${code} ${Number(amount||0).toLocaleString()}`}
  };
  const publicImageUrl = path => path ? `${supabaseUrl}/storage/v1/object/public/listing-images/${String(path).split('/').map(encodeURIComponent).join('/')}` : '';

  function notify(message){
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(notify.timer);
    notify.timer=setTimeout(()=>toast.classList.remove('show'),2600);
  }

  function saveSession(data){
    if(!data?.access_token){session=null;localStorage.removeItem(SESSION_KEY);return;}
    session={...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};
    localStorage.setItem(SESSION_KEY,JSON.stringify(session));
  }

  function loadSession(){
    try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{session=null}
  }

  async function authRequest(path,body){
    const res=await fetch(`${supabaseUrl}${path}`,{method:'POST',headers:{apikey:supabaseKey,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.message||data.msg||data.error||'Authentication failed.');
    return data;
  }

  async function ensureSession(){
    if(!session?.access_token) return null;
    if(Number(session.expires_at||0)>Math.floor(Date.now()/1000)+60) return session;
    if(!session.refresh_token){saveSession(null);return null;}
    try{saveSession(await authRequest('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token}));return session}
    catch{saveSession(null);return null}
  }

  async function apiFetch(path,{method='GET',body,headers={}}={}){
    await ensureSession();
    if(!session?.access_token) throw new Error('Please sign in first.');
    const finalHeaders={apikey:supabaseKey,Authorization:`Bearer ${session.access_token}`,...headers};
    if(body!==undefined&&!finalHeaders['Content-Type']) finalHeaders['Content-Type']='application/json';
    const res=await fetch(`${supabaseUrl}${path}`,{method,headers:finalHeaders,body:body===undefined?undefined:JSON.stringify(body)});
    if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.message||err.details||err.error||`Request failed (${res.status}).`)}
    if(res.status===204)return null;
    const text=await res.text();return text?JSON.parse(text):null;
  }

  async function rpc(name,body={}){
    return apiFetch(`/rest/v1/rpc/${name}`,{method:'POST',body});
  }

  function showPanel(name){
    document.querySelectorAll('[data-panel]').forEach(el=>el.classList.toggle('active',el.dataset.panel===name));
    document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===name));
    document.querySelector('#pageTitle').textContent=({overview:'Overview',listings:'My Listings',analytics:'Analytics',messages:'Messages',favorites:'Favorites',profile:'Profile & Settings'})[name]||'Dashboard';
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function statusPill(status){return `<span class="status-pill status-${esc(status)}">${esc(titleCase(status))}</span>`}

  function statFor(id){return stats.get(id)||{impressions:0,views:0,unique_visitors:0,favorites:0,buyer_messages:0,shares:0}}

  function imageFor(id){const path=images.get(id);return path?`<img src="${esc(publicImageUrl(path))}" alt="" />`:'▯'}

  function renderKpis(){
    const published=listings.filter(x=>x.status==='published').length;
    const totals=[...stats.values()].reduce((a,s)=>({views:a.views+Number(s.views||0),unique:a.unique+Number(s.unique_visitors||0),messages:a.messages+Number(s.buyer_messages||0),favorites:a.favorites+Number(s.favorites||0)}),{views:0,unique:0,messages:0,favorites:0});
    document.querySelector('#overviewKpis').innerHTML=`<article class="kpi"><span>Active listings</span><strong>${published}</strong><small>${listings.length} total listings</small></article><article class="kpi"><span>Product views</span><strong>${totals.views.toLocaleString()}</strong><small>${totals.unique.toLocaleString()} unique visitors</small></article><article class="kpi"><span>Buyer messages</span><strong>${totals.messages.toLocaleString()}</strong><small>Conversations started</small></article><article class="kpi"><span>Favorites received</span><strong>${totals.favorites.toLocaleString()}</strong><small>Saved by buyers</small></article>`;
    document.querySelector('#analyticsKpis').innerHTML=`<article class="kpi"><span>Total clicks</span><strong>${totals.views.toLocaleString()}</strong><small>Listing opens</small></article><article class="kpi"><span>Unique visitors</span><strong>${totals.unique.toLocaleString()}</strong><small>Distinct marketplace visitors</small></article><article class="kpi"><span>Buyer interest</span><strong>${(totals.messages+totals.favorites).toLocaleString()}</strong><small>Favorites + conversations</small></article><article class="kpi"><span>Published products</span><strong>${published}</strong><small>Currently visible</small></article>`;
  }

  function lineChart(rows,days){
    const now=new Date();
    const labels=[];const values=[];
    const byDay=new Map();
    for(const r of rows){byDay.set(r.day,(byDay.get(r.day)||0)+Number(r.views||0));}
    for(let i=days-1;i>=0;i--){const d=new Date(now);d.setUTCDate(d.getUTCDate()-i);const key=d.toISOString().slice(0,10);labels.push(key);values.push(byDay.get(key)||0)}
    const max=Math.max(1,...values);const w=720,h=220,p=22;
    const pts=values.map((v,i)=>{const x=p+(i*(w-2*p)/Math.max(1,values.length-1));const y=h-p-(v/max)*(h-2*p);return [x,y]});
    const path=pts.map((pnt,i)=>`${i?'L':'M'}${pnt[0].toFixed(1)},${pnt[1].toFixed(1)}`).join(' ');
    const area=`M${p},${h-p} ${path.replace(/^M/,'L')} L${w-p},${h-p} Z`;
    const ticks=[0,.25,.5,.75,1].map(t=>`<line class="chart-grid" x1="${p}" x2="${w-p}" y1="${h-p-t*(h-2*p)}" y2="${h-p-t*(h-2*p)}"/>`).join('');
    const first=labels[0]||'',last=labels.at(-1)||'';
    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Views trend">${ticks}<path class="chart-area" d="${area}"/><path class="chart-line" d="${path}"/><text class="chart-label" x="${p}" y="${h-3}">${esc(first.slice(5))}</text><text class="chart-label" text-anchor="end" x="${w-p}" y="${h-3}">${esc(last.slice(5))}</text></svg>`;
  }

  function renderOverview(){
    document.querySelector('#welcomeTitle').textContent=profile?.display_name?`Welcome back, ${profile.display_name}.`:'Your marketplace at a glance.';
    document.querySelector('#overviewChart').innerHTML=lineChart(trend,30);
    const pending=listings.filter(x=>x.status==='pending').length;
    const rejected=listings.filter(x=>x.status==='rejected').length;
    const paused=listings.filter(x=>x.status==='paused').length;
    const items=[];
    if(pending)items.push(`<div class="activity-item"><strong>${pending} listing${pending>1?'s':''} pending review</strong><span>They will appear publicly after approval.</span></div>`);
    if(rejected)items.push(`<div class="activity-item"><strong>${rejected} listing${rejected>1?'s':''} need changes</strong><span>Edit and resubmit them from My Listings.</span></div>`);
    if(paused)items.push(`<div class="activity-item"><strong>${paused} paused listing${paused>1?'s':''}</strong><span>Resume them whenever inventory is available.</span></div>`);
    if(conversations.length)items.push(`<div class="activity-item"><strong>${conversations.length} active conversation${conversations.length>1?'s':''}</strong><span>Keep buyer responses timely.</span></div>`);
    document.querySelector('#attentionList').innerHTML=items.join('')||'<div class="empty-box">Nothing needs attention right now.</div>';
    const ranked=[...listings].sort((a,b)=>Number(statFor(b.id).views)-Number(statFor(a.id).views)).slice(0,4);
    document.querySelector('#topListings').innerHTML=ranked.map(x=>`<div class="compact-row"><strong>${esc(x.title)}</strong><span>${money(x.price_amount,x.price_currency)} · ${Number(statFor(x.id).views).toLocaleString()} views · ${Number(statFor(x.id).buyer_messages).toLocaleString()} conversations</span></div>`).join('')||'<div class="empty-box">Your listings will appear here.</div>';
  }

  function actionButtons(x){
    const buttons=[`<button class="mini-button primary" data-edit="${x.id}">Edit</button>`];
    if(x.status==='published')buttons.push(`<button class="mini-button" data-status="paused" data-id="${x.id}">Pause</button>`);
    if(x.status==='paused')buttons.push(`<button class="mini-button" data-status="published" data-id="${x.id}">Resume</button>`);
    if(['published','paused'].includes(x.status))buttons.push(`<button class="mini-button" data-status="sold" data-id="${x.id}">Mark sold</button>`);
    if(!['archived','sold'].includes(x.status))buttons.push(`<button class="mini-button" data-status="archived" data-id="${x.id}">Archive</button>`);
    return buttons.join('');
  }

  function renderListings(){
    document.querySelector('#myListings').innerHTML=listings.map(x=>{const s=statFor(x.id);return `<article class="manager-card"><div class="manager-image">${imageFor(x.id)}</div><div class="manager-meta"><h3>${esc(x.title)}</h3><p>${money(x.price_amount,x.price_currency)} · ${esc(titleCase(x.condition))} · ${esc(x.storage||'No storage specified')}</p><p>${statusPill(x.status)} &nbsp; ${Number(s.views).toLocaleString()} views · ${Number(s.unique_visitors).toLocaleString()} unique visitors</p></div><div class="manager-actions">${actionButtons(x)}</div></article>`}).join('')||'<div class="empty-box">No listings yet. List your first device from the marketplace.</div>';
  }

  function renderAnalytics(){
    document.querySelector('#analyticsChart').innerHTML=lineChart(trend,Number(document.querySelector('#analyticsRange').value||30));
    document.querySelector('#analyticsTable').innerHTML=listings.length?`<table><thead><tr><th>Listing</th><th>Status</th><th>Impressions</th><th>Clicks</th><th>Unique</th><th>Favorites</th><th>Messages</th></tr></thead><tbody>${listings.map(x=>{const s=statFor(x.id);return `<tr><td><strong>${esc(x.title)}</strong><br><small>${esc(money(x.price_amount,x.price_currency))}</small></td><td>${statusPill(x.status)}</td><td>${Number(s.impressions).toLocaleString()}</td><td>${Number(s.views).toLocaleString()}</td><td>${Number(s.unique_visitors).toLocaleString()}</td><td>${Number(s.favorites).toLocaleString()}</td><td>${Number(s.buyer_messages).toLocaleString()}</td></tr>`}).join('')}</tbody></table>`:'<div class="empty-box">Analytics starts after you publish a listing.</div>';
    const all=[...stats.values()];const views=all.reduce((n,s)=>n+Number(s.views||0),0),interest=all.reduce((n,s)=>n+Number(s.favorites||0)+Number(s.buyer_messages||0),0);
    let head='Your performance data will build as buyers discover your listings.',body='Clicks, unique visitors, favorites and conversations are tracked without exposing a buyer’s precise location.';
    if(views>=20&&interest===0){head='People are viewing your products, but buyer interest is still low.';body='Try stronger product photos, clearer descriptions or a price adjustment before changing the product itself.'}
    else if(interest>=5){head='Your listings are generating meaningful buyer interest.';body='Respond quickly to conversations and keep availability and pricing current to preserve momentum.'}
    document.querySelector('#performanceInsight').textContent=head;document.querySelector('#performanceInsightBody').textContent=body;
  }

  function renderMessages(){
    const latest=new Map();for(const m of messages){if(!latest.has(m.conversation_id))latest.set(m.conversation_id,m)}
    document.querySelector('#messageList').innerHTML=conversations.map(c=>{const item=listings.find(x=>x.id===c.listing_id);const m=latest.get(c.id);const role=c.seller_id===session.user.id?'Buyer conversation':'Seller conversation';return `<button class="message-row" data-conversation="${c.id}"><div><h3>${esc(item?.title||'Marketplace conversation')}</h3><span>${esc(role)}${m?` · ${esc(String(m.body).slice(0,90))}`:''}</span></div><span>${m?new Date(m.created_at).toLocaleDateString():new Date(c.created_at).toLocaleDateString()}</span></button>`}).join('')||'<div class="empty-box">No conversations yet.</div>';
  }

  function renderFavorites(){
    document.querySelector('#favoriteList').innerHTML=favoriteListings.map(x=>`<article class="favorite-card"><h3>${esc(x.title)}</h3><p>${esc(titleCase(x.condition))} · ${esc(x.storage||'Details available')}</p><p class="price" data-price-amount="${esc(x.price_amount)}" data-price-currency="${esc(x.price_currency)}">${esc(money(x.price_amount,x.price_currency))}</p><a href="/#marketplace">View marketplace →</a></article>`).join('')||'<div class="empty-box">Devices you save will appear here.</div>';
    window.DDH_LOCALIZATION?.refresh?.();
  }

  function renderProfile(){
    const form=document.querySelector('#profileForm');form.elements.display_name.value=profile?.display_name||'';form.elements.city.value=profile?.city||'';
    document.querySelector('#profileEmail').value=session?.user?.email||'';
    document.querySelector('#profileCurrency').value=profile?.currency_code||window.DDH_LOCALIZATION?.state?.currency||'NGN';
  }

  function renderAll(){renderKpis();renderOverview();renderListings();renderAnalytics();renderMessages();renderFavorites();renderProfile()}

  function currencyOptions(selected){
    let codes=[];try{codes=Intl.supportedValuesOf?.('currency')||[]}catch{}
    if(!codes.length)codes=['NGN','USD','GBP','EUR','GHS','ZAR','KES','CAD','AUD','JPY','CNY','INR','AED'];
    if(selected&&!codes.includes(selected))codes.push(selected);
    return [...new Set(codes)].sort().map(c=>`<option value="${c}" ${c===selected?'selected':''}>${c}</option>`).join('');
  }

  function openEdit(id){
    const x=listings.find(item=>item.id===id);if(!x)return;
    dialogContent.innerHTML=`<div><p class="eyebrow">Edit listing</p><h2>${esc(x.title)}</h2><p>Price and availability changes can stay live. Major identity changes are sent back for review.</p><form id="editListingForm" class="edit-form"><label>Category<select name="category"><option ${x.category==='Phones'?'selected':''}>Phones</option><option ${x.category==='Laptops'?'selected':''}>Laptops</option><option ${x.category==='Tablets'?'selected':''}>Tablets</option><option ${x.category==='Accessories'?'selected':''}>Accessories</option><option ${x.category==='Wearables'?'selected':''}>Wearables</option></select></label><label>Condition<select name="condition"><option value="new" ${x.condition==='new'?'selected':''}>New</option><option value="used" ${x.condition==='used'?'selected':''}>Used</option></select></label><label>Brand<input name="brand" value="${esc(x.brand)}" required maxlength="80" /></label><label>Model<input name="model" value="${esc(x.model)}" required maxlength="100" /></label><label>Storage<input name="storage" value="${esc(x.storage||'')}" maxlength="60" /></label><label>City<input name="city" value="${esc(x.city||'')}" maxlength="80" /></label><label>Asking price<input name="price" type="number" min="0.0001" step="0.0001" value="${esc(x.price_amount)}" required /></label><label>Currency<select name="currency">${currencyOptions(x.price_currency)}</select></label><label class="full">Description<textarea name="description" rows="5" maxlength="2000">${esc(x.description||'')}</textarea></label><div class="full dialog-actions"><button class="primary-button" type="submit">Save changes</button><button class="secondary-button" type="button" data-cancel>Cancel</button></div></form></div>`;
    dialog.showModal();
    dialogContent.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialogContent.querySelector('#editListingForm').onsubmit=e=>saveEdit(e,x);
  }

  async function saveEdit(event,original){
    event.preventDefault();const form=new FormData(event.currentTarget);
    const price=Number(form.get('price'));const currency=validCurrency(form.get('currency'));
    if(!Number.isFinite(price)||price<=0||!currency)return notify('Enter a valid price and currency.');
    const category=String(form.get('category'));const brand=String(form.get('brand')).trim();const model=String(form.get('model')).trim();
    const identityChanged=category!==original.category||brand!==original.brand||model!==original.model;
    let nextStatus=original.status;
    if(original.status==='rejected'||(original.status==='published'&&identityChanged))nextStatus='pending';
    const payload={category,brand,model,title:`${brand} ${model}`.trim(),condition:String(form.get('condition')),storage:String(form.get('storage')).trim()||null,city:String(form.get('city')).trim()||null,description:String(form.get('description')).trim(),price_amount:Math.round(price*10000)/10000,price_currency:currency,price_ngn:currency==='NGN'?Math.round(price):null,status:nextStatus};
    try{await apiFetch(`/rest/v1/listings?id=eq.${encodeURIComponent(original.id)}`,{method:'PATCH',body:payload,headers:{Prefer:'return=minimal'}});dialog.close();notify(nextStatus==='pending'&&original.status==='published'?'Changes saved and sent for review.':'Listing updated.');await loadData();}
    catch(err){notify(err.message)}
  }

  async function setStatus(id,status){
    const payload={status};if(status==='paused')payload.paused_at=new Date().toISOString();if(status==='sold')payload.sold_at=new Date().toISOString();if(status==='published')payload.paused_at=null;
    try{await apiFetch(`/rest/v1/listings?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:payload,headers:{Prefer:'return=minimal'}});notify(status==='published'?'Listing resumed.':`Listing marked ${status}.`);await loadData()}
    catch(err){notify(err.message)}
  }

  async function openConversation(id){
    const c=conversations.find(x=>x.id===id);if(!c)return;const item=listings.find(x=>x.id===c.listing_id);const rows=messages.filter(x=>x.conversation_id===id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    dialogContent.innerHTML=`<div><p class="eyebrow">Conversation</p><h2>${esc(item?.title||'Device')}</h2><div class="activity-list">${rows.map(m=>`<div class="activity-item"><strong>${m.sender_id===session.user.id?'You':'Other user'}</strong><span>${esc(m.body)}</span></div>`).join('')||'<p>No messages yet.</p>'}</div><form id="replyForm" class="form-grid"><label>Reply<textarea name="body" rows="4" maxlength="4000" required></textarea></label><button class="primary-button" type="submit">Send reply</button></form></div>`;dialog.showModal();
    dialogContent.querySelector('#replyForm').onsubmit=async e=>{e.preventDefault();const body=String(new FormData(e.currentTarget).get('body')||'').trim();if(!body)return;try{await apiFetch('/rest/v1/messages',{method:'POST',body:{conversation_id:id,sender_id:session.user.id,body},headers:{Prefer:'return=minimal'}});notify('Message sent.');dialog.close();await loadData()}catch(err){notify(err.message)}};
  }

  async function loadData(){
    const uid=session.user.id;
    const [profileRows,listingRows,statRows,trendRows,conversationRows,messageRows,favoriteRows]=await Promise.all([
      apiFetch(`/rest/v1/profiles?select=id,display_name,city,country_code,currency_code&id=eq.${encodeURIComponent(uid)}&limit=1`).catch(()=>[]),
      apiFetch(`/rest/v1/listings?select=id,title,category,brand,model,condition,price_amount,price_currency,price_ngn,description,storage,city,status,created_at,updated_at,paused_at,sold_at&seller_id=eq.${encodeURIComponent(uid)}&order=created_at.desc`).catch(()=>[]),
      rpc('get_my_listing_stats').catch(()=>[]),
      rpc('get_my_listing_trend',{p_days:Number(document.querySelector('#analyticsRange').value||30)}).catch(()=>[]),
      apiFetch(`/rest/v1/conversations?select=id,listing_id,buyer_id,seller_id,created_at&or=(buyer_id.eq.${uid},seller_id.eq.${uid})&order=created_at.desc`).catch(()=>[]),
      apiFetch('/rest/v1/messages?select=id,conversation_id,sender_id,body,created_at&order=created_at.desc&limit=100').catch(()=>[]),
      apiFetch(`/rest/v1/favorites?select=listing_id,created_at&user_id=eq.${encodeURIComponent(uid)}&order=created_at.desc`).catch(()=>[])
    ]);
    profile=profileRows?.[0]||null;listings=listingRows||[];stats=new Map((statRows||[]).map(s=>[s.listing_id,s]));trend=trendRows||[];conversations=conversationRows||[];messages=messageRows||[];favorites=favoriteRows||[];
    const listingIds=listings.map(x=>x.id);images=new Map();if(listingIds.length){const inList=listingIds.map(id=>`"${id}"`).join(',');const rows=await apiFetch(`/rest/v1/listing_images?select=listing_id,storage_path,sort_order&listing_id=in.(${encodeURIComponent(inList)})&order=sort_order.asc`).catch(()=>[]);for(const row of rows||[])if(!images.has(row.listing_id))images.set(row.listing_id,row.storage_path)}
    const favoriteIds=[...new Set(favorites.map(x=>x.listing_id))];favoriteListings=[];if(favoriteIds.length){const inList=favoriteIds.map(id=>`"${id}"`).join(',');favoriteListings=await apiFetch(`/rest/v1/listings?select=id,title,condition,storage,price_amount,price_currency&id=in.(${encodeURIComponent(inList)})`).catch(()=>[])}
    renderAll();
  }

  async function saveProfile(event){
    event.preventDefault();const form=new FormData(event.currentTarget);const body={display_name:String(form.get('display_name')).trim()||'DigitalDeviceHub user',city:String(form.get('city')).trim()||null};
    try{await apiFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}`,{method:'PATCH',body,headers:{Prefer:'return=minimal'}});notify('Profile saved.');await loadData()}
    catch(err){notify(err.message)}
  }

  async function signOut(){
    try{await fetch(`${supabaseUrl}/auth/v1/logout`,{method:'POST',headers:{apikey:supabaseKey,Authorization:`Bearer ${session.access_token}`}})}catch{}
    saveSession(null);window.location.href='/';
  }

  async function initialize(){
    loadSession();await ensureSession();
    if(!session?.user?.id){document.querySelector('#authGate').hidden=false;document.querySelectorAll('.dash-view').forEach(x=>x.classList.remove('active'));return;}
    document.querySelector('#profileEmail').value=session.user.email||'';
    await loadData();
  }

  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>showPanel(btn.dataset.view)));
  document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>showPanel(btn.dataset.go)));
  document.querySelector('#myListings').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit)return openEdit(edit.dataset.edit);const status=e.target.closest('[data-status]');if(status)setStatus(status.dataset.id,status.dataset.status)});
  document.querySelector('#messageList').addEventListener('click',e=>{const row=e.target.closest('[data-conversation]');if(row)openConversation(row.dataset.conversation)});
  document.querySelector('#analyticsRange').addEventListener('change',async()=>{trend=await rpc('get_my_listing_trend',{p_days:Number(document.querySelector('#analyticsRange').value)}).catch(()=>[]);renderAnalytics()});
  document.querySelector('#profileForm').addEventListener('submit',saveProfile);
  document.querySelector('#signOutButton').addEventListener('click',signOut);
  document.querySelector('#dashboardDialog .dialog-close').addEventListener('click',()=>dialog.close());

  initialize().catch(err=>{console.error(err);notify('Dashboard could not load. Refresh and try again.')});
})();

;(() => {try{const s=JSON.parse(localStorage.getItem('ddh_supabase_session')||'null');const token=String(s?.access_token||'').split('.')[1];if(!token)return;const payload=JSON.parse(atob(token.replace(/-/g,'+').replace(/_/g,'/')));if(payload?.app_metadata?.role==='admin'){const el=document.querySelector('#adminEntry');if(el)el.hidden=false}}catch{}})();
