// covers: E-13 M2.1
// Name normalisation (app/src/engine/match/normalize.ts), the legacy normalize() ported at parity. Known answers worked
// out by hand from the legacy rules (07_engine.js:110-141): compounds, punctuation, JUNK, SYN, first occurrence kept.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { nameKey, normalize } from '../../../app/src/engine/match/normalize.ts';

describe('normalize', () => {
  test('plan, option and joining words are dropped; compounds are joined', () => {
    assert.deepEqual(normalize('HDFC Flexi Cap Fund - Regular Plan - Growth'), ['hdfc', 'flexicap', 'fund']);
    assert.deepEqual(normalize('Mirae Asset Large Cap Fund(G)'), ['mirae', 'largecap', 'fund']);
    assert.deepEqual(normalize('Aditya Birla Sun Life Global Emerging Opportunities Fund'), ['aditya', 'birla', 'sl', 'global', 'emerging', 'opp', 'fund']);
  });

  test('synonyms collapse and the first occurrence of a token is kept', () => {
    assert.deepEqual(normalize('Banking & PSU Debt Fund'), ['bank', 'psu', 'debt', 'fund']);
    assert.deepEqual(normalize('Opportunities Opp Fund'), ['opp', 'fund']);
    assert.deepEqual(normalize('Government Securities Fund'), ['gsec', 'fund']);
    assert.deepEqual(normalize('Gilt Fund'), ['gsec', 'fund']);
    assert.deepEqual(normalize('Kotak Fund of Funds'), ['kotak', 'fof']);
  });

  test('a falsy input is the empty name', () => {
    assert.deepEqual(normalize(null), []);
    assert.deepEqual(normalize(undefined), []);
    assert.deepEqual(normalize(0), []);
    assert.deepEqual(normalize(''), []);
  });

  test('characterisation: the legacy is blind to Growth or IDCW and to Regular or Direct (corrected in sprint 2)', () => {
    assert.equal(nameKey('Sample Equity Fund - Growth'), nameKey('Sample Equity Fund - IDCW'));
    assert.equal(nameKey('Sample Equity Fund - Regular Plan'), nameKey('Sample Equity Fund - Direct Plan'));
  });

  test('characterisation: the token "constructor" is dropped, as the legacy plain-object lookup does', () => {
    assert.deepEqual(normalize('Constructor Fund'), ['fund']);
  });
});
