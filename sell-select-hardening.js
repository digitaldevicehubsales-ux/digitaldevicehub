(() => {
  'use strict';

  const currency = document.querySelector('#sellerCurrency');
  const country = document.querySelector('#countryCode');
  const submit = document.querySelector('#submitListing');
  const next = document.querySelector('#nextStep');
  const steps = [...document.querySelectorAll('.wizard-step')];
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

  function enforceWizardActions(){
    if(!steps.length)return;
    const activeIndex=steps.findIndex(step=>step.classList.contains('active'));
    const isFinal=activeIndex===steps.length-1;

    if(submit){
      submit.hidden=!isFinal;
      submit.style.display=isFinal?'':'none';
      submit.setAttribute('aria-hidden',isFinal?'false':'true');
      submit.tabIndex=isFinal?0:-1;
    }

    if(next){
      next.hidden=isFinal;
      next.style.display=isFinal?'none':'';
      next.setAttribute('aria-hidden',isFinal?'true':'false');
      next.tabIndex=isFinal?-1:0;
    }
  }

  function ensureSelects(){ensureCurrencies();ensureCountries()}
  ensureSelects();
  enforceWizardActions();

  document.addEventListener('ddh:localization-ready',ensureSelects);

  if(steps.length){
    const observer=new MutationObserver(enforceWizardActions);
    steps.forEach(step=>observer.observe(step,{attributes:true,attributeFilter:['class']}));
  }

  document.querySelector('#backStep')?.addEventListener('click',()=>queueMicrotask(enforceWizardActions));
  next?.addEventListener('click',()=>queueMicrotask(enforceWizardActions));
})();
