(()=>{
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('apple-ui');
  if(reduce){document.documentElement.classList.add('apple-reduced-motion');return}

  const revealSelectors=[
    '.hero-copy','.home-task-panel','.section-heading','.category-card','.product-card',
    '.checklist-head','.check-item','.sell-card','.page-hero>*','.market-confidence>div',
    '.filters','.market-toolbar','.empty-box','.device-layout>section','.device-panel',
    '.detail-section','.wizard-head','.wizard-card','.welcome-card','.kpi-grid>*','.panel',
    '.trust-card-v2','.help-card','.compare-empty>*','.footer-grid>*'
  ].join(',');

  const nodes=[...document.querySelectorAll(revealSelectors)];
  nodes.forEach((el,i)=>{
    el.classList.add('apple-reveal-target');
    el.style.setProperty('--apple-delay', Math.min((i%8)*55,330)+'ms');
  });

  const io=new IntersectionObserver(entries=>{
    for(const e of entries){
      if(e.isIntersecting){
        e.target.classList.add('apple-in-view');
        io.unobserve(e.target);
      }
    }
  },{rootMargin:'0px 0px -7% 0px',threshold:.08});
  nodes.forEach(n=>io.observe(n));

  const depthNodes=[...document.querySelectorAll('.home-primary,.page-hero,.gallery-main,.welcome-card')];
  let raf=0;
  const updateDepth=()=>{
    raf=0;
    const vh=innerHeight||800;
    for(const el of depthNodes){
      const r=el.getBoundingClientRect();
      const center=r.top+r.height/2;
      const distance=(center-vh/2)/vh;
      const y=Math.max(-12,Math.min(12,-distance*14));
      const scale=1-Math.min(.018,Math.abs(distance)*.012);
      el.style.setProperty('--apple-depth-y',y.toFixed(2)+'px');
      el.style.setProperty('--apple-depth-scale',scale.toFixed(4));
    }
  };
  addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(updateDepth)},{passive:true});
  addEventListener('resize',()=>{if(!raf)raf=requestAnimationFrame(updateDepth)},{passive:true});
  updateDepth();

  const internalLinks=[...document.querySelectorAll('a[href]')];
  internalLinks.forEach(a=>a.addEventListener('click',e=>{
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    const href=a.getAttribute('href')||'';
    if(!href||href.startsWith('#')||a.target==='_blank'||a.hasAttribute('download'))return;
    let url; try{url=new URL(href,location.href)}catch{return}
    if(url.origin!==location.origin||url.pathname===location.pathname&&url.search===location.search)return;
    document.documentElement.classList.add('apple-page-leaving');
  },{passive:true}));

  addEventListener('pageshow',()=>document.documentElement.classList.remove('apple-page-leaving'));

  const rails=[...document.querySelectorAll('.category-grid,.home-listing-preview,.product-grid,.gallery-thumbs,.compare-empty-actions')];
  rails.forEach(r=>r.classList.add('apple-rail'));

  document.querySelectorAll('h1,h2').forEach(h=>h.classList.add('apple-display-text'));
})();