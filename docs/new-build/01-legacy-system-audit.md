# Legacy system audit

Phase 0 deliverable 1 (the brief's §0.1). Draft of 21 Oct 2026, revised 22 Oct 2026 (Phase 0 review, then the
merges of PR #7 and PR #8 and D-023; on 22 Oct 2026 the resolutions in sections 1 and 7 that the owner's answers,
D-024 to D-033, settled; change log at the end of `open-questions.md`). What exists, how it is built, what works, what does
not, and what cannot be verified. It consolidates the eight Phase 0 investigations and the repository's own records;
detail lives in `02-capability-inventory.md` (one row per capability) and in the investigator files cited.

**Sources:** [DA] deck-a-spec, [OP] observation-patterns, [IE] inventory-engine-exports, [IU] inventory-ui-workflows,
[PO] previous-owner-and-requirements, [DS] data-source-inventory, [SC] mf-screener, [TE] technology-evaluation; repository
`CLAUDE.md`, `docs/` (D-nnn, OD-nn, KI-nnn). Tags: **[V]** verified (by the investigator named, or in this session),
**[D]** documented and not re-run, **[I]** inference.

---

## 1. Summary

1. **The legacy product works and is in daily use**, but its capabilities are trapped in one 16.8 MB file whose
   calculations are spread across the engine and the UI script and reach the exporters through `window` globals. Two
   slides are broken outright because of that (overlap, post-rebalancing overlap), six slide groups cannot be produced
   headless, and the workbook is values only [IE §1, §5; IU U-53; TE §3.2].
2. **The arithmetic worth keeping is sound and tested:** XIRR, the IRR tree, look-through and hybrid sleeves, overlap,
   the AMC key, the taxation summariser and the AI Analyst bookkeeping pass their known-answer tests [IE §1, V].
3. **Open defects cluster in matching, benchmarks, IRR reconciliation, tax lots, cost, IPS and MF Analysis** (P0/P1),
   all with owner decisions already taken (D-021) but not yet built [IE §1].
4. **Of 219 capabilities** (legacy plus brief-required): 61 working, 97 partially working, 17 broken, 34 missing,
   10 dependent on source material not yet supplied (counted by script, `02-capability-inventory.md` §1; rows E-141
   to E-146 were added in the Phase 0 review: capital-gains statement, distributor-level returns, ownership,
   tax-rules maintenance, held AI Analyst constraints, observation catalogue gaps; rows E-147 to E-149 for D-023:
   MF portfolio 3Y and 5Y returns, direct-equity returns from prices, drawdown comparison on index data).
5. **Compliance posture holds** (offline, no network, client data never leaves the browser, enforced by
   `tools/check-invariants.js`) [PO §2.1, V]. **Vendor-derived data is already public** in the page [DS §1]. D-023
   (22 Oct 2026) closes the D-008 licence question for the vendor-derived data and the approved monthly files.
   Screener scores and ranks are never in a public page of the new app (D-026). The legacy `FUND_RANKS` block (fund
   ranks issued 15 Aug 2026) is an open item in `docs/PROJECT_STATE.md`.
6. **The previous owner's original site** still serves the build without the KI-001 family-isolation fix [PO §1.3].

## 2. What exists

### 2.1 Repository (verified in this session, read-only)

