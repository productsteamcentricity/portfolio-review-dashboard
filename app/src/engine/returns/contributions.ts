// Contributors and laggards (milestone M3a, NB-M3a; parity row E-29; contract I-31 Contributions; KI-006). A port of
// the legacy contribLag (index.html, 07_engine.js:2092):
//   - one line per instrument (the legacy grouped by holding name): its market value summed, its XIRR the market-value
//     weighted XIRR of its holdings;
//   - allocation = the line's market value over the scope's total market value (every holding of the scope, including
//     those without an XIRR, as the legacy totalCMV), contribution = allocation % x XIRR / 100, in percentage points:
//     an approximation, not an attribution (R-AN-10: the method is labelled);
//   - a holding without an XIRR, or without a positive market value, is left out of the lines and counted in the
//     coverage, never counted as 0% (KI-006);
//   - the legacy order and ties: contributors are the top five by contribution, then allocation, then market value;
//     laggards the bottom five of the other lines by the reverse order; drags every negative line, most negative first.
// One correction (E-29, "the all-negative guard"): when no line contributes positively, no line is called a
// contributor; the laggards are then the bottom five of all lines. Pure: no globals.

import type { Contributions, ContributionRow, ReturnsCoverage } from '../../model/returns.ts';
import type { HoldingId } from '../../model/ids.ts';
import type { Value } from '../../model/value.ts';
import { present } from '../value.ts';

export const TOP_N = 5;

/** One holding of the scope, with its market value (Crore) and its XIRR (percent number), either possibly missing. */
export type ContributionInput = {
  holdingId: HoldingId;
  /** The line the holding belongs to (one instrument): holdings with the same key are one line. */
  lineKey: string;
  label: string;
  cmvCr: Value<number>;
  xirrPct: Value<number>;
};

type Line = { key: string; label: string; holdingIds: HoldingId[]; cmv: number; wx: number; alloc: number; fund: number; contrib: number };

export function computeContributions(inputs: readonly ContributionInput[], sources: readonly string[] = []): Contributions {
  const prov = (method: string) => ({ sources: [...sources], method });
  let total = 0;
  for (const h of inputs) if (h.cmvCr.kind === 'value') total += h.cmvCr.v;
  const lines = new Map<string, Line>();
  let includedHoldings = 0;
  let coveredCmv = 0;
  for (const h of inputs) {
    if (h.xirrPct.kind !== 'value' || h.cmvCr.kind !== 'value' || !(h.cmvCr.v > 0)) continue;
    includedHoldings++;
    coveredCmv += h.cmvCr.v;
    const l = lines.get(h.lineKey) ?? { key: h.lineKey, label: h.label, holdingIds: [], cmv: 0, wx: 0, alloc: 0, fund: 0, contrib: 0 };
    l.holdingIds.push(h.holdingId);
    l.cmv += h.cmvCr.v;
    l.wx += h.xirrPct.v * h.cmvCr.v;
    lines.set(h.lineKey, l);
  }
  const arr = [...lines.values()].map((l) => {
    const fund = l.wx / l.cmv;
    const alloc = total ? (l.cmv / total) * 100 : 0;
    return { ...l, fund, alloc, contrib: (alloc * fund) / 100 };
  });
  const desc = arr.slice().sort((a, b) => (b.contrib - a.contrib) || (b.alloc - a.alloc) || (b.cmv - a.cmv));
  const allNegative = !arr.some((x) => x.contrib > 0);
  const contributors = allNegative ? [] : desc.slice(0, TOP_N).map((x) => x.key);
  const cset = new Set(contributors);
  const laggards = arr.filter((x) => !cset.has(x.key))
    .sort((a, b) => (a.contrib - b.contrib) || (a.alloc - b.alloc) || (a.cmv - b.cmv))
    .slice(0, TOP_N).map((x) => x.key);
  const drags = arr.filter((x) => x.contrib < 0).sort((a, b) => a.contrib - b.contrib).map((x) => x.key);

  const rows: ContributionRow[] = desc.map((l) => ({
    key: l.key,
    label: l.label,
    holdingIds: l.holdingIds,
    cmv: present(l.cmv, 'cr', prov('sum of the holdings\' market value')),
    allocationPct: present(l.alloc, 'pct', prov('market value over the scope\'s total market value')),
    xirr: present(l.fund, 'pct', prov('market-value weighted XIRR of the holdings')),
    contributionPp: present(l.contrib, 'pp', prov('allocation x XIRR (an approximation, not an attribution)')),
  }));
  const coverage: ReturnsCoverage = {
    share: total > 0 ? Math.min(1, coveredCmv / total) : 0,
    basis: 'cmv',
    included: includedHoldings,
    excluded: inputs.length - includedHoldings,
  };
  return { method: 'allocation-x-xirr', rows, contributors, laggards, drags, allNegative, coverage };
}
