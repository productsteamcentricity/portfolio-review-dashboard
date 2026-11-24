// An independent evaluator of workbook formulas for tests and the Office acceptance (architecture §14). It parses
// the formula text written in the sheet XML, never the builder's expression trees, and imports nothing from
// app/src/exports. Excel semantics for the subset the writer may use (formula.ts ALLOWED_FUNCTIONS):
// - a blank cell is 0 in arithmetic; text that is not a number is #VALUE! in arithmetic; division by 0 is #DIV/0!
// - SUMIFS: criteria compare text case-insensitively, with * ? ~ wildcards and = <> < > <= >= prefixes; a criterion
//   "" matches blank cells; a criterion that refers to an empty cell counts as 0; text in the sum range is ignored
// - an unknown sheet is #REF!, an unknown function #NAME?

import { readXlsx, splitRef, colName } from './xlsx-read.ts';

export type ErrorValue = { error: '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#N/A' | '#NUM!' };
export type Scalar = number | string | boolean | null | ErrorValue;
export type EvalResult = number | string | boolean | ErrorValue;

export type EvalCell = { value: Scalar; formula: string | null; cached: Scalar };
export type EvalSheet = { name: string; cells: Map<string, EvalCell> };
export type EvalWorkbook = { sheets: Map<string, EvalSheet>; order: string[] };

const err = (e: ErrorValue['error']): ErrorValue => ({ error: e });
export const isError = (v: unknown): v is ErrorValue => typeof v === 'object' && v !== null && 'error' in v;

/** Reads every sheet's cells: constants as values, formulas with their text and cached value. */
export function readWorkbookForEval(bytes: Uint8Array): EvalWorkbook {
  const wb = readXlsx(bytes);
  const sheets = new Map<string, EvalSheet>();
  const order: string[] = [];
  for (const s of wb.sheets) {
    const cells = new Map<string, EvalCell>();
    for (const c of s.cells.values()) {
      const val: Scalar = c.t === 'e' ? err((c.v as ErrorValue['error']) ?? '#N/A') : c.v;
      cells.set(c.ref, { value: c.f === null ? val : null, formula: c.f, cached: val });
    }
    sheets.set(s.name.toLowerCase(), { name: s.name, cells });
    order.push(s.name);
  }
  return { sheets, order };
}

/** A copy of the workbook with one cell set to a number (its formula, if any, removed). ref: "Sheet name!X2". */
export function withEdit(wb: EvalWorkbook, ref: string, value: number): EvalWorkbook {
  const bang = ref.lastIndexOf('!');
  const sheetName = ref.slice(0, bang).replace(/^'(.*)'$/, '$1').replace(/''/g, "'");
  const cell = ref.slice(bang + 1).replace(/\$/g, '');
  const sheets = new Map(wb.sheets);
  const s = wb.sheets.get(sheetName.toLowerCase());
  if (!s) throw new Error(`withEdit: no sheet ${sheetName}`);
  const cells = new Map(s.cells);
  cells.set(cell, { value: value, formula: null, cached: value });
  sheets.set(sheetName.toLowerCase(), { name: s.name, cells });
  return { sheets, order: wb.order };
}

// ---------------------------------------------------------------------------------------------------------------
// Tokens and parser

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'err'; v: ErrorValue['error'] }
  | { t: 'ref'; sheet: string | null; a: string; b: string | null }
  | { t: 'fn'; name: string }
  | { t: 'op'; v: string }
  | { t: '('; } | { t: ')'; } | { t: ','; };

