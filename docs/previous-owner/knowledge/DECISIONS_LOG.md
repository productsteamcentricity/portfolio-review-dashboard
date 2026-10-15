# DECISIONS LOG — Centricity Portfolio Review Dashboard (May → Oct 2026)

> **Public copy, 15 Oct 2026.** Two phrases that said where client data sits in the previous owner's files were
> shortened (the rows of 15 Jul and 11 Sep). Nothing else was changed. The complete file is kept in
> the owner's private handover archive.

## About this log

This is a chronological record of every distinct product, data and engineering decision on the dashboard. There is
one row per decision.

**Sources.** The rows are merged and de-duplicated from:
- the decision tables of the seven redacted session-group summaries:
  - Cowork, May (A1);
  - Cowork, early June (A2);
  - Cowork, late June (A3);
  - Cowork, July–Aug (A4);
  - Claude Code, 26 Jul–19 Aug (B1);
  - Claude Code, 19 Aug–11 Sep (B2);
  - Claude Code, Sep–Oct (C);
- the per-session notes behind those summaries;
- `CLAUDE.md` where it records the outcome.

**What is excluded:**
- decisions made only for the sister Centricity Proposal Playbook dashboard (22, 25 and 31 May; 18–19 Jun);
- the unrelated Excel investment-proposal workbook (4 May);
- the separate NAV live-update workbook (21 Aug);
- one-off client analyses, except where they set a rule.

**Privacy.** Client names, folios and amounts are omitted.

**Dates.** All dates are 2026. Where a summary gave only a range, the row uses the first day of the range.

**Status column:**
- *current*: still in force in the 14 Oct build (`cab22e6`);
- *superseded on <date> by …*: replaced;
- *pending*: proposed or open, never decided;
- *one-off*: applied to a single refresh or deliverable.

**"Who decided" legend:**

| Value | Meaning |
|---|---|
| **Owner** | The departing owner (the user), sometimes relaying the Products Team ("Owner / Products Team"). |
| **Claude-proposed, owner-approved** | Claude recommended it and the owner explicitly accepted it, chose it from options, or said "push it" with the choice disclosed. |
| **Claude (technical)** | Claude decided on technical grounds and reported it. The owner did not object, but did not explicitly decide either. |
| Mixed entries | Written as "Owner (rule); Claude (method)". |

---

