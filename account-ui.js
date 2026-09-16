(() => {
  'use strict';
  if(typeof showAuthDialog!=='function')return;
  const previousShowAuthDialog=showAuthDialog;
  showAuthDialog=function(mode='signin',message=''){
    if(session?.user?.email){
      showDialog(`<div class="dialog-product auth-card"><span class="eyebrow">Your account</span><h2>${escapeHtml(session.user.email)}</h2><p>Manage listings, analytics, messages, favorites and your profile from your DigitalDeviceHub dashboard.</p><div class="dialog-actions"><a class="button" href="/dashboard.html">Open dashboard</a><button class="button secondary" data-signout>Sign out</button><button class="text-button" data-dialog-close>Close</button></div></div>`);
      dialogContent.querySelector('[data-signout]')?.addEventListener('click',signOut);
      dialogContent.querySelector('[data-dialog-close]')?.addEventListener('click',()=>dialog.close());
      return;
    }
    return previousShowAuthDialog(mode,message);
  };
})();
