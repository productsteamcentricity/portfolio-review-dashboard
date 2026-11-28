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
  test('M7b F-3: a holding unreconciled with the IRR file stays out of the pools and makes the figures PARTIAL, labelled', () => {
    // One split holding (long gain 1,00,000) and one unreconciled holding (gain 8,000, not split): the pools hold the
    // 1,00,000 alone (unused exemption confirmed: 1,00,000 within Rs 1,25,000, tax 0), and the figures are PARTIAL with
    // coverage 1 split / (1 split + 1 unreconciled) = 0.5; the family too. Before M7b: complete, no label.
    const { clients, family } = run([
      { client: A, name: 'Sample Fund One', cls: 'equityMf', cmv: 300000, lt: 100000 },
      { client: A, name: 'Sample Fund Two', cls: 'equityMf', cmv: 80000, status: 'unreconciled', gain: 8000 },
    ], ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } }));
    const h = clients[0]!;
    assert.equal(h.unreconciled, 1);
    near(h.figures.taxBefore, 0, 'tax before');
    assert.equal((h.taxBefore as { coverage?: number }).coverage, 0.5);
    assert.match((h.taxBefore as { prov: { method: string } }).prov.method, /PARTIAL COVERAGE: 1 holding not split \(unreconciled with the IRR file: fewer units in the history 1\) left out of the pools/);
    assert.ok(h.labels.includes('1 holding not split (unreconciled with the IRR file: fewer units in the history 1) left out (PARTIAL COVERAGE)'), JSON.stringify(h.labels));
    assert.equal(family.unreconciled, 1);
    assert.equal((family.taxBefore as { coverage?: number }).coverage, 0.5);
  });
  test('M7b D-1: a client with no holding split (all unreconciled) has no harvest; the family leaves it out with a count', () => {
    // A: one split holding (long gain 1,00,000, unused exemption confirmed: tax 0). B: one unreconciled holding only. B's
    // Values are NOT AVAILABLE with the reason (before: 0 at coverage 0); the family is A's alone, PARTIAL, 1 client left
    // out, coverage 1 split holding of 2 = 0.5. With B alone the family is NOT AVAILABLE.
    const specs: PositionSpec[] = [
      { client: A, name: 'Sample Fund One', cls: 'equityMf', cmv: 300000, lt: 100000 },
      { client: B, name: 'Sample Fund Two', cls: 'equityMf', cmv: 80000, status: 'unreconciled', gain: 8000 },
    ];
    const { clients, family } = run(specs, ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } }));
    const b = clients.find((c) => c.clientLabel === B)!;
    assert.equal(b.taxBefore.kind, 'missing');
    assert.equal(b.notWorked, 'no holding of this client is split into long and short term (1 holding not split, unreconciled with the IRR file: fewer units in the history 1), so no harvest is worked');
    assert.equal(clients.find((c) => c.clientLabel === A)!.notWorked, null);
    assert.equal(family.clientsNotWorked, 1);
    assert.equal(family.taxBefore.kind, 'value');
    assert.equal((family.taxBefore as { coverage?: number }).coverage, 0.5);
    const alone = run([specs[1]!], ctxOf({})).family;
    assert.equal(alone.taxBefore.kind, 'missing');
    assert.equal(alone.clientsNotWorked, 1);
  });
  test('round 3 M1: no plain 0 where nothing is worked: a not-worked client, an all-not-worked family, the slab dash', () => {
    // CHAT-012's Gate B of M7b, M1 (Q-49). B holds one unreconciled holding only: no harvest is worked for B, so its plain
    // figures, used and unused losses, harvestable loss and Sec 198 rate are null (before: 0, and the family's sums of
    // nothing 0 when B is alone). A beside B is worked as before (tax before 0: 1,00,000 inside the confirmed exemption).
    const specs: PositionSpec[] = [
      { client: A, name: 'Sample Fund One', cls: 'equityMf', cmv: 300000, lt: 100000 },
      { client: B, name: 'Sample Fund Two', cls: 'equityMf', cmv: 80000, status: 'unreconciled', gain: -8000 },
    ];
    const { clients } = run(specs, ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } }));
    const b = clients.find((c) => c.clientLabel === B)!;
    assert.ok(b.notWorked !== null);
    assert.deepEqual(b.usedLosses, { st: null, lt: null });
    assert.deepEqual(b.unusedLosses, { st: null, lt: null });
    assert.equal(b.harvestableLoss, null);
    assert.equal(b.exRate, null);
    for (const [k, x] of Object.entries(b.figures)) assert.equal(x, null, `B figures.${k}`);
    const a = clients.find((c) => c.clientLabel === A)!;
    assert.deepEqual(a.usedLosses, { st: 0, lt: 0 });
    assert.equal(a.harvestableLoss, 0);
    near(a.figures.ltGains, 100000, 'A long-term gains');
    // B alone: the family has no worked client, so every family figure and its Sec 198 rate are null (before: all 0).
    const alone = run([specs[1]!], ctxOf({})).family;
    assert.equal(alone.clientsNotWorked, 1);
    for (const [k, x] of Object.entries(alone.figures)) assert.equal(x, null, `family figures.${k}`);
    assert.equal(alone.exRate, null);
    assert.equal(alone.taxBefore.kind, 'missing');
    // The slab dash (H-3 with no slab entered): the plain losses are the figures' used and unused totals, which do not
    // depend on the order of set-off (S-1): the short-term loss of 50,000 is used in full against 1,20,000 of short-term
    // gains at any slab rate (before round 3: { st: 0, lt: 0 }; at 7c4d545: null).
    const h3: PositionSpec[] = KA.cases.find((c: { id: string }) => c.id === 'H-3').positions;
    const d = run(h3, ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } })).clients[0]!;
    assert.equal(d.afterSetOffDash, 'slab rate not set');
    assert.deepEqual(d.usedLosses, { st: 50000, lt: 0 });
    assert.deepEqual(d.unusedLosses, { st: 0, lt: 0 });
  });
  test('round 3 S-1: under the slab dash the used and unused totals stand; what the order decides stays the dash', () => {
    // The financial review's probe: equity short-term gain 5,000, a deemed-short debt gain of 5,000 (slab rate, none
    // entered) and an equity short-term loss of 1,000. At slab 0% the loss meets the equity gain (20%) first, at 30% the
    // slab gain first, so the after-set-off figures differ: the dash. But the loss is used in full either way: used
    // 1,000, unused 0 (7c4d545: null). Tax after, saving and the slab-sheltered amount stay null.
    const { clients } = run([
      { client: A, name: 'Sample Flexi Cap Fund', cls: 'equityMf', cmv: 25000, st: 5000 },
      { client: A, name: 'Sample Money Market Fund', cls: 'debtMf', cmv: 25000, st: 5000 },
      { client: A, name: 'Sample Small Cap Fund', cls: 'equityMf', cmv: 9000, st: -1000 },
    ], ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } }));
    const h = clients[0]!;
    assert.equal(h.afterSetOffDash, 'slab rate not set');
    assert.equal(h.figures.stUsed, 1000); assert.equal(h.figures.stUnused, 0);
    assert.equal(h.figures.ltUsed, 0); assert.equal(h.figures.ltUnused, 0);
    assert.deepEqual(h.usedLosses, { st: 1000, lt: 0 });
    assert.deepEqual(h.unusedLosses, { st: 0, lt: 0 });
    for (const k of ['taxAfter', 'saving', 'slabSheltered'] as const) assert.equal(h.figures[k], null, k);
    assert.ok(h.pools.every((p) => p.left === null));
  });
  test('an unsplit holding (Category II AIF) is never a pool or a candidate', () => {
    const { clients } = run([
      { client: A, name: 'Sample AIF Category II', cls: 'equityAif12', cmv: 300000, notSplit: 'pass-through', gain: -50000 },
    ], ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } }));
    assert.equal(clients[0]!.pools.length, 0);
    assert.equal(clients[0]!.candidateDetail.length, 0);
  });
});

