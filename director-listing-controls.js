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

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function showDialog(title, eyebrow, html) {
    modalEyebrow.textContent = eyebrow;
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    if (!dialog.open) dialog.showModal();
  }

  async function fetchListing(listingId) {
    const rows = await request(`/rest/v1/listings?select=id,seller_id,title,brand,model,category,condition,price_amount,price_currency,country_code,city,delivery_mode,status,moderation_note,published_at&id=eq.${encodeURIComponent(listingId)}&limit=1`);
    if (!rows?.[0]) throw new Error('Listing not found or no longer available.');
    return rows[0];
  }

  async function auditEdit(listing, nextStatus, note) {
    const s = session();
    if (!s?.user?.id) return;
    const auditNote = `Director edited listing; status ${nextStatus}.${note ? ` ${note}` : ''}`;
    await request('/rest/v1/moderation_actions', {
      method: 'POST',
      prefer: 'return=minimal',
      body: {
        admin_id: s.user.id,
        listing_id: listing.id,
        subject_user_id: listing.seller_id,
        action: 'director_edit_listing',
        note: auditNote,
        assigned_to: s.user.id
      }
    }).catch(() => {});
  }

  function option(value, label = value) {
    return `<option value="${esc(value)}">${esc(label)}</option>`;
  }

  async function openEditDialog(listingId) {
    showDialog('Loading listing…', 'Director listing control', '<p class="muted">Loading the latest listing data…</p>');
    try {
      const listing = await fetchListing(listingId);
      showDialog('Edit listing', 'Director listing control', `
        <form id="directorListingEditForm">
          <div class="form-grid">
            <label class="field full">Title<input name="title" maxlength="140" required value="${esc(listing.title)}"></label>
            <label class="field">Brand<input name="brand" maxlength="80" required value="${esc(listing.brand)}"></label>
            <label class="field">Model<input name="model" maxlength="100" required value="${esc(listing.model)}"></label>
            <label class="field">Category<select name="category">${['Phones','Laptops','Tablets','Accessories','Wearables'].map(v => option(v)).join('')}</select></label>
            <label class="field">Condition<select name="condition">${option('new','New')}${option('used','Used')}</select></label>
            <label class="field">Price<input name="price" type="number" step="0.0001" min="0.0001" required value="${esc(listing.price_amount)}"></label>
            <label class="field">Currency<input name="currency" maxlength="3" pattern="[A-Za-z]{3}" required value="${esc(listing.price_currency)}"></label>
            <label class="field">Country code<input name="country" maxlength="2" pattern="[A-Za-z]{2}" required value="${esc(listing.country_code || '')}"></label>
            <label class="field">City / locality<input name="city" maxlength="80" value="${esc(listing.city || '')}"></label>
            <label class="field">Delivery<select name="delivery">
              ${option('pickup','Local pickup only')}${option('domestic','Domestic shipping')}${option('international','International shipping')}${option('pickup_domestic','Pickup + domestic')}${option('all','Pickup + domestic + international')}
            </select></label>
            <label class="field">Status<select name="status">${['draft','pending','published','paused','sold','rejected','archived'].map(v => option(v)).join('')}</select></label>
            <label class="field full">Moderation note<textarea name="moderation_note" maxlength="2000" placeholder="Add context for this Director edit">${esc(listing.moderation_note || '')}</textarea></label>
          </div>
          <p id="directorListingEditStatus" class="muted" role="status" aria-live="polite"></p>
          <div class="modal-actions">
            <button class="btn secondary" type="button" data-cancel-edit>Cancel</button>
            <button class="btn blue" type="submit">Save listing</button>
          </div>
        </form>`);

      const form = modalBody.querySelector('#directorListingEditForm');
      const statusEl = modalBody.querySelector('#directorListingEditStatus');
      const submit = form.querySelector('button[type="submit"]');
      form.elements.category.value = listing.category || 'Phones';
      form.elements.condition.value = listing.condition || 'used';
      form.elements.delivery.value = listing.delivery_mode || 'pickup';
      form.elements.status.value = listing.status || 'draft';
      form.querySelector('[data-cancel-edit]')?.addEventListener('click', closeDialog);

      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const data = new FormData(form);
        const nextStatus = String(data.get('status') || 'draft');
        const moderationNote = String(data.get('moderation_note') || '').trim();
        if (['rejected', 'archived', 'sold'].includes(nextStatus) && moderationNote.length < 10) {
          statusEl.textContent = 'Enter at least 10 characters explaining this listing status change.';
          form.elements.moderation_note.focus();
          return;
        }

        const body = {
          title: String(data.get('title') || '').trim(),
          brand: String(data.get('brand') || '').trim(),
          model: String(data.get('model') || '').trim(),
          category: String(data.get('category') || ''),
          condition: String(data.get('condition') || ''),
          price_amount: Number(data.get('price')),
          price_currency: String(data.get('currency') || '').trim().toUpperCase(),
          country_code: String(data.get('country') || '').trim().toUpperCase(),
          city: String(data.get('city') || '').trim() || null,
          delivery_mode: String(data.get('delivery') || ''),
          status: nextStatus,
          moderation_note: moderationNote || null
        };
        if (nextStatus === 'published' && !listing.published_at) body.published_at = new Date().toISOString();
        if (['rejected','draft','pending','archived'].includes(nextStatus)) body.published_at = null;

        submit.disabled = true;
        statusEl.textContent = 'Saving listing…';
        try {
          await request(`/rest/v1/listings?id=eq.${encodeURIComponent(listing.id)}`, {method:'PATCH', body, prefer:'return=minimal'});
          await auditEdit(listing, nextStatus, moderationNote);
          closeDialog();
          toast('Listing updated.');
          document.querySelector('#directorRefresh')?.click();
        } catch (error) {
          statusEl.textContent = error?.message || 'Could not update this listing.';
          submit.disabled = false;
        }
      });
    } catch (error) {
      modalBody.innerHTML = `<p class="muted">${esc(error?.message || 'Could not load this listing.')}</p><div class="modal-actions"><button class="btn secondary" type="button" data-close-load-error>Close</button></div>`;
      modalBody.querySelector('[data-close-load-error]')?.addEventListener('click', closeDialog);
    }
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
    if (typeof value === 'object') Object.values(value).forEach(item => collectVariantPaths(item, out));
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
    showDialog('Delete listing', 'Permanent listing deletion', `
      <form id="directorDeleteListingForm">
        <p><strong>${esc(title || 'This listing')}</strong> will be permanently removed from the marketplace.</p>
        <p class="muted">Associated listing data is removed, listing images are deleted from storage, and historical orders keep their saved listing snapshot.</p>
        <div class="form-grid">
          <label class="field full">Deletion reason<textarea name="reason" minlength="10" maxlength="2000" required placeholder="Required: explain why this listing is being permanently deleted"></textarea></label>
          <label class="field full">Type DELETE to confirm<input name="confirmation" autocomplete="off" required placeholder="DELETE"></label>
        </div>
        <p id="directorDeleteListingStatus" class="muted" role="status" aria-live="polite"></p>
        <div class="modal-actions">
          <button class="btn secondary" type="button" data-cancel-delete>Cancel</button>
          <button class="btn danger" type="submit">Permanently delete listing</button>
        </div>
      </form>`);

    const form = modalBody.querySelector('#directorDeleteListingForm');
    const statusEl = modalBody.querySelector('#directorDeleteListingStatus');
    const submit = form.querySelector('button[type="submit"]');
    form.querySelector('[data-cancel-delete]')?.addEventListener('click', closeDialog);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form);
      const reason = String(data.get('reason') || '').trim();
      const confirmation = String(data.get('confirmation') || '').trim();
      if (reason.length < 10) {
        statusEl.textContent = 'Enter at least 10 characters explaining the deletion.';
        form.elements.reason.focus();
        return;
      }
      if (confirmation !== 'DELETE') {
        statusEl.textContent = 'Type DELETE exactly to confirm permanent deletion.';
        form.elements.confirmation.focus();
        return;
      }
      submit.disabled = true;
      statusEl.textContent = 'Deleting listing and associated media…';
      try {
        await permanentlyDeleteListing(listingId, reason);
        closeDialog();
        toast('Listing permanently deleted.');
        document.querySelector('#directorRefresh')?.click();
      } catch (error) {
        statusEl.textContent = error?.message || 'Could not delete this listing.';
        submit.disabled = false;
      }
    });
    form.elements.reason?.focus();
  }

  function addDeleteButtons() {
    table.querySelectorAll('[data-edit-listing]').forEach(editButton => {
      const listingId = editButton.dataset.editListing;
      if (!listingId) return;
      editButton.type = 'button';
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

  // Capture and own Edit/Delete clicks. The original Director table is rerendered
  // after refreshes, so delegated handlers are more reliable than per-row onclicks.
  document.addEventListener('click', event => {
    const edit = event.target.closest?.('[data-edit-listing]');
    const del = event.target.closest?.('[data-delete-listing]');
    if (!edit && !del) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (edit) {
      openEditDialog(edit.dataset.editListing);
      return;
    }

    const row = del.closest('tr');
    const title = row?.querySelector('td strong')?.textContent?.trim() || 'This listing';
    openDeleteDialog(del.dataset.deleteListing, title);
  }, true);

  new MutationObserver(addDeleteButtons).observe(table, {childList:true, subtree:true});
  addDeleteButtons();
})();
