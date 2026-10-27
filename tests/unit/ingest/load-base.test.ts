// covers: U-04 E-01 U-60
// Loading a picked base file (ingest/load-base.ts): the source register id is the file's SHA-256, the upload limits
// refuse a file that is too large or has too many sheets, and the source register record of a base file.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BASE_FILE_LIMITS, isLoaded, loadBaseFile } from '../../../app/src/ingest/load-base.ts';
import { BASE_FILE_PARSER_VERSION } from '../../../app/src/ingest/base-file.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { loadSheetJS, writeXlsx } from '../../helpers/sheetjs.ts';
import { syntheticFixtures } from '../../fixtures/make-books.ts';

const xlsx = loadSheetJS();
const now = (): string => '2026-10-24T00:00:00.000Z';
const standard = syntheticFixtures(xlsx).find((f) => f.id === 'syn-standard')!;

describe('loadBaseFile', () => {
  test('the limits: 20 MB, 40 sheets, 400,000 cells on a sheet', () => {
    assert.deepEqual(BASE_FILE_LIMITS, { maxBytes: 20 * 1024 * 1024, maxSheets: 40, maxCellsPerSheet: 400000 });
  });
  test('a base file: its SHA-256 is the source id, and the source register record', () => {
    const r = loadBaseFile(standard.bytes, 'Sample.xlsx', xlsx, { now });
    assert.ok(isLoaded(r));
    const sha = createHash('sha256').update(standard.bytes).digest('hex');
    assert.equal(r.source.id, sha);
    assert.equal(r.base.sourceId, sha);
    assert.deepEqual({ ...r.source, asOn: null }, {
      id: sha, fileName: 'Sample.xlsx', role: 'base-file', class: 'N', asOn: null, parserVersion: BASE_FILE_PARSER_VERSION,
      stage: 'validate', bytes: standard.bytes.length,
    });
    assert.deepEqual(r.source.asOn, { kind: 'missing', status: STATUS.NOT_AVAILABLE, reason: 'a base file carries no date' });
    assert.equal(r.base.holdings.length, 6);
    assert.equal(r.base.audit[0]!.at, now());
  });
  test('the answers reach the reader', () => {
    const f = syntheticFixtures(xlsx).find((x) => x.id === 'syn-ambiguous-xirr')!;
    const open = loadBaseFile(f.bytes, 'a.xlsx', xlsx, { now });
    const answered = loadBaseFile(f.bytes, 'a.xlsx', xlsx, { now, answers: { xirr: 'fraction', bmXirr: 'fraction' } });
    assert.ok(isLoaded(open) && isLoaded(answered));
    assert.equal(open.base.questions.length, 2);
    assert.equal(answered.base.questions.length, 0);
  });
  test('a file above 20 MB is refused before it is read', () => {
    const big = new Uint8Array(BASE_FILE_LIMITS.maxBytes! + 1);
    const r = loadBaseFile(big, 'big.xlsx', xlsx, { now });
    assert.ok(!isLoaded(r));
    assert.equal(r.kind, 'too-large');
    assert.match(r.message, /above the limit of 20971520/);
  });
  test('a workbook of 41 sheets is refused; 40 sheets are read', () => {
    const book = (n: number): Uint8Array => {
      const wb = xlsx.utils.book_new();
      for (let i = 0; i < n; i++) xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([['Note', i]]), `S${i + 1}`);
      return writeXlsx(xlsx, wb);
    };
    const r41 = loadBaseFile(book(41), 'many.xlsx', xlsx, { now });
    assert.ok(!isLoaded(r41));
    assert.equal(r41.kind, 'too-many-sheets');
    const r40 = loadBaseFile(book(40), 'forty.xlsx', xlsx, { now });
    assert.ok(isLoaded(r40));
    assert.equal(r40.base.issues[0]!.ruleId, 'base-file.no-header');
  });
});
