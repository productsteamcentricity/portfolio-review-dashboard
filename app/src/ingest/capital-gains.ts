// Capital-gains statement reader (milestone M7, NB-M7a; design docs/new-build/capital-gains-upload.md, D-036;
// columns docs/DATA_DICTIONARY.md §5.17). One reader for the wealth platform's "Capital Gain Report" export and the
// app's blank template filled by the analyst.
//
// What it does (design sections in brackets):
//   - finds the sheet and its header row by header name, any column order, extra columns listed (§2.1 to §2.3);
//   - removes personal identifiers at read: every "[PAN: ...]" tag and every PAN-shaped token in every text cell of
//     the sheet, before any cell is kept; only counts survive (§3);
//   - numbers the distinct PANs of the lot rows per file, in order of first appearance (Person 1..n; owner, PD-16
//     item 3, 26 Nov 2026): the ordinal is kept on the lot, the PAN itself is discarded as soon as the row is numbered
//     and nothing derived from it is kept (§3, §9.3);
//   - tells lot rows from excluded lots, skipped rows, the totals row and the footer, whose text is never kept (§2.4);
//   - parses the instrument tag into scheme label, folio and tag asset (§2.5);
//   - turns each lot row into a statement lot with its row checks (§4) and its financial year (§8);
//   - finds repeated rows by sale event and asks one question per event (§6);
//   - reconciles the amount columns with the statement's totals row (§7).
// Not here (the tax engine, engine/tax/, owner-gated): lot classes (§5), tax class, rules, lots, roll-up.
//
// Money stays in rupees (design §2.3: the tax engine computes in rupees and converts to Crore for display only).
// Pure function: no globals, no network, no clock unless injected. Messages carry counts, column names and
// financial years only: never a PAN, a folio, a name or the amount of a single lot (§11).

import type { Cell, Sheet, Workbook } from './workbook.ts';
import type { DayNumber } from '../model/value.ts';
import type { MissingStatus } from '../model/status.ts';
import type { AccountId, ClientId, DistributorId, SourceFileId } from '../model/ids.ts';
import type { RowRef, SheetAttempt } from '../model/source.ts';
import type {
  CapitalGainsRepeatsQuestion, CgRepeatAnswer, Severity, ValidationResult, ValidationScope,
} from '../model/validation.ts';
import type { AuditEntry } from '../model/audit.ts';
import { STATUS } from '../model/status.ts';
import { cellText } from './workbook.ts';
import { readNumber } from './cells.ts';
import { dayToYmd, excelSerialToDay } from '../engine/dates.ts';
import { idFactory, keyOf, normaliseLabel } from '../engine/ids.ts';

export const CG_PARSER_VERSION = 'capital-gains@1';
/** Rows searched for the header on each sheet (design §2.1: the first 5, as for the base file's legacy reader). */
export const CG_HEADER_SCAN_ROWS = 5;
/** What replaces a PAN-shaped token in a kept cell (design §3). */
export const PAN_REPLACEMENT = '[PAN removed]';

// ---------------------------------------------------------------------------------------------------------------
// Columns (design §2.3)

export type CgField =
  | 'saleDate' | 'accountName' | 'familyName' | 'clientName' | 'instrumentName' | 'categoryName' | 'assetName'
  | 'distributorName' | 'purchaseDate' | 'purchasePrice' | 'salePrice' | 'saleUnit' | 'sellAmount'
  | 'principalRepayment' | 'investedValue' | 'realisedGL' | 'ltcg' | 'stcg' | 'acquisitionDate' | 'acquisitionPrice'
  | 'holdingTerms' | 'interestEarned' | 'xirr' | 'preTaxGL' | 'taxAmount' | 'surcharge' | 'cess' | 'totalTax'
  | 'postTaxGL' | 'folioNumber';

/** How a column's cells are read. */
export type CgKind = 'date' | 'text' | 'money' | 'price' | 'units' | 'days' | 'pct';

/** 'yes' required; 'person' one of Account Name and Client Name; 'class' one of Category Name and Asset Name. */
export type CgRequired = 'yes' | 'person' | 'class' | 'no';

export type CgColumn = {
  field: CgField;
  /** The header as the platform exports it, trimmed (the template writes this). */
  header: string;
  aliases: readonly string[];
  required: CgRequired;
  kind: CgKind;
  /** In the platform's export and the blank template (false only for the added Folio Number column). */
  exported: boolean;
};

const col = (field: CgField, header: string, aliases: readonly string[], required: CgRequired, kind: CgKind,
  exported = true): CgColumn => ({ field, header, aliases, required, kind, exported });

/** The 29 columns of the export in its order, then the added Folio Number column (design §2.3). */
export const CG_COLUMNS: readonly CgColumn[] = [
  col('saleDate', 'Sale Date', ['Redemption Date', 'Date of Sale'], 'yes', 'date'),
  col('accountName', 'Account Name', [], 'person', 'text'),
  col('familyName', 'Family Name', [], 'no', 'text'),
  col('clientName', 'Client Name', ['Investor Name'], 'person', 'text'),
  col('instrumentName', 'Instrument Name', ['Scheme Name', 'Scheme'], 'yes', 'text'),
  col('categoryName', 'Category Name', ['Category', 'Sub Category'], 'class', 'text'),
  col('assetName', 'Asset Name', ['Asset Class'], 'class', 'text'),
  col('distributorName', 'Distributor Name', ['Distributor', 'ARN Name'], 'no', 'text'),
  col('purchaseDate', 'Purchase Date', ['Date of Purchase'], 'yes', 'date'),
  col('purchasePrice', 'Purchase Price (₹)', ['Purchase NAV'], 'no', 'price'),
  col('salePrice', 'Sale Price (₹)', ['Sale NAV', 'Redemption NAV'], 'no', 'price'),
  col('saleUnit', 'Sale Unit', ['Sale Units', 'Units Sold', 'Units'], 'yes', 'units'),
  col('sellAmount', 'Sell Amount (₹)', ['Sale Amount', 'Sale Value', 'Redemption Amount'], 'yes', 'money'),
  col('principalRepayment', 'Principal Repayment (₹)', [], 'no', 'money'),
  col('investedValue', 'Invested Value (₹)', ['Purchase Value', 'Purchase Amount', 'Cost'], 'yes', 'money'),
  col('realisedGL', 'Realized G/L (₹)', ['Realised G/L', 'Realized Gain/Loss', 'Gain/Loss'], 'no', 'money'),
  col('ltcg', 'LTCG G/L (₹)', ['LTCG'], 'no', 'money'),
  col('stcg', 'STCG G/L (₹)', ['STCG'], 'no', 'money'),
  col('acquisitionDate', 'Acquisition Date', [], 'no', 'date'),
  col('acquisitionPrice', 'Acquisition Price (₹)', ['Acquisition NAV', 'Cost for Tax per Unit'], 'no', 'price'),
  col('holdingTerms', 'Holding Terms', ['Holding Days', 'Holding Period (Days)'], 'no', 'days'),
  col('interestEarned', 'Interest Earned (₹)', [], 'no', 'money'),
  col('xirr', 'XIRR (%)', [], 'no', 'pct'),
  col('preTaxGL', 'Pre Tax G/L (₹)', [], 'no', 'money'),
  col('taxAmount', 'Tax Amount (₹)', [], 'no', 'money'),
  col('surcharge', 'Surcharge (₹)', [], 'no', 'money'),
  col('cess', 'Cess (₹)', [], 'no', 'money'),
  col('totalTax', 'Total Tax (₹)', [], 'no', 'money'),
  col('postTaxGL', 'Post Tax G/L (₹)', [], 'no', 'money'),
  col('folioNumber', 'Folio Number', ['Folio No', 'Folio'], 'no', 'text', false),
];

/** The amount columns reconciled with the totals row (design §7), in export order. */
export const CG_RECONCILED: readonly CgField[] = [
  'sellAmount', 'principalRepayment', 'investedValue', 'realisedGL', 'ltcg', 'stcg', 'interestEarned',
  'preTaxGL', 'taxAmount', 'surcharge', 'cess', 'totalTax', 'postTaxGL',
];

/** The six stated tax columns (design §2.3 rows 24 to 29). */
export const CG_TAX_FIELDS: readonly CgField[] = ['preTaxGL', 'taxAmount', 'surcharge', 'cess', 'totalTax', 'postTaxGL'];

const COLUMN_BY_FIELD = new Map<CgField, CgColumn>(CG_COLUMNS.map((c) => [c.field, c]));
export function cgColumn(field: CgField): CgColumn {
  return COLUMN_BY_FIELD.get(field)!;
}

const UNIT_SUFFIX_RE = /\s*\(\s*(?:₹|rs\.?|inr)\s*\)$/;

/**
 * A header for matching (design §2.2): trimmed, inner spaces collapsed, letter case ignored, and a trailing "(₹)",
 * "(Rs)", "(Rs.)" or "(INR)" dropped, so it matches the same header with no unit.
 */
export function normaliseHeader(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase().replace(UNIT_SUFFIX_RE, '').trim();
}

