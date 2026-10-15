/* ============================================================================
   serve-dashboard.js — local preview server for index.html. No dependencies.
   Binds to 127.0.0.1 only, so nothing else on the network can reach it.

     node tools/serve-dashboard.js [port]  ->  http://127.0.0.1:8099/
     or double-click tools/open-dashboard.cmd (starts this if needed, opens the browser)

   Recreated at the Oct 2026 handover (the original was not transferred), on
   the same address and port the handover documents. Opening index.html by
   double-click works too; this exists so a browser pane can load it over http.
   The server runs only while its window (or the Claude session) is open.

   It serves exactly two things: the dashboard (/ and /index.html) and the
   synthetic test files in test-data/ (the browser checks fetch them). Nothing
   else in the repository is reachable — in particular not buildtools/out/,
   which holds licensed vendor data and refresh snapshots. Requests must name
   this machine (Host 127.0.0.1 or localhost on this port), so a web page that
   re-points its own domain at 127.0.0.1 (DNS rebinding) cannot read files.
   ========================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');   /* the repository root, where index.html lives */
const PORT = Number(process.argv[2] || process.env.PORT || 8099);
const HOSTS = ['127.0.0.1:' + PORT, 'localhost:' + PORT];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

http.createServer((req, res) => {
  if (HOSTS.indexOf(String(req.headers.host || '').toLowerCase()) < 0) { res.writeHead(403); return res.end('forbidden'); }
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (e) { res.writeHead(400); return res.end('bad request'); }
  if (rel === '/') rel = '/index.html';
  /* the dashboard, or one file directly inside test-data/ (no sub-folders, no dot-files, no NUL) */
  const ok = rel === '/index.html' || /^\/test-data\/[^\\/\0]+$/.test(rel) && !/\/\./.test(rel);
  if (!ok) { res.writeHead(404); return res.end('not found'); }
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'        /* always serve the file as it is on disk now */
    });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => console.log('Dashboard: http://127.0.0.1:' + PORT + '/'));
