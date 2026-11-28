// Tax classification of a base-file holding (parity row E-41; architecture §6.7, the engine/tax/ row; contract I-21
// `data/refdata/TAX_RULES.json`, the live current-law table, 34 rows; OD-27, KI-065, KI-099, KI-037; D-040 c, d;
// PD-16 item 7 and PD-44: the usual buckets from 1 Apr 2026, marked `usual`).
//
// A port of the live `taxClassify(h, R, refDate)` (index.html, the TAXATION section, tax batches T1 to T5 and tax-6
// merged by PR #36): ordered tests over the holding's product, category, asset and name, the category consulted before
// the asset (an arbitrage fund filed as Debt is still equity-oriented). It returns the I-21 row (`inst`) or no row with
// the live reason text (`why`). Holdings use I-21 (PLAN-03 P5, MOD-04): for a sale today it agrees with table v1 for
// every mutual-fund row (tests/unit/tax/rules.test.ts, the agreement test).
//
// Inputs the live reads from its reference data come in through `ClassifyContext`, so this stays pure:
//   - `stockIsin`: the ISIN of the STOCK_RET entry a share held directly matched (the live looks it up by company
//     name); the holding's own `isin` is read first, as the live reads a row's own isin first;
//   - `aifEntry`: the AIF_PERF entry an AIF matched (its key and category), the live `R.AIF_PERF[h.perfKey]`.
// Without them the live behaves the same as here when its lookups find nothing.
// The holding's asset is its canonical class, else its label as given, else blank (OD-7: a blank asset is unknown,
// never Equity). The live reads a blank one as "Equity"; no test below matches the word equity in the asset, so the two
// readings classify alike.

import type { DayNumber } from '../../model/value.ts';
import type { Holding } from '../../model/holding.ts';
import { ymdToDay } from '../dates.ts';
import rawI21 from '../../../../data/refdata/TAX_RULES.json' with { type: 'json' };

// ---------------------------------------------------------------------------------------------------------------
// The I-21 table

/** One side (short or long term) of an I-21 row: the rate is a fraction, or null for the slab rate or no figure. */
export type I21Leg = { label: string; period: string; rate: number | null };

/** One row of data/refdata/TAX_RULES.json (I-21), as the live REFDATA.TAX_RULES. */
export type I21Row = {
  inst: string;
  /** "More than N months" is long term; null when the row has no holding period. */
  months: number | null;
  st: I21Leg;
  lt: I21Leg;
  sec198?: boolean;
  perSecurity?: boolean;
  passThrough?: boolean;
  fundLevel?: boolean;
  alwaysShort?: boolean;
  anyPeriod?: boolean;
  noSetOff?: boolean;
  noSetOffSource?: string;
  source?: string;
  lockMonths?: number;
  /** ISO date: Specified treatment covers only units bought on or after it. */
  specifiedFrom?: string;
  /** The row that units bought before `specifiedFrom` follow. */
  before?: string;
  boughtBefore?: string;
  /** The holding period for a listed ETF, where it differs from `months`. */
  listedEtfMonths?: number;
};

function bad(i: number, what: string): never {
  throw new Error(`data/refdata/TAX_RULES.json row ${i}: ${what}`);
}

function leg(x: unknown, i: number, side: string): I21Leg {
  if (x === null || typeof x !== 'object') bad(i, `${side} is not an object`);
  const o = x as Record<string, unknown>;
  if (typeof o.label !== 'string' || typeof o.period !== 'string') bad(i, `${side} label or period is not text`);
  if (o.rate !== null && typeof o.rate !== 'number') bad(i, `${side} rate is neither a number nor null`);
  return { label: o.label, period: o.period, rate: o.rate as number | null };
}

