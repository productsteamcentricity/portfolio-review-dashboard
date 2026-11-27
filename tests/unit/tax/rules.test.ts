// covers: E-154 E-106 E-144 (dated tax-rule table v1, design capital-gains-upload.md §10)
// The dated tax-rule table (data/owner/tax-rules.json) and its lookups (app/src/engine/tax/rules.ts), design §9.1, §9.2,
// §10.1 to §10.7 and §14. Every expected value here is typed from the design text, not read from the JSON, so the test
// checks the transcription: DESIGN_ROWS is §10.1, the CII tables are §10.3, the year tables are §10.2 and §10.7, the
// category list is §10.5a. An oracle over DESIGN_ROWS (its own date arithmetic) gives the expected row of every key,
// and the engine must agree with it on every boundary date and on every sale day from 2004-09-25 to 2027-04-05.
// The last block is the I-21 agreement test (PLAN-03 P5): for a sale in tax year 2026-27, every mutual-fund row of the
// live table data/refdata/TAX_RULES.json gives the same rates and holding period as table v1.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TAX_RULES_V1 as T, anniversaryOf, categoryDefaultClass, cessRateFor, checksFor, ciiOf, exemptionFor, financialYearOf,
  fundTypeOfCategory, indexationSeriesFor, indexedCost, loadTaxRules, normaliseCategoryName, ruleFor, surchargeCapFor,
  surchargeMaxFor,
} from '../../../app/src/engine/tax/rules.ts';
import type { RuleKey, RuleResult, SubType, TaxRule } from '../../../app/src/engine/tax/rules.ts';
import type { TaxClass } from '../../../app/src/model/tax.ts';
import { dayToIso, ymdToDay } from '../../../app/src/engine/dates.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/owner/tax-rules.json'), 'utf8')) as Record<string, unknown>;

// ---------------------------------------------------------------------------------------------------------------
// Test-side date arithmetic on ISO strings (independent of the engine)

const pad = (n: number): string => String(n).padStart(2, '0');
const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysIn = (y: number, m: number): number => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
/** N calendar months later (N may be negative), the day clamped to the month's last day. */
function shiftMonths(iso: string, months: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const idx = y * 12 + (m - 1) + months;
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return `${yy}-${pad(mm)}-${pad(Math.min(d, daysIn(yy, mm)))}`;
}
function day(iso: string): number {
  const d = ymdToDay(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)));
  assert.notEqual(d, null, `test date ${iso}`);
  return d!;
}
const plusDays = (iso: string, n: number): string => dayToIso(day(iso) + n);

// ---------------------------------------------------------------------------------------------------------------
// §10.1 typed from the design

type C = 'EO' | 'SP' | 'ON';
const CLASS: Record<C, TaxClass> = { EO: 'equity-oriented', SP: 'specified-mf', ON: 'other-non-equity' };
type Win = [string | null, string | null];
const ANY: Win = [null, null];
const SP_BEFORE_2023: Win = [null, '2023-03-31'];
interface DesignRow {
  id: string;
  sale: [string, string | null];
  purchase: Partial<Record<C, Win>>;
  term: 'short' | 'long' | 'deemed-short';
  months: number | null;
  rate: number | 'slab' | 'exempt' | 'two-leg' | null;
  basis: string | null;
  listed: 'listed' | 'unlisted' | 'any';
}
const EQ = (id: string, from: string, to: string | null, purchase: Win, term: 'short' | 'long', rate: DesignRow['rate'], basis: string | null): DesignRow =>
  ({ id, sale: [from, to], purchase: { EO: purchase }, term, months: 12, rate, basis, listed: 'any' });
const NE = (id: string, from: string, to: string | null, sp: Win, term: 'short' | 'long', months: number, rate: DesignRow['rate'], basis: string, listed: DesignRow['listed']): DesignRow =>
  ({ id, sale: [from, to], purchase: { SP: sp, ON: ANY }, term, months, rate, basis, listed });
const AA = (id: string, from: string, to: string | null): DesignRow =>
  ({ id, sale: [from, to], purchase: { SP: ['2023-04-01', null] }, term: 'deemed-short', months: null, rate: 'slab', basis: 'actual', listed: 'any' });

const GF_TO: Win = [null, '2018-01-31'];
const GF_FROM: Win = ['2018-02-01', null];
const DESIGN_ROWS: DesignRow[] = [
  EQ('EQ-ST-1', '2004-10-01', '2008-03-31', ANY, 'short', 0.10, 'actual'),
  EQ('EQ-ST-2', '2008-04-01', '2024-07-22', ANY, 'short', 0.15, 'actual'),
  EQ('EQ-ST-3', '2024-07-23', '2026-03-31', ANY, 'short', 0.20, 'actual'),
  EQ('EQ-ST-4', '2026-04-01', null, ANY, 'short', 0.20, 'actual'),
  EQ('EQ-LT-1', '2004-10-01', '2018-03-31', ANY, 'long', 'exempt', 'none'),
  EQ('EQ-LT-2', '2018-04-01', '2024-03-31', GF_TO, 'long', 0.10, 'grandfathered'),
  EQ('EQ-LT-3', '2018-04-01', '2024-03-31', GF_FROM, 'long', 0.10, 'actual'),
  EQ('EQ-LT-4', '2024-04-01', '2024-07-22', GF_TO, 'long', 0.10, 'grandfathered'),
  EQ('EQ-LT-5', '2024-04-01', '2024-07-22', GF_FROM, 'long', 0.10, 'actual'),
  EQ('EQ-LT-6', '2024-07-23', '2026-03-31', GF_TO, 'long', 0.125, 'grandfathered'),
  EQ('EQ-LT-7', '2024-07-23', '2026-03-31', GF_FROM, 'long', 0.125, 'actual'),
  EQ('EQ-LT-8', '2026-04-01', null, GF_TO, 'long', 0.125, 'grandfathered'),
  EQ('EQ-LT-9', '2026-04-01', null, GF_FROM, 'long', 0.125, 'actual'),
  EQ('EQ-FOF-1', '2018-04-01', '2019-03-31', ANY, 'short', 'slab', 'actual'),
  EQ('EQ-FOF-2', '2018-04-01', '2019-03-31', ANY, 'long', null, null),
  NE('NE-ST-1', '2004-10-01', '2014-07-10', ANY, 'short', 12, 'slab', 'actual', 'any'),
  NE('NE-LT-1', '2004-10-01', '2014-07-10', ANY, 'long', 12, 'two-leg', 'per-leg', 'any'),
  NE('NE-ST-2', '2014-07-11', '2024-07-22', SP_BEFORE_2023, 'short', 36, 'slab', 'actual', 'any'),
  NE('NE-LT-2', '2014-07-11', '2017-03-31', ANY, 'long', 36, 0.20, 'indexed-1981', 'any'),
  NE('NE-LT-3', '2017-04-01', '2024-07-22', SP_BEFORE_2023, 'long', 36, 0.20, 'indexed-2001', 'any'),
  NE('NE-ST-3', '2024-07-23', '2026-03-31', SP_BEFORE_2023, 'short', 24, 'slab', 'actual', 'unlisted'),
  NE('NE-ST-3L', '2024-07-23', '2026-03-31', SP_BEFORE_2023, 'short', 12, 'slab', 'actual', 'listed'),
  NE('NE-LT-4', '2024-07-23', '2026-03-31', SP_BEFORE_2023, 'long', 24, 0.125, 'actual', 'unlisted'),
  NE('NE-LT-4L', '2024-07-23', '2026-03-31', SP_BEFORE_2023, 'long', 12, 0.125, 'actual', 'listed'),
  NE('NE-ST-4', '2026-04-01', null, SP_BEFORE_2023, 'short', 24, 'slab', 'actual', 'unlisted'),
  NE('NE-ST-4L', '2026-04-01', null, SP_BEFORE_2023, 'short', 12, 'slab', 'actual', 'listed'),
  NE('NE-LT-5', '2026-04-01', null, SP_BEFORE_2023, 'long', 24, 0.125, 'actual', 'unlisted'),
  NE('NE-LT-5L', '2026-04-01', null, SP_BEFORE_2023, 'long', 12, 0.125, 'actual', 'listed'),
  AA('NE-50AA-1', '2023-04-01', '2025-03-31'),
  AA('NE-50AA-2', '2025-04-01', '2026-03-31'),
  AA('NE-50AA-3', '2026-04-01', null),
];
/** "How to read it": for FY 2018-19 sales the 90/90 sub-type selects EQ-FOF-1 and EQ-FOF-2 in place of these three. */
const NOT_9090_IN_FY_2018_19 = new Set(['EQ-ST-2', 'EQ-LT-2', 'EQ-LT-3']);

// ---------------------------------------------------------------------------------------------------------------
// The oracle: §9.1 and §10 "How to read it" over DESIGN_ROWS

interface IsoKey { cls: C; listed: boolean | null; sub: SubType; p: string; s: string }

