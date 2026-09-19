// Public runtime configuration for DigitalDeviceHub.
// This file contains only browser-safe Supabase public configuration.
// Never place a service_role key here.
window.DDH_CONFIG = Object.freeze({
  supabaseUrl: 'https://zfnqmduqxgvmgfbokjwl.supabase.co',
  supabasePublishableKey: 'sb_publishable_Dq3vJAEg60BSnzfHxsx_Hg_AmHw0x4K'
});

// Session hardening layer.
// Real Supabase access/refresh tokens are held in Secure, HttpOnly cookies by
// the same-origin Worker. Existing application code sees only harmless
// sentinels in localStorage so the rest of the UI can keep using its current
// session shape without exposing reusable credentials to browser storage.
(() => {
  'use strict';
  const cfg=window.DDH_CONFIG;
  const supabaseUrl=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const sessionKey='ddh_supabase_session';
  const sentinel='__http_only__';
  const nativeFetch=window.fetch.bind(window);
  const nativeSet=Storage.prototype.setItem;
  const nativeRemove=Storage.prototype.removeItem;
  const nativeClear=Storage.prototype.clear;

  function safeParse(value){try{return JSON.parse(value)}catch{return null}}
  function sanitizeSession(data){
    if(!data||typeof data!=='object')return data;
    const copy={...data};
    if(copy.access_token)copy.access_token=sentinel;
    if(copy.refresh_token)copy.refresh_token=sentinel;
    delete copy.provider_token;
    delete copy.provider_refresh_token;
    return copy;
  }
  async function secureSession(data){
    if(!data?.access_token||data.access_token===sentinel)return null;
    try{
      const response=await nativeFetch('/auth/session',{
        method:'POST',credentials:'include',keepalive:true,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          access_token:data.access_token,
          refresh_token:data.refresh_token||'',
          expires_in:data.expires_in||3600,
          expires_at:data.expires_at||0,
          token_type:data.token_type||'bearer'
        })
      });
      return response.ok?response.json():null;
    }catch{return null}
  }
  function clearServerSession(){
    nativeFetch('/auth/logout',{method:'POST',credentials:'include',keepalive:true}).catch(()=>{});
  }

  // Migrate any legacy browser-stored credentials once, then overwrite them
  // with the non-secret session shell.
  try{
    const legacy=localStorage.getItem(sessionKey);
    const parsed=safeParse(legacy);
    if(parsed?.access_token&&parsed.access_token!==sentinel){
      secureSession(parsed).catch(()=>{});
      nativeSet.call(localStorage,sessionKey,JSON.stringify(sanitizeSession(parsed)));
    }
  }catch{}

  Storage.prototype.setItem=function(key,value){
    if(this===window.localStorage&&key===sessionKey){
      const parsed=safeParse(value);
      if(parsed?.access_token&&parsed.access_token!==sentinel)secureSession(parsed).catch(()=>{});
      const sanitized=parsed?JSON.stringify(sanitizeSession(parsed)):value;
      return nativeSet.call(this,key,sanitized);
    }
    return nativeSet.call(this,key,value);
  };
  Storage.prototype.removeItem=function(key){
    if(this===window.localStorage&&key===sessionKey)clearServerSession();
    return nativeRemove.call(this,key);
  };
  Storage.prototype.clear=function(){
    if(this===window.localStorage)clearServerSession();
    return nativeClear.call(this);
  };

  function requestDetails(input,init={}){
    const rawUrl=typeof input==='string'||input instanceof URL?String(input):String(input?.url||'');
    const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined)||{});
    const method=String(init.method||(input instanceof Request?input.method:'GET')||'GET').toUpperCase();
    return {rawUrl,headers,method};
  }
  function bodyRefreshToken(body){
    if(!body)return '';
    if(typeof body==='string')return String(safeParse(body)?.refresh_token||'');
    return '';
  }
  async function cloneBody(input,init){
    if(init?.body!==undefined)return init.body;
    if(input instanceof Request&&!['GET','HEAD'].includes(String(input.method||'GET').toUpperCase())){
      try{return await input.clone().arrayBuffer()}catch{return undefined}
    }
    return undefined;
  }

  window.fetch=async function(input,init={}){
    const {rawUrl,headers,method}=requestDetails(input,init);
    if(!rawUrl.startsWith(supabaseUrl))return nativeFetch(input,init);
    const target=new URL(rawUrl);

    // Route refresh-token grants through the same-origin Worker. The Worker
    // reads the HttpOnly refresh cookie and returns a session shell containing
    // sentinels instead of the real credentials.
    if(target.pathname==='/auth/v1/token'&&target.searchParams.get('grant_type')==='refresh_token'){
      const supplied=bodyRefreshToken(init?.body);
      const payload=supplied&&supplied!==sentinel?{refresh_token:supplied}:{};
      return nativeFetch('/auth/session',{
        method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
      });
    }

    const auth=headers.get('Authorization')||headers.get('authorization')||'';
    if(auth===`Bearer ${sentinel}`){
      headers.delete('Authorization');headers.delete('authorization');headers.delete('apikey');
      const body=await cloneBody(input,init);
      const proxyPath=`${target.pathname}${target.search}`;
      return nativeFetch(`/api/supabase?path=${encodeURIComponent(proxyPath)}`,{
        method,credentials:'include',headers,body:['GET','HEAD'].includes(method)?undefined:body
      });
    }
    return nativeFetch(input,init);
  };

  window.DDH_SECURE_SESSION=secureSession;
})();

// Supabase email confirmations and OAuth fallback can return a session in the
// URL fragment. Store the credentials only through the hardened session route,
// then remove all tokens from the address bar before the app continues.
(() => {
  const cfg=window.DDH_CONFIG;
  const supabaseUrl=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const supabaseKey=String(cfg.supabasePublishableKey||'');
  const sessionKey='ddh_supabase_session';
  if(!supabaseUrl||!supabaseKey||!location.hash)return;

  const params=new URLSearchParams(location.hash.slice(1));
  const accessToken=params.get('access_token');
  const refreshToken=params.get('refresh_token');
  if(!accessToken)return;
  const expiresIn=Number(params.get('expires_in')||3600);
  const expiresAt=Number(params.get('expires_at')||0)||Math.floor(Date.now()/1000)+expiresIn;
  const tokenType=params.get('token_type')||'bearer';

  (async()=>{
    try{
      const response=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:supabaseKey,Authorization:`Bearer ${accessToken}`}});
      const user=response.ok?await response.json():null;
      const session={access_token:accessToken,refresh_token:refreshToken||'',expires_in:expiresIn,expires_at:expiresAt,token_type:tokenType,user};
      await window.DDH_SECURE_SESSION?.(session);
      localStorage.setItem(sessionKey,JSON.stringify(session));
      location.replace(`${location.pathname}${location.search}`);
    }catch{
      history.replaceState(null,document.title,`${location.pathname}${location.search}`);
    }
  })();
})();
