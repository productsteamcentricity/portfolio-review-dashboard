// Returns per scope (milestone M3a, NB-M3a; parity row E-142; contracts I-31 ScopeReturns, I-45 Scope; architecture
// §6.5; Q-57; OD-4; KI-048, KI-100). One function serves the family, client and advisor scopes:
//   - the scope's fund flows: the flows of base-file clients only (OD-4: a client with flows and no holding in the base
//     file is left out of every figure and listed); a scope takes whole instruments (client and instrument), never single
//     rows: a client scope its clients' instruments; an advisor scope the instruments whose fund rows all carry one of
//     its distributors (E-142). An instrument whose rows carry more than one distributor, or some none, is split: an
//     advisor scope that holds one does not reconcile until a rule shares it (Gate B of 1bbca77, B1; MOD-04 and owner);
//   - the benchmark flows of the same instruments as the scope's fund flows, so both sides cover the same money (KI-048:
//     joined by client and instrument);
//   - OD-4, invalid benchmark: an instrument whose benchmark flows give no rate is excluded from both sides and listed
//     (PLAN-02 D14, the default reading of "invalid benchmark series");
//   - OD-4, redeemed: an instrument of a base-file client with flows and no current holding stays in the
//     since-inception totals, listed;
//   - the unassigned line (flows without a distributor) on the family and advisor scopes when the file has a
//     DISTRIBUTOR column, never spread across distributors (Q-57; its share: PLAN-02 D15); family-wide, the same in
//     every view;
//   - a scope whose flows do not reconcile to its holdings: every XIRR missing with the gap 'not-reconciled'
//     (INSUFFICIENT EVIDENCE). The rule that decides it is injected (`reconcile`): no rule is defined yet (PLAN-02 D13);
//   - contributions over the scope's included holdings: a holding joined to an instrument of the IRR file takes that
//     instrument's transaction XIRR, blank when it gives no rate (KI-100, never the base-file figure in its place);
//     otherwise its base-file XIRR (PLAN-02 D11).
// The join of an IRR instrument to the holdings (PLAN-02 D9, switched by MOD-04 on 25 Nov 2026 once M2.1 S1 reached
// main): as the legacy irrKey (07_engine.js, KI-048), each holding's name and AMC matched by engine/match matchInstrument
// against the IRR instrument names of the same client; the client by its per-review id, never a fuzzy client match
// (KI-032, KI-111; the legacy resolveClient matched on two shared words). Pure: no globals.

import type { Scope } from '../../model/scope.ts';
import { holdingInScope, scopeKeyOf } from '../scope.ts';
import type { IrrFileImport, Transaction } from '../../model/transactions.ts';
import type { Holding } from '../../model/holding.ts';
import type { ClientId, DistributorId, HoldingId } from '../../model/ids.ts';
import type { CashFlow, IrrNode, IrrReconciliation, ScopeReturns, UnassignedFlows, XirrResult } from '../../model/returns.ts';
import type { Value } from '../../model/value.ts';
import { STATUS } from '../../model/status.ts';
import { BLANK_LABEL, buildIrrTree } from './irr-tree.ts';
import type { HoldingJoin } from './irr-tree.ts';
import { computeContributions } from './contributions.ts';
import type { ContributionInput } from './contributions.ts';
import { solveXirr, xirr, xirrGap } from './xirr.ts';
import { keyOf, normaliseLabel } from '../ids.ts';
import { matchInstrument } from '../match/instrument.ts';
import type { TokenCache } from '../match/instrument.ts';
import { missing, present } from '../value.ts';

// The scope key and membership come from engine/scope.ts (I-45; MOD-04 decision D8), re-exported for this module's callers.
export { scopeKeyOf, holdingInScope } from '../scope.ts';

const instrumentKey = (clientId: ClientId | null, name: string | null): string => keyOf([clientId, normaliseLabel(name)]);

/**
 * The holdings join (D9): for each holding with a client, engine/match matchInstrument over the IRR instrument names of
 * that client (the fund flows'); the instrument it picks joins the holding. A holding no name matches joins nothing (it is
 * then "without flows"), and an IRR instrument no holding picks is redeemed (OD-4).
 */
