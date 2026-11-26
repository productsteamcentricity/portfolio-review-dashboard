// covers: E-147 E-148 KI-006 (the weighted average return of current holdings; D-023 points 3 and 4; contract I-31)
// Known answers (docs/new-build/08-regression-test-plan.md, unit/returns/portfolio-returns.test.ts):
//   funds at 50%, 30%, 20% of MF value with 3Y returns 14%, 6% and none: (0.5 x 14 + 0.3 x 6) / 0.8 = 11.00% at 80%
//   coverage (counting the missing return as 0% would give 8.80%, which fails);
//   stocks at 60% and 40% with 3Y CAGR 10% and 20%: 14.00%; if the 40% stock has no 3Y: 10.00% at 60% (not 6.00%).
// Source order: the uploaded monitor when present, else the embedded one; a fund missing in the primary is filled
// from a later source only when that source has the same as-on date. Synthetic fund names only.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asOnDay, coverageFootnote, weightItems, weightedFundReturn, WEIGHTED_RETURN_LABEL,
  type FundHoldingInput, type FundReturnSource, type WeightInput,
} from '../../../app/src/engine/returns/portfolio-returns.ts';
import type { HoldingId } from '../../../app/src/model/ids.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';

const P = { sources: [], method: 'test' };
const OCT = ymdToDay(2026, 10, 31)!;
const SEP = ymdToDay(2026, 9, 30)!;
const day = (d: number) => present(d, 'date', P);
const fh = (id: string, scheme: string | null, cmv: number | null): FundHoldingInput => ({
  holdingId: id as HoldingId, schemeName: scheme, cmvCr: cmv === null ? missing(STATUS.NOT_AVAILABLE, 'no value') : present(cmv, 'cr', P),
});
const r3 = (x: number | null, y5: number | null = null) => ({ r: { '1Y': null, '3Y': x, '5Y': y5 } });
const src = (source: FundReturnSource['source'], asOn: number | null, funds: FundReturnSource['funds'], ids: string[] = []): FundReturnSource => ({
  source, asOn: asOn === null ? missing(STATUS.NOT_AVAILABLE, 'no date') : day(asOn), funds, sourceIds: ids,
});
const v = (x: { kind: string; v?: number }): number | null => (x.kind === 'value' ? x.v! : null);
const near = (a: number | null, b: number): void => assert.ok(a !== null && Math.abs(a - b) < 1e-12, `${a} != ${b}`);

const embedded = src('embedded-mf-monitor', OCT, {
  'Sample Alpha Fund-Reg(G)': r3(14, 12),
  'Sample Beta Fund-Reg(G)': r3(6, 8),
  'Sample Gamma Fund-Reg(G)': r3(null, null),
}, ['sha-embedded']);
const book = [fh('h1', 'Sample Alpha Fund-Reg(G)', 5), fh('h2', 'Sample Beta Fund-Reg(G)', 3), fh('h3', 'Sample Gamma Fund-Reg(G)', 2)];

describe('E-147: the MF portfolio 3Y (D-023 point 3)', () => {
  const res = weightedFundReturn(book, [embedded], '3y', 'family');
  test('11.00% at 80% coverage, never 8.80%', () => {
    near(v(res.figure.value), 11);
    assert.notEqual(Math.round(v(res.figure.value)! * 100) / 100, 8.8);
    assert.equal(res.figure.value.kind === 'value' && res.figure.value.coverage, 0.8);
    assert.deepEqual(res.figure.coverage, { share: 0.8, basis: 'mf-value', included: 2, excluded: 1 });
    assert.equal(res.figure.source, 'embedded-mf-monitor');
    assert.equal(res.figure.tenor, '3y');
    assert.equal(res.figure.scope, 'family');
    assert.deepEqual(res.figure.asOn, embedded.asOn);
  });
  test('per fund: weight, return used, source, and the fund left out (not 0%)', () => {
    assert.deepEqual(res.items.map((i) => [i.holdingId, i.weight, i.returnPct, i.source, i.excluded]), [
      ['h1', 0.5, 14, 'embedded-mf-monitor', null],
      ['h2', 0.3, 6, 'embedded-mf-monitor', null],
      ['h3', 0.2, null, null, 'no-return'],
    ]);
  });
  test('the label and the provenance', () => {
    assert.equal(WEIGHTED_RETURN_LABEL, 'weighted average return of current holdings');
    const p = res.figure.value.kind === 'value' ? res.figure.value.prov : null;
    assert.ok(p && p.method.startsWith(WEIGHTED_RETURN_LABEL));
    assert.deepEqual(p?.sources, ['sha-embedded']);
    assert.equal(p?.asOf, '2026-10-31');
  });
  test('5Y on the same book: (5 x 12 + 3 x 8) / 8 = 10.50% at 80%', () => {
    const r = weightedFundReturn(book, [embedded], '5y', 'family');
    near(v(r.figure.value), 10.5);
    assert.equal(r.figure.coverage.share, 0.8);
  });
  test('complete coverage has no coverage field', () => {
    const r = weightedFundReturn(book.slice(0, 2), [embedded], '3y', 'family');
    near(v(r.figure.value), (5 * 14 + 3 * 6) / 8);
    assert.equal(r.figure.value.kind === 'value' && 'coverage' in r.figure.value, false);
    assert.equal(r.figure.coverage.share, 1);
  });
});

