/* ============================================================================
   KI-124 (fix batch 2a, 22 Oct 2026) — the Home tab's "Download slide" button
   produced an empty deck.

   ensureDlBtns (UI script) put a "Download slide (PPTX)" bar on all 20 tabs,
   Home included. Home has no slide, tabHasContent() is true for it, so
   slidePPTX('home') wrote and downloaded a PowerPoint file with no slides
   ("…_Home_….pptx", 39 KB). Now:
     - there is no download bar on Home;
     - slidePPTX refuses, for ANY tab, a deck that would hold no slide: it says so
       on the status line and downloads nothing (Home is not special-cased).

   Known answers, independent of the fix: for every tab key (the 20 tabs, plus a
   key no slide builder knows), the deck the shipped exporters build is written
   to a buffer here and its slides are counted from the zip itself (the
   ppt/slides/slideN.xml parts), not from PptxGenJS. A tab whose deck has no
   slide must give a warning naming the tab and no download; a tab whose deck has
   slides must download it, with the same slide count. On the synthetic sample
   book Home has 0 slides and the AMC Allocation tab 1 or more.

   UI-BLOCK NOTE: the UI script (11_app_ui) cannot be loaded by Node. The code is
   cut out of the SHIPPED index.html by anchor and run with stubs:
     TABS                      '  var TABS=['                -> end of that line
     dlBar, ensureDlBtns       '  function dlBar(tabKey){'   -> '  /* a section header reflects its children'
     tabLabel, tabHasContent,
     slidePPTX                 '  function tabLabel(key){'   -> '  function renderAll(){'
   setStatus, triggerDownload, cvsFlush, cvsExportWarning and analyticsSrc are
   stubs that record what the code does. The decks are built by the shipped
   exporters (tools/engine-host.js); write() is asked for a Node buffer instead of
   a browser Blob. Synthetic data only (tools/make-sample-base.js).

     node tools/regression/KI-124-empty-slide-export.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const host = require('../engine-host.js');
const { build } = require('../make-sample-base.js');

const H = host.load();
const { XLSX, E, REF, Ppt } = H;

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const pre = (c, m) => { console.log((c ? 'PRE   ' : 'FAIL  precondition: ') + m); if (!c) fail++; };

/* ---------------- the shipped UI code, cut out by anchor ---------------- */
const html = fs.readFileSync(path.join(host.ROOT, 'index.html'), 'utf8');
function cut(from, to) {
  const a = html.indexOf(from);
  if (a < 0 || html.indexOf(from, a + 1) >= 0) throw new Error('anchor not found exactly once: ' + from);
  const b = html.indexOf(to, a + from.length);
  if (b < 0) throw new Error('end anchor "' + to + '" not found after "' + from + '"');
  return html.slice(a, b);
}
const SRC = [
  cut('  var TABS=[', '\n'),
  cut('  function dlBar(tabKey){', '  /* a section header reflects its children'),
  cut('  function tabLabel(key){', '  function renderAll(){')
].join('\n');
const PRELUDE = [
  'var sections = Object.create(null);',
  'var document = { getElementById: function(id){ return sections[id] || null; } };',
  'var model = null, E = null, anScope = "", ovDisplayIdx = null;',
  'var statusLog = [], downloads = [];',
  'function setStatus(msg, warn){ statusLog.push({ msg: String(msg), warn: !!warn }); }',
  'function triggerDownload(blob, fn){ downloads.push({ blob: blob, fn: fn }); }',
  'function cvsFlush(){}',
  'function cvsExportWarning(){ return ""; }',
  'function analyticsSrc(){ return model; }'
].join('\n');
const API = [
  'return {',
  '  tabs: function(){ return TABS.map(function(t){ return t[0]; }); },',
  '  label: function(k){ return tabLabel(k); },',
  '  ensure: function(secs){ for (var k in sections) delete sections[k]; Object.keys(secs).forEach(function(k){ sections[k] = secs[k]; }); ensureDlBtns(); },',
  '  slide: function(m, e, key){ model = m; E = e; statusLog.length = 0; downloads.length = 0; slidePPTX(key);',
  '    return { status: statusLog, downloads: downloads }; }',
  '};'
].join('\n');
const UI = new Function(PRELUDE + '\n' + SRC + '\n' + API)();

