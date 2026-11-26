// Realised gains derived from the IRR file's fund flows (NB-M7a S5; parity rows E-141 engine half and E-42; architecture
// §6.7: "else IRR redemptions matched FIFO ('derived from transactions')"; DATA_DICTIONARY §5.5 `RealisedGain.source`;
// design docs/new-build/capital-gains-upload.md §8; AC-18 "without one, gains labelled 'derived from transactions'";
// OD-2, OD-16; Q-49).
//
// Per client and instrument (the key lots.ts uses: the IRR client id and the normalised instrument name), the trades in
// day order (file order within a day) run through one FIFO ledger of UNITS, reusing the S4a ledger step (lots.ts
// `consumeFifo`, `tradePriceOf`, `isTradeFlow`):
//   - a purchase (direction 'in', OD-16) with a price is a lot of |amount| / price units at that price; one without a
//     price is a lot whose units are not known;
//   - a sale (direction 'out': redemption, SWP, switch out, STP out, transfer out) with a price sells |amount| / price
//     units, oldest lots first; each lot it reaches gives one derived lot: the purchase date, the cost (units taken x
//     the buy price, which is the buy row's amount share), the sale value share (|amount| x units taken / units sold),
//     realised = sale share minus cost, the financial year of the sale (ingest/capital-gains.ts `financialYearOf`) and
//     the term by the I-21 class's months to the sale date (strictly after the anniversary, OD-2) when the instrument
//     joins a holding (classify.ts `classifyHolding`), else the term is not known;
//   - untyped and unrecognised rows (OD-16) and valuation rows move no lot; they are counted (the type labels named);
//   - a trade dated after `asOn`, when given, is left out and counted (D-040 a).
// Never a guessed figure (Q-49): a gap gives a derived lot whose cost and realised gain are missing, with the gap named:
//   - 'sale-without-price': a sale without a price (its units are not known);
//   - 'purchase-without-price': the sale reaches a purchase without a price (its units are not known);
//   - 'units-beyond-held': the sale sells more units than the earlier purchases hold (beyond UNITS_TOLERANCE);
//   - 'after-earlier-gap': a sale after one of the first two gaps in the same instrument, since which units remain is
//     then not known.
// Output: the engine-local DerivedLot (the contract's RealisedGain with `source: 'derived from transactions'` and the
// lines the contract does not hold), and per scheme and financial year the totals. Derived lots carry no tax
// computation in S5: the tax class, rule and taxable gain are missing (notComputed 'tax-class-not-set').
// Money in rupees, unrounded (LD-42). Pure. Messages carry counts and type labels only: never a client, folio or amount.

import type { Holding } from '../../model/holding.ts';
import type { Transaction, TransactionKind } from '../../model/transactions.ts';
import type { RealisedGain, Term } from '../../model/tax.ts';
import type { ClientId, HoldingId, SourceFileId } from '../../model/ids.ts';
import type { RowRef } from '../../model/source.ts';
import type { DayNumber, Provenance, Value } from '../../model/value.ts';
import type { ValidationResult } from '../../model/validation.ts';
import { STATUS } from '../../model/status.ts';
import { financialYearOf } from '../../ingest/capital-gains.ts';
import { keyOf, normaliseLabel } from '../ids.ts';
import { missing, present } from '../value.ts';
import type { HoldingJoin } from '../returns/irr-tree.ts';
import { matcherJoin } from '../returns/scope.ts';
import { consumeFifo, isTradeFlow, lotTerm, tradePriceOf } from './lots.ts';
import { TAX_RULES_I21, classifyHolding, i21ByInst, i21Day, isListedEtf } from './classify.ts';
import type { ClassifyContext, I21Row } from './classify.ts';

/** Units sold beyond the units held up to this many are rounding (3 decimals, as repeat-evidence.ts compares units). */
export const UNITS_TOLERANCE = 0.0005;

export const DERIVED_SOURCE = 'derived from transactions' as const;

