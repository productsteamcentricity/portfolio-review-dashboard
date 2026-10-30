# File ownership and change control

Last verified: **28 Oct 2026 (IST)**, by MOD-01. Maintained by **MOD-02** with **ARC-01**.

This file says who may change which part of the repository, how two chats avoid editing the same thing, who decides what,
and how numbers (D, KI, CR) are allocated. What is in flight right now is in [ACTIVE_CHANGE_REGISTER.md](ACTIVE_CHANGE_REGISTER.md).
The standing repository rules stay in [CLAUDE.md](../../CLAUDE.md) and [docs/DECISIONS.md](../DECISIONS.md) (D-016, D-017, D-020,
D-028, D-033, D-034, D-035); this file applies them to a project with several chats and does not replace them.

**Evidence labels:** [VERIFIED], [INFERRED], [UNCERTAIN], [UNKNOWN]. Rules marked "lead decision, 28 Oct" were set by MOD-01 under D-033
for this handover; MOD-02 may change them and records the change here.

## Ownership by area

| Area | Paths | Owner | Others may | Change rule |
|---|---|---|---|---|
| Live product | `index.html` | **Workstream A** (EX-01; MOD-01 until handover) | read only (NB-01's extractors and tests read blocks by marker) | Only through an anchored patch in `tools/patches/<yyyy-mm-dd>-<slug>.js` on `tools/patch-lib.js` (CLAUDE.md rule 1, D-016); D-028 scope (calculation, data and security fixes only); data blocks only through the monthly refresh with the owner's "publish" |
| Legacy patches and checks | `tools/patches/*`, `tools/regression/*`, `tools/*.js`, `tools/browser-checks/*`, `tools/package.json` | **Workstream A** | read only | Known-answer test per fixed issue; full legacy check list of [docs/TESTING.md](../TESTING.md) |
| Frozen legacy tool APIs used by both builds | `tools/engine-host.js` (`load()`, `build()`), `tools/make-sample-base.js` (`build`, `buildFamilyB`, `AS_ON`) | Workstream A | read and call | Treat as frozen: changing them breaks NB-01's fixtures (`tests/fixtures/make-books.ts`) and parity tests. Any change needs MOD-02's coordination and ARC-01 review |
| Monthly refresh pipeline | `buildtools/*`, `docs/refresh-log/*`, `docs/MONTHLY_REFRESH.md` | Workstream A (refresh-operator agent, run by EX-01) | read only | Only on a `data/YYYY-MM-refresh` branch; merge only after the owner's "publish" (D-017) |
| Legacy docs | `docs/legacy/*`, `docs/audits/*`, Workstream A change requests (CR-0001..CR-0005, CR-0007..CR-0009) | Workstream A | cross-reference | Update in the same PR as the change |
| New app | `app/**`, `scripts/build.mjs`, `scripts/serve.mjs`, `scripts/vendor-extract.mjs`, `scripts/lib/*`, `scripts/office/*` | **Workstream B** (NB-01) | read only | CLAUDE.md new-build rules; one PR per milestone unit in its own worktree |
| New-app tests | `tests/next/*`, `tests/unit/*`, `tests/exports/*`, `tests/integration/*`, `tests/browser/*`, `tests/fixtures/*`, `tests/helpers/*`, `tests/regression/*.test.ts`, `tests/parity/*` code | **Workstream B** | read and run | Every test starts with a `// covers:` line (traceability) |
| Extractor | `scripts/data-extract.ts` | Workstream B | run it | Its output `data/refdata/*` is a shared hotspot (below) |
| New-build docs | `docs/new-build/*`, `docs/ARCHITECTURE.md`, `docs/DATA_DICTIONARY.md`, `docs/PRD.md`, CR-0006, `monthly_updates/*`, `product_bank/*` | Workstream B | cross-reference | Update with the milestone |
| Build tooling | `package.json`, `package-lock.json`, `.npmrc` | Workstream B | read | Pinned exact versions (D-025, D-034); a change also triggers Pages, so MOD-02 is told first |
| Safety tooling | `scripts/validation/*`, `scripts/hooks/pre-push` | Workstream B code (built in M1.1) | run | Policy files below are hotspots; never weaken a check or bypass the hook |
| Project control | `docs/project-control/*`, `docs/handover/*` | **MOD-02** | ARC-01 co-maintains the interface and ownership records; other chats propose changes to MOD-02 | Dated, versioned handovers; never overwrite a historical handover silently |

### Shared hotspots: coordinated by MOD-02

These files are edited by both workstreams. Each has a rule, so that two branches never "fix up" the same file later by guesswork.

| Hotspot | Rule |
|---|---|
| `docs/DECISIONS.md` | Append only, from your allocated range (see [Numbering allocation](#numbering-allocation)). Keep entries in number order. Never renumber a merged entry. The second branch to merge resolves conflicts by keeping both entries in number order |
| `docs/KNOWN_ISSUES.md` | Same as DECISIONS. A chat edits only its own KI rows unless MOD-02 assigns otherwise (for example closing a twin such as KI-151/KI-183, TB-27) |
| `CHANGELOG.md`, `docs/PROJECT_STATE.md`, `docs/TESTING.md` | The second to merge takes main and keeps both sides' rows |
| `docs/change-requests/README.md`, `docs/HANDOVER.md` | One row per CR; MOD-02 allocates CR numbers. HANDOVER.md is refreshed by MOD-02 or by the monthly cycle |
| `data/refdata/*` | Generated, never hand-edited (D-035): run `node scripts/data-extract.ts` in the same change that alters REFDATA, then `--check`. Whoever changes REFDATA regenerates it |
| `tests/parity/base-file-ledger.json`, `tests/parity/aggregation-ledger.json` (branch only today) and the pinned retired list in `tests/parity/aggregation.parity.test.ts` | A legacy fix that changes behaviour retires or adds the matching entry in the **same PR**. Retiring an AG entry also edits the pinned retired list (line 68 on G1 4610684 [VERIFIED]). Precedent: fix batch 4 edited the base-file ledger (commits bf2db99, b8a8d7f) |
| `.github/workflows/ci.yml`, `.github/workflows/pages.yml` | Change only with MOD-02's go and ARC-01 review. Remember the Pages path filter (D-034: a preview failure never blocks the live page) |
| `CLAUDE.md`, `.claude/agents/*.md`, `.claude/launch.json` | MOD-02 coordinates; ARC-01 reviews (TC-17 refreshes the stale agents) |
| `scripts/validation/privacy-allowlist.json`, `monthly_updates/_policy/publication-classes.json` | Policy files: a change needs the decision it rests on (D-026, D-033, D-035). Never put a deny-list term in the repo |
| Block marker strings of `index.html` | Copied in 7 places (check-invariants, engine-host, extract-blocks, data-extract.ts and `tests/helpers/sheetjs.ts` on main; on NB-01's branch `scripts/lib/legacy-blocks.mjs` and `tests/helpers/pptxgenjs.ts`) [VERIFIED: architecture investigation; `git ls-tree origin/main tests/helpers/`, 30 Oct; [INTERFACE_CONTRACTS.md](INTERFACE_CONTRACTS.md) section 2.7]. Never change a marker; if unavoidable, update every copy in one PR |
| ENGINE API keys (`window.ENGINE`) | Additive only; never rename a key; update `tools/check-invariants.js` ENGINE_KEYS in the same PR (TA-22 notes it is already incomplete) |

## Worktree isolation rule

1. **One task, one worktree, one branch.** A task's work happens only in its own worktree under `.claude/worktrees/`, on its own branch.
2. **Single writer per worktree.** Only one agent or chat writes in a worktree at a time. **Never two agents in one worktree.** This
   happened during TA-03 part T5: commit 0f1c5d3 records two implementer starts in the same worktree, so its patch must be treated as
   unreviewed [VERIFIED: commit message].
3. **A branch alone is not isolation.** Two chats on different branches in the same folder still collide. MOD-02 and ARC-01 check the
   real arrangement with `git worktree list` before allowing concurrent coding.
4. **The main checkout `C:\dev\portfolio-review` stays on main**, clean. It is not a work area. The pre-push hook script is read from it.
5. **Read-only work runs in parallel** (investigations, ARC-01 reviews) with `git -C <worktree>` and `git show <ref>:<path>`, and with
   scratch copies outside the repository. One exception (lead ruling R-7, [DECISION_LOG.md](DECISION_LOG.md) section 1.3): ARC-01 may
   create detached scratch worktrees `.claude/worktrees/arc-01-<task>-<short-sha>` for review only, removes them without `--force`, and
   tells MOD-02 on create and remove. Read-only work never writes in another chat's worktree.
6. **Push from the branch's own worktree**, with `PRD_PRIVACY_DENYLIST` exported, using `git push -u origin <branch>` on the first push.
   The hook runs the scanner of the pushing worktree [VERIFIED: `scripts/hooks/pre-push`].
7. **Never `cd` out of the repository in Bash** while a worktree workflow runs (a 19 Oct failure).
8. **Before editing a file**, check [ACTIVE_CHANGE_REGISTER.md](ACTIVE_CHANGE_REGISTER.md). On an overlap, stop and ask MOD-02, who
   assigns one owner, sequences the work or writes a coordinated plan.
9. **Never discard work:** no stash, reset, force-push, history rewrite or branch deletion. Stale worktrees and branches are cleaned
   only on the owner's word, after their work is safe on origin, except ARC-01's own detached scratch worktrees (rule 5).

## Authority (who decides and who does)

Lead decision, 28 Oct. The authoritative RACI table is in
[README.md section 5.2](README.md#52-who-decides-and-who-does-raci); this file does not repeat it, so the two cannot
diverge. In short: the owner decides product and financial rules, says "publish" and accepts user-visible behaviour;
MOD-02 assigns, sequences, allocates numbers and says "go to merge"; the implementing chat (EX-01 or NB-01) builds,
pushes, opens the PR and makes the D-020 merge only after MOD-02's go, green CI and ARC-01's Gate B GO; ARC-01 reviews
at Gate B and may BLOCK.

The D-020 merge message, as on 6443826 and fb7f59c [VERIFIED]: line 1 `Merge pull request #N from productsteamcentricity/<branch>`,
a blank line, the PR title, a blank line, then the `Co-Authored-By:` trailer.

## Merge readiness rule

Lead decision, 28 Oct. This replaces any fixed merge order.

1. **Whichever change is fully verified first (Gates A to D) merges first.**
2. **The second takes main** (merges the new main into its branch), keeps `docs/DECISIONS.md` in number order, and keeps both sides'
   rows in `CHANGELOG.md`, `docs/PROJECT_STATE.md`, `docs/KNOWN_ISSUES.md` and `docs/TESTING.md`. It then re-runs its full checks.
3. **Fixed dependencies:**
   - **TA-05 after TA-03**: both patch the engine block of `index.html`. TA-05 also needs NB-01's exact KI-147 AG ids.
   - **TA-03 after the owner answers CR-0008 Q17 and Q18** (PD-02, PD-03), as CR-0008 records, unless the owner accepts the safe defaults
     now built (a neutral note for AIFs whose category is assumed; crypto kept out of set-off).
   - **AG-13/AG-14 retirement** goes with whichever of TA-05 or M1.4 lands second, together with the pinned retired list.
   - **TA-10** (monthly refresh) branches from main as it is when the files arrive; any branch still open when it merges must take
     the new main by merging origin/main into the branch (never rebase: pushed branches must not be rewritten), then re-run its checks.
4. MOD-02 records each merge, and the notice sent to dependent tasks, in
   [INTEGRATION_AND_REGRESSION_LOG.md](INTEGRATION_AND_REGRESSION_LOG.md).

## Gates A to E (how they map onto existing practice)

The gates (entry, checks, exit and who runs each) are defined once, in
[README.md section 6](README.md#6-gates-a-to-e). In short: A implementation report; B ARC-01 review plus the domain
reviews the change needs; C independent verification; D controlled integration; E acceptance. Gates A to C must pass on
the same final head before Gate D.

The repository's specialist agents in `.claude/agents/` remain the reviewers: financial-domain-reviewer, qa-engineer,
security-release-reviewer, implementation-engineer, dashboard-archaeologist, refresh-operator.

## Change-impact contract template

Before a material implementation, the implementing chat writes this record (owner's 27 Oct prompt, section 11). Put it in the PR body
and in the change request. ARC-01 reviews material or high-risk contracts **before** work starts. If the scope grows, update the
contract and get MOD-02's coordination before touching another chat's files.

```text
Change-impact contract
 1. Task and requirement IDs:            TA-/TB-/TC-nn; REQ-nnn; CR-nnnn; D-/KI- ids
 2. Objective and acceptance criteria:   what "done" means, measurably
 3. Existing behaviour to preserve:      what must not change (known answers, MD5 of untouched blocks)
 4. Intended behaviour changes:          each visible or numeric change
 5. Files and modules affected:          paths; index.html blocks by marker
 6. Shared interfaces and consumers:     ENGINE keys, REFDATA, data/refdata, ledgers, exports, tests of the other workstream
 7. Data schema, config, dependencies:   refdata schema, package versions, workflows, localStorage keys
 8. Financial rules or calculations:     rule, source of record, reviewer
 9. Other tasks that may overlap:        from ACTIVE_CHANGE_REGISTER.md
10. Required tests:                      known-answer and regression tests, checks of docs/TESTING.md, browser and Office checks
11. Rollback and migration:              how to undo; what a later branch must take from main or regenerate
12. Explicit non-goals:                  what this change will not do
```

Example (TA-05, planned; filled from current evidence):
1 TA-05; REQ-067; KI-183, D-042. 2 No throw and no leaked text for all six label kinds; a Crore cell with non-number text is invalid,
excluded and listed. 3 All other numbers unchanged against the regression suite. 4 Prototype-safe maps; D-042 rule for invested value,
market value and gain. 5 `index.html` engine block 07 via a new patch; new regression files. 6 `computeReview`, `parseBaseRows`; NB-01's
aggregation ledger (AG-13, AG-14) and pinned retired list. 7 None. 8 Base-file money precedence (D-041 point 4); financial-domain-reviewer.
9 TA-03 (same block, must merge first), TB-06. 10 Probe-based regression, full legacy list, browser QA. 11 A forward fix: a new dated patch
script that restores the previous engine text, with the ledger edit undone in the same PR. A plain revert deletes the patch script
and release-check FAILs it [INFERRED from release-check.mjs lines 314 to 320; see
[INTEGRATION_AND_REGRESSION_LOG.md](INTEGRATION_AND_REGRESSION_LOG.md) section 7]. 12 No change to placeholder handling beyond the owner's answer to PD-09.

## Port register

| Port | Use | Serves | Owner | Defined in | State |
|---|---|---|---|---|---|
| 8099 | `dashboard` | main checkout, `tools/serve-dashboard.js` | shared (Workstream A) | repo `.claude/launch.json`; the session project folder's launch.json (outside the repo) | in use [VERIFIED] |
| 8100 | `next` | `scripts/serve.mjs` (`/` and `/next/` on 127.0.0.1) | Workstream B | repo `.claude/launch.json` | in use [VERIFIED] |
| 8101 | `dashboard-pr` | `C:\dev\pr-review` (detached at 2a65a62, PR #10: stale) | shared PR testing | session launch.json; CLAUDE.md and TESTING.md give it as the example | stale target [VERIFIED] |
| 8103 | `next-tabs` | `.claude/worktrees/tabs` (merged as PR #14) | NB-01 | session launch.json | stale target [VERIFIED] |
| 8106 | `next-m14` | `.claude/worktrees/m14` | NB-01 | session launch.json | in use for M1.4 [VERIFIED] |
| 8107..8126 | ad hoc headless browser tests (used: 8107, 8108, 8111..8113, 8121..8126) | NB-01 test runs | NB-01 | test scripts | reserved for NB-01 [VERIFIED: NB-01 state report] |
| 8133..8135 | browser QA for Workstream A | e.g. the TA-03 worktree | EX-01 (MOD-01 before) | ad hoc | reserved for Workstream A [VERIFIED: NB-01 state report] |

There is **no launch entry for the TA-03 worktree** [VERIFIED]. Recommended [INFERRED]: before TA-03 browser QA, add an entry serving
`.claude/worktrees/wf_c9c8da96-497-10/tools/serve-dashboard.js` on **8133**. New ports from 8140 upward are allocated by MOD-02 and
recorded here. Port 8099 must keep serving the main checkout.

## Numbering allocation

Lead decision, 28 Oct. Use only your own range; MOD-02 allocates new ranges and records them here.

| Series | EX-01 | MOD-02 | NB-01 | Already used (before 28 Oct) |
|---|---|---|---|---|
| D-nnn (decisions) | **D-042..D-045**. D-042 = "no fallback", amending D-041 point 4 (TA-05) | **D-046..D-049**, then allocates new ranges | **D-038, D-039** (on its branch), then **D-050 onward** | D-001..D-037, D-041 on main; D-038, D-039 on `feat/m1-4-overview`; D-040 on the TA-03 branch |
| KI-nnn (known issues) | **KI-183..KI-186**. KI-183 = labels equal to Object.prototype keys; KI-184 = base-file ISIN column not read | **KI-187..KI-189**, then allocates | **KI-150..KI-159** (KI-150, KI-151 used on its branch), then **KI-190 onward** | KI-001..KI-148 on main; KI-160..KI-182 on the TA-03 branch |
| KI-140..KI-149 | | | **KI-148** (an M1.4 follow-up) is worked by NB-01 under TB-06/TB-07 | the fix-batch-4 range; KI-140..KI-147 used; KI-149 unused |
| TX-nn (tax register) | TX-nn = KI-(159+nn), so TX-01..TX-23 = KI-160..KI-182 | | | |
| CR-nnnn | asks MOD-02 | **allocates; next free is CR-0010** | asks MOD-02 | CR-0001..CR-0009 (CR-0008 on the TA-03 branch) |
| Design ids | | | **TR, LD, KA, AG, E-, U-** rows stay NB-01's. BF-nn (the base-file ledger) is a shared hotspot: see the parity-ledger row of the shared hotspots above | TR-1..TR-21, LD-1..LD-42, KA-1..KA-22, BF-01..BF-26 on main; AG-01..AG-14 on the branch |

Before 28 Oct these ranges lived only in private notes; this table is now the authoritative copy [VERIFIED: `git grep` found no range
on main]. A chat that needs more numbers asks MOD-02 first.

## Change log of this file

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version: ownership map, isolation rule, authority table, readiness merge rule, gates, contract template, ports, numbering |
| 30 Oct 2026 | MOD-01 (fixer pass) | Validation findings applied: the authority and gates tables replaced by links to README sections 5.2 and 6 (README wins); ARC-01's scratch worktrees (R-7) in rules 5 and 9; open branches take main by merge, never rebase; the TA-05 rollback is a forward fix; BF removed from NB-01's design ids; `tests/helpers/sheetjs.ts` is on main |
