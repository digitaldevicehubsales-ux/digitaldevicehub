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

  function galleryReady(){
    const main=document.querySelector('#galleryMain');
    const meta=document.querySelector('#deviceMeta');
    if(!main||!meta)return false;
    if(main.querySelector('.gallery-loading,.skeleton'))return false;
    return !/please wait/i.test(meta.textContent||'');
  }

  function waitForGallery(){
    if(galleryReady())return Promise.resolve();
    return new Promise(resolve=>{
      const observer=new MutationObserver(()=>{
        if(!galleryReady())return;
        observer.disconnect();clearTimeout(timer);resolve();
      });
      observer.observe(document.body,{subtree:true,childList:true,characterData:true});
      const timer=setTimeout(()=>{observer.disconnect();resolve()},8000);
    });
  }

  function showVideo(video,index){
    const main=document.querySelector('#galleryMain');
    const thumbs=document.querySelector('#galleryThumbs');
    if(!main)return;
    const src=publicMedia(video.storage_path);
    main.innerHTML=`<video class="listing-video" controls playsinline preload="metadata" aria-label="Listing video ${index+1}"><source src="${esc(src)}" type="${esc(video.mime_type||'video/mp4')}">Video playback unavailable.</video>`;
    thumbs?.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.videoIndex===String(index)));
  }

  async function setup(){
    const videos=await getVideos();
    if(!videos.length)return;
    await waitForGallery();
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
      button.innerHTML='<span class="video-thumb-icon" aria-hidden="true">▶</span><span>Video</span>';
      button.addEventListener('click',()=>showVideo(video,index));
      thumbs.appendChild(button);
    });
    if(!hadImageThumbs)showVideo(videos[0],0);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();