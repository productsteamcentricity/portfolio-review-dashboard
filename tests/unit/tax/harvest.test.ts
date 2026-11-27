// covers: E-43 D-040 PD-03 PD-07 Q-52 KI-130 KI-007
// Tax-loss harvesting per client (app/src/engine/tax/harvest.ts, NB-M7a S4b): the hand-worked answers H-1 to H-6 and R2-H7 of
// tests/fixtures/harvest-known-answers.json (origin NB-03; R2-H7 the financial reviewer's, round 2; the working is in each case's
// note), and the new-build rules: PD-07 (no slab default, the one named parameter), Q-52 (the exemption only when the
// amount already used is known: the analyst's entry, else the statement's person-year for the client's only person),
// crypto out of set-off (PD-03), per client never pooled, unknown gains PARTIAL. Synthetic records
// (tests/fixtures/make-tax-positions.ts); money in rupees, compared to Rs 0.01.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollupHoldings } from '../../../app/src/engine/tax/holdings-rollup.ts';
import {
  EXEMPTION_NOT_APPLIED, FAMILY_LABEL, SLAB_DEFAULT_PCT_HARVEST, buildHarvests, exemptionUsedFor,
} from '../../../app/src/engine/tax/harvest.ts';
import type { HarvestContext, HarvestLocal, StatementYears } from '../../../app/src/engine/tax/harvest.ts';
import { present, missing } from '../../../app/src/engine/value.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import type { HarvestResult, TaxInputs } from '../../../app/src/model/tax.ts';
import type { ClientId } from '../../../app/src/model/ids.ts';
import type { Value } from '../../../app/src/model/value.ts';
import { clientIdOf, makeLots } from '../../fixtures/make-tax-positions.ts';
import type { PositionSpec } from '../../fixtures/make-tax-positions.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const KA = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/harvest-known-answers.json'), 'utf8'));
const AS_ON = ymdToDay(2026, 9, 30)!;
const FY = 2026;
const A = 'Sample Client A';
const B = 'Sample Client B';
const PROV = { sources: [], method: 'test' };

type Inputs = { slab?: Record<string, number>; exemptionUsed?: Record<string, number | 'unused-confirmed'>; statement?: Record<string, number> };

function statementOf(m: Record<string, number | Value<number>>, fy = FY): StatementYears {
  return {
    years: [{
      fy,
      persons: Object.entries(m).map(([c, v]) => ({
        clientId: clientIdOf(c), inReview: true, personKey: clientIdOf(c) as string,
        values: {
          realised: present(0, 'inr', PROV), exemptionApplied: typeof v === 'number' ? present(v, 'inr', PROV) : v,
          unabsorbed: { st: present(0, 'inr', PROV), lt: present(0, 'inr', PROV) },
        },
      })),
    }],
  };
}

function ctxOf(i: Inputs, extra: Partial<HarvestContext> = {}): HarvestContext {
  const personYear: TaxInputs['personYear'] = Object.entries(i.slab ?? {}).map(([c, pct]) => ({
    clientId: clientIdOf(c), fy: FY, slabPct: pct, surchargePct: null, regime: null, assesseeMark: null,
  }));
  const exemptionUsed: TaxInputs['exemptionUsed'] = Object.entries(i.exemptionUsed ?? {}).map(([c, amount]) => ({ clientId: clientIdOf(c), fy: FY, amount }));
  return { asOn: AS_ON, inputs: { personYear, exemptionUsed }, statement: i.statement ? statementOf(i.statement) : null, ...extra };
}

function run(specs: readonly PositionSpec[], ctx: HarvestContext): ReturnType<typeof buildHarvests> {
  const { lots, facts } = makeLots(specs);
  return buildHarvests(rollupHoldings(lots, facts), ctx);
}

const near = (a: number | null, b: number | null, msg: string): void => {
  if (b === null) { assert.equal(a, null, msg); return; }
  assert.ok(a !== null && Math.abs(a - b) <= KA.tolerance, `${msg}: ${a} != ${b}`);
};

const FIG = ['taxBefore', 'taxAfter', 'saving', 'ltLosses', 'stLosses', 'ltUsed', 'stUsed', 'ltUnused', 'stUnused', 'slabSheltered',
  'unquantifiedGain', 'unquantifiedPools', 'noSetOffGain', 'noSetOffLoss', 's198Gains', 's198Left', 'exAfter'] as const;

