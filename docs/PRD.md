# Centricity Portfolio Review: product requirements (living PRD)

| | |
|---|---|
| Document | `docs/PRD.md` (draft 0.4, from Phase 0, 21 Oct 2026, revised twice on 22 Oct 2026 and on 22 Oct 2026) |
| Status | The living PRD from M1.1; draft 0.4 applies the owner's answers of 22 Oct 2026 (D-024 to D-033) |
| Product | The new Portfolio Review application (`app/`, served at `/next/` until parity, then `/`) |
| Legacy reference | `index.html` as of commit `782794f` (unchanged on `main` at `8cb320d`; served at `/` until parity) |
| Companion documents | `docs/ARCHITECTURE.md`, `docs/DATA_DICTIONARY.md`, `docs/MONTHLY_UPDATE_GUIDE.md`, `docs/HANDOVER.md`, `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`, the owner brief (`docs/new-build/00-owner-brief.md`), CR-0006, the open questions and the owner decisions (`docs/new-build/open-questions.md`, `docs/new-build/owner-decisions-new-build.md`) |

This PRD states **what** the product must do. How it is built is in `ARCHITECTURE.md`; field and metric definitions
are in `DATA_DICTIONARY.md`. Owner questions are Q-nn; decisions D-nnn and OD-nn; milestones M-n.

*`ARCHITECTURE.md` in this PRD means the new application's architecture, [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
(from M1.1; its section numbers are those of the Phase 0 record
[`docs/new-build/03-architecture.md`](new-build/03-architecture.md)). The legacy `index.html` is described in
[`docs/legacy/ARCHITECTURE.md`](legacy/ARCHITECTURE.md).*

---

## 1. The application

A single-page, offline analyst workspace that turns one family's holdings workbook (and, when supplied, its transaction
history and PMS/AIF and bond look-through files) into an evidence-based portfolio review: on screen, as an editable
client-ready PowerPoint deck, and as a structured, formula-driven Excel workbook. It diagnoses risk and return drivers,
overlap, concentration, fund quality, allocation, taxation and cost, supports a rebalancing proposal, and is maintained
monthly from a designated folder of approved source material.

**Product properties that do not change**
1. Offline: one self-contained HTML file; no network calls; client data never leaves the browser (`CLAUDE.md` rule 2).
2. Never invent a number: a missing value is a status, never zero, an estimate or another plan's figure (rule 3).
3. Only the exports reach clients; the screen is the analyst's review surface [PO §2.1].
4. Cambria and the house palette everywhere; money maths in Crore, displayed in the file's unit, two decimals.
5. Public repository: nothing confidential is committed (rule 6).

## 2. Users

| User | Needs |
|---|---|
| Products Team analyst | Less manual work; reviews in one place; outputs that need no layout repair; editable observations; the ability to check every number's source |
| Relationship manager / partner (deck consumer) | A clear, client-ready deck with a one-page verdict |
| Client (never touches the tool) | Risks, return drivers, inefficiencies and improvements, explained with their own numbers |
| Monthly data owner | One instruction to process the month's files; a report of what changed and what failed |
| Investment researcher / owner | Validated data, appropriate benchmarks, defensible and auditable calculations |
| Maintainer (Claude sessions) | Resume from the PRD, the latest monthly PRD, the handover, the README and git alone |

## 3. Structure: the nine sections (brief Phase 3)

