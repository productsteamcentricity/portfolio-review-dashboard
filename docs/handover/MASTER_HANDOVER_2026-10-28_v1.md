# Master handover, 28 Oct 2026 (version 1)

| Field | Value |
|---|---|
| Document | `docs/handover/MASTER_HANDOVER_2026-10-28_v1.md` |
| Written | 28 Oct 2026 (IST) by **MOD-01**, the coordinating chat "Portfolio Review Dashboard architecture" |
| Handover | MOD-01 (status HANDOVER REQUIRED) to **MOD-02** (status QUEUED). MOD-01 becomes RETIRED only after MOD-02 validates this handover |
| Also hands over | Task TA-03 (the tax batch) from MOD-01 to **EX-01** (QUEUED) |
| Branch | `handover/mod-01-to-mod-02-20261028`, based on `main` at `6443826` |
| Supersedes | [`docs/HANDOVER.md`](../HANDOVER.md) as the entry point. That file is a snapshot of 23 Oct 2026 and stays as history |
| Index of all handover files | [README.md](README.md) in this folder |
| Private part | `C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md` on the owner's laptop, outside the repository. Everything that must not be public is there and only there |
| Anchors re-checked | 28 Oct 2026, 13:07 IST, by the writer of this file (section 3) |

**Evidence labels.** [VERIFIED] means checked with a command or a file, and the evidence is named. [INFERRED] means
reasoned from verified facts. [UNCERTAIN] means the evidence points both ways. [UNKNOWN] means there is no evidence.
A claim without evidence is never written as verified.

