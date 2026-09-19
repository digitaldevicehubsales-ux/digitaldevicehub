(() => {
  'use strict';
  const cfg=window.DDH_CONFIG||{};const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');const key=String(cfg.supabasePublishableKey||'');const SESSION_KEY='ddh_supabase_session';const DRAFT_KEY='ddh_sell_draft_v2';const form=document.querySelector('#listingWizard');const steps=[...document.querySelectorAll('.wizard-step')];const progress=[...document.querySelectorAll('#progress span')];const next=document.querySelector('#nextStep');const back=document.querySelector('#backStep');const submit=document.querySelector('#submitListing');const authGate=document.querySelector('#authGate');const currency=document.querySelector('#sellerCurrency');let step=0;
  const validCurrency=v=>/^[A-Z]{3}$/.test(String(v||'').toUpperCase())?String(v).toUpperCase():'';function session(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}function toast(t){const el=document.querySelector('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3200)}
  function supportedCurrencies(){try{return Intl.supportedValuesOf?.('currency')||[]}catch{return ['NGN','USD','GBP','EUR','GHS','ZAR','KES','CAD','AUD','JPY','CNY','INR','AED']}}
  function currencyOptions(){
    const detectedCurrency=validCurrency(window.DDH_LOCALIZATION?.state?.currency);
    const preferred=[detectedCurrency,'USD','EUR','GBP','CAD','AUD','JPY','CNY','INR','AED','BRL','MXN','ZAR','GHS','KES'].filter(Boolean);
    const all=[...new Set(supportedCurrencies().map(validCurrency).filter(Boolean))];
    const codes=[...preferred.filter(c=>all.includes(c)),...all.filter(c=>!preferred.includes(c)).sort()];
    currency.innerHTML=codes.map(c=>`<option value="${c}">${c}</option>`).join('');
    const safeDefault=detectedCurrency&&codes.includes(detectedCurrency)?detectedCurrency:'USD';
    currency.value=safeDefault;
  }
  function validImei(raw){
    const value=String(raw||'').replace(/\D/g,'');if(!value)return true;if(!/^\d{15}$/.test(value))return false;
    let sum=0,alt=false;for(let i=value.length-1;i>=0;i--){let n=Number(value[i]);if(alt){n*=2;if(n>9)n-=9}sum+=n;alt=!alt}return sum%10===0;
  }
  let serverDraftTimer;
  function draftData(){
    const data={};
    for(const [k,v] of new FormData(form).entries())if(!(v instanceof File)&&k!=='device_identifier')data[k]=v;
    return data;
  }
  async function saveServerDraft(){
    const s=session(); if(!s?.user?.id)return;
    try{await api('/rest/v1/listing_drafts?on_conflict=user_id',{method:'POST',body:{user_id:s.user.id,data:draftData(),updated_at:new Date().toISOString()},headers:{Prefer:'resolution=merge-duplicates,return=minimal'}})}catch{}
  }
  function scheduleServerDraft(){clearTimeout(serverDraftTimer);serverDraftTimer=setTimeout(saveServerDraft,650)}
  async function restoreServerDraft(){
    const s=session(); if(!s?.user?.id)return;
    try{const rows=await api(`/rest/v1/listing_drafts?select=data,updated_at&user_id=eq.${encodeURIComponent(s.user.id)}&limit=1`);const data=rows?.[0]?.data;if(!data||typeof data!=='object')return;for(const [k,v] of Object.entries(data)){const el=form.elements[k];if(el&&typeof v==='string'&&!el.value)el.value=v}}catch{}
  }
  function syncPhoneSpecs(){const isPhone=form.elements.category?.value==='Phones';document.querySelectorAll('.phone-spec').forEach(x=>x.hidden=!isPhone)}
  function showStep(n){step=Math.max(0,Math.min(steps.length-1,n));steps.forEach((el,i)=>el.classList.toggle('active',i===step));progress.forEach((el,i)=>el.classList.toggle('active',i<=step));back.disabled=step===0;next.hidden=step===steps.length-1;submit.hidden=step!==steps.length-1;if(step===steps.length-1)review();window.scrollTo({top:0,behavior:'smooth'})}
  function validateCurrent(){const fields=[...steps[step].querySelectorAll('[required]')];for(const field of fields){if(!field.reportValidity())return false}return true}
  function draft(){const data={};for(const [k,v] of new FormData(form).entries()){if(!(v instanceof File)&&k!=='device_identifier')data[k]=v}try{localStorage.setItem(DRAFT_KEY,JSON.stringify(data))}catch{}}
  function restore(){try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(!d)return;for(const [k,v] of Object.entries(d)){const el=form.elements[k];if(el&&typeof v==='string')el.value=v}}catch{}}
  function review(){const d=Object.fromEntries([...new FormData(form).entries()].filter(([k,v])=>!(v instanceof File)&&k!=='device_identifier'));const cur=validCurrency(d.currency)||'USD';const amount=Number(d.price||0);let asking=`${cur} ${Number.isFinite(amount)?amount.toLocaleString():''}`;try{asking=new Intl.NumberFormat(undefined,{style:'currency',currency:cur,maximumFractionDigits:4}).format(amount)}catch{}document.querySelector('#reviewBox').innerHTML=`<strong>${d.brand||''} ${d.model||''}</strong><p class="review-muted">${d.condition==='new'?'New':'Used'} · ${d.storage||'Storage not specified'} · ${d.city||'Location not specified'}</p><div class="price-confirmation"><span>You are asking</span><strong>${asking}</strong><small>Confirm the currency before submitting. Buyers may see a local-currency estimate, but this remains your official asking price.</small></div>`}
  async function api(path,{method='GET',body,raw=false,contentType,headers:extraHeaders={}}={}){const s=session();if(!s?.access_token)throw new Error('Please sign in first.');const headers={apikey:key,Authorization:`Bearer ${s.access_token}`,...extraHeaders};if(body!==undefined&&!raw)headers['Content-Type']='application/json';if(contentType)headers['Content-Type']=contentType;const r=await fetch(`${base}${path}`,{method,headers,body:body===undefined?undefined:(raw?body:JSON.stringify(body))});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}if(!r.ok)throw new Error(data?.message||data?.error||`Request failed (${r.status})`);return data}
  async function resizeImage(file,maxWidth,quality=.82){let bitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'})}catch{bitmap=await createImageBitmap(file)}const scale=Math.min(1,maxWidth/bitmap.width);const width=Math.max(1,Math.round(bitmap.width*scale));const height=Math.max(1,Math.round(bitmap.height*scale));const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(bitmap,0,0,width,height);bitmap.close?.();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(!blob)throw new Error('This photo could not be processed. Try another image.');return {blob,width,height}}
  async function uploadProcessed(blob,path){await api(`/storage/v1/object/listing-images/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',body:blob,raw:true,contentType:'image/webp',headers:{'cache-control':'max-age=31536000'}})}
  async function uploadFiles(files,listingId,userId){const chosen=[...files].filter(f=>f instanceof File&&f.size);if(!chosen.length)throw new Error('Add at least one real product photo.');if(chosen.length>8)throw new Error('You can upload up to 8 photos per listing.');for(let i=0;i<chosen.length;i++){const file=chosen[i];if(file.size>5*1024*1024)throw new Error(`Photo ${i+1} must be 5 MB or smaller.`);if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use JPEG, PNG or WebP photos only.');const root=`${userId}/${listingId}/${crypto.randomUUID()}`;const [thumb,card,detail]=await Promise.all([resizeImage(file,480,.78),resizeImage(file,900,.82),resizeImage(file,1600,.86)]);const thumbPath=`${root}-480.webp`,cardPath=`${root}-900.webp`,detailPath=`${root}-1600.webp`;await Promise.all([uploadProcessed(thumb.blob,thumbPath),uploadProcessed(card.blob,cardPath),uploadProcessed(detail.blob,detailPath)]);await api('/rest/v1/listing_images',{method:'POST',body:{listing_id:listingId,storage_path:detailPath,sort_order:i,width:detail.width,height:detail.height,variants:{thumb:thumbPath,card:cardPath,detail:detailPath}})}}
  async function checkDeviceIdentity(identifier,listingId){const value=String(identifier||'').trim();if(!value)return null;return api('/functions/v1/device-identity',{method:'POST',body:{listing_id:listingId,type:'imei',identifier:value}})}
  async function submitListing(e){
    e.preventDefault();if(!validateCurrent())return;const s=session();if(!s?.user?.id){authGate.hidden=false;form.hidden=true;return}
    const fd=new FormData(form);const price=Number(fd.get('price'));const cur=validCurrency(fd.get('currency'));if(!Number.isFinite(price)||price<=0||!cur)return toast('Enter a valid price and currency.');
    const category=String(fd.get('category')||''),identifier=category==='Phones'?String(fd.get('device_identifier')||'').trim():'';if(identifier&&!validImei(identifier))return toast('Enter a valid 15-digit IMEI, or leave the optional IMEI field blank.');
    const brand=String(fd.get('brand')||'').trim(),model=String(fd.get('model')||'').trim();const country=String(fd.get('country_code')||'').trim().toUpperCase();
    const payload={seller_id:s.user.id,title:`${brand} ${model}`.trim(),category,brand,model,condition:String(fd.get('condition')),price_amount:Math.round(price*10000)/10000,price_currency:cur,storage:String(fd.get('storage')||'').trim()||null,color:String(fd.get('color')||'').trim()||null,city:String(fd.get('city')||'').trim()||null,country_code:/^[A-Z]{2}$/.test(country)?country:null,delivery_mode:String(fd.get('delivery_mode')||'pickup'),warranty_text:String(fd.get('warranty_text')||'').trim()||null,description:String(fd.get('description')||'').trim(),specs:{battery_health:String(fd.get('battery_health')||'').trim()||null,network_status:String(fd.get('network_status')||'').trim()||null,repair_history:String(fd.get('repair_history')||'').trim()||null,accessories:String(fd.get('accessories')||'').trim()||null},status:'pending'};
    submit.disabled=true;submit.textContent='Submitting…';
    try{
      const created=await api('/rest/v1/listings',{method:'POST',body:payload});let row=Array.isArray(created)?created[0]:created;
      if(!row?.id){const find=await api(`/rest/v1/listings?select=id&seller_id=eq.${encodeURIComponent(s.user.id)}&title=eq.${encodeURIComponent(payload.title)}&order=created_at.desc&limit=1`);row=find?.[0]}
      if(!row?.id)throw new Error('Listing was created but could not be reopened.');
      await uploadFiles(fd.getAll('images'),row.id,s.user.id);
      const identityResult=identifier?await checkDeviceIdentity(identifier,row.id).catch(()=>({unavailable:true})):null;
      localStorage.removeItem(DRAFT_KEY);await api(`/rest/v1/listing_drafts?user_id=eq.${encodeURIComponent(s.user.id)}`,{method:'DELETE'}).catch(()=>{});form.reset();
      if(identityResult?.duplicate)toast('Listing submitted for review. The device identifier matched another listing and was flagged for moderator review.');
      else if(identityResult?.unavailable)toast('Listing submitted for review. The optional identifier check will need moderator follow-up.');
      else toast('Listing submitted for review.');
      setTimeout(()=>location.assign('/dashboard.html'),1200);
    }catch(err){toast(err.message)}finally{submit.disabled=false;submit.textContent='Submit for review'}
  }
  next.onclick=()=>{if(!validateCurrent())return;draft();showStep(step+1)};back.onclick=()=>showStep(step-1);form.addEventListener('input',()=>{draft();scheduleServerDraft()});form.addEventListener('change',()=>{draft();scheduleServerDraft()});form.addEventListener('submit',submitListing);document.querySelector('select[name="category"]').addEventListener('change',syncPhoneSpecs);document.addEventListener('ddh:localization-ready',e=>{document.querySelector('#localeChip').textContent=`${e.detail.country} · ${e.detail.currency}`;window.DDH_COUNTRIES?.populate?.(document.querySelector('#countryCode'),document.querySelector('#countryCode')?.value||e.detail.country);currencyOptions()});currencyOptions();window.DDH_COUNTRIES?.populate?.(document.querySelector('#countryCode'),window.DDH_LOCALIZATION?.state?.country||'');restore();syncPhoneSpecs();const s=session();if(!s?.user?.id){authGate.hidden=false;form.hidden=true}else{authGate.hidden=true;form.hidden=false;restoreServerDraft().then(()=>{window.DDH_COUNTRIES?.populate?.(document.querySelector('#countryCode'),document.querySelector('#countryCode')?.value||window.DDH_LOCALIZATION?.state?.country||'');syncPhoneSpecs()})}showStep(0);
})();
