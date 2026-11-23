// covers: E-18
// Liquidity (engine/classify/liquidity.ts, computeLiquidity): the legacy rule ported as it is, checked case by case
// against the legacy function itself (index.html 07_engine.js:607-615, cut out of the engine block by anchor), and the
// file's labels winning when the file has any.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import type { Holding } from '../../../app/src/model/holding.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import type { Value } from '../../../app/src/model/value.ts';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import { computeTotals } from '../../../app/src/engine/aggregate/totals.ts';
import { computeLiquidity } from '../../../app/src/engine/aggregate/allocation.ts';
import { liquidityClass, liquidityLabel } from '../../../app/src/engine/classify/liquidity.ts';
import { indexHtmlBlocks, loadSheetJS } from '../../helpers/sheetjs.ts';
import { overviewVariants, SYNTHETIC_BOOK, syntheticFixtures } from '../../fixtures/make-books.ts';

const xlsx = loadSheetJS();
const SRC = 'e'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-10-24T00:00:00.000Z';
const FIX = new Map([...syntheticFixtures(xlsx), ...overviewVariants(xlsx, SYNTHETIC_BOOK, 'syn')].map((f) => [f.id, f]));
const holdingsOf = (id: string): Holding[] =>
  parseBaseFile(readWorkbook(xlsx, FIX.get(id)!.bytes), { sourceId: SRC, now: NOW }).holdings;
const liqOf = (id: string) => { const hs = holdingsOf(id); return computeLiquidity(hs, computeTotals(hs)); };
const v = (x: Value<number>): number | null => (x.kind === 'value' ? x.v : null);
const close = (a: number | null, b: number, msg = ''): void => {
  assert.ok(a !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${msg} ${a} != ${b}`);
};

/** The legacy liquidityClass, cut out of the engine block of index.html by its anchors (read only, never run on the page). */
function legacyLiquidityClass(): (p: unknown, c: unknown) => string {
  const engine = indexHtmlBlocks().find((b) => /Pure compute \+ PPTX\/XLSX builders/.test(b.slice(0, 900)));
  assert.ok(engine, 'engine block found');
  const start = engine.indexOf('function liquidityClass(prod, cat){');
  const end = engine.indexOf('/* ---------- direct-equity helpers', start);
  assert.ok(start > 0 && end > start, 'anchors found once');
  const sandbox: Record<string, unknown> = {};
  vm.createContext(sandbox);
  vm.runInContext(`${engine.slice(start, end)}\nthis.liquidityClass = liquidityClass;`, sandbox);
  return sandbox.liquidityClass as (p: unknown, c: unknown) => string;
}

const CASES: Array<[string | null, string | null, 'Open Ended' | 'Close Ended']> = [
  ['AIF', 'Category II', 'Close Ended'],
  ['Unlisted Shares', 'Equity', 'Close Ended'],
  ['Pre-IPO Shares', null, 'Close Ended'],
  ['pre ipo', null, 'Close Ended'],
  ['Mutual Funds', 'Interval Fund', 'Close Ended'],
  ['Mutual Funds', 'FMP Series 12', 'Close Ended'],
  ['Mutual Funds', 'Fixed Maturity Plan', 'Close Ended'],
  ['Mutual Funds', 'Solution Oriented', 'Close Ended'],
  ['Mutual Funds', "Children's Fund", 'Close Ended'],
  ['Mutual Funds', 'Retirement Plan', 'Close Ended'],
  ['Mutual Funds', 'Close Ended Scheme', 'Close Ended'],
  ['Mutual Funds', 'ELSS', 'Open Ended'],
  ['Mutual Funds', 'Large Cap Fund', 'Open Ended'],
  ['PMS', 'Multi Cap', 'Open Ended'],
  ['Listed Shares', null, 'Open Ended'],
  [null, null, 'Open Ended'],
];

describe('liquidityClass, the legacy rule ported as it is', () => {
  test('the rule cases: AIF, unlisted, pre-IPO, interval, FMP, solution, children, retirement, and the open ones', () => {
    for (const [p, c, want] of CASES) assert.equal(liquidityClass(p, c), want, `${p} / ${c}`);
  });
  test('it gives the same answer as the legacy function on every case', () => {
    const legacy = legacyLiquidityClass();
    for (const [p, c] of CASES) assert.equal(liquidityClass(p, c), legacy(p ?? '', c ?? ''), `${p} / ${c}`);
  });
  test('a file label wins only when the file has labels; a blank takes the rule', () => {
    const h = holdingsOf('syn-standard')[0]!;
    assert.equal(liquidityLabel({ ...h, liquidity: 'Daily' }, true), 'Daily');
    assert.equal(liquidityLabel({ ...h, liquidity: null }, true), 'Open Ended');
    assert.equal(liquidityLabel({ ...h, liquidity: 'Daily' }, false), 'Open Ended');
  });
});

describe('computeLiquidity', () => {
  test('syn-standard: the rule, Open Ended 100 %', () => {
    const l = liqOf('syn-standard');
    assert.equal(l.basis, 'rule');
    assert.deepEqual(l.lines.map((x) => x.label), ['Open Ended']);
    assert.equal(v(l.lines[0]!.pct), 100);
  });
  test('liquidity-labels: the file labels in first appearance, the blanks by the rule', () => {
    const l = liqOf('syn-liquidity-labels');
    assert.equal(l.basis, 'file-labels');
    assert.deepEqual(l.lines.map((x) => x.label), ['Daily', 'T+3', 'Open Ended']);
    // Daily: 0.625 + 0.131 = 0.756; T+3: 0.452 + 0.339 = 0.791; the rule: 0.896 + 0.91 = 1.806 (of 3.353).
    close(v(l.lines[0]!.cmv), 0.756);
    close(v(l.lines[0]!.pct), 22.546972860125262);
    close(v(l.lines[1]!.pct), 23.59081419624217);
    close(v(l.lines[2]!.pct), 53.86221294363257);
  });
  test('many-products: the AIF products are Close Ended, after Open Ended', () => {
    const l = liqOf('syn-many-products');
    assert.deepEqual(l.lines.map((x) => x.label), ['Open Ended', 'Close Ended']);
    const hs = holdingsOf('syn-many-products');
    const closed = hs.filter((h) => /AIF/.test(h.product)).map((h) => h.id);
    assert.deepEqual(l.lines[1]!.holdingIds, closed);
  });
  test('a line with a CMV of 0 is left out (no slice), as the legacy pie does', () => {
    const hs = holdingsOf('syn-standard').map((h, i) => (i === 5 ? { ...h, product: 'AIF', cmv: { ...h.cmv, v: 0 } as Holding['cmv'] } : h));
    const l = computeLiquidity(hs, computeTotals(hs));
    assert.deepEqual(l.lines.map((x) => x.label), ['Open Ended']);
  });
  test('hostile labels such as "__proto__", "constructor" and "hasOwnProperty" are ordinary lines', () => {
    const l = liqOf('syn-hostile');
    assert.deepEqual(l.lines.map((x) => x.label), ['__proto__', 'constructor', 'Daily', 'hasOwnProperty', 'T+3']);
    close(v(l.lines[2]!.cmv), 0.896 + 0.339);
    assert.equal(Object.keys(Object.prototype).length, 0);
  });
});
