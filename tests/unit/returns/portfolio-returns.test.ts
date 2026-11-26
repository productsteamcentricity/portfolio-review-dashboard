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
  asOnDay, coverageFootnote, monitorAsOn, monthEndLabel, sharePct, weightItems, weightedFundReturn, WEIGHTED_RETURN_LABEL,
  type FundHoldingInput, type FundPlan, type FundReturnSource, type FundReturnTable, type WeightInput,
} from '../../../app/src/engine/returns/portfolio-returns.ts';
import type { HoldingId } from '../../../app/src/model/ids.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';

const P = { sources: [], method: 'test' };
const OCT = ymdToDay(2026, 10, 31)!;
const SEP = ymdToDay(2026, 9, 30)!;
const day = (d: number) => present(d, 'date', P);
const fh = (id: string, scheme: string | null, cmv: number | null, plan: FundPlan = 'regular'): FundHoldingInput => ({
  holdingId: id as HoldingId, schemeName: scheme, plan, cmvCr: cmv === null ? missing(STATUS.NOT_AVAILABLE, 'no value') : present(cmv, 'cr', P),
});
const r3 = (x: number | null, y5: number | null = null) => ({ r: { '1Y': null, '3Y': x, '5Y': y5 } });
type Funds = FundReturnTable['funds'];
const table = (asOn: number | null, funds: Funds): FundReturnTable => ({ asOn: asOn === null ? missing(STATUS.NOT_AVAILABLE, 'no date') : day(asOn), funds });
/** A source with a Regular table only (most cases below). */
const src = (source: FundReturnSource['source'], asOn: number | null, funds: Funds, ids: string[] = []): FundReturnSource => ({
  source, plans: { regular: table(asOn, funds) }, sourceIds: ids,
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
    near(v(res.figure!.value), 11);
    assert.notEqual(Math.round(v(res.figure!.value)! * 100) / 100, 8.8);
    assert.equal(res.figure!.value.kind === 'value' && res.figure!.value.coverage, 0.8);
    assert.deepEqual(res.figure!.coverage, { share: 0.8, basis: 'mf-value', included: 2, excluded: 1 });
    assert.equal(res.figure!.source, 'embedded-mf-monitor');
    assert.equal(res.figure!.tenor, '3y');
    assert.equal(res.figure!.scope, 'family');
    assert.deepEqual(res.figure!.asOn, embedded.plans.regular!.asOn);
    assert.deepEqual(res.used, [{ source: 'embedded-mf-monitor', plan: 'regular', asOn: embedded.plans.regular!.asOn }]);
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
    const p = res.figure!.value.kind === 'value' ? res.figure!.value.prov : null;
    assert.ok(p && p.method.startsWith(WEIGHTED_RETURN_LABEL));
    assert.deepEqual(p?.sources, ['sha-embedded']);
    assert.equal(p?.asOf, '2026-10-31');
  });
  test('5Y on the same book: (5 x 12 + 3 x 8) / 8 = 10.50% at 80%', () => {
    const r = weightedFundReturn(book, [embedded], '5y', 'family');
    near(v(r.figure!.value), 10.5);
    assert.equal(r.figure!.coverage.share, 0.8);
  });
  test('complete coverage has no coverage field', () => {
    const r = weightedFundReturn(book.slice(0, 2), [embedded], '3y', 'family');
    near(v(r.figure!.value), (5 * 14 + 3 * 6) / 8);
    assert.equal(r.figure!.value.kind === 'value' && 'coverage' in r.figure!.value, false);
    assert.equal(r.figure!.coverage.share, 1);
  });
});

