// The realised gains of the capital-gains statement reconciled with those derived from the IRR file, per scheme and
// financial year, and the realised figure the review uses (NB-M7a S5; parity row E-141, AC-18; architecture §6.7;
// DATA_DICTIONARY §5.5 `RealisedGain.source`, §6 `tax.realisedFY.{st,lt,source}`; design
// docs/new-build/capital-gains-upload.md §4, §7, §8; Q-49).
//
// Pairing. A statement lot's person is joined to an IRR client (the S4b Q-52 rule: a review client by its id), by the
// id first, else by the label as spelt, else by the label with letter case folded when that names exactly one IRR client
// (the reader's own rule for review clients). Within a client, each statement scheme label is matched to the IRR
// instrument names of the same client by the legacy matcher (engine/match/instrument.ts `matchInstrument`, no AMC: the
// anchor is the label's first token). Several statement labels may meet one instrument; they are then one scheme.
//
// The two sides of a scheme-year:
//   - statement: the lots counted in the year's realised total (repeats excluded as "once" left out), each by its
//     `realisedCounted`: a non-taxable transfer's gain is left out unless its successor lots are successor-reset (the
//     kept share), design §4;
//   - derived: realised-irr.ts lots of the instrument in that year. A derived sale on the day of a non-taxable merger
//     event of the matched statement scheme (same client) is that merger seen from the IRR file: it is left out on this
//     side too, but for the share the statement keeps (design §4: "left out of the year's realised total and of the IRR
//     reconciliation").
//
// Outcomes: 'reconciled' (difference within tolerance), 'differs' (beyond: both figures kept, High `tax.realised-differs`),
// 'insufficient-evidence' (the statement's year holds an unanswered repeat event: not reconciled, design §6),
// 'not-reconciled' (a side is incomplete: a statement lot with an unknown gain, or a derived lot with a gap; nothing is
// compared on a partial figure), 'statement-only' and 'irr-only' (a scheme-year on one side only; the schemes with no
// counterpart at all are listed too).
//
// TOLERANCE (the choice, MOD-04 to confirm): the larger of
//   (a) the reader's amount tolerance (ingest/capital-gains.ts `amountTolerance`: Rs 1 or 0.01%, the larger) on the
//       larger of the two sides' sale values summed over the scheme-year: design §4 checks a lot's Realized G/L on its
//       Sell Amount, so the relative part scales with the money sold, not with the gain (a small gain on a large sale
//       carries the sale's rounding);
//   (b) the reader's totals tolerance (`totalsTolerance`: Rs 1 plus Rs 0.005 per lot row summed) over the statement's
//       lot rows of the scheme-year: each row is rounded to the paisa on Sell Amount and Invested Value, and a SIP
//       scheme-year can sum hundreds of such rows, while the derived side carries the IRR amounts unrounded.
// The difference is taken from each side's sum rounded to whole paise and compared with a relative epsilon of a few ULPs
// (F1 of Gate B of 5c9ae0a: a difference exactly at the tolerance reconciles, whatever the float rounding).
// Merger candidates (round 2c, realised-irr.ts 'merger-candidate'): a candidate's gap lot is read as its ordinary-switch
// lots only where the statement shows the merger; there the merger handling above is unchanged. Elsewhere it is a gap.
//
// The review's figure (`tax.realisedFY`, realisedForYear): per client and financial year, the statement where it covers
// that client's year (at least one lot of the client sold in the year: the source of record), else the derived figure
// labelled "derived from transactions"; never the two added inside one client-year, so never inside one scheme-year.
// When the statement covers the client's year but not every IRR scheme with gains derived in it (no statement lot of
// the year matches the scheme), the statement figure is marked PARTIAL (coverage below 1, the schemes left out counted,
// `schemesLeftOut`): Gate B of aa67a45 item 8; the rule itself is an owner question.
// The family figure is the clients' figures added up ("sum of separate computations"); statement lots of a person not in
// the review are left out of it, as the roll-up's familySum. One rule on both sides (R2 S-5, OD-4): derived gains of an
// IRR client with no holding in the base file are left out of it too, and listed with a count (`outsideReview`). Whether
// a client who sold everything in the year belongs in the family's realised figure is owner question Q-4 of the review.
//
// M7b financial review F-4: a client-year with a counted gain whose term is not known gives its long and short figures as
// NOT AVAILABLE (the total and the unknown-term figure stand); the family's long and short figures are then PARTIAL.
//
// Pure. Messages carry counts and financial years only: never a client, scheme, folio or amount. No en or em dash.

import type { CgImport } from '../../ingest/capital-gains.ts';
import { financialYearOf, totalsTolerance } from '../../ingest/capital-gains.ts';
import type { ClientId } from '../../model/ids.ts';
import type { GainSource, RealisedForYear, Term } from '../../model/tax.ts';
import type { Provenance, Value } from '../../model/value.ts';
import type { ValidationResult } from '../../model/validation.ts';
import { STATUS } from '../../model/status.ts';
import { keyOf, normaliseLabel } from '../ids.ts';
import { ymdToDay } from '../dates.ts';
import { missing, present } from '../value.ts';
import { matchInstrument } from '../match/instrument.ts';
import type { TokenCache } from '../match/instrument.ts';
import { schemeKeyOf } from './tax-class.ts';
import type { RealiseResult, TaxLot } from './types.ts';
import type { DerivedLot, DerivedRealised } from './realised-irr.ts';
import { DERIVED_SOURCE, derivedInstrumentKey } from './realised-irr.ts';

