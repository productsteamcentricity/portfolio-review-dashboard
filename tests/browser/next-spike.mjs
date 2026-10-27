#!/usr/bin/env node
// next-spike.mjs: the spike gates of the new app in a real browser (headless Edge or Chrome). Local only, not part of
// CI. Zero dependencies: Node 24's built-in WebSocket speaks the Chrome DevTools Protocol to the browser, through the
// small driver in tests/browser/lib/cdp.mjs (shared with the other browser checks).
//
//   npm run build && node tests/browser/next-spike.mjs [--browser <exe>] [--port 8102] [--json <file>]
//
// For the built page app/dist/index.html, opened from disk (file://) and served (http://127.0.0.1:<port>/next/):
//   1. the CSP lets the build's own script run: the shell renders, with no CSP violation, console error or exception;
//   2. the CSP blocks what it must: a fetch to the local server is refused (connect-src) and never reaches it; a copy
//      whose script hash is wrong does not run (negative control, from disk);
//   3. the nine section links, the banner, the MF Screener link; hash navigation switches the panel;
//   3a. keyboard and mouse (real input events): Enter or a click on any section link puts focus on that section's
//      heading, including the section already on screen and after the skip link (QA defect D1); each section link's
//      accessible name reads "<n> <title>" (for example "1 Uploads and inputs");
//   3b. the layout of D-037 at 1440, 1366, 1280 and 1024 px: the header pinned, the tabs in one row, a focused heading
//      and the skip link's target below the header at the end of a long section, focus moving through the header
//      (skip link included) without moving the page, a section address opened directly below the header (1440 x 400
//      and 1024 x 400), the current tab in view and every tab reached with the Tab key fully inside the row, a visible
//      focus ring on the black current tab; at 375 px nothing pinned, no sideways scroll of the page and a focused
//      heading 16 px from the top;
//   3c. (M1.4, the lead's revision R8 of PR #14's gates) at the same four widths, Shift+Tab pressed for real from a
//      control at the end of a long section walks back through the header without moving the page; the focus ring
//      has a contrast of 3:1 or more against the background it is drawn on, on the black current tab, on a sand tab
//      and on the MF Screener link; and a control in a section that is under the pinned header when it receives
//      focus with the Tab key is scrolled clear of the header (CONTROLS_UNDER_HEADER: a test-only button and section
//      1's own controls);
//   3d. (M1.4 fix round, L1) after a real click on each of the nine tabs from the end of a long section, at 1440 x 900
//      and 1366 x 768, the review bar sits at or below the pinned header's bottom and the focused heading is clear of
//      the header; at 375 px the review bar is 16 px from the top with the focused heading below it;
//   4. the page requests nothing but itself;
//   5. IndexedDB: a record written by the page is read back after a reload and after a browser restart with the
//      same profile (the store of the MF Screener data pack, D-026);
// a page built with a vendored library (synthetic fixture) and a JSON data block runs under its CSP; and (M1.4,
// D-038) the page built from tests/fixtures/next-build/uses-all-vendor.js, which carries the four real vendored
// libraries, from disk and served: each library runs under the CSP (a Chart.js pie with the datalabels plugin, a
// SheetJS workbook written and read back, a PptxGenJS deck with a native chart written to bytes and read back with
// JSZip) with no CSP violation, console warning or error, Promise and Array.prototype.includes are still the browser's
// own (core-js, inside PptxGenJS, has not replaced them), and the two Blob downloads of app/src/services/download.ts
// save exactly the page's bytes, with no request but the page.
// The browser runs with a fresh temporary profile, deleted at the end. Nothing leaves this machine.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { sleep, findBrowser, launch, openPage, allowDownloads, parseRgb, contrast } from './lib/cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(ROOT, 'app', 'dist', 'index.html');
const ALL_VENDOR_ENTRY = 'tests/fixtures/next-build/uses-all-vendor.js';

// Controls the "scrolled clear of the pinned header" gate (3c) focuses with the Tab key: a test-only button the gate
// injects into section 1, and section 1's own base-file input, Accept button and as-on date input (M1.4). Since the
// M1.4 fix round (L13) the Accept button is aria-disabled, not disabled, so it is tabbable before a file is read;
// tests/browser/overview.cdp.mjs repeats the gate with a file read.
const CONTROLS_UNDER_HEADER = ['.spike-control', '#base-file-input', '#accept-file', '#as-on-date'];

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

