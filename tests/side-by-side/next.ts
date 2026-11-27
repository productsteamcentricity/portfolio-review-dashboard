// The side-by-side kit, new side: the new build's shipped modules only, read and call (tests/side-by-side/ is owned by
// EX-03; app/** is Workstream B's). Base file: ingest/workbook + ingest/base-file. Matching: the wired entry
// engine/match/resolve-holdings (buildMatchContext + resolveHoldings, PR #54), with the shipped blocks and the owner's
// aliases (tests/helpers/match-blocks.ts committedMatchContext): product-class routing (E-15), ISIN first, the owner's
// aliases (PD-36) and NEW_BUILD_MATCHING, exactly as /next/ runs it. IRR: ingest/irr-file + engine/returns/scope
// (family, each client, each adviser), with the per-holding transaction XIRR read from the IRR tree's instrument nodes.
//
// Not built yet: the performance view (E-31, E-147; M3b). `performance` is null until those modules merge.

import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../app/src/ingest/base-file.ts';
import { parseIrrFile } from '../../app/src/ingest/irr-file.ts';
import { resolveHoldings } from '../../app/src/engine/match/resolve-holdings.ts';
import type { HoldingMatch, MatchContext } from '../../app/src/engine/match/resolve-holdings.ts';
import { computeScopeReturns } from '../../app/src/engine/returns/scope.ts';
import type { Holding } from '../../app/src/model/holding.ts';
import type { SourceFileId } from '../../app/src/model/ids.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';
import { committedMatchContext } from '../helpers/match-blocks.ts';
import type { SbsContribution, SbsHolding, SbsInput, SbsScope, SbsSide } from './shape.ts';
import { holdingKey, labelKey } from './shape.ts';

const SRC_BASE = 'b'.repeat(64) as SourceFileId;
const SRC_IRR = 'c'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-11-26T00:00:00.000Z';

type V = { kind: string; v?: number };
const pct = (x: V | null | undefined): number | null => (x && x.kind === 'value' && typeof x.v === 'number' ? x.v / 100 : null);
const val = (x: V | null | undefined): number | null => (x && x.kind === 'value' && typeof x.v === 'number' ? x.v : null);

let ctx: MatchContext | null = null;
/** The match context /next/ builds from the embedded blocks, here from data/refdata and data/owner (built once). */
function matchContext(): MatchContext {
  ctx ??= committedMatchContext();
  return ctx;
}

/** The kit's route of a holding: a universe (MF, SIF, AIF, PMS, STOCK) or 'other (<class label>)' for a non-MF class
 * that has no fund data by design (LP-16). The legacy side writes the same strings from the engine's own fields. */
export function routeLabel(m: HoldingMatch): string {
  return m.route === 'other' ? `other (${m.classLabel ?? ''})` : m.route;
}

