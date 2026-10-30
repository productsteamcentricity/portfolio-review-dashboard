# Chat registry

Last verified: **28 Oct 2026 (IST)**, by MOD-01 during the MOD-01 to MOD-02 handover.
Maintained by: **MOD-02** from the moment it validates this handover.

This register lists every Claude chat that works on the project, what each one owns and where its work is.
It is one of the project-control registers; [README.md](README.md) maps all of them.
The narrative project state stays in [docs/PROJECT_STATE.md](../PROJECT_STATE.md).
Decisions stay in [docs/DECISIONS.md](../DECISIONS.md) and defects in [docs/KNOWN_ISSUES.md](../KNOWN_ISSUES.md).
Tasks (TA-, TB-, TC-) are defined in [TASK_REGISTER.md](TASK_REGISTER.md).

**Evidence labels.** [VERIFIED] means checked with a command or a file, and the evidence is given.
[INFERRED] means reasoned from verified facts. [UNCERTAIN] and [UNKNOWN] mean what they say.

**Private details.** Session ids, transcript file names and local scratch locations are kept out of this public file.
They are in the private supplement `C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md` on the owner's laptop.

## Status words

- **Chats:** ACTIVE, WAITING, QUEUED, BLOCKED, HANDOVER REQUIRED, COMPLETED, RETIRED, SUPERSEDED.
- **Work** (tasks and changes): VERIFIED COMPLETE; IMPLEMENTED, NOT FULLY VERIFIED; IN PROGRESS; PLANNED; BLOCKED; NOT STARTED;
  EXISTING DEFECT; UNKNOWN / NEEDS INVESTIGATION; SUPERSEDED.
- A planned chat that has not been created yet is **QUEUED**.
- A chat is marked RETIRED only after its outstanding work, its file ownership and its handover are reconciled.

## Registry (owner's naming form)

`[CHAT-ID] | [WORKSTREAM] | [RESPONSIBILITY] | [STATUS]`

| Chat line | Exact name in the Claude interface | Created | Compactions |
|---|---|---|---|
| `MOD-01 \| Project-Wide \| Coordinating Moderator; Workstream A lead until handover \| HANDOVER REQUIRED` | "Portfolio Review Dashboard architecture" | 14 Oct 2026 | **4** [VERIFIED: transcript metadata scan, 28 Oct] |
| `NB-01 \| Workstream B (new build, CR-0006) \| New-build implementation \| WAITING` | "Build the new Portfolio Review dashboard" | 22 Oct 2026, 21:47 IST | **1** [VERIFIED: transcript metadata scan, 28 Oct] |
| `MOD-02 \| Project-Wide \| Master Project Moderator \| QUEUED` | not created yet; recommended title is the chat line itself | not yet | none |
| `EX-01 \| Workstream A (existing dashboard) \| Existing-dashboard implementation \| QUEUED` | not created yet; recommended title is the chat line itself | not yet | none |
| `ARC-01 \| Project-Wide \| Codebase Integrity & Integration Guardian \| QUEUED` | not created yet; recommended title is the chat line itself | not yet | none |

When a chat is created, the owner gives it the title above with its live status, and MOD-02 updates this table.

**Not chats.** Subagent workflow runs (the `.claude/worktrees/wf_*` worktrees and `worktree-wf_*` branches) belong to the chat
that started them. They are listed under that chat below.

## External party (not a chat)

| Party | Role | Contact route | Standing rule | Open items |
|---|---|---|---|---|
| The previous owner | Built the existing dashboard (May to Oct 2026) and supplied two exports (15 Oct, 23 Oct) | Only through the owner. No chat talks to the previous owner directly | Never mention deleting or retiring the existing dashboard in anything addressed to the previous owner (owner, 15 Oct; REQ-020, REQ-021) | TC-20 (held files, missing files, a note about one exported file, an unmatched fund label): owner decisions PD-22..PD-25 |

## Context-health rule

- **Hand over at 3 compactions**, or as soon as the owner reports lost or repeated context, whichever comes first.
  The owner's 27 Oct handover prompt (section 15) adds: a chat that cannot reliably rebuild its tasks or decisions,
  important details no longer in context, a task that needs a new specialist chat, or a chat being retired.
