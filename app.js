const listings = [
  {id:1,category:'Phones',name:'iPhone 15 Pro',condition:'Excellent',storage:'256 GB',price:620000,seller:'Metro Devices',verified:true,icon:'▯'},
  {id:2,category:'Phones',name:'Galaxy S24 Ultra',condition:'Good',storage:'256 GB',price:540000,seller:'Prime Mobile',verified:true,icon:'▯'},
  {id:3,category:'Laptops',name:'MacBook Air M2',condition:'Excellent',storage:'512 GB',price:870000,seller:'Tech Corner',verified:false,icon:'▱'},
  {id:4,category:'Laptops',name:'ThinkPad X1 Carbon',condition:'Good',storage:'1 TB',price:690000,seller:'Workstation Hub',verified:true,icon:'▱'},
  {id:5,category:'Tablets',name:'iPad Air 5',condition:'Excellent',storage:'256 GB',price:485000,seller:'Metro Devices',verified:true,icon:'▭'},
  {id:6,category:'Accessories',name:'USB-C 100W Charger',condition:'New',storage:'GaN',price:32000,seller:'Accessory Point',verified:false,icon:'⌁'},
  {id:7,category:'Phones',name:'Pixel 9 Pro',condition:'New',storage:'256 GB',price:710000,seller:'Prime Mobile',verified:true,icon:'▯'},
  {id:8,category:'Tablets',name:'Galaxy Tab S9',condition:'Good',storage:'128 GB',price:395000,seller:'Device Loft',verified:false,icon:'▭'}
];

let activeCategory = 'all';
const grid = document.querySelector('#listingGrid');
const empty = document.querySelector('#emptyState');
const search = document.querySelector('#searchInput');
const condition = document.querySelector('#conditionFilter');
const dialog = document.querySelector('#dialog');
const dialogContent = document.querySelector('#dialogContent');

const money = n => new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(n);

function render(){
  const q = search.value.trim().toLowerCase();
  const cond = condition.value;
  const filtered = listings.filter(x =>
    (activeCategory === 'all' || x.category === activeCategory) &&
    (cond === 'all' || x.condition === cond) &&
    (!q || `${x.name} ${x.category} ${x.storage}`.toLowerCase().includes(q))
  );
  grid.innerHTML = filtered.map(x => `
    <article class="listing-card" tabindex="0" data-id="${x.id}" aria-label="${x.name}, ${money(x.price)}">
      <div class="listing-art" aria-hidden="true">${x.icon}</div>
      <div class="listing-body">
        <div class="listing-meta"><span>${x.category}</span><span>${x.condition}</span></div>
        <h3>${x.name}</h3>
        <div class="listing-meta"><span>${x.storage}</span></div>
        <div class="price">${money(x.price)}</div>
        <div class="seller">${x.seller} ${x.verified ? '<span class="verified">✓ Verified</span>' : ''}</div>
      </div>
    </article>`).join('');
  empty.hidden = filtered.length !== 0;
}

function openListing(id){
  const x = listings.find(item => item.id === Number(id));
  if(!x) return;
  dialogContent.innerHTML = `<div class="dialog-product"><span class="eyebrow">${x.category} • ${x.condition}</span><h2>${x.name}</h2><p>${x.storage} • Seller: ${x.seller}${x.verified?' • Verified':''}</p><div class="price">${money(x.price)}</div><p>This is a validation listing. Checkout and payment protection will be enabled only after the transaction flow is connected to a compliant payment provider.</p><button class="button" data-dialog-close>Continue browsing</button></div>`;
  dialog.showModal();
  dialog.querySelector('[data-dialog-close]')?.addEventListener('click',()=>dialog.close());
}

document.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click',()=>{
  document.querySelectorAll('[data-category]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); activeCategory = btn.dataset.category; render();
}));
search.addEventListener('input',render);
condition.addEventListener('change',render);
grid.addEventListener('click',e=>{const card=e.target.closest('.listing-card'); if(card) openListing(card.dataset.id)});
grid.addEventListener('keydown',e=>{const card=e.target.closest('.listing-card'); if(card && (e.key==='Enter'||e.key===' ')){e.preventDefault();openListing(card.dataset.id)}});
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
document.querySelector('[data-action="signin"]').addEventListener('click',()=>{
  dialogContent.innerHTML='<div class="dialog-product"><span class="eyebrow">Account system</span><h2>Sign in is ready for backend connection.</h2><p>This zero-cost validation build deliberately does not collect credentials yet. Supabase Auth will be connected in the next backend phase.</p></div>';
  dialog.showModal();
});
document.querySelector('#sellForm').addEventListener('submit',e=>{
  e.preventDefault();
  dialogContent.innerHTML='<div class="dialog-product"><span class="eyebrow">Listing preview</span><h2>Your seller flow is working.</h2><p>No information was transmitted or saved. Database persistence and image uploads will be connected to Supabase once the free backend project is created.</p></div>';
  dialog.showModal();
  e.target.reset();
});

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));}
render();
