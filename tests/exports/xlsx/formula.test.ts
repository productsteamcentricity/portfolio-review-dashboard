// covers: E-75 BR-10.2
// The typed formula builder: references resolve only to declared tables, columns and data rows; a self-reference,
// a function outside the allowed subset and a criterion literal that could act as a wildcard, an operator or a
// formula are refused; the rendered SUMIFS text is exactly the planned one (D-039 point 5).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_FUNCTIONS, FormulaError, fx, references, renderFormula, type Fx } from '../../../app/src/exports/xlsx/formula.ts';
import { layoutOf, columnLetter } from '../../../app/src/exports/xlsx/layout.ts';
import type { CellSpec } from '../../../app/src/exports/xlsx/spec.ts';

const H = 'Holdings (as loaded)';
const O = 'Portfolio Overview';
const blank = (n: number): CellSpec[][] => Array.from({ length: n }, () => []);
const layout = layoutOf([
  { name: H, columns: ['cmv', 'assetClass', 'included', 'investedPresent', 'productKey'].map((key) => ({ header: key, key, width: 10 })), rows: blank(6) },
  { name: O, columns: ['asset', 'key', 'invested', 'cmv', 'pct', 'gain'].map((key) => ({ header: key, key, width: 10 })), rows: blank(4) },
]);
const at = { sheet: O, header: 'cmv', row: 0 };
const col = (k: string): Fx => fx.col(H, k);

test('the SUMIFS of an asset row renders as planned', () => {
  const f = fx.sumifs(col('cmv'), [col('assetClass'), fx.cell(null, 'asset', 0, { col: true })], [col('included'), fx.str('Yes')]);
  assert.equal(renderFormula(f, layout, at),
    "SUMIFS('Holdings (as loaded)'!$A$2:$A$7,'Holdings (as loaded)'!$B$2:$B$7,$A2,'Holdings (as loaded)'!$C$2:$C$7,\"Yes\")");
});

test('the % CMV, gain and absolute return render with Excel precedence', () => {
  const pct = fx.mul(fx.div(fx.cell(null, 'cmv', 1), fx.cell(null, 'cmv', 3, { col: true, row: true })), fx.num(100));
  assert.equal(renderFormula(pct, layout, { sheet: O, header: 'pct', row: 1 }), 'D3/$D$5*100');
  const gain = fx.sub(fx.sumifs(col('cmv'), [col('included'), fx.str('Yes')]), fx.cell(null, 'invested', 2));
  assert.equal(renderFormula(gain, layout, { sheet: O, header: 'gain', row: 2 }), "SUMIFS('Holdings (as loaded)'!$A$2:$A$7,'Holdings (as loaded)'!$C$2:$C$7,\"Yes\")-C4");
  const nested = fx.sub(fx.num(1), fx.sub(fx.num(2), fx.num(3)));
  assert.equal(renderFormula(nested, layout, at), '1-(2-3)');
  const mixed = fx.div(fx.add(fx.num(1), fx.num(2)), fx.mul(fx.num(3), fx.num(4)));
  assert.equal(renderFormula(mixed, layout, at), '(1+2)/(3*4)');
  assert.equal(renderFormula(fx.neg(fx.add(fx.num(1), fx.num(2))), layout, at), '-(1+2)');
  assert.equal(renderFormula(fx.call('ROUND', fx.num(2.675), fx.num(2)), layout, at), 'ROUND(2.675,2)');
});

test('refused: an unknown sheet, an unknown column, a row outside the table', () => {
  assert.throws(() => renderFormula(fx.col('Nope', 'cmv'), layout, at), FormulaError);
  assert.throws(() => renderFormula(fx.col(H, 'nope'), layout, at), /unknown column/);
  assert.throws(() => renderFormula(fx.cell(null, 'cmv', 4), layout, { ...at, header: 'pct' }), /outside/);
  assert.throws(() => renderFormula(fx.cell(null, 'cmv', -1), layout, { ...at, header: 'pct' }), /outside/);
  assert.throws(() => renderFormula(fx.num(1), layout, { sheet: O, header: 'cmv', row: 9 }), /outside/);
});

test('refused: a self-reference, by cell or by a range that holds the formula', () => {
  assert.throws(() => renderFormula(fx.add(fx.cell(null, 'cmv', 0), fx.num(1)), layout, at), /self-reference/);
  assert.throws(() => renderFormula(fx.cell(O, 'cmv', 0), layout, at), /self-reference/);
  assert.throws(() => renderFormula(fx.call('SUM', fx.col(O, 'cmv')), layout, at), /self-reference/);
});

test('refused: a function outside the allowed subset', () => {
  assert.deepEqual([...ALLOWED_FUNCTIONS], ['SUM', 'SUMIFS', 'SUMPRODUCT', 'IF', 'AND', 'OR', 'MIN', 'MAX', 'ABS', 'ROUND']);
  const vlookup = { k: 'call', fn: 'VLOOKUP', args: [fx.num(1)] } as unknown as Fx;
  assert.throws(() => renderFormula(vlookup, layout, at), /VLOOKUP is not allowed/);
  const indirect = { k: 'call', fn: 'INDIRECT', args: [fx.str('A1')] } as unknown as Fx;
  assert.throws(() => renderFormula(indirect, layout, at), /not allowed/);
});

test('refused: criterion literals with wildcards, operators or a leading =, and over 40 characters', () => {
  for (const bad of ['Eq*', 'Eq?', '~x', '=Equity', '<>Debt', '>5', '"', 'a,b', '', 'x'.repeat(41), 'line\nbreak', '=1+1']) {
    assert.throws(() => renderFormula(fx.sumifs(col('cmv'), [col('assetClass'), fx.str(bad)]), layout, at), /string literal/, JSON.stringify(bad));
  }
  for (const ok of ['Yes', 'C01', 'REITs/InvITs', 'Open Ended', 'P12']) {
    assert.match(renderFormula(fx.sumifs(col('cmv'), [col('assetClass'), fx.str(ok)]), layout, at), new RegExp(`"${ok.replace('/', '\\/')}"`));
  }
});

test('refused: SUMIFS ranges that are not whole table columns, numbers that need an exponent', () => {
  assert.throws(() => renderFormula(fx.sumifs(fx.cell(H, 'cmv', 0), [col('assetClass'), fx.str('Equity')]), layout, at), /whole table columns/);
  assert.throws(() => renderFormula(fx.num(1e-7), layout, at), /exponent/);
  assert.throws(() => renderFormula(fx.num(Number.NaN), layout, at), FormulaError);
});

test('references lists every range and cell of a formula', () => {
  const f = fx.sub(fx.sumifs(col('cmv'), [col('included'), fx.str('Yes')]), fx.cell(null, 'invested', 2));
  assert.deepEqual(references(f).map((r) => (r.k === 'col' ? `${r.sheet}:${r.header}` : `${r.header}@${r.row}`)), [`${H}:cmv`, `${H}:included`, 'invested@2']);
  assert.equal(columnLetter(0), 'A');
  assert.equal(columnLetter(25), 'Z');
  assert.equal(columnLetter(26), 'AA');
  assert.equal(columnLetter(42), 'AQ');
});
