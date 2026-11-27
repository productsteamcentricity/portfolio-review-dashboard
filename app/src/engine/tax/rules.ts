// The dated tax-rule table v1 and its lookups (parity rows E-154, E-106, E-144; design
// docs/new-build/capital-gains-upload.md §9.1 rule key, §9.2 term, §10.1 rate rows and checks, §10.2 exemptions,
// §10.3 indexation, both CII series and holding periods, §10.5 and §10.5a fund types and category map, §10.6 set-off,
// §10.7 cess and surcharge).
//
// The table is data/owner/tax-rules.json (version v1, approved 2026-10-27). loadTaxRules validates its shape and turns
// every ISO date into a DayNumber; TAX_RULES_V1 is that file, loaded once at module load. Every lookup here is pure.
// A dash in the design ("to be confirmed") is null in the file with a toBeConfirmed marker, and the lookups return a
// 'to-be-confirmed' status for it: no value is invented. Every figure is indicative, not tax advice.
//
// Long term means strictly after the anniversary (OD-2, TR-1): the anniversary is N calendar months after the purchase
// date with the same day number, or the last day of that month (a 29 February purchase has its anniversary on
// 28 February of a common year). A sale on the anniversary itself is short term.

import type { DayNumber } from '../../model/value.ts';
import type { TaxClass, TaxSubType } from '../../model/tax.ts';
import { dayToYmd, ymdToDay } from '../dates.ts';
import rawTaxRules from '../../../../data/owner/tax-rules.json' with { type: 'json' };

// ---------------------------------------------------------------------------------------------------------------
// Types

/** The sub-type of a rule key: the contract's TaxSubType (model/tax.ts, I-37). */
export type SubType = TaxSubType;
export type ListedCondition = 'listed' | 'unlisted' | 'any';
export type TermSide = 'short' | 'long' | 'deemed-short';
export type CostBasis = 'actual' | 'grandfathered' | 'indexed-1981' | 'indexed-2001' | 'none' | 'per-leg';
/** A fraction (0.125 = 12.5%), the person's slab rate, the s.10(38) exemption, NE-LT-1's two legs, or null (to be confirmed). */
export type RuleRate = number | 'slab' | 'exempt' | 'two-leg' | null;
export type ExemptionGroup = 's10-38' | 's112a' | 's198';
export type SurchargeCategory = 's111a' | 's112a' | 's112' | 's196' | 's197' | 's198' | 'dividend' | 'slab';
export type CiiSeries = 'base1981' | 'base2001';
export type Regime = 'old' | 'new';

export const TAX_CLASSES: readonly TaxClass[] = ['equity-oriented', 'specified-mf', 'other-non-equity'];
export const SUB_TYPES: readonly SubType[] = ['none', 'elss', 'etf-fof-90-90'];
const LISTED_CONDITIONS: readonly ListedCondition[] = ['listed', 'unlisted', 'any'];
const TERM_SIDES: readonly TermSide[] = ['short', 'long', 'deemed-short'];
const COST_BASES: readonly CostBasis[] = ['actual', 'grandfathered', 'indexed-1981', 'indexed-2001', 'none', 'per-leg'];
const EXEMPTION_GROUPS: readonly ExemptionGroup[] = ['s10-38', 's112a', 's198'];
const SURCHARGE_CATEGORIES: readonly SurchargeCategory[] = ['s111a', 's112a', 's112', 's196', 's197', 's198', 'dividend', 'slab'];
const HOLDING_MONTHS: readonly number[] = [12, 24, 36];

/** An inclusive window of days; null means open on that side. */
export interface DayWindow { from: DayNumber | null; to: DayNumber | null }

export interface RateLeg { rate: number; costBasis: CostBasis }

export interface TaxRule {
  id: string;
  classes: readonly TaxClass[];
  subTypes: readonly SubType[];
  /** Sub-types a row does not take for sales in a window (EQ-ST-2, EQ-LT-2, EQ-LT-3: not 90/90 in FY 2018-19). */
  subTypeExclusions: readonly { subType: SubType; sale: DayWindow }[];
  listed: ListedCondition;
  saleFrom: DayNumber;
  saleTo: DayNumber | null;
  /** The purchase window per tax class; the row applies only to the classes listed here. */
  purchase: Readonly<Partial<Record<TaxClass, DayWindow>>>;
  term: TermSide;
  holdingMonths: number | null;
  rate: RuleRate;
  /** NE-LT-1 only: legs[0] is the 20% indexed leg (taken on equal positive figures), legs[1] the 10% actual leg. */
  legs: readonly RateLeg[] | null;
  legChoice: string | null;
  costBasis: CostBasis | null;
  exemptionGroup: ExemptionGroup | null;
  surchargeCategory: SurchargeCategory | null;
  toBeConfirmed: boolean;
  toBeConfirmedNote: string | null;
  sections: string;
  source: string;
}

export interface TaxCheck {
  id: string;
  classes: readonly TaxClass[];
  subType: SubType;
  saleFrom: DayNumber;
  lockInMonths: number;
  warning: string;
  keepsRateRow: boolean;
}

export interface ExemptionYear {
  fyStart: number;
  kind: 'full' | 'threshold';
  section: string;
  amount: number | null;
  excessRate: number | null;
  sharedRates: readonly number[] | null;
  allocationOrder: readonly string[] | null;
  orderSetByAct: boolean | null;
}

export interface CiiTable {
  baseFyStart: number;
  lastFyStart: number;
  values: ReadonlyMap<number, number | null>;
  toBeConfirmed: ReadonlySet<number>;
}

export interface IndexationWindow { sale: DayWindow; series: CiiSeries | null }

export interface HoldingPeriod {
  id: string;
  classes: readonly TaxClass[];
  subType: SubType | null;
  listed: ListedCondition;
  sale: DayWindow;
  purchaseFrom: DayNumber | null;
  months: number | null;
  deemedShort: boolean;
}

/** One step-2 default of §9.1: the first window that holds the lot's dates gives the class. */
export interface DefaultClassWindow {
  taxClass: TaxClass;
  subType: SubType | null;
  sale: DayWindow;
  purchaseFrom: DayNumber | null;
  warning: string | null;
  label: string | null;
  confirmClass: boolean;
}

