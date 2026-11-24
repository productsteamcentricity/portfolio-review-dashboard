// The in-house SpreadsheetML writer (M1.4; architecture A3 as amended by D-038; spike gate R1).
// writeWorkbook turns a WorkbookSpec into .xlsx bytes, synchronously and deterministically: a STORE zip of
// [Content_Types].xml, the package and workbook relationships, the workbook, the styles and one part per sheet.
// No calcChain, no sharedStrings (strings are inline), no docProps. Element order follows the schema
// (ECMA-376 Part 1, CT_Worksheet, CT_Workbook, CT_Stylesheet); Excel repairs a part whose order is wrong.

import type { CellSpec, SheetSpec, WorkbookSpec } from './spec.ts';
import type { WorkbookLayout } from './layout.ts';
import { columnKey, columnLetter, excelRow, layoutOf, sheetPrefix } from './layout.ts';
import { renderFormula } from './formula.ts';
import { HEADER_STYLE, NEGATIVE_DXF, StyleTable } from './styles.ts';
import { assertSheetNames } from './sheet-names.ts';
import { attrText, cellText, escapeXml, numberText, XML_DECLARATION } from './xml.ts';
import { storeZip } from '../zip/store-zip.ts';
import {
  NS_CONTENT_TYPES, NS_MAIN, NS_PACKAGE_RELATIONSHIPS, NS_RELATIONSHIPS, REL_OFFICE_DOCUMENT, REL_STYLES, REL_WORKSHEET,
} from '../ooxml/namespaces.ts';

/** Excel's calculation engine id of current Office builds; with fullCalcOnLoad Excel recalculates on open. */
export const CALC_ID = 191029;
const DEFAULT_ROW_HEIGHT = 12;
const QUOTE_PREFIX_RE = /^[=+\-@\t\r]/;

/** A formula as written: its sheet, its cell and its text. */
export type WrittenFormula = { sheet: string; cell: string; text: string };

function checkSpec(spec: WorkbookSpec): void {
  if (spec.sheets.length === 0) throw new Error('workbook: no sheet');
  assertSheetNames(spec.sheets.map((s) => s.name));
  if (spec.sheets[0]!.hidden) throw new Error('workbook: the first sheet (the active tab) must be visible');
  for (const s of spec.sheets) {
    if (s.columns.length === 0) throw new Error(`workbook: sheet "${s.name}" has no column`);
    s.rows.forEach((r, i) => {
      if (r.length > s.columns.length) throw new Error(`workbook: row ${i} of "${s.name}" is wider than its table`);
    });
    if (s.freeze.rows < 0 || s.freeze.cols < 0 || s.freeze.cols >= s.columns.length) throw new Error(`workbook: bad freeze on "${s.name}"`);
  }
}

/** Every formula of the workbook, rendered, in sheet then row then column order. */
export function renderFormulas(spec: Pick<WorkbookSpec, 'sheets'>, layout: WorkbookLayout = layoutOf(spec.sheets)): WrittenFormula[] {
  const out: WrittenFormula[] = [];
  for (const s of spec.sheets) {
    s.rows.forEach((row, ri) => row.forEach((c, ci) => {
      if (c && c.kind === 'fx') {
        const col = s.columns[ci]!;
        const text = renderFormula(c.f, layout, { sheet: s.name, header: columnKey(col), row: ri });
        out.push({ sheet: s.name, cell: `${columnLetter(ci)}${excelRow(ri)}`, text });
      }
    }));
  }
  return out;
}

function lastRef(s: SheetSpec): string {
  return `${columnLetter(s.columns.length - 1)}${Math.max(1, s.rows.length + 1)}`;
}

/** The data rows the autoFilter and the conditional formats cover: the first `tableRows`, else every row. */
function tableRowCount(s: SheetSpec): number {
  const n = s.tableRows ?? s.rows.length;
  if (!Number.isInteger(n) || n < 0 || n > s.rows.length) throw new Error(`workbook: bad tableRows ${String(n)} on "${s.name}"`);
  return n;
}

/** The last cell of the table under the filter. */
function tableLastRef(s: SheetSpec): string {
  return `${columnLetter(s.columns.length - 1)}${Math.max(1, tableRowCount(s) + 1)}`;
}

