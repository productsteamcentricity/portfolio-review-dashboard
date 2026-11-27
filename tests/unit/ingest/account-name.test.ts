// covers: E-01 E-02 U-03 E-76 (NB-05: the base file's "Account Name" column; MOD-05's D1 (a) of 27 Nov 2026: read, kept
// and shown only)
// A column headed exactly "Account Name" is read and kept on each holding (each different name once, in file order,
// for merged folios); a file without it reads exactly as before (no field at all); "Account Source Code" is not it.
// No figure and no grouping changes: the same file with and without the column gives the same holdings, accounts,
// counts and results. Shown in two places only: one count line in the import report, and a last column on the
// workbook's Holdings (as loaded) sheet, which stays at its 43 columns when no holding has an account name.
// Synthetic workbooks; answers by hand.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isLoaded, loadBaseFile } from '../../../app/src/ingest/load-base.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import { buildImportReport } from '../../../app/src/views/import-report.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { holdingReportAoa, HOLDING_REPORT_HEADINGS } from '../../fixtures/holding-report.ts';

const xlsx = loadSheetJS();
const NOW = (): string => '2026-11-28T00:00:00.000Z';

function bytesOf(rows: unknown[][], sheet = 'Base File'): Uint8Array {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), sheet);
  return new Uint8Array(xlsx.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}
function loadedOf(rows: unknown[][], sheet?: string) {
  const l = loadBaseFile(bytesOf(rows, sheet), 'accounts.xlsx', xlsx, { now: NOW });
  assert.ok(isLoaded(l));
  return l;
}
const baseOf = (rows: unknown[][]) => loadedOf(rows).base;

const HEAD = ['Client Name', 'Account Name', 'Instrument Name', 'Folio No', 'Distributor Name', 'Market Value (₹)'];
const BOOK: unknown[][] = [
  HEAD,
  ['Sample Client A', 'Sample Client A (Joint)', 'Sample Fund 1', 'F-1', 'Sample Distributor', 100000],
  ['Sample Client A', '  Sample   Client A Minor ', 'Sample Fund 1', 'F-2', 'Sample Distributor', 200000],
  ['Sample Client A', 'Sample Client A (Joint)', 'Sample Fund 1', 'F-3', 'Sample Distributor', 300000],
  ['Sample Client A', 'Sample Client A (Joint)', 'Sample Fund 2', 'F-4', 'Sample Distributor', 400000],
  ['Sample Client A', null, 'Sample Fund 3', 'F-5', 'Sample Distributor', 500000],
  ['Sample Client B', 'Sample Client B HUF', 'Sample Fund 1', 'F-6', 'Sample Distributor', 600000],
];
/** The same book without the Account Name column. */
const without = (rows: unknown[][]): unknown[][] => rows.map((r) => r.filter((_, i) => i !== 1));