const FIELD_BY_HEADER = new Map<string, CgField>();
for (const c of CG_COLUMNS) {
  for (const h of [c.header, ...c.aliases]) FIELD_BY_HEADER.set(normaliseHeader(h), c.field);
}

/** The field a header cell names, or null. */
export function fieldOfHeader(text: string): CgField | null {
  return FIELD_BY_HEADER.get(normaliseHeader(text)) ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Personal data (design §3)

// A "[PAN: ...]" tag (any letter case, any spacing inside), removed whole.
const PAN_TAG_RE = /\[\s*pan\s*:[^\]]*\]/gi;
// A PAN-shaped token: five letters, four digits, one letter, any letter case. Matched without word boundaries, so a
// token glued to other letters or digits is removed too (the stricter reading protects more).
const PAN_TOKEN_RE = /[A-Za-z]{5}[0-9]{4}[A-Za-z]/g;
const PAN_TOKEN_TEST_RE = /[A-Za-z]{5}[0-9]{4}[A-Za-z]/;
// KI-323 (MOD-05's rulings): a PAN written with a separator between its groups (five letters, four digits, one letter;
// a separator after the letters, before the last letter, or both). A separator is one to three characters, each a
// space, a non-breaking space (U+00A0, the escape xA0 below) or a hyphen (the review's S-2: spreadsheet exports write the
// non-breaking space and short runs). Narrower than the token above, so ordinary text is not cut:
//   - it must stand apart: no letter or digit directly before or after it ("April 2033 Index" in reference scheme names
//     would read "April 2033 I", and "Sample 2025 Growth" "ample 2025 G");
//   - upper case only ("KI-323 narrow");
//   - its fourth letter is a PAN holder-type letter: A, B, C, F, G, H, J, L, P or T ("KI-323 narrow").
// The residual, by design: an upper-case five-letter word whose fourth letter is one of the ten, then four digits, then
// one letter, with such a separator after the word, before the letter, or both (a month name in capitals whose fourth
// letter is C, before a year and a lone letter), is removed too; it is counted, so the analyst is told, never silently.
// tests/unit/ingest/capital-gains.test.ts ("KI-323") runs this pattern over every reference string and fixture line.
const PAN_SPACED_RE = /(?<![A-Za-z0-9])[A-Z]{3}[ABCFGHJLPT][A-Z](?:[ \xA0-]{1,3}[0-9]{4}(?:[ \xA0-]{1,3})?|[0-9]{4}[ \xA0-]{1,3})[A-Z](?![A-Za-z0-9])/g;

/** True when a text holds a PAN-shaped token (used by the tests' scans too). */
export function hasPanShape(text: string): boolean {
  return PAN_TOKEN_TEST_RE.test(text);
}

/**
 * The text with every PAN tag and PAN-shaped token removed, and how many of each. A token written with spaces or hyphens
 * between its groups (KI-323) is removed and counted as a token too.
 */
export function scrubText(text: string): { text: string; tags: number; tokens: number } {
  let tags = 0;
  let tokens = 0;
  let out = text.replace(PAN_TAG_RE, () => { tags++; return ''; });
  out = out.replace(PAN_TOKEN_RE, () => { tokens++; return PAN_REPLACEMENT; });
  out = out.replace(PAN_SPACED_RE, () => { tokens++; return PAN_REPLACEMENT; });
  if (tags > 0) out = out.replace(/\s+$/, '');
  return { text: out, tags, tokens };
}

/**
 * The PAN of one raw lot row, normalised to upper case, or null (design §3, PD-16 item 3): the PAN-shaped token inside
 * Account Name's "[PAN: ...]" tag, else a bare PAN-shaped token in Account Name, else the first PAN-shaped token in any
 * other text cell of the row, left to right. A tag without a PAN-shaped token inside gives no PAN. Used only by
 * `numberPersons`, inside one `parseCapitalGains` call; the returned text is never stored.
 */
function panOfRow(row: readonly Cell[], accountCol: number | undefined): string | null {
  const textOf = (c: Cell | undefined): string | null => (c && (c.t === 's' || c.t === 'e') ? c.v : null);
  const first = (s: string): string | null => {
    const m = PAN_TOKEN_TEST_RE.exec(s);
    return m ? m[0].toUpperCase() : null;
  };
  const account = accountCol === undefined ? null : textOf(row[accountCol]);
  if (account !== null) {
    for (const tag of account.match(PAN_TAG_RE) ?? []) {
      const t = first(tag);
      if (t !== null) return t;
    }
    const bare = first(account);
    if (bare !== null) return bare;
  }
  for (let j = 0; j < row.length; j++) {
    if (j === accountCol) continue;
    const s = textOf(row[j]);
    const t = s === null ? null : first(s);
    if (t !== null) return t;
  }
  return null;
}

/**
 * The person ordinal of each lot row (design §3, §9.3; PD-16 item 3): the distinct PANs of the lot rows numbered 1..n
 * in order of first appearance in the file. The map from PAN to ordinal lives only inside this function and is
 * discarded when it returns: the result holds the ordinals alone, so an ordinal says nothing about the PAN's characters
 * (two files whose PANs differ but appear in the same order give the same ordinals).
 */
function numberPersons(raw: readonly Cell[][], lotRows: readonly number[], accountCol: number | undefined): Array<number | null> {
  const ordinal = new Map<string, number>();
  return lotRows.map((r) => {
    const pan = panOfRow(raw[r] ?? [], accountCol);
    if (pan === null) return null;
    let n = ordinal.get(pan);
    if (n === undefined) {
      n = ordinal.size + 1;
      ordinal.set(pan, n);
    }
    return n;
  });
}

type Scrubbed = { rows: Cell[][]; tags: number[]; tokens: number[] };

/** A copy of the sheet's rows with every text cell scrubbed (formula text dropped), and the removals per row. */
function scrubRows(rows: Cell[][]): Scrubbed {
  const tags: number[] = [];
  const tokens: number[] = [];
  const out = rows.map((row, r) => {
    let tg = 0;
    let tk = 0;
    const copy = (row ?? []).map((cell): Cell => {
      if (cell === null || cell === undefined) return null;
      if (cell.t === 's' || cell.t === 'e') {
        const s = scrubText(cell.v);
        tg += s.tags;
        tk += s.tokens;
        return cell.t === 's' ? (s.text === '' ? null : { t: 's', v: s.text }) : { t: 'e', v: s.text };
      }
      if (cell.t === 'n') return { t: 'n', v: cell.v, fmt: cell.fmt, date: cell.date };
      return { t: 'b', v: cell.v };
    });
    tags[r] = tg;
    tokens[r] = tk;
    return copy;
  });
  return { rows: out, tags, tokens };
}

// ---------------------------------------------------------------------------------------------------------------
// Types of the import record

/** A value read from a cell: present, or missing with its status (NOT AVAILABLE when blank, INVALID when not one). */
export type CgRead<T> = { kind: 'value'; v: T } | { kind: 'missing'; status: MissingStatus };

/** The financial year of a sale: 1 April to 31 March, by its starting year (design §8). */
export type FinancialYear = {
  /** The calendar year in which it starts: 2024 for FY 2024-25. */
  start: number;
  /** "FY 2025-26" and earlier (Income-tax Act 1961); "Tax year 2026-27" and later (Income-tax Act 2025). */
  label: string;
};

/** The statement's own figures for a lot, as read; shown beside the app's, never used in their place (design §4). */
export type CgStatementCells = {
  realised: CgRead<number>;
  ltcg: CgRead<number>;
  stcg: CgRead<number>;
  acquisitionDate: CgRead<DayNumber>;
  acquisitionPrice: CgRead<number>;
  holdingDays: CgRead<number>;
  principalRepayment: CgRead<number>;
  interest: CgRead<number>;
  tax: {
    preTax: CgRead<number>;
    tax: CgRead<number>;
    surcharge: CgRead<number>;
    cess: CgRead<number>;
    total: CgRead<number>;
    postTax: CgRead<number>;
  };
};

/** The row checks of design §4. */
export type CgRowCheck = 'holding-days' | 'sale-amount' | 'invested-value' | 'realised' | 'date-order' | 'units-positive';

export const CG_ROW_CHECKS: readonly CgRowCheck[] = [
  'holding-days', 'sale-amount', 'invested-value', 'realised', 'date-order', 'units-positive',
];

const CHECK_NAMES: Readonly<Record<CgRowCheck, string>> = {
  'holding-days': 'Holding Terms equals Sale Date minus Purchase Date',
  'sale-amount': 'Sale Unit times Sale Price equals Sell Amount',
  'invested-value': 'Sale Unit times Purchase Price equals Invested Value',
  realised: 'Sell Amount minus Invested Value equals Realized G/L',
  'date-order': 'Purchase Date on or before Sale Date',
  'units-positive': 'Sale Unit above 0',
};

/**
 * One lot row of the statement (design §4): the fields the reader fills. The engine (engine/tax/) adds the lot
 * class, tax facts, term, cost for tax, taxable gain and rule id, and builds the `RealisedGain` of
 * DATA_DICTIONARY §5.5 from it. Money in rupees; units with every decimal the cell holds.
 */
