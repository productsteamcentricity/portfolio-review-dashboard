// Generated key columns that join the workbook's formulas to the holdings (M1.4; D-039 point 5). SUMIFS criteria
// refer to these keys, to canonical asset-class names and to Yes/No flags, never to free text: Excel's text
// criteria ignore letter case and read * ? ~ as wildcards, while the engine groups by exact labels.
//
// P01, P02 ... products; L01 ... liquidity labels; C01 ... clients; D01 ... distributors; each numbered by first
// appearance in the holdings, in file order. C00 and D00 stand for "not given".

export type KeyPrefix = 'P' | 'L' | 'C' | 'D';

export const CLIENT_NOT_GIVEN_KEY = 'C00';
export const DISTRIBUTOR_NOT_GIVEN_KEY = 'D00';

/** The n-th key of a prefix: P01 ... P99, then P100. */
export function keyOf(prefix: KeyPrefix, n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`keys: bad number ${n}`);
  return `${prefix}${String(n).padStart(2, '0')}`;
}

/**
 * Keys by first appearance. A value listed in `notGiven` (for example the "no client" id) takes the given key
 * instead of a number.
 */
export function keysByFirstAppearance(values: Iterable<string>, prefix: KeyPrefix,
  notGiven: { value: string; key: string } | null = null): Map<string, string> {
  const keys = new Map<string, string>();
  let n = 0;
  for (const v of values) {
    if (keys.has(v)) continue;
    if (notGiven !== null && v === notGiven.value) keys.set(v, notGiven.key);
    else keys.set(v, keyOf(prefix, ++n));
  }
  return keys;
}
