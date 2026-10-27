// covers: E-76 OD-22 OD-18
// Holdings (as loaded): the 43 columns A to AQ; one row per holding, excluded ones included with their reason
// (OD-8); a missing number is a blank cell with its status in the next column; joint holders, or NOT AVAILABLE IN
// SUPPLIED DATA when the file has no holder columns (Q-79); values only; the file's own gain/loss only here (OD-18).
// workbookInputFrom is run on reviews built from the real base-file reader on the synthetic fixtures.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewWorkbook, workbookInputFrom } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import type { Review } from '../../../app/src/model/review.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import type { Value } from '../../../app/src/model/value.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { closeTo } from '../../helpers/formula-eval.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { syntheticFixtures } from '../../fixtures/make-books.ts';
import { sampleInput } from './sample-input.ts';

const HEADERS = ['Instrument Name', 'Client', 'Client Key', 'Joint Holders', 'Joint Holders Status', 'Mode of Holding',
  'Distributor', 'Distributor Key', 'Folio No', 'Product', 'Product Key', 'Category', 'AMC', 'Asset Name (as given)',
  'Asset Class', 'Liquidity', 'Liquidity Key', 'Purchase Date', 'Purchase Date Status', 'Units', 'Units Status',
  'Invested (Cr.)', 'Invested Status', 'Current Market Value (Cr.)', 'Current Market Value Status',
  'Unrealised Gain/Loss (Cr.)', 'Unrealised Gain/Loss Status', 'File Gain/Loss (Cr.)', 'File Gain/Loss Status',
  'Allocation (% CMV)', 'Allocation Status', 'XIRR (%)', 'XIRR Status', 'BMXIRR (%)', 'BMXIRR Status', 'Avg. Holding Days',
  'Avg. Holding Days Status', 'Included', 'Exclusion Reason', 'Invested Present', 'Merge Gaps', 'Holding Id', 'Base File Rows'];

const holdingsTable = (name: Parameters<typeof sampleInput>[0]) =>
  sheetTable(sheetByName(readXlsx(buildOverviewWorkbook(sampleInput(name))), 'Holdings (as loaded)'));

test('the 43 headers, A to AQ; (L) on a Lakh book', () => {
  const t = holdingsTable('standard');
  assert.deepEqual(t[0], HEADERS);
  assert.equal(HEADERS.length, 43);
  const lakh = holdingsTable('lakh')[0]!;
  assert.deepEqual([lakh[21], lakh[23], lakh[25], lakh[27]], ['Invested (L)', 'Current Market Value (L)', 'Unrealised Gain/Loss (L)', 'File Gain/Loss (L)']);
  assert.equal(holdingsTable('lakh')[1]![23], 62.5, 'the Bluechip fund: 62,50,000 rupees is 62.5 Lakh');
});

test('one row per holding, excluded ones with their reason; a missing number blank with its status beside it', () => {
  const t = holdingsTable('na-cmv');
  assert.equal(t.length, 7, 'header and six holdings');
  const flex = t[2]!;
  assert.equal(flex[0], 'Sample Flexi Cap Fund - Regular Plan - Growth');
  assert.deepEqual([flex[23], flex[24]], [null, 'NOT AVAILABLE IN SUPPLIED DATA'], 'CMV blank, status beside it');
  assert.deepEqual([flex[37], flex[38]], ['No', 'No market value (OD-8)']);
  assert.equal(flex[21], 0.4, 'the excluded holding keeps its invested value for the listing');
  assert.deepEqual(t.slice(1).map((r) => r[37]), ['Yes', 'No', 'Yes', 'No', 'Yes', 'Yes']);
  const blank = holdingsTable('blank-invested');
  assert.deepEqual([blank[1]![21], blank[1]![22], blank[1]![39]], [null, 'NOT AVAILABLE IN SUPPLIED DATA', 'No']);
  assert.deepEqual([blank[2]![21], blank[2]![22], blank[2]![39]], [0.4, null, 'Yes']);
});

test('values only: no formula in Holdings (as loaded); the file gain/loss column appears in no other sheet', () => {
  const wb = readXlsx(buildOverviewWorkbook(sampleInput('standard')));
  const h = sheetByName(wb, 'Holdings (as loaded)');
  assert.ok([...h.cells.values()].every((c) => c.f === null));
  for (const s of wb.sheets.filter((x) => x.name !== 'Holdings (as loaded)')) {
    for (const c of s.cells.values()) {
      if (typeof c.v === 'string' && s.name !== '_manifest') assert.ok(!/File Gain/i.test(c.v), `${s.name}!${c.ref}`);
    }
  }
});

test('dates, units and percent numbers as numbers', () => {
  const r = holdingsTable('standard')[1]!;
  assert.equal(r[17], 44942, '16 Jan 2023 as an Excel serial');
  assert.equal(r[19], 12345.678);
  assert.equal(r[31], 14.25, 'XIRR as a percent number');
  assert.ok(closeTo(r[29] as number, (0.625 / 3.353) * 100), 'allocation from CMV over the included total (KI-093)');
  const pms = holdingsTable('standard')[6]!;
  assert.deepEqual([pms[19], pms[20]], [null, 'NOT AVAILABLE IN SUPPLIED DATA'], 'a PMS has no units');
});