function checkClient(h: HarvestLocal, e: Record<string, unknown>, id: string): void {
  for (const k of FIG) if (k in e) near(h.figures[k], e[k] as number | null, `${id} ${String(e.client)} ${k}`);
  if ('exemptionApplied' in e) assert.equal(h.exemptionApplied, e.exemptionApplied, `${id} exemptionApplied`);
  if ('exemptionSource' in e) assert.equal(h.exemption.source, e.exemptionSource, `${id} exemptionSource`);
  if ('exemptionAvailable' in e) near(h.exemption.available, e.exemptionAvailable as number, `${id} exemptionAvailable`);
  if ('dash' in e) assert.equal(h.afterSetOffDash, e.dash, `${id} dash`);
  if ('candidates' in e) assert.deepEqual(h.candidateDetail.map((c) => c.name), e.candidates, `${id} candidates`);
  if ('labels' in e) for (const l of e.labels as string[]) assert.ok(h.labels.includes(l), `${id} label ${l}`);
}

function checkCase(id: string, positions: PositionSpec[], inputs: Inputs, expect: Record<string, any>): void { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { clients, family } = run(positions, ctxOf(inputs));
  for (const e of expect.clients as Array<Record<string, unknown>>) {
    const h = clients.find((c) => c.clientId === clientIdOf(e.client as string));
    assert.ok(h, `${id}: client ${String(e.client)}`);
    checkClient(h!, e, id);
  }
  if (expect.family) {
    const f = expect.family;
    assert.equal(family.label, f.label);
    for (const k of ['taxBefore', 'taxAfter', 'saving', 'ltLosses', 'ltUnused'] as const) if (k in f) near(family.figures[k], f[k], `${id} family ${k}`);
    if ('candidates' in f) assert.equal(family.candidates.length, f.candidates);
  }
}

describe('known answers H-1 to H-6 (origin NB-03) and R2-H7 (the financial reviewer\'s, round 2)', () => {
  test('the file holds H-1 to H-6 (NB-03) and R2-H7 (FIN-R2), each in the harvest group', () => {
    assert.deepEqual(KA.cases.map((c: { id: string }) => c.id), ['H-1', 'H-2', 'H-3', 'H-4', 'H-5', 'H-6', 'R2-H7']);
    for (const c of KA.cases) {
      assert.equal(c.origin, c.id.startsWith('R2-') ? 'FIN-R2' : 'NB-03');
      assert.equal(c.group, 'harvest'); assert.ok(c.note.length > 40);
    }
  });
  for (const c of KA.cases) {
    test(c.id, () => checkCase(c.id, c.positions, c.inputs, c.expect));
    for (const v of c.variants ?? []) test(v.id, () => checkCase(v.id, v.positions ?? c.positions, v.inputs, v.expect));
  }
});

describe('PD-07: no slab default, in one named parameter', () => {
  const specs: PositionSpec[] = KA.cases.find((c: { id: string }) => c.id === 'H-3').positions;
  test('the named default is null', () => assert.equal(SLAB_DEFAULT_PCT_HARVEST, null));
  test('with no entry the slab is "not set", the slab pool unquantified and labelled', () => {
    const h = run(specs, ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } })).clients[0]!;
    assert.deepEqual(h.slab, { pct: null, source: 'not set', limited: false });
    assert.equal(h.slabPct, null);
    assert.equal(h.unquantifiedPools.length, 1);
    assert.match(h.unquantifiedPools[0]!, /short term$/);
    assert.equal(h.taxAfter.kind, 'missing');
    assert.equal(h.taxBefore.kind, 'value');
  });
  test('an owner answer of 30% is a one-line change: the option gives the live figures, labelled default', () => {
    const h = run(specs, ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } }, { slabDefaultPct: 30 })).clients[0]!;
    assert.deepEqual(h.slab, { pct: 30, source: 'default', limited: false });
    near(h.figures.taxAfter, 8000, 'taxAfter at the default');
    assert.ok(h.labels.includes('slab rate: the default (PD-07)'));
  });
  test('an entry above 30% is limited to 30% (the live slabMaxPct)', () => {
    const h = run(specs, ctxOf({ slab: { [A]: 42 }, exemptionUsed: { [A]: 'unused-confirmed' } })).clients[0]!;
    assert.deepEqual(h.slab, { pct: 30, source: 'analyst', limited: true });
  });
  test('without slab pools the slab does not matter: no dash', () => {
    const h = run(KA.cases[0].positions, ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } })).clients[0]!;
    assert.equal(h.afterSetOffDash, null);
    assert.equal(h.unquantifiedPools.length, 0);
  });
});

