// FIFO tax lots of the holdings, to the review's as-on date (parity row E-42; architecture §6.7, the engine/tax/ row;
// roadmap M7 acceptance: long + short + unclassified = CMV, merge gaps never reconciled by amount; OD-2, OD-12, OD-15,
// OD-16; D-040 a, b, d, h; KI-022, KI-064, KI-069, KI-070; BF-18).
//
// A port of the live `computeTaxation(rows, REF, asOn)` lot logic (index.html, the TAXATION section as merged by PR #36,
// with `taxNotSplit`, `taxBucket`, `taxAnniv`, `taxLocked`, `taxListedEtf` and `taxWithLater`):
//   - the IRR fund flows by client and instrument, the instrument joined to the holdings by the join the returns use
//     (engine/returns/scope.ts `matcherJoin`, PLAN-02 D9, unless the caller passes one); valuation rows are never
//     trades, and trades dated after the as-on date are left out (D-040 a), both counted;
//   - OD-16: a trade is a flow whose `direction` is 'in' or 'out' (the widened kinds of model/transactions.ts); an
//     untyped or unrecognised row moves no lot and is counted and named;
//   - two FIFO ledgers from one pass: rupees always (the amount), units when the flow carries a price (units = |amount| /
//     price); sales take the oldest lots first; a buy with no price (a switch-in, as a rule) moves the holding to the
//     rupee ledger when the unit ledger does not reconcile;
//   - per holding with a market value: the class (classify.ts, I-21); unmapped without one; a Category III AIF
//     (fund level) and a Category I or II AIF (pass-through) are not split (D-040 d); a merge gap in units is never
//     reconciled by amount (`Holding.mergeGaps`, BF-18, KI-140); no lots, or a unit (or rupee) count more than 1% away
//     from the base file, is unreconciled with its reason (value, short, excess, noPxSell); a PMS is not split (OD-12,
//     D-040 h); the lots are scaled onto the base file's units;
//   - a Specified row (specifiedFrom 2023-04-01) splits a holding with lots on both sides of that day into two records;
//   - each lot is long term strictly after its anniversary (N calendar months, clamped to the month end; OD-2,
//     D-040 b), short term otherwise, always short on an `alwaysShort` or `anyPeriod` row, the listed-ETF months for a
//     listed ETF, and locked through the ELSS lock-in anniversary;
//   - the lots are valued at the base file's CMV per unit, and their costs scaled to the base Invested, so long + short
//     + unclassified = the holding's CMV and gain exactly: an apportionment of the base file's own figures, never a
//     recomputation.
// Gate B of aa67a45 (Q-49; parity ledger TX-06 to TX-10): a holding whose history (to the as-on date) holds a transfer
// in, stock in or demerger in is unreconciled 'transferRow' (B3, OD-16), one with a bonus row 'bonusRow' (B2), never
// split, until the owner rules how the IRR export writes such rows; an oversell on the unit ledger is named in the
// reason (`oversoldUnits`), never clamped silently; a sale row with an amount of 0 counts as a sale the units of which
// are not known (the noPxSell kind, with its own reason text). A transfer out keeps the FIFO split (the usual
// convention, s.45(2A)) and is named the same way (`transferOutFifo`; delta review N-2).
// Round 2c (Q-49; Gate B of 5c9ae0a F3, F4; MOD-05's merger condition; parity ledger TX-13, TX-14): on a shared
// instrument the oversell is this holding's share (F3, OD-15); a sale row with an amount of 0 is named in the reason even
// when the split stands (F4); a holding whose history holds the switch in of a merger candidate (`mergerCandidates`: the
// day's switch outs that empty one scheme into exactly one other scheme on the same day for the same sum, one row or
// several, financial review V1, V2) is unreconciled 'mergerCandidate', never split, since a scheme merger is not a sale
// (s.47(xviii)) and cost and date carry over.
// One correction (OD-15, KI-069): when one IRR instrument joins more than one holding (the same scheme with two
// distributors) and the flows carry no folio that tells them apart, the instrument's lots are apportioned by units (by
// invested value on the rupee ledger) across those holdings and labelled `apportioned`; the live gives every such
// holding all the lots, so none reconciles. With folios that tell the holdings apart, the flows are split by folio.
// Money: the base file's Crore figures are carried in rupees (x 1e7), unrounded. Days are day numbers. Pure.

import type { Holding } from '../../model/holding.ts';
import type { Transaction } from '../../model/transactions.ts';
import type { TaxPosition } from '../../model/tax.ts';
import type { DayNumber } from '../../model/value.ts';
import type { ClientId, HoldingId } from '../../model/ids.ts';
import type { HoldingJoin } from '../returns/irr-tree.ts';
import { matcherJoin } from '../returns/scope.ts';
import { keyOf, normaliseLabel } from '../ids.ts';
import { formatDay } from '../dates.ts';
import { RUPEES_PER } from '../units.ts';
import { amountTolerance } from '../../ingest/capital-gains.ts';
import { anniversaryOf } from './rules.ts';
import {
  GRANDFATHER_BEFORE, GRANDFATHER_CLASSES, TAX_RULES_I21, classifyHolding, i21ByInst, i21Day, isListedEtf,
} from './classify.ts';
import type { ClassifyContext, HoldingTaxClass, I21Row } from './classify.ts';

// ---------------------------------------------------------------------------------------------------------------
// Types

/** A lot's term to the as-on date: long, short, locked (ELSS lock-in), or unknown (the row has no holding period). */
export type LotBucket = 'long' | 'short' | 'locked' | 'unknown';

/** Why a holding is not split into long and short term (D-040 d, h; OD-12). */
export type NotSplitKind = 'fund-level' | 'pass-through' | 'per-security';

