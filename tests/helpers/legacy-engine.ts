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

/**
 * The matcher slice of the engine block: from `var AMC_DISPLAY` to the start of the TAXATION section, which holds the
 * AMC tables and key, the normaliser, the three name lists, matchInstrument and matchPMS (07_engine.js:16-272 at
 * 0e483b6). Its SHA-256 is the coupling basis: an edit elsewhere in the engine (a builder, a tax rule) does not switch
 * the matching tests to report-only (financial review of f32ee9c, M1).
 */
export function matcherSlice(block: string): string {
  const start = block.indexOf('var AMC_DISPLAY');
  const tax = block.indexOf('TAXATION');
  const end = tax < 0 ? -1 : block.lastIndexOf('/*', tax);
  if (start < 0 || end <= start) throw new Error('matcher slice not found in the engine block');
  return block.slice(start, end);
}

/** The engine block's text (the script whose head carries "Pure compute + PPTX/XLSX builders"), its SHA-256 and the
 * SHA-256 of its matcher slice. */
export function engineBlock(): { text: string; sha256: string; matcherSha256: string; indexMd5: string } {
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
        matcherSha256: crypto.createHash('sha256').update(matcherSlice(body), 'utf8').digest('hex'),
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

/** The parsers block of index.html (its head carries "RUNTIME REFERENCE PARSERS") and the SHA-256 of its MF Monitor
 * slice (from `function findHeader` to the PMS and AIF performance section): the coupling basis of the monitor parity
 * test (M2 plan v2 §1 (b)). */
export function monitorParserSlice(): { sha256: string } {
  const text = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const re = /<script([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = text.indexOf('</script>', m.index);
    if (end < 0) break;
    const body = text.slice(m.index + m[0].length, end);
    if (/RUNTIME REFERENCE PARSERS/.test(body.slice(0, 900))) {
      const a = body.indexOf('function findHeader');
      const b = body.indexOf('/* ---- PMS & AIF performance');
      if (a < 0 || b <= a) throw new Error('MF Monitor slice not found in the parsers block');
      return { sha256: crypto.createHash('sha256').update(body.slice(a, b), 'utf8').digest('hex') };
    }
    re.lastIndex = end;
  }
  throw new Error('parsers block not found in index.html');
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

/** A flat object literal of the engine block (`var NAME = { k:"v", "k2":1, ... };`) as entries, comments removed. Keys
 * may be quoted or bare; values are a quoted string or 1. Used for the AMC tables, which ENGINE does not expose. */
export function parseLegacyTable(block: string, varName: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of literalBody(block, varName).matchAll(/["']?([A-Za-z0-9_]+)["']?\s*:\s*(?:"([^"]*)"|(1))/g)) out.push([m[1] as string, m[2] ?? (m[3] as string)]);
  return out;
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
