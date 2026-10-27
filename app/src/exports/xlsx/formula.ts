// The typed formula builder (architecture §14 "How no formula errors is proved"; M1.4).
// A formula is an expression tree whose references name a declared table (sheet), a column key and a data row.
// renderFormula resolves them against the workbook layout at build time and refuses anything it cannot prove
// safe: an unknown sheet or column, a row outside the table, a reference to the cell itself, a function outside
// ALLOWED_FUNCTIONS, and a string literal that could act as a wildcard, an operator or a formula. The rendered
// text has no leading "=" (SpreadsheetML stores it without one).

import type { WorkbookLayout } from './layout.ts';
import { columnLetter, excelRow, sheetPrefix } from './layout.ts';

export const ALLOWED_FUNCTIONS = ['SUM', 'SUMIFS', 'SUMPRODUCT', 'IF', 'AND', 'OR', 'MIN', 'MAX', 'ABS', 'ROUND'] as const;
export type FunctionName = (typeof ALLOWED_FUNCTIONS)[number];

export type BinaryOp = '+' | '-' | '*' | '/' | '=' | '<>' | '<' | '>' | '<=' | '>=';

/**
 * A formula expression. 'col' is the whole data range of a column ($X$2:$X$N); 'cell' one cell of a data row
 * (0-based), relative unless absCol or absRow is set; sheet null means the formula's own sheet.
 */
export type Fx =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'col'; sheet: string; header: string }
  | { k: 'cell'; sheet: string | null; header: string; row: number; absCol?: boolean; absRow?: boolean }
  | { k: 'call'; fn: FunctionName; args: Fx[] }
  | { k: 'bin'; op: BinaryOp; a: Fx; b: Fx }
  | { k: 'neg'; a: Fx };

/** Where a formula is written: sheet, column key and 0-based data row. */
export type FormulaAt = { sheet: string; header: string; row: number };

export class FormulaError extends Error {
  override name = 'FormulaError';
}

/** A criterion or other string literal: letters, digits, space and "/" only, 1 to 40 characters. */
export const STRING_LITERAL_RE = /^[A-Za-z0-9 /]{1,40}$/;

const bin = (op: BinaryOp) => (a: Fx, b: Fx): Fx => ({ k: 'bin', op, a, b });

export const fx = {
  num: (v: number): Fx => ({ k: 'num', v }),
  str: (v: string): Fx => ({ k: 'str', v }),
  col: (sheet: string, header: string): Fx => ({ k: 'col', sheet, header }),
  cell: (sheet: string | null, header: string, row: number, abs: { col?: boolean; row?: boolean } = {}): Fx => {
    const c: Fx = { k: 'cell', sheet, header, row };
    if (abs.col) c.absCol = true;
    if (abs.row) c.absRow = true;
    return c;
  },
  call: (fn: FunctionName, ...args: Fx[]): Fx => ({ k: 'call', fn, args }),
  sumifs: (sum: Fx, ...criteria: Array<[Fx, Fx]>): Fx => ({ k: 'call', fn: 'SUMIFS', args: [sum, ...criteria.flat()] }),
  add: bin('+'),
  sub: bin('-'),
  mul: bin('*'),
  div: bin('/'),
  neg: (a: Fx): Fx => ({ k: 'neg', a }),
};

const PRECEDENCE: Readonly<Record<BinaryOp, number>> = {
  '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '+': 2, '-': 2, '*': 3, '/': 3,
};
const ATOM = 9;
const NEG = 5;

/** Every 'col' and 'cell' reference in the expression, in order (for dependency checks and tests). */
export function references(f: Fx): Array<Extract<Fx, { k: 'col' } | { k: 'cell' }>> {
  switch (f.k) {
    case 'col':
    case 'cell':
      return [f];
    case 'call':
      return f.args.flatMap(references);
    case 'bin':
      return [...references(f.a), ...references(f.b)];
    case 'neg':
      return references(f.a);
    default:
      return [];
  }
}

