/* ============================================================================
   patch-lib.js — the only sanctioned way to change index.html.

   A change is a script in tools/patches/ that calls
     applyPatch('<change name>', [ { label, from, to }, … ])
   Each `from` must occur EXACTLY ONCE in index.html (an anchor, never an
   offset). Re-running a patch is safe: an edit whose `to` is already present
   (and whose `from` is gone, or is part of `to` for an insertion) is reported
   as already applied. A patch found partly present stops without writing
   (see SUPERSEDED below).

   Before writing, the result must keep the file's invariants: the naive
   "<script" count (14), the tail, LF-only line endings, no BOM, and the raw
   NUL bytes the UI script carries. The file is written as UTF-8 without BOM;
   MD5 before and after is printed for the change record.
   Run tools/check-invariants.js and tools/smoke-review.js afterwards.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'index.html');
const TAIL = '})();\n})();</script>\n</body>\n</html>\n';
const md5 = s => crypto.createHash('md5').update(Buffer.from(s, 'utf8')).digest('hex').toUpperCase();
const count = (hay, needle) => { let n = 0, i = 0; while ((i = hay.indexOf(needle, i)) >= 0) { n++; i += needle.length; } return n; };

/* A patch is either wholly present or wholly absent. If some of its edits are present and others are not, a
   later patch has most likely rewritten text this one wrote (re-applying the rest could duplicate code, e.g. a
   second copy of an inserted function), or the patch is being extended. Such a run stops without writing,
   unless opts.allowPartial or PATCH_ALLOW_PARTIAL=1 (only while extending a patch under development).
   To rebuild from scratch: git checkout -- index.html, then run every script in tools/patches/ in file-name
   order. */
const SUPERSEDED = 'A later patch has probably rewritten text this patch wrote. Do not re-run it on this build; ' +
  'to rebuild, restore index.html from git and run every script in tools/patches/ in file-name order.';

function applyPatch(name, edits, opts) {
  opts = opts || {};
  const allowPartial = !!opts.allowPartial || process.env.PATCH_ALLOW_PARTIAL === '1';
  const before = fs.readFileSync(FILE, 'utf8');
  let text = before;
  const report = [];
  let skipped = 0, applied = 0;
  edits.forEach(e => {
    const nFrom = count(text, e.from), nTo = e.to ? count(text, e.to) : 0;
    /* applied = the new text is present and either the anchor is gone (a replacement)
       or the new text contains the anchor (an insertion next to it) */
    if (nTo >= 1 && (nFrom === 0 || e.to.indexOf(e.from) >= 0)) { skipped++; report.push('  skip   ' + e.label + ' (already applied)'); return; }
    if (nFrom !== 1) throw new Error('anchor "' + e.label + '" found ' + nFrom + ' times; it must occur exactly once' +
      (skipped && !allowPartial ? '. ' + skipped + ' earlier edit(s) of patch "' + name + '" are already present: ' + SUPERSEDED : ''));
    text = text.replace(e.from, () => e.to);              /* function form: no $-pattern expansion */
    applied++;
    report.push('  apply  ' + e.label);
  });
  if (skipped && applied && !allowPartial)
    throw new Error('patch "' + name + '" is partly present already (' + skipped + ' edit(s) present, ' + applied +
      ' not); nothing was written. ' + SUPERSEDED);
  const nul = s => count(s, '\u0000');
  const problems = [];
  if (text.split('<script').length - 1 !== 14) problems.push('naive <script count is ' + (text.split('<script').length - 1) + ', expected 14');
  if (!text.endsWith(TAIL)) problems.push('file tail changed');
  if (text.indexOf('\r\n') >= 0) problems.push('CRLF line endings introduced');
  if (text.charCodeAt(0) === 0xFEFF) problems.push('byte-order mark introduced');
  if (nul(text) !== nul(before) && !opts.allowNulChange) problems.push('raw NUL byte count changed (' + nul(before) + ' -> ' + nul(text) + ')');
  if (problems.length) throw new Error('patch "' + name + '" would break index.html invariants:\n  - ' + problems.join('\n  - '));

  console.log('patch  : ' + name);
  report.forEach(r => console.log(r));
  if (text === before) { console.log('result : no change (everything already applied)'); return { changed: false }; }
  fs.writeFileSync(FILE, text, 'utf8');
  console.log('MD5    : ' + md5(before) + '  ->  ' + md5(text));
  console.log('bytes  : ' + Buffer.byteLength(before).toLocaleString('en-US') + '  ->  ' + Buffer.byteLength(text).toLocaleString('en-US'));
  return { changed: true, before: md5(before), after: md5(text) };
}

module.exports = { applyPatch };
