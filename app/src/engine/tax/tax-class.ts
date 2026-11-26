// Tax class, listed flag and sub-type of a statement lot (NB-M7a S2, parity row E-154; design
// docs/new-build/capital-gains-upload.md §9.1, §10.5, §10.5a, TR-6, TR-7, TR-16, TR-18).
//
// The class is a fact about the scheme for the financial year of the sale, worked out per lot (the purchase date
// matters for the category map's dated windows) in the order of §9.1:
//   0. the per-scheme 90/90 flag (an analyst flag): the class by sale date, steps 1 to 4 do not apply;
//   1. the analyst's class for the scheme and year (a fund of funds: equity-oriented only for sales from 2018-04-01,
//      giving the 90/90 sub-type to that year's sales; refused before, with the reason named);
//   2. the Category Name through the category map (§10.5a) to its step-2 default, with its Warning where the map
//      names one (category-default-to-confirm, usual-bucket-default); an unknown name raises category-unmapped;
//   3. the statement's Asset Name (else the tag's asset): Equity means equity-oriented (never for a fund of funds);
//      Debt means other non-equity only for units bought before 2023-04-01 (tax-class-from-statement);
//   4. otherwise not set (tax-class-not-set, and specified-test-missing for units bought from 2023-04-01).
// Listed flag: the analyst's, else listed for an ETF by its name that is not a fund of funds, else unlisted; a
// close-ended non-equity scheme without the analyst's flag has none (missing). Every date gate that the rule table
// holds is read from it; nothing of the table is restated here.

import type { DayNumber } from '../../model/value.ts';
import { normaliseLabel } from '../ids.ts';
import type { CategoryMatch, TaxRuleTable } from './rules.ts';
import { categoryDefaultClass, financialYearOf, fundTypeOfCategory, invalidKeyReason } from './rules.ts';
import type { ListedSource, SchemeInput, TaxClass, TaxClassSource, TaxSubType } from './types.ts';

/** The key of a scheme's analyst inputs: its statement label, spaces collapsed, lower case. */
export function schemeKeyOf(schemeLabel: string): string {
  return normaliseLabel(schemeLabel);
}

/** The analyst's inputs for a scheme and year: the every-year entries first, then that year's, field by field. */
export type SchemeInputView = Omit<SchemeInput, 'schemeKey' | 'fy'>;

export function schemeInputFor(inputs: readonly SchemeInput[], schemeKey: string, fy: number): SchemeInputView {
  const out: SchemeInputView = {};
  const apply = (e: SchemeInput): void => {
    if (e.taxClass !== undefined) out.taxClass = e.taxClass;
    if (e.listed !== undefined) out.listed = e.listed;
    if (e.etfFof9090 !== undefined) out.etfFof9090 = e.etfFof9090;
    if (e.closeEnded !== undefined) out.closeEnded = e.closeEnded;
    if (e.fundHouse !== undefined) out.fundHouse = e.fundHouse;
  };
  for (const e of inputs) if (e.schemeKey === schemeKey && e.fy === null) apply(e);
  for (const e of inputs) if (e.schemeKey === schemeKey && e.fy === fy) apply(e);
  return out;
}

const FOF_NAME_RE = /\bfunds? of funds?\b|\bfofs?\b/i;
const ETF_NAME_RE = /\betfs?\b|\bexchange traded\b/i;
const ELSS_NAME_RE = /\belss\b/i;

/** A fund of funds: a category of the map's fund-of-funds groups, or a scheme named as one (§9.1, TR-6). */
export function isFundOfFunds(schemeLabel: string, category: CategoryMatch | null): boolean {
  if (category !== null && /fund of funds/i.test(category.entry.sebiGroup)) return true;
  return FOF_NAME_RE.test(schemeLabel);
}

/** An ETF by its name (TR-16): decided on the scheme name, never on a mixed category label. */
export function isEtfByName(schemeLabel: string): boolean {
  return ETF_NAME_RE.test(schemeLabel);
}

/** The first sale day on which the 90/90 sub-type is equity-oriented (TR-18), from the table's valid keys. */
export function ninetyNinetyEquityFrom(table: TaxRuleTable): DayNumber {
  const row = table.keyValidity.subTypeClasses.find((r) => r.subType === 'etf-fof-90-90' && r.taxClass === 'equity-oriented');
  if (row === undefined || row.sale.from === null) throw new Error('tax-rules: no dated 90/90 equity-oriented key');
  return row.sale.from;
}

/** The first purchase day of the Specified (s.50AA, Sec 76) rows, from the table's deemed short-term rows. */
export function specifiedPurchaseFrom(table: TaxRuleTable): DayNumber {
  const days = table.rules.filter((r) => r.term === 'deemed-short').map((r) => r.purchase['specified-mf']?.from ?? null)
    .filter((d): d is DayNumber => d !== null);
  if (days.length === 0) throw new Error('tax-rules: no deemed short-term Specified row');
  return Math.min(...days);
}

export type TaxClassLot = {
  schemeLabel: string;
  category: string | null;
  statementAsset: string | null;
  tagAsset: string | null;
  purchaseDay: DayNumber | null;
  saleDay: DayNumber;
};

export type TaxFacts = {
  taxClass: TaxClass | null;
  source: TaxClassSource | null;
  subType: TaxSubType;
  /** null: missing (a close-ended non-equity scheme without the analyst's flag). */
  listed: boolean | null;
  listedSource: ListedSource;
  closeEnded: boolean;
  fundOfFunds: boolean;
  fundHouse: string | null;
  /** Validation ids raised (without the `capital-gains.` prefix). */
  flags: string[];
  labels: string[];
  /** The reason the analyst's class was not accepted, or null. */
  refusal: string | null;
};

