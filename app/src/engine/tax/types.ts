// Tax-engine types for statement lots (NB-M7a S2; design docs/new-build/capital-gains-upload.md §4, §5, §9.1 to §9.3;
// DATA_DICTIONARY §5.5 RealisedGain). Engine-local until `model/tax.ts` lands (I-37, PLAN-03 P2): MOD-04 moves these
// shapes there and the engine switches its imports. Self-contained and serialisable: plain data, no class, no Map, no
// function. Money is in rupees, unrounded (LD-42), as a number or a missing marker (the reader's CgRead<number> shape,
// D6: the model has no rupee unit yet). Dates are day numbers.

import type { DayNumber } from '../../model/value.ts';
import type { MissingStatus } from '../../model/status.ts';
import type { AccountId, ClientId, DistributorId, InstrumentRef } from '../../model/ids.ts';
import type { RowRef } from '../../model/source.ts';
import type { Severity, ValidationResult } from '../../model/validation.ts';
import type { AuditEntry } from '../../model/audit.ts';
import type { CgStatementCells } from '../../ingest/capital-gains.ts';

/** A value read or computed: present, or missing with its status (the reader's CgRead shape). */
export type Read<T> = { kind: 'value'; v: T } | { kind: 'missing'; status: MissingStatus };
/** Rupees, unrounded, or missing. */
export type Money = Read<number>;

export type TaxClass = 'equity-oriented' | 'specified-mf' | 'other-non-equity';
export type TaxSubType = 'none' | 'elss' | 'etf-fof-90-90';
export type LotClass = 'non-taxable-transfer' | 'taxable-transfer' | 'grandfathered' | 'indexed-cost-shown' | 'standard' | 'other';
/** §4: `none` for an exempt lot, a non-taxable transfer or a lot without a computable taxable gain. */
export type CostBasis = 'actual' | 'grandfathered' | 'indexed' | 'none';
export type Term = 'short' | 'long';
export type GainSource = 'statement' | 'derived from transactions';
/** The rate of a lot's rule: a fraction, the person's slab rate, the s.10(38) exemption, or null (to be confirmed). */
export type LotRate = number | 'slab' | 'exempt' | null;

/**
 * Why a lot has no computable taxable gain (it then enters no bucket; the person-year is PARTIAL COVERAGE, §9.3 step 2).
 * 'amount-missing' (Sell Amount, Invested Value or, for the grandfathered formula, Sale Unit blank or invalid) is an
 * addition to the I-37 draft.
 */
export type NotComputed = 'no-valid-key' | 'tax-class-not-set' | 'listed-flag-missing' | 'rule-to-be-confirmed'
  | 'cost-input-missing' | 'outside-rule-table' | 'amount-missing';

/** Financial year by its start year: 2025 is FY 2025-26; from 2026 the label is "Tax year 2026-27". */
export type FyStart = number;

/** Where the lot's tax class came from (§9.1). */
export type TaxClassSource = 'analyst' | 'ninety-ninety' | 'category' | 'statement';
/** Where the listed flag came from (§9.1, TR-16). */
export type ListedSource = 'analyst' | 'etf-name' | 'default-unlisted' | 'missing';

/** A successor lot of a merger event (§5). */
export type SuccessorLink = {
  kind: 'reset' | 'not-reset';
  eventId: string;
  /** successor-not-reset: (S - W) x V / W, the merger gain this lot counts again while computed as stated. */
  doubleCounted: number | null;
  /** successor-not-reset: the re-base the analyst can apply, cost = S x V / W at the event date. */
  rebase: { purchaseDate: DayNumber; cost: number } | null;
  /** True once the analyst's audit entry applies (original date and cost for reset; re-base for not-reset). */
  analystApplied: boolean;
};

