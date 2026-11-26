// covers: E-155 E-153 E-141 (statement lots per person and financial year: buckets, set-off, exemption, tax, surcharge, cess, alternatives; design capital-gains-upload.md §9.3 steps 2 to 8, §10.2, §10.6, §10.7)
// The person-year roll-up (app/src/engine/tax/rollup.ts) end to end: each statement is written by the cg-statement
// generator's row writer, read back by the workbook reader and parseCapitalGains, realised (realised.ts) and rolled up.
// The known answers come from the `rollup` section of tests/fixtures/cg-known-answers.json (design §13.4 KA-9 to
// KA-13, KA-15, KA-18 to KA-22, copied by hand from the design text, never from the engine), compared to Rs 0.01 on
// unrounded values (LD-42). The rest is the §14 list for tests/unit/tax/rollup.test.ts: long-term losses before
// short-term, the exemption ranking and its tie, the FY 2024-25 note, the slab dash, before surcharge, the regime, the
// caps, cess by year, the anniversary alternative, an unmatched client as its own person, PAN persons (S2b) as separate
// persons, the PD-07 slab default both ways, INSUFFICIENT EVIDENCE, and the ids this file is assigned.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyTaxInputs } from '../../../app/src/engine/tax/realised.ts';
import { NO_PERSON, SLAB_DEFAULT_PCT, rollupPersonYears } from '../../../app/src/engine/tax/rollup.ts';
import type { RollupOptions } from '../../../app/src/engine/tax/rollup.ts';
import { TAX_RULES_V1 } from '../../../app/src/engine/tax/rules.ts';
import { S3_ISSUE_IDS } from '../../../app/src/engine/tax/types.ts';
import type { EstimateLocal, FamilyTaxYearLocal, PersonYearTaxLocal, RealiseResult, RollupResult, TaxIssue, TaxLot } from '../../../app/src/engine/tax/types.ts';
import type { TaxInputs } from '../../../app/src/model/tax.ts';
import type { AuditEntry } from '../../../app/src/model/audit.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { hasPanShape } from '../../../app/src/ingest/capital-gains.ts';
import type { CgImport } from '../../../app/src/ingest/capital-gains.ts';
import { CLIENT_IDS, parseLots, personYearInputs, realiseAndRoll } from '../../fixtures/make-cg-tax-lots.ts';
import type { KaLot, KaPersonYear } from '../../fixtures/make-cg-tax-lots.ts';
import { accountWithPan, CLIENT_A, CLIENT_B } from '../../fixtures/make-cg-statements.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const KA = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/cg-known-answers.json'), 'utf8'));
const TOL = KA.tolerance as number;

/** Every issue raised in this file (lot engine and roll-up), for the assigned-ids check at the end. */
const RAISED: TaxIssue[] = [];
/** Every roll-up audit entry written in this file (no PAN may appear in one). */
const AUDITS: AuditEntry[] = [];

type Run = { imp: CgImport; res: RealiseResult; roll: RollupResult; g: TaxLot[] };

function run(lots: readonly KaLot[], personYear: readonly KaPersonYear[] = [], o: {
  inputs?: Partial<TaxInputs>; rollup?: RollupOptions; extra?: Parameters<typeof parseLots>[1]; rollupFy?: number;
} = {}): Run {
  const imp = parseLots(lots, o.extra ?? {});
  const inputs: TaxInputs = { ...emptyTaxInputs(), ...o.inputs, personYear: personYearInputs(personYear) };
  if (o.rollupFy === undefined) {
    const { res, roll } = realiseAndRoll(imp, inputs, { rollup: o.rollup });
    RAISED.push(...res.issues, ...roll.issues);
    AUDITS.push(...roll.audit);
    return { imp, res, roll, g: res.gains };
  }
  // KA-19: the lots given to the roll-up as one person-year (the realised lots re-dated in the roll-up input only).
  const { res } = realiseAndRoll(imp, inputs, { rollup: o.rollup });
  const label = res.gains.find((g) => g.financialYear === o.rollupFy)!.financialYearLabel;
  const gains = res.gains.map((g) => ({ ...g, financialYear: o.rollupFy!, financialYearLabel: label }));
  const roll = rollupPersonYears(gains, imp, inputs, { now: () => '2026-11-26T00:00:00.000Z', ...o.rollup });
  RAISED.push(...res.issues, ...roll.issues);
  AUDITS.push(...roll.audit);
  return { imp, res, roll, g: gains };
}

const v = (x: { kind: 'value'; v: number } | { kind: 'missing' } | null | undefined): number | null => (x && x.kind === 'value' ? x.v : null);
function near(actual: number | null, expected: number | null, what: string): void {
  if (expected === null) { assert.equal(actual, null, `${what}: expected missing, got ${actual}`); return; }
  assert.ok(actual !== null, `${what}: expected ${expected}, got missing`);
  assert.ok(Math.abs(actual - expected) <= TOL, `${what}: expected ${expected}, got ${actual}`);
}
const year = (r: RollupResult, fy: number): FamilyTaxYearLocal => {
  const y = r.years.find((x) => x.fy === fy);
  assert.ok(y, `no year ${fy}`);
  return y!;
};
/** The person-year of a review client (by label) or of a person key. */
function py(r: RollupResult, fy: number, who: string): PersonYearTaxLocal {
  const y = year(r, fy);
  const id = CLIENT_IDS[who];
  const p = y.persons.find((x) => (id !== undefined ? x.clientId === id : x.personKey === who));
  assert.ok(p, `no person-year ${who} ${fy}`);
  return p!;
}

function checkEstimate(e: EstimateLocal, x: Record<string, unknown>, w: string): void {
  for (const k of ['tax', 'surcharge', 'cess', 'total'] as const) if (k in x) near(v(e[k]), x[k] as number | null, `${w} ${k}`);
}

