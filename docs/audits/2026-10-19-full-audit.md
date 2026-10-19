# Centricity Portfolio Review Dashboard: final issue register

**Scope.** I started from 72 reproduced findings (calc 12, parsing 12, pptx 12, xlsx 10, ui 11, security 6, data 9). After merging duplicates and splitting mixed findings, that gives **67 entries**: 52 new issues and 15 rows for 16 known issues.

**Conventions**
- Code lines refer to `.blocks\`.
- Scripts are under `pr-audit\` = `%TEMP%\pr-audit\` on the audit machine (the scripts are archived privately with the audit evidence).
- Every fix to `index.html` goes through a `tools/patches/` script (rule 1).
- Financial fixes also need the financial-domain review and a known-answer test (rule 7).
- **Priority:** P0 = wrong numbers, data integrity or security that could reach a client. P1 = defects in the deck or workbook, and robustness. P2 = minor.
- **Survives revamp:** "yes" means the fix lives in the engine, exporters, parsers, data or build, or is a rule the new UI must keep. "no" means UI wiring that a full UI revamp will rewrite.

## Known-issue status

| KI | Status now | Entry |
|---|---|---|
| KI-002, KI-003 | Still reproduce. The KI-003 picker entry has moved to `11_app_ui.js:319`. | KI-002/003 |
| KI-004 | Still reproduces. The AI Analyst also mixes the two bases inside its own figures. | KI-004 |
| KI-005 | Still reproduces. | KI-005 |
| KI-006 | Now **reproduced at runtime** (was "Reported"). | KI-006 |
| KI-007 | Now **reproduced at runtime**. Taxation then reports the whole CMV as gain. | KI-007 |
| KI-008 | Still reproduces, and is wider: reference-data uploads are affected too. Line refs are stale. There is no CSP. | KI-008 |
| KI-012 | Still reproduces (`cost_overrides`, `cvs_cmv_sig`, `cost_distributor`, `cost_mode`, `cvs_infl`). | KI-035 |
| KI-014 | Confirmed from code order (`08_exporters.js:1179-1688`). | group (c) |
| KI-015 | Still reproduces: `buildPPTX(m,Ppt,'home')` writes a 0-slide deck. | group (c) |
| KI-016 | Still reproduces: the note says AIF 200 bps, the code uses 250 (`11_app_ui.js:5201/5203`). | NEW-13 |
| KI-018 | Reported by the auditor only; not verified headlessly (the IPS slide needs UI state). | group (c) |
| KI-019 | Still reproduces. Correction: the slide ticks stay visible while the export changes. | KI-019, NEW-41 |
| KI-021 | Still reproduces. Also: `:`, case-only duplicates and reserved sheet names produce a file Excel cannot open. | KI-021 |
| KI-022 | Still reproduces (through the engine's own `computeTaxation`). | KI-022 |
| KI-024 | Still reproduces and is wider. Debt funds tagged "Fixed Income" pick up another fund's equity look-through; arbitrage tagged Debt gets a bond index. | KI-024 |
| KI-026 | Still reproduces. The stale-AUM problem hits every debt, gold and silver sheet, not just FoF sheets. | KI-026 |
| KI-032 | Unchanged. Its risk carries into the NEW-23 fix. | NEW-23 |
| KI-034 | Still in code. Extended: Direct-plan exports carry no plan label. | KI-034 |
| KI-035 | Still reproduces (line refs stale). `cost_mode` and `cost_overrides` also carry over. | KI-035 |
| KI-036 | Still reproduces. Also, G and IDCW plans collapse in the exact-name loop. | KI-036 |
| KI-037 | Still present (`07_engine.js:251`). | KI-037 |
| KI-040 | Still in code; same family of defect as NEW-33. | NEW-33 |
| KI-044 | **No longer reproduces:** `MF_BENCHMARKS` now holds `Nifty 500 - TRI`. | none |
| KI-045 | **Contradicted:** Growth holdings of IDCW-only funds get the IDCW row (25 on screen, 22 in the deck), not blanks. | NEW-7 |

**Merge map** (traceability)
- NEW-3 = IRR-sheet quirks + unreconciled Fund IRR sheet.
- NEW-7 = three MF Analysis matcher findings.
- NEW-23 = two-distributor finding + exact-name join finding.
- NEW-24 = the two transaction-type findings.
- NEW-27 = empty benchmark rows (calc) + the empty-row part of the data benchmark finding.
- NEW-32 = Asset Allocation, Holdings, Rebalancing and SWOT layout findings.
- NEW-33 = Lakh-unit finding + CVS rounding + AI Analyst sheet units (exporter part).
- KI-008 = base-file XSS + reference-upload XSS + missing CSP.
- KI-035 = cost-mode persistence + cost-override persistence.
- KI-006 and KI-007 each absorb their re-verifications; KI-024 absorbs the routing parts.
- Split up: the calc KI re-verification (into KI-004/006/007/022/037 and NEW-25); the parsing base-file finding (NEW-11, NEW-28, KI-007); the deck-divergence finding (NEW-36, NEW-46); the CVS slide finding (NEW-33, NEW-35); the AI Analyst units finding (NEW-33, NEW-34); the ER finding (NEW-12, NEW-13); the data benchmark finding (KI-024, NEW-27, NEW-51).

## Register index

| ID | Title | P | Kind | Owner decision | Survives revamp |
|---|---|---|---|---|---|
| NEW-1 | XIRR solver invents 10000% / 10% for same-day flows | P0 | calculation | no | yes |
| NEW-2 | Client-sheet asset/product XIRR/BMXIRR joined by IRR-file labels | P0 | calculation | no | yes |
| NEW-3 | IRR aggregates not reconciled to the base file or validated | P0 | calculation | yes | yes |
| KI-006 | Blank XIRR counted as 0% in subtotals | P0 | calculation | no | yes |
| KI-007 | Blank invested value stored as 0 | P0 | data | no | yes |
| KI-005 | Fraction-format XIRR read 100x too small | P0 | parsing | yes | yes |
| NEW-4 | Renamed/legacy scheme names matched to a different fund | P0 | calculation | yes | yes |
| KI-036 | Tie between two funds broken by key order | P0 | calculation | yes | yes |
| NEW-5 | Bonds, unlisted shares, MLDs treated as MFs | P0 | data | yes | yes |
| KI-024 | Benchmark/asset routing (Fixed Income, arbitrage) | P0 | calculation | yes | yes |
| NEW-6 | FUND_RANKS / MF_RISK keyed under stale spellings | P0 | data | partly (renames) | yes |
| NEW-7 | MF Analysis risk ratios from two unanchored matchers | P0 | calculation | no | yes |
| NEW-8 | Direct-plan view substitutes or drops schemes | P0 | calculation | no | yes |
| NEW-9 | Hybrid underlying stocks scaled twice | P0 | calculation | no | yes |
| NEW-10 | Vendor Debt Analytics file misread in the bonds slot | P0 | parsing | no | yes |
| NEW-11 | Holdings with no CMV dropped silently | P0 | data | yes | yes |
| KI-026 | In-browser MF Monitor upload degrades embedded data | P0 | data | yes | yes |
| NEW-12 | Uploaded monitor ERs stored 100x too large | P0 | parsing | no | yes |
| NEW-13 | Missing base ER filled with an unsourced estimate | P0 | data | yes | yes |
| NEW-14 | ER override above 300 bps cut 100x on next load | P0 | data | no | yes |
| KI-035 (+KI-012) | Cost plan mode and ER overrides leak across families | P0 | ui-state | yes | yes |
| NEW-15 | AI Analyst AMC cap bypassed by label mismatch | P0 | calculation | no | yes |
| NEW-16 | AI Analyst degraded Exit keeps stale unfunded / AMC-after | P0 | calculation | yes (behaviour) | yes |
| KI-004 | AMC cap measured on two bases | P0 | calculation | yes | yes |
| NEW-17 | "Apply plan" writes part of the release | P0 | calculation | no | yes |
| NEW-18 | Taxation rupee ledger misallocates LT/ST | P0 | calculation | yes | yes |
| NEW-19 | Corporate/Dynamic Bond MFs taxed as listed bonds | P0 | calculation | no | yes |
| KI-022 | Holding-period convention | P0 | calculation | yes | yes |
| NEW-20 | IPS compliance verdicts wrong | P0 | calculation | yes | yes |
| NEW-21 | CVS splits hybrids by the portfolio-wide equity share | P0 | calculation | no (rule 3) | yes |
| NEW-22 | CVS tab/slide ignore the rebalancing plan | P0 | ui-state | no | no |
| KI-008 | Unescaped HTML from uploads; no CSP | P0 | security-privacy | no | yes |
| NEW-23 | Taxation lot join: exact names, distributor split | P1 | calculation | yes (apportionment) | yes |
| NEW-24 | Taxation ignores common transaction types | P1 | calculation | yes | yes |
| KI-037 | Hybrid MFs never get a tax class | P1 | calculation | yes | yes |
| NEW-25 | Two G/L definitions disagree | P1 | calculation | yes | yes |
| NEW-26 | Unmatched PMS/AIF/SIF filed under MF buckets | P1 | output-xlsx | no | yes |
| NEW-27 | Missing benchmark series shown as all-dash rows | P1 | data | yes (series) | yes |
| NEW-28 | Base loader: wrong sheet/header row, misleading error | P1 | robustness | no | yes |
| NEW-29 | IRR parser silently drops or misdates rows | P1 | parsing | no | yes |
| NEW-30 | Direct/Regular monitor slots swappable with no warning | P1 | robustness | no | yes |
| NEW-31 | SOA Product Category must be exactly "PMS"/"AIF" | P1 | parsing | no | yes |
| NEW-32 | PPTX tables/panels sized by fixed counts overflow | P1 | output-pptx | no | yes |
| NEW-33 | Exports ignore the review's money unit | P1 | output-pptx | no | yes |
| NEW-34 | AI Analyst rounding/thresholds in absolute ₹ Cr | P1 | calculation | yes | yes |
| NEW-35 | CVS slide calls assumptions "IRR%", omits inflation rows | P1 | output-pptx | no | yes |
| KI-002/003 | Overlap slide empty; post-rebalancing overlap never built | P1 | output-pptx | no | yes |
| NEW-36 | Deck drops MF Analysis disclosures and client-scope label | P1 | output-pptx | no | yes |
| KI-034 | Direct-plan figures exported without a plan label | P1 | output-xlsx | no | yes |
| NEW-37 | PMS/AIF data captioned with the MF date | P1 | output-pptx | no | yes |
| NEW-38 | XLSX liquidity % in the Investment Amount column | P1 | output-xlsx | no | yes |
| NEW-39 | XLSX analytics sheets lack vintage and coverage | P1 | output-xlsx | yes (deck) | yes |
| KI-021 | Excel export fails on some client names | P1 | robustness | no | yes |
| NEW-40 | CVS typed values revert to house defaults | P1 | ui-state | no | no |
| NEW-41 | Cleared as-on date becomes "20 May 2026" | P1 | ui-state | no | yes |
| NEW-42 | Blocked browser storage blanks tabs, breaks the deck | P1 | robustness | no | yes |
| NEW-43 | Re-picking the same file is ignored | P1 | ui-state | no | no |
| KI-019 | Slide picker shows ticks but exports something else | P1 | ui-state | yes | no |
| NEW-44 | Negative figures dark red on black | P2 | output-pptx | no | yes |
| NEW-45 | Pie/doughnut labels whole-percent | P2 | output-pptx | no | yes |
| NEW-46 | Deck category order; single-distributor slides exported | P2 | output-pptx | yes | yes |
| NEW-47 | XLSX Base File Allocation blank/unreliable | P2 | output-xlsx | yes | yes |
| NEW-48 | XLSX allocation sheets pre-rounded | P2 | output-xlsx | no | yes |
| NEW-49 | Overlap panels' Clear buttons cross-wired | P2 | ui-state | no | no |
| NEW-50 | Benchmark index rows offered as funds in the picker | P2 | data | no | yes |
| NEW-51 | MF_CAT_BM documented but never read | P2 | data | no | yes |
| NEW-52 | Gmail address in public commit history | P2 | security-privacy | yes | yes |

---

## P0: wrong numbers, data integrity, security

### NEW-1: XIRR solver invents 10000% or 10% when all flows fall on one date
`P0 · calculation · owner decision: no · survives revamp: yes`

**Evidence**
- In `07_engine.js:823-842`, same-day flows make the NPV constant:
  - If the NPV is exactly 0, bisection ends at ≈100, shown as **10000%**.
  - If |NPV| < ₹1, Newton breaks on a zero derivative and returns its start value of **10%**.
- `pr-audit\verify-calc-9\v9_xirr_sameday.js` and `v9b_downstream.js` set the SIF's flows on the as-on date. The result:
  - 10000% on Holdings, Fund IRR, the slides and the XLSX.
  - Contributors #1 with contribution 290.82; the next is 2.53.
  - Observations: "Equity sleeve … 411.19% XIRR".
- A closing value ₹0.50 below cost gives an invented 10.0000%.
- The likeliest real trigger is the benchmark side of any holding bought on the as-on date.

**Fix:** `xirr()` returns null when max(yrs) = 0, and when Newton stops on d = 0 without converging. Use a tolerance relative to flow size. Add a smoke test.

### NEW-2: Client-sheet asset/product XIRR and BMXIRR group IRR flows by the IRR file's own labels
`P0 · calculation · owner decision: no · survives revamp: yes`

**Evidence**
- `caV`/`capV` are keyed on the raw IRR asset/product labels (`07_engine.js:1005-1007`), looked up at `:1019` and used at `:1102-1121`. `computeIRRtree` joins by client+instrument instead (`:848-852`, as DECISIONS_LOG:81 records).
- `pr-audit\verify-calc-2\v_bench_labels.js`, benchmark sheet labelled all "Equity":
  - Client A Equity BMXIRR 11.3617% vs exact 12.6442%.
  - Client B 12.8169% vs 14.6332%.
  - B Equity/MF 12.8248% vs 15.2973%.
- "Mutual Fund" vs "Mutual Funds" falls back silently to CMV weighting: 18.0689% vs 18.6504%. "EQUITY" gives 15.4728% vs 16.6472%.
- The client sheets (`08_exporters.js:1932-1935`) contradict the same workbook's Fund IRR sheet (`:2050-2060`). The subtitle still says "transaction-based" (`11_app_ui.js:647`).

**Fix:** build each asset/product aggregate from the client's base holdings in that bucket, mapped to IRR instruments with `irrInstr`/`matchInstrument` (the same way as `computeIRRtree`). Leave it blank with a footnote when nothing resolves. Smoke-test with an all-"Equity" benchmark sheet and "Mutual Fund".

### NEW-3: IRR aggregates are never reconciled to the base file or validated
`P0 · calculation · owner decision: yes · survives revamp: yes`

**Evidence**
- `computeIRRtree` groups every parsed flow (`07_engine.js:844-870`; Total = `lx(F)` at `:853`). The result is stored at `:999` and `:1832` and written as-is at `08_exporters.js:2050-2059`. `irrAgg`/`irrCli` at `:1019-1020` behave the same.
- Base data for the cases below: `pr-audit\verify-xlsx-1\repro.js`, `pr-audit\verify-parsing-4\repro*.js`, `pr-audit\parsing\t13_irr.js`, `t18_negbm.js`.
- **Client present only in the IRR file:** the person's name and returns enter the Fund IRR sheet, and Total moves 13.09/11.88 → 12.89/11.69.
- **Holdings with no transactions** (PMS + ABB, 16.43% of CMV) vanish without a note:
  - Total 12.59/11.66, still labelled as the total.
  - The Client A Equity row shows the MF-only 12.84/12.49 while its allocation still includes the PMS and ABB.
- **Benchmark-side quirks** (KNOWLEDGE_DUMP §6.4):
  - Negating holding 1's benchmark closing: Total benchmark → −0.58%, Client A −10.55%, Equity row −23.89%.
  - Another negated closing yields an XLSX row "Client A Blended 12.32 / 0.72 / +11.6", a fake outperformance.
  - Missing PMS benchmark rows: benchmark 11.67% while the fund side still includes the PMS.
  - Folio duplicated as "/01": Client A 12.32 → 12.27.
- No warning anywhere (`11_app_ui.js:194`).

**Fix:** build one reconciled set of flows and use it for both the tree and the client sheets. A flow qualifies only when:
- its client resolves to a base-file client (`resolveClient`),
- its instrument matches a base holding (`irrInstr`),
- its benchmark series is valid (last BM_AMOUNT > 0, xirr not null).

Then:
- Compute fund and benchmark over the same instruments.
- Add a coverage footnote (N holdings, ₹X, Y% excluded) and list IRR-only clients separately.
- Flag "/NN" duplicate folios.
- Put the counts in the IRR status line.

The interim parts (drop IRR-only clients, add the coverage footnote) need no decision.

**Owner questions**
1. Should fully redeemed instruments count in the since-inception portfolio IRR?
2. For an instrument with an invalid benchmark: exclude it from both sides, or keep the fund side and footnote it?
3. Duplicate folios: de-duplicate, or only flag?

### KI-006: A blank XIRR counts as 0% in client-sheet subtotals (now reproduced at runtime)
`P0 · calculation · owner decision: no · survives revamp: yes`

**Evidence**
- `(h.xirrFrac||0)*cmv` at `07_engine.js:1092` and `:1095`, divided by the full CMV at `:1104`, `:1109`, `:1121`.
- `pr-audit\verify-xlsx-2\repro.js`, ABSL Large Cap blanked, no IRR file:
  - MF subtotal 4.146 vs 10.997.
  - Equity 8.715 vs 13.696.
  - Grand Total 8.616 vs 11.539.
- The same wrong figures appear in the XLSX client sheet, the Holdings tab and the holdings slides. `pr-audit\verify-calc-10\v1_ki006_007.js` gives 9.2250% vs 13.6667%.
- An IRR upload hides it.

**Fix:** use separate denominators: CMV that has an XIRR and CMV that has a BMXIRR (as the merge step at `:782-791` already does). Return null when the denominator is 0. Add a coverage note and a smoke check (expect 10.997).

### KI-007: A blank invested value becomes 0 (now reproduced at runtime)
`P0 · data · owner decision: no · survives revamp: yes`

**Evidence**
- `invCr: _inv||0` at `07_engine.js:764`. It feeds `:934`, `:1031-1032`, `:1082-1094`, `:793`, Taxation at `:325-326` and `:396`, and the AI Analyst at `:2789`.
- `pr-audit\verify-xlsx-10\repro.js`:
  - Base File row reads "Inv ₹ blank / Inv Cr 0.00".
  - Client subtotals are off by −1.2553 Cr (MF 0.50 / 2.015 / 0.2597).
  - Asset Allocation Equity invested drops 4.30 → 3.45.
- `tax.js`:
  - Holding gain 0.4053 → 1.2553 (the whole CMV).
  - Family LTCG gain 2.2093 → 2.8093.
  - `glMissing` = 0, so nothing warns.
- On screen it shows 0.00 (`07_engine.js:47`).

**Fix:** keep invCr null. Aggregate invested value and G/L only over holdings that have an invested value, and carry an `invMissing` count. Taxation then takes its existing `glMissing` path. Display "—" with a footnote, and add a smoke check.

### KI-005: Base-file XIRR stored as fractions reads 100x too small
`P0 · parsing · owner decision: yes · survives revamp: yes`

**Evidence**
- `gnPct` always divides by 100 (`07_engine.js:736`, `:769-770`).
- `pr-audit\verify-parsing-11\repro_units.js`: cells formatted "0.00%":
  - xirrFrac 0.0014 (shows 0.14 instead of 14.00); Grand 0.1216 vs 12.16.
  - An Observations bullet disappears (`repro_obs.js`).
- Allocation stored as a percent becomes 1436 in Excel (that half is fixed by NEW-47).
- An IRR upload masks the XIRR half (`:1022`).

**Fix:** detect units per column from the cell number format (SheetJS keeps `w` = "14.00%"). This means passing the sheet, or a second set of `raw:false` rows, into `parseBaseRows` from `11_app_ui.js:56-60` and from engine-host `build()`. Report the detected unit in the status line. Test with known XIRRs in both forms.

**Owner question:** when the column has no % format, use a magnitude test (which misreads a book whose every XIRR is below 1.5%), or stop and ask the analyst?

### NEW-4: Renamed and legacy scheme names are matched to a different fund
`P0 · calculation · owner decision: yes · survives revamp: yes`

**Evidence**
- `amcTok` is only the first token (`07_engine.js:116`), and `distinct` excludes only amcTok and "fund" (`:142`). With the threshold `sharedSig>=3 && distinct>=2` (`:153`), the rest of a multi-word house name (birla+sl, pru, rob, india) counts as distinctive.
- `pr-audit\verify-data-1\fict.js`: a made-up "Aditya Birla SL Xyzzy Fund" resolves to ABSL Large Cap.
- `direct.js`: 17 of 18 legacy names resolve to another scheme, for example:
  - ICICI Pru Bluechip → US Bluechip Equity.
  - SBI/Axis/ICICI "Long Term Equity" (ELSS) → Long Duration debt funds.
  - Kotak Emerging Equity → a Global EM FoF.
  - ICICI Pru Equity & Debt → PSU Equity.
- `e2e.js`:
  - `unmatched` is [].
  - The AI Analyst scores the #1 aggressive hybrid as "Ranked 3 of 4 in PSU" and recommends Partial Rebalance.
  - Two ABSL holdings merge into one AI Analyst position and one Performance row (`:1410`, `:1412`, `:2015`).
- `loo.js`: when a scheme is absent from MF_PERF, 61% (1,286 of 2,107) get another fund instead of null.
- Format variants are not the problem: `pr-audit\refdata\match.js` gives 0 wrong in 6,300.

**Fix**
- Exclude every house-name token from `distinct`: the AMC string plus the leading tokens shared by ≥90% of that house's keys.
- Weight generic words by idf (not a stop-list; see KI-026).
- Return null on ties (KI-036).
- Add an owner-maintained rename alias layer (ALIASES).
- Show "matched to …" whenever perfKey differs from the holding name.
- Never de-duplicate or merge distinct client holdings on perfKey.
- Measure both ways over the real universes (rule 4).

**Owner questions:** approve the tightening, which turns these wrong matches into visible unmatched rows? Who maintains the rename table?

### KI-036: A tie between two funds is broken by key order (still reproduces)
`P0 · calculation · owner decision: yes (bundle with NEW-4) · survives revamp: yes`

**Evidence**
- `07_engine.js:155` uses a strict ">", so the first key wins. Key order is the vendor row order (`:893`).
- `pr-audit\verify-data-7\tie1.js`: ICICI Pru Equity & Debt → PSU Equity in shipped order, Equity Savings when reversed. A blank-AMC "Nifty Smallcap 250 Index Fund" → Bandhan or SBI (10 houses tie).
- `e2e.js`: reversing the key order moves a holding's 3Y from 17.30% to 6.15%; `unmatched` stays empty both times.
- The exact-name loop (`:122-127`) collapses G and IDCW plans (JUNK at `:53`). Today, "ICICI Pru BSE Liquid Rate ETF(IDCW)" gets the (G) record (SI 5.19 vs 4.58).
- `fix.js`: returning null on a tie removes 12 wrong matches and 0 correct ones over 1,850 names.

**Fix:** try an exact raw-name match first. Return null when several keys share the normalised name, and on fuzzy ties (mirroring `matchPMS` at `:197-201`).

### NEW-5: Bonds, NCDs, unlisted shares, MLDs, FDs, REITs and SGBs are treated as mutual funds
`P0 · data · owner decision: yes · survives revamp: yes`

**Evidence**
- `productClass` returns "MF" for anything that is not PMS/AIF/SIF (`07_engine.js:918-924`). `isDirectEquity` excludes these products (`:555-558`), so they are offered the MF performance and look-through pools (`:957-989`).
- `pr-audit\verify-parsing-3\v01_nonmf_match.js`: 7 of 23 non-MF rows match the wrong scheme, none of them listed as unmatched. Examples:
  - ABCL NCD 2028 → ABSL CRISIL IBX Gilt Apr 2028 Index (1Y 4.789, YTM 6.02).
  - HDFC Credila (Unlisted) → HDFC Banking & Financial Services.
  - Kotak Nifty 50 MLD → Kotak Nifty 50 ETF.
- `v02`: a single AAA NCD shows "SOV 95.61%" with top issuer Government of India. The RM's bonds upload fixes the ratings, but Performance still quotes the gilt fund (`:1289`).
- Shown at `11_app_ui.js:1344`, `08_exporters.js:1720-1726` and `:1989-1993`.

**Fix**
- Add a non-MF class "OTHER" for product text matching bond|ncd|debenture|unlisted|mld|market-linked|fd|reit|invit|sgb, unless it also says ETF or MF.
- Give OTHER no MF candidates.
- Tag bonds-upload entries for OTHER.
- Add an own "Bonds / Other" bucket and exclude these holdings from average YTM/ModDur (`:1285-1290`).
- Measure the change both ways.

**Owner question:** which Product labels count as non-MF (for example, a Bharat Bond ETF filed under "Bonds")?

### KI-024: Asset/benchmark routing edge cases (still reproduce, and wider)
`P0 · calculation · owner decision: yes · survives revamp: yes`

**Evidence**
- `bucketOf` routes by asset only (`07_engine.js:1366-1376`), and a blank Asset defaults to Equity (`:754`).
- `pr-audit\verify-data-6\v2_book.js`: Axis Arbitrage tagged Debt is compared with CRISIL Composite Bond (3.81) and looks +2.2 pp ahead. Against Nifty 50 Arbitrage (7.33) it trails.
- `v3`, `v4_fixedincome.js`: a fund tagged "Fixed Income" with category Short & Mid Term gets Nifty Midcap 150 TRI.
- A mis-tagged debt fund is offered the equity look-through pool:
  - ABSL Gilt picks up ABSL Conglomerate's 45 stocks, which flow into Equity Analytics.
  - 138 of 486 debt schemes snap onto another equity fund.
  - The rest are excluded with a false reason.

**Fix:** normalise Asset synonyms in `parseBaseRows`. Route arbitrage by category (as `:952` and `:226` already do). Never offer the equity pool to a name that exists in DEBT_ANALYTICS. Financial review, and measure both ways.

**Owner questions:** should "Fixed Income", "Debt Funds" and blank count as Debt? Which benchmark should arbitrage, BAF and multi-asset funds carry?

### NEW-6: FUND_RANKS and MF_RISK are keyed under older spellings than MF_PERF, so the AI Analyst cannot see them
`P0 · data · owner decision: only for renamed schemes · survives revamp: yes`

**Evidence**
- Lookups use the exact `h.perfKey` (`07_engine.js:2058-2059`, `2123`, `2188`, `2570`, `2585`).
- `pr-audit\verify-data-2\v2.js`:
  - 41 of 524 ranked entries and 10 genuine top-3 entries are unreachable.
  - 21 FUND_RANKS keys and 19 MF_RISK Growth keys differ only in spelling, e.g. Kotak Flexicap / Flexi Cap, Kotak Midcap / Mid Cap, ICICI Pru Flexicap (#2/36), HDFC Large and Mid Cap, Axis ELSS Tax Saver. About ₹3.36 lakh Cr AUM.
- `renames.js`: by inception date, ICICI Pru Equity & Debt (#1/29) is now Aggressive Hybrid, and Regular Savings (#2/18) is now Conservative Hybrid.
- `e2e.js`: Kotak Flexi Cap gets "No Centricity score" and "No risk ratios"; only 5 of 8 signals.
- `impact.js`, after re-keying:
  - ICICI Pru Flexi Cap composite 61.61 → 76.88.
  - Samco changes from Partial Rebalance to Exit.
  - Almost every destination changes.
- `poolb.js`: the #2 Flexi Cap and #1 Aggressive Hybrid are never proposed.
- CI cannot see this: the sample generator uses identically keyed schemes.

**Fix:** at build time, re-key FUND_RANKS and MF_RISK onto the current MF_PERF keys (normalize + plan guard; keep `src`). Add a `check_blocks.js` gate that lists anything unresolved, and a `test-ai-analyst.js` case with a drifted scheme.

**Owner question:** may the 15 Aug ranks of the renamed hybrids (same AMFI code) be shown under their new names until a new ranks file arrives?

### NEW-7: MF Analysis risk ratios come from two different fuzzy matchers, neither anchored to the AMC; the Rebalancing rationale quotes other funds
`P0 · calculation · owner decision: no · survives revamp: yes`

**Evidence**
- Screen: `fuzzyMatch` (`11_app_ui.js:1578-1600`) has no brand anchor and drops tokens of 2 characters or fewer, so "JM" vanishes.
- Deck: `_fuzzy` (`08_exporters.js:708-721`) takes the first key with ≥3 shared tokens.
- `MFA_GATE` checks the holding's own age, not the matched record (`09_parsers.js:68-83`).
- `__MFA_DATA` is built for every holding, with no equity filter and no gate (`11_app_ui.js:2097-2112`). It feeds `rbDraft` (`:2573-2587`), which reaches the deck (`08_exporters.js:988`) and the XLSX (`:2106`).
- `pr-audit\verify-ui-1\verify.js`: 360 ONE Liquid / Dynamic Term / Multi Asset rationales quote 360 ONE Flexicap's Sharpe 0.71 vs 0.38 and "above category". 607 of 697 debt/hybrid names resolve to an equity risk row.
- `pr-audit\verify-data-3\e2e.js`, figures printed on the deck vs the screen:
  - Kotak Mid Cap: deck prints ABSL Large & Mid Cap IDCW (Sharpe 0.10); screen shows 0.66.
  - ICICI Pru Mid Cap and Small Cap: deck prints ICICI Pru Large & Mid Cap.
  - HDFC Large & Mid Cap: screen shows HDFC Mid Cap.
  - Tata/LIC ELSS: screen shows JM ELSS, deck shows a 360 ONE index fund.
- 61 of 138 names absent from MF_RISK resolve differently on screen and in the deck.
- When a fund is absent, the screen returns another fund for 1,086 of 1,088.
- This contradicts KI-045: IDCW rows are attached to Growth holdings.

**Fix**
- One resolver in engine scope, stored on the holding as `h.riskKey`:
  - exact `MF_RISK[h.perfKey]` (after NEW-6),
  - else an exact normalised match with a plan guard (G never takes IDCW),
  - else null, shown with a count.
- Screen, `__MFA_DATA` and deck all read `h.riskKey`. Apply `MFA_GATE` inside `__MFA_DATA`, and include equity-MF rows only.
- No fuzzy fallback: `fixprobe.js` shows `matchInstrument` still returns 57 wrong rows for absent funds.

### NEW-8: Direct-plan view substitutes a different scheme for 308 of 2,071 names, and drops holdings
`P0 · calculation · owner decision: no (rule 3 requires a blank) · survives revamp: yes`

**Evidence**
- `07_engine.js:1444` matches the Direct key by name only. `:1445` skips holdings with no match. `:1462` de-duplicates by the Direct key. `:1475` falls back to the Regular bucket under a "Direct Plan" heading (`11_app_ui.js:1353`). `unmatched` is computed before this pass (`:981`).
- `pr-audit\verify-data-4\census2.js`: 1,691 same scheme, 72 missing, 308 a different scheme (299 ETFs; ABSL Dividend Yield → ABSL Large Cap). The vendor Direct monitor has no Dividend Yield funds at all.
- `e2e.js`, `e2e_pptx.js`:
  - ABSL BSE Sensex ETF shows a Silver ETF FoF's 1Y 51.68 (true −8.75) in the XLSX and PPTX.
  - The Dividend Yield group keeps only its benchmark row.
  - `unmatched` is [].
- Exports follow the toggle (`11_app_ui.js:1322`; `08_exporters.js:1688`, `1976`).

**Fix**
- Accept a Direct key only when `normalize(key minus "(Adjusted)")` equals `normalize(h.perfKey)`. A literal string rule would miss 28 real twins because of vendor spelling variants.
- ETFs keep their own figures, labelled single-plan.
- A holding with no Direct twin keeps a blank row with a note and a count.
- De-duplicate by `h.perfKey`; label buckets from `bk.direct`.
- The refresh should flag Regular sheets with no Direct counterpart.

### NEW-9: Hybrid funds' underlying stocks are scaled by the equity-sleeve weight twice
`P0 · calculation · owner decision: no · survives revamp: yes`

**Evidence**
- `07_engine.js:1181` computes `st[1]/100*w*Cv`. In the data, a stock's weight is already % of the whole fund: across all 238 hybrids, sum(stocks)/eq.weight = 1.0000. (Built by `build_refresh.js:180-189` with `09_parsers.js:113-125`.) The mcap/sector lines (`:1179-1180`) are correct.
- `pr-audit\verify-calc-1\repro.js`:
  - ABSL Conservative Hybrid alone: top-20 stocks 15.11% vs 74.07%; ICICI Bank 1.86 vs 9.10.
  - ICICI Pru Aggressive Hybrid alone: 47.12 vs 65.80.
  - HDFC Large Cap + that hybrid 50/50: 56.48 vs 62.93.
- `thresholds.js`: understated by median 1.45x, maximum 10.17x. The "single stock ≥10%" observation (`:1616`) is suppressed for 51 of 238 hybrids, and "top 10 ≥60%" (`:1627-1631`) for 32.
- Appears in Analytics, the deck (`08_exporters.js:67`, `:371`), the XLSX (`:1940-1950`), IPS (`11_app_ui.js:4869-4870`) and post-rebalancing analytics (`:3551`).

**Fix:** use `st[1]/100*Cv`. Add a smoke check that total hybrid stock exposure ≈ eq.weight/100 × CMV.

### NEW-10: The vendor "Debt Analytics" workbook, uploaded to the Bonds / Debt Analytics slot, is read as the simple bond template
`P0 · parsing · owner decision: no · survives revamp: yes`

**Evidence**
- `11_app_ui.js:131-132`: the header "Instrument YTM (%)" matches the substring test for "instrument", so the sheet goes to `parseAdditionalDebt` (`09_parsers.js:255-276`). That parser reads by position:
  - Company Name as the % ("06.01% GOI…" → 6.01),
  - In/Out as the rating,
  - Holding % as the issuer.
- Real file `02 Archive\2026-09\Analytics\Debt Analytics_30th September 2026.xlsx` (`pr-audit\verify-parsing-1\repro_bonds.js`):
  - All 486 schemes are overwritten. 360 ONE Dynamic Term goes from SOV 45.9 / AAA 21.9 to Unrated 81.5 / "In" 11.1 / "Out" 7.4.
  - Sample family: SOV 31.02 → 2.05, UNRATED 0.42 → 47.38.
  - Top issuers become "360 ONE Liquid Fund-Reg(G)" and "4.69642570784777".
  - The status line reports success.
- Through `parseDebtSide` the same file gives figures identical to the embedded data.

**Fix:** a strict positional test, `/^instrument/.test(h[0]) && /allocation/.test(h[1])` (tested in `fix_check.js`). Reject output whose rating labels are not rating-like, and name the detected format in the status line.

### NEW-11: Holdings with no market value are dropped silently from every total
`P0 · data · owner decision: yes · survives revamp: yes`

**Evidence**
- `07_engine.js:746` skips any row whose CMV is null ("NA", "-", blank).
- `pr-audit\verify-parsing-5\v5.js`: PMS "NA" and AIF blank → 11 of 13 holdings load.
  - Status: "Loaded 11 holdings · CMV ₹6.84 Cr" with no skipped count.
  - Invested total 6.20 → 4.95 (₹1.25 Cr gone).
  - The rows are not in `unmatched`, and the IRR upload has no orphan check.

**Fix:** count rows that have an instrument name but no CMV (excluding totals). Return them as `rows.skipped` and list them in the status line and a footnote. Never fill a value. This can ship now.

**Owner question:** show such holdings at zero CMV with a flag, or exclude them and list them?

### KI-026: Uploading the current MF Monitor degrades the embedded data
`P0 · data · owner decision: yes · survives revamp: yes`

**Evidence**
- The runtime `parseMonitor` (`09_parsers.js:184`, `:203`) does not follow the build rules (`build_refresh.js:9-16`, `99-125`). The upload replaces the whole block (`11_app_ui.js:99-100`, `164-166`).
- `pr-audit\verify-parsing-9`:
  - 638 Regular and 447 Direct AUM values are taken from the "in Rs.(Cr)" column dated 30 Jun 2025. 322 of them are >20% off; 89 new funds get a blank AUM. Parag Parikh Liquid 3,852.62 vs 5,228.31; sample 360 ONE Liquid 528.5 → 976.0.
  - YTM/ModDur are lost for 280 Regular schemes (e.g. target-maturity funds). The Debt card average YTM moves 6.86 → 6.99, with funds counted 3 → 2.
  - 207 Direct records keep sheet names such as "Sheet 44", which become categories in Proposed Funds and move 81 debt funds into Equity MF.
  - The SIF `amc` field gets a date string (unused).

**Fix:** use one code path for build and upload (AUM looked up upward, debt fields on any sheet, Direct sheet mapping). Interim: warn when the uploaded file's date equals the embedded date.

**Owner question:** keep the in-browser MF/Direct Monitor upload at all, now that the monthly refresh embeds the same data? Removing it also closes NEW-12's upload path and NEW-30.

### NEW-12: Expense ratios from an uploaded MF Monitor are stored 100x too large
`P0 · parsing · owner decision: no · survives revamp: yes`

**Evidence**
- `11_app_ui.js:120` and `:184` use `er=(erVal>1?erVal/100:erVal)`, but the monitor column is always percent (0.02–4.41).
- `pr-audit\verify-parsing-2\v03_parse.js`: 896 of 2,062 Regular and 1,127 of 1,715 Direct values stored at ≥10%.
- `v05_getmfer.js`: JioBlackRock Nifty 50 Index 50 → 5,100 bps; Liquid 65 → 2,400 bps.
- `v06_e2e.js`: weighted cost 106.10 → 1,311.60 bps. This flows into the Est. Annual Cost KPI, the cost slide (`08_exporters.js:428-457`) and the IPS cost line (`11_app_ui.js:4881-4883`).

**Fix:** always divide by 100. Drop values above 5% and report the count in the status line. Regression test: Parag Parikh Large Cap must come out at 0.0073.

### NEW-13: A missing base ER is filled with an unsourced category estimate or the all-in ratio (also KI-016)
`P0 · data · owner decision: yes · survives revamp: yes`

**Evidence**
- `getMFER` falls back to `SHEET_TER_REG` on the Regular path (`11_app_ui.js:5065-5081`, `5178-5191`; described in KNOWLEDGE_DUMP §5.5 as "never sourced"), and to the monitor's all-in ratio on the Direct path (`:5159-5171`). Rule 3 forbids both.
- `pr-audit\verify-data-8\er_paths.js`: 18 real schemes are priced by estimate, e.g. 13 JioBlackRock Regular plans (Flexi Cap 175 bps) and the Invesco, Kotak and HDFC index funds and ETFs (50 bps).
- `e2e.js`: 24.73 of 88.38 bps in a test book comes from estimates.
- The Coverage KPI counts these rows as covered (`:5134`), and the slide says "Source: Reference data / AMC factsheets" (`08_exporters.js:519`). The tab note is wrong both ways, and KI-016 still reproduces.
- The vendor publishes no Regular base ER for these schemes.

**Fix:** return null, shown as a blank with a footnote and a count. Exclude such rows from Coverage. Remove the all-in fallback. Have `build_er.js` report gaps. Correct the note (including KI-016).

**Owner question:** allow labelled estimates (against rule 3), or leave them blank?

### NEW-14: A cost override above 300 bps is cut 100x the next time the page loads
`P0 · data · owner decision: no · survives revamp: yes`

**Evidence**
- At load, `11_app_ui.js:5052-5061` runs `while(v>0.03) v/=100` and writes the result back to storage. The input allows up to 500 bps (`:5246`), and overrides take precedence over the PMS/AIF defaults (`:5197`).
- `pr-audit\verify-security-3\repro-ovr.js`: 350 → 3.5 bps, 500 → 5 bps.
- In the browser: KPI 171.5 bps on the day; after a reload 108.8 bps, with no warning.
- The input does not clamp (600 → 6 bps).

**Fix:** move to a versioned key, migrating the legacy key once with a single /100. Clamp input to 0–500, and show a notice when a value is rescaled.

### KI-035 (with KI-012): The Cost tab's plan mode and ER overrides carry over to later families and sessions
`P0 · ui-state · owner decision: yes · survives revamp: yes`

**Evidence**
- Persisted state: `cost_mode` (`11_app_ui.js:5097`, `5294-5295`) and the global `COST_OVERRIDES`, keyed by instrument name (`:5052-5061`, `:5193`, `:4889-4892`). `resetFamilyState` (`:265-285`) clears neither.
- `pr-audit\verify-ui-6\cost-carry.js`: family B inherits A's Direct mode.
  - IPS reads "59 bps Within"; on Regular it is 142 bps, a +66.70 bps breach.
  - The deck IPS slide says "Within"; the Cost slide shows Direct ERs against "-Reg(G)" names with no plan label.
- `pr-audit\verify-security-4`: a 250 bps override set in family A applies to family Z after a reload. Z's KPI is 162.3 bps (about 93.8 without it), and the overridden cell looks like a sourced value.
- Editing an ER does not refresh the IPS tab (`:5300-5309`).

**Fix**
- Make this per-family state cleared in `resetFamilyState` (`cost_mode`, overrides, `cost_distributor`, `cvs_cmv*`).
- If persistence is wanted, key it by family and as-on date, mark overridden cells, and name inherited settings in the status line.
- Print the plan basis on the Cost and IPS slides; call `renderIPS` on ER edit.
- Extend `family-isolation.js`.
- Interim: name inherited settings in the status line.

**Owner questions:** should plan mode and overrides persist at all? Should Cost, IPS and Performance share one Regular/Direct selection?

### NEW-15: The AI Analyst can push an AMC above the 20% cap when the base-file AMC label differs from the derived house name
`P0 · calculation · owner decision: no · survives revamp: yes`

**Evidence**
- A held fund's key is `amcDisplay(raw)` (`07_engine.js:939`); AMC_DISPLAY (`:18-30`) has no "ppfas". A destination's key comes from `aiaAmcOfName` (`:1948-1962`) and becomes "PPFAS (Parag Parikh)". All cap tests are keyed by name (`:2544-2549`, `:2615-2656`, `:2693-2708`, `:2750-2803`).
- `pr-audit\verify-calc-3\v02_ppfas_cap.js`: PPFAS 19.00% → **28.90%** of CMV, while the summary says 19% and shows no caveat.
- `v04_hdfc_label.js`: "HDFC Mutual Fund" behaves the same (19% → 28.90%).
- Not yet run: the AMC tab (`:1070`) would split a house whose labels are mixed.

**Fix:** one canonical AMC key function (strip "mutual fund", "mf", "amc", "asset management"; add aliases such as ppfas and absl). Use it at `:939`, in `aiaAmcOfName`, `amcMap`, `amcAfter`, `live[]` and the summary. Add `test-ai-analyst.js` cases for "PPFAS" and "HDFC Mutual Fund" checking the house stays ≤20%.

### NEW-16: AI Analyst degraded Exit keeps its old "unfunded" amount, so "unplaced" exceeds "released"
`P0 · calculation · owner decision: yes (behaviour) · survives revamp: yes`

**Evidence**
- `07_engine.js:2546-2549` reduces `amcAfter` by the full exit, and `:2664-2665` sets unfunded to the full release. When the exit degrades (`:2669-2679`), the release is lowered but unfunded and `amcAfter` are never reset.
- `pr-audit\verify-calc-8\v1_degrade.js`: Union Largecap release 6.10, destinations 0, unfunded 6.40. The KPI reads "₹7.50 Cr released … ₹7.80 Cr unplaced" (`11_app_ui.js:4097-4101`, `4216-4237`).
- `v4_amcafter_sweep.js`: "largest AMC after" reads Invesco 10%; the true figure is Union 12.09%. This is on screen and on the slide.
- CI cannot see it: `test-ai-analyst.js:116` skips sources with no destinations.

**Fix:** in the degrade block, set destinations to [], set unfunded = release, and restore `amcAfter` by (old − new)/total. Compute the largest-AMC-after figure from the final `live` map. Remove the skip at `:116` and add a degraded-Exit fixture.

**Owner question:** when no destination exists, release part of the holding or drop to Retain with a note (HARD RULE 2)?

### KI-004: The AMC 20% cap is measured on two bases (still reproduces)
`P0 · calculation · owner decision: yes · survives revamp: yes`

**Evidence**
- The AMC tab uses the MF book (`07_engine.js:1075`); the AI Analyst cap uses total CMV (`:2700`).
- `pr-audit\verify-calc-10\v3_ki004.js`, sample book: ABSL is 51.64% of the MF book but 37.81% of CMV.
- The impact signal subtracts a CMV weight from an MF-book % (`:2376-2377`).
- `amcAfter` 38.08% matches neither basis: independently it is 40.01% (MF book) or 25.59% (CMV).

**Fix:** use one basis in `amcPctOf` (`:2436`), the impact signal (`:2376-2377`), `amcAfter` (`:2548`, `:2632`) and the cap (`:2700`).

**Owner question:** which basis governs the 20% cap?

### NEW-17: "Apply plan to Portfolio Rebalancing" writes only part of the release when a scheme is held in several plans or by several clients
`P0 · calculation · owner decision: no · survives revamp: yes`

**Evidence**
- `aiaPositions` merges holdings by perfKey and names the merged position after it (`07_engine.js:2012-2050`); `releasePct` is a share of the merged CMV (`:2793`).
- `aiaApplyToRebal` looks up only `rbKey(rec.name)` (`11_app_ui.js:4403-4422`) in an index keyed by each holding's own name (`:2486-2511`).
- `pr-audit\verify-ui-3\repro-apply.js`:
  - With Direct siblings: AI released 4.58 Cr, the Rebalancing tab 3.46 Cr. The Direct rows get no plan.
  - A Direct-only scheme held by two clients, or a multi-client name that differs from the vendor key, is dropped entirely (2.35 vs 3.67).
- The browser shows 5.40 vs 2.83 Cr, and still displays the "Applied" badge (`:4357`).

**Fix:** write every member's own row (`rec.members`) with the same `releasePct`, which reconciles every variant (`repro-apply-fixed.js`). Report members with no row, and warn when the two summaries' released totals differ.

### NEW-18: The Taxation rupee ledger (PMS, AIF, priceless switch-ins) misallocates LT and ST
`P0 · calculation · owner decision: yes · survives revamp: yes`

**Evidence**
- `07_engine.js:304-306` deducts redemption proceeds from cost lots. `:388-400` gives every rupee of cost the same value regardless of lot age.
- `pr-audit\verify-calc-5\v1_rupee_ledger.js`:
  - PMS with two ₹50 L lots: LT/ST CMV 0.829 / 0.829 vs exact 1.102 / 0.556. ST gain 0.329 vs 0.056. Tax 0.1069 vs 0.0865 Cr.
  - With a redemption: tax 0.0953 vs 0.0489, or UNRECONCILED under the other base-file convention.
  - MF bought by a priceless switch-in: ST gain 5.9x too high; priced controls are exact.
- The method text (`11_app_ui.js:4645`) claims per-lot cost.

**Fix:** for MF switch-ins, derive units as base units minus priced-lot units and stay on the unit ledger (no decision needed). For PMS/AIF, stop deducting proceeds, apply the owner's method, and label rupee-ledger splits "approximate" on the tab, slide and harvest section. Add a known-answer test.

**Owner question:** for PMS/AIF, grow each lot at the holding's XIRR, show "not split", or keep pro rata labelled approximate?

### NEW-19: Corporate Bond and Dynamic Bond MFs (and G-Sec ETFs/FoFs) are taxed as listed bonds / G-Secs instead of Sec. 50AA
`P0 · calculation · owner decision: no · survives revamp: yes`

**Evidence**
- In `taxClassOf`, `07_engine.js:245` (`/bond|ncd|debenture/` on product + category) and `:233` (g-sec) run before the MF branch (`:250-253`).
- `pr-audit\verify-pptx-3\v1.js`: 44 of 453 debt MFs (21 Corporate Bond, 23 Dynamic Bond) plus 14 G-Sec ETFs/FoFs are classed with a 12-month rule and 12.5% LT rate.
- Sample: 360 ONE Dynamic Term shows LT gain 0.162 Cr and harvest tax 0.0202 Cr (`v3.js`, tax slides 1/3/5).

**Fix:** guard `:233` and `:245` with `!isMF` (`/mutual fund/` on product). Tested in `v4.js` over 2,130 schemes: direct bonds and G-Secs are unchanged. Add a smoke check; financial review.

### KI-022: Taxation holding-period convention (still reproduces)
`P0 · calculation · owner decision: yes · survives revamp: yes`

**Evidence**
- `pr-audit\verify-calc-10\v2_tax_ki022_ki007.js`: a buy on 10 Sep 2025 stays 100% STCG at 366, 385 and 394 days; LTCG first appears on 10 Oct 2026 (`07_engine.js:259-273`, whole months with a strict ">").
- The holding period ends at the IRR file's date, not the as-on date (`:1838`). With IRR date 10 Sep and as-on 30 Sep, a lot is STCG although it is 13 months old at the as-on date.

**Fix:** classify as LT when as-on > the calendar anniversary (buy date + rule.months, clamped to month end). Pass the review as-on date at `:1838`.

**Owner question:** confirm the "more than 12 months" convention, and that the review as-on date ends the holding period.

### NEW-20: IPS Profile Compliance gives wrong verdicts (screen and slide)
`P0 · calculation · owner decision: yes · survives revamp: yes`

**Evidence**
- `effEq`/`effDebt` = look-through exposure / total CMV (`11_app_ui.js:4757-4768`), where exposure covers look-through holdings only.
- `listedOfEq` divides listed CMV by that exposure (`:4783`, `:4806`).
- A negative `hybridAccounted` (`:4761-4765`) pushes uncovered equity into Commodities/REIT.
- `pr-audit\verify-pptx-2\ips_verify.js` (byte-identical lift), Balanced profile:
  - Equity 48.75% "Within"; the true figure is 74.73%, a +14.73% breach.
  - Listed Equity 150.31%.
  - The rows sum to 74.03%.
- `ips_variants.js`:
  - Adding a gold ETF puts Commodities at 28.43% (+18.43% breach).
  - Adding a G-Sec makes Equity "Within" at 43.75% vs 67.06%.
- "Unlisted through funds 0.00% / −50%" follows DECISIONS_LOG:160.

**Fix:** measure on a CMV basis (asset-tag CMV plus hybrid sleeves). Take the hybrid remainder only from Hybrid-tagged holdings. `listedOfEq` = listed / (listed + unlisted). Smoke checks: rows sum to 100%, Equity = 74.73%, Listed ≤100%. Financial review.

**Owner questions:** confirm the CMV basis; for a family with no unlisted holdings, show "--" or a non-breach instead of −50%?

### NEW-21: Current vs Sample splits every hybrid by the portfolio's overall equity share
`P0 · calculation · owner decision: no (rule 3 sets the fallback) · survives revamp: yes`

**Evidence**
- `_cvsAllocate` uses `eqSlice = equityAnalytics.exposureCr/totalCMV`, with a 0.5 fallback (`11_app_ui.js:5420-5425`).
- `pr-audit\verify-calc-7\cvs_hybrid_repro.js` (code cut from index.html):
  - Sample book's multi-asset fund (own sleeve 23.30%) is split at 48.75%.
  - 80% HDFC Large Cap + 20% conservative hybrid: 96.82 / 3.18 vs 84.08 / 15.92; expected return 13.77% vs 12.85%.
  - 20% hybrid + 80% debt: 0.82 vs 4.08% equity.
- Feeds the CVS slide (`08_exporters.js:560`), the returns and the 3/5/10-year projections.

**Fix:** split each hybrid by its own sleeve (`HYBRID_ANALYTICS[h.hyKey].eq.weight`, or the EQUITY_ANALYTICS mcap sum), with a name lookup for proposed rows. When the sleeve is unknown, show it unallocated with a footnote, not 50/50. Smoke checks.

### NEW-22: The CVS tab and slide ignore the rebalancing plan until something re-renders the page
`P0 · ui-state · owner decision: no · survives revamp: no (keep as a revamp acceptance test)`

**Evidence**
- `renderCVS` runs only from `renderAll` (`11_app_ui.js:517`, before `renderRebal` at `:518`) and from Re-seed (`:5686`). `renderRebal`/`rbRecalc` don't call it (`:3074-3077`, `:3203-3206`, `:3683`).
- `pr-audit\verify-ui-4\cvs-stale.js`: after an exit, slide 30 shows Equity MF 52.43%/52.43% (+0.00%). After Re-seed it shows 52.43 → 48.61% (−3.82%).
- Any full render freezes a half-built plan.

**Fix:** call `renderCVS` (debounced inside `rbRecalc`) at the end of `renderRebal` and `rbRecalc`. Edited cells are preserved. Add a browser check.

### KI-008: Text from uploaded workbooks is written into the page as HTML, and there is no Content-Security-Policy
`P0 · security-privacy · owner decision: no · survives revamp: yes (escape-by-default is a revamp requirement)`

**Evidence**
- `pr-audit\verify-security-1\xss-probe.js`, on the current build (MD5 f0eb0101…): markers fire in 12 tabs and the status line, from:
  - Instrument, Client, Category, Asset, Product, AMC and Distributor names,
  - free-text Purchase Date (`07_engine.js:738` → `11_app_ui.js:634`),
  - the overlap `title` attribute (`:844`).
- One cell sent "Loaded 13 holdings · 2 client(s) · CMV ₹8.74 Cr" to a URL (local test server only), breaking the no-network rule.
- Legitimate names with "&" or "<" display wrongly.
- Reference uploads (`pr-audit\verify-security-5`):
  - a client SOA "Corrected Name" fires on the Analytics tab (`:747`),
  - SEBI Mcap fires in Observations (`:1403`, `:1411` via `07_engine.js:1506`, `1586`, `1617`, `1715`),
  - a bond issuer fires on the Analytics tab (`:758`).
- No CSP anywhere (`pr-audit\verify-security-2\scan-csp.js`), and GitHub Pages cannot set headers. A meta CSP tested on a copy:
  - blocks image beacons,
  - leaves the exports identical (61 slides, 15 sheets),
  - still lets an injected handler run and navigate, because of `'unsafe-inline'`.

**Fix**
1. One shared escape helper in the UI scope, applied at every data sink, including attributes and `setStatus` (`:51`, `:80-81`, `:418`, `:5729`, `:5736`). Use `textContent` where no markup is needed.
2. A meta CSP: `default-src 'none'; script-src/style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'`. Later, replace `'unsafe-inline'` with hashes, after the 3 inline onclick strings are removed.
3. `check-invariants.js` asserts the CSP. A browser check loads base, SOA and bond files with markers in every column and expects zero injected elements.

