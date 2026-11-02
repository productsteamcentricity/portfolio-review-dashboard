# Active change register

Last verified: **28 Oct 2026 (IST)**, by MOD-01; rows for TA-03, TC-01 and TC-02 updated on 2 Nov 2026 by MOD-02 (the other rows are unchanged since 28 Oct and were re-checked against git on 2 Nov). Maintained by **MOD-02**, reviewed by **ARC-01**.

One entry per change that is in flight: a branch with work not yet on main, or work about to start in a worktree.
The fields are the ones the owner's 27 Oct handover prompt (section 10) asks for. Task details are in
[TASK_REGISTER.md](TASK_REGISTER.md); who may edit which file is in
[FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md); branch and worktree facts are in
[REPOSITORY_AND_ENVIRONMENT_STATE.md](REPOSITORY_AND_ENVIRONMENT_STATE.md). Gate results go to
[INTEGRATION_AND_REGRESSION_LOG.md](INTEGRATION_AND_REGRESSION_LOG.md).

**Rule.** Before a chat edits a file or shared component, it checks this register. If another active change touches the same file,
MOD-02 assigns one owner, sequences the work, or writes an explicitly coordinated plan. Nobody reconciles shared files later by guesswork.

**Status words:** VERIFIED COMPLETE; IMPLEMENTED, NOT FULLY VERIFIED; IN PROGRESS; PLANNED; BLOCKED; NOT STARTED; EXISTING DEFECT;
UNKNOWN / NEEDS INVESTIGATION; SUPERSEDED. **Evidence labels:** [VERIFIED], [INFERRED], [UNCERTAIN], [UNKNOWN].

## Summary on 28 Oct 2026 (rows 1, 6 and 7 updated 2 Nov)

