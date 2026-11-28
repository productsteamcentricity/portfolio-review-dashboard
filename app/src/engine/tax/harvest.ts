// Tax-loss harvesting per client (parity row E-43, harvest half; NB-M7a S4b; D-040 e, f, g; PD-03; PD-07; Q-52 and
// KI-130; TX-08, TX-15, TX-16, TX-23 of the live). A port of the live `taxBuildHarvest(byClass, positions, client, A)`,
// `taxAssumeFor`, `taxSumHarvests` and `taxApplyAssumptions` (index.html, the TAXATION section as merged by PR #36):
//   - per client, never pooled: set-off and the exemption belong to each person's own return (TX-08, D-040 f); the
//     family is the field-by-field sum of the clients' harvests, labelled "sum of separate computations";
//   - pools per I-21 class and term from the roll-up's per-position pools (holdings-rollup.ts byClass) at the row's
//     rate; a slab-rate pool (rate null) has no tax figure and is ranked at the client's slab rate;
//   - a noSetOff row (Crypto, PD-03, D-043, TX-23) is kept out of set-off: its gain is taxed in full before and after,
//     and its loss reduces no other gain;
//   - the Sec 198 long-term pools form two slots: the part above the unused exemption at the rate (12.5%) and the part
//     inside it at 0%, so losses reach the exempt part last (TX-16);
//   - long-term losses go to long-term slots only, short-term losses to any slot (Sec 70, 74); order: rank (rate)
//     highest first; at an equal rank a slab pool first, then non-Sec 198 before Sec 198, short term before long, then
//     by class name; never by the size of a holding;
//   - tax before and after = the pools' gross and left amounts at their rates, less the exemption used on the Sec 198
//     gains at their rate; the saving; used and unused losses; candidates (losing records not unsplit and not noSetOff);
//     the slab-sheltered amount and the unquantified (slab) pools.
// Two new-build rules (PLAN-03 P6, MOD-04):
//   - PD-07: no slab default. SLAB_DEFAULT_PCT_HARVEST (one named place; null) applies when the analyst has entered no
//     slab rate for the client's as-on year (TaxInputs.personYear). With no slab, the ranking of the slab pools is not
//     known: the set-off is worked at the lowest and the highest slab rate (0% and SLAB_MAX_PCT_HARVEST); when both give
//     the same figures they do not depend on the slab and are shown; otherwise the after-set-off figures are the dash
//     "slab rate not set" (taxAfter, saving, used and unused losses). The live default was 30%.
//   - Q-52 (KI-130): the annual exemption is applied only when the amount already used this year is known: the
//     analyst's entry (TaxInputs.exemptionUsed: an amount, or "unused-confirmed"), else the capital-gains statement's
//     person-year `exemption.applied` (rollup.ts `values.exemptionApplied`) of the as-on financial year for the person
//     whose only review client is this client. Otherwise the result is labelled "exemption not applied" and no exemption
//     enters the tax figures. The live assumed Rs 0 used.
// M7b financial review F-3: the client's holdings not split because they are unreconciled with the IRR file are left out
// of the pools as before, but now counted (`unreconciled`) and the figures marked PARTIAL with them, with a label.
// Delta review D-1: a client with no holding split and some unreconciled has no harvest worked (`notWorked`; its Values
// NOT AVAILABLE with the reason), and the family leaves it out with a count (missing when every client is left out).
// Round 3 M1 (Q-49; CHAT-012's Gate B of M7b): such a client's plain figures, used and unused losses, harvestable loss and
// Sec 198 rate are null, and so are the family's when no client is worked, never 0 (they read 0 before); the plain used
// and unused losses under the slab dash are null too, as `figures` already held them.
// The exemption limit is the as-on year's threshold of table v1 (data/owner/tax-rules.json §10.2: Rs 1,25,000 from FY
// 2024-25); a year whose exemption is to be confirmed applies none ("exemption not applied").
// Money in rupees, unrounded (the live works in Crore: the same figures x 1e7). Pure.

import type { ClientId, HoldingId } from '../../model/ids.ts';
import type { DayNumber, Provenance, Value } from '../../model/value.ts';
import type { HarvestResult, TaxInputs } from '../../model/tax.ts';
import { STATUS } from '../../model/status.ts';
import { missing, present } from '../value.ts';
import { TAX_RULES_V1, exemptionFor, financialYearOf } from './rules.ts';
import type { TaxRuleTable } from './rules.ts';
import type { ClassPool, ClientTaxSummary, HoldingsTaxRollup } from './holdings-rollup.ts';
import type { PersonYearTaxLocal } from './types.ts';

