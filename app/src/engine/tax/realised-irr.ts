// Realised gains derived from the IRR file's fund flows (NB-M7a S5; parity rows E-141 engine half and E-42; architecture
// §6.7: "else IRR redemptions matched FIFO ('derived from transactions')"; DATA_DICTIONARY §5.5 `RealisedGain.source`;
// design docs/new-build/capital-gains-upload.md §8; AC-18 "without one, gains labelled 'derived from transactions'";
// OD-2, OD-16; Q-49).
//
// Per client and instrument (the key lots.ts uses: the IRR client id and the normalised instrument name), the trades in
// day order (file order within a day) run through one FIFO ledger of UNITS, reusing the S4a ledger step (lots.ts
// `consumeFifo`, `tradePriceOf`, `isTradeFlow`):
//   - a purchase (direction 'in', OD-16) with a price is a lot of |amount| / price units at that price; one without a
//     price is a lot whose units are not known;
//   - a transfer in, stock in or demerger in, and a bonus row, is a lot whose cost and date are not known (Gate B of
//     aa67a45, B1 and B2): the row is dated and valued by the transfer or allotment, not by the original purchase, and how
//     the IRR export writes such rows is not confirmed (owner question), so it is never costed at its amount;
//   - a sale (direction 'out': redemption, SWP, switch out, STP out) with a price sells |amount| / price
//     units, oldest lots first; each lot it reaches gives one derived lot: the purchase date, the cost (units taken x
//     the buy price, which is the buy row's amount share), the sale value share (|amount| x units taken / units sold),
//     realised = sale share minus cost, the financial year of the sale (ingest/capital-gains.ts `financialYearOf`) and
//     the term by the law at the SALE date (R2 B-2): the joined holding's I-21 class (classify.ts `classifyHolding` at
//     the sale date) mapped to the dated tax-rule table v1 key (`V1_OF_I21`: tax class by the fund type's dated
//     default, listed flag, sub-type) and the row of `rules.ts ruleFor` for the purchase and sale dates (strictly after
//     the anniversary, OD-2). The term is not known when no holding joins, when the class is not a mutual-fund unit
//     table v1 covers (shares, bonds, AIF, REIT, SGB, crypto, PMS and the like: never a guess), or when table v1 gives
//     the fund type no class for the lot's dates;
//   - untyped and unrecognised rows (OD-16) and valuation rows move no lot; they are counted (the type labels named);
//   - a trade dated after `asOn`, when given, is left out and counted (D-040 a).
// Never a guessed figure (Q-49): a gap gives a derived lot whose cost and realised gain are missing, with the gap named:
//   - 'sale-without-price': a sale without a price (its units are not known);
//   - 'purchase-without-price': the sale reaches a purchase without a price (its units are not known);
//   - 'units-beyond-held': the sale sells more units than the earlier purchases hold (beyond UNITS_TOLERANCE);
//   - 'transfer-row': a transfer out (a change of folio or account, or a gift, is not a sale, s.47(iii)), or any sale
//     after a transfer in, stock in or demerger in entered the ledger (B1; delta review N-1: the transferred units'
//     original acquisition date is not known, so the FIFO order is not known);
//   - 'bonus-row': the sale reaches a bonus lot (bonus units have nil cost by law; the export's row is not confirmed, B2);
//   - 'sale-without-amount': a sale row whose amount is 0 (it moves no units we can count, so later sales would take
//     the wrong lots);
//   - 'after-earlier-gap': a sale after any other gap in the same instrument, since which units remain is
//     then not known (an oversell included, R2 B-1: the missing purchases' units would be sold first under FIFO);
//   - 'merger-candidate' (round 2c, MOD-05's merger condition): the switch out of a merger candidate (lots.ts
//     `mergerCandidates`: within one client and day, the switch outs that empty scheme A, or leave A not known after its
//     last trade, paired by the day's sums with the switch ins to exactly one other scheme B; one row or several,
//     financial review V1, V2), with no sale value; and every sale of B after the candidate's switch in,
//     whose cost and date then carry over from A (a merger is not a sale, s.47(xviii)) and are not in the IRR file. It
//     takes precedence over the other gaps of the row. The lots the ordinary-switch rule gives for the row are kept on the
//     gap lot (`asSwitch`), never counted: reconcile.ts uses them only where the statement shows the merger, so its
//     existing merger handling is unchanged. Without a statement no gain is computed on a candidate.
// TR-21 (bonus stripping, s.94(8); Gate B of 5c9ae0a F2): a computed loss is flagged 'stripping-candidate' when some bonus
// row's date b of the instrument has b minus 3 months <= purchase <= b < sale <= b plus 9 months (calendar months, clamped
// to the month end as rules.ts `anniversaryOf`). The IRR file has no record date, so the bonus row's date stands for it.
// Output: the engine-local DerivedLot (the contract's RealisedGain with `source: 'derived from transactions'` and the
// lines the contract does not hold), and per scheme and financial year the totals. Derived lots carry no tax
// computation in S5: the tax class, rule and taxable gain are missing (notComputed 'derived-not-taxed', contracts-4
// C4-5). A derived lot has lotIndex -1 (lotMarks apply to statement lots only), eventId and tagAssetText null, and
// inReview true when its client has a holding in the base file (true when no holdings are given; C4-7).
// Money in rupees, unrounded (LD-42). Pure. Messages carry counts and type labels only: never a client, folio or amount.

