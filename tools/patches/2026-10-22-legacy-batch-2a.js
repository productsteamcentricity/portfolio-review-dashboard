/* ============================================================================
   2026-10-22 — legacy fix batch 2a: KI-124, OD-32, OD-34 (KI-112)
   Edits in the engine script (07_engine.js), the exporters script
   (08_exporters.js) and the UI script (11_app_ui.js). Applies after the
   2026-10-19 patches (it edits text the KI-061 patch wrote).

   KI-124  The Home tab's "Download slide" produced an empty deck.
     - UI ensureDlBtns: no download bar on Home (it has no slide).
     - UI slidePPTX: after buildPPTX, a deck with no slide (pptx.slides is empty) is
       refused for ANY tab: a warning on the status line, nothing written or
       downloaded. Home is not special-cased here; any tab whose deck comes out
       empty is caught the same way.

   OD-32 (owner decision, 21 Oct 2026)  Renamed fund houses count as the current house.
     - Engine AMC_RENAMED: idfc -> Bandhan; lt / landt / larsentoubro /
       larsenandtoubro -> HSBC; reliance / reliancenippon / reliancenipponlife ->
       Nippon India; dspblackrock -> DSP; birlasunlife / birlasl -> Aditya Birla Sun
       Life; iifl -> 360 ONE. Squashed spellings, as AMC_ALIAS (case, punctuation and
       the AMC_NOISE words ignored), added to AMC_HOUSE, so amcKey("IDFC") is the
       Bandhan key everywhere (AMC tab, AI Analyst cap, greedy fill, final cap,
       summary). amcFormer(label) tells a former name.
     - computeReview, one name per house: a house with a former name among its
       mutual-fund labels is named as the engine names it today (AMC_DISPLAY), even
       under a single label ("IDFC" alone shows "Bandhan"). Only mutual-fund-book rows
       are renamed (KI-061): a "Larsen & Toubro Ltd." stock or a PMS labelled "IIFL"
       keeps its own label and counts in no house. "IDFC First Bank" squashes to
       idfcfirstbank and is not an alias. amcDisplay() and the XLSX "Base File" sheet
       (the row's uploaded label) are unchanged.

   OD-34 (owner decision, 21 Oct 2026; KI-112)  Mutual-fund rows with no AMC label.
     - Engine amcKey: a label with no letter or digit ("", "  ", "-") gives "" (no
       house). KI-061 kept a lone "-" as its own house. So does a placeholder label
       (lead decision, 22 Oct 2026; AMC_PLACEHOLDER): "NA", "N/A", "N.A.", "Not
       Available", "Unknown", "Others", "Other", "-", "--", compared on the whole
       squashed label (case, spaces, punctuation and AMC_NOISE words ignored).
     - computeReview: such mutual-fund rows are named AMC_NOT_GIVEN ("AMC not
       given"); they stay in the mutual-fund book total (every house's % is still of
       the whole book) but are not a row of the house table, never a breach and never
       amc.max. model.amc.notGiven = { amc, count, cmv, pct, named, capSafe, note }
       (null when none); named is the share of the book the named houses cover;
       capSafe is true when the largest house would stay within the 20% cap even if
       it held every holding with no AMC; note is the footnote with the count and the
       share of the book.
     - Observations (engine) and the AMC slide insight (exporters INS.amc), after the
       financial review: with holdings that have no AMC, both give their share, and
       call the book well diversified only when capSafe. Otherwise they say that
       diversification cannot be confirmed; with no AMC on any mutual fund, that
       concentration by fund house cannot be assessed. Plain sentences: the insight's
       dashes become full stops for every book, and one breach reads "breaches".
     - aiaCompute: a house-table row with an empty key is skipped (no AMC given is
       never a house in amcPctOf / amcAfter / the final-cap map / the summary), so a
       top-up of such a fund is neither tested against nor booked to any house, its
       impact signal carries no house figure, and the largest AMC before / after is
       always a named house. A caveat carries the footnote.
     - AMC tab (UI), AMC slide and XLSX "AMC Allocation" sheet (exporters): an "AMC
       not given" bar / row in palette greyM (#BFBFBF), "Outside cap" in the breach
       column, and the footnote with the count (the slide's footer gets a short form
       of it). The AI Analyst shows those rows' AMC as "AMC not given" through
       h.amcDisplay.

     node tools/patches/2026-10-22-legacy-batch-2a.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

/* the engine's Observations, "1c. AMC Allocation", as it stands before this patch (reused verbatim below) */
const OBS_1C = [
  '    // ============ 1c. CURRENT PORTFOLIO — AMC Allocation ============',
  '    if (amcBreaches.length){',
  '      CP.amcAllocation.push(amcBreaches.map(function(b){return b.amc+" ("+pct2(b.pct)+")";}).join(" and ")+" breach"+(amcBreaches.length>1?"":"es")+" Centricity\'s 20% per-AMC cap of the mutual-fund book.");',
  '      var _destCP=amcRows.filter(function(r){return !r.breach && r.pct>0 && r.amc && String(r.amc).trim();}).slice(0,3).map(function(r){return r.amc;});',
  '      if (_destCP.length){',
  '        CP.amcAllocation.push("Trimming "+amcBreaches.map(function(b){return b.amc;}).join(" and ")+" back toward the 20% cap and redeploying into other quality houses already held ("+_destCP.join(", ")+") would reduce house-level concentration without disturbing the asset mix.");',
  '      }',
  '    } else if (amcRows.length){',
  '      CP.amcAllocation.push("No single fund house exceeds Centricity\'s 20% per-AMC cap (largest is "+amcRows[0].amc+" at "+pct2(amcRows[0].pct)+"), indicating well-diversified AMC exposure across the mutual-fund book.");',
  '    }',
  ''
];
/* the breach sentence, followed by the share with no AMC when there is one */
const OBS_BREACH = OBS_1C[2].replace('cap of the mutual-fund book.");',
  'cap of the mutual-fund book."+(_ngCP?" "+_ngSay:""));   /* OD-34: the share with no AMC */');