/**
 * PD-07 (open with the owner): the slab rate (percent) used to rank slab-rate gains when the analyst has entered none.
 * null: no default; the slab pools stay unquantified and the ranking is worked at both ends (see the header). The live
 * default was 30. The one named place: either owner answer is a one-line change.
 */
export const SLAB_DEFAULT_PCT_HARVEST: number | null = null;
/** The highest slab rate before surcharge and cess (the live slabMaxPct): an entry above it is limited to it. */
export const SLAB_MAX_PCT_HARVEST = 30;
/** The label of a result whose exemption is not applied (Q-52). */
export const EXEMPTION_NOT_APPLIED = 'exemption not applied';
export const FAMILY_LABEL = 'sum of separate computations';
/**
 * The labels every harvest carries (Gate B of aa67a45 item 9 added the four after "indicative, not tax advice"): the
 * figures are tax before surcharge and cess, on the terms as on the as-on date, as if every gain were sold in the as-on
 * year, and leave out the year's realised gains and carried-forward losses.
 */
export const HARVEST_BASE_LABELS: readonly string[] = [
  'indicative, not tax advice', 'before surcharge and cess', 'terms as on the as-on date', 'all gains assumed sold in the as-on year',
  'realised gains and carried-forward losses left out', 'resident individual assumed',
  'per client: set-off and the exemption are never pooled across the family',
];
const SLAB_NOT_SET = 'slab rate not set';
const EPS = 1e-9;

// ---------------------------------------------------------------------------------------------------------------
// Types

export type HarvestTerm = 'LT' | 'ST';

/** One gain pool of a client: a class and term, its gross gain, what is left after set-off, and its rate. */
export type HarvestPool = {
  term: HarvestTerm;
  cls: string;
  clientId: ClientId | null;
  gross: number;
  /** Left after set-off; null under the dash "slab rate not set". */
  left: number | null;
  /** A fraction; null for the slab rate (no tax figure). */
  rate: number | null;
  label: string;
  s198: boolean;
  noSetOff: boolean;
};

export type HarvestCandidate = {
  holdingId: HoldingId;
  name: string;
  clientId: ClientId | null;
  cls: string;
  cmv: number;
  ltLoss: number;
  stLoss: number;
};

/** Where the amount of the exemption already used came from (Q-52). */
export type ExemptionSource = 'analyst' | 'analyst-confirmed-unused' | 'statement';

/** The exemption of one client's harvest. */
export type HarvestExemption = {
  /** The year's limit (table v1), or null when the year has no threshold amount. */
  limit: number | null;
  /** The amount already used this year, when known (Q-52). */
  used: number | null;
  source: ExemptionSource | null;
  /** Why the exemption is not applied (null when applied). */
  reason: string | null;
  /** The unused exemption applied in the figures (0 when not applied). */
  available: number;
};

/** The live harvest figures, rupees. Figures after set-off are null under the dash "slab rate not set". */
export type HarvestFigures = {
  taxBefore: number;
  taxAfter: number | null;
  saving: number | null;
  ltGains: number;
  stGains: number;
  ltLosses: number;
  stLosses: number;
  ltUsed: number | null;
  stUsed: number | null;
  ltUnused: number | null;
  stUnused: number | null;
  unquantifiedPools: number;
  unquantifiedGain: number;
  slabSheltered: number | null;
  s198Gains: number;
  s198Left: number | null;
  exBefore: number;
  exAfter: number | null;
  exBeforeTax: number;
  exAfterTax: number | null;
  noSetOffGain: number;
  noSetOffLoss: number;
};

/**
 * The figures as a result carries them: null where not known (Q-49): the after-set-off figures under the dash "slab rate
 * not set", and every figure of a client with no harvest worked or of a family with none worked (round 3 M1).
 */
export type HarvestFigureValues = { [K in keyof HarvestFigures]: number | null };

/** The figures the family sum adds field by field (the live TAX_HARVEST_SUM). */
export const HARVEST_SUM_FIELDS: ReadonlyArray<keyof HarvestFigures> = ['taxBefore', 'taxAfter', 'saving', 'ltGains', 'stGains',
  'ltLosses', 'stLosses', 'ltUsed', 'stUsed', 'ltUnused', 'stUnused', 'unquantifiedPools', 'unquantifiedGain', 'slabSheltered',
  's198Gains', 's198Left', 'exBefore', 'exAfter', 'exBeforeTax', 'exAfterTax', 'noSetOffGain', 'noSetOffLoss'];