| # | Section | Contains | Legacy tabs mapped here |
|---|---|---|---|
| 1 | Uploads and inputs | base file (with holder columns when present), IRR, **capital-gains statement** (in the app's template, D-032), PMS/AIF look-through, bonds, monitors, the **MF Screener data pack** slot (kept in this browser until a newer pack is loaded; its cycle date in the sidebar; D-026), an analyst **price file** for direct equity, workbook re-upload; the **disclaimer in use** (version and date from the monthly folder) with an override limited to approved files; the month's data vintages; every upload passes Upload, Validate, Preview and Review stages before it feeds the review; import status, reporting dates, source register, missing files, validation results; family, entity and holder labels; logo; review mode | Home (part), sidebar inputs |
| 2 | Portfolio overview | KPIs, asset and product allocation, client-level and advisor-level allocation, AMC, IPS | IPS, Asset, Distributor, Client, AMC |
| 3 | Portfolio observations | Review Snapshot (RO or RB), observations (Evidence, Diagnosis, Implication, Action) under "What drives portfolio risk" and "What drives portfolio return", with the editor; one-slide SWOT | Observations |
| 4 | Analytics and overlap | equity and debt look-through, overlap (native), index overlap and active share, scopes (family, client, advisor) including returns by scope, **contributors and laggards**, historical analytics, **drawdown comparison on index data** | Analytics, Overlap, Fund IRR (contributors) |
| 5 | Holdings and performance | holding sheets, Fund IRR tree, Portfolio Quants with the portfolio's weighted 3Y and 5Y returns, MF Analysis, MF/SIF/PMS/AIF/direct equity performance with benchmarks (direct equity as CAGR from prices) | Holdings, Fund IRR (tree), MF Analysis, Performance |
| 6 | Rebalancing | the analyst's plan (boxes, picker, worksheet), AI Analyst draft, holding sheet after the plan, post analytics, impact, post overlap, proposed funds, pre/post composition and projection, redemption plan in units, transition plan, Current vs Sample | Rebalancing group, AI Analyst, CVS |
| 7 | Taxation | long and short term, totals, holding detail, harvesting, losses, plan tax impact | Taxation |
| 8 | Market updates | the month's market-update material with preview, order and exclusion | (upload only today) |
| 9 | Annexure | approved PMS/AIF product cards and one-pagers, product information, portfolio cost analysis | Cost |

A permanent **MF Screener** item opens the Screener in a new tab (requested in the brief; the Screener blocks embedding; the one documented exception to the no-remote-URL rule, D-027). Disclaimer and closing slides are deck
components, not sections; the disclaimer's source is an input shown in section 1. The placement of contributors and
laggards (section 4, as the brief says, with the IRR tree in section 5) and of the disclaimer input follows the brief;
Q-77 asks the owner to confirm both.

## 4. Functional requirements

Each requirement carries its brief reference and parity-matrix id (`docs/new-build/05-feature-parity-matrix.md`).

### 4.1 Inputs and validation
- R-IN-1 Read the base file by header name within the first rows of any sheet; report skipped rows by reason; ask the
  analyst when XIRR values look like fractions (OD-3); treat a blank asset as unknown (OD-7); exclude and list holdings
  without a market value (OD-8). (E-01, E-02)
- R-IN-2 Read the IRR workbook with all known transaction types (OD-16), reconciled to the base file (OD-4). (E-05, E-27)
- R-IN-3 Accept MF, Direct and SIF Monitor uploads through the same parser as the monthly update; reject a wrong slot;
  show the data date in use; warn when not newer (OD-11). (U-08 to U-10)
- R-IN-4 Show every source with its date, fingerprint and status; show every validation result with severity and what
  it blocks. (U-60, U-67)
- R-IN-5 Replace the whole review when a new family is loaded; keep the plan and picks on a same-family date change
  (D-015, OD-24); nothing of the previous family survives in any export. (U-50, U-05)
- R-IN-6 Accept the client's capital-gains statement, in the app's capital-gains template (one row per realised lot;
  the proposed columns are in `DATA_DICTIONARY.md` §5.17 and are fixed in M7), as the source of record for realised
  gains of a financial year; offer the blank template for download; refuse a file that is not in the template, naming
  the missing columns; reconcile with gains derived from the IRR file and raise a High result on a difference.
  (E-141; D-032)
- R-IN-7 Show the disclaimer in use (version, date, source) and accept an override only for an approved file. (E-137;
  Q-77)
- R-IN-8 Model accounts, folios and ownership: holders and mode of holding read when the base file carries them,
  otherwise the client is the sole holder and joint holders are NOT AVAILABLE IN SUPPLIED DATA. (E-143; Q-79)
- R-IN-9 Every upload passes the stages Upload, Validate, Preview and Review before it feeds the review (the design
  reference's flow, the One Digital Reckoner Console, `ARCHITECTURE.md` §13.1). (U-60; Q-84 answered)
- R-IN-10 Provide an "MF Screener data pack" upload slot for the pack the owner uploads every Screener cycle
  (`pr-datapack_<cycle>.zip`, contract `pr-datapack-v1`) and its holdings backfill: validate the manifest, files,
  counts and schemas; refuse a failing pack with the reason; keep the accepted pack in this browser's IndexedDB until a
  newer cycle is loaded (the month-end holdings of earlier cycles kept for history); show its cycle date in the
  masthead (D-037), with "validated pack" when its SHA-256 matches the published manifest; keep it across a family switch; let
  the analyst remove it; loading the same pack twice changes nothing. Screener scores and ranks are never embedded in
  a public build, and the pack is never committed. (E-126; Q-18 answered; D-026)
- R-IN-11 Accept an analyst price file (for example the Stock Price to Return Calculator's Fetch Price sheet) for
  stocks the pack does not cover. (E-148)
- R-IN-12 When no Screener pack is stored, every screen, slide and sheet that needs one says so: the screen names the
  missing pack and the slot; slides and sheets name the fallback source used, or show the dash with the status NOT
  AVAILABLE IN SUPPLIED DATA and a footnote ("Screener data not supplied for this review"); scores and ranks have no
  other source. (E-126; D-026)

### 4.2 Analytics
- R-AN-1 Allocation by asset, product, client and distributor; AMC share of the MF book with a 20% cap (OD-1), group
  products outside the cap (OD-33), blank AMC as "AMC not given" (OD-34). (E-21 to E-24)
- R-AN-2 Equity look-through: market cap, sectors with the top-three concentration, top holdings by company (ISIN where
  available), counts, coverage; never apply the debt sub-2% rule to sectors. (E-34, E-35; brief 6.2)
- R-AN-3 Debt look-through: three credit buckets plus "Derivatives and hedges" and "Non-credit holdings" lines, rating
  detail kept; issuers and sectors with sub-2% components folded into "Others" on charts with a note; correct debt
  denominator; YTM and duration. (E-36, E-37, E-115, E-116; Q-46, Q-47)
- R-AN-4 Overlap matrix for any selection and threshold, as a native table; pair statistics; equity overlap with the
  Nifty 500 and active share through named index-fund proxies. (E-40, E-131; Q-30)
- R-AN-5 Family, client and advisor scopes with re-based weights for analytics, overlap, AMC, cost and returns
  (transaction XIRR, benchmark XIRR, IRR tree and contributors per client and per distributor; flows without a
  distributor reported as unassigned). (U-25, U-58, E-142; Q-57)
- R-AN-6 Historical analytics from a historical base file paired with the dated reference vintage; dates and coverage
  shown; fund holdings from the Screener pack's month-end files from 31 Mar 2026; never current holdings as
  historical. (E-117; Q-27 answered)
- R-AN-7 FoF look-through via underlying funds from the Screener pack's `mf_units` rows; otherwise NOT AVAILABLE IN
  SUPPLIED DATA; wrapper classification kept; partial coverage reported. (E-118; Q-28 answered)
- R-AN-8 Effective equity shown gross (OD-30a) with a separate figure excluding hedged arbitrage equity. (E-134; Q-50)
- R-AN-9 Never combine incompatible dimensions: each chart or table series has one dimension and one basis; "Others"
  folds within one dimension and names it; non-credit lines sit beside the credit buckets. (brief 6.3)
- R-AN-10 Contributors and laggards in section 4 for every scope, with the method labelled. (E-29; brief Phase 3)
- R-AN-11 Drawdown comparison on index data only (the five Index TRI files the owner supplies monthly): maximum drawdown, peak and
  trough dates and months to recover per index and for a blend at the review's current asset-class weights, labelled
  as index data and never as the portfolio's history. (E-149; D-023 point 2)

### 4.3 Holdings and performance
- R-HP-1 Holding sheets per client: asset and product grouping, sorted by current value within product, adjacent
  identical distributor labels merged on slides only; unrealised gain = CMV minus invested (OD-18). (E-25; Q-34, Q-49)
- R-HP-2 Transaction XIRR and benchmark XIRR per holding and subtotal on the same holdings (OD-26); the full IRR tree on
  screen and in the workbook. (E-27, E-28, U-69)
- R-HP-3 Performance tables: equity groups Index, Large, Diversified (with ELSS, Dividend Yield, Contra, Value), Mid,
  Small, Thematic and Sectoral, Global, FoF; hybrid low to high risk; debt overnight to long duration; no 2Y column for
  Debt MF; relevant debt indices; all columns centred except Instrument Name; missing benchmarks as statuses.
  (E-31, E-127; Q-45)
- R-HP-4 Portfolio Quants for current and proposed portfolios: value-weighted score with "% of value scored",
  returns, Beta, SD, Alpha, Sortino, Sharpe, down capture, 3Y rolling, per category and total; metric, value, period,
  benchmark, source and date tracked; the Screener pack first where loaded, else fallbacks. (E-126, E-132; Q-19 to
  Q-21)
- R-HP-6 Portfolio 3Y and 5Y returns for mutual funds: each fund's 3Y or 5Y return weighted by its share of the
  portfolio, labelled "weighted average return of current holdings"; source order: the MF Monitor the analyst uploads
  for the review, else the latest monthly MF Monitor, else the MF Screener data pack; funds without a return excluded
  from the weights with the coverage footnoted, never counted as 0%. (E-147; D-023 point 3)
- R-HP-7 Direct-equity 1Y, 3Y and 5Y returns: CAGR = (price on the as-on date / price n years earlier)^(1/n) minus 1
  on split- and bonus-adjusted month-end prices at exact anniversaries of the review date, weighted by allocation;
  stocks without enough history excluded and footnoted (never 0%); the analyst's price file as fallback. (E-148;
  D-023 point 4)
- R-HP-5 MF Analysis per category against the peer median with one fund resolver and the five-year age gate.
  (E-63, U-30; Q-51)

### 4.4 Observations and the Review Snapshot
- R-OB-1 Observations generated by the rule bank (`docs/new-build/observation-rule-bank.md`): each with inputs,
  trigger, metrics, data-quality gate, Evidence, Diagnosis, Implication, Action, and an audit record; each rule
  declares whether it answers "What drives portfolio risk?" or "What drives portfolio return?" and its SWOT
  quadrants, so the one-slide SWOT is built by an explicit mapping; every legacy observation and SWOT trigger maps to
  a rule or to a recorded change. (E-121, E-44, E-45)
- R-OB-2 Client-specific evidence only; no en or em dashes in sentences (D-029), no hindsight wording, unsourced
  claims, personal names or repeated sentences. (brief Phase 8)
- R-OB-3 The analyst edits the wording without changing evidence or calculations; an edit is flagged when its evidence
  changes. (U-61)
- R-OB-4 Review mode: "Portfolio Review Only" by default; "Portfolio Review with Rebalancing" only with a valid
  proposal; the mode changes the Snapshot, summaries, deck manifest and audit, never the current portfolio's data; one
  Snapshot in the deck. (E-114, U-59; brief Phase 5)
- R-OB-5 The Review Only Snapshot always carries current value, invested value, unrealised G/L, asset allocation,
  market-cap and sector exposures, performance against benchmarks, risk-adjusted metrics where meaningful, and
  concentration, overlap and fund-quality findings, each as a value or a status (`ARCHITECTURE.md` §11). (E-114)
- R-OB-6 The Review with Rebalancing Snapshot always carries principal issues, weaknesses addressed, quantified
  pre/post changes, construction improvements, changes in overlap, fund quality or risk where supported, trade-offs and
  risks, tax, liquidity and execution constraints, and conclusions and next steps. (E-114)

### 4.5 Rebalancing and taxation
- R-RB-1 Preserve the analyst's plan: five actions, multi-destination proposals, amount and % interlinked, rationale
  drafts, already-held detection, apply the AI draft pro rata (OD-31). (U-33 to U-36)
- R-RB-2 Compute the post-plan portfolio with the same engine; show post analytics, impact, overlap and the RB Snapshot
  only in RB mode. (U-37 to U-40; Q-58)
- R-RB-3 Pre/post composition and projection: current value, pre and post 3Y and 5Y returns weighted over the pre and
  post fund sets (R-HP-6, with coverage), illustrative values after 3 and 5 years, rupee difference, analyst expected
  returns for products without history; "historical" and "illustrative" labels; never a guarantee. (E-120; D-023
  point 3; Q-36 answered)
- R-RB-4 Redemption in units with reference NAV, estimated INR value, timing and rationale; the reinvestment calculation
  kept in the model. (E-119; Q-37)
- R-RB-5 Transition plan by tax buckets with analyst thresholds, as Phase 2 foundation. (E-133; Q-54)
- R-TX-1 Taxation from transaction lots: units ledger first, rupee-only lots "not split" (OD-12), apportioned by units
  where folios are missing (OD-15), long term after more than 12 months to the review's as-on (OD-2), hybrids by
  equity share (OD-17), harvesting with the set-off order and the exemption rule of Q-52; realised gains of the year
  from the capital-gains statement when supplied (else derived from transactions, labelled), which also gives the
  exemption already used; lots grouped by assessee. (E-41 to E-43, E-141)
- R-TX-2 Tax rules as a versioned owner table with effective dates, refreshed from an approved workbook in the monthly
  folder (never per review), with a generated tax-rules summary for compliance sign-off. (E-106, E-144; Q-82)
- R-CO-1 Portfolio cost from base expense ratios, blanks footnoted (OD-9), one Regular/Direct switch (OD-10). (E-60)
- R-IP-1 IPS compliance on CMV including hybrid sleeves (OD-13), per review. (E-51)

### 4.6 Outputs
- R-PP-1 PowerPoint: native editable charts and tables; Cambria; tokens and components per
  `docs/new-build/deck-design-system.md`; market update first; manifest-driven picker and per-section downloads (no empty
  downloads); cross-references by component name. (E-49; brief Phase 9)
- R-XL-1 Excel: the sheet set of `ARCHITECTURE.md` §14; identifiable inputs, formulas and outputs; formats, filters,
  frozen panes; no merged cells in data ranges; re-upload with validation, recalculation, conflict report and log.
  (E-122; brief Phase 10)
- R-OUT-1 Every material figure agrees across screen, deck and workbook, or the reason (scope, date) is recorded.
  (brief Phase 14)

### 4.7 Monthly maintenance
- R-MU-1 One instruction processes `monthly_updates/YYYY-MM/` (and the private monthly inbox): classify, validate, extract,
  normalise identifiers, update the product bank and performance, refresh market-update and disclaimer material,
  preserve history, recalculate, reconcile, report. (E-129; brief Phase 11)
- R-MU-2 Idempotent; competing and stale files reported; client material quarantined; publication by data class.
  The approved monthly source files are tracked publicly (files above 50 MB as PDF with the original's SHA-256); the
  Screener pack is validated and fingerprinted but never committed or embedded (D-026); the index data (the five Index
  TRI files) is a monthly role.
  (E-129, E-136; D-023 point 1)
- R-MU-3 Product bank keyed by stable ids, with per-field provenance and separate performance history; no facts inferred
  from names. (E-128)
- R-MU-4 Each completed cycle produces `docs/monthly-prds/YYYY-MM-Portfolio-Review-PRD.md` (sections A to I) and
  refreshes the handover, starting with the 2026-10 data month: hand-written from the template until M14, generated
  after. (E-130; brief Phase 12; Q-76)
- R-MU-5 The new update engine reproduces the legacy pipeline's reference blocks before it replaces it (synthetic
  parity in CI, private re-derivation of 2026-09, first live month run by both). (E-129)

## 5. Data flows

```
client files (session) --> ingest --> normalised holdings and transactions --> validation --> engine --> Review
reference vintage (embedded, from monthly_updates via the update engine) ------------------------^
analyst inputs (assumptions, scope, mode, scenario, edits; screen or re-uploaded workbook) ------^
Review --> observations --> view-models --> screen | PowerPoint | Excel; every step writes the audit log
```

Sources, classes and freshness rules: `docs/new-build/06-data-source-inventory.md`.

## 6. Calculation definitions (summary; full definitions in `DATA_DICTIONARY.md`)

| Item | Definition | Authority |
|---|---|---|
| Weights | on current market value (CMV); per-client sheets re-based to the client; scopes re-based to the scope | [PO §3.3] |
| Unrealised gain/loss | CMV minus invested, everywhere | OD-18 |
| Realised gain/loss | from the capital-gains statement (in the app's template) when supplied, else derived from IRR-file redemptions (FIFO), source named, reconciled when both exist | Q-49; D-032 |
| Absolute return | gain / invested x 100 | DL 15 Jun |
| XIRR | actual/365, bisection to a bracket width below 1e-12, Newton fallback | [IE E-26] |
| Benchmark XIRR | the client's cash flows invested in each fund's own benchmark | [IE E-27] |
| AMC cap | 20% of the MF book, breach strictly above 20.00% | OD-1 |
| Overlap | sum over common stocks of min(weight in A, weight in B); diagonal 100; at least 99.5 shown as 100 | [IE E-40] |
| Overlapping fund pair | a pair counts as overlapping (high) when its overlap is 35% or more, and very high at 50% or more; the values live in the approved threshold table | D-030 |
| Index overlap, active share | as overlap; index constituents from the Screener pack when supplied, else a named index-fund proxy; active share = 100 minus index overlap | Q-30 |
| Look-through blocks | normalised over their exposure base; each block sums to 100.00% | [PO §3.3] |
| Portfolio Quants | value-weighted over funds with the metric; coverage reported; missing never zero | [DA §4 slide 5] |
| Portfolio 3Y and 5Y return (MF) | sum of weight x return over funds with a return, divided by their total weight; coverage footnoted; source order uploaded MF Monitor, embedded MF Monitor, Screener pack | D-023 point 3 |
| Direct-equity CAGR | (P(as-on) / P(as-on minus n years))^(1/n) minus 1, n = 1, 3, 5, adjusted month-end prices, exact anniversaries; allocation-weighted over stocks with the tenor | D-023 point 4 |
| Drawdown | on index series: maximum peak-to-trough fall, its dates, months to recover | D-023 point 2 |
| Projection | illustrative value(n) = current value x (1 + r)^n; r historical (the weighted 3Y or 5Y return of the pre or post fund set) or illustrative (analyst) | D-023 point 3; Q-36 |
| Long-term holding | more than 12 months to the review's as-on date | OD-2 |
| Rounding | unrounded maths; rounding only for display; two decimals | brief Phase 13 |

## 7. Design standards

Tokens, chrome, building blocks, the 43 components and the QA checks: `docs/new-build/deck-design-system.md`.
Essentials: Cambria; 9 pt body and tables (8 pt minimum for dense tables); fixed category colours (Equity tan, Hybrid
grey, Debt gold, Commodity mid grey); grey slice outlines; horizontal legends; no needless gridlines; one table border
token (0.5 pt `#D9D9D9`, D-031); Actionables cells tan `#DBC8B2` with the action word in black (D-031); red only for
negatives and breaches; missing values as a dash ("—") alone in the cell with a footnote naming the status, and no en
or em dashes in any sentence (D-029); logo top-right on content slides and lower right on placeholder slides (Q-39);
no logo on market-update pages.

## 8. Reporting modes

| | Portfolio Review Only | Portfolio Review with Rebalancing |
|---|---|---|
| Default | yes | no |
| Requires | a loaded base file | a valid scenario (amounts reconcile, destinations set, post review computed without Blocking errors) |
| Snapshot | mandatory facts (R-OB-5), verdict, what is working, what needs attention (concentration, overlap and fund quality always covered), next steps | mandatory slots (R-OB-6): principal issues, weaknesses addressed, the "what the plan changes" strip, construction, overlap, quality and risk changes, trade-offs, tax, liquidity and execution constraints, conclusions and next steps |
| Deck | no rebalancing section, no post figures, no destination names | rebalancing section and post-plan components |

## 9. Monthly process (summary)

The owner drops the month's files and says: "I have updated the files in the monthly_updates folder. Process the updates
and prepare the current month's data." The update engine runs on the maintainer's machine, writes the reference vintage
and product bank, produces `UPDATE_REPORT.md` and `MANIFEST.json`, and opens a pull request; the owner reviews and says
"publish" before the refresh is merged (current practice). In the design reference's terms: Upload (files dropped),
Validate, Preview (the update report), Review (the owner), Approve ("publish"), Final (the merged vintage). Each
completed cycle ends with the monthly PRD and the handover refresh (R-MU-4). Details: `docs/MONTHLY_UPDATE_GUIDE.md`.

## 10. Tests and acceptance

The 24 acceptance cases of the brief's Phase 15 and the legacy preservation suite: `docs/new-build/08-regression-test-plan.md`.
A release requires: all CI gates green in two time zones, the parity ledger free of regressions, Office acceptance for
any changed output, and the owner's sign-off for switch-over (Q-17).

## 11. Constraints

| Constraint | Source |
|---|---|
| No server, no runtime network, one offline file | `CLAUDE.md` rule 2; [PO §2.1, §2.5] |
| Public repository; no client data, credentials or confidential material | `CLAUDE.md` rule 6; D-008, D-019 |
| Approved monthly source files tracked publicly; vendor-derived data permitted; files above 50 MB as PDF with the original's SHA-256; client data never | D-023 point 1 |
| MF Screener: login-gated; no credentials used or stored; a link in a new tab only; data by the data pack (contract `pr-datapack-v1`) that the owner uploads every cycle into the app, kept in the browser; Screener scores and ranks never in a public build; the pack never committed | [SC]; D-023; D-026; D-027; CR-0006 |
| Matching thresholds never lowered; product class never crossed | `CLAUDE.md` rule 4 |
| Financial changes need a known-answer test and a financial review | `CLAUDE.md` rule 7 |
| Legacy page stays the review link until parity; nothing exported from the preview is used for a client before switch-over | brief §0.3, §0.4; CR-0006; Q-17; D-024 |
| During the parallel run the live page receives calculation, data and security fixes; presentation-only improvements go to the new app | D-028 |
| Published docs carry no local paths and never say where client files are kept | D-019, D-020 |
| Office cannot open files on long paths (218 characters) | D-018; [TE §9] |

## 12. Phase 2 readiness

Not built now: the automated rebalancing decision engine. Prepared now: the scenario model with unit-level lots, dates
and destinations; pre/post recomputation through the same engine; the transition-bucket structure with analyst
thresholds; the `ProposalSource` interface (the AI Analyst is the first source, labelled a draft, Q-55); validation of a
proposal. Dependencies for Phase 2: exit-load data (Q-29), NAV history, the approved methodology (Q-74), signed-off
weights (KI-029). Documented in full at M16.

## 13. Implementation status

| Area | Status |
|---|---|
| Phase 0 audit and design | done; the owner's answers of 22 Oct 2026 applied |
| New application | M1.1: the safety tooling, the Phase 0 records and the living documents merged (PR #10); the rest (the release and monthly PRD checks, the folder skeleton, the living `ARCHITECTURE.md`) ready for its pull request. M1.2, stacked on it and ready for its own pull request: the first application code, the pinned toolchain, the one-file offline build with its invariant check, and the shell with the nine sections of §3 as empty states and the MF Screener data pack slot in section 1, published at `/next/` with the preview banner (D-024, D-034; a failing preview never blocks the legacy page). No requirement is implemented yet beyond the shell. M1.3, stacked on M1.2 and ready for its own pull request: the shared model, the base-file reader with its parity ledger and the reference data in `data/refdata/` (D-035); no page uses them yet. M1.4 (the portfolio overview end to end) is next; M1.3's questions for the owner are in `DATA_DICTIONARY.md` §8 |
| Legacy application | live at `/` (`index.html` with fix batch 2a since PR #9, MD5 `911A0465…`; this PRD's legacy reference stays `782794f`, tag `legacy-baseline-782794f`); during the parallel run it receives calculation, data and security fixes only (D-028) |
| Feature parity | 376 matrix rows, all "not started" |
| Owner decisions outstanding | none: ND-1 to ND-10 answered on 22 Oct 2026 (D-024 to D-033); every other question proceeds on its default, and Claude decides open technical questions under D-033 |

## 14. Change log of this PRD

| Version | Date | Change |
|---|---|---|
| 0.1 | 21 Oct 2026 | Draft from Phase 0 |
| 0.2 | 22 Oct 2026 | Phase 0 review: capital-gains statement, disclaimer input, ownership and upload stages in section 1 (R-IN-6 to R-IN-9); returns by scope and contributors in section 4 (R-AN-5, R-AN-10); dimension discipline (R-AN-9); mandatory Snapshot content (R-OB-5, R-OB-6); root questions and SWOT mapping (R-OB-1); tax rules maintenance (R-TX-2); monthly PRD from the 2026-10 cycle and pipeline parity (R-MU-4, R-MU-5); legacy change policy per CR-0005 |
| 0.3 | 22 Oct 2026 | D-023 and the MF Screener data pack: the Screener pack and price file in section 1 (R-IN-10, R-IN-11); portfolio 3Y and 5Y returns and direct-equity CAGR (R-HP-6, R-HP-7, §6); drawdown comparison on index data (R-AN-11); historical holdings and FoF from the pack (R-AN-6, R-AN-7); projection basis (R-RB-3); publication per D-023 (R-MU-1, R-MU-2, §11); documents in `docs/new-build/`; owner decisions ND-1 to ND-10 |
| 0.3 (M1.1) | 22 Oct 2026 | Committed as `docs/PRD.md`, the living PRD: status row, the note on `ARCHITECTURE.md` and the §13 status updated; content unchanged |
| 0.4 | 22 Oct 2026 | The owner's answers (D-024 to D-033): the MF Screener data pack slot kept in the browser and the absence messages (§3, R-IN-10, R-IN-12, R-MU-2, §11; D-026); the capital-gains template (§3, R-IN-6, §6; D-032); the dash for missing values, no dashes in sentences (§7, R-OB-2; D-029); the overlapping-pair threshold of 35% (§6; D-030); borders and Actionables (§7; D-031); the live page's fix policy (§11, §13; D-028); the Index TRI files as the drawdown data (R-AN-11); §13 status |
| 0.4 (links) | 22 Oct 2026 | The note on `ARCHITECTURE.md`: `docs/ARCHITECTURE.md` is now the new application's architecture and the legacy one is `docs/legacy/ARCHITECTURE.md` (M1.1); requirements unchanged |
| 0.4 (status) | 23 Oct 2026 | §13 status at the end of M1.1: the rest of M1.1 ready for its pull request, M1.2 and M1.3 built on their own branches, the legacy page with fix batch 2a; requirements unchanged |
| 0.4 (M1.2) | 23 Oct 2026 | §13 status for M1.2: the first application code (toolchain, one-file build, nine-section shell, `/next/` preview; D-034); requirements unchanged |
| 0.4 (M1.3) | 23 Oct 2026 | §13 status for M1.3: the shared model, the base-file reader and the reference data (D-035); requirements unchanged |