if (OBS_BREACH === OBS_1C[2]) throw new Error('the breach sentence of OBS_1C was not found');
/* the exporters' AMC slide insight before this patch */
const INS_AMC = '      o.amc=model.amc.breaches.length?(model.amc.breaches.map(function(b){return b.amc+" ("+b.pct.toFixed(2)+"%)";}).join(", ")+" breach the 20% per-AMC cap — trimming toward the cap reduces house-level concentration."):("AMC exposure is well diversified — the largest fund house is "+(model.amc.max?model.amc.max.amc+" at "+model.amc.max.pct.toFixed(2)+"%":"—")+", within the 20% per-AMC cap.");\n';

applyPatch('Legacy fix batch 2a (KI-124, OD-32, OD-34)', [
  /* ---------------- engine (07): the house key ---------------- */
  {
    label: 'OD-32 AMC_RENAMED (former house names) and OD-34 AMC_NOT_GIVEN, after AMC_ALIAS',
    from: '    adityabirlasl:"aditya", icicipru:"icici", kotakmahindra:"kotak", nipponlife:"nippon" };\n',
    to: [
      '    adityabirlasl:"aditya", icicipru:"icici", kotakmahindra:"kotak", nipponlife:"nippon" };',
      '  /* OD-32 (owner decision, 21 Oct 2026): a fund house\'s FORMER name counts as its current',
      '     house, on the same squashed spelling as AMC_ALIAS: IDFC -> Bandhan; L&T (L and T,',
      '     Larsen & Toubro MF) -> HSBC; Reliance (Reliance Nippon Life) -> Nippon India; DSP',
      '     BlackRock -> DSP; Birla Sun Life (Birla SL) -> Aditya Birla Sun Life; IIFL -> 360 ONE.',
      '     A mutual-fund row under a former name is shown under the current name (computeReview);',
      '     a row outside the mutual-fund book keeps its own label (KI-061), so a "Larsen & Toubro',
      '     Ltd." stock is never renamed. "IDFC First Bank" squashes to idfcfirstbank: not an alias. */',
      '  var AMC_RENAMED = { idfc:"bandhan", lt:"hsbc", landt:"hsbc", larsentoubro:"hsbc", larsenandtoubro:"hsbc",',
      '    reliance:"nippon", reliancenippon:"nippon", reliancenipponlife:"nippon", dspblackrock:"dsp",',
      '    birlasunlife:"aditya", birlasl:"aditya", iifl:"360" };',
      '  /* OD-34: the name shown for mutual-fund rows that carry no AMC label */',
      '  var AMC_NOT_GIVEN = "AMC not given";',
      '  /* OD-34 (lead decision, 22 Oct 2026): placeholder labels that also mean no AMC was given:',
      '     "NA", "N/A", "N.A.", "Not Available", "Unknown", "Others", "Other" ("-" and "--" have no',
      '     letter or digit at all). Compared on the whole squashed label, as AMC_ALIAS is (case,',
      '     spaces, punctuation and the AMC_NOISE words ignored), so "n/a" and "N. A." are alike; a',
      '     label with any other word ("Unknown Opportunities", "Other Distributor") is not one. */',
      '  var AMC_PLACEHOLDER = { na:1, notavailable:1, unknown:1, others:1, other:1 };',
      ''
    ].join('\n')
  },
  {
    label: 'OD-32 the house map takes the former names; OD-34 a label with no letter or digit names no house',
    from: [
      '    Object.keys(AMC_ALIAS).forEach(function(a){ AMC_HOUSE[a] = AMC_HOUSE[AMC_ALIAS[a]]; });',
      '  })();',
      '  function amcKey(tok){',
      '    var s = amcSquash(tok);',
      '    if (!s) return String(tok==null?"":tok).trim();        /* "" stays "", a lone "-" stays itself */',
      ''
    ].join('\n'),
    to: [
      '    Object.keys(AMC_ALIAS).forEach(function(a){ AMC_HOUSE[a] = AMC_HOUSE[AMC_ALIAS[a]]; });',
      '    Object.keys(AMC_RENAMED).forEach(function(a){ AMC_HOUSE[a] = AMC_HOUSE[AMC_RENAMED[a]]; });   /* OD-32 */',
      '  })();',
      '  /* OD-32: true when a label is a fund house\'s former name */',
      '  function amcFormer(tok){ return Object.prototype.hasOwnProperty.call(AMC_RENAMED, amcSquash(tok)); }',
      '  function amcKey(tok){',
      '    var s = amcSquash(tok);',
      '    /* OD-34: no letter or digit ("", "  ", "-"), or a placeholder ("N/A", "Unknown"): no AMC given, no house */',
      '    if (!s || AMC_PLACEHOLDER.hasOwnProperty(s)) return "";',
      ''
    ].join('\n')
  },

  /* ---------------- engine (07): the AMC tab model ---------------- */
  {
    label: 'OD-32/OD-34 one name per house: a former name takes the current name; no AMC is "AMC not given"',
    from: [
      '      var seen = Object.create(null), nameOf = Object.create(null);',
      '      rows.forEach(function(h){',
      '        if (!h.mfBook) return;',
      '        var g = seen[h.amcKey] || (seen[h.amcKey] = Object.create(null));',
      '        g[h.amcDisplay] = (g[h.amcDisplay] || 0) + (h.cmvCr || 0);',
      '      });',
      '      Object.keys(seen).forEach(function(k){',
      '        var g = seen[k], names = Object.keys(g);',
      '        if (names.length < 2) return;',
      '        nameOf[k] = Object.prototype.hasOwnProperty.call(AMC_DISPLAY, k) ? AMC_DISPLAY[k]',
      '          : names.sort(function(a, b){ return (g[b] - g[a]) || (a < b ? -1 : (a > b ? 1 : 0)); })[0];',
      '      });',
      '      rows.forEach(function(h){ if (h.mfBook && (h.amcKey in nameOf)) h.amcDisplay = nameOf[h.amcKey]; });'
    ].join('\n'),
    to: [
      '      /* OD-32: a house with a former name (AMC_RENAMED) among its mutual-fund labels is',
      '         named as the engine names it today (AMC_DISPLAY), even under a single label.',
      '         OD-34: mutual-fund rows with no AMC label are no house: they are named',
      '         AMC_NOT_GIVEN and kept out of the house table below. */',
      '      var seen = Object.create(null), nameOf = Object.create(null), former = Object.create(null);',
      '      rows.forEach(function(h){',
      '        if (!h.mfBook || !h.amcKey) return;',
      '        var g = seen[h.amcKey] || (seen[h.amcKey] = Object.create(null));',
      '        g[h.amcDisplay] = (g[h.amcDisplay] || 0) + (h.cmvCr || 0);',
      '        if (amcFormer(h.amc)) former[h.amcKey] = 1;',
      '      });',
      '      Object.keys(seen).forEach(function(k){',
      '        var g = seen[k], names = Object.keys(g);',
      '        if (names.length < 2 && !former[k]) return;',
      '        nameOf[k] = Object.prototype.hasOwnProperty.call(AMC_DISPLAY, k) ? AMC_DISPLAY[k]',
      '          : names.sort(function(a, b){ return (g[b] - g[a]) || (a < b ? -1 : (a > b ? 1 : 0)); })[0];',
      '      });',
      '      rows.forEach(function(h){',
      '        if (!h.mfBook) return;',
      '        if (!h.amcKey){ h.amcDisplay = AMC_NOT_GIVEN; return; }       /* OD-34 */',
      '        if (h.amcKey in nameOf) h.amcDisplay = nameOf[h.amcKey];',
      '      });'
    ].join('\n')
  },
  {
    label: 'OD-34 house table: a row with no AMC is in the book total but in no house',
    from: [
      '    var amcMap=Object.create(null), amcName=Object.create(null), amcOrder=[], mfTotal=0;',
      '    rows.forEach(function(h){',
      '      if (h.mfBook){',
      '        var ak=h.amcKey;',
      '        if (!(ak in amcMap)){ amcMap[ak]=0; amcName[ak]=h.amcDisplay; amcOrder.push(ak); }',
      '        amcMap[ak]+=h.cmvCr; mfTotal+=h.cmvCr;',
      '      }',
      '    });'
    ].join('\n'),
    to: [
      '    /* OD-34: a mutual-fund row with no AMC counts in the book (every house\'s % is of the',
      '       whole mutual-fund book) but in no house; it is reported apart as amc.notGiven */',
      '    var amcMap=Object.create(null), amcName=Object.create(null), amcOrder=[], mfTotal=0, ngCmv=0, ngN=0;',
      '    rows.forEach(function(h){',
      '      if (h.mfBook){',
      '        var ak=h.amcKey;',
      '        if (!ak){ ngCmv+=h.cmvCr; ngN++; mfTotal+=h.cmvCr; return; }',
      '        if (!(ak in amcMap)){ amcMap[ak]=0; amcName[ak]=h.amcDisplay; amcOrder.push(ak); }',
      '        amcMap[ak]+=h.cmvCr; mfTotal+=h.cmvCr;',
      '      }',
      '    });'
    ].join('\n')
  },
  {
    label: 'OD-34 amc.notGiven: count, value, share of the book and the footnote',
    from: '    var amcBreaches=amcRows.filter(function(r){return r.breach;});\n',
    to: [
      '    var amcBreaches=amcRows.filter(function(r){return r.breach;});',
      '    var amcNotGiven = null;                                          /* OD-34 */',
      '    if (ngN){',
      '      var ngPct = mfTotal ? ngCmv/mfTotal*100 : 0, ngMany = ngN > 1, ngNamed = 0;',
      '      amcRows.forEach(function(r){ ngNamed += r.pct; });',
      '      /* named: the share of the book the named houses cover. capSafe: the largest house would',
      '         stay within the 20% cap even if it held every holding with no AMC (a breach is above',
      '         20.0%, on the same CMV arithmetic); only then is the book called well diversified */',
      '      amcNotGiven = { amc:AMC_NOT_GIVEN, count:ngN, cmv:ngCmv, pct:ngPct, named:ngNamed,',
      '        capSafe: mfTotal ? (((amcRows.length ? amcRows[0].cmv : 0) + ngCmv)/mfTotal*100 <= 20.0) : false,',
      '        note: AMC_NOT_GIVEN+": "+ngN+" mutual-fund holding"+(ngMany?"s":"")+" ("+(Math.round(ngPct*100)/100).toFixed(2)+',
      '          "% of the mutual-fund book) "+(ngMany?"have":"has")+" no AMC in the base file. "+(ngMany?"They are":"It is")+',
      '          " shown separately, outside every fund house\'s 20% cap, and counted in no house\'s share." };',
      '    }',
      ''
    ].join('\n')
  },
  {
    label: 'OD-34 model.amc carries notGiven',
    from: 'amc:{rows:amcRows, mfTotal:mfTotal, breaches:amcBreaches, max:amcRows[0]||null},',
    to: 'amc:{rows:amcRows, mfTotal:mfTotal, breaches:amcBreaches, max:amcRows[0]||null, notGiven:amcNotGiven},   /* OD-34 */'
  },
  {
    label: 'OD-34 Observations: the AMC sentence gives the share with no AMC; "well diversified" only when capSafe',
    from: OBS_1C.join('\n'),
    to: [
      OBS_1C[0],
      '    /* OD-34 (financial review of fix batch 2a): with mutual-fund holdings that carry no AMC, the',
      '       sentences give their share, and call the book well diversified only when amcNotGiven.capSafe',
      '       (the largest house would stay within the cap even if it held all of them). */',
      '    var _ngCP = (amcNotGiven && amcNotGiven.count) ? amcNotGiven : null, _ngMany = !!_ngCP && _ngCP.count > 1;',
      '    var _ngSay = _ngCP ? (AMC_NOT_GIVEN+": "+_ngCP.count+" mutual-fund holding"+(_ngMany?"s":"")+" ("+pct2(_ngCP.pct)+" of the mutual-fund book) "+' +
        '(_ngMany?"have":"has")+" no AMC in the base file and "+(_ngMany?"are":"is")+" counted in no fund house\'s share.") : "";',
      OBS_1C[1],
      OBS_BREACH,
      OBS_1C[3], OBS_1C[4], OBS_1C[5], OBS_1C[6],
      '    } else if (amcRows.length && !_ngCP){',
      OBS_1C[8],
      '    } else if (amcRows.length){',
      '      CP.amcAllocation.push("No named fund house exceeds Centricity\'s 20% per-AMC cap (largest is "+amcRows[0].amc+" at "+pct2(amcRows[0].pct)+"). The named houses cover "+' +
        'pct2(_ngCP.named)+" of the mutual-fund book and "+pct2(_ngCP.pct)+" ("+_ngCP.count+" holding"+(_ngMany?"s":"")+") has no AMC in the base file. "+',
      '        (_ngCP.capSafe ? "Even if all of it belonged to the largest house, that house would stay within the cap, so AMC exposure across the mutual-fund book is well diversified."',
      '                       : "AMC diversification cannot be confirmed until those holdings carry an AMC in the base file."));',
      '    } else if (_ngCP){',
      '      CP.amcAllocation.push((_ngMany ? "None of the "+_ngCP.count+" mutual-fund holdings has an AMC" : "The only mutual-fund holding has no AMC")+" in the base file ("+AMC_NOT_GIVEN+", "+' +
        'pct2(_ngCP.pct)+" of the mutual-fund book), so concentration by fund house cannot be assessed against Centricity\'s 20% per-AMC cap.");',
      '    }',
      ''
    ].join('\n')
  },

  /* ---------------- engine (07): the AI Analyst ---------------- */
  {
    label: 'OD-34 aiaCompute: a house-table row with no key is never a house',
    from: [
      '      var k = (r.key != null) ? r.key : amcKey(r.amc);',
      '      amcPctOf[k] = r.pct; amcCmvOf[k] = r.cmv || 0; amcNameOf[k] = r.amc; });'
    ].join('\n'),
    to: [
      '      var k = (r.key != null) ? r.key : amcKey(r.amc);',
      '      if (!k) return;                              /* OD-34: no AMC given is never a house */',
      '      amcPctOf[k] = r.pct; amcCmvOf[k] = r.cmv || 0; amcNameOf[k] = r.amc; });'
    ].join('\n')
  },
  {
    label: 'OD-34 aiaCompute: a caveat with the count and the footnote',
    from: '    out.caveats.push("This is a draft for the adviser to review, not an instruction.',
    to: [
      '    /* OD-34: the mutual-fund rows with no AMC, counted, outside every house */',
      '    if (model.amc && model.amc.notGiven && model.amc.notGiven.count)',
      '      out.caveats.push(model.amc.notGiven.note + " The plan neither tests nor books them against any fund house, and the largest-AMC figures leave them out.");',
      '    out.caveats.push("This is a draft for the adviser to review, not an instruction.'
    ].join('\n')
  },

  /* ---------------- exporters (08) ---------------- */
  {
    label: 'OD-34 AMC slide insight: the share with no AMC; "well diversified" only when capSafe; plain sentences',
    from: INS_AMC,
    to: [
      '      /* OD-34 (financial review of fix batch 2a): with mutual funds that carry no AMC, the insight gives',
      '         their share and says "well diversified" only when model.amc.notGiven.capSafe (the largest house',
      '         would stay within the cap even if it held all of them). Plain sentences, no dashes. */',
      '      o.amc=(function(){',
      '        var a=model.amc, mx=a.max, ng=(a.notGiven&&a.notGiven.count)?a.notGiven:null, many=!!ng&&ng.count>1;',
      '        var ngN=ng?(ng.count+" holding"+(many?"s":"")):"", p2=function(x){ return (Math.round(x*100)/100).toFixed(2); };   /* as the bar and the note round */',
      '        if(a.breaches.length) return a.breaches.map(function(b){return b.amc+" ("+b.pct.toFixed(2)+"%)";}).join(", ")+" breach"+(a.breaches.length>1?"":"es")+' +
        '" the 20% per-AMC cap. Trimming toward the cap reduces house-level concentration."+(ng?(" AMC not given: "+p2(ng.pct)+"% of the mutual-fund book ("+ngN+") has no AMC in the base file."):"");',
      '        if(!ng) return "AMC exposure is well diversified. The largest fund house is "+(mx?mx.amc+" at "+mx.pct.toFixed(2)+"%":"—")+", within the 20% per-AMC cap.";',
      '        if(!a.rows.length) return (many?"None of the "+ng.count+" mutual-fund holdings has an AMC":"The only mutual-fund holding has no AMC")+" in the base file (AMC not given, "+' +
        'p2(ng.pct)+"% of the mutual-fund book), so concentration by fund house cannot be assessed.";',
      '        if(ng.capSafe) return "AMC exposure is well diversified. The largest fund house is "+mx.amc+" at "+mx.pct.toFixed(2)+"%, within the 20% per-AMC cap even if it held all "+' +
        'p2(ng.pct)+"% of the mutual-fund book that has no AMC in the base file ("+ngN+").";',
      '        return "The largest named fund house is "+mx.amc+" at "+mx.pct.toFixed(2)+"%, within the 20% per-AMC cap, and the named houses cover "+p2(ng.named)+' +
        '"% of the mutual-fund book. AMC not given: "+p2(ng.pct)+"% ("+ngN+") has no AMC in the base file, so diversification across fund houses cannot be confirmed.";',
      '      })();',
      ''
    ].join('\n')
  },
  {
    label: 'OD-34 AMC slide: a grey "AMC not given" bar at the foot of the chart',
    from: 'var labels=rows.map(function(r){return r.amc;}), vals=rows.map(function(r){return Math.round(r.pct*100)/100;}), cols=rows.map(function(r){return r.breach?C.red:C.gold;});',
    to: 'var labels=rows.map(function(r){return r.amc;}), vals=rows.map(function(r){return Math.round(r.pct*100)/100;}), cols=rows.map(function(r){return r.breach?C.red:C.gold;});\n' +
        '      /* OD-34: mutual funds with no AMC, one grey bar below the houses (the chart draws the first category at the bottom) */\n' +
        '      var ng=model.amc.notGiven; if(ng&&ng.count){ labels.unshift(ng.amc); vals.unshift(Math.round(ng.pct*100)/100); cols.unshift(C.greyM); }'
  },
  {
    label: 'OD-34 AMC slide footer: the count of holdings with no AMC',
    from: 'foot(s, "Weights normalised to the Mutual Fund book (100%). Per-AMC cap = 20.00%; breaches shown in red. Portfolio as on "+model.meta.asOnDate+".");',
    to: 'foot(s, "Weights normalised to the Mutual Fund book (100%). Per-AMC cap = 20.00%; breaches shown in red."+((ng&&ng.count)?(" AMC not given (grey): "+ng.count+" mutual-fund holding"+(ng.count>1?"s":"")+" with no AMC in the base file, outside every house\'s cap."):"")+" Portfolio as on "+model.meta.asOnDate+".");   /* OD-34 */'
  },
  {
    label: 'OD-34 XLSX "AMC Allocation": an "AMC not given" row and the footnote',
    from: 'model.amc.rows.forEach(function(r){ am.push([r.amc,r.pct,model.unit.v(r.cmv),r.breach?"YES":"No"]); });',
    to: 'model.amc.rows.forEach(function(r){ am.push([r.amc,r.pct,model.unit.v(r.cmv),r.breach?"YES":"No"]); });\n' +
        '    /* OD-34: the mutual funds with no AMC, outside every house\'s cap, and the footnote with the count */\n' +
        '    var amNg=model.amc.notGiven; if(amNg&&amNg.count){ am.push([amNg.amc,amNg.pct,model.unit.v(amNg.cmv),"Outside cap"]); am.push([]); am.push([amNg.note]); }'
  },

  /* ---------------- UI (11) ---------------- */
  {
    label: 'KI-124 ensureDlBtns: no download bar on Home',
    from: "      var s=document.getElementById('s-'+t[0]); if(s && !s.querySelector('.dlslide-bar')) s.insertAdjacentHTML('afterbegin', dlBar(t[0])); });",
    to: "      if(t[0]==='home') return;   /* KI-124: Home has no slide, so it gets no download bar */\n" +
        "      var s=document.getElementById('s-'+t[0]); if(s && !s.querySelector('.dlslide-bar')) s.insertAdjacentHTML('afterbegin', dlBar(t[0])); });"
  },
  {
    label: 'KI-124 slidePPTX: a deck with no slide is refused, for any tab',
    from: '      var p=E.buildPPTX(mdl,Ppt,tabKey);\n',
    to: [
      '      var p=E.buildPPTX(mdl,Ppt,tabKey);',
      '      /* KI-124: a deck that would hold no slide is never written or downloaded, whatever the tab */',
      "      if(p&&p.slides&&p.slides.length===0){ setStatus('Nothing to download: the <b>'+tabLabel(tabKey)+'</b> tab has no slide.',true); return; }",
      ''
    ].join('\n')
  },
  {
    label: 'OD-34 AMC tab: the note gives the count of holdings with no AMC',
    from: "      : 'No AMC exceeds the 20% per-AMC cap (largest: '+(m.amc.max?m.amc.max.amc+' at '+m.amc.max.pct.toFixed(2)+'%':'—')+').';",
    to: "      : 'No AMC exceeds the 20% per-AMC cap (largest: '+(m.amc.max?m.amc.max.amc+' at '+m.amc.max.pct.toFixed(2)+'%':'—')+').';\n" +
        "    var ng=m.amc.notGiven; if(ng&&ng.count) note+='<br>'+ng.note;   /* OD-34: count and footnote */"
  },
  {
    label: 'OD-34 AMC tab: a grey "AMC not given" bar after the houses',
    from: "    var colors=m.amc.rows.map(function(r){return r.breach?'#931621':'#BD9568';});",
    to: "    var colors=m.amc.rows.map(function(r){return r.breach?'#931621':'#BD9568';});\n" +
        "    if(ng&&ng.count){ labels.push(ng.amc); data.push(+ng.pct.toFixed(2)); colors.push('#BFBFBF'); }   /* OD-34: palette greyM, never a breach */"
  }
]);
