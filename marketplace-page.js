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
    condition:document.querySelector('#conditionFilter'),
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
  const money=(amount,currency)=>{
    const value=Number(amount)||0,code=currency||'USD';
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
    if(controls.condition.value!=='all')p.set('condition',controls.condition.value);
    if(controls.min.value)p.set('min_price',controls.min.value);
    if(controls.max.value)p.set('max_price',controls.max.value);
    if(controls.country.value!=='all')p.set('country',controls.country.value);
    if(controls.location.value.trim())p.set('location',controls.location.value.trim());
    if(controls.sort.value!=='newest')p.set('sort',controls.sort.value);
    history.replaceState(null,'',location.pathname+(p.toString()?'?'+p.toString():''));
  }
  function matches(item){
    const q=controls.search.value.trim().toLowerCase(),category=controls.category.value,brand=controls.brand.value,cond=controls.condition.value,country=controls.country.value,locq=controls.location.value.trim().toLowerCase(),amount=localAmount(item),min=Number(controls.min.value||0),max=Number(controls.max.value||0);
    const searchable=`${item.title} ${item.brand} ${item.model} ${item.category} ${item.storage||''} ${item.city||''} ${countryName(item.country_code)}`.toLowerCase();
    return(category==='all'||item.category===category)
      &&(brand==='all'||item.brand===brand)
      &&(cond==='all'||item.condition===cond)
      &&(country==='all'||item.country_code===country)
      &&(!q||searchable.includes(q))
      &&(!locq||`${item.city||''} ${item.country_code||''} ${countryName(item.country_code)}`.toLowerCase().includes(locq))
      &&(!min||amount>=min)&&(!max||amount<=max);
  }
  function listingHref(item){return `/device.html?id=${encodeURIComponent(item.id)}`}
  function card(item){
    const path=images.get(item.id),seller=sellers.get(item.seller_id)||'Seller',original=money(item.price_amount,item.price_currency),place=[item.city,countryName(item.country_code)].filter(Boolean).join(', '),localCurrency=window.DDH_LOCALIZATION?.state?.currency||'USD';
    const estimate=item.price_currency!==localCurrency?`<div class="converted-line">Local estimate: <span class="price local-estimate" data-price-amount="${esc(item.price_amount)}" data-price-currency="${esc(item.price_currency)}">${esc(original)}</span></div>`:'';
    const battery=item.specs?.battery_health?`<span class="pill">Battery ${esc(item.specs.battery_health)}</span>`:'';
    const href=listingHref(item);
    return `<article class="product-card-shell">
      <a class="product-card" aria-label="${esc(item.title)}, ${esc(item.condition==='new'?'New':'Used')}, ${esc(original)}" data-id="${esc(item.id)}" data-listing-card href="${href}">
        <div class="product-image">${path?`<img src="${esc(publicImage(path))}" alt="${esc(item.title)}" loading="lazy" width="900" height="675">`:'<span aria-hidden="true">▯</span>'}</div>
        <div class="product-content">
          <div class="tag-row"><span>${esc(item.category)}</span><span class="pill">${esc(item.condition==='new'?'New':'Used')}</span></div>
          <h3>${esc(item.title)}</h3>
          <div class="subline">${esc(item.storage||'Details available')}${place?` · ${esc(place)}`:''}</div>
          <div class="card-attribute-row">${battery}</div>
          <div class="seller-price-primary">${esc(original)}</div>${estimate}
          <div class="seller-line"><span>Listed by ${esc(seller)}</span></div>
        </div>
      </a>
      <button class="card-save" type="button" data-save-id="${esc(item.id)}" aria-label="Save ${esc(item.title)}" title="Save device">♡</button>
    </article>`;
  }
  function activeChipData(){
    const out=[];
    const add=(key,label,clear)=>out.push({key,label,clear});
    if(controls.search.value.trim())add('q',`Search: ${controls.search.value.trim()}`,()=>controls.search.value='');
    if(controls.category.value!=='all')add('category',controls.category.value,()=>controls.category.value='all');
    if(controls.brand.value!=='all')add('brand',controls.brand.value,()=>controls.brand.value='all');
    if(controls.condition.value!=='all')add('condition',controls.condition.value==='new'?'New':'Used',()=>controls.condition.value='all');
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
    else filtered.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const page=filtered.slice(0,visibleCount);
    grid.innerHTML=page.map(card).join('');
    empty.hidden=filtered.length>0;
    if(!filtered.length)empty.innerHTML='No devices match those filters yet. <button type="button" class="link-button" id="relaxFilters">Clear filters</button> or save this search to come back later.';
    resultCount.textContent=`${filtered.length.toLocaleString()} device${filtered.length===1?'':'s'} · prices shown in ${window.DDH_LOCALIZATION?.state?.currency||'your local currency'} where conversion is available`;
    if(loadMore){loadMore.hidden=visibleCount>=filtered.length;loadMore.textContent=`Show more (${Math.min(PAGE_SIZE,filtered.length-visibleCount)} remaining)`}
    renderChips();
    window.DDH_LOCALIZATION?.refresh?.();
    document.querySelector('#relaxFilters')?.addEventListener('click',clearFilters);
  }
  function clearFilters(){
    controls.search.value='';controls.category.value='all';controls.brand.value='all';controls.condition.value='all';controls.min.value='';controls.max.value='';controls.country.value='all';controls.location.value='';controls.sort.value='newest';visibleCount=PAGE_SIZE;render();
  }
  function updateCounts(){
    const categories=['Phones','Laptops','Tablets','Accessories','Wearables'];
    controls.category.innerHTML=`<option value="all">All devices (${rows.length})</option>`+categories.map(cat=>`<option value="${cat}">${cat} (${rows.filter(r=>r.category===cat).length})</option>`).join('');
    const brands=[...new Set(rows.map(x=>x.brand).filter(Boolean))].sort();
    controls.brand.innerHTML='<option value="all">All brands</option>'+brands.map(b=>`<option value="${esc(b)}">${esc(b)} (${rows.filter(r=>r.brand===b).length})</option>`).join('');
    const allCountries=window.DDH_COUNTRIES?.sorted?.()||[];
    const countryCounts=new Map();rows.forEach(r=>countryCounts.set(r.country_code,(countryCounts.get(r.country_code)||0)+1));
    controls.country.innerHTML='<option value="all">All countries / regions</option>'+allCountries.map(x=>`<option value="${x.code}">${esc(x.name)}${countryCounts.has(x.code)?` (${countryCounts.get(x.code)})`:''}</option>`).join('');
    const category=params.get('category');if(category&&categories.includes(category))controls.category.value=category;
    const brand=params.get('brand');if(brand&&brands.includes(brand))controls.brand.value=brand;
    const country=params.get('country');if(country&&window.DDH_COUNTRIES?.codes?.includes(country))controls.country.value=country;
  }
  function skeletons(){grid.innerHTML=Array.from({length:6},()=>'<div class="product-card skeleton-card"><div class="product-image skeleton"></div><div class="product-content"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line medium"></div></div></div>').join('')}
  async function load(){
    skeletons();
    try{
      await window.DDH_LOCALIZATION?.ready;
      const data=await get('/rest/v1/listings?select=id,slug,title,category,brand,model,condition,storage,city,country_code,price_amount,price_currency,seller_id,created_at,specs&status=eq.published&order=created_at.desc&limit=200');
      rows=data||[];
      const ids=rows.map(x=>x.id),sellerIds=[...new Set(rows.map(x=>x.seller_id).filter(Boolean))];
      if(ids.length){
        const list=ids.map(x=>`"${x}"`).join(',');
        const imgs=await get(`/rest/v1/listing_images?select=listing_id,storage_path,variants,sort_order&listing_id=in.(${encodeURIComponent(list)})&order=sort_order.asc`).catch(()=>[]);
        for(const img of imgs)if(!images.has(img.listing_id))images.set(img.listing_id,img.variants?.card||img.storage_path);
      }
      if(sellerIds.length){
        const list=sellerIds.map(x=>`"${x}"`).join(',');
        const profiles=await get(`/rest/v1/public_profiles?select=id,display_name&id=in.(${encodeURIComponent(list)})`).catch(()=>[]);
        sellers=new Map(profiles.map(x=>[x.id,x.display_name||'Seller']));
      }
      updateCounts();render();
    }catch(err){
      grid.innerHTML='';resultCount.textContent='Marketplace unavailable';empty.hidden=false;empty.innerHTML=`We could not load the marketplace. <button type="button" class="link-button" id="retryMarketplace">Try again</button>`;document.querySelector('#retryMarketplace')?.addEventListener('click',load);
    }
  }
  hydrateFromUrl();
  let debounceTimer;
  Object.values(controls).forEach(c=>{if(!c)return;const evt=c.tagName==='INPUT'?'input':'change';c.addEventListener(evt,()=>{visibleCount=PAGE_SIZE;if(evt==='input'){clearTimeout(debounceTimer);debounceTimer=setTimeout(render,180)}else render()})});
  document.querySelector('#clearFilters')?.addEventListener('click',clearFilters);
  document.querySelector('#filterToggle')?.addEventListener('click',e=>{const open=filters.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open));if(open)filters.querySelector('input,select,button')?.focus()});
  loadMore?.addEventListener('click',()=>{visibleCount+=PAGE_SIZE;render()});
  document.addEventListener('ddh:localization-ready',e=>{document.querySelector('#localeChip').textContent=`${countryName(e.detail.country)} · ${e.detail.currency}`;render()});
  load();
})();