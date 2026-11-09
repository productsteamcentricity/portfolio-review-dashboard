// covers: E-21 OD-18 OD-8 KI-007
// The review totals (engine/aggregate/totals.ts) on the synthetic book, against known answers worked out by hand from
// its rupee values (tests/fixtures/make-books.ts SYNTHETIC_BOOK; rupees / 1e7 = Crore), never from the code under test.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Holding } from '../../../app/src/model/holding.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import type { Value } from '../../../app/src/model/value.ts';
import type { Cell, Workbook } from '../../../app/src/ingest/workbook.ts';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import { computeTotals, METHOD } from '../../../app/src/engine/aggregate/totals.ts';
import { computeAssetAllocation } from '../../../app/src/engine/aggregate/allocation.ts';
import { sumPresent } from '../../../app/src/engine/aggregate/sum.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { overviewVariants, SYNTHETIC_BOOK, syntheticFixtures } from '../../fixtures/make-books.ts';

const xlsx = loadSheetJS();
const SRC = 'e'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-10-24T00:00:00.000Z';
const FIX = new Map([...syntheticFixtures(xlsx), ...overviewVariants(xlsx, SYNTHETIC_BOOK, 'syn')].map((f) => [f.id, f]));
const holdingsOf = (id: string): Holding[] => {
  const f = FIX.get(id);
  if (!f) throw new Error(`no fixture ${id}`);
  return parseBaseFile(readWorkbook(xlsx, f.bytes), { sourceId: SRC, now: NOW, ...(f.answers ? { answers: f.answers } : {}) }).holdings;
};
const v = (x: Value<number>): number | null => (x.kind === 'value' ? x.v : null);
const st = (x: Value<number>): string | null => (x.kind === 'missing' ? x.status : null);
const close = (a: number | null | undefined, b: number, msg = ''): void => {
  assert.ok(typeof a === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${msg} ${a} != ${b}`);
};

describe('sumPresent', () => {
  test('adds the present values in order and counts the missing ones; a missing value never adds 0', () => {
    const p = { sources: [], method: 't' };
    const r = sumPresent([present(1.5, 'cr', p), missing(STATUS.NOT_AVAILABLE, 'blank'), present(2, 'cr', p), missing(STATUS.INVALID_SOURCE, 'text')]);
    assert.deepEqual(r, { sum: 3.5, present: 2, missing: 2, invalid: 1 });
    assert.deepEqual(sumPresent([]), { sum: 0, present: 0, missing: 0, invalid: 0 });
  });
});

describe('totals over the included holdings (OD-8, OD-18, KI-007)', () => {
  test('syn-standard: CMV 3.353, invested 2.85, gain 0.503, absolute return 17.6491228070175 %, complete', () => {
    const t = computeTotals(holdingsOf('syn-standard'));
    close(v(t.cmv), 3.353, 'cmv');
    close(v(t.invested), 2.85, 'invested');
    close(v(t.gain), 0.503, 'gain');
    close(v(t.absReturnPct), 17.649122807017545, 'absolute return');
    close(v(t.investedCoveragePct), 100);
    for (const x of [t.invested, t.gain, t.absReturnPct]) assert.ok(x.kind === 'value' && x.coverage === undefined, 'no coverage: complete');
    assert.deepEqual(t.counts, { included: 6, excluded: 0, withoutInvested: 0, invalidInvested: 0, clients: 2, withoutClient: 0, distributors: 2, withoutDistributor: 0 });
    assert.equal(t.cmv.kind === 'value' && t.cmv.unit, 'cr');
    assert.equal(t.absReturnPct.kind === 'value' && t.absReturnPct.unit, 'pct');
    assert.ok(t.gain.kind === 'value' && t.gain.prov.method === METHOD.gain && /OD-18/.test(t.gain.prov.method));
    assert.deepEqual(t.cmv.kind === 'value' && t.cmv.prov.sources, [SRC]);
  });
  test('syn-na-cmv: CMV 2.562 and invested 2.15, not 2.55: the excluded Flexi Cap keeps its 0.4 Cr but is not counted', () => {
    const hs = holdingsOf('syn-na-cmv');
    const flexi = hs.find((h) => /Flexi Cap/.test(h.instrumentName))!;
    assert.equal(flexi.inclusion.status, 'excluded');
    close(v(flexi.invested), 0.4);
    const t = computeTotals(hs);
    close(v(t.cmv), 2.562);
    close(v(t.invested), 2.15);
    close(v(t.gain), 0.412);
    assert.deepEqual([t.counts.included, t.counts.excluded], [4, 2]);
  });
  test('syn-blank-invested: invested 1.55 and gain 0.282 over the same holdings, coverage 0.5463763793617655, return 18.1935483870968 %', () => {
    const t = computeTotals(holdingsOf('syn-blank-invested'));
    close(v(t.cmv), 3.353);
    close(v(t.invested), 1.55);
    close(v(t.gain), 0.282);
    close(v(t.absReturnPct), 18.193548387096776);
    close(v(t.investedCoveragePct), 54.63763793617655);
    for (const x of [t.invested, t.gain, t.absReturnPct]) close(x.kind === 'value' ? x.coverage : null, 0.5463763793617655, 'coverage');
    assert.equal(t.counts.withoutInvested, 2);
  });
  test('syn-no-invested: invested, gain and absolute return are NOT AVAILABLE, never 0; coverage 0', () => {
    const t = computeTotals(holdingsOf('syn-no-invested'));
    close(v(t.cmv), 3.353);
    for (const x of [t.invested, t.gain, t.absReturnPct]) assert.equal(st(x), STATUS.NOT_AVAILABLE);
    assert.equal(v(t.investedCoveragePct), 0);
    assert.equal(t.counts.withoutInvested, 6);
  });
  test('syn-negative-gain: market values at 70 %: gain 2.3471 - 2.85 = -0.5029, return -17.6456140350877 %', () => {
    const t = computeTotals(holdingsOf('syn-negative-gain'));
    close(v(t.cmv), 2.3471);
    close(v(t.gain), -0.5029);
    close(v(t.absReturnPct), -17.645614035087718);
  });
  test('syn-money-columns: an invalid invested value is counted apart (KI-147)', () => {
    const t = computeTotals(holdingsOf('syn-money-columns'));
    close(v(t.cmv), 2.832);
    close(v(t.invested), 2.25);
    close(v(t.gain), 0.451);
    assert.deepEqual([t.counts.included, t.counts.excluded, t.counts.withoutInvested, t.counts.invalidInvested], [5, 1, 1, 1]);
  });
  test('syn-blank-entities: holdings without a client or distributor are counted, not made a client', () => {
    const t = computeTotals(holdingsOf('syn-blank-entities'));
    assert.deepEqual([t.counts.clients, t.counts.withoutClient, t.counts.distributors, t.counts.withoutDistributor], [2, 2, 2, 1]);
  });
  test('a total CMV of 0 gives NOT APPLICABLE shares and coverage; an invested total of 0 gives NOT APPLICABLE return', () => {
    const t = computeTotals(tinyHoldings([{ cmv: 0, inv: 1 }, { cmv: 0, inv: 2 }]));
    assert.equal(v(t.cmv), 0);
    assert.equal(st(t.investedCoveragePct), STATUS.NOT_APPLICABLE);
    close(v(t.gain), -3);
    const a = computeAssetAllocation(tinyHoldings([{ cmv: 0, inv: 1 }]), t);
    assert.equal(st(a.assets[0]!.line.pct), STATUS.NOT_APPLICABLE);
    assert.equal(st(a.total.pct), STATUS.NOT_APPLICABLE);
    const z = computeTotals(tinyHoldings([{ cmv: 1, inv: 0 }, { cmv: 2, inv: 0 }]));
    assert.equal(v(z.invested), 0);
    close(v(z.gain), 3);
    assert.equal(st(z.absReturnPct), STATUS.NOT_APPLICABLE);
  });
  test('no included holding: every total is NOT AVAILABLE and nothing is counted', () => {
    const t = computeTotals(tinyHoldings([{ cmv: null, inv: 1 }]));
    for (const x of [t.cmv, t.invested, t.gain, t.absReturnPct, t.investedCoveragePct]) assert.equal(st(x), STATUS.NOT_AVAILABLE);
    assert.deepEqual([t.counts.included, t.counts.excluded], [0, 1]);
  });
});

/** Holdings read from a tiny in-memory Crore book (no SheetJS). */
function tinyHoldings(rows: Array<{ cmv: number | null; inv: number | null }>): Holding[] {
  const s = (t: string): Cell => ({ t: 's', v: t });
  const n = (x: number | null): Cell => (x === null ? null : { t: 'n', v: x, fmt: null, date: false });
  const head = ['Client Name', 'Instrument Name', 'Asset Name', 'Invested Value (Cr.)', 'Current Market Value (Cr.)'].map(s);
  const data = rows.map((r, i) => [s('Sample Client A'), s(`Sample Fund ${i + 1}`), s('Equity'), n(r.inv), n(r.cmv)]);
  const wb: Workbook = { sheets: [{ name: 'Base File', hidden: false, rows: [head, ...data] }], date1904: false };
  return parseBaseFile(wb, { sourceId: SRC, now: NOW }).holdings;
}