/** DATA_DICTIONARY §5.5, one statement lot. Money in rupees, unrounded. */
export type RealisedGain = {
  source: GainSource;
  /** The reader's lot index (CgLot.index): the key of the analyst's lot marks. */
  lotIndex: number;
  at: RowRef;
  /** The InstrumentRef, null until M2 matches the statement's scheme. */
  scheme: InstrumentRef | null;
  schemeLabel: string;
  folio: string | null;
  tagAsset: string | null;
  category: string | null;
  statementAsset: string | null;
  /** The person (§9.3); null = a lot with no person (its own unmatched person). */
  clientId: ClientId | null;
  inReview: boolean;
  accountId: AccountId;
  distributorId: DistributorId | null;
  accountLabel: string | null;
  accountNote: string;
  /** The sale event of §6 (the reader's eventId); a merger event is the merger rows of one sale event (§5). */
  eventId: string;
  saleDate: DayNumber;
  units: Money;
  saleValue: Money;
  salePrice: Money;
  salePriceDerived: boolean;
  purchasePrice: Money;
  purchasePriceDerived: boolean;
  /** As stated, or as the analyst set it (original date of a reset lot; event date of a re-based lot). */
  purchaseValue: Money;
  purchaseDate: Read<DayNumber>;
  /** Sale value minus the lot's cost (as stated, or as the analyst set it): the economic gain. */
  realised: Money;
  /** The part of `realised` in the year's realised total (§4: a non-taxable transfer's gain is left out, unless reset). */
  realisedCounted: Money;
  /** The part of `realised` shown in the year's non-taxable line (non-taxable transfers only, else 0). */
  nonTaxable: number;
  financialYear: FyStart;
  financialYearLabel: string;
  taxClass: Read<TaxClass>;
  taxClassSource: TaxClassSource | null;
  /** Listed on a recognised stock exchange in India; missing for a close-ended non-equity scheme without the flag. */
  listed: Read<boolean>;
  listedSource: ListedSource;
  subType: TaxSubType;
  lotClass: LotClass;
  /** To the sale date, strictly after the anniversary (OD-2); missing when no rule applies. */
  term: Read<Term>;
  /** A deemed short-term row (NE-50AA): short whatever the holding. */
  deemedShort: boolean;
  /** The anniversary that decided the term; null for a deemed short-term row or no rule. */
  anniversary: DayNumber | null;
  /** The rate row of data/owner/tax-rules.json. */
  ruleId: string | null;
  rate: LotRate;
  /** EQ-LT-1: the s.10(38) exempt line (its taxable gain is 0 and a loss on it is ignored in set-off). */
  exempt: boolean;
  costForTax: Money;
  costBasis: CostBasis;
  /** Sale value minus cost for tax; missing with `notComputed` when no rule applies. */
  taxableGain: Money;
  notComputed: NotComputed | null;
  /** NE-LT-1: both legs on signed amounts; the lower tax is chosen (tie, or an indexed loss: the 20% leg). */
  legs: { indexed20: { cost: number; gain: number; tax: number }; actual10: { cost: number; gain: number; tax: number };
    chosen: 'indexed20' | 'actual10' } | null;
  /** The long-term figure beside a lot sold on its anniversary (PD-16 item 2 default, §9.2). */
  anniversaryLongTerm: { ruleId: string; rate: LotRate; costForTax: number; taxableGain: number } | null;
  /** The statement's LTCG plus STCG compared with the taxable gain (gain-differs), when stated. */
  statementGain: number | null;
  /** The statement's term by its split (LTCG or STCG not 0), or null when it shows neither. */
  statementTerm: Term | null;
  successor: SuccessorLink | null;
  duplicateOf: number | null;
  excludedAsRepeat: boolean;
  statement: CgStatementCells;
  /** Validation ids raised on this lot, without the `capital-gains.` prefix (no PAN, folio or amount). */
  flags: string[];
  /** Plain labels shown with the lot (for example "listed flag missing; same figures either way"). */
  labels: string[];
};

/** Analyst inputs per person and year (S3 uses the rates; S2 reads the assessee mark). Each an audit entry; no defaults. */
export type PersonYearInput = {
  clientId: ClientId | null;
  fy: FyStart;
  slabPct: number | null;
  surchargePct: number | null;
  regime: 'old' | 'new' | null;
  /** A minor, an HUF, joint holders or a non-resident (§9.3, TR-13): flagged, not computed differently. */
  assesseeMark: string | null;
};

/**
 * Analyst inputs per scheme (key: schemeKeyOf(schemeLabel)); fy null = every year, a per-year entry wins field by field.
 * `fundHouse` is scheme data (M2), used only for `cross-house-merger`.
 */
