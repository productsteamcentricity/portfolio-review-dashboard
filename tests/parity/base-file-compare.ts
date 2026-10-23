// Comparison of the legacy parseBaseRows (index.html 07_engine.js, run through tools/engine-host.js) with the new
// ingest/base-file.ts, and matching of every difference against tests/parity/base-file-ledger.json.
//
// Representation is normalised before comparing, so only behaviour differences remain: the new holding is
// projected into the legacy row shape (labels as strings, XIRR as a fraction, Crore amounts, the purchase date as
// "D Mon YYYY", folios joined by "/"). The asset is the new canonical class, null when unknown, never the label as
// given: an Asset Name the new reader does not recognise must show as a difference from the legacy label, not compare
// equal to it. The class is compared with the legacy label without regard to letter case, because the legacy engine
// itself routes on the lower-cased label.

import type { BaseFileImport } from '../../app/src/ingest/base-file.ts';
import type { Holding } from '../../app/src/model/holding.ts';
import type { LegacyHost } from '../fixtures/make-books.ts';
import { formatDay } from '../../app/src/engine/dates.ts';

export type LegacyRow = Record<string, unknown>;
export type LegacyParse = { rows: LegacyRow[]; unitHint: string };

/** The legacy upload path exactly as the page runs it (11_app_ui.js handle(), engine-host build()). */
export function legacyParse(host: LegacyHost, bytes: Uint8Array): LegacyParse {
  const wb = host.XLSX.read(bytes, { type: 'array', cellDates: true });
  const sh = wb.Sheets['Base File'] || wb.Sheets[wb.SheetNames[0]];
  const aoa = host.XLSX.utils.sheet_to_json(sh, { header: 1, raw: true });
  const rows = host.E.parseBaseRows(aoa);
  return { rows: Array.from(rows as LegacyRow[]), unitHint: String(rows.unitHint) };
}

/** Fields compared value by value. */
export const COMPARED_FIELDS = [
  'client', 'name', 'category', 'asset', 'folio', 'amc', 'product', 'distributor', 'purchaseDate', 'units',
  'invCr', 'cmvCr', 'glCr', 'liquidity', 'xirrFrac', 'bmxirrFrac', 'days',
] as const;
/** Legacy fields the new holding does not carry (each needs a ledger entry when the legacy value is not null). */
export const NOT_CARRIED_FIELDS = ['allocFrac', 'invR', 'mvR', 'glR'] as const;

const num = (v: Holding['cmv']): number | null => (v.kind === 'value' ? v.v : null);

/** The new holding in the legacy row shape. */
export function projectNew(h: Holding): Record<string, unknown> {
  const x = num(h.xirr);
  const b = num(h.bmXirr);
  return {
    client: h.clientLabel ?? '',
    name: h.instrumentName,
    category: h.categoryLabel ?? '',
    asset: h.assetClass,
    folio: h.folios.join('/'),
    amc: h.amcLabel ?? '',
    product: h.product,
    distributor: h.distributorLabel ?? '',
    purchaseDate: h.purchaseDate.kind === 'value' ? formatDay(h.purchaseDate.v) : '',
    units: num(h.units),
    invCr: num(h.invested),
    cmvCr: num(h.cmv),
    glCr: num(h.fileGain),
    liquidity: h.liquidity,
    xirrFrac: x === null ? null : x / 100,
    bmxirrFrac: b === null ? null : b / 100,
    days: num(h.holdingDays),
  };
}

const keyOfRow = (r: Record<string, unknown>): string =>
  [r.client ?? '', r.name ?? '', r.product ?? '', r.distributor ?? ''].map(String).join(' | ');