**Status words for work** (the owner's list, used exactly): VERIFIED COMPLETE; IMPLEMENTED, NOT FULLY VERIFIED; IN
PROGRESS; PLANNED; BLOCKED; NOT STARTED; EXISTING DEFECT; UNKNOWN / NEEDS INVESTIGATION; SUPERSEDED.

**This document is a snapshot.** Git is the authority. Old snapshots, this one included, are not proof of the current
working tree, branch or integration state. Before acting on any SHA, MD5 or status here, run the checks in
[REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md#verify-before-you-trust).

## Contents

1. [How to use this document](#1-how-to-use-this-document)
2. [The project in one page](#2-the-project-in-one-page)
3. [Current anchors](#3-current-anchors)
4. [History: from the previous owner's dashboard to today](#4-history-from-the-previous-owners-dashboard-to-today)
5. [Source and destination repositories](#5-source-and-destination-repositories)
6. [Architecture in brief](#6-architecture-in-brief)
7. [Workstream A: the existing dashboard](#7-workstream-a-the-existing-dashboard)
8. [Workstream B: the new build](#8-workstream-b-the-new-build)
9. [Every requested improvement](#9-every-requested-improvement)
10. [Verified facts, inferences and unknowns](#10-verified-facts-inferences-and-unknowns)
11. [Technical decisions](#11-technical-decisions)
12. [Blockers and pending owner decisions](#12-blockers-and-pending-owner-decisions)
13. [Main risks](#13-main-risks)
14. [How the project is run from now on](#14-how-the-project-is-run-from-now-on)
15. [Immediate execution plan](#15-immediate-execution-plan)
16. [What this handover could not establish](#16-what-this-handover-could-not-establish)
17. [Change log](#17-change-log)

## 1. How to use this document

This is the one document a new Moderator reads first. It tells the whole story briefly and points to the registers for
the detail. It does not repeat the long tables: those live in `docs/project-control/`, and each register is the
single place its subject is kept.

| If you need | Read |
|---|---|
| How the project is run: roles, who decides what, gates A to E, the update rule | [project-control/README.md](../project-control/README.md) |
| Which chats exist, their status and worktrees | [CHAT_REGISTRY.md](../project-control/CHAT_REGISTRY.md) |
| Every task with its owner, status, evidence and next step | [TASK_REGISTER.md](../project-control/TASK_REGISTER.md) |
| What is being changed right now and where changes overlap | [ACTIVE_CHANGE_REGISTER.md](../project-control/ACTIVE_CHANGE_REGISTER.md) |
| Who owns which files; the merge readiness rule; number ranges; ports | [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md) |
| Branches, worktrees, hooks, CI, runtimes, and the read-only checks to run first | [REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md) |
| Every owner requirement, change request and suggested improvement | [REQUIREMENTS_AND_CHANGE_REGISTER.md](../project-control/REQUIREMENTS_AND_CHANGE_REGISTER.md) |
| Decisions, the 46 pending owner decisions in plain language, and recommendations | [DECISION_LOG.md](../project-control/DECISION_LOG.md) |
| Open defects and the regression-risk register | [KNOWN_ISSUES_AND_REGRESSION_RISKS.md](../project-control/KNOWN_ISSUES_AND_REGRESSION_RISKS.md) |
| How both builds fit together; high-risk files | [ARCHITECTURE_AND_DEPENDENCY_MAP.md](../project-control/ARCHITECTURE_AND_DEPENDENCY_MAP.md) |
| Every shared interface and its change rule | [INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md) |
| What was merged, the last good baseline, the recovery procedure, gate records | [INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md) |
| The narrative project state | [docs/PROJECT_STATE.md](../PROJECT_STATE.md) (authoritative for its subject, but several lines are stale: TC-15) |
| Rules for every change | [CLAUDE.md](../../CLAUDE.md) |

The same story from each workstream's side, and the copy-ready prompts for the next chats, are listed in
[README.md](README.md) in this folder.

## 2. The project in one page

**The product.** The Centricity Portfolio Review Dashboard is one offline HTML file (`index.html`, about 16.8 MB) that
turns one client holdings workbook (the "base file") into a full portfolio review: 20 tabs, a PowerPoint deck in the
house style and an Excel workbook. Analysts of the Products Team use it. Client data never leaves the browser. A data
owner refreshes the embedded vendor data each month. [VERIFIED: [docs/HANDOVER.md](../HANDOVER.md) section 1;
[docs/legacy/ARCHITECTURE.md](../legacy/ARCHITECTURE.md)]

**Two workstreams** (owner, 27 Oct, section 6 of the handover prompt; REQ-072):

| Workstream | What | Where it runs | State on 28 Oct |
|---|---|---|---|
| **A. Existing dashboard** | The live `index.html`. During the parallel run it takes calculation, data and security fixes only (D-028) | GitHub Pages `/` | Live and equal to `main`. Five fix batches merged. The tax batch (TA-03) is IN PROGRESS on a pushed branch |
| **B. New build** | A clean rebuild with feature parity (CR-0006), in `app/`, built into one offline file | GitHub Pages `/next/`, with a "Preview, not for client use" banner (D-024) | Milestones M1.1 to M1.3, the tabs and the capital-gains design are merged. M1.4 is IN PROGRESS on a **local-only** branch |
| C. Coordination | Governance, records, handovers, owner decisions | `docs/project-control`, `docs/handover` | This handover package (TC-01), IN PROGRESS |

**The people and chats.** The owner is the product owner and decides product behaviour and financial rules. Claude
runs the technical work (REQ-002, D-033). On 28 Oct two chats exist: MOD-01 (this one) and NB-01 (the new build).
Three are planned: MOD-02 (the successor Moderator), EX-01 (Workstream A implementation, starting with TA-03) and
ARC-01 (the Codebase Integrity and Integration Guardian). Details: [CHAT_REGISTRY.md](../project-control/CHAT_REGISTRY.md).

**Why this handover now.** MOD-01 has been through 4 context compactions; the owner's rule is to hand over after 3.
On 27 Oct at 20:55 IST the owner ordered every chat to stop implementation and build a verified handover package.
[VERIFIED: the chat transcript's compaction entries, counted by timestamp only on 28 Oct; REQ-070, REQ-076]

## 3. Current anchors

Re-checked on 28 Oct 2026 at 13:07 IST with read-only commands. If any value differs when you read this, the
repository has moved: record the difference before acting.

| Anchor | Value | Evidence |
|---|---|---|
| `main` = `origin/main` | **`6443826`**, the merge of PR #16 (fix batch 4), 27 Oct 18:13 IST | [VERIFIED: `git rev-parse main origin/main \| cut -c1-7` gives `6443826` twice (re-run 30 Oct); `git ls-remote origin refs/heads/main` gives `644382621f40...`] |
| Live page `/` | **16,837,249 bytes, MD5 `12B5E5727FCA01EF2EA162C59913F01D`**, equal to `main`'s `index.html`; Pages verified 27 Oct after the merge | [VERIFIED: `curl -s <site>/ \| md5sum` and `git show 6443826:index.html \| md5sum`, both `12b5e572...`, 28 Oct] |
| Preview `/next/` | **46,905 bytes**, unchanged since PR #14 | [VERIFIED: `curl -s <site>/next/ \| wc -c`, 28 Oct] |
| TA-03 continuation branch | `continuation/ex-01-task-ta-03-20261027` at **`0f1c5d3`**, **pushed**, equal to origin. Parent **`97a7d69`** (`fix/legacy-batch-3-tax-p3-r2`, local only, contained in the continuation branch). Page MD5 `0713C6BE...` at `97a7d69` and `5F1C2FC5...` at `0f1c5d3` | [VERIFIED: `git ls-remote origin` gives `0f1c5d35a4ac...`; `git rev-parse 0f1c5d3^1`; `git show <sha>:index.html \| md5sum`] |
| NB-01 M1.4 branch | `feat/m1-4-overview` at **`07a6460`**, **LOCAL ONLY**, 23 commits ahead of `origin/main` | [VERIFIED: `git rev-list --count origin/main..feat/m1-4-overview` = 23; `git branch -r --contains 07a6460` is empty; not in `git ls-remote origin`] |
| NB-01 round-2 fixer branches | `worktree-wf_bdc6c774-599-1`, `-2`, `-3` at **`4610684`** (G1), **`be7f395`** (G2), **`202f8f6`** (G3), **LOCAL ONLY** | [VERIFIED: `git rev-parse`] |
| Handover branch | `handover/mod-01-to-mod-02-20261028`, local, based on `6443826` | [VERIFIED: `git rev-parse --short HEAD` in its worktree] |
| Baseline tag | `legacy-baseline-782794f` on `782794f` (page `EF2FF4F1`, after fix batch 1b) | [VERIFIED: `git rev-parse legacy-baseline-782794f^{commit}`] |
| Repository | `https://github.com/productsteamcentricity/portfolio-review-dashboard`, public, `main` unprotected by the owner's choice (D-033) | [VERIFIED: repo-env investigation, `gh api`, 28 Oct] |

Site: `https://productsteamcentricity.github.io/portfolio-review-dashboard/` (live) and `.../next/` (preview).

## 4. History: from the previous owner's dashboard to today

Dates are IST. Each row is [VERIFIED] from the named record unless it says otherwise. Merge SHAs and page MD5s for
every pull request are in [INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md)
sections 2 and 3.

| When | What happened | Record |
|---|---|---|
| May to Oct 2026 | The previous owner built the dashboard with Claude (Cowork until 26 Jul, then Claude Code): one offline HTML file with 20 tabs, a deck and a workbook, vendor data as on 30 Sep 2026. Their final build is commit `cab22e6` of their own repository, page MD5 `173F86CA...`, 16,765,556 bytes | [previous-owner/README.md](../previous-owner/README.md); [PROJECT_HISTORY](../previous-owner/handover/PROJECT_HISTORY_Portfolio_Review_Dashboard.md); [REPLICATION_REPORT.md](../REPLICATION_REPORT.md) section 1 |
| 14 Oct | The owner's master project prompt starts MOD-01. The previous owner's handover PRD, project history and vendor archive arrive. **Stage A replication** (CR-0001): `511f554` imports `cab22e6` byte for byte with two client-name scrubs outside `index.html`, `a4f8d0d` adds tooling, `af96042` docs and agents. Fresh git history (D-002). Decisions D-001 to D-014 | [CR-0001](../change-requests/CR-0001-baseline-replication.md); [REPLICATION_REPORT.md](../REPLICATION_REPORT.md) |
| 15 Oct | KI-001 fixed: a new base file inherits nothing (PR #1, page `F0EB0101`, D-015). First export from the previous owner taken in; repository organised; monthly refresh pipeline restored, and September rebuilt byte for byte (PR #2, CR-0003). The owner rules that the previous owner's site stays live until the new build is fully tested (REQ-021) | [CR-0002](../change-requests/CR-0002-ki001-family-isolation.md); [CR-0003](../change-requests/CR-0003-organise-and-monthly-process.md); [refresh-log 2026-09](../refresh-log/2026-09.md) |
| 16 Oct | The owner asks for the dashboard's issues to be found and fixed (CR-0005) | [CR-0005](../change-requests/CR-0005-audit-fixes-and-redesign.md) |
| 19 Oct | Full audit: 67 issues (52 new, KI-047 to KI-098), owner questions OD-1 to OD-28 (PR #3). The owner accepts OD-1 to OD-28 except OD-11 (D-021, PR #5). Fix batch 1a (PR #4, page `FB6676DC`) and 1b (PR #6, page `EF2FF4F1`, tag `legacy-baseline-782794f`). D-020 sets the local `--no-ff` merge method | [audits/README.md](../audits/README.md); [CR-0005](../change-requests/CR-0005-audit-fixes-and-redesign.md) |
| 21 Oct | The owner's new-build brief (CR-0006). OD-29 to OD-36 accepted (D-022) | [00-owner-brief.md](../new-build/00-owner-brief.md); [CR-0006](../change-requests/CR-0006-new-build.md) |
| 22 Oct | Phase 0 of the new build delivered (PR #8). The owner answers ND-1 to ND-10, recorded as D-024 to D-033, and puts Claude in full charge of GitHub and the dashboard (D-033). Fix batch 2a merged (PR #9, page `911A0465`, CR-0007). M1.1 records (PR #10). NB-01 is created at 21:47 IST | [owner-decisions-new-build.md](../new-build/owner-decisions-new-build.md); [CR-0007](../change-requests/CR-0007-legacy-batch-2a.md) |
| 23 Oct | The previous owner's second export ("R2") arrives and is taken in privately on 24 Oct. M1.1, M1.2 and M1.3 merged (PRs #11 to #13): the npm toolchain, the one-file build, the shared model, the base-file reader, `data/refdata` and the first `/next/`. NB-01 takes code ownership of the new build. D-034, D-035, D-036 | [CR-0004](../change-requests/CR-0004-second-export-request.md) (index row stale); [CHANGELOG.md](../../CHANGELOG.md) |
| 24 Oct | The tax batch starts (CR-0008, D-040, findings KI-160 to KI-182). The owner answers KI-147 in the NB-01 chat: "no fallback". The owner asks for the section tabs to change (D-037) | CR-0008 and D-040 exist only on the continuation branch [VERIFIED: `git show origin/continuation/ex-01-task-ta-03-20261027:docs/DECISIONS.md`] |
| 27 Oct | Tabs across the top approved at 11:43 IST and merged (PR #14). Capital-gains upload design merged (PR #15). Fix batch 4, base-file reading, merged at 18:13 IST (PR #16, `6443826`, live page `12B5E572`). At 20:55 IST the owner orders a stop and a full handover. At 20:59 IST the tax batch is checkpointed as `0f1c5d3` on the continuation branch, which is then pushed. NB-01 stops and writes a state report (20:59 to 21:01 IST; received by MOD-01 about 21:05 IST) | [INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md); `git log -1 0f1c5d3` |
| 28 Oct | MOD-01's handover investigation; the project-control registers and this package are written on the handover branch | this branch |

## 5. Source and destination repositories

| | Source (the original) | Destination (this project) |
|---|---|---|
| What | The previous owner's own **public** GitHub repository, one branch and no tags | `productsteamcentricity/portfolio-review-dashboard`, **public**, default branch `main` |
| State used | `main` at `cab22e6747c02b87f0f95466874b3209edc5da22`, received on 14 Oct as a GitHub archive whose comment names that commit. The previous owner's live site served the same file | Fresh history from the root commit `511f554` (D-002); the previous history was not imported. Pages publishes `index.html` at `/` (D-007) and the new app at `/next/` (D-024) |
| Evidence | [REPLICATION_REPORT.md](../REPLICATION_REPORT.md) section 1 names the repository and the commit; [previous-owner-and-requirements.md](../new-build/inputs/previous-owner-and-requirements.md) records that it was public, with Pages on and no push since 14 Oct 08:38 UTC, when checked on 21 Oct [VERIFIED as records; not re-checked on 28 Oct] | `git ls-remote origin`; `gh api` [VERIFIED, 28 Oct] |
| Relation now | Background only. Where the previous owner's documents disagree with this repository's documents, ours win (see [previous-owner/README.md](../previous-owner/README.md)). The previous owner's site still serves build `cab22e6` and stays live until the new build has been fully tested ([DEPLOYMENT.md](../DEPLOYMENT.md); REQ-021) [VERIFIED as a record] | The authoritative source code. Local working copy `C:\dev\portfolio-review`, outside OneDrive (D-001); portable toolchain in `C:\dev\tools` (D-006) |

**What came from the previous owner.** The handover PRD, the project history and the vendor archive (14 Oct); a first
export in three parts (15 Oct); a second export, R2, with the risk-ratio toolchain, sources of record, knowledge notes,
anonymised fixtures, backups and the owner's answers (23 Oct). Only four client-free documents are published here
(D-019): see [previous-owner/README.md](../previous-owner/README.md). Everything else is kept privately; where it is
kept is in the private supplement only. [VERIFIED: `docs/previous-owner/README.md`; the private intake note]

**Not yet reflected in the repository** [VERIFIED]: the R2 intake. `docs/PROJECT_STATE.md` still lists the second
export as a blocker, and `docs/MONTHLY_REFRESH.md` Step 4 still says the risk toolchain "has not arrived" (TA-08,
TC-15). The independent check of R2 reportedly failed with HTTP 401 and was never rerun; no file records it
[UNCERTAIN] (TC-16).

**Contact with the previous owner** goes only through the owner. No chat contacts the previous owner. Never mention
deleting or retiring the existing dashboard in anything addressed to the previous owner (owner, 15 Oct).

## 6. Architecture in brief

Full map: [ARCHITECTURE_AND_DEPENDENCY_MAP.md](../project-control/ARCHITECTURE_AND_DEPENDENCY_MAP.md). Shared interfaces:
[INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md). Authoritative descriptions:
[docs/legacy/ARCHITECTURE.md](../legacy/ARCHITECTURE.md) (live page) and [docs/ARCHITECTURE.md](../ARCHITECTURE.md)
(new app).

**The live page (Workstream A).**
- One HTML file with 13 script blocks. Four are vendored libraries (Chart.js, its data-labels plug-in, SheetJS CE
  0.18.5, PptxGenJS 3.12.0). Three hold data (`window.REFDATA` with 21 reference blocks, divider images, logos). One
  holds the expense-ratio table. Five hold app code: the engine (`window.ENGINE`, block 07), the PowerPoint and Excel
  exporters (08), the reference parsers (09), the UI with 20 tabs (11) and a small boot block (12). [VERIFIED:
  architecture map section 2]
- The app scripts share state only through `window.*` and `ENGINE.*`. Tools find a block by its marker string, never
  by position (CLAUDE.md rule 5).
- Every change to `index.html` is a committed, anchored patch script in `tools/patches/` (D-016). The page is never
  edited by hand.
- Checks in `tools/`: `check-invariants.js`, `smoke-review.js`, `test-ai-analyst.js`, `run-regression.js` and the
  browser checks. The monthly refresh pipeline is in `buildtools/` (runbook [MONTHLY_REFRESH.md](../MONTHLY_REFRESH.md)).
- `data/refdata/` is extracted from the page's `REFDATA` and regenerated in the same change whenever REFDATA changes
  (D-035).

**The new app (Workstream B).**
- TypeScript and Preact in `app/`, built by esbuild into one offline file with a hash-based Content Security Policy and
  no network access (D-034). One shared data model (D-035). Nine sections as tabs across the top (D-037).
- The new base-file reader is checked against the live page through parity ledgers (`BF` rows on `main`, `AG` rows on
  the M1.4 branch). The only remote link is the MF Screener link (D-027).

**What ties the two together** (the source of most cross-workstream risk): one public repository, one CI workflow
with two jobs (`checks` for the live page, `next` for the new app and repository checks), one Pages workflow, the
reference data, the parity ledgers, the vendored library blocks and two tax-rule tables that agree only by hand
(I-21). A live-page change to `parseBaseRows`, `computeReview` or REFDATA can turn the new app's CI job red.
[VERIFIED: architecture map sections 8 and 11]

**Guards.** A pre-push hook runs the privacy scanner of the pushing worktree; the private deny-list
(`PRD_PRIVACY_DENYLIST`) must be exported for the scan to use it. `release-check.mjs` checks a branch before its PR.
CI runs on pull requests, pushes to `main` and by hand (`workflow_dispatch`). Pages publishes only after the live
gates pass, and a failing new-app build never blocks the live page (D-034).

## 7. Workstream A: the existing dashboard

### 7.1 Stage A replication and the baseline

| Item | State | Evidence |
|---|---|---|
| Stage A replication (CR-0001, task TA-00) | **VERIFIED COMPLETE**. `index.html` at the root commit `511f554` is byte-identical to the previous owner's `cab22e6`: MD5 `173F86CAC1E5D0AC8FFD5A66042A3B4C`, 16,765,556 bytes | [VERIFIED: `git show 511f554:index.html \| md5sum` on 28 Oct; [REPLICATION_REPORT.md](../REPLICATION_REPORT.md)] |
| Baseline checks of 14 Oct | Invariants hold (1 warning, KI-027); smoke 26/26 in IST and UTC; AI Analyst 17/17 after the stale test was restored; browser load, review and exports passed; no network requests | [VERIFIED as records: [TESTING.md](../TESTING.md) section 2] |
| Handover acceptance list | Checks 1 to 6, 8 and 9 pass. **Check 7 (open the decks and workbooks in PowerPoint and Excel) is still "Partial"** | [VERIFIED: TESTING.md section 3]; task TA-11 |
| The tag `legacy-baseline-782794f` | Marks the page **after fix batch 1b** (`782794f`, MD5 `EF2FF4F1`). The new build uses it as its legacy parity baseline. It is **not** the Stage A baseline, which is `511f554` | [VERIFIED: `git cat-file -p legacy-baseline-782794f`] |
| Last verified baseline today | `main` `6443826`, live MD5 `12B5E572`; CI and Pages green on it | [INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md) section 1 |

The owner's required sequence (handover prompt section 6) maps onto this project as follows.

| Owner's step | Where this project is | Status |
|---|---|---|
| 1. Validate the handover and inspect the real repository | MOD-02's step 0 (section 15) | PLANNED |
| 2. Complete or resume existing-dashboard replication and verification | Replication done on 14 Oct; check 7 open (TA-11); the tax batch is the open verification work (TA-03) | IN PROGRESS |
| 3. Record and establish the existing-dashboard baseline | Recorded: `511f554` (Stage A), tag `legacy-baseline-782794f` (parity), `6443826` (today). A new baseline row is written at every Gate D | VERIFIED COMPLETE for today; repeats at each merge |
| 4. Reassess the new build against that baseline | The parity matrix and ledgers do this; they must be re-run after TA-03 and TA-05 merge | IN PROGRESS |
| 5. Resume new-build improvements in dependency order | M1.4 completion, then M2 onward (section 8) | PLANNED |
| 6. Integration, testing, documentation, controlled release | Gates A to E (section 14), in force from 28 Oct for every change | IN PROGRESS |

### 7.2 Fix batches

"Fix batch" numbers are not the audit's batch numbers. Fix batches 1a and 1b together are audit batch 1. Audit
batches 2 to 7 are tasks TA-12 to TA-17 and have not started. [VERIFIED: the audit's fix order against CR-0005,
CR-0007, CR-0008, CR-0009]

| Fix batch | Task | Record | What it fixed | Merge | Page after | Status |
|---|---|---|---|---|---|---|
| KI-001 fix | TA-00 | CR-0002, D-015 | A new base file inherits nothing from the previous family | PR #1, `9f018e4` | `F0EB0101` | VERIFIED COMPLETE |
| 1a | TA-01 | CR-0005 | XIRR solver, hybrid look-through, partial XIRR coverage, debt fund tax | PR #4, `f778283` | `FB6676DC` | VERIFIED COMPLETE |
| 1b | TA-01 | CR-0005 | Blank invested value, IRR join, AMC key, Apply plan, Current vs Sample | PR #6, `782794f` (tag) | `EF2FF4F1` | VERIFIED COMPLETE |
| 2a | TA-02 | CR-0007 | KI-124, OD-32, OD-34 | PR #9, `bb413c4` | `911A0465` | VERIFIED COMPLETE (the owner's confirmation of settled details, PD-17, does not block) |
| 3, tax | TA-03 | CR-0008, D-040 | Tax rules of the TY 2026-27 reckoner; KI-160 to KI-182 (= TX-01 to TX-23), KI-099, KI-130, OD-2, OD-12, OD-28 | not merged; branch `0f1c5d3` | `5F1C2FC5` on the branch | **IN PROGRESS** (section 7.3) |
| 4, base file | TA-04 | CR-0009, D-041 | Base-file reading, KI-140 to KI-146 | PR #16, `6443826` | **`12B5E572` (live)** | VERIFIED COMPLETE (D-041 question 1 open: PD-08) |
| 5 | TA-05 | no CR yet | KI-183 (labels equal to `Object.prototype` keys), D-042 ("no fallback" for Crore text) | not started | | PLANNED (section 7.4) |

[VERIFIED: every page MD5 with `git show <commit>:index.html | md5sum`, 28 Oct; full lineage in the integration log
section 3]

### 7.3 TA-03: the tax batch (CR-0008, D-040), IN PROGRESS

Full card: [TASK_REGISTER.md](../project-control/TASK_REGISTER.md#ta-03-tax-batch-cr-0008-d-040). Pending integration
detail: [INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md) section 5.1.

| Part | Commit | Status | Verified so far |
|---|---|---|---|
| T1 to T4 | `c459f8d`, `92c7c83`, `5581d90`, rebased onto fix batch 4 as `97a7d69` (page `0713C6BE`) | IMPLEMENTED, NOT FULLY VERIFIED | At `97a7d69`: invariants (1 warning), smoke 36/36, AI Analyst 24/24, 43 regression files with 1,277 checks in IST and UTC, `node --test` 234/234 in IST and UTC, `data-extract --check`, docs-links, traceability, pre-push scan PASS [VERIFIED: the `0f1c5d3` commit message and CR-0008] |
| T5 follow-ups | `0f1c5d3` (page `5F1C2FC5`), a WIP checkpoint | IN PROGRESS, unreviewed | The implementer ran only `run-regression` (44 files). A scratch re-run on 28 Oct reproduced `5F1C2FC5` from `97a7d69` plus the T5 patch and passed invariants, smoke 36/36, AI Analyst, 44 regression files with 1,385 checks in IST and UTC, and `data-extract --check` [VERIFIED: workstream-A investigation, outside the repository] |

**Not verified on this branch** [VERIFIED as gaps]:
- No CI run has ever happened on it. CI can be started by hand now: `gh workflow run "Dashboard checks" --ref continuation/ex-01-task-ta-03-20261027`, or with a draft PR.
- No browser QA of the combined page. The "browser QA passed, gate GO" in commit `5581d90` covers only the pre-rebase page `61FC0FB2`.
- T5 has no docs, financial review, `node --test`, docs-links, traceability, pre-push scan or gate.
- Two implementer agents may have run in the same worktree during T5, so the T5 patch is treated as unreviewed.
- The commit says "the remaining T5 items as listed in the handover" are not done. The planned list must be reconciled
  against patch items 1 to 8 [UNCERTAIN: the D-040 cross-reference to the new build's TR table is a docs item and is
  not in the patch].
- The T5 patch header (item 8) corrects D-040 point (c): the base file's own ISIN column is not read (KI-184). D-040 on
  the branch does not say so yet.

**Merge condition.** CR-0008 records that the batch waits for the owner's answers to its questions 17 (are "Listed
AIF" funds Category III? PD-02) and 18 (can crypto gains or losses be set off? PD-03), unless the owner accepts the
safe defaults now built: a neutral note for AIFs whose category is assumed, and crypto kept out of set-off.

### 7.4 TA-05: fix batch 5, PLANNED

Card: [TASK_REGISTER.md](../project-control/TASK_REGISTER.md#ta-05-fix-batch-5-ki-183-d-042).
- **KI-183** [VERIFIED, reproduced on 28 Oct with a synthetic probe kept in the private handover folder]: when an
  Asset, Client, Category or Product label equals an `Object.prototype` key (for example `constructor`), the live
  page's `computeReview` throws; AMC and Distributor labels leak prototype text. Fix with prototype-safe keyed maps.
  NB-01 found the same defect in the new app as KI-151 (TB-27: one id per build, cross-referenced).
- **D-042** amends D-041 point 4 with the owner's KI-147 answer "no fallback": a Crore cell holding text that is not a
  number makes the holding invalid, excluded and listed. Whether placeholders such as "NA" count as empty is PD-09.
  D-039 point 1 on NB-01's branch applies the rule to invested value, market value and gain, so D-042 mirrors all three.
- **Ledger edit:** NB-01's KI-147 entries are AG-13 and AG-14 on G1 (`4610684`); whichever of TA-05 and M1.4 merges
  second retires them and edits the pinned retired list in `tests/parity/aggregation.parity.test.ts`.
- **Starts only after TA-03 merges**: both patch the engine block.

### 7.5 TA-10: the October 2026 monthly refresh, BLOCKED

Card: [TASK_REGISTER.md](../project-control/TASK_REGISTER.md#ta-10-october-2026-monthly-refresh). The owner's vendor
files are expected between 11 and 17 Nov (the owner's 23 Oct answer). The October inbox holds only the tax reckoner
and the Screener packs [VERIFIED: listing, 28 Oct]. The refresh follows [MONTHLY_REFRESH.md](../MONTHLY_REFRESH.md)
with the refresh-operator agent, regenerates `data/refdata` in the same change (D-035) and merges **only after the
owner replies "publish"** (D-017; PD-30 asks the owner to confirm the word). The risk-ratio step needs PD-20 and PD-21;
without them MF_RISK stays at 30 Sep and the PR says so (TA-20). After it: the first monthly PRD and the
`docs/HANDOVER.md` "Last refreshed" line (TA-21), which `monthly-prd-check.mjs` reads.

### 7.6 The rest of Workstream A

Open defects on the live page: 118 open, 2 partly fixed, 26 fixed among KI-001 to KI-148 on `main`. The 13 open P0
issues are KI-049, 050, 051, 052, 053, 054, 056, 057, 058, 059, 060, 064 and 066, plus KI-062 in part. [VERIFIED:
[KNOWN_ISSUES_AND_REGRESSION_RISKS.md](../project-control/KNOWN_ISSUES_AND_REGRESSION_RISKS.md) sections 1 and 2]
The backlog tasks TA-06 to TA-25 (audit batches 2 to 7, unbuilt OD items, KI-066, KI-184, grandfathering, the second
export's requests C2 to C6, tooling defects) are in [TASK_REGISTER.md](../project-control/TASK_REGISTER.md).

## 8. Workstream B: the new build

### 8.1 What it is and its rules
CR-0006: a clean rebuild with feature parity, published beside the live page, which stays the review link until
parity and the owner's sign-off (REQ-021, REQ-036). Rules: the preview is not for client use (D-024); presentation
changes go to the new build only during the parallel run (D-028); a fix made on the live page is carried into the new
build with the same known answer. Phase 0 documents: [docs/new-build/](../new-build/README.md).

### 8.2 Milestones

| Task | Milestone | Status | Evidence |
|---|---|---|---|
| TB-01 | Phase 0 and M1.1 safety tooling | VERIFIED COMPLETE, except AC-22 force-push detection (TB-24) | PRs #8, #10, #11, CI green |
| TB-02 | M1.2 toolchain, one-file build, `/next/` shell | VERIFIED COMPLETE | PR #12; `/next/` 46,905 bytes |
| TB-03 | M1.3 model, base-file reader, `data/refdata`, BF ledger | VERIFIED COMPLETE (BF-19, BF-26 with the owner; KI-148 open) | PR #13 |
| TB-04 | Section tabs across the top (D-037) | VERIFIED COMPLETE | PR #14; owner approval 27 Oct 11:43 IST |
| TB-05 | Capital-gains upload design and tax-rule table v1 (D-036) | VERIFIED COMPLETE (design only) | PR #15; reviewer approval in the design's section 10.10 |
| TB-06, TB-07 | **M1.4**: sections 1 and 2, slide C-08, overview workbook, D-038, D-039, KI-147 rule, round-1 and round-2 fixes | **IN PROGRESS, local only** | section 8.3 |
| TB-09 to TB-23 | M2 to M16 | PLANNED, with NB-01's ETAs from about 14 Nov (M2, M3) to early January (M15 switch-over) | [TASK_REGISTER.md](../project-control/TASK_REGISTER.md) |

[VERIFIED: merged PRs and CI runs; the ETAs are NB-01's estimates of 27 Oct and their tightness is INFERRED]

### 8.3 M1.4 and its round-2 fixes (TB-06, TB-07, TB-08)

Card: [TASK_REGISTER.md](../project-control/TASK_REGISTER.md#tb-06-and-tb-07-m14-and-its-round-2-fixes).
- `feat/m1-4-overview` at `07a6460` in worktree `.claude/worktrees/m14`: 236 files, +27,324/-492 against `main`; it
  already contains `main` at `6443826`. **It exists only on this laptop.** So do G1 `4610684`, G2 `be7f395` and G3
  `202f8f6`: 26 commits in all, never pushed, never run in CI, never scanned with the deny-list. [VERIFIED]
- On `07a6460`, 4 tests fail (the aggregation ledger, the AG-01/AG-13 check, the KI-147 legacy expectation and the
  vendor-extract MD5 pin, which expects `911A0465`). NB-01 counts 837 tests; an independent run counted 773; the cause
  of the difference is [UNKNOWN]. G1 reports 902 of 904 passing, and its 2 failures need its shared-file requests. G3
  reports 860 of 864 (the 4 known). G2 has never been tested. [VERIFIED as NB-01's report; counts not re-run]
- Round-1 verification (on `6015190`, before `main` was merged in), as NB-01 reports it: browser QA PASS, financial
  review approved, Office acceptance 12/12 but verdict FAIL on one medium item that G2 fixes, security gate NO-GO only
  because `main` had moved.
- **TB-08, preservation**, is NOT STARTED: a read-only run of each worktree's own pre-push scan with the deny-list,
  then `git push -u origin <branch>` from each branch's own worktree, with no PR. If the scan blocks, do not bypass it;
  a verified bundle needs an owner-approved place off this laptop. Procedure:
  [REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md#local-only-work-and-the-preservation-step).

### 8.4 Blueprint approvals
The owner asked to approve the new-build architecture section by section (REQ-069). The approval page has 17 sections
and 83 sub-items and **0 approvals**; its status lines are stale and it should be republished with actual statuses
before the owner reviews it (TC-10, PD-27). The page link is in the private supplement only. [VERIFIED: the approvals
collection was empty on 28 Oct]

## 9. Every requested improvement

The registers hold every improvement, with its source, status and target task. Nothing is dropped because it is not
built yet. An improvement is not approved by being listed.

| Group | Count | Where |
|---|---|---|
| Owner requirements REQ-001 to REQ-079, with acceptance and status | 79 (23 VERIFIED COMPLETE, 8 IMPLEMENTED NOT FULLY VERIFIED, 23 IN PROGRESS, 18 PLANNED, 2 BLOCKED, 2 EXISTING DEFECT, 1 UNKNOWN, 2 SUPERSEDED) | [REQUIREMENTS_AND_CHANGE_REGISTER.md](../project-control/REQUIREMENTS_AND_CHANGE_REGISTER.md) sections 2 and 3 |
| Change requests CR-0001 to CR-0009, and CR-0010 (next free) | 9 filed, CR-0008 on the TA-03 branch only | same file, section 5 |
| Improvements the owner asked for in the new build | 51 | same file, section 6.1 |
| Improvements the owner asked for on the live page (C2 to C6, OD-11, unbuilt OD items, "no fallback") | 7 | same file, section 6.2 |
| The previous owner's 15 promised features | 15, each UNKNOWN until the owner says which are still wanted (PD-32) | same file, section 6.3 |
| Improvements Claude proposed, not yet approved | listed with who approves each | same file, section 6.4 |
| Audit decisions OD-1 to OD-36 and their build status | 36 | [audits/2026-10-19-decisions.md](../audits/2026-10-19-decisions.md); TA-18 |

## 10. Verified facts, inferences and unknowns

**Verified** (evidence named):
- The anchors in section 3 [VERIFIED, 28 Oct 13:07 IST].
- Every worktree (23 in all) was clean on 28 Oct: 0 staged, 0 unstaged, 0 untracked; the stash is empty [VERIFIED:
  `git status --porcelain` in each, repo-env investigation].
- No pull request is open; PRs #1 to #16 are merged; the latest CI and Pages runs on `6443826` succeeded [VERIFIED:
  `gh pr list`, `gh run list`].
- The page MD5 lineage from `173F86CA` to `12B5E572`, and the tax-branch pages [VERIFIED: `git show <sha>:index.html`].
- `main` jumps from D-037 to D-041. D-038 and D-039 exist only on NB-01's local branch. D-040 exists only on the TA-03
  branch. D-042, KI-183 and KI-184 exist on no branch [VERIFIED: decision headings on each branch].
- A merge simulation of `6443826` with the TA-03 branch and `feat/m1-4-overview` gives text conflicts in
  `docs/DECISIONS.md` (1 hunk), `docs/KNOWN_ISSUES.md` (2) and `docs/PROJECT_STATE.md` (1). `CHANGELOG.md` and
  `docs/TESTING.md` merge cleanly. No code file is changed by both [VERIFIED: `git merge-tree`, 28 Oct].
- `PRD_PRIVACY_DENYLIST` is not set persistently [VERIFIED: Git Bash, PowerShell and the user environment].
- `release-check.mjs` only warns on `continuation/` and `handover/` branch names [VERIFIED: `release-check.mjs` lines
  44 and 271].

**Inferred:**
- TA-05 must follow TA-03 because both patch the engine block [INFERRED from the patch targets].
- The October refresh will force any open branch to take the new `main`, because it splices new data into
  `index.html` [INFERRED].
- G1 fixes the 4 failing tests on `07a6460` [INFERRED from the G1 diff and NB-01's report].
- `C:\dev\private` is not backed up, so a bundle there does not take NB-01's work off the laptop [INFERRED].
- Chat ownership of each worktree [INFERRED from commit subjects and the chats' reports].

**Unknown or uncertain** (also in section 16): the 773 versus 837 test count; whether G2 passes; what happened to
NB-01's decisions N16 to N19; whether NB-01 saw MOD-01's 28 Oct message; whether the vendored files pass the deny-list
scan; the R2 401 failure; whether the "keep current IPS logic" answer in R2 is the current owner's; whether the owner
asked for anything outside these chats between 24 and 27 Oct (PD-46).

## 11. Technical decisions

The full text of every decision is in [docs/DECISIONS.md](../DECISIONS.md); the index with status and branch is in
[DECISION_LOG.md](../project-control/DECISION_LOG.md) section 1.1.

| Area | Decisions in force | Notes |
|---|---|---|
| Repository and safety | D-001 (repo outside OneDrive), D-002 (fresh history), D-003 (sanitise imports), D-005 (no line-ending conversion), D-008 (public repo, no-reply identity), D-013 (git replaces backups), D-016 (every `index.html` change is a patch script), D-019 (what may be published; never say where client files are kept), D-020 (local `--no-ff` merge with an exact message), D-026 (data classes; Screener packs and scores never public), D-033 (Claude in charge; no ruleset) | `main` is unprotected; AC-22 is not built (TB-24) |
| Delivery | D-007 and D-024 (Pages for `/` and `/next/`), D-012 and D-034 (CI; the preview never blocks the live page), D-017 (merge verified requested work after green CI; refreshes wait for the owner's "publish"), D-028 (live page: calculation, data and security fixes only) | |
| Live-page behaviour | D-010, D-011, D-015, D-021, D-022, D-040 (branch only), D-041 | D-041 point 4 to be amended by D-042 |
| New build | D-023, D-025, D-027, D-029 to D-032, D-035 to D-037, D-038 and D-039 (branch only) | |
| Lead rulings of 28 Oct (R-1 to R-7) | Chat ids; number allocation; the merge readiness rule; who does what; gates A to E; public and private; ARC-01's scratch worktrees | Bind every chat now; MOD-02 records them as one D entry from D-046 to D-049 ([DECISION_LOG.md](../project-control/DECISION_LOG.md) section 1.3) |

**Number ranges from 28 Oct** (authoritative table in
[FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#numbering-allocation)):
EX-01 has D-042 to D-045 and KI-183 to KI-186; MOD-02 has D-046 to D-049 and KI-187 to KI-189 and allocates new
ranges; NB-01 keeps D-038, D-039, then D-050 onward, and KI-150 to KI-159, then KI-190 onward; KI-148 is worked by
NB-01 under M1.4. The next free change request is CR-0010. TX-nn = KI-(159+nn).

## 12. Blockers and pending owner decisions

46 decisions wait for the owner (PD-01 to PD-46). None was answered by 28 Oct. Each is explained in plain language in
[DECISION_LOG.md](../project-control/DECISION_LOG.md) section 2.3. Ask them in this order
([section 2.1](../project-control/DECISION_LOG.md#21-what-to-answer-first)):

| Order | PD | What it blocks |
|---|---|---|
| 1 | PD-02 (Q17, Listed AIF category), PD-03 (Q18, crypto set-off) | The TA-03 merge, unless the owner accepts the safe defaults now built |
| 2 | PD-09 (do placeholders such as "NA" count as an empty Crore cell?) | TA-05 (D-042) and the M1.4 PR wording |
| 3 | PD-08 (holding days of one fund held in several folios) | KI-148 alignment in M1.4 |
| 4 | PD-20 (monthly public AMFI NAV download), PD-21 (where the risk toolchain may live) | The October risk-ratio step (TA-20) |
| 5 | PD-30 (confirm the "publish" gate) | TA-10 |
| 6 | PD-27 (blueprint approvals) | TC-10 |

**Other blockers** [VERIFIED]: the owner's October vendor files (TA-10); NB-01's work is local only (TB-08); the
deny-list must be exported for every push (TC-11, PD-40); MOD-02, EX-01 and ARC-01 do not exist until the owner
creates them (the Claude interface does not let a chat create another chat).

## 13. Main risks

The full register (RR-01 to RR-29; RR-25 to RR-29 are the new-build risks B-01 to B-05) with likelihood, impact, mitigation and owner is in
[KNOWN_ISSUES_AND_REGRESSION_RISKS.md](../project-control/KNOWN_ISSUES_AND_REGRESSION_RISKS.md) section 7. The five
that matter most now:

| Risk | Why | Mitigation |
|---|---|---|
| RR-01 | NB-01's M1.4 work exists only on this laptop | TB-08 preservation, early (section 15, step B1) |
| RR-09 | The tax batch has never run in CI, has no browser QA of the combined page, and T5 is unreviewed | CI by hand now; full Gate C on the final page; financial review of T5 |
| RR-03, RR-04 | Shared documents and the AG ledger conflict between TA-03, TA-05 and M1.4 | The merge readiness rule; ARC-01 checks merged documents at Gate B |
| RR-16 | A push without the private deny-list scans with generic rules only | Export it before every push; push each branch from its own worktree; PD-40 |
| RR-19 | `main` is unprotected and the force-push check does not exist | Discipline (never force-push); TB-24; IMP-C01 for the owner |

## 14. How the project is run from now on

The operating model is in [project-control/README.md](../project-control/README.md). In short:
- **MOD-02** is the owner's single point of contact. It turns requests into tasks, sequences work, allocates numbers,
  gives "go to merge", sets the shared-document rules, keeps the registers and explains decisions simply.
- **ARC-01** reviews real diffs at Gate B, checks interfaces, ownership and overlaps, and may block a change (NO-GO).
  Escalation goes to MOD-02, then to the owner.
- **EX-01** (Workstream A) and **NB-01** (Workstream B) build in their own worktrees and branches, push with
  `git push -u origin <branch>` from that worktree with `PRD_PRIVACY_DENYLIST` set, open the PR, and make the D-020 merge
  only after MOD-02's go, green CI and ARC-01's Gate B GO. Then they verify Pages: the live MD5 equals `main`'s
  `index.html`, and `/next/` has the build's size and SHA-256.
- The repository's agents in `.claude/agents/` stay the specialist reviewers: financial-domain-reviewer, qa-engineer,
  security-release-reviewer, implementation-engineer, dashboard-archaeologist and refresh-operator.
- **Gates A to E** (implementation report, guardian and domain review, independent verification, controlled
  integration, acceptance) are defined in
  [project-control/README.md](../project-control/README.md#6-gates-a-to-e) and recorded in the integration log.
- **Merge order is a readiness rule**: whichever change passes Gates A to D first merges first; the second takes
  `main`, keeps decisions in number order and keeps both sides' rows
  ([merge readiness rule](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#merge-readiness-rule)).
- **Context handovers** follow [continuations/README.md](continuations/README.md).

## 15. Immediate execution plan

The owner's order is: validate the handover, then Workstream A first, then Workstream B (REQ-072). "First" sets
MOD-02's attention and the order of work it assigns. It is not a merge lock: under the readiness rule a fully verified
M1.4 may merge before TA-03, and work that does not conflict may run in parallel (owner's handover prompt, section 6).

### Step 0: validate the handover (MOD-02; no product change)

| # | Action | Accept when |
|---|---|---|
| 0.1 | Read [project-control/README.md](../project-control/README.md), this document, the registers named in its reading order, the private supplement and the private coordination notes (`C:\dev\private\coordination-notes.md`). Run the read-only block in [REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md#verify-before-you-trust) | Every anchor of section 3 matches, or each mismatch is recorded in the integration log before any work is assigned |
| 0.2 | Bring this handover package onto `main` (TC-01). Check whether MOD-01 pushed it: `git ls-remote origin refs/heads/handover/mod-01-to-mod-02-20261028`. If not, push it from the handover worktree, which MOD-02 inherits, after the security GO and with the deny-list exported: `git push -u origin handover/mod-01-to-mod-02-20261028`. Then the PR, green CI and the D-020 merge through the lighter docs path (docs only, so Pages does not run) | `docs/project-control/` and `docs/handover/` are on `main`; `docs-links` and the privacy scan with the deny-list pass; the merge is recorded in the integration log |
| 0.3 | Set MOD-01 to RETIRED in the chat registry, with the reason, once 0.1 is done (TA-03 ownership then sits with MOD-02 until EX-01 confirms it) | The registry shows MOD-01 RETIRED, successor MOD-02 |
| 0.4 | Ask the owner to create ARC-01 and then EX-01 with their copy-ready prompts (see [README.md](README.md)); record them in the registry (TC-03, TC-04) | Both chats exist and have confirmed their anchors: EX-01 confirms `0f1c5d3` and the T5 scope; ARC-01 holds the interface table, the merge simulation and the ownership map as its baseline |
| 0.5 | Send the owner the decision pack, leading with section 12's order (TC-09) | The pack is sent; each answer is recorded as a D or KI entry and relayed to the chat that builds it |
| 0.6 | Resume NB-01 (or replace it, if MOD-02 judges its context unreliable) and ask the open reconciliation points: G2's tests, N16 to N19, 773 versus 837 tests, anything done after its report (TC-05) | NB-01 has answered and its registry row is current |
| 0.7 | Housekeeping that must not wait: memory updates (TC-14); move the cross-chat agreements in the private coordination notes into D, KI or register entries (TC-07); delete nothing without the owner's word (TC-13, PD-39) | Memory and registers agree; nothing deleted |

### Step 1: Workstream A first

| # | Task (owner) | Actions | Accept when |
|---|---|---|---|
| A1 | **TA-03 completion** (EX-01, worktree `.claude/worktrees/wf_c9c8da96-497-10`) | Start CI evidence early (`gh workflow run "Dashboard checks" --ref continuation/ex-01-task-ta-03-20261027` or a draft PR). Review the T5 patch item by item against its scope and record any missing item. Re-derive `5F1C2FC5` (or the final MD5) from `97a7d69` plus the T5 patch. Write the T5 docs: D-040 with the correction of point (c) (KI-184), its "Usual buckets" text updated to the dated default, and the cross-reference to `docs/new-build/capital-gains-upload.md` section 10 (TR-7, LD-11); KI-170; file KI-184 from EX-01's range; CR-0008 status ("on origin through the continuation branch"); CHANGELOG, PROJECT_STATE, TESTING; the CLAUDE.md smoke count 35 to 36. Add a launch entry for browser QA on port 8133 | `check-invariants --expect-md5 <final>`; smoke 36/36 in IST and UTC; AI Analyst 24/24; every regression file in IST and UTC; `node --test` in IST and UTC; `data-extract --check`; docs-links; traceability; the privacy scan; **the pre-push scan re-run on the final head with the deny-list**; financial-domain-reviewer approves T5; qa-engineer browser QA of the final combined page (Taxation tab, slides, `family-isolation.js` 11/11, `cvs-refresh.js`, tax slides opened in PowerPoint); security GO on the staged diff; ARC-01 Gate B GO |
| A2 | **TA-03 PR and merge** (EX-01, after MOD-02's go) | Open one PR for the batch, from the `continuation/` branch (release-check warns only) or from a `fix/` branch at the same commit, without rewriting history (TC-23). Hold the merge until PD-02 and PD-03 are answered, or the owner accepts the safe defaults | CI "Dashboard checks" green on the PR (both jobs); D-020 merge with the exact message; push `main`; Pages green; the live `/` MD5 equals the merged `index.html`; `/next/` unchanged; a new baseline row and Gate D record in the integration log; NB-01 told to take `main`; Gate E: the owner accepts the visible tax changes on the live link |
| A3 | **TA-05 fix batch 5** (EX-01) | Only after A2. Write the change-impact contract first. Branch from the new `main`. Prototype-safe maps at every keyed lookup in `computeReview`; file KI-183; write D-042 per the owner's PD-09 answer; if M1.4 has merged, retire AG-13 and AG-14 and edit the pinned retired list, otherwise leave that edit to the M1.4 PR | The probe shows no throw and no leaked text for all six label kinds; new regression files pass; the A1 check list passes; financial review and browser QA pass; ARC-01 GO; CI green; D-020 merge; Pages verified |
| A4 | **TA-10 October refresh** (EX-01 with the refresh-operator agent) | When the owner's files arrive (expected 11 to 17 Nov), branch `data/2026-10-refresh` from `main` as it is then; MONTHLY_REFRESH Steps 0 to 10; regenerate `data/refdata` (D-035); risk step only if PD-20 and PD-21 are answered. Stop and report if an unexpected sensitive file appears in the inbox | Refresh log and PR complete; gates pass; CI green; **the owner has replied "publish" before the merge**; after the merge the live size and SHA-256 are verified; then TA-21: the first monthly PRD passes `monthly-prd-check.mjs` and the `docs/HANDOVER.md` "Last refreshed" line is updated |

### Step 2: Workstream B

| # | Task (owner) | Actions | Accept when |
|---|---|---|---|
| B1 | **M1.4 preservation, TB-08** (MOD-02 decides under D-033; NB-01 executes) | Read-only scan of each of the four branches from its own worktree with the deny-list; if it passes, `git push -u origin <branch>` from each branch's own worktree, no PR; if it blocks, report and ask the owner for an off-machine place for a verified bundle. **Recommended [INFERRED]: authorise this during step 0.** It changes no product, conflicts with nothing in Workstream A and protects the work at greatest risk (RR-01) | `git ls-remote origin` shows `07a6460`, `4610684`, `be7f395` and `202f8f6`, or a verified bundle sits in the owner-approved place; nothing force-pushed |
| B2 | **M1.4 completion, TB-06 and TB-07** (NB-01) | NB-01's own plan: fetch; take `main` if it moved (resolve the four document hunks in number order, keeping both rows); integrate G1, G2, G3 one at a time with their shared-file requests; run and report G2's tests; docs (D-039 points, DATA_DICTIONARY sections 5.3 and 8, KI-148, KI-151 and KI-183 wording, CLAUDE.md, MD5 records, stale new-build docs TB-28); if TA-05 has merged, retire AG-13 and AG-14; otherwise send MOD-02 the final AG ids | All tests pass in IST and UTC with 0 failures and the 773 versus 837 count explained; `vendor-extract --check`, `data-extract --check`, `check-next --rebuild`; `npm run accept:office` verdict PASS; browser QA PASS; financial review approved; security GO; ARC-01 GO; the PR body states the SheetJS CVE risk (TB-26); CI green; D-020 merge; Pages: `/next/` SHA-256 equals the build and the live MD5 is unchanged |
| B3 | Blueprint and roadmap (MOD-02, NB-01) | Republish the blueprint with actual statuses and ask the owner for approvals (TC-10, PD-27). Then M2 and M3, M4, M5 and M10 on synthetic packs, M6 to M8, M9, M11, M12, M13, M14, M15 switch-over, M16, each one PR through the gates | Approvals recorded and relayed to NB-01; each milestone passes Gates A to E |

### Step 3: afterwards
- A docs PR after TA-03 and M1.4 merge: the second-export updates (TA-08) and the stale shared records (TC-15).
- The Workstream A backlog in the owner's priority order: TA-19 (KI-066, after PD-10), audit batches 2 to 7 (TA-12 to
  TA-18), TA-11, TA-06, TA-07, TA-09, TA-22 to TA-25.
- Owner reporting after each merge, with links, ETAs and verified or unverified labels (TC-22).

## 16. What this handover could not establish

Investigate these before treating the handover as complete. Each is also a task or a PD.

| Item | Why it matters | Where tracked |
|---|---|---|
| The planned T5 item list against T5 patch items 1 to 8 | Something may be missing from T5 | TA-03 card |
| NB-01's test count, 773 versus 837 on `07a6460` | A missing test group would hide failures | TC-05, RR-21 |
| G2's test result; NB-01's decisions N16 to N19 | Unknown quality of round 2 | TC-05, RR-20 |
| Whether NB-01 changed anything in its last turn after its report, and whether it saw MOD-01's 28 Oct message | Its report may be incomplete | TC-05 |
| Whether the vendored library files pass the deny-list pre-push scan | Decides how TB-08 is done | TB-08 |
| The R2 independent check (a 401 failure, never rerun, recorded nowhere) | Parts of R2 may be unverified | TC-16 |
| Whether the R2 answer "keep current IPS logic for now" is the current owner's | Decides TA-19 | PD-10 |
| Any owner request made outside these chats between 24 Oct 02:08 and 27 Oct 11:43 IST | A requirement could be missing | PD-46 |
| Whether T1 and T2 ever had their own browser check, and whether the T4 financial re-check took place | Records lag the commits | TA-03 |
| Whether `release-check` accepts an `index.html` change made by a revert. Reading `scripts/validation/release-check.mjs` lines 314 to 320, it FAILs a revert that deletes a patch script [INFERRED from the code; not run]. Remove this row once ARC-01 confirms | Matters only for a recovery: CI's `release-check --ci` would block a plain revert PR | integration log section 7 |
| The test-data folders' synthetic status (presumed from names, not opened) | Privacy | TC-18 |

The chat transcripts were read for timestamps and owner messages only. Anything that existed only in a chat's lost
context and was never written to a file cannot be recovered; this handover does not claim it.

## 17. Change log

| Date (IST) | Version | By | Change |
|---|---|---|---|
| 28 Oct 2026 | v1 | MOD-01 | First master handover, for MOD-01 to MOD-02. Supersedes `docs/HANDOVER.md` (23 Oct) as the entry point. A later version is a new file (`MASTER_HANDOVER_<date>_v<n>.md`); this one is never overwritten |
| 30 Oct 2026 | v1 (corrected before validation) | MOD-01 (fixer pass) | Validation findings applied in place, before MOD-02's validation: working `git rev-parse` evidence; step 0.3 retirement condition as in the header (R-1); step 0.4 order ARC-01 then EX-01; the D-040 "Usual buckets" item in A1; the release-check revert row; the audit count; the NB-01 report time; a status word in section 7.1 |
