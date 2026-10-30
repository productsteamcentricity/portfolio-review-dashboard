# Existing dashboard handover, 28 Oct 2026 (version 1)

**Workstream A: the live page (`index.html`).** Written on 28 Oct 2026 (IST) by MOD-01 for the handover to MOD-02, on
branch `handover/mod-01-to-mod-02-20261028` (base `main` at `6443826`).

| Field | Value |
|---|---|
| Outgoing chat | MOD-01 ("Portfolio Review Dashboard architecture"), HANDOVER REQUIRED. It led Workstream A until 28 Oct |
| Successor for Workstream A | **EX-01** (QUEUED): first dedicated Workstream A implementation chat. It takes over TA-03 from MOD-01. Its copy-ready prompt: [continuations/EX-01_TASK-TA-03_SUCCESSOR_PROMPT_2026-10-28.md](continuations/EX-01_TASK-TA-03_SUCCESSOR_PROMPT_2026-10-28.md) |
| Coordinator | **MOD-02** (QUEUED): sequencing, task assignment, number ranges, "go to merge", owner communication |
| Guardian | **ARC-01** (QUEUED): Gate B review of every material diff; may block with a NO-GO |
| Kept by | MOD-02. A later version is a new file; this one is never overwritten ([README.md](README.md) section 5) |
| Private supplement | `C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md` on the owner's laptop. Anything sensitive is there, never here |

**Labels.** [VERIFIED] means checked, with the evidence given (a SHA, a file and line, or a command). [INFERRED] means
reasoned from verified facts. [UNCERTAIN] and [UNKNOWN] mean what they say. Status words are the owner's nine:
VERIFIED COMPLETE; IMPLEMENTED, NOT FULLY VERIFIED; IN PROGRESS; PLANNED; BLOCKED; NOT STARTED; EXISTING DEFECT;
UNKNOWN / NEEDS INVESTIGATION; SUPERSEDED.

