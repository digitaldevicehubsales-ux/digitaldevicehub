(() => {
  'use strict';

  const cfg=window.DDH_CONFIG||{};
  const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=String(cfg.supabasePublishableKey||'');
  const table=document.querySelector('#userTable');
  const dialog=document.querySelector('#directorDialog');
  const modalBody=document.querySelector('#modalBody');
  const modalTitle=document.querySelector('#modalTitle');
  const modalEyebrow=document.querySelector('#modalEyebrow');
  const toastEl=document.querySelector('#directorToast');
  if(!base||!key||!table||!dialog||!modalBody||!modalTitle||!modalEyebrow)return;

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function session(){
    try{return JSON.parse(localStorage.getItem('ddh_supabase_session')||'null')}catch{return null}
  }

  function authHeaders(extra={}){
    const s=session();
    const headers={apikey:key,...extra};
    if(s?.access_token&&s.access_token!=='__http_only__')headers.Authorization=`Bearer ${s.access_token}`;
    return headers;
  }

  async function request(path,{method='GET',body,prefer}={}){
    const headers=authHeaders();
    if(prefer)headers.Prefer=prefer;
    if(body!==undefined)headers['Content-Type']='application/json';
    const response=await fetch(`${base}${path}`,{
      method,headers,body:body===undefined?undefined:JSON.stringify(body)
    });
    const text=await response.text();
    let data=null;
    if(text){try{data=JSON.parse(text)}catch{data=text}}
    if(!response.ok){
      const message=data?.message||data?.details||data?.error||data?.msg||`Request failed (${response.status}).`;
      throw new Error(message);
    }
    return data;
  }

  function toast(message){
    if(!toastEl)return;
    toastEl.textContent=message;
    toastEl.classList.add('show');
    clearTimeout(toast.t);
    toast.t=setTimeout(()=>toastEl.classList.remove('show'),3600);
  }

  function closeDialog(){if(dialog.open)dialog.close()}

  function showDialog(title,eyebrow,html){
    modalTitle.textContent=title;
    modalEyebrow.textContent=eyebrow;
    modalBody.innerHTML=html;
    if(!dialog.open)dialog.showModal();
  }

  function collectVariantPaths(value,out){
    if(!value)return;
    if(typeof value==='string'){
      if(value&&!/^https?:\/\//i.test(value))out.add(value);
      return;
    }
    if(Array.isArray(value)){value.forEach(item=>collectVariantPaths(item,out));return}
    if(typeof value==='object')Object.values(value).forEach(item=>collectVariantPaths(item,out));
  }

  async function userMediaPaths(userId){
    const listings=await request(`/rest/v1/listings?select=id&seller_id=eq.${encodeURIComponent(userId)}`).catch(()=>[]);
    const ids=(listings||[]).map(x=>x.id).filter(Boolean);
    if(!ids.length)return [];
    const inFilter=ids.join(',');
    const [images,videos]=await Promise.all([
      request(`/rest/v1/listing_images?select=storage_path,variants&listing_id=in.(${encodeURIComponent(inFilter)})`).catch(()=>[]),
      request(`/rest/v1/listing_videos?select=storage_path&listing_id=in.(${encodeURIComponent(inFilter)})`).catch(()=>[])
    ]);
    const paths=new Set();
    for(const row of images||[]){
      if(row?.storage_path)paths.add(row.storage_path);
      collectVariantPaths(row?.variants,paths);
    }
    for(const row of videos||[])if(row?.storage_path)paths.add(row.storage_path);
    return [...paths];
  }

  async function removeStorageObjects(paths){
    if(!paths.length)return;
    const response=await fetch(`${base}/storage/v1/object/listing-images`,{
      method:'DELETE',
      headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({prefixes:paths})
    });
    if(!response.ok){
      const data=await response.json().catch(()=>({}));
      throw new Error(data?.message||data?.error||'Could not remove all user listing media.');
    }
  }

  async function permanentlyDeleteUser(userId,reason){
    const paths=await userMediaPaths(userId);
    const result=await request('/rest/v1/rpc/director_delete_user',{
      method:'POST',
      body:{p_user_id:userId,p_reason:reason}
    });
    let mediaWarning='';
    try{await removeStorageObjects(paths)}
    catch(error){mediaWarning=error?.message||'Some listing media could not be removed.'}
    return {result,mediaWarning};
  }

  function openDeleteUserDialog(userId,displayName){
    showDialog('Delete user','Permanent account deletion',`
      <form id="directorDeleteUserForm">
        <p><strong>${esc(displayName||'This user')}</strong> will be permanently removed from DigitalDeviceHub.</p>
        <p class="muted">This deletes the Auth account, profile, listings, messages, favorites, offers, saved searches, and transaction or review records tied to this account. Listing media is removed from storage. This cannot be undone.</p>
        <p class="muted"><strong>Director and administrative accounts are protected.</strong></p>
        <div class="form-grid">
          <label class="field full">Deletion reason
            <textarea name="reason" minlength="10" maxlength="2000" required placeholder="Required: explain why this user is being permanently deleted"></textarea>
          </label>
          <label class="field full">Type DELETE USER to confirm
            <input name="confirmation" autocomplete="off" required placeholder="DELETE USER">
          </label>
        </div>
        <p id="directorDeleteUserStatus" class="muted" role="status" aria-live="polite"></p>
        <div class="modal-actions">
          <button class="btn secondary" type="button" data-cancel-user-delete>Cancel</button>
          <button class="btn danger" type="submit">Permanently delete user</button>
        </div>
      </form>
    `);

    const form=modalBody.querySelector('#directorDeleteUserForm');
    const statusEl=modalBody.querySelector('#directorDeleteUserStatus');
    const submit=form.querySelector('button[type="submit"]');
    form.querySelector('[data-cancel-user-delete]')?.addEventListener('click',closeDialog);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const data=new FormData(form);
      const reason=String(data.get('reason')||'').trim();
      const confirmation=String(data.get('confirmation')||'').trim();
      if(reason.length<10){
        statusEl.textContent='Enter at least 10 characters explaining the deletion.';
        form.elements.reason.focus();
        return;
      }
      if(confirmation!=='DELETE USER'){
        statusEl.textContent='Type DELETE USER exactly to confirm.';
        form.elements.confirmation.focus();
        return;
      }
      submit.disabled=true;
      statusEl.textContent='Deleting user and associated data…';
      try{
        const {mediaWarning}=await permanentlyDeleteUser(userId,reason);
        closeDialog();
        toast(mediaWarning?'User deleted. Media cleanup needs attention.':'User permanently deleted.');
        document.querySelector('#directorRefresh')?.click();
      }catch(error){
        statusEl.textContent=error?.message||'Could not delete this user.';
        submit.disabled=false;
      }
    });
    form.elements.reason?.focus();
  }

  function addDeleteButtons(){
    const current=session()?.user?.id||'';
    table.querySelectorAll('[data-edit-user]').forEach(manageButton=>{
      const userId=manageButton.dataset.editUser;
      if(!userId||userId===current)return;
      const actions=manageButton.closest('.row-actions');
      if(!actions||actions.querySelector(`[data-delete-user="${CSS.escape(userId)}"]`))return;
      const button=document.createElement('button');
      button.type='button';
      button.className='btn danger small';
      button.dataset.deleteUser=userId;
      button.textContent='Delete';
      actions.appendChild(button);
    });
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-delete-user]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const row=button.closest('tr');
    const name=row?.querySelector('td strong')?.textContent?.trim()||'This user';
    openDeleteUserDialog(button.dataset.deleteUser,name);
  },true);

  new MutationObserver(addDeleteButtons).observe(table,{childList:true,subtree:true});
  addDeleteButtons();
})();