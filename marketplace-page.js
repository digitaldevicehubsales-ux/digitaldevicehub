(() => {
  'use strict';
  const cfg=window.DDH_CONFIG||{};
  const url=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=String(cfg.supabasePublishableKey||'');
  const grid=document.querySelector('#marketplaceGrid');
  const empty=document.querySelector('#emptyState');
  const resultCount=document.querySelector('#resultCount');
  const filters=document.querySelector('#filters');
  const chips=document.querySelector('#activeFilters');
  const loadMore=document.querySelector('#loadMore');
  const controls={
    search:document.querySelector('#searchInput'),
    category:document.querySelector('#categoryFilter'),
    brand:document.querySelector('#brandFilter'),
    model:document.querySelector('#modelFilter'),
    condition:document.querySelector('#conditionFilter'),
    origin:document.querySelector('#originFilter'),
    storage:document.querySelector('#storageFilter'),
    ram:document.querySelector('#ramFilter'),
    battery:document.querySelector('#batteryFilter'),
    network:document.querySelector('#networkFilter'),
    delivery:document.querySelector('#deliveryFilter'),
    verified:document.querySelector('#verifiedFilter'),
    swap:document.querySelector('#swapFilter'),
    min:document.querySelector('#minPrice'),
    max:document.querySelector('#maxPrice'),
    country:document.querySelector('#countryFilter'),
    location:document.querySelector('#locationFilter'),
    sort:document.querySelector('#sortFilter')
  };
  const PAGE_SIZE=24;
  const params=new URLSearchParams(location.search);
  let rows=[],images=new Map(),sellers=new Map(),visibleCount=PAGE_SIZE;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const countryName=code=>window.DDH_COUNTRIES?.name?.(code)||code||'';
  const validCurrency=value=>/^[A-Z]{3}$/.test(String(value||'').toUpperCase())?String(value).toUpperCase():'';
  function verificationLabel(tier){const key=String(tier||'account').toLowerCase();return ({account:'Email confirmed',phone:'Phone verified',identity:'ID verified',id:'ID verified',business:'Business verified'})[key]||'Email confirmed'}
  const money=(amount,currency)=>{
    const value=Number(amount)||0,code=validCurrency(currency);
    if(!code)return value.toLocaleString();
    try{
      const max=new Intl.NumberFormat(undefined,{style:'currency',currency:code}).resolvedOptions().maximumFractionDigits;
      return new Intl.NumberFormat(undefined,{style:'currency',currency:code,minimumFractionDigits:Number.isInteger(value)?0:Math.min(2,max),maximumFractionDigits:Number.isInteger(value)?0:Math.min(2,max)}).format(value)
    }catch{return `${code} ${value.toLocaleString()}`}
  };
  const publicImage=path=>path?`${url}/storage/v1/object/public/listing-images/${String(path).split('/').map(encodeURIComponent).join('/')}`:'';
  async function get(path){const r=await fetch(`${url}${path}`,{headers:{apikey:key}});if(!r.ok)throw new Error(`Marketplace request failed (${r.status})`);return r.json()}
  function localAmount(item){const converted=window.DDH_LOCALIZATION?.convertAmount?.(Number(item.price_amount),item.price_currency);return Number(converted?.amount??item.price_amount)||0}
  function hydrateFromUrl(){
    controls.search.value=params.get('q')||'';
    const category=params.get('category');if(category&&[...controls.category.options].some(o=>o.value===category))controls.category.value=category;
    controls.condition.value=params.get('condition')||'all';
    if(controls.origin)controls.origin.value=params.get('origin')||'all';
    if(controls.storage)controls.storage.value=params.get('storage')||'all';
    if(controls.ram)controls.ram.value=params.get('ram')||'all';
    if(controls.battery)controls.battery.value=params.get('battery_min')||'all';
    if(controls.network)controls.network.value=params.get('network')||'all';
    if(controls.delivery)controls.delivery.value=params.get('delivery')||'all';
    if(controls.verified)controls.verified.checked=params.get('verified')==='1';
    if(controls.swap)controls.swap.checked=params.get('swap')==='1';
    controls.min.value=params.get('min_price')||'';
    controls.max.value=params.get('max_price')||'';
    controls.location.value=params.get('location')||'';
    controls.sort.value=params.get('sort')||'newest';
  }
  function syncUrl(){
    const p=new URLSearchParams(),q=controls.search.value.trim();
    if(q)p.set('q',q);
    if(controls.category.value!=='all')p.set('category',controls.category.value);
    if(controls.brand.value!=='all')p.set('brand',controls.brand.value);
    if(controls.model?.value&&controls.model.value!=='all')p.set('model',controls.model.value);
    if(controls.condition.value!=='all')p.set('condition',controls.condition.value);
    if(controls.origin?.value!=='all')p.set('origin',controls.origin.value);
    if(controls.storage?.value!=='all')p.set('storage',controls.storage.value);
    if(controls.ram?.value!=='all')p.set('ram',controls.ram.value);
    if(controls.battery?.value!=='all')p.set('battery_min',controls.battery.value);
    if(controls.network?.value!=='all')p.set('network',controls.network.value);
    if(controls.delivery?.value!=='all')p.set('delivery',controls.delivery.value);
    if(controls.verified?.checked)p.set('verified','1');
    if(controls.swap?.checked)p.set('swap','1');
    if(controls.min.value)p.set('min_price',controls.min.value);
    if(controls.max.value)p.set('max_price',controls.max.value);
    if(controls.country.value!=='all')p.set('country',controls.country.value);
    if(controls.location.value.trim())p.set('location',controls.location.value.trim());
    if(controls.sort.value!=='newest')p.set('sort',controls.sort.value);
    history.replaceState(null,'',location.pathname+(p.toString()?'?'+p.toString():''));
  }
  function matches(item){
    const q=controls.search.value.trim().toLowerCase(),category=controls.category.value,brand=controls.brand.value,model=controls.model?.value||'all',cond=controls.condition.value,country=controls.country.value,locq=controls.location.value.trim().toLowerCase(),amount=localAmount(item),min=Number(controls.min.value||0),max=Number(controls.max.value||0);
    const grade=item.specs?.condition_grade||item.specs?.cosmetic_condition||(item.condition==='new'?'New (sealed)':'');
    const origin=item.specs?.usage_origin||'';
    const ram=item.specs?.ram||'';
    const battery=Number(item.specs?.battery_health_percent||String(item.specs?.battery_health||'').match(/\d+/)?.[0]||0);
    const seller=sellers.get(item.seller_id)||{};
    const verified=Boolean(seller.verification_tier&&seller.verification_tier!=='account');
    const swap=Boolean(item.specs?.accepts_swap===true||item.specs?.accepts_swap==='true');
    const searchable=`${item.title} ${item.brand} ${item.model} ${item.category} ${item.storage||''} ${ram} ${grade} ${origin} ${item.city||''} ${countryName(item.country_code)}`.toLowerCase();
    return(category==='all'||item.category===category)
      &&(brand==='all'||item.brand===brand)
      &&(model==='all'||item.model===model)
      &&(cond==='all'||grade===cond)
      &&(!controls.origin||controls.origin.value==='all'||origin===controls.origin.value)
      &&(!controls.storage||controls.storage.value==='all'||item.storage===controls.storage.value)
      &&(!controls.ram||controls.ram.value==='all'||ram===controls.ram.value)
      &&(!controls.battery||controls.battery.value==='all'||battery>=Number(controls.battery.value))
      &&(!controls.network||controls.network.value==='all'||item.specs?.network_status===controls.network.value)
      &&(!controls.delivery||controls.delivery.value==='all'||(controls.delivery.value==='all_modes'?item.delivery_mode==='all':item.delivery_mode===controls.delivery.value))
      &&(!controls.verified?.checked||verified)
      &&(!controls.swap?.checked||swap)
      &&(country==='all'||item.country_code===country)
      &&(!q||searchable.includes(q))
      &&(!locq||`${item.city||''} ${item.country_code||''} ${countryName(item.country_code)}`.toLowerCase().includes(locq))
      &&(!min||amount>=min)&&(!max||amount<=max);
  }
  function listingHref(item){const slug=String(item.slug||item.title||'device').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');return `/device/${encodeURIComponent(item.id)}/${encodeURIComponent(slug||'device')}`}
  function card(item){
    const path=images.get(item.id),sellerData=sellers.get(item.seller_id)||{},seller=sellerData.display_name||'Seller',original=money(item.price_amount,item.price_currency),place=[item.city,countryName(item.country_code)].filter(Boolean).join(', '),localCurrency=validCurrency(window.DDH_LOCALIZATION?.state?.currency);
    const estimate=localCurrency&&item.price_currency!==localCurrency?`<div class="converted-line">Local estimate: <span class="price local-estimate" data-price-amount="${esc(item.price_amount)}" data-price-currency="${esc(item.price_currency)}">${esc(original)}</span></div>`:'';
    const battery=item.specs?.battery_health?`<span class="pill">Battery ${esc(item.specs.battery_health)}</span>`:'';
    const conditionGrade=item.specs?.condition_grade||item.specs?.cosmetic_condition||(item.condition==='new'?'New (sealed)':'');
    const grade=conditionGrade?`<span class="pill">${esc(conditionGrade)}</span>`:'';
    const origin=item.specs?.usage_origin?`<span class="pill">${esc(item.specs.usage_origin)}</span>`:'';
    const ram=item.specs?.ram?`<span class="pill">${esc(item.specs.ram)} RAM</span>`:'';
    const swap=item.specs?.accepts_swap===true||item.specs?.accepts_swap==='true'?'<span class="pill trust-pill">Swap open</span>':'';
    const imei=item.category==='Phones'&&item.identity_check_status==='format_valid'?'<span class="pill trust-pill">IMEI screened</span>':'';
    const href=listingHref(item);
    return `<article class="product-card-shell">
      <a class="product-card" aria-label="${esc(item.title)}, ${esc(item.condition==='new'?'New':'Used')}, ${esc(original)}" data-id="${esc(item.id)}" data-listing-card href="${href}">
        <div class="product-image">${path?`<img src="${esc(publicImage(path))}" alt="${esc(item.title)}" loading="lazy" width="900" height="675">`:'<span aria-hidden="true">▯</span>'}</div>
        <div class="product-content">
          <div class="tag-row"><span>${esc(item.category)}</span><span class="pill">${esc(conditionGrade||(item.condition==='new'?'New':'Used'))}</span></div>
          <h3>${esc(item.title)}</h3>
          <div class="subline">${esc(item.storage||'Details available')}${place?` · ${esc(place)}`:''}</div>
          <div class="card-attribute-row">${grade}${origin}${ram}${battery}${imei}${swap}</div>
          <div class="seller-price-primary">${esc(original)}</div>${estimate}
          <div class="seller-line"><span>Listed by ${esc(seller)}</span>${`<span class="seller-badge">✓ ${esc(verificationLabel(sellerData.verification_tier))}</span>`}${Number(sellerData.rating_count)>0?`<span class="seller-rating">${Number(sellerData.rating_avg).toFixed(1)}★</span>`:""}</div>
        </div>
      </a>
      <button class="card-save" type="button" data-save-id="${esc(item.id)}" aria-label="Save ${esc(item.title)}" title="Save device">♡</button>
      <button class="card-compare" type="button" data-compare-id="${esc(item.id)}" data-compare-title="${esc(item.title)}" aria-label="Add ${esc(item.title)} to comparison">Compare</button>
    </article>`;
  }
  function activeChipData(){
    const out=[];
    const add=(key,label,clear)=>out.push({key,label,clear});
    if(controls.search.value.trim())add('q',`Search: ${controls.search.value.trim()}`,()=>controls.search.value='');
    if(controls.category.value!=='all')add('category',controls.category.value,()=>controls.category.value='all');
    if(controls.brand.value!=='all')add('brand',controls.brand.value,()=>{controls.brand.value='all';updateModelOptions()});
    if(controls.model?.value&&controls.model.value!=='all')add('model',controls.model.value,()=>controls.model.value='all');
    if(controls.condition.value!=='all')add('condition',controls.condition.value,()=>controls.condition.value='all');
    if(controls.origin?.value!=='all')add('origin',controls.origin.value,()=>controls.origin.value='all');
    if(controls.storage?.value!=='all')add('storage',controls.storage.value,()=>controls.storage.value='all');
    if(controls.ram?.value!=='all')add('ram',controls.ram.value+' RAM',()=>controls.ram.value='all');
    if(controls.battery?.value!=='all')add('battery',controls.battery.value+'%+ battery',()=>controls.battery.value='all');
    if(controls.network?.value!=='all')add('network',controls.network.value,()=>controls.network.value='all');
    if(controls.delivery?.value!=='all')add('delivery','Delivery: '+controls.delivery.options[controls.delivery.selectedIndex].text,()=>controls.delivery.value='all');
    if(controls.verified?.checked)add('verified','Verified sellers',()=>controls.verified.checked=false);
    if(controls.swap?.checked)add('swap','Swaps accepted',()=>controls.swap.checked=false);
    if(controls.country.value!=='all')add('country',countryName(controls.country.value),()=>controls.country.value='all');
    if(controls.location.value.trim())add('location',controls.location.value.trim(),()=>controls.location.value='');
    if(controls.min.value)add('min',`Min ${controls.min.value}`,()=>controls.min.value='');
    if(controls.max.value)add('max',`Max ${controls.max.value}`,()=>controls.max.value='');
    return out;
  }
  function renderChips(){
    const data=activeChipData();
    chips.hidden=!data.length;
    chips.innerHTML=data.map(x=>`<button type="button" class="filter-chip" data-chip="${esc(x.key)}">${esc(x.label)} <span aria-hidden="true">×</span></button>`).join('');
    chips.querySelectorAll('[data-chip]').forEach((b,i)=>b.addEventListener('click',()=>{data[i].clear();visibleCount=PAGE_SIZE;render()}));
  }
  function render(){
    syncUrl();
    let filtered=rows.filter(matches);
    if(controls.sort.value==='price-asc')filtered.sort((a,b)=>localAmount(a)-localAmount(b));
    else if(controls.sort.value==='price-desc')filtered.sort((a,b)=>localAmount(b)-localAmount(a));
    else{const localCountry=String(window.DDH_LOCALIZATION?.state?.country||'').toUpperCase();filtered.sort((a,b)=>{const ar=localCountry&&a.country_code===localCountry?0:1,br=localCountry&&b.country_code===localCountry?0:1;return ar-br||new Date(b.created_at)-new Date(a.created_at)})}
    const page=filtered.slice(0,visibleCount);
    grid.innerHTML=page.map(card).join('');
    empty.hidden=filtered.length>0;
    if(!filtered.length)empty.innerHTML='No devices match those filters yet. <button type="button" class="link-button" id="relaxFilters">Clear filters</button> or save this search to come back later.';
    const displayCurrency=validCurrency(window.DDH_LOCALIZATION?.state?.currency);
    const priceHint=document.querySelector('#priceCurrencyHint');if(priceHint)priceHint.textContent=displayCurrency?`(${displayCurrency})`:'(seller currency)';
    resultCount.textContent=displayCurrency
      ? `${filtered.length.toLocaleString()} device${filtered.length===1?'':'s'} · local estimates use ${displayCurrency} where conversion is available`
      : `${filtered.length.toLocaleString()} device${filtered.length===1?'':'s'} · seller asking currencies shown; choose Region & currency for local estimates`;
    if(loadMore){loadMore.hidden=visibleCount>=filtered.length;loadMore.textContent=`Show more (${Math.min(PAGE_SIZE,filtered.length-visibleCount)} remaining)`}
    renderChips();
    window.DDH_LOCALIZATION?.refresh?.();
    document.querySelector('#relaxFilters')?.addEventListener('click',clearFilters);
  }
  function clearFilters(){
    controls.search.value='';controls.category.value='all';controls.brand.value='all';if(controls.model)controls.model.value='all';controls.condition.value='all';if(controls.origin)controls.origin.value='all';if(controls.storage)controls.storage.value='all';if(controls.ram)controls.ram.value='all';if(controls.battery)controls.battery.value='all';if(controls.network)controls.network.value='all';if(controls.delivery)controls.delivery.value='all';if(controls.verified)controls.verified.checked=false;if(controls.swap)controls.swap.checked=false;controls.min.value='';controls.max.value='';controls.country.value='all';controls.location.value='';controls.sort.value='newest';updateModelOptions();visibleCount=PAGE_SIZE;render();
  }
  function catalogBrands(){return window.DDH_DEVICE_CATALOG?.brands?.()||[]}
  function catalogModels(brand){return window.DDH_DEVICE_CATALOG?.models?.(brand)||[]}
  function allBrands(){
    return [...new Set([...catalogBrands(),...rows.map(x=>String(x.brand||'').trim()).filter(Boolean)])].sort((a,b)=>a.localeCompare(b));
  }
  function modelsForBrand(brand){
    if(!brand||brand==='all')return [];
    const fromCatalog=catalogModels(brand);
    const fromRows=rows.filter(r=>r.brand===brand).map(r=>String(r.model||'').trim()).filter(Boolean);
    return [...new Set([...fromCatalog,...fromRows])].sort((a,b)=>a.localeCompare(b));
  }
  function updateModelOptions(preferred){
    if(!controls.model)return;
    const brand=controls.brand.value;
    if(brand==='all'){
      controls.model.innerHTML='<option value="all">Select a brand first</option>';
      controls.model.value='all';
      controls.model.disabled=true;
      return;
    }
    const models=modelsForBrand(brand);
    controls.model.disabled=false;
    controls.model.innerHTML='<option value="all">All models</option>'+models.map(m=>`<option value="${esc(m)}">${esc(m)}${rows.some(r=>r.brand===brand&&r.model===m)?` (${rows.filter(r=>r.brand===brand&&r.model===m).length})`:''}</option>`).join('');
    const target=preferred||params.get('model');
    controls.model.value=target&&models.includes(target)?target:'all';
  }
  function updateCounts(){
    const categories=['Phones','Laptops','Tablets','Accessories','Wearables'];
    controls.category.innerHTML=`<option value="all">All devices (${rows.length})</option>`+categories.map(cat=>`<option value="${cat}">${cat} (${rows.filter(r=>r.category===cat).length})</option>`).join('');
    const brands=allBrands();
    controls.brand.innerHTML='<option value="all">All brands</option>'+brands.map(b=>{const count=rows.filter(r=>r.brand===b).length;return `<option value="${esc(b)}">${esc(b)}${count?` (${count})`:''}</option>`}).join('');
    if(controls.storage){const values=[...new Set(rows.map(r=>r.storage).filter(Boolean))].sort();controls.storage.innerHTML='<option value="all">Any storage</option>'+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}
    if(controls.ram){const values=[...new Set(rows.map(r=>r.specs?.ram).filter(Boolean))].sort();controls.ram.innerHTML='<option value="all">Any RAM</option>'+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}
    const allCountries=window.DDH_COUNTRIES?.sorted?.()||[];
    const countryCounts=new Map();rows.forEach(r=>countryCounts.set(r.country_code,(countryCounts.get(r.country_code)||0)+1));
    controls.country.innerHTML='<option value="all">All countries / regions</option>'+allCountries.map(x=>`<option value="${x.code}">${esc(x.name)}${countryCounts.has(x.code)?` (${countryCounts.get(x.code)})`:''}</option>`).join('');
    const category=params.get('category');if(category&&categories.includes(category))controls.category.value=category;
    const brand=params.get('brand');if(brand&&brands.includes(brand))controls.brand.value=brand;
    updateModelOptions(params.get('model'));
    const country=params.get('country');if(country&&window.DDH_COUNTRIES?.codes?.includes(country))controls.country.value=country;
  }
  function skeletons(){if(grid.dataset.ssr==='true'&&grid.children.length){grid.setAttribute('aria-busy','true');return}grid.innerHTML=Array.from({length:6},()=>'<div class="product-card skeleton-card"><div class="product-image skeleton"></div><div class="product-content"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium"></div></div></div>').join('')}
  async function load(){
    skeletons();
    try{
      await window.DDH_LOCALIZATION?.ready;
      const data=await get('/rest/v1/listings?select=id,slug,title,category,brand,model,condition,storage,city,country_code,price_amount,price_currency,seller_id,delivery_mode,created_at,specs,identity_check_status&status=eq.published&order=created_at.desc&limit=200');
      rows=data||[];grid.dataset.ssr='false';grid.removeAttribute('aria-busy');
      const ids=rows.map(x=>x.id),sellerIds=[...new Set(rows.map(x=>x.seller_id).filter(Boolean))];
      if(ids.length){
        const list=ids.map(x=>`"${x}"`).join(',');
        const imgs=await get(`/rest/v1/listing_images?select=listing_id,storage_path,variants,sort_order&listing_id=in.(${encodeURIComponent(list)})&order=sort_order.asc`).catch(()=>[]);
        for(const img of imgs)if(!images.has(img.listing_id))images.set(img.listing_id,img.variants?.card||img.storage_path);
      }
      if(sellerIds.length){
        const list=sellerIds.map(x=>`"${x}"`).join(',');
        const profiles=await get(`/rest/v1/public_profiles?select=id,display_name,verification_tier,rating_avg,rating_count,sales_count&id=in.(${encodeURIComponent(list)})`).catch(()=>[]);
        sellers=new Map(profiles.map(x=>[x.id,x]));
      }
      updateCounts();render();
    }catch(err){
      grid.dataset.ssr='false';grid.removeAttribute('aria-busy');grid.innerHTML='';resultCount.textContent='Marketplace unavailable';empty.hidden=false;empty.innerHTML=`We could not load the marketplace. <button type="button" class="link-button" id="retryMarketplace">Try again</button>`;document.querySelector('#retryMarketplace')?.addEventListener('click',load);
    }
  }
  hydrateFromUrl();
  let debounceTimer;
  Object.entries(controls).forEach(([name,c])=>{if(!c)return;const evt=c.tagName==='INPUT'?'input':'change';c.addEventListener(evt,()=>{visibleCount=PAGE_SIZE;if(name==='brand')updateModelOptions();if(evt==='input'){clearTimeout(debounceTimer);debounceTimer=setTimeout(render,180)}else render()})});
  document.querySelector('#clearFilters')?.addEventListener('click',clearFilters);
  document.querySelector('#filterToggle')?.addEventListener('click',e=>{const open=filters.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open));if(open)filters.querySelector('input,select,button')?.focus()});
  loadMore?.addEventListener('click',()=>{visibleCount+=PAGE_SIZE;render()});
  document.addEventListener('ddh:localization-ready',e=>{
    const country=countryName(e.detail?.country),currency=validCurrency(e.detail?.currency);
    document.querySelector('#localeChip').textContent=country&&currency?`${country} · ${currency}`:'Region & currency';
    render();
  });
  load();
})();