# Moderator handover template (scenario B)

Use this template when the Moderator chat itself must be replaced (owner's handover prompt, sections 15 and 16,
scenario B). The procedure around it (triggers, branch, push, prompt, registry) is in
[continuations/README.md](continuations/README.md). The sub-chat version is
[SUBCHAT_HANDOVER_TEMPLATE.md](SUBCHAT_HANDOVER_TEMPLATE.md).

**How to use it.**
1. Copy everything below the line "Template starts here" into a new file
   `docs/handover/MASTER_HANDOVER_<YYYY-MM-DD>_v<n>.md`. The master handover is the Moderator's handover document. Use
   the actual date in IST; `<n>` starts at 1 for that date. Never overwrite an older master handover.
2. Replace every `<...>` with the real value, found with the method in the "How to establish it" column. Never copy a
   value from an older handover without re-checking it.
3. If a value cannot be established, write `[UNKNOWN]` and say what is missing, who could supply it and how. Never
   guess.
4. Label every material claim [VERIFIED] (with its evidence: SHA, `file:line` or command), [INFERRED], [UNCERTAIN] or
   [UNKNOWN].
5. Use the owner's status words exactly. Chats: ACTIVE, WAITING, QUEUED, BLOCKED, HANDOVER REQUIRED, COMPLETED,
   RETIRED, SUPERSEDED. Work: VERIFIED COMPLETE; IMPLEMENTED, NOT FULLY VERIFIED; IN PROGRESS; PLANNED; BLOCKED; NOT
   STARTED; EXISTING DEFECT; UNKNOWN / NEEDS INVESTIGATION; SUPERSEDED.
6. **The repository is public.** Write no client names or data, PANs, folio or account numbers, where client files are
   kept (D-019), cloud-folder paths that hold client files, credentials or any detail of one, Screener scores or ranks
   (D-026), private page links, session ids, transcript file names, scratch folder paths, or the previous owner's
   identity. Put them in a dated private supplement under `C:\dev\private\handover\` and refer to it by path.
7. Link to the registers in `docs/project-control/` instead of copying their long tables. Say what changed since the
   last master handover and give the register as the detail.
8. Delete this "How to use it" block from the filled copy. Keep the section headings so handovers can be compared.

The first filled example is [MASTER_HANDOVER_2026-10-28_v1.md](MASTER_HANDOVER_2026-10-28_v1.md) (MOD-01 to MOD-02).

---

Template starts here

---

# Master handover, `<D Mon YYYY>` (version `<n>`)

## 0. Header

| Field | Value | How to establish it |
|---|---|---|
| Document | `docs/handover/MASTER_HANDOVER_<YYYY-MM-DD>_v<n>.md` | the file name you are writing |
| Written | `<date and time, IST>` by `<outgoing Moderator id>` | the clock in IST |
| Outgoing Moderator | `<MOD-nn>`, exact chat name `"<name in the Claude interface>"`, created `<date>`, compactions `<count>` | the chat registry row; the compaction count from the transcript's compaction entries or the owner's report, never invented |
| Successor Moderator | `<MOD-mm>` (the next sequential id), recommended chat name `MOD-mm \| Project-Wide \| Master Project Moderator \| ACTIVE` | owner's section 16: a new sequential id; the old id stays in the registry |
| Other handovers in this change | `<task ids passing to other chats, or "none">` | the task register's owner column |
| Supersedes | `<previous master handover file and version>` | [README.md](README.md) section 1 |
| Handover branch | `handover/<mod-nn>-to-<mod-mm>-<YYYYMMDD>`, based on `<main SHA>` | section 13 below |
| Private supplement | `C:\dev\private\handover\PRIVATE_SUPPLEMENT_<YYYY-MM-DD>.md` | the file you write for everything sensitive |
| Anchors re-checked | `<date and time, IST>` | section 3 |

## 1. Why this handover now

| Field | Value | How to establish it |
|---|---|---|
| Trigger | `<one of: three compactions; owner reports lost context; cannot rebuild tasks or decisions; details lost; risk of losing knowledge; specialist chat needed; retirement; Moderator replacement>` | [continuations/README.md](continuations/README.md#1-when-to-hand-over) section 1 |
| Evidence for the trigger | `<compaction entries counted, or the owner's words and date>` | the transcript metadata (timestamps only) or the owner's message |
| What the outgoing Moderator can no longer rebuild reliably | `<list, or "nothing known">` | honest self-check against the registers |

## 2. Project overview and where the workstreams stand