function designSubTypeTakes(r: DesignRow, sub: SubType, s: string): boolean {
  if (r.id.startsWith('EQ-FOF')) return sub === 'etf-fof-90-90';
  if (sub === 'etf-fof-90-90' && NOT_9090_IN_FY_2018_19.has(r.id) && s >= '2018-04-01' && s <= '2019-03-31') return false;
  return true;
}
function designValid(k: IsoKey): boolean {
  if (k.sub === 'elss' && k.cls !== 'EO') return false;
  if (k.sub === 'etf-fof-90-90') {
    if (k.cls === 'SP') return false;
    if (k.cls === 'EO' && k.s < '2018-04-01') return false;
    if (k.cls === 'ON' && k.s >= '2018-04-01') return false;
  }
  if (k.listed === null && k.cls === 'EO') return false;
  return true;
}
type OracleHit = { id: string; term: 'short' | 'long'; deemed: boolean } | { error: string };
function oracleResolve(k: IsoKey, listed: boolean): OracleHit {
  const hits: { id: string; term: 'short' | 'long'; deemed: boolean }[] = [];
  for (const r of DESIGN_ROWS) {
    const w = r.purchase[k.cls];
    if (w === undefined) continue;
    if (k.s < r.sale[0] || (r.sale[1] !== null && k.s > r.sale[1])) continue;
    if ((w[0] !== null && k.p < w[0]) || (w[1] !== null && k.p > w[1])) continue;
    if (!designSubTypeTakes(r, k.sub, k.s)) continue;
    if ((r.listed === 'listed' && !listed) || (r.listed === 'unlisted' && listed)) continue;
    if (r.term === 'deemed-short') { hits.push({ id: r.id, term: 'short', deemed: true }); continue; }
    const isLong = k.s > shiftMonths(k.p, r.months!);
    if ((r.term === 'long') === isLong) hits.push({ id: r.id, term: r.term, deemed: false });
  }
  return hits.length === 1 ? hits[0]! : { error: `ORACLE found ${hits.length} rows: ${hits.map((h) => h.id).join(',')}` };
}
function oracle(k: IsoKey): string {
  if (k.p > k.s) return 'none:purchase-after-sale';
  if (k.s < '2004-10-01') return 'none:outside-rule-table';
  if (!designValid(k)) return 'none:invalid-key';
  if (k.listed !== null) {
    const h = oracleResolve(k, k.listed);
    return 'error' in h ? h.error : `${h.id}/${h.term}/given`;
  }
  const u = oracleResolve(k, false);
  const l = oracleResolve(k, true);
  if ('error' in u) return u.error;
  if ('error' in l) return l.error;
  if (u.id === l.id) return `${u.id}/${u.term}/missing-not-needed`;
  if (u.term === l.term && u.deemed === l.deemed) return `${u.id}/${u.term}/missing-same-either-way`;
  return 'none:listed-flag-missing';
}
const toKey = (k: IsoKey): RuleKey => ({ taxClass: CLASS[k.cls], listed: k.listed, subType: k.sub, purchaseDay: day(k.p), saleDay: day(k.s) });
const outcome = (r: RuleResult): string => (r.kind === 'rule' ? `${r.rule.id}/${r.term}/${r.listedFlag}` : `none:${r.reason}`);
const engine = (k: IsoKey): string => outcome(ruleFor(T, toKey(k)));
const idOf = (cls: C, listed: boolean | null, sub: SubType, p: string, s: string): string => {
  const r = ruleFor(T, toKey({ cls, listed, sub, p, s }));
  return r.kind === 'rule' ? r.rule.id : `none:${r.reason}`;
};

const CLASSES: C[] = ['EO', 'SP', 'ON'];
const LISTED: (boolean | null)[] = [true, false, null];
const SUBS: SubType[] = ['none', 'elss', 'etf-fof-90-90'];
const FIXED_PURCHASES = ['1975-06-01', '1990-04-01', '2001-05-01', '2004-02-29', '2014-07-10', '2017-03-31', '2018-01-31', '2018-02-01', '2023-03-31', '2023-04-01', '2024-02-29'];
function purchasesFor(s: string): string[] {
  const out = [s, plusDays(s, -1), plusDays(s, 1)];
  for (const n of [12, 24, 36]) { const a = shiftMonths(s, -n); out.push(a, plusDays(a, -1), plusDays(a, 1)); }
  return out.concat(FIXED_PURCHASES);
}

// ---------------------------------------------------------------------------------------------------------------

describe('table v1: the file and its loader', () => {
  test('version, approval date, indicative label', () => {
    assert.equal(T.version, 'v1');
    assert.equal(dayToIso(T.approved), '2026-10-27');
    assert.equal(T.indicative, true);
    assert.equal(dayToIso(T.coverageFrom), '2004-10-01');
  });

  test('the 31 rate rows of §10.1, in order, transcribed field by field', () => {
    assert.deepEqual(T.rules.map((r) => r.id), DESIGN_ROWS.map((r) => r.id));
    assert.equal(T.rules.length, 31);
    for (const d of DESIGN_ROWS) {
      const r = T.rules.find((x) => x.id === d.id)!;
      const msg = d.id;
      assert.equal(dayToIso(r.saleFrom), d.sale[0], `${msg} sale from`);
      assert.equal(r.saleTo === null ? null : dayToIso(r.saleTo), d.sale[1], `${msg} sale to`);
      assert.deepEqual([...r.classes].sort(), Object.keys(d.purchase).map((c) => CLASS[c as C]).sort(), `${msg} classes`);
      for (const [c, w] of Object.entries(d.purchase) as [C, Win][]) {
        const pw = r.purchase[CLASS[c]]!;
        assert.deepEqual([pw.from === null ? null : dayToIso(pw.from), pw.to === null ? null : dayToIso(pw.to)], w, `${msg} purchase ${c}`);
      }
      assert.equal(r.term, d.term, `${msg} term`);
      assert.equal(r.holdingMonths, d.months, `${msg} months`);
      assert.equal(r.rate, d.rate, `${msg} rate`);
      assert.equal(r.costBasis, d.basis, `${msg} cost basis`);
      assert.equal(r.listed, d.listed, `${msg} listed`);
    }
  });

  test('sub-types: EQ-FOF rows only for 90/90; EQ-ST-2, EQ-LT-2, EQ-LT-3 not for 90/90 in FY 2018-19', () => {
    for (const r of T.rules) {
      if (r.id.startsWith('EQ-FOF')) assert.deepEqual(r.subTypes, ['etf-fof-90-90'], r.id);
      const ex = r.subTypeExclusions.map((x) => `${x.subType} ${dayToIso(x.sale.from!)} ${dayToIso(x.sale.to!)}`);
      assert.deepEqual(ex, NOT_9090_IN_FY_2018_19.has(r.id) ? ['etf-fof-90-90 2018-04-01 2019-03-31'] : [], r.id);
    }
  });

  test('NE-LT-1: the 20% indexed leg on the 1981 series and the 10% actual leg, lower per lot', () => {
    const r = T.rules.find((x) => x.id === 'NE-LT-1')!;
    assert.deepEqual(r.legs, [{ rate: 0.20, costBasis: 'indexed-1981' }, { rate: 0.10, costBasis: 'actual' }]);
    assert.match(r.legChoice ?? '', /per lot/);
  });

  test('EQ-FOF-2 is to be confirmed: no rate, no cost basis', () => {
    const r = T.rules.find((x) => x.id === 'EQ-FOF-2')!;
    assert.equal(r.toBeConfirmed, true);
    assert.equal(r.rate, null);
    assert.equal(r.costBasis, null);
    assert.equal(T.rules.filter((x) => x.toBeConfirmed).map((x) => x.id).join(), 'EQ-FOF-2');
  });

  test('annual exemption groups and surcharge categories of the rows', () => {
    const group = (id: string): string | null => T.rules.find((x) => x.id === id)!.exemptionGroup;
    assert.equal(group('EQ-LT-1'), 's10-38');
    for (const id of ['EQ-LT-2', 'EQ-LT-3', 'EQ-LT-4', 'EQ-LT-5', 'EQ-LT-6', 'EQ-LT-7']) assert.equal(group(id), 's112a', id);
    for (const id of ['EQ-LT-8', 'EQ-LT-9']) assert.equal(group(id), 's198', id);
    for (const r of T.rules) if (!r.id.startsWith('EQ-LT')) assert.equal(r.exemptionGroup, null, r.id);
    for (const r of T.rules) if (r.rate === 'slab') assert.equal(r.surchargeCategory, 'slab', r.id);
  });

  test('the checks: EQ-ELSS-1 is a check, never a rate row', () => {
    assert.deepEqual(T.checks.map((c) => c.id), ['EQ-ELSS-1']);
    const c = T.checks[0]!;
    assert.equal(c.lockInMonths, 36);
    assert.equal(c.warning, 'capital-gains.elss-early-sale');
    assert.equal(c.keepsRateRow, true);
    assert.equal(c.subType, 'elss');
    assert.equal(T.rules.some((r) => r.id === 'EQ-ELSS-1'), false);
  });

  test('the loader refuses a malformed file and names the place', () => {
    const bad = (mutate: (j: any) => void, pattern: RegExp): void => {
      const j = structuredClone(RAW) as any;
      mutate(j);
      assert.throws(() => loadTaxRules(j), pattern);
    };
    assert.throws(() => loadTaxRules(null), /tax-rules\.json: \(root\): expected an object/);
    assert.throws(() => loadTaxRules([]), /expected an object/);
    bad((j) => { delete j.rules; }, /rules: expected an array/);
    bad((j) => { j.rules[0].saleFrom = '2024-02-30'; }, /rules\[0\] \(EQ-ST-1\)\.saleFrom: 2024-02-30 is not a calendar date/);
    bad((j) => { j.rules[0].saleTo = '31 Mar 2008'; }, /expected an ISO date/);
    bad((j) => { j.rules[0].classes = ['equity']; }, /classes\[0\]: expected one of/);
    bad((j) => { j.rules[1].id = 'EQ-ST-1'; }, /duplicate rule id EQ-ST-1/);
    bad((j) => { j.rules[0].rate = null; }, /a null rate needs toBeConfirmed: true/);
    bad((j) => { j.rules[0].rate = 10; }, /not a fraction/);
    bad((j) => { j.rules[0].holdingMonths = 18; }, /expected 12, 24 or 36/);
    bad((j) => { j.rules[28].holdingMonths = 12; }, /deemed short-term row has no holding period/);
    bad((j) => { delete j.rules[15].purchase['other-non-equity']; }, /no purchase window for other-non-equity/);
    bad((j) => { j.rules[0].saleFrom = '2004-09-01'; }, /before the coverage start/);
    bad((j) => { j.cii.base1981.values['2015'] = null; }, /a null index must be listed in toBeConfirmed/);
    bad((j) => { delete j.cii.base2001.values['2010']; }, /no entry for FY starting 2010/);
    bad((j) => { j.cess.years[1].fyFrom = 2008; }, /not contiguous/);
    bad((j) => { j.surcharge.onward.max = 0.37; }, /expected max null with toBeConfirmed/);
    bad((j) => { j.exemptions.years.splice(3, 1); }, /no entry for FY starting 2007/);
    bad((j) => { j.categoryDefaults.entries[1].names.push('Large Cap Fund'); }, /already a key of another entry/);
    bad((j) => { j.categoryDefaults.entries[0].fundType = 'equity'; }, /unknown fund type equity/);
    bad((j) => { j.indicative = false; }, /must be labelled indicative/);
  });

  test('the file holds no en or em dash (D-029)', () => {
    const text = fs.readFileSync(path.join(ROOT, 'data/owner/tax-rules.json'), 'utf8');
    assert.equal(text.includes(String.fromCharCode(0x2013)), false);
    assert.equal(text.includes(String.fromCharCode(0x2014)), false);
  });
});