export type CgLot = {
  /** 0-based position among the lot rows, in file order. */
  index: number;
  at: RowRef;
  saleDate: DayNumber;
  financialYear: FinancialYear;
  purchaseDate: CgRead<DayNumber>;
  units: CgRead<number>;
  saleValue: CgRead<number>;
  purchaseValue: CgRead<number>;
  salePrice: CgRead<number>;
  salePriceDerived: boolean;
  purchasePrice: CgRead<number>;
  purchasePriceDerived: boolean;
  /** Sell Amount minus Invested Value: the economic gain, always computed when both are present (design §4). */
  realised: CgRead<number>;
  /** The person (design §9.3): the review client whose label matches, else an id of the label as spelt. */
  clientId: ClientId | null;
  /** True when the person matches a client of the review. */
  inReview: boolean;
  /**
   * The PAN ordinal of the row (design §3, PD-16 item 3): "Person n", n the order of first appearance of the row's PAN
   * among the file's lot rows; null when the row has no PAN. Per file and meaningless outside it; never derived from
   * the PAN's characters.
   */
  personNo: number | null;
  /** The person whose tax is computed (design §9.3): the PAN ordinal when the row has a PAN, else the client label. */
  taxPerson: CgTaxPerson | null;
  accountId: AccountId;
  distributorId: DistributorId | null;
  /** Account Name split at its last " - " once the PAN tag is removed (design §2.3 row 2). */
  accountLabel: string | null;
  accountNote: string;
  schemeLabel: string;
  folio: string | null;
  tagAsset: string | null;
  category: string | null;
  statementAsset: string | null;
  statement: CgStatementCells;
  /** The sale event of design §6 (folio within account, scheme label, sale date). */
  eventId: string;
  /** The index of the first lot row this row repeats exactly (design §6), or null. */
  duplicateOf: number | null;
  /** True when the analyst answered "once" for its event and this row is an extra repeat: kept, excluded, listed. */
  excludedAsRepeat: boolean;
  /** The row checks this row failed. */
  failedChecks: CgRowCheck[];
};

/** A row that is not a lot and holds amounts (design §2.4): never dropped silently. */
export type CgExcludedRow = {
  at: RowRef;
  /** no-sale-date: blank or text in Sale Date; subtotal: a "Total" row that is not the totals row. */
  reason: 'no-sale-date' | 'subtotal';
};

export type CgSkippedRow = { at: RowRef; reason: 'blank-row' | 'repeated-header' | 'no-amounts' };

/** One amount column against the totals row (design §7). */
export type CgReconciliation = {
  field: CgField;
  header: string;
  /** Sum over all lot rows as read (repeats included, excluded lots left out); empty cells count 0. */
  lotSum: number;
  /** The totals row's cell; null when blank (the column is then not reconciled). */
  total: number | null;
  tolerance: number;
  outcome: 'reconciled' | 'mismatch' | 'not-reconciled';
};

/** Declared in model/validation.ts with the analyst question (contracts-2); re-exported so importers do not change. */
export type { CgRepeatAnswer } from '../model/validation.ts';

/** A sale event with repeated rows (design §6). */
export type CgRepeatEvent = {
  id: string;
  financialYear: FinancialYear;
  /** Every distinct row appears the same number of times k > 1. */
  wholly: boolean;
  /** The lot indexes of the event, in file order. */
  lots: number[];
  /** The rows beyond the first of each group of exact repeats. */
  extraLots: number[];
  /** The realised gain those extra rows carry (rupees), for the import report (shown to the analyst, never logged). */
  extraRealised: number;
  answer: CgRepeatAnswer | null;
  answeredBy: 'event' | 'all' | null;
};

/**
 * The analyst question of design §6, one per repeated sale event: the `capital-gains-repeats` member of the model's
 * `AnalystQuestion` union (model/validation.ts `CapitalGainsRepeatsQuestion`; moved there by contracts-2).
 */
export type CgRepeatQuestion = CapitalGainsRepeatsQuestion;

/** A person of the statement (design §9.3): in memory only, never logged. */
export type CgPerson = { clientId: ClientId; label: string; inReview: boolean; lots: number };

/**
 * A person of the statement by PAN ordinal (design §3, §9.3; PD-16 item 3): no PAN, only the ordinal, the client labels
 * its lots carry (distinct after folding letter case and spacing, first spelling kept, in order of first appearance)
 * and their client ids. In memory only, never logged.
 */
export type CgPanPerson = { personNo: number; labels: string[]; clientIds: ClientId[]; lots: number };

/** The person for tax (design §9.3): a PAN ordinal of the file, or the client id of the label when the row has no PAN. */
export type CgTaxPerson = { kind: 'pan'; personNo: number } | { kind: 'label'; clientId: ClientId };

/** A key for grouping lots by person for tax (design §9.3): "person:n" for a PAN ordinal, else the client id. */
export function taxPersonKey(p: CgTaxPerson | null): string | null {
  if (p === null) return null;
  return p.kind === 'pan' ? `person:${p.personNo}` : p.clientId;
}

export type CgColumnUse = { field: CgField; header: string; column: number };

export type CgImport = {
  parserVersion: string;
  sourceId: SourceFileId;
  /** The sheet read and its 1-based header row; null when the file is refused. */
  sheet: { name: string; headerRow: number } | null;
  sheets: SheetAttempt[];
  columns: CgColumnUse[];
  /** Header cells matching no column (scrubbed). */
  ignoredColumns: string[];
  lots: CgLot[];
  excludedRows: CgExcludedRow[];
  skippedRows: CgSkippedRow[];
  /** 1-based row of the totals row, or null. */
  totalsRow: number | null;
  reconciliation: CgReconciliation[];
  footerRows: number;
  pan: { tags: number; tokens: number; footerTokens: number };
  events: CgRepeatEvent[];
  questions: CgRepeatQuestion[];
  persons: CgPerson[];
  /** The persons by PAN ordinal, Person 1..n in order (design §3, §9.3); empty when no lot row has a PAN. */
  panPersons: CgPanPerson[];
  /** Financial years whose realised and taxable totals are INSUFFICIENT EVIDENCE (an unanswered repeat event). */
  insufficientYears: string[];
  issues: ValidationResult[];
  audit: AuditEntry[];
};

export type CgReviewContext = {
  /** The review's clients: id, label as first seen, analyst's display label. */
  clients: ReadonlyArray<{ id: ClientId; label: string; displayLabel?: string | null }>;
  /** The review's family label (`Family.label`); null or empty while unset (then Family Name is not compared). */
  familyLabel: string | null;
};

export type CgOptions = {
  /** SHA-256 of the file (the source register id), computed by the caller. */
  sourceId: SourceFileId;
  /** The review the statement joins. Without it the client and family checks are not run. */
  review?: CgReviewContext;
  /** The analyst's repeats answers (design §6): per event, and "apply to all" for the events not answered. */
  repeatAnswers?: { byEvent?: Readonly<Record<string, CgRepeatAnswer>>; all?: CgRepeatAnswer };
  /** Clock for the audit entries (ISO 8601); defaults to the system clock. */
  now?: () => string;
};

// ---------------------------------------------------------------------------------------------------------------
// Small helpers

