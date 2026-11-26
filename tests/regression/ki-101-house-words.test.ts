// covers: E-13 KI-101 KI-036 OD-5 M2.1
// KI-101 (P1) and the house-word half of the audit's NEW-4 fix: the legacy counts the rest of a multi-word fund-house
// name (birla, sl, pru, rob, india ...) as distinctive, so a fund can match another fund of the same house on house
// words alone ("Aditya Birla SL Midcap Fund(G)" tagged Hybrid gets "Aditya Birla SL Arbitrage Fund(G)"). The correction
// (MatchOptions.houseTokens, with nullOnTies): a house's words, and the holding's own AMC words, are never distinctive.
// The thresholds are unchanged (CLAUDE.md rule 4). The audit's other half, idf weighting, was measured and not adopted
// (tests/parity/matching-corrections-ledger.json and the Gate A note): as a guard it lost about 50 correct official AMFI
// names, and as a ranking it added wrong matches.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE_SHARE, houseWords, matchInstrument, matchInstrumentDetail } from '../../app/src/engine/match/instrument.ts';
import { refdataBlock } from '../helpers/legacy-engine.ts';

const C = { nullOnTies: true, houseTokens: true };

describe('KI-101: fund-house words are not distinctive', () => {
  test('house words: the leading words at least 90% of a house\'s names share; 3 names at least', () => {
    assert.equal(HOUSE_SHARE, 0.9);
    const h = houseWords(['Zeta Prime Alpha Fund', 'Zeta Prime Beta Fund', 'Zeta Prime Gamma Fund', 'Solo One Fund', 'Duo X Fund', 'Duo Y Fund']);
    assert.deepEqual([...h.get('zeta')!], ['zeta', 'prime']);
    assert.deepEqual([...h.get('solo')!], ['solo'], 'one name: its whole name never becomes house words');
    assert.deepEqual([...h.get('duo')!], ['duo'], 'two names: first word only');
  });

  test('the real houses of MF_PERF include the multi-word ones the audit names', () => {
    const h = houseWords(Object.keys(refdataBlock('MF_PERF')));
    const multi = new Set([...h.values()].filter((s) => s.size > 1).map((s) => [...s].join(' ')));
    for (const x of ['aditya birla sl', 'icici pru', 'franklin india', 'canara rob']) assert.ok(multi.has(x), x);
  });

  test('the KI-101 case: a Midcap fund absent from the hybrid set no longer takes the house\'s Arbitrage fund', () => {
    const cands = ['Aditya Birla SL Arbitrage Fund(G)', 'Aditya Birla SL Balanced Advantage Fund(G)', 'Aditya Birla SL Equity Savings Fund-Reg(G)', 'Aditya Birla SL Aggressive Hybrid Fund(G)'];
    assert.equal(matchInstrument('Aditya Birla SL Midcap Fund(G)', 'Aditya Birla Sun Life', cands), 'Aditya Birla SL Arbitrage Fund(G)', 'legacy');
    assert.equal(matchInstrument('Aditya Birla SL Midcap Fund(G)', 'Aditya Birla Sun Life', cands, undefined, C), null);
  });

  test('the holding\'s own AMC words are house words too', () => {
    const cands = ['Zeta Capital Value Fund-Reg(G)', 'Zeta Capital Momentum Fund-Reg(G)'];
    assert.equal(matchInstrument('Zeta Capital Fund', 'Zeta Capital Mutual Fund', cands, undefined, { nullOnTies: true }), null, 'a tie already');
    const one = ['Zeta Capital Value Fund-Reg(G)'];
    assert.equal(matchInstrument('Zeta Capital Fund', 'Zeta Capital', one, undefined, { nullOnTies: true }), one[0], 'without house words: capital is distinctive');
    assert.equal(matchInstrument('Zeta Capital Fund', 'Zeta Capital', one, undefined, C), null);
  });

  test('a real distinctive word still matches (no threshold is raised)', () => {
    const cands = ['Aditya Birla SL Arbitrage Fund(G)', 'Aditya Birla SL Midcap Fund-Reg(G)'];
    assert.equal(matchInstrument('Aditya Birla Sun Life Midcap Fund - Growth', '', cands, undefined, C), 'Aditya Birla SL Midcap Fund-Reg(G)');
    assert.equal(matchInstrumentDetail('ABSL Arbitrage Fund', 'Aditya Birla', cands, undefined, C).key, null, 'abbreviated house: no brand anchor');
  });

  test('houseTokens needs the corrected path', () => {
    assert.throws(() => matchInstrument('x', '', ['y'], undefined, { houseTokens: true }), /nullOnTies/);
  });
});