export type StatementSide = { imp: CgImport; realised: Pick<RealiseResult, 'gains' | 'events'> };

export type ReconcileOutcome = 'reconciled' | 'differs' | 'insufficient-evidence' | 'not-reconciled' | 'statement-only' | 'irr-only';

export type NotReconciledReason = 'statement-gain-unknown' | 'derived-gaps';

/** One side's figure for a scheme-year (rupees). */
export type SideFigure = {
  /** Lots on this side in the year (statement: counted lots; derived: every derived lot, gaps included). */
  lots: number;
  /** The realised figure: missing or PARTIAL when a lot's gain is unknown (statement) or has a gap (derived). */
  realised: Value<number>;
  /** Realised over the lots whose gain is known. */
  realisedKnown: number;
  /** Lots whose gain is unknown (statement) or with a gap (derived); merger lots left out are not counted. */
  lotsUnknown: number;
  /** Non-taxable transfer lots whose gain is left out (all of it, or all but the kept share). */
  nonTaxableLeftOut: number;
  /** Sale value of the lots with a known gain, non-taxable transfers left out (for the tolerance). */
  saleValue: number;
  st: number;
  lt: number;
  unknownTerm: number;
};

export type ReconcileRow = {
  /** The IRR client when the statement's person joins one; else the statement's client id. */
  clientId: ClientId | null;
  fy: number;
  fyLabel: string;
  /** The statement scheme labels of the pair (empty on an IRR-only row). */
  schemeLabels: string[];
  /** The matched IRR instrument (null on a statement-only scheme with no match). */
  instrumentName: string | null;
  instrumentKey: string | null;
  statement: SideFigure | null;
  derived: SideFigure | null;
  /** Statement minus derived, when compared. */
  difference: number | null;
  tolerance: number | null;
  outcome: ReconcileOutcome;
  reason: NotReconciledReason | null;
  /**
   * Derived lots of the row bought on the day of a non-taxable merger of the same client in another scheme (the
   * merger's successor in the IRR file). The IRR file's switch in carries the merger value as cost, the statement the
   * original cost (design §4, KA-15), so such a row can differ by the merger's gain: named here, not adjusted (S5).
   */
  mergerSuccessorLots: number;
};

export type OneSideScheme = { clientId: ClientId | null; schemeLabels: string[]; instrumentName: string | null; years: string[] };

export type RealisedReconciliation = {
  rows: ReconcileRow[];
  /** Statement schemes with no derived realised gain in any year (instrumentName: the matched instrument, or null). */
  statementOnly: OneSideScheme[];
  /** IRR instruments with derived realised gains and no statement scheme matched to them. */
  irrOnly: OneSideScheme[];
  counts: Record<ReconcileOutcome, number>;
  /** The tolerance rule applied, in words (shown with the result). */
  toleranceRule: string;
  issues: ValidationResult[];
};

export const TOLERANCE_RULE = 'the larger of Rs 1 or 0.01% of the larger sale value summed over the scheme-year (design section 4), and Rs 1 plus Rs 0.005 per statement lot row (design section 7)';

/**
 * The tolerance of one scheme-year (see the header). The amount part is worked from the larger sale-value sum rounded to
 * whole paise: max(Rs 1, paise / 1,000,000), which is ingest/capital-gains.ts `amountTolerance` of that sum in exact
 * terms, so the float noise of a sum of many paise rows does not move it (round 2c financial review V5).
 */
export function reconcileTolerance(statementSale: number, derivedSale: number, statementRows: number): number {
  const paise = Math.round(Math.max(Math.abs(statementSale), Math.abs(derivedSale)) * 100);
  return Math.max(Math.max(1, paise / 1e6), totalsTolerance(statementRows));
}

/** F1: statement minus derived, from each side's sum rounded to whole paise (rupees, an exact count of paise / 100). */
export function paiseDifference(statement: number, derived: number): number {
  return (Math.round(statement * 100) - Math.round(derived * 100)) / 100;
}

/** F1: how many units in the last place of the larger of the two figures the comparison allows. */
const TOLERANCE_ULPS = 4;

/**
 * F1 (Gate B of 5c9ae0a): |difference| <= tolerance with a relative epsilon of a few ULPs, never a bare `<=` on floats:
 * a tolerance of Rs 1.36 is the float 1.3599999999999999 when built as 1 + 0.005 x 72 rows, and a difference of 136 paise
 * is 1.36; the two are the same amount and reconcile.
 */