| Item | State |
|---|---|
| Repository | public, `productsteamcentricity/portfolio-review-dashboard`, remote `origin` over HTTPS |
| Branch and commit | audited at `782794f` ("Merge pull request #6 ... fix/engine-numbers-1b"), the last commit that changed `index.html`; `main` is now at `8cb320d` after two docs-only merges, PR #7 (`3a9491a`, D-022 and KI-124) and PR #8 (`8cb320d`, CR-0006, the sanitised owner brief in `docs/new-build/`, D-023); `index.html` MD5 unchanged (rechecked read-only on 22 Oct 2026) |
| Other branches | 24 local branches besides `main`; 7 remote feature branches (rechecked 22 Oct 2026); the repository-organisation branch has nothing unmerged into `main` |
| Records merged since the audit | PR #7: the owner's acceptance of OD-29 to OD-36 as **D-022**, **KI-124**, CR-0005 and `PROJECT_STATE.md` updates (OD-32 and OD-34 go into legacy fix batch 2a, being built now). PR #8: **CR-0006** (the new build) with `docs/new-build/00-owner-brief.md`, and **D-023** (publishing vendor files; drawdowns on index data; portfolio 3Y and 5Y returns; direct-equity returns). The new-app decisions therefore start at D-024 and the new findings at KI-125 |
| Product file | `index.html`, 16,817,827 bytes, MD5 `ef2ff4f198a41fe02404b3617cbad36e` (matches `docs/PROJECT_STATE.md`) [IE header, V] |
| Tracked folders | `.claude/agents` (6 agents), `.github/workflows` (`ci.yml`, `pages.yml`), `buildtools/` (14 files), `docs/` (11 top-level docs plus `audits/`, `change-requests/`, `previous-owner/`, `refresh-log/`), `tools/` (13 scripts, `patches/` 6, `regression/` 9 + lib, `browser-checks/` 2) |
| `.gitignore` | blocks every office, data and image format globally, `test-data/`, `.blocks/`, `buildtools/out/`, backups, local settings |
| Known issues register | KI-001 to KI-124 on `main` (KI-124, the empty Home deck, since PR #7) [IU U-45]; N-1 to N-10 not yet filed |
| Owner decisions | D-001 to D-023 on `main`; audit decisions OD-1 to OD-28 answered (OD-11 changed); OD-29 to OD-36 answered "accept all" on 21 Oct 2026 (D-022); publication and return methods decided on 22 Oct 2026 (D-023) |

### 2.2 The product file

| Part | Content [IE §2, §8; TE §3.1] |
|---|---|
| 13 script blocks | 00 Chart.js 4.4.0; 01 chartjs-plugin-datalabels 2.2.0; 02 SheetJS CE 0.18.5; 03 PptxGenJS 3.12.0 (bundles JSZip); 04 `REFDATA` (about 10 MB of reference data); 05 dividers; 06 logos, topic slides and six Market Update images; 07 engine (3,117 lines); 08 exporters (2,262); 09 parsers (430); 10 expense-ratio table; 11 UI (the largest block); 12 boot |
| Page shell | three columns: inputs left, 20 stacked sections centre, navigation and slide picker right [IU U-01, U-02] |
| Reference data | `MF_PERF` 2,130; `MF_PERF_DIRECT` 1,765; `BENCH_RET` 108; `SIF_PERF` 30; `PMS_PERF` 721; `AIF_PERF` 12; `EQUITY_ANALYTICS` 1,144; `HYBRID_ANALYTICS` 243; `DEBT_ANALYTICS` 486; `STOCK_INFO` 8,684; `STOCK_RET` 8,580; `MF_RISK` 1,088; `FUND_RANKS` 1,262; `FUND_MGR` 2,099; `TAX_RULES` 25; `MF_ER_TABLE` 14,644 keys |
| Data vintages | 30 Sep 2026 for monitors, analytics and risk; ranks 15 Aug; fund managers 31 Aug; PMS 31 Jul; AIF 30 Jun; Market Update "Oct 2026 (6)" [PO §1.1] |

### 2.3 How it is built and changed

- **No build step, no npm install.** The file is the product; it is changed only by anchored, idempotent patch scripts
  (`tools/patches/`, `tools/patch-lib.js`, D-016) and checked by `tools/check-invariants.js` (`CLAUDE.md` rule 1).
- **Five self-contained scripts** (engine, exporters, parsers, UI, boot) share state only through `window` and `ENGINE`
  (`CLAUDE.md` rule 5). Code is read through `.blocks/` copies because `index.html` contains NUL bytes.
- **Monthly refresh:** `buildtools/` (intake check, drift survey, build, gate, splice) evaluates the app's own parsers out
  of `index.html`, so the parsers are a shared contract between the app and the refresh (N-9) [IE §10]. Proved
  byte-identical on September 2026 [D]. Manual steps: TRI downloads, Outlook slide export to JPEG, Fund Ranks splice.
- **Deployment:** `pages.yml` publishes `index.html` only, after the invariants and smoke test (D-007); `ci.yml` runs the
  four legacy suites on every PR with `TZ=Asia/Kolkata` (D-012).
- **Process:** branches, PRs, local merges with the no-reply identity, merge of verified requested work (D-017, D-020).

### 2.4 Outside the repository

- The owner's private project storage: the monthly inbox (the 2026-10 month is empty, V), the archive of processed
  vendor files for data months 2026-04 to 2026-09 (no March 2026), the handover as received (second export not
  arrived) and private audit evidence [DS §2; PO §4]. Its folder layout is not given in public files (D-019).
- The previous owner's unpacked export (on the maintainer's machine, outside the repository): vendor and reference files,
  knowledge and session notes; the risk-ratio toolchain and several sources of record are missing (IPS profiles,
  Rebalancing Rules, `Logic.txt`, Fund Ranks, topic and disclaimer sources) [PO §4.3].
