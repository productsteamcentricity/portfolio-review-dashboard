/* ============================================================================
   KI-007 — a blank invested value stays blank; it never becomes 0.

     node tools/regression/KI-007-blank-invested.js

   Before the fix parseBaseRows stored a blank Invested Value as 0. The holding
   then showed 0.00 invested, the review's Total Gain/Loss (CMV - invested)
   counted its whole market value as gain, and Taxation treated it as all gain
   (its glMissing count stayed 0, so nothing warned).

   After the fix the holding's invested value is null and shows "—"; invested
   value and gain/loss are totalled only over holdings that have an invested
   value, every aggregate carries an invMissing count, a footnote names the
   count, and Taxation takes its existing glMissing path. The gain/loss
   definitions themselves are unchanged (owner question OD-18 is pending).

   Known answers come straight from the synthetic base file
   (tools/make-sample-base.js): the expected subtotals are sums of the file's own
   Invested Value (Cr.) / Current Market Value (Cr.) / Total Gain/Loss (Cr.)
   cells over the holdings that keep an invested value, computed here from the
   sheet, not by the engine. The audit's figures for the same book
   (pr-audit verify-xlsx-10) are also checked: Client A Equity invested 1.40,
   Equity / Mutual Funds 0.50, Grand Total 2.60; family Equity invested 3.45,
   family invested 5.35.

   Also: a partial subtotal's Absolute Return % (G/L over invested, both over
   the same holdings) is marked ‡ on the Holdings tab and slide, and the
   Taxation totals slide says its G/L columns leave the holding out.

   Display checks: the workbook and the deck are built by the shipped exporters.
   The on-screen checks (Holdings tab, Asset Allocation tab, Rebalancing
   Holding Sheet) cut renderHoldings, renderAsset, rbHoldSheetRows and the
   pe / neg / czAbsRet helpers out of index.html's UI script by anchor, and
   evaluate them with stubbed inputs (document, Chart, column registry,
   rebalancing plan = none), because Node cannot load the UI script itself.

   Synthetic data only. Exit code 1 on any failure.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { load, ROOT } = require('../engine-host.js');
const { build } = require('../make-sample-base.js');

const H = load();
const { XLSX, E, Ppt } = H;
const fx = build(H);

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= (tol || 1e-9);
const aoaOf = (wb, n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
const META = { familyName: 'Sample Family', asOnDate: '30 Sep 2026' };
const A = 'Sample Client A', B = 'Sample Client B';
const D = '—', DAG = '‡';

const wb0 = XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true });
const base0 = aoaOf(wb0, 'Base File');
const hdr = base0[0];
const col = n => { const i = hdr.indexOf(n); if (i < 0) throw new Error('no column ' + n); return i; };
const cCl = col('Client Name'), cNm = col('Instrument Name'), cAs = col('Asset Name'), cPr = col('Product Name');
const cInvR = col('Invested Value (₹)'), cInvC = col('Invested Value (Cr.)'), cGlR = col('Total Gain/Loss (₹)'),
  cGlC = col('Total Gain/Loss (Cr.)'), cCmvC = col('Current Market Value (Cr.)');

/* the target: Client A's large-cap fund (the audit's repro blanked the same row) */
const ti = base0.findIndex((r, i) => i > 0 && r[cCl] === A && r[cPr] === 'Mutual Funds' && r[cAs] === 'Equity');
const target = base0[ti][cNm];
function blanked(rowIdx, alsoGL) {
  const a = base0.map(r => r.slice());
  rowIdx.forEach(i => { a[i][cInvR] = null; a[i][cInvC] = null; if (alsoGL) { a[i][cGlR] = null; a[i][cGlC] = null; } });
  return a;
}
const irrWb = XLSX.read(fx.irrBuf, { type: 'buffer', cellDates: true });
const irr = E.parsers.parseIRR(irrWb.SheetNames, n => aoaOf(irrWb, n));
const REFI = Object.assign({}, H.REF, { IRR: irr });

/* independent sums over the sheet's own cells */
const sheetRows = (a, f) => a.slice(1).filter(r => r && r[cNm] && f(r));
const sumCol = (rows, c) => rows.reduce((s, r) => s + (typeof r[c] === 'number' ? r[c] : 0), 0);
const hasInv = r => typeof r[cInvC] === 'number';

/* ================= engine ================= */
console.log('--- parse ---');
const aBoth = blanked([ti], true);
const rowsBoth = E.parseBaseRows(aBoth);
const hx = rowsBoth.find(h => h.client === A && h.name === target);
ok(hx.invCr === null && hx.invR === null, 'a blank invested value parses as null, not 0 (invCr ' + hx.invCr + ')');
ok(rowsBoth.filter(h => h !== hx).every(h => typeof h.invCr === 'number'), 'the other holdings keep their invested values');

