// covers: E-22 OD-7 OD-18 KI-007
// The asset allocation (engine/aggregate/allocation.ts) on the synthetic book: one asset order, Unknown never Equity,
// products by CMV, the same-holdings rule on every line. Known answers worked out by hand from the book's rupee values
// (tests/fixtures/make-books.ts SYNTHETIC_BOOK; tests/fixtures/overview-answers.ts), never from the code under test.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Holding } from '../../../app/src/model/holding.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import type { Value } from '../../../app/src/model/value.ts';
import type { AllocationLine } from '../../../app/src/model/review.ts';
import { ASSET_ORDER } from '../../../app/src/model/review.ts';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import { computeTotals } from '../../../app/src/engine/aggregate/totals.ts';
import { computeAssetAllocation } from '../../../app/src/engine/aggregate/allocation.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { MANY_PRODUCTS, overviewVariants, SYNTHETIC_BOOK, syntheticFixtures } from '../../fixtures/make-books.ts';
import { OVERVIEW_ANSWERS } from '../../fixtures/overview-answers.ts';

const xlsx = loadSheetJS();
const SRC = 'e'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-10-24T00:00:00.000Z';
const FIX = new Map([...syntheticFixtures(xlsx), ...overviewVariants(xlsx, SYNTHETIC_BOOK, 'syn')].map((f) => [f.id, f]));
const holdingsOf = (id: string): Holding[] => {
  const f = FIX.get(id);
  if (!f) throw new Error(`no fixture ${id}`);
  return parseBaseFile(readWorkbook(xlsx, f.bytes), { sourceId: SRC, now: NOW }).holdings;
};
const allocOf = (id: string) => { const hs = holdingsOf(id); return computeAssetAllocation(hs, computeTotals(hs)); };
const v = (x: Value<number>): number | null => (x.kind === 'value' ? x.v : null);
const st = (x: Value<number>): string | null => (x.kind === 'missing' ? x.status : null);
const close = (a: number | null | undefined, b: number, msg = ''): void => {
  assert.ok(typeof a === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${msg} ${a} != ${b}`);
};
const line = (l: AllocationLine): [string, number | null, number | null, number | null] => [l.label, v(l.cmv), v(l.invested), v(l.pct)];

describe('asset allocation', () => {
  test('syn-standard: the classes in order, products by CMV, percentages of the total CMV, unrounded', () => {
    const a = allocOf('syn-standard');
    assert.deepEqual(a.assets.map((b) => b.asset), ['Equity', 'Debt', 'Hybrid', 'Commodity']);
    const [eq, debt, hybrid, commodity] = a.assets;
    close(v(eq!.line.cmv), 1.987);
    close(v(eq!.line.invested), 1.65);
    close(v(eq!.line.pct), 59.26036385326573);
    assert.deepEqual(eq!.products.map((p) => p.label), ['Mutual Funds', 'PMS']);
    close(v(eq!.products[0]!.cmv), 1.077);
    close(v(eq!.products[0]!.pct), 32.12048911422606);
    close(v(eq!.products[1]!.cmv), 0.91);
    close(v(eq!.products[1]!.pct), 27.139874739039666);
    close(v(debt!.line.pct), 26.722338204592898);
    close(v(hybrid!.line.pct), 10.110348941246645);
    close(v(commodity!.line.pct), 3.9069490008947207);
    close(v(a.total.cmv), 3.353);
    assert.equal(v(a.total.pct), 100);
    assert.equal(a.total.label, 'Grand Total');
    assert.deepEqual(a.unknownLabels, []);
    assert.deepEqual(eq!.line.holdingIds.length, 3);
    assert.equal(eq!.line.key, 'asset:Equity');
    assert.equal(eq!.products[1]!.key, 'product:Equity:PMS');
  });
  test('syn-all-classes: every class in the one order, Unknown last with the label read ("" for blank), never Equity', () => {
    const a = allocOf('syn-all-classes');
    assert.deepEqual(a.assets.map((b) => b.asset), [...ASSET_ORDER]);
    const pct = a.assets.map((b) => v(b.line.pct));
    [19.101466992665035, 27.383863080684602, 10.360635696821516, 1.5281173594132031, 13.814180929095354, 27.811735941320293]
      .forEach((x, i) => close(pct[i], x, ASSET_ORDER[i]));
    assert.deepEqual(a.unknownLabels, ['']);
    assert.deepEqual(a.assets[5]!.products.map((p) => p.label), ['PMS'], 'the PMS with a blank Asset Name is Unknown, not Equity');
    close(pct.reduce((s, x) => s! + x!, 0), 100);
  });
  test('syn-blank-invested: the same-holdings rule per line; a class without any invested value is NOT AVAILABLE', () => {
    const a = allocOf('syn-blank-invested');
    const eq = a.assets[0]!.line;
    close(v(eq.invested), 1.15);
    close(v(eq.gain), 0.212);
    close(v(eq.investedCoveragePct), 68.54554604932058);
    close(eq.invested.kind === 'value' ? eq.invested.coverage : null, 0.6854554604932058);
    assert.equal(eq.withoutInvested, 1);
    const debt = a.assets[1]!.line;
    assert.equal(st(debt.invested), STATUS.NOT_AVAILABLE);
    assert.equal(st(debt.gain), STATUS.NOT_AVAILABLE);
    assert.equal(v(debt.investedCoveragePct), 0);
    close(v(debt.cmv), 0.896);
    const pms = a.assets[0]!.products[1]!;
    assert.ok(pms.invested.kind === 'value' && pms.invested.coverage === undefined, 'a complete product carries no coverage');
  });
  test('syn-money-columns: a class whose only invested value is invalid shows INVALID SOURCE DATA; PMS now above Mutual Funds', () => {
    const a = allocOf('syn-money-columns');
    const commodity = a.assets.find((b) => b.asset === 'Commodity')!.line;
    assert.equal(st(commodity.invested), STATUS.INVALID_SOURCE);
    assert.deepEqual(a.assets[0]!.products.map((p) => p.label), ['PMS', 'Mutual Funds']);
  });
  test('syn-zero-cmv: a class with a CMV of 0 has a 0 % share and no coverage percent (NOT APPLICABLE)', () => {
    const c = allocOf('syn-zero-cmv').assets.find((b) => b.asset === 'Commodity')!.line;
    assert.equal(v(c.cmv), 0);
    assert.equal(v(c.pct), 0);
    assert.equal(st(c.investedCoveragePct), STATUS.NOT_APPLICABLE);
    close(v(c.gain), -0.1);
  });
  test('many-products: 18 products in 5 classes, each class by CMV highest first', () => {
    const a = allocOf('syn-many-products');
    assert.equal(a.assets.reduce((s, b) => s + b.products.length, 0), 18);
    assert.deepEqual(a.assets.map((b) => b.asset), ['Equity', 'Debt', 'Hybrid', 'Commodity', 'REITs/InvITs']);
    for (const b of a.assets) {
      const c = b.products.map((p) => v(p.cmv)!);
      assert.deepEqual(c, [...c].sort((x, y) => y - x), b.asset);
      assert.deepEqual(new Set(b.products.map((p) => p.label)), new Set(MANY_PRODUCTS.filter(([x]) => x === b.asset).map(([, p]) => p)));
    }
  });
  test('equal CMVs keep their first appearance', () => {
    const hs = holdingsOf('syn-standard').map((h, i) => (i < 2 ? { ...h, product: i === 0 ? 'Zeta' : 'Alpha', cmv: { ...h.cmv, v: 0.5 } as Holding['cmv'] } : h));
    const a = computeAssetAllocation(hs, computeTotals(hs));
    assert.deepEqual(a.assets[0]!.products.map((p) => p.label), ['PMS', 'Zeta', 'Alpha']);
  });
  test('hostile: Asset Names "constructor" and "__proto__" are Unknown, and no object prototype is touched', () => {
    const a = allocOf('syn-hostile');
    assert.deepEqual(a.assets.at(-1)!.asset, 'Unknown');
    assert.deepEqual(a.unknownLabels, ['constructor', '__proto__']);
    assert.deepEqual(a.assets.find((b) => b.asset === 'Unknown')!.products.map((p) => p.label).sort(), [': / ? * [ ]', 'Mutual Funds']);
    assert.equal(({} as Record<string, unknown>).cmv, undefined);
    assert.equal(Object.keys(Object.prototype).length, 0);
  });
  test('the known answers: every line of OVERVIEW_ANSWERS', () => {
    for (const [id, ans] of Object.entries(OVERVIEW_ANSWERS)) {
      const a = allocOf(id);
      const lines = [...a.assets.flatMap((b) => [b.line, ...b.products]), a.total];
      assert.deepEqual(lines.map((l) => l.label), ans.rows.map((r) => r.label), id);
      ans.rows.forEach((r, i) => {
        const l = lines[i]!;
        close(v(l.cmv), r.cmv, `${id} ${r.label} cmv`);
        close(v(l.pct), r.pct, `${id} ${r.label} pct`);
        if (r.invested === null) assert.equal(st(l.invested), r.investedStatus ?? STATUS.NOT_AVAILABLE, `${id} ${r.label}`);
        else close(v(l.invested), r.invested, `${id} ${r.label} invested`);
        if (r.gain === null) assert.equal(l.gain.kind, 'missing');
        else close(v(l.gain), r.gain, `${id} ${r.label} gain`);
        assert.equal(l.invested.kind === 'value' && l.invested.coverage !== undefined, r.shown.invested.marker === 'p', `${id} ${r.label} partial`);
      });
      assert.deepEqual(a.unknownLabels, ans.unknownLabels, id);
      assert.deepEqual(line(a.total).slice(0, 2), ['Grand Total', v(a.total.cmv)]);
    }
  });
});
