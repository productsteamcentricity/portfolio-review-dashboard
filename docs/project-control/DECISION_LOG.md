# Decision log

**Snapshot:** 28 Oct 2026 (IST), written by MOD-01 for the handover to MOD-02 on branch
`handover/mod-01-to-mod-02-20261028` (base `main` 6443826, PR #16).
**Owner of this log from now on:** MOD-02.
**Updated:** 26 Nov 2026 (IST), written by MOD-04 (CHAT-013) on branch `docs/registers-4` (base `main` 142a91d).
PD-57 to PD-66 added; the owner's answers given between 17 and 26 Nov 2026 recorded (PD-01, PD-04, PD-16 in part,
PD-30, PD-36, PD-44, PD-54 confirmed, PD-56 changed); owner decisions without a PD number in section 2.4. Of the 66
PDs, 26 have an answer on record (PD-16 only in part: item 4 is open) and 40 stay open. **Owner of this log from now on:** MOD-04.
**Updated:** 27 Nov 2026 (IST), drafted by EX-03 (CHAT-014) for MOD-05 (CHAT-015) on branch `docs/registers-5` (base
`main` 56a25fe). PD-67 added (the 15-hour delegation of 26 Nov); the publishes of KI-032, LP-16b and KI-301 added to
PD-30; the owner's decisions of 26 and 27 Nov without a PD number added to section 2.4; the counts on the line above were not
recounted in registers-5. **Owner of this log from now on:** MOD-05.
**Updated:** 28 Nov 2026 (IST), drafted by EX-03 (CHAT-014) for MOD-05 (CHAT-015) on branch `docs/registers-8` (base
`main` 0d38184). PD-68 added (the owner's delegation of 28 Nov 2026); the owner's six answers of 28 Nov 2026 added to section 2.4.
**Updated:** 28 Nov 2026 (IST), drafted by EX-03 (CHAT-014) for MOD-05 (CHAT-015) on branch `docs/registers-9` (base
`main` b42eaae). PD-68: the decisions taken under it, and the PC's sleep from 04:28 to 12:00 IST.
**Updated:** 27 Nov 2026 (IST), drafted by EX-03 (CHAT-014) for MOD-05 (CHAT-015) on branch `docs/registers-6` (base
`main` 6973101). Section 2.4's row on the stricter matching corrected to the measured result; section 2.5 added (the
Moderator's decisions of 27 Nov 2026 with a financial meaning). The counts on the first "Updated" line were not recounted.

This log has three parts, kept apart on purpose:
1. **Approved decisions.** An index of D-001 to D-042 and the lead's handover rulings. The full text of every D
   entry is in [docs/DECISIONS.md](../DECISIONS.md), which stays authoritative. This index never replaces it.
2. **Pending owner decisions** (PD-01 to PD-68): each has a table row; PD-01 to PD-49 and PD-57 to PD-68 are also explained in plain language below; the sections for PD-50 to PD-56 are still to be written (their table rows are complete). Section 2.4 lists the owner's decisions that have no PD number; section 2.5 the Moderator's routine decisions with a financial meaning.
3. **Recommendations not yet approved.**

Evidence labels: [VERIFIED] (with the evidence), [INFERRED], [UNCERTAIN], [UNKNOWN]. Related registers:
[REQUIREMENTS_AND_CHANGE_REGISTER.md](REQUIREMENTS_AND_CHANGE_REGISTER.md) and
[KNOWN_ISSUES_AND_REGRESSION_RISKS.md](KNOWN_ISSUES_AND_REGRESSION_RISKS.md).

## 1. Approved decisions

### 1.1 Index of D-001 to D-042

"Lead" means the coordinating chat (MOD-01) acting within the owner's 14 Oct mandate, and from 22 Oct "under
D-033". "Where" says which branch holds the text. [VERIFIED: decision headings read on 28 Oct from
`origin/main:docs/DECISIONS.md`, `feat/m1-4-overview:docs/DECISIONS.md` and
`origin/continuation/ex-01-task-ta-03-20261027:docs/DECISIONS.md`. Main jumps from D-037 to D-041.]

| D | Date | Decided by | Decision (one line) | Status on 28 Oct | Where |
|---|---|---|---|---|---|
| D-001 | 14 Oct | lead | The git repository is the working folder, outside OneDrive | In force | main |
| D-002 | 14 Oct | lead | Start from a fresh git history; the previous repository's history is not imported | In force | main |
| D-003 | 14 Oct | lead | Sanitise the imported files; harden `.gitignore` | In force | main |
| D-004 | 14 Oct | lead | `tools/engine-host.js` resolves the repository, not a personal path | In force | main |
| D-005 | 14 Oct | lead | Line endings are never converted | In force | main |
| D-006 | 14 Oct | owner (approved) | Portable toolchain in `C:\dev\tools` | In force | main |
| D-007 | 14 Oct | owner (chose Pages) | Publish only `index.html` to GitHub Pages, from a workflow | In force; extended by D-024 (`/next/`) | main |
| D-008 | 14 Oct | owner | Repository ownership, public visibility, no-reply commit identity | In force | main |
| D-009 | 14 Oct | lead | Development tooling alongside the baseline | In force | main |
| D-010 | 14 Oct | lead | The code is the source of truth for implemented behaviour | In force | main |
| D-011 | 14 Oct | lead | Baseline defects are documented, not fixed | Served Stage A; fixing authorised since by CR-0005 and D-021 [INFERRED] | main |
| D-012 | 14 Oct | lead | Continuous integration on pushes to main and on PRs | In force; extended by D-034 (job `next`) | main |
| D-013 | 14 Oct | lead | Git history replaces `.pre_` backups | In force | main |
| D-014 | 14 Oct | lead | Project subagents | In force; definitions stale (TC-17) | main |
| D-015 | 15 Oct | owner (approved the change) | What a new base file clears (KI-001) | In force; the tax batch part T3 adds a reset (continuation branch) | main |
| D-016 | 15 Oct | lead | Every change to `index.html` is a committed patch script | In force; the literal replay rule refuses safely on HEAD (TA-23) | main |
| D-017 | 15 Oct | owner | Keep GitHub current; merge verified requested work after green CI; refreshes wait for the owner's review | In force; the word "publish" is Claude's proposal (PD-30) | main |
| D-018 | 15 Oct | lead | Project folder layout in OneDrive | In force | main |
| D-019 | 15 Oct | lead | What may be published from the previous owner's export; never say where client files are kept | In force | main |
| D-020 | 19 Oct | lead | Audits; PRs merged locally with `--no-ff` and an exact message | In force | main |
| D-021 | 19 Oct | owner | Accept OD-1 to OD-28 except OD-11 (keep the monitor uploads and make them correct) | In force; many items unbuilt (TA-18) | main |
| D-022 | 21 Oct | owner | Accept OD-29 to OD-36 | In force; OD-32, OD-34 built (PR #9) | main |
| D-023 | 22 Oct | owner | Publishing vendor files; drawdown on index data; portfolio 3Y and 5Y weighted; direct-equity CAGR | In force; build PLANNED | main |
| D-024 | 22 Oct | lead under D-033 (ND-3, ND-9) | Public `/next/` preview with a banner; nothing goes to clients before switch-over | In force | main |
| D-025 | 22 Oct | lead under D-033 (ND-2) | npm for the new app's build tooling | In force | main |
| D-026 | 22 Oct | owner (ND-1) and lead (class policy) | Data classes P, C, N; the MF Screener pack and its scores are never public | In force; the live FUND_RANKS question is open (PD-26) | main |
| D-027 | 21 and 22 Oct | owner's brief | The MF Screener link is the only remote URL | In force | main |
| D-028 | 22 Oct | lead under D-033 (ND-4) | The live page gets calculation, data and security fixes only during the parallel run | In force | main |
| D-029 | 22 Oct | owner (ND-5) | Missing values show a dash; sentences never use one | In force (new build); live KI-126 and KI-135 open | main |
| D-030 | 22 Oct | owner (ND-6) | Observation thresholds approved; a fund pair overlaps from 35% | In force (new build); live page UNKNOWN (PD-31) | main |
| D-031 | 22 Oct | lead under D-033 (ND-7) | 0.5 pt #D9D9D9 table borders; tan Actionables column | In force | main |
| D-032 | 22 Oct | owner (ND-8) | Capital-gains statements come in our own template | Amended by D-036 | main |
| D-033 | 22 Oct | owner (ND-10) | Claude takes charge of GitHub and the dashboard; no branch ruleset | In force; main unprotected [VERIFIED GitHub API]; its AC-22 claim is unbuilt (TB-24) | main |
| D-034 | 23 Oct | lead under D-033 | New-app toolchain and preview publishing; the preview never blocks the live page | In force | main |
| D-035 | 23 Oct | lead under D-033 | `data/refdata` generated in the repository; base-file conventions; BF-01 to BF-25 except BF-19 accepted | In force; BF-19 and BF-26 open (PD-11, PD-12) | main |
| D-036 | 23 Oct | lead under D-033 (amends D-032) | The capital-gains upload accepts the platform's export as it is | In force; design merged (PR #15) | main |
| D-037 | 24 Oct | owner (approved the result 27 Oct 11:43 IST) | Section tabs across the top | In force, live on `/next/` | main |
| D-038 | 27 Oct | lead under D-033 | Vendored libraries, the STORE zip and downloads under the CSP | IMPLEMENTED, NOT FULLY VERIFIED | `feat/m1-4-overview` only (local, unpushed) |
| D-039 | 27 Oct | lead under D-033; point 1(a) is the owner's answer of 24 Oct | Portfolio overview rules, including KI-147 "no fallback" | IMPLEMENTED, NOT FULLY VERIFIED | `feat/m1-4-overview` only (local, unpushed) |
| D-040 | 24 Oct | lead under D-033 | Live tax rules follow the TY2026-27 reckoner; defaults (a) to (h) open to the owner | IN PROGRESS (owner confirmation pending: PD-01 to PD-05, PD-44) | `continuation/ex-01-task-ta-03-20261027` only (pushed) |
| D-041 | 27 Oct | lead under D-033 | Live-page base-file reading fixes (fix batch 4) | In force, live; point 4 to be amended by D-042; question 1 pending (PD-08) | main |
| D-042 | not written | planned by the lead; EX-01 writes it | Live page "no fallback" for Crore text, amending D-041 point 4 | PLANNED (TA-05) | none yet |

### 1.2 Other id series

| Series | Meaning | Where |
|---|---|---|
| OD-1 to OD-36 | Audit decisions; accepted by D-021 and D-022 | [audits/2026-10-19-decisions.md](../audits/2026-10-19-decisions.md) |
| ND-1 to ND-10 | New-build owner decisions; recorded as D-024 to D-033 | [owner-decisions-new-build.md](../new-build/owner-decisions-new-build.md) |
| TR-1 to TR-21, LD-1 to LD-42, KA-1 to KA-22 | Capital-gains design: interpretation decisions, lead decisions, known answers | [capital-gains-upload.md](../new-build/capital-gains-upload.md) |
| BF-01 to BF-26 | Base-file parity ledger | `tests/parity/base-file-ledger.json` |
| AG-01 to AG-14 | Aggregation parity ledger | NB-01's local branch only |
| TX-01 to TX-23 | Live tax review findings; TX-nn = KI-(159+nn) | CR-0008 (continuation branch) |
| SP-01 to SP-16 | MF Screener pack validation findings | private (class N) |
| L1 to L29, N1 to N19 | NB-01's round-1 and round-2 fix decisions for M1.4 | NB-01's private working notes. N6 is covered by G1's KI-151 test [VERIFIED 4610684]; N16 to N19 appear in no commit [UNCERTAIN] |

### 1.3 Lead rulings of 28 Oct 2026 (in force for the chats; to be recorded)

MOD-01 made these rulings for the handover under D-033. They bind every chat from 28 Oct. They are not yet in
docs/DECISIONS.md: MOD-02 records them as one D entry from its range (D-046 to D-049).

**R-1. Chats.** MOD-01 = the coordinating chat (created 14 Oct, 4 compactions, HANDOVER REQUIRED; RETIRED only
after MOD-02 validates the handover). NB-01 = the new-build chat (created 22 Oct, 1 compaction, WAITING after its
state report); it continues under MOD-02 unless MOD-02 judges its context unreliable. Planned: MOD-02 (successor
Moderator), EX-01 (first dedicated Workstream A chat; takes TA-03 over from MOD-01), ARC-01 (Codebase Integrity and
Integration Guardian). Chat statuses: ACTIVE, WAITING, QUEUED, BLOCKED, HANDOVER REQUIRED, COMPLETED, RETIRED,
SUPERSEDED.

**R-2. Number allocation from 28 Oct.** Only MOD-02 allocates new ranges.

| Holder | Decisions | Known issues | Notes |
|---|---|---|---|
| EX-01 | D-042 to D-045 (D-042 = "no fallback", amending D-041 point 4) | KI-183 to KI-186 (KI-183 = prototype-key labels; KI-184 = base-file ISIN column not read) | Inherits D-040 and KI-160 to KI-182 on the TA-03 branch |
| MOD-02 | D-046 to D-049 | KI-187 to KI-189 | Allocates every new range |
| NB-01 | D-038, D-039 (on its branch), then D-050 onward | KI-150 to KI-159 (KI-150, KI-151 used on its branch), then KI-190 onward | Keeps its design ids TR, LD, KA, AG, E-, U- |
| (closed) | | KI-140 to KI-149 was fix batch 4's range | KI-148, an M1.4 follow-up, is worked by NB-01 under the M1.4 task |
| Change requests | | | Next free: CR-0010 (MOD-02 allocates) |
| Tax findings | | | TX-nn = KI-(159+nn) |

**R-3. Merge order is a readiness rule, not a fixed order.** Whichever change passes Gates A to D first merges
first. The second to merge takes main, keeps DECISIONS in number order, and keeps both sides' rows in CHANGELOG,
PROJECT_STATE, KNOWN_ISSUES and TESTING. TA-05 waits for TA-03 to merge (both patch the same engine block) and for
NB-01's exact KI-147 AG ids. The owner answered CR-0008 questions 17 and 18 (PD-02, PD-03) on 2 Nov 2026: crypto stays out
of set-off, and the "Listed AIF" funds are Category III with a safe note. The second is a behaviour change in TA-03 (T5 item 10)
that has to pass the gates before the merge.

**R-4. Who does what.** A short version. The detailed and authoritative table is
[README.md section 5.2](README.md#52-who-decides-and-who-does-raci); if the two differ, README wins.

| Action | Owner | MOD-02 | Implementing chat (EX-01 or NB-01) | ARC-01 |
|---|---|---|---|---|
| Product and financial-rule decisions | decides | explains, records, relays | builds to the answer | checks the build matches |
| Sequencing, task assignment, number allocation | informed | decides | asks | advises |
| Build and push a branch | none | informed | does it in its own worktree; `git push -u origin <branch>` with `PRD_PRIVACY_DENYLIST` set | none |
| Open the PR | none | informed | does it | reviews |
| Gate B review | none | receives the result | fixes findings | does it; may block (NO-GO) |
| D-020 merge | none | says "go to merge" | merges after the go, CI green and Gate B GO | informed (its Gate B GO is a precondition) |
| Pages check after merge | none | informed | live MD5 equals main's `index.html`; `/next/` size and SHA | informed |
| Edit shared docs in conflict | none | sets the rule | the second to merge resolves | checks nothing was lost |
| Monthly refresh "publish" | decides | asks and shows the evidence | merges only after "publish" | none |
| Disputes | final say | first escalation | raises | raises |

The repository's agents stay the specialist reviewers: financial-domain-reviewer, qa-engineer,
security-release-reviewer, implementation-engineer, dashboard-archaeologist and refresh-operator.

**R-5. Gates.** A: implementation report (task id, branch, worktree, base and head SHA, files, checks actually run,
open issues). B: ARC-01 review plus the domain reviews the change needs (financial-domain-reviewer for any
calculation or tax rule; security-release-reviewer GO before every push or PR). C: independent verification (the
full check list in [docs/TESTING.md](../TESTING.md), browser acceptance by qa-engineer for anything visible, Office
checks for PPTX or XLSX changes). D: controlled integration (PR, CI green, the D-020 merge with the exact message,
push main, Pages check, notify dependent tasks, update the registers). E: acceptance (the owner for user-visible
behaviour; a monthly refresh only on "publish"). Each gate is recorded in
[INTEGRATION_AND_REGRESSION_LOG.md](INTEGRATION_AND_REGRESSION_LOG.md) in this folder.

**R-6. Public and private.** This repository is public. Its documents never contain client names or data, PANs,
folio or account numbers, where client files are kept (D-019), a credential or its details, Screener scores or
ranks, private page links, session ids or transcript names. Those go only in the private supplement
(`C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md`).

**R-7. ARC-01's scratch worktrees.** ARC-01 is read-only, with one exception for review work: it may create
detached scratch worktrees (`git worktree add --detach .claude/worktrees/arc-01-<task>-<short-sha> <sha>`, so no
branch is made), write there only git-ignored output or a temporary page re-derivation that it restores, and remove
them itself with `git worktree remove` (never `--force`), telling MOD-02 each time it creates or removes one. This is
the only exception to "read-only work uses scratch copies outside the repository" and "worktrees are cleaned only on
the owner's word" ([FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md), worktree isolation
rules 5 and 9). [Recorded on 30 Oct from MOD-01's guardian handover of 28 Oct, section 9, which cites it as a lead
decision; MOD-02 confirms or withdraws it when it records R-1 to R-7]

**R-8. PR branch for TA-03 (TC-23), 2 Nov 2026.** MOD-02 adopts REC-03. EX-01 keeps `continuation/ex-01-task-ta-03-20261027`
untouched on origin at 0f1c5d3 as the handover checkpoint. Before its first new commit it creates
`fix/legacy-batch-3-tax-cr-0008` in the same worktree (`git switch -c`; the new branch has no upstream, so a plain push is
refused) and puts every later commit there, pushing with `git push -u origin <branch>` and the deny-list exported. No history
rewrite, no second worktree, nothing deleted, never new work on both names. The PR comes from the `fix/` branch, so
release-check does not warn. Other PRs are decided when they are opened.

**R-9. ENGINE_KEYS and KI-185, 2 Nov 2026.** MOD-02 adopts REC-06 and, on ARC-01's change C1 and EX-01's recommendation, does not
waive the I-09 same-PR rule: the TA-03 PR is to add all six names (planned, not in git yet) to ENGINE_KEYS in `tools/check-invariants.js` (the four new keys
`taxClassify`, `taxApplyAssumptions`, `taxAssumeFor`, `taxDefaults`, plus `amcKey` and `xirr`, which main lacks; 22 + 6 = 28), and
that file is listed in the change-impact contract (item 5). TA-22 moves into TA-03 and closes with it. EX-01 is to file KI-184 and
KI-185 with TA-03, KI-185 as FIXED there (planned, not in git yet). KI-183 stays reserved for TA-05; a gap in the numbering is normal.

**R-10. Re-run rule when `main` moves after the gates (CONFIRMED by ARC-01 on 2 Nov 2026, with additions).** If `origin/main`
gains commits after a branch has passed Gates A to C, the branch merges `origin/main` (a merge, never a rebase) and:
1. "Only docs" is tested, not assumed: `git diff --name-only <last head that passed Gates A to C> <new head> -- . ':!docs' ':!CHANGELOG.md'`
   must be empty. `CLAUDE.md` does not count as docs (it sets commands and counts).
2. CI is green on the new PR head, both jobs.
3. ARC-01 reviews the delta, re-runs the merge simulation and gives a new verdict bound to the new head; the
   security-release-reviewer gives a GO on the delta before the push.
4. Browser QA and the Office checks are not repeated when the page MD5 and `tools/` are unchanged (this follows from 1). Re-run:
   docs-links, traceability, the privacy scan with the deny-list, the pre-push scan on the new head, release-check and
   `check-invariants --expect-md5`.
5. The gate record (INTEGRATION_AND_REGRESSION_LOG section 8) gets the old head, the new head, the empty diff and the CI run id.
6. The rule covers `main` moving after the gates; a commit the branch adds itself voids all gates as before.
7. A docs conflict in a file the branch also changed (DECISIONS, KNOWN_ISSUES, PROJECT_STATE, TESTING, CHANGELOG): the docs
   checks plus ARC-01's review of the resolution are enough when 1 holds; re-running the full Gate C list is also safe.
Any non-docs change in `main` means the full Gate C list again.

**R-11. D-043, KI-186 and the owner's answers, 2 Nov 2026.** D-043 (EX-01's range, to be written on the TA-03 branch; not in git yet) records the
owner's answers to CR-0008 Q17 and Q18 and amends D-040 point (d). KI-186 (P3, EX-01's range) records the IRR explicit-zone
date strings: the tax batch's T2 reads a date-time with an explicit zone as the machine-local calendar day of the instant, where
main read the UTC date, so late-evening Z times read as the next day in IST and midnight Z times as the previous day west of
UTC; zone-less forms are fixed in every zone; real IRR exports with such strings are [UNKNOWN] (sample files have none). EX-01
decides in its T5 review addendum, with the financial-domain-reviewer, between a minimal fix (read the date as written) and no
code change. The new build's M3 IRR reader (not built yet) is to read a free-text date as written, the same date in every zone, and states its own rule
for strings with an explicit zone.

