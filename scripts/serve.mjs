#!/usr/bin/env node
// serve.mjs: local preview of the two pages as GitHub Pages publishes them (D-024). No dependencies.
//
//   node scripts/serve.mjs [port]        default 8100  ->  http://127.0.0.1:8100/ (legacy) and /next/ (new)
//
// Binds to 127.0.0.1 only. Serves exactly two files: the legacy index.html at / and the built new app
// (app/dist/index.html, from "npm run build") at /next/. Nothing else in the repository is reachable. Requests must
// name this machine (Host 127.0.0.1 or localhost on this port), so a page that re-points its own domain at
// 127.0.0.1 (DNS rebinding) cannot read the files. No extra security header is sent: Pages sends none, so the
// page's own CSP meta tag is what is tested here.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Maps a request path to a repository file, or a redirect, or null (404). */
export function route(pathname) {
  if (pathname === '/' || pathname === '/index.html') return { file: path.join(ROOT, 'index.html') };
  if (pathname === '/next') return { redirect: '/next/' };
  if (pathname === '/next/' || pathname === '/next/index.html') return { file: path.join(ROOT, 'app', 'dist', 'index.html') };
  return null;
}

export function createServer(port) {
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  return http.createServer((req, res) => {
    if (!hosts.includes(String(req.headers.host || '').toLowerCase())) { res.writeHead(403); res.end('forbidden'); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { res.writeHead(400); res.end('bad request'); return; }
    const r = route(pathname);
    if (!r) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found'); return; }
    if (r.redirect) { res.writeHead(301, { Location: r.redirect }); res.end(); return; }
    fs.readFile(r.file, (err, buf) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(pathname.startsWith('/next') ? 'not built yet: run "npm run build"' : 'not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : buf);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || process.env.PORT || 8100);
  createServer(port).listen(port, '127.0.0.1', () => {
    console.log(`serve: http://127.0.0.1:${port}/ (legacy index.html) and http://127.0.0.1:${port}/next/ (new app)`);
  });
}
