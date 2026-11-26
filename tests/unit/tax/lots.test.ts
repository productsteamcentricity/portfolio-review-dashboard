// covers: E-152 E-155 E-141 (statement lots: lot classes, tax class, term, taxable gain; design capital-gains-upload.md §5, §9.1, §9.2, §9.3 step 1)
// The statement-lot engine (app/src/engine/tax/{tax-class,lot-class,realised}.ts) end to end: each statement is written
// by the cg-statement generator's row writer, read back by the workbook reader and parseCapitalGains, and realised.
// The known answers come from tests/fixtures/cg-known-answers.json (design §13.4, copied by hand from the design
// text, never from the engine), compared to Rs 0.01 on unrounded values (LD-42). The rest is the §14 list for
// tests/unit/tax/lots.test.ts: each lot class, the merger date gates and answers, the successor rules, the §9.1 cases,
// each analyst mark, the 31 Jan 2018 value only under its rules, and every engine-side id of §11 that S2 owns.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { realiseLots, lotTax, emptyTaxInputs } from '../../../app/src/engine/tax/realised.ts';
import { schemeKeyOf } from '../../../app/src/engine/tax/tax-class.ts';
import { TAX_RULES_V1, cessRateFor } from '../../../app/src/engine/tax/rules.ts';
import { S2_ISSUE_SEVERITY } from '../../../app/src/engine/tax/types.ts';
import type { RealiseResult, RealisedGain, TaxInputs, TaxIssue } from '../../../app/src/engine/tax/types.ts';
import type { CgImport } from '../../../app/src/ingest/capital-gains.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import { parseLots } from '../../fixtures/make-cg-tax-lots.ts';
import type { KaLot } from '../../fixtures/make-cg-tax-lots.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const KA = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/cg-known-answers.json'), 'utf8'));
const day = (y: number, m: number, d: number): number => ymdToDay(y, m, d)!;
const AS_ON = day(2026, 9, 30);
const TOL = KA.tolerance as number;

/** Every issue raised in this file, for the §11 coverage check at the end. */
const RAISED: TaxIssue[] = [];

type RawInputs = {
  scheme?: Array<Record<string, unknown> & { scheme: string }>;
  mergerAnswers?: Array<{ lot: number; answer: string }>;
  lotMarks?: Array<Record<string, unknown>>;
  personYear?: TaxInputs['personYear'];
};

const toDay = (v: unknown): unknown => (Array.isArray(v) && v.length === 3 ? day(v[0], v[1], v[2]) : v);

/** The engine's inputs from the test's raw form: schemes by label, merger answers by a lot of the event, dates as [y, m, d]. */
function inputsFrom(imp: CgImport, raw: RawInputs = {}): TaxInputs {
  const inputs = emptyTaxInputs();
  for (const s of raw.scheme ?? []) {
    const { scheme, ...rest } = s;
    inputs.scheme.push({ schemeKey: schemeKeyOf(scheme), fy: null, ...rest } as TaxInputs['scheme'][number]);
  }
  for (const a of raw.mergerAnswers ?? []) inputs.mergerAnswers.push({ eventId: imp.lots[a.lot]!.eventId, answer: a.answer as 'non-taxable' });
  for (const m of raw.lotMarks ?? []) {
    const mark: Record<string, unknown> = { ...m };
    for (const k of ['resetOriginal', 'rebase']) {
      const x = mark[k];
      if (x !== null && typeof x === 'object') mark[k] = { ...(x as object), purchaseDate: toDay((x as { purchaseDate: unknown }).purchaseDate) };
    }
    inputs.lotMarks.push(mark as unknown as TaxInputs['lotMarks'][number]);
  }
  inputs.personYear.push(...(raw.personYear ?? []));
  return inputs;
}

function run(lots: readonly KaLot[], raw: RawInputs = {}, extra: Parameters<typeof parseLots>[1] = {}): { imp: CgImport; res: RealiseResult; g: RealisedGain[] } {
  const imp = parseLots(lots, extra);
  const res = realiseLots(imp, inputsFrom(imp, raw), { asOnDay: AS_ON, now: () => '2026-11-26T00:00:00.000Z' });
  RAISED.push(...res.issues);
  return { imp, res, g: res.gains };
}

const v = <T>(r: { kind: 'value'; v: T } | { kind: 'missing' }): T | null => (r.kind === 'value' ? r.v : null);
function near(actual: number | null, expected: number | null, what: string): void {
  if (expected === null) { assert.equal(actual, null, `${what}: expected missing, got ${actual}`); return; }
  assert.ok(actual !== null, `${what}: expected ${expected}, got missing`);
  assert.ok(Math.abs(actual - expected) <= TOL, `${what}: expected ${expected}, got ${actual}`);
}
const cessRate = (fy: number): number => {
  const c = cessRateFor(TAX_RULES_V1, fy);
  if (c.status !== 'ok') throw new Error(`no cess rate for ${fy}`);
  return c.rate;
};
const issue = (res: RealiseResult, id: string): TaxIssue | undefined => res.issues.find((i) => i.ruleId === `capital-gains.${id}`);

