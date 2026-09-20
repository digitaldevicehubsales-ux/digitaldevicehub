(() => {
  'use strict';

  function countryName(code){
    const value=String(code||'').toUpperCase();
    if(!value)return '';
    return window.DDH_COUNTRIES?.name?.(value)||value;
  }

  function labelFor(detail={}){
    const parts=[countryName(detail.country),String(detail.currency||'').toUpperCase()].filter(Boolean);
    return parts.join(' · ')||'Region & currency';
  }

  function apply(detail){
    const label=labelFor(detail);
    document.querySelectorAll('.locale-chip').forEach(chip=>{chip.textContent=label});
  }

  document.addEventListener('ddh:localization-ready',event=>queueMicrotask(()=>apply(event.detail||{})));
  window.DDH_LOCALIZATION?.ready?.then(apply).catch(()=>apply({}));
})();
