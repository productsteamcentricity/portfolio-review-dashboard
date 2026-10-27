# CR-0008: Live-page tax rules follow the TY 2026-27 Tax Reckoner

- **Requested:** 24 Oct 2026, by the product owner, who supplied `India_Taxation_Reckoner_TY2026-27.xlsx` (law as on
  19 Oct 2026; the Income-tax Act 2025 in force from 1 Apr 2026) as the source of record for the current tax year.
  The lead commissioned a financial review of the live page against it (24 Oct 2026) and set the defaults in D-040.
  Built in parts on `fix/legacy-batch-3-tax`; part T1 built 27 Oct 2026.
- **Status:** in progress: part T1 (classification and the TAX_RULES rows) is committed on the branch, not pushed;
  the later parts follow on the same branch. Under D-028 these are calculation and data fixes for the live page.

## Request
Make the Taxation tab, the tax slides and the AI Analyst tax signal follow the reckoner. The review found 23
discrepancies, TX-01 to TX-23, each re-verified by a second reviewer (all confirmed). They are KI-160 to KI-182
(TX-nn is KI-(159+nn)) in [`KNOWN_ISSUES.md`](../KNOWN_ISSUES.md). The review itself is kept privately, outside the
repository (it quotes no client data, but it is the working file of the review).

| Part | Scope | KI (TX) | State |
|---|---|---|---|
| T1 | classification and the TAX_RULES rows | KI-162 to KI-165 (TX-03 to TX-06), KI-170 (TX-11), KI-172 to KI-174 (TX-13 to TX-15), KI-178 to KI-180 (TX-19 to TX-21) | built 27 Oct 2026 |
| later | lot dating (TX-01, TX-02, TX-17), fund-level and pass-through AIFs (TX-07, TX-12), harvest (TX-08, TX-09, TX-16), PMS (TX-10), grandfathering disclosure (TX-18), wording (TX-22), crypto source (TX-23) | KI-160, KI-161, KI-166 to KI-169, KI-171, KI-175 to KI-177, KI-181, KI-182 | open |

**Part T1 must not be merged alone:** it maps conservative hybrids, debt FoFs, debt SIFs and debt ETFs filed as "ETF" or
"Index Fund" to the Specified rows, which treat every lot as short term; units bought before 1 Apr 2023 need the
purchase-date rule of KI-161 (TX-02), as the review's verifier required for TX-19. The batch merges as one change.

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

## Questions for the owner and the tax adviser
1. Confirm the D-040 defaults (a) to (h).
2. ELSS: is a lot redeemable on the third anniversary of its purchase or from the next day (built: the next day)?
3. 29 Feb purchases: anniversary clamped to 28 Feb (built for the ELSS lock-in; D-040 b for the long-term rule)?
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

## Status
Part T1 committed on `fix/legacy-batch-3-tax` (not pushed). Next: the later parts on the same branch, a financial
re-review, the browser acceptance (docs/TESTING.md), then one pull request for the batch.
