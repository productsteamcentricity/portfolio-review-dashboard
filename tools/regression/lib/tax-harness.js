/* ============================================================================
   tax-harness.js — known-answer helpers for the taxation regression tests
   (KI-160 to KI-182, the tax review of 24 Oct 2026, CR-0008).

   Shared by tools/regression/KI-16x/17x/18x-*.js (this folder is not scanned by
   run-regression.js, which only runs the files directly in tools/regression/).

   A `Book` is a synthetic base file plus its IRR purchase history. Every lot is
   whole units at a stated price, so a lot's cost is units x price and its value
   units x the holding's NAV: each gain the tests expect is plain arithmetic in
   rupees, computed in the test, never by the engine. The holdings go through the
   SHIPPED parseBaseRows; computeTaxation and computeReview run through
   tools/engine-host.js. Dates are UTC midnight, as the IRR parser returns them.

   Screen: the Taxation tab's renderer and its helpers are cut out of index.html's
   UI script by anchor (the UI script cannot load in Node) and run against a fake
   DOM. Slides: the shipped exporter builds the 'tax' group and its slide XML is
   read back. AI Analyst: aiaSigTax is cut out of the engine script the same way,
   with aiaSig and aiaR2. Synthetic data only.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const HOST = require('../../engine-host.js');

let _H = null;
function host() { return _H || (_H = HOST.load()); }
const D = s => new Date(s + 'T00:00:00Z');
const CR = v => v / 1e7;                                   /* rupees to the engine's crore */
const RS = v => v == null ? null : Math.round(v * 1e7 * 100) / 100;   /* crore back to rupees, to the paisa */

const HEAD = ['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'AMC', 'Product Name', 'Distributor Name',
  'Units', 'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Total Gain/Loss (Cr.)'];

/* add({client, name, product, asset, category, nav, lots:[[ 'YYYY-MM-DD', units, price ], ...], noUnits}) */
function Book() { this.rows = []; this.tx = []; }
Book.prototype.add = function (o) {
  const units = o.lots.reduce((s, l) => s + l[1], 0);
  const cost = o.lots.reduce((s, l) => s + l[1] * l[2], 0);
  const cmv = units * o.nav;
  this.rows.push([o.client || 'Client A', o.name, o.category == null ? '' : o.category, o.asset == null ? '' : o.asset, o.amc || '',
    o.product == null ? '' : o.product, 'Centricity', o.noUnits ? null : units, CR(cost), CR(cmv), CR(cmv - cost)]);
  o.lots.forEach(l => this.tx.push({ client: o.client || 'Client A', instrument: o.name, ttype: 'Purchase', rtype: '',
    d: D(l[0]), a: -l[1] * l[2], price: o.noUnits ? null : l[2] }));
  return this;
};
/* trade({client, name, date:'YYYY-MM-DD', units, price, type}): an IRR trade only, not in the base row
   (tax batch T2: a trade after the valuation date). A sale is a positive amount, a purchase negative. */
Book.prototype.trade = function (o) {
  const sell = /redemption|sell|switch[- ]?out/i.test(o.type || '');
  this.tx.push({ client: o.client || 'Client A', instrument: o.name, ttype: o.type || 'Purchase', rtype: '',
    d: D(o.date), a: (sell ? 1 : -1) * o.units * o.price, price: o.price });
  return this;
};
/* opts.valuationDate (tax batch T2, KI-176): the cell value of a "Valuation Date" column on every row */
Book.prototype.parsed = function (opts) {
  if (!opts || opts.valuationDate === undefined) return host().E.parseBaseRows([HEAD].concat(this.rows));
  return host().E.parseBaseRows([HEAD.concat(['Valuation Date'])].concat(this.rows.map(r => r.concat([opts.valuationDate]))));
};
/* REF with this book's IRR history; a Closing row per holding on `asOn` sets the IRR date */
Book.prototype.ref = function (asOn) {
  const H = host();
  const closes = asOn ? this.rows.map(r => ({ client: r[0], instrument: r[1], ttype: '', rtype: 'Closing', d: D(asOn), a: r[9] * 1e7, price: null })) : [];
  const fund = this.tx.concat(closes);
  let maxd = null; fund.forEach(t => { if (!maxd || t.d > maxd) maxd = t.d; });
  return Object.assign({}, H.REF, { IRR: { fund: fund, bench: [], date: maxd } });
};
/* assume (tax batch T3): the analyst's harvest assumptions, {clients: {name: {slabPct, usedRs}}} */
Book.prototype.tax = function (asOn, refOverride, assume) {
  const H = host();
  return H.E.computeTaxation(this.parsed(), refOverride || this.ref(null), D(asOn), assume);
};
/* tax batch T3 (KI-168): every client of this book has used its Rs 1.25 lakh Sec 198 exemption this tax
   year, so a long-term gain is taxed at 12.5% on the whole gain. The tests written before the exemption
   (KI-160 to KI-180) state their tax figures that way; the exemption itself is tested in KI-168. */
Book.prototype.exemptionUsed = function () {
  const c = {}; this.rows.forEach(r => { c[r[0]] = { usedRs: 125000 }; }); return { clients: c };
};
/* the whole review (as the page computes it). The IRR sheet's Closing rows are dated `asOn`. With no
   opts the review has no portfolio date and no base-file valuation date, so holding periods run to the
   IRR sheet's latest date (`asOn`). opts.asOnDate is the portfolio date ("d Mon yyyy", as the page's
   date picker gives it); opts.valuationDate a base-file "Valuation Date" cell (tax batch T2, KI-176);
   opts.taxAssume the analyst's harvest assumptions (tax batch T3). */
