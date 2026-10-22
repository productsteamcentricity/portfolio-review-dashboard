// Base-file parser (architecture §7 `ingest/base-file.ts`; parity rows E-01, E-02; PRD R-IN-1, R-IN-8).
//
// A port of the legacy parseBaseRows (index.html, 07_engine.js) with the accepted decisions applied. Every
// difference from the legacy output is classified in tests/parity/base-file-ledger.json:
//   - header search: the sheet named "Base File" first, then every other sheet in order; a header row anywhere in
//     the first 20 rows; the sheet used is named, and every skipped row is reported by reason (KI-074);
//   - XIRR units (OD-3, KI-005): percent-formatted cells are read as percentages automatically; an unformatted
//     column whose values are all below 1.5 in size raises an analyst question and its values stay missing until it
//     is answered (never a guess); otherwise the column holds percent numbers, as the template says;
//   - asset (OD-7): "Fixed Income" and "Debt Funds" are Debt; a blank or unrecognised Asset Name stays unknown with
//     a notice, never Equity;
//   - no market value (OD-8, KI-057): the holding is excluded from every total and listed, never shown at zero;
//   - blank invested value stays missing (KI-007); merged folios with a blank invested value, gain or units leave
//     that total missing instead of partial (KI-113);
//   - Allocation (%) is not read: weights are computed from market values by the engine (KI-093, OD-22), and the
//     file's own rupee columns are not echoed (OD-22).
// Column aliases, the money-unit precedence (Cr., then Lakh, then rupees) and the merge key (client, instrument,
// product, distributor) are the legacy ones. Pure function: no globals, no network, no clock unless injected.

import type { Cell, Sheet, Workbook } from './workbook.ts';
import type { NumberRead } from './cells.ts';
import type { MoneyUnit } from '../engine/units.ts';
import type { DayNumber, Provenance, Value } from '../model/value.ts';
import type {
  AccountId, ClientId, DistributorId, FolioId, HoldingId, SourceFileId,
} from '../model/ids.ts';
import type { RowRef, SheetAttempt, SkipReason, SkippedRow } from '../model/source.ts';
import type { AssetClass, Holding } from '../model/holding.ts';
import type { Account, Client, Distributor, Folio, HoldingMode, Ownership } from '../model/ownership.ts';
import type {
  AnalystQuestion, Severity, ValidationResult, ValidationScope, XirrUnitChoice,
} from '../model/validation.ts';
import type { AuditEntry } from '../model/audit.ts';
import { STATUS } from '../model/status.ts';
import { cellText, findHeaderRow } from './workbook.ts';
import { readDate, readNumber } from './cells.ts';
import { toCrore, fractionToPct } from '../engine/units.ts';
import { missing, present } from '../engine/value.ts';
import { idFactory, keyOf, normaliseLabel } from '../engine/ids.ts';
import { readAssetLabel } from '../engine/classify/asset.ts';
import { defaultOwnership, ownershipFromColumns, parseHoldingMode } from '../engine/ownership.ts';

export const BASE_FILE_PARSER_VERSION = 'base-file@1';
/** Rows searched for the header on each sheet (KI-074; the audit's fix asks for about 20, the legacy read 5). */
export const HEADER_SCAN_ROWS = 20;
/** OD-3: an unformatted XIRR column whose values are all below this size is ambiguous and the analyst is asked. */
export const XIRR_FRACTION_LIMIT = 1.5;
/** The template's sheet name, tried first (the legacy precedence). */
export const PREFERRED_SHEET = 'Base File';
/** The product of a row whose Product Name is blank: the legacy default, flagged on the holding. */
export const DEFAULT_PRODUCT = 'Mutual Funds';

/** Base-file columns. The first 24 are the legacy aliases; the holder columns are new (proposal, Q-79). */
export type BaseField =
  | 'client' | 'name' | 'pdate' | 'cat' | 'asset' | 'folio' | 'amc' | 'product' | 'dist' | 'units'
  | 'invR' | 'mvR' | 'glR' | 'invLk' | 'mvLk' | 'glLk' | 'invCr' | 'cmvCr' | 'glCr'
  | 'alloc' | 'xirr' | 'bmxirr' | 'days' | 'liq'
  | 'holder2' | 'holder3' | 'guardian' | 'mode';

const has = (h: string, s: string): boolean => h.indexOf(s) >= 0;
const isCr = (h: string): boolean => has(h, 'cr');
const isLk = (h: string): boolean => has(h, 'lakh') || has(h, 'lac');

/**
 * Header predicates on the lower-cased, space-collapsed header text; the first matching column wins. The legacy
 * ones are copied from 07_engine.js parseBaseRows unchanged (including its loose "cr" test).
 */
const FIELD_PREDICATES: ReadonlyArray<readonly [BaseField, (h: string) => boolean]> = [
  ['client', (h) => h === 'client name' || has(h, 'client')],
  ['name', (h) => has(h, 'instrument')],
  ['pdate', (h) => has(h, 'purchase') && (has(h, 'date') || has(h, 'dt'))],
  ['cat', (h) => has(h, 'category')],
  ['asset', (h) => h === 'asset name' || (has(h, 'asset') && has(h, 'name'))],
  ['folio', (h) => has(h, 'folio')],
  ['amc', (h) => h === 'amc'],
  ['product', (h) => has(h, 'product')],
  ['dist', (h) => has(h, 'distributor')],
  ['units', (h) => h === 'units'],
  ['invR', (h) => has(h, 'invested') && !isCr(h) && !isLk(h)],
  ['mvR', (h) => has(h, 'market value') && !isCr(h) && !isLk(h)],
  ['glR', (h) => has(h, 'gain') && !isCr(h) && !isLk(h)],
  ['invLk', (h) => has(h, 'invested') && isLk(h)],
  ['mvLk', (h) => has(h, 'market value') && isLk(h)],
  ['glLk', (h) => has(h, 'gain') && isLk(h)],
  ['invCr', (h) => has(h, 'invested') && isCr(h)],
  ['cmvCr', (h) => has(h, 'market value') && isCr(h)],
  ['glCr', (h) => has(h, 'gain') && isCr(h)],
  ['alloc', (h) => has(h, 'allocation')],
  ['xirr', (h) => has(h, 'xirr') && !has(h, 'bm')],
  ['bmxirr', (h) => has(h, 'bmxirr') || (has(h, 'bm') && has(h, 'xirr'))],
  ['days', (h) => has(h, 'holding') && has(h, 'day')],
  ['liq', (h) => h === 'liquidity' || (has(h, 'liquid') && !has(h, 'structure'))],
  ['holder2', (h) => /^(second|2nd|joint) holder( name)?$|^joint holder 1$|^holder 2( name)?$/.test(h)],
  ['holder3', (h) => /^(third|3rd) holder( name)?$|^joint holder 2$|^holder 3( name)?$/.test(h)],
  ['guardian', (h) => /^guardian( name)?$/.test(h)],
  ['mode', (h) => /^(mode of holding|holding mode)$/.test(h)],
];

