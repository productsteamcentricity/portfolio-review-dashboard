// L2 realised gains and L4 tax roll-ups (contract I-37; docs/DATA_DICTIONARY.md §5.5 `RealisedGain` and §6 paths
// `tax.*`; design docs/new-build/capital-gains-upload.md §4 lot classes, §5 the per-lot computation, §9 the roll-up
// by person and financial year; parity rows E-41 to E-43, E-150, E-156; PD-16; OD-2, OD-15; LD-42). Types only.
//
// Money: a plain `number` money field is rupees, unrounded. A `Value<number>` money field carries unit 'inr'
// (rupees, unrounded) and a price unit 'inr-per-unit' (model/value.ts); Crore stays the basis of every weight.
// contracts-4 (28 Nov 2026, items C4-1 to C4-7): a figure that can be missing is a `Value<number>` (NOT AVAILABLE, or
// INSUFFICIENT EVIDENCE in a year with an unanswered repeated-rows question), never a plain 0 (Q-49).
//
// Source of record for the tax rules (I-37):
//   - statement lots (the capital-gains statement of M7a): `data/owner/tax-rules.json`, rule table v1 (design §10,
//     approved 27 Oct 2026, dated from 1 Oct 2004); `RealisedGain.ruleId` and `Bucket.ruleId` name its rows;
//   - holdings, FIFO lots and harvesting (E-41 to E-43): `data/refdata/TAX_RULES.json` (interface I-21, current law,
//     generated from index.html); `TaxPosition.taxRule` names its rows;
//   - an agreement test between them (tests/unit/tax/rules.test.ts): every mutual-fund row of I-21 gives the same
//     rates and holding period as table v1 for a sale in the current tax year; a row with no table-v1 counterpart is
//     listed as out of scope, and a disagreement goes to the financial-domain reviewer. Neither table changes silently.
//
// Known answers: `tests/fixtures/cg-known-answers.json` (design §13.1; known answers only, never code), shaped
//   { version, design: "capital-gains-upload.md §13.4", review, asOn, cases: [{ id ("KA-n" or "H-n"),
//     group: "lots" | "rollup" | "harvest", lots (the generator's lot spec), inputs (a partial TaxInputs),
//     expect: { lots?: [{ ruleId, costForTax, taxableGain, flags }], personYear?: [{ clientId, fy, tax, cess, total,
//     partial }], harvest? }, tolerance: 0.01, note, origin? ("NB-03" on the hand-worked H-n cases) }] },
//   compared to Rs 0.01 on unrounded totals (LD-42).

import type { DayNumber, Value } from './value.ts';
import type { AccountId, ClientId, DistributorId, HoldingId, InstrumentRef, SourceFileId } from './ids.ts';
import type { RowRef } from './source.ts';

/** The tax class of a scheme for capital gains. */
export type TaxClass = 'equity-oriented' | 'specified-mf' | 'other-non-equity';
export type TaxSubType = 'none' | 'elss' | 'etf-fof-90-90';
/** The lot classes of design §4. */
export type LotClass =
  | 'non-taxable-transfer' | 'taxable-transfer' | 'grandfathered' | 'indexed-cost-shown' | 'standard' | 'other';
export type CostBasis = 'actual' | 'grandfathered' | 'indexed' | 'none';
export type Term = 'short' | 'long';
/**
 * Where a realised figure comes from. 'mixed' (C4-5): a family figure that mixes the statement and the derived source
 * across clients; the per-client sources sit on each entry.
 */
export type GainSource = 'statement' | 'derived from transactions' | 'mixed';
/**
 * Why a lot has no computable taxable gain (it then enters no bucket; the person-year is PARTIAL COVERAGE).
 * 'amount-missing': the lot's Sell Amount is blank (the reader's `required-cell-blank`); a blank Invested Value is
 * 'cost-input-missing'. 'derived-not-taxed' (C4-5): a lot derived from the IRR file carries no tax in this build.
 */
export type NotComputed =
  | 'no-valid-key' | 'tax-class-not-set' | 'listed-flag-missing' | 'rule-to-be-confirmed' | 'cost-input-missing'
  | 'amount-missing' | 'outside-rule-table' | 'derived-not-taxed';

/** Financial year by its start year: 2025 is FY 2025-26; from 2026 the label is "Tax year 2026-27". */
export type FyStart = number;