const CELL = String.raw`\$?[A-Za-z]{1,3}\$?\d+`;
const REF_RE = new RegExp(`^(${CELL})(?::(${CELL}))?`);
const ERRORS = ['#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#N/A', '#NUM!', '#NULL!'] as const;

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === ' ' || ch === '\n' || ch === '\t') { i++; continue; }
    if (ch === '"') {
      let s = '';
      i++;
      for (;;) {
        if (i >= src.length) throw new Error('formula: unterminated string');
        if (src[i] === '"') { if (src[i + 1] === '"') { s += '"'; i += 2; continue; } i++; break; }
        s += src[i++];
      }
      out.push({ t: 'str', v: s });
      continue;
    }
    if (ch === '#') {
      const e = ERRORS.find((x) => src.startsWith(x, i));
      if (!e) throw new Error(`formula: unknown error literal at ${i}`);
      out.push({ t: 'err', v: e === '#NULL!' ? '#N/A' : e });
      i += e.length;
      continue;
    }
    if (ch === "'" || /[A-Za-z_\\$]/.test(ch)) {
      // A sheet-qualified reference, a reference, a function name or a boolean.
      let sheet: string | null = null;
      let j = i;
      if (ch === "'") {
        let s = '';
        j++;
        for (;;) {
          if (j >= src.length) throw new Error('formula: unterminated sheet name');
          if (src[j] === "'") { if (src[j + 1] === "'") { s += "'"; j += 2; continue; } j++; break; }
          s += src[j++];
        }
        if (src[j] !== '!') throw new Error('formula: a quoted name must be a sheet');
        sheet = s;
        j++;
      } else {
        const m = /^([A-Za-z_\\][A-Za-z0-9_.]*)!/.exec(src.slice(j));
        if (m) { sheet = m[1]!; j += m[0].length; }
      }
      const rest = src.slice(j);
      const r = REF_RE.exec(rest);
      if (r && !/^[A-Za-z0-9_(]/.test(rest.slice(r[0].length))) {
        out.push({ t: 'ref', sheet, a: r[1]!.replace(/\$/g, '').toUpperCase(), b: r[2] ? r[2].replace(/\$/g, '').toUpperCase() : null });
        i = j + r[0].length;
        continue;
      }
      if (sheet !== null) throw new Error(`formula: bad reference after ${sheet}!`);
      const w = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest);
      if (!w) throw new Error(`formula: unexpected "${ch}" at ${i} in ${src}`);
      const word = w[0];
      i = j + word.length;
      if (src[i] === '(') { out.push({ t: 'fn', name: word.toUpperCase() }); continue; }
      if (/^(TRUE|FALSE)$/i.test(word)) { out.push({ t: 'bool', v: word.toUpperCase() === 'TRUE' }); continue; }
      out.push({ t: 'err', v: '#NAME?' }); // an unknown name
      continue;
    }
    const num = /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>') { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/^&=<>%'.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue; }
    if (ch === '(') { out.push({ t: '(' }); i++; continue; }
    if (ch === ')') { out.push({ t: ')' }); i++; continue; }
    if (ch === ',') { out.push({ t: ',' }); i++; continue; }
    throw new Error(`formula: unexpected "${ch}" at ${i} in ${src}`);
  }
  return out;
}

type Node =
  | { k: 'lit'; v: Scalar }
  | { k: 'ref'; sheet: string | null; a: string; b: string | null }
  | { k: 'call'; name: string; args: Node[] }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'un'; op: string; a: Node }
  | { k: 'pct'; a: Node };

