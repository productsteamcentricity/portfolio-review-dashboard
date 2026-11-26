// covers: E-43 KI-007 OD-7 D-040
// The holdings tax roll-ups (app/src/engine/tax/holdings-rollup.ts, NB-M7a S4b): the port of the live taxRollup and
// summarise, hand-worked on synthetic records (tests/fixtures/make-tax-positions.ts). Money in rupees.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { gainValue, rollupHoldings } from '../../../app/src/engine/tax/holdings-rollup.ts';
import type { HoldingsTaxRollup } from '../../../app/src/engine/tax/holdings-rollup.ts';
import { INST } from '../../../app/src/engine/tax/classify.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { clientIdOf, makeLots } from '../../fixtures/make-tax-positions.ts';
import type { PositionSpec } from '../../fixtures/make-tax-positions.ts';

const A = 'Sample Client A';
const B = 'Sample Client B';
const PROV = { sources: [], method: 'test' };

// Client A: two equity funds (one losing), a corporate bond fund split at 1 Apr 2023 (two records of one holding), a
// Category III AIF (fund level), a PMS (not split). Client B: an equity fund with an unknown gain, an unreconciled
// fund, an unmapped fund with a blank asset.
const SPECS: PositionSpec[] = [
  { client: A, name: 'Sample Large Cap Fund', cls: 'equityMf', cmv: 500000, lt: 100000 },
  { client: A, name: 'Sample Mid Cap Fund', cls: 'equityMf', cmv: 200000, lt: -30000, st: 5000, ltCmv: 150000 },
  { client: A, name: 'Sample Corporate Bond Fund', cls: 'debtMf', cmv: 60000, st: 6000, splitPart: 'from-2023', id: 'holding:bond', asset: 'Debt' },
  { client: A, name: 'Sample Corporate Bond Fund', cls: 'debtMf', cmv: 40000, lt: 4000, splitPart: 'pre-2023', id: 'holding:bond', asset: 'Debt' },
  { client: A, name: 'Sample Long Short AIF', cls: 'equityAif3LongShort', cmv: 300000, notSplit: 'fund-level', gain: 20000, product: 'AIF' },
  { client: A, name: 'Sample Value PMS', cls: 'equityPms', cmv: 250000, notSplit: 'per-security', gain: -10000, product: 'PMS' },
  { client: B, name: 'Sample Flexi Cap Fund', cls: 'equityMf', cmv: 120000, lt: null },
  { client: B, name: 'Sample Focused Fund', cls: 'equityMf', cmv: 80000, status: 'unreconciled', gain: 8000 },
  { client: B, name: 'Sample Balanced Advantage Fund', cls: 'equityMf', cmv: 50000, status: 'unmapped', gain: -2000, asset: null, assetLabel: null },
];

function build(specs: readonly PositionSpec[] = SPECS): HoldingsTaxRollup {
  const { lots, facts } = makeLots(specs);
  return rollupHoldings(lots, facts);
}

describe('summarise: the family totals', () => {
  const t = build().family.totals;
  test('CMV: every record, unreconciled and unmapped included', () => {
    // 5,00,000 + 2,00,000 + 60,000 + 40,000 + 3,00,000 + 2,50,000 + 1,20,000 + 80,000 + 50,000 = 16,00,000.
    assert.equal(t.cmv, 1600000);
    // LT: 5,00,000 + 1,50,000 + 40,000 = 6,90,000 (the B fund with an unknown gain is long term: + 1,20,000 = 8,10,000).
    assert.equal(t.lt.cmv, 810000);
    // ST: 50,000 + 60,000 = 1,10,000. Unclassified: PMS 2,50,000 + unreconciled 80,000 + unmapped 50,000 = 3,80,000.
    assert.equal(t.st.cmv, 110000);
    assert.equal(t.unclassified.cmv, 380000);
    assert.equal(t.fundLevel.cmv, 300000);
    assert.equal(t.lt.cmv + t.st.cmv + t.unclassified.cmv + t.fundLevel.cmv, t.cmv, 'long + short + unclassified + fund level = CMV');
  });
  test('gains: the known sum, with the holding of unknown gain counted (KI-007, never 0)', () => {
    // Known: 1,00,000 - 25,000 + 6,000 + 4,000 + 20,000 - 10,000 + 8,000 - 2,000 = 1,01,000; one holding unknown.
    assert.equal(t.gain.known, 101000);
    assert.equal(t.gain.unknown, 1);
    assert.equal(t.gainMissing, 1);
    // LT known 1,00,000 - 30,000 + 4,000 = 74,000 (B's fund unknown); ST 5,000 + 6,000 = 11,000.
    assert.deepEqual(t.lt.gain, { known: 74000, holdings: 4, unknown: 1 });
    assert.deepEqual(t.st.gain, { known: 11000, holdings: 3, unknown: 0 });
    // Unclassified: split records 0, PMS -10,000, unreconciled 8,000, unmapped -2,000 = -4,000.
    assert.equal(t.unclassified.gain.known, -4000);
    assert.equal(t.fundLevel.gain.known, 20000);
  });
  test('not split and holding counts (a split holding counted once)', () => {
    assert.equal(t.notSplit['fund-level'].n, 1);
    assert.equal(t.notSplit['per-security'].n, 1);
    assert.equal(t.notSplit['per-security'].gain.known, -10000);
    assert.equal(t.nPos, 6, 'positions: 7 records, the bond fund once');
    assert.equal(t.nHold, 8);
  });
});

