/* ============================================================================
   run-regression.js — run every known-answer regression test in
   tools/regression/ (one file per fixed issue, e.g. KI-007-blank-invested.js).

     node tools/run-regression.js            run all
     node tools/run-regression.js KI-007     run the files whose name contains "KI-007"

   Each test is a standalone Node script that exits 0 when every check passes
   and 1 otherwise, printing PASS / FAIL lines. Tests use only the shipped
   engine (tools/engine-host.js) and synthetic data (tools/make-sample-base.js
   or rows built in the test); never client data. Exit code 1 if any test fails.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = path.join(__dirname, 'regression');
const filter = process.argv[2] || '';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.js$/.test(f) && f.indexOf(filter) >= 0).sort() : [];
if (!files.length) { console.log('no regression tests' + (filter ? ' matching ' + filter : '')); process.exit(0); }

let failed = [];
for (const f of files) {
  const r = spawnSync(process.execPath, ['--max-old-space-size=8192', path.join(dir, f)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split(/\r?\n/).filter(l => /^\s*(PASS|FAIL)\b/.test(l));
  const ok = r.status === 0;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + f + '  (' + lines.filter(l => /PASS/.test(l)).length + ' checks passed' +
    (ok ? '' : ', ' + lines.filter(l => /FAIL/.test(l)).length + ' failed') + ')');
  if (!ok) { failed.push(f); console.log(out.split(/\r?\n/).filter(l => /FAIL|Error|error/.test(l)).slice(0, 10).map(l => '      ' + l).join('\n')); }
}
console.log('\n' + (failed.length ? failed.length + ' of ' + files.length + ' regression test file(s) FAILED' : 'all ' + files.length + ' regression test file(s) passed'));
process.exit(failed.length ? 1 : 0);