/** Why a derived lot's cost and realised gain are not computed. */
export type DerivedGap = 'sale-without-price' | 'purchase-without-price' | 'units-beyond-held' | 'after-earlier-gap';

export const DERIVED_GAPS: readonly DerivedGap[] = ['sale-without-price', 'purchase-without-price', 'units-beyond-held', 'after-earlier-gap'];

const GAP_TEXT: Readonly<Record<DerivedGap, string>> = {
  'sale-without-price': 'a sale without a price: the units it sold are not known',
  'purchase-without-price': 'the sale reaches a purchase without a price: the units of that purchase are not known',
  'units-beyond-held': 'the sale sells more units than the earlier purchases in the IRR file hold',
  'after-earlier-gap': 'an earlier gap in this scheme leaves the units remaining not known',
};

/** One derived lot: the contract's RealisedGain (source 'derived from transactions') and the lines it does not hold. */
export type DerivedLot = RealisedGain & {
  source: typeof DERIVED_SOURCE;
  /** The client and instrument key (lots.ts: client id and normalised instrument name). */
  instrumentKey: string;
  instrumentName: string | null;
  clientLabel: string;
  /** The sale's kind (OD-16 out kinds). */
  saleKind: TransactionKind;
  /** The purchase row the lot came from; null for a gap lot that reached no purchase. */
  buyAt: RowRef | null;
  buyKind: TransactionKind | null;
  /** The I-21 row whose months gave the term; null when no holding joins or the joined holdings have no one class. */
  i21: string | null;
  /** Null for a computed lot; the gap otherwise (cost and realised missing). */
  gap: DerivedGap | null;
  financialYearLabel: string;
};

/** The derived totals of one client's instrument in one financial year (rupees). */
export type DerivedSchemeYear = {
  clientId: ClientId;
  clientLabel: string;
  instrumentKey: string;
  instrumentName: string | null;
  fy: number;
  fyLabel: string;
  lots: number;
  /** Lots with a gap, by gap. */
  gapLots: number;
  gaps: Partial<Record<DerivedGap, number>>;
  /** The sale value of the computed lots, and of every lot whose sale value is known. */
  saleValueComputed: number;
  /** Realised over the computed lots; PARTIAL COVERAGE (coverage below 1) with gap lots; missing when every lot has one. */
  realised: Value<number>;
  realisedComputed: number;
  st: number;
  lt: number;
  /** Realised of computed lots whose term is not known (no joined holding, or a row without a holding period). */
  unknownTerm: number;
  holdingIds: HoldingId[];
};

export type DerivedCounts = {
  flows: number;
  /** Trades (direction in or out) used. */
  trades: number;
  sales: number;
  purchases: number;
  valuation: number;
  /** OD-16: untyped rows, and each unrecognised type label with its rows; counted, not used. */
  untyped: number;
  unrecognised: Array<{ label: string; rows: number }>;
  /** Trades after `asOn`, left out. */
  later: number;
  salesWithoutPrice: number;
  purchasesWithoutPrice: number;
  /** Instruments with sales whose term is not known (no joined holding, or no one class). */
  instrumentsTermUnknown: number;
};

/** One client's instrument as the derivation saw it (all instruments with trades, sold or not). */
export type DerivedInstrument = {
  clientId: ClientId;
  clientLabel: string;
  instrumentKey: string;
  instrumentName: string | null;
  holdingIds: HoldingId[];
  i21: string | null;
};

export type DerivedRealised = {
  source: typeof DERIVED_SOURCE;
  lots: DerivedLot[];
  schemeYears: DerivedSchemeYear[];
  instruments: DerivedInstrument[];
  counts: DerivedCounts;
  issues: ValidationResult[];
};

