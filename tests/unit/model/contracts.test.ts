// covers: C-01 I-31 I-32 I-37 I-44 I-45 OD-3 KI-186 KI-211 M3 M7 M11 M12
// The model contracts of docs/coordination/INTERFACE_CONTRACTS.md: decision C-01 (the import record's types in
// model/, re-exported from ingest/, so the model imports nothing outside model/), the type files of I-31, I-32, I-37,
// I-44 and I-45 (types only: no run-time export, each citing its contract), the analyst question as a union on its
// kind (contracts-2: the base file asks only the XIRR-unit question, the capital-gains reader's question is the model's
// type), and the I-32 free-text date rule as the existing date readers implement it, the same calendar day in every
// time zone (run under TZ=Asia/Kolkata and TZ=UTC).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../../helpers/sheetjs.ts';
import { excelSerialToDay, parseDayText, ymdToDay } from '../../../app/src/engine/dates.ts';
import * as modelIndex from '../../../app/src/model/index.ts';
import * as baseFileModel from '../../../app/src/model/base-file.ts';
import * as returnsModel from '../../../app/src/model/returns.ts';
import * as transactionsModel from '../../../app/src/model/transactions.ts';
import * as scopeModel from '../../../app/src/model/scope.ts';
import * as indexSeriesModel from '../../../app/src/model/index-series.ts';
import * as taxModel from '../../../app/src/model/tax.ts';
import * as ingestBaseFile from '../../../app/src/ingest/base-file.ts';
import * as units from '../../../app/src/engine/units.ts';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { SYNTHETIC_BOOK, buildVariants } from '../../fixtures/make-books.ts';

const MODEL = path.join(REPO, 'app', 'src', 'model');
const read = (...p: string[]): string => fs.readFileSync(path.join(REPO, ...p), 'utf8');
const importsOf = (text: string): string[] => [...text.matchAll(/\bfrom\s+'([^']+)'/g)].map((m) => m[1]!);

test('C-01: no model file imports from outside model/ (the model -> ingest -> model cycle is broken)', () => {
  const files = fs.readdirSync(MODEL).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length >= 14, `model files: ${files.join(', ')}`);
  for (const f of files) {
    for (const spec of importsOf(fs.readFileSync(path.join(MODEL, f), 'utf8'))) {
      assert.match(spec, /^\.\/[a-z-]+\.ts$/, `${f} imports ${spec}`);
    }
  }
  assert.ok(importsOf(read('app/src/model/review.ts')).includes('./base-file.ts'));
});

test('C-01: ingest/base-file.ts and engine/units.ts re-export the moved types, and their run-time exports are intact', () => {
  const ingest = read('app/src/ingest/base-file.ts');
  const reexport = /export type \{([^}]*)\} from '\.\.\/model\/base-file\.ts';/.exec(ingest);
  assert.ok(reexport, 'ingest/base-file.ts re-exports from model/base-file.ts');
  assert.deepEqual(reexport[1]!.split(',').map((s) => s.trim()).filter(Boolean).sort(),
    ['BaseField', 'BaseFileCounts', 'BaseFileImport', 'ColumnUse', 'MoneyField', 'MoneyFinding']);
  for (const name of ['BaseFileImport', 'MoneyFinding', 'BaseFileCounts', 'ColumnUse', 'MoneyField', 'BaseField']) {
    assert.doesNotMatch(ingest, new RegExp(`export type ${name}\\b`), `${name} is declared only in model/`);
  }
  assert.match(read('app/src/engine/units.ts'), /export type \{ MoneyUnit \} from '\.\.\/model\/value\.ts';/);
  assert.equal(typeof ingestBaseFile.parseBaseFile, 'function');
  assert.equal(ingestBaseFile.BASE_FILE_PARSER_VERSION, 'base-file@1');
  assert.equal(units.toCrore(250, 'lakh'), 2.5);
});

