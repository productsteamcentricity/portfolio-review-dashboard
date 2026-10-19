/* ============================================================================
   KI-068 (audit NEW-22) — the Current vs Sample (CVS) tab and its slide ignored
   the rebalancing plan: renderCVS ran only from renderAll and Re-seed, never
   from renderRebal or rbRecalc, so the Sample column (and window._cvsSnapshot,
   which the slide reads) kept the plan as it stood at the last full render.

   Static checks (index.html text): renderRebal ends by refreshing the CVS tab;
   rbRecalc ends by scheduling a debounced refresh; the deck and single-slide
   exports flush a pending refresh before building; resetFamilyState drops the
   new per-family state (D-015).
   Executable checks: the CVS section is cut out of index.html by anchor
   (tools/regression/lib/cvs-harness.js: renderCVS lives in the UI script,
   11_app_ui, which Node cannot load) and run on a fake DOM against the
   synthetic sample book, with the rebalancing helpers stubbed exactly as the UI
   builds them. A plan change must reach the Sample column, the snapshot and the
   slide; cells the analyst typed must survive the refresh; repeated keystrokes
   must give one refresh; a table built for another model is not carried over.
   Known answers are computed here from the CMVs and the HYBRID_ANALYTICS
   sleeve weight, independently of the code under test.
   Synthetic data only. Exit 1 on any failure.
   ========================================================================== */
'use strict';
const H = require('../engine-host.js');
const C = require('./lib/cvs-harness.js');

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const near = (a, b, tol) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol;
const f2 = x => (typeof x === 'number' ? x.toFixed(2) : String(x));