class Issues {
  readonly list: ValidationResult[] = [];
  private n = 0;
  add(ruleId: string, severity: Severity, scope: ValidationScope, message: string,
    extra: { count?: number; resolution?: ValidationResult['resolution']; status?: ValidationResult['status'] } = {}): void {
    this.n++;
    const r: ValidationResult = {
      id: `capital-gains.${ruleId}:${this.n}`,
      ruleId: `capital-gains.${ruleId}`,
      scope,
      message,
      severity,
      blocksPublication: severity === 'Blocking',
      resolution: extra.resolution ?? 'none',
      status: extra.status ?? 'open',
      decision: 'D-036',
    };
    if (extra.count !== undefined) r.count = extra.count;
    this.list.push(r);
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function listText(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const NA: CgRead<never> = { kind: 'missing', status: STATUS.NOT_AVAILABLE };
const INVALID: CgRead<never> = { kind: 'missing', status: STATUS.INVALID_SOURCE };

function valueOf<T>(r: CgRead<T>): T | null {
  return r.kind === 'value' ? r.v : null;
}

/** The financial year of a day (design §8). */
export function financialYearOf(day: DayNumber): FinancialYear {
  const { y, m } = dayToYmd(day);
  const start = m >= 4 ? y : y - 1;
  const yy = String((start + 1) % 100).padStart(2, '0');
  return { start, label: start >= 2026 ? `Tax year ${start}-${yy}` : `FY ${start}-${yy}` };
}

/** A date cell: an Excel serial only (design §2.3: a text date is INVALID SOURCE DATA). */
function readDateCell(cell: Cell | undefined, date1904: boolean): CgRead<DayNumber> {
  if (cell === null || cell === undefined) return NA;
  if (cell.t === 'n') {
    const day = excelSerialToDay(cell.v, date1904);
    return day === null ? INVALID : { kind: 'value', v: day };
  }
  if (cell.t === 's' && isPlaceholderOrBlank(cell.v)) return NA;
  return INVALID;
}

function isPlaceholderOrBlank(text: string): boolean {
  const n = readNumber({ t: 's', v: text });
  return n.kind === 'empty' || n.kind === 'placeholder';
}

/**
 * A number cell (money, price, units, days, percent): a number, or numeric text; other text is INVALID. A trailing
 * "%" is accepted only in the percent column (XIRR): "12%" in a money, price, units or days cell is INVALID, never 12.
 */
function readNumCell(cell: Cell | undefined, percentAllowed: boolean): CgRead<number> {
  const n = readNumber(cell);
  if (n.kind === 'number') return n.percentText && !percentAllowed ? INVALID : { kind: 'value', v: n.v };
  if (n.kind === 'invalid') return INVALID;
  return NA;
}

/**
 * A Sale Date cell that marks a lot row (design §2.4): a number with a date number format (Gate B B2). A plain number
 * (a count, or a SUM typed into the first column of a filled template) is not a date: its row is an excluded lot when
 * it holds amounts, never a lot sold in 1900. The platform export and the blank template both format the column as dates.
 */
function isDateLike(cell: Cell | undefined, date1904: boolean): boolean {
  if (cell === null || cell === undefined) return false;
  if (cell.t === 'n') return cell.date && excelSerialToDay(cell.v, date1904) !== null;
  return false;
}

function hasNumber(cell: Cell | undefined): boolean {
  return readNumber(cell).kind === 'number';
}

/** The tolerance of the amount checks (design §4): ₹1 or 0.01% of the amount, the larger. */
export function amountTolerance(amount: number): number {
  return Math.max(1, Math.abs(amount) * 0.0001);
}

/** The tolerance of the totals reconciliation (design §7): ₹1 plus ₹0.005 per lot row summed. */
export function totalsTolerance(lotRows: number): number {
  return 1 + 0.005 * lotRows;
}

// ---------------------------------------------------------------------------------------------------------------
// Header (design §2.1, §2.2)

type HeaderMap = {
  /** Field to its 0-based column. */
  cols: Map<CgField, number>;
  /** Fields matched by more than one cell. */
  duplicates: CgField[];
  /** Header cells matching no field (text as written, trimmed). */
  ignored: string[];
  labels: string[];
};

function mapHeader(row: Cell[]): HeaderMap {
  const cols = new Map<CgField, number>();
  const dup = new Set<CgField>();
  const ignored: string[] = [];
  const labels: string[] = [];
  row.forEach((cell, j) => {
    const text = cellText(cell);
    labels[j] = text;
    if (text === '') return;
    const f = fieldOfHeader(text);
    if (f === null) { ignored.push(text); return; }
    if (cols.has(f)) dup.add(f);
    else cols.set(f, j);
  });
  return { cols, duplicates: [...dup], ignored, labels };
}

/** The required columns (design §2.3) missing from a header map, as the export names them. */
function missingRequired(cols: ReadonlyMap<CgField, number>): string[] {
  const out: string[] = [];
  for (const c of CG_COLUMNS) if (c.required === 'yes' && !cols.has(c.field)) out.push(c.header);
  if (!cols.has('accountName') && !cols.has('clientName')) out.push('Account Name or Client Name');
  if (!cols.has('categoryName') && !cols.has('assetName')) out.push('Category Name or Asset Name');
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Instrument tag and Account Name (design §2.3 row 2, §2.5)

const TAG_RE = /\s*\[\s*folio\s*no\s*:\s*([^|\]]*?)\s*(?:\|\|\s*asset\s*:\s*([^\]]*?)\s*)?\]\s*$/i;

/** The scheme label, folio and tag asset of an Instrument Name (design §2.5). */
export function parseInstrument(text: string): { schemeLabel: string; folio: string | null; tagAsset: string | null } {
  const t = text.replace(/\s+/g, ' ').trim();
  const m = TAG_RE.exec(t);
  if (!m) return { schemeLabel: t, folio: null, tagAsset: null };
  const folio = (m[1] ?? '').trim();
  const asset = (m[2] ?? '').trim();
  return { schemeLabel: t.slice(0, m.index).trim(), folio: folio === '' ? null : folio, tagAsset: asset === '' ? null : asset };
}

/** Account Name, its PAN tag already removed, split at its last " - " (design §2.3 row 2). */
export function splitAccountName(text: string): { accountLabel: string | null; accountNote: string } {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t === '') return { accountLabel: null, accountNote: '' };
  const at = t.lastIndexOf(' - ');
  if (at < 0) return { accountLabel: t, accountNote: '' };
  const label = t.slice(0, at).trim();
  return { accountLabel: label === '' ? null : label, accountNote: t.slice(at + 3).trim() };
}

// ---------------------------------------------------------------------------------------------------------------
// "Possibly one person" (design §11 person-ambiguous)

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'dr', 'shri', 'smt']);

function personWords(label: string): string[] {
  const words = label.toLowerCase().replace(/\s+/g, ' ').trim().split(' ').filter((w) => w !== '');
  if (words.length > 1 && HONORIFICS.has(words[0]!.replace(/\.$/, ''))) words.shift();
  return words.map((w) => (w.length === 2 && w.endsWith('.') ? w.slice(0, 1) : w));
}

function wordsPair(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 1 && b.length > 1) return b.startsWith(a);
  if (b.length === 1 && a.length > 1) return a.startsWith(b);
  return false;
}

/**
 * True when two different labels are possibly one person (design §11): after folding case and spacing and dropping a
 * leading honorific, their words pair up in order, a one-letter word pairing with any word starting with that letter;
 * one label (only one) may carry extra one-letter words; two different one-letter words never pair.
 */
export function possiblyOnePerson(x: string, y: string): boolean {
  if (x.replace(/\s+/g, ' ').trim() === y.replace(/\s+/g, ' ').trim()) return false;
  const a = personWords(x);
  const b = personWords(y);
  const go = (i: number, j: number, extra: 'a' | 'b' | null): boolean => {
    if (i === a.length && j === b.length) return true;
    if (i < a.length && j < b.length && wordsPair(a[i]!, b[j]!) && go(i + 1, j + 1, extra)) return true;
    if (i < a.length && a[i]!.length === 1 && extra !== 'b' && go(i + 1, j, 'a')) return true;
    if (j < b.length && b[j]!.length === 1 && extra !== 'a' && go(i, j + 1, 'b')) return true;
    return false;
  };
  return a.length > 0 && b.length > 0 && go(0, 0, null);
}

// ---------------------------------------------------------------------------------------------------------------
// The reader

