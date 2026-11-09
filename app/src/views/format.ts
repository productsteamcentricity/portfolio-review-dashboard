// The one place a Value<number> becomes cell text (architecture §6.4; D-029). Renderers receive the status, never a
// pre-formatted string, so a missing value cannot be printed as 0.00.
//
// M1.3 built the rule itself (tests/unit/model/value.test.ts). M1.4 adds the display unit (Crore or Lakh, the base
// file's own unit), percentages and counts, and the lower-case status phrases the notes use. Rounding happens here
// only, on display: every Figure keeps the engine's unrounded value (architecture §6.1 rule 3).

import type { Value } from '../model/value.ts';
import type { MissingStatus } from '../model/status.ts';
import type { DisplayUnit } from '../model/review.ts';
import { STATUS } from '../model/status.ts';
import { DEFAULT_DECIMALS, MISSING_MARKER, PARTIAL_MARKER, STALE_MARKER } from '../config/formats.ts';
import { fromCrore } from '../engine/units.ts';

export type CellDisplay = {
  /** The text of the cell: a number, or the missing-value marker alone. */
  text: string;
  /** "s" (stale) or "p" (partial) after a present value; null otherwise. */
  marker: string | null;
  /** The status the cell's footnote must name; null for a complete, current value. */
  footnoteStatus: MissingStatus | null;
  /** True for a value below zero (shown in red #931621 by the renderer). */
  negative: boolean;
};

/** Significant digits Excel keeps of a number, and from which it rounds what a cell shows. */
const EXCEL_DIGITS = 15;

/**
 * The size of `v` rounded to `decimals` places as Excel shows it (D-039): first to 15 significant digits, then half
 * up on that decimal, so 1.005 gives "1.01", 2.675 "2.68" and 35.67499999999998 (35.675 to 15 digits) "35.68". Exact
 * decimal arithmetic on the digits, never on the binary double: toFixed would give "1.00", "2.67" and "35.67". The
 * result is unsigned, with exactly `decimals` digits after the point.
 */
export function excelFixed(v: number, decimals: number): string {
  if (!Number.isFinite(v)) throw new RangeError(`cannot format ${String(v)}`);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 20) throw new RangeError(`bad decimals ${String(decimals)}`);
  const a = Math.abs(v);
  let scaled: bigint;
  if (a === 0) scaled = BigInt(0);
  else {
    // "d.ddddddddddddddde±x": the 15 significant digits and the power of ten of the first one.
    const m = /^(\d)\.(\d+)e([+-]\d+)$/.exec(a.toExponential(EXCEL_DIGITS - 1));
    if (!m) throw new RangeError(`cannot format ${String(v)}`);
    const digits = BigInt(`${m[1]}${m[2]}`);
    // value = digits x 10^(exp - 14); the shown number is value x 10^decimals, rounded half up.
    const shift = Number(m[3]) - (EXCEL_DIGITS - 1) + decimals;
    if (shift >= 0) scaled = digits * BigInt(10) ** BigInt(shift);
    else {
      const unit = BigInt(10) ** BigInt(-shift);
      const q = digits / unit;
      scaled = (digits % unit) * BigInt(2) >= unit ? q + BigInt(1) : q;
    }
  }
  const s = scaled.toString().padStart(decimals + 1, '0');
  return decimals === 0 ? s : `${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
}

/**
 * `v` rounded to `decimals` places by the display rule (excelFixed), as a number with its sign: the number a cell
 * shows, for a comparison such as the pie-label threshold (D-039 point 6).
 */
export function displayRounded(v: number, decimals: number = DEFAULT_DECIMALS): number {
  const n = Number(excelFixed(v, decimals));
  return v < 0 && n !== 0 ? -n : n;
}

/**
 * A number with Indian digit grouping (1,23,45,678.90) and a hyphen-minus for negatives (D-029), rounded as Excel
 * rounds (excelFixed), so the screen, the slide and the workbook show the same text. A value that rounds to zero is
 * shown without a sign.
 */
export function formatIndian(v: number, decimals: number = DEFAULT_DECIMALS): string {
  const fixed = excelFixed(v, decimals);
  const [int, frac] = fixed.split('.') as [string, string | undefined];
  let grouped = int;
  if (int.length > 3) {
    const last3 = int.slice(-3);
    const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${last3}`;
  }
  const body = frac === undefined ? grouped : `${grouped}.${frac}`;
  const isZero = /^[0.]*$/.test(fixed);
  return v < 0 && !isZero ? `-${body}` : body;
}

