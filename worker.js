const SUPABASE_URL = 'https://zfnqmduqxgvmgfbokjwl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Dq3vJAEg60BSnzfHxsx_Hg_AmHw0x4K';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function imageUrl(path) {
  if (!path) return '';
  return `${SUPABASE_URL}/storage/v1/object/public/listing-images/${String(path).split('/').map(encodeURIComponent).join('/')}`;
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
function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([,v]) => v !== undefined && v !== null && v !== ''));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/device' && url.pathname !== '/device.html') {
      return env.ASSETS.fetch(request);
    }

    const shellUrl = new URL('/device-shell.html', url.origin);
    const shell = await env.ASSETS.fetch(new Request(shellUrl.toString(), { method:'GET', headers:request.headers }));
    if (!shell.ok) return shell;

    const id = url.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return shell;

    try {
      const headers = { apikey: SUPABASE_KEY };
      const listingRes = await fetch(`${SUPABASE_URL}/rest/v1/listings?select=id,title,slug,category,brand,model,condition,storage,city,country_code,price_amount,price_currency,description,specs&status=eq.published&id=eq.${encodeURIComponent(id)}&limit=1`, { headers });
      const listings = listingRes.ok ? await listingRes.json() : [];
      const listing = listings?.[0];
      if (!listing) return shell;

      const imageRes = await fetch(`${SUPABASE_URL}/rest/v1/listing_images?select=storage_path,variants&listing_id=eq.${encodeURIComponent(id)}&order=sort_order.asc&limit=1`, { headers });
      const imageRows = imageRes.ok ? await imageRes.json() : [];
      const firstImage = imageRows?.[0]?.variants?.detail || imageRows?.[0]?.storage_path || '';
      const ogImage = imageUrl(firstImage);

      const condition = listing.condition === 'new' ? 'New' : 'Used';
      const location = [listing.city, listing.country_code].filter(Boolean).join(', ');
      const formattedPrice = money(listing.price_amount, listing.price_currency);
      const title = `${listing.title}${listing.storage ? ` ${listing.storage}` : ''} ${condition} — ${formattedPrice}${location ? ` in ${location}` : ''} | DigitalDeviceHub`;
      const description = `${condition} ${listing.title}${listing.storage ? ` ${listing.storage}` : ''} listed on DigitalDeviceHub${location ? ` in ${location}` : ''}. Seller asking price: ${formattedPrice}. View structured device details, seller context and delivery scope.`;
      const canonical = `${url.origin}/device?id=${encodeURIComponent(id)}`;

      const productSchema = clean({
        '@context':'https://schema.org',
        '@type':'Product',
        name:listing.title,
        description:listing.description || description,
        category:listing.category,
        brand:listing.brand ? {'@type':'Brand',name:listing.brand} : undefined,
        model:listing.model || undefined,
        image:ogImage ? [ogImage] : undefined,
        itemCondition:listing.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
        additionalProperty:Object.entries(listing.specs || {}).filter(([,v]) => v).map(([name,value]) => ({'@type':'PropertyValue',name,value:String(value)})),
        offers:{
          '@type':'Offer',
          price:String(listing.price_amount),
          priceCurrency:listing.price_currency,
          availability:'https://schema.org/InStock',
          url:canonical
        }
      });
      const breadcrumbSchema = {
        '@context':'https://schema.org',
        '@type':'BreadcrumbList',
        itemListElement:[
          {'@type':'ListItem',position:1,name:'Home',item:`${url.origin}/`},
          {'@type':'ListItem',position:2,name:listing.category,item:`${url.origin}/marketplace.html?category=${encodeURIComponent(listing.category)}`},
          {'@type':'ListItem',position:3,name:listing.title,item:canonical}
        ]
      };

      let html = await shell.text();
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
      html = html.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${esc(description)}">`);
      html = html.replace('</head>', `
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="product">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ''}
<script type="application/ld+json">${JSON.stringify(productSchema).replace(/</g,'\\u003c')}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbSchema).replace(/</g,'\\u003c')}</script>
</head>`);

      const response = new Response(html, shell);
      response.headers.set('Content-Type','text/html; charset=UTF-8');
      response.headers.set('Cache-Control','public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      return response;
    } catch {
      return shell;
    }
  }
};
