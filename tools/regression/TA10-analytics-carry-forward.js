/* ============================================================================
   TA-10 (October 2026 refresh): an analytics-only build keeps the look-through of
   a scheme the monitors still list, and never carries a closed or renamed one.

   buildtools/build_refresh.js carries last month's look-through forward for a
   scheme that is missing from this month's analytics files but still listed in
   the monitor under the same key (the Aug 2026 children's and retirement funds).
   It used to do so only when the same run built a monitor, so the October 2026
   analytics, which arrived before the 31 Oct monitors, dropped 40 still-listed
   schemes (25 Hybrid, 9 Equity, 6 Debt). Without their own key, 6 of those
   names then matched a different fund (a children's fund to a Balanced
   Advantage fund) and 19 matched nothing.

   Known answers (synthetic blocks built here; fictional scheme names):
     1. Analytics-only build (no monitor built this run): a scheme absent from
        this month's file but listed in the embedded Regular monitor is carried,
        equal to last month's entry plus vintage = last month's analytics date.
     2. The same through the embedded Direct monitor.
     3. A scheme no monitor lists (closed) is not carried.
     4. Full build (the monitors built this run): the NEW monitor decides; a
        scheme only the embedded monitor lists is not carried.
     5. A renamed scheme ("Zeta Nifty 50 ETF", now "Zeta CASE Nifty 50 ETF") is
        not carried and is reported as renamed; the page's matcher then gives a
        holding under the old name the new key, and with the stale key present it
        would have taken the stale one (the reason for the rule).
     6. An entry that already carries a vintage keeps it.
     7. A key present in another analytics block this month is not carried.
     8. PMS / AIF entries (pcls) are never carried by this step.
     9. Entries built this month are never overwritten.
    10. A similar name that does not contain the old one is not taken for a rename.
        The rule's known limit (pinned here, for the review): a new fund whose
        name CONTAINS the old fund's whole name is taken for a rename, so the old
        scheme is not carried; the build prints it under "renamed, not carried"
        and the next build with monitors re-tests it.
    11. A Regular key whose only monitor listing is its Direct-plan sibling
        ("X-Reg(G)" or "X(G)" -> "X(G)-Direct Plan") is carried; one whose sibling
        is not listed, or that has no sibling form, is not. In a full build the
        sibling must be in this run's Direct monitor. (Oct 2026: 17 retirement
        funds; without it 9 of their names matched a sibling fund.)
    12. A PMS / AIF key built this month never marks a mutual-fund key renamed.
    13. A key that normalises to no token is never taken for a rename.

     node tools/regression/TA10-analytics-carry-forward.js
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');
const { carryForwardLookThroughs } = require('../../buildtools/build_refresh.js');
const { E } = load();

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const J = x => JSON.stringify(x);

const eq = (s) => ({ mcap: { 'Large Cap': 100 }, sector: { Bank: 100 }, stocks: [['Stock ' + s, 100, 'Bank']] });
const hy = (s) => ({ eq: eq(s), db: { rating: { AAA: 100 }, sector: { Bank: 100 }, issuer: { ['Issuer ' + s]: 100 }, weight: 40 } });
const db = (s) => ({ rating: { SOV: 100 }, sector: { Sovereign: 100 }, issuer: { ['Issuer ' + s]: 100 } });

function refBlocks() {
  return {
    DATA_DATES: { analytics: '30 Sep 2026', performance: '30 Sep 2026', direct: '30 Sep 2026' },
    MF_PERF: { 'Alpha Childrens Gift Fund-Reg(G)': {}, 'Zeta Nifty 50 ETF': {}, 'Beta Retirement Savings Fund-Reg(G)': {},
               'Gamma Flexi Cap Fund-Reg(G)': {}, 'Delta Equity Savings Fund-Reg(G)': {}, 'Omega Dynamic Bond Fund-Reg(G)': {},
               'Theta Gilt Fund-Reg(G)': {}, 'Rho Value AIF': {} },
    MF_PERF_DIRECT: { 'Kappa Retirement Fund(G)-Direct Plan': {} },
    EQUITY_ANALYTICS: {
      'Zeta Nifty 50 ETF': eq('z'),                                        /* renamed this month */
      'Gamma Flexi Cap Fund-Reg(G)': eq('g'),                              /* built again this month */
      'Delta Equity Savings Fund-Reg(G)': eq('d'),                         /* moves to the Hybrid file this month */
      'Sigma Wealth PMS': Object.assign(eq('p'), { pcls: 'PMS' }),         /* PMS look-through */
      'Rho Value AIF': Object.assign(eq('r'), { pcls: 'AIF' })             /* AIF look-through absent this month, its name also a monitor key */
    },
    HYBRID_ANALYTICS: {
      'Alpha Childrens Gift Fund-Reg(G)': hy('a'),                         /* dropped by the vendor, still listed */
      'Kappa Retirement Fund(G)-Direct Plan': hy('k'),                     /* listed in the Direct monitor only */
      'Beta Retirement Savings Fund-Reg(G)': Object.assign(hy('b'), { vintage: '31 Aug 2026' }), /* carried once already */
      'Closed Hybrid Fund-Reg(G)': hy('c')                                 /* no monitor lists it */
    },
    DEBT_ANALYTICS: {
      'Omega Dynamic Bond Fund-Reg(G)': db('o'),                           /* "Omega Dynamic Income" this month is a different fund */
      'Theta Gilt Fund-Reg(G)': db('t')                                    /* "Theta Gilt Plus Fund" this month contains its name */
    }
  };
}
function thisMonth() {
  return {
    EQUITY_ANALYTICS: { 'Zeta CASE Nifty 50 ETF': eq('z2'), 'Gamma Flexi Cap Fund-Reg(G)': eq('g2'),
                        'Sigma Wealth PMS': Object.assign(eq('p'), { pcls: 'PMS' }) },
    HYBRID_ANALYTICS: { 'Delta Equity Savings Fund-Reg(G)': hy('d2') },
    DEBT_ANALYTICS: { 'Omega Dynamic Income Fund-Reg(G)': db('o2'), 'Theta Gilt Plus Fund-Reg(G)': db('t2') }
  };
}

