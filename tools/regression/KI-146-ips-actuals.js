/* ============================================================================
   KI-146 (P1; fix batch 4, CR-0009, D-041): the IPS asset-class actuals add
   up EVERY matching Asset Allocation row, and a recognised synonym such as
   "Fixed Income" counts in its class.

     node tools/regression/KI-146-ips-actuals.js

   Before: getIPSData (UI script) assigned eqCMV, debtCMV, hybridCMV, reitCMV
   and commodityCMV from the allocation rows instead of adding them, so only
   the last matching row counted, and "Fixed Income" counted in no class. On
   the synthetic book family-a-odd-asset-labels the equity CMV was 0.5427 Cr
   (the "EQUITY" row) instead of 4.7545 Cr, debt 0.962 Cr instead of 2.4446 Cr
   and REITs 0.1799 Cr instead of 0.2887 Cr.
   After: every row adds to its class, each label read as its class first
   (ENGINE.assetLabel). KI-145 already makes one row per class for a base
   file, so the test also feeds getIPSData split rows directly, as a model
   built any other way could carry them.

   getIPSData is cut out of index.html's UI script by anchor and run with the
   shipped ENGINE (Node cannot load the UI script itself). Known answers: the
   fixture's own Crore cells (tests/fixtures/make-books.ts) summed by class
   here, and hand-built allocation rows. Synthetic data only. Exit code 1 on
   any failure.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { load, ROOT } = require('../engine-host.js');

const H = load();
const { XLSX, E } = H;
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= (tol || 1e-9);
const META = { familyName: 'Sample Family', asOnDate: '30 Sep 2026' };

/* getIPSData, cut from the UI script by its own anchors */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const A0 = '  window.getIPSData=function(model){', A1 = '\n  function renderIPS(){';
const i0 = html.indexOf(A0), i1 = html.indexOf(A1, i0);
if (i0 < 0 || html.indexOf(A0, i0 + 1) >= 0 || i1 < 0) throw new Error('getIPSData anchors not found once');
const win = {};
new Function('E', 'activeRef', 'window', html.slice(i0, i1))(E, H.REF, win);
const getIPSData = win.getIPSData;
const noAnalytics = m => Object.assign({}, m, { equityAnalytics: { hasData: false }, debtAnalytics: { hasData: false } });

console.log('--- split allocation rows, built by hand ---');
const split = {
  totalCMV: 10, holdings: [], liqPie: [], amc: { rows: [] }, equityAnalytics: { hasData: false }, debtAnalytics: { hasData: false },
  assetAllocation: { rows: [
    { level: 'asset', label: 'Equity', cmv: 4.0 }, { level: 'product', label: 'Mutual Funds', cmv: 4.0 },
    { level: 'asset', label: 'EQUITY', cmv: 1.5 },
    { level: 'asset', label: 'Debt', cmv: 1.0 }, { level: 'asset', label: 'Fixed Income', cmv: 0.75 }, { level: 'asset', label: 'Debt Funds', cmv: 0.5 },
    { level: 'asset', label: 'Hybrid', cmv: 0.5 }, { level: 'asset', label: 'hybrid', cmv: 0.25 },
    { level: 'asset', label: 'REITs/InvITs', cmv: 0.3 }, { level: 'asset', label: 'REITs / InvITs', cmv: 0.2 },
    { level: 'asset', label: 'Commodity', cmv: 0.4 }, { level: 'asset', label: 'Gold', cmv: 0.6 },
    { level: 'grand', label: 'Grand Total', cmv: 10 }
  ] }
};
const S = getIPSData(split).classCMV || {};
ok(near(S.equity, 5.5), 'equity adds Equity 4.00 and EQUITY 1.50: 5.50 Cr (was 1.50, the last row) (got ' + S.equity + ')');
ok(near(S.debt, 2.25), 'debt adds Debt 1.00, Fixed Income 0.75 and Debt Funds 0.50: 2.25 Cr (was 0.50; Fixed Income counted nowhere) (got ' + S.debt + ')');
ok(near(S.hybrid, 0.75) && near(S.reit, 0.5) && near(S.commodity, 1.0), 'hybrid 0.75, REITs 0.50 and commodity (Commodity and Gold) 1.00 Cr (got ' + [S.hybrid, S.reit, S.commodity].join(', ') + ')');
const SA = getIPSData(split).actuals;
ok(near(SA.effEq, 0.55) && near(SA.effDebt, 0.225), 'without analytics the IPS Equity actual is 55.00% and Debt 22.50% (got ' + (SA.effEq * 100).toFixed(2) + '%, ' + (SA.effDebt * 100).toFixed(2) + '%)');

