# Continuation procedure

**Written:** 28 Oct 2026 (IST) by MOD-01 for the handover to MOD-02. **Kept by:** MOD-02. **Source:** the owner's
handover prompt of 27 Oct 2026, sections 14 to 22, applied to this repository's tools and rules.

Every Claude chat on this project loses detail when its context fills up. This file says how a chat hands its work
to a successor without losing anything: when to do it, how to keep the code safe, which branch to make, how to push
it, what the successor prompt must say, and what the outgoing chat does afterwards. It also indexes every successor
prompt in this folder (section 9).

A chat cannot create, name or open another chat. The outgoing chat prepares everything; **the owner creates the new
chat and pastes the prompt**. Never claim that a chat was created, a message was sent or a branch was pushed unless it
was, and was checked.

**Labels.** [VERIFIED] with its evidence, [INFERRED], [UNCERTAIN], [UNKNOWN], as in
[project-control/README.md](../../project-control/README.md).

## 1. When to hand over

Start a handover as soon as any of these is true (owner's handover prompt, section 15):

| Trigger | How to tell |
|---|---|
| The chat has been through **three context compactions** | The transcript's compaction entries, or the owner's report. Never invent a count; if there is no counter, use the evidence you have and say so |
| The owner reports repeated compaction or lost context | The owner's message |
| The chat cannot reliably rebuild its open tasks or decisions | It cannot say, from files and git, what is done and what is not |
| Important implementation details are no longer in its context | It finds itself guessing about code it wrote |
| Further work risks losing essential knowledge | For example a long task about to start near the limit |
| A task needs a new specialist chat | MOD-02 decides |
| A chat is being retired or replaced | MOD-02 or the owner decides |
| The Moderator itself needs replacing | Scenario B below |

Do not wait until the context is exhausted. Prefer an early handover to uncertain implementation. The context-health
table is in [CHAT_REGISTRY.md](../../project-control/CHAT_REGISTRY.md#context-health-rule).

## 2. The two scenarios

| | Scenario A: an implementation chat is replaced | Scenario B: the Moderator is replaced |
|---|---|---|
| Who | EX-nn, NB-nn (and ARC-nn, see the note) | MOD-nn |
| Successor id | The next number of the same kind (EX-01 to EX-02, NB-01 to NB-02), or an existing chat that MOD-02 assigns | The next Moderator number (MOD-01 to MOD-02). The old id stays in the registry as history |
| What it inherits | The task id, its requirements and decisions, the relevant files, the **current task branch** and its working state | The whole project overview, the workstream order, active and retired chats, tasks, decisions, change ownership, the Guardian's findings, branch state, open questions and messages not yet relayed |
| Branch | A **continuation branch made from the task branch** (never from `main` when `main` lacks the work, never from an old commit) | A **handover branch from `main`** (or from the approved project-control branch) that carries only documents. It never replaces an active implementation branch |
| Handover document | [SUBCHAT_HANDOVER_TEMPLATE.md](../SUBCHAT_HANDOVER_TEMPLATE.md) | [MODERATOR_HANDOVER_TEMPLATE.md](../MODERATOR_HANDOVER_TEMPLATE.md) |
| First thing the successor does | Validate the branch and working state against the handover, then resume the task | Validate the handover against the repository and the registers before assigning any work |

**Note on ARC-nn.** The Guardian owns no task branch. A Guardian handover uses the sub-chat template, with a
`handover/arc-nn-to-arc-mm-YYYYMMDD` branch for its documents if it has any to commit.

Both scenarios can happen at once. On 27 and 28 Oct, MOD-01 handed the Moderator role to MOD-02 (scenario B) and its
task TA-03 to EX-01 (scenario A).

## 3. Branch names

| Use | Pattern | Example in this repository |
|---|---|---|
| Scenario A: the task continues in a successor chat | `continuation/<successor-chat-id>-task-<task-id>-YYYYMMDD` | `continuation/ex-01-task-ta-03-20261027` at `0f1c5d3`, made from the TA-03 task branch at `97a7d69` [VERIFIED: `git rev-parse 0f1c5d3^1`] |
| Scenario B, or any chat's handover documents | `handover/<from-chat-id>-to-<to-chat-id>-YYYYMMDD` | `handover/mod-01-to-mod-02-20261028`, based on `main` at `6443826` [VERIFIED] |

- Ids in lower case in the branch name. Use the **actual date in IST** on which the branch is made. The name must be
  unique: check with `git branch -a --list '<name>'` and `git ls-remote origin refs/heads/<name>` first.
- **`release-check.mjs` only WARNs on these two prefixes.** Its `BRANCH_RE` accepts `feature/`, `feat/`, `fix/`,
  `docs/`, `chore/`, `data/` and `test/` only, and a branch outside that list gets a WARN, not a FAIL
  [VERIFIED: `scripts/validation/release-check.mjs` lines 44 and 271]. A `WIP:` commit subject also gets a WARN,
  because it is not a conventional subject (lines 293 and 294). Either accept the warnings in the PR, or open the PR
  from a `fix/` or `docs/` branch made at the same commit, without rewriting history (TC-23, a MOD-02 decision per PR).

## 4. Before making the branch: inspect

Run these in the outgoing task's **own worktree** (never in the main checkout, never in another chat's worktree). They
are the owner's eight checks (section 17). Record the results in the handover document.

```bash
W=/c/dev/portfolio-review/.claude/worktrees/<task-worktree>
git -C "$W" rev-parse --show-toplevel                 # 1. the repository root is the worktree you expect
git -C "$W" status --short --branch                   # 2. current branch and its upstream
git -C "$W" log -1 --format='%h %s'                   #    and the latest commit
git -C "$W" status --porcelain=v1 --untracked-files=all   # 3. every staged, unstaged and untracked change
git -C "$W" diff --stat; git -C "$W" diff --cached --stat
git -C "$W" log --oneline origin/main..HEAD           # 6. work on the branch not yet in main
git -C "$W" branch -r --contains HEAD                 #    is the head on any remote yet?
```

- **4 and 5. Whose changes are these?** Compare each changed file with the task's files in
  [ACTIVE_CHANGE_REGISTER.md](../../project-control/ACTIVE_CHANGE_REGISTER.md). A change outside the task's files may
  belong to another task (case C below).
- **7. Secrets, client data and generated files.** Read the diff. Never commit a credential, client data, a PAN, a
  folio or account number, or a generated or ignored file. Run the privacy scan on the changed files with the deny-list
  exported (section 6 shows how to export it).
- **8. Can a safe checkpoint be made?** Decide which case of section 5 applies.

Record: the **parent branch**, the **source commit SHA**, the page MD5 if `index.html` changed
(`git -C "$W" show HEAD:index.html | md5sum`), and the exact state the successor continues from. Never make the branch
from an assumed or stale base.

## 5. Preserve the work: the four safe-checkpoint cases

A new branch does not save uncommitted changes. Handle the working tree explicitly (owner's section 18). Never stash,
reset, clean, discard or force anything.

**Case A: every change belongs to the outgoing task and is safe.**
1. In the task's own worktree, make the continuation branch at the task branch's head:
   `git -C "$W" switch -c continuation/<successor-chat-id>-task-<task-id>-YYYYMMDD`.
   Uncommitted changes stay in the working tree; nothing is lost. The task branch stays at its last commit, which
   becomes the checkpoint's parent. [INFERRED: this matches the TA-03 result, where the worktree is on the continuation
   branch and the task branch `fix/legacy-batch-3-tax-p3-r2` stays at the parent `97a7d69`]
2. Stage the task's files **by name** (never `git add -A` without reading the list). Check `git diff --cached --stat`.
3. Commit a labelled checkpoint. The message follows the model of `0f1c5d3` [VERIFIED: `git log -1 0f1c5d3`]:

```text
WIP: checkpoint task <TASK-ID> (<scope in a few words>) for context handover

Preservation checkpoint only, not a finished or accepted change. <Why the handover happened, and the date.>

State at this commit:
- Parent <short SHA> = <task branch name>: <what the parent holds>; page MD5 <MD5, if index.html changed>;
  checks that passed there: <each check with its count, and the time zone>.
- This commit adds <files> and updates <files>. index.html = <parent page> + <patch file>, MD5 <MD5>
  (reproduced: <yes, how> or <no>).
- Verified at checkpoint: <only the checks actually run on this commit>. Nothing else was run on this commit.
- NOT done: <docs, remaining items of the task, the full check list, reviews, the gate>.
- Caution: <anything that makes the content less trustworthy, for example "two agents may have written in this
  worktree: treat the patch as unreviewed">.

<the Co-Authored-By trailer your session's instructions give>
```

   The checkpoint is not a claim that the task is complete or that tests pass. Never merge it into `main` because it
   exists.

**Case B: mixed ownership, sensitive content or contents you do not understand.**
- Do not stage or commit the questionable changes. Do not discard them or edit another task's work.
- Make the continuation branch only if that is safe, and leave the working tree exactly as it is.
- Write an inventory of every change that could not be committed: path, kind, size, why.
- Where it is safe, keep a private patch or copy **after reading it**: for example
  `git -C "$W" diff > /c/dev/private/handover/<chat>-<task>-<YYYYMMDD>.patch` (Git Bash), and copy needed untracked
  files to the same private folder. That folder is on the same laptop and is not a backup [INFERRED]; say so. Never put a secret or client data in a patch, a handover, a log or GitHub.
- Tell the owner precisely what stays local-only and what must happen before the successor can continue.

**Case C: another chat may own some of the changes.**
- Stop before committing. Name the conflict and the other chat.
- Separate the outgoing task's changes only if you are sure which are whose. Never commit another task's changes
  under this task's id.
- If you cannot separate them with confidence, leave the working state untouched, report the blocker to MOD-02 and
  let MOD-02 decide with the other chat.

**Case D: git access or the repository's state prevents a safe branch.**
- No force-push, no destructive reset, no history rewrite, no risky file operation.
- Leave the local files as they are. Report the exact blocker (the command and its output). Prepare the largest safe
  handover package you can, and give the owner exact steps to finish the missing part.
- A blocking pre-push scan is case D, or case B if the scan found sensitive content. Never bypass the scan with
  `--no-verify`.

## 6. Push and verify

**Push from the branch's own worktree**, with the private deny-list exported, after the security-release-reviewer's
GO on what is being pushed. The pre-push hook script comes from the main checkout (`core.hooksPath` is absolute) but
it runs the scanner of the **pushing worktree** against `origin/main` [VERIFIED: `git config --get core.hooksPath`;
`scripts/hooks/pre-push`].

```bash
cd /c/dev/portfolio-review/.claude/worktrees/<task-worktree>
export PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt
git push -u origin <branch>          # first push always with -u; never --no-verify, never --force
```

In PowerShell: `$env:PRD_PRIVACY_DENYLIST = 'C:\dev\private\privacy-denylist.txt'` before the push (see
[safety-tooling.md](../../new-build/safety-tooling.md)). The variable is not set permanently on this laptop
(PD-40), so export it in every shell that pushes, and check that the scan output says the deny-list was used.

Why `-u`: several local branches track `origin/main` instead of a branch of their own name. A plain `git push` is then
refused, and a plain `git pull` would merge `main` into the branch. `git push -u origin <branch>` pushes to the right
name and fixes the upstream. [VERIFIED: the upstream hazard in
[REPOSITORY_AND_ENVIRONMENT_STATE.md](../../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md#upstream-hazard)]

**Verify** (owner's section 19), and write each result into the handover document:

| Check | Command or evidence |
|---|---|
| The branch exists on the remote at the right commit | `git ls-remote origin refs/heads/<branch>` equals `git -C "$W" rev-parse HEAD` |
| The source commit is the right one | `git -C "$W" rev-parse --short HEAD^1` equals the recorded parent |
| Every safe checkpointed change is present | `git -C "$W" show --stat HEAD` lists the expected files |
| Nothing unrelated is included | the same list holds no other task's file |
| Local-only or uncommitted items are accounted for | the case B or C inventory; `git -C "$W" status --porcelain` is empty or explained |
| The page is what the message says | `git -C "$W" show HEAD:index.html \| md5sum` equals the MD5 in the commit message |
| The handover document exists | its path under `docs/handover/` |
| The successor prompt names the right branch and path | read it against this table |
| The branch's test state is written honestly | the commit message and the handover list only checks actually run |

If the branch cannot be pushed, leave it local, keep the files, and tell the owner exactly how to reach the local
state (worktree path, branch, SHA). Never claim the successor has the full state because a branch name exists.

## 7. The handover document and the successor prompt

**Handover document.** Fill [SUBCHAT_HANDOVER_TEMPLATE.md](../SUBCHAT_HANDOVER_TEMPLATE.md) (scenario A) or
[MODERATOR_HANDOVER_TEMPLATE.md](../MODERATOR_HANDOVER_TEMPLATE.md) (scenario B) and save it as a new dated file in
`docs/handover/`. Never overwrite an older handover. Add it to [the handover index](../README.md).

**Successor prompt.** One file per outgoing chat or task, in this folder, named:
- scenario A: `<SUCCESSOR-ID>_TASK-<TASK-ID>_SUCCESSOR_PROMPT_<YYYY-MM-DD>.md`, for example `NB-02_TASK-TB-06_...`;
- scenario B: `<FROM-ID>_TO_<TO-ID>_SUCCESSOR_PROMPT_<YYYY-MM-DD>.md`, for example `MOD-02_TO_MOD-03_...`.

The prompt is the complete text the owner pastes. A generic "read the handover and continue" is not enough. It must
contain these ten parts (owner's section 20):

| Part | It must say |
|---|---|
| A. New chat identity | The exact chat name in the form `<ID> \| <WORKSTREAM> \| <RESPONSIBILITY> \| <STATUS>`, the unique id, the workstream and the responsibility |
| B. Transfer context | The exact handover document and supporting files; the verified repository path, worktree, branch and latest commit SHA |
| C. Starting point | What is done and what is not; any local-only change or unresolved checkpoint problem |
| D. First actions | Inspect the repository; validate the worktree and branch; read the handover and the registers; compare the documented state with the code before changing anything |
| E. Scope boundaries | Permitted scope, non-goals, reserved files, affected components and dependencies |
| F. Work to resume | The next steps in order, each with acceptance criteria and the checks it needs |
| G. Coordination | The Moderator, the Guardian, related chats and pending approvals. No change to a shared component before the ownership and change-impact checks are done |
| H. Git instructions | The right continuation branch and worktree; do not overwrite the branch or make needless duplicate branches; check the branch and commit before any change; push with `git push -u origin <branch>` from that worktree with the deny-list exported |
| I. Completion requirements | Update the task state, test evidence, change ownership, documents and git records |
| J. Uncertainty warnings | Every open issue and missing piece of evidence, to investigate before trusting the handover |

Rules for the prompt:
- **No placeholders**, unless a value genuinely cannot be established. Then say exactly what must be filled in, by
  whom and how to find it.
- **No credentials and no client data.** Point to the private supplement instead.
- The prompt and the handover document must agree. If they differ, fix both before the owner pastes anything.

**The message to the owner** (owner's section 21). When the handover is ready, the outgoing chat gives the owner, in
one message:
1. a clear notice that the current chat stops implementation;
2. the exact successor chat name;
3. the continuation or handover branch name;
4. the local path of the handover document;
5. the local path of the successor prompt;
6. the GitHub links, only if verified;
7. whether the branch holds all relevant code changes;
8. any change that stays uncommitted or local-only;
9. the full prompt to paste, inline;
10. exactly what the owner does in the Claude interface: create a new chat, give it the name in point 2, paste the
    prompt in point 9, and tell MOD-02 when it is running.

## 8. Update the records, then stop

**Records** (by the outgoing chat, with MOD-02; in the handover or continuation branch, or MOD-02's docs branch):

| Record | Change |
|---|---|
| [CHAT_REGISTRY.md](../../project-control/CHAT_REGISTRY.md) | Outgoing chat: status HANDOVER REQUIRED, its handover document, its successor. Successor: a new row, status QUEUED until the owner creates it. Fields as in the owner's section 22 |
| [TASK_REGISTER.md](../../project-control/TASK_REGISTER.md) | The task's owner column (outgoing to successor), its branch and its next step |
| [ACTIVE_CHANGE_REGISTER.md](../../project-control/ACTIVE_CHANGE_REGISTER.md) | The task's branch and head; file ownership passes to the successor (not released) |
| [REPOSITORY_AND_ENVIRONMENT_STATE.md](../../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md) | The new branch and whether it is on origin |
| [INTEGRATION_AND_REGRESSION_LOG.md](../../project-control/INTEGRATION_AND_REGRESSION_LOG.md) | An incident row if anything went wrong (for example a blocked push) |
| [the handover index](../README.md) and section 9 below | The new handover document and the new prompt |
| Private supplement | Anything sensitive about the handover |

**Retirement.** MOD-02 sets the outgoing chat to RETIRED, with the reason, only after the successor has validated the
handover and the outgoing chat's outstanding work, file ownership and handover are reconciled. Until then it stays
HANDOVER REQUIRED. If a chat cannot be reached, say so in the registry; never invent its status.

**The outgoing chat then stops** (owner's section 14, item 12):
- no further code changes and no further commits in the task's worktree once the checkpoint is made;
- no new task;
- a final report to the owner (the message in section 7) and to MOD-02;
- after that it only answers questions about its own work, if asked, and writes nothing.

## 9. Index of continuation prompts

Each row is one copy-ready prompt in this folder. Add a row in the same change that adds a prompt; never delete a
row (mark it SUPERSEDED with the reason).

| Prompt | Outgoing chat | Successor | Scenario | Branch it points to | Date | Status |
|---|---|---|---|---|---|---|
| [MOD-01_TO_MOD-02_SUCCESSOR_PROMPT_2026-10-28.md](MOD-01_TO_MOD-02_SUCCESSOR_PROMPT_2026-10-28.md) | MOD-01 | MOD-02 | B | `handover/mod-01-to-mod-02-20261028` | 28 Oct 2026 | current |
| [EX-01_TASK-TA-03_SUCCESSOR_PROMPT_2026-10-28.md](EX-01_TASK-TA-03_SUCCESSOR_PROMPT_2026-10-28.md) | MOD-01 (task TA-03) | EX-01 | A | `continuation/ex-01-task-ta-03-20261027` at `0f1c5d3` | 28 Oct 2026 | current |
| [ARC-01_BOOTSTRAP_PROMPT_2026-10-28.md](ARC-01_BOOTSTRAP_PROMPT_2026-10-28.md) | none (new role) | ARC-01 | new chat | none (read-only) | 28 Oct 2026 | current |
| [NB-01_RESUME_NOTE_2026-10-28.md](NB-01_RESUME_NOTE_2026-10-28.md) | NB-01 (continues) | NB-01; NB-02 only if MOD-02 judges NB-01's context unreliable (the note's part 4 holds that prompt) | resume, not a replacement (A if NB-02 is used) | `feat/m1-4-overview` at `07a6460` (local only) | 28 Oct 2026 | current |

The owner's message for this handover (the ten items of section 7) is
[OWNER_MESSAGE_2026-10-28.md](OWNER_MESSAGE_2026-10-28.md) in this folder. It is not a prompt.

The Moderator's general start-up prompt is [MODERATOR_BOOTSTRAP_PROMPT.md](../MODERATOR_BOOTSTRAP_PROMPT.md) in the
parent folder; the dated successor prompt above is specific to the MOD-01 to MOD-02 handover. If the two disagree,
MOD-02 reconciles them and records here which one wins.

## 10. Worked example: TA-03 on 27 Oct 2026

[VERIFIED: `git log -1 0f1c5d3`, `git rev-parse 0f1c5d3^1`, `git ls-remote origin`, 28 Oct]

| Step | What happened |
|---|---|
| Trigger | The owner's stop-and-hand-over order (27 Oct, 20:55 IST); MOD-01 at 4 compactions |
| Inspection | The T5 implementer was stopped part-way. The workflow journal showed two implementer starts in the same worktree, so the content was treated as unreviewed |
| Case | A, with a caution: the T5 patch and its tests belonged to TA-03, but their review state was uncertain |
| Branch | `continuation/ex-01-task-ta-03-20261027`, from the task branch `fix/legacy-batch-3-tax-p3-r2` at `97a7d69` |
| Checkpoint | `0f1c5d3`, "WIP: checkpoint task TA-03 (tax batch part T5) for context handover", 27 Oct 20:59 IST; the message records the parent's checks, the page MD5, the one check run on the checkpoint and what is not done |
| Push and verify | Pushed; `git ls-remote origin` shows `0f1c5d3...` for the branch |
| Missing at the time | The successor prompt and the registry rows were written on 28 Oct, in this package. The checkpoint's phrase "the remaining T5 items as listed in the handover" pointed to a list that lived only in private notes. The list is now written in the [TA-03 card](../../project-control/TASK_REGISTER.md#ta-03-tax-batch-cr-0008-d-040), and EX-01 reconciles it against the patch |

Lesson: write the handover document and the successor prompt in the same session as the checkpoint, and put the
remaining-work list in the repository, not in a chat.

## 11. Change log

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version of the procedure and the prompt index |
