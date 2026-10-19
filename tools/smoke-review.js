/* ============================================================================
   smoke-review.js — end-to-end headless check of the SHIPPED engine and
   exporters on the synthetic book from make-sample-base.js.

     node tools/smoke-review.js

   Runs the very script blocks index.html ships (via engine-host.js), feeds
   them a base file and an IRR workbook built in memory, and checks the
   properties the review must keep whatever the monthly data is:
     - base-file units: XIRR (%) / BMXIRR (%) are percent numbers -> fractions
     - only the planted unknown fund is unmatched
     - AMC shares sum to 100 and every share above 20% is a breach
     - look-through market-cap and rating mixes sum to 100
     - transaction XIRR equals the exact answer the flows were built to give
     - taxation reconciles, and LTCG + STCG + unclassified = CMV
     - overlap matrix is square, symmetric, 100 on the diagonal
     - no NaN / Infinity anywhere in the model
     - the AI Analyst plan is deterministic
     - the full deck, each of the 19 tab groups and the workbook build without
       throwing (the picker-only rebalancing groups need on-screen state)
   No client data is involved. Exit code 1 on any failure.
   ========================================================================== */
'use strict';
const { load } = require('./engine-host.js');
const { build } = require('./make-sample-base.js');

const H = load();
const { XLSX, E, Ppt } = H;
const fx = build(H);

let fail = 0;
const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
const aoa = (wb, n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });

/* parse exactly as the dashboard does: cellDates on, "Base File" or the first sheet */
function parseBase() {
  const wb = XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true });
  return E.parseBaseRows(aoa(wb, wb.Sheets['Base File'] ? 'Base File' : wb.SheetNames[0]));
}
const wbI = XLSX.read(fx.irrBuf, { type: 'buffer', cellDates: true });
const irr = E.parsers.parseIRR(wbI.SheetNames, n => aoa(wbI, n));
const planOf = h => fx.book.find(b => b.client === h.client && b.name === h.name);
const META = { familyName: 'Sample Family', asOnDate: '30 Sep 2026' };

console.log('\n=== base file ===');
const rows0 = parseBase();
ok(rows0.length === fx.book.length, 'every holding parsed (' + rows0.length + ' of ' + fx.book.length + ')');
ok(rows0.unitHint === 'Cr', 'display unit follows the file (Cr)');
ok(rows0.every(h => near(h.xirrFrac, planOf(h).g, 1e-9) && near(h.bmxirrFrac, planOf(h).gb, 1e-9)),
  'XIRR (%) and BMXIRR (%) are read as percent numbers and held as fractions');

console.log('\n=== review without IRR ===');
const m0 = E.computeReview(rows0, H.REF, META);
ok(m0.irrActive === false || !m0.irrActive, 'IRR is not active without an IRR upload');
ok(JSON.stringify(m0.unmatched) === JSON.stringify(['Sample Unknown Opportunities Fund']),
  'only the planted unknown fund is unmatched (' + JSON.stringify(m0.unmatched) + ')');
ok(near(m0.totalCMV, sum(rows0, h => h.cmvCr), 1e-9), 'total CMV is the sum of holding CMVs');

console.log('\n=== review with IRR ===');
const REF = Object.assign({}, H.REF, { IRR: irr });
const m = E.computeReview(parseBase(), REF, META);

const amcRows = m.amc.rows || [];
ok(near(sum(amcRows, r => r.pct), 100, 1e-6), 'AMC shares of the MF book sum to 100');
ok(amcRows.every(r => r.breach === (r.pct > 20)), 'every AMC above 20.00% is a breach, and only those');

const EA = m.equityAnalytics, DA = m.debtAnalytics;
ok(EA.hasData && near(sum(EA.mcap, x => x.pct), 100, 0.05), 'equity market-cap mix sums to 100 (' + sum(EA.mcap, x => x.pct).toFixed(4) + ')');
ok(DA.hasData && near(sum(DA.ratings, x => x.pct), 100, 0.05), 'debt rating mix sums to 100 (' + sum(DA.ratings, x => x.pct).toFixed(4) + ')');
ok(EA.excluded.every(x => x.reason), 'every holding excluded from equity look-through carries a reason');
ok(EA.excluded.some(x => x.name === 'Sample Unknown Opportunities Fund'), 'the unknown fund is listed as excluded, not guessed');

