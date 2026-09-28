// Local stand-in for Vercel: serves dist/ and runs dist/api/*.js handlers.
const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, "..");
const PORT = +process.env.PORT || 8787;
const NO_API = !!process.env.NO_API;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    if (NO_API) { res.writeHead(404); return res.end('no api'); }
    const f = path.join(DIST, url.pathname + '.js');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    delete require.cache[require.resolve(f)];
    const handler = require(f);
    const shim = Object.assign(res, {
      status(c) { res.statusCode = c; return shim; },
      json(o) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); },
    });
    try { await handler(req, shim); } catch (e) { res.statusCode = 500; res.end(String(e)); }
    return;
  }
  const f = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('dev server on ' + PORT + (NO_API ? ' (no api)' : '')));