import type { Holding } from '../../model/holding.ts';
import type { Transaction, TransactionKind } from '../../model/transactions.ts';
import type { RealisedGain, TaxClass, Term } from '../../model/tax.ts';
import type { ClientId, HoldingId, SourceFileId } from '../../model/ids.ts';
import type { RowRef } from '../../model/source.ts';
import type { DayNumber, Provenance, Value } from '../../model/value.ts';
import type { ValidationResult } from '../../model/validation.ts';
import { STATUS } from '../../model/status.ts';
import { financialYearOf } from '../../ingest/capital-gains.ts';
import { keyOf, normaliseLabel } from '../ids.ts';
import { missing, present } from '../value.ts';
import type { HoldingJoin } from '../returns/irr-tree.ts';
import { matcherJoin } from '../returns/scope.ts';
import { dayToYmd, ymdToDay } from '../dates.ts';
import { BONUS_KINDS, TRANSFER_IN_KINDS, UNITS_TOLERANCE, consumeFifo, isTradeFlow, mergerCandidates, tradePriceOf } from './lots.ts';
import { INST, TAX_RULES_I21, classifyHolding, i21ByInst, isListedEtf } from './classify.ts';
import type { ClassifyContext, I21Row } from './classify.ts';
import { TAX_RULES_V1, anniversaryOf, ruleFor } from './rules.ts';
import type { DayWindow, SubType, TaxRuleTable } from './rules.ts';

/** Units sold beyond the units held up to this many are rounding (lots.ts; re-exported here, where S5 introduced it). */
export { UNITS_TOLERANCE };

export const DERIVED_SOURCE = 'derived from transactions' as const;

/** Why a derived lot's cost and realised gain are not computed (the contract's RealisedGain.gap, C4-5). */
export type DerivedGap = NonNullable<RealisedGain['gap']>;

export const DERIVED_GAPS: readonly DerivedGap[] = ['sale-without-price', 'purchase-without-price', 'units-beyond-held', 'transfer-row', 'bonus-row',
  'sale-without-amount', 'after-earlier-gap', 'merger-candidate'];

const GAP_TEXT: Readonly<Record<DerivedGap, string>> = {
  'sale-without-price': 'a sale without a price: the units it sold are not known',
  'purchase-without-price': 'the sale reaches a purchase without a price: the units of that purchase are not known',
  'units-beyond-held': 'the sale sells more units than the earlier purchases in the IRR file hold',
  'transfer-row': 'a transfer out of a folio or account, or a gift, is not a sale, and a transfer in, stock in or demerger in is dated and valued by the transfer: what cost and date carry over, and so the order later sales take units in, is not known',
  'bonus-row': 'the sale reaches bonus units: bonus units have nil cost by law, and how the IRR file writes a bonus row is not confirmed',
  'sale-without-amount': 'a sale row with an amount of 0: the units it sold are not known',
  'after-earlier-gap': 'an earlier gap in this scheme leaves the units remaining not known',
  'merger-candidate': 'a switch pair that looks like a scheme merger (the whole of one scheme switched into one other scheme on the same day for the same amount) moved these units, and the IRR file does not say whether it was a merger: a merger is not a sale (s.47(xviii)) and cost and date carry over, so no gain is computed until the analyst confirms it',
};

/** TR-21 (s.94(8)): units bought within this many months before the record date... */
export const STRIPPING_MONTHS_BEFORE = 3;
/** ...and sold within this many months after it. */
export const STRIPPING_MONTHS_AFTER = 9;

/** The day N calendar months before a day, clamped to the month end (rules.ts `anniversaryOf` run backwards). */
export function monthsBefore(day: DayNumber, months: number): DayNumber {
  const { y, m, d } = dayToYmd(day);
  const index = y * 12 + (m - 1) - months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  const firstOfNext = month === 12 ? ymdToDay(year + 1, 1, 1) : ymdToDay(year, month + 1, 1);
  if (firstOfNext === null) throw new Error(`monthsBefore: year ${year} is out of range`);
  return ymdToDay(year, month, Math.min(d, dayToYmd(firstOfNext - 1).d))!;
}

/**
 * The s.94(8) window of TR-21 (Gate B of 5c9ae0a, F2): b minus 3 months <= purchase <= b < sale <= b plus 9 months, with
 * b the bonus record date; the IRR file has no record date, so the bonus row's date stands for b.
 */
export function inStrippingWindow(purchaseDay: DayNumber, bonusDay: DayNumber, saleDay: DayNumber): boolean {
  return monthsBefore(bonusDay, STRIPPING_MONTHS_BEFORE) <= purchaseDay && purchaseDay <= bonusDay
    && bonusDay < saleDay && saleDay <= anniversaryOf(bonusDay, STRIPPING_MONTHS_AFTER);
}

// ---------------------------------------------------------------------------------------------------------------
// The term of a derived lot by the law at its sale date (R2 B-2)

/** Units bought from this day can be Specified (s.50AA, now s.76); for units bought before it the two rows coincide. */
const SPECIFIED_FROM: DayNumber = ymdToDay(2023, 4, 1)!;
/** TR-18 (table v1 keyValidity): the 90/90 ETF fund of funds is equity-oriented for sales from this day, other before. */
const FOF_9090_EQUITY_FROM: DayNumber = ymdToDay(2018, 4, 1)!;

/**
 * How an I-21 class (a mutual-fund row) reads as a table v1 key: the fund type of table v1 `fundTypes` whose dated
 * step-2 default gives the tax class at the lot's dates (null: the 90/90 rule of TR-18), the listed flag ('etf': the
 * joined holdings are all listed ETFs, classify.ts `isListedEtf`) and the sub-type. `neverEquity`: a fund type with no
 * default that is never equity-oriented, so units bought before SPECIFIED_FROM take the other non-equity rows (the
 * Specified rows are the same lines for them). The rows follow the I-21 agreement test (tests/unit/tax/rules.test.ts).
 * Classes not listed here (shares, bonds, AIF, REIT, InvIT, SGB, G-Secs, MLD, crypto, PMS, SIF, foreign shares) are
 * outside table v1: their term is not known.
 */