> **This is a snapshot of 28 Oct 2026, not proof of today's state.** Git is the authority. Before you act on any SHA,
> MD5, branch or status below, run the read-only block in
> [REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md#verify-before-you-trust)
> and the TA-03 checks in section 9.1. A document never proves that code works or that a test passed.

## Contents

1. [How to use this document](#1-how-to-use-this-document)
2. [Anchors on 28 Oct 2026](#2-anchors-on-28-oct-2026)
3. [What the live page is](#3-what-the-live-page-is)
4. [How it was replicated and baselined](#4-how-it-was-replicated-and-baselined)
5. [How it is changed](#5-how-it-is-changed)
6. [Every check and its command](#6-every-check-and-its-command)
7. [The monthly refresh and the "publish" rule](#7-the-monthly-refresh-and-the-publish-rule)
8. [Fix batches and audit batches](#8-fix-batches-and-audit-batches)
9. [TA-03: the tax batch in full](#9-ta-03-the-tax-batch-in-full)
10. [TA-05: fix batch 5](#10-ta-05-fix-batch-5)
11. [TA-10: the October 2026 refresh](#11-ta-10-the-october-2026-refresh)
12. [The rest of Workstream A](#12-the-rest-of-workstream-a)
13. [Open known issues](#13-open-known-issues)
14. [Owner questions for Workstream A](#14-owner-questions-for-workstream-a)
15. [Risks](#15-risks)
16. [Who does what in Workstream A](#16-who-does-what-in-workstream-a)
17. [What this handover could not establish](#17-what-this-handover-could-not-establish)
18. [Change log](#18-change-log)

## 1. How to use this document

**Who it is for.** EX-01 first, then MOD-02 and ARC-01 when they need Workstream A on its own. It is meant to be
useful without the master handover. The whole project is in
[MASTER_HANDOVER_2026-10-28_v1.md](MASTER_HANDOVER_2026-10-28_v1.md).

**What stays authoritative.** This document indexes; it does not replace. When it and another record disagree, git
wins, then the record named here for that subject.

| Subject | Authoritative record |
|---|---|
| Rules for every change | [CLAUDE.md](../../CLAUDE.md) |
| Narrative project state | [docs/PROJECT_STATE.md](../PROJECT_STATE.md) (several lines lag git on 28 Oct: TC-15) |
| Decisions | [docs/DECISIONS.md](../DECISIONS.md) (D-040 exists only on the TA-03 branch) |
| Defects | [docs/KNOWN_ISSUES.md](../KNOWN_ISSUES.md) (KI-160 to KI-182 exist only on the TA-03 branch) |
| Checks and how to run them | [docs/TESTING.md](../TESTING.md) |
| The live page's architecture | [docs/legacy/ARCHITECTURE.md](../legacy/ARCHITECTURE.md) and [ARCHITECTURE_AND_DEPENDENCY_MAP.md](../project-control/ARCHITECTURE_AND_DEPENDENCY_MAP.md) |
| The monthly refresh | [docs/MONTHLY_REFRESH.md](../MONTHLY_REFRESH.md) |
| Tasks, chats, active changes, ownership, gates | the registers in [docs/project-control/](../project-control/README.md) |
| The tax batch's own record | `docs/change-requests/CR-0008-live-tax-rules.md` on branch `continuation/ex-01-task-ta-03-20261027` (not on `main`) |

**Reading order for EX-01.** This document; [project-control/README.md](../project-control/README.md) sections 5 and 6
(roles and gates); the [TA-03 card](../project-control/TASK_REGISTER.md#ta-03-tax-batch-cr-0008-d-040);
[ACTIVE_CHANGE_REGISTER.md](../project-control/ACTIVE_CHANGE_REGISTER.md) entry 1;
[FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md); then CR-0008, D-040 and the
T5 patch header on the TA-03 branch; then the private supplement.

**Terms used below.** *Base file*: the client holdings workbook an analyst uploads. *IRR sheet*: the client's
transaction history upload. *CMV*: current market value. *Harvest*: the Taxation tab's tax-loss and exemption
harvesting card. *Sec 198 exemption*: the Rs 1.25 lakh yearly long-term exemption of the Income-tax Act 2025.
*Usual bucket*: the tax class the owner's tax reckoner gives a fund type by default. *Page MD5*: the MD5 of
`index.html`; this project cites its first 8 hex digits (for example `12B5E572`).

## 2. Anchors on 28 Oct 2026

| Anchor | Value | Evidence |
|---|---|---|
| `main` = `origin/main` | **`6443826`** (`644382621f403339222d5e9dfccbb6b7ada7b10e`), merge of PR #16, 27 Oct 18:13 IST | [VERIFIED: `git ls-remote origin`, 28 Oct] |
| Live page `/` | **16,837,249 bytes, MD5 `12B5E5727FCA01EF2EA162C59913F01D`**, equal to `main`'s `index.html`; Pages verified 27 Oct after the merge | [VERIFIED: `git show 6443826:index.html \| md5sum`; curl download recorded in the [integration log](../project-control/INTEGRATION_AND_REGRESSION_LOG.md) section 1] |
| Preview `/next/` | 46,905 bytes, unchanged since PR #14 (Workstream B) | [VERIFIED: integration log section 1] |
| TA-03 branch | **`continuation/ex-01-task-ta-03-20261027` at `0f1c5d3`** (`0f1c5d35a4ac7e4713f3421784e839bf5bf14ca0`), pushed and equal to origin; upstream is its own origin branch | [VERIFIED: `git ls-remote origin`; `git rev-parse --abbrev-ref @{u}`, 28 Oct] |
| TA-03 parent | **`97a7d69`** (`97a7d699297b2d915ebacd749978bb6603dc83b0`), local branch `fix/legacy-batch-3-tax-p3-r2` (no remote of its own; fully contained in the continuation branch) | [VERIFIED: `git rev-parse 0f1c5d3^1`] |
| TA-03 pages | `97a7d69`: MD5 `0713C6BEEFCB35D778730AB9BEF3E430`, 16,898,566 bytes. `0f1c5d3`: MD5 `5F1C2FC56EDA2682822DBF0DB5B44CA3`, 16,908,418 bytes | [VERIFIED: `git show <sha>:index.html \| md5sum`, `git cat-file -s`] |
| TA-03 worktree | `C:\dev\portfolio-review\.claude\worktrees\wf_c9c8da96-497-10`, on the continuation branch at `0f1c5d3`, 0 uncommitted lines | [VERIFIED: `git -C <worktree> status --porcelain`, 28 Oct] |
| CI on the TA-03 branch | **none, ever**; no open pull request | [VERIFIED: `gh run list --branch continuation/ex-01-task-ta-03-20261027` empty; `gh pr list --state open` empty, 28 Oct] |
| Main checkout | `C:\dev\portfolio-review`, on `main`, clean; used only for D-020 merges | [VERIFIED: repo-env investigation, 28 Oct] |

## 3. What the live page is

- **One offline HTML file, `index.html`** (about 16.8 MB). An analyst uploads one client holdings workbook (the base
  file) and, optionally, the IRR sheet and other files. The page builds a portfolio review: **20 on-screen tabs**, a
  **PowerPoint deck** (PptxGenJS) and an **Excel workbook** (SheetJS). [VERIFIED: [CLAUDE.md](../../CLAUDE.md), "What
  this is"]
- **Everything is inside the file**: four libraries, about 10 MB of vendor reference data (`window.REFDATA`, 21 blocks
  with `DATA_DATES`; `window.MF_ER_TABLE`), logos and Market Update images. The file has 13 script blocks, found by
  marker strings; five are app code: engine (07), exporters (08), parsers (09), UI (11), boot (12).
  [VERIFIED: [ARCHITECTURE_AND_DEPENDENCY_MAP.md](../project-control/ARCHITECTURE_AND_DEPENDENCY_MAP.md) section 2]
- **No network, ever.** Client data is uploaded in the browser and never leaves it. `check-invariants.js` enforces
  this on the app code and the page shell. [VERIFIED: CLAUDE.md rule 2]
- **Data vintage.** Most data is as on 30 Sep 2026. Older blocks wait for their files: FUND_RANKS 15 Aug, FUND_MGR
  31 Aug, PMS_PERF July data, AIF_PERF 30 Jun, the 15 PMS and AIF look-throughs 31 Jul, MF_BENCHMARKS.
  [VERIFIED: [MONTHLY_REFRESH.md](../MONTHLY_REFRESH.md) Part 3]
- **Published** by `.github/workflows/pages.yml` at `https://productsteamcentricity.github.io/portfolio-review-dashboard/`,
  byte for byte, after the legacy gates pass. The new build's preview sits at `/next/` and never blocks the live page
  (D-024, D-034). [VERIFIED: [DEPLOYMENT.md](../DEPLOYMENT.md)]
- **Users.** Products Team analysts build reviews; the monthly data owner refreshes the embedded data. Only the exports
  reach partners and clients.
- **Origin.** The previous owner built it with Claude between May and October 2026 and handed it over on 14 Oct 2026.
  The previous owner's own site still serves the handed-over build and stays live until the new build is fully tested
  (owner's decision, 15 Oct). Any later step for that site is the owner's to schedule and is never raised with the
  previous owner. [VERIFIED: DEPLOYMENT.md, "The previous site"]
- **Its role now.** The live page stays the review link until the new build (CR-0006) reaches parity, planned for
  early January 2027 at milestone M15 [INFERRED from NB-01's ETAs]. Until then it takes **calculation, data and
  security fixes only**; presentation work goes to the new build (D-028).

## 4. How it was replicated and baselined

| Item | State | Evidence |
|---|---|---|
| Stage A replication (CR-0001, TA-00) | **VERIFIED COMPLETE.** The root commit `511f554` holds the previous owner's final page byte for byte: MD5 `173F86CAC1E5D0AC8FFD5A66042A3B4C`, 16,765,556 bytes. Fresh git history (D-002); two client-name scrubs in the import; `index.html` unchanged | [VERIFIED: `git show 511f554:index.html \| md5sum`, 28 Oct; [REPLICATION_REPORT.md](../REPLICATION_REPORT.md)] |
| Baseline checks, 14 Oct | Invariants hold with 1 warning (KI-027); smoke 26/26 in IST and UTC; AI Analyst 17/17 once the stale test was restored (KI-010); browser load, review and exports passed (61 slides, 15 sheets); no network requests | [VERIFIED as records: [TESTING.md](../TESTING.md) section 2] |
| Handover acceptance list (9 checks) | Checks 1 to 6, 8 and 9 pass. **Check 7 (open the decks and workbooks in PowerPoint and Excel) is still "Partial"** (TA-11). Check 8 rebuilt the September data byte for byte through `buildtools/` | [VERIFIED: TESTING.md section 3; [refresh-log/2026-09.md](../refresh-log/2026-09.md)] |
| Errata to the previous owner's specification | XIRR in the base file is a percent; Purchase Date does not feed Taxation; deck order differs from tab order; and more | [VERIFIED: REPLICATION_REPORT.md section 5] |
| Tag `legacy-baseline-782794f` | Marks the page **after fix batch 1b** (`782794f`, MD5 `EF2FF4F1`), the new build's parity baseline. It is **not** the Stage A baseline | [VERIFIED: `git cat-file -p legacy-baseline-782794f`] |
| Last verified baseline today | `main` `6443826`, live MD5 `12B5E572`; CI run 40506084298 and Pages run 40506084394 green | [VERIFIED: [integration log](../project-control/INTEGRATION_AND_REGRESSION_LOG.md) section 1] |

The full page lineage (every published MD5 and every unmerged tax page) is in the integration log, section 3. A new
baseline exists only after a Gate D record with the live MD5 checked after the Pages run.

## 5. How it is changed

These rules come from [CLAUDE.md](../../CLAUDE.md) and [docs/DECISIONS.md](../DECISIONS.md). Each applies to every
Workstream A change.

1. **Patch scripts only (D-016, CLAUDE.md rule 1).** Code in `index.html` changes only through a committed script
   `tools/patches/<yyyy-mm-dd>-<slug>.js` built on `tools/patch-lib.js`. Each edit's anchor must occur exactly once;
   a fully applied patch is a no-op; a partly present patch is refused; a write that would break the invariants
   (script count 14, tail, LF only, no BOM, NUL count) is refused; the MD5 before and after is printed. Never open
   `index.html` in an editor or with the Edit or Write tools: it has 10 MB lines and 3 raw NUL bytes in block 11.
2. **Read code in `.blocks/`**, written by `node tools/extract-blocks.js`. The copies there are from 21 Oct and the
   legacy ARCHITECTURE line counts are stale, so regenerate before citing a line (TA-23).
3. **Mind the scopes.** The five app scripts share state only through `window.*` and `ENGINE.*`; a helper put in the
   wrong scope is silently `undefined`. Load order: engine, exporters, parsers, then the UI (CLAUDE.md rule 5).
4. **Scope during the parallel run (D-028):** calculation, data and security fixes only.
5. **Never invent a number** (rule 3). An unmatched holding gets a blank, a footnote and a count. Matching rules are
   fixed (rule 4).
6. **Per-family state (D-015, KI-001).** New per-family state must be cleared in `resetFamilyState()` in the UI
   script, and `tools/browser-checks/family-isolation.js` must pass.
7. **Financial changes** need the `financial-domain-reviewer` agent and a known-answer test (rule 7). Each fixed issue
   gets one file in `tools/regression/` (for example `KI-160-anniversary-rule.js`), exiting 1 on any failure.
8. **Shared outputs move in the same PR.** A change to REFDATA regenerates `data/refdata/` with
   `node scripts/data-extract.ts`, then `--check` (D-035). A change in base-file reading or aggregation updates NB-01's
   parity ledger entries in the same PR (fix batch 4 did: `bf2db99`, `b8a8d7f`). ENGINE keys are additive only, and
   `tools/check-invariants.js` ENGINE_KEYS is updated with them (it already lags: TA-22). Block marker strings are
   never changed (they are copied in 7 places). Rules and owners: [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md)
   and [INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md).
9. **Record the page MD5** in the CR, PROJECT_STATE, TESTING and CHANGELOG, and prove it with
   `node tools/check-invariants.js --expect-md5 <MD5>`.
10. **Rebuilding a page.** The documented rule ("`git checkout -- index.html`, then every patch in file-name order")
    does **not** run on today's `main`: 4 of the 9 patches refuse, safely (TA-23). What works is **the parent page plus
    this branch's new patches in file-name order**. On 28 Oct MOD-01 rebuilt the tax chain this way in a scratch copy:
    `12B5E572` then T1 `22019426`, T2 `B8722C4E`, T3 `D321DBA0`, T4 `0713C6BE`, T5 `5F1C2FC5`, and a second T5 run
    reported "no change". [VERIFIED: commands in section 9.1] Write a page from git only in **Git Bash**
    (`git show <sha>:index.html > index.html` is byte-exact). Never use PowerShell redirection for it: it re-encodes
    text and would corrupt the file [INFERRED from PowerShell's output encoding].
11. **Git.** One task, one worktree, one branch, one writer. Push from the branch's own worktree with
    `PRD_PRIVACY_DENYLIST` exported (the hook script comes from the main checkout, the scanner from the pushing
    worktree). Never force-push, rewrite history, delete branches, stash or reset away work, or use `--no-verify`.
    Pull requests merge locally with `git merge --no-ff` and the exact D-020 message, only after MOD-02's "go to merge",
    green CI and ARC-01's Gate B GO ([INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md) I-25).
12. **Gates A to E** for every change: [project-control/README.md](../project-control/README.md#6-gates-a-to-e).

## 6. Every check and its command

Run from the root of the worktree that holds the change (Git Bash; prepend
`export PATH="/c/dev/tools/node:/c/dev/tools/git/cmd:/c/dev/tools/gh/bin:$PATH"` if `node` is missing, or call
`C:/dev/tools/node/node.exe`). "IST and UTC" means run twice, with `TZ=Asia/Kolkata` and `TZ=UTC` (in PowerShell,
`$env:TZ = 'UTC'`). Meaning of each check: [TESTING.md](../TESTING.md) section 1.

| Check | Command | On `main` `6443826` (recorded) | On the TA-03 branch | Gate |
|---|---|---|---|---|
| Invariants | `node tools/check-invariants.js --expect-md5 <MD5>` | all hold, 1 warning (KI-027) | all hold, 1 warning, at `97a7d69` (recorded) and `0f1c5d3` (scratch run, 28 Oct) | CI, Pages |
| Smoke, synthetic book | `TZ=Asia/Kolkata node tools/smoke-review.js`, then `TZ=UTC` | 35/35 | 36/36 in IST and UTC | CI, Pages |
| AI Analyst | `node tools/test-ai-analyst.js` | 24/24 | 24/24 | CI only (not in Pages) |
| Known-answer regression | `TZ=Asia/Kolkata node tools/run-regression.js`, then `TZ=UTC` (`[KI-nnn]` runs one) | 19 files, 649 checks | 43 files, 1,277 checks at `97a7d69`; 44 files, 1,385 checks at `0f1c5d3` (scratch run) | CI, Pages |
| Repository tests | `TZ=Asia/Kolkata node --test "tests/**/*.test.mjs" "tests/**/*.test.ts"`, then `TZ=UTC` | 234/234 | 234/234 at `97a7d69`; **not run at `0f1c5d3`** | CI (`next`) |
| Reference data equals the page | `node scripts/data-extract.ts --check` | pass | pass at `97a7d69` and `0f1c5d3` (scratch run) | CI (`next`) |
| Docs links | `node scripts/validation/docs-links.mjs` | pass | pass at `97a7d69`; not run at `0f1c5d3` | CI (`next`) |
| Traceability | `node scripts/validation/traceability.mjs` | pass | pass at `97a7d69`; not run at `0f1c5d3` | CI (`next`) |
| Privacy of the docs | `node scripts/validation/privacy-scan.mjs docs *.md` and `--diff origin/main`, with the deny-list exported | CI runs the generic rules only | not run with the deny-list on T5 | CI (`next`) and before every push |
| Pre-push scan | `node scripts/validation/prepush-scan.mjs --base origin/main --head HEAD` (the hook runs it on `git push`) | pass | **PASS at `97a7d69`** (commit message of `0f1c5d3`); **must be re-run on the final head** | every push |
| Release state | `node scripts/validation/release-check.mjs` (report into the PR); `--after-push` after the push | pass | not run; WARN expected on a `continuation/` branch name (TC-23) | before every merge; CI (`next`) |
| Monthly PRD | `node scripts/validation/monthly-prd-check.mjs` | pass | not run | each monthly cycle; CI (`next`) |
| Family isolation (browser) | serve the page, paste `tools/browser-checks/family-isolation.js` in the console, `await familyChecks.isolation()`, then `irrBeforeBase()` and `removeThenReload()` on fresh pages | 9 checks in `isolation()` | **11 checks** (adds the tax-assumption reset); **never run in a browser** | qa-engineer, before merging UI changes |
| CVS refresh (browser) | `tools/browser-checks/cvs-refresh.js`: `planRefresh()`, `hybridSplit()`, `unallocated()`, `fof()`, each on a fresh page | 4 functions pass | not run on the combined page | qa-engineer |
| Browser acceptance | [TESTING.md](../TESTING.md) section 4, steps 1 to 10, on the synthetic files from `node tools/make-sample-base.js` | passed for fix batch 4 (`b8a8d7f`) | **not run on `0713C6BE` or `5F1C2FC5`** | qa-engineer, before merging |
| Office (PowerPoint and Excel) | open real exports; for slides, `node tools/render-slides.js test-data/Sample_Base_File.xlsx test-data/Sample_IRR_Transactions.xlsx <out.pptx> tax` with the output **outside** the repository, then PowerPoint | handover check 7 still "Partial" (TA-11) | T1 tax slides were viewed in PowerPoint; T3 to T5 slides were not | any export change |
| CI | `gh workflow run "Dashboard checks" --ref <branch>` or a PR (`ci.yml` runs on push to main, pull requests and `workflow_dispatch`) | green, run 40506084298 | **never run** | Gate C and D |
| Pages after a merge | `git show origin/main:index.html \| md5sum` equals `curl -s https://productsteamcentricity.github.io/portfolio-review-dashboard/ \| md5sum`; `/next/` size and SHA-256 unchanged when the app did not change | equal, 27 Oct | not applicable until merged | Gate D |

Evidence for the TA-03 column: the `0f1c5d3` commit message and CR-0008 for `97a7d69`; the workstream-A
investigation's scratch run of 28 Oct for `0f1c5d3` (outside the repository, so it must be re-run). [VERIFIED as
records]

`render-slides.js` can read a real base file. Point it only at the synthetic files in `test-data/` and write its
output outside the repository; a deck of a real client must never be created in or near the repository (CLAUDE.md
rule 6).

## 7. The monthly refresh and the "publish" rule

Full procedure: [MONTHLY_REFRESH.md](../MONTHLY_REFRESH.md). The `refresh-operator` agent follows it and never
publishes.

| Step | Who | What |
|---|---|---|
| 1 | Owner | Puts the month's files in the monthly inbox (`01 Monthly Updates\YYYY-MM`, with `Analytics` and `Index TRI` subfolders). The runbook says the 13th to the 17th of the next month; the owner's answer of 23 Oct says the 11th to the 17th (the docs are stale: TA-08) |
| 2 | Owner | Tells Claude the files are in |
| 3 | Claude | Runbook Steps 0 to 9 on a `data/YYYY-MM-refresh` branch from a clean `main`: intake, vendor drift survey, Market Update slides, risk workbook, build and gate, splice with `--data-only`, follow-on blocks, checks (including `data-extract.ts`, D-035), log, PR, summary to the owner |
| 4 | Owner | Reviews the refreshed page locally and the summary, then replies **"publish"** or asks questions. **Nothing reaches the live site before the owner says so** |
| 5 | Claude | Step 10: merge (D-020, after MOD-02's go and green CI), verify the live size and SHA-256, archive the month, create the next inbox, mark the log "published", update PROJECT_STATE |
| 6 | Owner | Tells users; anyone who sees old data hard-refreshes |

- **The "publish" rule.** D-017 says a data refresh merges only after the owner has reviewed it, and the runbook
  makes the word "publish" the signal. The owner never typed this rule; PD-30 asks the owner to confirm it.
  [VERIFIED: D-017; MONTHLY_REFRESH.md Part 1 step 4; DECISION_LOG PD-30] Under the gates, a refresh takes Gate E
  (the owner's "publish") **before** Gate D (the merge).
- **From the 2026-10 data month**, each completed cycle also ends with a monthly PRD in `docs/monthly-prds/` and a
  refresh of the "Last refreshed" line of `docs/HANDOVER.md`, both checked by `monthly-prd-check.mjs` (TA-21).
- **History.** September 2026 is the template: 13 to 14 Oct, logged in
  [refresh-log/2026-09.md](../refresh-log/2026-09.md). No real refresh has run under this team yet; October is the
  first (section 11).

## 8. Fix batches and audit batches

"Fix batch" numbers are not the audit's batch numbers. Fix batches 1a and 1b together are audit batch 1; audit
batches 2 to 7 are tasks TA-12 to TA-17 and have not started. [VERIFIED: the audit's fix order against CR-0005,
CR-0007, CR-0008, CR-0009]

| Fix | Task | Record | What it fixed | Merge | Page | Verification on record | Status |
|---|---|---|---|---|---|---|---|
| KI-001 | TA-00 | CR-0002, D-015 | A new base file inherits nothing from the previous family | PR #1, `9f018e4` | `173F86CA` to `F0EB0101` | `family-isolation.js` three checks passed in a browser, 15 Oct | VERIFIED COMPLETE |
| 1a | TA-01 | CR-0005 | KI-047 XIRR for same-day flows; KI-055 hybrids scaled twice; KI-006 partial XIRR coverage; KI-065 debt fund tax | PR #4, `f778283` | `F0EB0101` to `FB6676DC` | smoke 26 to 35; financial review approved | VERIFIED COMPLETE |
| 1b | TA-01 | CR-0005 | KI-007 blank invested; KI-048 and KI-100 IRR join; KI-061 AMC key; KI-062 degraded Exit bookkeeping; KI-063 Apply plan; KI-067, KI-068, KI-114 CVS; KI-120; KI-119 | PR #6, `782794f` (tag) | `FB6676DC` to `EF2FF4F1` | two financial reviews per group; browser and PowerPoint QA; 9 regression files, 380 checks; AI Analyst 17 to 24 | VERIFIED COMPLETE |
| 2a | TA-02 | CR-0007 | KI-124 empty Home slide; OD-32 renamed houses; OD-34 and KI-112 "AMC not given"; KI-015 (Home part); KI-138 | PR #9, `bb413c4` | `EF2FF4F1` to `911A0465` | smoke 35/35; AI 24/24; 12 files, 499 checks; browser acceptance passed 22 Oct | VERIFIED COMPLETE; the owner's confirmation of the settled details (PD-17) does not block |
| 3, tax | **TA-03** | CR-0008, D-040 | the TY 2026-27 tax reckoner's rules: KI-160 to KI-182 (= TX-01 to TX-23; 22 fixed, KI-177 in part), KI-099, KI-130, KI-037 in part, both parts of KI-022, OD-2, OD-12, OD-28 | **not merged** | `12B5E572` to `0713C6BE` (T1 to T4) to `5F1C2FC5` (T5) | section 9 | **IN PROGRESS** |
| 4, base file | TA-04 | CR-0009, D-041 | KI-140 merged units; KI-141 merged date and days; KI-142 total rows; KI-143 text in number cells; KI-144 impossible dates; KI-145 asset labels; KI-146 IPS actuals; repeated header row skipped | PR #16, `6443826` | `911A0465` to `558A50F3` (branch) to **`12B5E572` (live)** | invariants; smoke; AI; 19 files, 649 checks; `node --test` 234/234 in IST and UTC; browser acceptance passed on `b8a8d7f`; gate GO; CI and Pages green | VERIFIED COMPLETE; D-041 question 1 open (PD-08) |
| 5 | TA-05 | none yet | KI-183, D-042, retire NB-01's KI-147 ledger entries | not started | | | PLANNED (section 10) |

| Audit batch | Task | Issues | Status |
|---|---|---|---|
| 1, engine numbers | TA-01 | as above | VERIFIED COMPLETE |
| 2, reference-data joins | TA-12 | KI-052, KI-053, KI-054, KI-034, KI-072 | NOT STARTED |
| 3, uploads and parsers | TA-13 | KI-056, KI-058, KI-060, KI-074 to KI-077, KI-069, KI-070; the OD-11 monitor-upload fixes | NOT STARTED |
| 4, security | TA-14 | KI-008 (unescaped workbook text) and a CSP for the live page | NOT STARTED |
| 5, exports | TA-15 | KI-078, KI-002, KI-003, KI-079, KI-082 to KI-085, KI-021, KI-081, KI-073, KI-094, KI-096, KI-097 | NOT STARTED (weigh against D-028) |
| 6, robustness | TA-16 | KI-088, KI-087 | NOT STARTED |
| 7, UI wiring | TA-17 | KI-068 fixed in 1b; KI-086 in part; KI-089 open | NOT STARTED (remainder) |
| Owner-accepted OD items not built | TA-18 | OD-1, 3, 4 (part), 5, 6, 8, 9, 10, 11, 13, 14, 15, 16, 18 to 24, 26, 35 | NOT STARTED |

[VERIFIED: every MD5 with `git show <commit>:index.html | md5sum`; the evidence columns repeat the change records;
[TASK_REGISTER.md](../project-control/TASK_REGISTER.md)]

## 9. TA-03: the tax batch in full

**Status: IN PROGRESS.** T1 to T4: IMPLEMENTED, NOT FULLY VERIFIED. T5: IN PROGRESS, unreviewed. Owner MOD-01 until the
handover, then **EX-01**. Records: CR-0008 and D-040 on the branch;
[TA-03 card](../project-control/TASK_REGISTER.md#ta-03-tax-batch-cr-0008-d-040); integration log section 5.1.

**Why it exists.** On 24 Oct the owner supplied the TY 2026-27 tax reckoner (law as on 19 Oct 2026; the Income-tax Act
2025 in force from 1 Apr 2026) as the source of record. A financial review of the live Taxation tab, tax slides and AI
Analyst tax signal found 23 discrepancies, TX-01 to TX-23, each re-verified; they are KI-160 to KI-182 (TX-nn is
KI-(159+nn)). The lead set a default for each gap the reckoner leaves open, in D-040 (a) to (h), all open to the
owner's confirmation. [VERIFIED: CR-0008 and D-040 on `0f1c5d3`] The reckoner sits in the October monthly inbox;
the review's working file is private (`C:\dev\private\tax-review-2026-10-24.json`).

### 9.1 Branch, parts and commits

| Part | Scope | KIs | Commit | Checks on record | Status |
|---|---|---|---|---|---|
| T1 | tax classes and the TAX_RULES rows (25 to 32) | KI-162 to KI-165, KI-170, KI-172 to KI-174, KI-178 to KI-180, KI-099 | `c459f8d` (on the old base `911A0465`) | invariants; smoke 35/35; AI 24/24; 23 files; `node --test` 234/234; tax slides viewed in PowerPoint | IMPLEMENTED, NOT FULLY VERIFIED. **Must not merge alone** (CR-0008) |
| T2 | holding periods and lots: anniversary rule, 1 Apr 2023 rule, valuation date, 1 Feb 2018 disclosure (32 to 34 rows) | KI-160, KI-161, KI-176, KI-177 step 1 | `92c7c83` | 27 files, 950 checks, also UTC | IMPLEMENTED, NOT FULLY VERIFIED |
| T3 | harvest per client, Sec 198 exemption, set-off order, fund-level and pass-through AIFs, PMS, carry-forward wording, crypto source | KI-166 to KI-169, KI-171, KI-175, KI-181, KI-182, KI-130 | `5581d90` | 35 files, 1,092 checks | IMPLEMENTED, NOT FULLY VERIFIED |
| T4 | the financial re-review of T3: crypto kept out of set-off; two figures in the records corrected | KI-182, KI-175 | `5581d90` | 36 files, 1,122 checks. The commit says browser QA passed and the security gate gave GO, **for the pre-rebase page `61FC0FB2` only** | IMPLEMENTED, NOT FULLY VERIFIED. CR-0008 line 13 still says the batch waits for "the check of part T4" |
| Rebase | merge of `main` `6443826` into the branch; tax patches re-applied to main's page | (none new) | `97a7d69` | see 9.2 | IMPLEMENTED, NOT FULLY VERIFIED |
| T5 | follow-ups to T1 to T4 | KI-170 (dated), KI-109 (in part), KI-184 (comment) | `0f1c5d3`, a WIP checkpoint | see 9.3 | **IN PROGRESS, unreviewed** |
| later | grandfathering step-up for lots bought before 1 Feb 2018 | KI-177 step 2 | none | none | BLOCKED on CR-0008 question 12 (PD-05); task TA-07 |

The branch changes 45 files against `main` (+7,525/-294): `index.html`; five patches
`tools/patches/2026-10-27-tax-1-classification.js`, `-tax-2-holding-period.js`, `-tax-3-harvest.js`, `-tax-4-review.js`,
`-tax-5-followups.js`; 26 files under `tools/regression/` (25 test files and `lib/tax-harness.js`);
`tools/smoke-review.js`; `tools/browser-checks/family-isolation.js`; `data/refdata/TAX_RULES.json` and `VINTAGE.json`;
`CHANGELOG.md`; `docs/DECISIONS.md`, `KNOWN_ISSUES.md`, `PROJECT_STATE.md`, `TESTING.md`, `legacy/ARCHITECTURE.md`,
`audits/2026-10-19-decisions.md`, `change-requests/README.md` and CR-0008. No `app/` file. [VERIFIED:
`git diff --stat 6443826 0f1c5d3`, `git diff --name-only`, 28 Oct]

**Re-derive the pages yourself.** MOD-01 ran this on 28 Oct in a scratch folder outside the repository, with the
results in the comments [VERIFIED]:

```bash
W=/c/dev/portfolio-review/.claude/worktrees/wf_c9c8da96-497-10
SCR="$(mktemp -d)"
git -C "$W" archive 0f1c5d3 tools | tar -x -C "$SCR"
git -C "$W" show 6443826:index.html > "$SCR/index.html"          # 12B5E572, Git Bash only
for p in 1-classification 2-holding-period 3-harvest 4-review 5-followups; do
  node "$SCR/tools/patches/2026-10-27-tax-$p.js" | grep -E '^MD5'
done
# 12B5E572 -> 22019426 -> B8722C4E -> D321DBA0 -> 0713C6BE -> 5F1C2FC5
node "$SCR/tools/patches/2026-10-27-tax-5-followups.js" | tail -1   # result : no change (everything already applied)
md5sum "$SCR/index.html"                                            # 5f1c2fc56eda2682822dbf0db5b44ca3
```

### 9.2 The rebase `97a7d69` and what it changed

`97a7d69` is a **merge commit** (parents `5581d90` and `6443826`), so no history was rewritten. It brought in PRs #14
and #15 (new-build records, D-036, D-037) and PR #16 (fix batch 4, D-041). [VERIFIED: `git log -1 97a7d69`]

- **The page was rebuilt**, not merged as text: main's page `12B5E572` plus the four tax patches in file-name order,
  giving T1 `22019426`, T2 `B8722C4E`, T3 `D321DBA0`, T4 `0713C6BE`. T1, T3 and T4 applied unchanged.
- **Two anchor revisions, both in `tax-2-holding-period.js`**, where the two batches meet in `computeTaxation`:
  1. The TX-17 line's one-line anchor `out.unreconciled.push(rec); return; }` now occurred twice, because fix batch 4
     (KI-140) added an unreconciled exit for a merged folio with blank units ending the same way. The anchor now
     carries the line before it; the inserted line is unchanged.
  2. A new edit gives fix batch 4's merged-folio, blank-units holding the same TX-17 sentence (trades after the
     valuation date were left out). Known answer: `KI-176-valuation-date.js`, 2 new checks; the second fails on the
     anchor-only build `F87DB859`.
- **Where the batches meet, pinned by new checks:** a merged AIF (Category III or I/II) with blank units stays fund
  level or pass-through, never unreconciled (`KI-166-aif-cat-iii.js`, +1); a merged PMS with one folio with units and
  one without is unreconciled with fix batch 4's reason, while one whose folios all lack units stays not split
  (`KI-169-pms-not-split.js`, +2). KI-145's Asset Name reading reaches the tax classes ("Fixed Income" is Debt for AIF,
  PMS and unlisted classes). Fix batch 4's merged dates and holding days do not reach Taxation, which ages the IRR
  sheet's lots.
- **Docs:** both sides kept; DECISIONS in number order (D-036, D-037, D-040, D-041); `data/refdata` regenerated (no
  change).
- **Left for later then:** the Taxation tab's unreconciled table kept its general heading for a merged holding with
  blank units. T5 item 3 now words it by reason.
- **Checks on `0713C6BE`** (recorded): two scratch rebuilds give the same MD5; every patch re-run reports no change;
  `check-invariants --expect-md5 0713C6BEEFCB35D778730AB9BEF3E430` (1 warning); smoke 36/36 (IST, UTC); AI Analyst 24/24;
  run-regression 43 files, 1,277 checks (IST, UTC); `node --test` 234/234 (IST, UTC); `data-extract --check`;
  docs-links; traceability; and, per the `0f1c5d3` message, **pre-push PASS**. **Not run: browser acceptance of the
  combined page** (CR-0008 line 503).

[VERIFIED: the `97a7d69` commit message; CR-0008 "Rebased on fix batch 4"]

### 9.3 T5: the WIP checkpoint `0f1c5d3`

**What it is.** A preservation checkpoint made when the owner ordered a project-wide stop on 27 Oct; the T5
implementer agent was stopped part-way. It adds `tools/patches/2026-10-27-tax-5-followups.js` (434 lines, **46
edits**, to the engine 07, exporters 08 and UI 11 scripts; TAX_RULES unchanged), its test
`tools/regression/CR-0008-T5-followups.js`, and updates the KI-166, KI-169, KI-170 and KI-171 tests. 7 files, nothing
else. **Two implementer agents may have run in this worktree during T5** (the workflow journal shows two starts), so
the patch is to be treated as **unreviewed**. [VERIFIED: `git show --stat 0f1c5d3`; commit message]

**What was checked at the checkpoint.** The implementer ran only run-regression (44 files pass). The commit says
nothing else was run. A scratch re-run by the workstream-A investigator on 28 Oct, outside the repository, found:
invariants hold (1 warning, `--expect-md5 5F1C2FC5...`); smoke 36/36 in IST and UTC; AI Analyst pass; 44/44 regression
files, 1,385 checks (CR-0008-T5 49, KI-170 96) in IST and UTC; `data-extract --check` matches. [VERIFIED as an
investigation record; re-run it]

**The 8 header items, and what remains for each.** The patch header (lines 8 to 50 at `0f1c5d3`) lists 8 items. Each
of the 46 edits has a `label:`; the line numbers below are those labels, read on 28 Oct. A shared edit is listed under
every item it serves. The mapping is [INFERRED from the labels]; whether each edit does what its label says is the
review EX-01 must do.

| # | Header item | Edits (label lines) | Covered by the patch? | What remains |
|---|---|---|---|---|
| 1 | The usual bucket, dated: aggressive hybrid, arbitrage and equity savings funds are equity-oriented as the reckoner's usual bucket only when the tax reference date is on or after 1 Apr 2026, marked and labelled; before it, unclassified with a reason. An arbitrage fund with a blank category is read by its name. `taxClassify` and `taxClassOf` take the date as an optional third argument | 64, 77, 82, 92, 115, 134, 154, 159, 205, 216, 221, 238, 247, 257, 262, 285, 296, 362, 392 | Yes, per header and labels | Financial review. Note for it: the live page gates on the **valuation date** (it has no realised-sales view), while the new build's TR-7 and LD-11 gate on the **date of sale** [VERIFIED: private coordination notes; `capital-gains-upload.md` §10.5]. D-040 "Usual buckets" text (still says equity savings stays unclassified), a "settled while building part T5" note, and the cross-reference (section 9.4). KI-170 entry. Browser check of a book valued before 1 Apr 2026 if the synthetic files allow it |
| 2 | The Sec 198 exemption line and the "Loss set off" cells no longer show "-Rs 0.00" | 247, 324, 329, 334, 407, 414, 419 | Yes | Browser and PowerPoint check |
| 3 | The unreconciled table's heading says why, by reason (merged folios with blank units, no purchase still held, units differ, invested value); the unit reasons say which way and lose their dash; the holding-detail slide no longer says "no lot history" for them | 165, 170, 175, 267, 402 | Yes | Browser and PowerPoint check |
| 4 | An AIF whose category the file does not state (the 11 "Listed AIF" funds of AIF_PERF) stays Category I or II, pass-through, marked `catAssumed`; the tab, slides and AI Analyst say so and ask for the AIF's statement. Q17 stays open | 64, 126, 159, 194, 199, 216, 221, 227, 233, 247, 257, 262, 301, 339, 362 | Yes | Financial review, including which category strings count as "stated" (the test at label line 126); D-040 (d) note; PD-02 stays open |
| 5 | Wording T3 left stale (PMS and AIF unit columns; "LTCG + STCG add back") removed; the class slide's footnote grows upward from its third line instead of running into the black band (KI-109) | 344, 375, 380, 397 | Yes | PowerPoint check of the class slide at its longest footnote; KI-109 entry update [INFERRED] |
| 6 | The harvest slide's "Left out" line gives the count and the CMV, as the tab does | 426 | Yes | PowerPoint check |
| 7 | The harvest inputs are text fields that accept "1,25,000", "125,000" and "1 25 000"; only a blank or non-numeric entry restores the default | 314, 319, 349 | Yes | Real typing in a browser (CR-0008 line 397 lists typing, focus and narrow widths as not verified) |
| 8 | A comment only: the foreign-share marker reads the ISIN of the matched STOCK_RET entry; the base file's own ISIN column is not read by `parseBaseRows` (KI-184, open, not fixed here; "D-040 c corrected") | 120 | Comment only, by design (header lines 49 to 50) | File KI-184; correct D-040 point (c) (section 9.4). The fix itself is TA-06, out of TA-03's scope |

All 46 edits map to items 1 to 8; no edit label falls outside them [INFERRED from the labels].

**Reconciling the planned T5 list (critique point G11).** The `0f1c5d3` message lists as NOT done "the remaining T5
items as listed in the handover". MOD-01's T5 brief of 27 Oct is recorded in the private coordination notes
(`C:\dev\private\coordination-notes.md`). It named nine entries: the dated usual bucket; no "-Rs 0.00"; the
unreconciled heading by reason; the neutral AIF note; the stale slide wording; the "Left out" line with the CMV;
comma-grouped inputs; **the D-040 cross-reference to the new build's TR table**; and the KI-184 ISIN column. The same
notes asked for the KI-170 test expectations (done in `0f1c5d3`) and **D-040's "Usual buckets" text** to be updated
(not done). So, on the evidence, the items not in the patch are the two D-040 text items, both docs [INFERRED].
Whether the original brief named anything else is [UNCERTAIN]: it is in MOD-01's private session records. EX-01
records the reconciliation in CR-0008 and reports any missing item to MOD-02.

**Pre-push (critique point G17).** The pre-push scan passed at `97a7d69` [VERIFIED: `0f1c5d3` message]. It has not
been run on any T5 commit, and it **must be re-run on the final head** with the deny-list exported before the push
that goes to review and again before the PR.

### 9.4 Docs still to write

All in the TA-03 branch, in the same change as the final T5 state:

1. **D-040** (not on `main`, so it is amended in place; once merged, a change needs a new D entry):
   - point (c): the foreign-share marker reads the ISIN of the matched STOCK_RET entry (and a row's own `isin` when it
     has one), but `parseBaseRows` does not read the base file's ISIN column (KI-184). Today it says "an ISIN not
     starting with IN" without that limit;
   - the "Usual buckets" default: aggressive hybrid, arbitrage and equity savings funds take the usual bucket from
     1 Apr 2026 by the tax reference date, unclassified with a reason before it;
   - a "Settled while building part T5" paragraph (the dated bucket, `catAssumed`, the reason kinds, the text inputs);
   - the cross-reference to [docs/new-build/capital-gains-upload.md](../new-build/capital-gains-upload.md) section 10
     (TR-1 to TR-21; TR-7 and LD-11 for the usual bucket), saying where the two builds differ (valuation date against
     date of sale) [INFERRED wording].
2. **docs/KNOWN_ISSUES.md**: update KI-170 (T5 dates the usual bucket); **file KI-184** from EX-01's range (open; fix
   in TA-06); update KI-109 for the class slide [INFERRED]; move KI-022 under the fixed heading (its text already says
   fixed in T2). Optionally file KI-185 for the ENGINE_KEYS gap (TA-22), if MOD-02 agrees (REC-06). **Do not** file
   KI-183 here: TA-05 files it.
3. **CR-0008**: the status paragraph (lines 10 to 15) and the "Status" section (from line 549): T5 added; "none
   pushed" corrected to "on origin through `continuation/ex-01-task-ta-03-20261027`"; a "Scope of part T5" and a
   "Verification (part T5)" section in the existing pattern; the T5 reconciliation of section 9.3; question 17's state
   with the neutral note; the two lead questions the coordination notes add to the tax-defaults list (the single-ETF
   90/90 default, PD-06; the 30% slab rate for ordering set-off, PD-07).
4. **CHANGELOG.md**, **docs/PROJECT_STATE.md**, **docs/TESTING.md** (section 1 regression row: 44 files and 1,385
   checks, or the final counts; smoke 36).
5. **CLAUDE.md** line 99: smoke "35 checks" becomes 36. It is correct on `main` today and moves with this batch
   (critique E7). CLAUDE.md is a shared hotspot: tell MOD-02 in the Gate A report.
6. **docs/legacy/ARCHITECTURE.md**: `taxClassify(h, R, refDate)` and `taxClassOf(h, R, refDate)`; the `usualBucket`
   and `catAssumed` marks; the unreconciled reason kind [INFERRED: the branch already documents T1 to T4 there].
7. **docs/change-requests/README.md**: the CR-0008 row's status.

### 9.5 Checks still to run on the final head

Every check of section 6, on the final page, with these expectations: invariants with
`--expect-md5 <final MD5>`, all hold, 1 warning (KI-027); smoke 36/36 in IST and UTC; AI Analyst 24/24; run-regression
every file (44 or more) in IST and UTC; `node --test` all pass in IST and UTC (234 at `97a7d69`; if a test reports a
missing package, run `npm ci` in the worktree, never `npm install`); `data-extract --check`; docs-links; traceability;
the privacy scan with the deny-list; **the pre-push scan with the deny-list on the final head**; release-check (WARN on
the branch name only). Then browser QA, the Office check, the reviews and CI (sections 9.6 and 9.7).

### 9.6 Review, browser QA and the gate

- **Financial review** (`financial-domain-reviewer`, read-only): T5 item by item against its header and the reckoner;
  the part T4 check CR-0008 says is still due; the two T2 anchor revisions of the rebase. It returns "approve" or
  "changes needed". If it finds a T5 defect, fix it inside `2026-10-27-tax-5-followups.js` and rebuild `index.html`
  as `97a7d69`'s page plus the revised patch (T5 is unmerged), then record the new MD5 everywhere [INFERRED: the same
  approach the rebase used for T2].
- **Browser QA** (`qa-engineer`, independently) on the final combined page, served from the TA-03 worktree on
  **port 8133** (8134 and 8135 are spare in Workstream A's range; 8099 stays the main checkout's):
  `node tools/make-sample-base.js`, then `node tools/serve-dashboard.js 8133`. There is no launch entry for this
  worktree yet; add one named `dashboard-ta03` in the session's own launch configuration (its location is in the
  private supplement), not in the tracked repository `.claude/launch.json` (a shared hotspot). Cover: TESTING
  section 4 steps 1 to 8; the Taxation tab (classes, the usual-bucket and assumed-category notes, the unreconciled
  heading, the harvest card with real typing of "1,25,000", the Sec 198 line, the pool table); the AI Analyst tax
  signal; `family-isolation.js` (11 checks in `isolation()`, then `irrBeforeBase()` and `removeThenReload()`); all four
  `cvs-refresh.js` functions; console clean; no network request. The `qa-engineer` definition is stale (it says 17 AI
  checks and port 8099: TC-17), so brief it with the port and counts.
- **Office check:** the tax slides (class, holding detail, harvest) opened in PowerPoint and the workbook opened in
  Excel, from synthetic files only, written outside the repository.
- **Security gate:** `security-release-reviewer` GO on the staged diff before every commit that will be pushed and
  before the PR.
- **Gate B:** ARC-01 reviews the real diff `6443826...<final head>`, the interfaces it touches (ENGINE keys,
  REFDATA.TAX_RULES 25 to 34 rows, `data/refdata`, `resetFamilyState()`, the new build's TR table), a merge
  simulation against `main` and every active branch, and the tests. It may give a NO-GO; escalation goes to MOD-02,
  then to the owner. If ARC-01 does not exist yet, MOD-02 launches it (TC-04); TA-03 cannot pass Gate B without it.

### 9.7 CI evidence early (critique point G10)

`ci.yml` runs on `workflow_dispatch`, so CI can run on the branch now, while the owner's questions are open:

```bash
gh workflow run "Dashboard checks" --ref continuation/ex-01-task-ta-03-20261027
gh run list --branch continuation/ex-01-task-ta-03-20261027 --limit 1
```

A draft PR does the same. In a dispatched run, release-check reads the branch from `GITHUB_REF_NAME` and warns on the
`continuation/` prefix only [INFERRED from `release-check.mjs` lines 25 to 26 and 262 to 271]. Run CI again on the
final head; Gate D needs a green run on the PR itself.

### 9.8 PR and merge conditions

1. **Owner answers first.** CR-0008 line 554 puts questions 17 (PD-02: are the "Listed AIF" funds Category III?) and
   18 (PD-03: may crypto gains or losses be set off?) before the merge. The merge may also go ahead if the owner
   accepts the safe defaults now built: the neutral note for AIFs whose category is assumed, and crypto kept out of
   set-off. MOD-02 asks and records the answer. An answer that differs from the build is new work (a patch revision,
   tests, financial review). PD-01, PD-04 and PD-44 (the other D-040 defaults) do not block the merge; they block the
   batch's sign-off. [VERIFIED: CR-0008 line 554; [DECISION_LOG.md](../project-control/DECISION_LOG.md) PD-01 to PD-04,
   PD-44]
2. **The readiness rule, not a fixed order.** Whichever change passes Gates A to D first merges first; the second
   takes `main` and keeps both sides' rows ([merge readiness rule](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#merge-readiness-rule)).
   A merge simulation with NB-01's M1.4 branch gives text conflicts in `docs/DECISIONS.md` (1 hunk),
   `docs/KNOWN_ISSUES.md` (2) and `docs/PROJECT_STATE.md` (1); `CHANGELOG.md` and `docs/TESTING.md` merge cleanly; no
   code file is changed by both. [VERIFIED: `git merge-tree`, 28 Oct]
3. **Branch for the PR.** Either the continuation branch (release-check only warns: TC-23) or a `fix/` branch created
   at the same commit, without rewriting history (REC-03). MOD-02 decides.
4. **Gates.** A, B (ARC-01 GO, financial approve, security GO), C (section 9.5 and 9.6), CI green on the PR (both
   jobs), then MOD-02's explicit "go to merge".
5. **The D-020 merge** in the main checkout, clean and equal to `origin/main`: `git merge --no-ff` with the message
   `Merge pull request #N from productsteamcentricity/<branch>`, a blank line, the PR title, a blank line, the
   `Co-Authored-By:` trailer (as on `6443826`); push `main` with the deny-list exported; `release-check.mjs --after-push`.
6. **After the merge (Gate D):** CI green on `main`; the Pages run green; the live `/` MD5 equals the merged
   `index.html`; `/next/` unchanged; the merge SHA, run ids and hashes reported to MOD-02, who records the baseline row
   and the gate rows and tells NB-01 to take `main`. TA-05 may then start.
7. **Gate E:** the owner accepts the visible tax changes on the live link, through MOD-02.

**If `main` moves first.** Merge `origin/main` into the branch (never rebase). If only docs or `app/` changed (M1.4
leaves `index.html` at `12B5E572` [VERIFIED]), resolve the four document hunks in number order and keep both rows. If
`main`'s `index.html` changed (another fix or the October refresh), rebuild the page as section 9.1 does, from the new
main page plus the five tax patches; revise an anchor only where a patch refuses, as the rebase did; record every new
MD5; regenerate `data/refdata`; re-run every check.

**Rollback after a merge.** On a new branch, `git revert -m 1 <merge sha>`, PR, CI, D-020 merge; prove the page with
`check-invariants --expect-md5 12B5E5727FCA01EF2EA162C59913F01D`. Full procedure:
[integration log](../project-control/INTEGRATION_AND_REGRESSION_LOG.md#7-recovery-procedure).

## 10. TA-05: fix batch 5

**PLANNED. Starts only after TA-03 merges** (both patch the engine block). Card:
[TA-05](../project-control/TASK_REGISTER.md#ta-05-fix-batch-5-ki-183-d-042). Not part of TA-03.

| Part | Scope | Evidence |
|---|---|---|
| KI-183 (EX-01's range) | `computeReview` throws when an Asset Name (4 of 5 test words; the fifth leaks text), Client, Category or Product Name (5 of 5) equals an `Object.prototype` key such as `constructor` or `toString`; AMC (1 of 5) and Distributor (4 of 5) labels leak prototype text; Instrument is unaffected. Fix: prototype-safe keyed maps (`Object.create(null)`, `Map` or own-property checks) at every keyed lookup in `computeReview` and its matrices; the regression test is the probe, 7 fields by 5 keys | [VERIFIED: reproduced 28 Oct on `12B5E572` and on `5F1C2FC5` with the synthetic probe `C:\dev\private\handover\mod-01-scratch\ki151-probe.js`] |
| Twin defect | NB-01's KI-151 is the same defect in the new app (handled with Maps on its branch). One id per build, each citing the other (TB-27); G1's test already cites KI-183 | [VERIFIED: `git show 4610684:tests/regression/ki-151-prototype-labels.test.ts`] |
| D-042 (EX-01's range) | Amends D-041 point 4 with the owner's KI-147 answer of 24 Oct, "no fallback": a Crore cell holding text that is not a number makes the holding invalid, excluded and listed. Today point 4 lets it fall through to the Lakh or rupee column. D-039 point 1 on NB-01's branch applies the rule to **invested value, market value and gain** alike, so D-042 mirrors all three. Whether placeholders such as "NA", "N/A", "-" and "nil" count as blank and fall back (as D-039 1(b)(c) builds) is **PD-09** | [VERIFIED: D-041 on `main`; D-039 on `07a6460`; INFERRED: the mirroring] |
| Parity ledger | NB-01's KI-147 entries are **AG-13 and AG-14** on G1 `4610684`. Whichever of TA-05 and M1.4 merges second retires them in `tests/parity/aggregation-ledger.json` **and** adds them to the pinned retired list at `tests/parity/aggregation.parity.test.ts:68`; otherwise "every entry used" fails. The ids are final only after NB-01 integrates G1 | [VERIFIED: `git show 4610684`; INFERRED: finality] |
| Contract | Write the change-impact contract first; a filled example for TA-05 is in [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#change-impact-contract-template) | |
| Accept when | the probe shows no throw and no leaked text for all six label kinds; new regression files pass; the TA-03 check list passes; financial review and browser QA pass; ARC-01 GO; CI green; D-020 merge; Pages verified | |

## 11. TA-10: the October 2026 refresh

**BLOCKED** on the owner's files, then on the owner's "publish". Card:
[TA-10](../project-control/TASK_REGISTER.md#ta-10-october-2026-monthly-refresh). Owner: MOD-02 assigns it to EX-01,
which runs the `refresh-operator` agent.

**State on 28 Oct** [VERIFIED: listing and `git branch -a`]: the October inbox holds only the owner's TY 2026-27 tax
reckoner and the MF Screener packs; the `Analytics` and `Index TRI` subfolders are empty; there is no
`data/2026-10-refresh` branch and no `docs/refresh-log/2026-10.md`. The reckoner and the Screener packs are not refresh
inputs: leave them where they are, and never put a Screener pack or score in the repository (D-026).

**Inputs expected** between 11 and 17 Nov 2026: the runbook's window is the 13th to the 17th, and the owner's 23 Oct
answer starts it on the 11th, so be ready from 11 Nov. The files (MONTHLY_REFRESH Part 1):
- from the vendor: the Daily MF Monitor (Regular and Direct), the SIF Monitor, the Expense Ratio file, the Equity,
  Hybrid and Debt Analytics, the Listed Direct Equity master, and the Listed Direct Equity returns issue (often a day or
  two later);
- from the research team: the Monthly Outlook deck (label month "Nov 2026");
- downloaded by the owner: five Total Return Index files (Nifty 50, 100, 500, Midcap 150, Smallcap 250);
- when available: Fund Manager history, PMS and AIF performance, the PMS and AIF Analytics workbook, Fund Ranks, tax
  rule, IPS or slide changes.

**Plan.**
1. When the owner says the files are in, MOD-02 assigns TA-10. Branch `data/2026-10-refresh` from `main` **as it is
   then** (after TA-03 and TA-05 if they have merged). Session values: `M=2026-10`, `PREVM=2026-09`,
   `ASON="31 Oct 2026"`, `PREVASON="30 Sep 2026"`, `LABEL="Nov 2026"`.
2. Runbook Steps 0 to 9, filling `docs/refresh-log/2026-10.md`. Stop and ask the owner on any intake red flag, and stop
   and report if an unexpected sensitive file is in the inbox.
3. **Step 4, the risk ratios (TA-20):** only if the owner has answered PD-20 (monthly public AMFI NAV download) and
   PD-21 (where the previous owner's risk toolchain may live). Otherwise skip Steps 4 and 7a: MF_RISK stays at 30 Sep
   and the PR and the summary say so. The runbook's Step 4 text ("has not arrived") is stale (TA-08).
4. **Step 7d (FUND_RANKS): do not run.** The ranks are Screener-class data (D-026) and PD-26 is open. Step 7e items
   (AIF_PERF, the look-throughs, tax rules, IPS, slides) need a change request agreed with the owner. PD-29 asks the
   owner about embedding the 31 Aug PMS file and other second-export points before this refresh.
5. Step 8: `check-invariants`, smoke, AI Analyst, `node scripts/data-extract.ts` then `--check`, and commit the
   regenerated `data/refdata` (D-035); also run-regression and `node --test` (NB-01's parity fixtures read the data)
   [INFERRED: the runbook's Step 8 predates them]. Browser check with `family-isolation.js`.
6. Step 9: security review of the diff (only `index.html`, the log, its README row, CHANGELOG, `data/refdata`, and any
   reviewed pipeline fix; never vendor files or snapshots), PR "October 2026 data refresh (data as on 31 Oct 2026)",
   summary to the owner through MOD-02. **Wait for "publish"** (Gate E before Gate D).
7. Step 10 after "publish" and MOD-02's go: D-020 merge; live size and SHA-256 equal `main`'s; archive the month;
   next inbox; log "published"; PROJECT_STATE. Then TA-21: the first monthly PRD (from `docs/monthly-prds/TEMPLATE.md`)
   and the `docs/HANDOVER.md` "Last refreshed" line, checked by `monthly-prd-check.mjs`.

**Ordering.** The refresh splices new data into `index.html`. Any branch still open when it merges takes the new
`main` and rebuilds its page (section 9.8). The pipeline's snapshot step reads a base file: use the synthetic check
portfolio the runbook generates, and keep `buildtools/out/` local (it is git-ignored and can hold client holdings).

## 12. The rest of Workstream A

Details, owners and acceptance in [TASK_REGISTER.md](../project-control/TASK_REGISTER.md).

| Task | What | Status | Waits for |
|---|---|---|---|
| TA-06 | KI-184: the base file's ISIN column is never read (live reader and new reader) | EXISTING DEFECT (to be filed in TA-03) | a parity-ledger update with NB-01 |
| TA-07 | KI-177 step 2: grandfathering for lots bought before 1 Feb 2018 | BLOCKED | PD-05 (CR-0008 question 12); TA-03 merged |
| TA-08 | Apply the second export's updates to the repository records | NOT STARTED | a docs PR after TA-03 and M1.4 merge; TC-16 recorded |
| TA-09 | The owner's second-export requests C2 to C6 (debt sleeves in YTM and duration; top-20 issuers summing to 100%; aliases; PMS and AIF performance) | NOT STARTED, no CR (next free CR-0010) | PD-28, PD-36 |
| TA-11 | Handover check 7: decks and workbooks in PowerPoint and Excel | NOT STARTED ("Partial") | none |
| TA-12 to TA-18 | Audit batches 2 to 7; unbuilt OD items | NOT STARTED | the owner's priorities |
| TA-19 | KI-066 IPS verdicts (P0) | EXISTING DEFECT; decision unclear | PD-10 |
| TA-20 | October risk-ratio step | BLOCKED | PD-20, PD-21 |
| TA-21 | First monthly PRD and HANDOVER refresh | PLANNED | TA-10 |
| TA-22 | `check-invariants.js` ENGINE_KEYS lacks `amcKey`, `xirr` and the tax keys | EXISTING DEFECT (tooling) | KI-185 if MOD-02 agrees |
| TA-23 | The documented rebuild rule fails on HEAD; `.blocks/` and line counts stale | EXISTING DEFECT (docs and tooling) | none |
| TA-24 | 15 Aug FUND_RANKS scores inside the public live page | BLOCKED | PD-26 (recommended: leave until switch-over) |
| TA-25 | Dashes in generated sentences; overlap threshold 40% live against 35% (D-030) | UNKNOWN / NEEDS INVESTIGATION | PD-31 |

## 13. Open known issues

Summary and counts: [KNOWN_ISSUES_AND_REGRESSION_RISKS.md](../project-control/KNOWN_ISSUES_AND_REGRESSION_RISKS.md).
The register itself is [docs/KNOWN_ISSUES.md](../KNOWN_ISSUES.md).

- **On `main` (the live page):** 148 ids; 26 fixed, 2 partly fixed (KI-015, KI-062), 118 open, plus KI-044 (no longer
  reproduces) and KI-135 (duplicate). [VERIFIED: parse of `origin/main:docs/KNOWN_ISSUES.md`, 28 Oct]
- **Open P0 (13, plus KI-062 in part):** KI-049, KI-050, KI-051, KI-052, KI-053, KI-054, KI-056, KI-057, KI-058,
  KI-059, KI-060, KI-064 and KI-066, and KI-062 (part). Not a range: KI-055 was fixed in fix batch 1a.
- **About 25 open P1 issues**, listed in the summary file's section 3.
- **Fixed only on the TA-03 branch:** KI-160 to KI-182 (KI-177 in part), KI-099, KI-130, KI-037 in part, KI-022. On the
  live page they are all still present until TA-03 merges.
- **Found, not filed:** KI-183 (TA-05), KI-184 (TA-03 docs), the ENGINE_KEYS gap (KI-185 suggested), the rebuild rule
  (TA-23).
- **Register entries to correct** (TA-08, TC-15): KI-006 still calls OD-26 open (PD-18); KI-022's heading on the
  branch; KI-066's "waits for the owner" wording (PD-10); the second export's KI-046, KI-016, KI-005, KI-026 points.

## 14. Owner questions for Workstream A

Each is explained in plain language in [DECISION_LOG.md](../project-control/DECISION_LOG.md) section 2. None was
answered by 28 Oct. EX-01 never asks the owner directly; MOD-02 does, and relays the answer.

| PD | Question in short | Recommendation (not a decision) | Blocks |
|---|---|---|---|
| **PD-02** | CR-0008 Q17: are the "Listed AIF" funds Category III? | Keep the neutral note until the AIF documents confirm | **TA-03 merge** (or the owner accepts the safe defaults) |
| **PD-03** | CR-0008 Q18: may crypto gains or losses be set off? | Keep "no set-off" until the tax adviser answers | **TA-03 merge** (same) |
| PD-01 | Accept the D-040 defaults (a) to (h) | Accept as built | TA-03 sign-off |
| PD-04 | The other CR-0008 questions (Q2 to Q11, Q13 to Q16, Q19, Q20) | Accept the built defaults; send Q2, Q3, Q13 to Q15 to the tax adviser | none |
| PD-44 | The other D-040 defaults settled while building (usual buckets, SIF rows, ELSS lock-in, holdings with no client name as one person, the three not-split kinds, "tax years" and more) | Accept as built | TA-03 sign-off |
| PD-06 | A fund holding one equity ETF: 90/90 by default on the live page? | Live: keep the default with a note | consistency with the new build |
| PD-07 | The slab rate used to order set-off | Live: 30%, labelled "assumed" | consistency |
| PD-43 | The tax adviser to confirm OD-28 (Sec 76, old 50AA) | Accept the reckoner | none |
| PD-05 | Grandfathering rule (Q12) | Ask the tax adviser | TA-07 |
| **PD-09** | KI-147: do placeholders such as "NA" count as blank? | Yes, so both builds match | **TA-05** (D-042) and the M1.4 PR |
| PD-08 | D-041 question 1: holding days of a fund held in several folios | (a) as built | KI-148 alignment |
| PD-42 | Confirm the fix batch 4 choices: total rows skipped; "Commodities" read as Commodity; a blank Asset label stays Equity on the live page; a merged holding with a blank-unit folio left unsplit in Taxation | Confirm | none |
| PD-10 | KI-066: change the IPS check now on the live page? | If no answer, keep current; build in the new build | TA-19 |
| PD-11, PD-12, PD-14 | Unknown Asset Names (BF-19); letter case of Asset Names (BF-26); a market value of 0 | Unknown and listed; keep folding; exclude and list | both readers |
| PD-17 | Confirm the fix batch 2a details | Confirm | none |
| PD-18 | (record fix) KI-006 calls OD-26 open | Correct the record | TC-15 |
| PD-20, PD-21 | AMFI NAV download; where the risk toolchain lives | Yes; a short local folder outside the cloud folder and the repository | TA-20 |
| PD-26 | Remove the 15 Aug FUND_RANKS scores from the live page now? | Leave until switch-over | TA-24 |
| PD-28, PD-36 | C2 to C6 on the live page or the new build; each new alias | Calculation items live, presentation items new; per alias | TA-09 |
| PD-29 | Other second-export decisions | Answer before the October refresh | TA-10 |
| **PD-30** | Confirm the "publish" gate | Confirm | **TA-10** |
| PD-31 | Dashes in sentences and the overlap threshold on the live page | Leave both to the new build | TA-25 |
| PD-37, PD-38 | AI Analyst weights in force for now; the live deck order | Yes; leave as is | none |
| PD-46 | Any request made outside these chats between 24 and 27 Oct | Tell MOD-02 | none |

## 15. Risks

From the [regression-risk register](../project-control/KNOWN_ISSUES_AND_REGRESSION_RISKS.md#7-regression-risk-register),
the ones that bear on Workstream A:

| Risk | What could go wrong | Mitigation |
|---|---|---|
| RR-09 | The tax batch has never run in CI, has no browser QA of the combined page, and T5 is unreviewed; wrong client tax figures could go live | CI now (section 9.7); the full list on the final page in IST and UTC; financial review; browser QA; pre-push on the final head; Gate B |
| RR-07 | Two agents wrote in one worktree during T5 | One writer per worktree; re-derive `5F1C2FC5`; review every edit against the header |
| RR-15 | New per-family state leaks between clients; the T3 harvest-assumption reset has never run in a browser | `family-isolation.js` 11 checks on the final page |
| RR-02 | TA-05 written before TA-03 merges must redo its anchors | TA-05 starts only after TA-03 merges |
| RR-03 | The shared documents conflict with M1.4 (4 hunks); rows can be lost | The second to merge keeps both sides; ARC-01 checks the merged files |
| RR-04 | NB-01's "every ledger entry used" test fails when "no fallback" lands | AG-13 and AG-14 retired with the pinned list by whichever merges second |
| RR-08 | A live change to `parseBaseRows`, `computeReview` or REFDATA turns NB-01's CI red | Run `node --test` and `data-extract --check`; update ledgers in the same PR |
| RR-10 | The October refresh changes the page under every open branch | Start it from `main` after TA-03 and TA-05; open branches rebuild their pages |
| RR-11 | The live TAX_RULES and the new build's TR table drift apart | The D-040 cross-reference; KI-170 test; financial review of either table's change |
| RR-12, RR-13, RR-14 | ENGINE_KEYS incomplete; the rebuild rule and line counts stale; marker strings copied in 7 places | TA-22, TA-23; never change a marker |
| RR-16 | A push scanned without the private deny-list | Export `PRD_PRIVACY_DENYLIST` in the pushing shell; check the scan output says it was applied |
| RR-18 | release-check warns on `continuation/` branches | Accept the warning or use a `fix/` branch at the same commit (MOD-02 decides) |
| RR-19 | `main` is unprotected and the AC-22 force-push check does not exist | Discipline only: never force-push or rewrite history |
| RR-23 | Deck pagination constants are calibrated | Presentation changes go to the new build (D-028) |
| (privacy) | `render-slides.js` and the refresh snapshots can produce client outputs | Synthetic files only; outputs outside the repository or in git-ignored folders |

## 16. Who does what in Workstream A

| Who | Does | Does not |
|---|---|---|
| Owner | decides product and financial rules; says "publish" for each refresh; accepts visible changes | run git |
| MOD-02 | assigns Workstream A tasks; allocates numbers; asks the owner; gives "go to merge"; keeps the registers (single writer of `docs/project-control/`) | implement in EX-01's worktree |
| ARC-01 | Gate B review of every material diff; may block with a NO-GO | implement; decide product questions |
| **EX-01** | builds in its own worktree and branch; writes the change-impact contract; runs Gates A and C; pushes; opens the PR; after MOD-02's go, green CI and ARC-01's GO, performs the D-020 merge and verifies Pages; files and fixes live-page defects | start an unassigned task; edit Workstream B files (`app/`, NB-01's tests and docs); edit `docs/project-control/` |
| NB-01 | the new build; takes `main` after TA-03 merges; supplies the final AG ids for TA-05 | edit `index.html` or Workstream A files |
| Specialist agents | `financial-domain-reviewer`, `qa-engineer`, `security-release-reviewer`, `implementation-engineer`, `dashboard-archaeologist`, `refresh-operator` (in `.claude/agents/`) review, test, implement or refresh when EX-01 runs them | commit, push or merge on their own |

- **EX-01's files:** `index.html` (through `tools/patches/` only), `tools/patches/*`, `tools/regression/*`, `tools/*.js`,
  `tools/browser-checks/*`, `docs/legacy/*`, `docs/audits/*`, the Workstream A change requests, and `buildtools/*`
  with `docs/refresh-log/*` for refreshes. It regenerates `data/refdata/*` whenever REFDATA changes. Shared hotspots
  (DECISIONS, KNOWN_ISSUES, PROJECT_STATE, CHANGELOG, TESTING, CLAUDE.md, the parity ledgers, the workflows) follow
  [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md).
- **EX-01's numbers:** D-042 to D-045 (D-042 = "no fallback", amending D-041 point 4) and KI-183 to KI-186 (KI-183 =
  prototype-key labels; KI-184 = base-file ISIN column not read). It inherits D-040 and KI-160 to KI-182 on the TA-03
  branch. More numbers come only from MOD-02. CR numbers: MOD-02 allocates (next free CR-0010).
- **EX-01's ports:** 8133 to 8135.
- **Context health:** hand over at 3 compactions, or when the owner reports lost context, following
  [continuations/README.md](continuations/README.md).

## 17. What this handover could not establish

| Item | Why it matters | Where tracked |
|---|---|---|
| Whether MOD-01's original T5 brief named anything beyond the nine entries of section 9.3 | an item could be missing from T5 | TA-03 card |
| Whether T1 and T2 ever had their own browser check, and whether the part T4 financial check took place | the records lag the commits | TA-03; section 9.6 asks for both |
| `node --test`, docs-links, traceability and the pre-push scan at `0f1c5d3` | never run there | section 9.5 |
| How a dispatched CI run treats release-check | evidence quality of an early run | section 9.7 [INFERRED] |
| Whether the second export's answer "keep current IPS logic for now" is the current owner's | decides TA-19 | PD-10 |
| Whether the second export's independent check (an HTTP 401 failure, never rerun) matters for TA-08 | parts of that export may be unverified | TC-16 |
| Whether `release-check` accepts an `index.html` change made by a revert | matters only for a rollback | integration log section 7 |
| Which category strings real AIF rows carry, and which marker real base files use for foreign shares | edge cases of T5 item 4 and D-040 (c) | CR-0008 questions 4 and 17 |

## 18. Change log

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | Version 1, for the MOD-01 to MOD-02 handover and EX-01's start on TA-03 |