export interface FundType {
  id: string;
  label: string;
  /** null for the two tests of §10.5 (n/a); [] for "no default". */
  stepTwoDefault: readonly DefaultClassWindow[] | null;
  isTest: boolean;
}

export interface CategoryEntry {
  names: readonly string[];
  sebiGroup: string;
  /** null where the category name is shared by several fund types ("mixed"). */
  fundType: string | null;
  defaultClass: readonly DefaultClassWindow[];
}

export interface SetOffRules {
  perPerson: boolean;
  order: readonly { step: number; losses: string }[];
  raw: Readonly<Record<string, unknown>>;
}

export interface CessYear { fyFrom: number; fyTo: number; rate: number }
export interface SurchargeYear { fyFrom: number; fyTo: number; max: number; maxNewRegime: number | null }
export interface SurchargeCapCategory { category: SurchargeCategory; fyFrom: number; fyTo: number | null }

export interface KeyValidityRow { subType: SubType; taxClass: TaxClass; sale: DayWindow }

export interface TaxRuleTable {
  version: string;
  approved: DayNumber;
  source: string;
  indicative: boolean;
  coverageFrom: DayNumber;
  keyValidity: { subTypeClasses: readonly KeyValidityRow[]; listedMayBeMissing: readonly TaxClass[]; listedFlagMissingLabel: string };
  rules: readonly TaxRule[];
  checks: readonly TaxCheck[];
  exemptions: { years: ReadonlyMap<number, ExemptionYear>; onwardFrom: number };
  cii: Readonly<Record<CiiSeries, CiiTable>>;
  indexation: { windows: readonly IndexationWindow[] };
  holdingPeriods: readonly HoldingPeriod[];
  fundTypes: ReadonlyMap<string, FundType>;
  categories: { entries: readonly CategoryEntry[]; index: ReadonlyMap<string, CategoryEntry> };
  setOff: SetOffRules;
  cess: { years: readonly CessYear[]; onwardFrom: number };
  surcharge: { years: readonly SurchargeYear[]; onwardFrom: number; capRate: number; capCategories: readonly SurchargeCapCategory[] };
}

// ---------------------------------------------------------------------------------------------------------------
// Validation helpers: each names the path of the bad value

function fail(path: string, message: string): never {
  throw new Error(`tax-rules.json: ${path}: ${message}`);
}

function asObject(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'expected an object');
  return v as Record<string, unknown>;
}

function asArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'expected an array');
  return v;
}

function asString(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0) fail(path, 'expected a non-empty string');
  return v;
}

function asOptString(v: unknown, path: string): string | null {
  return v === undefined || v === null ? null : asString(v, path);
}

function asNumber(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'expected a finite number');
  return v;
}

function asFraction(v: unknown, path: string): number {
  const n = asNumber(v, path);
  if (n < 0 || n > 1) fail(path, `rate ${n} is not a fraction between 0 and 1`);
  return n;
}

function asYear(v: unknown, path: string): number {
  const n = asNumber(v, path);
  if (!Number.isInteger(n) || n < 1900 || n > 2200) fail(path, `expected a year, got ${n}`);
  return n;
}

function asBoolean(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') fail(path, 'expected true or false');
  return v;
}

function asOneOf<T extends string>(v: unknown, allowed: readonly T[], path: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    fail(path, `expected one of ${allowed.join(', ')}, got ${JSON.stringify(v)}`);
  }
  return v as T;
}

function asDay(v: unknown, path: string): DayNumber {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) fail(path, `expected an ISO date YYYY-MM-DD, got ${JSON.stringify(v)}`);
  const day = ymdToDay(Number(v.slice(0, 4)), Number(v.slice(5, 7)), Number(v.slice(8, 10)));
  if (day === null) fail(path, `${v} is not a calendar date`);
  return day;
}

function asOptDay(v: unknown, path: string): DayNumber | null {
  return v === undefined || v === null ? null : asDay(v, path);
}

function dayWindow(from: DayNumber | null, to: DayNumber | null, path: string): DayWindow {
  if (from !== null && to !== null && from > to) fail(path, 'the window ends before it starts');
  return { from, to };
}

function inWindow(day: DayNumber, w: DayWindow): boolean {
  return (w.from === null || day >= w.from) && (w.to === null || day <= w.to);
}

// ---------------------------------------------------------------------------------------------------------------
// Loading

