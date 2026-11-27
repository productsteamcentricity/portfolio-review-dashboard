// covers: E-148 KI-006 (direct-equity CAGR from adjusted month-end prices, D-023 point 4; contract I-31)
// Known answers (docs/new-build/08-regression-test-plan.md, unit/returns/stock-cagr.test.ts): prices 100 then 110 one
// year later give 1Y 10.00%; 100 then 133.10 three years later give 3Y 10.00%; 100 then 161.051 five years later give
// 5Y 10.00%; a split-adjusted series gives the same CAGR as the unsplit one; an anniversary on a holiday takes the
// nearest earlier price within 7 days, a longer gap makes the tenor missing; an as-on of 29 Feb 2028 uses 28 Feb 2025
// for 3Y; a stock listed 26 months ago has 1Y but no 3Y or 5Y (INSUFFICIENT EVIDENCE, never 0%); the analyst's price
// file fills a stock the pack lacks, labelled with its source. Synthetic ISINs only.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { footnoteOf } from '../../../app/src/engine/returns/portfolio-returns.ts';
import { anniversary, directEquityCagr, isMonthEndSeries, priceOnOrBefore, stockCagr, PRICE_LOOKBACK_DAYS, type PricePoint, type PriceSource, type StockHoldingInput } from '../../../app/src/engine/returns/stock-cagr.ts';
import type { HoldingId } from '../../../app/src/model/ids.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import { dayToIso, ymdToDay } from '../../../app/src/engine/dates.ts';