/**
 * The live `unrec` kinds, plus 'apportion' (OD-15: the lots of a shared instrument cannot be apportioned), and two kinds
 * of Gate B of aa67a45 (Q-49; owner question on how the IRR export writes these rows): 'transferRow' (B3: the history
 * holds a transfer in, stock in or demerger in, so its lots would be dated and costed by the transfer, OD-16) and
 * 'bonusRow' (B2: the history holds a bonus row, never costed at its amount); and 'mergerCandidate' (round 2c, MOD-05's
 * merger condition: the history holds the switch in of a merger candidate, so its lots would be dated and costed at the
 * merger).
 */
export type UnreconciledKind = 'unitsGap' | 'noLots' | 'value' | 'short' | 'excess' | 'noPxSell' | 'apportion' | 'transferRow' | 'bonusRow' | 'mergerCandidate';

/** Units sold beyond the units held up to this many are rounding (3 decimals, as repeat-evidence.ts compares units). */
export const UNITS_TOLERANCE = 0.0005;

/** The in-kinds whose lot would be dated and costed by a transfer, not the original purchase (B1, B3; OD-16). */
export const TRANSFER_IN_KINDS: ReadonlySet<Transaction['kind']> = new Set(['transfer-in', 'stock-in', 'demerger-in']);
/** The in-kind of a bonus allotment (B2): never costed at the row's amount. */
export const BONUS_KINDS: ReadonlySet<Transaction['kind']> = new Set(['bonus']);

/** One open lot of a record, after scaling: units (rupees on the rupee ledger), value and cost in rupees. */
export type LotDetail = {
  day: DayNumber;
  /** Units on the unit ledger; rupees of cost on the rupee ledger. Scaled onto the base file's figure. */
  units: number;
  bucket: LotBucket;
  /** The lot's value at the base file's CMV per unit (rupees). */
  value: number;
  /** The lot's cost scaled to the base Invested (rupees); null when the holding has no invested value. */
  cost: number | null;
  /** TX-18: bought before 1 Feb 2018 in a class the grandfathering can cover (stays on actual cost, disclosed). */
  grandfathered: boolean;
};

type Split = { cmv: number; gain: number | null };

/**
 * One record per holding with a market value (two for a holding split at the Specified date): the contract's
 * TaxPosition (model/tax.ts) with its gains allowed to be missing (no invested value: KI-007, never 0) and the lines
 * the contract does not carry. `toTaxPosition` gives the contract's shape when every gain is known.
 */
export type TaxPositionRecord = Omit<TaxPosition, 'gain' | 'lt' | 'st' | 'unclassifiedGain'> & {
  instrumentName: string;
  gain: number | null;
  lt: Split;
  st: Split;
  /** Neither long nor short: locked lots, lots of a row without a holding period, and every unsplit or unreconciled amount. */
  unclassified: Split;
  unclassifiedGain: number | null;
  /** The part of `unclassified` inside the ELSS lock-in; null on a row without a lock-in. */
  locked: Split | null;
  /** A Category III AIF: CMV and gain at fund level (lt + st + unclassified + fundLevel = cmv). */
  fundLevel: Split | null;
  notSplit: NotSplitKind | null;
  unreconciledKind: UnreconciledKind | null;
  /** The class came from the usual bucket (PD-16 item 7, PD-44). */
  usual: boolean;
  catAssumed: boolean;
  catRuled: boolean;
  /** The base file's units (unit ledger only) and the FIFO units before scaling. */
  baseUnits: number | null;
  fifoUnits: number | null;
  /** A buy without a price moved the holding to the rupee ledger (and whether it was a switch-in). */
  pxGap: boolean;
  viaSwitchIn: boolean;
  /**
   * Units the IRR history sells beyond the units its earlier purchases hold (beyond UNITS_TOLERANCE), on the unit
   * ledger; null when none or on the rupee ledger. Never silent (Gate B of aa67a45): the reason says so. On a shared
   * instrument (OD-15) it is this holding's share, by the same share as its lots (Gate B of 5c9ae0a, F3).
   */
  oversoldUnits: number | null;
  /**
   * The history (to the as-on date) holds a transfer out, consumed oldest first (FIFO, the usual convention, s.45(2A)):
   * which units it moved is assumed, not in the IRR file. Named in the reason (delta review N-2).
   */
  transferOutFifo: boolean;
  /** TX-18: open lots bought before 1 Feb 2018 in a grandfathering class. */
  gfLots: number;
  oldest: DayNumber | null;
  newest: DayNumber | null;
  /** Trades of this holding's instrument dated after the as-on date, left out. */
  laterTrades: number;
  lotDetail: LotDetail[];
};

export type TaxLotsCounts = {
  /** Fund flows given. */
  flows: number;
  /** Trades (direction in or out) on or before the as-on date, joined to a holding or not. */
  trades: number;
  /** Valuation (closing) rows: never trades. */
  valuation: number;
  /** Trades dated after the as-on date, left out, and their instrument names in order of first appearance. */
  later: number;
  laterInstruments: string[];
  /** Trades without a price (they reach the rupee ledger only). */
  noPrice: number;
  /** OD-16: rows with no type, and rows whose type is none of the known kinds (each label as written, with its rows). */
  untyped: number;
  unrecognised: Array<{ label: string; rows: number }>;
  /** Trades whose instrument joins no holding. */
  unjoinedTrades: number;
  /** Holdings without a market value above zero (no record). */
  holdingsWithoutValue: number;
  /** Holdings whose lots were apportioned (OD-15). */
  apportioned: number;
};

export type TaxLotsResult = {
  asOn: DayNumber;
  /** Split, not split, fund level and locked records. */
  positions: TaxPositionRecord[];
  unreconciled: TaxPositionRecord[];
  unmapped: TaxPositionRecord[];
  counts: TaxLotsCounts;
};

