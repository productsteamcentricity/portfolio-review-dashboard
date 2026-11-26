// The legacy instrument matcher, at parity (parity row E-13; roadmap M2.1 sprint 1; CLAUDE.md rule 4).
//
// A faithful port of matchInstrument() and isExactOnly() of the legacy engine block (index.html, 07_engine.js:169-230
// in the reading copy of main 0e483b6). The steps, in the legacy order:
//   1. alias: a BLOCK returns no match; a PIN returns its target when the target is one of the candidates (otherwise
//      matching goes on);
//   2. exact name: the first candidate, in candidate order, whose normalised key equals the name's;
//   3. EXACT_ONLY stop: a listed name gets no fuzzy match;
//   4. fuzzy: the brand anchor (the AMC's first normalised token, else the name's own first token) must be a token of
//      the candidate; accept at least 3 shared tokens of 2 or more characters of which at least 2 are distinctive (not
//      the anchor, not "fund"), or a fully contained shorter name sharing at least 2 tokens of which 1 is distinctive;
//      the most shared tokens win, then the higher Jaccard ratio, and on equal scores the FIRST candidate (strict >).
// The thresholds are never lowered. Product class is never crossed: the caller passes only the candidates of the
// holding's own class (07_engine.js:1143-1146), and so does every caller of this module.
//
// Candidate order decides two answers (the first equal exact name, the first of equal fuzzy scores; KI-036):
// tests/parity/matching.parity.test.ts compares the shipped order (data/refdata, sorted keys) with the legacy's embedded
// order and ledgers each such difference until sprint 2 returns null on ties.

//
// Sprint 2a corrections are opt-in through MatchOptions, so the legacy behaviour above stays the default and the
// parity tests keep measuring it:
//   - ownerAliases (owner-aliases.ts; KI-050, PD-36): after the legacy alias step and before the exact name, an
//     owner-approved rename resolves the old name to the renamed fund, where that fund is a candidate (step
//     'owner-alias').
//   - nullOnTies (KI-036; the audit's fix): candidate order never decides an answer. A candidate equal to the raw name
//     wins first. When several candidates share the normalised name, or several tie on the fuzzy score, the holding's
//     own option decides if the tied candidates are option variants of one scheme (G against IDCW: the tied keys share
//     one normalised name); otherwise there is no match (steps 'exact-ambiguous', 'fuzzy-tie').

import { aliasFor, isExactOnlyKey } from './name-lists.ts';
import { nameKey, normalize } from './normalize.ts';
import { ownerAliasOf, ownerAliasTarget, wordsOf, type OwnerAliasTable } from './owner-aliases.ts';

/** Normalised tokens of candidate names, kept between calls (the legacy candNormCache). */
export type TokenCache = Map<string, string[]>;

/** The sprint 2a corrections, each off unless given. */
export type MatchOptions = {
  /** The owner's fund aliases (data/owner/fund-aliases.json, parsed by parseOwnerAliases). */
  ownerAliases?: OwnerAliasTable;
  /** KI-036: no answer decided by candidate order. */
  nullOnTies?: boolean;
};

export type MatchStep =
  | 'block' | 'pin' | 'owner-alias' | 'exact' | 'exact-ambiguous' | 'exact-only-stop' | 'fuzzy' | 'fuzzy-tie' | 'none';

export type PlanOption = 'growth' | 'idcw' | 'bonus';

const IDCW_WORDS = ['idcw', 'dividend', 'div', 'payout', 'reinvestment', 'reinvest'];

/** The option a name states: IDCW (any dividend wording), bonus, else growth (the default when none is stated).
 * "Dividend Yield" is a fund category, part of the scheme's name, not an option. */
export function optionOf(name: unknown): PlanOption {
  const w = ` ${wordsOf(name)} `.split(' dividend yield ').join(' ');
  if (IDCW_WORDS.some((x) => w.includes(` ${x} `))) return 'idcw';
  if (w.includes(' bonus ')) return 'bonus';
  return 'growth';
}

/** Among option variants of one scheme, the one with the holding's own option; null unless exactly one has it. */
function byOption(name: unknown, tied: readonly string[]): string | null {
  const want = optionOf(name);
  const hit = tied.filter((c) => optionOf(c) === want);
  return hit.length === 1 ? hit[0]! : null;
}

export type MatchDetail = {
  key: string | null;
  step: MatchStep;
  /** For a fuzzy match: the shared-token count and Jaccard ratio of the winner. */
  shared?: number;
  jaccard?: number;
};

function tokensOf(candidate: string, cache: TokenCache | undefined): string[] {
  if (!cache) return normalize(candidate);
  let t = cache.get(candidate);
  if (!t) {
    t = normalize(candidate);
    cache.set(candidate, t);
  }
  return t;
}

