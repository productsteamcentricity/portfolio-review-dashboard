// The identifier crosswalk and one InstrumentRef resolution (parity rows E-125, BR-2.3, E-103, E-104, E-89, E-90;
// architecture §6.3; roadmap M2.1 sprint 1).
//
// Built at load time from the reference data (data/refdata, generated from index.html): no committed file is derived
// from it, so a monthly refresh never has to regenerate anything of the new build's (M2 plan v2 §1). Sources:
//   - FUND_RANKS_CODES: scheme name to AMFI scheme code (codes only; Screener scores and ranks are never embedded,
//     D-026);
//   - STOCK_RET: listed stock key to ISIN.
// Resolution order (stable identifiers first, names last):
//   1. ISIN, then AMFI scheme code;
//   2. the legacy name unit, in the legacy order: alias block or pin first; then the vendor key (the exact reference
//      name), then the exact normalised name, the EXACT_ONLY stop and the fuzzy match (instrument.ts, pms.ts). A
//      blocked name therefore stays unmatched even when it equals a reference name, as on the live page (financial
//      review of f32ee9c, L1). With MatchOptions.ownerAliases (sprint 2a; KI-050, PD-36), an owner-approved rename
//      comes after the legacy alias step and the vendor key and before the exact normalised name; it resolves as
//      'alias-pin', confidence 'pinned'.
// Product class is never crossed (CLAUDE.md rule 4): a universe holds only the entries of one class. makeUniverse
// applies the legacy splitByClass (07_engine.js:1078-1097) to a reference block: an entry whose `pcls` is PMS or AIF
// belongs to that class, any other entry to the block's default class (financial review of f32ee9c, M2).
// No reader reads an ISIN or AMFI column of the base file yet, so in sprint 1 the ISIN and AMFI steps serve only the
// reference-side joins (a stock's ISIN, a scheme's code). Nothing in the app calls this module yet: the overview's
// holdings keep `instrument: null`, and the built page does not change. It is wired into the app only after sprint 2
// returns no match on equal scores (KI-036): until then the shipped candidate order (data/refdata, sorted) can pick a
// different fund than the live page on a tie (financial review of f32ee9c, L2; tests/parity/matching-ledger.json MT-01).
// When an identifier and the name unit disagree, the identifier wins and the name unit's answer is kept in
// `resolution.candidates`, so the conflict is visible.

import type { InstrumentRef, ProductClass, ResolutionConfidence, ResolutionMethod } from '../../model/ids.ts';
import { matchInstrumentDetail, type MatchOptions, type TokenCache } from './instrument.ts';
import { aliasFor } from './name-lists.ts';
import { nameKey } from './normalize.ts';
import { matchPMS, type PmsCache } from './pms.ts';
import { rekeyBlock } from './rekey.ts';
import type { OwnerAliasTable } from './owner-aliases.ts';

/** The reference blocks whose keys are matched, by the legacy matcher each uses. */
export type UniverseName =
  | 'MF_PERF' | 'MF_PERF_DIRECT' | 'SIF_PERF' | 'PMS_PERF' | 'AIF_PERF'
  | 'EQUITY_ANALYTICS' | 'HYBRID_ANALYTICS' | 'DEBT_ANALYTICS' | 'MF_RISK' | 'STOCK_RET';

export type Universe = {
  name: UniverseName;
  productClass: ProductClass;
  /** 'instrument' (matchInstrument), 'pms' (matchPMS) or 'stock' (identifiers only in sprint 1). */
  matcher: 'instrument' | 'pms' | 'stock';
  /** Candidate names of this class only, in the block's order (order decides ties, KI-036). */
  keys: readonly string[];
  keySet: ReadonlySet<string>;
  tokenCache: TokenCache;
  pmsCache: PmsCache;
};

/** The product class of one reference entry: its `pcls` when PMS or AIF, else the block's default class. */
export function entryClass(entry: unknown, blockDefault: ProductClass): ProductClass {
  const pc = entry && typeof entry === 'object' ? (entry as { pcls?: unknown }).pcls : undefined;
  return pc === 'PMS' || pc === 'AIF' ? pc : blockDefault;
}

/**
 * One universe of one product class from a reference block (name to entry), in the block's key order. `blockDefault`
 * is the class of entries with no PMS or AIF `pcls` (MF for the look-through and fund blocks, PMS for PMS_PERF, AIF for
 * AIF_PERF, SIF for SIF_PERF, EQUITY for STOCK_RET).
 */
export function makeUniverse(
  name: UniverseName,
  block: Readonly<Record<string, unknown>>,
  productClass: ProductClass,
  matcher: Universe['matcher'],
  blockDefault: ProductClass,
): Universe {
  const keys = Object.keys(block).filter((k) => entryClass(block[k], blockDefault) === productClass);
  return { name, productClass, matcher, keys, keySet: new Set(keys), tokenCache: new Map(), pmsCache: new Map() };
}

