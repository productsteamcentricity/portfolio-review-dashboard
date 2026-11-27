/* ============================================================================
   2026-11-26 — IRR-SI: the IRR (cashflow) file's since-inception sheets
   (found by CHAT-010, flagged by CHAT-012, confirmed by EX-03; MOD-04's order,
   26 Nov 2026; publish under the owner's delegation PD-67 when every gate passes).

   The platform's cashflow file, which analysts upload as it is, holds six
   sheets in this order: SI Xirr, SI Bmxirr, YTD Xirr, YTD Bmxirr, QTD Xirr,
   QTD Bmxirr. parseIRR (parsers script) picked its fund and benchmark sheets
   by name with "the last match wins", so it took QTD Xirr and QTD Bmxirr:
   every transaction XIRR, the client sheets, the Fund IRR tree and the tax
   lots were computed from quarter-to-date flows only, with no error.

   After:
   - a sheet whose name says YTD, QTD, MTD or FYTD (a whole word) is never
     taken, by name or by the content fallback;
   - among the rest, a sheet whose name begins with SI (as a word: "SI Xirr",
     "SI-Xirr", "SI_Xirr"; never "SIP Xirr") or "Since Inception" is preferred,
     the first such sheet of each kind;
   - otherwise the legacy rule stands: the last fund ("...Xirr") and benchmark
     ("...Bmxirr") names, then the content fallback.
   A file with only period sheets now yields no fund rows, and the upload
   says "no IRR transactions recognised (need a SI Xirr sheet)", as for any
   file without a fund sheet.

     node tools/patches/2026-11-26-irr-si-sheets.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('IRR-SI since-inception sheets', [
  {
    label: 'parsers: parseIRR prefers the SI sheets and never takes YTD / QTD / MTD',
    from: '    // 1) Detect sheets by NAME (original behaviour: "...Bmxirr" = benchmark, "...Xirr" = fund).\n' +
          '    var benchSh=null,fSh=null;\n' +
          '    sheetNames.forEach(function(sn){ var u=String(sn).toUpperCase(); if(u.indexOf("BMXIRR")>=0||u.indexOf("BM XIRR")>=0||u.indexOf("BMX")>=0) benchSh=sn; else if(u.indexOf("XIRR")>=0) fSh=sn; });\n',
    to: '    // 1) Detect sheets by NAME ("...Bmxirr" = benchmark, "...Xirr" = fund). IRR-SI (26 Nov 2026): the platform\'s cashflow\n' +
        '    //    file holds SI, YTD and QTD pairs and the review is since inception, so a period sheet (YTD, QTD, MTD, FYTD) is\n' +
        '    //    never taken, a sheet named SI or "Since Inception" is preferred (the first of each kind; "SIP" is not SI), and\n' +
        '    //    otherwise the last match wins, as before.\n' +
        '    var _per=function(sn){ return /(^|[^A-Z0-9])(YTD|QTD|MTD|FYTD)(?![A-Z0-9])/.test(String(sn).toUpperCase()); };\n' +
        '    var _si=function(sn){ var u=String(sn).toUpperCase().trim(); return /^SI(?![A-Z0-9])/.test(u)||/^SINCE[\\s_-]*INCEPTION/.test(u); };\n' +
        '    var benchSh=null,fSh=null,benchSI=null,fSI=null;\n' +
        '    sheetNames.forEach(function(sn){ if(_per(sn)) return; var u=String(sn).toUpperCase();\n' +
        '      if(u.indexOf("BMXIRR")>=0||u.indexOf("BM XIRR")>=0||u.indexOf("BMX")>=0){ benchSh=sn; if(!benchSI&&_si(sn)) benchSI=sn; }\n' +
        '      else if(u.indexOf("XIRR")>=0){ fSh=sn; if(!fSI&&_si(sn)) fSI=sn; } });\n' +
        '    if(benchSI) benchSh=benchSI; if(fSI) fSh=fSI;\n',
  },
  {
    label: 'parsers: the content fallback skips period sheets too',
    from: '        if(sn===benchSh||sn===fSh) return;\n',
    to: '        if(sn===benchSh||sn===fSh||_per(sn)) return;   /* IRR-SI: never a YTD / QTD / MTD sheet */\n',
  },
]);
