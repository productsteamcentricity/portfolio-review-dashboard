/* ============================================================================
   2026-11-22 — CR-0010 A3: the SWOT's "international" share counts only names
   that are international, not names that merely contain "us ".

   The engine's shared SWOT signal (intlPct, used by the strengths, weaknesses
   and opportunities quadrants) counted a holding as international when its
   name matched /(internat|global|us |nasdaq|s&p|overseas|world|china|taiwan|
   japan)/i anywhere. "us " matched inside other words: "Plus " (the Income Plus
   Arbitrage funds of funds, Credit Plus, Bond Plus ...), the whole Taurus AMC,
   Abakkus, "Bonus ", "Cautious " and others. Each term now needs a word start,
   and "us" a whole word ("US", and "U.S." spelled with dots). The category test
   is unchanged. Before and after counts over the fund universe are in the
   CR-0010 record.

     node tools/patches/2026-11-22-intl-word-boundary.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('CR-0010 A3 international word boundary', [
  {
    label: 'engine SWOT: the international name test uses word boundaries',
    from: 'if(/(internat|global|us |nasdaq|s&p|overseas|world|china|taiwan|japan)/i.test(h.name||"")||',
    to: 'if(/(\\binternat|\\bglobal|\\bus\\b|\\bu\\.s\\.|\\bnasdaq|\\bs&p|\\boverseas|\\bworld|\\bchina|\\btaiwan|\\bjapan)/i.test(h.name||"")||'
  }
]);
