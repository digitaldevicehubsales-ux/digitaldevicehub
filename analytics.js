(() => {
  'use strict';
  const cfg=window.DDH_CONFIG||{};
  const supabaseUrl=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const supabaseKey=String(cfg.supabasePublishableKey||'');
  if(!supabaseUrl||!supabaseKey)return;
  const VISITOR_KEY='ddh_visitor_id';
  const impressed=new Set();
  function visitorId(){let value='';try{value=localStorage.getItem(VISITOR_KEY)||''}catch{}if(!/^[0-9a-f-]{36}$/i.test(value)){value=crypto.randomUUID();try{localStorage.setItem(VISITOR_KEY,value)}catch{}}return value}
  async function record(listingId,eventType){if(!/^[0-9a-f-]{36}$/i.test(String(listingId||'')))return;const country=String(window.DDH_LOCALIZATION?.state?.country||'').toUpperCase();const headers={apikey:supabaseKey,'Content-Type':'application/json',Prefer:'return=minimal'};try{await fetch(`${supabaseUrl}/rest/v1/listing_events`,{method:'POST',headers,body:JSON.stringify({listing_id:listingId,visitor_id:visitorId(),user_id:null,event_type:eventType,country_code:/^[A-Z]{2}$/.test(country)?country:null}),keepalive:true})}catch{}}
  function cards(){return document.querySelectorAll('#listingGrid .listing-card[data-id], #marketplaceGrid [data-listing-card][data-id]')}
  function captureImpressions(){cards().forEach(card=>{const id=card.dataset.id;if(id&&!impressed.has(id)){impressed.add(id);record(id,'impression')}})}
  document.addEventListener('click',event=>{const card=event.target.closest?.('#listingGrid .listing-card[data-id], #marketplaceGrid [data-listing-card][data-id]');if(card)record(card.dataset.id,'view')});
  document.addEventListener('keydown',event=>{const card=event.target.closest?.('#listingGrid .listing-card[data-id], #marketplaceGrid [data-listing-card][data-id]');if(card&&(event.key==='Enter'||event.key===' '))record(card.dataset.id,'view')});
  document.querySelectorAll('#listingGrid,#marketplaceGrid').forEach(grid=>new MutationObserver(captureImpressions).observe(grid,{childList:true}));
  captureImpressions();
})();