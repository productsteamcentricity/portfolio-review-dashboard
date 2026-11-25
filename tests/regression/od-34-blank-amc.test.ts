// covers: E-20 OD-34 M2.1
// OD-34, ported with the live page's known answers (tools/regression/OD-34-amc-not-given.js, checks 1b and 1c): a label
// with no letter or digit, or a placeholder in any letter case, gives no house; a label that only contains such a word,
// or a real house, keeps a key. Such mutual-fund rows are shown as "AMC not given".

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AMC_NOT_GIVEN, amcKey } from '../../app/src/engine/match/amc.ts';

describe('OD-34: AMC not given', () => {
  test('no letter or digit: no house', () => {
    for (const l of ['-', '  ', '']) assert.equal(amcKey(l), '', JSON.stringify(l));
  });

  test('placeholder labels, in any letter case: no house', () => {
    const PH = ['NA', 'N/A', 'N.A.', 'Not Available', 'Unknown', 'Others', 'Other', '-', '--'];
    const variants = PH.concat(['na', 'n/a', 'n.a.', 'N. A.', 'NOT AVAILABLE', 'not available', 'UNKNOWN', 'unknown', 'OTHERS', 'other', ' N/A ']);
    for (const l of variants) assert.equal(amcKey(l), '', JSON.stringify(l));
  });

  test('a label that only contains such a word, or a real house, keeps a key', () => {
    for (const l of ['Navi', 'NJ Mutual Fund', 'Union', 'Unknown Opportunities', 'Other Distributor', 'Nippon India']) assert.notEqual(amcKey(l), '', l);
  });

  test('the name shown for such rows', () => {
    assert.equal(AMC_NOT_GIVEN, 'AMC not given');
  });
});