const D = (y: number, m: number, d: number) => ymdToDay(y, m, d)!;
const AS_ON = D(2026, 10, 31);
const SRC_ON = present(AS_ON, 'date', { sources: [], method: 'test' });
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
  const file: PriceSource = { source: 'analyst-price-file', asOn: SRC_ON, series: { INE000SAMPLE1: tenPct3y, INE000SAMPLE2: twentyPct3y }, sourceIds: ['sha-file'] };

  test('stocks at 60% and 40% with 3Y 10% and 20%: 14.00%', () => {
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6), sh('s2', 'INE000SAMPLE2', 4)], [file], AS_ON, '3y', 'family');
    near(v(r.figure!.value), 14);
    assert.deepEqual(r.figure!.coverage, { share: 1, basis: 'equity-value', included: 2, excluded: 0 });
    assert.equal(r.figure!.source, 'analyst-price-file');
    near(v(r.lines[1]!.cagr), 20);
  });
  test('the 40% stock without 3Y history: 10.00% at 60% coverage, not 6.00%', () => {
    const young = pts([D(2025, 1, 31), 100], [AS_ON, 120]);
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6), sh('s2', 'INE000SAMPLE3', 4)], [{ ...file, series: { ...file.series, INE000SAMPLE3: young } }], AS_ON, '3y', 'family');
    near(v(r.figure!.value), 10);
    assert.deepEqual(r.figure!.coverage, { share: 0.6, basis: 'equity-value', included: 1, excluded: 1 });
    assert.equal(status(r.lines[1]!.cagr), STATUS.INSUFFICIENT_EVIDENCE);
    assert.deepEqual(r.items.map((i) => i.excluded), [null, 'no-return']);
  });
  test('the analyst file fills a stock the pack lacks, labelled with its source', () => {
    const pack: PriceSource = { source: 'screener-pack', asOn: SRC_ON, series: { INE000SAMPLE1: tenPct3y }, sourceIds: ['sha-pack'] };
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6), sh('s2', 'INE000SAMPLE2', 4)], [pack, file], AS_ON, '3y', 'family');
    near(v(r.figure!.value), 14);
    assert.deepEqual(r.lines.map((l) => l.source), ['screener-pack', 'analyst-price-file']);
    assert.equal(r.figure!.source, 'screener-pack');
    assert.deepEqual(r.figure!.value.kind === 'value' && r.figure!.value.prov.sources, ['sha-pack', 'sha-file']);
  });
  test('a stock without an ISIN or without a series is excluded and counted, never 0%', () => {
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6), sh('s2', null, 2), sh('s3', 'INE000NOPRICE', 2)], [file], AS_ON, '3y', 'family');
    near(v(r.figure!.value), 10);
    assert.deepEqual(r.figure!.coverage, { share: 0.6, basis: 'equity-value', included: 1, excluded: 2 });
    assert.deepEqual(r.items.map((i) => i.excluded), [null, 'unmatched', 'no-return']);
    assert.deepEqual(r.lines.map((l) => status(l.cagr)), [null, STATUS.NOT_AVAILABLE, STATUS.NOT_AVAILABLE]);
  });
  test('no price source at all: no figure (no source invented), every stock listed as missing', () => {
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6)], [], AS_ON, '1y', 'family');
    assert.equal(r.figure, null);
    assert.deepEqual(r.lines.map((l) => status(l.cagr)), [STATUS.NOT_AVAILABLE]);
    assert.deepEqual(r.used, []);
  });
  test('B2: the figure names the source a stock in the base used; L3: an empty series falls through', () => {
    const pack: PriceSource = { source: 'screener-pack', asOn: SRC_ON, series: { INE000SAMPLE1: [] }, sourceIds: ['sha-pack'] };
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6)], [pack, file], AS_ON, '3y', 'family');
    near(v(r.figure!.value), 10);
    assert.equal(r.figure!.source, 'analyst-price-file');
    assert.deepEqual(r.lines.map((l) => l.source), ['analyst-price-file']);
    assert.deepEqual(r.used.map((u) => u.source), ['analyst-price-file']);
    assert.equal(r.mixed, false);
  });
  test('two sources used: mixed', () => {
    const pack: PriceSource = { source: 'screener-pack', asOn: SRC_ON, series: { INE000SAMPLE1: tenPct3y }, sourceIds: ['sha-pack'] };
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6), sh('s2', 'INE000SAMPLE2', 4)], [pack, file], AS_ON, '3y', 'family');
    assert.equal(r.mixed, true);
    assert.equal(r.figure!.source, 'screener-pack');
  });
  test('a holding without a value keeps its line but stays out of the base', () => {
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6), { holdingId: 's2' as HoldingId, isin: 'INE000SAMPLE2', cmvCr: missing(STATUS.NOT_AVAILABLE, 'x') }], [file], AS_ON, '3y', 'family');
    near(v(r.figure!.value), 10);
    assert.deepEqual(r.figure!.coverage, { share: 1, basis: 'equity-value', included: 1, excluded: 0 });
    near(v(r.lines[1]!.cagr), 20);
    assert.deepEqual(r.figure!.value.kind === 'value' && r.figure!.value.prov.sources, ['sha-file']);
  });
  test('a source used only by a stock outside the base is not in the figure\'s provenance', () => {
    const pack: PriceSource = { source: 'screener-pack', asOn: SRC_ON, series: { INE000SAMPLE2: twentyPct3y }, sourceIds: ['sha-pack'] };
    const r = directEquityCagr([sh('s1', 'INE000SAMPLE1', 6), { holdingId: 's2' as HoldingId, isin: 'INE000SAMPLE2', cmvCr: present(0, 'cr', P) }], [pack, file], AS_ON, '3y', 'family');
    near(v(r.figure!.value), 10);
    assert.deepEqual(r.lines.map((l) => l.source), ['analyst-price-file', 'screener-pack']);
    assert.deepEqual(r.figure!.value.kind === 'value' && r.figure!.value.prov.sources, ['sha-file']);
  });
});

describe('month-end data (MOD-04, 26 Nov 2026; ARC-03 M4)', () => {
  test('what counts as month-end data', () => {
    assert.equal(isMonthEndSeries(pts([D(2025, 10, 31), 1], [D(2026, 10, 30), 1])), true);
    assert.equal(isMonthEndSeries(pts([D(2024, 2, 29), 1], [D(2025, 2, 28), 1])), true);
    assert.equal(isMonthEndSeries(pts([D(2025, 10, 23), 1])), false, 'not in the last 7 days of its month');
    assert.equal(isMonthEndSeries(pts([D(2025, 10, 30), 1], [D(2025, 10, 31), 1])), false, 'two points in one month');
    assert.equal(isMonthEndSeries([]), false);
  });
  test('PD-67: never a price after the as-on; 30 Oct with month-end points uses 30 Sep, not 31 Oct', () => {
    const s = pts([D(2025, 9, 30), 100], [D(2025, 10, 31), 999], [D(2026, 9, 30), 110], [D(2026, 10, 31), 999]);
    near(v(stockCagr(s, D(2026, 10, 30), '1y')), 10);
    // with no September point, the as-on has no month-end price on or before it in its month or the month before
    assert.equal(status(stockCagr(pts([D(2025, 10, 31), 100], [D(2026, 10, 31), 110]), D(2026, 10, 30), '1y')), STATUS.NOT_AVAILABLE);
  });
  test('28 Feb 2025 uses the 29 Feb 2024 month-end point', () => {
    const s = pts([D(2024, 2, 29), 100], [D(2025, 2, 28), 110]);
    near(v(stockCagr(s, D(2025, 2, 28), '1y')), 10);
  });
  test('a month without a point is missing; a series starting later is INSUFFICIENT EVIDENCE', () => {
    const gap = pts([D(2023, 9, 30), 90], [D(2024, 10, 31), 95], [AS_ON, 110]);
    assert.equal(status(stockCagr(gap, AS_ON, '3y')), STATUS.NOT_AVAILABLE);
    const late = pts([D(2024, 1, 31), 95], [AS_ON, 110]);
    assert.equal(status(stockCagr(late, AS_ON, '3y')), STATUS.INSUFFICIENT_EVIDENCE);
  });
});

