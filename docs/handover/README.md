# Handover index

**Written:** 28 Oct 2026 (IST) by MOD-01 for the handover to MOD-02, on branch `handover/mod-01-to-mod-02-20261028`
(base `main` at `6443826`). **Kept by:** MOD-02. Every later handover adds its files here and updates this index.

This folder holds the dated handover documents, the copy-ready prompts for new chats and the templates for future
handovers. The facts they rest on are kept in the registers in [`docs/project-control/`](../project-control/README.md).
Anything that must not be public is in the private supplement on the owner's laptop,
`C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md`, and nowhere in this repository.

> **Old snapshots are not proof of the current state.** Every handover document, this set included, describes the
> repository as it was on its date. Git is the authority. Before acting on a SHA, an MD5, a branch or a status, run
> the read-only checks in
> [REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md#verify-before-you-trust)
> and compare. A document never proves that code works, that a test passed or that a branch was pushed.

## 1. Which handover is current

| Question | Answer on 28 Oct 2026 |
|---|---|
| Current master handover | [MASTER_HANDOVER_2026-10-28_v1.md](MASTER_HANDOVER_2026-10-28_v1.md) (version 1) |
| Handover it records | MOD-01 (HANDOVER REQUIRED) to MOD-02 (QUEUED); task TA-03 from MOD-01 to EX-01 (QUEUED) |
| Superseded entry point | [`docs/HANDOVER.md`](../HANDOVER.md), the snapshot of 23 Oct 2026 (section 3 below) |
| Facts it rests on | the registers in [`docs/project-control/`](../project-control/README.md), written the same day |
| Where the anchors were last checked | 28 Oct 2026, 13:07 IST: `main` `6443826`; live page MD5 `12B5E5727FCA01EF2EA162C59913F01D` (16,837,249 bytes); `/next/` 46,905 bytes; TA-03 continuation branch `0f1c5d3` (pushed); NB-01's `feat/m1-4-overview` `07a6460` (local only) [VERIFIED: `git rev-parse`, `git ls-remote origin`, `curl`] |

When two records disagree, git wins over every document. Then the authoritative record wins for its subject (section
2). Record the disagreement as a defect and fix it in the next docs change.

## 2. Authoritative files

### 2.1 Handover documents in this folder

| File | What it is | Give it to |
|---|---|---|
| [MASTER_HANDOVER_2026-10-28_v1.md](MASTER_HANDOVER_2026-10-28_v1.md) | The whole project in one document: history, repositories, architecture in brief, both workstreams, decisions, blockers, risks and the ordered execution plan with acceptance criteria | MOD-02 first; any chat that needs the big picture |
| [MODERATOR_BOOTSTRAP_PROMPT.md](MODERATOR_BOOTSTRAP_PROMPT.md) | The Moderator's standing instructions, complete and copy-ready. A planned handover pastes the dated successor prompt, which points to it; the owner pastes this block alone only if a Moderator chat is lost without a handover | every Moderator |
| [EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md](EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md) | Workstream A on its own: the live page, its baseline, the fix batches, TA-03, TA-05, the October refresh | EX-01 |
| [NEW_BUILD_HANDOVER_2026-10-28_v1.md](NEW_BUILD_HANDOVER_2026-10-28_v1.md) | Workstream B on its own: CR-0006, milestones, M1.4 and its local-only branches, the roadmap | NB-01 (or its successor) |
| [CODEBASE_GUARDIAN_HANDOVER_2026-10-28_v1.md](CODEBASE_GUARDIAN_HANDOVER_2026-10-28_v1.md) | For ARC-01: the dependency map, shared interfaces, active ownership, integration state and outstanding risks | ARC-01 |
| [MODERATOR_HANDOVER_TEMPLATE.md](MODERATOR_HANDOVER_TEMPLATE.md) | The template a Moderator fills when it must be replaced (scenario B) | any future Moderator |
| [SUBCHAT_HANDOVER_TEMPLATE.md](SUBCHAT_HANDOVER_TEMPLATE.md) | The template an implementation or guardian chat fills when it must be replaced (scenario A) | EX-, NB-, ARC- chats |
| [continuations/README.md](continuations/README.md) | The continuation procedure (triggers, branches, safe checkpoints, push, successor prompt, registry) and the index of every successor prompt | every chat |

The copy-ready successor prompts for this handover, and the owner's handover message, are listed in
[continuations/README.md](continuations/README.md#9-index-of-continuation-prompts).

### 2.2 Records outside this folder that stay authoritative

| Subject | Authoritative record |
|---|---|
| How the project is run: roles, who decides, gates A to E, the update rule | [project-control/README.md](../project-control/README.md) |
| Chats, tasks, active changes, ownership, interfaces, integration | the registers mapped in [project-control/README.md](../project-control/README.md#4-map-of-the-registers) |
| Narrative project state | [docs/PROJECT_STATE.md](../PROJECT_STATE.md) (several lines lag git on 28 Oct: TC-15) |
| Decisions | [docs/DECISIONS.md](../DECISIONS.md) |
| Known issues | [docs/KNOWN_ISSUES.md](../KNOWN_ISSUES.md) |
| Rules for every change | [CLAUDE.md](../../CLAUDE.md) |
| Checks and how to run them | [docs/TESTING.md](../TESTING.md) |
| Stage A replication record | [docs/REPLICATION_REPORT.md](../REPLICATION_REPORT.md) |
| Monthly refresh | [docs/MONTHLY_REFRESH.md](../MONTHLY_REFRESH.md) |
| Anything private | the private supplement named above |

## 3. Historical files

Keep these for history. Do not use them as the current state.

| File | Date | What it is | Why it is historical |
|---|---|---|---|
| [docs/HANDOVER.md](../HANDOVER.md) | 23 Oct 2026 | The previous "start here" document, written at milestone M1.3 | Superseded by this folder on 28 Oct. It says `main` is `2a65a62`, and the M1.x and fix-batch state of 23 Oct [VERIFIED: its section 8]. It carries a banner saying so. It is still the file `monthly-prd-check.mjs` reads for its "Last refreshed" line, so it is refreshed again at the first monthly cycle (TA-21) |
| [docs/previous-owner/handover/HANDOVER_PRD_Centricity_Portfolio_Review.md](../previous-owner/handover/HANDOVER_PRD_Centricity_Portfolio_Review.md) | 14 Oct 2026 | The previous owner's handover and product specification | Describes the dashboard as handed over (build `cab22e6`). Known errata: [REPLICATION_REPORT.md](../REPLICATION_REPORT.md) section 5 |
| [docs/previous-owner/handover/PROJECT_HISTORY_Portfolio_Review_Dashboard.md](../previous-owner/handover/PROJECT_HISTORY_Portfolio_Review_Dashboard.md) | 14 Oct 2026 | How the dashboard evolved, May to Oct 2026 | Background only; this repository's documents win where they differ ([previous-owner/README.md](../previous-owner/README.md)) |
| `docs/previous-owner/knowledge/` | 14 Oct 2026 | The previous owner's knowledge notes and decision log (public copies; see [previous-owner/README.md](../previous-owner/README.md)) | Background only |
| `docs/new-build/inputs/` | 21 Oct 2026 | Phase 0 inputs for the new build (for example [previous-owner-and-requirements.md](../new-build/inputs/previous-owner-and-requirements.md)) | Snapshots taken when `main` was at `782794f`; statuses have moved since |

## 4. What to give the next chat

The owner creates each new chat in the Claude interface: a chat cannot create another chat. For each, the owner pastes
the prompt named below. Each prompt names its own reading list; the table shows the core of it. Never paste a
credential or client data into a chat; the prompts point to the private supplement instead.

| New chat | Paste | It reads first | Then |
|---|---|---|---|
| **MOD-02**, "MOD-02 \| Project-Wide \| Master Project Moderator \| ACTIVE" (the owner creates it first) | [continuations/MOD-01_TO_MOD-02_SUCCESSOR_PROMPT_2026-10-28.md](continuations/MOD-01_TO_MOD-02_SUCCESSOR_PROMPT_2026-10-28.md), which makes [MODERATOR_BOOTSTRAP_PROMPT.md](MODERATOR_BOOTSTRAP_PROMPT.md) its standing instructions | this index; [MASTER_HANDOVER_2026-10-28_v1.md](MASTER_HANDOVER_2026-10-28_v1.md); [project-control/README.md](../project-control/README.md); the verify block in [REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md#verify-before-you-trust); [CHAT_REGISTRY.md](../project-control/CHAT_REGISTRY.md); the private supplement; `C:\dev\private\coordination-notes.md` | Step 0 of the master handover's plan |
| **EX-01**, "EX-01 \| Workstream A (existing dashboard) \| Existing-dashboard implementation \| ACTIVE" (MOD-02 asks the owner to create it) | [continuations/EX-01_TASK-TA-03_SUCCESSOR_PROMPT_2026-10-28.md](continuations/EX-01_TASK-TA-03_SUCCESSOR_PROMPT_2026-10-28.md) | [EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md](EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md); the [TA-03 card](../project-control/TASK_REGISTER.md#ta-03-tax-batch-cr-0008-d-040); CR-0008 and the T5 patch header on its branch | Step A1 |
| **ARC-01**, "ARC-01 \| Project-Wide \| Codebase Integrity & Integration Guardian \| ACTIVE" (MOD-02 asks the owner to create it) | [continuations/ARC-01_BOOTSTRAP_PROMPT_2026-10-28.md](continuations/ARC-01_BOOTSTRAP_PROMPT_2026-10-28.md) | [CODEBASE_GUARDIAN_HANDOVER_2026-10-28_v1.md](CODEBASE_GUARDIAN_HANDOVER_2026-10-28_v1.md); [INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md); [ARCHITECTURE_AND_DEPENDENCY_MAP.md](../project-control/ARCHITECTURE_AND_DEPENDENCY_MAP.md); [ACTIVE_CHANGE_REGISTER.md](../project-control/ACTIVE_CHANGE_REGISTER.md) | Its baseline review (TC-04) |
| **NB-01** (continues in its existing chat; replaced only if MOD-02 judges its context unreliable) | [continuations/NB-01_RESUME_NOTE_2026-10-28.md](continuations/NB-01_RESUME_NOTE_2026-10-28.md), sent into the existing NB-01 chat by MOD-02 (cross-session message, if available) or pasted by the owner | [NEW_BUILD_HANDOVER_2026-10-28_v1.md](NEW_BUILD_HANDOVER_2026-10-28_v1.md); the [M1.4 card](../project-control/TASK_REGISTER.md#tb-06-and-tb-07-m14-and-its-round-2-fixes); its own state report of 27 Oct (private) | TB-08, then B2 |

The owner's message that goes with this handover (what to do in the Claude interface, in order) is
[continuations/OWNER_MESSAGE_2026-10-28.md](continuations/OWNER_MESSAGE_2026-10-28.md).

**Workstream order.** MOD-02 resumes Workstream A first (TA-03, then TA-05, then the October refresh TA-10), then
Workstream B (M1.4 preservation and completion). Preserving M1.4 (TB-08) changes no product and may be authorised
during step 0. See the master handover, section 15.

## 5. Rules for handover files

1. **Dated and versioned names.** `MASTER_HANDOVER_<YYYY-MM-DD>_v<n>.md`, `<AREA>_HANDOVER_<YYYY-MM-DD>_v<n>.md`. A new
   handover is a new file. Never overwrite or delete an older one (owner's handover prompt, section 25).
2. **Update this index** in the same change: move the superseded file to section 3 with the reason, and name the
   new authoritative file in section 1.
3. **Link predecessor and successor.** Each successor-chat handover names the outgoing chat id and the successor id,
   and the [CHAT_REGISTRY.md](../project-control/CHAT_REGISTRY.md) row of each points to it.
4. **Successor prompts live in [continuations/](continuations/README.md)**, one file per outgoing chat or task, named
   as the procedure there says, and are listed in its index.
5. **Public by default, so sanitised.** This repository is public. Handover files never contain client names or data,
   PANs, folio or account numbers, where client files are kept (D-019), cloud-folder paths that hold client files, a
   credential or any detail of one, Screener scores or ranks (D-026), private page links, session ids, transcript file
   names, scratch folder paths, or the previous owner's identity. Those go in the private supplement only.
6. **Pushed with the gates.** A handover branch (`handover/<from>-to-<to>-YYYYMMDD`) is pushed with
   `git push -u origin <branch>` from its own worktree with `PRD_PRIVACY_DENYLIST` exported, after the
   security-release-reviewer's GO, and merged through the lighter docs path of
   [project-control/README.md](../project-control/README.md#6-gates-a-to-e).

## 6. Change log

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First index, for the MOD-01 to MOD-02 handover. `docs/HANDOVER.md` (23 Oct) marked historical |
