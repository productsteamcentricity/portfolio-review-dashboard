# CR-0008: Live-page tax rules follow the TY 2026-27 Tax Reckoner

- **Requested:** 24 Oct 2026, by the product owner, who supplied `India_Taxation_Reckoner_TY2026-27.xlsx` (law as on
  19 Oct 2026; the Income-tax Act 2025 in force from 1 Apr 2026) as the source of record for the current tax year.
  The lead commissioned a financial review of the live page against it (24 Oct 2026) and set the defaults in D-040.
  Built in parts: part T1 on `fix/legacy-batch-3-tax` (27 Oct 2026); part T2 on `fix/legacy-batch-3-tax-p2`, on top of
  T1's commit (27 Oct 2026); part T3 and part T4 (the corrections from the financial re-review of part T3) on
  `fix/legacy-batch-3-tax-p3-r2`, on top of T2's commit (27 Oct 2026). That branch then merged `main` with fix batch
  4 and its page was rebuilt (27 Oct 2026; "Rebased on fix batch 4" below). Part T5 (the follow-ups, the owner's
  answers to questions 17 and 18, and the corrections from an independent review of the part) on
  `fix/legacy-batch-3-tax-cr-0008`, on top of that rebuilt branch, which carries the whole batch to `main` (2 Nov 2026).
- **Status:** built: parts T1 (classification and the TAX_RULES rows), T2 (holding periods and lots), T3 (the
  harvest, AIF and PMS treatment, the wording), T4 (crypto kept out of set-off) and T5 (the follow-ups) are committed on
  `fix/legacy-batch-3-tax-cr-0008`. 22 of the 23 findings are fixed and KI-177 in part; KI-177's step-up (TX-18 step 2)
  waits for the owner's rulings. The owner answered questions 17 and 18 on 2 Nov 2026 (D-043; built in part T5). The
  batch waits for the pull request's checks, the gate reviews and the browser acceptance. Under D-028 these are
  calculation and data fixes for the live page.

## Request
Make the Taxation tab, the tax slides and the AI Analyst tax signal follow the reckoner. The review found 23
discrepancies, TX-01 to TX-23, each re-verified by a second reviewer (all confirmed). They are KI-160 to KI-182
(TX-nn is KI-(159+nn)) in [`KNOWN_ISSUES.md`](../KNOWN_ISSUES.md). The review itself is kept privately, outside the
repository (it quotes no client data, but it is the working file of the review).

| Part | Scope | KI (TX) | State |
|---|---|---|---|
| T1 | classification and the TAX_RULES rows | KI-162 to KI-165 (TX-03 to TX-06), KI-170 (TX-11), KI-172 to KI-174 (TX-13 to TX-15), KI-178 to KI-180 (TX-19 to TX-21) | built 27 Oct 2026 |
| T2 | holding periods and lots: the anniversary rule, the 1 Apr 2023 purchase-date rule, the valuation date, the 1 Feb 2018 disclosure | KI-160 (TX-01), KI-161 (TX-02), KI-176 (TX-17), KI-177 step 1 (TX-18) | built 27 Oct 2026 |
| T3 | the harvest per client (TX-08), the Sec 198 exemption (TX-09), the set-off order (TX-16), fund-level and pass-through AIFs (TX-07, TX-12), PMS (TX-10), the carry-forward wording (TX-22), the crypto source (TX-23) | KI-166 to KI-169, KI-171, KI-175, KI-181, KI-182 (and KI-130) | built 27 Oct 2026 |
| T4 | the financial re-review of T3: crypto kept out of set-off (finding F1); two figures in the records corrected (F2, F3) | KI-182, KI-175 | built 27 Oct 2026 |
| T5 | the follow-ups to T1 to T4: the usual bucket by date, the AIF category (question 17 answered), IRR dates with a zone, wording, inputs; the corrections from an independent review | KI-170, KI-109 (in part), KI-022, KI-166, KI-171, KI-182 (the answers); KI-184 to KI-186 and KI-200 to KI-206 filed | built 2 Nov 2026 |
| later | the grandfathering step-up (TX-18 step 2) | KI-177 step 2 | waits for the owner's rulings |

**Part T1 must not be merged alone:** it maps conservative hybrids, debt FoFs, debt SIFs and debt ETFs filed as "ETF" or
"Index Fund" to the Specified rows, which treat every lot as short term; units bought before 1 Apr 2023 need the
purchase-date rule of KI-161 (TX-02), as the review's verifier required for TX-19. Part T2 adds that rule. The batch
merges as one change.

## Scope of part T1
- **Acceptance:**
  - every holding of the reference universes gets the class the reckoner gives it, or is unclassified with a reason
    when the class depends on data the page does not have; the moves are measured over MF_PERF, MF_PERF_DIRECT,
    SIF_PERF, HYBRID_ANALYTICS and STOCK_INFO, and no move is unexplained (below);
  - the TAX_RULES rows carry the reckoner's parameters (new and replaced rows below), in the existing row format, with
    one new field the engine reads (`lockMonths`);
  - an ELSS lot inside its lock-in is neither long nor short term and never in the harvest;
  - every unclassified holding shows why, on the Taxation tab and in the AI Analyst tax signal; the slides count them;
  - the synthetic sample book's taxation is unchanged apart from the debt row's name.
- **Non-goals (later parts):** the anniversary and reference-date rules, the 1 Apr 2023 purchase-date rule, the
  exemption, the per-client harvest, AIF and PMS treatment, grandfathering, the carry-forward wording, the crypto
  source note. The base-file reader is unchanged: it reads no ISIN column, so a foreign share's marker comes from its
  product or category label or from the ISIN of its STOCK_RET entry.

## Decisions
- **Lead, 24 Oct 2026 (D-040, lead under D-033):** (a) to (h), each open to the owner's confirmation. Part T1 applies
  (c): a foreign-listed share needs a positive marker; Equity, Shares and Stocks are direct-equity product labels.
- **Everything else follows the verifier's corrected fix.** Settled while building, within those, for the owner to
  confirm or change (also in D-040):
  - the usual buckets: aggressive hybrid equity-oriented, balanced hybrid the general rule, conservative hybrid
    Specified; balanced advantage, dynamic asset allocation, equity savings, multi asset and life cycle funds, and
    retirement and children's funds, unclassified with the reason; SIF equity long-short and sector rotation
    equity-oriented, debt long-short Specified, the rest unclassified;
  - a single equity ETF or BeES FoF is "Equity ETF FoF (90/90)" pending the 90/90 confirmation fund by fund; Bharat 22,
    ESG sector leaders and multi-ETF FoFs follow the general rule; a conservative FoF is unclassified;
  - SIFs have their own rows (the same parameters as the mutual-fund rows), so a slide never calls a SIF a mutual fund;
  - US treasury and US debt FoFs are international FoFs (Global Funds), not Specified;
  - an ELSS lot is locked up to and including the third anniversary of its purchase;
  - a REIT or InvIT fund is recognised by its name (index fund, ETF, FoF) or a fund product other than plain "Mutual
    Funds", so a REIT held directly whose blank Product parses as "Mutual Funds" stays a REIT unit (a variant of the
    verifier's fix, which keyed on the product alone);
  - the hybrid "depends on the year" test also reads the name (balanced advantage, asset allocation, equity savings,
    multi asset, life cycle), so a fund with a blank category is classed as it would be with its category.

## The new and replaced TAX_RULES rows (part T1)

| Row | Long term after | STCG | LTCG | Reckoner |
|---|---|---|---|---|
| Debt Mutual Funds – Sec. 76 (old 50AA) (renamed) | always short term | slab | none | Section Map #15; Master #16 |
| Hybrid MF (equity-oriented) (replaces "Equity: >65%") | 12 months | 20% | 12.5% | Master #10; Hybrid R21 |
| Hybrid MF (general rule) (replaces "Equity: 35%-65%", which had 20%) | 24 months | slab | 12.5% | Master #12; Hybrid R23 |
| Hybrid MF (Specified, Sec. 76) (replaces "Debt: >65%") | always short term | slab | none | Master #13; Hybrid R24 |
| Equity ETF FoF (90/90) | 12 months | 20% | 12.5% | Master #6; Hybrid R31 |
| Fund of Funds (general rule) | 24 months | slab | 12.5% | Master #7, #15; Hybrid R32, R33, R37 |
| International ETFs (listed in India) | 12 months | slab | 12.5% | Master #22; Mutual Funds R33 |
| ELSS (3-year lock-in), lockMonths 36 | 12 months, after the lock-in | not possible | 12.5% | Master #4; Mutual Funds R10 |
| SIF (equity long-short) | 12 months | 20% | 12.5% | Master #26; Hybrid R41, R43 |
| SIF (debt long-short, Specified) | always short term | slab | none | Master #26; Hybrid R44 |
| Foreign-listed shares (held directly) | 24 months | slab | 12.5% | no reckoner row; D-040 (c) |

