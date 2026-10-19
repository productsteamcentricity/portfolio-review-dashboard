/* ============================================================================
   KI-067 (audit NEW-21) — Current vs Sample split every hybrid holding by the
   portfolio's overall equity share (equityAnalytics.exposureCr / totalCMV, or
   50/50), instead of by the fund's own equity sleeve.

   Known answers (independent of the code under test: computed here from the
   HYBRID_ANALYTICS sleeve weight, the CMVs and the house return seeds 14.00% /
   6.75%, and as published in the audit):
     - 80% HDFC Large Cap + 20% ABSL Conservative Hybrid (sleeve 20.40%):
       Equity MF 84.08 / Debt MF 15.92 (shipped 96.82 / 3.18); expected return
       12.85% (shipped 13.77%)
     - 20% ABSL Conservative Hybrid + 80% HDFC Short Term: 4.08 / 95.92
     - the synthetic sample book (360 ONE Multi Asset, own sleeve 23.30%):
       Equity MF 50.85 / Debt MF 25.27 (shipped 52.43 / 23.69)
   Plus: a hybrid record with no equity sleeve is all debt; a Hybrid-tagged
   holding the engine matched to the equity universe counts its market-cap
   mix; a proposed hybrid in the Sample column is split by its own sleeve.
   Not split (rule 3), shown as "Unallocated †" with a footnote, on screen and
   on the slide, counted in the 100%:
     - a hybrid with no sleeve data;
     - a Fund-of-Funds, held or proposed: the engine never looks a FoF through,
       so the hybrid record it matches is another scheme's (review case:
       ICICI Pru Income plus Arbitrage Omni FOF -> ICICI Pru Arbitrage Fund,
       94.23 / 5.77 before; Franklin India Income Plus Arbitrage Active FoF ->
       Franklin India Arbitrage Fund, 94.28 / 5.72 before);
     - a hybrid record whose equity weight is missing (null), which used to
       count as 0 (all debt). Synthetic: no embedded record has a null weight,
       so a copy of the reference data with one is given to the CVS code.
   The Unallocated share's expected return (OD-29, option b): blank by default;
   while blank, that column's Grand Total return, inflation-adjusted return,
   3/5/10-year valuations and the difference show "—" with a footnote asking
   for the return, on screen and on the slide. A typed return is used:
   80% x 14.00% + 20% x 9.00% = 13.00% (the round-1 build counted the share at
   0%: 11.20%). Typed returns survive a plan refresh and are dropped with the
   live table (what resetFamilyState does) or for another model. The rounding
   residual never absorbs the unallocated share; names are escaped on screen.

   UI-block logic: renderCVS lives in the UI script (11_app_ui), which Node
   cannot load, so tools/regression/lib/cvs-harness.js cuts the CVS section out
   of index.html by anchor and runs it on a fake DOM with stubbed inputs (an
   engine-built model, the embedded reference data, the rebalancing helpers).
   The slide is built by the shipped exporters (tools/engine-host.js).
   Lines marked "PRE" are facts about the engine or the data that the checks
   rely on (they hold on any build); an unmet precondition is a FAIL.
   Synthetic data only. Exit 1 on any failure.
   ========================================================================== */
'use strict';
const H = require('../engine-host.js');
const C = require('./lib/cvs-harness.js');

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const pre = (c, m) => { console.log((c ? 'PRE   ' : 'FAIL  precondition: ') + m); if (!c) fail++; };
const near = (a, b, tol) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol;
const r2 = x => Math.round(x * 100) / 100;
const f2 = x => (typeof x === 'number' ? x.toFixed(2) : String(x));
const J = x => JSON.stringify(x);

