// XIRR (milestone M3a, NB-M3a; parity row E-26 "the legacy solver ported as is"; contract I-31 model/returns.ts;
// KI-047). A port of the legacy `xirr` (index.html, 07_engine.js:998) onto calendar days:
//   - actual/365: each flow's time is (day - first day) / 365, on whole DayNumbers, so no time zone or time of day
//     enters (the legacy measured milliseconds between local-time Dates shifted by 12 hours);
//   - the bracket [-0.999999, 100] (a rate from -99.9999% to 10,000% a year), bisected on the WIDTH of the bracket until
//     it is below 1e-12, never on a small NPV alone (the legacy fix for the Rs 0.001 placeholder that gave 4950%);
//   - when the NPV has the same sign at both ends, the legacy Newton fallback from 10%, accepted only when it converges
//     (relative step below 1e-9) and its NPV is at most 1e-6 of the size of the flows (KI-047);
//   - no rate exists when every flow falls on one day, or the flows have one sign (KI-047): those are gaps, never 0%
//     or a bracket edge (KI-006).
// Two additions, neither a change of any legacy figure: an NPV that is NaN at a bracket edge (flows spanning more than
// about fifty years, paid in and out, make discount factors underflow to infinities of both signs) and a flow whose day
// or amount is not a finite number give 'no-solution' instead of a figure computed on NaN.
// Rates are returned as percent numbers (unit 'pct', I-31): 10 means 10% a year. Pure: no globals, no clock.

import type { CashFlow, XirrGap, XirrResult } from '../../model/returns.ts';
import type { MissingStatus } from '../../model/status.ts';
import { STATUS } from '../../model/status.ts';
import { missing, present } from '../value.ts';

/** The legacy bracket: lower and upper rate as fractions a year. */
export const XIRR_LOWER = -0.999999;
export const XIRR_UPPER = 100;
/** Bisection stops when the bracket is narrower than this (CLAUDE.md: "bisection to bracket width < 1e-12"). */
export const XIRR_BRACKET_WIDTH = 1e-12;
export const DAYS_PER_YEAR = 365;

/** The status of each gap (model/returns.ts header: the gap fixes the status). */
export const GAP_STATUS: Readonly<Record<XirrGap, MissingStatus>> = {
  'no-irr-file': STATUS.NOT_AVAILABLE,
  'no-flows': STATUS.NOT_AVAILABLE,
  'no-benchmark': STATUS.NOT_AVAILABLE,
  'one-sign': STATUS.INSUFFICIENT_EVIDENCE,
  'one-date': STATUS.INSUFFICIENT_EVIDENCE,
  'no-solution': STATUS.INSUFFICIENT_EVIDENCE,
  'not-reconciled': STATUS.INSUFFICIENT_EVIDENCE,
  'under-one-year': STATUS.INSUFFICIENT_EVIDENCE,
  'invalid-benchmark': STATUS.INVALID_SOURCE,
};

const GAP_REASON: Readonly<Record<XirrGap, string>> = {
  'no-irr-file': 'no IRR file is loaded',
  'no-flows': 'there are no cash flows',
  'no-benchmark': 'there are no benchmark flows',
  'one-sign': 'the cash flows are all paid in or all paid out, so no rate of return exists',
  'one-date': 'every cash flow falls on one day, so no rate of return exists',
  'no-solution': 'the cash flows have no rate of return the solver can find',
  'not-reconciled': 'the flows of this scope do not reconcile to its holdings',
  'under-one-year': 'the flows span less than one year',
  'invalid-benchmark': 'the benchmark flows are invalid',
};

/** A missing XIRR result for a gap, over the given flows. */
export function xirrGap(gap: XirrGap, flows: readonly CashFlow[] = []): XirrResult {
  const { first, last } = span(flows);
  return { xirr: missing(GAP_STATUS[gap], GAP_REASON[gap]), gap, flows: flows.length, firstDay: first, lastDay: last };
}

