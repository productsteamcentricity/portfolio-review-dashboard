# Centricity Portfolio Review Dashboard — Complete Project History

**From the first build (May 2026) to the handover (14 Oct 2026)**

> **Sources.** The early work happened in Cowork sessions whose transcripts are not available here.
> This history is rebuilt from the project's own records:
> - the build and fix prompts kept in the project folder
> - the `.pre_<tag>` backup register: 147 change tags, dated by file time
> - the git log: 65 commits, 29 Jul to 14 Oct 2026
> - `CLAUDE.md`, the PRD (v1.0, 26 Jul), the refresh logs, and the Claude Code session titles
>
> Client names are left out on purpose.

---

## 1. At a glance

| | |
|---|---|
| **Product** | A single offline HTML file. It turns one client holdings workbook into a full HNI/UHNI portfolio review: on-screen tabs, a PowerPoint deck in the Centricity house style, and an Excel workbook |
| **Built with** | Cowork (May – 26 Jul 2026), then Claude Code (27 Jul 2026 onward) |
| **Size** | 5.1 MB (25 May) → 10.5 MB (26 Jul) → **16.8 MB** (14 Oct) |
| **Tabs** | 6 core slides (May) → 18 tabs (Jul) → **20 tabs** (Oct) |
| **Data vintage** | 31 May 2026 → 30 Jun → 31 Jul → 31 Aug → **30 Sep 2026** |
| **Deployment** | GitHub Pages from `github-repo/` (since 27 Jul 2026), commit `cab22e6` live |
| **Final state** | `index.html` 16,765,556 bytes · MD5 `173F86CAC1E5D0AC8FFD5A66042A3B4C` |

Five principles held throughout:

1. **One file, no server, no network calls.** Client data never leaves the browser.
2. **Never fabricate a number.** An unmatched holding gets a blank, a footnote and a count.
3. **Centricity house style.** Cambria font and a black/gold palette, on screen and in every export.
4. **Surgical edits only.** Every edit is backed up first, and all three copies stay byte-identical.
5. **Measure before shipping.** Every matching or data change was checked against real files.

---

## 2. Phase 1 — Original build (May 2026, Cowork)

**21 May. `Portfolio_Review_Build_Prompt.md`, the founding specification.**
- **Identity and design:** Cambria font, black/gold/tan palette, black header bar, logo top-right.
- **Input:** the client base file with its 19 columns.
- **Core slides:** Asset Allocation, AMC Allocation (20% cap), per-client Holdings, Analytics,
  Performance and Overlap.
- **Rules:** the formulas, the PPTX/XLSX export specs and the acceptance criteria.
- **Reference output:** a sample family review dated 20 May 2026, `.pptx` and `.xlsx`.

**22–25 May. First working build.**
- Chart.js, SheetJS and PptxGenJS are all embedded in the file.
- `Portfolio_Review.html.bak` (5.1 MB, 25 May) preserves this state.

**27 May. Asset-allocation design pass.**
- `Asset_Allocation_Design_Prompt.md` and the `Centricity_Asset_Allocation_Template.pptx`.
- Change tags: `alloc_design`, `directeq` (direct equity support).

**29 May – 5 Jun. Hardening.**

| Tag | Change |
|---|---|
| `features` | Feature additions |
| `leakfix` | Leak fix |
| `dividers` | Divider slides |
| `unitfix` | Units: XIRR / Allocation are fractions, money in ₹ Crore |
| `truncfix` | Text truncation fix |
| `logofix`, `logowire` | Logo fixes and wiring |
| `pdate` | Portfolio as-on date |
| `debtfix` | Debt fix |

---

## 3. Phase 2 — Analytics, overlap and IRR (June 2026)

