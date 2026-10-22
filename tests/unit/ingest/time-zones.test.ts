// covers: E-01 E-04
// The new reader gives the same result under TZ=Asia/Kolkata and TZ=UTC (architecture §6.7; 08 §1 principle 3),
// in one run: tests/helpers/tz-probe.ts runs in a child process under each zone, writes workbooks the way that zone
// writes them (local-time Dates through SheetJS, which drift by 10 seconds in IST) and parses them. Every fixture,
// including tools/make-sample-base.js's own files, must parse identically, and the dates must be the known ones.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO } from '../../helpers/sheetjs.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';

const PROBE = path.join(REPO, 'tests', 'helpers', 'tz-probe.ts');

function probe(tz: string): Record<string, unknown> {
  const r = spawnSync(process.execPath, [PROBE], {
    env: { ...process.env, TZ: tz }, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, cwd: REPO,
  });
  assert.equal(r.status, 0, `probe under ${tz} failed: ${r.stderr}`);
  return JSON.parse(r.stdout) as Record<string, unknown>;
}

test('parse results are identical under Asia/Kolkata and UTC, and local-time dates keep their calendar day', () => {
  const ist = probe('Asia/Kolkata');
  const utc = probe('UTC');
  assert.deepEqual(ist['local-dates'], ['2023-01-16', '2024-02-29', '2026-09-30', '1999-12-31']);
  assert.deepEqual(utc['local-dates'], ['2023-01-16', '2024-02-29', '2026-09-30', '1999-12-31']);
  assert.ok(Object.keys(ist).includes('family-a') && Object.keys(ist).includes('syn-standard'));
  // tools/make-sample-base.js buys its first holding on 16 Jan 2023 (a local Date): the known answer in both zones.
  type Imp = { holdings: Array<{ purchaseDate: { kind: string; v?: number } }> };
  for (const run of [ist, utc]) {
    assert.equal((run['family-a'] as Imp).holdings[0]!.purchaseDate.v, ymdToDay(2023, 1, 16));
  }
  for (const k of Object.keys(ist)) assert.deepEqual(ist[k], utc[k], `fixture ${k} differs between zones`);
  assert.deepEqual(Object.keys(utc).sort(), Object.keys(ist).sort());
});