export type TaxLotsOptions = {
  /** The tax reference date (D-040 a): the review's as-on date, the base file's valuation date when it gives one. */
  asOn: DayNumber;
  /** The holdings join; defaults to the returns' join (engine/returns/scope.ts matcherJoin, PLAN-02 D9). */
  join?: HoldingJoin;
  /** Reference-data facts for the classification of one holding (matched STOCK_RET ISIN, AIF_PERF entry). */
  classifyContext?: (h: Holding) => Omit<ClassifyContext, 'refDay'>;
  /** The I-21 table; defaults to data/refdata/TAX_RULES.json. */
  table?: readonly I21Row[];
};

// ---------------------------------------------------------------------------------------------------------------
// Terms (D-040 b, OD-2)

/** The live taxBucket: long strictly after the anniversary; short on an alwaysShort or anyPeriod row. */
export function lotTerm(rule: I21Row, buy: DayNumber, asOn: DayNumber, listedEtf: boolean): 'long' | 'short' | null {
  if (rule.alwaysShort || rule.anyPeriod) return 'short';
  const months = listedEtf && rule.listedEtfMonths ? rule.listedEtfMonths : rule.months;
  if (months === null || months === undefined) return null;
  return asOn > anniversaryOf(buy, months) ? 'long' : 'short';
}

/** The live taxLocked: an ELSS lot is locked up to and including its lock-in anniversary. */
export function lotLocked(rule: I21Row, buy: DayNumber, asOn: DayNumber): boolean {
  return !!rule.lockMonths && asOn <= anniversaryOf(buy, rule.lockMonths);
}

// ---------------------------------------------------------------------------------------------------------------
// The ledgers

type UnitLot = { day: DayNumber; u: number; px: number };
type RupeeLot = { day: DayNumber; u: number };
type Ledger = {
  units: UnitLot[]; rupees: RupeeLot[]; noPxBuy: boolean; swIn: boolean; noPxSell: boolean; later: number;
  /** Gate B of aa67a45: a transfer in, stock in or demerger in (B3), a bonus row (B2), a sale row with an amount of 0. */
  transferRow: boolean; bonusRow: boolean; zeroSell: boolean;
  /** Units sold beyond the unit ledger's lots (each shortfall beyond UNITS_TOLERANCE, added up). */
  oversold: number;
  /** A transfer out was consumed by FIFO (delta review N-2). */
  transferOut: boolean;
  /** The history holds the switch in of a merger candidate (round 2c, `mergerCandidates`). */
  mergerIn: boolean;
};

const EPS = 1e-9;
const priceOf = (t: Transaction): number | null => (t.price.kind === 'value' && t.price.v > 0 ? t.price.v : null);
const isTrade = (t: Transaction): boolean => t.direction === 'in' || t.direction === 'out';

/** The trade price the ledgers use: the flow's price when present and above 0, else null (S5, realised-irr.ts, reuses it). */
export const tradePriceOf = priceOf;
/** A trade is a flow whose direction is 'in' or 'out' (OD-16); S5 (realised-irr.ts) reuses it. */
export const isTradeFlow = isTrade;

/** One take of a FIFO consumption: the position of the lot in the list and the amount taken from it (above 0). */
export type FifoTake = { index: number; take: number };

/**
 * Takes `need` from the lots oldest first, in place (the ledgers' FIFO step), and returns each take and the part of
 * `need` no lot could meet (0 when met). Added for S5 (realised gains derived from the IRR file, realised-irr.ts); the
 * ledgers above call it through `consume`, so their behaviour is unchanged.
 */
export function consumeFifo(lots: Array<{ u: number }>, need: number): { takes: FifoTake[]; short: number } {
  const takes: FifoTake[] = [];
  for (let i = 0; i < lots.length && need > EPS; i++) {
    const take = Math.min(lots[i]!.u, need);
    lots[i]!.u -= take;
    need -= take;
    if (take > 0) takes.push({ index: i, take });
  }
  return { takes, short: need > EPS ? need : 0 };
}

function consume(lots: Array<{ u: number }>, need: number): void {
  consumeFifo(lots, need);
}

// ---------------------------------------------------------------------------------------------------------------
// Merger candidates (round 2c; MOD-05's merger condition; Q-49)

/**
 * The switch rows of the merger candidates. Each switch out maps to the instrument key (client and normalised name, as
 * `derivedInstrumentKey`) of its partner scheme B, each switch in to the key of its scheme A; `pairs` counts the
 * candidates (one per client, scheme A and day).
 */
export type MergerCandidates = { outs: ReadonlyMap<Transaction, string>; ins: ReadonlyMap<Transaction, string>; pairs: number };

/**
 * The switches that look like a scheme merger. A scheme merger written as Switch Out / Switch In cannot be told from an
 * ordinary switch in the IRR file, and a merger is not a sale (s.47(xviii)): cost and date carry over. Within one client
 * and one day, the day's switch outs are summed per scheme, and so are the day's switch ins (a merger may be written as
 * several rows, one per folio or distributor: round 2c financial review V1). Scheme A's switch outs that day are a
 * candidate with scheme B's switch ins when:
 *   - A is left with no units after all of that day's switch outs of A, and the last of them is A's last trade: the units
 *     A's trades hold come to 0 within UNITS_TOLERANCE. When A's units are not known (a trade of A without a price or
 *     with an amount of 0), the last-trade test alone applies: A's side is then a gap anyway, and B is protected (V2);
 *   - B's switch ins that day sum to A's switch outs, within the reader's amount tolerance (Rs 1 or 0.01%, the larger;
 *     ingest/capital-gains.ts `amountTolerance`);
 *   - exactly one partner scheme both ways: B is the only other scheme whose switch-in sum matches A's switch-out sum,
 *     and A the only other scheme whose switch-out sum matches B's switch-in sum. Several possible partners, a partial
 *     switch, unequal sums or A kept: an ordinary switch, as before.
 * All of A's switch outs that day are the candidate's, and all of B's switch ins that day.
 * `trades`: the trades (direction in or out) in day order, file order within a day, already limited to the as-on date.
 */
