// The holdings tax roll-ups (parity row E-43, roll-up half; NB-M7a S4b; DATA_DICTIONARY §6 `tax.unrealised.{st,lt}`;
// D-040 d, f, h; KI-007). A port of the live `taxRollup(list, keyOf, labelOf)` and `summarise(pos, unrec, unmap)`
// (index.html, the TAXATION section as merged by PR #36) over the records of lots.ts `computeTaxLots`:
//   - by product and by asset: CMV, gain, long and short CMV and gain, unclassified gain, fund-level gain and the count of
//     holdings (a holding split at 1 Apr 2023 counted once, TX-02), sorted by CMV;
//   - the totals of the family and of each client: CMV, gain, long, short and unclassified CMV and gain, locked (ELSS
//     lock-in, TX-14), fund level (a Category III AIF, TX-07), the not-split counts (TX-07, TX-10, TX-12) and the
//     holdings without a gain; unreconciled and unmapped holdings count in CMV and in the unclassified gain;
//   - `byClass` pools per I-21 row: ltPos, ltNeg, stPos, stNeg added per position, so a losing holding inside a class that
//     nets positive is still a harvest candidate (harvest.ts reads these pools per client);
//   - per client: the same summary over that client's own records, so the clients add back to the family by
//     construction (no second code path). Holdings without a client are one group (PD-44), keyed null.
// One correction (KI-007): the live adds only the known gains and counts the holdings without one (glMissing) beside
// the totals. Here every gain total is a `GainTotal` (the known sum, the holdings it covers and those whose gain is
// unknown); `gainValue` gives it as a Value: present when every gain is known, PARTIAL COVERAGE (coverage below 1, the
// count in its method) when some are unknown, NOT AVAILABLE when all are. An unknown gain is never 0. The `known` sums
// equal the live's figures.
// Another (OD-7): the asset key is the holding's canonical class, else its label as given, else blank
// ("(unspecified)"); the live reads a blank Asset Name as Equity.
// M7b financial review F-2, F-3: the legacy-facing `tax.unrealised.{st,lt}` leaves out the holdings unreconciled with the
// IRR file (their CMV and gain are unclassified), so it is PARTIAL COVERAGE with them (coverage: the split holdings over
// the split and unreconciled holdings, the count in its method), and NOT AVAILABLE when no holding is split while some
// are unreconciled (no IRR file, or one that reconciles none): never Rs 0 on a book whose split is unknown.
// Money in rupees, unrounded. Pure.

import type { Holding } from '../../model/holding.ts';
import type { ClientId, HoldingId } from '../../model/ids.ts';
import type { Provenance, Value } from '../../model/value.ts';
import { STATUS } from '../../model/status.ts';
import { missing, present } from '../value.ts';
import { TAX_RULES_I21, i21ByInst } from './classify.ts';
import type { I21Row } from './classify.ts';
import type { NotSplitKind, TaxLotsResult, TaxPositionRecord } from './lots.ts';

// ---------------------------------------------------------------------------------------------------------------
// Types

/** A gain total: the sum of the known gains, the holdings it covers and how many of them have an unknown gain. */
export type GainTotal = { known: number; holdings: number; unknown: number };

/** The holding facts the roll-ups read beside a record (the base file's own labels). */
export type HoldingFacts = Pick<Holding, 'id' | 'product' | 'assetClass' | 'assetLabel' | 'clientLabel' | 'sourceId'>;

/** One group of `byProduct` or `byAsset` (the live taxRollup entry). */
export type RollupGroup = {
  key: string;
  label: string;
  cmv: number;
  gain: GainTotal;
  ltCmv: number;
  stCmv: number;
  ltGain: GainTotal;
  stGain: GainTotal;
  unclassGain: GainTotal;
  fundGain: GainTotal;
  /** Holdings (a holding split at 1 Apr 2023 counted once). */
  n: number;
};

/** One I-21 class of a summary, with its per-position gain and loss pools (the live clsTot entry). */
export type ClassPool = {
  cls: string;
  rule: I21Row | null;
  cmv: number;
  ltCmv: number;
  stCmv: number;
  gain: GainTotal;
  ltGain: GainTotal;
  stGain: GainTotal;
  /** Records (each part of a split holding counts, as in the live). */
  n: number;
  /** Positive long-term gains and long-term losses (positive amounts), added per position. */
  ltPos: number;
  ltNeg: number;
  stPos: number;
  stNeg: number;
  /** The class has no investor-level split (D-040 d, h): never pooled. */
  notSplit: NotSplitKind | null;
  /**
   * Split holdings of the class whose gain is unknown (no invested value, KI-007): left out of the pools. A holding, not
   * a record (R2 S-4): a holding split at 1 Apr 2023 is counted once in the summary, in the class of its first record,
   * so the classes add up to the holdings with an unknown gain (harvest.ts reads that sum and its coverage).
   */
  gainUnknown: number;
};