/** Reads a capital-gains statement (the platform export or the filled blank template). */
export function parseCapitalGains(wb: Workbook, opts: CgOptions): CgImport {
  const now = opts.now ?? ((): string => new Date().toISOString());
  const sourceId = opts.sourceId;
  const issues = new Issues();
  const fileScope: ValidationScope = { kind: 'file', sourceId };
  const attempts: SheetAttempt[] = [];
  const pan = { tags: 0, tokens: 0, footerTokens: 0 };

  // 1. The sheet: the first whose header row, in its first 5 rows, holds every required column (design §2.1).
  // Sheet names are scrubbed like cells: a name is kept in the import record.
  let chosen: { sheet: Sheet; name: string; headerIndex: number; header: HeaderMap } | null = null;
  let best: { name: string; missing: string[] } | null = null;
  for (const sheet of wb.sheets) {
    const nm = scrubText(sheet.name);
    pan.tags += nm.tags;
    pan.tokens += nm.tokens;
    if (chosen) { attempts.push({ sheet: nm.text, outcome: 'not-needed', headerRow: null }); continue; }
    let found = -1;
    let foundMap: HeaderMap | null = null;
    const n = Math.min(sheet.rows.length, CG_HEADER_SCAN_ROWS);
    for (let i = 0; i < n; i++) {
      const map = mapHeader(scrubRows([sheet.rows[i] ?? []]).rows[0]!);
      const miss = missingRequired(map.cols);
      if (miss.length === 0) { found = i; foundMap = map; break; }
      if (best === null || miss.length < best.missing.length) best = { name: nm.text, missing: miss };
    }
    if (found < 0 || foundMap === null) { attempts.push({ sheet: nm.text, outcome: 'no-header', headerRow: null }); continue; }
    chosen = { sheet, name: nm.text, headerIndex: found, header: foundMap };
    attempts.push({ sheet: nm.text, outcome: 'used', headerRow: found + 1 });
  }

  const refused = (): CgImport => {
    const out: CgImport = {
      parserVersion: CG_PARSER_VERSION, sourceId, sheet: chosen ? { name: chosen.name, headerRow: chosen.headerIndex + 1 } : null,
      sheets: attempts, columns: [], ignoredColumns: [], lots: [], excludedRows: [], skippedRows: [], totalsRow: null,
      reconciliation: [], footerRows: 0, pan, events: [], questions: [], persons: [], panPersons: [], insufficientYears: [],
      issues: issues.list, audit: [],
    };
    out.audit.push(importAudit(now, sourceId, out));
    return out;
  };

  if (!chosen) {
    const missingCols = best ? best.missing : missingRequired(new Map());
    issues.add('no-header', 'Blocking', fileScope,
      `No sheet has the required columns of a capital-gains statement in its first ${CG_HEADER_SCAN_ROWS} rows. Missing from the closest sheet: ${listText(missingCols)}.`,
      { count: missingCols.length });
    return refused();
  }

  const { sheet, name: sheetName, headerIndex, header } = chosen;
  const sheetScope: ValidationScope = { kind: 'sheet', sourceId, sheet: sheetName };
  const at = (r: number): RowRef => ({ sourceId, sheet: sheetName, row: r + 1 });
  const cols = header.cols;
  const columns: CgColumnUse[] = [...cols.entries()]
    .map(([field, column]) => ({ field, header: header.labels[column] ?? '', column }))
    .sort((a, b) => a.column - b.column);

  if (header.duplicates.length > 0) {
    issues.add('duplicate-column', 'Blocking', sheetScope,
      `Two header cells name the same column: ${listText(header.duplicates.map((f) => cgColumn(f).header))}. Keep one of each and load the file again.`,
      { count: header.duplicates.length });
    return refused();
  }

  // 2. Scrub every row of the sheet before any cell is kept (design §3).
  const scrubbed = scrubRows(sheet.rows);
  const rows = scrubbed.rows;
  const cell = (r: number, f: CgField): Cell | undefined => {
    const j = cols.get(f);
    return j === undefined ? undefined : rows[r]?.[j];
  };
  const text = (r: number, f: CgField): string | null => {
    const t = cellText(cell(r, f));
    return t === '' ? null : t;
  };

  const otherSheets = attempts.filter((a) => a.outcome !== 'used').map((a) => a.sheet);
  issues.add('sheet-used', 'Information', sheetScope,
    `The statement was read from the sheet "${sheetName}", with its header in row ${headerIndex + 1}.${otherSheets.length ? ` ${plural(otherSheets.length, 'other sheet was', 'other sheets were')} ignored: ${listText(otherSheets.map((s) => `"${s}"`))}.` : ''}`,
    { resolution: 'auto-resolved', status: 'resolved' });
  if (header.ignored.length > 0) {
    issues.add('columns-ignored', 'Information', sheetScope,
      `${plural(header.ignored.length, 'column is', 'columns are')} not used: ${listText(header.ignored.map((h) => `"${h}"`))}.`,
      { count: header.ignored.length, resolution: 'auto-resolved', status: 'resolved' });
  }
  if (cols.has('xirr')) {
    issues.add('xirr-not-used', 'Information', { kind: 'column', sourceId, sheet: sheetName, column: header.labels[cols.get('xirr')!] ?? 'XIRR (%)' },
      'The lot XIRR column is not used anywhere.', { resolution: 'auto-resolved', status: 'resolved' });
  }

  // 3. Rows (design §2.4). The footer is counted to the sheet's last used row: a merged text block reaches below its
  // last written cell, so a `lastRow` (0-based, from the sheet's used range) is honoured when the workbook reader gives
  // one (requested of MOD-03 for ingest/workbook.ts, PLAN-01 D7); without it the count stops at the last written row.
  const lastUsed = Math.max(rows.length - 1, (sheet as Sheet & { lastRow?: number }).lastRow ?? -1);
  const lotRowIdx: number[] = [];
  for (let r = headerIndex + 1; r <= lastUsed; r++) {
    if (isDateLike(cell(r, 'saleDate'), wb.date1904)) lotRowIdx.push(r);
  }
  const lastLot = lotRowIdx.length ? lotRowIdx[lotRowIdx.length - 1]! : headerIndex;
  const lotSet = new Set(lotRowIdx);
  const skipped: CgSkippedRow[] = [];
  const excluded: CgExcludedRow[] = [];
  const hasAmount = (r: number): boolean =>
    hasNumber(cell(r, 'sellAmount')) || hasNumber(cell(r, 'investedValue')) || hasNumber(cell(r, 'realisedGL'));
  const isBlank = (r: number): boolean => (rows[r] ?? []).every((c) => cellText(c) === '');
  const isRepeatedHeader = (r: number): boolean => missingRequired(mapHeader(rows[r] ?? []).cols).length === 0;

  for (let r = headerIndex + 1; r < lastLot; r++) {
    if (lotSet.has(r)) continue;
    if (isBlank(r)) skipped.push({ at: at(r), reason: 'blank-row' });
    else if (isRepeatedHeader(r)) skipped.push({ at: at(r), reason: 'repeated-header' });
    else if (hasAmount(r)) excluded.push({ at: at(r), reason: 'no-sale-date' });
    else skipped.push({ at: at(r), reason: 'no-amounts' });
  }

  // After the last lot row: the totals row, subtotals, excluded lots and the footer.
  const firstCellText = (r: number): string => {
    for (const c of rows[r] ?? []) { const t = cellText(c); if (t !== '') return t; }
    return '';
  };
  const moneyFields = CG_COLUMNS.filter((c) => c.kind === 'money').map((c) => c.field);
  const totalsCandidates: Array<{ r: number; grand: boolean }> = [];
  for (let r = lastLot + 1; r <= lastUsed; r++) {
    const first = firstCellText(r).toLowerCase().replace(/\s+/g, ' ');
    if (first !== 'grand total' && first !== 'total') continue;
    if (isDateLike(cell(r, 'saleDate'), wb.date1904)) continue;
    if (!moneyFields.some((f) => hasNumber(cell(r, f)))) continue;
    totalsCandidates.push({ r, grand: first === 'grand total' });
  }
  const totalsPick = totalsCandidates.find((c) => c.grand) ?? totalsCandidates[0] ?? null;
  const totalsIdx = totalsPick ? totalsPick.r : -1;
  let footerRows = 0;
  if (lotRowIdx.length > 0) {
    for (let r = lastLot + 1; r <= lastUsed; r++) {
      if (r === totalsIdx) continue;
      if (totalsCandidates.some((c) => c.r === r)) { excluded.push({ at: at(r), reason: 'subtotal' }); continue; }
      if (hasAmount(r)) { excluded.push({ at: at(r), reason: 'no-sale-date' }); continue; }
      footerRows++;
      pan.footerTokens += (scrubbed.tags[r] ?? 0) + (scrubbed.tokens[r] ?? 0);
    }
  }
  // Every removal outside the footer counts as a cell removal (the header, title rows, lots, excluded rows, totals).
  for (let r = 0; r <= lastUsed; r++) {
    const inFooter = lotRowIdx.length > 0 && r > lastLot && r !== totalsIdx && !excluded.some((e) => e.at.row === r + 1);
    if (inFooter) continue;
    pan.tags += scrubbed.tags[r] ?? 0;
    pan.tokens += scrubbed.tokens[r] ?? 0;
  }
  excluded.sort((a, b) => a.at.row - b.at.row);

  if (lotRowIdx.length === 0) {
    issues.add('no-lots', 'Blocking', sheetScope,
      `The sheet "${sheetName}" has the statement's header but no lot row: no Sale Date cell holds a date (text, and a number without a date format, are not dates).`);
    panIssue(issues, sheetScope, pan);
    const out = refused();
    out.columns = columns;
    out.ignoredColumns = header.ignored;
    out.excludedRows = excluded;
    out.skippedRows = skipped;
    return out;
  }

  // 4. Lots (design §4).
  const review = opts.review;
  // Joining a lot to a review client (Gate B B1, D-039): the label as spelt (spaces collapsed) first, as the base file
  // keys its clients, so two review clients that differ only in letter case stay two; a case-insensitive match only
  // when it names exactly one review client; two or more case variants leave the lot unmatched and are reported.
  const spelt = (s: string): string => s.replace(/\s+/g, ' ').trim();
  const reviewExact = new Map<string, ClientId>();
  const reviewFolded = new Map<string, Set<ClientId>>();
  if (review) {
    for (const c of review.clients) {
      for (const l of [c.label, c.displayLabel ?? null]) {
        if (!l) continue;
        if (!reviewExact.has(spelt(l))) reviewExact.set(spelt(l), c.id);
        const f = normaliseLabel(l);
        const s = reviewFolded.get(f) ?? new Set<ClientId>();
        s.add(c.id);
        reviewFolded.set(f, s);
      }
    }
  }
  let caseAmbiguousLots = 0;
  const matchReview = (label: string): ClientId | undefined => {
    const exact = reviewExact.get(spelt(label));
    if (exact !== undefined) return exact;
    const folded = reviewFolded.get(normaliseLabel(label));
    if (folded && folded.size === 1) return [...folded][0]!;
    if (folded && folded.size > 1) caseAmbiguousLots++;
    return undefined;
  };
  const clientIdOf = idFactory<'client'>('cl');
  const distIdOf = idFactory<'distributor'>('ds');
  const accountIdOf = idFactory<'account'>('ac');
  const eventIdOf = idFactory<'event'>('cgev');
  const persons = new Map<string, CgPerson>();
  const invalidCells = new Map<string, number>();
  let derivedSale = 0;
  let derivedPurchase = 0;
  let nonzeroPI = 0;
  let tagDiffers = 0;
  // R1 (MOD-04, 25 Nov 2026; design §11 `required-cell-blank`): the rows whose required cell is blank (or a
  // placeholder), per column; an invalid cell is reported by invalid-cells instead.
  const blankRequired = new Map<CgField, RowRef[]>();
  const noteBlank = (f: CgField, v: CgRead<number>, r: number): void => {
    if (v.kind === 'missing' && v.status === STATUS.NOT_AVAILABLE) {
      const l = blankRequired.get(f) ?? [];
      l.push(at(r));
      blankRequired.set(f, l);
    }
  };
  const checkCounts = new Map<CgRowCheck, number>();
  const date1904 = wb.date1904;
  // Persons by PAN ordinal (design §3, §9.3; PD-16 item 3), numbered on the raw rows before any lot is built; only the
  // ordinals come back. The labels seen under each ordinal, and the lots without a PAN, are kept for the Warnings.
  const personNos = numberPersons(sheet.rows, lotRowIdx, cols.get('accountName'));
  const panPersons = new Map<number, { labels: Map<string, string>; clientIds: Set<ClientId>; lots: number[] }>();
  const labelOrdinals = new Map<string, { label: string; ordinals: Set<number>; lots: number[] }>();
  const clientsWithoutPan = new Set<ClientId>();

  const readField = (r: number, f: CgField): CgRead<number> => {
    const kind = cgColumn(f).kind;
    if (!cols.has(f)) return NA;
    const v = kind === 'date' ? readDateCell(cell(r, f), date1904) : readNumCell(cell(r, f), kind === 'pct');
    if (v.kind === 'missing' && v.status === STATUS.INVALID_SOURCE) {
      const h = header.labels[cols.get(f)!] ?? cgColumn(f).header;
      invalidCells.set(h, (invalidCells.get(h) ?? 0) + 1);
    }
    return v;
  };

  const lots: CgLot[] = lotRowIdx.map((r, index) => {
    const saleDate = excelSerialToDay((cell(r, 'saleDate') as { v: number }).v, date1904)!;
    const purchaseDate = readField(r, 'purchaseDate');
    const units = readField(r, 'saleUnit');
    const saleValue = readField(r, 'sellAmount');
    const purchaseValue = readField(r, 'investedValue');
    const statedSale = readField(r, 'salePrice');
    const statedPurchase = readField(r, 'purchasePrice');
    noteBlank('purchaseDate', purchaseDate, r);
    noteBlank('saleUnit', units, r);
    noteBlank('sellAmount', saleValue, r);
    noteBlank('investedValue', purchaseValue, r);
    const u = valueOf(units);
    const derive = (stated: CgRead<number>, amount: CgRead<number>): { v: CgRead<number>; derived: boolean } => {
      if (stated.kind === 'value' || stated.status === STATUS.INVALID_SOURCE) return { v: stated, derived: false };
      const a = valueOf(amount);
      if (u !== null && u > 0 && a !== null) return { v: { kind: 'value', v: a / u }, derived: true };
      return { v: NA, derived: false };
    };
    const sp = derive(statedSale, saleValue);
    const pp = derive(statedPurchase, purchaseValue);
    if (sp.derived) derivedSale++;
    if (pp.derived) derivedPurchase++;
    const sv = valueOf(saleValue);
    const pv = valueOf(purchaseValue);
    const realised: CgRead<number> = sv !== null && pv !== null ? { kind: 'value', v: sv - pv } : NA;

    const statement: CgStatementCells = {
      realised: readField(r, 'realisedGL'),
      ltcg: readField(r, 'ltcg'),
      stcg: readField(r, 'stcg'),
      acquisitionDate: readField(r, 'acquisitionDate'),
      acquisitionPrice: readField(r, 'acquisitionPrice'),
      holdingDays: readField(r, 'holdingTerms'),
      principalRepayment: readField(r, 'principalRepayment'),
      interest: readField(r, 'interestEarned'),
      tax: {
        preTax: readField(r, 'preTaxGL'),
        tax: readField(r, 'taxAmount'),
        surcharge: readField(r, 'surcharge'),
        cess: readField(r, 'cess'),
        total: readField(r, 'totalTax'),
        postTax: readField(r, 'postTaxGL'),
      },
    };
    if (cols.has('xirr')) readField(r, 'xirr');

    // Row checks (design §4): each runs only when every cell it reads holds a value; a derived price is not checked.
    const failed: CgRowCheck[] = [];
    const pd = valueOf(purchaseDate);
    const hd = valueOf(statement.holdingDays);
    if (pd !== null && hd !== null && hd !== saleDate - pd) failed.push('holding-days');
    const ssp = valueOf(statedSale);
    if (u !== null && ssp !== null && sv !== null && Math.abs(u * ssp - sv) > amountTolerance(sv)) failed.push('sale-amount');
    const spp = valueOf(statedPurchase);
    if (u !== null && spp !== null && pv !== null && Math.abs(u * spp - pv) > amountTolerance(pv)) failed.push('invested-value');
    const sr = valueOf(statement.realised);
    if (sv !== null && pv !== null && sr !== null && Math.abs(sv - pv - sr) > amountTolerance(sv)) failed.push('realised');
    if (pd !== null && pd > saleDate) failed.push('date-order');
    // A blank Sale Unit fails this check too (R1): the lot has no units, so it cannot be above 0.
    if ((u !== null && !(u > 0)) || (units.kind === 'missing' && units.status === STATUS.NOT_AVAILABLE)) failed.push('units-positive');
    for (const c of failed) checkCounts.set(c, (checkCounts.get(c) ?? 0) + 1);

    const prin = valueOf(statement.principalRepayment);
    const intr = valueOf(statement.interest);
    if ((prin !== null && prin !== 0) || (intr !== null && intr !== 0)) nonzeroPI++;

    // Names, scheme and folio.
    const acct = splitAccountName(text(r, 'accountName') ?? '');
    const clientLabel = text(r, 'clientName') ?? acct.accountLabel;
    let clientId: ClientId | null = null;
    let inReview = false;
    if (clientLabel !== null) {
      const matched = matchReview(clientLabel);
      clientId = matched ?? clientIdOf(clientLabel);
      inReview = matched !== undefined;
      const p = persons.get(clientId);
      if (p) p.lots++;
      else persons.set(clientId, { clientId, label: clientLabel, inReview, lots: 1 });
    }
    const personNo = personNos[index] ?? null;
    if (personNo !== null) {
      const pp = panPersons.get(personNo) ?? { labels: new Map<string, string>(), clientIds: new Set<ClientId>(), lots: [] };
      pp.lots.push(index);
      if (clientLabel !== null) {
        const folded = normaliseLabel(clientLabel);
        if (!pp.labels.has(folded)) pp.labels.set(folded, clientLabel);
        const lo = labelOrdinals.get(folded) ?? { label: clientLabel, ordinals: new Set<number>(), lots: [] };
        lo.ordinals.add(personNo);
        lo.lots.push(index);
        labelOrdinals.set(folded, lo);
      }
      if (clientId !== null) pp.clientIds.add(clientId);
      panPersons.set(personNo, pp);
    } else if (clientId !== null) {
      clientsWithoutPan.add(clientId);
    }
    const taxPerson: CgTaxPerson | null = personNo !== null ? { kind: 'pan', personNo }
      : clientId !== null ? { kind: 'label', clientId } : null;
    const distLabel = text(r, 'distributorName');
    const distributorId = distLabel === null ? null : distIdOf(distLabel);
    const accountId = accountIdOf(keyOf([clientId, distributorId]));
    const inst = parseInstrument(text(r, 'instrumentName') ?? '');
    const folio = text(r, 'folioNumber') ?? inst.folio;
    const statementAsset = text(r, 'assetName');
    if (inst.tagAsset !== null && statementAsset !== null && normaliseLabel(inst.tagAsset) !== normaliseLabel(statementAsset)) tagDiffers++;
    const eventId = eventIdOf(keyOf([accountId, inst.schemeLabel, folio, String(saleDate)]));

    return {
      index, at: at(r), saleDate, financialYear: financialYearOf(saleDate), purchaseDate, units, saleValue,
      purchaseValue, salePrice: sp.v, salePriceDerived: sp.derived, purchasePrice: pp.v, purchasePriceDerived: pp.derived,
      realised, clientId, inReview, personNo, taxPerson, accountId, distributorId, accountLabel: acct.accountLabel, accountNote: acct.accountNote,
      schemeLabel: inst.schemeLabel, folio, tagAsset: inst.tagAsset, category: text(r, 'categoryName'), statementAsset,
      statement, eventId, duplicateOf: null, excludedAsRepeat: false, failedChecks: failed,
    };
  });

  // 5. Repeated rows by sale event (design §6). Two rows repeat when every cell of the row, as read, is equal.
  const signature = (r: number): string => JSON.stringify((rows[r] ?? []).map((c) => (c === null || c === undefined ? null : [c.t, c.v])));
  const byEvent = new Map<string, number[]>();
  for (const lot of lots) {
    const list = byEvent.get(lot.eventId);
    if (list) list.push(lot.index);
    else byEvent.set(lot.eventId, [lot.index]);
  }
  const answers = opts.repeatAnswers ?? {};
  const events: CgRepeatEvent[] = [];
  const questions: CgRepeatQuestion[] = [];
  const audit: AuditEntry[] = [];
  for (const [eventId, members] of byEvent) {
    const groups = new Map<string, number[]>();
    for (const i of members) {
      const sig = signature(lotRowIdx[i]!);
      const g = groups.get(sig);
      if (g) g.push(i);
      else groups.set(sig, [i]);
    }
    const sizes = [...groups.values()].map((g) => g.length);
    if (!sizes.some((k) => k > 1)) continue;
    const extraLots: number[] = [];
    for (const g of groups.values()) {
      for (const i of g.slice(1)) { lots[i]!.duplicateOf = g[0]!; extraLots.push(i); }
    }
    extraLots.sort((a, b) => a - b);
    const wholly = sizes.every((k) => k === sizes[0]) && sizes[0]! > 1;
    const fy = lots[members[0]!]!.financialYear;
    const extraRealised = extraLots.reduce((s, i) => s + (valueOf(lots[i]!.realised) ?? 0), 0);
    const own = answers.byEvent && Object.prototype.hasOwnProperty.call(answers.byEvent, eventId) ? answers.byEvent[eventId]! : null;
    const answer: CgRepeatAnswer | null = own ?? answers.all ?? null;
    const answeredBy = own ? 'event' : answer ? 'all' : null;
    events.push({ id: eventId, financialYear: fy, wholly, lots: members, extraLots, extraRealised, answer, answeredBy });
    if (answer === 'once') for (const i of extraLots) lots[i]!.excludedAsRepeat = true;
    if (answer === null) {
      questions.push({
        id: `capital-gains-repeats:${eventId}`, kind: 'capital-gains-repeats', eventId, options: ['as-stated', 'once'],
        prompt: `A sale in ${fy.label} appears with ${plural(extraLots.length, 'repeated row', 'repeated rows')} (${wholly ? 'the whole sale repeated' : 'some lots repeated'}). Count its repeated rows as stated, or once?`,
        evidence: { rows: members.length, extraRows: extraLots.length, wholly, financialYear: fy.label },
      });
    } else {
      audit.push({
        id: `audit:${audit.length + 2}`, at: now(), kind: 'validation-decision', sourceId,
        summary: 'The analyst answered a repeated-rows question of the capital-gains statement (design section 6).',
        detail: { event: eventId, answer, via: answeredBy, rows: members.length, extraRows: extraLots.length, financialYear: fy.label },
      });
    }
  }
  const insufficientYears = [...new Set(events.filter((e) => e.answer === null).map((e) => e.financialYear.label))].sort();

  // 6. Reconciliation with the totals row (design §7), over every lot row as read.
  const reconciliation: CgReconciliation[] = [];
  if (totalsIdx >= 0) {
    for (const f of CG_RECONCILED) {
      if (!cols.has(f)) continue;
      let sum = 0;
      // A lot cell that is not a valid amount counts 0 (it is reported as invalid-cells); a totals cell that is not a
      // valid amount leaves the column not reconciled.
      for (const r of lotRowIdx) { const x = readNumCell(cell(r, f), false); if (x.kind === 'value') sum += x.v; }
      const t = readNumCell(cell(totalsIdx, f), false);
      const total = t.kind === 'value' ? t.v : null;
      const tolerance = totalsTolerance(lotRowIdx.length);
      const outcome = total === null ? 'not-reconciled' : Math.abs(sum - total) <= tolerance ? 'reconciled' : 'mismatch';
      reconciliation.push({ field: f, header: header.labels[cols.get(f)!] ?? cgColumn(f).header, lotSum: sum, total, tolerance, outcome });
    }
  }

  // 7. Validation results (design §11), in the order of its table.
  if (questions.length > 0) {
    issues.add('repeats-question', 'High', sheetScope,
      `${plural(questions.length, 'sale has', 'sales have')} repeated rows. Answer each: count its repeated rows as stated, or once. Until then the realised and taxable totals of ${listText(insufficientYears)} are ${STATUS.INSUFFICIENT_EVIDENCE}.`,
      { count: questions.length, resolution: 'analyst-decision' });
  }
  const mismatches = reconciliation.filter((x) => x.outcome === 'mismatch');
  if (mismatches.length > 0) {
    const invalidAmounts = [...invalidCells.values()].reduce((s, n) => s + n, 0);
    const ex = (excluded.length ? ` ${plural(excluded.length, 'row was', 'rows were')} excluded as not a lot (rows ${excluded.map((e) => e.at.row).join(', ')}), a possible cause.` : '')
      + (invalidAmounts > 0 ? ` ${plural(invalidAmounts, 'lot cell is', 'lot cells are')} not a valid date or number and ${invalidAmounts === 1 ? 'counts' : 'count'} as 0, a possible cause.` : '');
    issues.add('totals-mismatch', 'High', sheetScope,
      `The lot rows do not add up to the statement's totals row in ${listText(mismatches.map((m) => `"${m.header}" (a difference of Rs ${(m.lotSum - (m.total ?? 0)).toFixed(2)})`))}.${ex}`,
      { count: mismatches.length });
  }
  if (review) {
    // A lot with neither Client Name nor Account Name has no person: it matches no client of the review and is counted
    // here too, named apart (financial-domain review of 7e9e51d, item 4; whether it deserves its own id is an owner
    // question, NB-03 GATE-A-M7a-01).
    const lotsOut = lots.filter((l) => !l.inReview).length;
    const noLabel = lots.filter((l) => l.clientId === null).length;
    const lotsIn = lots.length - lotsOut;
    if (lotsOut > 0) {
      const outPersons = [...persons.values()].filter((p) => !p.inReview).length;
      const tail = (noLabel > 0 ? ` ${plural(noLabel, 'lot has', 'lots have')} no client label at all (Client Name and Account Name blank) and no person.` : '')
        + (caseAmbiguousLots > 0 ? ` ${plural(caseAmbiguousLots, 'lot matches', 'lots match')} two or more clients of the review whose labels differ only in letter case, so ${caseAmbiguousLots === 1 ? 'it is' : 'they are'} left unmatched.` : '');
      issues.add('clients-unmatched', lotsIn === 0 ? 'High' : 'Warning', sheetScope,
        (lotsIn === 0
          ? `No lot's client matches a client of the review (${plural(outPersons, 'person', 'persons')}, ${plural(lotsOut, 'lot', 'lots')}): the statement may belong to another family. Each is computed as its own person, never added to the family sum.`
          : `${plural(lotsOut, 'lot belongs', 'lots belong')} to ${plural(outPersons, 'person', 'persons')} who match no client of the review. They are computed separately, listed under clients not in the review, and never added to the family sum.`) + tail,
        { count: lotsOut });
    }
    const fam = review.familyLabel;
    if (fam !== null && fam.trim() !== '' && cols.has('familyName')) {
      const target = normaliseLabel(fam);
      const differing = lotRowIdx.filter((r) => { const t = text(r, 'familyName'); return t !== null && normaliseLabel(t) !== target; }).length;
      if (differing > 0) {
        issues.add('family-differs', 'Warning', sheetScope,
          `The Family Name column of ${plural(differing, 'lot', 'lots')} names a family other than the review's.`, { count: differing });
      }
    }
  }
  const exNoDate = excluded.length;
  if (exNoDate > 0) {
    issues.add('row-without-sale-date', 'Warning', { kind: 'rows', sourceId, rows: excluded.map((e) => e.at) },
      `${plural(exNoDate, 'row holds', 'rows hold')} amounts but no date in Sale Date (blank, text, or a number without a date format; rows ${excluded.map((e) => e.at.row).join(', ')}); ${exNoDate === 1 ? 'it is' : 'they are'} excluded and listed.`,
      { count: exNoDate });
  }
  const invalidTotal = [...invalidCells.values()].reduce((s, n) => s + n, 0);
  if (invalidTotal > 0) {
    issues.add('invalid-cells', 'Warning', sheetScope,
      `${plural(invalidTotal, 'cell is', 'cells are')} not a valid date or number and ${invalidTotal === 1 ? 'is' : 'are'} read as ${STATUS.INVALID_SOURCE}: ${listText([...invalidCells.entries()].map(([h, n]) => `"${h}" (${n})`))}.`,
      { count: invalidTotal });
  }
  for (const c of CG_ROW_CHECKS) {
    const n = checkCounts.get(c) ?? 0;
    if (n === 0) continue;
    issues.add('row-check-failed', 'Warning', { kind: 'rows', sourceId, rows: lots.filter((l) => l.failedChecks.includes(c)).map((l) => l.at) },
      `The check "${CHECK_NAMES[c]}" failed on ${plural(n, 'lot', 'lots')}; ${n === 1 ? 'it is' : 'they are'} kept with the stated values and flagged.`,
      { count: n });
  }
  for (const f of ['purchaseDate', 'saleUnit', 'sellAmount', 'investedValue'] as const) {
    const rowsBlank = blankRequired.get(f);
    if (!rowsBlank || rowsBlank.length === 0) continue;
    const h = header.labels[cols.get(f)!] ?? cgColumn(f).header;
    issues.add('required-cell-blank', 'Warning', { kind: 'rows', sourceId, rows: rowsBlank },
      `The required column "${h}" is blank on ${plural(rowsBlank.length, 'lot', 'lots')} (rows ${rowsBlank.map((x) => x.row).join(', ')}); ${rowsBlank.length === 1 ? 'its value is' : 'their values are'} ${STATUS.NOT_AVAILABLE}, never 0.`,
      { count: rowsBlank.length });
  }
  if (nonzeroPI > 0) {
    issues.add('nonzero-principal-or-interest', 'Warning', sheetScope,
      `${plural(nonzeroPI, 'mutual-fund lot has', 'mutual-fund lots have')} a Principal Repayment or Interest Earned other than 0.`, { count: nonzeroPI });
  }
  if (tagDiffers > 0) {
    issues.add('tag-asset-differs', 'Warning', sheetScope,
      `The asset in the instrument tag differs from Asset Name on ${plural(tagDiffers, 'lot', 'lots')}.`, { count: tagDiffers });
  }
  // person-ambiguous (design §9.3, §11) only for lots without a PAN: a pair is tested when at least one of its labels
  // belongs to a person with a lot whose row has no PAN (two labels under PANs are decided by the PANs). In a file
  // without PANs every label qualifies, as before PD-16 item 3.
  const allLabels = [...persons.values()].map((p) => p.label);
  const labels = [...persons.values()].filter((p) => clientsWithoutPan.has(p.clientId)).map((p) => p.label);
  const reviewLabels = review ? review.clients.map((c) => c.label) : [];
  const pairs = new Set<string>();
  const all = [...new Set([...allLabels, ...reviewLabels])];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]!;
      const b = all[j]!;
      if (!labels.includes(a) && !labels.includes(b)) continue;
      if (possiblyOnePerson(a, b)) pairs.add(keyOf([a, b]));
    }
  }
  // A label on lots without a PAN that is also the label of a PAN ordinal (letter case and spacing folded) may be that
  // person or another: a pair too, never joined silently.
  for (const p of persons.values()) {
    if (!clientsWithoutPan.has(p.clientId)) continue;
    const lo = labelOrdinals.get(normaliseLabel(p.label));
    if (lo) for (const n of lo.ordinals) pairs.add(keyOf([p.label, `Person ${n}`]));
  }
  if (pairs.size > 0) {
    issues.add('person-ambiguous', 'Warning', sheetScope,
      `${plural(pairs.size, 'pair of client labels is', 'pairs of client labels are')} possibly one person; ${pairs.size === 1 ? 'it is' : 'they are'} computed separately until the analyst says otherwise.`,
      { count: pairs.size });
  }
  // The person by PAN (design §9.3; PD-16 item 3). Messages name the client labels and the ordinals, never a PAN, a
  // folio or an amount.
  const lotRows = (idx: readonly number[]): RowRef[] => idx.map((i) => lots[i]!.at);
  for (const [personNo, pp] of [...panPersons.entries()].sort((x, y) => x[0] - y[0])) {
    if (pp.labels.size < 2) continue;
    const named = [...pp.labels.values()];
    issues.add('person-labels-differ', 'Warning', { kind: 'rows', sourceId, rows: lotRows(pp.lots) },
      `One PAN, Person ${personNo} of this statement, appears under ${named.length} client labels: ${listText(named.map((l) => `"${l}"`))}. Its lots are computed as one person, sharing one exemption.`,
      { count: named.length });
  }
  for (const lo of labelOrdinals.values()) {
    if (lo.ordinals.size < 2) continue;
    const ordinals = [...lo.ordinals].sort((x, y) => x - y);
    issues.add('person-split', 'Warning', { kind: 'rows', sourceId, rows: lotRows(lo.lots) },
      `The client label "${lo.label}" carries ${ordinals.length} different PANs in this statement: ${listText(ordinals.map((n) => `Person ${n}`))}. They are computed as ${ordinals.length} persons.`,
      { count: ordinals.length });
  }
  panIssue(issues, sheetScope, pan);
  const skippedCount = skipped.length;
  if (skippedCount > 0) {
    issues.add('rows-skipped', 'Information', { kind: 'rows', sourceId, rows: skipped.map((s) => s.at) },
      `${plural(skippedCount, 'row', 'rows')} between lot rows ${skippedCount === 1 ? 'was' : 'were'} skipped: ${skipped.filter((s) => s.reason === 'blank-row').length} blank, ${skipped.filter((s) => s.reason === 'repeated-header').length} repeated header, ${skipped.filter((s) => s.reason === 'no-amounts').length} without amounts.`,
      { count: skippedCount, resolution: 'auto-resolved', status: 'resolved' });
  }
  if (footerRows > 0) {
    issues.add('footer-skipped', 'Information', sheetScope,
      `${plural(footerRows, 'footer row', 'footer rows')} after the last lot ${footerRows === 1 ? 'was' : 'were'} skipped; ${footerRows === 1 ? 'its' : 'their'} text is not kept.`,
      { count: footerRows, resolution: 'auto-resolved', status: 'resolved' });
  }
  if (totalsIdx >= 0) {
    const ok = reconciliation.filter((x) => x.outcome === 'reconciled').map((x) => `"${x.header}"`);
    const notR = reconciliation.filter((x) => x.outcome === 'not-reconciled').map((x) => `"${x.header}"`);
    issues.add('totals-reconciled', 'Information', sheetScope,
      `Reconciled with the totals row in row ${totalsIdx + 1}: ${ok.length ? listText(ok) : 'no column'}.${notR.length ? ` Not reconciled (the total is blank): ${listText(notR)}.` : ''}`,
      { count: ok.length, resolution: 'auto-resolved', status: 'resolved' });
  } else {
    issues.add('no-totals-row', 'Information', sheetScope,
      'The statement has no totals row, so its amounts are not reconciled.', { resolution: 'auto-resolved', status: 'resolved' });
  }
  const taxCols = CG_TAX_FIELDS.filter((f) => cols.has(f));
  if (taxCols.length > 0 && lotRowIdx.every((r) => taxCols.every((f) => cellText(cell(r, f)) === ''))) {
    issues.add('stated-tax-columns-empty', 'Information', sheetScope,
      'The stated tax columns are empty on every lot row; the app computes indicative tax itself.',
      { resolution: 'auto-resolved', status: 'resolved' });
  }
  const derived = derivedSale + derivedPurchase;
  if (derived > 0) {
    issues.add('derived-prices', 'Information', sheetScope,
      `${plural(derived, 'price was', 'prices were')} derived from the amount and the units (${derivedSale} sale, ${derivedPurchase} purchase) and ${derived === 1 ? 'is' : 'are'} labelled derived.`,
      { count: derived, resolution: 'auto-resolved', status: 'resolved' });
  }

  const out: CgImport = {
    parserVersion: CG_PARSER_VERSION, sourceId, sheet: { name: sheetName, headerRow: headerIndex + 1 }, sheets: attempts,
    columns, ignoredColumns: header.ignored, lots, excludedRows: excluded, skippedRows: skipped,
    totalsRow: totalsIdx >= 0 ? totalsIdx + 1 : null, reconciliation, footerRows, pan, events, questions,
    persons: [...persons.values()],
    panPersons: [...panPersons.entries()].sort((x, y) => x[0] - y[0]).map(([personNo, pp]) => ({
      personNo, labels: [...pp.labels.values()], clientIds: [...pp.clientIds], lots: pp.lots.length,
    })),
    insufficientYears, issues: issues.list, audit: [],
  };
  out.audit.push(importAudit(now, sourceId, out), ...audit);
  return out;
}

