// The import report of section 1 (the Validate and Preview stages of architecture §13.1): what the base-file reader
// read, from where, and what it left out and why (KI-074, OD-8, U-03, U-60). Selection and labelling only.

import type { SourceFile, SkipReason } from '../model/source.ts';
import type { AnalystQuestion, XirrUnitChoice } from '../model/validation.ts';
import type { BaseFileImport } from '../ingest/base-file.ts';
import type { MoneyUnit } from '../engine/units.ts';
import { STATUS } from '../model/status.ts';
import { plainText, plural } from './format.ts';

export const MATCHING_LINE = 'Instrument matching arrives in M2: until then no holding is matched to a fund, and none is reported as unmatched.';

export type ImportCount = { id: string; label: string; value: number };
export type SkippedGroup = { reason: SkipReason; label: string; count: number; rows: number[]; withAmount: number };
export type ExcludedHolding = { name: string; rows: number[]; reason: string };
export type QuestionVM = {
  id: string;
  field: 'xirr' | 'bmXirr';
  column: string;
  prompt: string;
  evidence: string;
  options: Array<{ choice: XirrUnitChoice; label: string }>;
};

export type ImportReportVM = {
  fileName: string;
  bytes: number;
  sha256: string;
  /** One sentence: what was read from where. */
  summary: string;
  sheet: { name: string; headerRow: number } | null;
  sheetsTried: Array<{ sheet: string; outcome: string; headerRow: number | null }>;
  moneyUnit: string;
  columns: Array<{ header: string; field: string }>;
  counts: ImportCount[];
  skipped: SkippedGroup[];
  excluded: ExcludedHolding[];
  questions: QuestionVM[];
  matching: string;
};

const UNIT_TEXT: Readonly<Record<MoneyUnit, string>> = {
  crore: 'Crore (columns marked Cr.)',
  lakh: 'Lakh (columns marked Lakh)',
  rupee: 'rupees (columns without a unit)',
};

const OUTCOME_TEXT: Readonly<Record<string, string>> = {
  used: 'read',
  'no-header': 'no header row found',
  'no-rows': 'header found, no rows below it',
  'not-needed': 'not needed',
};

export const SKIP_LABEL: Readonly<Record<SkipReason, string>> = {
  'blank-row': 'Blank rows',
  'repeated-header': 'Repeated header rows',
  'total-row': 'Total rows',
  'no-instrument-name': 'Rows without an Instrument Name',
};
const SKIP_ORDER: readonly SkipReason[] = ['no-instrument-name', 'total-row', 'repeated-header', 'blank-row'];

const CHOICE_LABEL: Readonly<Record<XirrUnitChoice, string>> = {
  percent: 'Percent numbers (8.79 means 8.79%)',
  fraction: 'Fractions (0.0879 means 8.79%)',
};

function question(q: AnalystQuestion): QuestionVM {
  return {
    id: q.id,
    field: q.field,
    column: plainText(q.column),
    prompt: plainText(q.prompt),
    evidence: `${plural(q.evidence.values, 'unformatted number', 'unformatted numbers')}, the largest ${q.evidence.maxAbs} in size.`,
    options: q.options.map((choice) => ({ choice, label: CHOICE_LABEL[choice] })),
  };
}

/** The import report of one base file. */
export function buildImportReport(source: SourceFile, base: BaseFileImport): ImportReportVM {
  const c = base.counts;
  const sheet = base.sheet;
  const summary = sheet
    ? `Read ${plural(c.holdings, 'holding', 'holdings')} from sheet "${plainText(sheet.name)}" (header in row ${sheet.headerRow}):`
      + ` ${c.included} included, ${c.excluded} excluded.`
    : 'No sheet of this file has a header row with Client and Instrument columns, so no holding was read.';

  const skipped: SkippedGroup[] = [];
  for (const reason of SKIP_ORDER) {
    const rows = base.skipped.filter((s) => s.reason === reason);
    if (rows.length === 0) continue;
    skipped.push({
      reason,
      label: SKIP_LABEL[reason],
      count: rows.length,
      rows: rows.map((r) => r.at.row),
      withAmount: rows.filter((r) => r.hasMoney).length,
    });
  }

  const excluded: ExcludedHolding[] = base.holdings
    .filter((h) => h.inclusion.status === 'excluded')
    .map((h) => ({
      name: plainText(h.instrumentName),
      rows: h.rows.map((r) => r.row),
      reason: h.cmv.kind === 'missing' && h.cmv.status === STATUS.INVALID_SOURCE
        ? 'market value not a number (invalid source data)' : 'no market value',
    }));

  return {
    fileName: plainText(source.fileName),
    bytes: source.bytes,
    sha256: source.id,
    summary,
    sheet: sheet ? { name: plainText(sheet.name), headerRow: sheet.headerRow } : null,
    sheetsTried: base.sheets.map((s) => ({ sheet: plainText(s.sheet), outcome: OUTCOME_TEXT[s.outcome] ?? s.outcome, headerRow: s.headerRow })),
    moneyUnit: base.moneyUnit ? UNIT_TEXT[base.moneyUnit] : 'not found: no money column',
    columns: base.columns.map((col) => ({ header: plainText(col.header), field: col.field })),
    counts: [
      { id: 'data-rows', label: 'Rows below the header', value: c.dataRows },
      { id: 'holding-rows', label: 'Rows read as holdings', value: c.holdingRows },
      { id: 'merged-rows', label: 'Rows merged into another holding (same folio key)', value: c.mergedRows },
      { id: 'holdings', label: 'Holdings', value: c.holdings },
      { id: 'included', label: 'Included in every total', value: c.included },
      { id: 'excluded', label: 'Excluded and listed (no market value)', value: c.excluded },
    ],
    skipped,
    excluded,
    questions: base.questions.map(question),
    matching: MATCHING_LINE,
  };
}
