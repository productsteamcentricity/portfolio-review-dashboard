// covers: E-77 E-79 BR-14.3 U-52 KI-094 D-039
// The workbook's money in Indian grouping (D-039 point 5: the conditional pattern of units, so a Lakh book above
// 1,00,000 L reads as on screen) and the cases of the Office acceptance (scripts/office/run-acceptance.ts --full,
// built by tests/helpers/node-wiring.ts acceptanceFiles()): syn-negative-gain with the negative red at Portfolio
// Overview!I2, the date format at Holdings (as loaded)!R2, and the screen's text of every figure the _manifest
// places, which accept-xlsx.ps1 compares with Range.Text. Here, without Office, each of those texts must equal what
// Excel shows for the cell's evaluated value (tests/helpers/excel-text.ts, written apart from the app's formatter).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NUM_FMT_CODES } from '../../../app/src/exports/xlsx/styles.ts';
import { acceptanceFiles, ACCEPTANCE_FIXTURES, bigLakhFixture, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { expectedFor, expectedTexts, type XlsxCase } from '../../../scripts/office/run-acceptance.ts';
import { evaluateAll, readWorkbookForEval } from '../../helpers/formula-eval.ts';
import { readXlsx, sheetByName } from '../../helpers/xlsx-read.ts';
import { excelText } from '../../helpers/excel-text.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';

const SSF = (loadSheetJS() as unknown as { SSF: { format: (f: string, v: number) => string } }).SSF;

describe('money in Indian grouping (D-039 point 5)', () => {
  test('the money format is the units pattern with two decimals; from 1,00,000 it groups as on screen', () => {
    assert.equal(NUM_FMT_CODES.money, '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00');
    assert.equal(NUM_FMT_CODES.money, NUM_FMT_CODES.units.replace(/0\.000/g, '0.00'));
    // SheetJS's renderer of Excel formats (it renders the two conditional sections; below 1,00,000 the locale's
    // grouping, the same in Indian and Western form, applies).
    assert.equal(SSF.format(NUM_FMT_CODES.money, 123456.789), '1,23,456.79');
    assert.equal(SSF.format(NUM_FMT_CODES.money, 100000), '1,00,000.00');
    assert.equal(SSF.format(NUM_FMT_CODES.money, 12345678.9), '1,23,45,678.90');
    assert.equal(SSF.format(NUM_FMT_CODES.money, 335300), '3,35,300.00');
  });

  test('a Lakh book above 1,00,000 L: the Grand Total is 3,35,300.00 on screen and in the sheet\'s format', async () => {
    const w = nodeWiring();
    const { review, vm } = reviewOf(w, bigLakhFixture());
    assert.equal(vm.meta.unit, 'lakh');
    const cmv = vm.kpis.find((k) => k.id === 'cmv')!.figure;
    // Rs 6,25,00,00,000 + 4,52,00,00,000 + 8,96,00,00,000 + 3,39,00,00,000 + 1,31,00,00,000 + 9,10,00,00,000
    // = Rs 33,53,00,00,000 = 3,35,300 Lakh.
    assert.equal(cmv.display.text, '3,35,300.00');
    await w.exportWorkbook(review, vm);
    const bytes = w.last.xlsx!.bytes;
    const v = evaluateAll(readWorkbookForEval(bytes));
    const g11 = v.get('Portfolio Overview!G11') as number;
    assert.ok(Math.abs(g11 - 335300) < 1e-6, String(g11));
    const wb = readXlsx(bytes);
    const cell = sheetByName(wb, 'Portfolio Overview').cells.get('G11')!;
    assert.equal(wb.styles!.numFmts.get(wb.styles!.xfs[cell.s]!.numFmtId), NUM_FMT_CODES.money);
    assert.equal(SSF.format(NUM_FMT_CODES.money, g11), cmv.display.text);
  });
});

describe('the Office acceptance cases (L4, L8, L24)', async () => {
  const files = await acceptanceFiles();
  const cases = files.xlsx as XlsxCase[];

  test('six workbooks and six decks, syn-negative-gain and big-lakh among them', () => {
    assert.deepEqual(cases.map((c) => c.id), ACCEPTANCE_FIXTURES.map((id) => `wired-${id}`));
    assert.equal(files.pptx.length, ACCEPTANCE_FIXTURES.length);
  });

  test('syn-negative-gain: Portfolio Overview!I2 (the Equity gain) is negative and is the cell the red is checked on', () => {
    const c = cases.find((x) => x.id === 'wired-syn-negative-gain')!;
    assert.deepEqual(c.negative, { sheet: 'Portfolio Overview', cell: 'I2' });
    const v = evaluateAll(readWorkbookForEval(c.bytes)).get('Portfolio Overview!I2') as number;
    // Equity at 70%: (0.625 + 0.452 + 0.91) x 0.7 - (0.5 + 0.4 + 0.75) = 1.3909 - 1.65 = -0.2591.
    assert.ok(Math.abs(v - -0.2591) < 1e-9, String(v));
    assert.deepEqual(expectedFor(c).negative, { sheet: 'Portfolio Overview', cell: 'I2', colour: '#931621' });
  });

  test('every case checks the date format on Holdings (as loaded)!R2 and the Indian money format', () => {
    for (const c of cases) {
      assert.ok(c.formats.some((f) => f.sheet === 'Holdings (as loaded)' && f.cell === 'R2' && f.numberFormat === 'd mmm yyyy'), c.id);
      assert.ok(c.formats.some((f) => f.cell === 'G2' && f.numberFormat === NUM_FMT_CODES.money), c.id);
    }
  });

  test('every figure of the _manifest has the screen\'s text, and it is what Excel shows for the evaluated value', () => {
    for (const c of cases) {
      const texts = expectedTexts(c);
      const values = evaluateAll(readWorkbookForEval(c.bytes));
      const figures = texts.filter((t) => t.key !== null);
      assert.ok(figures.length > 20, `${c.id}: ${figures.length} figure texts`);
      for (const t of texts) {
        const v = values.get(`${t.sheet}!${t.cell}`);
        assert.equal(typeof v, 'number', `${c.id} ${t.sheet}!${t.cell}`);
        const pct = t.text.endsWith('%');
        const body = pct ? t.text.slice(0, -1) : t.text;
        const dot = body.indexOf('.');
        assert.equal(excelText(v as number, dot < 0 ? 0 : body.length - dot - 1) + (pct ? '%' : ''), t.text, `${c.id} ${t.key ?? ''} ${t.sheet}!${t.cell}`);
      }
      assert.deepEqual(expectedFor(c).texts, texts);
    }
    const big = cases.find((x) => x.id === 'wired-big-lakh')!;
    assert.ok(expectedTexts(big).some((t) => t.cell === 'G11' && t.text === '3,35,300.00'));
  });

  test('a figure of the _manifest without a screen text is an error, never a silent pass', () => {
    const c = cases[0]!;
    assert.throws(() => expectedTexts({ ...c, figureTexts: {} }), /no screen text for the figure/);
  });
});
