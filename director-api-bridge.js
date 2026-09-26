(() => {
  'use strict';

  const cfg = window.DDH_CONFIG || {};
  const base = String(cfg.supabaseUrl || '').replace(/\/$/, '');
  if (!base) return;

  const nativeFetch = window.__DDH_NATIVE_FETCH || window.fetch.bind(window);
  window.__DDH_NATIVE_FETCH = nativeFetch;

  window.fetch = async function directorFetch(input, init = {}) {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    if (!rawUrl || !rawUrl.startsWith(base)) return nativeFetch(input, init);

    let target;
    try { target = new URL(rawUrl); } catch { return nativeFetch(input, init); }
    if (!/^\/(rest|storage|functions)\/v1\//.test(target.pathname)) return nativeFetch(input, init);

    const cookieReady = await Promise.resolve(window.DDH_SESSION_COOKIE_READY).catch(() => false);
    if (!cookieReady) return nativeFetch(input, init);

    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.delete('apikey');
    headers.delete('authorization');

    let body = init.body;
    if (body === undefined && input instanceof Request && !['GET', 'HEAD'].includes(method)) {
      body = await input.clone().arrayBuffer();
    }

    const path = `${target.pathname}${target.search}`;
    return nativeFetch(`/api/supabase?path=${encodeURIComponent(path)}`, {
      ...init,
      method,
      headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : body,
      credentials: 'same-origin'
    });
  };
})();
