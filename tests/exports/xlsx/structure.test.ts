// covers: BR-10.1 BR-10.2 E-75
// The overview workbook's structure (architecture §14; D-039 points 4, 5 and 7): sheet names and order, the Client
// and Distributor sheets left out when the view-model hides them (OD-21), frozen header and filter on every table,
// no merged cells, Cambria 9, the header style, the number formats, the hidden and protected _manifest, the Read Me
// preview marker exactly on a preview build (D-024), and byte-identical output for the same input.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sha256Text } from '../../../app/src/exports/xlsx/sheets/manifest-sheet.ts';
import { buildOverviewWorkbook, OVERVIEW_WORKBOOK_SCHEMA } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { readXlsx, kid, sheetByName, sheetTable, type ReadWorkbook } from '../../helpers/xlsx-read.ts';
import { sampleInput, SAMPLE_FINGERPRINT, SAMPLE_SOURCE } from './sample-input.ts';

const ALL = ['Read Me and Controls', 'Source Register', 'Holdings (as loaded)', 'Portfolio Overview', 'Client Allocation',
  'Distributor Allocation', 'Audit Log', '_manifest'];
const PREVIEW = 'Preview build, not for client use';

const standard = readXlsx(buildOverviewWorkbook(sampleInput('standard')));

test('sheet names and order', () => {
  assert.deepEqual(standard.sheets.map((s) => s.name), ALL);
  assert.deepEqual(standard.sheets.map((s) => s.state), ['visible', 'visible', 'visible', 'visible', 'visible', 'visible', 'visible', 'hidden']);
});

test('the Client and Distributor sheets are left out when the view-model hides them, and the Read Me says why (OD-21)', () => {
  const single = readXlsx(buildOverviewWorkbook(sampleInput('single-entity')));
  assert.deepEqual(single.sheets.map((s) => s.name), ALL.filter((n) => !n.endsWith('Allocation')));
  const readMe = sheetTable(sheetByName(single, 'Read Me and Controls'));
  const leftOut = readMe.filter((r) => r[0] === 'Sheet left out').map((r) => r[1]);
  assert.deepEqual(leftOut, ['Client Allocation: fewer than two clients hold included holdings (OD-21).',
    'Distributor Allocation: fewer than two distributors hold included holdings (OD-21).']);
});

describe('every table: frozen header, a filter, no merged cells, the header style, Cambria 9', () => {
  for (const s of standard.sheets) {
    test(s.name, () => {
      const pane = kid(kid(kid(s.root, 'sheetViews')!, 'sheetView')!, 'pane')!;
      assert.equal(pane.attrs.state, 'frozen');
      assert.equal(pane.attrs.ySplit, '1');
      assert.ok(kid(s.root, 'autoFilter'));
      assert.equal(kid(s.root, 'mergeCells'), undefined);
      const st = standard.styles!;
      for (const c of s.cells.values()) {
        const xf = st.xfs[c.s]!;
        const font = st.fonts[xf.fontId]!;
        assert.equal(font.name, 'Cambria', `${s.name}!${c.ref}`);
        assert.equal(font.size, 9);
        if (/^[A-Z]+1$/.test(c.ref)) {
          assert.equal(st.fills[xf.fillId]!.fg, 'FF000000', `${c.ref} header fill ink`);
          assert.ok(font.bold && font.colour === 'FFFFFFFF', `${c.ref} header text white bold`);
          assert.equal(c.t, 'inlineStr');
        } else {
          assert.equal(xf.borderId, 1, `${s.name}!${c.ref} has the thin grey border`);
        }
      }
    });
  }
});

test('Holdings freezes column A too; the overview rows carry the house fills', () => {
  const pane = kid(kid(kid(sheetByName(standard, 'Holdings (as loaded)').root, 'sheetViews')!, 'sheetView')!, 'pane')!;
  assert.equal(pane.attrs.xSplit, '1');
  const po = sheetByName(standard, 'Portfolio Overview');
  const fillOf = (ref: string) => standard.styles!.fills[standard.styles!.xfs[po.cells.get(ref)!.s]!.fillId]!.fg;
  const t = sheetTable(po);
  const equity = t.findIndex((r) => r[1] === 'Equity' && r[2] === null) + 1;
  const total = t.findIndex((r) => r[1] === 'Grand Total') + 1;
  const product = t.findIndex((r) => r[2] === 'PMS') + 1;
  assert.equal(fillOf(`A${equity}`), 'FFBFBFBF', 'asset rows on grey75');
  assert.equal(fillOf(`G${total}`), 'FF000000', 'Grand Total on ink');
  assert.equal(fillOf(`G${product}`), null, 'product rows plain');
});

test('number formats: money, percent, units with Indian grouping, dates', () => {
  const st = standard.styles!;
  const fmt = (sheet: string, ref: string): string => {
    const id = st.xfs[sheetByName(standard, sheet).cells.get(ref)!.s]!.numFmtId;
    return st.numFmts.get(id) ?? `builtin ${id}`;
  };
  assert.equal(fmt('Holdings (as loaded)', 'X2'), '#,##0.00');
  assert.equal(fmt('Holdings (as loaded)', 'V2'), '#,##0.00');
  assert.equal(fmt('Holdings (as loaded)', 'AF2'), '0.00"%"');
  assert.equal(fmt('Holdings (as loaded)', 'T2'), '[>=10000000]##\\,##\\,##\\,##0.000;[>=100000]##\\,##\\,##0.000;##,##0.000');
  assert.equal(fmt('Holdings (as loaded)', 'R2'), 'd mmm yyyy');
  assert.equal(fmt('Portfolio Overview', 'G2'), '#,##0.00');
  assert.equal(fmt('Portfolio Overview', 'H2'), '0.00"%"');
  assert.equal(fmt('Portfolio Overview', 'K2'), '0.00"%"');
});

