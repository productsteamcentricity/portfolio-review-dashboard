# CR-0010: Other Funds October update: 40 funds to 31 Oct 2026, and three wrong matches and one wrong test fixed

- **Requested:** 22 Nov 2026 by the owner ("Yes, go ahead" to "Go ahead with the 40-fund October update and the 4 fixes?"),
  through the project moderator. Built 22 Nov 2026 on branch `data/2026-10-other-funds` from `main` `12cda89`.
- **Status:** in review. A1 is committed first, so that it can be published on its own if A2 or A3 needs another round.

## Request

The vendor's "Other Funds Analytics" file (October 2026; the same 24 columns as the main analytics files, three rows above
the header) holds 344 schemes. On the live page (D-028: data, calculation and security fixes only):

1. **A1 (data):** the 40 children's and retirement funds that the vendor's October Hybrid file left out show their 30 Sep 2026
   look-through, carried forward. Replace them with this file's 31 Oct 2026 data through the existing hybrid route.
2. **A2 (engine):** stop three wrong matches:
   - Motilal Oswal Nasdaq 100 ETF is looked through as the Motilal Oswal Nifty 100 ETF (Indian large caps in the client's
     equity mix);
   - Aditya Birla SL Global Emerging Opp Fund is looked through as Aditya Birla SL Special Opp Fund;
   - Aditya Birla SL Retirement Fund-40 (and -30) shows Retirement Fund-50's returns.
   A blank-string alias is not acceptable: the alias list is shared by look-through and performance, so it would also wipe
   the correct returns (Nasdaq 100, Global Emerging) and the correct look-through (Retirement-40).
3. **A3 (calculation):** the SWOT's "international" share must stop counting names that merely contain "us " (Plus, Taurus,
   Abakkus, Bonus, Cautious and others).

## Scope

- **Acceptance:**
  - A1: only the 40 keys tagged `vintage: "30 Sep 2026"` change, and the tag goes. No other block or date changes. A
    one-off reviewed build step, never a hand edit (D-016). The file's Sep-26 columns, through the same route, must reproduce
    the embedded 30 Sep entries. `data/refdata/` is regenerated.
  - A2 and A3: patch scripts on `tools/patch-lib.js`; known-answer regression tests that fail on `main` and pass on the
    branch; every match change measured both ways over the real universes (CLAUDE.md rule 4).
  - `check-invariants`, `smoke-review`, `test-ai-analyst`, `run-regression`, `node --test` in IST and UTC; `data-extract
    --check`; a browser check on a synthetic client.
- **Non-goals:** the other 304 schemes of the file are not loaded (debt ETFs already match exactly; FoFs, gold and overseas
  funds stay excluded from look-through by design); no new REFDATA key; no presentation change (no "International" asset
  class, no data-date note per fund: new-build items); STOCK_INFO is not changed.

## Decisions