/** The formula text (no leading "=") of the expression written at `at`. */
export function renderFormula(f: Fx, layout: WorkbookLayout, at: FormulaAt): string {
  const own = layout.tables.get(at.sheet);
  if (!own) throw new FormulaError(`formula at an unknown sheet "${at.sheet}"`);
  if (!own.columns.has(at.header)) throw new FormulaError(`formula at an unknown column "${at.header}" of "${at.sheet}"`);
  if (!Number.isInteger(at.row) || at.row < 0 || at.row >= own.rows) {
    throw new FormulaError(`formula at row ${at.row}, outside the ${own.rows} data rows of "${at.sheet}"`);
  }

  const table = (sheet: string) => {
    const t = layout.tables.get(sheet);
    if (!t) throw new FormulaError(`unknown sheet "${sheet}"`);
    return t;
  };
  const column = (sheet: string, header: string): number => {
    const i = table(sheet).columns.get(header);
    if (i === undefined) throw new FormulaError(`unknown column "${header}" on "${sheet}"`);
    return i;
  };

  const go = (e: Fx): { text: string; prec: number } => {
    switch (e.k) {
      case 'num': {
        if (!Number.isFinite(e.v)) throw new FormulaError(`number literal ${String(e.v)}`);
        const s = String(Math.abs(e.v));
        if (!/^\d+(\.\d+)?$/.test(s)) throw new FormulaError(`number literal ${String(e.v)} needs an exponent`);
        return e.v < 0 ? { text: `(-${s})`, prec: ATOM } : { text: s, prec: ATOM };
      }
      case 'str': {
        if (typeof e.v !== 'string' || !STRING_LITERAL_RE.test(e.v) || /^[=<>]/.test(e.v)) {
          throw new FormulaError(`string literal ${JSON.stringify(e.v)} is not a plain key (letters, digits, space, "/")`);
        }
        return { text: `"${e.v}"`, prec: ATOM };
      }
      case 'col': {
        const t = table(e.sheet);
        const i = column(e.sheet, e.header);
        if (t.rows < 1) throw new FormulaError(`column "${e.header}" of "${e.sheet}" has no data rows`);
        if (e.sheet === at.sheet && e.header === at.header) {
          throw new FormulaError(`self-reference: the range of "${e.header}" holds the formula's own cell`);
        }
        const L = columnLetter(i);
        return { text: `${sheetPrefix(e.sheet)}$${L}$${excelRow(0)}:$${L}$${excelRow(t.rows - 1)}`, prec: ATOM };
      }
      case 'cell': {
        const sheet = e.sheet ?? at.sheet;
        const t = table(sheet);
        const i = column(sheet, e.header);
        if (!Number.isInteger(e.row) || e.row < 0 || e.row >= t.rows) {
          throw new FormulaError(`row ${e.row} is outside the ${t.rows} data rows of "${sheet}"`);
        }
        if (sheet === at.sheet && e.header === at.header && e.row === at.row) {
          throw new FormulaError(`self-reference at "${sheet}" ${e.header} row ${e.row}`);
        }
        const ref = `${e.absCol ? '$' : ''}${columnLetter(i)}${e.absRow ? '$' : ''}${excelRow(e.row)}`;
        return { text: e.sheet === null ? ref : `${sheetPrefix(sheet)}${ref}`, prec: ATOM };
      }
      case 'call': {
        if (!(ALLOWED_FUNCTIONS as readonly string[]).includes(e.fn)) throw new FormulaError(`function ${String(e.fn)} is not allowed`);
        if (e.fn === 'SUMIFS') {
          if (e.args.length < 3 || e.args.length % 2 === 0) throw new FormulaError('SUMIFS needs a sum range and criterion pairs');
          const ranges = e.args.filter((_, i) => i === 0 || i % 2 === 1);
          for (const r of ranges) if (r.k !== 'col') throw new FormulaError('SUMIFS ranges must be whole table columns');
          const lengths = new Set(ranges.map((r) => (r.k === 'col' ? table(r.sheet).rows : -1)));
          if (lengths.size !== 1) throw new FormulaError('SUMIFS ranges must have the same length');
        }
        return { text: `${e.fn}(${e.args.map((a) => go(a).text).join(',')})`, prec: ATOM };
      }
      case 'bin': {
        const p = PRECEDENCE[e.op];
        if (p === undefined) throw new FormulaError(`operator ${String(e.op)}`);
        const a = go(e.a);
        const b = go(e.b);
        const left = a.prec < p ? `(${a.text})` : a.text;
        const right = b.prec <= p ? `(${b.text})` : b.text;
        return { text: `${left}${e.op}${right}`, prec: p };
      }
      case 'neg': {
        const a = go(e.a);
        return { text: `-${a.prec < NEG ? `(${a.text})` : a.text}`, prec: NEG };
      }
      default:
        throw new FormulaError(`unknown expression ${JSON.stringify(e)}`);
    }
  };
  return go(f).text;
}
