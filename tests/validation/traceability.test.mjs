// covers: BR-0.4 M1.3-traceability
// scripts/validation/traceability.mjs on a throwaway repository in the temp folder: covers headers are read,
// unknown ids and missing headers fail, a row "in progress" without a test fails, an approved drop ("n/a") does
// not, BR-15.x follows the acceptance rows, and the real repository passes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildReport, parseCovers, parseMatrix } from '../../scripts/validation/traceability.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(HERE, '..', '..', 'scripts', 'validation', 'traceability.mjs');

function repo(matrixRows, testFiles) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-trace-'));
  fs.mkdirSync(path.join(root, 'docs', 'new-build'), { recursive: true });
  const matrix = ['# Matrix', '', '| Id | Capability | Test | Status |', '|---|---|---|---|', ...matrixRows, ''].join('\n');
  fs.writeFileSync(path.join(root, 'docs', 'new-build', '05-feature-parity-matrix.md'), matrix);
  for (const [rel, text] of Object.entries(testFiles)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}
const run = (root) => spawnSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' });

test('covers headers: matrix ids, references and free text', () => {
  assert.deepEqual(parseCovers('// covers: E-01 E-02, BR-2.5 (text) AC-21 OD-3 KI-074 R-IN-8 M1.1-x words\nimport x;'),
    { ids: ['E-01', 'E-02', 'BR-2.5', 'AC-21'], references: ['OD-3', 'KI-074', 'R-IN-8', 'M1.1-x'] });
  assert.deepEqual(parseCovers('#!/usr/bin/env node\n// a comment\n// covers: W-1\n'), { ids: ['W-1'], references: [] });
  assert.equal(parseCovers('import x;\n// covers: E-01\n'), null, 'the header must come before any code');
  assert.equal(parseCovers('// no header here\n'), null);
});

test('matrix rows and statuses; an unknown status is a problem', () => {
  const { rows, problems } = parseMatrix([
    '| E-01 | Base | `t` | not started |', '| BR-15.x | ACs | see | in progress |', '| AC-01 | Case | `a` | parity |',
    '| E-02 | X | `t` | done |', '| Id | not a row | x | y |',
  ].join('\n'));
  assert.deepEqual([...rows.keys()], ['E-01', 'BR-15.x', 'AC-01', 'E-02']);
  assert.equal(rows.get('AC-01').status, 'parity');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /E-02 has an unknown status "done"/);
});

test('a clean fixture passes; coverage is reported per row', () => {
  const root = repo(['| E-01 | Base | `t` | in progress |', '| E-02 | Merge | `t` | not started |', '| AC-01 | Case | `a` | not started |'],
    { 'tests/unit/a.test.ts': '// covers: E-01 KI-1\nexport {};\n', 'tests/b.test.mjs': '// covers: E-01 E-02\n' });
  try {
    const r = buildReport(root);
    assert.deepEqual(r.problems, []);
    assert.deepEqual(r.coverage['E-01'].tests, ['tests/b.test.mjs', 'tests/unit/a.test.ts']);
    assert.equal(r.statusCounts['in progress'], 1);
    const out = run(root);
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(out.stdout, /traceability: ok/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('failures: a missing header, an unknown id, and a row in progress without a test; an approved drop is exempt', () => {
  const root = repo([
    '| E-01 | Base | `t` | in progress |', '| E-03 | Unit | `u` | parity |', '| E-94 | Dropped | n/a | accounted for |',
    '| BR-15.x | ACs | see | in progress |', '| AC-01 | Case | `a` | not started |',
  ], {
    'tests/x.test.ts': '// covers: E-01 E-999\n',
    'tests/y.test.mjs': 'import x from "y";\n',
    'tests/helpers/not-a-test.ts': 'export {};\n',
  });
  try {
    const r = buildReport(root);
    const p = r.problems.join('\n');
    assert.match(p, /tests\/x\.test\.ts: covers E-999, which is not a row/);
    assert.match(p, /tests\/y\.test\.mjs: no "\/\/ covers:" header/);
    assert.match(p, /row E-03 is "parity" but no test covers it/);
    assert.match(p, /row BR-15\.x is "in progress" but no test covers it/);
    assert.doesNotMatch(p, /E-94/);
    assert.doesNotMatch(p, /not-a-test/);
    assert.equal(r.problems.length, 4);
    assert.equal(run(root).status, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('BR-15.x is covered when an acceptance case is', () => {
  const root = repo(['| BR-15.x | ACs | see | in progress |', '| AC-21 | Git | `a` | in progress |'],
    { 'tests/ac.test.mjs': '// covers: AC-21\n' });
  try {
    const r = buildReport(root);
    assert.deepEqual(r.problems, []);
    assert.deepEqual(r.coverage['BR-15.x'].tests, ['tests/ac.test.mjs']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('the repository itself passes, and every row of the real matrix is read', () => {
  const r = buildReport();
  assert.deepEqual(r.problems, []);
  assert.ok(r.rows >= 376, `the matrix had 376 rows on 22 Oct 2026; read ${r.rows}`);
  for (const t of r.tests) assert.ok(t.ids.length + t.references.length > 0, `${t.file} names what it covers`);
  assert.equal(run(path.resolve(HERE, '..', '..')).status, 0);
  assert.equal(spawnSync(process.execPath, [SCRIPT, '--root'], { encoding: 'utf8' }).status, 2);
});