export type CrosswalkSources = {
  /** FUND_RANKS_CODES: scheme name to AMFI scheme code. */
  fundRankCodes: Readonly<Record<string, unknown>>;
  /** STOCK_RET: stock key to a record carrying `isin`. */
  stocks: Readonly<Record<string, unknown>>;
  /** Sprint 2a: fund ISIN to AMFI scheme code (data/identifiers/amfi-isin.json, parseAmfiIsinRecord). */
  fundIsins?: ReadonlyMap<string, string>;
  /** Sprint 2a: AMFI scheme code to its official name (amfi-isin.json codeToName): joins codes to keys FUND_RANKS_CODES
   * does not list (Direct plans, schemes it does not rank). */
  amfiNames?: ReadonlyMap<string, string>;
  /** Sprint 2a: the owner's fund aliases, so a renamed scheme's code reaches its new name (OD-23). */
  aliases?: OwnerAliasTable;
};

export type Crosswalk = {
  nameByAmfi: ReadonlyMap<string, string>;
  amfiByName: ReadonlyMap<string, string>;
  stockKeyByIsin: ReadonlyMap<string, string>;
  isinByStockKey: ReadonlyMap<string, string>;
  /** AMFI codes or ISINs carried by more than one name; such an identifier resolves nothing and is attached to no
   * result (never a guess, rule 3). */
  ambiguous: ReadonlySet<string>;
  /** Fund ISIN to AMFI scheme code (empty without fundIsins). */
  codeByFundIsin: ReadonlyMap<string, string>;
  /** The FUND_RANKS_CODES names, the official AMFI names and the aliases, for the per-universe code join. */
  fundRankNames: readonly string[];
  amfiNames: ReadonlyMap<string, string>;
  aliases?: OwnerAliasTable;
};

const codeJoinCache = new WeakMap<Universe, { keyByCode: Map<string, string>; codeByKey: Map<string, string> }>();

/* Cached on the Universe object's identity (makeUniverse builds a new one for new data; Gate B of 10687a5, N2). */
/** AMFI code to this universe's key of the same scheme, built once per universe from two sources, each re-keyed
 * (rekeyBlock: the same key, the same normalised name, plan and option, or an owner alias): the FUND_RANKS_CODES names
 * and, when given, the official AMFI names. A key the two sources give different codes, or a code two keys claim, joins
 * nothing (never a guess). */
export function codeJoin(u: Universe, cw: Crosswalk): { keyByCode: ReadonlyMap<string, string>; codeByKey: ReadonlyMap<string, string> } {
  const hit = codeJoinCache.get(u);
  if (hit) return hit;
  const claims = new Map<string, Set<string>>();
  const claim = (key: string, code: string): void => {
    const s = claims.get(key);
    if (s) s.add(code);
    else claims.set(key, new Set([code]));
  };
  for (const [key, x] of rekeyBlock(cw.fundRankNames, u.keys, cw.aliases).byUniverseKey) {
    const code = cw.amfiByName.get(x.blockKey);
    if (code !== undefined) claim(key, code);
  }
  if (cw.amfiNames.size > 0) {
    const codeOfName = new Map<string, string>();
    const twice = new Set<string>();
    for (const [code, name] of cw.amfiNames) {
      if (codeOfName.has(name)) twice.add(name);
      codeOfName.set(name, code);
    }
    const names = [...codeOfName.keys()].filter((n) => !twice.has(n));
    for (const [key, x] of rekeyBlock(names, u.keys, cw.aliases).byUniverseKey) claim(key, codeOfName.get(x.blockKey)!);
  }
  const keysOfCode = new Map<string, string[]>();
  for (const [key, codes] of claims) {
    if (codes.size !== 1) continue;
    const code = [...codes][0]!;
    const list = keysOfCode.get(code);
    if (list) list.push(key);
    else keysOfCode.set(code, [key]);
  }
  const keyByCode = new Map<string, string>();
  const codeByKey = new Map<string, string>();
  for (const [code, keys] of keysOfCode) {
    if (keys.length !== 1) continue;
    keyByCode.set(code, keys[0]!);
    codeByKey.set(keys[0]!, code);
  }
  const out = { keyByCode, codeByKey };
  codeJoinCache.set(u, out);
  return out;
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const AMFI_RE = /^[0-9]{3,8}$/;

/** id to name and name to id, keeping only identifiers carried by exactly one name. */
function uniqueIndex(pairs: ReadonlyArray<readonly [string, string]>, ambiguous: Set<string>): { byId: Map<string, string>; byName: Map<string, string> } {
  const names = new Map<string, Set<string>>();
  for (const [id, name] of pairs) {
    let s = names.get(id);
    if (!s) names.set(id, (s = new Set()));
    s.add(name);
  }
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const [id, s] of names) {
    if (s.size !== 1) {
      ambiguous.add(id);
      continue;
    }
    const name = [...s][0] as string;
    byId.set(id, name);
    byName.set(name, id);
  }
  return { byId, byName };
}

