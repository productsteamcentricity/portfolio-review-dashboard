#!/usr/bin/env node
// covers: U-13 U-25 W-2 (the transactions (IRR) slot of section 1 and the returns of section 4, M3a wiring, NB-03)
// irr-slot.cdp.mjs: the IRR slot of section 1 and the scope picker of section 4 in a real browser (headless Edge or
// Chrome), driven with real keys through tests/browser/lib/cdp.mjs, as overview.cdp.mjs is. Local only, not part of
// CI. Synthetic files only (syn-standard from tests/fixtures/make-books.ts, irr-matched from
// tests/fixtures/make-irr-files.ts), written to a temporary folder and deleted at the end; nothing leaves this machine.
//
//   npm run build && node tests/browser/irr-slot.cdp.mjs [--served | --file | --url <url>] [--port 8162]
//                                                        [--browser <exe>] [--json <file>]
//
// Without a mode it runs served by scripts/serve.mjs (http://127.0.0.1:<port>/next/; port 8162 by default, used by no
// other script); --file opens app/dist/index.html from disk, --url one address (the Pages preview after a deploy).
//
// Checks:
//   1. the page loads under its CSP with no violation, console error or exception, and requests nothing but itself;
//   2. before a base file the IRR slot waits: "Waiting for the base file", its input disabled, the reason shown, and
//      its Accept not available;
//   3. syn-standard picked and accepted with the keyboard (the base slot reads "Accepted"); the IRR slot is then open;
//   4. irr-matched picked: "Read, waiting for Accept", its import notes with the notice "Issues in the transactions
//      (IRR) file do not block the workbook download yet." (MOD-04 condition 2); accepted with the keyboard: "Accepted",
//      the notice still shown, and the IRR file in the source register;
//   5. section 4: the scope picker lists the family, both clients and both advisers (irr-matched carries the base
//      book's distributor names); the family's fund XIRR is a figure; picking "Adviser: Centricity" shows its fund
//      XIRR "7.76%" (worked by hand in tests/unit/engine/review-returns.test.ts: A's Bluechip alone, -10,000 on 1 Apr
//      2023, -5,000 on 1 Apr 2024, +17,000 on 31 Mar 2025, r = 7.7634%) and its tree holds the Bluechip instrument; the
//      family's partial benchmark coverage and the dates line (Gate B R2 and R3) are shown;
//   6. no CSP violation, console error or exception at the end, and no request but the page (and blob or data URLs).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { sleep, findBrowser, launch, openPage } from './lib/cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(ROOT, 'app', 'dist', 'index.html');
const NOTICE = 'Issues in the transactions (IRR) file do not block the workbook download yet.'; // views/returns.ts IRR_ISSUES_NOTICE

// ---------------------------------------------------------------------------------------------------------------
// Page probes (evaluated in the page; the CDP evaluation itself is not subject to the page's CSP)

const READY = `document.getElementById('app')?.dataset.ready === 'true'`;
const VIOLATIONS = `(window.__cspv || []).slice()`;
const FOCUS = (selector) => `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus(); return document.activeElement === el; })()`;
const TAB_CENTRE = (id) => `(() => {
  const r = document.querySelector('nav a[data-section="${id}"]').getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()`;
const HEADING = `document.querySelector('#app h2')?.id ?? null`;
const SET_DATE = (iso) => `(() => {
  const el = document.getElementById('as-on-date');
  el.value = ${JSON.stringify(iso)};
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el.value;
})()`;

