// covers: BR-13.2 BR-14.3 P-09 U-52 D-039
// Unrounded maths, rounding on display only (architecture §6.1 rule 3): every Figure keeps the engine's value, the
// workbook's number (shown) is unrounded too, and only display.text is rounded. The display rounds as Excel shows a
// cell (D-039): to 15 significant digits, then half up on that decimal, so screen, slide and workbook read alike.
// Known answers by hand, and against tests/helpers/excel-text.ts (written apart from the formatter). Away from the
// half-way values the legacy page's own rule, (Math.round(x * 100) / 100).toFixed(2) (07_engine.js cr2, pct2,
// mkUnit().t), gives the same text; at them the legacy and toFixed round down on the binary value and Excel does not.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Value } from '../../../app/src/model/value.ts';
import type { Figure, OverviewVM } from '../../../app/src/views/overview-vm.ts';
import { present } from '../../../app/src/engine/value.ts';
import { displayNumber, displayPct, formatIndian } from '../../../app/src/views/format.ts';
import { buildOverviewVM } from '../../../app/src/views/overview.ts';
import { sampleReview } from '../../helpers/sample-review.ts';
import { excelText } from '../../helpers/excel-text.ts';

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

describe('half-way values, Excel and the legacy rule', () => {
  test('half up on the 15-digit decimal, as Excel: 1.005, 0.145, 2.675, 35.675 and -1.005', () => {
    assert.equal(formatIndian(1.005), '1.01');
    assert.equal(formatIndian(0.145), '0.15');
    assert.equal(formatIndian(2.675), '2.68');
    assert.equal(formatIndian(1.115), '1.12');
    // Hybrid in family-a: (0.5427 - 0.4) / 0.4 * 100 = 35.67499999999998 in binary, 35.6750000000000 to 15 digits.
    const hybrid = (0.5427 - 0.4) / 0.4 * 100;
    assert.equal(hybrid, 35.67499999999998);
    assert.equal(formatIndian(hybrid), '35.68');
    assert.equal(displayPct(present(hybrid, 'pct', PROV)).text, '35.68%');
    assert.equal(formatIndian(-1.005), '-1.01');
    assert.equal(formatIndian(0.125), '0.13');
    assert.equal(displayPct(present(0.125, 'pct', PROV)).text, '0.13%');
    // One decimal (pie labels) and none (counts) round the same way.
    assert.equal(formatIndian(59.25, 1), '59.3');
    assert.equal(formatIndian(0.05, 1), '0.1');
    assert.equal(formatIndian(2.5, 0), '3');
    // A Crore amount of Rs 1,00,50,000 is 1.005 Cr.
    assert.equal(displayNumber(present(10050000 / 1e7, 'cr', PROV)).text, '1.01');
  });
  test('the zero-sign rule stays: a value that rounds to zero has no sign; a large value keeps its digits', () => {
    assert.equal(formatIndian(-0.004), '0.00');
    assert.equal(formatIndian(-0.005), '-0.01');
    assert.equal(formatIndian(0), '0.00');
    assert.equal(formatIndian(-0), '0.00');
    assert.equal(formatIndian(1e-7), '0.00');
    assert.equal(formatIndian(123456789.125), '12,34,56,789.13');
    assert.equal(formatIndian(99999.995), '1,00,000.00');
    assert.throws(() => formatIndian(Number.NaN), RangeError);
  });
  test('the formatter agrees with the independent Excel rule on 2,000 values and every half-way cent below 100', () => {
    let seed = 7;
    const next = (): number => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    const xs: number[] = [];
    for (let i = 0; i < 2000; i++) xs.push((next() - 0.3) * 10 ** Math.floor(next() * 9));
    for (let c = 0; c < 10000; c++) xs.push((c + 0.5) / 100, -(c + 0.5) / 100);
    for (const x of xs) {
      assert.equal(formatIndian(x), excelText(x, 2), String(x));
      assert.equal(formatIndian(x, 1), excelText(x, 1), String(x));
    }
  });
  test('the legacy unrounded values give the same text through the new formatter (P-09)', () => {
    const vm = buildOverviewVM(sampleReview('standard'));
    const values = figures(vm).map((f) => f.value).filter((v): v is Extract<Value<number>, { kind: 'value' }> => v.kind === 'value');
    assert.ok(values.length > 40);
    for (const v of values) {
      if (v.unit === 'count') continue;
      assert.equal(displayNumber(v).text, legacy2(v.v), String(v.v));
    }
    for (const x of [17.649122807017545, 0.503, 0.5030000000000001, 1.5281173594132031, 13.814180929095354, 4.35, 8.345]) {
      assert.equal(formatIndian(x), legacy2(x), String(x));
    }
  });
  test('at half-way values the legacy rule rounds down on the binary value; the new display rounds as Excel', () => {
    for (const [x, legacy, excel] of [[0.145, '0.14', '0.15'], [(0.5427 - 0.4) / 0.4 * 100, '35.67', '35.68'], [1.005, '1.00', '1.01']] as const) {
      assert.equal(legacy2(x), legacy, String(x));
      assert.equal(formatIndian(x), excel, String(x));
      assert.equal(excelText(x, 2), excel, String(x));
    }
  });
});
