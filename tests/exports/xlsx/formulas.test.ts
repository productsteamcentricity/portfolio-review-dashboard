// covers: E-77 E-79 BR-10.2
// Every formula cell of the overview workbook, evaluated by the independent evaluator (tests/helpers/formula-eval.ts),
// equals the view-model's Figure.shown within 1e-9 relative, and no cell holds an error value; after one CMV cell of
// Holdings (as loaded) is edited, the dependents equal a recomputation of the edited input worked out by hand. The
// known answers are the plan's, worked out from SYNTHETIC_BOOK (rupees / 1e7 = Crore), for example Equity 1.987 Cr of
// 3.353 Cr = 59.26036385326573 %.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewWorkbook } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { evaluateAll, readWorkbookForEval, withEdit, isError, closeTo, type EvalResult } from '../../helpers/formula-eval.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { figureCells, sampleInput, vmFigures, SAMPLE_NAMES, type SampleName } from './sample-input.ts';

const PO = 'Portfolio Overview';
const HS = 'Holdings (as loaded)';

function built(name: SampleName) {
  const input = sampleInput(name);
  const bytes = buildOverviewWorkbook(input);
  const wb = readXlsx(bytes);
  const ev = readWorkbookForEval(bytes);
  return { input, bytes, wb, ev, values: evaluateAll(ev) };
}

/** The evaluated value of a Portfolio Overview row (found by its B, C and D cells) in a column. */
function po(b: ReturnType<typeof built>, find: { asset?: string; product?: string; liquidity?: string }, column: string): EvalResult | undefined {
  const t = sheetTable(sheetByName(b.wb, PO));
  const r = t.findIndex((row, i) => i > 0 && (find.asset === undefined || row[1] === find.asset)
    && (find.product === undefined ? (find.liquidity !== undefined || row[2] === null) : row[2] === find.product)
    && (find.liquidity === undefined ? row[3] === null : row[3] === find.liquidity));
  assert.ok(r > 0, `row ${JSON.stringify(find)}`);
  return b.values.get(`${PO}!${column}${r + 1}`);
}

const near = (actual: EvalResult | undefined, expected: number, what: string): void => {
  assert.equal(typeof actual, 'number', `${what}: ${JSON.stringify(actual)}`);
  assert.ok(closeTo(actual as number, expected), `${what}: ${String(actual)} vs ${expected}`);
};

describe('every formula equals Figure.shown, with no error value', () => {
  for (const name of SAMPLE_NAMES) {
    test(name, () => {
      const b = built(name);
      const figures = vmFigures(b.input.vm);
      const cells = figureCells(b.wb);
      assert.ok(b.values.size > 0);
      for (const [ref, v] of b.values) assert.ok(!isError(v), `${ref} evaluates to ${JSON.stringify(v)}`);
      for (const s of b.wb.sheets) for (const c of s.cells.values()) assert.notEqual(c.t, 'e', `${s.name}!${c.ref}`);

      const covered = new Set<string>();
      for (const [key, ref] of cells) {
        const f = figures.get(key);
        assert.ok(f, `the manifest names a figure ${key} the view-model does not have`);
        const bang = ref.lastIndexOf('!');
        const cell = b.wb.sheets.find((s) => s.name === ref.slice(0, bang))!.cells.get(ref.slice(bang + 1));
        if (f.shown.kind === 'value') {
          assert.ok(cell && cell.f !== null, `${key} at ${ref} is a formula`);
          near(b.values.get(ref), f.shown.v, `${key} at ${ref}`);
          assert.ok(closeTo(cell.v as number, f.shown.v), `${key}: the cached value is Figure.shown`);
          covered.add(ref);
        } else {
          assert.ok(!cell || (cell.f === null && cell.v === null), `${key} is missing, so ${ref} is blank`);
        }
      }
      for (const ref of b.values.keys()) assert.ok(covered.has(ref), `the formula at ${ref} is the cell of a figure`);
      // Every present figure of the overview sheets is written (counts are not workbook figures).
      for (const [key, f] of figures) {
        if (key.startsWith('counts.') || f.shown.kind !== 'value') continue;
        assert.ok(cells.has(key), `figure ${key} is written`);
      }
    });
  }
});