| Date | Decision | Reason | Who decided | Alternatives rejected | Status |
|---|---|---|---|---|---|
| 20 May | Replace the embedded PMS/AIF performance entirely with the April file (21 PMS + 11 AIF) | The owner wanted the file's exact layout | Owner | Merging with the old 528-scheme set | superseded on 19 Aug by the PMS/AIF union merge (527→719 / 11→12), then by monthly PMS refreshes |
| 20 May | Fuzzy-match threshold raised from ≥2 to **≥3 shared tokens** | At ≥2 there were four false positives (e.g. a debt AIF borrowing an equity PMS's returns); all true matches scored ≥3 | Claude-proposed, owner-approved | Keeping ≥2 | current (refined 26 May, 19 Aug, 20 Aug) |
| 20 May | Ignore the Monthly Investment Reckoner as a data source | Owner preference; it has no sector/holding data | Owner | Refreshing the universe from the Reckoner | current (Reckoner fees were later requested for Cost but never supplied) |
| 20 May | Index funds and ETFs included in analytics | Holdings data exist for them | Owner | — | current |
| 20 May | "Global Funds" bucket only for foreign-market MF structures; India-mandate PMS/AIF stay put | The rule's wording targets MFs | Owner (rule); Claude (scope) | Moving PMS/AIF with "Emerging" etc. | current |
| 20 May | All quantitative display at 2 decimals (minimum-investment labels stay round) | Owner rule | Owner | — | current (re-affirmed 29 Jun; inflation label 1 dp) |
| 20 May | Central `DATA_DATES {performance, analytics}` with a "Performance as on X & Analytics as on Y" write-up everywhere | One place to edit each refresh | Owner | Hard-coded dates | current (keys later added: direct, ranks, fmgr, sif, risk) |
| 20 May | IDCW-keyed analytics aliased to Growth (G) at load time | Same portfolio, different plan name | Owner (request); Claude (design) | Manual aliases | current for analytics. Note that the opposite rule applies to ranks and manager history (1 Sep: never join across plans). |
| 21 May | **AMC cap = 20% per AMC, measured against the MF book (MF CMV)** | House rule stated by the owner; the owner chose the denominator | Owner | Whole-portfolio denominator | current (re-affirmed 1 Sep "20% all over") |
| 21 May | Deck lean: 6 core slides + Observations | Owner | Owner | Market pages | superseded on 29 May (Market Update, dividers and Thank You added) |
| 21 May | Observations carry 4 mandatory logics: allocation profile; AMC breach + impact; single-product concentration → introduce Centricity-focused PMS/AIF; own opportunities/weaknesses | Owner spec | Owner | — | superseded on 7 Jul by the "Current Portfolio + SWOT" structure |
| 21 May | One holding sheet per client, allocation re-based to that client's total | Sample deck | Owner | — | current |
| 21 May | One JS engine shared by browser and Node | Same numbers on screen, PPTX and XLSX | Claude (technical) | Separate Python/JS logic | current (ENGINE contract) |
| 21 May | Each holding routed to exactly one analytics universe by asset class | Equity exposure had exceeded total CMV (double count) | Claude (technical) | Matching against all universes | current; extended 20 Aug by the product-class partition |
| 21 May | Mcap "Others" includes fund cash/TREPS; cash excluded from stock list and overlap | Reproduces the sample deck's split | Claude (technical, measured) | Asset=Equity-only mcap | current (6 Aug: cash-like rows always forced to Others) |
| 21 May | Benchmarks from the MF Monitor index TRI rows; benchmark S.I. shown "—" | Real data only; the Index sheet has no SI | Claude (technical) | Proxy index funds | current (13 Aug: BENCH_RET refreshed from monitor index rows) |
| 21 May | Overlap visual: navy panel + gold/brown gradient (`#B98C5A`, `#F2E9DC`, `#DCC4A5`, `#C49A66`, `#A87B45`) | Owner's reference image | Owner | Playbook RGB heatmap | current (26 Jun: text colours specified) |
| 22 May | Overlap slider removes funds whose overlaps are all below the threshold | Owner | Owner | Fading or blanking cells | current (8 Jun: export filters funds, never blanks cells) |
| 22 May | Inline every JS library (no CDN) | The CDN was blocked on the corporate network, so the PPT download silently failed | Claude (technical) | CDN script tags | current; the basis of the zero-network property |
| 22 May | AMC vertical cap line removed (footnote kept); Grand Total on every client continuation slide; per-slide INSIGHT callouts | Owner | Owner | — | INSIGHT boxes superseded on 15 Jun (removed from holdings and performance slides) |
| 22 May | Hybrids always split into equity/debt by actual sleeve weights | The old build double-counted hybrids | Owner (request); Claude (fix) | Normalised sleeves | current |
| 22 May | Direct equity: in equity analytics by its own mcap/sector, excluded from performance; unknown stocks surfaced, not guessed | Never fabricate | Owner + Claude | — | performance exclusion superseded on 13 Aug (Direct Equity bucket); the rest current |
| 22 May | Optional uploads (MF Monitor, PMS SOA, Bonds) with an embedded fallback | Owner | Owner | — | current (more slots added later) |
| 25 May | Performance date = the date in the uploaded file **name**, not the in-file "As on" | Owner | Owner | In-file date | current in spirit (the refresh now passes `--date` explicitly) |
| 25 May | Synonym/abbreviation canonicalisation in `normalize`, keeping ≥3 | Better recall; 0 regressions over 1,785 names | Claude (technical) | Lowering the threshold | current |
| 25 May | SIF routed by Product column = "SIF" | Owner | Owner | — | current |
| 25 May | Transaction-based XIRR replaces CMV-weighted XIRR everywhere when an IRR file is loaded; 5 nested levels | Owner | Owner | A separate tab only | current |
| 26 May | Subset rule: shared ≥2 when the shorter name is fully contained (plus a distinctive token) | Base names like "Kotak Large Cap Growth" lack "Fund" | Owner (request); Claude (rule) | Lowering the global threshold | current |
| 26 May | Benchmark XIRR joined by client + instrument | A re-issued Bmxirr sheet labelled every row ASSET=Equity | Claude (technical) | Joining by asset/product labels | current |
| 26 May | Regular / Direct toggle on Performance (MF buckets only) | Owner | Owner | Separate Direct sections | current |
| 26 May | Base-file template download + IST "Portfolio as on" picker that overrides the filename date | Owner | Owner | — | current |
| 26 May | FoFs excluded from look-through analytics (kept in allocation, AMC, performance) | Owner rule | Owner | Resolving passive FoFs (spec B.5, left open) | current |
| 26 May | Bonds/Debt upload merges into the debt universe | Debt MFs and bonds must coexist | Claude (technical) | Replace | current |
| 26 May | Arbitrage = hybrid for analytics only | Arbitrage funds absent from the debt file had matched an income fund | Owner | Asset-tag routing | current (25 Aug: taxed as Equity MF) |
| 26 May | Raw granular rating labels kept; MF Units, REITs/InvITs, Preference Shares, Deposits kept as buckets | Match the Proposal side's `Debt Analytics.xlsx` | Owner | Canonical 9-bucket collapse | superseded on 5 Jun by the 7 credit-rating groups |
| 26 May | Spec B.6 fallback (80% AAA / 20% SOV for unknown debt) NOT implemented | Conflicts with never-fabricate | Claude (technical), flagged | Implementing it | current |
| 26 May | Embedded analytics rebuilt from source with debt side = Asset ≠ "Equity" | REITs and MF units carry Asset="Others" and were being dropped (~14% of the debt book) | Owner (files); Claude (rule) | Transplanting the Playbook JSON | current (17 Sep HYBRID `db` = all non-Equity rows) |
| 26 May | Public GitHub Pages deployment | Owner | Owner | Private repo (needs a paid plan); Claude flagged the licensed-data exposure | current, but **pending** reversal (11 Sep migration recommendation: private org repo) |
| 27 May | Allocation palette: Equity tan `#DBC8B2`, Hybrid grey `#BFBFBF`, Debt gold `#BD9568`, Commodity `#808080`; 100% stacked "% of CMV"; no red for categories | Brand rule: red only for negatives | Claude-proposed, owner-approved | The reference deck's red Debt/Hybrid | current |
| 27 May | Embed the direct-equity master into STOCK_INFO (1,917 → 7,523) | Offline and immediate | Claude (technical) | An upload slot | current (27 Jul: merge, never replace) |
| 29 May | Logo switcher (Invictus / OneDigital / Upload) on every slide; footer confidentiality line removed; Observations after AMC; Market Update + Thank You + 3 dividers; overlap as an image with % in every cell; AMC horizontal histogram | Owner | Owner | — | current, except the Market Update logo (removed 27 Aug) and the Thank You form (see 27 Aug) |
| 29 May | Insert scripts before the **last** `</body>` | The first `</body>` is inside a SheetJS string, so code leaked onto the page | Claude (technical) | — | current rule |
| 1 Jun | Explicit `ALIASES` map checked before fuzzy matching; an empty value blocks a name | Blank-AMC AIF/FoF rows snapped onto unrelated funds | Claude-proposed, owner-approved | Loosening the threshold | current |
| 1 Jun | Seed 2 pins (Mosaic Multiyield, Transition VC) and 4 blocks (ICICI Leaders IV, Nippon Eq Opp AIF 9, ICICI Enhanced Dynamic Equity, Kotak Global Innovation FoF) | Owner examples + simulated false matches | Owner (pins); Claude (blocks) | — | current (still the only 6 entries) |
| 2 Jun | Accept base files in Rupees, Lakhs or Crore; display in the file's unit; maths in Crore | "Show only the display that is written in the base file" | Owner | Showing Lakhs and Crore together | current |
| 2 Jun | Keep the "% CMV" header rather than the mock-up's "% Allocation" | Consistency across dashboard, PPT and XLSX | Claude (technical), flagged | — | current |
| 2 Jun | Logo right-anchored by true aspect ratio at x = 13.15 in; OneDigital PNG cropped | Baked-in padding made it float | Claude (technical) | Nudging x only | current |
| 4 Jun | Unlisted / pre-IPO equity = Close Ended; the base file's Liquidity column overrides all rules | Owner example | Claude-proposed, owner-approved | — | current |
| 4 Jun | Folio merge key = client + instrument + product + distributor; merged XIRR CMV-weighted | Owner spec; no cash flows in the base file | Owner (key); Claude (method) | Re-solving XIRR | current |
| 4 Jun | Invested before CMV everywhere; asset order Equity > Debt > Hybrid > Commodity > REITs/InvITs; products and instruments by CMV desc | Owner | Owner | — | current |
| 4 Jun | Fund IRR "In-Line" band = ±10% of \|BMIRR\| | Owner spec | Owner | — | superseded on 8 Jun by Contributors/Laggards |
| 5 Jun | Avg Maturity / Mod Duration / CRISIL benchmarks from the Daily MF Monitor; debt categories mapped to the nearest CRISIL index with returns | The monitor carries only generic CRISIL indices | Owner (source); Claude (mapping) | Leaving SEBI names with blank returns | current (21 Aug: a debt bucket never takes an equity benchmark) |
| 5 Jun | Credit-rating groups: SOV · AAA/A1+ · AA+ · AA & Below · Others · UNRATED · Cash & Equivalents | Owner | Owner | — | current |
| 5 Jun | Show a benchmark even when it has no TRI variant | Owner | Owner | — | current (17 Sep: the TRI row is preferred when both exist) |
| 8 Jun | Overlap export: the slider filters funds, never blanks cells | Owner images | Owner | — | current |
| 8 Jun | Fund IRR tab replaced by Top 5 Contributors / Top 5 Laggards (dashboard + PPT) | Owner ("replace") | Owner | Keeping the old view alongside | current (method changed 16 Jul) |
| 9 Jun | 3Y rolling = (EV/BV)^(1/3) − 1, end = prior available NAV, first → last window, "-" if no NAV on the start anchor | The owner confirmed after Claude flagged a formula error in the written spec | Owner | (EV/BV)/(1/3) − 1 | superseded on 14 Jul (window definition) and 27 Jul (nearest-prior NAV at both ends) |
| 9 Jun | MF Analysis picks equity MFs by base-file Asset/Product/Category; universe = all funds of that category; category benchmarks per the owner's list; benchmark ratios from file Sheet2 | Owner | Owner | A JS fuzzy category classifier | benchmark-ratio rows superseded on 16 Jul (removed) and 19 Aug (definitional Beta/DC) |
| 10 Jun | Exclude global, hybrid, debt and commodity funds from MF Analysis | Owner | Owner | — | current |
| 10 Jun | Contributors and Laggards both sorted by Fund XIRR desc, then % allocation | Owner | Owner | Laggards lowest-IRR-first | superseded on 16 Jul (contribution-based) |
| 12 Jun | Remove Nifty LargeMidcap 250 TRI from the MF Analysis benchmarks; embed the Direct monitor as a default | Owner / Claude-proposed | Owner | Keeping April ratios | current |
| 12 Jun | Back-fill STOCK_INFO from the previous build for companies missing from the new master | Avoid losing look-through | Claude (technical) | — | current |
| 14 Jun | Embedded performance relabelled per the attached files' names ("31 May 2026", though the files said 1 Jun) | "Keep them as per the files I just attached" | Owner | — | one-off |
| 14 Jun | MF Analysis shows each fund once (dedupe by name, CMV summed) | Owner | Owner | — | current |
| 14 Jun | Divider slides stay as the original images | Owner rejected a native recreation | Owner | Editable native dividers | current |
| 15 Jun | Remove the debt sector breakdown; debt analytics = Top 20 issuers + rating distribution + Avg Mod Duration + Avg YTM | Owner | Owner | — | **verify**: HANDOVER §7 lists a debt "sector" card again |
| 15 Jun | Exclude only pure commodity funds held directly; commodity inside hybrid/multi-asset stays | The owner clarified after Claude over-stripped | Owner | Stripping gold from look-through | current |
| 15 Jun | Avg YTM / Avg ModDur from pure debt MFs only | Category safeguard | Owner | — | current |
| 15 Jun | MF Analysis matcher: cap-word canonicalisation + closeness scoring (88.7% → 98.3% self-match) | A tie broke to a metric-less index sibling | Claude (technical) | Per-fund alias | current |
| 15 Jun | Absolute Return = (Gain ÷ Invested) × 100 | Claude flagged the owner's "÷100" as a slip | Owner | (Gain/Invested)/100 | current |
| 15 Jun | Remove INSIGHT boxes from PPT holdings and performance slides; the holdings column selector drives dashboard and PPT | Owner | Owner | — | current |
| 16 Jun | PMS look-through SEBI Mcap re-derived by ISIN from the AMFI half-yearly list | Accuracy (the only time-varying field) | Owner (scope); Claude (method) | Web-sourcing holdings | superseded on 20 Aug (SOA rebuilt via the shipped `parseSOA`, own SEBI Mcap) |
| 17 Jun | Monthly Outlook pagers replace the embedded `MARKET_UPDATE_IMAGES` | The dashboard already inserts them after the MARKET UPDATE divider | Claude-proposed, owner-approved | Pasting into old client decks | current |
| 19 Jun | Drop benchmark rows from PMS_PERF/AIF_PERF | Dead data; the runtime upload drops them too | Claude (technical) | — | current (19 Aug: AIF index rows excluded) |
| 19 Jun | The Family/Client scope selector re-scopes ONLY Equity & Debt look-through | Owner | Owner | Re-scoping the whole dashboard | current |
| 19 Jun | Per-tab "Download slide (PPTX)" reflects the current view | Owner | Owner | Default view | current |
| 24 Jun | Commodity (gold/silver) funds get their own "Commodity MF" performance bucket with a gold/silver benchmark | Gold was falling into Equity MF | Owner | Leaving it under Equity | current |
| 24 Jun | The monitor parser keeps every sheet (kind `other`) instead of whitelisting equity/hybrid/debt | Gold, FoF and solution sheets were silently dropped | Claude-proposed, owner-approved | — | current |
| 24 Jun | Missing gold returns come only from the MF Monitor, never fabricated | Consistency | Owner | Morningstar (different as-on); the NAV file (no gold funds) | current |
| 25 Jun | Overlap = Σmin of **actual** weights over **all** holdings; no re-normalisation, no clamp | The owner wants exact reported weights | Owner | Re-normalise to 100%; a 99.95 clamp | "no clamp" superseded on 7 Jul (≥99.5 → 100); the rest current |
| 25 Jun | IRR headers with or without "(₹)" treated as equivalent; parenthetical units stripped | Exports label amounts differently | Owner; Claude generalised | — | current |
| 25 Jun | The AMC MF-book filter tolerates singular/plural product names | "Mutual Fund" (singular) emptied the AMC tab | Claude (technical) | Exact-match map | current |
| 26 Jun | Embedded analytics and the runtime parser keep **full** holdings (top-30 cap removed; +2.3 MB) | Overlap was understated vs an independent dashboard (12.94 vs 18.37) | Owner | Keeping the cap; an upload-only fix | current |
| 26 Jun | Overlap excludes commodity funds and cash-like rows; owner-specified colours and text colours | Owner spec | Owner | — | current |
| 26 Jun | 3-column UI; a single distributor or client shows a label and hides that slide; Thank You moved to the end; Invictus logo in the header; Distributor/Client tab keeps only the Asset-Mix chart | UX revamp | Owner | — | current |
| 26 Jun | Every tab render wrapped in its own try/catch (`_renderFns`) | One broken tab used to blank the page | Claude (technical) | — | current (side effect: errors only show in the console) |
| 27 Jun | Build IPS, Portfolio Cost and Current vs Sample tabs and slides in one pass | — | Owner | One tab at a time | current |
| 27 Jun | PMS cost default 150 bps, AIF 200 bps, editable | No Monthly Investment Reckoner data | Claude (technical) | The Reckoner fixed fee (requested, never supplied) | superseded on 3 Jul (PMS 1.5%, AIF 2.5%) |
| 27 Jun | Bonds, NCD, SDI, FD, listed equity, unlisted equity and direct equity cost 0 bps | Owner spec | Owner | — | current |
| 27 Jun | Direct ER ≈ category regular TER − 60 bps | Claude's estimate of the typical spread | Claude (technical) | — | superseded on 29–30 Jun (removed) |
| 28 Jun | IPS uses the exact Excel rows and ranges; deviation "Nil" when in range; Status/Visual columns removed | Owner | Owner | Claude's invented ranges; midpoint deviation | current |
| 28 Jun | IPS has no hybrid row; hybrids split into net equity/debt/commodity/REIT via look-through | Owner rule | Owner | — | current |
| 28 Jun | Remove the Market Update tab; Home shows only "PORTFOLIO UPDATE" (black on white, no THANK YOU) | Owner | Owner | A stats strip; a black banner | current (market-update slides remain in the deck) |
| 29 Jun | MF expense ratio from the owner's Expense Ratio Excel: base ER first, then total ER, regular and direct | The monitor-derived ER was wrong | Owner | Category TER estimates as primary | superseded on 30 Jun 16:00 (final rule), then 13 Aug, then 6 Oct |
| 29 Jun | "Fund of Fund(s)" normalised to "FoF" for matching | Name mismatch | Owner | — | current |
| 29 Jun | IPS tab keeps a profile selector (compare against one profile) | — | Owner | A 5-profile Excel replica | current |
| 29 Jun | No ZIP download; each tab has its own single-slide download, plus the full deck | — | Owner | Claude's ZIP of all sections | current |
| 29 Jun | PPT order: IPS before Asset Allocation; Cost and CVS after Overlap; all values to 2 dp | — | Owner | — | superseded on 29 Jul by the 5-section presentation flow |
| 29 Jun | PPT slides read the dashboard's computed data (`getIPSData`, `__COST_DATA`, `_cvsSnapshot`) | The PPT must match the screen | Claude-proposed, owner-approved | Re-deriving inside the exporter | current (pattern reused: `__REBAL_DATA`, `rbHoldSheetRows`) |
| 29 Jun | Workflow: one chat writes a versioned fix prompt (.md), another applies it; each prompt restates what is done | — | Owner | — | superseded on 26 Jul (single Claude Code session, run locally) |
| 30 Jun | The unlisted-equity denominator includes **all** AIF holdings; a Real Estate row is added | The owner's IPS calculation guide | Owner | Claude's PE/VC-only rule (excluded debt AIFs) | current (debt-AIF guard offered, undecided) |
| 30 Jun | The CVS current column snaps its rounding residual so it totals exactly 100% | 99.90% was displayed | Owner (request); Claude (method) | — | current |
| 30 Jun | Missing rating buckets show 0% when debt analytics exist; IPS portfolio cost follows the Cost tab's Regular/Direct toggle | Owner | Owner | — | current |
| 30 Jun | SGB expense ratio always 0%; stored overrides above 300 bps treated as a legacy ×100 error | The owner saw 3300 bps instead of 33 | Owner (SGB); Claude (sanitiser) | — | current |
| 30 Jun 15:29 | Direct ER only from an uploaded Direct MF Monitor | — | Owner | — | superseded on 30 Jun 16:00 |
| 30 Jun 16:00 | `MF_ER_TABLE` (from the Expense Ratio Excel) is primary for both plans; monitors and category defaults only as fallbacks; Growth↔IDCW sibling fallback | "Always take data from the Expense Ratio file" | Owner | The uploaded monitor winning | current (precedence inside the table changed 13 Aug and 6 Oct) |
| 3 Jul | Edit `Portfolio_Review.html` only via scripted read/replace/write with count==1 asserts; sync all copies after every change; no git push by Claude | Edit/Write truncated the file tail; the copies must stay identical | Owner (v4 prompt) | Editing one copy | current (CLAUDE.md rules 1, 7; pushes on command since 26 Jul) |
| 3 Jul | IPS actuals show 0.00% (not "--") for none-held Closed Ended / Direct Unlisted / Unlisted-through-Funds | Distinguish "none held" from "no data" | Owner | — | current |
| 3 Jul | Cost PPT grouped by source (MF/SIF/PMS/AIF/Other) with subtotals | Match the Cost tab | Owner | Flat list | current |
| 3 Jul | Replace the single Thank-You image with coded Disclaimer + Thank You slides and tabs | Live Cambria text, brand logo | Owner (ask); Claude (native) | Full-slide images | superseded on 29 Jul (supplied slides as images) |
| 3 Jul | Cost subtotal/total ER = arithmetic SUM of the group ERs | The owner wanted it to "total like CMV and weight" | Owner | Weighted-average ER | current [verify still wanted] |
| 3 Jul | Default ER with no data: PMS 1.5%, **AIF 2.5%**; AIF detected by category/name `/\baif\b/` | AIFs arrive with perfSrc null and unlisted ones were forced to 0 | Owner (rates); Claude (detection) | Reclassifying AIF upstream | current |
| 7 Jul | Observations = "1. Current Portfolio (asset/product/AMC/liquidity) + 2. SWOT" from the owner's pointer catalogue; every bullet conditional on data | Owner format; avoid drift with other tabs | Owner (format); Claude (scoping) | Fixed boilerplate | current (enriched 16 Jul) |
| 7 Jul | Performance tab and PPT drop no-data instruments (`filterPerfBuckets`); XLSX stays unfiltered | Owner scope | Owner | Filtering the XLSX too | current |
| 7 Jul | Overlap clamp: ov ≥ 99.5 → 100 | Identical index funds showed 99.76% from factsheet rounding | Owner (reversing 25 Jun for this case) | Keeping exact | current |
| 7 Jul | Fix base-file XIRR/BMXIRR scaling at source (`gnPct` ÷100 in `parseBaseRows`) | July files held plain percent (19.04), shown as "3171%" | Claude (technical), flagged | — | **current in code; conflicts with the docs' "fractions" rule** (see KNOWLEDGE_DUMP §6.3) |
| 7 Jul | Threats = Performance-Sheet laggards per 1Y/3Y/5Y + Fund XIRR laggards; PPT SWOT uncapped (font/spacing scale down) | The owner wanted 3Y/5Y; the PPT had silently capped at 5 | Owner | Keeping the 5-bullet cap | current |
| 14 Jul | 3Y rolling = mean of daily-rolled (End/Begin)^(1/3) − 1 over a 2-year begin window, "-" if no NAV at the start, nearest-prior NAV | Owner formula | Owner | — | current (generalised as −5Y to −3Y; both ends nearest-prior, 27 Jul) |
| 14 Jul | Risk benchmark map: Large → Nifty 100 TRI, Mid → Midcap 150, Small → Smallcap 250, everything else → Nifty 500 | Every fund gets a benchmark | Owner | Sectoral indices / no benchmark for thematic | current |
| 14 Jul | Split/face-value ETFs computed as-is but flagged | Never fabricate or adjust | Claude (technical) | Split-adjusting (offered) | current (nulling still pending, see 18 Sep) |
| 14 Jul | MF API full-universe pull delivered as wide Excel (dates × schemes) | Owner wanted Excel | Owner | Parquet/CSV | one-off (never finished; MFAPI later dropped) |
| 15 Jul | Write the as-built PRD in Word | — | Owner | PDF/Markdown | superseded on 26 Jul / 14 Oct by markdown PRD + HANDOVER_PRD (the .docx is not shared) |
| 15 Jul | First CMS = hidden password-gated panel inside the dashboard (5 clicks / Ctrl+Alt+Shift+M) with "Push live to GitHub" | The owner wanted a non-evident monthly tool and live updates | Owner | Performance-only scope | superseded on 15 Jul (same day) by the standalone CMS |
| 15 Jul | Standalone `Centricity_Portfolio_CMS.html`: embeds the dashboard and self-updates; PPTX upload with image fallback; hidden panel removed | Keep admin tooling out of the client-facing file | Owner (chose among 3 options) | Fetching the base from GitHub; PPT-only | superseded on 17 Sep by `buildtools/`; the CMS is now obsolete and a credential risk |
| 15 Jul | Fund-manager file skipped; June pager embedded as provided; PMS/AIF not refreshed | No FM display existed; owner choice; no file | Owner | — | one-off |
| 15 Jul | Name-matching concept not to be changed for the "MF not showing" report | Owner instruction | Owner | Cost-by-product-class fallback (offered) | current |
| 16 Jul | June refresh run headlessly with CMS logic; prefer the Base ER; accept MF_PERF +289 as real | Parity with the runtime upload | Claude-proposed, owner-approved | Using the CMS UI | one-off |
| 16 Jul | Listed Direct Equity: use the corrected re-issue; accept the label only if monotonic vs market cap, else rank-derive (100/150/rest) | The first file had a scrambled Mcap Allocation | Owner (file); Claude (rule) | Excluding the STOCK_INFO update | current |
| 16 Jul | Enrich SWOT in place (debt YTM/duration/quality, AMC redeployment, top-3 sectors/top-10 stocks, low-yield debt, named missing classes) | Match the quality of the best hand-made deck | Owner ("keep structure") | Narrative restructure | current |
| 16 Jul | MF Analysis: remove benchmark ratio rows; keep only the benchmark 3Y rolling row | Owner | Owner | — | superseded on 19 Aug (definitional Beta 1 / DC 100 row) |
| 16 Jul | Remove slide numbers from the PPT | Owner | Owner | — | current |
| 16 Jul | Fund IRR contributors/laggards by contribution = % alloc × Fund XIRR; laggards = lowest; drop Benchmark and Deviation columns | Owner | Owner | Bottom-5 with benchmark kept | current |
| 16 Jul | Cost tab distributor filter re-bases KPIs and slide; IPS cost stays portfolio-wide (`__PORT_COST_FULL`) | Owner | Owner + Claude | — | current |
| 20 Jul | Unique-stocks KPI includes Direct Equity, and PMS when look-through exists; an always-on footnote; also "Total Number of Stocks" | Owner | Owner | Excluding direct equity (spec) | current |
| 20 Jul | CVS CMV seeds from `model.totalCMV` (override only per base-file signature); buckets by asset + product, not instrument name | Bugs: stale localStorage; "Bond" in MF names | Claude (per owner's prompt) | — | current |
| 20 Jul | Outlook slide text made consistent with its charts only from the deck itself; the owner said typed sector labels are right | No external data guessing | Owner / Claude | Supplying figures from memory | current principle ("ship as supplied, flag") |
| 20 Jul | Embed the re-issued 5-slide July pager (the original, not the Claude-corrected copy) | "Just replace" | Owner | Embedding the edited copy | one-off |
| 22 Jul | Proposed: drop zero-amount IRR rows; relax the AMC guard by holding-name brand token (PPFAS) | 4950% debt XIRR; AMC abbreviation | Claude (proposal, never confirmed) | — | XIRR part superseded on 10 Sep (solver fix); PPFAS part **pending** |
| 26 Jul | Run locally → iterate → push to GitHub only on explicit command, after showing what goes out | Non-technical owner wants control of the live link | Owner | Auto-push; scheduled pushes | current |
| 26 Jul | Only `github-repo/` is a git repo; the project folder stays untracked | It holds client workbooks, backups and vendor data | Claude (technical) | Whole folder as a repo | current |
| 26 Jul | Add `*.pre_*` and `.~lock.*` to `.gitignore` | 19 backups (172.9 MB) were about to be committed | Claude (technical) | — | current |
| 26 Jul | Download and read the codebase-memory-mcp installer before running it | Never pipe internet scripts to bash on a machine with client data | Claude (technical) | `curl \| bash` | current principle |
| 26 Jul | Web-app backend in Node (Express), not Python | Reuse the JS engine; no numeric drift | Claude-proposed, owner-approved | Python rewrite | current for `<WEB>` (whose future is pending) |
| 26 Jul | Client holdings never stored server-side | Keep the zero-network compliance property | Owner | Server-side storage | current |
| 26 Jul | No login for the web app for now; run locally | Single analyst | Owner | Auth now | pending (11 Sep: backend found insecure) |
| 27 Jul | PGlite (Postgres in WASM) instead of Docker | Owner refused Docker | Owner + Claude | Docker Postgres | current for `<WEB>` |
| 27 Jul | The single-file dashboard stays the live product; the web app develops alongside | Pages cannot run Node/DB; the web app lacks auth and hosting | Claude (technical) | Switching to the web app | current |
| 27 Jul | No monthly reminder; the owner sends the files | Owner preference | Owner | Reminder on the 15th | current |
| 27 Jul | Compute 3Y rolling + risk ratios from NAV monthly, in Node | Owner instruction; no Python | Owner (task); Claude (Node) | Vendor file; Python | superseded on 17–18 Sep (C#/PowerShell navwork toolchain → `build_risk.js`) |
| 27 Jul | One benchmark per fund for beta, corr, alpha, Treynor, IR and TE | "Keep the benchmark for beta and correlation same" | Owner | Legacy mixed benchmarks | current |
| 27 Jul | AIF data from the Excel, not transcribed from a slide image | Transcription risk | Owner (Claude asked) | Transcribing the image | current |
| 27 Jul | Keep every fund and benchmark row; missing = `null` ("-"); index rows tagged `bm:true` | "Don't drop funds or benchmark"; a literal "-" breaks maths | Owner + Claude | Dropping index rows; a blank-AUM filter | current |
| 27 Jul | STOCK_INFO merges, never replaces | The monthly master lacks delisted/unlisted names held by funds | Claude (technical) | Replacing (would lose ~3,258) | current |
| 27 Jul | Direct-monitor unnamed sheets: Sheet43 = Global (equity); Sheet 44 + Others = Solution/ETF/FoF; Sheet 45 = Gold & Silver | The owner and the Products team named them | Owner | Claude's heuristic | current (17 Sep: mapped via Reg sibling / sheet majority in buildtools) |
| 27 Jul | Never fall back to the second (prior-month) `Holding(%)` block | Block 2 is the prior month; those rows are `Out` | Owner (implementation prompt) | Per-scheme fallback (briefly shipped in the web app) | current |
| 27 Jul | Web app loads reference data synchronously, all blocks eager | The app deep-copies REFDATA at load | Claude (technical) | Lazy lookup | current |
| 27 Jul | Rebalancing Holding Sheet: Proposed Amount negative for money out; every holding, all clients | The sheet must reconcile to zero deviation | Owner | Positive-only; actioned rows only | current |
| 27 Jul | Rebalancing row tints: Exit `#FCE8E8`, Partial `#FFF8E1`, Top-Up `#FDE7EF`, New `#E6F4E6` | Readable behind numbers | Claude (owner asked for the colour families) | Solid action-box colours | current |
| 28 Jul | Holding sheet screen + slide share one data function (`rbHoldSheetRows`) | Prevent deck/screen drift | Claude (technical) | Two implementations | current |
| 29 Jul | Topic dividers, Disclaimer and Thank You embedded as PowerPoint-exported images | "Use the slides I gave you exactly like an image" | Owner | Native shapes | current (briefly reversed 25 Aug, restored 27 Aug) |
| 29 Jul | `ALWAYS()` slides on for the full deck and picker selection, off for single-slide download | A single-slide button shouldn't return 4 slides | Claude (technical; offered one-line change) | Always include | current |
| 29 Jul | 5-section presentation flow (Market / Portfolio Update / Holdings & Analytics / Rebalancing Opportunities / Annexure); tabs and right nav in deck order; nothing ticked = full deck | Owner | Owner | — | current |
| 29 Jul | Sorting reorders `REBAL_ROWS` in place; Actionables sort in box order | Rows carry `data-i` indexes | Claude (technical) | Sorting a copy; alphabetical | current |
| 29 Jul | Proposed-fund category/product/asset via a guarded matcher (`matchInstrument` + `ppGuard`) | Agree with Proposed Funds Performance | Claude (technical) | Exact-key lookup only | current |
| 29 Jul | `THANKYOU_IMAGE` (unused, 158 KB) left in place | Deletion is the owner's call | Claude (technical) | Deleting it | pending |
| 6 Aug | Cash-like rows always counted to mcap "Others" | Prevent a mislabelled cash row inflating a band | Claude (owner asked Others = Others + Cash) | — | current |
| 6 Aug | Do not merge name-suffix variants of the same PMS portfolio in SOA uploads | Needs owner judgement | Claude (pending owner) | Auto-merge | pending |
| 13 Aug | Analytics footnote 31 Jul while performance stays 30 Jun | Only analytics supplied at that point | Owner | Holding until both arrive | one-off; mixed vintages are allowed generally |
| 13 Aug | Splice blocks into the single file by brace-matched value replacement, reading every block back | The web DB load does not reach the live site | Claude (technical) | Re-serialising the 7 MB embed | current (`splice_refresh.js`) |
| 13 Aug | New "Direct Equity" performance bucket (3M–5Y), no benchmark row | The vendor now supplies stock returns | Claude (owner asked for the update) | Keep excluding; a broad index as benchmark | current |
| 13 Aug | BENCH_RET refreshed from the MF Monitor's index rows | Benchmarks were still June | Owner | A dedicated benchmark file | current |
| 13 Aug | Keep the benchmark universe at 106; the label follows the row used | Changing benchmarks is a methodology call | Claude (technical) | Adding/removing indices | current (108 since Aug) |
| 13 Aug | Expense ratio: base-first, then the owner chose "original logic" = all-in Ratio first, Base fallback | Continuity with earlier reviews; Claude had measured stored values = Base | Owner | Base-first | superseded on 6 Oct (base ER, both plans) |
| 13 Aug | Hybrid debt-sleeve weight derived as `100 − eq.weight` in the engine | Sleeves partition the fund; `db.weight` absent | Claude (technical) | Raw row-sum `db.weight` (>100% for 34 funds) | superseded on 20 Aug (`db.weight` populated; engine uses it when db + eq ≤ 105) |
| 13 Aug | Embed market-update JPEGs as PowerPoint exported them | Re-encoding at q85 saved only 16% | Claude (technical) | Re-compressing | current |
| 13 Aug | No alias table for misspelt SDL states | Not asked | Claude (technical) | Building one | current |
| 14 Aug | Extend the NAV workbook by AMFI code via MFAPI | Exact keying; name matching produced cross-house errors | Claude (technical) | Name/fuzzy matching | MFAPI superseded on 17 Sep (AMFI NAV history report); AMFI-code keying current |
| 14 Aug | Funds absent from MFAPI (12 SIF long-shorts) left blank | Carry-forward would flatten volatility | Claude (technical) | Carrying the last NAV | current |
| 19 Aug | Benchmark SD/Sharpe/Sortino from raw NSE TRI files on the fund basis | The NAV workbook's benchmark sheet is calendar-day carry-forward | Claude (spec from owner) | Workbook sheet; legacy values | current |
| 19 Aug | Benchmark row: Beta 1.00 and Down Capture 100.00% with a footnote; Alpha/Corr/IR dashed; r3y refreshed | Definitional values, labelled | Owner | Dashing all five | current |
| 19 Aug | Ship §4B (null-as-zero category averages fix) first | Live decks materially wrong | Owner | Spec order | current |
| 19 Aug | PMS_PERF/AIF_PERF union merge (527→719, 11→12), AIF index rows excluded | The DB copy was richer (132 strategies with returns) | Claude (technical) | Keeping the deck's smaller block | current |
| 19 Aug | Single-letter tokens no longer count toward `shared ≥ 3`; an exact normalised name wins outright | An AIF matched another on `opp`/`fund`/`i`; measured: 53 false negatives fixed, 0 regressions | Claude (technical) | Changing the blanket threshold | current |
| 19 Aug | "Reset to Actual" and "Re-seed" stay independent | Different sources per column | Claude (recommended; owner asked, never answered) | One button restoring both | pending |
| 19 Aug | Performance table: nothing wraps except the scheme name | Column count varies by bucket | Claude (technical) | `<colgroup>`; `table-layout:fixed` | current |
| 19 Aug | Remove the Universe Avg / Benchmark qualifier text from screen AND deck | Owner instruction (repeated) | Owner | Moving it to a footnote (reverted) | current |
| 19 Aug | Hard-coded "May 2026" vintage strings derived from `dataDates.performance` | Prose went stale each refresh | Claude (technical) | Hand-editing monthly | superseded on 13 Oct (MF Analysis sites now use `dataDates.risk`) |
| 19 Aug | Post-rebalancing overlap; client/distributor overlap selectors; MF Analysis 5-year gate; CVS auto-seed; new Performance group order | Products-team change request (6 items) | Owner / Products Team | Changing `benchmarkFor()` globally | current |
| 20 Aug | PMS_PERF refresh: replace per scheme; carry forward mcap/category/inception; keep vendor-dropped strategies at prior vintage | The file has no mcap/category/inception; 0 return cells lost | Claude (technical) | Wholesale replace; deleting dropped strategies | current |
| 20 Aug | Match PMS names on a normalised key, keep the existing display name | Vendor spelling drifts monthly | Claude (technical) | Raw-string match (forks records) | current (hardened 27 Aug) |
| 20 Aug | Do not touch the web app's Postgres copy unasked | Separate surface | Claude (technical) | — | current |
| 20 Aug | Run the shipped `parseSOA` (lifted verbatim, FNV-1a hash-checked vs browser) for embedded SOA data; sector divisor = non-cash total | Avoid parser drift; blocks summed 73–98% | Claude (technical) | Reimplementing the parser | current |
| 20 Aug | Contributor "fund box" as a `<details>` table, screen only | A `<select>` can't show columns or totals | Claude (offered to switch) | Native select; PPTX slide | current |
| 20 Aug | **Product class is a hard boundary**; no cross-class fallback; PMS/AIF without look-through excluded and listed | "DO NOT EVER CHANGE THE PRODUCT CLASS" | Owner | Nearest-fund fallback | current |
| 20 Aug | The `shared ≥ 3` branch also needs `distinct ≥ 2` | Measured: 173 drops all wrong; performance direction unchanged | Claude (technical) | Raising the blanket threshold | current |
| 20 Aug | Blank AMC → the scheme name's first token is the brand anchor | An AIF matched an unrelated fund on india/equity/fund | Claude (technical, after owner's bug report) | — | current |
| 20 Aug | Do NOT fix same-AMC generic-token matches now | Needs idf-style weighting + measurement | Claude (offered as separate work) | A hand-written stop-list (explicitly rejected) | pending |
| 20 Aug | Restore the MF_PERF `debt` block, attached only when ≥1 value present; fix web `parse-performance.js` | An all-null block would inflate "N funds" | Claude (technical) | — | current (`check_blocks.js` enforces it) |
| 21 Aug | AUM column resolved by searching upward from the header (`colIndexAbove`) | Debt sheets put `AUM (Cr.)` three rows up | Claude (owner asked "fix the AUM") | — | current |
| 21 Aug | A Debt bucket resolves only inside the debt benchmark rules (CRISIL Composite catch-all); benchmark YTM/AvgMat/ModDur left blank | The monitor publishes them empty | Claude (technical) | Inventing values | current |
| 25 Aug | Taxation via FIFO over the IRR history; unreconciled positions listed, never back-filled | No fabricated acquisition dates on tax numbers | Claude (technical) | Synthetic lots for missing bonuses | current |
| 25 Aug | Arbitrage funds taxed as Equity MF (category before asset) | Asset=Debt only for analytics routing | Claude (technical) | Sec. 50AA treatment | current |
| 25 Aug | PMS / unlisted AIF FIFO in rupees, reconciled to invested value | No prices/units in the IRR sheet | Claude (technical) | — | current |
| 25 Aug | Word rates ("Slab rate", "Fund-level") printed as words | They depend on the assessee | Claude (technical) | Guessing a rate | current |
| 25 Aug | LTCG/STCG restated as Gain/Loss, apportioned so they add to the base-file G/L exactly | The owner asked that they add up | Owner (ask); Claude (design) | Recomputing G/L | current |
| 25 Aug | Tax rules embedded as `REFDATA.TAX_RULES`; the re-issued 25-rule file adopted with Cat III routing | Owner supplied the rules | Owner | An upload slot for rules (not built) | current |
| 25 Aug | Disclaimer/Thank You rebuilt natively; logo on all slides; `TY_LOGO` deleted | The logo was baked into the images | Claude / owner | — | superseded on 27 Aug |
| 27 Aug | Disclaimer/Thank You = the owner's slides verbatim as PowerPoint-exported images; picker logo on Disclaimer only | "Don't change anything" | Owner | Native rebuild | current |
| 27 Aug | No logo on Market Update slides | Owner | Owner | — | current |
| 27 Aug | Tax harvesting: STCL vs both heads, LTCL vs LTCG only; ₹1.25 lakh exemption and cess/surcharge excluded and footnoted verbatim | Owner instruction | Owner (rules); Claude (logic) | Modelling the exemption | current |
| 27 Aug | Taxation tab under Rebalancing Opportunities, after MF Analysis; exported to the deck | Owner | Owner | Annexure | current |
| 27 Aug | Taxation family/client scope via one `summarise()`; the deck exports the on-screen scope | Client totals must add to the family | Claude (technical) | A second code path | current |
| 27 Aug | Pagination from usable band ÷ worst-case row height (0.42"), never a hand constant; units not totalled | PptxGenJS `rowH` is a minimum; summing units is meaningless | Claude (technical) | A calibrated constant | current (Taxation only; other slides keep calibrated constants) |
| 27 Aug | Visual verification via headless render + PowerPoint COM PNG export | The browser pane blocks downloads and screenshots | Claude (technical) | Numeric-only checks | current |
| 1 Sep | AI Analyst computes deterministically; a template layer narrates; no LLM or network in the dashboard | Zero-network is a compliance property | Claude-proposed, owner-approved | An LLM call (a clipboard hand-off is the only compliant future shape) | current |
| 1 Sep | **AI Analyst signal weights 22/18/15/13/10/10/7/5** (`AIA_WEIGHTS`) | Claude's numeric reading of the Rules doc's priority order | Claude (technical): "my proposal, not a derived truth" | — | **pending Products Team sign-off (never recorded)** |
| 1 Sep | **AMC cap 20% everywhere, including the AI Analyst** (`AIA_AMC_CAP = 20`); the Rules doc's 25% recorded as deliberately unused | After three reversals: "Keep it 20% all over the dashboard and new tabs also" | Owner / Products Team | 25% for this tab; a 20–25% amber band | current |
| 1 Sep | Unscored funds = `na`, removed from numerator and denominator | ~77% of the MF universe has no score | Claude (technical) | Treating unscored as bad | current |
| 1 Sep | Only the five fault signals can trigger Exit; ≥2 faults, composite < 50, funded destination | The first draft exited 9/25 circularly | Claude (technical) | `impact`/`weight`/`tax` voting on exits | current |
| 1 Sep | Exit load and minimum investment shown as absent (footnote); min-investment constraint coded but inactive | No data source in the build | Claude (technical) | Substituting ER; assuming 1% < 1 yr | current |
| 1 Sep | Block fuzzy joins that change plan (IDCW↔Growth); alias tables live in build tools, not `index.html` | A borrowed rank is wrong | Claude (technical) | `ALIASES` entries in the engine | current |
| 1 Sep | Ranks joined by name, Direct plans resolved via their Regular name | REFDATA has no AMFI codes/ISINs; the ranks file is Regular-only | Claude (technical) | Lowering the threshold | current |
| 1 Sep | `1-3yr Warning` status scores amber, never red alone | The spec was wrong that Status was blank | Claude (technical) | Ignoring Status | current |
| 2 Sep | Regular + Direct merged by `perfKey`; XIRR/BMXIRR CMV-weighted and labelled approximate | Owner (`Changes.docx`) | Owner (ask); Claude (method) | True combined-cashflow XIRR (no data) | current |
| 2 Sep | Retained funds excluded from tab/deck, kept in the XLSX audit sheet | Owner; audit trail | Owner / Claude | — | current |
| 2 Sep | Caps enforced as properties of the output (floor takes, exact headroom, 2% floor, final AMC clamp); money left "unplaced" rather than breach a cap | A 300-portfolio property test found breaches | Claude (technical) | Rounding | current |
| 2 Sep | Mixed ordering (composite vs score) NOT changed | Would move recommendations; needs the Products Team | Claude (technical), flagged | — | pending |
| 3 Sep | A priceless Switch-In falls back to the rupee ledger (only when that is the cause) | IRR switch rows have no price | Claude (owner asked "read the first SWITCH IN as a PURCHASE") | Blanket fallback; inventing a price | current |
| 4 Sep | An uploaded SOA always wins over the embedded look-through (uploaded pool tried first) | Owner | Owner | Overwrite-by-key only | current |
| 4 Sep | AI Analyst guideline/audit items put on hold | Owner | Owner | — | pending |
| 10 Sep | Fix XIRR in the solver (bracket width < 1e-12, sign compare), not by filtering tiny flows | A magnitude filter would drop real flows | Claude (technical); owner "commit and push" | Dedupe/filter in the parser | current |
| 10 Sep | Don't alter client IRR data (duplicate folio, placeholders) | Source-data issue for the file's preparer | Claude (technical) | Dedupe | current |
| 11 Sep | Backend: no server; "ingestion-first (Vintage)"; delete scheme-lookup capability rather than env-flag it | A compliance boundary must not be a runtime flag | 26-agent workflow; Claude relayed (1 of 3 adversaries dissented) | Full platform; private appliance; reference-only subset | pending (recommendation only) |
| 11 Sep | Migration: private org repo, monorepo, fresh history, no public Pages, no LFS | Privacy of the old repository's history; shallow history; Pages-on-private is public on Free/Team | Claude (recommendation) | Keeping history; public Pages; LFS | pending (owner has not decided) |
| 17 Sep | New `buildtools/` pipeline running the shipped parsers; prove it on July before August | The old tools were thought lost (they were in `<WEB>\tools`) | Claude (technical) | Rebuilding lost tools from memory | current |
| 17 Sep | SIF Monitor becomes an embedded default with upload override and × restore (Direct MF Monitor row same fix) | Owner request | Owner | — | current |
| 17 Sep | AUM from the `AUM (Cr.)` label searched upward; Direct unnamed sheets mapped via Reg sibling / sheet majority; carry-forward only for schemes still in the monitor (`vintage` tag) | Measured against July | Claude (technical) | Runtime fallbacks; carrying all dropped keys | current |
| 17 Sep | FUND_MGR: exact/normalised names only; `cur` = stint To equals that scheme's latest To | The old tool's fuzzy matches were wrong; its file-max rule left 1,618 schemes managerless | Claude (technical) | `tools/parse-fund-mgr.js` rules | current |
| 17 Sep | Exit Load file not consumed | The dashboard never held exit load | Claude (technical; offered to wire in) | — | current |
| 17 Sep | One-day date fix in code (shift Date 12 h to noon), then rebuild the performance blocks | SheetJS cellDates + the IST 1899 offset | Claude-proposed, owner-approved ("PUSH IT") | Shifting stored data | current |
| 17 Sep | NAV extension sources: AMFI NAV history for MFs; owner-downloaded Nifty TRI files for benchmarks | Index files cover only benchmarks; AMFI reconciled 6,455/6,455 | Claude (technical) | Single-fund download; NSE price-only archives | current |
| 18 Sep | Sortino on the textbook definition (below daily rf, ÷N), not bug-compatible with June | June's column was unreproducible; all other metrics reproduce 1088/1088 | Claude (technical; offered revert) | Matching June | current |
| 18 Sep | Risk/NAV outputs placed in the Portfolio Review folder | "This is for Portfolio Review Dashboard" | Owner | Monthly folder only | current |
| 18 Sep | Split threshold 0.5 on the minimum single-day NAV ratio | Clean gap (flagged ≤0.20, unflagged ≥0.84) | Claude (technical) | 0.15–0.20 (missed 2 of 36) | current |
| 18 Sep | MF_RISK shipped including the 29 split-NAV ETFs as computed | Nulling suppresses figures; do it only on instruction | Claude (technical); owner never decided | Nulling beta/alpha/corr/ir (one-line change) | pending owner decision (28 ETFs at Sep) |
| 25 Sep | Distributor IRR: "as given" and corrected figures side by side | The errors are in the source sheet | Claude (technical); owner to choose | Silent correction | pending |
| 25 Sep | Ad-hoc client analyses use the shipped engine and extracted `xirr`, with a control reconciliation to the dashboard | Figures must match the Fund IRR tab | Claude (technical) | A separate solver | current practice |
| 28 Sep | Apply the mostly-stale PMS file but report STALENESS | The only source; make the staleness visible | Claude (technical); owner "push it" | Rejecting the file | one-off; the STALENESS report is current |
| 6 Oct | **Base expense ratio for both plans**; replay the whole overlay July→Aug; drop defective rows (Test A rotated row; Test B direct > regular) | "Use the base expense ratio for both direct and regular"; one quantity in one table | Owner (base); Claude (method) | Aug-only pass; all-in fallback; interpolation | current |
| 6 Oct | Client rebalancing slides: keep duplicate ARN rows "as in file"; new regime top slab; slides 1–5 now, 6–7 after the buy list | Owner answers | Owner | Dedupe (Claude's recommendation) | one-off, pending slides 6–7 |
| 6 Oct | Ad-hoc overlap exit rule: the remaining fund ≥ 0.60% of portfolio; theme funds cannot trigger it; index funds not tested against each other; ₹3 Cr gain per tranche, 42 days apart | Avoid absurd exits; fit five tranches | Claude (technical, flagged for confirmation) | Literal reading of Logic.txt | one-off |
| 13 Oct | `DATA_DATES.risk` separate from the performance date; six caption/age-gate sites patched | No risk file arrived with the monitors, which would have given a wrong caption | Claude (technical; CLAUDE.md already instructed it) | Captioning with the performance date | current |
| 13 Oct | SIF look-through not carried forward | SIF rows have no product class, so they become only false-positive MF candidates | Claude (technical) | Carrying 14 SIF entries | current |
| 13 Oct | Ship Outlook slide 6 ("August 2026") as supplied and flag it | Source content is not Claude's to edit | Claude (technical); owner re-issued the deck | Editing the slide | one-off (corrected deck embedded the same day) |
| 13 Oct | `survey_month.js` diff against the previous month before every build | Header/column drift in 3 files in one month | Claude (technical) | — | current |
| 14 Oct | First stock-returns issue shipped with 5Y null; then undo via backup and apply the same-name re-issue | One date per row; owner instruction | Claude, then Owner | Mixing Aug 5Y with Sep 3M–3Y | current (`cab22e6`) |
| 14 Oct | Handover docs exclude client names; history reconstructed from records and labelled as such | Files will be passed on | Claude / Owner | Inventing narrative | current |
| 15 Oct | Export: inventory before copying; client data inventoried by category/count only until the owner confirms; no secrets | Owner's export rules | Owner | — | current |
| throughout (26 Jul →) | Commit/push only on the owner's explicit command ("push" / "PUSH IT") | Working agreement | Owner | — | current |
