// The evidence check on units for repeated sale events (design docs/new-build/capital-gains-upload.md §6; the owner's
// addition to PD-16 item 5, 26 Nov 2026: "Repeating lot rows - this issue can be clarified against the total number of
// units from the holding report"; PLAN-03 addendum, sprint S2b).
//
// For each repeated sale event of the statement (CgImport.events) it compares the units of the event's two readings
// with what the other two files show:
//   - Evidence 1, the transactions file: the IRR redemptions of the same client, scheme and folio on the sale date;
//   - Evidence 2, the holding report: units bought in the transactions file up to the as-on date, less units sold,
//     against the units the base file holds.
// It suggests a reading only when every available piece of evidence supports the same one, and says why when there is
// no evidence or the evidence disagrees. A suggestion is never an answer: the reader's question
// (`capital-gains-repeats`) and the year's INSUFFICIENT EVIDENCE stay until the analyst answers; this module reads the
// import record and changes nothing in it.
//
// It runs at review time, because it needs the base file and the transactions file, which the reader never sees.
// Pure: no globals, no clock, no I/O. Texts carry units and dates only: never a folio, an amount or a PAN.

import type { CgImport, CgLot, CgRepeatEvent } from '../../ingest/capital-gains.ts';
import type { IrrFileImport, Transaction, TransactionKind } from '../../model/transactions.ts';
import type { Holding } from '../../model/holding.ts';
import type { ClientId } from '../../model/ids.ts';
import type { DayNumber } from '../../model/value.ts';
import { matchInstrument } from '../match/instrument.ts';
import type { TokenCache } from '../match/instrument.ts';
import { normaliseLabel } from '../ids.ts';
import { formatDay } from '../dates.ts';

/** The two readings of a repeated sale event (design §6): each distinct row counted once, or every row as stated. */
export type RepeatReading = 'once' | 'as-stated';

/** What one piece of evidence supports: one reading, neither, or both (when the two readings give the same units). */
export type EvidenceSupport = 'once' | 'as-stated' | 'neither' | 'both';

/** Evidence 1: the units the transactions file shows redeemed on the sale date for the scheme and folio. */
export type RedemptionEvidence = {
  source: 'transactions';
  /** The summed units of the redemptions, |amount| / price per row, unrounded. */
  units: number;
  /** How many transactions-file rows were summed. */
  rows: number;
  /** True when the folio was compared on every row (both files give one); false when the scheme alone matched. */
  byFolio: boolean;
  supports: EvidenceSupport;
};

/** Evidence 2: the units balance of the scheme and folio against the base file's units. */
export type BalanceEvidence = {
  source: 'holding';
  /** Units bought in the transactions file up to the as-on date (the priced purchase-kind rows). */
  bought: number;
  /** Units sold under each reading of this event: the statement's sales of the scheme and folio up to the as-on date,
   * plus the transactions file's redemptions on days with no statement sale of the scheme and folio. */
  sold: { once: number; asStated: number };
  /** bought less sold, under each reading. */
  left: { once: number; asStated: number };
  /** The base file's units of the matched holding (summed over matched holdings). */
  held: number;
  /** True when the folio was compared throughout (both files give one); false when the scheme alone matched. */
  byFolio: boolean;
  supports: EvidenceSupport;
};

export type RepeatUnitsEvidence = RedemptionEvidence | BalanceEvidence;

/** Why a piece of evidence could not be formed. The first four are the addendum's; the others make its rules exact. */
export type NoEvidenceReason =
  | 'no-transactions-file'
  | 'no-matching-redemption'
  | 'no-price-on-redemption'
  | 'no-holding'
  | 'no-holding-units'
  | 'scheme-not-in-transactions'
  | 'no-price-on-purchase'
  | 'unknown-type-rows'
  | 'other-repeats-open'
  | 'sale-after-as-on'
  | 'no-statement-units';

/** The text of each reason, as it appears in "No units evidence for this sale (...)". */
export const NO_EVIDENCE_TEXT: Readonly<Record<NoEvidenceReason, string>> = {
  'no-transactions-file': 'no transactions file',
  'no-matching-redemption': 'no matching redemption in the transactions file',
  'no-price-on-redemption': 'no price on the redemption',
  'no-holding': 'no holding for this scheme and folio',
  'no-holding-units': 'no units for this holding in the base file',
  'scheme-not-in-transactions': 'the scheme is not in the transactions file',
  'no-price-on-purchase': 'no price on a purchase in the transactions file',
  'unknown-type-rows': 'rows of an unknown type in the transactions file',
  'other-repeats-open': 'another repeated sale of this scheme is not yet answered',
  'sale-after-as-on': 'the sale is after the as-on date',
  'no-statement-units': 'the statement\'s rows do not all give units',
};

