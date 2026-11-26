// The side-by-side kit, new side: the new build's shipped modules only, read and call (tests/side-by-side/ is owned by
// EX-02; app/** is Workstream B's). Base file: ingest/workbook + ingest/base-file. Matching: engine/match crosswalk and
// resolveInstrument against the shipped data/refdata universes. IRR: ingest/irr-file + engine/returns/scope (family,
// each client, each adviser), with the per-holding transaction XIRR read from the IRR tree's instrument nodes.
//
// Two things the new build does not have yet, so the kit stands in and says so in its notes:
//   - product-class routing (E-15): the universe of each holding is chosen with the live page's own rule (the product
//     label: PMS, AIF, SIF, else MF), so the comparison isolates the matcher;
//   - the performance view (E-31, E-147; M3b): `performance` is null until those modules merge.

import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../app/src/ingest/base-file.ts';
import { parseIrrFile } from '../../app/src/ingest/irr-file.ts';
import { buildCrosswalk, makeUniverse, resolveInstrument } from '../../app/src/engine/match/crosswalk.ts';
import type { Universe } from '../../app/src/engine/match/crosswalk.ts';
import { computeScopeReturns } from '../../app/src/engine/returns/scope.ts';
import type { Holding } from '../../app/src/model/holding.ts';
import type { SourceFileId } from '../../app/src/model/ids.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';
import { refdataBlock } from '../helpers/legacy-engine.ts';
import type { SbsContribution, SbsHolding, SbsInput, SbsScope, SbsSide } from './shape.ts';
import { holdingKey, labelKey } from './shape.ts';

const SRC_BASE = 'b'.repeat(64) as SourceFileId;
const SRC_IRR = 'c'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-11-26T00:00:00.000Z';

type V = { kind: string; v?: number };
const pct = (x: V | null | undefined): number | null => (x && x.kind === 'value' && typeof x.v === 'number' ? x.v / 100 : null);
const val = (x: V | null | undefined): number | null => (x && x.kind === 'value' && typeof x.v === 'number' ? x.v : null);

let universes: Record<'MF' | 'PMS' | 'AIF' | 'SIF', Universe> | null = null;
let crosswalk: ReturnType<typeof buildCrosswalk> | null = null;
function matchSetup(): { u: Record<'MF' | 'PMS' | 'AIF' | 'SIF', Universe>; cw: ReturnType<typeof buildCrosswalk> } {
  if (!universes || !crosswalk) {
    universes = {
      MF: makeUniverse('MF_PERF', refdataBlock('MF_PERF'), 'MF', 'instrument', 'MF'),
      PMS: makeUniverse('PMS_PERF', refdataBlock('PMS_PERF'), 'PMS', 'pms', 'PMS'),
      AIF: makeUniverse('AIF_PERF', refdataBlock('AIF_PERF'), 'AIF', 'instrument', 'AIF'),
      SIF: makeUniverse('SIF_PERF', refdataBlock('SIF_PERF'), 'SIF', 'instrument', 'SIF'),
    };
    crosswalk = buildCrosswalk({ fundRankCodes: refdataBlock('FUND_RANKS_CODES'), stocks: refdataBlock('STOCK_RET') });
  }
  return { u: universes, cw: crosswalk };
}

