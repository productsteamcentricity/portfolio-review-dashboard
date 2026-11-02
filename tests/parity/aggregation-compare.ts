// Comparison of the legacy overview aggregates (index.html 07_engine.js computeReview: totalCMV, totalInv, totalGL,
// invMissing, assetAllocation.rows, liqPie, allocByClient, allocByDistributor) with the new engine's Review (totals,
// assets, liquidity, byClient, byDistributor), and matching of every difference against
// tests/parity/aggregation-ledger.json.
//
// Both sides are projected into one shape before comparing: Crore amounts, percentages as percent numbers, labels as
// strings, a missing value as null. Rows are matched by label (asset class; asset class and product; liquidity label;
// matrix column), never by position; the orders are compared on their own, as sequences of the labels both sides have.
// The new matrices' "Client not given" and "Distributor not given" columns are paired with the legacy column labelled
// with the dash, so their cells are compared and the label difference shows once per matrix.

import type { Review } from '../../app/src/model/review.ts';
import type { LegacyHost } from '../fixtures/make-books.ts';
import { NOT_GIVEN } from '../../app/src/engine/aggregate/entities.ts';
import { sameValue } from './base-file-compare.ts';

export const LEGACY_DASH = '—';

export type AggKind = 'total' | 'asset-row' | 'product-row' | 'row-order' | 'liquidity' | 'matrix-col' | 'matrix-cell' | 'column-label';

export type AggDiff = { kind: AggKind; fixture: string; key: string; field: string; legacy: unknown; new: unknown };

type Line = { label: string; cmv: number | null; invested: number | null; pct: number | null };
type Matrix = { columns: Array<{ label: string; cmv: number | null }>; assets: string[]; products: Record<string, string[]>; cells: Map<string, number> };

/** Both sides in one shape. */
export type AggProjection = {
  totals: { cmv: number | null; invested: number | null; gain: number | null; withoutInvested: number };
  assets: Line[];
  products: Array<Line & { asset: string }>;
  grand: Line | null;
  liquidity: Array<{ label: string; pct: number | null }>;
  matrices: { client: Matrix; distributor: Matrix };
};

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const cellKey = (asset: string, product: string | null, column: string): string => `${asset}\u0000${product ?? ''}\u0000${column}`;

/** The legacy aggregates of one file, run exactly as the page runs it; null when the legacy reads no holding. */
export function legacyAggregates(host: LegacyHost, bytes: Uint8Array): AggProjection | null {
  const wb = host.XLSX.read(bytes, { type: 'array', cellDates: true });
  const sh = wb.Sheets['Base File'] || wb.Sheets[wb.SheetNames[0]];
  const aoa = host.XLSX.utils.sheet_to_json(sh, { header: 1, raw: true });
  const rows = host.E.parseBaseRows(aoa);
  if (!rows.length) return null;
  const m = host.E.computeReview(rows, host.REF, { familyName: 'Sample Family', asOnDate: '30 Sep 2026' });
  const assets: Line[] = [];
  const products: AggProjection['products'] = [];
  let grand: Line | null = null;
  let current = '';
  for (const r of m.assetAllocation.rows as Array<Record<string, unknown>>) {
    const line: Line = { label: String(r.label), cmv: num(r.cmv), invested: num(r.inv), pct: num(r.pct) };
    if (r.level === 'asset') { current = line.label; assets.push(line); }
    else if (r.level === 'product') products.push({ ...line, asset: current });
    else if (r.level === 'grand') grand = line;
  }
  const matrix = (a: { cols: string[]; assets: Array<{ asset: string; total: Record<string, number>; products: Array<{ product: string; vals: Record<string, number> }> }>; grand: Record<string, number> }): Matrix => {
    const cells = new Map<string, number>();
    const prods: Record<string, string[]> = {};
    for (const x of a.assets) {
      prods[x.asset] = x.products.map((p) => p.product);
      for (const c of a.cols) {
        cells.set(cellKey(x.asset, null, c), num(x.total[c]) ?? 0);
        for (const p of x.products) cells.set(cellKey(x.asset, p.product, c), num(p.vals[c]) ?? 0);
      }
    }
    return { columns: a.cols.map((c) => ({ label: c, cmv: num(a.grand[c]) })), assets: a.assets.map((x) => x.asset), products: prods, cells };
  };
  return {
    totals: { cmv: num(m.totalCMV), invested: num(m.totalInv), gain: num(m.totalGL), withoutInvested: Number(m.invMissing) },
    assets,
    products,
    grand,
    liquidity: (m.liqPie as Array<{ name: string; value: number }>).map((p) => ({ label: String(p.name), pct: num(p.value) })),
    matrices: { client: matrix(m.allocByClient), distributor: matrix(m.allocByDistributor) },
  };
}