describe('the rule key maps to exactly one row (§9.1, §14)', () => {
  test('every rate row by its boundary dates: the day before, the day, the last day, the day after', () => {
    /* EQ-LT-3 (units bought from 2018-02-01) cannot be long term before 2019-02-02: its first feasible sale day. */
    const firstFeasible: Record<string, string> = { 'EQ-LT-3': '2019-02-02' };
    let compared = 0;
    for (const r of DESIGN_ROWS) {
      const dates: { s: string; mayHold: boolean; mustHold: boolean }[] = [
        { s: plusDays(r.sale[0], -1), mayHold: false, mustHold: false },
        { s: r.sale[0], mayHold: true, mustHold: firstFeasible[r.id] === undefined },
      ];
      if (firstFeasible[r.id] !== undefined) dates.push({ s: firstFeasible[r.id]!, mayHold: true, mustHold: true }, { s: plusDays(firstFeasible[r.id]!, -1), mayHold: false, mustHold: false });
      if (r.sale[1] !== null) dates.push({ s: r.sale[1], mayHold: true, mustHold: true }, { s: plusDays(r.sale[1], 1), mayHold: false, mustHold: false });
      for (const { s, mayHold, mustHold } of dates) {
        let held = false;
        for (const cls of CLASSES) for (const listed of LISTED) for (const sub of SUBS) for (const p of purchasesFor(s)) {
          const k: IsoKey = { cls, listed, sub, p, s };
          const got = engine(k);
          assert.equal(got, oracle(k), `${r.id} on ${s}: ${JSON.stringify(k)}`);
          compared++;
          if (got.startsWith(`${r.id}/`)) held = true;
        }
        if (mustHold) assert.equal(held, true, `${r.id} must apply to some key on ${s}`);
        if (!mayHold) assert.equal(held, false, `${r.id} must not apply on ${s}`);
      }
    }
    assert.ok(compared > 30000);
  });

  test('neighbour rows across each date boundary (hand-written from §10.1)', () => {
    const cases: [C, boolean | null, SubType, string, string, string][] = [
      ['EO', false, 'none', '2004-09-01', '2004-09-30', 'none:outside-rule-table'],
      ['EO', false, 'none', '2004-09-01', '2004-10-01', 'EQ-ST-1'],
      ['ON', false, 'none', '2004-09-01', '2004-10-01', 'NE-ST-1'],
      ['ON', false, 'none', '2003-01-01', '2004-10-01', 'NE-LT-1'],
      ['EO', false, 'none', '2003-01-01', '2004-10-01', 'EQ-LT-1'],
      ['EO', false, 'none', '2007-06-01', '2008-03-31', 'EQ-ST-1'],
      ['EO', false, 'none', '2007-06-01', '2008-04-01', 'EQ-ST-2'],
      ['EO', false, 'none', '2016-01-01', '2018-03-31', 'EQ-LT-1'],
      ['EO', false, 'none', '2016-01-01', '2018-04-01', 'EQ-LT-2'],
      ['EO', false, 'none', '2018-02-01', '2019-02-01', 'EQ-ST-2'],
      ['EO', false, 'none', '2018-02-01', '2019-02-02', 'EQ-LT-3'],
      ['EO', false, 'none', '2018-01-31', '2019-02-01', 'EQ-LT-2'],
      ['EO', false, 'none', '2023-01-01', '2024-03-31', 'EQ-LT-3'],
      ['EO', false, 'none', '2023-01-01', '2024-04-01', 'EQ-LT-5'],
      ['EO', false, 'none', '2017-01-01', '2024-04-01', 'EQ-LT-4'],
      ['EO', false, 'none', '2023-01-01', '2024-07-22', 'EQ-LT-5'],
      ['EO', false, 'none', '2023-01-01', '2024-07-23', 'EQ-LT-7'],
      ['EO', false, 'none', '2017-01-01', '2024-07-23', 'EQ-LT-6'],
      ['EO', false, 'none', '2024-07-01', '2024-07-22', 'EQ-ST-2'],
      ['EO', false, 'none', '2024-07-01', '2024-07-23', 'EQ-ST-3'],
      ['EO', false, 'none', '2017-01-01', '2026-03-31', 'EQ-LT-6'],
      ['EO', false, 'none', '2017-01-01', '2026-04-01', 'EQ-LT-8'],
      ['EO', false, 'none', '2020-01-01', '2026-04-01', 'EQ-LT-9'],
      ['EO', false, 'none', '2026-03-01', '2026-03-31', 'EQ-ST-3'],
      ['EO', false, 'none', '2026-03-01', '2026-04-01', 'EQ-ST-4'],
      ['EO', true, 'etf-fof-90-90', '2018-03-01', '2018-04-01', 'EQ-FOF-1'],
      ['EO', true, 'etf-fof-90-90', '2017-03-01', '2018-04-01', 'EQ-FOF-2'],
      ['EO', true, 'etf-fof-90-90', '2019-01-01', '2019-03-31', 'EQ-FOF-1'],
      ['EO', true, 'etf-fof-90-90', '2019-01-01', '2019-04-01', 'EQ-ST-2'],
      ['EO', true, 'etf-fof-90-90', '2018-03-01', '2019-04-01', 'EQ-LT-3'],
      ['EO', true, 'etf-fof-90-90', '2018-01-01', '2019-04-01', 'EQ-LT-2'],
      ['ON', false, 'etf-fof-90-90', '2015-01-01', '2018-03-31', 'NE-LT-3'],
      ['ON', false, 'etf-fof-90-90', '2016-01-01', '2018-03-31', 'NE-ST-2'],
      ['ON', false, 'none', '2014-01-01', '2014-07-10', 'NE-ST-1'],
      ['ON', false, 'none', '2014-01-01', '2014-07-11', 'NE-ST-2'],
      ['ON', false, 'none', '2010-01-01', '2014-07-10', 'NE-LT-1'],
      ['ON', false, 'none', '2010-01-01', '2014-07-11', 'NE-LT-2'],
      ['ON', false, 'none', '2012-01-01', '2017-03-31', 'NE-LT-2'],
      ['ON', false, 'none', '2012-01-01', '2017-04-01', 'NE-LT-3'],
      ['ON', false, 'none', '2020-01-01', '2024-07-22', 'NE-LT-3'],
      ['ON', false, 'none', '2020-01-01', '2024-07-23', 'NE-LT-4'],
      ['ON', true, 'none', '2020-01-01', '2024-07-23', 'NE-LT-4L'],
      ['ON', false, 'none', '2023-06-01', '2024-07-22', 'NE-ST-2'],
      ['ON', false, 'none', '2023-06-01', '2024-07-23', 'NE-ST-3'],
      ['ON', true, 'none', '2023-06-01', '2024-07-23', 'NE-LT-4L'],
      ['ON', true, 'none', '2024-01-01', '2024-07-23', 'NE-ST-3L'],
      ['ON', false, 'none', '2020-01-01', '2026-03-31', 'NE-LT-4'],
      ['ON', false, 'none', '2020-01-01', '2026-04-01', 'NE-LT-5'],
      ['ON', true, 'none', '2020-01-01', '2026-03-31', 'NE-LT-4L'],
      ['ON', true, 'none', '2020-01-01', '2026-04-01', 'NE-LT-5L'],
      ['ON', false, 'none', '2026-01-01', '2026-03-31', 'NE-ST-3'],
      ['ON', false, 'none', '2026-01-01', '2026-04-01', 'NE-ST-4'],
      ['ON', true, 'none', '2026-01-01', '2026-03-31', 'NE-ST-3L'],
      ['ON', true, 'none', '2026-01-01', '2026-04-01', 'NE-ST-4L'],
      ['SP', false, 'none', '2023-04-01', '2023-04-01', 'NE-50AA-1'],
      ['SP', false, 'none', '2023-04-01', '2025-03-31', 'NE-50AA-1'],
      ['SP', false, 'none', '2023-04-01', '2025-04-01', 'NE-50AA-2'],
      ['SP', false, 'none', '2023-04-01', '2026-03-31', 'NE-50AA-2'],
      ['SP', false, 'none', '2023-04-01', '2026-04-01', 'NE-50AA-3'],
      ['SP', false, 'none', '2023-03-31', '2023-04-01', 'NE-ST-2'],
      ['SP', false, 'none', '2023-03-31', '2026-10-01', 'NE-LT-5'],
      ['SP', false, 'none', '2010-01-01', '2012-01-01', 'NE-LT-1'],
      ['SP', false, 'none', '2023-04-01', '2023-03-31', 'none:purchase-after-sale'],
    ];
    for (const [cls, listed, sub, p, s, want] of cases) assert.equal(idOf(cls, listed, sub, p, s), want, `${cls} ${listed} ${sub} ${p} to ${s}`);
  });

  test('every valid key on every sale day from 2004-09-25 to 2027-04-05: exactly one row or a documented reason', () => {
    const counts = new Map<string, number>();
    const seen = new Set<string>();
    for (let d = day('2004-09-25'); d <= day('2027-04-05'); d++) {
      const s = dayToIso(d);
      /* relative purchases cover both terms of every window; the fixed 2018-01-31 reaches the grandfathered rows */
      const purchases = [plusDays(s, -1), plusDays(shiftMonths(s, -12), -1), shiftMonths(s, -24), plusDays(shiftMonths(s, -36), -1), '2018-01-31'];
      for (const cls of CLASSES) for (const listed of LISTED) for (const sub of SUBS) for (const p of purchases) {
        const k: IsoKey = { cls, listed, sub, p, s };
        const r = ruleFor(T, toKey(k));
        const got = outcome(r);
        const want = oracle(k);
        if (got !== want) assert.equal(got, want, JSON.stringify(k));
        assert.notEqual(got, 'none:no-rule', JSON.stringify(k));
        const tag = r.kind === 'rule' ? r.rule.id : `none:${r.reason}`;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
        if (r.kind === 'rule') seen.add(r.rule.id);
      }
    }
    /* every rate row is reached, the checks never are, and no valid key falls through to 'no-rule' */
    assert.deepEqual([...seen].sort(), DESIGN_ROWS.map((r) => r.id).sort());
    assert.equal(counts.has('EQ-ELSS-1'), false);
    assert.equal(counts.has('none:no-rule'), false);
    for (const reason of ['none:outside-rule-table', 'none:invalid-key', 'none:listed-flag-missing']) assert.ok((counts.get(reason) ?? 0) > 0, reason);
  });

  test('the key (equity-oriented, 90/90, sale before 2018-04-01) is never produced, and other invalid keys are refused', () => {
    for (let d = day('2004-10-01'); d < day('2018-04-01'); d += 7) {
      const s = dayToIso(d);
      assert.equal(idOf('EO', true, 'etf-fof-90-90', plusDays(s, -400), s), 'none:invalid-key', s);
      assert.notEqual(idOf('ON', true, 'etf-fof-90-90', plusDays(s, -400), s), 'none:invalid-key', s);
    }
    assert.equal(idOf('EO', true, 'etf-fof-90-90', '2017-01-01', '2018-03-31'), 'none:invalid-key');
    assert.equal(idOf('EO', true, 'etf-fof-90-90', '2017-01-01', '2018-04-01'), 'EQ-FOF-2');
    assert.equal(idOf('ON', true, 'etf-fof-90-90', '2017-01-01', '2018-04-01'), 'none:invalid-key');
    assert.equal(idOf('SP', true, 'etf-fof-90-90', '2010-01-01', '2012-01-01'), 'none:invalid-key');
    assert.equal(idOf('SP', true, 'elss', '2010-01-01', '2012-01-01'), 'none:invalid-key');
    assert.equal(idOf('ON', true, 'elss', '2010-01-01', '2012-01-01'), 'none:invalid-key');
    assert.equal(idOf('EO', null, 'none', '2010-01-01', '2012-01-01'), 'none:invalid-key');
    const r = ruleFor(T, toKey({ cls: 'EO', listed: true, sub: 'etf-fof-90-90', p: '2017-01-01', s: '2018-03-31' }));
    assert.ok(r.kind === 'none' && /TR-18/.test(r.detail));
    /* purchase after sale is checked before the coverage and the validity of the key */
    assert.equal(idOf('EO', true, 'etf-fof-90-90', '2004-01-02', '2004-01-01'), 'none:purchase-after-sale');
  });

  test('the three listed-flag cases (§9.1, TR-16)', () => {
    const get = (cls: C, p: string, s: string): RuleResult => ruleFor(T, toKey({ cls, listed: null, sub: 'none', p, s }));
    /* 1. the rule depends on the flag: more than 12 and at most 24 months, general-rule rows from 2024-07-23 */
    const dep = get('ON', '2024-01-01', '2025-06-01');
    assert.ok(dep.kind === 'none' && dep.reason === 'listed-flag-missing');
    assert.equal(outcome(get('SP', '2022-12-01', '2024-08-01')), 'none:listed-flag-missing');
    assert.equal(outcome(get('ON', '2025-01-01', '2026-10-01')), 'none:listed-flag-missing');
    /* 2. the same figures either way: the unlisted row, labelled */
    assert.equal(outcome(get('ON', '2025-01-01', '2025-06-01')), 'NE-ST-3/short/missing-same-either-way');
    assert.equal(outcome(get('ON', '2022-01-01', '2025-06-01')), 'NE-LT-4/long/missing-same-either-way');
    assert.equal(outcome(get('ON', '2022-01-01', '2026-10-01')), 'NE-LT-5/long/missing-same-either-way');
    assert.equal(T.keyValidity.listedFlagMissingLabel, 'listed flag missing; same figures either way');
    /* the 12-month anniversary itself is short both ways; the day after depends on the flag */
    assert.equal(outcome(get('ON', '2024-06-01', '2025-06-01')), 'NE-ST-3/short/missing-same-either-way');
    assert.equal(outcome(get('ON', '2024-06-01', '2025-06-02')), 'none:listed-flag-missing');
    /* the 24-month anniversary is short unlisted and long listed; the day after is long both ways */
    assert.equal(outcome(get('ON', '2023-06-01', '2025-06-01')), 'none:listed-flag-missing');
    assert.equal(outcome(get('ON', '2023-06-01', '2025-06-02')), 'NE-LT-4/long/missing-same-either-way');
    /* a row marked neither: the flag plays no part */
    assert.equal(outcome(get('ON', '2019-01-01', '2020-06-01')), 'NE-ST-2/short/missing-not-needed');
    assert.equal(outcome(get('SP', '2010-01-01', '2012-06-01')), 'NE-LT-1/long/missing-not-needed');
    /* 3. a close-ended Specified lot bought from 2023-04-01 is computed (NE-50AA rows do not depend on the flag) */
    assert.equal(outcome(get('SP', '2023-05-01', '2025-01-01')), 'NE-50AA-1/short/missing-not-needed');
    assert.equal(outcome(get('SP', '2023-05-01', '2026-10-01')), 'NE-50AA-3/short/missing-not-needed');
  });
});

