/* ============================================================================
   2026-10-27 — tax batch, part T1: classification and the TAX_RULES rows
   (CR-0008; decision D-040; Tax Reckoner TY 2026-27, law as on 19 Oct 2026).
   Edits the reference data (TAX_RULES), the engine script (07_engine.js), the
   exporters script (08_exporters.js) and the UI script (11_app_ui.js). Applies
   after 2026-10-22-legacy-batch-2a.js.

   Fixed here (TX-nn of the tax review of 24 Oct 2026 is KI-(159+nn)):
     KI-162 (TX-03)  shares held directly are tested before the international test, so a
                     listed Indian company named "International", "Global" or "Overseas" is
                     Listed Equity Shares, not Global Funds. Direct-equity product labels such
                     as Equity, Shares and Stocks count as direct equity. A foreign-listed share
                     needs a positive marker (an ISIN not starting with IN, or a product or
                     category label naming foreign, international, US or overseas equity) and
                     takes the new row "Foreign-listed shares (held directly)" (D-040 c).
     KI-163 (TX-04)  a gold or silver FoF is a Commodity Mutual Fund (24 months); only a listed
                     ETF is a Commodity ETF (12 months). The name decides first.
     KI-164 (TX-05)  international funds and FoFs go to Global Funds (24 months, slab); a new
                     row "International ETFs (listed in India)" (12 months, slab). The ETF label
                     comes from the name, never from the vendor category "...ETFs...".
     KI-165 (TX-06)  a fund-of-funds branch before every other fund test: international,
                     gold or silver, debt (Sec. 76), conservative (left unclassified), single
                     equity ETF FoF (new row "Equity ETF FoF (90/90)"), everything else the new
                     row "Fund of Funds (general rule)".
     KI-170 (TX-11)  the three obsolete hybrid rows (35% test) are replaced: balanced hybrid,
                     general rule; aggressive hybrid, equity-oriented; conservative hybrid,
                     Specified. Balanced advantage, dynamic asset allocation, equity savings,
                     multi asset and life cycle funds stay unclassified, with the reason.
     KI-172 (TX-13)  SIFs by strategy name: equity long-short and sector rotation, new row
                     "SIF (equity long-short)"; debt long-short, new row "SIF (debt long-short,
                     Specified)"; hybrid, active asset allocator and ex-top 100 unclassified.
     KI-173 (TX-14)  ELSS, new row "ELSS (3-year lock-in)" with lockMonths 36: a lot inside its
                     lock-in is neither long nor short term; it stays in the holding's CMV and
                     Gain/Loss (as not classified), and is left out of the amounts available for
                     rebalancing, the harvest pools and the harvest candidates.
     KI-174 (TX-15)  REIT and InvIT rows only for units held directly; a REIT or InvIT index
                     fund is unclassified; "Invitation Homes" is no longer an InvIT; category and
                     name are joined by a space.
     KI-178 (TX-19)  one engine-scope mutual-fund product test (the AMC tab's), used by the
                     G-Sec and bond guards and the mutual-fund branch, and by the AMC tab.
     KI-179 (TX-20)  retirement and children's funds are unclassified with the reason (taxed by
                     what they hold, or by the scheme they merge into), never equity by default.
     KI-180 (TX-21)  the debt row is "Debt Mutual Funds – Sec. 76 (old 50AA)" in TAX_RULES and
                     in taxClassify, in the same edit. A class with no TAX_RULES row now goes to
                     the unclassified list with a reason instead of staying a position with no rule.
   Also: every unclassified holding carries the reason it has no class (screen table, AI
   Analyst tax signal); the slides count them. ENGINE.taxClassify(h, REF) returns {cls, why}.

     node tools/patches/2026-10-27-tax-1-classification.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

/* ---------------- reference data: TAX_RULES ---------------- */
const SLAB_ALWAYS = '"st":{"rate":null,"label":"Slab rate","period":"Always treated as Short Term"},"lt":{"rate":null,"label":"Slab rate","period":"Always treated as Short Term"}';
const OLD_HYBRID_ROWS =
  '{"inst":"Hybrid Mutual Funds (Equity: 35%-65%)","months":24,"st":{"rate":0.2,"label":"0.2","period":"≤24"},"lt":{"rate":0.125,"label":"0.125","period":">24"}},' +
  '{"inst":"Hybrid Mutual Funds (Equity: >65%)","months":12,"st":{"rate":0.2,"label":"0.2","period":"≤12"},"lt":{"rate":0.125,"label":"0.125","period":">12"}},' +
  '{"inst":"Hybrid Mutual Funds (Debt: >65%)","months":null,"alwaysShort":true,' + SLAB_ALWAYS + '}],"DATA_DATES":';
/* Sources (Tax Reckoner TY 2026-27): hybrids Master Summary #10, #12, #13 and Hybrid Funds & FoFs
   R21, R23, R24; Equity ETF FoF Master #6 (R13); FoF general rule Master #7, #15 (R14, R23) and
   Hybrid Funds & FoFs R32, R33, R37; International ETFs Master #22 (R32); ELSS Master #4 (R11);
   SIF Master #26 (R37) and Hybrid Funds & FoFs R41, R43, R44; foreign-listed shares: no reckoner
   row, lead decision D-040 (c). */
