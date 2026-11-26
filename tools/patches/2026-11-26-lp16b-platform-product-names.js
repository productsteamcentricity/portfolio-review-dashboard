/* ============================================================================
   2026-11-26 — LP-16b: the platform's own Product Name values (owner's
   decisions of 26 Nov 2026 ~18:25 IST, relayed by MOD-04; plan
   C:\dev\private\ex03\lp16b\PLAN-LP16B-PLATFORM-PRODUCT-NAMES-2026-11-26.md).

   The platform exports write Mutual Funds, Direct Equity, PMS, SIF,
   Unlisted-Direct, AIF-Listed, Global Exposure, Bonds and P2P Lending in the
   Product Name column; analysts cannot retype them. On main:
   - "Global Exposure" and "P2P Lending" fell to MF (looked up in the mutual
     fund universe, unmatched);
   - every bond was "US-dollar bonds (through LRS)" (the 25 Nov rule);
   - "Unlisted-Direct" took the Unlisted shares label but was not a share held
     directly (no word "share"), so the Cost fallback, the SWOT asset and the
     international test treated it as a fund;
   - "AIF-Listed" was taxed as Category I/II assumed: the Listed-AIF rule
     (D-043) read only the Category.

   After:
   1. PRODUCT_CLASS_RULES (contract I-40) gains two optional fields: nameAny
      (words the instrument name must contain) and andAny (words the product
      or the name must contain); the rules, first match wins:
      - GIFT City funds: "gift city", "ifsc" (as before); and "global
        exposure" when the name says GIFT or IFSC (the owner: "Treat Global
        Exposure as both Offshore Funds and Gift City Funds");
      - Offshore funds: "off-shore" (as before) and "global exposure";
      - US-dollar bonds (through LRS): a bond, NCD or debenture (or LRS) only
        when the product or the name says USD, US$, dollar or LRS;
      - Rupee bonds and NCDs: every other bond, NCD or debenture (the owner:
        "Rupee bonds and NCDs"); the same fund and SGB / MLD exclusions;
      - Fixed deposits, REITs and InvITs, Unlisted shares: as before;
      - P2P lending: "p2p", "peer to peer" (class DEBT; the owner: "Debt").
      Each is a non-MF class as in LP-16: no performance lookup, never a
      listed stock, listed with its class in the look-through box.
   2. "Unlisted-Direct" (or "Direct-Unlisted") is a share held directly, not
      listed: h.heldShare, as an "Unlisted Shares" product.
   3. Tax (tax-6, narrowed for its label, widened for the name): a product or
      category that says bond, NCD or debenture has no tax figure when the
      product or category names a foreign route (as before) or the NAME says
      USD, US$, dollar or LRS; a plain "Bonds" product keeps the Listed Bonds /
      NCDs rows it had. A keyword's "$" is kept, so "us$" is US$, not "US".
   4. Tax: a product written "AIF-Listed" (or "Listed AIF") is a Listed AIF,
      Category III with its note (D-043), as the category "Listed AIF" is.
   Nothing else changes: Mutual Funds, Direct Equity, PMS and SIF route as
   before (pinned by tools/regression/LP16b-platform-product-names.js).

     node tools/patches/2026-11-26-lp16b-platform-product-names.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

const FUND_WORDS = ['etf', 'etfs', 'mf', 'mfs', 'mutual fund', 'mutual funds', 'fund', 'funds', 'fof', 'fofs'];
const NOT_BOND = ['sovereign gold', 'sgb', 'sgbs', 'market linked', 'mld', 'mlds'];
const BOND_WORDS = ['bond', 'bonds', 'ncd', 'ncds', 'debenture', 'debentures'];
const OLD_RULES = [
  { label: 'GIFT City funds', keywords: ['gift city', 'ifsc'], beforePmsAifSif: true, class: 'OTHER' },
  { label: 'Offshore funds', keywords: ['off-shore'], beforePmsAifSif: true, class: 'OTHER' },
  { label: 'US-dollar bonds (through LRS)', keywords: ['bond', 'bonds', 'ncd', 'ncds', 'lrs', 'debenture', 'debentures'],
    unlessAny: FUND_WORDS, notIf: NOT_BOND, class: 'BOND' },
  { label: 'Fixed deposits', keywords: ['fixed deposit', 'fixed deposits', 'fd', 'fds'], unlessAny: FUND_WORDS, class: 'OTHER' },
  { label: 'REITs and InvITs', keywords: ['reit', 'reits', 'invit', 'invits'], unlessAny: FUND_WORDS, class: 'OTHER' },
  { label: 'Unlisted shares', keywords: ['unlisted'], unlessAny: FUND_WORDS, class: 'EQUITY' },
];
const RULES = [
  { label: 'GIFT City funds', keywords: ['gift city', 'ifsc'], beforePmsAifSif: true, class: 'OTHER' },
  { label: 'GIFT City funds', keywords: ['global exposure'], nameAny: ['gift', 'ifsc'], beforePmsAifSif: true, class: 'OTHER' },
  { label: 'Offshore funds', keywords: ['off-shore', 'global exposure'], beforePmsAifSif: true, class: 'OTHER' },
  { label: 'US-dollar bonds (through LRS)', keywords: BOND_WORDS.concat(['lrs']), andAny: ['usd', 'us$', 'dollar', 'dollars', 'lrs'],
    unlessAny: FUND_WORDS, notIf: NOT_BOND, class: 'BOND' },
  { label: 'Rupee bonds and NCDs', keywords: BOND_WORDS, unlessAny: FUND_WORDS, notIf: NOT_BOND, class: 'BOND' },
  { label: 'Fixed deposits', keywords: ['fixed deposit', 'fixed deposits', 'fd', 'fds'], unlessAny: FUND_WORDS, class: 'OTHER' },
  { label: 'REITs and InvITs', keywords: ['reit', 'reits', 'invit', 'invits'], unlessAny: FUND_WORDS, class: 'OTHER' },
  { label: 'Unlisted shares', keywords: ['unlisted'], unlessAny: FUND_WORDS, class: 'EQUITY' },
  { label: 'P2P lending', keywords: ['p2p', 'peer to peer'], class: 'DEBT' },
];

applyPatch('LP-16b platform product names', [
  {
    label: 'REFDATA: PRODUCT_CLASS_RULES for the platform names (I-40: nameAny, andAny)',
    from: 'window.REFDATA = {"PRODUCT_CLASS_RULES":' + JSON.stringify(OLD_RULES) + ',"FUND_RANKS":',
    to: 'window.REFDATA = {"PRODUCT_CLASS_RULES":' + JSON.stringify(RULES) + ',"FUND_RANKS":',
  },
  {
    label: 'engine: a "$" in a keyword is kept, so "us$" means US$ and never the bare word US (financial review of LP-16b, 1)',
    from: String.raw`        return String(k).toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/[\s-]+/g, "[\\s-]*"); }).join("|") + ")(?![a-z0-9])", "i");
`,
    to: String.raw`        return String(k).toLowerCase().replace(/[^a-z0-9\s$-]/g, "").replace(/\$/g, "\\$").replace(/[\s-]+/g, "[\\s-]*"); }).join("|") + ")(?![a-z0-9])", "i");   /* LP-16b: "$" kept */