- Do not invent a compaction count. Use the evidence available (the transcript's compaction entries, or the owner's report).
- Prefer an early handover to continuing uncertain implementation.

| Chat | Compactions on 28 Oct | Threshold | Verdict |
|---|---|---|---|
| MOD-01 | 4 | 3 | Over the threshold: handover overdue [VERIFIED] |
| NB-01 | 1 | 3 | Within the threshold. NB-01 reports it can rebuild its state from git, its decision files, the workflow journals and task outputs, and re-reads files before acting [VERIFIED: NB-01 state report, section g] |

## Continuation procedure (summary for any future handover)

The full procedure is in the owner's 27 Oct handover prompt (sections 14 to 21), in
[docs/handover/continuations/README.md](../handover/continuations/README.md) and in the templates
[MODERATOR_HANDOVER_TEMPLATE.md](../handover/MODERATOR_HANDOVER_TEMPLATE.md) and
[SUBCHAT_HANDOVER_TEMPLATE.md](../handover/SUBCHAT_HANDOVER_TEMPLATE.md). In short:

1. The outgoing chat tells the owner a new chat is needed and stops starting new work.
2. It preserves its state: every worktree it owns is clean, or a labelled WIP checkpoint is committed on the task's own branch.
   Model message (from 0f1c5d3): first line `WIP: checkpoint task <TASK-ID> (<scope>) for context handover`, then the parent commit,
   the page MD5 if `index.html` changed, what was verified at the checkpoint, what is NOT done, and any caution
   (for example "treat the patch as unreviewed").
3. It creates a continuation branch from the **task branch**, never from main if main lacks the work.
   Name: `continuation/<successor-id>-task-<task-id>-<yyyymmdd>`. The release check only WARNs on this prefix (TC-23).
4. It pushes with `git push -u origin <branch>` **from that branch's own worktree**, with `PRD_PRIVACY_DENYLIST` exported.
   Never `--no-verify`, never a force-push, never a history rewrite.
5. It writes the dated handover document and a copy-ready successor prompt, and records both here.
6. It sets its own row to HANDOVER REQUIRED and adds the successor's row. After the successor validates the handover,
   MOD-02 sets the outgoing row to RETIRED with the reason.
7. The outgoing chat makes no further code changes.

## Chat details

### MOD-01

