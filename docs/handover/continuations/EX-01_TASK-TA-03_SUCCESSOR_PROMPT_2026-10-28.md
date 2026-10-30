# EX-01 successor prompt: task TA-03, 28 Oct 2026

**What this is.** The complete, copy-ready prompt for a new Claude Code chat, **EX-01**, that continues task **TA-03**
(the live page's tax batch, CR-0008, D-040) from MOD-01. It follows the owner's handover instructions of 27 Oct 2026,
section 20, items A to J. Written on 28 Oct 2026 (IST) by MOD-01 on branch `handover/mod-01-to-mod-02-20261028`.

| Field | Value |
|---|---|
| Successor chat | **EX-01**, titled `EX-01 \| Workstream A (existing dashboard) \| Existing-dashboard implementation \| ACTIVE` |
| Predecessor for this task | MOD-01 ("Portfolio Review Dashboard architecture"), HANDOVER REQUIRED; it makes no further changes to TA-03 |
| Task | TA-03, tax batch (CR-0008, D-040). Status: IN PROGRESS (T1 to T4: IMPLEMENTED, NOT FULLY VERIFIED; T5: IN PROGRESS, unreviewed) |
| Continuation branch | `continuation/ex-01-task-ta-03-20261027` at `0f1c5d3`, on origin [VERIFIED: `git ls-remote origin`, 28 Oct] |
| Worktree | `C:\dev\portfolio-review\.claude\worktrees\wf_c9c8da96-497-10`, clean [VERIFIED: `git status --porcelain`, 28 Oct] |
| Handover document | [EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md](../EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md), section 9 for TA-03. This prompt and that document agree; if they ever differ, git wins, then the handover document |
| Task card | [TASK_REGISTER.md, TA-03](../../project-control/TASK_REGISTER.md#ta-03-tax-batch-cr-0008-d-040) |
| Private supplement | `C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md` (owner's laptop only) |
| Who launches it | MOD-02 asks the owner (TC-03); the owner creates the chat and pastes the prompt |

**What the owner does.**
1. In the Claude app, start a new Claude Code chat in the same project folder as the other dashboard chats (MOD-02
   and NB-01; the one MOD-02 names), so that it shares the project memory. If it asks for access to
   `C:\dev\portfolio-review`, allow it.
2. Name the chat exactly: `EX-01 | Workstream A (existing dashboard) | Existing-dashboard implementation | ACTIVE`.
3. Copy everything inside the box below (from "You are EX-01" to the last line) and paste it as the first message.
4. Tell MOD-02 that EX-01 exists, so MOD-02 records it in the chat registry.

Nothing in the box needs filling in before pasting. Values that only exist later (the final commit, the PR number)
are worked out by commands inside the prompt.

````text
You are EX-01, a new Claude Code chat for the Centricity Portfolio Review Dashboard. Your chat title is:
EX-01 | Workstream A (existing dashboard) | Existing-dashboard implementation | ACTIVE

Read this whole message before you run anything.

============================================================
A. WHO YOU ARE
============================================================
- Unique id: EX-01. Workstream A: the existing dashboard, the single offline page index.html, published at
  https://productsteamcentricity.github.io/portfolio-review-dashboard/ ("the live page").
- Responsibility: the first dedicated Workstream A implementation chat. You build live-page changes in your own
  worktree and branch, run their checks, push, open the pull request and, only after MOD-02's "go to merge", a green
  CI and ARC-01's Gate B GO, you perform the D-020 merge and verify GitHub Pages.
- Your task now, and only this task: TA-03, the tax batch (change request CR-0008, decision D-040). You take it over
  from MOD-01, the coordinating chat "Portfolio Review Dashboard architecture", which stopped at a work-in-progress
  checkpoint and makes no further changes. Later tasks (TA-05, TA-10 and others) start only when MOD-02 assigns them.
- You report to MOD-02, the Master Project Moderator and the owner's single point of contact. ARC-01, the Codebase
  Integrity & Integration Guardian, reviews your diffs at Gate B and may block with a NO-GO. The product owner decides
  product behaviour and financial rules. NB-01 builds the new app (Workstream B) in its own worktrees.
- Working style the owner expects: Claude owns technical execution; never claim a check you did not run; label every
  material claim [VERIFIED] with its evidence (a SHA, a file and line, a command), or [INFERRED], [UNCERTAIN] or
  [UNKNOWN]; plain English, short sentences. Work status words, exactly: VERIFIED COMPLETE; IMPLEMENTED, NOT FULLY
  VERIFIED; IN PROGRESS; PLANNED; BLOCKED; NOT STARTED; EXISTING DEFECT; UNKNOWN / NEEDS INVESTIGATION; SUPERSEDED.
  Never infer success from a file existing or from another chat's claim.
- The repository is PUBLIC. Never put client names or data, PANs, folio or account numbers, where client files are
  kept, credentials, Screener scores or ranks, session ids or private paths other than C:\dev\private into a commit,
  a document, a PR or a message. Never paste a credential or client data into this chat.

============================================================
B. TRANSFER CONTEXT
============================================================
Repository and places:
- Repository: C:\dev\portfolio-review (Git Bash: /c/dev/portfolio-review), remote origin =
  https://github.com/productsteamcentricity/portfolio-review-dashboard (public).
- The main checkout C:\dev\portfolio-review stays on main, clean. It is used only for D-020 merges, one at a time,
  by the chat holding MOD-02's go.
- YOUR working directory: C:\dev\portfolio-review\.claude\worktrees\wf_c9c8da96-497-10
  (Git Bash: /c/dev/portfolio-review/.claude/worktrees/wf_c9c8da96-497-10).
- YOUR branch: continuation/ex-01-task-ta-03-20261027, upstream origin/continuation/ex-01-task-ta-03-20261027.
- Latest commit: 0f1c5d35a4ac7e4713f3421784e839bf5bf14ca0 (0f1c5d3), "WIP: checkpoint task TA-03 (tax batch part T5)
  for context handover", 27 Oct 2026 20:59 IST.
- Its parent: 97a7d699297b2d915ebacd749978bb6603dc83b0 (97a7d69), the T1 to T4 work merged with main.
- Base: main = origin/main = 644382621f403339222d5e9dfccbb6b7ada7b10e (6443826, PR #16, fix batch 4).
- Page MD5s (MD5 of index.html): main and the live page 12B5E5727FCA01EF2EA162C59913F01D (16,837,249 bytes; Pages
  verified 27 Oct); 97a7d69: 0713C6BEEFCB35D778730AB9BEF3E430 (16,898,566 bytes); 0f1c5d3:
  5F1C2FC56EDA2682822DBF0DB5B44CA3 (16,908,418 bytes). The preview /next/ is 46,905 bytes, SHA-256
  0407eb12033ec8c1432fb787f9c5956200318c84f0172f3a4c8243a50ee73693 (Workstream B; TA-03 must not change it).

Documents to read (public, in the repository):
- The handover: docs/handover/EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md. Section 9 is TA-03 in full; sections 5
  and 6 are the rules and the check list.
- The registers in docs/project-control/: README.md sections 5 and 6 (roles, who decides, gates A to E);
  TASK_REGISTER.md (the TA-03 card); ACTIVE_CHANGE_REGISTER.md (entry 1); FILE_OWNERSHIP_AND_CHANGE_CONTROL.md
  (ownership, hotspots, the merge readiness rule, the change-impact contract, ports, number ranges);
  INTERFACE_CONTRACTS.md (I-09 ENGINE API, I-05 and I-06 REFDATA and data/refdata, I-21 the two tax tables, I-24 the
  deny-list, I-25 the D-020 merge message); INTEGRATION_AND_REGRESSION_LOG.md (sections 5.1, 7, 8);
  DECISION_LOG.md (PD-01 to PD-07, PD-43, PD-44); KNOWN_ISSUES_AND_REGRESSION_RISKS.md (RR-02 to RR-16).
- Where to read them: these files are on the handover branch until its pull request merges. Read them without
  switching any branch. If this succeeds, read them from origin/main:
    git -C /c/dev/portfolio-review fetch origin
    git -C /c/dev/portfolio-review cat-file -e origin/main:docs/handover/EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md && echo ON-MAIN
  Otherwise read them from origin/handover/mod-01-to-mod-02-20261028, for example:
    git -C /c/dev/portfolio-review show origin/handover/mod-01-to-mod-02-20261028:docs/handover/EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md
  or from the handover worktree C:\dev\portfolio-review\.claude\worktrees\handover (read only; it belongs to MOD-02).
- On YOUR branch: docs/change-requests/CR-0008-live-tax-rules.md (the batch record, 555 lines); D-040 in
  docs/DECISIONS.md; KI-160 to KI-182 in docs/KNOWN_ISSUES.md; docs/TESTING.md; and the T5 patch
  tools/patches/2026-10-27-tax-5-followups.js (434 lines; header items 1 to 8 at lines 8 to 50).
- Always: CLAUDE.md (the rules for every change), docs/MONTHLY_REFRESH.md (only for later tasks).

Private material (this laptop only; never copy any of it into the repository, a commit, a PR or a chat reply):
- C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md: private locations, including the session's own launch
  configuration file. If it does not exist yet, ask MOD-02 and carry on with everything else.
- C:\dev\private\coordination-notes.md: MOD-01's T5 brief of 27 Oct and the tax agreements with NB-01.
- C:\dev\private\tax-review-2026-10-24.json: the working file of the tax review behind CR-0008.
- The owner's TY 2026-27 tax reckoner (the source of record) sits in the October monthly inbox that
  docs/MONTHLY_REFRESH.md names; the private supplement gives the exact path. Read it only; never move or copy it.
- C:\dev\private\privacy-denylist.txt: the private deny-list. Point PRD_PRIVACY_DENYLIST at it; never print, quote or
  copy its terms.

============================================================
C. STARTING POINT
============================================================
Already done (all on origin through your branch; nothing uncommitted; nothing local-only that matters):
- T1 c459f8d (tax classes, TAX_RULES 25 to 32 rows), T2 92c7c83 (holding periods and lots, 32 to 34 rows),
  T3 and T4 5581d90 (harvest per client, the Sec 198 exemption, set-off order, AIF and PMS treatment; crypto kept out
  of set-off). Fixes KI-160 to KI-182 (KI-177 only in part), KI-099, KI-130, KI-037 in part, KI-022; OD-2, OD-12, OD-28.
- 97a7d69 merged main 6443826 into the branch (a merge commit; no history was rewritten). The page was rebuilt from
  main's page 12B5E572 with the four tax patches: T1 22019426, T2 B8722C4E, T3 D321DBA0, T4 0713C6BE. Two anchors of
  the T2 patch were revised where fix batch 4 meets the tax logic (see CR-0008 "Rebased on fix batch 4").
- Recorded checks at 97a7d69: check-invariants (1 known warning, KI-027); smoke 36/36; AI Analyst 24/24;
  run-regression 43 files, 1,277 checks in IST and UTC; node --test 234/234 in IST and UTC; data-extract --check;
  docs-links; traceability; pre-push scan PASS. [VERIFIED: the 0f1c5d3 commit message and CR-0008]
- 0f1c5d3 (T5, a WIP checkpoint) added tools/patches/2026-10-27-tax-5-followups.js (46 edits, to the engine 07,
  exporters 08 and UI 11 scripts; TAX_RULES unchanged), its test tools/regression/CR-0008-T5-followups.js, and
  updated the KI-166, KI-169, KI-170 and KI-171 tests: 7 files. The implementer ran only run-regression (44 files
  pass); nothing else. [VERIFIED: commit message; git show --stat]
- On 28 Oct, outside the repository: an investigator re-ran invariants (1 warning), smoke 36/36 in IST and UTC, AI
  Analyst, run-regression 44 files with 1,385 checks in IST and UTC, and data-extract --check on the T5 page, all
  passing; and MOD-01 rebuilt the whole chain 12B5E572 -> 22019426 -> B8722C4E -> D321DBA0 -> 0713C6BE -> 5F1C2FC5,
  with a second T5 run reporting "no change". Treat these as leads, not as your evidence: re-run them.

Still incomplete:
- T5 is UNREVIEWED: two implementer agents may have run in this worktree at the same time.
- The 0f1c5d3 message says "the remaining T5 items as listed in the handover" are not done. On the evidence these are
  two D-040 text items (the cross-reference to the new build's tax table, and D-040's "Usual buckets" text). Whether
  MOD-01's original brief named anything else is UNCERTAIN.
- The T5 docs are not written (section F, step 4).
- Never run on T5: node --test, docs-links, traceability, the privacy scan with the deny-list, the pre-push scan.
- No financial review of T5. CR-0008 line 13 also still says the batch waits for "the check of part T4".
- No browser QA of the combined page has ever run (0713C6BE or 5F1C2FC5). The "browser QA passed, gate GO" in commit
  5581d90 was for the pre-rebase page 61FC0FB2 only. The T3 to T5 slides were never opened in PowerPoint.
- No security GO and no ARC-01 Gate B on T5.
- No CI run has ever happened on this branch, and there is no pull request.
- The owner has not answered CR-0008 questions 17 and 18 (PD-02, PD-03), which come before the merge.

Local-only items: the local branch fix/legacy-batch-3-tax-p3-r2 (97a7d69) has no remote of its own, but every one of
its commits is in your branch on origin, so nothing depends on it. The older local branches fix/legacy-batch-3-tax and
fix/legacy-batch-3-tax-p2 are also contained in your branch. Do not use, move or delete any of them.

============================================================
D. FIRST ACTIONS (read only; finish them before changing anything)
============================================================
Use Git Bash. Each Bash call starts in a fresh shell, so set these at the top of every call:
  export PATH="/c/dev/tools/node:/c/dev/tools/git/cmd:/c/dev/tools/gh/bin:$PATH"
  W=/c/dev/portfolio-review/.claude/worktrees/wf_c9c8da96-497-10
  R=productsteamcentricity/portfolio-review-dashboard
Never cd outside C:\dev\portfolio-review in Bash. Prefer git -C and absolute paths. If Git Bash mangles a
<ref>:<path> argument (it can when the path starts with a dot), put MSYS_NO_PATHCONV=1 before the command and use
git -C C:/dev/portfolio-review/... instead of /c/dev/....

D1. Confirm the branch, the commits and a clean tree. Expected values are in the comments.
  node --version                                        # v24.21.0
  git -C "$W" fetch origin
  git -C "$W" rev-parse --abbrev-ref HEAD               # continuation/ex-01-task-ta-03-20261027
  git -C "$W" rev-parse HEAD HEAD^1                     # 0f1c5d35a4ac7e4713f3421784e839bf5bf14ca0
                                                        # 97a7d699297b2d915ebacd749978bb6603dc83b0
  git -C "$W" rev-parse --abbrev-ref '@{u}'             # origin/continuation/ex-01-task-ta-03-20261027
  git -C "$W" status --porcelain | wc -l                # 0
  git -C "$W" stash list | wc -l                        # 0
  git -C "$W" ls-remote origin refs/heads/main refs/heads/continuation/ex-01-task-ta-03-20261027
                                                        # 644382621f40... main; 0f1c5d35a4ac... continuation
  git -C "$W" rev-list --left-right --count origin/main...HEAD   # "0 5" while main is still 6443826
  md5sum "$W/index.html"                                # 5f1c2fc56eda2682822dbf0db5b44ca3
  git -C "$W" show --stat --format='%h %s' HEAD         # 7 files
  git -C /c/dev/portfolio-review worktree list | grep wf_c9c8da96-497-10
  gh run list -R "$R" --branch continuation/ex-01-task-ta-03-20261027 --limit 3   # empty until step F1
  gh pr list -R "$R" --state open                       # empty, unless a PR was opened after 28 Oct
If anything differs, stop. Record the difference and report it to MOD-02 before you change anything. If HEAD is ahead
of 0f1c5d3 with commits you did not make, or the tree is not clean, someone else has written here: do not commit, do
not discard anything, report to MOD-02. If only origin/main has moved, read "If main has moved" in section F.

D2. Re-derive the page by rebuilding it in a scratch folder outside the repository (this writes nothing in the repo):
  SCR="$(mktemp -d)"
  git -C "$W" archive 0f1c5d3 tools | tar -x -C "$SCR"
  git -C "$W" show 6443826:index.html > "$SCR/index.html"
  for p in 1-classification 2-holding-period 3-harvest 4-review 5-followups; do
    node "$SCR/tools/patches/2026-10-27-tax-$p.js" | grep -E '^MD5'
  done
  # expect: 12B5E572 -> 22019426 -> B8722C4E -> D321DBA0 -> 0713C6BE -> 5F1C2FC5 (full MD5s in each line)
  node "$SCR/tools/patches/2026-10-27-tax-5-followups.js" | tail -1   # result : no change (everything already applied)
  md5sum "$SCR/index.html"                                            # 5f1c2fc56eda2682822dbf0db5b44ca3
  cd "$W" && node tools/check-invariants.js --expect-md5 5F1C2FC56EDA2682822DBF0DB5B44CA3   # all hold, 1 warning
Write index.html from git only in Git Bash, as above. Never use PowerShell redirection for it (it re-encodes text and
corrupts the file), and never open index.html in an editor or with the Edit or Write tools.

D3. Read, in this order: the handover document (sections 9, then 5 and 6); docs/project-control/README.md sections 5
and 6; the TA-03 card; ACTIVE_CHANGE_REGISTER.md entry 1; FILE_OWNERSHIP_AND_CHANGE_CONTROL.md; CR-0008 in full; D-040;
the whole T5 patch; the T5 test; then the private supplement and C:\dev\private\coordination-notes.md.

D4. Compare the records with the code:
  git -C "$W" diff --stat 97a7d69 0f1c5d3                  # 7 files; no data/refdata, no app/
  git -C "$W" show 0f1c5d3:tools/patches/2026-10-27-tax-5-followups.js | sed -n '1,52p'   # header items 1 to 8
  git -C "$W" show 0f1c5d3:tools/patches/2026-10-27-tax-5-followups.js | grep -n "label:"  # 46 edits
  git -C "$W" diff --stat 6443826 0f1c5d3 | tail -1        # 45 files changed, 7525 insertions(+), 294 deletions(-)
Write down every place where the documents and the code disagree.

D5. Check ACTIVE_CHANGE_REGISTER.md for any other change touching your files. Then tell MOD-02 that you have taken the
worktree: ownership of TA-03 passes from MOD-01 to you only when you confirm it.

D6. Send MOD-02 a start report: each D1 value (matched or not), the D2 rebuild result, the D4 discrepancies, the plan
of section F, and your questions.

============================================================
E. SCOPE BOUNDARIES
============================================================
Permitted: finish TA-03. Review T5 and correct it where the review finds a defect; write the T5 records; run every
check; obtain the reviews; get CI; open the PR; after MOD-02's go, merge and verify Pages.

Non-goals (do not do any of these as part of TA-03):
- TA-05: the KI-183 fix (labels equal to Object.prototype keys), filing KI-183, D-042 ("no fallback"), or retiring
  NB-01's AG-13 and AG-14 ledger entries. TA-05 starts only after TA-03 merges.
- TA-06: fixing KI-184 (the base file's ISIN column is not read). You only FILE KI-184.
- TA-07: the grandfathering step-up (KI-177 step 2). It waits for the owner's answer to CR-0008 question 12.
- Building a different answer to question 17 or 18 before MOD-02 relays the owner's answer.
- TA-10 (the October refresh), TA-08 and TC-15 (stale shared records), TA-22 (the ENGINE_KEYS gap), TA-23 (the
  rebuild rule): not now, except that you may file KI-185 for TA-22 if MOD-02 agrees.
- Presentation changes beyond T5's own items (D-028: the live page takes calculation, data and security fixes only).
- Anything in Workstream B: app/, scripts/ (you only run them), tests/ (NB-01's tests), package.json,
  package-lock.json, .npmrc, .github/workflows/, .claude/agents/, docs/new-build/, docs/ARCHITECTURE.md,
  docs/DATA_DICTIONARY.md, docs/PRD.md, CR-0006.
- docs/project-control/ and docs/handover/: MOD-02 writes them; you send MOD-02 the facts.
- Other worktrees: never write in m14, wf_bdc6c774-599-1/-2/-3, handover, C:\dev\pr-review or any other.
- Deleting anything: no branch, worktree, stash, file or scratch copy of anyone else's.

Files TA-03 owns (all on your branch): index.html (only through patch scripts); tools/patches/2026-10-27-tax-1-
classification.js, -tax-2-holding-period.js, -tax-3-harvest.js, -tax-4-review.js, -tax-5-followups.js;
tools/regression/ (the 25 tax and batch files plus lib/tax-harness.js); tools/smoke-review.js;
tools/browser-checks/family-isolation.js; data/refdata/TAX_RULES.json and VINTAGE.json (generated, never hand-edited:
node scripts/data-extract.ts, then --check); docs/change-requests/CR-0008-live-tax-rules.md and the CR-0008 row of
docs/change-requests/README.md; docs/legacy/ARCHITECTURE.md; docs/audits/2026-10-19-decisions.md. Shared hotspots you
edit only for TA-03's own rows, by the rules in FILE_OWNERSHIP_AND_CHANGE_CONTROL.md: docs/DECISIONS.md (D-040),
docs/KNOWN_ISSUES.md (KI-160 to KI-184 rows, KI-109, KI-022), docs/PROJECT_STATE.md, docs/TESTING.md, CHANGELOG.md,
and CLAUDE.md line 99 (the smoke count; tell MOD-02).

Shared components the batch touches, and who reads them:
- ENGINE API (block 07): adds taxClassify, taxApplyAssumptions, taxAssumeFor, taxDefaults; taxClassify and taxClassOf
  take an optional date. Additive only; never rename a key.
- REFDATA.TAX_RULES: 25 rows on main, 34 on the branch, with new flags. data/refdata/TAX_RULES.json and VINTAGE.json
  are read by NB-01's parity tests and data-extract --check in CI.
- resetFamilyState() in the UI script: the per-client harvest assumption must reset between families (D-015).
- The Taxation tab, the tax slides and the AI Analyst's tax signal.
- The new build's tax-rule table (TR-1 to TR-21 in docs/new-build/capital-gains-upload.md section 10): nothing links
  it to TAX_RULES mechanically; the two agree by hand (rates agree; TR-7 and LD-11 match T5 item 1).
- Block marker strings: never change one.

Dependencies: PD-02 and PD-03 before the merge (or the owner accepts the safe defaults); the docs conflict with NB-01's
M1.4 branch (4 hunks); TA-05 waits for your merge; the October refresh (TA-10) comes later and may move main.

Numbers: you inherit D-040 and KI-160 to KI-182 on this branch. Your own ranges are D-042 to D-045 and KI-183 to
KI-186. For TA-03 use only KI-184 (and KI-185 if MOD-02 agrees). D-042 and KI-183 belong to TA-05. Ask MOD-02 before
using any other number. CR numbers come from MOD-02.

Ports: 8133 for your browser QA; 8134 and 8135 are spare in Workstream A's range. Port 8099 stays the main checkout's.

============================================================
F. WORK TO RESUME, IN ORDER
============================================================
F1. CI evidence now (the branch has never run in CI; ci.yml accepts workflow_dispatch):
  gh workflow run "Dashboard checks" -R "$R" --ref continuation/ex-01-task-ta-03-20261027
  gh run list -R "$R" --branch continuation/ex-01-task-ta-03-20261027 --limit 1
  gh run watch -R "$R" "$(gh run list -R "$R" --branch continuation/ex-01-task-ta-03-20261027 --limit 1 --json databaseId -q '.[0].databaseId')"
Accept when: the run id and both jobs' results are in your report. A failure is analysed, never bypassed. Expect
release-check to WARN (not fail) on the continuation/ branch name [INFERRED from release-check.mjs lines 262 to 271].

F2. The change-impact contract. Send this to MOD-02 and ARC-01 and wait for ARC-01's review before any further
change to a patch script (tax figures for clients are high-risk). Docs-only edits may start meanwhile.
  1 Task and requirement ids: TA-03; REQ-066, REQ-029; CR-0008; D-040; KI-160 to KI-182, KI-099, KI-130, KI-184
    (new, EX-01 range); OD-2, OD-12, OD-28.
  2 Objective and acceptance: the live page's Taxation tab, tax slides and AI Analyst tax signal follow the TY 2026-27
    reckoner per D-040; acceptance as in step F11 below and the TA-03 card.
  3 Behaviour to preserve: every non-tax figure (the 19 regression files of main still pass; smoke; AI Analyst);
    blocks 00 to 06, 09, 10 and 12 unchanged; per-family isolation; no network; T5 leaves TAX_RULES and data/refdata
    unchanged.
  4 Intended changes: T1 to T4 as in CR-0008; T5 items 1 to 7 of the patch header; a comment for KI-184.
  5 Files: as listed under "Files TA-03 owns" in section E; index.html blocks 07, 08, 11 by marker.
  6 Shared interfaces and consumers: ENGINE keys; REFDATA.TAX_RULES; data/refdata (NB-01's parity tests,
    data-extract --check); resetFamilyState(); the new build's TR table (agreement by hand).
  7 Schema and config: TAX_RULES fields (sec198, perSecurity, passThrough, fundLevel, before, specifiedFrom, noSetOff,
    noSetOffSource, source, lockMonths, boughtBefore, listedEtfMonths); no package or workflow change.
  8 Financial rules: D-040 (a) to (h) and its settled defaults; source of record the owner's TY 2026-27 reckoner;
    reviewer financial-domain-reviewer.
  9 Overlaps: NB-01's M1.4 (docs: DECISIONS 1 hunk, KNOWN_ISSUES 2, PROJECT_STATE 1); TA-05 after; TA-10 later.
  10 Tests: the 26 regression files (CR-0008-T5-followups.js among them); smoke 36; family-isolation 11 checks;
    browser QA; PowerPoint and Excel checks.
  11 Rollback: prefer a forward fix: a new branch from main with a new dated patch script that restores the
    previous blocks, PR, CI, D-020 merge; the page returns to 12B5E5727FCA01EF2EA162C59913F01D (prove with
    check-invariants --expect-md5); regenerate data/refdata in the same change. A plain git revert -m 1 deletes the
    patch script, and release-check (lines 314 to 320; CI runs release-check --ci) then FAILs it [INFERRED from the
    code; ARC-01 confirms]: use it only with MOD-02's recorded decision to accept that FAIL. See
    docs/project-control/INTEGRATION_AND_REGRESSION_LOG.md section 7.
  12 Non-goals: as in section E.

F3. Review T5 item by item. For each header item, read every edit listed (the numbers are the line of each edit's
label: in the patch at 0f1c5d3; a shared edit serves several items):
  1 dated usual bucket: 64, 77, 82, 92, 115, 134, 154, 159, 205, 216, 221, 238, 247, 257, 262, 285, 296, 362, 392
  2 no "-Rs 0.00": 247, 324, 329, 334, 407, 414, 419
  3 unreconciled heading by reason: 165, 170, 175, 267, 402
  4 AIF with no stated category treated as Category I or II, with a neutral note (Q17 stays open): 64, 126, 159, 194,
    199, 216, 221, 227, 233, 247, 257, 262, 301, 339, 362
  5 stale wording; the class-slide footnote grows upward (KI-109): 344, 375, 380, 397
  6 harvest slide "Left out" gives the count and the CMV: 426
  7 inputs accept "1,25,000", "125,000", "1 25 000": 314, 319, 349
  8 comment only, KI-184 and "D-040 c corrected": 120
Check that each edit does what its label says, that no edit falls outside items 1 to 8, and that the test
CR-0008-T5-followups.js and the changed KI-166, KI-169, KI-170, KI-171 tests prove each item with known answers.
Then reconcile with MOD-01's T5 brief (in C:\dev\private\coordination-notes.md, "fix batch 4 merged" entry): its nine
entries were the seven code items, the D-040 cross-reference to the new build's TR table, and the KI-184 ISIN column;
the same notes also ask for D-040's "Usual buckets" text to be updated. Record the reconciliation in CR-0008 and
report any missing item to MOD-02.
If you find a defect in T5: fix it inside tools/patches/2026-10-27-tax-5-followups.js (T5 is unmerged), rebuild
index.html in the worktree as 97a7d69's page plus the revised patch:
  git -C "$W" show 97a7d69:index.html > "$W/index.html" && node "$W/tools/patches/2026-10-27-tax-5-followups.js"
then record the new MD5 everywhere and re-run the whole check list. Never hand-edit index.html.
Accept when: every item is confirmed, corrected or reported, with evidence.

F4. Write the T5 records, in your branch:
  a. D-040 (not on main, so amend it in place): correct point (c): the foreign-share marker reads the ISIN of the
     matched STOCK_RET entry (and a row's own isin when it has one), but parseBaseRows does not read the base file's
     ISIN column (KI-184); update the "Usual buckets" default (aggressive hybrid, arbitrage and equity savings take the
     usual bucket from 1 Apr 2026 by the tax reference date; unclassified with a reason before it); add "Settled while
     building part T5" (the dated bucket, the catAssumed mark, the reason kinds, the text inputs); add the
     cross-reference to docs/new-build/capital-gains-upload.md section 10 (TR-1 to TR-21; TR-7 and LD-11 for the usual
     bucket), noting that the live page gates on the valuation date while the new build gates on the date of sale.
  b. docs/KNOWN_ISSUES.md: update KI-170; file KI-184 (open; fix in TA-06); update KI-109 if the review confirms the
     footnote change; move KI-022 under the fixed heading (its text already says fixed in T2). Do not file KI-183.
  c. CR-0008: the status paragraph (lines 10 to 15) and the "Status" section (line 549 on): T5 added; "none pushed"
     becomes "on origin through continuation/ex-01-task-ta-03-20261027"; add "Scope of part T5" and "Verification
     (part T5)" sections in the existing pattern; the T5 reconciliation; question 17's state with the neutral note;
     add the two lead questions on the tax-defaults list (the single equity-ETF fund-of-funds 90/90 default, PD-06;
     the 30% slab rate used to order set-off, PD-07).
  d. CHANGELOG.md, docs/PROJECT_STATE.md, docs/TESTING.md (section 1: regression files and checks; smoke 36).
  e. CLAUDE.md line 99: smoke "35 checks" becomes 36.
  f. docs/legacy/ARCHITECTURE.md: taxClassify(h, R, refDate), taxClassOf(h, R, refDate), the usualBucket and
     catAssumed marks, the unreconciled reason kind.
  g. docs/change-requests/README.md: the CR-0008 row.
Accept when: docs-links passes and every statement matches the code and the check results.

F5. Run the full check list on the final head. In each Bash call: cd "$W" first (it is inside the repository), then:
  export PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt
  FINAL=$(md5sum index.html | cut -c1-32)
  node tools/check-invariants.js --expect-md5 "$FINAL"                      # all hold, 1 warning (KI-027)
  for z in Asia/Kolkata UTC; do TZ=$z node tools/smoke-review.js; done      # 36/36 both
  node tools/test-ai-analyst.js                                             # 24/24
  for z in Asia/Kolkata UTC; do TZ=$z node tools/run-regression.js; done    # every file (44 or more) passes, both
  for z in Asia/Kolkata UTC; do TZ=$z node --test "tests/**/*.test.mjs" "tests/**/*.test.ts"; done   # all pass, both (234 at 97a7d69)
  node scripts/data-extract.ts --check                                      # matches
  node scripts/validation/docs-links.mjs
  node scripts/validation/traceability.mjs
  node scripts/validation/privacy-scan.mjs docs *.md                        # summary must say the deny-list was applied
  node scripts/validation/privacy-scan.mjs --diff origin/main
  node scripts/validation/monthly-prd-check.mjs
  node scripts/validation/prepush-scan.mjs --base origin/main --head HEAD   # PASS, with the deny-list
  node scripts/validation/release-check.mjs                                 # keep the report for the PR; WARN on the branch name only
If node --test reports a missing package, run npm ci in the worktree first (never npm install). Record every command,
result, count and time zone, and say plainly which checks you did not run.

F6. Reviews, commit and push:
  - financial-domain-reviewer (read-only): T5 item by item against the header and the reckoner; the part T4 check
    CR-0008 says is due; the two T2 anchor revisions of 97a7d69. Points to ask it about: the live page dates the usual
    bucket by the valuation date, the new build by the date of sale; which category strings count as "stated" for an
    AIF (the test at the label on line 126). Accept when it says "approve".
  - security-release-reviewer: GO on the staged diff before every commit that will be pushed.
  - Stage named files only (never git add -A blindly); commit with a message in the repository's style, for example
    "fix(tax): T5, the usual bucket dated, wording and inputs; T5 records (CR-0008, D-040)", ending with the
    Co-Authored-By trailer your session's attribution rule gives (this repository's commits so far end with
    "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"). The git identity is configured; do not change git
    config.
  - Push from your worktree with the deny-list exported:
      export PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt
      git -C "$W" push origin continuation/ex-01-task-ta-03-20261027
    The pre-push hook runs your worktree's scanner; check its output says the deny-list was applied.
  - Send the Gate A report (format at the end of this message) to MOD-02 and ARC-01.

F7. Browser QA of the final combined page, by the qa-engineer agent (independent of you). Serve your worktree:
  cd "$W" && node tools/make-sample-base.js
  then serve on port 8133. Add a launch configuration named dashboard-ta03 to your session's own launch configuration
  file (the private supplement names it): runtimeExecutable "C:/dev/tools/node/node.exe" (as the other entries in that
  file use), runtimeArgs
  ["C:/dev/portfolio-review/.claude/worktrees/wf_c9c8da96-497-10/tools/serve-dashboard.js", "8133"], port 8133. Never
  edit the tracked C:\dev\portfolio-review\.claude\launch.json (a shared hotspot; the main checkout must stay clean).
  If your session can only use that tracked file, start node .../tools/serve-dashboard.js 8133 as a background process
  instead and open http://127.0.0.1:8133 in the browser by its address.
  Cover: docs/TESTING.md section 4 steps 1 to 8 (step 4 gives the expected status line: 13 holdings, 2 clients, CMV
  Rs 8.74 Cr, 1 holding not matched); the Taxation tab (tax classes; the usual-bucket note; the
  assumed-category note; the unreconciled heading by reason; the harvest card with real typing of "1,25,000",
  "125,000" and a blank; the Sec 198 line and the pool table showing 0 without a minus sign); the AI Analyst tax
  signal; family-isolation.js (await familyChecks.isolation(): 11 checks, then irrBeforeBase() and removeThenReload()
  on fresh pages, all pass: true); cvs-refresh.js (planRefresh(), hybridSplit(), unallocated(), fof(), each on a
  fresh page); an empty console; no network request. The qa-engineer definition is stale (it says 17 AI checks and
  port 8099), so give it the port, the counts and this list. If it cannot drive a browser in your session, run the
  steps yourself and say so in the report.
  Office check: render the tax slides from the synthetic files only, with the output outside the repository:
    SCR="$(mktemp -d)"
    node "$W/tools/render-slides.js" "$W/test-data/Sample_Base_File.xlsx" "$W/test-data/Sample_IRR_Transactions.xlsx" "$SCR/tax.pptx" tax
  then open it in PowerPoint and look at the class slide (footnote above the black band), the holding-detail slide and
  the harvest slide ("Left out" with the CMV); export the workbook from the page and open it in Excel. Never point
  render-slides.js at a real client file.
  Accept when: qa-engineer's verdict is PASS (Low items listed) and the Office check is clean, with evidence.

F8. Gate B: ARC-01 reviews the diff 6443826...<your head>, the interfaces above, a merge simulation against main and
NB-01's branches, and the tests. Fix its findings or answer them in writing. If ARC-01 does not exist yet, tell
MOD-02 (it launches ARC-01, task TC-04); TA-03 cannot pass Gate B without it. The F7 checks may run before Gate B,
but Gates A to C must all pass on the same final head: any commit after ARC-01's GO voids it, and you re-run the
Gate C checks on the new head and ask ARC-01 for a new verdict.

F9. The pull request. MOD-02 decides the branch (task TC-23): either this continuation branch (release-check only
warns) or a fix/ branch at the same commit, named fix/legacy-batch-3-tax-cr-0008, created with
  git -C "$W" switch -c fix/legacy-batch-3-tax-cr-0008
(this changes no file and keeps the continuation branch; every later commit goes on the fix/ branch), then
git push -u origin fix/legacy-batch-3-tax-cr-0008 from the worktree with the deny-list exported. Open the PR against main with gh pr create, title
  fix: live page tax rules follow the TY 2026-27 reckoner (tax batch, KI-160 to KI-182, CR-0008)
and a body with: the change-impact contract; what changed (T1 to T5); every check with counts and time zones; the
release-check report; the reviews; the browser and Office results; the page MD5s; known risks; and the state of
questions 17 and 18. A draft PR is fine while the owner's answers are open. Accept when: CI "Dashboard checks" is green
on the PR, both jobs.

F10. The merge, only when ALL hold: Gates A to C passed on the same head; CI green on the PR; ARC-01's GO; the owner
has answered questions 17 and 18 (PD-02, PD-03) or accepted the safe defaults (neutral AIF note; crypto out of
set-off), as relayed by MOD-02; MOD-02 has said "go to merge" for this PR. Then, in the main checkout:
  M=/c/dev/portfolio-review
  B=$(git -C "$W" rev-parse --abbrev-ref HEAD)        # the PR's branch
  export PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt
  git -C "$M" status --short --branch                 # "## main...origin/main" and nothing else; else stop
  git -C "$M" fetch origin
  git -C "$M" merge --ff-only origin/main             # only brings local main up to origin/main
  N=$(gh pr view "$B" -R "$R" --json number -q .number)
  T=$(gh pr view "$B" -R "$R" --json title -q .title)
  CO="Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"   # change only if your attribution rule names another model
  git -C "$M" merge --no-ff "origin/$B" -m "Merge pull request #$N from productsteamcentricity/$B" -m "$T" -m "$CO"
  git -C "$M" log -1 --format=%B                      # three paragraphs, as on 6443826
  git -C "$M" push origin main                        # the hook scans with the deny-list
  cd "$M" && node scripts/validation/release-check.mjs --after-push
If the merge stops on a conflict, do not force anything: run git -C "$M" merge --abort and report to MOD-02.

F11. Verify Pages (Gate D), then report:
  gh run list -R "$R" --workflow pages.yml --limit 1          # wait for success on the merge commit
  git -C "$M" show origin/main:index.html | md5sum
  curl -s https://productsteamcentricity.github.io/portfolio-review-dashboard/ | md5sum        # must equal the line above
  curl -s https://productsteamcentricity.github.io/portfolio-review-dashboard/next/ | wc -c      # 46905
  curl -s https://productsteamcentricity.github.io/portfolio-review-dashboard/next/ | sha256sum  # 0407eb12... unchanged
Pages can serve the old file for a few minutes; poll, do not conclude early. If /next/ differs, report it (TA-03 does
not touch the app). Accept when: CI green on main; Pages green; the live MD5 equals the merged index.html; /next/
unchanged. Then send MOD-02 the merge SHA, the CI and Pages run ids and the hashes, so it writes the baseline row and
the gate rows and tells NB-01 to take main. Gate E (the owner accepts the visible tax changes on the live link) is
MOD-02's to arrange.

If main has moved before you merge: merge origin/main into your branch (never rebase). If only docs or app/ changed
(NB-01's M1.4 does not change index.html), resolve DECISIONS.md in number order and keep both sides' rows in
KNOWN_ISSUES.md, PROJECT_STATE.md, CHANGELOG.md and TESTING.md. If main's index.html changed (another fix or the
October refresh), rebuild the page as in D2 from the new main page plus the five tax patches, revise an anchor only
where a patch refuses (as 97a7d69 did), record every new MD5, regenerate data/refdata, and re-run everything from F5.

============================================================
G. COORDINATION
============================================================
- MOD-02 (the Master Project Moderator) assigns your tasks, allocates numbers, asks the owner every question, relays
  the answers, gives "go to merge", and is the only writer of docs/project-control/. Send it: the start report (D6),
  the contract (F2), the Gate A report (F6), the QA and review results (F7, F8), and the merge report (F11).
- ARC-01 (the Guardian) gives Gate B; it may block with a NO-GO. If you disagree, answer in writing; MOD-02 settles
  it, then the owner. Never merge over a NO-GO.
- NB-01 (the new-build chat) owns Workstream B. Do not change its files. The tax-table agreement (TR-7, LD-11) is
  recorded; any change to it goes through MOD-02.
- The owner: questions only through MOD-02. Pending answers that touch TA-03: PD-02 and PD-03 (block the merge);
  PD-01, PD-04, PD-44 (block sign-off, not the merge); PD-06, PD-07 (consistency with the new build); PD-43 (OD-28).
  If the owner writes to you directly, answer plainly and put the exchange in your next report to MOD-02.
- How to send a message: use cross-session messaging if your session has it; otherwise write the message in your
  reply and tell the owner it is ready to paste to MOD-02. Never claim a message was sent when it was not.
- Do not begin changing a shared component (the ENGINE keys, REFDATA, data/refdata, resetFamilyState, the shared
  documents beyond TA-03's own rows) until the ownership check (D5) and the change-impact contract (F2) are done.
- Specialist agents in .claude/agents/: financial-domain-reviewer, qa-engineer, security-release-reviewer,
  implementation-engineer, dashboard-archaeologist, refresh-operator. If your session does not list them as subagent
  types, give a general subagent the agent file's instructions. They review, test or implement; they never commit,
  push or merge.

============================================================
H. GIT INSTRUCTIONS
============================================================
- Work only in /c/dev/portfolio-review/.claude/worktrees/wf_c9c8da96-497-10 on continuation/ex-01-task-ta-03-20261027.
  Before every change, check: git -C "$W" rev-parse --abbrev-ref HEAD and git -C "$W" status --short.
- Do not overwrite the branch and do not create duplicate branches. The only extra branch allowed is
  fix/legacy-batch-3-tax-cr-0008, and only if MOD-02 chooses it for the PR (F9).
- One writer: if you use a workflow or subagents to implement, only one of them writes in the worktree at a time;
  reviewers read only. (Two writers in this worktree are why T5 is unreviewed.)
- Never: force-push; rebase; reset --hard; amend or rewrite a pushed commit; stash; delete a branch or worktree;
  --no-verify; edit index.html except through a patch script; write index.html with PowerShell redirection; commit
  test-data/, decks, workbooks or any client file; copy a deny-list term anywhere.
- Push only from this worktree, with PRD_PRIVACY_DENYLIST exported. The first push of a new branch is
  git push -u origin <that branch>.
- Merge only in the main checkout, only by D-020 (F10), only after the go. Leave the main checkout on main and clean.
- Never cd outside C:\dev\portfolio-review in Bash while a worktree workflow runs.

============================================================
I. COMPLETION REQUIREMENTS
============================================================
- Records inside your PR: CR-0008, D-040, KNOWN_ISSUES (KI-170, KI-184, KI-109, KI-022), CHANGELOG, PROJECT_STATE,
  TESTING, CLAUDE.md line 99, legacy ARCHITECTURE, the change-requests index; every page MD5 recorded where the
  earlier parts recorded theirs.
- Reports to MOD-02, who updates the registers (task register, active-change register, integration log, chat registry):
  the status of TA-03 at each step (IMPLEMENTED, NOT FULLY VERIFIED until it is merged and verified live; VERIFIED
  COMPLETE after Gate D; Gate E recorded separately); every gate result with SHAs, MD5s, run ids, counts and time zones;
  the checks not run; new defects (with their KI from your range); when you take the worktree (D5) and when TA-03's
  files are released after the merge.
- Git records: all work committed and pushed on your branch; the PR merged by D-020; nothing left uncommitted.
- Context health: hand over at 3 compactions, or as soon as you cannot rebuild your state reliably. Stop new work;
  commit a WIP checkpoint on your branch with a first line "WIP: checkpoint task TA-03 (<part>) for context handover"
  followed by the parent, the page MD5, what was verified, what is NOT done and any caution; push it; write the dated
  handover note and successor prompt as docs/handover/continuations/README.md says (successor id EX-02, branch
  continuation/ex-02-task-ta-03-<yyyymmdd>); tell MOD-02 and the owner.
- When TA-03 is merged and verified: wait for MOD-02's next assignment (TA-05 follows once PD-09 is answered).

============================================================
J. UNCERTAINTY WARNINGS (investigate before treating the handover as complete)
============================================================
1. The T5 patch is unreviewed: two implementer agents may have written in this worktree at once.
2. Whether MOD-01's T5 brief named anything beyond its nine entries is UNCERTAIN.
3. The investigator's 28 Oct checks on 5F1C2FC5 ran outside the repository; they are leads, not your evidence.
4. No CI run has ever happened on this branch. How a dispatched run treats release-check is INFERRED.
5. No browser QA of the combined page has ever run; 5581d90's "browser QA passed, gate GO" covers the pre-rebase page
   61FC0FB2 only. Whether T1 and T2 ever had their own browser check is UNKNOWN.
6. Whether the part T4 financial check that CR-0008 line 13 waits for ever took place is UNKNOWN.
7. node --test, docs-links, traceability and the pre-push scan have never run on T5; node --test was 234/234 at 97a7d69.
8. The live page dates the usual bucket by the valuation date; the new build (TR-7, LD-11) by the date of sale. The
   owner has not confirmed LD-11 (PD-16 item 7) or the usual-bucket default (PD-44).
9. Which category strings real AIF rows carry, and which foreign-share marker real base files use, are open (CR-0008
   questions 4 and 17).
10. An owner answer to question 17 or 18 that differs from the build is new work: a patch revision, tests and a
   financial review.
11. The documented rebuild rule ("checkout, then every patch in file-name order") fails on today's main (TA-23); use D2.
12. tools/check-invariants.js does not check the four new tax ENGINE keys (TA-22), so a dropped key would pass it.
13. Several records on main lag git (PROJECT_STATE, HANDOVER.md, the CR index). Git wins.
14. The project-control registers were written on 28 Oct and live on the handover branch until it merges; re-check
   anything older than the latest commit.
15. NB-01's M1.4 branch is local only; if it merges first, you resolve the four document hunks.
16. If the private supplement or the coordination notes are missing, ask MOD-02; do not guess their contents.

============================================================
GATE A REPORT FORMAT (fill with the values at the time of the report)
============================================================
Gate A report: TA-03 (CR-0008, D-040; REQ-066, REQ-029)
Chat: EX-01. Branch: continuation/ex-01-task-ta-03-20261027 (or the fix/ branch MOD-02 chose).
Worktree: C:\dev\portfolio-review\.claude\worktrees\wf_c9c8da96-497-10
Base: 6443826 (page 12B5E5727FCA01EF2EA162C59913F01D). Head: the full SHA of your final commit (page MD5 and bytes).
Patch scripts: 2026-10-27-tax-1 to tax-5 (and what changed in tax-5, if anything).
Ids used: D-040; KI-160 to KI-182, KI-184 (and KI-185 if agreed).
Files changed: the output of git -C "$W" diff --stat 6443826...HEAD (summary line and any file outside the list in E).
Checks run: each command, its result, its counts and its time zone.
Checks NOT run: each one, and why.
Open issues and new known issues: each, with its id.
Scope versus the contract: unchanged, or each change and MOD-02's agreement.
Status: IMPLEMENTED, NOT FULLY VERIFIED.
````

## Change log

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version, for EX-01 taking over TA-03 at `0f1c5d3` |
| 30 Oct 2026 | MOD-01 (fixer pass) | Validation findings applied: the owner starts EX-01 in the same project folder as the other chats; the rollback in F2 item 11 prefers a forward fix (release-check fails a plain revert); the launch entry uses the session file's node path; Gates A to C on the same final head (F8) |
