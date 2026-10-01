import app from './worker.js';

export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url);
    const match=url.pathname.match(/^\/device\/([0-9a-f-]{36})(?:\/|$)/i);
    if(match&&!url.searchParams.get('id')){
      url.searchParams.set('id',match[1]);
      return Response.redirect(url.toString(),302);
    }
    return app.fetch(request,env,ctx);
  }
};