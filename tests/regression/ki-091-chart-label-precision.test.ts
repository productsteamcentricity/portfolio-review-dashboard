// covers: E-52 KI-091
// KI-091 (audit NEW-45: the legacy pie labels are whole percent, so "6%" sits beside a table that says 6.21, and a
// sliver's "0%" collides with its neighbour): every pie label on the slide is the view-model's text, the category
// and its percent to one decimal (D-039), and a slice under 2.00 % has its label deleted while its value
// stays in the table and the legend.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Slide } from '../helpers/slide-inventory.ts';
import { buildDeck, makeVM, fig, type AssetSpec } from '../exports/pptx/sample-vm.ts';

test('KI-091: one decimal, nothing under 2 %', async () => {
  // CMV in Crore over a total of 10.00: shares 66.67, 19.13, 10.21, 2.00, 1.99 (the boundary pair) per cent.
  // Labels by hand: 'Equity 66.7%', 'Debt 19.1%', 'Hybrid 10.2%', 'Commodity 2.0%', none for REITs/InvITs.
  const a = (asset: AssetSpec['asset'], cmv: number, pct: number): AssetSpec => ({
    asset, line: { invested: cmv, cmv, pct }, products: [{ label: 'Mutual Funds', invested: cmv, cmv, pct }],
  });
  const vm = makeVM({
    assets: [a('Equity', 6.667, 66.67), a('Debt', 1.913, 19.13), a('Hybrid', 1.021, 10.21), a('Commodity', 0.2, 2), a('REITs/InvITs', 0.199, 1.99)],
    total: { invested: 10, cmv: 10, pct: 100 },
    liquidity: [{ label: 'Open Ended', invested: 10, cmv: 10, pct: 100 }],
    kpi: {
      invested: fig('totals.invested', 10, '10.00'), cmv: fig('totals.cmv', 10, '10.00'), gain: fig('totals.gain', 0, '0.00'),
      absReturn: fig('totals.absReturnPct', 0, '0.00%', { unit: 'pct' }), holdings: 5, clients: 1,
    },
  });
  assert.deepEqual(vm.charts.asset.slices.map((s) => s.label), ['Equity 66.7%', 'Debt 19.1%', 'Hybrid 10.2%', 'Commodity 2.0%', null]);
  const { inv } = await buildDeck(vm);
  const s = inv.slides[0] as Slide;
  const pie = s.charts.find((c) => c.name === 'C-08 asset pie')!;
  // On the slide each label is on two lines, the category and then the percent (D-039 point 6).
  assert.deepEqual(pie.labels.map((l) => (l.deleted ? null : l.text)), ['Equity\n66.7%', 'Debt\n19.1%', 'Hybrid\n10.2%', 'Commodity\n2.0%', null]);
  for (const l of pie.labels) if (!l.deleted) assert.match(l.text ?? '', /^\S.*\n\d+\.\d%$/);
  assert.equal(pie.defaults.numFmt, '0.0%');
  // The value under 2 % stays in the legend (its category) and in the table, to two decimals.
  assert.equal(pie.categories[4], 'REITs/InvITs');
  assert.ok(s.tables[0]!.rows.some((r) => r.cells[0]!.text === 'REITs/InvITs' && r.cells[3]!.text === '1.99%'));
});