export function buildCrosswalk(src: CrosswalkSources): Crosswalk {
  const ambiguous = new Set<string>();
  const codes: Array<readonly [string, string]> = [];
  for (const [name, v] of Object.entries(src.fundRankCodes)) {
    const code = typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
    if (AMFI_RE.test(code)) codes.push([code, name]);
  }
  const isins: Array<readonly [string, string]> = [];
  for (const [key, v] of Object.entries(src.stocks)) {
    const raw = v && typeof v === 'object' ? (v as { isin?: unknown }).isin : undefined;
    const isin = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
    if (ISIN_RE.test(isin)) isins.push([isin, key]);
  }
  const amfi = uniqueIndex(codes, ambiguous);
  const stock = uniqueIndex(isins, ambiguous);
  const codeByFundIsin = new Map<string, string>();
  for (const [isin, code] of src.fundIsins ?? []) if (ISIN_RE.test(isin) && AMFI_RE.test(code) && !stock.byId.has(isin)) codeByFundIsin.set(isin, code);
  const out: Crosswalk = { nameByAmfi: amfi.byId, amfiByName: amfi.byName, stockKeyByIsin: stock.byId, isinByStockKey: stock.byName, ambiguous, codeByFundIsin, fundRankNames: [...amfi.byName.keys()], amfiNames: src.amfiNames ?? new Map() };
  if (src.aliases) out.aliases = src.aliases;
  return out;
}

export type ResolveQuery = { name: string; amc?: string; isin?: string; amfiCode?: string };

type Hit = { key: string; method: ResolutionMethod; confidence: ResolutionConfidence };

function identifierHit(q: ResolveQuery, u: Universe, cw: Crosswalk, opts?: MatchOptions): Hit | null {
  const isin = q.isin?.trim().toUpperCase();
  if (isin && ISIN_RE.test(isin)) {
    const k = cw.stockKeyByIsin.get(isin);
    if (k !== undefined && u.keySet.has(k)) return { key: k, method: 'isin', confidence: 'exact' };
    const fundCode = opts?.identifierJoin ? cw.codeByFundIsin.get(isin) : undefined;
    const fk = fundCode !== undefined && u.matcher === 'instrument' ? codeJoin(u, cw).keyByCode.get(fundCode) : undefined;
    if (fk !== undefined) return { key: fk, method: 'isin', confidence: 'exact' };
  }
  const code = q.amfiCode?.trim();
  if (code && AMFI_RE.test(code)) {
    const k = cw.nameByAmfi.get(code);
    if (k !== undefined && u.keySet.has(k)) return { key: k, method: 'amfi', confidence: 'exact' };
    const rk = opts?.identifierJoin && u.matcher === 'instrument' ? codeJoin(u, cw).keyByCode.get(code) : undefined;
    if (rk !== undefined) return { key: rk, method: 'amfi', confidence: 'exact' };
  }
  return null;
}

/** The legacy name unit, with the vendor key after the alias step and before the exact normalised name. */
function nameUnit(q: ResolveQuery, u: Universe, opts?: MatchOptions): Hit | null {
  if (u.matcher === 'stock') return u.keySet.has(q.name) ? { key: q.name, method: 'vendor-key', confidence: 'exact' } : null;
  const listed = aliasFor(nameKey(q.name));
  if (listed === undefined && u.keySet.has(q.name)) return { key: q.name, method: 'vendor-key', confidence: 'exact' };
  if (u.matcher === 'pms') {
    const k = matchPMS(q.name, u.keys, u.pmsCache);
    return k === null ? null : { key: k, method: 'name-match', confidence: nameKey(k) === nameKey(q.name) ? 'exact' : 'proposed' };
  }
  const d = matchInstrumentDetail(q.name, q.amc ?? '', u.keys, u.tokenCache, opts);
  if (d.key === null) return null;
  if (d.step === 'pin' || d.step === 'owner-alias') return { key: d.key, method: 'alias-pin', confidence: 'pinned' };
  return { key: d.key, method: 'name-match', confidence: d.step === 'exact' ? 'exact' : 'proposed' };
}

/** Resolves one holding name (and its identifiers, when a reader supplies them) against one universe of one class. */
export function resolveInstrument(q: ResolveQuery, u: Universe, cw: Crosswalk, opts?: MatchOptions): InstrumentRef {
  const id = identifierHit(q, u, cw, opts);
  const byName = nameUnit(q, u, opts);
  const hit = id ?? byName;
  const ref: InstrumentRef = {
    productClass: u.productClass,
    nameKey: nameKey(q.name),
    resolution: hit ? { method: hit.method, confidence: hit.confidence } : { method: 'none', confidence: 'unmatched' },
  };
  if (hit) {
    ref.vendorKey = hit.key;
    const code = cw.amfiByName.get(hit.key) ?? (opts?.identifierJoin && u.matcher === 'instrument' ? codeJoin(u, cw).codeByKey.get(hit.key) : undefined);
    if (code !== undefined) ref.amfiCode = code;
    const isin = cw.isinByStockKey.get(hit.key);
    if (isin !== undefined) ref.isin = isin;
  }
  if (id && byName && byName.key !== id.key) ref.resolution.candidates = [byName.key];
  return ref;
}
