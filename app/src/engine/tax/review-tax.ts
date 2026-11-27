// The tax of a review in one pure call (M7b, the tax seam, NB-03; PLAN-07 sections 1 and 5, MOD-05's notice PD-68;
// parity rows E-41 to E-43 holdings, lots and harvest, E-141 realised gains and their source, E-155 the statement's
// person-year tax; contracts I-37 model/tax.ts, I-21 data/refdata/TAX_RULES.json, table v1 data/owner/tax-rules.json;
// Q-49, Q-52, D-040 a). It wires today's engine and adds no arithmetic: every figure comes from the module named in the
// step, called the way its own tests call it. The pattern is engine/returns/review-returns.ts (M3a).
//
// Steps (the plan's order; step 5 runs before step 3, since the harvest reads the statement's exemption already used):
//   1. computeTaxLots (lots.ts): the FIFO lots of every holding to the as-on day, from the IRR file's fund flows;
//   2. rollupHoldings (holdings-rollup.ts): by class, product, asset, client and family;
//   3. buildHarvests (harvest.ts): per client and the family sum; the exemption already used (Q-52, exemptionUsedFor) is
//      the analyst's entry, else the statement's person-year `values.exemptionApplied` of the as-on financial year,
//      else not applied and labelled "exemption not applied" (PLAN-07 section 5, as round 2 built it);
//   4. deriveRealisedGains (realised-irr.ts): realised gains derived from the IRR file (the base file's holdings given,
//      so the term and the review's clients are known);
//   5. realiseLots (realised.ts) and rollupPersonYears (rollup.ts): the statement's lots and person-year tax;
//   6. reconcileRealised (reconcile.ts): the statement against the derived gains, per scheme and financial year;
//   7. realisedForYear (reconcile.ts) for each financial year shown: the statement where it covers a client's year,
//      else the derived figure labelled "derived from transactions" (never both inside one client-year);
//   8. repeatEvidence (repeat-evidence.ts): the units evidence for each repeated sale event of the statement.
// Missing inputs (Q-49: never a figure from a missing input). A part that needs an input is a labelled missing value
// (`TaxPart`, a MissingValue naming the input) when the input is absent:
//   - no IRR file: computeTaxLots runs on no flow, so every holding is unreconciled 'noLots' (its CMV and gain
//     unclassified, the class shown); the unrealised long and short gains, the harvest and the derived gains are missing;
//   - no statement: the person-year tax and the repeat evidence are missing; `realisedFY` is the derived figure, labelled;
//   - neither: the holdings' classes only; every other part is missing, `realisedFY` included.
// Financial years shown (PLAN-07 section 5): those with a sale in either input (a statement lot or a derived lot, gap
// lots included), up to the as-on financial year. Issues: every step's ValidationResults, de-duplicated by rule and scope
// (the first kept), ordered by severity then rule, and numbered `${ruleId}:${n}` so each id is unique in the list. The
// readers' own issues stay with their uploads. Pure: no global, no I/O, and the clock only through `opts.now` (the audit
// entries of the statement steps).
//
// TODO(I-41): this output becomes Review.tax and this function is called from computeReview
// TODO(contracts-4): TaxPosition gains become nullable (I-37 notes item 10); `positions[].position` is null until then
//   whenever a gain is unknown, and the engine's TaxPositionRecord carries the figures
// TODO(contracts-4): HarvestResult takes the HarvestLocal lines and a null clientId (item 11)
// TODO(contracts-4): GainSource gets the mixed family source, a 'derived-not-taxed' reason, and tax.realisedFY its
//   unknown term and per-client entries (item 12; reconcile.ts MIXED_SOURCE and RealisedFY meanwhile)
// TODO(contracts-4): PersonYearTax and FamilyTaxYear take personKey, personLabel and the Values of items 8 and 9
//   (types.ts PersonYearTaxLocal and FamilyTaxYearLocal meanwhile)
// TODO(contracts-4): the analyst's answer to a merger candidate (round 2c) needs a TaxInputs field; until then every
//   candidate stays a gap without a statement that shows the merger

