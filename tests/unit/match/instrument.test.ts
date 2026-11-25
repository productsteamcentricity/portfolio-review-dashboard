// covers: E-13 KI-036 M2.1
// The instrument matcher (app/src/engine/match/instrument.ts), the legacy matchInstrument ported at parity. Synthetic
// candidate names; each answer worked out by hand from the legacy rule (07_engine.js:172-230): exact name first, then
// at least 3 shared tokens of 2 or more letters with at least 2 distinctive, or a contained shorter name; the brand
// anchor; the most shared tokens, then the Jaccard ratio, then the first candidate.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { matchInstrument, matchInstrumentDetail, isExactOnly } from '../../../app/src/engine/match/instrument.ts';

describe('matchInstrument', () => {
  test('an exact normalised name beats any score', () => {
    assert.equal(matchInstrument('Alpha Small Fund', '', ['Alpha Small Cap Fund', 'Alpha Small Fund-Reg(G)']), 'Alpha Small Fund-Reg(G)');
    assert.equal(matchInstrumentDetail('Alpha Small Fund', '', ['Alpha Small Fund-Reg(G)']).step, 'exact');
  });

  test('three shared tokens with two distinctive pass; one distinctive fails', () => {
    /* zeta value discovery fund vs zeta value discovery plus fund: shared 4, distinctive value and discovery */
    assert.equal(matchInstrument('Zeta Value Discovery Fund', '', ['Zeta Value Discovery Plus Fund']), 'Zeta Value Discovery Plus Fund');
    /* zeta value prime fund vs zeta value plus fund: shared 3 (zeta, value, fund), distinctive only value; not contained */
    assert.equal(matchInstrument('Zeta Value Prime Fund', '', ['Zeta Value Plus Fund']), null);
  });

  test('a fully contained shorter name with one distinctive token passes', () => {
    assert.equal(matchInstrument('Zeta Value Fund', '', ['Zeta Value Plus Fund']), 'Zeta Value Plus Fund');
    assert.equal(matchInstrument('Zeta Value', '', ['Zeta Value Plus Fund']), 'Zeta Value Plus Fund');
  });

  test('the brand anchor: the AMC token must be a token of the candidate', () => {
    assert.equal(matchInstrument('Zeta Value Discovery Fund', 'Omega MF', ['Zeta Value Discovery Plus Fund']), null);
    assert.equal(matchInstrument('Zeta Value Discovery Fund', 'Zeta Mutual Fund', ['Zeta Value Discovery Plus Fund']), 'Zeta Value Discovery Plus Fund');
  });

  test('more shared tokens win, then the higher Jaccard ratio', () => {
    const c = ['Zeta Value Discovery Fund Extra Long Name', 'Zeta Value Discovery Fund Series']; // shared 4 each
    assert.equal(matchInstrument('Zeta Value Discovery Fund', '', c), 'Zeta Value Discovery Fund Series');
  });

  test('characterisation KI-036: on equal scores the first candidate wins (sprint 2 returns no match)', () => {
    assert.equal(matchInstrument('Zeta Value Fund', '', ['Zeta Value Alpha Fund', 'Zeta Value Beta Fund']), 'Zeta Value Alpha Fund');
    assert.equal(matchInstrument('Zeta Value Fund', '', ['Zeta Value Beta Fund', 'Zeta Value Alpha Fund']), 'Zeta Value Beta Fund');
  });

  test('a token cache gives the same answers', () => {
    const cands = ['Zeta Value Plus Fund', 'Zeta Value Discovery Plus Fund', 'Alpha Small Fund-Reg(G)'];
    const cache = new Map<string, string[]>();
    for (const n of ['Zeta Value Fund', 'Zeta Value Discovery Fund', 'Alpha Small Fund', 'Nothing Here']) {
      assert.equal(matchInstrument(n, '', cands, cache), matchInstrument(n, '', cands));
    }
  });

  test('isExactOnly reads the normalised name', () => {
    assert.equal(isExactOnly('Motilal Oswal Nasdaq 100 ETF - Growth'), true);
    assert.equal(isExactOnly('Motilal Oswal Nifty 100 ETF'), false);
  });
});