// Where the page is: the address, the panel on screen, the marked link and what has keyboard focus.
const WHERE = `(() => {
  const f = document.activeElement;
  return {
    hash: location.hash,
    heading: document.querySelector('#app h2')?.textContent.trim() ?? null,
    current: document.querySelector('nav a[aria-current="page"]')?.dataset.section ?? null,
    focused: !f || f === document.body ? 'body' : (f.id || f.getAttribute('data-section') || f.className || f.tagName),
  };
})()`;

// Puts keyboard focus on an element (as Tab would) and says whether it took it.
const FOCUS = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  el.focus();
  return document.activeElement === el;
})()`;

// The centre of an element, scrolled into view, in viewport coordinates (for a real mouse click).
const CENTRE = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()`;

// The layout (D-037): the header's position and bottom edge, the focused element's top, how many rows the section tabs
// take, and whether the page scrolls sideways.
const LAYOUT = `(() => {
  const header = document.querySelector('.app-header');
  const f = document.activeElement;
  const tops = [...document.querySelectorAll('nav a[data-section]')].map((a) => Math.round(a.getBoundingClientRect().top));
  return {
    width: innerWidth,
    header: getComputedStyle(header).position,
    headerBottom: Math.round(header.getBoundingClientRect().bottom),
    focused: !f || f === document.body ? 'body' : (f.id || f.tagName),
    focusedTop: f && f !== document.body ? Math.round(f.getBoundingClientRect().top) : null,
    headingTop: Math.round(document.querySelector('#app h2')?.getBoundingClientRect().top ?? -1),
    tabRows: new Set(tops).size,
    pageScrollsSideways: document.documentElement.scrollWidth > innerWidth,
    scrollY: Math.round(scrollY),
  };
})()`;

// Makes the section on screen long enough to scroll (a test-only spacer inside its panel), then scrolls to the end.
const LONG_AND_SCROLLED = `(() => {
  const panel = document.querySelector('#app .panel');
  if (!panel.querySelector('.spike-spacer')) {
    const spacer = document.createElement('div');
    spacer.className = 'spike-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.height = '3000px';
    panel.appendChild(spacer);
  }
  scrollTo(0, document.documentElement.scrollHeight);
  return Math.round(scrollY);
})()`;

// Moving focus into the header (each tab and the MF Screener link, as the Tab key would) must not scroll the page.
const HEADER_FOCUS_KEEPS_PLACE = `new Promise((r) => {
  const before = Math.round(scrollY);
  const links = [document.querySelector('a.skip-link'), ...document.querySelectorAll('header a')];
  const moved = [];
  let i = 0;
  const next = () => {
    if (i === links.length) { r({ before, after: Math.round(scrollY), moved, links: links.length }); return; }
    const a = links[i++];
    const y = scrollY;
    a.focus();
    requestAnimationFrame(() => { if (Math.abs(scrollY - y) > 1) moved.push(a.dataset.section || a.className); next(); });
  };
  next();
})`;

// The focused element, when it is a tab, is fully inside the visible part of the row.
const FOCUSED_TAB_INSIDE = `(() => {
  const a = document.activeElement;
  if (!a || !a.matches('.nav-sections a')) return { inside: false, focused: a ? (a.dataset.section || a.className || a.tagName) : null };
  const row = document.querySelector('.nav-sections').getBoundingClientRect();
  const t = a.getBoundingClientRect();
  return { section: a.dataset.section, inside: t.left >= row.left - 1 && t.right <= row.right + 1, tab: [Math.round(t.left), Math.round(t.right)], row: [Math.round(row.left), Math.round(row.right)] };
})()`;

// The current tab's focus ring against its background.
const CURRENT_TAB_RING = `(() => {
  const a = document.activeElement;
  const s = getComputedStyle(a);
  return { current: a.getAttribute('aria-current') === 'page', focusVisible: a.matches(':focus-visible'), outline: s.outlineColor, outlineWidth: parseFloat(s.outlineWidth), background: s.backgroundColor };
})()`;