import type { Holding } from '../../model/holding.ts';
import type { IrrFileImport } from '../../model/transactions.ts';
import type { FyStart, TaxInputs, TaxPosition } from '../../model/tax.ts';
import type { SourceFileId } from '../../model/ids.ts';
import type { DayNumber, MissingValue, Value } from '../../model/value.ts';
import type { AuditEntry } from '../../model/audit.ts';
import type { ValidationResult } from '../../model/validation.ts';
import { SEVERITIES } from '../../model/validation.ts';
import { STATUS } from '../../model/status.ts';
import type { CgImport } from '../../ingest/capital-gains.ts';
import { financialYearOf as fyLabelled } from '../../ingest/capital-gains.ts';
import { missing } from '../value.ts';
import type { ClassifyContext } from './classify.ts';
import { computeTaxLots, toTaxPosition } from './lots.ts';
import type { TaxLotsResult, TaxPositionRecord } from './lots.ts';
import { rollupHoldings } from './holdings-rollup.ts';
import type { HoldingsTaxRollup } from './holdings-rollup.ts';
import { buildHarvests } from './harvest.ts';
import type { FamilyHarvest, HarvestLocal } from './harvest.ts';
import { deriveRealisedGains } from './realised-irr.ts';
import type { DerivedRealised } from './realised-irr.ts';
import { realiseLots } from './realised.ts';
import { rollupPersonYears } from './rollup.ts';
import type { RollupFamilyYear } from './rollup.ts';
import { realisedForYear, reconcileRealised } from './reconcile.ts';
import type { RealisedFY, RealisedReconciliation, StatementSide } from './reconcile.ts';
import { repeatEvidence } from './repeat-evidence.ts';
import type { RepeatEvidence } from './repeat-evidence.ts';
import { financialYearOf } from './rules.ts';
import type { RealiseResult, Refusal } from './types.ts';

/** A part of the result that needs an input: its figures, or a missing value naming the input that is absent (Q-49). */
export type TaxPart<T> = { kind: 'value'; v: T } | MissingValue;

/** What the seam reads. */
export type ReviewTaxInput = {
  /** The review's holdings (Review.holdings). */
  holdings: readonly Holding[];
  /** The review's as-on day, the tax reference date (D-040 a). A review without one has no tax view. */
  asOnDay: DayNumber;
  /** The accepted IRR file (its fund flows), or null. */
  irr: IrrFileImport | null;
  /** The accepted capital-gains statement, read with the review's clients, or null. */
  statement: CgImport | null;
  /**
   * The analyst's answers (I-37 TaxInputs; realised.ts emptyTaxInputs() when none). With or without a statement: the
   * slab rate and the exemption already used also serve the harvest (Q-52: the analyst's entry comes first).
   */
  inputs: TaxInputs;
  /** Reference-data facts for the classification of one holding (lots.ts, realised-irr.ts). */
  classifyContext?: (h: Holding) => Omit<ClassifyContext, 'refDay'>;
};

export type ReviewTaxOptions = {
  /** The clock for the audit entries of the statement steps (ISO 8601): the seam never reads the system clock. */
  now: () => string;
};

/** Which inputs the result stands on, and the as-on day. */
export type ReviewTaxBasis = {
  asOnDay: DayNumber;
  /** The as-on financial year (its start year) and its label ("Tax year 2026-27"). */
  fy: FyStart;
  fyLabel: string;
  holdings: number;
  /** The source register ids of the inputs present; null when absent. */
  irr: SourceFileId | null;
  statement: SourceFileId | null;
  /** The analyst's entries, by kind. */
  inputs: { personYear: number; scheme: number; mergerAnswers: number; lotMarks: number; exemptionUsed: number };
  /** The inputs absent, in words (each part missing for them names it too). */
  absent: string[];
  /** The financial years `realisedFY` shows (start years, ascending). */
  years: FyStart[];
};

/** The holdings side (E-41 to E-43). */
export type ReviewTaxHoldings = {
  /** The FIFO lot records of every holding with a market value, and the counts (lots.ts). */
  lots: TaxLotsResult;
  /** Each record (positions, then unreconciled, then unmapped) with its contract TaxPosition, or null (TODO above). */
  positions: Array<{ record: TaxPositionRecord; position: TaxPosition | null }>;
  /** By class, product, asset, client and family (holdings-rollup.ts). */
  rollup: HoldingsTaxRollup;
  /** DATA_DICTIONARY section 6 `tax.unrealised.{st,lt}`: missing without an IRR file. */
  unrealised: { st: Value<number>; lt: Value<number> };
};

