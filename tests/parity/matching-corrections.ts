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
// Every query whose answer changes is recorded, so each changed match has its own ledger entry.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CANDIDATE_SETS, candidateKeys, refdataBlock } from '../helpers/legacy-engine.ts';
import { firstWord, perturb } from './matching-queries.ts';
import { matchInstrument, type MatchOptions, type TokenCache } from '../../app/src/engine/match/instrument.ts';
import { nameKey } from '../../app/src/engine/match/normalize.ts';

export type ChangeKind = 'to-null' | 'from-null' | 'other-answer';
export type Change = { set: string; measure: 'self' | 'loo'; query: string; amc: string; legacy: string | null; corrected: string | null; kind: ChangeKind; correct: 'fixed' | 'regressed' | 'neither' };
export type Report = {
  stride: number;
  namesBasis: string;
  self: { queries: number; lostLegacy: number; lostCorrected: number; fixed: number; regressed: number };
  loo: { queries: number; wrongLegacy: number; wrongCorrected: number; wrongRemoved: number; wrongAdded: number };
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
  const r: Report = { stride, namesBasis: namesBasis(), self: { queries: 0, lostLegacy: 0, lostCorrected: 0, fixed: 0, regressed: 0 }, loo: { queries: 0, wrongLegacy: 0, wrongCorrected: 0, wrongRemoved: 0, wrongAdded: 0 }, changes: [] };
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
  return r;
}

/** The corrections in the order they land; each stage is measured with everything before it switched on. */
export const STAGES: ReadonlyArray<{ id: string; opts: MatchOptions }> = [
  { id: 'KI-036 no answer decided by candidate order', opts: { nullOnTies: true } },
];

export const LEDGER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'matching-corrections-ledger.json');

if (process.argv.includes('--write-ledger')) {
  const stages = STAGES.map((s) => ({ id: s.id, opts: s.opts, report: measure(s.opts, 1) }));
  fs.writeFileSync(LEDGER, `${JSON.stringify({ written: 'full sweep (stride 1)', stages }, null, 1)}\n`);
  for (const s of stages) console.log(s.id, JSON.stringify({ self: s.report.self, loo: s.report.loo, changes: s.report.changes.length }));
}
