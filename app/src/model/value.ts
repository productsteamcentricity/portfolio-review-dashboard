// Value<T>: every metric and every number read from a source (docs/DATA_DICTIONARY.md §2, §3; architecture §6.2).
// Types only.

import type { MissingStatus } from './status.ts';

/**
 * Units. Money is held in Crore ('cr'), unrounded. 'pct' is a **percent number**: 8.79 means 8.79 %
 * (decided in M1.3, DATA_DICTIONARY §8); a fraction is never stored with unit 'pct'. 'date' values are
 * DayNumbers. 'pp' percentage points, 'bp' basis points, 'count' a count, 'ratio' a ratio such as Sharpe,
 * 'years', 'days', 'units' (units of a fund held), 'label' a text label. 'inr' is money in rupees, unrounded, and
 * 'inr-per-unit' a price in rupees per unit (the capital-gains and tax records, contract I-37); Crore stays the basis
 * of every weight.
 */
export type Unit =
  | 'cr' | 'inr' | 'inr-per-unit' | 'pct' | 'pp' | 'bp' | 'count' | 'ratio' | 'years' | 'days' | 'units' | 'date'
  | 'label';

/**
 * The unit a money column of a source file is written in (Crore, Lakh or rupees). Declared here since decision C-01,
 * so that model types never import from engine/; engine/units.ts re-exports it.
 */
export type MoneyUnit = 'crore' | 'lakh' | 'rupee';

/**
 * A calendar date as a whole number of days since 1970-01-01 (day 0). Time-zone free: it is converted from the
 * raw Excel serial by one function (engine/dates.ts), never through a local-time Date.
 */
export type DayNumber = number;

/** Where a value came from: source register ids (the file's SHA-256), how it was obtained, its dates. */
export type Provenance = {
  sources: string[];
  method: string;
  asOf?: string;
  vintage?: string;
};

/** A value that is present. Zero is a value. A partial aggregate carries coverage below 1. */
export type PresentValue<T> = {
  kind: 'value';
  v: T;
  unit: Unit;
  prov: Provenance;
  /** Share (0 to 1) of the relevant base the value covers; absent means complete. */
  coverage?: number;
  /** Present but older than the freshness rule of its role: shown with the "s" marker. */
  stale?: { asOf: string };
};

/** A value that is not there, with its status and the reason. Never printed as 0.00, never estimated. */
export type MissingValue = {
  kind: 'missing';
  status: MissingStatus;
  reason: string;
  prov?: Provenance;
};

export type Value<T> = PresentValue<T> | MissingValue;