/* the slides of a written deck, counted from the zip's own part names */
function slidesIn(buf) {
  const s = Buffer.from(buf).toString('latin1');
  return new Set(s.match(/ppt\/slides\/slide\d+\.xml/g) || []).size;
}
/* the shipped exporters, with write() asked for a Node buffer (no Blob in Node) */
const writes = [];
const Ew = Object.assign({}, E, {
  buildPPTX: function (m, P, only) {
    const d = E.buildPPTX(m, P, only);
    const w = d.write.bind(d);
    d.write = o => { const pr = w(Object.assign({}, o, { outputType: 'nodebuffer', compression: false })); writes.push(pr); return pr; };
    return d;
  }
});
async function settle() {
  while (writes.length) { const w = writes.splice(0); await Promise.all(w.map(p => Promise.resolve(p).catch(() => null))); }
  await new Promise(r => setImmediate(r));
}
/* independent count: the deck for one tab, written and unzipped here */
async function deckSlides(model, key) {
  try {
    const buf = await E.buildPPTX(model, Ppt, key).write({ outputType: 'nodebuffer', compression: false });
    return slidesIn(buf);
  } catch (e) { return { error: String(e && e.message || e) }; }
}

async function main() {
  const fx = build(H);
  const wb = XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true });
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets['Base File'], { header: 1, raw: true });
  const model = E.computeReview(E.parseBaseRows(aoa), REF, { familyName: 'Sample Family', asOnDate: '30 Sep 2026' });
  const tabs = UI.tabs();
  pre(tabs.length === 20 && tabs[0] === 'home', 'the dashboard has 20 tabs, Home first (got ' + tabs.length + ')');

  /* ---------------- 1. no download bar on Home ---------------- */
  console.log('--- 1. the download bars ---');
  const secs = {}, bars = {};
  tabs.forEach(k => {
    bars[k] = [];
    secs['s-' + k] = { querySelector: () => null, insertAdjacentHTML: (where, h) => { bars[k].push(String(h)); } };
  });
  UI.ensure(secs);
  ok(bars.home.length === 0, 'Home gets no "Download slide" bar (got ' + bars.home.length + ')');
  const others = tabs.filter(k => k !== 'home');
  const right = others.filter(k => bars[k].length === 1 && bars[k][0].indexOf('data-tab="' + k + '"') >= 0);
  ok(right.length === others.length, 'every other tab gets one bar for itself (' + right.length + ' of ' + others.length + ')');

  /* ---------------- 2. a deck with no slide is never downloaded ---------------- */
  console.log('--- 2. slidePPTX: no empty deck, whatever the tab ---');
  const keys = tabs.concat(['ki124-no-such-tab']);
  const expect = {};
  for (const k of keys) expect[k] = await deckSlides(model, k);
  console.log('  slides per tab (counted from the written zip): ' + keys.map(k => k + ' ' +
    (typeof expect[k] === 'number' ? expect[k] : 'error')).join(', '));
  pre(expect.home === 0, 'independent: the Home deck holds 0 slides (got ' + JSON.stringify(expect.home) + ')');
  pre(typeof expect.amc === 'number' && expect.amc >= 1, 'independent: the AMC Allocation deck holds at least one slide (got ' + JSON.stringify(expect.amc) + ')');
  pre(expect['ki124-no-such-tab'] === 0, 'independent: a key no slide builder knows gives 0 slides');

  for (const k of keys) {
    const want = expect[k];
    if (typeof want !== 'number') { console.log('NOTE  ' + k + ': the deck could not be built headlessly (' + want.error + '); not checked'); continue; }
    const r = UI.slide(model, Ew, k);
    await settle();
    const got = r.downloads.map(d => ({ fn: d.fn, slides: slidesIn(d.blob) }));
    const st = r.status.map(s => (s.warn ? '[warn] ' : '') + s.msg.replace(/<[^>]+>/g, ''));
    const label = UI.label(k);
    if (want === 0) {
      ok(got.length === 0 && r.status.some(s => s.warn && s.msg.indexOf(label) >= 0),
        k + ': no slide, so nothing is downloaded and a warning names the "' + label + '" tab (got ' +
        (got.length ? 'a download ' + JSON.stringify(got) : 'no download') + '; status ' + JSON.stringify(st) + ')');
    } else {
      const refused = r.status.some(s => s.warn && /No exportable content/.test(s.msg));
      if (refused) { ok(got.length === 0, k + ': tabHasContent refuses it as before, nothing downloaded'); continue; }
      ok(got.length === 1 && got[0].slides === want,
        k + ': its ' + want + '-slide deck is downloaded (got ' + JSON.stringify(got) + '; status ' + JSON.stringify(st) + ')');
    }
  }
  const amc = UI.slide(model, Ew, 'amc'); await settle();
  ok(amc.downloads.length === 1 && /_AMC Allocation_/.test(amc.downloads[0].fn) && /\.pptx$/.test(amc.downloads[0].fn),
    'the AMC Allocation tab still downloads "…_AMC Allocation_….pptx" (got ' + JSON.stringify(amc.downloads.map(d => d.fn)) + ')');

  console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'all KI-124 checks passed'));
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.log('FAIL  ' + (e && e.stack || e)); process.exit(1); });