function readRule(v: unknown, path: string): TaxRule {
  const o = asObject(v, path);
  const id = asString(o.id, `${path}.id`);
  const p = `${path} (${id})`;
  const classes = asArray(o.classes, `${p}.classes`).map((c, i) => asOneOf(c, TAX_CLASSES, `${p}.classes[${i}]`));
  if (classes.length === 0) fail(`${p}.classes`, 'no tax class');
  const subTypes = asArray(o.subTypes, `${p}.subTypes`).map((s, i) => asOneOf(s, SUB_TYPES, `${p}.subTypes[${i}]`));
  if (subTypes.length === 0) fail(`${p}.subTypes`, 'no sub-type');
  const subTypeExclusions = asArray(o.subTypeExclusions, `${p}.subTypeExclusions`).map((e, i) => {
    const x = asObject(e, `${p}.subTypeExclusions[${i}]`);
    return {
      subType: asOneOf(x.subType, SUB_TYPES, `${p}.subTypeExclusions[${i}].subType`),
      sale: dayWindow(asOptDay(x.saleFrom, `${p}.subTypeExclusions[${i}].saleFrom`), asOptDay(x.saleTo, `${p}.subTypeExclusions[${i}].saleTo`), `${p}.subTypeExclusions[${i}]`),
    };
  });
  const saleFrom = asDay(o.saleFrom, `${p}.saleFrom`);
  const saleTo = asOptDay(o.saleTo, `${p}.saleTo`);
  dayWindow(saleFrom, saleTo, `${p}.sale`);
  const purchaseObj = asObject(o.purchase, `${p}.purchase`);
  const purchase: Partial<Record<TaxClass, DayWindow>> = {};
  for (const key of Object.keys(purchaseObj)) {
    const cls = asOneOf(key, TAX_CLASSES, `${p}.purchase key`);
    if (!classes.includes(cls)) fail(`${p}.purchase.${cls}`, 'a purchase window for a class the row does not list');
    const w = asObject(purchaseObj[key], `${p}.purchase.${cls}`);
    purchase[cls] = dayWindow(asOptDay(w.from, `${p}.purchase.${cls}.from`), asOptDay(w.to, `${p}.purchase.${cls}.to`), `${p}.purchase.${cls}`);
  }
  for (const cls of classes) if (purchase[cls] === undefined) fail(`${p}.purchase`, `no purchase window for ${cls}`);
  const term = asOneOf(o.term, TERM_SIDES, `${p}.term`);
  let holdingMonths: number | null = null;
  if (term === 'deemed-short') {
    if (o.holdingMonths !== null) fail(`${p}.holdingMonths`, 'a deemed short-term row has no holding period (null)');
  } else {
    holdingMonths = asNumber(o.holdingMonths, `${p}.holdingMonths`);
    if (!HOLDING_MONTHS.includes(holdingMonths)) fail(`${p}.holdingMonths`, `expected 12, 24 or 36, got ${holdingMonths}`);
  }
  const toBeConfirmed = o.toBeConfirmed === undefined ? false : asBoolean(o.toBeConfirmed, `${p}.toBeConfirmed`);
  let rate: RuleRate;
  if (o.rate === null) {
    if (!toBeConfirmed) fail(`${p}.rate`, 'a null rate needs toBeConfirmed: true');
    rate = null;
  } else if (typeof o.rate === 'string') {
    rate = asOneOf(o.rate, ['slab', 'exempt', 'two-leg'] as const, `${p}.rate`);
  } else {
    rate = asFraction(o.rate, `${p}.rate`);
  }
  let legs: RateLeg[] | null = null;
  if (rate === 'two-leg') {
    legs = asArray(o.legs, `${p}.legs`).map((l, i) => {
      const x = asObject(l, `${p}.legs[${i}]`);
      return { rate: asFraction(x.rate, `${p}.legs[${i}].rate`), costBasis: asOneOf(x.costBasis, COST_BASES, `${p}.legs[${i}].costBasis`) };
    });
    if (legs.length !== 2) fail(`${p}.legs`, 'a two-leg rate needs exactly two legs');
  } else if (o.legs !== undefined) {
    fail(`${p}.legs`, 'legs are given only with rate "two-leg"');
  }
  let costBasis: CostBasis | null;
  if (o.costBasis === null) {
    if (!toBeConfirmed) fail(`${p}.costBasis`, 'a null cost basis needs toBeConfirmed: true');
    costBasis = null;
  } else {
    costBasis = asOneOf(o.costBasis, COST_BASES, `${p}.costBasis`);
  }
  if ((rate === 'two-leg') !== (costBasis === 'per-leg')) fail(`${p}.costBasis`, 'cost basis "per-leg" goes with rate "two-leg" and only with it');
  return {
    id,
    classes,
    subTypes,
    subTypeExclusions,
    listed: asOneOf(o.listed, LISTED_CONDITIONS, `${p}.listed`),
    saleFrom,
    saleTo,
    purchase,
    term,
    holdingMonths,
    rate,
    legs,
    legChoice: asOptString(o.legChoice, `${p}.legChoice`),
    costBasis,
    exemptionGroup: o.exemptionGroup === null ? null : asOneOf(o.exemptionGroup, EXEMPTION_GROUPS, `${p}.exemptionGroup`),
    surchargeCategory: o.surchargeCategory === null ? null : asOneOf(o.surchargeCategory, SURCHARGE_CATEGORIES, `${p}.surchargeCategory`),
    toBeConfirmed,
    toBeConfirmedNote: asOptString(o.toBeConfirmedNote, `${p}.toBeConfirmedNote`),
    sections: asString(o.sections, `${p}.sections`),
    source: asString(o.source, `${p}.source`),
  };
}

function readDefaultWindows(v: unknown, path: string): DefaultClassWindow[] {
  return asArray(v, path).map((d, i) => {
    const x = asObject(d, `${path}[${i}]`);
    const q = `${path}[${i}]`;
    return {
      taxClass: asOneOf(x.taxClass, TAX_CLASSES, `${q}.taxClass`),
      subType: x.subType === undefined ? null : asOneOf(x.subType, SUB_TYPES, `${q}.subType`),
      sale: dayWindow(asOptDay(x.saleFrom, `${q}.saleFrom`), asOptDay(x.saleTo, `${q}.saleTo`), q),
      purchaseFrom: asOptDay(x.purchaseFrom, `${q}.purchaseFrom`),
      warning: asOptString(x.warning, `${q}.warning`),
      label: asOptString(x.label, `${q}.label`),
      confirmClass: x.confirmClass === undefined ? false : asBoolean(x.confirmClass, `${q}.confirmClass`),
    };
  });
}

function readCii(v: unknown, path: string): CiiTable {
  const o = asObject(v, path);
  const baseFyStart = asYear(o.baseFyStart, `${path}.baseFyStart`);
  const lastFyStart = asYear(o.lastFyStart, `${path}.lastFyStart`);
  const toBeConfirmed = new Set(asArray(o.toBeConfirmed, `${path}.toBeConfirmed`).map((y, i) => asYear(y, `${path}.toBeConfirmed[${i}]`)));
  const valuesObj = asObject(o.values, `${path}.values`);
  const values = new Map<number, number | null>();
  for (let fy = baseFyStart; fy <= lastFyStart; fy++) {
    const raw = valuesObj[String(fy)];
    if (raw === undefined) fail(`${path}.values`, `no entry for FY starting ${fy}`);
    if (raw === null) {
      if (!toBeConfirmed.has(fy)) fail(`${path}.values.${fy}`, 'a null index must be listed in toBeConfirmed');
      values.set(fy, null);
    } else {
      const n = asNumber(raw, `${path}.values.${fy}`);
      if (n <= 0) fail(`${path}.values.${fy}`, 'an index must be positive');
      values.set(fy, n);
    }
  }
  if (Object.keys(valuesObj).length !== values.size) fail(`${path}.values`, 'entries outside baseFyStart to lastFyStart');
  if (values.get(baseFyStart) !== 100) fail(`${path}.values.${baseFyStart}`, 'the base year index must be 100');
  for (const fy of toBeConfirmed) if (values.get(fy) !== null) fail(`${path}.toBeConfirmed`, `FY ${fy} has a value but is marked to be confirmed`);
  return { baseFyStart, lastFyStart, values, toBeConfirmed };
}