const stripPrefix = (id: string): string => id.replace(/^capital-gains\./, '');

/** §9.1: the tax facts of one lot for the financial year of its sale. */
export function taxFactsFor(table: TaxRuleTable, lot: TaxClassLot, schemeInputs: readonly SchemeInput[]): TaxFacts {
  const fy = financialYearOf(lot.saleDay);
  const input = schemeInputFor(schemeInputs, schemeKeyOf(lot.schemeLabel), fy);
  const cat = lot.category === null ? null : fundTypeOfCategory(table, lot.category);
  const fof = isFundOfFunds(lot.schemeLabel, cat);
  // Without a purchase date the lot has no rule key (its tax is the dash); the sale day stands in for the dated
  // windows so the class can still be shown.
  const purchase = lot.purchaseDay ?? lot.saleDay;
  const nnFrom = ninetyNinetyEquityFrom(table);
  const specFrom = specifiedPurchaseFrom(table);
  const flags: string[] = [];
  const labels: string[] = [];
  let taxClass: TaxClass | null = null;
  let source: TaxClassSource | null = null;
  let subType: TaxSubType = 'none';
  let refusal: string | null = null;
  const nameSubType = (cls: TaxClass): TaxSubType => (cls === 'equity-oriented' && !fof && ELSS_NAME_RE.test(lot.schemeLabel) ? 'elss' : 'none');
  const categorySub = (): TaxSubType => {
    if (cat === null) return 'none';
    const w = categoryDefaultClass(cat, purchase, lot.saleDay);
    return w !== null && w.subType !== null ? w.subType : 'none';
  };

  if (input.etfFof9090 === true) {
    // The 90/90 sub-type sets the class by sale date for every sale (TR-18); steps 1 to 4 do not apply.
    taxClass = lot.saleDay >= nnFrom ? 'equity-oriented' : 'other-non-equity';
    subType = 'etf-fof-90-90';
    source = 'ninety-ninety';
    if (input.taxClass !== undefined && input.taxClass !== taxClass) {
      refusal = 'the scheme carries the 90/90 flag, which sets its class by sale date; clear the flag to class a year otherwise';
    }
  } else if (input.taxClass !== undefined) {
    const cls = input.taxClass;
    let sub: TaxSubType = 'none';
    if (fof && cls === 'equity-oriented') {
      if (lot.saleDay < nnFrom) refusal = 'an equity-oriented class on a fund of funds is accepted only for sales from 2018-04-01 (TR-18)';
      else sub = 'etf-fof-90-90';
    } else if (cls === 'equity-oriented') {
      sub = categorySub() === 'elss' ? 'elss' : nameSubType(cls);
    } else if (categorySub() === 'elss') {
      sub = 'elss';
    }
    if (refusal === null) {
      const why = invalidKeyReason(table, { taxClass: cls, listed: true, subType: sub, purchaseDay: purchase, saleDay: lot.saleDay });
      if (why !== null) refusal = `the class would make an invalid rule key: ${why}`;
    }
    if (refusal === null) {
      taxClass = cls;
      subType = sub;
      source = 'analyst';
    }
  }

  if (taxClass === null) {
    // Step 2: the category map.
    if (lot.category !== null && cat === null) flags.push('category-unmapped');
    if (cat !== null) {
      const w = categoryDefaultClass(cat, purchase, lot.saleDay);
      if (w !== null) {
        taxClass = w.taxClass;
        subType = w.subType ?? 'none';
        source = 'category';
        if (w.warning !== null) flags.push(stripPrefix(w.warning));
        if (w.label !== null) labels.push(w.label);
      }
    }
  }
  if (taxClass === null) {
    // Step 3: the statement's own classification.
    const asset = normaliseLabel(lot.statementAsset ?? lot.tagAsset);
    if (asset === 'equity' && !fof) {
      taxClass = 'equity-oriented';
      subType = nameSubType(taxClass);
    } else if (asset === 'debt' && lot.purchaseDay !== null && lot.purchaseDay < specFrom) {
      taxClass = 'other-non-equity';
    }
    if (taxClass !== null) {
      source = 'statement';
      flags.push('tax-class-from-statement');
      labels.push("statement's classification");
    }
  }
  if (taxClass === null) {
    // Step 4: not set.
    flags.push('tax-class-not-set');
    if (lot.purchaseDay !== null && lot.purchaseDay >= specFrom) flags.push('specified-test-missing');
  }

  // The listed flag (TR-16).
  const closeEnded = input.closeEnded === true;
  let listed: boolean | null;
  let listedSource: ListedSource;
  if (input.listed !== undefined) {
    listed = input.listed;
    listedSource = 'analyst';
  } else if (isEtfByName(lot.schemeLabel) && !fof) {
    listed = true;
    listedSource = 'etf-name';
  } else if (closeEnded && taxClass !== 'equity-oriented') {
    listed = null;
    listedSource = 'missing';
  } else {
    listed = false;
    listedSource = 'default-unlisted';
  }

  // tax-class-differs: the class against the statement's Asset Name (else the tag's asset).
  if (taxClass !== null && source !== 'statement') {
    const asset = normaliseLabel(lot.statementAsset ?? lot.tagAsset);
    if ((asset === 'equity' && taxClass !== 'equity-oriented') || (asset === 'debt' && taxClass === 'equity-oriented')) {
      flags.push('tax-class-differs');
    }
  }

  return {
    taxClass, source, subType, listed, listedSource, closeEnded, fundOfFunds: fof, fundHouse: input.fundHouse ?? null,
    flags, labels, refusal,
  };
}
