// Workbook reader (architecture §7 `ingest/workbook.ts`): wraps SheetJS and returns plain cells.
//
// - Raw serial numbers for dates (cellDates off), so no local-time Date and no time-zone drift; engine/dates.ts
//   turns a serial into a DayNumber.
// - Each number keeps its number format, so a percent-formatted cell can be told from a percent number (OD-3).
// - Cached values of formula cells, with the formula text kept.
// - Sheets in workbook order with their real row numbers; no object is keyed by text from the file, so a hostile
//   sheet or cell cannot pollute a prototype.
// It interprets no business meaning. SheetJS is passed in (the page's vendored copy, or the test helper's), so this
// module has no globals and no dependency.

/** A cell: null when empty. */
export type Cell =
  | null
  | { t: 'n'; v: number; fmt: string | null; date: boolean; formula?: string }
  | { t: 's'; v: string; formula?: string }
  | { t: 'b'; v: boolean; formula?: string }
  | { t: 'e'; v: string; formula?: string };

export type Sheet = {
  name: string;
  hidden: boolean;
  /** rows[i] is Excel row i + 1; rows[i][j] is column j + 1 (A = 0). Short rows mean empty cells. */
  rows: Cell[][];
};

export type Workbook = {
  sheets: Sheet[];
  /** True for workbooks in Excel's 1904 date system. */
  date1904: boolean;
};

/** The part of SheetJS this module uses. */
export type SheetJSLike = {
  read(data: Uint8Array, opts: Record<string, unknown>): SheetJSWorkbook;
  utils: { decode_cell(address: string): { r: number; c: number } };
  SSF: { is_date(fmt: string): boolean };
};

type SheetJSCell = { t?: string; v?: unknown; z?: unknown; w?: unknown; f?: unknown };
export type SheetJSWorkbook = {
  SheetNames: string[];
  Sheets: Record<string, Record<string, unknown>>;
  Workbook?: { WBProps?: { date1904?: unknown }; Sheets?: Array<{ Hidden?: unknown } | undefined> };
};

export type ReadLimits = {
  /** Refuse files larger than this many bytes. */
  maxBytes?: number;
  /** Refuse workbooks with more sheets. */
  maxSheets?: number;
  /** Refuse a sheet with more non-empty cells. */
  maxCellsPerSheet?: number;
};

export class WorkbookReadError extends Error {
  readonly reason: 'unreadable' | 'too-large' | 'too-many-sheets' | 'too-many-cells';
  constructor(reason: WorkbookReadError['reason'], message: string) {
    super(message);
    this.name = 'WorkbookReadError';
    this.reason = reason;
  }
}

const A1_RE = /^[A-Z]{1,3}[0-9]{1,7}$/;

/** Reads a workbook from its bytes. Throws WorkbookReadError when it cannot be read or breaks a limit. */
export function readWorkbook(xlsx: SheetJSLike, bytes: Uint8Array, limits: ReadLimits = {}): Workbook {
  if (limits.maxBytes !== undefined && bytes.length > limits.maxBytes) {
    throw new WorkbookReadError('too-large', `the file is ${bytes.length} bytes, above the limit of ${limits.maxBytes}`);
  }
  let wb: SheetJSWorkbook;
  try {
    wb = xlsx.read(bytes, { type: 'array', cellDates: false, cellNF: true, cellText: false, cellFormula: true });
  } catch (err) {
    throw new WorkbookReadError('unreadable', `the file could not be read as a workbook (${(err as Error).message})`);
  }
  // Copied into this realm's arrays: SheetJS may run in another realm (a test sandbox), and nothing it allocates is
  // returned to the caller.
  const names: string[] = Array.isArray(wb.SheetNames) ? [...wb.SheetNames].map((n) => String(n)) : [];
  if (limits.maxSheets !== undefined && names.length > limits.maxSheets) {
    throw new WorkbookReadError('too-many-sheets', `the workbook has ${names.length} sheets, above the limit of ${limits.maxSheets}`);
  }
  const date1904 = Boolean(wb.Workbook && wb.Workbook.WBProps && wb.Workbook.WBProps.date1904);
  const meta = (wb.Workbook && Array.isArray(wb.Workbook.Sheets)) ? wb.Workbook.Sheets : [];
  const sheets: Sheet[] = names.map((name, i) => {
    const ws = Object.prototype.hasOwnProperty.call(wb.Sheets, name) ? wb.Sheets[name] : undefined;
    const hidden = Boolean(meta[i] && meta[i]!.Hidden);
    return { name, hidden, rows: ws ? sheetRows(xlsx, ws, name, limits) : [] };
  });
  return { sheets, date1904 };
}

