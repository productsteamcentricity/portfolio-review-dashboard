// A capital-gains statement lot becomes a RealisedGain (NB-M7a S2, parity rows E-152, E-155, E-141 engine half;
// design docs/new-build/capital-gains-upload.md §4, §5, §9.1, §9.2, §9.3 step 1, §10.3 TR-3, §10.4 TR-5 and TR-21,
// §11).
//
// Per lot: the tax facts (tax-class.ts), the lot class and its merger event or successor link (lot-class.ts), the
// rule key and its one rate row (rules.ts ruleFor), the term, the cost for tax by the rule's basis (actual;
// grandfathered: the higher of the actual cost and the lower of the 31 Jan 2018 value and the sale value; indexed on
// the rule's CII series with the base-year floor), and the taxable gain. NE-LT-1 computes both legs on signed amounts
// and takes the lower tax (on equal figures, or an indexed loss, the 20% leg). A lot without a computable taxable gain
// keeps `notComputed` and a missing taxable gain: it enters no bucket (S3 rolls up). Nothing is rounded (LD-42).
//
// PD-16 defaults applied here, each in one named place: item 2 (the anniversary day is short term, with the long-term
// figure beside it: anniversaryLongTermFor) and item 4 (NE-LT-1 per lot, on signed amounts: neLt1Legs). Item 4's
// FY 2016-17 index stays the dash through rules.ts (rule-to-be-confirmed).
//
// Pure: no globals, no network; the clock only through opts.now (audit entries). Messages carry counts only: never a
// PAN, a folio, a name or the amount of a single lot (§11), and no en or em dash (D-029).

import type { CgImport, CgLot, CgRead } from '../../ingest/capital-gains.ts';
import { amountTolerance } from '../../ingest/capital-gains.ts';
import type { DayNumber, Provenance, Unit, Value } from '../../model/value.ts';
import type { MissingStatus } from '../../model/status.ts';
import { STATUS } from '../../model/status.ts';
import type { AuditEntry } from '../../model/audit.ts';
import type { ValidationScope } from '../../model/validation.ts';
import type { CostBasis, LotClass, NotComputed, RealisedGain, TaxInputs, Term } from '../../model/tax.ts';
import { ymdToDay } from '../dates.ts';
import { normaliseLabel } from '../ids.ts';
import { missing, present } from '../value.ts';
import type { RuleKey, TaxRule, TaxRuleTable } from './rules.ts';
import { TAX_RULES_V1, anniversaryOf, checksFor, indexedCost, ruleFor } from './rules.ts';
import { schemeKeyOf, taxFactsFor } from './tax-class.ts';
import type { TaxFacts } from './tax-class.ts';
import { classifyLots } from './lot-class.ts';
import type {
  LegDetail, LotMark, LotRate, MergerEventResult, RealiseResult, SuccessorLink, TaxIssue, TaxLot,
} from './types.ts';
import { S2_ISSUE_SEVERITY } from './types.ts';

/** First held before this day: the s.55(2)(b) or s.90(9) input is needed for the actual-cost leg (TR-11). */
export const COST_INPUT_BEFORE: DayNumber = ymdToDay(2001, 4, 1)!;
/** TR-21: an IDCW or dividend option sold by this day can be a dividend-stripping candidate. */
export const DIVIDEND_STRIPPING_SOLD_BY: DayNumber = ymdToDay(2020, 12, 31)!;
/** TR-21: a loss on a lot held this many months or less (strictly after the anniversary is longer). */
export const STRIPPING_HOLDING_MONTHS = 12;
/** NE-LT-1 legs whose taxes differ by less than this are equal (the 20% leg is taken). */
const LEG_EPSILON = 1e-6;

/** An IDCW or dividend option by the scheme label (not a "Dividend Yield" fund). */
const IDCW_RE = /\bidcw\b|\bdividend\s+(?:option|plan|payout|reinvestment)\b|-\s*dividend\b/i;

export type RealiseOptions = {
  /** The rule table (default: table v1, data/owner/tax-rules.json). */
  table?: TaxRuleTable;
  /** The review's as-on date: a lot sold after it is flagged (after-as-on-date). */
  asOnDay?: DayNumber;
  /** Clock for the audit entries (ISO 8601); defaults to the system clock. */
  now?: () => string;
  /**
   * The fund house of a scheme by its key (schemeKeyOf), from the scheme data (M2); used only for cross-house-merger,
   * which is raised only when it names the fund house of the event's scheme and of a linked scheme.
   */
  fundHouseOf?: (schemeKey: string) => string | null;
  /**
   * A per-lot assessee mark (a minor, an HUF, joint holders or a non-resident) by the reader's lot index, an audit
   * entry like the person-year's `assesseeMark`: the lot is flagged (assessee-flagged), not computed differently.
   */
  assesseeOf?: (lotIndex: number) => string | null;
};

export function emptyTaxInputs(): TaxInputs {
  return { personYear: [], scheme: [], mergerAnswers: [], lotMarks: [], exemptionUsed: [] };
}

