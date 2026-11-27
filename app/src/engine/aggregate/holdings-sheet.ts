// The per-client holding sheets (parity row E-25; roadmap M3, NB-M3b; test build 1). A port of the live page's
// PER-CLIENT HOLDING SHEETS (07_engine.js:1815-1880) on the new build's figures:
//   - one sheet per client, highest CMV first (ties keep their first appearance); holdings without a client together;
//   - rows: each asset class in ASSET_ORDER, then its products by CMV, highest first, then the holdings by CMV, then the
//     client's Grand Total;
//   - invested value, gain and absolute return follow the totals' rules (totals.ts groupFigures: KI-007, OD-18), the
//     allocation is a row's CMV over the client's CMV;
//   - a subtotal's XIRR and BMXIRR are the CMV-weighted average over the holdings that have one, with the CMV share
//     those holdings hold as the coverage (KI-006: a blank is never 0); the sheet counts what a partial subtotal leaves
//     out, for the † note;
//   - when the client has IRR transactions, the IRR file's aggregates replace a subtotal's XIRR and BMXIRR (KI-048): the
//     optional `irr` hook (NB-03's engine/returns/irr-aggregate.ts); a gap there stays a blank with its status (KI-100),
//     and null keeps the CMV-weighted path.
// Only included holdings enter a sheet (OD-8). Money in Crore, unrounded. Pure.

import type { Holding } from '../../model/holding.ts';
import type { ClientId, HoldingId } from '../../model/ids.ts';
import type { AssetKey } from '../../model/review.ts';
import type { DayNumber, Value } from '../../model/value.ts';
import { ASSET_ORDER } from '../../model/review.ts';
import { STATUS } from '../../model/status.ts';
import { missing, present } from '../value.ts';
import { groupFigures, isIncluded, pctOf, sourcesOf } from './totals.ts';
import { assetKeyOf } from './allocation.ts';

export type HoldingsRowLevel = 'asset' | 'product' | 'item' | 'grand';

export type HoldingsSheetRow = {
  level: HoldingsRowLevel;
  label: string;
  holdingIds: HoldingId[];
  cmv: Value<number>;
  invested: Value<number>;
  gain: Value<number>;
  absReturnPct: Value<number>;
  /** The row's CMV over the client's CMV, percent. */
  allocationPct: Value<number>;
  xirr: Value<number>;
  bmXirr: Value<number>;
  /** Subtotals on the CMV-weighted path: the CMV share of the holdings that have a value, percent. */
  xirrCoveragePct?: Value<number>;
  bmXirrCoveragePct?: Value<number>;
  /** 'irr' when the IRR file's aggregate replaced the subtotal's XIRR and BMXIRR. */
  xirrSource: 'holding' | 'cmv-weighted' | 'irr';
  withoutInvested: number;
  /** Item rows only. */
  distributor?: string | null;
  purchaseDate?: Value<DayNumber>;
};

/** The † note's counts, over the holdings of the rows marked † (MOD-05's review N2a: never the Grand Total's coverage when the
 *  Grand Total comes from the IRR file). `byCount`: a market value among them is negative, so the coverage is in holdings (N3). */
export type HoldingsPartialNote = { withoutXirr: number; withoutBmXirr: number; xirrCoveragePct: number; bmXirrCoveragePct: number; byCount: boolean };

export type ClientHoldingsSheet = {
  clientId: ClientId | null;
  clientLabel: string | null;
  cmv: Value<number>;
  rows: HoldingsSheetRow[];
  /** Set when a subtotal on the CMV-weighted path leaves holdings out (the † note, KI-006). */
  partial: HoldingsPartialNote | null;
  /** True when the IRR file is in use for this client and its total XIRR or BMXIRR is a gap. */
  irrGrandBlank: boolean;
};

/** The IRR file's aggregate for a client's scope, or null for the CMV-weighted path (NB-03's adapter). */
export type IrrAggregateHook = (clientId: ClientId | null, scope: { asset?: string; product?: string; holdingIds: readonly HoldingId[] }) =>
  { fund: Value<number>; bench: Value<number> } | null;

const METHOD = {
  xirr: 'engine: CMV-weighted average XIRR over the holdings that have one (KI-006)',
  bmXirr: 'engine: CMV-weighted average BMXIRR over the holdings that have one (KI-006)',
  coverage: 'engine: CMV of the holdings with a value, as a percent of the CMV',
  coverageByCount: 'engine: holdings with a value, as a percent of the holdings with a market value (by count: a market value is negative)',
};

