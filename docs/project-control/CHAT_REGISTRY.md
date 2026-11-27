# Chat registry

Last verified: **27 Nov 2026 (IST)**, for MOD-05 (registers-5; see "Chat numbers and status, 27 Nov 2026" below). The
detail sections further down are the record of 2 Nov 2026 (MOD-02's validation of the MOD-01 to MOD-02 handover) and are
kept as history.
Maintained by: **MOD-05** (CHAT-015) since 26 Nov 2026; MOD-04 (CHAT-013) from 25 to 26 Nov; MOD-03 (CHAT-006) from 17 to
25 Nov; MOD-02 before.

This register lists every Claude chat that works on the project, what each one owns and where its work is.
It is one of the project-control registers; [README.md](README.md) maps all of them.
The narrative project state stays in [docs/PROJECT_STATE.md](../PROJECT_STATE.md).
Decisions stay in [docs/DECISIONS.md](../DECISIONS.md) and defects in [docs/KNOWN_ISSUES.md](../KNOWN_ISSUES.md).
Tasks (TA-, TB-, TC-) are defined in [TASK_REGISTER.md](TASK_REGISTER.md).

**Evidence labels.** [VERIFIED] means checked with a command or a file, and the evidence is given.
[INFERRED] means reasoned from verified facts. [UNCERTAIN] and [UNKNOWN] mean what they say.

**Private details.** Session ids, transcript file names and local scratch locations are kept out of this public file.
They are in a private supplement kept on the owner's computer, outside the repository.

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
| `MOD-01 \| Project-Wide \| Coordinating Moderator; Workstream A lead until handover \| RETIRED` | "Portfolio Review Dashboard architecture" | 14 Oct 2026 | **4** [VERIFIED: transcript metadata scan, 28 Oct] |
| `NB-01 \| Workstream B (new build, CR-0006) \| New-build implementation \| WAITING` | "Build the new Portfolio Review dashboard" | 22 Oct 2026, 21:47 IST | **1** [VERIFIED: transcript metadata scan, 28 Oct; rescanned 9 Nov: one entry, 27 Oct 09:57 UTC] |
| `MOD-02 \| Project-Wide \| Master Project Moderator \| ACTIVE` | owner asked to rename the chat to the chat line itself (2 Nov) | 2 Nov 2026 (successor prompt dated 28 Oct) | 1 [VERIFIED: transcript metadata scan, 9 Nov: one entry, 9 Nov 08:37 UTC] |
| `EX-01 \| Workstream A (existing dashboard) \| Existing-dashboard implementation \| HANDOVER REQUIRED` | "EX-01 \| Workstream A (existing dashboard) \| Existing-dashboard implementation \| ACTIVE" | 2 Nov 2026, 08:00 UTC [VERIFIED: session metadata] | **5** [VERIFIED: transcript metadata scan, 9 Nov: 2 Nov 09:28, 12:25, 14:58 and 17:08 UTC; 9 Nov 08:36 UTC] |
| `ARC-01 \| Project-Wide \| Codebase Integrity & Integration Guardian \| HANDOVER REQUIRED` | "ARC-01 \| Project-Wide \| Codebase Integrity & Integration Guardian \| ACTIVE" (confirmed baseline part 1 on 2 Nov) | 2 Nov 2026, 07:58 UTC [VERIFIED: session metadata] | **3** [VERIFIED: transcript metadata scan, 9 Nov: 2 Nov 10:12 and 12:39 UTC; 9 Nov 08:38 UTC] |
| `CHAT-008 \| ARC-02 \| Project-Wide \| Codebase Integrity & Integration Guardian \| ACTIVE` | the chat line itself | 18 Nov 2026 | 2 [VERIFIED: transcript marker scan, 27 Nov: 25 Nov 18:50 and 27 Nov 07:56 UTC] |
| `CHAT-007 \| EX-02 \| Workstream A (existing dashboard) \| Existing-dashboard implementation \| RETIRED` | the chat line itself (with ACTIVE) | 18 Nov 2026 | **3** [VERIFIED: transcript marker scan, 26 Nov: 19 Nov 11:50, 24 Nov 19:50, 25 Nov 09:07 UTC]; succeeded by CHAT-014 on 26 Nov |

When a chat is created, the owner gives it the title above with its live status, and the Moderator updates this table.
The chats opened since 17 Nov 2026 are listed with their numbers in the next section.

## Chat numbers and status, 27 Nov 2026

Since the handover of 17 Nov 2026 every chat has a number (CHAT-nnn), never reused. Compactions are counted from the
environment's compaction markers (CONTEXT_COMPACTION_TRACKER in `docs/coordination/`); successions are in
CHAT_SUCCESSION_REGISTER there. **Next free number: CHAT-016.**

| Number | Role | Status (27 Nov 2026) | Opened | Note |
|---|---|---|---|---|
| CHAT-001 | MOD-01, first Moderator | RETIRED | 14 Oct 2026 | 4 compactions |
| CHAT-002 | NB-01, new build | SUPERSEDED by CHAT-009 (account change, old chat unreachable) | 22 Oct 2026 | |
| CHAT-003 | MOD-02, Moderator | SUPERSEDED by CHAT-006 (account change and handover, 17 Nov) | 2 Nov 2026 | |
| CHAT-004 | ARC-01, Guardian | SUPERSEDED by CHAT-008 (three compactions) | 2 Nov 2026 | |
| CHAT-005 | EX-01, live page | SUPERSEDED by CHAT-007 (five compactions) | 2 Nov 2026 | |
| CHAT-006 | MOD-03, Moderator | historical record since 25 Nov 2026; forwards notes only | 17 Nov 2026 | handed over to CHAT-013 on 25 Nov 2026, a planned early succession under PD-65 §9.3 |
| CHAT-007 | EX-02, live page (`index.html` patches, refresh, side-by-side test kit) | retired 26 Nov 2026 after its final handover | 18 Nov 2026 | 3 compactions; succeeded by CHAT-014 |
| CHAT-014 | EX-03, live page (side-by-side test kit, KI-032, KI-301, LP-16b, the December refresh) | ACTIVE | 26 Nov 2026 | successor of CHAT-007 (three-compaction rule) |
| CHAT-008 | ARC-02, Guardian (live page, M2, rule 10) | ACTIVE | 18 Nov 2026 | ARC-01's **sole rule-10 successor**; third compaction 27 Nov 2026: succession due (PD-65), the Moderator's decision |
| CHAT-009 | NB-02, new build (identifiers, ingest, classification, then M3b) | ACTIVE | 22 Nov 2026 | third compaction 27 Nov 2026: succession due (PD-65), the Moderator's decision |
| CHAT-010 | NB-03, new build: financial engines (M3a, M7a) | ACTIVE | 24 Nov 2026 (late evening IST) | |
| CHAT-011 | NB-04, new build: data platform (M10, M11a, M12a) | ACTIVE | 24 Nov 2026 (late evening IST) | |
| CHAT-012 | ARC-03, new-build reviewer | ACTIVE | 24 Nov 2026 (late evening IST) | not the rule-10 Guardian |
| CHAT-013 | MOD-04, Moderator | historical record since 26 Nov 2026; forwards notes only | 25 Nov 2026 (about 01:00 IST) | took over from CHAT-006 on 25 Nov 2026 about 01:20 IST; handed over to CHAT-015 on 26 Nov 2026 on the owner's order |
| CHAT-015 | MOD-05, Master Project Moderator | ACTIVE, the only active Moderator | 26 Nov 2026 (about 19:35 IST, as a standby) | took over from CHAT-013 on 26 Nov 2026 about 20:40 IST, on the owner's order (the next Moderator runs on the Fable model) |

**Not chats.** Subagent workflow runs (the `.claude/worktrees/wf_*` worktrees and `worktree-wf_*` branches) belong to the chat
that started them. They are listed under that chat below.

## External party (not a chat)

| Party | Role | Contact route | Standing rule | Open items |
|---|---|---|---|---|
| The previous owner | Built the existing dashboard (May to Oct 2026) and supplied two exports (15 Oct, 23 Oct) | Only through the owner. No chat talks to the previous owner directly | Never mention deleting or retiring the existing dashboard in anything addressed to the previous owner (owner, 15 Oct; REQ-020, REQ-021) | TC-20 (held files, missing files, a note about one exported file, an unmatched fund label): owner decisions PD-22..PD-25 |

## Handover validation record

Validated by MOD-02 on **2 Nov 2026**, with the read-only block "Verify before you trust" in
[REPOSITORY_AND_ENVIRONMENT_STATE.md](REPOSITORY_AND_ENVIRONMENT_STATE.md) [VERIFIED: commands run that day].

- **Matched:** node v24.21.0; the continuation branch `0f1c5d3` on origin with parent `97a7d69`; `feat/m1-4-overview` 07a6460 and the fixers
  4610684, be7f395, 202f8f6; no remote branch contains 07a6460 (still local only); 23 worktrees at that time (24 later, with `mod-02-docs`), all clean; no stashes; `core.hooksPath`
  set; no open PR at that time (PR #18 is MOD-02's own, opened later); live page MD5 `12b5e572...` equal to `main`'s `index.html`; `/next/` 46,905 bytes.
- **Differences (expected):** `main` is `4a1a747` (PR #17, the handover package, docs only, merged 30 Oct), not `6443826`;
  `origin/main...feat/m1-4-overview` is 2 / 23; the handover branch now has its own upstream, so the upstream hazard lists
  `feat/m1-4-overview`, `fix/legacy-batch-3-tax`, `fix/legacy-batch-4-basefile` and `main`; Dashboard checks on `4a1a747` succeeded
  (run 41022932782). No Pages run for a docs-only merge.
- **Later on 2 Nov:** EX-01 (created 08:00 UTC) confirmed 0f1c5d3, a clean worktree and the T5 scope in its start report. MOD-02 checked
  the claims against git: HEAD 0f1c5d3, parent 97a7d69, local equal to origin, clean, `index.html` MD5 5f1c2fc5, `main` 4a1a747 with
  2 / 5, and the CI run 41412086208 (dispatched by EX-01 on the WIP head) succeeded in both jobs [VERIFIED]. EX-01 is ACTIVE and TA-03
  ownership passed to it. ARC-01 (created 07:58 UTC) confirmed part 1 of its baseline (anchors matched, differences explained) and is ACTIVE; part 2 (the I-01 to I-27 table and the ownership map) is still being produced by its verifiers.
  NB-01: MOD-02's resume message was delivered before 08:02 UTC and NB-01's turn started, then ended after three tool calls with no
  report; the session was archived afterwards. MOD-02 did not archive it and both auto-archive settings are off, so the archive came
  from the owner or the sidebar; NB-01 cannot be messaged until it is unarchived [VERIFIED: list_sessions, list_events, get_settings].
- **Not yet done:** the full read of the registers against git (SHA by SHA); the deny-list is unset in this shell (it is exported
  per command).
- **MOD-01** is RETIRED: its outstanding work, file ownership and handover are in this package; its context is treated as unreliable.
  TA-03 ownership sits with MOD-02 until EX-01 confirms it.

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
| Status | **ACTIVE** since 2 Nov 2026: the owner unarchived its session after it had been found archived; its first report was received and checked; "continue" given for the local integration (no push of the integrated head and no PR without MOD-02's go). It stopped its round-2 fix workflow on 27 Oct and wrote a state report at 20:59 to 21:01 IST (received by MOD-01 about 21:05 IST) [VERIFIED: NB-01 state report; transcript timestamps]. Last assistant turn 27 Oct 21:35 UTC (28 Oct 03:05 IST); a system stop-hook entry follows at 28 Oct 00:58 UTC; nothing later [VERIFIED: timestamp-only transcript scan]. A cross-session message MOD-01 sent on 28 Oct has no reply [UNKNOWN: whether NB-01 has seen it]. NB-01 **continues as NB-01 under MOD-02**; it is replaced only if MOD-02 judges its context unreliable |
| Assigned tasks | TB-06 (M1.4), TB-07 (round-2 fixes G1, G2, G3), KI-148 inside TB-06/TB-07, TB-08 (preserve its local-only work, on MOD-02's instruction), TB-09..TB-23 (milestones M2..M16), TB-24..TB-28, TB-27 jointly with EX-01 |
| Working directories and branches | `.claude/worktrees/m14`: `feat/m1-4-overview` at 07a6460 (pushed to origin on 2 Nov, TB-08; the local tip moves as NB-01 integrates) [VERIFIED: `git rev-list --count`, `git ls-remote`, 28 Oct]. `.claude/worktrees/wf_bdc6c774-599-1`, `-2`, `-3`: `worktree-wf_bdc6c774-599-1/-2/-3` at 4610684 (G1), be7f395 (G2), 202f8f6 (G3), **local only**, one unique commit each, clean [VERIFIED]. Stale (history only in the local feat/m1-4-overview): `wf_ca03729e-33b-2..6`, `wf_c3548c88-811-1..4`. Stale (merged): `cg-spec` (PR #15), `tabs` (PR #14) |
| Reserved files and shared components | `app/**`, `scripts/build.mjs`, `scripts/serve.mjs`, `scripts/data-extract.ts` (the extractor), `scripts/vendor-extract.mjs`, `scripts/lib/`, `scripts/office/` (branch), `tests/next`, `tests/unit`, `tests/parity` code, `docs/new-build/*`, `docs/ARCHITECTURE.md`, `docs/DATA_DICTIONARY.md`, `docs/PRD.md`, CR-0006. Shared hotspots it edits under MOD-02's rules: see [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md) |
| Dependencies | If TA-03 merges first, NB-01 merges main into feat/m1-4-overview and resolves the four conflict hunks. TA-05 needs NB-01's final KI-147 ledger ids (AG-13, AG-14 on G1). Owner answers PD-08, PD-09, PD-11..PD-16, PD-27 |
| Last known commit and deliverable | Branch head 07a6460 (27 Oct 19:22 IST, merge of PR #16 into feat/m1-4-overview); newest NB-01 commit be7f395 (27 Oct 20:57 IST) [VERIFIED: `git log`]. Last merged deliverables: PR #15 (fb7f59c, capital-gains design) and PR #14 (c9ec1cc, tabs across the top) |
| Pending owner decisions | PD-08 (merged-folio holding days), PD-09 (KI-147 placeholders), PD-11 (BF-19), PD-12 (BF-26), PD-13 (L7 letter case), PD-14 (market value 0), PD-15 (blank Product Name), PD-16 (capital-gains design section 15), PD-27 (blueprint approvals) |
| Current blocker | None. Integrating G1..G3 locally under "continue"; then waits for MOD-02's push go on the integrated head and Gates A to E. The Office scripts must follow the owner's rule before any Office check (ARC-01 K1) |
| Relays waiting for NB-01 | None open on 2 Nov. Done: the resume message (re-sent after the unarchive), the TA-03 refdata change (NB-01 checked: no M1.4 test pins TAX_RULES), I-04 and the IRR rule (M3 acceptance), the owner answers PD-02 and PD-03 (M7 requirements), the KI-147 ids AG-13 and AG-14 (passed to EX-01). To relay when they happen: the take-main instruction after TA-03 merges; the answers to PD-09, PD-47 and PD-48; ARC-01's Gate B questions (Review 2, N16 to N19) |
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

### EX-01 (HANDOVER REQUIRED)

| Field | Value |
|---|---|
| Unique id and name | EX-01, `EX-01 \| Workstream A (existing dashboard) \| Existing-dashboard implementation \| ACTIVE`, created 2 Nov 2026 08:00 UTC |
| Responsibility and workstream | First dedicated Workstream A implementation chat. Builds in its own worktree and branch, opens the PR, and performs the D-020 merge only after MOD-02's go, green CI and ARC-01's Gate B GO; then verifies Pages |
| Status | **HANDOVER REQUIRED** since 9 Nov 2026 (5 compactions: 2 Nov 09:28, 12:25, 14:58 and 17:08 UTC, 9 Nov 08:36 UTC [VERIFIED: transcript metadata scan]; MOD-02's instruction at about 15:10 IST); successor EX-02 (QUEUED). Before that **ACTIVE** since 2 Nov 2026: its start report confirmed the worktree, 0f1c5d3 and the T5 scope; MOD-02 checked them against git (TC-03 done) |
| Assigned tasks | **TA-03, taken over from MOD-01** (finish T5, verify, PR, merge). Then TA-05, TA-06, TA-22 and later TA tasks as MOD-02 assigns (TA-10 with the refresh-operator agent) |
| Working directory and branch | `.claude/worktrees/wf_c9c8da96-497-10`, branch `continuation/ex-01-task-ta-03-20261027` at 0f1c5d3 (on origin; frozen as the handover checkpoint), parent 97a7d69 [VERIFIED: `git rev-parse 0f1c5d3^1`, 28 Oct]. Since 2 Nov the worktree has `fix/legacy-batch-3-tax-cr-0008` checked out at 0f1c5d3, local, no upstream yet (R-8) [VERIFIED: `git worktree list`] |
| Reserved files and shared components | `index.html` (only through `tools/patches/`), `tools/patches/*`, `tools/regression/*`, `tools/*.js`, `tools/browser-checks/*`, `docs/legacy/*`, CR-0008. Regenerates `data/refdata` in the same change whenever REFDATA changes (D-035) |
| Numbering | D-042..D-045 (D-042 = "no fallback", amending D-041 point 4; D-043 = the owner's answers to CR-0008 Q17 and Q18, 2 Nov 2026) and KI-183..KI-186 (KI-183 = labels equal to Object.prototype keys; KI-184 = base-file ISIN column not read; KI-185 = ENGINE_KEYS gap, to be FIXED in TA-03 (not in git yet); KI-186 = IRR explicit-zone date strings, P3, to be filed) |
| Ports | 8133..8135 for browser QA (see the port register) |
| Dependencies | MOD-02's launch (done); PD-02 and PD-03 were answered by the owner on 2 Nov 2026; PD-09 before TA-05 |
| Last known commit and deliverable | Inherits 0f1c5d3 |
| Pending owner decisions | PD-01 and PD-04..PD-07 (tax; PD-02 and PD-03 answered 2 Nov), PD-08, PD-09, PD-10, PD-42 (fix batch 4 choices), PD-43 (tax adviser for OD-28), PD-44 (tax defaults settled while building; blocks the TA-03 sign-off) |
| Current blocker | Sends its T5 review addendum to ARC-01 and MOD-02, then waits for MOD-02's "continue" before it touches the T5 patch or any tools file (ARC-01 accepted contract v2). Read-only review, docs-only edits and CI runs are allowed meanwhile |
| Current handover document | [EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md](../handover/EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md), [EX-01_TASK-TA-03_SUCCESSOR_PROMPT_2026-10-28.md](../handover/continuations/EX-01_TASK-TA-03_SUCCESSOR_PROMPT_2026-10-28.md) and the TA-03 card in [TASK_REGISTER.md](TASK_REGISTER.md#ta-03-tax-batch-cr-0008-d-040) |
| Predecessor | MOD-01 (for TA-03) |

### ARC-01 (HANDOVER REQUIRED)

| Field | Value |
|---|---|
| Unique id and name | ARC-01, `ARC-01 \| Project-Wide \| Codebase Integrity & Integration Guardian \| ACTIVE`, created 2 Nov 2026 07:58 UTC |
| Responsibility and workstream | Project-Wide independent technical control (REQ-074). Gate B review of every material diff: cross-module effects, ownership conflicts, interface compatibility, test coverage, residual risk. Reviews material change-impact contracts before implementation. May **BLOCK** (NO-GO); escalation goes to MOD-02, then to the owner. Does not implement features or make product decisions |
| Status | **HANDOVER REQUIRED** since 9 Nov 2026 (3 compactions: 2 Nov 10:12 and 12:39 UTC, 9 Nov 08:38 UTC [VERIFIED: transcript metadata scan]); successor ARC-02 (QUEUED); its handover document `docs/handover/CODEBASE_GUARDIAN_HANDOVER_2026-11-09_v2.md` and the ARC-02 prompt are not in git yet (next docs PR); ARC-01 stays available for gate requests until ARC-02 has validated. Before that **ACTIVE** since 2 Nov 2026 on baseline part 1 (main checkout clean; 0f1c5d3 and its parent; the NB-01 heads and none on a remote; page MD5s; live page and `/next/`; CI on 4a1a747). Part 2 (interface table, ownership map) is pending (TC-04 stays IN PROGRESS until it arrives) |
| Assigned tasks | TC-04 (baseline: interface table, merge-tree result, ownership map). Gate B for every change. TA-23 with EX-01, TB-24 with NB-01, TC-17 (agent definitions) if MOD-02 assigns |
| Working directory and branch | None of its own. Read-only use of the repository through `git -C <worktree>` and `git show <ref>:<path>`; detached scratch worktrees `.claude/worktrees/arc-01-<task>-<short-sha>` for review only, removed without `--force`, MOD-02 told on create and remove (lead ruling R-7 in [DECISION_LOG.md](DECISION_LOG.md) section 1.3). A docs branch only if MOD-02 assigns a docs task |
| Reserved files and shared components | None. Co-maintains the interface contracts and file-ownership register with MOD-02 |
| Dependencies | This handover package |
| Last known commit and deliverable | 2 Nov 2026: baseline part 1; TA-03 change-impact contract ACCEPT with changes C1 to C5; R-10 CONFIRMED with additions; PR #18 Gate B quick review GO for head 227f65a (valid for that head only) |
| Pending owner decisions | None of its own |
| Current blocker | None. Waits for EX-01's Gate A report and sends baseline part 2 when its eight read-only verifiers finish |
| Current handover document | [CODEBASE_GUARDIAN_HANDOVER_2026-10-28_v1.md](../handover/CODEBASE_GUARDIAN_HANDOVER_2026-10-28_v1.md) and [ARC-01_BOOTSTRAP_PROMPT_2026-10-28.md](../handover/continuations/ARC-01_BOOTSTRAP_PROMPT_2026-10-28.md) |

## Change log of this register

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version, for the MOD-01 to MOD-02 handover |
| 30 Oct 2026 | MOD-01 (fixer pass) | Validation findings applied: MOD-01 retirement condition as lead ruling R-1; NB-01 report time; EX-01 pending decisions include PD-42 to PD-44; ARC-01 scratch worktrees (R-7); links to the handover files; EX-01 chat line; the previous-owner open items worded without naming client data |
| 2 Nov 2026 | MOD-02 | Handover validated; MOD-01 RETIRED; MOD-02 and EX-01 ACTIVE; ARC-01 ACTIVE on baseline part 1; NB-01 found archived; validation record added |
| 2 Nov 2026 | MOD-02 | PD-02 and PD-03 answered by the owner (recorded in DECISION_LOG); EX-01 dependencies and blocker updated; NB-01 relay list extended |
| 2 Nov 2026 | MOD-02 | NB-01 ACTIVE (TB-08 done, contract accepted, "continue" given); relay list updated |
| 9 Nov 2026 | MOD-02 | Compactions scanned from the transcript metadata (MOD-02 1, ARC-01 3, EX-01 5, NB-01 1); ARC-01 and EX-01 HANDOVER REQUIRED; ARC-02 and EX-02 QUEUED |
| 26 Nov 2026 | MOD-04 | registers-4: chat numbers CHAT-001 to CHAT-013 and their status; CHAT-006 (MOD-03) handed over to CHAT-013 (MOD-04) on 25 Nov 2026 (PD-65 §9.3); ARC-02 (CHAT-008) and EX-02 (CHAT-007) ACTIVE since 18 Nov, ARC-02 as ARC-01's sole rule-10 successor; CHAT-010 NB-03, CHAT-011 NB-04, CHAT-012 ARC-03 opened 24 and 25 Nov; compactions from the marker scan (CHAT-007 at 3); next free number CHAT-014 |
| 27 Nov 2026 | MOD-05 (drafted by EX-03) | registers-5: CHAT-013 (MOD-04) handed over to CHAT-015 (MOD-05) on 26 Nov 2026 on the owner's order; CHAT-013 a historical record; CHAT-007 RETIRED; compactions recounted from the markers on 27 Nov (CHAT-008 and CHAT-009 at 2); next free number CHAT-016 |
| 27 Nov 2026 | MOD-05 (drafted by EX-03) | registers-6: compactions recounted from the markers about 19:00 IST: CHAT-008 3 and CHAT-009 3 (succession due under PD-65, the Moderator's decision), CHAT-010 2, CHAT-011 2, CHAT-012 1, CHAT-013 0, CHAT-014 1, CHAT-015 0 |