async function main() {
  const html = C.readHtml();

  console.log('--- static: who refreshes the CVS tab ---');
  {
    const rebal = C.uiFunction(html, '  function renderRebal(){\n') || '';
    const recalc = C.uiFunction(html, '  function rbRecalc(){\n') || '';
    const fromPlan = C.uiFunction(html, '  function cvsRefreshFromPlan(){\n') || '';
    const soonAt = html.indexOf('  function cvsRefreshSoon(){'), soon = soonAt >= 0 ? html.slice(soonAt, html.indexOf('\n', soonAt)) : '';
    const flushAt = html.indexOf('  function cvsFlush(){'), flush = flushAt >= 0 ? html.slice(flushAt, html.indexOf('\n', flushAt)) : '';
    const slide = C.uiFunction(html, '  function slidePPTX(tabKey){\n') || '';
    const deck = C.uiFunction(html, "  document.getElementById('dlppt').onclick=function(){\n", '\n  };\n') || '';
    const reset = C.uiFunction(html, '  function resetFamilyState(){\n') || '';
    ok(/renderCVS\(\{fromPlan:true\}\)/.test(fromPlan), 'cvsRefreshFromPlan renders the CVS tab as a plan refresh');
    ok(/cvsRefreshFromPlan\(\);\n  \}\n$/.test(rebal), 'renderRebal ends by refreshing the CVS tab (renderCVS via cvsRefreshFromPlan)');
    ok(/setTimeout\(cvsRefreshFromPlan,/.test(soon) && /cvsCancelRefresh\(\)/.test(soon), 'cvsRefreshSoon debounces: one pending timer that calls cvsRefreshFromPlan');
    ok(/cvsRefreshSoon\(\);\n  \}\n$/.test(recalc), 'rbRecalc ends by scheduling the debounced CVS refresh');
    ok(/if\(__cvsRefreshT!=null\) cvsRefreshFromPlan\(\)/.test(flush), 'cvsFlush runs a pending refresh at once');
    ok(slide.indexOf('cvsFlush()') >= 0 && slide.indexOf('cvsFlush()') < slide.indexOf('E.buildPPTX('), 'single-slide export flushes a pending CVS refresh before building');
    ok(deck.indexOf('cvsFlush()') >= 0 && deck.indexOf('cvsFlush()') < deck.indexOf('E.buildPPTX('), 'deck export flushes a pending CVS refresh before building');
    ok(/__cvsLive=null/.test(reset) && /cvsCancelRefresh\(\)/.test(reset), 'resetFamilyState drops the live CVS table and any pending refresh (D-015)');
  }

  console.log('--- executable: the plan drives the Sample column, the snapshot and the slide ---');
  const host = H.load();
  const { E, REF } = host;
  const { model } = C.sampleModel(host);
  const cmv = n => model.holdings.filter(h => h.name === n).reduce((s, h) => s + h.cmvCr, 0);
  const MA = '360 ONE Multi Asset Allocation Fund-Reg(G)', FLEXI = '360 ONE Flexicap Fund-Reg(G)', DYN = '360 ONE Dynamic Term Fund-Reg(G)';
  const w = REF.HYBRID_ANALYTICS[MA].eq.weight / 100;
  /* bucket membership under the unchanged CVS bucket rules (the SIF falls back to Equity > MF) */
  const EQMF = ['Aditya Birla SL Large Cap Fund-Reg(G)', FLEXI, 'Sample Unknown Opportunities Fund', 'Aditya Birla SL Midcap Fund(G)',
    'Aditya Birla SL Small Cap Fund(G)', 'Altiva Equity Ex-Top 100 Long-Short Fund-Reg(G)'];
  const DBMF = [DYN, '360 ONE Liquid Fund-Reg(G)'];
  const sum = a => a.reduce((s, n) => s + cmv(n), 0);
  const expect = gone => {   /* Equity MF / Debt MF % after exiting the named holdings in full */
    const g = n => (gone.indexOf(n) >= 0 ? cmv(n) : 0);
    const tot = model.totalCMV - gone.reduce((s, n) => s + cmv(n), 0);
    return { eq: (sum(EQMF) - EQMF.reduce((s, n) => s + g(n), 0) + cmv(MA) * w) / tot * 100,
             db: (sum(DBMF) - DBMF.reduce((s, n) => s + g(n), 0) + cmv(MA) * (1 - w)) / tot * 100 };
  };
  const e0 = expect([]), e1 = expect([FLEXI]), e2 = expect([FLEXI, DYN]);

  const cv = C.loadCvs({ E, REF, model });
  cv.api.renderCVS();                                   /* what renderAll does */
  ok(near(cv.cell(1, 0, 'pa'), e0.eq, 0.011) && cv.snap().groups.every(g => g.rows.every(r => r.pa === r.ca)),
    'no plan: Sample equals Current (Equity MF ' + f2(cv.cell(1, 0, 'pa')) + ')');

  /* the analyst types into the CVS table */
  const typed = cv.dom.type(1, 1, 'propAlloc', 15.5) && cv.dom.type(1, 0, 'currRet', 13) && cv.dom.type(0, 0, 'propRet', 7.25);
  ok(typed && cv.cell(1, 1, 'pa') === 15.5 && cv.cell(1, 0, 'cr') === 13 && cv.cell(0, 0, 'pr') === 7.25,
    'precondition: typed Equity PMS Sample 15.50%, Equity MF Exp. Return 13.00%, Debt MF Sample Exp. Return 7.25%');
  const kept = () => cv.cell(1, 1, 'pa') === 15.5 && cv.cell(1, 0, 'cr') === 13 && cv.cell(0, 0, 'pr') === 7.25;

  /* rbRecalc path: exit 360 ONE Flexicap; several keystrokes, then the pause */
  cv.setPlan({ cmv: { [FLEXI]: 0 } });
  const soon = cv.api.cvsRefreshSoon, flush = cv.api.cvsFlush, now = cv.api.cvsRefreshFromPlan;
  ok(!!(soon && flush && now), 'the refresh helpers exist in the UI script');
  if (soon && flush && now) {
    const w0 = cv.dom.writes['s-cvs'];
    soon(); soon(); soon();
    ok(cv.timers.pending() === 1 && cv.dom.writes['s-cvs'] === w0, 'three keystrokes: one pending refresh, nothing re-rendered yet');
    cv.timers.run();
    ok(cv.dom.writes['s-cvs'] === w0 + 1, 'after the pause: exactly one refresh');
    ok(near(cv.cell(1, 0, 'pa'), e1.eq, 0.011) && near(cv.cell(0, 0, 'pa'), e1.db, 0.006),
      'Sample follows the plan: Equity MF ' + e1.eq.toFixed(2) + ' / Debt MF ' + e1.db.toFixed(2) + ' (got ' + f2(cv.cell(1, 0, 'pa')) + ' / ' + f2(cv.cell(0, 0, 'pa')) + ')');
    ok(near(cv.cell(1, 0, 'ca'), e0.eq, 0.011), 'Current column unchanged by the plan');
    ok(kept(), 'typed cells survive the plan refresh (15.50 / 13.00 / 7.25)');
    ok(/data-g="1" data-r="0" data-field="propAlloc" value="/.test(cv.dom.tableHtml()) &&
      cv.dom.tableHtml().indexOf('data-g="1" data-r="0" data-field="propAlloc" value="' + cv.cell(1, 0, 'pa').toFixed(2) + '"') >= 0,
      'on screen: the Sample Equity MF input shows the refreshed value');

    /* an export while a refresh is pending: the flush lands it first */
    cv.setPlan({ cmv: { [FLEXI]: 0, [DYN]: 0 } });
    soon();
    ok(near(cv.cell(1, 0, 'pa'), e1.eq, 0.011), 'precondition: refresh pending, snapshot still the previous plan');
    flush();
    ok(cv.timers.pending() === 0, 'flush cancels the pending timer (no second refresh later)');
    ok(near(cv.cell(1, 0, 'pa'), e2.eq, 0.011) && near(cv.cell(0, 0, 'pa'), e2.db, 0.006),
      'flush: Equity MF ' + e2.eq.toFixed(2) + ' / Debt MF ' + e2.db.toFixed(2) + ' (got ' + f2(cv.cell(1, 0, 'pa')) + ' / ' + f2(cv.cell(0, 0, 'pa')) + ')');
    const s = await C.cvsSlideText(host, model);
    const r = s.indexOf('Mutual Funds', s.indexOf('Equity'));
    ok(r >= 0 && s[r + 1] === cv.cell(1, 0, 'ca').toFixed(2) + '%' && s[r + 3] === cv.cell(1, 0, 'pa').toFixed(2) + '%',
      'slide: Equity MF ' + (r >= 0 ? s[r + 1] + ' -> ' + s[r + 3] : '?') + ' (the refreshed plan)');
    const p = s.indexOf('PMS', r);
    ok(p >= 0 && s[p + 3] === '15.50%', 'slide: the typed Equity PMS Sample 15.50% is kept (got ' + (p >= 0 ? s[p + 3] : '?') + ')');
    flush();
    ok(cv.dom.writes['s-cvs'] === w0 + 2, 'flush with nothing pending does nothing');

    /* renderRebal path: synchronous; the plan emptied again */
    cv.setPlan(null);
    now();
    ok(near(cv.cell(1, 0, 'pa'), e0.eq, 0.011) && cv.cell(1, 1, 'pa') === 15.5 && kept(),
      'renderRebal refresh: Sample back to the current mix, typed cells kept (Equity MF ' + f2(cv.cell(1, 0, 'pa')) + ')');

    /* a table built for another model is not carried over (recompute or another family) */
    const model2 = E.computeReview(model.holdings.map(h => Object.assign({}, h)), REF, { familyName: 'Sample Family', asOnDate: '30 Sep 2026' });
    cv.setModel(model2);
    now();
    ok(cv.cell(1, 0, 'cr') === 14 && cv.cell(0, 0, 'pr') === 6.75, 'another model: the refresh starts from the seed, nothing carried over');
  }

  console.log(fail ? '\n' + fail + ' check(s) FAILED' : '\nall checks passed');
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.log('FAIL  ' + (e && e.stack || e)); process.exit(1); });