export function mergerCandidates(trades: readonly Transaction[]): MergerCandidates {
  const keyOfTrade = (t: Transaction): string => keyOf([t.clientId, normaliseLabel(t.instrumentName)]);
  const last = new Map<string, number>();
  trades.forEach((t, i) => last.set(keyOfTrade(t), i));
  /** Units of each instrument after the trades so far; null once a trade's units are not known. */
  const held = new Map<string, number | null>();
  /** Per client and day, per scheme: the switch rows, their amount sums and, for the outs, A's state after the last. */
  type Side = { rows: Transaction[]; sum: number };
  type Day = { out: Map<string, Side & { emptied: boolean }>; in: Map<string, Side> };
  const days = new Map<string, Day>();
  trades.forEach((t, i) => {
    const k = keyOfTrade(t);
    const before = held.has(k) ? held.get(k)! : 0;
    const px = priceOf(t);
    const amt = Math.abs(t.amountRupees);
    const u = px !== null && amt > EPS ? amt / px : null;
    const after = before === null || u === null ? null : t.direction === 'in' ? before + u : before - u;
    held.set(k, after);
    const isOut = t.direction === 'out' && t.kind === 'switch-out';
    const isIn = t.direction === 'in' && t.kind === 'switch-in';
    if (!isOut && !isIn) return;
    const dk = keyOf([t.clientId, String(t.day)]);
    const d = days.get(dk) ?? { out: new Map(), in: new Map() };
    days.set(dk, d);
    if (isIn) {
      const s = d.in.get(k) ?? { rows: [], sum: 0 };
      s.rows.push(t); s.sum += amt; d.in.set(k, s);
      return;
    }
    const s = d.out.get(k) ?? { rows: [], sum: 0, emptied: false };
    s.rows.push(t); s.sum += amt;
    // Read after each switch out; the last one of the day decides (it must be A's last trade).
    s.emptied = last.get(k) === i && (after === null || Math.abs(after) <= UNITS_TOLERANCE);
    d.out.set(k, s);
  });
  const outs = new Map<Transaction, string>();
  const ins = new Map<Transaction, string>();
  let pairs = 0;
  const same = (x: number, y: number): boolean => Math.abs(x - y) <= amountTolerance(Math.max(x, y));
  for (const d of days.values()) {
    for (const [a, o] of d.out) {
      if (!o.emptied || !(o.sum > EPS)) continue;
      const partners = [...d.in].filter(([b, s]) => b !== a && same(o.sum, s.sum));
      if (partners.length !== 1) continue;
      const [b, s] = partners[0]!;
      const rivals = [...d.out].filter(([c, x]) => c !== b && same(x.sum, s.sum));
      if (rivals.length !== 1) continue;
      for (const r of o.rows) outs.set(r, b);
      for (const r of s.rows) ins.set(r, a);
      pairs++;
    }
  }
  return { outs, ins, pairs };
}

/** One pass over trades sorted by day (file order within a day): both FIFO ledgers. */
function runLedgerOf(trades: readonly Transaction[], asOn: DayNumber, merger: MergerCandidates): Ledger {
  const L: Ledger = { units: [], rupees: [], noPxBuy: false, swIn: false, noPxSell: false, later: 0, transferRow: false, bonusRow: false, zeroSell: false, oversold: 0, transferOut: false, mergerIn: false };
  for (const t of trades) {
    if (t.day > asOn) { L.later++; continue; }
    const amt = Math.abs(t.amountRupees);
    const buy = t.direction === 'in';
    if (buy && merger.ins.has(t)) L.mergerIn = true;
    if (buy && TRANSFER_IN_KINDS.has(t.kind)) L.transferRow = true;
    if (buy && BONUS_KINDS.has(t.kind)) L.bonusRow = true;
    if (!buy && t.kind === 'transfer-out') L.transferOut = true;
    // Item 7 (Gate B of aa67a45): a sale row with an amount of 0 moves no units; the reason treats it as a sale without a price.
    if (!buy && amt <= EPS) { L.noPxSell = true; L.zeroSell = true; }
    if (buy) L.rupees.push({ day: t.day, u: amt }); else consume(L.rupees, amt);
    const px = priceOf(t);
    if (px === null) {
      if (buy) { L.noPxBuy = true; if (t.kind === 'switch-in') L.swIn = true; } else if (amt > EPS) L.noPxSell = true;
      continue;
    }
    const u = amt / px;
    if (buy) L.units.push({ day: t.day, u, px });
    else {
      // Gate B of aa67a45: an oversell is flagged, never clamped silently (the realised side's B-1 rule names it a gap).
      const { short } = consumeFifo(L.units, u);
      if (short > UNITS_TOLERANCE) L.oversold += short;
    }
  }
  return L;
}

const byDay = (a: Transaction, b: Transaction): number => a.day - b.day;
const folioKey = (s: string | null | undefined): string => normaliseLabel(s ?? '');

// ---------------------------------------------------------------------------------------------------------------
// Reasons (the live texts)

/** A unit count in a reason: up to six significant digits, no grouping (F3). */
function unitsText(u: number): string {
  return String(Number(u.toPrecision(6)));
}

function withLater(reason: string, n: number, asOn: DayNumber): string {
  return `${reason.replace(/\.?\s*$/, '.')} ${n} IRR transaction${n === 1 ? '' : 's'} for this holding dated after ${formatDay(asOn)}, `
    + `the date holding periods run to, ${n === 1 ? 'is' : 'are'} left out.`;
}

