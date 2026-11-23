/* ============================================================================
   2026-11-22 — CR-0010 A2b: the AMC's own "The 30s Plan" / "The 40s Plan"
   spellings of Aditya Birla Sun Life Retirement Fund get their own
   look-through and never another fund's returns.

   These spellings normalise to "aditya birla sl retirement fund 30s" / "...
   40s", which no reference key matches exactly ("40s" is not "40"). Fuzzy
   matching gave them Retirement Fund-50's Regular and Direct returns (another
   fund, about 24% equity, for funds of about 98% and 79% equity), the
   Conglomerate Fund's or the Gilt Fund's look-through when tagged Equity or
   Debt, and Fund-30's look-through for "The 40s Plan". After A2 ("40s"
   exact-only) "The 40s Plan" matched nothing; "The 30s Plan" still took
   Fund-50's returns.

   The fix (both keys):
     - an ALIASES pin to the fund's own Regular hybrid key. A pin wins only
       where its target is a candidate (the hybrid look-through); elsewhere
       matchInstrument falls through to its exact step;
     - exact-only (EXACT_ONLY), so that fall-through ends with no match instead
       of a fuzzy one: no other fund's Regular or Direct returns, no other
       fund's equity or debt look-through.
   "The 40s Plan" is already exact-only (A2); "The 30s Plan" is added here.
   Measured both ways over every universe and at engine level (CR-0010 record).

     node tools/patches/2026-11-22-retirement-plan-pins.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('CR-0010 A2b retirement plan pins', [
  {
    label: 'engine: ALIASES pins for the "The 30s Plan" / "The 40s Plan" spellings',
    from: '    "transition venture capital fund 1": "Transition VC Fund",\n',
    to: [
      '    "transition venture capital fund 1": "Transition VC Fund",',
      '    // CR-0010 A2b: the AMC\'s own spellings of these plans -> their own hybrid look-through (also exact-only below)',
      '    "aditya birla sl retirement fund 30s": "Aditya Birla SL Retirement Fund-30-Reg(G)",',
      '    "aditya birla sl retirement fund 40s": "Aditya Birla SL Retirement Fund-40-Reg(G)",',
      ''
    ].join('\n')
  },
  {
    label: 'engine: "The 30s Plan" spelling is exact-only too',
    from: '  function isExactOnly(name){ return Object.prototype.hasOwnProperty.call(EXACT_ONLY, normalize(name).join(" ")); }\n',
    to: [
      '  function isExactOnly(name){ return Object.prototype.hasOwnProperty.call(EXACT_ONLY, normalize(name).join(" ")); }',
      '  EXACT_ONLY["aditya birla sl retirement fund 30s"] = 1;   // CR-0010 A2b: pinned above; no fuzzy match elsewhere',
      ''
    ].join('\n')
  }
]);
