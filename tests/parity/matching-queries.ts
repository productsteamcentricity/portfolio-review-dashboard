// The query names of the matching parity test and the basis name set (M2 plan v2 §1 (c), §3.2). Test code only.
//
//   node tests/parity/matching-queries.ts --write-basis   rewrite tests/parity/matching-basis.json (NB-02 only, when
//                                                         porting a live matcher change; never asked of a CHAT-007 PR)

import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../helpers/sheetjs.ts';
import { CANDIDATE_SETS, candidateKeys, engineBlock, fnv32, parseLegacyNameLists, refdataBlock } from '../helpers/legacy-engine.ts';
import { SYNTHETIC_BOOK } from '../fixtures/make-books.ts';
import { BLOCKS, EXACT_ONLY, PINS } from '../../app/src/engine/match/name-lists.ts';

export type Query = { name: string; amcs: readonly string[]; origin: string; named?: boolean };

/** The base-file spelling a vendor name may come in: the first word of the name stands in for an AMC label. */
export const firstWord = (n: string): string => n.split(/[\s(]+/)[0] ?? '';

/** Deterministic perturbations: letter case, spacing round hyphens, the Regular-Growth suffix, plan and option text. */
export function perturb(name: string): string[] {
  const out = [
    name.toUpperCase(),
    name.replace(/-/g, ' - '),
    name.replace(/\((G|IDCW)\)/g, '').replace(/-Reg\b/, '') + ' - Regular Plan - Growth',
    name.replace(/\bFund\b/, '').replace(/\s+/g, ' ').trim(),
  ];
  return [...new Set(out)].filter((s) => s !== name && s.trim() !== '');
}

/** Every name of every candidate set, in set order then key order, without repeats. */
export function universeNames(blocks: (u: string) => Record<string, unknown> | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of CANDIDATE_SETS) for (const k of candidateKeys(blocks(s.universe), s)) if (!seen.has(k)) { seen.add(k); out.push(k); }
  return out;
}

/** The named cases: every key of the port's three lists and of the legacy's parsed lists (a dropped entry fails). */
export function namedKeys(engineText: string): string[] {
  const legacy = parseLegacyNameLists(engineText);
  const keys = [
    ...PINS.map((p) => p.key), ...BLOCKS.map((b) => b.key), ...EXACT_ONLY.map((e) => e.key),
    ...legacy.pins.map((p) => p.key), ...legacy.blocks, ...legacy.exactOnly,
  ];
  return [...new Set(keys)];
}

/** The query list: a sample (every stride-th universe name) with perturbations of every 10th sampled name, the
 * synthetic book's names with their AMC labels, and every named key. stride 1 is the full sweep. */
export function buildQueries(names: readonly string[], engineText: string, stride: number): Query[] {
  const q: Query[] = [];
  let sampled = 0;
  names.forEach((n, i) => {
    if (i % stride !== 0) return;
    q.push({ name: n, amcs: ['', firstWord(n)], origin: n });
    if (sampled++ % 10 === 0) for (const p of perturb(n)) q.push({ name: p, amcs: [''], origin: n });
  });
  for (const r of SYNTHETIC_BOOK) q.push({ name: r.name, amcs: ['', r.amc], origin: r.name });
  for (const k of namedKeys(engineText)) q.push({ name: k, amcs: [''], origin: k, named: true });
  return q;
}

export type Basis = { schema: string; matcherSliceSha256: string; engineBlockSha256: string; indexMd5: string; count: number; names: string[] };

export const BASIS_FILE = path.join(REPO, 'tests', 'parity', 'matching-basis.json');

export function readBasis(): Basis {
  return JSON.parse(fs.readFileSync(BASIS_FILE, 'utf8')) as Basis;
}

if (process.argv.includes('--write-basis')) {
  const block = engineBlock();
  const all = new Set<string>(universeNames(refdataBlock));
  for (const r of SYNTHETIC_BOOK) all.add(r.name);
  for (const k of namedKeys(block.text)) all.add(k);
  const names = [...new Set([...all].map(fnv32))].sort();
  const basis: Basis = { schema: 'matching-basis-v1', matcherSliceSha256: block.matcherSha256, engineBlockSha256: block.sha256, indexMd5: block.indexMd5, count: names.length, names };
  fs.writeFileSync(BASIS_FILE, JSON.stringify(basis) + '\n');
  console.log(`matching-basis.json: ${names.length} names, matcher slice ${block.matcherSha256.slice(0, 12)}, index.html ${block.indexMd5}`);
}