Write a short narrative (one screen) of what the product is, the two workstreams and what changed since the last
master handover. Then fill the table.

| Field | Value | How to establish it |
|---|---|---|
| Workstream order in force | `<the owner's order, for example "A first, then B">` | the owner's latest instruction (REQ ids) |
| Where Workstream A stands | `<status word, current task, last merged batch>` | [TASK_REGISTER.md](../project-control/TASK_REGISTER.md) |
| Where Workstream B stands | `<status word, current milestone, last merged milestone>` | the same register |
| Owner's six-step sequence | `<which of steps 1 to 6 (owner's section 6) is current, and why>` | the master handover's previous mapping table |
| What changed since the last master handover | `<merges, new chats, new decisions, new risks>` | `git log --first-parent origin/main <last handover base>..origin/main`; the registers' change logs |

## 3. Current anchors

Run the read-only block in
[REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md#verify-before-you-trust)
first, and record every mismatch.

| Anchor | Value | How to establish it |
|---|---|---|
| `main` = `origin/main` | `<SHA>`, `<merge subject>`, `<date>` | `git rev-parse main origin/main \| cut -c1-7` (`--short` takes one ref only); `git ls-remote origin refs/heads/main` |
| Live page `/` | `<bytes>`, MD5 `<MD5>`, equal to `main`'s `index.html`: `<yes/no>` | `curl -s <site>/ \| md5sum`; `git show origin/main:index.html \| md5sum` |
| Preview `/next/` | `<bytes>`, SHA-256 `<hash>` | `curl -s <site>/next/ \| sha256sum` |
| Open pull requests | `<list or "none">` | `gh pr list --state open` |
| Latest CI and Pages runs on `main` | `<run ids and results>` | `gh run list --limit 4` |
| Every active branch (one row each) | `<branch>` at `<SHA>`, on origin `<yes/no>`, worktree `<path>`, clean `<yes/no>` | `git rev-parse`, `git ls-remote origin`, `git -C <worktree> status --porcelain` |
| Stash | `<count>` | `git stash list` |
| Deny-list | set persistently `<yes/no>` | `echo "${PRD_PRIVACY_DENYLIST:-unset}"` in a fresh shell |

## 4. Chats

Snapshot of [CHAT_REGISTRY.md](../project-control/CHAT_REGISTRY.md); the registry stays authoritative.

| Chat line (`<ID> \| <WORKSTREAM> \| <RESPONSIBILITY> \| <STATUS>`) | Exact name | Tasks | Worktree and branch | Compactions | Successor or predecessor | Note |
|---|---|---|---|---|---|---|
| `<one row per chat, active and retired>` | `<name>` | `<task ids>` | `<path>`, `<branch>` | `<count or [UNKNOWN]>` | `<ids>` | `<blocker, health, last contact>` |

| Field | Value | How to establish it |
|---|---|---|
| Chats that could not be reached | `<ids, and what is therefore unknown>` | say so; never invent a status |
| Context health of each chat | `<under or over the 3-compaction rule>` | [CHAT_REGISTRY.md](../project-control/CHAT_REGISTRY.md#context-health-rule) |

## 5. Tasks in flight and next

| Task | Owner chat | Status word | Branch and head | Evidence | Next step | Accept when |
|---|---|---|---|---|---|---|
| `<one row per task that is IN PROGRESS, BLOCKED or next in line>` | `<id>` | `<status>` | `<branch>` at `<SHA>` | `<commands or records>` | `<step>` | `<criteria>` |

Every other task: [TASK_REGISTER.md](../project-control/TASK_REGISTER.md).

## 6. Active implementation branches: preserved, not replaced

The handover branch carries documents only. It never replaces an implementation branch (owner's section 16).

| Branch | Task | Head SHA | Parent or base | On origin | Uncommitted or local-only work | How it is preserved |
|---|---|---|---|---|---|---|
| `<branch>` | `<task>` | `<SHA>` | `<SHA and branch>` | `<yes/no>` | `<none, or the inventory>` | `<pushed / WIP checkpoint <SHA> / private bundle in an owner-approved place / BLOCKED: reason>` |

## 7. Change ownership and overlaps

| Field | Value | How to establish it |
|---|---|---|
| Files each active task owns | see [ACTIVE_CHANGE_REGISTER.md](../project-control/ACTIVE_CHANGE_REGISTER.md); list here only the changes since the last handover: `<...>` | the register; `git diff --name-only origin/main...<branch>` |
| Overlaps found | `<files changed by more than one branch, and the hunks that conflict>` | `git merge-tree <main> <branch1> <branch2>` (read-only) |
| Ownership decisions made by the outgoing Moderator | `<task, file, decision, date>` | its notes and the register's change log |
| Ownership released since the last handover | `<task, files>` | Gate D records |

## 8. Decisions and numbering

| Field | Value | How to establish it |
|---|---|---|
| Decisions recorded since the last handover | `<D ids, one line each>` | `git log -p origin/main -- docs/DECISIONS.md` |
| Rulings made but not yet recorded as D entries | `<text, date, which range will hold it>` | the outgoing Moderator's own notes; never leave a ruling only in a chat |
| Number ranges in force | `<per chat: D, KI, CR ranges and the next free number in each>` | [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#numbering-allocation); `git grep` on every active branch for the highest id used |
| Ranges handed to the successor | `<D-nnn to D-nnn, KI-nnn to KI-nnn>` | the allocation table, updated in this change |

## 9. Guardian findings

| Field | Value | How to establish it |
|---|---|---|
| Open NO-GO verdicts | `<change, finding with file:line, state>` | ARC's reports; [INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md) section 8 |
| Findings accepted as risks | `<finding, who accepted it, date>` | the gate records |
| Latest merge simulation | `<command, date, result>` | ARC's last report |
| Interface changes pending | `<I-nn, change, consumers to update>` | [INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md) |

## 10. Integration state

| Field | Value | How to establish it |
|---|---|---|
| Last verified baseline | `<main SHA>`, live MD5 `<MD5>`, `/next/` `<bytes, SHA-256>` | integration log section 1 |
| Pending integrations | `<task, branch, gates passed so far, what is left>` | integration log section 5 |
| Merge readiness and fixed dependencies | `<which change is closest to ready; any fixed order such as "X after Y">` | [the merge readiness rule](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#merge-readiness-rule) |
| Incidents since the last handover | `<date, what, state>` | integration log section 6 |

## 11. Owner decisions and messages not yet relayed

| Field | Value | How to establish it |
|---|---|---|
| Pending owner decisions, in the order to ask | `<PD ids, what each blocks>` | [DECISION_LOG.md](../project-control/DECISION_LOG.md) section 2 |
| Answers received but not yet recorded | `<owner's words, date, the D or KI entry still to write>` | the outgoing Moderator's chat; record them before handing over |
| Messages ready to relay to another chat | `<to whom, the exact text or the file holding it>` | never claim a message was sent unless it was |
| Owner requests not yet turned into tasks | `<request, date, REQ id to create or update>` | [REQUIREMENTS_AND_CHANGE_REGISTER.md](../project-control/REQUIREMENTS_AND_CHANGE_REGISTER.md) |

