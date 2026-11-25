// Returns per scope (milestone M3a, NB-M3a; parity row E-142; contracts I-31 ScopeReturns, I-45 Scope; architecture
// §6.5; Q-57; OD-4; KI-048, KI-100). One function serves the family, client and advisor scopes:
//   - the scope's fund flows: the flows of base-file clients only (OD-4: a client with flows and no holding in the base
//     file is left out of every figure and listed); a client scope takes its clients' flows; an advisor scope the flows
//     whose DISTRIBUTOR is one of its distributors (E-142);
//   - the benchmark flows of the same clients and instruments as the scope's fund flows (KI-048: joined by client and
//     instrument);
//   - OD-4, invalid benchmark: an instrument whose benchmark flows give no rate is excluded from both sides and listed
//     (PLAN-02 D14, the default reading of "invalid benchmark series");
//   - OD-4, redeemed: an instrument of a base-file client with flows and no current holding stays in the
//     since-inception totals, listed;
//   - the unassigned line (flows without a distributor) on the family and advisor scopes when the file has a
//     DISTRIBUTOR column, never spread across distributors (Q-57; its share: PLAN-02 D15);
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
import type { ClientId, HoldingId } from '../../model/ids.ts';
import type { CashFlow, IrrNode, IrrReconciliation, ScopeReturns, UnassignedFlows, XirrResult } from '../../model/returns.ts';
import type { Value } from '../../model/value.ts';
import { STATUS } from '../../model/status.ts';
import { buildIrrTree } from './irr-tree.ts';
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
  const scopeFund = scope.kind === 'family' ? familyFund
    : scope.kind === 'client' ? familyFund.filter((t) => scope.clientIds.includes(t.clientId))
      : familyFund.filter((t) => t.distributorId !== null && scope.distributorIds.includes(t.distributorId));
  const benchOf = (fund: readonly Transaction[]): Transaction[] => {
    const keys = new Set(fund.map((t) => instrumentKey(t.clientId, t.instrumentName)));
    return irr.bench.filter((t) => keys.has(instrumentKey(t.clientId, t.instrumentName)));
  };

  // 2. Invalid benchmark (OD-4; D14): an instrument whose benchmark flows give no rate leaves both sides.
  const benchAll = benchOf(scopeFund);
  const benchByInstr = new Map<string, Transaction[]>();
  for (const t of benchAll) {
    const k = instrumentKey(t.clientId, t.instrumentName);
    const l = benchByInstr.get(k);
    if (l) l.push(t); else benchByInstr.set(k, [t]);
  }
  const invalid = new Map<string, { clientId: ClientId; instrumentName: string; reason: string }>();
  for (const [k, ts] of benchByInstr) {
    const o = solveXirr(flowsOf(ts));
    if ('gap' in o) {
      // Named as the fund sheet spells the instrument (the name the analyst sees in the tree), else the benchmark's.
      const fundName = scopeFund.find((t) => instrumentKey(t.clientId, t.instrumentName) === k)?.instrumentName;
      invalid.set(k, { clientId: ts[0]!.clientId, instrumentName: fundName ?? ts[0]!.instrumentName ?? '', reason: `the benchmark flows give no rate (${o.gap})` });
    }
  }
  const keep = (t: Transaction): boolean => !invalid.has(instrumentKey(t.clientId, t.instrumentName));
  const fund = scopeFund.filter(keep);
  const bench = benchAll.filter(keep);

  // 3. The tree, redeemed instruments and holdings without flows.
  const tree = buildIrrTree(fund, bench, { holdingsFor: scopedJoin, clientLabel: opts.clientLabel });
  const instrumentNodes = tree.filter((n) => n.level === 'instrument');
  const redeemed = instrumentNodes.filter((n) => n.redeemed).map((n) => ({
    clientId: n.clientId!, instrumentName: n.label, flows: n.fund.flows,
  }));
  // A holding's own flows are those of its instrument across the whole family (base-file clients), before the
  // invalid-benchmark exclusion and before the distributor filter (financial review of 058a94c, finding 1): an
  // instrument left out of the scope's aggregates for its benchmark, or whose flows carry another distributor, still has
  // the holding's transaction XIRR, and the holding is not "without flows".
  const familyByInstr = new Map<string, Transaction[]>();
  for (const t of familyFund) {
    const k = instrumentKey(t.clientId, t.instrumentName);
    const l = familyByInstr.get(k);
    if (l) l.push(t); else familyByInstr.set(k, [t]);
  }
  const flowsOfHolding = new Map<HoldingId, Transaction[]>();
  for (const ts of familyByInstr.values()) {
    for (const id of scopedJoin(ts[0]!.clientId, ts[0]!.instrumentName)) {
      const l = flowsOfHolding.get(id);
      if (l) l.push(...ts); else flowsOfHolding.set(id, [...ts]);
    }
  }
  const holdingsWithoutFlows = inScope.filter((h) => !flowsOfHolding.has(h.id)).map((h) => h.id);

  // 4. Reconciliation (D13: the rule is injected; none is defined yet).
  const reasons = opts.reconcile ? opts.reconcile({ scope, fund, holdings: inScope }) : [];
  const reconciliation: IrrReconciliation = {
    reconciled: reasons.length === 0, reasons, irrOnlyClients: [...irrOnly.values()], redeemed,
    invalidBenchmark: [...invalid.values()], holdingsWithoutFlows,
  };
  const guard = (r: XirrResult, flows: readonly Transaction[]): XirrResult => (reconciliation.reconciled ? r : xirrGap('not-reconciled', flowsOf(flows)));
  const root = tree[0]!;
  const guardedTree: IrrNode[] = reconciliation.reconciled ? tree
    : tree.map((n) => ({ ...n, fund: xirrGap('not-reconciled'), bench: xirrGap('not-reconciled') }));

  // 5. The unassigned line (E-142; D15: its share of the family's money paid in).
  let unassigned: UnassignedFlows | null = null;
  if (scope.kind !== 'client' && irr.hasDistributor) {
    const uf = familyFund.filter((t) => t.distributorLabel === null && keep(t));
    const total = paidIn(familyFund.filter(keep));
    const ub = benchOf(uf).filter(keep);
    unassigned = {
      flows: uf.length,
      instruments: new Set(uf.map((t) => instrumentKey(t.clientId, t.instrumentName))).size,
      sharePct: total > 0 ? present((paidIn(uf) / total) * 100, 'pct', { sources: [irr.sourceId], method: 'share of the family\'s money paid in (unassigned money paid in over the family\'s, D15)' })
        : missing(STATUS.NOT_AVAILABLE, 'no money paid in'),
      fund: uf.length ? guard(xirr(flowsOf(uf), 'unassigned fund XIRR (E-142)', [irr.sourceId]), uf) : xirrGap('no-flows'),
      bench: ub.length ? guard(xirr(flowsOf(ub), 'unassigned benchmark XIRR (E-142)', [irr.sourceId]), ub) : xirrGap('no-benchmark'),
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

function h0(holdings: readonly Holding[]): string | null {
  return holdings[0] ? (holdings[0].sourceId as string) : null;
}
