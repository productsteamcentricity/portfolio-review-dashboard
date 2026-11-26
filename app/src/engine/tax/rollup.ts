// The person-year roll-up of statement lots (NB-M7a S3, parity rows E-155, E-153 roll-up half, E-141; design
// docs/new-build/capital-gains-upload.md §9.3 steps 2 to 8, §10.2 exemptions with TR-9 and TR-2, §10.6 set-off with
// TR-10 and TR-15, §10.7 cess and surcharge with TR-12, §11, §13.4 KA-9 to KA-13, KA-15, KA-18 to KA-22).
//
// Per tax person (ingest/capital-gains.ts taxPersonKey: the PAN ordinal "person:n", else the client id; a lot with no
// person is the person "no-person") and per financial year, never pooled (TR-15):
//   2. rate buckets (Bucket.rate a percent number, or 'slab'); a lot without a computable taxable gain enters no bucket
//      and the person-year is PARTIAL COVERAGE with the count and the economic gain left out;
//   3. set-off: long-term losses first, against long-term gains, highest rate first; then short-term losses against
//      the remaining gains of either term, highest-taxed first, slab included at the person's slab rate. s.112A and
//      Sec 198 gains inside the unused exemption rank at 0% and come last; among equal rates non-exempt gains first.
//      EQ-LT-1 losses are ignored. While the slab rate is not set and a short-term loss meets slab gains, the
//      after-set-off figures and the tax are the dash "slab rate not set". Leftover losses are reported by term;
//   4. the annual exemption after set-off, one per person (FY 2024-25: the 12.5% gains first, PD-16 item 6);
//   5. tax = taxable x rate; a slab bucket is left out (PARTIAL) while the slab rate is not set;
//   6. surcharge at the person's entry limited to the year's maximum and capped at 15% on the capped categories;
//      "before surcharge (rate not set)" and "(regime not set)"; cess on tax plus surcharge;
//   7. the statement's LTCG and STCG beside, with the count of lots that differ;
//   8. the alternatives: the anniversary lots long term (PD-16 item 2), FY 2024-25 the other exemption order, and
//      the NE-LT-1 year's-total figure (both legs for every lot, with set-off, the lower shown; PD-16 item 4).
// A year with an unanswered repeat event (CgImport.insufficientYears) is INSUFFICIENT EVIDENCE. Repeats excluded as
// "once" are not counted. The family sum is the "sum of separate computations" of the review's persons: PARTIAL when
// any person's figure is, no exemption field, an unmatched person never added.
//
// PD-07 (the slab rate) is open with the owner: the slab rate is the analyst's per person-year, and a default sits in
// the one named parameter SLAB_DEFAULT_PCT / opts.slabDefaultPct (null: no default). Either answer is a one-line change.
//
// Pure: no globals, no network; the clock only through opts.now (audit entries). Money in rupees, unrounded (LD-42).
// Messages carry counts only: never a PAN, a folio or an amount (§11), and no en or em dash (D-029).

import type { CgImport, CgLot, CgRead } from '../../ingest/capital-gains.ts';
import { taxPersonKey } from '../../ingest/capital-gains.ts';
import type { Provenance, Value } from '../../model/value.ts';
import type { MissingStatus } from '../../model/status.ts';
import { STATUS } from '../../model/status.ts';
import type { AuditEntry } from '../../model/audit.ts';
import type { ClientId } from '../../model/ids.ts';
import type { FamilyTaxYear, TaxInputs, Term } from '../../model/tax.ts';
import { missing, present } from '../value.ts';
import type { ExemptionLookup, RateLookup, Regime, TaxRule, TaxRuleTable } from './rules.ts';
import { TAX_RULES_V1, cessRateFor, exemptionFor, surchargeCapFor, surchargeMaxFor } from './rules.ts';
import type {
  BucketLocal, EstimateLocal, FamilyTaxYearLocal, PersonYearInput, PersonYearTaxLocal, RollupResult, TaxIssue, TaxLot,
} from './types.ts';

/**
 * PD-07 (open with the owner): the slab rate used when a person-year has no slab entry, a percent (30 means 30%).
 * null: no default, so slab-rate tax stays the dash until the analyst enters the slab. The one named place.
 */
export const SLAB_DEFAULT_PCT: number | null = null;

/** The person of a lot with no client label and no PAN (design §9.3: its own person, never in the family sum). */
export const NO_PERSON = 'no-person';

export type RollupOptions = {
  /** The rule table (default: table v1, data/owner/tax-rules.json). */
  table?: TaxRuleTable;
  /** PD-07: overrides SLAB_DEFAULT_PCT (null: no default). */
  slabDefaultPct?: number | null;
  /** Clock for the audit entries (ISO 8601); defaults to the system clock. */
  now?: () => string;
};