/* ---- analytics-only build: no monitor in B ---- */
const REF = refBlocks(); const B = thisMonth(); const before = J(B);
const r = carryForwardLookThroughs(B, REF, E.normalize);
const H = B.HYBRID_ANALYTICS;
ok(H['Alpha Childrens Gift Fund-Reg(G)'] && J(H['Alpha Childrens Gift Fund-Reg(G)']) === J(Object.assign({}, REF.HYBRID_ANALYTICS['Alpha Childrens Gift Fund-Reg(G)'], { vintage: '30 Sep 2026' })),
  '1. analytics-only: a still-listed scheme missing from the file is carried, equal to last month plus vintage 30 Sep 2026');
ok(H['Kappa Retirement Fund(G)-Direct Plan'] && H['Kappa Retirement Fund(G)-Direct Plan'].vintage === '30 Sep 2026',
  '2. analytics-only: a scheme listed only in the embedded Direct monitor is carried');
ok(!H['Closed Hybrid Fund-Reg(G)'], '3. a scheme no monitor lists (closed) is not carried');
ok(!B.EQUITY_ANALYTICS['Zeta Nifty 50 ETF'] && J(r.renamed.EQUITY_ANALYTICS) === J(['Zeta Nifty 50 ETF']),
  '5a. a renamed scheme (its name contained in a new key) is not carried and is reported as renamed');
ok(H['Beta Retirement Savings Fund-Reg(G)'] && H['Beta Retirement Savings Fund-Reg(G)'].vintage === '31 Aug 2026',
  '6. an entry already carried keeps its own vintage (31 Aug 2026)');
ok(!B.EQUITY_ANALYTICS['Delta Equity Savings Fund-Reg(G)'], '7. a key built this month in another analytics block is not carried');
ok(J(B.EQUITY_ANALYTICS['Sigma Wealth PMS']) === J(thisMonth().EQUITY_ANALYTICS['Sigma Wealth PMS']) && !r.carried.EQUITY_ANALYTICS.includes('Sigma Wealth PMS'),
  '8. a PMS / AIF entry (pcls) is never carried by this step');
ok(!B.EQUITY_ANALYTICS['Rho Value AIF'], '8b. not even when its name is also a monitor key and it is absent this month');
ok(J(B.EQUITY_ANALYTICS['Gamma Flexi Cap Fund-Reg(G)']) === J(eq('g2')) && J(B.HYBRID_ANALYTICS['Delta Equity Savings Fund-Reg(G)']) === J(hy('d2')),
  '9. entries built this month are never overwritten');
ok(B.DEBT_ANALYTICS['Omega Dynamic Bond Fund-Reg(G)'] && !r.renamed.DEBT_ANALYTICS.includes('Omega Dynamic Bond Fund-Reg(G)'),
  '10. a similar name that does not contain the old one ("Omega Dynamic Income") is not taken for a rename; the old scheme is carried');