| Date | Tags | What changed |
|---|---|---|
| 8–9 Jun | `overlapfill`, `contriblag`, `mfanalysis` | Overlap matrix fill. **MF Analysis tab** (risk ratios per fund) |
| 12 Jun | `may26refresh`, `directtoggle` | First data refresh (31 May vintage). Regular/Direct plan toggle |
| 14–16 Jun | `commodity_debt`, `debt_lookthrough`, `puredebt`, `namematch`, `holdcols`, `pmsembed`, `dedupe_dividers`, `divrevert` | **Debt look-through** (sector / rating / issuer). Name-matching rules. Configurable holdings columns. PMS data embedded |
| 17 Jun | `juneperf`, `juneoutlook` | June performance data and Market Outlook slides |
| 19 Jun | `scopetabs`, `tabdl` | **"Download just this tab as a slide"** on every tab |
| 24 Jun | `commodityperf` | Commodity MF performance bucket |
| 25 Jun | `overlapfix`, `overlapexact`, `overlapclamp`, `ovlapspec`, `irrrobust`, `irrunits`, `amcprod` | **Overlap redefined:** Σ min(wA, wB) over all holdings, no re-normalisation, ≥99.5 clamped to 100. **Fund IRR** made robust. AMC weight limited to MF products |
| 26 Jun | `fullholdingsrebuild`, `uirevamp` | Holdings rebuilt; UI revamp. `Overlap_Matrix.html` standalone tool |

---

## 4. Phase 3 — Fix cycles, Cost, CVS, IPS, SWOT (29 Jun – 10 Jul 2026)

Driven by `Portfolio_Review_Fix_Prompt.md`, then v2, v3, v3-updated and v4 (29 Jun – 3 Jul).

| Date | Tags | What changed |
|---|---|---|
| 29 Jun | `zipfix`, `dlsep`, `cvsrebuild`, `cvsstyle`, `cvsvisual`, `costcvs`, `ipsdl`, `dividerfix`, `s2fixes`, `v3` | **Current vs Sample** tab rebuilt and styled. **Portfolio Cost** tab. **IPS Profile** download |
| 30 Jun | `v3b`, `v4`, `jun30`, `erfix`, `distchart`, `directmon`, `costsrc`, `costsrc2` | Expense-ratio source order. Distributor chart. Direct MF Monitor upload. 30 Jun data |
| 3 Jul | `aif25`, `aifcat`, `ertotal`, `lastslides` | AIF cost default 2.5%. AIF categories. Cost totals. Closing slides. *(v4: blank states for Closed-Ended / Unlisted / Global equity, and category subtotals on the PPT cost slide)* |
| 7 Jul | `obsswot`, `swotv2`, `threats3y5y`, `xirrfix`, `ovtol` | **Observations + SWOT** generated automatically. XIRR fix. Overlap tolerance |
| 10 Jul | `perfdl` | Performance tab download |

---

## 5. Phase 4 — CMS, June refresh, unique stocks, PMS universe (mid–late July 2026)

| Date | Tags / files | What changed |
|---|---|---|
| 15 Jul | `cms`, `cmsgh`, `cmsout`, `junerefresh` | **`Centricity_Portfolio_CMS.html`**: a password-protected monthly refresh tool with a validation gate and change log, and an optional GitHub push. **30 Jun 2026 data refresh** (`Backend_Data_Refresh_Log_30Jun2026.txt`) |
| 16 Jul | `irrcost`, `mfbmratios`, `mfbm3y`, `obsstrong`, `julyoutlook`, `nopageno` | Benchmark rows on MF Analysis. July Outlook slides. Slide page numbers removed |
| 20 Jul | `uniqstocks`, `totalstocks`, `cvsfix`, `jul2026v2` | **"Total unique stocks"** metric (`Equity_Analytics_Unique_Stocks_Build_Prompt.md`) |
| 23 Jul | `MF_3Y_Rolling_Returns_Risk_Ratios_Build_Prompt.md` | Formulas for 3Y rolling returns and risk ratios computed from NAV |
| 24 Jul | `pmsjun26`, `pmsmatch` | **`PMS_PERF` rebuilt to the full 527-strategy vendor universe** (it had 21 before); PMS matching |
| 25–26 Jul | `rebal`, `rebal2`, `rebal3`, `rebalhold` | **Portfolio Rebalancing tab**, v1 → v3: 5 colour-coded action boxes, a picker for proposed funds, already-held detection, proposed-fund performance, editable rationale, and the 143-fund extras file |
| 26 Jul | `PRD_Centricity_Portfolio_Review_Dashboard.md` v1.0 | **As-built PRD.** It records 18 tabs and a 10.5 MB file, and corrects spec statements that no longer matched the code (overlap top-20, "always white background", three-scope model) |