export type DeriveOptions = {
  /** The base file's holdings, for the term (classification); without them every term is not known. */
  holdings?: readonly Holding[];
  /** The holdings join; defaults to the returns' join (engine/returns/scope.ts matcherJoin), as lots.ts. */
  join?: HoldingJoin;
  /** Trades after this day are left out and counted (D-040 a); absent: none left out. */
  asOn?: DayNumber;
  /** Reference-data facts for the classification of one holding (as lots.ts). */
  classifyContext?: (h: Holding) => Omit<ClassifyContext, 'refDay'>;
  /** The I-21 table; defaults to data/refdata/TAX_RULES.json. */
  table?: readonly I21Row[];
  /** The IRR file's source id, for the validation results' scope (default: the first flow's). */
  sourceId?: SourceFileId;
};

const EPS = 1e-9;

type LedgerLot = { u: number; known: boolean; px: number | null; day: DayNumber; at: RowRef; kind: TransactionKind };

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The instrument key of lots.ts: the client id and the normalised instrument name. */
export function derivedInstrumentKey(clientId: ClientId, instrumentName: string | null): string {
  return keyOf([clientId, normaliseLabel(instrumentName)]);
}

/** Realised gains derived from the IRR fund flows by FIFO on the units ledger (see the header). */
export function deriveRealisedGains(fund: readonly Transaction[], opts: DeriveOptions = {}): DerivedRealised {
  const holdings = opts.holdings ?? [];
  const join = opts.join ?? matcherJoin(holdings, fund);
  const byInst = i21ByInst(opts.table ?? TAX_RULES_I21);
  const holdingById = new Map(holdings.map((h) => [h.id, h]));
  const counts: DerivedCounts = {
    flows: fund.length, trades: 0, sales: 0, purchases: 0, valuation: 0, untyped: 0, unrecognised: [], later: 0,
    salesWithoutPrice: 0, purchasesWithoutPrice: 0, instrumentsTermUnknown: 0,
  };
  const sourceId = opts.sourceId ?? fund[0]?.at.sourceId ?? null;

  // 1. Trades in day order (file order within a day), grouped by client and instrument; the rest counted.
  const sorted = fund.map((t, i) => ({ t, i })).sort((a, b) => a.t.day - b.t.day || a.i - b.i).map((x) => x.t);
  const groups = new Map<string, Transaction[]>();
  for (const t of sorted) {
    if (t.direction === 'valuation') { counts.valuation++; continue; }
    if (t.kind === 'untyped') { counts.untyped++; continue; }
    if (t.kind === 'unrecognised') {
      const label = t.typeLabel ?? '';
      const e = counts.unrecognised.find((x) => x.label === label);
      if (e) e.rows++; else counts.unrecognised.push({ label, rows: 1 });
      continue;
    }
    if (!isTradeFlow(t)) continue;
    if (opts.asOn !== undefined && t.day > opts.asOn) { counts.later++; continue; }
    counts.trades++;
    if (t.direction === 'in') counts.purchases++; else counts.sales++;
    const k = derivedInstrumentKey(t.clientId, t.instrumentName);
    const l = groups.get(k);
    if (l) l.push(t); else groups.set(k, [t]);
  }

  // 2. The ledger of each instrument.
  const lots: DerivedLot[] = [];
  const instruments: DerivedInstrument[] = [];
  for (const [key, trades] of groups) {
    const first = trades[0]!;
    const holdingIds = join(first.clientId, first.instrumentName).filter((id) => holdingById.has(id));
    const joined = holdingIds.map((id) => holdingById.get(id)!);
    /** The I-21 row for a sale day: the joined holdings' one class at that day, or null. */
    const ruleAt = (saleDay: DayNumber): { rule: I21Row; etf: boolean } | null => {
      if (!joined.length) return null;
      const insts = new Set(joined.map((h) => classifyHolding(h, { ...(opts.classifyContext ? opts.classifyContext(h) : {}), refDay: saleDay }).inst));
      if (insts.size !== 1) return null;
      const inst = [...insts][0]!;
      const rule = inst !== null ? byInst.get(inst) ?? null : null;
      return rule ? { rule, etf: joined.every((h) => isListedEtf(h)) } : null;
    };
    const firstSale = trades.find((t) => t.direction === 'out');
    const instRule = firstSale ? ruleAt(firstSale.day) : joined.length ? ruleAt(first.day) : null;
    instruments.push({
      clientId: first.clientId, clientLabel: first.clientLabel, instrumentKey: key, instrumentName: first.instrumentName,
      holdingIds, i21: instRule?.rule.inst ?? null,
    });
    if (firstSale && (instRule === null)) counts.instrumentsTermUnknown++;

    const ledger: LedgerLot[] = [];
    let broken = false;
    for (const t of trades) {
      const amt = Math.abs(t.amountRupees);
      const px = tradePriceOf(t);
      if (t.direction === 'in') {
        if (px === null) counts.purchasesWithoutPrice++;
        ledger.push({ u: px === null ? 0 : amt / px, known: px !== null, px, day: t.day, at: t.at, kind: t.kind });
        continue;
      }
      if (px === null) counts.salesWithoutPrice++;
      const fy = financialYearOf(t.day);
      const prov: Provenance = { sources: [t.at.sourceId], method: 'realised gain derived from the IRR file by FIFO on the units ledger (architecture section 6.7)' };
      const ra = ruleAt(t.day);
      const base = (o: {
        units: number | null; sale: number; buy: LedgerLot | null; cost: number | null; gap: DerivedGap | null;
      }): DerivedLot => {
        const gapWhy = o.gap !== null ? `not computed: ${GAP_TEXT[o.gap]}` : null;
        const buy = o.buy;
        let term: Value<Term>;
        if (buy === null || !buy.known) term = missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'no purchase date');
        else if (ra === null) term = missing(STATUS.NOT_AVAILABLE, 'term not known: the scheme joins no holding of the base file with one tax class', prov);
        else {
          const sfDay = ra.rule.specifiedFrom && ra.rule.before ? i21Day(ra.rule.specifiedFrom) : null;
          const pre = sfDay !== null && buy.day < sfDay ? byInst.get(ra.rule.before!) ?? null : null;
          const r = pre ?? ra.rule;
          const tm = lotTerm(r, buy.day, t.day, ra.etf);
          term = tm === null ? missing(STATUS.NOT_AVAILABLE, 'term not known: the tax row has no holding period', prov)
            : present(tm, 'label', { ...prov, method: `term by the I-21 row "${r.inst}" to the sale date, long strictly after the anniversary (OD-2)` });
        }
        const realised: Value<number> = o.cost !== null && o.gap === null
          ? present(o.sale - o.cost, 'inr', prov) : missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'cost not known', prov);
        const noTax = missing(STATUS.NOT_AVAILABLE, 'tax not computed on a lot derived from transactions (S5)');
        return {
          source: DERIVED_SOURCE, at: t.at, scheme: t.instrument, schemeLabel: t.instrumentName ?? '', folio: t.folio,
          tagAsset: null, category: t.categoryLabel, statementAsset: null, clientId: t.clientId, accountId: null,
          distributorId: t.distributorId, accountLabel: t.accountLabel, accountNote: null, saleDate: t.day,
          units: o.units !== null ? present(o.units, 'units', prov) : missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'units not known', prov),
          saleValue: present(o.sale, 'inr', prov),
          salePrice: px !== null ? present(px, 'inr-per-unit', prov) : missing(STATUS.NOT_AVAILABLE, 'the sale carries no price', prov),
          salePriceDerived: false,
          purchasePrice: buy !== null && buy.px !== null ? present(buy.px, 'inr-per-unit', prov) : missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'no purchase price', prov),
          purchasePriceDerived: false,
          purchaseValue: o.cost !== null && o.gap === null ? present(o.cost, 'inr', prov) : missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'cost not known', prov),
          purchaseDate: buy !== null ? present(buy.day, 'date', prov) : missing(STATUS.NOT_AVAILABLE, gapWhy ?? 'no purchase', prov),
          realised, financialYear: fy.start, financialYearLabel: fy.label,
          taxClass: noTax, listed: noTax, subType: 'none', lotClass: 'standard', term, ruleId: null, costForTax: noTax,
          costBasis: 'none', taxableGain: noTax, notComputed: 'tax-class-not-set', legs: null, anniversaryLongTerm: null,
          duplicateOf: null, excludedAsRepeat: false, statement: null, flags: o.gap !== null ? ['tax.derived-gaps'] : [],
          instrumentKey: key, instrumentName: t.instrumentName, clientLabel: t.clientLabel, saleKind: t.kind,
          buyAt: buy?.at ?? null, buyKind: buy?.kind ?? null, i21: ra?.rule.inst ?? null, gap: o.gap,
        };
      };
      if (broken) {
        lots.push(base({ units: px !== null ? amt / px : null, sale: amt, buy: null, cost: null, gap: 'after-earlier-gap' }));
        continue;
      }
      if (px === null) {
        lots.push(base({ units: null, sale: amt, buy: null, cost: null, gap: 'sale-without-price' }));
        broken = true;
        continue;
      }
      const saleUnits = amt / px;
      const firstUnknown = ledger.findIndex((x) => !x.known && x.u >= 0);
      const known = firstUnknown < 0 ? ledger.slice() : ledger.slice(0, firstUnknown);
      const { takes, short } = consumeFifo(known, saleUnits);
      const gapped = short > UNITS_TOLERANCE || (short > 0 && takes.length === 0);
      // Within the tolerance the residue is rounding: the sale value is shared over the units taken.
      const denom = gapped ? saleUnits : saleUnits - short;
      for (const tk of takes) {
        const b = known[tk.index]!;
        lots.push(base({ units: tk.take, sale: amt * tk.take / denom, buy: b, cost: tk.take * b.px!, gap: null }));
      }
      if (gapped) {
        const reached = firstUnknown >= 0 ? ledger[firstUnknown]! : null;
        lots.push(base({ units: short, sale: amt * short / saleUnits, buy: reached, cost: null, gap: reached ? 'purchase-without-price' : 'units-beyond-held' }));
        if (reached) broken = true;
      }
      // Lots used up leave the ledger (a lot without known units stays until a gap breaks the ledger).
      for (let i = ledger.length - 1; i >= 0; i--) if (ledger[i]!.known && ledger[i]!.u <= EPS) ledger.splice(i, 1);
    }
  }

  // 3. Per scheme and financial year.
  const sy = new Map<string, DerivedSchemeYear & { _lots: DerivedLot[] }>();
  const instByKey = new Map(instruments.map((x) => [x.instrumentKey, x]));
  for (const l of lots) {
    const k = keyOf([l.instrumentKey, String(l.financialYear)]);
    let e = sy.get(k);
    if (!e) {
      e = {
        clientId: l.clientId!, clientLabel: l.clientLabel, instrumentKey: l.instrumentKey, instrumentName: l.instrumentName,
        fy: l.financialYear, fyLabel: l.financialYearLabel, lots: 0, gapLots: 0, gaps: {}, saleValueComputed: 0,
        realised: missing(STATUS.NOT_AVAILABLE, 'no lot'), realisedComputed: 0, st: 0, lt: 0, unknownTerm: 0,
        holdingIds: instByKey.get(l.instrumentKey)?.holdingIds ?? [], _lots: [],
      };
      sy.set(k, e);
    }
    e._lots.push(l);
  }
  const schemeYears: DerivedSchemeYear[] = [];
  for (const e of sy.values()) {
    const { _lots, ...row } = e;
    for (const l of _lots) {
      row.lots++;
      if (l.gap !== null) { row.gapLots++; row.gaps[l.gap] = (row.gaps[l.gap] ?? 0) + 1; continue; }
      const r = (l.realised as { v: number }).v;
      row.realisedComputed += r;
      row.saleValueComputed += (l.saleValue as { v: number }).v;
      if (l.term.kind === 'value') { if (l.term.v === 'long') row.lt += r; else row.st += r; } else row.unknownTerm += r;
    }
    row.realised = derivedTotal(row.realisedComputed, row.lots, row.gapLots, sourceOf(_lots));
    schemeYears.push(row);
  }
  schemeYears.sort((a, b) => a.fy - b.fy || (a.clientId < b.clientId ? -1 : a.clientId > b.clientId ? 1 : 0)
    || normaliseLabel(a.instrumentName).localeCompare(normaliseLabel(b.instrumentName)));

  return { source: DERIVED_SOURCE, lots, schemeYears, instruments, counts, issues: deriveIssues(lots, counts, sourceId) };
}