const NEW_ROWS =
  '{"inst":"Hybrid MF (equity-oriented)","months":12,"st":{"rate":0.2,"label":"0.2","period":"≤12"},"lt":{"rate":0.125,"label":"0.125","period":">12"}},' +
  '{"inst":"Hybrid MF (general rule)","months":24,"st":{"rate":null,"label":"Slab rate","period":"≤24"},"lt":{"rate":0.125,"label":"0.125","period":">24"}},' +
  '{"inst":"Hybrid MF (Specified, Sec. 76)","months":null,"alwaysShort":true,' + SLAB_ALWAYS + '},' +
  '{"inst":"Equity ETF FoF (90/90)","months":12,"st":{"rate":0.2,"label":"0.2","period":"≤12"},"lt":{"rate":0.125,"label":"0.125","period":">12"}},' +
  '{"inst":"Fund of Funds (general rule)","months":24,"st":{"rate":null,"label":"Slab rate","period":"≤24"},"lt":{"rate":0.125,"label":"0.125","period":">24"}},' +
  '{"inst":"International ETFs (listed in India)","months":12,"st":{"rate":null,"label":"Slab rate","period":"≤12"},"lt":{"rate":0.125,"label":"0.125","period":">12"}},' +
  '{"inst":"ELSS (3-year lock-in)","months":12,"lockMonths":36,"st":{"rate":null,"label":"N/A (lock-in)","period":"Not possible"},"lt":{"rate":0.125,"label":"0.125","period":">12, after the lock-in"}},' +
  '{"inst":"SIF (equity long-short)","months":12,"st":{"rate":0.2,"label":"0.2","period":"≤12"},"lt":{"rate":0.125,"label":"0.125","period":">12"}},' +
  '{"inst":"SIF (debt long-short, Specified)","months":null,"alwaysShort":true,' + SLAB_ALWAYS + '},' +
  '{"inst":"Foreign-listed shares (held directly)","months":24,"st":{"rate":null,"label":"Slab rate","period":"≤24"},"lt":{"rate":0.125,"label":"0.125","period":">24"}}],"DATA_DATES":';