export type RepeatEvidence = {
  /** The reader's sale event (CgRepeatEvent.id), the key of its `capital-gains-repeats` question. */
  eventId: string;
  /** Units of the event under each reading; null when a row of the event gives no units. */
  readings: { once: number | null; asStated: number | null };
  /** The evidence formed, Evidence 1 first. */
  evidence: RepeatUnitsEvidence[];
  /** Why a piece of evidence was not formed, in the order transactions file, holding report. */
  missing: Array<{ source: 'transactions' | 'holding' | 'statement'; reason: NoEvidenceReason }>;
  /** The reading every piece of evidence supports; null without evidence, or when it matches neither or disagrees. */
  suggested: RepeatReading | null;
  /** The text shown beside the reader's question: units and dates only, never a folio, an amount or a PAN. */
  text: string;
};

/** The redemption kinds of Evidence 1 (and the sales of Evidence 2). */
export const REDEMPTION_KINDS: ReadonlySet<TransactionKind> = new Set<TransactionKind>(['redemption', 'swp', 'switch-out', 'stp-out', 'transfer-out']);
/** The purchase kinds of Evidence 2 (units in). */
export const PURCHASE_KINDS: ReadonlySet<TransactionKind> = new Set<TransactionKind>([
  'purchase', 'sip', 'top-up', 'switch-in', 'stp-in', 'transfer-in', 'stock-in', 'bonus', 'demerger-in',
]);
const UNKNOWN_KINDS: ReadonlySet<TransactionKind> = new Set<TransactionKind>(['untyped', 'unrecognised']);

/** Units rounded to 3 decimals, half away from zero (the addendum's units equality). */
export function roundUnits(x: number): number {
  const scaled = Number((Math.abs(x) * 1000).toPrecision(15));
  const r = Math.round(scaled) / 1000;
  return x < 0 ? -r : r;
}

/** True when two unit figures are equal to 3 decimals: a difference of at most 0.0005 units. */
export function unitsEqual(a: number, b: number): boolean {
  return roundUnits(a) === roundUnits(b);
}

const fmtUnits = (x: number): string => roundUnits(x).toFixed(3);

/** A folio for comparison: inner spaces removed, upper case. */
export function normaliseFolio(f: string | null | undefined): string | null {
  if (f === null || f === undefined) return null;
  const t = f.replace(/\s+/g, '').toUpperCase();
  return t === '' ? null : t;
}

function supportOf(x: number, once: number, asStated: number): EvidenceSupport {
  const a = unitsEqual(x, once);
  const b = unitsEqual(x, asStated);
  return a && b ? 'both' : a ? 'once' : b ? 'as-stated' : 'neither';
}

/** The units of a priced transactions-file row (|amount| / price), or null without a price above 0. */
function unitsOf(t: Transaction): number | null {
  if (t.price.kind !== 'value' || !(t.price.v > 0)) return null;
  return Math.abs(t.amountRupees) / t.price.v;
}

/** The units of an event's lots under a reading, or null when a lot has no units. */
function eventUnits(lots: readonly CgLot[], reading: RepeatReading): number | null {
  let sum = 0;
  for (const l of lots) {
    if (reading === 'once' && l.duplicateOf !== null) continue;
    if (l.units.kind !== 'value') return null;
    sum += l.units.v;
  }
  return sum;
}

/**
 * The evidence on units for each repeated sale event of the statement (design §6; PD-16 item 5, the owner's addition
 * of 26 Nov 2026). `irr` is the transactions file (null when not loaded), `holdings` the base file's holdings, and
 * `asOnDay` the review's as-on date. The result follows the order of `cg.events`; `cg` is not changed.
 */