// The current tab is inside the visible part of the tab row (the row may scroll sideways).
const CURRENT_TAB_VISIBLE = `(() => {
  const row = document.querySelector('.nav-sections').getBoundingClientRect();
  const a = document.querySelector('nav a[aria-current="page"]');
  const t = a.getBoundingClientRect();
  return { section: a.dataset.section, visible: t.left >= row.left - 1 && t.right <= row.right + 1, tab: [Math.round(t.left), Math.round(t.right)], row: [Math.round(row.left), Math.round(row.right)] };
})()`;

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

// (3c) A test-only button at the end of the section on screen (after the long spacer), focused: the start of a
// Shift+Tab walk back through the header.
const END_CONTROL = `(() => {
  const panel = document.querySelector('#app .panel');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'spike-end';
  b.textContent = 'End of the section (test only)';
  panel.appendChild(b);
  b.focus();
  return { focused: document.activeElement === b, scrollY: Math.round(scrollY) };
})()`;
const REMOVE_TEST_CONTROLS = `document.querySelectorAll('.spike-end, .spike-control').forEach((e) => e.remove())`;
// What has focus (a tab by its section, else its class) and where the page is.
const FOCUS_AND_SCROLL = `(() => {
  const f = document.activeElement;
  return { focused: !f || f === document.body ? 'body' : (f.dataset.section || f.className || f.tagName), scrollY: Math.round(scrollY) };
})()`;

// (3c) The focus ring of the focused element and the background it is drawn on: the element's own when the outline is
// drawn inside it (a negative offset, as on the tabs), else the first opaque background behind the element.
const FOCUS_RING = `(() => {
  const a = document.activeElement;
  const s = getComputedStyle(a);
  const offset = parseFloat(s.outlineOffset) || 0;
  const clear = (c) => c === 'transparent' || /^rgba\\(.*,\\s*0\\)$/.test(c);
  let el = offset < 0 ? a : a.parentElement;
  let background = null;
  while (el && !background) { const c = getComputedStyle(el).backgroundColor; if (!clear(c)) background = c; el = el.parentElement; }
  return {
    focused: a.dataset.section || a.className, current: a.getAttribute('aria-current') === 'page', focusVisible: a.matches(':focus-visible'),
    outline: s.outlineColor, outlineStyle: s.outlineStyle, outlineWidth: parseFloat(s.outlineWidth), offset,
    background: background || 'rgb(255, 255, 255)',
  };
})()`;

// (3c) Puts a control of the section under the pinned header and gives focus, without scrolling, to the element just
// before it in the Tab order, so that one real Tab press moves focus onto the control. The test-only control is
// injected into section 1 just below its summary.
const PLACE_UNDER_HEADER = (selector) => `(() => {
  const sel = ${JSON.stringify(selector)};
  if (sel === '.spike-control' && !document.querySelector(sel)) {
    const panel = document.querySelector('#app .panel');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spike-control';
    b.textContent = 'A control (test only)';
    (panel.querySelector('.panel-summary') || panel.firstElementChild).after(b);
  }
  const el = document.querySelector(sel);
  if (!el) return { found: false };
  const tabbable = [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')]
    .filter((e) => !e.disabled && e.tabIndex >= 0 && e.getClientRects().length > 0);
  const i = tabbable.indexOf(el);
  const before = i > 0 ? tabbable[i - 1] : null;
  const headerBottom = Math.round(document.querySelector('.app-header').getBoundingClientRect().bottom);
  scrollTo(0, Math.round(el.getBoundingClientRect().top + scrollY - headerBottom + 20));
  if (before) before.focus({ preventScroll: true });
  const top = Math.round(el.getBoundingClientRect().top);
  return { found: true, before: before ? (before.dataset.section || before.className || before.tagName) : null, headerBottom, top, under: top < headerBottom };
})()`;
// (L1, M1.4 fix round) Where the review bar and the section's heading are against the pinned header, and what has focus.
const REVIEW_BAR_PLACE = `(() => {
  const header = document.querySelector('.app-header').getBoundingClientRect();
  const bar = document.querySelector('.review-bar');
  const b = bar ? bar.getBoundingClientRect() : null;
  const h2 = document.querySelector('#app h2');
  const f = document.activeElement;
  return {
    headerBottom: Math.round(header.bottom),
    barTop: b ? Math.round(b.top) : null,
    barBottom: b ? Math.round(b.bottom) : null,
    heading: h2 ? h2.id : null,
    headingTop: h2 ? Math.round(h2.getBoundingClientRect().top) : null,
    focused: !f || f === document.body ? 'body' : (f.id || f.tagName),
    innerHeight,
    scrollY: Math.round(scrollY),
  };
})()`;
// The centre of a tab in the pinned header, without scrolling anything (a real click lands on it where it is).
const TAB_CENTRE = (id) => `(() => {
  const r = document.querySelector('nav a[data-section="${id}"]').getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()`;