Unchanged rows keep their parameters; "Global Funds" (24 months, slab, 12.5%) is the international FoF row (Master
#21) and "Commodity Mutual Fund" the gold or silver FoF row (#20). TAX_RULES goes from 25 to 32 rows.

## What changes, and for which books (part T1)
Measured with the shipped classifier before (`911A0465…`) and after (`5717A796…`) on the reference universes, with
the inputs `tools/make-sample-base.js` uses (product "Mutual Funds", category = the vendor sheet, asset from the
record type). Every move below is one of the fixes; nothing else moved. Rows marked "per plan" are the same in
MF_PERF (Regular) and MF_PERF_DIRECT.

| Universe | Before → after | Names | Fix |
|---|---|---|---|
| STOCK_INFO, product "Direct Equity" | Global Funds → Listed Equity Shares | 286 | KI-162 |
| | Listed Equity Shares → Foreign-listed shares | 1 (NXP Semiconductors, Dutch ISIN) | KI-162 |
| | InvIT Units → Listed Equity Shares | 1 (Invitation Homes) | KI-174 |
| STOCK_INFO, products "Equity", "Shares", "Stocks" | unclassified → Listed Equity Shares | 8,387 each (and the 286 from Global Funds) | KI-162, D-040 (c) |
| MF_PERF, MF_PERF_DIRECT | Commodity ETF → Commodity Mutual Fund (gold or silver ETF FoFs, 12 to 24 months) | 35 per plan | KI-163 |
| | Equity ETFs → Global Funds (international FoFs and offshore funds; 4 benchmark rows in Regular) | 33 Regular, 31 Direct | KI-164, KI-165 |
| | Equity ETFs → International ETFs (listed in India) | 6 (Regular) | KI-164 |
| | Equity Mutual Funds → Global Funds (NASDAQ 100 and S&P 500 index funds) | 2 per plan | KI-164 |
| | Equity ETFs → Fund of Funds (general rule) (Aqua, Strategic Metal and Energy FoFs) | 2 per plan | KI-165 |
| | REIT Units → Global Funds (international REIT FoFs) | 2 per plan | KI-174 |
| | REIT Units → unclassified (REIT index funds) | 3 per plan | KI-174 |
| | Sec. 50AA → Equity ETF FoF (90/90) ("Debt Oriented" ETF FoFs) | 29 per plan | KI-165 |
| | Sec. 50AA → Fund of Funds (general rule) ("Debt Oriented" active, multi-asset and multi-ETF FoFs) | 22 per plan | KI-165 |
| | unclassified → Fund of Funds (general rule) ("Hybrid" FoFs; 3 conservative stay unclassified) | 47 per plan | KI-165 |
| | unclassified → Hybrid MF (equity-oriented) (aggressive hybrid) | 31 per plan | KI-170 |
| | unclassified → Hybrid MF (Specified, Sec. 76) (conservative hybrid) | 19 per plan | KI-170 |
| | Equity Mutual Funds → ELSS (3-year lock-in) | 40 per plan | KI-173 |
| | Equity ETFs → unclassified (retirement funds in "Solution Oriented,ETFs,FOFs") | 12 Regular, 6 Direct | KI-179 |
| | Equity Mutual Funds → unclassified (children's funds) | 12 per plan | KI-179 |
| | Sec. 50AA → unclassified (retirement funds filed "Debt Oriented") | 23 (Direct) | KI-179 |
| | Sec. 50AA → Sec. 76 (old 50AA) (label only) | 499 Regular, 456 Direct | KI-180 |
| SIF_PERF, any asset tag | unclassified → SIF (equity long-short) | 10 of 30 | KI-172 |
| HYBRID_ANALYTICS (243) | unclassified → Hybrid MF (equity-oriented) / (Specified) | 29 / 19 | KI-170 |
| | Equity Mutual Funds → Hybrid MF (general rule) (balanced hybrids) | 5 | KI-170 |
| | Equity Mutual Funds → Hybrid MF (equity-oriented) (aggressive hybrid IDCW plans, no category) | 2 | KI-170 |
| | Equity ETFs or Equity Mutual Funds → unclassified (retirement, children's, life cycle) | 12 + 35 | KI-179, KI-170 |
| AIF_PERF (12), PMS_PERF (721) | no change | | |

With products "ETF", "Index Funds", "Fund of Funds" or "FoFs" (KI-178), 1,873 of the 2,130 Regular names change
class, nearly all from unclassified to their mutual-fund class (830 equity funds, 417 debt funds, 270 equity ETFs),
and 44 bond funds from Listed Bonds and 38 G-Sec funds and ETFs from G-Secs to the Sec. 76 row. With a blank category, equity savings,
balanced advantage, multi asset and similar funds are unclassified by their names (125 Regular, 119 Direct), as with
their category.

**Books:** a book changes only where it holds one of these kinds of scheme. On the synthetic sample book the taxation
totals and the harvest are identical (CMV 8.7443, long term 5.547273, short term 2.400027, not classified 0.797,
tax before 0.267175 Cr); its two debt funds show the new row name, and its multi asset fund and ex-top 100 SIF (both
unclassified before and after) now show their reasons. Lots inside an ELSS lock-in leave the long-term and short-term
amounts and the harvest; holdings now unclassified (retirement and children's funds, REIT index funds) leave the
harvest; newly classified ones (aggressive hybrids, FoFs, SIFs, international ETFs) enter it.

## Changes (part T1)
- `tools/patches/2026-10-27-tax-1-classification.js` (reference data, engine, exporters, UI); `index.html` MD5
  `911A04659CB34383E478416B54E9C306` → `5717A7967294FA13ED3A65111D80DA61` (16,826,633 → 16,841,457 bytes).
  - Engine: `taxClassify(h, REF)` returns the class and, when there is none, the reason; `taxClassOf` keeps its
    contract; `MF_BOOK_PRODUCT` is the one mutual-fund product test (also the AMC tab's); `taxForeignListed`;
    `taxLocked` (the ELSS lock-in, anniversary clamped to the month end); `computeTaxation` gives an unclassified
    holding its reason and sends a class with no TAX_RULES row to the unclassified list; the ELSS locked part is on
    each record (`lockedUnits`, `lockedCmv`, `lockedGain`, inside the unknown part) and in the totals; the AI Analyst
    tax signal names the locked part and gives an unclassified holding its reason.
  - Screen: "Long term after" shows the lock-in; the unclassified table has a "Why" column (no more "Add a row for the
    product"); a note on the ELSS lock-in and one on usual-bucket classes; the Total Gain/Loss tile names the locked
    part. Slides: "Long term after" shows the lock-in; the class, totals and holding-detail footnotes count the
    unclassified holdings and the locked units.
- `data/refdata/TAX_RULES.json` and `VINTAGE.json` regenerated (`node scripts/data-extract.ts`).
- Tests: `tools/regression/KI-162-direct-equity-international.js`, `KI-163-gold-silver-fof.js`,
  `KI-164-international-funds.js`, `KI-165-fund-of-funds.js`, `KI-170-hybrid-funds.js`, `KI-172-sif.js`,
  `KI-173-elss-lock-in.js`, `KI-174-reit-invit.js`, `KI-178-mf-product-guard.js`, `KI-179-solution-oriented.js`,
  `KI-180-debt-row-section.js`, with `tools/regression/lib/tax-harness.js`; `tools/smoke-review.js` (the KI-065
  check expects the new debt row name).
- Docs: D-040, KNOWN_ISSUES (KI-160 to KI-182; KI-022, KI-037, KI-064, KI-099, KI-130 updated), this record, the
  change-request index, CHANGELOG, PROJECT_STATE, legacy ARCHITECTURE, TESTING, the audit decisions (OD-28 answered).

## Verification (part T1)
- `check-invariants`: all invariants hold, 1 known warning (KI-027). `smoke-review` 35/35. `test-ai-analyst`
  24/24. `run-regression`: 23 files, all pass (the 11 new files: 333 checks).
- **Fail before:** the 11 new test files run against the pre-fix `index.html` (`911A0465…`) all fail (each exits 1;
  four stop at the first call of `ENGINE.taxClassify`, which does not exist there).
- Known answers are worked out in each test from units x price in rupees (the review's probes): for example ELSS
  tax before Rs 500 and saving 0 (was Rs 625 and Rs 125); Coromandel International Rs 500 long term (was a Global
  Fund at slab); a KEC International long-term loss saves Rs 375 (was Rs 525); an international FoF held 16 months is
  short term at slab (was Rs 7,000 long term); a gold ETF FoF is short term up to 24 months; a G-Sec ETF bought in
  2024 is short term at slab (was Rs 625 long term).
- The patch re-run changes nothing; `node scripts/data-extract.ts --check` passes; `node --test` 234/234 in IST and
  in UTC.
- The tax slides of a synthetic worst-case book (16 classes, ELSS lock-in, three unclassified and one unreconciled
  holding) were rendered in PowerPoint and looked at: the class table and its two-line footnote fit above the black
  band; the "Long term after" cell "> 12 months (3-yr lock-in)" fits on one line; the totals footnote fits on two
  lines. On the holding-detail slide the footnote runs to a third line that sits just above the band, as KI-109
  already records for books with unreconciled holdings; the ELSS sentence adds to that line.
- **Not verified:** the Taxation tab in a browser (its HTML was rendered headlessly from the shipped renderer and
  checked in the tests); real client books (no client data used); the later parts' interaction (TX-01 changes the
  bucket test this part's lock-in test sits beside).

## Scope of part T2 (holding periods and lots)
- **Acceptance:**
  - a lot is long term from the day after the anniversary of its purchase (more than 12 or 24 months), the months
    added in calendar months and clamped to the month end; exactly 12 months is short term (TX-01, D-040 b);
  - Specified treatment (always short term, slab) applies only to units bought on or after 1 Apr 2023; older units of
    debt funds (with target maturity funds, debt ETFs and debt FoFs) and of conservative hybrids follow the general rule
    in their own class: long term after 24 months (12 for a listed ETF), 12.5%, no exemption (TX-02);
  - holding periods run to the base file's valuation date; IRR trades after it are left out of the lots with a notice
    (TX-17, D-040 a);
  - lots bought before 1 Feb 2018 in a class the grandfathering can cover are counted and disclosed, with no price
    invented (TX-18, the verifier's step 1);
  - "Long term after" reads "More than N months" on the tab and the slides;
  - the synthetic sample book's taxation is unchanged.
- **Non-goals (later parts):** the exemption, the per-client harvest, the slab-rate ranking, AIF and PMS treatment, the
  31 Jan 2018 step-up itself, the carry-forward wording, the crypto source note. The sample book
  (`tools/make-sample-base.js`) is not extended: the tests build their own lots.

## Decisions settled while building part T2 (for the owner to confirm; also in D-040)
- **The valuation date (D-040 a).** The page reads it, in this order: the base file's own "Valuation Date" column
  when it has one (the latest date in it; some holding-report formats carry it), else the portfolio date the analyst
  sets for the review ("As on"; the slides print it as "Portfolio as on"), read strictly as "d Mon yyyy", never the
  built-in "20 May 2026"; with neither, the IRR sheet's latest date as before, and the tab says so. The portfolio
  date picker opens on today's date, so when the base file has no Valuation Date column the analyst must set it to the
  base file's date; the tab says so when the IRR sheet ends before it. This also meets OD-2 (the review's as-on date).
- **Trades after the valuation date** are left out of the lots and counted; the tab names the instruments, the class
  slide counts them, and an unreconciled holding's reason says when some of its trades were left out.
- **The pre-2023 classes.** Two new TAX_RULES rows, reached only through the Specified rows' `before` field by each
  lot's date: "Debt MF bought before 1 Apr 2023" (24 months, `listedEtfMonths` 12: a name or category with "ETF" or
  "BeES" and no "FoF") and "Hybrid MF (conservative) bought before 1 Apr 2023" (24 months). The SIF debt row has no
  date rule: SIFs began in 2025. A holding with lots on both sides is two records, each with its own units, CMV,
  Gain/Loss and lots, adding back to the holding exactly; the second is marked and never counted as another holding.
- **The 1 Feb 2018 classes** are Listed Equity Shares, Equity Mutual Funds, Equity ETFs, ELSS, Hybrid MF
  (equity-oriented), Equity ETF FoF, Equity PMS, REIT and InvIT units (old Sec 112A's scope: shares, equity-oriented
  fund units and business trust units). The disclosure is shown only when such a lot is open.
- **Free-text IRR dates** ("01-Apr-2023") are read as their calendar day; on an IST machine they were 31 Mar in UTC.

## The new TAX_RULES rows and fields (part T2)

| Row | Long term after | STCG | LTCG | Reckoner |
|---|---|---|---|---|
| Debt Mutual Funds – Sec. 76 (old 50AA): adds `specifiedFrom` 2023-04-01, `before` "Debt MF bought before 1 Apr 2023" | always short term (units from 1 Apr 2023) | slab | none | Mutual Funds R17; Master #16, #18 |
| Hybrid MF (Specified, Sec. 76): adds the same, `before` "Hybrid MF (conservative) bought before 1 Apr 2023" | always short term (units from 1 Apr 2023) | slab | none | Hybrid Funds & FoFs R7 (J7), R24 |
| Debt MF bought before 1 Apr 2023 (new; `boughtBefore` 2023-04-01) | 24 months (12 for a listed ETF, `listedEtfMonths`) | slab | 12.5%, no exemption | Mutual Funds R26 (#8); Master #17, P27 |
| Hybrid MF (conservative) bought before 1 Apr 2023 (new) | 24 months | slab | 12.5% | Hybrid Funds & FoFs R24 (J24); Mutual Funds R26 |

TAX_RULES goes from 32 to 34 rows.

## What changes, and for which books (part T2)
- **Every book with a lot one day to a month past its 12- or 24-month anniversary:** that lot moves from short to long
  term (and into the 12.5% pool where the short-term rate was 20%, or out of the unquantified slab pool).
- **Every book with debt or conservative hybrid units bought before 1 Apr 2023:** those lots move from short term at
  slab to their own class, now long term at 12.5% (any lot bought before 1 Apr 2023 is more than 24 months old after
  31 Mar 2025); their gains enter the quantified harvest, and their losses become long-term losses. On the verifier's
  book: tax before Rs 875, after Rs 250, saving Rs 625 (was 0, 0, 0).
- **Books whose IRR sheet ends before the base file's valuation date, or has trades after it:** lots are aged to the
  valuation date, and later trades no longer make a holding unreconciled.
- **Books with equity lots bought before 1 Feb 2018:** a note names those holdings; no figure changes.
- **The synthetic sample book:** identical taxation (CMV 8.7443, long term 5.547273, short term 2.400027, not
  classified 0.797, tax before 0.267175 Cr); it has no lot in the anniversary window, no debt lot before 1 Apr 2023 and
  no trade after 30 Sep 2026.

## Changes (part T2)
- `tools/patches/2026-10-27-tax-2-holding-period.js` (reference data, engine, exporters, parsers, UI); `index.html` MD5
  `5717A7967294FA13ED3A65111D80DA61` → `AE70F78B0C89E57692EE9C71A2AC8358` (16,841,457 → 16,856,968 bytes).
  - Engine: `taxBucket(rule, buy, asOn, etf)` tests the anniversary to the day (`taxMonthsBetween` removed);
    `taxListedEtf`; `taxRefDate` (the valuation date and its source), `taxParseDMY` and `taxCellDay` (strict dates);
    `parseBaseRows` reads a "Valuation Date" column into `valuationDate`; `computeTaxation` leaves trades after its date
    out of FIFO (`later`, `irrThrough`), splits a holding at 1 Apr 2023 (`splitPart`), counts lots before 1 Feb 2018
    (`gfLots`), and its totals carry holding counts (`nPos`, `nHold`); `computeReview` passes the valuation date and
    its source (`asOnSource`, `portfolioDate`); the AI Analyst tax signal counts a split holding once and names lots
    before 1 Feb 2018.
  - Parsers: `irrParseDate` reads free text as its calendar day.
  - Screen: "More than N months"; the date's source, the anniversary rule and the 29 Feb clamp in the sub-heading;
    notes on the valuation date (IRR sheet ending earlier, trades left out, the fallback), the 1 Apr 2023 rule and the
    lots before 1 Feb 2018 (also as the harvest footnote); the grand total counts holdings once; one client's view
    carries the date fields. Slides: "More than N months"; the class footnote's date tag and short notes on 1 Apr 2023
    and 1 Feb 2018; the harvest footer's 1 Feb 2018 sentence; totals and holding detail count holdings once.
- `data/refdata/TAX_RULES.json` and `VINTAGE.json` regenerated.
- Tests: `tools/regression/KI-160-anniversary-rule.js`, `KI-161-specified-from-2023.js`, `KI-176-valuation-date.js`,
  `KI-177-grandfathering-disclosure.js` (118 checks); `tools/regression/lib/tax-harness.js` (IRR-only trades, a
  Valuation Date column, a portfolio date); `KI-170` and `KI-173` expect "More than N months"; `KI-180` reaches the two
  new rows through the Specified rows.
- Docs: D-040, KNOWN_ISSUES (KI-160, KI-161, KI-176, KI-177, KI-022, KI-178, KI-109), this record, the change-request
  index, CHANGELOG, PROJECT_STATE, legacy ARCHITECTURE, TESTING.

## Verification (part T2)
- `check-invariants`: all invariants hold, 1 known warning (KI-027). `smoke-review` 35/35. `test-ai-analyst`
  24/24. `run-regression`: 27 files, 950 checks, all pass (also with `TZ=UTC` for the tax files).
- **Fail before:** the 4 new files run against the T1 page (`5717A796…`) all exit 1 (KI-160: 18 checks fail;
  KI-161: 30; KI-176: 15, then it stops where `later` does not exist; KI-177: 10).
- Known answers from units x price: an equity fund bought 10 Oct 2025 is long term on 23 Oct 2026, Rs 625 (was short
  term, Rs 1,000); it turns long term on 11 Oct 2026; 29 Feb 2024 lots on 28 Feb and 1 Mar 2025; the verifier's debt
  book Rs 875 / Rs 250 / Rs 625; an old gilt lot at a loss no longer offsets a short-term gain (tax Rs 800, was Rs 600);
  a purchase after the valuation date leaves the holding reconciled (it was unreconciled); the verifier's 2017 lot keeps
  LTCG Rs 70,000 and Rs 8,750 of tax, now disclosed.
- The patch re-run changes nothing; it applies cleanly to the T1 build; `node scripts/data-extract.ts --check`
  passes; `node --test` 234/234 in IST and in UTC.
- The tax slides of a synthetic worst-case book (16 classes, both pre-2023 classes, ELSS lock-in, lots before 1 Feb
  2018, two later trades, an unreconciled and an unclassified holding) were rendered in PowerPoint and looked at: the
  class table fits with its two wrapped "Long term after" cells ("More than 12 months (3-yr lock-in)", "More than 24
  months (12 if listed ETF)"); with every conditional sentence at once the class footnote runs to a third line that
  touches the black band (recorded under KI-109); the harvest footer fits on two lines.
- **Not verified:** the Taxation tab in a browser (its HTML was rendered headlessly from the shipped renderer and
  checked in the tests); real client books and real base files with a Valuation Date column (no client data used).

## Scope of part T3 (the harvest, AIF and PMS treatment, the wording)
- **Acceptance:**
  - each client's harvest is worked out on that client's holdings alone; the family figures are the sum of the
    clients' figures, field by field; one client's loss never reduces another client's tax (TX-08, D-040 f);
  - the Rs 1.25 lakh Sec 198 exemption applies per client after set-off, only to listed shares, equity-oriented funds
    and REIT and InvIT units, less the amount already used this tax year that the analyst enters (default 0) (TX-09);
  - losses go first to the gains taxed at the highest rate; a slab-rate gain is ranked at the analyst's slab rate
    (default 30%) but never given a tax figure; gains inside the exemption are reached last (TX-16, D-040 e);
  - a Category III AIF has no investor-level gain, loss or tax (fund level); a Category I or II AIF (pass-through) and
    a PMS (per security) are not split by the investor's own flows; none is in the harvest; each is explained (TX-07,
    TX-12, TX-10, D-040 d, h);
  - the carry-forward sentence says "tax years" and the due-date condition on the tab and the slide (TX-22); the Crypto
    row states its source (TX-23, D-040 g);
  - every analyst input is on the Taxation tab, defaults marked, and stated on the harvest slide; the inputs are
    per-family state, cleared with the family (KI-001).
- **Non-goals:** the 31 Jan 2018 step-up (TX-18 step 2); security-level PMS statements and the AIF's annual statement
  (Form 64C) as inputs (new build, M7); whether "Listed AIF" means Category III; set-off against crypto gains; any
  change to the classes of T1 or the holding periods of T2.

## Decisions settled while building part T3 (for the owner to confirm; also in D-040)
- **Per client inputs.** The slab rate (0% to 30%, default 30%) and the Sec 198 exemption already used this tax year
  (Rs 0 to 1,25,000, default 0) are entered per client on the harvest card; a default is marked "(default)"; blank
  restores it; the slide states them (one line when every client has the same values).
- **Ranking.** Slab-rate gains are ranked at the slab rate and never quantified; the amount of slab-rate gains a loss
  shelters is shown. Sec 198 gains inside the unused exemption count as 0%, so they are reached last; a loss left
  after every other gain still goes to them (set-off comes before the exemption). Ties: a slab-rate gain first, then
  other gains before Sec 198 gains, short term before long term, then by class name.
- **Sec 198 rows:** listed shares, equity funds and ETFs, ELSS, equity-oriented hybrids, equity ETF FoFs, equity
  long-short SIFs, equity PMS, REIT and InvIT units. Not AIF Category I or II.
- **Not split.** Category III: "fund level", its own totals (CMV, Gain/Loss) and a Fund level column on the tab and the
  totals slide, no lot reconciliation. Category I and II: "pass-through", not classified, no lot reconciliation. PMS:
  "per security", not classified, its capital flows still reconciled. The AI Analyst gives each the reason, verdict n/a.
- **The family slide** adds the clients' pools up by class and head (each after its own set-off) with one exemption
  line; the tab lists them per client with a Client column. Holdings with no client name are one group, counted.
- **Crypto** stayed in the short-term pools at 30%; the re-review found that wrong while the owner's ruling is open,
  and part T4 keeps crypto out of set-off (below).

## The TAX_RULES fields (part T3)

| Field | Rows | Meaning |
|---|---|---|
| `sec198` | Listed Equity Shares, Equity Mutual Funds, Equity ETFs, Equity PMS, REIT Units, InvIT Units, Hybrid MF (equity-oriented), Equity ETF FoF (90/90), ELSS (3-year lock-in), SIF (equity long-short) | long-term gains share the Rs 1.25 lakh exemption (Master Summary column J) |
| `fundLevel` (months null, rate label "Fund-level", period "Fund level") | Equity AIF – Cat III (Listed Equity), Equity AIF – Cat III (Long Short) (the 39% rate removed), Debt AIF – Cat III | taxed at fund level (Master Summary #25) |
| `passThrough` (months null, rate label "Pass-through", period "At AIF level, per asset") | Equity AIF – Cat I/II, Debt AIF – Cat I/II | pass-through per underlying asset (Master Summary #24) |
| `perSecurity` | Equity PMS (rates unchanged) | taxed per security as if held directly (Master Summary #23) |
| `source` | Crypto (30%, any period, unchanged) | no reckoner row; kept as the law is unchanged (D-040 g) |
| `noSetOff`, `noSetOffSource` (part T4) | Crypto | kept out of set-off until the owner answers question 18; the basis in the row |

TAX_RULES stays at 34 rows.

## What changes, and for which books (part T3)
- **Every family with more than one client** whose losses sit with one member and gains with another: the family
  saving falls to what each person can achieve; the loss left over is shown against its owner.
- **Every client with Sec 198 long-term gains:** up to Rs 15,625 less tax before and after harvesting per client
  (12.5% of Rs 1,25,000), unless the analyst enters the exemption as used.
- **Every client with slab-rate gains and losses:** at the default 30% slab a loss shelters slab-rate gains before 20%
  or 12.5% gains, so the quantified saving can fall (the sheltered amount is shown).
- **Books with AIFs or a PMS:** their gains leave the long- and short-term columns and the harvest; a Category III AIF
  shows as fund level.
- **The synthetic sample book** (as on 30 Sep 2026): long term 5.547273 → 3.639173 Cr, not classified 0.797 → 2.7051
  Cr (its PMS 1.2565 and Alchemy 0.6516); tax before harvesting 0.267175 → 0.181787 Cr (− 0.0633125 PMS, − 0.01895
  Alchemy, − 2 × 0.0015625 exemption); client A 0.08756 Cr, client B 0.094227 Cr; no losses, so the saving stays 0.

## Changes (part T3)
- `tools/patches/2026-10-27-tax-3-harvest.js` (reference data, engine, exporters, UI); `index.html` MD5
  `AE70F78B0C89E57692EE9C71A2AC8358` → `BB888D8E272AADE90291ED0A6ECA1721` (16,856,968 → 16,885,458 bytes).
  - Engine: `taxAssumeFor`, `taxBuildHarvest` (one client's harvest: pools, the ranked set-off, the exemption),
    `taxSumHarvests` and `taxApplyAssumptions` (the family sum; exposed for the tab), `taxNotSplit`, at engine scope;
    `computeTaxation(rows, REF, asOn, assume)` builds per-client harvests, `fundLevel`/`passThrough` holdings skip the
    lots, `perSecurity` ones are not split after reconciling; the summariser keeps them out of the pools and reports
    `fundLevelCmv`, `fundLevelGain`, `notSplit` counts and `unnamedN`; `computeReview` passes `opts.taxAssume`; the AI
    Analyst tax signal gives a not-split holding its reason.
  - Screen: the assumptions table with the two inputs per client; the per-client pool table, the exemption line, "*" on
    Sec 198 pools and the new footnote; the method, ordering, sheltered slab gains, left-out and no-client-name notes;
    whose loss carries forward; "Fund level", "Not split", "Per security" and "At AIF level, per asset" in the class,
    holding and roll-up tables (a Fund level column when held); the notes on Category III, I and II and PMS; the Crypto
    source. `taxAssume` is cleared by `resetFamilyState`.
  - Slides: the class table and its footnote, the Total Gain/Loss tile, the totals (Fund level column when held), the
    holding detail cells, and the harvest slide (assumptions, per-client set-off, the exemption line, carry-forward,
    the sheltered slab gains, the holdings left out, rows fitted to the space above the note).
- `data/refdata/TAX_RULES.json` and `VINTAGE.json` regenerated.
- Tests: `tools/regression/KI-166-aif-cat-iii.js`, `KI-167-per-client-harvest.js`, `KI-168-sec198-exemption.js`,
  `KI-169-pms-not-split.js`, `KI-171-aif-cat-i-ii.js`, `KI-175-set-off-order.js`, `KI-181-carry-forward-wording.js`,
  `KI-182-crypto-source.js` (142 checks); `tools/regression/lib/tax-harness.js` (assumptions; `exemptionUsed()`; `taxTabLive`, the tab with its inputs live);
  KI-160, KI-162, KI-165, KI-170, KI-172, KI-173, KI-177 and KI-179 state their tax figures with the exemption taken as
  used, KI-180 the sample book's new totals; `tools/smoke-review.js` (fund level in the CMV check; the family harvest
  equals the clients' sum); `tools/browser-checks/family-isolation.js` (an assumption is cleared with the family).
- Docs: D-040, KNOWN_ISSUES (KI-166 to KI-169, KI-171, KI-175, KI-181, KI-182, KI-130, KI-064, KI-109), this record,
  the change-request index, CHANGELOG, PROJECT_STATE, legacy ARCHITECTURE, TESTING.

## Verification (part T3)
- `check-invariants`: all invariants hold, 1 known warning (KI-027). `smoke-review` 36/36. `test-ai-analyst` 24/24.
  `run-regression`: 35 files, 1,092 checks, all pass. `node scripts/data-extract.ts --check` passes. `node --test`
  234/234 in IST and in UTC.
- **Fail before:** the 8 new files run against the T2 page (`AE70F78B…`) all exit 1 (KI-166: 20 checks fail; KI-167:
  16; KI-168: 13; KI-169: 6; KI-171: 15; KI-175 stops at the first per-client harvest; KI-181: 5; KI-182: 3).
- Known answers from units x price, worked in each test: the verifier's S2 and S4 family books (saving 0 and Rs 2,000,
  were Rs 6,000), gains of Rs 1,00,000, 1,25,000, 1,25,001 and 1,50,000 (tax 0, 0, Rs 0.125, Rs 3,125), the verifier's
  cases 3 and 4 in both size orders (Rs 15,625 / 3,125 / 12,500), two clients each inside their own exemption (0),
  a Lakh file (same rupees), the set-off scenarios A, B and C at slab 30% and 10%, a Cat III gain of Rs 50 lakh (tax 0,
  was Rs 19,50,000), a Cat II AIF with drawdowns either side of 24 months (not split), a PMS shortfall (no "saving"
  of Rs 62,500).
- The patch re-run changes nothing. The tax slides of a synthetic two-client family (14 classes, a PMS, both AIF
  kinds, crypto, losses left over, a client with entered assumptions; family and one-client views) were rendered in
  PowerPoint and looked at: the class footnote fits on two lines, the totals tables with the Fund level column fit,
  the holding-detail rows show "Not split" and "Fund level", the harvest slide's table and note fit above the footer
  with the cut stated. The Taxation tab's HTML from the shipped renderer, with the page's CSS, was screenshotted in
  headless Edge: the assumptions table with its inputs, the per-client pool table and the notes lay out correctly.
  The inputs' handler runs headlessly in KI-168 (`taxTabLive`): typing Rs 1,25,000 for one client recomputes the
  harvest through `ENGINE.taxApplyAssumptions` (Rs 3,125 to 18,750), a blank restores the default, 50% is held to 30%.
- **Not verified:** the Taxation tab in a real browser (typing in the field, focus and layout at narrow widths), and
  `family-isolation.js`'s new check (written, not run in a browser); real client books (no client data used).

## Scope of part T4 (the financial re-review of part T3)
The re-review of part T3 (27 Oct 2026) checked the T3 patch against the reckoner's cells and its own recomputation
and found one calculation finding and two corrections to the records. Everything else in part T3 checked out.
- **F1 (P2), crypto set-off.** Part T3 left crypto gains in the short-term pools, ranked at 30%: a loss went to a
  crypto gain before every 20% and 12.5% gain, and a crypto loss reduced other gains or showed as carried forward,
  while whether either is allowed is question 18 below. Acceptance, until the owner answers it from an approved
  source (the safe behaviour):
  - the Crypto row carries a no-set-off flag and cites its basis in the row;
  - no loss is set against a crypto gain, which is taxed in full before and after;
  - a crypto holding's own loss is in no loss pool: it reduces no other gain and is never shown as carried forward;
  - a crypto holding at a loss is not offered as a harvest candidate;
  - one sentence on the tab's harvest card and on the harvest slide says so;
  - the family figures are the sum of the clients'; a book with no crypto is unchanged.
- **F2 (P3).** The PMS probe's former saving is Rs 62,500 (the T2 engine: Rs 1,25,000 before, Rs 62,500 after), not
  Rs 63,000 (KI-169, this record, the test's text).
- **F3 (P3).** 22 of the 23 findings are fixed and KI-177 in part, not 21 (this record, PROJECT_STATE).

## Changes (part T4)
- `tools/patches/2026-10-27-tax-4-review.js` (reference data, engine, exporters, UI); `index.html` MD5
  `BB888D8E272AADE90291ED0A6ECA1721` → `61FC0FB25FB1429F805B140FBA6B308E` (16,885,458 → 16,887,846 bytes). A new
  script, so the T3 patch stays as reviewed; re-running T3 on the T4 build stops as "partly present", as for every
  later patch.
  - Reference data: the Crypto row gets `"noSetOff":true` and `noSetOffSource` ("No set-off either way until the owner
    rules (CR-0008, question 18): the Tax Reckoner TY 2026-27 is silent on virtual digital assets, and Sec 115BBH of
    the 1961 Act allowed no loss to be set against a crypto gain and no crypto loss to be set against other income or
    carried forward."). TAX_RULES stays at 34 rows.
  - Engine (`taxBuildHarvest`, `07_engine.js:537`, T4 build): a pool of a `noSetOff` row is marked and gets no set-off
    slot (`:561`); the class's losses go to `noSetOffLoss` instead of the loss pools, and its gains are counted in
    `noSetOffGain`; a holding of such a row is not a candidate (`:603`); `TAX_HARVEST_SUM` adds both, so the family sums
    them.
  - Screen: the harvest card shows when the only loss is a crypto loss, and says "Crypto gains and losses are kept out
    of set-off pending the owner's ruling, as the reckoner is silent on them: no loss is set against a crypto gain (the
    gain, taxed in full before and after), and a crypto loss (the loss) reduces no other gain, is not carried forward
    and is not listed as a holding to sell." Slide: the same, in the harvest note, worded for the client ("pending a
    ruling on their treatment"), and the slide is made when the only loss is a crypto loss.
- `data/refdata/TAX_RULES.json` and `VINTAGE.json` regenerated.
- Tests: `tools/regression/KI-182-crypto-no-set-off.js` (30 checks); `tools/smoke-review.js` (the family sum includes
  the two new figures); `KI-169-pms-not-split.js` (its text: Rs 62,500).
- Docs: D-040 (the crypto bullet of the T3 notes, the consequences), KNOWN_ISSUES (KI-182, KI-175, KI-169; the
  introduction), this record, the change-request index, CHANGELOG (the part T2 entry's lost heading line restored),
  PROJECT_STATE, legacy ARCHITECTURE, TESTING.

## Verification (part T4)
- `check-invariants`: all invariants hold, 1 known warning (KI-027). `smoke-review` 36/36. `test-ai-analyst` 24/24.
  `run-regression`: 36 files, 1,122 checks, all pass; the 27 tax files also with `TZ=UTC`. `node scripts/data-extract.ts
  --check` passes. `node --test` 234/234 in IST and in UTC.
- **Fail before:** `KI-182-crypto-no-set-off.js` run against the T3 page (`BB888D8E…`) exits 1 with 28 of its 30 checks
  failing (the two that pass there: the family adds up, and a book with no crypto shows no crypto sentence).
- Known answers from units x price, worked in the test: (i) a Rs 1,00,000 crypto gain, a Rs 20,000 equity short-term
  loss and a Rs 2,00,000 equity long-term gain: before Rs 39,375, after Rs 36,875, saving Rs 2,500 (part T3: Rs 6,000);
  crypto tax Rs 30,000 before and after; the loss takes the 12.5% part above the exemption. (ii) A Rs 1,00,000 crypto
  loss and a Rs 1,00,000 equity short-term gain: Rs 20,000 before and after, saving 0 (part T3: Rs 20,000); no loss
  pool, no carry-forward, no candidate. (iii) Their family: Rs 59,375, Rs 56,875, Rs 2,500, each figure the sum of the
  clients'; one client's crypto gain and crypto loss do not net. (iv) Without the crypto holding, case (i) gives Rs
  9,375, Rs 6,875 and Rs 2,500, as before; the sample book (KI-180) is unchanged. The same family ten times larger in
  a Lakh file shows Rs 7.34 L, Rs 7.09 L and Rs 0.25 L on the tab and the slide, the same as the engine.
- The patch re-run changes nothing.
- **Not verified:** the tab and the slide in a browser and in PowerPoint (the harvest slide's note grows by one
  sentence when crypto is held; its rows are fitted to the note's length, as in part T3, but the layout was not looked
  at); `family-isolation.js` (still not run in a browser); real client books (no client data used).

## Rebased on fix batch 4
On 27 Oct 2026 the branch merged `main` at `6443826` (PR #14 and #15, new-build records; PR #16, fix batch 4: base-file
reading, CR-0009, D-041). `index.html` was rebuilt from main's page (`12B5E5727FCA01EF2EA162C59913F01D`) with the four
tax patches in file-name order: T1 `22019426…`, T2 `B8722C4E…`, T3 `D321DBA0…`, T4
`0713C6BEEFCB35D778730AB9BEF3E430`. T1, T3 and T4 apply unchanged. T2 has two anchor revisions, both where the two
batches' logic meets in `computeTaxation`; no other tax behaviour changes:
1. **"An unreconciled holding says when trades were left out (TX-17), no lots"**: its anchor, the one line
   `out.unreconciled.push(rec); return; }`, occurred twice on main's page, because fix batch 4 (KI-140) added an
   unreconciled exit for a merged folio with blank units that closes with the same text. The anchor now carries the
   line before it, the end of the no-lots reason; the inserted TX-17 line is unchanged.
2. **New edit, "... (TX-17), merged units blank (KI-140)"**, anchored on fix batch 4's closing line with the end of
   its reason. Part T2 says an unreconciled holding's reason says when some of its trades were left out; fix batch 4's
   merged folio with blank units is an unreconciled holding, so its reason (fix batch 4's, unchanged) is followed by
   the same TX-17 sentence when one of its IRR trades is dated after the valuation date. With the anchor revision
   alone it would not say so. Known answer in `KI-176-valuation-date.js` (2 new checks; the second fails on the
   anchor-only build `F87DB859…`).

Where the two batches meet, as built (no further code change; pinned by new checks):
- A Category III AIF (fund level) and a Category I or II AIF (pass-through) are never reconciled (D-040 d), so their
  check runs before fix batch 4's blank-units exit: a merged AIF with a folio without units stays fund level or
  pass-through, never unreconciled (`KI-166-aif-cat-iii.js`, 1 new check).
- A PMS is not split only after its capital flows reconcile (part T3). A merged PMS with a folio with units beside one
  without cannot be checked, so it is unreconciled with fix batch 4's reason, out of the harvest and not classified; a
  PMS whose folios all lack units is priced in rupees, not a gap, and stays not split (`KI-169-pms-not-split.js`, 2
  new checks).
- KI-145's reading of the Asset Name reaches the tax classes, as CR-0009 intends: `taxClassify` reads the label, so
  "Fixed Income" is Debt for the AIF, PMS and unlisted classes. KI-145's own tax check passes on the combined page.
- Fix batch 4's merged purchase dates, holding days and notices do not reach Taxation, which ages the IRR sheet's lots.

Not changed, for the lead: CR-0009's acceptance notes that the Taxation tab's unreconciled table keeps its general
heading ("the history is missing an event") for a merged holding with blank units, "worded by reason in the tax batch".
The tax batch words the table of holdings with no tax class by reason, not the unreconciled one, so on the combined
page that heading is still general (with an em dash that predates both batches); each row's own reason is right. It
is wording, not a figure, and outside a rebase of the anchors.

Verification on the rebuilt page: two rebuilds from main's page in scratch copies both give `0713C6BE…`, the committed
page; each patch run a second time right after itself reports no change, and a second run of the whole sequence
writes nothing (T1 to T3 stop as already superseded, T4 reports no change, as on the branch before the merge).
`check-invariants --expect-md5 0713C6BEEFCB35D778730AB9BEF3E430`: all invariants hold, 1 known warning (KI-027).
`smoke-review` 36/36 (IST and UTC), `test-ai-analyst` 24/24. `run-regression`: 43 files, 1,277 checks, all pass in IST
and with `TZ=UTC` (fix batch 4's 7 files 150 checks, the 24 tax files 628). `data-extract --check` passes
(`data/refdata/` regenerated from the page: unchanged). `node --test` 234/234 in IST and in UTC; `docs-links`
and `traceability` pass. Not verified: the browser acceptance of the combined page (still due before the merge, as for
part T4).

## Scope of part T5 (the follow-ups to parts T1 to T4)
Part T5 is the last piece of task TA-03 (EX-01; REQ-066, REQ-029). It carries what the build of parts T1 to T4 left open,
the owner's answers to questions 17 and 18 (2 Nov 2026; D-043), the changes that the contract review asked for, and the
corrections from the independent review of the part itself. It is one new patch, `tools/patches/2026-10-27-tax-5-followups.js`,
applied after the T4 patch; it changes the engine, the exporters, the UI and the parsers scripts. TAX_RULES is unchanged
(34 rows).
- **Acceptance:**
  1. **The usual bucket, dated (TR-7, LD-11 of the new build).** Aggressive hybrid, arbitrage and equity savings funds are
     equity-oriented (Master Summary rows 16 to 18, column P; Hybrid Funds & FoFs D19 to D21) only when the tax reference
     date (D-040 a) is on or after 1 Apr 2026, each labelled "usual bucket per the tax reckoner; confirm with the fund
     house" on the tab, the class slide and the AI Analyst. Before that date they are unclassified, with a reason that asks
     for the AMC's classification for that year. A mutual fund whose name says arbitrage is read as an arbitrage fund
     when no earlier test claims it (a fund-of-funds name, a global category, a gold asset, a non-fund product, or a
     balanced, aggressive or conservative hybrid or equity savings category does), so a fund with a blank category, or
     filed as Debt or Liquid, is one. `taxClassify(h, R, refDate)` and `taxClassOf(h, R, refDate)` take the date as a
     third, optional argument; `computeTaxation` passes its own, so every reader of `model.taxation` sees one class per
     holding.
  2. **No "-Rs 0.00".** An amount that rounds to zero shows 0 without a minus sign (the Sec 198 exemption line, the pool
     table's "Loss set off" cells, on the tab and the harvest slide).
  3. **The unreconciled table says why.** Its heading on the Taxation tab names the reason of the holdings it lists:
     merged folios with blank units (KI-140), no purchase still held, fewer or more units than the base file (more units
     with a sale, switch out or transfer out that states an amount and carries no price is its own reason), invested
     value. Each record carries the
     reason's kind (`unrec`). The two unit and value reasons lose their dash and say which way the units differ; the
     holding-detail slide no longer says such holdings have "no lot history".
  4. **An AIF whose category is stated nowhere** (not in its category, name or product, not in the performance entry it
     matched, not called a Listed AIF) is still Category I or II, pass-through, marked `catAssumed`: the tab, the class
     slide (in full) and the harvest slide (in its "Left out" line) say it is treated as Category I or II because the
     file does not state Category I, II or III, and ask the analyst to confirm it against the AIF's statement. The AI
     Analyst signal carries the same sentence, which no page or slide shows today: AIFs are listed under "Not
     assessed", whose row prints only a general reason.
  5. **Wording part T3 left stale:** the holding-detail slide no longer says PMS and unlisted AIF show a dash in the
     unit columns, and the tab and the class slide no longer say LTCG + STCG add back to every holding's Gain/Loss. The
     class slide's footnote, which the sentences of items 1 and 4 can take past two lines, grows upward from its third
     line instead of running into the black band (KI-109).
  6. **The harvest slide's "Left out" line** gives the count and the CMV, as the tab does.
  7. **The harvest assumption inputs are text fields** that read Indian and international digit grouping ("1,25,000",
     "125,000", "1 25 000"), a currency mark ("₹", "Rs", "Rs.", "INR", "INR." in front; "/-", "/=", "INR", "Rs" behind),
     a "%" in the slab-rate field and an exponent; only a blank or non-numeric entry restores the default, and the field
     says nothing when it does. (A number field reads such entries differently in different browsers; an entry of
     "1,25,000" that restored the default without a word was reported, and the cause is **UNKNOWN**. A text field reads
     the same everywhere.)
  8. **A comment only (KI-184):** the foreign-share marker reads the ISIN of the matched reference entry; the base file's
     own ISIN column is not read. D-040 point (c) is corrected to say so.
  9. **The harvest defaults the engine exports (`ENGINE.taxDefaults`) are frozen** and `ENGINE_KEYS` in
     `check-invariants.js` lists all 28 names (KI-185). Added by ARC-01's review of the change-impact contract.
  10. **A Listed AIF is Category III** (question 17, answered 2 Nov 2026; D-043): fund level, marked `catRuled`, with a
      note on the tab, the class slide and the harvest slide's "Left out" line (and in the AI Analyst signal, item 4) that
      asks the analyst to confirm the category against the AIF's statement. What an AIF's own words state wins; when they
      state none, so does the category of the performance entry it matched ("AIF (CAT III) - Listed Equity" is Category
      III), but only when the holding's name is the entry's own name once normalised: the name matcher is loose, and a
      sibling series it maps to the entry is not told the entry's category. A "Listed AIF" label from a looser match
      still gives Category III, with the note, unless the AIF's own category says unlisted. The category is read once,
      in `taxClassify`, so items 4 and 10 cannot disagree.
  11. **An IRR date written with an explicit zone is read as the day it states** (KI-186; I-04): "2023-04-01T20:00:00Z"
      is 1 Apr 2023 in every time zone. Only ISO-like date-times are read as written; any other text still goes through
      `Date` and keeps the machine-local day (the residue: RFC 2822 strings, an hour-only offset, a zone word, a bare Z;
      and the ISO year and year-month, which are a day earlier west of UTC, as in part T2). A Z time is its UTC day, as
      on `main`: an Indian local midnight written in UTC reads as the day before. Added by ARC-01's review of the
      contract.
- **Corrections from the independent review** (the reviewers' ids are in the patch header and the table below): one reader
  for an AIF's category (R2-F1, R3-F1); the usual-bucket note names a scheme held by several clients once (R2-F2); the
  65% test is said to be an average over the tax year (R2-F4); a sale with no price has its own unreconciled reason
  (R5-F1); the harvest inputs also read a leading rupee sign, Rs, Rs. or INR, a trailing "/-", a "%" in the slab-rate
  field and an exponent (R4-1, R4-2); the class footnote fits at 8, 7 or 6.5 pt and always ends at the band's edge
  (R6-1, R7-F2); the holding-detail footnote is shorter and agrees in number (R5-F4, R7-F1, R8-F3); "the tax reckoner"
  everywhere, never "the owner's reckoner", because the AI Analyst slide goes to the client (R8-F2).
- **Corrections from the delta review of those corrections** (a second, smaller review; ids D1 to D6 and their finding
  numbers, in the patch header and the second table below): the performance entry's category is a statement about the
  fund only when the names are the same once normalised (D1-F1); a few more separators between "category" and its
  number, and an own category of "unlisted" blocks the Listed AIF label (D1-F2, D1-F3); a priceless sale that states no
  amount is not blamed, and the sentence names a switch out (D3-F1); "INR." with a dot, and a trailing "/=", INR or Rs,
  are read (D3-F3, D3-F4); the class slide and the harvest slide count holdings in the singular and the plural (D3-F5,
  D4-F3); "the file does not state Category I, II or III" (D5-F3); the Category III row is picked from the category and
  the name, as before (D6-3); header, labels and comments say what the code does (D5-F1, D5-F2, D6-1, D6-4).
- **Non-goals:** fixing KI-184 (TA-06), KI-183 (TA-05) and D-042; the grandfathering step-up (KI-177 step 2); any code for
  question 18 (the owner kept "no set-off", which part T4 built); any change to a tax figure the earlier parts settled,
  except the dated classes of item 1.

## What the brief for part T5 asked, and where each item is
The patch header of the first build of the part (`0f1c5d3`, a work-in-progress checkpoint) lists seven code items; the
handover lists, besides them, the correction of D-040 point (c) with the cross-reference to the new build's tax table,
and the KI-184 ISIN column. Items 1 to 7 above are the seven code items, built as the header says; item 8 is the KI-184
comment; the D-040 text, the cross-reference and KI-184 are in D-040 and KNOWN_ISSUES. Items 9 and 11 came from ARC-01's
review of the change-impact contract, item 10 from the owner's answer to question 17. **[UNCERTAIN]** whether the brief
written before the hand-off held more than the handover records: the brief itself was not available, and every item the
handover names is accounted for here.

## Decisions settled while building part T5 (also in D-040 and D-043)
- **Usual bucket, dated.** As item 1. The reference date is the assumed sale date: a review valued before 1 Apr 2026
  asks about a sale before the usual bucket applied. The reckoner calls the bucket equity-oriented only while 65% or more
  of the fund is in listed Indian equity on average over the tax year, so the AMC's year-end classification stays the
  check. For the owner to confirm, as for every default.
- **The AI Analyst moves with the class (PD-50).** Its tax signal has weight 7 in the composite, so the class a fund
  takes, and for these three fund kinds the review date, change the composite, the trim amounts, the target weights,
  the action label (Exit, Partial, Retain) and the number of exits, top-up candidacy, the plan summary and, through
  "Apply plan to Portfolio Rebalancing", the Rebalancing tab and its exports (measured on a synthetic stress book: one
  fund's release 0.37 to 0.54 Cr, its target weight 6 to 3; ARC-01's scan of 98 usual-bucket funds with only the as-on
  date changing: target weight or trim differs for 15 funds and the action for 2 with long-term lots, 4 and 4 with
  short-term lots; the figures are in D-040). An amber verdict (mostly short-term lots) lowers the composite, so the AI
  Analyst trims more when lots are short term, the costly direction to sell. The same weight moves ordinary funds when
  their lots change: it is the design of the signal, not a defect of part T5. Built: the signal uses the class, as it
  does for every other fund. The alternative, "not assessed until the analyst confirms the class", is one line in
  `aiaSigTax` (not one line if "until confirmed" is meant: the page has no control to confirm a class) and takes the
  arbitrage score away from the live page; it awaits the owner's answer (question 21). The code comment above
  `aiaSigTax` said tax was "never a reason to act"; stage S8 corrects it to say what the weight does.
- **An AIF's category is read once** (D-043): the fund's own words, then the performance data's category for the fund it
  matched (when the holding's name is the entry's own once normalised), then "Listed AIF" (Category III, with a note),
  else Category I or II assumed, with a note. The words that count are cat or category followed by III, II, I, three,
  two, one, 3, 2 or 1, with spaces, dots, brackets (round, square or curly), slashes, underscores, hashes, commas or
  dashes between; "AIF-II" is not read, because a series number such as "Fund III" would then be taken for a category,
  and neither is "Category No. III". Two readings the financial reviewer should know (ARC-01's data points, pinned in the
  tests as built): "Category II/III" reads as Category II, as stated (the first number), and "AIF-III" reads as nothing:
  Category I or II assumed, with the note. A stated Category III or Listed AIF carries no mark on the holding-detail and
  totals slides.
- **IRR dates with an explicit zone** are the day written (item 11). Whether real exports hold such strings is
  **UNKNOWN**.
- **Client-facing wording** says "the tax reckoner". The new build's design (LD-11) words the label "the owner's
  reckoner"; NB-01 decides whether it follows.

## What changes, and for which books (part T5)
- **A review valued on or after 1 Apr 2026 that holds equity savings funds:** they are classed (Hybrid MF
  (equity-oriented), usual bucket) and so enter the lots, the long- and short-term columns and the harvest; part T1
  left them unclassified. Aggressive hybrid and arbitrage funds are classed as before and now carry the mark.
- **A review valued before 1 Apr 2026 that holds aggressive hybrid, arbitrage or equity savings funds:** all three are
  unclassified, with a reason. Their CMV and Gain/Loss leave the long- and short-term columns and the harvest and sit in
  "not classified"; the tax before and after harvesting, and the saving, change by what they had added. (Part T1 classed
  aggressive hybrid and arbitrage in every review.)
- **The AI Analyst of a book that holds those funds:** the tax signal follows the class, so the composite, the trims, the
  target weights, the action labels (an Exit can become a Partial or a Retain) and the plan summary can change (PD-50).
- **A book with AIFs:** a Listed AIF becomes Category III, fund level: its CMV and Gain/Loss move from "not classified"
  to a "Fund level" amount, and no tax, LTCG or STCG figure moves (it was pass-through, out of the harvest, and is now
  fund level, out of the harvest). An AIF whose category is stated nowhere keeps its treatment and gains the note.
- **An IRR sheet with date-times that name a zone:** the day no longer depends on the machine's time zone. The sample
  files have none.
- **Every book:** the harvest inputs accept the forms above; a zero never shows a minus sign; the wording described
  in items 3, 5 and 6.
- **The synthetic sample book** (as on 30 Sep 2026): no tax, LTCG, STCG, estimated tax, saving, harvest or total CMV
  moves; the not-classified CMV and gain move into a Fund level amount (2.7051 to 2.0535 Cr, new 0.6516 Cr; gain 0.8051
  to 0.6535 Cr, new 0.1516 Cr). The reason shown for a balanced advantage, dynamic asset allocation, multi asset or life
  cycle fund no longer names equity savings.

## Changes (part T5)
- `tools/patches/2026-10-27-tax-5-followups.js` (engine `07_engine.js`, exporters `08_exporters.js`, parsers
  `09_parsers.js`, UI `11_app_ui.js`); `index.html` MD5 `0713C6BEEFCB35D778730AB9BEF3E430` →
  `91D6530F428A7668F2CE7E43B0E57F7D` (16,898,566 → 16,917,282 bytes). It lands in seven commits, so a reader can check
  each step against the page it was made from: the first build of the part (`0f1c5d3`, a checkpoint: items 1 to 8, page
  `5F1C2FC5…`), then item 9 and the 28 `ENGINE_KEYS` (`B8385B44…`), item 11 (`441735DD…`), item 10 (`6358613B…`), the
  corrections from the independent review (`729855E8…`), the corrections from the delta review (`9375366F…`) and the
  additions after ARC-01's pre-review (`91D6530F…`; the page differs from the one before in two code comments only).
  Re-running the patch on its own result changes nothing; the page is the T4 page (`97a7d69`) plus this patch.
  - Engine: `taxClassify` and `taxClassOf` take the reference date, with `TAX_USUAL_FROM` and the `UB` helper; the AIF
    category is read once (own words; then the category of the matched AIF_PERF entry, which `computeReview` has linked
    to the row as `perfKey`/`perfSrc` before it calls `computeTaxation` (unchanged), when the holding's name is the
    entry's own once normalised; then "Listed AIF"; else assumed; `catRuled`, `catAssumed`, `usualBucket` on the
    record); the summariser totals `notSplit.fundLevel.ruledN`/`ruledCmv` and `passThrough.assumedN`/`assumedCmv`;
    the unreconciled kinds (`unrec`, including `noPxSell`); the AI Analyst tax signal gives the usual-bucket, assumed-
    and ruled-category sentences and one general sentence for an unreconciled holding; `ENGINE.taxDefaults` frozen.
  - Parsers: `irrParseDate` reads an ISO-like date-time with an explicit zone as the day written, and only text that
    `Date` has accepted (the set of texts read is the T4 page's).
  - Screen: the usual-bucket, pass-through and Category III notes, the row sub-labels, the "Left out" lists, the
    unreconciled heading by reason, the harvest inputs as text fields, no minus zero.
  - Slides: the class slide's sentences and footnote fit (`_footFit`), the harvest slide's "Left out" line, the
    holding-detail footnote.
- `tools/check-invariants.js`: `ENGINE_KEYS` holds 28 names (adds `amcKey`, `taxClassify`, `taxApplyAssumptions`,
  `taxAssumeFor`, `taxDefaults`, `xirr`), and the check runs both ways: an export that the list does not name fails too
  (KI-185; stage S8).
- Tests (new): `tools/regression/CR-0008-T5-followups.js` (items 1 to 9 and the corrections; the class footnote at 8,
  7 and 6.5 pt, each in a book of its own, with its lines, its bottom anchor and its clearance from the table),
  `CR-0008-T5-item10-listed-aif.js` (the four steps, the debt and long-short rows, every surface; every separator of the
  reader's pattern in the fund's own words and in the performance entry's text), `CR-0008-T5-item11-irr-zone-dates.js`
  (34 ISO-like forms in eight zones, 9 forms pinned as machine-local, 9 refused strings, and a known answer from the text
  through `parseIRR` into the XIRR and the tax lots), `KI-185-engine-keys.js` (the real check run against the page and
  against three planted pages); changed: `KI-170-hybrid-funds.js`, `KI-171-aif-cat-i-ii.js`, `KI-180-debt-row-section.js`;
  `tools/regression/lib/tax-harness.js` (the tab and slide helpers the new files use).
- Docs: D-040 (point (c) and (d), the usual-bucket text, the part T5 paragraph), D-043, KNOWN_ISSUES (KI-184 to KI-186,
  KI-200 to KI-206; KI-022, KI-109, KI-166, KI-170, KI-171, KI-182), this record, the change-request index, CHANGELOG,
  PROJECT_STATE, legacy ARCHITECTURE, TESTING.

## Verification (part T5)
The figures below are those of the final page (`91D6530F…`) in scratch copies of the branch; the full set is run again
on the committed head, and the head's results are in the pull request.
- `check-invariants --expect-md5 91D6530F428A7668F2CE7E43B0E57F7D`: all invariants hold, 1 known warning (KI-027).
  `smoke-review` 36/36 (IST and UTC). `test-ai-analyst` 24/24. `run-regression`: 47 files, 1,582 checks, all pass in IST
  and with `TZ=UTC`. `node --test` 234/234 in IST and in UTC (run from a short path: from a long folder name `esbuild`
  cannot start and 45 build tests are cancelled, which is the machine, not the code). `node scripts/data-extract.ts
  --check` passes. `docs-links` and `traceability` pass; the privacy scan with the private deny-list reports no
  blocking line.
- **Fail before** (the final test files against the page they were written for): `CR-0008-T5-item10-listed-aif.js` (85
  checks) run against the page before item 10 (`441735DD…`) fails 60; `CR-0008-T5-item11-irr-zone-dates.js` (50 checks)
  run against the T4 page (`0713C6BE…`) fails 32, four in each of its eight zones (the 34 forms, the XIRR, the two lots,
  the tax; UTC included: "2023-04-01T00:00:00+05:30" reads as 31 Mar there), while its pinned-residue and refused-string
  checks pass (they pin what did not change). The corrections of the delta review were tested against the page before
  them (`729855E8…`): the new and changed checks of `CR-0008-T5-followups.js` (17), `CR-0008-T5-item10-listed-aif.js` (8)
  and `KI-170-hybrid-funds.js` (1) failed there. `KI-185-engine-keys.js` run with the check of the stage before (one way)
  fails 3 of its 5 checks: neither planted extra export is noticed, and the old check's message lacks "no more and no
  less". The other checks added at stage S8 pin behaviour the stage before already had: all four S8 test files pass on
  the page of stage S7 (100, 85, 50 and 5 checks), and the mutants below are what fail them.
- **Mutants** (stage S8): 146 small edits of the page or of `check-invariants.js`, each run against the test files
  meant to notice it: the clauses of the IRR date pattern (18), the four copies of the AIF reader's pattern, with each of
  its separators, the word boundary, the quantifier and the number words (92), the class footnote's fit (31) and the
  two-way check (5). 144 are killed. The other two are equivalent: the `^` and the `$` of the date pattern sit behind
  the `Date` gate, and the `Date` of V8 (which these tests run on) accepts no text with anything before or after an ISO
  date-time, so no input tells the pattern with and without them apart; they stay as a guard for other engines. 16 of the
  146 survived the first version of the S8 checks (the entry branches of the AIF reader, the 8 and 7 pt branches of the
  footnote, the clearance margin) and are killed by checks added afterwards. The list and the runner are scratch
  files, not part of the repository.
- **Rebuild:** the T4 page plus the final patch gives `91D6530F…`; each stage of the commits rebuilt from the T4 page
  gives the MD5 above, and every patch run a second time reports no change.
- Known answers from units x price, worked in the tests: the usual bucket on and either side of 1 Apr 2026; a book of
  only usual-bucket funds before 1 Apr 2026 (every holding unclassified, the AI Analyst gives each its reason); an AIF in
  each of the four steps with the Category II-in-the-name-and-"Listed AIF"-in-the-data case; a Rs 1,25,000 entry in the
  harvest field in each of its forms; a sale with no price (no unit ledger entry, its own reason) beside the same history
  with a price (reconciles); the sample book's totals as above.
- **Not verified:** the Taxation tab and the tax slides in a real browser and in PowerPoint on the committed head (the
  slide geometry for a table of 13 or more classes is not run; a synthetic deck is left for the owner to open); real
  client books (no client data used); real IRR exports that name a zone; the AI Analyst on a real book of usual-bucket
  funds.

## The independent review of part T5
Eight reviewers read the part, one for each slice (R1 classification, R2 the marks, R3 the AIF category, R4 numbers and
inputs, R5 unreconciled holdings, R6 slides, R7 tests and fail-before evidence, R8 what the part must preserve and
KI-184). Each medium finding went to three skeptics who tried to refute it (does it reproduce, is it intended, is it
reachable); a finding died when two or three refuted it. A completeness critic read the result. 51 findings: 10 medium
and 41 low. "Skeptics" is how many of the three refuted the finding.

| ID | Sev. | Skeptics | Finding | What became of it |
|---|---|---|---|---|
| R1-F1 | medium | 3 of 3 | An equity and G-Sec blend filed under Equity Savings is now classed | Dead. The category-first order is old and no wrong figure shows |
| R1-F2 | low | | An unreadable date counts as no date; a Date at IST midnight on 1 Apr reads 31 Mar | No change; the page cannot pass either |
| R1-F3, R2-F5 | low | | The arbitrage category test runs before the product tests; the name test before the balanced-advantage and debt tests | KI-200 |
| R1-F4, R3-F2, R8-F6 | low | | The header said the name is read only when the category is blank; which slides carry the AIF sentence; "as before" for a call with no date | Header reworded |
| R1-F5 | low | | Dead "equity savings" alternatives in two hybrid expressions | No change; harmless |
| R1-F6, R8-F8 | low | | Records still said equity savings are unclassified; KI-022 incomplete | Docs: D-040, KI-170, KI-022, this record |
| R2-F1 | medium | 1 of 3 | AIF categories spelled "Category: II", "(III)", "– II", "Cat 3" counted as not stated | Fixed: one reader (item 10's), safe for forms it does not read |
| R2-F2 | low | | A scheme held by several clients is named once per client in the usual-bucket note | Fixed: each scheme once, "and N more" |
| R2-F3 | low | | The slides give no reason for usual-bucket funds unclassified before 1 Apr 2026 | KI-206 |
| R2-F4 | low | | The 65% sentence is looser than the annual-average test; the AIF row label contradicts the visible category | Fixed: "on average over the tax year"; "Category I, II or III not stated in the file" |
| R2-F6, R3-F7 | low | | Test gaps (names once, "and N more", four AIF cases) | Added |
| R3-F1 | low | | The "stated" and Category III patterns disagree | Fixed with R2-F1 |
| R3-F3 | low | | Wording: an unqualified "category"; a colon reads as the consequence | Partly: "Pass-through means that income ..."; the AIF's statement stays the document named |
| R3-F4 | low | | The default direction against the reckoner for listed-equity strategies | Answered by question 17 (item 10) |
| R3-F5 | low | | "₹0.00 Cr" printed for an AIF with no invested value | KI-201 |
| R3-F6 | low | | `assumedCmv` computed and never used | Used in the "Left out" lists |
| R4-1 | medium | 1 of 3 | An amount with a rupee sign, Rs or "/-" restored the default without a word | Fixed: the forms are read (five forms tested); "1.25 lakh" is still not read. The same rebuild (17:36, 2 Nov) also strips a trailing "%" in the slab-rate field only; ARC-01 asked for it to be listed |
| R4-2 | low | | "1e5" restored the default; a decimal comma reads as a thousands comma | Exponent read; the comma stays Indian grouping |
| R4-3 | low | | The zero helper shows ₹0.00 for NaN | No change; nothing reaches it |
| R4-4, R7-F5 | low | | The tests use a fake DOM and whole numbers | No change; real-browser typing is in the browser acceptance |
| R4-5 | low | | Focus falls to the page body after a commit | KI-202 |
| R5-F1 | medium | 1 of 3 | A sale or transfer out with no price never reaches the unit ledger; the heading says a sale is missing | Fixed: its own reason (`noPxSell`), heading sentence and known-answer test; no number moves |
| R5-F2 | low | | The AI Analyst gives one general sentence for unreconciled holdings; a comment said "own reason" | Comment corrected |
| R5-F3 | low | | A merged position counts only the members that are positions | KI-203 |
| R5-F4 | low | | "1 holding(s)" on the holding-detail slide | Fixed |
| R5-F5, R5-F6 | low | | Dashes and "lot history" in sentences part T5 did not touch; the no-lots reason has no full stop | KI-204 |
| R5-F7 | low | | Tests miss reachable paths | Added: all-unreconciled AI Analyst, an unpriced sale, the "other" kind |
| R6-1, R7-F2 | medium | 1 of 3, 0 of 3 | The class footnote reaches the black band when 13 or 14 class rows show | Fixed: 8 pt, 7 pt or 6.5 pt, always ending at 7.18 in; a 20-class test. The skeptics rate it cosmetic |
| R6-2 | low | | The slide test pins one nine-class book | A wide-table test added |
| R6-3 | low | | The class table shows the 14 largest classes and says nothing about the rest | KI-205 |
| R7-F1, R8-F3 | medium | 3 of 3 | The holding-detail footnote is 22 characters longer | Dead as stated (PowerPoint puts it on two lines before and after); shortened anyway, with a length check |
| R7-F3 | medium | 1 of 3 | Zero-minus proven only for exact zeros on a Lakh file | Crore cases added |
| R7-F4 | low | | The AI Analyst leg for "unreconciled only" untested | Added |
| R7-F6 | low | | `KI-170` aborts with a TypeError on the old page | `pos()` made null-safe: a failed check instead |
| R7-F7 | low | | The follow-ups test hard-codes AIF_PERF counts that change with the monthly refresh | Counts read from the data |
| R7-F8 | low | | "and N more" and the unreconciled kind "other" untested | Added, with a fallback sentence for "other" |
| R7-F9 | low | | Reviewer environment (a TZ value with a slash typed in Git Bash is dropped) | Information; TESTING now says so |
| R8-F1 | medium | 2 of 3 | The usual bucket moves the AI Analyst's trims, weights and plan summary | Dead as a defect (the tax signal's designed use); disclosed, and put to the owner (PD-50, question 21). ARC-01 (2 Nov 2026) found the disposition at odds with the code comment above `aiaSigTax` ("never a reason to act") and that the action labels and the Exit count move too: the comment was wrong, not the design; stage S8 corrects the comment and this record, D-040 and KI-170 list what moves |
| R8-F2 | medium | 1 of 3 | "per the owner's reckoner" on an AI Analyst slide in the client deck | Fixed: "the tax reckoner" everywhere |
| R8-F4 | low | | The header cited KI-184 and a D-040 correction that did not exist | Docs added |
| R8-F5 | low | | The KI-162 test names say "base row's own ISIN"; nothing pins that it is never read | A check added (KI-184 open) |
| R8-F7 | low | | `docs/legacy/ARCHITECTURE.md` lists 25 engine names; the page has 28 | Docs |
| (own) | low | | The first version of item 11 (the page called `AC0AC916…` in the second addendum) read "2023-13-45T10:00:00Z" as a date, and 833 more texts than the page before item 11 (found by ARC-01's interim check) | Fixed at the 17:36 rebuild: the zone-naming pattern is tried only after `Date` has accepted the text, so the set of texts read is the T4 page's and an impossible month, day, hour, minute or offset is still dropped (no change of acceptance in 40,794 matrix cells, ARC-01's check). The test has nine refused strings in eight zones. Listed here at ARC-01's request |

Findings that changed nothing are in the register (KI-200 to KI-206), in the tests, or in these records with their reason.

## The delta review of the corrections (part T5)
The corrections that answered the first review changed the part's page from `5F1C2FC5…` (the first build) to `729855E8…`,
so a second, smaller review read that difference: six reviewers (D1 the AIF category reader, D2 the IRR dates, D3 the
corrections in the engine and the tab, D4 the tax slides, D5 wording and hygiene, D6 what the part must preserve), with
three skeptics on the one medium finding. It found 31 findings, one medium and 30 low; the corrections that answer them
are the sixth commit of the part (`9375366F…`; ARC-01's pre-review added a seventh, `91D6530F…`, below). "Skeptics" is how many of the three refuted the finding.

| ID | Sev. | Skeptics | Finding | What became of it |
|---|---|---|---|---|
| D1-F1 | medium | 1 of 3 | The performance entry's category was applied to any holding the loose name matcher maps to it: a sibling series of the Category III entry became Category III with no mark and no note (43 of 46 variants matched; 6 of 21 other funds of the same houses too) | Fixed: the entry is a statement only when the holding's name is the entry's own once normalised; a sibling is assumed, with the note. A "Listed AIF" label through a looser match still gives Category III, with the note. Tested with fixture entries and sibling names |
| D1-F2 | low | | Fifteen spellings of a stated category are not read | Square and curly brackets, a slash, an underscore, a hash and a comma are read. Not read, pinned: "Category No. III", full-width and Roman-numeral characters, zero-width characters |
| D1-F3 | low | | An own category of "Unlisted AIF" with a name that matches a Listed AIF entry was ruled Category III | Fixed: an own category that says unlisted blocks the entry's label |
| D1-F4 | low | | The AI Analyst's AIF sentences are never displayed (AIFs are listed under "Not assessed", whose row prints only a general reason) | Said so in the patch header, in this record and in the acceptance items; no change to the page. To be filed |
| D1-F5 | low | | Five real mutants survive all five tests | Checks added: "Wildcat II" and "Concat I", Category IV, 12, 1a, 3A and IIIB, entries that say Category II, Cat 1, Category IV or Long Short, an own Category II against a Category III entry, sibling series |
| D2-F1 | low | | "Zone-less text is the day written in every zone" is false for the ISO year and year-month ("2023", "2023-04"), which Date parses as UTC midnight | KI-186 and the test header say so; no code change (a year or a month is not a day) |
| D2-F2 | low | | Zone texts outside the pattern stay machine-local: hour-only offsets ("+00"), zone words ("UTC"), "yyyy-mm-ddZ" | Named in KI-186 and pinned in the test; no code change (zone words and RFC text need the owner's call on which day a Z or GMT time means) |
| D2-F3 | low | | A Z time is its UTC day, so an Indian local midnight written in UTC ("2026-03-31T18:30:00.000Z") reads one day early, as on `main` and in the new build's reader, unlike part T2 on an Indian machine | Kept (R-11, "read as written"); disclosed in KI-186 and question 23 |
| D2-F4 | low | | The item 11 test lets 12 of 26 mutants survive | Six more forms (lower-case t and z, blanks before the zone, a no-break space, long fractions, no seconds), two more zones (Pacific/Kiritimati, America/St_Johns), nine pinned residues |
| D2-F5 | low | | Same function, wrong days that are not zone problems and pre-exist: a month-first date reads as day-first, "2023-02-30" rolls, a bare number is a year | KI-186 says they are not part of this fix (KI-075) |
| D2-F6 | low | | Older regression files are zone-fragile in DST zones, on every page | TESTING says which and why (local-midnight dates); no change |
| D3-F1 | low | | The "sale carries no price" sentence blames a priceless sale that sold nothing | Fixed: only a sale that states an amount counts; the sentence names a switch out. Tested |
| D3-F2, D5-F5 | low | | "The number field read those in a Chromium browser" is only partly true | The sentence is removed from the header, the page comment and the tests; the cause of the reported entry stays UNKNOWN |
| D3-F3 | low | | "INR. 1,25,000" was read as 0.125 (the default was restored before) | Fixed: INR may have a dot. Tested |
| D3-F4 | low | | Amounts a person can read ("1.25 lakh", "$100", full-width digits) still restore the default with no message | A trailing "/=", INR and Rs are read now; a hint beside a rejected entry is not built. To be filed |
| D3-F5, D4-F3, D5-F6 | low | | "holding(s)" on the class slide and the harvest slide | Fixed: singular and plural. Tested |
| D3-F6 | low | | 8 of 42 mutants survive the follow-ups tests | Checks added: a price of 0, minus 5, "abc" or NaN is no price; fewer units say "fewer" whatever the sale; a sale dated after the valuation date is not blamed; "1.25E5" and "+125000"; 1, 2 unreconciled holdings on the holding-detail slide |
| D4-F1 | low | | When even 6.5 pt does not fit, the class footnote can start above the page's own estimate of the table's bottom (55 of 4,792 simulated decks, by up to 0.033 in; a hairline on the border, not on text) | Not changed. A sixth size (6 pt) was built and taken out: because the page's estimate of the table counts every flagged row as wrapped (D4-F2), it set the footnote at 6 pt where 6.5 pt was right in the common 14-class book. The two findings are one known issue (to be filed). The test pins the 6.5 pt size and the band's edge. **Corrected at stage S8:** the simulation's 0.033 in is not the worst case. With 14 classes shown, 4 rows the page counts as wrapping and every optional sentence (1,053 characters), the 6.5 pt first line starts 0.12 in above the estimate (more with more wrapped rows); ARC-01 found the same 0.12 in by the code's own estimate, and 0.012 in at most by font metrics. Nobody has rendered such a deck, so whether it touches the table is **UNKNOWN** (slide geometry for 13 or more classes is NOT RUN). The earlier comment in the code and in the test said 0.04 in; both now say what is known |
| D4-F2 | low | | The page's table and line estimates are conservative, so the footnote is often set smaller than needed | No change (legibility only; PowerPoint was not used to measure). The table's height is an estimate, never measured: a flagged row that wraps may be taller than the 0.40 in the page counts, one that does not shorter |
| D4-F4 | low | | Two comments say the class footnote holds about two lines | Reworded |
| D5-F1, D5-F2 | low | | Header, labels and comments hold stale or too absolute statements | Corrected |
| D5-F3 | low | | "The file does not state its category" is loose when the category cell holds other text | Now "the file does not state Category I, II or III" on the tab, the class slide and the AI Analyst |
| D6-1 | low | | The header and a page comment said an arbitrage name is read "whatever its category"; the fund-of-funds test and the hybrid category tests claim it first | Header and comment say which tests claim it first |
| D6-2 | low | | The category taken from the matched Category III entry carried no mark and no note for a sibling series | Same as D1-F1 |
| D6-3 | low | | The Category III row (Listed Equity or Long Short) was picked from the category, name, product and the entry's category, wider than before (306 of 29,843 inputs change label only; no figure moves) | Picked from the category and the name, as before; the entry's wording picks it only for a category the entry stated. Tested |
| D6-4 | low | | A page comment said the holding-detail footnote holds two lines (about 520 characters); it is 510 to 838 characters | Comment reworded: it may need a third line (pre-existing, KI-109). Whether the box overflows in PowerPoint was not measured |
| D5-F4 | low | | The delta tests depend on the content of AIF_PERF, and the KI-171 test types a vendor fund name | The sample book's Listed AIF is found by what it is; the Category III census uses the engine's own pattern; the rest is a data guard that fails when a refresh brings an AIF the page cannot read, on purpose |

## ARC-01's pre-review of the stages, and stage S8 (part T5)
ARC-01 read the stage files S1 to S7 and the docs commit on 2 Nov 2026, before Gate B (read-only; no Office program,
browser or renderer; synthetic data only). It accepted item 9, items 10 and 11 as built (with conditions), confirmed the
S7 narrowing of the matched entry's category (one condition in `taxClassify`), found a hunk-to-row map for every changed
line of the part, no need to split the part by group, and no blocker for continuing. The figures it gives are its own and
EX-01 did not repeat them, except where the table says so. Stage S8 (the seventh commit) answers its requests:

| # | ARC-01 asked | Stage S8 |
|---|---|---|
| 1 | A known-answer end-to-end test for item 11, as the I-04 change rule asks for known-answer XIRR tests | `CR-0008-T5-item11-irr-zone-dates.js` runs date texts through the shipped `parseIRR` into the review's XIRR and into the tax lots, in eight zones. Rs 1,00,000 paid on "2024-03-30T20:00:00Z" and Rs 1,10,000 back on "2025-03-31T00:30:00+05:30" are 366 days apart: 1.1^(365/366) - 1 = 9.9714% (10.0000% at 365 days, which is what `Date` gives in every zone). Two funds bought for Rs 1,00,000 on "2025-03-31T20:00:00Z" (31 Mar 2025) and "2025-04-01T00:30:00+05:30" (1 Apr 2025), worth Rs 3,00,000 on 1 Apr 2026: the first is long term (366 days; a gain of Rs 2,00,000 taxed at 12.5%, the exemption used: Rs 25,000), the second exactly 12 months, short term (Rs 2,00,000 at 20%: Rs 40,000); together Rs 65,000. Read through `Date` the two lots always fall on one day and the tax is Rs 50,000 or Rs 80,000. |
| 2 | Tests for what its mutants kept alive at S6: the 7 pt step; three clauses of the item 11 pattern; the word boundary of the Category I/II reader; the colon and the minus sign among the separators; the entry-label branches; Long Short read from the entry; a sibling series; the footnote's bottom anchor, clearance from the table and plural sentence | Item 11: ten more forms that only one clause of the pattern takes (two blanks or a tab before the offset, a one-digit fraction, an offset without the colon, a negative one, -12:00, +14:00, -00:00, and the end-of-day 24:00, which is pinned as built: "2023-04-01T24:00:00Z" reads 1 Apr, the day written, though its instant is 2 Apr 00:00 UTC; added to the residues of KI-186). Item 10: every character of the separator class (21), in the fund's own words and in the performance entry's text, singly and twice in a row; the word boundary ("Bobcat 1", "Tomcat 2", "Scat Three", "9Cat I") in both; the number words in the entry; texts that are not read ("Category*III", "Category X II"); a sibling of the Long Short entry; "Category II/III" (read as Category II) and "AIF-III" (read as nothing) pinned as built. Footnote: the 8, 7 and 6.5 pt sizes, each in a book of its own whose footnote length tells the line lengths (260, 300, 320) apart, with the number of lines, the bottom at 7.18 in exactly and 0.04 in of clearance from the page's estimate of the table (not at 6.5 pt, KI-210); the plural sentence for two AIFs treated as Cat I/II, on the tab and the slides |
| 3 | The disposition table and the patch header must list the two 17:36 changes | The header does; the table has two rows: item 11 reads only text that `Date` accepts (the row marked own), and the "%" stripped in the slab-rate field (in R4-1) |
| 4 | PD-50: the comment above `aiaSigTax` calls tax "never a reason to act", but the class flips action labels and the Exit count; fix the comment or the behaviour, and write the disclosure | The behaviour is unchanged (the choice is the owner's, question 21). The comment says what the weight does. D-040, this record (the PD-50 bullet, R8-F1, question 21) and KI-170 list what moves, with ARC-01's figures attributed |
| 5 | Optional: make the `ENGINE_KEYS` check two-way | Done; `KI-185-engine-keys.js` runs the real check against the shipped page and against three planted pages |

Two more changes, both comments in the page. The comment above the class footnote's fit said the 6.5 pt first line can
start "up to 0.04 in" above the page's estimate of the table; running the page's own code on a book of 14 classes, 4
rows the page counts as wrapping and every optional sentence gives 0.12 in (ARC-01 found the same by the code's
estimate, and 0.012 in at most by font metrics). Both comments, the test's comment and the row D4-F1 above now say what
is known; nobody has rendered such a deck. The other comment is the one above `aiaSigTax`.

EX-01 also ran its own mutants against the stage's tests: 146 edits, 144 killed and two equivalent (see Verification). Left alone: `tools/run-regression.js`
exits 0 when its filter matches no file (ARC-01 noticed that the item 11 file has no "KI-186" in its name, so
`run-regression KI-186` runs nothing and passes); the change is one line outside part T5 and ARC-01 did not list it.

Open for the owner and the tax adviser (ARC-01's list, unchanged by S8): the named approval of the financial-domain
reviewer for item 11 (a Z time is its UTC day) and for the S7 narrowing (may another series of a Category III fund be
taken as Category III?); the AIF rows (an AIF or PMS whose category says arbitrage is classed as an equity fund and
scored, as on `main`); questions 21 to 23.

## Questions for the owner and the tax adviser
1. Confirm the D-040 defaults (a) to (h).
2. ELSS: is a lot redeemable on the third anniversary of its purchase or from the next day (built: the next day)?
3. 29 Feb purchases: anniversary clamped to 28 Feb (built for the ELSS lock-in, and in part T2 for the long-term rule,
   D-040 b), so long term from 1 Mar; or from 2 Mar?
4. Foreign shares held directly: which marker do the real base files carry (ISIN, product or category label)? The
   embedded data marks only one share (NXP Semiconductors).
5. Confirm the 90/90 status of each equity ETF FoF, and whether Bharat 22, ESG sector leaders and multi-ETF FoFs
   qualify. The live page assumes 90/90 for a fund that holds one equity ETF and says so in the class name, "Equity ETF
   FoF (90/90)" (PD-06 asks whether to keep that default; the new build asks the analyst).
6. US treasury and US debt FoFs: international FoF (built) or Specified?
7. Balanced advantage, dynamic asset allocation, equity savings and multi asset funds, retirement and children's funds,
   REIT index funds, and the ex-top 100, hybrid and active asset allocator SIFs: will the owner supply the AMC's
   year-end classification, or approve the reckoner's usual bucket?
8. SIFs under their own rows (built) or under the mutual-fund rows?
9. What Asset Name and Category do real base files give gold or silver ETFs and FoFs, Balanced Hybrid funds and FoFs?
10. The valuation date (part T2): the base file's Valuation Date column first, then the portfolio date, then the IRR
    sheet (built). Does every current base file format carry a Valuation Date column, and is it one date for the file?
11. How does the IRR sheet record an AMC scheme merger? A merger is not a transfer (Mutual Funds R43); if it arrives as
    a switch-in dated on the merger, units bought before 1 Apr 2023 would be redated and wrongly made Specified.
12. Grandfathering (KI-177 step 2): confirm the formula (cost = the higher of actual cost and the lower of the 31 Jan
    2018 value and the sale value) and its Act 2025 section; the share price basis (highest quote or close); the
    scope (equity ETFs, arbitrage funds, REIT and InvIT units, shares inside a PMS); and the source of 31 Jan 2018
    prices and NAVs, adjusted for corporate actions and scheme mergers.
13. Is each base-file client one assessee (one PAN)? How should HUF folios, a minor's holdings (clubbed with a parent),
    assets transferred to a spouse and joint holdings be treated? The harvest now works per client (part T3).
14. The harvest assumptions (part T3): is 30% the right default slab rate, and 0 the right default for the exemption
    already used (Q-52)? Should the slab rate include surcharge and cess (39% at the top of the new regime) when it
    only orders the set-off? The live page shows 30% labelled "(default)" and the new build shows a dash until the
    analyst sets one (PD-07).
15. May long-term losses be set against Sec 197 gains before Sec 198 gains? Built: gains inside the unused exemption
    are reached last, so the result is the lowest tax; the reckoner is silent on the order.
16. Does any part of the Rs 1.25 lakh exemption apply to an AIF Category I or II's listed-equity gains (Master Summary
    J35)? Built: no, the page cannot see that part.
17. Are the "Listed AIF" funds in AIF_PERF Category III? **Answered 2 Nov 2026: yes, and put a safe note** (the owner:
    "Yes and still put a safe note"; D-043). Built in part T5: Category III, fund level, with a note on every surface
    that asks the analyst to confirm the category against the AIF's statement. No tax, LTCG, STCG, estimated tax,
    saving, harvest or total CMV moves on the sample book; the not-classified CMV and gain move into a Fund level
    amount. (Parts T3 and T4 had kept them Category I or II, pass-through.)
18. Crypto: may a loss be set against a crypto gain, and may a crypto loss offset other gains (the 1961 Act's Sec
    115BBH barred both)? **Answered 2 Nov 2026: keep "no set-off"** (D-043). Built in part T4 and unchanged: no
    set-off either way; a crypto gain is taxed in full, a crypto loss is not carried forward and is not offered as a
    harvest candidate. Whether the Income-tax Act 2025 allows set-off stays a question for the tax adviser (OD-28). The
    harvest card and slide still say "pending" (KI-182).
19. For reviews valued before 1 Apr 2026, should the carry-forward sentence say "assessment years" (1961 Act)? Built:
    "tax years" always.
20. AI Analyst: is "n/a" right for a fund-level or not-split holding (built), or should a Category III AIF score green
    (no investor tax on redemption)?
21. (Part T5; PD-50) The usual bucket moves the AI Analyst: its tax signal has weight 7, so the class a fund takes, and
    for aggressive hybrid, arbitrage and equity savings funds the review date, change a book's composite, trims, target
    weights, action labels (an Exit can become a Partial or a Retain), number of exits and plan summary. Built: the
    signal uses the class, as for every other fund, and the records say so. Or should the signal read "not assessed
    until the analyst confirms the class" for these three fund kinds? (One line in `aiaSigTax` for "always not assessed",
    which also takes the arbitrage score away from the live page; "until confirmed" is more, since the page has no
    control to confirm a class.)
22. (Part T5; D-043) When a fund's own words state Category I or II (in its category, name or product) and the
    performance data calls it a Listed AIF, the fund's own words win: it stays Category I or II, as stated, with no
    note. Please confirm in plain words. Built that way, as the conservative reading; the owner's answer is awaited.
23. (Part T5; KI-186) Do the real IRR exports hold date-times that name a zone ("...T20:00:00Z", "...+05:30"), or RFC
    2822 text ("Sat, 01 Apr 2023 20:00:00 GMT")? The first kind is read as the day written; the second still reads as
    the machine-local day of the instant. The sample files hold neither. For the financial-domain reviewer, in one
    sentence (ARC-01's contrast, 2 Nov 2026): item 11 reads the day written, so a Z time is its UTC day ("2026-03-31T18:30:00.000Z",
    1 Apr 00:00 in India, reads 31 Mar; "2023-04-01T20:00:00Z", 2 Apr 01:30 in India, reads 1 Apr), as `main` reads a Z string,
    where part T2 on an Indian machine read 1 Apr and 2 Apr; for an offset ("2023-04-01T00:30:00+05:30") it reads 1 Apr in
    every zone where `main` read 31 Mar. The alternative the reviewer may weigh is the Indian calendar day of the instant (a
    fixed zone, also the same in every zone); which one fits depends on how the IRR source writes its dates, which is UNKNOWN.

## Status
Part T1 was committed on `fix/legacy-batch-3-tax`, part T2 on `fix/legacy-batch-3-tax-p2`, parts T3 and T4 on
`fix/legacy-batch-3-tax-p3-r2`, which was rebased on fix batch 4 (`index.html` MD5 `0713C6BE…`); part T5 is on
`fix/legacy-batch-3-tax-cr-0008`, the branch that carries the whole batch (`index.html` MD5 `91D6530F…`). The financial
re-review of part T3 is answered by part T4; the independent review of part T5 is answered by the corrections in
part T5 and by KI-200 to KI-206. The owner answered questions 17 and 18 (D-043). Next: the pull request's checks, the
financial-domain and security-release reviews, the browser acceptance (docs/TESTING.md, with `family-isolation.js`
and its assumption-reset check) and the slide geometry for a table of 13 or more classes in PowerPoint (not run yet),
then the merge of the batch as one change. Open for the owner: questions 21 to 23, and the tax adviser's questions
above. KI-177's step-up waits for question 12.
