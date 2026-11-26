// L2 realised gains and L4 tax roll-ups (contract I-37; docs/DATA_DICTIONARY.md §5.5 `RealisedGain` and §6 paths
// `tax.*`; design docs/new-build/capital-gains-upload.md §4 lot classes, §5 the per-lot computation, §9 the roll-up
// by person and financial year; parity rows E-41 to E-43, E-150, E-156; PD-16; OD-2, OD-15; LD-42). Types only.
//
// Money: a plain `number` money field is rupees, unrounded. A `Value<number>` money field carries unit 'inr'
// (rupees, unrounded) and a price unit 'inr-per-unit' (model/value.ts); Crore stays the basis of every weight.
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
import type { AccountId, ClientId, DistributorId, HoldingId, InstrumentRef } from './ids.ts';
import type { RowRef } from './source.ts';

/** The tax class of a scheme for capital gains. */
export type TaxClass = 'equity-oriented' | 'specified-mf' | 'other-non-equity';
export type TaxSubType = 'none' | 'elss' | 'etf-fof-90-90';
/** The lot classes of design §4. */
export type LotClass =
  | 'non-taxable-transfer' | 'taxable-transfer' | 'grandfathered' | 'indexed-cost-shown' | 'standard' | 'other';
export type CostBasis = 'actual' | 'grandfathered' | 'indexed' | 'none';
export type Term = 'short' | 'long';
export type GainSource = 'statement' | 'derived from transactions';
/**
 * Why a lot has no computable taxable gain (it then enters no bucket; the person-year is PARTIAL COVERAGE).
 * 'amount-missing': the lot's Sell Amount is blank (the reader's `required-cell-blank`); a blank Invested Value is
 * 'cost-input-missing'.
 */
export type NotComputed =
  | 'no-valid-key' | 'tax-class-not-set' | 'listed-flag-missing' | 'rule-to-be-confirmed' | 'cost-input-missing'
  | 'amount-missing' | 'outside-rule-table';

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
  /** Sale value minus actual cost (the economic gain). */
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
  /** NE-LT-1: both legs per lot on signed amounts; the lower is chosen (a tie takes the 20% leg). */
  legs: { indexed20: Value<number>; actual10: Value<number>; chosen: 'indexed20' | 'actual10' } | null;
  /** The anniversary-day long-term figure beside a short-term lot (PD-16 item 2). */
  anniversaryLongTerm: { ruleId: string; taxableGain: number } | null;
  duplicateOf: number | null;
  excludedAsRepeat: boolean;
  /**
   * The statement's cells as read (the reader's `CgStatementCells`, ingest/capital-gains.ts). Typed `unknown` here
   * because that type lives in ingest/ and model/ imports nothing outside model/; a consumer that reads the cells
   * imports the reader's type.
   */
  statement: unknown;
  /** Validation ids raised on this lot (no PAN, folio or amount). */
  flags: string[];
};

/** Analyst inputs, each an audit entry; none has a default. */
export type TaxInputs = {
  personYear: Array<{
    clientId: ClientId | null; fy: FyStart; slabPct: number | null; surchargePct: number | null;
    regime: 'old' | 'new' | null; assesseeMark: string | null;
  }>;
  scheme: Array<{
    schemeKey: string; fy: FyStart | null; taxClass?: TaxClass; listed?: boolean; etfFof9090?: boolean;
    closeEnded?: boolean;
  }>;
  mergerAnswers: Array<{ eventId: string; answer: 'non-taxable' | 'taxable-consolidation' | 'investor-switch' }>;
  lotMarks: Array<{
    lotIndex: number; giftOrInheritance?: boolean; firstHeldBefore2001?: boolean;
    rebase?: { purchaseDate: DayNumber; cost: number }; resetOriginal?: { purchaseDate: DayNumber; cost: number };
  }>;
  /** Q-52 for harvesting: the exemption already used this year per person, when known. */
  exemptionUsed: Array<{ clientId: ClientId; fy: FyStart; amount: number | 'unused-confirmed' }>;
};

/**
 * One rate bucket of a person-year: the gain, the losses set off against it and what stays taxable (rupees).
 * `rate` is a percent number (12.5 means 12.5 %), like `slabPct`, never a fraction; 'slab' means the person's slab rate.
 */
export type Bucket = { ruleId: string; rate: number | 'slab'; gain: number; setOff: number; taxable: number };

/** One person's financial year (DATA_DICTIONARY §6: `tax.fy[y].person[p].*`). */
export type PersonYearTax = {
  clientId: ClientId | null;
  fy: FyStart;
  inReview: boolean;
  realised: number;
  exempt: number;
  nonTaxable: number;
  exemption: { limit: Value<number>; applied: number };
  unabsorbed: { st: number; lt: number };
  buckets: Bucket[];
  estimate: {
    tax: Value<number>; surcharge: Value<number>; cess: Value<number>; total: Value<number>; beforeSurcharge: boolean;
  };
  alternatives: {
    anniversaryLongTerm: Value<number> | null; fy2425OtherOrder: Value<number> | null;
    oldLawYearTotal: Value<number> | null;
  };
  statementSplit: { lt: Value<number>; st: Value<number>; lotsDiffering: number };
  coverage: { lotsNotComputed: number; economicGainNotComputed: number; partial: boolean };
};

/** A family's financial year: each person computed separately, and their sum labelled as such. */
export type FamilyTaxYear = {
  fy: FyStart;
  rulesVersion: string;
  persons: PersonYearTax[];
  /**
   * The persons' figures added up and labelled as such. It has no exemption limit: a family figure is never compared
   * with a per-person limit (DATA_DICTIONARY §6).
   */
  familySum: Omit<PersonYearTax, 'clientId' | 'inReview' | 'buckets' | 'exemption'> & {
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
  reason: string | null;
  /** OD-15: the ledger the lots are kept in, and whether the holding's value was apportioned to them. */
  ledger: 'units' | 'rupees' | null;
  apportioned: boolean;
  cmv: number;
  gain: number;
  lt: { cmv: number; gain: number };
  st: { cmv: number; gain: number };
  unclassifiedGain: number;
  lots: number;
};

/** Tax-loss harvesting for one person. */
export type HarvestResult = {
  clientId: ClientId;
  slabPct: number | null;
  exemptionApplied: 'applied' | 'exemption not applied';
  taxBefore: Value<number>;
  taxAfter: Value<number>;
  saving: Value<number>;
  candidates: HoldingId[];
  usedLosses: { st: number; lt: number };
  unusedLosses: { st: number; lt: number };
  unquantifiedPools: string[];
};
