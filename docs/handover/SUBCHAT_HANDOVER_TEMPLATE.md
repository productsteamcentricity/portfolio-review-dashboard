# Sub-chat handover template (scenario A)

Use this template when an implementation chat (EX-nn, NB-nn) or the Guardian (ARC-nn) must hand its work to a
successor (owner's handover prompt, sections 15 and 16, scenario A). The procedure around it (triggers, branch,
checkpoint, push, prompt, registry) is in [continuations/README.md](continuations/README.md). The Moderator's version
is [MODERATOR_HANDOVER_TEMPLATE.md](MODERATOR_HANDOVER_TEMPLATE.md).

**How to use it.**
1. Copy everything below the line "Template starts here" into a new file in `docs/handover/`, named as the next
   version of the workstream's handover:
   - an EX chat (Workstream A): `EXISTING_DASHBOARD_HANDOVER_<YYYY-MM-DD>_v<n>.md`;
   - an NB chat (Workstream B): `NEW_BUILD_HANDOVER_<YYYY-MM-DD>_v<n>.md`;
   - the Guardian: `CODEBASE_GUARDIAN_HANDOVER_<YYYY-MM-DD>_v<n>.md`.
   Use the actual date in IST. Never overwrite an older handover; add the new one to [README.md](README.md).
2. Replace every `<...>` with the real value, found with the method in the "How to establish it" column. Re-check
   every value; never copy one from an older handover or from another chat's claim.
3. If a value cannot be established, write `[UNKNOWN]` and say what is missing, who could supply it and how.
4. Label every material claim [VERIFIED] (with its evidence: SHA, `file:line` or command), [INFERRED], [UNCERTAIN] or
   [UNKNOWN]. Never write a check as passed unless it was run on the commit named.
5. Use the owner's status words exactly. Chats: ACTIVE, WAITING, QUEUED, BLOCKED, HANDOVER REQUIRED, COMPLETED,
   RETIRED, SUPERSEDED. Work: VERIFIED COMPLETE; IMPLEMENTED, NOT FULLY VERIFIED; IN PROGRESS; PLANNED; BLOCKED; NOT
   STARTED; EXISTING DEFECT; UNKNOWN / NEEDS INVESTIGATION; SUPERSEDED.
