(() => {
  const params=new URLSearchParams(location.search);
  if(params.get('signin')!=='1')return;
  window.addEventListener('load',()=>{
    setTimeout(()=>{
      if(typeof showAuthDialog==='function') showAuthDialog('signin');
      try{history.replaceState({},document.title,location.pathname+location.hash)}catch{}
    },120);
  });
})();