// covers: E-156 U-06 D-036 (the blank capital-gains template, design capital-gains-upload.md §12)
// The template workbook read back as zip/XML and through SheetJS: the 29 headers in the export's order, the frozen
// header, no data rows, the Read Me rows with the merger instruction, and the column-default number formats (each
// `<col style>` resolved through styles.xml to the house date, money and units codes; PLAN-01 D3).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCgTemplate, cgTemplateSheet, cgTemplateReadMe, CG_TEMPLATE_INSTRUCTIONS, CG_TEMPLATE_SHEET, CG_TEMPLATE_README,
} from '../../../app/src/exports/xlsx/cg-template.ts';
import { readWorkbook, cellText } from '../../../app/src/ingest/workbook.ts';
import { NUM_FMT_CODES } from '../../../app/src/exports/xlsx/styles.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { unzip, partText } from '../../helpers/unzip.ts';
import { EXPORT_HEADERS } from '../../fixtures/make-cg-statements.ts';

const xlsx = loadSheetJS();
const bytes = buildCgTemplate();
const wb = readWorkbook(xlsx, bytes);

describe('blank capital-gains template (§12)', () => {
  test('two sheets: Capital Gains first, then Read Me', () => {
    assert.deepEqual(wb.sheets.map((s) => s.name), [CG_TEMPLATE_SHEET, CG_TEMPLATE_README]);
  });
  test('the 29 headers of the export in its order, trimmed; no data rows', () => {
    const s = wb.sheets[0]!;
    assert.deepEqual(s.rows[0]!.map((c) => cellText(c)), EXPORT_HEADERS.map((h) => h.trim()));
    assert.equal(s.rows.length, 1);
  });
  test('the header row is frozen on both sheets', () => {
    const parts = unzip(bytes);
    for (const n of [1, 2]) {
      const xml = partText(parts, `xl/worksheets/sheet${n}.xml`);
      assert.ok(/<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/.test(xml), `sheet${n}`);
    }
  });
  test('Read Me: one row per column (29 and the optional Folio Number), then the instructions, merger included', () => {
    const s = wb.sheets[1]!;
    assert.deepEqual(s.rows[0]!.map((c) => cellText(c)), ['Column', 'Required', 'What to enter', 'Unit']);
    const names = s.rows.slice(1, 31).map((r) => cellText(r[0]));
    assert.deepEqual(names, [...EXPORT_HEADERS.map((h) => h.trim()), 'Folio Number']);
    const req = new Map(s.rows.slice(1, 31).map((r) => [cellText(r[0]), cellText(r[1])]));
    assert.equal(req.get('Sale Date'), 'Yes');
    assert.equal(req.get('Client Name'), 'One of Account Name and Client Name');
    assert.equal(req.get('Asset Name'), 'One of Category Name and Asset Name');
    assert.equal(req.get('Tax Amount (₹)'), 'No');
    const text = s.rows.map((r) => r.map((c) => cellText(c)).join(' ')).join('\n');
    for (const t of CG_TEMPLATE_INSTRUCTIONS) assert.ok(text.includes(t), t);
    assert.ok(text.includes('Acquisition Date = Sale Date, Acquisition Price = Sale Price, LTCG G/L = 0 and STCG G/L = 0'));
    assert.ok(text.includes('Never enter a PAN'));
    assert.ok(!/[–—]/.test(text), 'no en or em dash (D-029)');
  });
  test('column-default number formats in the file: dates, money and units in the house codes', () => {
    const cols = new Map(cgTemplateSheet().columns.map((c) => [c.header, c.defaultStyle?.fmt]));
    assert.equal(cols.get('Sale Date'), 'date');
    assert.equal(cols.get('Sell Amount (₹)'), 'money');
    assert.equal(cols.get('Sale Unit'), 'units');
    const parts = unzip(bytes);
    const sheet = partText(parts, 'xl/worksheets/sheet1.xml');
    const styles = partText(parts, 'xl/styles.xml');
    const xfs = [...(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s.exec(styles)![1]!).matchAll(/<xf [^>]*numFmtId="(\d+)"/g)].map((m) => Number(m[1]));
    const codes = new Map([...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"\/>/g)].map((m) => [Number(m[1]), m[2]!.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')]));
    const colFmt = new Map([...sheet.matchAll(/<col min="(\d+)"[^>]* style="(\d+)"/g)].map((m) => [Number(m[1]), xfs[Number(m[2])]!]));
    assert.equal(colFmt.size, 29, 'every template column has a default style');
    const fmtOf = (header: string): string | number => {
      const id = colFmt.get(EXPORT_HEADERS.findIndex((h) => h.trim() === header) + 1)!;
      return codes.get(id) ?? id;
    };
    assert.equal(fmtOf('Sale Date'), NUM_FMT_CODES.date);
    assert.equal(fmtOf('Purchase Date'), NUM_FMT_CODES.date);
    assert.equal(fmtOf('Sell Amount (₹)'), NUM_FMT_CODES.money);
    assert.equal(fmtOf('Purchase Price (₹)'), NUM_FMT_CODES.money);
    assert.equal(fmtOf('Sale Unit'), NUM_FMT_CODES.units);
    assert.equal(fmtOf('Account Name'), 49, 'text columns take the built-in text format');
    assert.equal(cgTemplateReadMe().rows.length, 30 + 1 + CG_TEMPLATE_INSTRUCTIONS.length);
  });
  test('SheetJS (the round trip\'s reader) reads the 29 column definitions', () => {
    const wb2 = xlsx.read(bytes, { type: 'array', cellStyles: true }) as unknown as { Sheets: Record<string, Record<string, unknown>> };
    const cols = wb2.Sheets[CG_TEMPLATE_SHEET]!['!cols'] as unknown[] | undefined;
    assert.ok(Array.isArray(cols) && cols.length === 29);
  });
  test('deterministic bytes', () => {
    // Compared by content: SheetJS's reader decorates the array it reads with helper properties.
    assert.equal(Buffer.compare(Buffer.from(buildCgTemplate()), Buffer.from(bytes)), 0);
  });
});