ok(m.irrActive === true && m.irrAsOn === '30 Sep 2026', 'IRR active, as on the latest transaction (' + m.irrAsOn + ')');
const xr = m.holdings.filter(h => h.xirrFrac != null);
const bad = xr.filter(h => !near(h.xirrFrac, planOf(h).g, 1e-6) || !near(h.bmxirrFrac, planOf(h).gb, 1e-6));
ok(xr.length === m.holdings.length && bad.length === 0,
  'transaction XIRR / BMXIRR equal the exact answer on every holding (within 1e-6)' +
  (bad.length ? ': ' + bad.map(h => h.name + ' ' + h.xirrFrac).join('; ') : ''));
const tot = (m.irr || []).find(r => r.level === 0);
const gs = fx.book.map(b => b.g);
ok(tot && tot.fund > Math.min(...gs) && tot.fund < Math.max(...gs), 'portfolio XIRR lies between the holdings\' XIRRs (' + (tot ? (tot.fund * 100).toFixed(2) + '%' : '?') + ')');

const T = m.taxation;
ok(T.hasData && T.unreconciled.length === 0, 'taxation: every position reconciles to its lots');
ok(near(T.totals.ltcgCmv + T.totals.stcgCmv + T.totals.unclassCmv, T.totals.cmv, 1e-6), 'taxation: LTCG + STCG + unclassified = CMV');
ok(T.totals.ltcgCmv > 0 && T.totals.stcgCmv > 0, 'taxation: lots on both sides of the 12-month line are split');

const OV = m.overlap, n = OV.matrix.length;
ok(OV.eligible && OV.matrix.every(r => r.length === n), 'overlap matrix is square (' + n + ' funds)');
ok(OV.matrix.every((r, i) => r[i] === 100 && r.every((v, j) => v === OV.matrix[j][i] && v >= 0 && v <= 100)),
  'overlap matrix is symmetric, 100 on the diagonal, within 0..100');

const bads = [];
(function walk(o, p, seen) {
  if (typeof o === 'number') { if (!isFinite(o)) bads.push(p); return; }
  if (!o || typeof o !== 'object' || seen.has(o)) return; seen.add(o);
  Object.keys(o).forEach(k => walk(o[k], p + '.' + k, seen));
})(m, 'model', new Set());
ok(bads.length === 0, 'no NaN or Infinity anywhere in the model' + (bads.length ? ': ' + bads.slice(0, 5).join(', ') : ''));

console.log('\n=== engine fixes from the 19 Oct 2026 audit (known answers) ===');
/* KI-047: no rate of return exists when every flow falls on one date; a 365-day year at +10% is exact */
const D0 = new Date(Date.UTC(2025, 8, 30)), D1 = new Date(Date.UTC(2026, 8, 30));
ok(E.xirr([{ d: D1, a: -100 }, { d: D1, a: 110 }]) === null && E.xirr([{ d: D1, a: -100 }, { d: D1, a: 100 }]) === null,
  'KI-047: XIRR of flows that all fall on one date is blank, not 10000% or 10%');
ok(near(E.xirr([{ d: D0, a: -100 }, { d: D1, a: 110 }]), 0.10, 1e-9), 'KI-047: a one-year +10% flow pair still gives exactly 10%');
/* the Newton branch (roots outside the bisection bracket) still finds genuine large rates */
const day = n => new Date(D0.getTime() + n * 86400000);
const newton = [
  [[{ d: D0, a: -100 }, { d: day(3), a: 105 }], Math.pow(1.05, 365 / 3) - 1],
  [[{ d: D0, a: -1000 }, { d: day(3), a: 1100 }], Math.pow(1.1, 365 / 3) - 1],
];
ok(newton.every(([f, x]) => { const r = E.xirr(f); return r != null && Math.abs(r - x) <= 1e-6 * Math.max(1, x); }),
  'KI-047: very large genuine rates are still found (' + newton.map(([f, x]) => (E.xirr(f) || 0).toFixed(4) + ' vs ' + x.toFixed(4)).join('; ') + ')');

/* KI-055: a single hybrid holding's top stock, as a share of the equity exposure, equals the stock's
   weight in the fund divided by the fund's equity-sleeve weight */
const hyKey = Object.keys(H.REF.HYBRID_ANALYTICS).find(k => { const e = H.REF.HYBRID_ANALYTICS[k].eq;
  return e && e.weight > 20 && e.weight < 80 && e.stocks && e.stocks.length > 5 && H.REF.MF_PERF[k]; });
