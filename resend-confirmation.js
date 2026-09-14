(() => {
  const form = document.querySelector('#resendForm');
  const status = document.querySelector('#status');
  const cfg = window.DDH_CONFIG || {};
  const supabaseUrl = String(cfg.supabaseUrl || '').replace(/\/$/, '');
  const supabaseKey = String(cfg.supabasePublishableKey || '');

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.setAttribute('data-tone', isError ? 'error' : 'success');
  };

  if (!form || !supabaseUrl || !supabaseKey) {
    setStatus('Account email service is not available right now.', true);
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const email = String(new FormData(form).get('email') || '').trim();
    if (!email) return;

    button.disabled = true;
    setStatus('Sending a fresh confirmation email…');

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/resend`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, type: 'signup' })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.msg || data.message || data.error_description || data.error || `Request failed (${response.status}).`);
      }

      setStatus('If that address has a pending DigitalDeviceHub signup, a fresh confirmation email has been sent. Check Inbox and Spam.');
    } catch (error) {
      setStatus(error?.message || 'Could not resend the confirmation email. Please try again in a minute.', true);
    } finally {
      button.disabled = false;
    }
  });
})();