- The original public site (previous owner's account) serves the handover baseline, MD5 `173f86ca...`, last modified
  14 Oct 2026; 10 of its 13 blocks are byte-identical to this repository's; the engine, exporter and UI blocks differ by
  the KI-001 fix and fix batches 1a and 1b only [PO §1, V].
- The MF Screener: a separate, invitation-only internal tool; sign-in required; the Screener refuses to be framed; no
  link from the dashboard today [SC §1, V]. Its data will arrive as a monthly data pack built by the Screener owner's
  exporter (contract `pr-datapack-v1`, CR-0006), with a one-time backfill of month-end holdings from 31 Mar 2026; no
  pack has been received yet.
- The sister Investment Proposal Dashboard: already parses the Reckoner and PMS/AIF material (reuse candidate) [DS §1].
- The brief's Claude Artifact design reference: the "One Digital Reckoner Console", a monthly data upload tool with
  the stage flow Upload, Validate, Preview, Review, Approve, Final Excel, processing in the browser only, and no
  portfolio-review layout or visual spec (read on 22 Oct 2026; Q-84 answered). Evaluated in `03-architecture.md`
  §13.1.

## 3. Test status (verified at runtime by the engine investigator on 21 Oct 2026 [IE header]; re-run read-only by the Phase 0 review on 22 Oct 2026 with `TZ=Asia/Kolkata`, same results, working tree clean afterwards)

The re-run also confirmed `index.html` at 16,817,827 bytes with the MD5 above. The investigators' run outputs were
not saved at the time; the review's re-run is the evidence for this table.

| Suite | Result |
|---|---|
| `check-invariants.js` | all invariants hold; 1 vendor warning (KI-027, a sector sum of 99.912) |
| `smoke-review.js` | 35/35; full headless deck 50 slides, 6.7 MB; 19 single-tab groups build; workbook 14 sheets |
| `test-ai-analyst.js` | 24/24 |
| `run-regression.js` | 9 files, 380 checks: KI-007, KI-048, KI-061, KI-062, KI-063, KI-067, KI-068, KI-114, KI-120 |

What the suites do not cover: slide counts per group (which is how KI-124 passed CI), the slide picker, per-tab
buttons, upload UI paths, overlap interactions, cost overrides, IPS, MF Analysis on screen, rebalancing editing,
`localStorage`, renderer failures, and any content check of the workbook beyond sheet existence [IU "Tests"; IE §11].

## 4. What works

- **Engine core:** XIRR solver (exact within 1e-6), IRR tree arithmetic, equity and debt look-through with hybrid sleeve
  split (KI-055 fixed), unique-stock counting, overlap matrix (square, symmetric, bounded), AMC key and the 20% MF-book
  breach, asset/product/client/distributor allocation, liquidity and commodity classification, contributors and
  laggards, debt YTM and duration [IE §3, §4].
- **Exports that work:** asset allocation, distributor and client levels, AMC, holdings (with known overflow issues),
  analytics, Fund IRR, post-rebalancing analytics, rebalancing impact, proposed-funds performance, the Market Update
  images first in the deck, disclaimer and thank-you images; workbook sheets for allocation, AMC, overlap, observations,
  rebalancing, AI Analyst [IE §6, §7].
- **Workflows:** base-file upload with family isolation (KI-001 fixed, 9/9 browser checks), AI Analyst "apply plan" with
  pro-rata allocation (OD-31), rebalancing boxes and picker, already-held detection, offline operation [IU U-33 to U-36,
  U-50, U-55].
- **The monthly refresh pipeline** reproduces the embedded September data byte for byte [D].

## 5. What does not work, or only partly

### 5.1 Broken outputs (B)

| Capability | Defect | Id |
|---|---|---|
| Overlap slide | title and footnote only, no matrix (exporter reaches UI-scope functions) | E-59, KI-002 |
| Post-rebalancing overlap slide | never produced | E-67, KI-003 |
| IPS compliance | wrong verdicts (look-through basis; OD-13 not built) | E-51, U-17, KI-066 |
| Direct-plan performance list | 308 of 2,071 names resolve to another scheme; rows dropped | E-32, KI-054 |
| Home "Download slide" | 0-slide deck reported as a success | U-16, U-45, KI-124 |
| MF and Direct Monitor uploads | expense ratios 100x; degraded AUM and debt fields; wrong slot accepted | U-08, U-09, KI-058, KI-026, KI-076 |
| Market Update reset | the × does not restore the embedded slides | U-14, KI-009 |
| Cost tab | unsourced estimates; overrides above 300 bps cut 100x; persists across families | U-27, KI-059, KI-060 |
| MF Analysis | two different matchers; screen and deck can show different funds' ratios | U-30, KI-053 |
| Taxation | rupee ledger misallocates long and short term; lot joins by exact name; ignored transaction types | U-31, KI-064, KI-069, KI-070 |
| `localStorage` | settings and identifying fragments persist across families; blocked storage blanks tabs | U-51, KI-012, KI-035, KI-088 |
| HTML escaping | workbook text inserted unescaped in many renderers | U-54, KI-008 |

### 5.2 Structural causes

1. **No single calculation model.** IPS, cost, CVS, MF Analysis, rebalancing deltas, post-rebalancing analytics,
   proposed funds and the AI Analyst plan are computed or stashed in the UI script and read by the exporters from
   `window` (12 read sites) [IU U-53; TE §3.2].
2. **Name-based matching** with ties broken by key order (KI-036) and renamed schemes resolved to other funds (KI-050);
   only `FUND_RANKS` carries an AMFI code, `STOCK_RET` an ISIN, and neither is used as a join key [IE E-13, E-125].
3. **Positional vendor parsing** (columns 0/1/2/3/8/9/11/13/15/18) against vendor files whose headers already move
   [DS §1 item 9].
4. **Fixed-count PowerPoint pagination** (KI-078, KI-110, KI-122) and full-slide pictures for dividers, disclaimer,
   closing and the overlap matrix [IE §2; DA §1].
5. **Values-only workbook** (2,039 cells, 0 formulas, 0 styles, no frozen panes, no filters; dashes in numeric columns)
   [IE §2, V].
6. **Duplicate sources of truth:** four category-to-benchmark maps (one unused), hard-coded IPS bands, CVS assumptions,
   TER defaults, AI weights, aliases and 143 proposed products [DS §1 item 8].
7. **Presentation writing** uses em dashes as the missing-value placeholder and in at least 19 titles; 19 observation and
   15 AI-template lines carry dashes (N-7); one SWOT bullet fires for every portfolio (N-3) [IE §10; OP §7].

### 5.3 New findings to file (from the investigations)

N-1 derivatives, D-rated and other non-credit labels grouped as "AA & Below"; N-2 harvesting ignores the long-term
exemption; N-3 unconditional SWOT bullet; N-4 bare "sip" in the direct-equity pattern; N-5 hard-coded CVS fallback;
N-6 single-tab downloads include their divider; N-7 dashes in client text; N-8 dead code; N-9 parsers shared with the
refresh; N-10 renamed fund houses not aliased (OD-32) [IE §10]. They are to be filed from KI-125 onward. Also:
KI-124 confirmed [IU U-45] and filed on `main` (PR #7); the Holdings
download button disappears after a column chip toggle (code reading, not browser-verified) [IU U-23]; arbitrage and
balanced-advantage equity sleeves counted gross in effective equity (G-6) [OP §7.2].

## 6. Against the brief

| Brief area | Legacy state |
|---|---|
| Nine-section single page (Phase 3) | 20 sections in a five-part flow; every tab must map to a section |
| Advisor-level analytics and overlap (6.5) | missing (distributor appears only as an allocation tab, a cost filter and an overlap quick-select); distributor-level returns were built once ad hoc and the IRR parser ignores the DISTRIBUTOR column [PO §2.4 item 7] |
| Section 1 inputs: capital gains, disclaimer (Phase 3) | no capital-gains input exists (V: no capital-gain or realised-gain handling in the engine, parser or UI blocks); the disclaimer is an embedded image with no input |
| Accounts, folios, ownership (Phase 2) | client name, folio and distributor per row only; no joint holder, mode of holding or ownership share (V: `parseBaseRows` column list) |
| Conditional Review Snapshot (Phase 5) | missing; post-rebalancing views always shown |
| Observation engine (Phase 8) | 35 condition-triggered templates, read-only, not E/D/I/A |
| Debt sub-2% and three rating buckets (6.3, 6.4) | missing; seven string-tested groups |
| Historical analytics, FoF look-through (6.6, 6.7) | missing; FoFs excluded by owner rule since 26 May |
| Holdings sort and grouping; performance order, centring, no 2Y (Phase 7) | partly present |
| Portfolio Quants (7.2) | missing as a roll-up; `MF_RISK` equity only; no Screener data (the data pack, contract `pr-datapack-v1`, is not yet supplied) |
| Portfolio 3Y and 5Y returns, direct-equity returns, drawdowns (D-023) | missing: no weighted portfolio return; direct-equity returns are the vendor's `STOCK_RET` columns; no drawdown view and no index history in the page |
| Editable deck, placeholder slides, slide 6/8/9/25 rules (Phase 9) | partly present; pictures for dividers and closing |
| Formula workbook with re-upload (Phase 10) | missing |
| Monthly engine from a designated folder, product bank (Phase 11) | refresh pipeline for vendor files only; Reckoner not ingested (now the product-bank source by the brief) |
| Monthly PRD and handover (Phase 12) | refresh logs per refresh; no PRD; interim hand-written monthly PRD from the 2026-10 cycle proposed (Q-76) |
| Validation and severity (Phase 13) | footnotes and counts; no severity model |
| MF Screener link (Phase 4) | missing; requested in the brief, so it becomes the one documented exception to the no-remote-href rule (D-027, new app only) |

## 7. Conflicts and risks the audit surfaced

| Conflict or risk | Detail | Resolution path |
|---|---|---|
| Public tracking of licensed monthly files | brief vs archive README, `CLAUDE.md`, `MONTHLY_REFRESH.md`, `.gitignore` | resolved by D-023 point 1 (approved files tracked; files above 50 MB as PDF); class policy D-026 |
| Licensed data and the legacy fund ranks already public | about 10 MB vendor-derived data; the legacy `FUND_RANKS` block (fund ranks issued 15 Aug 2026) | vendor-derived data permitted by D-023; the `FUND_RANKS` block is an open item (`docs/PROJECT_STATE.md`; Q-06) |
| MF Screener link vs "no remote href" | `check-invariants.js` fails on any URL | resolved: the owner asked for the link in the brief; one documented exception (D-027) |
| Reckoner as source vs 20 May decision | reversal of a recorded decision | resolved by the brief (Q-03 answered) |
| Dash ban vs the em dash placeholder | presentation writing | D-029 (Q-42): the dash stays as the missing-value marker; sentences never use one |
| Equity performance order | brief drops ELSS, Dividend Yield, Contra, Value | Q-45 (proceeding on default) |
| Seven rating groups vs three buckets | owner decision of 5 Jun vs brief | Q-46 (proceeding on default) |
| Original site without the KI-001 fix | analysts on the old link | Q-08 (proceeding on default) |
| Missing second export | `MF_RISK` cannot be refreshed in October | Q-31 (default: STALE DATA; the Screener pack's risk metrics once supplied) |
| Gain definition | deck A shows two gain figures; OD-18 chose one | Q-49 (proceeding on default) |
| Legacy changes during the parallel run | CR-0005 schedules fix batches 2 to 7 (D-021) and D-022 puts OD-32 and OD-34 in legacy batch 2a; moving presentation-only items to the new build would change that plan | D-028 (Q-16): calculation, data and security fixes on the live page; presentation-only items to the new build |
| Pages publishes `index.html` only (D-007) | the new app needs `/next/` | D-024 (Q-10) supersedes D-007 in part |
| Accepted decisions that prescribe a dash | OD-13 (no unlisted holdings) and OD-29 (totals without a return) show "—"; the brief bars dashes in presentation writing | D-029 (Q-42): no conflict; the dash is a marker, and the ban covers sentences |
| Direct-equity returns basis | the legacy shows the vendor's `STOCK_RET` returns; D-023 point 4 computes CAGR from adjusted month-end prices at exact anniversaries | built in the new app (E-148); differences classified in the parity ledger |
| Echoed holdings sheet name | OD-22 named it "Holdings (as loaded)"; the brief's list says "Source Inputs" | kept as "Holdings (as loaded)" (`03-architecture.md` §14) |

## 8. What could not be verified, and why

| Item | Why |
|---|---|
| On-screen behaviour of every UI capability | no browser session was run in Phase 0 (shared preview port and pane); behaviour read from code and earlier reproductions [IU] |
| Six slide groups (`ips`, `rebal`, `rebalhold`, `postan`, `rbimpact`, `proposedperf`) | need UI state; cannot be built headless [IE §13] |
| Rendering and overflow in PowerPoint and Excel | engine and UI investigators did not open Office; deck A and B were rendered by their investigators, legacy exports were not [IE §13; DA §8] |
| Real-format client files (base-file XIRR units, transaction labels) | no real-format fixture available; rules forbid using client files [IE §13; PO §5] |
| Vendor licence terms | no contract available [DS §13] |
| MF Screener contents and definitions | sign-in required; no credentials used, by rule [SC §1] |
| The numbers inside the reference decks | not recomputed from source data (only plan totals re-added) [DA §8; OP §9] |
| Monthly pipeline on real data this month | needs licensed files; the October inbox is empty [DS §2.1] |
| JSZip version inside PptxGenJS | no version string; 3.5.0 inferred [IE §2] |
| Excel opening the in-house writer spike | path length limit; not opened [TE §13] |
| Anything in the previous owner's second export | not received [PO §5] |
| Whether the March 2026 prior-month block is usable | vendor files not opened [PO §5] |
| The layout of a client capital-gains statement | settled by D-032: statements are uploaded in the app's own template, so no issuer layout has to be learnt |
| The MF Screener data pack | the contract is written; no pack or backfill has been received |
| The owner's monthly index data | format to be confirmed; no file yet |
| A force-push made on the remote | not checkable from the local reflog; the remote check is designed in `08-regression-test-plan.md` AC-22 and is unverified until M1.1 |