test('standard: the hand-worked allocation, totals and matrices', () => {
  const b = built('standard');
  near(po(b, { asset: 'Equity' }, 'G'), 1.987, 'Equity CMV');
  near(po(b, { asset: 'Equity' }, 'F'), 1.65, 'Equity invested');
  near(po(b, { asset: 'Equity' }, 'H'), 59.26036385326573, 'Equity % CMV');
  near(po(b, { asset: 'Equity' }, 'I'), 0.337, 'Equity gain');
  near(po(b, { asset: 'Equity', product: 'Mutual Funds' }, 'G'), 1.077, 'Equity MF');
  near(po(b, { asset: 'Equity', product: 'Mutual Funds' }, 'H'), 32.12048911422606, 'Equity MF %');
  near(po(b, { asset: 'Equity', product: 'PMS' }, 'H'), 27.139874739039666, 'PMS %');
  near(po(b, { asset: 'Debt' }, 'H'), 26.722338204592898, 'Debt %');
  near(po(b, { asset: 'Hybrid' }, 'H'), 10.110348941246645, 'Hybrid %');
  near(po(b, { asset: 'Commodity' }, 'H'), 3.9069490008947207, 'Commodity %');
  near(po(b, { asset: 'Grand Total' }, 'G'), 3.353, 'total CMV');
  near(po(b, { asset: 'Grand Total' }, 'F'), 2.85, 'total invested');
  near(po(b, { asset: 'Grand Total' }, 'I'), 0.503, 'total gain');
  near(po(b, { asset: 'Grand Total' }, 'J'), 17.649122807017545, 'absolute return');
  near(po(b, { liquidity: 'Open Ended' }, 'H'), 100, 'Open Ended %');
  const clients = sheetTable(sheetByName(b.wb, 'Client Allocation'));
  assert.deepEqual(clients[0]!.slice(3, 5), ['Sample Client A (Cr.)', 'Sample Client B (Cr.)']);
  const share = clients.length; // the last row
  near(b.values.get(`Client Allocation!D${share}`), 58.84282731881897, 'client A share');
  near(b.values.get(`Client Allocation!E${share}`), 41.157172681181024, 'client B share');
  const dist = sheetTable(sheetByName(b.wb, 'Distributor Allocation'));
  assert.deepEqual(dist[0]!.slice(3, 5), ['Other Distributor (Cr.)', 'Centricity (Cr.)']);
  near(b.values.get(`Distributor Allocation!D${dist.length}`), 53.86221294363257, 'Other Distributor share');
  near(b.values.get(`Distributor Allocation!E${dist.length}`), 46.13778705636743, 'Centricity share');
});

test('blank-invested: invested and gain over the holdings with an invested value; Debt invested blank', () => {
  const b = built('blank-invested');
  near(po(b, { asset: 'Grand Total' }, 'F'), 1.55, 'invested');
  near(po(b, { asset: 'Grand Total' }, 'I'), 0.282, 'gain');
  near(po(b, { asset: 'Grand Total' }, 'J'), 18.193548387096776, 'absolute return');
  near(po(b, { asset: 'Grand Total' }, 'K'), 54.63763793617655, 'coverage');
  near(po(b, { asset: 'Equity' }, 'F'), 1.15, 'Equity invested');
  near(po(b, { asset: 'Equity' }, 'I'), 0.212, 'Equity gain');
  near(po(b, { asset: 'Equity' }, 'K'), 68.54554604932058, 'Equity coverage');
  assert.equal(po(b, { asset: 'Debt' }, 'F'), undefined, 'Debt invested is not a formula');
  near(po(b, { asset: 'Debt' }, 'K'), 0, 'Debt coverage 0');
});

test('lakh: every amount in Lakh', () => {
  const b = built('lakh');
  near(po(b, { asset: 'Grand Total' }, 'G'), 335.3, 'total CMV');
  near(po(b, { asset: 'Grand Total' }, 'F'), 285, 'invested');
  near(po(b, { asset: 'Grand Total' }, 'I'), 50.3, 'gain');
  near(po(b, { asset: 'Equity' }, 'G'), 198.7, 'Equity');
  near(po(b, { asset: 'Equity' }, 'F'), 165, 'Equity invested');
  near(po(b, { asset: 'Equity' }, 'H'), 59.26036385326573, 'Equity %');
});

