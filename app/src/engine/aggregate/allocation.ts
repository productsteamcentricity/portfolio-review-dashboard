// Asset allocation (asset class, then product) and liquidity (architecture §8; parity rows E-22, E-18; D-039).
//
// - One asset order everywhere: ASSET_ORDER (Equity, Debt, Hybrid, Commodity, REITs/InvITs, Unknown), present classes
//   only. A blank or unrecognised Asset Name is Unknown, never Equity (OD-7); `unknownLabels` lists what was read.
// - Products within a class by CMV, highest first; ties keep their first appearance.
// - Every line follows the totals' rules (totals.ts groupFigures); its percent is its CMV over the total CMV, unrounded.
// - Liquidity: the file's labels when it has any, else the legacy rule; lines with a CMV above 0, in first appearance,
//   the rule's lines Open Ended then Close Ended (07_engine.js:1171-1185).
// Groups are keyed in Maps, never in plain objects, so a label such as "__proto__" is an ordinary label.

import type { Holding } from '../../model/holding.ts';
import type { AllocationLine, AssetAllocation, AssetBlock, AssetKey, LiquidityAllocation, Totals } from '../../model/review.ts';
import { ASSET_ORDER } from '../../model/review.ts';
import { groupFigures, isIncluded, pctOf } from './totals.ts';
import { liquidityLabel } from '../classify/liquidity.ts';

/** The allocation class of a holding: its canonical class, or Unknown (OD-7). */
export function assetKeyOf(h: Holding): AssetKey {
  return h.assetClass ?? 'Unknown';
}

/** A line over the members, in their order. */
export function makeLine(key: string, label: string, members: readonly Holding[], totals: Totals, what: string): AllocationLine {
  const f = groupFigures(members, what);
  return {
    key,
    label,
    holdingIds: members.map((h) => h.id),
    cmv: f.cmv,
    invested: f.invested,
    gain: f.gain,
    absReturnPct: f.absReturnPct,
    investedCoveragePct: f.investedCoveragePct,
    pct: pctOf(f.cmv, totals.cmv),
    withoutInvested: f.withoutInvested,
  };
}

const cmvNumber = (l: AllocationLine): number => (l.cmv.kind === 'value' ? l.cmv.v : Number.NEGATIVE_INFINITY);

/** Highest CMV first; equal values keep their order (Array.prototype.sort is stable). */
export function byCmvDescending(lines: AllocationLine[]): AllocationLine[] {
  return lines.sort((a, b) => {
    const x = cmvNumber(a);
    const y = cmvNumber(b);
    return x === y ? 0 : x > y ? -1 : 1;
  });
}

function groupBy<K>(members: readonly Holding[], keyOf: (h: Holding) => K): Map<K, Holding[]> {
  const out = new Map<K, Holding[]>();
  for (const h of members) {
    const k = keyOf(h);
    const g = out.get(k);
    if (g) g.push(h); else out.set(k, [h]);
  }
  return out;
}

export function computeAssetAllocation(holdings: readonly Holding[], totals: Totals): AssetAllocation {
  const inc = holdings.filter(isIncluded);
  const byAsset = groupBy(inc, assetKeyOf);
  const assets: AssetBlock[] = [];
  for (const asset of ASSET_ORDER) {
    const members = byAsset.get(asset);
    if (!members) continue;
    const products = [...groupBy(members, (h) => h.product).entries()]
      .map(([p, ms]) => makeLine(`product:${asset}:${p}`, p, ms, totals, `${asset}, ${p}`));
    assets.push({ asset, line: makeLine(`asset:${asset}`, asset, members, totals, asset), products: byCmvDescending(products) });
  }
  const unknownLabels: string[] = [];
  for (const h of byAsset.get('Unknown') ?? []) {
    const label = h.assetLabel ?? '';
    if (!unknownLabels.includes(label)) unknownLabels.push(label);
  }
  return { assets, total: makeLine('total', 'Grand Total', inc, totals, 'the review'), unknownLabels };
}

/** Every liquidity line over the included holdings, in first appearance (the rule's lines Open Ended then Close Ended). */
function liquidityLines(holdings: readonly Holding[], totals: Totals): { fileHasLabels: boolean; lines: AllocationLine[] } {
  const inc = holdings.filter(isIncluded);
  const fileHasLabels = inc.some((h) => h.liquidity !== null);
  const groups = new Map<string, Holding[]>();
  if (!fileHasLabels) { groups.set('Open Ended', []); groups.set('Close Ended', []); }
  for (const h of inc) {
    const label = liquidityLabel(h, fileHasLabels);
    const g = groups.get(label);
    if (g) g.push(h); else groups.set(label, [h]);
  }
  const lines: AllocationLine[] = [];
  for (const [label, members] of groups) {
    if (members.length > 0) lines.push(makeLine(`liquidity:${label}`, label, members, totals, label));
  }
  return { fileHasLabels, lines };
}

const aboveZero = (l: AllocationLine): boolean => l.cmv.kind === 'value' && l.cmv.v > 0;

export function computeLiquidity(holdings: readonly Holding[], totals: Totals): LiquidityAllocation {
  const { fileHasLabels, lines } = liquidityLines(holdings, totals);
  return { basis: fileHasLabels ? 'file-labels' : 'rule', lines: lines.filter(aboveZero) };
}

/**
 * The labels of the liquidity lines computeLiquidity leaves out because their market value is 0 or less (a negative
 * market value, D-039 point 2), in first appearance. The overview names them in a note (M1.4 fix round 2).
 */
export function liquidityLeftOut(holdings: readonly Holding[], totals: Totals): string[] {
  return liquidityLines(holdings, totals).lines.filter((l) => !aboveZero(l)).map((l) => l.label);
}