**R-12. The Office rule, 2 Nov 2026.** The owner's standing rule for every Office check by any chat, agent or script, now rule 10
of `CLAUDE.md`: `tasklist` first; attach only to a running instance (`GetActiveObject`, never `New-Object -ComObject`); open only
synthetic files, read-only, with no window; close only the file you opened; never `Quit`; never `Stop-Process` or `taskkill` an
Office process; change no global option; use a timeout and abandon, never kill; NOT RUN with the file path for the owner when Office
is not running or the check is risky. NB-01 must rewrite the Office scripts of M1.4 to it (ARC-01's K1; the 07a6460 and be7f395
versions break it) and run no `npm run accept:office` or `accept:office:spike` from any head until then; EX-01 applies it to its slide checks. A script that
started an Office instance is not allowed to Quit it either; whether that may ever be allowed is the owner's decision, not MOD-02's.
TA-26 covers the existing tooling and docs (the Step 3 snippet of `docs/MONTHLY_REFRESH.md` ends with `Quit()`).

**R-13. TB-08, 2 Nov 2026.** MOD-02's lead decision under D-033 (REC-01), taken in the owner's own handover prompt: NB-01 pushed its
four local-only branches (`feat/m1-4-overview` and the three fixer branches, 26 commits) as plain branches, no pull request, after
clean pre-push scans (MOD-02 re-ran all four, same counts as NB-01) and a security-release-reviewer GO (NB-01's report). Verified
afterwards with `git ls-remote origin` by MOD-02 and ARC-01.

**R-14. Numbers, 9 Nov 2026.** KI ranges: EX-01 KI-183 to KI-186 and KI-200 to KI-219 (KI-185, KI-186 and KI-200 to KI-214 are filed on the TA-03 task branch, local, and on `continuation/ex-02-task-ta-03-20261109` on origin at 8cb775e; the origin task branch is at bf411af); NB-01 KI-190 to KI-199 (KI-190 to KI-192 used on its branch); MOD-02 KI-187 to KI-189. Decisions D-042 to D-045 EX-01 (D-042 reserved for TA-05; D-043 = the owner's answers to CR-0008 Q17, Q18, Q22 and Q24, written on the same two branches). PD numbers PD-47 to PD-56 allocated on 2 and 9 Nov.

**R-15. Rule 10 amended, 9 Nov 2026.** Whose words: the owner's own rule (2 Nov): `tasklist` first; synthetic files, read-only, no window; close only the file you opened; never Quit; no global option; timeout; give the owner the path. ARC-01's K1: attach only, NOT RUN when no instance runs, no Stop-Process or taskkill, abandon on timeout. The security review's tightenings (the review points of 2 Nov, applied in PR #19, and those of 9 Nov, applied here): "synthetic" defined (from synthetic inputs, `.xlsx` or `.pptx`, never an inbox, vendor or downloaded file); only the workbook's own window may be hidden, never `Application.Visible`; `.Kill()` and any other termination; the option list is not exhaustive; never enumerate, read, copy, save or record the name or path of a document you did not open; tell the owner which file a timeout left open; "NOT RUN is never a pass". ARC-01's point of 9 Nov: a script may look for a running Office with `Get-Process -Name` (existence only, no property read) as well as with `tasklist /FI`, because both Office scripts of M1.4 do. The owner's exception (PD-49, "Allow a copy"): one script only, the Step 3 script of TA-26, may open one copy of the refresh's Monthly Outlook deck in the running PowerPoint to export its slides. The conditions are in rule 10 of CLAUDE.md, which governs: the script's SHA-256 in its own D entry on main with the Guardian's written GO for that hash; the owner's own words within the 10 minutes before each run; an in-memory pre-flight of the copy's zip and every `.rels` part; the exact deck name; a named output folder. The security reviewer, ARC-01 and the registers panel proposed these conditions of 9 Nov; they only narrow the owner's decision. Whether the script may strip the chart links in its own copy is PD-55. Rule 10 of CLAUDE.md governs; R-12 is its earlier summary.

## 2. Pending owner decisions

These are questions only the owner can answer, because they change what clients see or how a financial rule
works. None was answered by 28 Oct [VERIFIED: no answer recorded in any chat or file]. Each "Recommendation" is
Claude's advice, not a decision.

**How an answer is recorded.** The owner answers MOD-02 in chat. MOD-02 writes the answer as a D entry (from its
range) or a KI update, marks the PD here as answered with the date and the D or KI id, and relays it to the chat
that builds it (EX-01 or NB-01).

### 2.1 What to answer first

**As of 26 Nov 2026 (MOD-04).** The open owner items that hold up work: PD-16 item 4 (with the tax adviser; the M7a engine shows a dash until then), M12a question 2 (which index stands for each asset class; section 2.4), PD-07 (consistency of the slab-rate default), PD-62 (LP-14) and PD-63 (LP-11). The table below is the order of 9 Nov 2026, kept as history.

| Order | PD | Why first |
|---|---|---|
| done | PD-02, PD-03 | Answered by the owner on 2 Nov 2026 (see PD-02 and PD-03 below); they no longer block the TA-03 merge |
| 2 | PD-09 | Fix batch 5 (TA-05, D-042) and the M1.4 PR wording depend on it |
| 3 | PD-08 | The new build's merged-folio rule (KI-148) aligns to it |
| 4 | PD-20, PD-21 | The October risk-ratio step needs them before mid-November |
| 5 | PD-30 | Confirms the "publish" gate before the first refresh under the new team |
| 6 | PD-27 | The blueprint approvals the owner asked to give |
| then | the rest | Each has a safe default already built or no build waiting |

### 2.2 All pending decisions at a glance

| PD | Short question | Recommendation | Blocks |
|---|---|---|---|
| PD-01 | Accept the live tax defaults D-040 (a) to (h)? | **ANSWERED 25 Nov 2026**: "Accept all eight (Recommended)": (a) to (h) accepted as built (D-043, sign-off paragraph) | none (TA-03 merged, PR #36) |
| PD-02 | Are the "Listed AIF" funds Category III? (Q17) | **ANSWERED 2 Nov 2026:** yes, Category III, and keep a safe note | none (the Q17 change is part of TA-03) |
| PD-03 | Can crypto gains or losses be set off? (Q18) | **ANSWERED 2 Nov 2026:** keep "no set-off" | none |
| PD-04 | The other CR-0008 questions (Q2 to Q11, Q13 to Q16, Q19, Q20) | **ANSWERED 25 Nov 2026** (with PD-44): "Accept all": the built defaults stand; questions 2, 3, 13, 14, 15 and 27 go to the tax adviser (D-043) | none (adviser answers become later fixes) |
| PD-05 | Grandfathering rule for lots bought before 1 Feb 2018 (Q12) | Ask the tax adviser; until then disclose only | TA-07 |
| PD-06 | A fund holding one equity ETF: assume 90/90 on the live page? | Live: keep the default with a note; new build: analyst choice | consistency |
| PD-07 | Slab rate used to order set-off | Live: 30% labelled "assumed"; new build: no default. **Still open (26 Nov 2026):** the live page keeps its built 30% "assumed" (part of the tax batch accepted on 25 Nov); the new build keeps no default; the consistency question goes to the owner with the M7a engine | consistency; M7a engine |
| PD-08 | Holding days of one fund held in several folios (D-041 question 1) | (a) as built | KI-148 alignment |
| PD-09 | KI-147: do placeholders like "NA" count as empty? | **ANSWERED 2 Nov 2026** (typed in the app): "Yes, count as empty (Recommended)"; both builds match | none now (D-042 in TA-05; M1.4 PR wording) |
| PD-10 | KI-066: change the IPS check now on the live page? | Please choose; if no answer, keep current and build it in the new build | TA-19 |
| PD-11 | Unknown Asset Names (BF-19) | Leave "Unknown" and list | both readers |
| PD-12 | Ignore letter case in Asset Names (BF-26) | Keep folding | parity ledger |
| PD-13 | Ignore letter case in client and distributor names (L7) | Do not fold; warn | new build |
| PD-14 | A market value of 0 | Exclude and list | both readers |
| PD-15 | A blank Product Name | "Unknown" with a warning | new build |
| PD-16 | Capital-gains design §15 items 1 to 7 | **ANSWERED IN PART 26 Nov 2026**: items 1, 2, 3, 5, 6 and 7 answered ("1 Accept", "2 Short term", "3 Yes", "5 Ask the platform's support - No", "6 Confirm", "7 Confirm"; item 5 clarified the same day: "Can be genuine lots"); **item 4 open** with the tax adviser | M7a engine merge (item 4 only for its two figures) |
| PD-17 | Confirm the fix batch 2a details | Confirm | none |
| PD-18 | (record fix) KI-006 still calls OD-26 open | No action; we correct the record | TC-15 |
| PD-19 | Send the MF Screener feedback and requests | Send all three | TB-17, TB-19 |
| PD-20 | Download the public AMFI NAV file monthly | **ANSWERED 9 Nov 2026**: "Yes (Recommended)" | none (TA-20 can start) |
| PD-21 | Where the risk-ratio toolchain may live | **ANSWERED 9 Nov 2026**: "Short local folder (Recommended)", outside OneDrive and the repository | none (EX-01 names the path and restores the tools) |
| PD-22 | A question about files the previous owner held back | See the private supplement | TC-20 |
| PD-23 | Ask the previous owner for missing files | Yes | TC-20, TB-18 |
| PD-24 | Which fund one unmatched fund label means | Owner identifies | alias table (TA-09) |
| PD-25 | A note to the previous owner about one exported file | See the private supplement | TC-20 |
| PD-26 | Remove the 15 Aug FUND_RANKS scores from the live page now? | Leave until switch-over | TA-24 |
| PD-27 | Approve the new-build blueprint | Review after it is republished | TC-10 |
| PD-28 | Your requests C2 to C6: live page or new build? | Calculation items live; presentation items new build | TA-09 |
| PD-29 | Other second-export decisions | Answer before the October refresh | TA-10 |
| PD-30 | Confirm the "publish" gate | **ANSWERED 9 Nov 2026**: "Confirm (Recommended)": nothing goes live before the owner replies "publish". Publishes given since: see PD-30 below (PRs #20 to #25, #28, #32, #33, #36, #47, #50, #53); new-build sprints reach `/next/` under the standing rule of 25 Nov (section 2.4) | none |
| PD-31 | Live page: dashes in sentences and the overlap threshold | Leave both to the new build | TA-25 |
| PD-32 | Which of the previous owner's 15 promised features you still want | Owner chooses | REQ-018 |
| PD-33 | Use the Investment Reckoner as the product-bank source | Yes | TB-18 |
| PD-34 | Will you still send your own issues list? | Owner says | TC-21 |
| PD-35 | Optional: hide your e-mail address on GitHub | Optional | none |
| PD-36 | Approve each new fund or AMC alias | **ANSWERED 25 Nov 2026** for the renamed-scheme list (KI-050): "All 16, hold line 10 (Recommended)": 16 of 17 aliases approved for the new build, line 10 on hold; C4 and C5 are covered ("Those four cover it"). Later aliases still need approval one by one | M2 sprint 2a (line 10 only) |
| PD-37 | Record the AI Analyst weights as in force for now | Yes | none |
| PD-38 | Is the live deck order intended? | Leave as is on the live page | none |
| PD-39 | Deletions only you may approve | See the private supplement | TC-13 |
| PD-40 | Keep the deny-list setting permanently on this laptop? | Per push until you approve | TC-11 |
| PD-41 | An optional security step for a credential you hold | See the private supplement | none |
| PD-42 | Confirm the fix batch 4 choices | Confirm (a) to (d) | none |
| PD-43 | Tax adviser to confirm OD-28 (the debt section) | Confirm | none |
| PD-44 | The other tax defaults settled while building | **ANSWERED 25 Nov 2026** (with PD-04): "Accept all" (24 items as summarised by MOD-04, D-043) | none (TA-03 merged, PR #36) |
| PD-45 | The 26 "to be confirmed" research items of the capital-gains design | Send the top five to the tax adviser | M7 accuracy |
| PD-46 | Did you ask for anything outside these chats between 24 and 27 Oct? | Tell MOD-02 | none |
| PD-47 | A fund whose own statement gives a category: keep that, even if the performance data calls it "Listed AIF"? (follows PD-02) | **ANSWERED 2 Nov 2026**: "The fund's own statement wins and second order win is my ruling." | none (D-043 in TA-03) |
| PD-48 | The new app rounds a half-way value up like Excel (35.675 shows 35.68; the live page shows 35.67): accept in the new app? | **ANSWERED 2 Nov 2026**: "Yes, accept (Recommended)" | none (the financial-domain-reviewer's named approval is still needed at Gate B) |
| PD-49 | May the monthly refresh open the research team's Outlook deck in PowerPoint under the Office rule, or will you export the slides yourself? | **ANSWERED 9 Nov 2026**: "Allow a copy", against the recommendation: the owner amends rule 10 for one script (R-15) | TA-26 (the Step 3 script) |
| PD-50 | The AI Analyst tax signal counts for 7 points of its score; the usual-bucket class changes trim amounts, target weights, the action label and the Exit count: keep it, or mark "not assessed" until confirmed? | **ANSWERED 2 Nov 2026**: "Keep and disclose (Recommended)" | none (the disclosure goes into the TA-03 docs with ARC-01's facts) |
| PD-51 | Wider placeholder spellings ("n.a.", "n.a", "none", "not available", "--", a lone dash) count as an empty Crore cell? | **ANSWERED 9 Nov 2026**: "Yes, count as empty (Recommended)" | none (no code change; M1.4 PR) |
| PD-52 | Tax adviser: does the Income-tax Act 2025 keep the rule that a loss on virtual digital assets cannot be set off or carried forward (CR-0008 question 25)? | Ask the tax adviser; the page keeps "no set-off" (PD-03) | none |
| PD-53 | Tax adviser: should the Category III AIF sentence carry the reckoner's clause on determinate trusts (CR-0008 question 26)? | Ask the tax adviser | wording only (TA-03 stage S10 left it out) |
| PD-54 | CR-0008 question 24: does the Listed AIF ruling reach a fund linked to a Listed AIF entry only by a loose name? | **ANSWERED 9 Nov 2026**: "Restrict it (Recommended)": only the fund's own words or an exact name (ignoring "AIF" and brackets). **Confirmed 25 Nov 2026**: stage S12's word-for-word key (letter case, punctuation, brackets and "AIF" ignored) is within that answer: "Yes, that's fine (Recommended)" (D-043) | none (stage S10 in TA-03) |
| PD-55 | The Outlook deck's charts: in last cycle's deck (October 2026) 4 of the 9 charts are linked to workbooks outside the deck, so the copy check of rule 10 would say NOT RUN on it every month (tested offline on 9 Nov, no Office used). Should the Step 3 script remove those links in its own copy before opening it, or will you export the slides yourself each month? | The script removes the links in its own copy only, never in the original (rule 10 then needs one more sentence, and ARC-01 and the security reviewer review it); until then you export by hand (PD-49 option B) | TA-26, TA-10 Step 3 |
| PD-56 | Which day should the October fund performance be as on? The three monitors supplied are three different trading days: the Regular "2 November" file is Mon 2 Nov, the Direct "31 Oct" file is Fri 30 Oct, the older Regular "29 Oct" file is Thu 29 Oct. EX-01's number test over 581 funds and the NSE holiday list for 2026 (October holidays: 2 Oct and 20 Oct only) show that Fri 30 Oct was a trading day, so the last October NAV day is 30 Oct, not 29 Oct | **ANSWERED 9 Nov 2026**: "Yes, 31 Oct": the Regular and SIF monitors are downloaded again "as on 31 Oct 2026", like the Direct file (NAV day 30 Oct); the notes keep the owner's words "Performance as on 31st October"; direct-equity returns use the 30 Oct close; the true NAV day goes in the refresh log and the PR body. **CHANGED 19 Nov 2026**: "Use the 2 Nov files": Regular and SIF performance from the 2 Nov files (prices Mon 2 Nov), Direct from the 31 Oct file (prices Fri 30 Oct); the label is PD-57 | none (October refresh published, PR #21) |
| PD-57 | The October performance label: with the 2 Nov Regular and SIF files, show their true date or "31 Oct 2026"? | **ANSWERED 9 Nov 2026**: "Yes, 31 Oct 2026"; **confirmed 19 Nov 2026** for the 2 Nov files: "Show 31 Oct" (not MOD-03's default): one label, "Performance as on 31 Oct 2026" and "SIF (as on 31 Oct 2026)"; the true price days go only in the refresh log, the commit message and the PR body | none (published, PR #21) |
| PD-58 | Should clients also see the true price date (Fri 30 Oct)? | **ANSWERED 18 Nov 2026**: "No, label only" | none |
| PD-59 | PMS and AIF figures: which Investment Reckoner? | **ANSWERED 18 Nov 2026**: "Use October's" (not the recommendation); **CHANGED 19 Nov 2026**: "Yes, use November": the November Reckoner is the source for the PMS and AIF figures (P02-S02) and the product list (P02-S04); read only as zip and XML, never committed | LP-13, LP-15 (Stage 2 work: a new reader, Gates A to D) |
| PD-60 | What does "update the products" mean? | **ANSWERED 18 Nov 2026** in the owner's own words: a product database built from the Investment Reckoner, so that the full product list is available and "matched with the client file when uploaded" (REQ-083, P02-S04) | LP-15, NB-M11b (scope note, CR, Gates A to D); GIFT City (Offshore deck) still open |
| PD-61 | Risk figures: in-house from AMFI prices and the TRI files, or the Screener file? | **ANSWERED 19 Nov 2026** (final): in-house, as before ("calculate and update the MF Analysis like you were doing earlier"); it replaces the answer of 18 Nov ("Use the Screener file"), which conflicted with D-026. D-026 unchanged | none (October risk ratios published, PR #22) |
| PD-62 | Direct equity: resend the attachment, and which prices are used each month? | Resend; settle the scope | LP-14 (REQ-085) |
| PD-63 | AI Analyst footnote: wording of the data dates (the footnote and method panel borrow the performance date for analytics and risk) | Accept this month, fix later | LP-11 |
| PD-64 | Do TA-03 and M1.4 pause until Stage 0 and Stage 1 are approved, or keep their review gates moving without merging? | **ANSWERED 17 Nov 2026**: "Yes, gates only". Its approval style for routine items is superseded by PD-65 (24 Nov) | none |
| PD-65 | The owner's operating charter: autonomous full-stack development, parallel execution and project continuity | **GIVEN 24 Nov 2026** (owner instruction): the Moderator is project manager, principal architect, lead full-stack developer and integration owner; routine technical decisions are the Moderator's; the owner is asked only for business and financial logic, scope, data integrity, security and privacy, irreversible actions, spend and sprint output approvals; three-compaction succession for every chat, the Moderator too; `docs/coordination/` | none |
| PD-66 | Delegation while the owner was away | **GIVEN 25 Nov 2026, 00:57 IST** (owner instruction, about 12 hours, ended about 13:00 IST): the Moderator approves decisions on the owner's behalf ("approve all the decisions on my behalf"), recorded as "MOD-04 under PD-66", within fixed limits | none (ended) |
| PD-67 | Delegation while the owner was away, again | **GIVEN 26 Nov 2026, about 19:30 IST** ("Yes, as on 25 Nov (Recommended)"; about 15 hours, ended about 10:30 IST on 27 Nov): as PD-66, recorded as "MOD-04 under delegation (PD-67)" and, after the Moderator change, "MOD-05 under delegation (PD-67)" | none (ended) |
| PD-68 | Delegation while the owner was away, 28 Nov 2026 | **GIVEN 28 Nov 2026, about 02:05 IST** (until about 11:00 IST): the Moderator (MOD-05) takes every decision needed to keep the new build moving and may open successor chats itself; unchanged limits (nothing that is prohibited (credentials, untrusted downloads, force-push, history rewrite, data or branch deletion), no Office runs, no account settings, the live page not changed, Gate E the owner's); recorded as "MOD-05 under delegation (PD-68)" | none (ended about 11:00 IST, 28 Nov) |

### 2.3 Each decision explained

Each entry answers the same questions: what the problem is, why the owner is needed, the options, what each
changes, the good and the bad, the impact, whether it can be undone, our recommendation and why, and what it
blocks.

#### PD-01. The live page's tax defaults (CR-0008 question 1)

**ANSWERED 25 Nov 2026** (about 19:15 IST, relayed by MOD-04): "Accept all eight (Recommended)". D-040 (a) to (h) stand as built; recorded in D-043 (the sign-off paragraph). TA-03 merged in PR #36 (live page `08CAC338…`). Point (c) below: the live page keeps not reading the base file's ISIN column; KI-184's fix (TA-06, LP-03) is no longer planned, because the owner's "ISIN" column belongs to the new build's template only (section 2.4, 25 Nov 2026).

- **Problem.** The Taxation tab needed rules that the tax reckoner does not spell out. Claude chose a careful
  default for each of eight gaps: (a) count holding time up to the date of the base file's values; (b) a holding is
  long term only from the day after its anniversary; (c) a share counts as foreign only with a clear sign (an ISIN
  not starting with IN, or a foreign label). For (c), the base file's own ISIN column is not read today (KI-184; a
  fix is planned as TA-06), so in practice the page uses only the ISIN of the matched stock entry; (d) AIF Category III is taxed inside the fund, and Categories I and II
  pass through, so neither gets an investor tax figure; (e) losses are used first against the gains taxed at the
  highest rate; (f) the Rs 1.25 lakh exemption is per person per tax year, never shared across a family; (g) crypto
  is taxed at 30% for any holding period; (h) PMS is taxed per security, as if held directly.
- **Why we need you.** Tax rules decide the numbers clients see. They are your call, not Claude's.
- **Options.** A: accept all eight as built. B: change some (say which).
- **What each changes.** A: nothing more to build. B: each change is a small fix with new tests, either before the
  batch merges or in a later batch.
- **Good and bad.** A is quick and the defaults follow the financial review; the screen labels them as assumptions.
  B fits your practice more exactly but delays the batch.
- **Impact.** Every figure on the Taxation tab, the tax slides and the AI Analyst's tax signal.
- **Can it be undone?** Yes. Each default lives in one place and a later batch can change it.
- **Recommendation.** A, because the defaults are conservative and already reviewed.
- **Blocks.** The sign-off of TA-03 (the merge itself no longer waits on PD-02 and PD-03, answered on 2 Nov 2026).
- **Evidence.** [VERIFIED] D-040 and CR-0008 on the continuation branch (0f1c5d3).

#### PD-02. Are the "Listed AIF" funds Category III? (CR-0008 question 17)

**ANSWERED 2 Nov 2026.** The owner wrote: "Yes and still put a safe note". MOD-02 reads this as option A (the funds the performance
data lists as "Listed AIF", 11 today, are Category III) with a neutral caution kept on them, like "category assumed; check the AIF's
statement" (the exact wording is for EX-01 to propose, the financial-domain-reviewer to approve and the owner to see). It is a
behaviour change in TA-03 (T5 item 10: the class name and the note change on the tab and slides), so the merge waits for that change
to pass the gates. EX-01 is to record it as D-043 (amends D-040 point (d)); not in git yet. Relayed to EX-01 and ARC-01 on 2 Nov; to NB-01 (M7) through
its relay list. The text below is the question as asked on 2 Nov.

- **Problem.** The performance data lists 11 funds as "Listed AIF" but does not say their category. Category III is
  taxed inside the fund, so the investor pays nothing extra on exit. Categories I and II "pass through": the
  investor is taxed on the fund's own statement. The page treats them as I or II, and part T5 adds a neutral note:
  "category assumed; check the AIF's statement".
- **Why we need you.** Only the AIF documents or you can say which category they are.
- **Options.** A: they are Category III. B: they are Category I or II (as built). C: not known yet; keep the neutral
  note.
- **What each changes.** A: the class name and the note change on the tab and slides. B: the note can become
  definite. C: nothing.
- **Good and bad.** C is honest and safe but asks analysts to check. A or B is cleaner but must be right.
- **Impact.** Category III gets no investor-level tax figure, as before. EX-01's measurement on the standard sample book
  (2 Nov): no tax, LTCG, STCG, estimated tax, saving, harvest or total market value moves; the not-classified market value and
  gain move into a new "Fund level" amount (2.7051 to 2.0535 Cr and 0.6516 Cr) and the "Left out" wording changes
  [VERIFIED by EX-01 on a prototype; MOD-01's earlier text said "no rupee amount changes"].
- **Can it be undone?** Yes, by a small wording patch.
- **Recommendation.** C now, then confirm from the AIF documents. If you reply "accept the safe defaults for
  questions 17 and 18", TA-03 can merge once it passes its checks.
- **Blocks.** Answered on 2 Nov 2026; the TA-03 merge waits for the Q17 change (T5 item 10) to pass the gates.

#### PD-03. Can crypto gains and losses be set off? (CR-0008 question 18)

**ANSWERED 2 Nov 2026.** The owner wrote: "keep no set-off". Option A: nothing changes in code; the answer confirms part T4 and is
to be recorded in D-043 with PD-02 (not in git yet). Whether the new Act allows set-off stays a question for the tax adviser (PD-43, OD-28). The text below
is the question as asked on 2 Nov.

- **Problem.** Under the old law, a crypto loss could not reduce any gain, and other losses could not reduce a
  crypto gain. The page keeps that rule (part T4): no set-off either way, and a crypto loss is never suggested as a
  tax-harvest sale.
- **Why we need you.** The new Act may or may not keep this; it needs an approved source.
- **Options.** A: keep "no set-off" (as built). B: allow set-off (needs a source and a code change).
- **What each changes.** A: nothing. B: a patch, new tests and a financial review.
- **Good and bad.** A is the careful reading; if the law now allows set-off, A shows slightly more tax than due.
  B may be right but cannot be built without a source.
- **Impact.** Only clients holding crypto or other virtual digital assets.
- **Can it be undone?** Yes.
- **Recommendation.** A until the tax adviser answers.
- **Blocks.** Nothing now: answered on 2 Nov 2026.

#### PD-04. The other CR-0008 questions, each with a built default

**ANSWERED 25 Nov 2026** (about 19:30 IST, with PD-44): "Accept all". The owner first replied "I'll go through them"; MOD-04 sent a plain list of the 24 built defaults, and the owner accepted all of them. Questions 2, 3, 13, 14, 15 and 27 go to the tax adviser; their answers become later fixes (D-043).

- **Problem.** The tax review left questions where Claude built a default. In short: Q2 ELSS units can be sold from
  the day after the third anniversary; Q3 a 29 Feb purchase turns long term on 1 Mar; Q4 which marker real base
  files carry for foreign shares; Q5 which equity ETF fund-of-funds are 90/90 (see PD-06); Q6 US treasury and US
  debt fund-of-funds are international fund-of-funds; Q7 AMC year-end classifications for some hybrid and other
  funds, or approve the reckoner's usual bucket; Q8 SIFs get their own rows; Q9 what labels real files give gold and
  silver funds and balanced hybrids; Q10 whether every base file has one Valuation Date column; Q11 how the IRR
  sheet records a scheme merger; Q13 whether each client is one taxpayer, and how to treat HUF, minor, spouse and
  joint holdings; Q14 30% slab and 0 exemption used as defaults, and whether to add surcharge and cess; Q15
  long-term losses against section 197 gains before section 198 gains; Q16 no part of the Rs 1.25 lakh for AIF
  Category I or II listed-equity gains; Q19 always say "tax years"; Q20 the AI Analyst shows "n/a" for fund-level or
  unsplit holdings.
- **Why we need you.** Several are facts about your files or practice; some need the tax adviser.
- **Options.** A: accept the defaults. B: answer any you wish to change.
- **What each changes.** A: nothing. B: a small fix per changed answer.
- **Good and bad.** A keeps the batch moving; each default is shown on screen as an assumption. B is more exact.
- **Impact.** Edge cases of the Taxation tab.
- **Can it be undone?** Yes.
- **Recommendation.** A, and send Q2, Q3, Q13, Q14 and Q15 to the tax adviser.
- **Blocks.** Nothing (the defaults are built).

#### PD-05. Grandfathering for equity bought before 1 Feb 2018 (CR-0008 question 12)

- **Problem.** For equity bought before 1 Feb 2018 the law lets the 31 Jan 2018 price stand in as the cost, which
  lowers the taxable gain. The page has no 31 Jan 2018 prices, so today it only tells the analyst which lots are
  affected.
- **Why we need you.** The exact formula, the section of the new Act, and a trusted price source must come from you
  or the tax adviser.
- **Options.** A: give us the rule and the price source, and we build it. B: keep disclosing only.
- **What each changes.** A: a new price table and a calculation (TA-07). B: nothing.
- **Good and bad.** A gives correct tax on old lots but needs reliable 2018 prices. B overstates the gain on old lots,
  and says so.
- **Impact.** Clients with equity lots bought before 2018.
- **Can it be undone?** Yes.
- **Recommendation.** Ask the tax adviser; keep B until then.
- **Blocks.** TA-07.

#### PD-06. A fund that holds one equity ETF (the 90/90 question)

- **Problem.** A fund-of-funds that holds a single equity ETF may count as equity for tax ("90/90"). The live page
  assumes it does. The new build asks the analyst instead (TR-6, TR-18).
- **Why we need you.** The two builds should not quietly disagree on a tax class.
- **Options.** A: keep the live default with a visible note; the new build keeps the analyst's choice. B: an analyst
  choice in both. C: the default in both.
- **What each changes.** A: nothing. B: a new input on the live page. C: a change to the new design.
- **Good and bad.** A needs no new live input, which D-028 discourages, but the builds differ. B makes them match but
  adds work to the live page. C matches them but removes the analyst's control.
- **Impact.** Tax class of a small number of funds.
- **Can it be undone?** Yes.
- **Recommendation.** A [INFERRED].
- **Blocks.** Consistency between the builds only.

#### PD-07. The slab rate used to order set-off

**Still open (26 Nov 2026).** The live page keeps its built 30% "assumed" (part of the tax batch the owner accepted on 25 Nov 2026 under PD-01 and PD-44). The new build keeps no default (D-036 point 3). The two builds still differ; MOD-04 puts the consistency question to the owner with the M7a engine work.

- **Problem.** To decide which gains a loss is used against first, the page needs the client's slab rate. The live
  page assumes 30% and labels it. The new build shows a dash until the analyst sets it (D-036 point 3).
- **Why we need you.** The builds differ on a default.
- **Options.** A: live 30% "assumed", new build no default. B: 30% in both. C: no default in both.
- **What each changes.** A: nothing. B or C: a change in one build.
- **Good and bad.** A keeps the live page working without input; the new build forces a conscious choice. B or C
  makes them match at some cost.
- **Impact.** Only the order of set-off for slab-rate gains.
- **Can it be undone?** Yes.
- **Recommendation.** A [INFERRED].
- **Blocks.** Consistency only.

#### PD-08. Holding days of one fund held in several folios (D-041 question 1)

- **Problem.** When one fund is held in several folios, the page shows one line. Which "Avg. Holding Days" should
  that line carry?
- **Why we need you.** It is a reporting convention; the answer applies to both builds.
- **Options.** (a) The oldest folio's age, counted to the file's own date, blank when the folios disagree (as built;
  6 merged holdings show blank on today's files). (b) An average weighted by units. (c) The first row's figure (the
  old behaviour).
- **What each changes.** (a) nothing. (b) a new calculation in both builds. (c) a step back on the live page.
- **Good and bad.** (a) is never misleading but is sometimes blank. (b) always has a figure but mixes ages. (c)
  depends on row order.
- **Impact.** Only the workbook's "Base File" sheet; no calculation reads it [VERIFIED D-041].
- **Can it be undone?** Yes.
- **Recommendation.** (a).
- **Blocks.** The new build's alignment (KI-148, in NB-01's G1 work).

#### PD-09. KI-147: do placeholders count as empty?

- **Problem.** You said "no fallback": if the Crore cell is not a number, the holding is invalid, left out and
  listed. Some files put "NA", "N/A", "-" or "nil" in the Crore cell and the real amount in the Lakh or rupee
  column. Should such a placeholder count as an empty cell (so we read Lakh, then rupees), while any other text
  makes the holding invalid? The new build does this (D-039 points 1(b) and 1(c)); the live page will do the same
  in D-042.
- **Why we need you.** Your words did not mention placeholders; this is Claude's reading.
- **Options.** A: yes, placeholders count as empty. B: no, placeholders also make the holding invalid.
- **What each changes.** A: as planned. B: holdings with "NA" in Crore but a number in Lakh drop out and are listed,
  in both builds.
- **Good and bad.** A keeps holdings that do have an amount, the same way a blank cell works. B follows your words
  literally but may leave out good holdings.
- **Impact.** Both readers. D-039 point 1 applies the rule to invested value, market value and gain alike, so D-042
  should do the same for all three [VERIFIED D-039 text on `feat/m1-4-overview`].
- **Can it be undone?** Yes, in both builds.
- **Recommendation.** A, so both builds match.
- **Blocks.** TA-05 (D-042) and the wording of the M1.4 PR.

#### PD-10. KI-066: the IPS compliance check

- **Problem.** The live page's IPS check can give wrong verdicts (a P0 defect). On 19 Oct you accepted OD-13:
  measure on market value including hybrid funds' parts, and show a dash where unlisted holdings are not covered.
  Later, an answer in the previous owner's second-export intake said "keep the current IPS logic for now". It is
  not certain that answer was yours [UNCERTAIN].
- **Why we need you.** Two instructions point different ways.
- **Options.** A: build OD-13 on the live page now. B: keep the current check on the live page and build OD-13 in
  the new build (M7).
- **What each changes.** A: a live-page batch (TA-19). B: nothing on the live page; the defect stays open and listed.
- **Good and bad.** A fixes a wrong verdict sooner. B avoids changing a familiar output during the parallel run but
  leaves a known P0 on the live page.
- **Impact.** The IPS compliance table and slides.
- **Can it be undone?** Yes.
- **Recommendation.** Please choose. If there is no answer, B, because it is the later instruction; the defect stays
  visible in KNOWN_ISSUES.
- **Blocks.** TA-19.

#### PD-11. Asset Names the reader does not know (BF-19)

- **Problem.** Some files use Asset Names such as Gold, Equity Funds, Alternatives, Cash, Real Estate or
  International, which are not one of the five classes.
- **Why we need you.** Mapping them is a classification choice.
- **Options.** A: show "Unknown" and list them. B: give us a map from each name to a class.
- **What each changes.** A: nothing. B: a map in both readers and new tests.
- **Good and bad.** A never invents a class but leaves an "Unknown" row. B gives cleaner allocation if the map is
  right.
- **Impact.** Allocation tables in both builds.
- **Can it be undone?** Yes.
- **Recommendation.** A (never invent).
- **Blocks.** The base-file parity ledger entry BF-19.

#### PD-12. Ignore letter case in Asset Names (BF-26)

- **Problem.** "equity" and "Equity" were two rows. Both builds now treat them as one.
- **Why we need you.** It changes how data is grouped; you may prefer exact labels.
- **Options.** A: keep folding. B: stop folding in both builds.
- **What each changes.** A: nothing. B: a change in both readers.
- **Good and bad.** A avoids split rows (a wrong number). B shows labels exactly as written.
- **Impact.** Allocation rows.
- **Can it be undone?** Yes.
- **Recommendation.** A.
- **Blocks.** The parity ledger.

#### PD-13. Ignore letter case in client and distributor names (L7)

- **Problem.** If one file writes a client as "Client One" and "CLIENT ONE", is that one client or two? The new build keeps
  them apart and warns; the live page keeps them apart.
- **Why we need you.** Merging two names wrongly would merge two people.
- **Options.** A: do not fold; warn (as built). B: fold.
- **What each changes.** A: nothing. B: a change in the new build, and a parity entry.
- **Good and bad.** A never merges two people by mistake but can show a split column. B is tidier but risks a wrong
  merge.
- **Impact.** Client and distributor tables.
- **Can it be undone?** Yes.
- **Recommendation.** A [INFERRED].
- **Blocks.** The new build only.

#### PD-14. A market value of 0

- **Problem.** Is a 0 in the market value column "no value given" or a real zero?
- **Options.** A: treat it as no value: leave the holding out and list it (like OD-8). B: treat it as a real zero.
- **What each changes.** A: a listed exclusion. B: a zero row in the totals.
- **Good and bad.** A never hides a missing value. B keeps every row but may show a false zero.
- **Impact.** Both readers. **Can it be undone?** Yes.
- **Recommendation.** A. **Blocks.** Consistency of both readers.

#### PD-15. A blank Product Name

- **Problem.** No rule says what to do when Product Name is empty.
- **Options.** A: "Unknown" with a warning. B: another rule you prefer.
- **What each changes.** A: as built in the new build [INFERRED]. B: a change.
- **Good and bad.** A never guesses. B may fit your files better.
- **Impact.** Product tables in the new build. **Can it be undone?** Yes.
- **Recommendation.** A [INFERRED]. **Blocks.** The new build only.

#### PD-16. Capital-gains design, the seven open items (capital-gains-upload.md §15)

**ANSWERED IN PART 26 Nov 2026** (about 13:40 IST, the owner's table reply to MOD-04). Items 1, 2, 3, 5, 6 and 7 are answered; item 4 stays open.
- Item 1, "Accept": the dated rule table is adopted for M7 (in place of OD-17's bands and OD-2's single test).
- Item 2, "Short term": a sale on the anniversary day is short term; the long-term figure is shown beside it.
- Item 3, "Yes": the reader may number the distinct PANs in memory only.
- Item 5: the owner first replied "Ask the platform's support - No". Asked what that meant, after MOD-04 explained that identical lot rows can be two genuine lots (for example two SIP instalments bought the same day for the same amount) or the export printing one lot twice, the owner answered "Can be genuine lots" (26 Nov 2026, about 16:00 IST). So identical rows get no suggested answer: the analyst decides each repeated group, and the year stays INSUFFICIENT EVIDENCE until then.
- Item 6, "Confirm": the FY 2024-25 exemption order (12.5% gains first) is confirmed.
- Item 7, "Confirm": the usual bucket for hybrid funds from tax year 2026-27 is confirmed.
- Item 4 (open): the owner pasted a general explanation of the cost-inflation index and the old indexation formula. It does not settle the two specific points (the FY 2016-17 index value in the 1981 series, and whether the old-law choice applies per lot or on the year total, before or after set-off), so they stay with the tax adviser. Until then the engine shows a dash and reads per lot, with the year total shown.

- **Problem.** The approved design for the new build's capital-gains upload leaves seven items: (1) use a dated
  table of the law instead of the older OD-17 bands and OD-2's single test; (2) is a sale exactly on the anniversary
  short term (courts differ); (3) may the reader number the distinct PANs in a file, in memory only, to group one
  person's lots, discarding each PAN at once and never storing, logging or exporting it; (4) two questions for the
  tax adviser (an old cost-inflation index value and how one old rule applies); (5) ask the platform's support
  whether its export repeats lot rows on purpose; (6) the order for applying the Rs 1.25 lakh exemption in FY
  2024-25 (the client-favourable order is built); (7) the "usual bucket" for hybrid funds from tax year 2026-27 (the
  live page already matches).
- **Why we need you.** Items 1 to 3 are policy, 4 and 5 need outside answers, 6 and 7 are lead defaults for you to
  confirm.
- **Options and changes.** Accept or change each; a change alters the M7 build before it starts.
- **Good and bad.** Accepting lets M7 start on a reviewed design; changing later costs rework.
- **Impact.** The new build's Taxation section. **Can it be undone?** Yes, before and after M7.
- **Recommendation.** 1 accept; 2 keep OD-2 (short term) until the tax adviser answers; 3 yes; 4 and 5 ask; 6 and 7
  confirm.
- **Blocks.** TB-14 (M7). The defaults let the code start.

#### PD-17. Confirm the fix batch 2a details (CR-0007)

- **Problem.** While fixing batch 2a Claude settled small details: which placeholder labels mean "AMC not given";
  extra former-name spellings of fund houses; "IIFL Wealth" is not an alias; the workbook keeps the uploaded label;
  "AMC not given" stays inside the mutual-fund total.
- **Options.** A: confirm. B: change any.
- **What each changes.** A: nothing. B: a small live-page fix.
- **Good and bad.** A is already tested in the browser. B fits your preference.
- **Impact.** AMC labels on the live page. **Can it be undone?** Yes.
- **Recommendation.** A. **Blocks.** Nothing.

#### PD-18. A record to correct (KI-006 and OD-26)

- **Problem.** KI-006 still calls OD-26 an "open owner question", but you accepted OD-1 to OD-28 on 19 Oct.
- **What we will do.** Treat OD-26 as accepted and not yet built, and correct the record (TC-15). No answer is
  needed unless you object.
- **Blocks.** Nothing.

#### PD-19. MF Screener: feedback and requests

- **Problem.** The first Screener packs were checked on 23 Oct. Claude drafted 16 points of feedback, one request to
  accept a limit on price history, and one request for fund-of-funds holdings (without them the look-through has no
  real data). The details are private because the packs are class N (D-026); see the private supplement.
- **Why we need you.** You own the relationship with the Screener owner.
- **Options.** A: send all three. B: hold.
- **What each changes.** A: better packs in later months. B: M10 and M12 keep working on synthetic data only.
- **Good and bad.** A costs a message. B delays real-data use.
- **Impact.** The new build's Screener metrics and fund-of-funds look-through.
- **Can it be undone?** Not applicable.
- **Recommendation.** A. **Blocks.** TB-17 real data and TB-19 fund-of-funds data.

#### PD-20. Monthly download of the public AMFI NAV file

- **Problem.** The fund risk ratios need a monthly NAV history file that AMFI publishes for everyone.
- **Options.** A: Claude downloads it each month. B: you supply it.
- **What each changes.** A: the October risk step can run. B: the step waits for your file.
- **Good and bad.** A is automatic and the data is public. B keeps every download in your hands.
- **Impact.** MF_RISK on the live page (otherwise it stays at 30 Sep). **Can it be undone?** Yes.
- **Recommendation.** A. **Blocks.** TA-20.

#### PD-21. Where the risk-ratio toolchain may live

- **Problem.** The previous owner's risk-ratio tools arrived on 23 Oct. Your "No" to the question about where to
  keep them was unclear.
- **Options.** A: a short local folder outside the cloud-synced project folder and outside the repository. B:
  somewhere else you name.
- **What each changes.** A: Claude restores the tools there and updates the runbook. B: the same, elsewhere.
- **Good and bad.** A avoids sync problems and keeps tools out of the public repository.
- **Impact.** The monthly risk step. **Can it be undone?** Yes.
- **Recommendation.** A. **Blocks.** TA-20.

#### PD-22. Files the previous owner held back

See the private supplement. **Blocks:** TC-20.

#### PD-23. Ask the previous owner for missing files

- **Problem.** Some files never arrived: the August 2026 Outlook deck, the AIF Performance file, the base-file
  headers workbook, a blank Portfolio Cost workbook, the risk-free-rate note and the Investment Reckoner.
- **Options.** A: ask for them. B: do without.
- **What each changes.** A: fuller data for the refresh and the product bank. B: those parts stay manual or empty.
- **Good and bad.** A costs one message (which must not mention any plan for the existing dashboard).
- **Impact.** The product bank (M11) and some live-page data. **Can it be undone?** Not applicable.
- **Recommendation.** A. **Blocks.** TC-20, TB-18.

#### PD-24. Which fund one unmatched fund label means

- **Problem.** One fund label (a "Contra" fund name) could not be matched to a fund. The label and where it was seen
  are in the private supplement.
- **Options.** You name the fund, or tell us to leave it unmatched.
- **What each changes.** A named fund becomes an approved alias (OD-5). Unmatched stays blank with a note.
- **Impact.** One fund's matching. **Can it be undone?** Yes.
- **Recommendation.** Please name it. **Blocks.** The alias work in TA-09.

#### PD-25. A note to the previous owner about one exported file

See the private supplement. **Blocks:** TC-20.

#### PD-26. The 15 Aug FUND_RANKS scores in the live page

- **Problem.** The live page has carried MF Screener scores and ranks dated 15 Aug since before the handover. D-026
  says new Screener scores never go public.
- **Options.** A: leave them until switch-over and never add newer ones. B: remove them now.
- **What each changes.** A: nothing. B: a live-page patch; the AI Analyst and MF Analysis lose that input.
- **Good and bad.** A keeps live features working; the old scores stay public. B ends the exposure but removes
  features analysts use.
- **Impact.** AI Analyst and MF Analysis on the live page.
- **Can it be undone?** B can be reversed only by re-adding the data.
- **Recommendation.** A (the lead's view). **Blocks.** TA-24.

#### PD-27. Approve the new-build blueprint

- **Problem.** You asked for the new build's design by section so you can approve each one. The page has 17
  sections and 83 sub-items; no approval is recorded, and some statuses on it are out of date.
- **Options.** A: approve, ask for changes, or comment, section by section. B: approve the whole.
- **What each changes.** Your approvals guide NB-01's later milestones.
- **Good and bad.** Section by section is slower but catches changes early.
- **Impact.** The whole new build. **Can it be undone?** Yes, until each part is built.
- **Recommendation.** MOD-02 republishes the page with current statuses first; then approve section by section.
- **Blocks.** TC-10 (REQ-069). The page link is in the private supplement.

#### PD-28. Your requests C2 to C6: live page or new build?

- **Problem.** On 23 Oct you asked for: C2 hybrid funds' debt parts in the average YTM and duration; C3 the top 20
  issuers with every rating group so the total is 100%; C4 and C5 the ICICI fund aliases; C6 the monthly PMS and AIF
  performance files embedded. D-028 lets the live page take calculation and data fixes only.
- **Options.** A: calculation and data items on the live page, presentation-only parts in the new build. B: all in
  the new build only.
- **What each changes.** A: a live-page batch (filed as CR-0010). B: the live page stays as is until switch-over.
- **Good and bad.** A gives better numbers sooner; B avoids more live-page change.
- **Impact.** Debt analytics, issuer tables, matching, PMS and AIF performance. **Can it be undone?** Yes.
- **Recommendation.** A [INFERRED]: C2, C3, C4 and C5 on the live page (each alias approved under OD-5), C6 through
  the monthly refresh. **Blocks.** TA-09.

#### PD-29. Other decisions from the second export

- **Problem.** The second export raised: local use of some test files from it (their nature is in the private
  supplement); who owns data protection; whether to embed the 31 Aug PMS file in the October refresh; what client
  deliverables are expected (question 22); how analysts move from the previous owner's site (question 24).
- **Options.** Answer each, or leave the defaults (no local use; no change).
- **Impact.** The October refresh and test data. **Can it be undone?** Yes.
- **Recommendation.** Answer before the October refresh. **Blocks.** TA-10.

#### PD-30. Confirm the "publish" gate

**ANSWERED 9 Nov 2026** (see the table). **Publishes the owner gave since** (each merged by the Moderator under D-020 after the Guardian's Gate D, the live page checked against `main` afterwards):

| Date | Owner's words | What went live | PR |
|---|---|---|---|
| 19 Nov 2026 | "Publish" | October refresh (analytics and performance) | #21 |
| 21 Nov 2026 | "Publish October Fugures" (as typed) | October risk ratios | #22 |
| 22 Nov 2026 | "Publish 40 funds now" | CR-0010 A1, 40 funds' analytics | #23 |
| 23 Nov 2026 | "Publish slides now" | 6 October Market Update slides | #24 |
| 23 Nov 2026 | "Publish fixes" | CR-0010 A2, A3, A2b | #25 |
| 23 Nov 2026 | "Publish" | M1.4 portfolio overview to `/next/` | #20 |
| 25 Nov 2026 | none: MOD-04 under PD-66 | CR-0010 A4 (SWOT international terms) | #28 |
| 25 Nov 2026 | "Publish when green (Recommended)" | LP-16, KI-051 non-MF classifier | #32 |
| 25 Nov 2026 | "Publish after LP-16 (Recommended)" | CR-0010 A5 (Indian-ISIN shares domestic) | #33 |
| 25 Nov 2026 | "Publish when green (Recommended)" | TA-03 tax batch | #36 |
| 26 Nov 2026 | "Publish now (Recommended)" | KI-032, the IRR client join (CR-0011) | #47 |
| 27 Nov 2026 | "Publish KI-301" | KI-301, the cashflow file's since-inception sheets (CR-0013); PD-67 had ended, so it waited for the owner's word | #53 |
| 27 Nov 2026 | "Publish when green (Recommended)", given 26 Nov | LP-16b, the platform's Product Name values (CR-0012) | #50 |

From 25 Nov 2026 new-build sprint outputs reach `/next/` under the owner's standing rule (section 2.4) without a separate "publish"; the live page still needs the owner's word each time.

- **Problem.** Claude proposed that a monthly data refresh reaches the live link only after you review it and reply
  "publish". You never objected, but you never typed it either.
- **Options.** A: confirm. B: change (for example, merge after checks without asking).
- **What each changes.** A: nothing. B: refreshes go live without your review.
- **Good and bad.** A keeps you in control of client-facing numbers at the cost of a day's wait. B is faster.
- **Impact.** Every monthly refresh. **Can it be undone?** Yes.
- **Recommendation.** A. **Blocks.** TA-10.

#### PD-31. Live page: dashes in sentences and the overlap threshold

- **Problem.** You approved two new-build rules: no dashes inside sentences (D-029) and a fund pair overlaps from 35%
  (D-030). The live page still has dashes in some generated sentences (KI-126, KI-135) and uses 40%.
- **Options.** A: change both on the live page. B: leave both to the new build (D-028).
- **What each changes.** A: a live-page batch. B: nothing until switch-over.
- **Good and bad.** A brings the live page in line sooner. B avoids presentation work on a page being replaced.
- **Impact.** Observation and SWOT text; overlap flags. **Can it be undone?** Yes.
- **Recommendation.** B [INFERRED]. **Blocks.** TA-25.

#### PD-32. The previous owner's 15 promised features

- **Problem.** The previous owner promised 15 features that never shipped. Some overlap with your brief. The list is
  in [previous-owner-and-requirements.md §2.4](../new-build/inputs/previous-owner-and-requirements.md) and mapped in
  the requirements register, section 6.3.
- **Options.** Keep, drop or defer each.
- **Impact.** Scope of the new build. **Can it be undone?** Yes.
- **Recommendation.** Mark each one; unmarked ones stay out of scope. **Blocks.** REQ-018.

#### PD-33. The Investment Reckoner as the product-bank source

- **Problem.** Your brief builds the product bank from the Investment Reckoner. On 20 May the previous owner had
  decided to ignore the Reckoner as a data source.
- **Options.** A: yes, use it (reverses the old rule). B: no.
- **Good and bad.** A follows your brief; it needs the Reckoner file each month (PD-23). B needs another source.
- **Impact.** M11 product bank. **Can it be undone?** Yes.
- **Recommendation.** A. **Blocks.** TB-18.

#### PD-34. Your own list of issues with the existing dashboard

- **Problem.** On 16 Oct you said you had found several issues and would share them. The list has not arrived.
- **Options.** Send it, or tell us it is no longer needed.
- **Impact.** The live-page backlog and the new build's scope.
- **Recommendation.** Send it if you still have it. **Blocks.** TC-21.

#### PD-35. Optional: hide your e-mail address on GitHub (OD-25)

- **Problem.** An e-mail address appears in old public commit history (KI-098). A GitHub setting stops new
  exposures.
- **Options.** Turn on "Keep my email addresses private", or not.
- **Impact.** Privacy only. **Can it be undone?** Yes.
- **Recommendation.** Optional; turning it on is harmless. **Blocks.** Nothing.

#### PD-36. Approve each new fund or AMC alias (OD-5)

**ANSWERED 25 Nov 2026** (about 15:05 IST) for the 17-line list of renamed schemes (KI-050): "All 16, hold line 10 (Recommended)". Lines 1 to 9 and 11 to 17 are approved for the new build (`data/owner/fund-aliases.json`, M2 sprint 2a, one test per line); each alias covers the Regular and Direct plans of the same scheme. Line 10 is on hold. The owner also confirmed that the 23 Oct requests C4 and C5 are lines 1, 4, 15 and 17, four ICICI schemes: "Those four cover it". The live page keeps today's matching (the D-028 exception of 25 Nov, section 2.4). Any later alias still needs its own approval.

- **Problem.** An alias tells the page that two names mean the same fund. A wrong alias matches the wrong fund.
- **Options.** Approve or reject each alias as it is proposed (for example the ICICI aliases in C4 and C5).
- **Impact.** Fund matching. **Can it be undone?** Yes.
- **Recommendation.** Approve per alias. **Blocks.** TA-09.

#### PD-37. The AI Analyst weights (KI-029)

- **Problem.** The AI Analyst's signal weights were a proposal awaiting sign-off. You said keep them "for now".
- **Options.** A: record them as in force for now (not signed off). B: sign them off. C: change them.
- **Impact.** AI Analyst signals. **Can it be undone?** Yes.
- **Recommendation.** A. **Blocks.** Nothing.

#### PD-38. The live deck order (KI-014)

- **Problem.** In the downloaded deck, AI Analyst and Taxation come after the Annexure divider, unlike the tab order.
- **Options.** Keep as intended, or ask for a fix.
- **What each changes.** A fix would be presentation work on the live page, which D-028 sends to the new build.
- **Recommendation.** Keep on the live page; the new build orders slides by its manifest [INFERRED].
  **Blocks.** Nothing.

#### PD-39. Deletions only you may approve

See the private supplement. **Blocks:** TC-13.

#### PD-40. Keep the deny-list setting permanently on this laptop

- **Problem.** Before any push, a scan checks for private names using a private list. The scan finds the list
  through a setting (`PRD_PRIVACY_DENYLIST`). Today the setting must be typed before each push; if forgotten, the
  scan runs only its general rules.
- **Why we need you.** Making it permanent changes a setting on your machine.
- **Options.** A: set it once as a user setting. B: keep setting it before each push.
- **What each changes.** A: every push is scanned fully. B: depends on each chat remembering.
- **Good and bad.** A is safer and simpler; it is a lasting machine setting. B changes nothing on the machine.
- **Impact.** Every push to the public repository. **Can it be undone?** Yes, by removing the setting.
- **Recommendation.** Per push until you approve A; we recommend approving A. **Blocks.** TC-11.

#### PD-41. An optional security step for a credential you hold

See the private supplement. **Blocks:** nothing.

#### PD-42. Confirm the fix batch 4 choices (CR-0009)

- **Problem.** Fix batch 4 is live. Claude made some choices for you to confirm: (a) the live page skips "Total"
  rows, while the new reader reads them with a warning; (b) "Commodities" is read as Commodity; (c) a blank Asset
  label stays Equity on the live page (the new reader says Unknown); (d) a fund held in several folios where one
  folio has no units is left unsplit in Taxation, with the reason; (e) a Crore cell with text fell through to Lakh
  or rupees, which your "no fallback" answer replaces (see PD-09 and D-042).
- **Options.** Confirm or change each of (a) to (d).
- **What each changes.** A change is a small live-page fix plus a parity-ledger update.
- **Good and bad.** Confirming costs nothing; each choice is already tested and recorded.
- **Impact.** Base-file reading on the live page. **Can it be undone?** Yes.
- **Recommendation.** Confirm (a) to (d). **Blocks.** Nothing (built).

#### PD-43. The tax adviser to confirm OD-28

- **Problem.** OD-28 (which section the debt-fund tax row cites) was answered from your tax reckoner: section 76 of
  the new Act (old 50AA). It is recorded only on the tax branch.
- **Options.** Ask the tax adviser to confirm, or accept the reckoner.
- **Impact.** One citation on the tax tab. **Can it be undone?** Yes.
- **Recommendation.** Accept the reckoner and let the tax adviser confirm when convenient. **Blocks.** Nothing.

#### PD-44. The other tax defaults settled while building

**ANSWERED 25 Nov 2026** (with PD-04): "Accept all" (D-043). Also on 25 Nov: every bond carries the label "US-dollar bonds (through LRS)" (section 2.4), so every bond shows no tax figure, with its reason, until tax-adviser question 27 is answered: "Yes, for now".

- **Problem.** Besides PD-01 and PD-04, D-040 lists defaults Claude settled while building, for you to confirm:
  usual buckets for hybrid funds and SIFs (dated from 1 Apr 2026 by part T5); the 90/90 single-ETF fund-of-funds
  (PD-06); SIF rows; the ELSS lock-in to the third anniversary; how REIT funds are recognised; the order for finding
  the valuation date; classes for units bought before 1 Apr 2023; the scope of the 1 Feb 2018 disclosure;
  per-client slab and exemption inputs; the order when gains tie in set-off; the section 198 rows; three kinds of
  holding that are not split; holdings with no client name treated as one person; and the words "tax years".
- **Options.** Accept as built, or change any.
- **What each changes.** A change is a small fix with tests.
- **Good and bad.** Accepting lets TA-03 close; each default is reviewed and labelled.
- **Impact.** Edge cases of the Taxation tab. **Can it be undone?** Yes.
- **Recommendation.** Accept as built. **Blocks.** TA-03 sign-off only.

#### PD-45. The 26 "to be confirmed" research items of the capital-gains design

- **Problem.** The reviewer listed 26 points of tax law that could not be confirmed from primary sources (counted 28
  Oct in capital-gains-upload.md §10.9). Each shows a dash or a flag in the new build until confirmed.
- **Options.** Send them to the tax adviser, or leave them flagged.
- **What each changes.** Each confirmed item removes a dash or a flag.
- **Good and bad.** Asking costs the adviser's time; leaving them keeps some old-year figures blank.
- **Impact.** Mostly sales in older tax years. **Can it be undone?** Not applicable.
- **Recommendation.** Send the five the reviewer ranked first (the FY 2016-17 index; the FY 2024-25 exemption order;
  dividend stripping; the "listed" flag for close-ended schemes; ETF fund-of-funds sold in FY 2018-19). Leave the
  rest flagged. **Blocks.** Nothing now; accuracy of M7 for old years.

#### PD-46. Requests made outside these chats

- **Problem.** No owner message appears in either chat between 24 Oct 02:08 IST and 27 Oct 11:43 IST. If you asked
  for anything elsewhere in that time, it is not recorded.
- **Options.** Tell MOD-02 about any such request, or confirm there was none.
- **Recommendation.** A one-line reply to MOD-02. **Blocks.** Nothing.

#### PD-47. Which category wins when the file states one? (follows PD-02)

**ANSWERED 2 Nov 2026** (typed in the app): "The fund's own statement wins and second order win is my ruling." That is option A, and EX-01's three-step rule: the fund's own words; then the category of the matched entry; then the Listed AIF ruling (Category III, marked); else Category I or II assumed. Recorded in D-043 in the owner's words.
- **Problem.** You ruled that the funds the performance data lists as "Listed AIF" are Category III. Some client files state a
  category for a fund (Category I, II or III) in their own words, and it might differ from the ruling.
- **Why we need you.** It is a reading of a financial rule. ARC-01 asked that you see it in one sentence.
- **Options.** A: the file's own words win; the ruling applies only to a fund with no stated category. B: the ruling always wins.
- **What each changes.** A: a fund stated as Category I or II stays pass-through, no mark. B: it would be shown as Category III.
- **Recommendation / default.** A (the conservative reading, and the one EX-01 designed). Built that way unless you say otherwise.
- **Can it be undone?** Yes, by a small patch. **Blocks.** The wording of TA-03 item 10 and D-043.

#### PD-48. Half-way rounding in the new app (D-039 point 13)

**ANSWERED 2 Nov 2026** (typed in the app): "Yes, accept (Recommended)". Accuracy note from ARC-01 (who ran both rules in node): the two builds differ for values that are half-way when read to 15 digits (35.675 gives 35.68 in the new app against 35.67 on the live page; 9.995 gives 10.00 against 9.99); at 2.675 and 0.125 both agree. The effect is still only the last digit.
- **Problem.** A value exactly half-way between two roundings (35.675%) shows 35.68% in the new app, as Excel does, and 35.67% on the
  live page. It changes only the last digit and only at exact half-way values.
- **Why we need you.** It changes a figure clients may see. The lead decided it in a fix round; no approval is on record (ARC-01's K2).
- **Options.** A: accept in the new app (preview only). B: make the new app show what the live page shows.
- **Recommendation / default.** A. Built that way; the new app is a preview (D-024). **Blocks.** M1.4 Gate B.

#### PD-49. The Outlook deck and Office (October refresh, Step 3)

**ANSWERED 9 Nov 2026** (typed in the app): "Allow a copy": option A, against the recommendation (B). The owner amends rule 10 so that one script may open a COPY of the research team's deck read-only through the running PowerPoint. Written into rule 10 (R-15). The Step 3 script is TA-26.
- **Problem.** Step 3 of the refresh renders the research team's Monthly Outlook deck in PowerPoint to check every slide. Your Office rule
  allows only synthetic files, and PowerPoint is usually open on your PC.
- **Options.** A: the refresh attaches to your open PowerPoint, opens a copy of the deck on a short local path, read-only, no
  window, closes only that copy, never Quit. B: you export the slides yourself and put them in the inbox folder. C: skip the check.
- **Recommendation / default.** B (not chosen). Until the amendment of rule 10 is on main, ARC-01 has reviewed the Step 3 script and its SHA-256 is in its D entry, Step 3 is NOT RUN.
- **Blocks.** TA-10 Step 3 and TA-26.
- **Later (22 Nov 2026).** For the October Market Update slides the owner chose a render of the Reckoner PDF by Windows' built-in PDF renderer ("Yes, 6 now", section 2.4); no PowerPoint was used. The December runbook (LP-19, PR #39) uses the same route.

PD-50 to PD-56: the plain-language sections are still to be written; their table rows in section 2.2 are complete.

#### PD-57. The October performance label

**ANSWERED 9 Nov 2026**: "Yes, 31 Oct 2026". **Confirmed 19 Nov 2026** for the 2 Nov files: "Show 31 Oct".
- **Problem.** After PD-56 changed (the Regular and SIF files are as on Mon 2 Nov, the Direct file as on Fri 30 Oct), the page could show each block's true date or one label for the month.
- **Answer.** One label for all: "Performance as on 31 Oct 2026" and "SIF (as on 31 Oct 2026)" (MOD-03's default was the true date per block; the owner chose otherwise). The true price days go only in the refresh log, the commit message and the PR body, as PD-58 says.
- **Effect.** The October refresh went live with this label (PR #21, 19 Nov 2026).

#### PD-58. The true price date for clients

**ANSWERED 18 Nov 2026**: "No, label only". Clients see the label only (PD-57); the true price days are recorded in the refresh log, the commit message and the PR body.

#### PD-59. The source of the PMS and AIF figures

**ANSWERED 18 Nov 2026**: "Use October's" (not the recommendation). **CHANGED 19 Nov 2026**: "Yes, use November" (the original recommendation).
- **Effect.** The November Investment Reckoner is the source for the PMS and AIF figures (P02-S02, LP-13) and for the product list (P02-S04, LP-15). It is read only as zip and XML and never enters the repository. A new reader is Stage 2 work through Gates A to D.

#### PD-60. What "update the products" means

**ANSWERED 18 Nov 2026** in the owner's own words (not the recommendation, which was to change nothing now).
- **Meaning.** Build a database of products from the Investment Reckoner, so that the full product list is in the dashboard and client holdings are "matched with the client file when uploaded" (REQ-083, P02-S04).
- **Effect.** Stage 2 work: a scope note, a CR, a new reader reviewed by the Guardian, Gates A to D (LP-15 on the live page; NB-M11b in the new build). GIFT City products (the Offshore deck) were not named and stay open.

#### PD-61. The source of the risk figures

**ANSWERED 19 Nov 2026** (final): in-house, as before.
- **History.** On 18 Nov the owner answered "Use the Screener file". That conflicted with D-026 point 2 (the owner's own rule ND-1), so it was held as pending confirmation and nothing changed. On 19 Nov the owner sent the October benchmark data and asked to "calculate and update the MF Analysis like you were doing earlier". MOD-03 read this as the in-house toolchain, which replaces the 18 Nov answer.
- **Effect.** D-026 unchanged. The October risk ratios were computed in-house and went live on 21 Nov 2026 (PR #22).

#### PD-62. Direct-equity returns: the price source

**Open.** The owner is asked to resend the direct-equity attachment and to settle which prices are used each month (REQ-085). Recommendation: resend; settle the scope. **Blocks.** LP-14.

#### PD-63. The AI Analyst footnote dates

**Open.** The AI Analyst footnote and method panel borrow the performance date for analytics and risk. Recommendation: accept this month, fix later. **Blocks.** LP-11.

#### PD-64. Pause or gates only before Stage 0 and Stage 1

**ANSWERED 17 Nov 2026**: "Yes, gates only". Finished work (TA-03, M1.4) kept moving through its review gates without merging, and no new development started before Stage 0 and Stage 1 were approved. On 23 Nov the owner's "Yes, merge it" for registers-3 (PR #26) also allowed a docs-only records PR to merge with the gates. PD-65 (24 Nov) replaced this approval style for routine items.

#### PD-65. The operating charter

**GIVEN 24 Nov 2026** (owner instruction: a pasted charter of 19 sections, "Autonomous full-stack development, parallel execution and project continuity").
- **What it changes.** How the work is run, not what is built. The Moderator becomes project manager, principal architect, lead full-stack developer, integration owner and model and agent orchestrator, and codes directly. Routine technical decisions are the Moderator's and need no owner question.
- **What still goes to the owner.** Business and financial logic, scope, data integrity, security and privacy, irreversible actions, spend, and sprint output approvals (demonstrated, explicit).
- **How.** A coding map, dependency classes A, B and C, interface contracts and file ownership before substantial new module work (`docs/coordination/`); parallel workstreams; continuous execution; three-compaction succession for every chat, the Moderator included.
- **Unchanged.** Rule 10, the privacy and deny-list rules, the public-repository rules, no force-push, live-page publishes only on the owner's word, and the approved financial methods.
- **First use of the succession rule.** On 25 Nov 2026 CHAT-006 (MOD-03) handed over early to CHAT-013 (MOD-04) under its §9.3 (CHAT_SUCCESSION_REGISTER).

#### PD-66. The 12-hour delegation of 25 Nov 2026

**GIVEN 25 Nov 2026, 00:57 IST** (owner instruction): while away, the owner handed approvals to the Moderator chat for the next 12 hours ("approve all the decisions on my behalf"), asked that the build not stop, and asked for a realistic timeline of the full build in the morning. It ended about 13:00 IST.
- **Limits recorded with it.** Nothing prohibited (credentials, untrusted downloads, force-push, history rewrite, data deletion); no owner-only account settings; no Office runs (rule 10: owner-run only); live-page publishes only with every gate passed and low client risk; new-build outputs could merge to `/next/` but Gate E stayed with the owner; anything material and irreversible waited.
- **Decisions taken under it** (recorded as "MOD-04 under PD-66"): the CR-0010 A4 publish (PR #28; one SWOT statement, low client risk); M2.1 sprint 1 to `/next/` (PR #30; the owner accepted it at Gate E later that morning); one privacy allow-list entry for LP-16's generated `data/refdata/PRODUCT_CLASS_RULES.json`, of the same class as the existing generated refdata entries, checked by the security reviewer at Gate B. The tax batch was not published under it: PD-01, PD-04, PD-44 and PD-54 were kept for the owner.

#### PD-67. The 15-hour delegation of 26 Nov 2026

**GIVEN 26 Nov 2026, about 19:30 IST** (answer card: "Yes, as on 25 Nov (Recommended)"): while away for about 15 hours, the owner again handed routine approvals and business defaults with a recommended answer to the Moderator. It ended about 10:30 IST on 27 Nov.
- **Limits recorded with it.** As PD-66: nothing prohibited, no account settings, no Office runs, no data deletion, nothing material and irreversible; new-build merges to `/next/` continued; Gate E acceptances waited for the owner.
- **Across the Moderator change.** The delegation carried over to CHAT-015 (MOD-05) when it took over on 26 Nov; decisions after that were recorded as "MOD-05 under delegation (PD-67)".
- **Decisions taken under it:**
  - A price dated after the review's as-on date is never used in the new build's performance figures (no look-ahead); the latest point on or before it is used, labelled with its own date. (Moderator MOD-04, 26 Nov 2026.)
  - P2P lending in the product-class rules: class OTHER, asset class Debt, following the owner's answer "Debt" of 26 Nov 2026. (Moderator MOD-04, 26 Nov 2026.)
  - No live-page publish was made under PD-67. KI-301 (PR #53) was ready after the delegation ended and was published on the owner's own word of 27 Nov 2026 ("Publish KI-301"); LP-16b (PR #50) was published under the owner's own "Publish when green" of 26 Nov 2026.
- PD-67 ended about 10:30 IST on 27 Nov 2026. Gate E acceptances were not taken under it.

#### PD-68. The delegation of 28 Nov 2026

**GIVEN 28 Nov 2026, about 02:05 IST** (one message typed in the Moderator's chat): "I will not be available for the next 8-9 hours; work and coding on the new build shouldn't stop in the meantime; I want moderator to handle all the decisions in that time and choose the most logical and best course of action keeping the end goal and user and use case in mind." "I want moderator to start new chat in case context is full for some chats in the meantime as well"
- **Effect.** The Moderator (MOD-05) takes every decision needed to keep the new build moving until about 11:00 IST on
  28 Nov 2026 and may open successor chats itself. Unchanged limits: nothing that is prohibited (credentials, untrusted downloads, force-push, history rewrite, data or branch deletion),
  no Office runs, no account settings, the live page not changed, Gate E the owner's.
- **The window in practice.** The PC lost mains power at 04:24 IST and slept from 04:28 to 12:00 IST, so the window
  gave about two and a half hours of work (about 02:05 to 04:28 IST).
- **Decisions taken under it** (28 Nov 2026, IST):
  - About 02:26: the merge of PR #68 was held, although its checks were green, because the Guardian's own build of the
    same commit differed by 42 bytes. At 02:28 the cause was found: the reviewer's worktree used another worktree's
    library folder, which changes three comment lines of the built page and nothing else. PR #68 merged; PR #71
    removed the cause. (MOD-05 under delegation (PD-68).)
  - 02:30 to 02:45, routine: the tax chat's next piece approved (one tax view for a review, not on screen); one format
    for coverage percentages ("80.0%"); the footnote wording change goes to the chat that owns the file. (MOD-05 under delegation (PD-68).)
  - About 02:55: the build-script fix given to CHAT-014, with the Guardian's review (PR #71). (MOD-05 under delegation (PD-68).)
  - About 03:10: how the owner's "month labels" answer is applied. A month's data counts when its own date is on or
    before the review date, or when the review date is on or after the month's last weekday; otherwise the previous
    month is used (30 and 31 Oct use October's data; 29 and 15 Oct use September's). A first reading ("the month's
    data counts when the review date is in the month's last 7 days") was not accepted: the owner named no width, and
    a review dated 25 Oct would use a price of 30 Oct, after the review date. Not on screen yet. **To be confirmed by
    the owner.** (MOD-05 under delegation (PD-68).)
  - About 03:35: the base-file template (not merged yet): the Account Name fields accepted as proposed (read, kept and
    shown only); anything shaped like a PAN in the Account Name cell is removed when the file is read, and counted.
    Display only; no figure moves. (MOD-05 under delegation (PD-68).)
  - About 03:50: tax round 2c merges with one rarer case recorded as an open limit (KI-340: a many-into-one merger on
    the same day as another switch is still computed as a sale), to be fixed before the tax engine is put on screen. (MOD-05 under delegation (PD-68).)
- The merge of PR #72 at about 12:00 IST came after the window had ended and is not under PD-68: it was merged under
  the standing `/next/` rule (the owner's decision of 25 Nov 2026), as PROJECT_STATE records.

### 2.4 Owner decisions without a PD number (17 to 28 Nov 2026)

Answers and instructions the owner gave in chat that have no PD number. Recorded from the Moderator's owner-decision record (MOD-03, then MOD-04). Quotes are the owner's words or the answer card chosen.

| Date | Decision | Owner's words | Effect |
|---|---|---|---|
| 17 Nov 2026 | Stage 0 plan | "Approve Stage 0 plan" | Plan approved |
| 18 Nov 2026 | Stage 0 baseline | "Approve baseline" | `3e7f977` (PR #19) is the Stage 0 baseline, local tag `stage0-baseline-3e7f977`; D-046 is reserved for it and not yet written |
| 18 Nov 2026 | Stage 1 start (TA-10) | "Update the performance for the review dashboard as of October, 2026" | The October refresh started; not a "publish" |
| 19 Nov 2026 | Priority | "Update the analytics to October as a first priority task", then "Update the analytics and performance as of October" (first priority) | Analytics first, then performance (published 19 Nov, PR #21) |
| 19 Nov 2026 | One-time script runs for the October risk ratios | "Yes, allow", then "Yes, allow it" | Only the six Guardian-reviewed risk scripts, then one run of the risk workbook writer, each hash-checked just before its run, with an execution-policy bypass for that one process; no persistent policy change; no Office |
| 19 Nov 2026 | Market Update slides | "The 2 new plus 6"; **changed 22 Nov**: "Yes, 6 now" | 6 slides (label "Nov 2026") rendered from the Reckoner PDF by Windows' PDF renderer, no PowerPoint; the 2 pager pages wait for a PDF or pictures; published 23 Nov (PR #24) |
| 22 Nov 2026 | Other Funds analytics (CR-0010, option A revised) | "Yes, go ahead" | Sprint approval for A1 to A3; published in PRs #23 and #25 |
| 22 Nov 2026 | New build | "Start working on the new build on the side" | Read as approval of sprint P03-S01 (finish M1.4) and CHAT-009 NB-02 |
| 23 Nov 2026 | registers-3 | "Yes, merge it" | PR #26 merged |
| 23 Nov 2026 | One Office rule in CLAUDE.md (M1.4 fix 1) | "Yes, allow it" | The duplicate new-build Office paragraph replaced by a pointer to rule 10; rule 10 unchanged |
| 23 Nov 2026 | Gate E, M1.4 | "Accept it" | Sprint P03-S01 complete |
| 23 Nov 2026 | M2 | "Yes, start M2" | M2 (P03-S02) approved, split into sprints, each through Gates A to E |
| 25 Nov 2026 | ISIN in the client base file | "Yes, heading below" (ISIN first, name fallback); then "No ISIN column"; then, replacing that: the client file's column "will be ISIN", and the owner offered to update the template | The new build reads a column headed "ISIN" (letter case ignored), ISIN first, name fallback. Reference ISINs come from the AMFI NAV file (funds) and the stock-returns file (shares) |
| 25 Nov 2026 | Scope of the revamped base file template | "Template only" (after: "Let the current dashboard stay as is as its soon going to be replaced") | The revamped Client Base File Template, with its "ISIN" column, is for the **new build only**; the live page and its template download stay as they are. LP-03 (TA-06, live-page ISIN reading, KI-184) is dropped. Live-page fixes already queued continue (A4, TA-03, LP-16, A5) |
| 25 Nov 2026 | Labels for non-MF products (D-7) | "Use type you used to describe the funds above as Labels" | Six labels: "GIFT City funds", "Offshore funds", "US-dollar bonds (through LRS)", "Fixed deposits", "REITs and InvITs", "Unlisted shares"; never classed as MF. Live first (LP-16, PR #32), the new build ports the same answers (M2.2) |
| 25 Nov 2026 | Rupee bonds and NCDs: a separate "Bonds and NCDs" label? | "No, keep as recorded" (not the recommendation) | Every bond, NCD and debenture keeps "US-dollar bonds (through LRS)"; the template proposal drops a separate "Bonds" value. **Changed 26 Nov 2026** (the platform's Product Name values, below): rupee bonds and NCDs get their own label |
| 25 Nov 2026 | Bonds and tax | "Yes, for now" | Bonds show no tax figure, with the reason, until tax-adviser question 27 (D-043) |
| 25 Nov 2026 | Gate E, M2.1 sprint 1 | "Accept it" | Complete on `/next/` (PR #30) |
| 25 Nov 2026 | Order of the fund-matching corrections: an exception to D-028 | "New build first (Recommended)" | The new build makes the matching corrections first (ties left unmatched, KI-036; approved aliases, KI-050; KI-051 as ported); the live page keeps today's matching until switch-over. KI-051 stays on the live page through LP-16 |
| 25 Nov 2026 | Standing rule for `/next/` | "Yes, standing (Recommended)" | The Moderator merges each new-build sprint to `/next/` once Gates A to D have passed (Guardian GO, Gate C, Gate D, CI), without a separate "publish"; Gate E stays the owner's, reviewed weekly; the live page still needs the owner's word each time |
| 25 Nov 2026 | M12a drawdown method, questions 1, 3, 4 and 5 | "Accept defaults (Recommended)" | Monthly rebalancing to today's weights; month-end points; one common period with its dates shown; months to recover counted from the trough. Question 2 (which index stands for each asset class) is still open |
| 25 Nov 2026 | Gate E, M2.3a, M3a and M7a reader | "Accept all three on /next/" | Complete (PRs #31, #34, #35) |
| 26 Nov 2026 | Gate E, M10 | "Accept M10 on /next/" | Complete (PR #37); wiring waits on its pre-wiring conditions |
| 26 Nov 2026 | Item 6: one known-answer run of the month-parameterised risk scripts | "Yes, allow (Recommended)" | One offline run only, of the 11 Guardian-reviewed files, each hash-checked before it runs, with an execution-policy bypass per process, nothing persistent, no Office, no network, plus three negative tests; then the Guardian's final GO. The run itself started under the owner's words typed in CHAT-007, "Yes, run it once", because that chat's permission check needs the owner's own words |
| 26 Nov 2026 | Q-12: SheetJS 0.20.2 | "Yes, download it (Recommended)" | One download from the official site, its SHA-256 recorded in `app/vendor/MANIFEST.json`, Guardian review; the pinned-version change is recorded against D-025 and D-034. Fixes CVE-2023-30533 and CVE-2024-22363 and allows the monitor upload buttons |
| 26 Nov 2026 | Fund-matching strictness (OD-5), option B | "Go ahead with the Stricter regime" (the owner also asked why 21 funds would show as not matched) | Option B on in the new build. A follow-up fix to name normalisation ("S&P", "(Formerly Known as ...)", "And" against "&"), measured in `tests/parity/matching-corrections-ledger.json` (CR-0006): of the 22 correct official names that option B left unmatched it recovered 20, and it lost 2 others, so 4 correct names stay unmatched (blank, never wrong): UTI Focused Fund (30 stocks); Navi Nifty Smallcap 250 Momentum Quality; Kotak Infrastructure & Economic Reform Fund, Standard Plan; Baroda BNP Paribas Best-in-Class Strategy Fund. They are a known gap; the owner approved five alias lines for the four names on 28 Nov 2026 (section 2.4); they match once those lines are on main. Corrected in registers-6: this cell said the follow-up "recovers the 21 correct names" |
| 26 Nov 2026 | Test build target | "I want to start testing on the new build within 2 weeks maximum" | Test build 1 on `/next/` by Thu 10 Dec 2026: matched holdings and the import report (M2 wired), performance (M3b), returns and XIRR (M3a wired), and their sheets |
| 26 Nov 2026 | PD-16 item 5: repeated lot rows | "Can be genuine lots"; then "Repeating lot rows- this issue can be clarified against the total number of units from the holding report." | The Moderator's earlier reading (that the platform export does not repeat lot rows by design, with the suggested answer "once") is withdrawn. Owner, 26 Nov 2026: "Can be genuine lots". Repeated groups are checked against independent units evidence (redemption units in the transactions file for sold lots, the holding report's units for open lots); the supported reading is suggested with its evidence and the analyst confirms; with no evidence or conflicting evidence the analyst is asked with no suggestion |
| 26 Nov 2026 | KI-032 live fix (the IRR client join) | "Careful variant match (Recommended)"; "Yes, counts only (Recommended)"; "Before 13 Dec (Recommended)" | Live page: the exact name first, else a unique name variant (salutations ignored, entity and holder words equal, unique both ways, named in a note), else no join, with a note. A local, read-only, counts-only measurement on real files was allowed and later waived. Target: live before 13 Dec; publish on the owner's word (PR #47) |
| 26 Nov 2026 | Transactions (IRR) file template for the new build | "Easier fix for this is we can create an XIRR template as well similar to the base file template which will have the name of the client included in the file."; "Client Code might not be available; join just on the names as they would be unique" | The new build gets a blank transactions file template whose client names match the base file exactly; the join stays exact names only (D9); no client code column. A name in one file with no match in the other is listed with a note, never joined by similarity (PR #57) |
| 26 Nov 2026 | KI-032 kept on the live page | "Yes, keep the live fix (Recommended)" | The live fix continues as a safety net until switch-over, beside the new build's exact join |
| 26 Nov 2026 | New-build base file template, final | "design a template for the new build which can be downloaded from the platform so everyone knows what to upload"; "only keep columns which are absolutely necessary"; Portfolio Type: "Not needed in review" | A 17-column base file template for the new build, as the platform exports it; it replaces the 25 Nov proposal |
| 26 Nov 2026 | The platform's Product Name values | "Treat Global Exposure as both Offshore Funds and Gift City Funds"; "Rupee bonds and NCDs (Recommended)"; P2P Lending: "Debt; but it won't be there in any of the portfolios" | Global Exposure: GIFT City funds when the name says GIFT or IFSC, else Offshore funds. "Bonds": rupee bonds and NCDs on the domestic listed bond rows; "US-dollar bonds (through LRS)" only when the product or name says USD, US or LRS. P2P Lending: Debt. Unlisted-Direct: unlisted shares; AIF-Listed: a Listed AIF (D-043). **Changes** the 25 Nov answer on bond labels (above). Live: LP-16b (PR #50); new build: M2.2 |
| 26 Nov 2026 | Model of the next Moderator | "Yes, next chat on Fable" | The next Moderator chat (CHAT-015, MOD-05) runs on the Fable model; MOD-04 stayed on its model until the handover |
| 26 Nov 2026 | Standby Moderator | "Yes, open it now (Recommended)" | CHAT-015 (MOD-05) opened on standby, to take over only on the active Moderator's handover message |
| 26 Nov 2026 | Moderator change | "Handover to the new moderator" | CHAT-013 (MOD-04) handed over to CHAT-015 (MOD-05) on 26 Nov 2026, about 20:40 IST; CHAT-013 is a historical record that only forwards notes |
| 27 Nov 2026 | Successor chats for the Guardian and NB-02 | "Open both" | CHAT-016 (ARC-04, successor of CHAT-008) and CHAT-017 (NB-05, successor of CHAT-009) opened on 27 Nov 2026; both took over that day |
| 28 Nov 2026 (about 02:25 IST) | Five alias lines (18 to 22) for the four unmatched funds | "Approve all five (Recommended)" | Approved for the new build's alias file with a test per line; the live page is not touched |
| 28 Nov 2026 (about 02:25 IST) | The returns note | "Yes, add it (Recommended)" | "Returns up to one year are absolute; returns over one year are annualised." under every performance table and in the workbook's Read Me, new build |
| 28 Nov 2026 (about 02:25 IST) | A fund under one year old | "Absolute, and say so (Recommended)" | Its since-inception return is shown as an absolute return, marked (KI-302), new build; financial review required |
| 28 Nov 2026 (about 02:25 IST) | A price-day line under the Direct tables | "No, one label only" | No change; the single "31 Oct 2026" label stays (PD-57, PD-58). Not the Moderator's recommendation |
| 28 Nov 2026 (about 02:25 IST) | Review date against data dates | "As month labels (Recommended)" | A data point labelled with the review month's end counts as on or before the review date; the no-look-ahead rule compares month labels |
| 28 Nov 2026 (about 02:25 IST) | A holdings line with no transactions in a loaded transactions file | "Base-file XIRR, marked (Recommended)" | As built |

### 2.5 Moderator decisions with a financial meaning (27 Nov 2026)

Routine decisions of the Moderator under the operating charter (PD-65), recorded because each changes what a figure
means or when one is shown. They are the Moderator's, not the owner's; where the owner was asked, the row says so.

| Date | Decision | By | Owner asked | Where |
|---|---|---|---|---|
| 27 Nov 2026 | A PMS or AIF group is compared with an equity index only when every holding in it is an equity holding; otherwise it gets no benchmark, with a note (KI-024, OD-7) | Moderator MOD-05, routine, PD-65 | listed for the owner on 27 Nov 2026; not yet answered (which benchmark a hybrid, multi-asset or credit PMS or AIF should get) | `app/src/engine/returns/performance.ts` (PR #59); side-by-side kit SB-43, SB-49, SB-58 (PRs #62, #63) |
| 27 Nov 2026 | Test build 1 has no price-file reader, and the direct-equity CAGR (E-148) is not wired, so no such figure is shown. When it is wired without a price source it shows a dash with its reason. The reader follows when the owner has supplied the price file's headings | Moderator MOD-05, routine, PD-65 | listed for the owner on 27 Nov 2026; not yet answered (the price file's headings) | PROJECT_STATE (test build 1) |
| 27 Nov 2026 | The direct-equity CAGR figure is dated by the latest end day among the primary source's stocks, with the other end days listed in the footnote, and never depends on the order of the rows; in place before E-148 is wired | Moderator MOD-05, routine, PD-65 | - | `app/src/engine/returns/stock-cagr.ts` (PR #61). In the code since PR #68 (28 Nov 2026) |
| 27 Nov 2026 | `irrAggregateFor` returns an XIRR for a holdings line only when the transactions cover exactly that line's holdings; a transactions file with no since-inception sheet (its fund sheet of another period) is refused, so it gives no XIRR | Moderator MOD-05, routine, PD-65 | listed for the owner on 27 Nov 2026; not yet answered (whether a partly covered line may show a labelled partial XIRR) | `app/src/engine/returns/irr-aggregate.ts`, `app/src/ingest/irr-file.ts` (PR #57) |
| 27 Nov 2026 | The side-by-side kit's class "known gap": a difference where the live page is right and the new build is not, not yet ruled on by the owner; never called accepted | Moderator MOD-05, routine, PD-65 | answered by the owner on 28 Nov 2026 (section 2.4): the four unmatched names (aliases approved) | `tests/side-by-side/` (PR #60) |

## 3. Recommendations not yet approved

These are Claude's recommendations. None is a decision until the named approver accepts it.

### 3.1 For MOD-02 to decide under D-033

| Id | Recommendation | Why | Task |
|---|---|---|---|
| REC-01 | Preserve NB-01's local-only work first: run the m14 worktree's own scanner read-only (`node scripts/validation/prepush-scan.mjs --base origin/main --head 07a6460`), then `git push -u origin <branch>` for `feat/m1-4-overview` and the three fixer branches, each from its own worktree with `PRD_PRIVACY_DENYLIST` exported; no PR. If the scan blocks, never bypass it: make and verify a `git bundle`, report, and ask the owner for an approved off-machine place for it. | 26 commits exist only on this laptop; a bundle on the same disk is not a backup | TB-08 |
| REC-02 | Get CI evidence for TA-03 now: `gh workflow run "Dashboard checks" --ref continuation/ex-01-task-ta-03-20261027`, or a draft PR, while PD-02 and PD-03 are open | The branch had never run in CI (done 2 Nov: run 41412086208 on the WIP head) | TA-03 |
| REC-03 | Open the TA-03 PR from a `fix/` branch created at the final TA-03 commit (no history rewrite), keeping the continuation branch until merge; or accept release-check's warning [INFERRED preference] | release-check warns on `continuation/` | TC-23 |
| REC-04 | Write D-042 to mirror D-039 point 1 for invested value, market value and gain, with blank and placeholder cells per the answer to PD-09 | The two builds should apply one rule | TA-05 |
| REC-05 | In the T5 docs, correct D-040 point (c) (the foreign-share marker reads the matched stock entry's ISIN, not the base file's ISIN column, KI-184) and add the cross-reference to capital-gains-upload.md §10 (TR-7, LD-11) | The T5 patch header says "D-040 c corrected"; the cross-reference was agreed with NB-01 | TA-03 |
| REC-06 | File the ENGINE_KEYS gap in `check-invariants.js` as a KI from EX-01's range (KI-185) | It is a tooling defect with no id | TA-22 |
| REC-07 | One KI id per build for the prototype-key defect: KI-151 (new app) and KI-183 (live page), each citing the other | G1's test already cites KI-183 | TB-27 |
| REC-08 | Add `@types/node` as an exact-pinned dev dependency and type-check `scripts/` and `tests/`, recorded as a D entry [INFERRED] | Untyped scripts and tests hide errors | TB-25 |
| REC-09 | Before TA-03's browser QA, add a launch entry and a port for its worktree and record all ports in one register | Stale entries serve old code; chats can collide | TC-18 |
| REC-10 | Correct the AC-22 claims (DECISIONS.md line 313, DEPLOYMENT.md line 45, the roadmap) or build AC-22 | The docs disagree with each other and with the code | TB-24 |

### 3.2 For the owner, not yet in the PD list

| Id | Recommendation | Good and bad | Approver |
|---|---|---|---|
| REC-11 | Protect `main` with required CI checks and no force-push, while Claude keeps full charge otherwise | Good: a mistaken force-push or a red merge becomes impossible. Bad: it changes your D-033 choice and adds a step if CI itself breaks. Recommended after TA-03 and M1.4 merge [INFERRED]. | Owner (amends D-033) |
| REC-12 | Approve the persistent deny-list setting (PD-40, option A) | Good: every push fully scanned. Bad: a lasting setting on the laptop. | Owner |

## 4. Change log of this file

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version, for the MOD-01 to MOD-02 handover |
| 30 Oct 2026 | MOD-01 (fixer pass) | Index range D-001 to D-042; R-4 defers to README section 5.2 (ARC-01 informed of the merge and the Pages check; MOD-02 shows the evidence for "publish"); R-7 (ARC-01's scratch worktrees) recorded; PD-01 (c) says the base file's ISIN column is not read (KI-184) |
| 2 Nov 2026 | MOD-02 | Lead rulings R-8 to R-11 (TA-03 PR branch, six ENGINE keys, re-run rule confirmed by ARC-01, D-043 and KI-186); PD-02 and PD-03 marked answered with the owner's words |
| 2 Nov 2026 | MOD-02 | R-12 (Office rule), R-13 (TB-08); PD-47 to PD-49 queued; PD-02 impact line corrected; "planned, not in git yet" tags |
| 2 Nov 2026 | MOD-02 | Rule 10 of CLAUDE.md sharpened after the security review (synthetic defined, Excel window, NOT RUN is never a pass); residual "planned, not in git yet" tags; TA-26 priority |
| 9 Nov 2026 | MOD-02 | Owner answers PD-09, PD-20, PD-21, PD-30, PD-47 to PD-51 and PD-54 recorded; PD-52 and PD-53 (tax adviser) queued; R-14 (numbers) and R-15 (rule 10 amended, then reworded after the security review: Git Bash `//FI`, one pre-flight list, the copy folder, freshness, SHA-256 pin; then the Get-Process existence check and ARC-01's guard and script requirements); PD-55 (linked charts in the Outlook deck) queued; PD-56 (the day of the October performance) answered |
| 26 Nov 2026 | MOD-04 (registers-4) | Owner answers of 17 to 26 Nov recorded: PD-01, PD-04 and PD-44 answered; PD-16 answered except item 4; PD-30 publishes listed; PD-36 answered for the renamed-scheme list; PD-54 confirmed; PD-56 changed; PD-07 still open. PD-57 to PD-66 added (PD-62 and PD-63 open). Section 2.4: owner decisions without a PD number (Stage 0, D-7 labels, the ISIN column for the new build only, the D-028 exception for matching corrections, the standing `/next/` rule, M12a defaults, Q-12, matching option B, the item 6 run, Gate E acceptances, the test build target). Owner of this log: MOD-04 |
| 27 Nov 2026 | MOD-05 (registers-5, drafted by EX-03) | PD-67 added with its section; PD-30 publishes of KI-032 (#47), KI-301 (#53) and LP-16b (#50); section 2.4 rows of 26 and 27 Nov (PD-16 item 5 method, KI-032 rule and its keep, the IRR template, the final base file template, the platform product names, the Moderator model, standby and change) |
| 27 Nov 2026 | MOD-05 (registers-6, drafted by EX-03) | Section 2.4: the stricter-matching row corrected to the measured result (20 of 22 recovered, 2 lost, 4 named and unmatched: a known gap, owner asked 27 Nov 2026); section 2.5 added: the Moderator's decisions of 27 Nov 2026 with a financial meaning |
| 27 Nov 2026 | MOD-05 (registers-7, drafted by EX-03) | Section 2.4: the owner's "Open both" (CHAT-016 ARC-04 and CHAT-017 NB-05) |
| 28 Nov 2026 | MOD-05 (registers-8, drafted by EX-03) | PD-68 added with its section and the owner's words (the delegation of 28 Nov 2026); section 2.4: the owner's six answers of 28 Nov 2026; section 2.5: the four unmatched names marked answered |
| 28 Nov 2026 | MOD-05 (registers-9, drafted by EX-03) | PD-68: the decisions taken under it (the month-labels ruling to be confirmed by the owner), the window's end and the PC's sleep from 04:28 to 12:00 IST; the merge of PR #72 recorded as outside PD-68 |
