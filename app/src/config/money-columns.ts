// How the base-file reader treats a field written in more than one money column (KI-147; D-039).
//
// A base file may carry the same amount in Crore, Lakh and rupee columns. The reader takes the Crore column, then
// Lakh, then rupees (the legacy precedence), and:
//   - text that is not an amount in the column it would use (for example "12abc", or a percent) makes the amount
//     INVALID SOURCE DATA. No later column is used in its place; a holding whose market value is invalid is excluded
//     from every total and listed (the owner's answer of 24 Oct 2026: "no fallback");
//   - a blank cell, or a placeholder such as "NA" or "-", is not an amount: the reader takes the next column, as it
//     does for a Lakh-only or rupee-only file, with an Information notice naming the column used (lead's decision);
//   - when the amount used and a later column's amount are both numbers and differ by more than the tolerance below
//     (plus 1e-9), a Warning names both columns and the amount used is kept (lead's decision).
// The tolerance is half of the last place of a Crore amount shown to two decimals.

export type MoneyColumnRule = {
  readonly invalidText: 'invalid-source';
  readonly crossCheckToleranceCr: number;
};

export const MONEY_COLUMN_RULE: MoneyColumnRule = { invalidText: 'invalid-source', crossCheckToleranceCr: 0.005 };
