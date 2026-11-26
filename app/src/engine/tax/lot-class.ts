// Lot classes, merger events and successor lots of a capital-gains statement (NB-M7a S2, parity row E-152; design
// docs/new-build/capital-gains-upload.md §5, §10.4, TR-5, TR-11, LD-8, LD-25, LD-37).
//
// Each lot gets exactly one class, in the design's order: non-taxable-transfer, taxable-transfer (the merger pattern
// and its event's answer or date gate), grandfathered, indexed-cost-shown, standard, other. The class only supplies
// inputs; the rule's cost basis governs (realised.ts). It is worked out again whenever the scheme's class changes,
// because the grandfathered and indexed-cost-shown classes depend on it.
//
// Merger events: the merger-pattern rows of one sale event (the reader's eventId). Until the analyst answers, an event
// dated from 2015-04-01 is non-taxable (from 2016-04-01 on either reading; 2015-04-01 to 2016-03-31 on the
// scheme-consolidation reading) and an earlier event taxable (merger-taxable). A non-taxable answer is offered only
// when the gate holds (from 2015-04-01); before it the answer is refused, with the reason named.
//
// Successor lots: after a non-taxable event, a lot of the same account in another scheme label whose purchase date is
// the event date (successor-reset). After a taxable event, a lot of the same account in another scheme label whose
// purchase date is before the event date and equals a purchase date of the event's merger rows, sold after the event
// date (successor-not-reset), with the re-base cost S x V / W and the amount counted twice (S - W) x V / W.

import type { CgLot, CgRead } from '../../ingest/capital-gains.ts';
import type { DayNumber } from '../../model/value.ts';
import { ymdToDay } from '../dates.ts';
import type { TaxRuleTable } from './rules.ts';
import { financialYearOf } from './rules.ts';
import { schemeInputFor, schemeKeyOf } from './tax-class.ts';
import type {
  LotClass, LotMark, MergerAnswer, MergerEventResult, Refusal, SchemeInput, SuccessorLink, TaxClass,
} from './types.ts';

/** TR-5 (a): a scheme consolidation is not a transfer from this sale date (s.47(xviii); 2025 Act s.70(1)(zj)). */
export const SCHEME_CONSOLIDATION_FROM: DayNumber = ymdToDay(2015, 4, 1)!;
/** TR-5 (b): a plan consolidation within one scheme is not a transfer from this sale date (s.47(xix); s.70(1)(zk)). */
export const PLAN_CONSOLIDATION_FROM: DayNumber = ymdToDay(2016, 4, 1)!;
/** A derived Sale or Purchase Price is compared to Rs 0.01 per unit (§5). */
export const DERIVED_PRICE_TOLERANCE = 0.01;

const val = <T>(r: CgRead<T>): T | null => (r.kind === 'value' ? r.v : null);

/** The 31 Jan 2018 value date (s.55(2)(ac)): the last purchase day of the table's grandfathered rows. */
export function grandfatheringDay(table: TaxRuleTable): DayNumber {
  const days = table.rules.filter((r) => r.costBasis === 'grandfathered').map((r) => r.purchase['equity-oriented']?.to ?? null)
    .filter((d): d is DayNumber => d !== null);
  if (days.length === 0) throw new Error('tax-rules: no grandfathered row');
  return Math.max(...days);
}

function priceEqual(a: number, b: number, derived: boolean): boolean {
  return derived ? Math.abs(a - b) <= DERIVED_PRICE_TOLERANCE : a === b;
}

/**
 * The merger pattern (§5): Acquisition Date equals Sale Date and differs from Purchase Date, Acquisition Price equals
 * Sale Price (exactly, or to Rs 0.01 per unit when the Sale Price is derived), and LTCG and STCG present and 0. A blank
 * cell never matches (a blank Purchase Date included: it cannot be shown to differ).
 */
export function isMergerPattern(lot: CgLot): boolean {
  const acq = val(lot.statement.acquisitionDate);
  const pd = val(lot.purchaseDate);
  if (acq === null || pd === null || acq !== lot.saleDate || acq === pd) return false;
  const ap = val(lot.statement.acquisitionPrice);
  const sp = val(lot.salePrice);
  if (ap === null || sp === null || !priceEqual(ap, sp, lot.salePriceDerived)) return false;
  return val(lot.statement.ltcg) === 0 && val(lot.statement.stcg) === 0;
}