async function main() {
  const host = H.load();
  const { E, REF } = host;
  const HY = REF.HYBRID_ANALYTICS;
  const CH = 'Aditya Birla SL Conservative Hybrid Fund(G)', LC = 'HDFC Large Cap Fund(G)', ST = 'HDFC Short Term Fund(G)';
  const MA = '360 ONE Multi Asset Allocation Fund-Reg(G)', SEG = 'Nippon India Conservative Hybrid Fund-Segregated Portfolio 2-(G)';
  /* an equity fund tagged "Hybrid" in a base file: no hybrid record, the engine falls back to
     its equity record (every EQUITY_ANALYTICS market-cap mix sums to 99-100%) */
  const EQF = LC;
  const UNK = 'Zzyzx Notional Balanced Hybrid Fund(G)';      /* invented: matches no reference record */
  const FOF = 'ICICI Pru Income plus Arbitrage Omni FOF(G)', FOF_HY = 'ICICI Pru Arbitrage Fund(G)';
  const PFOF = 'Franklin India Income Plus Arbitrage Active FoF(G)', PFOF_HY = 'Franklin India Arbitrage Fund-Reg(G)';
  const wCH = HY[CH].eq.weight / 100, wMA = HY[MA].eq.weight / 100;
  const EQ_RET = 14.0, DB_RET = 6.75, INFL = 6.5;   /* the house seeds of the Equity / Debt MF rows and the default inflation */

  /* render one book; returns the harness after renderCVS() */
  function render(model, plan, postOff, activeRef) {
    const cv = C.loadCvs({ E, REF, model, activeRef });
    if (plan) cv.setPlan(plan);
    if (postOff) cv.hooks.postOff = true;
    cv.api.renderCVS();
    return cv;
  }
  const un = cv => (cv.snap() && cv.snap().unalloc) || null;
  const U = cv => un(cv) || { note: '' };   /* the same, never null: a check on a build without it fails instead of throwing */
  const rowsSum = (cv, f) => cv.snap().groups.reduce((s, g) => s + g.rows.reduce((t, r) => t + r[f], 0), 0);
  const expRet = (cv, a, r) => cv.snap().groups.reduce((s, g) => s + g.rows.reduce((t, x) => t + x[a] * x[r] / 10000, 0), 0);
  const scr = (cv, label) => C.rowCells(cv.dom.tableHtml(), label);
  /* slide runs after a label (empty cells carry no text run) */
  const after = (s, label, n) => { const i = s.indexOf(label); return i < 0 ? null : s.slice(i + 1, i + 1 + n); };
  const pct = x => x.toFixed(2) + '%';
  const crS = x => '₹ ' + x.toFixed(1) + ' Cr', crP = x => 'Rs ' + x.toFixed(0) + ' Cr';
  const badge = x => (x >= 0 ? '+' : '') + x.toFixed(1) + ' Cr', dP = x => (x >= 0 ? '+' : '') + x.toFixed(0) + ' Cr';

  console.log('--- 80% HDFC Large Cap + 20% ABSL Conservative Hybrid ---');
  {
    const m = C.bookModel(host, [[LC, 'Large Cap Fund', 'Equity', 'HDFC', 8.0], [CH, 'Conservative Hybrid Fund', 'Hybrid', 'Aditya', 2.0]]);
    pre(m.holdings[1].hyKey === CH, 'the hybrid matched its own HYBRID_ANALYTICS record (sleeve ' + (wCH * 100).toFixed(2) + '%)');
    const cv = render(m);
    const eq = r2((8 + 2 * wCH) / 10 * 100), db = r2(2 * (1 - wCH) / 10 * 100);
    pre(eq === 84.08 && db === 15.92, 'independent answer agrees with the audit: 84.08 / 15.92');
    ok(near(cv.cell(1, 0, 'ca'), 84.08, 0.006), 'Current Equity MF = 84.08% (got ' + f2(cv.cell(1, 0, 'ca')) + '; shipped 96.82)');
    ok(near(cv.cell(0, 0, 'ca'), 15.92, 0.006), 'Current Debt MF = 15.92% (got ' + f2(cv.cell(0, 0, 'ca')) + '; shipped 3.18)');
    ok(near(cv.cell(1, 0, 'pa'), 84.08, 0.006) && near(cv.cell(0, 0, 'pa'), 15.92, 0.006), 'Sample column with no plan equals the current column');
    const ret = expRet(cv, 'ca', 'cr') * 100;
    ok(near(ret, 12.85, 0.005), 'expected return at the house assumptions = 12.85% (got ' + ret.toFixed(2) + '%; shipped 13.77%)');
    ok(!un(cv), 'nothing unallocated when every hybrid has a sleeve');
  }

  console.log('--- 20% ABSL Conservative Hybrid + 80% HDFC Short Term ---');
  {
    const m = C.bookModel(host, [[CH, 'Conservative Hybrid Fund', 'Hybrid', 'Aditya', 2.0], [ST, 'Short Duration Fund', 'Debt', 'HDFC', 8.0]]);
    const cv = render(m);
    ok(near(cv.cell(1, 0, 'ca'), r2(2 * wCH / 10 * 100), 0.006) && near(cv.cell(1, 0, 'ca'), 4.08, 0.006),
      'Equity MF = 4.08% (got ' + f2(cv.cell(1, 0, 'ca')) + '; shipped 0.82)');
    ok(near(cv.cell(0, 0, 'ca'), 95.92, 0.006), 'Debt MF = 95.92% (got ' + f2(cv.cell(0, 0, 'ca')) + '; shipped 99.18)');
  }

  console.log('--- synthetic sample book (tools/make-sample-base.js) ---');
  {
    const { model } = C.sampleModel(host);
    const cmv = n => model.holdings.filter(h => h.name === n).reduce((s, h) => s + h.cmvCr, 0);
    /* bucket membership under the unchanged CVS bucket rules: the SIF falls back to Equity > MF */
    const EQMF = ['Aditya Birla SL Large Cap Fund-Reg(G)', '360 ONE Flexicap Fund-Reg(G)', 'Sample Unknown Opportunities Fund',
      'Aditya Birla SL Midcap Fund(G)', 'Aditya Birla SL Small Cap Fund(G)', 'Altiva Equity Ex-Top 100 Long-Short Fund-Reg(G)'];
    const DBMF = ['360 ONE Dynamic Term Fund-Reg(G)', '360 ONE Liquid Fund-Reg(G)'];
    const tot = model.totalCMV, sum = a => a.reduce((s, n) => s + cmv(n), 0);
    const eq = (sum(EQMF) + cmv(MA) * wMA) / tot * 100, db = (sum(DBMF) + cmv(MA) * (1 - wMA)) / tot * 100;
    const cv = render(model);
    ok(near(cv.cell(1, 0, 'ca'), eq, 0.011) && near(cv.cell(1, 0, 'ca'), 50.85, 0.006),
      'Equity MF = 50.85% (independent ' + eq.toFixed(2) + '; got ' + f2(cv.cell(1, 0, 'ca')) + '; shipped 52.43)');
    ok(near(cv.cell(0, 0, 'ca'), db, 0.006) && near(cv.cell(0, 0, 'ca'), 25.27, 0.006),
      'Debt MF = 25.27% (independent ' + db.toFixed(2) + '; got ' + f2(cv.cell(0, 0, 'ca')) + '; shipped 23.69)');
    ok(near(rowsSum(cv, 'ca'), 100, 0.005), 'current rows sum to 100.00%');
  }

  console.log('--- a hybrid record with no equity sleeve is all debt ---');
  {
    const m = C.bookModel(host, [[LC, 'Large Cap Fund', 'Equity', 'HDFC', 1.0], [SEG, 'Conservative Hybrid Fund', 'Hybrid', 'Nippon', 1.0]]);
    pre(m.holdings[1].hyKey === SEG && !HY[SEG].eq && !!HY[SEG].db, 'matched a HYBRID_ANALYTICS record with only a debt sleeve');
    const cv = render(m);
    ok(near(cv.cell(1, 0, 'ca'), 50, 0.006) && near(cv.cell(0, 0, 'ca'), 50, 0.006),
      'Equity MF 50.00 / Debt MF 50.00 (got ' + f2(cv.cell(1, 0, 'ca')) + ' / ' + f2(cv.cell(0, 0, 'ca')) + ')');
  }

  console.log('--- a Hybrid-tagged holding the engine matched to the equity universe ---');
  {
    const m = C.bookModel(host, [[EQF, 'Large Cap Fund', 'Hybrid', 'HDFC', 1.0], [ST, 'Short Duration Fund', 'Debt', 'HDFC', 1.0]]);
    pre(!m.holdings[0].hyKey && m.holdings[0].eqKey === EQF, 'no hybrid record, equity record ' + EQF);
    const s = Object.values(REF.EQUITY_ANALYTICS[EQF].mcap).reduce((a, v) => a + v, 0) / 100;
    const cv = render(m);
    ok(near(cv.cell(1, 0, 'ca'), r2(Math.min(1, s) / 2 * 100), 0.011),
      'Equity MF = its market-cap mix share ' + (Math.min(1, s) / 2 * 100).toFixed(2) + '% (got ' + f2(cv.cell(1, 0, 'ca')) + '; shipped 25.00)');
  }

  console.log('--- a proposed hybrid in the Sample column ---');
  {
    const m = C.bookModel(host, [[LC, 'Large Cap Fund', 'Equity', 'HDFC', 10.0]]);
    const plan = { cmv: { [LC]: 8.0 }, proposed: [{ name: CH, asset: 'Hybrid', cmvCr: 2.0 }] };
    const cv = render(m, plan);
    const pm = cv.hooks.post(), ph = pm.holdings.find(h => h.client === 'Proposed');
    pre(ph && ph.hyKey === CH, 'the engine matches the proposed fund by name (' + (ph && ph.hyKey) + ')');
    ok(near(cv.cell(1, 0, 'ca'), 100, 0.006), 'Current Equity MF = 100.00%');
    ok(near(cv.cell(1, 0, 'pa'), 84.08, 0.006) && near(cv.cell(0, 0, 'pa'), 15.92, 0.006),
      'Sample Equity MF 84.08 / Debt MF 15.92 (got ' + f2(cv.cell(1, 0, 'pa')) + ' / ' + f2(cv.cell(0, 0, 'pa')) + ')');
    const cv2 = render(m, plan, true);
    ok(near(cv2.cell(1, 0, 'pa'), 80, 0.006) && near(cv2.cell(0, 0, 'pa'), 0, 0.006) && un(cv2) && near(un(cv2).pa, 20, 0.006),
      'without the post-rebalancing model the unmatched proposed hybrid stays Unallocated (20.00%), not split');
  }

  console.log('--- a held Fund-of-Funds is not looked through: Unallocated (review case 1) ---');
  {
    const m = C.bookModel(host, [[LC, 'Large Cap Fund', 'Equity', 'HDFC', 8.0], [FOF, 'FoF Domestic', 'Hybrid', 'ICICI', 2.0]]);
    const h = m.holdings[1];
    pre(h.hyKey === FOF_HY && !!HY[FOF_HY] && HY[FOF_HY].eq && HY[FOF_HY].eq.weight > 0,
      'the engine matched the FoF to another scheme\'s hybrid record, ' + FOF_HY + ' (sleeve ' + (HY[FOF_HY] && HY[FOF_HY].eq ? HY[FOF_HY].eq.weight.toFixed(2) : '?') + '%; got ' + h.hyKey + ')');
    const cv = render(m), u = un(cv);
    ok(near(cv.cell(1, 0, 'ca'), 80, 0.006) && near(cv.cell(0, 0, 'ca'), 0, 0.006) && u && near(u.ca, 20, 0.006),
      'Current Equity MF 80.00 / Debt MF 0.00 / Unallocated 20.00 (got ' + f2(cv.cell(1, 0, 'ca')) + ' / ' + f2(cv.cell(0, 0, 'ca')) + ' / ' + f2(u && u.ca) + '; 94.23 / 5.77 before the review)');
    ok(near(cv.cell(1, 0, 'pa'), 80, 0.006) && near(cv.cell(0, 0, 'pa'), 0, 0.006) && u && near(u.pa, 20, 0.006),
      'Sample (no plan) the same: 80.00 / 0.00 / Unallocated 20.00');
    ok(u && u.note.indexOf(FOF) >= 0 && /\(Fund-of-Funds are not looked through\)/.test(u.note),
      'footnote names the FoF and says Fund-of-Funds are not looked through');
    ok(scr(cv, 'Unallocated †').length === 1 && cv.dom.tableHtml().indexOf(FOF) >= 0, 'on screen: the Unallocated row and the FoF in the footnote');
  }

  console.log('--- a proposed Fund-of-Funds: Unallocated in the Sample column (review case 2) ---');
  {
    const m = C.bookModel(host, [[LC, 'Large Cap Fund', 'Equity', 'HDFC', 10.0]]);
    const plan = { cmv: { [LC]: 8.0 }, proposed: [{ name: PFOF, asset: 'Hybrid', cmvCr: 2.0 }] };
    const cv = render(m, plan), u = un(cv);
    const ph = cv.hooks.post().holdings.find(x => x.client === 'Proposed');
    pre(ph && ph.hyKey === PFOF_HY, 'the engine matches the proposed FoF by name to another scheme\'s hybrid record, ' + PFOF_HY + ' (got ' + (ph && ph.hyKey) + ')');
    ok(u && near(u.pa, 20, 0.006) && near(u.ca, 0, 0.006),
      'Sample Unallocated 20.00, Current 0.00 (got ' + J(u && { ca: u.ca, pa: u.pa }) + ')');
    ok(near(cv.cell(1, 0, 'pa'), 80, 0.006) && near(cv.cell(0, 0, 'pa'), 0, 0.006),
      'Sample Equity MF 80.00 / Debt MF 0.00 (got ' + f2(cv.cell(1, 0, 'pa')) + ' / ' + f2(cv.cell(0, 0, 'pa')) + '; 94.28 / 5.72 before the review)');
    const g = scr(cv, 'Grand Total')[0];
    ok(!!g && g[2] === pct(EQ_RET) && g[4] === '—',
      'Grand Total: current ' + pct(EQ_RET) + ' (nothing unallocated there), sample — (got ' + J(g) + ')');
  }

  console.log('--- a hybrid record with a missing (null) equity weight is unknown, not all debt (synthetic record) ---');
  {
    const m = C.bookModel(host, [[LC, 'Large Cap Fund', 'Equity', 'HDFC', 8.0], [CH, 'Conservative Hybrid Fund', 'Hybrid', 'Aditya', 2.0]]);
    const ref2 = Object.assign({}, REF, { HYBRID_ANALYTICS: Object.assign({}, HY, {
      [CH]: Object.assign({}, HY[CH], { eq: Object.assign({}, HY[CH].eq, { weight: null }) }) }) });
    pre(m.holdings[1].hyKey === CH && ref2.HYBRID_ANALYTICS[CH].eq.weight === null && HY[CH].eq.weight > 0,
      'the CVS code reads a copy of the reference data where ' + CH + ' has eq.weight null (the embedded record is untouched)');
    const cv = render(m, null, false, ref2), u = un(cv);
    ok(near(cv.cell(1, 0, 'ca'), 80, 0.006) && near(cv.cell(0, 0, 'ca'), 0, 0.006) && u && near(u.ca, 20, 0.006),
      'Equity MF 80.00 / Debt MF 0.00 / Unallocated 20.00 (got ' + f2(cv.cell(1, 0, 'ca')) + ' / ' + f2(cv.cell(0, 0, 'ca')) + ' / ' + f2(u && u.ca) + '; round 1: 80.00 / 20.00, all debt)');
  }

  console.log('--- a hybrid with no sleeve data: Unallocated, its return blank until entered (OD-29) ---');
  {
    const m = C.bookModel(host, [[LC, 'Large Cap Fund', 'Equity', 'HDFC', 8.0], [UNK, 'Balanced Advantage Fund', 'Hybrid', 'Zzyzx', 2.0]]);
    pre(!m.holdings[1].hyKey && !m.holdings[1].eqKey, 'the invented hybrid matches no reference record');
    const cv = render(m), u = un(cv);
    ok(near(cv.cell(1, 0, 'ca'), 80, 0.006) && near(cv.cell(0, 0, 'ca'), 0, 0.006),
      'Equity MF 80.00 / Debt MF 0.00: the unknown hybrid is not split (got ' + f2(cv.cell(1, 0, 'ca')) + ' / ' + f2(cv.cell(0, 0, 'ca')) + ')');
    ok(u && near(u.ca, 20, 0.006) && near(u.pa, 20, 0.006), 'snapshot carries Unallocated 20.00% / 20.00% (got ' + J(u && { ca: u.ca, pa: u.pa }) + ')');
    ok(near(rowsSum(cv, 'ca') + (u ? u.ca : 0), 100, 0.005), 'rows + Unallocated = 100.00%');
    ok(u && /Zzyzx Notional Balanced Hybrid Fund\(G\)/.test(u.note) && /20\.00% of the current portfolio/.test(u.note) && /\b1 hybrid holding\b/.test(u.note),
      'footnote names the holding, its share and the count');
    ok(u && /The sample's Unallocated share follows the rebalancing plan/.test(u.note), 'footnote says the sample\'s Unallocated share follows the plan');
    const t = cv.dom.tableHtml();
    ok(t.indexOf('<td>Unallocated †</td>') >= 0, 'on screen: an "Unallocated †" row');
    ok(/Grand Total<\/td><td[^>]*>100\.00%<\/td>/.test(t), 'on screen: Grand Total allocation 100.00% (no warning)');
    ok(t.indexOf('Zzyzx Notional Balanced Hybrid Fund(G)') >= 0 && /has no equity \/ debt sleeve/.test(t), 'on screen: the footnote under the table');

    /* blank by default: no return assumed, the totals are "—" */
    const NEED = 'Enter an expected return for the unallocated share to see the totals';
    ok(u && u.cr === null && u.pr === null, 'snapshot: the Unallocated returns are blank (null) by default (got ' + J(u && { cr: u.cr, pr: u.pr }) + ')');
    const ui = cv.dom.unInputs();
    ok(ui.cr === '' && ui.pr === '', 'on screen: the Unallocated row has blank, editable Exp. Return cells, current and sample (got ' + J(ui) + ')');
    const gt0 = scr(cv, 'Grand Total')[0];
    ok(!!gt0 && gt0[1] === '100.00%' && gt0[2] === '—' && gt0[3] === '100.00%' && gt0[4] === '—',
      'on screen: Grand Total 100.00% / — / 100.00% / — (got ' + J(gt0) + '; round 1: 11.20%, the share at 0%)');
    const ia0 = scr(cv, 'Inflation-Adjusted Return (@ ' + INFL.toFixed(1) + '% inflation)')[0];
    ok(!!ia0 && ia0[1] === '—' && ia0[2] === '—', 'on screen: inflation-adjusted return — / — (got ' + J(ia0) + ')');
    const vals0 = [3, 5, 10].map(y => scr(cv, 'Valuation After ' + y + 'Y — Nominal')[0]).concat(scr(cv, 'Real (inflation-adjusted)'));
    ok(vals0.length === 6 && vals0.every(r => r && r[1] === '—' && r[2] === '—'), 'on screen: 3/5/10-year valuations, nominal and real, — / —');
    const df0 = scr(cv, 'Difference (Sample vs Current)');
    ok(df0.length === 3 && df0.every(r => r[1] === '—'), 'on screen: the Sample-vs-Current differences —');
    ok(u && u.note.indexOf(NEED) >= 0 && t.indexOf(NEED) >= 0, 'footnote (snapshot and screen): "' + NEED + '"');
    let s = await C.cvsSlideText(host, m);
    let r = after(s, 'Unallocated †', 5);
    ok(!!r && r[0] === '20.00%' && r[1] === '—' && r[2] === '20.00%' && r[3] === '—' && r[4] === '+0.00%',
      'slide: Unallocated row 20.00% / — / 20.00% / — / +0.00% (got ' + J(r) + ')');
    let g = after(s, 'Grand Total', 4);
    ok(!!g && g[0] === '100.00%' && g[1] === '—' && g[2] === '100.00%' && g[3] === '—',
      'slide: Grand Total 100.00% / — / 100.00% / — (got ' + J(g) + '; round 1: 11.20%)');
    let v = [3, 5, 10].map(y => after(s, 'Valuation After ' + y + 'Y', 3));
    ok(v.every(x => x && x[0] === '—' && x[1] === '—' && x[2] === '—'), 'slide: valuations and differences — (got ' + J(v) + ')');
    ok(s.some(x => /Unallocated: 1 hybrid holding \(Zzyzx Notional Balanced Hybrid Fund\(G\)\)/.test(x) && x.indexOf(NEED) >= 0), 'slide: the footnote, asking for the return');

    /* the analyst enters the current column's return: 9.00% */
    const cur = (EQ_RET * 80 + 9 * 20) / 100;                         /* 13.00 */
    const curAdj = ((1 + cur / 100) / (1 + INFL / 100) - 1) * 100;    /* 6.10 */
    ok(cv.dom.typeUn('cr', 9) && U(cv).cr === 9, 'typed 9.00 into the current Unallocated Exp. Return cell');
    const gt1 = scr(cv, 'Grand Total')[0];
    ok(!!gt1 && gt1[2] === pct(cur) && gt1[4] === '—',
      'on screen: Grand Total current ' + pct(cur) + ' (80% x 14.00% + 20% x 9.00%), sample still — (got ' + J(gt1) + ')');
    const ia1 = scr(cv, 'Inflation-Adjusted Return (@ ' + INFL.toFixed(1) + '% inflation)')[0];
    ok(!!ia1 && ia1[1] === pct(curAdj) && ia1[2] === '—', 'on screen: inflation-adjusted current ' + pct(curAdj) + ', sample — (got ' + J(ia1) + ')');
    const v1 = [3, 5, 10].map(y => scr(cv, 'Valuation After ' + y + 'Y — Nominal')[0]);
    const want1 = [3, 5, 10].map(y => crS(10 * Math.pow(1 + cur / 100, y)));
    ok(v1.every((x, i) => x && x[1] === want1[i] && x[2] === '—'), 'on screen: current valuations ' + J(want1) + ' on 10 Cr, sample — (got ' + J(v1.map(x => x && x.slice(1))) + ')');
    ok(scr(cv, 'Difference (Sample vs Current)').every(x => x[1] === '—'), 'on screen: differences still — (the sample return is blank)');
    ok(/Expected return entered for it: 9\.00% \(current\)\./.test(U(cv).note) && U(cv).note.indexOf(NEED) >= 0,
      'footnote: the entered 9.00% (current), and still asks for the sample return');
    s = await C.cvsSlideText(host, m);
    r = after(s, 'Unallocated †', 5); g = after(s, 'Grand Total', 4); v = [3, 5, 10].map(y => after(s, 'Valuation After ' + y + 'Y', 3));
    ok(!!r && r[1] === '9.00%' && r[3] === '—' && !!g && g[1] === pct(cur) && g[3] === '—',
      'slide: Unallocated 9.00% / —, Grand Total ' + pct(cur) + ' / — (got ' + J(r) + ' ' + J(g) + ')');
    ok(v.every((x, i) => x && x[0] === crP(10 * Math.pow(1 + cur / 100, [3, 5, 10][i])) && x[1] === '—' && x[2] === '—'),
      'slide: current valuations ' + J([3, 5, 10].map(y => crP(10 * Math.pow(1 + cur / 100, y)))) + ', sample and difference — (got ' + J(v) + ')');

    /* and the sample column's: 7.00% */
    const smp = (EQ_RET * 80 + 7 * 20) / 100;                         /* 12.60 */
    ok(cv.dom.typeUn('pr', 7) && U(cv).pr === 7, 'typed 7.00 into the sample Unallocated Exp. Return cell');
    const gt2 = scr(cv, 'Grand Total')[0];
    ok(!!gt2 && gt2[2] === pct(cur) && gt2[4] === pct(smp), 'on screen: Grand Total ' + pct(cur) + ' / ' + pct(smp) + ' (got ' + J(gt2) + ')');
    const df2 = scr(cv, 'Difference (Sample vs Current)'), want2 = [3, 5, 10].map(y => badge(10 * Math.pow(1 + smp / 100, y) - 10 * Math.pow(1 + cur / 100, y)));
    ok(df2.length === 3 && df2.every((x, i) => x[1] === want2[i]), 'on screen: differences ' + J(want2) + ' (got ' + J(df2.map(x => x[1])) + ')');
    ok(U(cv).note.indexOf(NEED) < 0 && /Expected return entered for it: 9\.00% \(current\), 7\.00% \(sample\)\./.test(U(cv).note),
      'footnote: both entered returns, no longer asks');
    s = await C.cvsSlideText(host, m);
    g = after(s, 'Grand Total', 4); v = after(s, 'Valuation After 10Y', 3);
    const cn10 = 10 * Math.pow(1 + cur / 100, 10), pn10 = 10 * Math.pow(1 + smp / 100, 10);
    ok(!!g && g[1] === pct(cur) && g[3] === pct(smp) && !!v && v[0] === crP(cn10) && v[1] === crP(pn10) && v[2] === dP(pn10 - cn10),
      'slide: Grand Total ' + pct(cur) + ' / ' + pct(smp) + ', 10Y ' + crP(cn10) + ' / ' + crP(pn10) + ' / ' + dP(pn10 - cn10) + ' (got ' + J(g) + ' ' + J(v) + ')');

    /* kept like the other CVS cells */
    ok(cv.dom.type(1, 0, 'currRet', 14) && U(cv).cr === 9 && U(cv).pr === 7, 'kept when another cell is edited');
    const live = cv.api.cvsRefreshFromPlan;
    ok(!!live && (live(), true) && U(cv).cr === 9 && U(cv).pr === 7 && J(cv.dom.unInputs()) === J({ cr: '9.00', pr: '7.00' }),
      'kept across a plan refresh (snapshot and inputs 9.00 / 7.00)');
    ok(cv.dom.typeUn('cr', '') && U(cv).cr === null && (scr(cv, 'Grand Total')[0] || [])[2] === '—', 'clearing the cell makes the current return unknown again (—)');
    cv.dom.typeUn('cr', 9);
    cv.api.dropLive(); live && live();
    ok(U(cv).cr === null && U(cv).pr === null,
      'dropped with the live table (resetFamilyState sets __cvsLive=null): blank again');
    cv.dom.typeUn('cr', 9);
    const m2 = E.computeReview(m.holdings.map(x => Object.assign({}, x)), REF, { familyName: 'Synthetic Family', asOnDate: '30 Sep 2026' });
    cv.setModel(m2); live && live();
    ok(U(cv).cr === null, 'another model: not carried over, blank');
  }

  console.log('--- the rounding residual does not absorb the unallocated share ---');
  {
    const m = C.bookModel(host, [[LC, 'Large Cap Fund', 'Equity', 'HDFC', 1.0], [ST, 'Short Duration Fund', 'Debt', 'HDFC', 1.0],
      [UNK, 'Balanced Advantage Fund', 'Hybrid', 'Zzyzx', 0.006]]);
    const cv = render(m), u = un(cv);
    ok(near(cv.cell(1, 0, 'ca'), 49.85, 0.0001) && near(cv.cell(0, 0, 'ca'), 49.85, 0.0001) && u && near(u.ca, 0.3, 0.0001),
      'Equity MF 49.85 / Debt MF 49.85 / Unallocated 0.30 (got ' + f2(cv.cell(1, 0, 'ca')) + ' / ' + f2(cv.cell(0, 0, 'ca')) + ' / ' + f2(u && u.ca) + ')');
  }

  console.log('--- names in the footnote are escaped on screen ---');
  {
    const m = C.bookModel(host, [[LC, 'Large Cap Fund', 'Equity', 'HDFC', 1.0], ['Zzyzx R&D <Balanced> Hybrid Fund', 'Balanced Advantage Fund', 'Hybrid', 'Zzyzx', 1.0]]);
    const t = render(m).dom.tableHtml();
    ok(t.indexOf('Zzyzx R&amp;D &lt;Balanced&gt; Hybrid Fund') >= 0 && t.indexOf('<Balanced>') < 0, 'a "<" or "&" in a fund name is shown as text');
  }

  console.log(fail ? '\n' + fail + ' check(s) FAILED' : '\nall checks passed');
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.log('FAIL  ' + (e && e.stack || e)); process.exit(1); });
