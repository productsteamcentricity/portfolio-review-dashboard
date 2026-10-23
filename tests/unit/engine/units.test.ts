// covers: E-03
// Money units (architecture §6.7): 1 Crore = 100 Lakh = 1,00,00,000 rupees; money is held in Crore. Percent numbers
// and fractions convert by a factor of 100.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fractionToPct, fromCrore, pctToFraction, RUPEES_PER, toCrore } from '../../../app/src/engine/units.ts';

test('known conversions to Crore', () => {
  assert.equal(toCrore(1, 'crore'), 1);
  assert.equal(toCrore(250, 'lakh'), 2.5);
  assert.equal(toCrore(10000000, 'rupee'), 1);
  assert.equal(toCrore(6250000, 'rupee'), 0.625);
  assert.equal(toCrore(62.5, 'lakh'), 0.625);
  assert.deepEqual(RUPEES_PER, { crore: 1e7, lakh: 1e5, rupee: 1 });
});

test('the same arithmetic as the legacy pickCr (Lakh / 100, rupees / 1e7), bit for bit', () => {
  for (const v of [0.1, 1234.5678, 99999.99, 3.3333]) {
    assert.equal(toCrore(v, 'lakh'), v / 100);
    assert.equal(toCrore(v, 'rupee'), v / 1e7);
  }
});

test('from Crore back to the file unit', () => {
  assert.equal(fromCrore(2.5, 'lakh'), 250);
  assert.equal(fromCrore(0.625, 'rupee'), 6250000);
  assert.equal(fromCrore(1.75, 'crore'), 1.75);
});

test('percent numbers and fractions', () => {
  assert.equal(fractionToPct(0.5), 50);
  assert.equal(pctToFraction(12.5), 0.125);
  assert.ok(Math.abs(fractionToPct(0.0879) - 8.79) < 1e-12);
});