/** The class of a lot that is not a merger row (§5 order from grandfathered on). */
export function nonMergerClass(table: TaxRuleTable, lot: CgLot, taxClass: TaxClass | null): LotClass {
  const acqD = val(lot.statement.acquisitionDate);
  const acqP = val(lot.statement.acquisitionPrice);
  const pd = val(lot.purchaseDate);
  const pp = val(lot.purchasePrice);
  const fmvDay = grandfatheringDay(table);
  if (taxClass === 'equity-oriented' && acqD === fmvDay && pd !== null && pd <= fmvDay) return 'grandfathered';
  const sameDate = acqD !== null && pd !== null && acqD === pd;
  if ((taxClass === 'specified-mf' || taxClass === 'other-non-equity') && sameDate && acqP !== null && pp !== null
    && !priceEqual(acqP, pp, lot.purchasePriceDerived)) return 'indexed-cost-shown';
  if (acqD === null && acqP === null) return 'standard';
  if (sameDate && acqP !== null && pp !== null && priceEqual(acqP, pp, lot.purchasePriceDerived)) return 'standard';
  return 'other';
}

export type LotClassing = {
  /** One class per lot, by position in the import's lots. */
  classes: LotClass[];
  events: MergerEventResult[];
  /** The merger event of each merger row, by position (index into `events`), else -1. */
  eventOf: number[];
  /** The successor link of each lot, by position, else null. */
  successorOf: Array<SuccessorLink | null>;
  refusals: Refusal[];
};

export type LotClassInputs = {
  scheme: readonly SchemeInput[];
  mergerAnswers: ReadonlyArray<{ eventId: string; answer: MergerAnswer }>;
  lotMarks: readonly LotMark[];
};