describe('Q-52: the exemption only when the amount used is known', () => {
  const specs: PositionSpec[] = KA.cases[0].positions;
  const cid = clientIdOf(A);
  test('the analyst entry wins over the statement', () => {
    const r = exemptionUsedFor(cid, FY, ctxOf({ exemptionUsed: { [A]: 10000 }, statement: { [A]: 50000 } }));
    assert.deepEqual(r, { used: 10000, source: 'analyst', reason: null });
  });
  test('the statement person whose only review client is this client', () => {
    assert.deepEqual(exemptionUsedFor(cid, FY, ctxOf({ statement: { [A]: 50000 } })), { used: 50000, source: 'statement', reason: null });
  });
  test('a statement person with two review clients (clientId null) maps to neither: not applied', () => {
    const st = statementOf({ [A]: 50000 });
    (st.years[0]!.persons[0] as { clientId: ClientId | null }).clientId = null;
    const h = run(specs, ctxOf({}, { statement: st })).clients[0]!;
    assert.equal(h.exemptionApplied, EXEMPTION_NOT_APPLIED);
    assert.match(h.exemption.reason!, /no person for this client alone/);
  });
  test('two person-years for one client (a PAN person and a label person): not applied', () => {
    const st = statementOf({ [A]: 50000 });
    st.years[0]!.persons.push({ ...st.years[0]!.persons[0]!, personKey: 'person:1' } as never);
    assert.match(exemptionUsedFor(cid, FY, ctxOf({}, { statement: st })).reason!, /more than one person/);
  });
  test('the statement figure missing (INSUFFICIENT EVIDENCE or the slab dash): not applied', () => {
    const st = statementOf({ [A]: missing(STATUS.INSUFFICIENT_EVIDENCE, 'an unanswered repeated-rows question') });
    const r = exemptionUsedFor(cid, FY, ctxOf({}, { statement: st }));
    assert.equal(r.used, null);
    assert.match(r.reason!, /not available/);
  });
  test('a statement without the as-on year, or no statement: not applied', () => {
    assert.match(exemptionUsedFor(cid, FY, ctxOf({}, { statement: statementOf({ [A]: 0 }, 2025) })).reason!, /no lots in this financial year/);
    assert.match(exemptionUsedFor(cid, FY, ctxOf({})).reason!, /no capital-gains statement/);
  });
  test('an amount used above the limit is limited to it: nothing unused', () => {
    const h = run(specs, ctxOf({ exemptionUsed: { [A]: 200000 } })).clients[0]!;
    assert.equal(h.exemptionApplied, 'applied');
    assert.equal(h.exemption.used, 125000);
    near(h.figures.taxBefore, 37500, 'taxBefore');
  });
  test('a year whose exemption is to be confirmed applies none', () => {
    const h = run(specs, ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } }, { asOn: ymdToDay(2027, 9, 30)! })).clients[0]!;
    assert.equal(h.fy, 2027);
    assert.equal(h.exemptionApplied, EXEMPTION_NOT_APPLIED);
    assert.equal(h.exemption.limit, null);
  });
});

