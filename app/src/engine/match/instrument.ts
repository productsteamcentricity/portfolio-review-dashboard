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
//   - houseTokens (KI-101; the house-word half of the audit's NEW-4 fix; with nullOnTies): a fund house's words
//     (houseWords: the leading words at least 90% of its names share) and the holding's own AMC words never count as
//     distinctive. The thresholds are unchanged, so this only rejects more. The audit's idf weighting was measured
//     and not adopted: as a guard it lost correct official AMFI names, as a ranking it added wrong matches
//     (tests/parity/matching-corrections.ts).
//   - absentFundGuard (option B; the owner chose this stricter regime on 26 Nov 2026, so NEW_BUILD_MATCHING has it on):
//     a candidate is rejected when the holding's name leaves unmatched a word the candidate set knows but that is in
//     fewer than 5% of its names (a word the set does not know, such as a misspelling, never counts). Measured: about
//     41% fewer wrong matches for funds absent from the vendor data, and 21 of 1,206 official AMFI names that match
//     correctly today become unmatched (mostly normaliser gaps, a measured follow-up of sprint 2a).
//   - normaliserV2 and candidateWordGuard (the follow-up, NEW_BUILD_MATCHING has both): matching tokens come from
//     normalizeV2 (normalize.ts: "(Formerly Known as ...)" dropped, "S&P" before "BSE" dropped, letters and digits
//     split, a few compounds and synonyms), while the alias and name lists keep their legacy keys; and the
//     stricter regime's guard also checks the candidate's own extra words, so a short name never sits inside a longer,
//     different fund ("Sundaram Services Fund" inside "Sundaram Fin Serv Opp Fund"). Measured in
//     tests/parity/matching-corrections.ts.

import { aliasFor, isExactOnlyKey } from './name-lists.ts';
import { nameKey, normalize, normalizeV2 } from './normalize.ts';
import { ownerAliasOf, ownerAliasTarget, wordsOf, type OwnerAliasTable } from './owner-aliases.ts';

/** Normalised tokens of candidate names, kept between calls (the legacy candNormCache). */
export type TokenCache = Map<string, string[]>;

/** The sprint 2a corrections, each off unless given. */
export type MatchOptions = {
  /** The owner's fund aliases (data/owner/fund-aliases.json, parsed by parseOwnerAliases). */
  ownerAliases?: OwnerAliasTable;
  /** KI-036: no answer decided by candidate order. */
  nullOnTies?: boolean;
  /** KI-101: fund-house words (houseWords, and the holding's AMC words) never count as distinctive. Needs nullOnTies. */
  houseTokens?: boolean;
  /** Option B: reject a candidate that leaves a known rare word of the holding's name unmatched (see above). Needs
   * nullOnTies. */
  absentFundGuard?: boolean;
  /** Matching tokens from normalizeV2 (the alias and name lists keep their legacy keys). */
  normaliserV2?: boolean;
  /** With absentFundGuard: also reject a candidate whose own known rare words are left unmatched. */
  candidateWordGuard?: boolean;
};

/** The new build's matching (the owner's answers of 25 and 26 Nov 2026): KI-036, KI-101 and the stricter regime (B).
 * The caller adds the owner's aliases. The parity tests call the matcher without options, as the legacy. */
export const NEW_BUILD_MATCHING: Readonly<Pick<MatchOptions, 'nullOnTies' | 'houseTokens' | 'absentFundGuard' | 'normaliserV2' | 'candidateWordGuard'>> = Object.freeze({
  nullOnTies: true,
  houseTokens: true,
  absentFundGuard: true,
  normaliserV2: true,
  candidateWordGuard: true,
});

/** Option B's bar: a known word in fewer than this share of a candidate set's names is informative. */
export const ABSENT_FUND_SHARE = 0.05;
/* Per candidate set and per normaliser (the token cache passed in decides which). */
const dfCache = new WeakMap<TokenCache, WeakMap<readonly string[], ReadonlyMap<string, number>>>();
const NO_CACHE: TokenCache = new Map();

