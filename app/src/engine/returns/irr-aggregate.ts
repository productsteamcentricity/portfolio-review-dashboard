// The IRR adapter for the M3b holdings sheet (PLAN-05 part 3, NB-03 to CHAT-009 NB-02): the fund and benchmark XIRR of
// a client, of an asset class under that client, or of a product under that asset class, read from the family scope's
// IRR tree (engine/returns/irr-tree.ts: portfolio > client > asset > product > instrument; each node carries a fund and a
// benchmark XirrResult). When this returns null, the caller uses its CMV-weighted base-file path instead.
//
//   - no asset: the client node; an asset: the asset node under that client; an asset and a product: the product node
//     under that asset node. The asset and product labels are matched on the normalised label (engine/ids.ts
//     normaliseLabel: spacing and case only), never by similarity; the client by its per-review id (KI-111).
//   - null when the client has no node in the tree (no fund flow of the client in the transactions file), when the
//     asset or product label is not in the transactions file under that client, or when a product is given without
//     its asset class.
//   - a node whose XIRR is a gap (one sign, one date, no solution, no benchmark, not reconciled) gives that missing Value
//     with its status (KI-100: a blank with its status), never null and never the base-file figure in its place.
//
// LABEL CAVEAT: the tree's asset and product labels are those of the transactions file's rows (its ASSET and PRODUCT
// columns), not the base file's. A base-file holding whose asset class or product is labelled differently (for example
// "Equity" in one file and "Equity Funds" in the other) does not line up, and this returns null for it. A blank label in
// the transactions file is the tree's blank label (the dash), which a base-file label never matches.
//
// `scope.holdingIds` (the holdings of the caller's line) are not used to pick the node: the tree's nodes are keyed by
// labels, and the holdings join (engine/match) is per instrument. They are part of the contract so that a later rule
// (for example: return null when none of the line's holdings joins an instrument of the node) needs no new signature.
// Pure: no globals.

import type { ClientId, HoldingId } from '../../model/ids.ts';
import type { IrrNode } from '../../model/returns.ts';
import type { Value } from '../../model/value.ts';
import type { ReviewReturns } from './review-returns.ts';
import { normaliseLabel } from '../ids.ts';

export type IrrAggregateScope = { asset?: string; product?: string; holdingIds: HoldingId[] };

/** The fund and benchmark XIRR ('pct') of the client, asset or product node; null when there is no such node. */
export function irrAggregateFor(
  returns: ReviewReturns,
  clientId: ClientId,
  scope: IrrAggregateScope,
): { fund: Value<number>; bench: Value<number> } | null {
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
    if (!asset) return null;
    node = asset;
    if (scope.product !== undefined) {
      const product = childByLabel(tree, node, 'product', scope.product);
      if (!product) return null;
      node = product;
    }
  }
  return { fund: node.fund.xirr, bench: node.bench.xirr };
}

function childByLabel(tree: readonly IrrNode[], parent: IrrNode, level: 'asset' | 'product', label: string): IrrNode | undefined {
  const want = normaliseLabel(label);
  return tree.find((n) => n.level === level && n.parentKey === parent.key && normaliseLabel(n.label) === want);
}
