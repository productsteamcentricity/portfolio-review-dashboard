// IRR / transactions file reader (milestone M3a, NB-M3a; parity row E-05, E-142; interface I-04; contract I-32
// model/transactions.ts; OD-16; KI-075, KI-186, KI-211). A port of the legacy parseIRR (index.html, 09_parsers.js:365)
// with the accepted decisions applied:
//   - sheets: the legacy name test ("BMXIRR", "BM XIRR" or "BMX" in the name: benchmark; else "XIRR": fund), a
//     since-inception sheet ("SI Xirr", "SI Bmxirr" of the platform's six-sheet cashflow file) preferred over YTD and
//     QTD sheets, else the last sheet that matches, as in the legacy; then the legacy content test (a header with a benchmark-amount
//     column: benchmark; with an amount column: fund); the header in the first 20 rows with a client, an amount and a
//     date column (the I-04 aliases, matched on the upper-cased header and on the header with its parenthesised unit
//     and currency signs removed, as the legacy hmap does);
//   - the sheet-pairing guard (MOD-04): a fund and a benchmark sheet whose names start with different periods (SI, YTD,
//     QTD, MTD, FYTD; sheetPeriodOf) are never paired; the benchmark sheet of the fund sheet's period is taken, else
//     none, with a Warning naming the benchmark sheets seen;
//   - the since-inception rule (Gate B of d6401f6, F6; MOD-05): a fund sheet of another period (no SI sheet in the
//     file) is refused with the Blocking result 'no-si-sheet'; period-less legacy names stay accepted;
//   - hand-filled files (F7; MOD-05): contrary signs, and a missing or duplicate Closing row per instrument, are Warnings;
//   - columns: the I-04 alias groups unchanged, plus the DISTRIBUTOR column (E-142; the legacy parser ignores it);
//   - dates: THE FREE-TEXT DATE RULE of model/transactions.ts (KI-186): a serial by excelSerialToDay (its whole day,
//     KI-211: never the next day from noon), text by parseDayText (the date as written; a zone never moves it); any
//     other text and a date that does not exist skip the row as 'unreadable-date' (the legacy read other text through
//     `Date` as the machine-local day, and rolled 31-02 into March);
//   - amounts: a number, or numeric text (thousands commas, a leading rupee sign, "(1,000)" as a negative); other text
//     skips the row as 'invalid-amount' (the legacy parseFloat read "12abc" as 12, KI-075);
//   - every skipped row is counted by reason and listed (KI-075), never dropped silently;
//   - transaction types widened to the known types (OD-16); an unrecognised type is counted and named, never guessed;
//     a row whose row type says "closing" is a valuation row, as in the legacy taxation (07_engine.js:377).
// Money stays in rupees with the file's sign (I-32). Client data: on screen and in the workbook only; messages carry
// counts and column names only. Pure function: no globals, no network, no clock unless injected.

import type { Cell, Sheet, Workbook } from './workbook.ts';
import type { DayNumber, Value } from '../model/value.ts';
import type { ClientId, DistributorId, SourceFileId } from '../model/ids.ts';
import type { RowRef, SheetAttempt } from '../model/source.ts';
import type { Severity, ValidationResult, ValidationScope } from '../model/validation.ts';
import type { AuditEntry } from '../model/audit.ts';
import type {
  FlowSide, IrrColumnUse, IrrField, IrrFileCounts, IrrFileImport, IrrSheetRead, IrrSkippedRow, IrrSkipReason,
  Transaction, TransactionDirection, TransactionKind,
} from '../model/transactions.ts';
import { STATUS } from '../model/status.ts';
import { cellText } from './workbook.ts';
import { readNumber } from './cells.ts';
import { excelSerialToDay, parseDayText } from '../engine/dates.ts';
import { idFactory, normaliseLabel } from '../engine/ids.ts';
import { missing, present } from '../engine/value.ts';

export const IRR_PARSER_VERSION = 'irr-file@1';
/** Rows searched for the header on each sheet (the legacy headerRow: the first 20). */
export const IRR_HEADER_SCAN_ROWS = 20;

// ---------------------------------------------------------------------------------------------------------------
// Columns: the I-04 alias groups of parseIRR (09_parsers.js:374-392), unchanged, plus DISTRIBUTOR (E-142).