export type V1ClassOf = { fundType: string | null; listed: boolean | 'etf'; subType: SubType; neverEquity?: true };

const DEBT_PRE_2023 = 'Debt MF bought before 1 Apr 2023';
const CONSERVATIVE_PRE_2023 = 'Hybrid MF (conservative) bought before 1 Apr 2023';

export const V1_OF_I21: Readonly<Record<string, V1ClassOf>> = {
  [INST.equityMf]: { fundType: 'domestic-equity', listed: false, subType: 'none' },
  [INST.equityEtf]: { fundType: 'domestic-equity', listed: true, subType: 'none' },
  [INST.elss]: { fundType: 'domestic-equity', listed: false, subType: 'elss' },
  [INST.hybridEquity]: { fundType: 'aggressive-hybrid', listed: false, subType: 'none' },
  [INST.etfFof9090]: { fundType: null, listed: false, subType: 'etf-fof-90-90' },
  [INST.debtMf]: { fundType: 'debt-funds', listed: 'etf', subType: 'none' },
  [DEBT_PRE_2023]: { fundType: 'debt-funds', listed: 'etf', subType: 'none' },
  [INST.hybridSpecified]: { fundType: 'conservative-hybrid', listed: false, subType: 'none' },
  [CONSERVATIVE_PRE_2023]: { fundType: 'conservative-hybrid', listed: false, subType: 'none' },
  [INST.hybridGeneral]: { fundType: 'balanced-hybrid', listed: false, subType: 'none' },
  [INST.fofGeneral]: { fundType: 'fof-active-equity', listed: false, subType: 'none', neverEquity: true },
  [INST.global]: { fundType: 'international-fof', listed: false, subType: 'none' },
  [INST.intlEtf]: { fundType: 'international-etf', listed: true, subType: 'none' },
  [INST.commodityEtf]: { fundType: 'gold-silver-etf', listed: true, subType: 'none' },
  [INST.commodityMf]: { fundType: 'gold-silver-fof', listed: false, subType: 'none' },
};

const inDays = (d: DayNumber, w: DayWindow): boolean => (w.from === null || d >= w.from) && (w.to === null || d <= w.to);

/** The table v1 key of a lot of an I-21 class at its purchase and sale dates, or why there is none. */
export function v1KeyOf(inst: string, listedEtf: boolean, purchaseDay: DayNumber, saleDay: DayNumber, table: TaxRuleTable = TAX_RULES_V1):
  { key: { taxClass: TaxClass; listed: boolean; subType: SubType } } | { why: string } {
  const m = V1_OF_I21[inst];
  if (m === undefined) return { why: `the dated tax-rule table v1 covers mutual-fund units only, and the class "${inst}" is not one` };
  const listed = m.listed === 'etf' ? listedEtf : m.listed;
  if (m.fundType === null) {
    return { key: { taxClass: saleDay < FOF_9090_EQUITY_FROM ? 'other-non-equity' : 'equity-oriented', listed, subType: m.subType } };
  }
  const ft = table.fundTypes.get(m.fundType);
  if (ft === undefined) return { why: `table v1 has no fund type "${m.fundType}"` };
  const windows = ft.stepTwoDefault ?? [];
  const w = windows.find((x) => inDays(saleDay, x.sale) && (x.purchaseFrom === null || purchaseDay >= x.purchaseFrom));
  if (w) return { key: { taxClass: w.taxClass, listed, subType: w.subType ?? m.subType } };
  if (!windows.length && m.neverEquity && purchaseDay < SPECIFIED_FROM) return { key: { taxClass: 'other-non-equity', listed, subType: m.subType } };
  return { why: `table v1 gives the fund type "${ft.label}" no class for these dates (the class depends on what the scheme held)` };
}

/** One derived lot: the contract's RealisedGain (source 'derived from transactions') and the lines it does not hold. */
export type DerivedLot = RealisedGain & {
  source: typeof DERIVED_SOURCE;
  /** The client and instrument key (lots.ts: client id and normalised instrument name). */
  instrumentKey: string;
  instrumentName: string | null;
  clientLabel: string;
  /** The sale's kind (OD-16 out kinds). */
  saleKind: TransactionKind;
  /** The row is a sale: not a transfer out and not a row with an amount of 0 (reconcile.ts item 8, delta review N-5). */
  saleRow: boolean;
  /** The purchase row the lot came from; null for a gap lot that reached no purchase. */
  buyAt: RowRef | null;
  buyKind: TransactionKind | null;
  /** The joined holdings' one I-21 class at the sale date; null when no holding joins or they have no one class. */
  i21: string | null;
  /** The table v1 row (rules.ts ruleFor) whose holding period gave the term at the sale date; null when not known. */
  termRule: string | null;
  financialYearLabel: string;
  /**
   * Round 2c: on a 'merger-candidate' gap lot, its role (the candidate's switch out, or a sale of the scheme switched
   * into, on or after the candidate's switch in, until its units come back to 0), the candidate's day, and the partner
   * schemes' instrument keys (for a switch out, scheme B; for a successor, its source scheme A, or every source of a
   * many-into-one merger: financial review V3, Gate B of 4001f8f B1); null otherwise.
   */
  mergerCandidate: { role: 'switch-out' | 'successor'; day: DayNumber; partnerKeys: readonly string[] } | null;
  /**
   * Round 2c: on a 'merger-candidate' gap lot, the lots the ordinary-switch rule gives for the row (as before round 2c).
   * Never counted in a figure: reconcile.ts uses them only where the statement shows the merger. Null otherwise.
   */
  asSwitch: DerivedLot[] | null;
};

