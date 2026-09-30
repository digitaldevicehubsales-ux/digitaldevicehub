(() => {
  'use strict';

  const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"></path><path d="m15 8 4 4-4 4M19 12H9"></path></svg>';

  function signOut(){
    const existing=document.querySelector('#signOutButton');
    if(existing){existing.click();return}
    try{localStorage.removeItem('ddh_supabase_session')}catch{}
    fetch('/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{}).finally(()=>location.assign('/'));
  }

  function setup(){
    const header=document.querySelector('.dash-header');
    if(header&&!header.querySelector('.dash-signout')){
      const actions=document.createElement('div');
      actions.className='dash-header-actions';
      const list=header.querySelector('.primary-button[href="/sell.html"]');
      if(list)actions.appendChild(list);
      const button=document.createElement('button');
      button.type='button';button.className='secondary-button dash-signout';button.setAttribute('data-signout','');button.innerHTML=`${icon}<span>Sign out</span>`;
      button.addEventListener('click',signOut);
      actions.appendChild(button);header.appendChild(actions);
    }

    const settings=document.querySelector('.settings-list');
    if(settings&&!settings.querySelector('.profile-signout')){
      const button=document.createElement('button');
      button.type='button';button.className='profile-signout';button.setAttribute('data-signout','');button.innerHTML=`<span>Sign out</span>${icon}`;
      button.addEventListener('click',signOut);settings.appendChild(button);
    }

    const nav=document.querySelector('.mobile-nav');
    if(nav&&!nav.querySelector('.mobile-signout')){
      const button=document.createElement('button');
      button.type='button';button.className='mobile-signout';button.setAttribute('data-signout','');button.setAttribute('aria-label','Sign out');button.innerHTML=`${icon}<span>Sign out</span>`;
      button.addEventListener('click',signOut);nav.appendChild(button);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();