/** One realised lot (DATA_DICTIONARY §5.5). Money in rupees, unrounded. */
export type RealisedGain = {
  source: GainSource;
  /** The statement row, or the IRR redemption row. */
  at: RowRef;
  /** Null until M2 matches the statement's scheme. */
  scheme: InstrumentRef | null;
  schemeLabel: string;
  folio: string | null;
  tagAsset: 'Equity' | 'Debt' | null;
  /** The Instrument Name tag's asset as read (free text); `tagAsset` holds it only when it is Equity or Debt (C4-7). */
  tagAssetText: string | null;
  category: string | null;
  statementAsset: string | null;
  /** The person; null is a lot with no person (its own unmatched person). */
  clientId: ClientId | null;
  accountId: AccountId | null;
  distributorId: DistributorId | null;
  accountLabel: string | null;
  accountNote: string | null;
  saleDate: DayNumber;
  units: Value<number>;
  saleValue: Value<number>;
  salePrice: Value<number>;
  salePriceDerived: boolean;
  purchasePrice: Value<number>;
  purchasePriceDerived: boolean;
  purchaseValue: Value<number>;
  purchaseDate: Value<DayNumber>;
  /**
   * Sale value minus actual cost (the economic gain): sale value minus the lot's cost, as stated or as the analyst set
   * it (a reset or re-based successor lot).
   */
  realised: Value<number>;
  financialYear: FyStart;
  taxClass: Value<TaxClass>;
  listed: Value<boolean>;
  subType: TaxSubType;
  lotClass: LotClass;
  /** To the sale date, long only strictly after the anniversary (OD-2). */
  term: Value<Term>;
  /** The rate row of data/owner/tax-rules.json (table v1). */
  ruleId: string | null;
  costForTax: Value<number>;
  costBasis: CostBasis;
  /** Missing, with `notComputed` set, when no rule applies. */
  taxableGain: Value<number>;
  notComputed: NotComputed | null;
  /**
   * NE-LT-1: both legs per lot on signed amounts, each leg's cost, gain and tax (C4-7); the lower is chosen (a tie takes
   * the 20% leg).
   */
  legs: {
    indexed20: { cost: Value<number>; gain: Value<number>; tax: Value<number> };
    actual10: { cost: Value<number>; gain: Value<number>; tax: Value<number> };
    chosen: 'indexed20' | 'actual10';
  } | null;
  /**
   * The anniversary-day long-term figure beside a short-term lot (PD-16 item 2; C4-1). `rate` is a percent number like
   * `Bucket.rate` (12.5 means 12.5 %), 'slab' for the person's slab rate, or null where no rate can be expressed (the
   * s.10(38) exemption, or not known). The taxable gain and the cost for tax are missing, with the reason, when the
   * long-term row applies but its figure cannot be computed.
   */
  anniversaryLongTerm: {
    ruleId: string; taxableGain: Value<number>; rate: number | 'slab' | null; costForTax: Value<number>;
  } | null;
  duplicateOf: number | null;
  excludedAsRepeat: boolean;
  /**
   * The reader's lot index, the key of `TaxInputs.lotMarks` (C4-7). -1 on a lot derived from transactions: lotMarks
   * apply to statement lots only.
   */
  lotIndex: number;
  /** The statement's sale event (a merger event is the merger rows of one sale event), the key of `mergerAnswers`. */
  eventId: string | null;
  /** True when the person matches a client of the review. */
  inReview: boolean;
  /** The gap of a lot derived from the IRR file (C4-5): its cost and realised gain are missing. Null for statement lots. */
  gap: 'sale-without-price' | 'purchase-without-price' | 'units-beyond-held' | 'after-earlier-gap' | 'transfer-row'
    | 'bonus-row' | 'sale-without-amount' | 'merger-candidate' | null;
  /**
   * The statement's cells as read (the reader's `CgStatementCells`, ingest/capital-gains.ts). Typed `unknown` here
   * because that type lives in ingest/ and model/ imports nothing outside model/; a consumer that reads the cells
   * imports the reader's type.
   */
  statement: unknown;
  /** Validation ids raised on this lot (no PAN, folio or amount). */
  flags: string[];
};

/**
 * Realised gains of one client and financial year, or of the family (`clientId` null) (C4-5). `total`, `st`, `lt` and
 * `unknownTerm` carry PARTIAL through `Value.coverage`. `source` is null only on an entry with no realised figure in the
 * year (no client of the scope has one: `total` missing).
 */
export type RealisedForYear = {
  fy: FyStart; clientId: ClientId | null; source: GainSource | null; total: Value<number>; st: Value<number>;
  lt: Value<number>; unknownTerm: Value<number>; schemesLeftOut: number;
};

