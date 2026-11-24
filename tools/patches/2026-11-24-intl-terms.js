/* ============================================================================
   2026-11-24 — CR-0010 A4: the SWOT's "international" name test counts the
   overseas funds it missed and stops counting three domestic ones.

   A3 (2026-11-22-intl-word-boundary.js) gave each term a word start. Measured
   over every key of the fund blocks plus the 344 Other Funds names, it still
   missed genuine overseas funds ("Intl.", Asian, Asia Pacific, ASEAN, Brazil,
   Europe / European, Hang Seng, NYSE FANG+, Emerging Markets, Off-shore) and
   still counted three domestic ones (the "First Global" and "SMC Global" PMS
   strategies, and "Edelweiss MSCI India Domestic & World Healthcare 45").

   For a fund (any holding that is not direct equity) the test now also takes
   intl, nyse, off-shore / offshore, asia(n), asean, brazil, latin america,
   europ(e/ean), hang seng, fang, eafe and emerging market(s), and ignores
   "first global", "smc global", "india domestic", "s&p bse" and "magnum
   global" (domestic names). A direct-equity holding keeps exactly A3's test:
   the wider terms would catch Indian companies ("Asian Paints", "Aban
   Offshore"), and which listed shares are foreign is a separate question.
   The category test is unchanged. Counts and every name that moves are in the
   CR-0010 record.

     node tools/patches/2026-11-24-intl-terms.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('CR-0010 A4 international terms', [
  {
    label: 'engine SWOT: wider international terms for funds, named domestic exceptions; direct equity keeps A3',
    from: String.raw`    var intlCMV=0; rows.forEach(function(h){ if(/(\binternat|\bglobal|\bus\b|\bu\.s\.|\bnasdaq|\bs&p|\boverseas|\bworld|\bchina|\btaiwan|\bjapan)/i.test(h.name||"")||/global|international/i.test(h.category||"")) intlCMV+=h.cmvCr; });`,
    to: [
      String.raw`    /* CR-0010 A4: a fund counts by the wider terms unless its name is a known domestic one; a direct-equity`,
      String.raw`       holding keeps the A3 terms (the wider set would catch Indian companies such as "Asian Paints"). */`,
      String.raw`    var _intlA3=/(\binternat|\bglobal|\bus\b|\bu\.s\.|\bnasdaq|\bs&p|\boverseas|\bworld|\bchina|\btaiwan|\bjapan)/i,`,
      String.raw`        _intlFund=/(\binternat|\bintl\b|\bglobal|\bus\b|\bu\.s\.|\bnasdaq|\bnyse\b|\bs&p|\boverseas|\boff-?shore\b|\bworld|\bchina|\btaiwan|\bjapan|\basia|\basean\b|\bbrazil|\blatin america|\beurop|\bhang seng|\bfang\b|\beafe\b|\bemerging markets?\b)/i,`,
      String.raw`        _intlNot=/(\bfirst global\b|\bsmc global\b|\bindia domestic\b|\bs&p bse\b|\bmagnum global\b)/i;`,
      String.raw`    var intlCMV=0; rows.forEach(function(h){ var _n=h.name||""; if((h.directEquity?_intlA3.test(_n):(_intlFund.test(_n)&&!_intlNot.test(_n)))||/global|international/i.test(h.category||"")) intlCMV+=h.cmvCr; });`
    ].join('\n')
  }
]);
