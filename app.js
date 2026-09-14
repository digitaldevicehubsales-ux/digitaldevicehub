const demoListings = [
  {id:1,category:'Phones',name:'iPhone 15 Pro',condition:'Excellent',storage:'256 GB',price:620000,seller:'Metro Devices',verified:true,icon:'▯',source:'demo'},
  {id:2,category:'Phones',name:'Galaxy S24 Ultra',condition:'Good',storage:'256 GB',price:540000,seller:'Prime Mobile',verified:true,icon:'▯',source:'demo'},
  {id:3,category:'Laptops',name:'MacBook Air M2',condition:'Excellent',storage:'512 GB',price:870000,seller:'Tech Corner',verified:false,icon:'▱',source:'demo'},
  {id:4,category:'Laptops',name:'ThinkPad X1 Carbon',condition:'Good',storage:'1 TB',price:690000,seller:'Workstation Hub',verified:true,icon:'▱',source:'demo'},
  {id:5,category:'Tablets',name:'iPad Air 5',condition:'Excellent',storage:'256 GB',price:485000,seller:'Metro Devices',verified:true,icon:'▭',source:'demo'},
  {id:6,category:'Accessories',name:'USB-C 100W Charger',condition:'New',storage:'GaN',price:32000,seller:'Accessory Point',verified:false,icon:'⌁',source:'demo'},
  {id:7,category:'Phones',name:'Pixel 9 Pro',condition:'New',storage:'256 GB',price:710000,seller:'Prime Mobile',verified:true,icon:'▯',source:'demo'},
  {id:8,category:'Tablets',name:'Galaxy Tab S9',condition:'Good',storage:'128 GB',price:395000,seller:'Device Loft',verified:false,icon:'▭',source:'demo'}
];

const cfg = window.DDH_CONFIG || {};
const supabaseUrl = String(cfg.supabaseUrl || '').replace(/\/$/, '');
const supabaseKey = String(cfg.supabasePublishableKey || '');
const backendReady = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) && supabaseKey.length > 20;
const SESSION_KEY = 'ddh_supabase_session';

let listings = backendReady ? [] : [...demoListings];
let activeCategory = 'all';
let session = null;

const grid = document.querySelector('#listingGrid');
const empty = document.querySelector('#emptyState');
const search = document.querySelector('#searchInput');
const condition = document.querySelector('#conditionFilter');
const dialog = document.querySelector('#dialog');
const dialogContent = document.querySelector('#dialogContent');
const signInButton = document.querySelector('[data-action="signin"]');
const sellForm = document.querySelector('#sellForm');

const money = n => new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(Number(n) || 0);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const titleCase = value => String(value || '').replace(/^./, c => c.toUpperCase());
const iconFor = category => ({Phones:'▯',Laptops:'▱',Tablets:'▭',Accessories:'⌁',Wearables:'◉'}[category] || '◫');

function showDialog(html){
  dialogContent.innerHTML = html;
  if(!dialog.open) dialog.showModal();
}

function showNotice(title, message, tone='info'){
  showDialog(`<div class="dialog-product"><span class="eyebrow">${tone === 'error' ? 'Action needed' : 'DigitalDeviceHub'}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><button class="button" data-dialog-close>Close</button></div>`);
  dialogContent.querySelector('[data-dialog-close]')?.addEventListener('click',()=>dialog.close());
}

function saveSession(data){
  if(!data?.access_token){
    session = null;
    localStorage.removeItem(SESSION_KEY);
    updateAccountButton();
    return;
  }
  const expiresAt = data.expires_at || Math.floor(Date.now()/1000) + Number(data.expires_in || 3600);
  session = {...data, expires_at: expiresAt};
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  updateAccountButton();
}

function loadStoredSession(){
  if(!backendReady) return;
  try{
    const raw = localStorage.getItem(SESSION_KEY);
    if(raw) session = JSON.parse(raw);
  }catch{
    localStorage.removeItem(SESSION_KEY);
  }
  updateAccountButton();
}

function updateAccountButton(){
  if(!signInButton) return;
  signInButton.textContent = session?.user?.email ? 'Account' : 'Sign in';
}