describe('E-147: the source order', () => {
  test('the uploaded monitor is the primary when present', () => {
    const up = src('uploaded-mf-monitor', OCT, { 'Sample Alpha Fund-Reg(G)': r3(20), 'Sample Beta Fund-Reg(G)': r3(10), 'Sample Gamma Fund-Reg(G)': r3(5) }, ['sha-up']);
    const r = weightedFundReturn(book, [up, embedded], '3y', 'family');
    near(v(r.figure!.value), (5 * 20 + 3 * 10 + 2 * 5) / 10);
    assert.equal(r.figure!.source, 'uploaded-mf-monitor');
    assert.deepEqual(r.items.map((i) => i.source), ['uploaded-mf-monitor', 'uploaded-mf-monitor', 'uploaded-mf-monitor']);
  });
  test('a fund missing in the primary is filled from the next source at the same as-on date', () => {
    const up = src('uploaded-mf-monitor', OCT, { 'Sample Alpha Fund-Reg(G)': r3(20) }, ['sha-up']);
    const r = weightedFundReturn(book, [up, embedded], '3y', 'family');
    near(v(r.figure!.value), (5 * 20 + 3 * 6) / 8);
    assert.deepEqual(r.items.map((i) => i.source), ['uploaded-mf-monitor', 'embedded-mf-monitor', null]);
    assert.equal(r.figure!.source, 'uploaded-mf-monitor');
    const p = r.figure!.value.kind === 'value' ? r.figure!.value.prov.sources : [];
    assert.deepEqual(p, ['sha-up', 'sha-embedded']);
  });
  test('a later source with another as-on date never fills: the fund is excluded and counted', () => {
    const up = src('uploaded-mf-monitor', ymdToDay(2026, 11, 20)!, { 'Sample Alpha Fund-Reg(G)': r3(20) }, ['sha-up']);
    const r = weightedFundReturn(book, [up, embedded], '3y', 'family');
    near(v(r.figure!.value), 20);
    assert.deepEqual(r.figure!.coverage, { share: 0.5, basis: 'mf-value', included: 1, excluded: 2 });
    assert.deepEqual(r.items.map((i) => i.excluded), [null, 'no-return', 'no-return']);
    const p = r.figure!.value.kind === 'value' ? r.figure!.value.prov.sources : [];
    assert.deepEqual(p, ['sha-up']);
  });
  test('a source without an as-on date neither fills nor is filled', () => {
    const up = src('uploaded-mf-monitor', null, { 'Sample Alpha Fund-Reg(G)': r3(20) });
    const r = weightedFundReturn(book, [up, embedded], '3y', 'family');
    near(v(r.figure!.value), 20);
    // Delta is absent from the primary: the pack (same date) fills it, the September monitor (another date) cannot
    const old = src('embedded-mf-monitor', SEP, { 'Sample Delta Fund-Reg(G)': r3(6) });
    const book2 = [...book.slice(0, 2), fh('h4', 'Sample Delta Fund-Reg(G)', 2)];
    const r2 = weightedFundReturn(book2, [embedded, old, src('screener-pack', OCT, { 'Sample Delta Fund-Reg(G)': r3(4) })], '3y', 'family');
    near(v(r2.figure!.value), (5 * 14 + 3 * 6 + 2 * 4) / 10);
    assert.deepEqual(r2.items.map((i) => i.source), ['embedded-mf-monitor', 'embedded-mf-monitor', 'screener-pack']);
  });
});

describe('E-147: edges', () => {
  test('an unmatched fund and a fund absent from every source are excluded and counted', () => {
    const r = weightedFundReturn([...book.slice(0, 2), fh('h4', null, 1), fh('h5', 'Sample Unknown Fund', 1)], [embedded], '3y', 'family');
    near(v(r.figure!.value), (5 * 14 + 3 * 6) / 8);
    assert.deepEqual(r.figure!.coverage, { share: 0.8, basis: 'mf-value', included: 2, excluded: 2 });
    assert.deepEqual(r.items.map((i) => i.excluded), [null, null, 'unmatched', 'no-return']);
  });
  test('a holding without a positive value is outside the base: neither weighted nor counted', () => {
    const r = weightedFundReturn([...book.slice(0, 2), fh('h6', 'Sample Gamma Fund-Reg(G)', null), fh('h7', 'Sample Alpha Fund-Reg(G)', 0)], [embedded], '3y', 'family');
    near(v(r.figure!.value), (5 * 14 + 3 * 6) / 8);
    assert.deepEqual(r.figure!.coverage, { share: 1, basis: 'mf-value', included: 2, excluded: 0 });
    assert.deepEqual(r.items.map((i) => [i.weight, i.excluded]), [[5 / 8, null], [3 / 8, null], [null, 'no-value'], [null, 'no-value']]);
  });
  test('no fund with the tenor: missing (NOT AVAILABLE), never 0%', () => {
    const r = weightedFundReturn([book[2]!], [embedded], '3y', 'family');
    assert.equal(r.figure!.value.kind, 'missing');
    assert.equal(r.figure!.value.kind === 'missing' && r.figure!.value.status, STATUS.NOT_AVAILABLE);
    assert.equal(r.figure!.coverage.share, 0);
  });
  test('no holding in the base, and no source at all', () => {
    const r = weightedFundReturn([], [embedded], '3y', 'family');
    assert.equal(r.figure!.value.kind === 'missing' && r.figure!.value.status, STATUS.NOT_APPLICABLE);
    // no source at all: no figure, so no source is invented (ARC-03 B2); the funds are still listed
    const r2 = weightedFundReturn(book, [], '3y', 'family');
    assert.equal(r2.figure, null);
    assert.deepEqual(r2.items.map((i) => i.excluded), ['no-return', 'no-return', 'no-return']);
    assert.deepEqual(r2.used, []);
  });
  test('a record without the tenor, or a non-finite value, is no return; inherited names are not funds', () => {
    const odd = src('embedded-mf-monitor', OCT, { A: { r: {} }, B: { r: { '3Y': Number.NaN } } });
    const r = weightedFundReturn([fh('a', 'A', 1), fh('b', 'B', 1), fh('c', 'toString', 1), fh('d', '__proto__', 1)], [odd], '3y', 'family');
    assert.equal(r.figure!.value.kind, 'missing');
    assert.equal(r.figure!.coverage.excluded, 4);
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
    near(v(r.figure!.value), 10);
    assert.deepEqual(r.figure!.coverage, { share: 0.6, basis: 'equity-value', included: 1, excluded: 1 });
  });
});

