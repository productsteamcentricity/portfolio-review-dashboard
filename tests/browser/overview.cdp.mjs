#!/usr/bin/env node
// overview.cdp.mjs: the portfolio overview of M1.4 (sections 1 and 2) in a real browser (headless Edge or Chrome),
// driven with real keys and clicks through tests/browser/lib/cdp.mjs. Local only, not part of CI. Synthetic base files
// only (tests/fixtures/make-books.ts), written to a temporary folder and deleted at the end; nothing leaves this
// machine.
//
//   npm run build && node tests/browser/overview.cdp.mjs [--served | --file | --url <url>] [--port 8112]
//                                                        [--browser <exe>] [--out <dir>] [--json <file>]
//
// Without a mode it runs both: served by scripts/serve.mjs (http://127.0.0.1:<port>/next/) and from disk (file://
// app/dist/index.html). --url runs one address (the Pages preview after a deploy). Screenshots of the pies and the
// two downloads go to --out (default app/dist/qa/overview/, git-ignored).
//
// For each mode (M1.4 fix round decisions in brackets):
//   1. the page loads under its CSP with no violation, console error or exception, and requests nothing but itself;
//   2. section 1 before a file: the stage strip at Upload, "No file", Accept not available with its reason, the
//      disclaimer's status, the MF Screener slot (M10), an empty source register;
//   3. refusals as sentences [L15]: a 21 MB file and a damaged workbook; a file with no holding is refused, Accept
//      does nothing [L14]; after every pick the focus is on the new file input, never the body [L13]; the review bar
//      reads "Base file refused" and never names a refused file [N12];
//   4. syn-standard read: Preview in the strip and in the source register [L12], the full 64-hex SHA-256 [L18], the
//      M2 matching line, the file named in the review bar [N12], section 2 still empty; the Accept button, under the
//      pinned header when Tab gives it focus, is scrolled clear of the header at 1440 and 1024 px [L26];
//   5. Accept with the keyboard and no as-on date: the focus stays on Accept [L13], Accepted, Review in the strip and
//      the register [L12], the Blocking as-on result, the downloads not available with the reason, and a click on one
//      starts nothing;
//   6. a real click on tab 1 and tab 2 from the end of the long sections, at 1440 x 900 and 1366 x 768: the review
//      bar just below the pinned header (8 to 20 px, the measured gap), the focused heading clear of it [L1, N12];
//   7. the as-on date, the family label and a built-in logo: section 2's figures, tables, matrices and notes; the pies
//      [L2] at 1440 and 375 px (colours, labels, the band above and below the pie, the legend below the band, every
//      label inside the canvas, clear of the legend and of each other; no label on the one-slice liquidity pie), with
//      screenshots;
//   8. the two downloads (real clicks): the file names, the bytes saved, no request but blob or data URLs, the focus
//      kept on each button [L13]; the workbook passes the evaluator-only check (scripts/office/run-acceptance.ts);
//   9. Remove: the focus on the new file input [L13]; the XIRR questions answered with real clicks: the focus moves
//      to the next question, then to the import report heading [L13]; an acknowledged High result: the focus moves on
//      (syn-total-rows: its fund named "Total Return ..." is High; its "Total" and "GRAND TOTAL" rows are skipped, N1,
//      so the KPIs read as syn-standard's, never doubled); then [D1, round 3] a file gone from the disk is picked:
//      no exception, the refusal sentence, the review bar "Base file refused", and that review's KPIs are gone;
//  10. syn-all-classes (six slices, Commodity unlabelled, Unknown last in #D9D9D9) and syn-single-entity (the single
//      client and distributor lines) [L2, L14];
//  11. [N12] syn-blank-entities: the matrix notes count named columns and put the rest in words ("2 clients, and 2
//      holdings with no client"); syn-case-variants: the client and distributor headers as the file spells them,
//      each distinct on screen (innerText, after the stylesheet's text-transform); a copy of syn-standard with "NA"
//      in every market value: the liquidity table is the sentence "No liquidity line to show: ..."; then a reload
//      keeps the logo and no review data.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { sleep, findBrowser, launch, openPage, allowDownloads } from './lib/cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(ROOT, 'app', 'dist', 'index.html');
const DECK_NAME = 'Sample_Family_Asset_Allocation_2026-09-30_PREVIEW.pptx';
const BOOK_NAME = 'Sample_Family_Portfolio_Overview_2026-09-30_PREVIEW.xlsx';
const BAND = 32; // app/src/ui/pie-config.ts PIE_LABEL_BAND
const PAD = 4; // app/src/ui/pie-config.ts PIE_LABEL_PADDING

// ---------------------------------------------------------------------------------------------------------------
// Page probes (evaluated in the page; the CDP evaluation itself is not subject to the page's CSP)

