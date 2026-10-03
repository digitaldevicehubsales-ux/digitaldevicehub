const SUPABASE_URL = 'https://zfnqmduqxgvmgfbokjwl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Dq3vJAEg60BSnzfHxsx_Hg_AmHw0x4K';
const ACCESS_COOKIE='__Host-ddh_access';
const REFRESH_COOKIE='__Host-ddh_refresh';
const SENTINEL='__http_only__';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function xmlEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
}
function imageUrl(path) {
  if (!path) return '';
  return `${SUPABASE_URL}/storage/v1/object/public/listing-images/${String(path).split('/').map(encodeURIComponent).join('/')}`;
}
function countryName(code) {
  const value=String(code||'').toUpperCase();
  if(!value)return '';
  try{return new Intl.DisplayNames(['en'],{type:'region'}).of(value)||value}catch{return value}
}
function money(amount, currency) {
  const value = Number(amount) || 0;
  const code = String(currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en', { style:'currency', currency:code, maximumFractionDigits:Number.isInteger(value)?0:2 }).format(value);
  } catch {
    return `${code} ${value.toLocaleString('en')}`;
  }
}
function slugify(value) {
  return String(value||'device').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'device';
}
function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([,v]) => v !== undefined && v !== null && v !== ''));
}
function parseCookies(request){
  const out={};
  const raw=request.headers.get('Cookie')||'';
  for(const part of raw.split(';')){
    const idx=part.indexOf('=');if(idx<0)continue;
    const name=part.slice(0,idx).trim(),value=part.slice(idx+1).trim();
    try{out[name]=decodeURIComponent(value)}catch{out[name]=value}
  }
  return out;
}
function cookieHeader(name,value,maxAge){
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0,Math.floor(maxAge))}; HttpOnly; Secure; SameSite=Lax`;
}
function clearCookie(name){return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`}
function jwtExp(token){
  try{
    const part=String(token||'').split('.')[1];if(!part)return 0;
    const padded=part.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((part.length+3)%4);
    return Number(JSON.parse(atob(padded)).exp||0);
  }catch{return 0}
}
function sameOrigin(request,url){
  const origin=request.headers.get('Origin');
  return !origin||origin===url.origin;
}
function json(data,status=200,extraHeaders={}){
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=UTF-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extraHeaders}});
}
async function supabaseUser(accessToken){
  const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${accessToken}`}});
  if(!r.ok)return null;
  return r.json();
}
async function refreshSession(refreshToken){
  if(!refreshToken||refreshToken===SENTINEL)return null;
  const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
    method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})
  });
  if(!r.ok)return null;
  return r.json();
}
function attachSessionCookies(headers,data){
  const expiresIn=Math.max(60,Number(data?.expires_in||3600));
  if(data?.access_token&&data.access_token!==SENTINEL)headers.append('Set-Cookie',cookieHeader(ACCESS_COOKIE,data.access_token,expiresIn));
  if(data?.refresh_token&&data.refresh_token!==SENTINEL)headers.append('Set-Cookie',cookieHeader(REFRESH_COOKIE,data.refresh_token,60*60*24*30));
}
function publicSession(data,userOverride){
  const exp=jwtExp(data?.access_token)||Math.floor(Date.now()/1000)+Number(data?.expires_in||3600);
  return {
    access_token:SENTINEL,
    refresh_token:SENTINEL,
    expires_in:Number(data?.expires_in||Math.max(60,exp-Math.floor(Date.now()/1000))),
    expires_at:exp,
    token_type:data?.token_type||'bearer',
    user:userOverride||data?.user||null
  };
}
async function handleSession(request,url){
  if(request.method!=='POST')return json({error:'Method not allowed'},405,{Allow:'POST'});
  if(!sameOrigin(request,url))return json({error:'Origin not allowed'},403);
  let body={};
  try{body=await request.json()}catch{}
  const cookies=parseCookies(request);
  const suppliedAccess=String(body?.access_token||'');
  const suppliedRefresh=String(body?.refresh_token||'');

  if(suppliedAccess&&suppliedAccess!==SENTINEL&&suppliedRefresh&&suppliedRefresh!==SENTINEL){
    const user=await supabaseUser(suppliedAccess);
    if(!user)return json({error:'Invalid session'},401);
    const headers=new Headers({'Content-Type':'application/json; charset=UTF-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    attachSessionCookies(headers,{access_token:suppliedAccess,refresh_token:suppliedRefresh,expires_in:Number(body?.expires_in||Math.max(60,jwtExp(suppliedAccess)-Math.floor(Date.now()/1000))),token_type:body?.token_type||'bearer'});
    return new Response(JSON.stringify(publicSession({access_token:suppliedAccess,expires_in:body?.expires_in,token_type:body?.token_type},user)),{status:200,headers});
  }

  const refreshToken=(suppliedRefresh&&suppliedRefresh!==SENTINEL?suppliedRefresh:'')||cookies[REFRESH_COOKIE]||'';
  const fresh=await refreshSession(refreshToken);
  if(!fresh)return json({error:'Session expired'},401);
  const headers=new Headers({'Content-Type':'application/json; charset=UTF-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  attachSessionCookies(headers,fresh);
  return new Response(JSON.stringify(publicSession(fresh)),{status:200,headers});
}
function handleLogout(request,url){
  if(request.method!=='POST')return json({error:'Method not allowed'},405,{Allow:'POST'});
  if(!sameOrigin(request,url))return json({error:'Origin not allowed'},403);
  const headers=new Headers({'Content-Type':'application/json; charset=UTF-8','Cache-Control':'no-store'});
  headers.append('Set-Cookie',clearCookie(ACCESS_COOKIE));
  headers.append('Set-Cookie',clearCookie(REFRESH_COOKIE));
  return new Response(JSON.stringify({ok:true}),{status:200,headers});
}
async function handleSupabaseProxy(request,url){
  if(!sameOrigin(request,url)&&!['GET','HEAD'].includes(request.method))return json({error:'Origin not allowed'},403);
  const targetPath=String(url.searchParams.get('path')||'');
  if(!/^\/(rest|storage|functions)\/v1\//.test(targetPath)&&!/^\/auth\/v1\/(user|logout)$/.test(targetPath))return json({error:'Unsupported API path'},400);

  const cookies=parseCookies(request);
  let access=cookies[ACCESS_COOKIE]||'';
  let refresh=cookies[REFRESH_COOKIE]||'';
  let rotated=null;
  if(!access||jwtExp(access)<Math.floor(Date.now()/1000)+45){
    rotated=await refreshSession(refresh);
    if(!rotated)return json({error:'Authentication required'},401);
    access=rotated.access_token;refresh=rotated.refresh_token;
  }

  const forwardHeaders=new Headers();
  for(const name of ['accept','content-type','prefer','range','range-unit','cache-control','x-client-info']){
    const value=request.headers.get(name);if(value)forwardHeaders.set(name,value);
  }
  forwardHeaders.set('apikey',SUPABASE_KEY);
  forwardHeaders.set('Authorization',`Bearer ${access}`);
  const body=['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer();
  const run=token=>fetch(`${SUPABASE_URL}${targetPath}`,{method:request.method,headers:new Headers([...forwardHeaders].map(([k,v])=>[k,k.toLowerCase()==='authorization'?`Bearer ${token}`:v])),body,redirect:'manual'});
  let upstream=await run(access);
  if(upstream.status===401&&refresh){
    const retry=await refreshSession(refresh);
    if(retry){rotated=retry;access=retry.access_token;upstream=await run(access)}
  }
  const headers=new Headers(upstream.headers);
  headers.delete('set-cookie');
  headers.set('Cache-Control',headers.get('Cache-Control')||'no-store');
  if(rotated)attachSessionCookies(headers,rotated);
  return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers});
}

async function getListing(id) {
  const headers={apikey:SUPABASE_KEY};
  const res=await fetch(`${SUPABASE_URL}/rest/v1/listings?select=id,seller_id,title,slug,category,brand,model,condition,storage,color,city,country_code,price_amount,price_currency,description,delivery_mode,warranty_text,specs,created_at,updated_at&status=eq.published&id=eq.${encodeURIComponent(id)}&limit=1`,{headers});
  if(!res.ok)return null;
  const rows=await res.json();
  return rows?.[0]||null;
}
function canonicalPath(listing) {
  const slug=listing.slug||slugify(`${listing.title}-${listing.storage||''}-${listing.condition||''}-${listing.city||''}-${listing.country_code||''}`);
  return `/device/${encodeURIComponent(listing.id)}/${encodeURIComponent(slug)}`;
}

async function getPublicListings(limit=12) {
  const headers={apikey:SUPABASE_KEY};
  const listingRes=await fetch(`${SUPABASE_URL}/rest/v1/listings?select=id,slug,title,category,brand,model,condition,storage,city,country_code,price_amount,price_currency,seller_id,specs,created_at&status=eq.published&order=created_at.desc&limit=${Math.max(1,Math.min(Number(limit)||12,48))}`,{headers});
  if(!listingRes.ok)return [];
  const listings=await listingRes.json();
  if(!listings.length)return [];

  const ids=listings.map(x=>x.id).filter(Boolean);
  const sellers=[...new Set(listings.map(x=>x.seller_id).filter(Boolean))];
  const idList=ids.map(id=>`"${id}"`).join(',');
  const sellerList=sellers.map(id=>`"${id}"`).join(',');
  const [imageRes,profileRes]=await Promise.all([
    ids.length?fetch(`${SUPABASE_URL}/rest/v1/listing_images?select=listing_id,storage_path,variants,sort_order&listing_id=in.(${encodeURIComponent(idList)})&order=sort_order.asc`,{headers}):Promise.resolve(null),
    sellers.length?fetch(`${SUPABASE_URL}/rest/v1/public_profiles?select=id,display_name,verification_tier,rating_avg,rating_count,sales_count&id=in.(${encodeURIComponent(sellerList)})`,{headers}):Promise.resolve(null)
  ]);
  const images=imageRes?.ok?await imageRes.json():[];
  const profiles=profileRes?.ok?await profileRes.json():[];
  const firstImage=new Map();
  for(const row of images||[]){
    if(row?.listing_id&&!firstImage.has(row.listing_id)){
      firstImage.set(row.listing_id,row?.variants?.card||row?.variants?.detail||row?.storage_path||'');
    }
  }
  const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));
  return listings.map(item=>({...item,_image:firstImage.get(item.id)||'',_seller:profileMap.get(item.seller_id)||null}));
}

function renderHomeListingCard(item) {
  const href=canonicalPath(item);
  const seller=item._seller?.display_name||'Seller';
  const grade=item.condition==='used'&&item.specs?.cosmetic_condition?` · ${esc(item.specs.cosmetic_condition)}`:'';
  const image=item._image?imageUrl(item._image):'';
  return `<article class="listing-card ssr-listing-card">
    <a href="${esc(href)}" aria-label="${esc(item.title)}, ${esc(money(item.price_amount,item.price_currency))}">
      <div class="listing-art">${image?`<img src="${esc(image)}" alt="${esc(item.title)}" loading="eager" fetchpriority="high" width="900" height="675">`:'<span aria-hidden="true">▯</span>'}</div>
      <div class="listing-body">
        <div class="listing-meta"><span>${esc(item.category)}</span><span>${esc(item.condition==='new'?'New':'Used')}${grade}</span></div>
        <h3>${esc(item.title)}</h3>
        <div class="listing-meta"><span>${esc(item.storage||'Details available')}</span><span>${esc([item.city,countryName(item.country_code)].filter(Boolean).join(', '))}</span></div>
        <div class="price">${esc(money(item.price_amount,item.price_currency))}</div>
        <div class="seller">${esc(seller)}${item._seller?.verification_tier&&item._seller.verification_tier!=='account'?` <span class="verified">✓ ${esc(item._seller.verification_tier)}</span>`:''}</div>
      </div>
    </a>
  </article>`;
}

function renderMarketListingCard(item) {
  const href=canonicalPath(item);
  const seller=item._seller?.display_name||'Seller';
  const image=item._image?imageUrl(item._image):'';
  const grade=item.condition==='used'&&item.specs?.cosmetic_condition?`<span class="pill">${esc(item.specs.cosmetic_condition)}</span>`:'';
  const rating=Number(item._seller?.rating_count)>0?`<span class="seller-rating">${Number(item._seller.rating_avg).toFixed(1)}★</span>`:'';
  return `<article class="product-card-shell ssr-product-card">
    <a class="product-card" href="${esc(href)}" aria-label="${esc(item.title)}, ${esc(money(item.price_amount,item.price_currency))}">
      <div class="product-image">${image?`<img src="${esc(image)}" alt="${esc(item.title)}" loading="eager" width="900" height="675">`:'<span aria-hidden="true">▯</span>'}</div>
      <div class="product-content">
        <div class="tag-row"><span>${esc(item.category)}</span><span class="pill">${esc(item.condition==='new'?'New':'Used')}</span></div>
        <h3>${esc(item.title)}</h3>
        <div class="subline">${esc(item.storage||'Details available')}${item.city?` · ${esc(item.city)}`:''}</div>
        <div class="card-attribute-row">${grade}</div>
        <div class="seller-price-primary">${esc(money(item.price_amount,item.price_currency))}</div>
        <div class="seller-line"><span>Listed by ${esc(seller)}</span>${rating}</div>
      </div>
    </a>
  </article>`;
}

async function renderPublicPage(request,env,url,assetPath,kind) {
  const assetUrl=new URL(assetPath,url.origin);
  const shell=await env.ASSETS.fetch(new Request(assetUrl.toString(),{method:'GET',headers:request.headers}));
  if(!shell.ok)return shell;
  let html=await shell.text();
  try{
    const listings=await getPublicListings(kind==='home'?8:24);
    const shareImage=listings[0]?._image?imageUrl(listings[0]._image):'';
    if(shareImage){
      if(/<meta property="og:image" content="[^"]*">/i.test(html))html=html.replace(/<meta property="og:image" content="[^"]*">/i,`<meta property="og:image" content="${esc(shareImage)}">`);
      else html=html.replace('</head>',`<meta property="og:image" content="${esc(shareImage)}"><meta name="twitter:image" content="${esc(shareImage)}"></head>`);
      if(/<meta name="twitter:image" content="[^"]*">/i.test(html))html=html.replace(/<meta name="twitter:image" content="[^"]*">/i,`<meta name="twitter:image" content="${esc(shareImage)}">`);
    }
    if(kind==='home'){
      html=html.replace('<div id="listingGrid" class="listing-grid home-listing-preview" aria-live="polite"></div>',
        `<div id="listingGrid" class="listing-grid home-listing-preview" aria-live="polite" data-ssr="true">${listings.map(renderHomeListingCard).join('')}</div>`);
      if(listings.length)html=html.replace('<p id="emptyState" class="empty-state" hidden>No matching devices.</p>','<p id="emptyState" class="empty-state" hidden>No matching devices.</p>');
    }else{
      html=html.replace('<div class="result-count" id="resultCount" role="status" aria-live="polite">Loading devices…</div>',
        `<div class="result-count" id="resultCount" role="status" aria-live="polite">${listings.length} device${listings.length===1?'':'s'} available</div>`);
      html=html.replace('<div class="product-grid" id="marketplaceGrid" style="margin-top:18px"></div>',
        `<div class="product-grid" id="marketplaceGrid" style="margin-top:18px" data-ssr="true">${listings.map(renderMarketListingCard).join('')}</div>`);
    }
  }catch{}
  const headers=new Headers(shell.headers);
  headers.set('Content-Type','text/html; charset=UTF-8');
  headers.set('Cache-Control','public, max-age=30, s-maxage=60, stale-while-revalidate=300');
  return new Response(html,{status:200,headers});
}

const PUBLIC_ROUTES=new Map([
  ['/marketplace','/marketplace.html'],
  ['/sell','/sell.html'],
  ['/trust','/trust.html'],
  ['/help','/help.html'],
  ['/about','/about.html'],
  ['/contact','/contact.html'],
  ['/privacy','/privacy.html'],
  ['/terms','/terms.html'],
  ['/compare','/compare.html'],
  ['/seller','/seller.html'],
  ['/phones','/phones.html'],
  ['/laptops','/laptops.html'],
  ['/tablets','/tablets.html'],
  ['/accessories','/accessories.html'],
  ['/wearables','/wearables.html']
]);
async function renderSitemap(url) {
  const headers={apikey:SUPABASE_KEY};
  const res=await fetch(`${SUPABASE_URL}/rest/v1/listings?select=id,slug,title,storage,condition,city,country_code,updated_at&status=eq.published&order=updated_at.desc&limit=1000`,{headers});
  const listings=res.ok?await res.json():[];
  const staticUrls=[
    ['/', 'daily', '1.0'],['/marketplace','hourly','0.9'],['/phones','daily','0.85'],['/laptops','daily','0.85'],['/tablets','daily','0.8'],['/accessories','daily','0.75'],['/wearables','daily','0.75'],['/sell','weekly','0.7'],['/trust','monthly','0.6'],['/help','monthly','0.5'],['/about','monthly','0.5'],['/contact','monthly','0.4'],['/privacy','yearly','0.2'],['/terms','yearly','0.2']
  ];
  const parts=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for(const [path,changefreq,priority] of staticUrls)parts.push(`<url><loc>${xmlEsc(url.origin+path)}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`);
  for(const listing of listings){
    const path=canonicalPath(listing);const lastmod=listing.updated_at?`<lastmod>${xmlEsc(new Date(listing.updated_at).toISOString())}</lastmod>`:'';
    parts.push(`<url><loc>${xmlEsc(url.origin+path)}</loc>${lastmod}<changefreq>daily</changefreq><priority>0.8</priority></url>`);
  }
  parts.push('</urlset>');
  return new Response(parts.join('\n'),{headers:{'Content-Type':'application/xml; charset=UTF-8','Cache-Control':'public, max-age=300, s-maxage=900, stale-while-revalidate=3600'}});
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(url.pathname==='/auth/session')return handleSession(request,url);
    if(url.pathname==='/auth/logout')return handleLogout(request,url);
    if(url.pathname==='/api/supabase')return handleSupabaseProxy(request,url);
    if(url.pathname==='/sitemap.xml')return renderSitemap(url);

    if(request.method==='GET'||request.method==='HEAD'){
      if(url.pathname==='/')return renderPublicPage(request,env,url,'/index.html','home');
      if(url.pathname==='/marketplace')return renderPublicPage(request,env,url,'/marketplace.html','marketplace');
      if(url.pathname.endsWith('.html')){
        const cleanPath=url.pathname==='/index.html'?'/':url.pathname.replace(/\.html$/,'');
        if(PUBLIC_ROUTES.has(cleanPath)||cleanPath==='/')return Response.redirect(url.origin+cleanPath+url.search,301);
      }
      const mapped=PUBLIC_ROUTES.get(url.pathname);
      if(mapped){
        const assetUrl=new URL(mapped,url.origin);
        return env.ASSETS.fetch(new Request(assetUrl.toString(),{method:request.method,headers:request.headers}));
      }
    }

    const isLegacy=url.pathname==='/device'||url.pathname==='/device.html';
    const slugMatch=url.pathname.match(/^\/device\/([0-9a-f-]{36})(?:\/([^/?#]+))?\/?$/i);
    if(!isLegacy&&!slugMatch){
      const asset=await env.ASSETS.fetch(request);
      const acceptsHtml=(request.headers.get('accept')||'').includes('text/html');
      if(asset.status!==404||!acceptsHtml)return asset;
      const notFoundUrl=new URL('/404.html',url.origin);
      const notFound=await env.ASSETS.fetch(new Request(notFoundUrl.toString(),{method:'GET',headers:request.headers}));
      const headers=new Headers(notFound.headers);
      headers.set('Cache-Control','no-store');
      return new Response(notFound.body,{status:404,statusText:'Not Found',headers});
    }

    const id=isLegacy?url.searchParams.get('id'):slugMatch?.[1];
    if(!id||!/^[0-9a-f-]{36}$/i.test(id)){
      const shellUrl=new URL('/device-shell.html',url.origin);
      return env.ASSETS.fetch(new Request(shellUrl.toString(),{method:'GET',headers:request.headers}));
    }

    try{
      const listing=await getListing(id);
      if(!listing){
        const shellUrl=new URL('/device-shell.html',url.origin);
        return env.ASSETS.fetch(new Request(shellUrl.toString(),{method:'GET',headers:request.headers}));
      }
      const path=canonicalPath(listing);
      if(isLegacy||url.pathname!==path)return Response.redirect(`${url.origin}${path}`,301);

      const shellUrl=new URL('/device-shell.html',url.origin);
      const shell=await env.ASSETS.fetch(new Request(shellUrl.toString(),{method:'GET',headers:request.headers}));
      if(!shell.ok)return shell;

      const headers={apikey:SUPABASE_KEY};
      const imageRes=await fetch(`${SUPABASE_URL}/rest/v1/listing_images?select=storage_path,variants&listing_id=eq.${encodeURIComponent(id)}&order=sort_order.asc&limit=1`,{headers});
      const imageRows=imageRes.ok?await imageRes.json():[];
      const firstImage=imageRows?.[0]?.variants?.detail||imageRows?.[0]?.storage_path||'';
      const ogImage=imageUrl(firstImage);
      const condition=listing.condition==='new'?'New':'Used';
      const location=[listing.city,countryName(listing.country_code)].filter(Boolean).join(', ');
      const formattedPrice=money(listing.price_amount,listing.price_currency);
      const title=`${listing.title}${listing.storage?` ${listing.storage}`:''} ${condition} — ${formattedPrice}${location?` in ${location}`:''} | DigitalDeviceHub`;
      const description=`${condition} ${listing.title}${listing.storage?` ${listing.storage}`:''} listed on DigitalDeviceHub${location?` in ${location}`:''}. Seller asking price: ${formattedPrice}. View structured device details, seller context and delivery scope.`;
      const canonical=`${url.origin}${path}`;
      const productSchema=clean({'@context':'https://schema.org','@type':'Product',name:listing.title,description:listing.description||description,category:listing.category,brand:listing.brand?{'@type':'Brand',name:listing.brand}:undefined,model:listing.model||undefined,image:ogImage?[ogImage]:undefined,itemCondition:listing.condition==='new'?'https://schema.org/NewCondition':'https://schema.org/UsedCondition',additionalProperty:Object.entries(listing.specs||{}).filter(([,v])=>v).map(([name,value])=>({'@type':'PropertyValue',name,value:String(value)})),offers:{'@type':'Offer',price:String(listing.price_amount),priceCurrency:listing.price_currency,availability:'https://schema.org/InStock',url:canonical,areaServed:countryName(listing.country_code)||undefined}});
      const breadcrumbSchema={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:`${url.origin}/`},{'@type':'ListItem',position:2,name:listing.category,item:`${url.origin}/${String(listing.category).toLowerCase()}`},{'@type':'ListItem',position:3,name:listing.title,item:canonical}]};

      let html=await shell.text();
      const coreMeta='<span class="eyebrow">'+esc(listing.category)+' · '+esc(condition)+'</span><h1>'+esc(listing.title)+'</h1><div class="subline">'+esc([listing.storage,location].filter(Boolean).join(' · '))+'</div><div class="device-price">'+esc(formattedPrice)+'</div>';
      const detailRows=[['Condition',condition],['Storage',listing.storage],['Colour',listing.color],['Battery health',listing.specs?.battery_health],['Network status',listing.specs?.network_status],['Used condition',listing.specs?.cosmetic_condition],['Visible wear or faults',listing.specs?.condition_notes],['Repairs',listing.specs?.repair_history],['Included',listing.specs?.accessories],['Warranty',listing.warranty_text],['Location',location]].filter(([,v])=>v);
      html=html.replace('<div id="deviceMeta"><span class="eyebrow">Loading device</span><h1>Please wait…</h1></div>','<div id="deviceMeta">'+coreMeta+'</div>');
      html=html.replace('<p id="deviceDescription" style="color:#6e7480;line-height:1.75">Loading details…</p>','<p id="deviceDescription" style="color:#6e7480;line-height:1.75">'+esc(listing.description||description)+'</p>');
      html=html.replace('<div class="specs" id="deviceSpecs"></div>','<div class="specs" id="deviceSpecs">'+detailRows.map(([label,value])=>'<div class="spec"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('')+'</div>');
      if(ogImage)html=html.replace('<div class="gallery-main" id="galleryMain"><div class="skeleton gallery-loading"></div></div>','<div class="gallery-main" id="galleryMain"><img src="'+esc(ogImage)+'" alt="'+esc(listing.title)+'" width="1200" height="900"></div>');
      html=html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${esc(title)}</title>`);
      html=html.replace(/<meta name="description" content="[^"]*">/i,`<meta name="description" content="${esc(description)}">`);
      html=html.replace('</head>',`\n<link rel="canonical" href="${esc(canonical)}">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(description)}">\n<meta property="og:url" content="${esc(canonical)}">\n<meta property="og:type" content="product">\n${ogImage?`<meta property="og:image" content="${esc(ogImage)}">`:''}\n<meta name="twitter:title" content="${esc(title)}">\n<meta name="twitter:description" content="${esc(description)}">\n${ogImage?`<meta name="twitter:image" content="${esc(ogImage)}">`:''}\n<script type="application/ld+json">${JSON.stringify(productSchema).replace(/</g,'\\u003c')}</script>\n<script type="application/ld+json">${JSON.stringify(breadcrumbSchema).replace(/</g,'\\u003c')}</script>\n</head>`);
      const bootstrap=`<script>history.replaceState(null,'',location.pathname+'?id=${encodeURIComponent(id)}')</script>`;
      const cleanup=`<script>document.addEventListener('DOMContentLoaded',()=>history.replaceState(null,'','${path}'))</script>`;
      html=html.replace('<script src="/device-page.js" defer></script>',`${bootstrap}<script src="/device-page.js" defer></script>${cleanup}`);
      const response=new Response(html,shell);
      response.headers.set('Content-Type','text/html; charset=UTF-8');
      response.headers.set('Cache-Control','public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      return response;
    }catch{
      const shellUrl=new URL('/device-shell.html',url.origin);
      return env.ASSETS.fetch(new Request(shellUrl.toString(),{method:'GET',headers:request.headers}));
    }
  }
};