/** Validates the tax-rule file and returns the table with every date as a DayNumber. Throws on a malformed file. */
export function loadTaxRules(json: unknown): TaxRuleTable {
  const root = asObject(json, '(root)');
  const version = asString(root.version, 'version');
  const approved = asDay(root.approved, 'approved');
  const source = asString(root.source, 'source');
  const indicative = asBoolean(root.indicative, 'indicative');
  if (!indicative) fail('indicative', 'the table must be labelled indicative');
  const coverageFrom = asDay(asObject(root.coverage, 'coverage').saleFrom, 'coverage.saleFrom');

  const kv = asObject(root.keyValidity, 'keyValidity');
  const keyValidity = {
    subTypeClasses: asArray(kv.subTypeClasses, 'keyValidity.subTypeClasses').map((r, i) => {
      const x = asObject(r, `keyValidity.subTypeClasses[${i}]`);
      const q = `keyValidity.subTypeClasses[${i}]`;
      return {
        subType: asOneOf(x.subType, SUB_TYPES, `${q}.subType`),
        taxClass: asOneOf(x.taxClass, TAX_CLASSES, `${q}.taxClass`),
        sale: dayWindow(asOptDay(x.saleFrom, `${q}.saleFrom`), asOptDay(x.saleTo, `${q}.saleTo`), q),
      };
    }),
    listedMayBeMissing: asArray(kv.listedMayBeMissing, 'keyValidity.listedMayBeMissing').map((c, i) => asOneOf(c, TAX_CLASSES, `keyValidity.listedMayBeMissing[${i}]`)),
    listedFlagMissingLabel: asString(kv.listedFlagMissingLabel, 'keyValidity.listedFlagMissingLabel'),
  };

  const rules = asArray(root.rules, 'rules').map((r, i) => readRule(r, `rules[${i}]`));
  const ids = new Set<string>();
  for (const r of rules) {
    if (ids.has(r.id)) fail('rules', `duplicate rule id ${r.id}`);
    ids.add(r.id);
    if (r.saleFrom < coverageFrom) fail(`rules (${r.id}).saleFrom`, 'before the coverage start');
  }

  const checks = asArray(root.checks, 'checks').map((c, i) => {
    const x = asObject(c, `checks[${i}]`);
    const q = `checks[${i}]`;
    const id = asString(x.id, `${q}.id`);
    if (ids.has(id)) fail(`${q}.id`, `${id} is also a rate row id`);
    return {
      id,
      classes: asArray(x.classes, `${q}.classes`).map((k, j) => asOneOf(k, TAX_CLASSES, `${q}.classes[${j}]`)),
      subType: asOneOf(x.subType, SUB_TYPES, `${q}.subType`),
      saleFrom: asDay(x.saleFrom, `${q}.saleFrom`),
      lockInMonths: asNumber(x.lockInMonths, `${q}.lockInMonths`),
      warning: asString(x.warning, `${q}.warning`),
      keepsRateRow: asBoolean(x.keepsRateRow, `${q}.keepsRateRow`),
    };
  });

  const ex = asObject(root.exemptions, 'exemptions');
  const exemptionYears = new Map<number, ExemptionYear>();
  asArray(ex.years, 'exemptions.years').forEach((y, i) => {
    const x = asObject(y, `exemptions.years[${i}]`);
    const q = `exemptions.years[${i}]`;
    const fyStart = asYear(x.fyStart, `${q}.fyStart`);
    if (exemptionYears.has(fyStart)) fail(q, `FY ${fyStart} listed twice`);
    const kind = asOneOf(x.kind, ['full', 'threshold'] as const, `${q}.kind`);
    const amount = x.amount === null ? null : asNumber(x.amount, `${q}.amount`);
    if ((kind === 'threshold') !== (amount !== null)) fail(`${q}.amount`, 'a threshold year has an amount, a fully exempt year has none');
    exemptionYears.set(fyStart, {
      fyStart,
      kind,
      section: asString(x.section, `${q}.section`),
      amount,
      excessRate: x.excessRate === null ? null : asFraction(x.excessRate, `${q}.excessRate`),
      sharedRates: x.sharedRates === undefined ? null : asArray(x.sharedRates, `${q}.sharedRates`).map((r, j) => asFraction(r, `${q}.sharedRates[${j}]`)),
      allocationOrder: x.allocationOrder === undefined ? null : asArray(x.allocationOrder, `${q}.allocationOrder`).map((r, j) => {
        const rid = asString(r, `${q}.allocationOrder[${j}]`);
        if (!ids.has(rid)) fail(`${q}.allocationOrder[${j}]`, `unknown rule id ${rid}`);
        return rid;
      }),
      orderSetByAct: x.orderSetByAct === undefined ? null : asBoolean(x.orderSetByAct, `${q}.orderSetByAct`),
    });
  });
  const exOnward = asObject(ex.onward, 'exemptions.onward');
  if (exOnward.toBeConfirmed !== true || exOnward.amount !== null) fail('exemptions.onward', 'expected amount null with toBeConfirmed: true');
  const exemptionsOnwardFrom = asYear(exOnward.fyStart, 'exemptions.onward.fyStart');
  for (let fy = Math.min(...exemptionYears.keys()); fy < exemptionsOnwardFrom; fy++) {
    if (!exemptionYears.has(fy)) fail('exemptions.years', `no entry for FY starting ${fy}`);
  }

  const ciiObj = asObject(root.cii, 'cii');
  const cii = { base1981: readCii(ciiObj.base1981, 'cii.base1981'), base2001: readCii(ciiObj.base2001, 'cii.base2001') };

  const ix = asObject(root.indexation, 'indexation');
  const indexation = {
    windows: asArray(ix.windows, 'indexation.windows').map((w, i) => {
      const x = asObject(w, `indexation.windows[${i}]`);
      const q = `indexation.windows[${i}]`;
      return {
        sale: dayWindow(asDay(x.saleFrom, `${q}.saleFrom`), asOptDay(x.saleTo, `${q}.saleTo`), q),
        series: x.series === null ? null : asOneOf(x.series, ['base1981', 'base2001'] as const, `${q}.series`),
      };
    }),
  };
  if (ix.equityOriented !== 'never') fail('indexation.equityOriented', 'equity-oriented units are never indexed');

  const holdingPeriods = asArray(root.holdingPeriods, 'holdingPeriods').map((h, i) => {
    const x = asObject(h, `holdingPeriods[${i}]`);
    const q = `holdingPeriods[${i}]`;
    return {
      id: asString(x.id, `${q}.id`),
      classes: asArray(x.classes, `${q}.classes`).map((k, j) => asOneOf(k, TAX_CLASSES, `${q}.classes[${j}]`)),
      subType: x.subType === null ? null : asOneOf(x.subType, SUB_TYPES, `${q}.subType`),
      listed: asOneOf(x.listed, LISTED_CONDITIONS, `${q}.listed`),
      sale: dayWindow(asDay(x.saleFrom, `${q}.saleFrom`), asOptDay(x.saleTo, `${q}.saleTo`), q),
      purchaseFrom: asOptDay(x.purchaseFrom, `${q}.purchaseFrom`),
      months: x.months === null ? null : asNumber(x.months, `${q}.months`),
      deemedShort: x.deemedShort === undefined ? false : asBoolean(x.deemedShort, `${q}.deemedShort`),
    };
  });

  const fundTypes = new Map<string, FundType>();
  asArray(root.fundTypes, 'fundTypes').forEach((f, i) => {
    const x = asObject(f, `fundTypes[${i}]`);
    const q = `fundTypes[${i}]`;
    const id = asString(x.id, `${q}.id`);
    if (fundTypes.has(id)) fail(q, `duplicate fund type ${id}`);
    const isTest = x.isTest === undefined ? false : asBoolean(x.isTest, `${q}.isTest`);
    if (isTest !== (x.stepTwoDefault === null)) fail(`${q}.stepTwoDefault`, 'null exactly for the tests of §10.5');
    fundTypes.set(id, {
      id,
      label: asString(x.label, `${q}.label`),
      stepTwoDefault: x.stepTwoDefault === null ? null : readDefaultWindows(x.stepTwoDefault, `${q}.stepTwoDefault`),
      isTest,
    });
  });

  const cd = asObject(root.categoryDefaults, 'categoryDefaults');
  const entries: CategoryEntry[] = asArray(cd.entries, 'categoryDefaults.entries').map((e, i) => {
    const x = asObject(e, `categoryDefaults.entries[${i}]`);
    const q = `categoryDefaults.entries[${i}]`;
    const fundType = x.fundType === null ? null : asString(x.fundType, `${q}.fundType`);
    if (fundType !== null) {
      const ft = fundTypes.get(fundType);
      if (ft === undefined) fail(`${q}.fundType`, `unknown fund type ${fundType}`);
      if (ft.isTest) fail(`${q}.fundType`, `${fundType} is a test, not a fund type`);
    }
    return {
      names: asArray(x.names, `${q}.names`).map((n, j) => asString(n, `${q}.names[${j}]`)),
      sebiGroup: asString(x.sebiGroup, `${q}.sebiGroup`),
      fundType,
      defaultClass: readDefaultWindows(x.defaultClass, `${q}.defaultClass`),
    };
  });
  const index = new Map<string, CategoryEntry>();
  for (const entry of entries) {
    for (const name of entry.names) {
      const key = normaliseCategoryName(name);
      if (key === '') fail('categoryDefaults', `"${name}" normalises to nothing`);
      const prior = index.get(key);
      if (prior !== undefined && prior !== entry) fail('categoryDefaults', `"${name}" normalises to "${key}", already a key of another entry`);
      index.set(key, entry);
    }
  }

  const so = asObject(root.setOff, 'setOff');
  const setOff: SetOffRules = {
    perPerson: asBoolean(so.perPerson, 'setOff.perPerson'),
    order: asArray(so.order, 'setOff.order').map((s, i) => {
      const x = asObject(s, `setOff.order[${i}]`);
      return { step: asNumber(x.step, `setOff.order[${i}].step`), losses: asString(x.losses, `setOff.order[${i}].losses`) };
    }),
    raw: so,
  };
  if (!setOff.perPerson) fail('setOff.perPerson', 'set-off is per person (TR-15)');

  const cs = asObject(root.cess, 'cess');
  const cessYears = asArray(cs.years, 'cess.years').map((y, i) => {
    const x = asObject(y, `cess.years[${i}]`);
    const q = `cess.years[${i}]`;
    return { fyFrom: asYear(x.fyFrom, `${q}.fyFrom`), fyTo: asYear(x.fyTo, `${q}.fyTo`), rate: asFraction(x.rate, `${q}.rate`) };
  });
  const csOnward = asObject(cs.onward, 'cess.onward');
  if (csOnward.toBeConfirmed !== true || csOnward.rate !== null) fail('cess.onward', 'expected rate null with toBeConfirmed: true');
  const cessOnwardFrom = asYear(csOnward.fyStart, 'cess.onward.fyStart');
  checkContiguous(cessYears, cessOnwardFrom, 'cess.years');

  const sc = asObject(root.surcharge, 'surcharge');
  const surchargeYears = asArray(sc.years, 'surcharge.years').map((y, i) => {
    const x = asObject(y, `surcharge.years[${i}]`);
    const q = `surcharge.years[${i}]`;
    return {
      fyFrom: asYear(x.fyFrom, `${q}.fyFrom`),
      fyTo: asYear(x.fyTo, `${q}.fyTo`),
      max: asFraction(x.max, `${q}.max`),
      maxNewRegime: x.maxNewRegime === undefined ? null : asFraction(x.maxNewRegime, `${q}.maxNewRegime`),
    };
  });
  const scOnward = asObject(sc.onward, 'surcharge.onward');
  if (scOnward.toBeConfirmed !== true || scOnward.max !== null) fail('surcharge.onward', 'expected max null with toBeConfirmed: true');
  const surchargeOnwardFrom = asYear(scOnward.fyStart, 'surcharge.onward.fyStart');
  checkContiguous(surchargeYears, surchargeOnwardFrom, 'surcharge.years');
  const cap = asObject(sc.cap, 'surcharge.cap');
  const capCategories = asArray(cap.categories, 'surcharge.cap.categories').map((c, i) => {
    const x = asObject(c, `surcharge.cap.categories[${i}]`);
    const q = `surcharge.cap.categories[${i}]`;
    const category = asOneOf(x.category, SURCHARGE_CATEGORIES, `${q}.category`);
    if (category === 'slab') fail(`${q}.category`, 'slab-rate gains are never capped');
    return { category, fyFrom: asYear(x.fyFrom, `${q}.fyFrom`), fyTo: x.fyTo === null ? null : asYear(x.fyTo, `${q}.fyTo`) };
  });

  return {
    version,
    approved,
    source,
    indicative,
    coverageFrom,
    keyValidity,
    rules,
    checks,
    exemptions: { years: exemptionYears, onwardFrom: exemptionsOnwardFrom },
    cii,
    indexation,
    holdingPeriods,
    fundTypes,
    categories: { entries, index },
    setOff,
    cess: { years: cessYears, onwardFrom: cessOnwardFrom },
    surcharge: { years: surchargeYears, onwardFrom: surchargeOnwardFrom, capRate: asFraction(cap.rate, 'surcharge.cap.rate'), capCategories },
  };
}