type Weighted = { avg: Value<number>; coverage: Value<number>; with: number; covered: number; byCount: boolean };

/** CMV-weighted average of one rate over the members, with its coverage (07_engine.js:1831-1834). */
function weighted(members: readonly Holding[], pick: (h: Holding) => Value<number>, method: string, what: string, groupCmv: Value<number>): Weighted {
  let w = 0;
  let c = 0;
  let n = 0;
  let priced = 0;
  let negative = false;
  let posWeight = false;
  let negWeight = false;
  for (const h of members) {
    if (h.cmv.kind !== 'value') continue;
    priced++;
    if (h.cmv.v < 0) negative = true;
    const x = pick(h);
    if (x.kind !== 'value') continue;
    if (h.cmv.v > 0) posWeight = true;
    if (h.cmv.v < 0) negWeight = true;
    w += x.v * h.cmv.v;
    c += h.cmv.v;
    n++;
  }
  const prov = { sources: sourcesOf(members), method };
  /* N3 (financial review of 27 Nov 2026): with a negative market value among the members, a CMV share can pass 100% or
     go below 0, so it no longer says how much of the row the average covers. The coverage is then counted in holdings
     (holdings with the rate over holdings with a market value). Weights of one sign give a true average, inside the
     members' rates (a single holding of negative value gives its own rate, as the live page does). Weights of both signs
     can put it outside every member's rate, whatever their sum (CMVs of 1.0000001 and -1 gave -19,99,99,989.88%), so
     such an average is not given (NOT COMPARABLE); nor is one whose weights sum to 0. */
  const coverage = negative
    ? (priced > 0
      ? present(n / priced * 100, 'pct', { sources: sourcesOf(members), method: METHOD.coverageByCount })
      : missing(STATUS.NOT_APPLICABLE, `no holding in ${what} has a market value`, { sources: sourcesOf(members), method: METHOD.coverageByCount }))
    : groupCmv.kind === 'value' && groupCmv.v !== 0
      ? present(c / groupCmv.v * 100, 'pct', { sources: sourcesOf(members), method: METHOD.coverage })
      : missing(STATUS.NOT_APPLICABLE, `the market value of ${what} is 0 or missing`, { sources: sourcesOf(members), method: METHOD.coverage });
  /* S2 (financial review of 27 Nov 2026): a rate that covers only part of the row carries that share as its coverage, as
     groupFigures does for the invested value, so the cell shows the "p" marker and the sheet's status says PARTIAL
     COVERAGE. */
  const share = coverage.kind === 'value' ? coverage.v / 100 : undefined;
  const extra = share !== undefined && share >= 0 && share < 1 ? { coverage: share } : undefined;
  let avg: Value<number>;
  if (n === 0 || (c === 0 && !negative)) avg = missing(STATUS.NOT_AVAILABLE, `no holding in ${what} has this rate with a market value`, prov);
  else if (posWeight && negWeight) {
    avg = missing(STATUS.NOT_COMPARABLE, `the holdings on this line that have this rate have market values of both signs, so a weighted average by market value has no meaning`, prov);
  } else if (c === 0) {
    avg = missing(STATUS.NOT_COMPARABLE, `the market values of the holdings on this line that have this rate sum to 0, so a weighted average by market value has no meaning`, prov);
  } else avg = present(w / c, 'pct', prov, extra);
  return { avg, coverage, with: n, covered: c, byCount: negative };
}

function cmvOf(h: Holding): number {
  return h.cmv.kind === 'value' ? h.cmv.v : Number.NEGATIVE_INFINITY;
}

/** Highest CMV first; equal values keep their order. */
function byCmv<T>(items: T[], cmv: (t: T) => number): T[] {
  return items.sort((a, b) => { const x = cmv(a), y = cmv(b); return x === y ? 0 : x > y ? -1 : 1; });
}

function groupBy<K>(members: readonly Holding[], keyOf: (h: Holding) => K): Map<K, Holding[]> {
  const out = new Map<K, Holding[]>();
  for (const h of members) {
    const k = keyOf(h);
    const g = out.get(k);
    if (g) g.push(h);
    else out.set(k, [h]);
  }
  return out;
}

function sumCmv(members: readonly Holding[]): number {
  let s = 0;
  for (const h of members) if (h.cmv.kind === 'value') s += h.cmv.v;
  return s;
}

