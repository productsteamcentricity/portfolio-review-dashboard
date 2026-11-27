// covers: E-05 E-142 OD-16 KI-075 KI-186 KI-211 (the IRR / transactions file reader, NB-M3a; contract I-32)
// The reader on the synthetic workbooks of tests/fixtures/make-irr-files.ts, against expectations worked out by hand
// from the fixture rows (listed in that file), never from the code under test. Run under TZ=Asia/Kolkata and TZ=UTC:
// every date expectation is one calendar day in both. The comparison of the accepted text forms with the live
// parseIRR waits for TA-03 on main (KI-186).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import { parseIrrFile, kindOf, readAmount, sheetPeriodOf } from '../../../app/src/ingest/irr-file.ts';
import type { IrrFileImport } from '../../../app/src/model/transactions.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { irrFixtures, DATE_CASES, toWorkbook, FUND_HEADER, BENCH_HEADER, fundRow, dateCell } from '../../fixtures/make-irr-files.ts';
import { syntheticFixtures } from '../../fixtures/make-books.ts';

const SRC = 'a'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-11-25T00:00:00.000Z';
const xlsx = loadSheetJS();
const fixtures = new Map(irrFixtures(xlsx).map((f) => [f.id, f]));
const parse = (id: string): IrrFileImport => parseIrrFile(readWorkbook(xlsx, fixtures.get(id)!.bytes), { sourceId: SRC, now: NOW });
const day = (y: number, m: number, d: number): number => ymdToDay(y, m, d)!;
const rules = (imp: IrrFileImport) => imp.issues.map((i) => [i.ruleId.replace('irr-file.', ''), i.severity, i.count] as const);
const issue = (imp: IrrFileImport, r: string) => imp.issues.find((i) => i.ruleId === `irr-file.${r}`);

describe('irr-cashflow: the platform\'s six-sheet cashflow layout (the owner\'s layout of 26 Nov 2026)', () => {
  const imp = parse('irr-cashflow');
  test('the since-inception pair is read, whatever the YTD and QTD sheets after it', () => {
    assert.deepEqual([imp.fundSheet?.name, imp.fundSheet?.found, imp.fundSheet?.headerRow], ['SI Xirr', 'by-name', 1]);
    assert.deepEqual([imp.benchSheet?.name, imp.benchSheet?.found], ['SI Bmxirr', 'by-name']);
    assert.deepEqual(imp.sheets.map((s) => [s.sheet, s.outcome]), [
      ['SI Xirr', 'used'], ['SI Bmxirr', 'used'], ['YTD Xirr', 'not-needed'], ['YTD Bmxirr', 'not-needed'],
      ['QTD Xirr', 'not-needed'], ['QTD Bmxirr', 'not-needed'],
    ]);
  });
  test('every heading of the export is recognised: the rupee sign and trailing spaces, TRANSACTIONTYPE, INDEXNAME', () => {
    assert.deepEqual(imp.fundSheet!.columns.map((c) => c.field).sort(),
      ['account', 'amount', 'asset', 'category', 'client', 'date', 'distributor', 'folio', 'instrument', 'price', 'product', 'rowType', 'type']);
    // The export writes "AMOUNT (₹) " with a trailing space; the reader keeps the heading as text, trimmed.
    assert.equal(imp.fundSheet!.columns.find((c) => c.field === 'amount')!.header, 'AMOUNT (₹)');
    assert.equal(imp.fundSheet!.columns.find((c) => c.field === 'price')!.header, 'PRICE (₹)');
    assert.ok(imp.fundSheet!.columns.some((c) => c.field === 'type' && c.header === 'TRANSACTIONTYPE'));
    assert.ok(imp.benchSheet!.columns.some((c) => c.field === 'benchmark' && c.header === 'INDEXNAME'));
    assert.equal(imp.benchSheet!.columns.find((c) => c.field === 'amount')!.header, 'BM_AMOUNT (₹)');
    assert.equal(imp.hasDistributor, true);
  });
  test('the SI flows, hand listed: 7 fund and 5 benchmark flows; account, folio as number or text, price, category, index', () => {
    // Worked from the fixture rows: the SI fund sheet has 7 rows, the SI benchmark sheet 5; the YTD and QTD rows (Jan
    // to Mar 2025, one pair each) are not among them.
    assert.deepEqual([imp.fund.length, imp.bench.length, imp.skipped.length], [7, 5, 0]);
    assert.ok(!imp.fund.some((t) => t.day === day(2025, 1, 1)), 'no YTD or QTD flow');
    const blue = imp.fund[0]!;
    assert.deepEqual([blue.accountLabel, blue.folio, blue.categoryLabel, blue.amountRupees, blue.distributorLabel, blue.day],
      ['Sample Client A - Joint', 'SYN-1001', 'Large Cap Fund', -10000, 'Centricity', day(2023, 4, 1)]);
    assert.ok(blue.price.kind === 'value' && blue.price.v === 50);
    assert.equal(imp.fund[3]!.folio, '1003', 'a folio written as a number reads as its text');
    assert.equal(imp.bench[0]!.benchmarkLabel, 'Sample Index 1');
    assert.equal(imp.fund.filter((t) => t.direction === 'valuation').length, 2);
  });
});

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
      // F7 (Gate B of d6401f6): rows 2 and 3 are purchases written positive (+123,456.50 and +1,000).
      ['contrary-signs', 'Warning', 2],
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

