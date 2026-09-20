(() => {
  'use strict';
  const LOCALIZATION_KEY='ddh_localization_v2';
  const FX_KEY='ddh_fx_target_v2';
  const chips=[...document.querySelectorAll('.locale-chip')];
  if(!chips.length)return;

  const currencyName=code=>{try{return new Intl.DisplayNames([navigator.language||'en'],{type:'currency'}).of(code)||code}catch{return code}};
  const currencies=()=>{try{return Intl.supportedValuesOf('currency')}catch{return ['USD','EUR','GBP','CAD','AUD','JPY','CNY','INR','AED','BRL','MXN','ZAR','GHS','KES','NGN']}};
  const countries=()=>window.DDH_COUNTRIES?.sorted?.()||[];
  const state=()=>window.DDH_LOCALIZATION?.state||{country:'',currency:''};

  function save(country,currency){
    const selectedCountry=String(country||'').toUpperCase();
    const selectedCurrency=String(currency||'').toUpperCase();
    if(!/^[A-Z]{2}$/.test(selectedCountry)||!/^[A-Z]{3}$/.test(selectedCurrency))return;
    const payload={country:selectedCountry,currency:selectedCurrency,detectedAt:Date.now(),manual:true};
    try{localStorage.setItem(LOCALIZATION_KEY,JSON.stringify(payload));localStorage.removeItem(FX_KEY)}catch{}
    const maxAge=60*60*24*365;
    document.cookie=`ddh_country=${encodeURIComponent(payload.country)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;
    document.cookie=`ddh_currency=${encodeURIComponent(payload.currency)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;
    location.reload();
  }
  function automatic(){
    try{localStorage.removeItem(LOCALIZATION_KEY);localStorage.removeItem(FX_KEY)}catch{}
    document.cookie='ddh_country=; Path=/; Max-Age=0; Secure; SameSite=Lax';
    document.cookie='ddh_currency=; Path=/; Max-Age=0; Secure; SameSite=Lax';
    location.reload();
  }
  function open(){
    const current=state();
    const dialog=document.createElement('dialog');
    dialog.setAttribute('aria-labelledby','localePickerTitle');
    dialog.style.cssText='border:0;border-radius:22px;padding:0;width:min(520px,calc(100% - 28px));box-shadow:0 30px 90px rgba(0,0,0,.28);background:#fff';
    const countryOptions='<option value="">Choose country / region</option>'+countries().map(x=>`<option value="${x.code}"${x.code===current.country?' selected':''}>${x.name}</option>`).join('');
    const currencyOptions='<option value="">Choose display currency</option>'+[...new Set(currencies())].sort().map(code=>`<option value="${code}"${code===current.currency?' selected':''}>${code} — ${currencyName(code)}</option>`).join('');
    dialog.innerHTML=`<form method="dialog" style="padding:26px"><button value="cancel" aria-label="Close" style="float:right;border:0;background:#eef0f3;border-radius:50%;width:36px;height:36px;font-size:20px;cursor:pointer">×</button><span style="color:#315efb;font-size:12px;font-weight:850;text-transform:uppercase;letter-spacing:.16em">Worldwide marketplace</span><h2 id="localePickerTitle" style="font-size:30px;letter-spacing:-.04em;margin:10px 0 8px">Your region and currency</h2><p style="color:#6e7480;line-height:1.55;margin:0 0 22px">DigitalDeviceHub detects these automatically when possible. You can override them at any time. Seller prices never change; converted prices are estimates for display.</p><label style="display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:780;margin-bottom:14px">Country / region<select id="localeCountry" required style="width:100%;height:46px;border:1px solid #e4e6ea;border-radius:12px;background:#fff;padding:0 13px">${countryOptions}</select></label><label style="display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:780">Display currency<select id="localeCurrency" required style="width:100%;height:46px;border:1px solid #e4e6ea;border-radius:12px;background:#fff;padding:0 13px">${currencyOptions}</select></label><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:22px"><button id="saveLocale" value="cancel" style="border:0;border-radius:12px;padding:12px 17px;background:#0c0f14;color:#fff;font-weight:780;cursor:pointer">Save preferences</button><button id="autoLocale" value="cancel" style="border:1px solid #e4e6ea;border-radius:12px;padding:12px 17px;background:#fff;color:#0c0f14;font-weight:780;cursor:pointer">Use automatic detection</button></div></form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('close',()=>dialog.remove());
    dialog.querySelector('#saveLocale').addEventListener('click',e=>{e.preventDefault();const country=dialog.querySelector('#localeCountry');const currency=dialog.querySelector('#localeCurrency');if(!country.reportValidity()||!currency.reportValidity())return;save(country.value,currency.value)});
    dialog.querySelector('#autoLocale').addEventListener('click',e=>{e.preventDefault();automatic()});
    dialog.showModal();
  }

  chips.forEach(chip=>{
    chip.setAttribute('role','button');chip.setAttribute('tabindex','0');chip.setAttribute('aria-label','Change country and display currency');chip.title='Change country and display currency';chip.style.cursor='pointer';
    chip.addEventListener('click',open);
    chip.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
  });
})();
