const cfg = window.DDH_CONFIG || {};
const supabaseUrl = String(cfg.supabaseUrl || '').replace(/\/$/, '');
const supabaseKey = String(cfg.supabasePublishableKey || '');
const backendReady = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) && supabaseKey.length > 20;
const SESSION_KEY = 'ddh_supabase_session';

let listings = [];
let activeCategory = 'all';
let session = null;
let pendingOtpEmail = '';

const grid = document.querySelector('#listingGrid');
const empty = document.querySelector('#emptyState');
const search = document.querySelector('#searchInput');
const condition = document.querySelector('#conditionFilter');
const dialog = document.querySelector('#dialog');
const dialogContent = document.querySelector('#dialogContent');
const signInButton = document.querySelector('[data-action="signin"]');

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const titleCase = value => String(value || '').replace(/^./, c => c.toUpperCase());
const validCurrency = value => /^[A-Z]{3}$/.test(String(value || '').toUpperCase()) ? String(value).toUpperCase() : '';
const iconFor = category => ({Phones:'▯',Laptops:'▱',Tablets:'▭',Accessories:'⌁',Wearables:'◉'}[category] || '◫');
const publicListingImageUrl = path => {
  if(!path) return '';
  const encodedPath = String(path).split('/').map(encodeURIComponent).join('/');
  return `${supabaseUrl}/storage/v1/object/public/listing-images/${encodedPath}`;
};

function money(amount,currency){
  const value = Number(amount) || 0;
  const code = validCurrency(currency);
  if(!code) return value.toLocaleString();
  try{
    return new Intl.NumberFormat(undefined,{style:'currency',currency:code,maximumFractionDigits:4}).format(value);
  }catch{
    return `${code} ${value.toLocaleString()}`;
  }
}

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
  signInButton.textContent = session?.user?.email ? 'Account' : 'Sign in / Sign up';
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