test('all-classes: six classes in the house order, Unknown last', () => {
  const b = built('all-classes');
  const order = sheetTable(sheetByName(b.wb, PO)).slice(1).filter((r) => r[0] === 'Asset and product' && r[2] === null).map((r) => r[1]);
  assert.deepEqual(order, ['Equity', 'Debt', 'Hybrid', 'Commodity', 'REITs/InvITs', 'Unknown']);
  const expected: Array<[string, number]> = [['Equity', 19.101466992665035], ['Debt', 27.383863080684602], ['Hybrid', 10.360635696821516],
    ['Commodity', 1.5281173594132031], ['REITs/InvITs', 13.814180929095354], ['Unknown', 27.811735941320293]];
  for (const [a, pct] of expected) near(po(b, { asset: a }, 'H'), pct, a);
});

test('na-cmv and zero-cmv: excluded holdings never count; a CMV of 0 leaves the coverage blank', () => {
  const na = built('na-cmv');
  near(po(na, { asset: 'Grand Total' }, 'G'), 2.562, 'CMV');
  near(po(na, { asset: 'Grand Total' }, 'F'), 2.15, 'invested, not 2.55');
  near(po(na, { asset: 'Grand Total' }, 'I'), 0.412, 'gain');
  near(po(na, { asset: 'Equity' }, 'H'), (1.535 / 2.562) * 100, 'Equity %');
  const z = built('zero-cmv');
  near(po(z, { asset: 'Commodity' }, 'G'), 0, 'Commodity CMV 0');
  near(po(z, { asset: 'Commodity' }, 'I'), -0.1, 'gain 0 minus 0.1');
  near(po(z, { asset: 'Commodity' }, 'J'), -100, 'absolute return');
  assert.equal(po(z, { asset: 'Commodity' }, 'K'), undefined, 'coverage of a CMV 0 line is blank');
  const row = sheetTable(sheetByName(z.wb, PO)).find((r) => r[1] === 'Commodity' && r[2] === null)!;
  assert.equal(row[11], 'Invested Coverage: NOT APPLICABLE');
});

test('an edited CMV recalculates its dependents to the hand recomputation', () => {
  const b = built('standard');
  const t = sheetTable(sheetByName(b.wb, HS));
  assert.equal(t[1]![0], 'Sample Bluechip Fund - Regular Plan - Growth');
  assert.equal(t[1]![23], 0.625, 'X2 is the Bluechip fund\'s CMV');
  const after = evaluateAll(withEdit(b.ev, `${HS}!X2`, 1.625));
  const at = (find: { asset?: string; product?: string; liquidity?: string }, column: string): EvalResult | undefined =>
    po({ ...b, values: after }, find, column);
  near(at({ asset: 'Equity' }, 'G'), 2.987, 'Equity CMV');
  near(at({ asset: 'Equity', product: 'Mutual Funds' }, 'G'), 2.077, 'Equity MF');
  near(at({ asset: 'Grand Total' }, 'G'), 4.353, 'total');
  near(at({ liquidity: 'Open Ended' }, 'G'), 4.353, 'Open Ended');
  near(at({ asset: 'Equity' }, 'H'), (2.987 / 4.353) * 100, 'Equity %');
  near(at({ asset: 'Debt' }, 'H'), (0.896 / 4.353) * 100, 'Debt %');
  near(at({ asset: 'Equity' }, 'I'), 2.987 - 1.65, 'Equity gain');
  near(at({ asset: 'Grand Total' }, 'J'), ((4.353 - 2.85) / 2.85) * 100, 'absolute return');
  near(at({ asset: 'Debt' }, 'G'), 0.896, 'Debt unchanged');
  const share = sheetTable(sheetByName(b.wb, 'Client Allocation')).length;
  near(after.get(`Client Allocation!D${share}`), (2.973 / 4.353) * 100, 'client A share');
  near(after.get(`Client Allocation!F${share - 1}`), 4.353, 'client grand total');
});
