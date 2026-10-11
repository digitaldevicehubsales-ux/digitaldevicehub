/* DigitalDeviceHub homepage v3: live listings, inspection tag, converter, ladder, checklist.
   Reads the same public tables app.js reads, with the browser-safe publishable key from config.js. */
(() => {
  'use strict';
  const cfg = window.DDH_CONFIG || {};
  const base = String(cfg.supabaseUrl || '').replace(/\/$/, '');
  const key = String(cfg.supabasePublishableKey || '');
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base) && key.length > 20;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- helpers ---------- */
  const api = async path => {
    const res = await fetch(base + path, { headers: { apikey: key } });
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    return res.json();
  };
  const imgUrl = path => path ? `${base}/storage/v1/object/public/listing-images/${String(path).split('/').map(encodeURIComponent).join('/')}` : '';
  const tierLabel = t => ({ account: 'Email confirmed', phone: 'Phone verified', identity: 'ID verified', id: 'ID verified', business: 'Business verified' })[String(t || 'account').toLowerCase()] || 'Email confirmed';
  const countryName = code => {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; } catch { return code || ''; }
  };
  const money = (amount, currency) => {
    const v = Number(amount) || 0;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: v % 1 ? 2 : 0 }).format(v); }
    catch { return `${currency || ''} ${v.toLocaleString()}`.trim(); }
  };
  const loc = () => window.DDH_LOCALIZATION;
  const locReady = async () => {
    const L = loc();
    if (!L) return null;
    try { const r = typeof L.ready === 'function' ? L.ready() : L.ready; if (r && r.then) await r; } catch { /* estimates are optional */ }
    return L;
  };
  // Returns {text, code} for a local estimate, or null when no conversion applies.
  const estimate = (amount, currency) => {
    const L = loc();
    if (!L || !L.convertAmount) return null;
    try {
      const c = L.convertAmount(amount, currency);
      if (!c || !c.converted) return null;
      return { text: money(c.amount, c.currency), code: c.currency };
    } catch { return null; }
  };
  const devicePath = x => `/device/${encodeURIComponent(x.id)}/${encodeURIComponent(x.slug || '')}`;
  const gradeOf = r => r.specs?.condition_grade || r.specs?.cosmetic_condition || (r.condition === 'new' ? 'New (sealed)' : 'Used');
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

  /* ---------- header menu ---------- */
  const menuBtn = $('#menuBtn'), nav = $('#headNav');
  menuBtn?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });

  /* ---------- data ---------- */
  let listings = [];
  let activeCond = 'all';

  async function load() {
    if (!ready) throw new Error('backend not configured');
    const rows = await api('/rest/v1/listings?select=id,slug,title,category,condition,storage,city,country_code,price_amount,price_currency,seller_id,specs,identity_check_status,delivery_mode&status=eq.published&order=created_at.desc&limit=12');
    const sellerIds = [...new Set(rows.map(r => r.seller_id).filter(Boolean))];
    const ids = rows.map(r => r.id);
    const inList = a => encodeURIComponent(a.map(id => `"${id}"`).join(','));
    const [profiles, images] = await Promise.all([
      sellerIds.length ? api(`/rest/v1/public_profiles?select=id,display_name,verification_tier&id=in.(${inList(sellerIds)})`).catch(() => []) : [],
      ids.length ? api(`/rest/v1/listing_images?select=listing_id,storage_path,variants,sort_order&listing_id=in.(${inList(ids)})&order=sort_order.asc`).catch(() => []) : []
    ]);
    const sellers = new Map(profiles.map(p => [p.id, p]));
    const firstImg = new Map();
    for (const im of images) if (im.listing_id && !firstImg.has(im.listing_id)) firstImg.set(im.listing_id, im.variants?.card || im.storage_path);
    return rows.map(r => ({
      ...r,
      grade: gradeOf(r),
      seller: sellers.get(r.seller_id)?.display_name || 'Seller',
      badge: tierLabel(sellers.get(r.seller_id)?.verification_tier),
      image: imgUrl(firstImg.get(r.id))
    }));
  }

  /* ---------- hero tag ---------- */
  const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
  function renderTag(x) {
    const tag = $('#heroTag');
    tag.classList.remove('is-loading');
    tag.setAttribute('aria-busy', 'false');
    if (!x) {
      tag.classList.add('is-empty');
      $('#tagTitle').textContent = 'Be the first listing here';
      $('#tagSub').textContent = 'Every device that goes live gets a tag like this one, filled in from its listing.';
      $('#tagRows').innerHTML = '';
      $('#tagPrice').hidden = false;
      $('#tagPrice').innerHTML = '<div><div class="lbl">Ready when you are</div></div><a href="/sell">Start a listing</a>';
      return;
    }
    $('#tagCat').textContent = x.category || '';
    $('#tagTitle').innerHTML = `<a href="${devicePath(x)}">${esc(x.title)}</a>`;
    $('#tagSub').textContent = [x.storage && `${x.storage} storage`, x.specs?.ram && `${x.specs.ram} RAM`, x.specs?.network_status].filter(Boolean).join(', ');

    const imeiOk = x.identity_check_status === 'format_valid';
    const where = [x.city, countryName(x.country_code)].filter(Boolean).join(', ');
    const rows = [
      { k: 'Condition', v: x.grade, ok: !!x.grade && x.grade !== 'Used' },
      x.specs?.battery_health ? { k: 'Battery health', v: x.specs.battery_health, ok: true } : null,
      x.category === 'Phones' || x.category === 'Tablets' ? { k: 'IMEI screening', v: imeiOk ? 'Screened' : 'Not provided', ok: imeiOk } : null,
      { k: `Seller ${x.seller}`, v: x.badge, ok: true },
      where ? { k: 'Location', v: where, ok: true } : null
    ].filter(Boolean);

    $('#tagRows').innerHTML = rows.map((r, i) => `
      <li style="--i:${i}">
        <span class="tick ${r.ok ? 'pass' : 'none'}" aria-hidden="true">${r.ok ? TICK : '–'}</span>
        <span class="k">${esc(r.k)}</span><strong>${esc(r.v)}</strong>
        <span class="sr-only">${r.ok ? 'checked' : 'not checked'}</span>
      </li>`).join('');

    const est = estimate(x.price_amount, x.price_currency);
    const tp = $('#tagPrice');
    tp.hidden = false;
    tp.innerHTML = `<div><div class="lbl">Seller asks</div><div class="amt">${esc(money(x.price_amount, x.price_currency))}</div>${est ? `<div class="lbl">About ${esc(est.text)} where you are</div>` : ''}</div><a href="${devicePath(x)}">View listing</a>`;

    const allOk = rows.every(r => r.ok);
    const stamp = $('#tagStamp');
    stamp.hidden = !allOk;
    stamp.style.setProperty('--stamp-delay', reduceMotion ? '0s' : `${0.45 + rows.length * 0.35 + 0.2}s`);
  }

  /* ---------- grid ---------- */
  const invite = () => `<a class="card card-invite" href="/sell">
      <span class="plus" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span>
      <strong>Have a device to sell?</strong>
      <span class="muted">Early listings get seen first. Clear photos and accurate details help it sell.</span>
      <span class="go">Start a listing</span></a>`;

  function card(x) {
    const est = estimate(x.price_amount, x.price_currency);
    const meta = [x.storage, x.specs?.battery_health && `battery ${x.specs.battery_health}`, [x.city, countryName(x.country_code)].filter(Boolean).join(', ')].filter(Boolean).join(', ');
    return `<a class="card" href="${devicePath(x)}">
      <div class="card-media">${x.image ? `<img src="${esc(x.image)}" alt="${esc(x.title)}" loading="lazy" width="900" height="675">` : ''}<span class="grade">${esc(x.grade)}</span></div>
      <div class="card-body">
        <h3>${esc(x.title)}</h3>
        <p class="meta">${esc(meta)}</p>
        <div class="card-foot">
          <div><div class="price">${esc(money(x.price_amount, x.price_currency))}</div>${est ? `<div class="est">About ${esc(est.text)}</div>` : ''}</div>
          <span class="badge">${esc(x.badge)}</span>
        </div>
      </div></a>`;
  }

  function renderGrid() {
    const grid = $('#homeGrid');
    const shown = activeCond === 'all' ? listings : listings.filter(x => norm(x.grade) === norm(activeCond));
    let html = shown.map(card).join('');
    if (!shown.length) {
      const label = activeCond === 'all' ? 'the marketplace' : activeCond;
      html = `<div class="card card-empty"><h3>Nothing in ${esc(label)} yet</h3><p>Try another condition, or search the full marketplace.</p><a class="strong-link" href="/marketplace">Search the marketplace</a></div>`;
    }
    grid.innerHTML = html + invite();
  }

  $('#condFilters')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-cond]');
    if (!b) return;
    activeCond = b.dataset.cond;
    for (const x of e.currentTarget.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    renderGrid();
  });

  /* ---------- ladder ---------- */
  const LADDER = [
    ['Email confirmed', 'The seller entered a code sent to their email.'],
    ['Phone verified', 'The seller confirmed a one-time code sent to their phone.'],
    ['ID verified', 'The seller passed an identity review.'],
    ['Business verified', 'The business behind the seller passed a review.']
  ];
  function setStep(n) {
    document.querySelectorAll('#ladder button').forEach((b, i) => {
      b.classList.toggle('on', i <= n);
      b.setAttribute('aria-pressed', String(i === n));
    });
    $('#ladderName').textContent = LADDER[n][0];
    $('#ladderHow').textContent = LADDER[n][1];
  }
  $('#ladder')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-step]');
    if (b) setStep(Number(b.dataset.step));
  });
  setStep(0);

  /* ---------- handoff checklist ---------- */
  const hand = $('#handoff');
  hand?.addEventListener('change', () => {
    const n = hand.querySelectorAll('input:checked').length;
    $('#doneCount').textContent = n === 4 ? 'All four done. You’re ready to pay.' : `${n} of 4 done`;
  });

  /* ---------- converter ---------- */
  function updateFx() {
    const amt = parseFloat($('#fxAmount').value);
    const src = $('#fxSource').value;
    const out = $('#fxOut');
    if (!Number.isFinite(amt)) { out.textContent = '–'; return; }
    const est = estimate(amt, src);
    if (est) {
      out.textContent = est.text;
      $('#fxNote').textContent = 'Estimate from rates that refresh every 12 hours. Delivery and fees are not included; confirm them with the seller.';
    } else {
      out.textContent = money(amt, src);
      $('#fxNote').textContent = 'That is already your local currency, or a rate is not available yet. Delivery and fees are not included.';
    }
  }
  $('#fxAmount')?.addEventListener('input', updateFx);
  $('#fxSource')?.addEventListener('change', updateFx);
  $('#fxForm')?.addEventListener('submit', e => e.preventDefault());

  function applyLocale() {
    const L = loc();
    const cur = L?.state?.currency;
    const country = L?.state?.country;
    if (cur) {
      $('#fxTargetCode').textContent = cur;
      let curName = cur;
      try { curName = new Intl.DisplayNames(['en'], { type: 'currency' }).of(cur) || cur; } catch { /* keep code */ }
      $('#fxTargetName').textContent = curName;
      const chip = $('#regionChip');
      if (chip) chip.textContent = [countryName(country), cur].filter(Boolean).join(', ');
    }
    updateFx();
  }

  /* ---------- boot ---------- */
  (async () => {
    const localeP = locReady().then(applyLocale).catch(() => updateFx());
    try {
      listings = await load();
      await localeP; // so the first paint already has local estimates
      renderTag(listings[0]);
      renderGrid();
    } catch (err) {
      console.error('Could not load listings:', err);
      renderTag(null);
      $('#homeGrid').innerHTML = `<div class="card card-empty"><h3>Listings didn't load</h3><p>Check your connection and refresh, or open the marketplace directly.</p><a class="strong-link" href="/marketplace">Open the marketplace</a></div>` + invite();
    }
  })();
})();
