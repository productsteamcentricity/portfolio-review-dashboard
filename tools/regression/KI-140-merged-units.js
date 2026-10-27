/* ============================================================================
   KI-140 (fix batch 4, CR-0009, D-041) — merged duplicate folios leave units
   blank when any folio has none; never a partial sum.

     node tools/regression/KI-140-merged-units.js

   Before: parseBaseRows added up the units it found (07_engine.js
   `if(h.units!=null) m.units=(m.units||0)+(h.units||0)`), so folios with 100
   units and none merged to 100, and none with 40 merged to 40. Units are the
   base Taxation reconciles a holding against, so the fund was reconciled
   against too few units.
   After: the merged units are the sum only when every folio has units; one
   folio without units leaves them blank and marks the holding (unitsGap). A
   holding whose folios all lack units (a product priced in rupees) is not a
   gap. Taxation never reconciles a gap holding on its invested value (D-035's
   rule for a unit-priced holding with a merge gap in units): it is unsplit,
   with a reason. The status line gets a notice.

   Known answers are written here from the rows each case builds. The
   Taxation case uses tools/make-sample-base.js (synthetic book and IRR flows).
   Synthetic data only. Exit code 1 on any failure.
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');
const { build } = require('../make-sample-base.js');

const H = load();
const { XLSX, E } = H;
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= (tol || 1e-9);

const HDR = ['Client Name', 'Instrument Name', 'Asset Name', 'Product Name', 'Distributor Name', 'Folio No', 'Units',
  'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Total Gain/Loss (Cr.)'];
const folio = (f, units, inv, cmv, product) => ['Sample Client', 'Sample Growth Fund', 'Equity', product || 'Mutual Funds',
  'Sample Distributor', f, units, inv, cmv, cmv - inv];
const parse = rows => E.parseBaseRows([HDR].concat(rows));

console.log('--- merging ---');
let r = parse([folio('F1', 100, 1.0, 1.5), folio('F2', null, 0.5, 0.75)]);
ok(r.length === 1 && r[0].units === null && r[0].unitsGap === true && near(r[0].cmvCr, 2.25),
  'folios with 100 units and none: units blank (was 100), the holding is marked, CMV 2.25 (got ' + r[0].units + ', ' + r[0].cmvCr + ')');
r = parse([folio('F1', null, 1.0, 1.5), folio('F2', 40, 0.5, 0.75)]);
ok(r.length === 1 && r[0].units === null && r[0].unitsGap === true, 'folios with none and 40 units: units blank (was 40) (got ' + r[0].units + ')');
r = parse([folio('F1', 100, 1.0, 1.5), folio('F2', 40, 0.5, 0.75)]);
ok(r.length === 1 && near(r[0].units, 140) && !r[0].unitsGap, 'folios with 100 and 40 units: 140, no gap (got ' + r[0].units + ')');
r = parse([folio('F1', 100.5, 1.0, 1.5), folio('F2', 0.25, 0.5, 0.75), folio('F3', 0, 0.1, 0.1)]);
ok(r.length === 1 && near(r[0].units, 100.75) && !r[0].unitsGap, 'three folios with 100.5, 0.25 and 0 units: 100.75 (0 is a value) (got ' + r[0].units + ')');
r = parse([folio('F1', null, 1.0, 1.5, 'PMS'), folio('F2', null, 0.5, 0.75, 'PMS')]);
ok(r.length === 1 && r[0].units === null && !r[0].unitsGap, 'a PMS whose folios all lack units: blank, and not a gap (priced in rupees)');
r = parse([folio('F1', 100, 1.0, 1.5)]);
ok(r.length === 1 && r[0].units === 100 && !r[0].unitsGap, 'a single folio keeps its units (100)');
r = parse([folio('F1', 100, 1.0, 1.5), folio('F2', null, 0.5, 0.75)]);
const nt = (r.notices || []).find(n => /without units/.test(n.text));
ok(nt && nt.warn && /^1 merged holding has a folio without units: the units are left blank, not a partial sum/.test(nt.text),
  'a warning notice names the merged holding without units (' + (nt && nt.text) + ')');
ok(!/[–—]/.test(nt ? nt.text : ''), 'the notice has no en or em dash');
r = parse([folio('F1', 100, 1.0, 1.5), folio('F2', 40, 0.5, 0.75)]);
ok(!(r.notices || []).some(n => /without units/.test(n.text)), 'no notice when every folio has units');

console.log('--- Taxation: never reconciled on invested value ---');
const fx = build(H);
const aoaOf = (wb, n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
const base = aoaOf(XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true }), 'Base File');
const irrWb = XLSX.read(fx.irrBuf, { type: 'buffer', cellDates: true });
const REFI = Object.assign({}, H.REF, { IRR: E.parsers.parseIRR(irrWb.SheetNames, n => aoaOf(irrWb, n)) });
const META = { familyName: 'Sample Family', asOnDate: '30 Sep 2026' };
const h0 = base[0], c = n => h0.indexOf(n);
const cU = c('Units'), cF = c('Folio No'), money = ['Invested Value (₹)', 'Market Value (₹)', 'Total Gain/Loss (₹)',
  'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Total Gain/Loss (Cr.)'].map(c);
const all = T => T.positions.concat(T.unreconciled, T.unmapped);

const m0 = E.computeReview(E.parseBaseRows(base), REFI, META);
/* the target: a mutual fund with units that the unchanged book reconciles and splits */
const tPos = m0.taxation.positions.find(p => p.product === 'Mutual Funds' && p.baseUnits > 0 && !p.amtMode);
ok(!!tPos, 'the synthetic book has a unit-priced mutual fund that Taxation splits (' + (tPos && tPos.name) + ')');
const ti = base.findIndex((row, i) => i > 0 && row[0] === tPos.client && row[1] === tPos.name);
function splitFolio(secondUnits) {
  const a = base.map(x => x.slice()), row = a[ti], b = row.slice();
  money.forEach(k => { if (typeof row[k] === 'number') { const w = row[k]; row[k] = w * 0.6; b[k] = w * 0.4; } });
  const u = row[cU]; row[cU] = u * 0.6; b[cU] = secondUnits === undefined ? u * 0.4 : secondUnits; b[cF] = row[cF] + '-B';
  a.splice(ti + 1, 0, b);
  return a;
}
const mFull = E.computeReview(E.parseBaseRows(splitFolio()), REFI, META);
const pFull = mFull.taxation.positions.find(p => p.client === tPos.client && p.name === tPos.name);
ok(pFull && near(pFull.baseUnits, tPos.baseUnits, 1e-6), 'split into two folios that both have units: still reconciled and split on ' +
  (pFull && pFull.baseUnits) + ' units (the whole holding, ' + tPos.baseUnits + ')');
