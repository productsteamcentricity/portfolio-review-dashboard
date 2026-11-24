// covers: E-13 CR-0010 KI-036 M2.1
// CR-0010 A2 and A2b, ported with the live page's known answers (tools/regression/CR0010-a2-scoped-blocks.js checks 1
// to 6, the matcher-level cases; D-028: every legacy fix is ported with the same known answer). Four names match only
// their own exact name; the AMC's "The 40s Plan" and "The 30s Plan" spellings are pinned to their own Regular hybrid
// key and exact-only. The candidate lists are fixed here (each holds the right fund and the wrong funds the legacy
// fix measured), so a monthly refresh cannot break this file; the same names over the full universes are covered by
// tests/parity/matching.parity.test.ts.
// Not here: A3 (the SWOT international share) is a carried known answer on E-45 for M5, and the scoped Direct row of
// computeReview (Retirement Fund-40 and -30 keep their own Direct row) on E-31/E-32 for M3
// (docs/new-build/08-regression-test-plan.md §5.2).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { matchInstrument } from '../../app/src/engine/match/instrument.ts';

const U: Record<string, string[]> = {
  MF_PERF: [
    'Motilal Oswal Nasdaq 100 ETF', 'Motilal Oswal Nifty 100 ETF', 'Motilal Oswal Nifty Midcap 100 ETF', 'Motilal Oswal Nasdaq 100 FOF-Reg(G)',
    'Aditya Birla SL Global Emerging Opp Fund(G)', 'Aditya Birla SL Special Opp Fund-Reg(G)', 'Aditya Birla SL Retirement Fund-50-Reg(G)',
    'HDFC Flexi Cap Fund(G)',
  ],
  MF_PERF_DIRECT: [
    'Motilal Oswal Nasdaq 100 FOF(G)-Direct Plan', 'Aditya Birla SL Global Emerging Opp Fund(G)-Direct Plan', 'Aditya Birla SL Special Opp Fund(G)-Direct Plan',
    'Aditya Birla SL Retirement Fund-40(G)-Direct Plan', 'Aditya Birla SL Retirement Fund-30(G)-Direct Plan', 'Aditya Birla SL Retirement Fund-50(G)-Direct Plan',
  ],
  EQUITY_ANALYTICS: [
    'Motilal Oswal Nifty 100 ETF', 'Motilal Oswal Nifty Midcap 100 ETF', 'Aditya Birla SL Special Opp Fund-Reg(G)', 'Aditya Birla SL Conglomerate Fund-Reg(G)',
    'Aditya Birla SL Large Cap Fund-Reg(G)', 'HDFC Flexi Cap Fund(G)',
  ],
  HYBRID_ANALYTICS: [
    'Aditya Birla SL Retirement Fund-40-Reg(G)', 'Aditya Birla SL Retirement Fund-30-Reg(G)', 'Aditya Birla SL Retirement Fund-50-Reg(G)',
    'Aditya Birla SL Arbitrage Fund(G)', 'Aditya Birla SL Aggressive Hybrid Fund(G)',
  ],
  DEBT_ANALYTICS: ['Aditya Birla SL Gilt Fund-Reg(G)', 'Aditya Birla SL Retirement Fund-50-Reg(G)'],
};
const M = (name: string, b: string, amc = ''): string | null => matchInstrument(name, amc, U[b] as string[]);

const NQ = 'Motilal Oswal Nasdaq 100 ETF';
const GEO = 'Aditya Birla SL Global Emerging Opp Fund(G)';
const R40 = 'Aditya Birla SL Retirement Fund-40-Reg(G)';
const R30 = 'Aditya Birla SL Retirement Fund-30-Reg(G)';

