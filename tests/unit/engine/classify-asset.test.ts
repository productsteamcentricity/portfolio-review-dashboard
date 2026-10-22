// covers: E-22 OD-7
// Asset class of an Asset Name (OD-7): "Fixed Income" and "Debt Funds" are Debt; blank and unrecognised labels stay
// unknown (never Equity); recognition ignores letter case and spaces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAssetLabel } from '../../../app/src/engine/classify/asset.ts';

test('asset labels', () => {
  const cases: Array<[string | null, string | null, string]> = [
    ['Equity', 'Equity', 'label'],
    ['  EQUITY  ', 'Equity', 'label'],
    ['Debt', 'Debt', 'label'],
    ['Hybrid', 'Hybrid', 'label'],
    ['Commodity', 'Commodity', 'label'],
    ['Commodities', 'Commodity', 'label'],
    ['Fixed Income', 'Debt', 'synonym'],
    ['fixed  income', 'Debt', 'synonym'],
    ['Debt Funds', 'Debt', 'synonym'],
    ['', null, 'blank'],
    ['   ', null, 'blank'],
    [null, null, 'blank'],
    ['Gold', null, 'unrecognised'],
    ['Equities', null, 'unrecognised'],
    ['Debt Fund', null, 'unrecognised'],
    ['Cash', null, 'unrecognised'],
  ];
  for (const [label, cls, how] of cases) {
    const r = readAssetLabel(label);
    assert.deepEqual([r.assetClass, r.how], [cls, how], String(label));
  }
});