async function apiFetch(path,{method='GET',body,headers={},requireAuth=false}={}){
  if(!backendReady) throw new Error('The marketplace backend is temporarily unavailable.');
  if(requireAuth) await ensureSession();
  if(requireAuth && !session?.access_token) throw new Error('Please sign in first.');
  const finalHeaders = {'apikey':supabaseKey,...headers};
  if(session?.access_token) finalHeaders.Authorization = `Bearer ${session.access_token}`;
  if(body !== undefined && !finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/json';
  const res = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers:finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if(!res.ok){
    const err = await res.json().catch(()=>({}));
    throw new Error(err.message || err.msg || err.error_description || err.error || `Request failed (${res.status}).`);
  }
  if(res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function priceMarkup(x){
  const currency = validCurrency(x.currency);
  const amount = Number(x.price) || 0;
  const currencyAttrs = currency ? ` data-price-amount="${escapeHtml(amount)}" data-price-currency="${currency}"` : '';
  return `<div class="price"${currencyAttrs}>${escapeHtml(money(amount,currency))}</div>`;
}

function render(){
  const q = search?.value.trim().toLowerCase() || '';
  const cond = condition?.value || 'all';
  if(!grid || !empty) return;
  if(listings.length < 12){
    grid.innerHTML='';
    empty.innerHTML='<strong>The worldwide marketplace is growing.</strong><br>We are onboarding the first wave of real sellers. Browse the full marketplace or list a device from your country.';
    empty.hidden=false;
    window.DDH_LOCALIZATION?.refresh?.();
    return;
  }
  const filtered = listings.filter(x =>
    (activeCategory === 'all' || x.category === activeCategory) &&
    (cond === 'all' || x.condition === cond) &&
    (!q || `${x.name} ${x.category} ${x.storage || ''} ${x.seller || ''}`.toLowerCase().includes(q))
  );
  grid.innerHTML = filtered.map(x => `
    <article class="listing-card" tabindex="0" data-id="${escapeHtml(x.id)}" aria-label="${escapeHtml(x.name)}, ${escapeHtml(money(x.price,x.currency))}">
      <div class="listing-art">${x.image_url ? `<img src="${escapeHtml(x.image_url)}" alt="${escapeHtml(x.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" />` : `<span aria-hidden="true">${escapeHtml(x.icon)}</span>`}</div>
      <div class="listing-body">
        <div class="listing-meta"><span>${escapeHtml(x.category)}</span><span>${escapeHtml(x.condition)}</span></div>
        <h3>${escapeHtml(x.name)}</h3>
        <div class="listing-meta"><span>${escapeHtml(x.storage || 'Details available')}</span></div>
        ${priceMarkup(x)}
        <div class="seller">${escapeHtml(x.seller || 'Seller')} ${x.verified ? '<span class="verified">✓ Verified</span>' : ''}</div>
      </div>
    </article>`).join('');
  empty.textContent = 'No published devices match this search yet. If the marketplace is empty, we are onboarding new sellers now.';
  empty.hidden = filtered.length !== 0;
  window.DDH_LOCALIZATION?.refresh?.();
}

async function loadListings(){
  if(!backendReady){
    listings = [];
    render();
    return;
  }
  try{
    const rows = await apiFetch('/rest/v1/listings?select=id,title,category,condition,storage,price_amount,price_currency,seller_id&status=eq.published&order=created_at.desc&limit=40');
    const sellerIds = [...new Set((rows || []).map(r=>r.seller_id).filter(Boolean))];
    let sellers = new Map();
    if(sellerIds.length){
      const inList = sellerIds.map(id=>`\"${id}\"`).join(',');
      const profiles = await apiFetch(`/rest/v1/public_profiles?select=id,display_name&id=in.(${encodeURIComponent(inList)})`).catch(()=>[]);
      sellers = new Map((profiles || []).map(p=>[p.id,p.display_name]));
    }

    const listingIds = [...new Set((rows || []).map(r=>r.id).filter(Boolean))];
    const firstImages = new Map();
    if(listingIds.length){
      const inList = listingIds.map(id=>`\"${id}\"`).join(',');
      const images = await apiFetch(`/rest/v1/listing_images?select=listing_id,storage_path,variants,sort_order&listing_id=in.(${encodeURIComponent(inList)})&order=sort_order.asc`).catch(()=>[]);
      for(const image of images || []){
        if(image?.listing_id && image?.storage_path && !firstImages.has(image.listing_id)){
          firstImages.set(image.listing_id, publicListingImageUrl(image.variants?.card||image.storage_path));
        }
      }
    }

    listings = (rows || []).map(r=>({
      id:r.id,
      category:r.category,
      name:r.title,
      condition:titleCase(r.condition),
      storage:r.storage || '',
      price:Number(r.price_amount),
      currency:validCurrency(r.price_currency),
      seller:sellers.get(r.seller_id) || 'Seller',
      seller_id:r.seller_id,
      verified:false,
      icon:iconFor(r.category),
      image_url:firstImages.get(r.id) || '',
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
  const actions = x.source === 'supabase' ? `
    <div class="dialog-actions">
      <button class="button secondary" data-favorite="${escapeHtml(x.id)}">Save to favorites</button>
      <button class="button" data-message="${escapeHtml(x.id)}">Message seller</button>
    </div>` : '';
  const imageMarkup = x.image_url ? `<img src="${escapeHtml(x.image_url)}" alt="${escapeHtml(x.name)}" style="width:100%;max-height:420px;object-fit:contain;border-radius:18px;background:#f3f5fa;margin:0 0 18px;" />` : '';
  showDialog(`<div class="dialog-product">${imageMarkup}<span class="eyebrow">${escapeHtml(x.category)} • ${escapeHtml(x.condition)}</span><h2>${escapeHtml(x.name)}</h2><p>${escapeHtml(x.storage || 'Details available')} • Listed by ${escapeHtml(x.seller || 'Seller')}${x.verified?' • Verified':''}</p>${priceMarkup(x)}${actions}<button class="button secondary" data-dialog-close>Continue browsing</button></div>`);
  window.DDH_LOCALIZATION?.refresh?.();
  dialogContent.querySelector('[data-dialog-close]')?.addEventListener('click',()=>dialog.close());
  dialogContent.querySelector('[data-favorite]')?.addEventListener('click',()=>saveFavorite(x));
  dialogContent.querySelector('[data-message]')?.addEventListener('click',()=>openMessageForm(x));
}

function showAuthDialog(_mode='signin', message=''){
  if(!backendReady){
    showNotice('Account access unavailable','Account services are temporarily unavailable. Please try again later.');
    return;
  }
  if(session?.user?.email){
    showDialog(`<div class="dialog-product"><span class="eyebrow">Your account</span><h2>${escapeHtml(session.user.email)}</h2><p>You are signed in to DigitalDeviceHub.</p><div class="dialog-actions"><button class="button secondary" data-signout>Sign out</button><button class="button" data-dialog-close>Done</button></div></div>`);
    dialogContent.querySelector('[data-signout]')?.addEventListener('click',signOut);
    dialogContent.querySelector('[data-dialog-close]')?.addEventListener('click',()=>dialog.close());
    return;
  }
  showDialog(`<div class="dialog-product"><span class="eyebrow">Secure account access</span><h2>Sign in or create your account.</h2>${message?`<p class="status-note">${escapeHtml(message)}</p>`:''}<p>Enter your email address. We’ll send you a one-time code — no password needed.</p><form id="authForm" class="dialog-form"><label>Email<input name="email" type="email" required autocomplete="email" placeholder="you@example.com" /></label><button class="button" type="submit">Email me a code</button></form><p class="form-note">New email addresses are automatically registered after the code is verified.</p></div>`);
  dialogContent.querySelector('#authForm')?.addEventListener('submit',handleEmailOtpSubmit);
}

async function sendEmailOtp(email){
  const fallbackName = email.split('@')[0].replace(/[._-]+/g,' ').trim().slice(0,80) || 'DigitalDeviceHub user';
  await authRequest('/auth/v1/otp',{
    email,
    create_user:true,
    data:{display_name:fallbackName}
  });
}

async function handleEmailOtpSubmit(event){
  event.preventDefault();
  const email = String(new FormData(event.currentTarget).get('email') || '').trim().toLowerCase();
  if(!email) return;
  try{
    await sendEmailOtp(email);
    pendingOtpEmail = email;
    showOtpDialog(email,'We sent a one-time code to your email.');
  }catch(err){
    showAuthDialog('signin',err.message);
  }
}

function showOtpDialog(email, message=''){
  showDialog(`<div class="dialog-product"><span class="eyebrow">Email verification</span><h2>Enter your code.</h2>${message?`<p class="status-note">${escapeHtml(message)}</p>`:''}<p>Enter the 6-digit code sent to <strong>${escapeHtml(email)}</strong>.</p><form id="otpForm" class="dialog-form"><label>One-time code<input name="token" type="text" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="123456" /></label><button class="button" type="submit">Verify & sign in</button></form><div class="dialog-actions"><button class="text-button" data-resend-otp>Resend code</button><button class="text-button" data-change-email>Use a different email</button></div></div>`);
  dialogContent.querySelector('#otpForm')?.addEventListener('submit',e=>handleOtpVerify(e,email));
  dialogContent.querySelector('[data-resend-otp]')?.addEventListener('click',()=>resendOtp(email));
  dialogContent.querySelector('[data-change-email]')?.addEventListener('click',()=>showAuthDialog('signin'));
  dialogContent.querySelector('input[name="token"]')?.focus();
}

async function handleOtpVerify(event,email){
  event.preventDefault();
  const token = String(new FormData(event.currentTarget).get('token') || '').replace(/\D/g,'').slice(0,6);
  if(token.length !== 6){
    showOtpDialog(email,'Enter the full 6-digit code.');
    return;
  }
  try{
    const data = await authRequest('/auth/v1/verify',{email,token,type:'email'});
    saveSession(data);
    pendingOtpEmail = '';
    showNotice('Signed in','Your email is verified and you are signed in to DigitalDeviceHub.');
  }catch(err){
    showOtpDialog(email,err.message);
  }
}

async function resendOtp(email){
  try{
    await sendEmailOtp(email);
    pendingOtpEmail = email;
    showOtpDialog(email,'A fresh code has been sent. Use the newest code only.');
  }catch(err){
    showOtpDialog(email,err.message);
  }
}

async function signOut(){
  try{
    if(session?.access_token){
      await fetch(`${supabaseUrl}/auth/v1/logout`,{method:'POST',headers:{apikey:supabaseKey,Authorization:`Bearer ${session.access_token}`}});
    }
  }catch{}
  saveSession(null);
  pendingOtpEmail = '';
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
  const form = new FormData(event.currentTarget);
  await ensureSession();
  if(!session?.user?.id) return showAuthDialog('signin');
  const body = String(form.get('body') || '').trim();
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

document.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click',()=>{
  document.querySelectorAll('[data-category]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  activeCategory = btn.dataset.category;
  render();
}));
search?.addEventListener('input',render);
condition?.addEventListener('change',render);
grid?.addEventListener('click',e=>{const card=e.target.closest('.listing-card'); if(card) openListing(card.dataset.id)});
grid?.addEventListener('keydown',e=>{const card=e.target.closest('.listing-card'); if(card && (e.key==='Enter'||e.key===' ')){e.preventDefault();openListing(card.dataset.id)}});
document.querySelector('.dialog-close')?.addEventListener('click',()=>dialog.close());
signInButton?.addEventListener('click',()=>showAuthDialog('signin'));

loadStoredSession();
ensureSession().finally(()=>updateAccountButton());
loadListings();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));}
