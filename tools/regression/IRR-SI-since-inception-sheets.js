/* ============================================================================
   IRR-SI — the IRR (cashflow) file's since-inception sheets
   (tools/patches/2026-11-26-irr-si-sheets.js; MOD-04's order, 26 Nov 2026).

     node tools/regression/IRR-SI-since-inception-sheets.js

   The platform's cashflow file holds six sheets: SI Xirr, SI Bmxirr, YTD Xirr,
   YTD Bmxirr, QTD Xirr, QTD Bmxirr. Before the fix parseIRR took the last
   matching names, QTD Xirr and QTD Bmxirr, so every transaction XIRR came from
   quarter-to-date flows. Known answers:
   1. end to end: the review computed from the six-sheet file equals, figure for
      figure, the review computed from a file holding only the SI pair (the
      sample book's exact flows, tools/make-sample-base.js), and differs from
      the review of a file holding only the QTD pair (so the test can tell them
      apart): holding XIRRs, client Grand Totals and the family Fund IRR tree;
   2. sheet choice by name, each case stated: the platform order and its
      reverse; SI-, SI_ and "Since Inception" names; "SIP Xirr" is not SI; a
      file with legacy names only ("Xirr", "Bmxirr") keeps the legacy rule
      (the last match); MTD and FYTD are never taken; a file with period sheets
      only gives no fund rows (the upload then says it needs an SI Xirr sheet);
   3. the content fallback (renamed tabs) still works, and never takes a period
      sheet.
   Synthetic data only. Exit code 1 on any failure.
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');
const { build } = require('../make-sample-base.js');

const H = load();
const { XLSX, E } = H;
const fx = build(H);
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const aoa = (wb, n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
const wbI = XLSX.read(fx.irrBuf, { type: 'buffer', cellDates: true });
const SI_F = aoa(wbI, 'SI Xirr'), SI_B = aoa(wbI, 'SI Bmxirr');
const base0 = aoa(XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true }), 'Base File');
const META = { familyName: 'Sample Family', asOnDate: '30 Sep 2026' };

/* a period sheet: the same header, only the flows dated on or after `from`, plus a closing row; its rates differ from SI */
function period(rows, from) {
  const h = rows[0], di = h.findIndex(c => /DATE/i.test(String(c)));
  return [h].concat(rows.slice(1).filter(r => r[di] instanceof Date && r[di] >= from));
}
const QTD_F = period(SI_F, new Date(2026, 6, 1)), QTD_B = period(SI_B, new Date(2026, 6, 1));
const YTD_F = period(SI_F, new Date(2026, 0, 1)), YTD_B = period(SI_B, new Date(2026, 0, 1));

/* a workbook from [name, rows] pairs, read back the way the page reads an upload */
function book(sheets) {
  const wb = XLSX.utils.book_new();
  for (const [n, rows] of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), n);
  return XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array', cellDates: true });
}
const parse = wb => E.parsers.parseIRR(wb.SheetNames, n => aoa(wb, n));
const review = irr => E.computeReview(E.parseBaseRows(base0.map(r => r.slice())), Object.assign({}, H.REF, { IRR: irr }), META);
const sig = m => JSON.stringify({
  h: m.holdings.map(h => [h.client, h.name, h.xirrFrac, h.bmxirrFrac]),
  g: m.clients.map(c => { const g = c.rows.find(r => r.level === 'grand'); return [c.name, g.xirr, g.bmxirr]; }),
  t: (m.irr || []).map(r => [r.level, r.label, r.fund, r.bench]),
});

