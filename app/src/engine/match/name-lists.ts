// The legacy matcher's three name lists, as separate typed lists (parity rows E-13, E-14; roadmap M2.1 sprint 1).
//
// Verbatim from the legacy engine block of main 0e483b6 (index.html, 07_engine.js:146-170 in the reading copy):
//   - ALIASES with a reference name: a PIN, used only when that name is in the universe being matched;
//   - ALIASES with "": a BLOCK, the name is never matched;
//   - EXACT_ONLY: the name matches only its own exact normalised name; no fuzzy match (CR-0010 A2, A2b), including
//     the entry added after the list's literal (07_engine.js:170).
// Keys are normalised names (normalize(name).join(" ")). The order the matcher applies them is in instrument.ts:
// alias (pin or block), exact name, EXACT_ONLY stop, fuzzy.
//
// These lists are the live page's, not a second copy kept by hand: tests/unit/match/name-lists.test.ts parses them out
// of index.html's engine block and requires equality, and reports instead of failing while the engine block differs
// from the recorded basis (tests/parity/matching-ledger.json), until NB-02 ports the change (M2 plan v2 §1 (b), (d)).
// New aliases need the owner's approval (OD-5, PD-36) and are not added here in sprint 1.

export type NamePin = { readonly key: string; readonly target: string; readonly source: string };
export type NameBlock = { readonly key: string; readonly source: string };
export type ExactOnlyName = { readonly key: string; readonly source: string };

/** ALIASES entries with a target: owner-confirmed equivalences and CR-0010 A2b. */
export const PINS: readonly NamePin[] = [
  { key: 'mosaic multiyield fund series i', target: 'Mosaic Asset Management Multiyield Fund', source: 'owner-confirmed equivalence' },
  { key: 'transition venture capital fund 1', target: 'Transition VC Fund', source: 'owner-confirmed equivalence' },
  { key: 'aditya birla sl retirement fund 30s', target: 'Aditya Birla SL Retirement Fund-30-Reg(G)', source: 'CR-0010 A2b' },
  { key: 'aditya birla sl retirement fund 40s', target: 'Aditya Birla SL Retirement Fund-40-Reg(G)', source: 'CR-0010 A2b' },
];

/** ALIASES entries with "": names that snapped onto unrelated funds. */
export const BLOCKS: readonly NameBlock[] = [
  { key: 'icici pru leaders fund series iv', source: 'spurious match: ICICI Pru Commodities Fund' },
  { key: 'nippon equity opp aif scheme 9', source: 'spurious match: Nippon India US Equity Opp Fund' },
  { key: 'icici pru enhanced dynamic equity fund', source: 'spurious match: ICICI Pru Equity & Debt Fund' },
  { key: 'kotak global innovation overseas equity omni fof', source: 'spurious match: Kotak Income Plus Arbitrage' },
];

/** EXACT_ONLY: no fuzzy match for these names, in every universe (CR-0010 A2, A2b). */
export const EXACT_ONLY: readonly ExactOnlyName[] = [
  { key: 'motilal nasdaq 100 etf', source: 'CR-0010 A2' },
  { key: 'aditya birla sl global emerging opp fund', source: 'CR-0010 A2' },
  { key: 'aditya birla sl retirement fund 40', source: 'CR-0010 A2' },
  { key: 'aditya birla sl retirement fund 30', source: 'CR-0010 A2' },
  { key: 'aditya birla sl retirement fund 40s', source: 'CR-0010 A2' },
  { key: 'aditya birla sl retirement fund 30s', source: 'CR-0010 A2b (added after the literal)' },
];

const PIN_BY_KEY: ReadonlyMap<string, string> = new Map(PINS.map((p) => [p.key, p.target]));
const BLOCKED: ReadonlySet<string> = new Set(BLOCKS.map((b) => b.key));
const EXACT_ONLY_KEYS: ReadonlySet<string> = new Set(EXACT_ONLY.map((e) => e.key));

/** The alias entry of a normalised key: a pin's target, "" for a block, or undefined when the key is not listed. */
export function aliasFor(key: string): string | undefined {
  if (BLOCKED.has(key)) return '';
  return PIN_BY_KEY.get(key);
}

export function isExactOnlyKey(key: string): boolean {
  return EXACT_ONLY_KEYS.has(key);
}
