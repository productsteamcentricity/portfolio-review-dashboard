// covers: E-148 KI-006 (direct-equity CAGR from adjusted month-end prices, D-023 point 4; contract I-31)
// Known answers (docs/new-build/08-regression-test-plan.md, unit/returns/stock-cagr.test.ts): prices 100 then 110 one
// year later give 1Y 10.00%; 100 then 133.10 three years later give 3Y 10.00%; 100 then 161.051 five years later give
// 5Y 10.00%; a split-adjusted series gives the same CAGR as the unsplit one; an anniversary on a holiday takes the
// nearest earlier price within 7 days, a longer gap makes the tenor missing; an as-on of 29 Feb 2028 uses 28 Feb 2025
// for 3Y; a stock listed 26 months ago has 1Y but no 3Y or 5Y (INSUFFICIENT EVIDENCE, never 0%); the analyst's price
// file fills a stock the pack lacks, labelled with its source. Synthetic ISINs only.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { anniversary, directEquityCagr, priceOnOrBefore, stockCagr, PRICE_LOOKBACK_DAYS, type PricePoint, type PriceSource, type StockHoldingInput } from '../../../app/src/engine/returns/stock-cagr.ts';
import type { HoldingId } from '../../../app/src/model/ids.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import { dayToIso, ymdToDay } from '../../../app/src/engine/dates.ts';