// The live page's routing rule, copied from index.html (isDirectEquity :1533; _pcrRe, nonMfClass, productClass
// :2003-2026; the performance branch :2088-2095) as a stand-in until the new build has E-15. The kit does not test
// routing: both sides route alike, so a difference is a matcher difference.
type Rule = { label: string; first: boolean; kw: RegExp | null; unless: RegExp | null; not: RegExp | null; name: RegExp | null; and: RegExp | null };
const pcrRe = (list: unknown): RegExp | null => {
  if (!Array.isArray(list) || !list.length) return null;
  // LP-16b: a "$" in a keyword is kept ("us$" is US$, never the word US); a currency word (usd, us$) may be followed by a figure
  return new RegExp('(^|[^a-z0-9])(' + list.map((k) => {
    const w = String(k).toLowerCase().replace(/[^a-z0-9\s$-]/g, '').replace(/\$/g, '\\$').replace(/[\s-]+/g, '[\\s-]*');
    return w + (/\\\$$/.test(w) || w === 'usd' ? '(?![a-z])' : '(?![a-z0-9])');
  }).join('|') + ')', 'i');
};
let rules: Rule[] | null = null;
function productRules(): Rule[] {
  rules ??= (refdataBlock('PRODUCT_CLASS_RULES') as unknown as Array<Record<string, unknown>>).map((r) => ({
    label: String(r.label), first: Boolean(r.beforePmsAifSif), kw: pcrRe(r.keywords), unless: pcrRe(r.unlessAny), not: pcrRe(r.notIf),
    name: pcrRe(r.nameAny), and: pcrRe(r.andAny),   // LP-16b: the name must say / the product or the name must say
  }));
  return rules;
}
function nonMfClass(product: string, name: string): Rule | null {
  for (const r of productRules()) {
    if (r.kw && r.kw.test(product) && !(r.unless && r.unless.test(product)) && !(r.not && r.not.test(product)) &&
      !(r.name && !r.name.test(name)) && !(r.and && !r.and.test(product) && !r.and.test(name))) return r;
  }
  return null;
}
function isDirectEquity(product: string): boolean {
  const p = product.toLowerCase();
  if (/mutual fund|pms|aif|index fund|^etf$|bond|debenture|ncd|fixed deposit|\bfd\b/.test(p)) return false;
  return /direct equity|^equity$|^equities$|stock|shares?|listed equity|scrip|sip|unlisted[\s-]*direct|direct[\s-]*unlisted/.test(p);   // LP-16b
}
/** Where the live page looks a holding up for performance: a universe, or 'none' (direct equity; LP-16's non-MF classes). */
export function legacyRoute(product: string | null | undefined, name: string | null | undefined = ''): 'MF' | 'PMS' | 'AIF' | 'SIF' | 'none' {
  const raw = String(product ?? '');
  const nm = nonMfClass(raw, String(name ?? ''));
  if (isDirectEquity(raw) && !nm) return 'none';
  const p = raw.toUpperCase();
  let cls: string;
  if (nm && nm.first) cls = nm.label;
  else if (p.includes('PMS')) cls = 'PMS';
  else if (p.includes('AIF')) cls = 'AIF';
  else if (p.includes('SIF')) cls = 'SIF';
  else cls = nm ? nm.label : 'MF';
  if (nm && cls === nm.label) return 'none';
  if (/pms/i.test(raw)) return 'PMS';
  if (/aif/i.test(raw)) return 'AIF';
  if (p.includes('SIF')) return 'SIF';
  return 'MF';
}

