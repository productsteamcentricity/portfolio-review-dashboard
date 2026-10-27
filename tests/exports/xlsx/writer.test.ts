// covers: E-75 BR-10.1
// The in-house SpreadsheetML writer: schema element order in every part, reserved fills, escaping and XML 1.0
// illegal characters, Excel's 32,767-character cell limit, fullCalcOnLoad, no calcChain, sharedStrings or docProps,
// one hidden _xlnm._FilterDatabase per filter, a visible active tab. Read back with tests/helpers/xlsx-read.ts,
// which shares no code with the writer.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeWorkbook } from '../../../app/src/exports/xlsx/writer.ts';
import type { SheetSpec, WorkbookSpec } from '../../../app/src/exports/xlsx/spec.ts';
import { readXlsx, kid, kids, local, type ReadWorkbook } from '../../helpers/xlsx-read.ts';
import { partText } from '../../helpers/unzip.ts';
import { spikeWorkbookSpec, sampleInput } from './sample-input.ts';
import { buildOverviewWorkbook } from '../../../app/src/exports/xlsx/overview-workbook.ts';

const WORKSHEET_ORDER = ['sheetPr', 'dimension', 'sheetViews', 'sheetFormatPr', 'cols', 'sheetData', 'sheetCalcPr',
  'sheetProtection', 'protectedRanges', 'scenarios', 'autoFilter', 'sortState', 'dataConsolidate', 'customSheetViews',
  'mergeCells', 'phoneticPr', 'conditionalFormatting', 'dataValidations', 'hyperlinks', 'printOptions', 'pageMargins',
  'pageSetup', 'headerFooter'];
const WORKBOOK_ORDER = ['fileVersion', 'fileSharing', 'workbookPr', 'workbookProtection', 'bookViews', 'sheets',
  'functionGroups', 'externalReferences', 'definedNames', 'calcPr'];
const STYLES_ORDER = ['numFmts', 'fonts', 'fills', 'borders', 'cellStyleXfs', 'cellXfs', 'cellStyles', 'dxfs', 'tableStyles'];

function inSchemaOrder(actual: string[], schema: string[]): boolean {
  let last = -1;
  for (const a of actual) {
    const i = schema.indexOf(a);
    if (i < 0 || i < last) return false;
    last = i;
  }
  return true;
}

function oneSheet(sheet: Partial<SheetSpec>): WorkbookSpec {
  return {
    sheets: [{ name: 'Data', columns: [{ header: 'Text', width: 30 }, { header: 'Number', width: 12 }], rows: [], freeze: { rows: 1, cols: 0 }, filter: true, ...sheet }],
    definedNames: [],
  };
}

describe('element order in every part', () => {
  const books: Array<[string, ReadWorkbook]> = [
    ['spike', readXlsx(writeWorkbook(spikeWorkbookSpec()))],
    ['overview hostile', readXlsx(buildOverviewWorkbook(sampleInput('hostile')))],
  ];
  for (const [name, wb] of books) {
    test(`${name}: worksheet, workbook and styles children follow the schema`, () => {
      for (const s of wb.sheets) {
        assert.ok(inSchemaOrder(s.order, WORKSHEET_ORDER), `${s.name}: ${s.order.join(', ')}`);
        const view = kid(kid(s.root, 'sheetViews')!, 'sheetView')!;
        const names = kids(view).map((k) => local(k.name));
        assert.ok(names.indexOf('pane') < 0 || names.indexOf('pane') < names.indexOf('selection'), 'pane before selection');
      }
      assert.ok(inSchemaOrder(kids(wb.workbookXml).map((k) => local(k.name)), WORKBOOK_ORDER));
      assert.ok(inSchemaOrder(wb.styles!.order, STYLES_ORDER));
      assert.deepEqual(wb.styles!.order, STYLES_ORDER);
    });
  }
});