Not yet tested under the CSP: logo and Market Update uploads, the overlap PNG, `file://`.

## P1: output defects and robustness

### NEW-23: Taxation joins lots to holdings on exact names and ignores the distributor split
`P1 · calculation · owner decision: yes (apportionment) · survives revamp: yes`

**Evidence**
- Lots are keyed by exact lower-cased client||instrument (`07_engine.js:284-285`, `:302`, `:328`), while Fund IRR resolves clients and instruments fuzzily (`:1008-1018`). Base rows stay split by distributor (`:776`), but each row is reconciled against the combined lots (`:338-375`).
- `pr-audit\verify-calc-4\v4_two_distributors.js`: the same fund via two distributors leaves both rows UNRECONCILED (43,655.93 and 18,947.52 vs FIFO 62,603.44 units). Both are blamed on a "missing bonus/split", and the LT/ST split is lost. The single-distributor control is exact.
- `pr-audit\verify-parsing-8\v8_taxjoin.js`:
  - IRR client written "Mr. Sample Client A" → 0 positions and 100% unclassified, while Fund IRR stays exact.
  - "Fund - Reg (G)" → 7 unreconciled.

**Fix**
- Store `h.irrKey` during the `irrInstr` pass and key the lots by it.
- Reconcile the summed units of rows that share a key.
- Attribute lots per folio when FOLIO_NO is on both sides (`09_parsers.js:401`, `:801`); otherwise apportion by units, labelled as such.
- Fix the reason text and measure the KI-032 risk.

