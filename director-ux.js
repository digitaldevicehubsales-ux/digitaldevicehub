(() => {
  'use strict';

  if(!document.querySelector('link[href="/director-ux.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/director-ux.css';
    document.head.appendChild(link);
  }

  // Load the listing interaction layer with a versioned URL so existing service
  // workers/CDN caches cannot leave Director actions on an older implementation.
  if(!document.querySelector('script[data-director-listing-controls]')){
    const script=document.createElement('script');
    script.src='/director-listing-controls.js?v=20260925-2';
    script.dataset.directorListingControls='1';
    document.body.appendChild(script);
  }

  const title=document.querySelector('#directorPageTitle');
  const gate=document.querySelector('#directorGate');
  const nav=document.querySelector('.director-nav');
  const titles={overview:'Overview',decisions:'Decision Log',listings:'Listings',users:'Users',offers:'Offers',orders:'Orders',disputes:'Disputes',reports:'Reports',audit:'Audit Trail',system:'System'};

  function validView(view){
    return Boolean(view&&document.querySelector(`[data-panel="${CSS.escape(view)}"]`));
  }

  function activateView(view,{focus=true,updateHash=true}={}){
    if(!validView(view))return false;

    document.querySelectorAll('[data-panel]').forEach(panel=>{
      const active=panel.dataset.panel===view;
      panel.classList.toggle('active',active);
      panel.setAttribute('aria-hidden',active?'false':'true');
    });

    document.querySelectorAll('.director-nav [data-view]').forEach(control=>{
      const active=control.dataset.view===view;
      control.classList.toggle('active',active);
      if(active)control.setAttribute('aria-current','page');
      else control.removeAttribute('aria-current');
    });

    if(title){
      title.textContent=titles[view]||'Director Control Center';
      if(focus)requestAnimationFrame(()=>title.focus({preventScroll:true}));
    }

    if(updateHash){
      const hash=view==='overview'?'':`#${view}`;
      if(location.hash!==hash)history.replaceState(null,'',`${location.pathname}${location.search}${hash}`);
    }

    try{window.scrollTo({top:0,behavior:'smooth'})}catch{window.scrollTo(0,0)}
    return true;
  }

  // Capture navigation clicks before legacy per-element handlers. This makes
  // sidebar and in-panel navigation reliable even after dynamic rerenders.
  document.addEventListener('click',event=>{
    const control=event.target.closest?.('[data-view],[data-go]');
    if(!control)return;
    const view=control.dataset.view||control.dataset.go||'';
    if(!validView(view))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activateView(view,{focus:true,updateHash:true});
  },true);

  window.addEventListener('hashchange',()=>{
    const view=location.hash.replace(/^#/,'');
    if(validView(view))activateView(view,{focus:false,updateHash:false});
  });

  if(title&&!title.hasAttribute('tabindex'))title.setAttribute('tabindex','-1');
  const requested=location.hash.replace(/^#/,'');
  activateView(validView(requested)?requested:'overview',{focus:false,updateHash:false});

  if(gate){
    const gateTitle=gate.querySelector('h1');
    if(gateTitle&&!gateTitle.hasAttribute('tabindex'))gateTitle.setAttribute('tabindex','-1');
    const focusGate=()=>{
      if(!gate.hidden&&gateTitle)requestAnimationFrame(()=>gateTitle.focus({preventScroll:true}));
    };
    new MutationObserver(focusGate).observe(gate,{attributes:true,attributeFilter:['hidden']});
    focusGate();
  }

  if(nav){
    nav.addEventListener('keydown',event=>{
      const controls=[...nav.querySelectorAll('[data-view]')];
      const index=controls.indexOf(document.activeElement);
      if(index<0||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      event.preventDefault();
      let next=index;
      if(event.key==='ArrowDown')next=(index+1)%controls.length;
      if(event.key==='ArrowUp')next=(index-1+controls.length)%controls.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=controls.length-1;
      controls[next]?.focus();
    });
  }

  window.DDH_DIRECTOR_NAV={activateView};
})();