Book.prototype.review = function (asOn, opts) {
  const H = host();
  opts = opts || {};
  return H.E.computeReview(this.parsed(opts), this.ref(asOn), { familyName: 'Synthetic Family', asOnDate: opts.asOnDate || '', taxAssume: opts.taxAssume });
};

/* ---- screen: the Taxation tab, cut out of the UI script ---- */
function readHtml() { return fs.readFileSync(path.join(HOST.ROOT, 'index.html'), 'utf8'); }
function cutBetween(html, a, b) {
  const i = html.indexOf(a);
  if (i < 0) throw new Error('anchor not found: ' + JSON.stringify(a.slice(0, 70)));
  if (html.indexOf(a, i + 1) >= 0) throw new Error('anchor not unique: ' + JSON.stringify(a.slice(0, 70)));
  const j = html.indexOf(b, i + a.length);
  if (j < 0) throw new Error('end anchor not found: ' + JSON.stringify(b.slice(0, 70)));
  return html.slice(i, j);
}
function renderTaxTab(model, scope) {
  const html = readHtml();
  /* taxScope, taxView, taxEsc, taxRate, taxLtAfter, taxU, TAX_MON and taxD: up to the end of taxD's line */
  const h0 = cutBetween(html, '  var taxScope=null;', '  function taxD(d){');
  const helpers = h0 + cutBetween(html, '  function taxD(d){', '\n');
  const render = cutBetween(html, '  function renderTaxation(){', '  /* Taxation exports like any other tab now');
  const el = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  const doc = { getElementById: id => (id === 's-tax' ? el : null) };
  const win = {};
  const f = new Function('model', 'document', 'window',
    'function taxCss(){}\nfunction dlBarSafe(){ return ""; }\n' + helpers + '\n' + render +
    '\nreturn { render: renderTaxation, scope: function(s){ taxScope = s; } };');
  const api = f(model, doc, win);
  if (scope) api.scope(scope);
  api.render();
  return el.innerHTML;
}
/* tax batch T3: the tab with its harvest-assumption inputs live. The fake DOM hands the renderer one input object per
   <input class="taxas"> in the HTML it wrote; setting .value and calling .onchange() runs the shipped handler, which
   recomputes through ENGINE.taxApplyAssumptions and renders again. */
function taxTabLive(model) {
  const html = readHtml();
  const helpers = cutBetween(html, '  var taxScope=null;', '  function taxD(d){') + cutBetween(html, '  function taxD(d){', '\n');
  const render = cutBetween(html, '  function renderTaxation(){', '  /* Taxation exports like any other tab now');
  let inputs = [];
  const el = {
    innerHTML: '', querySelector: () => null,
    querySelectorAll: sel => {
      if (sel !== 'input.taxas') return [];
      inputs = [];
      const re = /<input class="taxas" data-ci="(\d+)" data-k="(\w+)"[^>]*value="([^"]*)"/g; let m;
      while ((m = re.exec(el.innerHTML))) { const a = { 'data-ci': m[1], 'data-k': m[2] }; inputs.push({ value: m[3], getAttribute: n => a[n] }); }
      return inputs;
    }
  };
  const win = {};
  const f = new Function('model', 'document', 'window', 'E',
    'function taxCss(){}\nfunction dlBarSafe(){ return ""; }\n' + helpers + '\n' + render +
    '\nreturn { render: renderTaxation, assume: function(){ return taxAssume; } };');
  const api = f(model, { getElementById: id => (id === 's-tax' ? el : null) }, win, host().E);
  api.render();
  return {
    html: () => el.innerHTML, window: win, assume: api.assume,
    input: (ci, k) => inputs.find(x => x.getAttribute('data-ci') === String(ci) && x.getAttribute('data-k') === k),
    set: (ci, k, v) => { const x = inputs.find(y => y.getAttribute('data-ci') === String(ci) && y.getAttribute('data-k') === k); x.value = v; x.onchange(); }
  };
}
const text = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
  .replace(/&amp;/g, '&').replace(/&rsquo;/g, '’').replace(/&middot;/g, '·').replace(/\s+/g, ' ');

/* ---- slides: the tax group's slide XML, as text ---- */
async function taxSlidesText(model) {
  const H = host();
  const buf = await H.E.buildPPTX(model, H.Ppt, 'tax').write({ outputType: 'nodebuffer' });
  const zip = await global.JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const xml = (await Promise.all(names.map(n => zip.file(n).async('string')))).join('\n');
  return xml.replace(/<[^>]+>/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}

/* ---- AI Analyst: the tax signal, cut out of the engine script ---- */
function aiaTaxSignal(h, model) {
  const html = readHtml();
  const sig = cutBetween(html, '  function aiaSig(id, label, verdict, evidence, text){', '\n  }\n') + '\n  }\n';
  const r2 = cutBetween(html, '  function aiaR2(v){', '\n');
  const fn = cutBetween(html, '  function aiaSigTax(h, model){', '\n  }\n') + '\n  }\n';
  const f = new Function('h', 'model', 'var AIA_WEIGHTS={tax:1};\n' + sig + r2 + '\n' + fn + '\nreturn aiaSigTax(h, model);');
  return f(h, model);
}

/* ---- result printing ---- */
function checker() {
  let fail = 0;
  const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
  const done = () => { console.log(fail ? '\n' + fail + ' check(s) FAILED' : '\nall checks passed'); process.exit(fail ? 1 : 0); };
  return { ok, done };
}
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= (tol == null ? 0.005 : tol);   /* rupees, half a paisa */

module.exports = { host, D, CR, RS, Book, renderTaxTab, taxTabLive, text, taxSlidesText, aiaTaxSignal, checker, near };