export function matcherJoin(holdings: readonly Holding[], fund: readonly Transaction[]): HoldingJoin {
  const namesOf = new Map<ClientId, string[]>();
  for (const t of fund) {
    if (t.instrumentName === null) continue;
    const l = namesOf.get(t.clientId) ?? [];
    if (!l.includes(t.instrumentName)) l.push(t.instrumentName);
    namesOf.set(t.clientId, l);
  }
  const cache: TokenCache = new Map();
  const m = new Map<string, HoldingId[]>();
  for (const h of holdings) {
    if (h.clientId === null) continue;
    const names = namesOf.get(h.clientId);
    if (!names) continue;
    const hit = matchInstrument(h.instrumentName, h.amcLabel ?? '', names, cache);
    if (hit === null) continue;
    const k = instrumentKey(h.clientId, hit);
    const l = m.get(k);
    if (l) l.push(h.id); else m.set(k, [h.id]);
  }
  return (clientId, name) => m.get(instrumentKey(clientId, name)) ?? [];
}

/** The earlier interim join (client id plus the exact normalised instrument name), kept for tests and comparisons. */
export function exactNameJoin(holdings: readonly Holding[]): HoldingJoin {
  const m = new Map<string, HoldingId[]>();
  for (const h of holdings) {
    const k = instrumentKey(h.clientId, h.instrumentName);
    const l = m.get(k);
    if (l) l.push(h.id); else m.set(k, [h.id]);
  }
  return (clientId, name) => m.get(instrumentKey(clientId, name)) ?? [];
}

/** The reconciliation rule (PLAN-02 D13): reasons the scope's flows do not reconcile to its holdings; empty when they do. */
export type ReconcileRule = (input: { scope: Scope; fund: readonly Transaction[]; holdings: readonly Holding[] }) => string[];

export type ScopeReturnsOptions = {
  /** The analyst's display label of a client (defaults to the label the flows carry). */
  clientLabel?: (clientId: ClientId, labelAsWritten: string) => string;
  /** The holdings join; defaults to the engine/match join over the review's holdings and the IRR fund flows (D9). */
  join?: HoldingJoin;
  /** No rule is defined yet (D13): without one every scope counts as reconciled. */
  reconcile?: ReconcileRule;
};

const flowsOf = (ts: readonly Transaction[]): CashFlow[] => ts.map((t) => ({ day: t.day, amount: t.amountRupees }));
const paidIn = (ts: readonly Transaction[]): number => ts.reduce((s, t) => s + (t.amountRupees < 0 ? -t.amountRupees : 0), 0);