/**
 * One client's harvest: the contract's HarvestResult (model/tax.ts) and the lines it does not carry. Engine-local:
 * `clientId` may be null (the holdings without a client label are one person, PD-44). Round 3 M1 (Q-49): the plain
 * `usedLosses`, `unusedLosses` and `harvestableLoss` are null where they are not known, never 0: under the dash "slab
 * rate not set" (the used and unused losses), and all of them for a client with no harvest worked (`notWorked`).
 */
// TODO(contracts-4): HarvestResult.clientId may be null; usedLosses and unusedLosses become nullable (round 3 M1); the
//   fields below join HarvestResult
export type HarvestLocal = Omit<HarvestResult, 'clientId' | 'usedLosses' | 'unusedLosses'> & {
  clientId: ClientId | null;
  /** The losses used in the set-off, by term; each null where not known (round 3 M1), never 0. */
  usedLosses: { st: number | null; lt: number | null };
  /** The losses left unused, by term; each null where not known (round 3 M1), never 0. */
  unusedLosses: { st: number | null; lt: number | null };
  clientLabel: string | null;
  /** The as-on financial year (its start year). */
  fy: number;
  slab: { pct: number | null; source: 'analyst' | 'default' | 'not set'; limited: boolean };
  exemption: HarvestExemption;
  /** The Sec 198 rate (the highest rate of the Sec 198 pools; 0 when none); null when no harvest is worked (M1). */
  exRate: number | null;
  /** "slab rate not set" when the after-set-off figures depend on the slab rate and none is entered; else null. */
  afterSetOffDash: string | null;
  /** The figures; all null when no harvest is worked (round 3 M1). */
  figures: HarvestFigureValues;
  pools: HarvestPool[];
  candidateDetail: HarvestCandidate[];
  /** Split holdings of the client whose gain is unknown (no invested value): left out of the pools (PARTIAL). */
  gainUnknown: number;
  /** Holdings of the client not split, unreconciled with the IRR file: left out of the pools (PARTIAL; M7b F-3). */
  unreconciled: number;
  /** The client's split holdings (a holding split at 1 Apr 2023 counted once). */
  split: number;
  /**
   * D-1: why no harvest is worked for the client (no holding split, some unreconciled with the IRR file), else null.
   * When set, the Values are NOT AVAILABLE with this reason, and the plain figures, losses and harvestable loss are
   * null (round 3 M1; before, they read 0).
   */
  notWorked: string | null;
  /**
   * DATA_DICTIONARY §6 `tax.harvestableLoss[p]`: the candidates' losses (long plus short term); null when no harvest is
   * worked (round 3 M1).
   */
  harvestableLoss: number | null;
  labels: string[];
};

/** The family: the clients' harvests added field by field, never one set-off pooled across the family. */
export type FamilyHarvest = {
  label: typeof FAMILY_LABEL;
  byClient: HarvestLocal[];
  /** Null when any worked client's figure is null (the dash), and every one when no client's harvest is worked (M1). */
  figures: HarvestFigureValues;
  taxBefore: Value<number>;
  taxAfter: Value<number>;
  saving: Value<number>;
  pools: HarvestPool[];
  candidates: HarvestCandidate[];
  /** The highest Sec 198 rate of the worked clients; null when none is worked (M1). */
  exRate: number | null;
  /** Clients whose exemption is not applied (Q-52). */
  exemptionNotApplied: number;
  gainUnknown: number;
  /** Holdings not split, unreconciled with the IRR file, over the clients (PARTIAL; M7b F-3). */
  unreconciled: number;
  /** D-1: clients with no harvest worked, left out of the sum (the family figures are missing when every client is). */
  clientsNotWorked: number;
};

/** The statement roll-up as the harvest reads it (rollup.ts RollupResult or RollupOutput). */
export type StatementYears = {
  years: ReadonlyArray<{ fy: number; persons: ReadonlyArray<Pick<PersonYearTaxLocal, 'clientId' | 'inReview' | 'personKey' | 'values'>> }>;
};

