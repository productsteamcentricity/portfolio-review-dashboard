// The legacy matcher, for the matching parity tests (M2 plan v2 §1, §3.2). Test code only.
//
// An adapter over tools/engine-host.js load() (Workstream A's; read and call only, never changed: its stability is
// INFERRED, nothing records a freeze), so the matching tests touch it in one place. It also gives:
//   - the engine block of index.html (located by its marker, as engine-host does) and its SHA-256: the legacy basis
//     recorded in tests/parity/matching-ledger.json;
//   - the three legacy name lists (ALIASES pins and blocks, EXACT_ONLY) parsed out of that block, so the port's lists
//     are checked against the live page instead of being a second copy kept by hand;
//   - the candidate universes in two orders: the legacy's (Object.keys of the embedded blocks) and the shipped one
//     (Object.keys of data/refdata, whose keys scripts/data-extract.ts sorts).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { REPO } from './sheetjs.ts';
import type { UniverseName } from '../../app/src/engine/match/crosswalk.ts';

const require = createRequire(import.meta.url);

export type LegacyMatcher = {
  matchInstrument(name: unknown, amc: unknown, candidates: readonly string[], cache?: Record<string, string[]>): string | null;
  matchPMS(name: unknown, candidates: readonly string[], cache?: Record<string, string[]>): string | null;
  normalize(s: unknown): string[];
  amcKey(s: unknown): string;
  amcDisplay(s: unknown): string;
};

export type LegacyEngine = { E: LegacyMatcher; REF: Record<string, Record<string, unknown>> };

let cached: LegacyEngine | null = null;

/** The shipped engine and REFDATA of index.html, loaded once per test process. */
export function loadLegacyEngine(): LegacyEngine {
  if (!cached) {
    const host = require(path.join(REPO, 'tools', 'engine-host.js')).load();
    cached = { E: host.E as LegacyMatcher, REF: host.REF as Record<string, Record<string, unknown>> };
  }
  return cached;
}

/** The engine block's text (the script whose head carries "Pure compute + PPTX/XLSX builders") and its SHA-256. */
export function engineBlock(): { text: string; sha256: string; indexMd5: string } {
  const html = fs.readFileSync(path.join(REPO, 'index.html'));
  const text = html.toString('utf8');
  const re = /<script([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = text.indexOf('</script>', m.index);
    if (end < 0) break;
    const body = text.slice(m.index + m[0].length, end);
    if (/Pure compute \+ PPTX\/XLSX builders/.test(body.slice(0, 900))) {
      return {
        text: body,
        sha256: crypto.createHash('sha256').update(body, 'utf8').digest('hex'),
        indexMd5: crypto.createHash('md5').update(html).digest('hex').toUpperCase(),
      };
    }
    re.lastIndex = end;
  }
  throw new Error('engine block not found in index.html');
}

export type LegacyNameLists = {
  pins: Array<{ key: string; target: string }>;
  blocks: string[];
  exactOnly: string[];
};

function literalBody(block: string, varName: string): string {
  const start = block.indexOf('var ' + varName + ' = {');
  if (start < 0) throw new Error(varName + ' not found in the engine block');
  const end = block.indexOf('};', start);
  if (end < 0) throw new Error(varName + ' literal has no end');
  return block
    .slice(start, end)
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
}

/** ALIASES (pins and blocks) and EXACT_ONLY (the literal and every later `EXACT_ONLY["..."] = 1`) of the engine block. */
export function parseLegacyNameLists(block: string): LegacyNameLists {
  const pins: Array<{ key: string; target: string }> = [];
  const blocks: string[] = [];
  for (const m of literalBody(block, 'ALIASES').matchAll(/"([^"]+)"\s*:\s*"([^"]*)"/g)) {
    if (m[2] === '') blocks.push(m[1] as string);
    else pins.push({ key: m[1] as string, target: m[2] as string });
  }
  const exactOnly: string[] = [];
  for (const m of literalBody(block, 'EXACT_ONLY').matchAll(/"([^"]+)"\s*:\s*1\b/g)) exactOnly.push(m[1] as string);
  for (const m of block.matchAll(/EXACT_ONLY\["([^"]+)"\]\s*=\s*1\b/g)) exactOnly.push(m[1] as string);
  return { pins, blocks, exactOnly };
}

/** The legacy candidate sets the matchers are given (07_engine.js:1071-1097, 1784-1791; 11_app_ui.js ppResolve). */
export type CandidateSet = { id: string; universe: UniverseName; matcher: 'instrument' | 'pms'; pcls?: string };

export const CANDIDATE_SETS: readonly CandidateSet[] = [
  { id: 'MF_PERF', universe: 'MF_PERF', matcher: 'instrument' },
  { id: 'MF_PERF_DIRECT', universe: 'MF_PERF_DIRECT', matcher: 'instrument' },
  { id: 'SIF_PERF', universe: 'SIF_PERF', matcher: 'instrument' },
  { id: 'AIF_PERF', universe: 'AIF_PERF', matcher: 'instrument' },
  { id: 'PMS_PERF', universe: 'PMS_PERF', matcher: 'pms' },
  { id: 'EQUITY_ANALYTICS:MF', universe: 'EQUITY_ANALYTICS', matcher: 'instrument', pcls: 'MF' },
  { id: 'EQUITY_ANALYTICS:AIF', universe: 'EQUITY_ANALYTICS', matcher: 'instrument', pcls: 'AIF' },
  { id: 'EQUITY_ANALYTICS:PMS', universe: 'EQUITY_ANALYTICS', matcher: 'pms', pcls: 'PMS' },
  { id: 'HYBRID_ANALYTICS:MF', universe: 'HYBRID_ANALYTICS', matcher: 'instrument', pcls: 'MF' },
  { id: 'DEBT_ANALYTICS:MF', universe: 'DEBT_ANALYTICS', matcher: 'instrument', pcls: 'MF' },
  { id: 'MF_RISK', universe: 'MF_RISK', matcher: 'instrument' },
];

/** The keys of one candidate set from a block object, in that object's key order (the legacy splitByClass). */
export function candidateKeys(block: Record<string, unknown> | undefined, set: CandidateSet): string[] {
  const keys = Object.keys(block ?? {});
  if (!set.pcls) return keys;
  return keys.filter((k) => {
    const e = (block as Record<string, unknown>)[k] as { pcls?: unknown; uploaded?: unknown } | undefined;
    const pc = e && typeof e.pcls === 'string' ? e.pcls : '';
    const cls = pc === 'PMS' || pc === 'AIF' ? pc : 'MF';
    return cls === set.pcls;
  });
}

/** A block of data/refdata (the new build's source), parsed. */
export function refdataBlock(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'refdata', name + '.json'), 'utf8')) as Record<string, unknown>;
}

/** FNV-1a 32-bit of a string, as 8 hex digits: the compact basis name set (M2 plan v2 §1 (c)). */
export function fnv32(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