describe('per client, the family a sum; the contract shape', () => {
  const c5 = KA.cases.find((c: { id: string }) => c.id === 'H-5');
  test('HarvestResult fields: candidates as holding ids, losses, the label', () => {
    const { clients, family } = run(c5.positions, ctxOf(c5.inputs));
    const b: HarvestResult = { ...clients.find((c) => c.clientId === clientIdOf(B))!, clientId: clientIdOf(B) };
    assert.deepEqual(b.candidates, ['holding:1']);
    assert.deepEqual(b.usedLosses, { st: 0, lt: 0 });
    assert.deepEqual(b.unusedLosses, { st: 0, lt: 100000 });
    assert.equal(family.label, FAMILY_LABEL);
    assert.equal(family.byClient.length, 2);
    assert.equal(clients.find((c) => c.clientId === clientIdOf(B))!.harvestableLoss, 100000);
  });
  test('the family figure is the dash when any client\'s is', () => {
    const specs: PositionSpec[] = [
      ...KA.cases.find((c: { id: string }) => c.id === 'H-3').positions,
      { client: B, name: 'Sample Value Fund', cls: 'equityMf', cmv: 100000, lt: 20000 },
    ];
    const { family } = run(specs, ctxOf({ exemptionUsed: { [A]: 'unused-confirmed', [B]: 'unused-confirmed' } }));
    assert.equal(family.figures.taxAfter, null);
    assert.equal(family.taxAfter.kind, 'missing');
    near(family.figures.taxBefore, 8000, 'family taxBefore');
  });
  test('holdings without a client are one person, whose exemption is never known', () => {
    const { clients } = run([{ client: null, name: 'Sample Fund', cls: 'equityMf', cmv: 300000, lt: 100000 }], ctxOf({}));
    assert.equal(clients[0]!.clientId, null);
    assert.equal(clients[0]!.exemptionApplied, EXEMPTION_NOT_APPLIED);
    near(clients[0]!.figures.taxBefore, 12500, 'taxBefore');
  });
  test('a holding with an unknown gain is left out of the pools and the figures are PARTIAL', () => {
    const { clients } = run([
      { client: A, name: 'Sample Fund One', cls: 'equityMf', cmv: 300000, lt: 100000 },
      { client: A, name: 'Sample Fund Two', cls: 'equityMf', cmv: 200000, lt: null },
    ], ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } }));
    const h = clients[0]!;
    assert.equal(h.gainUnknown, 1);
    assert.equal(h.taxBefore.kind, 'value');
    assert.equal((h.taxBefore as { coverage?: number }).coverage, 0.5);
    assert.match((h.taxBefore as { prov: { method: string } }).prov.method, /PARTIAL COVERAGE/);
    assert.ok(h.labels.some((l) => /unknown gain/.test(l)));
  });
  test('R2 S-4: a holding split at 1 Apr 2023 with an unknown gain counts once, so coverage is 1 of 2 holdings', () => {
    // One known holding and one Specified debt holding split at 1 Apr 2023 (two records, one holding id) with a blank
    // invested value. Holdings: 2, of which 1 has an unknown gain: gainUnknown 1, coverage (2 - 1) / 2 = 0.5, the label
    // "1 holding". (The old count took the two records: gainUnknown 2, coverage (2 - 2) / 2 = 0, "2 holdings".)
    const { clients, family } = run([
      { client: A, name: 'Sample Fund One', cls: 'equityMf', cmv: 300000, lt: 100000 },
      { client: A, name: 'Sample Bond Fund', cls: 'debtMf', cmv: 10000, lt: null, st: null, splitPart: 'from-2023', id: 'holding:9' },
      { client: A, name: 'Sample Bond Fund', cls: 'debtMf', cmv: 10000, lt: null, st: null, splitPart: 'pre-2023', id: 'holding:9' },
    ], ctxOf({ slab: { [A]: 30 }, exemptionUsed: { [A]: 'unused-confirmed' } }));
    const h = clients[0]!;
    assert.equal(h.gainUnknown, 1);
    assert.equal((h.taxBefore as { coverage?: number }).coverage, 0.5);
    assert.ok(h.labels.includes('1 holding with an unknown gain left out (PARTIAL COVERAGE)'), JSON.stringify(h.labels));
    assert.equal(family.gainUnknown, 1);
  });
  test('an unsplit holding (Category II AIF) is never a pool or a candidate', () => {
    const { clients } = run([
      { client: A, name: 'Sample AIF Category II', cls: 'equityAif12', cmv: 300000, notSplit: 'pass-through', gain: -50000 },
    ], ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } }));
    assert.equal(clients[0]!.pools.length, 0);
    assert.equal(clients[0]!.candidateDetail.length, 0);
  });
});
