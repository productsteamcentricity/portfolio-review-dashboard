// covers: E-01 E-02 U-03 E-76 (NB-05: the base file's "Account Name" column; MOD-05's D1 (a) of 27 Nov 2026: read, kept
// and shown only)
// A column headed exactly "Account Name" is read and kept on each holding (each different name once, in file order,
// for merged folios); a file without it reads exactly as before (no field at all); "Account Source Code" is not it.
// No figure and no grouping changes: the same file with and without the column gives the same holdings, accounts,
// counts and results. Shown in two places only: one count line in the import report, and a last column on the
// workbook's Holdings (as loaded) sheet, which stays at its 43 columns when no holding has an account name.
// The financial review's additions: the same comparison on a fuller book through the whole review, both view-models and
// every sheet of the workbook (T-6); a PAN in the cell is removed at read and kept nowhere (T-9).
// Synthetic workbooks; answers by hand. No PAN-shaped literal: each token is assembled at run time (panToken).

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
import { panToken } from '../../fixtures/make-cg-statements.ts';
import { hasPanShape, PAN_REPLACEMENT } from '../../../app/src/ingest/capital-gains.ts';
import { buildHoldingsVM } from '../../../app/src/views/holdings.ts';

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
    assert.deepEqual(line, { id: 'account-names', label: 'Different account names read (listed in the workbook; no figure uses them)', value: 3 });
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

// A fuller synthetic book (the financial review's T-6): rows 2 to 4 merge into one holding of three folios with different
// XIRR, dates and one blank invested value; row 5 has no market value and is excluded; a PMS row without an account name;
// two clients; two distributors; a blank row and a Grand Total row.
const FULL_HEAD = ['Client Name', 'Account Name', 'Instrument Name', 'Isin Code', 'Category Name', 'Asset Name', 'Folio No', 'Product Name',
  'Distributor Name', 'Units', 'Invested Value (₹) ', 'Market Value (₹) ', 'Valuation Date', 'Purchase Date', 'Avg. Holding Days', 'XIRR (%)', 'BMXIRR (%)'];
const fullBook = (second: string): unknown[][] => [
  FULL_HEAD,
  ['Sample Client A', 'Sample Client A (Joint)', 'Sample Flexi Cap Fund - Regular Plan - Growth', 'INF000S01AA1', 'Flexi Cap Fund', 'Equity', 'SF-1', 'Mutual Funds', 'Sample Dist 1', 1000, 1000000, 1200000, '31-10-2026', '15-06-2023', 1234, 11.2, 10.1],
  ['Sample Client A', second, 'Sample Flexi Cap Fund - Regular Plan - Growth', 'INF000S01AA1', 'Flexi Cap Fund', 'Equity', 'SF-2', 'Mutual Funds', 'Sample Dist 1', 500, 400000, 800000, '31-10-2026', '01-01-2022', 1764, 14.5, 12],
  ['Sample Client A', 'Sample Client A (Joint)', 'Sample Flexi Cap Fund - Regular Plan - Growth', 'INF000S01AA1', 'Flexi Cap Fund', 'Equity', 'SF-3', 'Mutual Funds', 'Sample Dist 1', 250, null, 500000, '31-10-2026', '10-10-2024', 751, 9, 8],
  ['Sample Client A', 'Sample Client A HUF', 'Sample Corporate Bond Fund - Regular Plan - Growth', 'INF000S01BB2', 'Corporate Bond', 'Debt', 'SF-4', 'Mutual Funds', 'Sample Dist 2', 100, 300000, null, '31-10-2026', '15-06-2023', 400, 7.4, 7],
  ['Sample Client A', null, 'Sample Growth PMS', null, 'PMS', 'Equity', 'SF-5', 'PMS', 'Sample Dist 2', null, 5000000, 6500000, '30-06-2026', 45092, 700, 15.5, 13],
  ['Sample Client B', 'Sample Client B HUF', 'Sample Gold ETF', 'INF000S01CC3', 'Gold ETF', 'Commodity', 'SF-6', 'Mutual Funds', 'Sample Dist 1', 300, null, 900000, '31-10-2026', '05-03-2021', 2000, 12, 11],
  ['Sample Client B', 'Sample Client B HUF', 'Sample Industries Ltd.', 'INE000S01019', 'Large Cap', 'Equity', 'SF-7', 'Direct Equity', 'Sample Dist 1', 50, 200000, 150000, '31-10-2026', '05-03-2021', 2000, -4, 9],
  [],
  ['Sample Client B', 'Sample Client B HUF', 'Grand Total', null, null, null, null, null, null, null, 6900000, 10050000, null, null, null, null, null],
];

