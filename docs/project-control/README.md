# Project control

**Written:** 28 Oct 2026 (IST) by MOD-01, as part of the handover to MOD-02 (branch
`handover/mod-01-to-mod-02-20261028`). **Kept by:** MOD-02. **Baseline when written:** `main` at `6443826`, live page
MD5 `12B5E5727FCA01EF2EA162C59913F01D`.

## 1. What this folder is

Several Claude chats work on this project at the same time: a moderator, a reviewer and implementing chats for the live
page and for the new build. Each chat forgets its history when its context fills up. This folder is how they stay in
step without relying on any chat's memory:

- who is working on what, in which worktree and branch;
- which files and shared interfaces each change touches;
- how a change is reviewed, verified, merged and accepted (gates A to E);
- what is waiting for the owner;
- what was integrated, and the last state known to be good.

It was created on 28 Oct 2026 at the owner's request of 27 Oct (REQ-075, REQ-077). Before that date this information
lived in chat transcripts and private notes only. [VERIFIED: no `docs/project-control` on `main` at `6443826`]

**Labels used in every file here.** [VERIFIED] with its evidence (a SHA, a file and line, a command); [INFERRED];
[UNCERTAIN]; [UNKNOWN]. A claim without evidence is not written as verified.

## 2. What stays authoritative

These folders **index and extend** the project's existing records. They never copy them in a way that could drift.

| Subject | Authoritative record | Role of `docs/project-control` |
|---|---|---|
| Narrative project state | [`docs/PROJECT_STATE.md`](../PROJECT_STATE.md) | none: there is deliberately no `docs/project-control/PROJECT_STATE.md`. The owner's 27 Oct folder list names one, and the same instructions say to follow the repository's conventions where they suit the project better |
| Decisions | [`docs/DECISIONS.md`](../DECISIONS.md) | [DECISION_LOG.md](DECISION_LOG.md) indexes them and holds the pending owner decisions and unapproved recommendations |
| Known issues | [`docs/KNOWN_ISSUES.md`](../KNOWN_ISSUES.md) | [KNOWN_ISSUES_AND_REGRESSION_RISKS.md](KNOWN_ISSUES_AND_REGRESSION_RISKS.md) summarises them and adds the regression-risk register |
| Change requests | [`docs/change-requests/`](../change-requests/README.md) | [REQUIREMENTS_AND_CHANGE_REGISTER.md](REQUIREMENTS_AND_CHANGE_REGISTER.md) maps each requirement to its CR and tasks |
| Checks and how to run them | [`docs/TESTING.md`](../TESTING.md) | the gates (section 6) point to it |
| Rules for every change | [`CLAUDE.md`](../../CLAUDE.md) | the gates map onto its workflow |
| Live page architecture | [`docs/legacy/ARCHITECTURE.md`](../legacy/ARCHITECTURE.md) | [ARCHITECTURE_AND_DEPENDENCY_MAP.md](ARCHITECTURE_AND_DEPENDENCY_MAP.md) maps both builds together |
| New app architecture and data model | [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md), [`docs/DATA_DICTIONARY.md`](../DATA_DICTIONARY.md) | the same map, and [INTERFACE_CONTRACTS.md](INTERFACE_CONTRACTS.md) for what both builds share |
| Monthly refresh | [`docs/MONTHLY_REFRESH.md`](../MONTHLY_REFRESH.md) | the update rule (section 9) |
| Handover documents and successor prompts | [`docs/handover/README.md`](../handover/README.md) | registers are their source of facts |
| Everything that must not be public | `C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md` (outside the repository) | never copied here |

**When two records disagree:** git wins over every document. Then the authoritative record wins for its subject. Record
the disagreement as a defect and fix it in the next docs change.

## 3. Ids and status words

- **Chats:** MOD-nn (moderator), ARC-nn (codebase integrity and integration guardian), EX-nn (live page
  implementation), NB-nn (new-build implementation). The chats today are in [CHAT_REGISTRY.md](CHAT_REGISTRY.md).