const REASON = {
  unitsGap: 'Units are blank: a merged folio of this holding has no units in the base file, so they cannot be checked against the transaction history. No split is shown rather than one on a partial unit count.',
  noLots: (pxGap: boolean, swIn: boolean, amtMode: boolean): string => (pxGap
    ? `No purchase transactions in the IRR history. ${swIn ? 'The switch-in' : 'A purchase'} for this holding carries no price, so units could not be derived from it.`
    : amtMode ? 'No purchase transactions in the IRR history (this holding has no units, so it is matched on invested value)'
      : 'No purchase transactions in the IRR history'),
  drift: (pxGap: boolean, swIn: boolean, amtMode: boolean, fewer: boolean, noPxSell: boolean, zeroSell = false): string => (pxGap
    ? `Invested value does not reconcile to the base file. ${swIn ? 'The switch-in' : 'A purchase'} for this holding carries no price, so it was matched on invested value rather than units, and that does not reconcile either.`
    : amtMode ? 'Invested value does not reconcile to the base file: the transaction history is incomplete for this holding.'
      : fewer ? 'Units do not reconcile to the base file: the transaction history gives fewer units, so it is missing an event, such as a bonus or split, or a purchase made elsewhere.'
        : noPxSell && zeroSell ? 'Units do not reconcile to the base file: the transaction history gives more units, and a sale, switch out or transfer out in it carries an amount of 0, so the units it sold could not be counted.'
          : noPxSell ? 'Units do not reconcile to the base file: the transaction history gives more units, and a sale, switch out or transfer out in it carries no price, so the units it sold could not be counted.'
            : 'Units do not reconcile to the base file: the transaction history gives more units, so it is missing an event, such as a sale, a transfer out or a consolidation of units.'),
  // Gate B of aa67a45 (Q-49; owner question on how the IRR export writes these rows).
  transferRow: 'The transaction history of this holding holds a transfer in, stock in or demerger in. Its lots would be dated and costed by the transfer, not by the original purchase, and what cost and date carry over is not known, so no split is shown (OD-16).',
  bonusRow: 'The transaction history of this holding holds a bonus row. Bonus units have nil cost by law, and how the IRR file writes a bonus row is not confirmed, so no split is shown rather than one costed at the row\'s amount.',
  // Gate B of 5c9ae0a, F3: the units are this holding's share on a shared instrument (OD-15); when the share cannot be
  // worked out (the apportionment failed), the scheme's whole figure, said so (round 2c financial review N1).
  oversold: (units: number, shared: 'own' | 'share' | 'scheme'): string => `The transaction history sells more units than its earlier purchases hold (${unitsText(units)} units beyond${shared === 'share'
    ? ', this holding\'s share by units of the scheme\'s history (OD-15)' : shared === 'scheme' ? ', for the scheme\'s whole history: this holding\'s share is not known (OD-15)' : ''}), so a purchase, bonus or split is missing from the IRR file; the lots shown are those left after the sale.`,
  transferOut: 'The transaction history holds a transfer out; the IRR file does not say which units it moved, so the oldest are assumed (FIFO, the usual convention).',
  // Gate B of 5c9ae0a, F4: the split stands within the 1% band, but the sale of 0 is named.
  zeroSell: 'A sale, switch out or transfer out in the transaction history carries an amount of 0, so the units it sold could not be counted; the units still reconcile to the base file within 1%, so the split is shown on them.',
  // Round 2c (MOD-05's merger condition; Q-49).
  // Financial review N3: what the file does not say is whether the pair was a merger.
  mergerCandidate: 'The transaction history of this holding holds a switch in that looks like a scheme merger: on the same day the whole of another scheme was switched out for the same amount. A merger is not a sale (s.47(xviii)), so the cost and date of the merged units would carry over, and the IRR file does not say whether it was a merger; no split is shown until the analyst confirms whether it was a merger or an ordinary switch.',
  apportion: 'The IRR history of this scheme covers more than one holding and gives no folio that tells them apart, and not every one of those holdings has the units (or invested value) to apportion its lots by, so no split is shown (OD-15).',
  noRow: (inst: string): string => `No row in the tax rules covers the class "${inst}".`,
} as const;

// ---------------------------------------------------------------------------------------------------------------
// The computation

/** A holding's source of lots: its own ledger, or a share of a ledger it shares with other holdings (OD-15). */
type LotSource = { ledger: Ledger; group: readonly Holding[] | null };