console.log('--- the synthetic book family-a-odd-asset-labels ---');
(async () => {
  try {
    const mb = await import(pathToFileURL(path.join(ROOT, 'tests', 'fixtures', 'make-books.ts')).href);
    const { book, fixtures } = mb.sampleFixtures(H);
    const fx = fixtures.find(f => f.id === 'family-a-odd-asset-labels');
    const wb = XLSX.read(fx.bytes, { type: 'array', cellDates: true });
    const rows = E.parseBaseRows(XLSX.utils.sheet_to_json(wb.Sheets['Base File'] || wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true }));
    const m = E.computeReview(rows, H.REF, META);
    /* independent: each holding's Crore cell (r4 of rupees / 1e7, as the fixture writes it) by the IPS class of its label,
       written out by hand ("Gold" is a commodity to the IPS) */
    const LABELS = ['', 'Fixed Income', 'Debt Funds', '  EQUITY  ', 'Gold', 'REITs / InvITs', 'REITs/InvITs'];
    const IPS = { '': 'equity', 'Fixed Income': 'debt', 'Debt Funds': 'debt', '  EQUITY  ': 'equity', 'Gold': 'commodity',
      'REITs / InvITs': 'reit', 'REITs/InvITs': 'reit', 'Equity': 'equity', 'Debt': 'debt', 'Hybrid': 'hybrid', 'Commodity': 'commodity' };
    const r4 = x => Math.round(x * 10000) / 10000;
    const want = { equity: 0, debt: 0, hybrid: 0, reit: 0, commodity: 0 }; let tot = 0;
    book.forEach((h, i) => { const lab = i < LABELS.length ? LABELS[i] : h.asset; const v = r4(h.mv / 1e7); want[IPS[lab]] += v; tot += v; });
    ok(near(want.equity, 4.7545) && near(want.debt, 2.4446) && near(want.reit, 0.2887),
      'independent sums of the fixture: equity 4.7545, debt 2.4446, REITs 0.2887 Cr, as KI-146 states (' + [want.equity, want.debt, want.reit].map(x => x.toFixed(4)).join(', ') + ')');
    const D = getIPSData(m), C = D.classCMV || {}, f4 = x => (x == null ? String(x) : x.toFixed(4));
    ok(near(C.equity, want.equity), 'IPS equity CMV 4.7545 Cr (was 0.5427) (got ' + f4(C.equity) + ')');
    ok(near(C.debt, want.debt), 'IPS debt CMV 2.4446 Cr (was 0.962) (got ' + f4(C.debt) + ')');
    ok(near(C.reit, want.reit), 'IPS REITs CMV 0.2887 Cr (was 0.1799) (got ' + f4(C.reit) + ')');
    ok(near(C.hybrid, want.hybrid) && near(C.commodity, want.commodity), 'hybrid ' + want.hybrid.toFixed(4) + ' and commodity ' + want.commodity.toFixed(4) + ' Cr (got ' +
      f4(C.hybrid) + ', ' + f4(C.commodity) + ')');
    const N = getIPSData(noAnalytics(m)).actuals;
    ok(near(N.effEq, want.equity / tot) && near(N.effDebt, want.debt / tot), 'with no look-through data the IPS Equity actual is ' + (want.equity / tot * 100).toFixed(2) + '% and Debt ' +
      (want.debt / tot * 100).toFixed(2) + '% of ' + tot.toFixed(4) + ' Cr (got ' + (N.effEq * 100).toFixed(2) + '%, ' + (N.effDebt * 100).toFixed(2) + '%)');
    const hybRem = want.hybrid, nonEqDebt = tot - want.equity - want.debt;
    const effReit = want.reit + (nonEqDebt > 0 ? hybRem * (want.reit / (want.reit + want.commodity || 1)) : 0);
    ok(near(N.reit, effReit / tot), 'the IPS REITs/InvITs actual is ' + (effReit / tot * 100).toFixed(2) + '% (got ' + (N.reit * 100).toFixed(2) + '%)');
    /* the split rows of the old reader (one row per written label), fed straight to getIPSData */
    const byLabel = {}; book.forEach((h, i) => { const lab = (i < LABELS.length ? LABELS[i] : h.asset).trim() || 'Equity'; byLabel[lab] = (byLabel[lab] || 0) + r4(h.mv / 1e7); });
    const old = Object.assign({}, m, { assetAllocation: { rows: Object.keys(byLabel).map(l => ({ level: 'asset', label: l, cmv: byLabel[l] })) } });
    const OA = getIPSData(Object.assign(noAnalytics(old), { totalCMV: tot })).actuals;
    ok(near(OA.effEq, want.equity / tot) && near(OA.effDebt, want.debt / tot), 'split rows, no look-through data: Equity ' + (want.equity / tot * 100).toFixed(2) +
      '% and Debt ' + (want.debt / tot * 100).toFixed(2) + '%, never one row\'s share (got ' +
      (OA.effEq * 100).toFixed(2) + '%, ' + (OA.effDebt * 100).toFixed(2) + '%)');
    const O = getIPSData(old).classCMV || {};
    ok(near(O.equity, want.equity) && near(O.debt, want.debt) && near(O.reit, want.reit),
      'the same book as split rows ("Equity", "EQUITY", "Fixed Income", "Debt Funds", "REITs / InvITs" ...): the same sums (' + [O.equity, O.debt, O.reit].map(f4).join(', ') + ')');
  } catch (e) { ok(false, 'the fixture case runs: ' + (e && e.stack || e)); }
  console.log(fail ? fail + ' FAILURE(S)' : 'all KI-146 checks passed');
  process.exit(fail ? 1 : 0);
})();
