# CR-0008: Live-page tax rules follow the TY 2026-27 Tax Reckoner

- **Requested:** 24 Oct 2026, by the product owner, who supplied `India_Taxation_Reckoner_TY2026-27.xlsx` (law as on
  19 Oct 2026; the Income-tax Act 2025 in force from 1 Apr 2026) as the source of record for the current tax year.
  The lead commissioned a financial review of the live page against it (24 Oct 2026) and set the defaults in D-040.
  Built in parts: part T1 on `fix/legacy-batch-3-tax` (27 Oct 2026); part T2 on `fix/legacy-batch-3-tax-p2`, on top of
  T1's commit (27 Oct 2026).
- **Status:** in progress: parts T1 (classification and the TAX_RULES rows) and T2 (holding periods and lots) are
  committed, not pushed; the later parts follow. Under D-028 these are calculation and data fixes for the live page.

## Request
Make the Taxation tab, the tax slides and the AI Analyst tax signal follow the reckoner. The review found 23
discrepancies, TX-01 to TX-23, each re-verified by a second reviewer (all confirmed). They are KI-160 to KI-182
(TX-nn is KI-(159+nn)) in [`KNOWN_ISSUES.md`](../KNOWN_ISSUES.md). The review itself is kept privately, outside the
repository (it quotes no client data, but it is the working file of the review).

| Part | Scope | KI (TX) | State |
|---|---|---|---|
| T1 | classification and the TAX_RULES rows | KI-162 to KI-165 (TX-03 to TX-06), KI-170 (TX-11), KI-172 to KI-174 (TX-13 to TX-15), KI-178 to KI-180 (TX-19 to TX-21) | built 27 Oct 2026 |
| T2 | holding periods and lots: the anniversary rule, the 1 Apr 2023 purchase-date rule, the valuation date, the 1 Feb 2018 disclosure | KI-160 (TX-01), KI-161 (TX-02), KI-176 (TX-17), KI-177 step 1 (TX-18) | built 27 Oct 2026 |
| later | fund-level and pass-through AIFs (TX-07, TX-12), harvest (TX-08, TX-09, TX-16), PMS (TX-10), wording (TX-22), crypto source (TX-23); the grandfathering step-up (TX-18 step 2, owner rulings first) | KI-166 to KI-169, KI-171, KI-175, KI-177 step 2, KI-181, KI-182 | open |

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

## Questions for the owner and the tax adviser
1. Confirm the D-040 defaults (a) to (h).
2. ELSS: is a lot redeemable on the third anniversary of its purchase or from the next day (built: the next day)?
3. 29 Feb purchases: anniversary clamped to 28 Feb (built for the ELSS lock-in, and in part T2 for the long-term rule,
   D-040 b), so long term from 1 Mar; or from 2 Mar?
4. Foreign shares held directly: which marker do the real base files carry (ISIN, product or category label)? The
   embedded data marks only one share (NXP Semiconductors).
5. Confirm the 90/90 status of each equity ETF FoF, and whether Bharat 22, ESG sector leaders and multi-ETF FoFs
   qualify.
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

## Status
Part T1 committed on `fix/legacy-batch-3-tax`, part T2 on `fix/legacy-batch-3-tax-p2` (neither pushed). Next: the later
parts, a financial re-review, the browser acceptance (docs/TESTING.md), then one pull request for the batch.