// The base-file slot's chip.
const BASE_CHIP = `document.querySelector('#group-base-file .chip')?.textContent ?? null`;
// The IRR slot: chip, input state, the waiting reason, Accept, status line, import notes, the source register.
const IRR = `(() => {
  const g = document.getElementById('group-irr-file');
  const input = document.getElementById('irr-file-input');
  const text = (id) => document.getElementById(id)?.textContent.replace(/\\s+/g, ' ').trim() ?? null;
  return {
    found: Boolean(g && input),
    chip: g?.querySelector('.chip')?.textContent ?? null,
    disabled: input ? input.disabled : null,
    waiting: text('irr-file-disabled'),
    acceptUnavailable: document.getElementById('accept-irr-file')?.getAttribute('aria-disabled') === 'true',
    reason: text('accept-irr-reason'),
    status: text('irr-file-status'),
    notes: text('irr-import-notes'),
    register: [...document.querySelectorAll('#source-register tbody tr')].map((tr) => tr.textContent.replace(/\\s+/g, ' ').trim()),
  };
})()`;
// Section 4: the scope picker's options and choice, the headline figures, the tree's instrument rows.
const RETURNS = `(() => {
  const sel = document.getElementById('returns-scope');
  const text = (id) => document.getElementById(id)?.textContent.replace(/\\s+/g, ' ').trim() ?? null;
  return {
    found: Boolean(sel),
    options: sel ? [...sel.options].map((o) => o.textContent.trim()) : [],
    chosen: sel ? sel.options[sel.selectedIndex]?.textContent.trim() ?? null : null,
    fund: text('returns-fund'),
    bench: text('returns-bench'),
    flows: text('returns-flows'),
    coverage: text('returns-bench-coverage'),
    dates: text('returns-dates'),
    tree: [...document.querySelectorAll('#irr-tree tbody tr')].map((tr) => tr.textContent.replace(/\\s+/g, ' ').trim()),
    empty: document.querySelector('#app .empty-lead')?.textContent ?? null,
  };
})()`;
// Chooses the option with this text in the scope picker, as the select's change event reports a choice.
const CHOOSE_SCOPE = (label) => `(() => {
  const sel = document.getElementById('returns-scope');
  const o = sel ? [...sel.options].find((x) => x.textContent.trim() === ${JSON.stringify(label)}) : null;
  if (!o) return false;
  sel.focus();
  sel.value = o.value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`;

// ---------------------------------------------------------------------------------------------------------------

async function writeFixtures(dir) {
  const { syntheticFixtures } = await import(pathToFileURL(path.join(ROOT, 'tests', 'fixtures', 'make-books.ts')).href);
  const { irrFixtures } = await import(pathToFileURL(path.join(ROOT, 'tests', 'fixtures', 'make-irr-files.ts')).href);
  const { loadSheetJS } = await import(pathToFileURL(path.join(ROOT, 'tests', 'helpers', 'sheetjs.ts')).href);
  const xlsx = loadSheetJS();
  fs.mkdirSync(dir, { recursive: true });
  const files = {};
  for (const [id, all] of [['syn-standard', syntheticFixtures(xlsx)], ['irr-matched', irrFixtures(xlsx)]]) {
    const f = all.find((x) => x.id === id);
    if (!f) throw new Error(`no fixture ${id}`);
    files[id] = path.join(dir, `${id}.xlsx`);
    fs.writeFileSync(files[id], f.bytes);
  }
  return files;
}