/** The derived totals of one client's instrument in one financial year (rupees). */
export type DerivedSchemeYear = {
  clientId: ClientId;
  clientLabel: string;
  instrumentKey: string;
  instrumentName: string | null;
  fy: number;
  fyLabel: string;
  lots: number;
  /** Lots with a gap, by gap. */
  gapLots: number;
  gaps: Partial<Record<DerivedGap, number>>;
  /** The sale value of the computed lots, and of every lot whose sale value is known. */
  saleValueComputed: number;
  /** Realised over the computed lots; PARTIAL COVERAGE (coverage below 1) with gap lots; missing when every lot has one. */
  realised: Value<number>;
  realisedComputed: number;
  st: number;
  lt: number;
  /** Realised of computed lots whose term is not known (no joined holding, a class outside table v1, no class at the dates). */
  unknownTerm: number;
  holdingIds: HoldingId[];
};

export type DerivedCounts = {
  flows: number;
  /** Trades (direction in or out) used. */
  trades: number;
  sales: number;
  purchases: number;
  valuation: number;
  /** OD-16: untyped rows, and each unrecognised type label with its rows; counted, not used. */
  untyped: number;
  unrecognised: Array<{ label: string; rows: number }>;
  /** Trades after `asOn`, left out. */
  later: number;
  salesWithoutPrice: number;
  purchasesWithoutPrice: number;
  /** Instruments with sales whose term is not known (no joined holding, or no one class). */
  instrumentsTermUnknown: number;
  /** Instruments with sales whose class is not a mutual-fund unit table v1 covers: their term is not known (R2 B-2). */
  instrumentsOutsideTable: number;
  /** Switch pairs that look like a scheme merger (round 2c, lots.ts `mergerCandidates`). */
  mergerCandidates: number;
};

/** One client's instrument as the derivation saw it (all instruments with trades, sold or not). */
export type DerivedInstrument = {
  clientId: ClientId;
  clientLabel: string;
  instrumentKey: string;
  instrumentName: string | null;
  holdingIds: HoldingId[];
  i21: string | null;
};

export type DerivedRealised = {
  source: typeof DERIVED_SOURCE;
  lots: DerivedLot[];
  schemeYears: DerivedSchemeYear[];
  instruments: DerivedInstrument[];
  counts: DerivedCounts;
  issues: ValidationResult[];
  /**
   * The clients of the base file's holdings (the review's clients, OD-4; as engine/returns/scope.ts), for
   * reconcile.ts realisedForYear, which leaves IRR clients outside them out of the family figure (R2 S-5). Null when no
   * holdings were given: the review's clients are then not known and nothing is left out.
   */
  baseClients: ClientId[] | null;
};

export type DeriveOptions = {
  /** The base file's holdings, for the term (classification) and the review's clients; without them every term is not known. */
  holdings?: readonly Holding[];
  /** The holdings join; defaults to the returns' join (engine/returns/scope.ts matcherJoin), as lots.ts. */
  join?: HoldingJoin;
  /** Trades after this day are left out and counted (D-040 a); absent: none left out. */
  asOn?: DayNumber;
  /** Reference-data facts for the classification of one holding (as lots.ts). */
  classifyContext?: (h: Holding) => Omit<ClassifyContext, 'refDay'>;
  /** The I-21 table; defaults to data/refdata/TAX_RULES.json. */
  table?: readonly I21Row[];
  /** The dated tax-rule table for the term at the sale date; defaults to table v1 (data/owner/tax-rules.json). */
  rules?: TaxRuleTable;
  /** The IRR file's source id, for the validation results' scope (default: the first flow's). */
  sourceId?: SourceFileId;
};

const EPS = 1e-9;

/**
 * A lot of the ledger. `known`: its units and cost are known (a priced purchase). Otherwise `why` names what is not known:
 * 'price' (a purchase without a price), 'transfer' (a transfer in, stock in or demerger in: cost and date not known),
 * 'bonus' (a bonus row: never costed at its amount). A lot not known stops FIFO: a sale reaching it is a gap.
 */
type LedgerLot = { u: number; known: boolean; why: 'price' | 'transfer' | 'bonus' | null; px: number | null; day: DayNumber; at: RowRef; kind: TransactionKind };

