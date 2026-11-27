// The side-by-side kit, comparison: field by field, keyed rows, each difference tagged with its parity-matrix row
// (docs/new-build/05-feature-parity-matrix.md) and classified by an entry of sbs-ledger.json, or "unclassified".
// Numbers agree within 1e-9 relative plus 1e-12 absolute (as tests/parity/aggregation-compare.ts).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SbsPerfRow, SbsSide } from './shape.ts';

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
/** One holding whose route or matched entry differs between the builds, for the report's "Fund matching" summary. */
export type MatchingRow = {
  key: string;
  name: string;
  route: string;
  legacy: string | null;
  new: string | null;
  /** The new build's method and confidence (shown, never compared). */
  method: string | null;
  ledger: string | null;
  class: LedgerEntry['class'] | null;
  reference: string | null;
};
export type MatchingSummary = { compared: number; same: number; rows: MatchingRow[] };
export type Comparison = {
  fixture: string;
  counts: Record<Section, SectionCount>;
  diffs: Diff[];
  unclassified: number;
  /** Fund matching (E-13, E-14, E-15): holdings both sides have, how many match alike, and every one that does not. */
  matching: MatchingSummary;
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
  /** accepted-difference: the owner accepted that the two builds differ here (reviewed at M15); never a defect.
   * known-gap: the live page is right and the new build is not, under a decided regime, with the owner's ruling still
   * open; it passes the test but its entry must say so ("not yet ruled on by the owner"). */
  class: 'correction' | 'improvement' | 'not-built' | 'regression' | 'accepted-difference' | 'known-gap';
  reference: string;
  description: string;
  /** A performance entry whose figures follow a holding's matching difference (the entry id, SB-08 to SB-17): it takes
   * that entry's class, and its Regular-list figures are checked against the record each side matched. */
  follows?: string;
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

/** A pattern: '*', { "type": "number" | "string" }, { "byField": { <field>: <pattern> } } (an entry over several fields
 * pins each field's own value; a field it does not name never matches), or an exact value. */
function matchPattern(p: Pattern, v: unknown, field: string | null = null): boolean {
  if (p === '*') return true;
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    const by = (p as { byField?: Record<string, Pattern> }).byField;
    if (by !== undefined) return field !== null && Object.prototype.hasOwnProperty.call(by, field) && matchPattern(by[field], v);
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
    if (!matchPattern(e.legacy, d.legacy, d.field) || !matchPattern(e.new, d.new, d.field)) continue;
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
    // each tenor is its own field ("r 1Y"), compared with the kit's tolerance, so one figure differing is one difference
    // (CHAT-008's note N1 on the kit); a tenor one side's bucket lacks reads as null; a benchmark's groups are compared too
    type Flat = { key: string; list: string; kind: string; [field: string]: unknown };
    const tenors = [...new Set([...L.performance, ...N.performance].flatMap((r) => Object.keys(r.returns)))];
    const flat = (rows: readonly SbsPerfRow[]): Flat[] => rows.map((r) => {
      const o: Flat = { key: r.key, list: r.list, kind: r.kind, group: r.group };
      for (const t of tenors) o[`r ${t}`] = r.returns[t] ?? null;
      return o;
    });
    const fields = ['group', ...tenors.map((t) => `r ${t}`)];
    keyed('performance', flat(L.performance), flat(N.performance), fields, (r) => (r.kind === 'bench' ? 'E-30' : r.list === 'direct' ? 'E-32' : 'E-31'));
  } else if (L.performance) {
    for (const r of L.performance) {
      tally('performance').notCompared++;
      push({ section: 'performance', kind: 'not-built', key: r.key, field: null, legacy: r.returns, new: null, matrix: 'E-31' });
    }
  }

  for (const d of diffs) d.ledger = classify(d, fixture, ledger);

  // the fund-matching summary: one row per holding (on both sides) whose route, matched entry or universe differs; its
  // ledger entry is the one its differences share (none when any of them is unclassified or they disagree)
  const MATCH_FIELDS = new Set(['route', 'matched', 'universe']);
  const nByKey = new Map(N.holdings.map((h) => [h.key, h]));
  const matching: MatchingSummary = { compared: 0, same: 0, rows: [] };
  for (const l of L.holdings) {
    const n = nByKey.get(l.key);
    if (!n) continue;
    matching.compared++;
    const ds = diffs.filter((d) => d.section === 'holdings' && d.kind === 'field' && d.key === l.key && MATCH_FIELDS.has(d.field ?? ''));
    if (!ds.length) { matching.same++; continue; }
    const ids = new Set(ds.map((d) => d.ledger));
    const id = ids.size === 1 ? [...ids][0]! : null;
    const e = id ? ledger.find((x) => x.id === id) ?? null : null;
    matching.rows.push({ key: l.key, name: l.name, route: l.route === n.route ? n.route : `${l.route} / ${n.route}`, legacy: l.matched, new: n.matched, method: n.method, ledger: id, class: e ? e.class : null, reference: e ? e.reference : null });
  }
  return { fixture, counts, diffs, unclassified: diffs.filter((d) => d.ledger === null).length, matching, notes: [...L.notes, ...N.notes] };
}
