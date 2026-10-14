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