function checkPersonYear(p: PersonYearTaxLocal, x: Record<string, unknown>, w: string): void {
  checkEstimate(p.estimate, x, w);
  for (const [k, want] of Object.entries(x)) {
    switch (k) {
      case 'client': case 'fy': case 'tax': case 'surcharge': case 'cess': case 'total': break;
      case 'totalUnrounded': assert.ok(Math.abs(v(p.estimate.total)! - (want as number)) < 0.0001, `${w} total unrounded ${v(p.estimate.total)}`); break;
      case 'partial': assert.equal(p.coverage.partial, want, `${w} partial`); break;
      case 'lotsNotComputed': assert.equal(p.coverage.lotsNotComputed, want, `${w} lots not computed`); break;
      case 'economicGainNotComputed': near(p.coverage.economicGainNotComputed, want as number, `${w} economic gain not computed`); break;
      case 'exemptionApplied': near(p.exemption.applied, want as number, `${w} exemption applied`); break;
      case 'beforeSurcharge': assert.equal(p.estimate.beforeSurcharge, want, `${w} before surcharge`); break;
      case 'afterSetOffDash': assert.equal(p.afterSetOffDash, want, `${w} after set-off dash`); break;
      case 'slabTaxableLeftOut': near(p.slabTaxableLeftOut, want as number, `${w} slab left out`); break;
      case 'realised': near(p.realised, want as number, `${w} realised`); break;
      case 'nonTaxable': near(p.nonTaxable, want as number, `${w} non-taxable`); break;
      case 'unabsorbed': {
        const u = want as { st: number; lt: number };
        near(p.unabsorbed.st, u.st, `${w} unabsorbed st`);
        near(p.unabsorbed.lt, u.lt, `${w} unabsorbed lt`);
        break;
      }
      case 'labels': for (const l of want as string[]) assert.ok(p.labels.includes(l), `${w} label ${l}`); break;
      case 'buckets':
        for (const b of want as Array<Record<string, unknown>>) {
          const got = p.buckets.find((x) => x.ruleId === b.ruleId);
          assert.ok(got, `${w} bucket ${b.ruleId}`);
          for (const [f, z] of Object.entries(b)) {
            if (f === 'ruleId') continue;
            if (f === 'rate') assert.equal(got!.rate, z, `${w} bucket ${b.ruleId} rate`);
            else near((got as unknown as Record<string, number | null>)[f]!, z as number, `${w} bucket ${b.ruleId} ${f}`);
          }
        }
        break;
      case 'alternatives':
        for (const [a, z] of Object.entries(want as Record<string, Record<string, unknown>>)) {
          const contract = p.alternatives[a as keyof PersonYearTaxLocal['alternatives']];
          if ('tax' in z) near(v(contract), z.tax as number, `${w} alternative ${a} (contract)`);
          const detail = p.alternativesDetail[a as 'anniversaryLongTerm'] as (EstimateLocal & { leg?: string }) | null;
          assert.ok(detail, `${w} alternative ${a}`);
          checkEstimate(detail!, z, `${w} alternative ${a}`);
          if ('leg' in z) assert.equal(detail!.leg, z.leg, `${w} alternative ${a} leg`);
        }
        break;
      case 'oldLawLegs': {
        const legs = want as { indexed20: number; actual10: number };
        assert.ok(p.alternativesDetail.oldLawLegs, `${w} old-law legs`);
        near(v(p.alternativesDetail.oldLawLegs!.indexed20.tax), legs.indexed20, `${w} every NE-LT-1 lot on the 20% leg`);
        near(v(p.alternativesDetail.oldLawLegs!.actual10.tax), legs.actual10, `${w} every NE-LT-1 lot on the 10% leg`);
        break;
      }
      default: throw new Error(`${w}: unknown expectation ${k}`);
    }
  }
}

function checkLots(g: readonly TaxLot[], want: Array<Record<string, unknown>>, w: string): void {
  for (const e of want) {
    const lot = g[e.lot as number]!;
    for (const [k, x] of Object.entries(e)) {
      if (k === 'lot') continue;
      if (k === 'ruleId') assert.equal(lot.ruleId, x, `${w} lot ${e.lot} rule`);
      else if (k === 'taxableGain' || k === 'costForTax' || k === 'realised') near(v(lot[k]), x as number | null, `${w} lot ${e.lot} ${k}`);
      else if (k === 'flags') for (const f of x as string[]) assert.ok(lot.flags.includes(f), `${w} lot ${e.lot} flag ${f}`);
      else if (k === 'legs') {
        const le = x as Record<string, unknown>;
        assert.equal(lot.legDetail?.chosen, le.chosen, `${w} lot ${e.lot} chosen leg`);
        for (const leg of ['indexed20', 'actual10'] as const) {
          const z = le[leg] as Record<string, number> | undefined;
          if (z) for (const f of Object.keys(z)) near(lot.legDetail![leg][f as 'gain'], z[f]!, `${w} lot ${e.lot} ${leg}.${f}`);
        }
      } else throw new Error(`${w}: unknown lot expectation ${k}`);
    }
  }
}

type KaCase = {
  id: string; ref: string; lots: KaLot[]; inputs: Partial<TaxInputs>; personYear: KaPersonYear[]; rollupFy?: number;
  expect: { lots?: Array<Record<string, unknown>>; personYears?: Array<Record<string, unknown>>; family?: Record<string, unknown>; realisedAllYears?: number };
  variants?: Array<{ id: string; lots?: KaLot[]; lotsOver?: Array<Partial<KaLot> | null>; personYear?: KaPersonYear[]; expect: KaCase['expect'] }>;
};

function checkCase(id: string, r: Run, e: KaCase['expect']): void {
  if (e.lots) checkLots(r.g, e.lots, id);
  for (const p of e.personYears ?? []) checkPersonYear(py(r.roll, p.fy as number, p.client as string), p, `${id} ${p.client} FY ${p.fy}`);
  if (e.family) {
    const y = year(r.roll, e.family.fy as number);
    assert.equal(y.familyPersons.length, e.family.persons, `${id} family persons`);
    checkEstimate(y.familySum.estimate as EstimateLocal, e.family, `${id} family`);
    assert.equal(y.familySum.coverage.partial, e.family.partial, `${id} family partial`);
    assert.equal(y.familySum.label, 'sum of separate computations');
    assert.ok(!('exemption' in y.familySum), `${id} the family sum has no exemption`);
  }
  if (e.realisedAllYears !== undefined) near(r.roll.years.reduce((s, y) => s + y.familySum.realised, 0), e.realisedAllYears, `${id} realised over all years`);
}