export type HarvestContext = {
  /** The review's as-on date (the tax reference date); its financial year is the harvest's year. */
  asOn: DayNumber;
  /** The analyst's entries: the slab rate per client and year (personYear), the exemption already used (Q-52). */
  inputs?: Partial<Pick<TaxInputs, 'personYear' | 'exemptionUsed'>>;
  /** The capital-gains statement's person-year roll-up (rollup.ts), when a statement is loaded. */
  statement?: StatementYears | null;
  /** PD-07: overrides SLAB_DEFAULT_PCT_HARVEST (null: no default). */
  slabDefaultPct?: number | null;
  /** The rule table for the exemption limit (default table v1). */
  table?: TaxRuleTable;
};

// ---------------------------------------------------------------------------------------------------------------
// Inputs: the slab rate (PD-07) and the exemption already used (Q-52)

function slabFor(clientId: ClientId | null, fy: number, ctx: HarvestContext): HarvestLocal['slab'] {
  const e = (ctx.inputs?.personYear ?? []).find((x) => x.clientId === clientId && x.fy === fy && x.slabPct !== null && Number.isFinite(x.slabPct));
  const def = ctx.slabDefaultPct === undefined ? SLAB_DEFAULT_PCT_HARVEST : ctx.slabDefaultPct;
  const raw = e ? e.slabPct! : def;
  if (raw === null) return { pct: null, source: 'not set', limited: false };
  const pct = Math.min(SLAB_MAX_PCT_HARVEST, Math.max(0, raw));
  return { pct, source: e ? 'analyst' : 'default', limited: pct !== raw };
}

/**
 * Q-52: the exemption already used by a client in a financial year. The analyst's entry first; else the statement's
 * person-year whose only review client is this client (rollup.ts PersonYearTaxLocal.clientId is that client, else
 * null), when exactly one such person-year exists and its `values.exemptionApplied` is present.
 */
export function exemptionUsedFor(clientId: ClientId | null, fy: number, ctx: HarvestContext): { used: number | null; source: ExemptionSource | null; reason: string | null } {
  if (clientId === null) return { used: null, source: null, reason: 'holdings without a client label: no person to read the exemption already used for' };
  const e = (ctx.inputs?.exemptionUsed ?? []).find((x) => x.clientId === clientId && x.fy === fy);
  if (e) {
    if (e.amount === 'unused-confirmed') return { used: 0, source: 'analyst-confirmed-unused', reason: null };
    if (Number.isFinite(e.amount) && e.amount >= 0) return { used: e.amount, source: 'analyst', reason: null };
  }
  const year = ctx.statement?.years.find((y) => y.fy === fy);
  if (!ctx.statement) return { used: null, source: null, reason: 'no capital-gains statement and no analyst entry for the exemption already used this year (Q-52)' };
  if (!year) return { used: null, source: null, reason: 'the capital-gains statement has no lots in this financial year and there is no analyst entry (Q-52)' };
  const hits = year.persons.filter((p) => p.inReview && p.clientId === clientId);
  if (hits.length === 0) return { used: null, source: null, reason: 'the capital-gains statement has no person for this client alone in this financial year and there is no analyst entry (Q-52)' };
  if (hits.length > 1) return { used: null, source: null, reason: 'the capital-gains statement gives more than one person for this client in this financial year (Q-52)' };
  const v = hits[0]!.values.exemptionApplied;
  if (v.kind !== 'value') return { used: null, source: null, reason: `the statement's exemption used is not available: ${v.reason}` };
  return { used: v.v, source: 'statement', reason: null };
}

// ---------------------------------------------------------------------------------------------------------------
// The set-off (the live taxBuildHarvest body)

type Slot = { b: HarvestTerm; rank: number; slab: boolean; s198: boolean; key: string; pools: CorePool[]; amt: number };
type CorePool = { b: HarvestTerm; cls: string; gross: number; left: number; rate: number | null; label: string; s198: boolean; noSetOff: boolean };
type Core = {
  pools: CorePool[]; G: number; R: number; er: number; band: number; ltLoss: number; stLoss: number; usedLt: number; usedSt: number;
  nsoGain: number; nsoLoss: number;
};

