# Codebase Guardian handover: ARC-01, 28 Oct 2026 (v1)

| Field | Value |
|---|---|
| For | `ARC-01 \| Project-Wide \| Codebase Integrity & Integration Guardian` (QUEUED until the owner starts it; MOD-02 launches it under TC-04) |
| Written | 28 Oct 2026 (IST) by MOD-01, for the handover to MOD-02, on branch `handover/mod-01-to-mod-02-20261028` (base `main` at `6443826`) |
| Version | v1. Never overwritten. A later version is a new dated file listed in the [handover index](README.md) |
| Start prompt | [continuations/ARC-01_BOOTSTRAP_PROMPT_2026-10-28.md](continuations/ARC-01_BOOTSTRAP_PROMPT_2026-10-28.md) |
| Reports to | MOD-02 (the Master Project Moderator). Escalation: MOD-02, then the owner through MOD-02 |
| Facts it rests on | the registers in [`docs/project-control/`](../project-control/README.md). If this file and a register disagree, the register wins; if a register and git disagree, git wins |
| Private details | `C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md` on the owner's laptop. Never copy anything from it into public text |

**Labels.** [VERIFIED] means checked with the command, file and line given. [INFERRED] means reasoned from verified
facts. [UNCERTAIN] and [UNKNOWN] mean the evidence is not enough. Status words are the owner's nine (VERIFIED
COMPLETE; IMPLEMENTED, NOT FULLY VERIFIED; IN PROGRESS; PLANNED; BLOCKED; NOT STARTED; EXISTING DEFECT; UNKNOWN /
NEEDS INVESTIGATION; SUPERSEDED), used exactly. A snapshot is not proof: re-run the checks before you rely on any SHA
here.

