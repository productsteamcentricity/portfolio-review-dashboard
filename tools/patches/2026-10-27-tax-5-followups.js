/* ============================================================================
   2026-10-27 — tax batch, part T5: follow-ups to parts T1 to T4
   (CR-0008; decision D-040; Tax Reckoner TY 2026-27, law as on 19 Oct 2026).
   Edits the engine script (07_engine.js), the exporters script (08_exporters.js), the
   parsers script (09_parsers.js, item 11) and the UI script (11_app_ui.js). TAX_RULES is
   unchanged. Applies after 2026-10-27-tax-4-review.js.

   1. The usual-bucket default, dated (TR-7 and LD-11 of the new build's design,
      docs/new-build/capital-gains-upload.md §10.5, §10.5a). Aggressive hybrid, arbitrage and
      equity savings funds are equity-oriented as the reckoner's usual bucket (Master Summary
      #8 to #10, rows 16 to 18, column P; Hybrid Funds & FoFs D19 to D21) only when the tax
      reference date (taxRefDate, D-040 a) is on or after 1 Apr 2026: aggressive hybrid and
      equity savings take "Hybrid MF (equity-oriented)", arbitrage "Equity Mutual Funds", each
      marked usualBucket and labelled "usual bucket per the tax reckoner; confirm with the
      fund house". Before 1 Apr 2026 they are unclassified, with a reason saying the AMC's
      classification for that year is needed. Part T1 classed aggressive hybrid and arbitrage
      always and left equity savings unclassified always. A mutual fund whose name says
      arbitrage is read as an arbitrage fund when no earlier test claims it (a fund-of-funds name,
      a global category, a gold asset, a non-fund product, or a balanced, aggressive or
      conservative hybrid or equity savings category does), as the hybrid tests already read the
      name; so a fund with a blank category, or filed as Debt or Liquid, is one (part T1 read
      arbitrage from the category only, so such a fund filed as Debt was Specified). Balanced advantage, dynamic asset
      allocation, multi asset, life cycle, retirement and children's funds stay unclassified in
      both periods. taxClassify(h, R, refDate) and taxClassOf(h, R, refDate) take the date as a
      third, optional argument; computeTaxation passes its asOn, so every reader of
      model.taxation (the tab, the slides, the AI Analyst tax signal) sees one class per holding.
      A call without a date applies the TY 2026-27 rules, the usual bucket included (equity savings
      funds, never classed before, are now).
   2. The Sec 198 exemption line shows "-Rs 0.00" no more: an amount that rounds to zero shows
      0 without a minus sign (tab and harvest slide); so do the "Loss set off" cells of the
      pool table (a pool's, and the tab's total when no loss is set off).
   3. The unreconciled table's heading on the Taxation tab says why, by reason: merged folios
      with blank units (fix batch 4, KI-140), no purchase still held, fewer or more units than
      the base file (more units with a sale or transfer out that carries no price is its own
      reason), invested value. Each record carries the reason's kind (unrec). The two
      unit and value reasons lose their dash and say which way the units differ; the
      holding-detail slide no longer says such holdings have "no lot history".
   4. An AIF whose category is stated nowhere (no Category I, II or III in its category, name or
      product, nor in the performance entry it matched, and not called a Listed AIF) is still
      Category I or II, pass-through (part T3), marked catAssumed: the tab, the class slide (in full) and
      the harvest slide (in its "Left out" line) say it is treated as Category I or II because the file does
      not state Category I, II or III, and to confirm it against the AIF's statement. The AI Analyst signal
      carries the same sentence; no page or slide shows it today, because AIFs are listed under "Not assessed"
      (CR-0008). The holding-detail and totals slides carry no such mark.
   5. Wording part T3 left stale: the holding-detail slide no longer says PMS and unlisted AIF
      show a dash in the unit columns, and the tab and the class slide no longer say LTCG +
      STCG add back to every holding's Gain/Loss.
      The class slide's footnote, which the sentences of items 1, 4 and 10 can take past two lines,
      grows upward from its third line instead of running into the black band (KI-109).
   6. The harvest slide's "Left out" line gives the count and the CMV, as the tab does.
   7. The harvest assumption inputs are text fields that accept Indian and international digit
      grouping ("1,25,000", "125,000", "1 25 000"), a leading rupee sign, Rs, Rs. or INR (with or without
      the dot), a trailing "/-", "/=", INR or Rs (and "%" in the slab-rate field) and an exponent; an entry that is
      not a number once those marks are removed (blank, text, a zero-width space, a number too large to hold)
      restores the default, and the field says nothing when it does. A number field reads such entries
      differently in different browsers; an entry of "1,25,000" that restored the default without a word was
      reported, and the cause is UNKNOWN. A text field reads the same everywhere.
   8. A comment only: the foreign-share marker reads the ISIN of the matched STOCK_RET entry; the base
      file's own ISIN column is not read by parseBaseRows (KI-184, open, not fixed here; D-040 c corrected).
   9. The harvest defaults the engine exports (ENGINE.taxDefaults, part T3) are frozen: only taxAssumeFor reads
      them, and an exported key cannot be taken back later (ARC-01, C3 of its review of the contract).
  10. An AIF called a "Listed AIF" (by the file's category, or by the category of the AIF_PERF entry the
      holding matched; 11 of the 12 funds of AIF_PERF on 30 Sep 2026) is Category III, fund level, marked catRuled
      (CR-0008 question 17, answered 2 Nov 2026; D-043): the tab, the class slide and the harvest slide (in
      its "Left out" line) say it is treated as Category III because it is called a Listed AIF, and to
      confirm the category against the AIF's statement (the AI Analyst signal says it too; see item 4).
      What an AIF's own words state wins: Category I, II or III in its category, name or product is read as
      stated; when its own words state none, so is the category of the performance entry it matched
      ("AIF (CAT III) - Listed Equity" is Category III), but only when the holding's name is the entry's own
      once normalised: the name matcher is loose, so a sibling series is not told its category by it. A
      "Listed AIF" label from a looser match still gives Category III, with the note, unless the AIF's own
      category says unlisted. The category is read once, in taxClassify, so items 4 and 10 cannot disagree.
  11. A date-time written with an explicit zone in the IRR sheet ("2023-04-01T20:00:00Z", "...+05:30") is read as the day
      it states, the same in every zone; part T2 read the machine-local day of the instant, which is another day in some
      zones (parsers script, irrParseDate; ARC-01, C2 of its review of the contract; KI-186). Only ISO-like
      date-times are read as written, and only after Date has accepted the text (an impossible month, hour or
      offset is dropped, as before); text such as an RFC 2822 string ("Sat, 01 Apr 2023 20:00:00 GMT"), an
      hour-only offset, a zone word, a bare Z and the ISO year and year-month still go through Date and stay the
      machine-local day of the instant (KI-186). A Z time is its UTC day: an Indian local midnight written in
      UTC ("2026-03-31T18:30:00.000Z") reads as 31 Mar, as it does on main; part T2 read 1 Apr on an Indian machine.

   Corrections from the independent review of this part (8 reviewers, 3 skeptics on each MEDIUM; the ids are
   the reviewers' own and are traced in CR-0008 and in the review addendum):
      R2-F1, R3-F1   one reader for an AIF's category, in taxClassify (items 4 and 10)
      R2-F2          the usual-bucket note names a scheme held by several clients once
      R2-F4          the 65% test is said to be an average over the tax year; the unstated-AIF row label says
                     "Category I, II or III not stated in the file"
      R1-F4, R3-F2, R8-F6   the header says what the code does (arbitrage by name; which slides carry the AIF
                     sentence; a call with no date includes the usual bucket)
      R3-F3          the pass-through note: "Pass-through means that income ..."
      R3-F6          assumedCmv and ruledCmv give the CMV of the AIFs named apart in the "Left out" lines
      R4-1, R4-2     the harvest inputs read a leading rupee sign, Rs, Rs. or INR, a trailing "/-" and an exponent;
                     a trailing "%" is stripped in the slab-rate field only
      (own, at the 17:36 rebuild)  item 11 is used only after Date has accepted the text, so the accepted set is the
                     parent's and an impossible date-time is still dropped
      R5-F1          a sale or transfer out that carries no price has its own unreconciled reason (noPxSell)
      R5-F2          the AI Analyst comment says an unreconciled holding gets the general sentence
      R5-F4, R7-F1, R8-F3   holding-detail footnote: shorter sentences, "1 unreconciled holding is ..."
      R6-1, R7-F2    the class footnote drops to 7 pt, then 6.5 pt, and always ends at the band's edge (7.18 in)
      R7-F8          a record with no unreconciled kind still gets a sentence in the tab heading
      R8-F2          "the tax reckoner" everywhere, never "the owner's reckoner" (the AI Analyst slide is in the
                     client deck)
      tests only (no edit here): R6-2 wide table; R7-F3 Crore zero-minus; R7-F4 AI Analyst, unreconciled only;
                     R7-F6 null-safe pos(); R7-F7 counts read from the data; R7-F8 "and N more"; R8-F5 a parsed
                     base row carries no isin (KI-184)
      not changed, with the reason in the review addendum: R1-F1 R1-F2 R1-F5 R2-F3 R3-F5 R4-3 R4-4 R4-5 R5-F3
                     R5-F5 R5-F6 R6-3 R7-F5 R7-F9 (docs or known issues KI-200 to KI-206); R8-F1 (PD-50)

   Corrections from the delta review of the corrections above (6 reviewers, D1 to D6; ids are the reviewers' own):
      D1-F1, D6-2    the matched entry's Category I, II or III is a statement about the fund only when the names are the
                     same once normalised
      D6-1           the header and the comment say which tests claim an arbitrage name first
      D6-3           the Category III row (Listed Equity or Long Short) is picked from the category and the name, as
                     before; the entry's own wording picks it only for a category the entry stated
      D6-4           the holding-detail comment says the footnote may need a third line (pre-existing)
      D1-F2          "category" and its number may be separated by square or curly brackets, a slash, an underscore, a
                     hash or a comma, as well as spaces, dots, colons, round brackets and dashes
      D1-F3          an own category that says unlisted blocks the Listed AIF label of the matched entry
      D3-F1          a sale that states no amount is not what is missing; the sentence names a switch out
      D3-F3, D3-F4   "INR." with a dot is INR; a trailing "/=", INR or Rs is read
      D3-F5, D4-F3, D5-F6   the class slide and the harvest slide count holdings in the singular and the plural
      D5-F1, D5-F2, D5-F5, D3-F2, D4-F4   header, labels and comments say what the code does; no claim about a Chromium browser
      D5-F3          the AIF notes say "the file does not state Category I, II or III"
      tests only: D1-F5 D2-F4 D3-F6 D5-F4 (mutants killed, more forms and zones, the sample book's Listed AIF found by what it is)
      not changed, with the reason in CR-0008 and KNOWN_ISSUES: D1-F4 (the AI Analyst sentences for AIFs are not shown),
                     D2-F1 D2-F2 D2-F3 D2-F5 (KI-186), D2-F6 (TESTING), D3-F4 (no hint beside a rejected entry), D4-F1 and
                     D4-F2 (a 6 pt step for the class footnote was built and taken out: it set the footnote at 6 pt in the
                     common 14-class book too, because the page's estimate of the table counts every flagged row as wrapped;
                     in a rare book (14 classes, 4 rows counted as wrapping, every optional sentence) the 6.5 pt footnote's
                     first line starts 0.12 in above that estimate, and nobody has rendered such a deck: KI-210)

   Additions after ARC-01's pre-review of the stages (2 Nov 2026, evening):
      PD-50          the comment above the tax signal says what tax does to the composite (it is not "never a reason to
                     act": an amber verdict lowers the composite and can move a trim, a target weight, an action label
                     and the plan summary); no behaviour changes
      footnote       the comment above the class footnote's fit says what the page's estimate of the table does not
                     tell: the first line of a 6.5 pt footnote starts 0.12 in above the estimate in a book of 14 classes,
                     4 rows counted as wrapping and every optional sentence, and nobody has rendered such a deck
                     (KI-210); the comment said 0.04 in; no behaviour changes
      tools/check-invariants.js   ENGINE_KEYS is checked both ways: an export that the list does not name fails
                     (KI-185; the list had missed six names for that reason); new test KI-185-engine-keys.js
      tests only     item 11: a known-answer test from the text through parseIRR into the XIRR and into the tax-lot
                     day (hand-computed, eight zones), ten more forms of the date pattern, and the 24:00 form pinned as built
                     item 10: every character of the separator class, in the fund's own words and in the performance
                     entry's text, singly and twice in a row; the word boundary before "cat"; the number words; texts that
                     are not read; a sibling of the Long Short entry; "Category II/III" and "AIF-III" pinned as built
                     the class footnote: the 8, 7 and 6.5 pt sizes, each in a book of its own, with the bottom anchor, the
                     number of lines and the clearance from the table; the plural sentence for AIFs treated as Cat I/II

   Wording after the owner's answer to CR-0008 question 18 (stage S9, 2 Nov 2026; KI-182, D-043; the owner kept no set-off for crypto):
      the Taxation tab's harvest card says crypto is kept out of set-off "as the owner has ruled and the reckoner is silent
      on them" and the harvest slide "as the tax reckoner is silent on them (confirm with the tax adviser)", no longer
      "pending" a ruling; the comments beside them say so; no figure moves. The TAX_RULES row still carries the older
      noSetOffSource text ("until the owner rules"); no page shows it, and it is data (KI-182).

     node tools/patches/2026-10-27-tax-5-followups.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

/* the wording is for the client too (the AI Analyst slide is in the client deck): "the tax reckoner", never "the owner's" */
const USUAL = "usual bucket per the tax reckoner; confirm with the fund house";
const USUAL_HTML = 'usual bucket per the tax reckoner; confirm with the fund house';