type Columns = Partial<Record<BaseField, number>>;

export type ColumnUse = { field: BaseField; header: string; column: number };

export type BaseFileOptions = {
  /** SHA-256 of the file, computed by the caller (the source register id). */
  sourceId: SourceFileId;
  /** The analyst's answers to open questions (OD-3), by field. */
  answers?: Partial<Record<'xirr' | 'bmXirr', XirrUnitChoice>>;
  /** Clock for the audit entries (ISO 8601); defaults to the system clock. */
  now?: () => string;
};

export type BaseFileCounts = {
  /** Rows below the header on the sheet used. */
  dataRows: number;
  /** Rows that carry an instrument name and are not repeated headers. */
  holdingRows: number;
  holdings: number;
  included: number;
  excluded: number;
  /** Included rows that merged into another row's holding (E-02). */
  mergedRows: number;
  skipped: Record<SkipReason, number>;
};

export type BaseFileImport = {
  parserVersion: string;
  sourceId: SourceFileId;
  /** The sheet read and its 1-based header row; null when no sheet has a header. */
  sheet: { name: string; headerRow: number } | null;
  sheets: SheetAttempt[];
  columns: ColumnUse[];
  /** The unit the money columns are written in (the display unit): Crore if any Cr. column, else Lakh, else rupees. */
  moneyUnit: MoneyUnit | null;
  holdings: Holding[];
  clients: Client[];
  distributors: Distributor[];
  accounts: Account[];
  folios: Folio[];
  ownership: Ownership[];
  skipped: SkippedRow[];
  questions: AnalystQuestion[];
  issues: ValidationResult[];
  audit: AuditEntry[];
  counts: BaseFileCounts;
};

// ---------------------------------------------------------------------------------------------------------------

/** The legacy header test: the row's text mentions both "instrument" and "client". */
function isHeaderRow(texts: string[]): boolean {
  const joined = texts.join('|');
  return joined.indexOf('instrument') >= 0 && joined.indexOf('client') >= 0;
}

function mapColumns(headerTexts: string[]): Columns {
  const cols: Columns = {};
  for (const [field, pred] of FIELD_PREDICATES) {
    const j = headerTexts.findIndex((h) => pred(h));
    if (j >= 0) cols[field] = j;
  }
  return cols;
}

const TOTAL_RE = /^(grand\s*|sub\s*-?\s*)?totals?\b/i;
const MONEY_FIELDS: readonly BaseField[] = ['invCr', 'cmvCr', 'glCr', 'invLk', 'mvLk', 'glLk', 'invR', 'mvR', 'glR'];

type RowClass = { kind: 'holding' } | { kind: 'skip'; reason: SkipReason; hasMoney: boolean };

function classifyRow(row: Cell[], cols: Columns, headerTexts: string[]): RowClass {
  const texts = row.map((c) => cellText(c));
  if (texts.every((t) => t === '')) return { kind: 'skip', reason: 'blank-row', hasMoney: false };
  const name = cols.name === undefined ? '' : (texts[cols.name] ?? '');
  const hasMoney = MONEY_FIELDS.some((f) => cols[f] !== undefined && readNumber(row[cols[f]!]).kind === 'number');
  if (name === '') {
    const total = row.some((c) => c !== null && c !== undefined && c.t === 's' && TOTAL_RE.test(cellText(c)));
    return { kind: 'skip', reason: total ? 'total-row' : 'no-instrument-name', hasMoney };
  }
  const sameAsHeader = (f: BaseField): boolean =>
    cols[f] === undefined || (texts[cols[f]!] ?? '').toLowerCase() === headerTexts[cols[f]!];
  if (sameAsHeader('name') && sameAsHeader('client')) return { kind: 'skip', reason: 'repeated-header', hasMoney: false };
  return { kind: 'holding' };
}

type SheetScan = {
  sheet: Sheet;
  headerIndex: number;
  headerTexts: string[];
  headerLabels: string[];
  cols: Columns;
  holdingRows: number[];
  skipped: Array<{ r: number; reason: SkipReason; hasMoney: boolean }>;
};

function scanSheet(sheet: Sheet, headerIndex: number): SheetScan {
  const headerRow = sheet.rows[headerIndex] ?? [];
  const headerLabels = headerRow.map((c) => cellText(c));
  const headerTexts = headerLabels.map((t) => t.toLowerCase());
  const cols = mapColumns(headerTexts);
  const holdingRows: number[] = [];
  const skipped: SheetScan['skipped'] = [];
  for (let r = headerIndex + 1; r < sheet.rows.length; r++) {
    const k = classifyRow(sheet.rows[r] ?? [], cols, headerTexts);
    if (k.kind === 'holding') holdingRows.push(r);
    else skipped.push({ r, reason: k.reason, hasMoney: k.hasMoney });
  }
  return { sheet, headerIndex, headerTexts, headerLabels, cols, holdingRows, skipped };
}

/** "Base File" first (exact name, as the legacy), then the other sheets in workbook order. */
function sheetOrder(sheets: Sheet[]): Sheet[] {
  const first = sheets.filter((s) => s.name === PREFERRED_SHEET);
  return first.concat(sheets.filter((s) => s.name !== PREFERRED_SHEET));
}

// ---------------------------------------------------------------------------------------------------------------
// Validation results

class Issues {
  readonly list: ValidationResult[] = [];
  private n = 0;