const hyEq = H.REF.HYBRID_ANALYTICS[hyKey].eq;
const hyRows = E.parseBaseRows([
  ['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'AMC', 'Product Name', 'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'XIRR (%)', 'BMXIRR (%)'],
  ['Test Client', hyKey, 'Aggressive Hybrid Fund', 'Hybrid', '', 'Mutual Funds', 1, 1.2, 10, 9]]);
const hyM = E.computeReview(hyRows, H.REF, META);
const topSt = hyEq.stocks.slice().sort((x, y) => y[1] - x[1])[0];
const gotTop = (hyM.equityAnalytics.stocks || []).find(s => s.k === topSt[0]);
ok(gotTop && near(gotTop.pct, topSt[1] / hyEq.weight * 100, 0.01),
  'KI-055: hybrid stock exposure is not scaled twice (' + hyKey + ': top stock ' + (gotTop ? gotTop.pct.toFixed(2) : '?') +
  '% of equity vs ' + (topSt[1] / hyEq.weight * 100).toFixed(2) + '% expected)');

/* KI-006: a blank XIRR is left out of the client-sheet averages instead of counting as 0% */
const rowsBlank = parseBase();
const blanked = rowsBlank.find(h => /mutual/i.test(h.product) && h.asset === 'Equity');
blanked.xirrFrac = null;
const mB = E.computeReview(rowsBlank, H.REF, META);
const cB = mB.clients.find(c => c.name === blanked.client);
const covered = rowsBlank.filter(h => h.client === blanked.client && h.xirrFrac != null);
const wavg = list => list.length ? sum(list, h => h.xirrFrac * h.cmvCr) / sum(list, h => h.cmvCr) * 100 : null;
const prodRow = cB.rows.find(r => r.level === 'product' && r.label === blanked.product &&
  cB.rows.indexOf(r) > cB.rows.findIndex(x => x.level === 'asset' && x.label === blanked.asset));
const expProd = wavg(covered.filter(h => h.asset === blanked.asset && h.product === blanked.product));
const expGrand = wavg(covered);
const grandRow = cB.rows.find(r => r.level === 'grand');
ok(prodRow && near(prodRow.xirr, expProd, 1e-9) && near(grandRow.xirr, expGrand, 1e-9),
  'KI-006: blank XIRR excluded from subtotals (product ' + (prodRow ? prodRow.xirr.toFixed(4) : '?') + ' vs ' + (expProd != null ? expProd.toFixed(4) : '?') +
  ', grand ' + grandRow.xirr.toFixed(4) + ' vs ' + expGrand.toFixed(4) + ')');
ok(grandRow.xcov > 0 && grandRow.xcov < 100, 'KI-006: the grand total reports the share of CMV that has an XIRR (' + grandRow.xcov.toFixed(2) + '%)');
ok(cB.covNote && /: 1 without XIRR/.test(cB.covNote) && mB.clients.filter(c => c.covNote).length === 1,
  'KI-006: the client with a blank XIRR carries a coverage footnote with the count, and only that client (' + cB.covNote + ')');
ok(m.clients.every(c => !c.covNote), 'KI-006: no coverage footnote when every subtotal is complete (IRR loaded)');