function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = (): Tok | undefined => toks[p];
  const isOp = (v: string): boolean => { const t = peek(); return t !== undefined && t.t === 'op' && t.v === v; };
  const binLevel = (ops: string[], next: () => Node) => (): Node => {
    let left = next();
    for (;;) {
      const t = peek();
      if (t && t.t === 'op' && ops.includes(t.v)) { p++; left = { k: 'bin', op: t.v, a: left, b: next() }; } else return left;
    }
  };
  const primary = (): Node => {
    const t = toks[p++];
    if (!t) throw new Error(`formula: unexpected end of ${src}`);
    switch (t.t) {
      case 'num': return { k: 'lit', v: t.v };
      case 'str': return { k: 'lit', v: t.v };
      case 'bool': return { k: 'lit', v: t.v };
      case 'err': return { k: 'lit', v: err(t.v) };
      case 'ref': return { k: 'ref', sheet: t.sheet, a: t.a, b: t.b };
      case '(': {
        const e = comparison();
        if (toks[p++]?.t !== ')') throw new Error(`formula: ")" expected in ${src}`);
        return e;
      }
      case 'fn': {
        if (toks[p++]?.t !== '(') throw new Error(`formula: "(" expected after ${t.name}`);
        const args: Node[] = [];
        if (peek()?.t === ')') { p++; return { k: 'call', name: t.name, args }; }
        for (;;) {
          if (peek()?.t === ',' || peek()?.t === ')') args.push({ k: 'lit', v: null });
          else args.push(comparison());
          const n = toks[p++];
          if (n?.t === ')') break;
          if (n?.t !== ',') throw new Error(`formula: "," or ")" expected in ${src}`);
        }
        return { k: 'call', name: t.name, args };
      }
      default:
        throw new Error(`formula: unexpected token ${JSON.stringify(t)} in ${src}`);
    }
  };
  const postfix = (): Node => { let a = primary(); while (isOp('%')) { p++; a = { k: 'pct', a }; } return a; };
  const unary = (): Node => {
    if (isOp('-') || isOp('+')) { const op = (toks[p++] as { v: string }).v; return { k: 'un', op, a: unary() }; }
    return postfix();
  };
  const power = binLevel(['^'], unary);
  const mult = binLevel(['*', '/'], power);
  const add = binLevel(['+', '-'], mult);
  const concat = binLevel(['&'], add);
  const comparison = binLevel(['=', '<>', '<', '>', '<=', '>='], concat);
  const tree = comparison();
  if (p !== toks.length) throw new Error(`formula: trailing tokens in ${src}`);
  return tree;
}

// ---------------------------------------------------------------------------------------------------------------
// Evaluation

type Range = { kind: 'range'; sheet: EvalSheet; c1: number; r1: number; c2: number; r2: number };
type Val = Scalar | Range;
const isRange = (v: Val): v is Range => typeof v === 'object' && v !== null && 'kind' in v;

function parseNumberText(s: string): number | null {
  const t = s.trim();
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(t)) return null;
  return Number(t);
}

class Evaluator {
  private readonly memo = new Map<string, Scalar>();
  private readonly active = new Set<string>();
  private readonly wb: EvalWorkbook;
  constructor(wb: EvalWorkbook) {
    this.wb = wb;
  }

  sheet(name: string): EvalSheet | null {
    return this.wb.sheets.get(name.toLowerCase()) ?? null;
  }

  cellValue(sheet: EvalSheet, ref: string): Scalar {
    const key = `${sheet.name}!${ref}`;
    const c = sheet.cells.get(ref);
    if (!c) return null;
    if (c.formula === null) return c.value;
    const known = this.memo.get(key);
    if (known !== undefined) return known;
    if (this.active.has(key)) throw new Error(`formula: circular reference at ${key}`);
    this.active.add(key);
    let v: Scalar;
    try {
      v = this.scalar(this.eval(parse(c.formula), sheet));
      if (v === null) v = 0;
    } finally {
      this.active.delete(key);
    }
    this.memo.set(key, v);
    return v;
  }

  cells(r: Range): Scalar[][] {
    const out: Scalar[][] = [];
    for (let row = r.r1; row <= r.r2; row++) {
      const line: Scalar[] = [];
      for (let col = r.c1; col <= r.c2; col++) line.push(this.cellValue(r.sheet, `${colName(col)}${row}`));
      out.push(line);
    }
    return out;
  }

  /** A value used as one scalar: a one-cell range is its cell; a larger range is #VALUE!. */
  scalar(v: Val): Scalar {
    if (!isRange(v)) return v;
    if (v.r1 === v.r2 && v.c1 === v.c2) return this.cellValue(v.sheet, `${colName(v.c1)}${v.r1}`);
    return err('#VALUE!');
  }