test('_manifest: hidden, protected without a password, the schema and build stamps, one row per formula', () => {
  const m = sheetByName(standard, '_manifest');
  assert.equal(m.state, 'hidden');
  const prot = kid(m.root, 'sheetProtection')!;
  assert.equal(prot.attrs.sheet, '1');
  assert.equal(prot.attrs.password, undefined);
  assert.equal(prot.attrs.hashValue, undefined);
  const rows = new Map(sheetTable(m).slice(1).map((r) => [r[0], r[1]]));
  assert.equal(rows.get('schemaVersion'), 1);
  assert.equal(rows.get('workbookSchema'), OVERVIEW_WORKBOOK_SCHEMA);
  assert.equal(OVERVIEW_WORKBOOK_SCHEMA, 'overview-workbook@1');
  assert.equal(rows.get('buildId'), '0123456789abcdef');
  assert.equal(rows.get('channel'), 'preview');
  assert.equal(rows.get('reviewFingerprint'), SAMPLE_FINGERPRINT);
  assert.equal(rows.get('sourceSha256'), SAMPLE_SOURCE);
  assert.equal(rows.get('namedInputs'), 'none in this version');
  assert.equal(rows.get('editableRanges'), 'none in this version');
  const formulaRows = [...rows.keys()].filter((k) => typeof k === 'string' && k.startsWith('formula '));
  const formulaCells = standard.sheets.flatMap((s) => [...s.cells.values()].filter((c) => c.f !== null).map((c) => `formula ${s.name}!${c.ref}`));
  assert.equal(rows.get('formulaCount'), formulaCells.length);
  assert.deepEqual(formulaRows, formulaCells);
  for (const s of standard.sheets) for (const c of s.cells.values()) {
    if (c.f === null) continue;
    assert.equal(rows.get(`formula ${s.name}!${c.ref}`), crypto.createHash('sha256').update(c.f, 'utf8').digest('hex'), 'SHA-256 of the formula text');
  }
  assert.equal(sha256Text(''), crypto.createHash('sha256').update('').digest('hex'));
  const long = 'x\u20B9'.repeat(5000);
  assert.equal(sha256Text(long), crypto.createHash('sha256').update(long, 'utf8').digest('hex'));
});

function readMeItems(wb: ReadWorkbook): unknown[] {
  return sheetTable(sheetByName(wb, 'Read Me and Controls')).slice(1).map((r) => r[0]);
}

test('the Read Me preview marker is the first data row exactly on a preview build (D-024)', () => {
  const preview = readMeItems(standard);
  assert.equal(preview[0], PREVIEW);
  assert.equal(preview.filter((x) => x === PREVIEW).length, 1);
  const release = readMeItems(readXlsx(buildOverviewWorkbook(sampleInput('standard', { channel: 'release' }))));
  assert.equal(release[0], 'Purpose');
  assert.ok(!release.includes(PREVIEW));
  for (const wb of [standard]) {
    for (const s of wb.sheets) for (const c of s.cells.values()) {
      if (typeof c.v === 'string') assert.ok(!/[\u2013\u2014]/.test(c.v), `no en or em dash in ${s.name}!${c.ref}`);
    }
  }
});

test('the Read Me as-on date is a date cell, or blank with its status', () => {
  const t = sheetTable(sheetByName(standard, 'Read Me and Controls'));
  const asOn = t.find((r) => r[0] === 'As-on date')!;
  assert.equal(asOn[1], 46295, '30 Sep 2026 as an Excel serial');
  const noDate = sheetTable(sheetByName(readXlsx(buildOverviewWorkbook(sampleInput('standard', { asOn: false }))), 'Read Me and Controls'));
  const row = noDate.find((r) => r[0] === 'As-on date')!;
  assert.deepEqual([row[1], row[2]], [null, 'NOT AVAILABLE IN SUPPLIED DATA']);
});

test('two builds of the same input are byte-identical, under any time zone', () => {
  const a = buildOverviewWorkbook(sampleInput('standard'));
  const b = buildOverviewWorkbook(sampleInput('standard'));
  assert.deepEqual(a, b);
});

test('Audit Log: audit entries first, then validation results without message text', () => {
  const t = sheetTable(sheetByName(standard, 'Audit Log'));
  assert.deepEqual(t[0], ['Seq', 'Time (UTC)', 'Kind', 'Rule', 'Severity', 'Status', 'Decision', 'Count', 'Summary', 'Detail', 'Source SHA-256']);
  assert.deepEqual(t.slice(1).map((r) => [r[0], r[2]]), [[1, 'import'], [2, 'build'], [3, 'validation'], [4, 'validation']]);
  assert.deepEqual(t[3]!.slice(2, 10), ['validation', 'base-file.money-column-used', 'Information', 'open', 'KI-147', 6, null, 'base-file.money-column-used:1']);
  assert.equal(t[1]![9], 'holdings=6; parser=base-file@1');
});

test('Source Register columns and values', () => {
  const t = sheetTable(sheetByName(standard, 'Source Register'));
  assert.deepEqual(t[0], ['Role', 'File Name', 'Data Date', 'Data Date Status', 'SHA-256', 'Class', 'Stage', 'Parser', 'Size (bytes)']);
  assert.deepEqual(t[1], ['base-file', 'syn-standard.xlsx', null, 'NOT AVAILABLE IN SUPPLIED DATA', SAMPLE_SOURCE, 'N', 'review', 'base-file@1', 12345]);
});