/** FIFO tax lots of the holdings to the as-on date. `fund` are the IRR fund flows (any order; file order breaks ties). */
export function computeTaxLots(holdings: readonly Holding[], fund: readonly Transaction[], opts: TaxLotsOptions): TaxLotsResult {
  const asOn = opts.asOn;
  const table = opts.table ?? TAX_RULES_I21;
  const byInst = i21ByInst(table);
  const join = opts.join ?? matcherJoin(holdings, fund);
  const counts: TaxLotsCounts = {
    flows: fund.length, trades: 0, valuation: 0, later: 0, laterInstruments: [], noPrice: 0, untyped: 0, unrecognised: [],
    unjoinedTrades: 0, holdingsWithoutValue: 0, apportioned: 0,
  };

  // 1. Counts over every flow (the live counts trades whether or not a holding joins them).
  const sorted = fund.map((t, i) => ({ t, i })).sort((a, b) => byDay(a.t, b.t) || a.i - b.i).map((x) => x.t);
  for (const t of sorted) {
    if (t.direction === 'valuation') { counts.valuation++; continue; }
    if (t.kind === 'untyped') { counts.untyped++; continue; }
    if (t.kind === 'unrecognised') {
      const label = t.typeLabel ?? '';
      const e = counts.unrecognised.find((x) => x.label === label);
      if (e) e.rows++; else counts.unrecognised.push({ label, rows: 1 });
      continue;
    }
    if (!isTrade(t)) continue;
    if (t.day > asOn) {
      counts.later++;
      const name = t.instrumentName ?? '';
      if (!counts.laterInstruments.includes(name)) counts.laterInstruments.push(name);
      continue;
    }
    counts.trades++;
    if (priceOf(t) === null) counts.noPrice++;
  }

  // 2. The join: each instrument (client and name) to its holdings; instruments and holdings linked by the join form one
  // group, whose trades run through one ledger (or one per holding, when folios tell the holdings apart).
  const instrumentKey = (clientId: ClientId, name: string | null): string => keyOf([clientId, normaliseLabel(name)]);
  const tradesOf = new Map<string, Transaction[]>();
  const holdingsOf = new Map<string, HoldingId[]>();
  for (const t of sorted) {
    if (!isTrade(t)) continue;
    const k = instrumentKey(t.clientId, t.instrumentName);
    let l = tradesOf.get(k);
    if (!l) { l = []; tradesOf.set(k, l); holdingsOf.set(k, join(t.clientId, t.instrumentName)); }
    l.push(t);
  }
  const holdingById = new Map(holdings.map((h) => [h.id, h]));
  // Union-find over holdings, keyed by holding id; each instrument links the holdings it joins.
  const parent = new Map<HoldingId, HoldingId>();
  const find = (x: HoldingId): HoldingId => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(x, r); return r; };
  for (const h of holdings) parent.set(h.id, h.id);
  const instrumentsOfRoot = new Map<HoldingId, string[]>();
  for (const [k, ids] of holdingsOf) {
    const known = ids.filter((id) => holdingById.has(id));
    if (!known.length) { counts.unjoinedTrades += tradesOf.get(k)!.filter((t) => t.day <= asOn).length; continue; }
    for (const id of known.slice(1)) parent.set(find(id), find(known[0]!));
  }
  for (const [k, ids] of holdingsOf) {
    const known = ids.filter((id) => holdingById.has(id));
    if (!known.length) continue;
    const r = find(known[0]!);
    const l = instrumentsOfRoot.get(r) ?? [];
    l.push(k);
    instrumentsOfRoot.set(r, l);
  }
  const membersOfRoot = new Map<HoldingId, Holding[]>();
  const valued = (h: Holding): boolean => h.cmv.kind === 'value' && h.cmv.v > 0;
  for (const h of holdings) {
    const r = find(h.id);
    // A holding without a market value has no record, so it takes no share of a shared instrument.
    if (!instrumentsOfRoot.has(r) || !valued(h)) continue;
    const l = membersOfRoot.get(r) ?? [];
    l.push(h);
    membersOfRoot.set(r, l);
  }
  const sourceOf = new Map<HoldingId, LotSource>();
  const order = new Map(sorted.map((t, i) => [t, i]));
  // Round 2c: the merger candidates among every trade to the as-on date (whether or not a holding joins them).
  const merger = mergerCandidates(sorted.filter((t) => isTrade(t) && t.day <= asOn));
  const runLedger = (trades: readonly Transaction[], on: DayNumber): Ledger => runLedgerOf(trades, on, merger);
  for (const [r, keys] of instrumentsOfRoot) {
    const members = membersOfRoot.get(r);
    if (!members) continue;
    const trades = keys.flatMap((k) => tradesOf.get(k)!);
    trades.sort((a, b) => order.get(a)! - order.get(b)!);
    if (members.length === 1) { sourceOf.set(members[0]!.id, { ledger: runLedger(trades, asOn), group: null }); continue; }
    // Folios that tell the holdings apart: every trade's folio belongs to exactly one member.
    const ownerOf = (t: Transaction): Holding | null => {
      const f = folioKey(t.folio);
      if (!f) return null;
      const hits = members.filter((h) => h.folios.some((x) => folioKey(x) === f));
      return hits.length === 1 ? hits[0]! : null;
    };
    const owners = trades.map(ownerOf);
    if (owners.every((o) => o !== null)) {
      for (const h of members) sourceOf.set(h.id, { ledger: runLedger(trades.filter((_, i) => owners[i] === h), asOn), group: null });
    } else {
      const ledger = runLedger(trades, asOn);
      for (const h of members) sourceOf.set(h.id, { ledger, group: members });
    }
  }

  // 3. Each holding with a market value.
  const out: TaxLotsResult = { asOn, positions: [], unreconciled: [], unmapped: [], counts };
  const unitsOf = (h: Holding): number | null => (h.units.kind === 'value' && Number.isFinite(h.units.v) ? h.units.v : null);
  const investedOf = (h: Holding): number | null => (h.invested.kind === 'value' && Number.isFinite(h.invested.v) ? h.invested.v * RUPEES_PER.crore : null);
  for (const h of holdings) {
    const cmvCr = h.cmv.kind === 'value' ? h.cmv.v : null;
    if (cmvCr === null || !(cmvCr > 0)) { counts.holdingsWithoutValue++; continue; }
    const cmv = cmvCr * RUPEES_PER.crore;
    const inv = investedOf(h);
    const gl = inv !== null ? cmv - inv : null;
    const cls: HoldingTaxClass = classifyHolding(h, { ...(opts.classifyContext ? opts.classifyContext(h) : {}), refDay: asOn });
    const rule = cls.inst !== null ? byInst.get(cls.inst) ?? null : null;
    const unitBase = unitsOf(h);
    const unitsGap = h.mergeGaps.includes('units');
    const src = sourceOf.get(h.id) ?? null;
    const ledger = src?.ledger ?? null;
    let amtMode = !(unitBase !== null && unitBase > 0) && !unitsGap;
    let pxGap = false;
    let apportionFailed = false;
    let L: Array<{ day: DayNumber; u: number; px: number | null }> = [];
    let fifoU = 0;
    let baseU: number | null = unitBase;
    /** This holding's share of its ledger (1 unless apportioned, OD-15); F3 scales the oversell by it. */
    let share = 1;
    const load = (): void => {
      apportionFailed = false;
      const raw = ledger ? (amtMode ? ledger.rupees.map((x) => ({ day: x.day, u: x.u, px: null })) : ledger.units.map((x) => ({ day: x.day, u: x.u, px: x.px as number | null }))) : [];
      share = 1;
      if (src?.group) {
        // OD-15: this holding's share of the shared instrument, by units (by invested value on the rupee ledger).
        const basis = src.group.map((g) => (amtMode ? investedOf(g) : unitsOf(g)));
        const total = basis.reduce<number>((s, x) => s + (x ?? 0), 0);
        const mine = amtMode ? inv : unitBase;
        if (basis.every((x) => x !== null && x > 0) && mine !== null && total > 0) share = mine / total;
        else apportionFailed = true;
      }
      L = raw.filter((x) => x.u > EPS).map((x) => ({ ...x, u: x.u * share }));
      fifoU = L.reduce((s, x) => s + x.u, 0);
      baseU = amtMode ? inv : unitBase;
    };
    // R2 S-2: a base figure of 0 (the rupee ledger with an invested value of 0) against lots above 0 is full drift, so the
    // holding is unreconciled and its CMV lands in unclassified (long + short + unclassified = CMV, AC-18). The live
    // returns 0 here and scales every lot to 0 units, so the CMV vanished from all three buckets.
    const drift = (): number => (baseU !== null && baseU !== 0 ? Math.abs(fifoU - baseU) / Math.abs(baseU)
      : baseU === 0 ? (fifoU > 0 ? 1 : 0) : fifoU > 0 ? 0 : 1);
    load();
    if (!amtMode && !unitsGap && ledger?.noPxBuy && (!L.length || drift() > 0.01)) { amtMode = true; pxGap = true; load(); }
    const swIn = !!ledger?.swIn;
    const later = ledger?.later ?? 0;

    const rec: TaxPositionRecord = {
      holdingId: h.id, clientId: h.clientId, splitPart: null, taxRule: cls.inst, status: 'ok', reason: null,
      ledger: amtMode ? 'rupees' : 'units', apportioned: !!src?.group, cmv, gain: gl, lt: { cmv: 0, gain: null },
      st: { cmv: 0, gain: null }, unclassified: { cmv, gain: gl }, unclassifiedGain: gl, lots: L.length,
      instrumentName: h.instrumentName, locked: null, fundLevel: null, notSplit: null, unreconciledKind: null,
      usual: !!cls.usual, catAssumed: !!cls.catAssumed, catRuled: !!cls.catRuled,
      baseUnits: amtMode ? null : baseU, fifoUnits: amtMode ? null : fifoU, pxGap, viaSwitchIn: pxGap && swIn,
      // F3 (Gate B of 5c9ae0a): on a shared instrument, this holding's share of the ledger's oversell (OD-15).
      oversoldUnits: !amtMode && ledger && ledger.oversold > 0 ? ledger.oversold * share : null, transferOutFifo: !!ledger?.transferOut, gfLots: 0,
      oldest: null, newest: null, laterTrades: later, lotDetail: [],
    };
    /** Gate B of aa67a45: an oversell on the unit ledger is named in the reason, never silent. */
    // Delta review N-2: a transfer out consumed by FIFO is named the same way.
    // F4 (Gate B of 5c9ae0a): on a split that stands, a sale row with an amount of 0 is named too (`zeroSplit`).
    const withOversold = (reason: string | null, zeroSplit = false): string | null => {
      const notes: string[] = [];
      if (rec.oversoldUnits !== null) notes.push(REASON.oversold(rec.oversoldUnits, !src?.group ? 'own' : apportionFailed ? 'scheme' : 'share'));
      if (rec.transferOutFifo) notes.push(REASON.transferOut);
      if (zeroSplit && ledger?.zeroSell) notes.push(REASON.zeroSell);
      if (!notes.length) return reason;
      return [reason === null ? null : reason.replace(/\.?\s*$/, '.'), ...notes].filter((x): x is string => x !== null).join(' ');
    };
    const unreconciled = (kind: UnreconciledKind, reason: string): void => {
      rec.status = 'unreconciled';
      rec.unreconciledKind = kind;
      rec.reason = withOversold(later ? withLater(reason, later, asOn) : reason);
      out.unreconciled.push(rec);
    };
    const notSplit = (kind: NotSplitKind): void => {
      const fl = kind === 'fund-level';
      rec.status = fl ? 'fund-level' : 'not-split';
      rec.notSplit = kind;
      rec.taxRule = rule!.inst;
      rec.unclassified = fl ? { cmv: 0, gain: null } : { cmv, gain: gl };
      rec.unclassifiedGain = rec.unclassified.gain;
      rec.fundLevel = fl ? { cmv, gain: gl } : null;
      for (const x of L) {
        if (rec.oldest === null || x.day < rec.oldest) rec.oldest = x.day;
        if (rec.newest === null || x.day > rec.newest) rec.newest = x.day;
      }
      out.positions.push(rec);
    };

    if (cls.inst === null || rule === null) {
      rec.status = 'unmapped';
      rec.reason = cls.inst !== null ? REASON.noRow(cls.inst) : cls.why ?? '';
      out.unmapped.push(rec);
      continue;
    }
    if (rule.fundLevel || rule.passThrough) { notSplit(rule.fundLevel ? 'fund-level' : 'pass-through'); continue; }
    if (unitsGap) { unreconciled('unitsGap', REASON.unitsGap); continue; }
    if (apportionFailed) { unreconciled('apportion', REASON.apportion); continue; }
    // B3, B2 (Gate B of aa67a45; Q-49): never split on lots dated and costed by a transfer, or a bonus costed at its
    // amount. A per-security row (PMS) is never split anyway and keeps its own path.
    if (!rule.perSecurity && ledger?.transferRow) { unreconciled('transferRow', REASON.transferRow); continue; }
    if (!rule.perSecurity && ledger?.bonusRow) { unreconciled('bonusRow', REASON.bonusRow); continue; }
    // Round 2c (MOD-05's merger condition; Q-49): never split on lots dated and costed at what may be a scheme merger.
    if (!rule.perSecurity && ledger?.mergerIn) { unreconciled('mergerCandidate', REASON.mergerCandidate); continue; }
    if (!L.length) { unreconciled('noLots', REASON.noLots(pxGap, swIn, amtMode)); continue; }
    const rel = drift();
    if (baseU !== null && rel > 0.01) {
      const fewer = fifoU < baseU;
      const kind: UnreconciledKind = amtMode ? 'value' : fewer ? 'short' : ledger?.noPxSell ? 'noPxSell' : 'excess';
      unreconciled(kind, REASON.drift(pxGap, swIn, amtMode, fewer, !!ledger?.noPxSell, !!ledger?.zeroSell));
      continue;
    }
    if (rule.perSecurity) { notSplit('per-security'); continue; }
    if (src?.group) counts.apportioned++;
    rec.reason = withOversold(rec.reason, true);

    // The split.
    const scale = baseU !== null && fifoU > 0 ? baseU / fifoU : 1;
    let preRule = rule.specifiedFrom && rule.before ? byInst.get(rule.before) ?? null : null;
    const sfDay = preRule ? i21Day(rule.specifiedFrom) : null;
    if (sfDay === null) preRule = null;
    const etf = isListedEtf(h);
    const gfCls = GRANDFATHER_CLASSES.has(cls.inst);
    type B = { bucket: LotBucket; u: number; costRaw: number; day: DayNumber; part: 0 | 1; gf: boolean };
    const buckets: B[] = L.map((x) => {
      const u = x.u * scale;
      const part: 0 | 1 = preRule && sfDay !== null && x.day < sfDay ? 1 : 0;
      const lr = part ? preRule! : rule;
      const term = lotTerm(lr, x.day, asOn, etf);
      const bucket: LotBucket = term && lotLocked(lr, x.day, asOn) ? 'locked' : term ?? 'unknown';
      return { bucket, u, costRaw: amtMode ? u : u * x.px!, day: x.day, part, gf: gfCls && x.day < GRANDFATHER_BEFORE };
    });
    const totU = buckets.reduce((s, x) => s + x.u, 0);
    const per = totU > 0 ? cmv / totU : 0;
    const costRawTot = buckets.reduce((s, x) => s + x.costRaw, 0);
    const costScale = inv !== null && costRawTot > 0 ? inv / costRawTot : null;
    const parts = ([0, 1] as const).filter((p) => buckets.some((x) => x.part === p));
    const base0: TaxPositionRecord = { ...rec };
    let cmvLeft = cmv;
    let glLeft = gl;
    let uLeft = baseU;
    parts.forEach((p, pi) => {
      const own = buckets.filter((x) => x.part === p);
      const last = pi === parts.length - 1;
      const rr = p ? preRule! : rule;
      const r: TaxPositionRecord = pi ? { ...base0, lotDetail: [] } : rec;
      let ltU = 0; let stU = 0; let unk = 0; let lockU = 0; let pu = 0;
      let ltG: number | null = null; let stG: number | null = null; let unkG: number | null = null; let lockG: number | null = null;
      if (costScale !== null) { ltG = 0; stG = 0; unkG = 0; lockG = 0; }
      for (const x of own) {
        const gain = costScale !== null ? x.u * per - x.costRaw * costScale : null;
        if (x.bucket === 'long') { ltU += x.u; if (gain !== null) ltG! += gain; }
        else if (x.bucket === 'short') { stU += x.u; if (gain !== null) stG! += gain; }
        else { unk += x.u; if (gain !== null) unkG! += gain; if (x.bucket === 'locked') { lockU += x.u; if (gain !== null) lockG! += gain; } }
        if (r.oldest === null || x.day < r.oldest) r.oldest = x.day;
        if (r.newest === null || x.day > r.newest) r.newest = x.day;
        if (x.gf) r.gfLots++;
        pu += x.u;
        r.lotDetail.push({ day: x.day, units: x.u, bucket: x.bucket, value: x.u * per, cost: costScale !== null ? x.costRaw * costScale : null, grandfathered: x.gf });
      }
      if (parts.length > 1) {
        // TX-02: each part carries its own units, CMV and gain; the last takes the remainder.
        r.splitPart = p ? 'pre-2023' : 'from-2023';
        r.cmv = last ? cmvLeft : pu * per;
        cmvLeft -= r.cmv;
        if (gl !== null) { r.gain = last || ltG === null ? glLeft : ltG + stG! + unkG!; glLeft = glLeft! - r.gain!; }
        if (!amtMode) { r.baseUnits = last ? uLeft : pu; uLeft = uLeft! - r.baseUnits!; r.fifoUnits = pu / scale; }
        r.lots = own.length;
      }
      r.taxRule = rr.inst;
      r.lt = { cmv: ltU * per, gain: ltG };
      r.st = { cmv: stU * per, gain: stG };
      r.unclassified = { cmv: unk * per, gain: unkG };
      r.unclassifiedGain = unkG;
      r.locked = rr.lockMonths ? { cmv: lockU * per, gain: lockG } : null;
      if (own.length && own.every((x) => x.bucket === 'locked')) r.status = 'locked';
      out.positions.push(r);
    });
  }
  return out;
}

/** The contract's TaxPosition (model/tax.ts) for a record whose gains are all known; null otherwise. */
export function toTaxPosition(r: TaxPositionRecord): TaxPosition | null {
  if (r.gain === null || r.lt.gain === null || r.st.gain === null || r.unclassifiedGain === null) {
    // An unsplit or unreconciled record carries its gain in `unclassified`; a fund-level record in `fundLevel`.
    if (r.gain === null) return null;
    if (r.status === 'ok' || r.status === 'locked') return null;
  }
  return {
    holdingId: r.holdingId, clientId: r.clientId, splitPart: r.splitPart, taxRule: r.taxRule, status: r.status,
    reason: r.reason, ledger: r.ledger, apportioned: r.apportioned, cmv: r.cmv, gain: r.gain,
    lt: { cmv: r.lt.cmv, gain: r.lt.gain ?? 0 }, st: { cmv: r.st.cmv, gain: r.st.gain ?? 0 },
    unclassifiedGain: r.unclassifiedGain ?? 0, lots: r.lots,
  };
}
