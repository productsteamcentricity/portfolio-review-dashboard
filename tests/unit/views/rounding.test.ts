// covers: BR-13.2 P-09
// Unrounded maths, rounding on display only (architecture §6.1 rule 3): every Figure keeps the engine's value, the
// workbook's number (shown) is unrounded too, and only display.text is rounded. Ties follow toFixed on the binary
// value. The legacy page's unrounded values give the same text through the new formatter as through the legacy's
// own rule, (Math.round(x * 100) / 100).toFixed(2) (07_engine.js cr2, pct2, mkUnit().t), which is restated here as
// the independent oracle.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Value } from '../../../app/src/model/value.ts';
import type { Figure, OverviewVM } from '../../../app/src/views/overview-vm.ts';
import { present } from '../../../app/src/engine/value.ts';
import { displayNumber, displayPct, formatIndian } from '../../../app/src/views/format.ts';
import { buildOverviewVM } from '../../../app/src/views/overview.ts';
import { sampleReview } from '../../helpers/sample-review.ts';

const PROV = { sources: [], method: 'test' };
const legacy2 = (x: number): string => (Math.round(x * 100) / 100).toFixed(2);

function figures(vm: OverviewVM): Figure[] {
  const out: Figure[] = vm.kpis.map((k) => k.figure);
  for (const r of [...vm.allocation.rows, ...vm.liquidity.rows]) out.push(r.invested, r.cmv, r.pct, r.gain, r.absReturn, r.investedCoverage);
  for (const m of [vm.matrices.client, vm.matrices.distributor]) {
    for (const c of m.columns) out.push(c.cmv, c.share);
    for (const r of m.rows) out.push(...r.cells, r.total);
  }
  return out;
}

describe('values stay unrounded until display', () => {
  const review = sampleReview('standard');
  const vm = buildOverviewVM(review);
  test('the figures hold the engine values, unrounded', () => {
    const eq = vm.allocation.rows.find((r) => r.kind === 'asset' && r.asset === 'Equity')!;
    assert.equal((eq.pct.value as { v: number }).v, 59.26036385326573);
    assert.equal((eq.pct.shown as { v: number }).v, 59.26036385326573);
    assert.equal(eq.pct.display.text, '59.26%');
    assert.equal((vm.kpis[1]!.figure.value as { v: number }).v, 3.353);
    assert.equal(vm.kpis[1]!.figure.display.text, '3.35');
    // Each display is the rounding of its own unrounded number (shown), never of a rounded intermediate.
    for (const f of figures(vm)) {
      if (f.shown.kind !== 'value') continue;
      const want = formatIndian(f.shown.v, f.shown.unit === 'count' ? 0 : 2) + (f.shown.unit === 'pct' ? '%' : '');
      assert.equal(f.display.text, want, f.key);
    }
    // A value with more digits than shown keeps them: 1.987 shows "1.99" and stays 1.987.
    assert.equal((eq.cmv.value as { v: number }).v, 1.987);
    assert.equal(eq.cmv.display.text, '1.99');
  });
  test('in Lakh the workbook number is the Crore value times 100, unrounded', () => {
    const lakh = buildOverviewVM(sampleReview('lakh'));
    const cmv = lakh.kpis[1]!.figure;
    assert.equal(cmv.display.text, '335.30');
    assert.ok(cmv.shown.kind === 'value' && Math.abs(cmv.shown.v - 335.3) < 1e-9);
    assert.ok(cmv.value.kind === 'value' && cmv.value.v === 3.353);
  });
});

describe('ties and the legacy rule', () => {
  test('ties follow toFixed on the binary value: 1.005 gives "1.00", 0.125 gives "0.13"', () => {
    assert.equal(formatIndian(1.005), '1.00');
    assert.equal(formatIndian(0.125), '0.13');
    assert.equal(displayPct(present(0.125, 'pct', PROV)).text, '0.13%');
    assert.equal(formatIndian(2.675), '2.67');
  });
  test('the legacy unrounded values give the same text through the new formatter (P-09)', () => {
    const vm = buildOverviewVM(sampleReview('standard'));
    const values = figures(vm).map((f) => f.value).filter((v): v is Extract<Value<number>, { kind: 'value' }> => v.kind === 'value');
    assert.ok(values.length > 40);
    for (const v of values) {
      if (v.unit === 'count') continue;
      assert.equal(displayNumber(v).text, legacy2(v.v), String(v.v));
    }
    for (const x of [17.649122807017545, 0.503, 0.5030000000000001, 1.5281173594132031, 13.814180929095354, 0.145, 4.35, 8.345]) {
      assert.equal(formatIndian(x), legacy2(x), String(x));
    }
  });
});