applyPatch('2026-10-27 tax batch T5: follow-ups (usual bucket by date, AIF category, IRR dates with a zone, wording, inputs; CR-0008, D-040, D-043)', [

  /* ======================= engine (07) ======================= */
  {
    label: 'engine: the classifier header names the reference date and the three marks (T5)',
    from: '     taxClassify(h, R) returns {cls, why}: cls is a TAX_RULES inst, or null with why, the\n' +
          '     reason shown for a holding left unclassified. R (optional, the reference data) is read\n' +
          '     only for the ISIN of a share held directly (STOCK_RET). */\n',
    to: '     taxClassify(h, R, refDate) returns {cls, why}: cls is a TAX_RULES inst, or null with why,\n' +
        '     the reason shown for a holding left unclassified. R (optional, the reference data) is read\n' +
        '     for the ISIN of a share held directly (STOCK_RET) and for the category of the AIF_PERF entry an\n' +
        '     AIF matched. refDate (optional; tax batch T5) is\n' +
        '     the tax reference date (taxRefDate, D-040 a): from 1 Apr 2026 aggressive hybrid, arbitrage\n' +
        '     and equity savings funds take the reckoner\'s usual bucket, marked usual:true; before it they\n' +
        '     are unclassified (TR-7, LD-11). With no date the TY 2026-27 rules apply. An AIF\'s category is\n' +
        '     read once (T5 items 4 and 10): what its own words state wins, then the category of the entry it\n' +
        '     matched; a "Listed AIF" is Category III, marked catRuled:true; none at all is Category I or II,\n' +
        '     marked catAssumed:true. */\n'
  },
  {
    label: 'engine: the hybrid reason no longer names equity savings (T5)',
    from: '    hybrid:"A balanced advantage, dynamic asset allocation, equity savings, multi asset or life cycle fund is taxed by what it holds over the year. Confirm its class with the AMC\'s year-end tax classification.",\n',
    to: '    hybrid:"A balanced advantage, dynamic asset allocation, multi asset or life cycle fund is taxed by what it holds over the year. Confirm its class with the AMC\'s year-end tax classification.",\n'
  },
  {
    label: 'engine: the reason before 1 Apr 2026, and the date the usual bucket applies from (T5)',
    from: '    sifOther:"This SIF strategy is not one the tax reckoner names, so no class is applied."\n  };\n',
    to: '    sifOther:"This SIF strategy is not one the tax reckoner names, so no class is applied.",\n' +
        '    usualBefore:"An aggressive hybrid, arbitrage or equity savings fund is taxed by what it held over the tax year. The usual bucket per the tax reckoner applies from 1 Apr 2026; holding periods here run to an earlier date, so the AMC\'s tax classification for that year is needed."\n' +
        '  };\n' +
        '  /* T5 (TR-7, LD-11): the reckoner\'s usual bucket for aggressive hybrid, arbitrage and equity savings funds is\n' +
        '     the default from tax year 2026-27 (Master Summary #8 to #10, column P; Hybrid Funds & FoFs D19 to D21) */\n' +
        '  var TAX_USUAL_FROM=Date.UTC(2026,3,1);\n'
  },
  {
    label: 'engine: taxClassify and taxClassOf take the reference date; the dated usual bucket (T5)',
    from: '  function taxClassOf(h,R){ return taxClassify(h,R).cls; }\n' +
          '  function taxClassify(h,R){\n' +
          '    var a=String(h.asset||"").toLowerCase(),\n' +
          '        p=String(h.product||"").toLowerCase(),\n' +
          '        c=String(h.category||"").toLowerCase(),\n' +
          '        n=String(h.name||"").toLowerCase(),\n' +
          '        cn=c+" "+n;\n' +
          '    var K=function(x){ return {cls:x, why:null}; }, N=function(w){ return {cls:null, why:w}; };\n',
    to: '  function taxClassOf(h,R,refDate){ return taxClassify(h,R,refDate).cls; }\n' +
        '  function taxClassify(h,R,refDate){\n' +
        '    var a=String(h.asset||"").toLowerCase(),\n' +
        '        p=String(h.product||"").toLowerCase(),\n' +
        '        c=String(h.category||"").toLowerCase(),\n' +
        '        n=String(h.name||"").toLowerCase(),\n' +
        '        cn=c+" "+n;\n' +
        '    var K=function(x){ return {cls:x, why:null}; }, N=function(w){ return {cls:null, why:w}; };\n' +
        '    /* T5 (TR-7, LD-11): the usual bucket, equity-oriented from 1 Apr 2026 and marked so; no default before. The\n' +
        '       date is a calendar day (UTC midnight, as taxRefDate gives it); with none, the TY 2026-27 rules apply. */\n' +
        '    var _rd=(refDate instanceof Date&&!isNaN(refDate))?taxDayNum(refDate):null;\n' +
        '    var UB=function(x){ return (_rd==null||_rd>=TAX_USUAL_FROM)?{cls:x, why:null, usual:true}:N(TAX_WHY.usualBefore); };\n'
  },
  {
    label: 'engine: arbitrage takes the dated usual bucket (T5)',
    from: '    if (/arbitrage/.test(c)) return K("Equity Mutual Funds");        /* equity-oriented by construction */\n',
    to: '    if (/arbitrage/.test(c)) return UB("Equity Mutual Funds");       /* T5: the usual bucket, from 1 Apr 2026 (Master Summary #8) */\n'
  },
  {
    label: 'engine: the foreign-share marker comment says the base file\'s ISIN column is not read (T5, KI-184)',
    from: '     ISIN that does not start with IN (the base row\'s own, or the matched STOCK_RET entry\'s), or\n',
    to: '     ISIN that does not start with IN (the matched STOCK_RET entry\'s; a row\'s own isin is read when it has one,\n' +
        '     but parseBaseRows does not read the base file\'s ISIN column, KI-184, open), or\n'
  },
  {
    label: 'engine: an AIF\'s category is read once; a Listed AIF is Category III, none at all is Category I or II, each marked (T5 items 4 and 10)',
    from: '      var _cat3=/cat(egory)?\\.?\\s*-?\\s*iii\\b/i.test(c+" "+n);\n' +
          '      if(_cat3 && /debt/.test(a)) return K("Debt AIF – Cat III");\n' +
          '      if(_cat3) return K(/long[\\s-]?short/i.test(c+" "+n) ? "Equity AIF – Cat III (Long Short)" : "Equity AIF – Cat III (Listed Equity)");\n' +
          '      return K(/debt/.test(a) ? "Debt AIF – Cat I/II" : "Equity AIF – Cat I/II");\n',
    to: '      /* T5 items 4 and 10 (CR-0008 question 17). What an AIF\'s own words state is read once, from its category, name and product:\n' +
        '         cat or category at a word start, any run of spaces, dots, colons, brackets and dashes, then III, II, I, three, two, one,\n' +
        '         3, 2 or 1; Category III is tested first. When its own words state none, what the performance data says of the fund the\n' +
        '         holding matched counts as a statement ("AIF (CAT III) - Listed Equity" is Category III). "Listed AIF", the holding\'s\n' +
        '         own category or the data\'s, is Category III too (the answer of 2 Nov 2026) and is marked catRuled. With nothing at all,\n' +
        '         Category I or II is assumed and marked catAssumed. */\n' +
        '      var _ct=c+" "+n+" "+p, _lab="", _ruled=false,\n' +
        '          _cat3=/\\bcat(egory)?[\\s.:()\\[\\]{}\\/_#,\\-\\u2010-\\u2015\\u2212]*(iii|three|3)\\b/.test(_ct),\n' +
        '          _st12=!_cat3&&/\\bcat(egory)?[\\s.:()\\[\\]{}\\/_#,\\-\\u2010-\\u2015\\u2212]*(ii|two|i|one|2|1)\\b/.test(_ct);\n' +
        '      if(!_cat3&&!_st12){\n' +
        '        _lab=(h.perfSrc==="AIF"&&R&&R.AIF_PERF&&R.AIF_PERF[h.perfKey])?String(R.AIF_PERF[h.perfKey].category||"").toLowerCase():"";\n' +
        '        /* the loose name matcher can map a sibling series, or another fund of the house, to an entry: the entry\'s Category I, II or III is read as\n' +
        '           a statement about this fund only when the two names are the same once normalised (the matcher\'s exact branch); a "Listed AIF" label\n' +
        '           from a looser match still gives Category III, with the note that asks for the statement. An own category that says unlisted blocks it. */\n' +
        '        var _same=!!_lab&&normalize(h.name).join(" ")===normalize(h.perfKey).join(" ");\n' +
        '        if(_same&&/\\bcat(egory)?[\\s.:()\\[\\]{}\\/_#,\\-\\u2010-\\u2015\\u2212]*(iii|three|3)\\b/.test(_lab)) _cat3=true;\n' +
        '        else if(_same&&/\\bcat(egory)?[\\s.:()\\[\\]{}\\/_#,\\-\\u2010-\\u2015\\u2212]*(ii|two|i|one|2|1)\\b/.test(_lab)) _st12=true;\n' +
        '        else if(/^\\s*listed\\s*aif\\s*$/.test(c)||(!/unlisted/.test(c)&&/^\\s*listed\\s*aif\\s*$/.test(_lab))) _ruled=true;\n' +
        '      }\n' +
        '      if(_cat3||_ruled){\n' +
        '        /* the row is picked from the category and the name, as before; the entry\'s own wording picks it only for a category the entry stated */\n' +
        '        var _r3=K(/debt/.test(a) ? "Debt AIF – Cat III" : (/long[\\s-]?short/.test(c+" "+n+(_same?" "+_lab:"")) ? "Equity AIF – Cat III (Long Short)" : "Equity AIF – Cat III (Listed Equity)"));\n' +
        '        if(_ruled) _r3.catRuled=true;\n' +
        '        return _r3;\n' +
        '      }\n' +
        '      var _r12=K(/debt/.test(a) ? "Debt AIF – Cat I/II" : "Equity AIF – Cat I/II");\n' +
        '      if(!_st12) _r12.catAssumed=true;\n' +
        '      return _r12;\n'
  },
  {
    label: 'engine: aggressive hybrid and equity savings take the dated usual bucket (T5)',
    from: '      /* TX-11: hybrid funds by SEBI category (Hybrid Funds & FoFs R19-R27): a balanced hybrid is\n' +
          '         always the general rule, an aggressive hybrid equity-oriented, a conservative hybrid\n' +
          '         Specified; the others depend on the year\'s holdings */\n' +
          '      if (/balanced\\s*hybrid/.test(cn)) return K("Hybrid MF (general rule)");\n' +
          '      if (/aggressive\\s*hybrid/.test(cn)) return K("Hybrid MF (equity-oriented)");\n' +
          '      if (/conservative\\s*hybrid/.test(cn)) return K("Hybrid MF (Specified, Sec. 76)");\n',
    to: '      /* TX-11: hybrid funds by SEBI category (Hybrid Funds & FoFs R19-R27): a balanced hybrid is\n' +
        '         always the general rule, a conservative hybrid Specified; an aggressive hybrid or an equity\n' +
        '         savings fund is equity-oriented as the usual bucket from 1 Apr 2026 (T5, TR-7, LD-11;\n' +
        '         Master Summary #9, #10; D20, D21); the others depend on the year\'s holdings */\n' +
        '      if (/balanced\\s*hybrid/.test(cn)) return K("Hybrid MF (general rule)");\n' +
        '      if (/aggressive\\s*hybrid/.test(cn)) return UB("Hybrid MF (equity-oriented)");\n' +
        '      if (/conservative\\s*hybrid/.test(cn)) return K("Hybrid MF (Specified, Sec. 76)");\n' +
        '      if (/equity\\s*savings/.test(cn)) return UB("Hybrid MF (equity-oriented)");\n' +
        '      /* T5: an arbitrage fund by its name, as the hybrid tests read the name, before the debt test (an arbitrage fund is\n' +
        '         often filed as Debt for analytics routing); a hybrid, global, gold or fund-of-funds fund, or a non-fund product, is claimed earlier */\n' +
        '      if (/arbitrage/.test(n)) return UB("Equity Mutual Funds");\n'
  },
  {
    label: 'engine: computeTaxation classes each holding on its reference date (T5)',
    from: '      var _tc=taxClassify(h,REF), cls=_tc.cls, rule=cls?byName[cls]:null;\n',
    to: '      var _tc=taxClassify(h,REF,asOn), cls=_tc.cls, rule=cls?byName[cls]:null;   /* T5: one date, so one class per holding in the review */\n'
  },
  {
    label: 'engine: the record carries the usual-bucket, assumed-category and ruled-category marks (T5)',
    from: '               pxGap:pxGap||undefined, viaSwitchIn:(pxGap&&swIn[_k])||undefined};\n',
    to: '               pxGap:pxGap||undefined, viaSwitchIn:(pxGap&&swIn[_k])||undefined,\n' +
        '               usualBucket:_tc.usual||undefined, catAssumed:_tc.catAssumed||undefined, catRuled:_tc.catRuled||undefined};   /* T5 */\n'
  },
  {
    label: 'engine: an unreconciled holding carries its reason\'s kind: blank merged units (T5)',
    from: '      if(h.unitsGap){ rec.reason="Units are blank:',
    to: '      if(h.unitsGap){ rec.unrec="unitsGap"; rec.reason="Units are blank:'
  },
  {
    label: 'engine: an unreconciled holding carries its reason\'s kind: no lots (T5)',
    from: '      if(!L.length){ rec.reason=pxGap?("No purchase transactions in the IRR history. "+',
    to: '      if(!L.length){ rec.unrec="noLots"; rec.reason=pxGap?("No purchase transactions in the IRR history. "+'
  },
  {
    label: 'engine: a drift says which way the units differ, without a dash; its kind is recorded (T5)',
    from: '        rec.reason=pxGap\n' +
          '          ? ("Invested value does not reconcile to the base file. "+\n' +
          '             (swIn[_k]?"The switch-in":"A purchase")+" for this holding carries no price, so it was matched on invested value rather than units, and that does not reconcile either.")\n' +
          '          : (amtMode\n' +
          '            ? "Invested value does not reconcile to the base file — the transaction history is incomplete for this holding"\n' +
          '            : "Units do not reconcile to the base file — the transaction history is missing a corporate action (bonus/split) or a purchase");\n',
    to: '        /* T5: the kind of reason, for the heading of the tab\'s unreconciled table. When the history gives more units and a sale or\n' +
        '           transfer out in it carries no price, that sale never reached the unit ledger: the reason says so (review R5-F1) */\n' +
        '        rec.unrec=amtMode?"value":(fifoU<baseU?"short":(noPxSell[_k]?"noPxSell":"excess"));\n' +
        '        rec.reason=pxGap\n' +
        '          ? ("Invested value does not reconcile to the base file. "+\n' +
        '             (swIn[_k]?"The switch-in":"A purchase")+" for this holding carries no price, so it was matched on invested value rather than units, and that does not reconcile either.")\n' +
        '          : (amtMode\n' +
        '            ? "Invested value does not reconcile to the base file: the transaction history is incomplete for this holding."\n' +
        '            : (fifoU<baseU\n' +
        '              ? "Units do not reconcile to the base file: the transaction history gives fewer units, so it is missing an event, such as a bonus or split, or a purchase made elsewhere."\n' +
        '              : (noPxSell[_k]\n' +
        '                ? "Units do not reconcile to the base file: the transaction history gives more units, and a sale, switch out or transfer out in it carries no price, so the units it sold could not be counted."\n' +
        '                : "Units do not reconcile to the base file: the transaction history gives more units, so it is missing an event, such as a sale, a transfer out or a consolidation of units.")));\n'
  },
  {
    label: 'engine: a holding with a sale or transfer out that carries no price is noted (T5, review R5-F1)',
    from: '    var noPxBuy={}, swIn={};\n',
    to: '    var noPxBuy={}, swIn={}, noPxSell={};   /* T5 (review R5-F1): holdings with a sale or transfer out that carried no price */\n'
  },
  {
    label: 'engine: a sale or transfer out with no price is recorded when it skips the unit ledger (T5, review R5-F1)',
    from: '        if(isBuy){ noPxBuy[k]=true; if(/switch[- ]?in/i.test(t.ttype||"")) swIn[k]=true; }\n',
    to: '        if(isBuy){ noPxBuy[k]=true; if(/switch[- ]?in/i.test(t.ttype||"")) swIn[k]=true; }\n' +
        '        else if(amt>1e-9) noPxSell[k]=true;   /* T5 (review R5-F1): a sale with an amount that reached the rupee ledger only */\n'
  },
  {
    label: 'engine: the summariser counts the AIFs whose category is assumed or ruled (T5)',
    from: '             notSplit:{fundLevel:{n:0,cmv:0,gl:0},passThrough:{n:0,cmv:0,gl:0},pms:{n:0,cmv:0,gl:0}}};\n',
    to: '             notSplit:{fundLevel:{n:0,cmv:0,gl:0,ruledN:0,ruledCmv:0},passThrough:{n:0,cmv:0,gl:0,assumedN:0,assumedCmv:0},pms:{n:0,cmv:0,gl:0}}};\n'
  },
  {
    label: 'engine: the summariser counts the AIFs whose category is assumed or ruled, per holding (T5)',
    from: '          var ns=t.notSplit[r.notSplit]; if(ns){ ns.n++; ns.cmv+=r.cmv; if(r.gl!=null) ns.gl+=r.gl; }\n',
    to: '          var ns=t.notSplit[r.notSplit]; if(ns){ ns.n++; ns.cmv+=r.cmv; if(r.gl!=null) ns.gl+=r.gl;\n' +
        '            if(r.catAssumed){ ns.assumedN=(ns.assumedN||0)+1; ns.assumedCmv=(ns.assumedCmv||0)+r.cmv; }\n' +
        '            if(r.catRuled){ ns.ruledN=(ns.ruledN||0)+1; ns.ruledCmv=(ns.ruledCmv||0)+r.cmv; } }   /* T5 */\n'
  },
  {
    label: 'AI Analyst: a review whose holdings are all unclassified or unreconciled still gets a sentence for each (T5)',
    from: '    if (!T || !T.hasData || !T.positions || !T.positions.length)\n' +
          '      return aiaSig("tax", "Tax", "na", ev,\n' +
          '        "No IRR transaction history is loaded, so the long- and short-term split of this holding is not known.");\n',
    to: '    /* T5: a review whose holdings are all unclassified or unreconciled (valued before 1 Apr 2026, a book of aggressive\n' +
        '       hybrid, arbitrage and equity savings funds is one) has a history: an unclassified holding gets its own reason below,\n' +
        '       an unreconciled one the general sentence */\n' +
        '    if (!T || !T.hasData || !T.positions || !(T.positions.length || (T.unmapped || []).length || (T.unreconciled || []).length))\n' +
        '      return aiaSig("tax", "Tax", "na", ev,\n' +
        '        "No IRR transaction history is loaded, so the long- and short-term split of this holding is not known.");\n'
  },
  {
    label: 'AI Analyst: the tax signal collects the marks (T5)',
    from: '    var acc = { ltCmv: 0, stCmv: 0, ltGain: null, stGain: null, cls: "", n: 0, lockCmv: 0, gf: 0, nsN: 0, ns: "" };\n',
    to: '    var acc = { ltCmv: 0, stCmv: 0, ltGain: null, stGain: null, cls: "", n: 0, lockCmv: 0, gf: 0, nsN: 0, ns: "", usual: false, catAs: false, catRu: false };\n'
  },
  {
    label: 'AI Analyst: the tax signal reads the marks from the records (T5)',
    from: '      if (p.notSplit && !p.splitPart){ acc.nsN++; acc.ns = p.notSplit; }   /* TX-07, TX-10, TX-12 */\n',
    to: '      if (p.notSplit && !p.splitPart){ acc.nsN++; acc.ns = p.notSplit; }   /* TX-07, TX-10, TX-12 */\n' +
        '      if (p.usualBucket) acc.usual = true; if (p.catAssumed) acc.catAs = true; if (p.catRuled) acc.catRu = true;   /* T5 */\n'
  },
  {
    label: 'AI Analyst: an AIF whose category is assumed or ruled says so and asks for the statement (T5)',
    from: '      return aiaSig("tax", "Tax", "na", ev, ({\n',
    to: '      /* T5 (CR-0008 question 17): an AIF whose category the file does not state, or that is called a Listed AIF */\n' +
        '      return aiaSig("tax", "Tax", "na", ev, ((acc.catAs && acc.ns === "passThrough") ? "The file does not state Category I, II or III for this AIF, so it is treated as Category I or II; confirm the category against the AIF\'s statement. "\n' +
        '        : ((acc.catRu && acc.ns === "fundLevel") ? "This AIF is called a Listed AIF, so it is treated as Category III; confirm the category against the AIF\'s statement. " : "")) + (({\n'
  },
  {
    label: 'AI Analyst: the comment above the tax signal says what tax does to the composite (T5, PD-50, ARC-01 review)',
    from: '     Tax is a SIZING AND SEQUENCING input, never a reason to act: it modifies\n' +
          '     how much and when, not whether. It therefore never scores red.\n',
    to: '     Tax is meant as a SIZING AND SEQUENCING input, not a reason to act on its\n' +
        '     own. It never scores red. Its weight (7) is part of the composite, though,\n' +
        '     so an amber verdict (mostly short-term lots) lowers the composite and can\n' +
        '     change a trim, a target weight and, at the margin, an action label (Exit,\n' +
        '     Partial, Retain) and the plan summary; a holding with no tax class is not\n' +
        '     assessed on tax at all. Tax batch T5 dates the class of an aggressive\n' +
        '     hybrid, arbitrage or equity savings fund (CR-0008 question 21, PD-50), so\n' +
        '     for those funds the review date can move the same things.\n'
  },
  {
    label: 'AI Analyst: the not-split reasons close the added bracket (T5)',
    from: '      })[acc.ns] || "This holding is not split into long and short term.");\n',
    to: '      })[acc.ns] || "This holding is not split into long and short term."));\n'
  },
  {
    label: 'AI Analyst: a usual-bucket class is labelled (T5)',
    from: '      bits.push("lots bought before 1 Feb 2018 are measured on actual cost, without the 31 Jan 2018 grandfathered cost, so the long-term gain and tax may be overstated"); }\n',
    to: '      bits.push("lots bought before 1 Feb 2018 are measured on actual cost, without the 31 Jan 2018 grandfathered cost, so the long-term gain and tax may be overstated"); }\n' +
        '    /* T5 (TR-7, LD-11): an aggressive hybrid, arbitrage or equity savings fund classed by the reckoner\'s usual bucket */\n' +
        '    if (acc.usual){ ev.usualBucket = true; bits.push("its tax class is the ' + USUAL + '"); }\n'
  },

  /* ======================= UI (11): the Taxation tab ======================= */
  {
    label: 'Taxation tab: helpers for the marks and for an amount taken off (T5)',
    from: '  function taxNsSub(r){ return (r&&r.notSplit===\'pms\')?\'<span class="taxsub">Gain/Loss on capital contributed: not a capital-gains figure</span>\':\'\'; }\n',
    to: '  function taxNsSub(r){ return (r&&r.notSplit===\'pms\')?\'<span class="taxsub">Gain/Loss on capital contributed: not a capital-gains figure</span>\':\'\'; }\n' +
        '  /* T5: a class taken from the reckoner\'s usual bucket (TR-7, LD-11), an AIF whose category the file does not state, or one called a Listed AIF */\n' +
        '  function taxT5Sub(r){ return (r&&r.usualBucket)?\'<span class="taxsub">' + USUAL_HTML + '</span>\'\n' +
        '    :((r&&r.catAssumed)?\'<span class="taxsub">Category I, II or III not stated in the file: treated as Category I or II</span>\'\n' +
        '    :((r&&r.catRuled)?\'<span class="taxsub">called a Listed AIF: treated as Category III</span>\':\'\')); }\n' +
        '  /* T5: an amount taken off; one that rounds to zero shows 0, never "-0" */\n' +
        '  function taxNegM(U,v){ var s=U.m(v); return (v>0&&/[1-9]/.test(s))?(\'-\'+s):U.m(0); }\n'
  },
  {
    label: 'Taxation tab: the class detail rows show the three marks (T5)',
    from: "        return '<tr><td>'+taxEsc(r.name)+'<span class=\"taxsub\">'+taxEsc(r.category||r.product)+'</span>'+taxNsSub(r)+'</td>'+\n",
    to: "        return '<tr><td>'+taxEsc(r.name)+'<span class=\"taxsub\">'+taxEsc(r.category||r.product)+'</span>'+taxNsSub(r)+taxT5Sub(r)+'</td>'+\n"
  },
  {
    label: 'Taxation tab: the By Holding rows show the three marks (T5)',
    from: "      return '<tr><td>'+taxEsc(r.name)+'<span class=\"taxsub\">'+taxEsc(r.cls)+'</span>'+taxNsSub(r)+'</td>'+\n",
    to: "      return '<tr><td>'+taxEsc(r.name)+'<span class=\"taxsub\">'+taxEsc(r.cls)+'</span>'+taxNsSub(r)+taxT5Sub(r)+'</td>'+\n"
  },
  {
    label: 'Taxation tab: the unreconciled heading says why, by reason, with no dash (T5)',
    from: "      warn+='<div class=\"taxwarn\"><b>'+T.unreconciled.length+' holding'+(T.unreconciled.length===1?'':'s')+' could not be reconciled to the base file and '+\n" +
          "        (T.unreconciled.length===1?'is':'are')+' left unclassified.</b> FIFO over the transaction history does not reproduce the unit balance, which means the history is missing an event &mdash; '+\n" +
          "        'a bonus or split, or a purchase made elsewhere. No split is shown rather than one computed on lots known to be incomplete.'+\n",
    to: "      /* T5: one sentence per kind of reason: blank merged units (KI-140), no purchase still held, fewer or more units\n" +
        "         than the base file (more, with a sale that carries no price, has its own), invested value */\n" +
        "      var _uk={}; T.unreconciled.forEach(function(r){ var k=r.unrec||'other'; _uk[k]=(_uk[k]||0)+1; });\n" +
        "      var _uh=function(n,one,many){ return n+' '+(n===1?one:many); }, _us=[];\n" +
        "      if(_uk.unitsGap) _us.push(_uh(_uk.unitsGap,'holding merges folios of which at least one has no units in the base file, so its units','holdings merge folios of which at least one has no units in the base file, so their units')+' cannot be checked against the transaction history.');\n" +
        "      if(_uk.noLots) _us.push(_uh(_uk.noLots,'holding has','holdings have')+' no purchase in the IRR sheet that is still held, so there are no lots to split.');\n" +
        "      if(_uk.short) _us.push('For '+_uh(_uk.short,'holding','holdings')+' the transaction history gives fewer units than the base file, so it is missing an event: a bonus or split, or a purchase made elsewhere.');\n" +
        "      if(_uk.excess) _us.push('For '+_uh(_uk.excess,'holding','holdings')+' the transaction history gives more units than the base file, so it is missing an event: a sale, a transfer out or a consolidation of units.');\n" +
        "      if(_uk.noPxSell) _us.push('For '+_uh(_uk.noPxSell,'holding','holdings')+' the transaction history gives more units than the base file, and a sale, switch out or transfer out in it carries no price, so the units it sold could not be counted.');\n" +
        "      if(_uk.value) _us.push('For '+_uh(_uk.value,'holding','holdings')+' matched on invested value, the transaction history does not add up to the base file&rsquo;s invested value.');\n" +
        "      if(_uk.other) _us.push('For '+_uh(_uk.other,'holding','holdings')+' the transaction history does not reconcile to the base file.');   /* a record with no kind is still explained */\n" +
        "      warn+='<div class=\"taxwarn\"><b>'+T.unreconciled.length+' holding'+(T.unreconciled.length===1?'':'s')+' could not be reconciled to the base file and '+\n" +
        "        (T.unreconciled.length===1?'is':'are')+' left unclassified.</b> '+_us.join(' ')+(_us.length?' ':'')+\n" +
        "        'No split is shown rather than one computed on lots that cannot be checked; the reason for each holding is in the table.'+\n"
  },
  {
    label: 'Taxation tab: a note on the usual-bucket classes (T5)',
    from: "      'The status is tested again every year, so confirm it with the AMC&rsquo;s year-end tax classification.</div>'):'';\n",
    to: "      'The status is tested again every year, so confirm it with the AMC&rsquo;s year-end tax classification.</div>'):'';\n" +
        "    /* T5 (TR-7, LD-11; reckoner Master Summary #8 to #10, Hybrid Funds & FoFs D19 to D21): aggressive hybrid,\n" +
        "       arbitrage and equity savings funds classed by the usual bucket, from 1 Apr 2026 */\n" +
        "    var _ubH=T.positions.filter(function(r){ return r.usualBucket&&!r.splitPart; }), _ubN=[];\n" +
        "    _ubH.forEach(function(r){ if(_ubN.indexOf(r.name)<0) _ubN.push(r.name); });   /* a scheme held by several clients is named once */\n" +
        "    var usualNote=_ubH.length?('<div class=\"taxnote\">'+_ubH.length+' holding'+(_ubH.length===1?' is an aggressive hybrid, arbitrage or equity savings fund':'s are aggressive hybrid, arbitrage or equity savings funds')+' ('+\n" +
        "      taxEsc(_ubN.slice(0,5).join('; '))+(_ubN.length>5?' and '+(_ubN.length-5)+' more':'')+'), classed as equity-oriented: " + USUAL_HTML + ". '+\n" +
        "      'Such a fund is equity-oriented only while 65% or more of it is in listed Indian equity on average over the tax year, hedged arbitrage positions included, so the AMC&rsquo;s year-end tax classification is the check.</div>'):'';\n"
  },
  {
    label: 'Taxation tab: the usual-bucket note is rendered with the other class notes (T5)',
    from: '      lockNote+bucketNote+\n',
    to: '      lockNote+bucketNote+usualNote+\n'
  },
  {
    label: 'Taxation tab: an AIF whose category is not stated is treated as Category I or II, and said so (T5)',
    from: "    if(_nsT.passThrough.n) _nsp.push(_pl(_nsT.passThrough.n,'Category I or II AIF is','Category I or II AIFs are')+' pass-through: income keeps its character and is taxed in the investor&rsquo;s hands, with the holding period counted at the AIF&rsquo;s level for each underlying asset, as its annual statement (Form 64C) reports (Tax Reckoner TY 2026-27, #24). '+\n" +
          "      'That statement is not loaded, so the Gain/Loss ('+gm(_nsT.passThrough.gl)+') is not split, is counted as not classified and is left out of tax harvesting.');\n",
    to: "    /* T5 (CR-0008 question 17): an AIF whose category the file does not state is treated as Category I or II, never asserted */\n" +
        "    var _ptN=_nsT.passThrough.n, _ptA=_nsT.passThrough.assumedN||0;\n" +
        "    if(_ptN) _nsp.push((_ptA\n" +
        "        ? (_pl(_ptN,'AIF is','AIFs are')+' treated as Category I or II (pass-through)'+(_ptA===_ptN?' because the file does not state Category I, II or III':(', '+_ptA+' of them because the file does not state Category I, II or III'))+'. Pass-through means that income')\n" +
        "        : (_pl(_ptN,'Category I or II AIF is','Category I or II AIFs are')+' pass-through: income'))+\n" +
        "      ' keeps its character and is taxed in the investor&rsquo;s hands, with the holding period counted at the AIF&rsquo;s level for each underlying asset, as its annual statement (Form 64C) reports (Tax Reckoner TY 2026-27, #24). '+\n" +
        "      'That statement is not loaded, so the Gain/Loss ('+gm(_nsT.passThrough.gl)+') is not split, is counted as not classified and is left out of tax harvesting.'+\n" +
        "      (_ptA?' Confirm the category against the AIF&rsquo;s statement: a Category III AIF is taxed inside the fund instead.':''));\n"
  },
  {
    label: 'Taxation tab: the Category III note says which AIFs are treated as Category III because they are called Listed AIFs (T5 item 10)',
    from: "      'CMV '+U.m(_nsT.fundLevel.cmv)+' and Gain/Loss '+gm(_nsT.fundLevel.gl)+' are shown as fund level, apart from the not classified amounts, and do not enter the investor&rsquo;s set-off.');\n",
    to: "      'CMV '+U.m(_nsT.fundLevel.cmv)+' and Gain/Loss '+gm(_nsT.fundLevel.gl)+' are shown as fund level, apart from the not classified amounts, and do not enter the investor&rsquo;s set-off.'+\n" +
        "      /* T5 item 10 (CR-0008 question 17): an AIF called a Listed AIF is treated as Category III; the page says so and asks for the statement */\n" +
        "      (_nsT.fundLevel.ruledN?(' '+(_nsT.fundLevel.ruledN===_nsT.fundLevel.n?(_nsT.fundLevel.n===1?'It is':'They are'):(_nsT.fundLevel.ruledN+' of them '+(_nsT.fundLevel.ruledN===1?'is':'are')))+\n" +
        "        ' treated as Category III because '+(_nsT.fundLevel.ruledN===1?'it is called a Listed AIF':'they are called Listed AIFs')+' in the file or the performance data. Confirm the category against the AIF&rsquo;s statement.'):''));\n"
  },
  {
    label: 'Taxation tab: the slab-rate input is a text field that takes digit grouping (T5)',
    from: '<input class="taxas" data-ci="\'+i+\'" data-k="slabPct" type="number" min="0" max="30" step="any" value="\'+a.slabPct+\'"',
    to: '<input class="taxas" data-ci="\'+i+\'" data-k="slabPct" type="text" inputmode="decimal" autocomplete="off" value="\'+a.slabPct+\'"'
  },
  {
    label: 'Taxation tab: the exemption-used input is a text field that takes digit grouping (T5)',
    from: '<input class="taxas" data-ci="\'+i+\'" data-k="usedRs" type="number" min="0" max="\'+a.exemptRs+\'" step="any" value="\'+a.usedRs+\'"',
    to: '<input class="taxas" data-ci="\'+i+\'" data-k="usedRs" type="text" inputmode="decimal" autocomplete="off" value="\'+a.usedRs+\'"'
  },
  {
    label: 'Taxation tab: the Sec 198 exemption line shows 0 without a minus sign (T5)',
    from: "          '<td class=\"n\">-'+U.m(h.exAfter)+'</td><td class=\"n\">-'+U.m(h.exAfterTax)+'</td></tr>';\n",
    to: "          '<td class=\"n\">'+taxNegM(U,h.exAfter)+'</td><td class=\"n\">'+taxNegM(U,h.exAfterTax)+'</td></tr>';\n"
  },
  {
    label: 'Taxation tab: a pool\'s "Loss set off" that rounds to zero shows 0 without a minus sign (T5)',
    from: "            '<td class=\"n\">'+(used>1e-9?'-'+U.m(used):'\\u2014')+'</td>'+\n",
    to: "            '<td class=\"n\">'+(used>1e-9?taxNegM(U,used):'\\u2014')+'</td>'+\n"
  },
  {
    label: 'Taxation tab: the pool table\'s "Loss set off" total shows 0 without a minus sign too (T5)',
    from: "          '<td class=\"n\">'+U.m(H.ltGains+H.stGains)+'</td><td class=\"n\">-'+U.m(H.ltUsed+H.stUsed)+'</td>'+\n",
    to: "          '<td class=\"n\">'+U.m(H.ltGains+H.stGains)+'</td><td class=\"n\">'+taxNegM(U,H.ltUsed+H.stUsed)+'</td>'+\n"
  },
  {
    label: 'Taxation tab: the harvest left-out list names the AIFs whose category is assumed or ruled apart from those whose category is stated (T5 items 4 and 10)',
    from: "      if(_nsT.passThrough.n) _lo.push(_pl(_nsT.passThrough.n,'Category I or II AIF','Category I or II AIFs')+' ('+U.m(_nsT.passThrough.cmv)+')');\n" +
          "      if(_nsT.fundLevel.n) _lo.push(_pl(_nsT.fundLevel.n,'Category III AIF','Category III AIFs')+' ('+U.m(_nsT.fundLevel.cmv)+')');\n",
    to: "      /* T5 items 4 and 10 (CR-0008 question 17): an AIF whose category is assumed (Cat I/II) or ruled (Listed AIF, Cat III) is never listed as one whose category the file states */\n" +
        "      var _lop=function(n,one,many,cmv){ if(n>0) _lo.push(_pl(n,one,many)+' ('+U.m(cmv)+')'); }, _fR=_nsT.fundLevel.ruledN||0;\n" +
        "      _lop(_ptN-_ptA,'Category I or II AIF','Category I or II AIFs',_nsT.passThrough.cmv-(_nsT.passThrough.assumedCmv||0));\n" +
        "      _lop(_ptA,'AIF treated as Category I or II','AIFs treated as Category I or II',_nsT.passThrough.assumedCmv||0);\n" +
        "      _lop(_nsT.fundLevel.n-_fR,'Category III AIF','Category III AIFs',_nsT.fundLevel.cmv-(_nsT.fundLevel.ruledCmv||0));\n" +
        "      _lop(_fR,'AIF treated as Category III','AIFs treated as Category III',_nsT.fundLevel.ruledCmv||0);\n"
  },
  {
    label: 'Taxation tab: LTCG + STCG add back only for a holding that is split (T5)',
    from: "        'A lot&rsquo;s gain is its value at the base file&rsquo;s NAV minus its own purchase cost, with costs scaled to the base file&rsquo;s invested value, so LTCG + STCG Gain/Loss adds back to each holding&rsquo;s total Gain/Loss exactly. '+\n",
    to: "        'A lot&rsquo;s gain is its value at the base file&rsquo;s NAV minus its own purchase cost, with costs scaled to the base file&rsquo;s invested value, so for each holding split into long and short term, its LTCG and STCG Gain/Loss (and that of any ELSS units still in lock-in, which is not classified) add back to its total Gain/Loss exactly. '+\n"
  },
  {
    label: 'Taxation tab: an input with digit grouping is read; only blank or non-numeric restores the default (T5)',
    from: "        var v=String(inp.value==null?'':inp.value).trim();\n" +
          "        var A=Object.prototype.hasOwnProperty.call(taxAssume.clients,c)?taxAssume.clients[c]:(taxAssume.clients[c]={});\n" +
          "        if(v===''||!isFinite(Number(v))) delete A[k]; else A[k]=Number(v);\n",
    to: "        /* T5: Indian or international digit grouping (\"1,25,000\", \"125,000\", \"1 25 000\") is read: commas and spaces are\n" +
        "           dropped, and so are a leading rupee sign, Rs, Rs. or INR (with or without the dot) and a trailing \"/-\", \"/=\", INR or Rs (an amount pasted from a sheet or a statement),\n" +
        "           and a trailing \"%\" in the slab-rate field. An exponent\n" +
        "           (\"1.25e5\") is read too. Only a blank or non-numeric entry restores the default. */\n" +
        "        var v=String(inp.value==null?'':inp.value).replace(/[,\\s]/g,'').replace(/^(?:\\u20B9|rs\\.?|inr\\.?)/i,'').replace(/\\/[-=]$/,'').replace(/(?:inr|rs\\.?)$/i,'');\n" +
        "        if(k==='slabPct') v=v.replace(/%$/,'');\n" +
        "        var A=Object.prototype.hasOwnProperty.call(taxAssume.clients,c)?taxAssume.clients[c]:(taxAssume.clients[c]={});\n" +
        "        if(!/^[+-]?(\\d+\\.?\\d*|\\.\\d+)(e[+-]?\\d+)?$/i.test(v)) delete A[k]; else A[k]=Number(v);\n"
  },

  /* ======================= exporters (08): the tax slides ======================= */
  {
    label: 'class slide: the AIFs whose category is assumed or ruled, and the usual-bucket classes, in the footnote (T5)',
    from: "      if(_ns.passThrough.n) _nsb.push('Cat I/II AIFs (per underlying asset)');\n" +
          "      var _nsFoot=(_nsb.length?(' Not split: '+_nsb.join(', ')+'.'):'')+(_ns.fundLevel.n?' Cat III AIFs: fund level.':'');\n",
    to: "      /* T5 items 4 and 10 (CR-0008 question 17): an AIF whose category the file does not state is treated as Cat I/II and a Listed AIF as\n" +
        "         Cat III, never asserted. Kept short, since the class footnote grows (_footFit below) once it runs past two lines (KI-109). */\n" +
        "      var _ptA=_ns.passThrough.assumedN||0, _rA=_ns.fundLevel.ruledN||0, _aifs=function(n){ return n===1?'1 AIF is':n+' AIFs are'; };\n" +
        "      if(_ns.passThrough.n) _nsb.push((_ptA===_ns.passThrough.n?'AIFs treated as Cat I/II':'Cat I/II AIFs')+' (per underlying asset)');\n" +
        "      var _nsFoot=(_nsb.length?(' Not split: '+_nsb.join(', ')+'.'):'')+(_ns.fundLevel.n>_rA?' Cat III AIFs: fund level.':'')+\n" +
        "        (_ptA?(' '+_aifs(_ptA)+' treated as Cat I/II because the file states no Category I, II or III: confirm it against the AIF\\u2019s statement.'):'')+\n" +
        "        (_rA?(' '+_aifs(_rA)+' treated as Cat III (fund level) because '+(_rA===1?'it is called a Listed AIF':'they are called Listed AIFs')+': confirm against the AIF\\u2019s statement.'):'');\n" +
        "      /* T5 (TR-7, LD-11): aggressive hybrid, arbitrage and equity savings funds classed by the usual bucket; worded for the client */\n" +
        "      var _ubFoot=T.positions.some(function(r){ return r.usualBucket; })?' Aggressive hybrid, arbitrage, equity savings: usual bucket per the tax reckoner; confirm with the fund house.':'';\n"
  },
  {
    label: 'class slide: LTCG + STCG add back only for a holding that is split (T5)',
    from: "' transactions. LTCG + STCG add back to each holding\\u2019s Gain/Loss. Rates stated as words depend on the assessee or the fund\\u2019s own filing.'+\n",
    to: "' transactions. LTCG + STCG (and ELSS in lock-in) add back to each split holding\\u2019s Gain/Loss. Rates stated as words depend on the assessee or the fund\\u2019s own filing.'+\n"
  },
  {
    label: 'class slide: a footnote of three lines or more grows upward, above the black band (T5, KI-109)',
    from: "      foot(s,'*Holding periods measured to '+asOn+taxDateTag+' from each lot\\u2019s own purchase date, FIFO over '+T.txnCount+\n",
    to: "      /* T5 (KI-109): the sentences part T5 adds can take the class footnote past two lines; from a third line on it grows upward\n" +
        "         from the band's edge (7.18 in) instead of running into it. The table above it (rows of 0.30 in, 0.40 when a cell wraps)\n" +
        "         sets the room; when 8 pt does not fit in it (with several wrapped rows, from about 13 classes), the footnote drops to 7 pt and, if it must, to\n" +
        "         6.5 pt, and it always ends at the band's edge, never on the band (review R6-1, R7-F2). At 8 pt a line holds about 260\n" +
        "         characters and is 0.14 in high; at 7 pt about 300 and 0.125 in; at 6.5 pt about 320 and 0.115 in. The table's height is an estimate that is\n" +
        "         never measured (a row that wraps may be taller than 0.40 in, one that does not shorter), and 6.5 pt is the last step: with 14 classes shown,\n" +
        "         four rows counted as wrapped and every optional sentence, the first line starts 0.12 in above the estimate (more with more wrapped rows).\n" +
        "         No such deck has been rendered; slide geometry for 13 or more classes is NOT RUN (delta review D4-F1, D4-F2; ARC-01, 2 Nov 2026). */\n" +
        "      var _tb=1.94+0.30+T.byClass.slice(0,14).reduce(function(a,g){ return a+((lta(g.rule).length>24||String(g.cls).length>44)?0.40:0.30); },0);\n" +
        "      var _footFit=function(sl,txt){ var len=String(txt).length, n=Math.ceil(len/260); if(n<=2){ foot(sl,txt); return; }\n" +
        "        var room=7.18-(_tb+0.04), fs=8, lh=0.14;\n" +
        "        if(n*lh>room){ fs=7; lh=0.125; n=Math.ceil(len/300); }\n" +
        "        if(n*lh>room){ fs=6.5; lh=0.115; n=Math.ceil(len/320); }\n" +
        "        var h=n*lh;\n" +
        "        sl.addText(txt,{x:0.18,y:7.18-h,w:W-0.4,h:h,fontFace:F,fontSize:fs,italic:true,color:\"6B6B6B\",align:\"left\",valign:\"bottom\"}); };\n" +
        "      _footFit(s,'*Holding periods measured to '+asOn+taxDateTag+' from each lot\\u2019s own purchase date, FIFO over '+T.txnCount+\n"
  },
  {
    label: 'class slide: the usual-bucket sentence is in the footnote (T5)',
    from: "(t.lockedCmv>1e-12?(' ELSS units still in lock-in ('+U.m(t.lockedCmv)+') are unclassified and not harvested.'):'')+_nsFoot+_srcFoot);\n",
    to: "(t.lockedCmv>1e-12?(' ELSS units still in lock-in ('+U.m(t.lockedCmv)+') are unclassified and not harvested.'):'')+_nsFoot+_ubFoot+_srcFoot);\n"
  },
  {
    label: 'class slide: the unreconciled and unclassified counts agree in number, as the holding-detail slide does (T5, delta review D5-F6)',
    from: "        (T.unreconciled.length?(' '+T.unreconciled.length+' holding(s) could not be reconciled to the base file and are unclassified.'):'')+\n" +
          "        (T.unmapped.length?(' '+T.unmapped.length+' holding(s) have no tax class and are unclassified.'):'')+\n",
    to: "        (T.unreconciled.length?(' '+T.unreconciled.length+(T.unreconciled.length===1?' holding could not be reconciled to the base file and is unclassified.':' holdings could not be reconciled to the base file and are unclassified.')):'')+\n" +
        "        (T.unmapped.length?(' '+T.unmapped.length+(T.unmapped.length===1?' holding has no tax class and is unclassified.':' holdings have no tax class and are unclassified.')):'')+\n"
  },
  {
    label: 'harvest slide: the holdings with no client name agree in number (T5, delta review D3-F5)',
    from: "        if(T.unnamedN) nt.push(T.unnamedN+' holding(s) with no client name are treated as one person.');\n",
    to: "        if(T.unnamedN) nt.push(T.unnamedN+(T.unnamedN===1?' holding with no client name is treated as one person.':' holdings with no client name are treated as one person.'));\n"
  },
  {
    label: 'holding-detail slide: what PMS and AIF rows show, truthfully and without a dash (T5)',
    from: "            'Holdings priced in rupees rather than units (PMS, unlisted AIF) show \\u2014 in the unit columns. '+\n",
    to: "            /* about the length of the sentence it replaces; the footnote box is 0.26 in high and the whole footnote, with every optional sentence, runs\n" +
        "               to about 840 characters, so it may need a third line (pre-existing, KI-109) */\n" +
        "            'Holdings matched on invested value show no units; PMS and AIF rows read Not split or Fund level. '+\n"
  },
  {
    label: 'holding-detail slide: an unreconciled holding is not said to have no lot history (T5)',
    from: "            (T.unreconciled.length?(' '+T.unreconciled.length+' holding(s) with no lot history are unclassified and are not listed here.'):'')+\n",
    to: "            (T.unreconciled.length?(' '+T.unreconciled.length+(T.unreconciled.length===1?' unreconciled holding is unclassified and not listed here.':' unreconciled holdings are unclassified and not listed here.')):'')+\n"
  },
  {
    label: 'harvest slide: a helper for an amount taken off (T5)',
    from: "        var _rs=function(v){ return '\\u20B9'+Number(v||0).toLocaleString('en-IN'); };\n",
    to: "        var _rs=function(v){ return '\\u20B9'+Number(v||0).toLocaleString('en-IN'); };\n" +
        "        /* T5: an amount taken off; one that rounds to zero shows 0, never \"-0\" */\n" +
        "        var _negM=function(v){ var s=U.m(v); return (v>0&&/[1-9]/.test(s))?('-'+s):U.m(0); };\n"
  },
  {
    label: 'harvest slide: a pool\'s "Loss set off" that rounds to zero shows 0 without a minus sign (T5)',
    from: "            cell(used>1e-9?('-'+U.m(used)):'\\u2014',{align:'right',color:(used>1e-9?C.green:'000000')}),\n",
    to: "            cell(used>1e-9?_negM(used):'\\u2014',{align:'right',color:(used>1e-9?C.green:'000000')}),\n"
  },
  {
    label: 'harvest slide: the Sec 198 exemption line shows 0 without a minus sign (T5)',
    from: "            cell('-'+U.m(H.exAfter),{align:'right',italic:true}),\n" +
          "            cell('-'+U.m(H.exAfterTax),{align:'right',italic:true})\n",
    to: "            cell(_negM(H.exAfter),{align:'right',italic:true}),\n" +
        "            cell(_negM(H.exAfterTax),{align:'right',italic:true})\n"
  },
  {
    label: 'harvest slide: "Left out" gives the count and the CMV, as the tab does (T5)',
    from: "        if(_ns.pms.n) _lo.push(_ns.pms.n+' PMS');\n" +
          "        if(_ns.passThrough.n) _lo.push(_ns.passThrough.n+' Cat I/II AIF'+(_ns.passThrough.n===1?'':'s'));\n" +
          "        if(_ns.fundLevel.n) _lo.push(_ns.fundLevel.n+' Cat III AIF'+(_ns.fundLevel.n===1?'':'s'));\n",
    to: "        if(_ns.pms.n) _lo.push(_ns.pms.n+' PMS ('+U.m(_ns.pms.cmv)+')');\n" +
        "        /* T5 items 4 and 10: an AIF whose category is assumed or ruled is named apart from one whose category the file states */\n" +
        "        var _lop=function(n,one,many,cmv){ if(n>0) _lo.push(n+' '+(n===1?one:many)+' ('+U.m(cmv)+')'); };\n" +
        "        _lop(_ns.passThrough.n-_ptA,'Cat I/II AIF','Cat I/II AIFs',_ns.passThrough.cmv-(_ns.passThrough.assumedCmv||0));\n" +
        "        _lop(_ptA,'AIF treated as Cat I/II','AIFs treated as Cat I/II',_ns.passThrough.assumedCmv||0);\n" +
        "        _lop(_ns.fundLevel.n-_rA,'Cat III AIF','Cat III AIFs',_ns.fundLevel.cmv-(_ns.fundLevel.ruledCmv||0));\n" +
        "        _lop(_rA,'AIF treated as Cat III','AIFs treated as Cat III',_ns.fundLevel.ruledCmv||0);\n"
  },

  /* ======================= engine (07): the exported harvest defaults ======================= */
  {
    label: 'engine: the harvest defaults the engine exports are frozen (T5, ARC-01 C3)',
    from: '  var TAX_HARVEST_DEFAULTS={slabPct:30, slabMaxPct:30, usedRs:0, exemptRs:TAX_S198_EXEMPT_RS};\n',
    to: '  /* T5 (ARC-01 C3): exported as ENGINE.taxDefaults and read only by taxAssumeFor, so it is frozen */\n' +
        '  var TAX_HARVEST_DEFAULTS=Object.freeze({slabPct:30, slabMaxPct:30, usedRs:0, exemptRs:TAX_S198_EXEMPT_RS});\n'
  },

  /* ======================= parsers (09): a date-time with an explicit zone ======================= */
  {
    label: 'parsers: a date-time that names its own zone is read as the day it states (T5 item 11, ARC-01 C2, KI-186)',
    from: '    var d=new Date(s); return isNaN(d)?null:new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));\n',
    to: '    /* T5 item 11 (ARC-01 C2, KI-186): a date-time that names its own zone ("2023-04-01T20:00:00Z", "...+05:30") carries its day in the text;\n' +
        '       read that day, so it is the same in every zone (part T2 read the machine-local day of the instant). Only text Date accepts is read at\n' +
        '       all: an impossible month, hour or offset ("2023-13-01T00:00:00Z", "...T25:00:00Z", "...+25:00") is dropped, as before */\n' +
        '    var d=new Date(s); if(isNaN(d)) return null;\n' +
        '    m=/^(\\d{4})-(\\d{2})-(\\d{2})[T ]\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?\\s*(?:Z|[+-]\\d{2}:?\\d{2})$/i.exec(s);\n' +
        '    if(m) return new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));\n' +
        '    return new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));\n'
  },

  /* ======================= wording after the owner's answer to question 18 (stage S9; KI-182, D-043) ======================= */
  {
    label: "Taxation tab: the crypto set-off sentence no longer says \"pending the owner's ruling\" (T5 stage S9, KI-182, D-043)",
    from: "      /* TX-23 (KI-182; CR-0008 question 18): the Crypto row is kept out of set-off until the owner rules */\n" +
          "      var nsoNote=(H.noSetOffGain>1e-9||H.noSetOffLoss>1e-9)?('<div class=\"taxwarn\" style=\"margin-top:10px;\">Crypto gains and losses are kept out of set-off pending the owner&rsquo;s ruling, as the reckoner is silent on them: '+\n",
    to: "      /* TX-23 (KI-182; CR-0008 question 18, answered 2 Nov 2026: keep no set-off; D-043): the Crypto row is kept out of set-off */\n" +
          "      var nsoNote=(H.noSetOffGain>1e-9||H.noSetOffLoss>1e-9)?('<div class=\"taxwarn\" style=\"margin-top:10px;\">Crypto gains and losses are kept out of set-off, as the owner has ruled and the reckoner is silent on them: '+\n"
  },
  {
    label: "harvest slide: the crypto set-off sentence no longer says \"pending a ruling on their treatment\" (T5 stage S9, KI-182, D-043)",
    from: "        /* TX-23 (KI-182; CR-0008 question 18): the Crypto row is kept out of set-off until a ruling */\n" +
          "        if(H.noSetOffGain>1e-9||H.noSetOffLoss>1e-9) nt.push('Crypto gains and losses are kept out of set-off pending a ruling on their treatment: no loss is set against a crypto gain'+\n",
    to: "        /* TX-23 (KI-182; CR-0008 question 18, answered 2 Nov 2026: keep no set-off; D-043): the Crypto row is kept out of set-off */\n" +
          "        if(H.noSetOffGain>1e-9||H.noSetOffLoss>1e-9) nt.push('Crypto gains and losses are kept out of set-off, as the tax reckoner is silent on them (confirm with the tax adviser): no loss is set against a crypto gain'+\n"
  },
  {
    label: "engine: the comment on the noSetOff row says the owner has ruled (T5 stage S9, KI-182, D-043)",
    from: "     TX-23 (KI-182; the re-review of part T3): a row marked noSetOff (Crypto) is kept out of set-off\n" +
          "       until the owner rules (CR-0008 question 18): no loss is set against its gain, which is taxed\n" +
          "       in full before and after, and its own loss reduces no other gain and is not carried forward.\n",
    to: "     TX-23 (KI-182; the re-review of part T3): a row marked noSetOff (Crypto) is kept out of set-off,\n" +
          "       as the owner ruled on 2 Nov 2026 (CR-0008 question 18, D-043): no loss is set against its gain,\n" +
          "       which is taxed in full before and after, and its own loss reduces no other gain and is not carried forward.\n"
  }
]);