const mGap = E.computeReview(E.parseBaseRows(splitFolio(null)), REFI, META);
const T = mGap.taxation;
const gap = T.unreconciled.find(p => p.client === tPos.client && p.name === tPos.name);
ok(!!gap && !T.positions.some(p => p.client === tPos.client && p.name === tPos.name),
  'the second folio without units: the holding is unsplit (listed with the unreconciled), not split on 60% of its units');
ok(gap && !gap.amtMode && gap.baseUnits === null && /a merged folio of this holding has no units/.test(gap.reason || ''),
  'it is not matched on invested value (amtMode ' + (gap && gap.amtMode) + '), its base units are blank, and the reason says why');
ok(gap && near(gap.cmv, tPos.cmv, 1e-9), 'its CMV is the whole holding\'s (' + (gap && gap.cmv) + ')');
const others = all(m0.taxation).filter(p => !(p.client === tPos.client && p.name === tPos.name));
const othersGap = all(T).filter(p => !(p.client === tPos.client && p.name === tPos.name));
const same = (a, b) => (a == null && b == null) || near(a, b, 1e-9);
ok(others.length === othersGap.length && others.every(p => othersGap.some(q => q.client === p.client && q.name === p.name && !!q.amtMode === !!p.amtMode &&
  same(q.ltCmv, p.ltCmv) && same(q.stCmv, p.stCmv) && (q.reason || '') === (p.reason || ''))), 'every other holding is classified as before (' + others.length + ' holdings)');
ok(near(T.totals.cmv, m0.taxation.totals.cmv, 1e-9), 'the Taxation CMV total is unchanged (' + T.totals.cmv.toFixed(4) + ')');
const rupee = all(m0.taxation).filter(p => p.amtMode);
ok(rupee.length > 0 && rupee.every(p => all(T).some(q => q.name === p.name && q.amtMode)),
  'holdings without units in the base file (priced in rupees) are still matched on invested value (' + rupee.length + ')');

console.log(fail ? fail + ' FAILURE(S)' : 'all KI-140 checks passed');
process.exit(fail ? 1 : 0);