test('the contract files are types only: no run-time export; model/index.ts exports the same constants as before', () => {
  const contracts = { baseFileModel, returnsModel, transactionsModel, scopeModel, indexSeriesModel, taxModel };
  for (const [name, mod] of Object.entries(contracts)) {
    assert.deepEqual(Object.keys(mod), [], name);
  }
  assert.deepEqual(Object.keys(modelIndex).sort(),
    ['ASSET_ORDER', 'MISSING_STATUSES', 'MODEL_SCHEMA_VERSION', 'SEVERITIES', 'STATUS']);
  assert.equal(modelIndex.MODEL_SCHEMA_VERSION, 1);
});

test('each contract file cites its contract id in its header', () => {
  const cites: Array<[string, string]> = [
    ['base-file.ts', 'Decision C-01'], ['returns.ts', 'contract I-31'], ['transactions.ts', 'contract I-32'],
    ['index-series.ts', 'contract I-44'], ['scope.ts', 'contract I-45'], ['tax.ts', 'contract I-37'],
  ];
  for (const [file, id] of cites) {
    const header = read('app/src/model', file).split('\n').slice(0, 3).join(' ');
    assert.ok(header.includes(id), `${file} names ${id}`);
  }
});

const day = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return ymdToDay(y!, m!, d!)!;
};

test('I-32 free-text date rule: text is the day written in every time zone, a zone never moves it (KI-186)', () => {
  const cases: Array<[string, string]> = [
    ['2023-04-01', '2023-04-01'],
    ['2023-04-01T20:00:00Z', '2023-04-01'],
    ['2023-04-01T00:00:00+05:30', '2023-04-01'],
    ['2023-04-01 23:59:59+0530', '2023-04-01'],
    ['2026-03-31T18:30:00.000Z', '2026-03-31'],
    ['2023/04/01', '2023-04-01'],
    ['01-04-2023', '2023-04-01'],
    ['01/04/2023 00:00:00', '2023-04-01'],
    ['13/04/2023', '2023-04-13'],
    ['1 Apr 2023', '2023-04-01'],
    ['01-Apr-2023', '2023-04-01'],
  ];
  for (const [text, iso] of cases) assert.equal(parseDayText(text), day(iso), `${text} (TZ=${process.env.TZ ?? 'unset'})`);
  // The KI-186 known answer's dates: Rs 1,00,000 paid on the first, Rs 1,10,000 back on the second, 366 days apart.
  assert.equal(parseDayText('2025-03-31T00:30:00+05:30')! - parseDayText('2024-03-30T20:00:00Z')!, 366);
});

test('I-32 free-text date rule: other text and impossible dates are not read (the row is skipped, never rolled)', () => {
  for (const text of ['Sat, 01 Apr 2023 20:00:00 GMT', '2023-04-01Z', '31-02-2024', '2023-13-01', '2023-02-30',
    '45017', '2023', '2023-04', '']) {
    assert.equal(parseDayText(text), null, text);
  }
});

test('I-32 free-text date rule: a date cell is its serial\'s whole day; a time of day before 23:59 never moves it (KI-211)', () => {
  assert.equal(excelSerialToDay(45017), day('2023-04-01'));
  assert.equal(excelSerialToDay(45017.5), day('2023-04-01'));
  assert.equal(excelSerialToDay(45017.75), day('2023-04-01'));
  assert.equal(excelSerialToDay(46112.99), day('2026-03-31'));
  // The last minute of a day counts as the next day: the tolerance that absorbs the SheetJS drift (engine/dates.ts).
  assert.equal(excelSerialToDay(46112.9999), day('2026-04-01'));
});

/** The top-level statements of a source file with its comments removed: what Node runs once the types are stripped. */
const statementsOf = (text: string): string[] => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  .split(/\n(?=[^\s}])/).map((s) => s.trim()).filter(Boolean);