function core(byClass: readonly ClassPool[], slab: number, exAvail: number): Core {
  const pools: CorePool[] = [];
  let ltLoss = 0; let stLoss = 0; let nsoGain = 0; let nsoLoss = 0;
  for (const g of byClass) {
    const lt = g.rule?.lt; const st = g.rule?.st;
    const lr = lt && lt.rate !== null ? lt.rate : null;
    const sr = st && st.rate !== null ? st.rate : null;
    const nso = !!g.rule?.noSetOff;
    if (g.ltPos > EPS) pools.push({ b: 'LT', cls: g.cls, gross: g.ltPos, left: g.ltPos, rate: lr, label: lt?.label ?? '', s198: !!g.rule?.sec198, noSetOff: nso });
    if (g.stPos > EPS) pools.push({ b: 'ST', cls: g.cls, gross: g.stPos, left: g.stPos, rate: sr, label: st?.label ?? '', s198: false, noSetOff: nso });
    if (nso) { nsoGain += g.ltPos + g.stPos; nsoLoss += g.ltNeg + g.stNeg; continue; }
    ltLoss += g.ltNeg; stLoss += g.stNeg;
  }
  const byCls = (a: CorePool, b: CorePool): number => (a.cls < b.cls ? -1 : a.cls > b.cls ? 1 : 0);
  const s198 = pools.filter((p) => p.b === 'LT' && p.s198).sort(byCls);
  const G = s198.reduce((s, p) => s + p.gross, 0);
  const er = s198.reduce((m, p) => Math.max(m, p.rate ?? 0), 0);
  const band = Math.min(G, exAvail);
  const slots: Slot[] = [];
  for (const p of pools) {
    if (!(p.b === 'LT' && p.s198) && !p.noSetOff) slots.push({ b: p.b, rank: p.rate ?? slab, slab: p.rate === null, s198: false, key: p.cls, pools: [p], amt: p.gross });
  }
  if (s198.length) {
    slots.push({ b: 'LT', rank: er, slab: false, s198: true, key: '', pools: s198, amt: G - band });
    slots.push({ b: 'LT', rank: 0, slab: false, s198: true, key: '', pools: s198, amt: band });
  }
  const order = (a: Slot, b: Slot): number => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    if (a.slab !== b.slab) return a.slab ? -1 : 1;
    if (a.s198 !== b.s198) return a.s198 ? 1 : -1;
    if (a.b !== b.b) return a.b === 'ST' ? -1 : 1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  };
  const spend = (amount: number, eligible: Slot[]): number => {
    let rest = amount;
    for (const sl of eligible.sort(order)) {
      if (rest <= 1e-12 * 1e7 || sl.amt <= 1e-12 * 1e7) continue;
      const take = Math.min(sl.amt, rest);
      let r = take;
      sl.amt -= take; rest -= take;
      for (const p of sl.pools) { if (r <= 0) break; const q = Math.min(p.left, r); p.left -= q; r -= q; }
    }
    return amount - rest;
  };
  const usedLt = spend(ltLoss, slots.filter((s) => s.b === 'LT'));
  const usedSt = spend(stLoss, slots);
  const R = s198.reduce((s, p) => s + p.left, 0);
  return { pools, G, R, er, band, ltLoss, stLoss, usedLt, usedSt, nsoGain, nsoLoss };
}

const taxOf = (pools: readonly CorePool[], key: 'gross' | 'left'): number => pools.reduce((s, p) => s + (p.rate !== null ? p[key] * p.rate : 0), 0);

/** Two set-offs agree (the slab rate does not change them). */
function sameOutcome(a: Core, b: Core): boolean {
  const tol = 1e-6;
  if (Math.abs(a.usedLt - b.usedLt) > tol || Math.abs(a.usedSt - b.usedSt) > tol) return false;
  return a.pools.every((p, i) => Math.abs(p.left - b.pools[i]!.left) <= tol);
}

// ---------------------------------------------------------------------------------------------------------------
// One client