---

## 6. Phase 5 — Move to Claude Code and GitHub (27–29 Jul 2026)

**27 Jul. Move to Claude Code.**
- The PRD served as the handover document, and `CLAUDE.md` was written as the operating contract.
- **Working agreement**, in the owner's words: *run my project locally > we work on it further >
  when I'm satisfied I'll tell you to push it on GitHub.*
  - The owner judges changes in Chrome, not by reading code.
  - Nothing is pushed without an explicit go-ahead.

**27 Jul. GitHub Pages connected.**
- `github-repo/` became the git root.
- Only `index.html`, `README.md`, `.gitignore` and the tools are published.
- `.gitignore` blocks client files and `.pre_*` backups.

**27 Jul. Side projects.**
- **Web app rebuild:** a Node/Express + PGlite version in `Portfolio Review Web/`. No client data is
  stored server-side, and there is no Docker. The single-file dashboard stays the live product.
- **Risk ratios computed from NAV data:** checked 100% against the vendor workbook
  (10,051 comparisons).
- **Analytics workbooks have two `Holding(%)` blocks.** The second is the prior month and must
  never be used as a fallback.

**28–29 Jul. Presentation flow** (`IMPLEMENT_Presentation_Flow_and_SlidePicker.md`):
- **slide picker** and deck order
- supplied topic slides (`topic_slide_assets/`)
- post-rebalancing slides that reuse the analytics builder
- sortable rebalancing table with Category / Product Class / Asset Class columns

First commits: `ac64a2d`, `b25b920`, `8893132`.

---

## 7. Phase 6 — July data and correctness hardening (Aug 2026)

### 13–14 Aug: 31 Jul 2026 data refresh
- **Analytics:** cash is always counted as market-cap "Others". Equity and debt analytics moved to
  31 Jul.
- **Performance and benchmarks:** performance moved to 31 Jul, and listed direct equity got its own
  bucket. Benchmark returns now come from the MF monitor.
- **Expense ratios:** moved to July. They then briefly reverted to the all-in figure; this was
  corrected properly on 6 Oct.
- **Debt fixes:** debt analytics was dropping every hybrid fund's debt sleeve, now fixed. Issuer
  parsing was hardened.
- **Other updates:** August Outlook slides. Risk ratios and 3Y rolling recomputed to 31 Jul.

### 19 Aug: MF Analysis, benchmark and overlap work
(`IMPLEMENT_Overlap_MFAnalysis_Perf_CVS.md`)
- **MF Analysis and benchmarks:**
  - Benchmark SD / Sortino / Sharpe computed on the same basis as funds; Beta and Down Capture
    shown at their definitional values.
  - Category averages had been counting missing values as zero. Fixed.
  - One 5-year age gate for both risk ratios and rolling returns.
  - Summary slide ordered by CMV.
- **PMS:** the 192 PMS strategies the deck was missing were added.
- **Overlap:** an overlap matrix for the post-rebalancing portfolio, and quick-select by Client
  and Distributor.
- **Performance sheet:** fixed group order, benchmarks grouped, layout fixes.
- **Current vs Sample:** the sample column now starts from the rebalancing plan.
- **Matcher:** a single letter no longer counts as evidence that two funds are the same.

### 20–21 Aug: PMS/AIF and matching integrity (major correctness fixes)
- **PMS:** `PMS_PERF` refreshed to 31 Jul.
- **Look-through data:**
  - `HYBRID_ANALYTICS` rebuilt.
  - **PMS/AIF look-through loaded** from the client SOA workbook (10, then 15 strategies). Its
    sector weights now sum to 100.