| Field | Value |
|---|---|
| Unique id and exact name | MOD-01, "Portfolio Review Dashboard architecture" |
| Responsibility and workstream | Coordinating Moderator (Project-Wide). Led Workstream A (the live `index.html`), owner decisions and merge order. Owner's single point of contact until MOD-02 starts |
| Status | **HANDOVER REQUIRED** [VERIFIED: 4 compactions; the owner's stop-and-hand-over order of 27 Oct 20:55 IST]. Becomes **RETIRED** only after MOD-02 validates this handover (its step 0.1); TA-03 then sits with MOD-02 until EX-01 confirms it |
| Assigned tasks | TC-01 (this handover package), TC-12 (private supplement). Held TA-03 until EX-01 starts: stopped at the WIP checkpoint 0f1c5d3 [VERIFIED: commit message]. Completed earlier: TA-00, TA-01, TA-02, TA-04 |
| Working directories and branches | `.claude/worktrees/handover`: `handover/mod-01-to-mod-02-20261028`, based on 6443826 [VERIFIED: `git rev-parse`, 28 Oct]. `.claude/worktrees/wf_c9c8da96-497-10`: `continuation/ex-01-task-ta-03-20261027` at 0f1c5d3, clean, pushed [VERIFIED: `git ls-remote origin`]; passes to EX-01. Stale, nothing unique: `wf_c9c8da96-497-1`, `-2`, `-3`, `-5` [VERIFIED: repo-env investigation, 28 Oct]. Shared PR-testing checkout `C:\dev\pr-review`, detached at 2a65a62 (PR #10 merge), stale |
| Reserved files and shared components | On the handover branch: new files under `docs/project-control/` and `docs/handover/`. TA-03 files (`index.html` through `tools/patches/`, `tools/regression/`, `data/refdata/TAX_RULES.json`, `VINTAGE.json`, CR-0008) are held only until EX-01 takes them over |
| Dependencies | None upstream. MOD-02, EX-01 and ARC-01 depend on this handover |
| Last known commit and deliverable | 0f1c5d3 (27 Oct 20:59 IST, TA-03 T5 WIP, pushed). Last merged deliverable: PR #16, merge 6443826 (fix batch 4), live page MD5 12B5E5727FCA01EF2EA162C59913F01D [VERIFIED: curl and `git show`, 27 and 28 Oct]. The handover branch commit is this package (SHA recorded in the integration log after commit) |
| Pending owner decisions it raised | The plain-language pack of 27 Oct (none answered) [VERIFIED: requirements investigation]. Merge blockers first: PD-02 and PD-03 (CR-0008 Q17, Q18), PD-09 (KI-147 placeholders), PD-08 (D-041 Q1). Full list in the decision log of this folder |
| Current blocker | None for the handover. The push needs the security gate and the deny-list exported |
| Current handover document | [MASTER_HANDOVER_2026-10-28_v1.md](../handover/MASTER_HANDOVER_2026-10-28_v1.md) and [MOD-01_TO_MOD-02_SUCCESSOR_PROMPT_2026-10-28.md](../handover/continuations/MOD-01_TO_MOD-02_SUCCESSOR_PROMPT_2026-10-28.md) on this branch, and the private supplement named above |
| Successor | MOD-02 (coordination). EX-01 (TA-03) |
| Retirement reason (when retired) | Context health: 4 compactions, above the owner's 3-compaction rule |

### NB-01

| Field | Value |
|---|---|
| Unique id and exact name | NB-01, "Build the new Portfolio Review dashboard" |
| Responsibility and workstream | Workstream B: the new build (CR-0006) from M1.4 onward, and the capital-gains design (D-036). MOD-01 suggested the chat as a background task and the owner started it on 22 Oct; it took code ownership on 23 Oct [VERIFIED: requirements investigation] |
| Status | **WAITING** (idle at a safe point). It stopped its round-2 fix workflow on 27 Oct and wrote a state report at 20:59 to 21:01 IST (received by MOD-01 about 21:05 IST) [VERIFIED: NB-01 state report; transcript timestamps]. Last assistant turn 27 Oct 21:35 UTC (28 Oct 03:05 IST); a system stop-hook entry follows at 28 Oct 00:58 UTC; nothing later [VERIFIED: timestamp-only transcript scan]. A cross-session message MOD-01 sent on 28 Oct has no reply [UNKNOWN: whether NB-01 has seen it]. NB-01 **continues as NB-01 under MOD-02**; it is replaced only if MOD-02 judges its context unreliable |
| Assigned tasks | TB-06 (M1.4), TB-07 (round-2 fixes G1, G2, G3), KI-148 inside TB-06/TB-07, TB-08 (preserve its local-only work, on MOD-02's instruction), TB-09..TB-23 (milestones M2..M16), TB-24..TB-28, TB-27 jointly with EX-01 |
| Working directories and branches | `.claude/worktrees/m14`: `feat/m1-4-overview` at 07a6460, **local only**, 23 commits ahead of origin/main, clean [VERIFIED: `git rev-list --count`, `git ls-remote`, 28 Oct]. `.claude/worktrees/wf_bdc6c774-599-1`, `-2`, `-3`: `worktree-wf_bdc6c774-599-1/-2/-3` at 4610684 (G1), be7f395 (G2), 202f8f6 (G3), **local only**, one unique commit each, clean [VERIFIED]. Stale (history only in the local feat/m1-4-overview): `wf_ca03729e-33b-2..6`, `wf_c3548c88-811-1..4`. Stale (merged): `cg-spec` (PR #15), `tabs` (PR #14) |
| Reserved files and shared components | `app/**`, `scripts/build.mjs`, `scripts/serve.mjs`, `scripts/data-extract.ts` (the extractor), `scripts/vendor-extract.mjs`, `scripts/lib/`, `scripts/office/` (branch), `tests/next`, `tests/unit`, `tests/parity` code, `docs/new-build/*`, `docs/ARCHITECTURE.md`, `docs/DATA_DICTIONARY.md`, `docs/PRD.md`, CR-0006. Shared hotspots it edits under MOD-02's rules: see [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md) |
| Dependencies | If TA-03 merges first, NB-01 merges main into feat/m1-4-overview and resolves the four conflict hunks. TA-05 needs NB-01's final KI-147 ledger ids (AG-13, AG-14 on G1). Owner answers PD-08, PD-09, PD-11..PD-16, PD-27 |
| Last known commit and deliverable | Branch head 07a6460 (27 Oct 19:22 IST, merge of PR #16 into feat/m1-4-overview); newest NB-01 commit be7f395 (27 Oct 20:57 IST) [VERIFIED: `git log`]. Last merged deliverables: PR #15 (fb7f59c, capital-gains design) and PR #14 (c9ec1cc, tabs across the top) |
| Pending owner decisions | PD-08 (merged-folio holding days), PD-09 (KI-147 placeholders), PD-11 (BF-19), PD-12 (BF-26), PD-13 (L7 letter case), PD-14 (market value 0), PD-15 (blank Product Name), PD-16 (capital-gains design section 15), PD-27 (blueprint approvals) |
| Current blocker | Paused by the owner's stop order; resumes when MOD-02 instructs. Its M1.4 work exists only on this laptop (TB-08) |
| Current handover document | NB-01 state report of 27 Oct (private, in the private handover folder), [NEW_BUILD_HANDOVER_2026-10-28_v1.md](../handover/NEW_BUILD_HANDOVER_2026-10-28_v1.md) and [NB-01_RESUME_NOTE_2026-10-28.md](../handover/continuations/NB-01_RESUME_NOTE_2026-10-28.md) |
| Successor | None planned |
| Retirement reason | Not applicable |

### MOD-02 (QUEUED)

| Field | Value |
|---|---|
| Unique id and name | MOD-02. Recommended title: `MOD-02 \| Project-Wide \| Master Project Moderator \| ACTIVE` once started |
| Responsibility and workstream | Project-Wide. The owner's single point of contact (REQ-073). Accountable for sequencing, task assignment, number allocation, the "go to merge" instruction, shared-doc conflict rules and all owner communication. Consults ARC-01 before high-risk changes |
| Status | QUEUED. The owner starts it with the copy-ready prompt [MOD-01_TO_MOD-02_SUCCESSOR_PROMPT_2026-10-28.md](../handover/continuations/MOD-01_TO_MOD-02_SUCCESSOR_PROMPT_2026-10-28.md) |
| Assigned tasks | Step 0 of the handover plan (validate anchors, preserve NB-01's work, launch EX-01 and ARC-01, owner decision pack). TC-02..TC-11, TC-13..TC-23. TA-08, TA-09, TA-24, TA-25 decisions |
| Working directory and branch | Inherits `.claude/worktrees/handover` and `handover/mod-01-to-mod-02-20261028` for project-control edits. Read-only everywhere else |
| Reserved files and shared components | `docs/project-control/*`, `docs/handover/*`. Coordinates every shared hotspot |
| Numbering | D-046..D-049 and KI-187..KI-189; allocates CR-0010 onward and every new range |
| Dependencies | This handover package; the owner's answers |
| Last known commit and deliverable | None yet |
| Pending owner decisions | All open PD items (decision log) |
| Current blocker | Not started |
| Current handover document | [MASTER_HANDOVER_2026-10-28_v1.md](../handover/MASTER_HANDOVER_2026-10-28_v1.md) and the standing instructions [MODERATOR_BOOTSTRAP_PROMPT.md](../handover/MODERATOR_BOOTSTRAP_PROMPT.md); the private supplement |
| Predecessor | MOD-01 |

### EX-01 (QUEUED)

| Field | Value |
|---|---|
| Unique id and name | EX-01. Recommended title: `EX-01 \| Workstream A (existing dashboard) \| Existing-dashboard implementation \| ACTIVE` once started |
| Responsibility and workstream | First dedicated Workstream A implementation chat. Builds in its own worktree and branch, opens the PR, and performs the D-020 merge only after MOD-02's go, green CI and ARC-01's Gate B GO; then verifies Pages |
| Status | QUEUED. MOD-02 launches it (TC-03) |
| Assigned tasks | **TA-03, taken over from MOD-01** (finish T5, verify, PR, merge). Then TA-05, TA-06, TA-22 and later TA tasks as MOD-02 assigns (TA-10 with the refresh-operator agent) |
| Working directory and branch | `.claude/worktrees/wf_c9c8da96-497-10`, branch `continuation/ex-01-task-ta-03-20261027` at 0f1c5d3, parent 97a7d69 [VERIFIED: `git rev-parse 0f1c5d3^1`, 28 Oct] |
| Reserved files and shared components | `index.html` (only through `tools/patches/`), `tools/patches/*`, `tools/regression/*`, `tools/*.js`, `tools/browser-checks/*`, `docs/legacy/*`, CR-0008. Regenerates `data/refdata` in the same change whenever REFDATA changes (D-035) |
| Numbering | D-042..D-045 (D-042 = "no fallback", amending D-041 point 4) and KI-183..KI-186 (KI-183 = labels equal to Object.prototype keys; KI-184 = base-file ISIN column not read) |
| Ports | 8133..8135 for browser QA (see the port register) |
| Dependencies | MOD-02's launch; owner answers PD-02, PD-03 before the TA-03 merge (or the owner accepts the safe defaults now built); PD-09 before TA-05 |
| Last known commit and deliverable | Inherits 0f1c5d3 |
| Pending owner decisions | PD-01..PD-07 (tax), PD-08, PD-09, PD-10, PD-42 (fix batch 4 choices), PD-43 (tax adviser for OD-28), PD-44 (tax defaults settled while building; blocks the TA-03 sign-off) |
| Current blocker | Not started |
| Current handover document | [EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md](../handover/EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md), [EX-01_TASK-TA-03_SUCCESSOR_PROMPT_2026-10-28.md](../handover/continuations/EX-01_TASK-TA-03_SUCCESSOR_PROMPT_2026-10-28.md) and the TA-03 card in [TASK_REGISTER.md](TASK_REGISTER.md#ta-03-tax-batch-cr-0008-d-040) |
| Predecessor | MOD-01 (for TA-03) |

### ARC-01 (QUEUED)

| Field | Value |
|---|---|
| Unique id and name | ARC-01. Recommended title: `ARC-01 \| Project-Wide \| Codebase Integrity & Integration Guardian \| ACTIVE` once started |
| Responsibility and workstream | Project-Wide independent technical control (REQ-074). Gate B review of every material diff: cross-module effects, ownership conflicts, interface compatibility, test coverage, residual risk. Reviews material change-impact contracts before implementation. May **BLOCK** (NO-GO); escalation goes to MOD-02, then to the owner. Does not implement features or make product decisions |
| Status | QUEUED. MOD-02 launches it (TC-04) |
| Assigned tasks | TC-04 (baseline: interface table, merge-tree result, ownership map). Gate B for every change. TA-23 with EX-01, TB-24 with NB-01, TC-17 (agent definitions) if MOD-02 assigns |
| Working directory and branch | None of its own. Read-only use of the repository through `git -C <worktree>` and `git show <ref>:<path>`; detached scratch worktrees `.claude/worktrees/arc-01-<task>-<short-sha>` for review only, removed without `--force`, MOD-02 told on create and remove (lead ruling R-7 in [DECISION_LOG.md](DECISION_LOG.md) section 1.3). A docs branch only if MOD-02 assigns a docs task |
| Reserved files and shared components | None. Co-maintains the interface contracts and file-ownership register with MOD-02 |
| Dependencies | This handover package |
| Last known commit and deliverable | None yet |
| Pending owner decisions | None of its own |
| Current blocker | Not started |
| Current handover document | [CODEBASE_GUARDIAN_HANDOVER_2026-10-28_v1.md](../handover/CODEBASE_GUARDIAN_HANDOVER_2026-10-28_v1.md) and [ARC-01_BOOTSTRAP_PROMPT_2026-10-28.md](../handover/continuations/ARC-01_BOOTSTRAP_PROMPT_2026-10-28.md) |

## Change log of this register

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version, for the MOD-01 to MOD-02 handover |
| 30 Oct 2026 | MOD-01 (fixer pass) | Validation findings applied: MOD-01 retirement condition as lead ruling R-1; NB-01 report time; EX-01 pending decisions include PD-42 to PD-44; ARC-01 scratch worktrees (R-7); links to the handover files; EX-01 chat line; the previous-owner open items worded without naming client data |
