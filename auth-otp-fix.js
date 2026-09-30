(() => {
  'use strict';

  const cleanOtp = value => String(value || '').replace(/\D/g,'').slice(0,8);
  const validOtp = token => /^\d{6,8}$/.test(token);

  showOtpDialog = function(email, message=''){
    showDialog(`<div class="dialog-product auth-card">
      <span class="eyebrow">Email verification</span>
      <h2>Enter your code.</h2>
      ${message?`<p class="status-note">${escapeHtml(message)}</p>`:''}
      <p>Enter your complete code.</p>
      <p><strong>${escapeHtml(email)}</strong></p>
      <form id="otpForm" class="dialog-form">
        <label>One-time code
          <input name="token" type="text" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" minlength="6" maxlength="8" placeholder="Enter code" aria-describedby="otpHelp" />
        </label>
        <small id="otpHelp">Use every emailed digit.</small>
        <button class="button" type="submit">Verify and sign in</button>
      </form>
      <div class="dialog-actions">
        <button class="text-button" data-resend-otp>Resend code</button>
        <button class="text-button" data-change-email>Change email</button>
      </div>
    </div>`);

    const form=dialogContent.querySelector('#otpForm');
    const input=form?.querySelector('input[name="token"]');
    input?.addEventListener('input',()=>{
      input.value=cleanOtp(input.value);
    });
    form?.addEventListener('submit',e=>handleOtpVerify(e,email));
    dialogContent.querySelector('[data-resend-otp]')?.addEventListener('click',()=>resendOtp(email));
    dialogContent.querySelector('[data-change-email]')?.addEventListener('click',()=>showAuthDialog('signin'));
    input?.focus();
  };

  handleOtpVerify = async function(event,email){
    event.preventDefault();
    const token=cleanOtp(new FormData(event.currentTarget).get('token'));
    if(!validOtp(token)){
      showOtpDialog(email,'Enter the complete emailed code.');
      return;
    }
    try{
      const data=await authRequest('/auth/v1/verify',{email,token,type:'email'});
      saveSession(data);
      pendingOtpEmail='';
      showNotice('Signed in','Email verified. You are signed in.');
    }catch(err){
      showOtpDialog(email,err.message||'Code verification failed.');
    }
  };
})();