describe('a short history falls through only to a source with the same as-on date (MOD-04, I-31)', () => {
  const P2 = { sources: [], method: 'test' };
  const sh2 = (id: string, isin: string, cmv: number): StockHoldingInput => ({ holdingId: id as HoldingId, isin, cmvCr: present(cmv, 'cr', P2) });
  const shortPack = pts([D(2025, 1, 31), 100], [AS_ON, 120]);
  const longFile = pts([D(2023, 10, 31), 100], [AS_ON, 133.1]);
  test('same date: the file fills the stock, labelled with the file', () => {
    const pack: PriceSource = { source: 'screener-pack', asOn: SRC_ON, series: { INE000SAMPLE9: shortPack } };
    const file: PriceSource = { source: 'analyst-price-file', asOn: SRC_ON, series: { INE000SAMPLE9: longFile } };
    const r = directEquityCagr([sh2('s', 'INE000SAMPLE9', 1)], [pack, file], AS_ON, '3y', 'family');
    near(v(r.lines[0]!.cagr), 10);
    assert.equal(r.lines[0]!.source, 'analyst-price-file');
    assert.equal(r.figure!.source, 'analyst-price-file');
  });
  test('another date: the stock stays missing (INSUFFICIENT EVIDENCE from the pack)', () => {
    const pack: PriceSource = { source: 'screener-pack', asOn: SRC_ON, series: { INE000SAMPLE9: shortPack } };
    const file: PriceSource = { source: 'analyst-price-file', asOn: present(D(2026, 11, 20), 'date', P2), series: { INE000SAMPLE9: longFile } };
    const r = directEquityCagr([sh2('s', 'INE000SAMPLE9', 1)], [pack, file], AS_ON, '3y', 'family');
    assert.equal(status(r.lines[0]!.cagr), STATUS.INSUFFICIENT_EVIDENCE);
    assert.equal(r.lines[0]!.source, 'screener-pack');
    assert.equal(r.figure!.value.kind, 'missing');
    assert.equal(r.figure!.source, 'screener-pack');
  });
  test('parts: stocks from two sources list both with their shares and dates', () => {
    const FILE_ON = present(D(2026, 11, 20), 'date', P2);
    const pack: PriceSource = { source: 'screener-pack', asOn: SRC_ON, series: { INE000SAMPLE1: longFile } };
    const file: PriceSource = { source: 'analyst-price-file', asOn: FILE_ON, series: { INE000SAMPLE2: longFile } };
    const r = directEquityCagr([sh2('s1', 'INE000SAMPLE1', 3), sh2('s2', 'INE000SAMPLE2', 1)], [pack, file], AS_ON, '3y', 'family');
    // both end prices are of 31 Oct: the parts and `used` carry that label, not the file's own date (ARC-03 delta M1)
    assert.ok(FILE_ON.kind === 'value');
    assert.deepEqual(r.figure!.parts!.map((p) => [p.source, v(p.asOn), p.share]), [['screener-pack', AS_ON, 0.75], ['analyst-price-file', AS_ON, 0.25]]);
    assert.deepEqual(r.used.map((u) => [u.source, v(u.asOn)]), [['screener-pack', AS_ON], ['analyst-price-file', AS_ON]]);
    assert.equal(r.mixed, true);
  });
});

