// Resolution of a base file's holdings at review time (M2.1 wiring for test build 1; parity rows E-13, E-14, E-15,
// E-19, E-125, BR-2.3; MOD-04's plan of 26 Nov 2026). Pure: the caller passes the reference blocks (app/src/data/
// refdata.ts in the page, data/refdata in the Node tests).
//
// Each holding goes to exactly one universe, as the live page routes it today (07_engine.js:1569-1617, LP-16):
//   - a listed share (isDirectEquity, and no non-MF class): STOCK_RET by ISIN, else by the normalised company name;
//   - a non-MF class of PRODUCT_CLASS_RULES (GIFT City and Offshore funds, US-dollar bonds through LRS, Fixed deposits,
//     REITs and InvITs, Unlisted shares): no fund data by design, so no match, its class kept;
//   - PMS: matchPMS over PMS_PERF; AIF: AIF_PERF with the AMC; SIF: SIF_PERF without the AMC; else MF_PERF with the AMC.
// Funds resolve through the crosswalk (the base file's ISIN first, then the name unit) with NEW_BUILD_MATCHING and the
// owner's aliases: no answer decided by candidate order (KI-036), house words not distinctive (KI-101), the stricter
// regime the owner chose on 26 Nov 2026. A holding's `instrument` is filled; the report keeps, for every holding, the
// route and the class label, for the import report's "matched to" section (E-19).

import type { Holding } from '../../model/holding.ts';
import type { LoadedBaseFile } from '../../model/review.ts';
import type { HoldingId, InstrumentRef, ProductClass } from '../../model/ids.ts';
import { buildCrosswalk, makeUniverse, resolveInstrument, type Crosswalk, type Universe } from './crosswalk.ts';
import { NEW_BUILD_MATCHING, referenceVocabulary, type MatchOptions } from './instrument.ts';
import { nameKey } from './normalize.ts';
import { parseOwnerAliases, type OwnerAliasTable } from './owner-aliases.ts';
import { holdingClass, nonMfRule, parseProductClassRules, type ProductClassRule } from './product-class.ts';
import { parseAmfiIsinRecord } from './amfi-isin.ts';

type Block = Readonly<Record<string, unknown>>;

/** The reference blocks the resolution reads; a missing block leaves its route unmatched. */
export type MatchBlocks = {
  MF_PERF: Block | null;
  SIF_PERF: Block | null;
  AIF_PERF: Block | null;
  PMS_PERF: Block | null;
  STOCK_RET: Block | null;
  FUND_RANKS_CODES: Block | null;
  PRODUCT_CLASS_RULES: unknown;
  OWNER_FUND_ALIASES: unknown;
  /** data/identifiers/amfi-isin.json, from the December refresh. */
  AMFI_ISIN?: unknown;
};

export type MatchContext = {
  universes: Partial<Record<'MF' | 'SIF' | 'AIF' | 'PMS' | 'STOCK', Universe>>;
  crosswalk: Crosswalk;
  options: MatchOptions;
  rules: readonly ProductClassRule[];
  aliasesApproved: string | null;
};

export type MatchRoute = 'MF' | 'SIF' | 'AIF' | 'PMS' | 'STOCK' | 'other';

export type HoldingMatch = {
  holdingId: HoldingId;
  route: MatchRoute;
  /** The non-MF class label (route 'other'), else null. */
  classLabel: string | null;
  ref: InstrumentRef | null;
};

export type MatchReport = {
  entries: HoldingMatch[];
  /** The universes the page carried (a route without its universe cannot match). */
  available: ReadonlyArray<'MF' | 'SIF' | 'AIF' | 'PMS' | 'STOCK'>;
  aliasesApproved: string | null;
};

/** The live page's normCo: a company name in lower case, punctuation and the words ltd, limited, the, inc, corp, co,
 * of and india dropped (07_engine.js:1054). */
export function companyKey(s: unknown): string {
  const DROP = new Set(['ltd', 'limited', 'the', 'inc', 'corp', 'co', 'of', 'india']);
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((w) => w !== '' && !DROP.has(w)).join(' ');
}

/** The live page's isDirectEquity on the product text (07_engine.js:1055-1059). */
export function isDirectEquityProduct(product: unknown): boolean {
  const p = String(product ?? '').toLowerCase();
  const words = ` ${p.replace(/[^a-z0-9]+/g, ' ').trim()} `;
  if (/mutual fund|pms|aif|index fund|^etf$|bond|debenture|ncd|fixed deposit/.test(p) || words.includes(' fd ')) return false;
  return /direct equity|^equity$|^equities$|stock|shares?|listed equity|scrip|sip/.test(p);
}