/** Year bands must follow each other without a gap or overlap and end the year before the open-ended "onward" year. */
function checkContiguous(years: readonly { fyFrom: number; fyTo: number }[], onwardFrom: number, path: string): void {
  if (years.length === 0) fail(path, 'no years');
  for (let i = 0; i < years.length; i++) {
    const y = years[i]!;
    if (y.fyTo < y.fyFrom) fail(`${path}[${i}]`, 'fyTo before fyFrom');
    if (i > 0 && y.fyFrom !== years[i - 1]!.fyTo + 1) fail(`${path}[${i}]`, 'not contiguous with the band before');
  }
  if (years[years.length - 1]!.fyTo + 1 !== onwardFrom) fail(path, 'the last band must end the year before the onward year');
}

/** Table v1, data/owner/tax-rules.json, validated at module load. */
export const TAX_RULES_V1: TaxRuleTable = loadTaxRules(rawTaxRules);

// ---------------------------------------------------------------------------------------------------------------
// Dates

/** The start year of the financial year (tax year from 2026-27) of a day: 1 April to 31 March. */
export function financialYearOf(day: DayNumber): number {
  const { y, m } = dayToYmd(day);
  return m >= 4 ? y : y - 1;
}

/**
 * The anniversary N calendar months after a purchase: the same day number, or the last day of that month when it has
 * no such day (29 Feb 2024 + 12 months = 28 Feb 2025). Long term means strictly after this day (OD-2).
 */