const READY = `document.getElementById('app')?.dataset.ready === 'true'`;
const VIOLATIONS = `(window.__cspv || []).slice()`;
const FOCUSED = `(() => { const f = document.activeElement; return !f || f === document.body ? 'body' : (f.id || (f.textContent || '').trim().slice(0, 40) || f.tagName); })()`;
const FOCUS = (selector) => `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus(); return document.activeElement === el; })()`;
const CENTRE = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()`;
const TAB_CENTRE = (id) => `(() => {
  const r = document.querySelector('nav a[data-section="${id}"]').getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()`;
const HEADING = `document.querySelector('#app h2')?.id ?? null`;
const TEXT = (selector) => `document.querySelector(${JSON.stringify(selector)})?.textContent.replace(/\\s+/g, ' ').trim() ?? null`;

// The base-file slot: chip, class, status line, Accept, the stage the strip shows, the register's stages, the focus.
const SLOT = `(() => {
  const g = document.getElementById('group-base-file');
  const cur = g ? g.querySelector('.stage-current') : null;
  const f = document.activeElement;
  return {
    chip: g?.querySelector('.chip')?.textContent ?? null,
    cls: g?.querySelector('.upload-slot')?.className ?? null,
    status: document.getElementById('base-file-status')?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
    acceptUnavailable: document.getElementById('accept-file')?.getAttribute('aria-disabled') === 'true',
    reason: document.getElementById('accept-reason')?.textContent ?? null,
    stage: cur ? cur.textContent.split(',')[0].trim() : null,
    register: [...document.querySelectorAll('#source-register tbody tr')].map((tr) => tr.lastElementChild.textContent),
    focused: !f || f === document.body ? 'body' : (f.id || f.className || f.tagName),
  };
})()`;

// Makes the section on screen long (a test-only spacer inside its panel) and scrolls to its end.
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
const REVIEW_BAR_PLACE = `(() => {
  const header = document.querySelector('.app-header').getBoundingClientRect();
  const bar = document.querySelector('.review-bar');
  const b = bar ? bar.getBoundingClientRect() : null;
  const h2 = document.querySelector('#app h2');
  const f = document.activeElement;
  return {
    headerBottom: Math.round(header.bottom), barTop: b ? Math.round(b.top) : null, heading: h2 ? h2.id : null,
    headingTop: h2 ? Math.round(h2.getBoundingClientRect().top) : null,
    focused: !f || f === document.body ? 'body' : (f.id || f.tagName), scrollY: Math.round(scrollY),
  };
})()`;

// (L26) Puts a control under the pinned header and focuses, without scrolling, the element just before it in the Tab
// order, so that one real Tab press moves the focus onto the control.
const PLACE_UNDER_HEADER = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return { found: false };
  const tabbable = [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')]
    .filter((e) => !e.disabled && e.tabIndex >= 0 && e.getClientRects().length > 0);
  const i = tabbable.indexOf(el);
  const before = i > 0 ? tabbable[i - 1] : null;
  const headerBottom = Math.round(document.querySelector('.app-header').getBoundingClientRect().bottom);
  scrollTo(0, Math.round(el.getBoundingClientRect().top + scrollY - headerBottom + 20));
  if (before) before.focus({ preventScroll: true });
  const top = Math.round(el.getBoundingClientRect().top);
  return { found: true, before: before ? (before.id || before.className || before.tagName) : null, headerBottom, top, under: top < headerBottom };
})()`;
const CONTROL_PLACE = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  return { focused: document.activeElement === el, top: Math.round(el.getBoundingClientRect().top), headerBottom: Math.round(document.querySelector('.app-header').getBoundingClientRect().bottom) };
})()`;

const SET_DATE = (iso) => `(() => {
  const el = document.getElementById('as-on-date');
  el.value = ${JSON.stringify(iso)};
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el.value;
})()`;
const TYPE_LABEL = (id, text) => `(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  el.focus();
  el.value = ${JSON.stringify(text)};
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return document.activeElement === el;
})()`;

// Section 2's figures and tables as text.
const OVERVIEW = `(() => {
  const rows = (id) => [...document.querySelectorAll('#' + id + ' tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent.replace(/\\s+/g, ' ').trim()).join(' | '));
  return {
    kpis: [...document.querySelectorAll('.ledger-cell .ledger-value')].map((v) => v.textContent.trim()),
    allocation: rows('allocation-table'),
    liquidity: rows('liquidity-table'),
    clientCols: [...document.querySelectorAll('#matrix-client thead th')].map((t) => t.textContent.trim()),
    distributorCols: [...document.querySelectorAll('#matrix-distributor thead th')].map((t) => t.textContent.trim()),
    clients: document.getElementById('group-clients')?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
    distributors: document.getElementById('group-distributors')?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
    notes: [...document.querySelectorAll('.note-list li')].map((li) => li.textContent.trim()),
    bar: document.querySelector('.review-bar')?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
    logo: document.querySelector('.review-bar img')?.getAttribute('alt') ?? null,
    empty: document.querySelector('#app .empty-lead')?.textContent ?? null,
    // (N12) the entity headers as rendered (innerText follows text-transform), the group notes, the liquidity block.
    clientHeads: [...document.querySelectorAll('#matrix-client thead th.entity')].map((t) => t.innerText.trim()),
    distributorHeads: [...document.querySelectorAll('#matrix-distributor thead th.entity')].map((t) => t.innerText.trim()),
    clientNote: document.querySelector('#group-clients .group-note')?.textContent.trim() ?? null,
    distributorNote: document.querySelector('#group-distributors .group-note')?.textContent.trim() ?? null,
    liquidityTable: Boolean(document.getElementById('liquidity-table')),
    liquidityEmpty: document.getElementById('liquidity-empty')?.textContent.trim() ?? null,
  };
})()`;
// (N12) The review bar's base-file words.
const BAR_FILE = `document.querySelector('.review-bar .review-file')?.textContent.replace(/\\s+/g, ' ').trim() ?? null`;
/**
 * "Just below the pinned header" (D-037 point 1, D-039 point 15; N12), pinned as measured: the review bar's top is 8 to
 * 20 px below the header's bottom (12 px at 1440 and 1366 px when the page is at its top).
 */
const BAR_GAP = Object.freeze({ min: 8, max: 20 });
const barJustBelow = (p) => p.barTop !== null && p.barTop - p.headerBottom >= BAR_GAP.min && p.barTop - p.headerBottom <= BAR_GAP.max;

// (L2) Every pie of section 2 as Chart.js drew it: the dataset, the chart area, the legend, and the frame of every
// label datalabels drew (its HitBox after drawing, in canvas pixels).
const PIES = `(() => {
  const C = window.Chart;
  return [...document.querySelectorAll('#group-charts canvas')].map((canvas) => {
    const chart = C && C.getChart ? C.getChart(canvas) : null;
    if (!chart) return { chart: false };
    const ds = chart.data.datasets[0];
    const labels = ((chart.$datalabels && chart.$datalabels._labels) || [])
      .filter((l) => l.$layout && l.$layout._visible && l._model)
      .map((l) => { const r = l.$layout._box._rect; return { text: (l._model.lines || []).join(' '), x: r.x, y: r.y, w: r.w, h: r.h }; });
    return {
      chart: true, width: chart.width, height: chart.height, categories: chart.data.labels.slice(),
      colours: ds.backgroundColor.slice(), borderWidth: ds.borderWidth,
      area: { top: chart.chartArea.top, bottom: chart.chartArea.bottom, left: chart.chartArea.left, right: chart.chartArea.right },
      legend: { top: chart.legend.top, bottom: chart.legend.bottom },
      labels,
    };
  });
})()`;
// Scrolls an element to just below the pinned header (or the top, where nothing is pinned), for a screenshot.
const SHOW = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  const header = document.querySelector('.app-header');
  const pinned = getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().bottom : 0;
  scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY - pinned - 8));
  return true;
})()`;

/** Problems of one drawn pie (L2): the band above and below, the legend below the band, labels inside and apart. */
function pieProblems(p) {
  const bad = [];
  const near = (a, b) => Math.abs(a - b) <= 1;
  if (!p.chart) return ['no chart'];
  if (!near(p.area.top, BAND)) bad.push(`chart area top ${p.area.top}, not ${BAND}`);
  if (!near(p.legend.top - p.area.bottom, BAND)) bad.push(`legend ${p.legend.top - p.area.bottom} px below the pie, not ${BAND}`);
  if (!near(p.height - p.legend.bottom, BAND)) bad.push(`bottom padding ${p.height - p.legend.bottom}, not ${BAND}`);
  for (const l of p.labels) {
    if (l.x < -0.5 || l.y < -0.5 || l.x + l.w > p.width + 0.5 || l.y + l.h > p.height + 0.5) bad.push(`"${l.text}" cut off by the canvas`);
    if (l.y + l.h > p.legend.top + 0.5) bad.push(`"${l.text}" over the legend`);
  }
  // Two labels collide when their text overlaps: each frame less its 4 px padding (the frames themselves are not
  // drawn, and those of neighbouring small slices may touch).
  const text = (l) => ({ x: l.x + PAD, y: l.y + PAD, w: l.w - 2 * PAD, h: l.h - 2 * PAD });
  for (let i = 0; i < p.labels.length; i++) {
    for (let j = i + 1; j < p.labels.length; j++) {
      const a = text(p.labels[i]);
      const b = text(p.labels[j]);
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) bad.push(`"${p.labels[i].text}" overlaps "${p.labels[j].text}"`);
    }
  }
  return bad;
}

/** The label texts in a stable order (datalabels keeps them in drawing order). */
const sortedTexts = (labels) => labels.map((l) => l.text).sort();

// ---------------------------------------------------------------------------------------------------------------

async function writeFixtures(dir) {
  const { syntheticFixtures, overviewFixtures } = await import(pathToFileURL(path.join(ROOT, 'tests', 'fixtures', 'make-books.ts')).href);
  const { loadSheetJS, writeXlsx } = await import(pathToFileURL(path.join(ROOT, 'tests', 'helpers', 'sheetjs.ts')).href);
  const xlsx = loadSheetJS();
  fs.mkdirSync(dir, { recursive: true });
  const want = ['syn-standard', 'syn-ambiguous-xirr', 'syn-all-classes', 'syn-single-entity', 'syn-total-rows', 'syn-blank-entities', 'syn-case-variants'];
  const all = [...syntheticFixtures(xlsx), ...overviewFixtures(xlsx)];
  const files = {};
  for (const id of want) {
    const f = all.find((x) => x.id === id);
    if (!f) throw new Error(`no fixture ${id}`);
    files[id] = path.join(dir, `${id}.xlsx`);
    fs.writeFileSync(files[id], f.bytes);
  }
  // (N12) syn-standard with "NA" in every market value cell ("Current Market Value (Cr.)" and "Market Value (₹)"):
  // a file read whose every holding is excluded.
  const wb = xlsx.read(fs.readFileSync(files['syn-standard']), { type: 'buffer' });
  const ws = wb.Sheets['Base File'];
  const range = xlsx.utils.decode_range(ws['!ref']);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const head = ws[xlsx.utils.encode_cell({ r: 0, c })];
    if (!head || !/^(?:Current )?Market Value/i.test(String(head.v))) continue;
    for (let r = 1; r <= range.e.r; r++) {
      const addr = xlsx.utils.encode_cell({ r, c });
      if (ws[addr]) ws[addr] = { v: 'NA', t: 's' };
    }
  }
  files['syn-all-na'] = path.join(dir, 'syn-all-na.xlsx');
  fs.writeFileSync(files['syn-all-na'], writeXlsx(xlsx, wb));
  files.notes = path.join(dir, 'notes.xlsx');
  fs.writeFileSync(files.notes, 'This is not a workbook.\n');
  files.huge = path.join(dir, 'huge.xlsx');
  fs.writeFileSync(files.huge, Buffer.alloc(21 * 1024 * 1024));
  files.broken = path.join(dir, 'broken.xls');
  fs.writeFileSync(files.broken, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]));
  return files;
}