/* 1. end to end */
const six = book([['SI Xirr', SI_F], ['SI Bmxirr', SI_B], ['YTD Xirr', YTD_F], ['YTD Bmxirr', YTD_B], ['QTD Xirr', QTD_F], ['QTD Bmxirr', QTD_B]]);
const siOnly = book([['SI Xirr', SI_F], ['SI Bmxirr', SI_B]]);
const qtdOnly = book([['Xirr', QTD_F], ['Bmxirr', QTD_B]]);
const mSix = review(parse(six)), mSi = review(parse(siOnly)), mQtd = review(parse(qtdOnly));
ok(QTD_F.length > 1 && QTD_F.length < SI_F.length, '1. the QTD sheet holds fewer flows than SI (' + (QTD_F.length - 1) + ' of ' + (SI_F.length - 1) + ')');
ok(sig(mSix) === sig(mSi), '1. the six-sheet file gives the same holding XIRRs, client Grand Totals and Fund IRR tree as the SI pair alone');
ok(sig(mQtd) !== sig(mSi), '1. control: the QTD pair alone gives different figures (the test tells them apart)');
{ const t = (mSix.irr || []).find(r => r.level === 0), s = (mSi.irr || []).find(r => r.level === 0);
  ok(t && s && t.fund === s.fund && t.bench === s.bench, '1. family XIRR / BMXIRR from the six-sheet file = SI: ' + (t && (t.fund * 100).toFixed(4)) + '% / ' + (t && (t.bench * 100).toFixed(4)) + '%'); }

/* 1b. the known answer itself (financial review of 6c3074f, finding 6): each holding's XIRR / BMXIRR from the six-sheet
   file equals an independent XIRR (actual/365, plain bisection) of that client's and instrument's flows in the SI sheets */
function myXirr(cf) {
  if (cf.length < 2 || !cf.some(c => c.a > 0) || !cf.some(c => c.a < 0)) return null;
  const t0 = Math.min(...cf.map(c => +c.d));
  const npv = r => cf.reduce((s, c) => s + c.a / Math.pow(1 + r, (c.d - t0) / 86400000 / 365), 0);
  let lo = -0.99, hi = 10, flo = npv(lo);
  if ((flo < 0) === (npv(hi) < 0)) return null;
  for (let i = 0; i < 300 && hi - lo > 1e-14; i++) { const m = (lo + hi) / 2, fm = npv(m); if ((flo < 0) !== (fm < 0)) hi = m; else { lo = m; flo = fm; } }
  return (lo + hi) / 2;
}
function flows(rows, inst) {
  const h = rows[0].map(c => String(c).toUpperCase()), ci = h.findIndex(c => /^CLIENT/.test(c)), ii = h.findIndex(c => /^INSTRUMENT/.test(c)),
    di = h.findIndex(c => /DATE/.test(c)), ai = h.findIndex(c => /AMOUNT/.test(c));
  return rows.slice(1).filter(r => r[ci] === inst.client && r[ii] === inst.name && r[di] instanceof Date).map(r => ({ d: r[di], a: Number(r[ai]) }));
}
{ let n = 0, good = 0;
  for (const h of mSix.holdings) {
    const f = flows(SI_F, h), b = flows(SI_B, h);
    if (!f.length) continue;
    n++;
    const ex = myXirr(f), eb = myXirr(b);
    if (ex != null && Math.abs(h.xirrFrac - ex) < 1e-6 && (eb == null ? h.bmxirrFrac == null : Math.abs(h.bmxirrFrac - eb) < 1e-6)) good++;
  }
  ok(n > 5 && good === n, '1b. every holding with flows: XIRR / BMXIRR from the six-sheet file = an independent XIRR of its SI flows (' + good + '/' + n + ')'); }

/* 1c. MOD-04's list: an SI-only file and the legacy two-sheet file keep their output. The sample book's own IRR file (SI
   Xirr, SI Bmxirr) is read whole, and a file naming the same flows "Xirr" / "Bmxirr" gives the same review, figure for
   figure, which is the independent known answer above */
{ const own = parse(wbI), legacy = book([['Xirr', SI_F], ['Bmxirr', SI_B]]);
  ok(own.fund.length === SI_F.length - 1 && own.bench.length === SI_B.length - 1, '1c. SI only (the sample IRR file): every SI row is read (' + own.fund.length + ' fund, ' + own.bench.length + ' benchmark)');
  ok(sig(review(own)) === sig(mSi), '1c. SI only: the same review as before (the SI pair)');
  ok(sig(review(parse(legacy))) === sig(mSi), '1c. the legacy two-sheet file ("Xirr", "Bmxirr"): the same review, unchanged'); }

