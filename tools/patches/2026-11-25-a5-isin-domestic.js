/* ============================================================================
   2026-11-25 — CR-0010 A5: the SWOT international share, two corrections from
   evidence (MOD-03's order after A4; queue confirmed by MOD-04, 25 Nov 2026).

   1. A share held directly whose reference entry (STOCK_RET, matched by the
      company name) carries an Indian company ISIN, INE... (equity) or IN9...
      (its partly-paid, DVR or rights-entitlement issue), is domestic. A3's
      name test counted Indian companies whose names say "International",
      "Global", "Overseas", "World" ("Allcargo Global", "Bikaji Foods
      International", "Indian Overseas Bank" ...). Measured over A4's
      direct-equity hits (360 of the 10,439 company names, through the engine's
      own name lookup): 297 Indian companies leave, 63 stay (5 Indian-domiciled
      overseas ETFs, and 58 names with no STOCK_RET entry: mostly foreign
      companies, and a few Indian names such as "Hari Govind International",
      for which the name test stays). Not any "IN" ISIN:
      INF... is a mutual fund unit, and the Indian-domiciled ETFs that invest
      abroad (Nasdaq 100, Hang Seng, FANG+) carry INF ISINs and stay
      international; an ETF held as a share takes the fund test anyway (A4).
      Client files have no ISIN column (the owner, 25 Nov), so only the
      reference entry's ISIN is read.
   2. Two overseas funds of funds whose names carry none of the fund test's
      words are counted, on evidence: the vendor's Other Funds file (Oct 2026)
      shows Baroda BNP Paribas Aqua FoF 97.59% "Overseas Mutual Fund Units" and
      ICICI Pru Strategic Metal and Energy Equity FoF 99.42%. They are the only
      two of the file's 58 mainly-overseas funds that A4's test misses. The
      phrases "BNP Paribas Aqua" and "Strategic Metal and Energy" name them in
      every plan (Regular, Direct) and option; "Prabhudas-Aqua Strategy" (a PMS)
      is not one.
   Nothing else changes: the fund test, its domestic exclusions, the ETF rule
   and the category fallback are A4's.

     node tools/patches/2026-11-25-a5-isin-domestic.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('CR-0010 A5 ISIN domestic and evidence list', [
  {
    label: 'engine SWOT: the evidence list of overseas funds of funds (A5)',
    from: '        _intlEtf=/(\\betf\\b|bees\\b)/i;\n',
    to: [
      '        _intlEtf=/(\\betf\\b|bees\\b)/i,',
      '        /* CR-0010 A5: overseas FoFs by evidence (vendor Other Funds file, Oct 2026: 97.59% and 99.42% overseas fund units) */',
      '        _intlEvid=/(\\bbnp paribas aqua\\b|\\bstrategic metal (and|&) energy\\b)/i,',
      '        /* CR-0010 A5: a share whose reference entry has an Indian company ISIN (INE..., IN9...) is domestic */',
      '        _intlInIsin=function(h){ return !!(h.stockRet&&/^IN[E9]/i.test(String(h.stockRet.isin||"").trim())); };',
      ''
    ].join('\n')
  },
  {
    label: 'engine SWOT: the international share reads the ISIN rule and the evidence list (A5)',
    from: '    var intlCMV=0; rows.forEach(function(h){ var _n=h.name||""; if(((h.directEquity&&!_intlEtf.test(_n))?_intlA3.test(_n):(_intlFund.test(_n)&&!_intlNot.test(_n)))||/global|international/i.test(h.category||"")) intlCMV+=h.cmvCr; });\n',
    to: '    var intlCMV=0; rows.forEach(function(h){ var _n=h.name||""; if(((h.directEquity&&!_intlEtf.test(_n))?(_intlA3.test(_n)&&!_intlInIsin(h)):((_intlFund.test(_n)||_intlEvid.test(_n))&&!_intlNot.test(_n)))||/global|international/i.test(h.category||"")) intlCMV+=h.cmvCr; });\n'
  }
]);
