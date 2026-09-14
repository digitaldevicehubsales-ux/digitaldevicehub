// Public runtime configuration for DigitalDeviceHub.
// This file contains only browser-safe Supabase public configuration.
// Never place a service_role key here.
window.DDH_CONFIG = Object.freeze({
  supabaseUrl: 'https://zfnqmduqxgvmgfbokjwl.supabase.co',
  supabasePublishableKey: 'sb_publishable_Dq3vJAEg60BSnzfHxsx_Hg_AmHw0x4K'
});

// Supabase email confirmations can return a session in the URL fragment.
// Capture it, resolve the authenticated user, store the browser session, and
// immediately reload without leaving access tokens visible in the address bar.
(() => {
  const cfg = window.DDH_CONFIG;
  const supabaseUrl = String(cfg.supabaseUrl || '').replace(/\/$/, '');
  const supabaseKey = String(cfg.supabasePublishableKey || '');
  const sessionKey = 'ddh_supabase_session';

  if (!supabaseUrl || !supabaseKey || !location.hash) return;

  const params = new URLSearchParams(location.hash.slice(1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken) return;

  const expiresIn = Number(params.get('expires_in') || 3600);
  const expiresAt = Number(params.get('expires_at') || 0) || Math.floor(Date.now() / 1000) + expiresIn;
  const tokenType = params.get('token_type') || 'bearer';

  (async () => {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${accessToken}`
        }
      });
      const user = response.ok ? await response.json() : null;
      localStorage.setItem(sessionKey, JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        expires_at: expiresAt,
        token_type: tokenType,
        user
      }));
      location.replace(`${location.pathname}${location.search}`);
    } catch {
      history.replaceState(null, document.title, `${location.pathname}${location.search}`);
    }
  })();
})();