/** The display of one numeric cell. */
export function displayNumber(x: Value<number>, decimals: number = DEFAULT_DECIMALS): CellDisplay {
  if (x.kind === 'missing') {
    return { text: MISSING_MARKER, marker: null, footnoteStatus: x.status, negative: false };
  }
  const text = formatIndian(x.v, decimals);
  const negative = x.v < 0 && text.startsWith('-');
  if (x.stale) return { text, marker: STALE_MARKER, footnoteStatus: STATUS.STALE, negative };
  if (x.coverage !== undefined && x.coverage < 1) {
    return { text, marker: PARTIAL_MARKER, footnoteStatus: STATUS.PARTIAL, negative };
  }
  return { text, marker: null, footnoteStatus: null, negative };
}

/**
 * A money value (held in Crore) in the display unit: the same Value with its number scaled to Crore or Lakh,
 * unrounded. A missing value is returned as it is. This is the number the workbook writes (Figure.shown).
 */
export function scaleMoney(x: Value<number>, unit: DisplayUnit): Value<number> {
  if (x.kind === 'missing' || unit === 'crore') return x;
  return { ...x, v: fromCrore(x.v, unit) };
}

/** A money cell: the value in the display unit, two decimals ("3.35" in Crore, "335.30" in Lakh). */
export function displayMoney(x: Value<number>, unit: DisplayUnit): CellDisplay {
  return displayNumber(scaleMoney(x, unit), DEFAULT_DECIMALS);
}

/** A percent number as cell text with "%" ("59.26%"); a missing value is the marker alone. */
export function displayPct(x: Value<number>, decimals: number = DEFAULT_DECIMALS): CellDisplay {
  const d = displayNumber(x, decimals);
  return x.kind === 'missing' ? d : { ...d, text: `${d.text}%` };
}

/** A count ("6"). */
export function displayCount(x: Value<number>): CellDisplay {
  return displayNumber(x, 0);
}

/** The column-header suffix of the display unit. */
export function unitHeader(unit: DisplayUnit): '(Cr.)' | '(L)' {
  return unit === 'lakh' ? '(L)' : '(Cr.)';
}

/** The display unit's name in a sentence ("Amounts in Crore."). */
export function unitName(unit: DisplayUnit): 'Crore' | 'Lakh' {
  return unit === 'lakh' ? 'Lakh' : 'Crore';
}

/** Each status as a lower-case sentence fragment, for notes ("The as-on date is not set: not available in supplied data."). */
export const STATUS_PHRASE: Readonly<Record<MissingStatus, string>> = {
  [STATUS.NOT_DISCLOSED]: 'not disclosed',
  [STATUS.NOT_AVAILABLE]: 'not available in supplied data',
  [STATUS.NOT_APPLICABLE]: 'not applicable',
  [STATUS.NOT_COMPARABLE]: 'not comparable',
  [STATUS.HISTORICAL_ONLY]: 'historical only',
  [STATUS.CURRENT_NOT_AVAILABLE]: 'current data not available',
  [STATUS.INSUFFICIENT_EVIDENCE]: 'insufficient evidence',
  [STATUS.INVALID_SOURCE]: 'invalid source data',
  [STATUS.STALE]: 'stale data',
  [STATUS.PARTIAL]: 'partial coverage',
};

/**
 * Text from a file or an analyst made safe for a presentation sentence or label: whitespace collapsed, and any en or
 * em dash (U+2013, U+2014) replaced by a hyphen-minus, so the only dash an output shows is the missing-value marker
 * alone in its cell (D-029).
 */
export function plainText(s: string): string {
  return s.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
}

/** "1 holding" or "2 holdings". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