describe('term (§9.2, §10.8 holding-period examples)', () => {
  test('anniversaryOf: same day number, or the last day of the month', () => {
    const a = (p: string, n: number): string => dayToIso(anniversaryOf(day(p), n));
    assert.equal(a('2024-02-29', 12), '2025-02-28');
    assert.equal(a('2024-02-29', 48), '2028-02-29');
    assert.equal(a('2024-02-29', 24), '2026-02-28');
    assert.equal(a('2023-01-31', 1), '2023-02-28');
    assert.equal(a('2024-01-31', 1), '2024-02-29');
    assert.equal(a('2023-08-31', 24), '2025-08-31');
    assert.equal(a('2023-05-31', 36), '2026-05-31');
    assert.equal(a('2024-09-17', 12), '2025-09-17');
    assert.equal(a('2004-12-15', 1), '2005-01-15');
    assert.equal(a('2005-03-31', 0), '2005-03-31');
    assert.throws(() => anniversaryOf(day('2024-01-01'), -1), /whole number/);
    assert.throws(() => anniversaryOf(day('2024-01-01'), 1.5), /whole number/);
  });

  test('the design examples: the anniversary short, the day after long', () => {
    const t = (cls: C, listed: boolean, p: string, s: string): string => {
      const r = ruleFor(T, toKey({ cls, listed, sub: 'none', p, s }));
      return r.kind === 'rule' ? `${r.rule.id} ${r.term}` : r.reason;
    };
    assert.equal(t('EO', false, '2004-09-29', '2005-09-29'), 'EQ-ST-1 short');
    assert.equal(t('EO', false, '2004-09-29', '2005-09-30'), 'EQ-LT-1 long');
    assert.equal(t('EO', false, '2024-09-17', '2025-09-17'), 'EQ-ST-3 short');
    assert.equal(t('EO', false, '2024-09-17', '2025-09-18'), 'EQ-LT-7 long');
    assert.equal(t('EO', false, '2024-09-17', '2025-09-16'), 'EQ-ST-3 short');
    assert.equal(t('EO', false, '2024-02-29', '2025-02-28'), 'EQ-ST-3 short');
    assert.equal(t('EO', false, '2024-02-29', '2025-03-01'), 'EQ-LT-7 long');
    assert.equal(t('ON', false, '2023-01-10', '2025-01-10'), 'NE-ST-3 short');
    assert.equal(t('ON', false, '2023-01-10', '2025-01-11'), 'NE-LT-4 long');
    assert.equal(t('SP', false, '2023-01-10', '2025-01-11'), 'NE-LT-4 long');
    assert.equal(t('ON', false, '2016-05-10', '2019-05-10'), 'NE-ST-2 short');
    assert.equal(t('ON', false, '2016-05-10', '2019-05-11'), 'NE-LT-3 long');
    assert.equal(t('ON', true, '2025-01-10', '2026-01-10'), 'NE-ST-3L short');
    assert.equal(t('ON', true, '2025-01-10', '2026-01-11'), 'NE-LT-4L long');
  });

  test('12, 24 and 36-month windows, and the anniversary returned with the row', () => {
    const r12 = ruleFor(T, toKey({ cls: 'EO', listed: false, sub: 'none', p: '2020-03-15', s: '2021-03-16' }));
    assert.ok(r12.kind === 'rule' && r12.holdingMonths === 12 && dayToIso(r12.anniversary!) === '2021-03-15' && r12.term === 'long');
    const r24 = ruleFor(T, toKey({ cls: 'ON', listed: false, sub: 'none', p: '2024-08-01', s: '2026-08-01' }));
    assert.ok(r24.kind === 'rule' && r24.holdingMonths === 24 && dayToIso(r24.anniversary!) === '2026-08-01' && r24.term === 'short' && r24.rule.id === 'NE-ST-4');
    const r36 = ruleFor(T, toKey({ cls: 'ON', listed: true, sub: 'none', p: '2015-02-28', s: '2018-02-28' }));
    assert.ok(r36.kind === 'rule' && r36.holdingMonths === 36 && r36.term === 'short' && r36.rule.id === 'NE-ST-2');
  });

  test('deemed short term for NE-50AA, whatever the holding', () => {
    for (const s of ['2023-04-01', '2025-03-31', '2025-04-15', '2026-10-01', '2030-01-01']) {
      const r = ruleFor(T, toKey({ cls: 'SP', listed: false, sub: 'none', p: '2023-04-01', s }));
      assert.ok(r.kind === 'rule' && r.term === 'short' && r.deemedShort && r.anniversary === null && r.holdingMonths === null, s);
      assert.match(r.rule.id, /^NE-50AA-/);
    }
  });

  test('EQ-ELSS-1: a sale on or before the 36-month anniversary is flagged and keeps its rate row', () => {
    const k = (p: string, s: string, sub: SubType = 'elss'): RuleKey => toKey({ cls: 'EO', listed: false, sub, p, s });
    const hit = checksFor(T, k('2020-01-15', '2023-01-15'));
    assert.equal(hit.length, 1);
    assert.equal(hit[0]!.check.id, 'EQ-ELSS-1');
    assert.equal(dayToIso(hit[0]!.anniversary), '2023-01-15');
    assert.equal(checksFor(T, k('2020-01-15', '2023-01-16')).length, 0);
    assert.equal(checksFor(T, k('2020-01-15', '2021-01-15', 'none')).length, 0);
    /* an early ELSS sale keeps the rate row of its key: short term inside 12 months, long term after */
    const short = ruleFor(T, k('2020-01-15', '2020-06-01'));
    assert.ok(short.kind === 'rule' && short.rule.id === 'EQ-ST-2' && short.term === 'short');
    assert.equal(checksFor(T, k('2020-01-15', '2020-06-01')).length, 1);
    const long = ruleFor(T, k('2020-01-15', '2021-06-01'));
    assert.ok(long.kind === 'rule' && long.rule.id === 'EQ-LT-3' && long.term === 'long');
    assert.equal(checksFor(T, k('2020-01-15', '2021-06-01')).length, 1);
    assert.equal(checksFor(T, k('2004-01-15', '2004-09-30')).length, 0, 'the check runs on sales from 2004-10-01');
  });

  test('financialYearOf', () => {
    assert.equal(financialYearOf(day('2024-03-31')), 2023);
    assert.equal(financialYearOf(day('2024-04-01')), 2024);
    assert.equal(financialYearOf(day('2027-03-31')), 2026);
  });
});

