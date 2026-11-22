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
- 22 Nov 2026, the moderator: A2 uses **pair blocks** (a holding name never matches one named wrong fund; every other
  candidate still competes), keyed on the engine's normalised name. Retirement Fund-40 and -30 show no Regular-plan returns,
  because the vendor data has no Regular row for them (CLAUDE.md rule 3: never another plan's figure).

## Changes

- **A1:** `buildtools/build_refresh.js` (`hybridFromAoa`, the hybrid route on rows already read; `buildHybrid` delegates to
  it, output byte-identical on the October Hybrid file); new `buildtools/build_other_funds.js`; `index.html` and
  `data/refdata/` (HYBRID_ANALYTICS.json, VINTAGE.json); test `tools/regression/CR0010-a1-other-funds-hybrid.js`; refresh log
  `docs/refresh-log/2026-10.md` section 10.
- **A2, A3:** recorded with their commits.

## Verification

Recorded in the refresh log (A1) and in the commits and pull request (A2, A3).
