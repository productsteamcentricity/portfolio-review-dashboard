#!/usr/bin/env node
// traceability.mjs: which parity-matrix rows and acceptance cases each test covers (08-regression-test-plan.md §1
// principle 6). Zero dependencies (Node 24 built-ins). Read-only.
//
// Every test file (tests/**/*.test.mjs, *.test.ts, *.test.js) starts with a header comment line
//   // covers: E-01 E-02 BR-2.5 AC-21 OD-3 KI-074 (free text allowed)
// Ids of the forms E-n, U-n, BR-n.n, AC-n, W-n and DA-n are rows of docs/new-build/05-feature-parity-matrix.md and
// must exist there; other tokens (KI-n, OD-n, D-n, milestone names, words) are kept as references.
//
// Fails when:
//   - a test file has no "covers:" header;
//   - a header names a matrix-style id that is not a row of the matrix;
//   - a row whose status is "in progress", "parity" or "accounted for" has no test (a row "accounted for" by an
//     approved drop is exempt when one of its cells reads "n/a", as E-94 does);
//   - a matrix row has an unknown status or appears twice.
//
// Usage: node scripts/validation/traceability.mjs [--root <dir>] [--json] [--rows]
//   --root   repository root (default: this script's repository; tests use a fixture folder)
//   --json   print the full report as JSON
//   --rows   also list every covered row with its tests
// Exit: 0 pass, 1 a problem found, 2 usage or runtime error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = path.resolve(HERE, '..', '..');
export const MATRIX_PATH = path.join('docs', 'new-build', '05-feature-parity-matrix.md');
export const STATUSES = ['not started', 'in progress', 'parity', 'accounted for'];
export const ID_RE = /^(?:E|U|BR|AC|W|DA)-\d+(?:\.\d+)?$/;
/** BR-15.x is the brief's acceptance requirement, expanded into the rows AC-01 to AC-24 (matrix section G). */
const GROUP_ROWS = { 'BR-15.x': 'AC-' };
const TEST_FILE_RE = /\.test\.(?:mjs|ts|js)$/;
const toPosix = (p) => p.split(path.sep).join('/');

/** Rows of the parity matrix: id, status (the last cell) and the test column text when it has one. */
export function parseMatrix(text) {
  const rows = new Map();
  const problems = [];
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    const m = /^\|\s*([A-Z]+-\d+(?:\.\d+|\.x)?)\s*\|(.*)\|\s*$/.exec(line);
    if (!m || !(ID_RE.test(m[1]) || m[1] in GROUP_ROWS)) continue;
    const cells = m[2].split('|').map((c) => c.trim());
    const status = cells[cells.length - 1];
    if (!STATUSES.includes(status)) problems.push(`${MATRIX_PATH}:${i + 1}: row ${m[1]} has an unknown status "${status}"`);
    if (rows.has(m[1])) problems.push(`${MATRIX_PATH}:${i + 1}: row ${m[1]} appears twice`);
    rows.set(m[1], { id: m[1], status, line: i + 1, cells });
  }
  return { rows, problems };
}

/** The "covers:" header of a test file: matrix ids and other references, or null when there is none. */
export function parseCovers(text) {
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#!')) continue;
    if (!line.startsWith('//')) break; // the header must come before any code
    const m = /^\/\/\s*covers:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const ids = [];
    const references = [];
    for (const tok of m[1].split(/\s+/)) {
      const t = tok.replace(/^[(,;]+|[),;:.]+$/g, '');
      if (!t) continue;
      if (ID_RE.test(t)) { if (!ids.includes(t)) ids.push(t); } else if (/^[A-Z][A-Z-]*-\d/.test(t) || /^M\d/.test(t)) {
        if (!references.includes(t)) references.push(t);
      }
    }
    return { ids, references };
  }
  return null;
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && TEST_FILE_RE.test(ent.name)) out.push(p);
  }
  return out;
}

