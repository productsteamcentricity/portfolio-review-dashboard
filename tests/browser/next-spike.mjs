#!/usr/bin/env node
// next-spike.mjs: the M1.2 spike gates in a real browser (headless Edge or Chrome). Local only, not part of CI.
// Zero dependencies: Node 24's built-in WebSocket speaks the Chrome DevTools Protocol to the browser.
//
//   npm run build && node tests/browser/next-spike.mjs [--browser <exe>] [--port 8102] [--json <file>]
//
// For the built page app/dist/index.html, opened from disk (file://) and served (http://127.0.0.1:<port>/next/):
//   1. the CSP lets the build's own script run: the shell renders, with no CSP violation, console error or exception;
//   2. the CSP blocks what it must: a fetch to the local server is refused (connect-src) and never reaches it; a copy
//      whose script hash is wrong does not run (negative control, from disk);
//   3. the nine section links, the banner, the MF Screener link; hash navigation switches the panel;
//   4. the page requests nothing but itself;
//   5. IndexedDB: a record written by the page is read back after a reload and after a browser restart with the
//      same profile (the store of the MF Screener data pack, D-026);
// and a page built with a vendored library (synthetic fixture) and a JSON data block runs under its CSP.
// The browser runs with a fresh temporary profile, deleted at the end. Nothing leaves this machine.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(ROOT, 'app', 'dist', 'index.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser(explicit) {
  const candidates = [
    explicit, process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) throw new Error('no Chromium-based browser found; pass --browser <exe>');
  return found;
}

// ---------------------------------------------------------------------------------------------------------------
// A minimal DevTools Protocol client

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`)); else p.resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      setTimeout(() => { if (this.pending.delete(id)) reject(new Error(`${method}: timed out`)); }, 20000);
    });
  }

  waitFor(pred, ms = 20000) {
    return new Promise((resolve, reject) => {
      const l = (msg) => { if (pred(msg)) { this.listeners.delete(l); resolve(msg); } };
      this.listeners.add(l);
      setTimeout(() => { if (this.listeners.delete(l)) reject(new Error('event timed out')); }, ms);
    });
  }
}

async function launch(exe, profile) {
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--disable-sync',
    '--disable-component-update', '--disable-default-apps', '--mute-audio', 'about:blank'];
  // The browser writes its debugging port to <profile>/DevToolsActivePort. Edge's launcher may hand over to a
  // separate process and exit at once, so the file, not the child process, says when the browser is ready.
  const portFile = path.join(profile, 'DevToolsActivePort');
  fs.rmSync(portFile, { force: true });
  const proc = spawn(exe, args, { stdio: 'ignore', windowsHide: true, detached: false });
  proc.on('error', () => { /* reported by the timeout below */ });
  let wsUrl = null;
  for (let waited = 0; waited < 30000 && !wsUrl; waited += 200) {
    await sleep(200);
    if (fs.existsSync(portFile)) {
      const [port, p] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
      if (port && p) wsUrl = `ws://127.0.0.1:${port.trim()}${p.trim()}`;
    }
  }
  if (!wsUrl) throw new Error('the browser did not open its debugging port within 30 s');
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('cannot connect to the browser')); });
  const closed = new Promise((r) => ws.addEventListener('close', r));
  const cdp = new Cdp(ws);
  return {
    cdp,
    async close() {
      cdp.send('Browser.close').catch(() => { /* the connection closes as the browser exits */ });
      await Promise.race([closed, sleep(10000)]);
      await sleep(1500); // let the browser release the profile before it is reused or deleted
    },
  };
}

const PROBE = `window.__cspv = [];
document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(e.effectiveDirective || e.violatedDirective));`;

