// The side-by-side kit (test build 1): the one shape both engines are projected into, so compare.ts can compare them
// field by field. Money in Crore, XIRR as a fraction (0.125 = 12.5%), names as each engine holds them.

/** One holding of the base file, keyed the same way on both sides: client, instrument name, folio, product and
 * distributor, normalised (both engines merge rows on client, name, product and distributor, so a fund held through two
 * distributors or under two products is two holdings). A key twice on one side is reported as duplicate-key. */
export type SbsHolding = {
  key: string;
  client: string;
  name: string;
  amc: string;
  folio: string;
  cmvCr: number | null;
  /** The holding's XIRR in the base file (fraction), before any IRR file: not compared, used to show the IRR path ran. */
  baseXirr: number | null;
  /** The matched reference entry (a key of MF_PERF, PMS_PERF, AIF_PERF, SIF_PERF or, for a listed share, STOCK_RET), or
   * null when unmatched. */
  matched: string | null;
  /** The universe the match was found in: 'MF' | 'PMS' | 'AIF' | 'SIF' | 'STOCK', or null when unmatched. */
  universe: string | null;
  /** Where the holding is looked up (E-15): 'MF' | 'PMS' | 'AIF' | 'SIF' | 'STOCK' (a listed share), or
   * 'other (<class label>)' for a non-MF class of PRODUCT_CLASS_RULES (LP-16: no fund data by design). Legacy: from the
   * engine's own h.directEquity and h.pcls. New: the wired resolver's route (resolveHoldings). A difference is a real
   * routing difference between the builds and fails unless the ledger classifies it. */
  route: string;
  /** How the new side matched, with its confidence ("isin (exact)", "alias-pin (pinned)", "name-match (exact)",
   * "none (unmatched)", "not-routed (a non-MF class)"); shown, never compared. The legacy has no such field (null). */
  method: string | null;
  /** The holding's XIRR as each engine shows it (the transaction XIRR when an IRR file is given), as a fraction. */
  xirr: number | null;
  bmxirr: number | null;
};

/** One fund row of the performance view: the matched fund's returns and its benchmark's, per tenor. */
export type SbsPerfRow = {
  key: string;
  bucket: string;
  fund: string;
  returns: Record<string, number | null>;
  benchmark: string | null;
  benchReturns: Record<string, number | null>;
};

/** One XIRR scope: the family, a client (by label) or an adviser (by label). */
export type SbsScope = { key: string; kind: 'family' | 'client' | 'advisor'; label: string; xirr: number | null; bmxirr: number | null };

/** One contributors/laggards line. */
export type SbsContribution = { key: string; list: 'contributors' | 'laggards' | 'drags'; rank: number; cmvCr: number; contribPp: number };

export type SbsSide = {
  engine: 'legacy' | 'new';
  holdings: SbsHolding[];
  /** null: the engine has no performance view yet (the new build until M3b, E-31). */
  performance: SbsPerfRow[] | null;
  scopes: SbsScope[];
  contributions: SbsContribution[] | null;
  notes: string[];
};

export type SbsInput = { baseBytes: Uint8Array; irrBytes: Uint8Array | null; asOn: string; label: string };

/** The holding key both sides use: client | instrument name | folio | product | distributor, lower case, spaces folded. */
export function holdingKey(client: unknown, name: unknown, folio: unknown, product: unknown, distributor: unknown): string {
  const n = (v: unknown): string => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${n(client)} | ${n(name)} | ${n(folio)} | ${n(product)} | ${n(distributor)}`;
}

/** A label key: lower case, spaces folded (for scopes and buckets). */
export function labelKey(v: unknown): string {
  return String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}
