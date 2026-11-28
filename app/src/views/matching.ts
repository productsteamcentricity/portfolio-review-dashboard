// The import report's matching section (parity row E-19; architecture §13.1 Preview; MOD-04's plan for test build 1):
// what each holding was matched to and how, so a match the analyst would not expect is visible before the review.
// Selection and labelling only; engine/match/resolve-holdings.ts decides.
//
//   - counts by how a holding resolved: the base file's ISIN, an AMFI code, the exact reference name, an owner-approved
//     alias, a name match (a proposal: the names differ), unmatched; and the non-fund classes, which have no fund data
//     by design (LP-16);
//   - "matched to": every holding whose match is an alias or a name match, with the reference name it took;
//   - unmatched: every fund, PMS, AIF, SIF or listed share that matched nothing;
//   - warnings: each product-class rule the page did not apply (an unknown field or class; never applied loosely).
// Sentences never contain an en or em dash (D-029).

import type { Holding } from '../model/holding.ts';
import type { MatchReport, MatchRoute } from '../engine/match/resolve-holdings.ts';
import { plainText, plural } from './format.ts';

export const MATCHING_NO_DATA = 'The reference data is not in this page, so no holding is matched to a fund.';

export type MatchingCount = { id: string; label: string; value: number };
export type MatchedToRow = { holding: string; matchedTo: string; how: string };
export type UnmatchedRow = { holding: string; kind: string };
export type MatchingVM = {
  summary: string;
  counts: MatchingCount[];
  otherClasses: Array<{ label: string; count: number }>;
  matchedTo: MatchedToRow[];
  unmatched: UnmatchedRow[];
  note: string;
  /** Product-class rules not applied, one sentence each. */
  warnings: string[];
  /** Matching could not run: the sentence for the error card (CHAT-008 B1); null otherwise. */
  error: string | null;
};

export const MATCHING_FAILED = 'Matching to reference data failed, so no holding is matched and no figure from reference data is used.';

const ROUTE_TEXT: Readonly<Record<Exclude<MatchRoute, 'other'>, string>> = {
  MF: 'mutual fund', SIF: 'SIF', AIF: 'AIF', PMS: 'PMS', STOCK: 'listed share',
};

export function buildMatchingSection(report: MatchReport | null, holdings: readonly Holding[]): MatchingVM {
  if (!report) return { summary: MATCHING_NO_DATA, counts: [], otherClasses: [], matchedTo: [], unmatched: [], note: '', warnings: [], error: null };
  if (report.failed !== undefined) {
    return {
      summary: MATCHING_FAILED, counts: [], otherClasses: [], matchedTo: [], unmatched: [], note: '', warnings: [],
      error: `${MATCHING_FAILED} The reason: ${plainText(report.failed)}`,
    };
  }
  const byId = new Map(holdings.map((h) => [h.id, h]));
  let isin = 0, amfi = 0, exact = 0, alias = 0, name = 0, none = 0;
  const other = new Map<string, number>();
  const matchedTo: MatchedToRow[] = [];
  const unmatched: UnmatchedRow[] = [];
  for (const e of report.entries) {
    const h = byId.get(e.holdingId);
    const holding = plainText(h ? h.instrumentName : '');
    if (e.route === 'other') {
      other.set(e.classLabel ?? 'Other', (other.get(e.classLabel ?? 'Other') ?? 0) + 1);
      continue;
    }
    const r = e.ref?.resolution;
    const key = e.ref?.vendorKey;
    if (!r || r.method === 'none' || key === undefined) {
      none++;
      unmatched.push({ holding, kind: ROUTE_TEXT[e.route] });
      continue;
    }
    if (r.method === 'isin') isin++;
    else if (r.method === 'amfi') amfi++;
    else if (r.method === 'alias-pin') { alias++; matchedTo.push({ holding, matchedTo: plainText(key), how: 'approved alias (the owner\'s list: a renamed scheme, or another spelling of it)' }); }
    else if (r.method === 'name-match' && r.confidence !== 'exact') { name++; matchedTo.push({ holding, matchedTo: plainText(key), how: 'name match' }); }
    else exact++;
  }
  const matched = isin + amfi + exact + alias + name;
  const otherTotal = [...other.values()].reduce((a, b) => a + b, 0);
  const summary = `${plural(matched, 'holding is', 'holdings are')} matched to reference data and ${plural(none, 'is', 'are')} unmatched`
    + (otherTotal > 0 ? `; ${plural(otherTotal, 'holding is', 'holdings are')} of a class with no fund data.` : '.');
  return {
    summary,
    counts: [
      { id: 'isin', label: 'Matched by the file\'s ISIN', value: isin },
      { id: 'amfi', label: 'Matched by AMFI scheme code', value: amfi },
      { id: 'exact', label: 'Matched by the exact reference name', value: exact },
      { id: 'alias', label: 'Matched by an approved alias (a renamed scheme, or another spelling of it)', value: alias },
      { id: 'name', label: 'Matched by name (the names differ: check below)', value: name },
      { id: 'none', label: 'Unmatched (no figures from reference data)', value: none },
    ],
    otherClasses: [...other].map(([label, count]) => ({ label, count })),
    matchedTo,
    unmatched,
    note: 'A tie between two funds, or a match that leaves a distinctive word of either name unmatched, is not taken: such a holding is shown as unmatched rather than given another fund\'s figures.',
    error: null,
    warnings: (report.skippedRules ?? []).map((s) => `The product class rule "${plainText(s.label)}" was not applied: ${s.reason}. The holdings it would place are classed by the other rules, else as mutual funds.`),
  };
}
