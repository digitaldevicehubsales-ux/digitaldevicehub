(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  if(params.get('id'))return;
  const match=location.pathname.match(/^\/device\/([0-9a-f-]{36})(?:\/|$)/i);
  if(!match)return;
  params.set('id',match[1]);
  const query=params.toString();
  history.replaceState(history.state,'',`${location.pathname}${query?`?${query}`:''}${location.hash}`);
})();