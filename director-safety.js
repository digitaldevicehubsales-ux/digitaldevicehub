(() => {
  'use strict';

  function requireReason(field, message, minLength = 10) {
    if (!field) return false;
    const value = String(field.value || '').trim();
    field.setCustomValidity(value.length >= minLength ? '' : message);
    if (value.length < minLength) {
      field.reportValidity();
      field.focus();
      return false;
    }
    return true;
  }

  document.addEventListener('change', event => {
    const form = event.target.closest?.('form');
    if (!form) return;

    if (form.id === 'userEditForm' && event.target.name === 'account_status') {
      const note = form.elements.note;
      const suspended = event.target.value === 'suspended';
      if (note) {
        note.required = suspended;
        note.placeholder = suspended ? 'Required: explain why this account is being suspended' : 'Reason for the account decision';
        if (!suspended) note.setCustomValidity('');
      }
    }

    if (form.id === 'listingEditForm' && event.target.name === 'status') {
      const note = form.elements.moderation_note;
      const critical = ['rejected', 'archived', 'sold'].includes(event.target.value);
      if (note) {
        note.required = critical;
        if (critical) note.placeholder = 'Required: explain this status change';
        else note.setCustomValidity('');
      }
    }

    if (form.id === 'disputeForm' && event.target.name === 'status') {
      const resolution = form.elements.resolution;
      const closing = ['resolved', 'closed'].includes(event.target.value);
      if (resolution) {
        resolution.required = closing;
        if (closing) resolution.placeholder = 'Required: record the resolution before closing this dispute';
        else resolution.setCustomValidity('');
      }
    }
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.id === 'userEditForm' && form.elements.account_status?.value === 'suspended') {
      if (!requireReason(form.elements.note, 'Enter at least 10 characters explaining why this account is being suspended.')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    if (form.id === 'listingEditForm' && ['rejected', 'archived', 'sold'].includes(form.elements.status?.value)) {
      if (!requireReason(form.elements.moderation_note, 'Enter at least 10 characters explaining this listing status change.')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    if (form.id === 'disputeForm' && ['resolved', 'closed'].includes(form.elements.status?.value)) {
      if (!requireReason(form.elements.resolution, 'Enter at least 10 characters describing the dispute resolution.')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  }, true);
})();