- 22 Nov 2026, the owner: "Yes, go ahead" (A1 to A3).
- 22 Nov 2026, the moderator: A2 first used **pair blocks** (a holding name never matches one named wrong fund), keyed on
  the engine's normalised name. Measured over every universe, that only moved the error to the next fuzzy candidate (Nifty
  Midcap 100 ETF, Conglomerate, Aggressive Hybrid, a CRISIL IBX index fund, Large Cap). The moderator then approved
  **exact name only** for the listed names: for each, every fuzzy match measured was another fund and every correct match is
  an exact name. Retirement Fund-40 and -30 show no Regular-plan returns, because the vendor data has no Regular row for them
  (CLAUDE.md rule 3: never another plan's figure); they keep their own Direct-plan row (a guarded branch, exact name only).
- 22 Nov 2026, the moderator: the AMC's "The 40s Plan" spelling is listed too. "The 30s Plan" was not at first: its fuzzy
  look-through is Fund-30's own (right), so exact-only alone would lose a correct match.
- 22 Nov 2026, the moderator (after the financial review rated it should-fix): in this batch, as A2b, both spellings get an
  ALIASES pin to their own Regular hybrid key plus exact-only, so they keep (30s) or regain (40s) their own look-through and
  never show Fund-50's returns.
- 22 Nov 2026, the moderator: Retirement Fund-40 / -30 with no Regular row are left out of the Regular Performance sheet by
  the page's existing rule (fund rows without returns are not shown); accepted for the live page. A blank row or a note is
  presentation work for the new build (D-028). Widening the international terms is a follow-up (see A3's known limits).

## Changes

- **A1:** `buildtools/build_refresh.js` (`hybridFromAoa`, the hybrid route on rows already read; `buildHybrid` delegates to
  it, output byte-identical on the October Hybrid file); new `buildtools/build_other_funds.js`; `index.html` and
  `data/refdata/` (HYBRID_ANALYTICS.json, VINTAGE.json); test `tools/regression/CR0010-a1-other-funds-hybrid.js`; refresh log
  `docs/refresh-log/2026-10.md` section 10.
- **A2:** patch `tools/patches/2026-11-22-scoped-match-blocks.js` (engine: `EXACT_ONLY` for 5 normalised names, `isExactOnly`,
  `matchInstrument` stops after the exact-name step for them, and the Direct-plan lookup keeps an EXACT_ONLY mutual fund's
  exact Direct row when it has no Regular row); test `tools/regression/CR0010-a2-scoped-blocks.js`.
  - Measured against `main` over every universe (7 universes, 4,034 names, 28,238 matches): 48 matches change, all from
    another fund to none, all spellings of the listed names; nothing else. Engine level (4,041 synthetic holdings, every
    name, all five keys incl. the Direct row): 42 holdings and 70 fields change, all from another fund to none; nothing else.
  - Known limits: "The 30s Plan" (above); spellings that match nothing today ("ABSL ...", "Exchange Traded Fund") are not
    listed.
- **A2b:** patch `tools/patches/2026-11-22-retirement-plan-pins.js` (ALIASES pins for "... retirement fund 30s" / "... 40s"
  to Fund-30 / Fund-40's Regular hybrid key; "... 30s" exact-only); cases added to the A2 test.
  - Measured against A2: 6 matches change (the "40s" spellings' hybrid look-through from none to Fund-40's own; "The 30s
    Plan"'s Regular and Direct returns and equity / debt look-through from Fund-50, Conglomerate and Gilt to none); engine
    level 5 holdings. Against `main`: 52 matches, each either to none or a 30s / 40s spelling to its own hybrid entry, and
    45 holdings at engine level; nothing outside the listed names.
- **A3:** patch `tools/patches/2026-11-22-intl-word-boundary.js` (engine SWOT: each term of the international name test
  needs a word start, and "us" is a whole word, with "U.S." also recognised; the category test is unchanged); test
  `tools/regression/CR0010-a3-intl-word-boundary.js`.
  - Measured over every key of the fund blocks and the 344 Other Funds names (4,741 names): the old test matched 278 names,
    the new one 117. 163 domestic names leave, all through "us " inside a word: plus 112, Taurus 16, Abakkus 13, focus 6,
    Marcellus 5, Citrus 4, Equirus 3, Avendus 2, surplus 1, ITUS 1. 2 genuine names enter (Franklin U.S. Opportunities,
    Regular and Direct). No genuine international name leaves.
  - Known limits (a follow-up the moderator raises with the owner; the same before and after this change):
    - genuine overseas funds the name test still misses: "Intl." (Aditya Birla SL Intl. Equity), Franklin Asian Equity, HSBC
      Brazil, ABSL Latin America, Edelweiss ASEAN / Europe / Emerging Markets Off-shore, Templeton European Opportunities,
      Invesco Pan European, the Hang Seng ETFs and FoF, NYSE FANG+, MSCI EAFE, PGIM Emerging Markets, Mahindra Asia Pacific
      REITs (a holding whose base-file category says Global or International is still counted by the category test);
    - domestic names it still catches: "First Global ..." (two PMS strategies), "SMC Global ...", and "Edelweiss MSCI India
      Domestic & World Healthcare 45" (Indian-listed companies);
    - debt funds of funds investing in US Treasuries count in the "International / Global equity" share.

## Verification

Recorded in the refresh log (A1) and in the commits and pull request (A2, A3).