describe('ARC-03 delta review of 49e9a34 (M1, M2, pinned)', () => {
  const P3 = { sources: [], method: 'test' };
  const sh3 = (id: string, isin: string, cmv: number): StockHoldingInput => ({ holdingId: id as HoldingId, isin, cmvCr: present(cmv, 'cr', P3) });
  test('M1 with PD-67: the figure is dated by the day of the prices used, not the raw as-on', () => {
    const SEP30 = D(2026, 9, 30);
    const pack: PriceSource = { source: 'screener-pack', asOn: SRC_ON, series: { INE000SAMPLE1: pts([D(2025, 9, 30), 100], [SEP30, 110], [AS_ON, 999]) } };
    const r = directEquityCagr([sh3('s', 'INE000SAMPLE1', 1)], [pack], D(2026, 10, 15), '1y', 'family');
    near(v(r.figure!.value), 10);
    assert.equal(v(r.figure!.asOn), SEP30);
    assert.match(footnoteOf(r)!, /as on 2026-09-30 \(1 stock\)\.$/);
  });
  test('M1: a file dated 20 Nov whose prices end on 29 Oct is footnoted as on 29 Oct, the day of the prices used', () => {
    const file: PriceSource = { source: 'analyst-price-file', asOn: present(D(2026, 11, 20), 'date', P3), series: { INE000SAMPLE1: pts([D(2025, 10, 29), 100], [D(2026, 10, 29), 110]) } };
    const r = directEquityCagr([sh3('s', 'INE000SAMPLE1', 1)], [file], AS_ON, '1y', 'family');
    assert.equal(v(r.figure!.asOn), D(2026, 10, 29));
    const foot = footnoteOf(r)!;
    assert.match(foot, /as on 2026-10-29 \(1 stock\)\.$/);
    assert.ok(!foot.includes('2026-11-20'));
  });
  test('M2 (PD-67): as-on 15 Oct uses 30 Sep; 2 Nov uses 31 Oct; a later point is never used', () => {
    const s = pts([D(2025, 9, 30), 100], [D(2025, 10, 31), 200], [D(2026, 9, 30), 110], [AS_ON, 220]);
    near(v(stockCagr(s, D(2026, 10, 15), '1y')), 10);
    near(v(stockCagr(s, D(2026, 11, 2), '1y')), 10);
    // an as-on two months past the last point has no month-end price: missing, never 0%
    assert.equal(status(stockCagr(s, D(2026, 12, 15), '1y')), STATUS.NOT_AVAILABLE);
  });
  test('pinned: 3Y on month-end data, 200 to 266.2 = 10.00%', () => {
    near(v(stockCagr(pts([D(2023, 10, 31), 200], [D(2024, 10, 31), 230], [D(2025, 10, 31), 240], [AS_ON, 266.2]), AS_ON, '3y')), 10);
  });
  test('M3 for stocks: no ISIN and no price series are counted apart', () => {
    const file: PriceSource = { source: 'analyst-price-file', asOn: SRC_ON, series: { INE000SAMPLE1: pts([D(2025, 10, 31), 100], [AS_ON, 110]) } };
    const r = directEquityCagr([sh3('a', 'INE000SAMPLE1', 2), { holdingId: 'b' as HoldingId, isin: null, cmvCr: present(1, 'cr', P3) }, sh3('c', 'INE000NOPRICE', 1)], [file], AS_ON, '1y', 'family');
    assert.match(footnoteOf(r)!, /1Y covers 50.0% of direct-equity value; 1 stock without a 1Y return excluded; 1 stock without an ISIN excluded\./);
  });
});