Unverified lead: the XIRR override (`:1022`) gives both distributor rows the same blended XIRR.

**Owner question:** when folios are absent, may lots be apportioned to distributor rows by units?

### NEW-24: Taxation ignores common transaction types and blames a missing bonus/split
`P1 · calculation · owner decision: yes · survives revamp: yes`

**Evidence**
- `TAX_BUY`/`TAX_SELL` are anchored exact lists (`07_engine.js:209-210`); any other type is dropped silently (`:299-300`). KNOWLEDGE_DUMP §6.4 lists Additional Purchase/Top-Up, STP-In/Out, SWP and Stock-In.
- `pr-audit\verify-calc-6\v6_tax_ttypes.js`, `pr-audit\verify-parsing-7\v7_ttypes.js`: each of these labels (and SIP) makes the holding UNRECONCILED (69,599 vs 54,068 units; SWP 39,079 vs 48,849). Stock-In as the only buy gives "No purchase transactions".
- An unknown buy of ≤1% of units is silently rescaled (`:377`), which reports an Aug-2026 lot as long-term.

**Fix:** widen the lists, without a bare "purchase" substring. Count unrecognised types and name them in the reason. Skip the 1% rescale when unknown rows exist. Add a smoke test.

**Owner question:** confirm the exact TRANSACTION TYPE strings in a real export, the acquisition date for Stock-In/Transfer-In, and whether dividend reinvestment adds lots.