describe('Gate B of aa67a45 item 9: the harvest says what its figures leave out', () => {
  test('every harvest carries the four labels after "indicative, not tax advice"', () => {
    // Before surcharge and cess; terms as on the as-on date; all gains assumed sold in the as-on year; realised gains
    // and carried-forward losses left out. On every client, whatever the inputs.
    const want = ['indicative, not tax advice', 'before surcharge and cess', 'terms as on the as-on date', 'all gains assumed sold in the as-on year',
      'realised gains and carried-forward losses left out'];
    for (const ctx of [ctxOf({}), ctxOf({ slab: { [A]: 30 }, exemptionUsed: { [A]: 'unused-confirmed' } })]) {
      const { clients } = run([
        { client: A, name: 'Sample Fund One', cls: 'equityMf', cmv: 300000, lt: 100000 },
        { client: B, name: 'Sample Fund Two', cls: 'equityMf', cmv: 100000, lt: 0, st: -20000, ltCmv: 0 },
      ], ctx);
      for (const h of clients) assert.deepEqual(h.labels.slice(0, want.length), want, JSON.stringify(h.labels));
    }
  });
});

describe('round 3 M2: the I-21 rates are those from 23 Jul 2024; before that day no rate-dependent figure (Q-49, MOD-05)', () => {
  // CHAT-012's case (Gate B of M7b, M2): one client, Equity MF long-term gain 30,000 and short-term gain 5,000, nothing
  // entered (exemption not applied). The table's rates (12.5% and 20%) give 30,000 x 0.125 + 5,000 x 0.20 = 3,750 +
  // 1,000 = 4,750; before 23 Jul 2024 the rates were 10% and 15% (3,000 + 750 = 3,750), which the table does not hold.
  // So as on 30 Jun 2024 (and 22 Jul 2024) the tax before, the tax after and the saving are NOT AVAILABLE, labelled,
  // never 4,750; the gains stand. As on 23 Jul 2024 and later they are computed as today.
  const MISSING = 'the rates before 23 Jul 2024 are not in the table';
  const specs: PositionSpec[] = [
    { client: A, name: 'Sample Fund One', cls: 'equityMf', cmv: 130000, lt: 30000 },
    { client: A, name: 'Sample Fund Two', cls: 'equityMf', cmv: 55000, lt: undefined, st: 5000, ltCmv: 0 },
  ];
  const at = (y: number, m: number, d: number): ReturnType<typeof buildHarvests> => {
    const asOn = ymdToDay(y, m, d)!;
    const { lots, facts } = makeLots(specs);
    return buildHarvests(rollupHoldings({ ...lots, asOn }, facts), ctxOf({}, { asOn }));
  };
  for (const [y, m, d] of [[2024, 6, 30], [2024, 7, 22]] as const) {
    test(`as on ${d} ${m === 6 ? 'Jun' : 'Jul'} ${y}: tax before, after and saving NOT AVAILABLE with the label, not 4,750`, () => {
      const { clients, family } = at(y, m, d);
      const h = clients[0]!;
      for (const v of [h.taxBefore, h.taxAfter, h.saving]) {
        assert.equal(v.kind, 'missing');
        assert.ok(v.kind === 'missing' && v.reason.startsWith(MISSING), v.kind === 'missing' ? v.reason : '');
      }
      for (const k of ['taxBefore', 'taxAfter', 'saving', 'exBeforeTax', 'exAfterTax', 's198Left', 'exAfter'] as const) assert.equal(h.figures[k], null, k);
      assert.equal(h.exRate, null);
      assert.equal(h.ratesMissing, MISSING);
      assert.ok(h.labels.some((l) => l.startsWith(MISSING)), JSON.stringify(h.labels));
      for (const p of h.pools) { assert.equal(p.rate, null); assert.equal(p.rateMissing, MISSING); assert.equal(p.left, null); }
      // The splits and gains do not depend on the rate.
      near(h.figures.ltGains, 30000, 'long-term gains'); near(h.figures.stGains, 5000, 'short-term gains');
      assert.equal(family.taxBefore.kind, 'missing');
      assert.ok(family.taxBefore.kind === 'missing' && family.taxBefore.reason.startsWith(MISSING));
      assert.equal(family.figures.taxBefore, null);
      // The holdings side says so on every class (the reader of rule.lt.rate and rule.st.rate reads it first).
      const { lots, facts } = makeLots(specs);
      const roll = rollupHoldings({ ...lots, asOn: ymdToDay(y, m, d)! }, facts);
      assert.equal(roll.ratesMissing, MISSING);
      assert.ok(roll.family.byClass.length > 0 && roll.family.byClass.every((g) => g.ratesMissing === MISSING));
    });
  }
  test('as on 23 Jul 2024 and 30 Sep 2026: computed as today (4,750), no rates label', () => {
    for (const [y, m, d] of [[2024, 7, 23], [2026, 9, 30]] as const) {
      const { clients } = at(y, m, d);
      const h = clients[0]!;
      near(h.figures.taxBefore, 4750, `${d}.${m}.${y} tax before`);
      assert.equal(h.taxBefore.kind, 'value');
      assert.equal(h.ratesMissing, null);
      assert.ok(!h.labels.some((l) => l.startsWith(MISSING)));
      const { lots, facts } = makeLots(specs);
      assert.ok(rollupHoldings({ ...lots, asOn: ymdToDay(y, m, d)! }, facts).family.byClass.every((g) => g.ratesMissing === null));
    }
  });
});

