# CR-0007: Fix batch 2a: empty slide download, renamed fund houses, "AMC not given"

- **Requested:** 21 Oct 2026, by the product owner: KI-124 was seen in an export, and the owner accepted OD-32 and
  OD-34 (D-022). Built 22 Oct 2026; revised the same day after its financial review.
- **Status:** done: merged as PR #9 (22 Oct 2026).

## Request
1. **KI-124:** the Home tab's "Download slide" button produced a PowerPoint file with no slides.
2. **OD-32:** a fund house's former name counts as the current house (IDFC → Bandhan, L&T → HSBC, Reliance →
   Nippon India, DSP BlackRock → DSP, Birla Sun Life → Aditya Birla Sun Life, IIFL → 360 ONE).
3. **OD-34 (KI-112):** mutual-fund rows with a blank AMC show as "AMC not given", with a count and a footnote,
   outside every house's 20% cap.

## Scope
- **Acceptance:**
  - Home has no download bar, and no single-tab download writes an empty deck;
  - a former name and the current name are one house on the AMC tab, in the AI Analyst cap and in its summary;
  - mutual funds with no AMC are never a house row, a breach or the largest AMC, and are tested and booked against
    no house in the AI Analyst;
  - the AMC tab, AMC slide and XLSX "AMC Allocation" sheet show them as one grey "AMC not given" bar or row, with
    the count;
  - the Observations' AMC sentence and the AMC slide insight never call the book well diversified without
    qualification when some holdings have no AMC.
- **Non-goals:** the AMC cap basis (OD-1, still 20% of total CMV in the AI Analyst); the XLSX "Base File" sheet
  (OD-22 comes later); dashes in other generated sentences (KI-126); the AMC slide on a book with no mutual funds
  (KI-125).

## Decisions
- **Owner (21 Oct 2026, D-022):** OD-32 and OD-34 as recommended.
- **Settled while building, by the lead implementer (22 Oct 2026),** within the owner's decisions. They are listed
  here for the owner to confirm or change:
  - these placeholder labels also mean "AMC not given": "NA", "N/A", "N.A.", "Not Available", "Unknown",
    "Others", "Other", "-", "--". Case does not matter, and the whole label is compared (with spaces, punctuation
    and the words already ignored in house names, such as "Mutual Fund", left out). A label with any other word,
    such as "Unknown Opportunities" or "Other Distributor", is not a placeholder;
  - the extra spellings "L and T", "Larsen and Toubro", "Reliance Nippon", "Reliance Nippon Life" and "Birla SL"
    are former names too; "IIFL Wealth" is not;
  - the XLSX "Base File" sheet keeps showing the uploaded label (OD-22 is implemented later);
  - "AMC not given" rows stay in the mutual-fund book total, so every house's share is still a share of the whole
    book.
- **Financial review (22 Oct 2026):** when some holdings have no AMC, the AMC sentence and the slide insight must
  state their share, and "well diversified" must depend on the share the named houses cover. As built, the book is
  called well diversified only when the largest house would stay within the 20% cap even if it held every holding
  with no AMC. Otherwise the text says that diversification cannot be confirmed. With no AMC on any mutual fund, it
  says that concentration by fund house cannot be assessed.

## What changes, and for which books
Only AMC figures and AMC text change. CMV totals, allocations, returns, taxation, overlap and every other number are
unchanged for every book.

| Output | Changes for | What changes |
|---|---|---|
| AMC tab, AMC slide, XLSX "AMC Allocation" sheet: rows, shares, breaches | books whose mutual funds use a former house name | the former and current names become one row under the current name; its share is the sum of both, which can create a breach (or change which house is largest) that the split rows hid. Synthetic example: "IDFC" 1.00 Cr and "Bandhan Mutual Fund" 1.50 Cr of a 10.00 Cr book were 10.00% and 15.00%; now Bandhan is 25.00%, a breach |
| the same | books with mutual funds whose AMC is blank or a placeholder | the blank group is no longer a house row (it could be an unnamed breach or the largest house), and placeholder labels such as "N/A" or "Unknown" no longer form houses of their own. They are now together a grey "AMC not given" bar or row with a count and footnote, never a breach. The book total and the named houses' shares do not change |
| AI Analyst house caps, plan and summary | books with former names | the cap is tested on the house as a whole, so top-ups and new schemes into a house held under its former name are limited by the combined share. Synthetic example: a house held at 5.00% under "IDFC" went to 30% when counted as two houses; its destinations now add at most 15% of CMV, so it stays within 20% |
| the same | books with mutual funds that have no AMC | such a fund is no longer tested against the blank group, so it can receive a larger top-up (synthetic example: 0.00 → 0.80 Cr, its full room to the 10% fund cap). The largest AMC before and after is always a named house. A caveat gives the count and share. Its rows show "AMC not given" as their AMC (tab, slide, XLSX "AI Analyst" sheet) |
| Observations, AMC sentence (screen, slide, XLSX) | books with mutual funds that have no AMC | the sentence gives the not-given share and says "well diversified" only as described above |
| AMC slide insight | every book | written as plain sentences (its dashes became full stops); a single breaching house "breaches" the cap. With holdings that have no AMC, it also gives their share and qualifies "well diversified" as above |
| "Download slide" | every book | Home has no download bar; a tab whose deck would hold no slide shows a status message instead of downloading |

A book whose mutual funds all carry a current, non-placeholder house name gets the same numbers as before; only
the AMC slide insight's wording changes.