function sourceOf(lots: readonly DerivedLot[]): string[] {
  return [...new Set(lots.map((l) => l.at.sourceId))];
}

/** A derived total over lots: PARTIAL COVERAGE (coverage below 1) with gap lots, missing when every lot has one. */
export function derivedTotal(computed: number, lots: number, gapLots: number, sources: string[]): Value<number> {
  const prov: Provenance = { sources, method: 'realised gains derived from transactions, summed' };
  if (gapLots === 0) return present(computed, 'inr', prov);
  const why = `${plural(gapLots, 'derived lot is', 'derived lots are')} not computed (a gap in the IRR file), left out`;
  if (gapLots >= lots) return missing(STATUS.NOT_AVAILABLE, why, prov);
  return present(computed, 'inr', { ...prov, method: `${prov.method}; PARTIAL: ${why}` }, { coverage: Math.min(1 - gapLots / lots, 1 - 1e-9) });
}

function deriveIssues(lots: readonly DerivedLot[], counts: DerivedCounts, sourceId: SourceFileId | null): ValidationResult[] {
  const out: ValidationResult[] = [];
  if (sourceId === null) return out;
  const add = (rule: string, severity: ValidationResult['severity'], message: string, count: number): void => {
    out.push({
      id: `tax.${rule}:${out.length + 1}`, ruleId: `tax.${rule}`, scope: { kind: 'file', sourceId }, message, severity,
      blocksPublication: false, resolution: 'none', status: 'open', decision: 'E-141', count,
    });
  };
  const gaps = lots.filter((l) => l.gap !== null);
  if (gaps.length) {
    const by = DERIVED_GAPS.map((g) => [g, gaps.filter((l) => l.gap === g).length] as const).filter(([, n]) => n > 0)
      .map(([g, n]) => `${n} ${GAP_TEXT[g]}`);
    add('derived-gaps', 'Warning',
      `${plural(gaps.length, 'realised lot derived from the IRR file is', 'realised lots derived from the IRR file are')} not computed and no figure is estimated for ${gaps.length === 1 ? 'it' : 'them'}: ${by.join('; ')}. The scheme and year totals they belong to are PARTIAL COVERAGE.`,
      gaps.length);
  }
  if (counts.untyped || counts.unrecognised.length) {
    const named = counts.unrecognised.map((u) => `"${u.label}" (${plural(u.rows, 'row', 'rows')})`);
    const parts = [counts.untyped ? plural(counts.untyped, 'row without a type', 'rows without a type') : null,
      named.length ? `rows of unrecognised types ${named.join(', ')}` : null].filter((x): x is string => x !== null);
    add('derived-unused-rows', 'Information', `Rows of the IRR file not used for the realised gains derived from transactions (OD-16): ${parts.join('; ')}.`,
      counts.untyped + counts.unrecognised.reduce((s, u) => s + u.rows, 0));
  }
  if (counts.instrumentsTermUnknown) {
    add('derived-term-unknown', 'Information',
      `${plural(counts.instrumentsTermUnknown, 'scheme with sales joins', 'schemes with sales join')} no holding of the base file with one tax class, so the term of the realised gains derived for ${counts.instrumentsTermUnknown === 1 ? 'it' : 'them'} is not known.`,
      counts.instrumentsTermUnknown);
  }
  return out;
}
