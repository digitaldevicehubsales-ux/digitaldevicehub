(function(){
  const providerLabels={google:'Google',facebook:'Facebook',apple:'Apple'};

  function providerIcon(provider){
    if(provider==='google') return '<span class="provider-icon google" aria-hidden="true">G</span>';
    if(provider==='facebook') return '<span class="provider-icon facebook" aria-hidden="true">f</span>';
    return '<span class="provider-icon apple" aria-hidden="true">●</span>';
  }

  function showProviderEmailDialog(provider,message=''){
    const label=providerLabels[provider]||'your account';
    showDialog(`<div class="dialog-product auth-card">
      <span class="eyebrow">Continue with ${escapeHtml(label)}</span>
      <h2>Verify your email.</h2>
      ${message?`<p class="status-note">${escapeHtml(message)}</p>`:''}
      <p>Enter the email address you use with ${escapeHtml(label)}. We’ll send a 6-digit DigitalDeviceHub code to that inbox.</p>
      <form id="providerOtpForm" class="dialog-form">
        <label>Email address<input name="email" type="email" required autocomplete="email" placeholder="you@example.com" /></label>
        <button class="button auth-submit" type="submit">Send code</button>
      </form>
      <button class="text-button auth-back" type="button" data-auth-back>← Back to sign in options</button>
      <p class="form-note">DigitalDeviceHub verifies the email address only. We never ask for your Google, Facebook or Apple password.</p>
    </div>`);

    dialogContent.querySelector('#providerOtpForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const email=String(new FormData(event.currentTarget).get('email')||'').trim().toLowerCase();
      if(!email) return;
      try{
        await sendEmailOtp(email);
        pendingOtpEmail=email;
        showOtpDialog(email,`A 6-digit code was sent to the email you use with ${label}.`);
      }catch(err){
        showProviderEmailDialog(provider,err.message);
      }
    });
    dialogContent.querySelector('[data-auth-back]')?.addEventListener('click',()=>showAuthDialog('signin'));
    dialogContent.querySelector('input[name="email"]')?.focus();
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
      <div class="provider-stack" aria-label="Account options">
        <button class="provider-button" type="button" data-email-provider="facebook">${providerIcon('facebook')}<span>Continue with Facebook</span></button>
        <button class="provider-button" type="button" data-email-provider="google">${providerIcon('google')}<span>Continue with Google</span></button>
        <button class="provider-button" type="button" data-email-provider="apple">${providerIcon('apple')}<span>Continue with Apple</span></button>
      </div>
      <div class="auth-divider"><span></span><b>or</b><span></span></div>
      <form id="authForm" class="dialog-form auth-email-form">
        <label class="sr-only" for="authEmail">Email address</label>
        <input id="authEmail" name="email" type="email" required autocomplete="email" placeholder="Email address" />
        <button class="button auth-submit" type="submit">Email me a code</button>
      </form>
      <p class="form-note auth-note">New here? Enter any email. We’ll create the account automatically after the 6-digit code is verified.</p>
    </div>`);

    dialogContent.querySelectorAll('[data-email-provider]').forEach(button=>button.addEventListener('click',()=>showProviderEmailDialog(button.dataset.emailProvider)));
    dialogContent.querySelector('#authForm')?.addEventListener('submit',handleEmailOtpSubmit);
  };
})();