// ARC-03's low finding on PLAN-05: "SI" must be the name's first word. A sheet whose name merely starts with the letters
// SI ("SIP Xirr", a later sheet) must not replace the since-inception sheet; a reader that takes "SI" anywhere in the
// name (or as a bare prefix) would read the SIP sheet's flows and fails here.
describe('the since-inception sheet is "SI" as a word: "SI Xirr" wins over a later "SIP Xirr"', () => {
  test('fund and benchmark: the SI pair is read, the SIP pair is not needed', () => {
    const A = 'Sample Client A';
    const F = 'Sample Bluechip Fund';
    const fund = (amount: number, d: number): ReturnType<typeof fundRow> => fundRow(A, F, 'SYN-1001', 'Equity', dateCell(2024, 1, d), 'Purchase', null, 10, amount, null);
    const bench = (amount: number, d: number): Array<string | number | null | { v: number; z: string }> => [A, F, 'Equity', 'Mutual Funds', dateCell(2024, 1, d), 'Sample Index 1', amount];
    const wb = toWorkbook(xlsx, [
      { name: 'SI Xirr', rows: [FUND_HEADER, fund(-100, 1), fund(-200, 2)] },
      { name: 'SI Bmxirr', rows: [BENCH_HEADER, bench(-100, 1), bench(-200, 2)] },
      { name: 'SIP Xirr', rows: [FUND_HEADER, fund(-7, 9)] },
      { name: 'SIP Bmxirr', rows: [BENCH_HEADER, bench(-7, 9)] },
    ]);
    const imp = parseIrrFile(readWorkbook(xlsx, wb), { sourceId: SRC, now: NOW });
    assert.equal(imp.fundSheet?.name, 'SI Xirr');
    assert.equal(imp.benchSheet?.name, 'SI Bmxirr');
    assert.deepEqual(imp.fund.map((t) => t.amountRupees), [-100, -200]);
    assert.deepEqual(imp.bench.map((t) => t.amountRupees), [-100, -200]);
    assert.deepEqual(imp.sheets.map((s) => s.outcome), ['used', 'used', 'not-needed', 'not-needed']);
  });
});

