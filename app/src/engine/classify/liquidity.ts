// Liquidity of a holding (parity row E-18; D-039 point 8): the legacy rule ported as it is (07_engine.js:607-615).
// Milestone M2.2 turns its rules into data. When the base file has a Liquidity column with any label, the label wins
// and the rule only fills a blank (07_engine.js:1174-1180).

import type { Holding } from '../../model/holding.ts';

export type LiquidityClass = 'Open Ended' | 'Close Ended';

/** The legacy liquidityClass: AIFs, unlisted and pre-IPO products, and closed, interval, FMP and solution schemes are Close Ended. */
export function liquidityClass(product: string | null, category: string | null): LiquidityClass {
  const p = String(product ?? '').toLowerCase();
  const k = String(category ?? '').toLowerCase();
  if (p.indexOf('aif') >= 0) return 'Close Ended';
  // Unlisted equity (for example pre-IPO shares) and similar illiquid instruments.
  if (/\bunlisted\b|pre[\s-]?ipo/.test(p)) return 'Close Ended';
  if (/close|interval|fmp|fixed maturity|solution|children|retirement plan/.test(k)) return 'Close Ended';
  // ELSS is an open-ended scheme with a statutory lock-in: Open Ended, as in the legacy.
  return 'Open Ended';
}

/** The liquidity label of a holding: the file's label when the file has any (a blank takes the rule), else the rule. */
export function liquidityLabel(h: Holding, fileHasLabels: boolean): string {
  const rule = (): string => liquidityClass(h.product, h.categoryLabel);
  if (!fileHasLabels) return rule();
  return h.liquidity ?? rule();
}
