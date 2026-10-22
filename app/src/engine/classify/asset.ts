// Asset class of a base-file "Asset Name" (OD-7; architecture §8; parity row E-22).
//
// Recognised, case- and space-insensitive: the labels the legacy engine itself routes on (Equity, Debt, Hybrid,
// Commodity, Commodities: 07_engine.js bucketOf and isCommodity) and the two synonyms OD-7 names ("Fixed Income"
// and "Debt Funds" are Debt). A blank label stays unknown with a notice instead of becoming Equity (OD-7); any
// other label also stays unknown, kept as given, because reading it as a class would be a guess (CLAUDE.md rule 3).
// The table grows only with the owner's approval (milestone M2.2).

import type { AssetClass } from '../../model/holding.ts';

export type AssetReading =
  | { assetClass: AssetClass; how: 'label' | 'synonym' }
  | { assetClass: null; how: 'blank' | 'unrecognised' };

const LABELS = new Map<string, AssetClass>([
  ['equity', 'Equity'],
  ['debt', 'Debt'],
  ['hybrid', 'Hybrid'],
  ['commodity', 'Commodity'],
  ['commodities', 'Commodity'],
]);

/** OD-7 synonyms (accepted by the owner on 19 Oct 2026, D-021). */
const SYNONYMS = new Map<string, AssetClass>([
  ['fixed income', 'Debt'],
  ['debt funds', 'Debt'],
]);

export function readAssetLabel(label: string | null): AssetReading {
  const k = String(label ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (k === '') return { assetClass: null, how: 'blank' };
  const direct = LABELS.get(k);
  if (direct) return { assetClass: direct, how: 'label' };
  const syn = SYNONYMS.get(k);
  if (syn) return { assetClass: syn, how: 'synonym' };
  return { assetClass: null, how: 'unrecognised' };
}
