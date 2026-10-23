// Asset class of a base-file "Asset Name" (OD-7; architecture §8; parity row E-22).
//
// Recognised, ignoring letter case and spacing (spaces around a slash included):
//   - the five classes of the legacy Asset Allocation, in its order: Equity, Debt, Hybrid, Commodity and
//     REITs/InvITs (07_engine.js:1147 assetOrder). REITs/InvITs is also an IPS row (11_app_ui.js:3903, 4840) and has a
//     fixed deck colour (deck-design-system.md §2.1); its spaced form "REITs / InvITs" reads as the same class;
//   - "Commodities", which the legacy isCommodity reads as Commodity (07_engine.js:627);
//   - the two synonyms OD-7 names: "Fixed Income" and "Debt Funds" are Debt.
// A blank label stays unknown with a notice instead of becoming Equity (OD-7). Any other label (for example "Gold")
// also stays unknown, kept as given, because reading it as a class would be a guess (CLAUDE.md rule 3). That extends
// OD-7 beyond the blank case and waits for the owner's confirmation (docs/DATA_DICTIONARY.md §8); the legacy made such
// a label its own Asset Allocation row and put the holding in the Equity MF performance bucket. The table grows only
// with the owner's approval (milestone M2.2).

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
  ['reits/invits', 'REITs/InvITs'],
]);

/** OD-7 synonyms (accepted by the owner on 19 Oct 2026, D-021). */
const SYNONYMS = new Map<string, AssetClass>([
  ['fixed income', 'Debt'],
  ['debt funds', 'Debt'],
]);

/** The lookup key: spaces collapsed and trimmed, none around a slash, lower case. */
export function assetKey(label: string | null): string {
  return String(label ?? '').replace(/\s+/g, ' ').trim().replace(/ ?\/ ?/g, '/').toLowerCase();
}

export function readAssetLabel(label: string | null): AssetReading {
  const k = assetKey(label);
  if (k === '') return { assetClass: null, how: 'blank' };
  const direct = LABELS.get(k);
  if (direct) return { assetClass: direct, how: 'label' };
  const syn = SYNONYMS.get(k);
  if (syn) return { assetClass: syn, how: 'synonym' };
  return { assetClass: null, how: 'unrecognised' };
}