const D = (y: number, m: number, d: number) => ymdToDay(y, m, d)!;
const AS_ON = D(2026, 10, 31);
const v = (x: { kind: string; v?: number }): number | null => (x.kind === 'value' ? x.v! : null);
const near = (a: number | null, b: number): void => assert.ok(a !== null && Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const status = (x: { kind: string; status?: string }) => (x.kind === 'missing' ? x.status : null);
const pts = (...xs: Array<[number, number]>): PricePoint[] => xs.map(([day, price]) => ({ day, price }));

describe('one stock (D-023 point 4)', () => {
  test('1Y, 3Y and 5Y known answers of 10.00%', () => {
    const s = pts([D(2021, 10, 31), 100], [D(2023, 10, 31), 100], [D(2025, 10, 31), 100], [AS_ON, 110]);
    near(v(stockCagr(s, AS_ON, '1y')), 10);
    near(v(stockCagr(pts([D(2023, 10, 31), 100], [AS_ON, 133.1]), AS_ON, '3y')), 10);
    near(v(stockCagr(pts([D(2021, 10, 31), 100], [AS_ON, 161.051]), AS_ON, '5y')), 10);
  });
  test('a split-adjusted series gives the same CAGR as the unsplit one', () => {
    // a 1:2 split in 2025: the adjusted series halves every price before it
    const unsplit = pts([D(2023, 10, 31), 100], [D(2024, 10, 31), 115], [AS_ON, 133.1]);
    const adjusted = pts([D(2023, 10, 31), 50], [D(2024, 10, 31), 57.5], [AS_ON, 66.55]);
    near(v(stockCagr(adjusted, AS_ON, '3y')), v(stockCagr(unsplit, AS_ON, '3y'))!);
    near(v(stockCagr(adjusted, AS_ON, '3y')), 10);
  });
  test('an anniversary on a holiday takes the nearest earlier price within 7 days', () => {
    // 31 Oct 2025 had no price; 29 Oct 2025 (2 days earlier) does
    near(v(stockCagr(pts([D(2025, 10, 29), 100], [AS_ON, 110]), AS_ON, '1y')), 10);
    // exactly 7 days earlier is accepted, 8 days is not
    near(v(stockCagr(pts([D(2025, 10, 24), 100], [AS_ON, 110]), AS_ON, '1y')), 10);
    const gap = stockCagr(pts([D(2025, 9, 15), 90], [D(2025, 10, 23), 100], [AS_ON, 110]), AS_ON, '1y');
    assert.equal(status(gap), STATUS.NOT_AVAILABLE);
    assert.equal(PRICE_LOOKBACK_DAYS, 7);
  });
  test('a later price is never taken for an anniversary', () => {
    const r = stockCagr(pts([D(2024, 1, 31), 80], [D(2025, 11, 1), 100], [AS_ON, 110]), AS_ON, '1y');
    assert.equal(status(r), STATUS.NOT_AVAILABLE);
  });
  test('the as-on price follows the same rule', () => {
    near(v(stockCagr(pts([D(2025, 10, 31), 100], [D(2026, 10, 30), 110]), AS_ON, '1y')), 10);
    const r = stockCagr(pts([D(2025, 10, 31), 100], [D(2026, 10, 20), 110]), AS_ON, '1y');
    assert.equal(status(r), STATUS.NOT_AVAILABLE);
  });
  test('an as-on of 29 Feb 2028 uses 28 Feb 2025 for 3Y', () => {
    assert.equal(dayToIso(anniversary(D(2028, 2, 29), 3)), '2025-02-28');
    assert.equal(dayToIso(anniversary(D(2028, 2, 29), 4)), '2024-02-29');
    assert.equal(dayToIso(anniversary(D(2026, 10, 31), 5)), '2021-10-31');
    const s = pts([D(2025, 2, 28), 100], [D(2028, 2, 29), 133.1]);
    near(v(stockCagr(s, D(2028, 2, 29), '3y')), 10);
  });
  test('listed 26 months ago: 1Y present, 3Y and 5Y INSUFFICIENT EVIDENCE, never 0%', () => {
    const listed = D(2024, 8, 31);
    const s = pts([listed, 80], [D(2025, 10, 31), 100], [AS_ON, 110]);
    near(v(stockCagr(s, AS_ON, '1y')), 10);
    assert.equal(status(stockCagr(s, AS_ON, '3y')), STATUS.INSUFFICIENT_EVIDENCE);
    assert.equal(status(stockCagr(s, AS_ON, '5y')), STATUS.INSUFFICIENT_EVIDENCE);
    assert.match((stockCagr(s, AS_ON, '3y') as { reason: string }).reason, /start on 2024-08-31, after 2023-10-31/);
  });
  test('points in any order; a falling price gives a negative CAGR', () => {
    near(v(stockCagr(pts([AS_ON, 81], [D(2025, 10, 31), 100]), AS_ON, '1y')), (81 / 100 - 1) * 100);
    near(v(stockCagr(pts([AS_ON, 81], [D(2023, 10, 31), 100]), AS_ON, '3y')), (Math.cbrt(0.81) - 1) * 100);
  });
  test('an empty series, a bad price, a day twice', () => {
    assert.equal(status(stockCagr([], AS_ON, '1y')), STATUS.NOT_AVAILABLE);
    assert.equal(status(stockCagr(pts([D(2025, 10, 31), 0], [AS_ON, 110]), AS_ON, '1y')), STATUS.INVALID_SOURCE);
    assert.equal(status(stockCagr(pts([D(2025, 10, 31), Number.NaN], [AS_ON, 110]), AS_ON, '1y')), STATUS.INVALID_SOURCE);
    assert.equal(status(stockCagr(pts([AS_ON, 100], [AS_ON, 110]), AS_ON, '1y')), STATUS.INVALID_SOURCE);
  });
  test('priceOnOrBefore', () => {
    const s = pts([10, 1], [20, 2], [30, 3]);
    assert.deepEqual(priceOnOrBefore(s, 20), { day: 20, price: 2 });
    assert.deepEqual(priceOnOrBefore(s, 27), { day: 20, price: 2 });
    assert.equal(priceOnOrBefore(s, 28), null);
    assert.equal(priceOnOrBefore(s, 9), null);
    assert.deepEqual(priceOnOrBefore(s, 37), { day: 30, price: 3 });
  });
});

describe('the direct-equity portfolio (E-148)', () => {
  const P = { sources: [], method: 'test' };
  const sh = (id: string, isin: string | null, cmv: number): StockHoldingInput => ({ holdingId: id as HoldingId, isin, cmvCr: present(cmv, 'cr', P) });
  const tenPct3y = pts([D(2023, 10, 31), 100], [AS_ON, 133.1]);
  const twentyPct3y = pts([D(2023, 10, 31), 100], [AS_ON, 172.8]);
  const file: PriceSource = { source: 'analyst-price-file', series: { INE000SAMPLE1: tenPct3y, INE000SAMPLE2: twentyPct3y }, sourceIds: ['sha-file'] };

  test('stocks at 60% and 40% with 3Y 10% and 20%: 14.00%', () => {
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6), sh('s2', 'INE000SAMPLE2', 4)], [file], AS_ON, '3y', 'family');
    near(v(r.figure.value), 14);
    assert.deepEqual(r.figure.coverage, { share: 1, basis: 'equity-value', included: 2, excluded: 0 });
    assert.equal(r.figure.source, 'analyst-price-file');
    near(v(r.lines[1]!.cagr), 20);
  });
  test('the 40% stock without 3Y history: 10.00% at 60% coverage, not 6.00%', () => {
    const young = pts([D(2025, 1, 31), 100], [AS_ON, 120]);
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6), sh('s2', 'INE000SAMPLE3', 4)], [{ ...file, series: { ...file.series, INE000SAMPLE3: young } }], AS_ON, '3y', 'family');
    near(v(r.figure.value), 10);
    assert.deepEqual(r.figure.coverage, { share: 0.6, basis: 'equity-value', included: 1, excluded: 1 });
    assert.equal(status(r.lines[1]!.cagr), STATUS.INSUFFICIENT_EVIDENCE);
    assert.deepEqual(r.items.map((i) => i.excluded), [null, 'no-return']);
  });
  test('the analyst file fills a stock the pack lacks, labelled with its source', () => {
    const pack: PriceSource = { source: 'screener-pack', series: { INE000SAMPLE1: tenPct3y }, sourceIds: ['sha-pack'] };
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6), sh('s2', 'INE000SAMPLE2', 4)], [pack, file], AS_ON, '3y', 'family');
    near(v(r.figure.value), 14);
    assert.deepEqual(r.lines.map((l) => l.source), ['screener-pack', 'analyst-price-file']);
    assert.equal(r.figure.source, 'screener-pack');
    assert.deepEqual(r.figure.value.kind === 'value' && r.figure.value.prov.sources, ['sha-pack', 'sha-file']);
  });
  test('a stock without an ISIN or without a series is excluded and counted, never 0%', () => {
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6), sh('s2', null, 2), sh('s3', 'INE000NOPRICE', 2)], [file], AS_ON, '3y', 'family');
    near(v(r.figure.value), 10);
    assert.deepEqual(r.figure.coverage, { share: 0.6, basis: 'equity-value', included: 1, excluded: 2 });
    assert.deepEqual(r.items.map((i) => i.excluded), [null, 'unmatched', 'no-return']);
    assert.deepEqual(r.lines.map((l) => status(l.cagr)), [null, STATUS.NOT_AVAILABLE, STATUS.NOT_AVAILABLE]);
  });
  test('no price source at all: every stock excluded, the figure missing', () => {
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6)], [], AS_ON, '1y', 'family');
    assert.equal(status(r.figure.value), STATUS.NOT_AVAILABLE);
    assert.equal(r.figure.coverage.share, 0);
  });
  test('a holding without a value keeps its line but stays out of the base', () => {
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6), { holdingId: 's2' as HoldingId, isin: 'INE000SAMPLE2', cmvCr: missing(STATUS.NOT_AVAILABLE, 'x') }], [file], AS_ON, '3y', 'family');
    near(v(r.figure.value), 10);
    assert.deepEqual(r.figure.coverage, { share: 1, basis: 'equity-value', included: 1, excluded: 0 });
    near(v(r.lines[1]!.cagr), 20);
    assert.deepEqual(r.figure.value.kind === 'value' && r.figure.value.prov.sources, ['sha-file']);
  });
});