/** The fuzzy score of one candidate, or null when it does not clear the bar (07_engine.js:206-226). */
export function fuzzyScore(nameTokens: readonly string[], amcTok: string, candTokens: readonly string[]): { shared: number; jaccard: number } | null {
  if (amcTok && !candTokens.includes(amcTok)) return null;
  const ctset = new Set(candTokens);
  const uni = new Set<string>();
  let shared = 0;
  let sharedSig = 0;
  let distinct = 0;
  for (const t of nameTokens) {
    uni.add(t);
    if (ctset.has(t)) {
      shared++;
      if (t.length >= 2) sharedSig++;
      if (t !== amcTok && t !== 'fund') distinct++;
    }
  }
  for (const t of candTokens) uni.add(t);
  const minLen = Math.min(nameTokens.length, candTokens.length);
  if (!((sharedSig >= 3 && distinct >= 2) || (shared >= 2 && shared === minLen && distinct >= 1))) return null;
  return { shared, jaccard: shared / uni.size };
}

/** The exact and fuzzy steps with KI-036's correction: raw name first, then no answer that candidate order decides. */
function correctedTail(name: unknown, nt: string[], key: string, amcTok: string, candidates: readonly string[], cache?: TokenCache): MatchDetail {
  const raw = String(name ?? '').trim();
  if (raw !== '' && candidates.includes(raw)) return { key: raw, step: 'exact' };
  const exact = candidates.filter((c) => tokensOf(c, cache).join(' ') === key);
  if (exact.length === 1) return { key: exact[0]!, step: 'exact' };
  if (exact.length > 1) {
    const k = byOption(name, exact);
    return k === null ? { key: null, step: 'exact-ambiguous' } : { key: k, step: 'exact' };
  }
  if (isExactOnlyKey(key)) return { key: null, step: 'exact-only-stop' };
  let tied: string[] = [];
  let bestShared = 0;
  let bestJac = 0;
  for (const c of candidates) {
    const s = fuzzyScore(nt, amcTok, tokensOf(c, cache));
    if (!s) continue;
    if (s.shared > bestShared || (s.shared === bestShared && s.jaccard > bestJac)) {
      tied = [c];
      bestShared = s.shared;
      bestJac = s.jaccard;
    } else if (s.shared === bestShared && s.jaccard === bestJac) {
      tied.push(c);
    }
  }
  if (tied.length === 0) return { key: null, step: 'none' };
  if (tied.length === 1) return { key: tied[0]!, step: 'fuzzy', shared: bestShared, jaccard: bestJac };
  /* option variants of one scheme share one normalised name; anything else is a real tie */
  const oneScheme = new Set(tied.map((c) => tokensOf(c, cache).join(' '))).size === 1;
  const k = oneScheme ? byOption(name, tied) : null;
  return k === null ? { key: null, step: 'fuzzy-tie', shared: bestShared, jaccard: bestJac } : { key: k, step: 'fuzzy', shared: bestShared, jaccard: bestJac };
}

/** matchInstrument with the step that decided it. */
export function matchInstrumentDetail(name: unknown, amc: unknown, candidates: readonly string[], cache?: TokenCache, opts?: MatchOptions): MatchDetail {
  const nt = normalize(name);
  const key = nt.join(' ');
  const alias = aliasFor(key);
  if (alias !== undefined) {
    if (alias === '') return { key: null, step: 'block' };
    for (const c of candidates) if (c === alias) return { key: alias, step: 'pin' };
  }
  if (opts?.ownerAliases) {
    const own = ownerAliasOf(name, key, opts.ownerAliases);
    const target = own ? ownerAliasTarget(name, own, candidates) : undefined;
    if (target !== undefined) return { key: target, step: 'owner-alias' };
  }
  const amcTok = normalize(amc)[0] ?? nt[0] ?? '';
  if (opts?.nullOnTies) return correctedTail(name, nt, key, amcTok, candidates, cache);
  for (const c of candidates) {
    if (tokensOf(c, cache).join(' ') === key) return { key: c, step: 'exact' };
  }
  if (isExactOnlyKey(key)) return { key: null, step: 'exact-only-stop' };
  let best: string | null = null;
  let bestShared = 0;
  let bestJac = 0;
  for (const c of candidates) {
    const s = fuzzyScore(nt, amcTok, tokensOf(c, cache));
    if (!s) continue;
    if (s.shared > bestShared || (s.shared === bestShared && s.jaccard > bestJac)) {
      best = c;
      bestShared = s.shared;
      bestJac = s.jaccard;
    }
  }
  return best === null ? { key: null, step: 'none' } : { key: best, step: 'fuzzy', shared: bestShared, jaccard: bestJac };
}

/** The legacy matchInstrument(name, amc, candidates, cache): the matched candidate, or null. */
export function matchInstrument(name: unknown, amc: unknown, candidates: readonly string[], cache?: TokenCache, opts?: MatchOptions): string | null {
  return matchInstrumentDetail(name, amc, candidates, cache, opts).key;
}

/** The legacy isExactOnly(name). */
export function isExactOnly(name: unknown): boolean {
  return isExactOnlyKey(nameKey(name));
}