const REACHED_GAP: Readonly<Record<'price' | 'transfer' | 'bonus', DerivedGap>> = {
  price: 'purchase-without-price', transfer: 'transfer-row', bonus: 'bonus-row',
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The instrument key of lots.ts: the client id and the normalised instrument name. */
export function derivedInstrumentKey(clientId: ClientId, instrumentName: string | null): string {
  return keyOf([clientId, normaliseLabel(instrumentName)]);
}

/** Realised gains derived from the IRR fund flows by FIFO on the units ledger (see the header). */
export function deriveRealisedGains(fund: readonly Transaction[], opts: DeriveOptions = {}): DerivedRealised {
  const holdings = opts.holdings ?? [];
  const join = opts.join ?? matcherJoin(holdings, fund);
  const byInst = i21ByInst(opts.table ?? TAX_RULES_I21);
  const holdingById = new Map(holdings.map((h) => [h.id, h]));
  // C4-7: a derived lot is of the review when its client has a holding in the base file (all are, with no holdings given).
  const reviewClientIds = opts.holdings ? new Set(holdings.map((h) => h.clientId)) : null;
  const counts: DerivedCounts = {
    flows: fund.length, trades: 0, sales: 0, purchases: 0, valuation: 0, untyped: 0, unrecognised: [], later: 0,
    salesWithoutPrice: 0, purchasesWithoutPrice: 0, instrumentsTermUnknown: 0, instrumentsOutsideTable: 0, mergerCandidates: 0,
  };
  const rules = opts.rules ?? TAX_RULES_V1;
  const sourceId = opts.sourceId ?? fund[0]?.at.sourceId ?? null;

  // 1. Trades in day order (file order within a day), grouped by client and instrument; the rest counted.
  const sorted = fund.map((t, i) => ({ t, i })).sort((a, b) => a.t.day - b.t.day || a.i - b.i).map((x) => x.t);
  const groups = new Map<string, Transaction[]>();
  const used: Transaction[] = [];
  for (const t of sorted) {
    if (t.direction === 'valuation') { counts.valuation++; continue; }
    if (t.kind === 'untyped') { counts.untyped++; continue; }
    if (t.kind === 'unrecognised') {
      const label = t.typeLabel ?? '';
      const e = counts.unrecognised.find((x) => x.label === label);
      if (e) e.rows++; else counts.unrecognised.push({ label, rows: 1 });
      continue;
    }
    if (!isTradeFlow(t)) continue;
    if (opts.asOn !== undefined && t.day > opts.asOn) { counts.later++; continue; }
    counts.trades++;
    if (t.direction === 'in') counts.purchases++; else counts.sales++;
    used.push(t);
    const k = derivedInstrumentKey(t.clientId, t.instrumentName);
    const l = groups.get(k);
    if (l) l.push(t); else groups.set(k, [t]);
  }
  // Round 2c (MOD-05's merger condition; Q-49): the switch pairs that look like a scheme merger.
  const merger = mergerCandidates(used);
  counts.mergerCandidates = merger.pairs;
  // The analyst's answer to a merger candidate is TaxInputs.switchAnswers (contracts-4 C4-6); it is not applied in this
  // build (the owner's Q-T5 first), so every candidate stays a 'merger-candidate' gap without a statement.

  // 2. The ledger of each instrument.
  const lots: DerivedLot[] = [];
  const instruments: DerivedInstrument[] = [];
  for (const [key, trades] of groups) {
    const first = trades[0]!;
    const holdingIds = join(first.clientId, first.instrumentName).filter((id) => holdingById.has(id));
    const joined = holdingIds.map((id) => holdingById.get(id)!);
    /** The I-21 row for a sale day: the joined holdings' one class at that day, or null. */
    const ruleAt = (saleDay: DayNumber): { rule: I21Row; etf: boolean } | null => {
      if (!joined.length) return null;
      const insts = new Set(joined.map((h) => classifyHolding(h, { ...(opts.classifyContext ? opts.classifyContext(h) : {}), refDay: saleDay }).inst));
      if (insts.size !== 1) return null;
      const inst = [...insts][0]!;
      const rule = inst !== null ? byInst.get(inst) ?? null : null;
      return rule ? { rule, etf: joined.every((h) => isListedEtf(h)) } : null;
    };
    const firstSale = trades.find((t) => t.direction === 'out');
    const instRule = firstSale ? ruleAt(firstSale.day) : joined.length ? ruleAt(first.day) : null;
    instruments.push({
      clientId: first.clientId, clientLabel: first.clientLabel, instrumentKey: key, instrumentName: first.instrumentName,
      holdingIds, i21: instRule?.rule.inst ?? null,
    });
    if (firstSale && (instRule === null)) counts.instrumentsTermUnknown++;
    else if (firstSale && V1_OF_I21[instRule!.rule.inst] === undefined) counts.instrumentsOutsideTable++;

    const ledger: LedgerLot[] = [];
    let broken = false;
    // Delta review N-1: once a transfer in, stock in or demerger in enters the ledger, the transferred units' original
    // acquisition date is not known, so the FIFO order is not known: every later sale is 'transfer-row'.
    let afterTransferIn = false;
    // Delta review N-3, F2 (TR-21): the dates of the instrument's bonus rows, each standing for a record date.
    const bonusDays = trades.filter((t) => t.direction === 'in' && BONUS_KINDS.has(t.kind)).map((t) => t.day);
    // Round 2c: the day of a merger candidate's switch in to this instrument and its source schemes' keys (financial
    // review V3; Gate B of 4001f8f B1), from the switch in until the instrument's units come back to 0 (null otherwise).
    let successor: { day: DayNumber; partnerKeys: readonly string[] } | null = null;
    /** Units of the instrument after the trades so far; null once a trade's units are not known (Gate B of 4001f8f). */
    let heldUnits: number | null = 0;
    for (const t of trades) {
      const amt = Math.abs(t.amountRupees);
      const px = tradePriceOf(t);
      const rowUnits = px !== null && amt > EPS ? amt / px : null;
      heldUnits = heldUnits === null || rowUnits === null ? null : t.direction === 'in' ? heldUnits + rowUnits : heldUnits - rowUnits;
      if (t.direction === 'in') {
        const from = merger.ins.get(t);
        if (from !== undefined) successor = { day: t.day, partnerKeys: from };
        // B1, B2 (Gate B of aa67a45; Q-49): a transfer in, stock in, demerger in or bonus row is a lot not known, never
        // costed at its amount or dated by the row, until the owner rules how the IRR export writes such rows.
        const why = TRANSFER_IN_KINDS.has(t.kind) ? 'transfer' as const : BONUS_KINDS.has(t.kind) ? 'bonus' as const : px === null ? 'price' as const : null;
        if (px === null) counts.purchasesWithoutPrice++;
        if (why === 'transfer') afterTransferIn = true;
        ledger.push({ u: px === null ? 0 : amt / px, known: why === null, why, px: why === null ? px : null, day: t.day, at: t.at, kind: t.kind });
        continue;
      }
      if (px === null) counts.salesWithoutPrice++;
      const fy = financialYearOf(t.day);
      const prov: Provenance = { sources: [t.at.sourceId], method: 'realised gain derived from the IRR file by FIFO on the units ledger (architecture section 6.7)' };
      const ra = ruleAt(t.day);
      const base = (o: {
        units: number | null; sale: number | null; buy: LedgerLot | null; cost: number | null; gap: DerivedGap | null;
      }): DerivedLot => {
        const gapWhy = o.gap !== null ? `not computed: ${GAP_TEXT[o.gap]}` : null;
        const buy = o.buy;
        let term: Value<Term>;
        let termRule: string | null = null;
        if (buy === null || !buy.known) term = missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'no purchase date');
        else if (ra === null) term = missing(STATUS.NOT_AVAILABLE, 'term not known: the scheme joins no holding of the base file with one tax class', prov);
        else {
          // R2 B-2: the law at the sale date (table v1), never today's I-21 holding periods for a past sale.
          const k = v1KeyOf(ra.rule.inst, ra.etf, buy.day, t.day, rules);
          const rr = 'key' in k ? ruleFor(rules, { ...k.key, purchaseDay: buy.day, saleDay: t.day }) : null;
          if (rr === null) term = missing(STATUS.NOT_AVAILABLE, `term not known: ${(k as { why: string }).why}`, prov);
          else if (rr.kind === 'none') term = missing(STATUS.NOT_AVAILABLE, `term not known: ${rr.detail}`, prov);
          else {
            termRule = rr.rule.id;
            const how = rr.deemedShort ? 'deemed short term' : `long strictly after ${rr.holdingMonths} months (OD-2)`;
            term = present(rr.term, 'label', { ...prov, method: `term by the dated tax-rule table v1 row ${rr.rule.id} at the sale date (${how}); I-21 class "${ra.rule.inst}"` });
          }
        }
        const realised: Value<number> = o.cost !== null && o.sale !== null && o.gap === null
          ? present(o.sale - o.cost, 'inr', prov) : missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'cost not known', prov);
        // The purchase date is known for a purchase row; a transfer in or bonus lot is dated by the row, not the purchase.
        const buyDated = buy !== null && (buy.why === null || buy.why === 'price');
        const noTax = missing(STATUS.NOT_AVAILABLE, 'tax not computed on a lot derived from transactions (S5)');
        const flags = o.gap !== null ? ['tax.derived-gaps'] : [];
        // TR-21 (design section 10.4; delta review N-3; F2): a loss on units bought within 3 months before a bonus row and
        // sold within 9 months after it (s.94(8)) is a bonus-stripping candidate, computed normally; the bonus row's date
        // stands for the record date, which the IRR file does not give.
        if (o.gap === null && realised.kind === 'value' && realised.v < 0 && buy !== null && buy.known
          && bonusDays.some((b) => inStrippingWindow(buy.day, b, t.day))) flags.push('stripping-candidate');
        return {
          source: DERIVED_SOURCE, at: t.at, scheme: t.instrument, schemeLabel: t.instrumentName ?? '', folio: t.folio,
          tagAsset: null, category: t.categoryLabel, statementAsset: null, clientId: t.clientId, accountId: null,
          distributorId: t.distributorId, accountLabel: t.accountLabel, accountNote: null, saleDate: t.day,
          units: o.units !== null ? present(o.units, 'units', prov) : missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'units not known', prov),
          saleValue: o.sale !== null ? present(o.sale, 'inr', prov) : missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'no sale value', prov),
          salePrice: px !== null ? present(px, 'inr-per-unit', prov) : missing(STATUS.NOT_AVAILABLE, 'the sale carries no price', prov),
          salePriceDerived: false,
          purchasePrice: buy !== null && buy.px !== null ? present(buy.px, 'inr-per-unit', prov) : missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'no purchase price', prov),
          purchasePriceDerived: false,
          purchaseValue: o.cost !== null && o.gap === null ? present(o.cost, 'inr', prov) : missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'cost not known', prov),
          purchaseDate: buyDated ? present(buy!.day, 'date', prov) : missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'no purchase', prov),
          realised, financialYear: fy.start, financialYearLabel: fy.label,
          taxClass: noTax, listed: noTax, subType: 'none', lotClass: 'standard', term, ruleId: null, costForTax: noTax,
          costBasis: 'none', taxableGain: noTax, notComputed: 'derived-not-taxed', legs: null, anniversaryLongTerm: null,
          duplicateOf: null, excludedAsRepeat: false, statement: null, flags, tagAssetText: null, lotIndex: -1, eventId: null,
          inReview: reviewClientIds === null || reviewClientIds.has(t.clientId),
          instrumentKey: key, instrumentName: t.instrumentName, clientLabel: t.clientLabel, saleKind: t.kind,
          saleRow: t.kind !== 'transfer-out' && amt > EPS,
          buyAt: buy?.at ?? null, buyKind: buy?.kind ?? null, i21: ra?.rule.inst ?? null, termRule, gap: o.gap,
          mergerCandidate: null, asSwitch: null,
        };
      };
      const start = lots.length;
      sale: {
        if (afterTransferIn) {
          // Delta review N-1 (Q-49): the sale's lots and their order are not known after a transfer in.
          lots.push(base({ units: px !== null ? amt / px : null, sale: t.kind === 'transfer-out' || amt <= EPS ? null : amt, buy: null, cost: null, gap: 'transfer-row' }));
          broken = true;
          break sale;
        }
        if (broken) {
          lots.push(base({ units: px !== null ? amt / px : null, sale: t.kind === 'transfer-out' || amt <= EPS ? null : amt, buy: null, cost: null, gap: 'after-earlier-gap' }));
          break sale;
        }
        if (t.kind === 'transfer-out') {
          // B1 (Gate B of aa67a45; Q-49): a transfer out is not a sale; what leaves and what carries over is not known.
          lots.push(base({ units: px !== null ? amt / px : null, sale: null, buy: null, cost: null, gap: 'transfer-row' }));
          broken = true;
          break sale;
        }
        if (amt <= EPS) {
          // Item 7 (Gate B of aa67a45): a sale row with an amount of 0 moves no units we can count.
          lots.push(base({ units: null, sale: null, buy: null, cost: null, gap: 'sale-without-amount' }));
          broken = true;
          break sale;
        }
        if (px === null) {
          lots.push(base({ units: null, sale: amt, buy: null, cost: null, gap: 'sale-without-price' }));
          broken = true;
          break sale;
        }
        const saleUnits = amt / px;
        const firstUnknown = ledger.findIndex((x) => !x.known && x.u >= 0);
        const known = firstUnknown < 0 ? ledger.slice() : ledger.slice(0, firstUnknown);
        const { takes, short } = consumeFifo(known, saleUnits);
        const gapped = short > UNITS_TOLERANCE || (short > 0 && takes.length === 0);
        // Within the tolerance the residue is rounding: the sale value is shared over the units taken.
        const denom = gapped ? saleUnits : saleUnits - short;
        for (const tk of takes) {
          const b = known[tk.index]!;
          lots.push(base({ units: tk.take, sale: amt * tk.take / denom, buy: b, cost: tk.take * b.px!, gap: null }));
        }
        if (gapped) {
          const reached = firstUnknown >= 0 ? ledger[firstUnknown]! : null;
          lots.push(base({ units: short, sale: amt * short / saleUnits, buy: reached, cost: null, gap: reached ? REACHED_GAP[reached.why ?? 'price'] : 'units-beyond-held' }));
          // Any gap breaks the ledger (R2 B-1): an oversell shows purchases (or a bonus or split) missing from the file,
          // and FIFO would sell their remaining units before any later purchase, so no later sale's cost is known.
          broken = true;
        }
        // Lots used up leave the ledger (a lot without known units stays until a gap breaks the ledger).
        for (let i = ledger.length - 1; i >= 0; i--) if (ledger[i]!.known && ledger[i]!.u <= EPS) ledger.splice(i, 1);
      }
      // Round 2c (MOD-05's merger condition; Q-49): the switch out of a merger candidate, or a sale of the scheme switched
      // into after the candidate's switch in, is one 'merger-candidate' gap lot. The ledger above ran as before, so the
      // lots it gave for the row (the ordinary-switch reading) are kept on the gap lot, never counted (`asSwitch`).
      const out = merger.outs.get(t);
      const marker = out !== undefined ? { role: 'switch-out' as const, day: t.day, partnerKeys: [out] }
        : successor !== null ? { role: 'successor' as const, ...successor } : null;
      if (marker !== null) {
        const asSwitch = lots.splice(start);
        const gapSale = marker.role === 'switch-out' || t.kind === 'transfer-out' || amt <= EPS ? null : amt;
        const g = base({ units: px !== null && amt > EPS ? amt / px : null, sale: gapSale, buy: null, cost: null, gap: 'merger-candidate' });
        lots.push({ ...g, mergerCandidate: marker, asSwitch });
      }
      // Gate B of 4001f8f: once the instrument's units are known to be back to 0, the merged units have all been sold, so
      // a later fresh purchase and sale is an ordinary trade again.
      // Round 2c L2 (round 3 item 7): the units left in the ledger within UNITS_TOLERANCE are rounding, cleared at the reset,
      // so no dust lot of the merged units is computed against a later sale.
      if (successor !== null && heldUnits !== null && Math.abs(heldUnits) <= UNITS_TOLERANCE) { successor = null; ledger.length = 0; }
    }
  }

  // 3. Per scheme and financial year.
  const sy = new Map<string, DerivedSchemeYear & { _lots: DerivedLot[] }>();
  const instByKey = new Map(instruments.map((x) => [x.instrumentKey, x]));
  for (const l of lots) {
    const k = keyOf([l.instrumentKey, String(l.financialYear)]);
    let e = sy.get(k);
    if (!e) {
      e = {
        clientId: l.clientId!, clientLabel: l.clientLabel, instrumentKey: l.instrumentKey, instrumentName: l.instrumentName,
        fy: l.financialYear, fyLabel: l.financialYearLabel, lots: 0, gapLots: 0, gaps: {}, saleValueComputed: 0,
        realised: missing(STATUS.NOT_AVAILABLE, 'no lot'), realisedComputed: 0, st: 0, lt: 0, unknownTerm: 0,
        holdingIds: instByKey.get(l.instrumentKey)?.holdingIds ?? [], _lots: [],
      };
      sy.set(k, e);
    }
    e._lots.push(l);
  }
  const schemeYears: DerivedSchemeYear[] = [];
  for (const e of sy.values()) {
    const { _lots, ...row } = e;
    for (const l of _lots) {
      row.lots++;
      if (l.gap !== null) { row.gapLots++; row.gaps[l.gap] = (row.gaps[l.gap] ?? 0) + 1; continue; }
      const r = (l.realised as { v: number }).v;
      row.realisedComputed += r;
      row.saleValueComputed += (l.saleValue as { v: number }).v;
      if (l.term.kind === 'value') { if (l.term.v === 'long') row.lt += r; else row.st += r; } else row.unknownTerm += r;
    }
    row.realised = derivedTotal(row.realisedComputed, row.lots, row.gapLots, sourceOf(_lots));
    schemeYears.push(row);
  }
  schemeYears.sort((a, b) => a.fy - b.fy || (a.clientId < b.clientId ? -1 : a.clientId > b.clientId ? 1 : 0)
    || normaliseLabel(a.instrumentName).localeCompare(normaliseLabel(b.instrumentName)));

  const baseClients = opts.holdings ? [...new Set(holdings.map((h) => h.clientId).filter((c): c is ClientId => c !== null))] : null;
  return { source: DERIVED_SOURCE, lots, schemeYears, instruments, counts, issues: deriveIssues(lots, counts, sourceId), baseClients };
}