export function anniversaryOf(purchaseDay: DayNumber, months: number): DayNumber {
  if (!Number.isInteger(months) || months < 0) throw new Error(`anniversaryOf: months must be a whole number, got ${months}`);
  const { y, m, d } = dayToYmd(purchaseDay);
  const index = m - 1 + months;
  const year = y + Math.floor(index / 12);
  const month = (index % 12) + 1;
  const firstOfNext = month === 12 ? ymdToDay(year + 1, 1, 1) : ymdToDay(year, month + 1, 1);
  if (firstOfNext === null) throw new Error(`anniversaryOf: year ${year} is out of range`);
  const lastDay = dayToYmd(firstOfNext - 1).d;
  return ymdToDay(year, month, Math.min(d, lastDay))!;
}

// ---------------------------------------------------------------------------------------------------------------
// The rule key and its row (§9.1)

export interface RuleKey {
  taxClass: TaxClass;
  /** Units listed on a recognised stock exchange in India; null only for a close-ended non-equity scheme with no flag. */
  listed: boolean | null;
  subType: SubType;
  purchaseDay: DayNumber;
  saleDay: DayNumber;
}

export type ListedFlagUse = 'given' | 'missing-not-needed' | 'missing-same-either-way';

export type NoRuleReason = 'outside-rule-table' | 'purchase-after-sale' | 'listed-flag-missing' | 'invalid-key' | 'no-rule';

export type RuleResult =
  | {
    kind: 'rule';
    rule: TaxRule;
    term: 'short' | 'long';
    deemedShort: boolean;
    /** The anniversary that decided the term; null for a deemed short-term row. */
    anniversary: DayNumber | null;
    holdingMonths: number | null;
    /**
     * 'given': the key had a listed flag. 'missing-not-needed': no flag, and the row is marked neither listed nor
     * unlisted, so the flag plays no part. 'missing-same-either-way': no flag, the listed and unlisted rows differ but
     * give the same term, so the unlisted row is returned, labelled keyValidity.listedFlagMissingLabel (§9.1).
     */
    listedFlag: ListedFlagUse;
  }
  | { kind: 'none'; reason: NoRuleReason; detail: string };

/** Why a key is not valid (§9.1 "The rule key"), or null when it is. Purchase and sale order are checked by ruleFor. */
export function invalidKeyReason(table: TaxRuleTable, key: RuleKey): string | null {
  const allowed = table.keyValidity.subTypeClasses.some((r) => r.subType === key.subType && r.taxClass === key.taxClass && inWindow(key.saleDay, r.sale));
  if (!allowed) {
    if (key.subType === 'elss') return 'the ELSS sub-type goes only with the equity-oriented class';
    if (key.subType === 'etf-fof-90-90') {
      return 'the 90/90 sub-type is equity-oriented for sales from 2018-04-01 and other non-equity before (TR-18); this key is never produced';
    }
    return `sub-type ${key.subType} is not valid with the class ${key.taxClass}`;
  }
  if (key.listed === null && !table.keyValidity.listedMayBeMissing.includes(key.taxClass)) {
    return 'the listed flag may be missing only for a close-ended non-equity scheme';
  }
  return null;
}

