(() => {
  'use strict';

  // app.js intentionally used to suppress the homepage preview until the
  // marketplace contained at least 12 listings. That makes a healthy, small
  // marketplace look empty. Keep the existing rendering behavior, but show
  // every published listing that actually exists.
  if (typeof render !== 'function') return;

  render = function renderHomepageListings() {
    const q = search?.value.trim().toLowerCase() || '';
    const cond = condition?.value || 'all';
    if (!grid || !empty) return;

    const filtered = listings.filter(x =>
      (activeCategory === 'all' || x.category === activeCategory) &&
      (cond === 'all' || x.condition === cond) &&
      (!q || `${x.name} ${x.category} ${x.storage || ''} ${x.seller || ''}`.toLowerCase().includes(q))
    );

    grid.innerHTML = filtered.map(x => `
      <article class="listing-card" tabindex="0" data-id="${escapeHtml(x.id)}" aria-label="${escapeHtml(x.name)}, ${escapeHtml(money(x.price,x.currency))}">
        <div class="listing-art">${x.image_url ? `<img src="${escapeHtml(x.image_url)}" alt="${escapeHtml(x.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" />` : `<span aria-hidden="true">${escapeHtml(x.icon)}</span>`}</div>
        <div class="listing-body">
          <div class="listing-meta"><span>${escapeHtml(x.category)}</span><span>${escapeHtml(x.condition)}</span></div>
          <h3>${escapeHtml(x.name)}</h3>
          <div class="listing-meta"><span>${escapeHtml(x.storage || 'Details available')}</span></div>
          ${priceMarkup(x)}
          <div class="seller">${escapeHtml(x.seller || 'Seller')} ${x.verified ? '<span class="verified">✓ Verified</span>' : ''}</div>
        </div>
      </article>`).join('');

    if (!listings.length) {
      empty.innerHTML = '<strong>The worldwide marketplace is growing.</strong><br>We are onboarding the first wave of real sellers. Browse the full marketplace or list a device from your country.';
      empty.hidden = false;
    } else {
      empty.textContent = 'No published devices match this search yet. Try another search or browse the full marketplace.';
      empty.hidden = filtered.length !== 0;
    }

    window.DDH_LOCALIZATION?.refresh?.();
  };

  // Re-render immediately in case the listing request completed before this
  // deferred script executed. Future renders from app.js use this function too.
  render();
})();
