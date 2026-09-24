(() => {
  'use strict';
  const gate=document.querySelector('#authGate');
  if(!gate)return;

  function hasStoredUser(){
    try{return Boolean(JSON.parse(localStorage.getItem('ddh_supabase_session')||'null')?.user?.id)}catch{return false}
  }

  function apply(){
    const signedOut=!hasStoredUser() || !gate.hidden;
    document.body.classList.toggle('dashboard-signed-out',signedOut);
  }

  new MutationObserver(apply).observe(gate,{attributes:true,attributeFilter:['hidden']});
  apply();
})();