export type NotSplitTotal = {
  n: number; cmv: number; gain: GainTotal; assumedN: number; assumedCmv: number; ruledN: number; ruledCmv: number;
};

/** The live `t` of summarise: the totals of the family or of one client. */
export type HoldingsTaxTotals = {
  cmv: number;
  gain: GainTotal;
  /** Holdings without a gain (no invested value), a split holding counted once (the live glMissing). */
  gainMissing: number;
  lt: { cmv: number; gain: GainTotal };
  st: { cmv: number; gain: GainTotal };
  unclassified: { cmv: number; gain: GainTotal };
  /** ELSS lots inside the lock-in (a part of the unclassified amounts, TX-14); n counts records. */
  locked: { cmv: number; gain: GainTotal; n: number };
  /** Category III AIF at fund level (TX-07): CMV = lt + st + unclassified + fund level. */
  fundLevel: { cmv: number; gain: GainTotal; n: number };
  notSplit: Record<NotSplitKind, NotSplitTotal>;
  /** Holdings with a record in positions (split part counted once), and every holding with a record. */
  nPos: number;
  nHold: number;
};

export type HoldingsTaxSummary = {
  totals: HoldingsTaxTotals;
  byClass: ClassPool[];
  byProduct: RollupGroup[];
  byAsset: RollupGroup[];
};

export type ClientTaxSummary = HoldingsTaxSummary & {
  /** The client; null for the holdings without a client label (one group, PD-44). */
  clientId: ClientId | null;
  clientLabel: string | null;
  positions: TaxPositionRecord[];
  unreconciled: TaxPositionRecord[];
  unmapped: TaxPositionRecord[];
};

export type HoldingsTaxRollup = {
  family: HoldingsTaxSummary;
  /** Each client's own summary, largest CMV first (first appearance breaks ties). */
  clients: ClientTaxSummary[];
  /** Holdings without a client label (a split holding counted once). */
  unnamedN: number;
  /** DATA_DICTIONARY §6 legacy-facing `tax.unrealised.{st,lt}`: the family's short- and long-term unrealised gain. */
  legacy: { unrealised: { st: Value<number>; lt: Value<number> } };
  /** The facts of each record's holding, by id (for the harvest's candidate names). */
  facts: ReadonlyMap<HoldingId, HoldingFacts>;
  prov: Provenance;
};

export type HoldingsRollupOptions = {
  /** The I-21 table (default data/refdata/TAX_RULES.json). */
  table?: readonly I21Row[];
};

// ---------------------------------------------------------------------------------------------------------------
// Gain totals

const gt = (): GainTotal => ({ known: 0, holdings: 0, unknown: 0 });

/**
 * A gain total as a Value: present when every gain is known; PARTIAL COVERAGE (present, coverage below 1, the count in
 * the method) when some are unknown; NOT AVAILABLE when every one is. Never 0 for an unknown gain.
 */