/* duplicate folios merge: one folio without an invested value leaves the merged holding without one */
const mh = ['Client Name', 'Instrument Name', 'Asset Name', 'Product Name', 'Distributor Name', 'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Total Gain/Loss (Cr.)'];
const mBlank = E.parseBaseRows([mh, ['C', 'X Fund', 'Equity', 'Mutual Funds', 'D', 1, 1.5, 0.5], ['C', 'X Fund', 'Equity', 'Mutual Funds', 'D', null, 0.5, null]]);
const mFull = E.parseBaseRows([mh, ['C', 'X Fund', 'Equity', 'Mutual Funds', 'D', 1, 1.5, 0.5], ['C', 'X Fund', 'Equity', 'Mutual Funds', 'D', 0.4, 0.5, 0.1]]);
ok(mBlank.length === 1 && mBlank[0].invCr === null && near(mBlank[0].cmvCr, 2.0), 'merged folios: one blank invested value leaves the holding blank (got ' + mBlank[0].invCr + ')');
ok(mFull.length === 1 && near(mFull[0].invCr, 1.4), 'merged folios: invested values that are all present still add up (' + mFull[0].invCr + ')');

console.log('--- client sheet, totals, asset allocation (no IRR) ---');
const m = E.computeReview(rowsBoth, H.REF, META);
const clA = m.clients.find(c => c.name === A), clB = m.clients.find(c => c.name === B);
const rowOf = (cl, level, label, asset) => { let cur = null; return cl.rows.find(r => { if (r.level === 'asset') cur = r.label;
  return r.level === level && r.label === label && (asset == null || cur === asset); }); };
const item = rowOf(clA, 'item', target);
ok(item && item.inv === null, 'client sheet: the holding\'s invested value is blank, not 0 (got ' + (item && item.inv) + ')');

const keep = sheetRows(aBoth, r => r[cCl] === A && hasInv(r));
const expInv = f => sumCol(keep.filter(f), cInvC), expGl = f => sumCol(keep.filter(f), cGlC);
const eqA = rowOf(clA, 'asset', 'Equity'), mfA = rowOf(clA, 'product', 'Mutual Funds', 'Equity'), gA = rowOf(clA, 'grand', 'Grand Total');
const isEq = r => r[cAs] === 'Equity', isEqMf = r => r[cAs] === 'Equity' && r[cPr] === 'Mutual Funds', all = () => true;
ok(near(eqA.inv, expInv(isEq)) && near(eqA.inv, 1.40, 1e-9) && near(eqA.gl, expGl(isEq)),
  'Client A Equity: invested ' + eqA.inv.toFixed(4) + ' and G/L ' + eqA.gl.toFixed(4) + ' total only holdings with an invested value (expected 1.40 / ' + expGl(isEq).toFixed(4) + ')');
ok(near(mfA.inv, expInv(isEqMf)) && near(mfA.inv, 0.50) && near(mfA.gl, expGl(isEqMf)),
  'Client A Equity / Mutual Funds: invested ' + mfA.inv.toFixed(4) + ', G/L ' + mfA.gl.toFixed(4) + ' (expected 0.50 / ' + expGl(isEqMf).toFixed(4) + ')');
ok(near(gA.inv, expInv(all)) && near(gA.inv, 2.60) && near(gA.gl, expGl(all)) && near(clA.totalInv, 2.60),
  'Client A Grand Total: invested ' + gA.inv.toFixed(4) + ', G/L ' + gA.gl.toFixed(4) + ' (expected 2.60 / ' + expGl(all).toFixed(4) + ')');
ok(eqA.invMissing === 1 && mfA.invMissing === 1 && gA.invMissing === 1 && clA.invMissing === 1 &&
   rowOf(clA, 'asset', 'Debt').invMissing === 0 && clB.invMissing === 0,
  'each aggregate carries the count of holdings without an invested value (Equity ' + eqA.invMissing + ', MF ' + mfA.invMissing + ', Grand ' + gA.invMissing + ', Debt ' + rowOf(clA, 'asset', 'Debt').invMissing + ', client B ' + clB.invMissing + ')');
ok(clA.invNote && clA.invNote.indexOf(DAG) === 0 && /: 1 holding without one/.test(clA.invNote) && !clB.invNote,
  'Client A carries a footnote naming the count, Client B none (' + clA.invNote + ')');