const CONTROL_PLACE = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  return { focused: document.activeElement === el, top: Math.round(el.getBoundingClientRect().top), headerBottom: Math.round(document.querySelector('.app-header').getBoundingClientRect().bottom) };
})()`;

// The four-library page (D-038): the built-ins as the browser made them, kept before any page script runs, and
// compared after the libraries ran (core-js 2, bundled in PptxGenJS, replaces built-ins it judges broken, and also
// Function.prototype.toString, so "[native code]" alone would prove nothing).
const BUILT_INS = `{ Promise: window.Promise, includes: Array.prototype.includes, toString: Function.prototype.toString,
  from: Array.from, assign: Object.assign, Symbol: window.Symbol, Map: window.Map, Set: window.Set, WeakMap: window.WeakMap,
  stringIncludes: String.prototype.includes }`;
const NATIVE_PROBE = `window.__native = ${BUILT_INS};`;
const NATIVE_CHECK = `(() => {
  const was = window.__native;
  const now = ${BUILT_INS};
  const nativeText = (f) => was.toString.call(f).includes('[native code]');
  return {
    replaced: Object.keys(was).filter((k) => was[k] !== now[k]),
    promise: now.Promise === was.Promise && nativeText(now.Promise),
    includes: now.includes === was.includes && nativeText(now.includes),
  };
})()`;
const SPIKE_STATUS = `JSON.parse(document.getElementById('app').dataset.spike || '{}')`;

/** Serves one page at /fixture/ on 127.0.0.1 (the four-library page, served mode); nothing else. */
function fixtureServer(html) {
  const buf = Buffer.from(html, 'utf8');
  return http.createServer((req, res) => {
    if (!/^127\.0\.0\.1:\d+$/.test(String(req.headers.host || ''))) { res.writeHead(403); res.end(); return; }
    if (req.method !== 'GET' || req.url !== '/fixture/') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

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
  // The app script's hash is the last one in script-src (the vendored libraries come first): break that one.
  const badHash = html.replace(/(script-src [^;"]*)'sha256-[A-Za-z0-9+/]{43}='/, `$1'sha256-${'A'.repeat(43)}='`);
  const badFile = path.join(work, 'wrong-hash.html');
  fs.writeFileSync(badFile, badHash);
  const { buildNext } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'build.mjs')).href);
  const fixture = await buildNext({ entry: 'tests/fixtures/next-build/uses-vendor.js', vendorManifest: 'tests/fixtures/next-build/vendor/MANIFEST.json' });
  const fixtureFile = path.join(work, 'vendored.html');
  fs.writeFileSync(fixtureFile, fixture.html);
  // The page with the four real vendored libraries (D-038), from disk and served by a one-page server.
  const allVendor = await buildNext({ entry: ALL_VENDOR_ENTRY });
  const allVendorFile = path.join(work, 'all-vendor.html');
  fs.writeFileSync(allVendorFile, allVendor.html);
  const sectionIds = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'src', 'config', 'sections.json'), 'utf8')).sections.map((s) => s.id);

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
      await page.viewport(1440, 900);
      await page.navigate(mode.url);
      const s = await page.eval(STATE);
      expect('CSP is the first element of <head>', s.cspFirst);
      expect('the app script ran under the CSP (shell rendered)', s.ready && s.heading === '1 Uploads and inputs', s.heading);
      expect('no CSP violation, console error or exception on load',
        s.violations.length === 0 && page.console.length === 0 && page.exceptions.length === 0 && page.log.length === 0,
        { violations: s.violations, console: page.console, exceptions: page.exceptions, log: page.log });
      expect('nine section links, banner, sticky header (1440 x 900)', s.sectionLinks === 9 && s.banner && s.headerPosition === 'sticky',
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

      // Keyboard and mouse, with real input events (QA defect D1). Section 1 is on screen and the address is #uploads.
      const link = (id) => `nav a[data-section="${id}"]`;
      await page.eval(FOCUS(link('uploads')));
      await page.press('Enter');
      const k1 = await page.eval(WHERE);
      expect('Enter on the link of the section already on screen puts focus on its heading',
        k1.hash === '#uploads' && k1.heading === '1 Uploads and inputs' && k1.focused === 'uploads-title', k1);
      await page.click(await page.eval(CENTRE(link('uploads'))));
      const m1 = await page.eval(WHERE);
      expect('a click on the link of the section already on screen puts focus on its heading',
        m1.hash === '#uploads' && m1.focused === 'uploads-title', m1);
      const skipFocused = await page.eval(FOCUS('a.skip-link'));
      await page.press('Enter');
      const sk = await page.eval(WHERE);
      expect('the skip link moves focus to the section area', skipFocused && sk.hash === '#main' && sk.focused === 'main', sk);
      await page.eval(FOCUS(link('uploads')));
      await page.press('Enter');
      const k2 = await page.eval(WHERE);
      expect('after the skip link, Enter on the link of the section on screen puts focus on its heading',
        k2.hash === '#uploads' && k2.current === 'uploads' && k2.focused === 'uploads-title', k2);
      await page.eval(FOCUS('a.skip-link'));
      await page.press('Enter');
      await page.eval(FOCUS(link('taxation')));
      await page.press('Enter');
      const k3 = await page.eval(WHERE);
      expect('after the skip link, Enter on another section link shows it and puts focus on its heading',
        k3.hash === '#taxation' && k3.heading === '7 Taxation' && k3.current === 'taxation' && k3.focused === 'taxation-title', k3);
      await page.click(await page.eval(CENTRE(link('overview'))));
      const m2 = await page.eval(WHERE);
      expect('a click on another section link shows it and puts focus on its heading',
        m2.hash === '#overview' && m2.current === 'overview' && m2.focused === 'overview-title', m2);
      await page.eval(FOCUS(link('overview')));
      await page.press('Enter');
      const k4 = await page.eval(WHERE);
      expect('Enter again on the same link keeps focus on its heading', k4.hash === '#overview' && k4.focused === 'overview-title', k4);
      const names = await page.axNames('nav a[data-section]');
      const sectionsConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'src', 'config', 'sections.json'), 'utf8')).sections;
      expect('each section link\'s accessible name reads "<n> <title>", for example "1 Uploads and inputs"',
        JSON.stringify(names) === JSON.stringify(sectionsConfig.map((s) => `${s.n} ${s.title}`)), names);
      await page.eval(GOTO('uploads'));

      // The layout of D-037 at four laptop widths: the tabs in one row (or scrolling sideways in it), and a heading
      // focused at the end of a long section, or the target of the skip link, never under the pinned header.
      for (const [w, h] of [[1440, 900], [1366, 768], [1280, 800], [1024, 768]]) {
        await page.viewport(w, h);
        await page.eval(GOTO('uploads'));
        const l0 = await page.eval(LAYOUT);
        expect(`${w} px: the header is pinned, the tabs take one row and the page does not scroll sideways`,
          l0.header === 'sticky' && l0.tabRows === 1 && !l0.pageScrollsSideways, l0);
        await page.eval(LONG_AND_SCROLLED);
        await page.eval(FOCUS(link('uploads')));
        await page.press('Enter');
        const l1 = await page.eval(LAYOUT);
        expect(`${w} px: after Enter at the end of a long section, its focused heading sits below the header`,
          l1.focused === 'uploads-title' && l1.focusedTop >= l1.headerBottom, l1);
        await page.eval(LONG_AND_SCROLLED);
        await page.eval(FOCUS('a.skip-link'));
        await page.press('Enter');
        const l2 = await page.eval(LAYOUT);
        expect(`${w} px: the skip link brings the section below the header`,
          l2.focused === 'main' && l2.headingTop >= l2.headerBottom, l2);
        await page.eval(LONG_AND_SCROLLED);
        const hf = await page.eval(HEADER_FOCUS_KEEPS_PLACE);
        expect(`${w} px: moving focus through the header's links keeps the page where it was`,
          hf.moved.length === 0 && Math.abs(hf.after - hf.before) <= 1 && hf.links === 11, hf);
        // R8: the same walk with real keys, Shift+Tab from a control at the end of the long section back through the
        // nine tabs, the MF Screener link and the skip link; the page must not move at any step. The walk runs on a
        // section with no control of its own (section 9 in M1.4): from section 1 it would first walk back through the
        // section's own inputs (M1.4), which rightly scroll into view.
        await page.eval(GOTO('annexure'));
        await page.eval(LONG_AND_SCROLLED);
        const start = await page.eval(END_CONTROL);
        const walk = [];
        for (let k = 0; k < 11; k++) {
          await page.press('Tab', { shift: true });
          walk.push(await page.eval(FOCUS_AND_SCROLL));
        }
        await page.eval(REMOVE_TEST_CONTROLS);
        const wantOrder = [...sectionIds].reverse().concat(['nav-external', 'skip-link']);
        const moved = walk.filter((x) => Math.abs(x.scrollY - start.scrollY) > 1);
        expect(`${w} px: Shift+Tab (real keys) from the end of a long section back through the header keeps the page where it was`,
          start.focused && JSON.stringify(walk.map((x) => x.focused)) === JSON.stringify(wantOrder) && moved.length === 0,
          { start: start.scrollY, walk: walk.map((x) => `${x.focused}@${x.scrollY}`) });
      }
      // L1 (M1.4 fix round): a real click on each tab, from the end of a long section, at 1440 x 900 and 1366 x 768: the
      // review bar sits at or below the pinned header's bottom, and the focused heading under it is clear of the header.
      for (const [w, h] of [[1440, 900], [1366, 768]]) {
        await page.viewport(w, h);
        const placed = [];
        for (const id of sectionIds) {
          await page.eval(LONG_AND_SCROLLED);
          await page.click(await page.eval(TAB_CENTRE(id)));
          placed.push({ id, ...(await page.eval(REVIEW_BAR_PLACE)) });
        }
        const bad = placed.filter((p) => !(p.focused === `${p.id}-title` && p.heading === `${p.id}-title` && p.barTop !== null
          && p.barTop >= p.headerBottom && p.headingTop >= p.headerBottom));
        expect(`${w} px: a real click on each of the nine tabs shows the review bar below the pinned header and the focused heading clear of it (L1)`,
          placed.length === 9 && bad.length === 0, bad.length ? bad : placed.map((p) => `${p.id}: bar ${p.barTop} >= header ${p.headerBottom}, h2 ${p.headingTop}`).join('; '));
      }
      // A bookmarked section address, opened in a short window: its heading lands below the pinned header.
      for (const w of [1440, 1024]) {
        await page.viewport(w, 400);
        await page.navigate('about:blank'); // a new document, so the load event fires
        await page.navigate(`${mode.url}#annexure`);
        const bm = await page.eval(LAYOUT);
        expect(`a section address opened directly (${w} x 400) shows its heading below the header`,
          bm.headingTop >= bm.headerBottom, bm);
      }
      // Where the tab row scrolls sideways, the current tab is in view.
      await page.viewport(1024, 768);
      await page.navigate('about:blank'); // a new document, so the load event fires
      await page.navigate(`${mode.url}#annexure`);
      const cv = await page.eval(CURRENT_TAB_VISIBLE);
      expect('1024 px: opening the Annexure address scrolls the tab row to show its tab', cv.section === 'annexure' && cv.visible, cv);
      await page.eval(GOTO('market-updates'));
      const cv2 = await page.eval(CURRENT_TAB_VISIBLE);
      expect('1024 px: hash navigation keeps the current tab in view', cv2.section === 'market-updates' && cv2.visible, cv2);
      // The Tab key through the row: every focused tab fully inside the row (real key presses).
      await page.eval(GOTO('uploads'));
      await page.eval(FOCUS('a.nav-external'));
      const outside = [];
      for (let k = 0; k < 9; k++) {
        await page.press('Tab');
        const ft = await page.eval(FOCUSED_TAB_INSIDE);
        if (!ft.inside) outside.push(ft);
      }
      expect('1024 px: each tab reached with the Tab key is fully inside the row', outside.length === 0, outside);
      // The focus ring on the black current tab differs from the tab (real key presses: skip link, Screener, tab 1).
      await page.viewport(1440, 900);
      await page.eval(GOTO('uploads'));
      await page.eval(FOCUS('a.skip-link'));
      await page.press('Tab');
      await page.press('Tab');
      const ring = await page.eval(CURRENT_TAB_RING);
      expect('the focused current tab shows a focus ring that differs from its background',
        ring.current && ring.focusVisible && ring.outline !== ring.background && ring.outlineWidth > 0, ring);
      // R8: the focus ring's contrast against the background it is drawn on, 3:1 or more (WCAG 2.4.13 and 1.4.11): on
      // the black current tab (goldRing on ink, about 8.1:1), on a sand tab (ink on sand, about 18:1, the mouse moved
      // away so the tab is not in its hover colour) and on the MF Screener link (gold on the black masthead).
      const ringContrast = (r) => {
        const o = parseRgb(r.outline);
        const b = parseRgb(r.background);
        return o && b ? Math.round(contrast(o, b) * 100) / 100 : 0;
      };
      const ringCurrent = await page.eval(FOCUS_RING);
      const cCurrent = ringContrast(ringCurrent);
      expect('the focus ring on the black current tab has a contrast of 3:1 or more against the tab',
        ringCurrent.current && ringCurrent.focusVisible && ringCurrent.outlineStyle !== 'none' && ringCurrent.background === 'rgb(0, 0, 0)' && cCurrent >= 3,
        { ...ringCurrent, contrast: cCurrent });
      await page.hover({ x: 720, y: 880 });
      await page.press('Tab');
      const ringSand = await page.eval(FOCUS_RING);
      const cSand = ringContrast(ringSand);
      expect('the focus ring on a sand tab has a contrast of 3:1 or more against the tab',
        ringSand.focused === 'overview' && !ringSand.current && ringSand.focusVisible && ringSand.outlineStyle !== 'none'
          && ringSand.background === 'rgb(244, 238, 230)' && cSand >= 3,
        { ...ringSand, contrast: cSand });
      await page.eval(FOCUS('a.skip-link'));
      await page.press('Tab');
      const ringLink = await page.eval(FOCUS_RING);
      const cLink = ringContrast(ringLink);
      expect('the focus ring on the MF Screener link has a contrast of 3:1 or more against the masthead',
        ringLink.focused === 'nav-external' && ringLink.focusVisible && ringLink.outlineStyle !== 'none' && cLink >= 3,
        { ...ringLink, contrast: cLink });
      // R8: a control in a section, under the pinned header when the Tab key gives it focus, is scrolled clear of the
      // header (the scroll-margin-top rule of D-037 for controls in #main).
      for (const [w, h] of [[1440, 900], [1024, 768]]) {
        await page.viewport(w, h);
        await page.eval(GOTO('uploads'));
        await page.eval(LONG_AND_SCROLLED);
        for (const selector of CONTROLS_UNDER_HEADER) {
          const placed = await page.eval(PLACE_UNDER_HEADER(selector));
          await page.press('Tab');
          const after = placed.found ? await page.eval(CONTROL_PLACE(selector)) : null;
          expect(`${w} px: a control (${selector}) under the pinned header when Tab gives it focus is scrolled clear of the header`,
            placed.found && placed.under && after.focused && after.top >= after.headerBottom, { placed, after });
        }
        await page.eval(REMOVE_TEST_CONTROLS);
      }
      await page.viewport(1440, 900);
      await page.navigate('about:blank'); // a new document, so the load event fires
      await page.navigate(mode.url);
      await page.viewport(1280, 800);
      await page.eval(GOTO('uploads'));
      const one = await page.eval(LAYOUT);
      expect('1280 px: the nine tabs fit in one row without scrolling (D-037)',
        one.tabRows === 1 && (await page.eval(`(() => { const o = document.querySelector('.nav-sections'); return o.scrollWidth <= o.clientWidth; })()`)), one);
      await page.viewport(375, 812, true);
      await page.eval(GOTO('uploads'));
      const ph = await page.eval(LAYOUT);
      expect('375 px: nothing is pinned and the page does not scroll sideways', ph.header === 'static' && !ph.pageScrollsSideways, ph);
      await page.eval(GOTO('taxation'));
      await page.eval(LONG_AND_SCROLLED);
      await page.eval(FOCUS(link('taxation')));
      await page.press('Enter');
      const ph2 = await page.eval(REVIEW_BAR_PLACE);
      // Nothing is pinned at 375 px: the review bar above the section is placed 16 px from the top (L1), and the
      // focused heading under it, with its ring, is in view.
      expect('375 px: Enter on a tab at the end of a long section puts the review bar 16 px from the top and its focused heading below it, in view',
        ph2.focused === 'taxation-title' && ph2.barTop >= 12 && ph2.barTop <= 20 && ph2.headingTop >= ph2.barBottom
          && ph2.headingTop + 40 <= ph2.innerHeight, ph2);
      await page.viewport(1440, 900);
      await page.eval(GOTO('uploads'));

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

    // The four real libraries (D-038), from disk and served by a one-page server.
    const fxServer = fixtureServer(allVendor.html);
    await new Promise((r) => fxServer.listen(0, '127.0.0.1', r));
    try {
      const allModes = [
        { name: 'from disk', slug: 'disk', url: pathToFileURL(allVendorFile).href },
        { name: 'served', slug: 'served', url: `http://127.0.0.1:${fxServer.address().port}/fixture/` },
      ];
      for (const mode of allModes) {
        console.log(`\n=== the four vendored libraries, ${mode.name}: ${mode.url} ===`);
        const p = await openPage(browser.cdp);
        await p.addInitScript(NATIVE_PROBE);
        await p.viewport(1440, 900);
        await p.navigate(mode.url);
        let st = {};
        for (let t = 0; t < 80 && !st.done && !st.error; t++) {
          st = await p.eval(SPIKE_STATUS);
          if (!st.done && !st.error) await sleep(250);
        }
        expect(`${mode.name}: Chart.js with datalabels, SheetJS, PptxGenJS and JSZip run under the CSP (a pie, a workbook read back, a deck with a chart read back)`,
          st.done && !st.error && st.globals === 'function,object,object,function,function' && st.chart === 2 && st.sheetjs === 'Sheet1 2' && st.pptx === 1, st);
        const violations = await p.eval('window.__cspv.slice()');
        expect(`${mode.name}: no CSP violation, console warning or error, or exception with the four libraries`,
          violations.length === 0 && p.console.length === 0 && p.exceptions.length === 0 && p.log.length === 0,
          { violations, console: p.console, exceptions: p.exceptions, log: p.log });
        const loadRequests = p.requests.filter((u) => !/^(?:data|blob):/.test(u));
        expect(`${mode.name}: the four-library page requested nothing but itself`, loadRequests.length === 1 && loadRequests[0] === mode.url, p.requests);
        const native = await p.eval(NATIVE_CHECK);
        expect(`${mode.name}: Promise and Array.prototype.includes are still the browser's own after the libraries ran (core-js)`,
          native.promise && native.includes, native);
        expect(`${mode.name}: built-ins the libraries replaced (information)`, true, native.replaced);
        // Blob downloads through app/src/services/download.ts, clicked with the mouse.
        const nextDownload = await allowDownloads(browser.cdp, path.join(work, `downloads-${mode.slug}`));
        const before = p.requests.length;
        for (const [button, fileName] of [['#download-xlsx', 'spike.xlsx'], ['#download-pptx', 'spike.pptx']]) {
          const done = nextDownload();
          await p.click(await p.eval(CENTRE(button)));
          let dl;
          try { dl = await done; } catch { dl = { state: 'no download within 20 s', name: null, file: null }; }
          await sleep(200);
          const want = Buffer.from(await p.eval(`window.__spikeFiles[${JSON.stringify(fileName)}]`), 'base64');
          const got = dl.file && fs.existsSync(dl.file) ? fs.readFileSync(dl.file) : null;
          expect(`${mode.name}: the Blob download saves ${fileName} with exactly the page's bytes`,
            dl.state === 'completed' && dl.name === fileName && got !== null && got.equals(want),
            { state: dl.state, name: dl.name, bytes: got ? got.length : null, expected: want.length });
        }
        const during = p.requests.slice(before);
        expect(`${mode.name}: the downloads made no request (Blob URLs only)`, during.every((u) => /^(?:blob|data):/.test(u)), during);
      }
    } finally {
      fxServer.close();
    }

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