test('reserved fills, the house font and the negative dxf', () => {
  const st = readXlsx(writeWorkbook(spikeWorkbookSpec())).styles!;
  assert.equal(st.fills[0]!.pattern, 'none');
  assert.equal(st.fills[1]!.pattern, 'gray125');
  assert.ok(st.fonts.every((f) => f.name === 'Cambria' && f.size === 9));
  assert.equal(st.dxfs.length, 1);
  assert.equal(kid(kid(st.dxfs[0]!, 'font')!, 'color')!.attrs.rgb, 'FF931621');
  assert.equal(st.numFmts.get(164), '#,##0.00');
  assert.equal(st.numFmts.get(165), '0.00"%"');
  assert.equal(st.numFmts.get(166), '[>=10000000]##\\,##\\,##\\,##0.000;[>=100000]##\\,##\\,##0.000;##,##0.000');
  assert.equal(st.numFmts.get(167), 'd mmm yyyy');
});

test('escaping, XML 1.0 illegal characters, carriage returns and Excel escapes round trip', () => {
  const texts = ['a & b < c > d " e \' f', 'bell\u0007 nul\u0000 fffe\uFFFE end', 'lone \uD800 high', 'pair \uD83D\uDE00 kept',
    'one\r\ntwo\tthree', 'literal _x0041_ stays', '  leading and trailing spaces  '];
  const wb = readXlsx(writeWorkbook(oneSheet({ rows: texts.map((t) => [{ kind: 'str', v: t }]) })));
  const got = texts.map((_, i) => wb.sheets[0]!.cells.get(`A${i + 2}`)!.v);
  assert.deepEqual(got, ['a & b < c > d " e \' f', 'bell nul fffe end', 'lone  high', 'pair \uD83D\uDE00 kept',
    'one\r\ntwo\tthree', 'literal _x0041_ stays', '  leading and trailing spaces  ']);
  for (let i = 0; i < texts.length; i++) assert.equal(wb.sheets[0]!.cells.get(`A${i + 2}`)!.t, 'inlineStr');
});

test('a 40,000-character string is capped at 32,767 characters, never splitting a surrogate pair', () => {
  const long = 'x'.repeat(40_000);
  const pairAtEdge = 'y'.repeat(32_766) + '\uD83D\uDE00' + 'z';
  const wb = readXlsx(writeWorkbook(oneSheet({ rows: [[{ kind: 'str', v: long }], [{ kind: 'str', v: pairAtEdge }]] })));
  assert.equal(String(wb.sheets[0]!.cells.get('A2')!.v).length, 32_767);
  assert.equal(wb.sheets[0]!.cells.get('A3')!.v, 'y'.repeat(32_766));
});

test('quotePrefix on a string that starts with = + - @, a tab or a carriage return, and never a formula', () => {
  const texts = ['=1+1', '+1', '-1', '@x', '\tx', '\rx', 'plain', ' =not first'];
  const wb = readXlsx(writeWorkbook(oneSheet({ rows: texts.map((t) => [{ kind: 'str', v: t }]) })));
  const qp = texts.map((_, i) => {
    const c = wb.sheets[0]!.cells.get(`A${i + 2}`)!;
    assert.equal(c.f, null);
    return wb.styles!.xfs[c.s]!.quotePrefix;
  });
  assert.deepEqual(qp, [true, true, true, true, true, true, false, false]);
});

test('fullCalcOnLoad, no calcChain, sharedStrings or docProps, a visible active tab, content types for every part', () => {
  const bytes = writeWorkbook(spikeWorkbookSpec());
  const wb = readXlsx(bytes);
  const calcPr = kid(wb.workbookXml, 'calcPr')!;
  assert.equal(calcPr.attrs.fullCalcOnLoad, '1');
  assert.equal(calcPr.attrs.calcId, '191029');
  const parts = [...wb.zip.files.keys()];
  assert.deepEqual(parts, ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
    'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml', 'xl/worksheets/sheet4.xml']);
  const view = kid(kid(wb.workbookXml, 'bookViews')!, 'workbookView')!;
  assert.equal(view.attrs.activeTab, '0');
  assert.equal(wb.sheets[0]!.state, 'visible');
  assert.deepEqual(wb.sheets.map((s) => kid(kid(s.root, 'sheetViews')!, 'sheetView')!.attrs.tabSelected ?? '0'), ['1', '0', '0', '0']);
  assert.equal(wb.sheets[3]!.state, 'hidden');
  const ct = partText(wb.zip, '[Content_Types].xml');
  for (const p of parts.filter((n) => n.startsWith('xl/') && !n.includes('_rels'))) assert.ok(ct.includes(`PartName="/${p}"`), p);
  assert.throws(() => writeWorkbook({ sheets: [{ ...spikeWorkbookSpec().sheets[0]!, hidden: 'hidden' }], definedNames: [] }), /visible/);
});

