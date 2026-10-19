/* ============================================================================
   2026-10-19 — AI Analyst AMC bookkeeping (audit of 19 Oct 2026, fix batch 1b)
   Edits are in the engine script (07_engine.js), plus one column of the XLSX
   "Base File" sheet and the AI Analyst slide's largest-AMC row in the exporters
   script (08_exporters.js) and the AI Analyst tab's largest-AMC line in the UI
   script (11_app_ui.js).

   KI-061 (NEW-15)  One canonical key per fund house.
     A held fund's house was its base-file label run through amcDisplay ("PPFAS",
     "HDFC Mutual Fund" are not in AMC_DISPLAY, so they stayed as typed); a
     destination the portfolio does not hold was named off its scheme name
     ("Parag Parikh ..." -> "PPFAS (Parag Parikh)", "HDFC ..." -> "HDFC"). Every
     AMC total and the 20% house cap were keyed by those names, so they never met:
     the plan put a 10% new position into a house already at 19% (19% -> 29% of
     CMV) and the summary still read 19%. Mixed labels also split the AMC tab.
     - amcKey(label): lower case, punctuation dropped, the words "mutual fund(s)",
       "mf", "amc", "asset(s)", "management/mgmt", "investment(s)", "manager(s)",
       "company/co", "ltd/limited", "pvt/private" dropped; a house AMC_DISPLAY lists
       resolves to its first token there (from any of its tokens, its display name,
       the aliases ppfas / paragparikh / absl / adityabirla / adityabirlasl /
       icicipru / kotakmahindra / nipponlife, or its name followed by "India");
       any other label resolves to its squashed words. Exposed as ENGINE.amcKey.
       (The alias and noise-word lists go to the owner under OD-5.)
     - computeReview: every row gets h.amcKey, and h.mfBook, the same _isMFbook
       product test that builds the AMC tab. A house that appears under several
       labels in the mutual-fund book shows one name on its mutual-fund-book rows
       (the AMC_DISPLAY name, or for an unlisted house the label carrying the most
       mutual-fund CMV, ties alphabetical); a house under one label keeps it. Rows
       outside the mutual-fund book (PMS, AIF, SIF, stocks, bonds) are never
       renamed: they keep amcDisplay(their own label). The AMC tab groups by the
       key, in first-seen order as before, and each row also carries `key`.
     - aiaCompute: amcPctOf, amcAfter, the final-cap `live` map and the summary are
       keyed by the house key; destinations carry amcKey beside their display `amc`.
       A house's figures are mutual-fund book only (its starting % is the AMC tab's),
       so only mutual-fund-book positions (g.mfBook) move them: their releases, the
       degraded-Exit restore, the final-cap map and the impact signal's house figure.
       A top-up of a holding outside the mutual-fund book (pool A) has no house
       (amcKey "") and is neither tested against nor booked to one. Without this a
       PMS / AIF / stock release freed room in a fund house it shares a key with
       (a 2 Cr "HDFC Asset Management Company Ltd." stock trim let HDFC funds go
       from 1.50 to 2.50 Cr, 31.25% of the mutual-fund book). No cap basis changes
       (KI-004 / OD-1 open).
       aiaAmcOfName reads a scheme's house as the longest run of its leading WORDS
       whose key is a house in the portfolio (named as on the AMC tab), else a house
       AMC_DISPLAY lists, else its first word as before (whole words: "Quantum" is
       never Quant). Summary names and their tie order (alphabetical by name) are
       as before.
     - XLSX "Base File" sheet: the AMC column is unchanged from main: the display
       name of the row's OWN uploaded label, ENGINE.amcDisplay(h.amc) (it read
       h.amcDisplay, which the one-name-per-house rule now rewrites, so a
       "HDFC Mutual Fund" row would have been exported as "HDFC").
   KI-062 (NEW-16)  A degraded Exit keeps its bookkeeping. BOOKKEEPING ONLY: whether a
     degraded Exit should release anything is owner decision OD-14 and is unchanged.
     - The degrade block (HARD RULE 2) now sets destinations to [], unfunded to the
       reduced release (0 when it drops to Retain), and gives the house's running
       amcAfter back the part of the exit it no longer releases (mutual-fund-book
       positions only, as above).
     - The final cap enforcement returns its `live` map, and the summary's largest
       AMC after is read off it (final releases, destinations after any cap cut),
       on the basis that figure has always used (KI-004 open): the house's AMC-tab %
       moved by its net flow / total CMV.
   KI-120 (QA of this batch; also on main)  The largest-AMC line named the wrong
     house for the before figure: "largest AMC (360 ONE) 51.64% → 38.08%", where
     51.64% is the house largest BEFORE the plan (summary.amcBeforeWho, Aditya Birla
     Sun Life) and only 38.08% is 360 ONE's (amcAfterWho). When the two houses
     differ, each figure is now named with its own house: on the AI Analyst tab
     (UI, 11) "largest AMC Aditya Birla Sun Life 51.64% → 360 ONE 38.08%", and on
     the AI Analyst slide (exporters, 08) the row "Largest AMC concentration
     (before: Aditya Birla Sun Life; after: 360 ONE)" | 51.64% | 38.08%. One house
     before and after is named once, as before. The engine's caveat ("RAISES ...
     from x% (before house) to y% (after house)", also in the XLSX AI Analyst
     sheet) already named each figure's own house and is unchanged.

     node tools/patches/2026-10-19-ai-analyst-amc-bookkeeping.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('AI Analyst AMC bookkeeping (KI-061, KI-062, KI-120)', [
  /* ---------------- KI-061: the key function ---------------- */
  {
    label: 'KI-061 amcKey: one canonical key per fund house (after amcDisplay)',
    from: [
      '  function amcDisplay(tok){',
      '    var k = String(tok||"").toLowerCase().replace(/[^a-z0-9]/g,"");',
      '    return AMC_DISPLAY[k] || String(tok||"").trim();',
      '  }',
      ''
    ].join('\n'),
    to: [
      '  function amcDisplay(tok){',
      '    var k = String(tok||"").toLowerCase().replace(/[^a-z0-9]/g,"");',
      '    return AMC_DISPLAY[k] || String(tok||"").trim();',
      '  }',
      '  /* ---------- KI-061: one canonical key per fund house ----------',
      '     A base file may name one house "HDFC", "HDFC Mutual Fund" or "HDFC MF", and',
      '     PPFAS "PPFAS" or "Parag Parikh"; a scheme the portfolio does not hold is',
      '     named off its own scheme name. Every AMC total and the 20% house cap are',
      '     keyed by amcKey(), never by a label: case, punctuation and the AMC_NOISE',
      '     words are ignored; a house AMC_DISPLAY lists resolves to its first token',
      '     there (from any of its tokens, its display name, an AMC_ALIAS spelling, or',
      '     its name followed by "India"); any other label to its squashed words.',
      '     Display names are not changed by this. The alias and noise-word lists are',
      '     owner-approved additions (OD-5). */',
      '  var AMC_NOISE = { mutual:1, fund:1, funds:1, mf:1, amc:1, asset:1, assets:1, management:1, mgmt:1,',
      '    investment:1, investments:1, manager:1, managers:1, company:1, co:1, ltd:1, limited:1, pvt:1, private:1 };',
      '  var AMC_ALIAS = { ppfas:"parag", paragparikh:"parag", absl:"aditya", adityabirla:"aditya",',
      '    adityabirlasl:"aditya", icicipru:"icici", kotakmahindra:"kotak", nipponlife:"nippon" };',
      '  function amcSquash(s){',
      '    var w = String(s==null?"":s).toLowerCase().replace(/[^a-z0-9]+/g," ").trim().split(" ");',
      '    var kept = w.filter(function(t){ return t && !AMC_NOISE.hasOwnProperty(t); });',
      '    return (kept.length ? kept : w).join("");',
      '  }',
      '  var AMC_HOUSE = Object.create(null);',
      '  (function(){',
      '    var first = Object.create(null);',
      '    Object.keys(AMC_DISPLAY).forEach(function(k){',
      '      var d = AMC_DISPLAY[k]; if (!(d in first)) first[d] = k; AMC_HOUSE[k] = first[d]; });',
      '    Object.keys(AMC_DISPLAY).forEach(function(k){',
      '      var s = amcSquash(AMC_DISPLAY[k]); if (s && !(s in AMC_HOUSE)) AMC_HOUSE[s] = AMC_HOUSE[k]; });',
      '    Object.keys(AMC_ALIAS).forEach(function(a){ AMC_HOUSE[a] = AMC_HOUSE[AMC_ALIAS[a]]; });',
      '  })();',
      '  function amcKey(tok){',
      '    var s = amcSquash(tok);',
      '    if (!s) return String(tok==null?"":tok).trim();        /* "" stays "", a lone "-" stays itself */',
      '    if (s in AMC_HOUSE) return AMC_HOUSE[s];',
      '    if (s.length > 5 && s.slice(-5) === "india" && (s.slice(0, -5) in AMC_HOUSE)) return AMC_HOUSE[s.slice(0, -5)];',
      '    return s;',
      '  }',
      ''
    ].join('\n')
  },
  {
    label: 'KI-061 computeReview: every row carries its house key',
    from: '      h.amcDisplay = amcDisplay(h.amc);\n',
    to: '      h.amcDisplay = amcDisplay(h.amc);\n      h.amcKey = amcKey(h.amc);                /* KI-061: the house, whatever the label */\n'
  },
  {
    label: 'KI-061 AMC tab: MF-book flag on every row; one row and one name per house',
    from: [
      '    var amcMap={}, mfTotal=0;',
      '    rows.forEach(function(h){',
      '      if (_isMFbook(h.product)){',
      '        amcMap[h.amcDisplay]=(amcMap[h.amcDisplay]||0)+h.cmvCr; mfTotal+=h.cmvCr;',
      '      }',
      '    });',
      '    var amcRows=Object.keys(amcMap).map(function(a){',
      '      var pct=mfTotal? amcMap[a]/mfTotal*100 : 0;',
      '      return {amc:a,cmv:amcMap[a],pct:pct,breach:pct>20.0};',
      '    }).sort(function(x,y){return y.pct-x.pct;});'
    ].join('\n'),
    to: [
      '    /* KI-061: every row records whether it is in the mutual-fund book, by the test',
      '       that builds this tab. A fund house\'s figures (this tab, and the AI Analyst\'s',
      '       house cap) are mutual-fund book only, so only these rows move them: a PMS,',
      '       AIF, SIF or stock that shares a house\'s name never frees or takes its room. */',
      '    rows.forEach(function(h){ h.mfBook = _isMFbook(h.product); });',
      '    /* KI-061: one fund house, one row and one name. Rows are grouped by amcKey, so',
      '       "HDFC" and "HDFC Mutual Fund" (or "PPFAS" and "Parag Parikh") are one house. A',
      '       house under one label keeps that label as its name; a house under several shows',
      '       the engine\'s own name for it (AMC_DISPLAY) or, for a house the engine does not',
      '       list, the label carrying the most mutual-fund market value (ties alphabetical).',
      '       Only mutual-fund-book rows take part and are renamed, so the AI Analyst and',
      '       the AMC tab agree; a row outside the book keeps amcDisplay(its own label). */',
      '    (function(){',
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
      '      rows.forEach(function(h){ if (h.mfBook && (h.amcKey in nameOf)) h.amcDisplay = nameOf[h.amcKey]; });',
      '    })();',
      '    var amcMap=Object.create(null), amcName=Object.create(null), amcOrder=[], mfTotal=0;',
      '    rows.forEach(function(h){',
      '      if (h.mfBook){',
      '        var ak=h.amcKey;',
      '        if (!(ak in amcMap)){ amcMap[ak]=0; amcName[ak]=h.amcDisplay; amcOrder.push(ak); }',
      '        amcMap[ak]+=h.cmvCr; mfTotal+=h.cmvCr;',
      '      }',
      '    });',
      '    var amcRows=amcOrder.map(function(a){',
      '      var pct=mfTotal? amcMap[a]/mfTotal*100 : 0;',
      '      return {amc:amcName[a],key:a,cmv:amcMap[a],pct:pct,breach:pct>20.0};',
      '    }).sort(function(x,y){return y.pct-x.pct;});'
    ].join('\n')
  },

  /* ---------------- KI-061: the AI Analyst ---------------- */
  {
    label: 'KI-061 aiaAmcOfName: the house of a scheme, by key, on whole leading words',
    from: [
      '  function aiaAmcOfName(name, model, known){',
      '    var i, h;',
      '    for (i = 0; i < model.holdings.length; i++){',
      '      h = model.holdings[i];',
      '      if (h.name === name || h.perfKey === name) return { amc: h.amcDisplay, from: "holding" };',
      '    }',
      '    var lc = String(name || "").toLowerCase(), best = "", bl = 0;',
      '    for (i = 0; i < known.length; i++){',
      '      var k = String(known[i] || "").toLowerCase();',
      '      if (k && k.length > bl && lc.indexOf(k) === 0){ best = known[i]; bl = k.length; }',
      '    }',
      '    if (best) return { amc: best, from: "portfolio" };'
    ].join('\n'),
    to: [
      '  /* KI-061: the house key of a holding or position */',
      '  function aiaAmcKeyOf(h){',
      '    if (!h) return "";',
      '    return h.amcKey != null ? h.amcKey : amcKey(h.amc != null ? h.amc : h.amcDisplay);',
      '  }',
      '  function aiaAmcOfName(name, model, known){',
      '    var i, h;',
      '    for (i = 0; i < model.holdings.length; i++){',
      '      h = model.holdings[i];',
      '      if (h.name === name || h.perfKey === name) return { amc: h.amcDisplay, key: aiaAmcKeyOf(h), from: "holding" };',
      '    }',
      '    /* KI-061: the house is the longest run of leading WORDS of the name whose amcKey',
      '       is a house in this portfolio (known: key -> its AMC-tab name), else a house',
      '       AMC_DISPLAY lists; whole words, so "Quantum ..." is never read as Quant */',
      '    var w = String(name || "").split(/[^A-Za-z0-9]+/).filter(function(t){ return !!t; });',
      '    var n, ck, own = Object.prototype.hasOwnProperty;',
      '    for (n = Math.min(w.length, 6); n >= 1; n--){',
      '      ck = amcKey(w.slice(0, n).join(" "));',
      '      if (ck && own.call(known, ck)) return { amc: known[ck], key: ck, from: "portfolio" };',
      '    }',
      '    for (n = Math.min(w.length, 6); n >= 1; n--){',
      '      ck = amcKey(w.slice(0, n).join(" "));',
      '      if (ck && own.call(AMC_DISPLAY, ck)) return { amc: AMC_DISPLAY[ck], key: ck, from: "name" };',
      '    }'
    ].join('\n')
  },
  {
    label: 'KI-061 aiaAmcOfName fallback carries its key',
    from: '    return { amc: amcDisplay(tok), from: "name" };',
    to: '    return { amc: amcDisplay(tok), key: amcKey(tok), from: "name" };'
  },
  {
    label: 'KI-061 positions carry the house key and the MF-book flag',
    from: '      g.amcDisplay = h.amcDisplay; g.product = h.product; g.asset = h.asset;',
    to: [
      '      g.amcDisplay = h.amcDisplay; g.amcKey = aiaAmcKeyOf(h); g.product = h.product; g.asset = h.asset;',
      '      g.mfBook = !!h.mfBook;                   /* KI-061: only these move a fund house\'s figures */'
    ].join('\n')
  },
  {
    label: 'KI-061 amcPctOf by house key (with the CMV and name of each house)',
    from: [
      '    var amcPctOf = {};',
      '    (model.amc && model.amc.rows || []).forEach(function(r){ amcPctOf[r.amc] = r.pct; });'
    ].join('\n'),
    to: [
      '    /* KI-061: every AMC figure in the plan is keyed by the house key; amcNameOf gives',
      '       the house\'s AMC-tab name. These are mutual-fund-book figures, so only',
      '       mutual-fund-book positions (h.mfBook) are booked against them below. */',
      '    var amcPctOf = Object.create(null), amcCmvOf = Object.create(null), amcNameOf = Object.create(null);',
      '    (model.amc && model.amc.rows || []).forEach(function(r){',
      '      var k = (r.key != null) ? r.key : amcKey(r.amc);',
      '      amcPctOf[k] = r.pct; amcCmvOf[k] = r.cmv || 0; amcNameOf[k] = r.amc; });'
    ].join('\n')
  },
  {
    label: 'KI-061 impact signal reads the house figure by key, for MF-book positions only',
    from: 'var sImp = aiaSigImpact(h, model, wt, sOv, amcPctOf[h.amcDisplay]);',
    to: 'var sImp = aiaSigImpact(h, model, wt, sOv, h.mfBook ? amcPctOf[aiaAmcKeyOf(h)] : null);   /* KI-061 */'
  },
  {
    label: 'KI-061 amcAfter by house key, MF-book releases only',
    from: [
      '    var amcAfter = {};',
      '    Object.keys(amcPctOf).forEach(function(k){ amcAfter[k] = amcPctOf[k]; });',
      '    sources.forEach(function(s){',
      '      var k = s.h.amcDisplay;',
      '      if (k in amcAfter) amcAfter[k] = amcAfter[k] - (s.release / total * 100);'
    ].join('\n'),
    to: [
      '    var amcAfter = Object.create(null);           /* KI-061: by house key */',
      '    Object.keys(amcPctOf).forEach(function(k){ amcAfter[k] = amcPctOf[k]; });',
      '    sources.forEach(function(s){',
      '      var k = aiaAmcKeyOf(s.h);',
      '      if (s.h.mfBook && (k in amcAfter)) amcAfter[k] = amcAfter[k] - (s.release / total * 100);'
    ].join('\n')
  },
  {
    label: 'KI-061 pool A carries the house key (none outside the MF book)',
    from: '      return { kind: "Top-Up", name: it.h.name, key: it.h.perfKey, amc: it.h.amcDisplay,\n',
    to: [
      '      /* KI-061: a top-up outside the mutual-fund book has no house to test or book */',
      '      return { kind: "Top-Up", name: it.h.name, key: it.h.perfKey, amc: it.h.amcDisplay,',
      '               amcKey: it.h.mfBook ? aiaAmcKeyOf(it.h) : "", mfBook: !!it.h.mfBook,',
      ''
    ].join('\n')
  },
  {
    label: 'KI-061 the portfolio\'s houses, by key',
    from: [
      '    /* AMC display names already present in the portfolio, longest first, so a',
      '       two-word brand wins over a one-word prefix of it */',
      '    var knownAmcs = (model.amc && model.amc.rows || []).map(function(r){ return r.amc; })',
      '      .sort(function(a, b){ return String(b).length - String(a).length; });'
    ].join('\n'),
    to: [
      '    /* KI-061: the houses already in the portfolio, key -> AMC-tab name; aiaAmcOfName',
      '       tries the longest run of leading words first, so a two-word brand wins over a',
      '       one-word prefix of it */',
      '    var knownAmcs = amcNameOf;'
    ].join('\n')
  },
  {
    label: 'KI-061 pool B carries the house key (a new scheme is a mutual fund)',
    from: '      poolB.push({ kind: "New Addition", name: k, key: k, amc: da.amc, amcFrom: da.from,',
    to: '      poolB.push({ kind: "New Addition", name: k, key: k, amc: da.amc, amcKey: da.key, mfBook: true, amcFrom: da.from,'
  },
  {
    label: 'KI-061 greedy fill tests the cap by house key, MF-book candidates only',
    from: '        var amc = d.amc || "";\n        var amcNow = (amc in amcAfter) ? amcAfter[amc] : 0;',
    to: '        var amc = d.amcKey || "";                  /* KI-061: the house key ("" outside the MF book) */\n' +
        '        var amcNow = (d.mfBook && (amc in amcAfter)) ? amcAfter[amc] : 0;'
  },
  {
    label: 'KI-061 a pick keeps the display name and the house key',
    from: 'amount: take, why: d.why, amc: amc, amcFrom: d.amcFrom || "",',
    to: 'amount: take, why: d.why, amc: d.amc || "", amcKey: amc, amcFrom: d.amcFrom || "",'
  },
  {
    label: 'KI-061 remainder fold reads the house by key, MF-book candidates only',
    from: '            var amcNow2 = (pk.amc in amcAfter) ? amcAfter[pk.amc] : 0;',
    to: '            var amcNow2 = (dd && dd.mfBook && (pk.amcKey in amcAfter)) ? amcAfter[pk.amcKey] : 0;'
  },
  {
    label: 'KI-061 remainder fold books the house by key',
    from: '            if (pk.amc) amcAfter[pk.amc] = amcNow2 + (add / total * 100);',
    to: '            if (pk.amcKey) amcAfter[pk.amcKey] = amcNow2 + (add / total * 100);'
  },

  /* ---------------- KI-062: the degraded exit ---------------- */
  {
    label: 'KI-062 degraded Exit: no destination, unplaced = the reduced release, house figure restored',
    from: [
      '        var rel = aiaR2(s.h.cmvCr - keep);',
      '        if (rel > 0.004){ s.action = "Partial Rebalance"; s.release = rel; s.targetWt = Math.min(s.wt, target); }',
      '        else { s.action = "Retain"; s.release = 0; s.targetWt = s.wt; }',
      '      }',
      '    });'
    ].join('\n'),
    to: [
      '        var rel = aiaR2(s.h.cmvCr - keep);',
      '        var was = s.release;',
      '        if (rel > 0.004){ s.action = "Partial Rebalance"; s.release = rel; s.targetWt = Math.min(s.wt, target); }',
      '        else { s.action = "Retain"; s.release = 0; s.targetWt = s.wt; }',
      '        /* KI-062 (bookkeeping only; whether a degraded exit should release anything is',
      '           OD-14): the fill had booked the FULL exit as unfunded and taken the full exit',
      '           off the house\'s running AMC figure. Re-book both on the reduced release: no',
      '           destination, all of it unplaced, and the house gets back what it now keeps',
      '           (a mutual-fund-book position only; KI-061). */',
      '        s.destinations = [];',
      '        s.unfunded = s.release;',
      '        var dk = aiaAmcKeyOf(s.h);',
      '        if (s.h.mfBook && (dk in amcAfter)) amcAfter[dk] = amcAfter[dk] + ((was - s.release) / total * 100);',
      '      }',
      '    });'
    ].join('\n')
  },
  {
    label: 'KI-061/KI-062 final cap map: by house key, MF-book releases only, kept for the summary',
    from: [
      '    (function(){',
      '      var live = {};',
      '      (model.amc && model.amc.rows || []).forEach(function(r){ live[r.amc] = r.cmv || 0; });',
      '      var _act = assessable.filter(function(s){ return s.release > 0; });',
      '      _act.forEach(function(s){',
      '        var k = s.h.amcDisplay;',
      '        if (k in live) live[k] = live[k] - s.release;'
    ].join('\n'),
    to: [
      '    var amcLive = (function(){                     /* KI-062: returned for the summary */',
      '      var live = Object.create(null);              /* KI-061: by house key */',
      '      Object.keys(amcCmvOf).forEach(function(k){ live[k] = amcCmvOf[k]; });',
      '      var _act = assessable.filter(function(s){ return s.release > 0; });',
      '      _act.forEach(function(s){',
      '        var k = aiaAmcKeyOf(s.h);',
      '        if (s.h.mfBook && (k in live)) live[k] = live[k] - s.release;   /* KI-061: MF book only */'
    ].join('\n')
  },
  {
    label: 'KI-061 final cap enforcement tests each destination by house key',
    from: '          var a = d.amc || "";\n          if (!a){ kept.push(d); return; }',
    to: '          var a = d.amcKey || "";\n          if (!a){ kept.push(d); return; }'
  },
  {
    label: 'KI-062 final cap enforcement returns the final map',
    from: [
      '          s.amcCapped = true;',
      '        }',
      '      });',
      '    })();'
    ].join('\n'),
    to: [
      '          s.amcCapped = true;',
      '        }',
      '      });',
      '      return live;',
      '    })();'
    ].join('\n')
  },
  {
    label: 'KI-061/KI-062 summary: houses by key, named; largest-after off the final plan',
    from: [
      '    Object.keys(amcPctOf).sort().forEach(function(k){',
      '      if (maxAmcBefore == null || amcPctOf[k] > maxAmcBefore){ maxAmcBefore = amcPctOf[k]; maxAmcBeforeWho = k; } });',
      '    Object.keys(amcAfter).sort().forEach(function(k){',
      '      if (maxAmcAfter == null || amcAfter[k] > maxAmcAfter){ maxAmcAfter = amcAfter[k]; maxAmcAfterWho = k; } });'
    ].join('\n'),
    to: [
      '    /* KI-061: houses are keyed by amcKey and reported by name; ties go to the',
      '       alphabetically first name, as before.',
      '       KI-062: the after figure is read off the FINAL plan (amcLive: the releases after',
      '       any degraded exit, the destinations after the final cap cut), not the running',
      '       map the fill used. It keeps the basis this figure has always had (KI-004 is',
      '       open): the house\'s AMC-tab % moved by its net flow / total CMV. */',
      '    var amcDestName = Object.create(null);',
      '    sources.forEach(function(s){ (s.destinations || []).forEach(function(d){',
      '      if (d.amcKey && !(d.amcKey in amcDestName)) amcDestName[d.amcKey] = d.amc; }); });',
      '    var amcWho = function(k){ return (k in amcNameOf) ? amcNameOf[k] : ((k in amcDestName) ? amcDestName[k] : k); };',
      '    var byWho = function(a, b){ var x = String(amcWho(a)), y = String(amcWho(b)); return x < y ? -1 : (x > y ? 1 : 0); };',
      '    Object.keys(amcPctOf).sort(byWho).forEach(function(k){',
      '      if (maxAmcBefore == null || amcPctOf[k] > maxAmcBefore){ maxAmcBefore = amcPctOf[k]; maxAmcBeforeWho = amcWho(k); } });',
      '    Object.keys(amcLive).sort(byWho).forEach(function(k){',
      '      var v = ((k in amcPctOf) ? amcPctOf[k] : 0) + (amcLive[k] - ((k in amcCmvOf) ? amcCmvOf[k] : 0)) / total * 100;',
      '      if (maxAmcAfter == null || v > maxAmcAfter){ maxAmcAfter = v; maxAmcAfterWho = amcWho(k); } });'
    ].join('\n')
  },
  {
    label: 'KI-061 expose amcKey on ENGINE',
    from: '    palette:C, FONT:FONT, amcDisplay:amcDisplay, normalize:normalize, matchInstrument:matchInstrument,',
    to: '    palette:C, FONT:FONT, amcDisplay:amcDisplay, amcKey:amcKey, normalize:normalize, matchInstrument:matchInstrument,'
  },

  /* ---------------- KI-061: the XLSX Base File sheet (exporters, 08) ---------------- */
  {
    label: 'KI-061 XLSX Base File sheet: the AMC column is the display name of the row\'s own label, as on main',
    from: 'bf.push([h.client,h.name,h.category,h.asset,h.folio,h.amcDisplay,h.product,',
    to: '/* KI-061: amcDisplay of the row\'s OWN label (what h.amcDisplay was before the one-name-per-house\n' +
        '         rule); ENGINE is bound at the top of this script */\n' +
        '      bf.push([h.client,h.name,h.category,h.asset,h.folio,ENGINE.amcDisplay(h.amc),h.product,'
  },

  /* ---------------- KI-120: the largest-AMC line names each figure's own house ---------------- */
  {
    label: 'KI-120 AI Analyst tab: the largest-AMC line names the house of each figure',
    from: [
      '    var mark = function(label, a, b, lowerIsBetter, suffix){',
      '      if (a == null || b == null) return \'\';',
      '      var better = lowerIsBetter ? (b < a - 0.005) : (b > a + 0.005);',
      '      var worse  = lowerIsBetter ? (b > a + 0.005) : (b < a - 0.005);',
      '      var col = worse ? \'#931621\' : (better ? \'#2E7D32\' : \'#5C3E17\');',
      '      var word = worse ? \' (worse)\' : (better ? \'\' : \' (unchanged)\');',
      '      return \'<span style="color:\' + col + \';">\' + label + \' \' + a.toFixed(2) + (suffix || \'\')',
      '        + \' → \' + b.toFixed(2) + (suffix || \'\') + word + \'</span>\';',
      '    };',
      '    var eff = [];',
      '    var e1 = mark(\'highest overlap\', sm.overlapBefore, sm.overlapAfter, true, \'%\'); if (e1) eff.push(e1);',
      '    var e2 = mark(\'largest AMC\' + (sm.amcAfterWho ? (\' (\' + aiaEsc(sm.amcAfterWho) + \')\') : \'\'),',
      '                  sm.amcBefore, sm.amcAfter, true, \'%\'); if (e2) eff.push(e2);'
    ].join('\n'),
    to: [
      '    /* KI-120: whoA / whoB (escaped) name the figure that follows them */',
      '    var mark = function(label, a, b, lowerIsBetter, suffix, whoA, whoB){',
      '      if (a == null || b == null) return \'\';',
      '      var better = lowerIsBetter ? (b < a - 0.005) : (b > a + 0.005);',
      '      var worse  = lowerIsBetter ? (b > a + 0.005) : (b < a - 0.005);',
      '      var col = worse ? \'#931621\' : (better ? \'#2E7D32\' : \'#5C3E17\');',
      '      var word = worse ? \' (worse)\' : (better ? \'\' : \' (unchanged)\');',
      '      return \'<span style="color:\' + col + \';">\' + label + \' \' + (whoA ? whoA + \' \' : \'\') + a.toFixed(2) + (suffix || \'\')',
      '        + \' → \' + (whoB ? whoB + \' \' : \'\') + b.toFixed(2) + (suffix || \'\') + word + \'</span>\';',
      '    };',
      '    var eff = [];',
      '    var e1 = mark(\'highest overlap\', sm.overlapBefore, sm.overlapAfter, true, \'%\'); if (e1) eff.push(e1);',
      '    /* KI-120: the before figure is the house that was largest before the plan (amcBeforeWho), the',
      '       after figure the house that is largest after it (amcAfterWho). When they differ, each figure',
      '       is named with its own house; when they are the same house it is named once. */',
      '    var amcBW = sm.amcBeforeWho, amcAW = sm.amcAfterWho;',
      '    var e2 = (amcBW && amcAW && amcBW !== amcAW)',
      '      ? mark(\'largest AMC\', sm.amcBefore, sm.amcAfter, true, \'%\', aiaEsc(amcBW), aiaEsc(amcAW))',
      '      : mark(\'largest AMC\' + (amcAW ? (\' (\' + aiaEsc(amcAW) + \')\') : \'\'), sm.amcBefore, sm.amcAfter, true, \'%\');',
      '    if (e2) eff.push(e2);'
    ].join('\n')
  },
  {
    label: 'KI-120 AI Analyst slide: the largest-AMC row names the house of each column',
    from: '      dirRow("Largest AMC concentration"+(sm.amcAfterWho?(" ("+sm.amcAfterWho+")"):""), sm.amcBefore, sm.amcAfter, "%", true);\n',
    to: [
      '      /* KI-120: the Before figure is the house that was largest before the plan, the After figure the',
      '         house that is largest after it; when they differ the label names both, in the columns\' order */',
      '      var _amcBW=sm.amcBeforeWho, _amcAW=sm.amcAfterWho;',
      '      dirRow("Largest AMC concentration"+((_amcBW&&_amcAW&&_amcBW!==_amcAW)?(" (before: "+_amcBW+"; after: "+_amcAW+")")',
      '        :(_amcAW?(" ("+_amcAW+")"):"")), sm.amcBefore, sm.amcAfter, "%", true);',
      ''
    ].join('\n')
  }
]);