/** The new side in the kit's shape. */
export function runNew(input: SbsInput): SbsSide {
  const xlsx = loadSheetJS();
  const notes: string[] = [
    'new: matching is the wired resolver of /next/ (resolveHoldings: product-class routing E-15, ISIN first, the owner\'s aliases PD-36, the stricter regime of 26 Nov 2026); route and matched entry are compared, the method is shown only.',
    'new: the performance view (E-31, E-147) is not built yet (M3b); the performance section shows the legacy rows only.',
  ];
  const base = parseBaseFile(readWorkbook(xlsx, input.baseBytes), { sourceId: SRC_BASE, now: NOW });
  const included = base.holdings.filter((h) => h.inclusion.status === 'included');
  const resolved = resolveHoldings(included, matchContext());
  const matchOf = new Map(resolved.report.entries.map((e) => [e.holdingId as string, e]));

  const irr = input.irrBytes ? parseIrrFile(readWorkbook(xlsx, input.irrBytes), { sourceId: SRC_IRR, now: NOW }) : null;
  const family = computeScopeReturns({ kind: 'family' }, irr, base.holdings);

  // per holding (D11, scope.ts step 6): a holding with flows has the transaction XIRR of its own flows (its client and
  // instrument: the IRR tree's instrument node); a holding without flows keeps its base-file XIRR and BMXIRR, as the live
  // page does. An instrument the tree leaves out (D14, an invalid benchmark) falls back to its contribution line only
  // when that line is the holding alone: a line joins every holding of one name, possibly several clients, at a
  // market-value-weighted XIRR, which is not the holding's own (financial review of 5a39d92, finding 3).
  const txnF = new Map<string, number | null>();
  for (const r of family.contributions.rows) if (r.holdingIds.length === 1) txnF.set(r.holdingIds[0]!, pct(r.xirr as V));
  const txnB = new Map<string, number | null>();
  for (const n of family.tree) {
    if (n.level !== 'instrument') continue;
    for (const id of n.holdingIds) { txnF.set(id, pct(n.fund.xirr as V)); txnB.set(id, pct(n.bench.xirr as V)); }
  }
  const noFlows = new Set<string>(family.reconciliation.holdingsWithoutFlows);

  let fellBack = 0;
  const holdings: SbsHolding[] = included.map((h: Holding) => {
    const m = matchOf.get(h.id as string);
    if (!m) throw new Error(`new: holding ${h.id} has no match entry`);
    const ref = m.ref;
    const matched = !ref || ref.resolution.method === 'none' ? null : (ref.vendorKey ?? null);
    const route = routeLabel(m);
    const viaIrr = irr !== null && !noFlows.has(h.id);
    if (viaIrr && !txnF.has(h.id)) fellBack++;
    return {
      key: holdingKey(h.clientLabel, h.instrumentName, (h.folios ?? []).join('/'), h.product, h.distributorLabel),
      route,
      baseXirr: pct(h.xirr as V),
      client: h.clientLabel ?? '',
      name: h.instrumentName,
      amc: h.amcLabel ?? '',
      folio: (h.folios ?? []).join('/'),
      cmvCr: val(h.cmv as V),
      matched,
      universe: matched ? m.route : null,
      method: m.route === 'other' ? 'not-routed (a non-MF class)' : ref ? `${ref.resolution.method} (${ref.resolution.confidence})` : 'none',
      xirr: viaIrr ? (txnF.get(h.id) ?? null) : pct(h.xirr as V),
      bmxirr: viaIrr ? (txnB.get(h.id) ?? null) : pct(h.bmXirr as V),
    };
  });

  if (fellBack) notes.push(`new: ${fellBack} holding(s) with flows have no own transaction XIRR (instrument left out of the tree and joined with other holdings on its line); shown as missing.`);

  const scopes: SbsScope[] = [];
  if (irr) {
    scopes.push({ key: 'family', kind: 'family', label: 'Total Portfolio', xirr: pct(family.fund.xirr as V), bmxirr: pct(family.bench.xirr as V) });
    const noIrrClients: string[] = [];
    for (const c of base.clients) {
      const r = computeScopeReturns({ kind: 'client', clientIds: [c.id] }, irr, base.holdings);
      // a client with no flows in the IRR file has no XIRR here; the live page shows a weighted average for it, which
      // the legacy side does not compare either (legacy.ts)
      if (r.fund.flows === 0) { noIrrClients.push(c.label); continue; }
      scopes.push({ key: `client | ${labelKey(c.label)}`, kind: 'client', label: c.label, xirr: pct(r.fund.xirr as V), bmxirr: pct(r.bench.xirr as V) });
    }
    if (noIrrClients.length) notes.push(`new: ${noIrrClients.length} client(s) with no flows in the IRR file (no client XIRR): ${noIrrClients.join(', ')}.`);
    for (const d of base.distributors) {
      const r = computeScopeReturns({ kind: 'advisor', distributorIds: [d.id] }, irr, base.holdings);
      scopes.push({ key: `advisor | ${labelKey(d.label)}`, kind: 'advisor', label: d.label, xirr: pct(r.fund.xirr as V), bmxirr: pct(r.bench.xirr as V) });
    }
    if (family.reconciliation.irrOnlyClients.length) notes.push(`new: ${family.reconciliation.irrOnlyClients.length} IRR-only client(s) left out of the family (OD-4).`);
  } else {
    notes.push('new: no IRR file; holding XIRRs are the base file\'s, and no scope XIRR is computed.');
  }

  const rowsByKey = new Map(family.contributions.rows.map((r) => [r.key, r]));
  const contributions: SbsContribution[] = [];
  for (const list of ['contributors', 'laggards', 'drags'] as const) {
    family.contributions[list].forEach((k, i) => {
      const r = rowsByKey.get(k);
      // a missing market value or contribution becomes NaN on purpose: sameValue treats NaN as unequal to anything, so a
      // listed line without a figure always shows as a difference instead of passing as null against null
      if (r) contributions.push({ key: `${list} | ${labelKey(r.label)}`, list, rank: i + 1, cmvCr: val(r.cmv as V) ?? NaN, contribPp: val(r.contributionPp as V) ?? NaN });
    });
  }

  return { engine: 'new', holdings, performance: null, scopes, contributions, notes };
}
