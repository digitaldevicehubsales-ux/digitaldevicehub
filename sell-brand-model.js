(() => {
  'use strict';

  const form=document.querySelector('#listingWizard');
  if(!form)return;

  const brand=form.elements.brand;
  const model=form.elements.model;
  const brandCustom=document.querySelector('#brandCustom');
  const modelCustom=document.querySelector('#modelCustom');
  if(!brand||!model)return;

  const catalog=window.DDH_DEVICE_CATALOG;
  const brands=()=>catalog?.brands?.()||[];
  const modelsFor=brandName=>catalog?.models?.(brandName)||[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function selectedIsCustom(select){return select.selectedOptions?.[0]?.dataset?.customOption==='1'}

  function addCustomOption(select,label){
    const option=document.createElement('option');
    option.value='__custom__';
    option.textContent=label;
    option.dataset.customOption='1';
    select.appendChild(option);
    return option;
  }

  function populateBrands(preferred=''){
    const all=brands();
    brand.innerHTML='<option value="">Choose brand</option>'+all.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
    const custom=addCustomOption(brand,'Other / brand not listed');
    if(preferred){
      const exact=[...brand.options].find(o=>o.value===preferred);
      if(exact)brand.value=preferred;
      else{
        custom.value=preferred;
        custom.textContent=`Other: ${preferred}`;
        brand.value=preferred;
        if(brandCustom){brandCustom.hidden=false;brandCustom.required=true;brandCustom.value=preferred}
      }
    }
  }

  function populateModels(brandName,preferred=''){
    if(!brandName){
      model.innerHTML='<option value="">Select a brand first</option>';
      model.disabled=true;
      if(modelCustom){modelCustom.hidden=true;modelCustom.required=false;modelCustom.value=''}
      return;
    }
    const brandIsCustom=selectedIsCustom(brand);
    const models=brandIsCustom?[]:modelsFor(brandName);
    model.disabled=false;
    model.innerHTML='<option value="">Choose model</option>'+models.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
    const custom=addCustomOption(model,'Other / model not listed');
    if(preferred){
      const exact=[...model.options].find(o=>o.value===preferred);
      if(exact)model.value=preferred;
      else{
        custom.value=preferred;
        custom.textContent=`Other: ${preferred}`;
        model.value=preferred;
        if(modelCustom){modelCustom.hidden=false;modelCustom.required=true;modelCustom.value=preferred}
      }
    }else if(brandIsCustom){
      model.selectedIndex=model.options.length-1;
      if(modelCustom){modelCustom.hidden=false;modelCustom.required=true}
    }
  }

  function syncBrandCustom(){
    const custom=selectedIsCustom(brand);
    if(brandCustom){
      brandCustom.hidden=!custom;
      brandCustom.required=custom;
      if(!custom)brandCustom.value='';
      else if(!brandCustom.value)brandCustom.focus();
    }
    populateModels(brand.value);
  }

  function syncModelCustom(){
    const custom=selectedIsCustom(model);
    if(modelCustom){
      modelCustom.hidden=!custom;
      modelCustom.required=custom;
      if(!custom)modelCustom.value='';
      else if(!modelCustom.value)modelCustom.focus();
    }
  }

  function updateCustomOption(select,input,prefix){
    const option=select.selectedOptions?.[0];
    if(!option||option.dataset.customOption!=='1')return;
    const value=String(input?.value||'').trim();
    option.value=value||'__custom__';
    option.textContent=value?`${prefix}: ${value}`:prefix;
  }

  brand.addEventListener('change',syncBrandCustom);
  model.addEventListener('change',syncModelCustom);
  brandCustom?.addEventListener('input',()=>{
    updateCustomOption(brand,brandCustom,'Other brand');
    populateModels(brand.value);
  });
  modelCustom?.addEventListener('input',()=>updateCustomOption(model,modelCustom,'Other model'));

  form.addEventListener('submit',event=>{
    if(selectedIsCustom(brand)){
      updateCustomOption(brand,brandCustom,'Other brand');
      if(!String(brandCustom?.value||'').trim()){
        event.preventDefault();brandCustom?.reportValidity();return;
      }
    }
    if(selectedIsCustom(model)){
      updateCustomOption(model,modelCustom,'Other model');
      if(!String(modelCustom?.value||'').trim()){
        event.preventDefault();modelCustom?.reportValidity();
      }
    }
  },true);

  let saved=null;
  try{saved=JSON.parse(localStorage.getItem('ddh_sell_draft_v2')||'null')}catch{}
  populateBrands(saved?.brand||'');
  populateModels(brand.value,saved?.model||'');
  syncModelCustom();

  window.DDH_SELL_DEVICE_SELECTS={
    applyValues(brandValue,modelValue){
      populateBrands(String(brandValue||''));
      populateModels(brand.value,String(modelValue||''));
      syncModelCustom();
    }
  };
})();