### KI-037: Hybrid MFs never get a tax class (still present)
`P1 · calculation · owner decision: yes · survives revamp: yes`

**Evidence:** `07_engine.js:251` returns null, so BAF, Aggressive Hybrid, Equity Savings and Multi Asset land in "unmapped" (`pr-audit\verify-calc-10\v4_ki037.js`, unclassified 0.12 Cr). The three Hybrid rows in REF.TAX_RULES are never selected.

**Fix:** choose the Hybrid row from the fund's equity share (HYBRID_ANALYTICS), with financial review.

**Owner question:** the equity-share thresholds and treatment.

### NEW-25: The overview G/L KPI and the client sheets use different G/L definitions
`P1 · calculation · owner decision: yes · survives revamp: yes`

**Evidence:** the KPI uses totalCMV − totalInv (`07_engine.js:1829`; `11_app_ui.js:547`; `08_exporters.js:216`). The client-sheet Grand Total sums the file's G/L column (`:1082-1094`). `pr-audit\verify-calc-10\v1_ki006_007.js` case E: 0.70 vs 0.80 Cr with no blank cells at all.

**Fix:** use one definition everywhere.

**Owner question:** CMV − Invested, or the file's Total Gain/Loss column?

### NEW-26: Unmatched PMS/AIF/SIF holdings are filed under MF performance buckets
`P1 · output-xlsx · owner decision: no · survives revamp: yes`

