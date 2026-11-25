// The IRR tree (milestone M3a, NB-M3a; parity rows E-27, E-28; contract I-31 IrrNode; KI-048, OD-4). A port of the
// legacy computeIRRtree (index.html, 07_engine.js:1029):
//   - levels portfolio > client > asset > product > instrument, each group in the order of its label (code units, the
//     legacy Array.sort), the asset, product and instrument taken from the fund sheet's own labels, a blank label as
//     the dash;
//   - each node's fund XIRR over its fund flows (valuation rows included, as money out);
//   - its benchmark XIRR over the benchmark flows of the same client and of the instruments the node's fund flows name:
//     joined by client and instrument, never by the benchmark sheet's own asset or product labels (KI-048), so a
//     benchmark sheet that labels every row "Equity" still joins to a Debt node; the portfolio node takes every
//     benchmark flow, a client node every benchmark flow of the client (as in the legacy);
//   - the benchmark name: the one index the node's benchmark flows name, "Blended" when they name several, null when
//     none.
// Clients are grouped by their per-review id (the same key as the base file's clients, KI-111), not by a fuzzy match.
// The join of an instrument to the current holdings is injected (`holdingsFor`), so the matching policy stays with the
// caller (PLAN-02 D9: exact normalised name until engine/match lands); an instrument with no holding is `redeemed`, kept
// in the since-inception totals (OD-4). Pure: no globals.

import type { CashFlow, IrrLevel, IrrNode, XirrResult } from '../../model/returns.ts';
import type { Transaction } from '../../model/transactions.ts';
import type { ClientId, HoldingId } from '../../model/ids.ts';
import { xirr, xirrGap } from './xirr.ts';
import { keyOf, normaliseLabel } from '../ids.ts';

/** The label a blank asset, product or instrument takes (the legacy "—", the house's missing-value marker). */
export const BLANK_LABEL = '—';
export const BLENDED = 'Blended';

/** The current holdings of a client that an instrument joins to; empty when none (a redeemed instrument). */
export type HoldingJoin = (clientId: ClientId, instrumentName: string | null) => HoldingId[];

export type IrrTreeOptions = {
  holdingsFor?: HoldingJoin;
  /** The client's label as shown (the analyst's display label); defaults to the label the flows carry. */
  clientLabel?: (clientId: ClientId, labelAsWritten: string) => string;
};

const flowsOf = (ts: readonly Transaction[]): CashFlow[] => ts.map((t) => ({ day: t.day, amount: t.amountRupees }));

function sourcesOf(ts: readonly Transaction[]): string[] {
  return [...new Set(ts.map((t) => t.at.sourceId as string))];
}

function fundXirr(ts: readonly Transaction[]): XirrResult {
  return ts.length === 0 ? xirrGap('no-flows') : xirr(flowsOf(ts), 'fund XIRR actual/365 (IRR file, E-27)', sourcesOf(ts));
}

function benchXirr(ts: readonly Transaction[]): XirrResult {
  return ts.length === 0 ? xirrGap('no-benchmark') : xirr(flowsOf(ts), 'benchmark XIRR actual/365 (IRR file, E-28)', sourcesOf(ts));
}

/** The one index named, "Blended" for several, null for none (legacy bname). */
export function benchmarkNameOf(ts: readonly Transaction[]): string | null {
  const names = new Set<string>();
  for (const t of ts) if (t.benchmarkLabel) names.add(t.benchmarkLabel);
  return names.size === 1 ? [...names][0]! : names.size > 1 ? BLENDED : null;
}

function groupBy<K>(ts: readonly Transaction[], key: (t: Transaction) => K): Map<K, Transaction[]> {
  const m = new Map<K, Transaction[]>();
  for (const t of ts) { const k = key(t); const g = m.get(k); if (g) g.push(t); else m.set(k, [t]); }
  return m;
}

const byLabel = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const labelOr = (s: string | null): string => (s === null || s === '' ? BLANK_LABEL : s);

