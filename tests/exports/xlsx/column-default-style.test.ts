// covers: E-75 E-156 D-039 (the writer's additive column-default style, PLAN-01 D3)
// The column-default style (`ColumnSpec.defaultStyle`, written on `<col style>`) is additive: M1.4's workbooks are
// byte-identical to those of the writer on main 0e483b6. The golden SHA-256s below were computed with that writer
// (before the change, in IST and in UTC, the same values) over the spike workbook and the overview workbook of every
// M1.4 synthetic sample, preview and release channels.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { writeWorkbook } from '../../../app/src/exports/xlsx/writer.ts';
import { buildOverviewWorkbook } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import type { WorkbookSpec } from '../../../app/src/exports/xlsx/spec.ts';
import { partText, unzip } from '../../helpers/unzip.ts';
import { spikeWorkbookSpec, sampleInput, SAMPLE_NAMES } from './sample-input.ts';

const GOLDEN: Readonly<Record<string, string>> = {
  spike: '707e4e5a852882c0eb82fe1e117a6ed6e9033f78ee5f2e8930cd11eeafe0d3b0',
  'standard preview': '8a375d206c44deb35beaae43c52f6dd8af28a044790e60e36814e3ef0f81fe78',
  'standard release': 'e6d581632ac1f71ce0e34a0e1ca4716c23b7557c5755ef529ffa765789ec1103',
  'lakh preview': '74142b0b3f6173aeb328e15e3d9b33d59adf05abb6a9edb1f231e2fe7f2bc44d',
  'lakh release': 'e7319d74282a0911c533c2c72debdba6322a8f04cafebf8b3d7b465daf139d1d',
  'blank-invested preview': '56fcf791dc62cc0ee9963eaa321eeeeee8c03cfdb6f51a9ab60234faf8e42351',
  'blank-invested release': '636d1d194aacf002af55b36b3fa342f93cc00ab074487cb0a5f7aaf50a787e69',
  'all-classes preview': 'a0828e13c6c0d9e7f8deb7464cb9baac406422344db074b1f64b3794bf8cd3ed',
  'all-classes release': '453cee2aaef17ef4d665cea2d0028e89442ea07629cdfb338f76161e18f54832',
  'zero-cmv preview': '04f6c65229808b4feeea3a7fdb2c22d4ab7a30a2aac21bba0aa0fa847286a077',
  'zero-cmv release': 'b41f71bfba5dd65b70669eb4a07fef0d0f9e30ef2c942f6bc22eb18463edc67d',
  'na-cmv preview': '8f24f7266d0bc3bc85f339e135a20a3216a1b283bc6ff4135ac34f8c4eb4b1d9',
  'na-cmv release': '87221daa515f30b0f1de347faa215fc9b6e688d75e5dd7c5fcf16f1fae65d334',
  'single-entity preview': 'c0fc6b5408bee70d0d880ddceb53132427f8947e740781832720f64437fe268b',
  'single-entity release': 'ef98f1abf7a02715983af45e0aa6d4431cb9b8f77a1f8d4dab259e30e37e6129',
  'blank-entities preview': '2f0a88a35fa9462c95da64b494f20e661fedc2bd590772001d6f2b7e34c5b5de',
  'blank-entities release': '1f612b70dc9319d5f5981bf2461e60f86b8cf3589bf6ecabdbeb8e7dc4e0a872',
  'hostile preview': '116846e21c393584ab5a8de7496a0c9ee8ada480fec5dedee18c5d5388390eba',
  'hostile release': 'f10902a97b2ab18deca6ed49958a65612d5ef0e2ae8d67932fd297398f8631d6',
};

const sha = (b: Uint8Array): string => crypto.createHash('sha256').update(b).digest('hex');

describe('column-default style is additive (PLAN-01 D3)', () => {
  test('M1.4 workbooks are byte-identical to the writer on main', () => {
    assert.equal(sha(writeWorkbook(spikeWorkbookSpec())), GOLDEN.spike);
    for (const n of SAMPLE_NAMES) {
      for (const ch of ['preview', 'release'] as const) {
        assert.equal(sha(buildOverviewWorkbook(sampleInput(n, { channel: ch }))), GOLDEN[`${n} ${ch}`], `${n} ${ch}`);
      }
    }
    assert.equal(Object.keys(GOLDEN).length, 1 + SAMPLE_NAMES.length * 2, 'every sample has its golden hash');
  });
  test('a column with a default style gets <col style> pointing at an xf with that number format; others get none', () => {
    const spec: WorkbookSpec = {
      sheets: [{
        name: 'T', freeze: { rows: 1, cols: 0 }, filter: false, rows: [],
        columns: [{ header: 'When', width: 12, defaultStyle: { fmt: 'date' } }, { header: 'Plain', width: 12 }],
      }],
      definedNames: [],
    };
    const parts = unzip(writeWorkbook(spec));
    const sheet = partText(parts, 'xl/worksheets/sheet1.xml');
    const m = /<col min="1" max="1" width="12" style="(\d+)" customWidth="1"\/><col min="2" max="2" width="12" customWidth="1"\/>/.exec(sheet);
    assert.ok(m, sheet);
    const styles = partText(parts, 'xl/styles.xml');
    const xfs = [...(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s.exec(styles)![1]!).matchAll(/<xf [^>]*numFmtId="(\d+)"/g)].map((x) => Number(x[1]));
    assert.equal(xfs[Number(m![1])], 167, 'the house date format (numFmtId 167)');
  });
});