**Evidence**
- `bucketOf` decides from `perfSrc`, which is set only on a match (`07_engine.js:1366-1376`, `:985-989`), although `h.pcls` is always set (`:957`).
- `pr-audit\verify-calc-11\v1_bucket.js`: in the XLSX Performance sheet (`08_exporters.js:1976`):
  - an unmatched PMS appears under Equity MF with Nifty benchmarks,
  - an AIF Cat III gets a "Category III" group,
  - a Debt-AIF and a SIF create whole Debt MF and Hybrid MF sections.
- The screen and PPTX filter these rows out (`11_app_ui.js:959-979`).
- `v3_altcmv.js`: SWOT's alternatives share (`:1558`) treats unmatched PMS/AIF as 0, so a "well-diversified" strength disappears (screen, PPTX, XLSX).

**Fix:** `bucketOf` returns `h.pcls` for PMS/AIF/SIF, and `:1558` uses pcls. Until KI-024 is decided, give an unmatched Debt-AIF no equity benchmark.

### NEW-27: Missing benchmark series appear as a named benchmark with all dashes
`P1 · data · owner decision: yes (series) · survives revamp: yes`

**Evidence**
- `resolveBench` returns `{name, r:{}}` (`07_engine.js:637-643`), and the row is still added (`:1426-1427`, `:1468`, `11_app_ui.js:1241`). The equity path omits such series (`:1418-1424`), but `missingBench` is never rendered anywhere.
- `pr-audit\verify-data-6\v2_book.js`: Arbitrage, BAF, DAA, Equity Savings, Gold, Silver and Global show empty rows on screen and in the PPTX and XLSX (`08_exporters.js:1984-1985`). The laggard check skips these funds (`:1764-1771`).
- The vendor carries "Nifty 50 Arbitrage", but it is filed into MF_PERF as a scheme (`build_refresh.js:98`).