describe('Cost Inflation Index (§10.3, TR-3)', () => {
  const S1981: Record<number, number | null> = {
    1981: 100, 1982: 109, 1983: 116, 1984: 125, 1985: 133, 1986: 140, 1987: 150, 1988: 161, 1989: 172, 1990: 182,
    1991: 199, 1992: 223, 1993: 244, 1994: 259, 1995: 281, 1996: 305, 1997: 331, 1998: 351, 1999: 389, 2000: 406,
    2001: 426, 2002: 447, 2003: 463, 2004: 480, 2005: 497, 2006: 519, 2007: 551, 2008: 582, 2009: 632, 2010: 711,
    2011: 785, 2012: 852, 2013: 939, 2014: 1024, 2015: 1081, 2016: null,
  };
  const S2001: Record<number, number> = {
    2001: 100, 2002: 105, 2003: 109, 2004: 113, 2005: 117, 2006: 122, 2007: 129, 2008: 137, 2009: 148, 2010: 167,
    2011: 184, 2012: 200, 2013: 220, 2014: 240, 2015: 254, 2016: 264, 2017: 272, 2018: 280, 2019: 289, 2020: 301,
    2021: 317, 2022: 331, 2023: 348, 2024: 363, 2025: 376, 2026: 384,
  };

  test('both series as in the design tables; FY 2016-17 of the 1981 series is to be confirmed', () => {
    for (const [fy, v] of Object.entries(S1981)) {
      const got = ciiOf(T, 'base1981', Number(fy));
      assert.deepEqual(got, v === null ? { kind: 'missing', reason: 'to-be-confirmed' } : { kind: 'index', value: v }, `1981 series FY ${fy}`);
    }
    for (const [fy, v] of Object.entries(S2001)) assert.deepEqual(ciiOf(T, 'base2001', Number(fy)), { kind: 'index', value: v }, `2001 series FY ${fy}`);
    assert.deepEqual(ciiOf(T, 'base1981', 1980), { kind: 'missing', reason: 'outside-series' });
    assert.deepEqual(ciiOf(T, 'base1981', 2017), { kind: 'missing', reason: 'outside-series' });
    assert.deepEqual(ciiOf(T, 'base2001', 2000), { kind: 'missing', reason: 'outside-series' });
    assert.deepEqual(ciiOf(T, 'base2001', 2027), { kind: 'missing', reason: 'outside-series' });
    assert.equal(T.cii.base1981.values.size, Object.keys(S1981).length);
    assert.equal(T.cii.base2001.values.size, Object.keys(S2001).length);
  });

  test('known answers KA-3a, KA-3b, KA-4 and KA-16 (§13.4), to Rs 0.01', () => {
    const cost = (c: number, p: string, s: string, series: 'base1981' | 'base2001'): number => {
      const r = indexedCost(T, c, day(p), day(s), series);
      assert.equal(r.kind, 'indexed');
      return r.kind === 'indexed' ? r.cost : Number.NaN;
    };
    assert.ok(Math.abs(cost(10000, '2005-08-01', '2012-09-03', 'base1981') - 17142.86) < 0.01, 'KA-3a');
    assert.ok(Math.abs(cost(10000, '2009-04-15', '2013-05-15', 'base1981') - 14857.59) < 0.01, 'KA-3b');
    assert.ok(Math.abs(cost(30000, '2018-06-11', '2022-08-16', 'base2001') - 35464.29) < 0.01, 'KA-4');
    assert.ok(Math.abs(cost(10000, '2009-04-15', '2013-05-15', 'base2001') - 14864.86) < 0.01, 'KA-16 (statement figure on the 2001 series)');
    const ka3a = indexedCost(T, 10000, day('2005-08-01'), day('2012-09-03'), 'base1981');
    assert.ok(ka3a.kind === 'indexed' && ka3a.ciiSale === 852 && ka3a.ciiBase === 497 && !ka3a.preBaseYear);
  });

  test('the base-year floor: the later of the FY first held and the series base year', () => {
    const a = indexedCost(T, 1000, day('1979-06-01'), day('2005-06-01'), 'base1981');
    assert.ok(a.kind === 'indexed' && a.baseFyStart === 1981 && a.ciiBase === 100 && a.ciiSale === 497 && a.preBaseYear);
    assert.ok(a.kind === 'indexed' && Math.abs(a.cost - 4970) < 1e-9);
    const b = indexedCost(T, 1000, day('1998-06-01'), day('2018-06-01'), 'base2001');
    assert.ok(b.kind === 'indexed' && b.baseFyStart === 2001 && b.ciiBase === 100 && b.ciiSale === 280 && b.preBaseYear);
    const c = indexedCost(T, 1000, day('2002-03-31'), day('2018-06-01'), 'base2001');
    assert.ok(c.kind === 'indexed' && c.baseFyStart === 2001 && !c.preBaseYear, 'a purchase in FY 2001-02 is in the base year');
  });

  test('a sale in FY 2016-17 on the 1981 series is missing (to be confirmed)', () => {
    assert.deepEqual(indexedCost(T, 1000, day('2012-06-01'), day('2016-09-01'), 'base1981'), { kind: 'missing', reason: 'to-be-confirmed', fyStart: 2016 });
    assert.deepEqual(indexedCost(T, 1000, day('2012-06-01'), day('2017-09-01'), 'base1981'), { kind: 'missing', reason: 'outside-series', fyStart: 2017 });
    assert.deepEqual(indexedCost(T, 1000, day('2017-06-01'), day('2016-09-01'), 'base1981'), { kind: 'missing', reason: 'purchase-after-sale', fyStart: 2016 });
  });

  test('which series applies to which sale; never for equity-oriented units', () => {
    assert.equal(indexationSeriesFor(T, 'other-non-equity', day('2004-10-01')), 'base1981');
    assert.equal(indexationSeriesFor(T, 'specified-mf', day('2017-03-31')), 'base1981');
    assert.equal(indexationSeriesFor(T, 'other-non-equity', day('2017-04-01')), 'base2001');
    assert.equal(indexationSeriesFor(T, 'other-non-equity', day('2024-07-22')), 'base2001');
    assert.equal(indexationSeriesFor(T, 'other-non-equity', day('2024-07-23')), null);
    assert.equal(indexationSeriesFor(T, 'other-non-equity', day('2026-10-01')), null);
    assert.equal(indexationSeriesFor(T, 'equity-oriented', day('2010-01-01')), null);
    assert.equal(indexationSeriesFor(T, 'other-non-equity', day('2004-09-30')), null);
  });
});