describe('round 3 L1 and L2 (CHAT-012\'s Gate B of M7b): the family coverage and what the PARTIAL label names', () => {
  test('L1: the family figure is marked with its coverage when the only gap is a holding with an unknown gain', () => {
    // One client: Fund One split with a known long-term gain of 1,00,000, Fund Two split with no invested value (gain
    // unknown). The client's tax before is PARTIAL at coverage 1 known of 2 split holdings = 0.5 (round 2). The family
    // (one client) is PARTIAL with the same coverage, 0.5; before round 3 it carried the PARTIAL words but no coverage.
    const { clients, family } = run([
      { client: A, name: 'Sample Fund One', cls: 'equityMf', cmv: 300000, lt: 100000 },
      { client: A, name: 'Sample Fund Two', cls: 'equityMf', cmv: 200000, lt: null },
    ], ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } }));
    assert.equal((clients[0]!.taxBefore as { coverage?: number }).coverage, 0.5);
    assert.equal(family.unreconciled, 0);
    assert.equal(family.taxBefore.kind, 'value');
    assert.equal((family.taxBefore as { coverage?: number }).coverage, 0.5);
    assert.match((family.taxBefore as { prov: { method: string } }).prov.method, /PARTIAL COVERAGE: 1 holding with an unknown gain left out/);
  });
  test('L2: the PARTIAL and not-worked labels name each unreconciled kind by count', () => {
    // A: one split holding (long gain 1,00,000) and three unreconciled holdings: a merger candidate and two transfer rows.
    // B: one unreconciled holding only, a bonus row (no harvest worked). The labels say which kinds by count; before,
    // only "not split (unreconciled with the IRR file)".
    const { lots, facts } = makeLots([
      { client: A, name: 'Sample Fund One', cls: 'equityMf', cmv: 300000, lt: 100000 },
      { client: A, name: 'Sample Fund Two', cls: 'equityMf', cmv: 10000, status: 'unreconciled', gain: 1000 },
      { client: A, name: 'Sample Fund Three', cls: 'equityMf', cmv: 20000, status: 'unreconciled', gain: 2000 },
      { client: A, name: 'Sample Fund Four', cls: 'equityMf', cmv: 30000, status: 'unreconciled', gain: 3000 },
      { client: B, name: 'Sample Fund Five', cls: 'equityMf', cmv: 40000, status: 'unreconciled', gain: 4000 },
    ]);
    const kinds = ['mergerCandidate', 'transferRow', 'transferRow', 'bonusRow'] as const;
    lots.unreconciled.forEach((r, i) => { r.unreconciledKind = kinds[i]!; });
    const roll = rollupHoldings(lots, facts);
    const { clients, family } = buildHarvests(roll, ctxOf({ exemptionUsed: { [A]: 'unused-confirmed' } }));
    const a = clients.find((c) => c.clientLabel === A)!;
    const b = clients.find((c) => c.clientLabel === B)!;
    assert.ok(a.labels.includes('3 holdings not split (unreconciled with the IRR file: transfer row 2, merger candidate 1) left out (PARTIAL COVERAGE)'), JSON.stringify(a.labels));
    assert.match((a.taxBefore as { prov: { method: string } }).prov.method, /3 holdings not split \(unreconciled with the IRR file: transfer row 2, merger candidate 1\) left out of the pools/);
    assert.equal(b.notWorked, 'no holding of this client is split into long and short term (1 holding not split, unreconciled with the IRR file: bonus row 1), so no harvest is worked');
    assert.deepEqual(family.unreconciledKinds, { mergerCandidate: 1, transferRow: 2, bonusRow: 1 });
    assert.match((family.taxBefore as { prov: { method: string } }).prov.method, /4 holdings not split \(unreconciled with the IRR file: transfer row 2, bonus row 1, merger candidate 1\) left out/);
    const lt = roll.legacy.unrealised.lt;
    assert.match(lt.kind === 'value' ? lt.prov.method : '', /4 holdings not split \(unreconciled with the IRR file: transfer row 2, bonus row 1, merger candidate 1\) left out/);
  });
});

