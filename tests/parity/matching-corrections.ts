// Measures the sprint 2a matcher corrections both ways over the real universes (CLAUDE.md rule 4; roadmap M2.1
// acceptance; KI-036, KI-101). Test code only.
//
//   node tests/parity/matching-corrections.ts --write-ledger   full sweep; rewrites
//                                                              tests/parity/matching-corrections-ledger.json (NB-02)
//
// Two measures per instrument-matcher candidate set of data/refdata (the legacy's own universes):
//   - self: every reference name, and its deterministic misspellings (perturb), must still find itself. A query the
//     legacy answered correctly and the corrected matcher does not is a REGRESSION.
//   - leave-one-out: each reference name is removed from its universe and matched against the rest. Any answer that is
//     not the same scheme (a different normalised name) is a WRONG match; the correct answer is no match.
//   - amfi: official AMFI scheme names (tests/parity/amfi-names.json, public) must resolve to the vendor name that
//     FUND_RANKS_CODES ties to the same scheme code: the real-world spellings a base file carries. A name the legacy
//     resolved correctly and the corrected matcher does not is a REGRESSION.
// Every query whose answer changes is recorded, so each changed match has its own ledger entry.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CANDIDATE_SETS, candidateKeys, refdataBlock } from '../helpers/legacy-engine.ts';
import { firstWord, perturb } from './matching-queries.ts';
import { matchInstrument, type MatchOptions, type TokenCache } from '../../app/src/engine/match/instrument.ts';
import { nameKey } from '../../app/src/engine/match/normalize.ts';
import { AMFI_NAMES, type AmfiNames } from './amfi-names.ts';
import { buildMatchContext } from '../../app/src/engine/match/resolve-holdings.ts';
import { committedBlocks } from '../helpers/match-blocks.ts';
import { parseOwnerAliases, type OwnerAliasTable } from '../../app/src/engine/match/owner-aliases.ts';

export type ChangeKind = 'to-null' | 'from-null' | 'other-answer';
export type Change = { set: string; measure: 'self' | 'loo' | 'amfi'; query: string; amc: string; legacy: string | null; corrected: string | null; kind: ChangeKind; correct: 'fixed' | 'regressed' | 'neither' };
export type Report = {
  stride: number;
  namesBasis: string;
  self: { queries: number; lostLegacy: number; lostCorrected: number; fixed: number; regressed: number };
  loo: { queries: number; wrongLegacy: number; wrongCorrected: number; wrongRemoved: number; wrongAdded: number };
  amfi: { queries: number; okLegacy: number; okCorrected: number; wrongLegacy: number; wrongCorrected: number; fixed: number; regressed: number };
  changes: Change[];
};

const kindOf = (l: string | null, c: string | null): ChangeKind => (c === null ? 'to-null' : l === null ? 'from-null' : 'other-answer');

/** SHA-256 of the instrument candidate sets' names, in set order: the data a ledger was measured on. */
export function namesBasis(): string {
  const h = crypto.createHash('sha256');
  for (const s of CANDIDATE_SETS) if (s.matcher === 'instrument') h.update(`${s.id}${String.fromCharCode(10)}${candidateKeys(refdataBlock(s.universe), s).join(String.fromCharCode(10))}`);
  return h.digest('hex');
}