export function repeatEvidence(cg: CgImport, irr: IrrFileImport | null, holdings: readonly Holding[], asOnDay: DayNumber): RepeatEvidence[] {
  const cache: TokenCache = new Map();
  const labelOf = new Map<ClientId, string>(cg.persons.map((p) => [p.clientId, p.label]));
  const eventById = new Map<string, CgRepeatEvent>(cg.events.map((e) => [e.id, e]));
  const fund = irr ? irr.fund : [];

  return cg.events.map((ev): RepeatEvidence => {
    const lots = ev.lots.map((i) => cg.lots[i]!);
    const first = lots[0]!;
    const once = eventUnits(lots, 'once');
    const asStated = eventUnits(lots, 'as-stated');
    const out: RepeatEvidence = { eventId: ev.id, readings: { once, asStated }, evidence: [], missing: [], suggested: null, text: '' };
    if (once === null || asStated === null) {
      out.missing.push({ source: 'statement', reason: 'no-statement-units' });
      out.text = textOf(out, first.saleDate);
      return out;
    }

    // The client, scheme and folio of the event.
    const label = (first.clientId !== null ? labelOf.get(first.clientId) : undefined) ?? first.accountLabel;
    const sameClient = (id: ClientId | null, l: string | null): boolean =>
      (first.clientId !== null && id === first.clientId) || (label !== null && l !== null && normaliseLabel(l) === normaliseLabel(label));
    const lotFolio = normaliseFolio(first.folio);
    const folioOk = (f: string | null): boolean => lotFolio === null || normaliseFolio(f) === null || normaliseFolio(f) === lotFolio;
    const folioCompared = (f: string | null): boolean => lotFolio !== null && normaliseFolio(f) !== null;

    // The transactions-file rows of the scheme and folio (the matcher on the statement's scheme label, D9).
    let scope: Transaction[] = [];
    let schemeHit: string | null = null;
    if (irr) {
      const clientRows = fund.filter((t) => sameClient(t.clientId, t.clientLabel));
      const names = [...new Set(clientRows.map((t) => t.instrumentName).filter((n): n is string => n !== null))];
      schemeHit = names.length ? matchInstrument(first.schemeLabel, '', names, cache) : null;
      if (schemeHit !== null) scope = clientRows.filter((t) => t.instrumentName === schemeHit && folioOk(t.folio));
    }

    // Evidence 1: the redemptions on the sale date.
    if (!irr) {
      out.missing.push({ source: 'transactions', reason: 'no-transactions-file' });
    } else {
      const rows = scope.filter((t) => REDEMPTION_KINDS.has(t.kind) && t.day === first.saleDate);
      if (rows.length === 0) {
        out.missing.push({ source: 'transactions', reason: 'no-matching-redemption' });
      } else {
        const units = rows.map(unitsOf);
        if (units.some((u) => u === null)) {
          out.missing.push({ source: 'transactions', reason: 'no-price-on-redemption' });
        } else {
          const sum = units.reduce((s: number, u) => s + (u ?? 0), 0);
          out.evidence.push({ source: 'transactions', units: sum, rows: rows.length, byFolio: rows.every((t) => folioCompared(t.folio)), supports: supportOf(sum, once, asStated) });
        }
      }
    }

    // Evidence 2: the units balance against the base file (needs both files).
    const balance = ((): BalanceEvidence | NoEvidenceReason => {
      if (!irr) return 'no-transactions-file';
      const clientHoldings = holdings.filter((h) => sameClient(h.clientId, h.clientLabel));
      const hNames = [...new Set(clientHoldings.map((h) => h.instrumentName))];
      const hHit = hNames.length ? matchInstrument(first.schemeLabel, '', hNames, cache) : null;
      const matched = hHit === null ? [] : clientHoldings.filter((h) =>
        h.instrumentName === hHit && (lotFolio === null || h.folios.length === 0 || h.folios.some((f) => normaliseFolio(f) === lotFolio)));
      if (matched.length === 0) return 'no-holding';
      let held = 0;
      for (const h of matched) {
        if (h.units.kind !== 'value') return 'no-holding-units';
        held += h.units.v;
      }
      if (first.saleDate > asOnDay) return 'sale-after-as-on';
      if (schemeHit === null) return 'scheme-not-in-transactions';
      const upTo = scope.filter((t) => t.day <= asOnDay);
      if (upTo.some((t) => UNKNOWN_KINDS.has(t.kind))) return 'unknown-type-rows';
      let bought = 0;
      for (const t of upTo.filter((x) => PURCHASE_KINDS.has(x.kind))) {
        const u = unitsOf(t);
        if (u === null) return 'no-price-on-purchase';
        bought += u;
      }
      // The statement's sales of the scheme and folio up to the as-on date. This event counts under each reading; any
      // other repeated event counts as its analyst answered it, and an unanswered one leaves no balance.
      const schemeKey = normaliseLabel(first.schemeLabel);
      const sameScope = (l: CgLot): boolean => l.clientId === first.clientId && normaliseLabel(l.schemeLabel) === schemeKey
        && normaliseFolio(l.folio) === lotFolio && l.saleDate <= asOnDay;
      const stmt = cg.lots.filter(sameScope);
      let others = 0;
      for (const l of stmt) {
        if (l.eventId === ev.id) continue;
        const e = eventById.get(l.eventId);
        if (e && e.answer === null) return 'other-repeats-open';
        if (l.excludedAsRepeat) continue;
        if (l.units.kind !== 'value') return 'no-statement-units';
        others += l.units.v;
      }
      // The transactions file's redemptions on days with no statement sale of the scheme and folio.
      const saleDays = new Set(stmt.map((l) => l.saleDate));
      let unmatched = 0;
      for (const t of upTo.filter((x) => REDEMPTION_KINDS.has(x.kind) && !saleDays.has(x.day))) {
        const u = unitsOf(t);
        if (u === null) return 'no-price-on-redemption';
        unmatched += u;
      }
      const sold = { once: once + others + unmatched, asStated: asStated + others + unmatched };
      const left = { once: bought - sold.once, asStated: bought - sold.asStated };
      const a = unitsEqual(left.once, held);
      const b = unitsEqual(left.asStated, held);
      const supports: EvidenceSupport = a && b ? 'both' : a ? 'once' : b ? 'as-stated' : 'neither';
      const byFolio = lotFolio !== null && matched.every((h) => h.folios.length > 0) && upTo.every((t) => folioCompared(t.folio));
      return { source: 'holding', bought, sold, left, held, byFolio, supports };
    })();
    if (typeof balance === 'string') out.missing.push({ source: 'holding', reason: balance });
    else out.evidence.push(balance);

    const s = out.evidence.map((e) => e.supports);
    if (s.length > 0 && s.every((x) => x === s[0]) && (s[0] === 'once' || s[0] === 'as-stated')) out.suggested = s[0];
    out.text = textOf(out, first.saleDate);
    return out;
  });
}

