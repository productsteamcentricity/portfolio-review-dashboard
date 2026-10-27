/* ============================================================================
   2026-10-27 — tax batch, part T5: follow-ups to parts T1 to T4
   (CR-0008; decision D-040; Tax Reckoner TY 2026-27, law as on 19 Oct 2026).
   Edits the engine script (07_engine.js), the exporters script (08_exporters.js)
   and the UI script (11_app_ui.js). TAX_RULES is unchanged. Applies after
   2026-10-27-tax-4-review.js.

   1. The usual-bucket default, dated (TR-7 and LD-11 of the new build's design,
      docs/new-build/capital-gains-upload.md §10.5, §10.5a). Aggressive hybrid, arbitrage and
      equity savings funds are equity-oriented as the reckoner's usual bucket (Master Summary
      #8 to #10, rows 16 to 18, column P; Hybrid Funds & FoFs D19 to D21) only when the tax
      reference date (taxRefDate, D-040 a) is on or after 1 Apr 2026: aggressive hybrid and
      equity savings take "Hybrid MF (equity-oriented)", arbitrage "Equity Mutual Funds", each
      marked usualBucket and labelled "usual bucket per the owner's reckoner; confirm with the
      fund house". Before 1 Apr 2026 they are unclassified, with a reason saying the AMC's
      classification for that year is needed. Part T1 classed aggressive hybrid and arbitrage
      always and left equity savings unclassified always. A mutual fund named as an arbitrage
      fund whose category is blank is read by its name too, as the hybrid tests already read the
      name (part T1 read arbitrage from the category only, so such a fund filed as Debt was
      Specified). Balanced advantage, dynamic asset
      allocation, multi asset, life cycle, retirement and children's funds stay unclassified in
      both periods. taxClassify(h, R, refDate) and taxClassOf(h, R, refDate) take the date as a
      third, optional argument; computeTaxation passes its asOn, so every reader of
      model.taxation (the tab, the slides, the AI Analyst tax signal) sees one class per holding.
      A call without a date applies the TY 2026-27 rules, as before.
   2. The Sec 198 exemption line shows "-Rs 0.00" no more: an amount that rounds to zero shows
      0 without a minus sign (tab and harvest slide); so do the "Loss set off" cells of the
      pool table (a pool's, and the tab's total when no loss is set off).
   3. The unreconciled table's heading on the Taxation tab says why, by reason: merged folios
      with blank units (fix batch 4, KI-140), no purchase still held, fewer or more units than
      the base file, invested value. Each record carries the reason's kind (unrec). The two
      unit and value reasons lose their dash and say which way the units differ; the
      holding-detail slide no longer says such holdings have "no lot history".
   4. An AIF whose category the file does not state (the 11 "Listed AIF" funds of AIF_PERF)
      is still Category I or II, pass-through (part T3), marked catAssumed: the tab, the slides
      and the AI Analyst say it is treated as Category I or II because the file does not state
      the category, and to confirm it against the AIF's statement (CR-0008 question 17 stays
      open).
   5. Wording part T3 left stale: the holding-detail slide no longer says PMS and unlisted AIF
      show a dash in the unit columns, and the tab and the class slide no longer say LTCG +
      STCG add back to every holding's Gain/Loss.
      The class slide's footnote, which the sentences of items 1 and 4 can take past two lines,
      grows upward from its third line instead of running into the black band (KI-109).
   6. The harvest slide's "Left out" line gives the count and the CMV, as the tab does.
   7. The harvest assumption inputs are text fields that accept Indian and international digit
      grouping ("1,25,000", "125,000", "1 25 000"); only a blank or non-numeric entry restores
      the default. A number field gave an empty value for "1,25,000", which restored the
      default without a word.
   8. A comment only: the foreign-share marker reads the ISIN of the matched STOCK_RET entry; the base
      file's own ISIN column is not read by parseBaseRows (KI-184, open, not fixed here; D-040 c corrected).

     node tools/patches/2026-10-27-tax-5-followups.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

const USUAL = "usual bucket per the owner's reckoner; confirm with the fund house";
const USUAL_HTML = 'usual bucket per the owner&rsquo;s reckoner; confirm with the fund house';

applyPatch('2026-10-27 tax batch T5: follow-ups (usual bucket by date, wording, inputs; CR-0008, D-040)', [

  /* ======================= engine (07) ======================= */
  {
    label: 'engine: the classifier header names the reference date and the two marks (T5)',
    from: '     taxClassify(h, R) returns {cls, why}: cls is a TAX_RULES inst, or null with why, the\n' +
          '     reason shown for a holding left unclassified. R (optional, the reference data) is read\n' +
          '     only for the ISIN of a share held directly (STOCK_RET). */\n',
    to: '     taxClassify(h, R, refDate) returns {cls, why}: cls is a TAX_RULES inst, or null with why,\n' +
        '     the reason shown for a holding left unclassified. R (optional, the reference data) is read\n' +
        '     only for the ISIN of a share held directly (STOCK_RET). refDate (optional; tax batch T5) is\n' +
        '     the tax reference date (taxRefDate, D-040 a): from 1 Apr 2026 aggressive hybrid, arbitrage\n' +
        '     and equity savings funds take the reckoner\'s usual bucket, marked usual:true; before it they\n' +
        '     are unclassified (TR-7, LD-11). With no date the TY 2026-27 rules apply. An AIF whose\n' +
        '     category the file does not state is Category I or II, marked catAssumed:true. */\n'
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
        '    usualBefore:"An aggressive hybrid, arbitrage or equity savings fund is taxed by what it held over the tax year. The usual bucket per the owner\'s reckoner applies from 1 Apr 2026; holding periods here run to an earlier date, so the AMC\'s tax classification for that year is needed."\n' +
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
    label: 'engine: an AIF whose category is not stated is Category I or II, marked catAssumed (T5)',
    from: '      return K(/debt/.test(a) ? "Debt AIF – Cat I/II" : "Equity AIF – Cat I/II");\n',
    to: '      /* T5 (CR-0008 question 17): with no category stated ("Listed AIF" in AIF_PERF), Category I or II is assumed, and said */\n' +
        '      var _r12=K(/debt/.test(a) ? "Debt AIF – Cat I/II" : "Equity AIF – Cat I/II");\n' +
        '      if(!/cat(egory)?\\.?\\s*-?\\s*(ii?|[12])\\b/i.test(c+" "+n)) _r12.catAssumed=true;\n' +
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
        '      /* T5: an arbitrage fund whose category is blank, by its name, as the hybrid tests read the name (before the\n' +
        '         debt test: an arbitrage fund is often filed as Debt for analytics routing) */\n' +
        '      if (/arbitrage/.test(n)) return UB("Equity Mutual Funds");\n'
  },
  {
    label: 'engine: computeTaxation classes each holding on its reference date (T5)',
    from: '      var _tc=taxClassify(h,REF), cls=_tc.cls, rule=cls?byName[cls]:null;\n',
    to: '      var _tc=taxClassify(h,REF,asOn), cls=_tc.cls, rule=cls?byName[cls]:null;   /* T5: one date, so one class per holding in the review */\n'
  },
  {
    label: 'engine: the record carries the usual-bucket and assumed-category marks (T5)',
    from: '               pxGap:pxGap||undefined, viaSwitchIn:(pxGap&&swIn[_k])||undefined};\n',
    to: '               pxGap:pxGap||undefined, viaSwitchIn:(pxGap&&swIn[_k])||undefined,\n' +
        '               usualBucket:_tc.usual||undefined, catAssumed:_tc.catAssumed||undefined};   /* T5 */\n'
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
    to: '        /* T5: the kind of reason, for the heading of the tab\'s unreconciled table */\n' +
        '        rec.unrec=amtMode?"value":(fifoU<baseU?"short":"excess");\n' +
        '        rec.reason=pxGap\n' +
        '          ? ("Invested value does not reconcile to the base file. "+\n' +
        '             (swIn[_k]?"The switch-in":"A purchase")+" for this holding carries no price, so it was matched on invested value rather than units, and that does not reconcile either.")\n' +
        '          : (amtMode\n' +
        '            ? "Invested value does not reconcile to the base file: the transaction history is incomplete for this holding."\n' +
        '            : (fifoU<baseU\n' +
        '              ? "Units do not reconcile to the base file: the transaction history gives fewer units, so it is missing an event, such as a bonus or split, or a purchase made elsewhere."\n' +
        '              : "Units do not reconcile to the base file: the transaction history gives more units, so it is missing an event, such as a sale, a transfer out or a consolidation of units."));\n'
  },
  {
    label: 'engine: the summariser counts the AIFs whose category is assumed (T5)',
    from: '             notSplit:{fundLevel:{n:0,cmv:0,gl:0},passThrough:{n:0,cmv:0,gl:0},pms:{n:0,cmv:0,gl:0}}};\n',
    to: '             notSplit:{fundLevel:{n:0,cmv:0,gl:0},passThrough:{n:0,cmv:0,gl:0,assumedN:0,assumedCmv:0},pms:{n:0,cmv:0,gl:0}}};\n'
  },
  {
    label: 'engine: the summariser counts the AIFs whose category is assumed, per holding (T5)',
    from: '          var ns=t.notSplit[r.notSplit]; if(ns){ ns.n++; ns.cmv+=r.cmv; if(r.gl!=null) ns.gl+=r.gl; }\n',
    to: '          var ns=t.notSplit[r.notSplit]; if(ns){ ns.n++; ns.cmv+=r.cmv; if(r.gl!=null) ns.gl+=r.gl;\n' +
        '            if(r.catAssumed){ ns.assumedN=(ns.assumedN||0)+1; ns.assumedCmv=(ns.assumedCmv||0)+r.cmv; } }   /* T5 */\n'
  },
  {
    label: 'AI Analyst: a review whose holdings are all unclassified still gives each its reason (T5)',
    from: '    if (!T || !T.hasData || !T.positions || !T.positions.length)\n' +
          '      return aiaSig("tax", "Tax", "na", ev,\n' +
          '        "No IRR transaction history is loaded, so the long- and short-term split of this holding is not known.");\n',
    to: '    /* T5: a review whose holdings are all unclassified or unreconciled (valued before 1 Apr 2026, a book of aggressive\n' +
        '       hybrid, arbitrage and equity savings funds is one) has a history: each holding gets its own reason below */\n' +
        '    if (!T || !T.hasData || !T.positions || !(T.positions.length || (T.unmapped || []).length || (T.unreconciled || []).length))\n' +
        '      return aiaSig("tax", "Tax", "na", ev,\n' +
        '        "No IRR transaction history is loaded, so the long- and short-term split of this holding is not known.");\n'
  },
  {
    label: 'AI Analyst: the tax signal collects the two marks (T5)',
    from: '    var acc = { ltCmv: 0, stCmv: 0, ltGain: null, stGain: null, cls: "", n: 0, lockCmv: 0, gf: 0, nsN: 0, ns: "" };\n',
    to: '    var acc = { ltCmv: 0, stCmv: 0, ltGain: null, stGain: null, cls: "", n: 0, lockCmv: 0, gf: 0, nsN: 0, ns: "", usual: false, catAs: false };\n'
  },
  {
    label: 'AI Analyst: the tax signal reads the two marks from the records (T5)',
    from: '      if (p.notSplit && !p.splitPart){ acc.nsN++; acc.ns = p.notSplit; }   /* TX-07, TX-10, TX-12 */\n',
    to: '      if (p.notSplit && !p.splitPart){ acc.nsN++; acc.ns = p.notSplit; }   /* TX-07, TX-10, TX-12 */\n' +
        '      if (p.usualBucket) acc.usual = true; if (p.catAssumed) acc.catAs = true;   /* T5 */\n'
  },
  {
    label: 'AI Analyst: an AIF whose category is assumed says so and asks for the statement (T5)',
    from: '      return aiaSig("tax", "Tax", "na", ev, ({\n',
    to: '      /* T5 (CR-0008 question 17): an AIF whose category the file does not state */\n' +
        '      return aiaSig("tax", "Tax", "na", ev, ((acc.catAs && acc.ns === "passThrough") ? "The file does not state this AIF\'s category, so it is treated as Category I or II; confirm the category against the AIF\'s statement. " : "") + (({\n'
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
    label: 'Taxation tab: helpers for the two marks and for an amount taken off (T5)',
    from: '  function taxNsSub(r){ return (r&&r.notSplit===\'pms\')?\'<span class="taxsub">Gain/Loss on capital contributed: not a capital-gains figure</span>\':\'\'; }\n',
    to: '  function taxNsSub(r){ return (r&&r.notSplit===\'pms\')?\'<span class="taxsub">Gain/Loss on capital contributed: not a capital-gains figure</span>\':\'\'; }\n' +
        '  /* T5: a class taken from the reckoner\'s usual bucket (TR-7, LD-11), or an AIF whose category the file does not state */\n' +
        '  function taxT5Sub(r){ return (r&&r.usualBucket)?\'<span class="taxsub">' + USUAL_HTML + '</span>\'\n' +
        '    :((r&&r.catAssumed)?\'<span class="taxsub">category not stated in the file: treated as Category I or II</span>\':\'\'); }\n' +
        '  /* T5: an amount taken off; one that rounds to zero shows 0, never "-0" */\n' +
        '  function taxNegM(U,v){ var s=U.m(v); return (v>0&&/[1-9]/.test(s))?(\'-\'+s):U.m(0); }\n'
  },
  {
    label: 'Taxation tab: the class detail rows show the two marks (T5)',
    from: "        return '<tr><td>'+taxEsc(r.name)+'<span class=\"taxsub\">'+taxEsc(r.category||r.product)+'</span>'+taxNsSub(r)+'</td>'+\n",
    to: "        return '<tr><td>'+taxEsc(r.name)+'<span class=\"taxsub\">'+taxEsc(r.category||r.product)+'</span>'+taxNsSub(r)+taxT5Sub(r)+'</td>'+\n"
  },
  {
    label: 'Taxation tab: the By Holding rows show the two marks (T5)',
    from: "      return '<tr><td>'+taxEsc(r.name)+'<span class=\"taxsub\">'+taxEsc(r.cls)+'</span>'+taxNsSub(r)+'</td>'+\n",
    to: "      return '<tr><td>'+taxEsc(r.name)+'<span class=\"taxsub\">'+taxEsc(r.cls)+'</span>'+taxNsSub(r)+taxT5Sub(r)+'</td>'+\n"
  },
  {
    label: 'Taxation tab: the unreconciled heading says why, by reason, with no dash (T5)',
    from: "      warn+='<div class=\"taxwarn\"><b>'+T.unreconciled.length+' holding'+(T.unreconciled.length===1?'':'s')+' could not be reconciled to the base file and '+\n" +
          "        (T.unreconciled.length===1?'is':'are')+' left unclassified.</b> FIFO over the transaction history does not reproduce the unit balance, which means the history is missing an event &mdash; '+\n" +
          "        'a bonus or split, or a purchase made elsewhere. No split is shown rather than one computed on lots known to be incomplete.'+\n",
    to: "      /* T5: one sentence per kind of reason: blank merged units (KI-140), no purchase still held, fewer or more units\n" +
        "         than the base file, invested value */\n" +
        "      var _uk={}; T.unreconciled.forEach(function(r){ var k=r.unrec||'other'; _uk[k]=(_uk[k]||0)+1; });\n" +
        "      var _uh=function(n,one,many){ return n+' '+(n===1?one:many); }, _us=[];\n" +
        "      if(_uk.unitsGap) _us.push(_uh(_uk.unitsGap,'holding merges folios of which at least one has no units in the base file, so its units','holdings merge folios of which at least one has no units in the base file, so their units')+' cannot be checked against the transaction history.');\n" +
        "      if(_uk.noLots) _us.push(_uh(_uk.noLots,'holding has','holdings have')+' no purchase in the IRR sheet that is still held, so there are no lots to split.');\n" +
        "      if(_uk.short) _us.push('For '+_uh(_uk.short,'holding','holdings')+' the transaction history gives fewer units than the base file, so it is missing an event: a bonus or split, or a purchase made elsewhere.');\n" +
        "      if(_uk.excess) _us.push('For '+_uh(_uk.excess,'holding','holdings')+' the transaction history gives more units than the base file, so it is missing an event: a sale, a transfer out or a consolidation of units.');\n" +
        "      if(_uk.value) _us.push('For '+_uh(_uk.value,'holding','holdings')+' matched on invested value, the transaction history does not add up to the base file&rsquo;s invested value.');\n" +
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
        "    var _ubH=T.positions.filter(function(r){ return r.usualBucket&&!r.splitPart; });\n" +
        "    var usualNote=_ubH.length?('<div class=\"taxnote\">'+_ubH.length+' holding'+(_ubH.length===1?' is an aggressive hybrid, arbitrage or equity savings fund':'s are aggressive hybrid, arbitrage or equity savings funds')+' ('+\n" +
        "      taxEsc(_ubH.slice(0,5).map(function(r){ return r.name; }).join('; '))+(_ubH.length>5?' and '+(_ubH.length-5)+' more':'')+'), classed as equity-oriented: " + USUAL_HTML + ". '+\n" +
        "      'Such a fund is equity-oriented only while 65% or more of it is in listed Indian equity over the tax year, hedged arbitrage positions included, so the AMC&rsquo;s year-end tax classification is the check.</div>'):'';\n"
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
        "        ? (_pl(_ptN,'AIF is','AIFs are')+' treated as Category I or II (pass-through)'+(_ptA===_ptN?(' because the file does not state '+(_ptN===1?'its':'their')+' category'):(', '+_ptA+' of them because the file does not state the category')))\n" +
        "        : (_pl(_ptN,'Category I or II AIF is','Category I or II AIFs are')+' pass-through'))+\n" +
        "      ': income keeps its character and is taxed in the investor&rsquo;s hands, with the holding period counted at the AIF&rsquo;s level for each underlying asset, as its annual statement (Form 64C) reports (Tax Reckoner TY 2026-27, #24). '+\n" +
        "      'That statement is not loaded, so the Gain/Loss ('+gm(_nsT.passThrough.gl)+') is not split, is counted as not classified and is left out of tax harvesting.'+\n" +
        "      (_ptA?' Confirm the category against the AIF&rsquo;s statement: a Category III AIF is taxed inside the fund instead.':''));\n"
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
    label: 'Taxation tab: the harvest left-out list does not assert an assumed category (T5)',
    from: "      if(_nsT.passThrough.n) _lo.push(_pl(_nsT.passThrough.n,'Category I or II AIF','Category I or II AIFs')+' ('+U.m(_nsT.passThrough.cmv)+')');\n",
    to: "      if(_nsT.passThrough.n) _lo.push(_pl(_nsT.passThrough.n,_ptA?'AIF treated as Category I or II':'Category I or II AIF',_ptA?'AIFs treated as Category I or II':'Category I or II AIFs')+' ('+U.m(_nsT.passThrough.cmv)+')');   /* T5 */\n"
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
        "           dropped. Only a blank or non-numeric entry restores the default. */\n" +
        "        var v=String(inp.value==null?'':inp.value).replace(/[,\\s]/g,'');\n" +
        "        var A=Object.prototype.hasOwnProperty.call(taxAssume.clients,c)?taxAssume.clients[c]:(taxAssume.clients[c]={});\n" +
        "        if(!/^[+-]?(\\d+\\.?\\d*|\\.\\d+)$/.test(v)) delete A[k]; else A[k]=Number(v);\n"
  },

  /* ======================= exporters (08): the tax slides ======================= */
  {
    label: 'class slide: the AIFs whose category is assumed, and the usual-bucket classes, in the footnote (T5)',
    from: "      if(_ns.passThrough.n) _nsb.push('Cat I/II AIFs (per underlying asset)');\n" +
          "      var _nsFoot=(_nsb.length?(' Not split: '+_nsb.join(', ')+'.'):'')+(_ns.fundLevel.n?' Cat III AIFs: fund level.':'');\n",
    to: "      /* T5 (CR-0008 question 17): an AIF whose category the file does not state is treated as Cat I/II, never asserted.\n" +
        "         Kept short: the class footnote holds about two lines (KI-109). */\n" +
        "      var _ptA=_ns.passThrough.assumedN||0;\n" +
        "      if(_ns.passThrough.n) _nsb.push((_ptA?'AIFs treated as Cat I/II':'Cat I/II AIFs')+' (per underlying asset)');\n" +
        "      var _nsFoot=(_nsb.length?(' Not split: '+_nsb.join(', ')+'.'):'')+(_ns.fundLevel.n?' Cat III AIFs: fund level.':'')+\n" +
        "        (_ptA?(' '+(_ptA===1?'1 AIF is':_ptA+' AIFs are')+' treated as Cat I/II because the file states no category: confirm it against the AIF\\u2019s statement.'):'');\n" +
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
    to: "      /* T5 (KI-109): the two sentences part T5 adds can take the class footnote past two lines; from a third line on it\n" +
        "         grows upward from the band's edge instead of running into it, but never over the table above (its rows are 0.30 in,\n" +
        "         0.40 when a cell wraps); with no room left it starts below the table, as before. A line holds about 260 characters. */\n" +
        "      var _tb=1.94+0.30+T.byClass.slice(0,14).reduce(function(a,g){ return a+((lta(g.rule).length>24||String(g.cls).length>44)?0.40:0.30); },0);\n" +
        "      var _footFit=function(sl,txt){ var n=Math.ceil(String(txt).length/260); if(n<=2){ foot(sl,txt); return; }\n" +
        "        var h=n*0.14, y=Math.max(7.18-h,_tb+0.04);\n" +
        "        sl.addText(txt,{x:0.18,y:y,w:W-0.4,h:h,fontFace:F,fontSize:8,italic:true,color:\"6B6B6B\",align:\"left\",valign:(y>7.18-h+1e-9)?\"top\":\"bottom\"}); };\n" +
        "      _footFit(s,'*Holding periods measured to '+asOn+taxDateTag+' from each lot\\u2019s own purchase date, FIFO over '+T.txnCount+\n"
  },
  {
    label: 'class slide: the usual-bucket sentence is in the footnote (T5)',
    from: "(t.lockedCmv>1e-12?(' ELSS units still in lock-in ('+U.m(t.lockedCmv)+') are unclassified and not harvested.'):'')+_nsFoot+_srcFoot);\n",
    to: "(t.lockedCmv>1e-12?(' ELSS units still in lock-in ('+U.m(t.lockedCmv)+') are unclassified and not harvested.'):'')+_nsFoot+_ubFoot+_srcFoot);\n"
  },
  {
    label: 'holding-detail slide: what PMS and AIF rows show, truthfully and without a dash (T5)',
    from: "            'Holdings priced in rupees rather than units (PMS, unlisted AIF) show \\u2014 in the unit columns. '+\n",
    to: "            'Holdings matched on invested value show no units; PMS and AIF rows read Not split (Fund level for a Cat III AIF). '+\n"
  },
  {
    label: 'holding-detail slide: an unreconciled holding is not said to have no lot history (T5)',
    from: "            (T.unreconciled.length?(' '+T.unreconciled.length+' holding(s) with no lot history are unclassified and are not listed here.'):'')+\n",
    to: "            (T.unreconciled.length?(' '+T.unreconciled.length+' holding(s) not reconciled to the base file are unclassified and are not listed here.'):'')+\n"
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
        "        if(_ns.passThrough.n) _lo.push(_ns.passThrough.n+(_ptA?(' AIF'+(_ns.passThrough.n===1?'':'s')+' treated as Cat I/II'):(' Cat I/II AIF'+(_ns.passThrough.n===1?'':'s')))+' ('+U.m(_ns.passThrough.cmv)+')');\n" +
        "        if(_ns.fundLevel.n) _lo.push(_ns.fundLevel.n+' Cat III AIF'+(_ns.fundLevel.n===1?'':'s')+' ('+U.m(_ns.fundLevel.cmv)+')');\n"
  }
]);