**Fix:** recognise "Nifty 50 Arbitrage" as a benchmark (build and parser) and alias it. Treat an empty series as missing (omit and record it), and render `missingBench` as a footnote on screen, PPTX and XLSX.

**Owner question:** which series should BAF, DAA, equity savings, gold, silver and global funds use?

### NEW-28: Base-file loader reads only the "Base File" or first sheet, scans the header in the first 5 rows only, and gives a misleading error
`P1 · robustness · owner decision: no · survives revamp: yes`

**Evidence:** `11_app_ui.js:58`; `07_engine.js:701-704`. `pr-audit\verify-parsing-5\v5.js`:
- An empty or note "Sheet1" in front of "XYZ-HOLDING-REP" → 0 rows.
- Header on row 6 → 0 rows.
- The message asks for "a Base File sheet with the 19 standard columns", while the app's own template has 18 (`:42`).

**Fix:** try each sheet and use the first that parses rows, naming it in the status line. Scan about 20 rows. Correct the message.

### NEW-29: The IRR parser silently drops or misdates rows
`P1 · parsing · owner decision: no · survives revamp: yes`

**Evidence**
- Code: `09_parsers.js:398-399` skips unreadable rows uncounted; `:359-360` has no range check; `:363` falls back to `new Date(s)`; `:410` lets the last matching sheet win. The status line shows counts only (`11_app_ui.js:195`).
- `pr-audit\verify-parsing-6\v2_e2e.js`:
  - A dd/mm/yy file keeps 8 of 29 rows (misdated), gives "IRR as on 1 Sep", a blank total and 6 unreconciled.
  - "16-Jan-2023" reads as 15 Jan (as-on 29 Sep); "13-13-2023" reads as 2024-01-13.
  - "(1,23,456.50)" drops all 15 purchases.
  - "1,23,456.50 Dr" is kept as positive.
  - An extra "XIRR Summary" sheet makes the upload fail; a "BMXIRR Notes" sheet silently replaces the benchmark sheet.
- Lost flows leave the base-file XIRR in place while the page says the XIRR is transaction-based.

**Fix:** report skipped counts by reason. Parse the listed formats explicitly in UTC and round-trip-validate them; remove the `new Date` fallback. Handle "(x)", "Dr", "−" (U+2212) and "Rs.". Pick sheets by exact name, then by header. Add a smoke test.

### NEW-30: The Direct MF Monitor is accepted in the Regular slot (and vice versa) without warning
`P1 · robustness · owner decision: no · survives revamp: yes`

**Evidence:** `11_app_ui.js:98-101` and `:163-166` check only that at least one scheme exists, and the matcher ignores plan words (`07_engine.js:53-54`). `pr-audit\verify-parsing-10\swap_repro.js`: all 7 sample MF holdings take Direct returns (ABSL Large Cap 3Y 7.74 → 8.45). `unmatched` stays at 1. The build already checks this (`check_blocks.js:39-40`).

**Fix:** after parsing, reject by majority (Sep files: 98.7% Direct keys vs 0.6%) and state the detected plan type in the status line. Moot if the KI-026 decision removes the upload.

### NEW-31: A client SOA whose Product Category is not exactly "PMS"/"AIF" loses its class
`P1 · parsing · owner decision: no · survives revamp: yes`

**Evidence**
- `09_parsers.js:300` requires an exact match. Unclassed uploads go to the MF pool (`07_engine.js:908-911`) and overwrite an embedded entry of the same name, while the status says they "take priority" (`11_app_ui.js:143-147`).
- `pr-audit\verify-parsing-12`:
  - "PMS - Discretionary" destroys an existing embedded PMS look-through.
  - An MF with no look-through of its own can take the PMS's look-through, crossing product class (against rule 4).

**Fix:** use the base file's substring rule. Report unclassed schemes in the status line and never merge or overwrite with them. Backstop at `:910-911`.

### NEW-32: PPTX tables and panels are sized by fixed counts, so content runs under boxes, into the footer or off the slide
`P1 · output-pptx · owner decision: no · survives revamp: yes`

**Evidence** (all measured in PowerPoint)
- **Asset Allocation** (`08_exporters.js:232`, `:244`):
  - At 10 or more asset/product rows, the INSIGHT box covers the Grand Total. The shipped sample already hides 6.20 / 8.74 / 100.00%.
  - At 18 rows the Grand Total is off the slide (`pr-audit\verify-pptx-1\r2`).
  - The minimum row height is 0.250 in, so the suggested "0.22" cannot work.
- **Holdings** (`:341`, `:346-347`):
  - With an "(ARN-…)" distributor name the table ends at 8.59 in, so holdings and the client Grand Total fall off the slide.
  - "Pvt. Ltd." already overflows in the browser's 10-column export (`pr-audit\verify-pptx-4`).
  - Page 1 is titled "(cont. 1/2)" and section headers are orphaned.
- **Rebalancing** (`:967`, `:1001-1004`, `:1049-1050`):
  - The 0.10 in cell padding is never budgeted.
  - Short rationales or New Addition rows end at 8.92 in; default drafts lose the totals (`pr-audit\verify-pptx-5`).
- **SWOT** (`:677-691`):
  - Font size is chosen by point count, so long threat bullets run to 7.24 in over the footnote.
  - Fewer long bullets overflow while more bullets fit (`pr-audit\verify-pptx-9\inject.js`).

**Fix:** one shared height estimator (wrapped lines × font × 1.2/72 + 0.10 in), used to paginate against the 1.12–6.85 in band:
- Place the insight box below the actual table.
- Keep headers with their first row and repeat them on continuation pages; drop "cont." on page 1.
- Rebalancing: budget 5.0 in, cost 0.10 + 0.125 × lines (tested: all 12 scenarios fit, worst 6.82 in).
- SWOT: step the font down from 9.5 to 7, then continue on a second slide.
- Re-check every page boundary in PowerPoint.

### NEW-33: Exports ignore the review's money unit (Lakh families) and hard-code ₹ Cr with fixed decimals (also KI-040)
`P1 · output-pptx · owner decision: no · survives revamp: yes`