export function computeHoldingsSheets(holdings: readonly Holding[], opts: { irr?: IrrAggregateHook } = {}): ClientHoldingsSheet[] {
  const included = holdings.filter(isIncluded);
  const byClient = groupBy(included, (h) => h.clientId);
  const clients = byCmv([...byClient.entries()], ([, ms]) => sumCmv(ms));
  return clients.map(([clientId, members]): ClientHoldingsSheet => {
    const label = members[0]?.clientLabel ?? null;
    const what = label ?? 'this client';
    const total = groupFigures(members, what);
    const rows: HoldingsSheetRow[] = [];
    const dagger = new Set<HoldingId>();
    let irrGrandBlank = false;

    const subtotal = (level: 'asset' | 'product' | 'grand', rowLabel: string, ms: readonly Holding[], scope: { asset?: string; product?: string }): HoldingsSheetRow => {
      const f = groupFigures(ms, rowLabel);
      const base = {
        level, label: rowLabel, holdingIds: ms.map((h) => h.id), cmv: f.cmv, invested: f.invested, gain: f.gain, absReturnPct: f.absReturnPct,
        allocationPct: pctOf(f.cmv, total.cmv), withoutInvested: f.withoutInvested,
      };
      const r = opts.irr ? opts.irr(clientId, { ...scope, holdingIds: ms.map((h) => h.id) }) : null;
      if (r) {
        if (level === 'grand' && (r.fund.kind !== 'value' || r.bench.kind !== 'value')) irrGrandBlank = true;
        return { ...base, xirr: r.fund, bmXirr: r.bench, xirrSource: 'irr' };
      }
      const x = weighted(ms, (h) => h.xirr, METHOD.xirr, rowLabel, f.cmv);
      const b = weighted(ms, (h) => h.bmXirr, METHOD.bmXirr, rowLabel, f.cmv);
      /* S4 of the follow-up's review: any share below 100% (the figure carries "p") is counted in the dagger note */
      const short = (v: Value<number>): boolean => v.kind === 'value' && v.v < 100;
      if (short(x.coverage) || short(b.coverage)) for (const h of ms) dagger.add(h.id);
      return { ...base, xirr: x.avg, bmXirr: b.avg, xirrCoveragePct: x.coverage, bmXirrCoveragePct: b.coverage, xirrSource: 'cmv-weighted' };
    };

    const byAsset = groupBy(members, assetKeyOf);
    for (const asset of ASSET_ORDER) {
      const ams = byAsset.get(asset as AssetKey);
      if (!ams) continue;
      rows.push(subtotal('asset', asset, ams, { asset }));
      const prods = byCmv([...groupBy(ams, (h) => h.product).entries()], ([, ms]) => sumCmv(ms));
      for (const [product, pms] of prods) {
        rows.push(subtotal('product', product, pms, { asset, product }));
        for (const h of byCmv([...pms], cmvOf)) {
          const f = groupFigures([h], h.instrumentName);
          rows.push({
            level: 'item', label: h.instrumentName, holdingIds: [h.id], cmv: f.cmv, invested: f.invested, gain: f.gain, absReturnPct: f.absReturnPct,
            allocationPct: pctOf(f.cmv, total.cmv), xirr: h.xirr, bmXirr: h.bmXirr, xirrSource: 'holding', withoutInvested: f.withoutInvested,
            distributor: h.distributorLabel, purchaseDate: h.purchaseDate,
          });
        }
      }
    }
    rows.push(subtotal('grand', 'Grand Total', members, {}));

    let note: HoldingsPartialNote | null = null;
    if (dagger.size > 0) {
      const marked = members.filter((h) => dagger.has(h.id));
      const cmv = groupFigures(marked, what).cmv;
      const x = weighted(marked, (h) => h.xirr, METHOD.xirr, what, cmv);
      const b = weighted(marked, (h) => h.bmXirr, METHOD.bmXirr, what, cmv);
      const pct = (v: Value<number>): number => (v.kind === 'value' ? v.v : 0);
      note = {
        withoutXirr: marked.filter((h) => h.xirr.kind !== 'value').length,
        withoutBmXirr: marked.filter((h) => h.bmXirr.kind !== 'value').length,
        xirrCoveragePct: pct(x.coverage),
        bmXirrCoveragePct: pct(b.coverage),
        byCount: x.byCount || b.byCount,
      };
    }
    return { clientId, clientLabel: label, cmv: total.cmv, rows, partial: note, irrGrandBlank };
  });
}
