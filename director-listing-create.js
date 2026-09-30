(() => {
  'use strict';

  const cfg=window.DDH_CONFIG||{};
  const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=String(cfg.supabasePublishableKey||'');
  const SESSION_KEY='ddh_supabase_session';
  const button=document.querySelector('#directorCreateListing');
  const dialog=document.querySelector('#directorDialog');
  const modalBody=document.querySelector('#modalBody');
  const toastEl=document.querySelector('#directorToast');
  if(!button||!dialog||!modalBody)return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validCurrency=v=>/^[A-Z]{3}$/.test(String(v||'').trim().toUpperCase())?String(v).trim().toUpperCase():'';
  const session=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
  function toast(message){if(!toastEl)return;toastEl.textContent=message;toastEl.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>toastEl.classList.remove('show'),3200)}
  function close(){dialog.close()}

  async function api(path,{method='GET',body,prefer='return=representation'}={}){
    const s=session();
    if(!s?.access_token||!s?.user?.id)throw new Error('Director sign-in is required.');
    const headers={apikey:key,Authorization:`Bearer ${s.access_token}`,Prefer:prefer};
    if(body!==undefined)headers['Content-Type']='application/json';
    const r=await fetch(`${base}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    const text=await r.text();
    let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok)throw new Error(data?.message||data?.details||data?.error||`Request failed (${r.status})`);
    return data;
  }

  async function resizeImage(file,maxWidth,quality=.82){
    let bitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'})}catch{bitmap=await createImageBitmap(file)}
    const scale=Math.min(1,maxWidth/bitmap.width),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,width,height);bitmap.close?.();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    if(!blob)throw new Error('A product photo could not be processed.');
    return {blob,width,height};
  }

  async function uploadBlob(blob,path){
    const s=session();
    const r=await fetch(`${base}/storage/v1/object/listing-images/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${s.access_token}`,'Content-Type':'image/webp','cache-control':'max-age=31536000'},body:blob});
    if(!r.ok){const text=await r.text();throw new Error(text||`Image upload failed (${r.status})`)}
  }

  async function uploadImages(files,listingId,userId){
    const chosen=[...files].filter(f=>f instanceof File&&f.size);
    if(!chosen.length)throw new Error('Add at least one product photo.');
    if(chosen.length>8)throw new Error('You can upload up to 8 photos.');
    for(let i=0;i<chosen.length;i++){
      const file=chosen[i];
      if(file.size>5*1024*1024)throw new Error(`Photo ${i+1} must be 5 MB or smaller.`);
      if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use JPEG, PNG or WebP photos only.');
      const root=`${userId}/${listingId}/${crypto.randomUUID()}`;
      const [thumb,card,detail]=await Promise.all([resizeImage(file,480,.78),resizeImage(file,900,.82),resizeImage(file,1600,.86)]);
      const thumbPath=`${root}-480.webp`,cardPath=`${root}-900.webp`,detailPath=`${root}-1600.webp`;
      await Promise.all([uploadBlob(thumb.blob,thumbPath),uploadBlob(card.blob,cardPath),uploadBlob(detail.blob,detailPath)]);
      await api('/rest/v1/listing_images',{method:'POST',body:{listing_id:listingId,storage_path:detailPath,sort_order:i,width:detail.width,height:detail.height,variants:{thumb:thumbPath,card:cardPath,detail:detailPath}},prefer:'return=minimal'});
    }
  }

  function brandOptions(){
    const brands=window.DDH_DEVICE_CATALOG?.brands?.()||['Apple','Samsung','Google','Xiaomi'];
    return '<option value="">Choose brand</option>'+brands.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }
  function modelOptions(brand){
    const models=window.DDH_DEVICE_CATALOG?.models?.(brand)||[];
    return '<option value="">Choose model</option>'+models.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')+'<option value="__custom">Other / custom model</option>';
  }

  function openCreate(){
    document.querySelector('#modalTitle').textContent='List product';
    document.querySelector('#modalEyebrow').textContent='Director marketplace listing';
    modalBody.innerHTML=`<form id="directorListingCreateForm">
      <div class="form-grid">
        <label class="field">Category<select name="category" required><option value="">Choose category</option><option>Phones</option><option>Laptops</option><option>Tablets</option><option>Accessories</option><option>Wearables</option></select></label>
        <label class="field">Condition<select name="condition" required><option value="new">New</option><option value="used">Used</option></select></label>
        <label class="field">Brand<select name="brand" id="directorBrand" required>${brandOptions()}</select></label>
        <label class="field">Model<select name="model_select" id="directorModel" required disabled><option value="">Select a brand first</option></select><input name="model_custom" id="directorCustomModel" maxlength="100" placeholder="Enter model" hidden></label>
        <label class="field full">Listing title<input name="title" maxlength="140" placeholder="Auto-filled from brand and model"></label>
        <label class="field">Price<input name="price" type="number" min="0.0001" step="0.0001" required placeholder="450"></label>
        <label class="field">Currency<input name="currency" maxlength="3" pattern="[A-Za-z]{3}" required value="USD" placeholder="USD"></label>
        <label class="field">Storage<input name="storage" maxlength="60" placeholder="128 GB"></label>
        <label class="field">Colour<input name="color" maxlength="60" placeholder="Black"></label>
        <label class="field">City / locality<input name="city" maxlength="80" required placeholder="City"></label>
        <label class="field">Country code<input name="country" maxlength="2" pattern="[A-Za-z]{2}" required placeholder="NG"></label>
        <label class="field">Delivery<select name="delivery"><option value="pickup">Local pickup only</option><option value="domestic">Domestic shipping</option><option value="international">International shipping</option><option value="pickup_domestic">Pickup + domestic</option><option value="all">Pickup + domestic + international</option></select></label>
        <label class="field">Publish status<select name="status"><option value="published" selected>Publish now</option><option value="pending">Pending review</option><option value="draft">Save as draft</option></select></label>
        <label class="field full">Warranty / guarantee<input name="warranty" maxlength="180" placeholder="Optional warranty information"></label>
        <label class="field full">Description<textarea name="description" rows="5" maxlength="2000" required placeholder="Describe the product clearly and honestly."></textarea></label>
        <label class="field full">Product photos<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required><small class="muted">1–8 photos · JPEG, PNG or WebP · maximum 5 MB each.</small></label>
      </div>
      <div class="modal-actions"><button class="btn secondary" type="button" data-cancel>Cancel</button><button class="btn blue" type="submit">List product</button></div>
    </form>`;
    dialog.showModal();

    const form=document.querySelector('#directorListingCreateForm'),brand=form.querySelector('#directorBrand'),model=form.querySelector('#directorModel'),custom=form.querySelector('#directorCustomModel'),submit=form.querySelector('[type="submit"]');
    form.querySelector('[data-cancel]').onclick=close;
    brand.onchange=()=>{const value=brand.value;model.disabled=!value;model.innerHTML=value?modelOptions(value):'<option value="">Select a brand first</option>';custom.hidden=true;custom.required=false;custom.value=''};
    model.onchange=()=>{const isCustom=model.value==='__custom';custom.hidden=!isCustom;custom.required=isCustom;if(isCustom)custom.focus()};

    form.onsubmit=async e=>{
      e.preventDefault();
      const s=session();if(!s?.user?.id)return toast('Director sign-in is required.');
      const fd=new FormData(form),brandValue=String(fd.get('brand')||'').trim(),modelValue=String(fd.get('model_select'))==='__custom'?String(fd.get('model_custom')||'').trim():String(fd.get('model_select')||'').trim(),currency=validCurrency(fd.get('currency')),price=Number(fd.get('price')),country=String(fd.get('country')||'').trim().toUpperCase(),status=String(fd.get('status'));
      if(!brandValue||!modelValue)return toast('Choose a brand and model.');
      if(!Number.isFinite(price)||price<=0)return toast('Enter a valid price.');
      if(!currency)return toast('Enter a valid 3-letter currency code.');
      if(!/^[A-Z]{2}$/.test(country))return toast('Enter a valid 2-letter country code.');
      const title=String(fd.get('title')||'').trim()||`${brandValue} ${modelValue}`;
      submit.disabled=true;submit.textContent='Listing…';
      let createdId=null;
      try{
        const created=await api('/rest/v1/listings',{method:'POST',body:{seller_id:s.user.id,title,category:String(fd.get('category')),brand:brandValue,model:modelValue,condition:String(fd.get('condition')),price_amount:Math.round(price*10000)/10000,price_currency:currency,description:String(fd.get('description')||'').trim(),storage:String(fd.get('storage')||'').trim()||null,color:String(fd.get('color')||'').trim()||null,city:String(fd.get('city')||'').trim(),country_code:country,delivery_mode:String(fd.get('delivery')),warranty_text:String(fd.get('warranty')||'').trim()||null,specs:{},status:'draft',published_at:null},prefer:'return=representation'});
        const row=Array.isArray(created)?created[0]:created;createdId=row?.id;if(!createdId)throw new Error('Product was created but could not be reopened.');
        await uploadImages(fd.getAll('images'),createdId,s.user.id);
        const finalBody={status,published_at:status==='published'?new Date().toISOString():null};
        await api(`/rest/v1/listings?id=eq.${encodeURIComponent(createdId)}`,{method:'PATCH',body:finalBody,prefer:'return=minimal'});
        await api('/rest/v1/moderation_actions',{method:'POST',body:{admin_id:s.user.id,listing_id:createdId,action:'director_create_listing',note:`Director created product listing with status ${status}.`,assigned_to:s.user.id},prefer:'return=minimal'}).catch(()=>{});
        close();toast(status==='published'?'Product published to the marketplace.':'Product listing saved.');
        document.querySelector('#directorRefresh')?.click();
      }catch(err){
        if(createdId)toast(`${err.message} The incomplete listing remains saved as a draft.`);else toast(err.message);
      }finally{submit.disabled=false;submit.textContent='List product'}
    };
  }

  button.addEventListener('click',openCreate);
})();
