(() => {
  'use strict';

  const cfg = window.DDH_CONFIG || {};
  const base = String(cfg.supabaseUrl || '').replace(/\/$/, '');
  const key = String(cfg.supabasePublishableKey || '');
  const table = document.querySelector('#listingTable');
  const dialog = document.querySelector('#directorDialog');
  const modalBody = document.querySelector('#modalBody');
  const modalTitle = document.querySelector('#modalTitle');
  const modalEyebrow = document.querySelector('#modalEyebrow');
  const toastEl = document.querySelector('#directorToast');
  if (!base || !key || !table || !dialog || !modalBody || !modalTitle || !modalEyebrow) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function session() {
    try { return JSON.parse(localStorage.getItem('ddh_supabase_session') || 'null'); }
    catch { return null; }
  }

  function authHeaders(extra = {}) {
    const s = session();
    const headers = {'apikey': key, ...extra};
    if (s?.access_token && s.access_token !== '__http_only__') headers.Authorization = `Bearer ${s.access_token}`;
    return headers;
  }

  async function request(path, {method = 'GET', body, prefer} = {}) {
    const headers = authHeaders();
    if (prefer) headers.Prefer = prefer;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!response.ok) {
      const message = data?.message || data?.details || data?.error || data?.msg || `Request failed (${response.status}).`;
      throw new Error(message);
    }
    return data;
  }

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  function collectVariantPaths(value, out) {
    if (!value) return;
    if (typeof value === 'string') {
      if (value && !/^https?:\/\//i.test(value)) out.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(item => collectVariantPaths(item, out));
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(item => collectVariantPaths(item, out));
    }
  }

  async function listingImagePaths(listingId) {
    const rows = await request(`/rest/v1/listing_images?select=storage_path,variants&listing_id=eq.${encodeURIComponent(listingId)}`);
    const paths = new Set();
    for (const row of rows || []) {
      if (row?.storage_path) paths.add(row.storage_path);
      collectVariantPaths(row?.variants, paths);
    }
    return [...paths];
  }

  async function removeStorageObjects(paths) {
    if (!paths.length) return;
    const response = await fetch(`${base}/storage/v1/object/listing-images`, {
      method: 'DELETE',
      headers: authHeaders({'Content-Type':'application/json'}),
      body: JSON.stringify({prefixes: paths})
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || data?.error || 'Could not remove listing images from storage.');
    }
  }

  async function permanentlyDeleteListing(listingId, reason) {
    const paths = await listingImagePaths(listingId);
    await removeStorageObjects(paths);
    return request('/rest/v1/rpc/director_delete_listing', {
      method: 'POST',
      body: {p_listing_id: listingId, p_reason: reason}
    });
  }

  function openDeleteDialog(listingId, title) {
    modalEyebrow.textContent = 'Permanent listing deletion';
    modalTitle.textContent = 'Delete listing';
    modalBody.innerHTML = `
      <form id="directorDeleteListingForm">
        <p><strong>${esc(title || 'This listing')}</strong> will be permanently removed from the marketplace.</p>
        <p class="muted">Associated listing data is removed, listing images are deleted from storage, and any historical order keeps its saved listing snapshot for transaction records.</p>
        <div class="form-grid">
          <label class="field full">Deletion reason
            <textarea name="reason" minlength="10" maxlength="2000" required placeholder="Required: explain why this listing is being permanently deleted"></textarea>
          </label>
          <label class="field full">Type DELETE to confirm
            <input name="confirmation" autocomplete="off" required placeholder="DELETE">
          </label>
        </div>
        <p id="directorDeleteListingStatus" class="muted" role="status" aria-live="polite"></p>
        <div class="modal-actions">
          <button class="btn secondary" type="button" data-cancel-delete>Cancel</button>
          <button class="btn danger" type="submit">Permanently delete listing</button>
        </div>
      </form>`;

    const form = modalBody.querySelector('#directorDeleteListingForm');
    const status = modalBody.querySelector('#directorDeleteListingStatus');
    const submit = form.querySelector('button[type="submit"]');
    form.querySelector('[data-cancel-delete]')?.addEventListener('click', () => dialog.close());
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form);
      const reason = String(data.get('reason') || '').trim();
      const confirmation = String(data.get('confirmation') || '').trim();
      if (reason.length < 10) {
        status.textContent = 'Enter at least 10 characters explaining the deletion.';
        form.elements.reason.focus();
        return;
      }
      if (confirmation !== 'DELETE') {
        status.textContent = 'Type DELETE exactly to confirm permanent deletion.';
        form.elements.confirmation.focus();
        return;
      }
      submit.disabled = true;
      status.textContent = 'Deleting listing and associated media…';
      try {
        await permanentlyDeleteListing(listingId, reason);
        dialog.close();
        toast('Listing permanently deleted.');
        document.querySelector('#directorRefresh')?.click();
      } catch (error) {
        status.textContent = error?.message || 'Could not delete this listing.';
        submit.disabled = false;
      }
    });

    if (!dialog.open) dialog.showModal();
    form.elements.reason?.focus();
  }

  function addDeleteButtons() {
    table.querySelectorAll('[data-edit-listing]').forEach(editButton => {
      const listingId = editButton.dataset.editListing;
      if (!listingId) return;
      const actions = editButton.closest('.row-actions');
      if (!actions || actions.querySelector(`[data-delete-listing="${CSS.escape(listingId)}"]`)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn danger small';
      button.dataset.deleteListing = listingId;
      button.textContent = 'Delete';
      actions.appendChild(button);
    });
  }

  table.addEventListener('click', event => {
    const button = event.target.closest?.('[data-delete-listing]');
    if (!button) return;
    const row = button.closest('tr');
    const title = row?.querySelector('td strong')?.textContent?.trim() || 'This listing';
    openDeleteDialog(button.dataset.deleteListing, title);
  });

  new MutationObserver(addDeleteButtons).observe(table, {childList:true, subtree:true});
  addDeleteButtons();
})();
