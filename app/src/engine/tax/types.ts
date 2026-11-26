// Tax-engine types for statement lots that the shared contract does not hold (NB-M7a S2; design
// docs/new-build/capital-gains-upload.md §4, §5, §9.1 to §9.3). The shared shapes (RealisedGain, TaxInputs and the
// unions they use) are the contract's, model/tax.ts (I-37); this file keeps only what is the engine's own: the per-lot
// extension of RealisedGain (TaxLot), the sources of the tax facts, the successor link, the merger event, the engine's
// issues and refusals, and the result; and (S3) the person-year roll-up's extensions of Bucket, PersonYearTax and
// FamilyTaxYear with the person key and label that the contract does not yet hold (contracts-4). Self-contained and
// serialisable: plain data, no class, no Map, no function.
// Money is in rupees, unrounded (LD-42). Dates are day numbers.

import type { DayNumber, Value } from '../../model/value.ts';
import type { AccountId } from '../../model/ids.ts';
import type { Severity, ValidationResult } from '../../model/validation.ts';
import type { AuditEntry } from '../../model/audit.ts';
import type { Bucket, FamilyTaxYear, PersonYearTax, RealisedGain, TaxInputs, Term } from '../../model/tax.ts';

/** The rate of a lot's rule: a fraction, the person's slab rate, the s.10(38) exemption, or null (to be confirmed). */
export type LotRate = number | 'slab' | 'exempt' | null;

/** Where the lot's tax class came from (§9.1). */
export type TaxClassSource = 'analyst' | 'ninety-ninety' | 'category' | 'statement';
/** Where the listed flag came from (§9.1, TR-16). */
export type ListedSource = 'analyst' | 'etf-name' | 'default-unlisted' | 'missing';

/** The contract's analyst inputs, by element (aliases of model/tax.ts TaxInputs, not copies). */
export type PersonYearInput = TaxInputs['personYear'][number];
export type SchemeInput = TaxInputs['scheme'][number];
export type LotMark = TaxInputs['lotMarks'][number];
export type MergerAnswer = TaxInputs['mergerAnswers'][number]['answer'];

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

/** NE-LT-1: each leg's cost, signed gain and tax (the contract's `legs` holds each leg's gain as a Value). */
export type LegDetail = {
  indexed20: { cost: number; gain: number; tax: number };
  actual10: { cost: number; gain: number; tax: number };
  chosen: 'indexed20' | 'actual10';
};

/**
 * One statement lot as the engine returns it: the contract's RealisedGain (DATA_DICTIONARY §5.5), its fields exactly
 * as typed there, and the S2 lines the contract does not carry.
 */
export type TaxLot = RealisedGain & {
  /** The reader's lot index (CgLot.index): the key of the analyst's lot marks. */
  lotIndex: number;
  /** True when the person matches a client of the review. */
  inReview: boolean;
  /** The sale event of §6 (the reader's eventId); a merger event is the merger rows of one sale event (§5). */
  eventId: string;
  /** The Instrument Name tag's asset as read (free text); `tagAsset` holds it only when it is Equity or Debt. */
  tagAssetText: string | null;
  /** The part of `realised` in the year's realised total (§4: a non-taxable transfer's gain is left out, unless reset). */
  realisedCounted: Value<number>;
  /** The part of `realised` shown in the year's non-taxable line (non-taxable transfers only, else 0). */
  nonTaxable: number;
  financialYearLabel: string;
  taxClassSource: TaxClassSource | null;
  listedSource: ListedSource;
  /** A deemed short-term row (NE-50AA): short whatever the holding. */
  deemedShort: boolean;
  /** The anniversary that decided the term; null for a deemed short-term row or no rule. */
  anniversary: DayNumber | null;
  rate: LotRate;
  /** EQ-LT-1: the s.10(38) exempt line (its taxable gain is 0 and a loss on it is ignored in set-off). */
  exempt: boolean;
  /**
   * The precise amount reason behind `notComputed` (MOD-04, 26 Nov 2026): 'amount-missing' (Sell Amount or, for the
   * grandfathered formula, Sale Unit or the 31 Jan 2018 price blank or invalid) with `notComputed: 'amount-missing'`
   * (contracts-3); 'cost-missing' (Invested Value blank or invalid) with `notComputed:
   * 'cost-input-missing'`. Null for every other reason.
   */
  // 'amount-missing' is also the contract's NotComputed since contracts-3; this detail still tells a blank cost apart.
  notComputedDetail: 'amount-missing' | 'cost-missing' | null;
  /** NE-LT-1: each leg's cost, gain and tax, beside the contract's `legs`. */
  legDetail: LegDetail | null;
  /** The rate and cost for tax of `anniversaryLongTerm` (PD-16 item 2), beside it. */
  anniversaryLongTermDetail: { rate: LotRate; costForTax: number } | null;
  /** The statement's LTCG plus STCG compared with the taxable gain (gain-differs), when stated. */
  statementGain: number | null;
  /** The statement's term by its split (LTCG or STCG not 0), or null when it shows neither. */
  statementTerm: Term | null;
  successor: SuccessorLink | null;
  /** Plain labels shown with the lot (for example "listed flag missing; same figures either way"). */
  labels: string[];
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
  gains: TaxLot[];
  events: MergerEventResult[];
  issues: TaxIssue[];
  refusals: Refusal[];
  audit: AuditEntry[];
  rulesVersion: string;
};

