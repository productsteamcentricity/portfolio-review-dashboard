// covers: E-08 KI-033 OD-11 M2.3
// The vendor's PMS performance file (app/src/ingest/vendor/pms-performance.ts) read by header name, as the monthly
// pipeline reads it (buildtools/refresh_pms_perf.js:33-73): returns as stated (no x100, KI-033), AUM from rupees to whole
// crore, duplicates by the normalised key, a missing column refuses the file. Synthetic rows; answers by hand.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { pmsKey, readPmsPerformance } from '../../../../app/src/ingest/vendor/pms-performance.ts';

const H = ['Scheme Name', 'Category', 'AUM', 'Scheme Return 1 Month', 'Scheme Return 3 Month', 'Scheme Return 6 Month', 'Scheme Return 1 Year',
  'Scheme Return 2 Year', 'Scheme Return 3 Year', 'Scheme Return 5 Year', 'Scheme Return Since Inception', 'Large Cap', 'Mid Cap', 'Small Cap'];
const read = (rows: unknown[][]) => readPmsPerformance(['Notes', 'Data'], (s) => (s === 'Data' ? rows : [['About this file']]));

describe('PMS performance file', () => {
  test('a row by header name: returns as stated, AUM in whole crore', () => {
    const p = read([H, ['Alpha  Capital - Flagship   PMS', 'Multi Cap', '21,290,000,000', 3.2, '4.3', 1.1, 5, 10.7, 12, null, '15.5', 50, 30, 20]]);
    assert.ok(p.ok);
    if (!p.ok) return;
    assert.equal(p.sheet, 'Data');
    const row = p.byKey.get(pmsKey('Alpha Capital - Flagship PMS'));
    assert.deepEqual(row, { name: 'Alpha Capital - Flagship PMS', aum: 2129, r: { '1M': 3.2, '3M': 4.3, '6M': 1.1, '1Y': 5, '2Y': 10.7, '3Y': 12, '5Y': null, SI: 15.5 } });
    assert.equal(p.mcapFilled, 1);
  });

  test('the key folds dashes, quotes, filler words and a known typo', () => {
    assert.equal(pmsKey('Beta Securities \u2013 Aplhasense Portfolio'), pmsKey('Beta - AlphaSense'));
    assert.equal(pmsKey("Gamma's Value PMS"), 'gammas value');
  });

  test('a strategy filed twice: the first is kept unless all its returns are empty', () => {
    const p = read([H,
      ['Delta Value PMS', 'Mid Cap', 1e9, null, null, null, null, null, null, null, null],
      ['Delta - Value', 'Mid Cap', 2e9, 1, 2, 3, 4, 5, 6, 7, 8],
      ['Delta Value', 'Mid Cap', 3e9, 9, 9, 9, 9, 9, 9, 9, 9],
    ]);
    assert.ok(p.ok);
    if (!p.ok) return;
    assert.equal(p.byKey.size, 1);
    assert.equal(p.byKey.get('delta value')?.aum, 200);
    assert.deepEqual(p.duplicates, ['Delta - Value', 'Delta Value']);
  });

  test('a missing column refuses the file with its name; no "Scheme Name" sheet refuses too', () => {
    const p = read([H.filter((h) => h !== 'Scheme Return 5 Year'), ['X', 'Y', 1]]);
    assert.deepEqual(p, { ok: false, reason: 'column missing: Scheme Return 5 Year' });
    assert.equal(readPmsPerformance(['S'], () => [['Fund'], ['X']]).ok, false);
  });
});