## 12. Open questions, risks and the plan

| Field | Value | How to establish it |
|---|---|---|
| Unresolved questions | `<question, why it matters, where tracked>` | everything labelled [UNCERTAIN] or [UNKNOWN] above |
| Top risks | `<RR ids and one line each>` | [KNOWN_ISSUES_AND_REGRESSION_RISKS.md](../project-control/KNOWN_ISSUES_AND_REGRESSION_RISKS.md) section 7 |
| Immediate execution plan | an ordered table: step, task, owner chat, actions, accept when | start with "validate this handover"; then the owner's workstream order |

## 13. The handover branch

Follow [continuations/README.md](continuations/README.md) sections 3 to 6.

| Field | Value | How to establish it |
|---|---|---|
| Branch name | `handover/<mod-nn>-to-<mod-mm>-<YYYYMMDD>` | unique: `git branch -a --list`, `git ls-remote origin` |
| Based on | `<main SHA>` (or the approved project-control branch `<name>` at `<SHA>`) | `git rev-parse` |
| Worktree | `<path>` | `git worktree list` |
| Pre-branch checks 1 to 8 (owner's section 17) | `<result of each: root, branch and commit, changes, ownership, other tasks, unintegrated work, secrets, safe checkpoint>` | the commands in [continuations/README.md](continuations/README.md#4-before-making-the-branch-inspect) |
| Preservation case for the Moderator's own uncommitted work | `<A, B, C or D, and what was done>` | [continuations/README.md](continuations/README.md#5-preserve-the-work-the-four-safe-checkpoint-cases) |
| Commit | `<SHA>` | `git log -1` |
| Security GO | `<security-release-reviewer verdict and date>` | the agent's report |
| Pushed | `git push -u origin <branch>` from `<worktree>` with the deny-list exported: `<yes/no>`; remote SHA `<SHA>` | `git ls-remote origin refs/heads/<branch>` |
| Post-push checks (owner's section 19) | `<each item and its result>` | [continuations/README.md](continuations/README.md#6-push-and-verify) |
| PR and merge | `<PR number, CI result, merge SHA>` or `<not yet: why>` | `gh pr view`, `git log` |

## 14. Successor prompt

| Field | Value | How to establish it |
|---|---|---|
| Prompt file | `docs/handover/continuations/<MOD-nn>_TO_<MOD-mm>_SUCCESSOR_PROMPT_<YYYY-MM-DD>.md` | the file you write |
| Bootstrap prompt | `docs/handover/MODERATOR_BOOTSTRAP_PROMPT.md` updated to match: `<yes/no>` | compare the two |
| Parts A to J present | A identity `<y/n>`; B transfer context `<y/n>`; C starting point `<y/n>`; D first actions `<y/n>`; E scope `<y/n>`; F work to resume `<y/n>`; G coordination `<y/n>`; H git `<y/n>`; I completion `<y/n>`; J uncertainty `<y/n>` | [continuations/README.md](continuations/README.md#7-the-handover-document-and-the-successor-prompt) section 7 |
| Placeholders left | `<none, or each one with what must be filled, by whom>` | read the prompt |
| Agrees with this document | `<yes, checked on date>` | compare SHAs, branches and paths |
| Credentials or client data in the prompt | must be `none` | read it; the private supplement holds the rest |

## 15. Records updated in this change

| Record | Updated | Note |
|---|---|---|
| [CHAT_REGISTRY.md](../project-control/CHAT_REGISTRY.md): outgoing row HANDOVER REQUIRED, successor row QUEUED | `<y/n>` | |
| [TASK_REGISTER.md](../project-control/TASK_REGISTER.md) | `<y/n>` | |
| [ACTIVE_CHANGE_REGISTER.md](../project-control/ACTIVE_CHANGE_REGISTER.md) | `<y/n>` | |
| [REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md) | `<y/n>` | |
| [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md) (ranges) | `<y/n>` | |
| [DECISION_LOG.md](../project-control/DECISION_LOG.md) and `docs/DECISIONS.md` | `<y/n>` | |
| [INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md) | `<y/n>` | |
| [README.md](README.md) (the handover index) and [the prompt index](continuations/README.md#9-index-of-continuation-prompts) | `<y/n>` | |
| Memory files | `<y/n>` | they must point to the registers, not restate them |
| Private supplement | `<y/n>` | |

## 16. Message to the owner

The text sent to the owner (owner's section 21). All ten items in one message:

| # | Item | Value |
|---|---|---|
| 1 | Notice that this chat stops implementation and coordination | `<text>` |
| 2 | Exact successor chat name | `<MOD-mm \| Project-Wide \| Master Project Moderator \| ACTIVE>` |
| 3 | Handover branch name | `<branch>` |
| 4 | Local path of this document | `C:\dev\portfolio-review\...\docs\handover\MASTER_HANDOVER_<YYYY-MM-DD>_v<n>.md` in `<worktree>` |
| 5 | Local path of the successor prompt | `<path>` |
| 6 | GitHub links, only if verified | `<links, or "not pushed yet">` |
| 7 | Does the branch hold every relevant change? | `<yes / no, and what is missing>` |
| 8 | What stays uncommitted or local-only | `<list, or "nothing">` |
| 9 | The full prompt to paste | inline in the message |
| 10 | What the owner does | create a new chat; give it the name in item 2; paste item 9; tell the successor when ready |

## 17. Successor's validation (filled by the successor)

| Field | Value | How to establish it |
|---|---|---|
| Anchors matched | `<each anchor of section 3: match / mismatch and what was recorded>` | the verify block |
| Registers reconciled with git | `<y/n, differences found>` | compare each register's SHAs with `git` |
| Questions sent back to the outgoing Moderator | `<list, or "none">` | |
| Validation complete | `<date and time, IST>` | |
| Outgoing Moderator set to RETIRED | `<date, reason>`, only after its work, ownership and handover are reconciled | [CHAT_REGISTRY.md](../project-control/CHAT_REGISTRY.md) |

## 18. Change log

| Date (IST) | Version | By | Change |
|---|---|---|---|
| `<date>` | `v<n>` | `<MOD-nn>` | `<first version for the MOD-nn to MOD-mm handover>` |
