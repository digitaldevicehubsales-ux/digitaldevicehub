const SUPABASE_URL = 'https://zfnqmduqxgvmgfbokjwl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Dq3vJAEg60BSnzfHxsx_Hg_AmHw0x4K';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function absoluteImage(path) {
  if (!path) return '';
  return `${SUPABASE_URL}/storage/v1/object/public/listing-images/${String(path).split('/').map(encodeURIComponent).join('/')}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/device')) return env.ASSETS.fetch(request);

    const id = url.searchParams.get('id');
    const assetUrl = new URL('/device.html', url.origin);
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !assetResponse.ok) return assetResponse;

    try {
      const headers = { apikey: SUPABASE_KEY };
      const listingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?select=id,title,category,brand,model,condition,storage,city,price_amount,price_currency,description&status=eq.published&id=eq.${encodeURIComponent(id)}&limit=1`,
        { headers }
      );
      const rows = listingRes.ok ? await listingRes.json() : [];
      const listing = rows?.[0];
      if (!listing) return assetResponse;

      const imageRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listing_images?select=storage_path&listing_id=eq.${encodeURIComponent(id)}&order=sort_order.asc&limit=1`,
        { headers }
      );
      const imageRows = imageRes.ok ? await imageRes.json() : [];
      const image = absoluteImage(imageRows?.[0]?.storage_path);

      const condition = listing.condition === 'new' ? 'New' : 'Used';
      const title = `${listing.title} — ${condition} device | DigitalDeviceHub`;
      const description = [`${condition} ${listing.title}`, listing.storage, listing.city ? `listed in ${listing.city}` : '', 'on DigitalDeviceHub.'].filter(Boolean).join(' · ');
      const canonical = `${url.origin}/device?id=${encodeURIComponent(id)}`;

      const schema = {
        '@context':'https://schema.org',
        '@type':'Product',
        name: listing.title,
        description: listing.description || description,
        category: listing.category,
        brand: listing.brand ? {'@type':'Brand',name:listing.brand} : undefined,
        model: listing.model || undefined,
        image: image ? [image] : undefined,
        itemCondition: listing.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
        offers: {
          '@type':'Offer',
          price: Number(listing.price_amount),
          priceCurrency: listing.price_currency,
          availability: 'https://schema.org/InStock',
          url: canonical
        }
      };
      const jsonLd = JSON.stringify(schema).replace(/</g,'\\u003c');

      let html = await assetResponse.text();
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
      html = html.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${esc(description)}">`);
      html = html.replace(/<link rel="canonical" href="[^"]*">/i, `<link rel="canonical" href="${esc(canonical)}">`);
      html = html.replace('</head>', `
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta property="og:type" content="product">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${image ? `<meta name="twitter:image" content="${esc(image)}">` : ''}
<script type="application/ld+json">${jsonLd}</script>
</head>`);

      const out = new Response(html, assetResponse);
      out.headers.set('Content-Type','text/html; charset=UTF-8');
      out.headers.set('Cache-Control','public, max-age=60, s-maxage=300');
      return out;
    } catch {
      return assetResponse;
    }
  }
};