`,
  },
  {
    label: 'engine: the rules read nameAny and andAny',
    from: '      return { label:r.label, first:!!r.beforePmsAifSif, kw:_pcrRe(r.keywords), unless:_pcrRe(r.unlessAny), not:_pcrRe(r.notIf) }; });\n',
    to: '      return { label:r.label, first:!!r.beforePmsAifSif, kw:_pcrRe(r.keywords), unless:_pcrRe(r.unlessAny), not:_pcrRe(r.notIf),\n' +
        '               name:_pcrRe(r.nameAny), and:_pcrRe(r.andAny) }; });   /* LP-16b: name must say / product or name must say */\n',
  },
  {
    label: 'engine: nonMfClass(product, name)',
    from: '    function nonMfClass(product){\n' +
          '      var p=String(product||"");\n' +
          '      for (var i=0;i<_pcr.length;i++){ var r=_pcr[i];\n' +
          '        if (r.kw && r.kw.test(p) && !(r.unless && r.unless.test(p)) && !(r.not && r.not.test(p))) return r; }\n',
    to: '    function nonMfClass(product,name){\n' +
        '      var p=String(product||""), n=String(name||"");\n' +
        '      for (var i=0;i<_pcr.length;i++){ var r=_pcr[i];\n' +
        '        if (r.kw && r.kw.test(p) && !(r.unless && r.unless.test(p)) && !(r.not && r.not.test(p)) &&\n' +
        '            !(r.name && !r.name.test(n)) && !(r.and && !r.and.test(p) && !r.and.test(n))) return r; }   /* LP-16b */\n',
  },
  {
    label: 'engine: productClass passes the name',
    from: '      var _r=nonMfClass(h.product);\n',
    to: '      var _r=nonMfClass(h.product,h.name);\n',
  },
  {
    label: 'engine: the listed-stock test passes the name',
    from: '      h.heldShare = isDirectEquity(h); h.directEquity = h.heldShare && !nonMfClass(h.product);',
    to: '      h.heldShare = isDirectEquity(h); h.directEquity = h.heldShare && !nonMfClass(h.product,h.name);',
  },
  {
    label: 'engine: "Unlisted-Direct" is a share held directly',
    from: '    return /direct equity|^equity$|^equities$|stock|shares?|listed equity|scrip|sip/.test(p);\n',
    to: '    return /direct equity|^equity$|^equities$|stock|shares?|listed equity|scrip|sip|unlisted[\\s-]*direct|direct[\\s-]*unlisted/.test(p);   /* LP-16b: the platform\'s "Unlisted-Direct" */\n',
  },
  {
    label: 'tax: a bond named in US dollars or through the LRS has no tax row',
    from: String.raw`    if (!mfp && TAX_FOREIGN_BOND.test(p+" "+c) && /bond|ncd|debenture/.test(p+" "+c)) return N(TAX_WHY.foreignBond);
`,
    to: String.raw`    /* LP-16b: the name counts too, for USD, US$, dollar or LRS only (a "Global" company name is not a foreign route); the bond
       words are still read from the product or category only, so a fund, AIF or PMS named "... Bond ..." keeps its own row;
       a plain "Bonds" product keeps the listed bond rows below */
    if (!mfp && (TAX_FOREIGN_BOND.test(p+" "+c) || /(^|[^a-z])(lrs|usd|us\$|dollars?)([^a-z]|$)/.test(n)) && /bond|ncd|debenture/.test(p+" "+c)) return N(TAX_WHY.foreignBond);
`,
  },
  {
    label: 'tax: the product "AIF-Listed" is a Listed AIF (D-043)',
    from: String.raw`        else if(/^\s*listed\s*aif\s*$/.test(c)||(!/unlisted/.test(c)&&_same&&/^\s*listed\s*aif\s*$/.test(_lab))) _ruled=true;
`,
    to: String.raw`        else if(/^\s*listed\s*aif\s*$/.test(c)||/(^|[^a-z])(aif[\s-]*listed|listed[\s-]*aif)([^a-z]|$)/.test(p)||(!/unlisted/.test(c)&&_same&&/^\s*listed\s*aif\s*$/.test(_lab))) _ruled=true;   /* LP-16b: the platform's product "AIF-Listed" */
`,
  },
]);
