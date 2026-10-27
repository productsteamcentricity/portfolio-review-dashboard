/* ============================================================================
   2026-10-27: legacy fix batch 4, financial review (CR-0009, D-041, KI-143)
   One edit in the engine script (07_engine.js), parseBaseRows. Applies after
   tools/patches/2026-10-27-basefile-reading.js (file-name order).

   A row that repeats the header (its Instrument Name cell is the header's own
   instrument label and, when the file has a client column, its Client cell is the
   header's client label, letter case and spacing aside) is skipped before any of its
   cells is read, and is not counted. KI-143 made every number cell strict, so the
   repeated header's "Current Market Value (Cr.)" and "Market Value" texts were counted
   as text that is not a number, and the row as a holding left out: a false warning on
   the status line (synthetic book family-a-skipped-rows). Before fix batch 4 the row
   was skipped silently (its market value read as no number); the new reader skips it
   as a repeated header by the same test (app/src/ingest/base-file.ts classifyRow).
   No number changes: the row was never a holding.

   The line is inserted between two lines that no earlier patch wrote together, so the
   text 2026-10-27-basefile-reading.js wrote stays whole and that patch still reports
   itself applied on a re-run.

     node tools/patches/2026-10-27-basefile-review.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

const R = String.raw;

applyPatch('Legacy fix batch 4, financial review: a repeated header row is skipped before its cells are read', [
  {
    label: 'parseBaseRows: a row that repeats the header is skipped, uncounted, before any number cell is read',
    from: R`      var r=aoa[ri]; if(!r) continue;
      var nm = ws(gv(r,col.name)); if(!nm) continue;`,
    to: R`      var r=aoa[ri]; if(!r) continue;
      /* a row repeating the header (Instrument and Client cells equal to the header's labels, as the new reader
         tests) is not a holding: skipped before its cells are read, so no number cell of it is counted (KI-143) */
      if (col.name>=0 && ws(r[col.name]).toLowerCase()===H[col.name] && (col.client<0 || ws(r[col.client]).toLowerCase()===H[col.client])) continue;
      var nm = ws(gv(r,col.name)); if(!nm) continue;`
  }
]);