/** The new review in the same shape. The "not given" columns carry the legacy dash label, so they pair. */
export function projectReview(r: Review): AggProjection {
  const v = (x: { kind: string; v?: number }): number | null => (x.kind === 'value' ? x.v ?? null : null);
  const line = (l: Review['assets']['total']): Line => ({ label: l.label, cmv: v(l.cmv), invested: v(l.invested), pct: v(l.pct) });
  const matrix = (mx: Review['byClient']): Matrix => {
    const none = NOT_GIVEN[mx.level].id;
    const labelOf = (c: (typeof mx.columns)[number]): string => (c.id === none ? LEGACY_DASH : c.label);
    const cells = new Map<string, number>();
    const prods: Record<string, string[]> = {};
    for (const row of mx.rows) {
      if (row.kind === 'product') (prods[row.asset] ??= []).push(row.product ?? '');
      mx.columns.forEach((c, j) => cells.set(cellKey(row.asset, row.product, labelOf(c)), v(row.cells[j]!) ?? 0));
    }
    return {
      columns: mx.columns.map((c) => ({ label: labelOf(c), cmv: v(c.cmv) })),
      assets: mx.rows.filter((x) => x.kind === 'asset').map((x) => x.asset),
      products: prods,
      cells,
    };
  };
  return {
    totals: { cmv: v(r.totals.cmv), invested: v(r.totals.invested), gain: v(r.totals.gain), withoutInvested: r.totals.counts.withoutInvested },
    assets: r.assets.assets.map((a) => line(a.line)),
    products: r.assets.assets.flatMap((a) => a.products.map((p) => ({ ...line(p), asset: a.asset }))),
    grand: line(r.assets.total),
    liquidity: r.liquidity.lines.map((l) => ({ label: l.label, pct: v(l.pct) })),
    matrices: { client: matrix(r.byClient), distributor: matrix(r.byDistributor) },
  };
}

const EMPTY: AggProjection = {
  totals: { cmv: null, invested: null, gain: null, withoutInvested: 0 },
  assets: [], products: [], grand: null, liquidity: [],
  matrices: {
    client: { columns: [], assets: [], products: {}, cells: new Map() },
    distributor: { columns: [], assets: [], products: {}, cells: new Map() },
  },
};