/** The full report for a repository root. */
export function buildReport(root = DEFAULT_ROOT) {
  const matrixFile = path.join(root, MATRIX_PATH);
  if (!fs.existsSync(matrixFile)) throw new Error(`parity matrix not found: ${MATRIX_PATH}`);
  const { rows, problems } = parseMatrix(fs.readFileSync(matrixFile, 'utf8'));
  const tests = [];
  const byRow = new Map([...rows.keys()].map((id) => [id, []]));
  for (const file of walk(path.join(root, 'tests'), []).sort()) {
    const rel = toPosix(path.relative(root, file));
    const covers = parseCovers(fs.readFileSync(file, 'utf8'));
    if (!covers) { problems.push(`${rel}: no "// covers:" header`); tests.push({ file: rel, ids: [], references: [] }); continue; }
    for (const id of covers.ids) {
      if (!rows.has(id)) problems.push(`${rel}: covers ${id}, which is not a row of the parity matrix`);
      else byRow.get(id).push(rel);
    }
    tests.push({ file: rel, ids: covers.ids, references: covers.references });
  }
  for (const [group, prefix] of Object.entries(GROUP_ROWS)) {
    if (!byRow.has(group)) continue;
    const members = new Set();
    for (const [id, t] of byRow) if (id.startsWith(prefix)) t.forEach((f) => members.add(f));
    byRow.set(group, [...members].sort());
  }
  for (const [id, r] of rows) {
    // The test column sits at a different place in each section, so an approved drop is any cell reading "n/a".
    const exempt = r.status === 'accounted for' && r.cells.some((c) => /^n\/a$/i.test(c));
    if (r.status !== 'not started' && byRow.get(id).length === 0 && !exempt) {
      problems.push(`${MATRIX_PATH}:${r.line}: row ${id} is "${r.status}" but no test covers it`);
    }
  }
  const counts = Object.fromEntries(STATUSES.map((s) => [s, [...rows.values()].filter((r) => r.status === s).length]));
  const covered = [...byRow.entries()].filter(([, t]) => t.length > 0);
  return {
    matrix: MATRIX_PATH,
    rows: rows.size,
    statusCounts: counts,
    tests,
    coverage: Object.fromEntries(covered.map(([id, t]) => [id, { status: rows.get(id).status, tests: t }])),
    problems,
  };
}

function prefixCounts(ids) {
  const c = {};
  for (const id of ids) { const p = id.split('-')[0]; c[p] = (c[p] ?? 0) + 1; }
  return Object.entries(c).map(([p, n]) => `${p} ${n}`).join(', ');
}

function main(argv) {
  let root = DEFAULT_ROOT;
  const i = argv.indexOf('--root');
  if (i >= 0) {
    if (!argv[i + 1]) { console.error('traceability: --root needs a folder'); return 2; }
    root = path.resolve(argv[i + 1]);
  }
  let report;
  try { report = buildReport(root); } catch (err) { console.error(`traceability: ${err.message}`); return 2; }
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.problems.length ? 1 : 0;
  }
  const coveredIds = Object.keys(report.coverage);
  const statusLine = Object.entries(report.statusCounts).map(([s, n]) => `${n} ${s}`).join(', ');
  console.log(`traceability: ${report.tests.length} test files; ${report.rows} parity-matrix rows (${statusLine})`);
  console.log(`  rows covered by at least one test: ${coveredIds.length}${coveredIds.length ? ` (${prefixCounts(coveredIds)})` : ''}`);
  const ac = coveredIds.filter((id) => id.startsWith('AC-'));
  console.log(`  acceptance cases covered: ${ac.length ? ac.join(' ') : 'none'}`);
  for (const t of report.tests) {
    console.log(`  ${t.file}: ${t.ids.length ? t.ids.join(' ') : '(no matrix row)'}${t.references.length ? `  [refs ${t.references.join(' ')}]` : ''}`);
  }
  if (argv.includes('--rows')) {
    for (const [id, c] of Object.entries(report.coverage)) console.log(`  ${id} (${c.status}): ${c.tests.join(', ')}`);
  }
  for (const p of report.problems) console.log(`  FAIL  ${p}`);
  console.log(report.problems.length ? `traceability: ${report.problems.length} problem(s)` : 'traceability: ok');
  return report.problems.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
