// Comparison of the legacy performance tables (index.html 07_engine.js computeReview().performance, 1550-1663: the
// Regular buckets and the Direct list) with app/src/engine/returns/performance.ts, and matching of every difference
// against tests/parity/performance-ledger.json. Buckets pair by key (the legacy's "SIF (as on ...)" read as SIF);
// within a bucket the groups compare as a sequence of labels, the funds as a set of names, each shared fund's returns
// tenor by tenor, and the benchmark rows as a set of names with their returns. Test code only.

import type { LegacyHost } from '../fixtures/make-books.ts';
import type { PerfBucket, PerformanceResult } from '../../app/src/engine/returns/performance.ts';
import { benchKey } from '../../app/src/engine/returns/performance.ts';

export type PfKind = 'bucket-set' | 'cols' | 'group-sequence' | 'fund-set' | 'fund-figure' | 'bench-set' | 'bench-figure';
export type PfDiff = { kind: PfKind; list: 'regular' | 'direct'; fixture: string; bucket: string; label: string; field: string; legacy: unknown; new: unknown };
export type PfLedgerEntry = { id: string; kind: PfKind | '*'; list?: 'regular' | 'direct'; buckets?: string[]; fixtures: string[]; class: string; reference: string; description: string };
export type PfLedger = { schema: string; entries: PfLedgerEntry[] };

type LegacyRow = { type: 'sub' | 'fund' | 'bench'; label?: string; name?: string; r?: Record<string, number | null | undefined> };
type LegacyBucket = { key: string; cols: string[]; rows: LegacyRow[] };
export type LegacyPerformance = { regular: LegacyBucket[]; direct: LegacyBucket[] | null };

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const val = (x: unknown): number | null => (x && typeof x === 'object' && (x as { kind?: string }).kind === 'value' ? (x as { v: number }).v : null);
const near = (a: number | null, b: number | null): boolean => (a === null || b === null ? a === b : Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));
const bucketName = (k: string): string => k.replace(/ [(]as on .*[)]$/, '');

/** The legacy performance of one file, run as the page runs it. */
export function legacyPerformance(host: LegacyHost, bytes: Uint8Array): LegacyPerformance | null {
  const wb = host.XLSX.read(bytes, { type: 'array', cellDates: true });
  const sh = wb.Sheets['Base File'] || wb.Sheets[wb.SheetNames[0]];
  const rows = host.E.parseBaseRows(host.XLSX.utils.sheet_to_json(sh, { header: 1, raw: true }));
  if (!rows.length) return null;
  const m = host.E.computeReview(rows, host.REF, { familyName: 'Sample Family', asOnDate: '30 Sep 2026' });
  const p = m.performance as { regularList: LegacyBucket[]; directList: LegacyBucket[]; hasDirect: boolean };
  return { regular: p.regularList, direct: p.hasDirect ? p.directList : null };
}

function compareBucket(out: PfDiff[], list: 'regular' | 'direct', fixture: string, lb: LegacyBucket, nb: PerfBucket): void {
  const bucket = nb.key;
  const push = (kind: PfKind, label: string, field: string, legacy: unknown, n: unknown): void => { out.push({ kind, list, fixture, bucket, label, field, legacy, new: n }); };
  if (JSON.stringify(lb.cols) !== JSON.stringify(nb.cols)) push('cols', '*', 'cols', lb.cols, nb.cols);
  const lGroups = lb.rows.filter((r) => r.type === 'sub').map((r) => String(r.label));
  const nGroups = nb.groups.map((g) => g.label);
  if (JSON.stringify(lGroups) !== JSON.stringify(nGroups)) push('group-sequence', '*', 'groups', lGroups, nGroups);
  const lFunds = new Map(lb.rows.filter((r) => r.type === 'fund').map((r) => [String(r.name), r] as const));
  const nFunds = new Map(nb.groups.flatMap((g) => g.funds).map((f) => [f.name, f] as const));
  const ln = [...lFunds.keys()].sort(), nn = [...nFunds.keys()].sort();
  if (JSON.stringify(ln) !== JSON.stringify(nn)) push('fund-set', '*', 'funds', ln.filter((x) => !nFunds.has(x)), nn.filter((x) => !lFunds.has(x)));
  for (const [name, lr] of lFunds) {
    const nf = nFunds.get(name);
    if (!nf) continue;
    for (const c of nb.cols) {
      const a = num(lr.r?.[c]), b = val(nf.r[c as keyof typeof nf.r]);
      if (!near(a, b)) push('fund-figure', name, c, a, b);
    }
  }
  const lBench = new Map(lb.rows.filter((r) => r.type === 'bench').map((r) => [benchKey(String(r.label)), r] as const));
  const nBench = new Map(nb.groups.flatMap((g) => g.benchmarks).map((b) => [benchKey(b.name), b] as const));
  const lk = [...lBench.keys()].sort(), nk = [...nBench.keys()].sort();
  if (JSON.stringify(lk) !== JSON.stringify(nk)) push('bench-set', '*', 'benchmarks', lk.filter((x) => !nBench.has(x)), nk.filter((x) => !lBench.has(x)));
  for (const [k, lr] of lBench) {
    const nr = nBench.get(k);
    if (!nr) continue;
    for (const c of nb.cols) {
      const a = num(lr.r?.[c]), b = val(nr.r[c as keyof typeof nr.r]);
      if (!near(a, b)) push('bench-figure', k, c, a, b);
    }
  }
}

export function comparePerformance(fixture: string, legacy: LegacyPerformance | null, res: PerformanceResult): PfDiff[] {
  const out: PfDiff[] = [];
  if (!legacy) return out;
  for (const list of ['regular', 'direct'] as const) {
    const lbs = list === 'regular' ? legacy.regular : legacy.direct;
    const nbs = list === 'regular' ? res.regular : res.direct;
    if (lbs === null || nbs === null) {
      if ((lbs === null) !== (nbs === null)) out.push({ kind: 'bucket-set', list, fixture, bucket: '*', label: '*', field: 'presence', legacy: lbs !== null, new: nbs !== null });
      continue;
    }
    const lk = lbs.map((b) => bucketName(b.key)), nk = nbs.map((b) => b.key);
    if (JSON.stringify(lk) !== JSON.stringify(nk)) out.push({ kind: 'bucket-set', list, fixture, bucket: '*', label: '*', field: 'buckets', legacy: lk, new: nk });
    for (const lb of lbs) {
      const nb = nbs.find((b) => b.key === bucketName(lb.key));
      if (nb) compareBucket(out, list, fixture, lb, nb);
    }
  }
  return out;
}

/** The ledger entries a difference matches: kind ('*' any), list and bucket when given, and the fixture. */
export function entriesFor(d: PfDiff, ledger: PfLedger): PfLedgerEntry[] {
  return ledger.entries.filter((e) => (e.kind === '*' || e.kind === d.kind) && (e.list === undefined || e.list === d.list)
    && (e.buckets === undefined || e.buckets.includes(d.bucket)) && e.fixtures.includes(d.fixture));
}
