/* ============================================================================
   cvs-harness.js — runs the SHIPPED Current vs Sample (CVS) code headlessly.

   Shared by tools/regression/KI-067-*.js and KI-068-*.js (this folder is not
   scanned by run-regression.js, which only runs the files directly in
   tools/regression/).

   renderCVS lives in the UI script (11_app_ui), which Node cannot load as a
   whole (it wires the page at load). So the CVS section is cut out of
   index.html by its own anchors — from the "renderCVS (Current vs Sample
   Portfolio)" banner to "function triggerDownload(" — and evaluated against:
     - a minimal fake DOM (s-cvs, the table wrapper, the inputs it writes),
     - an engine-built model (tools/engine-host.js) as `model`,
     - the embedded reference data as `activeRef`,
     - stubs for the rebalancing helpers it reads (rbRebalancedHoldings,
       rbPostAnalytics), built here exactly as the UI builds them,
     - rbEsc cut from index.html, dlBar stubbed to '', fake timers.
   window._cvsSnapshot is written to the Node global, which is the `window`
   the exporters read, so a slide built afterwards sees what the screen shows.
   loadExports cuts the two PowerPoint export paths (slidePPTX and the deck
   button's onclick) the same way, to read the status line an export leaves.
   Synthetic data only.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('../../engine-host.js');

function readHtml() { return fs.readFileSync(path.join(H.ROOT, 'index.html'), 'utf8'); }

function cutBetween(html, a, b) {
  const i = html.indexOf(a);
  if (i < 0) throw new Error('anchor not found: ' + JSON.stringify(a.slice(0, 70)));
  if (html.indexOf(a, i + 1) >= 0) throw new Error('anchor not unique: ' + JSON.stringify(a.slice(0, 70)));
  const j = html.indexOf(b, i + a.length);
  if (j < 0) throw new Error('end anchor not found: ' + JSON.stringify(b.slice(0, 70)));
  return html.slice(i, j);
}

/* the body of a top-level UI function: from its declaration to the first line that is
   exactly the two-space closing brace (its own statements are indented further) */
function uiFunction(html, decl, close) {
  const i = html.indexOf(decl);
  if (i < 0) return null;
  const j = html.indexOf(close || '\n  }\n', i);
  return j < 0 ? null : html.slice(i, j + (close || '\n  }\n').length);
}

function fakeTimers() {
  let q = [], id = 0;
  return {
    setTimeout(fn, ms) { const t = { id: ++id, fn, ms }; q.push(t); return t.id; },
    clearTimeout(i) { q = q.filter(t => t.id !== i); },
    pending() { return q.length; },
    run() { const cur = q; q = []; cur.forEach(t => t.fn()); return cur.length; }
  };
}