/** In how many names of a candidate set each word appears. */
function documentFrequency(candidates: readonly string[], cache?: TokenCache): ReadonlyMap<string, number> {
  let byCands = dfCache.get(cache ?? NO_CACHE);
  if (!byCands) dfCache.set(cache ?? NO_CACHE, (byCands = new WeakMap()));
  const hit = byCands.get(candidates);
  if (hit) return hit;
  const df = new Map<string, number>();
  for (const c of candidates) for (const t of new Set(tokensOf(c, cache))) df.set(t, (df.get(t) ?? 0) + 1);
  byCands.set(candidates, df);
  return df;
}

/** Option B: true when the holding's name leaves unmatched a word the set knows and fewer than ABSENT_FUND_SHARE of
 * its names carry ("fund" and house words never count). */
function leavesKnownRareWord(nt: readonly string[], ct: readonly string[], isHouse: ((t: string) => boolean) | undefined, candidates: readonly string[], cache: TokenCache | undefined, bothSides = false): boolean {
  const df = documentFrequency(candidates, cache);
  const bar = ABSENT_FUND_SHARE * candidates.length;
  const cs = new Set(ct);
  for (const t of new Set(nt)) {
    if (cs.has(t) || t === 'fund' || (isHouse && isHouse(t))) continue;
    const d = df.get(t) ?? 0;
    if (d > 0 && d < bar) return true;
  }
  if (bothSides) {
    const qs = new Set(nt);
    for (const t of cs) {
      if (qs.has(t) || t === 'fund' || (isHouse && isHouse(t))) continue;
      const d = df.get(t) ?? 0;
      if (d > 0 && d < bar) return true;
    }
  }
  return false;
}

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

/** The fuzzy score of one candidate, or null when it does not clear the bar (07_engine.js:206-226). With isHouse
 * (KI-101), a fund-house word never counts as distinctive; the thresholds themselves are unchanged (CLAUDE.md rule 4),
 * so this only ever rejects more. */
export function fuzzyScore(nameTokens: readonly string[], amcTok: string, candTokens: readonly string[], isHouse?: (t: string) => boolean): { shared: number; jaccard: number } | null {
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
      if (t !== amcTok && t !== 'fund' && !(isHouse && isHouse(t))) distinct++;
    }
  }
  for (const t of candTokens) uni.add(t);
  const minLen = Math.min(nameTokens.length, candTokens.length);
  if (!((sharedSig >= 3 && distinct >= 2) || (shared >= 2 && shared === minLen && distinct >= 1))) return null;
  return { shared, jaccard: shared / uni.size };
}

/** KI-101 (the audit's NEW-4 fix): a house's words are the leading words that at least this share of its names have. */
export const HOUSE_SHARE = 0.9;
const houseCache = new WeakMap<TokenCache, WeakMap<readonly string[], ReadonlyMap<string, ReadonlySet<string>>>>();

/** The fund-house words of a candidate set, by first word: the first word, then each next leading word that at least
 * HOUSE_SHARE of the names starting with that prefix carry ("aditya birla sl", "icici pru", "franklin india"). A house
 * with fewer than 3 names keeps only its first word, so one fund's whole name never becomes house words. */
export function houseWords(candidates: readonly string[], cache?: TokenCache): ReadonlyMap<string, ReadonlySet<string>> {
  let byCands = houseCache.get(cache ?? NO_CACHE);
  if (!byCands) houseCache.set(cache ?? NO_CACHE, (byCands = new WeakMap()));
  const hit = byCands.get(candidates);
  if (hit) return hit;
  const groups = new Map<string, string[][]>();
  for (const c of candidates) {
    const t = tokensOf(c, cache);
    if (t.length === 0) continue;
    const g = groups.get(t[0]!);
    if (g) g.push(t);
    else groups.set(t[0]!, [t]);
  }
  const out = new Map<string, ReadonlySet<string>>();
  for (const [first, names] of groups) {
    const prefix = [first];
    if (names.length >= 3) {
      for (let i = 1; i < 6; i++) {
        const counts = new Map<string, number>();
        for (const t of names) if (t.length > i && prefix.every((w, j) => t[j] === w)) counts.set(t[i]!, (counts.get(t[i]!) ?? 0) + 1);
        let top = '';
        let n = 0;
        for (const [w, k] of counts) if (k > n) { top = w; n = k; }
        if (n === 0 || n / names.length < HOUSE_SHARE) break;
        prefix.push(top);
      }
    }
    out.set(first, new Set(prefix));
  }
  byCands.set(candidates, out);
  return out;
}