  add(ruleId: string, severity: Severity, scope: ValidationScope, message: string,
    extra: { decision?: string; count?: number; resolution?: ValidationResult['resolution'];
      status?: ValidationResult['status'] } = {}): void {
    this.n++;
    const r: ValidationResult = {
      id: `${ruleId}:${this.n}`,
      ruleId,
      scope,
      message,
      severity,
      blocksPublication: severity === 'Blocking',
      resolution: extra.resolution ?? 'none',
      status: extra.status ?? 'open',
    };
    if (extra.decision) r.decision = extra.decision;
    if (extra.count !== undefined) r.count = extra.count;
    this.list.push(r);
  }
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const quoteList = (items: string[], max = 10): string => {
  const shown = items.slice(0, max).map((s) => `"${s}"`).join(', ');
  return items.length > max ? `${shown} and ${items.length - max} more` : shown;
};

// ---------------------------------------------------------------------------------------------------------------
// Row reading

type RowRecord = {
  r: number;
  at: RowRef;
  clientLabel: string | null;
  name: string;
  categoryLabel: string | null;
  assetLabel: string | null;
  folio: string | null;
  amcLabel: string | null;
  productLabel: string | null;
  distributorLabel: string | null;
  liquidity: string | null;
  purchaseDate: Value<DayNumber>;
  units: Value<number>;
  invested: Value<number>;
  cmv: Value<number>;
  fileGain: Value<number>;
  holdingDays: Value<number>;
  xirr: Value<number>;
  bmXirr: Value<number>;
  holder2: string | null;
  holder3: string | null;
  guardian: string | null;
  modeText: string | null;
};

type InvalidTally = Map<string, number>;

function bump(t: InvalidTally, header: string): void {
  t.set(header, (t.get(header) ?? 0) + 1);
}

function textOrNull(row: Cell[], col: number | undefined): string | null {
  if (col === undefined) return null;
  const t = cellText(row[col]);
  return t === '' ? null : t;
}

function readPlainNumber(
  row: Cell[], col: number | undefined, header: string | undefined, unit: 'units' | 'days', what: string,
  prov: (m: string) => Provenance, invalid: InvalidTally,
): Value<number> {
  if (col === undefined || header === undefined) {
    return missing(STATUS.NOT_AVAILABLE, `the base file has no ${what} column`);
  }
  const n = readNumber(row[col]);
  return numberValue(n, header, unit, (v) => v, prov, invalid);
}

function numberValue(
  n: NumberRead, header: string, unit: 'units' | 'days' | 'cr', convert: (v: number) => number,
  prov: (m: string) => Provenance, invalid: InvalidTally,
): Value<number> {
  if (n.kind === 'number') return present(convert(n.v), unit, prov(`base-file "${header}"`));
  if (n.kind === 'empty') return missing(STATUS.NOT_AVAILABLE, `"${header}" is blank`, prov(`base-file "${header}"`));
  if (n.kind === 'placeholder') {
    return missing(STATUS.NOT_AVAILABLE, `"${header}" says "${n.text}"`, prov(`base-file "${header}"`));
  }
  bump(invalid, header);
  return missing(STATUS.INVALID_SOURCE, `"${header}" holds "${n.text}", which is not a number`, prov(`base-file "${header}"`));
}

/** Money in Crore, with the legacy precedence per row: the Cr. column, then Lakh, then rupees (pickCr). */
function readMoney(
  row: Cell[], cols: Columns, labels: string[], fields: readonly [BaseField, BaseField, BaseField], what: string,
  prov: (m: string) => Provenance, invalid: InvalidTally,
): Value<number> {
  const units: readonly MoneyUnit[] = ['crore', 'lakh', 'rupee'];
  let sawColumn = false;
  let firstInvalid: { header: string; text: string } | null = null;
  let placeholder: { header: string; text: string } | null = null;
  for (let i = 0; i < 3; i++) {
    const col = cols[fields[i]!];
    if (col === undefined) continue;
    sawColumn = true;
    const header = labels[col] ?? '';
    const n = readNumber(row[col]);
    if (n.kind === 'number') {
      if (n.percentText) {
        bump(invalid, header);
        firstInvalid ??= { header, text: `${n.v}%` };
        continue;
      }
      return present(toCrore(n.v, units[i]!), 'cr', prov(`base-file "${header}"`));
    }
    if (n.kind === 'invalid') { bump(invalid, header); firstInvalid ??= { header, text: n.text }; }
    if (n.kind === 'placeholder') placeholder ??= { header, text: n.text };
  }
  if (!sawColumn) return missing(STATUS.NOT_AVAILABLE, `the base file has no ${what} column`);
  if (firstInvalid) {
    return missing(STATUS.INVALID_SOURCE, `"${firstInvalid.header}" holds "${firstInvalid.text}", which is not an amount`,
      prov(`base-file "${firstInvalid.header}"`));
  }
  if (placeholder) {
    return missing(STATUS.NOT_AVAILABLE, `"${placeholder.header}" says "${placeholder.text}"`, prov(`base-file "${placeholder.header}"`));
  }
  return missing(STATUS.NOT_AVAILABLE, `the ${what} is blank`, prov('base-file'));
}

// ---------------------------------------------------------------------------------------------------------------
// XIRR units (OD-3)

type XirrPlan = {
  field: 'xirr' | 'bmXirr';
  header: string;
  /** How unformatted numbers are read; 'pending' while the analyst's answer is awaited. */
  plain: 'percent' | 'fraction' | 'pending' | 'none';
  answered: boolean;
  formatted: number;
  percentText: number;
  plainCount: number;
  plainMaxAbs: number;
};

function planXirr(
  rows: Cell[][], recordRows: number[], col: number | undefined, header: string | undefined,
  field: 'xirr' | 'bmXirr', answer: XirrUnitChoice | undefined,
): XirrPlan | null {
  if (col === undefined || header === undefined) return null;
  let formatted = 0;
  let percentText = 0;
  let plainCount = 0;
  let plainMaxAbs = 0;
  for (const r of recordRows) {
    const n = readNumber((rows[r] ?? [])[col]);
    if (n.kind !== 'number') continue;
    if (n.percentFormat) formatted++;
    else if (n.percentText) percentText++;
    else { plainCount++; plainMaxAbs = Math.max(plainMaxAbs, Math.abs(n.v)); }
  }
  let plain: XirrPlan['plain'] = 'none';
  let answered = false;
  if (plainCount > 0) {
    if (plainMaxAbs >= XIRR_FRACTION_LIMIT || plainMaxAbs === 0) plain = 'percent';
    else if (answer) { plain = answer; answered = true; }
    else plain = 'pending';
  }
  return { field, header, plain, answered, formatted, percentText, plainCount, plainMaxAbs };
}

function readXirr(
  row: Cell[], col: number | undefined, plan: XirrPlan | null, prov: (m: string) => Provenance,
  invalid: InvalidTally,
): Value<number> {
  if (col === undefined || plan === null) return missing(STATUS.NOT_AVAILABLE, 'the base file has no XIRR column');
  const h = plan.header;
  const n = readNumber(row[col]);
  if (n.kind === 'empty') return missing(STATUS.NOT_AVAILABLE, `"${h}" is blank`, prov(`base-file "${h}"`));
  if (n.kind === 'placeholder') return missing(STATUS.NOT_AVAILABLE, `"${h}" says "${n.text}"`, prov(`base-file "${h}"`));
  if (n.kind === 'invalid') {
    bump(invalid, h);
    return missing(STATUS.INVALID_SOURCE, `"${h}" holds "${n.text}", which is not a number`, prov(`base-file "${h}"`));
  }
  if (n.percentFormat) return present(fractionToPct(n.v), 'pct', prov(`base-file "${h}": percent-formatted cell (OD-3)`));
  if (n.percentText) return present(n.v, 'pct', prov(`base-file "${h}": text with a percent sign`));
  if (plan.plain === 'percent') return present(n.v, 'pct', prov(`base-file "${h}": percent number`));
  if (plan.plain === 'fraction') {
    return present(fractionToPct(n.v), 'pct', prov(`base-file "${h}": fraction, as the analyst chose (OD-3)`));
  }
  return missing(STATUS.INSUFFICIENT_EVIDENCE,
    `the unit of "${h}" is not confirmed: the analyst is asked whether it holds percent numbers or fractions (OD-3)`,
    prov(`base-file "${h}"`));
}

// ---------------------------------------------------------------------------------------------------------------
// Merging duplicate folios (E-02)

type Group = { key: string; members: RowRecord[] };

/** Sum of a field over every member, or missing when any member lacks it (KI-007, KI-113: never a partial sum). */
function sumAll(members: RowRecord[], pick: (m: RowRecord) => Value<number>, unit: 'cr' | 'units', what: string,
  decision: string, prov: Provenance): Value<number> {
  const vals = members.map(pick);
  const gap = vals.find((v) => v.kind === 'missing');
  if (gap && gap.kind === 'missing') {
    return missing(gap.status, `a merged folio has no ${what} (${decision}): ${gap.reason}`, prov);
  }
  let s = 0;
  for (const v of vals) if (v.kind === 'value') s = s + v.v;
  return present(s, unit, { ...prov, method: `sum of ${members.length} merged folios` });
}

/**
 * The legacy CMV-weighted XIRR of merged folios: weights over members that have the value and a non-zero market
 * value; when no member qualifies, the first member's value. Coverage records the market value without one.
 */
function mergedXirr(members: RowRecord[], pick: (m: RowRecord) => Value<number>, total: number,
  prov: Provenance): Value<number> {
  let w = 0;
  let c = 0;
  for (const m of members) {
    const x = pick(m);
    if (x.kind === 'value' && m.cmv.kind === 'value' && m.cmv.v !== 0) { w += x.v * m.cmv.v; c += m.cmv.v; }
  }
  if (!(c > 0)) return pick(members[0]!);
  const coverage = total > 0 ? c / total : 1;
  const extra = coverage < 1 - 1e-12 && coverage >= 0 ? { coverage } : undefined;
  return present(w / c, 'pct', { ...prov, method: `market-value-weighted over ${members.length} merged folios` }, extra);
}

// ---------------------------------------------------------------------------------------------------------------

const EMPTY_COUNTS = (): Record<SkipReason, number> =>
  ({ 'blank-row': 0, 'repeated-header': 0, 'total-row': 0, 'no-instrument-name': 0 });

export function parseBaseFile(wb: Workbook, opts: BaseFileOptions): BaseFileImport {
  const now = opts.now ?? ((): string => new Date().toISOString());
  const sourceId = opts.sourceId;
  const issues = new Issues();
  const fileScope: ValidationScope = { kind: 'file', sourceId };
  const attempts: SheetAttempt[] = [];

  // 1. Pick the sheet (KI-074).
  let chosen: SheetScan | null = null;
  let fallback: SheetScan | null = null;
  for (const sheet of sheetOrder(wb.sheets)) {
    if (chosen) { attempts.push({ sheet: sheet.name, outcome: 'not-needed', headerRow: null }); continue; }
    const hi = findHeaderRow(sheet, isHeaderRow, HEADER_SCAN_ROWS);
    if (hi < 0) { attempts.push({ sheet: sheet.name, outcome: 'no-header', headerRow: null }); continue; }
    const scan = scanSheet(sheet, hi);
    if (scan.holdingRows.length > 0) {
      chosen = scan;
      attempts.push({ sheet: sheet.name, outcome: 'used', headerRow: hi + 1 });
    } else {
      attempts.push({ sheet: sheet.name, outcome: 'no-rows', headerRow: hi + 1 });
      fallback ??= scan;
    }
  }
  const scan = chosen ?? fallback;
  const empty = (): BaseFileImport => ({
    parserVersion: BASE_FILE_PARSER_VERSION, sourceId, sheet: null, sheets: attempts, columns: [], moneyUnit: null,
    holdings: [], clients: [], distributors: [], accounts: [], folios: [], ownership: [], skipped: [],
    questions: [], issues: issues.list, audit: [],
    counts: { dataRows: 0, holdingRows: 0, holdings: 0, included: 0, excluded: 0, mergedRows: 0, skipped: EMPTY_COUNTS() },
  });
  if (!scan) {
    issues.add('base-file.no-header', 'Blocking', fileScope,
      `No sheet has a header row with a Client column and an Instrument column in its first ${HEADER_SCAN_ROWS} rows, so no holding could be read.`,
      { decision: 'KI-074' });
    const out = empty();
    out.audit.push(importAudit(now, sourceId, out));
    return out;
  }

  const { sheet, cols, headerLabels, headerTexts } = scan;
  const sheetName = sheet.name;
  const at = (r: number): RowRef => ({ sourceId, sheet: sheetName, row: r + 1 });
  const prov = (method: string): Provenance => ({ sources: [sourceId], method });
  const header = (f: BaseField): string | undefined => (cols[f] === undefined ? undefined : headerLabels[cols[f]!]);
  const columns: ColumnUse[] = (Object.keys(cols) as BaseField[])
    .map((field) => ({ field, header: headerLabels[cols[field]!] ?? '', column: cols[field]! }))
    .sort((a, b) => a.column - b.column);

  if (!chosen) {
    issues.add('base-file.no-holdings', 'Blocking', { kind: 'sheet', sourceId, sheet: sheetName },
      `The sheet "${sheetName}" has a header row but no holding rows.`, { decision: 'KI-074' });
  }
  if (sheetName !== PREFERRED_SHEET || scan.headerIndex !== 0) {
    issues.add('base-file.sheet-used', 'Information', { kind: 'sheet', sourceId, sheet: sheetName },
      `Holdings were read from the sheet "${sheetName}", with its header in row ${scan.headerIndex + 1}.`,
      { decision: 'KI-074', resolution: 'auto-resolved', status: 'resolved' });
  }
  const hasMvColumn = cols.cmvCr !== undefined || cols.mvLk !== undefined || cols.mvR !== undefined;
  if (!hasMvColumn) {
    issues.add('base-file.no-market-value-column', 'Blocking', { kind: 'sheet', sourceId, sheet: sheetName },
      'The sheet has no market value column (in Crore, Lakh or rupees), so no holding can be valued.',
      { decision: 'OD-8' });
  }
  const moneyUnit: MoneyUnit | null =
    (cols.invCr !== undefined || cols.cmvCr !== undefined || cols.glCr !== undefined) ? 'crore'
      : (cols.invLk !== undefined || cols.mvLk !== undefined || cols.glLk !== undefined) ? 'lakh'
        : (cols.invR !== undefined || cols.mvR !== undefined || cols.glR !== undefined) ? 'rupee' : null;

  // 2. XIRR units for the whole column (OD-3), from every holding row.
  const answers = opts.answers ?? {};
  const xPlan = planXirr(sheet.rows, scan.holdingRows, cols.xirr, header('xirr'), 'xirr', answers.xirr);
  const bPlan = planXirr(sheet.rows, scan.holdingRows, cols.bmxirr, header('bmxirr'), 'bmXirr', answers.bmXirr);
  const questions: AnalystQuestion[] = [];
  const audit: AuditEntry[] = [];
  for (const plan of [xPlan, bPlan]) {
    if (!plan) continue;
    const colScope: ValidationScope = { kind: 'column', sourceId, sheet: sheetName, column: plan.header };
    if (plan.plain === 'pending') {
      questions.push({
        id: `xirr-unit:${plan.field}`, kind: 'xirr-unit', field: plan.field, sheet: sheetName, column: plan.header,
        options: ['percent', 'fraction'],
        prompt: `The column "${plan.header}" has no percent formatting and every value in it is below ${XIRR_FRACTION_LIMIT} in size. Does it hold percent numbers (8.79 meaning 8.79%) or fractions (0.0879 meaning 8.79%)?`,
        evidence: { values: plan.plainCount, maxAbs: plan.plainMaxAbs }, decision: 'OD-3',
      });
      issues.add('base-file.xirr-unit-question', 'High', colScope,
        `The column "${plan.header}" could hold percent numbers or fractions. Choose how to read it; until then its values are not used.`,
        { decision: 'OD-3', resolution: 'analyst-decision', count: plan.plainCount });
    } else if (plan.answered) {
      issues.add('base-file.xirr-unit-answered', 'Information', colScope,
        `The column "${plan.header}" is read as ${plan.plain === 'fraction' ? 'fractions' : 'percent numbers'}, as the analyst chose.`,
        { decision: 'OD-3', resolution: 'analyst-decision', status: 'resolved', count: plan.plainCount });
      audit.push({
        id: `audit:${audit.length + 1}`, at: now(), kind: 'validation-decision', sourceId,
        summary: `The analyst set the unit of an XIRR column (OD-3).`,
        detail: { column: plan.header, field: plan.field, unit: plan.plain, values: plan.plainCount },
      });
    }
    if (plan.formatted > 0) {
      issues.add('base-file.xirr-percent-format', 'Information', colScope,
        `${plural(plan.formatted, 'cell', 'cells')} of "${plan.header}" ${plan.formatted === 1 ? 'is' : 'are'} formatted as percentages and read as such.`,
        { decision: 'OD-3', resolution: 'auto-resolved', status: 'resolved', count: plan.formatted });
    }
  }

  // 3. Read every holding row.
  const invalid: InvalidTally = new Map();
  const records: RowRecord[] = scan.holdingRows.map((r) => {
    const row = sheet.rows[r] ?? [];
    const pdCol = cols.pdate;
    const pdHeader = header('pdate');
    let purchaseDate: Value<DayNumber>;
    if (pdCol === undefined || pdHeader === undefined) {
      purchaseDate = missing(STATUS.NOT_AVAILABLE, 'the base file has no Purchase Date column');
    } else {
      const d = readDate(row[pdCol], wb.date1904);
      if (d.kind === 'date') purchaseDate = present(d.day, 'date', prov(`base-file "${pdHeader}"`));
      else if (d.kind === 'invalid') {
        bump(invalid, pdHeader);
        purchaseDate = missing(STATUS.INVALID_SOURCE, `"${pdHeader}" holds "${d.text}", which is not a date`, prov(`base-file "${pdHeader}"`));
      } else {
        purchaseDate = missing(STATUS.NOT_AVAILABLE,
          d.kind === 'empty' ? `"${pdHeader}" is blank` : `"${pdHeader}" says "${d.text}"`, prov(`base-file "${pdHeader}"`));
      }
    }
    return {
      r,
      at: at(r),
      clientLabel: textOrNull(row, cols.client),
      name: cellText(row[cols.name!]),
      categoryLabel: textOrNull(row, cols.cat),
      assetLabel: textOrNull(row, cols.asset),
      folio: textOrNull(row, cols.folio),
      amcLabel: textOrNull(row, cols.amc),
      productLabel: textOrNull(row, cols.product),
      distributorLabel: textOrNull(row, cols.dist),
      liquidity: textOrNull(row, cols.liq),
      purchaseDate,
      units: readPlainNumber(row, cols.units, header('units'), 'units', 'Units', prov, invalid),
      invested: readMoney(row, cols, headerLabels, ['invCr', 'invLk', 'invR'], 'invested value', prov, invalid),
      cmv: readMoney(row, cols, headerLabels, ['cmvCr', 'mvLk', 'mvR'], 'market value', prov, invalid),
      fileGain: readMoney(row, cols, headerLabels, ['glCr', 'glLk', 'glR'], 'gain or loss', prov, invalid),
      holdingDays: readPlainNumber(row, cols.days, header('days'), 'days', 'holding days', prov, invalid),
      xirr: readXirr(row, cols.xirr, xPlan, prov, invalid),
      bmXirr: readXirr(row, cols.bmxirr, bPlan, prov, invalid),
      holder2: textOrNull(row, cols.holder2),
      holder3: textOrNull(row, cols.holder3),
      guardian: textOrNull(row, cols.guardian),
      modeText: textOrNull(row, cols.mode),
    };
  });

  // 4. Clients, distributors, accounts, folios and ownership (architecture §6.8).
  const clientId = idFactory<'client'>('cl');
  const distId = idFactory<'distributor'>('ds');
  const accountId = idFactory<'account'>('ac');
  const folioId = idFactory<'folio'>('fo');
  const holdingId = idFactory<'holding'>('h');
  const clients = new Map<ClientId, Client>();
  const distributors = new Map<DistributorId, Distributor>();
  const accounts = new Map<AccountId, Account>();
  const folios = new Map<FolioId, Folio>();
  const ownership = new Map<FolioId, Ownership>();
  const clientOf = (label: string | null): ClientId | null => {
    if (label === null) return null;
    const id = clientId(normaliseLabel(label));
    if (!clients.has(id)) clients.set(id, { id, label, displayLabel: null });
    return id;
  };
  const distOf = (label: string | null): DistributorId | null => {
    if (label === null) return null;
    const id = distId(normaliseLabel(label));
    if (!distributors.has(id)) distributors.set(id, { id, label });
    return id;
  };
  const holderColumns = cols.holder2 !== undefined || cols.holder3 !== undefined || cols.guardian !== undefined
    || cols.mode !== undefined;
  let holderConflicts = 0;
  const badModes: string[] = [];
  const rowIds = new Map<number, { clientId: ClientId | null; distributorId: DistributorId | null; accountId: AccountId; folioId: FolioId }>();
  for (const rec of records) {
    const cId = clientOf(rec.clientLabel);
    const dId = distOf(rec.distributorLabel);
    const aId = accountId(keyOf([cId, dId]));
    if (!accounts.has(aId)) accounts.set(aId, { id: aId, clientId: cId, distributorId: dId, plan: null });
    const fKey = rec.folio === null
      ? keyOf([aId, normaliseLabel(rec.amcLabel), `#row ${rec.at.row}`])
      : keyOf([aId, normaliseLabel(rec.amcLabel), rec.folio]);
    const fId = folioId(fKey);
    if (!folios.has(fId)) folios.set(fId, { id: fId, number: rec.folio, amcLabel: rec.amcLabel, accountId: aId });
    rowIds.set(rec.r, { clientId: cId, distributorId: dId, accountId: aId, folioId: fId });
    if (cId === null) continue;
    const oProv = prov('base-file');
    let o: Ownership;
    if (!holderColumns) o = defaultOwnership(fId, cId, oProv);
    else {
      const joint: Array<{ role: 'second' | 'third' | 'guardian'; clientId: ClientId }> = [];
      for (const [role, label] of [['second', rec.holder2], ['third', rec.holder3], ['guardian', rec.guardian]] as const) {
        const id = clientOf(label);
        if (id !== null) joint.push({ role, clientId: id });
      }
      let mode: Parameters<typeof ownershipFromColumns>[3] = { kind: 'blank' };
      if (rec.modeText !== null) {
        const m: HoldingMode | null = parseHoldingMode(rec.modeText);
        if (m) mode = { kind: 'read', value: m };
        else { mode = { kind: 'unrecognised', text: rec.modeText }; badModes.push(rec.modeText); }
      }
      o = ownershipFromColumns(fId, cId, joint, mode, oProv);
    }
    const prior = ownership.get(fId);
    if (!prior) ownership.set(fId, o);
    else if (JSON.stringify(prior.jointHolders) !== JSON.stringify(o.jointHolders)
      || JSON.stringify(prior.mode) !== JSON.stringify(o.mode)) holderConflicts++;
  }

  // 5. Holdings: OD-8 exclusion, then the legacy merge of duplicate folios among the included rows.
  const assetOf = (label: string | null): { assetClass: AssetClass | null; how: string } => readAssetLabel(label);
  const included: RowRecord[] = [];
  const excludedRecs: RowRecord[] = [];
  for (const rec of records) (rec.cmv.kind === 'value' ? included : excludedRecs).push(rec);
  const groups = new Map<string, Group>();
  const groupOrder: Group[] = [];
  for (const rec of included) {
    const product = rec.productLabel ?? DEFAULT_PRODUCT;
    const key = [rec.clientLabel ?? '', rec.name, product, rec.distributorLabel ?? ''].join('\u0000');
    let g = groups.get(key);
    if (!g) { g = { key, members: [] }; groups.set(key, g); groupOrder.push(g); }
    g.members.push(rec);
  }
  const holdingFrom = (members: RowRecord[], id: HoldingId, inclusion: Holding['inclusion']): Holding => {
    const first = members[0]!;
    const ids = rowIds.get(first.r)!;
    const merged = members.length > 1;
    const mProv = prov('base-file');
    const cmv = merged ? sumAll(members, (m) => m.cmv, 'cr', 'market value', 'E-02', mProv) : first.cmv;
    const total = cmv.kind === 'value' ? cmv.v : 0;
    const asset = assetOf(first.assetLabel);
    const folioNumbers = members.map((m) => m.folio).filter((f): f is string => f !== null);
    const folioIds: FolioId[] = [];
    for (const m of members) { const f = rowIds.get(m.r)!.folioId; if (!folioIds.includes(f)) folioIds.push(f); }
    return {
      id,
      sourceId,
      rows: members.map((m) => m.at),
      instrumentName: first.name,
      instrument: null,
      clientLabel: first.clientLabel,
      clientId: ids.clientId,
      distributorLabel: first.distributorLabel,
      distributorId: ids.distributorId,
      accountId: ids.accountId,
      productLabel: first.productLabel,
      product: first.productLabel ?? DEFAULT_PRODUCT,
      productDefaulted: first.productLabel === null,
      categoryLabel: first.categoryLabel,
      assetLabel: first.assetLabel,
      assetClass: asset.assetClass,
      amcLabel: first.amcLabel,
      liquidity: first.liquidity,
      folios: folioNumbers,
      folioIds,
      purchaseDate: first.purchaseDate,
      units: merged ? sumAll(members, (m) => m.units, 'units', 'units', 'KI-113', mProv) : first.units,
      invested: merged ? sumAll(members, (m) => m.invested, 'cr', 'invested value', 'KI-007', mProv) : first.invested,
      cmv,
      fileGain: merged ? sumAll(members, (m) => m.fileGain, 'cr', 'gain or loss', 'KI-113', mProv) : first.fileGain,
      xirr: merged ? mergedXirr(members, (m) => m.xirr, total, mProv) : first.xirr,
      bmXirr: merged ? mergedXirr(members, (m) => m.bmXirr, total, mProv) : first.bmXirr,
      holdingDays: first.holdingDays,
      inclusion,
    };
  };
  const built: Array<{ firstRow: number; h: Holding }> = [];
  for (const g of groupOrder) {
    built.push({ firstRow: g.members[0]!.r, h: holdingFrom(g.members, holdingId(keyOf(['in', g.key])), { status: 'included' }) });
  }
  for (const rec of excludedRecs) {
    built.push({
      firstRow: rec.r,
      h: holdingFrom([rec], holdingId(keyOf(['ex', sheetName, String(rec.at.row)])),
        { status: 'excluded', reasons: ['no-market-value'] }),
    });
  }
  built.sort((a, b) => a.firstRow - b.firstRow);
  const holdings = built.map((b) => b.h);

  // 6. Notices.
  const excluded = holdings.filter((h) => h.inclusion.status === 'excluded');
  const includedHoldings = holdings.filter((h) => h.inclusion.status === 'included');
  if (excluded.length) {
    issues.add('base-file.no-market-value', 'Warning', { kind: 'holdings', holdingIds: excluded.map((h) => h.id) },
      `${plural(excluded.length, 'holding has', 'holdings have')} no market value and ${excluded.length === 1 ? 'is' : 'are'} excluded from every total: ${quoteList(excluded.map((h) => h.instrumentName))}.`,
      { decision: 'OD-8', count: excluded.length });
  }
  const blankAsset = holdings.filter((h) => h.assetLabel === null);
  if (blankAsset.length) {
    issues.add('base-file.blank-asset', 'Warning', { kind: 'holdings', holdingIds: blankAsset.map((h) => h.id) },
      `${plural(blankAsset.length, 'holding has', 'holdings have')} no Asset Name: the asset class is unknown, not Equity.`,
      { decision: 'OD-7', count: blankAsset.length });
  }
  const unknownAsset = holdings.filter((h) => h.assetLabel !== null && h.assetClass === null);
  if (unknownAsset.length) {
    const labels = [...new Set(unknownAsset.map((h) => h.assetLabel!))];
    issues.add('base-file.unrecognised-asset', 'Warning', { kind: 'holdings', holdingIds: unknownAsset.map((h) => h.id) },
      `${plural(unknownAsset.length, 'holding has', 'holdings have')} an Asset Name the reader does not recognise (${quoteList(labels)}): the asset class is unknown.`,
      { decision: 'OD-7', count: unknownAsset.length });
  }
  const synonyms = holdings.filter((h) => readAssetLabel(h.assetLabel).how === 'synonym');
  if (synonyms.length) {
    issues.add('base-file.asset-synonym', 'Information', { kind: 'holdings', holdingIds: synonyms.map((h) => h.id) },
      `${plural(synonyms.length, 'holding is', 'holdings are')} labelled "Fixed Income" or "Debt Funds" and read as Debt.`,
      { decision: 'OD-7', count: synonyms.length, resolution: 'auto-resolved', status: 'resolved' });
  }
  const defaulted = holdings.filter((h) => h.productDefaulted);
  if (defaulted.length) {
    issues.add('base-file.product-defaulted', 'Information', { kind: 'holdings', holdingIds: defaulted.map((h) => h.id) },
      `${plural(defaulted.length, 'holding has', 'holdings have')} no Product Name and ${defaulted.length === 1 ? 'is' : 'are'} read as ${DEFAULT_PRODUCT}, as in the legacy page.`,
      { count: defaulted.length, resolution: 'auto-resolved', status: 'resolved' });
  }
  const blankClient = holdings.filter((h) => h.clientLabel === null);
  if (blankClient.length) {
    issues.add('base-file.blank-client', 'Warning', { kind: 'holdings', holdingIds: blankClient.map((h) => h.id) },
      `${plural(blankClient.length, 'holding has', 'holdings have')} no Client Name.`, { count: blankClient.length });
  }
  const totalLike = holdings.filter((h) => TOTAL_RE.test(h.instrumentName));
  if (totalLike.length) {
    issues.add('base-file.total-like-name', 'Warning', { kind: 'holdings', holdingIds: totalLike.map((h) => h.id) },
      `${plural(totalLike.length, 'holding is', 'holdings are')} named like a total row (${quoteList(totalLike.map((h) => h.instrumentName))}). Check that the file has no total rows among the holdings.`,
      { count: totalLike.length });
  }
  const mergedRows = included.length - groupOrder.length;
  if (mergedRows > 0) {
    const mergedHoldings = includedHoldings.filter((h) => h.rows.length > 1);
    issues.add('base-file.merged-folios', 'Information', { kind: 'holdings', holdingIds: mergedHoldings.map((h) => h.id) },
      `${plural(mergedHoldings.length, 'holding was', 'holdings were')} merged from ${included.length - groupOrder.length + mergedHoldings.length} rows with the same client, instrument, product and distributor.`,
      { decision: 'E-02', count: mergedHoldings.length, resolution: 'auto-resolved', status: 'resolved' });
    const partial = mergedHoldings.filter((h) => [h.invested, h.fileGain, h.units].some((v) => v.kind === 'missing'
      && /a merged folio has no/.test(v.reason)));
    if (partial.length) {
      issues.add('base-file.merge-incomplete', 'Information', { kind: 'holdings', holdingIds: partial.map((h) => h.id) },
        `${plural(partial.length, 'merged holding has', 'merged holdings have')} a folio without an invested value, gain or units: that total is left blank rather than partial.`,
        { decision: 'KI-113', count: partial.length, resolution: 'auto-resolved', status: 'resolved' });
    }
  }
  if (invalid.size) {
    const parts = [...invalid.entries()].map(([h, n]) => `"${h}" (${n})`);
    const n = [...invalid.values()].reduce((a, b) => a + b, 0);
    issues.add('base-file.invalid-cells', 'Warning', { kind: 'sheet', sourceId, sheet: sheetName },
      `${plural(n, 'cell', 'cells')} could not be read as a number or a date and ${n === 1 ? 'is' : 'are'} treated as invalid source data: ${parts.join(', ')}.`,
      { count: n });
  }
  if (holderConflicts) {
    issues.add('base-file.holders-conflict', 'Warning', { kind: 'sheet', sourceId, sheet: sheetName },
      `${plural(holderConflicts, 'row gives', 'rows give')} different holders for a folio already read; the first row's holders are kept.`,
      { count: holderConflicts });
  }
  if (badModes.length) {
    issues.add('base-file.mode-unrecognised', 'Warning', { kind: 'sheet', sourceId, sheet: sheetName },
      `${plural(badModes.length, 'row has', 'rows have')} a mode of holding the reader does not recognise (${quoteList([...new Set(badModes)])}).`,
      { count: badModes.length });
  }

  // 7. Skipped rows (never dropped silently).
  const skipped: SkippedRow[] = scan.skipped.map((s) => {
    const first = (sheet.rows[s.r] ?? []).map((c) => cellText(c)).find((t) => t !== '') ?? null;
    return { at: at(s.r), reason: s.reason, label: first === null ? null : first.slice(0, 60), hasMoney: s.hasMoney };
  });
  const skipCounts = EMPTY_COUNTS();
  for (const s of skipped) skipCounts[s.reason]++;
  const skipText: Record<SkipReason, [string, string]> = {
    'blank-row': ['blank row was', 'blank rows were'],
    'repeated-header': ['repeated header row was', 'repeated header rows were'],
    'total-row': ['total row was', 'total rows were'],
    'no-instrument-name': ['row without an Instrument Name was', 'rows without an Instrument Name were'],
  };
  for (const reason of Object.keys(skipCounts) as SkipReason[]) {
    const n = skipCounts[reason];
    if (!n) continue;
    const rows = skipped.filter((s) => s.reason === reason);
    const withMoney = rows.filter((s) => s.hasMoney).length;
    const lost = reason === 'no-instrument-name' && withMoney > 0;
    issues.add(`base-file.skipped-${reason}`, lost ? 'Warning' : 'Information',
      { kind: 'rows', sourceId, rows: rows.map((s) => s.at) },
      `${plural(n, skipText[reason][0], skipText[reason][1])} skipped${!lost ? '' : n === 1
        ? '; it carries an amount, so check that no holding is missing its name'
        : `; ${withMoney} of them carry an amount, so check that no holding is missing its name`}.`,
      { decision: 'KI-074', count: n });
  }

  const counts: BaseFileCounts = {
    dataRows: Math.max(0, sheet.rows.length - scan.headerIndex - 1),
    holdingRows: records.length,
    holdings: holdings.length,
    included: includedHoldings.length,
    excluded: excluded.length,
    mergedRows,
    skipped: skipCounts,
  };
  const out: BaseFileImport = {
    parserVersion: BASE_FILE_PARSER_VERSION,
    sourceId,
    sheet: { name: sheetName, headerRow: scan.headerIndex + 1 },
    sheets: attempts,
    columns,
    moneyUnit,
    holdings,
    clients: [...clients.values()],
    distributors: [...distributors.values()],
    accounts: [...accounts.values()],
    folios: [...folios.values()],
    ownership: [...ownership.values()],
    skipped,
    questions,
    issues: issues.list,
    audit,
    counts,
  };
  out.audit.unshift(importAudit(now, sourceId, out));
  out.audit.forEach((a, i) => { a.id = `audit:${i + 1}`; });
  return out;
}

/** The import entry: counts and decisions only, never names, folios or amounts. */
function importAudit(now: () => string, sourceId: SourceFileId, imp: BaseFileImport): AuditEntry {
  const c = imp.counts;
  return {
    id: 'audit:1',
    at: now(),
    kind: 'import',
    sourceId,
    summary: imp.sheet
      ? `Base file read: ${c.holdings} holdings (${c.excluded} excluded), ${c.mergedRows} rows merged, ${c.skipped['blank-row'] + c.skipped['repeated-header'] + c.skipped['total-row'] + c.skipped['no-instrument-name']} rows skipped.`
      : 'Base file not read: no sheet has a header row.',
    detail: {
      parser: BASE_FILE_PARSER_VERSION,
      headerRow: imp.sheet ? imp.sheet.headerRow : null,
      sheetsTried: imp.sheets.length,
      holdingRows: c.holdingRows,
      holdings: c.holdings,
      included: c.included,
      excluded: c.excluded,
      mergedRows: c.mergedRows,
      skippedBlank: c.skipped['blank-row'],
      skippedRepeatedHeader: c.skipped['repeated-header'],
      skippedTotal: c.skipped['total-row'],
      skippedNoName: c.skipped['no-instrument-name'],
      questions: imp.questions.length,
      blocking: imp.issues.filter((i) => i.severity === 'Blocking').length,
    },
  };
}
