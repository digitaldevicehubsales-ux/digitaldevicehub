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
  const res=await fetch(`${SUPABASE_URL}/rest/v1/listings?select=id,title,slug,category,brand,model,condition,storage,city,country_code,price_amount,price_currency,description,specs,updated_at&status=eq.published&id=eq.${encodeURIComponent(id)}&limit=1`,{headers});
  if(!res.ok)return null;
  const rows=await res.json();
  return rows?.[0]||null;
}
function canonicalPath(listing) {
  const slug=listing.slug||slugify(`${listing.title}-${listing.storage||''}-${listing.condition||''}-${listing.city||''}-${listing.country_code||''}`);
  return `/device/${encodeURIComponent(listing.id)}/${encodeURIComponent(slug)}`;
}
async function renderSitemap(url) {
  const headers={apikey:SUPABASE_KEY};
  const res=await fetch(`${SUPABASE_URL}/rest/v1/listings?select=id,slug,title,storage,condition,city,country_code,updated_at&status=eq.published&order=updated_at.desc&limit=1000`,{headers});
  const listings=res.ok?await res.json():[];
  const staticUrls=[
    ['/', 'daily', '1.0'],['/marketplace.html','hourly','0.9'],['/phones','daily','0.85'],['/laptops','daily','0.85'],['/tablets','daily','0.8'],['/accessories','daily','0.75'],['/wearables','daily','0.75'],['/sell','weekly','0.7'],['/trust','monthly','0.6'],['/help','monthly','0.5'],['/about','monthly','0.5'],['/contact','monthly','0.4'],['/privacy','yearly','0.2'],['/terms','yearly','0.2']
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

    const isLegacy=url.pathname==='/device'||url.pathname==='/device.html';
    const slugMatch=url.pathname.match(/^\/device\/([0-9a-f-]{36})(?:\/([^/?#]+))?\/?$/i);
    if(!isLegacy&&!slugMatch)return env.ASSETS.fetch(request);

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
