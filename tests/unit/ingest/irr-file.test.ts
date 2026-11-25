// covers: E-05 E-142 OD-16 KI-075 KI-186 KI-211 (the IRR / transactions file reader, NB-M3a; contract I-32)
// The reader on the synthetic workbooks of tests/fixtures/make-irr-files.ts, against expectations worked out by hand
// from the fixture rows (listed in that file), never from the code under test. Run under TZ=Asia/Kolkata and TZ=UTC:
// every date expectation is one calendar day in both. The comparison of the accepted text forms with the live
// parseIRR waits for TA-03 on main (KI-186).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import { parseIrrFile, kindOf, readAmount } from '../../../app/src/ingest/irr-file.ts';
import type { IrrFileImport } from '../../../app/src/model/transactions.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { irrFixtures, DATE_CASES, toWorkbook, FUND_HEADER, fundRow, dateCell } from '../../fixtures/make-irr-files.ts';
import { syntheticFixtures } from '../../fixtures/make-books.ts';

const SRC = 'a'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-11-25T00:00:00.000Z';
const xlsx = loadSheetJS();
const fixtures = new Map(irrFixtures(xlsx).map((f) => [f.id, f]));
const parse = (id: string): IrrFileImport => parseIrrFile(readWorkbook(xlsx, fixtures.get(id)!.bytes), { sourceId: SRC, now: NOW });
const day = (y: number, m: number, d: number): number => ymdToDay(y, m, d)!;
const rules = (imp: IrrFileImport) => imp.issues.map((i) => [i.ruleId.replace('irr-file.', ''), i.severity, i.count] as const);
const issue = (imp: IrrFileImport, r: string) => imp.issues.find((i) => i.ruleId === `irr-file.${r}`);