const val = <T>(r: CgRead<T>): T | null => (r.kind === 'value' ? r.v : null);
const NA: MissingStatus = STATUS.NOT_AVAILABLE;
const NAPP: MissingStatus = STATUS.NOT_APPLICABLE;

/**
 * Why the engine computed no taxable gain: the contract's reasons, and the engine's precise amount reasons
 * (types.ts TaxLot.notComputedDetail): 'amount-missing' (Sell Amount, or for the grandfathered formula Sale Unit or the
 * 31 Jan 2018 price, blank or invalid) and 'cost-missing' (Invested Value blank or invalid).
 */
type NotComputedReason = NotComputed | 'amount-missing' | 'cost-missing';

/**
 * The per-lot tax "before exemption, surcharge and cess" that the known answers quote (TR-9): gain x rate. A slab-rate
 * lot needs the person's slab rate (a percent, for example 30): without it the tax is missing ("slab rate not set").
 * An exempt lot's tax is 0. A rule to be confirmed (rate null) or a missing gain gives a missing tax.
 */
export function lotTax(gain: Value<number>, rule: { rate: LotRate | 'two-leg' } | null, slabPct: number | null): Value<number> {
  if (gain.kind === 'missing') return gain;
  const prov: Provenance = { sources: [...gain.prov.sources], method: 'taxable gain x rate, before exemption, surcharge and cess (TR-9)' };
  if (rule === null || rule.rate === null || rule.rate === 'two-leg') return missing(NA, 'no single rate: rule to be confirmed', prov);
  if (rule.rate === 'exempt') return present(0, 'inr', prov);
  if (rule.rate === 'slab') return slabPct === null ? missing(NA, 'slab rate not set', prov) : present((gain.v * slabPct) / 100, 'inr', prov);
  return present(gain.v * rule.rate, 'inr', prov);
}

// ---------------------------------------------------------------------------------------------------------------
// Cost for tax by the rule's basis

type CostCtx = {
  table: TaxRuleTable;
  lotClass: LotClass;
  purchaseDay: DayNumber;
  saleDay: DayNumber;
  cost: number | null;
  sale: number | null;
  units: number | null;
  acquisitionPrice: number | null;
  mark: LotMark | undefined;
};

/** The cost for tax is a number, or null where it does not apply (the s.10(38) exempt line, costBasis none). */
type CostResult =
  | {
    kind: 'ok'; costForTax: number | null; costBasis: CostBasis; taxableGain: number; rate: LotRate; exempt: boolean;
    legs: LegDetail | null; flags: string[]; labels: string[];
  }
  | { kind: 'not-computed'; reason: NotComputedReason; flags: string[] };

const GRANDFATHERING_LABEL = '31 Jan 2018 value not supplied; actual cost used; gain may be overstated';

/** NE-LT-1 (PD-16 item 4 default): both legs on signed amounts, the lower tax chosen; the 20% leg on a tie or an indexed loss. */
export function neLt1Legs(rule: TaxRule, indexed: number, actual: number, sale: number): LegDetail {
  const [l20, l10] = rule.legs!;
  const g20 = sale - indexed;
  const g10 = sale - actual;
  const t20 = g20 * l20!.rate;
  const t10 = g10 * l10!.rate;
  const chosen = g20 < 0 || t20 <= t10 + LEG_EPSILON ? 'indexed20' : 'actual10';
  return { indexed20: { cost: indexed, gain: g20, tax: t20 }, actual10: { cost: actual, gain: g10, tax: t10 }, chosen };
}

