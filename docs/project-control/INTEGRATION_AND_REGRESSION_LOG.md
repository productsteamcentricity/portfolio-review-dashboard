# Integration and regression log

**Written:** 28 Oct 2026 (IST) by MOD-01 for the handover to MOD-02. **Kept by:** MOD-02 (single writer). Entries come
from the implementing chat's Gate A, C and D reports and ARC-01's Gate B report; the gates are defined in
[README.md](README.md) section 6.

**What this file is.** The record of what was integrated into `main`, what it did to the live page and the preview,
what is waiting to be integrated, and what went wrong. It also holds the recovery procedure and the gate records. A
chat that wants to know "what is the last state we know is good?" reads section 1 first.

**Labels.** [VERIFIED] means checked on 28 Oct 2026 with the command or record named. [INFERRED], [UNCERTAIN] and
[UNKNOWN] mean the evidence is incomplete. An entry is never written as passed unless its check was run.

## 1. Last verified baseline

| Item | Value | Evidence |
|---|---|---|
| `main` (= `origin/main`) | `6443826`, "Merge pull request #16 from productsteamcentricity/fix/legacy-batch-4-basefile-r2", 27 Oct 2026 18:13 IST | `git ls-remote origin`; `git log` [VERIFIED] |
| Live page `/` | 16,837,249 bytes, MD5 `12B5E5727FCA01EF2EA162C59913F01D`, SHA-256 `9794454d4edba9b43975f57757f887ef46c806e1a83f5f63872093731c9138bd` | downloaded 28 Oct 07:08 UTC; equal to `git show origin/main:index.html` [VERIFIED] |
| Preview `/next/` | 46,905 bytes, MD5 `b4f23c7e55e7baab25086c14f2d0448c`, SHA-256 `0407eb12033ec8c1432fb787f9c5956200318c84f0172f3a4c8243a50ee73693` | downloaded 28 Oct; equal to the PR #14 build recorded in `CHANGELOG.md` [VERIFIED] |
| CI and Pages on `6443826` | "Dashboard checks" success; "Publish dashboard to GitHub Pages" success, including the new-app install, build and check steps | `gh run list`, `gh run view` (run ids below) [VERIFIED] |
| Checks recorded for `6443826` | `check-invariants` all hold (1 known warning); smoke 35/35; AI Analyst 24/24; regression 19 files, 649 checks; `node --test` 234/234 in IST and UTC; browser acceptance passed (`b8a8d7f`); security gate GO | CR-0009 and `docs/TESTING.md` [VERIFIED as records; not re-run on 28 Oct] |
| Open pull requests | none | `gh pr list` [VERIFIED] |
| Baseline tag | `legacy-baseline-782794f` (annotated) on `782794f`, PR #6: "Legacy dashboard baseline at the start of the new build (CR-0006): index.html EF2FF4F1" | `git cat-file -p` [VERIFIED] |

Run ids for `6443826`: Dashboard checks 40506084298 and Pages 40506084394 (both success, 27 Oct 12:43 UTC).

**Rule.** A newer baseline exists only when a Gate D record in section 8 says so, with the live MD5 checked after the
Pages run. Until then every recovery returns to the row above.

### 1.1 Baseline history

