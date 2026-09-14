// Handle Supabase email-confirmation redirects without adding a frontend framework.
// Supabase may return an access token in the URL fragment after a user confirms email.
(() => {
  const cfg = window.DDH_CONFIG || {};
  const supabaseUrl = String(cfg.supabaseUrl || '').replace(/\/$/, '');
  const supabaseKey = String(cfg.supabasePublishableKey || '');
  const SESSION_KEY = 'ddh_supabase_session';

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
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        expires_at: expiresAt,
        token_type: tokenType,
        user
      }));
      location.replace(`${location.pathname}${location.search}`);
    } catch {
      // Do not leave auth tokens visible in the address bar if user lookup fails.
      history.replaceState(null, document.title, `${location.pathname}${location.search}`);
    }
  })();
})();