function ruleTakes(rule: TaxRule, key: RuleKey, listed: boolean): boolean {
  if (key.saleDay < rule.saleFrom || (rule.saleTo !== null && key.saleDay > rule.saleTo)) return false;
  const purchase = rule.purchase[key.taxClass];
  if (purchase === undefined || !inWindow(key.purchaseDay, purchase)) return false;
  if (!rule.subTypes.includes(key.subType)) return false;
  if (rule.subTypeExclusions.some((x) => x.subType === key.subType && inWindow(key.saleDay, x.sale))) return false;
  if (rule.listed === 'listed' && !listed) return false;
  if (rule.listed === 'unlisted' && listed) return false;
  return true;
}

type Resolved = Extract<RuleResult, { kind: 'rule' }> | { kind: 'none'; reason: 'no-rule'; detail: string };

function resolve(table: TaxRuleTable, key: RuleKey, listed: boolean): Resolved {
  const hits: Extract<RuleResult, { kind: 'rule' }>[] = [];
  for (const rule of table.rules) {
    if (!ruleTakes(rule, key, listed)) continue;
    if (rule.term === 'deemed-short') {
      hits.push({ kind: 'rule', rule, term: 'short', deemedShort: true, anniversary: null, holdingMonths: null, listedFlag: 'given' });
      continue;
    }
    const anniversary = anniversaryOf(key.purchaseDay, rule.holdingMonths!);
    const isLong = key.saleDay > anniversary;
    if ((rule.term === 'long') !== isLong) continue;
    hits.push({ kind: 'rule', rule, term: rule.term, deemedShort: false, anniversary, holdingMonths: rule.holdingMonths, listedFlag: 'given' });
  }
  if (hits.length === 1) return hits[0]!;
  return {
    kind: 'none',
    reason: 'no-rule',
    detail: hits.length === 0 ? 'no rate row matches this key' : `more than one rate row matches: ${hits.map((h) => h.rule.id).join(', ')}`,
  };
}

/**
 * The one rate row of §10.1 for a rule key, with the term, or the reason there is none. A valid key always has a row,
 * except a key with the listed flag missing whose term depends on the flag (held more than 12 and at most 24 months,
 * general-rule non-equity rows from 2024-07-23): 'listed-flag-missing'. 'no-rule' never happens for a valid key.
 */
export function ruleFor(table: TaxRuleTable, key: RuleKey): RuleResult {
  if (key.purchaseDay > key.saleDay) return { kind: 'none', reason: 'purchase-after-sale', detail: 'the purchase date is after the sale date' };
  if (key.saleDay < table.coverageFrom) return { kind: 'none', reason: 'outside-rule-table', detail: 'sales before 2004-10-01 are outside the rule table' };
  const invalid = invalidKeyReason(table, key);
  if (invalid !== null) return { kind: 'none', reason: 'invalid-key', detail: invalid };
  if (key.listed !== null) return resolve(table, key, key.listed);
  const unlisted = resolve(table, key, false);
  const listed = resolve(table, key, true);
  if (unlisted.kind === 'none') return unlisted;
  if (listed.kind === 'none') return listed;
  if (unlisted.rule === listed.rule) return { ...unlisted, listedFlag: 'missing-not-needed' };
  if (unlisted.term === listed.term && unlisted.deemedShort === listed.deemedShort) return { ...unlisted, listedFlag: 'missing-same-either-way' };
  return {
    kind: 'none',
    reason: 'listed-flag-missing',
    detail: `the term depends on the listed flag (${unlisted.rule.id} if unlisted, ${listed.rule.id} if listed)`,
  };
}

export interface CheckHit { check: TaxCheck; anniversary: DayNumber }

/**
 * The checks of §10.1 that a lot fails (EQ-ELSS-1: an ELSS sale on or before the 36-month anniversary of its allotment).
 * A check never replaces the rate row of the key.
 */
export function checksFor(table: TaxRuleTable, key: RuleKey): CheckHit[] {
  const hits: CheckHit[] = [];
  for (const check of table.checks) {
    if (!check.classes.includes(key.taxClass) || check.subType !== key.subType || key.saleDay < check.saleFrom) continue;
    const anniversary = anniversaryOf(key.purchaseDay, check.lockInMonths);
    if (key.saleDay <= anniversary) hits.push({ check, anniversary });
  }
  return hits;
}

// ---------------------------------------------------------------------------------------------------------------
// Cost Inflation Index (§10.3, TR-3)

export type CiiLookup = { kind: 'index'; value: number } | { kind: 'missing'; reason: 'to-be-confirmed' | 'outside-series' };

export function ciiOf(table: TaxRuleTable, series: CiiSeries, fyStart: number): CiiLookup {
  const s = table.cii[series];
  const value = s.values.get(fyStart);
  if (value === undefined) return { kind: 'missing', reason: 'outside-series' };
  if (value === null) return { kind: 'missing', reason: 'to-be-confirmed' };
  return { kind: 'index', value };
}

/** The CII series for a sale (§10.3): 1981 base to 2017-03-31, 2001 base to 2024-07-22, none after or for equity-oriented units. */
export function indexationSeriesFor(table: TaxRuleTable, taxClass: TaxClass, saleDay: DayNumber): CiiSeries | null {
  if (taxClass === 'equity-oriented') return null;
  const w = table.indexation.windows.find((x) => inWindow(saleDay, x.sale));
  return w === undefined ? null : w.series;
}

export type IndexedCost =
  | { kind: 'indexed'; cost: number; ciiSale: number; ciiBase: number; baseFyStart: number; saleFyStart: number; preBaseYear: boolean }
  | { kind: 'missing'; reason: 'to-be-confirmed' | 'outside-series' | 'purchase-after-sale'; fyStart: number };

/**
 * Indexed cost = cost x CII(FY of sale) / CII(later of the FY first held and the series base year), unrounded (LD-42).
 * preBaseYear marks a lot first held before the base year (Information `pre-base-year-cost`). The FY 2016-17 index of
 * the 1981 series is to be confirmed, so a sale in that year returns 'missing'.
 */
