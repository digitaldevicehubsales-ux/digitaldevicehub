(() => {
  'use strict';
  const form=document.querySelector('#listingWizard');
  if(!form)return;
  const specs=window.DDH_DEVICE_SPECS;
  if(!specs)return;

  const category=form.elements.category;
  const brand=form.elements.brand;
  const model=form.elements.model;
  const storage=document.querySelector('#sellerStorage');
  const storageCustom=document.querySelector('#storageCustom');
  const color=document.querySelector('#sellerColor');
  const colorCustom=document.querySelector('#colorCustom');
  const ram=document.querySelector('#sellerRam');
  const battery=document.querySelector('#sellerBattery');
  const swap=form.elements.accepts_swap;
  const swapNotes=document.querySelector('.swap-notes');

  const fill=(select,values,placeholder,{other=false}={})=>{
    if(!select)return;
    const current=select.value;
    select.innerHTML='<option value="">'+placeholder+'</option>'+
      values.map(v=>'<option value="'+String(v).replace(/"/g,'&quot;')+'">'+v+'</option>').join('')+
      (other?'<option value="__other__">Other</option>':'');
    if([...select.options].some(o=>o.value===current))select.value=current;
  };

  function syncCustom(select,input){
    if(!select||!input)return;
    const custom=select.value==='__other__';
    input.hidden=!custom;
    input.required=custom;
    if(!custom)input.value='';
  }

  function sync(){
    const state={category:category?.value||'',brand:brand?.value||'',model:model?.value||''};

    const storageField=document.querySelector('.smart-storage');
    const ramField=document.querySelector('.ram-spec');
    const batteryField=document.querySelector('.battery-spec');
    const networkField=document.querySelector('.network-spec');
    const identityField=document.querySelector('.phone-identity');

    const storageValues=specs.storageOptions(state);
    if(storageField)storageField.hidden=!specs.supportsStorage(state.category);
    fill(storage,storageValues,storageValues.length?'Choose storage':'Not applicable',{other:true});

    fill(color,specs.colorOptions(state),'Choose colour',{other:true});

    const ramValues=specs.ramOptions(state);
    if(ramField)ramField.hidden=!specs.supportsRam(state.category);
    fill(ram,ramValues,'Choose RAM',{other:true});

    if(batteryField)batteryField.hidden=!specs.supportsBattery(state.category);
    fill(battery,specs.batteryOptions(),'Choose battery health');

    if(networkField)networkField.hidden=!specs.supportsNetwork(state.category);
    if(identityField)identityField.hidden=!specs.supportsPhoneIdentity(state.category);

    syncCustom(storage,storageCustom);
    syncCustom(color,colorCustom);
  }

  storage?.addEventListener('change',()=>syncCustom(storage,storageCustom));
  color?.addEventListener('change',()=>syncCustom(color,colorCustom));
  category?.addEventListener('change',sync);
  brand?.addEventListener('change',()=>setTimeout(sync,0));
  model?.addEventListener('change',()=>setTimeout(sync,0));

  swap?.addEventListener('change',()=>{
    if(!swapNotes)return;
    swapNotes.hidden=swap.value!=='true';
    const input=swapNotes.querySelector('input');
    if(input)input.required=swap.value==='true';
  });

  document.addEventListener('ddh:catalog-updated',sync);
  setTimeout(sync,0);
})();