function sourceOf(lots: readonly DerivedLot[]): string[] {
  return [...new Set(lots.map((l) => l.at.sourceId))];
}

/** A derived total over lots: PARTIAL COVERAGE (coverage below 1) with gap lots, missing when every lot has one. */
export function derivedTotal(computed: number, lots: number, gapLots: number, sources: string[]): Value<number> {
  const prov: Provenance = { sources, method: 'realised gains derived from transactions, summed' };
  if (gapLots === 0) return present(computed, 'inr', prov);
  const why = `${plural(gapLots, 'derived lot is', 'derived lots are')} not computed (a gap in the IRR file), left out`;
  if (gapLots >= lots) return missing(STATUS.NOT_AVAILABLE, why, prov);
  return present(computed, 'inr', { ...prov, method: `${prov.method}; PARTIAL: ${why}` }, { coverage: Math.min(1 - gapLots / lots, 1 - 1e-9) });
}

function deriveIssues(lots: readonly DerivedLot[], counts: DerivedCounts, sourceId: SourceFileId | null): ValidationResult[] {
  const out: ValidationResult[] = [];
  if (sourceId === null) return out;
  const add = (rule: string, severity: ValidationResult['severity'], message: string, count: number): void => {
    out.push({
      id: `tax.${rule}:${out.length + 1}`, ruleId: `tax.${rule}`, scope: { kind: 'file', sourceId }, message, severity,
      blocksPublication: false, resolution: 'none', status: 'open', decision: 'E-141', count,
    });
  };
  const gaps = lots.filter((l) => l.gap !== null);
  if (gaps.length) {
    const by = DERIVED_GAPS.map((g) => [g, gaps.filter((l) => l.gap === g).length] as const).filter(([, n]) => n > 0)
      .map(([g, n]) => `${n} ${GAP_TEXT[g]}`);
    add('derived-gaps', 'Warning',
      `${plural(gaps.length, 'realised lot derived from the IRR file is', 'realised lots derived from the IRR file are')} not computed and no figure is estimated for ${gaps.length === 1 ? 'it' : 'them'}: ${by.join('; ')}. The scheme and year totals they belong to are PARTIAL COVERAGE.`,
      gaps.length);
  }
  if (counts.mergerCandidates) {
    // Round 2c (MOD-05's merger condition): the question to the analyst, in counts only.
    const n = counts.mergerCandidates;
    add('derived-merger-candidates', 'Warning',
      `${plural(n, 'switch pair looks', 'switch pairs look')} like a scheme merger; a merger is not a sale (s.47(xviii)) and cost and date carry over; confirm ${n === 1 ? 'it' : 'each'} with the analyst. No gain is computed on ${n === 1 ? 'it' : 'them'} without a capital-gains statement.`,
      n);
  }
  const strip = lots.filter((l) => l.flags.includes('stripping-candidate')).length;
  if (strip) {
    // TR-21 (delta review N-3; F2): the statement side's Warning, for the lots derived from the IRR file.
    add('stripping-candidate', 'Warning',
      `${plural(strip, 'loss derived from the IRR file', 'losses derived from the IRR file')}, on units bought within 3 months before a bonus row and sold within 9 months after it (s.94(8)), may fall under bonus stripping; without record-date data ${strip === 1 ? 'it is' : 'they are'} computed normally, and the bonus row's date stands for the record date.`,
      strip);
  }
  if (counts.untyped || counts.unrecognised.length) {
    const named = counts.unrecognised.map((u) => `"${u.label}" (${plural(u.rows, 'row', 'rows')})`);
    const parts = [counts.untyped ? plural(counts.untyped, 'row without a type', 'rows without a type') : null,
      named.length ? `rows of unrecognised types ${named.join(', ')}` : null].filter((x): x is string => x !== null);
    add('derived-unused-rows', 'Information', `Rows of the IRR file not used for the realised gains derived from transactions (OD-16): ${parts.join('; ')}.`,
      counts.untyped + counts.unrecognised.reduce((s, u) => s + u.rows, 0));
  }
  if (counts.instrumentsTermUnknown) {
    add('derived-term-unknown', 'Information',
      `${plural(counts.instrumentsTermUnknown, 'scheme with sales joins', 'schemes with sales join')} no holding of the base file with one tax class, so the term of the realised gains derived for ${counts.instrumentsTermUnknown === 1 ? 'it' : 'them'} is not known.`,
      counts.instrumentsTermUnknown);
  }
  if (counts.instrumentsOutsideTable) {
    add('derived-term-outside-table', 'Information',
      `${plural(counts.instrumentsOutsideTable, 'scheme with sales is', 'schemes with sales are')} of a class the dated tax-rule table v1 does not cover (not a mutual-fund unit), so the term of the realised gains derived for ${counts.instrumentsOutsideTable === 1 ? 'it' : 'them'} is not known.`,
      counts.instrumentsOutsideTable);
  }
  return out;
}
