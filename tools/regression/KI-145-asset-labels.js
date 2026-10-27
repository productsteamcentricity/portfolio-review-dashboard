/* ============================================================================
   KI-145 (fix batch 4, CR-0009, D-041): Asset Names that differ only in
   letter case or spacing, or by an OD-7 synonym, form one Asset Allocation
   row under the class's own label.

     node tools/regression/KI-145-asset-labels.js

   Before: parseBaseRows kept the Asset Name as written (spaces collapsed) and
   the allocation grouped by that exact label, so "Equity" and "EQUITY" were
   two rows, "Fixed Income" and "Debt Funds" were rows of their own, and
   "REITs / InvITs" stood beside "REITs/InvITs". On the synthetic book
   family-a-odd-asset-labels: "Equity" 48.1662% and "EQUITY" 6.2063%; "Debt"
   9.5113%, "Fixed Income" 7.4437% and "Debt Funds" 11.0015%; "REITs/InvITs"
   1.2442% and "REITs / InvITs" 2.0573%.
   After: ENGINE.assetLabel reads the five classes of the allocation (Equity,
   Debt, Hybrid, Commodity, REITs/InvITs) without regard to case or spacing,
   "Fixed Income" and "Debt Funds" as Debt (OD-7) and "Commodities" as
   Commodity. Other labels keep the first form written in the file, so their
   case variants are one row too. A blank label is still Equity (unchanged).
   The client sheets, performance buckets and tax classes read the same
   label; the status line lists the labels read as a class.

   Known answers: written here from the rows the test builds, and from the
   fixture's own Crore cells (tests/fixtures/make-books.ts). Synthetic data
   only. Exit code 1 on any failure.
   ========================================================================== */
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');
const { load, ROOT } = require('../engine-host.js');

const H = load();
const { XLSX, E } = H;
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= (tol || 1e-9);
const META = { familyName: 'Sample Family', asOnDate: '30 Sep 2026' };

console.log('--- ENGINE.assetLabel ---');
[['Equity', 'Equity'], ['EQUITY', 'Equity'], ['  equity  ', 'Equity'], ['Fixed Income', 'Debt'], ['FIXED  INCOME', 'Debt'],
  ['Debt Funds', 'Debt'], ['debt', 'Debt'], ['Hybrid', 'Hybrid'], ['Commodities', 'Commodity'], ['commodity', 'Commodity'],
  ['REITs / InvITs', 'REITs/InvITs'], ['reits/invits', 'REITs/InvITs'], ['Gold', 'Gold'], ['  Real   Estate ', 'Real Estate'], ['', '']]
  .forEach(p => ok(E.assetLabel(p[0]) === p[1], 'assetLabel("' + p[0] + '") is "' + p[1] + '" (got "' + E.assetLabel(p[0]) + '")'));

