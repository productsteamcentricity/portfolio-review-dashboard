// covers: E-77 KI-084
// KI-084 (audit NEW-38): the legacy Asset Allocation sheet wrote the liquidity percentages into the "Investment
// Amount (Cr.)" column with the Crore format, so a Lakh book showed 92.55 under "Investment Amount (Lakhs)". In the
// new Portfolio Overview the liquidity rows hold amounts in the amount columns and the % in "% CMV".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewWorkbook } from '../../app/src/exports/xlsx/overview-workbook.ts';
import { evaluateAll, readWorkbookForEval, closeTo } from '../helpers/formula-eval.ts';
import { readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';
import { sampleInput } from '../exports/xlsx/sample-input.ts';
import { NUM_FMT_CODES } from '../../app/src/exports/xlsx/styles.ts';

for (const [name, invested, cmv] of [['standard', 2.85, 3.353], ['lakh', 285, 335.3]] as const) {
  test(`${name}: Open Ended holds its invested amount in F, its CMV in G and 100 % in H`, () => {
    const bytes = buildOverviewWorkbook(sampleInput(name));
    const wb = readXlsx(bytes);
    const po = sheetByName(wb, 'Portfolio Overview');
    const t = sheetTable(po);
    const r = t.findIndex((row) => row[0] === 'Liquidity' && row[3] === 'Open Ended') + 1;
    const unit = name === 'lakh' ? '(L)' : '(Cr.)';
    assert.deepEqual([t[0]![5], t[0]![6], t[0]![7]], [`Investment Amount ${unit}`, `Current Market Value ${unit}`, '% CMV']);
    const v = evaluateAll(readWorkbookForEval(bytes));
    assert.ok(closeTo(v.get(`Portfolio Overview!F${r}`) as number, invested), 'F is the invested amount, not a %');
    assert.ok(closeTo(v.get(`Portfolio Overview!G${r}`) as number, cmv));
    assert.ok(closeTo(v.get(`Portfolio Overview!H${r}`) as number, 100), 'H is the % of CMV');
    const fmt = (ref: string): string | undefined => wb.styles!.numFmts.get(wb.styles!.xfs[po.cells.get(ref)!.s]!.numFmtId);
    assert.equal(fmt(`F${r}`), NUM_FMT_CODES.money);
    assert.equal(fmt(`H${r}`), '0.00"%"');
  });
}