/** Legacy against corrected (opts), both measures. stride N measures every N-th name (1: the full sweep). */
export function measure(opts: MatchOptions, stride = 1): Report {
  const r: Report = { stride, namesBasis: namesBasis(), self: { queries: 0, lostLegacy: 0, lostCorrected: 0, fixed: 0, regressed: 0 }, loo: { queries: 0, wrongLegacy: 0, wrongCorrected: 0, wrongRemoved: 0, wrongAdded: 0 }, amfi: { queries: 0, okLegacy: 0, okCorrected: 0, wrongLegacy: 0, wrongCorrected: 0, fixed: 0, regressed: 0 }, changes: [] };
  for (const set of CANDIDATE_SETS) {
    if (set.matcher !== 'instrument') continue;
    const keys = candidateKeys(refdataBlock(set.universe), set);
    const cache: TokenCache = new Map();
    keys.forEach((k, i) => {
      if (i % stride !== 0) return;
      const queries: Array<[string, string]> = [[k, ''], [k, firstWord(k)], ...perturb(k).map((p): [string, string] => [p, ''])];
      for (const [q, amc] of queries) {
        r.self.queries++;
        const l = matchInstrument(q, amc, keys, cache);
        const c = matchInstrument(q, amc, keys, cache, opts);
        if (l !== k) r.self.lostLegacy++;
        if (c !== k) r.self.lostCorrected++;
        if (l === c) continue;
        const correct = l !== k && c === k ? 'fixed' : l === k && c !== k ? 'regressed' : 'neither';
        if (correct === 'fixed') r.self.fixed++;
        if (correct === 'regressed') r.self.regressed++;
        r.changes.push({ set: set.id, measure: 'self', query: q, amc, legacy: l, corrected: c, kind: kindOf(l, c), correct });
      }
      const rest = keys.filter((x) => x !== k);
      const nk = nameKey(k);
      const wrong = (a: string | null): boolean => a !== null && nameKey(a) !== nk;
      r.loo.queries++;
      const l = matchInstrument(k, '', rest, cache);
      const c = matchInstrument(k, '', rest, cache, opts);
      if (wrong(l)) r.loo.wrongLegacy++;
      if (wrong(c)) r.loo.wrongCorrected++;
      if (l === c) return;
      const correct = wrong(l) && !wrong(c) ? 'fixed' : !wrong(l) && wrong(c) ? 'regressed' : 'neither';
      if (correct === 'fixed') r.loo.wrongRemoved++;
      if (correct === 'regressed') r.loo.wrongAdded++;
      r.changes.push({ set: set.id, measure: 'loo', query: k, amc: '', legacy: l, corrected: c, kind: kindOf(l, c), correct });
    });
  }
  const amfi = JSON.parse(fs.readFileSync(AMFI_NAMES, 'utf8')) as AmfiNames;
  const mf = candidateKeys(refdataBlock('MF_PERF'), CANDIDATE_SETS.find((x) => x.id === 'MF_PERF')!);
  const mfSet = new Set(mf);
  const cache: TokenCache = new Map();
  amfi.pairs.forEach((p, i) => {
    if (i % stride !== 0 || !mfSet.has(p.vendorKey)) return;
    r.amfi.queries++;
    const l = matchInstrument(p.amfiName, '', mf, cache);
    const c = matchInstrument(p.amfiName, '', mf, cache, opts);
    if (l === p.vendorKey) r.amfi.okLegacy++; else if (l !== null) r.amfi.wrongLegacy++;
    if (c === p.vendorKey) r.amfi.okCorrected++; else if (c !== null) r.amfi.wrongCorrected++;
    if (l === c) return;
    const correct = l !== p.vendorKey && c === p.vendorKey ? 'fixed' : l === p.vendorKey && c !== p.vendorKey ? 'regressed' : 'neither';
    if (correct === 'fixed') r.amfi.fixed++;
    if (correct === 'regressed') r.amfi.regressed++;
    r.changes.push({ set: 'MF_PERF', measure: 'amfi', query: p.amfiName, amc: '', legacy: l, corrected: c, kind: kindOf(l, c), correct });
  });
  return r;
}

/** The vocabulary the page matches with: buildMatchContext's knownWords on the committed blocks, the names of the
 * instrument universes the page carries (MF_PERF, SIF_PERF, AIF_PERF). The measure uses exactly what ships, so the
 * vocabulary and this ledger change together when a universe joins the page. In the leave-one-out measure it includes
 * the removed fund's own words: the guard then rejects more, never less, and the official-names measure is unaffected. */
export function knownWordsOfReference(): ReadonlySet<string> {
  const k = buildMatchContext(committedBlocks()).options.knownWords;
  if (!k) throw new Error('the page match context carries no knownWords');
  return k;
}

/** The owner's aliases as committed (data/owner/fund-aliases.json), as the page carries them. */
export function ownerAliasesOfReference(): OwnerAliasTable {
  return parseOwnerAliases(committedBlocks().OWNER_FUND_ALIASES);
}
/** The id of the last stage: everything the page matches with, the owner's aliases included. */
export const ALIAS_STAGE = 'Owner aliases, lines 1 to 22 (the owner, 25 and 28 Nov 2026)';

/** The corrections in the order they land; each stage is measured with everything before it switched on. */
export const STAGES: ReadonlyArray<{ id: string; opts: MatchOptions }> = [
  { id: 'KI-036 no answer decided by candidate order', opts: { nullOnTies: true } },
  { id: 'KI-101 fund-house words are not distinctive', opts: { nullOnTies: true, houseTokens: true } },
  { id: 'Option B, the stricter regime (the owner, 26 Nov 2026)', opts: { nullOnTies: true, houseTokens: true, absentFundGuard: true } },
  { id: 'Normaliser v2 and the candidate-side word guard (follow-up, 26 Nov 2026)', opts: { nullOnTies: true, houseTokens: true, absentFundGuard: true, normaliserV2: true, candidateWordGuard: true, knownWords: knownWordsOfReference() } },
  { id: ALIAS_STAGE, opts: { nullOnTies: true, houseTokens: true, absentFundGuard: true, normaliserV2: true, candidateWordGuard: true, knownWords: knownWordsOfReference(), ownerAliases: ownerAliasesOfReference() } },
];

export const LEDGER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'matching-corrections-ledger.json');

if (process.argv.includes('--write-ledger')) {
  const stages = STAGES.map((s) => ({ id: s.id, opts: s.opts, report: measure(s.opts, 1) }));
  /* a Set (knownWords) is recorded by its size: its words are the reference data's, rebuilt on every run; the owner's
     alias table by its number of lines and the file's date */
  const replacer = (k: string, v: unknown): unknown => (v instanceof Set ? `${v.size} words (normalizeV2 tokens)`
    : k === 'ownerAliases' && v !== null && typeof v === 'object' ? `${(v as OwnerAliasTable).byKey.size} lines (data/owner/fund-aliases.json)` : v);
  fs.writeFileSync(LEDGER, `${JSON.stringify({ written: 'full sweep (stride 1)', stages }, replacer, 1)}\n`);
  for (const s of stages) console.log(s.id, JSON.stringify({ self: s.report.self, loo: s.report.loo, amfi: s.report.amfi, changes: s.report.changes.length }));
}
