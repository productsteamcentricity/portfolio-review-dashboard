// The legacy PMS matcher, at parity (parity row E-14; roadmap M2.1 sprint 1; CLAUDE.md rule 4).
//
// A faithful port of PMS_JUNK, pmsTok(), pmsLev(), pmsTokEq() and matchPMS() of the legacy engine block (index.html,
// 07_engine.js:232-272 in the reading copy of main 0e483b6). PMS names are free-form and carry no AMC column, so the
// brand anchor is the client name's first token; tokens are equal when identical, when SYN maps both to one form, when
// two words of 6 or more letters differ by one edit, or when one word of 4 or more letters is a prefix of the other.
// The most shared tokens win, then the higher Jaccard ratio; an exact tie of both is ambiguous and gives no match.

import { LEGACY_PROTOTYPE_TOKENS, SYN, legacyString } from './normalize.ts';

/** Words dropped from PMS names (07_engine.js:233). */
export const PMS_JUNK: ReadonlySet<string> = new Set([
  'pms', 'portfolio', 'strategy', 'strategies', 'fund', 'plan', 'scheme', 'the', 'of', 'and', 'a', 'an', 'approach', 'approaches', 'investment',
]);

export type PmsCache = Map<string, string[]>;

export function pmsTok(s: unknown): string[] {
  const t = legacyString(s).toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9 ]/g, ' ');
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of t.split(/\s+/)) {
    if (!w || PMS_JUNK.has(w) || LEGACY_PROTOTYPE_TOKENS.has(w)) continue;
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

/** Edit distance, returning 2 early when the lengths differ by more than one (07_engine.js:240-245). */
export function pmsLev(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return 2;
  let prev: number[] = [];
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= lb; j++) {
      cur[j] = Math.min((prev[j] as number) + 1, (cur[j - 1] as number) + 1, (prev[j - 1] as number) + (a.charAt(i - 1) !== b.charAt(j - 1) ? 1 : 0));
    }
    prev = cur;
  }
  return prev[lb] as number;
}

export function pmsTokEq(a: string, b: string): boolean {
  if (a === b) return true;
  const ca = SYN.get(a) ?? a;
  const cb = SYN.get(b) ?? b;
  if (ca === cb) return true;
  if (a.length >= 6 && b.length >= 6 && pmsLev(a, b) <= 1) return true;
  if (a.length >= 4 && b.length >= 4 && (a.indexOf(b) === 0 || b.indexOf(a) === 0) && Math.min(a.length, b.length) >= 4) return true;
  return false;
}

/** The legacy matchPMS(name, candidates, cache): the matched candidate, or null (also null when ambiguous). */
export function matchPMS(name: unknown, candidates: readonly string[], cache?: PmsCache): string | null {
  const nt = pmsTok(name);
  if (!nt.length) return null;
  const brand = nt[0] as string;
  let best: string | null = null;
  let bS = -1;
  let bJ = -1;
  let amb = false;
  for (const c of candidates) {
    let ct = cache ? cache.get(c) : undefined;
    if (!ct) {
      ct = pmsTok(c);
      if (cache) cache.set(c, ct);
    }
    let bp = false;
    for (const t of ct) {
      if (pmsTokEq(brand, t)) {
        bp = true;
        break;
      }
    }
    if (!bp) continue;
    let shared = 0;
    for (const t of nt) {
      for (const u of ct) {
        if (pmsTokEq(t, u)) {
          shared++;
          break;
        }
      }
    }
    if (shared < 1) continue;
    const clen = nt.length;
    const uni = clen + ct.length - shared;
    const jac = uni ? shared / uni : 0;
    if (!(shared >= 2 || shared === clen)) continue;
    if (shared > bS || (shared === bS && jac > bJ)) {
      best = c;
      bS = shared;
      bJ = jac;
      amb = false;
    } else if (shared === bS && Math.abs(jac - bJ) < 1e-9 && c !== best) {
      amb = true;
    }
  }
  return amb ? null : best;
}
