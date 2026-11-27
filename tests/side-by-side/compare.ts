// The side-by-side kit, comparison: field by field, keyed rows, each difference tagged with its parity-matrix row
// (docs/new-build/05-feature-parity-matrix.md) and classified by an entry of sbs-ledger.json, or "unclassified".
// Numbers agree within 1e-9 relative plus 1e-12 absolute (as tests/parity/aggregation-compare.ts).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SbsSide } from './shape.ts';

export type Section = 'holdings' | 'performance' | 'scopes' | 'contributions';
export type DiffKind = 'field' | 'only-legacy' | 'only-new' | 'not-built' | 'duplicate-key';
export type Diff = {
  section: Section;
  kind: DiffKind;
  key: string;
  field: string | null;
  legacy: unknown;
  new: unknown;
  matrix: string;
  ledger: string | null;
};
/** compared = rows both engines have a value for (same + different); notCompared = rows one engine cannot give yet. */
export type SectionCount = { compared: number; same: number; different: number; notCompared: number };
export type Comparison = {
  fixture: string;
  counts: Record<Section, SectionCount>;
  diffs: Diff[];
  unclassified: number;
  notes: string[];
};

type Pattern = unknown;
export type LedgerEntry = {
  id: string;
  section: Section | '*';
  kind?: DiffKind | '*';
  field?: string | string[];
  key?: string;
  fixtures: string[] | '*';
  legacy: Pattern;
  new: Pattern;
  /** accepted-difference: the owner accepted that the two builds differ here (reviewed at M15); never a defect. */
  class: 'correction' | 'improvement' | 'not-built' | 'regression' | 'accepted-difference';
  reference: string;
  description: string;
};

const HERE = path.dirname(fileURLToPath(import.meta.url));
export function loadLedger(file = path.join(HERE, 'sbs-ledger.json')): LedgerEntry[] {
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { entries: LedgerEntry[] }).entries;
}

const REL = 1e-9, ABS = 1e-12;
export function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return Math.abs(a - b) <= REL * Math.max(Math.abs(a), Math.abs(b)) + ABS;
  }
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function matchPattern(p: Pattern, v: unknown): boolean {
  if (p === '*') return true;
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    const t = (p as { type?: string }).type;
    if (t === 'number') return typeof v === 'number';
    if (t === 'string') return typeof v === 'string';
  }
  return JSON.stringify(p ?? null) === JSON.stringify(v ?? null);
}
function matchKey(p: string | undefined, key: string): boolean {
  if (p === undefined || p === '*') return true;
  if (p.length > 2 && p.startsWith('/') && p.endsWith('/')) return new RegExp(p.slice(1, -1), 'i').test(key);
  return p === key;
}
export function classify(d: Diff, fixture: string, ledger: readonly LedgerEntry[]): string | null {
  for (const e of ledger) {
    if (e.section !== '*' && e.section !== d.section) continue;
    if (e.kind && e.kind !== '*' && e.kind !== d.kind) continue;
    if (e.field !== undefined) {
      const fs2 = Array.isArray(e.field) ? e.field : [e.field];
      if (!fs2.includes(d.field ?? '')) continue;
    }
    if (!matchKey(e.key, d.key)) continue;
    if (e.fixtures !== '*' && !e.fixtures.includes(fixture)) continue;
    if (!matchPattern(e.legacy, d.legacy) || !matchPattern(e.new, d.new)) continue;
    return e.id;
  }
  return null;
}

function holdingMatrix(field: string, universe: string | null, irr: boolean): string {
  if (field === 'route') return 'E-15';
  if (field === 'matched' || field === 'universe' || field === 'presence') return universe === 'PMS' ? 'E-14' : 'E-13';
  if (field === 'xirr' || field === 'bmxirr') return irr ? 'E-28' : 'E-25';
  return 'E-21';
}

/** Compares the two sides of one fixture. */
export function compareSides(fixture: string, irr: boolean, L: SbsSide, N: SbsSide, ledger: readonly LedgerEntry[]): Comparison {
  const diffs: Diff[] = [];
  const counts = {} as Record<Section, SectionCount>;
  const tally = (s: Section): SectionCount => (counts[s] ??= { compared: 0, same: 0, different: 0, notCompared: 0 });
  for (const s of ['holdings', 'performance', 'scopes', 'contributions'] as const) tally(s);
  const push = (d: Omit<Diff, 'ledger'>): void => { diffs.push({ ...d, ledger: null }); };

  function keyed<T extends { key: string }>(section: Section, a: readonly T[], b: readonly T[], fields: readonly (keyof T & string)[], matrix: (row: T, field: string) => string): void {
    // a key twice on one side would pair the wrong rows (financial review of 5a39d92, finding 1): reported, never merged
    for (const [rows, side] of [[a, 'legacy'], [b, 'new']] as const) {
      const seen = new Set<string>();
      for (const r of rows) {
        if (seen.has(r.key)) push({ section, kind: 'duplicate-key', key: r.key, field: side, legacy: side === 'legacy' ? true : null, new: side === 'new' ? true : null, matrix: matrix(r, 'presence') });
        seen.add(r.key);
      }
    }
    const bm = new Map(b.map((r) => [r.key, r]));
    const am = new Map(a.map((r) => [r.key, r]));
    for (const r of a) {
      const c = tally(section);
      c.compared++;
      const o = bm.get(r.key);
      if (!o) { c.different++; push({ section, kind: 'only-legacy', key: r.key, field: 'presence', legacy: true, new: null, matrix: matrix(r, 'presence') }); continue; }
      let same = true;
      for (const f of fields) {
        if (sameValue(r[f], o[f])) continue;
        same = false;
        push({ section, kind: 'field', key: r.key, field: f, legacy: r[f] ?? null, new: o[f] ?? null, matrix: matrix(r, f) });
      }
      if (same) c.same++; else c.different++;
    }
    for (const r of b) {
      if (am.has(r.key)) continue;
      const c = tally(section);
      c.compared++; c.different++;
      push({ section, kind: 'only-new', key: r.key, field: 'presence', legacy: null, new: true, matrix: matrix(r, 'presence') });
    }
  }

  keyed('holdings', L.holdings, N.holdings, ['route', 'matched', 'universe', 'cmvCr', 'xirr', 'bmxirr'], (r, f) => holdingMatrix(f, r.universe, irr));
  keyed('scopes', L.scopes, N.scopes, ['xirr', 'bmxirr'], (r) => (r.kind === 'advisor' ? 'E-142' : 'E-27'));
  if (L.contributions && N.contributions) keyed('contributions', L.contributions, N.contributions, ['rank', 'cmvCr', 'contribPp'], () => 'E-29');
  if (L.performance && N.performance) {
    keyed('performance', L.performance, N.performance, ['benchmark', 'returns', 'benchReturns'], (_r, f) => (f === 'benchmark' || f === 'benchReturns' ? 'E-30' : 'E-31'));
  } else if (L.performance) {
    for (const r of L.performance) {
      tally('performance').notCompared++;
      push({ section: 'performance', kind: 'not-built', key: r.key, field: null, legacy: r.returns, new: null, matrix: 'E-31' });
    }
  }

  for (const d of diffs) d.ledger = classify(d, fixture, ledger);
  return { fixture, counts, diffs, unclassified: diffs.filter((d) => d.ledger === null).length, notes: [...L.notes, ...N.notes] };
}
