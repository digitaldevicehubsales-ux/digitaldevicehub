(() => {
  'use strict';
  const cfg=window.DDH_CONFIG||{};
  const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=String(cfg.supabasePublishableKey||'');
  const id=new URLSearchParams(location.search).get('id');
  const SESSION_KEY='ddh_supabase_session';
  const VISITOR_KEY='ddh_visitor_id';
  let listing=null,seller=null,images=[];

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(a,c)=>{try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c||'NGN',maximumFractionDigits:4}).format(Number(a)||0)}catch{return `${c||'NGN'} ${Number(a||0).toLocaleString()}`}};
  const publicImage=p=>p?`${base}/storage/v1/object/public/listing-images/${String(p).split('/').map(encodeURIComponent).join('/')}`:'';
  const session=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
  function visitor(){let v='';try{v=localStorage.getItem(VISITOR_KEY)||''}catch{}if(!/^[0-9a-f-]{36}$/i.test(v)){v=crypto.randomUUID();try{localStorage.setItem(VISITOR_KEY,v)}catch{}}return v}
  async function get(path,auth=false){const s=session();const headers={apikey:key};if(auth&&s?.access_token)headers.Authorization=`Bearer ${s.access_token}`;const r=await fetch(`${base}${path}`,{headers});if(!r.ok)throw new Error(`Request failed (${r.status})`);return r.json()}
  async function write(path,method,body){const s=session();if(!s?.access_token)throw new Error('Sign in to continue.');const r=await fetch(`${base}${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)});const data=await r.json().catch(()=>[]);if(!r.ok)throw new Error(data.message||data.error||`Request failed (${r.status})`);return data}
  function toast(t){const el=document.querySelector('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2600)}
  function modal(html){document.querySelector('#deviceDialogContent').innerHTML=html;document.querySelector('#deviceDialog').showModal()}

  async function recordView(){
    if(!listing)return;
    const s=session();
    const country=String(window.DDH_LOCALIZATION?.state?.country||'').toUpperCase();
    fetch(`${base}/rest/v1/listing_events`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',Prefer:'return=minimal',...(s?.access_token?{Authorization:`Bearer ${s.access_token}`}:{})},body:JSON.stringify({listing_id:listing.id,visitor_id:visitor(),user_id:s?.user?.id||null,event_type:'view',country_code:/^[A-Z]{2}$/.test(country)?country:null}),keepalive:true}).catch(()=>{});
    if(s?.user?.id&&s.user.id!==listing.seller_id){
      fetch(`${base}/rest/v1/recently_viewed`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:s.user.id,listing_id:listing.id,viewed_at:new Date().toISOString()})}).catch(()=>{});
    }
  }

  function specRows(){
    const s=listing.specs||{};
    const rows=[
      ['Category',listing.category],['Condition',listing.condition==='new'?'New':'Used'],['Brand',listing.brand],['Model',listing.model],
      ['Storage',listing.storage],['Colour',listing.color],['Battery health',s.battery_health],['Network status',s.network_status],
      ['Repairs',s.repair_history],['Included',s.accessories],['Delivery',String(listing.delivery_mode||'pickup').replaceAll('_',' ')],
      ['Warranty',listing.warranty_text],['Location',[listing.city,listing.country_code].filter(Boolean).join(', ')]
    ].filter(x=>x[1]);
    return rows.map(([a,b])=>`<div class="spec"><span>${esc(a)}</span><strong>${esc(String(b))}</strong></div>`).join('');
  }

  function renderGallery(){
    const main=document.querySelector('#galleryMain');
    const thumbs=document.querySelector('#galleryThumbs');
    if(!images.length){
      main.innerHTML='<div class="gallery-empty" aria-label="No product photo available">▯</div>';
      thumbs.innerHTML='';
      return;
    }
    const show=index=>{
      const img=images[index];
      main.innerHTML=`<img src="${esc(publicImage(img.storage_path))}" alt="${esc(listing.title)} photo ${index+1}" width="1200" height="900">`;
      [...thumbs.querySelectorAll('button')].forEach((b,i)=>b.classList.toggle('active',i===index));
    };
    thumbs.innerHTML=images.map((img,i)=>`<button type="button" aria-label="View photo ${i+1}"><img src="${esc(publicImage(img.storage_path))}" alt="" loading="lazy" width="120" height="90"></button>`).join('');
    [...thumbs.querySelectorAll('button')].forEach((b,i)=>b.onclick=()=>show(i));
    show(0);
  }

  async function loadRelated(){
    const wrap=document.querySelector('#relatedDevices');
    if(!listing||!wrap)return;
    const rows=await get(`/rest/v1/listings?select=id,title,condition,storage,price_amount,price_currency&status=eq.published&category=eq.${encodeURIComponent(listing.category)}&id=neq.${encodeURIComponent(listing.id)}&order=created_at.desc&limit=4`).catch(()=>[]);
    if(!rows.length){document.querySelector('#relatedSection').hidden=true;return}
    wrap.innerHTML=rows.map(x=>`<a class="related-card" href="/device.html?id=${encodeURIComponent(x.id)}"><span class="pill">${x.condition==='new'?'New':'Used'}</span><strong>${esc(x.title)}</strong><small>${esc(x.storage||'Details available')}</small><b>${esc(money(x.price_amount,x.price_currency))}</b></a>`).join('');
  }

  async function load(){
    if(!id||!/^[0-9a-f-]{36}$/i.test(id)){document.querySelector('#deviceMeta').innerHTML='<h1>Device not found.</h1>';return}
    try{
      await window.DDH_LOCALIZATION?.ready;
      const rows=await get(`/rest/v1/listings?select=id,seller_id,title,category,brand,model,condition,price_amount,price_currency,description,storage,color,city,country_code,delivery_mode,warranty_text,specs,created_at&status=eq.published&id=eq.${encodeURIComponent(id)}&limit=1`);
      listing=rows?.[0]; if(!listing)throw new Error('This listing is no longer available.');
      images=await get(`/rest/v1/listing_images?select=storage_path,sort_order&listing_id=eq.${encodeURIComponent(id)}&order=sort_order.asc`).catch(()=>[]);
      const profiles=await get(`/rest/v1/public_profiles?select=id,display_name,created_at&id=eq.${encodeURIComponent(listing.seller_id)}&limit=1`).catch(()=>[]);
      seller=profiles?.[0]||null;
      document.title=`${listing.title} — DigitalDeviceHub`;
      document.querySelector('meta[name="description"]')?.setAttribute('content',`${listing.title} — ${listing.condition==='new'?'New':'Used'} ${listing.storage||''} device listed on DigitalDeviceHub.`);
      renderGallery();
      const sellerPrice=money(listing.price_amount,listing.price_currency);
      document.querySelector('#deviceMeta').innerHTML=`<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/marketplace.html?category=${encodeURIComponent(listing.category)}">${esc(listing.category)}</a><span>›</span><span>${esc(listing.brand||listing.title)}</span></nav><span class="eyebrow">${esc(listing.category)} · ${esc(listing.condition==='new'?'New':'Used')}</span><h1>${esc(listing.title)}</h1><div class="subline">${esc(listing.storage||'Details available')}${listing.city?` · ${esc(listing.city)}`:''}</div><div class="seller-price-primary device-price">${esc(sellerPrice)}</div><div class="converted-line">Local estimate: <span class="price local-estimate" data-price-amount="${esc(listing.price_amount)}" data-price-currency="${esc(listing.price_currency)}">${esc(sellerPrice)}</span></div>`;
      document.querySelector('#deviceDescription').textContent=listing.description||'The seller has not added a description yet.';
      document.querySelector('#deviceSpecs').innerHTML=specRows();
      const joined=seller?.created_at?new Date(seller.created_at).toLocaleDateString(undefined,{year:'numeric',month:'short'}):'';
      document.querySelector('#sellerPanel').innerHTML=`<div class="spec"><span>Listed by</span><strong><a href="/seller.html?id=${encodeURIComponent(listing.seller_id)}">${esc(seller?.display_name||'DigitalDeviceHub seller')} →</a></strong></div><div class="spec"><span>Account status</span><strong>Email authenticated</strong></div>${joined?`<div class="spec"><span>Member since</span><strong>${esc(joined)}</strong></div>`:''}<div class="spec"><span>Listed</span><strong>${esc(new Date(listing.created_at).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}))}</strong></div>`;
      window.DDH_LOCALIZATION?.refresh?.();
      recordView();
      loadRelated();
    }catch(err){
      document.querySelector('#deviceMeta').innerHTML=`<span class="eyebrow">Unavailable</span><h1>${esc(err.message)}</h1><p><a href="/marketplace.html">Return to marketplace →</a></p>`;
    }
  }

  async function favorite(){
    const s=session();
    if(!s?.user?.id)return modal('<p class="eyebrow">Account required</p><h2>Sign in to save devices.</h2><p>Your saved devices appear in your account dashboard.</p><a class="btn" href="/?signin=1">Go to sign in</a>');
    try{await write('/rest/v1/favorites','POST',{user_id:s.user.id,listing_id:listing.id});toast('Saved to favorites.')}catch(err){if(/duplicate|unique/i.test(err.message))toast('Already in your favorites.');else toast(err.message)}
  }

  function message(){
    const s=session();
    if(!s?.user?.id)return modal('<p class="eyebrow">Account required</p><h2>Sign in to message sellers.</h2><p>DigitalDeviceHub keeps conversations tied to the device listing.</p><a class="btn" href="/?signin=1">Go to sign in</a>');
    if(s.user.id===listing.seller_id)return toast('This is your own listing.');
    modal(`<p class="eyebrow">Message seller</p><h2>${esc(listing.title)}</h2><form id="msgForm"><textarea class="control" name="body" rows="5" required maxlength="4000" placeholder="Ask about availability, condition, pickup or delivery."></textarea><button class="btn blue full-action" type="submit">Send message</button></form>`);
    document.querySelector('#msgForm').onsubmit=sendMessage;
  }

  async function sendMessage(e){
    e.preventDefault();const s=session();const body=String(new FormData(e.currentTarget).get('body')||'').trim();
    try{
      let conv=await get(`/rest/v1/conversations?select=id&listing_id=eq.${encodeURIComponent(listing.id)}&buyer_id=eq.${encodeURIComponent(s.user.id)}&seller_id=eq.${encodeURIComponent(listing.seller_id)}&limit=1`,true);
      let cid=conv?.[0]?.id;
      if(!cid){const made=await write('/rest/v1/conversations','POST',{listing_id:listing.id,buyer_id:s.user.id,seller_id:listing.seller_id});cid=made?.[0]?.id}
      if(!cid)throw new Error('Could not start conversation.');
      await write('/rest/v1/messages','POST',{conversation_id:cid,sender_id:s.user.id,body});
      document.querySelector('#deviceDialog').close();toast('Message sent.');
    }catch(err){toast(err.message)}
  }

  function reportListing(){
    const s=session();
    if(!s?.user?.id)return modal('<p class="eyebrow">Account required</p><h2>Sign in to report a listing.</h2><p>Reports are attached to an account so moderators can investigate responsibly.</p><a class="btn" href="/?signin=1">Go to sign in</a>');
    modal(`<p class="eyebrow">Report listing</p><h2>What is wrong?</h2><form id="reportForm"><select class="control" name="reason" required><option value="">Choose a reason</option><option value="suspected_scam">Suspected scam</option><option value="counterfeit">Counterfeit product</option><option value="stolen_device">Stolen device</option><option value="incorrect_description">Incorrect description</option><option value="prohibited_item">Prohibited item</option><option value="spam">Spam</option><option value="other">Other</option></select><textarea class="control report-notes" name="details" rows="4" maxlength="1500" placeholder="Add useful details for the moderation team."></textarea><button class="btn blue full-action" type="submit">Submit report</button></form>`);
    document.querySelector('#reportForm').onsubmit=async e=>{
      e.preventDefault();const fd=new FormData(e.currentTarget);
      try{await write('/rest/v1/reports','POST',{reporter_id:s.user.id,listing_id:listing.id,reported_user_id:listing.seller_id,reason:String(fd.get('reason')),details:String(fd.get('details')||'').trim()||null});document.querySelector('#deviceDialog').close();toast('Report submitted for review.')}catch(err){toast(err.message)}
    };
  }

  document.querySelector('#messageSeller').onclick=message;
  document.querySelector('#saveDevice').onclick=favorite;
  document.querySelector('#reportDevice').onclick=reportListing;
  document.querySelector('#shareDevice').onclick=async()=>{try{if(navigator.share)await navigator.share({title:listing?.title||document.title,url:location.href});else await navigator.clipboard.writeText(location.href);toast('Listing link ready to share.')}catch{}};
  document.querySelector('#dialogClose').onclick=()=>document.querySelector('#deviceDialog').close();
  document.addEventListener('ddh:localization-ready',e=>document.querySelector('#localeChip').textContent=`${e.detail.country} · ${e.detail.currency}`);
  load();
})();