/** Validates the I-21 table (an array of rows, each `inst` once). Throws on a malformed file. */
export function loadI21(json: unknown): readonly I21Row[] {
  if (!Array.isArray(json)) throw new Error('data/refdata/TAX_RULES.json is not an array');
  const seen = new Set<string>();
  return json.map((x, i): I21Row => {
    if (x === null || typeof x !== 'object') bad(i, 'not an object');
    const o = x as Record<string, unknown>;
    if (typeof o.inst !== 'string' || o.inst === '') bad(i, 'inst is not text');
    if (seen.has(o.inst)) bad(i, `inst "${o.inst}" appears twice`);
    seen.add(o.inst);
    if (o.months !== null && (typeof o.months !== 'number' || !Number.isInteger(o.months) || o.months < 0)) bad(i, 'months is not a whole number or null');
    for (const k of ['lockMonths', 'listedEtfMonths'] as const) {
      if (o[k] !== undefined && (typeof o[k] !== 'number' || !Number.isInteger(o[k]))) bad(i, `${k} is not a whole number`);
    }
    for (const k of ['specifiedFrom', 'boughtBefore'] as const) {
      if (o[k] !== undefined && (typeof o[k] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o[k] as string))) bad(i, `${k} is not an ISO date`);
    }
    return { ...(o as unknown as I21Row), st: leg(o.st, i, 'st'), lt: leg(o.lt, i, 'lt') };
  });
}

/** The live I-21 table (data/refdata/TAX_RULES.json, EX-02's; read only), loaded once. */
export const TAX_RULES_I21: readonly I21Row[] = loadI21(rawI21);

/**
 * Round 3 M2 (Q-49; MOD-05; CHAT-012's Gate B of M7b): the first day of the I-21 table's rates, named once. The table
 * carries one rate per class and term, with no dates: the rates in force from 23 Jul 2024, set by the Finance (No. 2)
 * Act 2024 (s.111A 20%, s.112A and s.112 12.5%; the rows of table v1, data/owner/tax-rules.json, with `saleFrom`
 * 2024-07-23). The rates before that day (for example 15% and 10% on listed equity) are not in it, so a figure that
 * needs a rate as on an earlier date is NOT AVAILABLE with I21_RATES_MISSING; no rate is invented. Holding periods,
 * splits and gains do not read the rate and stay as they are.
 */
export const I21_RATES_FROM: DayNumber = ymdToDay(2024, 7, 23)!;
/** The label of a rate-dependent figure as on a date before I21_RATES_FROM (round 3 M2). */
export const I21_RATES_MISSING = 'the rates before 23 Jul 2024 are not in the table';

/** Round 3 M2: I21_RATES_MISSING when the I-21 rates do not apply as on `asOn` (before 23 Jul 2024), else null. */
export function i21RatesMissing(asOn: DayNumber): string | null {
  return asOn < I21_RATES_FROM ? I21_RATES_MISSING : null;
}

/** The I-21 rows by `inst`. */
export function i21ByInst(table: readonly I21Row[] = TAX_RULES_I21): ReadonlyMap<string, I21Row> {
  return new Map(table.map((r) => [r.inst, r]));
}

