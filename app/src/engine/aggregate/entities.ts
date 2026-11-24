// Client and distributor allocation matrices (architecture §8; parity row E-24; D-039 points 3 and 4).
//
// - A holding is attributed to its first holder, Holding.clientId (engine/ownership.ts), and never split.
// - Columns: the clients (or distributors) of the included holdings, highest CMV first, ties in first appearance.
//   Holdings without one go to a column "Client not given" (or "Distributor not given"), never one labelled with the
//   dash. A column's label is the analyst's label when one is set, else the file's spelling.
// - Rows: each asset class in ASSET_ORDER, then its products by row total, highest first; a real zero where a column
//   holds none of the row. Share is the column's CMV over the total CMV, unrounded.
// Groups are keyed in Maps, so any label is an ordinary key.

import type { Holding } from '../../model/holding.ts';
import type { Provenance, Value } from '../../model/value.ts';
import type { EntityColumn, EntityMatrix, EntityRow, Totals } from '../../model/review.ts';
import { ASSET_ORDER } from '../../model/review.ts';
import { present } from '../value.ts';
import { isIncluded, pctOf, sourcesOf } from './totals.ts';
import { assetKeyOf } from './allocation.ts';

export const NOT_GIVEN = {
  client: { id: 'client:none', label: 'Client not given' },
  distributor: { id: 'distributor:none', label: 'Distributor not given' },
} as const;

/** The column a holding falls in. */
export function columnIdOf(level: 'client' | 'distributor', h: Holding): string {
  const id = level === 'client' ? h.clientId : h.distributorId;
  return id ?? NOT_GIVEN[level].id;
}

const METHOD_CELL = 'engine: sum of the market values of the included holdings in the cell (first holder, never split)';

/** The sum of the members' market values, in their order; a real zero when there is none. */
export function cmvSum(members: readonly Holding[], method: string = METHOD_CELL): Value<number> {
  let s = 0;
  let first = true;
  for (const h of members) {
    if (h.cmv.kind !== 'value') continue;
    s = first ? h.cmv.v : s + h.cmv.v;
    first = false;
  }
  const prov: Provenance = { sources: sourcesOf(members), method };
  return present(s, 'cr', prov);
}

const num = (v: Value<number>): number => (v.kind === 'value' ? v.v : Number.NEGATIVE_INFINITY);
const desc = <T>(value: (x: T) => number) => (a: T, b: T): number => {
  const x = value(a);
  const y = value(b);
  return x === y ? 0 : x > y ? -1 : 1;
};

export function computeEntityMatrix(
  level: 'client' | 'distributor', holdings: readonly Holding[], labels: Record<string, string>, totals: Totals,
): EntityMatrix {
  const inc = holdings.filter(isIncluded);
  const cols = new Map<string, { label: string; members: Holding[] }>();
  for (const h of inc) {
    const id = columnIdOf(level, h);
    let c = cols.get(id);
    if (!c) {
      const set = Object.hasOwn(labels, id) ? String(labels[id] ?? '').trim() : '';
      const fileLabel = level === 'client' ? h.clientLabel : h.distributorLabel;
      const label = set !== '' ? set : (id === NOT_GIVEN[level].id ? NOT_GIVEN[level].label : fileLabel ?? NOT_GIVEN[level].label);
      c = { label, members: [] };
      cols.set(id, c);
    }
    c.members.push(h);
  }
  const columns: EntityColumn[] = [...cols.entries()].map(([id, c]) => {
    const cmv = cmvSum(c.members, 'engine: sum of the market values of the included holdings in the column');
    return { id, label: c.label, cmv, sharePct: pctOf(cmv, totals.cmv) };
  }).sort(desc((c) => num(c.cmv)));
  const cellsOf = (members: readonly Holding[]): Value<number>[] =>
    columns.map((col) => cmvSum(members.filter((h) => columnIdOf(level, h) === col.id)));
  const rows: EntityRow[] = [];
  for (const asset of ASSET_ORDER) {
    const members = inc.filter((h) => assetKeyOf(h) === asset);
    if (members.length === 0) continue;
    rows.push({ kind: 'asset', asset, product: null, label: asset, cells: cellsOf(members), total: cmvSum(members) });
    const products = new Map<string, Holding[]>();
    for (const h of members) {
      const g = products.get(h.product);
      if (g) g.push(h); else products.set(h.product, [h]);
    }
    const productRows: EntityRow[] = [...products.entries()].map(([p, ms]) =>
      ({ kind: 'product' as const, asset, product: p, label: p, cells: cellsOf(ms), total: cmvSum(ms) }));
    rows.push(...productRows.sort(desc((r) => num(r.total))));
  }
  return { level, columns, rows, total: cmvSum(inc, 'engine: sum of the market values of the included holdings') };
}
