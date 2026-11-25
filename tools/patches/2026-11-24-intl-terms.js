/* ============================================================================
   2026-11-24 — CR-0010 A4: the SWOT's "international" name test counts the
   overseas funds it missed and stops counting three domestic ones.

   A3 (2026-11-22-intl-word-boundary.js) gave each term a word start. Measured
   over every key of the fund blocks plus the 344 Other Funds names, it still
   missed genuine overseas funds ("Intl.", Asian, Asia Pacific, ASEAN, Brazil,
   Europe / European, Hang Seng, NYSE FANG+, Emerging Markets, Off-shore) and
   counted three names as wholly overseas that are not: the "First Global" and
   "SMC Global" PMS strategies (domestic) and "Edelweiss MSCI India Domestic &
   World Healthcare 45" (about two thirds Indian; its holdings data puts 32.5%
   in foreign stocks, so 0% is closer than 100%, and still a known limit).

   For a fund (any holding that is not direct equity) the test now also takes
   intl, nyse, off-shore / offshore, asia(n), asean, brazil, latin america,
   europ(e/ean), hang seng, fang, eafe and emerging market(s), and ignores
   "first global", "smc global", "india domestic", "s&p bse" and "magnum
   global". A direct-equity holding keeps exactly A3's test, because the wider
   terms would catch Indian companies ("Asian Paints", "Aban Offshore") and
   which listed shares are foreign is a separate question; except that an ETF
   held as a share (a name with "ETF" or "BeES") takes the fund test, so an
   overseas ETF in a demat book counts (Hang Seng, NYSE FANG+).
   The category test is unchanged. Counts and every name that moves are in the
   CR-0010 record.

     node tools/patches/2026-11-24-intl-terms.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('CR-0010 A4 international terms', [
  {
    label: 'engine SWOT: wider international terms for funds and ETFs, named domestic exceptions; other direct equity keeps A3',
    from: String.raw`    var intlCMV=0; rows.forEach(function(h){ if(/(\binternat|\bglobal|\bus\b|\bu\.s\.|\bnasdaq|\bs&p|\boverseas|\bworld|\bchina|\btaiwan|\bjapan)/i.test(h.name||"")||/global|international/i.test(h.category||"")) intlCMV+=h.cmvCr; });`,
    to: [
      String.raw`    /* CR-0010 A4: a fund counts by the wider terms unless its name is a known domestic one; a direct-equity`,
      String.raw`       holding keeps the A3 terms (the wider set would catch Indian companies such as "Asian Paints"), unless it`,
      String.raw`       is an ETF ("ETF", "BeES"), which takes the fund test. */`,
      String.raw`    var _intlA3=/(\binternat|\bglobal|\bus\b|\bu\.s\.|\bnasdaq|\bs&p|\boverseas|\bworld|\bchina|\btaiwan|\bjapan)/i,`,
      String.raw`        _intlFund=/(\binternat|\bintl\b|\bglobal|\bus\b|\bu\.s\.|\bnasdaq|\bnyse\b|\bs&p|\boverseas|\boff-?shore\b|\bworld|\bchina|\btaiwan|\bjapan|\basia|\basean\b|\bbrazil|\blatin america|\beurop|\bhang seng|\bfang\b|\beafe\b|\bemerging markets?\b)/i,`,
      String.raw`        _intlNot=/(\bfirst global\b|\bsmc global\b|\bindia domestic\b|\bs&p bse\b|\bmagnum global\b)/i,`,
      String.raw`        _intlEtf=/(\betf\b|bees\b)/i;`,
      String.raw`    var intlCMV=0; rows.forEach(function(h){ var _n=h.name||""; if(((h.directEquity&&!_intlEtf.test(_n))?_intlA3.test(_n):(_intlFund.test(_n)&&!_intlNot.test(_n)))||/global|international/i.test(h.category||"")) intlCMV+=h.cmvCr; });`
    ].join('\n')
  }
]);
