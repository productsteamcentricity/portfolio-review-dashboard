// The IRR adapter for the M3b holdings sheet (PLAN-05 part 3, NB-03 to CHAT-009 NB-02): the fund and benchmark XIRR of
// a client, of an asset class under that client, or of a product under that asset class, read from the family scope's
// IRR tree (engine/returns/irr-tree.ts: portfolio > client > asset > product > instrument; each node carries a fund and a
// benchmark XirrResult). A node's XIRR is that of the IRR file's flows of the instruments in the node (the transactions
// file), not of the base file's holdings. When this returns null, the caller uses its CMV-weighted base-file path.
// Every result carries its basis, 'irr-tree' (MOD-05, Gate B of d6401f6), so a later contract can add a labelled
// coverage figure without a new signature.
//
// Which node (Gate B of d6401f6, B1; MOD-05):
//   - no asset: the client node; an asset: the asset node under that client; an asset and a product: the product node
//     under that asset node. The client by its per-review id (KI-111).
//   - the tree groups asset and product nodes on the EXACT label of the transactions file, so "Equity" and "EQUITY"
//     under one client are two nodes. A node whose label equals the scope's label exactly wins. Else the one node whose
//     normalised label (engine/ids.ts normaliseLabel: spacing and case only, never similarity) equals the scope's.
//     When several nodes match on the normalised label and none exactly, the line's XIRR cannot be read from one node
//     (each holds only part of the class), so the result is a missing value (NOT COMPARABLE) with that reason, never
//     one of them.
//
// Whether the node may stand for the line (Gate B of d6401f6, B2; MOD-05): `scope.holdingIds` are the holdings of the
// caller's line. A figure is returned only when the node's holdings (node.holdingIds) and the line's are the same set
// and the node holds no redeemed instrument (an instrument with flows and no current holding, whose flows are in the
// node's XIRR but on no line). Otherwise a missing value with a reason naming the case and the counts:
//   - the node lacks some of the line's holdings (PARTIAL COVERAGE): holdings with no flow in the IRR file (i); holdings
//     whose flows are not in this node: left out of the tree for an invalid benchmark (ii, OD-4), or under another asset
//     or product label in the IRR file (iv);
//   - the node holds more than the line (NOT COMPARABLE): holdings not on the line, or redeemed instruments (iii).
// An empty `scope.holdingIds` keeps the label-only lookup (no coverage check): the client node or the labelled node.
//
// null only when: there is no family scope, the client has no node in the tree (no fund flow of the client in the
// transactions file), the asset or product label is not in the transactions file under that client at all, a product
// is given without its asset class, or the label is the tree's blank marker (the dash, BLANK_LABEL: a blank label in the
// transactions file is no label, so a base-file label never stands for it; Gate B of d6401f6, F4).
//
// A node whose XIRR is a gap (one sign, one date, no solution, no benchmark, not reconciled) gives that missing Value
// with its status (KI-100: a blank with its status), never null and never the base-file figure in its place.
// Pure: no globals.

import type { ClientId, HoldingId } from '../../model/ids.ts';
import type { IrrNode } from '../../model/returns.ts';
import type { MissingStatus } from '../../model/status.ts';
import type { Value } from '../../model/value.ts';
import type { ReviewReturns } from './review-returns.ts';
import { STATUS } from '../../model/status.ts';
import { normaliseLabel } from '../ids.ts';
import { missing } from '../value.ts';
import { BLANK_LABEL } from './irr-tree.ts';

export type IrrAggregateScope = { asset?: string; product?: string; holdingIds: HoldingId[] };

/** The adapter's result: the node's fund and benchmark XIRR ('pct'), or one missing value on both, and its basis. */
export type IrrAggregate = { fund: Value<number>; bench: Value<number>; basis: 'irr-tree' };

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function missingBoth(status: MissingStatus, reason: string): IrrAggregate {
  const m = missing(status, reason);
  return { fund: m, bench: m, basis: 'irr-tree' };
}

