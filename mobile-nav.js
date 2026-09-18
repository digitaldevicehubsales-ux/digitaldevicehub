(() => {
  'use strict';
  function setup(){
    const main=document.querySelector('main');
    if(main&&!main.id)main.id='main-content';
    if(main&&!document.querySelector('.skip-link')){const skip=document.createElement('a');skip.className='skip-link';skip.href='#'+main.id;skip.textContent='Skip to main content';document.body.prepend(skip)}
    const footer=document.querySelector('footer');
    if(footer&&!footer.querySelector('a[href="/about.html"]')){const box=document.createElement('div');box.className='footer-company-links';box.innerHTML='<a href="/about.html">About</a><a href="/contact.html">Contact</a>';footer.querySelector('.container,.shell,.footer-inner')?.append(box)}
    const header=document.querySelector('.global-header, .site-header');
    if(!header||header.querySelector('.mobile-menu-toggle'))return;
    const nav=header.querySelector('.global-nav, .desktop-nav');
    const actions=header.querySelector('.global-actions, .header-actions');
    const account=actions?.querySelector('a[href*="dashboard"], .account-access');
    if(account) account.classList.add('mobile-account-visible');

    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='mobile-menu-toggle';
    toggle.setAttribute('aria-label','Open navigation');
    toggle.setAttribute('aria-expanded','false');
    toggle.innerHTML='<span></span><span></span><span></span>';

    const panel=document.createElement('div');
    panel.className='mobile-menu-panel';
    panel.hidden=true;
    const links=[];
    nav?.querySelectorAll('a').forEach(a=>links.push({href:a.getAttribute('href'),label:a.textContent.trim()}));
    if(!links.some(x=>/sell/i.test(x.label))) links.push({href:'/sell.html',label:'Sell a device'});
    if(!links.some(x=>/account/i.test(x.label))) links.push({href:'/dashboard.html',label:'Account'});
    panel.innerHTML=links.filter((x,i,a)=>x.href&&a.findIndex(y=>y.href===x.href)===i).map(x=>`<a href="${x.href}">${x.label}</a>`).join('');
    header.append(toggle,panel);

    const close=()=>{toggle.setAttribute('aria-expanded','false');panel.hidden=true;toggle.setAttribute('aria-label','Open navigation');document.body.classList.remove('mobile-menu-open')};
    toggle.addEventListener('click',()=>{
      const open=toggle.getAttribute('aria-expanded')==='true';
      if(open) close(); else {toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','Close navigation');panel.hidden=false;document.body.classList.add('mobile-menu-open');panel.querySelector('a')?.focus()}
    });
    panel.addEventListener('click',e=>{if(e.target.closest('a'))close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    document.addEventListener('click',e=>{if(!panel.hidden&&!header.contains(e.target))close()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();