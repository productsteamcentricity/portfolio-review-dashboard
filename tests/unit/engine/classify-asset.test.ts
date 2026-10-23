// covers: E-22 OD-7
// Asset class of an Asset Name (OD-7): the five legacy allocation classes (07_engine.js:1147 assetOrder, REITs/InvITs
// included) as labelled; "Fixed Income" and "Debt Funds" are Debt; blank and unrecognised labels stay unknown (never
// Equity); recognition ignores letter case and spacing, spaces around a slash included.

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

test('REITs/InvITs is the fifth class, in the spellings the legacy page itself uses; nothing near it is guessed', () => {
  const cases: Array<[string, string | null, string]> = [
    // The legacy allocation order (07_engine.js:1147), the IPS rows (11_app_ui.js:3903 and 4840) and a change of case.
    ['REITs/InvITs', 'REITs/InvITs', 'label'],
    ['REITs / InvITs', 'REITs/InvITs', 'label'],
    ['REITs/ INVITs', 'REITs/InvITs', 'label'],
    ['reits /invits', 'REITs/InvITs', 'label'],
    ['  REITS  /  INVITS  ', 'REITs/InvITs', 'label'],
    // Not the label: each stays unknown with a notice until the owner says otherwise (M2.2).
    ['REITs', null, 'unrecognised'],
    ['InvITs', null, 'unrecognised'],
    ['REIT', null, 'unrecognised'],
    ['REITs & InvITs', null, 'unrecognised'],
    ['InvITs/REITs', null, 'unrecognised'],
  ];
  for (const [label, cls, how] of cases) {
    const r = readAssetLabel(label);
    assert.deepEqual([r.assetClass, r.how], [cls, how], label);
  }
});
