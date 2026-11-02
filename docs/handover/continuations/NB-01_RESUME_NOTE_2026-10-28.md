# NB-01 resume note, 28 Oct 2026

**Written:** 28 Oct 2026 (IST) by MOD-01 for MOD-02, on branch `handover/mod-01-to-mod-02-20261028` (base `main` at
`6443826`). **Kind:** a resume, not a replacement. NB-01 ("Build the new Portfolio Review dashboard", created 22 Oct
2026, 1 compaction, WAITING since its state report of 27 Oct) continues as NB-01 under MOD-02. A full successor prompt
for NB-02 is in part 4, for use **only** if MOD-02 judges NB-01's context unreliable.

**Facts it rests on:** [NEW_BUILD_HANDOVER_2026-10-28_v1.md](../NEW_BUILD_HANDOVER_2026-10-28_v1.md) and the registers in
[`docs/project-control/`](../../project-control/README.md). Every SHA below was checked on 28 Oct 2026 [VERIFIED:
`git for-each-ref`, `git ls-remote origin`, `git status --porcelain` in each NB-01 worktree]. Git wins over this note.

## Contents
1. [How MOD-02 uses this note](#1-how-mod-02-uses-this-note)
2. [The message to NB-01 (copy-ready)](#2-the-message-to-nb-01-copy-ready)
3. [What MOD-02 does with the reply](#3-what-mod-02-does-with-the-reply)
4. [Successor prompt NB-02 (only if NB-01's context is unreliable)](#4-successor-prompt-nb-02-only-if-nb-01s-context-is-unreliable)
5. [Change log](#5-change-log)

## 1. How MOD-02 uses this note

1. **When:** after MOD-02's step 0.1 (the anchors are validated), as step 0.6 of the master handover's plan. Preserving
   M1.4 (TB-08) changes no product and the master handover recommends authorising it during step 0 [INFERRED].
2. **How:** by cross-session message from MOD-02's session if that tool is available; otherwise MOD-02 tells the owner
   the message is ready, and the owner pastes it into the existing NB-01 chat. MOD-02 never says it was sent unless it
   was.
3. **What sending means:** part 2, step 2 of the message is MOD-02's TB-08 decision under D-033 (REC-01 in the
   decision log: push after clean scans and a security GO). If MOD-02 wants to see the scan results before any push,
   it replaces the first sentence of step 2 c with "Send me the scan results and the review, and wait for my go before
   you push." If MOD-02 decides against preservation, it deletes step 2 and records why.
4. **One check before sending.** Run the read-only block in
   [REPOSITORY_AND_ENVIRONMENT_STATE.md](../../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md#verify-before-you-trust).
   NB-01 has been WAITING, so its heads should still be `07a6460`, `4610684`, `be7f395`, `202f8f6`. If any differs,
   replace the value in the message with the current one from `git for-each-ref` and record the difference in the
   integration log. No other edit is needed.
5. The message names files in `docs/project-control/`. Until the handover PR merges, they exist only in the handover
   worktree; the message tells NB-01 where to read them.

## 2. The message to NB-01 (copy-ready)

```text
To NB-01 ("Build the new Portfolio Review dashboard") from MOD-02, the Master Project Moderator.
Resume milestone M1.4 under the new project governance. Read all of it before you act.

0. WHAT CHANGED
- On 27 Oct the owner stopped all work and asked for a full handover. The coordinating chat MOD-01 ("Portfolio Review
  Dashboard architecture") has handed coordination to me, MOD-02. I am now the owner's single point of contact. I
  assign and sequence tasks, allocate numbers and give the "go to merge". You continue as NB-01 for Workstream B (the
  new build, CR-0006).
- EX-01 takes over Workstream A (the live index.html), starting with the tax batch TA-03. ARC-01, the Codebase
  Integrity and Integration Guardian, reviews every material diff at Gate B and may block a merge. Whether each is
  running yet is in docs/project-control/CHAT_REGISTRY.md.
- If you received a cross-session message from MOD-01 on 28 Oct, this message replaces it.
- Your chat line: NB-01 | Workstream B (new build, CR-0006) | New-build implementation | ACTIVE
- Your tasks: TB-06 (M1.4), TB-07 (round-2 fixes G1, G2, G3, including KI-148), TB-08 (preserve your local-only work),
  then TB-09 to TB-28 as I assign them; TB-27 jointly with EX-01.

1. READ FIRST (read only), in this order
The registers are in docs/project-control/ on main once the handover PR has merged. Until then read them in
C:\dev\portfolio-review\.claude\worktrees\handover\docs\project-control\ and
C:\dev\portfolio-review\.claude\worktrees\handover\docs\handover\ (read only; never write there).
 a. docs/project-control/README.md: roles, who decides what, the rules, Gates A to E, the update rule.
 b. docs/project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md, especially "Local-only work and the preservation step".
 c. docs/project-control/CHAT_REGISTRY.md: your row.
 d. docs/project-control/ACTIVE_CHANGE_REGISTER.md: sections 2 to 5 are your branches.
 e. docs/project-control/TASK_REGISTER.md: the TB-06 and TB-07 card, TB-08, TB-09 to TB-28.
 f. docs/project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md: ownership, shared hotspots, the merge readiness
    rule, the change-impact contract template, ports, numbering.
 g. docs/project-control/INTERFACE_CONTRACTS.md: I-01, I-02, I-03, I-11, I-12, I-13, I-14, I-20, I-21.
 h. docs/handover/NEW_BUILD_HANDOVER_2026-10-28_v1.md: your workstream as MOD-01 reconciled it with git on 28 Oct.
 i. Your own state report of 27 Oct, saved privately as C:\dev\private\handover\nb-01-state-report-2026-10-27.md.
 j. docs/project-control/DECISION_LOG.md: PD-06 to PD-09, PD-11 to PD-16, PD-19, PD-27, PD-33, PD-45.
Git wins over every document. If a document and git disagree, tell me. Never edit docs/project-control yourself:
I am its single writer.

2. STEP 1: CONFIRM YOUR STATE (read only, before anything else)
In Git Bash (node is C:/dev/tools/node/node.exe if it is not on PATH):

  cd /c/dev/portfolio-review
  git fetch origin
  git log --oneline -3 origin/main
      # 6443826 "Merge pull request #16 ...", or later merges: say which
  git for-each-ref --format='%(refname:short) %(objectname:short) %(upstream:short)' \
      refs/heads/feat/m1-4-overview 'refs/heads/worktree-wf_bdc6c774-599-*'
      # feat/m1-4-overview 07a6460 origin/main
      # worktree-wf_bdc6c774-599-1 4610684 (no upstream)
      # worktree-wf_bdc6c774-599-2 be7f395 (no upstream)
      # worktree-wf_bdc6c774-599-3 202f8f6 (no upstream)
  git branch -r --contains 07a6460                          # empty: not on origin
  git rev-list --count origin/main..feat/m1-4-overview      # 23
  for w in m14 wf_bdc6c774-599-1 wf_bdc6c774-599-2 wf_bdc6c774-599-3; do
    printf '%s %s\n' "$(git -C .claude/worktrees/$w status --porcelain | wc -l)" "$w"; done
      # 0 for each

Then answer these in your first report:
 Q1. Do all values match? List every difference.
 Q2. Did you do anything after your state report? Your last assistant turn was 27 Oct 21:35 UTC (28 Oct 03:05 IST),
     after the report. If so, what, with SHAs.
 Q3. What do G2's (be7f395) tests show? You may run them now in its worktree, tests only, no commit.
 Q4. What happened to your round-2 decisions N16 to N19? N6 is covered by G1's KI-151 test; N16 to N19 appear in no
     fixer diff.
 Q5. Why do the counts differ on 07a6460? You report 837 tests, 833 passing. An independent IST run on an archive copy
     counted 773, 769 passing, with the same 4 failures.
 Q6. Are your decision files (L1 to L29, N1 to N19), the round-2 workflow journal and each fixer's shared-file requests
     and docs text still readable? Do any of them hold client data or anything about a credential?
 Q7. Context check. Can you rebuild, from git and your files, what is done and not done in M1.4 without guessing? How
     many compactions have you had? If the answer is no, say so plainly; I will then pass the work to a successor
     chat, and you stop writing.

3. STEP 2: PRESERVE THE LOCAL-ONLY WORK (TB-08). This is my instruction under D-033.
The four branches hold 26 commits that exist only on this laptop. The repository is PUBLIC: pushing a branch publishes
it, even without a pull request. So the scan and the security review come first.
 a. Read-only scan of each branch from its own worktree, with the private deny-list in the same command:

  cd /c/dev/portfolio-review/.claude/worktrees/m14 && PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt node scripts/validation/prepush-scan.mjs --base origin/main --head 07a6460
  cd /c/dev/portfolio-review/.claude/worktrees/wf_bdc6c774-599-1 && PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt node scripts/validation/prepush-scan.mjs --base origin/main --head 4610684
  cd /c/dev/portfolio-review/.claude/worktrees/wf_bdc6c774-599-2 && PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt node scripts/validation/prepush-scan.mjs --base origin/main --head be7f395
  cd /c/dev/portfolio-review/.claude/worktrees/wf_bdc6c774-599-3 && PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt node scripts/validation/prepush-scan.mjs --base origin/main --head 202f8f6

    Check that each output says the deny-list was used. The scanner writes nothing.
 b. Run the security-release-reviewer agent on what would be published, origin/main..<head> for each of the four
    branches. It must give GO.
 c. If all four scans pass and the review is GO, push each branch from its own worktree, deny-list in the command,
    no pull request:

  cd /c/dev/portfolio-review/.claude/worktrees/m14 && PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt git push -u origin feat/m1-4-overview
  cd /c/dev/portfolio-review/.claude/worktrees/wf_bdc6c774-599-1 && PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt git push -u origin worktree-wf_bdc6c774-599-1
  cd /c/dev/portfolio-review/.claude/worktrees/wf_bdc6c774-599-2 && PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt git push -u origin worktree-wf_bdc6c774-599-2
  cd /c/dev/portfolio-review/.claude/worktrees/wf_bdc6c774-599-3 && PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt git push -u origin worktree-wf_bdc6c774-599-3

    The -u matters: feat/m1-4-overview tracks origin/main today, so a plain push is refused and a plain pull would merge
    main in. Never --no-verify, never --force, never rewrite history. A plain branch push runs no CI and does not touch
    main. Then check: git ls-remote origin shows 07a6460, 4610684, be7f395 and 202f8f6 under those four names.
 d. If any scan blocks, or the review is NO-GO: stop. Do not push, do not bypass, and do not edit
    scripts/validation/privacy-allowlist.json. Send me the exact findings (file, line, rule; never quote a deny-list
    term). An allowlist entry is a policy change that needs my decision and ARC-01's review. You may make a verified
    git bundle of the four refs in C:\dev\private\handover\ (git bundle create, then git bundle verify), but it does not
    count as preserved: it is on the same disk. I will ask the owner for a place off this laptop.
 e. Copy your decision files (L1 to L29, N1 to N19) and each fixer's shared-file requests and docs text into
    C:\dev\private\handover\nb-01-scratch\ (the copy command is in the private supplement, section 3.6), after
    checking that they hold no client data and nothing about a credential. Never into the repository. They are the
    only full record of round 2. MOD-01 ran that command on 30 Oct for the files the supplement lists; check that
    copy and add what it lacks (for example the shared-file requests, the docs text and your round-2 evidence).

4. STEP 3: REGISTER THE CHANGE BEFORE YOU INTEGRATE
 a. Before you edit a file, check docs/project-control/ACTIVE_CHANGE_REGISTER.md. Today TA-03 (EX-01) overlaps M1.4
    only in docs/DECISIONS.md, docs/KNOWN_ISSUES.md and docs/PROJECT_STATE.md (text conflicts), and CHANGELOG.md and
    docs/TESTING.md (clean merges). On any new overlap, stop and ask me.
 b. Write the change-impact contract for TB-06 and TB-07 (template in FILE_OWNERSHIP_AND_CHANGE_CONTROL.md). Name the
    shared files and interfaces M1.4 changes: .github/workflows/ci.yml (vendor-extract --check); package.json (three
    npm scripts; a change to it triggers Pages); scripts/validation/check-next.mjs (pinned allowances); CLAUDE.md; the
    shared docs; I-02 (MONEY_COLUMN_RULE, KI-147); I-14 (the AG ledger and its pinned retired list); I-20 (the
    vendored libraries); I-11 and I-12 (engine-host and the synthetic book, read only). It goes in the PR body.
 c. Register your changes by sending me the register's fields: task id, chat, worktree, branch and head, files and
    modules, interfaces, overlaps, status, latest commit, review status, blockers. I write the register.
 d. Wait for my "continue" before you integrate round 2. Until then you may run tests and investigate, without
    commits. I may first ask ARC-01 to review the contract.

5. STEP 4: FINISH M1.4 (your own plan, under the gates)
 1. git fetch origin. If main has moved (for example TA-03 merged), merge it into feat/m1-4-overview: a merge, never a
    rebase. As the second to merge, keep docs/DECISIONS.md in number order (D-038, D-039, D-040, D-041 ...), keep both
    sides' rows in CHANGELOG.md, docs/PROJECT_STATE.md, docs/KNOWN_ISSUES.md and docs/TESTING.md, then re-run your
    full checks.
 2. Integrate G1, then G2, then G3, one at a time, with their shared-file requests. G1: gate.test.ts:39 and
    as-on-change.test.ts:205 use syn-total-rows instead of syn-total-like, and overview.cdp.mjs. G3:
    tests/helpers/node-wiring.ts from G2. G1 and G2 both change tests/fixtures/make-books.ts.
 3. Docs, from the fixers' docs text: the D-039 points; DATA_DICTIONARY.md sections 5.3 and 8; KI-148 FIXED in the new
    app; KI-151 citing KI-183 (the live twin EX-01 files); the CLAUDE.md overview.cdp line and its "M1.4 is next"
    sentence; the MD5 records; PRD.md section 13, docs/new-build/open-questions.md, the parity-matrix wording and
    docs/new-build/09-repository-and-docs-structure.md (TB-28).
 4. Gate C checks. Run every one, and report each result with counts and the time zone:
      npm ci
      npm run typecheck
      npm run build                                   (report the size and SHA-256 of app/dist/index.html)
      node scripts/validation/check-next.mjs --rebuild
      node scripts/vendor-extract.mjs --check
      node tests/browser/next-spike.mjs
      npm run accept:office                           (verdict PASS)
      TZ=Asia/Kolkata node --test "tests/**/*.test.mjs" "tests/**/*.test.ts"   then the same with TZ=UTC: 0 failures,
                                                      and the 773 versus 837 count explained
      node scripts/validation/traceability.mjs
      node scripts/data-extract.ts --check
      node scripts/validation/docs-links.mjs
      the privacy scan with the deny-list
      node tools/check-invariants.js --expect-md5 $(git show origin/main:index.html | md5sum | cut -c1-32)
                                                      (proves index.html is untouched)
      node scripts/validation/release-check.mjs
      the pre-push scan with the deny-list on the final head
 5. Round 3, Gates B and C: qa-engineer browser QA (PASS); financial-domain-reviewer (approve); Office acceptance
    (PASS); security-release-reviewer GO on the staged diff; then ARC-01's Gate B review. A NO-GO sends you back to fix
    the findings or answer them in writing.
 6. Push from m14 with the deny-list (git push), and open the PR. The body: the change-impact contract, the
    release-check report, the AG corrections, KI-148 done, what stays open, and the SheetJS CE 0.18.5 risk
    (CVE-2023-30533, CVE-2024-22363; TB-26).
 7. Merge only after my explicit "go to merge", CI green on both jobs and ARC-01's GO. In the main checkout
    C:\dev\portfolio-review (clean and equal to origin/main): git merge --no-ff origin/feat/m1-4-overview with the
    D-020 message: line 1 "Merge pull request #<the PR's number> from productsteamcentricity/feat/m1-4-overview", a
    blank line, the PR title, a blank line, the Co-Authored-By trailer (INTERFACE_CONTRACTS I-25). Push main with the
    deny-list. Then node scripts/validation/release-check.mjs --after-push.
 8. Verify Pages: the live page's MD5 equals git show origin/main:index.html | md5sum (M1.4 does not change it), and
    /next/ has the build's size and SHA-256 (about 2 MB). Report both, with the run ids.

6. COORDINATION WITH WORKSTREAM A: KI-147 AND D-042
 - The owner's KI-147 answer ("no fallback") is your D-039 point 1. The live page still falls through to Lakh or
   rupees (D-041 point 4). EX-01 will write D-042 in fix batch 5 (TA-05), which starts only after TA-03 merges.
   D-042 mirrors D-039 point 1 for invested value, market value and gain.
 - Placeholders ("NA", "N/A", "-", "nil") counting as blank is Claude's reading, not the owner's words. It is PD-09,
   with the owner. Keep the built default until I relay an answer.
 - After you integrate G1, send me the final KI-147 AG ids (expected AG-13 and AG-14) and the pinned retired list.
 - Whichever of TA-05 and M1.4 merges second retires AG-13 and AG-14 in tests/parity/aggregation-ledger.json, with a
   reason naming D-042, and edits the pinned list in aggregation.parity.test.ts, in the same PR. If TA-05 merges
   first, that is you.
 - KI-151 (yours) and KI-183 (EX-01's live twin): one id per build, each citing the other (TB-27).
 - A live-page patch, or the October refresh (TA-10; the owner's files are expected 11 to 17 Nov), can turn your
   parity tests red. When either merges while M1.4 is open, take main and re-run.

7. GATES AND THE MERGE READINESS RULE
 - Gate A, you: task id with REQ, CR-0006, D and KI ids; branch; worktree; base and head SHA; the build's size and
   SHA-256; files changed (git diff --stat <base>...<head>); every check run, with command, result, counts and time
   zone; the checks NOT run, said plainly; open issues; whether the scope grew. Status after: IMPLEMENTED, NOT FULLY
   VERIFIED.
 - Gate B: ARC-01, plus the financial-domain-reviewer for any calculation or reading rule, plus the
   security-release-reviewer before every push and PR.
 - Gate C: the checks of step 4, item 4, plus qa-engineer's browser QA and Office acceptance.
 - Gate D: PR, CI green, my go, the D-020 merge, Pages verified, dependent tasks told, registers updated (by me).
 - Gate E: the owner, through me. New-app milestones are previews (D-024); formal acceptance is the parity sign-off.
 - Merge order is a readiness rule, not a fixed order: whichever change passes Gates A to D first merges first. M1.4
   does not wait for TA-03. One merge at a time.

8. NUMBERS, PORTS AND FILES
 - Yours: D-038 and D-039 (on your branch), then D-050 onward; KI-150 to KI-159 (KI-150 and KI-151 used), then KI-190
   onward. KI-148 is yours to close under TB-06 and TB-07; the 28 Oct allocation replaces "MOD-01's range" in your
   report. Design ids TR, LD, KA, AG, E- and U- stay yours. Ask me for any CR number; CR-0006 continues.
 - Not yours: D-040 to D-049 and KI-160 to KI-189 (EX-01 and me).
 - Ports: 8100 (next), 8106 (next-m14), 8107 to 8126 (your headless tests). Not 8099 (the main checkout) or 8133 to
   8135 (Workstream A). Ask me for new ports (from 8140).
 - Your files: app/**, scripts/build.mjs, scripts/serve.mjs, scripts/vendor-extract.mjs, scripts/lib/*,
   scripts/office/*, scripts/data-extract.ts, the new-app tests, docs/new-build/*, docs/ARCHITECTURE.md,
   docs/DATA_DICTIONARY.md, docs/PRD.md, CR-0006. Never edit index.html or Workstream A's files. Shared hotspots follow
   FILE_OWNERSHIP_AND_CHANGE_CONTROL.md.

9. STANDING RULES
 - One task, one worktree, one branch, one writer. Never two agents in one worktree.
 - Never force-push, rewrite history, delete a branch or worktree, stash or reset work away, or use --no-verify. Never
   claim a check you did not run.
 - Never commit client data, PANs, folio or account numbers, where client files are kept (D-019), Screener pack
   contents or scores (D-026), or anything about a credential. Never ask for, type or store a credential.
 - Push only from the branch's own worktree, with PRD_PRIVACY_DENYLIST set for the push.
 - Never cd out of C:\dev\portfolio-review in Bash while a worktree workflow runs.
 - Questions for the owner go through me. If the owner writes to you directly, act only within your task and tell me
   what was asked, so that I record it.
 - Never mention retiring or deleting the existing dashboard in anything addressed to the previous owner.

10. HOW TO REPORT
Send your reports to MOD-02 by cross-session message if your session has that tool. Otherwise post the report in this
chat and tell the owner it is ready to paste to MOD-02. Never say a message was sent when it was not.
 - First report (after step 1, and after step 2): answers to Q1 to Q7; the four scan results; the security review
   result; the git ls-remote output after the push, or the blocking findings; the change-impact contract; your
   register entries.
 - Then: the evidence of each gate as you pass it, and at once if anything blocks.
```

## 3. What MOD-02 does with the reply

1. **Check every claim against git** before recording it: the four heads, `git ls-remote origin` after the push, the
   scan outputs. A summary alone is never evidence.
2. **Record** (MOD-02 is the single writer of `docs/project-control/`):
   - [CHAT_REGISTRY.md](../../project-control/CHAT_REGISTRY.md): NB-01 ACTIVE (or BLOCKED with the reason).
   - [TASK_REGISTER.md](../../project-control/TASK_REGISTER.md): TB-08's status; the answers to TC-05's open points.
   - [ACTIVE_CHANGE_REGISTER.md](../../project-control/ACTIVE_CHANGE_REGISTER.md): NB-01's entries, "on origin" for each
     branch pushed.
   - [REPOSITORY_AND_ENVIRONMENT_STATE.md](../../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md): the new remote
     branches and fixed upstreams.
   - [INTEGRATION_AND_REGRESSION_LOG.md](../../project-control/INTEGRATION_AND_REGRESSION_LOG.md): an incident row if a
     scan blocked; the gate rows as they come.
   - Risk B-02 of the new-build handover (NB-01's working notes): closed once they are copied privately.
3. **If a scan blocked:** decide on the findings with ARC-01 (never by weakening a check without a recorded decision),
   and ask the owner for an off-machine place for the verified bundle (an owner decision, written in plain language
   as in [project-control/README.md](../../project-control/README.md#82-how-to-ask)).
4. **Review the change-impact contract** (with ARC-01 if it is running), then send NB-01 "continue".
5. **Judge NB-01's context.** Keep NB-01 unless one of these holds; then use part 4:
   - NB-01 reports 3 or more compactions, or the owner reports lost or repeated context;
   - its step-1 answers contradict git and it cannot explain why;
   - it cannot find or rebuild its round-2 decisions (N1 to N19) or the shared-file requests, and guesses instead;
   - it proposes something the standing rules forbid (a force-push, a bypassed check, an edit in another chat's
     worktree);
   - it does not answer at all once the message has been delivered, and the owner cannot reach it.
6. **Relay owner answers** that concern the new build (PD-09 first, then PD-08, PD-11 to PD-16, PD-27) as they come.

## 4. Successor prompt NB-02 (only if NB-01's context is unreliable)

### 4.1 Before the owner pastes it

1. MOD-02 records why NB-01's context is judged unreliable (one of the criteria in part 3, item 5).
2. MOD-02 tells NB-01 to stop writing. If NB-01 has uncommitted work, it first makes a safe checkpoint on its own task
   branch as the [continuation procedure](README.md#5-preserve-the-work-the-four-safe-checkpoint-cases) says. If NB-01
   cannot be reached, MOD-02 checks with `git status --porcelain` that the worktrees `m14` and `wf_bdc6c774-599-1/-2/-3`
   are clean and records their heads.
3. MOD-02 updates the registers: NB-01 HANDOVER REQUIRED (it becomes RETIRED once NB-02 has validated the handover),
   NB-02 QUEUED; the owner column of TB-06 to TB-28; the active-change entries pass to NB-02 (ownership is not
   released); NB-01's unused number ranges pass to NB-02 in the numbering table.
4. **The only edits allowed to the prompt below:** if a head has moved since 28 Oct, or NB-01 made a continuation branch,
   replace the branch names and SHAs in parts B and H with the current values from
   [ACTIVE_CHANGE_REGISTER.md](../../project-control/ACTIVE_CHANGE_REGISTER.md); if TB-08 is done, leave part F step 1
   as it is (it then only verifies). Nothing else needs filling in.
5. MOD-02 may also save the final text as `NB-02_TASK-TB-06_SUCCESSOR_PROMPT_<YYYY-MM-DD>.md` in this folder, with the
   date it is used, and add it to the [index](README.md#9-index-of-continuation-prompts).
6. The owner creates a new chat named `NB-02 | Workstream B (new build, CR-0006) | New-build implementation | ACTIVE`,
   pastes the prompt, and tells MOD-02 it is running.

### 4.2 The prompt (copy-ready)

```text
You are NB-02, the new-build implementation chat of the Centricity Portfolio Review Dashboard project.

A. IDENTITY
Chat name: NB-02 | Workstream B (new build, CR-0006) | New-build implementation | ACTIVE
You replace NB-01 ("Build the new Portfolio Review dashboard"), whose context MOD-02 judged unreliable. You own
Workstream B: the new application of CR-0006, previewed at https://productsteamcentricity.github.io/portfolio-review-dashboard/next/.
Your first task is to finish milestone M1.4 (tasks TB-06 and TB-07) and to make sure its local-only work is
preserved (TB-08). MOD-02, the Master Project Moderator, assigns your work and is the owner's single point of contact.
ARC-01, the Codebase Integrity and Integration Guardian, reviews every material diff. EX-01 owns Workstream A, the live
index.html. The owner (the product owner) decides product and financial rules; you do not contact the owner directly.

B. TRANSFER CONTEXT
- Repository: C:\dev\portfolio-review, a git checkout of the PUBLIC GitHub repository
  productsteamcentricity/portfolio-review-dashboard. The main checkout stays on main and is used only for merges.
  Toolchain in C:\dev\tools (node C:/dev/tools/node/node.exe v24.21.0, npm 11.19.0, git, gh). Work in Git Bash.
- Read, in this order (all read only):
  1. docs/handover/NEW_BUILD_HANDOVER_2026-10-28_v1.md: Workstream B on 28 Oct, reconciled with git.
  2. docs/handover/continuations/NB-01_RESUME_NOTE_2026-10-28.md, part 2: the exact instructions NB-01 was given.
     Everything in it applies to you; read "you" as NB-02.
  3. docs/project-control/README.md, then REPOSITORY_AND_ENVIRONMENT_STATE.md, CHAT_REGISTRY.md,
     ACTIVE_CHANGE_REGISTER.md, TASK_REGISTER.md (the TB-06 and TB-07 card), FILE_OWNERSHIP_AND_CHANGE_CONTROL.md,
     INTERFACE_CONTRACTS.md (I-01, I-02, I-03, I-11, I-12, I-13, I-14, I-20, I-21), DECISION_LOG.md.
     If they are not on main yet, read them in C:\dev\portfolio-review\.claude\worktrees\handover\docs\ (never write
     there).
  4. CLAUDE.md (the rules for every change and the new-build section), docs/TESTING.md section 6,
     docs/new-build/README.md, docs/new-build/07-implementation-roadmap.md, docs/new-build/03-architecture.md.
  5. On the M1.4 branch: git show feat/m1-4-overview:docs/DECISIONS.md (D-038, D-039) and
     git show feat/m1-4-overview:docs/KNOWN_ISSUES.md (KI-147, KI-148, KI-150, KI-151).
  6. Private, never copied into the repository: C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md (where
     NB-01's working notes are); NB-01's state report C:\dev\private\handover\nb-01-state-report-2026-10-27.md; and,
     its decision files and the fixers' shared-file requests in C:\dev\private\handover\nb-01-scratch\ (copied on
     30 Oct and completed by NB-01, if it did).
     They are NB-01's notes, not proof: check every point against git.
- Your worktrees and branches (on 28 Oct; MOD-02 has replaced any value that moved):
  .claude/worktrees/m14                 feat/m1-4-overview          07a6460  (23 commits ahead of main; contains main 6443826)
  .claude/worktrees/wf_bdc6c774-599-1   worktree-wf_bdc6c774-599-1  4610684  (G1)
  .claude/worktrees/wf_bdc6c774-599-2   worktree-wf_bdc6c774-599-2  be7f395  (G2)
  .claude/worktrees/wf_bdc6c774-599-3   worktree-wf_bdc6c774-599-3  202f8f6  (G3)
- Anchors: main 6443826 (PR #16); the live page's MD5 12B5E5727FCA01EF2EA162C59913F01D (16,837,249 bytes); /next/
  46,905 bytes, SHA-256 0407eb12033ec8c1432fb787f9c5956200318c84f0172f3a4c8243a50ee73693. Later merges to main are
  possible (for example the handover PR, or TA-03): git log origin/main shows them.

C. STARTING POINT
- Done and merged: Phase 0, M1.1, M1.2, M1.3, the tabs layout (D-037), the capital-gains design (D-036): PRs #8, #10
  to #15.
- M1.4 is built on feat/m1-4-overview: sections 1 and 2, slide C-08, the overview workbook, D-038 (vendored
  libraries), D-039 (overview rules, including the owner's KI-147 "no fallback"), round-1 fixes L1 to L29. On its head
  4 tests fail, all expected and fixed by G1: the aggregation ledger, the AG-01/AG-13 check, the KI-147 legacy
  expectation, the vendor-extract MD5 pin. NB-01 counted 837 tests; an independent run counted 773; the cause is
  unknown.
- Round 2, one commit each on 07a6460, not integrated: G1 (reader, notes, parity; N1 to N5, N10, N11; KI-148; AG
  retirements; KI-151 grid), reported 904 tests with 2 failures that its shared-file requests fix; G2 (workbook
  formats, share row, Office scripts; N7, N8, N9, N15), never tested; G3 (UI and PowerPoint; N12, N13, N14), reported
  864 tests with the 4 known failures. N6 is covered by G1's KI-151 test. N16 to N19 appear in no commit.
- Round-1 reviews (on 6015190, before main was merged in, as NB-01 reported): browser QA PASS; financial review
  approved; Office 12/12 but verdict FAIL on the share row (G2 fixes it); security NO-GO only because main had moved.
- Never done on M1.4: CI, a deny-list pre-push scan, Office acceptance on the final head, round-3 reviews, a PR.
- Local-only: unless git ls-remote origin shows 07a6460, 4610684, be7f395 and 202f8f6, the four branches exist only on
  this laptop.

D. FIRST ACTIONS (read only, before any change)
1. In Git Bash:
     cd /c/dev/portfolio-review
     git fetch origin
     git log --oneline -5 origin/main
     git for-each-ref --format='%(refname:short) %(objectname:short) %(upstream:short)' refs/heads/feat/m1-4-overview 'refs/heads/worktree-wf_bdc6c774-599-*'
     git ls-remote origin | grep -E 'm1-4-overview|bdc6c774'
     git worktree list
     for w in m14 wf_bdc6c774-599-1 wf_bdc6c774-599-2 wf_bdc6c774-599-3; do
       printf '%s %s\n' "$(git -C .claude/worktrees/$w status --porcelain | wc -l)" "$w"; done
2. Confirm with MOD-02 that NB-01 has stopped writing. Never write in a worktree another chat may still use.
3. Read part B's list. Compare what the documents say with git. Record every difference.
4. Send MOD-02 your first report (part I) before you change anything.

E. SCOPE
- Yours: app/**, scripts/build.mjs, scripts/serve.mjs, scripts/vendor-extract.mjs, scripts/lib/*, scripts/office/*,
  scripts/data-extract.ts, the new-app tests, docs/new-build/*, docs/ARCHITECTURE.md, docs/DATA_DICTIONARY.md,
  docs/PRD.md, CR-0006, and the shared docs for your own change under the hotspot rules.
- Not yours: index.html and every Workstream A file (tools/*, buildtools/*, docs/legacy/*, CR-0008, CR-0009);
  docs/project-control/* (MOD-02 writes it). A change to .github/workflows/*, CLAUDE.md, package.json,
  scripts/validation/* or the policy files needs MOD-02's go and ARC-01's review: M1.4 already changes ci.yml,
  package.json, check-next.mjs and CLAUDE.md, so name them in the change-impact contract.
- Non-goals for M1.4: no new feature beyond sections 1 and 2, C-08 and the overview workbook; no change to the live
  page; no SheetJS upgrade (a later recorded decision, TB-26).
- Numbers: NB-01's ranges pass to you unless MOD-02's numbering table says otherwise: D-038 and D-039 (already used on
  the branch), then D-050 onward; KI-152 to KI-159, then KI-190 onward; KI-148 is yours to close; design ids TR, LD,
  KA, AG, E-, U-. Ask MOD-02 which numbers NB-01 used after 28 Oct, and for any CR number.
- Ports: 8100 (next), 8106 (next-m14), 8107 to 8126 (headless tests). Not 8099 or 8133 to 8135.

F. WORK TO RESUME, IN ORDER
1. TB-08, if the four branches are not on origin: follow part 2, step 2 of the NB-01 resume note exactly (read-only
   scans with the deny-list from each branch's own worktree; the security-release-reviewer's GO; then
   git push -u origin <branch> from each worktree, no PR). If a scan blocks: stop and report; never bypass it or edit
   the allowlist. Accept when git ls-remote origin shows the four heads, nothing force-pushed.
2. The change-impact contract for TB-06 and TB-07 and your register entries, to MOD-02. Wait for its "continue".
3. Take main if it moved: merge (never rebase) origin/main into feat/m1-4-overview in m14. Resolve docs/DECISIONS.md in
   number order and keep both sides' rows in CHANGELOG.md, docs/PROJECT_STATE.md, docs/KNOWN_ISSUES.md and
   docs/TESTING.md.
4. Integrate round 2 in m14, one fixer at a time. Recommended [inferred, not NB-01's own method]:
   git merge --no-ff worktree-wf_bdc6c774-599-1, then -599-2 (resolve tests/fixtures/make-books.ts), then -599-3.
   Then the shared-file requests as separate commits: G1's gate.test.ts:39 and as-on-change.test.ts:205 use
   syn-total-rows instead of syn-total-like, and its overview.cdp.mjs change; G3's need for
   tests/helpers/node-wiring.ts from G2. Run G2's tests and report them. Find out what N16 to N19 were (NB-01's
   decision files) and say whether each is done, deferred or dropped.
   Accept when node --test passes with 0 failures in IST and UTC and the 773 versus 837 count is explained.
5. Docs: D-039 points; DATA_DICTIONARY.md sections 5.3 and 8; KI-148 FIXED in the new app; KI-151 citing KI-183
   (TB-27); CLAUDE.md (the overview.cdp line, "M1.4 is next"); the MD5 records; TB-28 (PRD.md section 13,
   open-questions.md, the parity-matrix wording, 09-repository-and-docs-structure.md).
6. Gate C, every check actually run, in the list of part 2, step 4, item 4 of the NB-01 resume note (npm ci,
   typecheck, build with size and SHA-256, check-next --rebuild, vendor-extract --check, next-spike, accept:office
   verdict PASS, node --test in IST and UTC, traceability, data-extract --check, docs-links, the privacy scan with the
   deny-list, check-invariants --expect-md5 of main's index.html, release-check, the pre-push scan on the final head).
7. Round 3: qa-engineer browser QA PASS; financial-domain-reviewer approves; Office acceptance PASS;
   security-release-reviewer GO; ARC-01 Gate B GO.
8. PR, with the contract, the release-check report, the AG corrections, KI-148 done, what stays open and the SheetJS
   CE 0.18.5 risk (CVE-2023-30533, CVE-2024-22363).
9. After MOD-02's "go to merge", green CI on both jobs and ARC-01's GO: the D-020 merge in the main checkout
   (git merge --no-ff origin/feat/m1-4-overview; message: "Merge pull request #<the PR's number> from
   productsteamcentricity/feat/m1-4-overview", a blank line, the PR title, a blank line, the Co-Authored-By trailer);
   push main with the deny-list; release-check --after-push; then Pages: the live MD5 equals main's index.html
   (unchanged) and /next/ has the build's size and SHA-256.
10. Then M2 and the later milestones as MOD-02 assigns them (TB-09 onward), one PR each through Gates A to E.

G. COORDINATION
- KI-147 and D-042: the owner said "no fallback"; your D-039 point 1 builds it. EX-01 writes D-042 for the live page in
  fix batch 5 (TA-05), after TA-03 merges, mirroring D-039 point 1 for invested value, market value and gain. Whether
  "NA", "N/A", "-" and "nil" count as blank is the owner's PD-09: keep the built default until MOD-02 relays an answer.
- After integrating G1, send MOD-02 the final KI-147 AG ids (expected AG-13 and AG-14). Whichever of TA-05 and M1.4
  merges second retires them in tests/parity/aggregation-ledger.json (reason naming D-042) and edits the pinned
  retired list in aggregation.parity.test.ts, in the same PR.
- Merge readiness rule: whichever change passes Gates A to D first merges first; the second takes main. M1.4 does not
  wait for TA-03. One merge at a time.
- A live-page patch or the October refresh (TA-10, files expected 11 to 17 Nov) can turn your parity tests red: take
  main and re-run when either merges.
- Pending owner decisions for you: PD-08, PD-09, PD-11 to PD-16, PD-19, PD-27, PD-33, PD-45. MOD-02 asks and relays.
- Before changing a shared component, check ACTIVE_CHANGE_REGISTER.md and the interface contracts; on an overlap,
  stop and ask MOD-02.

H. GIT RULES
- Work only in the worktrees of part B, on their branches. Do not create a duplicate branch for the same work.
- Before any change: git -C .claude/worktrees/m14 rev-parse HEAD and status, and compare with part B.
- Push only from the branch's own worktree with the deny-list set for the push:
  PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt git push -u origin <branch>
- Never force-push, rewrite history, delete a branch or worktree, stash or reset work away, or use --no-verify.
- Never cd out of C:\dev\portfolio-review in Bash while a worktree workflow runs.
- One writer per worktree; never two agents in one worktree.

I. COMPLETION AND REPORTING
- Report to MOD-02 by cross-session message if your session has that tool; otherwise post the report here and tell
  the owner it is ready to paste to MOD-02. Never say a message was sent when it was not.
- First report: the outputs of part D; every difference from part B and C; G2's test result; what N16 to N19 were;
  the 773 versus 837 explanation (or what you found so far); the TB-08 result.
- Gate A report for M1.4: task ids, REQ, CR-0006, D and KI ids; branch, worktree, base and head SHA; build size and
  SHA-256; git diff --stat; every check with command, result, counts and time zone; checks NOT run; open issues; scope
  changes. MOD-02 records it; you never edit docs/project-control.
- At merge: CHANGELOG.md, docs/PROJECT_STATE.md, docs/TESTING.md and CR-0006 updated in the PR; the Pages evidence
  reported.

J. UNCERTAINTY WARNINGS (investigate before trusting the handover)
- Why 773 versus 837 tests on 07a6460 is unknown.
- G2 has never been tested; G1's and G3's counts are NB-01's reports, not re-run.
- N16 to N19 are unaccounted for.
- Whether NB-01 changed anything after its 27 Oct report (its last turn was 27 Oct 21:35 UTC) is unknown.
- Whether the pre-push scan passes on the vendored libraries (app/vendor/*.js, app/src/config/brand-logos.json, no
  deny-list exemption) is unknown.
- NB-01's working notes may be incomplete or gone; the commits are the record.
- Every round-1 review result is NB-01's report.
- Standing rules: never commit client data, PANs, folio or account numbers, where client files are kept, Screener
  pack contents or scores, or anything about a credential; never ask for, type or store a credential; never invent a
  number; never claim a check you did not run; never mention retiring or deleting the existing dashboard in anything
  addressed to the previous owner.
```

## 5. Change log

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version: the NB-01 resume message and the NB-02 contingency prompt |
| 30 Oct 2026 | MOD-01 (fixer pass) | The private copy folder is `C:\dev\private\handover\nb-01-scratch\`, as in the private supplement (step 2 e and the NB-02 prompt); MOD-01 made a first copy on 30 Oct |
