/* ============================================================================
   CR-0010 A2: four holding names match only their own exact (normalised) name.
   Measured over every universe (MF_PERF, MF_PERF_DIRECT, EQUITY / HYBRID /
   DEBT_ANALYTICS, SIF_PERF, AIF_PERF; 4,034 names, 28,238 matches): exactly 38
   matches change, all from another fund to none, all spellings of these four
   names; nothing else changes. Before the fix:
     - Motilal Oswal Nasdaq 100 ETF took the Motilal Oswal Nifty 100 ETF's
       look-through and the Nasdaq 100 FOF's Direct-plan returns;
     - Aditya Birla SL Global Emerging Opp Fund took Special Opportunities'
       look-through (Arbitrage Fund's when tagged Hybrid, Gilt Fund's when Debt);
     - Aditya Birla SL Retirement Fund-40 / -30 took Retirement Fund-50's
       Regular returns, and the Conglomerate Fund's look-through when tagged
       Equity.
   Blocking only the named wrong fund was measured and rejected: the next fuzzy
   candidate was also wrong (Nifty Midcap 100 ETF, Conglomerate, Aggressive
   Hybrid, a CRISIL IBX index fund, Large Cap). A "" alias was rejected: it would
   also wipe the correct exact matches checked below.

   Checks (E.matchInstrument against the embedded universes, name-only as the UI
   calls it, and with the AMC as the engine's performance call passes it; then a
   synthetic client through computeReview):
     1. Nasdaq 100 ETF: own Regular returns; no Direct; no equity look-through.
     2. Global Emerging Opp: own Regular and Direct returns; no equity, hybrid or
        debt look-through.
     3. Retirement-40 and -30: own hybrid look-through, own Direct returns; no
        Regular returns; no equity or debt look-through.
     4. Covered spellings (same normalised key): NASDAQ, Nasdaq-100, "- GROWTH",
        "Sun Life ... Opportunities Fund - Regular Plan - Growth", "Retirement
        Fund - 30 - Regular - Growth".
     5. Controls, unchanged: Retirement-50 (own returns and look-through), the
        Nifty 100 ETF and Special Opp (own look-through and returns), the
        Nasdaq 100 FOF (own returns), the existing "" alias (Kotak), and a fuzzy
        match that must still work (a base-file spelling of a monitor name).
     6. The AMC's "The 40s Plan" spelling is listed and matches nothing (it
        took Fund-50's returns and Fund-30's look-through). Known limits,
        pinned: "The 30s Plan" is not listed (its fuzzy look-through is Fund-30's
        own, right) and keeps Fund-50's returns until a follow-up ALIASES pin;
        "ABSL ..." and "Exchange Traded Fund" spellings match nothing anyway.
     7. Engine: a synthetic client's holdings get the keys above; Retirement-40
        keeps its own Direct row (the engine looks up Direct only after a
        Regular match; a guarded branch allows an EXACT_ONLY fund's exact
        Direct name), and is not reported unmatched; a holding outside
        EXACT_ONLY with no Regular row still gets no Direct row.
     node tools/regression/CR0010-a2-scoped-blocks.js
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');
const { E, REF } = load();
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const U = {}; ['MF_PERF', 'MF_PERF_DIRECT', 'EQUITY_ANALYTICS', 'HYBRID_ANALYTICS', 'DEBT_ANALYTICS'].forEach(b => { U[b] = Object.keys(REF[b] || {}); });
const M = (name, b, amc) => E.matchInstrument(name, amc || '', U[b], {});
const eqv = (name, b, want, amc) => { const got = M(name, b, amc); ok(got === want, name + ' | ' + b + (amc ? ' (AMC ' + amc + ')' : '') + ' -> ' + JSON.stringify(want) + ' (got ' + JSON.stringify(got) + ')'); };

const NQ = 'Motilal Oswal Nasdaq 100 ETF', GEO = 'Aditya Birla SL Global Emerging Opp Fund(G)';
const R40 = 'Aditya Birla SL Retirement Fund-40-Reg(G)', R30 = 'Aditya Birla SL Retirement Fund-30-Reg(G)';

/* 1 */
eqv(NQ, 'MF_PERF', 'Motilal Oswal Nasdaq 100 ETF'); eqv(NQ, 'MF_PERF', 'Motilal Oswal Nasdaq 100 ETF', 'Motilal Oswal');
eqv(NQ, 'MF_PERF_DIRECT', null); eqv(NQ, 'EQUITY_ANALYTICS', null); eqv(NQ, 'EQUITY_ANALYTICS', null, 'Motilal Oswal');
/* 2 */
eqv(GEO, 'MF_PERF', 'Aditya Birla SL Global Emerging Opp Fund(G)'); eqv(GEO, 'MF_PERF_DIRECT', 'Aditya Birla SL Global Emerging Opp Fund(G)-Direct Plan');
eqv(GEO, 'EQUITY_ANALYTICS', null); eqv(GEO, 'EQUITY_ANALYTICS', null, 'Aditya Birla Sun Life'); eqv(GEO, 'HYBRID_ANALYTICS', null); eqv(GEO, 'DEBT_ANALYTICS', null);
/* 3 */
[[R40, '40'], [R30, '30']].forEach(([n, x]) => {
  eqv(n, 'HYBRID_ANALYTICS', 'Aditya Birla SL Retirement Fund-' + x + '-Reg(G)'); eqv(n, 'HYBRID_ANALYTICS', 'Aditya Birla SL Retirement Fund-' + x + '-Reg(G)', 'Aditya Birla Sun Life');
  eqv(n, 'MF_PERF_DIRECT', 'Aditya Birla SL Retirement Fund-' + x + '(G)-Direct Plan');
  eqv(n, 'MF_PERF', null); eqv(n, 'MF_PERF', null, 'Aditya Birla Sun Life');
  eqv(n, 'EQUITY_ANALYTICS', null); eqv(n, 'DEBT_ANALYTICS', null);
});
/* 4 */
['Motilal Oswal NASDAQ 100 ETF', 'Motilal Oswal Nasdaq-100 ETF', 'MOTILAL OSWAL NASDAQ 100 ETF - GROWTH'].forEach(n => { eqv(n, 'EQUITY_ANALYTICS', null); eqv(n, 'MF_PERF', 'Motilal Oswal Nasdaq 100 ETF'); });
['Aditya Birla Sun Life Global Emerging Opportunities Fund', 'Aditya Birla Sun Life Global Emerging Opportunities Fund - Regular Plan - Growth'].forEach(n => { eqv(n, 'EQUITY_ANALYTICS', null); eqv(n, 'MF_PERF', 'Aditya Birla SL Global Emerging Opp Fund(G)'); });
eqv('Aditya Birla Sun Life Retirement Fund - 30 - Regular - Growth', 'MF_PERF', null);
eqv('Aditya Birla Sun Life Retirement Fund - 30 - Regular - Growth', 'HYBRID_ANALYTICS', 'Aditya Birla SL Retirement Fund-30-Reg(G)');
/* 5 */
eqv('Aditya Birla SL Retirement Fund-50-Reg(G)', 'MF_PERF', 'Aditya Birla SL Retirement Fund-50-Reg(G)');
eqv('Aditya Birla SL Retirement Fund-50-Reg(G)', 'HYBRID_ANALYTICS', 'Aditya Birla SL Retirement Fund-50-Reg(G)');
eqv('Motilal Oswal Nifty 100 ETF', 'EQUITY_ANALYTICS', 'Motilal Oswal Nifty 100 ETF'); eqv('Motilal Oswal Nifty 100 ETF', 'MF_PERF', 'Motilal Oswal Nifty 100 ETF');
eqv('Aditya Birla SL Special Opp Fund-Reg(G)', 'EQUITY_ANALYTICS', 'Aditya Birla SL Special Opp Fund-Reg(G)');
eqv('Aditya Birla SL Special Opp Fund-Reg(G)', 'MF_PERF_DIRECT', 'Aditya Birla SL Special Opp Fund(G)-Direct Plan');
eqv('Motilal Oswal Nasdaq 100 FOF-Reg(G)', 'MF_PERF', 'Motilal Oswal Nasdaq 100 FOF-Reg(G)');
eqv('Motilal Oswal Nasdaq 100 FOF-Reg(G)', 'MF_PERF_DIRECT', 'Motilal Oswal Nasdaq 100 FOF(G)-Direct Plan');
eqv('Kotak Global Innovation Overseas Equity Omni FOF', 'MF_PERF', null);
eqv('HDFC Flexi Cap Fund - Regular Plan - Growth', 'MF_PERF', 'HDFC Flexi Cap Fund(G)');
eqv('HDFC Flexi Cap Fund - Regular Plan - Growth', 'EQUITY_ANALYTICS', 'HDFC Flexi Cap Fund(G)');
/* 6: the AMC's "The 40s Plan" spelling is listed (every fuzzy match was another fund); "The 30s Plan" is NOT, because
   its fuzzy look-through is Fund-30's own (right), so it keeps Fund-50's returns (wrong) until an ALIASES pin maps it. */