export function withinTolerance(difference: number, tolerance: number): boolean {
  const d = Math.abs(difference);
  return d - tolerance <= TOLERANCE_ULPS * Number.EPSILON * Math.max(d, Math.abs(tolerance));
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function listText(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const spelt = (s: string): string => s.replace(/\s+/g, ' ').trim();
const fyLabelOf = (fy: number): string => financialYearOf(ymdToDay(fy, 4, 1)!).label;
const num = (v: Value<number>): number | null => (v.kind === 'value' ? v.v : null);

/** A statement client id to an IRR client id (see the header), or null. */
export function clientBridge(imp: CgImport, irrClients: ReadonlyArray<{ clientId: ClientId; clientLabel: string }>): (statementClient: ClientId | null) => ClientId | null {
  const ids = new Set(irrClients.map((c) => c.clientId));
  const exact = new Map<string, ClientId>();
  const folded = new Map<string, Set<ClientId>>();
  for (const c of irrClients) {
    if (!exact.has(spelt(c.clientLabel))) exact.set(spelt(c.clientLabel), c.clientId);
    const f = normaliseLabel(c.clientLabel);
    const s = folded.get(f) ?? new Set<ClientId>();
    s.add(c.clientId);
    folded.set(f, s);
  }
  const labelOf = new Map(imp.persons.map((p) => [p.clientId, p.label]));
  return (c) => {
    if (c === null) return null;
    if (ids.has(c)) return c;
    const label = labelOf.get(c);
    if (label === undefined) return null;
    const e = exact.get(spelt(label));
    if (e !== undefined) return e;
    const f = folded.get(normaliseLabel(label));
    return f && f.size === 1 ? [...f][0]! : null;
  };
}

type Pair = {
  clientId: ClientId | null;
  instrumentKey: string | null;
  instrumentName: string | null;
  schemeLabels: string[];
  stmt: TaxLot[];
  derived: DerivedLot[];
};

/** The kept share of a non-taxable transfer lot's gain (its event's keptShare; 0 when the event is not found). */
function keptShareOf(g: TaxLot, events: StatementSide['realised']['events']): number {
  const ev = events.find((e) => e.eventId === g.eventId);
  if (ev) return ev.keptShare;
  const r = num(g.realised);
  const c = num(g.realisedCounted);
  return r !== null && c !== null && r !== 0 ? c / r : 0;
}

function statementFigure(lots: readonly TaxLot[], prov: Provenance): SideFigure {
  const f: SideFigure = { lots: lots.length, realised: present(0, 'inr', prov), realisedKnown: 0, lotsUnknown: 0, nonTaxableLeftOut: 0, saleValue: 0, st: 0, lt: 0, unknownTerm: 0 };
  for (const g of lots) {
    const nt = g.lotClass === 'non-taxable-transfer';
    if (nt) f.nonTaxableLeftOut++;
    const c = num(g.realisedCounted);
    if (c === null) { f.lotsUnknown++; continue; }
    f.realisedKnown += c;
    if (!nt) f.saleValue += num(g.saleValue) ?? 0;
    const term: Term | null = g.term.kind === 'value' ? g.term.v : null;
    if (term === 'long') f.lt += c; else if (term === 'short') f.st += c; else f.unknownTerm += c;
  }
  f.realised = partialTotal(f.realisedKnown, f.lots, f.lotsUnknown, prov, 'statement lot has an unknown gain (Sell Amount or Invested Value blank or invalid)', 'statement lots have an unknown gain (Sell Amount or Invested Value blank or invalid)');
  return f;
}

function derivedFigure(lots: readonly DerivedLot[], mergerShare: (l: DerivedLot) => number | null, prov: Provenance): SideFigure {
  const f: SideFigure = { lots: lots.length, realised: present(0, 'inr', prov), realisedKnown: 0, lotsUnknown: 0, nonTaxableLeftOut: 0, saleValue: 0, st: 0, lt: 0, unknownTerm: 0 };
  for (const l of lots) {
    const share = mergerShare(l);
    if (share !== null) {
      f.nonTaxableLeftOut++;
      if (share === 0) continue;
    }
    const r = num(l.realised);
    if (r === null || l.gap !== null) { f.lotsUnknown++; continue; }
    const c = r * (share ?? 1);
    f.realisedKnown += c;
    if (share === null) f.saleValue += num(l.saleValue) ?? 0;
    if (l.term.kind === 'value') { if (l.term.v === 'long') f.lt += c; else f.st += c; } else f.unknownTerm += c;
  }
  f.realised = partialTotal(f.realisedKnown, f.lots, f.lotsUnknown, prov, 'derived lot is not computed (a gap in the IRR file)', 'derived lots are not computed (a gap in the IRR file)');
  return f;
}

function partialTotal(known: number, lots: number, unknown: number, prov: Provenance, one: string, many: string): Value<number> {
  if (unknown === 0) return present(known, 'inr', prov);
  const why = `${unknown} ${unknown === 1 ? one : many}, left out`;
  if (unknown >= lots) return missing(STATUS.NOT_AVAILABLE, why, prov);
  return present(known, 'inr', { ...prov, method: `${prov.method}; PARTIAL: ${why}` }, { coverage: Math.min(1 - unknown / lots, 1 - 1e-9) });
}

/** Reconciles the statement's realised gains with those derived from the IRR file, per scheme and financial year. */
export function reconcileRealised(derived: DerivedRealised, statement: StatementSide): RealisedReconciliation {
  const { imp, realised } = statement;
  const insufficient = new Set(imp.insufficientYears);
  const irrClients = [...new Map(derived.instruments.map((x) => [x.clientId, { clientId: x.clientId, clientLabel: x.clientLabel }])).values()];
  const bridge = clientBridge(imp, irrClients);
  const namesOf = new Map<ClientId, string[]>();
  for (const x of derived.instruments) {
    if (x.instrumentName === null) continue;
    const l = namesOf.get(x.clientId) ?? [];
    if (!l.includes(x.instrumentName)) l.push(x.instrumentName);
    namesOf.set(x.clientId, l);
  }
  const cache: TokenCache = new Map();

  // 1. Pairs: a statement (client, scheme) group joined to an IRR instrument, else on its own; then every instrument
  // with derived lots.
  const pairs = new Map<string, Pair>();
  const counted = realised.gains.filter((g) => !g.excludedAsRepeat);
  const matchMemo = new Map<string, string | null>();
  for (const g of counted) {
    const irrClient = bridge(g.clientId);
    const memoKey = keyOf([g.clientId, schemeKeyOf(g.schemeLabel)]);
    let instKey = matchMemo.get(memoKey);
    let instName: string | null = null;
    if (instKey === undefined) {
      const names = irrClient !== null ? namesOf.get(irrClient) ?? [] : [];
      const hit = names.length ? matchInstrument(g.schemeLabel, '', names, cache) : null;
      instKey = hit !== null && irrClient !== null ? derivedInstrumentKey(irrClient, hit) : null;
      matchMemo.set(memoKey, instKey);
    }
    if (instKey !== null) instName = derived.instruments.find((x) => x.instrumentKey === instKey)?.instrumentName ?? null;
    const pk = instKey ?? `statement\u001f${memoKey}`;
    let p = pairs.get(pk);
    if (!p) {
      p = { clientId: irrClient ?? g.clientId, instrumentKey: instKey, instrumentName: instName, schemeLabels: [], stmt: [], derived: [] };
      pairs.set(pk, p);
    }
    if (!p.schemeLabels.includes(g.schemeLabel)) p.schemeLabels.push(g.schemeLabel);
    p.stmt.push(g);
  }
  for (const l of derived.lots) {
    let p = pairs.get(l.instrumentKey);
    if (!p) {
      p = { clientId: l.clientId, instrumentKey: l.instrumentKey, instrumentName: l.instrumentName, schemeLabels: [], stmt: [], derived: [] };
      pairs.set(l.instrumentKey, p);
    }
    p.derived.push(l);
  }

  // 2. Rows per pair and financial year.
  const rows: ReconcileRow[] = [];
  const statementOnly: OneSideScheme[] = [];
  const irrOnly: OneSideScheme[] = [];
  const sProv: Provenance = { sources: [imp.sourceId], method: "the statement's realised gains counted in the year's total, summed per scheme (design section 4)" };
  // The non-taxable merger days of each client, by the pair they belong to (for mergerSuccessorLots).
  const clientMergers: Array<{ clientId: ClientId | null; day: number; pair: Pair }> = [];
  for (const p of pairs.values()) for (const g of p.stmt) if (g.lotClass === 'non-taxable-transfer') clientMergers.push({ clientId: p.clientId, day: g.saleDate, pair: p });
  for (const p of pairs.values()) {
    // The non-taxable merger days of the pair's statement lots, with the share kept.
    const mergerDays = new Map<number, number>();
    for (const g of p.stmt) if (g.lotClass === 'non-taxable-transfer') mergerDays.set(g.saleDate, keptShareOf(g, realised.events));
    const mergerShare = (l: DerivedLot): number | null => (mergerDays.has(l.saleDate) ? mergerDays.get(l.saleDate)! : null);
    // Round 2c (MOD-05's merger condition): where the statement shows the merger, a 'merger-candidate' gap lot stands for
    // the lots of the ordinary-switch reading it keeps, so the merger handling below is exactly as before round 2c.
    // Elsewhere it stays a gap. "Shows the merger": for the switch out, a non-taxable transfer of this scheme on its day;
    // for a sale of the scheme switched into, a non-taxable transfer of the candidate's own scheme A (its pair, by the
    // key the marker carries, financial review V3; every source of a many-into-one merger, Gate B of 4001f8f B1) on the
    // switch-in day, and the statement holds this scheme's lots in the sale's year (V4: otherwise nothing in the statement
    // checks the ordinary-switch cost, which a merger contradicts).
    const shown = (l: DerivedLot): boolean => {
      const c = l.mergerCandidate;
      if (!c || !l.asSwitch) return false;
      if (c.role === 'switch-out') return mergerDays.has(l.saleDate);
      const sourceShows = (key: string): boolean => {
        const ap = pairs.get(key);
        return ap !== undefined && ap !== p && ap.stmt.some((g) => g.lotClass === 'non-taxable-transfer' && g.saleDate === c.day);
      };
      return c.partnerKeys.length > 0 && c.partnerKeys.every(sourceShows) && p.stmt.some((g) => g.financialYear === l.financialYear);
    };
    const derivedLots = p.derived.flatMap((l) => (shown(l) ? l.asSwitch! : [l]));
    const years = [...new Set([...p.stmt.map((g) => g.financialYear), ...derivedLots.map((l) => l.financialYear)])].sort((a, b) => a - b);
    for (const fy of years) {
      const fyLabel = fyLabelOf(fy);
      const sl = p.stmt.filter((g) => g.financialYear === fy);
      const dl = derivedLots.filter((l) => l.financialYear === fy);
      const dProv: Provenance = { sources: [...new Set(dl.map((l) => l.at.sourceId))], method: 'realised gains derived from transactions, summed per scheme (architecture section 6.7)' };
      const s = sl.length ? statementFigure(sl, sProv) : null;
      const d = dl.length ? derivedFigure(dl, mergerShare, dProv) : null;
      const row: ReconcileRow = {
        clientId: p.clientId, fy, fyLabel, schemeLabels: [...p.schemeLabels], instrumentName: p.instrumentName, instrumentKey: p.instrumentKey,
        statement: s, derived: d, difference: null, tolerance: null, outcome: 'reconciled', reason: null,
        mergerSuccessorLots: dl.filter((l) => l.buyKind !== null && l.purchaseDate.kind === 'value' && clientMergers.some((m) => m.pair !== p
          && m.clientId === p.clientId && m.day === (l.purchaseDate as { v: number }).v)).length,
      };
      if (s !== null && insufficient.has(fyLabel)) row.outcome = 'insufficient-evidence';
      else if (s === null) row.outcome = 'irr-only';
      else if (d === null) row.outcome = 'statement-only';
      else if (s.lotsUnknown > 0) { row.outcome = 'not-reconciled'; row.reason = 'statement-gain-unknown'; }
      else if (d.lotsUnknown > 0) { row.outcome = 'not-reconciled'; row.reason = 'derived-gaps'; }
      else {
        const rowsInStatement = sl.length;
        // F1 (Gate B of 5c9ae0a): the difference of the two sides' sums, each rounded to whole paise, compared with the
        // tolerance in exact terms (`withinTolerance`), so a difference exactly at the tolerance reconciles.
        row.difference = paiseDifference(s.realisedKnown, d.realisedKnown);
        row.tolerance = reconcileTolerance(s.saleValue, d.saleValue, rowsInStatement);
        row.outcome = withinTolerance(row.difference, row.tolerance) ? 'reconciled' : 'differs';
      }
      rows.push(row);
    }
    if (p.stmt.length && !derivedLots.length) {
      statementOnly.push({ clientId: p.clientId, schemeLabels: [...p.schemeLabels], instrumentName: p.instrumentName, years: [...new Set(p.stmt.map((g) => g.financialYearLabel))] });
    }
    if (!p.stmt.length && derivedLots.length) {
      irrOnly.push({ clientId: p.clientId, schemeLabels: [], instrumentName: p.instrumentName, years: [...new Set(derivedLots.map((l) => l.financialYearLabel))] });
    }
  }
  rows.sort((a, b) => a.fy - b.fy || String(a.clientId).localeCompare(String(b.clientId))
    || normaliseLabel(a.instrumentName ?? a.schemeLabels[0] ?? '').localeCompare(normaliseLabel(b.instrumentName ?? b.schemeLabels[0] ?? '')));

  const counts: Record<ReconcileOutcome, number> = { reconciled: 0, differs: 0, 'insufficient-evidence': 0, 'not-reconciled': 0, 'statement-only': 0, 'irr-only': 0 };
  for (const r of rows) counts[r.outcome]++;
  return { rows, statementOnly, irrOnly, counts, toleranceRule: TOLERANCE_RULE, issues: reconcileIssues(rows, statementOnly, irrOnly, imp) };
}

function reconcileIssues(rows: readonly ReconcileRow[], statementOnly: readonly OneSideScheme[], irrOnly: readonly OneSideScheme[], imp: CgImport): ValidationResult[] {
  const out: ValidationResult[] = [];
  const add = (rule: string, severity: ValidationResult['severity'], message: string, count: number): void => {
    out.push({
      id: `tax.${rule}:${out.length + 1}`, ruleId: `tax.${rule}`, scope: { kind: 'file', sourceId: imp.sourceId }, message, severity,
      blocksPublication: false, resolution: 'none', status: 'open', decision: 'E-141', count,
    });
  };
  const yearsOf = (rs: readonly ReconcileRow[]): string[] => [...new Map(rs.map((r) => [r.fy, r.fyLabel])).entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const schemesOf = (rs: readonly ReconcileRow[]): number => new Set(rs.map((r) => r.instrumentKey ?? keyOf([r.clientId, ...r.schemeLabels]))).size;
  const differs = rows.filter((r) => r.outcome === 'differs');
  if (differs.length) {
    const succ = differs.filter((r) => r.mergerSuccessorLots > 0).length;
    const succText = succ ? ` ${plural(succ, 'of them sells', 'of them sell')} units the IRR file shows switched in on the day of a non-taxable merger, at the merger value, where the statement carries the original cost.` : '';
    add('realised-differs', 'High',
      `The realised gains of the capital-gains statement and those derived from the IRR file differ beyond the tolerance for ${plural(schemesOf(differs), 'scheme', 'schemes')} in ${listText(yearsOf(differs))} (${plural(differs.length, 'scheme-year', 'scheme-years')}). Both figures are shown; the statement is the source of record.${succText}`,
      differs.length);
  }
  const ok = rows.filter((r) => r.outcome === 'reconciled');
  if (ok.length) {
    add('realised-reconciled', 'Information',
      `The realised gains of the capital-gains statement and those derived from the IRR file agree within the tolerance for ${plural(ok.length, 'scheme-year', 'scheme-years')} in ${listText(yearsOf(ok))}.`, ok.length);
  }
  const ie = rows.filter((r) => r.outcome === 'insufficient-evidence');
  const nr = rows.filter((r) => r.outcome === 'not-reconciled');
  if (ie.length || nr.length) {
    const parts: string[] = [];
    if (ie.length) parts.push(`${plural(ie.length, 'scheme-year', 'scheme-years')} of ${listText(yearsOf(ie))}, INSUFFICIENT EVIDENCE in the statement until its repeated rows are answered`);
    const sg = nr.filter((r) => r.reason === 'statement-gain-unknown');
    const dg = nr.filter((r) => r.reason === 'derived-gaps');
    if (sg.length) parts.push(`${plural(sg.length, 'scheme-year', 'scheme-years')} with a statement lot whose gain is unknown`);
    if (dg.length) parts.push(`${plural(dg.length, 'scheme-year', 'scheme-years')} with a derived lot not computed`);
    add('realised-not-reconciled', 'Warning', `Realised gains not reconciled with the IRR file: ${parts.join('; ')}.`, ie.length + nr.length);
  }
  const so = rows.filter((r) => r.outcome === 'statement-only').length;
  const io = rows.filter((r) => r.outcome === 'irr-only').length;
  if (so || io) {
    add('realised-one-side', 'Information',
      `Realised gains on one side only: ${plural(statementOnly.length, 'scheme', 'schemes')} only in the capital-gains statement and ${plural(irrOnly.length, 'scheme', 'schemes')} only in the IRR file; ${plural(so, 'scheme-year', 'scheme-years')} only in the statement and ${plural(io, 'scheme-year', 'scheme-years')} only in the IRR file.`,
      so + io);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The review's figure: tax.realisedFY.{st,lt,source}

export const FAMILY_SUM_LABEL = 'sum of separate computations';
/** The family figure that mixes the statement and the derived source across clients (the contract's GainSource, C4-5). */
export const MIXED_SOURCE: Extract<GainSource, 'mixed'> = 'mixed';

export type RealisedFigure = { st: Value<number>; lt: Value<number>; unknownTerm: Value<number>; total: Value<number> };

/**
 * One client's realised figure of a year: the contract's RealisedForYear (C4-5) with its client, and the lots counted.
 * `schemesLeftOut` (item 8 of Gate B of aa67a45): on a statement figure, the IRR schemes of the client with gains derived
 * in the year that no statement lot of the year matches (the statement covers only part of the client-year). Their
 * derived gains are not added (never the two sides in one client-year); the figure is PARTIAL instead. The rule is an
 * owner question. 0 on a derived figure.
 */
export type RealisedFYClient = RealisedForYear & {
  clientId: ClientId;
  source: Exclude<GainSource, 'mixed'>;
  lots: number;
};

/** The PARTIAL text of a statement figure that leaves out `n` IRR schemes with derived gains in the year (item 8). */
export function partialStatementReason(n: number): string {
  return `${plural(n, 'scheme', 'schemes')} with gains derived from the IRR file in this year ${n === 1 ? 'is' : 'are'} not in the capital-gains statement, left out (the statement covers part of the client-year; owner question)`;
}

export type OutsideReviewClient = { clientId: ClientId; clientLabel: string; lots: number };

/**
 * The family's realised figure of a year: the contract's RealisedForYear (C4-5) with `clientId` null, and the lines it
 * does not hold. `source` is one source when every client's figure has it, MIXED_SOURCE ('mixed') when they differ (each
 * client's own is in `clients`), and null only when no client has a figure in the year (`total` then missing).
 * `schemesLeftOut` is the clients' sum.
 */
export type RealisedFY = RealisedForYear & {
  clientId: null;
  fyLabel: string;
  clients: RealisedFYClient[];
  label: typeof FAMILY_SUM_LABEL;
  /**
   * IRR clients with derived lots in the year and no holding in the base file (OD-4, R2 S-5): left out of every figure
   * above and listed here with their count. Empty when the derivation was given no base-file holdings.
   */
  outsideReview: { count: number; clients: OutsideReviewClient[]; reason: string };
};

export const OUTSIDE_REVIEW_REASON = 'clients of the IRR file with no holding in the base file are left out of the family\'s realised figure (OD-4); owner question Q-4';

function figureOf(parts: ReadonlyArray<{ st: number; lt: number; unk: number }>, lots: number, unknownLots: number, prov: Provenance, ie: boolean): RealisedFigure {
  if (ie) {
    const m = missing(STATUS.INSUFFICIENT_EVIDENCE, 'the statement holds an unanswered repeat event in this year (design section 6)', prov);
    return { st: m, lt: m, unknownTerm: m, total: m };
  }
  const st = parts.reduce((s, x) => s + x.st, 0);
  const lt = parts.reduce((s, x) => s + x.lt, 0);
  const unk = parts.reduce((s, x) => s + x.unk, 0);
  const one = (v: number): Value<number> => partialTotal(v, lots, unknownLots, prov, 'lot has an unknown gain, left out of the figure', 'lots have an unknown gain, left out of the figure');
  // M7b financial review F-4: with a counted gain of unknown term, the long and short figures are not known (never 0 or a
  // part shown as the whole); the total and the unknown-term figure stand.
  const termUnknown = parts.filter((x) => x.unk !== 0).length;
  const split = (v: number): Value<number> => (termUnknown > 0
    ? missing(STATUS.NOT_AVAILABLE, `the term of ${plural(termUnknown, 'counted lot is', 'counted lots are')} not known, so the gain is not split into long and short term (the total stands)`, prov)
    : one(v));
  return { st: split(st), lt: split(lt), unknownTerm: one(unk), total: one(st + lt + unk) };
}

function sumValues(vs: readonly Value<number>[], prov: Provenance): Value<number> {
  if (!vs.length) return present(0, 'inr', prov);
  const ie = vs.find((v) => v.kind === 'missing' && v.status === STATUS.INSUFFICIENT_EVIDENCE);
  if (ie) return missing(STATUS.INSUFFICIENT_EVIDENCE, 'a client year is INSUFFICIENT EVIDENCE', prov);
  const present_ = vs.filter((v): v is Extract<Value<number>, { kind: 'value' }> => v.kind === 'value');
  if (!present_.length) return missing(STATUS.NOT_AVAILABLE, 'no client figure is known', prov);
  const total = present_.reduce((s, v) => s + v.v, 0);
  const partial = present_.length < vs.length || present_.some((v) => v.coverage !== undefined && v.coverage < 1);
  if (!partial) return present(total, 'inr', prov);
  const cov = Math.min(...present_.map((v) => v.coverage ?? 1), present_.length < vs.length ? present_.length / vs.length : 1);
  return present(total, 'inr', { ...prov, method: `${prov.method}; PARTIAL: a client figure is missing or partial` }, { coverage: Math.min(cov, 1 - 1e-9) });
}

/**
 * The realised gains of a financial year for the review (`tax.realisedFY`): per client, the statement where it covers
 * the client's year, else the derived figure; the family figure their sum. Either side may be absent.
 */
export function realisedForYear(fy: number, derived: DerivedRealised | null, statement: StatementSide | null): RealisedFY {
  const fyLabel = fyLabelOf(fy);
  const irrClients = derived ? [...new Map(derived.instruments.map((x) => [x.clientId, { clientId: x.clientId, clientLabel: x.clientLabel }])).values()] : [];
  const bridge = statement ? clientBridge(statement.imp, irrClients) : (): null => null;
  const ie = statement ? new Set(statement.imp.insufficientYears).has(fyLabel) : false;

  // The statement's lots of review clients in the year, by client (the IRR client when joined).
  const stmtBy = new Map<ClientId, TaxLot[]>();
  for (const g of statement?.realised.gains ?? []) {
    if (g.financialYear !== fy || !g.inReview || g.clientId === null) continue;
    const c = bridge(g.clientId) ?? g.clientId;
    const l = stmtBy.get(c) ?? [];
    l.push(g);
    stmtBy.set(c, l);
  }
  const derBy = new Map<ClientId, DerivedLot[]>();
  // OD-4 (R2 S-5): an IRR client with no holding in the base file is outside the review, as on the statement side.
  const inBase = derived?.baseClients ? new Set(derived.baseClients) : null;
  const outside = new Map<ClientId, OutsideReviewClient>();
  for (const l of derived?.lots ?? []) {
    if (l.financialYear !== fy || l.clientId === null) continue;
    if (inBase !== null && !inBase.has(l.clientId)) {
      const o = outside.get(l.clientId) ?? { clientId: l.clientId, clientLabel: l.clientLabel, lots: 0 };
      o.lots++;
      outside.set(l.clientId, o);
      continue;
    }
    const x = derBy.get(l.clientId) ?? [];
    x.push(l);
    derBy.set(l.clientId, x);
  }
  const namesOf = new Map<ClientId, string[]>();
  for (const x of derived?.instruments ?? []) {
    if (x.instrumentName === null) continue;
    const l = namesOf.get(x.clientId) ?? [];
    if (!l.includes(x.instrumentName)) l.push(x.instrumentName);
    namesOf.set(x.clientId, l);
  }
  const cache: TokenCache = new Map();
  const clients: RealisedFYClient[] = [];
  for (const c of [...new Set([...stmtBy.keys(), ...derBy.keys()])].sort()) {
    const sl = stmtBy.get(c);
    if (sl) {
      const used = sl.filter((g) => !g.excludedAsRepeat);
      const prov: Provenance = { sources: [statement!.imp.sourceId], method: 'realised gains from the capital-gains statement (source of record), split by the app\'s term' };
      const parts = used.filter((g) => g.realisedCounted.kind === 'value').map((g) => {
        const v = num(g.realisedCounted)!;
        const t = g.term.kind === 'value' ? g.term.v : null;
        return { st: t === 'short' ? v : 0, lt: t === 'long' ? v : 0, unk: t === null ? v : 0 };
      });
      const unknown = used.length - parts.length;
      // Item 8 (Gate B of aa67a45): IRR schemes with derived gains in the year that no statement lot of the year matches
      // (the reconciliation's own matcher). Not added; the figure is marked PARTIAL so it never looks complete.
      const names = namesOf.get(c) ?? [];
      const covered = new Set<string>();
      for (const g of sl) {
        const hit = names.length ? matchInstrument(g.schemeLabel, '', names, cache) : null;
        if (hit !== null) covered.add(derivedInstrumentKey(c, hit));
      }
      const leftLotsBy = new Map<string, number>();
      // Delta review N-5: only derived lots that are sales count (a transfer out or a row of amount 0 sells nothing).
      // Round 2c: a merger candidate's gap lot counts as the lots it keeps, so the statement figure stands as before.
      for (const l of (derBy.get(c) ?? []).flatMap((x) => x.asSwitch ?? [x])) if (l.saleRow && !covered.has(l.instrumentKey)) leftLotsBy.set(l.instrumentKey, (leftLotsBy.get(l.instrumentKey) ?? 0) + 1);
      const leftLots = [...leftLotsBy.values()].reduce((s, n) => s + n, 0);
      const fig = figureOf(parts, used.length, unknown, prov, ie);
      const schemesLeftOut = leftLotsBy.size;
      if (schemesLeftOut > 0) {
        const why = partialStatementReason(schemesLeftOut);
        const share = used.length / (used.length + leftLots);
        const mark = (x: Value<number>): Value<number> => (x.kind !== 'value' ? x
          : present(x.v, 'inr', { ...x.prov, method: `${x.prov.method}; PARTIAL: ${why}` }, { coverage: Math.min(x.coverage ?? 1, share, 1 - 1e-9) }));
        fig.st = mark(fig.st); fig.lt = mark(fig.lt); fig.unknownTerm = mark(fig.unknownTerm); fig.total = mark(fig.total);
      }
      clients.push({ fy, clientId: c, source: 'statement', lots: used.length, schemesLeftOut, ...fig });
    } else {
      const dl = derBy.get(c)!;
      const prov: Provenance = { sources: [...new Set(dl.map((l) => l.at.sourceId))], method: 'realised gains derived from transactions (FIFO on the IRR file), split by the term of table v1 at the sale date' };
      const parts = dl.filter((l) => l.gap === null).map((l) => {
        const v = num(l.realised)!;
        const t = l.term.kind === 'value' ? l.term.v : null;
        return { st: t === 'short' ? v : 0, lt: t === 'long' ? v : 0, unk: t === null ? v : 0 };
      });
      clients.push({ fy, clientId: c, source: DERIVED_SOURCE, lots: dl.length, schemesLeftOut: 0, ...figureOf(parts, dl.length, dl.length - parts.length, prov, false) });
    }
  }
  const sources = [...new Set(clients.map((c) => c.source))];
  const outsideList = [...outside.values()].sort((a, b) => (a.clientId < b.clientId ? -1 : a.clientId > b.clientId ? 1 : 0));
  const outNote = outsideList.length ? `; ${plural(outsideList.length, 'client', 'clients')} of the IRR file with no holding in the base file left out (OD-4)` : '';
  const prov: Provenance = { sources: [...new Set(clients.flatMap((c) => (c.total.kind === 'value' ? c.total.prov.sources : c.total.prov?.sources ?? [])))], method: `family view: the clients' realised gains added up (${FAMILY_SUM_LABEL})${outNote}` };
  // contracts-4 (C4-5, delta 2 B-4): with no client entry in the year the source is null and the figures are missing
  // (no client of the review has a realised figure), never a sum of nothing (Rs 0; Q-49).
  const none = clients.length === 0 ? missing(STATUS.NOT_AVAILABLE, `no client of the review has a realised figure in this year${outNote}`, prov) : null;
  return {
    fy, clientId: null, fyLabel, source: sources.length === 0 ? null : sources.length === 1 ? sources[0]! : MIXED_SOURCE, clients, label: FAMILY_SUM_LABEL,
    schemesLeftOut: clients.reduce((s, c) => s + c.schemesLeftOut, 0),
    outsideReview: { count: outsideList.length, clients: outsideList, reason: OUTSIDE_REVIEW_REASON },
    st: none ?? sumValues(clients.map((c) => c.st), prov), lt: none ?? sumValues(clients.map((c) => c.lt), prov),
    unknownTerm: none ?? sumValues(clients.map((c) => c.unknownTerm), prov), total: none ?? sumValues(clients.map((c) => c.total), prov),
  };
}