describe('exemption, cess and surcharge by year (§10.2, §10.7)', () => {
  test('the annual exemption by financial year', () => {
    for (let fy = 2004; fy <= 2017; fy++) {
      const e = exemptionFor(T, fy);
      assert.ok(e.status === 'ok' && e.year.kind === 'full' && e.year.amount === null && e.year.section === 's.10(38)', `FY ${fy}`);
    }
    for (let fy = 2018; fy <= 2023; fy++) {
      const e = exemptionFor(T, fy);
      assert.ok(e.status === 'ok' && e.year.amount === 100000 && e.year.excessRate === 0.10 && e.year.section === 's.112A', `FY ${fy}`);
    }
    const e24 = exemptionFor(T, 2024);
    assert.ok(e24.status === 'ok' && e24.year.amount === 125000 && e24.year.orderSetByAct === false);
    assert.ok(e24.status === 'ok' && e24.year.sharedRates !== null && e24.year.sharedRates.join() === '0.1,0.125');
    assert.ok(e24.status === 'ok' && e24.year.allocationOrder !== null && e24.year.allocationOrder.join() === 'EQ-LT-6,EQ-LT-7,EQ-LT-4,EQ-LT-5', 'TR-2: the 12.5% gains first');
    const e25 = exemptionFor(T, 2025);
    assert.ok(e25.status === 'ok' && e25.year.amount === 125000 && e25.year.excessRate === 0.125 && e25.year.section === 's.112A');
    const e26 = exemptionFor(T, 2026);
    assert.ok(e26.status === 'ok' && e26.year.amount === 125000 && e26.year.excessRate === 0.125 && e26.year.section === 's.198');
    assert.deepEqual(exemptionFor(T, 2027), { status: 'to-be-confirmed', fyStart: 2027 });
    assert.deepEqual(exemptionFor(T, 2030), { status: 'to-be-confirmed', fyStart: 2030 });
    assert.deepEqual(exemptionFor(T, 2003), { status: 'outside-table', fyStart: 2003 });
  });

  test('cess by year: 2%, then 3%, then 4%; to be confirmed from FY 2027-28', () => {
    const want: [number, number][] = [[2004, 0.02], [2005, 0.02], [2006, 0.02], [2007, 0.03], [2012, 0.03], [2017, 0.03], [2018, 0.04], [2023, 0.04], [2025, 0.04], [2026, 0.04]];
    for (const [fy, rate] of want) assert.deepEqual(cessRateFor(T, fy), { status: 'ok', rate }, `FY ${fy}`);
    assert.deepEqual(cessRateFor(T, 2027), { status: 'to-be-confirmed' });
    assert.deepEqual(cessRateFor(T, 2003), { status: 'outside-table' });
  });

  test('the surcharge maximum by year and regime', () => {
    const single: [number, number][] = [
      [2004, 0.10], [2005, 0.10], [2008, 0.10], [2009, 0], [2012, 0], [2013, 0.10], [2014, 0.10], [2015, 0.12],
      [2016, 0.15], [2017, 0.15], [2018, 0.15], [2019, 0.37], [2020, 0.37], [2022, 0.37],
    ];
    for (const [fy, max] of single) {
      assert.deepEqual(surchargeMaxFor(T, fy, null), { status: 'ok', max, byRegime: false }, `FY ${fy}`);
      assert.deepEqual(surchargeMaxFor(T, fy, 'new'), { status: 'ok', max, byRegime: false }, `FY ${fy} new regime ignored`);
    }
    for (const fy of [2023, 2024, 2025, 2026]) {
      assert.deepEqual(surchargeMaxFor(T, fy, 'old'), { status: 'ok', max: 0.37, byRegime: true }, `FY ${fy} old`);
      assert.deepEqual(surchargeMaxFor(T, fy, 'new'), { status: 'ok', max: 0.25, byRegime: true }, `FY ${fy} new`);
      assert.deepEqual(surchargeMaxFor(T, fy, null), { status: 'regime-not-set', maxEitherRegime: 0.25, maxOldRegime: 0.37, maxNewRegime: 0.25 }, `FY ${fy} no regime`);
    }
    assert.deepEqual(surchargeMaxFor(T, 2027, 'old'), { status: 'to-be-confirmed' });
    assert.deepEqual(surchargeMaxFor(T, 2003, null), { status: 'outside-table' });
  });

  test('the 15% cap on the capped categories of the sale year; slab-rate gains never capped', () => {
    const cap = (fy: number, c: Parameters<typeof surchargeCapFor>[2]): string => {
      const r = surchargeCapFor(T, fy, c);
      return r.status === 'capped' ? `capped ${r.cap}` : r.status;
    };
    assert.equal(cap(2018, 's111a'), 'not-capped');
    assert.equal(cap(2019, 's111a'), 'capped 0.15');
    assert.equal(cap(2019, 's112a'), 'capped 0.15');
    assert.equal(cap(2019, 'dividend'), 'not-capped');
    assert.equal(cap(2020, 'dividend'), 'capped 0.15');
    assert.equal(cap(2021, 's112'), 'not-capped');
    assert.equal(cap(2022, 's112'), 'capped 0.15');
    assert.equal(cap(2025, 's112'), 'capped 0.15');
    assert.equal(cap(2025, 's112a'), 'capped 0.15');
    assert.equal(cap(2026, 's196'), 'capped 0.15');
    assert.equal(cap(2026, 's197'), 'capped 0.15');
    assert.equal(cap(2026, 's198'), 'capped 0.15');
    assert.equal(cap(2026, 'dividend'), 'capped 0.15');
    assert.equal(cap(2025, 's198'), 'not-capped');
    for (const fy of [2010, 2019, 2023, 2026]) assert.equal(cap(fy, 'slab'), 'not-capped', `slab FY ${fy}`);
    assert.equal(cap(2027, 's198'), 'to-be-confirmed');
    assert.equal(T.surcharge.capRate, 0.15);
  });

  test('set-off order facts (§10.6, TR-10): per person; EQ-LT-1 losses ignored, long-term losses first', () => {
    assert.equal(T.setOff.perPerson, true);
    assert.deepEqual(T.setOff.order.map((s) => s.losses), ['EQ-LT-1', 'long-term', 'short-term']);
  });
});

