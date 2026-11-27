// covers: U-08 U-09 U-10 E-31 KI-083 M3
// The performance tables' sources (app/src/data/performance-sources.ts; financial review of 27 Nov 2026, S5): an
// uploaded monitor stands in for its block with the date the file states, read when the text is a date ("As on
// 2026-Nov-02", "31-Oct-2026"); a text that is not a date is reported with that text, never as "not given"; no text is
// NOT AVAILABLE; the embedded blocks keep their VINTAGE dates; the captions follow.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { performanceSourcesFrom, uploadedDay } from '../../../app/src/data/performance-sources.ts';
import { computePerformance } from '../../../app/src/engine/returns/performance.ts';
import { buildPerformanceVM } from '../../../app/src/views/performance.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { dayToIso } from '../../../app/src/engine/dates.ts';
import type { Holding } from '../../../app/src/model/holding.ts';
import { FILE_BLOCK_TEXT } from '../../helpers/node-wiring.ts';

const isoOf = (v: { kind: string; v?: number }): string | null => (v.kind === 'value' ? dayToIso(v.v as never) : null);
const UPLOADED = { 'Zeta Large Cap Fund-Reg(G)': { aum: 1, inception: '2015-01-01', r: { '1Y': 5, '3Y': 6 } } };

describe('uploadedDay', () => {
  test('a readable date, with or without "As on"', () => {
    assert.equal(isoOf(uploadedDay('As on 2026-Nov-02', 'MF Monitor')), '2026-11-02');
    assert.equal(isoOf(uploadedDay('31-Oct-2026', 'Direct monitor')), '2026-10-31');
  });
  test('a text that is not a date: INVALID SOURCE DATA with the text; no text: NOT AVAILABLE', () => {
    const bad = uploadedDay('2-November-26', 'MF Monitor');
    assert.ok(bad.kind === 'missing' && bad.status === STATUS.INVALID_SOURCE && bad.reason === 'the file\'s date could not be read: 2-November-26');
    const none = uploadedDay(undefined, 'MF Monitor');
    assert.ok(none.kind === 'missing' && none.status === STATUS.NOT_AVAILABLE);
  });
});

describe('performanceSourcesFrom', () => {
  test('without uploads, the embedded blocks and their VINTAGE dates', () => {
    const s = performanceSourcesFrom({ blocks: {}, dates: {} }, FILE_BLOCK_TEXT);
    assert.equal(isoOf(s.asOn.MF!), '2026-10-31');
    assert.ok(s.MF && Object.keys(s.MF).length > 1000);
    assert.equal(s.asOn.PMS!.kind, 'missing');
  });

  test('an uploaded Regular monitor replaces MF_PERF with its own date; the captions follow, readable or not', () => {
    const h = { id: 'h1', instrumentName: 'Zeta Large Cap Fund', product: 'Mutual Funds', assetClass: 'Equity', categoryLabel: 'Large Cap Fund', inclusion: { status: 'included' },
      cmv: { kind: 'value', v: 1, unit: 'cr', prov: { sources: [], method: 't' } },
      instrument: { productClass: 'MF', nameKey: 'zeta', vendorKey: 'Zeta Large Cap Fund-Reg(G)', resolution: { method: 'name-match', confidence: 'exact' } } } as unknown as Holding;
    const read = performanceSourcesFrom({ blocks: { MF_PERF: UPLOADED as never }, dates: { MF_PERF: 'As on 2026-Nov-02' } }, FILE_BLOCK_TEXT);
    assert.deepEqual(Object.keys(read.MF!), ['Zeta Large Cap Fund-Reg(G)']);
    assert.equal(buildPerformanceVM(computePerformance([h], read)).buckets[0]!.title, 'Equity MF, Regular plans, as on 2 Nov 2026');
    const unread = performanceSourcesFrom({ blocks: { MF_PERF: UPLOADED as never }, dates: { MF_PERF: '2-November-26' } }, FILE_BLOCK_TEXT);
    assert.equal(buildPerformanceVM(computePerformance([h], unread)).buckets[0]!.title, 'Equity MF, Regular plans, the file\'s date could not be read: 2-November-26');
  });
});