describe('E-147: the source order', () => {
  test('the uploaded monitor is the primary when present', () => {
    const up = src('uploaded-mf-monitor', OCT, { 'Sample Alpha Fund-Reg(G)': r3(20), 'Sample Beta Fund-Reg(G)': r3(10), 'Sample Gamma Fund-Reg(G)': r3(5) }, ['sha-up']);
    const r = weightedFundReturn(book, [up, embedded], '3y', 'family');
    near(v(r.figure.value), (5 * 20 + 3 * 10 + 2 * 5) / 10);
    assert.equal(r.figure.source, 'uploaded-mf-monitor');
    assert.deepEqual(r.items.map((i) => i.source), ['uploaded-mf-monitor', 'uploaded-mf-monitor', 'uploaded-mf-monitor']);
  });
  test('a fund missing in the primary is filled from the next source at the same as-on date', () => {
    const up = src('uploaded-mf-monitor', OCT, { 'Sample Alpha Fund-Reg(G)': r3(20) }, ['sha-up']);
    const r = weightedFundReturn(book, [up, embedded], '3y', 'family');
    near(v(r.figure.value), (5 * 20 + 3 * 6) / 8);
    assert.deepEqual(r.items.map((i) => i.source), ['uploaded-mf-monitor', 'embedded-mf-monitor', null]);
    assert.equal(r.figure.source, 'uploaded-mf-monitor');
    const p = r.figure.value.kind === 'value' ? r.figure.value.prov.sources : [];
    assert.deepEqual(p, ['sha-up', 'sha-embedded']);
  });
  test('a later source with another as-on date never fills: the fund is excluded and counted', () => {
    const up = src('uploaded-mf-monitor', ymdToDay(2026, 11, 20)!, { 'Sample Alpha Fund-Reg(G)': r3(20) }, ['sha-up']);
    const r = weightedFundReturn(book, [up, embedded], '3y', 'family');
    near(v(r.figure.value), 20);
    assert.deepEqual(r.figure.coverage, { share: 0.5, basis: 'mf-value', included: 1, excluded: 2 });
    assert.deepEqual(r.items.map((i) => i.excluded), [null, 'no-return', 'no-return']);
    const p = r.figure.value.kind === 'value' ? r.figure.value.prov.sources : [];
    assert.deepEqual(p, ['sha-up']);
  });
  test('a source without an as-on date neither fills nor is filled', () => {
    const up = src('uploaded-mf-monitor', null, { 'Sample Alpha Fund-Reg(G)': r3(20) });
    const r = weightedFundReturn(book, [up, embedded], '3y', 'family');
    near(v(r.figure.value), 20);
    const old = src('embedded-mf-monitor', SEP, { 'Sample Beta Fund-Reg(G)': r3(6) });
    const r2 = weightedFundReturn(book, [embedded, old, src('screener-pack', OCT, { 'Sample Gamma Fund-Reg(G)': r3(4) })], '3y', 'family');
    // the pack has the primary's date, so it fills Gamma; the September monitor is skipped
    near(v(r2.figure.value), (5 * 14 + 3 * 6 + 2 * 4) / 10);
    assert.deepEqual(r2.items.map((i) => i.source), ['embedded-mf-monitor', 'embedded-mf-monitor', 'screener-pack']);
  });
});

describe('E-147: edges', () => {
  test('an unmatched fund and a fund absent from every source are excluded and counted', () => {
    const r = weightedFundReturn([...book.slice(0, 2), fh('h4', null, 1), fh('h5', 'Sample Unknown Fund', 1)], [embedded], '3y', 'family');
    near(v(r.figure.value), (5 * 14 + 3 * 6) / 8);
    assert.deepEqual(r.figure.coverage, { share: 0.8, basis: 'mf-value', included: 2, excluded: 2 });
    assert.deepEqual(r.items.map((i) => i.excluded), [null, null, 'unmatched', 'no-return']);
  });
  test('a holding without a positive value is outside the base: neither weighted nor counted', () => {
    const r = weightedFundReturn([...book.slice(0, 2), fh('h6', 'Sample Gamma Fund-Reg(G)', null), fh('h7', 'Sample Alpha Fund-Reg(G)', 0)], [embedded], '3y', 'family');
    near(v(r.figure.value), (5 * 14 + 3 * 6) / 8);
    assert.deepEqual(r.figure.coverage, { share: 1, basis: 'mf-value', included: 2, excluded: 0 });
    assert.deepEqual(r.items.map((i) => [i.weight, i.excluded]), [[5 / 8, null], [3 / 8, null], [null, 'no-value'], [null, 'no-value']]);
  });
  test('no fund with the tenor: missing (NOT AVAILABLE), never 0%', () => {
    const r = weightedFundReturn([book[2]!], [embedded], '3y', 'family');
    assert.equal(r.figure.value.kind, 'missing');
    assert.equal(r.figure.value.kind === 'missing' && r.figure.value.status, STATUS.NOT_AVAILABLE);
    assert.equal(r.figure.coverage.share, 0);
  });
  test('no holding in the base, and no source at all', () => {
    const r = weightedFundReturn([], [embedded], '3y', 'family');
    assert.equal(r.figure.value.kind === 'missing' && r.figure.value.status, STATUS.NOT_APPLICABLE);
    const r2 = weightedFundReturn(book, [], '3y', 'family');
    assert.equal(r2.figure.value.kind === 'missing' && r2.figure.value.status, STATUS.NOT_AVAILABLE);
    assert.equal(r2.figure.asOn.kind, 'missing');
    assert.deepEqual(r2.items.map((i) => i.excluded), ['no-return', 'no-return', 'no-return']);
  });
  test('a record without the tenor, or a non-finite value, is no return; inherited names are not funds', () => {
    const odd = src('embedded-mf-monitor', OCT, { A: { r: {} }, B: { r: { '3Y': Number.NaN } } });
    const r = weightedFundReturn([fh('a', 'A', 1), fh('b', 'B', 1), fh('c', 'toString', 1), fh('d', '__proto__', 1)], [odd], '3y', 'family');
    assert.equal(r.figure.value.kind, 'missing');
    assert.equal(r.figure.coverage.excluded, 4);
  });
});