describe('CR-0010 A2 and A2b known answers', () => {
  test('1. the Nasdaq 100 ETF has its own returns, no Direct row, no equity look-through', () => {
    assert.equal(M(NQ, 'MF_PERF'), NQ);
    assert.equal(M(NQ, 'MF_PERF', 'Motilal Oswal'), NQ);
    assert.equal(M(NQ, 'MF_PERF_DIRECT'), null);
    assert.equal(M(NQ, 'EQUITY_ANALYTICS'), null);
    assert.equal(M(NQ, 'EQUITY_ANALYTICS', 'Motilal Oswal'), null);
  });

  test('2. Global Emerging Opp has its own Regular and Direct returns, no look-through', () => {
    assert.equal(M(GEO, 'MF_PERF'), GEO);
    assert.equal(M(GEO, 'MF_PERF_DIRECT'), 'Aditya Birla SL Global Emerging Opp Fund(G)-Direct Plan');
    assert.equal(M(GEO, 'EQUITY_ANALYTICS'), null);
    assert.equal(M(GEO, 'EQUITY_ANALYTICS', 'Aditya Birla Sun Life'), null);
    assert.equal(M(GEO, 'HYBRID_ANALYTICS'), null);
    assert.equal(M(GEO, 'DEBT_ANALYTICS'), null);
  });

  test('3. Retirement Fund-40 and -30: own hybrid look-through and Direct row, no Regular returns', () => {
    for (const [n, x] of [[R40, '40'], [R30, '30']] as const) {
      assert.equal(M(n, 'HYBRID_ANALYTICS'), `Aditya Birla SL Retirement Fund-${x}-Reg(G)`);
      assert.equal(M(n, 'HYBRID_ANALYTICS', 'Aditya Birla Sun Life'), `Aditya Birla SL Retirement Fund-${x}-Reg(G)`);
      assert.equal(M(n, 'MF_PERF_DIRECT'), `Aditya Birla SL Retirement Fund-${x}(G)-Direct Plan`);
      assert.equal(M(n, 'MF_PERF'), null);
      assert.equal(M(n, 'MF_PERF', 'Aditya Birla Sun Life'), null);
      assert.equal(M(n, 'EQUITY_ANALYTICS'), null);
      assert.equal(M(n, 'DEBT_ANALYTICS'), null);
    }
  });

  test('4. the covered spellings share the normalised name', () => {
    for (const n of ['Motilal Oswal NASDAQ 100 ETF', 'Motilal Oswal Nasdaq-100 ETF', 'MOTILAL OSWAL NASDAQ 100 ETF - GROWTH']) {
      assert.equal(M(n, 'EQUITY_ANALYTICS'), null);
      assert.equal(M(n, 'MF_PERF'), NQ);
    }
    for (const n of ['Aditya Birla Sun Life Global Emerging Opportunities Fund', 'Aditya Birla Sun Life Global Emerging Opportunities Fund - Regular Plan - Growth']) {
      assert.equal(M(n, 'EQUITY_ANALYTICS'), null);
      assert.equal(M(n, 'MF_PERF'), GEO);
    }
    assert.equal(M('Aditya Birla Sun Life Retirement Fund - 30 - Regular - Growth', 'MF_PERF'), null);
    assert.equal(M('Aditya Birla Sun Life Retirement Fund - 30 - Regular - Growth', 'HYBRID_ANALYTICS'), R30);
  });

  test('5. controls are unchanged', () => {
    assert.equal(M('Aditya Birla SL Retirement Fund-50-Reg(G)', 'MF_PERF'), 'Aditya Birla SL Retirement Fund-50-Reg(G)');
    assert.equal(M('Aditya Birla SL Retirement Fund-50-Reg(G)', 'HYBRID_ANALYTICS'), 'Aditya Birla SL Retirement Fund-50-Reg(G)');
    assert.equal(M('Motilal Oswal Nifty 100 ETF', 'EQUITY_ANALYTICS'), 'Motilal Oswal Nifty 100 ETF');
    assert.equal(M('Motilal Oswal Nifty 100 ETF', 'MF_PERF'), 'Motilal Oswal Nifty 100 ETF');
    assert.equal(M('Aditya Birla SL Special Opp Fund-Reg(G)', 'EQUITY_ANALYTICS'), 'Aditya Birla SL Special Opp Fund-Reg(G)');
    assert.equal(M('Aditya Birla SL Special Opp Fund-Reg(G)', 'MF_PERF_DIRECT'), 'Aditya Birla SL Special Opp Fund(G)-Direct Plan');
    assert.equal(M('Motilal Oswal Nasdaq 100 FOF-Reg(G)', 'MF_PERF'), 'Motilal Oswal Nasdaq 100 FOF-Reg(G)');
    assert.equal(M('Motilal Oswal Nasdaq 100 FOF-Reg(G)', 'MF_PERF_DIRECT'), 'Motilal Oswal Nasdaq 100 FOF(G)-Direct Plan');
    assert.equal(M('Kotak Global Innovation Overseas Equity Omni FOF', 'MF_PERF'), null);
    assert.equal(M('HDFC Flexi Cap Fund - Regular Plan - Growth', 'MF_PERF'), 'HDFC Flexi Cap Fund(G)');
    assert.equal(M('HDFC Flexi Cap Fund - Regular Plan - Growth', 'EQUITY_ANALYTICS'), 'HDFC Flexi Cap Fund(G)');
  });

  test('6. A2b: "The 40s Plan" and "The 30s Plan" are pinned to their own fund and exact-only', () => {
    const L40 = 'Aditya Birla Sun Life Retirement Fund - The 40s Plan - Regular Plan - Growth';
    const L30 = 'Aditya Birla Sun Life Retirement Fund-The 30s Plan-Regular Growth';
    assert.equal(M(L40, 'HYBRID_ANALYTICS'), R40);
    assert.equal(M('Aditya Birla Sun Life Retirement Fund - 40s Plan - Regular Growth', 'HYBRID_ANALYTICS'), R40);
    assert.equal(M(L30, 'HYBRID_ANALYTICS'), R30);
    for (const n of [L40, L30]) for (const b of ['MF_PERF', 'MF_PERF_DIRECT', 'EQUITY_ANALYTICS', 'DEBT_ANALYTICS']) assert.equal(M(n, b), null, `${n} | ${b}`);
    assert.equal(M('ABSL Retirement Fund - 40 - Regular - Growth', 'MF_PERF'), null);
    assert.equal(M('Motilal Oswal Nasdaq 100 Exchange Traded Fund', 'EQUITY_ANALYTICS'), null);
  });
});