/** Analyst inputs, each an audit entry; none has a default. */
export type TaxInputs = {
  /**
   * The slab rate, surcharge, regime and assessee mark of a person-year (C4-2). An entry applies only when both
   * `personKey` and `personSource` equal the person's. An entry whose `personSource` is not the accepted statement's
   * file id is never applied to anyone: it is reported in a Warning (`tax.person-inputs-stale`, counts only), and that
   * person has no entry, so the slab rate is "not set" and the slab dash follows (PD-07). A re-uploaded or reordered
   * statement is a new file id. The `clientId` rows of persons without a PAN (`personSource` null) are matched by
   * client id.
   */
  personYear: Array<{
    clientId: ClientId | null; fy: FyStart; slabPct: number | null; surchargePct: number | null;
    regime: 'old' | 'new' | null; assesseeMark: string | null; personKey: string; personSource: SourceFileId | null;
  }>;
  scheme: Array<{
    schemeKey: string; fy: FyStart | null; taxClass?: TaxClass; listed?: boolean; etfFof9090?: boolean;
    closeEnded?: boolean;
  }>;
  /** The statement's non-taxable transfer events, keyed by `eventId` (not the merger candidates of `switchAnswers`). */
  mergerAnswers: Array<{ eventId: string; answer: 'non-taxable' | 'taxable-consolidation' | 'investor-switch' }>;
  lotMarks: Array<{
    lotIndex: number; giftOrInheritance?: boolean; firstHeldBefore2001?: boolean;
    rebase?: { purchaseDate: DayNumber; cost: number }; resetOriginal?: { purchaseDate: DayNumber; cost: number };
  }>;
  /** Q-52 for harvesting: the exemption already used this year per person, when known. */
  exemptionUsed: Array<{ clientId: ClientId; fy: FyStart; amount: number | 'unused-confirmed' }>;
  /**
   * The analyst's answer to a merger candidate of the IRR file (C4-6). `candidateKey` is the client id, the day, and the
   * sorted list of every scheme key in the candidate (all source schemes and the receiving scheme); it holds no amount
   * and no folio. Matching is exact equality of the whole key only: an answer never matches a candidate whose scheme set
   * is a superset or subset of its own, or the same schemes on another day. An answer whose key matches no candidate in
   * the current files is never applied elsewhere: it is reported in a Warning (`tax.switch-answer-unmatched`, counts
   * only) and kept for the analyst to remove. Until the answers are applied (a later engine change, after the owner
   * answers Q-T5), a candidate with any answer stays a named gap, and the answer is shown as recorded, not applied.
   */
  switchAnswers: Array<{ candidateKey: string; answer: 'merger' | 'switch' }>;
};

/**
 * One rate bucket of a person-year: the gain, the losses set off against it and what stays taxable (rupees).
 * `rate` is a percent number (12.5 means 12.5 %), like `slabPct`, never a fraction; 'slab' means the person's slab rate.
 * `setOff` and `taxable` are missing (NOT AVAILABLE, or INSUFFICIENT EVIDENCE) when they cannot be known (C4-1).
 */
export type Bucket = { ruleId: string; rate: number | 'slab'; gain: number; setOff: Value<number>; taxable: Value<number> };

/** One person's financial year (DATA_DICTIONARY §6: `tax.fy[y].person[p].*`). */
export type PersonYearTax = {
  clientId: ClientId | null;
  /**
   * The tax person (C4-2): "person:n" by first appearance within one statement file, never derived from the PAN in any
   * form; the client id where there is no PAN.
   */
  personKey: string;
  /** "Person n" or the client label. */
  personLabel: string;
  /** The statement file the ordinal belongs to, or null when the key is a client id (no PAN). */
  personSource: SourceFileId | null;
  fy: FyStart;
  inReview: boolean;
  realised: Value<number>;
  exempt: number;
  nonTaxable: number;
  exemption: { limit: Value<number>; applied: Value<number> };
  unabsorbed: { st: Value<number>; lt: Value<number> };
  buckets: Bucket[];
  estimate: {
    tax: Value<number>; surcharge: Value<number>; cess: Value<number>; total: Value<number>; beforeSurcharge: boolean;
  };
  alternatives: {
    anniversaryLongTerm: Value<number> | null; fy2425OtherOrder: Value<number> | null;
    oldLawYearTotal: Value<number> | null;
  };
  statementSplit: { lt: Value<number>; st: Value<number>; lotsDiffering: number };
  coverage: { lotsNotComputed: number; economicGainNotComputed: Value<number>; partial: boolean };
};