| # | Task | Chat | Branch @ head | On origin | Status | Ownership released |
|---|---|---|---|---|---|---|
| 1 | TA-03 tax batch | EX-01 (since 2 Nov) | `fix/legacy-batch-3-tax-cr-0008` @ 0f1c5d3 (local; the checkpoint `continuation/ex-01-task-ta-03-20261027` stays at 0f1c5d3 on origin) | continuation: yes; fix/: **no** | IN PROGRESS | No: the files stay reserved for TA-03; responsibility passed to EX-01 on 2 Nov |
| 2 | TB-06 M1.4 integration | NB-01 | `feat/m1-4-overview` @ 07a6460 | **no** | IN PROGRESS | No |
| 3 | TB-07 round-2 fixer G1 | NB-01 | `worktree-wf_bdc6c774-599-1` @ 4610684 | **no** | IMPLEMENTED, NOT FULLY VERIFIED | No |
| 4 | TB-07 round-2 fixer G2 | NB-01 | `worktree-wf_bdc6c774-599-2` @ be7f395 | **no** | IN PROGRESS (untested) | No |
| 5 | TB-07 round-2 fixer G3 | NB-01 | `worktree-wf_bdc6c774-599-3` @ 202f8f6 | **no** | IMPLEMENTED, NOT FULLY VERIFIED | No |
| 6 | TC-01 handover package | MOD-01 → MOD-02 | `handover/mod-01-to-mod-02-20261028` @ 5f551cc | yes | VERIFIED COMPLETE (merged as PR #17, 4a1a747, 30 Oct) | Yes (merged) |
| 7 | TC-02 register update | MOD-02 | `docs/registers-1` @ 227f65a (PR #18) | yes | IN PROGRESS (Gate B quick review GO by ARC-01 for 227f65a; security GO pending) | No |

All SHAs [VERIFIED: `git rev-parse` and `git ls-remote origin`, 28 Oct; rows 1, 6, 7 and the NB-01 heads re-checked 2 Nov]. Every worktree listed is clean: 0 staged, 0 unstaged,
0 untracked [VERIFIED: `git status --porcelain`, repo-env investigation, 28 Oct].

**Next changes, not yet active:** TA-05 (fix batch 5) starts only after TA-03 merges; TA-10 (October refresh) starts when the owner's files
arrive (11 to 17 Nov). Neither has a branch yet [VERIFIED].

## Overlaps found by a merge simulation

A read-only `git merge-tree 6443826 origin/continuation/ex-01-task-ta-03-20261027 feat/m1-4-overview` on 28 Oct [VERIFIED]:

| File | Changed by TA-03 | Changed by M1.4 | Text conflict |
|---|---|---|---|
| `docs/DECISIONS.md` | D-040 | D-038, D-039 | **yes, 1 hunk** (both insert between D-037 and D-041) |
| `docs/KNOWN_ISSUES.md` | KI-160..KI-182; edits to KI-037, KI-064, KI-099, KI-109, KI-130 | KI-147 fixed in the new app, KI-150, KI-151 | **yes, 2 hunks** |
| `docs/PROJECT_STATE.md` | tax batch state | M1.4 state | **yes, 1 hunk** |
| `CHANGELOG.md` | yes | yes | no (clean) |
| `docs/TESTING.md` | yes | yes | no (clean) |

No code file is changed by both [VERIFIED]. The second of the two to merge resolves the four hunks under the
[merge readiness rule](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#merge-readiness-rule): take main, keep decisions in number order, keep both
sides' rows.

Inside round 2: G1 and G2 both edit `tests/fixtures/make-books.ts` (a conflict is likely [INFERRED]); G2 edits
`tests/helpers/node-wiring.ts`, which G3 asked for through a sharedFileRequest [VERIFIED: `git diff --name-only`].
G1, G2 and G3 share no file with TA-03 [VERIFIED].

## 1. TA-03: tax batch (CR-0008, D-040)

| Field | Value |
|---|---|
| Task id | TA-03 (requirements REQ-066, REQ-029; CR-0008; decision D-040; defects KI-160..KI-182, KI-099, KI-130; OD-2, OD-12, OD-28) |
| Responsible chat | MOD-01 until handover, then **EX-01** (took the worktree on 2 Nov 2026; MOD-02 checked its report against git) |
| Workstream | A |
| Worktree | `.claude/worktrees/wf_c9c8da96-497-10` |
| Source branch and baseline | main at **6443826** (PR #16), page MD5 12B5E5727FCA01EF2EA162C59913F01D |
| Task branch | `continuation/ex-01-task-ta-03-20261027` (pushed, upstream is its own origin branch; stays untouched as the handover checkpoint). PR branch: `fix/legacy-batch-3-tax-cr-0008`, created by EX-01 in the same worktree on 2 Nov at 0f1c5d3, local, no upstream yet, checked out there now (R-8). Contains `fix/legacy-batch-3-tax`, `-p2` and `-p3-r2` (local only, nothing unique) |
| Files and modules being modified | `index.html` (engine 07, exporters 08, UI 11) through `tools/patches/2026-10-27-tax-1..5*.js` (5 patch scripts); 26 files under `tools/regression/`; `tools/browser-checks/family-isolation.js`; `tools/smoke-review.js`; `data/refdata/TAX_RULES.json` and `VINTAGE.json` (regenerated, D-035); `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`, `docs/PROJECT_STATE.md`, `docs/TESTING.md`, `CHANGELOG.md`, `docs/legacy/ARCHITECTURE.md`, `docs/audits/2026-10-19-decisions.md`, CR-0008 and the change-requests index [VERIFIED: `git diff --name-only origin/main...` on 28 Oct] |
| Blocks of `index.html` changed | Against main: script 04 (REFDATA, the TAX_RULES key only; 25 to 34 rows), 07, 08, 09 (parsers, T2) and 11. Scripts 00 to 03, 05, 06, 10, 12 and the HTML shell are byte-identical. ENGINE keys 24 to 28, additive. T5 alone changes only 07, 08 and 11 [reported by EX-01 from a script-by-script comparison on 2 Nov; MOD-02 has not re-run it] |
| Shared interfaces affected | ENGINE API (adds `taxClassify`, `taxApplyAssumptions`, `taxAssumeFor`, `taxDefaults`; `taxClassify`/`taxClassOf` take an optional date); REFDATA.TAX_RULES (25 → 34 rows, new flags); `data/refdata` (read by NB-01's parity tests and `data-extract --check`); `resetFamilyState()` (new per-family harvest assumption, D-015); the Taxation tab, slides and AI Analyst tax signal. The new build's tax-rule table (TR-1..TR-21) must stay agreed by hand |
| Dependencies and overlapping tasks | Docs conflict with TB-06 (4 hunks above). TA-05 must follow it (same engine block). TA-10 must start from main after whichever merges first |
| Current status | IN PROGRESS. T1..T4: IMPLEMENTED, NOT FULLY VERIFIED. T5: IN PROGRESS, unreviewed (two implementer agents may have run in this worktree) |
| Latest commit | **0f1c5d3** (27 Oct 20:59 IST), WIP checkpoint; parent 97a7d69; page MD5 5F1C2FC56EDA2682822DBF0DB5B44CA3 (16,908,418 B) |
| Review and integration status | Gate A: partial (WIP message only). Gate B: not started. Gate C: run-regression 44 files only on 0f1c5d3; the full list passed on 97a7d69 including prepush; no browser QA of the combined page; CI run 41412086208 (by hand, 2 Nov) succeeded on the WIP head 0f1c5d3. EX-01's change-impact contract of 2 Nov was sent to ARC-01 for review; EX-01 touches no patch file until ARC-01 has reviewed it and MOD-02 sends "continue". Gate D: no PR. Gate E: owner Q17/Q18 open |
| Change-impact contract (Gate B pre-work) | Received from EX-01 on 2 Nov. ARC-01: **ACCEPT with changes** C1 to C5. C1 ENGINE_KEYS: MOD-02 chose to add the four new keys to `tools/check-invariants.js` in the same PR (R-9), so that file joins item 5. C2 item 6 names I-04. C3 `ENGINE.taxDefaults` is live and unfrozen and nothing reads it: EX-01 uses it, drops it or freezes it, decided in its T5 review addendum. C4 item 9 adds CHANGELOG.md, docs/TESTING.md and CLAUDE.md. C5 item 10 names IST and UTC, `check-invariants --expect-md5`, test-ai-analyst, `release-check --ci` and CI on the final head; item 11 says how the forward fix is made (the inverse of the 186 edits, acceptance MD5 12B5E572 plus `data-extract --check`); the task-branch line reads `fix/legacy-batch-3-tax-cr-0008`. Rollback by a plain `git revert -m 1` FAILs release-check legacy-page (the five patch scripts become deleted); the same revert plus one new dated patch script passes [VERIFIED by ARC-01 in a throwaway clone] |
| Interface notes (ARC-01, 2 Nov) | **I-04:** block 09 changes (`parseIRR` free-text dates become UTC midnight of the local day, TX-02). Gate B needs the financial-domain-reviewer's T2 approval naming I-04, a known-answer test in IST and UTC, and NB-01 told (new IRR reader, DATA_DICTIONARY 5.4; queued in the NB-01 relay list). **I-09:** the four new ENGINE keys are added to ENGINE_KEYS in this PR. **I-21:** TAX_RULES is 25 rows on main and 34 on the branch [VERIFIED by ARC-01]. CLAUDE.md: the one smoke line (99, "(35 checks)" to 36) is accepted; the M1.4 branch changes CLAUDE.md at lines 135, 152 and 167 (no overlap expected) |
| Outstanding blockers | PD-02 (Q17) and PD-03 (Q18) before merge, unless the owner accepts the safe defaults now built. T5 review and docs |
| Ownership released | **Yes, to EX-01 on 2 Nov 2026** (its start report; MOD-02 checked it against git). MOD-01 is retired |

## 2. TB-06: M1.4 integration branch

| Field | Value |
|---|---|
| Task id | TB-06 (REQ-036, REQ-040, REQ-041, REQ-044, REQ-067; CR-0006; D-038, D-039; KI-147, KI-148, KI-150, KI-151) |
| Responsible chat | NB-01 |
| Workstream | B |
| Worktree | `.claude/worktrees/m14` |
| Source branch and baseline | main; latest main merged in is **6443826** (merge commit 07a6460) |
| Task branch | `feat/m1-4-overview`, **local only**; upstream wrongly set to origin/main (first push must be `git push -u origin feat/m1-4-overview`) |
| Files and modules being modified | 236 files, +27,324/-492 against main [VERIFIED: `git diff --shortstat`]: `app/src` (94 files: engine/aggregate, engine/review, engine/validate, exports/pptx, exports/xlsx, exports/zip, services, ui, views, config), `app/vendor` (10), `scripts/build.mjs`, `scripts/vendor-extract.mjs`, `scripts/lib`, `scripts/office` (3), `scripts/validation` (1), `package.json` (three npm scripts), `.github/workflows/ci.yml` (adds `vendor-extract --check`), tests (`unit` 30, `exports` 25, `regression` 14, `helpers` 9, `fixtures` 8, `integration` 7, `next` 4, `parity` 4, `browser` 3, `acceptance` 1, `workflows` 1), `docs/new-build` (6), `docs/ARCHITECTURE.md`, `docs/DATA_DICTIONARY.md`, `docs/PRD.md`, `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`, `docs/PROJECT_STATE.md`, `docs/TESTING.md`, `CHANGELOG.md`, `CLAUDE.md`, CR-0006 |
| Shared interfaces affected | Reads `index.html` blocks 00..03 and 06 by marker (vendor-extract, `scripts/lib/legacy-blocks.mjs`, test helpers); `tools/engine-host.js` through `tests/fixtures/make-books.ts`; new aggregation parity ledger `tests/parity/aggregation-ledger.json` (AG-01..AG-14); `MONEY_COLUMN_RULE` (D-039 point 1, the owner's KI-147 "no fallback"); CI workflow; vendored library hashes in `app/vendor/MANIFEST.json`; `app/vendor/*.js` and `brand-logos.json` have no deny-list exemption [VERIFIED: architecture investigation] |
| Dependencies and overlapping tasks | TB-07 (round 2) must be integrated first. Docs conflict with TA-03. Coupled to TA-05 through AG-13/AG-14 and the pinned retired list |
| Current status | IN PROGRESS. 4 tests fail on the head (fixed by G1 [INFERRED]); test totals 773 versus 837 unexplained [UNKNOWN] |
| Latest commit | **07a6460** (27 Oct 19:22 IST) |
| Review and integration status | Round 1 reviews on 6015190 (reported): QA PASS, financial review approved, Office verdict FAIL on one medium item, security NO-GO only because main had moved. Round 3 not started. No PR, no CI run, never pre-push scanned with the deny-list |
| Outstanding blockers | Local only (TB-08). Paused by the owner's stop order. PD-09 for the placeholder rule |
| Ownership released | **No** |

## 3 to 5. TB-07: round-2 fixers G1, G2, G3

All three are based on 07a6460, each holds one commit that exists nowhere else, each sits in its own worktree, and none is on origin
[VERIFIED]. Each branch has no upstream. They are integrated into `feat/m1-4-overview` by NB-01, not merged to main on their own.

| Field | G1 | G2 | G3 |
|---|---|---|---|
| Worktree | `.claude/worktrees/wf_bdc6c774-599-1` | `.claude/worktrees/wf_bdc6c774-599-2` | `.claude/worktrees/wf_bdc6c774-599-3` |
| Task branch @ latest commit | `worktree-wf_bdc6c774-599-1` @ **4610684** (27 Oct 20:53 IST) | `worktree-wf_bdc6c774-599-2` @ **be7f395** (27 Oct 20:57 IST) | `worktree-wf_bdc6c774-599-3` @ **202f8f6** (27 Oct 20:48 IST) |
| Scope (NB-01 lead decisions) | N1..N5, N10, N11; KI-148; AG retirements; KI-151 label grid | N7 (share row outside the filter), N8, N9 (money and percent formats), N15 (Office scripts) | N12 (screen labels and notes), N13 (C-08 pie layout), N14 (safe replacements) |
| Files | `app/src/engine/aggregate/allocation.ts`, `app/src/ingest/base-file.ts`, `app/src/views/notes.ts`, `overview.ts`, `scripts/vendor-extract.mjs`, `tests/fixtures/make-books.ts`, `tests/parity/*` (README, aggregation-compare, aggregation ledger and test, base-file ledger and test), regression tests KI-148 (2) and KI-151, unit tests (review, base-file, entity-case, vendor-extract, negative-cmv) | `app/src/exports/xlsx/*` (entity-allocation, spec, styles, writer), `scripts/office/*` (accept-pptx.ps1, accept-xlsx.ps1, run-acceptance.ts), `tests/exports/xlsx/*` (7), `tests/fixtures/make-books.ts`, `tests/helpers/excel-text.ts`, `node-wiring.ts`, `xlsx-read.ts`, `tests/integration/cross-output.test.ts`, a number-format unit test | `app/src/exports/pptx/*` (chrome, C-08 component, postprocess, types), `app/src/ui/*` (entity-matrix, pie-chart, review-bar, matrix-text, overview-text, s2-overview, shell.css, store, upload-slot), `docs/new-build/deck-design-system.md`, `tests/browser/*` (4), `tests/exports/pptx/*` (3), two UI unit tests |
| Shared interfaces affected | Base-file parity ledger (retires entries), aggregation ledger (retires AG-01, 02, 05, 06, 08; pins that list at `aggregation.parity.test.ts:68`), vendor-extract pin replaced by `--check` equality of library and logo blocks | Office acceptance scripts; the XLSX writer used by later milestones | PPTX post-processing and the C-08 layout; UI store |
| Overlaps | `tests/fixtures/make-books.ts` with G2 | `make-books.ts` with G1; `node-wiring.ts` needed by G3 | `node-wiring.ts` from G2 (sharedFileRequest) |
| Current status | IMPLEMENTED, NOT FULLY VERIFIED: reported 904 tests, 902 pass; the 2 failures need G1's sharedFileRequests (`gate.test.ts:39`, `as-on-change.test.ts:205`) | IN PROGRESS: tests never run or reported | IMPLEMENTED, NOT FULLY VERIFIED: reported 864 tests, 860 pass; the 4 failures are the ones G1 fixes |
| Review and integration status | Not integrated; no review | Not integrated; no review | Not integrated; no review |
| Outstanding blockers | Local only (TB-08); NB-01 paused | Local only; untested | Local only |
| Ownership released | No | No | No |

## 6. TC-01: MOD-01 to MOD-02 handover package

| Field | Value |
|---|---|
| Task id | TC-01 (REQ-070, REQ-075, REQ-076, REQ-077, REQ-078) |
| Responsible chat | MOD-01 (writes and pushes); MOD-02 inherits the branch for later project-control edits |
| Workstream | Coordination |
| Worktree | `.claude/worktrees/handover` |
| Source branch and baseline | origin/main at **6443826** |
| Task branch | `handover/mod-01-to-mod-02-20261028` (pushed with `-u`, upstream is its own origin branch; merged as PR #17) |
| Files and modules being modified | New files under `docs/project-control/` and `docs/handover/`, plus a 3-line "historical snapshot" banner at the top of `docs/HANDOVER.md` (its "Last refreshed" line unchanged) [VERIFIED: `git diff --stat` shows `docs/HANDOVER.md \| 3 +++`, 30 Oct]. No product code, no `index.html`, no `app/` |
| Shared interfaces affected | None in code. Adds the coordination registers every chat must read |
| Dependencies and overlapping tasks | It edits the shared doc `docs/HANDOVER.md` (banner only), a hotspot the monthly cycle refreshes (TA-21); the readiness rule applies if another branch edits it. Neither the TA-03 branch nor `feat/m1-4-overview` touches it [VERIFIED: `git diff --name-only`, 30 Oct] |
| Current status | VERIFIED COMPLETE: merged as PR #17 (4a1a747) on 30 Oct 2026 |
| Latest commit | 5f551cc (the package); merge commit 4a1a747 |
| Review and integration status | Done: PR #17 merged on 30 Oct (D-020 merge); Dashboard checks success on 4a1a747 (run 41022932782) [VERIFIED: `gh run list`] |
| Outstanding blockers | None known |
| Ownership released | Yes (merged) |

## Change log of this register

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version: TA-03, TB-06, TB-07 (G1, G2, G3), TC-01 |
| 30 Oct 2026 | MOD-01 (fixer pass) | TC-01 lists the `docs/HANDOVER.md` banner among its files and dependencies |
| 2 Nov 2026 | MOD-02 | TA-03 now EX-01's (branch `fix/legacy-batch-3-tax-cr-0008`, contract accepted with changes C1 to C5, interface notes I-04 and I-09); TC-01 merged (PR #17); TC-02 (PR #18) added; "Ownership released" for TA-03 reads No until it merges |