describe('round 4 S-1 (the financial review of 7c6c4e9; Q-49): slab-rate pools left out of the tax figures are marked', () => {
  // A slab-rate pool has no tax figure (PD-07: no slab arithmetic in the engine), so the tax before, tax after and saving
  // leave its gain out. Whenever such a pool exists, slab rate entered or not, those three are PARTIAL, their coverage
  // the share of the pools' gains at a rate, with the label "slab-rate gains of N pools not in the tax figures" naming
  // the pools. Before (7c6c4e9): a present figure with no mark; with a slab rate entered, no label either.
  const JAN25 = ymdToDay(2025, 1, 31)!;
  const ctx25 = (slab: number | null): HarvestContext => ({
    asOn: JAN25,
    inputs: { personYear: slab === null ? [] : [{ clientId: clientIdOf(A), fy: 2024, slabPct: slab, surchargePct: null, regime: null, assesseeMark: null }], exemptionUsed: [] },
    statement: null,
  });
  const cov = (v: Value<number>): number | undefined => (v.kind === 'value' ? v.coverage : undefined);
  const method = (v: Value<number>): string => (v.kind === 'value' ? v.prov.method : '');
  const amount = (v: Value<number>): number | null => (v.kind === 'value' ? v.v : null);
  const SLAB_ONE = 'slab-rate gains of 1 pool not in the tax figures';

  test('the review\'s slab probe (CHAT-012\'s Commodity ETF, short 3,000, as on 31 Jan 2025), with and without a slab rate entered: NOT AVAILABLE', () => {
    // The only pool is short term at the slab rate: none of its gain is in the tax figures (the tax at a 30% slab would
    // be 900). Round 4 S-3 (the delta review of 0b95ff3; as M1 and D-1): not Rs 0 at coverage 0 (S-1 as first built)
    // but NOT AVAILABLE, the reason naming the pool, for the client and the family; the label says NOT AVAILABLE.
    for (const slab of [null, 30]) {
      const { clients, family } = run([{ client: A, name: 'Sample Gold ETF', cls: 'commodityEtf', cmv: 13000, st: 3000, ltCmv: 0 }], ctx25(slab));
      const a = clients[0]!;
      for (const v of [a.taxBefore, a.taxAfter, a.saving, family.taxBefore, family.taxAfter, family.saving]) {
        assert.equal(v.kind, 'missing', `slab ${slab}`);
        assert.equal(v.kind === 'missing' ? v.status : '', STATUS.NOT_AVAILABLE);
        assert.match(v.kind === 'missing' ? v.reason : '', new RegExp(`^${SLAB_ONE}`), `slab ${slab}`);
      }
      for (const v of [a.taxBefore, a.taxAfter, a.saving]) assert.match(v.kind === 'missing' ? v.reason : '', /Commodity ETF, short term; every gain is at the slab rate/);
      assert.ok(a.labels.includes(`${SLAB_ONE}: Commodity ETF, short term (${STATUS.NOT_AVAILABLE})`), JSON.stringify(a.labels));
      assert.equal(a.figures.unquantifiedGain, 3000);
    }
  });

  test('a Sec. 76 debt fund beside an equity fund: the tax before is the equity fund\'s 2,000, PARTIAL at 10,000 / 11,500', () => {
    // As on 30 Sep 2026: equity short-term gain 10,000 at 20% = 2,000; the debt fund's short-term 1,500 is at the slab
    // rate, out of the figure. Coverage: gains at a rate 10,000 over all gains 11,500. Slab 30% entered.
    const { clients, family } = run([
      { client: A, name: 'Sample Flexi Cap Fund', cls: 'equityMf', cmv: 60000, st: 10000, ltCmv: 0 },
      { client: A, name: 'Sample Corporate Bond Fund', cls: 'debtMf', cmv: 11500, st: 1500, ltCmv: 0 },
    ], ctxOf({ slab: { [A]: 30 }, exemptionUsed: { [A]: 'unused-confirmed' } }));
    const a = clients[0]!;
    near(amount(a.taxBefore), 2000, 'tax before');
    for (const v of [a.taxBefore, a.taxAfter, a.saving, family.taxBefore]) {
      assert.ok(Math.abs((cov(v) ?? -1) - 10000 / 11500) < 1e-12, `coverage ${cov(v)}`);
      assert.match(method(v), new RegExp(SLAB_ONE));
    }
    assert.ok(a.labels.some((l) => l.startsWith(`${SLAB_ONE}: Debt Mutual Funds `) && l.endsWith(`Sec. 76 (old 50AA), short term (${STATUS.PARTIAL})`)), JSON.stringify(a.labels));
  });

  test('a client with no slab-rate pool is unchanged; beside one with such a pool, the family is PARTIAL by the gains share', () => {
    // A: equity short-term 10,000 (tax 2,000), no slab pool: no mark, no label, as before. B: a debt fund short-term 1,500
    // only: NOT AVAILABLE (round 4 S-3; it read 0 at coverage 0 as S-1 was first built). The family: gains at a rate
    // 10,000 of 11,500.
    const { clients, family } = run([
      { client: A, name: 'Sample Flexi Cap Fund', cls: 'equityMf', cmv: 60000, st: 10000, ltCmv: 0 },
      { client: B, name: 'Sample Corporate Bond Fund', cls: 'debtMf', cmv: 11500, st: 1500, ltCmv: 0 },
    ], ctxOf({ slab: { [A]: 30, [B]: 30 }, exemptionUsed: { [A]: 'unused-confirmed', [B]: 'unused-confirmed' } }));
    const a = clients.find((c) => c.clientLabel === A)!;
    const b = clients.find((c) => c.clientLabel === B)!;
    for (const v of [a.taxBefore, a.taxAfter, a.saving]) {
      assert.equal(cov(v), undefined);
      assert.ok(!/slab-rate gains/.test(method(v)), method(v));
    }
    near(amount(a.taxBefore), 2000, 'A tax before');
    assert.ok(!a.labels.some((l) => /slab-rate gains of/.test(l)), JSON.stringify(a.labels));
    assert.equal(b.taxBefore.kind, 'missing');
    near(amount(family.taxBefore), 2000, 'family tax before');
    assert.ok(Math.abs((cov(family.taxBefore) ?? -1) - 10000 / 11500) < 1e-12, `family coverage ${cov(family.taxBefore)}`);
    assert.match(method(family.taxBefore), new RegExp(`${STATUS.PARTIAL}: ${SLAB_ONE}`));
  });
});