function fakeDom() {
  const els = {}, known = new Set(['s-cvs']);
  let inputs = [];
  const writes = { 's-cvs': 0, 'cvs-tbl-wrap': 0 };
  function parseInputs(html) {
    const out = [], re = /<input type="number" class="cvs-num"([^>]*)>/g; let m;
    while ((m = re.exec(html))) {
      const at = m[1], g = (at.match(/data-g="(\d+)"/) || [])[1], r = (at.match(/data-r="(\d+)"/) || [])[1],
        f = (at.match(/data-field="([^"]+)"/) || [])[1], v = (at.match(/value="([^"]*)"/) || [])[1],
        un = (at.match(/data-un="([^"]+)"/) || [])[1];   /* the Unallocated row's Exp. Return cells (KI-067) */
      const ds = { g, r, field: f }; if (un) ds.un = un;
      out.push({ dataset: ds, value: v, oninput: null, onchange: null });
    }
    return out;
  }
  function mk(id) {
    const e = { id, style: {}, attrs: {}, value: '', onclick: null, onchange: null, _html: '',
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; } };
    Object.defineProperty(e, 'innerHTML', {
      get() { return this._html; },
      set(v) { this._html = String(v); if (writes[id] != null) writes[id]++; onHtml(this, this._html); }
    });
    return e;
  }
  function el(id) { return els[id] || (els[id] = mk(id)); }
  function onHtml(e, html) {
    const re = /id="([^"]+)"[^>]*?>/g; let m;
    while ((m = re.exec(html))) {
      known.add(m[1]);
      const mv = m[0].match(/value="([^"]*)"/);
      if (mv) el(m[1]).value = mv[1];
    }
    if (e.id === 's-cvs' || e.id === 'cvs-tbl-wrap') {
      inputs = parseInputs(html);
      if (e.id === 's-cvs') el('cvs-tbl-wrap')._html = html;   /* the table sits inside s-cvs until rebuildCVS replaces it */
    }
  }
  const document = {
    getElementById: id => (known.has(id) ? el(id) : null),
    querySelectorAll: sel => (sel === '#s-cvs .cvs-num' ? inputs : []),
    querySelector: () => null
  };
  return {
    document, el, writes,
    tableHtml: () => el('cvs-tbl-wrap')._html,
    sectionHtml: () => el('s-cvs')._html,
    /* what an analyst typing into a CVS cell does: set the value, fire input, then commit it
       (Enter or leaving the cell fires change; KI-114: only the commit redraws the table) */
    type(g, r, field, value) {
      const inp = inputs.find(x => x.dataset.g === String(g) && x.dataset.r === String(r) && x.dataset.field === field);
      if (!inp || typeof inp.oninput !== 'function' || typeof inp.onchange !== 'function') return false;
      inp.value = String(value); inp.oninput.call(inp); inp.onchange.call(inp); return true;
    },
    /* the Unallocated row's Exp. Return cell: k = 'cr' (current) or 'pr' (sample); '' clears it */
    typeUn(k, value) {
      const inp = inputs.find(x => x.dataset.un === k);
      if (!inp || typeof inp.oninput !== 'function' || typeof inp.onchange !== 'function') return false;
      inp.value = String(value); inp.oninput.call(inp); inp.onchange.call(inp); return true;
    },
    /* keystrokes only, no commit yet: returns the input object so a test can check it was not replaced */
    keyUn(k, value) {
      const inp = inputs.find(x => x.dataset.un === k);
      if (!inp || typeof inp.oninput !== 'function') return null;
      inp.value = String(value); inp.oninput.call(inp); return inp;
    },
    /* commit the cell (what Enter or leaving it does) */
    commitUn(k) {
      const inp = inputs.find(x => x.dataset.un === k);
      if (!inp || typeof inp.onchange !== 'function') return false;
      inp.onchange.call(inp); return true;
    },
    unInput(k) { return inputs.find(x => x.dataset.un === k) || null; },
    /* keystrokes only in a group-row cell (g, r, field), no commit yet; returns the input object */
    keyCell(g, r, field, value) {
      const inp = inputs.find(x => x.dataset.g === String(g) && x.dataset.r === String(r) && x.dataset.field === field);
      if (!inp || typeof inp.oninput !== 'function') return null;
      inp.value = String(value); inp.oninput.call(inp); return inp;
    },
    cellInput(g, r, field) { return inputs.find(x => x.dataset.g === String(g) && x.dataset.r === String(r) && x.dataset.field === field) || null; },
    /* the Unallocated row's Exp. Return inputs as rendered: { cr: value, pr: value } (undefined = no input) */
    unInputs() { const o = {}; inputs.filter(x => x.dataset.un).forEach(x => { o[x.dataset.un] = x.value; }); return o; }
  };
}

function memStorage() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } };
}

/* A holding row as rbRebalancedHoldings builds it: held rows are copies with the
   new CMV (all own fields, engine keys included); a proposed fund that is not held
   is a bare row named after the fund, client "Proposed". */
function rebalanced(holdings, cmvByName, proposed) {
  const out = [];
  holdings.forEach(h => {
    const nc = (cmvByName && Object.prototype.hasOwnProperty.call(cmvByName, h.name)) ? cmvByName[h.name] : h.cmvCr;
    if (!(nc > 1e-9)) return;
    const c = {}; for (const p in h) if (Object.prototype.hasOwnProperty.call(h, p)) c[p] = h[p];
    c.cmvCr = nc; c.mvR = nc * 1e7; out.push(c);
  });
  (proposed || []).forEach(p => out.push({ client: 'Proposed', name: p.name, category: '', asset: p.asset, folio: '', amc: '',
    product: p.product || 'Mutual Funds', distributor: '', purchaseDate: '', units: null,
    invR: p.cmvCr * 1e7, mvR: p.cmvCr * 1e7, glR: 0, invCr: p.cmvCr, cmvCr: p.cmvCr, glCr: 0,
    liquidity: null, allocFrac: null, xirrFrac: null }));
  return out;
}

/* Cut the CVS section and bind it to a fresh fake page. env: { E, REF, model, activeRef? }
   activeRef (default REF) is the reference data the CVS code reads; the models are always
   built with REF. A test passes a modified copy to exercise a reference record that the
   embedded data does not contain (synthetic). */