| Date (IST) | `main` | Live MD5 | `/next/` | Recorded by |
|---|---|---|---|---|
| 14 Oct 2026 | `511f554` (import); first published on 15 Oct by a manual Pages run on `af96042` (dispatched 15 Oct 06:11 UTC) [VERIFIED: `gh run view` of that run, 30 Oct] | `173F86CA` | none | MOD-01 |
| 15 Oct 2026 | `9f018e4` (PR #1) | `F0EB0101` | none | MOD-01 |
| 19 Oct 2026 | `f778283` (PR #4) | `FB6676DC` | none | MOD-01 |
| 19 Oct 2026 | `782794f` (PR #6) | `EF2FF4F1` | none | MOD-01 |
| 22 Oct 2026 | `bb413c4` (PR #9) | `911A0465` | none | MOD-01 |
| 23 Oct 2026 | `517becf` (PRs #11 to #13) | `911A0465` | first build (size [UNKNOWN]) | MOD-01 / NB-01 |
| 27 Oct 2026 | `c9ec1cc` (PR #14) | `911A0465` | 46,905 B, `0407eb12` | NB-01 |
| 27 Oct 2026 | `6443826` (PR #16) | `12B5E572` | 46,905 B, `0407eb12` (unchanged) | MOD-01; re-verified 28 Oct |

## 2. Integration history: pull requests #1 to #16

All 16 PRs are merged; none is open. Merge times are the merge commits' times in IST. "Pages" says whether the merge
published the site (the path filter skips docs-only merges). [VERIFIED: `git log --first-parent origin/main`,
`gh pr list --state all`, `gh run list --workflow pages.yml`]

| PR | Merged (IST) | Merge commit | Branch | What it integrated | WS | Live page after | Pages | Verification on record |
|---|---|---|---|---|---|---|---|---|
| #1 | 15 Oct 17:12 | `9f018e4` | `fix/ki-001-reset-family-state` | KI-001: a new base file inherits nothing (CR-0002, D-015) | A | `F0EB0101` | yes | `family-isolation.js` three checks passed in a browser on 15 Oct (TESTING section 4); merged on GitHub and pulled, which exposed KI-098 |
| #2 | 15 Oct 20:19 | `df25dcd` | `chore/organise-repo-and-monthly-process` | repository layout; monthly refresh pipeline restored (CR-0003) | A | unchanged | no | refresh pipeline rebuilt September byte for byte (`docs/refresh-log/2026-09.md`) |
| #3 | 19 Oct 10:48 | `4d9fc5a` | `docs/audit-2026-10` | full audit of 19 Oct (CR-0005) | A | unchanged | no | docs only |
| #4 | 19 Oct 11:52 | `f778283` | `fix/engine-numbers-1` | fix batch 1a: XIRR solver, hybrid look-through, partial XIRR coverage, debt MF tax | A | `FB6676DC` | yes | smoke 26 to 35 checks; financial review approved |
| #5 | 19 Oct 13:39 | `0fca3ad` | `docs/owner-decisions-2026-10-19` | owner's audit answers (D-021) | A | unchanged | no | docs only |
| #6 | 19 Oct 15:52 | `782794f` | `fix/engine-numbers-1b` | fix batch 1b: blank invested value, IRR join, AMC key, Apply plan, Current vs Sample | A | `EF2FF4F1` | yes | two financial reviews per group; browser and PowerPoint QA; 9 regression files, 380 checks; AI Analyst 17 to 24 checks |
| #7 | 22 Oct 12:05 | `3a9491a` | `docs/owner-decisions-od29-36` | OD-29 to OD-36 (D-022); KI-124 | A | unchanged | no | docs only |
| #8 | 22 Oct 12:08 | `8cb320d` | `docs/new-build-cr0006` | new build CR-0006; D-023 | B | unchanged | no | docs only |
| #9 | 22 Oct 20:20 | `bb413c4` | `fix/legacy-batch-2a-r2` | fix batch 2a: KI-124, OD-32, OD-34 (CR-0007) | A | `911A0465` | yes | smoke 35/35; AI 24/24; 12 regression files, 499 checks; browser acceptance passed 22 Oct |
| #10 | 22 Oct 20:46 | `2a65a62` | `docs/m1-1-new-build-docs` | M1.1 safety tooling and Phase 0 records | B | unchanged | no | CI green |
| #11 | 23 Oct 18:37 | `2ea9ba6` | `chore/m1-1-rest-int` | rest of M1.1: release and monthly PRD checks, skeleton | B | unchanged | with #13 | CI green |
| #12 | 23 Oct 18:37 | `3b28779` | `feat/m1-2-int` | M1.2: npm toolchain, one-file build, `/next/` shell (D-034) | B | unchanged | with #13 | CI green |
| #13 | 23 Oct 18:37 | `517becf` | `feat/m1-3-int` | M1.3: model, base-file reader, `data/refdata`, BF ledger (D-035) | B | unchanged | yes, first `/next/` | CI green; Pages new-app steps all success |
| #14 | 27 Oct 12:55 | `c9ec1cc` | `feat/next-top-tabs` | section tabs across the top (D-037) | B | unchanged | yes | layout spike 99/99; owner approved the layout 27 Oct 11:43 IST |
| #15 | 27 Oct 15:17 | `fb7f59c` | `docs/cg-template-spec` | capital-gains upload design and tax-rule table v1 (D-036) | B | unchanged | no | financial reviewer approval (design section 10.10) |
| #16 | 27 Oct 18:13 | `6443826` | `fix/legacy-batch-4-basefile-r2` | fix batch 4: base-file reading, KI-140 to KI-146 (CR-0009, D-041) | A | `12B5E572` | yes | see section 1 |

Notes:
- PRs #11, #12 and #13 were merged one after another and pushed together, so Pages ran once, on `517becf`.
- PRs #2 to #16 were merged locally on `main` with `git merge --no-ff` and pushed (D-020). [VERIFIED: `git reflog show main`]
- Pages run ids: `af96042` 38690981853 (manual, 15 Oct); `9f018e4` 38729292021; `f778283` 39209527079; `782794f`
  39236998758; `bb413c4` 39799324084; `517becf` 39958670578; `c9ec1cc` 40467080510; `6443826` 40506084394. All
  succeeded. [VERIFIED: `gh run list --workflow pages.yml`]
- The verification column repeats what the change records say; it was not re-run on 28 Oct except for section 1.

## 3. Live page MD5 lineage

| MD5 | Bytes | Commit | Event | State |
|---|---|---|---|---|
| `173F86CAC1E5D0AC8FFD5A66042A3B4C` | 16,765,556 | `511f554` (14 Oct) | production import, Stage A baseline (CR-0001) | superseded |
| `F0EB0101E27DD165A23A62CF548E26A2` | 16,768,244 | `9f018e4`, PR #1 (15 Oct) | KI-001 fix | superseded |
| `FB6676DCEEDEA162318CDA02FEB86AA9` | 16,771,979 | `f778283`, PR #4 (19 Oct) | fix batch 1a | superseded |
| `EF2FF4F198A41FE02404B3617CBAD36E` | 16,817,827 | `782794f`, PR #6 (19 Oct) | fix batch 1b; tag `legacy-baseline-782794f` | superseded |
| `911A04659CB34383E478416B54E9C306` | 16,826,633 | `bb413c4`, PR #9 (22 Oct) | fix batch 2a | superseded |
| `558A50F356406B2237AF247179A2186E` | 16,836,871 | `bf2db99` (branch only, 27 Oct) | fix batch 4 before its review patch | never published |
| `12B5E5727FCA01EF2EA162C59913F01D` | 16,837,249 | `6443826`, PR #16 (27 Oct) | fix batch 4 | **LIVE** (verified 28 Oct) |

So fix batch 1 went `F0EB0101` to `FB6676DC` (1a) to `EF2FF4F1` (1b). [VERIFIED: `git show <commit>:index.html | md5sum`
for every row]

**Pages not on `main` (tax batch, TA-03):**

| MD5 | Bytes | Commit | What it is |
|---|---|---|---|
| `5717A7967294FA13ED3A65111D80DA61` | 16,841,457 | `c459f8d` | T1 on the old base `911A0465` (parent `517becf`) |
| `AE70F78B0C89E57692EE9C71A2AC8358` | 16,856,968 | `92c7c83` | T1 and T2 on the old base |
| `61FC0FB25FB1429F805B140FBA6B308E` | 16,887,846 | `5581d90` | T1 to T4 on the old base, before the rebase; the only page with a recorded browser QA and gate GO |
| `0713C6BEEFCB35D778730AB9BEF3E430` | 16,898,566 | `97a7d69` | T1 to T4 rebased onto `12B5E572` (steps `220194...`, `B8722C...`, `D321DB...`, then this) |
| `5F1C2FC56EDA2682822DBF0DB5B44CA3` | 16,908,418 | `0f1c5d3` | plus the T5 patch (work in progress) |

`feat/m1-4-overview` at `07a6460` does not change `index.html` (its page is `12B5E572`). [VERIFIED]

## 4. `/next/` deployments

| Date (UTC) | Commit | What changed | Published content | Evidence |
|---|---|---|---|---|
| 23 Oct 13:07 | `517becf` (PRs #11 to #13) | first preview: the nine-section shell of M1.2 with the M1.3 model | the real build (new-app steps succeeded) | the Pages run's step results [VERIFIED]; size and hash [UNKNOWN] |
| 27 Oct 07:25 | `c9ec1cc` (PR #14) | tabs across the top (D-037) | 46,905 bytes, SHA-256 `0407eb12...` | CHANGELOG; the Pages run [VERIFIED] |
| 27 Oct 12:43 | `6443826` (PR #16) | no new-app change (`git diff 4813482 6443826 -- app scripts package.json package-lock.json data` is empty) | the same 46,905 bytes | download 28 Oct [VERIFIED] |

The preview never fell back to the "could not be built" notice so far. [VERIFIED: the three runs' new-app steps all
succeeded] When M1.4 merges, `/next/` grows to about 2 MB (the local M1.4 build is 1,991,388 bytes). [INFERRED]

## 5. Pending integrations

The order is decided by the **readiness rule** in
[FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md) (section "Merge readiness rule"): whichever
change passes Gates A to D first merges first; the second takes `main` and resolves the shared documents. The live
detail of each change is in [ACTIVE_CHANGE_REGISTER.md](ACTIVE_CHANGE_REGISTER.md).

### 5.1 TA-03, the tax batch (CR-0008, D-040), owner EX-01 (from MOD-01)
- **Branch:** `continuation/ex-01-task-ta-03-20261027` at `0f1c5d3`, on origin and equal to it; worktree
  `.claude/worktrees/wf_c9c8da96-497-10`, clean. Parent `97a7d69` (local branch `fix/legacy-batch-3-tax-p3-r2`, fully
  contained in the continuation branch), which merged `main` at `6443826`. [VERIFIED]
- **Evidence so far.**
  - At `97a7d69` (T1 to T4 rebased): 43 regression files, 1,277 checks; smoke 36/36; AI Analyst 24/24; `node --test`
    234/234 in IST and UTC; `data-extract`, `docs-links` and `traceability` passed; pre-push scan PASS. [VERIFIED: the
    `0f1c5d3` commit message and the workstream A investigation]
  - At `0f1c5d3` (T5 work in progress): the commit records only "run-regression 44 files pass". An independent scratch
    run on 28 Oct found: invariants hold (1 warning), smoke 36/36 in IST and UTC, AI Analyst pass, 44/44 files
    (1,385 checks) in IST and UTC, `data-extract --check` matches, and the T5 patch reproduces `5F1C2FC5` from
    `0713C6BE`. [VERIFIED by the workstream A investigator, outside the repository]
  - **No CI run has ever happened on this branch.** CI runs on PRs and pushes to `main`, or when dispatched. Get one
    early: `gh workflow run "Dashboard checks" --ref continuation/ex-01-task-ta-03-20261027`, or a draft PR.
    [VERIFIED: `gh run list` empty for the branch]
  - **No browser QA of the combined page.** Commit `5581d90` records browser QA passed and gate GO, but for the
    pre-rebase page `61FC0FB2` only; CR-0008 on the branch says combined-page browser acceptance is not verified.
    [VERIFIED]
  - Two implementer agents may have run in the worktree during T5, so the T5 patch is treated as unreviewed.
    [VERIFIED: commit message]
- **Still to do before Gate A can be reported:** reconcile the handover's T5 item list against patch items 1 to 8 (the
  commit says "the remaining T5 items as listed in the handover" are not done); write the T5 docs (D-040 text,
  including the correction of point (c): the base file's ISIN column is not read, KI-184; the "Usual buckets" text
  updated to the dated default; the cross-reference to
  `capital-gains-upload.md` section 10; KI-170; KI-184 filed; CR-0008 status "on origin via the continuation branch";
  CHANGELOG; PROJECT_STATE; TESTING; the CLAUDE.md smoke count 36).
- **Gates B to E still to pass:** financial-domain review of T5; ARC-01 review; the full check list on the final
  page, including `--expect-md5` of the final MD5, `node --test`, `docs-links`, `traceability`, the privacy scan and
  the **pre-push scan with the deny-list on the final head**; browser QA of the final combined page on a Workstream A
  port (8133 to 8135), with `family-isolation.js` and `cvs-refresh.js`, and the tax slides opened in PowerPoint;
  security GO on the staged diff.
- **Merge conditions:** the owner answers CR-0008 Q17 and Q18 (PD-02, PD-03) or accepts the safe defaults built;
  CI green; MOD-02's go; ARC-01 GO. The PR may come from the `continuation/` branch (release-check only warns, TC-23) or
  from a `fix/` branch at the same commit, without rewriting history.
- **Known overlaps:** a merge simulation with M1.4 gives text conflicts in `docs/DECISIONS.md` (1 hunk),
  `docs/KNOWN_ISSUES.md` (2) and `docs/PROJECT_STATE.md` (1); `CHANGELOG.md` and `docs/TESTING.md` merge cleanly. The
  batch regenerates `data/refdata/TAX_RULES.json` and `VINTAGE.json`. TA-05 waits for it (same engine block).
  [VERIFIED: `git merge-tree` of `6443826` with both branches]

### 5.2 M1.4, TB-06 and TB-07, owner NB-01
- **Branches (LOCAL ONLY, never pushed, never CI'd, never scanned with the deny-list):** `feat/m1-4-overview` at
  `07a6460` (23 commits ahead of `main`, contains `6443826`, worktree `.claude/worktrees/m14`) and the round-2 fixers
  G1 `4610684`, G2 `be7f395`, G3 `202f8f6` on `worktree-wf_bdc6c774-599-1/-2/-3`, one unique commit each. The round-1
  fixers FA, FB, FC and FD are contained in `feat/m1-4-overview`; FC (`94f5d5b`) is also on the local branch
  `worktree-wf_c3548c88-811-3`. [VERIFIED]
- **Test state.** On `07a6460` NB-01 reports 837 tests with 833 passing; an independent IST run counted 773 with 769
  passing; the same 4 known failures in both (the aggregation ledger, the AG-01/AG-13 check, the KI-147 legacy
  expectation, the vendor-extract MD5 pin). The count difference is [UNKNOWN]. G1 reports 904 tests with 902 passing;
  its 2 failures (`gate.test.ts:39` and `as-on-change.test.ts:205`) need G1's shared-file requests. G3 reports 864 with
  860 passing (the known 4). G2 has not been tested. G1 and G2 both edit `tests/fixtures/make-books.ts`. [VERIFIED as
  NB-01's report; counts not re-run]
- **Round-1 verification (on `6015190`, before `main` was merged in), as reported by NB-01:** QA PASS with 6 Low
  items; financial review approved; Office acceptance 12/12 but verdict FAIL on one medium item (the share row, fixed by
  G2's N7); security gate NO-GO only because `main` had moved.
- **First step:** preserve the work off this laptop (TB-08), after a read-only run of the m14 worktree's own pre-push
  scan with the deny-list. Then NB-01's plan: integrate G1 to G3, docs, full checks, round-3 verification, PR.
- **Coordination:** whichever of M1.4 or TA-05 merges second retires AG-13 and AG-14 and edits the pinned retired list
  (INTERFACE_CONTRACTS.md, I-14). The docs conflicts with TA-03 are in section 5.1.

### 5.3 TC-01, this handover package
- **Branch:** `handover/mod-01-to-mod-02-20261028` at `6443826` plus the handover documents, worktree
  `.claude/worktrees/handover`; local only; its upstream is set to `origin/main`, so the first push must be
  `git push -u origin handover/mod-01-to-mod-02-20261028` from that worktree with the deny-list exported. [VERIFIED for
  the branch state before this package was committed]
- **Scope:** documents only (`docs/project-control/`, `docs/handover/`, a banner on `docs/HANDOVER.md`). A docs-only
  merge does not run Pages. Overlap with TA-03 and M1.4 is low because neither touches these folders. [INFERRED from
  the Pages path filter and the branches' file lists]

### 5.4 Planned integrations
| Task | Starts from | Depends on | Notes |
|---|---|---|---|
| TA-05 fix batch 5 (KI-183, D-042, AG retirement) | `main` after TA-03 merges | TA-03; NB-01's confirmed AG ids; PD-09 | EX-01 |
| TA-08 and TC-15 docs refresh | `main` after TA-03 and M1.4 | both, to avoid more docs conflicts | stale PROJECT_STATE, HANDOVER, CR index rows |
| TA-10 October refresh | `main` when the owner's files arrive (expected 11 to 17 Nov) | the owner's "publish" before merge; PD-20, PD-21 for the risk step | regenerates `data/refdata`; any open branch then takes the new `main` |

## 6. Integration incidents and regressions so far

| Date | What happened | Effect | Handling | State |
|---|---|---|---|---|
| 15 Oct | PR #1 merged through GitHub | the merge recorded the account's own e-mail as author (KI-098) | D-020: local `--no-ff` merges with the no-reply identity from PR #2 on | closed [VERIFIED] |
| 27 Oct | PR #16 (fix batch 4) changed engine text that the tax batch's T2 patch anchored on | one T2 anchor then occurred twice; `patch-lib` refused instead of writing | the rebase `97a7d69` revised two T2 anchors; T1, T3 and T4 applied unchanged | closed [VERIFIED: `97a7d69` message] |
| 27 Oct | PR #16 changed `index.html` | on the unpushed M1.4 branch, the vendor-extract MD5 pin and the AG ledger tests now fail (4 failures) | G1 replaces the pin with block equality and updates the ledger; not yet integrated | open (TB-07) [VERIFIED] |
| 27 Oct | two implementer agents started in the TA-03 worktree during T5 | the T5 patch cannot be trusted as reviewed | treat it as unreviewed; full review in TA-03 | open (TA-03) [VERIFIED] |
| 28 Oct | the documented rebuild rule ("check out `index.html`, then every patch in file-name order") was replayed in scratch | 4 of 9 patches refuse on today's page; the file is not damaged | use "parent page MD5 plus this branch's new patches"; TA-23 rewords the rule | open (TA-23) [VERIFIED] |

No regression has reached the live page so far: every published page passed its gates and the current one equals
`main`. [VERIFIED for the current page; INFERRED for earlier pages from the records]

## 7. Recovery procedure

Use this when an integration breaks something: CI red on `main`, a failed Pages run, a live MD5 that does not equal
`main`'s `index.html`, `/next/` showing the fallback notice, or a wrong number found after a merge.

1. **Stop dependent integration.** MOD-02 tells every chat that no "go to merge" will be given and that no refresh is
   published until the incident is closed. Record the incident in section 6 with the time.
2. **Preserve evidence.** Note the merge SHA, the CI and Pages run ids, the live size and MD5 (download `/` and
   `/next/`), and the failing output. Keep copies outside the repository and never with client data. Every affected
   chat makes a WIP checkpoint commit on its own branch. Delete nothing: no branch, worktree, stash or file.
3. **Identify the last verified baseline** from section 1.1 (today `6443826`, `12B5E572`). Confirm it with
   `git show <sha>:index.html | md5sum` and the matching Gate D record.
4. **Choose the smallest targeted recovery.**
   - *Forward fix (the preferred recovery for a live-page change):* a new `fix/` branch from `main` with a new dated
     patch script (D-016) that restores the previous blocks, so the page MD5 returns to the baseline, through Gates A
     to D. Gates may be quick but none is skipped. Prove the page with
     `node tools/check-invariants.js --expect-md5 <baseline MD5>`.
   - *Revert a merge:* on a new branch, `git revert -m 1 <merge-sha>`, then PR, CI and a D-020 merge. This adds a
     commit and keeps history. For a merge that changed `index.html`, release-check will FAIL a revert that deletes a
     patch script (`scripts/validation/release-check.mjs` lines 314 to 320 accept a changed `index.html` only with a
     non-deleted `tools/patches/*.js` in the change, or on a `data/` branch), and CI's last step runs
     `release-check --ci` [INFERRED from the code; not run; ARC-01 confirms in a scratch worktree]. So use a revert
     only if it also adds a new patch script, or with MOD-02's recorded decision to accept that FAIL for the revert PR.
     Record the revert in CHANGELOG. To re-apply the change later, revert the revert.
   - *Data refresh gone wrong:* revert the `data/` merge the same way, or re-splice the previous month's blocks with
     `buildtools`; regenerate `data/refdata` in the same change (D-035).
   - *Pages failed but `main` is right:* re-run Pages with `gh workflow run pages.yml --ref main`, then verify.
   - *Only `/next/` is broken:* the live page is not affected (D-034); NB-01 fixes forward.
5. **Never** force-push or reset `main`, rewrite history, delete branches, use `--no-verify`, edit `index.html` by
   hand, or discard unrelated work to repair a regression. Note that `main` has no branch protection and the AC-22
   force-push check does not exist, so only this discipline prevents a force-push. [VERIFIED: D-033; TB-24]
6. **Verify the recovery:** CI green; Pages green; live `/` MD5 equals `main`'s `index.html` and the expected MD5;
   `/next/` size and SHA-256 as expected.
7. **Record:** a Gate D record and a new baseline row (section 1.1); a KNOWN_ISSUES entry from the chat's range with a
   regression test that would have caught it; a decision in `docs/DECISIONS.md` if a rule changed. MOD-02 tells the
   owner in plain language what happened, what users saw and what was done.
8. **Resume:** MOD-02 lifts the stop and tells every open branch to take the new `main`.

## 8. Gate records

One row per gate per change, newest last. MOD-02 writes the row from the report it receives; the report itself stays in
the PR or the chat's handover note. Status words follow the owner's list in [README.md](README.md) section 3. Never
write PASS for a check that was not run.

Example of a row's evidence cell: "`check-invariants --expect-md5 <md5>` all hold, 1 warning; smoke 36/36 IST and UTC;
regression 44 files, 1,385 checks; CI run <id> green".

| # | Date (IST) | Task and change | Gate | By | Branch at base SHA to head SHA | Evidence (commands, counts, run ids, MD5 or SHA-256) | Result | Follow-ups and notices sent |
|---|---|---|---|---|---|---|---|---|
| 1 | 28 Oct 2026 | (none yet) | none | MOD-01 | none | No change has passed a gate under this model yet. Evidence gathered before 28 Oct is in sections 2 and 5 | none | none |

## 9. Change log of this file

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version: baseline, PR #1 to #16, MD5 lineage, `/next/` deployments, pending integrations, incidents, recovery procedure, empty gate table |
| 30 Oct 2026 | MOD-01 (fixer pass) | Validation findings applied: the baseline rule points to the gate records (section 8); the first page went live on 15 Oct; TA-03's "Usual buckets" docs item; the recovery procedure prefers a forward fix, because release-check fails a plain revert of a patch merge |