/** Compares one lot with its expected fields (only the fields the known answer gives). */
function checkLot(g: RealisedGain, e: Record<string, unknown>, slabPct: number | null, tag: string): void {
  const w = `${tag} lot ${e.lot}`;
  for (const [k, x] of Object.entries(e)) {
    switch (k) {
      case 'lot': break;
      case 'ruleId': case 'lotClass': case 'costBasis': case 'deemedShort': case 'exempt': case 'rate':
        assert.equal((g as unknown as Record<string, unknown>)[k], x, `${w} ${k}`); break;
      case 'term': case 'taxClass': case 'listed':
        assert.equal(v((g as unknown as Record<string, { kind: 'value'; v: unknown }>)[k]!), x, `${w} ${k}`); break;
      case 'costForTax': case 'taxableGain': case 'realised': case 'realisedCounted':
        near(v((g as unknown as Record<string, { kind: 'value'; v: number }>)[k]!), x as number | null, `${w} ${k}`); break;
      case 'nonTaxable': case 'statementGain': near((g as unknown as Record<string, number>)[k]!, x as number, `${w} ${k}`); break;
      case 'tax': near(v(lotTax(g.taxableGain, g, slabPct)), x as number | null, `${w} tax`); break;
      case 'cess': near(v(lotTax(g.taxableGain, g, slabPct))! * cessRate(g.financialYear), x as number, `${w} cess`); break;
      case 'total': { const t = v(lotTax(g.taxableGain, g, slabPct))!; near(t * (1 + cessRate(g.financialYear)), x as number, `${w} total`); break; }
      case 'legs': {
        const le = x as Record<string, Record<string, number> | string>;
        assert.ok(g.legs !== null, `${w} legs`);
        assert.equal(g.legs!.chosen, le.chosen, `${w} chosen leg`);
        for (const leg of ['indexed20', 'actual10'] as const) {
          const want = le[leg] as Record<string, number> | undefined;
          if (!want) continue;
          for (const f of Object.keys(want)) near(g.legs![leg][f as 'cost'], want[f]!, `${w} ${leg}.${f}`);
        }
        break;
      }
      case 'anniversaryLongTerm': {
        if (x === null) { assert.equal(g.anniversaryLongTerm, null, `${w} no long-term figure`); break; }
        const a = x as { ruleId: string; taxableGain: number; tax?: number };
        assert.ok(g.anniversaryLongTerm, `${w} long-term figure`);
        assert.equal(g.anniversaryLongTerm!.ruleId, a.ruleId, `${w} long-term rule`);
        near(g.anniversaryLongTerm!.taxableGain, a.taxableGain, `${w} long-term gain`);
        if (a.tax !== undefined) near(v(lotTax({ kind: 'value', v: g.anniversaryLongTerm!.taxableGain }, g.anniversaryLongTerm!, slabPct)), a.tax, `${w} long-term tax`);
        break;
      }
      case 'flags': for (const f of x as string[]) assert.ok(g.flags.includes(f), `${w} flag ${f} in [${g.flags}]`); break;
      case 'notFlags': for (const f of x as string[]) assert.ok(!g.flags.includes(f), `${w} no flag ${f} in [${g.flags}]`); break;
      case 'successor': assert.equal(g.successor?.kind ?? null, x, `${w} successor`); break;
      case 'doubleCounted': near(g.successor?.doubleCounted ?? null, x as number, `${w} double count`); break;
      case 'purchaseDate': { const d = x as number[]; assert.equal(v(g.purchaseDate), day(d[0]!, d[1]!, d[2]!), `${w} purchase date`); break; }
      default: throw new Error(`unknown expectation ${k}`);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------

describe('known answers KA-1 to KA-8, KA-14 to KA-17, NE-LT-1 equal legs (cg-known-answers.json, design §13.4)', () => {
  test('the file holds every lot-group case S2 owns and an empty rollup section', () => {
    const ids = (KA.cases as Array<{ id: string; group: string }>).map((c) => c.id);
    for (const id of ['KA-1', 'KA-2a', 'KA-2b', 'KA-3a', 'KA-3b', 'KA-4', 'KA-5', 'KA-6', 'KA-7', 'KA-8', 'KA-14', 'KA-15',
      'KA-15-reset', 'KA-16', 'KA-17', 'KA-17-two-lots', 'NE-LT-1-equal-legs']) assert.ok(ids.includes(id), id);
    assert.ok((KA.cases as Array<{ group: string }>).every((c) => c.group === 'lots'));
    assert.deepEqual(KA.rollup, []);
  });
  for (const c of KA.cases as Array<Record<string, any>>) {
    const variants = [{ id: c.id, inputs: {}, slabPct: c.slabPct ?? null, expect: c.expect }, ...((c.variants ?? []) as Array<Record<string, any>>)];
    for (const vt of variants) {
      test(`${vt.id} (${c.ref})`, () => {
        const raw: RawInputs = {
          ...c.inputs, lotMarks: [...(c.inputs.lotMarks ?? []), ...(vt.inputs?.lotMarks ?? [])],
          mergerAnswers: [...(c.inputs.mergerAnswers ?? []), ...(vt.inputs?.mergerAnswers ?? [])],
          scheme: [...(c.inputs.scheme ?? []), ...(vt.inputs?.scheme ?? [])],
        };
        const { g, imp } = run(c.lots, raw);
        assert.equal(imp.lots.length, c.lots.length, 'one lot per row');
        for (const e of vt.expect.lots) checkLot(g[e.lot]!, e, vt.slabPct ?? c.slabPct ?? null, vt.id);
      });
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// In-test lots

const EQ = { scheme: 'Sample Large Cap Fund - Regular Plan - Growth', asset: 'Equity', category: 'Large Cap Funds' };
const DEBT = { scheme: 'Sample Corporate Bond Fund - Regular Plan - Growth', asset: 'Debt', category: 'Corporate Bond Funds' };
type Base = { scheme: string; asset: string; category: string };
const L = (base: Base, buy: [number, number, number], sell: [number, number, number], x: Partial<KaLot> = {}): KaLot =>
  ({ ...base, buy, sell, units: 100, buyNav: 100, sellNav: 110, ...x });
const merger = (base: Base, buy: [number, number, number], sell: [number, number, number], x: Partial<KaLot> = {}): KaLot =>
  L(base, buy, sell, { sellNav: 120, ...x, over: { acqDate: sell, acqPrice: x.sellNav ?? 120, ltcg: 0, stcg: 0, ...(x.over ?? {}) } });
const scheme = (name: string, base: Base = EQ): Base => ({ ...base, scheme: `Sample ${name} - Regular Plan - Growth` });

describe('lotTax (per-lot tax before exemption, surcharge and cess)', () => {
  test('gain x rate; slab needs the slab rate; exempt 0; a rule to be confirmed or a missing gain is missing', () => {
    assert.deepEqual(lotTax({ kind: 'value', v: 1000 }, { rate: 0.125 }, null), { kind: 'value', v: 125 });
    assert.equal(lotTax({ kind: 'value', v: 1000 }, { rate: 'slab' }, null).kind, 'missing');
    assert.deepEqual(lotTax({ kind: 'value', v: 1000 }, { rate: 'slab' }, 30), { kind: 'value', v: 300 });
    assert.deepEqual(lotTax({ kind: 'value', v: 1000 }, { rate: 'exempt' }, null), { kind: 'value', v: 0 });
    assert.equal(lotTax({ kind: 'value', v: 1000 }, { rate: null }, 30).kind, 'missing');
    assert.equal(lotTax({ kind: 'value', v: 1000 }, { rate: 'two-leg' }, 30).kind, 'missing');
    assert.equal(lotTax({ kind: 'missing', status: 'NOT AVAILABLE IN SUPPLIED DATA' }, { rate: 0.1 }, 30).kind, 'missing');
  });
});

describe('lot classes (§5), one per lot, in the design order', () => {
  test('each class, and the lot-classes count', () => {
    const { g, res } = run([
      merger(scheme('Mid Cap Fund'), [2019, 7, 1], [2023, 11, 10]),
      merger(scheme('Focused Fund'), [2012, 6, 1], [2015, 1, 15]),
      L(EQ, [2017, 3, 10], [2019, 5, 20], { over: { acqDate: [2018, 1, 31], acqPrice: 105 } }),
      L(DEBT, [2018, 6, 11], [2022, 8, 16], { over: { acqPrice: 118.2143 } }),
      L(EQ, [2021, 1, 4], [2023, 1, 5]),
      L(EQ, [2021, 1, 4], [2023, 1, 5], { over: { acqDate: null, acqPrice: null } }),
      L(EQ, [2021, 1, 4], [2023, 1, 5], { over: { acqDate: [2021, 2, 1] } }),
    ]);
    assert.deepEqual(g.map((x) => x.lotClass), ['non-taxable-transfer', 'taxable-transfer', 'grandfathered', 'indexed-cost-shown', 'standard', 'standard', 'other']);
    assert.ok(g[6]!.flags.includes('lot-class-other'));
    assert.equal(g[6]!.ruleId, 'EQ-LT-3', 'other: the rule basis from the actual cost');
    near(v(g[6]!.taxableGain), 1000, 'other gain');
    const lc = issue(res, 'lot-classes')!;
    assert.deepEqual([lc.severity, lc.count], ['Information', 7]);
    assert.match(lc.message, /non-taxable-transfer 1, taxable-transfer 1, grandfathered 1, indexed-cost-shown 1, standard 2, other 1/);
    assert.deepEqual([issue(res, 'lot-class-other')!.severity, issue(res, 'lot-class-other')!.count], ['Warning', 1]);
  });
  test('the class is worked out again when the analyst changes the scheme class: grandfathered needs the equity class', () => {
    const lots = [L(EQ, [2017, 3, 10], [2019, 5, 20], { over: { acqDate: [2018, 1, 31], acqPrice: 105 } })];
    assert.equal(run(lots).g[0]!.lotClass, 'grandfathered');
    assert.equal(run(lots, { scheme: [{ scheme: EQ.scheme, taxClass: 'other-non-equity' }] }).g[0]!.lotClass, 'other');
  });
  test('the merger pattern needs LTCG and STCG present and 0, and the acquisition date on the sale date', () => {
    const { g } = run([
      merger(scheme('Mid Cap Fund'), [2019, 7, 1], [2023, 11, 10], { over: { ltcg: null } }),
      merger(scheme('Small Cap Fund'), [2019, 7, 1], [2023, 11, 10], { over: { acqPrice: 120.5 } }),
    ]);
    assert.deepEqual(g.map((x) => x.lotClass), ['other', 'other']);
  });
});

describe('merger events: the date gates and the three answers (§5, TR-5)', () => {
  const gateLots = (): KaLot[] => [
    merger(scheme('Gate A Fund', DEBT), [2012, 6, 1], [2015, 3, 31]),
    merger(scheme('Gate B Fund', DEBT), [2012, 6, 1], [2015, 4, 1]),
    merger(scheme('Gate C Fund', DEBT), [2012, 6, 1], [2016, 3, 31]),
    merger(scheme('Gate D Fund', DEBT), [2012, 6, 1], [2016, 4, 1]),
  ];
  test('defaults by date: before 2015-04-01 taxable (merger-taxable); from 2015-04-01 non-taxable; High open for every event', () => {
    const { g, res } = run(gateLots());
    assert.deepEqual(g.map((x) => x.lotClass), ['taxable-transfer', 'non-taxable-transfer', 'non-taxable-transfer', 'non-taxable-transfer']);
    assert.ok(g[0]!.flags.includes('merger-taxable'));
    assert.ok(!g[1]!.flags.includes('merger-taxable'));
    const h = issue(res, 'non-taxable-transfers')!;
    assert.deepEqual([h.severity, h.count, h.status, h.resolution], ['High', 4, 'open', 'analyst-decision']);
    assert.deepEqual([issue(res, 'merger-taxable')!.severity, issue(res, 'merger-taxable')!.count], ['Warning', 1]);
    assert.equal(g[0]!.ruleId, 'NE-ST-2', 'taxed as a sale on its date under the rule for its class and holding');
    assert.equal(v(g[1]!.taxableGain), 0);
    assert.equal(g[1]!.costBasis, 'none');
  });
  test('answers: plan consolidation in 2015-16 taxable; investor switch taxable without merger-taxable; non-taxable refused before the gate', () => {
    const { g, res } = run(gateLots(), {
      mergerAnswers: [{ lot: 0, answer: 'non-taxable' }, { lot: 1, answer: 'non-taxable' }, { lot: 2, answer: 'taxable-consolidation' }, { lot: 3, answer: 'investor-switch' }],
    });
    assert.deepEqual(g.map((x) => x.lotClass), ['taxable-transfer', 'non-taxable-transfer', 'taxable-transfer', 'taxable-transfer']);
    assert.ok(res.refusals.some((r) => r.input === 'merger-answer' && r.ref === g[0]!.eventId && /2015-04-01/.test(r.reason)));
    assert.ok(g[2]!.flags.includes('merger-taxable'));
    assert.ok(!g[3]!.flags.includes('merger-taxable'), 'an investor switch is a sale, not a failed merger');
    assert.equal(issue(res, 'non-taxable-transfers')!.count, 1, 'only the refused event stays open');
    assert.equal(issue(res, 'merger-taxable')!.count, 2);
    assert.equal(res.audit.filter((a) => /merger event/.test(a.summary)).length, 3);
    near(v(g[2]!.realisedCounted), 2000, 'a taxable transfer is realised like any sale');
  });
  test('cross-house-merger only when the scheme data names two fund houses', () => {
    const lots = [merger(scheme('Old House Fund'), [2019, 7, 1], [2023, 11, 10]), L(scheme('New House Fund'), [2019, 7, 1], [2025, 5, 2])];
    assert.equal(issue(run(lots).res, 'cross-house-merger'), undefined);
    const { g, res } = run(lots, { scheme: [{ scheme: scheme('Old House Fund').scheme, fundHouse: 'House One' }, { scheme: scheme('New House Fund').scheme, fundHouse: 'House Two' }] });
    assert.ok(g[0]!.flags.includes('cross-house-merger'));
    assert.deepEqual([issue(res, 'cross-house-merger')!.severity, issue(res, 'cross-house-merger')!.count], ['Warning', 1]);
    const same = run(lots, { scheme: [{ scheme: scheme('Old House Fund').scheme, fundHouse: 'House One' }, { scheme: scheme('New House Fund').scheme, fundHouse: 'House One' }] });
    assert.equal(issue(same.res, 'cross-house-merger'), undefined);
  });
});

describe('successor lots (§5, TR-5, LD-25, LD-37)', () => {
  const M = scheme('Merged Fund');
  const N = scheme('Successor Fund');
  test('successor-reset only after a non-taxable event', () => {
    const lots = [merger(M, [2019, 7, 1], [2023, 11, 10]), L(N, [2023, 11, 10], [2024, 6, 3], { buyNav: 120, sellNav: 130 })];
    const nt = run(lots);
    assert.equal(nt.g[1]!.successor?.kind, 'reset');
    assert.deepEqual([issue(nt.res, 'successor-reset')!.severity, issue(nt.res, 'successor-reset')!.count], ['Warning', 1]);
    const tx = run(lots, { mergerAnswers: [{ lot: 0, answer: 'taxable-consolidation' }] });
    assert.equal(tx.g[1]!.successor, null, 'after a taxable event a successor starting on the event date is correct');
    assert.equal(issue(tx.res, 'successor-reset'), undefined);
    assert.equal(issue(tx.res, 'successor-not-reset'), undefined);
  });
  test('successor-not-reset only after a taxable event; candidates listed by scheme', () => {
    const lots = [merger(M, [2019, 7, 1], [2023, 11, 10]), L(N, [2019, 7, 1], [2025, 6, 2], { sellNav: 150 })];
    assert.equal(run(lots).g[1]!.successor, null, 'non-taxable by default: the original date is correct');
    const { g, res } = run(lots, { mergerAnswers: [{ lot: 0, answer: 'investor-switch' }] });
    assert.equal(g[1]!.successor?.kind, 'not-reset');
    near(g[1]!.successor!.doubleCounted, 2000, 'double count (S - W) x V / W');
    assert.deepEqual([issue(res, 'successor-not-reset')!.severity, issue(res, 'successor-not-reset')!.count], ['Warning', 1]);
    assert.deepEqual(res.events[0]!.successors, [{ schemeLabel: N.scheme, lots: [1] }]);
  });
  test('analyst marks on lots they do not fit are refused, with the reason named', () => {
    const { res, g } = run([L(EQ, [2021, 1, 4], [2023, 1, 5])], { lotMarks: [{ lotIndex: 0, rebase: 'formula' }, { lotIndex: 0, resetOriginal: { purchaseDate: [2020, 1, 1], cost: 5000 } }] });
    assert.equal(res.refusals.filter((r) => r.input === 'lot-mark').length, 2);
    near(v(g[0]!.costForTax), 10000, 'cost unchanged');
  });
});

describe('tax class, listed flag and sub-type (§9.1)', () => {
  const FOF = { scheme: 'Sample Equity ETF Fund of Funds - Regular Plan - Growth', asset: 'Equity', category: 'FoFs Domestic' };
  test('the analyst class on a fund of funds per year: refused before 2018-04-01, EQ-FOF-1 in FY 2018-19, EQ-LT-3 in FY 2019-20, NE-LT-3 in FY 2021-22', () => {
    const { g, res } = run([
      L(FOF, [2016, 6, 1], [2017, 12, 1]),
      L(FOF, [2018, 5, 1], [2018, 12, 3]),
      L(FOF, [2018, 6, 1], [2019, 8, 1]),
      L(FOF, [2018, 6, 1], [2021, 8, 2]),
    ], { scheme: [
      { scheme: FOF.scheme, etfFof9090: false },
      { scheme: FOF.scheme, fy: 2017, taxClass: 'equity-oriented' },
      { scheme: FOF.scheme, fy: 2018, taxClass: 'equity-oriented' },
      { scheme: FOF.scheme, fy: 2019, taxClass: 'equity-oriented' },
      { scheme: FOF.scheme, fy: 2021, taxClass: 'other-non-equity' },
    ] });
    assert.equal(g[0]!.notComputed, 'tax-class-not-set', 'refused, and never equity-oriented on the Equity label');
    assert.ok(res.refusals.some((r) => r.input === 'scheme-class' && /2018-04-01/.test(r.reason)));
    assert.deepEqual([g[1]!.ruleId, g[1]!.subType, g[1]!.rate], ['EQ-FOF-1', 'etf-fof-90-90', 'slab']);
    assert.deepEqual([g[2]!.ruleId, g[2]!.subType], ['EQ-LT-3', 'etf-fof-90-90']);
    assert.deepEqual([g[3]!.ruleId, v(g[3]!.taxClass)], ['NE-LT-3', 'other-non-equity']);
    assert.ok(res.audit.some((a) => /scheme classes/.test(a.summary)));
  });
  test('the 90/90 flag: FY 2017-18 other non-equity (NE-ST-2); FY 2018-19 short EQ-FOF-1, long EQ-FOF-2 (the dash, rule-to-be-confirmed)', () => {
    const { g, res } = run([
      L(FOF, [2016, 6, 1], [2017, 12, 1]),
      L(FOF, [2018, 5, 1], [2018, 12, 3]),
      L(FOF, [2017, 5, 1], [2018, 12, 3]),
    ], { scheme: [{ scheme: FOF.scheme, etfFof9090: true }] });
    assert.deepEqual([g[0]!.ruleId, v(g[0]!.taxClass), g[0]!.taxClassSource], ['NE-ST-2', 'other-non-equity', 'ninety-ninety']);
    assert.equal(g[1]!.ruleId, 'EQ-FOF-1');
    assert.deepEqual([g[2]!.ruleId, g[2]!.notComputed, v(g[2]!.taxableGain)], ['EQ-FOF-2', 'rule-to-be-confirmed', null]);
    assert.deepEqual([issue(res, 'rule-to-be-confirmed')!.severity, issue(res, 'rule-to-be-confirmed')!.count], ['Warning', 1]);
  });
  test('a domestic fund of funds labelled Equity without the 90/90 flag is never equity-oriented (tax-class-not-set)', () => {
    const { g, res } = run([L(FOF, [2021, 4, 5], [2025, 8, 11])]);
    assert.deepEqual([g[0]!.notComputed, v(g[0]!.taxableGain), v(g[0]!.realised)], ['tax-class-not-set', null, 1000]);
    assert.ok(!g[0]!.flags.includes('specified-test-missing'), 'bought before 2023-04-01');
    assert.deepEqual([issue(res, 'tax-class-not-set')!.severity, issue(res, 'tax-class-not-set')!.count], ['Warning', 1]);
  });
  test('Sectoral and Thematic default with category-default-to-confirm, then the analyst class moves the lot to the non-equity row', () => {
    const TH = { scheme: 'Sample Infrastructure Fund - Regular Plan - Growth', asset: 'Equity', category: 'Thematic Funds' };
    const lots = [L(TH, [2023, 1, 2], [2025, 6, 2])];
    const a = run(lots);
    assert.deepEqual([a.g[0]!.ruleId, a.g[0]!.taxClassSource], ['EQ-LT-7', 'category']);
    assert.deepEqual([issue(a.res, 'category-default-to-confirm')!.severity, issue(a.res, 'category-default-to-confirm')!.count], ['Warning', 1]);
    const b = run(lots, { scheme: [{ scheme: TH.scheme, fy: 2025, taxClass: 'other-non-equity' }] });
    assert.deepEqual([b.g[0]!.ruleId, b.g[0]!.taxClassSource], ['NE-LT-4', 'analyst']);
    assert.ok(!b.g[0]!.flags.includes('category-default-to-confirm'));
    assert.ok(b.g[0]!.flags.includes('tax-class-differs'));
  });
  test('hybrids labelled Equity; usual bucket from TY 2026-27; multi-asset bought from 2023-04-01; an unmapped category', () => {
    const hy = (name: string, category: string, asset = 'Equity'): Base => ({ scheme: `Sample ${name} - Regular Plan - Growth`, asset, category });
    const AGG = hy('Aggressive Hybrid Fund', 'Aggressive Hybrid Funds');
    const { g, res } = run([
      L(AGG, [2022, 1, 3], [2024, 10, 1]),
      L(hy('Balanced Advantage Fund', 'Balanced Advantage Funds'), [2022, 1, 3], [2024, 10, 1]),
      L(hy('Conservative Hybrid Fund', 'Conservative Hybrid Funds'), [2023, 5, 2], [2024, 6, 3]),
      L(AGG, [2025, 5, 5], [2026, 6, 1]),
      L(hy('Multi Asset Allocation Fund', 'Multi Asset Allocation Funds', 'Debt'), [2023, 6, 1], [2025, 6, 2]),
      L(hy('Special Situations Fund', 'Special Situations Funds'), [2022, 1, 3], [2024, 10, 1]),
    ]);
    assert.deepEqual([g[0]!.ruleId, g[0]!.taxClassSource], ['EQ-LT-7', 'statement']);
    assert.ok(g[0]!.labels.includes("statement's classification"));
    assert.deepEqual([g[1]!.taxClassSource, g[1]!.ruleId], ['statement', 'EQ-LT-7']);
    assert.deepEqual([g[2]!.ruleId, v(g[2]!.taxClass)], ['NE-50AA-1', 'specified-mf']);
    assert.ok(g[2]!.flags.includes('tax-class-differs'));
    assert.deepEqual([g[3]!.ruleId, g[3]!.taxClassSource], ['EQ-LT-9', 'category']);
    assert.ok(g[3]!.flags.includes('usual-bucket-default'));
    assert.deepEqual([g[4]!.notComputed], ['tax-class-not-set']);
    assert.ok(g[4]!.flags.includes('specified-test-missing'));
    assert.ok(g[5]!.flags.includes('category-unmapped') && g[5]!.flags.includes('tax-class-from-statement'));
    for (const [id, n] of [['tax-class-from-statement', 3], ['usual-bucket-default', 1], ['specified-test-missing', 1], ['category-unmapped', 1], ['tax-class-differs', 1]] as const) {
      assert.deepEqual([issue(res, id)!.severity, issue(res, id)!.count], ['Warning', n], id);
    }
    // The analyst overrides the aggressive hybrid's class for FY 2024-25 (an audit entry).
    const o = run([L(AGG, [2022, 1, 3], [2024, 10, 1])], { scheme: [{ scheme: AGG.scheme, fy: 2024, taxClass: 'other-non-equity' }] });
    assert.deepEqual([o.g[0]!.ruleId, o.g[0]!.taxClassSource], ['NE-LT-4', 'analyst']);
    assert.equal(o.res.audit.length, 1);
  });
  test('listed or unlisted from 23 Jul 2024: gold ETF by name, gold fund of funds, the close-ended mark (dash only where the rule depends on it)', () => {
    const GOLD_ETF = { scheme: 'Sample Gold ETF', asset: 'Debt', category: 'Gold ETFs' };
    const GOLD_FOF = { scheme: 'Sample Gold Fund of Fund - Regular Plan - Growth', asset: 'Debt', category: 'FoFs Domestic' };
    const FMP = { scheme: 'Sample Fixed Term Plan Series 1 - Regular Plan - Growth', asset: 'Debt', category: 'Corporate Bond Funds' };
    const FMP2 = { scheme: 'Sample Fixed Term Plan Series 2 - Regular Plan - Growth', asset: 'Debt', category: 'Corporate Bond Funds' };
    const BAL = { scheme: 'Sample Interval Balanced Fund - Regular Plan - Growth', asset: 'Debt', category: 'Balanced Hybrid Funds' };
    const lots = [
      L(GOLD_ETF, [2023, 1, 2], [2024, 9, 2]),
      L(GOLD_FOF, [2023, 1, 2], [2024, 9, 2]),
      L(FMP, [2023, 1, 2], [2024, 9, 2]),
      L(FMP2, [2023, 5, 2], [2024, 9, 2]),
      L(BAL, [2024, 1, 2], [2024, 9, 2]),
    ];
    const closeEnded = [FMP, FMP2, BAL].map((s) => ({ scheme: s.scheme, closeEnded: true }));
    const { g, res } = run(lots, { scheme: closeEnded });
    assert.deepEqual([g[0]!.ruleId, v(g[0]!.listed), g[0]!.listedSource], ['NE-LT-4L', true, 'etf-name']);
    assert.deepEqual([g[1]!.ruleId, v(g[1]!.listed)], ['NE-ST-3', false]);
    assert.deepEqual([g[2]!.notComputed, g[2]!.listedSource], ['listed-flag-missing', 'missing']);
    assert.deepEqual([g[3]!.ruleId, g[3]!.flags.includes('listed-flag-missing')], ['NE-50AA-1', false]);
    assert.equal(g[4]!.ruleId, 'NE-ST-3');
    assert.ok(g[4]!.labels.includes('listed flag missing; same figures either way'));
    assert.deepEqual([issue(res, 'listed-flag-missing')!.severity, issue(res, 'listed-flag-missing')!.count], ['Warning', 1]);
    // Without the close-ended mark the scheme is unlisted; with the analyst's listed flag it is listed.
    assert.equal(run([lots[2]!]).g[0]!.ruleId, 'NE-ST-3');
    assert.equal(run([lots[2]!], { scheme: [{ scheme: FMP.scheme, closeEnded: true, listed: true }] }).g[0]!.ruleId, 'NE-LT-4L');
  });
  test('ELSS: after the lock-in the EQ-LT row; inside it elss-early-sale, the rate row kept', () => {
    const ELSS = { scheme: 'Sample ELSS Tax Saver Fund - Regular Plan - Growth', asset: 'Equity', category: 'ELSS' };
    const { g, res } = run([L(ELSS, [2020, 1, 2], [2024, 1, 3]), L(ELSS, [2022, 3, 1], [2024, 1, 3])]);
    assert.deepEqual([g[0]!.ruleId, g[0]!.subType, g[0]!.flags.includes('elss-early-sale')], ['EQ-LT-3', 'elss', false]);
    assert.deepEqual([g[1]!.ruleId, g[1]!.flags.includes('elss-early-sale')], ['EQ-LT-3', true]);
    assert.deepEqual([issue(res, 'elss-early-sale')!.severity, issue(res, 'elss-early-sale')!.count], ['Warning', 1]);
  });
});

describe('the 31 Jan 2018 value only under its rules; the cost inputs (§5, TR-11)', () => {
  test('grandfathered short term ignores the value; standard pre-2018 long term on actual cost; Mar 2000 purchase the dash', () => {
    const { g, res } = run([
      L(EQ, [2018, 1, 10], [2018, 12, 3], { over: { acqDate: [2018, 1, 31], acqPrice: 104 } }),
      L(EQ, [2017, 6, 1], [2019, 6, 3]),
      L(EQ, [2000, 3, 1], [2019, 6, 3]),
      L(EQ, [2016, 6, 1], [2018, 3, 1], { over: { acqDate: [2018, 1, 31], acqPrice: 104 } }),
    ]);
    assert.deepEqual([g[0]!.lotClass, g[0]!.ruleId, g[0]!.costBasis], ['grandfathered', 'EQ-ST-2', 'actual']);
    near(v(g[0]!.costForTax), 10000, 'actual cost, the value ignored');
    assert.ok(g[0]!.flags.includes('grandfathered-value-ignored'));
    assert.deepEqual([g[1]!.lotClass, g[1]!.ruleId, g[1]!.costBasis], ['standard', 'EQ-LT-2', 'actual']);
    assert.ok(g[1]!.flags.includes('grandfathering-value-not-supplied'));
    assert.ok(g[1]!.labels.includes('31 Jan 2018 value not supplied; actual cost used; gain may be overstated'));
    assert.deepEqual([g[2]!.ruleId, g[2]!.notComputed, v(g[2]!.taxableGain)], ['EQ-LT-2', 'cost-input-missing', null]);
    assert.deepEqual([g[3]!.ruleId, g[3]!.exempt], ['EQ-LT-1', true]);
    assert.ok(g[3]!.flags.includes('grandfathered-value-ignored'));
    for (const [id, sev, n] of [['grandfathered-value-ignored', 'Information', 2], ['grandfathering-value-not-supplied', 'Information', 1], ['cost-input-missing', 'Warning', 1]] as const) {
      assert.deepEqual([issue(res, id)!.severity, issue(res, id)!.count], [sev, n], id);
    }
  });
  test('the gift or inheritance mark and the first-held-before-2001 mark give the dash on a grandfathered rule only', () => {
    const lots = [L(EQ, [2017, 6, 1], [2019, 6, 3]), L(EQ, [2019, 6, 3], [2021, 6, 3]), L(EQ, [2017, 6, 1], [2019, 6, 3], { over: { acqDate: [2018, 1, 31], acqPrice: 104 } })];
    const { g, res } = run(lots, { lotMarks: [{ lotIndex: 0, giftOrInheritance: true }, { lotIndex: 1, giftOrInheritance: true }, { lotIndex: 2, firstHeldBefore2001: true }] });
    assert.equal(g[0]!.notComputed, 'cost-input-missing');
    assert.deepEqual([g[1]!.ruleId, g[1]!.notComputed], ['EQ-LT-3', null]);
    assert.equal(g[2]!.notComputed, 'cost-input-missing');
    assert.ok(res.audit.filter((a) => /gift/.test(a.summary)).length >= 2);
  });
});

describe('non-equity dates, indexation and the cost basis (§10.1, §10.3, TR-3)', () => {
  test('10 and 11 Jul 2014; NE-LT-2 in FY 2015-16 and FY 2016-17; 1 Apr 2017; first held before the base year; an ignored indexed cost', () => {
    const { g, res } = run([
      L(DEBT, [2012, 1, 2], [2014, 7, 10]),
      L(DEBT, [2012, 1, 2], [2014, 7, 11]),
      L(DEBT, [2010, 4, 1], [2015, 6, 1]),
      L(DEBT, [2010, 4, 1], [2016, 6, 1]),
      L(DEBT, [2010, 4, 1], [2017, 4, 1]),
      L(DEBT, [1999, 6, 1], [2018, 6, 1]),
      L(DEBT, [2022, 1, 3], [2023, 6, 1], { over: { acqPrice: 104 } }),
    ]);
    assert.deepEqual(g.map((x) => x.ruleId), ['NE-LT-1', 'NE-ST-2', 'NE-LT-2', 'NE-LT-2', 'NE-LT-3', 'NE-LT-3', 'NE-ST-2']);
    // NE-LT-2 FY 2015-16: 10,000 x 1081 / 711 (1981 series).
    near(v(g[2]!.costForTax), (10000 * 1081) / 711, 'NE-LT-2 indexed cost');
    assert.deepEqual([g[3]!.notComputed, v(g[3]!.taxableGain)], ['rule-to-be-confirmed', null]);
    // NE-LT-3 from 1 Apr 2017, 2001 series: 10,000 x 272 / 167.
    near(v(g[4]!.costForTax), (10000 * 272) / 167, 'NE-LT-3 indexed cost');
    near(v(g[5]!.costForTax), (10000 * 280) / 100, 'the FY 2001-02 floor');
    assert.ok(g[5]!.flags.includes('pre-base-year-cost'));
    assert.deepEqual([g[6]!.lotClass, g[6]!.costBasis], ['indexed-cost-shown', 'actual']);
    assert.ok(g[6]!.flags.includes('indexed-cost-ignored'));
    for (const [id, sev, n] of [['pre-base-year-cost', 'Information', 1], ['indexed-cost-ignored', 'Information', 1], ['old-law-choice', 'Information', 1], ['rule-to-be-confirmed', 'Warning', 1]] as const) {
      assert.deepEqual([issue(res, id)!.severity, issue(res, id)!.count], [sev, n], id);
    }
  });
  test('an NE-LT-1 lot with an indexed loss takes the 20% leg (KA-20 lot B)', () => {
    const { g } = run([L(DEBT, [2005, 8, 1], [2012, 9, 3], { units: 1000, buyNav: 10, sellNav: 9 })]);
    assert.equal(g[0]!.legs!.chosen, 'indexed20');
    near(g[0]!.legs!.indexed20.tax, -1628.57, '20% leg');
    near(g[0]!.legs!.actual10.tax, -100, '10% leg');
    near(v(g[0]!.taxableGain), -8142.86, 'the indexed loss to set-off');
  });
});

describe('dates, the statement split and the other engine ids (§9.2, §10.4, §11)', () => {
  test('a same-day lot: short term, 0 holding days, no row check fails', () => {
    const { g, imp } = run([L(EQ, [2024, 3, 4], [2024, 3, 4])]);
    assert.deepEqual([imp.lots[0]!.failedChecks, g[0]!.ruleId, v(g[0]!.term)], [[], 'EQ-ST-2', 'short']);
  });
  test('outside-rule-table, after-as-on-date, stripping candidates, assessee marks, gain-differs, term-differs', () => {
    const IDCW = { scheme: 'Sample Corporate Bond Fund - Regular Plan - IDCW', asset: 'Debt', category: 'Corporate Bond Funds' };
    const BON = scheme('Bonus Fund');
    const { g, res } = run([
      L(EQ, [2003, 5, 2], [2004, 9, 30]),
      L(EQ, [2024, 3, 4], [2026, 10, 15]),
      L(IDCW, [2019, 6, 3], [2020, 1, 6], { sellNav: 95 }),
      L(BON, [2021, 6, 1], [2021, 12, 1], { sellNav: 90 }),
      L(BON, [2021, 6, 1], [2023, 1, 2], { buyNav: 0 }),
      L(EQ, [2021, 1, 4], [2023, 1, 5], { over: { ltcg: 1500 } }),
      L(EQ, [2021, 1, 4], [2023, 1, 5], { client: 'Sample Client B', over: { ltcg: 0, stcg: 1000 } }),
    ], { lotMarks: [{ lotIndex: 5, assessee: 'joint' }], personYear: [{ clientId: 'cl_review_b' as never, fy: 2022, slabPct: null, surchargePct: null, regime: null, assesseeMark: 'minor' }] });
    assert.deepEqual([g[0]!.notComputed, v(g[0]!.taxableGain)], ['outside-rule-table', null]);
    assert.ok(g[0]!.flags.includes('outside-rule-table'));
    assert.ok(g[1]!.flags.includes('after-as-on-date'));
    assert.ok(g[2]!.flags.includes('stripping-candidate'), 'an IDCW loss held under 12 months, sold by 2020-12-31');
    assert.ok(g[3]!.flags.includes('stripping-candidate'), 'a loss of a scheme with bonus units');
    assert.ok(!g[4]!.flags.includes('stripping-candidate'));
    assert.ok(g[5]!.flags.includes('assessee-flagged') && g[6]!.flags.includes('assessee-flagged'));
    assert.ok(g[5]!.flags.includes('gain-differs'), 'stated LTCG 1,500 against 1,000');
    assert.ok(g[6]!.flags.includes('term-differs') && !g[6]!.flags.includes('gain-differs'));
    for (const [id, n] of [['outside-rule-table', 1], ['after-as-on-date', 1], ['stripping-candidate', 2], ['assessee-flagged', 2], ['gain-differs', 1], ['term-differs', 1]] as const) {
      assert.deepEqual([issue(res, id)!.severity, issue(res, id)!.count], ['Warning', n], id);
    }
    near(v(g[2]!.taxableGain), -500, 'computed normally');
  });
  test('lots excluded as repeats are carried, flagged, and left out of the counts', () => {
    const lot = L(EQ, [2024, 9, 17], [2025, 9, 18], { folio: '91509999' });
    const imp0 = parseLots([lot, lot]);
    const once = { byEvent: { [imp0.lots[0]!.eventId]: 'once' as const } };
    const { g, res } = run([lot, lot], {}, { repeatAnswers: once });
    assert.deepEqual(g.map((x) => x.excludedAsRepeat), [false, true]);
    assert.equal(g[1]!.ruleId, 'EQ-LT-7');
    assert.equal(issue(res, 'anniversary-sale')!.count, 1);
    assert.equal(issue(res, 'lot-classes')!.count, 1);
  });
});

describe('§11: every engine-side id S2 owns is raised with its severity; messages are plain', () => {
  test('coverage over this file', () => {
    for (const [id, sev] of Object.entries(S2_ISSUE_SEVERITY)) {
      const hits = RAISED.filter((i) => i.ruleId === `capital-gains.${id}`);
      assert.ok(hits.length > 0, `${id} raised at least once`);
      assert.ok(hits.every((i) => i.severity === sev && i.decision === 'D-036' && (i.count ?? 0) > 0), `${id} severity ${sev}`);
    }
  });
  test('no en or em dash, no folio and no rupee amount in any message', () => {
    for (const i of RAISED) {
      assert.ok(![8211, 8212].some((c) => i.message.includes(String.fromCharCode(c))), i.message);
      assert.ok(!/9150\d{4}|Rs\s?\d/.test(i.message), i.message);
    }
  });
});
