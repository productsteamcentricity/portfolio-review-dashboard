// Money units and percent conversions (architecture §6.7; DATA_DICTIONARY §3; parity row E-03).
//
// Money is held in Crore, unrounded. A base file states its unit in the column label (Cr., Lakh, or rupees);
// display uses the file's unit through one formatter (views/), which is not this module's job.

/** The unit a money column is written in. */
export type MoneyUnit = 'crore' | 'lakh' | 'rupee';

/** Rupees in one unit: 1 Crore = 100 Lakh = 1,00,00,000 rupees. */
export const RUPEES_PER: Readonly<Record<MoneyUnit, number>> = { crore: 1e7, lakh: 1e5, rupee: 1 };

/**
 * A money amount in Crore. Same arithmetic as the legacy pickCr (07_engine.js): Lakh divided by 100, rupees by
 * 1e7, so the two readers agree to the last bit.
 */
export function toCrore(v: number, unit: MoneyUnit): number {
  if (unit === 'crore') return v;
  if (unit === 'lakh') return v / 100;
  return v / 1e7;
}

/** A Crore amount in another unit. */
export function fromCrore(cr: number, unit: MoneyUnit): number {
  if (unit === 'crore') return cr;
  if (unit === 'lakh') return cr * 100;
  return cr * 1e7;
}

/** A fraction (0.0879) as a percent number (8.79), the model's 'pct' unit. */
export function fractionToPct(f: number): number {
  return f * 100;
}

/** A percent number (8.79) as a fraction (0.0879). */
export function pctToFraction(p: number): number {
  return p / 100;
}