/** The harvest: per client, and the family sum of separate computations (harvest.ts). */
export type ReviewTaxHarvest = { clients: HarvestLocal[]; family: FamilyHarvest };

/** The statement side (E-155): its lots, and the person-year tax with the family years. */
export type ReviewTaxStatement = {
  realised: RealiseResult;
  years: RollupFamilyYear[];
  /** The roll-up's issues (the lots' issues are in `realised.issues`). */
  issues: ValidationResult[];
  /** The analyst's inputs not applied, with the reason named (realiseLots, then rollupPersonYears). */
  refusals: Refusal[];
  audit: AuditEntry[];
};

/** The tax of a review: written so that it can become `Review.tax` unchanged (I-41). */
export type ReviewTax = {
  basis: ReviewTaxBasis;
  holdings: ReviewTaxHoldings;
  harvest: TaxPart<ReviewTaxHarvest>;
  statement: TaxPart<ReviewTaxStatement>;
  /** The lots derived from the IRR file and their scheme-years (E-141). */
  derived: TaxPart<DerivedRealised>;
  reconciliation: TaxPart<RealisedReconciliation>;
  /** `tax.realisedFY` for each financial year shown: per client, and the family sum. */
  realisedFY: TaxPart<RealisedFY[]>;
  repeatEvidence: TaxPart<RepeatEvidence[]>;
  /** Every step's issues, de-duplicated by rule and scope, ordered by severity then rule. */
  issues: ValidationResult[];
};

export const NO_IRR = 'no IRR file accepted';
export const NO_STATEMENT = 'no capital-gains statement accepted';
export const MISSING_TEXT = {
  unrealised: `${NO_IRR}: no holding is split into long and short term`,
  harvest: `${NO_IRR}: no holding is split into long and short term, so no harvest is worked`,
  derived: `${NO_IRR}: no realised gain is derived from transactions`,
  statement: `${NO_STATEMENT}: no person-year tax`,
  reconciliation: (irr: boolean, statement: boolean): string => `${[irr ? null : NO_IRR, statement ? null : NO_STATEMENT].filter((x) => x !== null).join(' and ')}: nothing to reconcile`,
  realisedFY: `${NO_IRR} and ${NO_STATEMENT}: no realised gain`,
  repeatEvidence: `${NO_STATEMENT}: no repeated sale event to check`,
} as const;

const value = <T>(v: T): TaxPart<T> => ({ kind: 'value', v });