describe('the coverage footnote (one text for screen, slide and sheet)', () => {
  test('partial: the label, the coverage, the count excluded, the sources and dates', () => {
    const res = weightedFundReturn(book, [embedded], '3y', 'family');
    assert.equal(
      coverageFootnote(res.figure, res.used),
      '3Y: weighted average return of current holdings. 3Y covers 80% of MF value; 1 fund without a 3Y return excluded. Source: MF Monitor (embedded monthly data), Regular plans, as on 2026-10-31.',
    );
  });
  test('stocks, plural, and an undated source', () => {
    const wi = (id: string, cmv: number, x: number | null): WeightInput => ({ holdingId: id as HoldingId, cmvCr: present(cmv, 'cr', P), pick: x === null ? { excluded: 'no-return' } : { returnPct: x, source: 'analyst-price-file' } });
    const r = weightItems([wi('s1', 6, 10), wi('s2', 3, null), wi('s3', 1, null)], { scope: 'family', tenor: '5y', basis: 'equity-value', primary: 'analyst-price-file', asOn: missing(STATUS.NOT_AVAILABLE, 'x'), sourceIds: [], method: 'test' });
    const t = coverageFootnote(r.figure, [{ source: 'analyst-price-file', asOn: r.figure!.asOn }]);
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

describe('E-147: Regular and Direct plans are separate tables', () => {
  // the same scheme name in both plans with different returns (as 36 names are in the October 2026 data)
  const both = 'Sample Twin Fund';
  const emb: FundReturnSource = {
    source: 'embedded-mf-monitor',
    plans: { regular: table(OCT, { [both]: r3(10) }), direct: table(OCT, { [both]: r3(11), 'Sample Solo Fund-Direct': r3(20) }) },
    sourceIds: ['sha-emb'],
  };
  test('each holding takes the return of its own plan', () => {
    const r = weightedFundReturn([fh('a', both, 1, 'regular'), fh('b', both, 1, 'direct')], [emb], '3y', 'family');
    assert.deepEqual(r.items.map((i) => i.returnPct), [10, 11]);
    near(v(r.figure!.value), 10.5);
    assert.deepEqual(r.used.map((u) => u.plan), ['regular', 'direct']);
  });
  test('a name only in the other plan is no return', () => {
    const r = weightedFundReturn([fh('a', 'Sample Solo Fund-Direct', 1, 'regular')], [emb], '3y', 'family');
    assert.deepEqual(r.items.map((i) => i.excluded), ['no-return']);
  });
  test('a Regular monitor uploaded alone: Direct funds are read from the next source with a Direct table', () => {
    const up: FundReturnSource = { source: 'uploaded-mf-monitor', plans: { regular: table(OCT, { [both]: r3(12) }) }, sourceIds: ['sha-up'] };
    const r = weightedFundReturn([fh('a', both, 1, 'regular'), fh('b', both, 1, 'direct')], [up, emb], '3y', 'family');
    assert.deepEqual(r.items.map((i) => [i.returnPct, i.source]), [[12, 'uploaded-mf-monitor'], [11, 'embedded-mf-monitor']]);
    assert.equal(r.figure!.source, 'uploaded-mf-monitor');
    assert.deepEqual(r.used.map((u) => [u.source, u.plan]), [['uploaded-mf-monitor', 'regular'], ['embedded-mf-monitor', 'direct']]);
    assert.deepEqual(r.figure!.value.kind === 'value' && r.figure!.value.prov.sources, ['sha-up', 'sha-emb']);
    assert.equal(
      coverageFootnote(r.figure, r.used),
      '3Y: weighted average return of current holdings. Source: uploaded MF Monitor, Regular plans, as on 2026-10-31; MF Monitor (embedded monthly data), Direct plans, as on 2026-10-31.',
    );
  });
  test('the fill rule holds per plan: another date in the Regular table blocks Regular fills only', () => {
    const NOV = ymdToDay(2026, 11, 20)!;
    const up: FundReturnSource = { source: 'uploaded-mf-monitor', plans: { regular: table(NOV, {}), direct: table(OCT, {}) } };
    const r = weightedFundReturn([fh('a', both, 1, 'regular'), fh('b', both, 1, 'direct')], [up, emb], '3y', 'family');
    assert.deepEqual(r.items.map((i) => [i.returnPct, i.source]), [[null, null], [11, 'embedded-mf-monitor']]);
    // the Direct primary is the upload's (31 Oct); the embedded Direct table fills at the same date
    assert.deepEqual(r.figure!.asOn, table(OCT, {}).asOn);
  });
  test('primary tables with different dates: the figure is dated by the earliest; each date is listed', () => {
    const SEP30 = ymdToDay(2026, 9, 30)!;
    const up: FundReturnSource = { source: 'uploaded-mf-monitor', plans: { regular: table(OCT, { [both]: r3(12) }), direct: table(SEP30, { [both]: r3(13) }) } };
    const r = weightedFundReturn([fh('a', both, 1, 'regular'), fh('b', both, 1, 'direct')], [up], '3y', 'family');
    assert.equal(v(r.figure!.asOn), SEP30);
    assert.deepEqual(r.used.map((u) => v(u.asOn)), [OCT, SEP30]);
  });
});

describe('ARC-03 Gate B fixes (B1 to B3, L2, L5)', () => {
  const twin = 'Sample Twin Fund';
  const emb: FundReturnSource = {
    source: 'embedded-mf-monitor',
    plans: { regular: table(OCT, { [twin]: r3(10) }), direct: table(OCT, { [twin]: r3(11) }) },
    sourceIds: ['sha-emb'],
  };
  test('B1: a primary used without a date makes the figure date missing, never the date of the other plan', () => {
    const OCT30 = ymdToDay(2026, 10, 30)!;
    const up: FundReturnSource = { source: 'uploaded-mf-monitor', plans: { regular: table(null, { [twin]: r3(12) }), direct: table(OCT30, { [twin]: r3(13) }) } };
    const r = weightedFundReturn([fh('a', twin, 3, 'regular'), fh('b', twin, 1, 'direct')], [up], '3y', 'family');
    near(v(r.figure!.value), (3 * 12 + 13) / 4);
    assert.equal(r.figure!.asOn.kind, 'missing');
    assert.match((r.figure!.asOn as { reason: string }).reason, /Regular table of the uploaded MF Monitor has no as-on date/);
    assert.equal(r.mixed, true);
  });
  test('B2: the figure names the source it used, not the first source passed', () => {
    const up: FundReturnSource = { source: 'uploaded-mf-monitor', plans: { regular: table(OCT, { [twin]: r3(12) }) }, sourceIds: ['sha-up'] };
    const r = weightedFundReturn([fh('b', twin, 1, 'direct')], [up, emb], '3y', 'family');
    assert.equal(r.figure!.source, 'embedded-mf-monitor');
    assert.deepEqual(r.used.map((u) => [u.source, u.plan]), [['embedded-mf-monitor', 'direct']]);
    assert.equal(r.mixed, false);
  });
  test('B2: mixed sources and dates are flagged, and the footnote lists each table', () => {
    const SEP30 = ymdToDay(2026, 9, 30)!;
    const up: FundReturnSource = { source: 'uploaded-mf-monitor', plans: { regular: table(SEP30, { [twin]: r3(12) }) }, sourceIds: ['sha-up'] };
    const r = weightedFundReturn([fh('a', twin, 3, 'regular'), fh('b', twin, 1, 'direct')], [up, emb], '3y', 'family');
    assert.equal(r.mixed, true);
    assert.equal(r.figure!.source, 'uploaded-mf-monitor');
    assert.equal(v(r.figure!.asOn), SEP30);
    assert.equal(
      coverageFootnote(r.figure!, r.used, r.outsideBase),
      '3Y: weighted average return of current holdings. Source: uploaded MF Monitor, Regular plans, as on 2026-09-30; MF Monitor (embedded monthly data), Direct plans, as on 2026-10-31.',
    );
  });
  test('B2: when nothing is used the figure names the primary consulted, and its date', () => {
    const up: FundReturnSource = { source: 'uploaded-mf-monitor', plans: { regular: table(OCT, {}) } };
    const r = weightedFundReturn([fh('b', twin, 1, 'direct')], [up, { source: 'embedded-mf-monitor', plans: { direct: table(SEP, {}) } }], '3y', 'family');
    assert.equal(r.figure!.value.kind, 'missing');
    assert.equal(r.figure!.source, 'embedded-mf-monitor');
    assert.equal(v(r.figure!.asOn), SEP);
  });
  test('B3: an unknown plan is excluded and counted as no-plan; an account plan that disagrees as plan-mismatch', () => {
    const r = weightedFundReturn([fh('a', twin, 2, 'regular'), fh('b', twin, 1, null), { ...fh('c', twin, 1, 'direct'), accountPlan: 'regular' }], [emb], '3y', 'family');
    assert.deepEqual(r.items.map((i) => i.excluded), [null, 'no-plan', 'plan-mismatch']);
    assert.deepEqual(r.figure!.coverage, { share: 0.5, basis: 'mf-value', included: 1, excluded: 2 });
    near(v(r.figure!.value), 10);
    const agree = weightedFundReturn([{ ...fh('c', twin, 1, 'direct'), accountPlan: 'direct' }], [emb], '3y', 'family');
    near(v(agree.figure!.value), 11);
  });
  test('B3: Regular and Direct at 3:1 give 10.25% (a plan swap would give 10.75%)', () => {
    const r = weightedFundReturn([fh('a', twin, 3, 'regular'), fh('b', twin, 1, 'direct')], [emb], '3y', 'family');
    near(v(r.figure!.value), 10.25);
  });
  test('L2: holdings outside the base are counted and named in the footnote', () => {
    const r = weightedFundReturn([fh('a', twin, 1, 'regular'), fh('z', twin, null, 'regular'), fh('y', twin, -1, 'regular')], [emb], '3y', 'family');
    assert.equal(r.outsideBase, 2);
    assert.match(coverageFootnote(r.figure!, r.used, r.outsideBase), /2 holdings without a positive market value not counted/);
  });
  test('L5: coverage just below 100% never reads 100%, just above 0% never reads 0%', () => {
    assert.equal(sharePct(0.9999), '99.9%');
    assert.equal(sharePct(0.0001), '0.1%');
    assert.equal(sharePct(0.8), '80%');
    assert.equal(sharePct(1), '100%');
    assert.equal(sharePct(0), '0%');
  });
});

describe('MOD-04 rulings of 26 Nov 2026', () => {
  const twin = 'Sample Twin Fund';
  test('an explicit "no 3Y" in the primary is never overridden, even by a same-date source', () => {
    const pack = src('screener-pack', OCT, { 'Sample Gamma Fund-Reg(G)': r3(4) });
    const r = weightedFundReturn(book, [embedded, pack], '3y', 'family');
    // Gamma is listed by the embedded monitor without a 3Y return: it keeps that answer
    assert.deepEqual(r.items.map((i) => [i.source, i.excluded]), [['embedded-mf-monitor', null], ['embedded-mf-monitor', null], [null, 'no-return']]);
    near(v(r.figure!.value), 11);
    // a record with no `r` entry for the tenor is also an explicit "no return"
    const bare = src('embedded-mf-monitor', OCT, { X: { r: { '1Y': 5 } } });
    const r2 = weightedFundReturn([fh('x', 'X', 1)], [bare, src('screener-pack', OCT, { X: r3(9) })], '3y', 'family');
    assert.equal(r2.items[0]!.excluded, 'no-return');
  });
  test('parts: a figure from two sources lists each with its share; figure.source stays the primary', () => {
    const up: FundReturnSource = { source: 'uploaded-mf-monitor', plans: { regular: table(OCT, { [twin]: r3(12) }) } };
    const emb: FundReturnSource = { source: 'embedded-mf-monitor', plans: { regular: table(OCT, {}), direct: table(OCT, { [twin]: r3(11) }) } };
    const r = weightedFundReturn([fh('a', twin, 3, 'regular'), fh('b', twin, 1, 'direct')], [up, emb], '3y', 'family');
    assert.equal(r.figure!.source, 'uploaded-mf-monitor');
    assert.deepEqual(r.figure!.parts, [
      { source: 'uploaded-mf-monitor', asOn: table(OCT, {}).asOn, coverage: 0.75 },
      { source: 'embedded-mf-monitor', asOn: table(OCT, {}).asOn, coverage: 0.25 },
    ]);
    assert.equal(r.mixed, true);
  });
  test('parts: one source and one date gives no parts; a same-source fill at the same date is one part', () => {
    const r = weightedFundReturn(book, [embedded], '3y', 'family');
    assert.equal(r.figure!.parts, undefined);
    assert.equal(r.mixed, false);
  });
  test('parts: one source with two dates (Regular and Direct tables) is two parts', () => {
    const OCT30 = ymdToDay(2026, 10, 30)!;
    const up: FundReturnSource = { source: 'uploaded-mf-monitor', plans: { regular: table(OCT, { [twin]: r3(12) }), direct: table(OCT30, { [twin]: r3(13) }) } };
    const r = weightedFundReturn([fh('a', twin, 1, 'regular'), fh('b', twin, 1, 'direct')], [up], '3y', 'family');
    assert.equal(r.figure!.parts?.length, 2);
    assert.deepEqual(r.figure!.parts!.map((p) => [p.source, v(p.asOn), p.coverage]), [['uploaded-mf-monitor', OCT, 0.5], ['uploaded-mf-monitor', OCT30, 0.5]]);
  });
  test('PD-57: the month-end label of a price day; PD-58: the true day only in the notes', () => {
    assert.equal(monthEndLabel(ymdToDay(2026, 11, 2)!), OCT);
    assert.equal(monthEndLabel(ymdToDay(2026, 10, 30)!), OCT);
    assert.equal(monthEndLabel(ymdToDay(2026, 10, 29)!), OCT);
    assert.equal(monthEndLabel(OCT), OCT);
    assert.equal(monthEndLabel(ymdToDay(2026, 10, 24)!), OCT);
    assert.equal(monthEndLabel(ymdToDay(2026, 11, 7)!), OCT);
    assert.equal(monthEndLabel(ymdToDay(2026, 11, 8)!), null);
    assert.equal(monthEndLabel(ymdToDay(2026, 10, 15)!), null);
    assert.equal(monthEndLabel(ymdToDay(2028, 3, 3)!), ymdToDay(2028, 2, 29));
    const m = monitorAsOn('02-Nov-2026');
    assert.equal(v(m.asOn), OCT);
    assert.equal(v(m.priceDay), ymdToDay(2026, 11, 2));
    assert.equal(monitorAsOn('15-Nov-2026').asOn.kind, 'missing');
    assert.equal(monitorAsOn('soon').asOn.kind, 'missing');
    const up: FundReturnSource = { source: 'uploaded-mf-monitor', plans: { regular: { ...table(OCT, { [twin]: r3(12) }), priceDay: m.priceDay } } };
    const r = weightedFundReturn([fh('a', twin, 1, 'regular')], [up], '3y', 'family');
    assert.equal(v(r.figure!.asOn), OCT);
    assert.deepEqual(r.notes, ['uploaded MF Monitor, Regular plans: prices of 2026-11-02 (shown as on 2026-10-31)']);
    const foot = coverageFootnote(r.figure!, r.used, r.outsideBase);
    assert.ok(!foot.includes('2026-11-02'), 'the client footnote never shows the true price day');
    assert.match(foot, /as on 2026-10-31/);
  });
});
