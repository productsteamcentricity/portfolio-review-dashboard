/* ============================================================================
   serve-dashboard.js — local preview server for index.html. No dependencies.
   Binds to 127.0.0.1 only, so nothing else on the network can reach it.

     node serve-dashboard.js [port]        ->  http://127.0.0.1:8099/

   Recreated at the Oct 2026 handover (the original was not transferred), on
   the same address and port the handover documents. Opening index.html by
   double-click works too; this exists so a browser pane can load it over http.
   ========================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 8099);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (e) { res.writeHead(400); return res.end('bad request'); }
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, path.normalize(rel));
  /* stay inside the repo, never serve dot-folders (.git, .claude), refuse NUL bytes
     (a NUL in the path makes fs throw synchronously and would stop the server) */
  if (rel.indexOf('\0') >= 0 || !file.startsWith(ROOT + path.sep) || /[\\/]\./.test(rel)) {
    res.writeHead(403); return res.end('forbidden');
  }
  try {
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'        /* always serve the file as it is on disk now */
      });
      res.end(buf);
    });
  } catch (e) { res.writeHead(400); res.end('bad request'); }
}).listen(PORT, '127.0.0.1', () => console.log('Dashboard: http://127.0.0.1:' + PORT + '/'));
