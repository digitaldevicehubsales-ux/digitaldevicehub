(() => {
  'use strict';

  const cfg = window.DDH_CONFIG || {};
  const base = String(cfg.supabaseUrl || '').replace(/\/$/, '');
  const key = String(cfg.supabasePublishableKey || '');
  const SESSION_KEY = 'ddh_supabase_session';
  const RETURN_KEY = 'ddh_post_auth_return_to';
  const INTENT_KEY = 'ddh_auth_intent';
  const ALLOWED_RETURNS = new Set(['/director.html', '/admin.html', '/dashboard.html']);

  let routing = false;
  let watcher = null;
  let initialToken = '';

  function normalizePath(value){
    const raw = String(value || '').trim();
    if(!raw || raw.startsWith('//') || !raw.startsWith('/')) return '';
    const path = raw.split('?')[0].split('#')[0];
    if(path === '/director') return '/director.html';
    if(path === '/admin') return '/admin.html';
    if(path === '/dashboard') return '/dashboard.html';
    return ALLOWED_RETURNS.has(path) ? path : '';
  }

  function readSession(){
    try{return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')}
    catch{return null}
  }

  function currentReturn(){
    return normalizePath(sessionStorage.getItem(RETURN_KEY));
  }

  function saveIntent(returnTo=''){
    sessionStorage.setItem(INTENT_KEY, '1');
    const safe = normalizePath(returnTo);
    if(safe) sessionStorage.setItem(RETURN_KEY, safe);
  }

  function clearIntent(){
    sessionStorage.removeItem(INTENT_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  }

  async function resolveRole(session){
    if(!session?.access_token || !session?.user?.id || !base || !key) return 'member';
    try{
      const res = await fetch(`${base}/rest/v1/admin_users?select=role&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`, {
        headers:{apikey:key, Authorization:`Bearer ${session.access_token}`}
      });
      if(!res.ok) return 'member';
      const rows = await res.json();
      return String(rows?.[0]?.role || 'member').toLowerCase();
    }catch{
      return 'member';
    }
  }

  function defaultTarget(role){
    if(role === 'director') return '/director.html';
    if(role === 'admin') return '/admin.html';
    return '/dashboard.html';
  }

  function permittedTarget(role, requested){
    if(requested === '/director.html') return role === 'director' ? requested : defaultTarget(role);
    if(requested === '/admin.html') return ['director','admin'].includes(role) ? requested : '/dashboard.html';
    if(requested === '/dashboard.html') return requested;
    return defaultTarget(role);
  }

  function sameDestination(target){
    const here = normalizePath(location.pathname) || location.pathname;
    return here === target;
  }

  async function routeAfterAuth(session){
    if(routing || !session?.access_token || !session?.user?.id) return;
    routing = true;
    try{
      const role = await resolveRole(session);
      const target = permittedTarget(role, currentReturn());
      clearIntent();
      if(!sameDestination(target)) location.assign(target);
    }finally{
      routing = false;
    }
  }

  function contextualizeAuthDialog(){
    const requested = currentReturn();
    if(!requested) return;
    const card = document.querySelector('#dialogContent .auth-card');
    if(!card) return;
    const heading = card.querySelector('h2');
    const eyebrow = card.querySelector('.eyebrow');
    const note = card.querySelector('.auth-note');
    if(requested === '/director.html'){
      if(eyebrow) eyebrow.textContent = 'Director access';
      if(heading) heading.textContent = 'Sign in to Director Control Center.';
      if(note) note.textContent = 'Use the authorized director account. Director access is granted only after server-side role verification.';
    }else if(requested === '/admin.html'){
      if(eyebrow) eyebrow.textContent = 'Administrative access';
      if(heading) heading.textContent = 'Sign in to moderation.';
      if(note) note.textContent = 'Administrative tools open only after server-side role verification.';
    }else if(requested === '/dashboard.html'){
      if(heading) heading.textContent = 'Sign in to your account.';
    }
  }

  function startWatcher(){
    if(watcher) return;
    const started = Date.now();
    watcher = setInterval(() => {
      contextualizeAuthDialog();
      const intent = sessionStorage.getItem(INTENT_KEY) === '1';
      const session = readSession();
      const token = String(session?.access_token || '');
      if(intent && token && token !== initialToken){
        clearInterval(watcher);
        watcher = null;
        routeAfterAuth(session);
        return;
      }
      if(Date.now() - started > 10 * 60 * 1000){
        clearInterval(watcher);
        watcher = null;
      }
    }, 250);
  }

  const params = new URLSearchParams(location.search);
  const requested = normalizePath(params.get('returnTo'));
  if(requested) saveIntent(requested);
  if(params.get('signin') === '1') saveIntent(requested);

  const existing = readSession();
  initialToken = String(existing?.access_token || '');

  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-action="signin"]');
    if(!trigger) return;
    const session = readSession();
    if(session?.access_token && session?.user?.id){
      event.preventDefault();
      event.stopImmediatePropagation();
      routeAfterAuth(session);
      return;
    }
    saveIntent(currentReturn());
    startWatcher();
  }, true);

  const dialogContent = document.querySelector('#dialogContent');
  if(dialogContent){
    new MutationObserver(contextualizeAuthDialog).observe(dialogContent, {childList:true, subtree:true});
  }

  if(requested && existing?.access_token && existing?.user?.id){
    routeAfterAuth(existing);
  }else if(sessionStorage.getItem(INTENT_KEY) === '1'){
    startWatcher();
  }

  window.DDH_ROLE_ROUTER = {routeAfterAuth, resolveRole};
})();