/** One client's harvest, from that client's own classes and records (never pooled with another client). */
export function buildHarvest(client: ClientTaxSummary, ctx: HarvestContext, prov?: Provenance): HarvestLocal {
  const fy = financialYearOf(ctx.asOn);
  const slab = slabFor(client.clientId, fy, ctx);
  const table = ctx.table ?? TAX_RULES_V1;
  const ex = exemptionFor(table, fy);
  const limit = ex.status === 'ok' && ex.year.kind === 'threshold' && ex.year.amount !== null ? ex.year.amount : null;
  const known = exemptionUsedFor(client.clientId, fy, ctx);
  let reason = known.reason;
  if (limit === null) reason = ex.status === 'to-be-confirmed' ? 'the annual exemption of the year is to be confirmed' : 'the year has no annual exemption amount in the rule table';
  const used = known.used === null || limit === null ? null : Math.min(limit, Math.max(0, known.used));
  const applied = reason === null && used !== null && limit !== null;
  const exAvail = applied ? Math.max(0, limit! - used!) : 0;

  // PD-07: with no slab rate the set-off is worked at both ends; the figures stand only when both agree.
  let c: Core; let dash: string | null = null;
  if (slab.pct !== null) c = core(client.byClass, slab.pct / 100, exAvail);
  else {
    const lo = core(client.byClass, 0, exAvail);
    const hi = core(client.byClass, SLAB_MAX_PCT_HARVEST / 100, exAvail);
    c = lo;
    if (c.pools.some((p) => p.rate === null) && !sameOutcome(lo, hi)) dash = SLAB_NOT_SET;
  }
  const exB = Math.min(c.G, exAvail); const exA = Math.min(c.R, exAvail);
  const before = taxOf(c.pools, 'gross') - exB * c.er;
  const after = taxOf(c.pools, 'left') - exA * c.er;
  const slabP = c.pools.filter((p) => p.rate === null);
  const d = <T>(x: T): T | null => (dash === null ? x : null);
  const figures: HarvestFigures = {
    taxBefore: before, taxAfter: d(after), saving: d(before - after),
    ltGains: c.pools.filter((p) => p.b === 'LT').reduce((s, p) => s + p.gross, 0),
    stGains: c.pools.filter((p) => p.b === 'ST').reduce((s, p) => s + p.gross, 0),
    ltLosses: c.ltLoss, stLosses: c.stLoss, ltUsed: d(c.usedLt), stUsed: d(c.usedSt),
    ltUnused: d(c.ltLoss - c.usedLt), stUnused: d(c.stLoss - c.usedSt),
    unquantifiedPools: slabP.length, unquantifiedGain: slabP.reduce((s, p) => s + p.gross, 0),
    slabSheltered: d(slabP.reduce((s, p) => s + (p.gross - p.left), 0)),
    s198Gains: c.G, s198Left: d(c.R), exBefore: exB, exAfter: d(exA), exBeforeTax: exB * c.er, exAfterTax: d(exA * c.er),
    noSetOffGain: c.nsoGain, noSetOffLoss: c.nsoLoss,
  };
  const facts = new Map(client.positions.map((r) => [r.holdingId, r.instrumentName]));
  const candidateDetail: HarvestCandidate[] = client.positions
    .filter((r) => r.notSplit === null && !(r.taxRule !== null && client.byClass.find((g) => g.cls === r.taxRule)?.rule?.noSetOff)
      && ((r.lt.gain !== null && r.lt.gain < 0) || (r.st.gain !== null && r.st.gain < 0)))
    .map((r) => ({
      holdingId: r.holdingId, name: facts.get(r.holdingId) ?? '', clientId: r.clientId, cls: r.taxRule ?? '', cmv: r.cmv,
      ltLoss: r.lt.gain !== null && r.lt.gain < 0 ? -r.lt.gain : 0, stLoss: r.st.gain !== null && r.st.gain < 0 ? -r.st.gain : 0,
    }))
    .sort((a, b) => (b.ltLoss + b.stLoss) - (a.ltLoss + a.stLoss));
  const gainUnknown = client.byClass.reduce((s, g) => s + g.gainUnknown, 0);
  // M7b financial review F-3: the client's holdings not split because the IRR file does not reconcile them are left out
  // of the pools too, so the figures are PARTIAL with them (never read as complete).
  const unreconciled = client.unreconciled.length;
  const p: Provenance = prov ?? { sources: [], method: 'tax-loss harvest per client (E-43)' };
  const leftOut = [gainUnknown > 0 ? `${gainUnknown} holding${gainUnknown === 1 ? '' : 's'} with an unknown gain` : null,
    unreconciled > 0 ? `${unreconciled} holding${unreconciled === 1 ? '' : 's'} not split (unreconciled with the IRR file)` : null].filter((x): x is string => x !== null);
  const note = leftOut.length ? `; ${STATUS.PARTIAL}: ${leftOut.join(' and ')} left out of the pools` : '';
  // M7b delta review D-1: a client with no holding split and some unreconciled with the IRR file has no harvest worked:
  // its figures are NOT AVAILABLE with the reason (as the unrealised figure), never Rs 0 at coverage 0.
  const split = splitHoldingsOf(client);
  const notWorked = split === 0 && unreconciled > 0
    ? `no holding of this client is split into long and short term (${unreconciled} holding${unreconciled === 1 ? '' : 's'} not split, unreconciled with the IRR file), so no harvest is worked`
    : null;
  // Round 3 M1 (Q-49): with no harvest worked, every plain figure is null (not known), never 0.
  const shown: HarvestFigureValues = notWorked !== null ? nullFigures() : figures;
  const val = (x: number | null, what: string): Value<number> => (notWorked !== null ? missing(STATUS.NOT_AVAILABLE, notWorked, p) : x === null
    ? missing(STATUS.NOT_AVAILABLE, `${SLAB_NOT_SET}: the ${what} depends on the order of set-off against slab-rate gains`, p)
    : present(x, 'inr', { ...p, method: `${p.method}; ${what}${note}` }, leftOut.length ? { coverage: coverageOf(client, gainUnknown, unreconciled) } : undefined));
  const labels = [...HARVEST_BASE_LABELS];
  if (!applied) labels.push(EXEMPTION_NOT_APPLIED);
  else if (known.source === 'statement') labels.push('exemption already used read from the capital-gains statement; gains outside the statement are not included');
  if (slab.source === 'not set' && slabP.length > 0) labels.push(`${SLAB_NOT_SET}: slab-rate gains have no tax figure`);
  if (slab.source === 'default') labels.push('slab rate: the default (PD-07)');
  if (slab.limited) labels.push(`the slab entry is limited to ${SLAB_MAX_PCT_HARVEST}%`);
  if (dash !== null) labels.push(`${SLAB_NOT_SET}: the figures after set-off depend on the slab rate`);
  if (c.nsoGain + c.nsoLoss > EPS) labels.push('crypto kept out of set-off (PD-03)');
  if (gainUnknown > 0) labels.push(`${gainUnknown} holding${gainUnknown === 1 ? '' : 's'} with an unknown gain left out (${STATUS.PARTIAL})`);
  if (notWorked !== null) labels.push(notWorked);
  else if (unreconciled > 0) labels.push(`${unreconciled} holding${unreconciled === 1 ? '' : 's'} not split (unreconciled with the IRR file) left out (${STATUS.PARTIAL})`);
  const pools: HarvestPool[] = c.pools.map((x) => ({
    term: x.b, cls: x.cls, clientId: client.clientId, gross: x.gross, left: dash === null ? x.left : null, rate: x.rate, label: x.label,
    s198: x.s198, noSetOff: x.noSetOff,
  }));
  return {
    clientId: client.clientId, clientLabel: client.clientLabel, fy, slabPct: slab.pct, slab,
    exemptionApplied: applied ? 'applied' : EXEMPTION_NOT_APPLIED,
    exemption: { limit, used, source: known.source, reason: applied ? null : reason, available: exAvail },
    exRate: notWorked !== null ? null : c.er, afterSetOffDash: dash, figures: shown,
    taxBefore: val(figures.taxBefore, 'tax before harvesting'),
    taxAfter: val(figures.taxAfter, 'tax after harvesting'),
    saving: val(figures.saving, 'saving'),
    candidates: [...new Set(candidateDetail.map((x) => x.holdingId))],
    // Round 3 M1: the plain losses carry the figures' nulls (the slab dash, no harvest worked), never 0.
    usedLosses: { st: shown.stUsed, lt: shown.ltUsed },
    unusedLosses: { st: shown.stUnused, lt: shown.ltUnused },
    unquantifiedPools: slabP.map((x) => `${x.cls}, ${x.b === 'LT' ? 'long term' : 'short term'}`),
    pools, candidateDetail, gainUnknown, unreconciled, split, notWorked,
    harvestableLoss: notWorked !== null ? null : candidateDetail.reduce((s, x) => s + x.ltLoss + x.stLoss, 0),
    labels,
  };
}