async function authRequest(path, body){
  const res = await fetch(`${supabaseUrl}${path}`, {
    method:'POST',
    headers:{'apikey':supabaseKey,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.msg || data.message || data.error_description || data.error || 'Authentication request failed.');
  return data;
}

async function ensureSession(){
  if(!session?.access_token) return null;
  if(Number(session.expires_at || 0) > Math.floor(Date.now()/1000) + 60) return session;
  if(!session.refresh_token){
    saveSession(null);
    return null;
  }
  try{
    const fresh = await authRequest('/auth/v1/token?grant_type=refresh_token', {refresh_token:session.refresh_token});
    saveSession(fresh);
    return session;
  }catch{
    saveSession(null);
    return null;
  }
}

async function apiFetch(path,{method='GET',body,headers={},requireAuth=false,rawBody=false}={}){
  if(!backendReady) throw new Error('The free backend project has not been connected yet.');
  if(requireAuth) await ensureSession();
  if(requireAuth && !session?.access_token) throw new Error('Please sign in first.');
  const finalHeaders = {'apikey':supabaseKey,...headers};
  if(session?.access_token) finalHeaders.Authorization = `Bearer ${session.access_token}`;
  if(body !== undefined && !rawBody && !finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/json';
  const res = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers:finalHeaders,
    body: body === undefined ? undefined : (rawBody ? body : JSON.stringify(body))
  });
  if(!res.ok){
    const err = await res.json().catch(()=>({}));
    throw new Error(err.message || err.msg || err.error_description || err.error || `Request failed (${res.status}).`);
  }
  if(res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function render(){
  const q = search.value.trim().toLowerCase();
  const cond = condition.value;
  const filtered = listings.filter(x =>
    (activeCategory === 'all' || x.category === activeCategory) &&
    (cond === 'all' || x.condition === cond) &&
    (!q || `${x.name} ${x.category} ${x.storage || ''} ${x.seller || ''}`.toLowerCase().includes(q))
  );
  grid.innerHTML = filtered.map(x => `
    <article class="listing-card" tabindex="0" data-id="${escapeHtml(x.id)}" aria-label="${escapeHtml(x.name)}, ${escapeHtml(money(x.price))}">
      <div class="listing-art" aria-hidden="true">${escapeHtml(x.icon)}</div>
      <div class="listing-body">
        <div class="listing-meta"><span>${escapeHtml(x.category)}</span><span>${escapeHtml(x.condition)}</span></div>
        <h3>${escapeHtml(x.name)}</h3>
        <div class="listing-meta"><span>${escapeHtml(x.storage || 'Details available')}</span></div>
        <div class="price">${escapeHtml(money(x.price))}</div>
        <div class="seller">${escapeHtml(x.seller || 'Seller')} ${x.verified ? '<span class="verified">✓ Verified</span>' : ''}</div>
      </div>
    </article>`).join('');
  empty.textContent = backendReady ? 'No published devices match this search yet.' : 'No matching preview devices yet.';
  empty.hidden = filtered.length !== 0;
}

async function loadListings(){
  if(!backendReady){
    listings = [...demoListings];
    render();
    return;
  }
  try{
    const rows = await apiFetch('/rest/v1/listings?select=id,title,category,condition,storage,price_ngn,seller_id&status=eq.published&order=created_at.desc&limit=40');
    const sellerIds = [...new Set((rows || []).map(r=>r.seller_id).filter(Boolean))];
    let sellers = new Map();
    if(sellerIds.length){
      const inList = sellerIds.map(id=>`\"${id}\"`).join(',');
      const profiles = await apiFetch(`/rest/v1/profiles?select=id,display_name&id=in.(${encodeURIComponent(inList)})`).catch(()=>[]);
      sellers = new Map((profiles || []).map(p=>[p.id,p.display_name]));
    }
    listings = (rows || []).map(r=>({
      id:r.id,
      category:r.category,
      name:r.title,
      condition:titleCase(r.condition),
      storage:r.storage || '',
      price:Number(r.price_ngn),
      seller:sellers.get(r.seller_id) || 'Seller',
      seller_id:r.seller_id,
      verified:false,
      icon:iconFor(r.category),
      source:'supabase'
    }));
    render();
  }catch(err){
    listings = [];
    render();
    console.error('Could not load listings:', err);
  }
}

function openListing(id){
  const x = listings.find(item => String(item.id) === String(id));
  if(!x) return;
  const realActions = x.source === 'supabase' ? `
    <div class="dialog-actions">
      <button class="button secondary" data-favorite="${escapeHtml(x.id)}">Save to favorites</button>
      <button class="button" data-message="${escapeHtml(x.id)}">Message seller</button>
    </div>` : '';
  const previewNote = x.source === 'demo' ? '<p class="status-note">Preview listing — real marketplace data will replace these examples when the free backend project is connected.</p>' : '';
  showDialog(`<div class="dialog-product"><span class="eyebrow">${escapeHtml(x.category)} • ${escapeHtml(x.condition)}</span><h2>${escapeHtml(x.name)}</h2><p>${escapeHtml(x.storage || 'Details available')} • Seller: ${escapeHtml(x.seller || 'Seller')}${x.verified?' • Verified':''}</p><div class="price">${escapeHtml(money(x.price))}</div>${previewNote}${realActions}<button class="button secondary" data-dialog-close>Continue browsing</button></div>`);
  dialogContent.querySelector('[data-dialog-close]')?.addEventListener('click',()=>dialog.close());
  dialogContent.querySelector('[data-favorite]')?.addEventListener('click',()=>saveFavorite(x));
  dialogContent.querySelector('[data-message]')?.addEventListener('click',()=>openMessageForm(x));
}

function showAuthDialog(mode='signin', message=''){
  if(!backendReady){
    showNotice('Backend connection pending','The website is live, but the free Supabase project still needs to be created and connected before account credentials can be accepted.');
    return;
  }
  if(session?.user?.email){
    showDialog(`<div class="dialog-product"><span class="eyebrow">Your account</span><h2>${escapeHtml(session.user.email)}</h2><p>You are signed in to DigitalDeviceHub.</p><div class="dialog-actions"><button class="button secondary" data-signout>Sign out</button><button class="button" data-dialog-close>Done</button></div></div>`);
    dialogContent.querySelector('[data-signout]')?.addEventListener('click',signOut);
    dialogContent.querySelector('[data-dialog-close]')?.addEventListener('click',()=>dialog.close());
    return;
  }
  const isSignup = mode === 'signup';
  showDialog(`<div class="dialog-product"><span class="eyebrow">${isSignup?'Create account':'Welcome back'}</span><h2>${isSignup?'Start buying and selling.':'Sign in to DigitalDeviceHub.'}</h2>${message?`<p class="status-note">${escapeHtml(message)}</p>`:''}<form id="authForm" class="dialog-form">${isSignup?'<label>Display name<input name="displayName" required maxlength="80" autocomplete="name" /></label>':''}<label>Email<input name="email" type="email" required autocomplete="email" /></label><label>Password<input name="password" type="password" required minlength="8" autocomplete="current-password" /></label><button class="button" type="submit">${isSignup?'Create account':'Sign in'}</button></form><button class="text-button" data-auth-toggle>${isSignup?'Already have an account? Sign in':'New here? Create an account'}</button></div>`);
  dialogContent.querySelector('#authForm')?.addEventListener('submit',e=>handleAuthSubmit(e,isSignup));
  dialogContent.querySelector('[data-auth-toggle]')?.addEventListener('click',()=>showAuthDialog(isSignup?'signin':'signup'));
}

async function handleAuthSubmit(event,isSignup){
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  try{
    if(isSignup){
      const displayName = String(form.get('displayName') || '').trim();
      const data = await authRequest('/auth/v1/signup',{email,password,data:{display_name:displayName}});
      if(data.access_token){
        saveSession(data);
        showNotice('Account created','Your account is ready and you are signed in.');
      }else{
        showAuthDialog('signin','Account created. Check your email if Supabase requires email confirmation, then sign in.');
      }
    }else{
      const data = await authRequest('/auth/v1/token?grant_type=password',{email,password});
      saveSession(data);
      showNotice('Signed in','Your DigitalDeviceHub account is now active in this browser.');
    }
  }catch(err){
    showAuthDialog(isSignup?'signup':'signin',err.message);
  }
}

async function signOut(){
  try{
    if(session?.access_token){
      await fetch(`${supabaseUrl}/auth/v1/logout`,{method:'POST',headers:{apikey:supabaseKey,Authorization:`Bearer ${session.access_token}`}});
    }
  }catch{}
  saveSession(null);
  showNotice('Signed out','Your session has been cleared from this browser.');
}

async function saveFavorite(listing){
  if(!backendReady) return;
  await ensureSession();
  if(!session?.user?.id){
    showAuthDialog('signin','Sign in to save devices.');
    return;
  }
  try{
    await apiFetch('/rest/v1/favorites',{method:'POST',body:{user_id:session.user.id,listing_id:listing.id},headers:{Prefer:'return=minimal'},requireAuth:true});
    showNotice('Saved','This device is now in your favorites.');
  }catch(err){
    if(/duplicate|unique/i.test(err.message)) showNotice('Already saved','This device is already in your favorites.');
    else showNotice('Could not save',err.message,'error');
  }
}

function openMessageForm(listing){
  if(!backendReady) return;
  if(!session?.user?.id){
    showAuthDialog('signin','Sign in to contact sellers.');
    return;
  }
  if(session.user.id === listing.seller_id){
    showNotice('This is your listing','You cannot message yourself about your own listing.');
    return;
  }
  showDialog(`<div class="dialog-product"><span class="eyebrow">Message seller</span><h2>${escapeHtml(listing.name)}</h2><form id="messageForm" class="dialog-form"><label>Message<textarea name="body" required minlength="1" maxlength="4000" rows="5" placeholder="Ask about condition, pickup, accessories or availability."></textarea></label><button class="button" type="submit">Send message</button></form></div>`);
  dialogContent.querySelector('#messageForm')?.addEventListener('submit',e=>sendMessage(e,listing));
}

async function sendMessage(event,listing){
  event.preventDefault();
  await ensureSession();
  if(!session?.user?.id) return showAuthDialog('signin');
  const body = String(new FormData(event.currentTarget).get('body') || '').trim();
  try{
    const existing = await apiFetch(`/rest/v1/conversations?select=id&listing_id=eq.${encodeURIComponent(listing.id)}&buyer_id=eq.${encodeURIComponent(session.user.id)}&seller_id=eq.${encodeURIComponent(listing.seller_id)}&limit=1`,{requireAuth:true});
    let conversationId = existing?.[0]?.id;
    if(!conversationId){
      const created = await apiFetch('/rest/v1/conversations',{method:'POST',body:{listing_id:listing.id,buyer_id:session.user.id,seller_id:listing.seller_id},headers:{Prefer:'return=representation'},requireAuth:true});
      conversationId = created?.[0]?.id;
    }
    if(!conversationId) throw new Error('Could not start the conversation.');
    await apiFetch('/rest/v1/messages',{method:'POST',body:{conversation_id:conversationId,sender_id:session.user.id,body},headers:{Prefer:'return=minimal'},requireAuth:true});
    showNotice('Message sent','Your message was saved securely for the seller.');
  }catch(err){
    showNotice('Message not sent',err.message,'error');
  }
}

async function uploadListingImage(file,listingId,userId){
  if(!file || !file.size) return null;
  const allowed = ['image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type)) throw new Error('Images must be JPEG, PNG or WebP.');
  if(file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.');
  const ext = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type];
  const objectPath = `${userId}/${listingId}/${crypto.randomUUID()}.${ext}`;
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  await apiFetch(`/storage/v1/object/listing-images/${encodedPath}`,{method:'POST',body:file,rawBody:true,headers:{'Content-Type':file.type,'x-upsert':'false'},requireAuth:true});
  await apiFetch('/rest/v1/listing_images',{method:'POST',body:{listing_id:listingId,storage_path:objectPath,sort_order:0},headers:{Prefer:'return=minimal'},requireAuth:true});
  return objectPath;
}

async function submitListing(event){
  event.preventDefault();
  if(!backendReady){
    showNotice('Backend connection pending','The listing form is ready, but nothing will be collected until the free Supabase backend is connected.');
    return;
  }
  await ensureSession();
  if(!session?.user?.id){
    showAuthDialog('signin','Sign in before submitting a listing.');
    return;
  }
  const form = new FormData(event.currentTarget);
  const price = Number(String(form.get('price') || '').replace(/[^0-9]/g,''));
  if(!Number.isSafeInteger(price) || price <= 0){
    showNotice('Check the price','Enter a whole-number asking price in NGN.','error');
    return;
  }
  const brand = String(form.get('brand') || '').trim();
  const model = String(form.get('model') || '').trim();
  const payload = {
    seller_id:session.user.id,
    title:`${brand} ${model}`.trim(),
    category:String(form.get('category') || ''),
    brand,
    model,
    condition:String(form.get('condition') || ''),
    price_ngn:price,
    storage:String(form.get('storage') || '').trim() || null,
    city:String(form.get('city') || '').trim() || null,
    description:String(form.get('description') || '').trim(),
    status:'pending'
  };
  try{
    const created = await apiFetch('/rest/v1/listings',{method:'POST',body:payload,headers:{Prefer:'return=representation'},requireAuth:true});
    const listing = created?.[0];
    if(!listing?.id) throw new Error('The listing was not created.');
    const file = form.get('image');
    let imageWarning = '';
    if(file instanceof File && file.size){
      try{ await uploadListingImage(file,listing.id,session.user.id); }
      catch(err){ imageWarning = ` The listing was saved, but the image was not uploaded: ${err.message}`; }
    }
    event.currentTarget.reset();
    showNotice('Listing submitted',`Your listing is saved and pending review before it becomes public.${imageWarning}`);
  }catch(err){
    showNotice('Listing not submitted',err.message,'error');
  }
}

document.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click',()=>{
  document.querySelectorAll('[data-category]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  activeCategory = btn.dataset.category;
  render();
}));
search.addEventListener('input',render);
condition.addEventListener('change',render);
grid.addEventListener('click',e=>{const card=e.target.closest('.listing-card'); if(card) openListing(card.dataset.id)});
grid.addEventListener('keydown',e=>{const card=e.target.closest('.listing-card'); if(card && (e.key==='Enter'||e.key===' ')){e.preventDefault();openListing(card.dataset.id)}});
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
signInButton.addEventListener('click',()=>showAuthDialog('signin'));
sellForm.addEventListener('submit',submitListing);

loadStoredSession();
ensureSession().finally(()=>updateAccountButton());
loadListings();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));}