function loadCvs(env) {
  const html = readHtml();
  const src = cutBetween(html, '  /* ======== renderCVS (Current vs Sample Portfolio) ======== */\n', '  function triggerDownload(blob, fn){\n');
  const escLine = cutBetween(html, '  function rbEsc(x){', '\n');
  const dom = fakeDom(), timers = fakeTimers(), storage = memStorage();
  const state = { plan: null };   /* null = no rebalancing actions */
  const hooks = {
    reb: () => rebalanced(env.model.holdings, state.plan && state.plan.cmv, state.plan && state.plan.proposed),
    /* rbPostAnalytics: the rebalanced rows put back through computeReview (fresh copies: computeReview writes match keys) */
    post: () => env.E.computeReview(hooks.reb(), env.REF, { familyName: 'Sample Family', asOnDate: '30 Sep 2026' }),
    postOff: false
  };
  const prefix = 'var model=null;\n' +
    'function rbRebalancedHoldings(){ return __hooks.reb(); }\n' +
    'function rbPostAnalytics(){ return __hooks.postOff ? null : __hooks.post(); }\n' +
    escLine + '\n';
  /* dropLive: the statement resetFamilyState runs on the CVS section's state (`__cvsLive=null`;
     KI-068-cvs-refresh.js checks statically that resetFamilyState contains it). A no-op on a
     build without __cvsLive. */
  const suffix = '\nreturn { renderCVS: renderCVS, setModel: function(m){ model=m; },\n' +
    '  cvsRefreshFromPlan: (typeof cvsRefreshFromPlan==="function")?cvsRefreshFromPlan:null,\n' +
    '  cvsRefreshSoon: (typeof cvsRefreshSoon==="function")?cvsRefreshSoon:null,\n' +
    '  cvsFlush: (typeof cvsFlush==="function")?cvsFlush:null,\n' +
    '  cvsCancelRefresh: (typeof cvsCancelRefresh==="function")?cvsCancelRefresh:null,\n' +
    '  cvsExportWarning: (typeof cvsExportWarning==="function")?cvsExportWarning:null,\n' +
    '  dropLive: function(){ if(typeof __cvsLive!=="undefined") __cvsLive=null; } };';
  const factory = new Function('__hooks', 'document', 'window', 'localStorage', 'setTimeout', 'clearTimeout', 'dlBar', 'activeRef',
    prefix + src + suffix);
  global.__cvsEdited = {}; global._cvsSnapshot = null;
  const api = factory(hooks, dom.document, global, storage, timers.setTimeout, timers.clearTimeout, () => '', env.activeRef || env.REF);
  api.setModel(env.model);
  return {
    api, dom, timers, hooks,
    setPlan(p) { state.plan = p; },
    setModel(m) { env.model = m; api.setModel(m); },
    snap: () => global._cvsSnapshot,
    /* snapshot value: group gi, row ri, field ca|cr|pa|pr */
    cell: (gi, ri, f) => { const s = global._cvsSnapshot; return s && s.groups[gi] && s.groups[gi].rows[ri] ? s.groups[gi].rows[ri][f] : undefined; }
  };
}

/* The two PowerPoint export paths of the UI script, cut out of index.html by anchor and bound to
   a harness's CVS section (its cvsFlush and cvsExportWarning, which read the same
   window._cvsSnapshot): slidePPTX(tabKey), the one-slide export, and the deck button's onclick
   (the full deck, or the slides picked in the side menu). E.buildPPTX is a stub that records what
   it was asked to build (the real slide is checked with cvsSlideText); setStatus and the download
   are captured. The status line is what the analyst reads after the export.
     const X = loadExports(cv, model);
     await X.slide('cvs')      -> the last status { msg, warn }
     await X.deck()            -> the same, full deck; X.deck(['cvs', 'amc']) a picked deck */
