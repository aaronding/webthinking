// The tools site is static. The Worker only redirects www to the bare domain
// and passes the two demos through to their own repos on GitHub Pages.
const UPSTREAM = 'https://aaronding.github.io';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.webthinking.io') {
      url.hostname = 'webthinking.io';
      return Response.redirect(url, 301);
    }
    if (/^\/(gcwind|ScorpionSolitaire)(\/|$)/.test(url.pathname)) {
      const res = await fetch(UPSTREAM + url.pathname + url.search, {
        method: request.method,
        headers: request.headers,
        redirect: 'follow',
      });
      // Keep relative links working when GitHub adds a trailing slash
      const final = new URL(res.url);
      if (final.pathname !== url.pathname) {
        return Response.redirect(new URL(final.pathname + final.search, url), 301);
      }
      return res;
    }
    return env.ASSETS.fetch(request);
  },
};