export function sameValue(field: string, a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return true;
    return Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b)) + 1e-12;
  }
  if (field === 'asset' && typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

export type Diff =
  | { kind: 'field'; fixture: string; holding: string; field: string; legacy: unknown; new: unknown }
  | { kind: 'field-not-carried'; fixture: string; holding: string; field: string; legacy: unknown; new: null }
  | { kind: 'holding-only-in-new'; fixture: string; holding: string; legacy: null; new: string }
  | { kind: 'holding-only-in-legacy'; fixture: string; holding: string; legacy: string; new: null }
  | { kind: 'order'; fixture: string; holding: string; legacy: string; new: string }
  | { kind: 'unit-hint'; fixture: string; holding: string; legacy: unknown; new: unknown };

/** The legacy unit hint for the new money unit. */
const UNIT_HINT: Record<string, string> = { crore: 'Cr', lakh: 'L', rupee: 'auto' };

export function compare(fixture: string, legacy: LegacyParse, imp: BaseFileImport): Diff[] {
  const diffs: Diff[] = [];
  const newHint = imp.moneyUnit === null ? 'auto' : UNIT_HINT[imp.moneyUnit];
  if (newHint !== legacy.unitHint) {
    diffs.push({ kind: 'unit-hint', fixture, holding: '(file)', legacy: legacy.unitHint, new: newHint });
  }
  const included = imp.holdings.filter((h) => h.inclusion.status === 'included').map(projectNew);
  const newByKey = new Map(included.map((p) => [keyOfRow(p), p]));
  const legacyByKey = new Map(legacy.rows.map((r) => [keyOfRow(r), r]));
  for (const [key, l] of legacyByKey) {
    const n = newByKey.get(key);
    if (!n) { diffs.push({ kind: 'holding-only-in-legacy', fixture, holding: key, legacy: key, new: null }); continue; }
    for (const f of COMPARED_FIELDS) {
      const lv = l[f] === undefined ? null : l[f];
      if (!sameValue(f, lv, n[f])) diffs.push({ kind: 'field', fixture, holding: key, field: f, legacy: lv, new: n[f] });
    }
    for (const f of NOT_CARRIED_FIELDS) {
      const lv = l[f] === undefined ? null : l[f];
      if (lv !== null) diffs.push({ kind: 'field-not-carried', fixture, holding: key, field: f, legacy: lv, new: null });
    }
  }
  for (const key of newByKey.keys()) {
    if (!legacyByKey.has(key)) diffs.push({ kind: 'holding-only-in-new', fixture, holding: key, legacy: null, new: key });
  }
  const lOrder = [...legacyByKey.keys()].filter((k) => newByKey.has(k));
  const nOrder = [...newByKey.keys()].filter((k) => legacyByKey.has(k));
  lOrder.forEach((k, i) => {
    if (nOrder[i] !== k) diffs.push({ kind: 'order', fixture, holding: k, legacy: k, new: nOrder[i] ?? '' });
  });
  return diffs;
}

// ---------------------------------------------------------------------------------------------------------------
// The ledger

/** A value pattern: "*" any; {"type":"number"} any number; {"timesLegacy":k} the new value is k times the legacy one. */
export type Pattern = unknown;

export type LedgerEntry = {
  id: string;
  kind: Diff['kind'];
  field?: string;
  fixtures: string[] | '*';
  legacy: Pattern;
  new: Pattern;
  class: 'correction' | 'improvement' | 'regression';
  reference: string;
  description: string;
};

export type Ledger = { schema: string; area: string; legacy: string; entries: LedgerEntry[] };

function fits(p: Pattern, v: unknown, other: unknown): boolean {
  if (p === '*') return true;
  if (p !== null && typeof p === 'object') {
    const o = p as Record<string, unknown>;
    if (o.type === 'number') return typeof v === 'number';
    if (typeof o.timesLegacy === 'number') {
      return typeof v === 'number' && typeof other === 'number' && sameValue('', v, other * o.timesLegacy);
    }
    return false;
  }
  return v === p;
}

/** The entries a difference matches. */
export function entriesFor(d: Diff, ledger: Ledger): LedgerEntry[] {
  return ledger.entries.filter((e) => e.kind === d.kind
    && (e.field === undefined || ('field' in d && e.field === d.field))
    && (e.fixtures === '*' || e.fixtures.includes(d.fixture))
    && fits(e.legacy, d.legacy, d.new)
    && fits(e.new, d.new, d.legacy));
}