function loadExports(cv, model) {
  const html = readHtml();
  const slide = uiFunction(html, '  function slidePPTX(tabKey){\n');
  const deck = uiFunction(html, "  document.getElementById('dlppt').onclick=function(){\n", '\n  };\n');
  if (!slide || !deck) throw new Error('export paths not found in index.html');
  const log = { status: [], built: [], downloads: [] };
  const btn = { disabled: false, textContent: 'Download PPT', onclick: null };
  const E = { buildPPTX(m, P, only) { log.built.push(only === undefined ? '(full deck)' : only); return { write: () => Promise.resolve({ pptx: true }) }; } };
  let pick = [];
  const prefix = 'var PptxGenJS=function(){};\nvar TABS=[], anScope=null;\n' +
    'function tabLabel(k){ return k; }\nfunction tabHasContent(){ return true; }\nfunction analyticsSrc(){ return model; }\n' +
    'function slidePickArg(){ var l=__pick(); return l.length ? l : undefined; }\n';
  const f = new Function('model', 'E', 'setStatus', 'triggerDownload', 'cvsFlush', 'cvsExportWarning', '__pick', 'document',
    prefix + slide + '\n' + deck + '\nreturn { slide: slidePPTX };');
  const api = f(model, E, (msg, warn) => log.status.push({ msg: String(msg), warn: !!warn }), (blob, fn) => log.downloads.push(fn),
    cv.api.cvsFlush || function () {}, cv.api.cvsExportWarning || function () { return ''; }, () => pick,
    { getElementById: id => (id === 'dlppt' ? btn : null) });
  const settle = () => new Promise(r => setImmediate(r));
  const last = () => log.status[log.status.length - 1] || null;
  return {
    log,
    async slide(tabKey) { api.slide(tabKey); await settle(); return last(); },
    async deck(picked) { pick = picked || []; btn.onclick.call(btn); await settle(); return last(); }
  };
}

/* the synthetic sample book (tools/make-sample-base.js), parsed and reviewed as the dashboard does */
function sampleModel(host) {
  const { build } = require('../../make-sample-base.js');
  const fx = build(host);
  const wb = host.XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true });
  const aoa = host.XLSX.utils.sheet_to_json(wb.Sheets['Base File'] || wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true });
  const rows = host.E.parseBaseRows(aoa);
  return { fx, model: host.E.computeReview(rows, host.REF, { familyName: 'Sample Family', asOnDate: '30 Sep 2026' }) };
}

/* a hand-built book: spec rows [name, category, asset, amc, cmvCr, product?] */
const HDR = ['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'Folio No', 'AMC', 'Product Name', 'Distributor Name', 'Units',
  'Invested Value (₹)', 'Market Value (₹)', 'Total Gain/Loss (₹)', 'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Total Gain/Loss (Cr.)',
  'Allocation (%)', 'XIRR (%)', 'BMXIRR (%)', 'Avg. Holding Days', 'Purchase Date'];
function bookModel(host, spec) {
  const tot = spec.reduce((s, r) => s + r[4], 0);
  const aoa = [HDR].concat(spec.map((r, i) => {
    const rs = r[4] * 1e7;
    return ['Synthetic Client', r[0], r[1], r[2], 'SYN-' + (1001 + i), r[3], r[5] || 'Mutual Funds', 'Centricity',
      1000, rs * 0.8, rs, rs * 0.2, r[4] * 0.8, r[4], r[4] * 0.2, r[4] / tot, 10, 9, 500, new Date(2024, 0, 15)];
  }));
  return host.E.computeReview(host.E.parseBaseRows(aoa), host.REF, { familyName: 'Synthetic Family', asOnDate: '30 Sep 2026' });
}

/* every on-screen table row whose first cell reads `label`, as an array of cell texts (tags
   stripped; an input cell reads "[value]", so a blank input is "[]") */
function rowCells(html, label) {
  const out = [];
  String(html || '').split(/<tr\b/).slice(1).forEach(chunk => {
    const end = chunk.indexOf('</tr>'), row = end >= 0 ? chunk.slice(0, end) : chunk;
    const cells = [], re = /<td\b[^>]*>([\s\S]*?)<\/td>/g; let m;
    while ((m = re.exec(row))) {
      const inp = m[1].match(/<input\b[^>]*\svalue="([^"]*)"/);
      cells.push(inp ? '[' + inp[1] + ']' : m[1].replace(/<[^>]+>/g, '').trim());
    }
    if (cells.length && cells[0] === label) out.push(cells);
  });
  return out;
}

/* the CVS slide's text runs, from an uncompressed deck of just that slide */
async function cvsSlideText(host, model) {
  const buf = await host.E.buildPPTX(model, host.Ppt, 'cvs').write({ outputType: 'nodebuffer', compression: false });
  const s = Buffer.from(buf).toString('utf8');
  const parts = s.split(/(?=<\?xml)/);
  const slide = parts.find(p => p.indexOf('CURRENT VS SAMPLE PORTFOLIO') >= 0) || '';
  return (slide.match(/<a:t>[^<]*<\/a:t>/g) || []).map(x => x.replace(/<\/?a:t>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
}

module.exports = { readHtml, cutBetween, uiFunction, loadCvs, loadExports, sampleModel, bookModel, rebalanced, rowCells, cvsSlideText };