function paneXml(s: SheetSpec): string {
  const { rows, cols } = s.freeze;
  if (rows === 0 && cols === 0) return '<selection activeCell="A1" sqref="A1"/>';
  const tl = `${columnLetter(cols)}${rows + 1}`;
  if (cols === 0) {
    return `<pane ySplit="${rows}" topLeftCell="${tl}" activePane="bottomLeft" state="frozen"/>`
      + `<selection pane="bottomLeft" activeCell="${tl}" sqref="${tl}"/>`;
  }
  if (rows === 0) {
    return `<pane xSplit="${cols}" topLeftCell="${tl}" activePane="topRight" state="frozen"/>`
      + `<selection pane="topRight" activeCell="${tl}" sqref="${tl}"/>`;
  }
  const tr = `${columnLetter(cols)}1`;
  const bl = `A${rows + 1}`;
  return `<pane xSplit="${cols}" ySplit="${rows}" topLeftCell="${tl}" activePane="bottomRight" state="frozen"/>`
    + `<selection pane="topRight" activeCell="${tr}" sqref="${tr}"/>`
    + `<selection pane="bottomLeft" activeCell="${bl}" sqref="${bl}"/>`
    + `<selection pane="bottomRight" activeCell="${tl}" sqref="${tl}"/>`;
}

function stringCell(ref: string, v: string, style: number): string {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${cellText(v)}</t></is></c>`;
}

function sheetXml(s: SheetSpec, index: number, styles: StyleTable, formulas: Map<string, string>): string {
  const parts: string[] = [];
  parts.push(`<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_RELATIONSHIPS}">`);
  parts.push(`<dimension ref="A1:${lastRef(s)}"/>`);
  parts.push(`<sheetViews><sheetView${index === 0 ? ' tabSelected="1"' : ''} workbookViewId="0">${paneXml(s)}</sheetView></sheetViews>`);
  parts.push(`<sheetFormatPr defaultRowHeight="${DEFAULT_ROW_HEIGHT}"/>`);
  parts.push(`<cols>${s.columns.map((c, i) => {
    if (!(c.width > 0 && c.width <= 255)) throw new Error(`workbook: bad width on "${s.name}" ${c.header}`);
    return `<col min="${i + 1}" max="${i + 1}" width="${numberText(c.width)}" customWidth="1"/>`;
  }).join('')}</cols>`);

  const rows: string[] = [];
  rows.push(`<row r="1">${s.columns.map((c, i) => {
    const ref = `${columnLetter(i)}1`;
    const style = QUOTE_PREFIX_RE.test(c.header) ? styles.quoted(HEADER_STYLE) : styles.id(HEADER_STYLE);
    return stringCell(ref, c.header, style);
  }).join('')}</row>`);
  s.rows.forEach((row, ri) => {
    // A row with no cell at all is a blank row: nothing is written for it, not even a styled empty cell, so Excel
    // sees an empty row (the gap that keeps the share row out of the autoFilter; entity-allocation.ts).
    if (row.length === 0) return;
    const r = excelRow(ri);
    const rowStyle = s.rowStyles?.[ri];
    const cells = s.columns.map((col, ci) => {
      const ref = `${columnLetter(ci)}${r}`;
      const c: CellSpec = row[ci] ?? null;
      if (c === null) return `<c r="${ref}" s="${styles.id(col.style, rowStyle)}"/>`;
      if (c.kind === 'str') {
        const style = QUOTE_PREFIX_RE.test(c.v) ? styles.quoted(col.style, rowStyle, c.style) : styles.id(col.style, rowStyle, c.style);
        return stringCell(ref, c.v, style);
      }
      const style = styles.id(col.style, rowStyle, c.style);
      if (c.kind === 'num') return `<c r="${ref}" s="${style}"><v>${numberText(c.v)}</v></c>`;
      const text = formulas.get(`${ci}:${ri}`);
      if (text === undefined) throw new Error(`workbook: formula at ${ref} not rendered`);
      return `<c r="${ref}" s="${style}"><f>${escapeXml(text)}</f><v>${numberText(c.cached)}</v></c>`;
    });
    rows.push(`<row r="${r}">${cells.join('')}</row>`);
  });
  parts.push(`<sheetData>${rows.join('')}</sheetData>`);
  if (s.protected) parts.push('<sheetProtection sheet="1" objects="1" scenarios="1"/>');
  if (s.filter) parts.push(`<autoFilter ref="A1:${tableLastRef(s)}"/>`);
  let priority = 1;
  const tableRows = tableRowCount(s);
  for (const cf of s.conditional ?? []) {
    if (tableRows === 0) continue;
    const ranges = cf.columns.map((k) => {
      const i = s.columns.findIndex((c) => columnKey(c) === k);
      if (i < 0) throw new Error(`workbook: conditional format on unknown column "${k}" of "${s.name}"`);
      const L = columnLetter(i);
      return `${L}${excelRow(0)}:${L}${excelRow(tableRows - 1)}`;
    });
    if (ranges.length === 0) continue;
    parts.push(`<conditionalFormatting sqref="${ranges.join(' ')}"><cfRule type="cellIs" dxfId="${NEGATIVE_DXF}" priority="${priority++}" operator="lessThan"><formula>0</formula></cfRule></conditionalFormatting>`);
  }
  parts.push('<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>');
  parts.push('</worksheet>');
  return XML_DECLARATION + parts.join('');
}