/** The fund and benchmark XIRR of the client, asset or product node, or a missing value with its reason; null when there is no such node. */
export function irrAggregateFor(returns: ReviewReturns, clientId: ClientId, scope: IrrAggregateScope): IrrAggregate | null {
  const family = returns.scopes.find((s) => s.scope.kind === 'family');
  if (!family) return null;
  const tree = family.result.tree;
  const clientNode = tree.find((n) => n.level === 'client' && n.clientId === clientId);
  if (!clientNode) return null;
  let node: IrrNode = clientNode;
  // A product without its asset class names no node (products sit under asset classes in the tree).
  if (scope.product !== undefined && scope.asset === undefined) return null;
  if (scope.asset !== undefined) {
    const asset = childByLabel(tree, node, 'asset', scope.asset);
    if (asset === null) return null;
    if ('ambiguous' in asset) return missingBoth(STATUS.NOT_COMPARABLE, asset.ambiguous);
    node = asset;
    if (scope.product !== undefined) {
      const product = childByLabel(tree, node, 'product', scope.product);
      if (product === null) return null;
      if ('ambiguous' in product) return missingBoth(STATUS.NOT_COMPARABLE, product.ambiguous);
      node = product;
    }
  }
  if (scope.holdingIds.length > 0) {
    const gap = coverageGap(tree, node, scope.holdingIds, family.result.reconciliation.holdingsWithoutFlows);
    if (gap) return missingBoth(gap.status, gap.reason);
  }
  return { fund: node.fund.xirr, bench: node.bench.xirr, basis: 'irr-tree' };
}

/** The child node of that label: exact first, else the one normalised match; several normalised matches are ambiguous. */
function childByLabel(tree: readonly IrrNode[], parent: IrrNode, level: 'asset' | 'product', label: string): IrrNode | { ambiguous: string } | null {
  if (normaliseLabel(label) === normaliseLabel(BLANK_LABEL)) return null;
  const children = tree.filter((n) => n.level === level && n.parentKey === parent.key);
  const exact = children.find((n) => n.label === label);
  if (exact) return exact;
  const want = normaliseLabel(label);
  const near = children.filter((n) => normaliseLabel(n.label) === want);
  if (near.length === 0) return null;
  if (near.length === 1) return near[0]!;
  const what = level === 'asset' ? 'asset classes under this client' : 'products under this asset class';
  return { ambiguous: `The transactions file has ${near.length} ${what} that match "${label}" only when case and spacing are ignored, and none spelt exactly so; each holds part of the flows, so the line's XIRR cannot be read from one of them.` };
}

/** Why the node may not stand for the line (B2), or null when it may: the same holdings and no redeemed instrument. */
function coverageGap(tree: readonly IrrNode[], node: IrrNode, lineIds: readonly HoldingId[],
  withoutFlows: readonly HoldingId[]): { status: MissingStatus; reason: string } | null {
  const line = new Set(lineIds);
  const inNode = new Set(node.holdingIds);
  const lacking = [...line].filter((id) => !inNode.has(id));
  const outside = [...inNode].filter((id) => !line.has(id));
  const redeemed = descendants(tree, node).filter((n) => n.level === 'instrument' && n.redeemed).length;
  if (lacking.length === 0 && outside.length === 0 && redeemed === 0) return null;
  const parts: string[] = [];
  if (lacking.length > 0) {
    const noFlow = new Set(withoutFlows);
    const nf = lacking.filter((id) => noFlow.has(id)).length;
    const elsewhere = lacking.length - nf;
    if (nf > 0) parts.push(`${plural(nf, 'holding has', 'holdings have')} no flow in the IRR file`);
    if (elsewhere > 0) parts.push(`${plural(elsewhere, 'holding has', 'holdings have')} flows that are not in this node (left out for an invalid benchmark, or under another label in the IRR file)`);
  }
  if (outside.length > 0) parts.push(`the node also holds ${plural(outside.length, 'holding', 'holdings')} not on this line`);
  if (redeemed > 0) parts.push(`the node also holds ${plural(redeemed, 'redeemed instrument', 'redeemed instruments')} (flows in the IRR file, no current holding)`);
  const head = `XIRR covers ${line.size - lacking.length} of ${plural(line.size, 'holding', 'holdings')} on this line`;
  return { status: outside.length > 0 || redeemed > 0 ? STATUS.NOT_COMPARABLE : STATUS.PARTIAL, reason: `${head}: ${parts.join('; ')}.` };
}

/** The node's descendants (the tree lists every parent before its children). */
function descendants(tree: readonly IrrNode[], node: IrrNode): IrrNode[] {
  const out: IrrNode[] = [];
  const keys = new Set([node.key]);
  for (const n of tree) if (n.parentKey !== null && keys.has(n.parentKey)) { out.push(n); keys.add(n.key); }
  return out;
}
