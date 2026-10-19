/* ============================================================================
   KI-114 — every keystroke in a Current vs Sample (CVS) cell redrew the whole
   table (oninput -> sync -> rebuildCVS -> innerHTML), which replaced the cell
   being typed in: the focus was lost after the first character, so "12" typed
   at a normal pace became 1.00. It mattered more once the Unallocated row's
   expected return had to be typed (KI-067, OD-29).

   Fixed: a keystroke ("input") updates the figures only; the table, its totals
   and the slide snapshot are redrawn when the entry is committed ("change":
   Enter, leaving the cell, or a spinner step).

   Checks, on the CVS section cut out of index.html by anchor and run on a fake
   DOM (tools/regression/lib/cvs-harness.js):
   - keystrokes in the Unallocated return cell and in a group-row cell do not
     redraw the table, and the cell object being typed in is not replaced;
   - the commit redraws once and the totals use the typed value; the known
     answer (80% x 14.00% + 20% x 12.00% = 13.60%) is computed here;
   - clearing the cell and committing makes the totals "—" again.
   Synthetic data only (an invented hybrid that matches no reference record).
   Exit 1 on any failure.
   ========================================================================== */
'use strict';
const H = require('../engine-host.js');
const C = require('./lib/cvs-harness.js');

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const pre = (c, m) => { console.log((c ? 'PRE   ' : 'FAIL  precondition: ') + m); if (!c) fail++; };
const J = x => JSON.stringify(x);

async function main() {
  const html = C.readHtml();
  console.log('--- static: keystrokes do not redraw, the commit does ---');
  ok(html.indexOf('inp.oninput=function(){ sync.call(this,false); };') >= 0, 'oninput updates the figures without a redraw');
  ok(html.indexOf('inp.onchange=function(){ sync.call(this,true); };') >= 0, 'onchange (Enter, leaving the cell, spinner) redraws');
  ok(html.indexOf('        inp.oninput=sync;\n') < 0, 'the old per-keystroke redraw is gone');

  const host = H.load();
  const { E, REF } = host;
  const LC = 'HDFC Large Cap Fund(G)', UNK = 'Zzyzx Notional Balanced Hybrid Fund(G)';
  const m = C.bookModel(host, [[LC, 'Large Cap Fund', 'Equity', 'HDFC', 8.0], [UNK, 'Balanced Advantage Fund', 'Hybrid', 'Zzyzx', 2.0]]);
  pre(!m.holdings[1].hyKey && !m.holdings[1].eqKey, 'the invented hybrid matches no reference record, so 20% is Unallocated');
  const cv = C.loadCvs({ E, REF, model: m });
  cv.api.renderCVS();
  const grand = () => (C.rowCells(cv.dom.tableHtml(), 'Grand Total')[0] || null);
  const snapUn = () => (cv.snap() && cv.snap().unalloc) || {};
  pre(!!grand() && grand()[2] === '—', 'before typing, the current Grand Total return is — (got ' + J(grand()) + ')');

  console.log('--- the Unallocated return cell, typed "1" then "12" at a normal pace ---');
  const w0 = cv.dom.writes['cvs-tbl-wrap'];
  const a = cv.dom.keyUn('cr', '1');
  ok(!!a && cv.dom.writes['cvs-tbl-wrap'] === w0, 'the first keystroke does not redraw the table (writes ' + w0 + ' -> ' + cv.dom.writes['cvs-tbl-wrap'] + ')');
  ok(!!a && cv.dom.unInput('cr') === a, 'the cell being typed in is the same object after the first keystroke (focus kept)');
  const b = cv.dom.keyUn('cr', '12');
  ok(!!b && b === a && cv.dom.writes['cvs-tbl-wrap'] === w0, 'the second keystroke goes into the same cell, still no redraw');
  ok(cv.dom.commitUn('cr') && cv.dom.writes['cvs-tbl-wrap'] === w0 + 1, 'the commit redraws the table once (writes ' + cv.dom.writes['cvs-tbl-wrap'] + ')');
  const want = (0.8 * 14 + 0.2 * 12).toFixed(2) + '%';
  ok(!!grand() && grand()[2] === want, 'after the commit the current Grand Total uses 12.00%: ' + want + ' (got ' + J(grand()) + ')');
  ok(snapUn().cr === 12, 'the slide snapshot carries the typed 12.00% (got ' + J(snapUn().cr) + ')');

  console.log('--- clearing the cell and committing makes the totals "—" again ---');
  cv.dom.keyUn('cr', '');
  ok(!!grand() && grand()[2] === want, 'clearing without a commit leaves the table as it was');
  cv.dom.commitUn('cr');
  ok(!!grand() && grand()[2] === '—' && snapUn().cr === null, 'after the commit: current Grand Total — and the snapshot return blank (got ' + J(grand()) + ', ' + J(snapUn().cr) + ')');

  console.log('--- a group-row cell (Equity MF current return) ---');
  const inp0 = cv.dom.cellInput(1, 0, 'currRet');
  pre(!!inp0, 'the Equity MF current Exp. Return cell exists');
  const w1 = cv.dom.writes['cvs-tbl-wrap'];
  const c1 = cv.dom.keyCell(1, 0, 'currRet', '1');
  ok(!!c1 && c1 === inp0 && cv.dom.writes['cvs-tbl-wrap'] === w1, 'a keystroke in a group-row cell does not redraw or replace the cell');
  cv.dom.keyCell(1, 0, 'currRet', '15');
  ok(cv.dom.cellInput(1, 0, 'currRet') === inp0 && cv.dom.writes['cvs-tbl-wrap'] === w1, 'the next keystroke goes into the same cell');

  console.log('\n' + (fail ? fail + ' check(s) FAILED' : 'all KI-114 checks passed'));
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.log('FAIL  ' + (e && e.stack || e)); process.exit(1); });