describe('workbookInputFrom on the real reader', () => {
  const xlsx = loadSheetJS();
  const fixtures = new Map(syntheticFixtures(xlsx).map((f) => [f.id, f]));
  const SRC = 'e'.repeat(64) as SourceFileId;
  const reviewOf = (id: string): Review => {
    const base = parseBaseFile(readWorkbook(xlsx, fixtures.get(id)!.bytes), { sourceId: SRC, now: () => '2026-10-24T00:00:00.000Z' });
    const incl = base.holdings.filter((h) => h.inclusion.status === 'included');
    const total = incl.reduce((s, h) => s + (h.cmv.kind === 'value' ? h.cmv.v : 0), 0);
    const pv = (v: number, unit: 'cr' | 'pct'): Value<number> => ({ kind: 'value', v, unit, prov: { sources: [SRC], method: 'test' } });
    const holdingMetrics = Object.fromEntries(incl.map((h) => [h.id, {
      assetKey: h.assetClass ?? 'Unknown', liquidity: 'Open Ended',
      gain: h.invested.kind === 'value' && h.cmv.kind === 'value' ? pv(h.cmv.v - h.invested.v, 'cr') : { kind: 'missing', status: 'NOT AVAILABLE IN SUPPLIED DATA', reason: 'test' },
      cmvPct: pv(((h.cmv as { v: number }).v / total) * 100, 'pct'),
    }]));
    return {
      holdings: base.holdings, holdingMetrics, clients: base.clients, distributors: base.distributors, ownership: base.ownership,
      build: { buildId: 'test', channel: 'preview', libraries: [] }, fingerprint: 'f'.repeat(64),
      sources: [{ id: SRC, fileName: `${id}.xlsx`, role: 'base-file', class: 'N', asOn: { kind: 'missing', status: 'NOT AVAILABLE IN SUPPLIED DATA', reason: 'test' }, parserVersion: base.parserVersion, stage: 'review', bytes: 1 }],
      audit: base.audit, issues: base.issues,
    } as unknown as Review;
  };

  test('keys by first appearance, labels as loaded, money in the display unit', () => {
    const vm = sampleInput('standard').vm;
    const input = workbookInputFrom(reviewOf('syn-standard'), vm);
    assert.deepEqual(input.holdings.map((h) => h.clientKey), ['C01', 'C01', 'C01', 'C02', 'C02', 'C02']);
    assert.deepEqual(input.holdings.map((h) => h.distributorKey), ['D01', 'D01', 'D02', 'D01', 'D01', 'D02']);
    assert.deepEqual(input.holdings.map((h) => h.productKey), ['P01', 'P01', 'P01', 'P01', 'P01', 'P02']);
    assert.deepEqual(input.holdings.map((h) => h.liquidityKey), ['L01', 'L01', 'L01', 'L01', 'L01', 'L01']);
    assert.deepEqual(input.holdings.map((h) => h.client), ['Sample Client A', 'Sample Client A', 'Sample Client A', 'Sample Client B', 'Sample Client B', 'Sample Client B']);
    assert.deepEqual(input.holdings.map((h) => (h.cmv.kind === 'value' ? h.cmv.v : null)), [0.625, 0.452, 0.896, 0.339, 0.131, 0.91]);
    assert.deepEqual(input.holdings.map((h) => h.investedPresent), [true, true, true, true, true, true]);
    assert.equal(input.entityKeys.client.length, 2);
    assert.deepEqual(input.entityKeys.client.map((e) => e.key), ['C01', 'C02']);
    assert.equal(input.holdings[0]!.jointHolders, null);
    assert.equal(input.holdings[0]!.jointStatus, 'NOT AVAILABLE IN SUPPLIED DATA', 'no holder columns (Q-79)');
    const lakhVm = sampleInput('lakh').vm;
    const lakh = workbookInputFrom(reviewOf('syn-lakh'), lakhVm);
    const lakhCmv = lakh.holdings.map((h) => (h.cmv.kind === 'value' ? h.cmv.v : Number.NaN));
    [62.5, 45.2, 89.6, 33.9, 13.1, 91].forEach((x, i) => assert.ok(closeTo(lakhCmv[i]!, x), `${lakhCmv[i]} vs ${x}`));
  });

  test('joint holders and the mode of holding from the holder columns', () => {
    const input = workbookInputFrom(reviewOf('syn-holders'), sampleInput('standard').vm);
    assert.deepEqual(input.holdings.slice(0, 4).map((h) => [h.jointHolders, h.jointStatus, h.mode]), [
      ['Sample Joint Holder', null, 'Joint'],
      ['Sample Joint Holder, Sample Third Holder', null, 'Anyone or Survivor'],
      ['', null, 'Single'],
      ['', null, 'Single'],
    ]);
  });

  test('an excluded holding: not in any total, listed with its reason', () => {
    const input = workbookInputFrom(reviewOf('syn-na-cmv'), sampleInput('na-cmv').vm);
    const flex = input.holdings[1]!;
    assert.equal(flex.included, false);
    assert.equal(flex.exclusion, 'No market value (OD-8)');
    assert.equal(flex.gain.kind, 'missing');
    assert.equal(flex.cmvPct.kind, 'missing');
    assert.equal(input.holdings.filter((h) => !h.included).length, 2);
  });
});
