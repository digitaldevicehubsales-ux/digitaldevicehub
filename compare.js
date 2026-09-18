(() => {
  'use strict';
  const cfg=window.DDH_CONFIG||{},base=String(cfg.supabaseUrl||'').replace(/\/$/,''),key=String(cfg.supabasePublishableKey||'');
  const table=document.querySelector('#compareTable'),status=document.querySelector('#compareStatus'),empty=document.querySelector('#compareEmpty');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const country=code=>window.DDH_COUNTRIES?.name?.(code)||code||'';
  const money=(a,c)=>{const n=Number(a)||0;try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c||'USD',minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:Number.isInteger(n)?0:2}).format(n)}catch{return `${c||'USD'} ${n.toLocaleString()}`}};
  const ids=String(new URLSearchParams(location.search).get('ids')||'').split(',').filter(x=>/^[0-9a-f-]{36}$/i.test(x)).slice(0,4);
  async function get(path){const r=await fetch(`${base}${path}`,{headers:{apikey:key}});if(!r.ok)throw new Error('Comparison could not be loaded.');return r.json()}
  const delivery=v=>({pickup:'Local pickup only',domestic:'Domestic shipping',international:'International shipping',pickup_domestic:'Pickup + domestic shipping',all:'Pickup + domestic + international shipping'})[v]||v||'Not specified';
  function cell(v){return `<td>${v===null||v===undefined||v===''?'<span class="muted">Not specified</span>':v}</td>`}
  function render(rows){
    if(rows.length<2){status.hidden=true;empty.hidden=false;table.innerHTML='';return}
    const ordered=ids.map(id=>rows.find(r=>r.id===id)).filter(Boolean);
    const head=`<thead><tr><th>Compare</th>${ordered.map(x=>`<th><a href="/device.html?id=${encodeURIComponent(x.id)}">${esc(x.title)}</a><small>${esc(x.condition==='new'?'New':'Used')} · ${esc([x.city,country(x.country_code)].filter(Boolean).join(', '))}</small></th>`).join('')}</tr></thead>`;
    const row=(label,fn)=>`<tr><th scope="row">${esc(label)}</th>${ordered.map(x=>cell(fn(x))).join('')}</tr>`;
    const body=[
      row('Seller asking price',x=>`<strong>${esc(money(x.price_amount,x.price_currency))}</strong>`),
      row('Local estimate',x=>`<span class="price local-estimate" data-price-amount="${esc(x.price_amount)}" data-price-currency="${esc(x.price_currency)}">${esc(money(x.price_amount,x.price_currency))}</span>`),
      row('Storage',x=>esc(x.storage||'')),
      row('Colour',x=>esc(x.color||'')),
      row('Battery health',x=>esc(x.specs?.battery_health||'')),
      row('Network status',x=>esc(x.specs?.network_status||'')),
      row('Repair history',x=>esc(x.specs?.repair_history||'')),
      row('Included accessories',x=>esc(x.specs?.accessories||'')),
      row('Warranty',x=>esc(x.warranty_text||'')),
      row('Delivery',x=>esc(delivery(x.delivery_mode))),
      row('Location',x=>esc([x.city,country(x.country_code)].filter(Boolean).join(', '))),
      row('Action',x=>`<a class="btn secondary small" href="/device.html?id=${encodeURIComponent(x.id)}">View device</a>`)
    ].join('');
    table.innerHTML=`<table class="compare-table">${head}<tbody>${body}</tbody></table>`;
    status.textContent=`Comparing ${ordered.length} devices`;
    window.DDH_LOCALIZATION?.refresh?.();
  }
  async function load(){
    if(ids.length<2)return render([]);
    try{
      await window.DDH_LOCALIZATION?.ready;
      const list=ids.map(x=>`"${x}"`).join(',');
      const rows=await get(`/rest/v1/listings?select=id,title,condition,storage,color,city,country_code,price_amount,price_currency,warranty_text,delivery_mode,specs&id=in.(${encodeURIComponent(list)})&status=eq.published`);
      render(rows||[]);
    }catch(err){status.textContent=err.message;empty.hidden=false}
  }
  document.addEventListener('ddh:localization-ready',e=>{document.querySelector('#localeChip').textContent=`${country(e.detail.country)} · ${e.detail.currency}`});
  load();
})();