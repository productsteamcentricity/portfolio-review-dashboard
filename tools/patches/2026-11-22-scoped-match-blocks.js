/* ============================================================================
   2026-11-22 — CR-0010 A2: four holding names match only their own exact name,
   so they stop picking up another fund's look-through or returns, without
   losing their correct matches.

   matchInstrument() tries an exact normalised name first, then a fuzzy token
   match. For these four names every fuzzy match, in every universe, is a
   different fund, and every correct match is an exact name:
     - Motilal Oswal Nasdaq 100 ETF (a US index ETF): fuzzy gave the Nifty 100
       ETF's look-through (Indian large caps in the client's equity mix) and the
       Nasdaq 100 FOF's Direct-plan returns (an ETF has no Direct plan). Its own
       returns are an exact name and stay.
     - Aditya Birla SL Global Emerging Opp Fund (an overseas fund of funds):
       fuzzy gave Special Opportunities' look-through (equity), or the Arbitrage
       Fund's (when the base file tags it Hybrid). Its own Regular and Direct
       returns are exact names and stay.
     - Aditya Birla SL Retirement Fund-40 and Fund-30: fuzzy gave Fund-50's
       Regular returns (the data has no Fund-40 or Fund-30 Regular row, so the
       honest answer is none, CLAUDE.md rule 3), and the Conglomerate Fund's
       look-through when tagged Equity. Their own hybrid look-through and their
       own Direct-plan returns are exact names and stay.
   Why not a "" alias: ALIASES is shared by every universe, so "" would also
   wipe the correct exact matches above. Why not a block of the named wrong
   fund: measured over every universe, the next fuzzy candidate is also wrong
   (Nifty Midcap 100 ETF, Conglomerate, Aggressive Hybrid, a CRISIL IBX index
   fund, Large Cap). Exact-only is scoped by what each universe holds: where
   the fund itself is present it matches, elsewhere nothing does.

   Keys are the engine's normalised names, so spellings that normalise to the
   same key are covered ("NASDAQ-100", "Sun Life", "Opportunities", "- Regular
   Plan - Growth", "-Direct Plan"). The AMC's own "The 40s Plan" spelling
   normalises to "... 40s" and is listed too: every fuzzy match it had was
   another fund (Fund-50's returns, Fund-30's look-through). "The 30s Plan" is
   NOT listed: its fuzzy look-through is Fund-30's own, which is right, so
   exact-only would lose a correct match; it keeps Fund-50's returns until an
   ALIASES pin (a follow-up) maps it. Spellings that match nothing today
   ("ABSL ...", "Exchange Traded Fund") are not listed. Known limits pinned in
   tools/regression/CR0010-a2-scoped-blocks.js.

   The Direct view: the engine looks up a holding's Direct-plan row only after a
   Regular match, so Retirement Fund-40 / -30, with no Regular row, would also
   lose their correct Direct row. A guarded branch keeps it: an EXACT_ONLY
   mutual fund with no Regular match still gets its Direct row, by exact name
   only (matchInstrument() allows nothing else for these names). Nothing changes
   for any other holding.

     node tools/patches/2026-11-22-scoped-match-blocks.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('CR-0010 A2 exact-only holdings', [
  {
    label: 'engine: define EXACT_ONLY after ALIASES',
    from: '    "kotak global innovation overseas equity omni fof": "" // was -> Kotak Income Plus Arbitrage\n  };\n',
    to: [
      '    "kotak global innovation overseas equity omni fof": "" // was -> Kotak Income Plus Arbitrage',
      '  };',
      '  /* CR-0010: names that match only their own exact (normalised) name, in every universe. For each, every fuzzy',
      '     match measured was another fund and every correct match is exact; a "" alias would also wipe the exact ones. */',
      '  var EXACT_ONLY = {',
      '    "motilal nasdaq 100 etf": 1,                    // fuzzy: Nifty 100 / Nifty Midcap 100 ETF look-through, Nasdaq 100 FOF Direct',
      '    "aditya birla sl global emerging opp fund": 1,  // fuzzy: Special Opp / Conglomerate, Arbitrage / Aggressive Hybrid',
      '    "aditya birla sl retirement fund 40": 1,        // fuzzy: Fund-50 Regular returns; Conglomerate look-through',
      '    "aditya birla sl retirement fund 30": 1,        // fuzzy: Fund-50 Regular returns; Conglomerate look-through',
      '    "aditya birla sl retirement fund 40s": 1        // "The 40s Plan": fuzzy gave Fund-50 returns and Fund-30 look-through',
      '  };',
      '  function isExactOnly(name){ return Object.prototype.hasOwnProperty.call(EXACT_ONLY, normalize(name).join(" ")); }',
      ''
    ].join('\n')
  },
  {
    label: 'engine: the Direct-plan row of an EXACT_ONLY mutual fund without a Regular row is looked up (exact name only)',
    from: '        if (h.directEquity || h.perfSrc!=="MF") return;   // direct plans apply to mutual funds only\n',
    to: [
      '        if (h.directEquity) return;',
      '        /* direct plans apply to mutual funds only. CR-0010: an EXACT_ONLY mutual fund with no Regular row (Retirement',
      '           Fund-40 / -30) still gets its own Direct row; matchInstrument() allows it only by exact name. */',
      '        if (h.perfSrc!=="MF" && !(h.perfSrc==null && h.pcls==="MF" && isExactOnly(h.name))) return;',
      ''
    ].join('\n')
  },
  {
    label: 'engine: matchInstrument() stops after the exact-name step for EXACT_ONLY names',
    from: [
      '      if (_et.join(" ")===_ak) return _ec;',
      '    }',
      ''
    ].join('\n'),
    to: [
      '      if (_et.join(" ")===_ak) return _ec;',
      '    }',
      '    if (Object.prototype.hasOwnProperty.call(EXACT_ONLY,_ak)) return null;   // CR-0010: no fuzzy match for these names',
      ''
    ].join('\n')
  }
]);