export function gainValue(g: GainTotal, prov: Provenance, what = 'gain'): Value<number> {
  if (g.unknown === 0) return present(g.known, 'inr', prov);
  if (g.unknown >= g.holdings) {
    return missing(STATUS.NOT_AVAILABLE, `the ${what} of ${plural(g.unknown, 'holding')} is unknown (no invested value, KI-007)`, prov);
  }
  return present(g.known, 'inr', {
    ...prov,
    method: `${prov.method}; ${STATUS.PARTIAL}: ${plural(g.unknown, 'holding')} of ${g.holdings} with an unknown ${what} (no invested value, KI-007) left out`,
  }, { coverage: (g.holdings - g.unknown) / g.holdings });
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** A GainTotal being added up, with the holdings already counted (a split holding is counted once). */
type Acc = { t: GainTotal; seen: Set<HoldingId>; unknownSeen: Set<HoldingId> };
const acc = (): Acc => ({ t: gt(), seen: new Set(), unknownSeen: new Set() });
function add(a: Acc, id: HoldingId, gain: number | null): void {
  if (!a.seen.has(id)) { a.seen.add(id); a.t.holdings++; }
  if (gain === null) {
    if (!a.unknownSeen.has(id)) { a.unknownSeen.add(id); a.t.unknown++; }
  } else a.t.known += gain;
}

// ---------------------------------------------------------------------------------------------------------------
// The record's facts

/** The live's "not a second holding" test: the second part of a holding split at 1 Apr 2023. */
const isSecondPart = (r: TaxPositionRecord): boolean => r.splitPart === 'pre-2023';

/** The split gain of a record: lt, st and unclassified gains known (the live `ltGain != null`). */
const splitKnown = (r: TaxPositionRecord): boolean => r.lt.gain !== null && r.st.gain !== null;

// ---------------------------------------------------------------------------------------------------------------
// taxRollup

function groupBy(list: readonly TaxPositionRecord[], keyOf: (r: TaxPositionRecord) => string): RollupGroup[] {
  type G = { g: RollupGroup; gain: Acc; lt: Acc; st: Acc; unc: Acc; fund: Acc; order: number };
  const m = new Map<string, G>();
  for (const r of list) {
    let k = keyOf(r);
    if (k === '') k = '(unspecified)';
    let e = m.get(k);
    if (!e) {
      e = { g: { key: k, label: k, cmv: 0, gain: gt(), ltCmv: 0, stCmv: 0, ltGain: gt(), stGain: gt(), unclassGain: gt(), fundGain: gt(), n: 0 },
        gain: acc(), lt: acc(), st: acc(), unc: acc(), fund: acc(), order: m.size };
      m.set(k, e);
    }
    const g = e.g;
    g.cmv += r.cmv;
    if (!isSecondPart(r)) g.n++;
    add(e.gain, r.holdingId, r.gain);
    g.ltCmv += r.lt.cmv;
    g.stCmv += r.st.cmv;
    if (r.fundLevel) add(e.fund, r.holdingId, r.gain);
    else if (r.status !== 'unmapped' && r.status !== 'unreconciled' && r.notSplit === null) {
      // A split record: its long, short and unclassified gains (unknown only where that part has a value).
      if (splitKnown(r)) {
        add(e.lt, r.holdingId, r.lt.gain); add(e.st, r.holdingId, r.st.gain); add(e.unc, r.holdingId, r.unclassified.gain ?? 0);
      } else {
        if (r.lt.cmv > 0) add(e.lt, r.holdingId, null);
        if (r.st.cmv > 0) add(e.st, r.holdingId, null);
        if (r.unclassified.cmv > 0) add(e.unc, r.holdingId, null);
      }
    } else add(e.unc, r.holdingId, r.gain);
  }
  return [...m.values()].map((e) => {
    e.g.gain = e.gain.t; e.g.ltGain = e.lt.t; e.g.stGain = e.st.t; e.g.unclassGain = e.unc.t; e.g.fundGain = e.fund.t;
    return e;
  }).sort((a, b) => b.g.cmv - a.g.cmv || a.order - b.order).map((e) => e.g);
}

// ---------------------------------------------------------------------------------------------------------------
// summarise

const nst = (): NotSplitTotal => ({ n: 0, cmv: 0, gain: gt(), assumedN: 0, assumedCmv: 0, ruledN: 0, ruledCmv: 0 });

/** The live summarise over one set of records (the family, or one client). */
export function summariseRecords(
  pos: readonly TaxPositionRecord[], unrec: readonly TaxPositionRecord[], unmap: readonly TaxPositionRecord[],
  facts: ReadonlyMap<HoldingId, HoldingFacts>, opts: HoldingsRollupOptions = {},
): HoldingsTaxSummary {
  const byInst = i21ByInst(opts.table ?? TAX_RULES_I21);
  const A = { gain: acc(), lt: acc(), st: acc(), unc: acc(), locked: acc(), fund: acc() };
  const nsAcc: Record<NotSplitKind, Acc> = { 'fund-level': acc(), 'pass-through': acc(), 'per-security': acc() };
  const t: HoldingsTaxTotals = {
    cmv: 0, gain: gt(), gainMissing: 0, lt: { cmv: 0, gain: gt() }, st: { cmv: 0, gain: gt() },
    unclassified: { cmv: 0, gain: gt() }, locked: { cmv: 0, gain: gt(), n: 0 }, fundLevel: { cmv: 0, gain: gt(), n: 0 },
    notSplit: { 'fund-level': nst(), 'pass-through': nst(), 'per-security': nst() }, nPos: 0, nHold: 0,
  };
  type C = { p: ClassPool; gain: Acc; lt: Acc; st: Acc; order: number };
  const cls = new Map<string, C>();
  /** Holdings already counted in a class's gainUnknown (a split holding's two records count once, R2 S-4). */
  const gainUnknownSeen = new Set<HoldingId>();
  for (const r of pos) {
    t.cmv += r.cmv;
    add(A.gain, r.holdingId, r.gain);
    if (r.gain === null && !isSecondPart(r)) t.gainMissing++;
    const key = r.taxRule ?? '';
    let c = cls.get(key);
    if (!c) {
      c = { p: { cls: key, rule: byInst.get(key) ?? null, cmv: 0, ltCmv: 0, stCmv: 0, gain: gt(), ltGain: gt(), stGain: gt(), n: 0,
        ltPos: 0, ltNeg: 0, stPos: 0, stNeg: 0, notSplit: null, gainUnknown: 0 }, gain: acc(), lt: acc(), st: acc(), order: cls.size };
      cls.set(key, c);
    }
    const g = c.p;
    g.cmv += r.cmv;
    g.n++;
    add(c.gain, r.holdingId, r.gain);
    if (r.notSplit !== null) {
      // TX-07, TX-10, TX-12: no investor-level split, never in a gain or loss pool.
      const ns = t.notSplit[r.notSplit];
      ns.n++; ns.cmv += r.cmv; add(nsAcc[r.notSplit], r.holdingId, r.gain);
      if (r.catAssumed) { ns.assumedN++; ns.assumedCmv += r.cmv; }
      if (r.catRuled) { ns.ruledN++; ns.ruledCmv += r.cmv; }
      g.notSplit = r.notSplit;
      if (r.fundLevel) { t.fundLevel.cmv += r.cmv; t.fundLevel.n++; add(A.fund, r.holdingId, r.gain); }
      else { t.unclassified.cmv += r.unclassified.cmv; add(A.unc, r.holdingId, r.gain); }
      continue;
    }
    t.lt.cmv += r.lt.cmv; t.st.cmv += r.st.cmv; t.unclassified.cmv += r.unclassified.cmv;
    if (r.locked && r.locked.cmv > 0) { t.locked.cmv += r.locked.cmv; t.locked.n++; add(A.locked, r.holdingId, r.locked.gain); }
    g.ltCmv += r.lt.cmv; g.stCmv += r.st.cmv;
    if (splitKnown(r)) {
      const lg = r.lt.gain!; const sg = r.st.gain!;
      add(A.lt, r.holdingId, lg); add(A.st, r.holdingId, sg); add(A.unc, r.holdingId, r.unclassified.gain ?? 0);
      add(c.lt, r.holdingId, lg); add(c.st, r.holdingId, sg);
      // Pooled at position level: a losing holding is a harvest candidate even inside a class that nets positive.
      if (lg > 0) g.ltPos += lg; else g.ltNeg += -lg;
      if (sg > 0) g.stPos += sg; else g.stNeg += -sg;
    } else {
      if (r.lt.cmv > 0) { add(A.lt, r.holdingId, null); add(c.lt, r.holdingId, null); }
      if (r.st.cmv > 0) { add(A.st, r.holdingId, null); add(c.st, r.holdingId, null); }
      if (r.unclassified.cmv > 0) add(A.unc, r.holdingId, null);
      if (!gainUnknownSeen.has(r.holdingId)) { gainUnknownSeen.add(r.holdingId); g.gainUnknown++; }
    }
  }
  // Unreconciled and unmapped holdings hold real money: in CMV and gain, and all of it unclassified.
  for (const r of [...unrec, ...unmap]) {
    t.cmv += r.cmv; t.unclassified.cmv += r.cmv;
    add(A.gain, r.holdingId, r.gain); add(A.unc, r.holdingId, r.gain);
    if (r.gain === null) t.gainMissing++;
  }
  t.gain = A.gain.t; t.lt.gain = A.lt.t; t.st.gain = A.st.t; t.unclassified.gain = A.unc.t;
  t.locked.gain = A.locked.t; t.fundLevel.gain = A.fund.t;
  for (const k of Object.keys(nsAcc) as NotSplitKind[]) t.notSplit[k].gain = nsAcc[k].t;
  t.nPos = pos.filter((r) => !isSecondPart(r)).length;
  t.nHold = t.nPos + unrec.length + unmap.length;
  const byClass = [...cls.values()].map((c) => { c.p.gain = c.gain.t; c.p.ltGain = c.lt.t; c.p.stGain = c.st.t; return c; })
    .sort((a, b) => b.p.cmv - a.p.cmv || a.order - b.order).map((c) => c.p);
  const all = [...pos, ...unrec, ...unmap];
  const f = (r: TaxPositionRecord): HoldingFacts | undefined => facts.get(r.holdingId);
  return {
    totals: t, byClass,
    byProduct: groupBy(all, (r) => f(r)?.product ?? ''),
    byAsset: groupBy(all, (r) => f(r)?.assetClass ?? f(r)?.assetLabel ?? ''),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The family and its clients

/** The holdings roll-ups of a computeTaxLots result: the family, each client, and the legacy-facing figures. */
export function rollupHoldings(lots: Pick<TaxLotsResult, 'positions' | 'unreconciled' | 'unmapped'>, holdings: readonly HoldingFacts[],
  opts: HoldingsRollupOptions = {}): HoldingsTaxRollup {
  const facts = new Map(holdings.map((h) => [h.id, h]));
  const all = [...lots.positions, ...lots.unreconciled, ...lots.unmapped];
  const sources = [...new Set(all.map((r) => facts.get(r.holdingId)?.sourceId).filter((x): x is NonNullable<typeof x> => !!x))];
  const prov: Provenance = { sources, method: 'holdings tax roll-up: the FIFO lots of each holding to the as-on date, added up (E-43)' };
  const family = summariseRecords(lots.positions, lots.unreconciled, lots.unmapped, facts, opts);
  const order: Array<ClientId | null> = [];
  for (const r of all) if (!order.includes(r.clientId)) order.push(r.clientId);
  const pick = (arr: readonly TaxPositionRecord[], c: ClientId | null): TaxPositionRecord[] => arr.filter((r) => r.clientId === c);
  const clients = order.map((c, i) => {
    const p = pick(lots.positions, c); const u = pick(lots.unreconciled, c); const m = pick(lots.unmapped, c);
    const first = [...p, ...u, ...m][0];
    const label = c === null ? null : (first ? facts.get(first.holdingId)?.clientLabel ?? null : null);
    return { s: { clientId: c, clientLabel: label, positions: p, unreconciled: u, unmapped: m, ...summariseRecords(p, u, m, facts, opts) }, i };
  }).sort((a, b) => b.s.totals.cmv - a.s.totals.cmv || a.i - b.i).map((x) => x.s);
  const unnamedN = all.filter((r) => r.clientId === null && !isSecondPart(r)).length;
  const split = lots.positions.filter((r) => r.notSplit === null && !isSecondPart(r)).length;
  const unrec = lots.unreconciled.length;
  return {
    family, clients, unnamedN, facts, prov,
    legacy: {
      unrealised: {
        st: withUnreconciled(gainValue(family.totals.st.gain, { ...prov, method: `${prov.method}; tax.unrealised.st` }, 'short-term gain'), split, unrec, prov),
        lt: withUnreconciled(gainValue(family.totals.lt.gain, { ...prov, method: `${prov.method}; tax.unrealised.lt` }, 'long-term gain'), split, unrec, prov),
      },
    },
  };
}

/**
 * F-2, F-3: a legacy unrealised figure with the holdings unreconciled with the IRR file left out: unchanged when there are
 * none; NOT AVAILABLE when no holding is split; else PARTIAL COVERAGE (split / (split + unreconciled), or lower).
 */
function withUnreconciled(v: Value<number>, split: number, unrec: number, prov: Provenance): Value<number> {
  if (unrec === 0 || v.kind === 'missing') return v;
  const why = `${plural(unrec, 'holding')} not split (unreconciled with the IRR file) left out`;
  if (split === 0) return missing(STATUS.NOT_AVAILABLE, `no holding is split into long and short term: ${why}`, prov);
  return present(v.v, 'inr', { ...v.prov, method: `${v.prov.method}; ${STATUS.PARTIAL}: ${why}` },
    { coverage: Math.min(v.coverage ?? 1, split / (split + unrec)) });
}
