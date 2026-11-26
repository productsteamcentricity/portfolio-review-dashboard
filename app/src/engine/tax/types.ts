// Tax-engine types for statement lots that the shared contract does not hold (NB-M7a S2; design
// docs/new-build/capital-gains-upload.md §4, §5, §9.1 to §9.3). The shared shapes (RealisedGain, TaxInputs and the
// unions they use) are the contract's, model/tax.ts (I-37); this file keeps only what is the engine's own: the per-lot
// extension of RealisedGain (TaxLot), the sources of the tax facts, the successor link, the merger event, the engine's
// issues and refusals, and the result. Self-contained and serialisable: plain data, no class, no Map, no function.
// Money is in rupees, unrounded (LD-42). Dates are day numbers.

import type { DayNumber, Value } from '../../model/value.ts';
import type { AccountId } from '../../model/ids.ts';
import type { Severity, ValidationResult } from '../../model/validation.ts';
import type { AuditEntry } from '../../model/audit.ts';
import type { RealisedGain, TaxInputs, Term } from '../../model/tax.ts';

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
   * grandfathered formula, Sale Unit or the 31 Jan 2018 price blank or invalid) with `notComputed: 'no-valid-key'`
   * until the contract holds it; 'cost-missing' (Invested Value blank or invalid) with `notComputed:
   * 'cost-input-missing'`. Null for every other reason.
   */
  // TODO(contracts-3): 'amount-missing' joins NotComputed
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
