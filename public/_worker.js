export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle the custom proxy API route
    if (url.pathname === '/api/proxy') {
      const b64url = url.searchParams.get('b64url');
      if (!b64url) {
        return new Response('Missing b64url parameter', { status: 400 });
      }

      try {
        const targetUrl = atob(b64url);
        
        const fetchRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': request.headers.get('Accept') || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': request.headers.get('Accept-Language') || 'en-US,en;q=0.9',
          },
          redirect: 'follow'
        });

        const contentType = fetchRes.headers.get('content-type') || '';
        
        // Strip out frame-blocking headers
        let responseHeaders = new Headers(fetchRes.headers);
        responseHeaders.delete('X-Frame-Options');
        responseHeaders.delete('Content-Security-Policy');
        responseHeaders.delete('Cross-Origin-Embedder-Policy');
        responseHeaders.delete('Cross-Origin-Opener-Policy');
        
        responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        responseHeaders.set('Pragma', 'no-cache');
        responseHeaders.set('Expires', '0');
        responseHeaders.set('Surrogate-Control', 'no-store');
        responseHeaders.set('Referrer-Policy', 'no-referrer');
        responseHeaders.set('X-Content-Type-Options', 'nosniff');

        // Rewrite relative URLs in HTML
        if (contentType.includes('text/html')) {
          let html = await fetchRes.text();
          
          html = html.replace(/(src|href)=["'](.*?)["']/gi, (match, attr, pathStr) => {
            if (pathStr.startsWith('data:') || pathStr.startsWith('#')) {
              return match;
            }
            try {
              const fullResourceUrl = new URL(pathStr, targetUrl).toString();
              const b64 = btoa(fullResourceUrl);
              return `${attr}="/api/proxy?b64url=${b64}"`;
            } catch (e) {
              return match;
            }
          });
          
          responseHeaders.set('Content-Type', 'text/html');
          return new Response(html, {
            status: fetchRes.status,
            headers: responseHeaders
          });
        } else {
          // Serve binary/other data directly
          return new Response(fetchRes.body, {
            status: fetchRes.status,
            headers: responseHeaders
          });
        }
      } catch (error) {
        return new Response(`Proxy failed: ${error.message}`, { status: 500 });
      }
    }

    // For all other requests, fall back to serving the static assets
    return env.ASSETS.fetch(request);
  }
};
