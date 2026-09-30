(() => {
  'use strict';

  function loadPremiumUi(){
    if(document.querySelector('link[data-premium-ui]'))return;
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

  function setupPurpose(){
    if(location.pathname!=='/'&&location.pathname!=='/index.html')return;
    if(document.querySelector('.purpose-section'))return;
    const hero=document.querySelector('.hero');
    if(!hero)return;
    const section=document.createElement('section');
    section.className='purpose-section shell';
    section.setAttribute('aria-labelledby','purpose-title');
    section.innerHTML=`
      <div class="purpose-card">
        <div class="purpose-visual">
          <img src="/purpose-mark.svg" alt="Purpose compass" width="320" height="320" decoding="async">
        </div>
        <div class="purpose-copy">
          <span class="eyebrow">Built with purpose</span>
          <h2 id="purpose-title">Choose technology with confidence.</h2>
          <p>Clear facts. Better decisions.</p>
          <div class="purpose-points">
            <div class="purpose-point">Find the right device.</div>
            <div class="purpose-point">Understand every listing.</div>
            <div class="purpose-point">Buy with more clarity.</div>
          </div>
        </div>
      </div>`;
    hero.insertAdjacentElement('afterend',section);
  }

  function setupMobileDock(header){
    if(document.querySelector('.mobile-action-dock'))return;
    const dock=document.createElement('nav');
    dock.className='mobile-action-dock';
    dock.setAttribute('aria-label','Quick actions');
    dock.innerHTML='<a href="/marketplace.html">Browse</a><a class="primary" href="/sell.html">Sell</a><a href="/dashboard.html">Account</a>';
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
    const sync=()=>document.body.classList.toggle('filters-open',filters.classList.contains('open'));
    toggle.addEventListener('click',()=>setTimeout(sync,0));
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&filters.classList.contains('open')){
        filters.classList.remove('open');
        document.body.classList.remove('filters-open');
        toggle.setAttribute('aria-expanded','false');
        toggle.focus();
      }
    });
    document.addEventListener('click',e=>{
      if(!filters.classList.contains('open'))return;
      if(filters.contains(e.target)||toggle.contains(e.target))return;
      if(matchMedia('(max-width:1000px)').matches){
        filters.classList.remove('open');
        document.body.classList.remove('filters-open');
        toggle.setAttribute('aria-expanded','false');
      }
    });
  }

  function markCurrentPage(panel){
    const current=location.pathname.replace(/index\.html$/,'');
    panel.querySelectorAll('a').forEach(a=>{
      const path=new URL(a.href,location.origin).pathname.replace(/index\.html$/,'');
      if(path===current)a.setAttribute('aria-current','page');
    });
  }

  function setup(){
    loadPremiumUi();
    const main=document.querySelector('main');
    if(main&&!main.id)main.id='main-content';
    if(main&&!document.querySelector('.skip-link')){
      const skip=document.createElement('a');
      skip.className='skip-link';
      skip.href='#'+main.id;
      skip.textContent='Skip to content';
      document.body.prepend(skip);
    }
    const footer=document.querySelector('footer');
    if(footer&&!footer.querySelector('a[href="/about.html"]')){
      const box=document.createElement('div');
      box.className='footer-company-links';
      box.innerHTML='<a href="/about.html">About</a><a href="/contact.html">Contact</a>';
      footer.querySelector('.container,.shell,.footer-inner')?.append(box);
    }
    loadLocalePicker();
    setupPurpose();
    setupNetworkState();
    setupFilterSheet();

    const header=document.querySelector('.global-header, .site-header');
    if(!header)return;
    setupMobileDock(header);
    if(header.querySelector('.mobile-menu-toggle'))return;

    const nav=header.querySelector('.global-nav, .desktop-nav');
    const actions=header.querySelector('.global-actions, .header-actions');
    const account=actions?.querySelector('a[href*="dashboard"], .account-access');
    if(account)account.classList.add('mobile-account-visible');

    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='mobile-menu-toggle';
    toggle.setAttribute('aria-label','Open menu');
    toggle.setAttribute('aria-expanded','false');
    toggle.innerHTML='<span></span><span></span><span></span>';

    const panel=document.createElement('div');
    panel.className='mobile-menu-panel';
    panel.hidden=true;
    const links=[];
    nav?.querySelectorAll('a').forEach(a=>links.push({href:a.getAttribute('href'),label:a.textContent.trim()}));
    if(!links.some(x=>/sell/i.test(x.label)))links.push({href:'/sell.html',label:'Sell device'});
    if(!links.some(x=>/account/i.test(x.label)))links.push({href:'/dashboard.html',label:'Account'});
    panel.innerHTML=links.filter((x,i,a)=>x.href&&a.findIndex(y=>y.href===x.href)===i).map(x=>`<a href="${x.href}">${x.label}</a>`).join('');
    markCurrentPage(panel);
    header.append(toggle,panel);

    const close=()=>{
      toggle.setAttribute('aria-expanded','false');
      panel.hidden=true;
      toggle.setAttribute('aria-label','Open menu');
      document.body.classList.remove('mobile-menu-open');
    };
    toggle.addEventListener('click',()=>{
      const open=toggle.getAttribute('aria-expanded')==='true';
      if(open)close();
      else{
        toggle.setAttribute('aria-expanded','true');
        toggle.setAttribute('aria-label','Close menu');
        panel.hidden=false;
        document.body.classList.add('mobile-menu-open');
        panel.querySelector('a')?.focus();
      }
    });
    panel.addEventListener('click',e=>{if(e.target.closest('a'))close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    document.addEventListener('click',e=>{if(!panel.hidden&&!header.contains(e.target))close()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();