describe('irr-standard: sheets by name, columns, flows (I-04, E-142)', () => {
  const imp = parse('irr-standard');
  test('sheets and columns', () => {
    assert.deepEqual([imp.fundSheet?.name, imp.fundSheet?.found, imp.fundSheet?.headerRow], ['SI Xirr', 'by-name', 1]);
    assert.deepEqual([imp.benchSheet?.name, imp.benchSheet?.found], ['SI Bmxirr', 'by-name']);
    assert.deepEqual(imp.fundSheet!.columns.map((c) => c.field),
      ['client', 'account', 'instrument', 'folio', 'asset', 'product', 'date', 'type', 'rowType', 'price', 'amount', 'distributor']);
    assert.equal(imp.fundSheet!.columns.find((c) => c.field === 'amount')!.header, 'AMOUNT (₹)');
    assert.equal(imp.benchSheet!.columns.find((c) => c.field === 'amount')!.header, 'BM_AMOUNT (₹)');
  });
  test('fund and bench flows, amounts with their sign, days', () => {
    assert.equal(imp.fund.length, 7);
    assert.equal(imp.bench.length, 5);
    assert.deepEqual(imp.fund.map((t) => t.amountRupees), [-10000, -5000, 17000, -20000, 22000, -8000, 8800]);
    assert.deepEqual(imp.fund.map((t) => t.day), [day(2023, 4, 1), day(2024, 4, 1), day(2025, 3, 31), day(2023, 6, 15), day(2024, 6, 15), day(2024, 1, 1), day(2024, 12, 31)]);
    assert.ok(imp.fund.every((t) => t.dayForm === 'excel-serial'));
    assert.deepEqual(imp.fund.map((t) => t.at.row), [2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(imp.bench.map((t) => t.benchmarkLabel), ['Sample Index 1', 'Sample Index 1', 'Sample Index 1', 'Sample Index 2', 'Sample Index 2']);
  });
  test('types (OD-16): purchase, sip, closing as valuation (row type wins), sip, redemption, switch-in, valuation', () => {
    assert.deepEqual(imp.fund.map((t) => [t.kind, t.direction]), [
      ['purchase', 'in'], ['sip', 'in'], ['valuation', 'valuation'], ['sip', 'in'], ['redemption', 'out'], ['switch-in', 'in'], ['valuation', 'valuation'],
    ]);
  });
  test('price as a value or NOT AVAILABLE; folio as written, a number as its digits, "/01" kept', () => {
    assert.ok(imp.fund[0]!.price.kind === 'value' && imp.fund[0]!.price.v === 50);
    assert.ok(imp.fund[2]!.price.kind === 'missing' && imp.fund[2]!.price.status === STATUS.NOT_AVAILABLE);
    assert.deepEqual(imp.fund.map((t) => t.folio), ['SYN-1001', 'SYN-1001', 'SYN-1001', '1003', '1003', 'SYN-2001/01', 'SYN-2001/01']);
    assert.ok(imp.fund.every((t) => t.instrument === null && t.folioId === null));
  });
  test('distributor: read where given; the two Balanced flows unassigned (E-142, Q-57)', () => {
    assert.equal(imp.hasDistributor, true);
    assert.equal(imp.counts.unassigned, 2);
    assert.deepEqual(imp.fund.map((t) => t.distributorLabel), ['Sample Distributor 1', 'Sample Distributor 1', 'Sample Distributor 1', 'Sample Distributor 2', 'Sample Distributor 2', null, null]);
    assert.equal(new Set(imp.fund.map((t) => t.distributorId).filter((x) => x !== null)).size, 2);
    assert.equal(issue(imp, 'unassigned-flows')!.count, 2);
  });
  test('as-on date: the last fund flow (31 Mar 2025)', () => {
    assert.ok(imp.asOn.kind === 'value' && imp.asOn.v === day(2025, 3, 31));
  });
  test('client ids share the base file\'s key (KI-111): the same label gives the same id', () => {
    const base = syntheticFixtures(xlsx).find((f) => f.id === 'syn-standard') ?? syntheticFixtures(xlsx)[0]!;
    const bimp = parseBaseFile(readWorkbook(xlsx, base.bytes), { sourceId: SRC, now: NOW });
    const byLabel = new Map(bimp.clients.map((c) => [c.label, c.id]));
    for (const t of imp.fund) assert.equal(t.clientId, byLabel.get(t.clientLabel), t.clientLabel);
  });
  test('validation results and audit', () => {
    assert.deepEqual(rules(imp), [['sheet-used', 'Information', undefined], ['unassigned-flows', 'Information', 2]]);
    assert.equal(imp.audit.length, 1);
    assert.equal(imp.audit[0]!.detail.fundFlows, 7);
    assert.ok(!JSON.stringify(imp.issues).includes('Sample Client'), 'messages name no client');
  });
});

describe('irr-dates: the free-text date rule (KI-186, KI-211), same day in every time zone', () => {
  const imp = parse('irr-dates');
  test('each form read as written, or skipped as unreadable-date', () => {
    const kept = DATE_CASES.filter((c) => c.expect !== null);
    assert.equal(imp.fund.length, kept.length + 1);
    kept.forEach((c, i) => assert.equal(imp.fund[i]!.day, day(...c.expect!), `case ${i}: ${JSON.stringify(c.cell)}`));
    assert.deepEqual(imp.fund.slice(0, kept.length).map((t) => t.dayForm), ['excel-serial', 'text', 'text', 'text', 'text', 'text', 'text']);
    const unread = imp.skipped.filter((s) => s.reason === 'unreadable-date');
    assert.deepEqual(unread.map((s) => s.at.row), [9, 10, 11, 12, 13]);
    assert.ok(unread.every((s) => s.hasMoney));
    assert.equal(issue(imp, 'skipped-unreadable-date')!.severity, 'Warning');
    assert.equal(issue(imp, 'skipped-unreadable-date')!.count, 5);
  });
  test('the process time zone is what the test runner set (both runs must pass)', () => {
    assert.ok(['Asia/Kolkata', 'UTC', undefined].includes(process.env.TZ));
  });
});

describe('irr-mixed: amounts, OD-16 types and skip reasons (KI-075)', () => {
  const imp = parse('irr-mixed');
  test('amount forms', () => {
    assert.deepEqual(imp.fund.slice(0, 3).map((t) => t.amountRupees), [123456.5, 1000, -1000]);
    assert.deepEqual(readAmount({ t: 's', v: '(-5)' }), { kind: 'invalid' });
    assert.deepEqual(readAmount({ t: 's', v: '12%' }), { kind: 'invalid' });
    assert.deepEqual(readAmount({ t: 's', v: '-₹2,500' }), { kind: 'number', v: -2500 });
  });
  test('every skip reason counted, by row, with hasMoney', () => {
    assert.deepEqual(imp.skipped.map((s) => [s.at.row, s.reason, s.hasMoney]), [
      [5, 'invalid-amount', false], [6, 'no-amount', false], [7, 'no-amount', false], [8, 'no-client', true],
      [9, 'blank-row', false], [10, 'repeated-header', false],
    ]);
    assert.deepEqual(imp.counts.skipped, { 'blank-row': 1, 'repeated-header': 1, 'no-client': 1, 'no-amount': 2, 'invalid-amount': 1, 'unreadable-date': 0 });
  });
  test('types and directions; unrecognised labels counted as written', () => {
    assert.deepEqual(imp.fund.slice(3).map((t) => t.kind), [
      'top-up', 'stp-in', 'swp', 'stock-in', 'transfer-out', 'unrecognised', 'unrecognised', 'bonus', 'demerger-in', 'switch-out', 'purchase', 'redemption', 'untyped',
    ]);
    assert.deepEqual(imp.unrecognisedTypes, [{ label: 'Dividend Reinvest', rows: 1 }, { label: 'dividend reinvest', rows: 1 }]);
    assert.equal(issue(imp, 'unrecognised-types')!.count, 2);
    assert.deepEqual(kindOf('STP Out', null), { kind: 'stp-out', direction: 'out' });
    assert.deepEqual(kindOf(null, 'Closing Balance'), { kind: 'valuation', direction: 'valuation' });
  });
  test('validation results by severity', () => {
    assert.deepEqual(rules(imp), [
      ['sheet-used', 'Information', undefined],
      ['no-bench-sheet', 'Warning', undefined],
      ['skipped-blank-row', 'Information', 1],
      ['skipped-repeated-header', 'Information', 1],
      ['skipped-no-client', 'Warning', 1],
      ['skipped-no-amount', 'Warning', 2],
      ['skipped-invalid-amount', 'Warning', 1],
      ['unrecognised-types', 'Warning', 2],
    ]);
  });
});

describe('sheets by content, and refused files', () => {
  test('irr-by-content: found by headers below a title row; no DISTRIBUTOR column', () => {
    const imp = parse('irr-by-content');
    assert.deepEqual([imp.fundSheet?.name, imp.fundSheet?.found, imp.fundSheet?.headerRow], ['Fund flows', 'by-content', 3]);
    assert.deepEqual([imp.benchSheet?.name, imp.benchSheet?.found, imp.benchSheet?.headerRow], ['Index flows', 'by-content', 3]);
    assert.equal(imp.fund.length, 7);
    assert.equal(imp.hasDistributor, false);
    assert.equal(imp.counts.unassigned, 7);
    assert.ok(issue(imp, 'no-distributor-column'));
    assert.deepEqual(imp.sheets.map((s) => [s.sheet, s.outcome]), [['Notes', 'no-header'], ['Fund flows', 'used'], ['Index flows', 'used']]);
  });
  test('irr-no-fund: Blocking no-fund-sheet; as-on NOT AVAILABLE', () => {
    const imp = parse('irr-no-fund');
    assert.deepEqual(rules(imp), [['no-fund-sheet', 'Blocking', undefined], ['no-bench-sheet', 'Warning', undefined]]);
    assert.ok(imp.asOn.kind === 'missing' && imp.asOn.status === STATUS.NOT_AVAILABLE);
    assert.equal(imp.fund.length, 0);
  });
  test('irr-two-fund-sheets: the last sheet named with Xirr wins (legacy rule)', () => {
    const imp = parse('irr-two-fund-sheets');
    assert.equal(imp.fundSheet?.name, 'SI Xirr');
    assert.equal(imp.fund.length, 7);
    assert.deepEqual(imp.sheets.map((s) => s.outcome), ['not-needed', 'used']);
  });
});

describe('OD-4 duplicate folios: flagged, never altered (financial review of 058a94c, finding 5)', () => {
  test('a folio under two clients and another under two instruments: 2 flagged; the flows read as written', () => {
    const rows = [
      FUND_HEADER,
      fundRow('Sample Client A', 'Sample Bluechip Fund', 'SYN-9001', 'Equity', dateCell(2023, 4, 1), 'Purchase', null, 10, -100, null),
      fundRow('Sample Client B', 'Sample Bluechip Fund', 'SYN-9001', 'Equity', dateCell(2023, 4, 2), 'Purchase', null, 10, -100, null),
      fundRow('Sample Client A', 'Sample Bond Fund', 'SYN-9002', 'Debt', dateCell(2023, 4, 1), 'Purchase', null, 10, -100, null),
      fundRow('Sample Client A', 'Sample Gilt Fund', 'SYN-9002', 'Debt', dateCell(2023, 4, 3), 'Purchase', null, 10, -100, null),
      fundRow('Sample Client A', 'sample  BOND fund', 'SYN-9003', 'Debt', dateCell(2023, 4, 3), 'Purchase', null, 10, -100, null),
      fundRow('Sample Client A', 'Sample Bond Fund', 'SYN-9003', 'Debt', dateCell(2023, 4, 4), 'Purchase', null, 10, -100, null),
    ];
    const imp = parseIrrFile(readWorkbook(xlsx, toWorkbook(xlsx, [{ name: 'Dup Xirr', rows }])), { sourceId: SRC, now: NOW });
    const i = issue(imp, 'duplicate-folios')!;
    assert.deepEqual([i.severity, i.count], ['Warning', 2]);
    assert.ok(!i.message.includes('SYN-'), 'the folio never appears in a message');
    assert.equal(imp.fund.length, 6);
    assert.deepEqual(imp.fund.map((t) => t.folio), ['SYN-9001', 'SYN-9001', 'SYN-9002', 'SYN-9002', 'SYN-9003', 'SYN-9003']);
  });
});