/* ---------------- engine (07): the classifier ---------------- */
const OLD_CLASS_COMMENT = [
  '  /* Base-file asset/product/category -> a row of TAX_RULES.',
  '     Category is consulted BEFORE asset: an arbitrage fund is filed as Debt for',
  '     analytics routing but is equity-oriented and taxed as an equity fund, so',
  '     keying off `asset` alone would apply Sec. 50AA to it and call every rupee',
  '     short-term. */',
  '  function taxClassOf(h){',
  ''
].join('\n');
const NEW_CLASS_HEAD = String.raw`  /* Base-file asset/product/category -> a row of TAX_RULES, per the Tax Reckoner
     TY 2026-27 (law as on 19 Oct 2026; decision D-040; CR-0008). Category is consulted
     BEFORE asset: an arbitrage fund is filed as Debt for analytics routing but is
     equity-oriented and taxed as an equity fund, so keying off the asset alone would
     apply Sec. 76 to it and call every rupee short-term.
     taxClassify(h, R) returns {cls, why}: cls is a TAX_RULES inst, or null with why, the
     reason shown for a holding left unclassified. R (optional, the reference data) is read
     only for the ISIN of a share held directly (STOCK_RET). */
  /* KI-099 / TX-19: the mutual-fund book's product test, one definition for the AMC tab and the tax classes */
  var MF_BOOK_PRODUCT=/mutual\s*funds?\b|index\s*funds?\b|\betfs?\b|fund\s*of\s*funds?|\bfofs?\b/;
  function isMFBookProduct(p){ return MF_BOOK_PRODUCT.test(String(p||"").toLowerCase()); }
  /* TX-03: product labels that mean shares held directly (isDirectEquity's labels, word-bounded) */
  var TAX_DE_PRODUCT=/direct equity|^equity$|^equities$|stock|\bshares?\b|listed equity|scrip/;
  var TAX_FOF_NAME=/\bfofs?\b|fund of funds?|\bfeeder\b/;
  /* TX-05: international schemes by name or category, measured both ways over MF_PERF and
     MF_PERF_DIRECT (27 Oct 2026). "World" alone is not used: an Indian healthcare index fund
     carries it. */
  var TAX_INTL_NAME=/global|international|\bintl\b|overseas|off-?shore|nasdaq|s&p 500|\bnyse\b|\bfang|hang seng|china|europe|\basia|\basean\b|brazil|japan|taiwan|emerging market|developed market|(^|[^a-z])u\.?s\.?([^a-z]|$)/;
  var TAX_INTL_CAT=/global|international|overseas|off-?shore/;
  /* TX-21: the Income-tax Act 2025 section (Section Map #15), old number for reference */
  var TAX_DEBT_ROW="Debt Mutual Funds – Sec. 76 (old 50AA)";
  /* why a holding is left unclassified; shown beside it on the Taxation tab */
  var TAX_WHY={
    none:"No row in the tax rules covers this product or category.",
    p2p:"No tax row is published for peer-to-peer lending.",
    debtPms:"No tax row is published for a debt PMS.",
    blend:"An equity and G-Sec index blend needs its equity share to pick a tax class.",
    hybrid:"A balanced advantage, dynamic asset allocation, equity savings, multi asset or life cycle fund is taxed by what it holds over the year. Confirm its class with the AMC's year-end tax classification.",
    solution:"A retirement or children's fund is taxed by what it holds over the year, or by the scheme it is merged into. Confirm its class with the AMC.",
    fofCons:"A conservative fund of funds is Specified only if 65% or more of it sits in debt funds, which is not known here.",
    reitFund:"A REIT or InvIT index fund is taxed by what it holds over the year. Confirm its class with the AMC's year-end tax classification.",
    sif:"A hybrid or active asset allocator SIF is taxed by what it holds over the year. Confirm its class with the AMC's year-end tax classification.",
    sifExTop:"An equity ex-top 100 long-short SIF sits close to the 65% equity floor, so its class needs the AMC's year-end tax classification.",
    sifOther:"This SIF strategy is not one the tax reckoner names, so no class is applied."
  };
  /* TX-03, D-040 (c): a share held directly is foreign-listed only on a positive marker: an
     ISIN that does not start with IN (the base row's own, or the matched STOCK_RET entry's), or
     a product or category label naming foreign, international, US or overseas equity */
  function taxForeignListed(h,p,c,R){
    if (/foreign|international|overseas|(^|[^a-z])u\.?s\.?([^a-z]|$)/.test(p+" "+c)) return true;
    var isin=String(h.isin||(h.stockRet&&h.stockRet.isin)||"").trim().toUpperCase();
    if (!isin && R && R.STOCK_RET){ var _sr=R.STOCK_RET[normCo(h.name)]; if(_sr&&_sr.isin) isin=String(_sr.isin).trim().toUpperCase(); }
    return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin) && isin.slice(0,2)!=="IN";
  }
  function taxClassOf(h,R){ return taxClassify(h,R).cls; }
  function taxClassify(h,R){
`;
const OLD_CLASS_BODY = String.raw`    var a=String(h.asset||"").toLowerCase(),
        p=String(h.product||"").toLowerCase(),
        c=String(h.category||"").toLowerCase(),
        n=String(h.name||"").toLowerCase();
    if (/arbitrage/.test(c)) return "Equity Mutual Funds";        /* equity-oriented by construction */
    if (/p2p|peer/.test(p+c)) return null;                        /* no rule published for P2P lending */
    if (/crypto|virtual digital/.test(c+n)) return "Crypto";
    if (/sovereign gold bond|\bsgb\b/.test(n)) return "Sovereign Gold Bonds";
    if (/reit/.test(c+n)) return "REIT Units";
    if (/invit/.test(c+n)) return "InvIT Units";
    if (/\bmld\b|market linked/.test(c+n)) return "MLD";
    /* KI-065: gilt / G-Sec / bond mutual funds and ETFs are debt mutual funds (Sec. 50AA), not
       directly held securities: these rows apply only when the product is not a mutual fund */
    if (!/mutual fund/.test(p) && /g-?sec|government securit/.test(c+n)) return "Government Securities / G-Secs";
    /* Product first: an AIF holding unlisted equity is still an AIF, and the
       word "unlisted" in its category would otherwise claim it. */
    if (/aif/.test(p)){
      /* Category III has its own rows; the word boundary keeps CATEGORY I and
         CATEGORY II (both present in real holding names) from matching */
      var _cat3=/cat(egory)?\.?\s*-?\s*iii\b/i.test(c+" "+n);
      if(_cat3 && /debt/.test(a)) return "Debt AIF – Cat III";
      if(_cat3) return /long[\s-]?short/i.test(c+" "+n) ? "Equity AIF – Cat III (Long Short)" : "Equity AIF – Cat III (Listed Equity)";
      return /debt/.test(a) ? "Debt AIF – Cat I/II" : "Equity AIF – Cat I/II";
    }
    if (/unlisted/.test(p+c)) return /debt/.test(a) ? "Unlisted Bonds / NCDs" : "Unlisted Equity Shares";
    if (!/mutual fund/.test(p) && /bond|ncd|debenture/.test(p+c)) return "Listed Bonds / NCDs";
    if (/pms/.test(p)) return /debt/.test(a) ? null : "Equity PMS";   /* no Debt PMS rule published */
    if (/commodit|gold|silver/.test(a+c)) return /etf/.test(c+n) ? "Commodity ETF" : "Commodity Mutual Fund";
    if (/global|international|overseas|us equity/.test(c+n)) return "Global Funds";
    if (/direct equity|equity shares/.test(p+c)) return "Listed Equity Shares";
    if (/mutual fund/.test(p)){
      if (/hybrid|balanced|asset alloc|equity savings|multi asset/.test(c)) return null;  /* needs the equity share to pick a row */
      /* KI-065: a debt fund by asset tag, by SEBI debt category, or by a G-Sec / SDL / gilt name, so a
         mis-tagged asset (e.g. "Fixed Income", or blank, which parses as Equity) does not make it equity.
         An equity : G-Sec blend named by its ratio ("… G-Sec 75:25") needs its equity share to pick a row. */
      var _gsecName=/g-?sec|government securit|\bsdl\b|\bgilt\b/.test(n), _ratio=/\b\d{2}\s*:\s*\d{2}\b/.test(n);
      if (/debt|fixed income/.test(a) || /\bdebt\b|bond|gilt|g-?sec|liquid|overnight|money market|duration|credit risk|banking\s*(and|&)\s*psu|floater|floating rate|target maturity|fixed maturity|\bfmp\b/.test(c) || (_gsecName && !_ratio)) return "Debt Mutual Funds – Sec. 50AA";
      if (_gsecName && _ratio) return null;
      return /etf|bees/.test(c+n) ? "Equity ETFs" : "Equity Mutual Funds";
    }
    return null;
  }
`;
const NEW_CLASS_BODY = String.raw`    var a=String(h.asset||"").toLowerCase(),
        p=String(h.product||"").toLowerCase(),
        c=String(h.category||"").toLowerCase(),
        n=String(h.name||"").toLowerCase(),
        cn=c+" "+n;
    var K=function(x){ return {cls:x, why:null}; }, N=function(w){ return {cls:null, why:w}; };
    /* KI-099 / TX-19: "ETF", "Index Funds", "FoFs" are mutual-fund products too. A blank product
       (only in a direct call: parseBaseRows reads a blank one as Mutual Funds) counts as a fund
       for the fund-of-funds, REIT and international tests. */
    var mfp=MF_BOOK_PRODUCT.test(p), fundish=mfp||!p.trim();
    /* TX-13: a SIF, by its strategy NAME only (one vendor category covers equity and hybrid
       strategies). Reckoner Master Summary #26; Hybrid Funds & FoFs R41-R46. Same SIF test
       as productClass. */
    if (/sif/.test(p)){
      if (/hybrid|active asset alloc/.test(n)) return N(TAX_WHY.sif);
      if (/ex[\s-]?top[\s-]?100/.test(n)) return N(TAX_WHY.sifExTop);
      if (/\bdebt\b/.test(n)) return K("SIF (debt long-short, Specified)");
      if (/sector rotation|equity long[\s-]?short/.test(n)) return K("SIF (equity long-short)");
      return N(TAX_WHY.sifOther);
    }
    /* TX-06: a fund of funds, before every other fund test. Only a 90/90 equity ETF FoF is
       equity-oriented, a debt FoF is Specified, and every other FoF follows the general rule
       (Master Summary #6, #7, #15, #18, #20, #21; Hybrid Funds & FoFs R31-R37). The vendor's
       mixed category "Solution Oriented,ETFs,FOFs" is not an FoF category. */
    var fofCat=/\b(fund of funds?|fofs?)\b/.test(c) && !/solution|\betfs?\b/.test(c);
    if (fundish && (TAX_FOF_NAME.test(n) || fofCat)){
      if (TAX_INTL_NAME.test(n) || TAX_INTL_CAT.test(c)) return K("Global Funds");
      if (/\bgold\b|\bsilver\b|commodit/.test(n) || /commodit|gold|silver/.test(a+" "+c)) return K("Commodity Mutual Fund");
      if (/bharat bond|g-?sec|gilt|\bsdl\b|liquid|overnight|money market|\bdebt\b|corporate bond|banking.*psu/.test(n)) return K(TAX_DEBT_ROW);
      if (/conservative/.test(n)) return N(TAX_WHY.fofCons);
      if (/\b(etf|bees)s?\s*(fofs?|fund of funds?)\b/.test(n)) return K("Equity ETF FoF (90/90)");
      return K("Fund of Funds (general rule)");
    }
    if (/arbitrage/.test(c)) return K("Equity Mutual Funds");        /* equity-oriented by construction */
    if (/p2p|peer/.test(p+c)) return N(TAX_WHY.p2p);                 /* no rule published for P2P lending */
    if (/crypto|virtual digital/.test(c+n)) return K("Crypto");
    if (/sovereign gold bond|\bsgb\b/.test(n)) return K("Sovereign Gold Bonds");
    /* TX-15: the REIT and InvIT rows are for units held directly. A REIT or InvIT index fund
       is a fund taxed by what it holds (REITs do not count toward the 65% equity test, Hybrid
       Funds & FoFs R6), so it is left unclassified, never guessed. Category and name are
       joined by a space; only the trailing word boundary is kept (CUBEINVIT, TVSINVIT). */
    if (/reits?\b|invits?\b/.test(cn)){
      if (fundish && (/index\s*funds?|\betfs?\b/.test(n) || (mfp && !/mutual\s*funds?/.test(p))))
        return (TAX_INTL_NAME.test(n) || TAX_INTL_CAT.test(c)) ? K("Global Funds") : N(TAX_WHY.reitFund);
      return K(/reits?\b/.test(cn) ? "REIT Units" : "InvIT Units");
    }
    if (/\bmld\b|market linked/.test(c+n)) return K("MLD");
    /* KI-065, KI-099: gilt / G-Sec / bond mutual funds, ETFs and FoFs are debt mutual funds, not
       directly held securities: these rows apply only when the product is not a fund */
    if (!mfp && /g-?sec|government securit/.test(c+n)) return K("Government Securities / G-Secs");
    /* Product first: an AIF holding unlisted equity is still an AIF, and the
       word "unlisted" in its category would otherwise claim it. */
    if (/aif/.test(p)){
      /* Category III has its own rows; the word boundary keeps CATEGORY I and
         CATEGORY II (both present in real holding names) from matching */
      var _cat3=/cat(egory)?\.?\s*-?\s*iii\b/i.test(c+" "+n);
      if(_cat3 && /debt/.test(a)) return K("Debt AIF – Cat III");
      if(_cat3) return K(/long[\s-]?short/i.test(c+" "+n) ? "Equity AIF – Cat III (Long Short)" : "Equity AIF – Cat III (Listed Equity)");
      return K(/debt/.test(a) ? "Debt AIF – Cat I/II" : "Equity AIF – Cat I/II");
    }
    if (/unlisted/.test(p+c)) return K(/debt/.test(a) ? "Unlisted Bonds / NCDs" : "Unlisted Equity Shares");
    if (!mfp && /bond|ncd|debenture/.test(p+c)) return K("Listed Bonds / NCDs");
    if (/pms/.test(p)) return /debt/.test(a) ? N(TAX_WHY.debtPms) : K("Equity PMS");
    /* TX-04: a gold or silver FoF is unlisted, 24 months (Mutual Funds R31); only a listed ETF
       takes 12 months (R30). The name decides; the category only when the name says neither. */
    if (/commodit|gold|silver/.test(a+c)){
      if (TAX_FOF_NAME.test(n)) return K("Commodity Mutual Fund");
      if (/etf|bees/.test(n)) return K("Commodity ETF");
      return K((/etf/.test(c) && !TAX_FOF_NAME.test(c)) ? "Commodity ETF" : "Commodity Mutual Fund");
    }
    /* TX-03: shares held directly before the international test, so a listed Indian company
       named "International" or "Global" is not a fund; foreign-listed only on a positive marker */
    if (TAX_DE_PRODUCT.test(p) || /direct equity|equity shares/.test(c))
      return K(taxForeignListed(h,p,c,R) ? "Foreign-listed shares (held directly)" : "Listed Equity Shares");
    /* TX-05: international funds (24 months) and international ETFs listed in India (12 months),
       both short term at slab (Master Summary #21, #22). The ETF label comes from the name. */
    if (fundish ? (TAX_INTL_NAME.test(n) || TAX_INTL_CAT.test(c)) : /global|international|overseas|us equity/.test(c+n))
      return K(/etf|bees|exchange traded/.test(n) ? "International ETFs (listed in India)" : "Global Funds");
    if (mfp){
      /* TX-20: retirement and children's funds are taxed by what they hold, or by the scheme
         they merge into (Hybrid Funds & FoFs R27); never equity by default */
      if (/retire|child|bal bhavishya/.test(n) || /solution oriented\s*-?\s*(child|retire)/.test(c)) return N(TAX_WHY.solution);
      /* TX-11: hybrid funds by SEBI category (Hybrid Funds & FoFs R19-R27): a balanced hybrid is
         always the general rule, an aggressive hybrid equity-oriented, a conservative hybrid
         Specified; the others depend on the year's holdings */
      if (/balanced\s*hybrid/.test(cn)) return K("Hybrid MF (general rule)");
      if (/aggressive\s*hybrid/.test(cn)) return K("Hybrid MF (equity-oriented)");
      if (/conservative\s*hybrid/.test(cn)) return K("Hybrid MF (Specified, Sec. 76)");
      if (/hybrid|balanced|asset alloc|equity savings|multi[\s-]?asset|life\s*cycle/.test(c) ||
          /balanced advantage|asset allocation|equity savings|multi[\s-]?asset|life\s*cycle/.test(n)) return N(TAX_WHY.hybrid);
      /* KI-065: a debt fund by asset tag, by SEBI debt category, or by a G-Sec / SDL / gilt name, so a
         mis-tagged asset (e.g. "Fixed Income", or blank, which parses as Equity) does not make it equity.
         An equity : G-Sec blend named by its ratio ("… G-Sec 75:25") needs its equity share to pick a row. */
      var _gsecName=/g-?sec|government securit|\bsdl\b|\bgilt\b/.test(n), _ratio=/\b\d{2}\s*:\s*\d{2}\b/.test(n);
      if (/debt|fixed income/.test(a) || /\bdebt\b|bond|gilt|g-?sec|liquid|overnight|money market|duration|credit risk|banking\s*(and|&)\s*psu|floater|floating rate|target maturity|fixed maturity|\bfmp\b/.test(c) || (_gsecName && !_ratio)) return K(TAX_DEBT_ROW);
      if (_gsecName && _ratio) return N(TAX_WHY.blend);
      /* TX-14: ELSS, each instalment locked in for 3 years (Master Summary #4) */
      if (/\belss\b|equity\s*linked\s*savings|tax\s*saver/.test(cn)) return K("ELSS (3-year lock-in)");
      return K(/etf|bees|exchange traded/.test(n) ? "Equity ETFs" : "Equity Mutual Funds");
    }
    return N(TAX_WHY.none);
  }
`;