async function main(argv) {
  const opt = { port: 8112, json: null, browser: null, out: path.join(ROOT, 'app', 'dist', 'qa', 'overview'), modes: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') opt.port = Number(argv[++i]);
    else if (argv[i] === '--json') opt.json = argv[++i];
    else if (argv[i] === '--browser') opt.browser = argv[++i];
    else if (argv[i] === '--out') opt.out = path.resolve(argv[++i]);
    else if (argv[i] === '--served') opt.modes.push('served');
    else if (argv[i] === '--file') opt.modes.push('file');
    else if (argv[i] === '--url') opt.modes.push(`url:${argv[++i]}`);
  }
  if (opt.modes.length === 0) opt.modes = ['served', 'file'];
  if (opt.modes.some((m) => m !== 'served' && !m.startsWith('url:')) && !fs.existsSync(DIST)) throw new Error('app/dist/index.html not found: run npm run build first');
  const exe = findBrowser(opt.browser);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-overview-'));
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
      const mode = m === 'served' ? { name: 'served', slug: 'served', url: `http://127.0.0.1:${opt.port}/next/` }
        : m === 'file' ? { name: 'from disk', slug: 'disk', url: pathToFileURL(DIST).href }
          : { name: 'url', slug: 'url', url: m.slice(4) };
      await runMode({ browser, mode, files, opt, expect });
    }
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
    await sleep(500);
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* the browser may still hold a file */ }
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\noverview.cdp: ${results.length - failed.length} of ${results.length} passed`);
  if (opt.json) fs.writeFileSync(opt.json, `${JSON.stringify({ browser: path.basename(exe), results }, null, 2)}\n`);
  return failed.length ? 1 : 0;
}

async function runMode({ browser, mode, files, opt, expect }) {
  console.log(`\n=== ${mode.name}: ${mode.url} ===`);
  const out = path.join(opt.out, mode.slug);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const page = await openPage(browser.cdp);
  const nextDownload = await allowDownloads(browser.cdp, path.join(out, 'downloads'));
  await page.viewport(1440, 900);
  await page.navigate(mode.url);
  await page.waitFor(READY);
  const tab = async (id) => {
    await page.click(await page.eval(TAB_CENTRE(id)));
    await page.waitFor(`${HEADING} === '${id}-title'`, 5000);
  };
  const pick = async (file) => {
    await page.eval(FOCUS('#base-file-input')); // the keyboard user's place: the input they open the file dialog from
    await page.setFiles('#base-file-input', [file]);
    const name = JSON.stringify(path.basename(file));
    await page.waitFor(`(() => { const s = document.getElementById('base-file-status'); const c = document.querySelector('#group-base-file .chip'); return Boolean(s && s.textContent.includes(${name}) && c && c.textContent !== 'No file'); })()`, 20000);
    await sleep(400); // the focus effect runs after the browser has painted
    return page.eval(SLOT);
  };
  const accept = async () => {
    await page.eval(FOCUS('#accept-file'));
    await page.press('Enter');
    await page.waitFor(`document.querySelector('#group-base-file .chip')?.textContent === 'Accepted'`, 10000);
    await sleep(300);
    return page.eval(SLOT);
  };
  const setAsOnAndFamily = async () => {
    await page.eval(SET_DATE('2026-09-30'));
    await page.eval(TYPE_LABEL('family-label', 'Sample Family'));
    await page.press('Enter');
  };

  // 1. Load
  const load = await page.eval(`({ ready: ${READY}, cspFirst: document.head.firstElementChild?.getAttribute('http-equiv') === 'Content-Security-Policy', violations: ${VIOLATIONS} })`);
  expect('the page loads under its CSP (the CSP first in <head>, the app ready)', load.ready && load.cspFirst, load);
  expect('no CSP violation, console error or exception on load',
    load.violations.length === 0 && page.console.length === 0 && page.exceptions.length === 0 && page.log.length === 0,
    { violations: load.violations, console: page.console, exceptions: page.exceptions, log: page.log });
  const loadRequests = page.requests.filter((u) => !/^(?:data|blob):/.test(u));
  expect('the page requested nothing but itself', loadRequests.length === 1 && loadRequests[0] === mode.url, page.requests);

  // 2. Section 1 before a file
  const s0 = await page.eval(SLOT);
  expect('before a file: the strip at Upload, "No file", Accept not available with "Choose a base file first.", no register row',
    s0.stage === 'Upload' && s0.chip === 'No file' && s0.acceptUnavailable && s0.reason === 'Choose a base file first.' && s0.register.length === 0, s0);
  const disclaimer = await page.eval(TEXT('#group-inputs'));
  const screener = await page.eval(TEXT('#slot-screener-pack'));
  expect('"Disclaimer in use" shows its status, and the MF Screener slot names M10',
    /not available in supplied data/.test(disclaimer ?? '') && /M10/.test(screener ?? ''), { disclaimer, screener });

  // 3. Refusals [L15, L14], with the focus after each pick [L13]
  const huge = await pick(files.huge);
  expect('a 21 MB file: "Refused: the file is 21.0 MB; the limit is 20 MB.", Accept not available with the refused reason (L15)',
    huge.chip === 'Refused' && /is-error/.test(huge.cls) && huge.status.includes('Refused: the file is 21.0 MB; the limit is 20 MB.')
      && !/\d{6,}/.test(huge.status) && huge.acceptUnavailable && huge.reason === 'The file was refused: choose another base file.', huge);
  expect('after picking a file the focus is on the new file input, not the body (L13)', huge.focused === 'base-file-input', huge.focused);
  const broken = await pick(files.broken);
  expect('a damaged workbook: "Refused: the file could not be read as an Excel workbook." (L15)',
    broken.chip === 'Refused' && broken.status.includes('Refused: the file could not be read as an Excel workbook.') && broken.focused === 'base-file-input', broken);
  const notes = await pick(files.notes);
  expect('a file with no holding: error state, "Refused" with the reader\'s reason, Accept not available, Validate in the strip (L14)',
    notes.chip === 'Refused' && /is-error/.test(notes.cls) && notes.status.includes('Refused: no sheet has a header row')
      && notes.acceptUnavailable && notes.reason === 'The file was refused: choose another base file.' && notes.stage === 'Validate'
      && notes.focused === 'base-file-input', notes);
  await page.click(await page.eval(CENTRE('#accept-file')));
  const notesAfter = await page.eval(SLOT);
  expect('a click on Accept for a refused file does nothing (L14)', notesAfter.chip === 'Refused' && notesAfter.stage === 'Validate', notesAfter);
  // (N12) The review bar never names a refused file: the three refusals above each leave "Base file refused".
  const refusedBars = [];
  for (const f of [files.huge, files.broken, files.notes]) {
    await pick(f);
    refusedBars.push({ file: path.basename(f), bar: await page.eval(BAR_FILE) });
  }
  expect('after each refusal the review bar reads "Base file refused" and never the refused file\'s name (N12)',
    refusedBars.every((b) => b.bar === 'Base file refused' && !b.bar.includes(b.file)), refusedBars);

  // 4. syn-standard read, before Accept
  const std = await pick(files['syn-standard']);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(files['syn-standard'])).digest('hex');
  expect('syn-standard read: "Read, waiting for Accept", Preview in the strip and in the source register (L12), focus on the input (L13)',
    std.chip === 'Read, waiting for Accept' && std.stage === 'Preview' && JSON.stringify(std.register) === '["Preview"]'
      && !std.acceptUnavailable && std.focused === 'base-file-input', std);
  const stdBar = await page.eval(BAR_FILE);
  expect('a file read and not refused is named in the review bar: "Base file syn-standard.xlsx" (N12)', stdBar === 'Base file syn-standard.xlsx', stdBar);
  const report = await page.eval(`(() => {
    const el = document.getElementById('base-file-sha256');
    const cell = el ? el.closest('td') : null;
    const r = el ? el.getBoundingClientRect() : null;
    const c = cell ? cell.getBoundingClientRect() : null;
    return { sha: el ? el.textContent : null, inside: Boolean(r && c && r.right <= c.right + 1 && r.left >= c.left - 1), text: document.getElementById('group-import-report')?.textContent.replace(/\\s+/g, ' ') ?? '' };
  })()`);
  expect('the import report shows the full 64-hex SHA-256 of the file, wrapped inside its cell (L18)',
    report.sha === sha && /^[0-9a-f]{64}$/.test(report.sha) && report.inside, { sha: report.sha, expected: sha, inside: report.inside });
  expect('the import report: sheet "Base File", header row 1, Crore, and the M2 matching line',
    report.text.includes('Base File, row 1') && /Crore/.test(report.text) && report.text.includes('Instrument matching arrives in M2'), report.text.slice(0, 300));
  for (const [w, h] of [[1440, 900], [1024, 768]]) {
    await page.viewport(w, h);
    const placed = await page.eval(PLACE_UNDER_HEADER('#accept-file'));
    await page.press('Tab');
    const after = placed.found ? await page.eval(CONTROL_PLACE('#accept-file')) : null;
    expect(`${w} px: the Accept button of a file read, under the pinned header when Tab gives it focus, is scrolled clear of the header (L26)`,
      placed.found && placed.under && after.focused && after.top >= after.headerBottom, { placed, after });
  }
  await page.viewport(1440, 900);
  await tab('overview');
  const before = await page.eval(OVERVIEW);
  expect('section 2 shows "Nothing to show yet" before Accept', /^Nothing to show yet/.test(before.empty ?? ''), before.empty);
  await tab('uploads');

  // 5. Accept with the keyboard, no as-on date
  const acc = await accept();
  expect('Accept with the keyboard: the focus stays on the Accept button (L13), "Accepted", Review in the strip',
    acc.focused === 'accept-file' && acc.chip === 'Accepted' && acc.stage === 'Review' && acc.acceptUnavailable, acc);
  expect('after Accept the source register shows the Review stage (L12; the engine records it)',
    JSON.stringify(acc.register) === '["Review (accepted)"]', acc.register);
  const validation = await page.eval(TEXT('#group-validation'));
  expect('the Blocking "as-on date is not set" result shows in the validation panel', /The as-on date is not set/.test(validation ?? ''), validation);
  await tab('overview');
  const gate = await page.eval(`({ deck: document.getElementById('download-deck')?.getAttribute('aria-disabled'), book: document.getElementById('download-workbook')?.getAttribute('aria-disabled'), reasons: document.getElementById('downloads-gate')?.textContent ?? '' })`);
  expect('both downloads are not available, with the as-on reason beside them', gate.deck === 'true' && gate.book === 'true' && /as-on date is not set/.test(gate.reasons), gate);
  const noDownload = nextDownload(2000);
  await page.click(await page.eval(CENTRE('#download-deck')));
  let started = true;
  try { await noDownload; } catch { started = false; }
  expect('a click on a download that is not available starts nothing', !started, started);

  // 6. The review bar after a real click on tab 1 and tab 2, from the end of the long sections [L1]
  for (const [w, h] of [[1440, 900], [1366, 768]]) {
    await page.viewport(w, h);
    const placed = [];
    for (const id of ['uploads', 'overview', 'uploads']) {
      await page.eval(LONG_AND_SCROLLED);
      await tab(id);
      await sleep(200);
      placed.push({ id, ...(await page.eval(REVIEW_BAR_PLACE)) });
    }
    const bad = placed.filter((p) => !(p.focused === `${p.id}-title` && barJustBelow(p) && p.headingTop >= p.headerBottom));
    expect(`${w} px, a review on screen: a real click on tab 1 and tab 2 shows the review bar ${BAR_GAP.min} to ${BAR_GAP.max} px below the pinned header, the focused heading clear of it (L1, N12)`,
      bad.length === 0, bad.length ? bad : placed.map((p) => `${p.id}: bar ${p.barTop} - header ${p.headerBottom} = ${p.barTop - p.headerBottom} px, h2 ${p.headingTop}`).join('; '));
  }
  await page.viewport(1440, 900);

  // 7. Inputs, a built-in logo, and section 2
  await setAsOnAndFamily();
  const logoInput = await page.eval(`document.querySelector('input[name="logo"]:not(#logo-none)')?.id ?? null`);
  if (logoInput) await page.click(await page.eval(CENTRE(`#${logoInput}`)));
  await tab('overview');
  await sleep(600);
  const ov = await page.eval(OVERVIEW);
  expect('KPIs: 2.85, 3.35, 0.50, 17.65%, 6 holdings, 2 clients', JSON.stringify(ov.kpis) === JSON.stringify(['2.85', '3.35', '0.50', '17.65%', '6', '2']), ov.kpis);
  expect('allocation: Equity 1.65 | 1.99 | 59.26% ... Grand Total 2.85 | 3.35 | 100.00%',
    ov.allocation[0] === 'Equity | 1.65 | 1.99 | 59.26%' && ov.allocation[ov.allocation.length - 1] === 'Grand Total | 2.85 | 3.35 | 100.00%', ov.allocation);
  expect('the client matrix has Sample Client A and Sample Client B; the distributor matrix Other Distributor first',
    ov.clientCols.includes('Sample Client A') && ov.clientCols.includes('Sample Client B') && ov.distributorCols[1] === 'Other Distributor', { clients: ov.clientCols, distributors: ov.distributorCols });
  expect('the notes say "Portfolio as on 30 Sep 2026."', ov.notes.includes('Portfolio as on 30 Sep 2026.'), ov.notes);
  expect('the review bar shows the logo, "Sample Family" and 30 Sep 2026', Boolean(logoInput ? ov.logo : true) && /Sample Family/.test(ov.bar ?? '') && /30 Sep 2026/.test(ov.bar ?? ''), { bar: ov.bar, logo: ov.logo });

  const checkPies = async (label, w, h, mobile, expectAsset) => {
    await page.viewport(w, h, mobile);
    await sleep(700); // Chart.js resizes on its ResizeObserver
    const pies = await page.eval(PIES);
    const [asset, liq] = pies;
    const problems = pies.map(pieProblems);
    expect(`${label} at ${w} px: both pies drawn; the same ${BAND} px band above and below the pie, the legend below the band, every label inside the canvas, clear of the legend and of the other labels (L2)`,
      pies.length === 2 && problems.every((p) => p.length === 0), { problems, sizes: pies.map((p) => `${p.width}x${p.height}`) });
    expectAsset(asset, w);
    expect(`${label} at ${w} px: the one-slice liquidity pie draws no label and no outline (L2)`,
      liq && liq.chart && liq.categories.length === 1 && liq.labels.length === 0 && liq.borderWidth === 0, liq && { categories: liq.categories, labels: liq.labels, borderWidth: liq.borderWidth });
    if (await page.eval(SHOW('#group-charts'))) {
      await sleep(200);
      await page.screenshot(path.join(out, `${w}-${label}-pies.png`));
    }
  };
  await checkPies('syn-standard', 1440, 900, false, (asset, w) => {
    expect(`syn-standard at ${w} px: the asset pie in #DBC8B2, #BD9568, #BFBFBF, #808080 with labels Equity 59.3%, Debt 26.7%, Hybrid 10.1%, Commodity 3.9%`,
      JSON.stringify(asset.colours) === JSON.stringify(['#DBC8B2', '#BD9568', '#BFBFBF', '#808080'])
        && JSON.stringify(sortedTexts(asset.labels)) === JSON.stringify(['Commodity 3.9%', 'Debt 26.7%', 'Equity 59.3%', 'Hybrid 10.1%']),
      { colours: asset.colours, labels: sortedTexts(asset.labels) });
  });
  await checkPies('syn-standard', 375, 812, true, (asset, w) => {
    const pctOnly = asset.width < 360;
    const want = pctOnly ? ['10.1%', '26.7%', '3.9%', '59.3%'] : ['Commodity 3.9%', 'Debt 26.7%', 'Equity 59.3%', 'Hybrid 10.1%'];
    expect(`syn-standard at ${w} px: a canvas ${Math.round(asset.width)} px wide shows ${pctOnly ? 'the percent alone' : 'category and percent'} (below 360 px: the percent alone)`,
      JSON.stringify(sortedTexts(asset.labels)) === JSON.stringify(want), { width: asset.width, labels: sortedTexts(asset.labels) });
  });
  await page.viewport(1440, 900);
  await sleep(500);

  // 8. Downloads (real clicks) [L13]
  const before8 = page.requests.length;
  for (const [button, fileName] of [['#download-deck', DECK_NAME], ['#download-workbook', BOOK_NAME]]) {
    const done = nextDownload(30000);
    await page.click(await page.eval(CENTRE(button)));
    let dl;
    try { dl = await done; } catch { dl = { state: 'no download within 30 s', name: null, file: null }; }
    await sleep(500);
    const bytes = dl.file && fs.existsSync(dl.file) ? fs.readFileSync(dl.file) : null;
    expect(`the ${fileName.endsWith('.pptx') ? 'slide' : 'workbook'} downloads as ${fileName}, a zip package`,
      dl.state === 'completed' && dl.name === fileName && bytes !== null && bytes.length > 1000 && bytes[0] === 0x50 && bytes[1] === 0x4b,
      { state: dl.state, name: dl.name, bytes: bytes ? bytes.length : null });
    const focused = await page.eval(FOCUSED);
    expect(`after the ${fileName.endsWith('.pptx') ? 'slide' : 'workbook'} download the focus is still on its button (L13)`, focused === button.slice(1), focused);
    if (fileName.endsWith('.xlsx') && bytes) {
      const { checkWorkbookBytes } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'office', 'run-acceptance.ts')).href);
      const res = checkWorkbookBytes(new Uint8Array(bytes));
      expect('the downloaded workbook passes the evaluator-only check (run-acceptance --check-file)', res.pass,
        res.pass ? `${res.formulas} formulas` : res.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail.slice(0, 3).join('; ')}`));
    }
  }
  const during = page.requests.slice(before8);
  expect('the downloads made no request but blob or data URLs', during.every((u) => /^(?:blob|data):/.test(u)), during);
  const v8 = await page.eval(VIOLATIONS);
  expect('no CSP violation, console error or exception after Chart.js and PptxGenJS ran',
    v8.length === 0 && page.console.length === 0 && page.exceptions.length === 0 && page.log.length === 0,
    { violations: v8, console: page.console, exceptions: page.exceptions, log: page.log });

  // 9. Remove, the XIRR questions, an acknowledged High result [L13]
  await tab('uploads');
  await page.click(await page.eval(CENTRE('#remove-file')));
  await sleep(400);
  const removed = await page.eval(SLOT);
  expect('Remove: "No file", and the focus on the new file input (L13)', removed.chip === 'No file' && removed.focused === 'base-file-input', removed);

  const xq = await pick(files['syn-ambiguous-xirr']);
  const questions = async () => page.eval(`[...document.querySelectorAll('#group-import-report .question')].map((q) => q.getAttribute('aria-label'))`);
  const q0 = await questions();
  expect('syn-ambiguous-xirr: two XIRR questions with their answers', q0.length === 2 && xq.chip === 'Read, waiting for Accept', q0);
  await page.click(await page.eval(CENTRE('#group-import-report .question button')));
  await sleep(500);
  const f1 = await page.eval(`(() => { const f = document.activeElement; return { body: !f || f === document.body, inQuestion: Boolean(f && f.closest && f.closest('#group-import-report .question')), id: f ? f.id : null }; })()`);
  const q1 = await questions();
  expect('answering the first question moves the focus to the next question, not the body (L13)', q1.length === 1 && !f1.body && f1.inQuestion, { f1, q1 });
  await page.click(await page.eval(CENTRE('#group-import-report .question button')));
  await sleep(500);
  const f2 = await page.eval(FOCUSED);
  const q2 = await questions();
  expect('answering the last question moves the focus to the import report heading (L13)', q2.length === 0 && f2 === 'group-import-report-heading', { f2, q2 });

  // syn-total-rows (M1.4 fix round 2, N1; D-041 point 3): its "Total" and "GRAND TOTAL" rows are skipped, and the
  // fund whose name only begins with "Total" stays a holding with a High result to acknowledge (KI-142).
  await pick(files['syn-total-rows']);
  await accept();
  const ackButton = await page.eval(`Boolean(document.querySelector('#group-validation .issue button'))`);
  expect('syn-total-rows: a High result with Acknowledge', ackButton, ackButton);
  if (ackButton) {
    await page.click(await page.eval(CENTRE('#group-validation .issue button')));
    await sleep(500);
    const fa = await page.eval(FOCUSED);
    const left = await page.eval(`document.querySelectorAll('#group-validation .issue button').length`);
    expect('after Acknowledge the focus moves to the validation heading, not the body', left === 0 && fa === 'group-validation-heading', { fa, left });
  }
  await tab('overview');
  const tl = await page.eval(OVERVIEW);
  await tab('uploads');
  expect('syn-total-rows: the "Total" and "GRAND TOTAL" rows were skipped (N1): the KPIs are syn-standard\'s 2.85 and 3.35, never doubled',
    tl.kpis[0] === '2.85' && tl.kpis[1] === '3.35', tl.kpis);

  // (D1, round 3) A file the browser cannot read, picked after that accepted file: a path that is not on the disk,
  // set with DOM.setFileInputFiles. No exception; the refusal sentence; the previous review is gone.
  const goneFile = path.join(path.dirname(files.notes), 'gone-from-disk.xlsx');
  fs.rmSync(goneFile, { force: true });
  const exceptionsBefore = page.exceptions.length;
  const gone = await pick(goneFile);
  const goneBar = await page.eval(BAR_FILE);
  await tab('overview');
  const goneOv = await page.eval(OVERVIEW);
  await tab('uploads');
  expect('(D1) a file gone from the disk, picked after an accepted file: no exception, "Refused: the file could not be read as an Excel workbook.", Accept not available, the focus on the new input, the review bar "Base file refused"',
    page.exceptions.length === exceptionsBefore && gone.chip === 'Refused' && /is-error/.test(gone.cls)
      && gone.status.includes('Refused: the file could not be read as an Excel workbook.') && gone.acceptUnavailable
      && gone.focused === 'base-file-input' && goneBar === 'Base file refused',
    { gone, bar: goneBar, exceptions: page.exceptions.slice(exceptionsBefore) });
  expect('(D1) the previous review is gone: no KPI, section 2 shows "Nothing to show yet"',
    goneOv.kpis.length === 0 && /^Nothing to show yet/.test(goneOv.empty ?? ''), { kpis: goneOv.kpis, empty: goneOv.empty });

  // 10. syn-all-classes and syn-single-entity [L2, L14]; a reload
  await pick(files['syn-all-classes']);
  await accept();
  await tab('overview');
  await sleep(600);
  for (const [w, h, mobile] of [[1440, 900, false], [375, 812, true]]) {
    await checkPies('syn-all-classes', w, h, mobile, (asset, width) => {
      const texts = asset.labels.map((l) => l.text);
      expect(`syn-all-classes at ${width} px: six slices, Unknown last in #D9D9D9, Commodity (1.53%) without a label`,
        asset.categories.length === 6 && asset.categories[5] === 'Unknown' && asset.colours[5] === '#D9D9D9'
          && asset.labels.length === 5 && !texts.some((t) => /Commodity|1\.5%/.test(t)),
        { categories: asset.categories, colours: asset.colours, labels: texts });
    });
  }
  await page.viewport(1440, 900);
  await tab('uploads');
  await pick(files['syn-single-entity']);
  await accept();
  await tab('overview');
  const single = await page.eval(OVERVIEW);
  expect('syn-single-entity: the single client and single distributor lines replace the matrices',
    /Single client: Sample Client A holds every included holding\./.test(single.clients ?? '')
      && /Single distributor: Centricity holds every included holding\./.test(single.distributors ?? ''), { clients: single.clients, distributors: single.distributors });

  // 11. (N12) The matrix notes count named columns (syn-blank-entities), the headers keep the file's letter case
  // (syn-case-variants), and an empty liquidity table is a sentence (every market value "NA").
  const show = async (file) => {
    await tab('uploads');
    await pick(file);
    await accept();
    await tab('overview');
    await sleep(400);
    return page.eval(OVERVIEW);
  };
  const blank = await show(files['syn-blank-entities']);
  expect('syn-blank-entities: "2 clients, and 2 holdings with no client" and "2 distributors, and 1 holding with no distributor", as the Clients KPI (2) (N12)',
    blank.clientNote === '2 clients, and 2 holdings with no client' && blank.distributorNote === '2 distributors, and 1 holding with no distributor'
      && blank.kpis[5] === '2', { clientNote: blank.clientNote, distributorNote: blank.distributorNote, clientsKpi: blank.kpis[5] });
  const cases = await show(files['syn-case-variants']);
  const distinct = (xs) => xs.length > 0 && new Set(xs).size === xs.length;
  expect('syn-case-variants: the client and distributor headers show the labels as the file spells them, each distinct on screen (N12)',
    distinct(cases.clientHeads) && cases.clientHeads.includes('Sample Client A') && cases.clientHeads.includes('SAMPLE CLIENT A')
      && distinct(cases.distributorHeads) && cases.distributorHeads.includes('Centricity') && cases.distributorHeads.includes('CENTRICITY'),
    { clients: cases.clientHeads, distributors: cases.distributorHeads });
  const allNa = await show(files['syn-all-na']);
  expect('every market value "NA": no liquidity table, the sentence "No liquidity line to show: not available in supplied data." (N12)',
    !allNa.liquidityTable && allNa.liquidityEmpty === 'No liquidity line to show: not available in supplied data.',
    { table: allNa.liquidityTable, sentence: allNa.liquidityEmpty });

  await page.reload();
  await page.waitFor(READY);
  await tab('uploads');
  const after = await page.eval(SLOT);
  const barAfter = await page.eval(OVERVIEW);
  expect('after a reload the logo choice is kept and no review data survives',
    after.chip === 'No file' && after.register.length === 0 && Boolean(logoInput ? barAfter.logo : true) && /No base file loaded/.test(barAfter.bar ?? ''),
    { chip: after.chip, logo: barAfter.logo, bar: barAfter.bar });
  const vEnd = await page.eval(VIOLATIONS);
  expect('no CSP violation, console error or exception at the end',
    vEnd.length === 0 && page.console.length === 0 && page.exceptions.length === 0 && page.log.length === 0,
    { violations: vEnd, console: page.console, exceptions: page.exceptions, log: page.log });
  console.log(`  (screenshots and downloads in ${path.relative(ROOT, out) || out})`);
}

main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err) => {
  console.error(`overview.cdp: ${err && err.stack ? err.stack : err}`);
  process.exitCode = 2;
});
