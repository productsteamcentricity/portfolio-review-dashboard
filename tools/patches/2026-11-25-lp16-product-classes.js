/* ============================================================================
   2026-11-25 — LP-16 / KI-051 (P0): six non-mutual-fund product types get their
   own product class, so the engine never treats them as mutual funds.

   The engine's productClass() read the base file's Product column for PMS, AIF
   and SIF only; everything else was "MF". A GIFT City fund, an offshore fund, a
   bond, a fixed deposit, a REIT or InvIT, or an unlisted share was therefore
   matched against the mutual funds: it could take a mutual fund's look-through
   (its stocks in the client's equity mix) and, through the performance match,
   a mutual fund's returns (KI-051; audit NEW-5; OD-6).

   The owner's answer to D-7 (25 Nov 2026) names the six types and their labels.
   They are read from the Product column without regard to letter case, by the
   type names and keywords the owner gave:
     "GIFT City funds"                 gift city, ifsc
     "Offshore funds"                  offshore, off-shore
     "US-dollar bonds (through LRS)"   bond(s), ncd(s), lrs, debenture
     "Fixed deposits"                  fixed deposit, fd(s)
     "REITs and InvITs"                reit(s), invit(s)
     "Unlisted shares"                 unlisted
   For the last four, OD-6 applies: a product that also says ETF, MF, mutual
   fund or fund stays a mutual fund ("Bond Fund", "Bharat Bond ETF", "REIT
   FoF"). Sovereign gold bonds and market-linked debentures (SGB, MLD) are none
   of the six and keep their old class, though OD-6 calls them non-MF: they
   wait for a label. GIFT City and offshore are tested first (a "GIFT City
   AIF" is a GIFT City fund); PMS, AIF and SIF keep their tests; the rest is
   "MF" as before.

   A holding of one of these classes:
     - is offered no look-through candidates (no reference block holds them; the
       class is never crossed) and is listed as excluded, with its class named;
     - is not matched for performance (no mutual fund's returns);
     - an "Unlisted shares" product is no longer read as a listed stock
       (isDirectEquity), so no listed company's market cap or returns either.
   Nothing else changes. Measured both ways in the LP-16 record.

     node tools/patches/2026-11-25-lp16-product-classes.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('LP-16 KI-051 non-MF product classes', [
  {
    label: 'engine: isDirectEquity() never reads an unlisted share as a listed stock',
    from: String.raw`    if (/mutual fund|pms|aif|index fund|^etf$|bond|debenture|ncd|fixed deposit|\bfd\b/.test(p)) return false;`,
    to: String.raw`    if (/mutual fund|pms|aif|index fund|^etf$|bond|debenture|ncd|fixed deposit|\bfd\b|unlisted/.test(p)) return false;   /* LP-16: unlisted is its own class */`
  },
  {
    label: 'engine: productClass() reads the six non-MF product types (D-7, OD-6)',
    from: [
      '    function productClass(h){',
      '      var p=String(h.product||"").toUpperCase();',
      '      if (p.indexOf("PMS")>=0) return "PMS";',
      '      if (p.indexOf("AIF")>=0) return "AIF";',
      '      if (p.indexOf("SIF")>=0) return "SIF";',
      '      return "MF";',
      '    }',
      ''
    ].join('\n'),
    to: [
      String.raw`    /* LP-16 / KI-051: the owner's six non-MF product types (D-7), read from the Product column without regard to`,
      String.raw`       letter case. [class label, keywords, OD-6 exception: a product that also says ETF / MF / fund stays MF,`,
      String.raw`       products that are none of the six and keep their old class: sovereign gold bonds and market-linked debentures]. */`,
      String.raw`    var NON_MF_CLASSES=[`,
      String.raw`      ["GIFT City funds", /gift\s*city|\bifsc\b/i, false],`,
      String.raw`      ["Offshore funds", /off-?shore/i, false],`,
      String.raw`      ["US-dollar bonds (through LRS)", /\bbonds?\b|\bncds?\b|\blrs\b|debenture/i, true, /sovereign\s*gold|\bsgbs?\b|market[\s-]*linked|\bmlds?\b/i],`,
      String.raw`      ["Fixed deposits", /fixed\s*deposit|\bfds?\b/i, true],`,
      String.raw`      ["REITs and InvITs", /\breits?\b|\binvits?\b/i, true],`,
      String.raw`      ["Unlisted shares", /unlisted/i, true]`,
      String.raw`    ], _fundWord=/\betfs?\b|\bmfs?\b|mutual fund|\bfunds?\b|\bfofs?\b/i, _nonMf={};`,
      String.raw`    NON_MF_CLASSES.forEach(function(c){ _nonMf[c[0]]=1; });`,
      String.raw`    function nonMfClass(product){`,
      String.raw`      var p=String(product||"");`,
      String.raw`      for (var i=0;i<NON_MF_CLASSES.length;i++){ var c=NON_MF_CLASSES[i];`,
      String.raw`        if (c[1].test(p) && !(c[2] && _fundWord.test(p)) && !(c[3] && c[3].test(p))) return c[0]; }`,
      String.raw`      return null;`,
      String.raw`    }`,
      '    function productClass(h){',
      '      var p=String(h.product||"").toUpperCase();',
      '      var _n=nonMfClass(h.product);',
      '      if (_n==="GIFT City funds"||_n==="Offshore funds") return _n;   /* before PMS / AIF / SIF: a "GIFT City AIF" is a GIFT City fund */',
      '      if (p.indexOf("PMS")>=0) return "PMS";',
      '      if (p.indexOf("AIF")>=0) return "AIF";',
      '      if (p.indexOf("SIF")>=0) return "SIF";',
      '      if (_n) return _n;',
      '      return "MF";',
      '    }',
      ''
    ].join('\n')
  },
  {
    label: 'engine: a non-MF class is never matched for performance',
    from: '      else { h.perfKey=matchInstrument(h.name,h.amc,mfKeys,cacheMF); if(h.perfKey)h.perfSrc="MF"; }\n',
    to: [
      '      else if (_nonMf[h.pcls]){ /* LP-16: no performance data for this product class; never a mutual fund\'s returns */ }',
      '      else { h.perfKey=matchInstrument(h.name,h.amc,mfKeys,cacheMF); if(h.perfKey)h.perfSrc="MF"; }',
      ''
    ].join('\n')
  },
  {
    label: 'engine: the look-through exclusion names the non-MF class',
    from: '      if (c==="SIF") return "No SIF look-through data exists";\n',
    to: [
      '      if (c==="SIF") return "No SIF look-through data exists";',
      '      if (_nonMf[c]) return "Not a mutual fund ("+c+"): no look-through data";',
      ''
    ].join('\n')
  }
]);