describe('category map (§10.5a)', () => {
  /* Category Name (platform form) to fund type of §10.5; null = "mixed", no default (the scheme decides). */
  const DESIGN_CATEGORIES: Record<string, string | null> = {
    'Multi Cap Funds': 'domestic-equity', 'Flexi Cap Funds': 'domestic-equity', 'Large Cap Funds': 'domestic-equity',
    'Large and Mid Cap Funds': 'domestic-equity', 'Mid Cap Funds': 'domestic-equity', 'Small Cap Funds': 'domestic-equity',
    'Dividend Yield Funds': 'domestic-equity', 'Value Funds': 'domestic-equity', 'Contra Funds': 'domestic-equity',
    'Focused Funds': 'domestic-equity', 'Sectoral Funds': 'domestic-equity', 'Thematic Funds': 'domestic-equity',
    'ELSS': 'domestic-equity', 'ELSS Funds': 'domestic-equity',
    'Overnight Funds': 'debt-funds', 'Liquid Funds': 'debt-funds', 'Ultra Short Term Funds': 'debt-funds',
    'Ultra Short Duration Funds': 'debt-funds', 'Low Duration Funds': 'debt-funds', 'Money Market Funds': 'debt-funds',
    'Short Duration Funds': 'debt-funds', 'Medium Duration Funds': 'debt-funds', 'Medium to Long Duration Funds': 'debt-funds',
    'Long Duration Funds': 'debt-funds', 'Dynamic Bond Funds': 'debt-funds', 'Corporate Bond Funds': 'debt-funds',
    'Credit Risk Funds': 'debt-funds', 'Banking and PSU Funds': 'debt-funds', 'Gilt Funds': 'debt-funds',
    'Gilt Funds with 10 Year Constant Duration': 'debt-funds', 'Gilt Fund with 10 Year Constant Duration': 'debt-funds',
    'Floater Funds': 'debt-funds', 'Sectoral Debt Funds': 'debt-funds',
    'Conservative Hybrid Funds': 'conservative-hybrid', 'Balanced Hybrid Funds': 'balanced-hybrid',
    'Aggressive Hybrid Funds': 'aggressive-hybrid', 'Arbitrage Funds': 'arbitrage', 'Equity Savings Funds': 'equity-savings',
    'Dynamic Asset Allocation Funds': 'balanced-advantage', 'Balanced Advantage Funds': 'balanced-advantage',
    'Multi Asset Allocation Funds': 'multi-asset-allocation',
    'Retirement Funds': 'life-cycle-solution', "Children's Funds": 'life-cycle-solution', 'Life Cycle Funds': 'life-cycle-solution',
    'Index Funds': null, 'ETFs': null, 'Exchange Traded Funds': null, 'Other ETFs': null, 'Index Funds/ETFs': null,
    'Gold ETFs': 'gold-silver-etf', 'Silver ETFs': 'gold-silver-etf',
    'Global Funds': 'international-fof', 'FoFs Overseas': 'international-fof', 'Fund of Funds Overseas': 'international-fof',
    'FoFs Domestic': null, 'Fund of Funds Domestic': null, 'FoFs (Overseas/Domestic)': null,
  };

  test('every key of the design maps to exactly one fund type or to no default; the file holds no other key', () => {
    for (const [name, fundType] of Object.entries(DESIGN_CATEGORIES)) {
      const m = fundTypeOfCategory(T, name);
      assert.ok(m !== null, name);
      assert.equal(m.fundType === null ? null : m.fundType.id, fundType, name);
      if (fundType === null) assert.equal(m.entry.defaultClass.length, 0, `${name}: mixed names have no default`);
    }
    const fileNames = T.categories.entries.flatMap((e) => e.names).sort();
    assert.deepEqual(fileNames, Object.keys(DESIGN_CATEGORIES).sort());
  });

  test('normalisation: trim, spaces, case, one trailing Fund or Funds; no partial match', () => {
    const ft = (s: string): string | null | undefined => { const m = fundTypeOfCategory(T, s); return m === null ? undefined : (m.fundType?.id ?? null); };
    assert.equal(ft('  large   cap fund '), 'domestic-equity');
    assert.equal(ft('LARGE CAP'), 'domestic-equity');
    assert.equal(ft('Large Cap Funds'), 'domestic-equity');
    assert.equal(ft('Elss Fund'), 'domestic-equity');
    assert.equal(ft('Large Cap Funds Direct'), undefined);
    assert.equal(ft('Large'), undefined);
    assert.equal(ft('Cap Funds'), undefined);
    assert.equal(ft('Mid Cap Fund Fund'), undefined, 'only one trailing word is dropped');
    assert.equal(ft('Sectoral Debt'), 'debt-funds');
    assert.equal(ft('Sectoral'), 'domestic-equity');
    assert.equal(ft('Funds'), undefined);
    assert.equal(ft(''), undefined);
    assert.equal(ft('Equity'), undefined, 'an unknown name maps to nothing');
    assert.equal(ft('Hybrid Funds'), undefined);
    assert.equal(normaliseCategoryName(' Gilt  Funds with 10 Year Constant Duration '), 'gilt funds with 10 year constant duration');
    assert.equal(normaliseCategoryName('Refunds'), 'refunds');
  });

  test('step-2 default classes by window', () => {
    const def = (name: string, p: string, s: string): string => {
      const m = fundTypeOfCategory(T, name)!;
      const w = categoryDefaultClass(m, day(p), day(s));
      return w === null ? 'no default' : [w.taxClass, w.subType, w.warning].filter((x) => x !== null).join(' ');
    };
    assert.equal(def('Aggressive Hybrid Funds', '2025-01-01', '2026-03-31'), 'no default');
    assert.equal(def('Aggressive Hybrid Funds', '2025-01-01', '2026-04-01'), 'equity-oriented capital-gains.usual-bucket-default');
    assert.equal(def('Arbitrage Funds', '2025-01-01', '2026-04-01'), 'equity-oriented capital-gains.usual-bucket-default');
    assert.equal(def('Equity Savings Funds', '2025-01-01', '2026-03-31'), 'no default');
    assert.equal(def('Balanced Advantage Funds', '2025-01-01', '2026-06-01'), 'no default');
    assert.equal(def('Multi Asset Allocation Funds', '2025-01-01', '2026-06-01'), 'no default');
    assert.equal(def('Sectoral Funds', '2020-01-01', '2021-06-01'), 'equity-oriented capital-gains.category-default-to-confirm');
    assert.equal(def('Thematic Funds', '2020-01-01', '2021-06-01'), 'equity-oriented capital-gains.category-default-to-confirm');
    assert.equal(def('ELSS', '2020-01-01', '2024-06-01'), 'equity-oriented elss');
    assert.equal(def('Liquid Funds', '2010-01-01', '2012-06-01'), 'specified-mf');
    assert.equal(def('Conservative Hybrid Funds', '2010-01-01', '2012-06-01'), 'specified-mf');
    assert.equal(def('Balanced Hybrid Funds', '2010-01-01', '2012-06-01'), 'other-non-equity');
    assert.equal(def('Gold ETFs', '2023-04-01', '2024-01-01'), 'specified-mf');
    assert.equal(def('Gold ETFs', '2023-03-31', '2024-01-01'), 'other-non-equity');
    assert.equal(def('Gold ETFs', '2023-04-01', '2025-04-01'), 'other-non-equity');
    assert.equal(def('Global Funds', '2023-06-01', '2025-03-31'), 'specified-mf');
    assert.equal(def('Global Funds', '2023-06-01', '2026-06-01'), 'other-non-equity');
    assert.equal(def('Index Funds', '2020-01-01', '2026-06-01'), 'no default');
    assert.equal(def('FoFs Domestic', '2020-01-01', '2026-06-01'), 'no default');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// I-21 agreement (PLAN-03 P5): the live current-law table against table v1 for a sale in tax year 2026-27

describe('I-21 agreement: data/refdata/TAX_RULES.json against table v1 for a sale on 2026-10-01', () => {
  interface I21Leg { label: string; period: string; rate: number | null }
  interface I21Row { inst: string; months: number | null; st: I21Leg; lt: I21Leg; alwaysShort?: boolean; sec198?: boolean; lockMonths?: number; specifiedFrom?: string; boughtBefore?: string; listedEtfMonths?: number }
  const LIVE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/refdata/TAX_RULES.json'), 'utf8')) as I21Row[];
  /* The live labels use an en dash; the test names them with a hyphen. */
  const plain = (s: string): string => s.split(String.fromCharCode(0x2013)).join('-');
  const SALE = '2026-10-01';

  interface InScope { cls: C; listed: boolean; sub: SubType; short: string | 'table'; long: string[] }
  /* 'table': no lot bought before 2023-04-01 can be short term on 2026-10-01, so the short row is read from the table. */
  const IN_SCOPE: Record<string, InScope> = {
    'Equity Mutual Funds': { cls: 'EO', listed: false, sub: 'none', short: '2026-09-01', long: ['2017-06-01', '2020-06-01'] },
    'Equity ETFs': { cls: 'EO', listed: true, sub: 'none', short: '2026-09-01', long: ['2017-06-01', '2020-06-01'] },
    'Hybrid MF (equity-oriented)': { cls: 'EO', listed: false, sub: 'none', short: '2026-09-01', long: ['2017-06-01', '2020-06-01'] },
    'ELSS (3-year lock-in)': { cls: 'EO', listed: false, sub: 'elss', short: '2026-09-01', long: ['2017-06-01', '2020-06-01'] },
    'Equity ETF FoF (90/90)': { cls: 'EO', listed: false, sub: 'etf-fof-90-90', short: '2026-09-01', long: ['2017-06-01', '2020-06-01'] },
    'Debt Mutual Funds - Sec. 76 (old 50AA)': { cls: 'SP', listed: false, sub: 'none', short: '2026-09-01', long: ['2023-06-01'] },
    'Hybrid MF (Specified, Sec. 76)': { cls: 'SP', listed: false, sub: 'none', short: '2026-09-01', long: ['2023-06-01'] },
    'Debt MF bought before 1 Apr 2023': { cls: 'SP', listed: false, sub: 'none', short: 'table', long: ['2023-03-01'] },
    'Hybrid MF (conservative) bought before 1 Apr 2023': { cls: 'SP', listed: false, sub: 'none', short: 'table', long: ['2023-03-01'] },
    'Hybrid MF (general rule)': { cls: 'ON', listed: false, sub: 'none', short: '2026-09-01', long: ['2022-01-01'] },
    'Fund of Funds (general rule)': { cls: 'ON', listed: false, sub: 'none', short: '2026-09-01', long: ['2022-01-01'] },
    'Global Funds': { cls: 'ON', listed: false, sub: 'none', short: '2026-09-01', long: ['2022-01-01'] },
    'International ETFs (listed in India)': { cls: 'ON', listed: true, sub: 'none', short: '2026-09-01', long: ['2022-01-01'] },
    'Commodity ETF': { cls: 'ON', listed: true, sub: 'none', short: '2026-09-01', long: ['2022-01-01'] },
    'Commodity Mutual Fund': { cls: 'ON', listed: false, sub: 'none', short: '2026-09-01', long: ['2022-01-01'] },
  };
  /* Rows with no counterpart in table v1 (not mutual-fund units, or outside the design's three classes). */
  const OUT_OF_SCOPE = [
    'Listed Equity Shares', 'Equity PMS', 'Equity AIF - Cat I/II', 'Equity AIF - Cat III (Listed Equity)',
    'Equity AIF - Cat III (Long Short)', 'Debt AIF - Cat I/II', 'Debt AIF - Cat III', 'Listed Bonds / NCDs',
    'Unlisted Bonds / NCDs', 'Unlisted Equity Shares', 'Government Securities / G-Secs', 'REIT Units', 'InvIT Units',
    'Sovereign Gold Bonds', 'Crypto', 'MLD', 'SIF (equity long-short)', 'SIF (debt long-short, Specified)',
    'Foreign-listed shares (held directly)',
  ];
  /*
   * Recorded disagreements: never fixed silently in either table (I-21 change rule); reported to the financial-domain
   * reviewer and EX-02. Each entry is asserted to still hold, so a fix in either table makes this test ask for an update.
   */
  const KNOWN_DISAGREEMENTS: { inst: string; field: string; live: string; v1: string; reason: string }[] = [
    {
      inst: 'ELSS (3-year lock-in)',
      field: 'st.rate',
      live: 'null ("N/A (lock-in)")',
      v1: 'EQ-ST-4 0.2',
      reason: 'the live table shows no short-term rate because the lock-in makes a short-term sale impossible; table v1 keeps the rate row of the key (EQ-ST-4, 20%) and flags the sale with check EQ-ELSS-1 (TR-17), so the representation differs, not the law',
    },
  ];
  const known = (inst: string, field: string): boolean => KNOWN_DISAGREEMENTS.some((d) => d.inst === inst && d.field === field);

  const liveRate = (leg: I21Leg): number | 'slab' | string => (leg.rate !== null ? leg.rate : leg.label === 'Slab rate' ? 'slab' : `null (${JSON.stringify(leg.label)})`);
  const rowOf = (c: InScope, p: string): Extract<RuleResult, { kind: 'rule' }> => {
    const r = ruleFor(T, toKey({ cls: c.cls, listed: c.listed, sub: c.sub, p, s: SALE }));
    assert.equal(r.kind, 'rule', `${c.cls} ${p}`);
    return r as Extract<RuleResult, { kind: 'rule' }>;
  };
  const shortRowFromTable = (c: InScope, listed: boolean): TaxRule => {
    const s = day(SALE);
    const hits = T.rules.filter((r) => r.term === 'short' && r.classes.includes(CLASS[c.cls]) && s >= r.saleFrom && (r.saleTo === null || s <= r.saleTo)
      && (r.listed === 'any' || (r.listed === 'listed') === listed) && r.purchase[CLASS[c.cls]]!.to !== null && dayToIso(r.purchase[CLASS[c.cls]]!.to!) === '2023-03-31');
    assert.equal(hits.length, 1, `${c.cls} listed ${listed}: ${hits.map((h) => h.id).join()}`);
    return hits[0]!;
  };

  test('every live row is either compared or listed as out of scope (34 rows)', () => {
    assert.equal(LIVE.length, 34);
    const names = LIVE.map((r) => plain(r.inst)).sort();
    assert.deepEqual(names, [...Object.keys(IN_SCOPE), ...OUT_OF_SCOPE].sort());
  });

  for (const [inst, c] of Object.entries(IN_SCOPE)) {
    test(`${inst}: same short and long rate and holding period`, () => {
      const live = LIVE.find((r) => plain(r.inst) === inst)!;
      const longs = c.long.map((p) => rowOf(c, p));
      const shortRule = c.short === 'table' ? shortRowFromTable(c, c.listed) : rowOf(c, c.short).rule;
      if (live.alwaysShort === true) {
        /* deemed short term whatever the holding: every lot gives the same slab row */
        for (const l of longs) assert.ok(l.deemedShort && l.term === 'short' && l.rule.rate === 'slab', `${inst} long purchase gives ${l.rule.id}`);
        assert.equal(liveRate(live.st), 'slab');
        assert.equal(liveRate(live.lt), 'slab');
        assert.equal(live.months, null);
        assert.equal(shortRule.term, 'deemed-short');
        if (live.specifiedFrom !== undefined) assert.equal(dayToIso(shortRule.purchase['specified-mf']!.from!), live.specifiedFrom);
        return;
      }
      for (const l of longs) {
        assert.equal(l.term, 'long', `${inst}: ${l.rule.id}`);
        assert.equal(l.rule.rate, liveRate(live.lt), `${inst} long rate (${l.rule.id})`);
        assert.equal(l.holdingMonths, live.months, `${inst} holding months (${l.rule.id})`);
        if (live.sec198 === true) assert.equal(l.rule.exemptionGroup, 's198', `${inst} s.198 exemption (${l.rule.id})`);
        else assert.equal(l.rule.exemptionGroup, null, `${inst} no exemption (${l.rule.id})`);
      }
      assert.equal(shortRule.holdingMonths, live.months, `${inst} short holding months (${shortRule.id})`);
      if (known(inst, 'st.rate')) {
        const d = KNOWN_DISAGREEMENTS.find((x) => x.inst === inst && x.field === 'st.rate')!;
        assert.equal(liveRate(live.st), 'null ("N/A (lock-in)")', `${inst}: the recorded disagreement no longer holds on the live side`);
        assert.equal(`${shortRule.id} ${String(shortRule.rate)}`, d.v1, `${inst}: the recorded disagreement no longer holds on the v1 side`);
      } else {
        assert.equal(shortRule.rate, liveRate(live.st), `${inst} short rate (${shortRule.id})`);
      }
      if (live.lockMonths !== undefined) assert.equal(T.checks.find((x) => x.id === 'EQ-ELSS-1')!.lockInMonths, live.lockMonths);
      if (live.boughtBefore !== undefined) assert.equal(plusDays(dayToIso(shortRule.purchase['specified-mf']!.to!), 1), live.boughtBefore);
      if (live.listedEtfMonths !== undefined) {
        const listedLong = rowOf({ ...c, listed: true }, c.long[0]!);
        assert.equal(listedLong.holdingMonths, live.listedEtfMonths, `${inst} listed ETF months (${listedLong.rule.id})`);
        assert.equal(listedLong.rule.rate, liveRate(live.lt));
        assert.equal(shortRowFromTable(c, true).holdingMonths, live.listedEtfMonths);
      }
    });
  }
});