test('I-37: model/tax.ts imports only model files, has no run-time statement, and names its sources of record', () => {
  const text = read('app/src/model/tax.ts');
  assert.deepEqual(importsOf(text).sort(), ['./ids.ts', './source.ts', './value.ts']);
  const statements = statementsOf(text);
  assert.ok(statements.length >= 18, `statements: ${statements.length}`);
  for (const s of statements) assert.match(s, /^(import type|export type) /, s.split('\n')[0]!);
  const index = read('app/src/model/index.ts');
  for (const name of ['TaxClass', 'TaxSubType', 'LotClass', 'CostBasis', 'Term', 'GainSource', 'NotComputed', 'FyStart',
    'RealisedGain', 'TaxInputs', 'Bucket', 'PersonYearTax', 'FamilyTaxYear', 'TaxPosition', 'HarvestResult']) {
    assert.match(text, new RegExp(`^export type ${name}\\b`, 'm'), name);
    assert.match(index, new RegExp(`\\b${name}\\b[^;]*from '\\./tax\\.ts'`), `model/index.ts exports ${name}`);
  }
  const header = text.split('\nimport ')[0]!;
  for (const ref of ['DATA_DICTIONARY.md §5.5', '§6 paths', '`tax.*`', 'capital-gains-upload.md §4', '§5', '§9',
    'data/owner/tax-rules.json', 'data/refdata/TAX_RULES.json', 'I-21', 'tests/fixtures/cg-known-answers.json',
    "'inr'", "'inr-per-unit'"]) {
    assert.ok(header.includes(ref), `the header names ${ref}`);
  }
  assert.match(read('app/src/model/value.ts'), /'cr' \| 'inr' \| 'inr-per-unit' \|/);
});

test('AnalystQuestion is a union on kind; the capital-gains question is the model type, re-exported where it was', () => {
  const validation = read('app/src/model/validation.ts');
  assert.match(validation, /export type AnalystQuestion = XirrUnitQuestion \| CapitalGainsRepeatsQuestion;/);
  assert.match(validation, /export type XirrUnitQuestion = \{[^}]*kind: 'xirr-unit';/);
  assert.match(validation, /export type CapitalGainsRepeatsQuestion = \{[^}]*kind: 'capital-gains-repeats';/);
  assert.match(validation, /export type CgRepeatAnswer = 'as-stated' \| 'once';/);
  const cg = read('app/src/ingest/capital-gains.ts');
  assert.match(cg, /export type \{ CgRepeatAnswer \} from '\.\.\/model\/validation\.ts';/);
  assert.match(cg, /export type CgRepeatQuestion = CapitalGainsRepeatsQuestion;/);
  assert.doesNotMatch(cg, /export type CgRepeatAnswer =/, 'CgRepeatAnswer is declared only in model/');
  // The base file asks only the XIRR-unit question, so the import report renders only that kind: narrowed by type,
  // since app/tsconfig.json (npm run typecheck) checks app/src and not the tests.
  assert.match(read('app/src/model/base-file.ts'), /\n {2}questions: XirrUnitQuestion\[\];/);
  assert.match(read('app/src/ingest/base-file.ts'), /const questions: XirrUnitQuestion\[\] = \[\];/);
  assert.match(read('app/src/views/import-report.ts'), /function question\(q: XirrUnitQuestion\): QuestionVM/);
});

test('AnalystQuestion: the base-file reader asks only xirr-unit questions, with the XirrUnitQuestion fields (OD-3)', () => {
  const xlsx = loadSheetJS();
  const f = buildVariants(xlsx, SYNTHETIC_BOOK, 'syn').find((v) => v.id === 'syn-ambiguous-xirr')!;
  const base = ingestBaseFile.parseBaseFile(readWorkbook(xlsx, f.bytes),
    { sourceId: 'a'.repeat(64) as SourceFileId, now: () => '2026-10-24T00:00:00.000Z' });
  assert.equal(base.questions.length, 2);
  for (const q of base.questions) {
    assert.equal(q.kind, 'xirr-unit');
    assert.deepEqual(Object.keys(q).sort(),
      ['column', 'decision', 'evidence', 'field', 'id', 'kind', 'options', 'prompt', 'sheet']);
  }
});