- **Analytics contributor lists:** each Equity/Debt card now shows which holdings fed it.
- **Analytics matching never crosses product class.** PMS/AIF holdings had been matched to
  unrelated mutual funds, injecting a stranger's stocks into the client's mix.
- **The brand anchor is never empty.** A blank AMC column used to let AIFs match across AMCs.
- **Debt YTM:** the debt block was restored, so Avg YTM and Modified Duration compute again.
- **Debt funds:**
  - AUM is now read from a column the monitor hides on debt sheets.
  - Debt funds no longer take equity benchmarks.

### 25–27 Aug: Taxation tab, Disclaimer and Thank You
- **Taxation tab:**
  - FIFO tax lots from the IRR history, split into LTCG and STCG; tax rules re-issued (25 rules).
  - Tax harvesting.
  - Family or client scope, with product / asset / grand totals, carried into the deck with
    per-holding detail.
- **Closing slides:** new Disclaimer and Thank You slides, using the supplied slides verbatim. The
  selected logo reaches every slide; Market Update slides carry no logo.
- **PMS:** `PMS_PERF` refreshed from the portal issue (721 strategies).

---

## 8. Phase 7 — AI Analyst, XIRR solver, August refresh (Sep 2026)

| Date | What changed |
|---|---|
| 1–4 Sep | **Centricity AI Analyst tab** (`IMPLEMENT_AI_Analyst_Tab.md`): **fixed rules, no LLM, no network**. Eight rebalancing rules in priority order, a trigger engine, action classification and a reallocation optimiser. Uses new `FUND_RANKS` (1,262) and `FUND_MGR` blocks. AMC cap 20% (the house figure, not the 25% in the rules document). Commit `07bc977` |
| 10 Sep | **XIRR fix.** A ₹0.001 placeholder row dated 2006 made Debt and Grand Total XIRR show **4950%**. The solver now stops on bracket width, not on a small value |
| 11 Sep | **`migration-kit/`** prepared: a plan for a private org repo, CI invariant checks, hooks, a scrub script, `CHANGELOG.md` with the 147 recovered tags, and `00_DECISIONS.md` (private repo, fresh history, no LFS) |
| 17 Sep | **31 Aug 2026 data refresh**, the first through the new **`buildtools/` pipeline** (it replaces the CMS and the lost parser tools; tested against July first). SIF Monitor embedded by default. Runtime parser fixes (TRI row preferred; SIF junk rows skipped). **One-day date fix:** every Excel date had read one day early in the IST timezone |
| 18 Sep | MF Analysis risk ratios at 31 Aug, from the vendor's risk-ratio file (`build_risk.js`) |
| 25 Sep | Ad-hoc: an Asset Class > Product Class table at distributor level from a distributor-level IRR sheet, delivered as Excel (not a dashboard change). Vendor quirks documented |
| 28 Sep | `PMS_PERF` refreshed from a workbook labelled 31 Aug that was mostly July data; the staleness was reported |

---

## 9. Phase 8 — Cost correction, September refresh, handover (Oct 2026)

| Date | What changed |
|---|---|
| 6 Oct | **The Cost tab now shows the BASE expense ratio for both plans** (it had been showing the all-in Ratio). `MF_ER_TABLE` rebuilt across issues with two vendor-row integrity tests. Typical regular-plan cost fell ~40–55 bps. Same session: rebalancing slides built for a client from the logic and base file |
| 13 Oct | **30 Sep 2026 data refresh.** Expense Ratio, SIF and stock files had moved their header rows, and the parsers now find headers by name. New `DATA_DATES.risk` caption. MF Analysis at 30 Sep. Oct Outlook slides, with slide 6 corrected. NAV data extended through Aug 2026 |
| 14 Oct | **Stock returns at 30 Sep.** The first issue had an empty 5Y column; the vendor re-issued the same filename the same day with 5Y filled. Commit **`cab22e6`**, current live build |
| 14 Oct | **Handover.** `HANDOVER_PRD_Centricity_Portfolio_Review.md` and `CONVERSATION_SUMMARY_Portfolio_Review_Dashboard.md`, so a team member can run it from their own git with Claude Code (see §11) |

