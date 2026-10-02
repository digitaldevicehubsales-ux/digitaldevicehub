(() => {
  'use strict';
  const input=document.querySelector('#helpSearch');
  const items=[...document.querySelectorAll('.help-faq')];
  const status=document.querySelector('#helpSearchStatus');
  const empty=document.querySelector('#helpEmpty');
  if(!input||!items.length)return;
  const normalize=v=>String(v||'').toLowerCase().replace(/\s+/g,' ').trim();
  const run=()=>{
    const q=normalize(input.value);
    let shown=0;
    for(const item of items){
      const match=!q||normalize(item.textContent).includes(q);
      item.hidden=!match;
      if(match)shown++;
    }
    empty.hidden=shown!==0;
    status.textContent=q?(shown+' help topic'+(shown===1?'':'s')+' found'):'';
  };
  input.addEventListener('input',run);
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';run();input.blur()}});
})();