applyPatch('Tax batch T1: classification and the TAX_RULES rows (CR-0008)', [
  /* ---------------- reference data ---------------- */
  {
    label: 'TAX_RULES: the debt row cites Sec. 76 of the Income-tax Act 2025 (TX-21)',
    from: '{"inst":"Debt Mutual Funds – Sec. 50AA","months":null,"alwaysShort":true,',
    to: '{"inst":"Debt Mutual Funds – Sec. 76 (old 50AA)","months":null,"alwaysShort":true,'
  },
  {
    label: 'TAX_RULES: three hybrid rows replaced; new FoF, international ETF, ELSS, SIF and foreign-share rows',
    from: OLD_HYBRID_ROWS,
    to: NEW_ROWS
  },

  /* ---------------- engine (07) ---------------- */
  {
    label: 'engine: classifier head (constants, reasons, foreign-share marker, taxClassOf -> taxClassify)',
    from: OLD_CLASS_COMMENT,
    to: NEW_CLASS_HEAD
  },
  {
    label: 'engine: taxClassify body (TX-03, 04, 05, 06, 11, 13, 14, 15, 19, 20, 21)',
    from: OLD_CLASS_BODY,
    to: NEW_CLASS_BODY
  },
  {
    label: 'engine: the ELSS lock-in test, after taxBucket',
    from: '  function computeTaxation(rows, REF, asOn){\n',
    to: String.raw`  /* calendar months after a date, clamped to the month end, as a UTC day number (ms) */
  function taxAnniv(d,months){
    var y=d.getUTCFullYear(), m=d.getUTCMonth()+months, day=d.getUTCDate();
    var last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
    return Date.UTC(y,m,Math.min(day,last));
  }
  /* TX-14: an ELSS lot is locked up to and including the anniversary of its purchase,
     lockMonths later (3 years); it can be sold from the next day (D-040, for the owner to confirm) */
  function taxLocked(rule,buy,asOn){
    if(!rule||!rule.lockMonths||!(buy instanceof Date)||!(asOn instanceof Date)||isNaN(buy)||isNaN(asOn)) return false;
    return Date.UTC(asOn.getUTCFullYear(),asOn.getUTCMonth(),asOn.getUTCDate())<=taxAnniv(buy,rule.lockMonths);
  }

  function computeTaxation(rows, REF, asOn){
`
  },
  {
    label: 'computeTaxation: classify with the reason',
    from: '      var cls=taxClassOf(h), rule=cls?byName[cls]:null;\n',
    to: '      var _tc=taxClassify(h,REF), cls=_tc.cls, rule=cls?byName[cls]:null;\n'
  },
  {
    label: 'computeTaxation: an unclassified holding carries its reason; a class with no row is unclassified (KI-180)',
    from: '      if(!cls){ out.unmapped.push(rec); return; }\n',
    to: String.raw`      /* the reason a holding has no class goes with it; a class with no TAX_RULES row is
         reported the same way, never kept as a position with no rule (KI-180) */
      if(!cls||!rule){ rec.reason=cls?("No row in the tax rules covers the class \u201c"+cls+"\u201d."):(_tc.why||""); out.unmapped.push(rec); return; }
`
  },
  {
    label: 'computeTaxation: an ELSS lot inside its lock-in is LOCKED, neither long nor short term',
    from: [
      '      var ltU=0, stU=0, unknown=0, oldest=null, newest=null, buckets=[];',
      '      L.forEach(function(x){',
      '        var u=x.u*scale, mons=taxMonthsBetween(x.d,asOn), b=taxBucket(rule,mons);',
      ''
    ].join('\n'),
    to: [
      '      var ltU=0, stU=0, unknown=0, lockU=0, oldest=null, newest=null, buckets=[];',
      '      L.forEach(function(x){',
      '        var u=x.u*scale, mons=taxMonthsBetween(x.d,asOn), b=taxBucket(rule,mons);',
      '        /* TX-14: an ELSS lot inside its lock-in cannot be sold: neither long nor short term */',
      '        if(b && taxLocked(rule,x.d,asOn)) b="LOCKED";',
      ''
    ].join('\n')
  },
  {
    label: 'computeTaxation: locked units counted inside the unknown part',
    from: '        if(b==="LTCG"){ ltU+=u; } else if(b==="STCG"){ stU+=u; } else { unknown+=u; }\n',
    to: '        if(b==="LTCG"){ ltU+=u; } else if(b==="STCG"){ stU+=u; } else { unknown+=u; if(b==="LOCKED") lockU+=u; }\n'
  },
  {
    label: 'computeTaxation: locked gain, and the locked part of an ELSS holding on its record',
    from: [
      '      var ltG=null, stG=null, unkG=null;',
      '      if(costScale!=null){',
      '        ltG=0; stG=0; unkG=0;',
      '        buckets.forEach(function(x){',
      '          var gain=x.u*per - x.costRaw*costScale;',
      '          if(x.b==="LTCG") ltG+=gain; else if(x.b==="STCG") stG+=gain; else unkG+=gain;',
      '        });',
      '      }',
      '      rec.ltUnits=ltU; rec.stUnits=stU; rec.unknownUnits=unknown;',
      '      rec.ltCmv=ltU*per; rec.stCmv=stU*per; rec.unknownCmv=unknown*per;',
      '      rec.ltGain=ltG; rec.stGain=stG; rec.unknownGain=unkG;',
      ''
    ].join('\n'),
    to: [
      '      var ltG=null, stG=null, unkG=null, lockG=null;',
      '      if(costScale!=null){',
      '        ltG=0; stG=0; unkG=0; lockG=0;',
      '        buckets.forEach(function(x){',
      '          var gain=x.u*per - x.costRaw*costScale;',
      '          if(x.b==="LTCG") ltG+=gain; else if(x.b==="STCG") stG+=gain; else { unkG+=gain; if(x.b==="LOCKED") lockG+=gain; }',
      '        });',
      '      }',
      '      rec.ltUnits=ltU; rec.stUnits=stU; rec.unknownUnits=unknown;',
      '      rec.ltCmv=ltU*per; rec.stCmv=stU*per; rec.unknownCmv=unknown*per;',
      '      rec.ltGain=ltG; rec.stGain=stG; rec.unknownGain=unkG;',
      '      /* TX-14: the part of an ELSS holding inside its lock-in (a part of the unknown amounts above) */',
      '      if(rule.lockMonths){ rec.lockedUnits=lockU; rec.lockedCmv=lockU*per; rec.lockedGain=lockG; }',
      ''
    ].join('\n')
  },
  {
    label: 'summarise: locked ELSS totals',
    from: '      var t={cmv:0,gl:0,glMissing:0,ltcgCmv:0,stcgCmv:0,unclassCmv:0,ltcgGain:0,stcgGain:0,unclassGain:0};\n',
    to: '      var t={cmv:0,gl:0,glMissing:0,ltcgCmv:0,stcgCmv:0,unclassCmv:0,ltcgGain:0,stcgGain:0,unclassGain:0,lockedCmv:0,lockedGain:0,lockedN:0};\n'
  },
  {
    label: 'summarise: add each holding\'s locked part (already inside unclassified)',
    from: '        t.ltcgCmv+=(r.ltCmv||0); t.stcgCmv+=(r.stCmv||0); t.unclassCmv+=(r.unknownCmv||0);\n',
    to: '        t.ltcgCmv+=(r.ltCmv||0); t.stcgCmv+=(r.stCmv||0); t.unclassCmv+=(r.unknownCmv||0);\n' +
        '        if(r.lockedCmv>0){ t.lockedCmv+=r.lockedCmv; t.lockedN++; if(r.lockedGain!=null) t.lockedGain+=r.lockedGain; }   /* TX-14 */\n'
  },
  {
    label: 'AMC tab: the mutual-fund book test is the engine-scope one (KI-099)',
    from: '    function _isMFbook(p){ p=String(p||"").toLowerCase(); return /mutual\\s*funds?\\b|index\\s*funds?\\b|\\betfs?\\b|fund\\s*of\\s*funds?|\\bfofs?\\b/.test(p); }\n',
    to: '    function _isMFbook(p){ return isMFBookProduct(p); }   /* KI-099: one engine-scope test, shared with taxClassify */\n'
  },
  {
    label: 'AI Analyst tax signal: locked ELSS part accumulated',
    from: '    var acc = { ltCmv: 0, stCmv: 0, ltGain: null, stGain: null, cls: "", n: 0 };\n',
    to: '    var acc = { ltCmv: 0, stCmv: 0, ltGain: null, stGain: null, cls: "", n: 0, lockCmv: 0 };\n'
  },
  {
    label: 'AI Analyst tax signal: add each position\'s locked part',
    from: '      acc.ltCmv += (p.ltCmv || 0); acc.stCmv += (p.stCmv || 0);\n',
    to: '      acc.ltCmv += (p.ltCmv || 0); acc.stCmv += (p.stCmv || 0); acc.lockCmv += (p.lockedCmv || 0);\n'
  },
  {
    label: 'AI Analyst tax signal: an unclassified holding says why, not "could not be reconciled"',
    from: [
      '    if (!acc.n) return aiaSig("tax", "Tax", "na", ev,',
      '      "This holding could not be reconciled to a lot history, so its long- and short-term split is not known.");',
      ''
    ].join('\n'),
    to: [
      '    if (!acc.n){',
      '      /* a holding with no tax class is not an unreconciled one: give its reason (KI-172, KI-179) */',
      '      var um = (T.unmapped || []).filter(function(r){ return names[r.name]; })[0];',
      '      if (um) return aiaSig("tax", "Tax", "na", ev,',
      '        "No tax class is applied to this holding, so its long- and short-term split is not shown." + (um.reason ? " " + um.reason : ""));',
      '      return aiaSig("tax", "Tax", "na", ev,',
      '        "This holding could not be reconciled to a lot history, so its long- and short-term split is not known.");',
      '    }',
      ''
    ].join('\n')
  },
  {
    label: 'AI Analyst tax signal: the long-term share counts the locked ELSS part, which cannot be sold',
    from: '    var total = (pos.ltCmv || 0) + (pos.stCmv || 0);\n',
    to: '    var total = (pos.ltCmv || 0) + (pos.stCmv || 0) + (pos.lockCmv || 0);   /* TX-14: locked ELSS units cannot fund a sale */\n'
  },
  {
    label: 'AI Analyst tax signal: name the locked ELSS part',
    from: [
      '    if (ev.stGain != null && (pos.stCmv || 0) > 0)',
      '      bits.push("selling the short-term portion would crystallise ₹" + ev.stGain.toFixed(2) + " Cr at short-term rates");',
      ''
    ].join('\n'),
    to: [
      '    if (ev.stGain != null && (pos.stCmv || 0) > 0)',
      '      bits.push("selling the short-term portion would crystallise ₹" + ev.stGain.toFixed(2) + " Cr at short-term rates");',
      '    if ((pos.lockCmv || 0) > 1e-12){ ev.lockedCmv = aiaR2(pos.lockCmv);',
      '      bits.push("₹" + ev.lockedCmv.toFixed(2) + " Cr is ELSS still inside its lock-in and cannot be sold yet"); }',
      ''
    ].join('\n')
  },
  {
    label: 'engine API: taxClassify',
    from: '    computeTaxation:computeTaxation, taxClassOf:taxClassOf, xirr:xirr,\n',
    to: '    computeTaxation:computeTaxation, taxClassOf:taxClassOf, taxClassify:taxClassify, xirr:xirr,\n'
  },

  /* ---------------- exporters (08): taxation slides ---------------- */
  {
    label: 'tax slides: "Long term after" text helper (ELSS lock-in)',
    from: String.raw`      var rt=function(o){ return (!o)?'\u2014':(o.rate!=null?(o.rate*100).toFixed(o.rate*100%1?2:0)+'%':(o.label||'\u2014')); };
`,
    to: String.raw`      var rt=function(o){ return (!o)?'\u2014':(o.rate!=null?(o.rate*100).toFixed(o.rate*100%1?2:0)+'%':(o.label||'\u2014')); };
      /* "Long term after" for a TAX_RULES row; the ELSS row adds its lock-in (TX-14) */
      var lta=function(r){ if(!r) return '\u2014'; if(r.alwaysShort) return 'Always short term'; if(r.anyPeriod) return 'Any period';
        return '> '+r.months+' months'+(r.lockMonths?(' ('+(r.lockMonths%12?r.lockMonths+'-mo':(r.lockMonths/12)+'-yr')+' lock-in)'):''); };
`
  },
  {
    label: 'tax class slide: "Long term after" cell from the helper',
    from: String.raw`          cell(g.rule?(g.rule.alwaysShort?'Always short term':(g.rule.anyPeriod?'Any period':'> '+g.rule.months+' months')):'\u2014',{align:'center'}),
`,
    to: String.raw`          cell(lta(g.rule),{align:'center'}),
`
  },
  {
    label: 'tax class slide footnote: unclassified holdings and locked ELSS units',
    from: String.raw`        (T.unreconciled.length?(' '+T.unreconciled.length+' holding(s) could not be reconciled to the base file and are unclassified.'):''));
`,
    to: String.raw`        (T.unreconciled.length?(' '+T.unreconciled.length+' holding(s) could not be reconciled to the base file and are unclassified.'):'')+
        (T.unmapped.length?(' '+T.unmapped.length+' holding(s) have no tax class and are unclassified.'):'')+
        (t.lockedCmv>1e-12?(' ELSS units still in lock-in ('+U.m(t.lockedCmv)+') are unclassified and not harvested.'):''));
`
  },
  {
    label: 'tax totals slide footnote: what "Unclassified" holds',
    from: [
      "          'Both roll-ups cover the same holdings, so each sums to the grand total. Unclassified is Gain/Loss on holdings that could not be '+",
      "          'reconciled to a lot history, carried at the total but not split.'+",
      ''
    ].join('\n'),
    to: [
      "          'Both roll-ups cover the same holdings, so each sums to the grand total. Unclassified is Gain/Loss not split into long and short term '+",
      "          '(no reconciled lot history, no tax class, or ELSS units in lock-in), carried at the total.'+",
      ''
    ].join('\n')
  },
  {
    label: 'tax holding-detail slide footnote: locked ELSS units are in neither column',
    from: String.raw`            (T.unreconciled.length?(' '+T.unreconciled.length+' holding(s) with no lot history are unclassified and are not listed here.'):''));
`,
    to: String.raw`            (T.unreconciled.length?(' '+T.unreconciled.length+' holding(s) with no lot history are unclassified and are not listed here.'):'')+
            (t.lockedCmv>1e-12?' ELSS units in lock-in are in neither \u201cAmt. avail.\u201d column.':''));
`
  },

  /* ---------------- UI (11): Taxation tab ---------------- */
  {
    label: 'Taxation tab: "Long term after" text helper (ELSS lock-in)',
    from: "  function taxRate(o){ if(!o) return '—'; return o.rate!=null ? (o.rate*100).toFixed(o.rate*100%1?2:0)+'%' : taxEsc(o.label||'—'); }\n",
    to: "  function taxRate(o){ if(!o) return '—'; return o.rate!=null ? (o.rate*100).toFixed(o.rate*100%1?2:0)+'%' : taxEsc(o.label||'—'); }\n" +
        "  /* \"Long term after\" for a TAX_RULES row; the ELSS row adds its lock-in (TX-14) */\n" +
        "  function taxLtAfter(r){\n" +
        "    if(!r) return '—';\n" +
        "    if(r.alwaysShort) return 'Always short term';\n" +
        "    if(r.anyPeriod) return 'Any period';\n" +
        "    return '&gt; '+r.months+' months'+(r.lockMonths?('; '+(r.lockMonths%12?r.lockMonths+'-month':(r.lockMonths/12)+'-year')+' lock-in per instalment'):'');\n" +
        "  }\n"
  },
  {
    label: 'Taxation tab: class table "Long term after" from the helper',
    from: "        '<td>'+(g.rule?(g.rule.alwaysShort?'Always short term':(g.rule.anyPeriod?'Any period':'&gt; '+g.rule.months+' months')):'—')+'</td>'+\n",
    to: "        '<td>'+taxLtAfter(g.rule)+'</td>'+\n"
  },
  {
    label: 'Taxation tab: the Total Gain/Loss tile names the locked ELSS part',
    from: "'</div><div class=\"l\">Total Gain/Loss &middot; not classified '+gm(t.unclassGain)+(t.glMissing?' &middot; '+t.glMissing+' without invested value':'')+'</div></div>'+",
    to: "'</div><div class=\"l\">Total Gain/Loss &middot; not classified '+gm(t.unclassGain)+(t.lockedCmv>1e-12?' (of which ELSS in lock-in '+gm(t.lockedGain)+')':'')+(t.glMissing?' &middot; '+t.glMissing+' without invested value':'')+'</div></div>'+"
  },
  {
    label: 'Taxation tab: unclassified holdings listed with the reason for each',
    from: [
      "    if(T.unmapped.length){",
      "      warn+='<div class=\"taxwarn\"><b>'+T.unmapped.length+' holding'+(T.unmapped.length===1?'':'s')+' '+(T.unmapped.length===1?'has':'have')+' no published rule in the tax-rules file.</b> '+",
      "        'Add a row for the product to classify '+(T.unmapped.length===1?'it':'them')+'.'+",
      "        '<table class=\"taxt\" style=\"margin-top:8px;\"><thead><tr><th>Holding</th><th>Product</th><th>Category</th><th class=\"n\">CMV ('+taxEsc(cap)+')</th><th class=\"n\">G/L</th></tr></thead><tbody>'+",
      "        T.unmapped.map(function(r){ return '<tr><td>'+taxEsc(r.name)+'<span class=\"taxsub\">'+taxEsc(r.client)+'</span></td><td>'+taxEsc(r.product)+'</td><td>'+taxEsc(r.category)+'</td><td class=\"n\">'+U.m(r.cmv)+'</td><td class=\"n\"'+gcol(r.gl)+'>'+gm(r.gl)+'</td></tr>'; }).join('')+",
      "        '</tbody></table></div>';",
      "    }",
      ''
    ].join('\n'),
    to: [
      "    if(T.unmapped.length){",
      "      /* each holding with no tax class says why (CR-0008): no published row, or a fund taxed by what it holds over the year */",
      "      warn+='<div class=\"taxwarn\"><b>'+T.unmapped.length+' holding'+(T.unmapped.length===1?' is':'s are')+' not placed in a tax class.</b> '+",
      "        'The reason is given for each. '+(T.unmapped.length===1?'Its':'Their')+' CMV and Gain/Loss stay in the totals as not classified and are left out of tax harvesting.'+",
      "        '<table class=\"taxt\" style=\"margin-top:8px;\"><thead><tr><th>Holding</th><th>Product</th><th>Category</th><th class=\"n\">CMV ('+taxEsc(cap)+')</th><th class=\"n\">G/L</th><th>Why</th></tr></thead><tbody>'+",
      "        T.unmapped.map(function(r){ return '<tr><td>'+taxEsc(r.name)+'<span class=\"taxsub\">'+taxEsc(r.client)+'</span></td><td>'+taxEsc(r.product)+'</td><td>'+taxEsc(r.category)+'</td><td class=\"n\">'+U.m(r.cmv)+'</td><td class=\"n\"'+gcol(r.gl)+'>'+gm(r.gl)+'</td><td style=\"font-size:10.5px;\">'+taxEsc(r.reason||'')+'</td></tr>'; }).join('')+",
      "        '</tbody></table></div>';",
      "    }",
      ''
    ].join('\n')
  },
  {
    label: 'Taxation tab: ELSS lock-in note and usual-bucket note',
    from: "    var H=T.harvest||null, harvestHtml='';\n",
    to: [
      "    /* TX-14: ELSS units still inside their lock-in, rendered only when there are some */",
      "    var lockNote='';",
      "    if(t.lockedCmv>1e-12){",
      "      var _lk=T.positions.filter(function(r){ return r.lockedCmv>1e-12; }), _lm=(_lk[0]&&_lk[0].rule&&_lk[0].rule.lockMonths)||36;",
      "      lockNote='<div class=\"taxnote\">ELSS units are locked in for '+(_lm%12?_lm+' months':(_lm/12)+' years')+' from each instalment&rsquo;s own purchase date and cannot be sold before then. '+",
      "        U.m(t.lockedCmv)+' of CMV in '+_lk.length+' holding'+(_lk.length===1?'':'s')+' (Gain/Loss '+gm(t.lockedGain)+') is still inside its lock-in. '+",
      "        'It is left out of the long- and short-term columns, the amounts available for rebalancing and tax harvesting, and is counted as not classified. '+",
      "        'A lot is treated as locked up to and including the anniversary of its purchase.</div>';",
      "    }",
      "    /* classes taken from the reckoner's usual bucket for the scheme type (CR-0008) */",
      "    var _ub=T.byClass.filter(function(g){ return /^Equity ETF FoF|^SIF \\(/.test(g.cls); }).map(function(g){ return g.cls; });",
      "    var bucketNote=_ub.length?('<div class=\"taxnote\">'+taxEsc(_ub.join(', '))+': the class is the tax reckoner&rsquo;s usual bucket for the scheme. '+",
      "      'An equity ETF fund of funds is equity-oriented only if 90% or more of it sits in one ETF that holds 90% or more listed Indian equity; a SIF is classed by its strategy. '+",
      "      'The status is tested again every year, so confirm it with the AMC&rsquo;s year-end tax classification.</div>'):'';",
      "    var H=T.harvest||null, harvestHtml='';",
      ''
    ].join('\n')
  },
  {
    label: 'Taxation tab: the two notes rendered after the switch-in note',
    from: "      kpi+\n      swNote+\n      rollups+\n",
    to: "      kpi+\n      swNote+\n      lockNote+bucketNote+\n      rollups+\n"
  }
]);