ok(!B.DEBT_ANALYTICS['Theta Gilt Fund-Reg(G)'] && J(r.renamed.DEBT_ANALYTICS) === J(['Theta Gilt Fund-Reg(G)']),
  '10b. the rule\'s known limit: a new name that contains the old one ("Theta Gilt Plus") is taken for a rename and reported');
ok(J(r.carried) === J({ EQUITY_ANALYTICS: [], HYBRID_ANALYTICS: ['Alpha Childrens Gift Fund-Reg(G)', 'Kappa Retirement Fund(G)-Direct Plan', 'Beta Retirement Savings Fund-Reg(G)'],
  DEBT_ANALYTICS: ['Omega Dynamic Bond Fund-Reg(G)'] }) && r.prevDate === '30 Sep 2026',
  'the carried list per block is exactly the expected one, prevDate 30 Sep 2026');
ok(J(before) !== J(B) && Object.keys(B.EQUITY_ANALYTICS).length === 3, 'B is changed in place; the Equity block keeps its 3 entries');

/* ---- 5b: why renamed keys are excluded: the page's matcher ---- */
const pool = Object.keys(B.EQUITY_ANALYTICS).filter(k => !B.EQUITY_ANALYTICS[k].pcls);
ok(E.matchInstrument('Zeta Nifty 50 ETF', '', pool, {}) === 'Zeta CASE Nifty 50 ETF',
  '5b. a holding under the old name matches the new key when the stale key is not carried');
ok(E.matchInstrument('Zeta Nifty 50 ETF', '', pool.concat(['Zeta Nifty 50 ETF']), {}) === 'Zeta Nifty 50 ETF',
  '5c. with the stale key in the pool the same holding takes the stale key (the shadowing the rule prevents)');

/* ---- full build: the monitors built this run decide ---- */
const REF2 = refBlocks(); const B2 = thisMonth();
B2.MF_PERF = { 'Gamma Flexi Cap Fund-Reg(G)': {} };      /* the new Regular monitor no longer lists Alpha, Beta or Omega */
B2.MF_PERF_DIRECT = { 'Kappa Retirement Fund(G)-Direct Plan': {} };
const r2 = carryForwardLookThroughs(B2, REF2, E.normalize);
ok(!B2.HYBRID_ANALYTICS['Alpha Childrens Gift Fund-Reg(G)'] && !B2.DEBT_ANALYTICS['Omega Dynamic Bond Fund-Reg(G)'],
  '4. full build: a scheme only the embedded monitor lists is not carried (the new monitor decides)');
ok(J(r2.carried.HYBRID_ANALYTICS) === J(['Kappa Retirement Fund(G)-Direct Plan']),
  '4b. full build: a scheme the new Direct monitor lists is carried');

/* ---- 11: the Direct-plan sibling (Oct 2026: 17 retirement funds the monitors list only as their Direct plan) ---- */
const sibRef = () => ({
  DATA_DATES: { analytics: '30 Sep 2026' },
  MF_PERF: {},                                                             /* the Regular monitor lists none of them */
  MF_PERF_DIRECT: { 'Mu Retirement Fund(G)-Direct Plan': {}, 'Nu Pension Fund(G)-Direct Plan': {} },
  EQUITY_ANALYTICS: {}, DEBT_ANALYTICS: {},
  HYBRID_ANALYTICS: {
    'Mu Retirement Fund-Reg(G)': hy('mu'),                                 /* "X-Reg(G)": sibling "X(G)-Direct Plan" listed */
    'Nu Pension Fund(G)': hy('nu'),                                        /* "X(G)": sibling "X(G)-Direct Plan" listed */
    'Xi Retirement Fund-Reg(G)': hy('xi'),                                 /* sibling not listed */
    'Pi Retirement Fund(IDCW)': hy('pi')                                   /* no sibling form at all */
  }
});
const sibMonth = () => ({ EQUITY_ANALYTICS: {}, HYBRID_ANALYTICS: { 'Omicron Balanced Fund-Reg(G)': hy('om') }, DEBT_ANALYTICS: {} });
const R3 = sibRef(), B3 = sibMonth(); const r3 = carryForwardLookThroughs(B3, R3, E.normalize);
ok(J(B3.HYBRID_ANALYTICS['Mu Retirement Fund-Reg(G)']) === J(Object.assign({}, R3.HYBRID_ANALYTICS['Mu Retirement Fund-Reg(G)'], { vintage: '30 Sep 2026' })),
  '11a. a "-Reg(G)" key whose only monitor listing is its Direct plan is carried, with vintage 30 Sep 2026');