/** §5 over every lot of a statement: classes, merger events and successor lots. */
export function classifyLots(table: TaxRuleTable, lots: readonly CgLot[], taxClasses: ReadonlyArray<TaxClass | null>,
  inputs: LotClassInputs): LotClassing {
  const refusals: Refusal[] = [];
  const merger = lots.map((l) => isMergerPattern(l));
  const order: string[] = [];
  const rowsOf = new Map<string, number[]>();
  lots.forEach((l, i) => {
    if (!merger[i]) return;
    const rows = rowsOf.get(l.eventId);
    if (rows) rows.push(i);
    else { rowsOf.set(l.eventId, [i]); order.push(l.eventId); }
  });

  const answerOf = new Map<string, MergerAnswer>();
  for (const a of inputs.mergerAnswers) answerOf.set(a.eventId, a.answer);
  for (const a of inputs.mergerAnswers) {
    if (!rowsOf.has(a.eventId)) refusals.push({ input: 'merger-answer', ref: a.eventId, reason: 'no merger event of the statement has this id' });
  }

  const eventOf = lots.map(() => -1);
  const events: MergerEventResult[] = order.map((eventId, k) => {
    const rows = rowsOf.get(eventId)!;
    const first = lots[rows[0]!]!;
    const date = first.saleDate;
    let answer = answerOf.get(eventId) ?? null;
    if (answer === 'non-taxable' && date < SCHEME_CONSOLIDATION_FROM) {
      refusals.push({ input: 'merger-answer', ref: eventId, reason: 'a non-taxable consolidation is offered only for events from 2015-04-01 (TR-5)' });
      answer = null;
    }
    for (const i of rows) eventOf[i] = k;
    return {
      eventId, date, schemeLabel: first.schemeLabel, accountId: first.accountId, lots: rows.map((i) => lots[i]!.index), answer,
      taxable: answer !== null ? answer !== 'non-taxable' : date < SCHEME_CONSOLIDATION_FROM,
      decidedBy: answer !== null ? 'answer' : 'default', keptShare: 0, successors: [], crossHouse: false,
    };
  });

  const classes: LotClass[] = lots.map((l, i) => {
    if (merger[i]) return events[eventOf[i]!]!.taxable ? 'taxable-transfer' : 'non-taxable-transfer';
    return nonMergerClass(table, l, taxClasses[i] ?? null);
  });

  // Successor lots (§5). A lot is linked to the first event, in file order, that it matches.
  const marks = new Map<number, LotMark>();
  for (const m of inputs.lotMarks) marks.set(m.lotIndex, { ...(marks.get(m.lotIndex) ?? { lotIndex: m.lotIndex }), ...m });
  const successorOf: Array<SuccessorLink | null> = lots.map(() => null);
  const linkedSchemes: string[][] = events.map(() => []);
  events.forEach((ev, k) => {
    const rows = rowsOf.get(ev.eventId)!;
    const evScheme = schemeKeyOf(ev.schemeLabel);
    const evPurchases = new Map<DayNumber, { s: number | null; w: number | null }>();
    for (const i of rows) {
      const pd = val(lots[i]!.purchaseDate);
      if (pd === null) continue;
      const acc = evPurchases.get(pd) ?? { s: 0, w: 0 };
      const s = val(lots[i]!.saleValue);
      const w = val(lots[i]!.purchaseValue);
      acc.s = acc.s === null || s === null ? null : acc.s + s;
      acc.w = acc.w === null || w === null ? null : acc.w + w;
      evPurchases.set(pd, acc);
    }
    const byScheme = new Map<string, { label: string; lots: number[] }>();
    lots.forEach((l, i) => {
      if (merger[i] && eventOf[i] === k) return;
      if (l.accountId !== ev.accountId || schemeKeyOf(l.schemeLabel) === evScheme) return;
      const pd = val(l.purchaseDate);
      if (pd === null) return;
      const carried = pd < ev.date && evPurchases.has(pd) && l.saleDate > ev.date;
      const reset = pd === ev.date;
      if (carried || reset) linkedSchemes[k]!.push(schemeKeyOf(l.schemeLabel));
      let link: SuccessorLink | null = null;
      if (!ev.taxable && reset) {
        link = { kind: 'reset', eventId: ev.eventId, doubleCounted: null, rebase: null, analystApplied: marks.get(l.index)?.resetOriginal !== undefined };
      } else if (ev.taxable && carried) {
        const sw = evPurchases.get(pd)!;
        const v = val(l.purchaseValue);
        const ok = sw.s !== null && sw.w !== null && sw.w !== 0 && v !== null;
        link = {
          kind: 'not-reset', eventId: ev.eventId,
          doubleCounted: ok ? ((sw.s! - sw.w!) * v!) / sw.w! : null,
          rebase: ok ? { purchaseDate: ev.date, cost: (sw.s! * v!) / sw.w! } : null,
          analystApplied: false,
        };
        const rb = marks.get(l.index)?.rebase;
        if (rb !== undefined) {
          if (rb === 'formula' && link.rebase === null) {
            refusals.push({ input: 'lot-mark', ref: String(l.index), reason: 'the re-base needs the Sell Amount and Invested Value of the event and of the lot' });
          } else {
            link.analystApplied = true;
          }
        }
      }
      if (link === null || successorOf[i] !== null) return;
      successorOf[i] = link;
      const key = schemeKeyOf(l.schemeLabel);
      const g = byScheme.get(key) ?? { label: l.schemeLabel, lots: [] };
      g.lots.push(l.index);
      byScheme.set(key, g);
    });
    ev.successors = [...byScheme.values()].map((g) => ({ schemeLabel: g.label, lots: g.lots }));
  });

  // Marks given to lots they do not fit are refused, with the reason named.
  for (const m of marks.values()) {
    const i = lots.findIndex((l) => l.index === m.lotIndex);
    const link = i < 0 ? null : successorOf[i] ?? null;
    if (m.resetOriginal !== undefined && link?.kind !== 'reset') {
      refusals.push({ input: 'lot-mark', ref: String(m.lotIndex), reason: 'an original date and cost are set only on a successor-reset lot' });
    }
    if (m.rebase !== undefined && link?.kind !== 'not-reset') {
      refusals.push({ input: 'lot-mark', ref: String(m.lotIndex), reason: 'a re-base applies only to a successor-not-reset lot' });
    }
  }

  // The realised share an event keeps (§4): the units that went to lots still reset, at the merger value (their
  // Invested Value over the event's Sell Amount), at most the whole.
  events.forEach((ev) => {
    if (ev.taxable) { ev.keptShare = 1; return; }
    const rows = rowsOf.get(ev.eventId)!;
    const sell = rows.reduce((s, i) => s + (val(lots[i]!.saleValue) ?? 0), 0);
    let resetValue = 0;
    lots.forEach((l, i) => {
      const link = successorOf[i];
      if (link && link.kind === 'reset' && link.eventId === ev.eventId && !link.analystApplied) resetValue += val(l.purchaseValue) ?? 0;
    });
    ev.keptShare = sell > 0 ? Math.min(1, resetValue / sell) : 0;
  });

  // cross-house-merger: only when the scheme data (M2) names the fund house of the event's scheme and of a linked
  // scheme (a successor, reset or carrying the original dates); otherwise it is not raised.
  events.forEach((ev, k) => {
    const fy = financialYearOf(ev.date);
    const house = (key: string): string | null => schemeInputFor(inputs.scheme, key, fy).fundHouse ?? null;
    const own = house(schemeKeyOf(ev.schemeLabel));
    ev.crossHouse = own !== null && linkedSchemes[k]!.some((s) => { const h = house(s); return h !== null && h !== own; });
  });

  return { classes, events, eventOf, successorOf, refusals };
}
