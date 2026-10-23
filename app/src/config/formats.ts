// Display conventions that are configuration, not code (architecture §6.4; D-029).

/** The missing-value marker: an em dash (U+2014), alone in its cell or tile, always with a status footnote. */
export const MISSING_MARKER = '—';
/** Marker after a STALE DATA value. */
export const STALE_MARKER = 's';
/** Marker after a PARTIAL COVERAGE value. */
export const PARTIAL_MARKER = 'p';
/** Decimals shown for amounts and percentages (inflation uses one, set by its renderer). */
export const DEFAULT_DECIMALS = 2;