/** Every difference between the legacy and the new projection of one fixture. */
export function compareAggregates(fixture: string, legacyIn: AggProjection | null, n: AggProjection): AggDiff[] {
  const l = legacyIn ?? EMPTY;
  const out: AggDiff[] = [];
  const diff = (kind: AggKind, key: string, field: string, a: unknown, b: unknown): void => {
    const same = typeof a === 'number' && typeof b === 'number' ? sameValue(field, a, b) : a === b;
    if (!same) out.push({ kind, fixture, key, field, legacy: a, new: b });
  };
  for (const f of ['cmv', 'invested', 'gain', 'withoutInvested'] as const) diff('total', 'review', f, l.totals[f], n.totals[f]);
  if (l.grand || n.grand) for (const f of ['cmv', 'invested', 'pct'] as const) diff('total', 'Grand Total', f, l.grand?.[f] ?? null, n.grand?.[f] ?? null);

  const lines = (kind: 'asset-row' | 'product-row', a: Array<Line & { asset?: string }>, b: Array<Line & { asset?: string }>): void => {
    const keyOf = (x: Line & { asset?: string }): string => (x.asset === undefined ? x.label : `${x.asset} / ${x.label}`);
    const la = new Map(a.map((x) => [keyOf(x), x]));
    const nb = new Map(b.map((x) => [keyOf(x), x]));
    for (const [k, x] of la) {
      const y = nb.get(k);
      if (!y) { out.push({ kind, fixture, key: k, field: 'presence', legacy: k, new: null }); continue; }
      for (const f of ['cmv', 'invested', 'pct'] as const) diff(kind, k, f, x[f], y[f]);
    }
    for (const k of nb.keys()) if (!la.has(k)) out.push({ kind, fixture, key: k, field: 'presence', legacy: null, new: k });
  };
  lines('asset-row', l.assets, n.assets);
  lines('product-row', l.products, n.products);

  const order = (key: string, a: string[], b: string[]): void => {
    const common = new Set(a.filter((x) => b.includes(x)));
    const sa = a.filter((x) => common.has(x)).join(' | ');
    const sb = b.filter((x) => common.has(x)).join(' | ');
    if (sa !== sb) out.push({ kind: 'row-order', fixture, key, field: 'order', legacy: sa, new: sb });
  };
  order('assets', l.assets.map((x) => x.label), n.assets.map((x) => x.label));
  for (const a of n.assets.map((x) => x.label)) {
    order(`products of ${a}`, l.products.filter((p) => p.asset === a).map((p) => p.label), n.products.filter((p) => p.asset === a).map((p) => p.label));
  }

  const ll = new Map(l.liquidity.map((x) => [x.label, x.pct]));
  const nl = new Map(n.liquidity.map((x) => [x.label, x.pct]));
  for (const [k, p] of ll) {
    if (!nl.has(k)) out.push({ kind: 'liquidity', fixture, key: k, field: 'presence', legacy: k, new: null });
    else diff('liquidity', k, 'pct', p, nl.get(k));
  }
  for (const k of nl.keys()) if (!ll.has(k)) out.push({ kind: 'liquidity', fixture, key: k, field: 'presence', legacy: null, new: k });
  order('liquidity', l.liquidity.map((x) => x.label), n.liquidity.map((x) => x.label));

  for (const level of ['client', 'distributor'] as const) {
    const a = l.matrices[level];
    const b = n.matrices[level];
    if (b.columns.some((c) => c.label === LEGACY_DASH)) {
      out.push({ kind: 'column-label', fixture, key: level, field: 'label', legacy: LEGACY_DASH, new: NOT_GIVEN[level].label });
    }
    const la = new Map(a.columns.map((c) => [c.label, c.cmv]));
    const nb = new Map(b.columns.map((c) => [c.label, c.cmv]));
    for (const [k, x] of la) {
      if (!nb.has(k)) out.push({ kind: 'matrix-col', fixture, key: `${level}: ${k}`, field: 'presence', legacy: k, new: null });
      else diff('matrix-col', `${level}: ${k}`, 'cmv', x, nb.get(k));
    }
    for (const k of nb.keys()) if (!la.has(k)) out.push({ kind: 'matrix-col', fixture, key: `${level}: ${k}`, field: 'presence', legacy: null, new: k });
    order(`${level} columns`, a.columns.map((c) => c.label), b.columns.map((c) => c.label));
    const rowsOf = (m: Matrix): string[] => m.assets.flatMap((x) => [x, ...(m.products[x] ?? []).map((p) => `${x} / ${p}`)]);
    const ra = rowsOf(a);
    const rb = rowsOf(b);
    for (const k of ra) if (!rb.includes(k)) out.push({ kind: 'matrix-cell', fixture, key: `${level}: ${k}`, field: 'row-presence', legacy: k, new: null });
    for (const k of rb) if (!ra.includes(k)) out.push({ kind: 'matrix-cell', fixture, key: `${level}: ${k}`, field: 'row-presence', legacy: null, new: k });
    order(`${level} rows`, a.assets, b.assets);
    for (const asset of b.assets) order(`${level} products of ${asset}`, a.products[asset] ?? [], b.products[asset] ?? []);
    const keys = new Set([...a.cells.keys(), ...b.cells.keys()]);
    for (const k of keys) {
      const [asset, product, column] = k.split('\u0000');
      // A cell exists on one side only when its row or column does; those are reported as rows and columns.
      if (!a.cells.has(k) || !b.cells.has(k)) continue;
      diff('matrix-cell', `${level}: ${asset}${product ? ` / ${product}` : ''} @ ${column}`, 'cmv', a.cells.get(k), b.cells.get(k));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The ledger (schema parity-ledger-v1, tests/parity/README.md), with an optional key pattern

export type AggLedgerEntry = {
  id: string;
  kind: AggKind | '*';
  field?: string | string[];
  /** The diff key: exact text, a list of texts, or a regular expression written as "/.../". */
  key?: string | string[];
  fixtures: string[] | '*';
  legacy: unknown;
  new: unknown;
  class: 'correction' | 'improvement' | 'regression';
  reference: string;
  description: string;
  /** Why the entry no longer applies: the live page now gives the new app's figures (a legacy fix). It matches nothing. */
  retired?: string;
  /** The legacy pattern before the fix that retired the entry. */
  legacyBefore?: unknown;
};
export type AggLedger = { schema: string; area: string; legacy: string; new: string; entries: AggLedgerEntry[] };

const oneOf = (p: string | string[] | undefined, x: string): boolean => {
  if (p === undefined) return true;
  const list = Array.isArray(p) ? p : [p];
  return list.some((q) => (q.length > 2 && q.startsWith('/') && q.endsWith('/') ? new RegExp(q.slice(1, -1)).test(x) : q === x));
};

function fits(p: unknown, v: unknown): boolean {
  if (p === '*') return true;
  if (p !== null && typeof p === 'object') return (p as Record<string, unknown>).type === 'number' && typeof v === 'number';
  return v === p;
}

/** The active (not retired) entries a difference matches; a retired entry matches nothing (as the base-file ledger). */
export function aggEntriesFor(d: AggDiff, ledger: AggLedger): AggLedgerEntry[] {
  return ledger.entries.filter((e) => !e.retired && (e.kind === '*' || e.kind === d.kind)
    && oneOf(e.field, d.field)
    && oneOf(e.key, d.key)
    && (e.fixtures === '*' || e.fixtures.includes(d.fixture))
    && fits(e.legacy, d.legacy)
    && fits(e.new, d.new));
}