/** The exact and fuzzy steps with KI-036's correction: raw name first, then no answer that candidate order decides. */
function correctedTail(name: unknown, nt: string[], key: string, amcTok: string, candidates: readonly string[], cache?: TokenCache, opts?: MatchOptions, amc?: unknown, legacyKey?: string): MatchDetail {
  const raw = String(name ?? '').trim();
  if (raw !== '' && candidates.includes(raw)) return { key: raw, step: 'exact' };
  const exact = candidates.filter((c) => tokensOf(c, cache).join(' ') === key);
  if (exact.length === 1) return { key: exact[0]!, step: 'exact' };
  if (exact.length > 1) {
    const k = byOption(name, exact);
    return k === null ? { key: null, step: 'exact-ambiguous' } : { key: k, step: 'exact' };
  }
  if (isExactOnlyKey(legacyKey ?? key)) return { key: null, step: 'exact-only-stop' };
  const houses = opts?.houseTokens ? houseWords(candidates, cache) : undefined;
  const amcWords = opts?.houseTokens ? new Set(opts.normaliserV2 ? normalizeV2(amc) : normalize(amc)) : undefined;
  let tied: string[] = [];
  let bestShared = 0;
  let bestJac = 0;
  for (const c of candidates) {
    const ct = tokensOf(c, cache);
    const own = houses ? houses.get(ct[0] ?? '') : undefined;
    const isHouse = houses ? (t: string): boolean => amcWords!.has(t) || (own !== undefined && own.has(t)) : undefined;
    const s = fuzzyScore(nt, amcTok, ct, isHouse);
    if (!s) continue;
    if (opts?.absentFundGuard && leavesKnownRareWord(nt, ct, isHouse, candidates, cache, !!opts.candidateWordGuard)) continue;
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
/* normalizeV2 tokens of candidates, kept beside each legacy token cache (or one shared map without a cache). */
const v2Caches = new WeakMap<TokenCache, TokenCache>();
const v2Default: TokenCache = new Map();
export function matchInstrumentDetail(name: unknown, amc: unknown, candidates: readonly string[], cache?: TokenCache, opts?: MatchOptions): MatchDetail {
  if (opts?.normaliserV2) {
    let c2 = cache ? v2Caches.get(cache) : v2Default;
    if (!c2) v2Caches.set(cache!, (c2 = new Map()));
    for (const c of candidates) if (!c2.has(c)) c2.set(c, normalizeV2(c));
    cache = c2;
  }
  const legacyKey = nameKey(name);
  const nt = opts?.normaliserV2 ? normalizeV2(name) : normalize(name);
  const key = nt.join(' ');
  const alias = aliasFor(legacyKey);
  if (alias !== undefined) {
    if (alias === '') return { key: null, step: 'block' };
    for (const c of candidates) if (c === alias) return { key: alias, step: 'pin' };
  }
  if (opts?.ownerAliases) {
    const own = ownerAliasOf(name, legacyKey, opts.ownerAliases);
    const target = own ? ownerAliasTarget(name, own, candidates) : undefined;
    if (target !== undefined) return { key: target, step: 'owner-alias' };
  }
  const amcTok = (opts?.normaliserV2 ? normalizeV2(amc) : normalize(amc))[0] ?? nt[0] ?? '';
  if (opts?.candidateWordGuard && !opts.absentFundGuard) throw new Error('matchInstrument: candidateWordGuard extends absentFundGuard; set it too');
  if (opts?.absentFundGuard && !opts.nullOnTies) throw new Error('matchInstrument: absentFundGuard applies on the corrected path; set nullOnTies too');
  if (opts?.houseTokens && !opts.nullOnTies) throw new Error('matchInstrument: houseTokens applies on the corrected path; set nullOnTies too');
  if (opts?.nullOnTies) return correctedTail(name, nt, key, amcTok, candidates, cache, opts, amc, legacyKey);
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