// ---------------------------------------------------------------------------------------------------------------
// The person-year roll-up (NB-M7a S3; design §9.3 steps 2 to 8, §10.2, §10.6, §10.7, §11)

/**
 * One rate bucket of a person-year as the roll-up returns it: the contract's Bucket (rate a percent number, or
 * 'slab') and the lines it does not carry. `gain` is the bucket's gross gains (its lots' positive taxable gains); its
 * lots' losses go to the term's loss pool (TR-10), so a loss and a gain at one rate are never netted before the
 * ranking (KA-13). `setOff` is the loss set against the gains; `taxable` is what stays after set-off and the bucket's
 * share of the annual exemption (the tax is taxable x rate).
 */
export type BucketLocal = Bucket & {
  term: Term;
  /** The bucket's gross losses (positive), sent to the term's loss pool. */
  loss: number;
  /** The share of the person's annual exemption applied to this bucket (s.112A or Sec 198 gains only). */
  exemption: number;
  exemptionGroup: 's112a' | 's198' | null;
  surchargeCategory: string | null;
  lots: number[];
  /** Tax on `taxable` at the bucket's rate; null for a slab bucket while the slab rate is not set. */
  tax: number | null;
  /** Surcharge on `tax`, capped for capital gains (§10.7); null while not computed (before surcharge, slab not set). */
  surcharge: number | null;
};

/** One estimate (tax, surcharge, cess and total) as the person-year and each alternative show it. */
export type EstimateLocal = PersonYearTax['estimate'] & {
  /** "before surcharge (rate not set)" or "before surcharge (regime not set)" while a total is before surcharge. */
  surchargeLabel: string | null;
};

/**
 * A person's financial year as the roll-up returns it: the contract's PersonYearTax and the person fields the
 * contract keys by clientId only.
 */
// TODO(contracts-4): personKey and personLabel join PersonYearTax
export type PersonYearTaxLocal = Omit<PersonYearTax, 'buckets' | 'estimate'> & {
  /** The tax person (design §9.3): ingest/capital-gains.ts taxPersonKey ("person:n" or the client id), or "no-person". */
  personKey: string;
  /** The person as shown: the client label, or the labels of a PAN ordinal with "Person n"; "no client label" else. */
  personLabel: string;
  buckets: BucketLocal[];
  estimate: EstimateLocal;
  /** The year's realised and taxable totals are INSUFFICIENT EVIDENCE (an unanswered repeat event, design §6). */
  insufficientEvidence: boolean;
  /** Step 3: the taxable amounts after set-off and the tax are the dash ("slab rate not set"), else null. */
  afterSetOffDash: string | null;
  /** The slab rate used (the analyst's entry, or the named default slabDefaultPct), and where it came from. */
  slab: { pct: number | null; source: 'analyst' | 'default' | 'not set' };
  /** The surcharge rate applied (percent), after the year's maximum; null while before surcharge. */
  surchargeApplied: number | null;
  /** The taxable amount of slab buckets left out of the tax while the slab rate is not set (PARTIAL, step 2). */
  slabTaxableLeftOut: number;
  /** The losses of EQ-LT-1 exempt sales, ignored in set-off (TR-10 (1)). */
  exemptLossIgnored: number;
  /** The lots of the person-year (reader lot indexes); repeats excluded as "once" are left out. */
  lots: number[];
  /** Step 7: the lots whose term or taxable gain differs from the statement's split, by reason. */
  statementDiffers: { term: number; gain: number };
  /** Step 8, each alternative computed in full (the contract's `alternatives` holds each one's tax). */
  alternativesDetail: {
    anniversaryLongTerm: EstimateLocal | null;
    fy2425OtherOrder: EstimateLocal | null;
    oldLawYearTotal: (EstimateLocal & { leg: 'indexed20' | 'actual10' }) | null;
    oldLawLegs: { indexed20: EstimateLocal; actual10: EstimateLocal } | null;
  };
  /** Labels shown with the figures (for example "resident individual assumed", "order not set by the Act"). */
  labels: string[];
};

/** A family's financial year: every person computed separately (unmatched ones too, `inReview` false) and their sum. */
export type FamilyTaxYearLocal = Omit<FamilyTaxYear, 'persons'> & {
  persons: PersonYearTaxLocal[];
  /** The year's realised and taxable totals are INSUFFICIENT EVIDENCE (an unanswered repeat event). */
  insufficientEvidence: boolean;
  /** The person keys added to the family sum (the review's clients); an unmatched person is never added. */
  familyPersons: string[];
};

/** The engine-side ids of design §11 that the roll-up (S3) raises, with their severity (High or Warning by case). */
export const S3_ISSUE_IDS: readonly string[] = ['clients-unmatched'];

export type RollupResult = {
  years: FamilyTaxYearLocal[];
  issues: TaxIssue[];
  audit: AuditEntry[];
};