function costFor(rule: TaxRule, c: CostCtx): CostResult {
  const flags: string[] = [];
  const labels: string[] = [];
  if (c.sale === null) return { kind: 'not-computed', reason: 'amount-missing', flags };
  if (c.cost === null) return { kind: 'not-computed', reason: 'cost-missing', flags };
  const sale = c.sale;
  const cost = c.cost;
  const ok = (costForTax: number | null, costBasis: CostBasis, taxableGain: number, rate: LotRate, exempt = false,
    legs: LegDetail | null = null): CostResult => ({ kind: 'ok', costForTax, costBasis, taxableGain, rate, exempt, legs, flags, labels });
  const basis = rule.costBasis;
  if (basis !== 'grandfathered' && c.lotClass === 'grandfathered') flags.push('grandfathered-value-ignored');
  if (basis !== 'indexed-1981' && basis !== 'indexed-2001' && basis !== 'per-leg' && c.lotClass === 'indexed-cost-shown') {
    flags.push('indexed-cost-ignored');
  }
  switch (basis) {
    case 'none':
      // EQ-LT-1: the s.10(38) exempt line; costBasis none (§4), taxable gain 0, a loss on it ignored in set-off.
      return ok(null, 'none', 0, 'exempt', true);
    case 'actual':
      return ok(cost, 'actual', sale - cost, rule.rate === 'two-leg' ? null : rule.rate);
    case 'grandfathered': {
      const rate = rule.rate === 'two-leg' ? null : rule.rate;
      if (c.purchaseDay < COST_INPUT_BEFORE || c.mark?.firstHeldBefore2001 === true || c.mark?.giftOrInheritance === true) {
        flags.push('cost-input-missing');
        return { kind: 'not-computed', reason: 'cost-input-missing', flags };
      }
      if (c.lotClass === 'grandfathered') {
        if (c.units === null || c.acquisitionPrice === null) return { kind: 'not-computed', reason: 'amount-missing', flags };
        const fmv = c.units * c.acquisitionPrice;
        const cft = Math.max(cost, Math.min(fmv, sale));
        return ok(cft, 'grandfathered', sale - cft, rate);
      }
      flags.push('grandfathering-value-not-supplied');
      labels.push(GRANDFATHERING_LABEL);
      return ok(cost, 'actual', sale - cost, rate);
    }
    case 'indexed-1981':
    case 'indexed-2001': {
      const ic = indexedCost(c.table, cost, c.purchaseDay, c.saleDay, basis === 'indexed-1981' ? 'base1981' : 'base2001');
      if (ic.kind === 'missing') {
        if (ic.reason === 'to-be-confirmed') flags.push('rule-to-be-confirmed');
        return { kind: 'not-computed', reason: ic.reason === 'to-be-confirmed' ? 'rule-to-be-confirmed' : 'no-valid-key', flags };
      }
      if (ic.preBaseYear) flags.push('pre-base-year-cost');
      return ok(ic.cost, 'indexed', sale - ic.cost, rule.rate === 'two-leg' ? null : rule.rate);
    }
    case 'per-leg': {
      const leg20 = rule.legs![0]!;
      const ic = indexedCost(c.table, cost, c.purchaseDay, c.saleDay, leg20.costBasis === 'indexed-2001' ? 'base2001' : 'base1981');
      if (ic.kind === 'missing') {
        if (ic.reason === 'to-be-confirmed') flags.push('rule-to-be-confirmed');
        return { kind: 'not-computed', reason: ic.reason === 'to-be-confirmed' ? 'rule-to-be-confirmed' : 'no-valid-key', flags };
      }
      const legs = neLt1Legs(rule, ic.cost, cost, sale);
      flags.push('old-law-choice');
      if (legs.chosen === 'indexed20') {
        if (ic.preBaseYear) flags.push('pre-base-year-cost');
        return ok(legs.indexed20.cost, 'indexed', legs.indexed20.gain, leg20.rate, false, legs);
      }
      return ok(legs.actual10.cost, 'actual', legs.actual10.gain, rule.legs![1]!.rate, false, legs);
    }
    default:
      return { kind: 'not-computed', reason: 'rule-to-be-confirmed', flags: ['rule-to-be-confirmed'] };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The anniversary-day long-term figure (PD-16 item 2 default)

/** The long-term rate row of a key for its sale date: the row that would apply had the lot been held one day longer. */
function longTermRowFor(table: TaxRuleTable, key: RuleKey): TaxRule | null {
  const listed = key.listed ?? false;
  const hits = table.rules.filter((r) => {
    if (r.term !== 'long') return false;
    if (key.saleDay < r.saleFrom || (r.saleTo !== null && key.saleDay > r.saleTo)) return false;
    const w = r.purchase[key.taxClass];
    if (w === undefined || (w.from !== null && key.purchaseDay < w.from) || (w.to !== null && key.purchaseDay > w.to)) return false;
    if (!r.subTypes.includes(key.subType)) return false;
    if (r.subTypeExclusions.some((x) => x.subType === key.subType && (x.sale.from === null || key.saleDay >= x.sale.from)
      && (x.sale.to === null || key.saleDay <= x.sale.to))) return false;
    if (r.listed === 'listed' && !listed) return false;
    if (r.listed === 'unlisted' && listed) return false;
    return true;
  });
  return hits.length === 1 ? hits[0]! : null;
}

type AnniversaryFigure = { ruleId: string; taxableGain: number; rate: LotRate; costForTax: number };

function anniversaryLongTermFor(key: RuleKey, c: CostCtx): AnniversaryFigure | null {
  const row = longTermRowFor(c.table, key);
  if (row === null || row.toBeConfirmed) return null;
  const r = costFor(row, { ...c, mark: undefined });
  if (r.kind !== 'ok' || r.costForTax === null) {
    return r.kind === 'ok' && r.exempt ? { ruleId: row.id, rate: 'exempt', costForTax: c.cost ?? 0, taxableGain: 0 } : null;
  }
  return { ruleId: row.id, rate: r.rate, costForTax: r.costForTax, taxableGain: r.taxableGain };
}

// ---------------------------------------------------------------------------------------------------------------
// One lot

type LotCtx = {
  table: TaxRuleTable;
  /** The statement's source id (its SHA-256): the provenance of every value of the lot. */
  sourceId: string;
  lot: CgLot;
  facts: TaxFacts;
  lotClass: LotClass;
  event: MergerEventResult | null;
  successor: SuccessorLink | null;
  mark: LotMark | undefined;
  assessee: string | null;
  inputs: TaxInputs;
  asOnDay: DayNumber | undefined;
  bonusSchemes: ReadonlySet<string>;
};

function statementSplit(lot: CgLot): { gain: number | null; term: Term | null } {
  const lt = val(lot.statement.ltcg);
  const st = val(lot.statement.stcg);
  if (lt === null && st === null) return { gain: null, term: null };
  const term: Term | null = (lt ?? 0) !== 0 && (st ?? 0) === 0 ? 'long' : (st ?? 0) !== 0 && (lt ?? 0) === 0 ? 'short' : null;
  return { gain: (lt ?? 0) + (st ?? 0), term };
}

/** The Instrument Name tag's asset as the contract's tagAsset: Equity or Debt by its normalised text, else null. */
function tagAssetOf(text: string | null): RealisedGain['tagAsset'] {
  const t = normaliseLabel(text);
  return t === 'equity' ? 'Equity' : t === 'debt' ? 'Debt' : null;
}

function realiseOne(x: LotCtx): TaxLot {
  const { table, lot, facts, lotClass, event, successor, mark } = x;
  const flags: string[] = [...facts.flags];
  const labels: string[] = [...facts.labels];
  const prov = (method: string): Provenance => ({ sources: [x.sourceId], method });
  /** A cell as the reader read it, as a Value: present with its unit, or missing with the reader's status. */
  const cell = <T>(r: CgRead<T>, unit: Unit, name: string): Value<T> => (r.kind === 'value'
    ? present(r.v, unit, prov(`${name} as read from the capital-gains statement`))
    : missing(r.status, `${name} blank or invalid in the statement`, prov(`${name} as read from the capital-gains statement`)));

  // The purchase as stated, or as the analyst set it (an audit entry).
  let purchaseDate: Value<DayNumber> = cell(lot.purchaseDate, 'date', 'Purchase Date');
  let purchaseValue: Value<number> = cell(lot.purchaseValue, 'inr', 'Invested Value');
  if (successor !== null) {
    if (successor.analystApplied) {
      const set = successor.kind === 'reset' ? mark?.resetOriginal : mark?.rebase;
      if (set !== undefined) {
        const how = successor.kind === 'reset'
          ? 'set by the analyst: the original purchase of a successor-reset lot (audit entry, design section 5)'
          : 'set by the analyst: the re-base of a successor-not-reset lot to the event date (audit entry, design section 5)';
        purchaseDate = present(set.purchaseDate, 'date', prov(`purchase date ${how}`));
        purchaseValue = present(set.cost, 'inr', prov(`cost ${how}`));
      }
    } else {
      flags.push(successor.kind === 'reset' ? 'successor-reset' : 'successor-not-reset');
    }
  }
  const pd = val(purchaseDate);
  const cost = val(purchaseValue);
  const sale = val(lot.saleValue);
  const realised: Value<number> = sale !== null && cost !== null
    ? present(sale - cost, 'inr', prov('sale value minus cost'))
    : missing(NA, 'Sell Amount or cost blank or invalid', prov('sale value minus cost'));

  if (event !== null) {
    if (event.answer === null) flags.push('non-taxable-transfers');
    if (event.taxable && event.answer !== 'investor-switch') flags.push('merger-taxable');
    if (event.crossHouse) flags.push('cross-house-merger');
  }
  if (lotClass === 'other') flags.push('lot-class-other');
  const py = x.inputs.personYear.find((p) => p.clientId === lot.clientId && p.fy === lot.financialYear.start);
  if (x.assessee !== null || (py?.assesseeMark ?? null) !== null) flags.push('assessee-flagged');
  if (x.asOnDay !== undefined && lot.saleDate > x.asOnDay) flags.push('after-as-on-date');
  const split = statementSplit(lot);
  const noRule = (): Value<never> => missing(NA, 'no rule applies');

  const g: TaxLot = {
    source: 'statement', lotIndex: lot.index, at: lot.at, scheme: null, schemeLabel: lot.schemeLabel, folio: lot.folio,
    tagAsset: tagAssetOf(lot.tagAsset), tagAssetText: lot.tagAsset, category: lot.category,
    statementAsset: lot.statementAsset, clientId: lot.clientId, inReview: lot.inReview, accountId: lot.accountId,
    distributorId: lot.distributorId, accountLabel: lot.accountLabel, accountNote: lot.accountNote, eventId: lot.eventId,
    saleDate: lot.saleDate, units: cell(lot.units, 'units', 'Sale Unit'), saleValue: cell(lot.saleValue, 'inr', 'Sell Amount'),
    salePrice: cell(lot.salePrice, 'inr-per-unit', lot.salePriceDerived ? 'Sale Price (derived by the reader)' : 'Sale Price'),
    salePriceDerived: lot.salePriceDerived,
    purchasePrice: cell(lot.purchasePrice, 'inr-per-unit', lot.purchasePriceDerived ? 'Purchase Price (derived by the reader)' : 'Purchase Price'),
    purchasePriceDerived: lot.purchasePriceDerived, purchaseValue, purchaseDate, realised, realisedCounted: realised,
    nonTaxable: 0, financialYear: lot.financialYear.start, financialYearLabel: lot.financialYear.label,
    taxClass: facts.taxClass === null ? missing(NA, 'tax class not set')
      : present(facts.taxClass, 'label', prov(`tax class (${facts.source ?? 'none'}, design section 9.1)`)),
    taxClassSource: facts.source,
    listed: facts.listed === null ? missing(NA, 'listed flag missing for a close-ended non-equity scheme')
      : present(facts.listed, 'label', prov(`listed flag (${facts.listedSource}, TR-16)`)),
    listedSource: facts.listedSource,
    subType: facts.subType, lotClass, term: noRule(), deemedShort: false, anniversary: null, ruleId: null, rate: null,
    exempt: false, costForTax: noRule(), costBasis: 'none', taxableGain: noRule(), notComputed: null,
    notComputedDetail: null, legs: null, legDetail: null, anniversaryLongTerm: null, anniversaryLongTermDetail: null,
    statementGain: split.gain, statementTerm: split.term, successor, duplicateOf: lot.duplicateOf,
    excludedAsRepeat: lot.excludedAsRepeat, statement: lot.statement, flags, labels,
  };
  const notComputed = (reason: NotComputedReason, status: MissingStatus = NA): TaxLot => {
    if (reason === 'amount-missing') {
      // The contract holds it since contracts-3 (PR #45, 26 Nov 2026).
      g.notComputed = 'amount-missing';
      g.notComputedDetail = 'amount-missing';
    } else if (reason === 'cost-missing') {
      g.notComputed = 'cost-input-missing';
      g.notComputedDetail = 'cost-missing';
    } else {
      g.notComputed = reason;
    }
    const why = `tax not computed: ${reason}`;
    g.taxableGain = missing(status, why);
    g.costForTax = missing(status, why);
    g.costBasis = 'none';
    return finish(g, x);
  };

  if (lotClass === 'non-taxable-transfer') {
    // Not a transfer: taxable gain nil; the economic gain goes to the non-taxable line, except the share kept for
    // units that went to lots still reset (§4).
    g.taxableGain = present(0, 'inr', prov('a non-taxable transfer: taxable gain nil (design section 4)'));
    g.costForTax = missing(NAPP, 'not applicable: a non-taxable transfer');
    g.term = missing(NAPP, 'not applicable: a non-taxable transfer');
    const share = event?.keptShare ?? 0;
    if (realised.kind === 'value') {
      g.realisedCounted = present(realised.v * share, 'inr', prov('realised gain x the share kept for lots still reset (design section 4)'));
      g.nonTaxable = realised.v * (1 - share);
    }
    return finish(g, x);
  }

  if (lot.saleDate < table.coverageFrom) {
    flags.push('outside-rule-table');
    return notComputed('outside-rule-table', NAPP);
  }
  if (pd === null || pd > lot.saleDate) return notComputed('no-valid-key');
  if (facts.taxClass === null) return notComputed('tax-class-not-set');

  const key: RuleKey = { taxClass: facts.taxClass, listed: facts.listed, subType: facts.subType, purchaseDay: pd, saleDay: lot.saleDate };
  const rr = ruleFor(table, key);
  if (rr.kind === 'none') {
    if (rr.reason === 'listed-flag-missing') { flags.push('listed-flag-missing'); return notComputed('listed-flag-missing'); }
    if (rr.reason === 'outside-rule-table') { flags.push('outside-rule-table'); return notComputed('outside-rule-table', NAPP); }
    return notComputed('no-valid-key');
  }
  const rule = rr.rule;
  g.ruleId = rule.id;
  g.term = present(rr.term, 'label', prov(rr.deemedShort
    ? `deemed short term whatever the holding (rule ${rule.id})`
    : `term to the sale date, long only strictly after the anniversary (OD-2, rule ${rule.id})`));
  g.deemedShort = rr.deemedShort;
  g.anniversary = rr.anniversary;
  if (rr.listedFlag === 'missing-same-either-way') labels.push(table.keyValidity.listedFlagMissingLabel);
  for (const hit of checksFor(table, key)) flags.push(hit.check.warning.replace(/^capital-gains\./, ''));
  if (split.term !== null && split.term !== rr.term) flags.push('term-differs');
  const onAnniversary = rr.anniversary !== null && lot.saleDate === rr.anniversary;
  if (rr.anniversary !== null && (onAnniversary || lot.saleDate === rr.anniversary + 1)) flags.push('anniversary-sale');

  const ctx: CostCtx = {
    table, lotClass, purchaseDay: pd, saleDay: lot.saleDate, cost, sale, units: val(lot.units),
    acquisitionPrice: val(lot.statement.acquisitionPrice), mark,
  };
  if (onAnniversary && rr.term === 'short') {
    const a = anniversaryLongTermFor(key, ctx);
    g.anniversaryLongTerm = a === null ? null : { ruleId: a.ruleId, taxableGain: a.taxableGain };
    g.anniversaryLongTermDetail = a === null ? null : { rate: a.rate, costForTax: a.costForTax };
  }

  if (rule.toBeConfirmed) {
    flags.push('rule-to-be-confirmed');
    return notComputed('rule-to-be-confirmed');
  }
  const r = costFor(rule, ctx);
  flags.push(...r.flags);
  if (r.kind === 'not-computed') return notComputed(r.reason);
  labels.push(...r.labels);
  g.costForTax = r.costForTax === null
    ? missing(NAPP, 'not applicable: the s.10(38) exempt line')
    : present(r.costForTax, 'inr', prov(`cost for tax on the ${r.costBasis} basis (rule ${rule.id})`));
  g.costBasis = r.costBasis;
  g.taxableGain = present(r.taxableGain, 'inr', prov(r.exempt
    ? `the s.10(38) exempt line: taxable gain 0 (rule ${rule.id})`
    : `sale value minus cost for tax (rule ${rule.id})`));
  g.rate = r.rate;
  g.exempt = r.exempt;
  g.legDetail = r.legs;
  g.legs = r.legs === null ? null : {
    indexed20: present(r.legs.indexed20.gain, 'inr', prov(`NE-LT-1 20% leg: sale value minus indexed cost (rule ${rule.id})`)),
    actual10: present(r.legs.actual10.gain, 'inr', prov(`NE-LT-1 10% leg: sale value minus actual cost (rule ${rule.id})`)),
    chosen: r.legs.chosen,
  };
  // gain-differs: the taxable gain (NE-LT-1: the chosen leg's) against the statement's LTCG plus STCG. Not on an
  // exempt lot, and not on a merger row taxed as a sale (merger-taxable explains its stated 0).
  if (!r.exempt && lotClass !== 'taxable-transfer' && split.gain !== null && sale !== null
    && Math.abs(r.taxableGain - split.gain) > amountTolerance(sale)) flags.push('gain-differs');
  return finish(g, x);
}

/** TR-21 stripping candidates, then the flags de-duplicated in order. */
function finish(g: TaxLot, x: LotCtx): TaxLot {
  const pd = val(g.purchaseDate);
  if (g.realised.kind === 'value' && g.realised.v < 0 && pd !== null && g.saleDate <= anniversaryOf(pd, STRIPPING_HOLDING_MONTHS)) {
    const dividend = IDCW_RE.test(g.schemeLabel) && g.saleDate <= DIVIDEND_STRIPPING_SOLD_BY;
    const bonus = x.bonusSchemes.has(`${g.accountId}|${schemeKeyOf(g.schemeLabel)}`);
    if (dividend || bonus) g.flags.push('stripping-candidate');
  }
  g.flags = [...new Set(g.flags)];
  g.labels = [...new Set(g.labels)];
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// Validation results (§11)

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const MESSAGES: Readonly<Record<string, (n: number) => string>> = {
  'non-taxable-transfers': (n) => `${plural(n, 'merger event is', 'merger events are')} to be answered: a non-taxable consolidation, a taxable consolidation or an investor switch. Until answered, an event from 2015-04-01 is computed as non-taxable and an earlier one as taxable.`,
  'assessee-flagged': (n) => `${plural(n, 'lot is', 'lots are')} marked as of a minor, an HUF, joint holders or a non-resident; computed as a resident individual's.`,
  'lot-class-other': (n) => `${plural(n, 'lot has', 'lots have')} acquisition columns that match no known pattern; computed on the actual cost with the statement's split shown beside.`,
  'merger-taxable': (n) => `${plural(n, 'merger event is', 'merger events are')} taxed as a sale on the event date (before the date gate, or answered as a taxable consolidation).`,
  'cross-house-merger': (n) => `${plural(n, 'merger event is', 'merger events are')} between two fund houses; check whether the consolidation is taxable.`,
  'successor-reset': (n) => `${plural(n, 'lot', 'lots')} after a non-taxable merger ${n === 1 ? 'starts' : 'start'} on the event date, so cost and holding may have been reset; computed as stated until the analyst sets the original date and cost.`,
  'successor-not-reset': (n) => `${plural(n, 'lot', 'lots')} after a taxable merger still ${n === 1 ? 'carries' : 'carry'} the original purchase date, so the merger gain is counted twice; the candidates are listed by scheme and computed as stated until the analyst re-bases the successor's lots.`,
  'cost-input-missing': (n) => `${plural(n, 'lot', 'lots')} under a grandfathered rule ${n === 1 ? 'needs' : 'need'} the cost input for units first held before 1 Apr 2001 or received by gift or inheritance; the tax is not computed.`,
  'category-unmapped': (n) => `${plural(n, 'lot has', 'lots have')} a Category Name that the category map does not hold.`,
  'category-default-to-confirm': (n) => `${plural(n, 'lot is', 'lots are')} equity-oriented by a Sectoral or Thematic category; a fund investing mainly in foreign shares is not equity-oriented: confirm the class.`,
  'usual-bucket-default': (n) => `${plural(n, 'lot is', 'lots are')} classed by the usual bucket per the owner's reckoner; confirm with the fund house.`,
  'tax-class-from-statement': (n) => `${plural(n, 'lot takes', 'lots take')} the tax class from the statement's own classification.`,
  'tax-class-not-set': (n) => `${plural(n, 'lot has', 'lots have')} no tax class; the tax is not computed until the class is set.`,
  'specified-test-missing': (n) => `${plural(n, 'lot', 'lots')} bought from 1 Apr 2023 without a class ${n === 1 ? 'needs' : 'need'} the fund's percentages for the Specified test of the year.`,
  'listed-flag-missing': (n) => `${plural(n, 'lot', 'lots')} of a close-ended non-equity scheme without the listed flag ${n === 1 ? 'has' : 'have'} a term that depends on it; the tax is not computed.`,
  'tax-class-differs': (n) => `${plural(n, 'lot has', 'lots have')} a tax class that differs from the statement's Asset Name.`,
  'term-differs': (n) => `${plural(n, 'lot has', 'lots have')} a term that differs from the statement's split; the app's term is used.`,
  'anniversary-sale': (n) => `${plural(n, 'lot was', 'lots were')} sold on the anniversary or the day after; for the anniversary itself the long-term figure is shown beside.`,
  'after-as-on-date': (n) => `${plural(n, 'lot was', 'lots were')} sold after the review's as-on date.`,
  'elss-early-sale': (n) => `${plural(n, 'ELSS lot was', 'ELSS lots were')} sold inside the three-year lock-in; check the data or a death case. The rate row of the key is kept.`,
  'gain-differs': (n) => `${plural(n, 'lot has', 'lots have')} a taxable gain that differs from the statement's LTCG or STCG beyond the tolerance.`,
  'stripping-candidate': (n) => `${plural(n, 'loss', 'losses')} may fall under dividend or bonus stripping; without record-date data ${n === 1 ? 'it is' : 'they are'} computed normally.`,
  'rule-to-be-confirmed': (n) => `${plural(n, 'lot needs', 'lots need')} a rule input still to be confirmed; the tax is not computed and the rule id is shown.`,
  'outside-rule-table': (n) => `${plural(n, 'lot was', 'lots were')} sold before 1 Oct 2004, which no rule covers.`,
  'indexed-cost-ignored': (n) => `${plural(n, 'lot shows', 'lots show')} an indexed cost under a rule that does not index; the stated indexed cost is ignored.`,
  'grandfathered-value-ignored': (n) => `${plural(n, 'lot shows', 'lots show')} a 31 Jan 2018 value under a rule that is not grandfathered; the value is ignored.`,
  'grandfathering-value-not-supplied': (n) => `${plural(n, 'lot', 'lots')} bought before 1 Feb 2018 and sold long term ${n === 1 ? 'carries' : 'carry'} no 31 Jan 2018 value; actual cost used, the gain may be overstated.`,
  'pre-base-year-cost': (n) => `${plural(n, 'lot was', 'lots were')} first held before the index series' base year; the statement's cost is used.`,
  'old-law-choice': (n) => `${plural(n, 'NE-LT-1 lot takes', 'NE-LT-1 lots take')} the lower figure per lot, on signed amounts, before set-off; the year's-total figure is shown beside it. For the tax adviser to confirm.`,
};

const EVENT_IDS = new Set(['non-taxable-transfers', 'merger-taxable', 'cross-house-merger']);

function buildIssues(gains: readonly RealisedGain[], events: readonly MergerEventResult[], imp: CgImport): TaxIssue[] {
  const out: TaxIssue[] = [];
  const counted = gains.filter((g) => !g.excludedAsRepeat);
  let n = 0;
  const add = (id: string, count: number, scope: ValidationScope, message: string, analyst = false): void => {
    const severity = S2_ISSUE_SEVERITY[id]!;
    n++;
    out.push({
      id: `capital-gains.${id}:${n}`, ruleId: `capital-gains.${id}`, scope, message, severity,
      blocksPublication: severity === 'Blocking',
      resolution: severity === 'Information' ? 'auto-resolved' : analyst ? 'analyst-decision' : 'none',
      status: severity === 'Information' ? 'resolved' : 'open', decision: 'D-036', count,
    });
  };
  const rowsScope = (gs: readonly RealisedGain[]): ValidationScope => ({ kind: 'rows', sourceId: imp.sourceId, rows: gs.map((g) => g.at) });
  for (const id of Object.keys(S2_ISSUE_SEVERITY)) {
    if (id === 'lot-classes') continue;
    const lots = counted.filter((g) => g.flags.includes(id));
    if (lots.length === 0) continue;
    if (EVENT_IDS.has(id)) {
      const evs = events.filter((e) => id === 'non-taxable-transfers' ? e.answer === null
        : id === 'merger-taxable' ? e.taxable && e.answer !== 'investor-switch' : e.crossHouse);
      add(id, evs.length, rowsScope(lots), MESSAGES[id]!(evs.length), id === 'non-taxable-transfers');
    } else {
      add(id, lots.length, rowsScope(lots), MESSAGES[id]!(lots.length));
    }
  }
  if (counted.length > 0) {
    const order: LotClass[] = ['non-taxable-transfer', 'taxable-transfer', 'grandfathered', 'indexed-cost-shown', 'standard', 'other'];
    const parts = order.map((c) => [c, counted.filter((g) => g.lotClass === c).length] as const).filter(([, k]) => k > 0)
      .map(([c, k]) => `${c} ${k}`);
    add('lot-classes', counted.length, { kind: 'file', sourceId: imp.sourceId }, `Lots per class: ${parts.join(', ')}.`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The engine over a statement

/** Every lot of a statement (repeats excluded as "once" are carried, flagged `excludedAsRepeat`) as a TaxLot (the contract's RealisedGain and the S2 lines). */
export function realiseLots(imp: CgImport, inputs: TaxInputs, opts: RealiseOptions = {}): RealiseResult {
  const table = opts.table ?? TAX_RULES_V1;
  const now = opts.now ?? ((): string => new Date().toISOString());
  const lots = imp.lots;
  const facts = lots.map((l) => taxFactsFor(table, {
    schemeLabel: l.schemeLabel, category: l.category, statementAsset: l.statementAsset, tagAsset: l.tagAsset,
    purchaseDay: val(l.purchaseDate), saleDay: l.saleDate,
  }, inputs.scheme));
  const classing = classifyLots(table, lots, facts.map((f) => f.taxClass), inputs, { fundHouseOf: opts.fundHouseOf });
  const marks = new Map<number, LotMark>();
  for (const m of inputs.lotMarks) marks.set(m.lotIndex, { ...(marks.get(m.lotIndex) ?? { lotIndex: m.lotIndex }), ...m });
  const bonusSchemes = new Set<string>();
  for (const l of lots) if (val(l.purchaseValue) === 0) bonusSchemes.add(`${l.accountId}|${schemeKeyOf(l.schemeLabel)}`);

  const gains = lots.map((lot, i) => realiseOne({
    table, sourceId: imp.sourceId, lot, facts: facts[i]!, lotClass: classing.classes[i]!, successor: classing.successorOf[i] ?? null,
    event: classing.eventOf[i]! >= 0 ? classing.events[classing.eventOf[i]!]! : null, mark: marks.get(lot.index),
    assessee: opts.assesseeOf?.(lot.index) ?? null, inputs, asOnDay: opts.asOnDay, bonusSchemes,
  }));

  const refusals = [...classing.refusals];
  facts.forEach((f, i) => {
    if (f.refusal !== null && !refusals.some((r) => r.input === 'scheme-class' && r.ref === schemeKeyOf(lots[i]!.schemeLabel))) {
      refusals.push({ input: 'scheme-class', ref: schemeKeyOf(lots[i]!.schemeLabel), reason: f.refusal });
    }
  });

  // Audit entries: each analyst input the engine applied (counts and ids only, never an amount).
  const audit: AuditEntry[] = [];
  const entry = (summary: string, detail: AuditEntry['detail']): void => {
    audit.push({ id: `audit:tax:${audit.length + 1}`, at: now(), kind: 'validation-decision', sourceId: imp.sourceId, summary, detail });
  };
  for (const ev of classing.events) {
    if (ev.answer !== null) entry('The analyst answered a merger event of the capital-gains statement (design section 5).', { event: ev.eventId, answer: ev.answer, lots: ev.lots.length });
  }
  const schemesApplied = new Set<string>();
  facts.forEach((f, i) => { if (f.source === 'analyst' || f.source === 'ninety-ninety' || f.listedSource === 'analyst') schemesApplied.add(schemeKeyOf(lots[i]!.schemeLabel)); });
  if (schemesApplied.size > 0) entry('Analyst scheme classes or flags were applied to statement lots (design section 9.1).', { schemes: schemesApplied.size });
  for (const g of gains) {
    if (g.successor?.analystApplied) {
      entry(g.successor.kind === 'reset'
        ? 'The analyst set the original purchase date and cost of a successor-reset lot (design section 5).'
        : 'The analyst re-based a successor-not-reset lot to the event date at the merger value (design section 5).', { lot: g.lotIndex, event: g.successor.eventId });
    }
    const m = marks.get(g.lotIndex);
    if (m?.giftOrInheritance || m?.firstHeldBefore2001) entry('A gift, inheritance or first-held-before-2001 mark was applied to a lot (design section 5).', { lot: g.lotIndex });
  }

  return {
    gains, events: classing.events, issues: buildIssues(gains, classing.events, imp), refusals, audit, rulesVersion: table.version,
  };
}
