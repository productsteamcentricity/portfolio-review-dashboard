// The identifier crosswalk and one InstrumentRef resolution (parity rows E-125, BR-2.3, E-103, E-104, E-89, E-90;
// architecture §6.3; roadmap M2.1 sprint 1).
//
// Built at load time from the reference data (data/refdata, generated from index.html): no committed file is derived
// from it, so a monthly refresh never has to regenerate anything of the new build's (M2 plan v2 §1). Sources:
//   - FUND_RANKS_CODES: scheme name to AMFI scheme code (codes only; Screener scores and ranks are never embedded,
//     D-026);
//   - STOCK_RET: listed stock key to ISIN.
// Resolution order (stable identifiers first, names last):
//   1. ISIN, then AMFI scheme code, then vendor key (the exact reference name);
//   2. the legacy name unit unchanged (instrument.ts or pms.ts: alias pin or block, exact name, EXACT_ONLY stop, fuzzy).
// No reader reads an ISIN or AMFI column of the base file yet, so in sprint 1 steps 1's ISIN and AMFI serve only the
// reference-side joins (a stock's ISIN, a scheme's code). Nothing in the app calls this module yet: the overview's
// holdings keep `instrument: null`, and the built page does not change.
// When an identifier and the name unit disagree, the identifier wins and the name unit's answer is kept in
// `resolution.candidates`, so the conflict is visible.

import type { InstrumentRef, ProductClass, ResolutionConfidence, ResolutionMethod } from '../../model/ids.ts';
import { matchInstrumentDetail, type TokenCache } from './instrument.ts';
import { nameKey } from './normalize.ts';
import { matchPMS, type PmsCache } from './pms.ts';

/** The reference blocks whose keys are matched, by the legacy matcher each uses. */
export type UniverseName =
  | 'MF_PERF' | 'MF_PERF_DIRECT' | 'SIF_PERF' | 'PMS_PERF' | 'AIF_PERF'
  | 'EQUITY_ANALYTICS' | 'HYBRID_ANALYTICS' | 'DEBT_ANALYTICS' | 'MF_RISK' | 'STOCK_RET';

export type Universe = {
  name: UniverseName;
  productClass: ProductClass;
  /** 'instrument' (matchInstrument), 'pms' (matchPMS) or 'stock' (identifiers only in sprint 1). */
  matcher: 'instrument' | 'pms' | 'stock';
  /** Candidate names, in the order given (order decides ties, KI-036). */
  keys: readonly string[];
  keySet: ReadonlySet<string>;
  tokenCache: TokenCache;
  pmsCache: PmsCache;
};

export function makeUniverse(name: UniverseName, productClass: ProductClass, matcher: Universe['matcher'], keys: readonly string[]): Universe {
  return { name, productClass, matcher, keys, keySet: new Set(keys), tokenCache: new Map(), pmsCache: new Map() };
}

export type CrosswalkSources = {
  /** FUND_RANKS_CODES: scheme name to AMFI scheme code. */
  fundRankCodes: Readonly<Record<string, unknown>>;
  /** STOCK_RET: stock key to a record carrying `isin`. */
  stocks: Readonly<Record<string, unknown>>;
};

export type Crosswalk = {
  nameByAmfi: ReadonlyMap<string, string>;
  amfiByName: ReadonlyMap<string, string>;
  stockKeyByIsin: ReadonlyMap<string, string>;
  isinByStockKey: ReadonlyMap<string, string>;
  /** AMFI codes or ISINs carried by more than one name; such a code resolves nothing (never a guess, rule 3). */
  ambiguous: ReadonlySet<string>;
};

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const AMFI_RE = /^[0-9]{3,8}$/;

function addUnique(map: Map<string, string>, ambiguous: Set<string>, id: string, name: string): void {
  if (ambiguous.has(id)) return;
  const prev = map.get(id);
  if (prev === undefined) map.set(id, name);
  else if (prev !== name) {
    map.delete(id);
    ambiguous.add(id);
  }
}

export function buildCrosswalk(src: CrosswalkSources): Crosswalk {
  const nameByAmfi = new Map<string, string>();
  const amfiByName = new Map<string, string>();
  const stockKeyByIsin = new Map<string, string>();
  const isinByStockKey = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const [name, v] of Object.entries(src.fundRankCodes)) {
    const code = typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
    if (!AMFI_RE.test(code)) continue;
    amfiByName.set(name, code);
    addUnique(nameByAmfi, ambiguous, code, name);
  }
  for (const [key, v] of Object.entries(src.stocks)) {
    const isin = v && typeof v === 'object' && typeof (v as { isin?: unknown }).isin === 'string' ? ((v as { isin: string }).isin).trim().toUpperCase() : '';
    if (!ISIN_RE.test(isin)) continue;
    isinByStockKey.set(key, isin);
    addUnique(stockKeyByIsin, ambiguous, isin, key);
  }
  return { nameByAmfi, amfiByName, stockKeyByIsin, isinByStockKey, ambiguous };
}

export type ResolveQuery = { name: string; amc?: string; isin?: string; amfiCode?: string };

type Hit = { key: string; method: ResolutionMethod; confidence: ResolutionConfidence };

function nameUnit(q: ResolveQuery, u: Universe): Hit | null {
  if (u.matcher === 'pms') {
    const k = matchPMS(q.name, u.keys, u.pmsCache);
    return k === null ? null : { key: k, method: 'name-match', confidence: nameKey(k) === nameKey(q.name) ? 'exact' : 'proposed' };
  }
  if (u.matcher === 'stock') return null;
  const d = matchInstrumentDetail(q.name, q.amc ?? '', u.keys, u.tokenCache);
  if (d.key === null) return null;
  if (d.step === 'pin') return { key: d.key, method: 'alias-pin', confidence: 'pinned' };
  return { key: d.key, method: 'name-match', confidence: d.step === 'exact' ? 'exact' : 'proposed' };
}

function identifierHit(q: ResolveQuery, u: Universe, cw: Crosswalk): Hit | null {
  const isin = q.isin?.trim().toUpperCase();
  if (isin && ISIN_RE.test(isin)) {
    const k = cw.stockKeyByIsin.get(isin);
    if (k !== undefined && u.keySet.has(k)) return { key: k, method: 'isin', confidence: 'exact' };
  }
  const code = q.amfiCode?.trim();
  if (code && AMFI_RE.test(code)) {
    const k = cw.nameByAmfi.get(code);
    if (k !== undefined && u.keySet.has(k)) return { key: k, method: 'amfi', confidence: 'exact' };
  }
  if (u.keySet.has(q.name)) return { key: q.name, method: 'vendor-key', confidence: 'exact' };
  return null;
}

/** Resolves one holding name (and its identifiers, when a reader supplies them) against one universe. */
export function resolveInstrument(q: ResolveQuery, u: Universe, cw: Crosswalk): InstrumentRef {
  const id = identifierHit(q, u, cw);
  const byName = nameUnit(q, u);
  const hit = id ?? byName;
  const ref: InstrumentRef = {
    productClass: u.productClass,
    nameKey: nameKey(q.name),
    resolution: hit ? { method: hit.method, confidence: hit.confidence } : { method: 'none', confidence: 'unmatched' },
  };
  if (hit) {
    ref.vendorKey = hit.key;
    const code = cw.amfiByName.get(hit.key);
    if (code !== undefined) ref.amfiCode = code;
    const isin = cw.isinByStockKey.get(hit.key);
    if (isin !== undefined) ref.isin = isin;
  }
  if (id && byName && byName.key !== id.key) ref.resolution.candidates = [byName.key];
  return ref;
}