6. **The repository is public.** Write no client names or data, PANs, folio or account numbers, where client files are
   kept (D-019), cloud-folder paths that hold client files, credentials or any detail of one, Screener scores or ranks
   (D-026), private page links, session ids, transcript file names, scratch folder paths, or the previous owner's
   identity. Put them in a private file under `C:\dev\private\handover\` and refer to it by path.
7. Delete this "How to use it" block from the filled copy. Keep the section headings.

---

Template starts here

---

# `<Workstream>` handover, `<D Mon YYYY>` (version `<n>`): `<outgoing id>` to `<successor id>`, task `<task id>`

## 0. Header

| Field | Value | How to establish it |
|---|---|---|
| Document | `docs/handover/<AREA>_HANDOVER_<YYYY-MM-DD>_v<n>.md` | the file you are writing |
| Written | `<date and time, IST>` by `<outgoing chat id>` | the clock in IST |
| Outgoing chat | `<ID>`, exact name `"<name in the Claude interface>"`, workstream `<A, B or project-wide>`, created `<date>`, compactions `<count>` | the chat registry row; compactions from the transcript's compaction entries or the owner's report, never invented |
| Successor chat | `<ID>`, chat line `<ID> \| <WORKSTREAM> \| <RESPONSIBILITY> \| QUEUED` | MOD-nn assigns the id (the next number of the same kind, or an existing chat) |
| Task or tasks handed over | `<task ids with REQ, CR, D and KI ids>` | [TASK_REGISTER.md](../project-control/TASK_REGISTER.md) |
| Moderator | `<MOD-nn>` | [CHAT_REGISTRY.md](../project-control/CHAT_REGISTRY.md) |
| Guardian | `<ARC-nn>` | the same registry |
| Supersedes | `<previous handover of this workstream, or "none">` | [README.md](README.md) |
| Private file for this handover | `<path under C:\dev\private\handover\, or "none needed">` | the file you write for anything sensitive |

## 1. Why this handover now

| Field | Value | How to establish it |
|---|---|---|
| Trigger | `<three compactions; owner reports lost context; cannot rebuild tasks or decisions; details lost; risk of losing knowledge; specialist chat needed; retirement>` | [continuations/README.md](continuations/README.md#1-when-to-hand-over) |
| Evidence for the trigger | `<compaction entries counted, or the owner's words and date>` | transcript metadata (timestamps only) or the owner's message |
| Scenario | A: the successor continues the same task | [continuations/README.md](continuations/README.md#2-the-two-scenarios) |
| What the outgoing chat can no longer rebuild reliably | `<list, or "nothing known">` | honest self-check against git and the registers |

## 2. Repository state before the branch (owner's section 17, checks 1 to 8)

Run the commands in [continuations/README.md](continuations/README.md#4-before-making-the-branch-inspect) in the task's
own worktree.

| # | Check | Result | How to establish it |
|---|---|---|---|
| 1 | Repository root and worktree | `<path>` | `git -C <worktree> rev-parse --show-toplevel` |
| 2 | Current branch, upstream and latest commit | `<branch>`, upstream `<ref or none>`, `<SHA subject>` | `git status --short --branch`; `git log -1` |
| 3 | Staged, unstaged and untracked changes | `<counts and the list>` | `git status --porcelain=v1 --untracked-files=all`; `git diff --stat`; `git diff --cached --stat` |
| 4 | Changes that belong to this task | `<files>` | compare with the task's files in [ACTIVE_CHANGE_REGISTER.md](../project-control/ACTIVE_CHANGE_REGISTER.md) |
| 5 | Changes that may belong to other tasks | `<files and the task or chat they may belong to, or "none">` | the same register; the file's history |
| 6 | Work on the branch not yet in `main` | `<commit count and list>`; on a remote `<yes/no>` | `git log --oneline origin/main..HEAD`; `git branch -r --contains HEAD` |
| 7 | Secrets, client data, generated files | `<none found / found: kept out, see case B>` | read the diff; privacy scan with the deny-list exported |
| 8 | Can a safe checkpoint be made? | `<yes, case A / no, case B, C or D>` | section 3 |

## 3. Preservation

| Field | Value | How to establish it |
|---|---|---|
| Case | `<A, B, C or D>` and why | [continuations/README.md](continuations/README.md#5-preserve-the-work-the-four-safe-checkpoint-cases) |
| Parent branch and source commit | `<task branch>` at `<SHA>` | `git rev-parse --short <task branch>` before the checkpoint |
| Continuation branch | `continuation/<successor-id>-task-<task-id>-<YYYYMMDD>` | unique: `git branch -a --list`, `git ls-remote origin` |
| WIP checkpoint commit | `<SHA>`, subject `WIP: checkpoint task <TASK-ID> (<scope>) for context handover` | `git log -1`; the message follows the model in the procedure |
| Page MD5 (Workstream A) | before `<MD5>` at the parent; after `<MD5>` at the checkpoint; reproduced from the parent plus the patch scripts `<yes/no>` | `git show <sha>:index.html \| md5sum` |
| Build size and SHA-256 (Workstream B) | `<bytes, hash>` or `not built at the checkpoint` | `npm run build`, then `sha256sum app/dist/index.html` |
| Not committed (case B or C inventory) | `<path, kind, size, why not committed>`, or `none` | the inspection above |
| Private patch or copy | `<path in the private folder, or "none">`; contents read before saving `<yes>` | never a secret or client data |
| What stays local-only | `<list, or "nothing">` | `git branch -r --contains <SHA>` for each commit |

## 4. Push and verification (owner's section 19)

| Check | Result | How to establish it |
|---|---|---|
| Security GO before the push | `<verdict, date>` | security-release-reviewer report |
| Pushed with `git push -u origin <branch>` from the branch's own worktree, deny-list exported | `<yes/no>`; scan output says the deny-list was used `<yes/no>` | the push output |
| The branch exists on the remote at the right commit | remote `<SHA>` = local `<SHA>` | `git ls-remote origin refs/heads/<branch>`; `git rev-parse HEAD` |
| The source commit is correct | `HEAD^1` = `<parent SHA>` | `git rev-parse --short HEAD^1` |
| All safe checkpointed changes are present | `<y/n>` | `git show --stat HEAD` |
| No unrelated change is included | `<y/n>` | the same list against section 2, row 5 |
| Local-only and uncommitted items are accounted for | `<y/n>`, see section 3 | |
| The handover document exists | this file's path | |
| The successor prompt names the right branch and path | `<y/n>` | read section 10's prompt |
| The test state is written honestly | `<y/n>` | sections 5 and 6 list only checks actually run |
| If the push failed | `<the exact blocker and how the owner reaches the local state: worktree, branch, SHA>` | the push output |

## 5. Task state

| Field | Value | How to establish it |
|---|---|---|
| Status word | `<one of the owner's nine>` | the evidence below; never infer success from a file existing |
| Done, with evidence | `<item: commit SHA, check, count>` | `git log`; the checks' output |
| Not done | `<items still open, in plain words>` | the task's scope and its change-impact contract |
| Scope grown beyond the contract | `<no / yes: what, and whether MOD-nn agreed>` | the contract in the CR or PR body |
| D and KI ids used | `<ids>`, inside the chat's range `<range>` | [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#numbering-allocation) |
| Gates passed | `<A, B, C, D, E: each with date and record>` | [INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md) section 8 |

## 6. Checks

| Check | Command | Commit | Result and counts | Time zone |
|---|---|---|---|---|
| `<one row per check actually run>` | `<exact command>` | `<SHA>` | `<pass/fail, counts>` | `<IST or UTC>` |

**Checks not run on the checkpoint:** `<every check that applies to this change and was not run, said plainly>`. The
full list of checks is in [docs/TESTING.md](../TESTING.md).

## 7. Scope for the successor

| Field | Value | How to establish it |
|---|---|---|
| Permitted scope | `<what the successor may change>` | the task's row and its change-impact contract |
| Non-goals | `<what it must not do>` | the contract's item 12 |
| Reserved files (owned by this task) | `<paths>` | [ACTIVE_CHANGE_REGISTER.md](../project-control/ACTIVE_CHANGE_REGISTER.md) |
| Files it must not touch | `<other tasks' files, the other workstream's files, shared hotspots without MOD-nn's rule>` | [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md) |
| Shared interfaces and their consumers | `<I-nn: consumers>` | [INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md) |
| Dependencies and overlapping tasks | `<task: how it depends or overlaps; merge order constraints>` | [the merge readiness rule](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#merge-readiness-rule) |
| Ports for local servers and browser QA | `<ports>` | [the port register](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#port-register) |

## 8. Work to resume, in order

| # | Step | Accept when | Checks it needs |
|---|---|---|---|
| 1 | Validate the branch, worktree and this document against git | every SHA, MD5 and file in sections 3 and 4 matches | the commands in section 2 |
| `<2..n>` | `<next step>` | `<measurable criteria>` | `<checks from docs/TESTING.md, reviews, gates>` |

## 9. Coordination

| Field | Value | How to establish it |
|---|---|---|
| Moderator and how to reach it | `<MOD-nn>`; through the owner, or cross-session messages if available | never claim a message was sent unless it was |
| Guardian | `<ARC-nn>`; open findings on this task: `<list or "none">` | ARC's reports |
| Related chats | `<id: what they need from this task, or give it>` | the registers |
| Pending owner decisions affecting the task | `<PD ids and what each blocks>` | [DECISION_LOG.md](../project-control/DECISION_LOG.md) |
| Messages waiting to be relayed | `<to whom, text or file>` | |
| Rule | The successor changes no shared component before the ownership and change-impact checks are done | owner's section 20, part G |

## 10. Successor prompt

| Field | Value | How to establish it |
|---|---|---|
| Prompt file | `docs/handover/continuations/<SUCCESSOR-ID>_TASK-<TASK-ID>_SUCCESSOR_PROMPT_<YYYY-MM-DD>.md` | the file you write |
| Parts A to J present | A identity `<y/n>`; B transfer context `<y/n>`; C starting point `<y/n>`; D first actions `<y/n>`; E scope `<y/n>`; F work to resume `<y/n>`; G coordination `<y/n>`; H git `<y/n>`; I completion `<y/n>`; J uncertainty `<y/n>` | [continuations/README.md](continuations/README.md#7-the-handover-document-and-the-successor-prompt) |
| Placeholders left | `<none, or each one with what must be filled, by whom and how>` | read the prompt |
| Agrees with this document | `<yes, checked on date>` | compare SHAs, branch, worktree, paths |
| Credentials or client data in the prompt | must be `none` | read it |
| Indexed | `<y/n>` | [the prompt index](continuations/README.md#9-index-of-continuation-prompts) |

## 11. Uncertainty warnings

The successor investigates each of these before treating the handover as complete.

| Item | Why it matters | How to resolve it |
|---|---|---|
| `<every [UNCERTAIN] or [UNKNOWN] above, and any missing evidence>` | `<effect on the task>` | `<command, person or decision>` |

## 12. Records updated

| Record | Updated | Note |
|---|---|---|
| [CHAT_REGISTRY.md](../project-control/CHAT_REGISTRY.md): outgoing row HANDOVER REQUIRED; successor row QUEUED | `<y/n>` | |
| [TASK_REGISTER.md](../project-control/TASK_REGISTER.md): owner, branch, next step | `<y/n>` | |
| [ACTIVE_CHANGE_REGISTER.md](../project-control/ACTIVE_CHANGE_REGISTER.md): branch, head, ownership passed (not released) | `<y/n>` | |
| [REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md): new branch | `<y/n>` | |
| [INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md): incident, if any | `<y/n>` | |
| [README.md](README.md) and the prompt index | `<y/n>` | |

## 13. Message to the owner

All ten items in one message (owner's section 21):

| # | Item | Value |
|---|---|---|
| 1 | Notice that this chat stops implementation | `<text>` |
| 2 | Exact successor chat name | `<ID \| WORKSTREAM \| RESPONSIBILITY \| ACTIVE>` |
| 3 | Continuation branch | `<branch>` |
| 4 | Local path of this document | `<path in the worktree that holds it>` |
| 5 | Local path of the successor prompt | `<path>` |
| 6 | GitHub links, only if verified | `<links, or "not pushed: reason">` |
| 7 | Does the branch hold every relevant change? | `<yes / no, and what is missing>` |
| 8 | What stays uncommitted or local-only | `<list, or "nothing">` |
| 9 | The full prompt to paste | inline in the message |
| 10 | What the owner does | create a new chat; give it the name in item 2; paste item 9; tell the Moderator it is running |

## 14. Outgoing chat's final state

| Field | Value |
|---|---|
| Stopped writing in the task's worktree | `<date and time, IST>` |
| Final report sent to the owner and the Moderator | `<date and time, IST>` |
| Anything left running (servers, workflows, background tasks) | `<none, or what and how to stop it>` |

## 15. Successor's validation (filled by the successor)

| Field | Value |
|---|---|
| Branch, worktree and head matched | `<y/n, differences>` |
| Page MD5 or build hash re-derived | `<y/n, value>` |
| Questions sent to the Moderator | `<list, or "none">` |
| Validated | `<date and time, IST>` |
| Outgoing chat set to RETIRED by the Moderator | `<date, reason>`, only after its work, ownership and handover are reconciled |

## 16. Change log

| Date (IST) | Version | By | Change |
|---|---|---|---|
| `<date>` | `v<n>` | `<outgoing id>` | `<first version for the outgoing to successor handover of task id>` |