**Evidence**
- MF Analysis chart (`08_exporters.js:845`): values are raw Cr while the table beside it is in Lakh. Table 7.91, chart 0.08, and the bar proportions are wrong (`pr-audit\verify-pptx-6`).
- Cost slide and on-screen Cost tab (`08_exporters.js:457-502`; `11_app_ui.js:5230-5282`): "Est. Annual Cost Rs 0.00 Cr" (true cost about ₹17.6k).
- AI Analyst deck table in Cr (`08_exporters.js:1314-1355`) while the screen and the summary slide use Lakh. The XLSX AI Analyst headers are "CMV (Cr)" / "Release (Cr)" (`:2151-2166`).
- CVS slide uses whole crores (`:567`, `:627-631`):
  - 8.74 Cr family: "Rs 9 Cr", and a 3Y row reading "13 / 13 / +1 Cr".
  - 43.7 L family: "Portfolio CMV: Rs 0 Cr" and "+0 Cr" on every horizon (`pr-audit\verify-pptx-7`).

**Fix:** use `model.unit.v/t/m` and `unit.lab` wherever money is printed, with at least 2 decimals.

### NEW-34: AI Analyst rounding and thresholds are absolute ₹ Cr steps
`P1 · calculation · owner decision: yes · survives revamp: yes`

**Evidence**
- Code: 0.01 Cr rounding (`07_engine.js:1941-1944`, `:2790-2794`); 0.004 Cr thresholds (`:2528`, `:2608-2624`, `:2677`); release % taken from the rounded release (`:1921-1925`); rationale text in Cr (`:2819`, `:2840-2843`).
- `pr-audit\verify-xlsx-7\repro.js`, 8.74 L family:
  - "Partial Rebalance … Reduce by ₹0.00 Cr (0.0%)" where the true figure is 0.437 L (45.5%).
  - Release % 79.6 vs 58.2.
  - Actions flip to Retain compared with an identically weighted 874 L book, and no destination is funded.

**Fix:** carry unrounded amounts and round only for display. Make thresholds relative to the portfolio. Set the action from the final release, and make the rationale unit-aware. Financial review.

**Owner question:** should the ₹40,000 minimum action and ₹1 L rounding scale with portfolio size?

### NEW-35: The CVS slide labels house assumptions "IRR%" and omits the inflation-adjusted rows
`P1 · output-pptx · owner decision: no · survives revamp: yes`

**Evidence:** headers "Curr. IRR%" / "Prop. IRR%" (`08_exporters.js:580-582`), while the screen says "Exp. Return %" and notes they are house assumptions (`11_app_ui.js:5508-5510`, `:5670`). The slide states 6.5% inflation but has no inflation-adjusted or real-value rows (screen `:5582-5598`). Group rows are blank (screen `:5525-5531`).

**Fix:** rename the headers now. Add the inflation rows from a helper shared with the screen, placed in a side table (25 rows already end at ~6.72 in). Fill the group rows.

### KI-002 / KI-003: The Overlap slide has no matrix, and the post-rebalancing overlap slide is never produced (still reproduce)
`P1 · output-pptx · owner decision: no · survives revamp: yes`

**Evidence**
- `pr-audit\verify-pptx-8\ki002_003.js`: the overlap slide contains 1 picture (the logo) and 0 tables.
- The guard at `08_exporters.js:415` throws "ovTh is not defined", which is swallowed. `model.overlapView` (`11_app_ui.js:5718-5725`) is never read (`:412`).
- KI-003: the check at `:1131` is false in exporter scope. Picking only that slide yields an orphan divider (`:555`).
- The screen does draw the post-rebalancing matrix (`11_app_ui.js:787-800`).

**Fix:** build a native PPT table from `model.overlapView || model.overlap` (testable headless). Add the overlap to `window.__REBAL_DATA.post` (`:3693`). Emit a divider only when a slide follows it.

### NEW-36: The deck drops the MF Analysis young/unresolved disclosure and the client-scope label
`P1 · output-pptx · owner decision: no · survives revamp: yes`

**Evidence**
- Counters are incremented at `08_exporters.js:768`, reset by the `var` declaration at `:788`, and never read. Blank-metric funds ("Sample Unknown Opportunities", the young 360 ONE Flexicap) show only "—" with no explanation, whereas the screen explains them (`11_app_ui.js:1981-1985`). This breaks rule 3.
- A client-scoped Analytics download (`11_app_ui.js:401`, `:661-662`) is titled like the family deck. 167 vs 398 stocks under the same title, with no client name anywhere (`08_exporters.js:398-407`; `pr-audit\verify-pptx-12\verify.js`).

**Fix:** declare the counters before the map and add the screen's sentences to the footnote (re-check pagination). Add a `meta.scopeClient` flag and append the client name to titles and footnotes.

### KI-034 (extended): Direct-plan figures are exported under "-Reg(G)" names with no plan label
`P1 · output-xlsx · owner decision: no · survives revamp: yes`

**Evidence:** `pr-audit\verify-xlsx-3\v.js`: the XLSX row "Aditya Birla SL Large Cap Fund-Reg(G)" shows inception 01-01-2013 and SI 13.16 (Regular: 30-08-2002, 17.55). 15 rows differ, and no plan label appears anywhere (`08_exporters.js:1975`; PPTX `:1703`, `:1735`). The tab says the exports follow the selection (`11_app_ui.js:1332`). Proposed Funds already labels the plan (`08_exporters.js:1745`). The date half is latent, because the dates are equal today.

**Fix:** add the plan label and `directAsOn` to the XLSX header and bucket titles and to the PPTX title and footnote. Optionally add a "Matched As" column. Depends on NEW-8.

### NEW-37: PMS and AIF performance (and their look-through) are captioned with the MF date
`P1 · output-pptx · owner decision: no · survives revamp: yes`

**Evidence**
- DATA_DATES has no pms/aif keys, so every bucket uses `dataDates.performance` (`11_app_ui.js:1326`, `:1353`; `08_exporters.js:1735`, `:1975`).
- PMS data is 31 Jul and AIF data 30 Jun (`docs/refresh-log/2026-09.md:21`).
- `pr-audit\verify-data-5\pmsaif-date.js`: the PMS and AIF slides say "Performance as on 30 Sep 2026". The 15 PMS/AIF look-throughs (31 Jul) are captioned "Analytics as on 30 Sep 2026" (`08_exporters.js:399`).
- SIF is labelled correctly (`07_engine.js:1431`).

**Fix:** add DATA_DATES.pms / aif / pmsLook, written by buildtools and the upload handler (`11_app_ui.js:150-152`) and restored on reset. Label buckets "PMS (as on …)" as SIF does, use per-bucket footnotes, and add a look-through vintage clause.

### NEW-38: The XLSX Asset Allocation sheet puts the liquidity percentages in the "Investment Amount (Cr.)" column
`P1 · output-xlsx · owner decision: no · survives revamp: yes`

**Evidence:** `08_exporters.js:1906-1908` writes the % into column 1 with the Crore format (`07_engine.js:1062`). `pr-audit\verify-xlsx-4\repro.js`: "Open Ended 92.55" in an 8.74 Cr book; a Lakh book shows 92.55 under "Investment Amount (Lakhs)".

**Fix:** give the block its own header and write the % in the "% CMV" column.

### NEW-39: The XLSX Equity and Debt Analytics sheets carry no vintage and no coverage disclosure
`P1 · output-xlsx · owner decision: yes (deck only) · survives revamp: yes`

**Evidence:** `08_exporters.js:1938-1963`. `pr-audit\verify-xlsx-5\repro.js`: the 4 excluded holdings (₹2.27 Cr, 35.4% of Equity CMV), their reasons, `model.unmatched` and the "Analytics as on" date all appear nowhere in the workbook. The screen and the deck carry the date (`11_app_ui.js:751-764`; `08_exporters.js:399`, `:407`).

**Fix:** add the vintage line, a coverage line ("7 of 11 holdings; ₹2.27 Cr excluded"), an Excluded block, and the unmatched count on the Base File sheet.

**Owner question:** list the excluded holdings in the deck too? (The fund box was decided as screen-only on 20 Aug.)

### KI-021: The Excel export fails for some client names (still reproduces, wider)
`P1 · robustness · owner decision: no · survives revamp: yes`

**Evidence**
- `08_exporters.js:1890` truncates to 31 characters only; `:1935` passes the raw name.
- `pr-audit\verify-xlsx-6\repro.js`, cases that make the build throw, so no file is produced (`11_app_ui.js:5734-5737`):
  - an individual and their HUF whose names share the first 31 characters,
  - names with "/" or "[" ("A/B Family Trust"),
  - a client named "Performance" or "Base File".
- `xlopen.ps1`: names with ":" and case-only duplicates build, but Excel refuses to open the file.

**Fix:** a `safeSheetName` helper: replace illegal characters, trim apostrophes, reserve the fixed sheet names and "History", truncate to 31, de-duplicate case-insensitively with " (2)". Put the full name in A1. Add smoke cases.

### NEW-40: Values typed into the CVS table revert to house defaults on any recompute
`P1 · ui-state · owner decision: no · survives revamp: no (keep as a rule)`

**Evidence**
- `renderCVS` rebuilds from literals (`11_app_ui.js:5333-5358`, `:5609`). Typed values live only in a local copy (`:5638`), and edited rows skip seeding (`:5446-5449`).
- `pr-audit\verify-ui-5\cvs-revert.js`: typing 30% / 15.5% then uploading an IRR file gives 20.00% / 14.00% on screen and in the deck snapshot. The same happens on a date change, a reference upload or a reset.
- This contradicts the on-screen note (`:5670`).

**Fix:** a module-level store keyed by group, row and field, applied after seeding and cleared in `resetFamilyState`. Re-seed clears only the sample allocations; "Reset to Actual" clears only the current allocations.

### NEW-41: Clearing the as-on date labels the review "20 May 2026"; every keystroke recomputes
`P1 · ui-state · owner decision: no · survives revamp: yes`

**Evidence:** `11_app_ui.js:39` accepts any value, and the engine falls back to a hard-coded date (`07_engine.js:887`). `pr-audit\verify-ui-8\verify-ason.js` plus the browser: one Backspace puts "20 May 2026" on 14 of 45 slides, the file names and the workbook. Typing the year fires 0002, 0020, 0202, and each recompute wipes the plan (`:2889-2890`, KI-019). Defaulting to today is a recorded decision (DECISIONS_LOG:83).

**Fix:** ignore empty, invalid or pre-2000 values. Recompute on blur, and only on change. Replace the engine fallback with a visible "date not set", or block export.

### NEW-42: Blocked browser storage blanks the Cost, IPS and CVS tabs and breaks the full deck
`P1 · robustness · owner decision: no · survives revamp: yes`

**Evidence:** unguarded reads at `11_app_ui.js:5028`, `5097`, `5470`, `5045`, `5294-5295` and `08_exporters.js:164`, `565`; the `typeof` checks do not catch the SecurityError. `pr-audit\verify-ui-9\repro.js` (headless Chrome with site data blocked):
- the three tabs render only the download bar,
- "PowerPoint generation failed", and the IPS/CVS single slides fail,
- Excel still works.

**Fix:** one try/catch storage helper exposed to exporter scope (rule 5), with defaults (Balanced, Regular, 6.5, no overrides). Add a browser check with a throwing getter.