describe('no figure moves on a fuller book: the review, the view-models and every sheet of the workbook (T-6)', () => {
  const w = nodeWiring();
  const run = (rows: unknown[][]) => {
    const r = reviewOf(w, { id: 'accounts-full', bytes: bytesOf(rows) });
    const sha = r.loaded.source.id as string;
    const fp = r.review.fingerprint;
    /** JSON with the file's own id and the review fingerprint (which holds it) made neutral, and the new field dropped. */
    const canon = (x: unknown): string => JSON.stringify(x, (k, v) => (k === 'accountNames' ? undefined : v)).split(sha).join('<SRC>').split(fp).join('<FP>');
    const book = readXlsx(buildOverviewWorkbook({ ...workbookInputFrom(r.review, r.vm), clientHoldings: buildHoldingsVM(r.review) }));
    const cells = new Map<string, string>();
    for (const sheet of book.sheets) {
      for (const [ref, c] of sheet.cells) {
        const v = typeof c.v === 'string' ? c.v.split(sha).join('<SRC>').split(fp).join('<FP>') : c.v;
        cells.set(`${sheet.name}!${ref}`, JSON.stringify([v, c.f ?? null]));
      }
    }
    return { r, canon, cells, sheets: book.sheets.map((x) => x.name) };
  };
  /** The cells that differ between two workbooks, as "Sheet!Ref". */
  const differing = (a: Map<string, string>, b: Map<string, string>): string[] =>
    [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k)).sort();
  const reviewParts = (x: ReturnType<typeof run>, dropResult: string | null) => {
    const { base: _b, fingerprint: _f, sources, issues, audit, ...rest } = x.r.review;
    const keep = issues.filter((i) => i.ruleId !== dropResult);
    return {
      rest: x.canon(rest),
      sources: x.canon(sources.map(({ bytes: _n, ...src }) => src)),
      issues: x.canon(dropResult === null ? keep : keep.map(({ id: _id, ...i }) => i)),
      audit: dropResult === null ? x.canon(audit) : null,
      overview: x.canon(x.r.vm),
      holdings: x.canon(buildHoldingsVM(x.r.review)),
    };
  };

  test('the known answers of the book: 1.005 Cr in five holdings, the merged holding 0.25 Cr with its XIRR weighted by market value', () => {
    const x = run(fullBook('Sample Client A (Joint)'));
    const t = x.r.review.totals.cmv;
    // 12,00,000 + 8,00,000 + 5,00,000 + 65,00,000 + 9,00,000 + 1,50,000 rupees = 1,00,50,000 = 1.005 Cr; the bond row has no market value.
    assert.ok(t.kind === 'value' && Math.abs(t.v - 1.005) < 1e-12, JSON.stringify(t));
    assert.equal(x.r.review.holdings.length, 5);
    const m = x.r.review.holdings[0]!;
    assert.ok(m.cmv.kind === 'value' && Math.abs(m.cmv.v - 0.25) < 1e-12);
    // (11.2 x 12 + 14.5 x 8 + 9 x 5) / 25 = 295.4 / 25 = 11.816
    assert.ok(m.xirr.kind === 'value' && Math.abs(m.xirr.v - 11.816) < 1e-9, JSON.stringify(m.xirr));
    assert.deepEqual(m.mergeGaps, ['invested']);
  });

  test('merged folios under one account name: with and without the column everything is the same but the field and column AR', () => {
    const withColumn = run(fullBook('Sample Client A (Joint)'));
    const plain = run(without(fullBook('Sample Client A (Joint)')));
    assert.deepEqual(withColumn.r.review.holdings.map((h) => h.accountNames ?? null),
      [['Sample Client A (Joint)'], ['Sample Client A HUF'], null, ['Sample Client B HUF'], ['Sample Client B HUF']]);
    assert.deepEqual(reviewParts(withColumn, null), reviewParts(plain, null));
    assert.deepEqual(withColumn.r.review.issues.map((i) => i.id), plain.r.review.issues.map((i) => i.id));
    assert.deepEqual(withColumn.sheets, plain.sheets);
    // The only cells that differ: the new last column of Holdings (as loaded), and the file's own size in the Source Register.
    assert.deepEqual(differing(withColumn.cells, plain.cells),
      ['Holdings (as loaded)!AR1', 'Holdings (as loaded)!AR2', 'Holdings (as loaded)!AR3', 'Holdings (as loaded)!AR4', 'Holdings (as loaded)!AR5', 'Holdings (as loaded)!AR6', 'Source Register!I2']);
  });

  test('merged folios under two account names: one more Information result, and no figure, total, matrix or sheet cell moves', () => {
    const withColumn = run(fullBook('Sample Client A Minor'));
    const plain = run(without(fullBook('Sample Client A Minor')));
    assert.deepEqual(withColumn.r.review.holdings[0]!.accountNames, ['Sample Client A (Joint)', 'Sample Client A Minor']);
    const a = reviewParts(withColumn, 'base-file.merged-accounts');
    const b = reviewParts(plain, 'base-file.merged-accounts');
    assert.deepEqual(a, b);
    assert.equal(withColumn.r.review.issues.length, plain.r.review.issues.length + 1);
    // Outside Holdings AR, the Source Register's size and the Audit Log (one more result row, later ids shifted by one), no cell differs.
    const other = differing(withColumn.cells, plain.cells).filter((k) => !/^Holdings \(as loaded\)!AR\d+$/.test(k) && k !== 'Source Register!I2' && !k.startsWith('Audit Log!'));
    assert.deepEqual(other, []);
    for (const sheet of ['Portfolio Overview', 'Client Allocation', 'Distributor Allocation', 'Sample Client A', 'Sample Client B']) {
      assert.ok(withColumn.sheets.includes(sheet), sheet);
    }
  });

  test('no account name reaches a result message or the audit log', () => {
    const x = run(fullBook('Sample Client A Minor'));
    const text = JSON.stringify([x.r.review.issues, x.r.review.audit]);
    assert.ok(!/\(Joint\)|Minor|HUF/.test(text));
  });
});