function panIssue(issues: Issues, scope: ValidationScope, pan: CgImport['pan']): void {
  const cells = pan.tags + pan.tokens;
  if (cells + pan.footerTokens === 0) return;
  issues.add('pan-removed', 'Information', scope,
    `Personal identifiers were removed at read: ${plural(pan.tags, 'PAN tag', 'PAN tags')} and ${plural(pan.tokens, 'PAN-shaped token', 'PAN-shaped tokens')} from the statement's cells, and ${plural(pan.footerTokens, 'PAN-shaped token', 'PAN-shaped tokens')} from its footer. None is kept.`,
    { count: cells + pan.footerTokens, resolution: 'auto-resolved', status: 'resolved' });
}

function importAudit(now: () => string, sourceId: SourceFileId, imp: CgImport): AuditEntry {
  return {
    id: 'audit:1',
    at: now(),
    kind: 'import',
    sourceId,
    summary: imp.lots.length > 0
      ? `Capital-gains statement read: ${imp.lots.length} lots, ${imp.excludedRows.length} rows excluded, ${imp.events.length} sales with repeated rows.`
      : 'Capital-gains statement not read: no lot could be read.',
    detail: {
      parser: CG_PARSER_VERSION,
      headerRow: imp.sheet ? imp.sheet.headerRow : null,
      sheetsTried: imp.sheets.length,
      lots: imp.lots.length,
      excludedRows: imp.excludedRows.length,
      skippedRows: imp.skippedRows.length,
      footerRows: imp.footerRows,
      totalsRow: imp.totalsRow,
      panTags: imp.pan.tags,
      panTokens: imp.pan.tokens,
      panFooterTokens: imp.pan.footerTokens,
      panPersons: imp.panPersons.length,
      repeatEvents: imp.events.length,
      openQuestions: imp.questions.length,
      blocking: imp.issues.filter((i) => i.severity === 'Blocking').length,
    },
  };
}
