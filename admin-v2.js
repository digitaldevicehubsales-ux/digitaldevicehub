(() => {
'use strict';
const cfg=window.DDH_CONFIG||{},base=String(cfg.supabaseUrl||'').replace(/\/$/,''),key=String(cfg.supabasePublishableKey||''),SESSION_KEY='ddh_supabase_session';
const gate=document.querySelector('#adminGate'),app=document.querySelector('#adminApp'),queue=document.querySelector('#moderationQueue'),reports=document.querySelector('#reportQueue'),kpis=document.querySelector('#adminKpis'),users=document.querySelector('#userResults');
let mediaCounts=new Map(),mediaPreviews=new Map(),sellerProfiles=new Map(),listingRows=new Map();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(a,c)=>{const n=Number(a)||0;try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c||'USD',maximumFractionDigits:Number.isInteger(n)?0:2}).format(n)}catch{return `${c||'USD'} ${n.toLocaleString()}`}};
const mediaUrl=path=>path?`${base}/storage/v1/object/public/listing-images/${String(path).split('/').map(encodeURIComponent).join('/')}`:'';
const sess=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
function toast(t){const el=document.querySelector('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3000)}
async function api(path,{method='GET',body,prefer='return=representation'}={}){const s=sess();if(!s?.access_token)throw new Error('Sign in again.');const r=await fetch(`${base}${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>[]);if(!r.ok)throw new Error(data.message||data.details||data.error||`Request failed (${r.status})`);return data}
async function verifyAdmin(){const s=sess();if(!s?.user?.id)return false;const rows=await api(`/rest/v1/admin_users?select=role&user_id=eq.${encodeURIComponent(s.user.id)}&limit=1`).catch(()=>[]);return ['admin','director'].includes(rows?.[0]?.role)}
async function audit(action,{listingId=null,reportId=null,userId=null,note=null}={}){const s=sess();await api('/rest/v1/moderation_actions',{method:'POST',body:{admin_id:s.user.id,listing_id:listingId,report_id:reportId,subject_user_id:userId,action,note,assigned_to:s.user.id},prefer:'return=minimal'})}
async function setListing(id,status,note,{reload=true}={}){const body={status,moderation_note:note||null};if(status==='published')body.published_at=new Date().toISOString();if(status==='rejected')body.published_at=null;await api(`/rest/v1/listings?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body,prefer:'return=minimal'});if(['published','rejected'].includes(status))await api('/functions/v1/notify-listing-review',{method:'POST',body:{listing_id:id,action:'reviewed'},prefer:'return=minimal'}).catch(()=>null);await audit(status==='published'?'approve_listing':'reject_listing',{listingId:id,note:note||null});if(reload)await load()}
async function bulkSet(status){const selected=[...document.querySelectorAll('[data-select-listing]:checked')].map(x=>x.value);if(!selected.length)return toast('Select at least one listing.');const note=String(document.querySelector('#bulkNote')?.value||'').trim();if(status==='rejected'&&!note)return toast('Add a reason before bulk rejection.');const btns=[...document.querySelectorAll('[data-bulk]')];btns.forEach(b=>b.disabled=true);try{for(const id of selected)await setListing(id,status,note,{reload:false});toast(`${selected.length} listing${selected.length===1?'':'s'} ${status==='published'?'approved':'rejected'}.`);await load()}catch(err){toast(err.message)}finally{btns.forEach(b=>b.disabled=false)}}
async function setReport(id,status){await api(`/rest/v1/reports?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:{status,resolved_at:new Date().toISOString(),resolved_by:sess().user.id},prefer:'return=minimal'});await audit(`${status}_report`,{reportId:id});toast('Report updated.');load()}
function sla(created){const due=new Date(new Date(created).getTime()+4*60*60*1000),ms=due-Date.now();if(ms<=0)return `<span class="flag">SLA overdue by ${Math.max(1,Math.ceil(Math.abs(ms)/3600000))}h</span>`;const mins=Math.ceil(ms/60000);return `<span class="status-chip">Review due in ${mins>=60?`${Math.ceil(mins/60)}h`:`${mins}m`}</span>`}
function openListingPreview(id){
  const x=listingRows.get(id);if(!x)return toast('Listing preview is unavailable.');
  const seller=sellerProfiles.get(x.seller_id)||{},preview=mediaPreviews.get(id)||'';
  const grade=x.specs?.condition_grade||x.specs?.cosmetic_condition||(x.condition==='new'?'New (sealed)':'Used');
  const details=[
    ['Category',x.category],['Condition',grade],['Device history',x.specs?.usage_origin],['Price',money(x.price_amount,x.price_currency)],
    ['Location',[x.city,x.country_code].filter(Boolean).join(', ')||'Not provided'],['Delivery',x.delivery_mode||'Not set'],
    ['Storage',x.storage],['RAM',x.specs?.ram],['Battery',x.specs?.battery_health],['Network',x.specs?.network_status]
  ].filter(([,v])=>v);
  const dialog=document.querySelector('#adminPreviewDialog'),content=document.querySelector('#adminPreviewContent');
  document.querySelector('#adminPreviewTitle').textContent=x.title||'Listing preview';
  content.innerHTML='<div class="admin-preview-layout">'+(preview?'<img class="admin-preview-image" src="'+esc(preview)+'" alt="'+esc(x.title)+'">':'<div class="admin-preview-image admin-media-empty">No image</div>')+'<div><div class="admin-preview-price">'+esc(money(x.price_amount,x.price_currency))+'</div><p class="admin-preview-description">'+esc(x.description||'No description provided.')+'</p><div class="admin-preview-specs">'+details.map(([k,v])=>'<div><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join('')+'</div><p class="admin-seller-context"><strong>Seller:</strong> '+esc(seller.display_name||'Unnamed seller')+'</p></div></div>';
  dialog.showModal();
}
function renderListings(rows){
  if(!rows.length){queue.innerHTML='<div class="empty-inline">No listings are waiting for review.</div>';return}
  queue.innerHTML=rows.map(x=>{
    const media=mediaCounts.get(x.id)||{images:0,videos:0};
    const preview=mediaPreviews.get(x.id)||'';
    const seller=sellerProfiles.get(x.seller_id)||{};
    const grade=x.specs?.condition_grade||x.specs?.cosmetic_condition||(x.condition==='new'?'New (sealed)':'Missing grade');
    const origin=x.specs?.usage_origin||'';
    const checks=[
      [media.images+media.videos>0,(media.images+' photo'+(media.images===1?'':'s')+(media.videos?' · '+media.videos+' video':''))],
      [String(x.description||'').trim().length>=20,'Description'],
      [Boolean(x.city&&x.country_code),'Location'],
      [Boolean(x.delivery_mode),'Delivery'],
      [Boolean(grade&&grade!=='Missing grade'),'Condition grade'],
      [x.category!=='Phones'||x.condition!=='used'||Boolean(origin),'Usage origin']
    ];
    const quality=checks.map(([ok,label])=>'<span class="admin-quality '+(ok?'ok':'warn')+'">'+(ok?'✓ ':'! ')+esc(label)+'</span>').join('');
    const sellerTrust=[seller.verification_tier&&seller.verification_tier!=='account'?seller.verification_tier.replaceAll('_',' ')+' verified':null,Number(seller.rating_count)>0?Number(seller.rating_avg).toFixed(1)+'★ / '+seller.rating_count+' reviews':null,Number(seller.sales_count)>0?seller.sales_count+' completed sales':null].filter(Boolean).join(' · ')||'Account authenticated';
    return '<article class="admin-row admin-review-row" data-listing="'+esc(x.id)+'">'+(preview?'<a class="admin-media-preview" href="/device/'+encodeURIComponent(x.id)+'" target="_blank" rel="noopener"><img src="'+esc(preview)+'" alt="'+esc(x.title)+'" loading="lazy"></a>':'<div class="admin-media-preview admin-media-empty">No image</div>')+'<div class="admin-review-copy"><div class="admin-review-meta"><label class="admin-select"><input type="checkbox" data-select-listing value="'+esc(x.id)+'"> Select</label><span class="status-chip">'+esc(x.status)+'</span> '+(x.price_flagged?'<span class="flag">Price flagged</span>':'')+' '+(x.identity_check_status==='duplicate_review'?'<span class="flag">Identifier duplicate</span>':'')+' '+sla(x.created_at)+'</div><h3>'+esc(x.title)+'</h3><p>'+esc(x.category)+' · '+esc(grade)+' · '+esc(money(x.price_amount,x.price_currency))+'</p><p>'+esc([x.city,x.country_code].filter(Boolean).join(', ')||'Location not provided')+' · '+esc(x.delivery_mode||'Delivery not set')+'</p><div class="admin-quality-row">'+quality+'</div><p class="admin-seller-context"><strong>Seller:</strong> '+esc(seller.display_name||'Unnamed seller')+' · '+esc(sellerTrust)+'</p><p>'+esc(x.moderation_note||'No moderation note')+'</p></div><div class="admin-actions"><input class="control admin-note" placeholder="Reason / note"><button class="btn blue small" data-approve>Approve</button><button class="btn secondary small" data-reject>Reject</button><button class="btn secondary small" type="button" data-preview>Preview</button></div></article>';
  }).join('');
  queue.querySelectorAll('[data-listing]').forEach(row=>{
    const id=row.dataset.listing,note=()=>row.querySelector('.admin-note').value.trim();
    row.querySelector('[data-approve]').onclick=async()=>{try{await setListing(id,'published',note());toast('Listing approved.')}catch(err){toast(err.message)}};
    row.querySelector('[data-reject]').onclick=async()=>{if(!note())return toast('Add a rejection reason first.');try{await setListing(id,'rejected',note());toast('Listing rejected.')}catch(err){toast(err.message)}};
    row.querySelector('[data-preview]')?.addEventListener('click',()=>openListingPreview(id));
  });
}
function renderReports(rows){if(!rows.length){reports.innerHTML='<div class="empty-inline">No open safety reports.</div>';return}reports.innerHTML=rows.map(x=>`<article class="admin-row" data-report="${esc(x.id)}"><div><span class="status-chip">${esc(x.reason.replaceAll('_',' '))}</span>${sla(x.created_at)}<h3>Report ${esc(x.id.slice(0,8))}</h3><p>${esc(x.details||'No additional details')}</p><p>Listing: ${esc(x.listing_id||'Not attached')} · ${new Date(x.created_at).toLocaleString()}</p></div><div class="admin-actions"><button class="btn blue small" data-resolve>Resolve</button><button class="btn secondary small" data-dismiss>Dismiss</button></div></article>`).join('');reports.querySelectorAll('[data-report]').forEach(row=>{const id=row.dataset.report;row.querySelector('[data-resolve]').onclick=()=>setReport(id,'resolved');row.querySelector('[data-dismiss]').onclick=()=>setReport(id,'dismissed')})}
async function searchUsers(){const q=String(document.querySelector('#userSearch')?.value||'').trim();let path='/rest/v1/profiles?select=id,display_name,city,country_code,created_at,verification_tier,account_status&order=created_at.desc&limit=40';if(q){const safe=q.replace(/[*,()]/g,' ');if(/^[0-9a-f-]{36}$/i.test(q))path+=`&id=eq.${encodeURIComponent(q)}`;else path+=`&or=(display_name.ilike.*${encodeURIComponent(safe)}*,city.ilike.*${encodeURIComponent(safe)}*)`}try{const rows=await api(path);renderUsers(rows)}catch(err){users.innerHTML=`<div class="empty-inline">${esc(err.message)}</div>`}}
function renderUsers(rows){if(!rows.length){users.innerHTML='<div class="empty-inline">No matching accounts.</div>';return}users.innerHTML=rows.map(x=>`<article class="admin-row" data-user="${esc(x.id)}"><div><span class="status-chip">${esc(x.account_status)}</span><h3>${esc(x.display_name||'Unnamed account')}</h3><p>${esc([x.city,x.country_code].filter(Boolean).join(', ')||'Location not set')} · ${esc(x.verification_tier||'account')} · joined ${new Date(x.created_at).toLocaleDateString()}</p><p><code>${esc(x.id)}</code></p></div><div class="admin-actions">${x.account_status==='suspended'?`<button class="btn blue small" data-account-status="active">Reinstate</button>`:`<button class="btn secondary small danger-outline" data-account-status="suspended">Suspend</button>`}<a class="btn secondary small" href="/seller.html?id=${encodeURIComponent(x.id)}" target="_blank" rel="noopener">Public profile</a></div></article>`).join('');users.querySelectorAll('[data-user]').forEach(row=>row.querySelector('[data-account-status]')?.addEventListener('click',async e=>{const id=row.dataset.user,status=e.currentTarget.dataset.accountStatus;const reason=status==='suspended'?prompt('Reason for suspension (stored in audit log):','Safety review')||'Safety review':'Account reinstated';try{await api(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:{account_status:status},prefer:'return=minimal'});await audit(status==='suspended'?'suspend_account':'reinstate_account',{userId:id,note:reason});toast(status==='suspended'?'Account suspended and active listings removed.':'Account reinstated.');searchUsers();load()}catch(err){toast(err.message)}}))}
async function load(){
  try{
    const [ls,rs]=await Promise.all([
      api('/rest/v1/listings?select=id,seller_id,title,category,condition,storage,color,price_amount,price_currency,city,country_code,delivery_mode,status,price_flagged,identity_check_status,moderation_note,description,specs,created_at&status=eq.pending&order=created_at.asc'),
      api('/rest/v1/reports?select=id,listing_id,reason,details,status,created_at&status=in.(open,reviewing)&order=created_at.asc')
    ]);
    mediaCounts=new Map();mediaPreviews=new Map();sellerProfiles=new Map();listingRows=new Map(ls.map(x=>[x.id,x]));
    const listingIds=ls.map(x=>x.id),sellerIds=[...new Set(ls.map(x=>x.seller_id).filter(Boolean))];
    if(listingIds.length){
      const inList=listingIds.map(id=>'"'+id+'"').join(',');
      const [imgs,vids]=await Promise.all([
        api('/rest/v1/listing_images?select=listing_id,storage_path,variants,sort_order&id=not.is.null&listing_id=in.('+encodeURIComponent(inList)+')&order=sort_order.asc').catch(()=>[]),
        api('/rest/v1/listing_videos?select=listing_id&id=not.is.null&listing_id=in.('+encodeURIComponent(inList)+')').catch(()=>[])
      ]);
      for(const row of imgs||[]){const m=mediaCounts.get(row.listing_id)||{images:0,videos:0};m.images++;mediaCounts.set(row.listing_id,m);if(!mediaPreviews.has(row.listing_id)){const path=row.variants?.thumb||row.variants?.card||row.storage_path;if(path)mediaPreviews.set(row.listing_id,mediaUrl(path))}}
      for(const row of vids||[]){const m=mediaCounts.get(row.listing_id)||{images:0,videos:0};m.videos++;mediaCounts.set(row.listing_id,m)}
    }
    if(sellerIds.length){
      const inList=sellerIds.map(id=>'"'+id+'"').join(',');
      const profiles=await api('/rest/v1/public_profiles?select=id,display_name,verification_tier,rating_avg,rating_count,sales_count&id=in.('+encodeURIComponent(inList)+')').catch(()=>[]);
      sellerProfiles=new Map((profiles||[]).map(x=>[x.id,x]));
    }
    renderListings(ls);renderReports(rs);
    Promise.allSettled(ls.filter(x=>x.status==='pending').map(x=>api('/functions/v1/notify-listing-review',{method:'POST',body:{listing_id:x.id}}))).catch(()=>{});
    kpis.innerHTML='<div class="admin-kpi"><span>Pending listings</span><strong>'+ls.filter(x=>x.status==='pending').length+'</strong></div><div class="admin-kpi"><span>Automated flags</span><strong>'+ls.filter(x=>x.price_flagged||x.identity_check_status==='duplicate_review').length+'</strong></div><div class="admin-kpi"><span>Open reports</span><strong>'+rs.length+'</strong></div>';
  }catch(err){gate.hidden=false;gate.textContent=err.message;app.hidden=true}
}
async function start(){const s=sess();if(!s?.user?.id){gate.hidden=false;gate.textContent='Administrator sign-in is required.';return}try{const ok=await verifyAdmin();if(!ok){gate.hidden=false;gate.textContent='Administrator access is required.';return}gate.hidden=true;app.hidden=false;await Promise.all([load(),searchUsers()])}catch(err){gate.hidden=false;gate.textContent=err.message;app.hidden=true}}
document.querySelector('#adminPreviewClose')?.addEventListener('click',()=>document.querySelector('#adminPreviewDialog')?.close());document.querySelector('#refreshAdmin')?.addEventListener('click',()=>Promise.all([load(),searchUsers()]));document.querySelector('#userSearchForm')?.addEventListener('submit',e=>{e.preventDefault();searchUsers()});document.querySelectorAll('[data-bulk]').forEach(b=>b.addEventListener('click',()=>bulkSet(b.dataset.bulk)));document.querySelector('#selectAllListings')?.addEventListener('change',e=>document.querySelectorAll('[data-select-listing]').forEach(x=>x.checked=e.currentTarget.checked));start();
})();