export function indexedCost(table: TaxRuleTable, cost: number, purchaseDay: DayNumber, saleDay: DayNumber, series: CiiSeries): IndexedCost {
  const saleFyStart = financialYearOf(saleDay);
  if (purchaseDay > saleDay) return { kind: 'missing', reason: 'purchase-after-sale', fyStart: saleFyStart };
  const s = table.cii[series];
  const heldFy = financialYearOf(purchaseDay);
  const baseFyStart = Math.max(heldFy, s.baseFyStart);
  const top = ciiOf(table, series, saleFyStart);
  if (top.kind === 'missing') return { kind: 'missing', reason: top.reason, fyStart: saleFyStart };
  const bottom = ciiOf(table, series, baseFyStart);
  if (bottom.kind === 'missing') return { kind: 'missing', reason: bottom.reason, fyStart: baseFyStart };
  return { kind: 'indexed', cost: (cost * top.value) / bottom.value, ciiSale: top.value, ciiBase: bottom.value, baseFyStart, saleFyStart, preBaseYear: heldFy < s.baseFyStart };
}

// ---------------------------------------------------------------------------------------------------------------
// Exemption, cess and surcharge by year (§10.2, §10.7)

export type ExemptionLookup =
  | { status: 'ok'; year: ExemptionYear }
  | { status: 'to-be-confirmed'; fyStart: number }
  | { status: 'outside-table'; fyStart: number };

export function exemptionFor(table: TaxRuleTable, fyStart: number): ExemptionLookup {
  const year = table.exemptions.years.get(fyStart);
  if (year !== undefined) return { status: 'ok', year };
  if (fyStart >= table.exemptions.onwardFrom) return { status: 'to-be-confirmed', fyStart };
  return { status: 'outside-table', fyStart };
}

export type RateLookup = { status: 'ok'; rate: number } | { status: 'to-be-confirmed' } | { status: 'outside-table' };

export function cessRateFor(table: TaxRuleTable, fyStart: number): RateLookup {
  const band = table.cess.years.find((y) => fyStart >= y.fyFrom && fyStart <= y.fyTo);
  if (band !== undefined) return { status: 'ok', rate: band.rate };
  return fyStart >= table.cess.onwardFrom ? { status: 'to-be-confirmed' } : { status: 'outside-table' };
}

export type SurchargeMaxLookup =
  | { status: 'ok'; max: number; byRegime: boolean }
  | { status: 'regime-not-set'; maxEitherRegime: number; maxOldRegime: number; maxNewRegime: number }
  | { status: 'to-be-confirmed' }
  | { status: 'outside-table' };

/**
 * The maximum surcharge rate the analyst may enter for a person and year (§9.3, §10.7). From FY 2023-24 it depends on
 * the regime: with no regime entered, an entry up to the lower maximum applies under either regime (TR-12). Before
 * FY 2023-24 the regime is ignored.
 */
export function surchargeMaxFor(table: TaxRuleTable, fyStart: number, regime: Regime | null): SurchargeMaxLookup {
  const band = table.surcharge.years.find((y) => fyStart >= y.fyFrom && fyStart <= y.fyTo);
  if (band === undefined) return fyStart >= table.surcharge.onwardFrom ? { status: 'to-be-confirmed' } : { status: 'outside-table' };
  if (band.maxNewRegime === null) return { status: 'ok', max: band.max, byRegime: false };
  if (regime === 'old') return { status: 'ok', max: band.max, byRegime: true };
  if (regime === 'new') return { status: 'ok', max: band.maxNewRegime, byRegime: true };
  return { status: 'regime-not-set', maxEitherRegime: Math.min(band.max, band.maxNewRegime), maxOldRegime: band.max, maxNewRegime: band.maxNewRegime };
}

export type SurchargeCapLookup = { status: 'capped'; cap: number } | { status: 'not-capped' } | { status: 'to-be-confirmed' } | { status: 'outside-table' };

/** The 15% cap on surcharge on tax on a capped category of the sale's FY (§10.7, TR-12); slab-rate gains are never capped. */
export function surchargeCapFor(table: TaxRuleTable, fyStart: number, category: SurchargeCategory): SurchargeCapLookup {
  const band = table.surcharge.years.find((y) => fyStart >= y.fyFrom && fyStart <= y.fyTo);
  if (band === undefined) return fyStart >= table.surcharge.onwardFrom ? { status: 'to-be-confirmed' } : { status: 'outside-table' };
  const capped = table.surcharge.capCategories.some((c) => c.category === category && fyStart >= c.fyFrom && (c.fyTo === null || fyStart <= c.fyTo));
  return capped ? { status: 'capped', cap: table.surcharge.capRate } : { status: 'not-capped' };
}

// ---------------------------------------------------------------------------------------------------------------
// Category map (§10.5a)

/**
 * The matching form of a Category Name: trimmed, inner spaces collapsed, lower case, one trailing word "fund" or
 * "funds" dropped. Two names match only when these forms are equal.
 */
export function normaliseCategoryName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^| )funds?$/, '').trim();
}

export interface CategoryMatch {
  /** The normalised key that matched. */
  key: string;
  entry: CategoryEntry;
  /** null where the name is shared by several fund types: no default (the scheme decides). */
  fundType: FundType | null;
}

/** The fund type of a statement Category Name, or null when the map does not hold it (Warning `category-unmapped`). */
export function fundTypeOfCategory(table: TaxRuleTable, categoryName: string): CategoryMatch | null {
  const key = normaliseCategoryName(categoryName);
  if (key === '') return null;
  const entry = table.categories.index.get(key);
  if (entry === undefined) return null;
  return { key, entry, fundType: entry.fundType === null ? null : table.fundTypes.get(entry.fundType)! };
}

/** The step-2 default class of §9.1 for a category entry and the lot's dates, or null for "no default". */
export function categoryDefaultClass(match: CategoryMatch, purchaseDay: DayNumber, saleDay: DayNumber): DefaultClassWindow | null {
  return match.entry.defaultClass.find((w) => inWindow(saleDay, w.sale) && (w.purchaseFrom === null || purchaseDay >= w.purchaseFrom)) ?? null;
}