const readingWords = (r: RepeatReading): string => (r === 'once' ? 'once' : 'as stated');

function detailOf(e: RepeatUnitsEvidence, r: RepeatEvidence, saleDate: DayNumber): string {
  if (e.source === 'transactions') {
    const scheme = e.byFolio ? 'for this scheme' : 'for this scheme (matched on the scheme alone, without a folio)';
    return `The transactions file shows ${fmtUnits(e.units)} units redeemed on ${formatDay(saleDate)} ${scheme}. `
      + `The statement's rows give ${fmtUnits(r.readings.once ?? 0)} units counted once and ${fmtUnits(r.readings.asStated ?? 0)} as stated.`;
  }
  if (e.supports === 'once' || e.supports === 'as-stated') {
    return `Units bought less units sold leave ${fmtUnits(e.supports === 'once' ? e.left.once : e.left.asStated)} units, matching the ${fmtUnits(e.held)} units held in the base file, when the rows are counted ${readingWords(e.supports)}.`;
  }
  return `Units bought less units sold leave ${fmtUnits(e.left.once)} units when the rows are counted once and ${fmtUnits(e.left.asStated)} as stated, against the ${fmtUnits(e.held)} units held in the base file.`;
}

function phraseOf(s: EvidenceSupport): string {
  if (s === 'once') return 'supports counting once';
  if (s === 'as-stated') return 'supports as stated';
  if (s === 'both') return 'fits both readings';
  return 'matches neither reading';
}

/** The text shown beside the reader's question (the addendum's four forms). */
function textOf(r: RepeatEvidence, saleDate: DayNumber): string {
  if (r.evidence.length === 0) {
    const reasons = [...new Set(r.missing.map((m) => NO_EVIDENCE_TEXT[m.reason]))];
    return `No units evidence for this sale (${reasons.join('; ')}). Please decide: the rows can be genuine lots.`;
  }
  const details = r.evidence.map((e) => detailOf(e, r, saleDate)).join(' ');
  if (r.suggested !== null) return `${details} Suggested: count ${readingWords(r.suggested)}. Please confirm.`;
  const s = r.evidence.map((e) => e.supports);
  if (s.every((x) => x === s[0])) {
    return `The evidence ${phraseOf(s[0]!)}. ${details} Please decide: the rows can be genuine lots.`;
  }
  const parts = r.evidence.map((e) => `${e.source === 'transactions' ? 'the transactions file' : 'the holding balance'} ${phraseOf(e.supports)}`);
  return `The evidence does not agree: ${parts.join('; ')}. ${details} Please decide.`;
}