describe('ARC-03 delta review 2 (F2, F3) with MOD-05\'s F3 rule', () => {
  const P4 = { sources: [], method: 'test' };
  const sh4 = (id: string, isin: string, cmv: number): StockHoldingInput => ({ holdingId: id as HoldingId, isin, cmvCr: present(cmv, 'cr', P4) });
  // daily data: the stocks end on different days before a 31 Oct as-on (a holiday-like gap for some)
  const endOn = (end: number, start: number): PricePoint[] => pts([start, 100], [end, 110]);
  const S = (d: number) => D(2025, 10, d);
  const E = (d: number) => D(2026, 10, d);
  const file: PriceSource = {
    source: 'analyst-price-file', asOn: SRC_ON, sourceIds: ['sha-file'],
    series: { INE000SAMPLEA: endOn(E(29), S(29)), INE000SAMPLEB: endOn(E(30), S(30)), INE000SAMPLEC: endOn(E(29), S(29)), INE000SAMPLED: endOn(E(28), S(28)) },
  };
  const rows = [sh4('a', 'INE000SAMPLEA', 1), sh4('b', 'INE000SAMPLEB', 1), sh4('c', 'INE000SAMPLEC', 1), sh4('d', 'INE000SAMPLED', 1)];
  test('F3: the figure carries the latest end day of the primary source; the others ascend with counts', () => {
    const r = directEquityCagr(rows, [file], AS_ON, '1y', 'family');
    assert.equal(v(r.figure!.asOn), E(30));
    assert.deepEqual(r.used.map((u) => [v(u.asOn), u.count]), [[E(30), 1], [E(28), 1], [E(29), 2]]);
    assert.equal(footnoteOf(r), "1Y: weighted average return of current holdings. Source: analyst's price file, as on 2026-10-30 (1 stock; also 2026-10-28: 1 stock, 2026-10-29: 2 stocks).");
  });
  test('F3: nothing depends on the order of the holdings (every permutation of four rows)', () => {
    const perms = (xs: StockHoldingInput[]): StockHoldingInput[][] => xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
    const base = directEquityCagr(rows, [file], AS_ON, '1y', 'family');
    for (const p of perms(rows)) {
      const r = directEquityCagr(p, [file], AS_ON, '1y', 'family');
      assert.deepEqual(r.figure!.asOn, base.figure!.asOn);
      assert.deepEqual(r.figure!.parts, base.figure!.parts);
      assert.deepEqual(r.used, base.used);
      assert.equal(footnoteOf(r), footnoteOf(base));
    }
  });
  test('F2: a present stock value is dated by its end day; a missing one keeps the review as-on', () => {
    const r = directEquityCagr([...rows, sh4('z', 'INE000NOPRICE', 1)], [file], AS_ON, '1y', 'family');
    const asOf = (i: number) => { const c = r.lines[i]!.cagr; return c.kind === 'value' ? c.prov.asOf : null; };
    assert.deepEqual([0, 1, 2, 3].map(asOf), ['2026-10-29', '2026-10-30', '2026-10-29', '2026-10-28']);
    assert.equal(r.lines[4]!.cagr.kind, 'missing');
    const short = stockCagr(pts([D(2025, 1, 31), 100], [AS_ON, 120]), AS_ON, '3y');
    assert.equal(short.kind === 'missing' && short.prov?.asOf, '2026-10-31');
  });
});

