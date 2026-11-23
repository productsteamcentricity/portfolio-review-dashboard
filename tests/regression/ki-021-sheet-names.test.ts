// covers: E-75 KI-021
// KI-021: the legacy Excel export failed for client names with : \ / ? * [ ] or two names sharing their first 31
// characters, because each client became a sheet name (08_exporters.js:1890, 1935). The new workbook's sheet names are
// fixed; client labels are column headers, and any name that does become a sheet name is sanitised and made unique.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewWorkbook } from '../../app/src/exports/xlsx/overview-workbook.ts';
import { uniqueSheetNames, isValidSheetName } from '../../app/src/exports/xlsx/sheet-names.ts';
import { readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';
import { sampleInput } from '../exports/xlsx/sample-input.ts';

const LABELS = ['Client: A/B \\ C', 'Client [1] *?', 'Sample Client With A Very Long Name 0001'];

test('client names with forbidden characters, and two sharing their first 31 characters, export', () => {
  const input = sampleInput('standard');
  input.vm.matrices.client.columns[0]!.label = LABELS[0]!;
  input.vm.matrices.client.columns[1]!.label = LABELS[1]!;
  input.vm.matrices.distributor.columns[0]!.label = 'Sample Client With A Very Long Name 0001';
  input.vm.matrices.distributor.columns[1]!.label = 'Sample Client With A Very Long Name 0002';
  const wb = readXlsx(buildOverviewWorkbook(input));
  assert.deepEqual(wb.sheets.map((s) => s.name), ['Read Me and Controls', 'Source Register', 'Holdings (as loaded)', 'Portfolio Overview',
    'Client Allocation', 'Distributor Allocation', 'Audit Log', '_manifest']);
  assert.deepEqual(sheetTable(sheetByName(wb, 'Client Allocation'))[0]!.slice(3, 5), [`${LABELS[0]} (Cr.)`, `${LABELS[1]} (Cr.)`]);
  assert.deepEqual(sheetTable(sheetByName(wb, 'Distributor Allocation'))[0]!.slice(3, 5),
    ['Sample Client With A Very Long Name 0001 (Cr.)', 'Sample Client With A Very Long Name 0002 (Cr.)']);
});

test('names that become sheet names are valid and unique ignoring letter case', () => {
  const names = uniqueSheetNames([...LABELS, 'Sample Client With A Very Long Name 0002', 'client [1] *?']);
  assert.ok(names.every(isValidSheetName));
  assert.equal(new Set(names.map((n) => n.toLowerCase())).size, names.length);
  assert.ok(names.every((n) => n.length <= 31));
});