describe('byClass pools per position', () => {
  const fam = build().family;
  test('a losing holding inside a class that nets positive is pooled as a loss', () => {
    const eq = fam.byClass.find((c) => c.cls === INST.equityMf)!;
    // LT: +1,00,000 and -30,000 apart (not netted to 70,000); ST +5,000; B's unknown-gain fund kept out.
    assert.equal(eq.ltPos, 100000);
    assert.equal(eq.ltNeg, 30000);
    assert.equal(eq.stPos, 5000);
    assert.equal(eq.stNeg, 0);
    assert.equal(eq.gainUnknown, 1);
    assert.equal(eq.rule?.sec198, true);
  });
  test('unsplit classes are never pooled; classes sorted by CMV', () => {
    for (const c of fam.byClass.filter((x) => x.notSplit !== null)) assert.equal(c.ltPos + c.ltNeg + c.stPos + c.stNeg, 0);
    const cmvs = fam.byClass.map((c) => c.cmv);
    assert.deepEqual(cmvs, [...cmvs].sort((a, b) => b - a));
    // The bond fund's two records are one class, n counts records (as the live).
    assert.equal(fam.byClass.find((c) => c.cls === INST.debtMf)!.n, 2);
  });
});

describe('taxRollup: by product and by asset', () => {
  const fam = build().family;
  test('by product, sorted by CMV, the split holding counted once', () => {
    assert.deepEqual(fam.byProduct.map((g) => [g.key, g.cmv, g.n]), [['Mutual Funds', 1050000, 6], ['AIF', 300000, 1], ['PMS', 250000, 1]]);
    const mf = fam.byProduct[0]!;
    assert.equal(mf.fundGain.known, 0);
    assert.equal(fam.byProduct[1]!.fundGain.known, 20000);
    assert.equal(fam.byProduct[2]!.unclassGain.known, -10000);
  });
  test('a blank asset is "(unspecified)", never Equity (OD-7)', () => {
    // Equity: 5,00,000 + 2,00,000 + 3,00,000 + 2,50,000 + 1,20,000 + 80,000 = 14,50,000; Debt: the bond fund 1,00,000.
    assert.deepEqual(fam.byAsset.map((g) => [g.key, g.cmv]), [['Equity', 1450000], ['Debt', 100000], ['(unspecified)', 50000]]);
  });
});

describe('clients add back to the family; legacy figures', () => {
  const r = build();
  test('per client, largest CMV first; the family is their sum', () => {
    assert.deepEqual(r.clients.map((c) => c.clientId), [clientIdOf(A), clientIdOf(B)]);
    assert.equal(r.clients.reduce((s, c) => s + c.totals.cmv, 0), r.family.totals.cmv);
    assert.equal(r.clients.reduce((s, c) => s + c.totals.gain.known, 0), r.family.totals.gain.known);
    assert.equal(r.clients[1]!.clientLabel, B);
    assert.equal(r.unnamedN, 0);
  });
  test('tax.unrealised.{st,lt}: st present, lt PARTIAL with the count', () => {
    const { st, lt } = r.legacy.unrealised;
    assert.equal(st.kind, 'value');
    assert.equal(st.kind === 'value' && st.v, 11000);
    assert.equal(lt.kind, 'value');
    assert.equal(lt.kind === 'value' && lt.v, 74000);
    assert.equal(lt.kind === 'value' && lt.coverage, 0.75);
    assert.match(lt.kind === 'value' ? lt.prov.method : '', /PARTIAL COVERAGE: 1 holding of 4/);
  });
  test('gainValue: NOT AVAILABLE when every gain is unknown', () => {
    const v = gainValue({ known: 0, holdings: 2, unknown: 2 }, PROV);
    assert.equal(v.kind, 'missing');
    assert.equal(v.kind === 'missing' && v.status, STATUS.NOT_AVAILABLE);
    assert.deepEqual(gainValue({ known: 5, holdings: 1, unknown: 0 }, PROV), { kind: 'value', v: 5, unit: 'inr', prov: PROV });
  });
  test('holdings without a client are one group', () => {
    const x = build([{ client: null, name: 'Sample Fund', cls: 'equityMf', cmv: 1000, lt: 100 }, ...SPECS.slice(0, 1)]);
    assert.equal(x.unnamedN, 1);
    assert.ok(x.clients.some((c) => c.clientId === null && c.clientLabel === null));
  });
});
