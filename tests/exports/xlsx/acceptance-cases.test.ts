// covers: E-77 E-79 BR-14.3 U-52 KI-094 D-039
// The workbook's money in Indian grouping (D-039 point 5: the conditional pattern of units, so a Lakh book above
// 1,00,000 L reads as on screen; the fix round 2, N8: the conditions at the rounding edge) and the cases of the Office
// acceptance (scripts/office/run-acceptance.ts --full, built by tests/helpers/node-wiring.ts acceptanceFiles()):
// syn-negative-gain with the negative red at Portfolio Overview!I2, the date format at Holdings (as loaded)!R2, each
// sheet's autoFilter range (N7: Excel's must equal the file's, so the share row stays out), syn-big-return (N9: an
// absolute return of 1,900.00% in the percent format), syn-six-classes (N13: the REITs/InvITs slice centred on
// 6 o'clock), and the screen's text of every figure the _manifest places, which accept-xlsx.ps1 compares with
// Range.Text. Here, without Office, each of those texts must equal what Excel shows for the cell's evaluated value in
// the number format written to that cell (tests/helpers/excel-text.ts, written apart from the app's formatter).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NUM_FMT_CODES } from '../../../app/src/exports/xlsx/styles.ts';
import { acceptanceFiles, ACCEPTANCE_FIXTURES, bigLakhFixture, fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { autoFilterRanges, expectedFor, expectedTexts, summaryLine, type XlsxCase } from '../../../scripts/office/run-acceptance.ts';
import { closeTo, evaluateAll, readWorkbookForEval } from '../../helpers/formula-eval.ts';
import { numberFormatAt, readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { excelFormatText, withoutZeroSign } from '../../helpers/excel-text.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { unzip } from '../../helpers/unzip.ts';

const SSF = (loadSheetJS() as unknown as { SSF: { format: (f: string, v: number) => string } }).SSF;

describe('money in Indian grouping (D-039 point 5, N8)', () => {
  test('the money format is the units pattern with two decimals, each condition at its rounding edge', () => {
    assert.equal(NUM_FMT_CODES.money, '[>=9999999.995]##\\,##\\,##\\,##0.00;[>=99999.995]##\\,##\\,##0.00;##,##0.00');
    assert.equal(NUM_FMT_CODES.money, NUM_FMT_CODES.units.replace(/\.9995\]/g, '.995]').replace(/0\.000/g, '0.00'));
    // SheetJS's renderer of Excel formats agrees inside the two conditional sections (it rounds the binary double,
    // so it is not asked about the rounding edge; tests/unit/exports/xlsx-number-formats.test.ts pins that).
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
    assert.equal(numberFormatAt(wb, 'Portfolio Overview', 'G11'), NUM_FMT_CODES.money);
    assert.equal(SSF.format(NUM_FMT_CODES.money, g11), cmv.display.text);
    assert.equal(excelFormatText(g11, NUM_FMT_CODES.money), cmv.display.text);
  });
});

describe('the Office acceptance cases (L4, L8, L24; N7, N9, N13)', async () => {
  const files = await acceptanceFiles();
  const cases = files.xlsx as XlsxCase[];

  test('eight workbooks and eight decks, syn-negative-gain, big-lakh, syn-six-classes and syn-big-return among them', () => {
    assert.deepEqual(cases.map((c) => c.id), ACCEPTANCE_FIXTURES.map((id) => `wired-${id}`));
    assert.deepEqual([...ACCEPTANCE_FIXTURES], ['syn-standard', 'syn-lakh', 'syn-blank-invested', 'syn-negative-gain', 'family-a', 'big-lakh',
      'syn-six-classes', 'syn-big-return']);
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

  test('every case checks the date format on Holdings (as loaded)!R2, the Indian money format and the percent format', () => {
    for (const c of cases) {
      assert.ok(c.formats.some((f) => f.sheet === 'Holdings (as loaded)' && f.cell === 'R2' && f.numberFormat === 'd mmm yyyy'), c.id);
      assert.ok(c.formats.some((f) => f.cell === 'G2' && f.numberFormat === NUM_FMT_CODES.money), c.id);
      assert.ok(c.formats.some((f) => f.cell === 'H2' && f.numberFormat === '#,##0.00"%"'), c.id);
    }
  });

  test('N7: expected.json carries each visible sheet\'s autoFilter range; the allocation filters stop at the Grand Total', () => {
    const c = cases.find((x) => x.id === 'wired-syn-standard')!;
    const filters = expectedFor(c).filters as Array<{ sheet: string; ref: string }>;
    const wb = readXlsx(c.bytes);
    assert.deepEqual(filters, autoFilterRanges(wb));
    assert.deepEqual(filters.map((f) => f.sheet), wb.sheets.filter((s) => s.state === 'visible').map((s) => s.name), 'every visible sheet has its filter');
    for (const name of ['Client Allocation', 'Distributor Allocation']) {
      // syn-standard: rows 2 to 10 hold the classes and products, 11 the Grand Total, 12 is blank, 13 the share.
      assert.deepEqual(filters.find((f) => f.sheet === name), { sheet: name, ref: 'A1:G11' }, name);
      const t = sheetTable(sheetByName(wb, name));
      assert.deepEqual([t[10]![0], t[11]![0], t[12]![0]], ['Grand Total', null, 'Share of family (%)'], name);
    }
  });

  test('N9 syn-big-return: Commodity\'s absolute return reads 1,900.00% on screen and in Excel\'s percent format', () => {
    const w = nodeWiring();
    const { vm } = reviewOf(w, fixtureById('syn-big-return'));
    const commodity = vm.allocation.rows.find((r) => r.kind === 'asset' && r.asset === 'Commodity')!;
    // Invested 1,00,000 rupees = 0.01 Cr at 20,00,000 = 0.2 Cr: (0.2 - 0.01) / 0.01 x 100 = 1,900.
    assert.ok(commodity.absReturn.shown.kind === 'value' && closeTo(commodity.absReturn.shown.v, 1900));
    assert.equal(commodity.absReturn.display.text, '1,900.00%');
    // The family: invested 2.85 - 0.1 + 0.01 = 2.76 Cr, value 3.353 - 0.131 + 0.2 = 3.422 Cr, gain 0.662 Cr,
    // 0.662 / 2.76 x 100 = 23.9855...%.
    assert.equal(vm.kpis.find((k) => k.id === 'cmv')!.figure.display.text, '3.42');
    const c = cases.find((x) => x.id === 'wired-syn-big-return')!;
    const wb = readXlsx(c.bytes);
    const values = evaluateAll(readWorkbookForEval(c.bytes));
    const t = sheetTable(sheetByName(wb, 'Portfolio Overview'));
    const rows = t.map((r, i) => ({ r, n: i + 1 })).filter(({ r }) => r[1] === 'Commodity' && r[0] !== 'Liquidity');
    assert.equal(rows.length, 2, 'the Commodity row and its product row');
    for (const { n } of rows) {
      const at = `J${n}`;
      const v = values.get(`Portfolio Overview!${at}`) as number;
      assert.ok(closeTo(v, 1900), `${at}: ${v}`);
      assert.equal(numberFormatAt(wb, 'Portfolio Overview', at), '#,##0.00"%"');
      assert.equal(excelFormatText(v, '#,##0.00"%"'), '1,900.00%', at);
      assert.equal(SSF.format(NUM_FMT_CODES.pct, v), '1,900.00%', `${at} (SheetJS)`);
      assert.equal(excelFormatText(v, '0.00"%"'), '1900.00%', `${at}: the old format did not group`);
    }
    assert.ok(expectedTexts(c, wb).some((x) => x.text === '1,900.00%' && x.sheet === 'Portfolio Overview'), 'Office compares Range.Text with 1,900.00%');
  });

  test('N13 syn-six-classes: six slices of 15, 15, 10, 5, 10 and 45%, REITs/InvITs from 45% to 55%, centred on 6 o\'clock', async () => {
    const w = nodeWiring();
    const { review, vm } = reviewOf(w, fixtureById('syn-six-classes'));
    const slices = vm.charts.asset.slices;
    assert.deepEqual(slices.map((s) => s.category), ['Equity', 'Debt', 'Hybrid', 'Commodity', 'REITs/InvITs', 'Unknown']);
    const pct = slices.map((s) => (s.pct.shown.kind === 'value' ? s.pct.shown.v : Number.NaN));
    [15, 15, 10, 5, 10, 45].forEach((x, i) => assert.ok(closeTo(pct[i]!, x), `${slices[i]!.category}: ${pct[i]}`));
    const before = pct.slice(0, 4).reduce((a, b) => a + b, 0);
    // From 12 o'clock, clockwise: the slice runs from 45% to 55% of the circle, so its middle is at 50%, 180 degrees.
    assert.ok(closeTo((before + pct[4]! / 2) * 3.6, 180), 'REITs/InvITs centred on 6 o\'clock');
    assert.ok(slices.every((s) => s.label !== null), 'every slice is 2% or more, so each has a label');
    // The deck starts its pie at 12 o'clock (firstSliceAng 0) and lists the six classes in its legend.
    await w.exportDeck(review, vm, null);
    const z = unzip(w.last.pptx!.bytes);
    const dec = new TextDecoder();
    const pies = z.entries.filter((e) => /^ppt\/charts\/chart\d+\.xml$/.test(e.name)).map((e) => dec.decode(e.data)).filter((x) => x.includes('<c:pieChart>'));
    const asset = pies.find((x) => x.includes('REITs/InvITs'));
    assert.ok(asset, 'the asset pie');
    assert.match(asset!, /<c:firstSliceAng val="0"\/>/);
    assert.match(asset!, /<c:legend>/);
    assert.ok(files.pptx.some((p) => (p as { id: string }).id === 'wired-syn-six-classes'), 'the Office run exports its slides as PNGs');
  });

  test('every figure of the _manifest has the screen\'s text, and it is what Excel shows in the cell\'s own format', () => {
    for (const c of cases) {
      const texts = expectedTexts(c);
      const wb = readXlsx(c.bytes);
      const values = evaluateAll(readWorkbookForEval(c.bytes));
      const figures = texts.filter((t) => t.key !== null);
      assert.ok(figures.length > 20, `${c.id}: ${figures.length} figure texts`);
      for (const t of texts) {
        const v = values.get(`${t.sheet}!${t.cell}`);
        assert.equal(typeof v, 'number', `${c.id} ${t.sheet}!${t.cell}`);
        const shown = withoutZeroSign(excelFormatText(v as number, numberFormatAt(wb, t.sheet, t.cell)));
        assert.equal(shown, t.text, `${c.id} ${t.key ?? ''} ${t.sheet}!${t.cell}`);
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

describe('the run\'s summary line names every stop of Office (N15)', () => {
  test('a workbook: excelKilled and negativeControl.excelKilled', () => {
    assert.equal(summaryLine({ id: 'wired-syn-standard', verdict: 'pass', excel: { excelKilled: false }, negativeControl: { excelKilled: true } }),
      'PASS     wired-syn-standard  excelKilled=false negativeControl.excelKilled=true');
    assert.equal(summaryLine({ id: 'x', verdict: 'not run', excel: { ran: false }, negativeControl: {} }),
      'NOT RUN  x  excelKilled=not run negativeControl.excelKilled=not run');
  });

  test('a deck: powerpointKilled and negativeControl.powerpointKilled', () => {
    assert.equal(summaryLine({ id: 'wired-family-a', verdict: 'fail', powerpoint: { powerpointKilled: false }, negativeControl: { powerpointKilled: false } }),
      'FAIL     wired-family-a  powerpointKilled=false negativeControl.powerpointKilled=false');
  });
});