const L40 = 'Aditya Birla Sun Life Retirement Fund - The 40s Plan - Regular Plan - Growth';
['MF_PERF', 'MF_PERF_DIRECT', 'EQUITY_ANALYTICS', 'HYBRID_ANALYTICS', 'DEBT_ANALYTICS'].forEach(b => eqv(L40, b, null));
const L30 = 'Aditya Birla Sun Life Retirement Fund-The 30s Plan-Regular Growth';
eqv(L30, 'HYBRID_ANALYTICS', 'Aditya Birla SL Retirement Fund-30-Reg(G)');
eqv(L30, 'MF_PERF', 'Aditya Birla SL Retirement Fund-50-Reg(G)');   /* known limit: a follow-up pin */
eqv('ABSL Retirement Fund - 40 - Regular - Growth', 'MF_PERF', null);   /* matches nothing, before and after */
eqv('Motilal Oswal Nasdaq 100 Exchange Traded Fund', 'EQUITY_ANALYTICS', null);
/* 7 */
const H = ['Client Name', 'Instrument Name', 'Category', 'Asset Name', 'AMC', 'Product', 'Invested Value (Cr)', 'Market Value (Cr)'];
const rows = E.parseBaseRows([H,
  ['Test Client', NQ, 'Index Funds', 'Equity', 'Motilal Oswal', 'Mutual Fund', 1, 1.3],
  ['Test Client', GEO, '', 'Equity', 'Aditya Birla Sun Life', 'Mutual Fund', 1, 1.05],
  ['Test Client', R40, 'Retirement Fund', 'Hybrid', 'Aditya Birla Sun Life', 'Mutual Fund', 1, 1.1],
  ['Test Client', 'HDFC Flexi Cap Fund(G)', 'Flexi Cap', 'Equity', 'HDFC', 'Mutual Fund', 2, 2.5]]);
