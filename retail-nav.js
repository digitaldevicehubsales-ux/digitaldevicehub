(()=>{
  const header=document.querySelector('.global-header');
  const nav=header?.querySelector('.global-nav');
  if(!header||!nav||document.querySelector('.retail-mega'))return;

  const mega=document.createElement('div');
  mega.className='retail-mega';
  mega.hidden=true;
  mega.innerHTML=`
    <div class="retail-mega-inner">
      <section><span>Shop</span>
        <a href="/marketplace">All devices</a>
        <a href="/marketplace?category=Phones">Phones</a>
        <a href="/marketplace?category=Laptops">Laptops</a>
        <a href="/marketplace?category=Tablets">Tablets</a>
        <a href="/marketplace?category=Wearables">Wearables</a>
        <a href="/marketplace?category=Accessories">Accessories</a>
      </section>
      <section><span>Sell</span>
        <a href="/sell">List a device</a>
        <a href="/dashboard">My listings</a>
        <a href="/seller-onboarding">Seller onboarding</a>
        <a href="/regions">Regions & features</a>
      </section>
      <section><span>Explore</span>
        <a href="/compare">Compare devices</a>
        <a href="/trust">Trust & Safety</a>
        <a href="/help">Help Center</a>
        <a href="/about">About marketplace</a>
      </section>
      <section class="retail-mega-callout">
        <span>Start here</span>
        <strong>Find the right device.</strong>
        <p>Compare condition, seller context, price and delivery details.</p>
        <a class="retail-mega-cta" href="/marketplace">Browse marketplace →</a>
      </section>
    </div>`;
  header.insertAdjacentElement('afterend',mega);

  const shopLink=[...nav.querySelectorAll('a')].find(a=>/marketplace/i.test(a.textContent||''));
  if(shopLink){
    shopLink.setAttribute('aria-haspopup','true');
    shopLink.setAttribute('aria-expanded','false');
  }

  let closeTimer=0;
  const open=()=>{
    clearTimeout(closeTimer);
    mega.hidden=false;
    requestAnimationFrame(()=>mega.classList.add('open'));
    shopLink?.setAttribute('aria-expanded','true');
    document.documentElement.classList.add('mega-open');
  };
  const close=()=>{
    mega.classList.remove('open');
    shopLink?.setAttribute('aria-expanded','false');
    document.documentElement.classList.remove('mega-open');
    closeTimer=setTimeout(()=>{if(!mega.classList.contains('open'))mega.hidden=true},180);
  };

  if(matchMedia('(hover:hover) and (min-width:1001px)').matches){
    shopLink?.addEventListener('mouseenter',open);
    shopLink?.addEventListener('focus',open);
    mega.addEventListener('mouseenter',()=>clearTimeout(closeTimer));
    mega.addEventListener('mouseleave',close);
    header.addEventListener('mouseleave',()=>{closeTimer=setTimeout(close,140)});
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mega.hidden){close();shopLink?.focus()}});
  document.addEventListener('click',e=>{
    if(mega.hidden)return;
    if(mega.contains(e.target)||header.contains(e.target))return;
    close();
  });
})();