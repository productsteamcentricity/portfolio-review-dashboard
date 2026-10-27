// covers: U-03 U-04 U-15 U-60 KI-074 D-029 (M1.4 fixes L12, L14, L15, L17: the base-file slot and the source register)
// The words and the state of the base-file slot (app/src/ui/upload-slot.ts), with the real reader on synthetic files:
// each LoadError kind as a presentation sentence (L15), an engine or reader exception as "could not be reviewed"
// (never "unreadable"), a file with no holding refused with the reader's reason and Accept unavailable (L14), the
// stage the strip and the register show (Preview before Accept, L12), the register footnote of a missing date (L17),
// and the hidden-matrix lines (L14). Every expected sentence is written out by hand.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { LoadedBaseFile, LoadError } from '../../../app/src/model/review.ts';
import type { SourceFile } from '../../../app/src/model/source.ts';
import type { EntityMatrixVM } from '../../../app/src/views/overview-vm.ts';
import type { UploadError, UploadState } from '../../../app/src/ui/upload-slot.ts';
import {
  baseFileRefusal, canAccept, failureDetail, refusalSentence, registerFootnote, registerSources, shownStage, sizeText,
  slotView,
} from '../../../app/src/ui/upload-slot.ts';
import { hiddenMatrixSentence, matrixNote } from '../../../app/src/ui/matrix-text.ts';
import { BASE_FILE_LIMITS, isLoaded, loadBaseFile } from '../../../app/src/ingest/load-base.ts';
import { readWorkbook, WorkbookReadError } from '../../../app/src/ingest/workbook.ts';
import { buildSourceRegister } from '../../../app/src/views/source-register.ts';
import { loadSheetJS, writeXlsx } from '../../helpers/sheetjs.ts';
import { syntheticFixtures } from '../../fixtures/make-books.ts';

const xlsx = loadSheetJS();
const now = (): string => '2026-10-24T00:00:00.000Z';
const MB = 1024 * 1024;
const standard = syntheticFixtures(xlsx).find((f) => f.id === 'syn-standard')!;

function load(bytes: Uint8Array, name: string): LoadedBaseFile | LoadError {
  return loadBaseFile(bytes, name, xlsx, { now });
}
function loaded(bytes: Uint8Array, name: string): LoadedBaseFile {
  const r = load(bytes, name);
  if (!isLoaded(r)) throw new Error(`${name}: ${r.kind}`);
  return r;
}
function refusedBy(bytes: Uint8Array, name: string): LoadError {
  const r = load(bytes, name);
  if (isLoaded(r)) throw new Error(`${name} was read`);
  return r;
}
const upload = (u: Partial<UploadState>): UploadState => ({ stage: null, fileName: null, size: 0, loaded: null, error: null, ...u });
const DASH_IN_SENTENCE = /[–—]/;