/** A family's financial year: each person computed separately, and their sum labelled as such. */
export type FamilyTaxYear = {
  fy: FyStart;
  rulesVersion: string;
  persons: PersonYearTax[];
  /**
   * The persons' figures added up and labelled as such. It has no exemption limit: a family figure is never compared
   * with a per-person limit (DATA_DICTIONARY §6). A family has no person key (C4-2).
   */
  familySum: Omit<PersonYearTax, 'clientId' | 'personKey' | 'personLabel' | 'personSource' | 'inReview' | 'buckets' | 'exemption'> & {
    label: 'sum of separate computations';
  };
};

/** Holdings path (E-41 to E-43): one record per base holding, or per part of a split Specified holding. */
export type TaxPosition = {
  holdingId: HoldingId;
  clientId: ClientId | null;
  splitPart: 'pre-2023' | 'from-2023' | null;
  /** The I-21 TAX_RULES instrument row; null when unmapped. */
  taxRule: string | null;
  status: 'ok' | 'unmapped' | 'unreconciled' | 'not-split' | 'fund-level' | 'locked';
  /**
   * Why the holding is not split, by kind (C4-3), else null; the reason text names any date. 'periods-not-in-table'
   * covers both holding periods before 23 Jul 2024 and the per-class gate of round 4. The other reasons keep `status`
   * and `reason`.
   */
  notSplitKind: 'merger-candidate' | 'transfer-row' | 'bonus-row' | 'apportion' | 'periods-not-in-table' | null;
  reason: string | null;
  /** OD-15: the ledger the lots are kept in, and whether the holding's value was apportioned to them. */
  ledger: 'units' | 'rupees' | null;
  apportioned: boolean;
  cmv: number;
  /** The gains are missing where not known (a blank invested value, KI-007; a holding not split), never 0 (C4-3). */
  gain: Value<number>;
  lt: { cmv: number; gain: Value<number> };
  st: { cmv: number; gain: Value<number> };
  unclassifiedGain: Value<number>;
  /** Neither long nor short: locked lots, lots without a holding period, and every unsplit or unreconciled amount. */
  unclassified: { cmv: number; gain: Value<number> };
  /** The part inside the ELSS lock-in; null without a lock-in. */
  locked: { cmv: number; gain: Value<number> } | null;
  /** A Category III AIF: its CMV and gain are at fund level. */
  fundLevel: boolean;
  /** Units the IRR history sells beyond the units its earlier purchases hold, on the unit ledger; null when none. */
  oversoldUnits: number | null;
  /** This holding's trades after the as-on date (left out), trades without a price, and rows with no known type. */
  counts: { laterTrades: number; noPrice: number; untyped: number };
  product: string | null;
  asset: string | null;
  lots: number;
};

/** Tax-loss harvesting for one person (C4-4). */
export type HarvestResult = {
  /** Null: the holdings without a client label, which form one person (PD-44). */
  clientId: ClientId | null;
  slabPct: number | null;
  exemptionApplied: 'applied' | 'exemption not applied';
  /** Missing with `ratesMissing` as the reason when that is set. */
  taxBefore: Value<number>;
  taxAfter: Value<number>;
  saving: Value<number>;
  candidates: HoldingId[];
  /** Null when no harvest is worked; under the slab dash they are shown (they do not depend on the order of set-off). */
  usedLosses: { st: number | null; lt: number | null };
  unusedLosses: { st: number | null; lt: number | null };
  unquantifiedPools: string[];
  /** Why no harvest is worked, else null. */
  notWorked: string | null;
  /** The slab dash and its reason, else null. */
  afterSetOffDash: string | null;
  exemption: {
    limit: Value<number>; used: Value<number>; source: 'statement' | 'analyst' | 'analyst-confirmed-unused' | null;
    reason: string | null;
  };
  candidateDetail: Array<{ holdingId: HoldingId; ltLoss: number; stLoss: number }>;
  harvestableLoss: number | null;
  gainUnknown: number;
  unreconciled: number;
  /**
   * The PARTIAL labels, including before surcharge and cess, the as-on terms, all gains assumed sold this year, and what
   * is left out.
   */
  labels: string[];
  /** Why the rates as on the as-on date are not in the table (the per-class gate included), else null. */
  ratesMissing: string | null;
};
