// The one place a Value<number> becomes cell text (architecture §6.4; D-029). Renderers receive the status, never a
// pre-formatted string, so a missing value cannot be printed as 0.00.
//
// Milestone M1.3 needs only the rule itself (tests/unit/model/value.test.ts); the full formatter (units, scale,
// footnote numbering) arrives with the first view-models in M1.4.

import type { Value } from '../model/value.ts';
import type { MissingStatus } from '../model/status.ts';
import { STATUS } from '../model/status.ts';
import { DEFAULT_DECIMALS, MISSING_MARKER, PARTIAL_MARKER, STALE_MARKER } from '../config/formats.ts';

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

/**
 * A number with Indian digit grouping (1,23,45,678.90) and a hyphen-minus for negatives (D-029). A value that
 * rounds to zero is shown without a sign.
 */
export function formatIndian(v: number, decimals: number = DEFAULT_DECIMALS): string {
  if (!Number.isFinite(v)) throw new RangeError(`cannot format ${String(v)}`);
  const fixed = Math.abs(v).toFixed(decimals);
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
