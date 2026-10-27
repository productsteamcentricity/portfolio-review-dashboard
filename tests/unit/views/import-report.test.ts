// covers: U-03 U-60 OD-8 OD-3 KI-074
// The import report of section 1 on synthetic books read by the real reader: the sheet used and its header row, the
// sheets tried, the money unit, the counts, the skipped rows by reason with their row numbers (worked out from the
// fixture's layout in tests/fixtures/make-books.ts), the excluded holdings by name, the open XIRR question, and the
// line that matching arrives in M2.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildImportReport, MATCHING_LINE } from '../../../app/src/views/import-report.ts';
import { SYNTHETIC_BOOK } from '../../fixtures/make-books.ts';
import { sampleLoaded } from '../../helpers/sample-review.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { buildVariants } from '../../fixtures/make-books.ts';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import type { SourceFile } from '../../../app/src/model/source.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import { missing } from '../../../app/src/engine/value.ts';
import { STATUS } from '../../../app/src/model/status.ts';

const xlsx = loadSheetJS();
const fixtures = new Map(buildVariants(xlsx, SYNTHETIC_BOOK, 'syn').map((f) => [f.id, f]));
const SRC = 'a'.repeat(64) as SourceFileId;

function report(id: string) {
  const f = fixtures.get(id)!;
  const base = parseBaseFile(readWorkbook(xlsx, f.bytes), { sourceId: SRC, now: () => '2026-10-24T00:00:00.000Z' });
  const source: SourceFile = {
    id: SRC, fileName: `${id}.xlsx`, role: 'base-file', class: 'N', asOn: missing(STATUS.NOT_AVAILABLE, 'none'),
    parserVersion: base.parserVersion, stage: 'validate', bytes: f.bytes.length,
  };
  return buildImportReport(source, base);
}

describe('the import report', () => {
  test('syn-standard: sheet "Base File", header in row 1, Crore, six holdings, nothing skipped', () => {
    const loaded = sampleLoaded('standard');
    const r = buildImportReport(loaded.source, loaded.base);
    assert.equal(r.summary, 'Read 6 holdings from sheet "Base File" (header in row 1): 6 included, 0 excluded.');
    assert.deepEqual(r.sheet, { name: 'Base File', headerRow: 1 });
    assert.deepEqual(r.sheetsTried, [{ sheet: 'Base File', outcome: 'read', headerRow: 1 }]);
    assert.equal(r.moneyUnit, 'Crore (columns marked Cr.)');
    assert.deepEqual(r.counts.map((c) => [c.id, c.value]),
      [['data-rows', 6], ['holding-rows', 6], ['merged-rows', 0], ['holdings', 6], ['included', 6], ['excluded', 0]]);
    assert.deepEqual(r.skipped, []);
    assert.deepEqual(r.excluded, []);
    assert.deepEqual(r.questions, []);
    assert.equal(r.fileName, 'syn-standard.xlsx');
    assert.equal(r.sha256, loaded.source.id);
    assert.ok(r.columns.some((c) => c.header === 'Current Market Value (Cr.)' && c.field === 'cmvCr'));
  });

  test('the money unit of a Lakh book and a rupee book', () => {
    assert.equal(report('syn-lakh').moneyUnit, 'Lakh (columns marked Lakh)');
    assert.equal(report('syn-rupee').moneyUnit, 'rupees (columns without a unit)');
  });

  test('sheets tried: a notes sheet first, then the holdings on "Holdings Report" (KI-074)', () => {
    const r = report('syn-note-sheet-first');
    assert.deepEqual(r.sheetsTried, [
      { sheet: 'Read Me', outcome: 'no header row found', headerRow: null },
      { sheet: 'Holdings Report', outcome: 'read', headerRow: 1 },
    ]);
    assert.match(r.summary, /^Read 6 holdings from sheet "Holdings Report" \(header in row 1\)/);
  });

  test('skipped rows by reason with their rows: row 9 without a name but with an amount, row 11 a total', () => {
    // Layout: header row 1; holdings in rows 2, 3, 5, 6, 8, 10; a blank row 4; a repeated header in row 7; a row
    // without an Instrument Name in row 9; a total row in row 11.
    const r = report('syn-skipped-rows');
    assert.deepEqual(r.skipped.map((g) => [g.reason, g.label, g.count, g.rows, g.withAmount]), [
      ['no-instrument-name', 'Rows without an Instrument Name', 1, [9], 1],
      ['total-row', 'Total rows', 1, [11], 1],
      ['repeated-header', 'Repeated header rows', 1, [7], 0],
      ['blank-row', 'Blank rows', 1, [4], 0],
    ]);
  });

  test('excluded holdings by name, with their rows and reason (OD-8)', () => {
    const r = report('syn-na-cmv');
    assert.deepEqual(r.excluded, [
      { name: SYNTHETIC_BOOK[1]!.name, rows: [3], reason: 'no market value' },
      { name: SYNTHETIC_BOOK[3]!.name, rows: [5], reason: 'no market value' },
    ]);
    assert.match(r.summary, /6 holdings .*: 4 included, 2 excluded\.$/);
  });

  test('a market value that is not a number is listed as invalid source data', () => {
    const r = report('syn-invalid-text');
    assert.deepEqual(r.excluded.map((e) => [e.name, e.reason]), [
      [SYNTHETIC_BOOK[0]!.name, 'market value not a number (invalid source data)'],
      [SYNTHETIC_BOOK[1]!.name, 'market value not a number (invalid source data)'],
    ]);
  });

  test('the open XIRR question with its two answers (OD-3)', () => {
    const r = report('syn-ambiguous-xirr');
    assert.deepEqual(r.questions.map((q) => [q.field, q.column, q.options.map((o) => o.choice)]),
      [['xirr', 'XIRR (%)', ['percent', 'fraction']], ['bmXirr', 'BMXIRR (%)', ['percent', 'fraction']]]);
    assert.equal(r.questions[0]!.evidence, '6 unformatted numbers, the largest 0.184 in size.');
    assert.deepEqual(r.questions[0]!.options.map((o) => o.label),
      ['Percent numbers (8.79 means 8.79%)', 'Fractions (0.0879 means 8.79%)']);
  });

  test('matching arrives in M2, and no line holds an en or em dash', () => {
    const r = report('syn-skipped-rows');
    assert.equal(r.matching, MATCHING_LINE);
    assert.match(r.matching, /^Instrument matching arrives in M2/);
    assert.ok(!/[\u2013\u2014]/.test(JSON.stringify(r)));
  });
});