describe('a refusal of the reader as a sentence (L15)', () => {
  test('too large: the size in MB to one decimal and the 20 MB limit; "just over" where one decimal cannot show it', () => {
    // 22,020,096 bytes = 21 x 1,048,576: 21.0 MB.
    const big = refusedBy(new Uint8Array(21 * MB), 'huge.xlsx');
    assert.equal(big.kind, 'too-large');
    assert.equal(refusalSentence(big, 21 * MB), 'Refused: the file is 21.0 MB; the limit is 20 MB.');
    // 20,971,521 bytes: 20.000001 MB, "20.0" to one decimal, which is not above 20.
    const one = refusedBy(new Uint8Array(BASE_FILE_LIMITS.maxBytes! + 1), 'edge.xlsx');
    assert.equal(refusalSentence(one, BASE_FILE_LIMITS.maxBytes! + 1), 'Refused: the file is just over 20 MB; the limit is 20 MB.');
    // 21,011,520 bytes = 20.038 MB ("20.0"); 21,031,520 bytes = 20.057 MB ("20.1").
    assert.equal(refusalSentence(one, 20 * MB + 40000), 'Refused: the file is just over 20 MB; the limit is 20 MB.');
    assert.equal(refusalSentence(one, 20 * MB + 60000), 'Refused: the file is 20.1 MB; the limit is 20 MB.');
  });

  test('too many sheets: the count from the reader and the limit of 40', () => {
    const wb = xlsx.utils.book_new();
    for (let i = 0; i < 41; i++) xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([['Note', i]]), `S${i + 1}`);
    const bytes = writeXlsx(xlsx, wb);
    const r = refusedBy(bytes, 'many.xlsx');
    assert.equal(r.kind, 'too-many-sheets');
    assert.equal(refusalSentence(r, bytes.length), 'Refused: the workbook has 41 sheets; the limit is 40.');
    assert.equal(refusalSentence({ kind: 'too-many-sheets', message: '' }, 1), 'Refused: the workbook has more sheets than the limit of 40.');
  });

  test('too many cells: the sheet named by the reader and the limit of 4,00,000 cells on one sheet', () => {
    // The reader's own message, from a sheet of 4 cells read under a limit of 3 (the base-file limit is 4,00,000).
    let err: LoadError | null = null;
    try {
      readWorkbook(xlsx, standard.bytes, { maxCellsPerSheet: 3 });
    } catch (e) {
      if (e instanceof WorkbookReadError) err = { kind: e.reason, message: e.message };
    }
    assert.ok(err);
    assert.equal(err.kind, 'too-many-cells');
    assert.equal(refusalSentence(err, 1),
      'Refused: the sheet "Base File" has more than 4,00,000 filled cells; the limit is 4,00,000 on one sheet.');
    assert.equal(refusalSentence({ kind: 'too-many-cells', message: 'the sheet "A – B" has more than 400000 cells' }, 1),
      'Refused: the sheet "A - B" has more than 4,00,000 filled cells; the limit is 4,00,000 on one sheet.');
    assert.equal(refusalSentence({ kind: 'too-many-cells', message: '' }, 1),
      'Refused: a sheet has more than 4,00,000 filled cells; the limit is 4,00,000 on one sheet.');
  });

  test('unreadable: a damaged workbook (an OLE header with nothing after it)', () => {
    const r = refusedBy(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]), 'broken.xls');
    assert.equal(r.kind, 'unreadable');
    assert.equal(refusalSentence(r, 19), 'Refused: the file could not be read as an Excel workbook.');
  });

  test('an exception of the reader or the engine: "could not be reviewed", never "unreadable", with the detail', () => {
    const e: UploadError = { kind: 'review-failed', message: 'engine failed' };
    assert.equal(refusalSentence(e, 100), 'The file could not be reviewed: an internal error stopped the review.');
    assert.equal(failureDetail(e), 'Technical detail: engine failed.');
    assert.equal(failureDetail({ kind: 'unreadable', message: 'x' }), null, 'a refusal has no technical detail');
    assert.doesNotMatch(refusalSentence(e, 100), /unreadable/i);
  });

  test('every sentence starts with a capital, ends with a full stop and holds no en or em dash', () => {
    const errors: UploadError[] = [
      { kind: 'too-large', message: '' }, { kind: 'too-many-sheets', message: 'the workbook has 41 sheets, above the limit of 40' },
      { kind: 'too-many-cells', message: 'the sheet "S" has more than 400000 cells' }, { kind: 'unreadable', message: '' },
      { kind: 'review-failed', message: 'x' },
    ];
    for (const e of errors) {
      const s = refusalSentence(e, 21 * MB);
      assert.match(s, /^[A-Z].*\.$/, s);
      assert.doesNotMatch(s, DASH_IN_SENTENCE, s);
    }
  });

  test('file sizes: under 1 MB in KB (at least 1 KB), else MB to one decimal', () => {
    assert.equal(sizeText(500), '1 KB');
    assert.equal(sizeText(12345), '12 KB');
    assert.equal(sizeText(21 * MB), '21.0 MB');
  });
});

