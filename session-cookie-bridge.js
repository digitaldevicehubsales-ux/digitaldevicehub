(() => {
  'use strict';

  const SESSION_KEY = 'ddh_supabase_session';
  const SENTINEL = '__http_only__';
  const nativeFetch = window.__DDH_NATIVE_FETCH || window.fetch.bind(window);
  window.__DDH_NATIVE_FETCH = nativeFetch;

  function storedSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  async function syncSession(data = storedSession()) {
    if (!data?.user?.id) return false;
    const access = String(data.access_token || '');
    const refresh = String(data.refresh_token || '');
    const expiresAt = Number(data.expires_at || 0);
    const now = Math.floor(Date.now() / 1000);
    const payload = {};

    if (access && access !== SENTINEL && refresh && refresh !== SENTINEL && expiresAt > now + 45) {
      payload.access_token = access;
      payload.refresh_token = refresh;
      payload.expires_in = Math.max(60, expiresAt - now);
      payload.token_type = data.token_type || 'bearer';
    } else if (refresh && refresh !== SENTINEL) {
      payload.refresh_token = refresh;
    } else {
      return false;
    }

    try {
      const response = await nativeFetch('/auth/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function clearCookieSession() {
    try {
      await nativeFetch('/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: '{}'
      });
    } catch {}
  }

  window.DDH_SESSION_COOKIE_READY = syncSession();

  if (typeof window.saveSession === 'function') {
    const originalSaveSession = window.saveSession;
    window.saveSession = function bridgedSaveSession(data) {
      const result = originalSaveSession.apply(this, arguments);
      if (data?.access_token) {
        window.DDH_SESSION_COOKIE_READY = syncSession(data);
      } else {
        clearCookieSession();
      }
      return result;
    };
  }

  document.addEventListener('click', event => {
    const signOut = event.target.closest?.('#signOutButton,[data-signout]');
    if (signOut) clearCookieSession();
  }, true);
})();
