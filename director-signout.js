(() => {
  'use strict';

  const SESSION_KEY = 'ddh_supabase_session';
  const button = document.querySelector('#signOutButton');
  if (!button) return;

  async function signOutDirector() {
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Signing out…';

    let storedSession = null;
    try {
      storedSession = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {}

    const cfg = window.DDH_CONFIG || {};
    const supabaseUrl = String(cfg.supabaseUrl || '').replace(/\/$/, '');
    const supabaseKey = String(cfg.supabasePublishableKey || '');

    try {
      if (storedSession?.access_token && supabaseUrl && supabaseKey) {
        await fetch(`${supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${storedSession.access_token}`
          }
        });
      }
    } catch {}

    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: '{}'
      });
    } catch {}

    localStorage.removeItem(SESSION_KEY);
    window.location.assign('/?signin=1&signedOut=1');
  }

  button.addEventListener('click', signOutDirector);
})();