describe('round 4 S-1 with another gap: the smaller coverage, both named', () => {
  test('a slab-rate pool and a holding unreconciled with the IRR file: coverage 2/3 (holdings), not 10,000 / 11,500 (gains)', () => {
    // A: equity short-term 10,000 and a debt fund short-term 1,500 (split), and one holding unreconciled (gain 1,000).
    // Holdings coverage: 2 split over 3 = 2/3; gains coverage: 10,000 / 11,500. The figure carries the smaller, and its
    // method names both gaps.
    const { lots, facts } = makeLots([
      { client: A, name: 'Sample Flexi Cap Fund', cls: 'equityMf', cmv: 60000, st: 10000, ltCmv: 0 },
      { client: A, name: 'Sample Corporate Bond Fund', cls: 'debtMf', cmv: 11500, st: 1500, ltCmv: 0 },
      { client: A, name: 'Sample Midcap Fund', cls: 'equityMf', cmv: 11000, status: 'unreconciled', gain: 1000 },
    ]);
    lots.unreconciled.forEach((r) => { r.unreconciledKind = 'transferRow'; });
    const { clients, family } = buildHarvests(rollupHoldings(lots, facts), ctxOf({ slab: { [A]: 30 }, exemptionUsed: { [A]: 'unused-confirmed' } }));
    for (const v of [clients[0]!.taxBefore, family.taxBefore]) {
      assert.ok(v.kind === 'value' && Math.abs((v.coverage ?? -1) - 2 / 3) < 1e-12, JSON.stringify(v));
      assert.match(v.kind === 'value' ? v.prov.method : '', /1 holding not split \(unreconciled with the IRR file: transfer row 1\) left out.*; slab-rate gains of 1 pool not in the tax figures/);
    }
  });
});