  num(v: Scalar): number | ErrorValue {
    if (isError(v)) return v;
    if (v === null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const n = parseNumberText(v);
    return n === null ? err('#VALUE!') : n;
  }

  eval(n: Node, here: EvalSheet): Val {
    switch (n.k) {
      case 'lit': return n.v;
      case 'ref': {
        const sheet = n.sheet === null ? here : this.sheet(n.sheet);
        if (!sheet) return err('#REF!');
        const a = splitRef(n.a);
        const b = n.b ? splitRef(n.b) : a;
        return { kind: 'range', sheet, c1: Math.min(a.col, b.col), r1: Math.min(a.row, b.row), c2: Math.max(a.col, b.col), r2: Math.max(a.row, b.row) };
      }
      case 'pct': {
        const x = this.num(this.scalar(this.eval(n.a, here)));
        return isError(x) ? x : x / 100;
      }
      case 'un': {
        const x = this.num(this.scalar(this.eval(n.a, here)));
        if (isError(x)) return x;
        return n.op === '-' ? -x : x;
      }
      case 'bin': return this.binary(n.op, this.scalar(this.eval(n.a, here)), this.scalar(this.eval(n.b, here)));
      case 'call': return this.call(n.name, n.args, here);
    }
  }

  binary(op: string, a: Scalar, b: Scalar): Scalar {
    if (isError(a)) return a;
    if (isError(b)) return b;
    if (op === '&') return `${this.text(a)}${this.text(b)}`;
    if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
      const c = compare(a, b);
      switch (op) {
        case '=': return c === 0;
        case '<>': return c !== 0;
        case '<': return c < 0;
        case '>': return c > 0;
        case '<=': return c <= 0;
        default: return c >= 0;
      }
    }
    const x = this.num(a);
    const y = this.num(b);
    if (isError(x)) return x;
    if (isError(y)) return y;
    switch (op) {
      case '+': return x + y;
      case '-': return x - y;
      case '*': return x * y;
      case '/': return y === 0 ? err('#DIV/0!') : x / y;
      case '^': return x ** y;
      default: throw new Error(`formula: operator ${op}`);
    }
  }

  text(v: Scalar): string {
    if (v === null) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return String(v);
  }

  /** Numbers of the arguments: in a range only numbers count; a direct argument is coerced. */
  numbers(args: Node[], here: EvalSheet): number[] | ErrorValue {
    const out: number[] = [];
    for (const a of args) {
      const v = this.eval(a, here);
      if (isRange(v)) {
        for (const line of this.cells(v)) for (const c of line) {
          if (isError(c)) return c;
          if (typeof c === 'number') out.push(c);
        }
      } else {
        const x = this.num(v);
        if (isError(x)) return x;
        out.push(x);
      }
    }
    return out;
  }

