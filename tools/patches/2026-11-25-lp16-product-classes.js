/* ============================================================================
   2026-11-25 — LP-16 / KI-051 (P0): six non-mutual-fund product types get their
   own product class, so the engine never treats them as mutual funds.

   The engine's productClass() read the base file's Product column for PMS, AIF
   and SIF only; everything else was "MF". A GIFT City fund, an offshore fund, a
   bond, a fixed deposit, a REIT or InvIT, or an unlisted share was therefore
   matched against the mutual funds: it could take a mutual fund's look-through
   (its stocks in the client's equity mix) and, through the performance match,
   a mutual fund's returns (KI-051; audit NEW-5; OD-6). An unlisted share was
   read as a listed stock.

   The owner's answer to D-7 (25 Nov 2026) names the six types and their labels.
   The rules are data: a new REFDATA key, PRODUCT_CLASS_RULES (contract I-40,
   option A: one source for both builds; data/refdata/PRODUCT_CLASS_RULES.json is
   generated from it, D-035). An ordered list; the first rule that matches the
   Product column wins. Matching ignores letter case and is by whole word or
   phrase; a space or hyphen inside a keyword matches any run of spaces or
   hyphens, or none ("off-shore" matches "offshore", "off shore", "off-shore").
     label                           keywords                       unlessAny  notIf
     GIFT City funds                 gift city, ifsc                -          -       (tested before PMS / AIF / SIF)
     Offshore funds                  off-shore                      -          -       (tested before PMS / AIF / SIF)
     US-dollar bonds (through LRS)   bond(s), ncd(s), lrs, debenture(s)  fund words  sovereign gold, sgb, market linked, mld
     Fixed deposits                  fixed deposit(s), fd(s)        fund words -
     REITs and InvITs                reit(s), invit(s)              fund words -
     Unlisted shares                 unlisted                       fund words -
   Fund words (OD-6: a product that also says ETF, MF or fund stays a mutual
   fund): etf(s), mf(s), mutual fund(s), fund(s), fof(s). So "Corporate Bond
   Fund", "Bharat Bond ETF", "REIT FoF" stay mutual funds. Sovereign gold bonds
   and market-linked debentures are none of the six and keep their old class
   until they have a label. "class" is the new build's class for each rule
   (I-29: OTHER, BOND, EQUITY), not read by the live page.

   A holding of one of these classes:
     - is offered no look-through candidates (no reference block holds them; the
       class is never crossed) and is listed as excluded, with its class named;
     - is never matched for performance, whatever else the Product text says
       (a "GIFT City AIF" or "Offshore PMS" takes no domestic AIF's or PMS's
       returns: the financial review of LP-16);
     - is never read as a listed stock (an "Unlisted shares", "Offshore Equity
       Shares" or "GIFT City Stocks" product);
     - is not reported as "could not be matched to reference data": there is no
       reference data for these types by design, and the look-through box lists
       each with its class and reason.
   Nothing else changes. Measured both ways in the LP-16 record.

     node tools/patches/2026-11-25-lp16-product-classes.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

const FUND_WORDS = ['etf', 'etfs', 'mf', 'mfs', 'mutual fund', 'mutual funds', 'fund', 'funds', 'fof', 'fofs'];
const RULES = [
  { label: 'GIFT City funds', keywords: ['gift city', 'ifsc'], beforePmsAifSif: true, class: 'OTHER' },
  { label: 'Offshore funds', keywords: ['off-shore'], beforePmsAifSif: true, class: 'OTHER' },
  { label: 'US-dollar bonds (through LRS)', keywords: ['bond', 'bonds', 'ncd', 'ncds', 'lrs', 'debenture', 'debentures'],
    unlessAny: FUND_WORDS, notIf: ['sovereign gold', 'sgb', 'sgbs', 'market linked', 'mld', 'mlds'], class: 'BOND' },
  { label: 'Fixed deposits', keywords: ['fixed deposit', 'fixed deposits', 'fd', 'fds'], unlessAny: FUND_WORDS, class: 'OTHER' },
  { label: 'REITs and InvITs', keywords: ['reit', 'reits', 'invit', 'invits'], unlessAny: FUND_WORDS, class: 'OTHER' },
  { label: 'Unlisted shares', keywords: ['unlisted'], unlessAny: FUND_WORDS, class: 'EQUITY' }
];

applyPatch('LP-16 KI-051 non-MF product classes', [
  {
    label: 'REFDATA: the PRODUCT_CLASS_RULES table (D-7, OD-6; contract I-40)',
    from: 'window.REFDATA = {"FUND_RANKS":',
    to: 'window.REFDATA = {"PRODUCT_CLASS_RULES":' + JSON.stringify(RULES) + ',"FUND_RANKS":'
  },
  {
    label: 'engine: productClass() reads the six non-MF product types from PRODUCT_CLASS_RULES',
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
      String.raw`    /* LP-16 / KI-051: the owner's six non-MF product types (D-7), from REFDATA.PRODUCT_CLASS_RULES (one source for`,
      String.raw`       both builds, I-40). Whole words or phrases, letter case ignored; a space or hyphen in a keyword matches any run`,
      String.raw`       of spaces or hyphens, or none. The first rule that matches wins; unlessAny keeps a fund (OD-6), notIf a product`,
      String.raw`       that is none of the six. */`,
      String.raw`    function _pcrRe(list){`,
      String.raw`      if (!list || !list.length) return null;`,
      String.raw`      return new RegExp("(^|[^a-z0-9])(" + list.map(function(k){`,
      String.raw`        return String(k).toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/[\s-]+/g, "[\\s-]*"); }).join("|") + ")(?![a-z0-9])", "i");`,
      String.raw`    }`,
      String.raw`    var _pcr=(REF.PRODUCT_CLASS_RULES||[]).map(function(r){`,
      String.raw`      return { label:r.label, first:!!r.beforePmsAifSif, kw:_pcrRe(r.keywords), unless:_pcrRe(r.unlessAny), not:_pcrRe(r.notIf) }; });`,
      String.raw`    var _nonMf={}; _pcr.forEach(function(r){ _nonMf[r.label]=1; });`,
      String.raw`    function nonMfClass(product){`,
      String.raw`      var p=String(product||"");`,
      String.raw`      for (var i=0;i<_pcr.length;i++){ var r=_pcr[i];`,
      String.raw`        if (r.kw && r.kw.test(p) && !(r.unless && r.unless.test(p)) && !(r.not && r.not.test(p))) return r; }`,
      String.raw`      return null;`,
      String.raw`    }`,
      '    function productClass(h){',
      '      var p=String(h.product||"").toUpperCase();',
      '      var _r=nonMfClass(h.product);',
      '      if (_r && _r.first) return _r.label;   /* before PMS / AIF / SIF: a "GIFT City AIF" is a GIFT City fund */',
      '      if (p.indexOf("PMS")>=0) return "PMS";',
      '      if (p.indexOf("AIF")>=0) return "AIF";',
      '      if (p.indexOf("SIF")>=0) return "SIF";',
      '      if (_r) return _r.label;',
      '      return "MF";',
      '    }',
      ''
    ].join('\n')
  },
  {
    label: 'engine: a non-MF product is never read as a listed stock',
    from: '      h.directEquity = isDirectEquity(h);\n',
    to: '      h.directEquity = isDirectEquity(h) && !nonMfClass(h.product);   /* LP-16: "Unlisted shares", "Offshore Equity Shares" */\n'
  },
  {
    label: 'engine: a non-MF class is never matched for performance (tested before PMS / AIF / SIF)',
    from: '      if (isPMS){ h.perfKey=matchPMS(h.name,pmsKeys,cachePMS); if(h.perfKey)h.perfSrc="PMS"; }\n',
    to: [
      '      if (_nonMf[h.pcls]){ /* LP-16: no performance data for this product class; never a fund\'s, PMS\'s or AIF\'s returns */ }',
      '      else if (isPMS){ h.perfKey=matchPMS(h.name,pmsKeys,cachePMS); if(h.perfKey)h.perfSrc="PMS"; }',
      ''
    ].join('\n')
  },
  {
    label: 'engine: a non-MF holding is not reported as unmatched (no reference data exists for it by design)',
    from: '      if (!h.commodity && !h.eqKey && !h.hyKey && !h.dbKey && !h.perfKey) unmatchedSet[h.name]=1;\n',
    to: '      if (!h.commodity && !_nonMf[h.pcls] && !h.eqKey && !h.hyKey && !h.dbKey && !h.perfKey) unmatchedSet[h.name]=1;   /* LP-16 */\n'
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
