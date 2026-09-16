(function(){
  const GOOGLE_CLIENT_ID='660710567581-tlav5rbkgmkbjmpof5k5gvjkq3ubuc63.apps.googleusercontent.com';
  const providers={
    google:{label:'Google',supabase:'google'}
  };
  let googleIdentityPromise=null;
  let googleNonceRaw='';

  function providerIcon(provider){
    if(provider==='google') return '<span class="provider-icon google" aria-hidden="true">G</span>';
    return '';
  }

  async function providerIsEnabled(provider){
    const config=providers[provider];
    if(!config) return false;
    try{
      const response=await fetch(`${supabaseUrl}/auth/v1/settings`,{headers:{apikey:supabaseKey}});
      if(!response.ok) return true;
      const settings=await response.json();
      const external=settings?.external||{};
      return external[config.supabase] !== false;
    }catch{
      return true;
    }
  }

  async function startOAuth(provider){
    const config=providers[provider];
    if(!config) return;

    const enabled=await providerIsEnabled(provider);
    if(!enabled){
      showAuthDialog('signin',`${config.label} sign-in still needs to be enabled in Supabase before this button can be used.`);
      return;
    }

    const redirectTo=`${window.location.origin}${window.location.pathname}`;
    const params=new URLSearchParams({
      provider:config.supabase,
      redirect_to:redirectTo
    });
    window.location.assign(`${supabaseUrl}/auth/v1/authorize?${params.toString()}`);
  }

  function loadGoogleIdentity(){
    if(window.google?.accounts?.id) return Promise.resolve(window.google);
    if(googleIdentityPromise) return googleIdentityPromise;
    googleIdentityPromise=new Promise((resolve,reject)=>{
      const finish=()=>window.google?.accounts?.id?resolve(window.google):reject(new Error('Google sign-in could not be loaded.'));
      const existing=document.querySelector('script[data-ddh-google-gis]');
      if(existing){
        existing.addEventListener('load',finish,{once:true});
        existing.addEventListener('error',()=>reject(new Error('Google sign-in could not be loaded.')),{once:true});
        return;
      }
      const script=document.createElement('script');
      script.src='https://accounts.google.com/gsi/client';
      script.async=true;
      script.defer=true;
      script.dataset.ddhGoogleGis='1';
      script.addEventListener('load',finish,{once:true});
      script.addEventListener('error',()=>reject(new Error('Google sign-in could not be loaded.')),{once:true});
      document.head.appendChild(script);
    });
    return googleIdentityPromise;
  }

  async function createGoogleNoncePair(){
    if(!window.crypto?.getRandomValues || !window.crypto?.subtle){
      throw new Error('Secure Google sign-in is not supported by this browser.');
    }
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    const raw=btoa(String.fromCharCode(...bytes));
    const encoded=new TextEncoder().encode(raw);
    const digest=await crypto.subtle.digest('SHA-256',encoded);
    const hashed=Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
    return {raw,hashed};
  }

  async function handleGoogleCredential(response){
    const idToken=String(response?.credential||'');
    if(!idToken){
      showAuthDialog('signin','Google did not return a sign-in credential. Please try again.');
      return;
    }
    if(!googleNonceRaw){
      showAuthDialog('signin','Google sign-in security check expired. Please try again.');
      return;
    }
    const nonce=googleNonceRaw;
    googleNonceRaw='';
    try{
      const data=await authRequest('/auth/v1/token?grant_type=id_token',{
        provider:'google',
        id_token:idToken,
        nonce
      });
      saveSession(data);
      pendingOtpEmail='';
      showNotice('Signed in',`You are signed in as ${data?.user?.email||'your Google account'}.`);
    }catch(err){
      showAuthDialog('signin',err.message);
    }
  }

  async function mountGoogleButton(){
    const mount=dialogContent.querySelector('#googleSignInMount');
    if(!mount) return;
    try{
      const enabled=await providerIsEnabled('google');
      if(!enabled) throw new Error('Google sign-in still needs to be enabled in Supabase.');
      await loadGoogleIdentity();
      if(!dialogContent.contains(mount)) return;
      const noncePair=await createGoogleNoncePair();
      googleNonceRaw=noncePair.raw;
      window.google.accounts.id.initialize({
        client_id:GOOGLE_CLIENT_ID,
        callback:handleGoogleCredential,
        nonce:noncePair.hashed,
        ux_mode:'popup',
        use_fedcm_for_button:true,
        button_auto_select:false,
        context:'signin'
      });
      mount.innerHTML='';
      const width=Math.max(240,Math.min(420,Math.floor(mount.getBoundingClientRect().width||360)));
      window.google.accounts.id.renderButton(mount,{
        type:'standard',
        theme:'outline',
        size:'large',
        text:'continue_with',
        shape:'rectangular',
        logo_alignment:'left',
        width
      });
    }catch(err){
      if(!dialogContent.contains(mount)) return;
      googleNonceRaw='';
      mount.innerHTML=`<button class="provider-button" type="button" data-google-fallback>${providerIcon('google')}<span>Continue with Google</span></button>`;
      mount.querySelector('[data-google-fallback]')?.addEventListener('click',()=>startOAuth('google'));
      console.warn('Direct Google sign-in unavailable; using OAuth redirect fallback.',err);
    }
  }

  async function consumeOAuthReturn(){
    const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
    const query=new URLSearchParams(window.location.search);
    const errorDescription=hash.get('error_description')||query.get('error_description')||hash.get('error')||query.get('error');

    if(errorDescription){
      history.replaceState({},document.title,window.location.pathname);
      showAuthDialog('signin',decodeURIComponent(errorDescription.replace(/\+/g,' ')));
      return;
    }

    const accessToken=hash.get('access_token');
    const refreshToken=hash.get('refresh_token');
    if(!accessToken) return;

    try{
      const response=await fetch(`${supabaseUrl}/auth/v1/user`,{
        headers:{apikey:supabaseKey,Authorization:`Bearer ${accessToken}`}
      });
      if(!response.ok) throw new Error('Could not finish provider sign-in.');
      const user=await response.json();
      saveSession({
        access_token:accessToken,
        refresh_token:refreshToken||'',
        expires_in:Number(hash.get('expires_in')||3600),
        token_type:hash.get('token_type')||'bearer',
        provider_token:hash.get('provider_token')||undefined,
        provider_refresh_token:hash.get('provider_refresh_token')||undefined,
        user
      });
      pendingOtpEmail='';
      history.replaceState({},document.title,window.location.pathname);
      showNotice('Signed in',`You are signed in as ${user.email||'your account'}.`);
    }catch(err){
      history.replaceState({},document.title,window.location.pathname);
      showAuthDialog('signin',err.message);
    }
  }

  showAuthDialog=function(_mode='signin',message=''){
    if(!backendReady){
      showNotice('Backend connection pending','The website is live, but the free Supabase project still needs to be connected before account access can be used.');
      return;
    }
    if(session?.user?.email){
      showDialog(`<div class="dialog-product"><span class="eyebrow">Your account</span><h2>${escapeHtml(session.user.email)}</h2><p>You are signed in to DigitalDeviceHub.</p><div class="dialog-actions"><button class="button secondary" data-signout>Sign out</button><button class="button" data-dialog-close>Done</button></div></div>`);
      dialogContent.querySelector('[data-signout]')?.addEventListener('click',signOut);
      dialogContent.querySelector('[data-dialog-close]')?.addEventListener('click',()=>dialog.close());
      return;
    }

    showDialog(`<div class="dialog-product auth-card">
      <span class="eyebrow">DigitalDeviceHub account</span>
      <h2>Sign in or sign up.</h2>
      ${message?`<p class="status-note">${escapeHtml(message)}</p>`:''}
      <div class="provider-stack" aria-label="Sign in options">
        <div id="googleSignInMount" class="google-signin-mount" aria-label="Continue with Google"><button class="provider-button" type="button" disabled>${providerIcon('google')}<span>Loading Google…</span></button></div>
      </div>
      <div class="auth-divider"><span></span><b>or</b><span></span></div>
      <form id="authForm" class="dialog-form auth-email-form">
        <label class="sr-only" for="authEmail">Email address</label>
        <input id="authEmail" name="email" type="email" required autocomplete="email" placeholder="Email address" />
        <button class="button auth-submit" type="submit">Email me a 6-digit code</button>
      </form>
      <p class="form-note auth-note">First-time users are registered automatically. Returning users are signed in to the same account.</p>
    </div>`);

    dialogContent.querySelector('#authForm')?.addEventListener('submit',handleEmailOtpSubmit);
    mountGoogleButton();
  };

  consumeOAuthReturn();
})();