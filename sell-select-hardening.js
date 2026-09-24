(() => {
  'use strict';

  const currency = document.querySelector('#sellerCurrency');
  const country = document.querySelector('#countryCode');
  const FALLBACK_CURRENCIES=['AED','AUD','BRL','CAD','CHF','CNY','EUR','GBP','GHS','INR','JPY','KES','MXN','NGN','USD','ZAR'];

  function ensureCurrencies(){
    if(!currency || currency.options.length>1)return;
    let values=[];
    try{values=Intl.supportedValuesOf?.('currency')||[]}catch{}
    if(!values.length)values=FALLBACK_CURRENCIES;
    const selected=String(window.DDH_LOCALIZATION?.state?.currency||'').toUpperCase();
    const codes=[...new Set(values.filter(code=>/^[A-Z]{3}$/.test(String(code))))].sort();
    currency.innerHTML='<option value="">Choose currency</option>'+codes.map(code=>`<option value="${code}">${code}</option>`).join('');
    if(codes.includes(selected))currency.value=selected;
  }

  function ensureCountries(){
    if(!country || country.options.length>1)return;
    const selected=String(window.DDH_LOCALIZATION?.state?.country||'').toUpperCase();
    window.DDH_COUNTRIES?.populate?.(country,selected);
  }

  function ensureSelects(){ensureCurrencies();ensureCountries()}
  ensureSelects();
  document.addEventListener('ddh:localization-ready',ensureSelects);
})();