describe('the person-year known answers (cg-known-answers.json rollup: KA-9 to KA-13, KA-15, KA-18 to KA-22)', () => {
  const cases = KA.rollup as KaCase[];
  test('the file holds every roll-up known answer of §14', () => {
    assert.deepEqual(cases.map((c) => c.id), ['KA-9', 'KA-10', 'KA-11', 'KA-12', 'KA-13', 'KA-15', 'KA-18', 'KA-19', 'KA-20', 'KA-21', 'KA-22']);
    for (const c of cases) assert.match(c.ref, /^capital-gains-upload\.md:\d+-\d+$/, c.id);
  });
  for (const c of cases) {
    test(`${c.id} (${c.ref})`, () => {
      checkCase(c.id, run(c.lots, c.personYear, { inputs: c.inputs, rollupFy: c.rollupFy }), c.expect);
    });
    for (const vr of c.variants ?? []) {
      test(`${vr.id} (${c.ref})`, () => {
        const lots = vr.lots ?? c.lots.map((l, i) => ({ ...l, ...(vr.lotsOver?.[i] ?? {}) }));
        checkCase(vr.id, run(lots, vr.personYear ?? c.personYear, { inputs: c.inputs, rollupFy: c.rollupFy }), vr.expect);
      });
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// The §14 list

const ka = (id: string): KaCase => (KA.rollup as KaCase[]).find((c) => c.id === id)!;
const A_ = (fy: number, x: Partial<KaPersonYear> = {}): KaPersonYear => ({ client: CLIENT_A, fy, slabPct: null, surchargePct: 0, regime: null, ...x });
const EQ = { scheme: 'Sample Large Cap Fund - Regular Plan - Growth', asset: 'Equity', category: 'Large Cap Funds' } as const;
const DEBT = { scheme: 'Sample Corporate Bond Fund - Regular Plan - Growth', asset: 'Debt', category: 'Corporate Bond Funds' } as const;
const SPEC = { scheme: 'Sample Short Duration Fund - Regular Plan - Growth', asset: 'Debt', category: 'Short Duration Funds' } as const;

describe('set-off (§9.3 step 3, TR-10)', () => {
  test('long-term losses are set off before short-term losses (KA-18): the 20% gain takes the long-term loss', () => {
    const c = ka('KA-18');
    const p = py(run(c.lots, c.personYear).roll, 2023, CLIENT_A);
    const b = (id: string) => p.buckets.find((x) => x.ruleId === id)!;
    near(b('NE-LT-3').setOff, 50000, 'NE-LT-3 set off');
    near(b('EQ-ST-2').setOff, 50000, 'EQ-ST-2 set off');
    near(b('EQ-ST-2').loss, 50000, 'the short-term loss in its pool');
    near(b('EQ-LT-3').loss, 50000, 'the long-term loss in its pool');
    assert.deepEqual(p.unabsorbed, { st: 0, lt: 0 });
  });
  test('a long-term loss never reaches a short-term gain; left over, it is reported by term, not carried', () => {
    const r = run([
      { ...EQ, buy: [2021, 6, 1], sell: [2025, 6, 2], units: 100, buyNav: 200, sellNav: 100 },
      { ...EQ, scheme: 'Sample Mid Cap Fund - Regular Plan - Growth', buy: [2025, 1, 2], sell: [2025, 6, 2], units: 100, buyNav: 100, sellNav: 150 },
    ], [A_(2025)]);
    const p = py(r.roll, 2025, CLIENT_A);
    near(p.unabsorbed.lt, 10000, 'long-term loss left');
    near(p.unabsorbed.st, 0, 'no short-term loss left');
    near(v(p.estimate.tax), 5000 * 0.2, 'the short-term gain fully taxed at 20%');
  });
  test('the exemption ranking: s.112A gains inside the unused exemption rank at 0% and come last (KA-13)', () => {
    const c = ka('KA-13');
    const p = py(run(c.lots, c.personYear).roll, 2024, CLIENT_A);
    near(p.buckets.find((b) => b.ruleId === 'EQ-LT-7')!.setOff, 0, 'the equity gain inside the exemption untouched');
    near(p.exemption.applied, 100000, 'the exemption covers the equity gain');
    near(v(p.estimate.tax), 0, 'tax');
  });
  test('the tie: at equal rates the loss goes to the non-exempt gain first (12.5% s.112A above the exemption against 12.5% NE-LT-4)', () => {
    const r = run([
      { ...EQ, buy: [2022, 6, 1], sell: [2025, 9, 2], units: 1000, buyNav: 100, sellNav: 400 },
      { ...DEBT, buy: [2021, 6, 1], sell: [2025, 9, 2], units: 5000, buyNav: 10, sellNav: 20 },
      { ...EQ, scheme: 'Sample Mid Cap Fund - Regular Plan - Growth', buy: [2022, 6, 1], sell: [2025, 9, 2], units: 500, buyNav: 200, sellNav: 100 },
    ], [A_(2025)]);
    const p = py(r.roll, 2025, CLIENT_A);
    near(p.buckets.find((b) => b.ruleId === 'NE-LT-4')!.setOff, 50000, 'the non-exempt gain takes the loss');
    near(p.buckets.find((b) => b.ruleId === 'EQ-LT-7')!.setOff, 0, 'the s.112A gain keeps its gain');
    near(v(p.estimate.tax), (300000 - 125000) * 0.125, 'tax');
  });
  test('EQ-LT-1 losses are ignored (the exempt line): KA-14 lots 1 and 2', () => {
    const r = run([
      { ...EQ, buy: [2017, 1, 2], sell: [2018, 3, 15], units: 1000, buyNav: 30, sellNav: 36 },
      { ...EQ, buy: [2017, 1, 2], sell: [2018, 3, 15], units: 1000, buyNav: 30, sellNav: 25 },
      { ...EQ, scheme: 'Sample Mid Cap Fund - Regular Plan - Growth', buy: [2017, 10, 2], sell: [2018, 3, 15], units: 100, buyNav: 100, sellNav: 110 },
    ], [A_(2017)]);
    const p = py(r.roll, 2017, CLIENT_A);
    near(p.exempt, 1000, 'the exempt line, signed');
    near(p.exemptLossIgnored, 5000, 'the exempt loss ignored');
    near(v(p.estimate.tax), 1000 * 0.15, 'the short-term gain keeps its tax');
    assert.equal(p.buckets.some((b) => b.ruleId === 'EQ-LT-1'), false);
    assert.equal(p.exemption.limit.kind, 'missing');
    assert.equal(p.exemption.limit.kind === 'missing' && p.exemption.limit.status, STATUS.NOT_APPLICABLE);
  });
});

describe('the exemption and the slab rate (§9.3 steps 2, 4 and 5)', () => {
  test('FY 2024-25: the 12.5% gains first, the other order in a note, both labelled "order not set by the Act" (KA-9)', () => {
    const c = ka('KA-9');
    const p = py(run(c.lots, c.personYear).roll, 2024, CLIENT_A);
    const b = (id: string) => p.buckets.find((x) => x.ruleId === id)!;
    near(b('EQ-LT-7').exemption, 90000, 'the 12.5% gains first');
    near(b('EQ-LT-5').exemption, 35000, 'the rest to the 10% gains');
    assert.equal(b('EQ-LT-7').rate, 12.5);
    assert.equal(b('EQ-LT-5').rate, 10);
    assert.ok(p.labels.includes('order not set by the Act'));
    near(v(p.alternatives.fy2425OtherOrder), 5625, 'other order');
  });
  test('the other order is not shown outside FY 2024-25, nor with gains at one rate only', () => {
    const c = ka('KA-10');
    assert.equal(py(run(c.lots, c.personYear).roll, 2025, CLIENT_A).alternatives.fy2425OtherOrder, null);
    const one = run([ka('KA-9').lots[1]!], [A_(2024)]);
    assert.equal(py(one.roll, 2024, CLIENT_A).alternatives.fy2425OtherOrder, null);
  });
  test('slab rate not set with a short-term loss meeting slab gains: the dash (KA-12)', () => {
    const c = ka('KA-12');
    const p = py(run(c.lots, [A_(2023)]).roll, 2023, CLIENT_A);
    assert.equal(p.afterSetOffDash, 'slab rate not set');
    for (const k of ['tax', 'surcharge', 'cess', 'total'] as const) {
      assert.equal(p.estimate[k].kind, 'missing', k);
      assert.equal(p.estimate[k].kind === 'missing' && p.estimate[k].reason, 'slab rate not set');
    }
    assert.ok(p.labels.includes('slab rate not set'));
  });
  test('slab rate not set without a loss: the slab bucket left out, the total PARTIAL (KA-21 b)', () => {
    const vr = ka('KA-21').variants![0]!;
    const p = py(run(vr.lots!, vr.personYear!).roll, 2025, CLIENT_A);
    assert.equal(p.coverage.partial, true);
    assert.ok(p.estimate.tax.kind === 'value' && (p.estimate.tax.coverage ?? 1) < 1, 'the tax carries coverage below 1');
    assert.equal(p.buckets.find((b) => b.ruleId === 'NE-50AA-2')!.tax, null);
  });
  test('PD-07: slabDefaultPct null (the named default) leaves the slab unset; 30 applies it, with an audit entry', () => {
    assert.equal(SLAB_DEFAULT_PCT, null);
    const vr = ka('KA-21').variants![0]!;
    const unset = run(vr.lots!, vr.personYear!);
    assert.equal(py(unset.roll, 2025, CLIENT_A).slab.source, 'not set');
    const set = run(vr.lots!, vr.personYear!, { rollup: { slabDefaultPct: 30 } });
    const p = py(set.roll, 2025, CLIENT_A);
    assert.deepEqual(p.slab, { pct: 30, source: 'default' });
    near(v(p.estimate.tax), 3125 + 4800, 'tax with the default slab');
    assert.equal(p.coverage.partial, false);
    assert.ok(set.roll.audit.some((a) => a.summary.includes('PD-07')));
    // An analyst's entry wins over the default.
    const entered = run(vr.lots!, [A_(2025, { slabPct: 10 })], { rollup: { slabDefaultPct: 30 } });
    assert.deepEqual(py(entered.roll, 2025, CLIENT_A).slab, { pct: 10, source: 'analyst' });
    near(v(py(entered.roll, 2025, CLIENT_A).estimate.tax), 3125 + 1600, 'tax at the entered slab');
  });
});

describe('surcharge and cess (§9.3 step 6, §10.7, TR-12)', () => {
  const lots = ka('KA-11').lots;
  test('surcharge not entered: every total before surcharge (rate not set), cess on tax alone', () => {
    const p = py(run(lots, [A_(2025, { slabPct: 30, surchargePct: null })]).roll, 2025, CLIENT_A);
    assert.equal(p.estimate.beforeSurcharge, true);
    assert.equal(p.estimate.surchargeLabel, 'before surcharge (rate not set)');
    assert.equal(p.estimate.surcharge.kind, 'missing');
    near(v(p.estimate.cess), 7925 * 0.04, 'cess on tax alone');
    near(v(p.estimate.total), 7925 * 1.04, 'total before surcharge');
  });
  test('from FY 2023-24, regime not entered and an entry above 25%: the entry held, before surcharge (regime not set)', () => {
    const r = run(lots, [A_(2025, { slabPct: 30, surchargePct: 37 })]);
    const p = py(r.roll, 2025, CLIENT_A);
    assert.equal(p.estimate.surchargeLabel, 'before surcharge (regime not set)');
    assert.equal(p.surchargeApplied, null);
    assert.ok(r.roll.audit.some((a) => a.detail.surchargeHeld === true));
  });
  test('the old regime applies 37% to slab gains and caps capped categories at 15%', () => {
    const p = py(run(lots, [A_(2025, { slabPct: 30, surchargePct: 37, regime: 'old' })]).roll, 2025, CLIENT_A);
    assert.equal(p.surchargeApplied, 37);
    near(v(p.estimate.surcharge), 3125 * 0.15 + 4800 * 0.37, 'surcharge');
  });
  test('a new-regime entry is limited to 25%', () => {
    const r = run(lots, [A_(2025, { slabPct: 30, surchargePct: 37, regime: 'new' })]);
    const p = py(r.roll, 2025, CLIENT_A);
    assert.equal(p.surchargeApplied, 25);
    near(v(p.estimate.surcharge), 1668.75, 'surcharge as KA-11');
    assert.ok(p.labels.includes("the surcharge entry is limited to the year's maximum"));
    assert.ok(r.roll.audit.some((a) => a.detail.surchargeLimited === true));
  });
  test('the maximum by year: before FY 2023-24 the regime plays no part; a nil year asks nothing', () => {
    const fy19 = run([{ ...DEBT, buy: [2015, 6, 1], sell: [2019, 8, 1], units: 1000, buyNav: 10, sellNav: 15 }], [A_(2019, { surchargePct: 37 })]);
    const p19 = py(fy19.roll, 2019, CLIENT_A);
    assert.equal(p19.surchargeApplied, 37, 'FY 2019-20: 37% allowed');
    // s.112 gains are not capped before FY 2022-23.
    near(v(p19.estimate.surcharge)!, v(p19.estimate.tax)! * 0.37, 's.112 uncapped in FY 2019-20');
    const fy22 = run([{ ...DEBT, buy: [2018, 6, 1], sell: [2022, 8, 1], units: 1000, buyNav: 10, sellNav: 15 }], [A_(2022, { surchargePct: 37 })]);
    const p22 = py(fy22.roll, 2022, CLIENT_A);
    near(v(p22.estimate.surcharge)!, v(p22.estimate.tax)! * 0.15, 's.112 capped at 15% from FY 2022-23');
    const fy16 = run([{ ...EQ, buy: [2016, 1, 4], sell: [2016, 6, 1], units: 100, buyNav: 100, sellNav: 120 }], [A_(2016, { surchargePct: 25 })]);
    assert.equal(py(fy16.roll, 2016, CLIENT_A).surchargeApplied, 15, 'FY 2016-17: limited to 15%');
    const nil = run([{ ...EQ, buy: [2012, 1, 4], sell: [2012, 6, 1], units: 100, buyNav: 100, sellNav: 120 }], [A_(2012, { surchargePct: null })]);
    const pn = py(nil.roll, 2012, CLIENT_A);
    assert.equal(pn.estimate.beforeSurcharge, false, 'a nil year is never before surcharge');
    near(v(pn.estimate.surcharge), 0, 'surcharge 0 in a nil year');
  });
  test('cess by year: 2% (FY 2005-06), 3% (FY 2012-13), 4% (FY 2022-23)', () => {
    const c2 = py(run([{ ...EQ, buy: [2005, 5, 2], sell: [2005, 12, 1], units: 1000, buyNav: 20, sellNav: 25 }], [A_(2005)]).roll, 2005, CLIENT_A);
    near(v(c2.estimate.tax), 500, 'KA-14 tax');
    near(v(c2.estimate.cess), 10, 'KA-14 cess 2%');
    near(v(c2.estimate.total), 510, 'KA-14 total');
    const c3 = py(run([{ ...DEBT, buy: [2005, 8, 1], sell: [2012, 9, 3], units: 1000, buyNav: 10, sellNav: 25 }], [A_(2012, { surchargePct: null })]).roll, 2012, CLIENT_A);
    near(v(c3.estimate.cess), 45, 'KA-3a cess 3%');
    near(v(c3.estimate.total), 1545, 'KA-3a total');
    const c4 = py(run([{ ...DEBT, buy: [2018, 6, 11], sell: [2022, 8, 16], units: 1500, buyNav: 20, sellNav: 26, over: { acqPrice: 23.6429, ltcg: 3535.65 } }], [A_(2022)]).roll, 2022, CLIENT_A);
    near(v(c4.estimate.tax), 707.14, 'KA-4 tax');
    near(v(c4.estimate.cess), 28.29, 'KA-4 cess 4%');
  });
});

describe('the alternatives and the statement split (§9.3 steps 7 and 8)', () => {
  test('the anniversary alternative: the tax if the anniversary lots were long term (KA-7 lot 0; KA-5 iii)', () => {
    const r = run([{ ...EQ, buy: [2024, 9, 17], sell: [2025, 9, 17], units: 1000, buyNav: 50, sellNav: 60, over: { ltcg: 10000, stcg: 0 } }], [A_(2025)]);
    const p = py(r.roll, 2025, CLIENT_A);
    near(v(p.estimate.tax), 2000, 'EQ-ST-3 as the app holds it');
    near(v(p.alternatives.anniversaryLongTerm), 0, 'long term, inside the exemption');
    assert.equal(p.statementDiffers.term, 1);
    assert.equal(p.statementSplit.lotsDiffering, 1);
    near(v(p.statementSplit.lt), 10000, "the statement's LTCG beside");
    const s = run([{ ...SPEC, buy: [2023, 3, 31], sell: [2025, 3, 31], units: 1000, buyNav: 100, sellNav: 116 }], [A_(2024, { slabPct: 30 })]);
    const ps = py(s.roll, 2024, CLIENT_A);
    near(v(ps.estimate.tax), 4800, 'NE-ST-3 at slab 30%');
    near(v(ps.alternatives.anniversaryLongTerm), 2000, 'NE-LT-4 12.5% as the alternative');
    assert.ok(s.res.issues.some((i) => i.ruleId === 'capital-gains.anniversary-sale'));
  });
  test('no anniversary lot, no NE-LT-1 lot: the alternatives are null', () => {
    const c = ka('KA-10');
    const p = py(run(c.lots, c.personYear).roll, 2025, CLIENT_A);
    assert.deepEqual(p.alternatives, { anniversaryLongTerm: null, fy2425OtherOrder: null, oldLawYearTotal: null });
  });
  test('NE-LT-1 per lot with the year-total figure beside (KA-19, KA-20, KA-22) and old-law-choice raised', () => {
    const c = ka('KA-20');
    const r = run(c.lots, c.personYear);
    const p = py(r.roll, 2012, CLIENT_A);
    near(v(p.estimate.tax), 685.71, 'per lot');
    near(v(p.alternatives.oldLawYearTotal), 0, "the year's total");
    assert.ok(r.res.issues.some((i) => i.ruleId === 'capital-gains.old-law-choice'));
  });
});

describe('persons (§9.3, TR-15; PD-16 item 3)', () => {
  test('a client not in the review is its own person, outside the family sum; the roll-up part of clients-unmatched', () => {
    const lots: KaLot[] = [
      { ...EQ, buy: [2021, 4, 5], sell: [2025, 8, 11], units: 2000, buyNav: 100, sellNav: 175 },
      { ...EQ, client: 'Other Client Z', buy: [2021, 4, 5], sell: [2025, 8, 11], units: 1000, buyNav: 100, sellNav: 240 },
    ];
    const r = run(lots, [A_(2025)]);
    const y = year(r.roll, 2025);
    assert.equal(y.persons.length, 2);
    const z = y.persons.find((p) => !p.inReview)!;
    assert.equal(z.clientId, null);
    assert.equal(z.personLabel.includes('Other Client Z'), true);
    near(v(z.estimate.tax), 1875, 'computed separately: its own exemption');
    assert.deepEqual(y.familyPersons, [py(r.roll, 2025, CLIENT_A).personKey]);
    near(v(y.familySum.estimate.tax), 3125, 'the family sum leaves the unmatched person out');
    const reader = r.imp.issues.find((i) => i.ruleId === 'capital-gains.clients-unmatched');
    assert.equal(reader?.severity, 'Warning');
    const mine = r.roll.issues.find((i) => i.ruleId === 'capital-gains.clients-unmatched');
    assert.ok(mine, 'the roll-up part is raised beside the reader\'s result');
    assert.equal(mine!.severity, 'Warning');
    assert.equal(mine!.count, 1);
    assert.match(mine!.message, /never added to the family sum/);
  });
  test('a statement of another family: High, every person outside the family sum', () => {
    const r = run([{ ...EQ, client: 'Other Client X', buy: [2021, 4, 5], sell: [2025, 8, 11], units: 10, buyNav: 100, sellNav: 175 }], []);
    const y = year(r.roll, 2025);
    assert.deepEqual(y.familyPersons, []);
    assert.equal(y.familySum.estimate.tax.kind, 'missing');
    assert.equal(r.roll.issues.find((i) => i.ruleId === 'capital-gains.clients-unmatched')?.severity, 'High');
  });
  test('without a review the roll-up raises nothing (the reader raises nothing either)', () => {
    const r = run([{ ...EQ, buy: [2021, 4, 5], sell: [2025, 8, 11], units: 10, buyNav: 100, sellNav: 175 }], [], { extra: { review: undefined } });
    assert.deepEqual(r.roll.issues, []);
    assert.deepEqual(year(r.roll, 2025).familyPersons, []);
  });
  test('a lot with no client label and no PAN is the person "no-person", never in the family sum', () => {
    const r = run([
      { ...EQ, buy: [2021, 4, 5], sell: [2025, 8, 11], units: 10, buyNav: 100, sellNav: 175 },
      { ...EQ, buy: [2021, 4, 5], sell: [2025, 8, 11], units: 20, buyNav: 100, sellNav: 175, over: { client: null, account: null } },
    ], [A_(2025)]);
    const y = year(r.roll, 2025);
    const none = y.persons.find((p) => p.personKey === NO_PERSON);
    assert.ok(none, 'the no-person person');
    assert.equal(none!.inReview, false);
    assert.equal(none!.personLabel, 'no client label');
    assert.equal(y.familyPersons.includes(NO_PERSON), false);
  });
  test('PAN persons (S2b): one PAN under two labels is one person; one label under two PANs is two persons', () => {
    const base = { ...EQ, buy: [2021, 4, 5] as const, sell: [2025, 8, 11] as const, buyNav: 100, sellNav: 175 };
    const lots: KaLot[] = [
      { ...base, units: 1000 },
      { ...base, client: 'S Client A', accountName: accountWithPan('S Client A', 1), units: 1000 },
      { ...base, client: CLIENT_B, units: 1000 },
      { ...base, client: CLIENT_B, accountName: accountWithPan(CLIENT_B, 5), units: 1000 },
    ];
    const imp0 = parseLots(lots);
    assert.deepEqual(imp0.lots.map((l) => l.personNo), [1, 1, 2, 3]);
    const r = run(lots, [
      { personKey: 'person:1', fy: 2025, slabPct: null, surchargePct: 0, regime: null },
      { client: CLIENT_B, fy: 2025, slabPct: null, surchargePct: 0, regime: null },
    ]);
    const y = year(r.roll, 2025);
    assert.deepEqual(y.persons.map((p) => p.personKey), ['person:1', 'person:2', 'person:3']);
    const p1 = y.persons[0]!;
    assert.equal(p1.clientId, CLIENT_IDS[CLIENT_A]);
    assert.equal(p1.inReview, true);
    assert.equal(p1.personLabel, 'Sample Client A, S Client A (Person 1)');
    near(v(p1.estimate.tax), (150000 - 125000) * 0.125, 'one person, one exemption over both labels');
    assert.equal(p1.estimate.beforeSurcharge, false, 'the entry by person key applies');
    // Sample Client B under two PANs: two persons, both of the review, each with its own exemption; an entry by the
    // client id is ambiguous (two persons share it) and is not applied.
    for (const p of y.persons.slice(1)) {
      assert.equal(p.clientId, CLIENT_IDS[CLIENT_B]);
      near(v(p.estimate.tax), (75000 - 75000) * 0.125, 'within its own exemption');
      assert.equal(p.estimate.surchargeLabel, 'before surcharge (rate not set)');
    }
    assert.deepEqual(y.familyPersons, ['person:1', 'person:2', 'person:3']);
    const mine = r.roll.issues.find((i) => i.ruleId === 'capital-gains.clients-unmatched');
    assert.ok(mine, 'the joined lot is named');
    assert.match(mine!.message, /shares a PAN with a client of the review/);
  });
});

describe('repeats (§6): INSUFFICIENT EVIDENCE until answered; extra rows excluded as "once" not counted', () => {
  const lot: KaLot = { ...EQ, folio: '91500777', buy: [2021, 4, 5], sell: [2025, 8, 11], units: 2000, buyNav: 100, sellNav: 175 };
  const other: KaLot = { ...EQ, folio: '91500778', buy: [2021, 4, 5], sell: [2024, 8, 12], units: 10, buyNav: 100, sellNav: 175 };
  test('unanswered: the year is INSUFFICIENT EVIDENCE, the other year is not', () => {
    const r = run([lot, lot, other], [A_(2025), A_(2024)]);
    const p = py(r.roll, 2025, CLIENT_A);
    assert.equal(p.insufficientEvidence, true);
    assert.equal(year(r.roll, 2025).insufficientEvidence, true);
    for (const k of ['tax', 'surcharge', 'cess', 'total'] as const) assert.equal(p.estimate[k].kind === 'missing' && p.estimate[k].status, STATUS.INSUFFICIENT_EVIDENCE, k);
    assert.equal(year(r.roll, 2025).familySum.estimate.tax.kind === 'missing' && year(r.roll, 2025).familySum.estimate.tax.status, STATUS.INSUFFICIENT_EVIDENCE);
    assert.equal(py(r.roll, 2024, CLIENT_A).insufficientEvidence, false);
  });
  test('answered "once": the extra row is not counted; "as stated": both are', () => {
    const once = run([lot, lot], [A_(2025)], { extra: { repeatAnswers: { all: 'once' } } });
    const p = py(once.roll, 2025, CLIENT_A);
    assert.equal(p.insufficientEvidence, false);
    assert.equal(p.lots.length, 1);
    near(v(p.estimate.tax), 3125, 'one lot');
    const stated = run([lot, lot], [A_(2025)], { extra: { repeatAnswers: { all: 'as-stated' } } });
    near(v(py(stated.roll, 2025, CLIENT_A).estimate.tax), (300000 - 125000) * 0.125, 'both lots');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The financial-domain review of the tax engine, round 1 (should-fix S-1 to S-6): the reviewer's failing inputs and
// hand-worked figures (synthetic data only).

describe('financial review round 1: analyst inputs applied, missing figures never read as 0 (S-1 to S-6)', () => {
  const EQ2 = { scheme: 'Sample Flexi Cap Fund - Regular Plan - Growth', asset: 'Equity', category: 'Flexi Cap Funds' } as const;
  const isMissing = (x: { kind: string; status?: string; reason?: string }, status: string, reason: string | RegExp, w: string): void => {
    assert.equal(x.kind, 'missing', `${w}: expected missing`);
    assert.equal(x.status, status, `${w}: status`);
    if (typeof reason === 'string') assert.equal(x.reason, reason, `${w}: reason`);
    else assert.match(x.reason!, reason, `${w}: reason`);
  };
  // S-1: one PAN under two review labels, each with an EQ-LT-7 gain of Rs 2,00,000 sold 11 Aug 2025.
  const twoLabels: KaLot[] = [
    { ...EQ, accountName: accountWithPan(CLIENT_A, 1), buy: [2021, 4, 5], sell: [2025, 8, 11], units: 1000, buyNav: 100, sellNav: 300 },
    { ...EQ2, client: CLIENT_B, accountName: accountWithPan(CLIENT_B, 1), buy: [2021, 4, 5], sell: [2025, 8, 11], units: 1000, buyNav: 100, sellNav: 300 },
  ];
  const entry = (client: string, surchargePct: number | null): KaPersonYear => ({ client, fy: 2025, slabPct: null, surchargePct, regime: 'new' });

  test('S-1: label entries that agree are applied to the PAN person, recorded with the labels (Rs 39,325.00)', () => {
    const r = run(twoLabels, [entry(CLIENT_A, 10), entry(CLIENT_B, 10)]);
    const p = year(r.roll, 2025).persons[0]!;
    assert.equal(p.personKey, 'person:1');
    // By hand: (4,00,000 - 1,25,000) x 12.5% = 34,375.00; surcharge 10% 3,437.50; cess 4% 1,512.50; total 39,325.00.
    checkEstimate(p.estimate, { tax: 34375, surcharge: 3437.5, cess: 1512.5, total: 39325 }, 'S-1 agree');
    assert.equal(p.estimate.beforeSurcharge, false);
    assert.deepEqual(p.inputSource, { by: 'label', clientIds: [CLIENT_IDS[CLIENT_A], CLIENT_IDS[CLIENT_B]], labels: [CLIENT_A, CLIENT_B] });
    assert.deepEqual(r.roll.refusals, []);
    const a = r.roll.audit.find((x) => x.detail.person === 'person:1');
    assert.equal(a?.detail.enteredUnder, `client label: ${CLIENT_A}, ${CLIENT_B}`);
  });
  test('S-1: one label entry alone is applied the same way', () => {
    const r = run(twoLabels, [entry(CLIENT_B, 10)]);
    const p = year(r.roll, 2025).persons[0]!;
    near(v(p.estimate.total), 39325, 'S-1 one entry total');
    assert.deepEqual(p.inputSource, { by: 'label', clientIds: [CLIENT_IDS[CLIENT_B]], labels: [CLIENT_B] });
  });
  test('S-1: label entries that disagree are refused, naming Person n and the labels, never the PAN; none applies', () => {
    const r = run(twoLabels, [entry(CLIENT_A, 10), entry(CLIENT_B, 15)]);
    const p = year(r.roll, 2025).persons[0]!;
    // As if not entered: 34,375.00 before surcharge (rate not set), cess 1,375.00, total 35,750.00.
    checkEstimate(p.estimate, { tax: 34375, cess: 1375, total: 35750 }, 'S-1 disagree');
    assert.equal(p.estimate.surchargeLabel, 'before surcharge (rate not set)');
    assert.equal(p.inputSource, null);
    assert.equal(r.roll.refusals.length, 1);
    const f = r.roll.refusals[0]!;
    assert.equal(f.input, 'person-year');
    assert.equal(f.ref, 'person:1|2025');
    assert.match(f.reason, /Person 1/);
    assert.ok(f.reason.includes(`"${CLIENT_A}"`) && f.reason.includes(`"${CLIENT_B}"`), f.reason);
    assert.match(f.reason, /enter them once under Person 1/);
    assert.equal(hasPanShape(f.reason), false);
    assert.doesNotMatch(f.reason, new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
    assert.equal(r.roll.audit.some((x) => x.detail.person === 'person:1'), false, 'no audit entry for an entry not applied');
  });

  test('S-2: under the slab dash the after-set-off figures are missing (NOT AVAILABLE, slab rate not set), never 0 (KA-12)', () => {
    const c = ka('KA-12');
    const r = run(c.lots, [A_(2023)]);
    const p = py(r.roll, 2023, CLIENT_A);
    assert.equal(p.afterSetOffDash, 'slab rate not set');
    const NA = STATUS.NOT_AVAILABLE;
    isMissing(p.values.exemptionApplied, NA, 'slab rate not set', 'exemption applied');
    isMissing(p.values.unabsorbed.st, NA, 'slab rate not set', 'unabsorbed st');
    isMissing(p.values.unabsorbed.lt, NA, 'slab rate not set', 'unabsorbed lt');
    assert.equal(p.buckets.length, 2);
    for (const b of p.buckets) {
      for (const k of ['setOff', 'taxable', 'exemption', 'tax', 'surcharge'] as const) isMissing(b.values[k], NA, 'slab rate not set', `${b.ruleId} ${k}`);
    }
    near(v(p.values.realised), 30000 - 50000 + 80000, 'realised is before set-off and stays a figure');
    isMissing(year(r.roll, 2023).familySumValues.unabsorbed.st, NA, 'slab rate not set', 'family unabsorbed st');
    // With the slab rate set, the same Values are figures equal to the contract's numbers (KA-12 at 30%).
    const s = py(run(c.lots, [A_(2023, { slabPct: 30 })]).roll, 2023, CLIENT_A);
    assert.equal(s.afterSetOffDash, null);
    for (const b of s.buckets) {
      near(v(b.values.taxable), b.taxable, `${b.ruleId} taxable`);
      near(v(b.values.setOff), b.setOff, `${b.ruleId} set-off`);
      near(v(b.values.tax), b.tax, `${b.ruleId} tax`);
    }
    near(v(s.values.unabsorbed.st), s.unabsorbed.st, 'unabsorbed st with the slab set');
  });

  test('S-3: in a year with an unanswered repeat, realised, exemption applied and every tax figure are INSUFFICIENT EVIDENCE', () => {
    const lot: KaLot = { ...EQ, folio: '91500777', buy: [2021, 4, 5], sell: [2025, 8, 11], units: 2000, buyNav: 100, sellNav: 175 };
    const ann: KaLot = { ...EQ2, folio: '91500779', buy: [2024, 9, 17], sell: [2025, 9, 17], units: 1000, buyNav: 50, sellNav: 60 };
    const other: KaLot = { ...EQ, folio: '91500778', buy: [2021, 4, 5], sell: [2024, 8, 12], units: 10, buyNav: 100, sellNav: 175 };
    const r = run([lot, lot, ann, other], [A_(2025), A_(2024)]);
    const p = py(r.roll, 2025, CLIENT_A);
    assert.equal(p.insufficientEvidence, true);
    const IE = STATUS.INSUFFICIENT_EVIDENCE;
    const why = /unanswered repeated-rows question/;
    isMissing(p.values.realised, IE, why, 'realised');
    isMissing(p.values.exemptionApplied, IE, why, 'exemption applied');
    isMissing(p.values.unabsorbed.st, IE, why, 'unabsorbed st');
    isMissing(p.values.unabsorbed.lt, IE, why, 'unabsorbed lt');
    for (const k of ['tax', 'surcharge', 'cess', 'total'] as const) isMissing(p.estimate[k], IE, why, `estimate ${k}`);
    for (const b of p.buckets) {
      for (const k of ['setOff', 'taxable', 'exemption', 'tax', 'surcharge'] as const) isMissing(b.values[k], IE, why, `${b.ruleId} ${k}`);
    }
    isMissing(p.alternatives.anniversaryLongTerm!, IE, why, 'anniversary alternative');
    for (const k of ['tax', 'surcharge', 'cess', 'total'] as const) isMissing(p.alternativesDetail.anniversaryLongTerm![k], IE, why, `anniversary detail ${k}`);
    isMissing(year(r.roll, 2025).familySumValues.realised, IE, why, 'family realised');
    // The other year is untouched: realised 10 x (175 - 100) = 750.00.
    const o = py(r.roll, 2024, CLIENT_A);
    assert.equal(o.insufficientEvidence, false);
    near(v(o.values.realised), 750, 'the other year realised');
    near(v(o.values.exemptionApplied), 750, 'the other year exemption applied');
  });

  test('S-5: a person-year assessee mark entered under the person key "person:n" flags the PAN person\'s lots', () => {
    const lots: KaLot[] = [
      { ...EQ, accountName: accountWithPan(CLIENT_A, 1), buy: [2021, 4, 5], sell: [2025, 8, 11], units: 100, buyNav: 100, sellNav: 175 },
      { ...EQ2, client: 'S Client A', accountName: accountWithPan('S Client A', 1), buy: [2021, 4, 5], sell: [2025, 8, 11], units: 100, buyNav: 100, sellNav: 175 },
    ];
    const r = run(lots, [{ personKey: 'person:1', fy: 2025, slabPct: null, surchargePct: 0, regime: null, assesseeMark: 'minor' }]);
    for (const g of r.g) assert.ok(g.flags.includes('assessee-flagged'), `lot ${g.lotIndex} flagged`);
    assert.equal(r.res.issues.find((i) => i.ruleId === 'capital-gains.assessee-flagged')?.count, 2);
    // Under a review label of a person with two review labels: the person's lots are flagged too (a flag only).
    const two = run(twoLabels, [{ client: CLIENT_B, fy: 2025, slabPct: null, surchargePct: 0, regime: null, assesseeMark: 'huf' }]);
    for (const g of two.g) assert.ok(g.flags.includes('assessee-flagged'), `two labels: lot ${g.lotIndex} flagged`);
    // The person key decides first: an entry under it without a mark, beside a marked label entry, flags nothing.
    const first = run(twoLabels, [
      { personKey: 'person:1', fy: 2025, slabPct: null, surchargePct: 0, regime: null, assesseeMark: null },
      { client: CLIENT_B, fy: 2025, slabPct: null, surchargePct: 0, regime: null, assesseeMark: 'huf' },
    ]);
    for (const g of first.g) assert.equal(g.flags.includes('assessee-flagged'), false, `person key first: lot ${g.lotIndex}`);
  });

  test('S-6: an anniversary-day lot marked gift, under a grandfathered long-term row, has the dash as its alternative', () => {
    // Bought 1 Jun 2017, 100 units at Rs 100, 31 Jan 2018 price Rs 120, sold on the anniversary 1 Jun 2018 at Rs 150:
    // EQ-ST-2 short term; EQ-LT-2 needs the s.55(2)(b) input for a gift (TR-11), so no Rs 3,000.00 figure.
    const lot: KaLot = { ...EQ, buy: [2017, 6, 1], sell: [2018, 6, 1], units: 100, buyNav: 100, sellNav: 150, over: { acqDate: [2018, 1, 31], acqPrice: 120 } };
    const lotIndex = parseLots([lot]).lots[0]!.index;
    const r = run([lot], [A_(2018)], { inputs: { lotMarks: [{ lotIndex, giftOrInheritance: true }] } });
    const g = r.g[0]!;
    assert.equal(g.ruleId, 'EQ-ST-2');
    assert.equal(g.anniversaryLongTerm, null, 'the contract field cannot hold the dash');
    assert.equal(g.anniversaryLongTermDetail?.ruleId, 'EQ-LT-2');
    assert.equal(g.anniversaryLongTermDetail?.costForTax, null);
    isMissing(g.anniversaryLongTermDetail!.taxableGain, STATUS.NOT_AVAILABLE, /cost-input-missing/, 'the long-term gain');
    const p = py(r.roll, 2018, CLIENT_A);
    isMissing(p.alternatives.anniversaryLongTerm!, STATUS.NOT_AVAILABLE, /cost-input-missing/, 'the person-year alternative');
    // Without the mark: the grandfathered figure, cost max(10,000, min(12,000, 15,000)) = 12,000, gain 3,000.00.
    const u = run([lot], [A_(2018)]);
    assert.equal(u.g[0]!.anniversaryLongTerm?.ruleId, 'EQ-LT-2');
    near(u.g[0]!.anniversaryLongTerm!.taxableGain, 3000, 'unmarked long-term gain');
    assert.notEqual(v(py(u.roll, 2018, CLIENT_A).alternatives.anniversaryLongTerm), null, 'unmarked: a figure');
  });
});

describe('the contract shapes and the messages', () => {
  test('Bucket.rate is a percent number or slab; rulesVersion from the table; the family sum has no exemption', () => {
    const c = ka('KA-12');
    const r = run(c.lots, c.personYear);
    const p = py(r.roll, 2023, CLIENT_A);
    assert.deepEqual(p.buckets.map((b) => [b.ruleId, b.rate]), [['EQ-ST-2', 15], ['NE-50AA-1', 'slab']]);
    assert.equal(year(r.roll, 2023).rulesVersion, TAX_RULES_V1.version);
    assert.equal(Object.keys(year(r.roll, 2023).familySum).includes('exemption'), false);
    assert.ok(p.labels.includes('resident individual assumed'));
  });
  test('the roll-up messages carry no PAN, folio, amount or dash; the audit entries no PAN', () => {
    const all = [...RAISED.filter((i) => S3_ISSUE_IDS.includes(i.ruleId.replace('capital-gains.', '')))];
    assert.ok(all.length > 0);
    // The en dash, the em dash and the rupee sign by code point (no such character in this file, D-029).
    const forbidden = new RegExp(`[${String.fromCharCode(0x2013, 0x2014, 0x20b9)}]|Rs|9150\\d{4}`);
    for (const i of all) {
      assert.equal(hasPanShape(i.message), false);
      assert.doesNotMatch(i.message, forbidden);
    }
    assert.ok(AUDITS.length > 0);
    for (const a of AUDITS) assert.equal(hasPanShape(JSON.stringify(a)), false);
  });
});

describe('the ids this file is assigned (design §14 coverage table: tax/rollup)', () => {
  test('clients-unmatched (the roll-up part), anniversary-sale and old-law-choice were raised here', () => {
    const seen = new Set(RAISED.map((i) => i.ruleId.replace('capital-gains.', '')));
    for (const id of ['clients-unmatched', 'anniversary-sale', 'old-law-choice', ...S3_ISSUE_IDS]) assert.ok(seen.has(id), id);
  });
});
