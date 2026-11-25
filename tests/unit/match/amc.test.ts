// covers: E-20 KI-061 OD-32 OD-34 M2.1
// The fund-house key helpers (app/src/engine/match/amc.ts) ported at parity. The label lists of KI-061, OD-32 and
// OD-34 are in tests/regression/; this file checks the building blocks, worked out by hand from 07_engine.js:16-91.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AMC_HOUSE, AMC_NOT_GIVEN, amcDisplay, amcFormer, amcKey, amcSquash } from '../../../app/src/engine/match/amc.ts';

describe('fund-house key', () => {
  test('squash: lower case, noise words dropped, all kept when every word is noise', () => {
    assert.equal(amcSquash('HDFC Asset Management Company Ltd.'), 'hdfc');
    assert.equal(amcSquash('Mutual Fund'), 'mutualfund');
    assert.equal(amcSquash(null), '');
  });

  test('a listed house keys to its first display token; "India" after a house name is ignored', () => {
    assert.equal(AMC_HOUSE.get('woc'), 'whiteoak');
    assert.equal(AMC_HOUSE.get('boi'), 'bankofindia');
    assert.equal(amcKey('PGIM India Mutual Fund'), 'pgim');
    assert.equal(amcKey('Invesco India'), 'invesco');
    assert.equal(amcKey('Old Bridge Mutual Fund'), 'oldbridge');
  });

  test('former names (OD-32) and "AMC not given" (OD-34)', () => {
    assert.equal(amcFormer('IDFC Mutual Fund'), true);
    assert.equal(amcFormer('IDFC First Bank'), false);
    assert.equal(amcKey('N/A'), '');
    assert.equal(AMC_NOT_GIVEN, 'AMC not given');
  });

  test('display: a listed token shows its display name, any other label itself, trimmed', () => {
    assert.equal(amcDisplay('PPFAS'), 'PPFAS');
    assert.equal(amcDisplay('parag'), 'PPFAS (Parag Parikh)');
    assert.equal(amcDisplay('  IDFC '), 'IDFC');
    assert.equal(amcDisplay(null), '');
  });
});