/** The issues of the steps, the first of each rule and scope kept, ordered by severity then rule, numbered per rule. */
export function mergeIssues(lists: ReadonlyArray<readonly ValidationResult[]>): ValidationResult[] {
  const seen = new Set<string>();
  const kept: ValidationResult[] = [];
  for (const list of lists) {
    for (const i of list) {
      // A rule id holds no space, so the space ends it.
      const k = `${i.ruleId} ${JSON.stringify(i.scope)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      kept.push(i);
    }
  }
  const rank = (i: ValidationResult): number => SEVERITIES.indexOf(i.severity);
  const ordered = kept.map((i, n) => ({ i, n }))
    .sort((a, b) => rank(a.i) - rank(b.i) || (a.i.ruleId < b.i.ruleId ? -1 : a.i.ruleId > b.i.ruleId ? 1 : 0) || a.n - b.n)
    .map((x) => x.i);
  const perRule = new Map<string, number>();
  return ordered.map((i) => {
    const n = (perRule.get(i.ruleId) ?? 0) + 1;
    perRule.set(i.ruleId, n);
    return { ...i, id: `${i.ruleId}:${n}` };
  });
}

/** The financial years with a sale in either input, up to the as-on year, ascending (PLAN-07 section 5). */
export function yearsShown(derived: DerivedRealised | null, realised: RealiseResult | null, asOnFy: FyStart): FyStart[] {
  const ys = new Set<FyStart>();
  for (const l of derived?.lots ?? []) ys.add(l.financialYear);
  for (const g of realised?.gains ?? []) ys.add(g.financialYear);
  return [...ys].filter((y) => y <= asOnFy).sort((a, b) => a - b);
}

/** The tax of a review over the accepted IRR file and capital-gains statement, either or both absent. Pure. */
export function reviewTax(input: ReviewTaxInput, opts: ReviewTaxOptions): ReviewTax {
  const { holdings, asOnDay, irr, statement, inputs, classifyContext } = input;
  const fy = financialYearOf(asOnDay);
  const na = (reason: string): MissingValue => missing(STATUS.NOT_AVAILABLE, reason);

  // 1, 2. The holdings: FIFO lots (no flow without an IRR file) and their roll-ups.
  const lots = computeTaxLots(holdings, irr ? irr.fund : [], { asOn: asOnDay, classifyContext });
  const rollup = rollupHoldings(lots, holdings);
  const records = [...lots.positions, ...lots.unreconciled, ...lots.unmapped];

  // 5. The statement side (before the harvest, which reads its exemption already used).
  let side: StatementSide | null = null;
  let stmt: ReviewTaxStatement | null = null;
  if (statement) {
    const realised = realiseLots(statement, inputs, { asOnDay, now: opts.now });
    const roll = rollupPersonYears(realised.gains, statement, inputs, { now: opts.now });
    side = { imp: statement, realised };
    stmt = {
      realised, years: roll.years, issues: roll.issues, refusals: [...realised.refusals, ...roll.refusals], audit: [...realised.audit, ...roll.audit],
    };
  }

  // 3. The harvest (Q-52: the analyst's entry, else the statement's person-year of the as-on year, else not applied).
  const harvest = irr
    ? value(buildHarvests(rollup, {
      asOn: asOnDay,
      inputs: { personYear: inputs.personYear, exemptionUsed: inputs.exemptionUsed },
      statement: stmt ? { years: stmt.years } : null,
    }))
    : na(MISSING_TEXT.harvest);

  // 4. The realised gains derived from the IRR file.
  const derived = irr ? deriveRealisedGains(irr.fund, { holdings, asOn: asOnDay, classifyContext, sourceId: irr.sourceId }) : null;

  // 6. The reconciliation; 7. the realised figure of each year shown; 8. the repeat evidence.
  const reconciliation = derived && side ? reconcileRealised(derived, side) : null;
  const years = yearsShown(derived, stmt?.realised ?? null, fy);
  const realisedFY = derived || side ? value(years.map((y) => realisedForYear(y, derived, side))) : na(MISSING_TEXT.realisedFY);
  const evidence = statement ? value(repeatEvidence(statement, irr, holdings, asOnDay)) : missing(STATUS.NOT_APPLICABLE, MISSING_TEXT.repeatEvidence);

  const absent = [irr ? null : NO_IRR, statement ? null : NO_STATEMENT].filter((x): x is string => x !== null);
  return {
    basis: {
      asOnDay, fy, fyLabel: fyLabelled(asOnDay).label, holdings: holdings.length,
      irr: irr ? irr.sourceId : null, statement: statement ? statement.sourceId : null,
      inputs: {
        personYear: inputs.personYear.length, scheme: inputs.scheme.length, mergerAnswers: inputs.mergerAnswers.length,
        lotMarks: inputs.lotMarks.length, exemptionUsed: inputs.exemptionUsed.length,
      },
      absent, years,
    },
    holdings: {
      lots,
      positions: records.map((record) => ({ record, position: toTaxPosition(record) })),
      rollup,
      unrealised: irr ? rollup.legacy.unrealised : { st: na(MISSING_TEXT.unrealised), lt: na(MISSING_TEXT.unrealised) },
    },
    harvest,
    statement: stmt ? value(stmt) : na(MISSING_TEXT.statement),
    derived: derived ? value(derived) : na(MISSING_TEXT.derived),
    reconciliation: reconciliation ? value(reconciliation) : na(MISSING_TEXT.reconciliation(irr !== null, statement !== null)),
    realisedFY,
    repeatEvidence: evidence,
    issues: mergeIssues([stmt?.realised.issues ?? [], stmt?.issues ?? [], derived?.issues ?? [], reconciliation?.issues ?? []]),
  };
}
