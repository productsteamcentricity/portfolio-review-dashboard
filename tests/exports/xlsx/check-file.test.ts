// covers: E-75 BR-10.2
// run-acceptance --check-file: the evaluator-only check of a downloaded workbook (browser QA), with no Office. It
// passes on the writer's output and fails when a cached value differs from its formula, when a formula evaluates to
// an error, or when the structure breaks (a lost frozen header, a visible _manifest).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkWorkbookBytes, negativeControl, REPO } from '../../../scripts/office/run-acceptance.ts';
import { buildOverviewWorkbook } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { storeZip } from '../../../app/src/exports/zip/store-zip.ts';
import { unzip } from '../../helpers/unzip.ts';
import { sampleInput, SAMPLE_NAMES } from './sample-input.ts';

function edit(bytes: Uint8Array, part: string, fn: (xml: string) => string): Uint8Array {
  const z = unzip(bytes);
  return storeZip(z.entries.map((e) => (e.name === part ? { name: e.name, data: new TextEncoder().encode(fn(new TextDecoder().decode(e.data))) } : { name: e.name, data: e.data })));
}

test('every sample passes the evaluator-only check', () => {
  for (const name of SAMPLE_NAMES) {
    const r = checkWorkbookBytes(buildOverviewWorkbook(sampleInput(name)));
    assert.ok(r.pass, `${name}: ${JSON.stringify(r.checks.filter((c) => !c.ok))}`);
    assert.ok(r.formulas > 50);
  }
});

test('a cached value that differs from its formula, an error value, a broken structure: each fails', () => {
  const good = buildOverviewWorkbook(sampleInput('standard'));
  const sheet = 'xl/worksheets/sheet4.xml'; // Portfolio Overview
  const cached = edit(good, sheet, (x) => x.replace('<v>1.987</v>', '<v>2.5</v>'));
  assert.equal(checkWorkbookBytes(cached).checks.find((c) => c.name.startsWith('every formula'))!.ok, false);
  const error = edit(good, sheet, (x) => x.replace(/<f>G2\/\$G\$11\*100<\/f>/, '<f>G2/0</f>'));
  assert.equal(checkWorkbookBytes(error).checks.find((c) => c.name === 'no error value')!.ok, false);
  const unfrozen = edit(good, sheet, (x) => x.replace(/<pane [^>]*\/>/, ''));
  assert.equal(checkWorkbookBytes(unfrozen).pass, false);
  const visible = edit(good, 'xl/workbook.xml', (x) => x.replace(' state="hidden"', ''));
  assert.equal(checkWorkbookBytes(visible).pass, false);
  assert.equal(checkWorkbookBytes(new Uint8Array([1, 2, 3])).pass, false);
  assert.ok(checkWorkbookBytes(negativeControl(good)).pass, 'element order is for Excel to judge, not this check');
});

test('the command line: exit 0 on a good file, 1 on a tampered one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-file-'));
  try {
    const good = path.join(dir, 'good.xlsx');
    const bad = path.join(dir, 'bad.xlsx');
    const bytes = buildOverviewWorkbook(sampleInput('lakh'));
    fs.writeFileSync(good, bytes);
    const tampered = edit(bytes, 'xl/worksheets/sheet4.xml', (x) => x.replace(/(<\/f><v>)([^<]+)(<\/v>)/, (_m, a: string, v: string, b: string) => `${a}${Number(v) + 1}${b}`));
    assert.notDeepEqual(tampered, bytes);
    fs.writeFileSync(bad, tampered);
    const run = (f: string) => spawnSync(process.execPath, [path.join(REPO, 'scripts/office/run-acceptance.ts'), '--check-file', f], { encoding: 'utf8' });
    const ok = run(good);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /check-file: pass/);
    const ko = run(bad);
    assert.equal(ko.status, 1, ko.stdout + ko.stderr);
    assert.match(ko.stdout, /FAIL/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
