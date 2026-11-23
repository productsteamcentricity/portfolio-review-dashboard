// covers: E-52
// Table pagination (deck-design-system.md §7; KI-122 rule): measured row heights, the header and the Grand Total
// on every page, "(n/N)" titles, no asset row ending a page, nothing below 495 pt; continuation pages carry the
// "(continued)" label at y 76 and the table from y 101.5, with no KPIs or charts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginateRows } from '../../../app/src/exports/pptx/paginate.ts';
import { cambria, measureFrom } from '../../../app/src/exports/pptx/measure.ts';
import type { AllocationRow } from '../../../app/src/views/overview-vm.ts';
import { shapeNamed, type Slide } from '../../helpers/slide-inventory.ts';
import { buildDeck, manyProductsVM, standardVM } from './sample-vm.ts';

const r = (kind: AllocationRow['kind'], label: string): AllocationRow => ({ kind, label } as AllocationRow);
const labels = (pages: ReturnType<typeof paginateRows>): string[][] => pages.map((p) => p.rows.map((x) => x.label));

test('rows fill a page up to its room; the total closes every page', () => {
  // Room 45, header 5, total 10: 30 pt of body rows per page, three rows of 10.
  const rows = [r('asset', 'A'), r('product', 'a1'), r('product', 'a2'), r('asset', 'B'), r('product', 'b1'), r('product', 'b2'), r('total', 'T')];
  const pages = paginateRows(rows, rows.map(() => 10), { top: 0, bottom: 45 }, { top: 0, bottom: 45 }, 5);
  assert.deepEqual(labels(pages), [['A', 'a1', 'a2', 'T'], ['B', 'b1', 'b2', 'T']]);
  assert.deepEqual(pages.map((p) => p.continued), [false, true]);
});

test('an asset row never ends a page while rows follow it', () => {
  // Three rows fit; the third would be the asset row B, so B moves to the next page with its products.
  const rows = [r('asset', 'A'), r('product', 'a1'), r('asset', 'B'), r('product', 'b1'), r('product', 'b2'), r('total', 'T')];
  const pages = paginateRows(rows, rows.map(() => 10), { top: 0, bottom: 45 }, { top: 0, bottom: 45 }, 5);
  assert.deepEqual(labels(pages), [['A', 'a1', 'T'], ['B', 'b1', 'b2', 'T']]);
});

test('the first page and later pages have their own room', () => {
  // First page: 60 - 20 - 5 - 10 = 25 pt (two rows of 10); later pages 60 - 0 - 5 - 10 = 45 pt (four rows).
  const rows = [r('asset', 'A'), ...['1', '2', '3', '4', '5'].map((x) => r('product', x)), r('total', 'T')];
  const pages = paginateRows(rows, rows.map(() => 10), { top: 20, bottom: 60 }, { top: 0, bottom: 60 }, 5);
  assert.deepEqual(labels(pages), [['A', '1', 'T'], ['2', '3', '4', '5', 'T']]);
});

test('a row taller than a page gets a page of its own; no total and no rows are handled; bad input is refused', () => {
  const rows = [r('product', 'x'), r('product', 'tall'), r('product', 'y')];
  assert.deepEqual(labels(paginateRows(rows, [10, 100, 10], { top: 0, bottom: 40 }, { top: 0, bottom: 40 }, 5)), [['x'], ['tall'], ['y']]);
  assert.deepEqual(labels(paginateRows([r('total', 'T')], [10], { top: 0, bottom: 40 }, { top: 0, bottom: 40 }, 5)), [['T']]);
  assert.throws(() => paginateRows(rows, [10], { top: 0, bottom: 40 }, { top: 0, bottom: 40 }, 5), /3 rows but 1 heights/);
  assert.throws(() => paginateRows([r('total', 'T'), r('total', 'U')], [1, 1], { top: 0, bottom: 40 }, { top: 0, bottom: 40 }, 5), /more than one total/);
});

