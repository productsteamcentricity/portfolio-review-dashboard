// Constructors and readers for Value<T> (model/value.ts). Pure functions, no globals.

import type { MissingValue, PresentValue, Provenance, Unit, Value } from '../model/value.ts';
import type { MissingStatus } from '../model/status.ts';

/**
 * A present value. A number must be finite: NaN and Infinity are refused here, so they can never reach an
 * output (AC-19). Coverage, when given, must lie in [0, 1].
 */
export function present<T>(
  v: T,
  unit: Unit,
  prov: Provenance,
  extra?: { coverage?: number; stale?: { asOf: string } },
): PresentValue<T> {
  if (typeof v === 'number' && !Number.isFinite(v)) {
    throw new RangeError(`a value must be a finite number (got ${String(v)}; ${prov.method})`);
  }
  const out: PresentValue<T> = { kind: 'value', v, unit, prov };
  if (extra && extra.coverage !== undefined) {
    const c = extra.coverage;
    if (!(c >= 0 && c <= 1)) throw new RangeError(`coverage must lie in [0, 1] (got ${String(c)})`);
    out.coverage = c;
  }
  if (extra && extra.stale) out.stale = { asOf: extra.stale.asOf };
  return out;
}

/** A missing value with its status and reason. */
export function missing(status: MissingStatus, reason: string, prov?: Provenance): MissingValue {
  const out: MissingValue = { kind: 'missing', status, reason };
  if (prov) out.prov = prov;
  return out;
}

export function isPresent<T>(x: Value<T>): x is PresentValue<T> {
  return x.kind === 'value';
}

/** The number for arithmetic, or null when missing. Never returns 0 for a missing value. */
export function numberOrNull(x: Value<number>): number | null {
  return x.kind === 'value' ? x.v : null;
}
