// covers: E-13 KI-050 OD-5 M2.1
// The second normaliser and the candidate-side word guard (the sprint 2a follow-up the owner asked for on 26 Nov 2026:
// recover the correct official names the stricter regime left unmatched, without new wrong matches). Known answers
// are the real spellings the measurement found (tests/parity/matching-corrections.ts); the legacy normalize() is
// unchanged.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, normalizeV2 } from '../../../app/src/engine/match/normalize.ts';
import { NEW_BUILD_MATCHING, matchInstrument, referenceVocabulary } from '../../../app/src/engine/match/instrument.ts';

describe('normalizeV2', () => {
  test('"(Formerly Known as ...)" and "(erstwhile ...)" are dropped', () => {
    assert.deepEqual(normalizeV2('Sundaram Consumption Fund(Formerly Known as Sundaram Rural and Consumption Fund Regular Plan - Growth)'), ['sundaram', 'consum', 'fund']);
    assert.deepEqual(normalizeV2('ICICI Prudential Large Cap Fund (erstwhile Bluechip Fund)  - Growth'), ['icici', 'pru', 'largecap', 'fund']);
  });

  test('"S&P" is dropped before "BSE" only', () => {
    assert.deepEqual(normalizeV2('Tata S&P BSE Sensex Index Fund -Regular Plan'), ['tata', 'bse', 'sensex', 'index', 'fund']);
    assert.deepEqual(normalizeV2('Motilal Oswal S&P 500 Index Fund-Reg(G)'), ['motilal', 's', 'p', '500', 'index', 'fund']);
  });

  test('letters and digits split; spaces collapsed before the compounds', () => {
    assert.deepEqual(normalizeV2('UTI Nifty200 Momentum 30 Index Fund-Reg(G)'), normalizeV2('UTI Nifty 200 Momentum 30 Index Fund - Regular Plan - Growth Option'));
    assert.deepEqual(normalizeV2('Zeta Multi - Cap Fund'), ['zeta', 'multicap', 'fund']);
    assert.deepEqual(normalize('Zeta Multi - Cap Fund'), ['zeta', 'multi', 'cap', 'fund'], 'the legacy normaliser is unchanged');
  });

  test('the extra compounds and synonyms', () => {
    assert.deepEqual(normalizeV2('Tata Nifty Private Bank Exchange Traded Fund'), normalizeV2('Tata Nifty Pvt Bank ETF'));
    assert.deepEqual(normalizeV2('Sundaram Financial Services Opportunities Fund'), normalizeV2('Sundaram Fin Serv Opp Fund'));
    assert.deepEqual(normalizeV2('Axis BSE India Sectors Leaders Index Fund'), normalizeV2('Axis BSE India Sector Leaders Index Fund'));
    assert.deepEqual(normalizeV2('Navi Nifty Midsmall 400 Index Fund'), normalizeV2('Navi Nifty MidSmallcap 400 Index Fund'));
  });
});

describe('candidateWordGuard (with the stricter regime)', () => {
  /** "momentum" known but rare (2 of 50 names, under the 5% bar); "value" common. */
  const SET = [
    'Omega Momentum Fund-Reg(G)',
    ...Array.from({ length: 24 }, (_, i) => `Zeta Value Plan ${i + 1} Fund-Reg(G)`),
    ...Array.from({ length: 24 }, (_, i) => `Omega Value Series ${i + 1} Fund-Reg(G)`),
  ];

  test('a short name never sits inside a longer, different fund with a rare word of its own', () => {
    const cands = [...SET, 'Zeta Midcap Momentum Fund-Reg(G)'];
    const holdingOnly = { nullOnTies: true, houseTokens: true, absentFundGuard: true };
    assert.equal(matchInstrument('Zeta Midcap Fund', 'Zeta', cands, undefined, holdingOnly), 'Zeta Midcap Momentum Fund-Reg(G)');
    assert.equal(matchInstrument('Zeta Midcap Fund', 'Zeta', cands, undefined, { ...holdingOnly, candidateWordGuard: true }), null);
  });

  test('needs the stricter regime; the preset has both', () => {
    assert.throws(() => matchInstrument('x', '', ['y'], undefined, { nullOnTies: true, candidateWordGuard: true }), /absentFundGuard/);
    assert.deepEqual({ ...NEW_BUILD_MATCHING }, { nullOnTies: true, identifierJoin: true, houseTokens: true, absentFundGuard: true, normaliserV2: true, candidateWordGuard: true });
  });
});

describe('knownWords: the reference data\'s vocabulary for the stricter regime', () => {
  const regular = ['Zeta Nifty 500 Shariah Index Fund-Reg(G)', 'Zeta Nifty 500 Index Fund-Reg(G)', 'Zeta Bond Fund-Reg(G)', 'Kappa Case Nifty 50 ETF', 'Kappa Case Nifty 100 ETF', 'Kappa Case Nifty Bank ETF'];
  const direct = ['Zeta Nifty 500 Index Fund(G)-Direct Plan', 'Zeta Bond Fund(G)-Direct Plan', 'Kappa Nifty 50 ETF'];
  const known = referenceVocabulary([regular, direct]);
  const strict = { nullOnTies: true, houseTokens: true, absentFundGuard: true, normaliserV2: true, candidateWordGuard: true };

  test('a word of a fund missing from this set but known elsewhere blocks the match', () => {
    const q = 'Zeta Nifty 500 Shariah Index Fund - Direct Plan';
    assert.equal(matchInstrument(q, 'Zeta', direct, undefined, strict), 'Zeta Nifty 500 Index Fund(G)-Direct Plan', 'without the vocabulary "shariah" looks unknown');
    assert.equal(matchInstrument(q, 'Zeta', direct, undefined, { ...strict, knownWords: known }), null);
  });

  test('a fund-house word of another set ("case") is not a known word', () => {
    assert.ok(known.has('shariah'));
    assert.equal(known.has('case'), false);
    assert.equal(matchInstrument('Kappa Case Nifty 50 ETF', 'Kappa', direct, undefined, { ...strict, knownWords: known }), 'Kappa Nifty 50 ETF');
  });
});
