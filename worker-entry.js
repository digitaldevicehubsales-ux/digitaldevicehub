import app from './worker.js';

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  }
};
