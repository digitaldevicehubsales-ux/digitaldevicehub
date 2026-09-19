const SUPABASE_URL = 'https://zfnqmduqxgvmgfbokjwl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Dq3vJAEg60BSnzfHxsx_Hg_AmHw0x4K';

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
    ['/', 'daily', '1.0'],
    ['/marketplace.html','hourly','0.9'],
    ['/phones','daily','0.85'],
    ['/laptops','daily','0.85'],
    ['/tablets','daily','0.8'],
    ['/accessories','daily','0.75'],
    ['/wearables','daily','0.75'],
    ['/sell','weekly','0.7'],
    ['/trust','monthly','0.6'],
    ['/help','monthly','0.5'],
    ['/about','monthly','0.5'],
    ['/contact','monthly','0.4'],
    ['/privacy','yearly','0.2'],
    ['/terms','yearly','0.2']
  ];
  const parts=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for(const [path,changefreq,priority] of staticUrls){
    parts.push(`<url><loc>${xmlEsc(url.origin+path)}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`);
  }
  for(const listing of listings){
    const path=canonicalPath(listing);
    const lastmod=listing.updated_at?`<lastmod>${xmlEsc(new Date(listing.updated_at).toISOString())}</lastmod>`:'';
    parts.push(`<url><loc>${xmlEsc(url.origin+path)}</loc>${lastmod}<changefreq>daily</changefreq><priority>0.8</priority></url>`);
  }
  parts.push('</urlset>');
  return new Response(parts.join('\n'),{headers:{'Content-Type':'application/xml; charset=UTF-8','Cache-Control':'public, max-age=300, s-maxage=900, stale-while-revalidate=3600'}});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if(url.pathname==='/sitemap.xml') return renderSitemap(url);

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
      if(isLegacy||url.pathname!==path){
        return Response.redirect(`${url.origin}${path}`,301);
      }

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

      const productSchema=clean({
        '@context':'https://schema.org',
        '@type':'Product',
        name:listing.title,
        description:listing.description||description,
        category:listing.category,
        brand:listing.brand?{'@type':'Brand',name:listing.brand}:undefined,
        model:listing.model||undefined,
        image:ogImage?[ogImage]:undefined,
        itemCondition:listing.condition==='new'?'https://schema.org/NewCondition':'https://schema.org/UsedCondition',
        additionalProperty:Object.entries(listing.specs||{}).filter(([,v])=>v).map(([name,value])=>({'@type':'PropertyValue',name,value:String(value)})),
        offers:{'@type':'Offer',price:String(listing.price_amount),priceCurrency:listing.price_currency,availability:'https://schema.org/InStock',url:canonical,areaServed:countryName(listing.country_code)||undefined}
      });
      const breadcrumbSchema={
        '@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
          {'@type':'ListItem',position:1,name:'Home',item:`${url.origin}/`},
          {'@type':'ListItem',position:2,name:listing.category,item:`${url.origin}/${String(listing.category).toLowerCase()}`},
          {'@type':'ListItem',position:3,name:listing.title,item:canonical}
        ]
      };

      let html=await shell.text();
      html=html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${esc(title)}</title>`);
      html=html.replace(/<meta name="description" content="[^"]*">/i,`<meta name="description" content="${esc(description)}">`);
      html=html.replace('</head>',`
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="product">
${ogImage?`<meta property="og:image" content="${esc(ogImage)}">`:''}
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${ogImage?`<meta name="twitter:image" content="${esc(ogImage)}">`:''}
<script type="application/ld+json">${JSON.stringify(productSchema).replace(/</g,'\\u003c')}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbSchema).replace(/</g,'\\u003c')}</script>
</head>`);

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