export type SchemeInput = {
  schemeKey: string;
  fy: FyStart | null;
  taxClass?: TaxClass;
  listed?: boolean;
  etfFof9090?: boolean;
  closeEnded?: boolean;
  fundHouse?: string;
};

export type MergerAnswer = 'non-taxable' | 'taxable-consolidation' | 'investor-switch';

export type LotMark = {
  lotIndex: number;
  giftOrInheritance?: boolean;
  firstHeldBefore2001?: boolean;
  /** Re-base of a successor-not-reset lot: 'formula' applies the engine's S x V / W at the event date. */
  rebase?: 'formula' | { purchaseDate: DayNumber; cost: number };
  /** The original purchase date and cost of a successor-reset lot. */
  resetOriginal?: { purchaseDate: DayNumber; cost: number };
  /** A per-lot assessee mark (minor, HUF, joint holders, non-resident). */
  assessee?: string;
};

export type TaxInputs = {
  personYear: PersonYearInput[];
  scheme: SchemeInput[];
  mergerAnswers: Array<{ eventId: string; answer: MergerAnswer }>;
  lotMarks: LotMark[];
  /** Q-52 for harvesting (S4): the exemption already used this year per person, when known. */
  exemptionUsed: Array<{ clientId: ClientId; fy: FyStart; amount: number | 'unused-confirmed' }>;
};

/** A validation result of the engine, shaped as the reader's (ruleId `capital-gains.<id>`, decision D-036). */
export type TaxIssue = ValidationResult;

/** The engine-side ids of design §11 that the statement-lot engine (S2) raises, with their severity. */
export const S2_ISSUE_SEVERITY: Readonly<Record<string, Severity>> = {
  'non-taxable-transfers': 'High',
  'assessee-flagged': 'Warning',
  'lot-class-other': 'Warning',
  'merger-taxable': 'Warning',
  'cross-house-merger': 'Warning',
  'successor-reset': 'Warning',
  'successor-not-reset': 'Warning',
  'cost-input-missing': 'Warning',
  'category-unmapped': 'Warning',
  'category-default-to-confirm': 'Warning',
  'usual-bucket-default': 'Warning',
  'tax-class-from-statement': 'Warning',
  'tax-class-not-set': 'Warning',
  'specified-test-missing': 'Warning',
  'listed-flag-missing': 'Warning',
  'tax-class-differs': 'Warning',
  'term-differs': 'Warning',
  'anniversary-sale': 'Warning',
  'after-as-on-date': 'Warning',
  'elss-early-sale': 'Warning',
  'gain-differs': 'Warning',
  'stripping-candidate': 'Warning',
  'rule-to-be-confirmed': 'Warning',
  'outside-rule-table': 'Warning',
  'lot-classes': 'Information',
  'indexed-cost-ignored': 'Information',
  'grandfathered-value-ignored': 'Information',
  'grandfathering-value-not-supplied': 'Information',
  'pre-base-year-cost': 'Information',
  'old-law-choice': 'Information',
};

/** An analyst input the engine did not accept, with the reason named (§5, §9.1: "refused, with the reason named"). */
export type Refusal = { input: 'scheme-class' | 'merger-answer' | 'lot-mark'; ref: string; reason: string };

/** A merger event (§5): the merger-pattern rows of one sale event. */
export type MergerEventResult = {
  eventId: string;
  date: DayNumber;
  schemeLabel: string;
  accountId: AccountId;
  lots: number[];
  answer: MergerAnswer | null;
  taxable: boolean;
  /** 'gate' default by date, or 'answer'. */
  decidedBy: 'default' | 'answer';
  /** The share of the event's realised gain kept in the realised total (units that went to reset lots, §4). */
  keptShare: number;
  /** The successor candidates listed by scheme (successor-reset or successor-not-reset). */
  successors: Array<{ schemeLabel: string; lots: number[] }>;
  crossHouse: boolean;
};

export type RealiseResult = {
  gains: RealisedGain[];
  events: MergerEventResult[];
  issues: TaxIssue[];
  refusals: Refusal[];
  audit: AuditEntry[];
  rulesVersion: string;
};

