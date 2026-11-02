/* ============================================================================
   KI-185: the ENGINE_KEYS check of tools/check-invariants.js runs both ways.
   (ARC-01, C3 of its contract review and its review of 2 Nov 2026; CR-0008, tax batch part T5, item 9.)

     node tools/regression/KI-185-engine-keys.js

   ENGINE_KEYS lists the names the engine exports. The check used to look one way only: it failed for a listed name the page did not
   export, but not for an export the list did not name, which is how six exports went unlisted until part T5 (KI-185). It now fails both
   ways. This test runs the real check, as a child process, against copies of the shipped page in a throwaway folder:
     - the page as it is: the check passes;
     - an export the list does not name, planted inside the engine's own object and as a late assignment: the check fails and names it;
     - a listed name taken out of the page: the check fails and names it as missing.
   Nothing in the repository is changed. Synthetic data only (the page carries reference data, no client data).
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();

const ROOT = path.join(__dirname, '..', '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const once = (s, a) => { const i = s.indexOf(a); return i >= 0 && s.indexOf(a, i + 1) < 0; };
const A_API = 'var API = {', A_TD = 'taxDefaults:TAX_HARVEST_DEFAULTS,', A_PARS = 'ENGINE.parsers = {';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ki185-'));
fs.mkdirSync(path.join(tmp, 'tools'));
['check-invariants.js', 'engine-host.js'].forEach(f => fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(tmp, 'tools', f)));
/* the check reads index.html beside tools/, so each case writes its page there and runs the copy of the check */
const run = html => {
  fs.writeFileSync(path.join(tmp, 'index.html'), html);
  const r = spawnSync(process.execPath, [path.join(tmp, 'tools', 'check-invariants.js')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  return { code: r.status, out, line: out.split(/\r?\n/).filter(l => /documented surface/.test(l))[0] || '' };
};

try {
  ok(once(page, A_API) && once(page, A_TD) && once(page, A_PARS),
    'the three anchors the planted pages use are in the shipped page exactly once ("var API = {", the taxDefaults export, "ENGINE.parsers = {")');

  const c0 = run(page);
  ok(c0.code === 0 && /PASS/.test(c0.line) && /no more and no less \(\d+ names\)/.test(c0.line) && /all invariants hold/.test(c0.out),
    'the shipped page: the check passes, ENGINE exports exactly the names ENGINE_KEYS lists (' + c0.line.trim().slice(0, 100) + ')');

  const c1 = run(page.replace(A_API, A_API + ' zzUnlisted:1,'));
  ok(c1.code === 1 && /FAIL/.test(c1.line) && /exported but not in ENGINE_KEYS/.test(c1.line) && /zzUnlisted/.test(c1.line) && !/missing/.test(c1.line) && /1 FAILURE\(S\)/.test(c1.out),
    'an export the list does not name, planted inside the engine\'s own object: the check fails (exit 1) and names zzUnlisted (' + c1.line.trim().slice(0, 150) + ')');

  const c2 = run(page.replace(A_PARS, 'ENGINE.zzLate = 1; ' + A_PARS));
  ok(c2.code === 1 && /FAIL/.test(c2.line) && /exported but not in ENGINE_KEYS/.test(c2.line) && /zzLate/.test(c2.line) && !/missing/.test(c2.line) && /1 FAILURE\(S\)/.test(c2.out),
    'an export assigned later, by another script of the page: the check fails (exit 1) and names zzLate (' + c2.line.trim().slice(0, 150) + ')');

  const c3 = run(page.replace(A_TD, ''));
  ok(c3.code === 1 && /FAIL/.test(c3.line) && /missing taxDefaults/.test(c3.line) && !/exported but not/.test(c3.line) && /1 FAILURE\(S\)/.test(c3.out),
    'a listed name taken out of the page: the check fails (exit 1) and names taxDefaults as missing (' + c3.line.trim().slice(0, 150) + ')');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
done();
