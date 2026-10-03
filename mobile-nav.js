(() => {
  'use strict';

  const icons={
    browse:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>',
    sell:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
    account:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6"></path></svg>',
    menu:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>',
    close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>',
    market:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16l-1 11H5L4 9Z"></path><path d="M8 9a4 4 0 0 1 8 0"></path></svg>',
    trust:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.7-2.8 8-7 10-4.2-2-7-5.3-7-10V6l7-3Z"></path><path d="m9 12 2 2 4-4"></path></svg>',
    help:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9.7 9a2.5 2.5 0 0 1 4.8 1c0 1.7-1.3 2.2-2.2 2.8-.6.4-.8.8-.8 1.7M12 18h.01"></path></svg>',
    info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7h.01"></path></svg>',
    filter:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"></path></svg>',
    logout:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5"></path><path d="M14 8l4 4-4 4M9 12h9"></path></svg>'
  };

  function iconFor(label=''){
    const x=label.toLowerCase();
    if(x.includes('market'))return icons.market;
    if(x.includes('trust'))return icons.trust;
    if(x.includes('help'))return icons.help;
    if(x.includes('about'))return icons.info;
    if(x.includes('sell'))return icons.sell;
    if(x.includes('account'))return icons.account;
    if(x.includes('sign out'))return icons.logout;
    return icons.browse;
  }

  function loadPremiumUi(){
    if(document.querySelector('link[data-premium-ui],link[href="/premium-ui.css"]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/premium-ui.css';
    link.dataset.premiumUi='true';
    document.head.appendChild(link);
  }

  function loadLocalePicker(){
    if(!document.querySelector('.locale-chip')||document.querySelector('script[data-locale-picker]'))return;
    const script=document.createElement('script');
    script.src='/locale-picker.js';
    script.defer=true;
    script.dataset.localePicker='true';
    document.head.appendChild(script);
  }

  function setupMobileDock(){
    if(document.querySelector('.mobile-action-dock'))return;
    const dock=document.createElement('nav');
    dock.className='mobile-action-dock';
    dock.setAttribute('aria-label','Quick actions');
    dock.innerHTML=`<a href="/marketplace">${icons.browse}<span>Browse</span></a><a class="primary" href="/sell">${icons.sell}<span>Sell</span></a><a href="/dashboard">${icons.account}<span>Account</span></a>`;
    document.body.appendChild(dock);
  }

  function setupNetworkState(){
    let banner=null;
    const render=()=>{
      if(navigator.onLine){banner?.remove();banner=null;return}
      if(banner)return;
      banner=document.createElement('div');
      banner.className='network-banner';
      banner.setAttribute('role','status');
      banner.textContent='Connection lost. Try again.';
      document.body.appendChild(banner);
    };
    addEventListener('online',render);
    addEventListener('offline',render);
    render();
  }

  function setupFilterSheet(){
    const filters=document.querySelector('#filters');
    const toggle=document.querySelector('#filterToggle');
    if(!filters||!toggle)return;
    if(!toggle.querySelector('svg'))toggle.innerHTML=`${icons.filter}<span>Filters</span>`;
    const sync=()=>document.body.classList.toggle('filters-open',filters.classList.contains('open'));
    toggle.addEventListener('click',()=>setTimeout(sync,0));
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&filters.classList.contains('open')){
        filters.classList.remove('open');document.body.classList.remove('filters-open');toggle.setAttribute('aria-expanded','false');toggle.focus();
      }
    });
    document.addEventListener('click',e=>{
      if(!filters.classList.contains('open'))return;
      if(filters.contains(e.target)||toggle.contains(e.target))return;
      if(matchMedia('(max-width:1000px)').matches){filters.classList.remove('open');document.body.classList.remove('filters-open');toggle.setAttribute('aria-expanded','false')}
    });
  }

  function markCurrentPage(panel){
    const current=location.pathname.replace(/index\.html$/,'');
    panel.querySelectorAll('a').forEach(a=>{
      const path=new URL(a.href,location.origin).pathname.replace(/index\.html$/,'');
      if(path===current)a.setAttribute('aria-current','page');
    });
  }

  function storedSession(){
    try{return JSON.parse(localStorage.getItem('ddh_supabase_session')||'null')}catch{return null}
  }

  function isSignedIn(){
    return Boolean(storedSession()?.user?.id);
  }

  async function publicSignOut(){
    try{
      await fetch('/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
    }catch{}
    try{localStorage.removeItem('ddh_supabase_session')}catch{}
    location.assign('/');
  }

  function isPublicPage(){
    return !/^\/(dashboard|admin|director)(?:\.html|\/|$)/.test(location.pathname);
  }

  function standardizePublicShell(){
    if(!isPublicPage())return;
    const signed=isSignedIn();
    const current=location.pathname+location.search;
    const header=document.querySelector('.global-header, .site-header');
    if(header){
      header.className='global-header';
      header.innerHTML=`
        <a class="global-brand" href="/" aria-label="DigitalDeviceHub home"><span class="global-brand-mark" aria-hidden="true">D</span><span>DigitalDeviceHub</span></a>
        <nav class="global-nav" aria-label="Primary navigation">
          <a href="/marketplace">Marketplace</a>
          <a href="/trust">Trust</a>
          <a href="/help">Help</a>
          <a href="/about">About</a>
        </nav>
        <div class="global-actions">
          <span class="locale-chip" id="localeChip">Region & currency</span>
          <a class="btn secondary small account-access" href="${signed?'/dashboard':'/?signin=1&returnTo='+encodeURIComponent(current)}">${signed?'Account':'Sign in'}</a>
          <a class="btn small" href="/sell">Sell device</a>
        </div>`;
      markCurrentPage(header);
    }

    const footer=document.querySelector('footer');
    if(footer){
      footer.className='footer-v2';
      footer.innerHTML=`<div class="container footer-grid">
        <div><a class="global-brand" href="/" aria-label="DigitalDeviceHub home"><span class="global-brand-mark" aria-hidden="true">D</span><span>DigitalDeviceHub</span></a><p>Devices with clearer checks.</p></div>
        <div><h4>Marketplace</h4><a href="/marketplace">Browse devices</a><a href="/sell">Sell device</a><a href="/seller-onboarding">Seller onboarding</a><a href="/compare">Compare</a></div>
        <div><h4>Support</h4><a href="/trust">Trust & Safety</a><a href="/help">Help Center</a><a href="/contact">Contact</a></div>
        <div><h4>Company</h4><a href="/about">About</a><a href="/regions">Regions & features</a></div>
        <div><h4>Legal</h4><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
      </div>`;
    }
  }

  function setup(){
    loadPremiumUi();
    standardizePublicShell();
    const main=document.querySelector('main');
    if(main&&!main.id)main.id='main-content';
    if(main&&!document.querySelector('.skip-link')){
      const skip=document.createElement('a');skip.className='skip-link';skip.href='#'+main.id;skip.textContent='Skip to content';document.body.prepend(skip);
    }
    const footer=document.querySelector('footer');
    if(footer&&!footer.querySelector('a[href="/about"]')){
      const box=document.createElement('div');box.className='footer-company-links';box.innerHTML='<a href="/about">About</a><a href="/contact">Contact</a>';footer.querySelector('.container,.shell,.footer-inner')?.append(box);
    }
    loadLocalePicker();
    setupNetworkState();
    setupFilterSheet();

    const header=document.querySelector('.global-header, .site-header');
    if(!header)return;
    setupMobileDock();
    if(header.querySelector('.mobile-menu-toggle'))return;

    const nav=header.querySelector('.global-nav, .desktop-nav');
    const actions=header.querySelector('.global-actions, .header-actions');
    const account=actions?.querySelector('a[href*="dashboard"], .account-access');
    if(account)account.classList.add('mobile-account-visible');
    if(isSignedIn()&&actions&&!actions.querySelector('[data-public-signout]')){
      const signout=document.createElement('button');
      signout.type='button';
      signout.className='btn secondary small public-signout';
      signout.dataset.publicSignout='1';
      signout.innerHTML=`${icons.logout}<span>Sign out</span>`;
      signout.addEventListener('click',publicSignOut);
      actions.appendChild(signout);
    }

    const toggle=document.createElement('button');
    toggle.type='button';toggle.className='mobile-menu-toggle';toggle.setAttribute('aria-label','Open menu');toggle.setAttribute('aria-expanded','false');toggle.innerHTML=icons.menu;

    const panel=document.createElement('div');panel.className='mobile-menu-panel';panel.hidden=true;
    const links=[];nav?.querySelectorAll('a').forEach(a=>links.push({href:a.getAttribute('href'),label:a.textContent.trim()}));
    if(!links.some(x=>/sell/i.test(x.label)))links.push({href:'/sell',label:'Sell device'});
    if(!links.some(x=>/account/i.test(x.label)))links.push({href:'/dashboard',label:'Account'});
    panel.innerHTML=links.filter((x,i,a)=>x.href&&a.findIndex(y=>y.href===x.href)===i).map(x=>`<a href="${x.href}">${iconFor(x.label)}<span>${x.label}</span></a>`).join('')+(isSignedIn()?`<button type="button" class="mobile-menu-signout" data-public-signout>${icons.logout}<span>Sign out</span></button>`:'');
    panel.querySelector('[data-public-signout]')?.addEventListener('click',publicSignOut);
    markCurrentPage(panel);header.append(toggle,panel);

    const close=()=>{toggle.setAttribute('aria-expanded','false');panel.hidden=true;toggle.setAttribute('aria-label','Open menu');toggle.innerHTML=icons.menu;document.body.classList.remove('mobile-menu-open')};
    toggle.addEventListener('click',()=>{
      const open=toggle.getAttribute('aria-expanded')==='true';
      if(open)close();else{toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','Close menu');toggle.innerHTML=icons.close;panel.hidden=false;document.body.classList.add('mobile-menu-open');panel.querySelector('a')?.focus()}
    });
    panel.addEventListener('click',e=>{if(e.target.closest('a'))close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    document.addEventListener('click',e=>{if(!panel.hidden&&!header.contains(e.target))close()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();