/* the review totals: invested over holdings that have one; G/L = CMV - invested over the same holdings */
const famKeep = sheetRows(aBoth, hasInv);
const expTotInv = sumCol(famKeep, cInvC), expTotGL = sumCol(famKeep, cCmvC) - expTotInv;
ok(near(m.totalInv, expTotInv) && near(m.totalInv, 5.35), 'review Invested = ' + m.totalInv.toFixed(4) + ' (expected 5.35)');
ok(near(m.totalGL, expTotGL), 'review Total Gain/Loss = ' + m.totalGL.toFixed(4) + ' (expected ' + expTotGL.toFixed(4) +
  '; the blank holding\'s market value is not counted as gain)');
ok(m.invMissing === 1 && m.invNote && /: 1 holding without one/.test(m.invNote), 'the review carries the count and a footnote (' + m.invNote + ')');
const aa = m.assetAllocation.rows, aaEq = aa.find(r => r.level === 'asset' && r.label === 'Equity'), aaG = aa.find(r => r.level === 'grand');
const aaEqMf = aa[aa.indexOf(aaEq) + 1];
ok(near(aaEq.inv, sumCol(famKeep.filter(isEq), cInvC)) && near(aaEq.inv, 3.45) && aaEq.invMissing === 1 &&
   aaEqMf.label === 'Mutual Funds' && aaEqMf.invMissing === 1 && near(aaG.inv, 5.35) && aaG.invMissing === 1,
  'asset allocation: Equity invested ' + aaEq.inv.toFixed(4) + ' (expected 3.45), with the count on Equity, Equity / MF and the grand total');

/* invested blank but the file's own G/L present: G/L is still totalled only where there is an invested value */
const mGl = E.computeReview(E.parseBaseRows(blanked([ti], false)), H.REF, META);
const gA2 = rowOf(mGl.clients.find(c => c.name === A), 'grand', 'Grand Total');
ok(near(gA2.gl, expGl(all)), 'with the G/L cell present, the client G/L still totals only holdings with an invested value (' + gA2.gl.toFixed(4) + ')');

/* a bucket where no holding has an invested value: blank, not 0 */
const bDebt = base0.findIndex((r, i) => i > 0 && r[cCl] === B && r[cAs] === 'Debt');
const mB = E.computeReview(E.parseBaseRows(blanked([bDebt], true)), H.REF, META);
const bD = rowOf(mB.clients.find(c => c.name === B), 'asset', 'Debt');
ok(bD.inv === null && bD.gl === null && bD.invMissing === 1, 'a subtotal with no invested value at all is blank, not 0 (Client B Debt: ' + bD.inv + ')');

console.log('--- taxation and AI Analyst (IRR loaded) ---');
const mI = E.computeReview(E.parseBaseRows(aBoth), REFI, META);
const T = mI.taxation;
const pos = T.positions.concat(T.unreconciled, T.unmapped).find(p => p.client === A && p.name === target);
ok(pos && pos.gl === null && pos.ltGain === null && pos.stGain === null,
  'taxation: the holding\'s gain is unknown, not its whole market value (gl ' + (pos && pos.gl) + ')');
ok(T.totals.glMissing === 1, 'taxation: the glMissing count is 1 (' + T.totals.glMissing + ')');
const expTaxGl = famKeep.reduce((s, r) => s + (r[cCmvC] - r[cInvC]), 0);
ok(near(T.totals.gl, expTaxGl, 1e-9), 'taxation: Total Gain/Loss ' + T.totals.gl.toFixed(4) + ' = CMV - invested over the holdings that have one (' + expTaxGl.toFixed(4) + ')');
let aia = null, aiaErr = null;
try { aia = E.aiaCompute(mI, REFI, {}); } catch (e) { aiaErr = e; }
const bads = [];
(function walk(o, p, seen) { if (typeof o === 'number') { if (!isFinite(o)) bads.push(p); return; }
  if (!o || typeof o !== 'object' || seen.has(o)) return; seen.add(o); Object.keys(o).forEach(k => walk(o[k], p + '.' + k, seen)); })({ m: mI, aia }, 'x', new Set());
ok(!aiaErr && aia && bads.length === 0, 'AI Analyst and review run with a blank invested value, no NaN / Infinity' + (aiaErr ? ': ' + aiaErr.message : bads.length ? ': ' + bads.slice(0, 4).join(', ') : ''));
const rec = aia && (aia.recs || []).find(r => r.name === target || (r.members || []).some(x => x.name === target));
ok(!rec || rec.inv === null, 'AI Analyst: the position without an invested value reports it blank, not 0' + (rec ? ' (' + rec.inv + ')' : ' (not in the plan)'));