describe('E-148 portfolio figure through the shared weighting', () => {
  const wi = (id: string, cmv: number, x: number | null): WeightInput => ({
    holdingId: id as HoldingId, cmvCr: present(cmv, 'cr', P),
    pick: x === null ? { excluded: 'no-return' } : { returnPct: x, source: 'analyst-price-file' },
  });
  const ctx = { scope: 'family' as const, tenor: '3y' as const, basis: 'equity-value' as const, primary: 'analyst-price-file' as const, asOn: day(OCT), sourceIds: [], method: 'test' };
  test('stocks at 60% and 40% with 10% and 20%: 14.00%', () => {
    near(v(weightItems([wi('s1', 6, 10), wi('s2', 4, 20)], ctx).figure.value), 14);
  });
  test('the 40% stock without a 3Y: 10.00% at 60%, not 6.00%', () => {
    const r = weightItems([wi('s1', 6, 10), wi('s2', 4, null)], ctx);
    near(v(r.figure.value), 10);
    assert.deepEqual(r.figure.coverage, { share: 0.6, basis: 'equity-value', included: 1, excluded: 1 });
  });
});

describe('the coverage footnote (one text for screen, slide and sheet)', () => {
  test('partial: the label, the coverage, the count excluded, the sources and dates', () => {
    const res = weightedFundReturn(book, [embedded], '3y', 'family');
    assert.equal(
      coverageFootnote(res.figure, [{ source: 'embedded-mf-monitor', asOn: embedded.asOn }]),
      '3Y: weighted average return of current holdings. 3Y covers 80% of MF value; 1 fund without a 3Y return excluded. Source: MF Monitor (embedded monthly data), as on 2026-10-31.',
    );
  });
  test('stocks, plural, and an undated source', () => {
    const wi = (id: string, cmv: number, x: number | null): WeightInput => ({ holdingId: id as HoldingId, cmvCr: present(cmv, 'cr', P), pick: x === null ? { excluded: 'no-return' } : { returnPct: x, source: 'analyst-price-file' } });
    const r = weightItems([wi('s1', 6, 10), wi('s2', 3, null), wi('s3', 1, null)], { scope: 'family', tenor: '5y', basis: 'equity-value', primary: 'analyst-price-file', asOn: missing(STATUS.NOT_AVAILABLE, 'x'), sourceIds: [], method: 'test' });
    const t = coverageFootnote(r.figure, [{ source: 'analyst-price-file', asOn: r.figure.asOn }]);
    assert.equal(t, "5Y: weighted average return of current holdings. 5Y covers 60% of direct-equity value; 2 stocks without a 5Y return excluded. Source: analyst's price file, as on date not available.");
    assert.ok(!/\b0(\.0+)?%/.test(t), 'no excluded item printed as 0%');
  });
  test('complete: no coverage clause', () => {
    const res = weightedFundReturn(book.slice(0, 2), [embedded], '3y', 'family');
    assert.equal(coverageFootnote(res.figure, []), '3Y: weighted average return of current holdings.');
  });
});

describe('asOnDay: the monitor as-on text', () => {
  test('dates the monitors write, and text that is not a date', () => {
    assert.deepEqual(asOnDay('31-Oct-2026'), present(OCT, 'date', { sources: [], method: 'as-on text' }));
    assert.equal(v(asOnDay('31 Oct 2026')), OCT);
    assert.equal(v(asOnDay('2026-10-31')), OCT);
    assert.equal(asOnDay('').kind, 'missing');
    assert.equal(asOnDay(null).kind, 'missing');
    assert.equal(asOnDay('October').kind, 'missing');
  });
});