/** The day of an I-21 ISO date (specifiedFrom, boughtBefore); null when absent or not a date. */
export function i21Day(iso: string | undefined): DayNumber | null {
  if (iso === undefined) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? ymdToDay(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Row names (the table's own `inst` text; six of them hold the table's dash, built here from its code point so this
// file holds none, D-029)

const EN = String.fromCharCode(0x2013);
export const INST = {
  listedShares: 'Listed Equity Shares',
  equityMf: 'Equity Mutual Funds',
  equityEtf: 'Equity ETFs',
  equityPms: 'Equity PMS',
  equityAif12: `Equity AIF ${EN} Cat I/II`,
  equityAif3Listed: `Equity AIF ${EN} Cat III (Listed Equity)`,
  equityAif3LongShort: `Equity AIF ${EN} Cat III (Long Short)`,
  debtAif12: `Debt AIF ${EN} Cat I/II`,
  debtAif3: `Debt AIF ${EN} Cat III`,
  debtMf: `Debt Mutual Funds ${EN} Sec. 76 (old 50AA)`,
  commodityEtf: 'Commodity ETF',
  commodityMf: 'Commodity Mutual Fund',
  listedBonds: 'Listed Bonds / NCDs',
  unlistedBonds: 'Unlisted Bonds / NCDs',
  unlistedShares: 'Unlisted Equity Shares',
  gsec: 'Government Securities / G-Secs',
  reit: 'REIT Units',
  invit: 'InvIT Units',
  sgb: 'Sovereign Gold Bonds',
  crypto: 'Crypto',
  global: 'Global Funds',
  mld: 'MLD',
  hybridEquity: 'Hybrid MF (equity-oriented)',
  hybridGeneral: 'Hybrid MF (general rule)',
  hybridSpecified: 'Hybrid MF (Specified, Sec. 76)',
  etfFof9090: 'Equity ETF FoF (90/90)',
  fofGeneral: 'Fund of Funds (general rule)',
  intlEtf: 'International ETFs (listed in India)',
  elss: 'ELSS (3-year lock-in)',
  sifEquity: 'SIF (equity long-short)',
  sifDebt: 'SIF (debt long-short, Specified)',
  foreignShares: 'Foreign-listed shares (held directly)',
} as const;

/** Why a holding is left unclassified: the live TAX_WHY texts, word for word. */
export const TAX_WHY = {
  none: 'No row in the tax rules covers this product or category.',
  p2p: 'No tax row is published for peer-to-peer lending.',
  foreignBond: 'No tax row is published for a foreign or US-dollar bond (held through the LRS, GIFT City or abroad). Confirm its tax with the tax adviser.',
  debtPms: 'No tax row is published for a debt PMS.',
  blend: 'An equity and G-Sec index blend needs its equity share to pick a tax class.',
  hybrid: 'A balanced advantage, dynamic asset allocation, multi asset or life cycle fund is taxed by what it holds over the year. Confirm its class with the AMC\'s year-end tax classification.',
  solution: 'A retirement or children\'s fund is taxed by what it holds over the year, or by the scheme it is merged into. Confirm its class with the AMC.',
  fofCons: 'A conservative fund of funds is Specified only if 65% or more of it sits in debt funds, which is not known here.',
  reitFund: 'A REIT or InvIT index fund is taxed by what it holds over the year. Confirm its class with the AMC\'s year-end tax classification.',
  sif: 'A hybrid or active asset allocator SIF is taxed by what it holds over the year. Confirm its class with the AMC\'s year-end tax classification.',
  sifExTop: 'An equity ex-top 100 long-short SIF sits close to the 65% equity floor, so its class needs the AMC\'s year-end tax classification.',
  sifOther: 'This SIF strategy is not one the tax reckoner names, so no class is applied.',
  usualBefore: 'An aggressive hybrid, arbitrage or equity savings fund is taxed by what it held over the tax year. The usual bucket per the tax reckoner applies from 1 Apr 2026; holding periods here run to an earlier date, so the AMC\'s tax classification for that year is needed.',
} as const;

/** The first day of the usual buckets (TY 2026-27; PD-16 item 7, PD-44; the live TAX_USUAL_FROM). */
export const USUAL_BUCKET_FROM: DayNumber = ymdToDay(2026, 4, 1)!;

// ---------------------------------------------------------------------------------------------------------------
// The tests (the live regular expressions, unchanged)

/** KI-099 / TX-19: the mutual-fund book's product test. */
const MF_BOOK_PRODUCT = /mutual\s*funds?\b|index\s*funds?\b|\betfs?\b|fund\s*of\s*funds?|\bfofs?\b/;
/** TX-03: product labels that mean shares held directly. */
const TAX_DE_PRODUCT = /direct equity|^equity$|^equities$|stock|\bshares?\b|listed equity|scrip/;
const TAX_FOF_NAME = /\bfofs?\b|fund of funds?|\bfeeder\b/;
/** TX-05: international schemes by name or category ("World" alone is not used). */
const TAX_INTL_NAME = /global|international|\bintl\b|overseas|off-?shore|nasdaq|s&p 500|\bnyse\b|\bfang|hang seng|china|europe|\basia|\basean\b|brazil|japan|taiwan|emerging market|developed market|(^|[^a-z])u\.?s\.?([^a-z]|$)/;
const TAX_INTL_CAT = /global|international|overseas|off-?shore/;
/** tax-6: a bond held through the LRS, GIFT City or abroad. */
const TAX_FOREIGN_BOND = /(^|[^a-z])(lrs|usd|us\$|dollars?|foreign|overseas|international|global|off[\s-]*shore|gift[\s-]*city|ifsc|euro[\s-]*bonds?)([^a-z]|$)/;
/** The dash characters the live AIF category test accepts besides the hyphen (U+2010 to U+2015, U+2212), by code. */
const DASHES = `${String.fromCharCode(0x2010)}-${String.fromCharCode(0x2015)}${String.fromCharCode(0x2212)}`;
const CAT_SEP = `[\\s.:()\\[\\]{}\\/_#,\\-${DASHES}]*`;
const AIF_CAT3 = new RegExp(`\\bcat(egory)?${CAT_SEP}(iii|three|3)\\b`);
const AIF_CAT12 = new RegExp(`\\bcat(egory)?${CAT_SEP}(ii|two|i|one|2|1)\\b`);

/** "Is a mutual-fund product" (KI-099), one definition for the tax tests. */
export function isMfBookProduct(product: string | null | undefined): boolean {
  return MF_BOOK_PRODUCT.test(String(product ?? '').toLowerCase());
}

// ---------------------------------------------------------------------------------------------------------------
// The classification

/** The holding fields the classification reads. */
export type ClassifyHolding = Pick<Holding, 'instrumentName' | 'product' | 'categoryLabel' | 'assetLabel' | 'assetClass'> & { isin?: string };

export type ClassifyContext = {
  /**
   * The tax reference date (D-040 a): from 1 Apr 2026 aggressive hybrid, arbitrage and equity savings funds take the
   * usual bucket; before it they are unclassified. Null or absent: the TY 2026-27 rules apply (the live, with no date).
   */
  refDay?: DayNumber | null;
  /** The ISIN of the STOCK_RET entry a share held directly matched, when engine/match resolved one. */
  stockIsin?: string | null;
  /** The AIF_PERF entry an AIF matched: its key (the entry's name) and its category. */
  aifEntry?: { key: string; category: string } | null;
};

/** The class of a holding: an I-21 row, or none with the reason. */
export type HoldingTaxClass = {
  inst: string | null;
  why: string | null;
  /** The usual bucket (PD-16 item 7, PD-44): "usual bucket per the tax reckoner; confirm with the fund house". */
  usual?: true;
  /** An AIF with no category in its own words or its matched entry: Category I or II assumed. */
  catAssumed?: true;
  /** A "Listed AIF": Category III by the owner's answer (PD-02). */
  catRuled?: true;
};

const K = (inst: string): HoldingTaxClass => ({ inst, why: null });
const N = (why: string): HoldingTaxClass => ({ inst: null, why });

/** TX-03, D-040 (c): a share held directly is foreign-listed only on a positive marker. */
function foreignListed(h: ClassifyHolding, p: string, c: string, ctx: ClassifyContext): boolean {
  if (/foreign|international|overseas|off[\s-]*shore|(^|[^a-z])u\.?s\.?([^a-z]|$)/.test(`${p} ${c}`)) return true;
  const isin = String(h.isin || ctx.stockIsin || '').trim().toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin) && isin.slice(0, 2) !== 'IN';
}

/** PD-54's exact name: letter case, punctuation, brackets and the word AIF ignored. */
const aifNameKey = (s: string): string => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && t !== 'aif').join(' ');

/** The live taxClassify on a new-model holding. */
export function classifyHolding(h: ClassifyHolding, ctx: ClassifyContext = {}): HoldingTaxClass {
  const a = String(h.assetClass ?? h.assetLabel ?? '').toLowerCase();
  const p = String(h.product ?? '').toLowerCase();
  const c = String(h.categoryLabel ?? '').toLowerCase();
  const n = String(h.instrumentName ?? '').toLowerCase();
  const cn = `${c} ${n}`;
  const rd = ctx.refDay ?? null;
  const UB = (inst: string): HoldingTaxClass => (rd === null || rd >= USUAL_BUCKET_FROM ? { inst, why: null, usual: true } : N(TAX_WHY.usualBefore));
  const mfp = MF_BOOK_PRODUCT.test(p);
  const fundish = mfp || !p.trim();

  // TX-13: a SIF, by its strategy name only.
  if (/sif/.test(p)) {
    if (/hybrid|active asset alloc/.test(n)) return N(TAX_WHY.sif);
    if (/ex[\s-]?top[\s-]?100/.test(n)) return N(TAX_WHY.sifExTop);
    if (/\bdebt\b/.test(n)) return K(INST.sifDebt);
    if (/sector rotation|equity long[\s-]?short/.test(n)) return K(INST.sifEquity);
    return N(TAX_WHY.sifOther);
  }
  // TX-06: a fund of funds, before every other fund test.
  const fofCat = /\b(fund of funds?|fofs?)\b/.test(c) && !/solution|\betfs?\b/.test(c);
  if (fundish && (TAX_FOF_NAME.test(n) || fofCat)) {
    if (TAX_INTL_NAME.test(n) || TAX_INTL_CAT.test(c)) return K(INST.global);
    if (/\bgold\b|\bsilver\b|commodit/.test(n) || /commodit|gold|silver/.test(`${a} ${c}`)) return K(INST.commodityMf);
    if (/bharat bond|g-?sec|gilt|\bsdl\b|liquid|overnight|money market|\bdebt\b|corporate bond|banking.*psu/.test(n)) return K(INST.debtMf);
    if (/conservative/.test(n)) return N(TAX_WHY.fofCons);
    if (/\b(etf|bees)s?\s*(fofs?|fund of funds?)\b/.test(n)) return K(INST.etfFof9090);
    return K(INST.fofGeneral);
  }
  if (/arbitrage/.test(c)) return UB(INST.equityMf);
  if (/p2p|peer/.test(p + c)) return N(TAX_WHY.p2p);
  if (/crypto|virtual digital/.test(c + n)) return K(INST.crypto);
  if (/sovereign gold bond|\bsgb\b/.test(n)) return K(INST.sgb);
  // TX-15: REIT and InvIT rows are for units held directly; an index fund of them is unclassified.
  if (/reits?\b|invits?\b/.test(cn)) {
    if (fundish && (/index\s*funds?|\betfs?\b/.test(n) || (mfp && !/mutual\s*funds?/.test(p)))) {
      return TAX_INTL_NAME.test(n) || TAX_INTL_CAT.test(c) ? K(INST.global) : N(TAX_WHY.reitFund);
    }
    return K(/reits?\b/.test(cn) ? INST.reit : INST.invit);
  }
  // tax-6: a foreign or US-dollar bond has no reckoner row.
  if (!mfp && TAX_FOREIGN_BOND.test(`${p} ${c}`) && /bond|ncd|debenture/.test(`${p} ${c}`)) return N(TAX_WHY.foreignBond);
  if (/\bmld\b|market linked/.test(c + n)) return K(INST.mld);
  // KI-065, KI-099: G-Sec rows only when the product is not a fund.
  if (!mfp && /g-?sec|government securit/.test(c + n)) return K(INST.gsec);
  // An AIF, by product first; its category read once (T5 items 4 and 10; PD-02, PD-54).
  if (/aif/.test(p)) {
    const ct = `${c} ${n} ${p}`;
    let cat3 = AIF_CAT3.test(ct);
    let st12 = !cat3 && AIF_CAT12.test(ct);
    let ruled = false;
    let lab = '';
    let same = false;
    if (!cat3 && !st12) {
      lab = ctx.aifEntry ? String(ctx.aifEntry.category ?? '').toLowerCase() : '';
      same = !!lab && aifNameKey(h.instrumentName ?? '') === aifNameKey(ctx.aifEntry?.key ?? '');
      if (same && AIF_CAT3.test(lab)) cat3 = true;
      else if (same && AIF_CAT12.test(lab)) st12 = true;
      else if (/^\s*listed\s*aif\s*$/.test(c) || (!/unlisted/.test(c) && same && /^\s*listed\s*aif\s*$/.test(lab))) ruled = true;
    }
    if (cat3 || ruled) {
      const r3 = K(/debt/.test(a) ? INST.debtAif3
        : /long[\s-]?short/.test(`${c} ${n}${same ? ` ${lab}` : ''}`) ? INST.equityAif3LongShort : INST.equityAif3Listed);
      if (ruled) r3.catRuled = true;
      return r3;
    }
    const r12 = K(/debt/.test(a) ? INST.debtAif12 : INST.equityAif12);
    if (!st12) r12.catAssumed = true;
    return r12;
  }
  if (/unlisted/.test(p + c)) return K(/debt/.test(a) ? INST.unlistedBonds : INST.unlistedShares);
  if (!mfp && /bond|ncd|debenture/.test(p + c)) return K(INST.listedBonds);
  if (/pms/.test(p)) return /debt/.test(a) ? N(TAX_WHY.debtPms) : K(INST.equityPms);
  // TX-04: a gold or silver FoF is unlisted (24 months); only a listed ETF takes 12 months.
  if (/commodit|gold|silver/.test(a + c)) {
    if (TAX_FOF_NAME.test(n)) return K(INST.commodityMf);
    if (/etf|bees/.test(n)) return K(INST.commodityEtf);
    return K(/etf/.test(c) && !TAX_FOF_NAME.test(c) ? INST.commodityEtf : INST.commodityMf);
  }
  // TX-03: shares held directly, before the international test.
  if (TAX_DE_PRODUCT.test(p) || /direct equity|equity shares/.test(c)) {
    return K(foreignListed(h, p, c, ctx) ? INST.foreignShares : INST.listedShares);
  }
  // TX-05: international funds and international ETFs listed in India.
  if (fundish ? TAX_INTL_NAME.test(n) || TAX_INTL_CAT.test(c) : /global|international|overseas|us equity/.test(c + n)) {
    return K(/etf|bees|exchange traded/.test(n) ? INST.intlEtf : INST.global);
  }
  if (mfp) {
    // TX-20: retirement and children's funds.
    if (/retire|child|bal bhavishya/.test(n) || /solution oriented\s*-?\s*(child|retire)/.test(c)) return N(TAX_WHY.solution);
    // TX-11: hybrid funds by SEBI category; the usual buckets from 1 Apr 2026 (T5).
    if (/balanced\s*hybrid/.test(cn)) return K(INST.hybridGeneral);
    if (/aggressive\s*hybrid/.test(cn)) return UB(INST.hybridEquity);
    if (/conservative\s*hybrid/.test(cn)) return K(INST.hybridSpecified);
    if (/equity\s*savings/.test(cn)) return UB(INST.hybridEquity);
    if (/arbitrage/.test(n)) return UB(INST.equityMf);
    if (/hybrid|balanced|asset alloc|equity savings|multi[\s-]?asset|life\s*cycle/.test(c)
      || /balanced advantage|asset allocation|equity savings|multi[\s-]?asset|life\s*cycle/.test(n)) return N(TAX_WHY.hybrid);
    // KI-065, OD-27: a debt fund by asset tag, by SEBI debt category, or by a G-Sec / SDL / gilt name; a ratio blend
    // ("... G-Sec 75:25") needs its equity share.
    const gsecName = /g-?sec|government securit|\bsdl\b|\bgilt\b/.test(n);
    const ratio = /\b\d{2}\s*:\s*\d{2}\b/.test(n);
    if (/debt|fixed income/.test(a)
      || /\bdebt\b|bond|gilt|g-?sec|liquid|overnight|money market|duration|credit risk|banking\s*(and|&)\s*psu|floater|floating rate|target maturity|fixed maturity|\bfmp\b/.test(c)
      || (gsecName && !ratio)) return K(INST.debtMf);
    if (gsecName && ratio) return N(TAX_WHY.blend);
    // TX-14: ELSS.
    if (/\belss\b|equity\s*linked\s*savings|tax\s*saver/.test(cn)) return K(INST.elss);
    return K(/etf|bees|exchange traded/.test(n) ? INST.equityEtf : INST.equityMf);
  }
  return N(TAX_WHY.none);
}

/** TX-02 (KI-161): a listed ETF, for the 12-month form of the general rule; a fund of funds never is one. */
export function isListedEtf(h: Pick<Holding, 'instrumentName' | 'categoryLabel' | 'product'>): boolean {
  const n = String(h.instrumentName ?? '').toLowerCase();
  const c = String(h.categoryLabel ?? '').toLowerCase();
  const p = String(h.product ?? '').toLowerCase().trim();
  if (TAX_FOF_NAME.test(n) || /\b(fund of funds?|fofs?)\b/.test(c)) return false;
  return /\betf\b|bees|exchange traded/.test(`${n} ${c}`) || /^etfs?$/.test(p);
}

/** TX-18 (KI-177): the classes the 31 Jan 2018 grandfathering can cover (counted and disclosed, never stepped up). */
export const GRANDFATHER_CLASSES: ReadonlySet<string> = new Set<string>([
  INST.listedShares, INST.equityMf, INST.equityEtf, INST.elss, INST.hybridEquity, INST.etfFof9090, INST.equityPms, INST.reit, INST.invit,
]);
/** Lots bought before this day in a grandfathering class are counted (`gfLots`). */
export const GRANDFATHER_BEFORE: DayNumber = ymdToDay(2018, 2, 1)!;