describe('the Account Name column of the base file', () => {
  const base = baseOf(BOOK);

  test('read under the exact heading and kept as given; merged folios keep each different name once, in file order', () => {
    assert.ok(base.columns.some((c) => c.field === 'accountName' && c.header === 'Account Name'));
    const by = base.holdings.map((h) => [h.clientLabel, h.instrumentName, h.accountNames]);
    assert.deepEqual(by, [
      ['Sample Client A', 'Sample Fund 1', ['Sample Client A (Joint)', 'Sample Client A Minor']],
      ['Sample Client A', 'Sample Fund 2', ['Sample Client A (Joint)']],
      ['Sample Client A', 'Sample Fund 3', undefined],
      ['Sample Client B', 'Sample Fund 1', ['Sample Client B HUF']],
    ]);
    assert.ok(!Object.hasOwn(base.holdings[2]!, 'accountNames'), 'a holding without a name has no field, not an empty list');
  });

  test('merged folios under two account names stay one holding, and an Information result counts them', () => {
    const r = base.issues.filter((i) => i.ruleId === 'base-file.merged-accounts');
    assert.equal(r.length, 1);
    assert.deepEqual([r[0]!.severity, r[0]!.count, r[0]!.status], ['Information', 1, 'resolved']);
    assert.equal(r[0]!.message, '1 merged holding has folios under more than one Account Name: it stays one holding, with every account name kept.');
    assert.deepEqual(r[0]!.scope, { kind: 'holdings', holdingIds: [base.holdings[0]!.id] });
    // 1,00,000 + 2,00,000 + 3,00,000 rupees = 0.06 Cr in the one merged holding.
    const cmv = base.holdings[0]!.cmv;
    assert.ok(cmv.kind === 'value' && Math.abs(cmv.v - 0.06) < 1e-12);
  });

  test('a file without the column reads exactly as before: no accountNames field, no column, no result', () => {
    const plain = baseOf(without(BOOK));
    assert.ok(plain.holdings.every((h) => !Object.hasOwn(h, 'accountNames')));
    assert.ok(!plain.columns.some((c) => c.field === 'accountName'));
    assert.ok(!plain.issues.some((i) => i.ruleId === 'base-file.merged-accounts'));
  });

  test('no figure and no grouping moves: with and without the column, the same holdings, accounts, folios, counts and results', () => {
    // One source id for both, so that only the column differs (a loaded file's id is its SHA-256).
    const parse = (rows: unknown[][]) => parseBaseFile(readWorkbook(xlsx, bytesOf(rows)), { sourceId: 'd'.repeat(64) as SourceFileId, now: NOW });
    const withColumn = parse(BOOK);
    const plain = parse(without(BOOK));
    const strip = (b: typeof base) => ({
      holdings: b.holdings.map(({ accountNames: _a, ...h }) => h),
      accounts: b.accounts, clients: b.clients, distributors: b.distributors, folios: b.folios, ownership: b.ownership,
      counts: b.counts, skipped: b.skipped, moneyUnit: b.moneyUnit,
      issues: b.issues.filter((i) => i.ruleId !== 'base-file.merged-accounts').map(({ id: _id, ...i }) => i),
    });
    assert.deepEqual(strip(withColumn), strip(plain));
    assert.equal(base.accounts.length, 2, 'accounts are still client + distributor: two clients, one distributor');
  });

  test('"Account Source Code" and other headings with the word account are not the column', () => {
    const b = baseOf([
      ['Client Name', 'Account Source Code', 'Account', 'Account Name (old)', 'Instrument Name', 'Market Value (₹)'],
      ['Sample Client A', 'A-0001', 'x', 'y', 'Sample Fund 1', 100000],
    ]);
    assert.ok(!b.columns.some((c) => c.field === 'accountName'));
    assert.ok(!Object.hasOwn(b.holdings[0]!, 'accountNames'));
  });

  test('the full holding report of the platform: the Account Name is read, and the invested values are as before', () => {
    const l = loadedOf(holdingReportAoa(10), 'Holdings');
    assert.equal(HOLDING_REPORT_HEADINGS.indexOf('Account Name'), 4);
    assert.deepEqual(l.base.holdings.map((h) => h.accountNames), [['Sample Report Client'], ['Sample Report Client']]);
    // 2,50,000 and 1,50,000 rupees invested, as in tests/unit/ingest/holding-report-headings.test.ts.
    assert.deepEqual(l.base.holdings.map((h) => (h.invested.kind === 'value' ? Math.round(h.invested.v * 1e7) : null)), [250000, 150000]);
  });
});

describe('where the Account Name is shown', () => {
  test('the import report: one count line with the number of different names; none without the column', () => {
    const l = loadedOf(BOOK);
    const line = buildImportReport(l.source, l.base).counts.find((c) => c.id === 'account-names');
    // (Joint), Minor and HUF: three different names over the four holdings.
    assert.deepEqual(line, { id: 'account-names', label: 'Account names read (kept and shown; no figure uses them)', value: 3 });
    const p = loadedOf(without(BOOK));
    assert.ok(!buildImportReport(p.source, p.base).counts.some((c) => c.id === 'account-names'));
    assert.equal(buildImportReport(p.source, p.base).counts.length, 6);
  });

  test('a column with every cell blank: the line says 0', () => {
    const l = loadedOf(BOOK.map((r, i) => (i === 0 ? r : r.map((c, j) => (j === 1 ? null : c)))));
    assert.equal(buildImportReport(l.source, l.base).counts.find((c) => c.id === 'account-names')!.value, 0);
    assert.ok(l.base.holdings.every((h) => !Object.hasOwn(h, 'accountNames')));
  });

  test('the workbook: a 44th column "Account Name" after the 43, names joined by "; "; 43 columns without any name', () => {
    const w = nodeWiring();
    const table = (rows: unknown[][]) => {
      const run = reviewOf(w, { id: 'accounts', bytes: bytesOf(rows) });
      return sheetTable(sheetByName(readXlsx(buildOverviewWorkbook(workbookInputFrom(run.review, run.vm))), 'Holdings (as loaded)'));
    };
    const t = table(BOOK);
    assert.equal(t[0]!.length, 44);
    assert.equal(t[0]![43], 'Account Name');
    assert.equal(t[0]![42], 'Base File Rows', 'the 43 columns before it are where they were');
    assert.deepEqual(t.slice(1).map((r) => [r[0], r[1], r[43] ?? null]), [
      ['Sample Fund 1', 'Sample Client A', 'Sample Client A (Joint); Sample Client A Minor'],
      ['Sample Fund 2', 'Sample Client A', 'Sample Client A (Joint)'],
      ['Sample Fund 3', 'Sample Client A', null],
      ['Sample Fund 1', 'Sample Client B', 'Sample Client B HUF'],
    ]);
    const plain = table(without(BOOK));
    assert.equal(plain[0]!.length, 43);
    assert.deepEqual(plain.map((r) => r.slice(0, 43)), t.map((r) => r.slice(0, 43)), 'the other 43 columns are cell for cell the same');
  });
});