/**
 * The coverage of a PARTIAL harvest figure: the client's split holdings whose gain is known, over the split holdings and
 * the holdings not split because unreconciled with the IRR file (F-3; `unreconciled` 0 gives the round 2 share).
 */
function coverageOf(client: ClientTaxSummary, unknown: number, unreconciled = 0): number {
  const split = splitHoldingsOf(client);
  const base = split + unreconciled;
  return base > 0 ? Math.max(0, Math.min(1, (split - unknown) / base)) : 0;
}

/** Every figure null (round 3 M1: no harvest worked, so nothing is known; never 0). */
function nullFigures(): HarvestFigureValues {
  const f = {} as HarvestFigureValues;
  for (const k of HARVEST_SUM_FIELDS) f[k] = null;
  return f;
}

/** The client's split holdings (a holding split at 1 Apr 2023 counted once; not-split records left out). */
function splitHoldingsOf(client: ClientTaxSummary): number {
  return client.positions.filter((r) => r.notSplit === null && r.splitPart !== 'pre-2023').length;
}

// ---------------------------------------------------------------------------------------------------------------
// The family

/** The family harvest: the clients' harvests added field by field (the live taxSumHarvests), labelled as such. */
export function sumHarvests(list: readonly HarvestLocal[], prov?: Provenance): FamilyHarvest {
  // D-1: a client with no harvest worked (no holding split) is left out of the sum and counted.
  const worked = list.filter((h) => h.notWorked === null);
  const notWorked = list.length - worked.length;
  const none = list.length > 0 && worked.length === 0;
  // Round 3 M1 (Q-49): when no client's harvest is worked, every family figure is null, never a sum of nothing (0).
  const figures = {} as HarvestFigureValues;
  for (const k of HARVEST_SUM_FIELDS) {
    figures[k] = none || worked.some((h) => h.figures[k] === null) ? null : worked.reduce((s, h) => s + (h.figures[k] ?? 0), 0);
  }
  const p: Provenance = prov ?? { sources: [], method: 'tax-loss harvest per client (E-43)' };
  const fp: Provenance = { ...p, method: `${p.method}; family: ${FAMILY_LABEL}` };
  const dashed = worked.filter((h) => h.afterSetOffDash !== null).length;
  const gainUnknown = list.reduce((s, h) => s + h.gainUnknown, 0);
  const unreconciled = list.reduce((s, h) => s + h.unreconciled, 0);
  // F-3, D-1: holdings not split (unreconciled with the IRR file) make the family figure PARTIAL; its coverage is the
  // share of the family's holdings in the pools: split holdings with a known gain over split and unreconciled holdings.
  const familyNote = [notWorked > 0 ? `${notWorked} client${notWorked === 1 ? '' : 's'} with no holding split (no harvest worked)` : null,
    gainUnknown > 0 ? `${gainUnknown} holdings with an unknown gain` : null,
    unreconciled > 0 ? `${unreconciled} holding${unreconciled === 1 ? '' : 's'} not split (unreconciled with the IRR file)` : null].filter((x): x is string => x !== null);
  const known = list.reduce((s, h) => s + Math.max(0, h.split - h.gainUnknown), 0);
  const base = list.reduce((s, h) => s + h.split + h.unreconciled, 0);
  const familyCoverage = base > 0 ? Math.min(1, known / base) : 0;
  const v =(x: number | null, what: string): Value<number> => (none
    ? missing(STATUS.NOT_AVAILABLE, `no holding of any client is split into long and short term (${unreconciled} holding${unreconciled === 1 ? '' : 's'} not split, unreconciled with the IRR file): the family ${what} is not available`, fp)
    : x === null
      ? missing(STATUS.NOT_AVAILABLE, `${SLAB_NOT_SET} for ${dashed} client${dashed === 1 ? '' : 's'}: the family ${what} is not available`, fp)
      : familyNote.length === 0 ? present(x, 'inr', fp)
        : present(x, 'inr', { ...fp, method: `${fp.method}; ${STATUS.PARTIAL}: ${familyNote.join(' and ')} left out` },
          unreconciled > 0 ? { coverage: familyCoverage } : undefined));
  return {
    label: FAMILY_LABEL, byClient: [...list], figures,
    taxBefore: v(figures.taxBefore, 'tax before harvesting'), taxAfter: v(figures.taxAfter, 'tax after harvesting'), saving: v(figures.saving, 'saving'),
    pools: worked.flatMap((h) => h.pools),
    candidates: worked.flatMap((h) => h.candidateDetail).sort((a, b) => (b.ltLoss + b.stLoss) - (a.ltLoss + a.stLoss)),
    exRate: none ? null : worked.reduce((m, h) => Math.max(m, h.exRate ?? 0), 0),
    exemptionNotApplied: worked.filter((h) => h.exemptionApplied === EXEMPTION_NOT_APPLIED).length,
    gainUnknown, unreconciled, clientsNotWorked: notWorked,
  };
}

/** Every client's harvest and the family sum (the live taxApplyAssumptions), on the holdings roll-ups. */
export function buildHarvests(rollup: Pick<HoldingsTaxRollup, 'clients' | 'prov'>, ctx: HarvestContext): { clients: HarvestLocal[]; family: FamilyHarvest } {
  const prov: Provenance = { ...rollup.prov, method: 'tax-loss harvest per client (E-43)' };
  const clients = rollup.clients.map((c) => buildHarvest(c, ctx, prov));
  return { clients, family: sumHarvests(clients, prov) };
}
