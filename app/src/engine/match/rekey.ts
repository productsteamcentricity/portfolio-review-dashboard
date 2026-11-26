// Joins between reference blocks of the same scheme (parity rows E-103, E-104, E-13; KI-052, OD-23, KI-054; roadmap
// M2.1 sprint 2a). Deterministic: no fuzzy matching anywhere here.
//
// KI-052 (the audit's NEW-6): FUND_RANKS and MF_RISK are keyed under older spellings than MF_PERF ("Kotak Flexicap" /
// "Kotak Flexi Cap"), and a few under a scheme's old name. rekeyBlock maps each key of such a block onto the current
// universe key of the same scheme:
//   1. 'exact': the same key;
//   2. 'normalised': the only universe key with the same normalised name, the same plan (Direct or not) and the same
//      option (Growth, IDCW, bonus);
//   3. 'normalised', second tier: the same, with the word "fund" ignored ("Canara Rob ELSS Tax Saver" / "... Tax Saver
//      Fund"), still only when exactly one universe key has it;
//   4. 'alias': an owner-approved rename (data/owner/fund-aliases.json; OD-23 lets the renamed schemes' ranks show
//      under their new names, same scheme and same AMFI code), its target for the key's own plan.
// A block key that resolves to no universe key is listed as unresolved; two block keys that resolve to one universe key
// are a conflict and neither is used (an exact key wins over a derived one). A block's values are never changed.
//
// KI-054 (the audit's NEW-8): the Direct-plan view took a Direct row by name matching, so 308 of 2,071 schemes showed
// a different scheme's figures. directTwin accepts a Direct key only when its normalised name, with any "(Adjusted)"
// removed, equals the Regular key's, and the option agrees; otherwise there is no twin (the caller shows a blank row
// with a note, CLAUDE.md rule 3). Option variants (Growth and IDCW) of one scheme hold one portfolio, so lookThroughKey
// lets an IDCW holding use its scheme's Growth analytics when only that row exists.

import { nameKey } from './normalize.ts';
import { optionOf } from './instrument.ts';
import { ownerAliasOf, wordsOf, type OwnerAliasTable } from './owner-aliases.ts';

export type RekeyVia = 'exact' | 'normalised' | 'alias';
export type Rekeyed = { blockKey: string; via: RekeyVia };
export type RekeyResult = {
  /** Universe key to the block key that holds its values. */
  byUniverseKey: ReadonlyMap<string, Rekeyed>;
  unresolved: readonly string[];
  /** Universe keys more than one block key resolved to; none of them is used. */
  conflicts: ReadonlyArray<{ universeKey: string; blockKeys: readonly string[] }>;
};

/** True when a key names the Direct plan. */
export function isDirectKey(k: string): boolean {
  return ` ${wordsOf(k)} `.includes(' direct ');
}

/** The normalised scheme identity of a key: name, plan and option; with noFund, the word "fund" ignored. */
function identity(k: string, noFund = false): string {
  const n = noFund ? nameKey(k).split(' ').filter((w) => w !== 'fund').join(' ') : nameKey(k);
  return `${n}|${isDirectKey(k) ? 'direct' : 'regular'}|${optionOf(k)}`;
}

export function rekeyBlock(blockKeys: readonly string[], universeKeys: readonly string[], aliases?: OwnerAliasTable): RekeyResult {
  const uni = new Set(universeKeys);
  const byIdentity = new Map<string, string[]>();
  const byIdentityNoFund = new Map<string, string[]>();
  const add = (m: Map<string, string[]>, id: string, u: string): void => {
    const list = m.get(id);
    if (list) list.push(u);
    else m.set(id, [u]);
  };
  for (const u of universeKeys) {
    add(byIdentity, identity(u), u);
    add(byIdentityNoFund, identity(u, true), u);
  }
  const claims = new Map<string, Rekeyed[]>();
  const unresolved: string[] = [];
  const claim = (u: string, r: Rekeyed): void => {
    const list = claims.get(u);
    if (list) list.push(r);
    else claims.set(u, [r]);
  };
  for (const b of blockKeys) {
    if (uni.has(b)) { claim(b, { blockKey: b, via: 'exact' }); continue; }
    const same = byIdentity.get(identity(b)) ?? [];
    if (same.length === 1) { claim(same[0]!, { blockKey: b, via: 'normalised' }); continue; }
    const near = same.length === 0 ? byIdentityNoFund.get(identity(b, true)) ?? [] : [];
    if (near.length === 1) { claim(near[0]!, { blockKey: b, via: 'normalised' }); continue; }
    if (aliases) {
      const a = ownerAliasOf(b, nameKey(b), aliases);
      const target = a ? (isDirectKey(b) ? a.direct : a.regular) : undefined;
      if (target !== undefined && uni.has(target)) { claim(target, { blockKey: b, via: 'alias' }); continue; }
    }
    unresolved.push(b);
  }
  const byUniverseKey = new Map<string, Rekeyed>();
  const conflicts: Array<{ universeKey: string; blockKeys: string[] }> = [];
  for (const [u, list] of claims) {
    const exact = list.filter((r) => r.via === 'exact');
    if (list.length === 1) byUniverseKey.set(u, list[0]!);
    else if (exact.length === 1) byUniverseKey.set(u, exact[0]!);
    else conflicts.push({ universeKey: u, blockKeys: list.map((r) => r.blockKey) });
  }
  return { byUniverseKey, unresolved, conflicts };
}

const ADJUSTED = /[(]adjusted[)]/gi;

/** KI-054: the Direct key of the same scheme as a Regular key, or null (no twin: a blank row, never a substitute). */
export function directTwin(regularKey: string, directKeys: readonly string[]): string | null {
  const want = nameKey(regularKey);
  const opt = optionOf(regularKey);
  const hits = directKeys.filter((d) => nameKey(d.replace(ADJUSTED, ' ')) === want && optionOf(d) === opt);
  if (hits.length === 1) return hits[0]!;
  if (hits.length > 1) {
    /* the plain row before an "(Adjusted)" duplicate of the same scheme */
    const plain = hits.filter((d) => !ADJUSTED.test(d));
    ADJUSTED.lastIndex = 0;
    return plain.length === 1 ? plain[0]! : null;
  }
  return null;
}

/** Look-through: the analytics key for a fund key, its own row first, else its scheme's other option (one portfolio). */
export function lookThroughKey(fundKey: string, analyticsKeys: readonly string[]): string | null {
  if (analyticsKeys.includes(fundKey)) return fundKey;
  const want = nameKey(fundKey);
  const plan = isDirectKey(fundKey);
  const hits = analyticsKeys.filter((k) => nameKey(k) === want && isDirectKey(k) === plan);
  if (hits.length === 1) return hits[0]!;
  const growth = hits.filter((k) => optionOf(k) === 'growth');
  return growth.length === 1 ? growth[0]! : null;
}