function sheetRows(xlsx: SheetJSLike, ws: Record<string, unknown>, name: string, limits: ReadLimits): Cell[][] {
  const rows: Cell[][] = [];
  let count = 0;
  for (const key of Object.keys(ws)) {
    if (key.charAt(0) === '!' || !A1_RE.test(key)) continue;
    const cell = toCell(xlsx, ws[key] as SheetJSCell);
    if (cell === null) continue;
    count++;
    if (limits.maxCellsPerSheet !== undefined && count > limits.maxCellsPerSheet) {
      throw new WorkbookReadError('too-many-cells', `the sheet "${name}" has more than ${limits.maxCellsPerSheet} cells`);
    }
    const { r, c } = xlsx.utils.decode_cell(key);
    while (rows.length <= r) rows.push([]);
    const row = rows[r]!;
    while (row.length < c) row.push(null);
    row[c] = cell;
  }
  return rows;
}

function toCell(xlsx: SheetJSLike, raw: SheetJSCell | undefined): Cell {
  if (!raw || typeof raw !== 'object') return null;
  const formula = typeof raw.f === 'string' && raw.f !== '' ? raw.f : undefined;
  const withFormula = <C extends Exclude<Cell, null>>(c: C): C => (formula ? { ...c, formula } : c);
  switch (raw.t) {
    case 'n': {
      const v = typeof raw.v === 'number' ? raw.v : Number(raw.v);
      if (!Number.isFinite(v)) return null;
      const fmt = typeof raw.z === 'string' && raw.z !== '' && raw.z !== 'General' ? raw.z : null;
      let date = false;
      if (fmt) { try { date = Boolean(xlsx.SSF.is_date(fmt)); } catch { date = false; } }
      return withFormula({ t: 'n', v, fmt, date });
    }
    case 's':
    case 'str': {
      const v = raw.v == null ? '' : String(raw.v);
      return v === '' && !formula ? null : withFormula({ t: 's', v });
    }
    case 'b':
      return withFormula({ t: 'b', v: Boolean(raw.v) });
    case 'e':
      return withFormula({ t: 'e', v: typeof raw.w === 'string' ? raw.w : '#ERROR' });
    case 'd': {
      // Only produced when a reader asks for Dates; turned back into a serial from the same local fields SheetJS used.
      const isDate = Object.prototype.toString.call(raw.v) === '[object Date]';
      const d = isDate ? new Date((raw.v as Date).getTime()) : new Date(String(raw.v));
      if (Number.isNaN(d.getTime())) return null;
      const t = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
      return withFormula({ t: 'n', v: t / 86400000 + 25569, fmt: 'yyyy-mm-dd', date: true });
    }
    default:
      return null;
  }
}

/** The text of a cell as a label: numbers and booleans as written, whitespace collapsed; "" when empty. */
export function cellText(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return '';
  return String(cell.v).replace(/\s+/g, ' ').trim();
}

/**
 * True when a number format scales the value by 100 and shows a percent sign ("0.00%"). A percent sign inside
 * quotes or after a backslash ("0.00\"%\"", the format of a percent *number*) is literal text and does not count;
 * neither do bracketed parts such as [Red] or [$-409].
 */
export function isPercentFormat(fmt: string | null): boolean {
  if (!fmt) return false;
  const bare = fmt
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/_./g, '')
    .replace(/\*./g, '');
  return bare.indexOf('%') >= 0;
}

/** The 0-based index of the first of the first `maxRows` rows that satisfies `isHeader`, or -1. */
export function findHeaderRow(sheet: Sheet, isHeader: (texts: string[]) => boolean, maxRows: number): number {
  const n = Math.min(sheet.rows.length, maxRows);
  for (let i = 0; i < n; i++) {
    const texts = (sheet.rows[i] ?? []).map((c) => cellText(c).toLowerCase());
    if (isHeader(texts)) return i;
  }
  return -1;
}