export const IRR_ALIASES: Readonly<Record<IrrField | 'benchAmount', readonly string[]>> = {
  client: ['CLIENT', 'CLIENT NAME', 'CLIENTNAME', 'CLIENT_NAME', 'INVESTOR', 'INVESTOR NAME', 'HOLDER', 'HOLDER NAME'],
  amount: ['AMOUNT', 'AMT', 'CASHFLOW', 'CASH FLOW', 'NET AMOUNT', 'FUND AMOUNT', 'INVESTED AMOUNT', 'FLOW'],
  benchAmount: ['BM_AMOUNT', 'BM AMOUNT', 'BMAMOUNT', 'BENCHMARK AMOUNT', 'BM_AMT', 'BM AMT', 'INDEX AMOUNT', 'BENCHMARK CASHFLOW'],
  date: ['TRXN_DATE', 'TRXN DATE', 'TXN_DATE', 'TXN DATE', 'TRANSACTION DATE', 'TRANSACTIONDATE', 'TRADE DATE', 'DATE', 'NAV DATE', 'TRAN DATE'],
  instrument: ['INSTRUMENT', 'INSTRUMENT NAME', 'SCHEME', 'SCHEME NAME', 'SECURITY', 'SECURITY NAME', 'FUND', 'FUND NAME'],
  benchmark: ['INDEXNAME', 'INDEX NAME', 'INDEX', 'BENCHMARK', 'BENCHMARK NAME', 'BM NAME', 'BM_NAME'],
  asset: ['ASSET', 'ASSET CLASS', 'ASSETNAME', 'ASSET NAME'],
  product: ['PRODUCT', 'PRODUCT NAME', 'PRODUCT CATEGORY'],
  account: ['ACCOUNT', 'ACCOUNT NAME', 'ACCT'],
  folio: ['FOLIO_NO', 'FOLIO NO', 'FOLIO', 'FOLIO NUMBER'],
  price: ['PRICE', 'NAV', 'RATE', 'UNIT PRICE', 'PURCHASE PRICE'],
  type: ['TRANSACTIONTYPE', 'TRANSACTION TYPE', 'TRXN TYPE', 'TRXNTYPE', 'TXN TYPE'],
  rowType: ['TYPE', 'ROW TYPE', 'RECORD TYPE'],
  category: ['CATEGORY', 'CATEGORY NAME', 'SCHEME CATEGORY'],
  distributor: ['DISTRIBUTOR', 'DISTRIBUTOR NAME', 'DISTRIBUTOR_NAME'],
};

const FIELD_ORDER: readonly IrrField[] = [
  'client', 'account', 'instrument', 'folio', 'amount', 'date', 'asset', 'product', 'benchmark', 'price', 'type',
  'rowType', 'category', 'distributor',
];

/** The legacy hmap: header text to its first column, by the upper-cased text and by the text without its units. */
function headerMap(row: Cell[]): Map<string, number> {
  const m = new Map<string, number>();
  row.forEach((c, i) => {
    const raw = cellText(c);
    if (raw === '') return;
    const k = raw.toUpperCase();
    if (!m.has(k)) m.set(k, i);
    const k2 = k.replace(/\(.*?\)/g, ' ').replace(/[₹$]/g, ' ').replace(/\s+/g, ' ').trim();
    if (k2 !== '' && !m.has(k2)) m.set(k2, i);
  });
  return m;
}

function colOf(h: Map<string, number>, aliases: readonly string[]): number | null {
  for (const a of aliases) { const j = h.get(a); if (j !== undefined) return j; }
  return null;
}