/* KI-065: debt mutual funds are taxed under Sec. 50AA; directly held bonds and G-Secs keep their rows */
const tc = (asset, product, category, name) => E.taxClassOf({ asset, product, category, name });
const taxCases = [
  [tc('Debt', 'Mutual Funds', 'Corporate Bond Fund', 'X Corporate Bond Fund-Reg(G)'), 'Debt Mutual Funds – Sec. 50AA'],
  [tc('Debt', 'Mutual Funds', 'Dynamic Bond', 'X Dynamic Bond Fund-Reg(G)'), 'Debt Mutual Funds – Sec. 50AA'],
  [tc('Debt', 'Mutual Funds', 'Gilt Fund', 'X Gilt Fund-Reg(G)'), 'Debt Mutual Funds – Sec. 50AA'],
  [tc('Debt', 'Mutual Funds', 'Index Funds', 'X CRISIL IBX Gilt Index Fund'), 'Debt Mutual Funds – Sec. 50AA'],
  [tc('Fixed Income', 'Mutual Funds', 'Corporate Bond Fund', 'X Corporate Bond Fund-Reg(G)'), 'Debt Mutual Funds – Sec. 50AA'],
  [tc('Debt', 'Bonds', 'Corporate Bond', 'X Ltd 8.5% NCD 2028'), 'Listed Bonds / NCDs'],
  [tc('Debt', 'Bonds', 'G-Sec', '7.18% GOI 2033'), 'Government Securities / G-Secs'],
  [tc('Equity', 'Mutual Funds', 'Large Cap Fund', 'X Large Cap Fund-Reg(G)'), 'Equity Mutual Funds'],
  /* a blank Asset parses as Equity: the G-Sec name still marks a debt fund */
  [tc('Equity', 'Mutual Funds', 'Index Funds', 'X Nifty G-Sec Apr 2029 Index Fund-Reg(G)'), 'Debt Mutual Funds – Sec. 50AA'],
  [tc('Equity', 'Mutual Funds', 'Other ETFs', 'X Nifty SDL Apr 2027 ETF'), 'Debt Mutual Funds – Sec. 50AA'],
  [tc('Equity', 'Mutual Funds', 'Debt', 'X Banking & PSU Debt Fund-Reg(G)'), 'Debt Mutual Funds – Sec. 50AA'],
  /* an equity : G-Sec blend needs its equity share: unclassified, not guessed */
  [tc('Equity', 'Mutual Funds', 'Index Funds', 'X Nifty200 Momentum 30 Plus 8-13yr G-Sec 75:25 Index Fund'), null],
  /* earlier rows keep their place */
  [tc('Commodity', 'Mutual Funds', 'Gold ETF', 'X Gold ETF'), 'Commodity ETF'],
  [tc('Equity', 'Mutual Funds', 'FoF Overseas', 'X US Equity FoF'), 'Global Funds'],
  [tc('Debt', 'Mutual Funds', 'Arbitrage Fund', 'X Arbitrage Fund-Reg(G)'), 'Equity Mutual Funds'],
];
const taxBad = taxCases.filter(c => c[0] !== c[1]);
ok(taxBad.length === 0, 'KI-065: debt mutual funds take Sec. 50AA; direct bonds and G-Secs keep their rows' +
  (taxBad.length ? ': ' + taxBad.map(c => c[0] + ' (expected ' + c[1] + ')').join('; ') : ''));

console.log('\n=== AI Analyst ===');
const a = E.aiaCompute(m, REF, {}), b = E.aiaCompute(m, REF, {});
ok(a && a.ok !== false, 'a plan is produced');
ok(JSON.stringify(a) === JSON.stringify(b), 'the same book produces a byte-identical plan');

console.log('\n=== exports ===');
const slidesOf = buf => new Set(Buffer.from(buf).toString('latin1').match(/ppt\/slides\/slide\d+\.xml/g) || []).size;
const groups = ['ips', 'asset', 'distalloc', 'clalloc', 'amc', 'obs', 'holdings', 'analytics', 'overlap', 'cost', 'irr',
  'cvs', 'mfanalysis', 'tax', 'aia', 'rebal', 'perf', 'disc', 'thank'];
(async () => {
  try {
    const full = await E.buildPPTX(m, Ppt).write({ outputType: 'nodebuffer' });
    ok(slidesOf(full) >= 30, 'full deck builds (' + slidesOf(full) + ' slides, ' + (full.length / 1e6).toFixed(1) + ' MB)');
  } catch (e) { ok(false, 'full deck builds: ' + (e && e.message)); }
  const counts = [], errs = [];
  for (const g of groups) {
    try { counts.push(g + ' ' + slidesOf(await E.buildPPTX(m, Ppt, g).write({ outputType: 'nodebuffer' }))); }
    catch (e) { errs.push(g + ': ' + (e && e.message)); }
  }
  ok(errs.length === 0, 'every single-tab deck builds' + (errs.length ? ': ' + errs.join('; ') : ''));
  console.log('        slides per tab (headless; tabs fed by on-screen state show fewer): ' + counts.join(' · '));
  try {
    const wb = E.buildXLSX(m, XLSX);
    const need = ['Base File', 'Asset Allocation', 'AMC Allocation', 'Performance', 'Fund IRR', 'Observations'];
    ok(need.every(s => wb.SheetNames.indexOf(s) >= 0), 'workbook builds with its core sheets (' + wb.SheetNames.length + ' sheets)');
  } catch (e) { ok(false, 'workbook builds: ' + (e && e.message)); }
  console.log('\n' + (fail ? (fail + ' FAILURE(S)') : 'all smoke checks passed'));
  process.exit(fail ? 1 : 0);
})();
