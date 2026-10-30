# Decision log

**Snapshot:** 28 Oct 2026 (IST), written by MOD-01 for the handover to MOD-02 on branch
`handover/mod-01-to-mod-02-20261028` (base `main` 6443826, PR #16).
**Owner of this log from now on:** MOD-02.

This log has three parts, kept apart on purpose:
1. **Approved decisions.** An index of D-001 to D-042 and the lead's handover rulings. The full text of every D
   entry is in [docs/DECISIONS.md](../DECISIONS.md), which stays authoritative. This index never replaces it.
2. **Pending owner decisions** (PD-01 to PD-46), each explained in plain language.
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
NB-01's exact KI-147 AG ids. TA-03 also needs the owner's answers to CR-0008 questions 17 and 18 (PD-02, PD-03)
before it merges, unless the owner accepts the safe defaults now built (a neutral AIF note; crypto kept out of
set-off).

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

## 2. Pending owner decisions

These are questions only the owner can answer, because they change what clients see or how a financial rule
works. None was answered by 28 Oct [VERIFIED: no answer recorded in any chat or file]. Each "Recommendation" is
Claude's advice, not a decision.

**How an answer is recorded.** The owner answers MOD-02 in chat. MOD-02 writes the answer as a D entry (from its
range) or a KI update, marks the PD here as answered with the date and the D or KI id, and relays it to the chat
that builds it (EX-01 or NB-01).

### 2.1 What to answer first

| Order | PD | Why first |
|---|---|---|
| 1 | PD-02, PD-03 | The tax batch (TA-03) cannot merge without them, or without "accept the safe defaults" |
| 2 | PD-09 | Fix batch 5 (TA-05, D-042) and the M1.4 PR wording depend on it |
| 3 | PD-08 | The new build's merged-folio rule (KI-148) aligns to it |
| 4 | PD-20, PD-21 | The October risk-ratio step needs them before mid-November |
| 5 | PD-30 | Confirms the "publish" gate before the first refresh under the new team |
| 6 | PD-27 | The blueprint approvals the owner asked to give |
| then | the rest | Each has a safe default already built or no build waiting |

### 2.2 All pending decisions at a glance

| PD | Short question | Recommendation | Blocks |
|---|---|---|---|
| PD-01 | Accept the live tax defaults D-040 (a) to (h)? | Accept as built | TA-03 sign-off |
| PD-02 | Are the "Listed AIF" funds Category III? (Q17) | Keep the neutral note until the AIF documents confirm | TA-03 merge |
| PD-03 | Can crypto gains or losses be set off? (Q18) | Keep "no set-off" until the tax adviser answers | TA-03 merge |
| PD-04 | The other CR-0008 questions (Q2 to Q11, Q13 to Q16, Q19, Q20) | Accept the built defaults; send Q2, Q3, Q13 to Q15 to the tax adviser | none |
| PD-05 | Grandfathering rule for lots bought before 1 Feb 2018 (Q12) | Ask the tax adviser; until then disclose only | TA-07 |
| PD-06 | A fund holding one equity ETF: assume 90/90 on the live page? | Live: keep the default with a note; new build: analyst choice | consistency |
| PD-07 | Slab rate used to order set-off | Live: 30% labelled "assumed"; new build: no default | consistency |
| PD-08 | Holding days of one fund held in several folios (D-041 question 1) | (a) as built | KI-148 alignment |
| PD-09 | KI-147: do placeholders like "NA" count as empty? | Yes, so both builds match | TA-05, M1.4 PR |
| PD-10 | KI-066: change the IPS check now on the live page? | Please choose; if no answer, keep current and build it in the new build | TA-19 |
| PD-11 | Unknown Asset Names (BF-19) | Leave "Unknown" and list | both readers |
| PD-12 | Ignore letter case in Asset Names (BF-26) | Keep folding | parity ledger |
| PD-13 | Ignore letter case in client and distributor names (L7) | Do not fold; warn | new build |
| PD-14 | A market value of 0 | Exclude and list | both readers |
| PD-15 | A blank Product Name | "Unknown" with a warning | new build |
| PD-16 | Capital-gains design §15 items 1 to 7 | 1 accept; 2 keep OD-2 for now; 3 yes; 4, 5 ask; 6, 7 confirm | TB-14 |
| PD-17 | Confirm the fix batch 2a details | Confirm | none |
| PD-18 | (record fix) KI-006 still calls OD-26 open | No action; we correct the record | TC-15 |
| PD-19 | Send the MF Screener feedback and requests | Send all three | TB-17, TB-19 |
| PD-20 | Download the public AMFI NAV file monthly | Yes | TA-20 |
| PD-21 | Where the risk-ratio toolchain may live | A short local folder outside the cloud folder and the repo | TA-20 |
| PD-22 | A question about files the previous owner held back | See the private supplement | TC-20 |
| PD-23 | Ask the previous owner for missing files | Yes | TC-20, TB-18 |
| PD-24 | Which fund one unmatched fund label means | Owner identifies | alias table (TA-09) |
| PD-25 | A note to the previous owner about one exported file | See the private supplement | TC-20 |
| PD-26 | Remove the 15 Aug FUND_RANKS scores from the live page now? | Leave until switch-over | TA-24 |
| PD-27 | Approve the new-build blueprint | Review after it is republished | TC-10 |
| PD-28 | Your requests C2 to C6: live page or new build? | Calculation items live; presentation items new build | TA-09 |
| PD-29 | Other second-export decisions | Answer before the October refresh | TA-10 |
| PD-30 | Confirm the "publish" gate | Confirm | TA-10 |
| PD-31 | Live page: dashes in sentences and the overlap threshold | Leave both to the new build | TA-25 |
| PD-32 | Which of the previous owner's 15 promised features you still want | Owner chooses | REQ-018 |
| PD-33 | Use the Investment Reckoner as the product-bank source | Yes | TB-18 |
| PD-34 | Will you still send your own issues list? | Owner says | TC-21 |
| PD-35 | Optional: hide your e-mail address on GitHub | Optional | none |
| PD-36 | Approve each new fund or AMC alias | Per alias | TA-09 |
| PD-37 | Record the AI Analyst weights as in force for now | Yes | none |
| PD-38 | Is the live deck order intended? | Leave as is on the live page | none |
| PD-39 | Deletions only you may approve | See the private supplement | TC-13 |
| PD-40 | Keep the deny-list setting permanently on this laptop? | Per push until you approve | TC-11 |
| PD-41 | An optional security step for a credential you hold | See the private supplement | none |
| PD-42 | Confirm the fix batch 4 choices | Confirm (a) to (d) | none |
| PD-43 | Tax adviser to confirm OD-28 (the debt section) | Confirm | none |
| PD-44 | The other tax defaults settled while building | Accept as built | TA-03 sign-off |
| PD-45 | The 26 "to be confirmed" research items of the capital-gains design | Send the top five to the tax adviser | M7 accuracy |
| PD-46 | Did you ask for anything outside these chats between 24 and 27 Oct? | Tell MOD-02 | none |

### 2.3 Each decision explained

Each entry answers the same questions: what the problem is, why the owner is needed, the options, what each
changes, the good and the bad, the impact, whether it can be undone, our recommendation and why, and what it
blocks.

#### PD-01. The live page's tax defaults (CR-0008 question 1)

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
- **Blocks.** The sign-off of TA-03 (the merge itself waits only on PD-02 and PD-03).
- **Evidence.** [VERIFIED] D-040 and CR-0008 on the continuation branch (0f1c5d3).

#### PD-02. Are the "Listed AIF" funds Category III? (CR-0008 question 17)

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
- **Impact.** Wording only: neither treatment produces an investor tax figure, so no rupee amount changes
  [VERIFIED CR-0008 question 17].
- **Can it be undone?** Yes, by a small wording patch.
- **Recommendation.** C now, then confirm from the AIF documents. If you reply "accept the safe defaults for
  questions 17 and 18", TA-03 can merge once it passes its checks.
- **Blocks.** The TA-03 merge (CR-0008 line 554 puts questions 17 and 18 before the merge).

#### PD-03. Can crypto gains and losses be set off? (CR-0008 question 18)

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
- **Blocks.** The TA-03 merge, unless you accept the safe defaults (see PD-02).

#### PD-04. The other CR-0008 questions, each with a built default

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

## 3. Recommendations not yet approved

These are Claude's recommendations. None is a decision until the named approver accepts it.

### 3.1 For MOD-02 to decide under D-033

| Id | Recommendation | Why | Task |
|---|---|---|---|
| REC-01 | Preserve NB-01's local-only work first: run the m14 worktree's own scanner read-only (`node scripts/validation/prepush-scan.mjs --base origin/main --head 07a6460`), then `git push -u origin <branch>` for `feat/m1-4-overview` and the three fixer branches, each from its own worktree with `PRD_PRIVACY_DENYLIST` exported; no PR. If the scan blocks, never bypass it: make and verify a `git bundle`, report, and ask the owner for an approved off-machine place for it. | 26 commits exist only on this laptop; a bundle on the same disk is not a backup | TB-08 |
| REC-02 | Get CI evidence for TA-03 now: `gh workflow run "Dashboard checks" --ref continuation/ex-01-task-ta-03-20261027`, or a draft PR, while PD-02 and PD-03 are open | The branch has never run in CI | TA-03 |
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