async function main(argv) {
  const opt = { port: 8162, json: null, browser: null, modes: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') opt.port = Number(argv[++i]);
    else if (argv[i] === '--json') opt.json = argv[++i];
    else if (argv[i] === '--browser') opt.browser = argv[++i];
    else if (argv[i] === '--served') opt.modes.push('served');
    else if (argv[i] === '--file') opt.modes.push('file');
    else if (argv[i] === '--url') opt.modes.push(`url:${argv[++i]}`);
  }
  if (opt.modes.length === 0) opt.modes = ['served'];
  if (opt.modes.some((m) => !m.startsWith('url:')) && !fs.existsSync(DIST)) throw new Error('app/dist/index.html not found: run npm run build first');
  const exe = findBrowser(opt.browser);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-irr-slot-'));
  const results = [];
  const expect = (name, ok, detail) => {
    results.push({ name, ok: Boolean(ok), detail });
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
  };
  let server = null;
  if (opt.modes.includes('served')) {
    const { createServer } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'serve.mjs')).href);
    server = createServer(opt.port);
    await new Promise((r) => server.listen(opt.port, '127.0.0.1', r));
  }
  let browser = null;
  try {
    const files = await writeFixtures(path.join(work, 'files'));
    console.log(`browser: ${exe}`);
    browser = await launch(exe, path.join(work, 'profile'));
    for (const m of opt.modes) {
      const mode = m === 'served' ? { name: 'served', url: `http://127.0.0.1:${opt.port}/next/` }
        : m === 'file' ? { name: 'from disk', url: pathToFileURL(DIST).href }
          : { name: 'url', url: m.slice(4) };
      await runMode({ browser, mode, files, expect });
    }
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
    await sleep(500);
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* the browser may still hold a file */ }
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\nirr-slot.cdp: ${results.length - failed.length} of ${results.length} passed`);
  if (opt.json) fs.writeFileSync(opt.json, `${JSON.stringify({ browser: path.basename(exe), results }, null, 2)}\n`);
  return failed.length ? 1 : 0;
}

async function runMode({ browser, mode, files, expect }) {
  console.log(`\n=== ${mode.name}: ${mode.url} ===`);
  const page = await openPage(browser.cdp);
  await page.viewport(1440, 900);
  await page.navigate(mode.url);
  await page.waitFor(READY);
  const tab = async (id) => {
    await page.click(await page.eval(TAB_CENTRE(id)));
    await page.waitFor(`(${HEADING}) === '${id}-title'`, 5000);
  };
  const clean = async () => {
    const v = await page.eval(VIOLATIONS);
    return { ok: v.length === 0 && page.console.length === 0 && page.exceptions.length === 0 && page.log.length === 0,
      detail: { violations: v, console: page.console, exceptions: page.exceptions, log: page.log } };
  };

  // 1. Load
  const load = await page.eval(`({ ready: ${READY}, cspFirst: document.head.firstElementChild?.getAttribute('http-equiv') === 'Content-Security-Policy' })`);
  expect('the page loads under its CSP (the CSP first in <head>, the app ready)', load.ready && load.cspFirst, load);
  const c1 = await clean();
  expect('no CSP violation, console error or exception on load', c1.ok, c1.detail);
  const loadRequests = page.requests.filter((u) => !/^(?:data|blob):/.test(u));
  expect('the page requested nothing but itself', loadRequests.length === 1 && loadRequests[0] === mode.url, page.requests);

  // 2. The IRR slot before a base file
  const s0 = await page.eval(IRR);
  expect('before a base file the IRR slot waits: "Waiting for the base file", its input disabled, the reason shown, Accept not available',
    s0.found && s0.chip === 'Waiting for the base file' && s0.disabled === true && /^Accept a base file first/.test(s0.waiting ?? '')
      && s0.acceptUnavailable && s0.notes === null, s0);

  // 3. The base file: pick, accept with the keyboard, then the as-on date
  await page.eval(FOCUS('#base-file-input'));
  await page.setFiles('#base-file-input', [files['syn-standard']]);
  await page.waitFor(`(() => { const s = document.getElementById('base-file-status'); const c = document.querySelector('#group-base-file .chip'); return Boolean(s && s.textContent.includes('syn-standard.xlsx') && c && c.textContent !== 'No file'); })()`, 20000);
  await sleep(400);
  await page.eval(FOCUS('#accept-file'));
  await page.press('Enter');
  const baseChip = await page.waitFor(`(${BASE_CHIP}) === 'Accepted' && (${BASE_CHIP})`, 10000);
  await page.eval(SET_DATE('2026-09-30'));
  await sleep(300);
  const s1 = await page.eval(IRR);
  expect('syn-standard accepted: the base slot reads "Accepted" and the IRR slot is open ("No file", its input enabled)',
    baseChip === 'Accepted' && s1.chip === 'No file' && s1.disabled === false && s1.waiting === null, { baseChip, irr: s1 });

  // 4. The IRR file: pick, the notes and the notice, accept with the keyboard
  await page.eval(FOCUS('#irr-file-input'));
  await page.setFiles('#irr-file-input', [files['irr-matched']]);
  const read = await page.waitFor(`(() => { const s = document.getElementById('irr-file-status'); const c = document.querySelector('#group-irr-file .chip'); return Boolean(s && s.textContent.includes('irr-matched.xlsx') && c && c.textContent !== 'No file'); })()`, 20000);
  await sleep(400);
  const s2 = await page.eval(IRR);
  expect('irr-matched read: "Read, waiting for Accept", Accept available, the import notes with "7 fund flows and 5 benchmark flows read"',
    read && s2.chip === 'Read, waiting for Accept' && !s2.acceptUnavailable && (s2.notes ?? '').includes('7 fund flows and 5 benchmark flows read'), s2);
  expect(`the notice is shown: "${NOTICE}"`, (s2.notes ?? '').includes(NOTICE), s2.notes);
  await page.eval(FOCUS('#accept-irr-file'));
  await page.press('Enter');
  await page.waitFor(`document.querySelector('#group-irr-file .chip')?.textContent === 'Accepted'`, 10000);
  await sleep(300);
  const s3 = await page.eval(IRR);
  expect('Accept with the keyboard: "Accepted", the notice still shown, the IRR file in the source register',
    s3.chip === 'Accepted' && (s3.notes ?? '').includes(NOTICE) && s3.register.length === 2 && s3.register.some((r) => r.includes('irr-matched.xlsx')), s3);

  // 5. Section 4: the scope picker, the family's figure, an adviser's figure
  await tab('analytics');
  await page.waitFor(`Boolean(document.getElementById('returns-scope'))`, 5000);
  const r0 = await page.eval(RETURNS);
  const wanted = ['Family', 'Client: Sample Client A', 'Client: Sample Client B'];
  expect('section 4: the scope picker lists the family, both clients and at least one adviser, the family chosen',
    r0.found && wanted.every((w, i) => r0.options[i] === w) && r0.options.some((o) => o.startsWith('Adviser: ')) && r0.chosen === 'Family', r0.options);
  expect('the family\'s fund XIRR is a figure (n.nn%)', /^-?\d+\.\d\d%/.test(r0.fund ?? ''), { fund: r0.fund, bench: r0.bench });
  expect('the family\'s partial benchmark coverage (2 of 3 instruments) and the dates line (last flow 31 Mar 2025, as on 30 Sep 2026) are shown',
    /^The benchmark XIRR covers 2 of the 3 instruments/.test(r0.coverage ?? '') && r0.dates === "Last fund flow of the review's clients in the transactions file: 31 Mar 2025. As-on date of the review: 30 Sep 2026.",
    { coverage: r0.coverage, dates: r0.dates });
  const chose = await page.eval(CHOOSE_SCOPE('Adviser: Centricity'));
  const r1 = await page.waitFor(`(() => { const r = ${RETURNS}; return r.chosen === 'Adviser: Centricity' && r.fund !== ${JSON.stringify(r0.fund)} ? r : null; })()`, 5000);
  const r1v = r1 || await page.eval(RETURNS);
  expect('"Adviser: Centricity" picked: its fund XIRR shows "7.76%" (hand-worked), its flows "3 fund flows", its tree the Bluechip instrument',
    chose && r1v.chosen === 'Adviser: Centricity' && /^7\.76%/.test(r1v.fund ?? '') && /^3 fund flows/.test(r1v.flows ?? '')
      && r1v.tree.some((t) => t.includes('Sample Bluechip Fund')) && !r1v.tree.some((t) => t.includes('Sample Corporate Bond Fund')),
    { chose, chosen: r1v.chosen, fund: r1v.fund, flows: r1v.flows, tree: r1v.tree });

  // 6. The end
  const c6 = await clean();
  expect('no CSP violation, console error or exception at the end', c6.ok, c6.detail);
  const all = page.requests.filter((u) => !/^(?:data|blob):/.test(u));
  expect('no request but the page itself (and blob or data URLs)', all.length === 1 && all[0] === mode.url, page.requests);
}

main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err) => {
  console.error(`irr-slot.cdp: ${err && err.stack ? err.stack : err}`);
  process.exitCode = 2;
});