---

## 10. Lessons the project learned the hard way

| Lesson | Where it came from |
|---|---|
| **Defining code in the wrong scope fails silently.** The file has four separate code scopes, and a helper placed in the wrong one is simply `undefined` | Repeated build failures; now the #1 rule |
| **Never lower the 3-token match threshold.** At 2, unrelated funds matched | "Vivriti Short Term Debt" → "Alchemy Long Term Ventures" |
| **Matching never crosses product class** | AIFs counted as a flexicap fund's stocks (Aug) |
| **Totals adding up to 100% don't prove the data is right** | The cross-class bug passed every sum check |
| **The second `Holding(%)` block is last month's data** | Prior-period holdings were published once and had to be reverted |
| **Vendor files change shape every month** | Header rows moved; schemes renamed; same filename re-issued with new data; empty 5Y column |
| **Excel dates in IST land one day early** | Every inception and transaction date in the Jul/Aug builds |
| **An XIRR solver must stop on bracket width** | The 4950% XIRR |
| **One quantity per table** | The base vs all-in expense-ratio mix-up |
| **The embedded data must equal what a runtime upload produces** | Why the pipeline runs the shipped parsers |
| **Line-ending conversion breaks the MD5** | Hence `* -text` in `.gitattributes` |
| **OneDrive and git don't mix** | The repo should live outside OneDrive |

---

## 11. Where it stands at handover (14 Oct 2026)

**Tabs (20):**
- Home · IPS Profile · Asset / Distributor / Client / AMC Allocation · Observations · Holdings
- Analytics · Overlap · Portfolio Cost · Fund IRR · Current vs Sample · MF Analysis · Taxation
- Centricity AI Analyst · Portfolio Rebalancing · Performance · Disclaimer · Thank You
- Plus 5 extra rebalancing / proposed-fund slide groups and a slide picker

**Data:**
- **At 30 Sep 2026:** MF performance (2,130 regular / 1,765 direct), SIF (30), analytics
  (1,144 equity / 243 hybrid / 486 debt), stock master (8,684) and stock returns (8,580),
  risk ratios (1,088), expense ratios (14,644)
- **Older:** fund ranks (15 Aug) · fund managers (31 Aug) · PMS (31 Jul returns) ·
  AIF (30 Jun; no source file has ever been supplied)

**Monthly refresh:** survey the new files → `build_refresh.js` → `check_blocks.js` gate → client
snapshot before → `splice_refresh.js --data-only` → snapshot after and compare → risk / stock /
PMS steps → post-checks → MD5 check of all three copies → push on command.

**Handover items:**
1. The git zip lacks `buildtools/`, `CLAUDE.md` and the PRDs. Ship them separately.
2. Fix the hard-coded paths in `tools/engine-host.js` and `buildtools/postcheck.js`.
3. Do **not** use the CMS tool. It still contains the 15 Jul dashboard.
4. Use a private company-org repo, starting from a fresh commit. Old commit messages and
   `CLAUDE.md` contain client names.
5. Run the 9-point transfer acceptance test, then do the first refresh (Oct 2026 data) together.

---

## 12. Document map

| Document | Purpose |
|---|---|
| `HANDOVER_PRD_Centricity_Portfolio_Review.md` | **Start here.** Setup, architecture, runbook, rules, acceptance test |
| `CLAUDE.md` | Operating contract: every rule and every trap, with the reasons |
| `PRD_Centricity_Portfolio_Review_Dashboard.md` | July as-built spec (tabs, formulas, design, exports) |
| `CONVERSATION_SUMMARY_Portfolio_Review_Dashboard.md` | Summary of the handover session |
| `PROJECT_HISTORY_Portfolio_Review_Dashboard.md` | This file |
| `IMPLEMENT_*.md`, `*_Build_Prompt.md`, `*_Fix_Prompt*.md` | Historical build prompts. They may be out of date where the code has since changed |
| `migration-kit/` | Private-repo migration plan, CI checks, changelog of the 147 tags |