export function buildMatchContext(b: MatchBlocks): MatchContext {
  const universes: MatchContext['universes'] = {};
  if (b.MF_PERF) universes.MF = makeUniverse('MF_PERF', b.MF_PERF, 'MF', 'instrument', 'MF');
  if (b.SIF_PERF) universes.SIF = makeUniverse('SIF_PERF', b.SIF_PERF, 'SIF', 'instrument', 'SIF');
  if (b.AIF_PERF) universes.AIF = makeUniverse('AIF_PERF', b.AIF_PERF, 'AIF', 'instrument', 'AIF');
  if (b.PMS_PERF) universes.PMS = makeUniverse('PMS_PERF', b.PMS_PERF, 'PMS', 'pms', 'PMS');
  if (b.STOCK_RET) universes.STOCK = makeUniverse('STOCK_RET', b.STOCK_RET, 'EQUITY', 'stock', 'EQUITY');
  let aliases: OwnerAliasTable | undefined;
  if (b.OWNER_FUND_ALIASES !== undefined && b.OWNER_FUND_ALIASES !== null) aliases = parseOwnerAliases(b.OWNER_FUND_ALIASES);
  const sources: Parameters<typeof buildCrosswalk>[0] = { fundRankCodes: b.FUND_RANKS_CODES ?? {}, stocks: b.STOCK_RET ?? {} };
  if (aliases) sources.aliases = aliases;
  if (b.AMFI_ISIN !== undefined && b.AMFI_ISIN !== null) {
    const m = parseAmfiIsinRecord(b.AMFI_ISIN);
    sources.fundIsins = m.isinToCode;
    sources.amfiNames = m.codeToName;
  }
  /* knownWords (the normaliser follow-up): the vocabulary of the names this context can answer with, its instrument
     universes; tests/parity/matching-corrections.ts measures stage 4 with this same vocabulary */
  const instrumentNames = Object.values(universes).filter((u) => u.matcher === 'instrument').map((u) => u.keys);
  const base: MatchOptions = { ...NEW_BUILD_MATCHING, knownWords: referenceVocabulary(instrumentNames) };
  const options: MatchOptions = aliases ? { ...base, ownerAliases: aliases } : base;
  const rules = b.PRODUCT_CLASS_RULES === undefined || b.PRODUCT_CLASS_RULES === null ? [] : parseProductClassRules(b.PRODUCT_CLASS_RULES);
  return { universes, crosswalk: buildCrosswalk(sources), options, rules, aliasesApproved: aliases ? aliases.approved : null };
}

function unmatchedRef(productClass: ProductClass, name: string): InstrumentRef {
  return { productClass, nameKey: nameKey(name), resolution: { method: 'none', confidence: 'unmatched' } };
}

/** Resolves every holding; returns the holdings with `instrument` filled (new objects) and the report. */
export function resolveHoldings(holdings: readonly Holding[], ctx: MatchContext): { holdings: Holding[]; report: MatchReport } {
  const entries: HoldingMatch[] = [];
  const out = holdings.map((h): Holding => {
    const name = h.instrumentName;
    const isin = h.isin;
    let route: MatchRoute;
    let classLabel: string | null = null;
    let ref: InstrumentRef | null;
    if (isDirectEquityProduct(h.product) && !nonMfRule(h.product, ctx.rules)) {
      route = 'STOCK';
      const u = ctx.universes.STOCK;
      ref = u ? resolveInstrument(isin === undefined ? { name: companyKey(name) } : { name: companyKey(name), isin }, u, ctx.crosswalk) : unmatchedRef('EQUITY', name);
    } else {
      const c = holdingClass(h.product, ctx.rules);
      if (c.kind === 'other') {
        route = 'other';
        classLabel = c.label;
        ref = unmatchedRef(c.productClass, name);
      } else {
        route = c.productClass;
        const u = ctx.universes[c.productClass];
        const q = { name, amc: c.productClass === 'SIF' ? '' : (h.amcLabel ?? ''), ...(isin === undefined ? {} : { isin }) };
        ref = u ? resolveInstrument(q, u, ctx.crosswalk, ctx.options) : unmatchedRef(c.productClass, name);
      }
    }
    entries.push({ holdingId: h.id, route, classLabel, ref });
    return { ...h, instrument: ref };
  });
  const available = (['MF', 'SIF', 'AIF', 'PMS', 'STOCK'] as const).filter((k) => ctx.universes[k] !== undefined);
  return { holdings: out, report: { entries, available, aliasesApproved: ctx.aliasesApproved } };
}

/** Matches a loaded file's holdings with a context; the file is returned unchanged when there is none. */
export function matchLoaded(loaded: LoadedBaseFile, ctx: MatchContext | null): { loaded: LoadedBaseFile; report: MatchReport | null } {
  if (!ctx) return { loaded, report: null };
  const r = resolveHoldings(loaded.base.holdings, ctx);
  return { loaded: { ...loaded, base: { ...loaded.base, holdings: r.holdings } }, report: r.report };
}
