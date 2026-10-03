(() => {
  'use strict';

  const cfg=window.DDH_CONFIG||{};
  const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=String(cfg.supabasePublishableKey||'');
  const table=document.querySelector('#auditTable');
  const panel=document.querySelector('[data-panel="audit"] .panel');
  const dialog=document.querySelector('#directorDialog');
  const modalBody=document.querySelector('#modalBody');
  const modalTitle=document.querySelector('#modalTitle');
  const modalEyebrow=document.querySelector('#modalEyebrow');
  const toastEl=document.querySelector('#directorToast');
  if(!base||!key||!table||!panel||!dialog||!modalBody||!modalTitle||!modalEyebrow)return;

  function session(){
    try{return JSON.parse(localStorage.getItem('ddh_supabase_session')||'null')}catch{return null}
  }
  function authHeaders(extra={}){
    const s=session();
    const headers={apikey:key,...extra};
    if(s?.access_token&&s.access_token!=='__http_only__')headers.Authorization='Bearer '+s.access_token;
    return headers;
  }
  async function request(path,{method='GET',body}={}){
    const headers=authHeaders();
    if(body!==undefined)headers['Content-Type']='application/json';
    const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    const text=await response.text();
    let data=null;
    if(text){try{data=JSON.parse(text)}catch{data=text}}
    if(!response.ok)throw new Error(data?.message||data?.details||data?.error||data?.msg||('Request failed ('+response.status+').'));
    return data;
  }
  function toast(message){
    if(!toastEl)return;
    toastEl.textContent=message;
    toastEl.classList.add('show');
    clearTimeout(toast.t);
    toast.t=setTimeout(()=>toastEl.classList.remove('show'),3200);
  }
  function closeDialog(){if(dialog.open)dialog.close()}
  function showDialog(title,eyebrow,html){
    modalTitle.textContent=title;
    modalEyebrow.textContent=eyebrow;
    modalBody.innerHTML=html;
    if(!dialog.open)dialog.showModal();
  }
  function selectedIds(){
    return [...table.querySelectorAll('.audit-select:checked')]
      .map(input=>Number(input.value))
      .filter(Number.isSafeInteger);
  }
  function ensureToolbar(){
    let toolbar=panel.querySelector('#auditClearToolbar');
    if(!toolbar){
      toolbar=document.createElement('div');
      toolbar.id='auditClearToolbar';
      toolbar.className='audit-clear-toolbar';
      toolbar.innerHTML='<label class="audit-select-all"><input id="auditSelectAll" type="checkbox"> <span>Select all</span></label><span id="auditSelectedCount" class="muted">0 selected</span><div class="audit-clear-actions"><button class="btn secondary small" id="auditClearSelected" type="button" disabled>Clear selected</button><button class="btn danger small" id="auditClearAll" type="button">Clear all</button></div>';
      table.before(toolbar);
      toolbar.querySelector('#auditSelectAll')?.addEventListener('change',event=>{
        table.querySelectorAll('.audit-select').forEach(input=>{input.checked=event.currentTarget.checked});
        syncToolbar();
      });
      toolbar.querySelector('#auditClearSelected')?.addEventListener('click',()=>openClearDialog(false));
      toolbar.querySelector('#auditClearAll')?.addEventListener('click',()=>openClearDialog(true));
    }
    return toolbar;
  }
  function syncToolbar(){
    const toolbar=ensureToolbar();
    const boxes=[...table.querySelectorAll('.audit-select')];
    const selected=boxes.filter(x=>x.checked);
    const all=toolbar.querySelector('#auditSelectAll');
    if(all){
      all.checked=boxes.length>0&&selected.length===boxes.length;
      all.indeterminate=selected.length>0&&selected.length<boxes.length;
      all.disabled=boxes.length===0;
    }
    const count=toolbar.querySelector('#auditSelectedCount');
    if(count)count.textContent=selected.length+' selected';
    const clearSelected=toolbar.querySelector('#auditClearSelected');
    if(clearSelected)clearSelected.disabled=selected.length===0;
    const clearAll=toolbar.querySelector('#auditClearAll');
    if(clearAll)clearAll.disabled=boxes.length===0;
  }
  async function clearAudit(ids,clearAll,reason){
    return request('/rest/v1/rpc/director_clear_audit',{
      method:'POST',
      body:{p_ids:clearAll?null:ids,p_clear_all:clearAll,p_reason:reason}
    });
  }
  function openClearDialog(clearAll){
    const ids=selectedIds();
    if(!clearAll&&!ids.length){toast('Select at least one audit record.');return}
    const count=clearAll?table.querySelectorAll('.audit-select').length:ids.length;
    const phrase=clearAll?'CLEAR ALL':'CLEAR';
    showDialog(clearAll?'Clear audit trail':'Clear selected records','Audit trail cleanup',
      '<form id="directorClearAuditForm">'+
      '<p><strong>'+(clearAll?'All visible audit records':count+' selected audit record'+(count===1?'':'s'))+'</strong> will be removed.</p>'+
      '<p class="muted">A new accountability entry will remain, recording how many records were cleared and why.</p>'+
      '<div class="form-grid">'+
      '<label class="field full">Clear reason<textarea name="reason" minlength="10" maxlength="1000" required placeholder="Required: explain why these audit records are being cleared"></textarea></label>'+
      '<label class="field full">Type '+phrase+' to confirm<input name="confirmation" autocomplete="off" required placeholder="'+phrase+'"></label>'+
      '</div>'+
      '<p id="directorClearAuditStatus" class="muted" role="status" aria-live="polite"></p>'+
      '<div class="modal-actions"><button class="btn secondary" type="button" data-cancel-audit-clear>Cancel</button><button class="btn danger" type="submit">'+(clearAll?'Clear audit trail':'Clear selected')+'</button></div>'+
      '</form>');
    const form=modalBody.querySelector('#directorClearAuditForm');
    const status=modalBody.querySelector('#directorClearAuditStatus');
    const submit=form.querySelector('button[type="submit"]');
    form.querySelector('[data-cancel-audit-clear]')?.addEventListener('click',closeDialog);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const data=new FormData(form);
      const reason=String(data.get('reason')||'').trim();
      const confirmation=String(data.get('confirmation')||'').trim();
      if(reason.length<10){
        status.textContent='Enter at least 10 characters explaining the cleanup.';
        form.elements.reason.focus();
        return;
      }
      if(confirmation!==phrase){
        status.textContent='Type '+phrase+' exactly to confirm.';
        form.elements.confirmation.focus();
        return;
      }
      submit.disabled=true;
      status.textContent='Clearing audit records…';
      try{
        const result=await clearAudit(ids,clearAll,reason);
        closeDialog();
        toast((result?.removed??count)+' audit record'+((result?.removed??count)===1?'':'s')+' cleared.');
        document.querySelector('#directorRefresh')?.click();
      }catch(error){
        status.textContent=error?.message||'Could not clear audit records.';
        submit.disabled=false;
      }
    });
    form.elements.reason?.focus();
  }

  table.addEventListener('change',event=>{
    if(event.target.matches('.audit-select'))syncToolbar();
  });
  new MutationObserver(syncToolbar).observe(table,{childList:true,subtree:true});
  ensureToolbar();
  syncToolbar();
})();