## Contents
1. [Your job](#1-your-job)
2. [Last verified baseline and integration state](#2-last-verified-baseline-and-integration-state)
3. [Dependency map in brief](#3-dependency-map-in-brief)
4. [Shared interfaces you guard](#4-shared-interfaces-you-guard)
5. [Ownership and active changes](#5-ownership-and-active-changes)
6. [High-risk overlaps now](#6-high-risk-overlaps-now)
7. [Regression tests each area needs](#7-regression-tests-each-area-needs)
8. [Gate B review checklist](#8-gate-b-review-checklist)
9. [How to review without writing](#9-how-to-review-without-writing)
10. [Reporting to MOD-02](#10-reporting-to-mod-02)
11. [Escalation](#11-escalation)
12. [What ARC-01 must not do](#12-what-arc-01-must-not-do)
13. [Open questions and leads you inherit](#13-open-questions-and-leads-you-inherit)
14. [Standing duties after the first two reviews](#14-standing-duties-after-the-first-two-reviews)
15. [Change log](#15-change-log)

## 1. Your job

The owner asked on 27 Oct for an independent technical control over every change (REQ-074, REQ-075). ARC-01 is that
control. Several chats now change one public repository that holds two products: the live page `index.html`
(Workstream A) and the new app in `app/` (Workstream B). They share CI, Pages, reference data, tests and six documents.
Your work is to make sure one chat's change does not break another chat's work or what works today.

| You do | You do not |
|---|---|
| Review the **real diff** of every material change at **Gate B**, bound to one head SHA | Implement features, fix the code you review, or write in another chat's worktree |
| Check every consumer of every shared interface the change touches ([INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md)) | Make product or financial-rule decisions (the owner does) |
| Simulate merges against `main` and every other active branch | Merge, push, open or comment on pull requests (the implementing chat does) |
| Name the regression tests the change needs, and say whether they exist and ran | Sequence work, assign tasks or allocate numbers (MOD-02 does) |
| Review **material change-impact contracts before work starts** (for example TA-05) | Edit the registers (MOD-02 is their single writer; you propose changes) |
| Give a written **GO or NO-GO**; a NO-GO blocks the merge until it is resolved | Talk to the previous owner, or to anyone outside the owner and the project's chats |
| Propose corrections to the interface, ownership and regression-risk registers | Delete anything except your own clean scratch worktrees |

**Authority** [VERIFIED: [project-control/README.md](../project-control/README.md) section 5.2 and
[DECISION_LOG.md](../project-control/DECISION_LOG.md) ruling R-4]:
- Gate B: ARC-01 is accountable and responsible, and may BLOCK.
- "Go to merge": MOD-02 decides, and needs your Gate B GO first.
- The D-020 merge: the implementing chat performs it after MOD-02's go, green CI and your GO. You confirm afterwards
  that what merged is what you reviewed.
- Pages after a merge: the implementing chat verifies; you may spot-check.
- Shared documents in conflict: the second chat to merge resolves them; you check that nothing was lost.
- Disputes: MOD-02 decides first; the owner has the final say.

**Gates in one line each** (full entry and exit criteria in
[project-control/README.md](../project-control/README.md#6-gates-a-to-e)): A implementation report (implementing
chat); **B guardian and domain review (you, plus financial-domain-reviewer for any calculation or tax rule, plus
security-release-reviewer before every push and PR)**; C independent verification (implementing chat and
qa-engineer); D controlled integration (implementing chat after MOD-02's go); E acceptance (the owner, through MOD-02).
Every gate is recorded by MOD-02 in [INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md#8-gate-records).

## 2. Last verified baseline and integration state

The last state known to be good is `main` at `6443826`. Every recovery returns to it until a new Gate D record says
otherwise ([INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md#1-last-verified-baseline)).

| Item | Value | Evidence |
|---|---|---|
| `main` = `origin/main` | `6443826`, merge of PR #16 (fix batch 4, CR-0009, D-041), 27 Oct 18:13 IST | [VERIFIED: `git rev-parse main origin/main \| cut -c1-7` (re-run 30 Oct) and `git ls-remote origin refs/heads/main`, re-run 28 Oct by the writer of this file] |
| Live page `/` | 16,837,249 bytes, MD5 `12B5E5727FCA01EF2EA162C59913F01D`, equal to `git show origin/main:index.html` | [VERIFIED: `git show origin/main:index.html \| md5sum`, re-run 28 Oct; live download recorded in the integration log; Pages verified 27 Oct] |
| Preview `/next/` | 46,905 bytes, SHA-256 `0407eb12...` (the PR #14 build) | [VERIFIED: integration log section 1] |
| CI and Pages on `6443826` | both green: "Dashboard checks" and "Publish dashboard to GitHub Pages" (run ids in the integration log, section 1) | [VERIFIED: `gh run list`, integration log] |
| Checks on record for `6443826` | invariants hold (1 known warning); smoke 35/35; AI Analyst 24/24; 19 regression files, 649 checks; `node --test` 234/234 in IST and UTC; browser acceptance passed; security GO | [VERIFIED as records in CR-0009 and `docs/TESTING.md`; not re-run on 28 Oct] |
| Open pull requests | none | [VERIFIED: `gh pr list`, 28 Oct] |
| Gate records under the new model | none yet: no change has passed a gate since the gates were defined on 28 Oct | [VERIFIED: integration log section 8] |

**Pending integrations** (detail in [ACTIVE_CHANGE_REGISTER.md](../project-control/ACTIVE_CHANGE_REGISTER.md) and
[integration log section 5](../project-control/INTEGRATION_AND_REGRESSION_LOG.md#5-pending-integrations)):

| Change | Branch at head | On origin | Status | Gate state |
|---|---|---|---|---|
| TA-03 tax batch (CR-0008, D-040), EX-01 from MOD-01 | `continuation/ex-01-task-ta-03-20261027` at `0f1c5d3`, parent `97a7d69` | yes | IN PROGRESS (T1 to T4 IMPLEMENTED, NOT FULLY VERIFIED; T5 IN PROGRESS, unreviewed) | Gate A partial (WIP message only); B not started; never run in CI; no browser QA of the combined page |
| TB-06 M1.4, NB-01 | `feat/m1-4-overview` at `07a6460` | **no (LOCAL ONLY)** | IN PROGRESS (4 known test failures on the head) | Round 1 reviewed on `6015190` only; never CI'd; never scanned with the deny-list |
| TB-07 round-2 fixers G1, G2, G3, NB-01 | `worktree-wf_bdc6c774-599-1/-2/-3` at `4610684` / `be7f395` / `202f8f6` | **no (LOCAL ONLY)** | G1, G3 IMPLEMENTED, NOT FULLY VERIFIED; G2 IN PROGRESS (untested) | not integrated into `feat/m1-4-overview` |
| TC-01 this handover package, MOD-01 to MOD-02 | `handover/mod-01-to-mod-02-20261028` | not yet | IN PROGRESS | docs only; lighter gate path |

[VERIFIED: every SHA above re-checked on 28 Oct with `git rev-parse` and `git ls-remote origin`; page MD5s with
`git show 97a7d69:index.html | md5sum` = `0713c6be...` and `git show 0f1c5d3:index.html | md5sum` = `5f1c2fc5...`]

**Planned, no branch yet:** TA-05 fix batch 5 (after TA-03 merges); TA-08 and TC-15 docs refresh (after TA-03 and
M1.4); TA-10 October refresh (when the owner's vendor files arrive, expected 11 to 17 Nov).

**Incidents so far** (integration log section 6): PR #1 merged on GitHub with the wrong author e-mail (closed by
D-020); PR #16 broke one T2 anchor of the tax batch (patch-lib refused safely; closed by the rebase `97a7d69`); PR #16
turned 4 tests red on the unpushed M1.4 branch (open, fixed by G1); two implementer agents in the TA-03 worktree
during T5 (open); the literal patch rebuild rule refuses on today's page (open, TA-23).

## 3. Dependency map in brief

**The full map is [ARCHITECTURE_AND_DEPENDENCY_MAP.md](../project-control/ARCHITECTURE_AND_DEPENDENCY_MAP.md)**
(sections 2 to 12: blocks, ENGINE API, tooling, the patch rule, the refresh, `data/refdata`, the new app, CI and
Pages, tests, the text diagram, downstream consumers and high-risk files). The detailed product documents stay
authoritative: [docs/legacy/ARCHITECTURE.md](../legacy/ARCHITECTURE.md) for the live page,
[docs/ARCHITECTURE.md](../ARCHITECTURE.md) and [docs/DATA_DICTIONARY.md](../DATA_DICTIONARY.md) for the new app.

What you need in your head:

1. **The live page is one 16.8 MB file with 13 script blocks**, each found by a **marker string**, never by position:
   four vendored libraries (00 Chart.js, 01 datalabels, 02 SheetJS, 03 PptxGenJS with JSZip inside), data (04
   `REFDATA`, 05 dividers, 06 logos, 10 `MF_ER_TABLE`) and app code (07 engine, 08 exporters, 09 parsers, 11 UI, 12
   boot). The app blocks share state only through `window.*` and `window.ENGINE`. [VERIFIED: map section 2]
2. **Code in `index.html` changes only through patch scripts** in `tools/patches/` on `tools/patch-lib.js` (D-016).
   Data changes only through `buildtools` on a `data/YYYY-MM-refresh` branch, after the owner's "publish" (D-017).
3. **Both workstreams read the live page.** Legacy tools run the shipped blocks in a Node vm through
   `tools/engine-host.js`. The new build reads it too: `scripts/data-extract.ts` (blocks 04 and 10 into
   `data/refdata/`), the parity tests (`computeReview` and `parseBaseRows` through engine-host), the SheetJS test
   helper, and on the M1.4 branch `scripts/vendor-extract.mjs` (blocks 00 to 03 and the logos of 06 into
   `app/vendor/`). So **a live-page change can turn the new build's CI red**, and the reverse is not true.
4. **The new app** (`app/src`): config, model, ingest, engine, views, ui; M1.4 adds exports (PPTX, an in-house XLSX
   writer, STORE zip) and services. `scripts/build.mjs` makes one offline file with a hash CSP; `check-next.mjs`
   checks it. [VERIFIED: map section 7]
5. **One CI workflow serves both** ("Dashboard checks": job `checks` for the live page, job `next` for the new app
   and repository safety). **Pages** publishes `/` as a byte copy of `index.html` after the legacy gates, and `/next/`
   only if the new app built and checked; a new-app failure never blocks the live page (D-034). Docs-only merges do
   not run Pages (path filter). [VERIFIED: map section 8]

```text
index.html (A) --markers--> engine-host --> legacy tools (invariants, smoke, AI test, regression)
     |                            \-------> new-build parity tests (BF ledger; AG ledger on m14)
     |--blocks 04,10--> data-extract.ts --> data/refdata/*.json --> refdata parity, CI --check
     |--blocks 00-03,06 (m14)--> vendor-extract.mjs --> app/vendor/*, MANIFEST.json --> CI --check, build
app/ (B) --> build.mjs --> /next/ ;  shared: ci.yml, pages.yml, DECISIONS, KNOWN_ISSUES, PROJECT_STATE,
                                             CHANGELOG, TESTING, CLAUDE.md, tests/parity ledgers
```

**Known drift you must not trust** [VERIFIED: map section 13]: the `.blocks/` reading copies date from 21 Oct; the
line counts in `docs/legacy/ARCHITECTURE.md` section 2 are the baseline's (today 3,275 / 2,277 / 6,046 lines for
engine / exporters / UI). Before citing a block line, run `tools/extract-blocks.js` on a scratch copy (section 9).

## 4. Shared interfaces you guard

The register is [INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md#1-summary-table) (I-01 to I-27,
each with owner, consumers, file and line, version and change rule). Use it at every review. The table below sorts
them by how much damage a careless change does, so you know where to look first.

| Tier | Interfaces | Why they matter | First check at Gate B |
|---|---|---|---|
| **1. Cross-build: a change on one side breaks the other side's CI or numbers** | I-01 base-file rules; I-02 money columns and text in number cells; I-03 merged folios; I-05 `REFDATA` and `MF_ER_TABLE`; I-06 `data/refdata`; I-08 block markers (7 copies); I-09 ENGINE API; I-11 engine-host API (frozen); I-12 the synthetic book; I-13 BF ledger; I-14 AG ledger; I-20 vendored libraries; I-21 the two tax-rule tables | The new build's parity tests, refdata parity and vendor checks run against the live page; the two builds must give the same answers (D-028) | `git diff --name-only` against the files in the I-xx row; run the other workstream's tests on the simulated merge (section 9) |
| **2. Inside the live page** | I-04 IRR workbook; I-07 the seven `localStorage` keys; I-10 UI to exporter `window` globals and `resetFamilyState()`; I-17 PPTX output; I-18 XLSX output | Family isolation (D-015, KI-001), privacy of stored values (KI-012), deck pagination, exports analysts send to clients | new per-family state is cleared in `resetFamilyState()`; no new `localStorage` key without the security reviewer; exports opened in Office |
| **3. Policy and process** | I-15 traceability; I-16 publication classes; I-19 new-app exports; I-22 fund ranks; I-23 the one Screener link; I-24 the deny-list contract; I-25 the D-020 merge message; I-26 branch names; I-27 Pages staging | Public-repository safety, D-026 data classes, the release process | never weakened to make a check pass; a change needs the decision it rests on |

Four facts that catch reviewers out [VERIFIED: INTERFACE_CONTRACTS sections 2.7 to 2.11]:
- **No test checks that the 7 marker copies agree** (I-08). A marker change must update every copy in one PR.
- **`tools/check-invariants.js` checks only part of the ENGINE surface** (lines 47 to 49 omit `amcKey` and `xirr`;
  TA-22). The tax branch adds four keys (`taxClassify`, `taxApplyAssumptions`, `taxAssumeFor`, `taxDefaults`) and does
  not add them there. The I-09 rule says new keys go into `ENGINE_KEYS` in the same PR.
- **Nothing links the two tax-rule tables mechanically** (I-21): live `REFDATA.TAX_RULES` (25 rows on `main`, 34 on
  the tax branch) and the new build's TR-1 to TR-21 in [capital-gains-upload.md](../new-build/capital-gains-upload.md)
  section 10. Agreement is by hand.
- **The parity ledgers enforce "every active entry is used"** (I-13, I-14). A legacy fix that removes a difference
  must retire the entry in the same PR, or the other workstream's CI goes red.

## 5. Ownership and active changes

**Who owns what** is in [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md).
In short: Workstream A (EX-01) owns `index.html` (through patches only), `tools/**`, `buildtools/**`, `docs/legacy/*`
and its change requests; Workstream B (NB-01) owns `app/**`, `scripts/build.mjs`, `scripts/serve.mjs`,
`scripts/vendor-extract.mjs`, `scripts/lib/*`, `scripts/office/*`, `scripts/data-extract.ts`, the new-app tests,
`docs/new-build/*` and the new-app docs; MOD-02 owns `docs/project-control/*` and `docs/handover/*`. The shared
hotspots each have a rule in that file: `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`, `CHANGELOG.md`,
`docs/PROJECT_STATE.md`, `docs/TESTING.md`, the CR index, `data/refdata/*`, the parity ledgers, the two workflows,
`CLAUDE.md` and `.claude/agents/*`, the policy files, the block markers and the ENGINE keys.

**What is in flight on 28 Oct** (the live list is [ACTIVE_CHANGE_REGISTER.md](../project-control/ACTIVE_CHANGE_REGISTER.md)):

| Change | Files it changes (summary) | Shared interfaces | Hotspots it edits |
|---|---|---|---|
| TA-03 at `0f1c5d3` | `index.html` through `tools/patches/2026-10-27-tax-1` to `-tax-5` (engine 07, exporters 08, UI 11); 26 files in `tools/regression/`; `tools/smoke-review.js`; `tools/browser-checks/family-isolation.js`; `data/refdata/TAX_RULES.json`, `VINTAGE.json`; legacy docs and CR-0008 | I-05, I-06, I-09, I-10, I-17, I-21 | DECISIONS, KNOWN_ISSUES, PROJECT_STATE, TESTING, CHANGELOG, CR index; CLAUDE.md once its T5 docs land |
| TB-06 at `07a6460` | 236 files, +27,324 / -492 against `main`: `app/src` (94), `app/vendor` (10), `scripts/vendor-extract.mjs`, `scripts/lib`, `scripts/office`, `scripts/validation/check-next.mjs` (+205 / -20), `package.json`, `.github/workflows/ci.yml`, tests, new-build docs | I-02, I-08 (2 new copies), I-11, I-14, I-19, I-20, I-23, I-27 (through `check-next.mjs`) | DECISIONS, KNOWN_ISSUES, PROJECT_STATE, TESTING, CHANGELOG, CLAUDE.md, ci.yml, CR-0006 |
| G1 at `4610684` | reader, notes, overview view, `scripts/vendor-extract.mjs`, `tests/fixtures/make-books.ts`, `tests/parity/*` including **`base-file-ledger.json` and `base-file.parity.test.ts`** | I-01, I-03, I-13, I-14, I-20 | the parity ledgers |
| G2 at `be7f395` | XLSX writer, `scripts/office/*`, `tests/fixtures/make-books.ts`, `tests/helpers/node-wiring.ts` | I-19 | none outside Workstream B |
| G3 at `202f8f6` | PPTX post-processing and the C-08 layout, `app/src/ui/*`, `docs/new-build/deck-design-system.md` | I-19 | none outside Workstream B |
| TC-01 | new files under `docs/project-control/` and `docs/handover/`, a banner on `docs/HANDOVER.md` | none in code | `docs/HANDOVER.md` |

[VERIFIED: `git diff --name-only` of each range on 28 Oct; G1 to G3 hotspot lists by `git diff --name-only 07a6460
<head>`; `check-next.mjs` size by `git diff --stat origin/main...feat/m1-4-overview`]

**Numbering ranges to check ids against** ([numbering allocation](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#numbering-allocation)):
EX-01 D-042 to D-045 and KI-183 to KI-186 (it inherits D-040 and KI-160 to KI-182 on the TA-03 branch); MOD-02 D-046
to D-049 and KI-187 to KI-189; NB-01 D-038, D-039, then D-050 onward, KI-150 to KI-159, then KI-190 onward, and KI-148
inside the M1.4 task; next CR is CR-0010 (MOD-02 allocates). An id outside the author's range is a finding.

## 6. High-risk overlaps now

### 6.1 TA-03 versus TA-05: the engine block
- **What.** Both patch block 07 (the engine) of `index.html` with anchored replacements. TA-05 adds prototype-safe
  maps to `computeReview` (KI-183) and the "no fallback" money rule (D-042, amending D-041 point 4).
- **Evidence.** PR #16 already broke one TA-03 anchor once: an anchor occurred twice and `patch-lib` refused (closed
  by the rebase `97a7d69`). [VERIFIED: integration log section 6]
- **What can go wrong.** A TA-05 patch written against `main` before TA-03 merges would anchor on text TA-03 rewrites.
  `patch-lib` refuses safely, but the work is redone. Worse, two engine branches open at once invite a hand merge of
  `index.html`, which CLAUDE.md rule 1 forbids.
- **Rule.** TA-05 branches from `main` only after TA-03 merges (ruling R-3; RR-02). One engine patch branch at a time.
- **What you check.** At TA-05's change-impact contract: the base is the post-TA-03 `main`. At TA-05's Gate B: its
  page re-derives from the new `main` MD5 plus its own patches only; no TA-03 patch file is edited; known answers of
  KI-160 to KI-182 still pass.

### 6.2 TA-03 versus M1.4: the shared documents
- **What.** No code file is changed by both. Five documents are.
- **Evidence.** `git merge-tree 6443826 origin/continuation/ex-01-task-ta-03-20261027 feat/m1-4-overview` (the
  three-argument form, which writes nothing) gives conflict markers in `docs/DECISIONS.md` (1 hunk: D-038 and D-039
  versus D-040, all between D-037 and D-041), `docs/KNOWN_ISSUES.md` (2 hunks) and `docs/PROJECT_STATE.md` (1 hunk);
  `CHANGELOG.md` and `docs/TESTING.md` merge cleanly. [VERIFIED: re-run on 28 Oct, 4 conflict markers in total]
- **This result will change.** It was taken on `0f1c5d3`, which has no T5 docs. EX-01's T5 docs will edit D-040,
  KNOWN_ISSUES (KI-170, KI-184, maybe KI-183), CR-0008, the CR index, CHANGELOG, PROJECT_STATE, TESTING and
  **CLAUDE.md** (smoke count 35 to 36 at line 99). M1.4 also edits CLAUDE.md (around lines 135 to 180), so CLAUDE.md
  becomes a sixth shared file [VERIFIED: `git diff origin/main...feat/m1-4-overview -- CLAUDE.md`]; whether it
  conflicts is [UNKNOWN] until you re-run the simulation on the new heads. Re-run it at every Gate A.
- **Rule** ([merge readiness rule](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#merge-readiness-rule)):
  whichever passes Gates A to D first merges first; the second takes `main`, keeps DECISIONS in number order and keeps
  both sides' rows in CHANGELOG, PROJECT_STATE, KNOWN_ISSUES and TESTING, then re-runs its full checks.
- **What you check on the second merge** (RR-03): decisions D-036 to D-041 appear once each and in order
  (`git show <ref>:docs/DECISIONS.md | grep -o '^## D-[0-9]*'`); the set of KI ids after the merge is the union of
  both sides (`grep -o 'KI-[0-9]\{3\}' | sort -u`, compared with both parents); every CHANGELOG and TESTING row of
  both sides is present; PROJECT_STATE describes both changes; `docs-links` passes.

### 6.3 Retiring the AG ledger entries (KI-147)
- **What.** The two builds treat a Crore cell that holds text differently today. The live page blanks it and falls
  through to Lakh, then rupees (D-041 point 4, on `main`). The new app marks the amount invalid and excludes the
  holding (the owner's "no fallback" of 24 Oct; D-039 point 1, branch only). The difference is ledgered as **AG-13
  and AG-14** in `tests/parity/aggregation-ledger.json` (lines 159 and 171 on G1 `4610684`). [VERIFIED]
- **The trap.** The aggregation parity test requires every active entry to be used. When TA-05 makes the live page
  follow "no fallback", AG-13 and AG-14 stop matching anything and the test fails. G1 also **pins the exact retired
  list** at `tests/parity/aggregation.parity.test.ts:68`: `['AG-01', 'AG-02', 'AG-05', 'AG-06', 'AG-08']`.
  [VERIFIED: `git show 4610684:tests/parity/aggregation.parity.test.ts`] On `07a6460` (before G1) the test counts every
  entry as must-be-used (line 75), which is one of its 4 failures today. [VERIFIED]
- **Rule.** Whichever of TA-05 or M1.4 lands **second** retires AG-13 and AG-14 **and** adds them to the pinned list,
  in the same PR (FILE_OWNERSHIP hotspot rule; I-14; RR-04).
  - M1.4 first (the likely case [INFERRED]): M1.4 lands with AG-13 and AG-14 active; TA-05 later retires them. That
    is a Workstream A chat editing a Workstream B file, with the precedent of fix batch 4 editing the BF ledger
    (commits `bf2db99`, `b8a8d7f`).
  - TA-05 first: M1.4 takes `main`, retires AG-13 and AG-14 itself and updates its KI-147 legacy expectation test.
- **The ids are final only after NB-01 integrates G1** (I-14). TA-05 uses the ids NB-01 confirms to MOD-02.
- **PD-09 is open:** do placeholders such as "NA", "N/A", "-" and "nil" count as blank? The new app's built lead
  default says yes (D-039 point 1(c)). Both builds must use the same answer when the second change merges.
- **What you check.** The retired entries keep `legacyBefore` and a plain reason that names D-042 (the test enforces
  both at lines 61 to 64 on G1); the pinned list is extended, not replaced; no `regression` class entry is added at
  merge; D-042 covers invested value, market value and gain alike, as D-039 point 1 does.

### 6.4 Vendored libraries
- **What.** The four libraries in blocks 00 to 03 (Chart.js 4.4.0, chartjs-plugin-datalabels 2.2.0, SheetJS CE
  0.18.5, PptxGenJS 3.12.0 with JSZip) and the logos block 06 are shipped byte for byte. M1.4 copies the same bytes
  into `app/vendor/` with SHA-256 pins in `app/vendor/MANIFEST.json` (D-038, branch only), and CI runs
  `vendor-extract.mjs --check` (m14 `ci.yml` line 74). The four SHA-256 values are in
  [INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md) section 2.11. [VERIFIED]
- **What can go wrong.** After M1.4 merges, any change to blocks 00 to 03 or 06 of the live page fails the new app's
  CI (RR-05). The legacy library blocks must never change; a library upgrade (for example SheetJS, TB-26) changes only
  the new app's copy, under a recorded decision.
- **Security.** SheetJS CE 0.18.5 carries CVE-2023-30533 and CVE-2024-22363 (TB-26, EXISTING DEFECT): the M1.4 PR
  body must state it. `app/vendor/*.js` and `app/src/config/brand-logos.json` have **no deny-list exemption**; whether
  they pass the private scan is [UNKNOWN] until NB-01 runs it (TB-08). A new exemption needs a lead decision, you and
  the security-release-reviewer (I-24).
- **`check-next.mjs` changes with M1.4** (+205 / -20 lines). It now lets a library's network-API names, URLs and
  inline sequences through only inside that library's own script, pinned by the MANIFEST `allow` block (D-038,
  CLAUDE.md text on m14). This is a deliberate loosening of a safety check. Review it line by line: the allowance must
  be scoped to the script whose SHA-256 is the library's, with exact counts, and every other rule must stay as strict.

### 6.5 MD5 pins
- **Whole-page MD5s are records, not guards, except where a check pins them.** Where they are pinned:
  - `node tools/check-invariants.js --expect-md5 <MD5>` in each PR's Gate C, and `release-check.mjs --expect-md5`;
  - the Pages verification after a merge: live `/` MD5 equals `git show origin/main:index.html`;
  - on `07a6460`, `scripts/vendor-extract.mjs:41` holds `LEGACY_MD5 = '911A0465...'` and a unit test pins it, so that
    test fails against `12B5E572` today. G1 keeps the constant only as the provenance record in each MANIFEST
    "source" line and makes block equality (`--check`) the guard. [VERIFIED: `git diff 07a6460 4610684 --
    scripts/vendor-extract.mjs`] Check that the M1.4 PR includes this, or the next live-page change breaks it again.
- **Every live-page change moves the MD5.** The PR records the new MD5 in its CR, PROJECT_STATE and TESTING (RR-06).
- **The tax batch lineage** [VERIFIED: `git show <sha>:index.html | md5sum`]: `12B5E572` (`main`) plus T1 to T4 gives
  `0713C6BE` at `97a7d69`; plus the T5 patch gives `5F1C2FC5` at `0f1c5d3` (16,908,418 bytes). The T5 MD5 will change if
  EX-01 edits the T5 patch.
- **How to reproduce a page.** Not "check out `index.html` and replay every patch": 4 of 9 patches on `main` refuse
  because later patches rewrote their anchors (TA-23). Use **the parent page's MD5 plus this branch's new patches in
  order** (section 9). [VERIFIED: scratch replay, 28 Oct, architecture investigation]
- **A private note** still records the old guard MD5 `911A0465` (TC-14); it is not used by any check.

### 6.6 Other overlaps to watch
- **G1 and G2 both edit `tests/fixtures/make-books.ts`**; G2 also edits `tests/helpers/node-wiring.ts`, which G3 asked
  for. A conflict inside NB-01's integration is likely (RR-20). [VERIFIED: file lists]
- **`.github/workflows/ci.yml`**: M1.4 adds `vendor-extract --check` before the fetch of `main`. `release-check --ci`
  must stay the last step. Any change needs MOD-02's go and your review.
- **Pages triggers.** M1.4 changes `package.json` and `check-next.mjs`, both in the Pages path filter; its merge
  republishes both `/` (unchanged) and `/next/` (about 2 MB instead of 46,905 bytes [INFERRED from NB-01's local
  build of 1,991,388 bytes]).
- **TA-10, the October refresh**, splices new data into `index.html`; every open branch then takes `main` and the
  new build's refdata parity and the AI Analyst test run on new data (RR-10).

## 7. Regression tests each area needs

Run what the change touches, and say what was skipped and why. Commands and meaning are in
[docs/TESTING.md](../TESTING.md); the gate list is in [project-control/README.md](../project-control/README.md#6-gates-a-to-e).
"Both TZ" means once with `TZ=Asia/Kolkata` and once with `TZ=UTC`.

| Area changed | Tests that must run and pass | Also check |
|---|---|---|
| Engine block 07 (any) | `check-invariants --expect-md5 <final>`; `smoke-review.js` (both TZ); `test-ai-analyst.js`; `run-regression.js` (every file, both TZ); `node --test` (both TZ), because the BF parity test (and the AG test once M1.4 merges) runs the live engine | financial-domain-reviewer for any number; the page re-derived from the parent MD5 plus the new patches |
| `parseBaseRows` or base-file rules (I-01 to I-03) | as above, plus `tests/parity/base-file.parity.test.ts` with ledger retirements in the same PR | `docs/legacy/ARCHITECTURE.md` or `docs/DATA_DICTIONARY.md`; the owner's open questions BF-19, BF-26, PD-08 |
| `computeReview` or the money rule (I-02) | as above, plus the AG parity test on the simulated merge with M1.4 and G1 | AG-13 and AG-14 retirement and the pinned list (section 6.3) |
| Taxation (`computeTaxation`, tax classes, `TAX_RULES`) | the KI-160 to KI-182 files and `CR-0008-T5-followups.js`; smoke 36/36; `data-extract --check`; refdata parity | the TR table in `capital-gains-upload.md` section 10 agrees (I-21); browser Taxation tab and tax slides |
| Exporters block 08 (I-17, I-18) | smoke (full deck, every tab group, the workbook); browser acceptance steps 5 and 6 | decks and workbooks opened in PowerPoint and Excel at every pagination boundary (TA-11) |
| UI block 11, per-family state (I-10, I-07) | browser acceptance ([TESTING.md](../TESTING.md) section 4) with `family-isolation.js` (11 checks on the tax page) and `cvs-refresh.js` | new state cleared in `resetFamilyState()`; no new `localStorage` key without the security reviewer |
| Parsers block 09, IRR workbook (I-04) | `run-regression.js`; smoke XIRR known answers | financial-domain-reviewer |
| `REFDATA` or `MF_ER_TABLE` data (I-05, I-06) | `check_blocks.js` gate; `check-invariants`; `node scripts/data-extract.ts` then `--check`; refdata parity; AI Analyst test | the owner's "publish" before merge (D-017) |
| `tools/engine-host.js`, `tools/make-sample-base.js` (I-11, I-12) | every legacy tool and every new-build parity test | frozen interfaces: MOD-02's coordination and WS-B told first |
| Block markers (I-08) | every reader: check-invariants, engine-host tools, `data-extract --check`, the SheetJS helper, `vendor-extract --check` | all 7 copies changed in one PR |
| New-app engine, ingest, model | `node --test` (both TZ); `traceability.mjs`; parity tests; `npm run typecheck` | the `// covers:` line on every new test file |
| New-app exports (I-19) | `tests/exports/**`, `tests/integration/**`; `npm run accept:office` verdict PASS | Office scripts blocked by policy are "not run", never passed |
| Build, CSP, layout, `check-next.mjs` | `npm ci`; `npm run build`; `check-next.mjs --rebuild`; `node tests/browser/next-spike.mjs`; `tests/next/*` | no check weakened; size budget; one remote URL (I-23) |
| Vendored libraries (I-20) | `vendor-extract.mjs --check`; build hash checks | security review; a recorded decision for any version change |
| Workflows (I-27) | `tests/next/pages-workflow.test.mjs`; a dispatched CI run on the branch | D-034 ordering kept; deploy job runs no repository code |
| Validation scripts and policy (I-15, I-16, I-24) | their tests under `tests/validation/` and `tests/next/` | never weakened to make a push pass |
| Documents only | `docs-links.mjs`; `privacy-scan.mjs` with the deny-list exported; `release-check.mjs` | no client data, no private paths beyond `C:\dev\private` |
| Every change before push and merge | `prepush-scan.mjs` with `PRD_PRIVACY_DENYLIST` exported on the **final** head; `release-check.mjs`; CI green on the PR head | the scan output says the deny-list was applied |

**Tests changed to pass.** When a change edits the expectation of an existing test (for example the KI-166, KI-169,
KI-170 and KI-171 tests in the T5 commit), each edited expectation must trace to a numbered item, decision or KI that
changed the behaviour. An expectation loosened without a reason is a blocking finding.

## 8. Gate B review checklist

Use it for every material change. For a docs-only or tooling-only change, the lighter path applies (items 1, 2, 9, 10
and 12 in short form). Each answer cites a command, file and line.

1. **Entry.** A complete Gate A report exists (task id, REQ, CR, D and KI ids, branch, worktree, base and head SHA,
   page MD5 before and after or build size and SHA-256, `git diff --stat`, every check run with counts and TZ, checks
   not run, open issues, scope growth). The head is readable locally (`git cat-file -e <sha>`) and equals what the
   chat reported (`git rev-parse`, and `git ls-remote origin` if pushed). The worktree is clean
   (`git -C <worktree> status --porcelain` is empty).
2. **Scope and ownership.** Every changed file belongs to the task's owner or is a hotspot touched under its rule. No
   other active change edits the same file without MOD-02's coordinated plan. The scope matches the change-impact
   contract; any growth is recorded.
3. **The diff itself.** Read every hunk of code. For `index.html`, read the patch scripts, never the page diff, and
   re-derive the page MD5 from the parent MD5 plus the branch's new patches (section 9). Map every patch edit to a
   numbered item of its header; an edit with no item is a finding.
4. **Interfaces.** For each I-xx the diff touches, every consumer listed in
   [INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md) is checked: by `git grep` on `main` and on every
   active branch, and by running its tests. Additive only for ENGINE keys; `ENGINE_KEYS` updated; markers unchanged.
5. **Merge simulation.** Against the current `main` and against every other active branch:
   `git merge-tree <merge-base> <a> <b>`. List conflicted files and hunks. For a cross-build risk, build the merged
   tree in a scratch worktree and run the other workstream's tests there.
6. **Duplicated business logic.** Does the change alter a rule that also lives in the other build (the two tax tables,
   the money rule, merged folios, base-file reading)? If so, is the other side told, aligned, or ledgered?
7. **Regression tests.** The tests section 7 names for each area exist, ran on this head, and pass; new behaviour has a
   known-answer test; edited expectations trace to a reason; every new test file has its `// covers:` line.
8. **Domain reviews.** financial-domain-reviewer "approve" for any calculation, tax rule or reading rule;
   security-release-reviewer GO on the staged diff; qa-engineer planned for anything visible. Record their status;
   you do not substitute for them.
9. **Documents.** The PR updates CHANGELOG, PROJECT_STATE, TESTING, the CR record, and DECISIONS and KNOWN_ISSUES with
   ids from the author's range; the architecture or data dictionary when an interface changes; CLAUDE.md when a check
   count changes. Stale statements it touches are corrected.
10. **Privacy and security.** No client data, PAN, folio, secret, private path beyond `C:\dev\private`, Screener score
    or rank, session id or private link; no new network API or remote URL; no new `localStorage` content; the
    pre-push scan with the deny-list on the final head. If a scan matches a deny-list word, report the file and line
    only, never the word.
11. **Integration and recovery.** What else must take `main` after this merges; which dependent task must be told; how
    to undo it (section 13 has a lead on reverts); whether Pages republishes.
12. **Verdict.** GO or NO-GO on the exact head SHA, with findings (section 10). Any new commit voids the verdict; you
    review the delta before a new GO.

## 9. How to review without writing

**Default: read-only.** Use `git -C <path>`, `git show <ref>:<path>`, `git diff`, `git log`, `git ls-remote`,
`git merge-tree` (the three-argument form writes nothing) and read-only `gh` (`gh run list`, `gh pr view`,
`gh pr diff`). In Bash never `cd` out of `C:\dev\portfolio-review`; use absolute paths. Node is
`C:/dev/tools/node/node.exe` if PATH lacks it.

**Scratch worktrees** (allowed by lead ruling R-7 of 28 Oct, for review only; see
[DECISION_LOG.md](../project-control/DECISION_LOG.md) section 1.3):
- Create detached, so no branch is made:
  `git -C /c/dev/portfolio-review worktree add --detach /c/dev/portfolio-review/.claude/worktrees/arc-01-<task>-<short-sha> <sha>`.
- Only you write there, and only commands whose outputs are git-ignored (`.blocks/`, `test-data/`, `node_modules/`,
  `app/dist/`), plus the temporary page re-derivation below, restored before removal.
- Remove it when the review ends: `git -C /c/dev/portfolio-review worktree remove <path>` **without** `--force`. If
  git refuses, stop and tell MOD-02; never force it.
- Tell MOD-02 when you create and remove one, so the worktree count in the verify block stays explained.
- Never serve a page from it without a port from MOD-02 (new ports start at 8140; do not use 8099, 8100, 8101,
  8103, 8106, 8107 to 8126 or 8133 to 8135: see the [port register](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#port-register)).

**Recipes.**
- *Re-derive a page:* in a scratch worktree at the head under review, write the parent page over `index.html`
  (`git show <parent>:index.html > index.html`), run the branch's new patch scripts in file-name order, compare
  `md5sum index.html` with `git show <head>:index.html | md5sum`, run each patch again (it must report no change), then
  `git -C <scratch> restore index.html`.
- *Fresh block line numbers:* `node <scratch>/tools/extract-blocks.js <scratch>/.blocks` (it reads the `index.html`
  beside the script and writes only to the folder you give).
- *Cross-build test of a simulated merge:* in a scratch worktree at one head, `git -C <scratch> merge --no-ff
  --no-commit <other ref>`; run `node --test` (both TZ) and the legacy checks there; then `git -C <scratch> merge
  --abort` and confirm `git -C <scratch> status --porcelain` is empty before removal.
- *Who calls an interface:* `git grep -n '<name>' <ref> -- tools tests scripts app` for `main` and every active branch.
- *Shared-document union after a merge:* section 6.2.

**What you may not run, even in scratch:** `buildtools/*` on real vendor files, `tools/render-slides.js` on a real
base file, anything that reads real client files, or any command that pushes, opens a PR, dispatches a workflow or
writes to GitHub.

## 10. Reporting to MOD-02

**Where it goes.** Write the report in your own chat. Send it to MOD-02 by cross-session messaging if that tool is
available in your session; otherwise tell the owner it is ready to paste into MOD-02's chat. Never say a message was
sent when it was not. MOD-02 records it as a gate row in the integration log; the implementing chat quotes your
verdict in the PR body. You do not post on GitHub.

**Format** (one report per change and head; no dashes inside sentences):

```text
ARC-01 Gate B report, <date and time IST>
Task:            <TA/TB/TC id> (<REQ, CR, D and KI ids>)
Change:          <branch>, worktree <path>, author chat <EX-01 or NB-01>
Base / head:     <base SHA> / <head SHA, full>; merge-base with main <SHA>
Page or build:   index.html MD5 <before> to <after> (re-derived: yes or no, how); or /next/ build <bytes>, SHA-256 <hash>
Verdict:         GO or NO-GO, valid only for the head above
Read:            <diff ranges and files read>
Ran:             <each command, result, counts, TZ>
Not run:         <each check not run, and why>
Findings:        F1 BLOCKING or NON-BLOCKING: <title>
                   where: <file:line>; evidence: <command or quote>; why it matters: <...>;
                   action: <what must change>; owner: <chat>
Interfaces:      <I-xx touched: consumers checked and how>
Merge simulation:<against main; against each active branch: files and hunks>
Tests:           <required / present / ran / missing>
Domain reviews:  financial-domain-reviewer <status>; security-release-reviewer <status>; qa-engineer <status>
Documents:       <updated / missing>
Outside Gate B:  <merge preconditions that are not yours, for example owner answers>
Residual risk:   <what stays risky after merge, and the recovery>
Register changes proposed: <file, row, the change, the evidence>
Labels:          every claim [VERIFIED] with evidence, or [INFERRED] / [UNCERTAIN] / [UNKNOWN]
```

**Rules for the verdict.**
- GO means no blocking finding remains on that exact head. There is no conditional GO: anything that must change
  before the merge is a blocking finding.
- A new commit on the branch (a fix, or taking `main`) voids the GO. Review the delta (`git diff <old head> <new head>`)
  and the new merge simulation, then give a new verdict.
- Non-blocking findings become proposed follow-up tasks for MOD-02 to allocate.
- **After the merge** (ruling R-4): confirm the merge commit's second parent is the head you passed
  (`git rev-parse <merge>^2`), that the message follows D-020 (I-25), that the shared documents kept both sides
  (section 6.2), and spot-check the live page: `curl -s https://productsteamcentricity.github.io/portfolio-review-dashboard/ | md5sum`
  must equal `git show origin/main:index.html | md5sum` once the Pages run has finished. Report the result to MOD-02.

## 11. Escalation

The procedure is [project-control/README.md](../project-control/README.md) section 8.4, in short:

1. You give a NO-GO with reasons, each with a file and line.
2. The implementing chat fixes the findings, or answers them in writing. You re-review.
3. If you still disagree, MOD-02 decides, records why and tells both chats. MOD-02 may change scope or order to
   resolve a NO-GO, but it does not merge over a NO-GO that still stands.
4. If MOD-02 cannot settle it, or it touches product behaviour, a financial rule or accepting a known risk, MOD-02 asks
   the owner in plain language (one decision, short sentences, options, trade-offs, a recommendation). The owner's
   answer is final.
5. If you see a merge happen, or about to happen, over a NO-GO that still stands, tell MOD-02 at once and say so
   plainly in your own chat, where the owner reads it. Do not undo anything yourself.

## 12. What ARC-01 must not do

- Implement features, write fixes, or edit any file in another chat's worktree or in the main checkout.
- Make product, financial-rule or tax-rule decisions, or accept a known risk on the owner's behalf. You may say what
  the build does and what the options are.
- Commit, push, open, comment on or merge pull requests; dispatch workflows; change GitHub settings.
- Allocate numbers or assign tasks; edit the registers or handover files (propose changes to MOD-02 instead). A docs
  branch is allowed only if MOD-02 assigns you a docs task.
- Stash, reset, force-push, rewrite history, delete branches, prune worktrees, or use `--no-verify`; remove anything
  but your own clean scratch worktrees.
- Read real client files, run the refresh on real data, or put any private detail (client data, private paths beyond
  `C:\dev\private`, session ids, private links, Screener scores or ranks, anything about a credential) in a report
  that may become public.
- Contact the previous owner, or mention retiring the existing dashboard in anything that could reach them.
- Give a GO on a summary. Never infer that a check passed from a file existing or from another chat's claim.

## 13. Open questions and leads you inherit

| Item | What is known | What you can do |
|---|---|---|
| Reverting a merge that changed `index.html` | The integration log's recovery procedure (section 7, corrected 30 Oct) now records this conclusion and prefers a forward fix. Reading `scripts/validation/release-check.mjs` lines 315 to 320: a changed `index.html` passes only with a non-deleted patch script in the change or on a `data/` branch. A revert of a patch merge deletes that patch script, so the check would **FAIL** unless the branch is `data/` [INFERRED from the code; not run] | Confirm in a scratch worktree and propose the wording to MOD-02 for integration log section 7 (a forward-fix patch may be the practical recovery) |
| M1.4 test totals | NB-01 reports 837 tests on `07a6460` (833 pass); an independent IST run counted 773 (769 pass); the same 4 failures [VERIFIED both counts; cause UNKNOWN] (RR-21) | Require the count explained before the M1.4 GO |
| G2 untested | G2 stopped before it reported [VERIFIED: NB-01 report] | Its tests must run and be reported before integration |
| N16 to N19 | NB-01 lead decisions that appear in no G1, G2 or G3 diff [UNKNOWN: done, deferred or dropped] | Ask NB-01 through MOD-02 |
| T5 scope | The patch header lists items 1 to 8; the `0f1c5d3` message says "the remaining T5 items as listed in the handover" are not done; the D-040 TR cross-reference is a docs item, not in the patch [UNCERTAIN] | Reconcile item by item at TA-03 Gate B ([TA-03 card](../project-control/TASK_REGISTER.md#ta-03-tax-batch-cr-0008-d-040)) |
| Vendored text and the deny-list | No exemption for `app/vendor/*.js` or `brand-logos.json`; scan result [UNKNOWN] | Read the TB-08 scan result when MOD-02 shares it |
| Marker copies | 7 copies, no cross-check test (IMP-C17) | Propose the test as a small WS-B task |
| `ENGINE_KEYS` incomplete | TA-22; the tax branch adds 4 keys | Finding at TA-03 Gate B under the I-09 rule |

## 14. Standing duties after the first two reviews

| Duty | Task | With |
|---|---|---|
| Baseline verification: interface table, merge simulation, ownership map confirmed against git | TC-04 | MOD-02 |
| Gate B on every material change, including TA-05, TA-10 and every M2 to M16 milestone PR | all | the implementing chat |
| Review TA-05's change-impact contract before it starts (engine block, AG ledger, D-042, PD-09) | TA-05 | EX-01 |
| Keep the regression-risk register current: propose new, changed or closed RR rows after each Gate B ([section 7 of the register](../project-control/KNOWN_ISSUES_AND_REGRESSION_RISKS.md#7-regression-risk-register)) | all | MOD-02 writes |
| Reword the patch rebuild rule; refresh `.blocks/` and legacy line counts | TA-23 | EX-01 |
| AC-22 force-push detection: build it or correct the three documents that claim it | TB-24 | NB-01 |
| Refresh the six agent definitions (qa-engineer's 17 checks, no `tools:` line; no agent names run-regression, data-extract, vendor-extract, prepush-scan or release-check) | TC-17 | MOD-02 |
| Housekeeping report (stale worktrees, stale ports, upstream hazards, lockfile engines): report only, nothing deleted without the owner's word | TC-18 | MOD-02 |
| Marker cross-check test | IMP-C17 | NB-01 |
| Your own handover at 3 compactions or lost context, with the [subchat template](SUBCHAT_HANDOVER_TEMPLATE.md) | none | MOD-02 commits it |

## 15. Change log

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version, for the launch of ARC-01 under TC-04 |
| 30 Oct 2026 | MOD-01 (fixer pass) | Validation findings applied: working `git rev-parse` evidence; the scratch-worktree allowance cites lead ruling R-7; ports 8101 and 8103 added to the avoid list; the revert lead points to the corrected recovery procedure |