/** The new side in the kit's shape. */
export function runNew(input: SbsInput): SbsSide {
  const xlsx = loadSheetJS();
  const notes: string[] = [
    'new: product-class routing (E-15) is not built; both sides use the live page\'s rule (direct equity and the non-MF classes are not looked up; else PMS, AIF, SIF or MF), so routing is NOT tested here and a difference is a matcher difference.',
    'new: the performance view (E-31, E-147) is not built yet (M3b); the performance section shows the legacy rows only.',
  ];
  const base = parseBaseFile(readWorkbook(xlsx, input.baseBytes), { sourceId: SRC_BASE, now: NOW });
  const included = base.holdings.filter((h) => h.inclusion.status === 'included');
  const { u, cw } = matchSetup();

  const irr = input.irrBytes ? parseIrrFile(readWorkbook(xlsx, input.irrBytes), { sourceId: SRC_IRR, now: NOW }) : null;
  const family = computeScopeReturns({ kind: 'family' }, irr, base.holdings);

  // per holding (D11, scope.ts step 6): a holding with flows has the transaction XIRR of its own flows (its client and
  // instrument: the IRR tree's instrument node); a holding without flows keeps its base-file XIRR and BMXIRR, as the live
  // page does. An instrument the tree leaves out (D14, an invalid benchmark) falls back to its contribution line only
  // when that line is the holding alone: a line joins every holding of one name, possibly several clients, at a
  // market-value-weighted XIRR, which is not the holding's own (financial review of 5a39d92, finding 3).
  const txnF = new Map<string, number | null>();
  for (const r of family.contributions.rows) if (r.holdingIds.length === 1) txnF.set(r.holdingIds[0]!, pct(r.xirr as V));
  const txnB = new Map<string, number | null>();
  for (const n of family.tree) {
    if (n.level !== 'instrument') continue;
    for (const id of n.holdingIds) { txnF.set(id, pct(n.fund.xirr as V)); txnB.set(id, pct(n.bench.xirr as V)); }
  }
  const noFlows = new Set<string>(family.reconciliation.holdingsWithoutFlows);

  let fellBack = 0;
  const holdings: SbsHolding[] = included.map((h: Holding) => {
    const route = legacyRoute(h.product as string | null, h.instrumentName);
    const ref = route === 'none' ? null
      : resolveInstrument({ name: h.instrumentName, amc: route === 'SIF' ? '' : (h.amcLabel ?? ''), isin: h.isin ?? undefined }, u[route], cw);
    const matched = !ref || ref.resolution.method === 'none' ? null : (ref.vendorKey ?? null);
    const viaIrr = irr !== null && !noFlows.has(h.id);
    if (viaIrr && !txnF.has(h.id)) fellBack++;
    return {
      key: holdingKey(h.clientLabel, h.instrumentName, (h.folios ?? []).join('/'), h.product, h.distributorLabel),
      route,
      baseXirr: pct(h.xirr as V),
      client: h.clientLabel ?? '',
      name: h.instrumentName,
      amc: h.amcLabel ?? '',
      folio: (h.folios ?? []).join('/'),
      cmvCr: val(h.cmv as V),
      matched,
      universe: matched ? route : null,
      method: ref ? ref.resolution.method : 'not-routed (direct equity or a non-MF class)',
      xirr: viaIrr ? (txnF.get(h.id) ?? null) : pct(h.xirr as V),
      bmxirr: viaIrr ? (txnB.get(h.id) ?? null) : pct(h.bmXirr as V),
    };
  });

  if (fellBack) notes.push(`new: ${fellBack} holding(s) with flows have no own transaction XIRR (instrument left out of the tree and joined with other holdings on its line); shown as missing.`);

  const scopes: SbsScope[] = [];
  if (irr) {
    scopes.push({ key: 'family', kind: 'family', label: 'Total Portfolio', xirr: pct(family.fund.xirr as V), bmxirr: pct(family.bench.xirr as V) });
    const noIrrClients: string[] = [];
    for (const c of base.clients) {
      const r = computeScopeReturns({ kind: 'client', clientIds: [c.id] }, irr, base.holdings);
      // a client with no flows in the IRR file has no XIRR here; the live page shows a weighted average for it, which
      // the legacy side does not compare either (legacy.ts)
      if (r.fund.flows === 0) { noIrrClients.push(c.label); continue; }
      scopes.push({ key: `client | ${labelKey(c.label)}`, kind: 'client', label: c.label, xirr: pct(r.fund.xirr as V), bmxirr: pct(r.bench.xirr as V) });
    }
    if (noIrrClients.length) notes.push(`new: ${noIrrClients.length} client(s) with no flows in the IRR file (no client XIRR): ${noIrrClients.join(', ')}.`);
    for (const d of base.distributors) {
      const r = computeScopeReturns({ kind: 'advisor', distributorIds: [d.id] }, irr, base.holdings);
      scopes.push({ key: `advisor | ${labelKey(d.label)}`, kind: 'advisor', label: d.label, xirr: pct(r.fund.xirr as V), bmxirr: pct(r.bench.xirr as V) });
    }
    if (family.reconciliation.irrOnlyClients.length) notes.push(`new: ${family.reconciliation.irrOnlyClients.length} IRR-only client(s) left out of the family (OD-4).`);
  } else {
    notes.push('new: no IRR file; holding XIRRs are the base file\'s, and no scope XIRR is computed.');
  }

  const rowsByKey = new Map(family.contributions.rows.map((r) => [r.key, r]));
  const contributions: SbsContribution[] = [];
  for (const list of ['contributors', 'laggards', 'drags'] as const) {
    family.contributions[list].forEach((k, i) => {
      const r = rowsByKey.get(k);
      // a missing market value or contribution becomes NaN on purpose: sameValue treats NaN as unequal to anything, so a
      // listed line without a figure always shows as a difference instead of passing as null against null
      if (r) contributions.push({ key: `${list} | ${labelKey(r.label)}`, list, rank: i + 1, cmvCr: val(r.cmv as V) ?? NaN, contribPp: val(r.contributionPp as V) ?? NaN });
    });
  }

  return { engine: 'new', holdings, performance: null, scopes, contributions, notes };
}
