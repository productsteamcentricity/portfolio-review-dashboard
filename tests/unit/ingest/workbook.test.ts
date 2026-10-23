// covers: E-01 E-04 OD-3
// The workbook reader: raw serials (no Date), number formats kept (a percent format told from a literal "%"),
// cached values with formula text, real row numbers, sheet order, limits, and unreadable input refused.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cellText, findHeaderRow, isPercentFormat, readWorkbook, WorkbookReadError,
} from '../../../app/src/ingest/workbook.ts';
import { loadSheetJS, writeXlsx } from '../../helpers/sheetjs.ts';

const xlsx = loadSheetJS();

function book(sheets: Array<{ name: string; aoa: unknown[][]; formats?: Record<string, string>; formulas?: Record<string, string> }>): Uint8Array {
  const wb = xlsx.utils.book_new();
  for (const s of sheets) {
    const ws = xlsx.utils.aoa_to_sheet(s.aoa);
    for (const [addr, z] of Object.entries(s.formats ?? {})) (ws[addr] as Record<string, unknown>).z = z;
    for (const [addr, f] of Object.entries(s.formulas ?? {})) (ws[addr] as Record<string, unknown>).f = f;
    xlsx.utils.book_append_sheet(wb, ws, s.name);
  }
  return writeXlsx(xlsx, wb);
}

test('numbers keep their format; dates stay raw serials flagged as dates; formulas keep the cached value', () => {
  const bytes = book([{
    name: 'Base File',
    aoa: [['Name', 'When', 'Pct', 'Plain', 'Sum'], ['a', 44942, 0.1425, 14.25, 3]],
    formats: { B2: 'dd-mmm-yyyy', C2: '0.00%' },
    formulas: { E2: '1+2' },
  }]);
  const wb = readWorkbook(xlsx, bytes);
  assert.equal(wb.date1904, false);
  assert.deepEqual(wb.sheets.map((s) => s.name), ['Base File']);
  const row = wb.sheets[0]!.rows[1]!;
  assert.deepEqual(row[1], { t: 'n', v: 44942, fmt: 'dd-mmm-yyyy', date: true });
  assert.deepEqual(row[2], { t: 'n', v: 0.1425, fmt: '0.00%', date: false });
  assert.deepEqual(row[3], { t: 'n', v: 14.25, fmt: null, date: false });
  assert.deepEqual(row[4], { t: 'n', v: 3, fmt: null, date: false, formula: '1+2' });
  assert.deepEqual(row[0], { t: 's', v: 'a' });
});

test('rows keep their Excel row numbers; empty rows and cells stay empty', () => {
  const bytes = book([{ name: 'S', aoa: [['top'], [], [], [null, 'C4? no: B4'], []] }]);
  const rows = readWorkbook(xlsx, bytes).sheets[0]!.rows;
  assert.equal(cellText(rows[0]![0]), 'top');
  assert.deepEqual(rows[1], []);
  assert.equal(rows[3]![0], null);
  assert.equal(cellText(rows[3]![1]), 'C4? no: B4');
  assert.equal(cellText(undefined), '');
});

test('sheets in workbook order, header found by a predicate within a row budget', () => {
  const bytes = book([
    { name: 'Read Me', aoa: [['notes']] },
    { name: 'Holdings', aoa: [['title'], ['x'], ['Client Name', 'Instrument Name']] },
  ]);
  const wb = readWorkbook(xlsx, bytes);
  assert.deepEqual(wb.sheets.map((s) => s.name), ['Read Me', 'Holdings']);
  const isHead = (t: string[]): boolean => t.includes('client name');
  assert.equal(findHeaderRow(wb.sheets[1]!, isHead, 20), 2);
  assert.equal(findHeaderRow(wb.sheets[1]!, isHead, 2), -1);
  assert.equal(findHeaderRow(wb.sheets[0]!, isHead, 20), -1);
});

test('a percent format scales by 100; a quoted or escaped percent sign is literal text', () => {
  assert.equal(isPercentFormat('0.00%'), true);
  assert.equal(isPercentFormat('0%'), true);
  assert.equal(isPercentFormat('[Red]0.00%'), true);
  assert.equal(isPercentFormat('#,##0.00%;[Red]-#,##0.00%'), true);
  assert.equal(isPercentFormat('0.00"%"'), false);
  assert.equal(isPercentFormat('0.00\\%'), false);
  assert.equal(isPercentFormat('#,##0.00'), false);
  assert.equal(isPercentFormat('General'), false);
  assert.equal(isPercentFormat(null), false);
});

test('limits and unreadable input are refused with a reason', () => {
  const bytes = book([{ name: 'A', aoa: [['1', '2', '3']] }, { name: 'B', aoa: [['x']] }]);
  assert.throws(() => readWorkbook(xlsx, bytes, { maxBytes: 10 }), (e: unknown) => e instanceof WorkbookReadError && e.reason === 'too-large');
  assert.throws(() => readWorkbook(xlsx, bytes, { maxSheets: 1 }), (e: unknown) => e instanceof WorkbookReadError && e.reason === 'too-many-sheets');
  assert.throws(() => readWorkbook(xlsx, bytes, { maxCellsPerSheet: 2 }), (e: unknown) => e instanceof WorkbookReadError && e.reason === 'too-many-cells');
  assert.doesNotThrow(() => readWorkbook(xlsx, bytes, { maxBytes: bytes.length, maxSheets: 2, maxCellsPerSheet: 3 }));
  const junk = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.throws(() => readWorkbook(xlsx, junk), (e: unknown) => e instanceof WorkbookReadError && e.reason === 'unreadable');
});
