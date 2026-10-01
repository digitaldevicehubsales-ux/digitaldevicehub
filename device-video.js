(() => {
  'use strict';
  const cfg=window.DDH_CONFIG||{};
  const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=String(cfg.supabasePublishableKey||'');
  const id=new URLSearchParams(location.search).get('id');
  if(!base||!key||!id||!/^[0-9a-f-]{36}$/i.test(id))return;

  const publicMedia=path=>path?`${base}/storage/v1/object/public/listing-images/${String(path).split('/').map(encodeURIComponent).join('/')}`:'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function getVideos(){
    const path=`/rest/v1/listing_videos?select=storage_path,mime_type,sort_order&listing_id=eq.${encodeURIComponent(id)}&order=sort_order.asc`;
    const res=await fetch(`${base}${path}`,{headers:{apikey:key}});
    if(!res.ok)return [];
    return res.json().catch(()=>[]);
  }

  function showVideo(video,index){
    const main=document.querySelector('#galleryMain');
    const thumbs=document.querySelector('#galleryThumbs');
    if(!main)return;
    const src=publicMedia(video.storage_path);
    main.innerHTML=`<video controls playsinline preload="metadata" aria-label="Listing video ${index+1}" style="display:block;width:100%;height:100%;max-height:690px;min-height:320px;object-fit:contain;background:#0c0f14"><source src="${esc(src)}" type="${esc(video.mime_type||'video/mp4')}">Your browser cannot play this video.</video>`;
    thumbs?.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.videoIndex===String(index)));
  }

  async function setup(){
    const videos=await getVideos();
    if(!videos.length)return;
    const thumbs=document.querySelector('#galleryThumbs');
    const main=document.querySelector('#galleryMain');
    if(!thumbs||!main)return;
    const hadImageThumbs=thumbs.querySelector('button')!==null;
    videos.forEach((video,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='video-thumb';
      button.dataset.videoIndex=String(index);
      button.setAttribute('aria-label',`Play listing video ${index+1}`);
      button.style.cssText='display:grid;place-items:center;gap:2px;background:#0c0f14;color:#fff;font-size:11px;font-weight:800';
      button.innerHTML='<span aria-hidden="true" style="font-size:22px;line-height:1">▶</span><span>Video</span>';
      button.addEventListener('click',()=>showVideo(video,index));
      thumbs.appendChild(button);
    });
    if(!hadImageThumbs)showVideo(videos[0],0);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(setup,350));
  else setTimeout(setup,350);
})();