function span(flows: readonly CashFlow[]): { first: number | null; last: number | null } {
  let first: number | null = null;
  let last: number | null = null;
  for (const f of flows) {
    if (first === null || f.day < first) first = f.day;
    if (last === null || f.day > last) last = f.day;
  }
  return { first, last };
}

/** The outcome of the solver on raw flows: a rate as a fraction a year, or a gap. Exported for tests. */
export type SolverOutcome = { rate: number; method: 'bisection' | 'newton' } | { gap: XirrGap };

/** The legacy solver (07_engine.js:998) on DayNumbers. */
export function solveXirr(flows: readonly CashFlow[]): SolverOutcome {
  if (flows.length === 0) return { gap: 'no-flows' };
  for (const f of flows) {
    if (!Number.isFinite(f.amount) || !Number.isFinite(f.day)) return { gap: 'no-solution' };
  }
  if (flows.length < 2) return { gap: 'one-sign' };
  let hasP = false;
  let hasN = false;
  for (const f of flows) { if (f.amount > 0) hasP = true; else if (f.amount < 0) hasN = true; }
  if (!(hasP && hasN)) return { gap: 'one-sign' };
  let t0 = flows[0]!.day;
  for (const f of flows) if (f.day < t0) t0 = f.day;
  const yrs: number[] = [];
  const amt: number[] = [];
  let maxYrs = 0;
  let scale = 0;
  for (const f of flows) {
    const y = (f.day - t0) / DAYS_PER_YEAR;
    yrs.push(y);
    amt.push(f.amount);
    if (y > maxYrs) maxYrs = y;
    scale += Math.abs(f.amount);
  }
  // KI-047: every flow on one day makes the NPV the same at every rate: no rate of return exists.
  if (!(maxYrs > 0)) return { gap: 'one-date' };
  const npv = (r: number): number => {
    let s = 0;
    for (let j = 0; j < amt.length; j++) s += amt[j]! / Math.pow(1 + r, yrs[j]!);
    return s;
  };
  let lo = XIRR_LOWER;
  let hi = XIRR_UPPER;
  let flo = npv(lo);
  const fhi = npv(hi);
  // An infinite NPV still has a sign and bisects as in the legacy; only NaN (an infinite term of each sign) cannot.
  if (Number.isNaN(flo) || Number.isNaN(fhi)) return { gap: 'no-solution' };
  if (flo * fhi > 0) {
    // The legacy Newton fallback from 10%, accepted only on convergence with a negligible NPV (KI-047).
    let r = 0.1;
    let conv = false;
    for (let i = 0; i < 100; i++) {
      const f = npv(r);
      let d = 0;
      for (let j = 0; j < amt.length; j++) d += -yrs[j]! * amt[j]! / Math.pow(1 + r, yrs[j]! + 1);
      if (d === 0) break;
      let rn = r - f / d;
      if (rn <= -0.9999) rn = (-0.9999 + r) / 2;
      if (Math.abs(rn - r) < 1e-9 * Math.max(1, Math.abs(r))) { r = rn; conv = true; break; }
      r = rn;
    }
    return conv && Math.abs(npv(r)) <= 1e-6 * scale ? { rate: r, method: 'newton' } : { gap: 'no-solution' };
  }
  // Bisection on the width of the bracket; signs compared directly (a product can underflow to 0).
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid);
    if ((flo < 0) !== (fm < 0)) hi = mid;
    else { lo = mid; flo = fm; }
    if (hi - lo < XIRR_BRACKET_WIDTH) break;
  }
  return { rate: (lo + hi) / 2, method: 'bisection' };
}

/** The XIRR of a set of flows (I-31 XirrResult): a percent number a year, or missing with its gap and status. */
export function xirr(flows: readonly CashFlow[], method = 'xirr actual/365 (legacy solver, E-26)', sources: readonly string[] = []): XirrResult {
  const out = solveXirr(flows);
  if ('gap' in out) return xirrGap(out.gap, flows);
  const { first, last } = span(flows);
  return {
    xirr: present(out.rate * 100, 'pct', { sources: [...sources], method: `${method}; ${out.method}` }),
    gap: null,
    flows: flows.length,
    firstDay: first,
    lastDay: last,
  };
}