async function openPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const page = { sessionId, requests: [], console: [], exceptions: [], log: [] };
  cdp.listeners.add((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Network.requestWillBeSent') page.requests.push(msg.params.request.url);
    if (msg.method === 'Runtime.consoleAPICalled' && /error|warn/.test(msg.params.type)) {
      page.console.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') page.exceptions.push(msg.params.exceptionDetails.text);
    if (msg.method === 'Log.entryAdded' && /error|warning/.test(msg.params.entry.level)) page.log.push(msg.params.entry.text);
  });
  for (const d of ['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable']) await cdp.send(d, {}, sessionId);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE }, sessionId);
  page.navigate = async (url) => {
    page.requests.length = 0;
    const loaded = cdp.waitFor((m) => m.sessionId === sessionId && m.method === 'Page.loadEventFired');
    await cdp.send('Page.navigate', { url }, sessionId);
    await loaded;
    await sleep(400);
  };
  page.reload = async () => {
    const loaded = cdp.waitFor((m) => m.sessionId === sessionId && m.method === 'Page.loadEventFired');
    await cdp.send('Page.reload', { ignoreCache: true }, sessionId);
    await loaded;
    await sleep(400);
  };
  page.eval = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) throw new Error(`evaluate: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
    return r.result.value;
  };
  return page;
}

// ---------------------------------------------------------------------------------------------------------------
// Page probes (evaluated in the page; the CDP evaluation itself is not subject to the page's CSP)

const STATE = `(() => {
  const a = document.querySelector('a.nav-external');
  return {
    ready: document.getElementById('app')?.dataset.ready === 'true',
    heading: document.querySelector('#app h2')?.textContent.trim() ?? null,
    current: document.querySelector('nav a[aria-current="page"]')?.dataset.section ?? null,
    sectionLinks: document.querySelectorAll('nav a[data-section]').length,
    banner: (document.getElementById('preview-banner')?.textContent ?? '').includes('Preview, not for client use'),
    headerPosition: getComputedStyle(document.querySelector('.app-header')).position,
    screener: a ? { href: a.getAttribute('href'), target: a.target, rel: a.rel } : null,
    font: getComputedStyle(document.body).fontFamily,
    cspFirst: document.head.firstElementChild?.getAttribute('http-equiv') === 'Content-Security-Policy',
    violations: (window.__cspv || []).slice(),
  };
})()`;

const GOTO = (id) => `new Promise((r) => { location.hash = '#${id}'; setTimeout(() => r({
  heading: document.querySelector('#app h2')?.textContent.trim() ?? null,
  current: document.querySelector('nav a[aria-current="page"]')?.dataset.section ?? null,
  focused: document.activeElement?.id ?? null,
  title: document.title,
  slot: document.getElementById('slot-screener-pack')?.textContent ?? null,
}), 300); })`;

const FETCH_PROBE = (url) => `new Promise((r) => {
  const before = (window.__cspv || []).length;
  fetch(${JSON.stringify(url)}).then(
    () => r({ result: 'allowed', violations: (window.__cspv || []).slice(before) }),
    (e) => setTimeout(() => r({ result: 'blocked: ' + e.message, violations: (window.__cspv || []).slice(before) }), 300));
})`;

const IDB_WRITE = (token) => `new Promise((res) => {
  try {
    const rq = indexedDB.open('prd.next.spike', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
    rq.onerror = () => res({ ok: false, error: String(rq.error) });
    rq.onsuccess = () => {
      const db = rq.result;
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(${JSON.stringify(token)}, 'probe');
      tx.oncomplete = () => { db.close(); res({ ok: true }); };
      tx.onerror = () => res({ ok: false, error: String(tx.error) });
    };
  } catch (e) { res({ ok: false, error: String(e) }); }
})`;

const IDB_READ = `new Promise((res) => {
  try {
    const rq = indexedDB.open('prd.next.spike', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
    rq.onerror = () => res({ ok: false, error: String(rq.error) });
    rq.onsuccess = () => {
      const db = rq.result;
      const g = db.transaction('kv', 'readonly').objectStore('kv').get('probe');
      g.onsuccess = () => { db.close(); res({ ok: true, value: g.result ?? null }); };
      g.onerror = () => res({ ok: false, error: String(g.error) });
    };
  } catch (e) { res({ ok: false, error: String(e) }); }
})`;

const STORAGE_INFO = `(async () => ({
  origin: location.origin,
  persisted: navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null,
  quotaMB: navigator.storage && navigator.storage.estimate ? Math.round(((await navigator.storage.estimate()).quota || 0) / 1048576) : null,
}))()`;

// ---------------------------------------------------------------------------------------------------------------

async function main(argv) {
  const opt = { port: 8102, json: null, browser: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') opt.port = Number(argv[++i]);
    else if (argv[i] === '--json') opt.json = argv[++i];
    else if (argv[i] === '--browser') opt.browser = argv[++i];
  }
  if (!fs.existsSync(DIST)) throw new Error('app/dist/index.html not found: run npm run build first');
  const exe = findBrowser(opt.browser);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-next-spike-'));
  const results = [];
  const expect = (name, ok, detail) => {
    results.push({ name, ok: Boolean(ok), detail });
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
  };

  // The local server, recording every request it receives.
  const { createServer } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'serve.mjs')).href);
  const received = [];
  const server = createServer(opt.port);
  server.on('request', (req) => received.push(req.url));
  await new Promise((r) => server.listen(opt.port, '127.0.0.1', r));
  let browser = null;
  try {
    return await runSpike({ exe, work, opt, received, expect, results, setBrowser: (b) => { browser = b; } });
  } finally {
    if (browser) await browser.close();
    server.close();
    await sleep(500);
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* the browser may still hold a file */ }
  }
}

async function runSpike({ exe, work, opt, received, expect, results, setBrowser }) {
  // The negative control (wrong script hash) and the vendored-library fixture page.
  const html = fs.readFileSync(DIST, 'utf8');
  const badHash = html.replace(/script-src 'sha256-[A-Za-z0-9+/]{43}='/, `script-src 'sha256-${'A'.repeat(43)}='`);
  const badFile = path.join(work, 'wrong-hash.html');
  fs.writeFileSync(badFile, badHash);
  const { buildNext } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'build.mjs')).href);
  const fixture = await buildNext({ entry: 'tests/fixtures/next-build/uses-vendor.js', vendorManifest: 'tests/fixtures/next-build/vendor/MANIFEST.json' });
  const fixtureFile = path.join(work, 'vendored.html');
  fs.writeFileSync(fixtureFile, fixture.html);

  const profile = path.join(work, 'profile');
  const modes = [
    { name: 'from disk', url: pathToFileURL(DIST).href },
    { name: 'served', url: `http://127.0.0.1:${opt.port}/next/` },
  ];
  console.log(`browser: ${exe}`);
  let browser = await launch(exe, profile);
  setBrowser(browser);
  {
    for (const mode of modes) {
      console.log(`\n=== ${mode.name}: ${mode.url} ===`);
      const page = await openPage(browser.cdp);
      received.length = 0;
      await page.navigate(mode.url);
      const s = await page.eval(STATE);
      expect('CSP is the first element of <head>', s.cspFirst);
      expect('the app script ran under the CSP (shell rendered)', s.ready && s.heading === '1 Uploads and inputs', s.heading);
      expect('no CSP violation, console error or exception on load',
        s.violations.length === 0 && page.console.length === 0 && page.exceptions.length === 0 && page.log.length === 0,
        { violations: s.violations, console: page.console, exceptions: page.exceptions, log: page.log });
      expect('nine section links, banner, sticky header', s.sectionLinks === 9 && s.banner && s.headerPosition === 'sticky',
        { links: s.sectionLinks, banner: s.banner, header: s.headerPosition });
      expect('MF Screener link opens a new tab without opener or referrer',
        s.screener && s.screener.target === '_blank' && s.screener.rel === 'noopener noreferrer', s.screener);
      expect('Cambria is the body font', /^Cambria/.test(s.font), s.font);
      expect('section 1 is marked current', s.current === 'uploads', s.current);
      const pageRequests = page.requests.filter((u) => !u.startsWith('data:'));
      expect('the page requested nothing but itself', pageRequests.length === 1 && pageRequests[0] === mode.url, page.requests);
      if (mode.name === 'served') expect('the server received only the page', received.join(',') === '/next/', received);

      const tax = await page.eval(GOTO('taxation'));
      expect('hash navigation shows section 7 and marks it current, focus on its heading',
        tax.heading === '7 Taxation' && tax.current === 'taxation' && tax.focused === 'taxation-title', tax);
      const up = await page.eval(GOTO('uploads'));
      expect('section 1 shows the MF Screener data pack slot (M10)', up.slot && up.slot.includes('MF Screener data pack') && up.slot.includes('M10'));

      received.length = 0;
      const f = await page.eval(FETCH_PROBE(`http://127.0.0.1:${opt.port}/probe`));
      await sleep(200);
      expect('a fetch is refused by connect-src and never reaches the server',
        f.result !== 'allowed' && f.violations.includes('connect-src') && !received.includes('/probe'), { ...f, received });

      const token = `spike-${mode.name}-${process.pid}`;
      const w = await page.eval(IDB_WRITE(token));
      expect('IndexedDB: the page can write a record', w.ok, w);
      await page.reload();
      const r1 = await page.eval(IDB_READ);
      expect('IndexedDB: the record survives a reload', r1.ok && r1.value === token, r1);
      const info = await page.eval(STORAGE_INFO);
      expect('storage origin and quota (information)', true, info);
      mode.token = token;
    }

    console.log('\n=== negative control and vendored fixture (from disk) ===');
    const page = await openPage(browser.cdp);
    await page.navigate(pathToFileURL(badFile).href);
    const bad = await page.eval(STATE);
    expect('a wrong script hash stops the script (CSP enforced)', !bad.ready && bad.violations.some((v) => /^script-src/.test(v)), bad.violations);
    await page.navigate(pathToFileURL(fixtureFile).href);
    const fx = await page.eval('({ vendor: document.body.dataset.vendor, channel: document.body.dataset.channel, violations: window.__cspv.slice() })');
    expect('a vendored library and a JSON data block run under the CSP',
      fx.vendor === 'hello from the vendored fixture' && fx.channel === 'preview' && fx.violations.length === 0, fx);

    console.log('\n=== browser restart with the same profile ===');
    await browser.close();
    setBrowser(null);
    browser = await launch(exe, profile);
    setBrowser(browser);
    for (const mode of modes) {
      const p = await openPage(browser.cdp);
      await p.navigate(mode.url);
      const r2 = await p.eval(IDB_READ);
      expect(`IndexedDB (${mode.name}): the record survives a browser restart`, r2.ok && r2.value === mode.token, r2);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nnext-spike: ${results.length - failed.length} of ${results.length} passed`);
  if (opt.json) fs.writeFileSync(opt.json, `${JSON.stringify({ browser: path.basename(exe), results }, null, 2)}\n`);
  return failed.length ? 1 : 0;
}

main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err) => {
  console.error(`next-spike: ${err && err.stack ? err.stack : err}`);
  process.exitCode = 2;
});