/** Builds the tree from the fund and benchmark flows (one review, or one scope's flows). */
export function buildIrrTree(fund: readonly Transaction[], bench: readonly Transaction[], opts: IrrTreeOptions = {}): IrrNode[] {
  const holdingsFor = opts.holdingsFor ?? ((): HoldingId[] => []);
  const nodes: IrrNode[] = [];
  // The benchmark joins on the instrument name normalised (case and spacing), the same key engine/returns/scope.ts uses,
  // so a benchmark row spelt "FUND X" joins Fund X at every level (financial review of 058a94c, finding 2).
  const benchFor = (clientId: ClientId, instruments: ReadonlySet<string | null> | null): Transaction[] => {
    const names = instruments === null ? null : new Set([...instruments].map((n) => normaliseLabel(n)));
    return bench.filter((t) => t.clientId === clientId && (names === null || names.has(normaliseLabel(t.instrumentName))));
  };
  const push = (level: IrrLevel, key: string, parentKey: string | null, label: string, clientId: ClientId | null,
    f: readonly Transaction[], b: readonly Transaction[], holdingIds: HoldingId[], redeemed: boolean): void => {
    nodes.push({ level, key, parentKey, label, clientId, fund: fundXirr(f), bench: benchXirr(b), benchmarkName: benchmarkNameOf(b), holdingIds, redeemed });
  };

  const rootKey = 'portfolio';
  const rootIndex = nodes.length;
  push('portfolio', rootKey, null, 'Total Portfolio', null, fund, bench, [], false);
  const allHoldings: HoldingId[] = [];

  const clients = [...groupBy(fund, (t) => t.clientId).entries()]
    .map(([id, ts]) => ({ id, ts, label: ts[0]!.clientLabel }))
    .sort((a, b) => byLabel(a.label, b.label));
  for (const c of clients) {
    const cKey = keyOf([rootKey, `client:${c.id}`]);
    const cIndex = nodes.length;
    push('client', cKey, rootKey, opts.clientLabel ? opts.clientLabel(c.id, c.label) : c.label, c.id, c.ts, benchFor(c.id, null), [], false);
    const cHoldings: HoldingId[] = [];
    const assets = [...groupBy(c.ts, (t) => labelOr(t.assetLabel)).entries()].sort((a, b) => byLabel(a[0], b[0]));
    for (const [asset, ats] of assets) {
      const aKey = keyOf([cKey, `asset:${asset}`]);
      const aIndex = nodes.length;
      push('asset', aKey, cKey, asset, c.id, ats, benchFor(c.id, new Set(ats.map((t) => t.instrumentName))), [], false);
      const aHoldings: HoldingId[] = [];
      const products = [...groupBy(ats, (t) => labelOr(t.productLabel)).entries()].sort((a, b) => byLabel(a[0], b[0]));
      for (const [product, pts] of products) {
        const pKey = keyOf([aKey, `product:${product}`]);
        const pIndex = nodes.length;
        push('product', pKey, aKey, product, c.id, pts, benchFor(c.id, new Set(pts.map((t) => t.instrumentName))), [], false);
        const pHoldings: HoldingId[] = [];
        const instruments = [...groupBy(pts, (t) => t.instrumentName).entries()].sort((a, b) => byLabel(labelOr(a[0]), labelOr(b[0])));
        for (const [name, its] of instruments) {
          const iKey = keyOf([pKey, `instrument:${labelOr(name)}`]);
          const held = holdingsFor(c.id, name);
          push('instrument', iKey, pKey, labelOr(name), c.id, its, benchFor(c.id, new Set([name])), [...held], held.length === 0);
          pHoldings.push(...held);
        }
        nodes[pIndex]!.holdingIds = unique(pHoldings);
        aHoldings.push(...pHoldings);
      }
      nodes[aIndex]!.holdingIds = unique(aHoldings);
      cHoldings.push(...aHoldings);
    }
    nodes[cIndex]!.holdingIds = unique(cHoldings);
    allHoldings.push(...cHoldings);
  }
  nodes[rootIndex]!.holdingIds = unique(allHoldings);
  return nodes;
}

function unique(ids: HoldingId[]): HoldingId[] {
  return [...new Set(ids)];
}