  call(name: string, args: Node[], here: EvalSheet): Val {
    switch (name) {
      case 'SUM': { const xs = this.numbers(args, here); return isError(xs) ? xs : xs.reduce((s, x) => s + x, 0); }
      case 'MIN': { const xs = this.numbers(args, here); return isError(xs) ? xs : (xs.length ? Math.min(...xs) : 0); }
      case 'MAX': { const xs = this.numbers(args, here); return isError(xs) ? xs : (xs.length ? Math.max(...xs) : 0); }
      case 'ABS': {
        if (args.length !== 1) return err('#VALUE!');
        const x = this.num(this.scalar(this.eval(args[0]!, here)));
        return isError(x) ? x : Math.abs(x);
      }
      case 'ROUND': {
        if (args.length !== 2) return err('#VALUE!');
        const x = this.num(this.scalar(this.eval(args[0]!, here)));
        const d = this.num(this.scalar(this.eval(args[1]!, here)));
        if (isError(x)) return x;
        if (isError(d)) return d;
        const digits = Math.trunc(d);
        const p = 10 ** digits;
        const scaled = Number((Math.abs(x) * p).toPrecision(15));
        return (Math.sign(x) || 1) * Math.round(scaled) / p;
      }
      case 'IF': {
        if (args.length < 2 || args.length > 3) return err('#VALUE!');
        const c = this.scalar(this.eval(args[0]!, here));
        if (isError(c)) return c;
        let t: boolean;
        if (c === null) t = false;
        else if (typeof c === 'boolean') t = c;
        else if (typeof c === 'number') t = c !== 0;
        else return err('#VALUE!');
        if (t) return this.eval(args[1]!, here);
        return args.length === 3 ? this.eval(args[2]!, here) : false;
      }
      case 'AND':
      case 'OR': {
        const bools: boolean[] = [];
        for (const a of args) {
          const v = this.eval(a, here);
          const list = isRange(v) ? this.cells(v).flat() : [v];
          for (const x of list) {
            if (isError(x)) return x;
            if (typeof x === 'boolean') bools.push(x);
            else if (typeof x === 'number') bools.push(x !== 0);
            else if (typeof x === 'string' && !isRange(v)) return err('#VALUE!');
          }
        }
        if (bools.length === 0) return err('#VALUE!');
        return name === 'AND' ? bools.every(Boolean) : bools.some(Boolean);
      }
      case 'SUMPRODUCT': {
        const arrays: Scalar[][][] = [];
        for (const a of args) {
          const v = this.eval(a, here);
          arrays.push(isRange(v) ? this.cells(v) : [[v]]);
        }
        if (arrays.length === 0) return err('#VALUE!');
        const rows = arrays[0]!.length;
        const cols = arrays[0]![0]!.length;
        if (arrays.some((m) => m.length !== rows || m[0]!.length !== cols)) return err('#VALUE!');
        let sum = 0;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          let prod = 1;
          for (const m of arrays) {
            const x = m[r]![c]!;
            if (isError(x)) return x;
            prod *= typeof x === 'number' ? x : 0;
          }
          sum += prod;
        }
        return sum;
      }
      case 'SUMIFS': {
        if (args.length < 3 || args.length % 2 === 0) return err('#VALUE!');
        const sumV = this.eval(args[0]!, here);
        if (!isRange(sumV)) return err('#VALUE!');
        const h = sumV.r2 - sumV.r1;
        const w = sumV.c2 - sumV.c1;
        const tests: Array<{ range: Range; match: (x: Scalar) => boolean }> = [];
        for (let i = 1; i < args.length; i += 2) {
          const rv = this.eval(args[i]!, here);
          if (!isRange(rv) || rv.r2 - rv.r1 !== h || rv.c2 - rv.c1 !== w) return err('#VALUE!');
          const critV = this.eval(args[i + 1]!, here);
          let crit: Scalar;
          if (isRange(critV)) {
            crit = this.scalar(critV);
            if (crit === null) crit = 0; // a reference to an empty cell counts as 0
          } else crit = critV;
          if (isError(crit)) return crit;
          tests.push({ range: rv, match: criterion(crit) });
        }
        let sum = 0;
        for (let dr = 0; dr <= h; dr++) for (let dc = 0; dc <= w; dc++) {
          const ok = tests.every((t) => t.match(this.cellValue(t.range.sheet, `${colName(t.range.c1 + dc)}${t.range.r1 + dr}`)));
          if (!ok) continue;
          const x = this.cellValue(sumV.sheet, `${colName(sumV.c1 + dc)}${sumV.r1 + dr}`);
          if (isError(x)) return x;
          if (typeof x === 'number') sum += x;
        }
        return sum;
      }
      default:
        return err('#NAME?');
    }
  }
}