describe('financial review of the E-148 round: required tests R1-R3, finding 2 and 3', () => {
  const P5 = { sources: [], method: 'test' };
  const h5 = (id: string, isin: string, cmv: number): StockHoldingInput => ({ holdingId: id as HoldingId, isin, cmvCr: present(cmv, 'cr', P5) });
  const O = (y: number, d: number) => D(y, 10, d);
  // pack: month-end data; file: daily data (two points a month). As-on Sat 31 Oct 2026.
  const pack: PriceSource = { source: 'screener-pack', asOn: SRC_ON, sourceIds: ['sha-pack'], series: {
    INE000PACKP01: pts([O(2025, 31), 100], [O(2026, 30), 110]), // end 30 Oct 2026, start Oct 2025: 10%
    INE000PACKP02: pts([O(2025, 29), 100], [O(2026, 29), 120]), // end 29 Oct 2026: 20%
  } };
  const file: PriceSource = { source: 'analyst-price-file', asOn: SRC_ON, sourceIds: ['sha-file'], series: {
    INE000FILEF01: pts([O(2025, 24), 98], [O(2025, 31), 100], [O(2026, 23), 101], [O(2026, 30), 105]), // end 30 Oct: 5%
    INE000FILEF02: pts([O(2025, 19), 90], [O(2025, 26), 100], [O(2026, 19), 95], [O(2026, 26), 130]), // end 26 Oct: 30%
    INE000FILEF03: pts([O(2025, 19), 90], [O(2025, 26), 100], [O(2026, 19), 95], [O(2026, 26), 110]), // end 26 Oct: 10%
  } };
  const rows = [h5('p1', 'INE000PACKP01', 4), h5('p2', 'INE000PACKP02', 2), h5('f1', 'INE000FILEF01', 2), h5('f2', 'INE000FILEF02', 1), h5('f3', 'INE000FILEF03', 1)];
  const perms = (xs: StockHoldingInput[]): StockHoldingInput[][] => xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));

  test('R1: mixed sources, several end days each: value, date, used, parts, footnote, every order', () => {
    const r = directEquityCagr(rows, [pack, file], AS_ON, '1y', 'family');
    // (4 x 10 + 2 x 20 + 2 x 5 + 1 x 30 + 1 x 10) / 10 = 13.00
    near(v(r.figure!.value), 13);
    assert.equal(r.figure!.source, 'screener-pack');
    assert.equal(v(r.figure!.asOn), O(2026, 30));
    assert.deepEqual(r.used.map((u) => [u.source, v(u.asOn), u.count]), [
      ['screener-pack', O(2026, 30), 1], ['screener-pack', O(2026, 29), 1], ['analyst-price-file', O(2026, 30), 1], ['analyst-price-file', O(2026, 26), 2],
    ]);
    assert.deepEqual(r.figure!.parts!.map((p) => [p.source, v(p.asOn), Math.round(p.share * 1e9) / 1e9]), [
      ['screener-pack', O(2026, 29), 0.2], ['screener-pack', O(2026, 30), 0.4], ['analyst-price-file', O(2026, 26), 0.2], ['analyst-price-file', O(2026, 30), 0.2],
    ]);
    assert.equal(footnoteOf(r), "1Y: weighted average return of current holdings. Source: MF Screener data pack, as on 2026-10-30 (1 stock; also 2026-10-29: 1 stock); analyst's price file, as on 2026-10-30 (1 stock; also 2026-10-26: 2 stocks).");
    for (const p of perms(rows)) {
      const q = directEquityCagr(p, [pack, file], AS_ON, '1y', 'family');
      near(v(q.figure!.value), 13);
      assert.deepEqual(q.figure!.asOn, r.figure!.asOn);
      assert.deepEqual(q.figure!.parts, r.figure!.parts);
      assert.deepEqual(q.used, r.used);
      assert.equal(footnoteOf(q), footnoteOf(r));
    }
  });
  test('R2: the primary source ends earlier than the second: the figure carries the primary date', () => {
    const r = directEquityCagr([h5('p2', 'INE000PACKP02', 1), h5('f1', 'INE000FILEF01', 99)], [pack, file], AS_ON, '1y', 'family');
    near(v(r.figure!.value), (1 * 20 + 99 * 5) / 100);
    assert.equal(r.figure!.source, 'screener-pack');
    assert.equal(v(r.figure!.asOn), O(2026, 29));
    assert.deepEqual(r.figure!.parts!.map((p) => [p.source, v(p.asOn), Math.round(p.share * 1e9) / 1e9]), [['screener-pack', O(2026, 29), 0.01], ['analyst-price-file', O(2026, 30), 0.99]]);
    assert.match(footnoteOf(r)!, /Source: MF Screener data pack, as on 2026-10-29 \(1 stock\); analyst's price file, as on 2026-10-30 \(1 stock\)\.$/);
  });
  test('R3: a holding outside the base with a later end day moves neither the date nor the counts', () => {
    const r = directEquityCagr([h5('f2', 'INE000FILEF02', 1), h5('f1', 'INE000FILEF01', 0)], [file], AS_ON, '1y', 'family');
    assert.equal(v(r.figure!.asOn), O(2026, 26));
    assert.deepEqual(r.used.map((u) => [v(u.asOn), u.count]), [[O(2026, 26), 1]]);
    assert.equal(r.outsideBase, 1);
    near(v(r.lines[1]!.cagr), 5); // its own line still shows its CAGR, dated 30 Oct
  });
  test('finding 2: two sources of one kind are refused', () => {
    assert.throws(() => directEquityCagr(rows, [file, { ...file, sourceIds: ['sha-file-2'] }], AS_ON, '1y', 'family'), /two sources of one kind \("analyst-price-file"\)/);
  });
  test('finding 3: a line without an ISIN or a series keeps the review as-on', () => {
    const r = directEquityCagr([{ holdingId: 'n' as HoldingId, isin: null, cmvCr: present(1, 'cr', P5) }, h5('z', 'INE000NOPRICE', 1)], [file], AS_ON, '1y', 'family');
    assert.deepEqual(r.lines.map((l) => (l.cagr.kind === 'missing' ? l.cagr.prov?.asOf : null)), ['2026-10-31', '2026-10-31']);
  });
});