## Changes
- `tools/patches/2026-10-22-legacy-batch-2a.js` (engine, exporters, UI); `index.html` MD5 `EF2FF4F1…` →
  `911A04659CB34383E478416B54E9C306` (16,826,633 bytes). The first build of this batch (`F7123A83…`, commit
  `37f533f`) is superseded by this one.
- Tests: `tools/regression/KI-124-empty-slide-export.js`, `OD-32-renamed-amc.js`, `OD-34-amc-not-given.js`;
  `tools/smoke-review.js` (its AMC sum includes any "AMC not given" share).
- Docs: KNOWN_ISSUES (KI-015 Home part, KI-061, KI-112, KI-124; new KI-125 and KI-126; after the browser QA, KI-125
  extended and new KI-127 and KI-128), the decisions file (OD-32 and OD-34 built), ARCHITECTURE, TESTING,
  PROJECT_STATE, CHANGELOG, this record.

## Verification
- `check-invariants --expect-md5 911A04659CB34383E478416B54E9C306`: all invariants hold, 1 known warning (KI-027).
- `smoke-review` 35/35, `test-ai-analyst` 24/24, `run-regression` 12 files, 499 checks, all pass.
- The nine OD-34 checks added after the financial review (the placeholder labels; the AMC sentence and slide
  insight with 40%, 100% and 2% not given, and with breaches) fail on the first build `F7123A83…` and pass on this
  one. The known answers are computed in the test from its own rows.
- Nine more OD-34 checks, the financial re-review's required changes 2 and 3 (test only; `index.html` unchanged):
  - **The capSafe boundary.** A 12.50 Cr book with the largest house at 18.00% and 2.00% "AMC not given" (20.00%
    exactly) is cap-safe: `model.amc.notGiven.capSafe` is true and both texts say well diversified. A book at
    18.10% + 2.00% (20.10%) is not: capSafe is false, neither text says well diversified, both say diversification
    cannot be confirmed. Cross-check on the engine's own breach test: the same books with the 2.00% labelled as the
    largest house put it at 20.00% (not a breach) and 20.10% (a breach).
  - **Wording.** A single breaching house: the insight opens "Synthetic House A (25.00%) breaches the 20% per-AMC
    cap." and the Observations say "breaches"; an all-named book with no breach: the Observations sentence is main's,
    word for word. No en or em dash in either text in these books or in the 19% + 2% book.
  - **Fail before.** On main (`EF2FF4F1…`) and on the first build (`F7123A83…`), seven of the nine fail (capSafe is
    undefined; the insight has a dash and "breach" for one house). The two that pass there pin unchanged text (the
    Observations "breaches" for one house, and main's no-breach sentence). Three scratch builds of `911A0465…` that
    change only the capSafe rule each fail the boundary checks: `< 20.0` fails the 20.00% book, a whole-percent
    rounding and a rule without the not-given share fail the 20.10% book.
- **Browser acceptance (22 Oct 2026), all checks passed.** QA ran commit `a777490` (`index.html` `911A0465…`),
  served at localhost:8101, with synthetic data only:
  - Home has no download bar.
  - The other 19 single-tab decks are not empty: ips 2, asset 1, distalloc 2, clalloc 2, amc 1, obs 3, holdings 4,
    analytics 3, overlap 2, cost 2, irr 2, cvs 2, mfanalysis 7, tax 5, aia 4, rebal 1, perf 7, disc 1, thank 1
    slides. The rebalancing group's own download buttons download too.
  - IPS (2 slides) and AI Analyst (4) download once filled in. An empty AI Analyst tab gives "Nothing to download …"
    and downloads nothing.
  - Full deck 61 slides; workbook 15 sheets; Fund IRR total 13.09 / 11.88.
  - A synthetic book with "IDFC", "L&T", blank, "-", "NA" and "Others" as AMCs: Bandhan 25% (a breach) with IDFC
    counted in it; HSBC with L&T; "AMC not given" 10% as a grey bar with its note; the Direct Equity "Larsen &
    Toubro Ltd." row untouched. The AMC slide and the XLSX agree. The Observations and the slide insight give the
    not-given share. With Bandhan at 19% (not cap-safe), both say diversification cannot be confirmed.
  - `family-isolation.js` 15/15 and `cvs-refresh.js` 34/34; the console is clean (apart from KI-125's warning on a
    book with no mutual funds); network requests only for the page and the test files.
  - Found on the way, not caused by this batch (the same on main): KI-127 (the AMC tab note says "exceed" for one
    house), KI-128 (raw keys in the rebalancing group's slide file names), and KI-125's PptxGenJS colour warning
    on a book with no mutual funds.
- Rebuilt from `main` by running every patch in file-name order (older patches already in `main` are skipped or
  refused as superseded, nothing written): the result is `911A0465…`; a second run of the batch patch changes
  nothing.
- The AMC and Observations slides were rendered in PowerPoint for four synthetic books (two breaches with long
  house names and 25% not given; 40% not given; 2% not given; no AMC at all) and looked at: the texts fit their
  boxes, and the all-blank book shows one grey bar at 100%.
- Not verified: Office rendering of what the browser QA downloaded (its decks and workbook were counted, not opened
  in PowerPoint or Excel; the PowerPoint check above covers only the AMC and Observations slides of four books built
  headlessly), and the live page after publishing.

## Status
Done: merged as PR #9 on 22 Oct 2026; the browser acceptance passed. Follow-ups: the owner confirms the decisions settled while building;
KI-125 to KI-128.