### NEW-43: Picking the same file again (after × or after editing it) is ignored
`P1 · ui-state · owner decision: no · survives revamp: no`

**Evidence:** `11_app_ui.js:15-28` and `:89-90` never reset the input's value. `pr-audit\verify-ui-11\cdp-repro.js` (Edge and Chrome 155): no change event fires. A corrected file re-picked without × leaves the page showing the old "13 holdings · ₹8.74 Cr", and exports use those stale numbers. `family-isolation.js` cannot catch this because it dispatches a synthetic change event.

**Fix:** in the listener, capture the file, then set `e.target.value = ''`. Do the same in `refUpload`. Add a browser check through a real file chooser.

### KI-019: After an as-on change, the slide picker still shows ticks but the export is something else (wording corrected)
`P1 · ui-state · owner decision: yes · survives revamp: no`

**Evidence:** `renderRebal` resets `SLIDE_PICK` (`11_app_ui.js:2889-2890`) after the nav has been drawn (`:442-498`). `pr-audit\verify-ui-7`: the nav still says "2 slides selected" but the full deck is exported. Ticking one more box exports only that box while three show ticked.

**Fix:** don't reset on a same-family date change (the family reset already happens at `:278`), or repaint the checkboxes after a reset.

**Owner question:** should a date change for the same family keep the plan and the slide picks?

## P2: minor

### NEW-44: Negative totals in dark red on black; negative KPI and Fund XIRR not red
`P2 · output-pptx · owner decision: no · survives revamp: yes`

**Evidence:** `08_exporters.js:316-322` gives 2.38:1 contrast on the Grand Total rows (`pr-audit\verify-pptx-10\dump.js`). `kpi()` is always black (`:129-133`), and so is the Fund XIRR cell (`:540`).

**Fix:** use a light red (FF8A8A) on dark fills, add a colour argument to `kpi()`, and colour negative XIRR red.

Side lead: `contribLag` (`07_engine.js:1740-1741`) lists negative contributions as "top contributors".

### NEW-45: Pie and doughnut labels are whole percent; small-slice labels are unreadable
`P2 · output-pptx · owner decision: no · survives revamp: yes`

**Evidence:** `08_exporters.js:236-243`, `:388-389` produce a "0%" format. `pr-audit\verify-pptx-11`: "73% / 21% / 6%" next to a table showing 73.28 / 20.51 / 6.21; "UNRATED 0%" for 0.42%, colliding with another label; white labels on cream at about 1.07:1.

**Fix:** `showValue` with `'0.00"%"'`, dark labels, and no label below 1%.

### NEW-46: Deck MF Analysis categories follow CMV order; single-distributor families export hidden slides
`P2 · output-pptx · owner decision: yes · survives revamp: yes`

**Evidence:** `08_exporters.js:799` sorts the category list in place (the comment at `:792-796` and the screen at `11_app_ui.js:1733-1738` expect SEBI order). `allocSlides` skips only zero columns (`:251`), so a one-distributor family exports two "Distributor Level" slides the screen hides (`11_app_ui.js:427-467`). `pr-audit\verify-pptx-12\order.js`.

**Fix:** sort a copy; skip when there are fewer than 2 columns.

**Owner question:** confirm single-distributor and single-client allocation slides are left out of the deck.

### NEW-47: The XLSX Base File "Allocation (%)" is blank for merged folios and for files from the app's own template
`P2 · output-xlsx · owner decision: yes · survives revamp: yes`

**Evidence:** `07_engine.js:800` nulls it on merge and nothing recomputes it; `08_exporters.js:1898` exports it ×100. `pr-audit\verify-xlsx-8\verify.js`: the column sums to 85.64 with one duplicate folio, and is all blank with the 18-column template.

**Fix:** export `cmvCr/totalCMV×100`.

**Owner question:** should the sheet echo the uploaded file verbatim, or show computed values (and be renamed)?

### NEW-48: The XLSX Distributor and Client Allocation sheets store pre-rounded values with no number format
`P2 · output-xlsx · owner decision: no · survives revamp: yes`

**Evidence:** `08_exporters.js:1920-1929`. `pr-audit\verify-xlsx-9\repro.js`: 7.48 + 1.27 = 8.75 but the total cell shows 8.74; 5.68 + 0.72 = 6.40 vs 6.41. The asset order difference is intentional (`07_engine.js:1812`).

**Fix:** write unrounded `unit.v` values with the Crore number format.

### NEW-49: The two Overlap panels' Clear buttons are cross-wired; the post-rebalancing PNG states the wrong threshold
`P2 · ui-state · owner decision: no · survives revamp: no`

**Evidence:** a duplicate id "ovClr" is wired by a document-wide lookup (`11_app_ui.js:902-904`), against the function's own warning (`:852-854`). `pr-audit\verify-ui-10\ov-clear-repro.js`: the main panel's Clear does nothing, and the post panel's Clear resets the main matrix. `overlapCanvas` prints the main panel's threshold and a fixed title (`:923`, `:925`).

**Fix:** scope the button to its panel, and pass the threshold and title into `overlapCanvas`.

### NEW-50: Benchmark index rows ("Average", "NIFTY 500", "S&P 500") are offered as funds in the proposal picker
`P2 · data · owner decision: no · survives revamp: yes`

**Evidence:** 28 Regular and 23 Direct rows carry `bm:true` (`build_refresh.js:134`), but nothing reads the flag. `rbUniverse` (`11_app_ui.js:2788-2805`) offers them; `rbGuessAP` (`:3300-3330`) files "Average" as Equity/MF/"Gold" with no custom badge. `pr-audit\verify-data-9`: the claim that index figures appear as fund figures is refuted (filtered at `:1078-1097`).

**Fix:** treat a row as an index when `r.bm || (aum==null && !inception)` and skip it in `rbUniverse` and `rbGuessAP`.

### NEW-51: REF.MF_CAT_BM is documented as used but is never read
`P2 · data · owner decision: no · survives revamp: yes`

**Evidence:** no reader in `.blocks` (only `check-invariants.js`), while KNOWLEDGE_DUMP §5.6 and ARCHITECTURE.md:167 say the Performance tab uses it.

**Fix:** correct the docs (deleting or wiring the block can wait for the KI-024 decision).

### NEW-52: The account's real Gmail address is in the public commit history, contrary to D-008
`P2 · security-privacy · owner decision: yes · survives revamp: yes`

**Evidence:** merge commit 9f018e4 (GitHub web merge) is authored by the account's Gmail address and is public on origin/main. The global the laptop's global git configuration also sets that address, so a fresh clone that skips the per-repo setup would commit with it (`pr-audit\verify-security-6\check-emails.sh`).

**Fix:** turn on GitHub "Keep my email private" and "Block command line pushes that expose my email". Merge locally until then. Set the global email to the noreply address. Correct D-008 and record the exposure in KNOWN_ISSUES.

**Owner question:** accept the permanent exposure (rule 8 forbids rewriting history) and change the account settings?

---

## Unverified leads (code reading only)
- XIRR override `07_engine.js:1022` joins on client+instrument, so both distributor rows of one fund get the same blended XIRR.
- AMC tab `07_engine.js:1070`: a book mixing "PPFAS" and "Parag Parikh" labels would show two rows for one house.
- `contribLag` fills "Top 5 contributors" with negatives when every contribution is negative.
- KI-018 has not been re-verified headlessly.
- Firefox with storage disabled, and `file://` under the CSP, are untested.
- The real IRR transaction-type labels have not been checked; no real data was used.

## Recommended fix order

**(a) Fix now: clear-cut and survives a UI revamp.** Nothing here needs next week's files; synthetic test data and the archived September vendor data are enough. Suggested PR batches:
1. **Engine numbers** (financial review + known-answer tests): NEW-1, NEW-9, KI-006, KI-007, NEW-2, NEW-19, NEW-15, NEW-17, NEW-16 (bookkeeping only), NEW-21 (unknown sleeve shown unallocated per rule 3).
2. **Reference-data joins:** NEW-6 (normalised re-key + `check_blocks.js` gate, ideally inside the next refresh), then NEW-7 (depends on NEW-6), NEW-8, KI-034, NEW-26 (Debt-AIF gets no equity benchmark pending KI-024).
3. **Uploads and parsers:** NEW-10, NEW-12, NEW-14, NEW-28, NEW-29, NEW-30, NEW-31, NEW-23 (irrKey/folio join and reason text), NEW-24 (widen the lists, report unknown types).
4. **Security:** KI-008 (escape helper, CSP, invariant, browser check).
5. **Exports:** NEW-32 (Asset Allocation first; it hides the Grand Total on every deck), KI-002/003, NEW-33, NEW-36, NEW-37, NEW-38, NEW-39 (vintage + coverage), KI-021, NEW-35 (header rename), NEW-27 (omit + footnote, Arbitrage alias), NEW-48, NEW-50, NEW-51.
6. **Robustness:** NEW-42, NEW-41.
7. **UI wiring to fix now although the revamp will rewrite it,** because it changes deck numbers or keeps stale data today (keep each as a revamp acceptance test): NEW-22, NEW-40, NEW-43.

Safe interim steps for some (b) items, which can ship with (a):
- NEW-3: drop IRR-only clients and add the coverage footnote.
- NEW-11: list skipped rows.
- NEW-13: flag estimated ERs and remove the false source line.
- KI-026: warn when the upload has the embedded vintage.
- KI-035: name inherited settings in the status line and print the plan basis on the slides.

**(b) Needs an owner decision first**
- KI-004: cap basis.
- KI-022: holding-period convention and end date.
- KI-005: fallback when no % format.
- NEW-3: redeemed instruments, invalid benchmarks, duplicate folios.
- NEW-4 + KI-036: matching tightening (rule 4) and who owns the rename aliases.
- NEW-5: which Product labels are non-MF.
- KI-024 + NEW-27: Asset synonyms and hybrid/arbitrage/commodity benchmark series.
- NEW-11: zero-CMV row vs list.
- NEW-13 + KI-016: estimates vs blanks.
- KI-035/KI-012: persistence of cost/IPS settings and one shared plan toggle.
- KI-026: keep the in-browser monitor uploads?
- NEW-18: PMS/AIF lot method.
- NEW-20: IPS basis and zero-unlisted display.
- NEW-16: degraded-Exit behaviour.
- NEW-23: apportionment without folios.
- NEW-24: real labels and the Stock-In date.
- KI-037: hybrid tax rows.
- NEW-25: G/L definition.
- NEW-34: thresholds that scale with size.
- NEW-39: exclusions in the deck.
- NEW-46: single-distributor slides.
- NEW-47: echo vs computed.
- NEW-6: ranks for renamed hybrids.
- KI-019: keep plan/picks on a date change.
- NEW-52: email exposure and account settings.

**(c) Defer to the redesign (presentation-only or UI wiring the revamp replaces).** Carry each into the redesign's acceptance checks:
- NEW-44 (colours), NEW-45 (pie labels), NEW-46 (category order).
- NEW-35 (inflation and group rows layout).
- NEW-49 (overlap panels).
- KI-019 (picker repaint, if the decision is to keep the reset).
- KI-014 (deck order), KI-015 (empty Home deck), KI-018 (IPS 2/2 single row).

If the deck's own design is also revamped, NEW-32's estimator and NEW-33's unit formatting carry over into the new templates.