describe('a file with no holding is refused (L14)', () => {
  test('plain text named .xlsx: no header row, 0 holdings; refused with the reader\'s reason; Accept is not available', () => {
    const l = loaded(new TextEncoder().encode('This is not a workbook.\n'), 'notes.xlsx');
    assert.equal(l.base.holdings.length, 0);
    const reason = 'Refused: no sheet has a header row with a Client column and an Instrument column in its first 20 rows, so no holding could be read.';
    assert.equal(baseFileRefusal(l), reason);
    const u = upload({ stage: 'validate', fileName: 'notes.xlsx', size: 24, loaded: l });
    assert.equal(canAccept(u), false);
    const v = slotView(u);
    assert.deepEqual({ cls: v.cls, tone: v.tone, chip: v.chip, problem: v.problem, canAccept: v.canAccept, acceptReason: v.acceptReason, stage: v.stage }, {
      cls: 'upload-slot is-error', tone: 'crit', chip: 'Refused', problem: reason, canAccept: false,
      acceptReason: 'The file was refused: choose another base file.', stage: 'validate',
    });
  });

  test('a header row with no holding row: refused with the reader\'s sentence', () => {
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([['Client Name', 'Instrument Name', 'Current Market Value (Cr.)']]), 'Base File');
    const l = loaded(writeXlsx(xlsx, wb), 'empty.xlsx');
    assert.equal(baseFileRefusal(l), 'Refused: the sheet "Base File" has a header row but no holding rows.');
  });

  test('a standard file is not refused', () => {
    const l = loaded(standard.bytes, 'syn-standard.xlsx');
    assert.equal(baseFileRefusal(l), null);
    assert.equal(canAccept(upload({ stage: 'validate', fileName: 'syn-standard.xlsx', loaded: l })), true);
  });
});

describe('the slot in each state', () => {
  const l = loaded(standard.bytes, 'syn-standard.xlsx');
  const pick = (u: Partial<UploadState>) => {
    const v = slotView(upload(u));
    return { cls: v.cls, chip: v.chip, problem: v.problem, canAccept: v.canAccept, acceptReason: v.acceptReason, stage: v.stage };
  };

  test('no file, read and waiting, accepted', () => {
    assert.deepEqual(pick({}), {
      cls: 'upload-slot', chip: 'No file', problem: null, canAccept: false, acceptReason: 'Choose a base file first.', stage: null,
    });
    assert.deepEqual(pick({ stage: 'validate', fileName: 'a.xlsx', loaded: l }), {
      cls: 'upload-slot is-loaded', chip: 'Read, waiting for Accept', problem: null, canAccept: true,
      acceptReason: 'Check the import report, then accept the file to build the review.', stage: 'preview',
    });
    assert.deepEqual(pick({ stage: 'review', fileName: 'a.xlsx', loaded: l }), {
      cls: 'upload-slot is-loaded', chip: 'Accepted', problem: null, canAccept: false,
      acceptReason: 'Accepted: the review below and in section 2 uses this file.', stage: 'review',
    });
  });

  test('refused by the reader: the sentence, never the reader\'s message; the reason says a file was chosen', () => {
    const err: LoadError = { kind: 'too-large', message: 'the file is 22020096 bytes, above the limit of 20971520' };
    const v = pick({ stage: 'upload', fileName: 'huge.xlsx', size: 21 * MB, error: err });
    assert.deepEqual(v, {
      cls: 'upload-slot is-error', chip: 'Refused', problem: 'Refused: the file is 21.0 MB; the limit is 20 MB.', canAccept: false,
      acceptReason: 'The file was refused: choose another base file.', stage: 'upload',
    });
    assert.doesNotMatch(JSON.stringify(v), /22020096|20971520/);
  });

  test('an exception while the file was reviewed: "Not reviewed", the sentence and the detail', () => {
    const u = upload({ stage: 'validate', fileName: 'a.xlsx', loaded: l, error: { kind: 'review-failed', message: 'engine failed' } });
    const v = slotView(u);
    assert.equal(v.cls, 'upload-slot is-error');
    assert.equal(v.chip, 'Not reviewed');
    assert.equal(v.problem, 'The file could not be reviewed: an internal error stopped the review.');
    assert.equal(v.detail, 'Technical detail: engine failed.');
    assert.equal(v.canAccept, false);
    assert.equal(v.acceptReason, 'The file could not be reviewed: choose another base file.');
    assert.equal(v.stage, 'validate');
  });
});