- **Workstreams:** A = the live page (`index.html`); B = the new build (CR-0006); C = coordination.
- **Tasks:** TA-nn (Workstream A), TB-nn (B), TC-nn (C), in [TASK_REGISTER.md](TASK_REGISTER.md).
- **Records:** REQ-nnn (owner requirements), CR-nnnn (change requests; next free CR-0010), D-nnn (decisions), KI-nnn
  (known issues), PD-nn (pending owner decisions), I-nn (shared interfaces), gates A to E.
- **Number ranges** for D, KI and CR are allocated by MOD-02. The table is in
  [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md); use only your own range.
- **Status words for chats:** ACTIVE, WAITING, QUEUED, BLOCKED, HANDOVER REQUIRED, COMPLETED, RETIRED, SUPERSEDED.
- **Status words for work** (the owner's list, used exactly):

| Status | Meaning |
|---|---|
| VERIFIED COMPLETE | implementation and the relevant validation are complete |
| IMPLEMENTED, NOT FULLY VERIFIED | code exists, validation is incomplete |
| IN PROGRESS | work has started and is not complete |
| PLANNED | accepted, not started |
| BLOCKED | a named input, permission, decision or dependency stops progress |
| NOT STARTED | identified work nobody has begun |
| EXISTING DEFECT | a known problem already in the application |
| UNKNOWN / NEEDS INVESTIGATION | the evidence is not enough |
| SUPERSEDED | replaced by a later requirement or decision |

Never infer success from a file existing or from another chat's claim.

## 4. Map of the registers

| File | Answers | Main ids | Update when |
|---|---|---|---|
| [README.md](README.md) (this file) | How the project is run: roles, gates, procedures | gates A to E | the operating model changes |
| [CHAT_REGISTRY.md](CHAT_REGISTRY.md) | Which chats exist, their status, worktrees, successors and context health | MOD, NB, EX, ARC | a chat starts, waits, hands over or retires |
| [TASK_REGISTER.md](TASK_REGISTER.md) | Every task, its owner chat, status, branch, evidence and next step | TA, TB, TC | a task is created, assigned, changes status or passes a gate |
| [ACTIVE_CHANGE_REGISTER.md](ACTIVE_CHANGE_REGISTER.md) | What is being changed right now, where, and what it overlaps | task ids | a branch starts, commits, is reviewed, merges or releases its files |
| [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md) | Who owns which files, the isolation rule, the merge readiness rule, the change-impact contract template, ports and number ranges | ranges | ownership, ports or ranges change |
| [REPOSITORY_AND_ENVIRONMENT_STATE.md](REPOSITORY_AND_ENVIRONMENT_STATE.md) | Remotes, branches, worktrees, hooks, CI, runtimes, and the "verify before you trust" commands | SHAs | after any push, merge, new worktree or tool change |
| [REQUIREMENTS_AND_CHANGE_REGISTER.md](REQUIREMENTS_AND_CHANGE_REGISTER.md) | Every owner requirement, its acceptance criteria and status; the CR list; every suggested improvement | REQ, CR | the owner asks for something, or a CR changes status |
| [DECISION_LOG.md](DECISION_LOG.md) | Index of decisions; the pending owner decisions in plain language; recommendations not yet approved | D, PD | a decision is made or a question is put to the owner |
| [KNOWN_ISSUES_AND_REGRESSION_RISKS.md](KNOWN_ISSUES_AND_REGRESSION_RISKS.md) | Open defects at a glance; regression risks with mitigation and owner | KI, risks | a defect is filed or fixed; a risk appears or closes |
| [ARCHITECTURE_AND_DEPENDENCY_MAP.md](ARCHITECTURE_AND_DEPENDENCY_MAP.md) | How both builds are put together and who depends on what; high-risk files | blocks, modules | a module, block, workflow or dependency changes |
| [INTERFACE_CONTRACTS.md](INTERFACE_CONTRACTS.md) | Every shared interface: owner, consumers, location, version, change rule | I-nn | a shared interface changes (after the merge) |
| [INTEGRATION_AND_REGRESSION_LOG.md](INTEGRATION_AND_REGRESSION_LOG.md) | What was merged, the last verified baseline, pending integrations, incidents, the recovery procedure and every gate record | gate rows | after every gate, merge or incident |

**Reading order for a new chat:** this README; [REPOSITORY_AND_ENVIRONMENT_STATE.md](REPOSITORY_AND_ENVIRONMENT_STATE.md)
(run its checks first); [CHAT_REGISTRY.md](CHAT_REGISTRY.md); [ACTIVE_CHANGE_REGISTER.md](ACTIVE_CHANGE_REGISTER.md);
[TASK_REGISTER.md](TASK_REGISTER.md); then the files its task needs. Each register says when it was last verified;
re-check anything older than the latest commit before acting on it.

## 5. Operating model

### 5.1 Roles

| Role | Who | Does | Does not |
|---|---|---|---|
| Owner | the product owner | decides product behaviour and financial rules; says "publish" for each monthly refresh; accepts user-visible changes; creates new chats when asked | need to run git or read diffs |
| MOD-02 | the Master Project Moderator (successor to MOD-01) | the owner's single point of contact (REQ-073); turns requests into tasks; sequences work; allocates numbers; gives "go to merge"; sets the shared-document rules; keeps these registers; explains decisions simply and relays the answers | implement product features in a task's worktree; merge over an unresolved NO-GO |
| ARC-01 | the Codebase Integrity and Integration Guardian | reviews real diffs at Gate B; checks interfaces, ownership, overlaps and tests; simulates merges; may BLOCK with a NO-GO; proposes register changes to MOD-02 | implement features; make product decisions; write in another chat's worktree |
| EX-01 | the first Workstream A implementation chat | takes over TA-03 from MOD-01, then the Workstream A tasks MOD-02 assigns; builds in its own worktree and branch; runs Gates A, C and D | start a task MOD-02 has not assigned; edit Workstream B files |
| NB-01 | the new-build implementation chat (continues under MOD-02) | builds the new app milestones (CR-0006) in its own worktrees; runs Gates A, C and D | edit `index.html` or Workstream A files |
| Specialist agents | `.claude/agents/`: financial-domain-reviewer, qa-engineer, security-release-reviewer, implementation-engineer, dashboard-archaeologist, refresh-operator | review, test, implement or refresh when an implementing chat runs them | commit, push or merge on their own |

MOD-01 (the chat that wrote this) is HANDOVER REQUIRED and becomes RETIRED once MOD-02 validates the handover (lead
ruling R-1). TA-03 ownership then sits with MOD-02 until EX-01 confirms it has taken it.

### 5.2 Who decides and who does (RACI)

R = does the work. A = accountable, has the final say. C = consulted before. I = informed after. "Implementing chat"
means EX-01 or NB-01, whichever owns the task. This table follows the lead decisions of 28 Oct and is the only full RACI
table: [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md) links here instead of repeating it,
and the short "who does what" list in [DECISION_LOG.md](DECISION_LOG.md) ruling R-4 defers to it. If any of them ever
differs, this table wins for roles and gates.

| Action | Owner | MOD-02 | ARC-01 | Implementing chat | Specialist agents |
|---|---|---|---|---|---|
| Product and financial-rule decisions | **A** | R (explains, records, relays) | C | C (proposes defaults) | C (financial-domain-reviewer) |
| "publish" of a monthly refresh | **A, R** | R (asks, shows evidence) | I | I (waits) | C (refresh-operator prepares) |
| Acceptance of user-visible behaviour (Gate E) | **A** | R (presents evidence) | C | C | I |
| Priorities, sequencing, task assignment | C | **A, R** | C | I | none |
| Number allocation (D, KI, CR ranges, task ids) | I | **A, R** | I | uses its range | none |
| Change-impact contract | I | A | C (reviews material ones before work starts) | **R** | none |
| Build in its own worktree and branch; WIP checkpoints | I | A | I | **R** | R when run (implementation-engineer) |
| Gate A implementation report | I | A (records it) | I | **R** | none |
| Gate B review: diff, interfaces, ownership, tests | I | I (escalation point) | **A, R**; may BLOCK | C | none |
| Financial review of any calculation, tax or reading rule | I | A (makes sure it runs) | C | R (runs the agent) | **R** (financial-domain-reviewer) |
| Security GO before every push and PR | I | A | C | R (runs the agent) | **R** (security-release-reviewer) |
| Push the branch (`git push -u origin <branch>` from its own worktree, deny-list exported) | I | A | I | **R** | none |
| Open the PR | I | A | C | **R** | none |
| Gate C verification, including browser and Office checks | I | A | C (may spot-check) | **R** | **R** (qa-engineer, independently) |
| "Go to merge" | I | **A, R** | C (its Gate B GO is required) | I | none |
| D-020 merge and push of `main` | I | A | I | **R**, only after MOD-02's go, green CI and ARC-01's GO | none |
| Pages verification (live MD5 equals `main`'s `index.html`; `/next/` size and SHA-256) | I | A | I | **R** | none |
| Shared-document conflict rules (DECISIONS, KNOWN_ISSUES, PROJECT_STATE, CHANGELOG, TESTING) | I | **A, R** | C | follows them | none |
| Editing those shared documents for its own change, inside its own PR | I | A | C | **R** | none |
| Registers in `docs/project-control` | I | **A, R** (single writer) | C (supplies interface and gate content) | C (supplies evidence) | none |
| Owner communication: questions, progress, ETAs | (receives) | **A, R** | through MOD-02 | through MOD-02 | none |
| Relaying an owner answer to the chat that needs it | I | **R** | I | I | none |
| A NO-GO or a dispute that MOD-02 cannot settle | **A** (final) | R (decides first, or escalates) | C | C | none |
| A chat's context handover | R (creates the new chat, pastes the prompt) | **A** | C | R (its own checkpoint and handover note) | none |

### 5.3 Rules every chat follows
1. **One task, one worktree, one branch, one writer.** Never two agents in one worktree (it happened during TA-03 T5).
2. **The main checkout stays on `main`.** It is used only for D-020 merges, one at a time, by the chat holding
   MOD-02's go. [VERIFIED: every merge since PR #2 was made on the local `main` there, `git reflog show main`]
3. **Push from the branch's own worktree** with `PRD_PRIVACY_DENYLIST` exported; first push `git push -u origin <branch>`.
   The pre-push hook runs the pushing worktree's scanner.
4. **Never** force-push, rewrite history, delete branches, stash or reset away work, or use `--no-verify`. Never commit
   client data or secrets (the repository is public). Never claim a check that was not run.
5. **`index.html` changes only through patch scripts** (D-016); the live page takes calculation, data and security fixes
   only during the parallel run (D-028); data refreshes merge only after the owner's "publish" (D-017).
6. **Merge readiness, not a fixed order:** whichever change passes Gates A to D first merges first; the second takes
   `main` and keeps both sides' rows (full rule in
   [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md)).
7. **Hand over** at 3 compactions, or when the owner reports lost context (procedure in
   [`docs/handover/README.md`](../handover/README.md)).

## 6. Gates A to E

Every material change passes these gates in order, and each gate is recorded in
[INTEGRATION_AND_REGRESSION_LOG.md](INTEGRATION_AND_REGRESSION_LOG.md) section 8. Implementation, review, integration,
verification, acceptance and deployment are separate states: a task is not accepted because its chat has finished.
The gates are the owner's (27 Oct, section 13), mapped onto the practice this repository already had.

### Gate A: implementation report
- **Who:** the implementing chat.
- **Entry:** MOD-02 assigned the task and it is in [TASK_REGISTER.md](TASK_REGISTER.md) and
  [ACTIVE_CHANGE_REGISTER.md](ACTIVE_CHANGE_REGISTER.md). For a material change the change-impact contract exists, and
  ARC-01 reviewed it before work started if it is high-risk. All work is committed on the task branch; the worktree is
  clean.
- **Exit (the report must contain):** task id with its REQ, CR and any D or KI ids used (from the chat's range);
  branch; worktree; base SHA and head SHA; for the live page, the page MD5 before and after and the patch scripts; for
  the new app, the build size and SHA-256; files changed (`git diff --stat <base>...<head>`); every check actually run,
  with its command, result, counts and time zone; the checks **not** run, said plainly; open issues and new known
  issues; whether the scope grew beyond the contract.
- **Status after:** IMPLEMENTED, NOT FULLY VERIFIED.
- **Existing practice:** CLAUDE.md workflow steps 1 to 4 and the change request record.

### Gate B: guardian and domain review
- **Who:** ARC-01, plus the financial-domain-reviewer for any calculation, tax rule or base-file reading rule, plus the
  security-release-reviewer before every push and PR.
- **Entry:** a complete Gate A report; the head commit readable locally (ARC-01 reads with `git -C` and `git show`, and
  never writes in the task's worktree).
- **ARC-01 checks:** the actual diff, not a summary; every consumer of each interface touched
  ([INTERFACE_CONTRACTS.md](INTERFACE_CONTRACTS.md)); ownership conflicts; a merge simulation (`git merge-tree`) against
  the current `main` and every other active branch; business logic duplicated across the two builds (for example the
  two tax-rule tables); the regression tests the change needs and whether they exist; the documents that must change;
  integration and recovery risk.
- **Exit:** a written GO or NO-GO with findings, each with a file and line; the financial reviewer's "approve" where
  needed; the security reviewer's GO on the staged diff. A NO-GO sends the change back to Gate A, or to escalation
  (section 8).
- **Existing practice:** CLAUDE.md rule 7 (financial review) and workflow step 6 (security review).

### Gate C: independent verification
- **Who:** the implementing chat runs the checks; qa-engineer tests independently anything a user can see.
- **Entry:** Gate B GO on the head that will be merged. The checks may run before Gate B (the TA-03 and M1.4 plans run
  browser QA first), but Gates A to C must all pass on the same final head before Gate D. Any commit after a gate
  voids it: re-run Gate B and the Gate C checks on the new head.
- **Checks** (commands and meaning in [`docs/TESTING.md`](../TESTING.md); run what the change touches, and say what
  was skipped and why):
  - live page: `node tools/check-invariants.js --expect-md5 <final MD5>`, `node tools/smoke-review.js`,
    `node tools/test-ai-analyst.js`, `node tools/run-regression.js` (in IST and in UTC); browser acceptance (TESTING
    section 4), with `family-isolation.js` and `cvs-refresh.js` where relevant; decks and workbooks opened in
    PowerPoint and Excel for any export change;
  - repository: `privacy-scan.mjs` with the deny-list exported, `docs-links.mjs`, `node --test` (IST and UTC),
    `traceability.mjs`, `node scripts/data-extract.ts --check`, `prepush-scan.mjs` with the deny-list on the final
    head, `release-check.mjs`;
  - new app: `npm ci`, `npm run typecheck`, `npm run build`, `check-next.mjs --rebuild`, `vendor-extract.mjs --check`
    (once M1.4 merges), `node tests/browser/next-spike.mjs` after build, CSP or layout changes, and
    `npm run accept:office` for exporter changes;
  - CI: a green "Dashboard checks" run on the head (a PR, or `gh workflow run "Dashboard checks" --ref <branch>`).
- **Exit:** every check listed with its result and counts; qa-engineer's verdict PASS, with any Low items listed.
- **Status after:** still IMPLEMENTED, NOT FULLY VERIFIED until the change is integrated and checked live.

### Gate D: controlled integration
- **Who:** the implementing chat, after MOD-02's go.
- **Entry:** Gates A to C passed on the same head; the PR is open with the release-check report and the contract;
  CI is green on the PR (both jobs); if `main` moved, the branch has taken `main` and Gate C was re-run; any owner
  answer the change record says must come first has come (for TA-03, CR-0008 Q17 and Q18, or the owner's acceptance of
  the safe defaults); for a monthly refresh, the owner's "publish" (Gate E comes first for refreshes); MOD-02's explicit
  "go to merge" for this PR. One merge at a time.
- **Steps:** in the main checkout, clean and equal to `origin/main`: `git merge --no-ff origin/<branch>` with the D-020
  message ([INTERFACE_CONTRACTS.md](INTERFACE_CONTRACTS.md) I-25); push `main` with the deny-list exported; then
  `release-check.mjs --after-push`.
- **Exit:** CI green on `main`; the Pages run green when the path filter triggers it; the downloaded live `/` has the
  MD5 of `git show origin/main:index.html`; `/next/` has the build's size and SHA-256, or is unchanged when the app did
  not change; the merge SHA, run ids and hashes recorded; dependent tasks told to take `main`; the task's files
  released in [ACTIVE_CHANGE_REGISTER.md](ACTIVE_CHANGE_REGISTER.md); a new baseline row in the integration log.
- **Status after:** VERIFIED COMPLETE, unless Gate E is still needed.
- **Existing practice:** D-017 and D-020; the Pages checks of [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md).

### Gate E: acceptance
- **Who:** the owner, through MOD-02.
- **Entry:** for a user-visible change, after Gate D, on the live link. For a monthly refresh, **before** Gate D, with
  the refresh log and its checks (never client data in the message).
- **Exit:** the owner's words and date recorded in the change request and the gate log. A rejection becomes a new task;
  it does not reopen a merged change silently.
- **Notes:** acceptance is recorded separately from the status word. New-app milestones are previews that are not for
  client use (D-024); MOD-02 reports each one, and formal acceptance happens at the parity sign-off (M15). [INFERRED
  from D-024 and the roadmap]

### Lighter path for documents and tooling [INFERRED; MOD-02 may change it]
A docs-only or tooling-only change still passes all five gates, but Gate B is ARC-01's quick review plus the security
GO; Gate C is `docs-links`, the privacy scan with the deny-list, `release-check` and a green CI; Gate E is needed only
when the owner asked for the document. A docs-only merge does not run Pages.

## 7. Every new requirement (the owner's 27 Oct instructions, section 26)

When the owner sends MOD-02 a requirement or a file, MOD-02 works through these 12 steps. It never forwards a request
without understanding its purpose and impact.

| Step | What MOD-02 does | Where it is recorded |
|---|---|---|
| 1. Understand it in the context of the whole project | Read it against the registers and git. If the owner asked for this before, update that REQ row instead of creating a new one | [REQUIREMENTS_AND_CHANGE_REGISTER.md](REQUIREMENTS_AND_CHANGE_REGISTER.md) |
| 2. Decide: live page, new build, or both | D-028: the live page takes calculation, data and security fixes only; presentation work goes to the new build; a live fix is carried into the new build with the same known answer | the REQ row (workstream A, B or C) |
| 3. Find dependencies and shared components | Which blocks, modules, interfaces and other builds are affected | [ARCHITECTURE_AND_DEPENDENCY_MAP.md](ARCHITECTURE_AND_DEPENDENCY_MAP.md), [INTERFACE_CONTRACTS.md](INTERFACE_CONTRACTS.md) |
| 4. Check the task register and active ownership | Is someone already changing these files? | [TASK_REGISTER.md](TASK_REGISTER.md), [ACTIVE_CHANGE_REGISTER.md](ACTIVE_CHANGE_REGISTER.md), [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md) |
| 5. Consult ARC-01 when needed | Always when a shared interface, a hotspot file or another active branch is involved, or the change is high-risk | ARC-01's note, kept with the CR |
| 6. Define the objective and acceptance criteria | Measurable "done"; allocate the CR number | the REQ row; `docs/change-requests/CR-nnnn-*.md` |
| 7. Break it into bounded tasks | Each task fits one branch, one worktree and one PR | [TASK_REGISTER.md](TASK_REGISTER.md) (TA, TB or TC ids) |
| 8. Assign each task to a chat | EX-01, NB-01, or a new chat (MOD-02 prepares the prompt; the owner creates the chat) | [CHAT_REGISTRY.md](CHAT_REGISTRY.md), [TASK_REGISTER.md](TASK_REGISTER.md) |
| 9. Give a launch packet | Task id, REQ and CR, objective and acceptance criteria, base SHA, branch name, worktree path, files the task owns and files it must not touch, interfaces and their consumers, number range, required checks and gates, report format; never a secret or client data (point to the private supplement instead) | the task's row and the chat's prompt |
| 10. Track progress and review the evidence | Compare each report with git; never accept a summary alone | [ACTIVE_CHANGE_REGISTER.md](ACTIVE_CHANGE_REGISTER.md) |
| 11. Integrate through the gates | Gates A to E (section 6); the readiness rule | [INTEGRATION_AND_REGRESSION_LOG.md](INTEGRATION_AND_REGRESSION_LOG.md) |
| 12. Update the records and handovers | Follow the update rule (section 9) | every file the rule names |

## 8. Decision escalation (the owner's 27 Oct instructions, section 27)

### 8.1 When the owner must decide
Product behaviour, financial and tax rules, what is published, anything that cannot be undone, deletions,
credentials and client data, and changes to the owner's standing rules. Technical choices inside those rules are lead
decisions that MOD-02 makes under D-033 and records as "lead, under D-033" in `docs/DECISIONS.md`.

### 8.2 How to ask
Explain it so that a 10-year-old could follow it, without hiding any real trade-off. One decision per question. Short
sentences. Every technical word is explained or replaced. Cover these points:

```text
Decision PD-nn: <a short title>
1. The problem:                  what is wrong or unknown, in one or two sentences.
2. Why a decision is needed:     what is waiting for it, and what happens if nobody decides.
3. The options:                  usually two or three.
4. What each option changes:     what users and the numbers will look like afterwards.
5. Good and bad points:          for each option.
6. Effect on what works today:   what could break or change.
7. Future upkeep:                what each option costs to maintain.
8. Risk and undo:                can it be reversed later, and how hard is that.
9. My recommendation and why:    and what I will do by default if you do not answer.
```

Put the question in [DECISION_LOG.md](DECISION_LOG.md) as a PD row before asking. Never decide for the owner.

### 8.3 After the owner answers
1. Record the answer in the owner's words, with the date: a D entry in `docs/DECISIONS.md` (from MOD-02's range, or
   the implementing chat's range when it lands in that chat's PR), and mark the PD row answered.
2. Write the exact message for the chat that needs the answer. Send it by cross-session messaging if that tool is
   available in MOD-02's session; otherwise tell the owner that the message is ready to paste. **Never claim a
   message was sent when it was not.**
3. Update the affected task, REQ and CR rows.

### 8.4 Technical disagreements and a NO-GO
1. ARC-01 gives a NO-GO with its reasons. The implementing chat fixes the findings, or answers them in writing.
2. If they still disagree, MOD-02 decides, records why, and tells both. MOD-02 may change scope or order to resolve a
   NO-GO, but it does not merge over a NO-GO that still stands.
3. If MOD-02 cannot settle it, or the question touches product behaviour, a financial rule or the acceptance of a
   known risk, MOD-02 takes it to the owner as in section 8.2. The owner's answer is final.

## 9. Update rule: which file to update when

| When this happens | Update | Who | In which change |
|---|---|---|---|
| The owner asks for something | [REQUIREMENTS_AND_CHANGE_REGISTER.md](REQUIREMENTS_AND_CHANGE_REGISTER.md) (REQ row); a CR record when it becomes a change | MOD-02 | MOD-02's docs branch, or the task's PR for the CR |
| A task is created, assigned or changes status | [TASK_REGISTER.md](TASK_REGISTER.md); [CHAT_REGISTRY.md](CHAT_REGISTRY.md) if a chat's work changes | MOD-02 | MOD-02's docs branch |
| A branch or worktree starts, commits, is reviewed or merges | [ACTIVE_CHANGE_REGISTER.md](ACTIVE_CHANGE_REGISTER.md); [REPOSITORY_AND_ENVIRONMENT_STATE.md](REPOSITORY_AND_ENVIRONMENT_STATE.md) after a push or merge | MOD-02, from the chat's report | MOD-02's docs branch |
| A material change is about to start | the change-impact contract (template in [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md)) | implementing chat | the CR record and the PR body |
| A gate is passed or failed | [INTEGRATION_AND_REGRESSION_LOG.md](INTEGRATION_AND_REGRESSION_LOG.md) section 8 | MOD-02 | MOD-02's docs branch |
| A change merges | `CHANGELOG.md`, `docs/PROJECT_STATE.md`, `docs/TESTING.md` and the CR record (in the PR); afterwards the integration log baseline, the task and active-change rows | implementing chat (PR); MOD-02 (registers) | the task's PR; then MOD-02's docs branch |
| A shared interface changes | [INTERFACE_CONTRACTS.md](INTERFACE_CONTRACTS.md); `docs/legacy/ARCHITECTURE.md` or `docs/DATA_DICTIONARY.md` | implementing chat (docs in its PR); MOD-02 (register) | the task's PR; then MOD-02's docs branch |
| A module, block, workflow or dependency changes | [ARCHITECTURE_AND_DEPENDENCY_MAP.md](ARCHITECTURE_AND_DEPENDENCY_MAP.md); `docs/ARCHITECTURE.md` or `docs/legacy/ARCHITECTURE.md` | as above | as above |
| The owner decides something | `docs/DECISIONS.md` (D entry); [DECISION_LOG.md](DECISION_LOG.md) | MOD-02, or the implementing chat in its PR | as above |
| A question is put to the owner | [DECISION_LOG.md](DECISION_LOG.md) (PD row) | MOD-02 | MOD-02's docs branch |
| A defect is found | `docs/KNOWN_ISSUES.md` (KI from the finder's range); [KNOWN_ISSUES_AND_REGRESSION_RISKS.md](KNOWN_ISSUES_AND_REGRESSION_RISKS.md) if it changes a risk | the finder; MOD-02 | the finder's next PR; MOD-02's docs branch |
| Ownership, ports or number ranges change | [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md) | MOD-02 | MOD-02's docs branch |
| A monthly refresh is done | `docs/refresh-log/YYYY-MM.md`, `data/refdata/` (regenerated), the monthly PRD in `docs/monthly-prds/`, and the "Last refreshed" line of `docs/HANDOVER.md`, which `monthly-prd-check.mjs` reads | refresh owner (EX-01 with refresh-operator) | the `data/YYYY-MM-refresh` PR |
| A chat hands over | [CHAT_REGISTRY.md](CHAT_REGISTRY.md); a dated handover under `docs/handover/` (never overwrite an older one); the private supplement for anything sensitive | the outgoing chat, with MOD-02 | a `handover/` or `continuation/` branch |
| An incident or regression | [INTEGRATION_AND_REGRESSION_LOG.md](INTEGRATION_AND_REGRESSION_LOG.md) sections 6 and 7 | MOD-02 | at once, then with the fix |

**MOD-02's docs branch** means a short-lived `docs/` branch in MOD-02's own worktree, merged through the lighter gate
path. MOD-02 never edits registers inside another chat's worktree.

## 10. Limits of this folder
- It was written from the state of git on 28 Oct 2026: `main` `6443826`, the TA-03 branch at `0f1c5d3`, the M1.4
  branch at `07a6460` (local only). Run the checks in
  [REPOSITORY_AND_ENVIRONMENT_STATE.md](REPOSITORY_AND_ENVIRONMENT_STATE.md) before relying on any SHA here.
- It is public. Session ids, private paths beyond `C:\dev\private`, client data and anything about credentials are in
  the private supplement only.
- Until the handover branch merges, these files exist only on `handover/mod-01-to-mod-02-20261028`.

## 11. Change log of this file

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version for the handover to MOD-02 |
| 30 Oct 2026 | MOD-01 (fixer pass) | Gate C entry: Gates A to C on the same final head, re-run after any later commit; section 5.2 is the only full RACI table; the MOD-01 retirement condition kept as lead ruling R-1 |