describe('round 4 S-3 (the delta review of 0b95ff3; Q-49): an all-slab harvest is NOT AVAILABLE; a mixed one stays PARTIAL', () => {
  test('the review\'s mixed case (3,750 at 0.857) is unchanged beside a client whose every gain is at the slab rate', () => {
    // A: a Sec. 76 debt fund short-term 5,000 (slab) and an equity fund long-term 30,000; slab 30% entered, nothing
    // entered on the exemption ("exemption not applied"): tax before 30,000 x 12.5% = 3,750, PARTIAL at 30,000 / 35,000.
    // B: a debt fund short-term 2,000 only: NOT AVAILABLE with the pool named (0b95ff3: Rs 0 at coverage 0). The family:
    // 3,750, PARTIAL at 30,000 / 37,000 (only B's figure is not worked out; A's stands).
    const { clients, family } = run([
      { client: A, name: 'Sample Corporate Bond Fund', cls: 'debtMf', cmv: 25000, st: 5000, ltCmv: 0 },
      { client: A, name: 'Sample Flexi Cap Fund', cls: 'equityMf', cmv: 130000, lt: 30000 },
      { client: B, name: 'Sample Banking and PSU Fund', cls: 'debtMf', cmv: 22000, st: 2000, ltCmv: 0 },
    ], ctxOf({ slab: { [A]: 30, [B]: 30 } }));
    const a = clients.find((c) => c.clientLabel === A)!;
    const b = clients.find((c) => c.clientLabel === B)!;
    for (const v of [a.taxBefore, a.taxAfter]) {
      assert.ok(v.kind === 'value' && Math.abs(v.v - 3750) <= 0.01 && Math.abs((v.coverage ?? -1) - 30000 / 35000) < 1e-12, JSON.stringify(v));
    }
    assert.ok(a.saving.kind === 'value' && Math.abs((a.saving.coverage ?? -1) - 30000 / 35000) < 1e-12);
    for (const v of [b.taxBefore, b.taxAfter, b.saving]) {
      assert.ok(v.kind === 'missing' && v.status === STATUS.NOT_AVAILABLE && /^slab-rate gains of 1 pool not in the tax figures: Debt Mutual Funds /.test(v.reason), JSON.stringify(v));
    }
    assert.ok(b.labels.some((l) => l.startsWith('slab-rate gains of 1 pool not in the tax figures') && l.endsWith(`(${STATUS.NOT_AVAILABLE})`)), JSON.stringify(b.labels));
    const f = family.taxBefore;
    assert.ok(f.kind === 'value' && Math.abs(f.v - 3750) <= 0.01 && Math.abs((f.coverage ?? -1) - 30000 / 37000) < 1e-12, JSON.stringify(f));
    assert.match(f.kind === 'value' ? f.prov.method : '', /slab-rate gains of 2 pools not in the tax figures/);
  });
});