describe('a PAN in Account Name is removed at read and kept nowhere (T-9)', () => {
  const p1 = panToken(1);
  const p2 = panToken(2, true);
  const p3 = panToken(3);
  const rows: unknown[][] = [
    HEAD,
    ['Sample Client A', `Sample Client A - Held Away[PAN: ${p1}]`, 'Sample Fund 1', 'F-1', 'Sample Distributor', 100000],
    ['Sample Client A', `Sample Client A Minor PAN ${p2}`, 'Sample Fund 2', 'F-2', 'Sample Distributor', 200000],
    ['Sample Client A', `[PAN: ${p3}]`, 'Sample Fund 3', 'F-3', 'Sample Distributor', 300000],
    ['Sample Client A', 'Sample Client A (Joint)', 'Sample Fund 4', 'F-4', 'Sample Distributor', 400000],
  ];
  const l = loadedOf(rows);

  test('a tag is removed whole, a bare token is replaced, a cell that held only a PAN leaves no name', () => {
    assert.ok([p1, p2, p3].every((p) => hasPanShape(p)), 'the fixture tokens are PAN-shaped');
    assert.deepEqual(l.base.holdings.map((h) => h.accountNames ?? null), [
      ['Sample Client A - Held Away'], [`Sample Client A Minor PAN ${PAN_REPLACEMENT}`], null, ['Sample Client A (Joint)'],
    ]);
  });

  test('one Information result counts the cells; the PAN itself is nowhere in what was read', () => {
    const r = l.base.issues.filter((i) => i.ruleId === 'base-file.account-pan-removed');
    assert.equal(r.length, 1);
    assert.deepEqual([r[0]!.severity, r[0]!.count, r[0]!.status], ['Information', 3, 'resolved']);
    assert.equal(r[0]!.message, '3 Account Name cells held a PAN: each was removed when the file was read and is kept nowhere.');
    const all = JSON.stringify(l.base).toLowerCase();
    for (const p of [p1, p2, p3]) assert.ok(!all.includes(p.toLowerCase()));
    assert.ok(!hasPanShape(JSON.stringify(l.base.holdings.map((h) => h.accountNames ?? []))));
    assert.equal(buildImportReport(l.source, l.base).counts.find((c) => c.id === 'account-names')!.value, 3);
  });

  test('a file with no PAN in the column: no such result, the names as given', () => {
    assert.ok(!baseOf(BOOK).issues.some((i) => i.ruleId === 'base-file.account-pan-removed'));
  });
});
