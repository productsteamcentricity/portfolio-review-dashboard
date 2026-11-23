// covers: E-75 BR-10.2
// The independent formula evaluator (tests/helpers/formula-eval.ts) on hand-written formulas, in a workbook written by
// the vendored SheetJS (so the evaluator is tested apart from the in-house writer). Every expected value is worked
// out by hand from the cells below, with Excel's semantics.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSheetJS, writeXlsx } from '../../helpers/sheetjs.ts';
import { evaluateAll, evaluateFormula, readWorkbookForEval, withEdit, isError, type EvalWorkbook } from '../../helpers/formula-eval.ts';

// Data:  A Class        B Amount  C Flag  D Zero
//   2    Equity         10        Yes     1
//   3    equity         5         yes     0
//   4    Debt           7         Yes     1
//   5    (blank)        3         Yes     2
//   6    Equity         n/a       Yes     1
//   7    Gold Fund      2         No      1
function workbook(): EvalWorkbook {
  const xlsx = loadSheetJS();
  const wb = xlsx.utils.book_new();
  const data = xlsx.utils.aoa_to_sheet([
    ['Class', 'Amount', 'Flag', 'Zero'],
    ['Equity', 10, 'Yes', 1],
    ['equity', 5, 'yes', 0],
    ['Debt', 7, 'Yes', 1],
    [null, 3, 'Yes', 2],
    ['Equity', 'n/a', 'Yes', 1],
    ['Gold Fund', 2, 'No', 1],
  ]);
  xlsx.utils.book_append_sheet(wb, data, 'Data');
  const calc = xlsx.utils.aoa_to_sheet([['Result']]) as Record<string, unknown>;
  const formulas = [
    'SUMIFS(Data!$B$2:$B$7,Data!$A$2:$A$7,"EQUITY")',
    'SUMIFS(Data!$B$2:$B$7,Data!$A$2:$A$7,"")',
    'SUMIFS(Data!$B$2:$B$7,Data!$A$2:$A$7,"Gold*")',
    'SUMIFS(Data!$B$2:$B$7,Data!$C$2:$C$7,"Yes")',
    'SUMIFS(Data!$B$2:$B$7,Data!$D$2:$D$7,$Z$1)',
    '1/0',
    'Data!A2+1',
    "'No Such Sheet'!A1+1",
    'IF(Data!B2>5,ROUND(2.675,2),0)',
    'IF(AND(TRUE,Data!B4=7),ROUND(-2.5,0),1)',
    'VLOOKUP(1,Data!A1:B2,2)',
    'SUM(Data!B2:B7)',
    'Z1+2',
    'SUMIFS(Data!$B$2:$B$7,Data!$A$2:$A$6,"Debt")',
    'IF(OR(FALSE,0),1,IF(1,2,3))',
    'MAX(Data!B2:B7)-MIN(Data!B2:B7)+ABS(-1)',
    'SUMIFS(Data!$B$2:$B$7,Data!$A$2:$A$7,"<>Equity",Data!$C$2:$C$7,"Yes")',
    '-(2+3)*4',
  ];
  formulas.forEach((f, i) => { calc[`A${i + 2}`] = { t: 'n', f }; });
  calc['!ref'] = `A1:A${formulas.length + 1}`;
  xlsx.utils.book_append_sheet(wb, calc, 'Calc');
  return readWorkbookForEval(writeXlsx(xlsx, wb));
}

test('SUMIFS: case-insensitive equality, blank criterion, wildcard, text in the sum range, empty-cell criterion', () => {
  const v = evaluateAll(workbook());
  assert.equal(v.get('Calc!A2'), 15, '"EQUITY" matches Equity and equity; the text n/a in the sum range is ignored');
  assert.equal(v.get('Calc!A3'), 3, 'a criterion "" matches the blank class');
  assert.equal(v.get('Calc!A4'), 2, 'Gold* matches Gold Fund');
  assert.equal(v.get('Calc!A5'), 25, '"Yes" matches Yes and yes: 10 + 5 + 7 + 3');
  assert.equal(v.get('Calc!A6'), 5, 'a criterion that refers to an empty cell counts as 0: the row with Zero 0');
  assert.equal(v.get('Calc!A18'), 10, '"<>Equity" (letter case ignored, blanks match) with Yes: Debt 7 + blank 3; Gold Fund is No');
});

test('errors: #DIV/0!, #VALUE!, #REF!, #NAME?, and a SUMIFS with ranges of different sizes', () => {
  const v = evaluateAll(workbook());
  assert.deepEqual(v.get('Calc!A7'), { error: '#DIV/0!' });
  assert.deepEqual(v.get('Calc!A8'), { error: '#VALUE!' }, 'text in arithmetic');
  assert.deepEqual(v.get('Calc!A9'), { error: '#REF!' }, 'an unknown sheet');
  assert.deepEqual(v.get('Calc!A12'), { error: '#NAME?' }, 'a function outside the subset');
  assert.deepEqual(v.get('Calc!A15'), { error: '#VALUE!' }, 'ranges of different sizes');
});

test('IF, AND, OR, ROUND (half away from zero), SUM, MIN, MAX, ABS, a blank in arithmetic, precedence', () => {
  const v = evaluateAll(workbook());
  assert.equal(v.get('Calc!A10'), 2.68, 'ROUND(2.675,2) is 2.68 in Excel, although 2.675 is stored below it');
  assert.equal(v.get('Calc!A11'), -3, 'ROUND(-2.5,0) rounds away from zero');
  assert.equal(v.get('Calc!A13'), 27, 'SUM over a range ignores text: 10 + 5 + 7 + 3 + 2');
  assert.equal(v.get('Calc!A14'), 2, 'a blank cell is 0 in arithmetic');
  assert.equal(v.get('Calc!A16'), 2, 'nested IF');
  assert.equal(v.get('Calc!A17'), 10 - 2 + 1);
  assert.equal(v.get('Calc!A19'), -20);
});

test('withEdit changes one input and its dependents only', () => {
  const wb = workbook();
  const edited = evaluateAll(withEdit(wb, 'Data!B2', 100));
  assert.equal(edited.get('Calc!A2'), 105);
  assert.equal(edited.get('Calc!A5'), 115);
  assert.equal(edited.get('Calc!A4'), 2, 'not a dependent');
  assert.equal(evaluateAll(wb).get('Calc!A2'), 15, 'the original workbook is unchanged');
});

test('evaluateFormula on a sheet, and an error value is recognised', () => {
  const wb = workbook();
  assert.equal(evaluateFormula(wb, 'Calc', 'SUMIFS(Data!$B$2:$B$7,Data!$A$2:$A$7,"debt")'), 7);
  assert.ok(isError(evaluateFormula(wb, 'Calc', 'Data!B6*2')), 'text n/a times 2');
  assert.equal(evaluateFormula(wb, 'Calc', '"a"="A"'), true, 'text comparison ignores letter case');
  assert.equal(evaluateFormula(wb, 'Calc', '1<"a"'), true, 'numbers sort before text');
});
