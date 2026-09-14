(function(){
  const providers={
    google:{label:'Google',supabase:'google'},
    microsoft:{label:'Microsoft',supabase:'azure',scopes:'email'},
    facebook:{label:'Facebook',supabase:'facebook',scopes:'email'}
  };

  function providerIcon(provider){
    if(provider==='google') return '<span class="provider-icon google" aria-hidden="true">G</span>';
    if(provider==='microsoft') return '<span class="provider-icon microsoft" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
    return '<span class="provider-icon facebook" aria-hidden="true">f</span>';
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
    if(config.scopes) params.set('scopes',config.scopes);
    window.location.assign(`${supabaseUrl}/auth/v1/authorize?${params.toString()}`);
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
        <button class="provider-button" type="button" data-oauth-provider="google">${providerIcon('google')}<span>Continue with Google</span></button>
        <button class="provider-button" type="button" data-oauth-provider="microsoft">${providerIcon('microsoft')}<span>Continue with Microsoft</span></button>
        <button class="provider-button" type="button" data-oauth-provider="facebook">${providerIcon('facebook')}<span>Continue with Facebook</span></button>
      </div>
      <div class="auth-divider"><span></span><b>or</b><span></span></div>
      <form id="authForm" class="dialog-form auth-email-form">
        <label class="sr-only" for="authEmail">Email address</label>
        <input id="authEmail" name="email" type="email" required autocomplete="email" placeholder="Email address" />
        <button class="button auth-submit" type="submit">Email me a 6-digit code</button>
      </form>
      <p class="form-note auth-note">First-time users are registered automatically. Returning users are signed in to the same account.</p>
    </div>`);

    dialogContent.querySelectorAll('[data-oauth-provider]').forEach(button=>button.addEventListener('click',()=>startOAuth(button.dataset.oauthProvider)));
    dialogContent.querySelector('#authForm')?.addEventListener('submit',handleEmailOtpSubmit);
  };

  consumeOAuthReturn();
})();