// Sums of values that may be missing (architecture §8; DATA_DICTIONARY §2). A missing value is never added as 0: it
// is counted, and the caller decides what a partial sum means (coverage, OD-18, KI-007).

import type { Value } from '../../model/value.ts';
import { STATUS } from '../../model/status.ts';

export type SumResult = {
  /** The sum of the present values, added in array order; 0 when none is present (check `present`). */
  sum: number;
  present: number;
  missing: number;
  /** Missing values whose status is INVALID SOURCE DATA (counted in `missing` too). */
  invalid: number;
};

export function sumPresent(values: readonly Value<number>[]): SumResult {
  let sum = 0;
  let present = 0;
  let missing = 0;
  let invalid = 0;
  for (const v of values) {
    if (v.kind === 'value') {
      sum = present === 0 ? v.v : sum + v.v;
      present++;
    } else {
      missing++;
      if (v.status === STATUS.INVALID_SOURCE) invalid++;
    }
  }
  return { sum, present, missing, invalid };
}