/* ================= workbook ================= */
console.log('--- workbook ---');
const wb = E.buildXLSX(m, XLSX);
const bfS = aoaOf(wb, 'Base File'), bfH = bfS[0], bfInv = bfH.findIndex(h => /^Invested Value \(Cr/.test(h));
const bfRow = bfS.find(r => r && r[0] === A && r[1] === target);
ok(bfRow && (bfRow[bfInv] == null || bfRow[bfInv] === ''), 'workbook Base File: the invested value is blank, not 0 (' + (bfRow && bfRow[bfInv]) + ')');
const cs = aoaOf(wb, A);
const csItem = cs.find(r => r && String(r[0]).trim() === target), csEq = cs.find(r => r && r[0] === 'Equity');
ok(csItem && csItem[3] === D, 'workbook client sheet: the holding\'s invested value reads "—" (' + (csItem && csItem[3]) + ')');
ok(csEq && near(csEq[3], 1.40), 'workbook client sheet: Equity invested 1.40 (' + (csEq && csEq[3]) + ')');
ok(!!clA.invNote && cs.some(r => r && r[0] === clA.invNote), 'workbook client sheet: the footnote with the count is on the sheet');
const aaS = aoaOf(wb, 'Asset Allocation');
ok(!!m.invNote && aaS.some(r => r && r[0] === m.invNote), 'workbook Asset Allocation: the footnote with the count is on the sheet');

/* ================= deck ================= */
console.log('--- deck and screen ---');
async function slideText(model, group) {
  const buf = await E.buildPPTX(model, Ppt, group).write({ outputType: 'nodebuffer' });
  const zip = await global.JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  return (await Promise.all(names.map(n => zip.file(n).async('string')))).join('\n');
}

/* ================= screen (UI script, cut out by anchor) ================= */
function uiFns(model) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const cut = (from, to) => {
    const i = html.indexOf(from); if (i < 0 || html.indexOf(from, i + 1) >= 0) throw new Error('anchor not unique: ' + from);
    const j = to === '\n' ? html.indexOf('\n', i) : html.indexOf(to, i); if (j < 0) throw new Error('end anchor missing: ' + to);
    return html.slice(i, j);
  };
  const src = [
    cut('function pe(v){', '\n'), cut('function neg(v){', '\n'), cut('function czAbsRet(r){', '\n'),
    cut('function renderHoldings(){', '\n  // Equity/Debt look-through source'),
    cut('function renderAsset(){', '\n  function ratingOpts(){'),
    cut('function rbHoldSheetRows(rows){', '\n  function rbHoldSheetHTML(rows){')
  ].join('\n');
  const els = {};
  const doc = { getElementById: id => els[id] || (els[id] = { id, innerHTML: '', querySelectorAll: () => [] }) };
  const COLS = [{ key: 'name', lab: 'Instrument Name' }, { key: 'pdate', lab: 'Purchase Date' }, { key: 'dist', lab: 'Distributor' },
    { key: 'inv', lab: 'Invested Value', unit: true }, { key: 'cmv', lab: 'Current Market Value', unit: true }, { key: 'gl', lab: 'Total Gain/Loss', unit: true },
    { key: 'alloc', lab: 'Allocation %' }, { key: 'xirr', lab: 'XIRR %' }, { key: 'bmxirr', lab: 'BMXIRR %' }, { key: 'absret', lab: 'Absolute Return %' }];
  const CZ = { cols: COLS, sel: { name: 1, pdate: 1, dist: 1, inv: 1, cmv: 1, gl: 1, alloc: 1, xirr: 1, bmxirr: 1, absret: 1 } };
  const f = new Function('model', 'currentRows', 'document', 'CZHOLD', 'czHoldCols', 'czHoldToggle', 'Chart', 'charts', 'pieOpts',
    'rbDeltaMap', 'rbInstTotals', 'rbK', 'rbGuessAP', 'rbShare',
    src + '\nreturn { renderHoldings: renderHoldings, renderAsset: renderAsset, rbHoldSheetRows: rbHoldSheetRows };');
  const fns = f(model, model.holdings, doc, CZ, () => COLS, () => {}, function () {}, [], () => ({}),
    () => ({}), () => ({}), s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(), () => ({}), () => 0);
  return { fns, els };
}
const tds = tr => (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map(t => t.replace(/<[^>]+>/g, ''));
function trOf(htmlStr, label, cls, after) {
  const trs = htmlStr.split('<tr').slice(1).map(t => '<tr' + t.split('</tr>')[0]);
  const start = after ? trs.findIndex(t => t.indexOf(after) >= 0) : 0;
  return trs.slice(Math.max(start, 0)).find(t => t.indexOf('class="' + cls + '"') >= 0 && tds(t)[0] === label);
}

/* Absolute Return % of a partial subtotal: G/L over invested, both over the holdings with an invested value,
   from the sheet's own cells; formatted as the holdings table writes a percentage (2 dp) */
const expAbsEq = (Math.round(expGl(isEq) / expInv(isEq) * 100 * 100) / 100).toFixed(2) + '%';
const TAXNOTE = 'Gain/Loss columns leave out 1 holding without an invested value; its CMV and holding count are included.';

(async () => {
  try {
    const xh = await slideText(m, 'holdings');
    ok(xh.indexOf('1.40' + DAG) >= 0 && xh.indexOf(clA.invNote) >= 0, 'deck holdings slide: the partial subtotal is marked ' + DAG + ' and the footer names the count');
    /* the Absolute Return column, as when the analyst has it selected (the exporter reads the UI's column registry) */
    global.CZHOLD = { cols: [{ key: 'name', lab: 'Instrument Name' }, { key: 'inv', lab: 'Invested Value', unit: true }, { key: 'gl', lab: 'Total Gain/Loss', unit: true },
      { key: 'absret', lab: 'Absolute Return %' }], sel: { name: 1, inv: 1, gl: 1, absret: 1 } };
    const xr = await slideText(m, 'holdings');
    delete global.CZHOLD;
    ok(xr.indexOf('>' + expAbsEq + DAG + '<') >= 0, 'deck holdings slide: the partial Equity subtotal\'s Absolute Return (' + expAbsEq + ') is marked ' + DAG);
    const xa = await slideText(m, 'asset');
    ok(xa.indexOf('Invested Value' + DAG) >= 0 && xa.indexOf('3.45' + DAG) >= 0 && xa.indexOf(m.invNote) >= 0,
      'deck asset-allocation slide: the Invested KPI and Equity row are marked ' + DAG + ' and the footer names the count');
    const xt = await slideText(mI, 'tax');
    ok(/1 without invested value/.test(xt), 'deck taxation slide: the Total Gain/Loss KPI names the holding without an invested value');
    ok(xt.indexOf(TAXNOTE) >= 0, 'deck taxation totals slide: a line under the grand total says the G/L columns leave the holding out');
  } catch (e) { ok(false, 'deck builds: ' + (e && e.stack || e)); }

  try {
    const { fns, els } = uiFns(m);
    fns.renderHoldings();
    const hh = els['s-holdings'].innerHTML;
    const it = trOf(hh, target, 'lvl-item', 'Portfolio Holdings — ' + A);
    ok(it && tds(it)[3] === D, 'Holdings tab: the holding\'s invested value shows "—", not 0.00 (' + (it && tds(it)[3]) + ')');
    const eq = trOf(hh, 'Equity', 'lvl-asset', 'Portfolio Holdings — ' + A);
    ok(eq && tds(eq)[3] === '1.40' + DAG && tds(eq)[5].slice(-1) === DAG, 'Holdings tab: the partial Equity subtotal is marked ' + DAG + ' (' + (eq && tds(eq)[3]) + ')');
    ok(eq && tds(eq)[9] === expAbsEq + DAG, 'Holdings tab: the partial Equity subtotal\'s Absolute Return is ' + expAbsEq + ' and marked ' + DAG + ' (' + (eq && tds(eq)[9]) + ')');
    ok(hh.indexOf(clA.invNote) >= 0, 'Holdings tab: the client sub-line carries the footnote with the count');
    fns.renderAsset();
    const ah = els['s-asset'].innerHTML;
    ok(ah.indexOf('Invested' + DAG + '</div>') >= 0 && ah.indexOf('<td>3.45' + DAG + '</td>') >= 0 && ah.indexOf(m.invNote) >= 0,
      'Asset Allocation tab: the Invested KPI and the Equity row are marked ' + DAG + ', with the footnote');
    const S = fns.rbHoldSheetRows([]);
    const ri = S && S.rows.find(r => r.level === 'item' && r.label === target);
    ok(ri && ri.inv === null && /1 holding/.test(S.note), 'Rebalancing Holding Sheet: the holding\'s invested value is blank, and the note names the count (' + (ri && ri.inv) + ')');
  } catch (e) { ok(false, 'screen render: ' + (e && e.stack || e)); }

  console.log(fail ? fail + ' FAILURE(S)' : 'all KI-007 checks passed');
  process.exit(fail ? 1 : 0);
})();