const NA: MissingStatus = STATUS.NOT_AVAILABLE;
const NAPP: MissingStatus = STATUS.NOT_APPLICABLE;
const IE: MissingStatus = STATUS.INSUFFICIENT_EVIDENCE;
const EPS = 1e-9;
const SLAB_NOT_SET = 'slab rate not set';
const RATE_NOT_SET = 'before surcharge (rate not set)';
const REGIME_NOT_SET = 'before surcharge (regime not set)';
const val = <T>(r: CgRead<T>): T | null => (r.kind === 'value' ? r.v : null);
/** A fraction as a percent number, clean of binary noise (0.15 gives 15, not 15.000000000000002). */
const pct = (frac: number): number => Math.round(frac * 1e8) / 1e6;

// ---------------------------------------------------------------------------------------------------------------
// Items: a lot as the set-off sees it

/** One computable lot in a rate bucket: its rule, rate (a fraction, or slab), term and taxable gain. */
type Item = {
  lotIndex: number;
  ruleId: string;
  rate: number | 'slab';
  term: Term;
  gain: number;
  exemptionGroup: 's112a' | 's198' | null;
  surchargeCategory: string | null;
  order: number;
};

function itemOf(table: TaxRuleTable, ruleIndex: ReadonlyMap<string, number>, lotIndex: number, ruleId: string,
  rate: number | 'slab', term: Term, gain: number): Item {
  const row: TaxRule | undefined = table.rules[ruleIndex.get(ruleId) ?? -1];
  const g = row?.exemptionGroup;
  return {
    lotIndex, ruleId, rate, term, gain, exemptionGroup: g === 's112a' || g === 's198' ? g : null,
    surchargeCategory: row?.surchargeCategory ?? null, order: ruleIndex.get(ruleId) ?? table.rules.length,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The core: steps 2 to 6 over a list of items

type Surcharge =
  | { kind: 'rate'; frac: number; limited: boolean }
  | { kind: 'before'; label: string }
  | { kind: 'missing'; reason: string };

type CoreCtx = {
  table: TaxRuleTable;
  fy: number;
  slabPct: number | null;
  exemption: ExemptionLookup;
  /** 'default' is PD-16 item 6 (FY 2024-25: the 12.5% gains first); 'other' the 10% gains first (the note). */
  order: 'default' | 'other';
  surcharge: Surcharge;
  cess: RateLookup;
};

type Core = {
  buckets: BucketLocal[];
  unabsorbed: { st: number; lt: number };
  exemptionApplied: number;
  dash: string | null;
  /** A reason the tax cannot be computed for the year (the exemption, surcharge or cess still to be confirmed). */
  blocked: string | null;
  tax: number;
  surcharge: number | null;
  slabTaxableLeftOut: number;
  slabLotsLeftOut: number[];
};

type Slot = { b: number; amount: number; inside: boolean; used: number };

/** The annual exemption amount of the year for the ranking and step 4 (0 where there is no threshold). */
function exemptionAmount(ex: ExemptionLookup): number {
  return ex.status === 'ok' && ex.year.kind === 'threshold' && ex.year.amount !== null ? ex.year.amount : 0;
}

/** The exemption-group buckets in the order the exemption is applied (PD-16 item 6 default, or the other order). */
function exemptionOrder(buckets: readonly BucketLocal[], ctx: CoreCtx): number[] {
  const idx = buckets.map((b, i) => [b, i] as const).filter(([b]) => b.exemptionGroup !== null);
  const alloc = ctx.exemption.status === 'ok' ? ctx.exemption.year.allocationOrder : null;
  const pos = (id: string): number => { const k = alloc?.indexOf(id) ?? -1; return k < 0 ? Number.MAX_SAFE_INTEGER : k; };
  const rateOf = (b: BucketLocal): number => (typeof b.rate === 'number' ? b.rate : 0);
  idx.sort(([a, ia], [b, ib]) => ctx.order === 'default'
    ? (pos(a.ruleId) - pos(b.ruleId)) || (rateOf(b) - rateOf(a)) || (ia - ib)
    : (rateOf(a) - rateOf(b)) || (pos(a.ruleId) - pos(b.ruleId)) || (ia - ib));
  return idx.map(([, i]) => i);
}

function core(items: readonly Item[], ctx: CoreCtx): Core {
  // Step 2: buckets per rule and rate (NE-LT-1 has one per leg). Gross gains in the bucket, losses to the term's pool.
  const byKey = new Map<string, BucketLocal & { order: number; frac: number | null }>();
  for (const it of items) {
    const key = `${it.ruleId}|${it.rate}`;
    let b = byKey.get(key);
    if (!b) {
      b = {
        ruleId: it.ruleId, rate: it.rate === 'slab' ? 'slab' : pct(it.rate), gain: 0, setOff: 0, taxable: 0, term: it.term,
        loss: 0, exemption: 0, exemptionGroup: it.exemptionGroup, surchargeCategory: it.surchargeCategory, lots: [],
        tax: null, surcharge: null, order: it.order, frac: it.rate === 'slab' ? null : it.rate,
      };
      byKey.set(key, b);
    }
    if (it.gain >= 0) b.gain += it.gain;
    else b.loss += -it.gain;
    b.lots.push(it.lotIndex);
  }
  const all = [...byKey.values()].sort((a, b) => (a.order - b.order) || ((b.frac ?? -1) - (a.frac ?? -1)));
  const pool = { lt: 0, st: 0 };
  for (const b of all) pool[b.term === 'long' ? 'lt' : 'st'] += b.loss;

  // Slots for the ranking: an exemption-group bucket splits into its part above the unused exemption (its rate) and
  // its part inside (0%, last), the inside part filled in the exemption order (§9.3 step 3, TR-10 (4)).
  const E = exemptionAmount(ctx.exemption);
  const slots: Slot[] = [];
  const order = exemptionOrder(all, ctx);
  let room = E;
  const inside = new Map<number, number>();
  for (const i of order) { const x = Math.min(all[i]!.gain, room); inside.set(i, x); room -= x; }
  all.forEach((b, i) => {
    const ins = inside.get(i) ?? 0;
    slots.push({ b: i, amount: b.gain - ins, inside: false, used: 0 });
    if (b.exemptionGroup !== null) slots.push({ b: i, amount: ins, inside: true, used: 0 });
  });
  const rank = (s: Slot): number => {
    if (s.inside) return 0;
    const b = all[s.b]!;
    return b.frac === null ? (ctx.slabPct ?? 0) : pct(b.frac);
  };
  const cmp = (x: Slot, y: Slot): number => {
    const bx = all[x.b]!;
    const by = all[y.b]!;
    return (rank(y) - rank(x))
      || (Number(x.inside) - Number(y.inside))
      || (Number(bx.exemptionGroup !== null) - Number(by.exemptionGroup !== null))
      || (Number(by.frac === null) - Number(bx.frac === null))
      || (Number(bx.term === 'long') - Number(by.term === 'long'))
      || (x.b - y.b);
  };
  const spend = (candidates: Slot[], amount: number): number => {
    let left = amount;
    for (const s of [...candidates].sort(cmp)) {
      if (left <= EPS) break;
      const x = Math.min(s.amount - s.used, left);
      if (x <= 0) continue;
      s.used += x;
      left -= x;
    }
    return Math.max(left, 0);
  };

  const out: Core = {
    buckets: all, unabsorbed: { st: 0, lt: 0 }, exemptionApplied: 0, dash: null, blocked: null, tax: 0, surcharge: null,
    slabTaxableLeftOut: 0, slabLotsLeftOut: [],
  };
  // Step 3 (1): EQ-LT-1 losses never reach here (the exempt line). (2): long-term losses against long-term gains.
  const ltLeft = spend(slots.filter((s) => all[s.b]!.term === 'long'), pool.lt);
  // (3): short-term losses against the remaining gains of either term; the slab rank needs the slab rate.
  const slabMet = ctx.slabPct === null && pool.st > EPS && slots.some((s) => all[s.b]!.frac === null && s.amount - s.used > EPS);
  if (slabMet) {
    out.dash = SLAB_NOT_SET;
    for (const b of all) { b.setOff = 0; b.taxable = 0; b.tax = null; }
    return out;
  }
  const stLeft = spend(slots, pool.st);
  out.unabsorbed = { lt: ltLeft, st: stLeft };
  for (const s of slots) all[s.b]!.setOff += s.used;

  // Step 4: the annual exemption after set-off, one limit per person, in the exemption order.
  room = E;
  for (const i of order) {
    const b = all[i]!;
    const x = Math.min(Math.max(b.gain - b.setOff, 0), room);
    b.exemption = x;
    room -= x;
  }
  out.exemptionApplied = E - room;
  const groupGains = all.some((b) => b.exemptionGroup !== null && b.gain - b.setOff > EPS);
  if (groupGains && ctx.exemption.status !== 'ok') out.blocked = 'the annual exemption of the year is to be confirmed';

  // Step 5: tax per bucket; step 6: surcharge per bucket, capped on the capped categories.
  let sur: number | null = ctx.surcharge.kind === 'rate' ? 0 : null;
  for (const b of all) {
    b.taxable = b.gain - b.setOff - b.exemption;
    if (b.frac === null && ctx.slabPct === null) {
      b.tax = b.taxable > EPS ? null : 0;
      if (b.tax === null) { out.slabTaxableLeftOut += b.taxable; out.slabLotsLeftOut.push(...b.lots); }
    } else {
      b.tax = b.taxable * (b.frac === null ? ctx.slabPct! / 100 : b.frac);
    }
    if (b.tax !== null) out.tax += b.tax;
    if (ctx.surcharge.kind === 'rate' && b.tax !== null) {
      const cap = surchargeCapFor(ctx.table, ctx.fy, (b.surchargeCategory ?? 'slab') as Parameters<typeof surchargeCapFor>[2]);
      if (cap.status === 'to-be-confirmed' || cap.status === 'outside-table') { out.blocked ??= 'the surcharge cap of the year is to be confirmed'; continue; }
      const rate = cap.status === 'capped' ? Math.min(ctx.surcharge.frac, cap.cap) : ctx.surcharge.frac;
      b.surcharge = b.tax * rate;
      sur = (sur ?? 0) + b.surcharge;
    }
  }
  out.surcharge = sur;
  if (ctx.surcharge.kind === 'missing') out.blocked ??= ctx.surcharge.reason;
  if (ctx.cess.status !== 'ok') out.blocked ??= 'the cess of the year is to be confirmed';
  return out;
}

/** The estimate of a core result (step 5 and 6): tax, surcharge, cess and total, with their labels. */
function estimateOf(c: Core, ctx: CoreCtx, prov: Provenance, coverage: number | null): EstimateLocal {
  const extra = coverage !== null && coverage < 1 ? { coverage } : undefined;
  const m = (status: MissingStatus, reason: string): Value<number> => missing(status, reason, prov);
  if (c.dash !== null) {
    return { tax: m(NA, c.dash), surcharge: m(NA, c.dash), cess: m(NA, c.dash), total: m(NA, c.dash), beforeSurcharge: false, surchargeLabel: null };
  }
  if (c.blocked !== null) {
    return { tax: m(NA, c.blocked), surcharge: m(NA, c.blocked), cess: m(NA, c.blocked), total: m(NA, c.blocked), beforeSurcharge: false, surchargeLabel: null };
  }
  const cessRate = ctx.cess.status === 'ok' ? ctx.cess.rate : 0;
  const before = ctx.surcharge.kind === 'before' ? ctx.surcharge.label : null;
  const sur = before === null ? (c.surcharge ?? 0) : 0;
  const cess = (c.tax + sur) * cessRate;
  return {
    tax: present(c.tax, 'inr', prov, extra),
    surcharge: before === null ? present(sur, 'inr', prov, extra) : m(NA, before),
    cess: present(cess, 'inr', prov, extra),
    total: present(c.tax + sur + cess, 'inr', prov, extra),
    beforeSurcharge: before !== null,
    surchargeLabel: before,
  };
}

/** The surcharge of a person-year (§9.3, §10.7, TR-12): the entry limited to the year's maximum, or before surcharge. */
function surchargeOf(table: TaxRuleTable, fy: number, entryPct: number | null, regime: Regime | null): Surcharge {
  const max = surchargeMaxFor(table, fy, regime);
  if (max.status === 'to-be-confirmed' || max.status === 'outside-table') return { kind: 'missing', reason: 'the surcharge of the year is to be confirmed' };
  // A year whose maximum is nil: the surcharge is 0 and nothing is asked.
  if (max.status === 'ok' && max.max === 0) return { kind: 'rate', frac: 0, limited: entryPct !== null && entryPct > 0 };
  if (entryPct === null) return { kind: 'before', label: RATE_NOT_SET };
  const frac = entryPct / 100;
  if (max.status === 'regime-not-set') {
    return frac > max.maxEitherRegime + EPS ? { kind: 'before', label: REGIME_NOT_SET } : { kind: 'rate', frac, limited: false };
  }
  return frac > max.max + EPS ? { kind: 'rate', frac: max.max, limited: true } : { kind: 'rate', frac, limited: false };
}

// ---------------------------------------------------------------------------------------------------------------
// Persons

type PersonInfo = { key: string; label: string; reviewClients: Set<ClientId>; first: number };

function personLabelOf(imp: CgImport, key: string, lot: CgLot | undefined): string {
  if (key === NO_PERSON) return 'no client label';
  const m = /^person:(\d+)$/.exec(key);
  if (m) {
    const n = Number(m[1]);
    const pp = imp.panPersons.find((p) => p.personNo === n);
    return pp && pp.labels.length > 0 ? `${pp.labels.join(', ')} (Person ${n})` : `Person ${n}`;
  }
  return imp.persons.find((p) => p.clientId === key)?.label ?? lot?.accountLabel ?? key;
}

/**
 * The analyst's person-year entry: by the person key (TaxInputs.personYear.clientId holding "person:n" or the client
 * id), else by the person's single review client when no other person of the year has that client.
 */
// TODO(contracts-4): personKey joins TaxInputs.personYear
function personYearInputFor(inputs: TaxInputs, fy: number, p: PersonInfo, clientsInYear: ReadonlyMap<string, number>): PersonYearInput | undefined {
  const exact = inputs.personYear.find((e) => e.fy === fy && (e.clientId as string | null) === p.key);
  if (exact) return exact;
  if (p.reviewClients.size !== 1) return undefined;
  const c = [...p.reviewClients][0]!;
  if ((clientsInYear.get(c) ?? 0) !== 1) return undefined;
  return inputs.personYear.find((e) => e.fy === fy && e.clientId === c);
}

// ---------------------------------------------------------------------------------------------------------------
// One person-year

type PyCtx = {
  table: TaxRuleTable;
  ruleIndex: ReadonlyMap<string, number>;
  imp: CgImport;
  lotByIndex: ReadonlyMap<number, CgLot>;
  fy: number;
  person: PersonInfo;
  input: PersonYearInput | undefined;
  slabDefaultPct: number | null;
  insufficient: boolean;
};

function personYear(lots: readonly TaxLot[], x: PyCtx): PersonYearTaxLocal {
  const { table, fy } = x;
  const prov: Provenance = { sources: [x.imp.sourceId], method: `indicative tax per person and financial year (design section 9.3, rule table ${table.version})` };
  const items: Item[] = [];
  const notComputed: TaxLot[] = [];
  let realised = 0;
  let exempt = 0;
  let exemptLossIgnored = 0;
  let nonTaxable = 0;
  for (const g of lots) {
    if (g.realisedCounted.kind === 'value') realised += g.realisedCounted.v;
    nonTaxable += g.nonTaxable;
    if (g.notComputed !== null || g.taxableGain.kind === 'missing') { notComputed.push(g); continue; }
    if (g.lotClass === 'non-taxable-transfer') continue;
    if (g.exempt) {
      const r = g.realised.kind === 'value' ? g.realised.v : 0;
      exempt += r;
      if (r < 0) exemptLossIgnored += -r;
      continue;
    }
    if (g.ruleId === null || g.rate === null || g.rate === 'exempt') { notComputed.push(g); continue; }
    const term: Term = g.term.kind === 'value' ? g.term.v : 'short';
    items.push(itemOf(table, x.ruleIndex, g.lotIndex, g.ruleId, g.rate, term, g.taxableGain.v));
  }

  const slabEntry = x.input?.slabPct ?? null;
  const slabPct = slabEntry ?? x.slabDefaultPct;
  const slabSource: PersonYearTaxLocal['slab']['source'] = slabEntry !== null ? 'analyst' : slabPct !== null ? 'default' : 'not set';
  const surcharge = surchargeOf(table, fy, x.input?.surchargePct ?? null, x.input?.regime ?? null);
  const exemption = exemptionFor(table, fy);
  const ctx: CoreCtx = { table, fy, slabPct, exemption, order: 'default', surcharge, cess: cessRateFor(table, fy) };
  const main = core(items, ctx);

  // Coverage (step 2): the lots left out of the tax (no computable gain, or in a slab bucket while the slab is not set).
  const leftOut = notComputed.length + main.slabLotsLeftOut.length;
  const partial = notComputed.length > 0 || main.slabTaxableLeftOut > EPS;
  const share = lots.length === 0 ? 1 : 1 - leftOut / lots.length;
  const estimate = estimateOf(main, ctx, prov, partial ? Math.min(share, 1 - 1e-9) : null);

  // Step 8: the alternatives.
  const run = (alt: Item[], c: CoreCtx = ctx): EstimateLocal => {
    const r = core(alt, c);
    const altPartial = notComputed.length > 0 || r.slabTaxableLeftOut > EPS;
    const altShare = lots.length === 0 ? 1 : 1 - (notComputed.length + r.slabLotsLeftOut.length) / lots.length;
    return estimateOf(r, c, prov, altPartial ? Math.min(altShare, 1 - 1e-9) : null);
  };
  const byLot = new Map(lots.map((g) => [g.lotIndex, g]));
  let anniversary: EstimateLocal | null = null;
  const annLots = items.filter((it) => byLot.get(it.lotIndex)?.anniversaryLongTerm != null);
  if (annLots.length > 0) {
    let computable = true;
    const alt: Item[] = [];
    for (const it of items) {
      const g = byLot.get(it.lotIndex)!;
      if (g.anniversaryLongTerm === null) { alt.push(it); continue; }
      const rate = g.anniversaryLongTermDetail?.rate ?? null;
      if (rate === 'exempt') continue;
      if (rate === null) { computable = false; break; }
      alt.push(itemOf(table, x.ruleIndex, it.lotIndex, g.anniversaryLongTerm.ruleId, rate, 'long', g.anniversaryLongTerm.taxableGain));
    }
    anniversary = computable ? run(alt) : {
      tax: missing(NA, 'the long-term figure of an anniversary lot is not computable', prov), surcharge: missing(NA, 'not computable', prov),
      cess: missing(NA, 'not computable', prov), total: missing(NA, 'not computable', prov), beforeSurcharge: false, surchargeLabel: null,
    };
  }
  let otherOrder: EstimateLocal | null = null;
  const shared = exemption.status === 'ok' && exemption.year.sharedRates !== null && exemption.year.sharedRates !== undefined;
  const groupRates = new Set(items.filter((it) => it.exemptionGroup !== null && it.gain > 0).map((it) => it.rate));
  if (shared && groupRates.size > 1) otherOrder = run(items, { ...ctx, order: 'other' });
  let oldLaw: (EstimateLocal & { leg: 'indexed20' | 'actual10' }) | null = null;
  let oldLawLegs: { indexed20: EstimateLocal; actual10: EstimateLocal } | null = null;
  const legLots = items.filter((it) => byLot.get(it.lotIndex)?.legDetail != null);
  if (legLots.length > 0) {
    const onLeg = (leg: 'indexed20' | 'actual10'): Item[] => items.map((it) => {
      const g = byLot.get(it.lotIndex)!;
      if (g.legDetail === null) return it;
      const row = table.rules[x.ruleIndex.get(it.ruleId) ?? -1];
      const rate = row?.legs?.[leg === 'indexed20' ? 0 : 1]?.rate ?? (leg === 'indexed20' ? 0.2 : 0.1);
      return itemOf(table, x.ruleIndex, it.lotIndex, it.ruleId, rate, it.term, g.legDetail[leg].gain);
    });
    const i20 = run(onLeg('indexed20'));
    const a10 = run(onLeg('actual10'));
    oldLawLegs = { indexed20: i20, actual10: a10 };
    if (i20.tax.kind === 'value' && a10.tax.kind === 'value') {
      oldLaw = a10.tax.v < i20.tax.v - EPS ? { ...a10, leg: 'actual10' } : { ...i20, leg: 'indexed20' };
    } else {
      const why = i20.tax.kind === 'missing' ? i20.tax.reason : a10.tax.kind === 'missing' ? a10.tax.reason : '';
      oldLaw = { ...i20, tax: missing(NA, why, prov), total: missing(NA, why, prov), leg: 'indexed20' };
    }
  }

  // Step 7: the statement's split beside.
  let lt: number | null = null;
  let st: number | null = null;
  let termDiffers = 0;
  let gainDiffers = 0;
  let differing = 0;
  for (const g of lots) {
    const cl = x.lotByIndex.get(g.lotIndex);
    if (cl) {
      const l = val(cl.statement.ltcg);
      const s = val(cl.statement.stcg);
      if (l !== null) lt = (lt ?? 0) + l;
      if (s !== null) st = (st ?? 0) + s;
    }
    const t = g.flags.includes('term-differs');
    const d = g.flags.includes('gain-differs');
    if (t) termDiffers++;
    if (d) gainDiffers++;
    if (t || d) differing++;
  }
  const splitProv: Provenance = { sources: [x.imp.sourceId], method: "the statement's own LTCG and STCG of the year, summed (design section 9.3 step 7)" };

  // INSUFFICIENT EVIDENCE: the year's totals wait for the repeats answers (design §6).
  const ie = (r: Value<number> | null): Value<number> | null => (r === null ? null : x.insufficient
    ? missing(IE, 'an unanswered repeated-rows question in this financial year (design section 6)', prov) : r);
  const est: EstimateLocal = x.insufficient ? {
    tax: ie(estimate.tax)!, surcharge: ie(estimate.surcharge)!, cess: ie(estimate.cess)!, total: ie(estimate.total)!,
    beforeSurcharge: estimate.beforeSurcharge, surchargeLabel: estimate.surchargeLabel,
  } : estimate;

  const labels = ['resident individual assumed', 'indicative, not tax advice'];
  if (main.exemptionApplied > EPS) labels.push('the annual exemption is shared with listed shares, other equity-oriented units and business trust units outside this statement, so part of it may already be used');
  if (shared && exemption.status === 'ok' && exemption.year.orderSetByAct === false) labels.push('order not set by the Act');
  if (main.dash !== null) labels.push(main.dash);
  else if (main.slabTaxableLeftOut > EPS) labels.push(`${SLAB_NOT_SET}: the slab buckets are left out`);
  if (est.surchargeLabel !== null) labels.push(est.surchargeLabel);
  if (surcharge.kind === 'rate' && surcharge.limited) labels.push("the surcharge entry is limited to the year's maximum");
  labels.push('brought-forward losses are not in the statement and are not applied');

  const reviewClients = [...x.person.reviewClients];
  return {
    clientId: reviewClients.length === 1 ? reviewClients[0]! : null,
    personKey: x.person.key,
    personLabel: x.person.label,
    fy,
    inReview: x.person.reviewClients.size > 0,
    realised,
    exempt,
    nonTaxable,
    exemption: {
      limit: exemption.status === 'ok'
        ? (exemption.year.kind === 'threshold' && exemption.year.amount !== null
          ? present(exemption.year.amount, 'inr', { sources: [], method: `${exemption.year.section} annual exemption of the year (design section 10.2)` })
          : missing(NAPP, `whole long-term gain exempt under ${exemption.year.section}, no threshold`))
        : missing(NA, 'the annual exemption of the year is to be confirmed'),
      applied: main.exemptionApplied,
    },
    unabsorbed: main.unabsorbed,
    buckets: main.buckets.map((b) => {
      const { order: _o, frac: _f, ...rest } = b as BucketLocal & { order?: number; frac?: number | null };
      return rest;
    }),
    estimate: est,
    alternatives: {
      anniversaryLongTerm: ie(anniversary?.tax ?? null),
      fy2425OtherOrder: ie(otherOrder?.tax ?? null),
      oldLawYearTotal: ie(oldLaw?.tax ?? null),
    },
    statementSplit: {
      lt: lt === null ? missing(NA, 'no LTCG cell stated on these lots', splitProv) : present(lt, 'inr', splitProv),
      st: st === null ? missing(NA, 'no STCG cell stated on these lots', splitProv) : present(st, 'inr', splitProv),
      lotsDiffering: differing,
    },
    coverage: {
      lotsNotComputed: notComputed.length,
      economicGainNotComputed: notComputed.reduce((s, g) => s + (g.realised.kind === 'value' ? g.realised.v : 0), 0),
      partial,
    },
    insufficientEvidence: x.insufficient,
    afterSetOffDash: main.dash,
    slab: { pct: slabPct, source: slabSource },
    surchargeApplied: surcharge.kind === 'rate' ? pct(surcharge.frac) : null,
    slabTaxableLeftOut: main.slabTaxableLeftOut,
    exemptLossIgnored,
    lots: lots.map((g) => g.lotIndex),
    statementDiffers: { term: termDiffers, gain: gainDiffers },
    alternativesDetail: { anniversaryLongTerm: anniversary, fy2425OtherOrder: otherOrder, oldLawYearTotal: oldLaw, oldLawLegs },
    labels,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The family sum

function sumValues(values: ReadonlyArray<Value<number>>, weights: readonly number[], prov: Provenance, what: string): Value<number> {
  if (values.length === 0) return missing(NAPP, 'no client of the review has lots in this financial year', prov);
  const ie = values.find((v) => v.kind === 'missing' && v.status === IE);
  if (ie) return missing(IE, (ie as { reason: string }).reason, prov);
  let sum = 0;
  let any = false;
  let covered = 0;
  let total = 0;
  values.forEach((v, i) => {
    const w = weights[i] ?? 1;
    total += w;
    if (v.kind === 'value') { sum += v.v; any = true; covered += w * (v.coverage ?? 1); }
  });
  if (!any) {
    const first = values.find((v) => v.kind === 'missing') as { status: MissingStatus; reason: string };
    return missing(first.status, first.reason, prov);
  }
  const coverage = total === 0 ? 1 : covered / total;
  return present(sum, 'inr', { ...prov, method: `${what}: the sum of separate computations` }, coverage < 1 - EPS ? { coverage } : undefined);
}

function familySumOf(fy: number, persons: readonly PersonYearTaxLocal[], prov: Provenance): FamilyTaxYear['familySum'] {
  const w = persons.map((p) => Math.max(p.lots.length, 1));
  const est = (k: 'tax' | 'surcharge' | 'cess' | 'total'): Value<number> => sumValues(persons.map((p) => p.estimate[k]), w, prov, `family ${k}`);
  const alt = (k: 'anniversaryLongTerm' | 'fy2425OtherOrder' | 'oldLawYearTotal'): Value<number> | null => {
    if (!persons.some((p) => p.alternatives[k] !== null)) return null;
    return sumValues(persons.map((p) => p.alternatives[k] ?? p.estimate.tax), w, prov, `family ${k}`);
  };
  return {
    fy,
    realised: persons.reduce((s, p) => s + p.realised, 0),
    exempt: persons.reduce((s, p) => s + p.exempt, 0),
    nonTaxable: persons.reduce((s, p) => s + p.nonTaxable, 0),
    unabsorbed: { st: persons.reduce((s, p) => s + p.unabsorbed.st, 0), lt: persons.reduce((s, p) => s + p.unabsorbed.lt, 0) },
    estimate: {
      tax: est('tax'), surcharge: est('surcharge'), cess: est('cess'), total: est('total'),
      beforeSurcharge: persons.some((p) => p.estimate.beforeSurcharge),
    },
    alternatives: { anniversaryLongTerm: alt('anniversaryLongTerm'), fy2425OtherOrder: alt('fy2425OtherOrder'), oldLawYearTotal: alt('oldLawYearTotal') },
    statementSplit: {
      lt: sumValues(persons.map((p) => p.statementSplit.lt), w, prov, 'family LTCG as stated'),
      st: sumValues(persons.map((p) => p.statementSplit.st), w, prov, 'family STCG as stated'),
      lotsDiffering: persons.reduce((s, p) => s + p.statementSplit.lotsDiffering, 0),
    },
    coverage: {
      lotsNotComputed: persons.reduce((s, p) => s + p.coverage.lotsNotComputed, 0),
      economicGainNotComputed: persons.reduce((s, p) => s + p.coverage.economicGainNotComputed, 0),
      partial: persons.some((p) => p.coverage.partial || p.afterSetOffDash !== null),
    },
    label: 'sum of separate computations',
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The roll-up over a statement

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * Every person-year of a statement: the realised lots (realiseLots) rolled up per tax person and financial year, with
 * the family sum of the review's persons.
 */
export function rollupPersonYears(gains: readonly TaxLot[], imp: CgImport, inputs: TaxInputs, opts: RollupOptions = {}): RollupResult {
  const table = opts.table ?? TAX_RULES_V1;
  const now = opts.now ?? ((): string => new Date().toISOString());
  const slabDefaultPct = opts.slabDefaultPct === undefined ? SLAB_DEFAULT_PCT : opts.slabDefaultPct;
  const ruleIndex = new Map(table.rules.map((r, i) => [r.id, i]));
  const lotByIndex = new Map(imp.lots.map((l) => [l.index, l]));
  const insufficient = new Set(imp.insufficientYears);

  // Persons and the lots counted (repeats excluded as "once" are left out).
  const persons = new Map<string, PersonInfo>();
  const byYear = new Map<number, Map<string, TaxLot[]>>();
  const yearLabel = new Map<number, string>();
  const counted = gains.filter((g) => !g.excludedAsRepeat);
  for (const g of counted) {
    const cl = lotByIndex.get(g.lotIndex);
    const key = taxPersonKey(cl?.taxPerson ?? null) ?? NO_PERSON;
    let p = persons.get(key);
    if (!p) { p = { key, label: personLabelOf(imp, key, cl), reviewClients: new Set(), first: g.lotIndex }; persons.set(key, p); }
    if (cl?.inReview && cl.clientId !== null) p.reviewClients.add(cl.clientId);
    const y = byYear.get(g.financialYear) ?? new Map<string, TaxLot[]>();
    const list = y.get(key) ?? [];
    list.push(g);
    y.set(key, list);
    byYear.set(g.financialYear, y);
    if (!yearLabel.has(g.financialYear)) yearLabel.set(g.financialYear, g.financialYearLabel);
  }

  const audit: AuditEntry[] = [];
  const entry = (summary: string, detail: AuditEntry['detail']): void => {
    audit.push({ id: `audit:tax-rollup:${audit.length + 1}`, at: now(), kind: 'validation-decision', sourceId: imp.sourceId, summary, detail });
  };

  const years: FamilyTaxYearLocal[] = [];
  for (const fy of [...byYear.keys()].sort((a, b) => a - b)) {
    const y = byYear.get(fy)!;
    const keys = [...y.keys()].sort((a, b) => persons.get(a)!.first - persons.get(b)!.first);
    const clientsInYear = new Map<string, number>();
    for (const k of keys) for (const c of persons.get(k)!.reviewClients) clientsInYear.set(c, (clientsInYear.get(c) ?? 0) + 1);
    const isInsufficient = insufficient.has(yearLabel.get(fy)!);
    const pys = keys.map((k) => {
      const person = persons.get(k)!;
      const input = personYearInputFor(inputs, fy, person, clientsInYear);
      const py = personYear(y.get(k)!, {
        table, ruleIndex, imp, lotByIndex, fy, person, input, slabDefaultPct, insufficient: isInsufficient,
      });
      if (input !== undefined) {
        entry('An analyst entry for a person and financial year was applied: slab rate, surcharge rate or regime (design section 9.3).', {
          person: k, fy, slabSet: input.slabPct !== null, surchargeSet: input.surchargePct !== null, regime: input.regime,
          surchargeLimited: py.labels.includes("the surcharge entry is limited to the year's maximum"),
          surchargeHeld: py.estimate.surchargeLabel === REGIME_NOT_SET,
        });
      }
      if (py.slab.source === 'default') {
        entry('The default slab rate (PD-07, slabDefaultPct) was applied to a person-year without a slab entry.', { person: k, fy, slabPct: py.slab.pct });
      }
      return py;
    });
    const inFamily = pys.filter((p) => p.inReview);
    const prov: Provenance = { sources: [imp.sourceId], method: 'family view: the review clients computed separately and added up' };
    years.push({
      fy, rulesVersion: table.version, persons: pys, insufficientEvidence: isInsufficient,
      familyPersons: inFamily.map((p) => p.personKey), familySum: familySumOf(fy, inFamily, prov),
    });
  }

  // clients-unmatched, the roll-up part (§11): raised beside the reader's own result (which needs the review), on the
  // persons computed separately and left out of the family sum, and on lots that a PAN joins to a review person.
  const issues: TaxIssue[] = [];
  const readerRaised = imp.issues.some((i) => i.ruleId === 'capital-gains.clients-unmatched');
  if (readerRaised) {
    const out = [...persons.values()].filter((p) => p.reviewClients.size === 0);
    const outYears = years.reduce((s, y) => s + y.persons.filter((p) => !p.inReview).length, 0);
    const joined = counted.filter((g) => {
      const cl = lotByIndex.get(g.lotIndex);
      return cl !== undefined && !cl.inReview && (persons.get(taxPersonKey(cl.taxPerson) ?? NO_PERSON)?.reviewClients.size ?? 0) > 0;
    });
    if (out.length > 0 || joined.length > 0) {
      const outLots = counted.filter((g) => {
        const cl = lotByIndex.get(g.lotIndex);
        return out.some((p) => p.key === (taxPersonKey(cl?.taxPerson ?? null) ?? NO_PERSON));
      });
      const noneInReview = ![...persons.values()].some((p) => p.reviewClients.size > 0);
      const parts: string[] = [];
      if (out.length > 0) {
        parts.push(`${plural(out.length, 'person not in the review is', 'persons not in the review are')} computed separately in ${plural(outYears, 'person-year', 'person-years')}, listed under clients not in the review and never added to the family sum.`);
      }
      if (joined.length > 0) {
        parts.push(`${plural(joined.length, 'lot under a client label not in the review shares', 'lots under client labels not in the review share')} a PAN with a client of the review and ${joined.length === 1 ? 'is' : 'are'} computed with that person (PD-16 item 3).`);
      }
      const severity = noneInReview ? 'High' : 'Warning';
      issues.push({
        id: 'capital-gains.clients-unmatched:rollup:1', ruleId: 'capital-gains.clients-unmatched',
        scope: { kind: 'rows', sourceId: imp.sourceId, rows: [...outLots, ...joined].map((g) => g.at) },
        message: parts.join(' '), severity, blocksPublication: false, resolution: 'none', status: 'open', decision: 'D-036',
        count: out.length > 0 ? out.length : joined.length,
      });
    }
  }
  return { years, issues, audit };
}
