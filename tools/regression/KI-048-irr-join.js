/* ============================================================================
   KI-048 (audit NEW-2), with KI-100 — client-sheet transaction XIRR / BMXIRR
   are joined to the IRR file by client + instrument, never by the IRR file's
   own asset / product labels, and keep their since-inception scope.

     node tools/regression/KI-048-irr-join.js

   Before the fix the client sheets grouped IRR flows by the IRR file's ASSET
   CLASS / PRODUCT labels, so a benchmark sheet labelled all "Equity", a
   "Mutual Fund" vs "Mutual Funds" spelling, or "EQUITY" gave wrong figures or
   fell back silently to CMV weighting, and contradicted the workbook's own
   Fund IRR sheet (which joins by client + instrument).

   The definition checked here (the fix, round 2; OD-4 is not decided by it):
   - an asset / product subtotal is the XIRR of the fund flows (and the BMXIRR
     of the benchmark flows) of the IRR instruments in that bucket, each once:
     those the client's own base holdings in the bucket resolve to, whatever
     the IRR file's labels say, plus the client's IRR instruments that no
     holding resolves to (fully redeemed, or a name that does not resolve),
     placed by the IRR file's own SI Xirr asset / product labels normalised to
     the sheet's rows (case, spacing, punctuation, singular / plural);
   - an instrument that cannot be placed counts only in the Grand Total and is
     named in the § note with its rupee flows;
   - the Grand Total is the XIRR / BMXIRR of ALL the client's flows.

   Known answers. tools/make-sample-base.js prices every holding off a constant
   growth NAV path and writes its exact flows to the IRR workbook; this test
   adds redeemed, renamed and badly labelled instruments with flows of its own.
   The expected value of every subtotal and Grand Total is computed here: the
   bucket's instruments are chosen by this file's own reading of the rule above
   (holding names equal the IRR names in the synthetic book, by construction),
   and the rate by its own bisection solver (actual/365), independent of the
   engine's xirr. The audit's figures for the same book (pr-audit
   verify-calc-2/v_bench_labels.js) are also checked to 4 dp: Client A Equity
   BMXIRR 12.6442%, Client B Equity BMXIRR 14.6332%, Client B Equity / Mutual
   Funds BMXIRR 15.2973%, Client B Mutual Funds XIRR 18.6504%, Client B Equity
   XIRR 16.6472%. Where the base file's and the IRR file's labels coincide,
   every client-sheet asset / product / grand-total row must equal its Fund IRR
   row (the engine's tree and the workbook's Fund IRR sheet).

   Also checked: the § note's wording and numbers for each case; a bucket with
   no instrument is blank (not the base file's CMV-weighted figure); a holding
   whose transaction XIRR or BMXIRR cannot be computed is blank and counted
   (KI-100); the notes reach the workbook and a holdings-slide box that sits
   above the black footer band and below the table.

   Synthetic data only (make-sample-base.js). Exit code 1 on any failure.
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');
const { build } = require('../make-sample-base.js');

const H = load();
const { XLSX, E, Ppt } = H;
const fx = build(H);

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const aoa = (wb, n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
const wbB = XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true });
const base0 = aoa(wbB, 'Base File');
const parseBase = () => E.parseBaseRows(base0.map(r => r.slice()));
const wbI = XLSX.read(fx.irrBuf, { type: 'buffer', cellDates: true });
const irr0 = E.parsers.parseIRR(wbI.SheetNames, n => aoa(wbI, n));
const META = { familyName: 'Sample Family', asOnDate: '30 Sep 2026' };
const A = 'Sample Client A', B = 'Sample Client B';
const f4 = v => v == null ? 'blank' : v.toFixed(4) + '%';
const dt = (y, m, d) => new Date(y, m - 1, d);

/* independent XIRR: actual/365, plain bisection on [-99%, 1000%] to a 1e-14 bracket */
function myXirr(cf) {
  if (cf.length < 2) return null;
  if (!cf.some(c => c.a > 0) || !cf.some(c => c.a < 0)) return null;
  const t0 = Math.min(...cf.map(c => +c.d));
  if (!cf.some(c => +c.d > t0)) return null;
  const npv = r => cf.reduce((s, c) => s + c.a / Math.pow(1 + r, (c.d - t0) / 86400000 / 365), 0);
  let lo = -0.99, hi = 10, flo = npv(lo);
  if ((flo < 0) === (npv(hi) < 0)) return null;
  for (let i = 0; i < 300 && hi - lo > 1e-14; i++) {
    const m = (lo + hi) / 2, fm = npv(m);
    if ((flo < 0) !== (fm < 0)) hi = m; else { lo = m; flo = fm; }
  }
  return (lo + hi) / 2;
}
/* this file's reading of the label rule: case, spacing, punctuation, singular / plural */
const nlT = s => String(s == null ? '' : s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  .map(w => w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : (w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w)).join(' ');
/* rupees -> the review's Cr display, as the § note writes it */
const crs = r => '₹' + (Math.round(r / 1e7 * 100) / 100).toFixed(2) + ' Cr';

/* an IRR variant: relabel, rename, drop and add flows, then run the review */
const row = (client, instrument, asset, product, d, a) =>
  ({ client, account: '', instrument, folio: '', asset, product, index: '', d, a, price: null, ttype: '', rtype: '', category: '' });
function variant(o) {
  const keepF = o.dropF ? t => !o.dropF(t) : () => true, keepB = o.dropB ? t => !o.dropB(t) : () => true;
  const irr = { fund: irr0.fund.filter(keepF).map(t => Object.assign({}, t)),
                bench: irr0.bench.filter(keepB).map(t => Object.assign({}, t)), date: irr0.date };
  if (o.mutF) irr.fund.forEach(o.mutF);
  if (o.mutB) irr.bench.forEach(o.mutB);
  (o.addF || []).forEach(t => irr.fund.push(t));
  (o.addB || []).forEach(t => irr.bench.push(t));
  const m = E.computeReview(parseBase(), Object.assign({}, H.REF, { IRR: irr }), META);
  return { irr, m };
}

/* the expected instruments of every subtotal: the client's holdings in the bucket (by name), plus its IRR
   instruments that are not a holding, placed by their SI Xirr labels; the Grand Total takes all flows */
function expected(v) {
  const out = [];
  v.m.clients.forEach(cl => {
    const hold = v.m.holdings.filter(h => h.client === cl.name);
    const names = new Set(hold.map(h => h.name));
    const fF = v.irr.fund.filter(t => t.client === cl.name), fB = v.irr.bench.filter(t => t.client === cl.name);
    const ins = [...new Set(fF.map(t => t.instrument))];
    const assets = [...new Set(hold.map(h => h.asset))];
    const pick = (lab, opts) => { if (!lab) return null; const hit = opts.filter(o => nlT(o) === lab); return hit.length === 1 ? hit[0] : null; };
    const place = {};
    ins.filter(i => !names.has(i)).forEach(i => {
      const rs = fF.filter(t => t.instrument === i);
      const la = [...new Set(rs.map(t => nlT(t.asset)))], lp = [...new Set(rs.map(t => nlT(t.product)))];
      const a = la.length === 1 ? pick(la[0], assets) : null;
      const p = (a != null && lp.length === 1) ? pick(lp[0], [...new Set(hold.filter(h => h.asset === a).map(h => h.product))]) : null;
      place[i] = { a, p };
    });
    let curA = null;
    cl.rows.forEach(r => {
      if (r.level === 'asset') curA = r.label;
      if (r.level === 'item') return;
      let set = null;
      if (r.level !== 'grand') {
        set = new Set(hold.filter(h => h.asset === curA && (r.level === 'asset' || h.product === r.label) && ins.indexOf(h.name) >= 0).map(h => h.name));
        Object.keys(place).forEach(i => { if (place[i].a === curA && (r.level === 'asset' || place[i].p === r.label)) set.add(i); });
      }
      const tx = myXirr(fF.filter(t => !set || set.has(t.instrument)));
      const tb = myXirr(fB.filter(t => !set || set.has(t.instrument)));
      out.push({ client: cl.name, level: r.level, asset: curA, label: r.label, row: r, n: set ? set.size : ins.length,
                 tx: tx == null ? null : tx * 100, tb: tb == null ? null : tb * 100 });
    });
  });
  return out;
}
const same = (got, exp) => (got == null && exp == null) || (got != null && exp != null && Math.abs(got - exp) <= 1e-6);
const find = (list, client, level, label, asset) => list.find(s => s.client === client && s.level === level &&
  s.label === label && (asset == null || s.asset === asset));

function allExact(name, v) {
  const S = expected(v);
  const bad = S.filter(s => !same(s.row.xirr, s.tx) || !same(s.row.bmxirr, s.tb));
  ok(bad.length === 0, name + ': every asset / product subtotal and Grand Total XIRR and BMXIRR equals the exact answer' +
    (bad.length ? ' — ' + bad.map(s => s.client.slice(-1) + ' ' + s.level + ' ' + (s.asset || '') + '/' + s.label + ' XIRR ' + f4(s.row.xirr) + ' vs ' + f4(s.tx) +
      ', BMXIRR ' + f4(s.row.bmxirr) + ' vs ' + f4(s.tb)).join('; ') : ' (' + S.length + ' rows)'));
  return S;
}
const audit = (name, s, key, exp) => ok(s && s.row[key] != null && Math.abs(s.row[key] - exp) < 0.00005,
  name + ' = ' + exp.toFixed(4) + '% (got ' + (s ? f4(s.row[key]) : 'no row') + ')');

/* the Fund IRR tree row for a client-sheet row (level 1 client, 2 asset, 3 product under that asset) */
function treeRow(m, client, level, label, asset) {
  const i = m.irr.findIndex(x => x.level === 1 && x.label === client);
  if (i < 0) return null;
  if (level === 'grand') return m.irr[i];
  let curA = null;
  for (let j = i + 1; j < m.irr.length && m.irr[j].level > 1; j++) {
    const x = m.irr[j];
    if (x.level === 2) { curA = x.label; if (level === 'asset' && x.label === label) return x; }
    if (x.level === 3 && level === 'product' && curA === asset && x.label === label) return x;
  }
  return null;
}
function treeEqual(name, v) {
  const S = expected(v);
  const bad = S.filter(s => { const t = treeRow(v.m, s.client, s.level, s.label, s.asset);
    return !t || !same(s.row.xirr, t.fund == null ? null : t.fund * 100) || !same(s.row.bmxirr, t.bench == null ? null : t.bench * 100); });
  ok(bad.length === 0, name + ': every client-sheet asset / product / grand-total row equals its Fund IRR row' +
    (bad.length ? ' — ' + bad.map(s => s.client.slice(-1) + ' ' + s.level + ' ' + s.label).join('; ') : ' (' + S.length + ' rows)'));
}
/* the workbook: each client-sheet subtotal (2 dp) against the Fund IRR sheet */
function workbookEqual(name, v) {
  const wb = E.buildXLSX(v.m, XLSX), fi = aoa(wb, 'Fund IRR');
  const bad = [];
  let n = 0;
  v.m.clients.forEach(cl => {
    const cs = aoa(wb, cl.name), i0 = cs.findIndex(r => r && r[0] === cl.rows[0].label);
    const ci = fi.findIndex(r => r && r[0] === 'Client' && String(r[1]).trim() === cl.name);
    let curA = null;
    cl.rows.forEach((r, k) => {
      if (r.level === 'asset') curA = r.label;
      if (r.level === 'item') return;
      const x = cs[i0 + k];
      let f = null;
      if (r.level === 'grand') f = fi[ci];
      else {
        let fa = null;
        for (let j = ci + 1; j < fi.length && fi[j] && fi[j][0] !== 'Client'; j++) {
          if (fi[j][0] === 'Asset') fa = String(fi[j][1]).trim();
          if (r.level === 'asset' && fi[j][0] === 'Asset' && fa === r.label) { f = fi[j]; break; }
          if (r.level === 'product' && fi[j][0] === 'Product' && fa === curA && String(fi[j][1]).trim() === r.label) { f = fi[j]; break; }
        }
      }
      const r2 = y => typeof y === 'number' ? Math.round(y * 100) / 100 : '—';
      n++;
      if (!x || !f || x[0] !== r.label || r2(x[7]) !== f[3] || r2(x[8]) !== f[4]) bad.push(cl.name.slice(-1) + ' ' + r.level + ' ' + r.label + ' ' + (x ? r2(x[7]) + '/' + r2(x[8]) : '?') + ' vs ' + (f ? f[3] + '/' + f[4] : '?'));
    });
  });
  ok(bad.length === 0, name + ': on the workbook, each client sheet\'s subtotal XIRR / BMXIRR equals its Fund IRR sheet row' +
    (bad.length ? ' — ' + bad.join('; ') : ' (' + n + ' rows)'));
}
/* rupee flows of some instruments, as the § note quotes them */
const flowsOf = (v, client, list) => { let i = 0, o = 0; v.irr.fund.filter(t => t.client === client && list.indexOf(t.instrument) >= 0)
  .forEach(t => { if (t.a < 0) i -= t.a; else o += t.a; }); return '(' + crs(i) + ' invested, ' + crs(o) + ' redeemed or closing value'; };
const cmvShare = (client, names) => { const c = base0[0].indexOf('Current Market Value (Cr.)'), cc = base0[0].indexOf('Client Name'), cn = base0[0].indexOf('Instrument Name');
  const rs = base0.slice(1).filter(r => r && r[cc] === client), tot = rs.reduce((s, r) => s + r[c], 0);
  return (Math.round(rs.filter(r => names.indexOf(r[cn]) >= 0).reduce((s, r) => s + r[c], 0) / tot * 100 * 100) / 100).toFixed(2) + '% of CMV'; };
const has = (s, part) => !!s && s.indexOf(part) >= 0;

/* ---- A: consistent labels (the baseline the book was built with; a control, unchanged by the fix) ---- */
console.log('--- consistent labels (control) ---');
allExact('consistent labels (control: the same before and after the fix)', variant({}));

/* ---- B: the benchmark sheet labels every row "Equity" ---- */
console.log('--- SI Bmxirr ASSET CLASS = "Equity" on every row ---');
const allEquityB = t => { t.asset = 'Equity'; };
const vB = variant({ mutB: allEquityB });
const SB = allExact('all-"Equity" benchmark sheet', vB);
audit('Client A Equity BMXIRR', find(SB, A, 'asset', 'Equity'), 'bmxirr', 12.6442);
audit('Client B Equity BMXIRR', find(SB, B, 'asset', 'Equity'), 'bmxirr', 14.6332);
audit('Client B Equity / Mutual Funds BMXIRR', find(SB, B, 'product', 'Mutual Funds', 'Equity'), 'bmxirr', 15.2973);
treeEqual('all-"Equity" benchmark sheet', vB);

/* ---- C: "Mutual Fund" instead of "Mutual Funds" in the IRR file (both sheets) ---- */
console.log('--- IRR PRODUCT "Mutual Funds" -> "Mutual Fund" ---');
const mf = t => { if (t.product === 'Mutual Funds') t.product = 'Mutual Fund'; };
const SC = allExact('"Mutual Fund" product label', variant({ mutF: mf, mutB: mf }));
audit('Client B Equity / Mutual Funds XIRR', find(SC, B, 'product', 'Mutual Funds', 'Equity'), 'xirr', 18.6504);
const SCa = find(SC, A, 'product', 'Mutual Funds', 'Equity');
ok(SCa && SCa.row.xcov == null && SCa.row.bcov == null, '"Mutual Fund" product label: no silent fall-back to the CMV-weighted base-file figure');

/* ---- D: upper-case asset labels in the IRR file (both sheets) ---- */
console.log('--- IRR ASSET CLASS upper-case ---');
const up = t => { t.asset = String(t.asset).toUpperCase(); };
const SD = allExact('upper-case asset labels', variant({ mutF: up, mutB: up }));
audit('Client B Equity XIRR', find(SD, B, 'asset', 'Equity'), 'xirr', 16.6472);

/* ---- G: a fully redeemed fund, and a holding whose IRR name does not resolve (the reviewer's case) ---- */
console.log('--- a fully redeemed fund and an unresolvable IRR name (Client A), benchmark sheet all "Equity" ---');
const flexi = fx.book.find(h => h.client === A && h.asset === 'Equity' && h.product === 'Mutual Funds' && h.redeem).name;
const RENAMED = 'Zeta Horizon Growth Scheme', EXITED = 'Sample Exited Equity Fund';
const ren = t => { if (t.client === A && t.instrument === flexi) t.instrument = RENAMED; };
const vG = variant({
  mutF: ren, mutB: t => { ren(t); allEquityB(t); },
  addF: [row(A, EXITED, 'Equity', 'Mutual Funds', dt(2022, 5, 2), -3000000), row(A, EXITED, 'Equity', 'Mutual Funds', dt(2025, 5, 2), 2000000)],
  addB: [row(A, EXITED, 'Equity', 'Mutual Funds', dt(2022, 5, 2), -3000000), row(A, EXITED, 'Equity', 'Mutual Funds', dt(2025, 5, 2), 4000000)]
});
const SG = allExact('redeemed + unresolved instruments', vG);
/* the same buckets over the client's held, resolving instruments only (what the first fix computed) */
const heldOnly = (v, client, asset, product, ins) => {
  const set = new Set(v.m.holdings.filter(h => h.client === client && h.asset === asset && (product == null || h.product === product) && ins.indexOf(h.name) >= 0).map(h => h.name));
  const x = myXirr(v.irr.fund.filter(t => t.client === client && set.has(t.instrument))), b = myXirr(v.irr.bench.filter(t => t.client === client && set.has(t.instrument)));
  return { tx: x == null ? null : x * 100, tb: b == null ? null : b * 100 };
};
const includes = (name, v, s, n, product) => {
  const ins = [...new Set(v.irr.fund.filter(t => t.client === A).map(t => t.instrument))], h = heldOnly(v, A, 'Equity', product, ins);
  ok(s && s.n === n && same(s.row.xirr, s.tx) && same(s.row.bmxirr, s.tb) && !same(s.row.xirr, h.tx) && !same(s.row.bmxirr, h.tb),
    name + ' (' + n + ' instruments): XIRR ' + (s && f4(s.row.xirr)) + ' / BMXIRR ' + (s && f4(s.row.bmxirr)) + ' = the exact answer with them (' + (s && f4(s.tx)) + ' / ' + (s && f4(s.tb)) +
    '), not the held-only answer (' + f4(h.tx) + ' / ' + f4(h.tb) + ')');
};
includes('redeemed + unresolved: Client A Equity includes the redeemed and the renamed fund', vG, find(SG, A, 'asset', 'Equity'), 6);
includes('redeemed + unresolved: Client A Equity / Mutual Funds includes them too', vG, find(SG, A, 'product', 'Mutual Funds', 'Equity'), 4, 'Mutual Funds');
treeEqual('redeemed + unresolved', vG);
workbookEqual('redeemed + unresolved', vG);
const clG = vG.m.clients.find(c => c.name === A), nG = clG.irrNote;
ok(has(nG, '2 instruments not held or not matched to a holding are included by the IRR file\'s labels ' + flowsOf(vG, A, [EXITED, RENAMED]) + ')') &&
   vG.m.clients.find(c => c.name === B).irrNote == null,
  'redeemed + unresolved: Client A\'s § note gives the count and rupee flows of the instruments included by label, Client B has none (' + nG + ')');
const flexItem = clG.rows.find(r => r.level === 'item' && r.label === flexi), flexPlan = fx.book.find(h => h.client === A && h.name === flexi);
ok(has(nG, '1 holding (' + cmvShare(A, [flexi]) + ') matches no instrument in the IRR file and shows the base file\'s XIRR/BMXIRR; any transactions it has are among the instruments above') &&
   flexItem && same(flexItem.xirr, flexPlan.g * 100) && same(flexItem.bmxirr, flexPlan.gb * 100),
  'redeemed + unresolved: the holding whose IRR name does not resolve keeps the base file\'s XIRR / BMXIRR, and the § note says so with its share of CMV');

/* ---- H: labels that are normalised, asset-only, unplaceable, conflicting; a benchmark with no fund flows ---- */
console.log('--- label placement: normalised, asset only, unplaceable, conflicting; benchmark-only series ---');
const X1 = 'Sample Exited Case Fund', X2 = 'Sample Exited Listed ETF', X3 = 'Sample Exited Gold Fund', X4 = 'Sample Exited Mixed Fund', XB = 'Sample Benchmark Only Series';
const vH = variant({
  addF: [row(A, X1, 'EQUITY', 'Mutual Fund', dt(2023, 1, 2), -1000000), row(A, X1, 'EQUITY', 'Mutual Fund', dt(2025, 6, 30), 1200000),
         row(A, X2, 'Equity', 'ETFs', dt(2023, 6, 1), -500000), row(A, X2, 'Equity', 'ETFs', dt(2026, 1, 15), 600000),
         row(A, X3, 'Commodity', 'Mutual Funds', dt(2022, 9, 1), -800000), row(A, X3, 'Commodity', 'Mutual Funds', dt(2024, 9, 2), 700000),
         row(B, X4, 'Equity', 'Mutual Funds', dt(2023, 3, 1), -400000), row(B, X4, 'Debt', 'Mutual Funds', dt(2025, 3, 3), 500000)],
  addB: [row(A, X1, 'Equity', 'Mutual Funds', dt(2023, 1, 2), -1000000), row(A, X1, 'Equity', 'Mutual Funds', dt(2025, 6, 30), 1300000),
         row(A, X2, 'Equity', 'ETFs', dt(2023, 6, 1), -500000), row(A, X2, 'Equity', 'ETFs', dt(2026, 1, 15), 650000),
         row(A, X3, 'Commodity', 'Mutual Funds', dt(2022, 9, 1), -800000), row(A, X3, 'Commodity', 'Mutual Funds', dt(2024, 9, 2), 900000),
         row(B, X4, 'Equity', 'Mutual Funds', dt(2023, 3, 1), -400000), row(B, X4, 'Debt', 'Mutual Funds', dt(2025, 3, 3), 450000),
         row(A, XB, 'Equity', 'Mutual Funds', dt(2023, 1, 2), -1000000), row(A, XB, 'Equity', 'Mutual Funds', dt(2026, 9, 30), 1300000)]
});
const SH = allExact('label placement', vH);
includes('label placement: Client A Equity includes the "EQUITY" / "Mutual Fund" and the "Equity" / "ETFs" instruments, not the "Commodity" one', vH, find(SH, A, 'asset', 'Equity'), 7);
includes('label placement: Client A Equity / Mutual Funds includes the "EQUITY" / "Mutual Fund" one only', vH, find(SH, A, 'product', 'Mutual Funds', 'Equity'), 4, 'Mutual Funds');
const nHA = vH.m.clients.find(c => c.name === A).irrNote, nHB = vH.m.clients.find(c => c.name === B).irrNote;
ok(has(nHA, '2 instruments not held or not matched to a holding are included by the IRR file\'s labels ' + flowsOf(vH, A, [X1, X2]) + '; 1 in an asset subtotal only, no product row matching its product label)') &&
   has(nHA, '1 instrument not held or not matched to a holding could not be placed in a subtotal by its labels and counts only in the Grand Total ' + flowsOf(vH, A, [X3]) + ')') &&
   has(nHA, '1 benchmark series with no fund transactions counts only in the Grand Total BMXIRR'),
  'label placement: Client A\'s § note counts the instruments placed by label, the one placed by asset only, the one not placed and the benchmark-only series (' + nHA + ')');
ok(has(nHB, '1 instrument not held or not matched to a holding could not be placed in a subtotal by its labels and counts only in the Grand Total ' + flowsOf(vH, B, [X4]) + ')'),
  'label placement: an instrument whose rows carry two asset labels is not placed, and Client B\'s § note says so (' + nHB + ')');

/* ---- E: a bucket none of whose holdings has IRR transactions ---- */
console.log('--- no IRR transactions for Client A\'s PMS holding ---');
const pmsName = fx.book.find(h => h.client === A && h.product === 'PMS').name;
const vE = variant({ dropF: t => t.client === A && t.instrument === pmsName, dropB: t => t.client === A && t.instrument === pmsName });
const SE = allExact('PMS without transactions', vE);
const pmsRow = find(SE, A, 'product', 'PMS', 'Equity');
ok(pmsRow && pmsRow.row.xirr == null && pmsRow.row.bmxirr == null,
  'a subtotal with no IRR transactions is blank, not the base file\'s CMV-weighted figure (PMS XIRR ' + (pmsRow ? f4(pmsRow.row.xirr) : '?') + ')');
const clE = vE.m.clients.find(c => c.name === A);
const pmsItem = clE.rows.find(r => r.level === 'item' && r.label === pmsName);
const pmsPlan = fx.book.find(h => h.name === pmsName);
ok(has(clE.irrNote, '1 subtotal blank: none of its holdings matches an instrument in the IRR file') &&
   has(clE.irrNote, '1 holding (' + cmvShare(A, [pmsName]) + ') has no transactions for this client in the IRR file and shows the base file\'s XIRR/BMXIRR') &&
   !has(clE.irrNote, 'not matched to a holding') &&
   pmsItem && same(pmsItem.xirr, pmsPlan.g * 100) && same(pmsItem.bmxirr, pmsPlan.gb * 100) &&
   vE.m.clients.find(c => c.name === B).irrNote == null,
  'the § note says the PMS subtotal has no matching instrument and the holding has no transactions, with its share of CMV; ' +
  'the holding keeps the base file\'s XIRR / BMXIRR, as the note says; the other client, fully covered, has no note (' + clE.irrNote + ')');

/* ---- F: KI-100 — transaction rates that cannot be computed are blank, not the base file's ---- */
console.log('--- KI-100: no closing value for one holding, no benchmark series for another ---');
const sif = fx.book.find(h => h.client === B && h.product === 'SIF').name;
const hyb = fx.book.find(h => h.client === A && h.asset === 'Hybrid').name;
const vF = variant({ dropF: t => t.client === B && t.instrument === sif && /closing/i.test(t.rtype || ''),
                     dropB: t => t.client === A && t.instrument === hyb });
const hS = vF.m.holdings.find(h => h.client === B && h.name === sif), hH = vF.m.holdings.find(h => h.client === A && h.name === hyb);
ok(hS.xirrFrac == null && hS.bmxirrFrac != null && Math.abs(hS.bmxirrFrac - myXirr(vF.irr.bench.filter(t => t.client === B && t.instrument === sif))) < 1e-8,
  'KI-100: a holding whose fund flows give no rate shows a blank XIRR, not the base file\'s ' + (fx.book.find(h => h.name === sif).g * 100).toFixed(2) +
  '% (got ' + hS.xirrFrac + '), while its benchmark side, which has a rate, stays transaction-based');
ok(hH.bmxirrFrac == null && hH.xirrFrac != null, 'KI-100: a holding with no benchmark series shows a blank BMXIRR (got ' + hH.bmxirrFrac + ')');
const SF = allExact('KI-100 flows', vF);
const sifRow = find(SF, B, 'product', 'SIF', 'Equity'), hybRow = find(SF, A, 'asset', 'Hybrid');
ok(sifRow && sifRow.row.xirr == null && same(sifRow.row.bmxirr, sifRow.tb), 'KI-100: the SIF subtotal\'s XIRR is blank and its BMXIRR exact');
ok(hybRow && hybRow.row.bmxirr == null && same(hybRow.row.xirr, hybRow.tx), 'KI-100: the Hybrid subtotal\'s BMXIRR is blank (no CMV-weighted fall-back) and its XIRR exact');
const nB = vF.m.clients.find(c => c.name === B).irrNote, nA = vF.m.clients.find(c => c.name === A).irrNote;
ok(has(nB, '1 subtotal with XIRR or BMXIRR blank: no rate from its transactions or benchmark series') &&
   has(nB, '1 holding whose XIRR or BMXIRR cannot be computed from its transactions or benchmark series, left blank') &&
   has(nA, '2 subtotals with XIRR or BMXIRR blank: no rate from their transactions or benchmark series') &&
   has(nA, '1 holding whose XIRR or BMXIRR cannot be computed from its transactions or benchmark series, left blank'),
  'KI-100: each client\'s § note counts its blank holding and its subtotals with no rate (' + nB + ' | ' + nA + ')');

/* ---- the notes reach the workbook and the holdings slides ---- */
console.log('--- displays ---');
const EMU = 914400;
(async () => {
  try {
    const wb = E.buildXLSX(vE.m, XLSX);
    const cs = aoa(wb, A);
    ok(!!clE.irrNote && cs.some(r => r && r[0] === clE.irrNote), 'workbook: the client sheet carries the IRR footnote');
    const pmsX = cs.find(r => r && r[0] === 'PMS');
    ok(pmsX && (pmsX[7] == null || pmsX[7] === '—') && (pmsX[8] == null || pmsX[8] === '—'), 'workbook: the PMS subtotal is blank');
  } catch (e) { ok(false, 'workbook builds: ' + (e && e.message)); }
  try {
    /* the longest note this file builds (Client A, label placement), on every holdings slide of that client */
    const buf = await E.buildPPTX(vH.m, Ppt, 'holdings').write({ outputType: 'nodebuffer' });
    const zip = await global.JSZip.loadAsync(buf);
    const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    const xmls = await Promise.all(names.map(n => zip.file(n).async('string')));
    const pages = xmls.filter(x => x.indexOf('PORTFOLIO HOLDINGS - ' + A.toUpperCase()) >= 0 || x.indexOf('Portfolio Holdings - ' + A) >= 0);
    const issues = [];
    pages.forEach((x, i) => {
      const sp = x.split('<p:sp>').find(s => s.indexOf('§ Transaction-based XIRR/BMXIRR') >= 0);
      if (!sp) { issues.push('page ' + (i + 1) + ': no § note'); return; }
      const off = /<a:off x="(\d+)" y="(\d+)"\/>/.exec(sp), ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(sp);
      const top = +off[2] / EMU, bot = (+off[2] + +ext[2]) / EMU;
      if (!/anchor="b"/.test(sp)) issues.push('page ' + (i + 1) + ': the note box is not bottom-anchored');
      if (bot > 7.23 - 0.04) issues.push('page ' + (i + 1) + ': the note box ends at ' + bot.toFixed(3) + ' in, on the black band (7.23)');
      /* the table: header + rows + grand total, each at most 0.40 in (an instrument name wrapping to two
         lines, the tallest row measured on a PowerPoint render of this table) */
      const tr = (x.match(/<a:tr /g) || []).length;
      const tableBottom = 1.12 + tr * 0.40;
      if (tableBottom > top + 1e-9) issues.push('page ' + (i + 1) + ': ' + tr + ' table rows reach ' + tableBottom.toFixed(3) + ' in, below the note box top ' + top.toFixed(3));
    });
    ok(pages.length > 0 && issues.length === 0, 'deck: on each of Client A\'s ' + pages.length + ' holdings slides the notes sit in a bottom-anchored box above the black band and below the table' +
      (issues.length ? ' — ' + issues.join('; ') : ''));
  } catch (e) { ok(false, 'deck builds: ' + (e && e.stack || e)); }
  console.log(fail ? fail + ' FAILURE(S)' : 'all KI-048 checks passed');
  process.exit(fail ? 1 : 0);
})();
