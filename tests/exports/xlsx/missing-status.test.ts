// covers: E-123
// A missing number is a blank cell in the workbook, with its status beside it (Holdings) or in the row's Status column
// (Portfolio Overview, the allocation sheets): never 0, never the dash, never a formula (D-029; architecture §14).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewWorkbook } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { sampleInput, SAMPLE_NAMES } from './sample-input.ts';
import { MISSING_STATUSES } from '../../../app/src/model/status.ts';

const STATUS_RE = new RegExp(`^(${MISSING_STATUSES.join('|')})$`);

test('Holdings: every blank number has a status in the next column, and every status a blank number', () => {
  for (const name of SAMPLE_NAMES) {
    const t = sheetTable(sheetByName(readXlsx(buildOverviewWorkbook(sampleInput(name))), 'Holdings (as loaded)'));
    const head = t[0]!;
    for (let c = 0; c < head.length; c++) {
      const h = String(head[c]);
      if (!h.endsWith(' Status') || h === 'Joint Holders Status') continue;
      for (const row of t.slice(1)) {
        const value = row[c - 1];
        const status = row[c];
        if (value === null) assert.match(String(status), STATUS_RE, `${name}: ${head[c - 1]} blank needs a status`);
        else {
          assert.equal(typeof value, 'number', `${name}: ${head[c - 1]} is a number`);
          assert.equal(status, null, `${name}: ${head[c - 1]} present, no status`);
        }
      }
    }
  }
});

test('no dash and no zero stands in for a missing figure', () => {
  for (const name of SAMPLE_NAMES) {
    const wb = readXlsx(buildOverviewWorkbook(sampleInput(name)));
    for (const s of wb.sheets) for (const c of s.cells.values()) {
      if (typeof c.v === 'string') assert.ok(!/^[\u2013\u2014-]$/.test(c.v), `${name} ${s.name}!${c.ref} holds a dash`);
    }
  }
  const t = sheetTable(sheetByName(readXlsx(buildOverviewWorkbook(sampleInput('blank-invested'))), 'Portfolio Overview'));
  const debt = t.find((r) => r[1] === 'Debt' && r[2] === null)!;
  assert.equal(debt[5], null, 'Debt invested is missing: blank, not 0');
  assert.match(String(debt[11]), /Investment Amount: NOT AVAILABLE IN SUPPLIED DATA/);
});

test('a CMV of 0 makes the coverage NOT APPLICABLE: blank, named in Status', () => {
  const t = sheetTable(sheetByName(readXlsx(buildOverviewWorkbook(sampleInput('zero-cmv'))), 'Portfolio Overview'));
  const com = t.find((r) => r[1] === 'Commodity' && r[2] === null)!;
  assert.equal(com[10], null);
  assert.equal(com[11], 'Invested Coverage: NOT APPLICABLE');
  assert.equal(com[6], 0, 'a CMV of exactly 0 is a value');
});
