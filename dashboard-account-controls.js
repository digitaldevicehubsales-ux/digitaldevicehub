(() => {
  'use strict';

  const icons={
    overview:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h7V4H4v9Zm9 7h7v-9h-7v9ZM4 20h7v-5H4v5Zm9-11h7V4h-7v5Z"></path></svg>',
    listings:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M8 9h8M8 13h8M8 17h5"></path></svg>',
    analytics:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"></path></svg>',
    messages:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5Z"></path><path d="M8 9h8M8 12h5"></path></svg>',
    offers:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v10H4z"></path><path d="M8 12h8M12 9v6"></path></svg>',
    favorites:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20 4.8 13.2A4.7 4.7 0 0 1 11.4 6L12 6.7l.6-.7a4.7 4.7 0 0 1 6.6 7.2L12 20Z"></path></svg>',
    profile:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6"></path></svg>',
    signout:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"></path><path d="m15 8 4 4-4 4M19 12H9"></path></svg>'
  };

  function signOut(){
    const existing=document.querySelector('#signOutButton');
    if(existing){existing.click();return}
    try{localStorage.removeItem('ddh_supabase_session')}catch{}
    fetch('/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{}).finally(()=>location.assign('/'));
  }

  function decorateNavigation(){
    document.querySelectorAll('.dash-nav [data-view],.mobile-nav [data-view]').forEach(button=>{
      if(button.querySelector('svg'))return;
      const key=button.dataset.view;
      const icon=icons[key];
      if(!icon)return;
      const label=button.textContent.trim();
      button.innerHTML=`${icon}<span>${label}</span>`;
    });
  }

  function setup(){
    decorateNavigation();
    const header=document.querySelector('.dash-header');
    if(header&&!header.querySelector('.dash-signout')){
      const actions=document.createElement('div');
      actions.className='dash-header-actions';
      const list=header.querySelector('.primary-button[href="/sell.html"]');
      if(list)actions.appendChild(list);
      const button=document.createElement('button');
      button.type='button';button.className='secondary-button dash-signout';button.setAttribute('data-signout','');button.innerHTML=`${icons.signout}<span>Sign out</span>`;
      button.addEventListener('click',signOut);
      actions.appendChild(button);header.appendChild(actions);
    }

    const settings=document.querySelector('.settings-list');
    if(settings&&!settings.querySelector('.profile-signout')){
      const button=document.createElement('button');
      button.type='button';button.className='profile-signout';button.setAttribute('data-signout','');button.innerHTML=`<span>Sign out</span>${icons.signout}`;
      button.addEventListener('click',signOut);settings.appendChild(button);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();