function headerRowOf(sheet: Sheet, amountAliases: readonly string[]): number {
  const n = Math.min(IRR_HEADER_SCAN_ROWS, sheet.rows.length);
  for (let i = 0; i < n; i++) {
    const h = headerMap(sheet.rows[i] ?? []);
    if (colOf(h, IRR_ALIASES.client) !== null && colOf(h, amountAliases) !== null && colOf(h, IRR_ALIASES.date) !== null) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------------------------------------------
// Transaction types (OD-16)

const KIND_BY_LABEL = new Map<string, TransactionKind>([
  ['purchase', 'purchase'], ['buy', 'purchase'],
  ['systematicpurchase', 'sip'], ['sip', 'sip'],
  ['topup', 'top-up'],
  ['switchin', 'switch-in'],
  ['systematictransferin', 'stp-in'], ['stpin', 'stp-in'],
  ['transferin', 'transfer-in'],
  ['stockin', 'stock-in'],
  ['bonus', 'bonus'],
  ['demergerin', 'demerger-in'],
  ['redemption', 'redemption'], ['sell', 'redemption'],
  ['systematicwithdrawal', 'swp'], ['swp', 'swp'],
  ['switchout', 'switch-out'],
  ['systematictransferout', 'stp-out'], ['stpout', 'stp-out'],
  ['transferout', 'transfer-out'],
]);

const IN_KINDS: ReadonlySet<TransactionKind> = new Set<TransactionKind>(
  ['purchase', 'sip', 'top-up', 'switch-in', 'stp-in', 'transfer-in', 'stock-in', 'bonus', 'demerger-in']);
const OUT_KINDS: ReadonlySet<TransactionKind> = new Set<TransactionKind>(
  ['redemption', 'swp', 'switch-out', 'stp-out', 'transfer-out']);

/**
 * The kind and direction of a row (OD-16): a row type that says "closing" is a valuation; else the type label, compared
 * on its letters only ("Switch-In", "switch in" and "SWITCHIN" alike); a blank or absent type is 'untyped'; any other
 * label is 'unrecognised'.
 */
export function kindOf(typeLabel: string | null, rowTypeLabel: string | null): { kind: TransactionKind; direction: TransactionDirection } {
  if (rowTypeLabel !== null && /closing/i.test(rowTypeLabel)) return { kind: 'valuation', direction: 'valuation' };
  if (typeLabel === null) return { kind: 'untyped', direction: 'unknown' };
  const kind = KIND_BY_LABEL.get(typeLabel.toLowerCase().replace(/[^a-z]/g, ''));
  if (kind === undefined) return { kind: 'unrecognised', direction: 'unknown' };
  return { kind, direction: IN_KINDS.has(kind) ? 'in' : OUT_KINDS.has(kind) ? 'out' : 'unknown' };
}

// ---------------------------------------------------------------------------------------------------------------
// Cells

/** An amount: a number, or numeric text with commas, an optional leading rupee sign, or "(1,000)" for a negative. */
export function readAmount(cell: Cell | undefined): { kind: 'number'; v: number } | { kind: 'empty' } | { kind: 'invalid' } {
  if (cell === null || cell === undefined) return { kind: 'empty' };
  if (cell.t === 'n') return { kind: 'number', v: cell.v };
  if (cell.t !== 's') return { kind: 'invalid' };
  let s = cell.v.replace(/\s+/g, ' ').trim();
  if (s === '') return { kind: 'empty' };
  let neg = false;
  const paren = /^\((.*)\)$/.exec(s);
  if (paren) { neg = true; s = paren[1]!.trim(); }
  s = s.replace(/^₹\s*/, '').replace(/^-\s*₹\s*/, '-');
  const n = readNumber({ t: 's', v: s });
  if (n.kind === 'empty' || n.kind === 'placeholder') return paren ? { kind: 'invalid' } : { kind: 'empty' };
  if (n.kind !== 'number' || n.percentText) return { kind: 'invalid' };
  if (neg && n.v < 0) return { kind: 'invalid' };
  return { kind: 'number', v: neg ? -n.v : n.v };
}

/** The free-text date rule (model/transactions.ts): a serial's whole day, or text as written; null when not read. */
export function readFlowDay(cell: Cell | undefined, date1904: boolean): { day: DayNumber; form: 'excel-serial' | 'text' } | null {
  if (cell === null || cell === undefined) return null;
  if (cell.t === 'n') { const d = excelSerialToDay(cell.v, date1904); return d === null ? null : { day: d, form: 'excel-serial' }; }
  if (cell.t !== 's') return null;
  const d = parseDayText(cell.v);
  return d === null ? null : { day: d, form: 'text' };
}

const textOrNull = (c: Cell | undefined): string | null => { const t = cellText(c); return t === '' ? null : t; };

/** The period words of a sheet name (MOD-05, Gate B of d6401f6, F5 (c); the platform exports SI, YTD and QTD). */
export const SHEET_PERIODS = ['SI', 'YTD', 'QTD', 'MTD', 'FYTD'] as const;
export type SheetPeriod = (typeof SHEET_PERIODS)[number];

/**
 * A sheet's period (MOD-04, PLAN-05; MOD-05, F5 (c)): a period word (SI, YTD, QTD, MTD, FYTD, any case) at the start of
 * the name, followed by a separator (space, underscore, hyphen or dot), by the end of the name, or joined directly to
 * "Xirr" or "Bm" ("SIXirr", "QTDBmxirr"); else null. "SIP Xirr" and "YTDX Xirr" have no period: the word must end there.
 */
export function sheetPeriodOf(name: string): SheetPeriod | null {
  const m = /^(FYTD|YTD|QTD|MTD|SI)(?=[\s_.-]|$|XIRR|BM)/i.exec(name.trim());
  return m ? (m[1]!.toUpperCase() as SheetPeriod) : null;
}

// ---------------------------------------------------------------------------------------------------------------

class Issues {
  readonly list: ValidationResult[] = [];
  private n = 0;
  add(ruleId: string, severity: Severity, scope: ValidationScope, message: string, extra: { count?: number; status?: ValidationResult['status']; resolution?: ValidationResult['resolution'] } = {}): void {
    this.n++;
    const r: ValidationResult = {
      id: `irr-file.${ruleId}:${this.n}`, ruleId: `irr-file.${ruleId}`, scope, message, severity,
      blocksPublication: severity === 'Blocking', resolution: extra.resolution ?? 'none', status: extra.status ?? 'open',
    };
    if (extra.count !== undefined) r.count = extra.count;
    this.list.push(r);
  }
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export type IrrFileOptions = {
  /** SHA-256 of the file (the source register id), computed by the caller. */
  sourceId: SourceFileId;
  /** Clock for the audit entry (ISO 8601); defaults to the system clock. */
  now?: () => string;
};

const SKIP_REASONS: readonly IrrSkipReason[] = ['blank-row', 'repeated-header', 'no-client', 'no-amount', 'invalid-amount', 'unreadable-date'];

/** Reads an IRR / transactions workbook (I-04) into the I-32 import record. */
export function parseIrrFile(wb: Workbook, opts: IrrFileOptions): IrrFileImport {
  const now = opts.now ?? ((): string => new Date().toISOString());
  const sourceId = opts.sourceId;
  const issues = new Issues();
  const fileScope: ValidationScope = { kind: 'file', sourceId };

  // 1. Sheets: by name, then by content. The platform's cashflow file (owner's layout of 26 Nov 2026) has six sheets:
  // SI Xirr and SI Bmxirr (since inception, the review's flows) and YTD and QTD pairs. A since-inception sheet (period
  // SI, sheetPeriodOf) is preferred whatever the order; without one, the last match wins, as in the legacy (and a fund
  // sheet of another period is then refused below: Gate B of d6401f6, F6).
  let benchSh: Sheet | null = null;
  let fundSh: Sheet | null = null;
  let benchSi = false;
  let fundSi = false;
  const found = new Map<Sheet, 'by-name' | 'by-content'>();
  const nameMatched = new Set<Sheet>();
  const benchNamed: Sheet[] = [];
  const isSi = (u: string): boolean => sheetPeriodOf(u) === 'SI';
  for (const s of wb.sheets) {
    const u = s.name.toUpperCase();
    if (u.includes('BMXIRR') || u.includes('BM XIRR') || u.includes('BMX')) {
      nameMatched.add(s);
      benchNamed.push(s);
      if (!benchSi || isSi(u)) { benchSh = s; benchSi = isSi(u); }
    } else if (u.includes('XIRR')) {
      nameMatched.add(s);
      if (!fundSi || isSi(u)) { fundSh = s; fundSi = isSi(u); }
    }
  }
  if (benchSh) found.set(benchSh, 'by-name');
  if (fundSh) found.set(fundSh, 'by-name');
  const triedNoHeader = new Set<Sheet>();
  if (!benchSh || !fundSh) {
    for (const s of wb.sheets) {
      if (s === benchSh || s === fundSh) continue;
      if (!benchSh && headerRowOf(s, IRR_ALIASES.benchAmount) >= 0) { benchSh = s; found.set(s, 'by-content'); continue; }
      if (!fundSh && headerRowOf(s, IRR_ALIASES.amount) >= 0) { fundSh = s; found.set(s, 'by-content'); continue; }
      // A sheet named for a side that a later sheet of the same name test won is not needed, whatever its header.
      if (!nameMatched.has(s)) triedNoHeader.add(s);
    }
  }
  // The sheet-pairing guard (MOD-04, PLAN-05 follow-up): the fund and benchmark sheets come from the same period. A
  // sheet's period is its name's period word (sheetPeriodOf: SI, YTD, QTD, MTD or FYTD); else it has none, and the
  // pairing is as before (legacy names such as "Old Xirr"). When both have a period and they differ, the benchmark sheet
  // of the fund sheet's period is taken if the file has one (the last, as in the legacy); else no benchmark is read,
  // never a period-less or other-period sheet in its place (MOD-05, F5 (a) and (b)), with a Warning naming the two
  // sheets and every benchmark sheet seen (sheet names only, never client data).
  let periodMismatch: { fund: string; bench: string } | null = null;
  const fundPeriod = fundSh ? sheetPeriodOf(fundSh.name) : null;
  const benchPeriod = benchSh ? sheetPeriodOf(benchSh.name) : null;
  if (fundSh && benchSh && fundPeriod !== null && benchPeriod !== null && fundPeriod !== benchPeriod) {
    const same = benchNamed.filter((s) => sheetPeriodOf(s.name) === fundPeriod).pop();
    if (same) { benchSh = same; found.set(same, 'by-name'); } else { periodMismatch = { fund: fundSh.name, bench: benchSh.name }; benchSh = null; }
  }

  const skipped: IrrSkippedRow[] = [];
  const counts: IrrFileCounts = {
    dataRows: { fund: 0, bench: 0 }, flows: { fund: 0, bench: 0 },
    skipped: { 'blank-row': 0, 'repeated-header': 0, 'no-client': 0, 'no-amount': 0, 'invalid-amount': 0, 'unreadable-date': 0 },
    unassigned: 0,
  };
  const clientIdOf = idFactory<'client'>('cl');
  const distIdOf = idFactory<'distributor'>('ds');
  const typeTally = new Map<string, number>();
  const sheetHeaderRow = new Map<Sheet, number>();

  const readSheet = (sheet: Sheet | null, side: FlowSide): { read: IrrSheetRead | null; flows: Transaction[] } => {
    if (!sheet) return { read: null, flows: [] };
    const amountAliases = side === 'fund' ? IRR_ALIASES.amount : IRR_ALIASES.benchAmount;
    const hr = headerRowOf(sheet, amountAliases);
    if (hr < 0) { triedNoHeader.add(sheet); return { read: null, flows: [] }; }
    sheetHeaderRow.set(sheet, hr);
    const h = headerMap(sheet.rows[hr] ?? []);
    const col = new Map<IrrField, number>();
    for (const f of FIELD_ORDER) {
      const j = colOf(h, f === 'amount' ? amountAliases : IRR_ALIASES[f]);
      if (j !== null) col.set(f, j);
    }
    const headerTexts = (sheet.rows[hr] ?? []).map((c) => cellText(c));
    const columns: IrrColumnUse[] = [...col.entries()].map(([field, column]) => ({ field, header: headerTexts[column] ?? '', column }))
      .sort((a, b) => a.column - b.column);
    const at = (r: number): RowRef => ({ sourceId, sheet: sheet.name, row: r + 1 });
    const get = (row: Cell[], f: IrrField): Cell | undefined => { const j = col.get(f); return j === undefined ? undefined : row[j]; };
    const flows: Transaction[] = [];
    for (let r = hr + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r] ?? [];
      counts.dataRows[side]++;
      const first = row.map((c) => cellText(c)).find((t) => t !== '') ?? null;
      const amount = readAmount(get(row, 'amount'));
      const skip = (reason: IrrSkipReason): void => {
        counts.skipped[reason]++;
        skipped.push({ side, at: at(r), reason, label: first === null ? null : first.slice(0, 60), hasMoney: amount.kind === 'number' });
      };
      if (first === null) { skip('blank-row'); continue; }
      const rh = headerMap(row);
      if (colOf(rh, IRR_ALIASES.client) !== null && colOf(rh, amountAliases) !== null && colOf(rh, IRR_ALIASES.date) !== null) { skip('repeated-header'); continue; }
      const clientLabel = textOrNull(get(row, 'client'));
      if (clientLabel === null) { skip('no-client'); continue; }
      if (amount.kind === 'empty') { skip('no-amount'); continue; }
      if (amount.kind === 'invalid') { skip('invalid-amount'); continue; }
      const day = readFlowDay(get(row, 'date'), wb.date1904);
      if (day === null) { skip('unreadable-date'); continue; }
      const typeLabel = textOrNull(get(row, 'type'));
      const rowTypeLabel = textOrNull(get(row, 'rowType'));
      const { kind, direction } = kindOf(typeLabel, rowTypeLabel);
      if (kind === 'unrecognised' && typeLabel !== null) typeTally.set(typeLabel, (typeTally.get(typeLabel) ?? 0) + 1);
      const priceRead = col.has('price') ? readAmount(get(row, 'price')) : { kind: 'empty' as const };
      // TODO(I-32): the price is rupees per unit; `Unit` has no such unit yet, so 'ratio' stands in until MOD-04's next
      // contracts PR adds a rupees-per-unit unit to model/value.ts (MOD-04, 25 Nov 2026).
      const price: Value<number> = priceRead.kind === 'number'
        ? present(priceRead.v, 'ratio', { sources: [sourceId], method: `irr-file "${headerTexts[col.get('price')!] ?? 'Price'}" (rupees per unit)` })
        : priceRead.kind === 'invalid' ? missing(STATUS.INVALID_SOURCE, 'the price is not a number')
          : missing(STATUS.NOT_AVAILABLE, col.has('price') ? 'the price cell is blank' : 'the file has no price column');
      const distributorLabel = textOrNull(get(row, 'distributor'));
      const folioCell = get(row, 'folio');
      const folio = folioCell && folioCell.t === 'n' ? String(folioCell.v) : textOrNull(folioCell);
      const tx: Transaction = {
        side, at: at(r), clientLabel, clientId: clientIdOf(clientLabel) as ClientId,
        accountLabel: textOrNull(get(row, 'account')), instrumentName: textOrNull(get(row, 'instrument')), instrument: null,
        folio, folioId: null,
        assetLabel: textOrNull(get(row, 'asset')), productLabel: textOrNull(get(row, 'product')),
        categoryLabel: textOrNull(get(row, 'category')), benchmarkLabel: textOrNull(get(row, 'benchmark')),
        distributorLabel, distributorId: distributorLabel === null ? null : distIdOf(distributorLabel) as DistributorId,
        day: day.day, dayForm: day.form, amountRupees: amount.v, price, typeLabel, rowTypeLabel, kind, direction,
      };
      flows.push(tx);
      counts.flows[side]++;
    }
    return { read: { side, name: sheet.name, found: found.get(sheet) ?? 'by-content', headerRow: hr + 1, columns }, flows };
  };

  const fundRead = readSheet(fundSh, 'fund');
  const benchRead = readSheet(benchSh, 'bench');
  const fund = fundRead.flows;
  const bench = benchRead.flows;
  const hasDistributor = !!fundRead.read && fundRead.read.columns.some((c) => c.field === 'distributor');
  counts.unassigned = fund.filter((t) => t.distributorLabel === null).length;

  const sheets: SheetAttempt[] = wb.sheets.map((s) => {
    const used = (s === fundSh && fundRead.read) || (s === benchSh && benchRead.read);
    if (used) return { sheet: s.name, outcome: 'used', headerRow: (sheetHeaderRow.get(s) ?? 0) + 1 };
    return { sheet: s.name, outcome: triedNoHeader.has(s) ? 'no-header' : 'not-needed', headerRow: null };
  });

  let maxDay: number | null = null;
  for (const t of fund) if (maxDay === null || t.day > maxDay) maxDay = t.day;
  const asOn: Value<DayNumber> = maxDay === null
    ? missing(STATUS.NOT_AVAILABLE, 'the IRR file has no fund flow')
    : present(maxDay, 'date', { sources: [sourceId], method: 'irr-file: the last fund flow day' });

  // Validation results (messages carry counts and sheet or column names only).
  if (!fundRead.read) {
    issues.add('no-fund-sheet', 'Blocking', fileScope,
      'No sheet holds fund flows: a sheet named with "Xirr", or a header with a client, an amount and a date column in its first 20 rows.');
  } else {
    issues.add('sheet-used', 'Information', { kind: 'sheet', sourceId, sheet: fundRead.read.name },
      `Fund flows were read from the sheet "${fundRead.read.name}" (found ${fundRead.read.found === 'by-name' ? 'by its name' : 'by its header'}, header in row ${fundRead.read.headerRow})${benchRead.read ? `, benchmark flows from "${benchRead.read.name}" (header in row ${benchRead.read.headerRow})` : ''}.`,
      { resolution: 'auto-resolved', status: 'resolved' });
    // Gate B of d6401f6, F6 (MOD-05: Blocking for the returns view). The review's returns are since inception: a fund
    // sheet whose name carries another period word (a YTD or QTD sheet, read because the file has no SI sheet) gives no
    // XIRR. Its flows are still read and listed; the Blocking result refuses the file. A period-less name (legacy
    // "Xirr" and "Bmxirr", or a sheet found by its header) is accepted as before.
    if (fundPeriod !== null && fundPeriod !== 'SI') {
      issues.add('no-si-sheet', 'Blocking', { kind: 'sheet', sourceId, sheet: fundRead.read.name },
        `The since-inception sheet is missing: fund flows were found only on the sheet "${fundRead.read.name}" (period ${fundPeriod}), and the returns need the "SI Xirr" and "SI Bmxirr" sheets, so no XIRR is computed from this file.`);
    }
    if (fund.length === 0) issues.add('no-fund-flows', 'Blocking', { kind: 'sheet', sourceId, sheet: fundRead.read.name }, 'The fund sheet has no row that could be read as a flow.');
  }
  if (!benchRead.read && periodMismatch !== null) {
    // In place of "no sheet holds benchmark flows": one does, of another period. Every benchmark sheet seen is named.
    const seen = [...new Set([...benchNamed.map((s) => s.name), periodMismatch.bench])].map((n) => `"${n}"`).join(', ');
    issues.add('sheet-period-mismatch', 'Warning', fileScope,
      `The benchmark sheet "${periodMismatch.bench}" is not of the same period as the fund sheet "${periodMismatch.fund}" (${SHEET_PERIODS.join(', ')}), and the file has no benchmark sheet of that period, so no benchmark flows are read and no benchmark XIRR can be computed. Benchmark sheets seen: ${seen}.`);
  } else if (!benchRead.read) {
    issues.add('no-bench-sheet', 'Warning', fileScope,
      'No sheet holds benchmark flows ("Bmxirr" in its name, or a benchmark-amount column), so no benchmark XIRR can be computed.');
  }
  for (const reason of SKIP_REASONS) {
    const rows = skipped.filter((s) => s.reason === reason);
    if (rows.length === 0) continue;
    const info = reason === 'blank-row' || reason === 'repeated-header';
    const withMoney = rows.filter((s) => s.hasMoney).length;
    const what: Record<IrrSkipReason, string> = {
      'blank-row': 'blank', 'repeated-header': 'a repeated header', 'no-client': 'without a client',
      'no-amount': 'without an amount', 'invalid-amount': 'with an amount that is not a number',
      'unreadable-date': 'with a date that cannot be read (not an Excel date, not a date written in an accepted form, or a date that does not exist)',
    };
    issues.add(`skipped-${reason}`, info ? 'Information' : 'Warning', { kind: 'rows', sourceId, rows: rows.map((s) => s.at) },
      `${plural(rows.length, 'row', 'rows')} ${what[reason]} ${rows.length === 1 ? 'was' : 'were'} skipped${withMoney ? ` (${withMoney} with an amount)` : ''}.`,
      info ? { count: rows.length, resolution: 'auto-resolved', status: 'resolved' } : { count: rows.length });
  }
  // OD-4 "duplicate folios: flag them, never alter them": a folio number that the fund sheet gives to more than one
  // client, or to more than one instrument (names compared without case and spacing). Flagged by count only; the flows
  // are read as written. The folio itself never appears in a message.
  const folioUse = new Map<string, { clients: Set<string>; instruments: Set<string> }>();
  for (const t of fund) {
    if (t.folio === null) continue;
    const u = folioUse.get(t.folio) ?? { clients: new Set<string>(), instruments: new Set<string>() };
    u.clients.add(t.clientId as string);
    u.instruments.add((t.instrumentName ?? '').replace(/\s+/g, ' ').trim().toLowerCase());
    folioUse.set(t.folio, u);
  }
  const duplicateFolios = [...folioUse.values()].filter((u) => u.clients.size > 1 || u.instruments.size > 1).length;
  if (duplicateFolios > 0) {
    issues.add('duplicate-folios', 'Warning', fileScope,
      `${plural(duplicateFolios, 'folio number appears', 'folio numbers appear')} under more than one client or instrument; ${duplicateFolios === 1 ? 'it is' : 'they are'} flagged and read as written (OD-4).`,
      { count: duplicateFolios });
  }
  const unrecognisedTypes = [...typeTally.entries()].map(([label, rows]) => ({ label, rows }));
  if (unrecognisedTypes.length > 0) {
    const n = unrecognisedTypes.reduce((s, x) => s + x.rows, 0);
    issues.add('unrecognised-types', 'Warning', fileScope,
      `${plural(n, 'flow has', 'flows have')} a transaction type that is not a known type: ${unrecognisedTypes.map((x) => `"${x.label}" (${x.rows})`).join(', ')}. They count in the XIRR as written and are not treated as a purchase or a sale.`,
      { count: n });
  }
  // Gate B of d6401f6, F7 (MOD-05's defaults; owner question Q-R3): Warnings, counted and listed by row, for a file
  // filled by hand. The flows are read and count in the XIRR as written; nothing is corrected.
  //   - contrary signs: money paid in (a purchase-like type) written positive, money paid out (a redemption-like type)
  //     written negative, or a Closing value written negative (a zero Closing row is accepted);
  //   - Closing rows, per instrument (client, instrument name normalised, folio), only when the fund sheet has a row-type
  //     column (without one no row can be marked Closing): none, unless the instrument is fully redeemed, which is taken
  //     as its last day's flows being money paid out on balance (INFERRED: the file has no units, so a partial redemption
  //     on the last day reads the same); more than one, a duplicate.
  const contrary = fund.filter((t) => (t.direction === 'in' && t.amountRupees > 0) || (t.direction === 'out' && t.amountRupees < 0)
    || (t.direction === 'valuation' && t.amountRupees < 0));
  if (contrary.length > 0) {
    const n = contrary.length;
    issues.add('contrary-signs', 'Warning', { kind: 'rows', sourceId, rows: contrary.map((t) => t.at) },
      `${plural(n, 'fund flow has', 'fund flows have')} a sign contrary to ${n === 1 ? 'its' : 'their'} type (money paid in is negative; money paid out and a Closing value are positive); ${n === 1 ? 'it counts' : 'they count'} in the XIRR as written.`,
      { count: n });
  }
  if (fundRead.read && fundRead.read.columns.some((c) => c.field === 'rowType')) {
    const byInstrument = new Map<string, Transaction[]>();
    for (const t of fund) {
      const k = `${t.clientId as string}\u0000${normaliseLabel(t.instrumentName)}\u0000${t.folio ?? ''}`;
      const g = byInstrument.get(k);
      if (g) g.push(t); else byInstrument.set(k, [t]);
    }
    const noClosing: RowRef[] = [];
    const duplicate: RowRef[] = [];
    let duplicated = 0;
    for (const ts of byInstrument.values()) {
      const closing = ts.filter((t) => t.direction === 'valuation');
      if (closing.length > 1) { duplicated++; duplicate.push(...closing.map((t) => t.at)); }
      if (closing.length > 0) continue;
      const lastDay = Math.max(...ts.map((t) => t.day));
      const last = ts.filter((t) => t.day === lastDay);
      if (last.reduce((s, t) => s + t.amountRupees, 0) > 0) continue;
      noClosing.push(last[last.length - 1]!.at);
    }
    if (noClosing.length > 0) {
      const n = noClosing.length;
      issues.add('missing-closing', 'Warning', { kind: 'rows', sourceId, rows: noClosing },
        `${plural(n, 'instrument has', 'instruments have')} no Closing row and ${n === 1 ? 'does' : 'do'} not end with money paid out (a fully redeemed instrument needs no Closing row, and a zero Closing row says the same); without a closing value the XIRR counts only the flows written.`,
        { count: n });
    }
    if (duplicated > 0) {
      issues.add('duplicate-closing', 'Warning', { kind: 'rows', sourceId, rows: duplicate },
        `${plural(duplicated, 'instrument has', 'instruments have')} more than one Closing row (${plural(duplicate.length, 'row', 'rows')}); every Closing row counts in the XIRR as written.`,
        { count: duplicated });
    }
  }
  if (fundRead.read) {
    if (!hasDistributor) {
      issues.add('no-distributor-column', 'Information', fileScope,
        'The fund sheet has no DISTRIBUTOR column, so returns cannot be shown per distributor.', { resolution: 'auto-resolved', status: 'resolved' });
    } else if (counts.unassigned > 0) {
      issues.add('unassigned-flows', 'Information', fileScope,
        `${plural(counts.unassigned, 'fund flow has', 'fund flows have')} no distributor; ${counts.unassigned === 1 ? 'it is' : 'they are'} reported on the unassigned line, never spread across distributors.`,
        { count: counts.unassigned, resolution: 'auto-resolved', status: 'resolved' });
    }
  }

  const out: IrrFileImport = {
    parserVersion: IRR_PARSER_VERSION, sourceId, fundSheet: fundRead.read, benchSheet: benchRead.read, sheets, fund, bench,
    skipped, unrecognisedTypes, hasDistributor, asOn, issues: issues.list, audit: [], counts,
  };
  out.audit.push({
    id: 'audit:1', at: now(), kind: 'import', sourceId,
    summary: fundRead.read
      ? `IRR file read: ${fund.length} fund flows and ${bench.length} benchmark flows; ${skipped.length} rows skipped.`
      : 'IRR file not read: no sheet holds fund flows.',
    detail: {
      parser: IRR_PARSER_VERSION, fundFlows: fund.length, benchFlows: bench.length, skipped: skipped.length,
      unassigned: counts.unassigned, unrecognisedTypes: unrecognisedTypes.length, hasDistributor,
      blocking: issues.list.filter((i) => i.severity === 'Blocking').length,
    },
  });
  return out;
}