describe('the stage the strip and the source register show (L12)', () => {
  const l = loaded(standard.bytes, 'syn-standard.xlsx');

  test('Upload, then Preview for a file read and waiting, Review once accepted; Validate for a file stopped there', () => {
    assert.equal(shownStage(upload({})), null);
    assert.equal(shownStage(upload({ stage: 'upload', fileName: 'a.xlsx' })), 'upload');
    assert.equal(shownStage(upload({ stage: 'validate', loaded: l })), 'preview');
    assert.equal(shownStage(upload({ stage: 'review', loaded: l })), 'review');
    const none = loaded(new TextEncoder().encode('x'), 'x.xlsx');
    assert.equal(shownStage(upload({ stage: 'validate', loaded: none })), 'validate');
  });

  test('before Accept the register lists the file at Preview, as the strip shows it', () => {
    const sources = registerSources(upload({ stage: 'validate', fileName: 'syn-standard.xlsx', loaded: l }), null);
    assert.equal(sources.length, 1);
    assert.equal(sources[0]!.stage, 'preview');
    assert.equal(l.source.stage, 'validate', 'the reader\'s record is not changed');
    const rows = buildSourceRegister(sources).rows;
    assert.equal(rows[0]!.stageText, 'Preview');
    assert.equal(rows[0]!.fileName, 'syn-standard.xlsx');
    assert.deepEqual(registerSources(upload({}), null), []);
  });

  test('once a review exists the register lists the review\'s own sources', () => {
    const reviewSources: SourceFile[] = [{ ...l.source, stage: 'review' }];
    const sources = registerSources(upload({ stage: 'review', loaded: l }), reviewSources);
    assert.deepEqual(sources, reviewSources);
    assert.equal(buildSourceRegister(sources).rows[0]!.stageText, 'Review (accepted)');
  });
});

describe('the source register footnote (L17)', () => {
  test('a missing date is the dash alone in the cell; the footnote names its status once', () => {
    const l = loaded(standard.bytes, 'syn-standard.xlsx');
    const rows = buildSourceRegister([{ ...l.source, stage: 'preview' }, { ...l.source, id: 'b' as SourceFile['id'], stage: 'preview' }]).rows;
    assert.equal(rows[0]!.date, '—', 'the dash alone');
    assert.equal(registerFootnote(rows), 'A dash in the Data date column marks a missing date: not available in supplied data.');
    assert.equal(registerFootnote([{ dateStatus: null }]), null);
    assert.doesNotMatch(registerFootnote(rows)!, DASH_IN_SENTENCE);
  });
});

describe('the client and distributor lines (L14)', () => {
  const matrix = (level: 'client' | 'distributor', labels: string[], shown: boolean): EntityMatrixVM => ({
    level, title: level === 'client' ? 'Client Allocation' : 'Distributor Allocation', shown, rows: [],
    columns: labels.map((label, i) => ({ id: `C0${i + 1}`, label, cmv: null as never, share: null as never })),
  });

  test('no column: "No included holding", never "Single client"', () => {
    const m = matrix('client', [], false);
    assert.equal(matrixNote(m), 'No included holding');
    assert.equal(hiddenMatrixSentence(m), 'No included holding: no client matrix is shown, and the workbook has no Client Allocation sheet.');
    const d = matrix('distributor', [], false);
    assert.equal(matrixNote(d), 'No included holding');
    assert.equal(hiddenMatrixSentence(d), 'No included holding: no distributor matrix is shown, and the workbook has no Distributor Allocation sheet.');
  });

  test('one column: the single client or distributor; two or more: the count', () => {
    const one = matrix('client', ['Sample Client A'], false);
    assert.equal(matrixNote(one), 'Single client');
    assert.equal(hiddenMatrixSentence(one),
      'Single client: Sample Client A holds every included holding. No client matrix is shown, and the workbook has no Client Allocation sheet.');
    assert.equal(matrixNote(matrix('distributor', ['Centricity'], false)), 'Single distributor');
    assert.equal(matrixNote(matrix('client', ['A', 'B'], true)), '2 clients');
    assert.equal(matrixNote(matrix('distributor', ['A', 'B', 'C'], true)), '3 distributors');
  });
});