const m = E.computeReview(rows, REF, { familyName: 'Test', asOnDate: '22 Nov 2026' });
const by = {}; rows.forEach(h => { by[h.name] = h; });
ok(by[NQ].eqKey === null && by[NQ].perfKey === NQ && !by[NQ].perfKeyDirect, '7. engine: Nasdaq 100 ETF has its own returns, no Direct, no look-through');
ok(by[GEO].eqKey === null && by[GEO].perfKey === GEO, '7. engine: GEO (no Category) has its own returns and no look-through');
/* The engine looks up a Direct-plan row only after a Regular match; the guarded branch keeps the Direct row of an
   EXACT_ONLY mutual fund with no Regular row, by exact name only. */
ok(by[R40].hyKey === R40 && by[R40].perfKey === null && by[R40].perfKeyDirect === 'Aditya Birla SL Retirement Fund-40(G)-Direct Plan',
  '7. engine: Retirement-40 has its own look-through and its own Direct row; no Regular returns');
const rows2 = E.parseBaseRows([H,
  ['Test Client', 'Unknown Retirement Savings Fund-Reg(G)', '', 'Hybrid', '', 'Mutual Fund', 1, 1],
  ['Test Client', L40, '', 'Hybrid', 'Aditya Birla Sun Life', 'Mutual Fund', 1, 1],
  ['Test Client', 'HDFC Flexi Cap Fund(G)', 'Flexi Cap', 'Equity', 'HDFC', 'Mutual Fund', 1, 1]]);
E.computeReview(rows2, REF, { familyName: 'Test', asOnDate: '22 Nov 2026' });
ok(rows2[0].perfKey === null && !rows2[0].perfKeyDirect, '7. engine: a holding outside EXACT_ONLY with no Regular row still gets no Direct row (unchanged rule)');
ok(rows2[1].perfKey === null && !rows2[1].perfKeyDirect && !rows2[1].hyKey && !rows2[1].eqKey, '7. engine: "The 40s Plan" gets no other fund\'s returns, Direct row or look-through');
ok((m.unmatched || []).indexOf(R40) < 0, '7. engine: Retirement-40 is not reported unmatched');
const fed = ((m.equityAnalytics || {}).funds || []).map(f => f.name);
ok(fed.indexOf(NQ) < 0 && fed.indexOf(GEO) < 0, '7. engine: neither the Nasdaq 100 ETF nor GEO feeds the equity look-through');

if (fail) { console.log('\n' + fail + ' check(s) FAILED'); process.exit(1); }
console.log('\nall checks passed');
