(() => {
  'use strict';
  const cfg=window.DDH_CONFIG||{};const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');const key=String(cfg.supabasePublishableKey||'');const SESSION_KEY='ddh_supabase_session';const DRAFT_KEY='ddh_sell_draft_v2';const form=document.querySelector('#listingWizard');const steps=[...document.querySelectorAll('.wizard-step')];const progress=[...document.querySelectorAll('#progress span')];const next=document.querySelector('#nextStep');const back=document.querySelector('#backStep');const submit=document.querySelector('#submitListing');const authGate=document.querySelector('#authGate');const currency=document.querySelector('#sellerCurrency');let step=0;
  const IMAGE_TYPES=['image/jpeg','image/png','image/webp'];
  const VIDEO_TYPES=['video/mp4','video/webm'];
  const validCurrency=v=>/^[A-Z]{3}$/.test(String(v||'').toUpperCase())?String(v).toUpperCase():'';
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));function session(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}function toast(t){const el=document.querySelector('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3200)}
  function supportedCurrencies(){try{return Intl.supportedValuesOf?.('currency')||[]}catch{return ['AED','AUD','BRL','CAD','CHF','CNY','EUR','GBP','GHS','INR','JPY','KES','MXN','NGN','USD','ZAR']}}
  function currencyOptions(){
    const existing=validCurrency(currency.value);
    const detectedCurrency=validCurrency(window.DDH_LOCALIZATION?.state?.currency);
    const all=[...new Set(supportedCurrencies().map(validCurrency).filter(Boolean))].sort();
    const ordered=detectedCurrency&&all.includes(detectedCurrency)?[detectedCurrency,...all.filter(c=>c!==detectedCurrency)]:all;
    currency.innerHTML='<option value="">Choose currency</option>'+ordered.map(c=>`<option value="${c}">${c}</option>`).join('');
    if(existing&&ordered.includes(existing))currency.value=existing;
    else if(detectedCurrency&&ordered.includes(detectedCurrency))currency.value=detectedCurrency;
    else currency.value='';
  }
  function getSubmissionKey(){let value='';try{value=localStorage.getItem(SUBMISSION_KEY)||''}catch{}if(!value){value=crypto.randomUUID();try{localStorage.setItem(SUBMISSION_KEY,value)}catch{}}return value}
  function clearSubmissionKey(){try{localStorage.removeItem(SUBMISSION_KEY)}catch{}}
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
  function syncPhoneSpecs(){document.dispatchEvent(new CustomEvent('ddh:catalog-updated'))}
  function syncConditionFields(){const grade=String(form.elements.condition_grade?.value||'');const base=grade==='New (sealed)'?'new':(grade?'used':'');if(form.elements.condition)form.elements.condition.value=base;const used=base==='used';document.querySelectorAll('.used-spec').forEach(x=>x.hidden=!used);const origin=form.elements.usage_origin;if(origin)origin.required=used}
  function updatePriceGuidance(){
    const note=document.querySelector('#priceGuidance'),amount=Number(form.elements.price?.value||0);
    if(!note)return;
    note.textContent=amount>0&&amount<20?'Double-check unusually low prices before submitting.':'Enter the real asking price.';
  }
  let previewUrls=[];
  function renderMediaPreview(){
    const input=document.querySelector('#listingMedia'),wrap=document.querySelector('#mediaPreview');if(!input||!wrap)return;
    previewUrls.forEach(URL.revokeObjectURL);previewUrls=[];
    const files=[...input.files||[]];
    if(!files.length){wrap.innerHTML='';return}
    wrap.innerHTML=files.map((file,index)=>{
      const isImage=IMAGE_TYPES.includes(file.type),isVideo=VIDEO_TYPES.includes(file.type);
      if(isImage){const url=URL.createObjectURL(file);previewUrls.push(url);return '<figure><img src="'+url+'" alt="Selected photo '+(index+1)+'"><figcaption>Photo '+(index+1)+'</figcaption></figure>'}
      if(isVideo)return '<figure class="media-file-card"><span aria-hidden="true">▶</span><figcaption>Video · '+Math.max(1,Math.round(file.size/1024/1024))+' MB</figcaption></figure>';
      return '<figure class="media-file-card"><span aria-hidden="true">!</span><figcaption>Unsupported file</figcaption></figure>';
    }).join('');
  }
  function showStep(n){step=Math.max(0,Math.min(steps.length-1,n));steps.forEach((el,i)=>{el.classList.toggle('active',i===step);el.setAttribute('aria-hidden',i===step?'false':'true')});progress.forEach((el,i)=>el.classList.toggle('active',i<=step));const meter=document.querySelector('#progress');if(meter)meter.setAttribute('aria-valuenow',String(step+1));back.disabled=step===0;back.hidden=step===0;next.hidden=step===steps.length-1;submit.hidden=step!==steps.length-1;const status=document.querySelector('#stepStatus');if(status)status.textContent=`Step ${step+1} of ${steps.length}`;if(step===3)refreshMarketPriceGuidance();if(step===steps.length-1)review();steps[step]?.querySelector('h2')?.setAttribute('tabindex','-1');setTimeout(()=>steps[step]?.querySelector('h2')?.focus({preventScroll:true}),0);window.scrollTo({top:0,behavior:'smooth'})}
  function validateCurrent(){const fields=[...steps[step].querySelectorAll('[required]')];for(const field of fields){if(!field.reportValidity())return false}if(steps[step].querySelector('#listingMedia')){try{validateMedia(new FormData(form).getAll('images'))}catch(err){toast(err.message);return false}}return true}
  function draft(){const data={};for(const [k,v] of new FormData(form).entries()){if(!(v instanceof File)&&k!=='device_identifier')data[k]=v}try{localStorage.setItem(DRAFT_KEY,JSON.stringify(data))}catch{}}
  function restore(){try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(!d)return;for(const [k,v] of Object.entries(d)){const el=form.elements[k];if(el&&typeof v==='string')el.value=v}}catch{}}
  function review(){
    const fd=new FormData(form);
    const d=Object.fromEntries([...fd.entries()].filter(([k,v])=>!(v instanceof File)&&k!=='device_identifier'));
    const cur=validCurrency(d.currency);
    const amount=Number(d.price||0);
    let asking=cur?(cur+' '+(Number.isFinite(amount)?amount.toLocaleString():'')):'Choose a currency';
    try{if(cur)asking=new Intl.NumberFormat(undefined,{style:'currency',currency:cur,maximumFractionDigits:4}).format(amount)}catch{}
    document.querySelector('#reviewBox').innerHTML='<strong>'+String(d.brand||'')+' '+String(d.model||'')+'</strong><p class="review-muted">'+(d.condition==='new'?'New':'Used')+' · '+String(d.storage||'Storage not specified')+' · '+String(d.city||'Location not specified')+'</p><div class="price-confirmation"><span>You are asking</span><strong>'+asking+'</strong><small>Confirm the currency before submitting. Buyers may see a local-currency estimate, but this remains your official asking price.</small></div>';
    const media=fd.getAll('images').filter(x=>x instanceof File&&x.size);
    const checks=[
      ['Device identified',Boolean(d.brand&&d.model)],
      ['Condition explained',Boolean(d.condition_grade)],
      ['Media added',media.length>0],
      ['Description clear',String(d.description||'').trim().length>=20],
      ['Price confirmed',Number.isFinite(amount)&&amount>0&&Boolean(cur)],
      ['Location set',Boolean(d.city&&d.country_code)],
      ['Delivery selected',Boolean(d.delivery_mode)]
    ];
    const wrap=document.querySelector('#qualityChecklist');
    if(wrap)wrap.innerHTML='<span class="eyebrow">Listing quality</span><h3>Ready for review?</h3><div class="quality-list">'+checks.map(([label,ok])=>'<div class="'+(ok?'ready':'needs-work')+'"><span aria-hidden="true">'+(ok?'✓':'!')+'</span><strong>'+label+'</strong></div>').join('')+'</div>';
  }
  function previewListing(){
    const fd=new FormData(form),d=Object.fromEntries([...fd.entries()].filter(([k,v])=>!(v instanceof File)&&k!=='device_identifier'));
    const files=fd.getAll('images').filter(x=>x instanceof File&&x.size);
    const firstImage=files.find(x=>IMAGE_TYPES.includes(x.type));
    const image=firstImage?URL.createObjectURL(firstImage):'';
    const dialog=document.querySelector('#listingPreviewDialog'),content=document.querySelector('#listingPreviewContent');
    const asking=(()=>{const cur=validCurrency(d.currency),amount=Number(d.price||0);try{return cur?new Intl.NumberFormat(undefined,{style:'currency',currency:cur,maximumFractionDigits:4}).format(amount):'Price not set'}catch{return cur+' '+amount.toLocaleString()}})();
    const details=[d.storage,d.ram?d.ram+' RAM':'',d.city].filter(Boolean).join(' · ')||'Add specifications and location';
    content.innerHTML=`<article class="seller-preview-card">${image?`<img src="${image}" alt="Preview of selected listing photo">`:'<div class="seller-preview-placeholder">No photo selected</div>'}<div class="seller-preview-body"><div class="tag-row"><span>${escHtml(d.category||'Device')}</span><span class="pill">${escHtml(d.condition_grade||'Condition not set')}</span></div><h3>${escHtml(d.brand||'')} ${escHtml(d.model||'')}</h3><p>${escHtml(details)}</p><strong class="seller-price-primary">${escHtml(asking)}</strong><p>${escHtml(d.description||'Add a description before submitting.')}</p><div class="card-attribute-row">${d.usage_origin?`<span class="pill">${escHtml(d.usage_origin)}</span>`:''}${d.battery_health?`<span class="pill">${escHtml(d.battery_health)} battery</span>`:''}${d.network_status?`<span class="pill">${escHtml(d.network_status)}</span>`:''}${d.accepts_swap==='true'?'<span class="pill">Open to trade / swap</span>':''}</div></div></article>`;
    dialog.showModal();
    dialog.addEventListener('close',()=>{if(image)URL.revokeObjectURL(image)},{once:true});
  }

  async function api(path,{method='GET',body,raw=false,contentType,headers:extraHeaders={}}={}){const s=session();if(!s?.access_token)throw new Error('Please sign in first.');const headers={apikey:key,Authorization:`Bearer ${s.access_token}`,...extraHeaders};if(body!==undefined&&!raw)headers['Content-Type']='application/json';if(contentType)headers['Content-Type']=contentType;const r=await fetch(`${base}${path}`,{method,headers,body:body===undefined?undefined:(raw?body:JSON.stringify(body))});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}if(!r.ok)throw new Error(data?.message||data?.error||`Request failed (${r.status})`);return data}
  async function publicGet(path){const r=await fetch(`${base}${path}`,{headers:{apikey:key}});if(!r.ok)throw new Error('Price guidance unavailable.');return r.json()}
  let priceGuideTimer;
  async function refreshMarketPriceGuidance(){
    const note=document.querySelector('#marketPriceGuidance');if(!note)return;
    const brand=String(form.elements.brand?.value||'').trim(),model=String(form.elements.model?.value||'').trim(),cur=validCurrency(form.elements.currency?.value);
    if(!brand||!model||!cur){note.textContent='';return}
    note.textContent='Checking similar listings…';
    try{
      const rows=await publicGet(`/rest/v1/listings?select=price_amount,price_currency&status=eq.published&brand=eq.${encodeURIComponent(brand)}&model=eq.${encodeURIComponent(model)}&limit=30`);
      const values=(rows||[]).filter(x=>validCurrency(x.price_currency)===cur).map(x=>Number(x.price_amount)).filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b);
      if(!values.length){note.textContent='No similar listed prices yet.';return}
      const low=values[0],high=values[values.length-1],mid=values[Math.floor(values.length/2)];
      const fmt=n=>{try{return new Intl.NumberFormat(undefined,{style:'currency',currency:cur,maximumFractionDigits:2}).format(n)}catch{return cur+' '+n.toLocaleString()}};
      note.textContent=values.length===1?`Similar listing: ${fmt(mid)}.`:`Similar listings: ${fmt(low)}–${fmt(high)} · median ${fmt(mid)}.`;
    }catch{note.textContent='Price guidance unavailable.'}
  }
  function scheduleMarketPriceGuidance(){clearTimeout(priceGuideTimer);priceGuideTimer=setTimeout(refreshMarketPriceGuidance,320)}
  async function resizeImage(file,maxWidth,quality=.82){let bitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'})}catch{bitmap=await createImageBitmap(file)}const scale=Math.min(1,maxWidth/bitmap.width);const width=Math.max(1,Math.round(bitmap.width*scale));const height=Math.max(1,Math.round(bitmap.height*scale));const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(bitmap,0,0,width,height);bitmap.close?.();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(!blob)throw new Error('This photo could not be processed. Try another image.');return {blob,width,height}}
  async function uploadRaw(blob,path,contentType){await api(`/storage/v1/object/listing-images/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',body:blob,raw:true,contentType,headers:{'cache-control':'max-age=31536000'}})}
  async function uploadProcessed(blob,path){return uploadRaw(blob,path,'image/webp')}
  async function posterFromVideo(file){
    const objectUrl=URL.createObjectURL(file);
    try{
      const video=document.createElement('video');video.preload='metadata';video.muted=true;video.playsInline=true;video.src=objectUrl;
      await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(new Error('This video could not be opened.'))});
      if(Number.isFinite(video.duration)&&video.duration>0.15){
        try{video.currentTime=Math.min(0.25,video.duration/8);await new Promise(resolve=>{video.onseeked=resolve;setTimeout(resolve,500)})}catch{}
      }
      const sourceW=video.videoWidth||1280,sourceH=video.videoHeight||720,scale=Math.min(1,1600/sourceW),width=Math.max(1,Math.round(sourceW*scale)),height=Math.max(1,Math.round(sourceH*scale));
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d',{alpha:false}).drawImage(video,0,0,width,height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.84));if(!blob)throw new Error('Video preview could not be created.');
      return {blob,width,height};
    } finally {URL.revokeObjectURL(objectUrl)}
  }
  async function uploadPhoto(file,listingId,userId,sortOrder){
    const root=`${userId}/${listingId}/${crypto.randomUUID()}`;const [thumb,card,detail]=await Promise.all([resizeImage(file,480,.78),resizeImage(file,900,.82),resizeImage(file,1600,.86)]);const thumbPath=`${root}-480.webp`,cardPath=`${root}-900.webp`,detailPath=`${root}-1600.webp`;await Promise.all([uploadProcessed(thumb.blob,thumbPath),uploadProcessed(card.blob,cardPath),uploadProcessed(detail.blob,detailPath)]);await api('/rest/v1/listing_images',{method:'POST',body:{listing_id:listingId,storage_path:detailPath,sort_order:sortOrder,width:detail.width,height:detail.height,media_type:'image',variants:{thumb:thumbPath,card:cardPath,detail:detailPath}}})
  }
  async function uploadVideo(file,listingId,userId){
    const ext=file.type==='video/webm'?'webm':'mp4';const path=`${userId}/${listingId}/${crypto.randomUUID()}.${ext}`;await uploadRaw(file,path,file.type);await api('/rest/v1/listing_videos',{method:'POST',body:{listing_id:listingId,storage_path:path,mime_type:file.type,size_bytes:file.size,sort_order:0}})
  }
  async function uploadVideoPoster(file,listingId,userId){
    const poster=await posterFromVideo(file);const root=`${userId}/${listingId}/${crypto.randomUUID()}-poster`;const [thumb,card,detail]=await Promise.all([resizeImage(poster.blob,480,.78),resizeImage(poster.blob,900,.82),resizeImage(poster.blob,1600,.86)]);const thumbPath=`${root}-480.webp`,cardPath=`${root}-900.webp`,detailPath=`${root}-1600.webp`;await Promise.all([uploadProcessed(thumb.blob,thumbPath),uploadProcessed(card.blob,cardPath),uploadProcessed(detail.blob,detailPath)]);await api('/rest/v1/listing_images',{method:'POST',body:{listing_id:listingId,storage_path:detailPath,sort_order:0,width:detail.width,height:detail.height,media_type:'image',variants:{thumb:thumbPath,card:cardPath,detail:detailPath,generated_from_video:true}}})
  }
  function validateMedia(files){
    const chosen=[...files].filter(f=>f instanceof File&&f.size);if(!chosen.length)throw new Error('Add photos or a video.');
    const unsupported=chosen.find(f=>!IMAGE_TYPES.includes(f.type)&&!VIDEO_TYPES.includes(f.type));if(unsupported)throw new Error('Use JPG, PNG, WebP, MP4, or WebM.');
    const photos=chosen.filter(f=>IMAGE_TYPES.includes(f.type)),videos=chosen.filter(f=>VIDEO_TYPES.includes(f.type));if(photos.length>8)throw new Error('You can upload up to 8 photos.');if(videos.length>1)throw new Error('Upload only one video per listing.');
    for(let i=0;i<photos.length;i++){if(photos[i].size>5*1024*1024)throw new Error(`Photo ${i+1} must be 5 MB or smaller.`)}
    if(videos[0]?.size>50*1024*1024)throw new Error('Video must be 50 MB or smaller.');
    return {chosen,photos,videos};
  }
  async function uploadFiles(files,listingId,userId){
    const {photos,videos}=validateMedia(files);
    for(let i=0;i<photos.length;i++)await uploadPhoto(photos[i],listingId,userId,i);
    if(videos[0]){await uploadVideo(videos[0],listingId,userId);if(!photos.length)await uploadVideoPoster(videos[0],listingId,userId)}
  }
  async function checkDeviceIdentity(identifier,listingId){const value=String(identifier||'').trim();if(!value)return null;return api('/functions/v1/device-identity',{method:'POST',body:{listing_id:listingId,type:'imei',identifier:value}})}
  async function submitListing(e){
    e.preventDefault();if(!validateCurrent())return;const s=session();if(!s?.user?.id){authGate.hidden=false;form.hidden=true;toast('Sign in to start your listing.');return}
    const fd=new FormData(form);const price=Number(fd.get('price'));const cur=validCurrency(fd.get('currency'));if(!Number.isFinite(price)||price<=0||!cur)return toast('Enter a valid price and choose a currency.');
    try{validateMedia(fd.getAll('images'))}catch(err){return toast(err.message)}
    const category=String(fd.get('category')||''),identifier=category==='Phones'?String(fd.get('device_identifier')||'').trim():'';if(identifier&&!validImei(identifier))return toast('Enter a valid 15-digit IMEI, or leave the optional IMEI field blank.');
    const brand=String(fd.get('brand')||'').trim(),model=String(fd.get('model')||'').trim();if(fd.get('storage')==='__other__')fd.set('storage',String(document.querySelector('#storageCustom')?.value||'').trim());if(fd.get('color')==='__other__')fd.set('color',String(document.querySelector('#colorCustom')?.value||'').trim());if(fd.get('ram')==='__other__')fd.set('ram','Other');const country=String(fd.get('country_code')||'').trim().toUpperCase();
    const submissionKey=getSubmissionKey();
    const payload={seller_id:s.user.id,title:`${brand} ${model}`.trim(),category,brand,model,condition:String(fd.get('condition')),price_amount:Math.round(price*10000)/10000,price_currency:cur,storage:String(fd.get('storage')||'').trim()||null,color:String(fd.get('color')||'').trim()||null,city:String(fd.get('city')||'').trim()||null,country_code:/^[A-Z]{2}$/.test(country)?country:null,delivery_mode:String(fd.get('delivery_mode')||'pickup'),warranty_text:String(fd.get('warranty_text')||'').trim()||null,description:String(fd.get('description')||'').trim(),specs:{battery_health:String(fd.get('battery_health')||'').trim()||null,battery_health_percent:(()=>{const m=String(fd.get('battery_health')||'').match(/^([0-9]{2,3})%$/);return m?Number(m[1]):null})(),network_status:String(fd.get('network_status')||'').trim()||null,ram:String(fd.get('ram')||'').trim()||null,condition_grade:String(fd.get('condition_grade')||'').trim()||null,cosmetic_condition:String(fd.get('condition_grade')||'').trim()||null,usage_origin:String(fd.get('usage_origin')||'').trim()||null,condition_notes:String(fd.get('condition_notes')||'').trim()||null,repair_history:String(fd.get('repair_history')||'').trim()||null,accessories:String(fd.get('accessories')||'').trim()||null,accepts_swap:String(fd.get('accepts_swap')||'false')==='true',swap_notes:String(fd.get('swap_notes')||'').trim()||null,submission_key:submissionKey},status:'draft'};
    submit.disabled=true;submit.textContent='Submitting…';let row=null;
    try{
      const recent=await api(`/rest/v1/listings?select=id,title,brand,model,specs,status,created_at&seller_id=eq.${encodeURIComponent(s.user.id)}&status=eq.draft&order=created_at.desc&limit=20`).catch(()=>[]);
      row=(recent||[]).find(item=>item?.specs?.submission_key===submissionKey)||(recent||[]).find(item=>!item?.specs?.submission_key&&item.title===payload.title&&item.brand===payload.brand&&item.model===payload.model)||null;
      if(row?.id){
        await api(`/rest/v1/listings?id=eq.${encodeURIComponent(row.id)}&seller_id=eq.${encodeURIComponent(s.user.id)}`,{method:'PATCH',body:payload,headers:{Prefer:'return=minimal'}});
      }else{
        const created=await api('/rest/v1/listings',{method:'POST',body:payload});row=Array.isArray(created)?created[0]:created;
        if(!row?.id){const find=await api(`/rest/v1/listings?select=id,specs&seller_id=eq.${encodeURIComponent(s.user.id)}&status=eq.draft&order=created_at.desc&limit=20`);row=(find||[]).find(item=>item?.specs?.submission_key===submissionKey)||find?.[0]}
      }
      if(!row?.id)throw new Error('Listing draft could not be opened.');
      await uploadFiles(fd.getAll('images'),row.id,s.user.id);
      const identityResult=identifier?await checkDeviceIdentity(identifier,row.id).catch(()=>({unavailable:true})):null;
      await api(`/rest/v1/listings?id=eq.${encodeURIComponent(row.id)}&seller_id=eq.${encodeURIComponent(s.user.id)}`,{method:'PATCH',body:{status:'pending'},headers:{Prefer:'return=minimal'}});
      localStorage.removeItem(DRAFT_KEY);clearSubmissionKey();await api(`/rest/v1/listing_drafts?user_id=eq.${encodeURIComponent(s.user.id)}`,{method:'DELETE'}).catch(()=>{});form.reset();
      if(identityResult?.duplicate)toast('Listing submitted for review. The device identifier matched another listing and was flagged for moderator review.');
      else if(identityResult?.unavailable)toast('Listing submitted for review. The optional identifier check will need moderator follow-up.');
      else toast('Listing submitted for review.');
      setTimeout(()=>location.assign('/dashboard'),1200);
    }catch(err){const message=String(err?.message||'Could not submit this listing.');toast(row?.id?`${message} Your draft is saved—fix the issue and retry.`:message)}finally{submit.disabled=false;submit.textContent='Submit review'}
  }
  next.onclick=()=>{if(!validateCurrent())return;draft();showStep(step+1)};back.onclick=()=>showStep(step-1);form.addEventListener('input',()=>{draft();scheduleServerDraft()});form.addEventListener('change',()=>{draft();scheduleServerDraft()});form.addEventListener('submit',submitListing);document.querySelector('select[name="category"]').addEventListener('change',syncPhoneSpecs);document.querySelector('#conditionGrade')?.addEventListener('change',syncConditionFields);document.querySelector('#listingMedia')?.addEventListener('change',renderMediaPreview);document.querySelector('#previewListing')?.addEventListener('click',previewListing);document.querySelector('#listingPreviewClose')?.addEventListener('click',()=>document.querySelector('#listingPreviewDialog')?.close());form.elements.price?.addEventListener('input',updatePriceGuidance);form.elements.currency?.addEventListener('change',scheduleMarketPriceGuidance);form.elements.brand?.addEventListener('change',scheduleMarketPriceGuidance);form.elements.model?.addEventListener('change',scheduleMarketPriceGuidance);document.addEventListener('ddh:localization-ready',e=>{const label=[window.DDH_COUNTRIES?.name?.(e.detail.country)||e.detail.country,e.detail.currency].filter(Boolean).join(' · ')||'Region & currency';document.querySelector('#localeChip').textContent=label;window.DDH_COUNTRIES?.populate?.(document.querySelector('#countryCode'),document.querySelector('#countryCode')?.value||e.detail.country);currencyOptions()});currencyOptions();window.DDH_COUNTRIES?.populate?.(document.querySelector('#countryCode'),window.DDH_LOCALIZATION?.state?.country||'');restore();currencyOptions();syncPhoneSpecs();syncConditionFields();updatePriceGuidance();renderMediaPreview();const s=session();if(!s?.user?.id){authGate.hidden=false;form.hidden=true}else{authGate.hidden=true;form.hidden=false;restoreServerDraft().then(()=>{window.DDH_COUNTRIES?.populate?.(document.querySelector('#countryCode'),document.querySelector('#countryCode')?.value||window.DDH_LOCALIZATION?.state?.country||'');currencyOptions();syncPhoneSpecs();syncConditionFields();updatePriceGuidance()})}showStep(0);
})();