// MOD-04's follow-up to PLAN-05, the sheet-pairing guard: the fund and benchmark sheets come from the same period (the
// first word of the name: SI, YTD or QTD). Each benchmark sheet carries its own amount, so the test sees which was read.
describe('the sheet-pairing guard: fund and benchmark sheets of the same period', () => {
  const A = 'Sample Client A';
  const F = 'Sample Bluechip Fund';
  const fundSheet = (name: string, amount = -100): { name: string; rows: ReturnType<typeof fundRow>[] } =>
    ({ name, rows: [FUND_HEADER, fundRow(A, F, 'SYN-1001', 'Equity', dateCell(2024, 1, 1), 'Purchase', null, 10, amount, null)] });
  const benchSheet = (name: string, amount: number): { name: string; rows: Array<Array<string | number | null | { v: number; z: string }>> } =>
    ({ name, rows: [BENCH_HEADER, [A, F, 'Equity', 'Mutual Funds', dateCell(2024, 1, 1), 'Sample Index 1', amount]] });
  const read = (sheets: Parameters<typeof toWorkbook>[1]): IrrFileImport => parseIrrFile(readWorkbook(xlsx, toWorkbook(xlsx, sheets)), { sourceId: SRC, now: NOW });

  test('SI fund with only a YTD benchmark: no benchmark read, a Warning naming the two sheets', () => {
    const imp = read([fundSheet('SI Xirr'), benchSheet('YTD Bmxirr', -2)]);
    assert.equal(imp.fundSheet?.name, 'SI Xirr');
    assert.equal(imp.benchSheet, null);
    assert.equal(imp.bench.length, 0);
    const i = issue(imp, 'sheet-period-mismatch')!;
    assert.equal(i.severity, 'Warning');
    assert.ok(i.message.includes('"YTD Bmxirr"') && i.message.includes('"SI Xirr"'), i.message);
    assert.ok(!new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`).test(i.message), 'no en or em dash (D-029)');
    assert.equal(issue(imp, 'no-bench-sheet'), undefined, 'the mismatch is said in place of "no benchmark sheet"');
    assert.deepEqual(imp.sheets.map((s) => [s.sheet, s.outcome]), [['SI Xirr', 'used'], ['YTD Bmxirr', 'not-needed']]);
  });

  test('SI fund with SI and YTD benchmarks, in either order: the SI benchmark is read, no Warning', () => {
    for (const order of [['SI Bmxirr', 'YTD Bmxirr'], ['YTD Bmxirr', 'SI Bmxirr']]) {
      const imp = read([fundSheet('SI Xirr'), ...order.map((n) => benchSheet(n, n.startsWith('SI') ? -1 : -2))]);
      assert.equal(imp.benchSheet?.name, 'SI Bmxirr', order.join(', '));
      assert.deepEqual(imp.bench.map((t) => t.amountRupees), [-1]);
      assert.equal(issue(imp, 'sheet-period-mismatch'), undefined);
    }
  });

  test('a YTD fund sheet (no SI fund sheet) with SI and YTD benchmarks: the YTD benchmark, not the SI one', () => {
    const imp = read([fundSheet('YTD Xirr'), benchSheet('SI Bmxirr', -1), benchSheet('YTD Bmxirr', -2)]);
    assert.deepEqual([imp.fundSheet?.name, imp.benchSheet?.name], ['YTD Xirr', 'YTD Bmxirr']);
    assert.deepEqual(imp.bench.map((t) => t.amountRupees), [-2]);
    assert.equal(issue(imp, 'sheet-period-mismatch'), undefined);
    assert.equal(issue(imp, 'no-si-sheet')?.severity, 'Blocking', 'F6: a YTD fund sheet is refused');
  });

  test('a QTD-only pair is paired, the period read without regard to case (and refused: no SI sheet, F6)', () => {
    const imp = read([fundSheet('QTD Xirr'), benchSheet('qtd Bmxirr', -3)]);
    assert.deepEqual([imp.fundSheet?.name, imp.benchSheet?.name], ['QTD Xirr', 'qtd Bmxirr']);
    assert.deepEqual(imp.bench.map((t) => t.amountRupees), [-3]);
    assert.equal(issue(imp, 'sheet-period-mismatch'), undefined);
    assert.equal(issue(imp, 'no-si-sheet')?.severity, 'Blocking');
  });

  test('legacy names (no period) pair as before, with or without a period on the other sheet', () => {
    for (const [f, b] of [['Old Xirr', 'Old Bmxirr'], ['SI Xirr', 'Index Bmxirr'], ['Fund Xirr', 'YTD Bmxirr']]) {
      const imp = read([fundSheet(f!), benchSheet(b!, -4)]);
      assert.deepEqual([imp.fundSheet?.name, imp.benchSheet?.name], [f, b]);
      assert.equal(issue(imp, 'sheet-period-mismatch'), undefined);
    }
  });

  test('sheetPeriodOf: SI, YTD or QTD as the first word only', () => {
    assert.deepEqual(['SI Xirr', 'ytd Bmxirr', ' QTD Xirr', 'SIP Xirr', 'Old SI Xirr', 'YTDX Xirr', 'Xirr'].map(sheetPeriodOf),
      ['SI', 'YTD', 'QTD', null, null, null, null]);
  });

  // Gate B of d6401f6, F5 (c) (MOD-05): space, underscore, hyphen and dot separate the period word; the word joined to
  // "Xirr" or "Bm" is recognised; the words are SI, YTD, QTD, MTD and FYTD. "SIP" is still not SI.
  test('F5 (c): sheetPeriodOf with separators, joined forms, MTD and FYTD; "SIP Xirr" still has no period', () => {
    const names = ['SI_Xirr', 'YTD_Bmxirr', 'YTD-Bmxirr', 'QTD.Xirr', 'QTDXirr', 'SIXirr', 'SIBmxirr', 'qtdbmxirr', 'MTD Xirr', 'FYTD Xirr', 'fytd_bmxirr', 'SI',
      'SIP Xirr', 'SIPXirr', 'SIP_Xirr', 'YTDX Xirr', 'FY Xirr', 'Fund Xirr'];
    assert.deepEqual(names.map(sheetPeriodOf),
      ['SI', 'YTD', 'YTD', 'QTD', 'QTD', 'SI', 'SI', 'QTD', 'MTD', 'FYTD', 'FYTD', 'SI', null, null, null, null, null, null]);
  });

  test('F5 (c): "SI_Xirr" with only "YTD_Bmxirr", and "FYTD Xirr" with only "SI Bmxirr", are not paired', () => {
    for (const [f, b] of [['SI_Xirr', 'YTD_Bmxirr'], ['FYTD Xirr', 'SI Bmxirr'], ['SIXirr', 'QTDBmxirr']]) {
      const imp = read([fundSheet(f!), benchSheet(b!, -5)]);
      assert.equal(imp.fundSheet?.name, f);
      assert.equal(imp.benchSheet, null, `${f} with ${b}`);
      assert.ok(issue(imp, 'sheet-period-mismatch'), `${f} with ${b}`);
    }
  });

  test('F5 (c): the joined SI pair is preferred over a later or earlier YTD pair', () => {
    for (const order of [['SIXirr', 'SIBmxirr', 'YTDXirr', 'YTDBmxirr'], ['YTD_Xirr', 'YTD_Bmxirr', 'SI_Xirr', 'SI_Bmxirr']]) {
      const imp = read(order.map((n) => (/bm/i.test(n) ? benchSheet(n, n.toUpperCase().startsWith('SI') ? -1 : -2) : fundSheet(n, n.toUpperCase().startsWith('SI') ? -10 : -20))));
      assert.deepEqual([imp.fundSheet?.name, imp.benchSheet?.name], order.filter((n) => n.toUpperCase().startsWith('SI')), order.join(', '));
      assert.deepEqual([imp.fund.map((t) => t.amountRupees), imp.bench.map((t) => t.amountRupees)], [[-10], [-1]]);
      assert.equal(issue(imp, 'no-si-sheet'), undefined);
    }
  });

  test('F5 (a): SI fund, a period-less "Bmxirr" and "YTD Bmxirr": no benchmark (never the period-less one), the Warning names the sheets seen', () => {
    const imp = read([fundSheet('SI Xirr'), benchSheet('Bmxirr', -6), benchSheet('YTD Bmxirr', -7)]);
    assert.equal(imp.benchSheet, null);
    const i = issue(imp, 'sheet-period-mismatch')!;
    assert.ok(i.message.endsWith('Benchmark sheets seen: "Bmxirr", "YTD Bmxirr".'), i.message);
    assert.ok(i.message.includes('(SI, YTD, QTD, MTD, FYTD)'), i.message);
  });
});

// Gate B of d6401f6, F6 (MOD-05: BLOCKING for the returns view): the review's returns are since inception. A file whose
// only fund sheet carries a non-SI period word gives no XIRR: a Blocking result names the sheet found and the two SI
// sheets needed; the flows are still read. Legacy period-less files ("Xirr", "Bmxirr") stay accepted.
describe('F6: a fund sheet of another period, with no SI sheet, is refused', () => {
  const A = 'Sample Client A';
  const F = 'Sample Bluechip Fund';
  const sheet = (name: string, header: typeof FUND_HEADER | typeof BENCH_HEADER) => ({ name, rows: header === FUND_HEADER
    ? [FUND_HEADER, fundRow(A, F, 'SYN-1001', 'Equity', dateCell(2025, 1, 1), 'Purchase', null, 10, -100, null), fundRow(A, F, 'SYN-1001', 'Equity', dateCell(2025, 3, 31), null, 'Closing', null, 110, null)]
    : [BENCH_HEADER, [A, F, 'Equity', 'Mutual Funds', dateCell(2025, 1, 1), 'Sample Index 1', -100], [A, F, 'Equity', 'Mutual Funds', dateCell(2025, 3, 31), 'Sample Index 1', 105]] });
  const read = (sheets: Parameters<typeof toWorkbook>[1]): IrrFileImport => parseIrrFile(readWorkbook(xlsx, toWorkbook(xlsx, sheets)), { sourceId: SRC, now: NOW });

  test('"YTD Xirr" and "YTD Bmxirr" only: Blocking no-si-sheet naming the sheet; the flows are read as today', () => {
    const imp = read([sheet('YTD Xirr', FUND_HEADER), sheet('YTD Bmxirr', BENCH_HEADER)]);
    const i = issue(imp, 'no-si-sheet')!;
    assert.deepEqual([i.severity, i.blocksPublication, i.scope], ['Blocking', true, { kind: 'sheet', sourceId: SRC, sheet: 'YTD Xirr' }]);
    assert.equal(i.message, 'The since-inception sheet is missing: fund flows were found only on the sheet "YTD Xirr" (period YTD), and the returns need the "SI Xirr" and "SI Bmxirr" sheets, so no XIRR is computed from this file.');
    assert.ok(!new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`).test(i.message), 'no en or em dash (D-029)');
    assert.deepEqual([imp.fund.length, imp.bench.length], [2, 2], 'the flows are still read');
  });

  test('QTD, MTD, FYTD and joined or underscored names are refused the same way', () => {
    for (const n of ['QTD Xirr', 'MTD Xirr', 'FYTD Xirr', 'QTDXirr', 'YTD_Xirr']) {
      const imp = read([sheet(n, FUND_HEADER)]);
      assert.equal(issue(imp, 'no-si-sheet')?.severity, 'Blocking', n);
      assert.ok(issue(imp, 'no-si-sheet')!.message.includes(`"${n}"`), n);
    }
  });

  test('accepted: the SI pair (with YTD sheets beside it), legacy "Xirr" and "Bmxirr", other period-less names, a sheet found by its header', () => {
    for (const sheets of [
      [sheet('YTD Xirr', FUND_HEADER), sheet('SI Xirr', FUND_HEADER), sheet('SI Bmxirr', BENCH_HEADER)],
      [sheet('Xirr', FUND_HEADER), sheet('Bmxirr', BENCH_HEADER)],
      [sheet('Old Xirr', FUND_HEADER), sheet('SIP Xirr', FUND_HEADER)],
      [sheet('Fund flows', FUND_HEADER)],
    ]) {
      const imp = read(sheets);
      assert.equal(issue(imp, 'no-si-sheet'), undefined, sheets.map((s) => s.name).join(', '));
      assert.ok(!imp.issues.some((x) => x.severity === 'Blocking'), sheets.map((s) => s.name).join(', '));
    }
    assert.equal(issue(parse('irr-cashflow'), 'no-si-sheet'), undefined, 'the platform\'s six-sheet file');
  });
});