/** The returns of one scope of a review. `holdings` are every holding of the review (any inclusion). */
export function computeScopeReturns(scope: Scope, irr: IrrFileImport | null, holdings: readonly Holding[], opts: ScopeReturnsOptions = {}): ScopeReturns {
  const key = scopeKeyOf(scope);
  const inScope = holdings.filter((h) => holdingInScope(h, scope));
  const join = opts.join ?? matcherJoin(holdings, irr ? irr.fund : []);
  const inScopeIds = new Set(inScope.map((h) => h.id));
  const scopedJoin: HoldingJoin = (c, n) => join(c, n).filter((id) => inScopeIds.has(id));

  if (!irr || irr.fund.length === 0) {
    const gap = irr ? 'no-flows' : 'no-irr-file';
    return {
      scope: key, fund: xirrGap(gap), bench: xirrGap(irr ? 'no-benchmark' : 'no-irr-file'), tree: [],
      reconciliation: { reconciled: true, reasons: [], irrOnlyClients: [], redeemed: [], invalidBenchmark: [], holdingsWithoutFlows: [] },
      unassigned: null,
      contributions: computeContributions(inScope.map((h) => contributionInput(h, h.xirr)), [h0(holdings)].filter(Boolean) as string[]),
    };
  }

  // 1. Base-file clients only (OD-4); IRR-only clients listed.
  const baseClients = new Set(holdings.map((h) => h.clientId).filter((x): x is ClientId => x !== null));
  const irrOnly = new Map<ClientId, { clientLabel: string; flows: number }>();
  for (const t of irr.fund) {
    if (baseClients.has(t.clientId)) continue;
    const e = irrOnly.get(t.clientId);
    if (e) e.flows++; else irrOnly.set(t.clientId, { clientLabel: t.clientLabel, flows: 1 });
  }
  const familyFund = irr.fund.filter((t) => baseClients.has(t.clientId));
  const kOf = (t: Transaction): string => instrumentKey(t.clientId, t.instrumentName);
  const familyByInstr = groupByKey(familyFund, kOf);
  const benchByInstr = groupByKey(irr.bench, kOf);

  // 2. A scope takes whole instruments (client and instrument), never single rows, so its fund side and its benchmark
  // side cover the same money (Gate B of 1bbca77, B1). An advisor scope takes an instrument whose fund rows all carry
  // one of its distributors. One whose rows carry one of its distributors and also another distributor, or none, is
  // split for the scope, and how to share it between distributors is not decided (DECISION for MOD-04 and the owner).
  // Until it is, such a scope does not reconcile: every figure missing with the reason, never a figure over part of a
  // position. (`split`, family-wide: rows under more than one distributor, a blank counting as one; for the unassigned line.)
  const distsOf = new Map<string, Set<DistributorId | null>>();
  for (const [k, ts] of familyByInstr) distsOf.set(k, new Set(ts.map((t) => t.distributorId)));
  const split = new Set([...distsOf].filter(([, ds]) => ds.size > 1).map(([k]) => k));
  const inAdvisor = (d: DistributorId | null): boolean => scope.kind === 'advisor' && d !== null && scope.distributorIds.includes(d);
  const touches = (k: string): boolean => [...distsOf.get(k)!].some(inAdvisor);
  const whollyIn = (k: string): boolean => [...distsOf.get(k)!].every(inAdvisor);
  const inScopeKey = (k: string): boolean => {
    const clientId = familyByInstr.get(k)![0]!.clientId;
    if (scope.kind === 'family') return true;
    if (scope.kind === 'client') return scope.clientIds.includes(clientId);
    return whollyIn(k);
  };
  const scopeKeys = new Set([...familyByInstr.keys()].filter(inScopeKey));
  const splitReasons = [...familyByInstr.keys()].filter((k) => touches(k) && !whollyIn(k)).map((k) => {
    const t = familyByInstr.get(k)![0]!;
    return `${t.instrumentName ?? BLANK_LABEL} (${t.clientLabel}): its flows are under more than one distributor, or some under none; how to share them between distributors is not decided`;
  });

  // 3. Invalid benchmark (OD-4; D14): an instrument whose benchmark flows give no rate leaves both sides. Decided per
  // instrument over the family's flows, so the same instrument is invalid in every scope and on the unassigned line.
  const invalid = new Map<string, { clientId: ClientId; instrumentName: string; reason: string }>();
  for (const [k, fts] of familyByInstr) {
    const bts = benchByInstr.get(k);
    if (!bts) continue;
    const o = solveXirr(flowsOf(bts));
    // Named as the fund sheet spells the instrument (the name the analyst sees in the tree).
    if ('gap' in o) invalid.set(k, { clientId: fts[0]!.clientId, instrumentName: fts[0]!.instrumentName ?? '', reason: `the benchmark flows give no rate (${o.gap})` });
  }
  const keepKey = (k: string): boolean => !invalid.has(k);
  const fund = familyFund.filter((t) => scopeKeys.has(kOf(t)) && keepKey(kOf(t)));
  const bench = irr.bench.filter((t) => scopeKeys.has(kOf(t)) && keepKey(kOf(t)));

  // 4. The tree, redeemed instruments and holdings without flows.
  const tree = buildIrrTree(fund, bench, { holdingsFor: scopedJoin, clientLabel: opts.clientLabel });
  const instrumentNodes = tree.filter((n) => n.level === 'instrument');
  const redeemed = instrumentNodes.filter((n) => n.redeemed).map((n) => ({
    clientId: n.clientId!, instrumentName: n.label, flows: n.fund.flows,
  }));
  // A holding's own flows are those of its instrument across the whole family (base-file clients), before the
  // invalid-benchmark exclusion and whatever the distributors (financial review of 058a94c, finding 1): an instrument
  // left out of the scope's aggregates for its benchmark, or held through another distributor, still has the holding's
  // transaction XIRR, and the holding is not "without flows".
  const flowsOfHolding = new Map<HoldingId, Transaction[]>();
  for (const ts of familyByInstr.values()) {
    for (const id of scopedJoin(ts[0]!.clientId, ts[0]!.instrumentName)) {
      const l = flowsOfHolding.get(id);
      if (l) l.push(...ts); else flowsOfHolding.set(id, [...ts]);
    }
  }
  const holdingsWithoutFlows = inScope.filter((h) => !flowsOfHolding.has(h.id)).map((h) => h.id);

  // 5. Reconciliation: the split instruments of an advisor scope (step 2), then the injected rule (D13; none defined).
  const reasons = [...splitReasons, ...(opts.reconcile ? opts.reconcile({ scope, fund, holdings: inScope }) : [])];
  const reconciliation: IrrReconciliation = {
    reconciled: reasons.length === 0, reasons, irrOnlyClients: [...irrOnly.values()], redeemed,
    invalidBenchmark: [...invalid].filter(([k]) => scopeKeys.has(k)).map(([, x]) => x), holdingsWithoutFlows,
  };
  const guard = (r: XirrResult, flows: readonly Transaction[]): XirrResult => (reconciliation.reconciled ? r : xirrGap('not-reconciled', flowsOf(flows)));
  const root = tree[0]!;
  const guardedTree: IrrNode[] = reconciliation.reconciled ? tree
    : tree.map((n) => ({ ...n, fund: xirrGap('not-reconciled'), bench: xirrGap('not-reconciled') }));

  // 6. The unassigned line (E-142; D15: its share of the family's money paid in). A family-wide line, the same in every
  // view (B1 (c)): its counts and share over the family's rows without a distributor; its XIRRs over the instruments
  // wholly without one, fund and benchmark alike, and missing when a split instrument has rows without one; guarded by
  // the family scope's rule, not the viewed scope's.
  let unassigned: UnassignedFlows | null = null;
  if (scope.kind !== 'client' && irr.hasDistributor) {
    const uf = familyFund.filter((t) => t.distributorId === null && keepKey(kOf(t)));
    const total = paidIn(familyFund.filter((t) => keepKey(kOf(t))));
    const wholly = (k: string): boolean => keepKey(k) && !split.has(k) && distsOf.get(k)!.has(null);
    const uw = familyFund.filter((t) => wholly(kOf(t)));
    const ub = irr.bench.filter((t) => familyByInstr.has(kOf(t)) && wholly(kOf(t)));
    const splitUnassigned = [...split].filter((k) => keepKey(k) && distsOf.get(k)!.has(null));
    const familyReasons = opts.reconcile
      ? opts.reconcile({ scope: { kind: 'family' }, fund: familyFund.filter((t) => keepKey(kOf(t))), holdings: holdings.filter((h) => holdingInScope(h, { kind: 'family' })) })
      : [];
    const ug = (r: XirrResult, flows: readonly Transaction[]): XirrResult => (
      splitUnassigned.length ? xirrGap('not-reconciled', flowsOf(flows), `${splitUnassigned.length} instrument(s) have flows both with and without a distributor; how to share them is not decided`)
        : familyReasons.length ? xirrGap('not-reconciled', flowsOf(flows)) : r);
    unassigned = {
      flows: uf.length,
      instruments: new Set(uf.map(kOf)).size,
      sharePct: total > 0 ? present((paidIn(uf) / total) * 100, 'pct', { sources: [irr.sourceId], method: 'share of the family\'s money paid in (unassigned money paid in over the family\'s, D15)' })
        : missing(STATUS.NOT_AVAILABLE, 'no money paid in'),
      fund: uf.length ? ug(uw.length ? xirr(flowsOf(uw), 'unassigned fund XIRR (E-142)', [irr.sourceId]) : xirrGap('no-flows'), uw) : xirrGap('no-flows'),
      bench: ub.length || splitUnassigned.length ? ug(ub.length ? xirr(flowsOf(ub), 'unassigned benchmark XIRR (E-142)', [irr.sourceId]) : xirrGap('no-benchmark'), ub) : xirrGap('no-benchmark'),
    };
  }

  // 6. Contributions (D11; KI-100): the transaction XIRR of the holding's own instrument flows (family-wide, above),
  // blank when they give no rate, never the base-file figure in its place; a holding with no flows keeps its base XIRR.
  const contributions = computeContributions(inScope.map((h) => {
    const own = flowsOfHolding.get(h.id);
    if (!own) return contributionInput(h, h.xirr);
    if (!reconciliation.reconciled) return contributionInput(h, missing(STATUS.INSUFFICIENT_EVIDENCE, 'not reconciled'));
    return contributionInput(h, xirr(flowsOf(own), 'transaction XIRR of the holding\'s instrument (IRR file)', [irr.sourceId]).xirr);
  }), [irr.sourceId]);

  return {
    scope: key,
    fund: guard(root.fund, fund),
    bench: guard(root.bench, bench),
    tree: guardedTree,
    reconciliation,
    unassigned,
    contributions,
  };
}

function contributionInput(h: Holding, x: Value<number>): ContributionInput {
  return { holdingId: h.id, lineKey: normaliseLabel(h.instrumentName), label: h.instrumentName, cmvCr: h.cmv, xirrPct: x };
}

function groupByKey(ts: readonly Transaction[], key: (t: Transaction) => string): Map<string, Transaction[]> {
  const m = new Map<string, Transaction[]>();
  for (const t of ts) { const k = key(t); const l = m.get(k); if (l) l.push(t); else m.set(k, [t]); }
  return m;
}

function h0(holdings: readonly Holding[]): string | null {
  return holdings[0] ? (holdings[0].sourceId as string) : null;
}