console.log('--- one allocation row per class ---');
const HDR = ['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'Product Name', 'Distributor Name', 'Invested Value (Cr.)', 'Current Market Value (Cr.)'];
const book = [['Equity', 1, 'Large Cap Fund'], ['EQUITY', 2, 'Flexi Cap Fund'], [' equity ', 0.5, 'Mid Cap Fund'], ['Fixed Income', 1, 'Corporate Bond Fund'],
  ['Debt Funds', 1, 'Banking and PSU Fund'], ['debt', 0.5, 'Liquid Fund'], ['REITs / InvITs', 0.3, 'REIT'], ['REITs/InvITs', 0.2, 'REIT'],
  ['reits/invits', 0.1, 'InvIT'], ['Commodities', 0.4, 'Gold ETF'], ['Gold', 0.25, 'Gold Fund of Fund'], ['GOLD', 0.25, 'Silver Fund of Fund'],
  ['Hybrid', 0.5, 'Balanced Advantage Fund'], ['', 0.5, 'Multi Cap Fund']];
const rows = E.parseBaseRows([HDR].concat(book.map((b, i) => ['Sample Client', 'Sample Fund ' + (i + 1), b[2], b[0], 'Mutual Funds', 'Sample Distributor', b[1] * 0.8, b[1]])));
const m = E.computeReview(rows, H.REF, META);
const total = book.reduce((s, b) => s + b[1], 0);
const want = [['Equity', 1 + 2 + 0.5 + 0.5], ['Debt', 1 + 1 + 0.5], ['Hybrid', 0.5], ['Commodity', 0.4], ['REITs/InvITs', 0.3 + 0.2 + 0.1], ['Gold', 0.25 + 0.25]];
const aa = m.assetAllocation.rows.filter(r => r.level === 'asset');
ok(aa.map(r => r.label).join('|') === want.map(w => w[0]).join('|'), 'asset rows, the five classes in order then "Gold": ' + aa.map(r => r.label).join(', '));
want.forEach(w => { const r = aa.find(x => x.label === w[0]);
  ok(r && near(r.cmv, w[1]) && near(r.pct, w[1] / total * 100), w[0] + ': ' + w[1].toFixed(2) + ' Cr, ' + (w[1] / total * 100).toFixed(4) + '% (got ' + (r && r.cmv) + ', ' + (r && r.pct) + ')'); });
ok(near(aa.reduce((s, r) => s + r.pct, 0), 100), 'the asset rows add up to 100%');
const cl = m.clients[0].rows.filter(r => r.level === 'asset').map(r => r.label);
ok(cl.join('|') === want.map(w => w[0]).join('|'), 'the client sheet has the same asset rows (' + cl.join(', ') + ')');
const fi = rows.find(h => h.name === 'Sample Fund 4');
ok(fi.asset === 'Debt' && E.taxClassOf(fi) === E.taxClassOf(Object.assign({}, fi, { asset: 'Debt' })), '"Fixed Income" holds asset Debt and the tax class of a Debt fund (' + E.taxClassOf(fi) + ')');
const inDebt = (m.performance.buckets.find(b => b.key === 'Debt MF') || { rows: [] }).rows.some(r => r.type === 'fund' && r.name === 'Sample Fund 4');
const inEq = (m.performance.buckets.find(b => b.key === 'Equity MF') || { rows: [] }).rows.some(r => r.type === 'fund' && r.name === 'Sample Fund 4');
ok(inDebt && !inEq, 'the "Fixed Income" fund is in the Debt MF performance bucket, not Equity MF (OD-7)');
const nt = (rows.notices || []).find(n => /^Asset Names read as their class: /.test(n.text));
ok(nt && !nt.warn && ['"EQUITY" as Equity', '"Fixed Income" as Debt', '"Debt Funds" as Debt', '"REITs / InvITs" as REITs/InvITs', '"Commodities" as Commodity', '"GOLD" as Gold']
  .every(s => nt.text.indexOf(s) >= 0) && nt.text.indexOf('"Equity" as') < 0, 'a notice lists the labels read as a class (' + (nt && nt.text) + ')');

console.log('--- the synthetic book family-a-odd-asset-labels ---');
(async () => {
  try {
    const mb = await import(pathToFileURL(path.join(ROOT, 'tests', 'fixtures', 'make-books.ts')).href);
    const { book: sb, fixtures } = mb.sampleFixtures(H);
    const fx = fixtures.find(f => f.id === 'family-a-odd-asset-labels');
    const wb = XLSX.read(fx.bytes, { type: 'array', cellDates: true });
    const fr = E.parseBaseRows(XLSX.utils.sheet_to_json(wb.Sheets['Base File'] || wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true }));
    const fm = E.computeReview(fr, H.REF, META);
    /* independent: the fixture writes each market value in Crore to 4 decimals (r4 of rupees / 1e7) and these labels on
       its first seven holdings (make-books.ts); the class of each label written out by hand */
    const LABELS = ['', 'Fixed Income', 'Debt Funds', '  EQUITY  ', 'Gold', 'REITs / InvITs', 'REITs/InvITs'];
    const CLASS = { '': 'Equity', 'Fixed Income': 'Debt', 'Debt Funds': 'Debt', '  EQUITY  ': 'Equity', 'Gold': 'Gold', 'REITs / InvITs': 'REITs/InvITs',
      'REITs/InvITs': 'REITs/InvITs', 'Equity': 'Equity', 'Debt': 'Debt', 'Hybrid': 'Hybrid', 'Commodity': 'Commodity' };
    const r4 = x => Math.round(x * 10000) / 10000;
    const sums = {}; let tot = 0;
    sb.forEach((h, i) => { const lab = i < LABELS.length ? LABELS[i] : h.asset; const c = CLASS[lab]; const v = r4(h.mv / 1e7);
      if (!c) throw new Error('no class written for ' + lab); sums[c] = (sums[c] || 0) + v; tot += v; });
    const fa = fm.assetAllocation.rows.filter(r => r.level === 'asset');
    ok(fa.filter(r => /^equity$/i.test(r.label)).length === 1 && fa.filter(r => /reit/i.test(r.label)).length === 1 &&
       !fa.some(r => r.label === 'Fixed Income' || r.label === 'Debt Funds'), 'one Equity row, one Debt row, one REITs/InvITs row (' + fa.map(r => r.label).join(', ') + ')');
    Object.keys(sums).forEach(c => { const r = fa.find(x => x.label === c);
      ok(r && near(r.cmv, sums[c], 1e-9) && near(r.pct, sums[c] / tot * 100, 1e-9), c + ': ' + sums[c].toFixed(4) + ' Cr, ' + (sums[c] / tot * 100).toFixed(4) + '% (got ' + (r && r.cmv) + ')'); });
    const pct = c => (fa.find(x => x.label === c) || {}).pct;
    ok(near(pct('Equity'), 48.1662 + 6.2063, 1e-3), 'Equity is the two rows KI-145 found, 48.1662% + 6.2063% = 54.3725% (got ' + (pct('Equity') || 0).toFixed(4) + '%)');
    ok(near(pct('Debt'), 9.5113 + 7.4437 + 11.0015, 1e-3), 'Debt is 9.5113% + 7.4437% + 11.0015% = 27.9565% (got ' + (pct('Debt') || 0).toFixed(4) + '%)');
    ok(near(pct('REITs/InvITs'), 1.2442 + 2.0573, 1e-3), 'REITs/InvITs is 1.2442% + 2.0573% = 3.3015% (got ' + (pct('REITs/InvITs') || 0).toFixed(4) + '%)');
  } catch (e) { ok(false, 'the fixture case runs: ' + (e && e.stack || e)); }
  console.log(fail ? fail + ' FAILURE(S)' : 'all KI-145 checks passed');
  process.exit(fail ? 1 : 0);
})();