/** The .xlsx bytes of the workbook. */
export function writeWorkbook(spec: WorkbookSpec): Uint8Array {
  checkSpec(spec);
  const layout = layoutOf(spec.sheets);
  const styles = new StyleTable();
  const enc = new TextEncoder();

  const sheetParts = spec.sheets.map((s, i) => {
    const formulas = new Map<string, string>();
    s.rows.forEach((row, ri) => row.forEach((c, ci) => {
      if (c && c.kind === 'fx') {
        formulas.set(`${ci}:${ri}`, renderFormula(c.f, layout, { sheet: s.name, header: columnKey(s.columns[ci]!), row: ri }));
      }
    }));
    return { name: `xl/worksheets/sheet${i + 1}.xml`, xml: sheetXml(s, i, styles, formulas) };
  });

  const names: string[] = [];
  spec.sheets.forEach((s, i) => {
    if (s.filter) {
      names.push(`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${escapeXml(`${sheetPrefix(s.name)}$A$1:$${columnLetter(s.columns.length - 1)}$${Math.max(1, tableRowCount(s) + 1)}`)}</definedName>`);
    }
  });
  for (const d of spec.definedNames) {
    const local = d.sheet === null ? '' : ` localSheetId="${spec.sheets.findIndex((s) => s.name === d.sheet)}"`;
    if (d.sheet !== null && !spec.sheets.some((s) => s.name === d.sheet)) throw new Error(`workbook: name "${d.name}" on unknown sheet`);
    names.push(`<definedName name="${attrText(d.name)}"${local}${d.hidden ? ' hidden="1"' : ''}>${escapeXml(d.ref)}</definedName>`);
  }

  const workbook = XML_DECLARATION + [
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_RELATIONSHIPS}">`,
    '<bookViews><workbookView activeTab="0"/></bookViews>',
    `<sheets>${spec.sheets.map((s, i) => `<sheet name="${attrText(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets>`,
    names.length ? `<definedNames>${names.join('')}</definedNames>` : '',
    `<calcPr calcId="${CALC_ID}" fullCalcOnLoad="1"/>`,
    '</workbook>',
  ].join('');

  const wbRels = XML_DECLARATION + `<Relationships xmlns="${NS_PACKAGE_RELATIONSHIPS}">`
    + spec.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL_WORKSHEET}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${spec.sheets.length + 1}" Type="${REL_STYLES}" Target="styles.xml"/>`
    + '</Relationships>';

  const rootRels = XML_DECLARATION + `<Relationships xmlns="${NS_PACKAGE_RELATIONSHIPS}">`
    + `<Relationship Id="rId1" Type="${REL_OFFICE_DOCUMENT}" Target="xl/workbook.xml"/></Relationships>`;

  const contentTypes = XML_DECLARATION + `<Types xmlns="${NS_CONTENT_TYPES}">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + sheetParts.map((p) => `<Override PartName="/${p.name}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>';

  // Styles last among the XML texts: the sheets register their styles while they are written.
  const stylesXml = XML_DECLARATION + styles.toXml();

  return storeZip([
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRels) },
    { name: 'xl/styles.xml', data: enc.encode(stylesXml) },
    ...sheetParts.map((p) => ({ name: p.name, data: enc.encode(p.xml) })),
  ]);
}