test('measured widths: Cambria digits are 0.5537 em; a long label wraps; the fallback is the widest letter', () => {
  // '1.80' at 9 pt: 3 digits x 553.71 + '.' 205.08 = 1866.21 units of 1/1000 em, x 9 / 1000 = 16.796 pt.
  assert.ok(Math.abs(cambria.width('1.80', 9, false) - 16.79589) < 1e-4);
  assert.equal(cambria.lines('Mutual Funds', 9, false, 161), 1);
  assert.equal(cambria.lines('Sample Equity Product 5 With A Long Name That Wraps Onto A Second Line', 9, false, 161), 2);
  const m = measureFrom({ unitsPerEm: 1000, fallback: { regular: 1000, bold: 1000 }, regular: { 32: 250, 97: 500 }, bold: {} });
  assert.equal(m.width('a a', 10, false), 12.5); // 500 + 250 + 500 = 1250 units at 10 pt
  assert.equal(m.width('\u0100', 10, false), 10); // not listed: the fallback
  assert.equal(m.lines('aaaa', 10, false, 10), 2); // a word wider than the box breaks between characters
  assert.equal(m.lines('a a a', 10, false, 12.5), 2); // 'a a' fits exactly, the third word wraps
  assert.equal(m.lines('a\na', 10, false, 100), 2);
});

test('a 30-row view-model paginates: header and Grand Total on every page, (n/N), nothing below 495', async () => {
  const vm = manyProductsVM(5, 5); // 5 asset rows + 25 product rows + the Grand Total
  const body = vm.allocation.rows.filter((x) => x.kind !== 'total').map((x) => x.label);
  assert.equal(body.length, 30);
  const { inv, c08 } = await buildDeck(vm);
  const n = inv.slides.length;
  assert.ok(n >= 2, `${n} pages`);
  assert.equal(c08.pages, n);
  const seen: string[] = [];
  for (const s of inv.slides) {
    assert.equal(shapeNamed(s, 'chrome title').text, `ASSET ALLOCATION (${s.index}/${n})`);
    const t = s.tables[0];
    assert.ok(t && s.tables.length === 1);
    const first = t.rows[0]!;
    assert.deepEqual(first.cells.map((c) => c.text), ['Asset Class', 'Investment Amount (Cr.)', 'Current Market Value (Cr.)', '% CMV']);
    assert.ok(first.cells.every((c) => c.fill === '000000'));
    const last = t.rows[t.rows.length - 1]!;
    assert.equal(last.cells[0]!.text, 'Grand Total');
    assert.deepEqual(last.cells.slice(1).map((c) => c.text), ['2.00', '2.50', '100.00%']);
    const lastBody = t.rows[t.rows.length - 2]!;
    if (s.index < n) assert.notEqual(lastBody.cells[0]!.fill, 'BFBFBF', `page ${s.index} ends with an asset row`);
    const bottom = t.y + t.rows.reduce((a, x) => a + x.h, 0);
    assert.ok(bottom <= 495 + 0.05, `page ${s.index}: table bottom ${bottom}`);
    near(t.h, t.rows.reduce((a, x) => a + x.h, 0));
    seen.push(...t.rows.slice(1, -1).map((x) => x.cells[0]!.text));
    if (s.index === 1) {
      near(t.y, 168.5);
      assert.equal(s.charts.length, 2);
    } else {
      near(t.y, 101.5);
      const label = shapeNamed(s, 'C-08 section label');
      assert.equal(label.text, 'Allocation by Asset Class & Product (continued)');
      near(label.y, 76);
      assert.equal(s.charts.length, 0);
      assert.ok(!s.shapes.some((x) => / kpi | panel/.test(x.name)), 'no KPIs or chart panels on a continuation page');
    }
  }
  assert.deepEqual(seen, body, 'every row once, in order');
});

test('row heights are measured: one line is 16.8 pt, a wrapped label 27.6 pt', async () => {
  const { inv } = await buildDeck(manyProductsVM(5, 5));
  const t = inv.slides[0]!.tables[0]!;
  // Header: 'Current Market Value (Cr.)' bold 9 pt wraps in a 109 pt column: 2 x 10.8 + 6 = 27.6.
  near(t.rows[0]!.h, 27.6);
  near(t.rows[1]!.h, 16.8); // 1 x 10.8 + 6
  const long = t.rows.find((x) => /Long Name/.test(x.cells[0]!.text));
  assert.ok(long);
  near(long.h, 27.6);
});

test('the standard sample fits on one page', async () => {
  const { inv } = await buildDeck(standardVM());
  assert.equal(inv.slides.length, 1);
  assert.equal(shapeNamed(inv.slides[0] as Slide, 'chrome title').text, 'ASSET ALLOCATION');
});

function near(a: number, b: number): void {
  assert.ok(Math.abs(a - b) <= 0.05, `${a} is not ${b}`);
}
