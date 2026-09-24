(() => {
  'use strict';

  const meta = document.querySelector('#deviceMeta');
  if (!meta) return;

  const actionButtons = [
    document.querySelector('#makeOffer'),
    document.querySelector('#messageSeller'),
    document.querySelector('#saveDevice'),
    document.querySelector('#shareDevice'),
    document.querySelector('#reportDevice')
  ].filter(Boolean);
  const actionAreas = [
    document.querySelector('.device-actions'),
    document.querySelector('.transaction-scope-note'),
    document.querySelector('#sellerPanel'),
    document.querySelector('.device-secondary-actions')
  ].filter(Boolean);
  const detailAreas = [
    document.querySelector('#galleryMain'),
    document.querySelector('#galleryThumbs'),
    document.querySelector('#deviceDescription')?.closest('.detail-section'),
    document.querySelector('#deviceSpecs')?.closest('.detail-section'),
    document.querySelector('#relatedSection')
  ].filter(Boolean);

  const setButtonsDisabled = disabled => {
    for (const button of actionButtons) {
      if ('disabled' in button) button.disabled = disabled;
      button.setAttribute('aria-disabled', String(disabled));
    }
  };

  const state = () => {
    const heading = meta.querySelector('h1')?.textContent?.trim() || '';
    const eyebrow = meta.querySelector('.eyebrow')?.textContent?.trim() || '';
    const text = `${eyebrow} ${heading}`.toLowerCase();
    if (/not found|unavailable|no longer available|request failed/.test(text)) return 'unavailable';
    if (!heading || /please wait|loading device/.test(text)) return 'loading';
    return 'ready';
  };

  const apply = () => {
    const current = state();
    const unavailable = current === 'unavailable';
    setButtonsDisabled(current !== 'ready');
    for (const area of actionAreas) area.hidden = unavailable;
    for (const area of detailAreas) area.hidden = unavailable;

    if (unavailable && !meta.querySelector('[data-unavailable-actions]')) {
      const actions = document.createElement('p');
      actions.dataset.unavailableActions = 'true';
      actions.innerHTML = '<a class="btn blue" href="/marketplace.html">Browse marketplace</a>';
      meta.appendChild(actions);
    }
  };

  setButtonsDisabled(true);
  new MutationObserver(apply).observe(meta, { childList: true, subtree: true, characterData: true });
  apply();
})();