ok(B3.HYBRID_ANALYTICS['Nu Pension Fund(G)'] && B3.HYBRID_ANALYTICS['Nu Pension Fund(G)'].vintage === '30 Sep 2026',
  '11b. a "(G)" key whose only monitor listing is its Direct plan is carried');
ok(!B3.HYBRID_ANALYTICS['Xi Retirement Fund-Reg(G)'] && !B3.HYBRID_ANALYTICS['Pi Retirement Fund(IDCW)'],
  '11c. a key whose Direct sibling is not listed, or that has no sibling form, is not carried');
ok(J(r3.carried.HYBRID_ANALYTICS) === J(['Mu Retirement Fund-Reg(G)', 'Nu Pension Fund(G)']), '11d. the carried list is exactly Mu and Nu');
const B4 = sibMonth(); B4.MF_PERF = {}; B4.MF_PERF_DIRECT = { 'Mu Retirement Fund(G)-Direct Plan': {} };
carryForwardLookThroughs(B4, sibRef(), E.normalize);
ok(B4.HYBRID_ANALYTICS['Mu Retirement Fund-Reg(G)'] && !B4.HYBRID_ANALYTICS['Nu Pension Fund(G)'],
  '11e. full build: the sibling must be in THIS run\'s Direct monitor (Nu, listed only in the embedded one, is not carried)');

/* ---- 12 (review N1a): a PMS / AIF key built this month never marks a mutual-fund key as renamed ---- */
const B5 = { EQUITY_ANALYTICS: { 'Lambda Growth Fund AIF': Object.assign(eq('la'), { pcls: 'AIF' }) }, HYBRID_ANALYTICS: {}, DEBT_ANALYTICS: {} };
const R5 = { DATA_DATES: { analytics: '30 Sep 2026' }, MF_PERF: { 'Lambda Growth Fund-Reg(G)': {} }, MF_PERF_DIRECT: {},
  EQUITY_ANALYTICS: { 'Lambda Growth Fund-Reg(G)': eq('l') }, HYBRID_ANALYTICS: {}, DEBT_ANALYTICS: {} };
const r5 = carryForwardLookThroughs(B5, R5, E.normalize);
ok(B5.EQUITY_ANALYTICS['Lambda Growth Fund-Reg(G)'] && r5.renamed.EQUITY_ANALYTICS.length === 0,
  '12. the AIF "Lambda Growth Fund AIF" (its tokens contain the MF key\'s) does not mark "Lambda Growth Fund-Reg(G)" renamed; it is carried');

/* ---- 13 (review N1b): a key that normalises to no token is never taken for a rename ---- */
const B6 = { EQUITY_ANALYTICS: {}, HYBRID_ANALYTICS: { 'Sigma Hybrid Fund-Reg(G)': hy('sx') }, DEBT_ANALYTICS: {} };
const R6 = { DATA_DATES: { analytics: '30 Sep 2026' }, MF_PERF: { 'Growth Plan-Reg(G)': {} }, MF_PERF_DIRECT: {},
  EQUITY_ANALYTICS: {}, HYBRID_ANALYTICS: { 'Growth Plan-Reg(G)': hy('e') }, DEBT_ANALYTICS: {} };
ok(E.normalize('Growth Plan-Reg(G)').length === 0, '13a. (fixture) "Growth Plan-Reg(G)" normalises to no token');
const r6 = carryForwardLookThroughs(B6, R6, E.normalize);
ok(B6.HYBRID_ANALYTICS['Growth Plan-Reg(G)'] && r6.renamed.HYBRID_ANALYTICS.length === 0,
  '13b. a key with no token is not taken for a rename of an unrelated new key; it is carried');

/* ---- the builder calls it for an analytics-only build (source check of the guard) ---- */
const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'buildtools', 'build_refresh.js'), 'utf8');
ok(/if\(B\.EQUITY_ANALYTICS && B\.HYBRID_ANALYTICS && B\.DEBT_ANALYTICS\)\{\s*\n\s*const cf=carryForwardLookThroughs\(B, REF, E\.normalize\)/.test(src),
  'main() calls carryForwardLookThroughs whenever the three analytics blocks were built, with no monitor condition');

process.exit(fail ? 1 : 0);