/* 2. sheet choice by name: which sheet each kind came from, by its row count (each sheet below holds a distinct count) */
const mk = n => [SI_F[0]].concat(SI_F.slice(1, 1 + n));
const mkB = n => [SI_B[0]].concat(SI_B.slice(1, 1 + n));
function chosen(names) {
  const sheets = names.map((nm, i) => [nm, /bm/i.test(nm) ? mkB(i + 2) : mk(i + 2)]);
  const r = parse(book(sheets)), byLen = {};
  sheets.forEach(([nm, rows]) => { byLen[rows.length - 1] = nm; });
  return { f: r.fund.length ? byLen[r.fund.length] : null, b: r.bench.length ? byLen[r.bench.length] : null };
}
const CASES = [
  [['SI Xirr', 'SI Bmxirr', 'YTD Xirr', 'YTD Bmxirr', 'QTD Xirr', 'QTD Bmxirr'], 'SI Xirr', 'SI Bmxirr', 'the platform order'],
  [['QTD Xirr', 'QTD Bmxirr', 'YTD Xirr', 'YTD Bmxirr', 'SI Xirr', 'SI Bmxirr'], 'SI Xirr', 'SI Bmxirr', 'the reverse order'],
  [['YTD Xirr', 'SI-Xirr', 'QTD Bmxirr', 'SI_Bmxirr'], 'SI-Xirr', 'SI_Bmxirr', 'SI- and SI_ names'],
  [['QTD Xirr', 'Since Inception Xirr', 'Since Inception Bmxirr', 'QTD Bmxirr'], 'Since Inception Xirr', 'Since Inception Bmxirr', '"Since Inception" names'],
  [['SI Xirr', 'SIP Xirr', 'SI Bmxirr'], 'SI Xirr', 'SI Bmxirr', '"SIP Xirr" is not SI (the legacy rule would take it, the last match)'],
  [['SIP Xirr', 'Bmxirr'], 'SIP Xirr', 'Bmxirr', 'no SI sheet: "SIP Xirr" is a fund sheet by the legacy rule'],
  [['Xirr', 'Bmxirr', 'Xirr 2', 'Bmxirr 2'], 'Xirr 2', 'Bmxirr 2', 'legacy names only: the last match, as before'],
  [['MTD Xirr', 'Xirr', 'FYTD Bmxirr', 'Bmxirr'], 'Xirr', 'Bmxirr', 'MTD and FYTD never taken'],
  [['YTD Xirr', 'YTD Bmxirr', 'QTD Xirr', 'QTD Bmxirr'], null, null, 'period sheets only: no rows (the upload asks for an SI Xirr sheet)'],
];
for (const [names, wf, wb, what] of CASES) {
  const c = chosen(names);
  ok(c.f === wf && c.b === wb, '2. ' + what + ': fund ' + (wf || 'none') + ', benchmark ' + (wb || 'none') + ' (got ' + c.f + ', ' + c.b + ')');
}

/* 3. the content fallback: renamed tabs are found by their headers, and a period sheet is never taken */
{ const r = parse(book([['Fund flows', SI_F], ['Benchmark flows', SI_B]]));
  ok(r.fund.length === SI_F.length - 1 && r.bench.length === SI_B.length - 1, '3. renamed tabs: found by content, as before');
  const q = parse(book([['QTD flows', QTD_F], ['QTD bm flows', QTD_B], ['Fund flows', SI_F], ['Benchmark flows', SI_B]]));
  ok(q.fund.length === SI_F.length - 1 && q.bench.length === SI_B.length - 1, '3. renamed tabs with QTD tabs first: the QTD tabs are skipped'); }

console.log(fail ? `\n${fail} check(s) FAILED` : '\nall IRR-SI checks passed');
process.exit(fail ? 1 : 0);
