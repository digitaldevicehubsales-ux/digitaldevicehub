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
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = Number(data.expires_at || (data.expires_in ? now + Number(data.expires_in) : 0));

    // Only bridge a currently valid browser session. Do not rotate a refresh
    // token here because the legacy client may be refreshing it at the same time.
    if (!access || access === SENTINEL || !refresh || refresh === SENTINEL || expiresAt <= now + 45) {
      return false;
    }

    try {
      const response = await nativeFetch('/auth/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          access_token: access,
          refresh_token: refresh,
          expires_in: Math.max(60, expiresAt - now),
          token_type: data.token_type || 'bearer'
        })
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
        window.DDH_SESSION_COOKIE_READY = syncSession(storedSession() || data);
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