/** Excel's ordering: numbers < text < booleans; text compared ignoring case; a blank is 0, "" or FALSE. */
function compare(a: Scalar, b: Scalar): number {
  const rank = (v: Scalar): number => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);
  let x = a;
  let y = b;
  if (x === null) x = y === null ? 0 : typeof y === 'string' ? '' : typeof y === 'boolean' ? false : 0;
  if (y === null) y = typeof x === 'string' ? '' : typeof x === 'boolean' ? false : 0;
  if (rank(x) !== rank(y)) return rank(x) - rank(y);
  if (typeof x === 'number' && typeof y === 'number') return x === y ? 0 : x < y ? -1 : 1;
  if (typeof x === 'boolean' && typeof y === 'boolean') return x === y ? 0 : x ? 1 : -1;
  const s = String(x).toLowerCase();
  const t = String(y).toLowerCase();
  return s === t ? 0 : s < t ? -1 : 1;
}

function wildcard(pattern: string): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === '~' && i + 1 < pattern.length && '*?~'.includes(pattern[i + 1]!)) { re += `\\${pattern[++i]}`; continue; }
    if (ch === '*') re += '.*';
    else if (ch === '?') re += '.';
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'is');
}

/** The matcher of one SUMIFS criterion. */
function criterion(crit: Scalar): (x: Scalar) => boolean {
  if (typeof crit === 'number') return (x) => (typeof x === 'number' ? x === crit : typeof x === 'string' && parseNumberText(x) === crit);
  if (typeof crit === 'boolean') return (x) => x === crit;
  const s = String(crit);
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(s)!;
  const op = m[1] ?? '';
  const rest = m[2]!;
  const n = parseNumberText(rest);
  if (n !== null && rest.trim() !== '') {
    const cmp = (x: number): boolean => {
      switch (op) {
        case '<': return x < n;
        case '>': return x > n;
        case '<=': return x <= n;
        case '>=': return x >= n;
        case '<>': return x !== n;
        default: return x === n;
      }
    };
    return (x) => {
      if (typeof x === 'number') return cmp(x);
      if (op === '<>') return true;
      if ((op === '' || op === '=') && typeof x === 'string') return parseNumberText(x) === n;
      return false;
    };
  }
  if (op === '' || op === '=') {
    if (rest === '') return (x) => x === null || x === '';
    const re = wildcard(rest);
    return (x) => typeof x === 'string' && re.test(x);
  }
  if (op === '<>') {
    if (rest === '') return (x) => !(x === null || x === '');
    const re = wildcard(rest);
    return (x) => !(typeof x === 'string' && re.test(x));
  }
  const t = rest.toLowerCase();
  return (x) => {
    if (typeof x !== 'string') return false;
    const v = x.toLowerCase();
    switch (op) {
      case '<': return v < t;
      case '>': return v > t;
      case '<=': return v <= t;
      default: return v >= t;
    }
  };
}

/** Evaluates every formula cell. Keys are "Sheet name!A1". A blank result is 0, as Excel shows it. */
export function evaluateAll(wb: EvalWorkbook): Map<string, EvalResult> {
  const ev = new Evaluator(wb);
  const out = new Map<string, EvalResult>();
  for (const name of wb.order) {
    const s = wb.sheets.get(name.toLowerCase())!;
    const refs = [...s.cells.entries()].filter(([, c]) => c.formula !== null).map(([r]) => r)
      .sort((x, y) => { const a = splitRef(x); const b = splitRef(y); return a.row - b.row || a.col - b.col; });
    for (const ref of refs) {
      const v = ev.cellValue(s, ref);
      out.set(`${s.name}!${ref}`, v === null ? 0 : v);
    }
  }
  return out;
}

/** Evaluates one formula text in the context of a sheet (for tests). */
export function evaluateFormula(wb: EvalWorkbook, sheet: string, formula: string): EvalResult {
  const ev = new Evaluator(wb);
  const s = ev.sheet(sheet);
  if (!s) throw new Error(`no sheet ${sheet}`);
  const v = ev.scalar(ev.eval(parse(formula), s));
  return v === null ? 0 : v;
}

/** Equal within 1e-9 relative (plus 1e-12 absolute, for values near 0). */
export function closeTo(a: number, b: number, rel = 1e-9): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b)) + 1e-12;
}
