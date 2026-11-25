// covers: E-14 M2.1
// The PMS matcher (app/src/engine/match/pms.ts), the legacy matchPMS ported at parity. Synthetic names; answers worked
// out by hand from the legacy rule (07_engine.js:232-272).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPMS, pmsLev, pmsTok, pmsTokEq } from '../../../app/src/engine/match/pms.ts';

describe('matchPMS', () => {
  test('tokens: PMS words dropped, letter case and punctuation ignored', () => {
    assert.deepEqual(pmsTok('Kappa - Growth Strategy PMS'), ['kappa', 'growth']);
    assert.deepEqual(pmsTok(null), []);
  });

  test('token equality: synonyms, one edit on long words, prefixes of 4 or more letters', () => {
    assert.equal(pmsTokEq('opportunities', 'opp'), true);
    assert.equal(pmsTokEq('compounders', 'compounder'), true);
    assert.equal(pmsTokEq('consistent', 'consistnt'), true);
    assert.equal(pmsTokEq('value', 'valve'), false);
    assert.equal(pmsLev('abc', 'abcde'), 2);
  });

  test('the brand anchor is the name\'s first token', () => {
    assert.equal(matchPMS('Kappa Consistent Compounders', ['Kappa - Consistent Compounder PMS', 'Lambda Consistent Compounders']), 'Kappa - Consistent Compounder PMS');
    assert.equal(matchPMS('Omega Consistent Compounders', ['Kappa - Consistent Compounder PMS']), null);
  });

  test('an exact tie of shared tokens and ratio is ambiguous: no match', () => {
    assert.equal(matchPMS('Kappa Growth', ['Kappa Growth Alpha', 'Kappa Growth Beta']), null);
  });

  test('a one-token name matches when its only token is shared', () => {
    assert.equal(matchPMS('Kappa', ['Kappa Flagship Equity']), 'Kappa Flagship Equity');
  });
});