// Gate B of d6401f6, F7 (MOD-05's defaults; owner question Q-R3): Warnings, counted and listed, for contrary signs and
// for a missing or duplicate Closing row per instrument. A fully redeemed instrument needs no Closing row; a zero
// Closing row says the same. Rows numbered as Excel's (the header is row 1).
describe('F7: contrary signs and Closing rows in a hand-filled file', () => {
  const A = 'Sample Client A';
  const row = (instrument: string, folio: string, d: number, type: string | null, closing: boolean, amount: number) =>
    fundRow(A, instrument, folio, 'Equity', dateCell(2024, 1, d), type, closing ? 'Closing' : null, null, amount, null);
  const read = (rows: ReturnType<typeof fundRow>[]): IrrFileImport =>
    parseIrrFile(readWorkbook(xlsx, toWorkbook(xlsx, [{ name: 'SI Xirr', rows: [FUND_HEADER, ...rows] }])), { sourceId: SRC, now: NOW });
  const rowsOf = (imp: IrrFileImport, r: string): number[] => {
    const s = issue(imp, r)!.scope;
    return s.kind === 'rows' ? s.rows.map((x) => x.row) : [];
  };

  test('contrary signs: a purchase written positive, a redemption negative, a Closing value negative (3, listed by row)', () => {
    const imp = read([
      row('Fund P', 'F1', 1, 'Purchase', false, 100), // row 2: contrary
      row('Fund P', 'F1', 2, 'Redemption', false, -50), // row 3: contrary
      row('Fund P', 'F1', 3, null, true, -10), // row 4: contrary (a negative Closing value)
      row('Fund Q', 'F2', 1, 'SIP', false, -100), // row 5
      row('Fund Q', 'F2', 3, null, true, 0), // row 6: a zero Closing row is not contrary
    ]);
    const i = issue(imp, 'contrary-signs')!;
    assert.deepEqual([i.severity, i.count], ['Warning', 3]);
    assert.deepEqual(rowsOf(imp, 'contrary-signs'), [2, 3, 4]);
    assert.equal(i.message, '3 fund flows have a sign contrary to their type (money paid in is negative; money paid out and a Closing value are positive); they count in the XIRR as written.');
    assert.deepEqual(imp.fund.map((t) => t.amountRupees), [100, -50, -10, -100, 0], 'read as written');
  });

  test('Closing rows: one missing, one duplicated; a fully redeemed instrument and a zero Closing row need nothing', () => {
    const imp = read([
      row('Fund Open', 'F1', 1, 'Purchase', false, -100), // row 2: no Closing, ends with money paid in: missing
      row('Fund Open', 'F1', 2, 'SIP', false, -50), // row 3
      row('Fund Gone', 'F2', 1, 'Purchase', false, -100), // row 4: fully redeemed (ends with money paid out)
      row('Fund Gone', 'F2', 5, 'Redemption', false, 120), // row 5
      row('Fund Zero', 'F3', 1, 'Purchase', false, -100), // row 6: a zero Closing row
      row('Fund Zero', 'F3', 5, null, true, 0), // row 7
      row('Fund Twice', 'F4', 1, 'Purchase', false, -100), // row 8: two Closing rows
      row('Fund Twice', 'F4', 5, null, true, 60), // row 9
      row('fund  TWICE', 'F4', 6, null, true, 60), // row 10: the same instrument (name normalised)
      row('Fund Twice', 'F5', 1, 'Purchase', false, -100), // row 11: another folio, its own Closing row
      row('Fund Twice', 'F5', 5, null, true, 110), // row 12
    ]);
    assert.deepEqual([issue(imp, 'missing-closing')!.severity, issue(imp, 'missing-closing')!.count], ['Warning', 1]);
    assert.deepEqual(rowsOf(imp, 'missing-closing'), [3]);
    assert.deepEqual([issue(imp, 'duplicate-closing')!.severity, issue(imp, 'duplicate-closing')!.count], ['Warning', 1]);
    assert.deepEqual(rowsOf(imp, 'duplicate-closing'), [9, 10]);
    assert.equal(issue(imp, 'duplicate-closing')!.message, '1 instrument has more than one Closing row (2 rows); every Closing row counts in the XIRR as written.');
    assert.ok(!/Fund (Open|Gone|Zero|Twice)|F[1-5]\b/i.test(JSON.stringify(imp.issues.map((x) => x.message))), 'messages name no instrument and no folio');
    assert.equal(issue(imp, 'contrary-signs'), undefined);
    assert.equal(imp.fund.length, 11, 'every flow read as written');
  });

  test('no Closing check without a row-type column (no row could be marked Closing); the standard file has no F7 Warning', () => {
    const typeCol = FUND_HEADER.indexOf('TYPE');
    const strip = (r: ReturnType<typeof fundRow>) => r.filter((_, i) => i !== typeCol);
    const imp = parseIrrFile(readWorkbook(xlsx, toWorkbook(xlsx, [{ name: 'SI Xirr', rows: [strip(FUND_HEADER), strip(row('Fund Open', 'F1', 1, 'Purchase', false, -100))] }])), { sourceId: SRC, now: NOW });
    assert.ok(!imp.fundSheet!.columns.some((c) => c.field === 'rowType'));
    assert.equal(issue(imp, 'missing-closing'), undefined);
    for (const id of ['irr-standard', 'irr-cashflow', 'irr-dates']) {
      const p = parse(id);
      for (const r of ['contrary-signs', 'missing-closing', 'duplicate-closing']) assert.equal(issue(p, r), undefined, `${id}: ${r}`);
    }
  });
});
