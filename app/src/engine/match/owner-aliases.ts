// The owner's fund aliases: renamed schemes (parity row E-13 correction; KI-050; OD-5, PD-36; roadmap M2.1 sprint 2a).
//
// data/owner/fund-aliases.json holds one line per owner-approved rename: an old scheme name and the renamed fund's
// Regular and Direct vendor keys, with public evidence. A client file can still carry the old name, while the vendor
// data carries only the new one; without an alias the matcher would either propose a different fund (the legacy
// fuzzy step) or, once corrected, find nothing.
//
// Rules (approved with the list, 25 Nov 2026):
//   - the key is normalize(oldName).join(' '); parseOwnerAliases refuses a line whose key differs, so a change to the
//     normaliser cannot silently detach an alias;
//   - an alias applies only where its target is one of the candidates being matched, so it never crosses product
//     class or reaches a universe that lacks the renamed fund (there the normal steps go on);
//   - it covers both plans: a holding whose own name has the word "direct" tries the direct target first, any other
//     holding the regular target first;
//   - requiresPhrase, when given, must appear as whole words in the holding's own name. Line 17 needs it: the
//     normaliser drops "regular" as a plan word, so "ICICI Pru Regular Savings Fund" and "ICICI Pru Savings Fund" (a
//     different debt fund) share a key.
// The module is pure: the caller passes the parsed table (matchInstrumentDetail's options); nothing reads files here.

import { nameKey } from './normalize.ts';

export type OwnerAlias = {
  readonly line: number;
  readonly oldName: string;
  readonly key: string;
  readonly regular: string;
  readonly direct: string;
  readonly requiresPhrase?: string;
};

export type OwnerAliasTable = {
  readonly decision: string;
  readonly approved: string;
  readonly byKey: ReadonlyMap<string, OwnerAlias>;
};

const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function str(v: unknown, what: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`fund-aliases: ${what} must be a non-empty string`);
  return v;
}

/** Lower-case words of a name, joined by single spaces (punctuation and repeated spaces dropped). */
export function wordsOf(name: unknown): string {
  return String(name ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w !== '').join(' ');
}

/** Validates data/owner/fund-aliases.json and indexes it by key. Throws on any malformed or inconsistent line. */
export function parseOwnerAliases(json: unknown): OwnerAliasTable {
  if (!json || typeof json !== 'object') throw new Error('fund-aliases: not an object');
  const j = json as Record<string, unknown>;
  if (j.table !== 'fund-aliases') throw new Error('fund-aliases: table must be "fund-aliases"');
  const decision = str(j.decision, 'decision');
  const approved = str(j.approved, 'approved');
  if (!DATE.test(approved)) throw new Error('fund-aliases: approved must be YYYY-MM-DD');
  if (!Array.isArray(j.aliases)) throw new Error('fund-aliases: aliases must be an array');
  const byKey = new Map<string, OwnerAlias>();
  const lines = new Set<number>();
  for (const raw of j.aliases as unknown[]) {
    if (!raw || typeof raw !== 'object') throw new Error('fund-aliases: an alias is not an object');
    const a = raw as Record<string, unknown>;
    const line = a.line;
    if (typeof line !== 'number' || !Number.isInteger(line) || line < 1) throw new Error('fund-aliases: line must be a positive integer');
    if (lines.has(line)) throw new Error(`fund-aliases: line ${line} appears twice`);
    lines.add(line);
    const oldName = str(a.oldName, `line ${line} oldName`);
    const key = str(a.key, `line ${line} key`);
    if (nameKey(oldName) !== key) throw new Error(`fund-aliases: line ${line} key "${key}" is not the normalised old name "${nameKey(oldName)}"`);
    if (byKey.has(key)) throw new Error(`fund-aliases: line ${line} repeats the key "${key}"`);
    const regular = str(a.regular, `line ${line} regular`);
    const direct = str(a.direct, `line ${line} direct`);
    if (nameKey(regular) === key || nameKey(direct) === key) throw new Error(`fund-aliases: line ${line} points to its own old name`);
    if (!Array.isArray(a.evidence) || a.evidence.length === 0) throw new Error(`fund-aliases: line ${line} has no evidence`);
    let requiresPhrase: string | undefined;
    if (a.requiresPhrase !== undefined) {
      requiresPhrase = str(a.requiresPhrase, `line ${line} requiresPhrase`);
      if (wordsOf(requiresPhrase) !== requiresPhrase) throw new Error(`fund-aliases: line ${line} requiresPhrase must be lower-case words`);
      if (!wordsOf(oldName).includes(requiresPhrase)) throw new Error(`fund-aliases: line ${line} old name lacks its own requiresPhrase`);
    }
    byKey.set(key, requiresPhrase === undefined ? { line, oldName, key, regular, direct } : { line, oldName, key, regular, direct, requiresPhrase });
  }
  return { decision, approved, byKey };
}

/** The owner alias that applies to a holding name, or undefined (no line, or the line's phrase guard fails). */
export function ownerAliasOf(name: unknown, key: string, table: OwnerAliasTable): OwnerAlias | undefined {
  const a = table.byKey.get(key);
  if (!a) return undefined;
  if (a.requiresPhrase !== undefined && !` ${wordsOf(name)} `.includes(` ${a.requiresPhrase} `)) return undefined;
  return a;
}

/** The alias target among the candidates: the holding's own plan first (the word "direct" in its name), else the
 * other plan; undefined when neither target is a candidate. */
export function ownerAliasTarget(name: unknown, alias: OwnerAlias, candidates: readonly string[]): string | undefined {
  const direct = ` ${wordsOf(name)} `.includes(' direct ');
  const order = direct ? [alias.direct, alias.regular] : [alias.regular, alias.direct];
  for (const t of order) if (candidates.includes(t)) return t;
  return undefined;
}