test('one hidden _xlnm._FilterDatabase per filtered sheet, over the autoFilter range', () => {
  const wb = readXlsx(writeWorkbook(spikeWorkbookSpec()));
  wb.sheets.forEach((s, i) => {
    const af = kid(s.root, 'autoFilter')!;
    const names = wb.definedNames.filter((d) => d.name === '_xlnm._FilterDatabase' && d.localSheetId === i);
    assert.equal(names.length, 1, s.name);
    assert.equal(names[0]!.hidden, true);
    assert.equal(names[0]!.ref, `'${s.name}'!${af.attrs.ref!.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}`);
  });
});

test('frozen panes as declared, one conditional format per declared rule, sheet protection on the manifest only', () => {
  const wb = readXlsx(writeWorkbook(spikeWorkbookSpec()));
  const pane = (i: number) => kid(kid(kid(wb.sheets[i]!.root, 'sheetViews')!, 'sheetView')!, 'pane')!.attrs;
  assert.deepEqual([pane(1).xSplit, pane(1).ySplit, pane(1).topLeftCell, pane(1).state], ['1', '1', 'B2', 'frozen']);
  assert.deepEqual([pane(2).xSplit, pane(2).ySplit, pane(2).topLeftCell], [undefined, '1', 'A2']);
  const cf = kid(wb.sheets[1]!.root, 'conditionalFormatting')!;
  assert.equal(cf.attrs.sqref, 'F2:F10 G2:G10 H2:H10');
  const rule = kid(cf, 'cfRule')!;
  assert.deepEqual([rule.attrs.type, rule.attrs.operator, rule.attrs.dxfId], ['cellIs', 'lessThan', '0']);
  assert.deepEqual(wb.sheets.map((s) => kid(s.root, 'sheetProtection') !== undefined), [false, false, false, true]);
  assert.ok(wb.sheets.every((s) => kid(s.root, 'mergeCells') === undefined));
});

test('the writer refuses what Excel would repair or misread', () => {
  assert.throws(() => writeWorkbook(oneSheet({ rows: [[null, { kind: 'num', v: Number.NaN }]] })), /cannot write the number NaN/);
  assert.throws(() => writeWorkbook(oneSheet({ rows: [[null, { kind: 'num', v: Infinity }]] })), /Infinity/);
  assert.throws(() => writeWorkbook(oneSheet({ name: 'Bad/Name' })), /invalid sheet name/);
  assert.throws(() => writeWorkbook({ sheets: [oneSheet({}).sheets[0]!, { ...oneSheet({}).sheets[0]!, name: 'DATA' }], definedNames: [] }), /duplicate sheet name/);
  assert.throws(() => writeWorkbook(oneSheet({ rows: [[null, null, { kind: 'str', v: 'too wide' }]] })), /wider than its table/);
});

test('numbers are written as the shortest text that reads back as the same double', () => {
  const values = [0.1 + 0.2, 59.26036385326573, -0.05, 1e-7, 12345678901234.5, 0];
  const wb = readXlsx(writeWorkbook(oneSheet({ rows: values.map((v) => [null, { kind: 'num', v }]) })));
  assert.deepEqual(values.map((_, i) => wb.sheets[0]!.cells.get(`B${i + 2}`)!.v), values);
});
