# Requirements and change register

**Snapshot:** 28 Oct 2026 (IST), written by MOD-01 for the handover to MOD-02 on branch
`handover/mod-01-to-mod-02-20261028` (base `main` 6443826, PR #16).
**Owner of this register from now on:** MOD-02 (it allocates new REQ and CR numbers).

This register lists every requirement the owner has given, where it came from, what it should do, how we know it
is done, and its status today. It also lists the change requests and every improvement suggested so far.

It indexes other records and does not replace them:

| Subject | Authoritative record |
|---|---|
| Decisions | [docs/DECISIONS.md](../DECISIONS.md), indexed in [DECISION_LOG.md](DECISION_LOG.md) |
| Defects | [docs/KNOWN_ISSUES.md](../KNOWN_ISSUES.md), summarised in [KNOWN_ISSUES_AND_REGRESSION_RISKS.md](KNOWN_ISSUES_AND_REGRESSION_RISKS.md) |
| Narrative project state | [docs/PROJECT_STATE.md](../PROJECT_STATE.md) (partly stale on 28 Oct; git wins where they differ) |
| Change requests | [docs/change-requests/README.md](../change-requests/README.md) and the CR files |
| Tasks (TA, TB, TC ids) | [TASK_REGISTER.md](TASK_REGISTER.md) in this folder (the folder index is `README.md` here) |

Git is authoritative for what is built. Where a record and git disagree, this register says so.

## 1. How to read it

**Evidence labels.** [VERIFIED] means checked on 28 Oct 2026 with the evidence named (a commit, a file and line,
a command). [INFERRED] means reasoned from verified facts. [UNCERTAIN] means the evidence conflicts or is thin.
[UNKNOWN] means nobody has checked.

**Statuses** are the owner's nine, used exactly: VERIFIED COMPLETE; IMPLEMENTED, NOT FULLY VERIFIED; IN PROGRESS;
PLANNED; BLOCKED; NOT STARTED; EXISTING DEFECT; UNKNOWN / NEEDS INVESTIGATION; SUPERSEDED. When a requirement has a
different state on the live page and in the new build, both are given and the governing one is counted.

**Workstreams.** A = the existing dashboard (the live `index.html`). B = the new build (CR-0006, `/next/`).
C = coordination, governance and process.

**Sources.**
- *MOD-01 chat*: the owner's messages in the coordinating chat "Portfolio Review Dashboard architecture" (from 14 Oct).
- *NB-01 chat*: the owner's messages in "Build the new Portfolio Review dashboard" (from 22 Oct 21:47 IST).
- *Owner brief*: the new-build brief of 21 Oct; a sanitised copy is [docs/new-build/00-owner-brief.md](../new-build/00-owner-brief.md).
- *Previous owner's handover*: [docs/previous-owner/handover/](../previous-owner/handover/HANDOVER_PRD_Centricity_Portfolio_Review.md) and
  [previous-owner-and-requirements.md](../new-build/inputs/previous-owner-and-requirements.md).
- *Claude's proposal*: a rule Claude proposed and the owner did not object to.

**Message numbers.** "msg N" counts the 35 owner-channel messages of both chats in date order (29 in MOD-01, 6 in
NB-01). The owner typed 34 of them. msg 25 is NB-01's launch prompt, written by MOD-01 and started by the owner.
Six owner messages exist only as messages typed while Claude was busy, which a simple transcript search misses.
[VERIFIED by a read-only parse of both chats on 28 Oct. The raw extract holds private material and is not
reproduced anywhere.]

**Sanitised.** No client name, credential, account number or file location appears here. Material that cannot be
public is in the private supplement (`C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md`).

## 2. Summary

| Status | Count | REQ ids |
|---|---|---|
| VERIFIED COMPLETE | 23 | 001, 002, 004, 006, 007, 011, 012, 019, 022, 023, 024, 025, 026, 028, 033, 034, 035, 037, 042, 059, 062, 063, 064 |
| IMPLEMENTED, NOT FULLY VERIFIED | 8 | 003, 005, 008, 009, 013, 054, 055, 068 |
| IN PROGRESS | 23 | 010, 015, 017, 020, 029, 032, 036, 038, 040, 041, 051, 060, 061, 065, 066, 067, 070, 071, 075, 076, 077, 078, 079 |
| PLANNED | 18 | 021, 027, 039, 043, 044, 045, 046, 048, 049, 050, 052, 053, 056, 057, 058, 072, 073, 074 |
| BLOCKED | 2 | 030, 069 |
| EXISTING DEFECT | 2 | 014, 047 |
| UNKNOWN / NEEDS INVESTIGATION | 1 | 018 |
| SUPERSEDED | 2 | 016, 031 |
| NOT STARTED | 0 | none |
| **Total** | **79** | REQ-001 to REQ-079 |

Change from the investigation draft: REQ-079 moved from VERIFIED COMPLETE to IN PROGRESS, because NB-01's 26
local-only commits are not yet preserved off this laptop (task TB-08). [VERIFIED: `git ls-remote origin` on 28 Oct
lists neither `feat/m1-4-overview` 07a6460 nor the three fixer branches.]

## 3. Requirements register

Columns: **Acc.** = accepted by the owner. **Task** = the owning task in the task register (or a pending owner
decision PD-nn in [DECISION_LOG.md](DECISION_LOG.md)).

### 3.1 14 Oct: the master prompt and the previous owner's handover

| REQ | Date | Source | WS | Acc. | Intended behaviour | Acceptance criteria | Status | Components | Evidence | Task |
|---|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | 14 Oct | MOD-01 chat, msg 1 | A | Yes | Replicate the existing dashboard with a reproducible setup and functional parity, move it to the owner's GitHub, then stop after the baseline. | Baseline page byte-identical to the previous owner's build; repository on the owner's account; replication report. | VERIFIED COMPLETE | `index.html`, tools, docs | [VERIFIED] root 511f554, MD5 173F86CA…, 16,765,556 B; [REPLICATION_REPORT.md](../REPLICATION_REPORT.md); [CR-0001](../change-requests/CR-0001-baseline-replication.md) | TA-00 (Office check 7: TA-11) |
| REQ-002 | 14 Oct | MOD-01 chat, msg 1; again msg 21 | C | Yes | The owner is the product owner. Claude runs all technical work and asks only about material product, security, data or irreversible matters. | Owner asked only about such matters; lead decisions recorded as "lead, under D-033". | VERIFIED COMPLETE (standing rule) | process | [VERIFIED] D-017, D-033 in [DECISIONS.md](../DECISIONS.md) | all |
| REQ-003 | 14 Oct | MOD-01 chat, msg 1; brief; msg 35 | C | Yes | Never claim work is done, tested, pushed or deployed unless verified. Keep facts, assumptions and unknowns apart. | Every report labels verified and unverified items with evidence. | IMPLEMENTED, NOT FULLY VERIFIED (ongoing practice) | reports, registers | [VERIFIED] labels in the CR records and in these registers | all |
| REQ-004 | 14 Oct | MOD-01 chat, msg 1 | A | Yes | Preserve behaviour during the baseline; document defects instead of fixing them silently; record conflicts between sources. | No product change in Stage A; defects filed. | VERIFIED COMPLETE | `index.html`, KNOWN_ISSUES | [VERIFIED] D-010, D-011 | TA-00 |
| REQ-005 | 14 Oct | MOD-01 chat, msg 1; brief Ph 12; msg 35 | C | Yes | The documents are the project's durable memory and change with every change. | Each PR updates CHANGELOG, PROJECT_STATE and the affected docs; docs match git. | IMPLEMENTED, NOT FULLY VERIFIED (several docs lag git) | `docs/` | [VERIFIED] [PROJECT_STATE.md](../PROJECT_STATE.md) lines 46 and 54 still call M1.2 and M1.3 "ready for its pull request" (merged as PRs #12, #13) | TC-15, TB-28, TA-08 |
| REQ-006 | 14 Oct | MOD-01 chat, msg 1 | C | Yes | A reusable team of specialist agents. | Agent definitions exist and are used. | VERIFIED COMPLETE (definitions stale) | `.claude/agents/` | [VERIFIED] 6 agent files; D-014; qa-engineer still says 17 AI Analyst checks (now 24) | TC-17 |
| REQ-007 | 14 Oct | MOD-01 chat, msg 1 | C | Yes | Every change: understand, investigate, plan, branch, implement, verify, update docs, commit, PR, report with SHA; root-cause fixes with regression tests. | Each change has a branch, PR, CR record and tests. | VERIFIED COMPLETE (ongoing) | git, `docs/change-requests`, `tools/regression` | [VERIFIED] PRs #1 to #16, all merged | all |
| REQ-008 | 14 Oct | MOD-01 chat, msg 1 | A, B | Yes | Financial-domain discipline (units, dates, provenance, no silent substitution); a financial reviewer checks every calculation change. | financial-domain-reviewer approval recorded for each calculation change. | IMPLEMENTED, NOT FULLY VERIFIED | engine, tax rules, new-app engine | [VERIFIED] reviews recorded in CR-0005, CR-0009 and capital-gains-upload.md §10.10; [VERIFIED] no review yet of TA-03 part T5 (commit 0f1c5d3 message) | TA-03, TB-06 |
| REQ-009 | 14 Oct | MOD-01 chat, msg 1; brief; msg 35 | C | Yes | No secrets or client data in git, logs, docs or fixtures. No force-push, history rewrite or destructive command. | Privacy and pre-push scans pass with the private deny-list; no force-push on record. | IMPLEMENTED, NOT FULLY VERIFIED | repo, hooks, scans | [VERIFIED] `scripts/validation/privacy-scan.mjs`, `prepush-scan.mjs`, `core.hooksPath`; [VERIFIED] `PRD_PRIVACY_DENYLIST` unset in the user environment on 28 Oct | TC-11, PD-40 |
| REQ-010 | 14 Oct | MOD-01 chat, msg 1; brief Ph 12.4; msg 35 | C | Yes | The project can pass to a new maintainer without the chat history. | A newcomer resumes from the repo docs plus the private supplement. | IN PROGRESS | [HANDOVER.md](../HANDOVER.md), `docs/project-control` | [VERIFIED] HANDOVER.md line 6 "Last refreshed: 23 Oct 2026"; this package | TC-01, TC-08 |
| REQ-011 | 14 Oct | MOD-01 chat, msgs 2 to 4 | C | Yes | A Products-team GitHub account, the repository and its Pages link. | Repository on that account; Pages serves the dashboard. | VERIFIED COMPLETE | GitHub, Pages | [VERIFIED] D-008; live `/` returned 16,837,249 B on 28 Oct | none |
| REQ-012 | 14 Oct | Previous owner's handover §0, §10 | A | Yes (adopted) | Keep the exact same dashboard; change `index.html` only by anchored, exactly-once replacements; prove the checksum. | Every change is a patch script with MD5 before and after. | VERIFIED COMPLETE (standing rule) | `index.html`, `tools/patches`, `tools/patch-lib.js` | [VERIFIED] D-016; 9 patch scripts on main; [VERIFIED] the literal "replay every patch" rule refuses safely on HEAD (4 of 9 patches) | TA-23 |
| REQ-013 | 14 Oct | Previous owner's handover §0 rule 4 | A, B | Yes | One offline file; no network calls; client data never leaves the browser. The MF Screener link in the new app is the only exception. | check-invariants and check-next pass; the new app's CSP has `connect-src 'none'`. | IMPLEMENTED, NOT FULLY VERIFIED | `index.html`, `app/` | [VERIFIED] D-027, D-034; CI green on 6443826; [VERIFIED] the live page has no CSP (KI-008 open) | TA-14 |
| REQ-014 | 14 Oct | Previous owner's handover §0 rule 5 | A, B | Yes | Never invent a number: a missing value is blank with a footnote and a count, never 0 or a guess. | No silent zero; every missing value has a status. | A: EXISTING DEFECT (KI-057, KI-059 open); B: IN PROGRESS | engine; `app/src/model/status.ts` | [VERIFIED] KI-057, KI-059 open in [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) | TA-18, TB-06 |
| REQ-015 | 14 Oct | Previous owner's handover §8 | A, B | Yes | Keep the established calculation and presentation conventions. | Parity ledgers account for every difference; parity sign-off at M15. | IN PROGRESS | engine; `tests/parity` | [VERIFIED] base-file ledger on main; the aggregation ledger exists only on NB-01's local branch | TB-22 |
| REQ-016 | 14 Oct | Previous owner's handover §0 rule 6 | A | Previous owner's rule | Push only on the owner's word; keep three byte-identical copies. | none (superseded) | SUPERSEDED | git process | [VERIFIED] D-001, D-013, D-017, D-033 | none |
| REQ-017 | 14 Oct | Previous owner's handover §9 | A | Yes | Refresh the live page monthly by the runbook. | Each month: refresh log, PR, gates, the owner's "publish", live size and SHA-256 checked. | IN PROGRESS (September proved; October BLOCKED on the owner's files, due 11 to 17 Nov) | `index.html` data blocks, `buildtools`, `data/refdata` | [VERIFIED] [MONTHLY_REFRESH.md](../MONTHLY_REFRESH.md); no `data/2026-10-refresh` branch on 28 Oct | TA-10 |
| REQ-018 | 14 Oct | Previous owner's requirements §2.4 | A, B | Not confirmed by the current owner | The previous owner's 15 promised but unshipped features (section 6.3 below). | The owner says which to keep; each kept one gets a CR or a milestone. | UNKNOWN / NEEDS INVESTIGATION | various | [VERIFIED] [previous-owner-and-requirements.md §2.4](../new-build/inputs/previous-owner-and-requirements.md) | PD-32 |

### 3.2 15 to 19 Oct: first fixes, the previous owner's export and the audit

| REQ | Date | Source | WS | Acc. | Intended behaviour | Acceptance criteria | Status | Components | Evidence | Task |
|---|---|---|---|---|---|---|---|---|---|---|
| REQ-019 | 15 Oct | MOD-01 chat, msg 6 | A | Yes | Fix KI-001 first (a new family's base file inherited the previous family's state). | `family-isolation.js` checks pass. | VERIFIED COMPLETE | UI `resetFamilyState()` | [VERIFIED] PR #1 (9f018e4); D-015 | TA-00 |
| REQ-020 | 15 to 23 Oct | MOD-01 chat, msgs 6, 7, 9, 10, 11, 26 | C | Yes | A prompt for the previous owner to export all data in one run, delivered over Teams, without token revocation or file redirection. Never raise retiring the existing dashboard with the previous owner. | Export received and taken in; an independent check passes; records updated. | IN PROGRESS | handover material (private) | [VERIFIED] CR-0002, CR-0004; second export received 23 Oct; [UNCERTAIN] an independent check failed with HTTP 401 and was not rerun (the lead's account; no file records it) | TC-16, TC-20, TA-08 |
| REQ-021 | 15 Oct | MOD-01 chat, msg 7 | A, B | Yes | Retire the previous owner's site only after the new build is fully tested. | Switch-over only after M15 parity sign-off and the owner's approval. | PLANNED | switch-over | [VERIFIED] PROJECT_STATE next steps | TB-22 |
| REQ-022 | 15 Oct | MOD-01 chat, msg 8 | A | Yes | Take in the previous owner's replies (three zips, two Markdown files, a CSV). | Reviewed, filed; the useful parts in the repo. | VERIFIED COMPLETE | `docs/previous-owner`, `buildtools` | [VERIFIED] CR-0003; PR #2 (df25dcd) | none |
| REQ-023 | 15 and 23 Oct | MOD-01 chat, msgs 8, 27, 29 | C | Yes | A monthly inbox sub-folder; organise the project folder and GitHub very neatly; file each new delivery in its sub-folder. | Layout per D-018; each delivery filed. | VERIFIED COMPLETE (ongoing) | project folder, repo layout | [VERIFIED] D-018; the 23 Oct files were filed (checked 28 Oct) | none |
| REQ-024 | 15 Oct | MOD-01 chat, msg 8 | A | Yes | The local link `http://localhost:8099` works. | Dashboard served on 8099 by `tools/serve-dashboard.js`. | VERIFIED COMPLETE (per CR-0003; not re-run on 28 Oct) | `tools/serve-dashboard.js`, `.claude/launch.json` | [VERIFIED] CR-0003 verification | none |
| REQ-025 | 15 and 27 Oct | MOD-01 chat, msgs 8, 34 | A, C | Yes | Explain the monthly update plainly: the owner's steps, the files needed, Claude's part. | A plain runbook and an owner guide exist and are current. | VERIFIED COMPLETE (Step 4 text stale) | [MONTHLY_REFRESH.md](../MONTHLY_REFRESH.md), [MONTHLY_UPDATE_GUIDE.md](../MONTHLY_UPDATE_GUIDE.md) | [VERIFIED] MONTHLY_REFRESH.md lines 182 to 183 still say the risk toolchain has not arrived (it arrived 23 Oct) | TA-08 |
| REQ-026 | 15 and 23 Oct | MOD-01 chat, msgs 8, 26 | C | Yes | Keep GitHub current with a record of every requested change; merge verified requested work after green CI without asking again. | Every request has a CR; merges follow D-017 and D-020. | VERIFIED COMPLETE (standing) | git, `docs/change-requests` | [VERIFIED] D-017, D-020; PRs #11 to #13 merged 23 Oct | all |
| REQ-027 | 15 Oct | Claude's proposal (D-017; MONTHLY_REFRESH Part 1 step 4) | A | INFERRED (never typed by the owner; not objected to) | A data refresh reaches the live link only after the owner reviews it and replies "publish". | No refresh is merged without the owner's "publish" in chat. | PLANNED (first use: the October refresh) | refresh merge | [VERIFIED] MONTHLY_REFRESH.md lines 28 and 87; [INFERRED] acceptance | TA-10, PD-30 |
| REQ-028 | 16 Oct | MOD-01 chat, msg 12 | A | Yes | Share the final review link so testing can begin. | A permanent Pages link given. | VERIFIED COMPLETE | Pages | [VERIFIED] CR-0005 | none |
| REQ-029 | 16 and 27 Oct | MOD-01 chat, msgs 12, 34 | A | Yes | Find and fix the existing dashboard's issues now; merge old-build fixes so the owner can test. | Audit done; fix batches merged with tests; open defects tracked. | IN PROGRESS | `index.html` engine, parsers, exporters | [VERIFIED] audit PR #3; fix PRs #4, #6, #9, #16; the tax batch is on the continuation branch only | TA-01 to TA-05, TA-12 to TA-19 |
| REQ-030 | 16 Oct | MOD-01 chat, msg 12 | A | Owner to supply | The owner's own list of issues with the existing dashboard. | List received and filed as KIs or a CR. | BLOCKED (not received) | none yet | [VERIFIED] CR-0005 still open for it | TC-21, PD-34 |
| REQ-031 | 16 Oct | MOD-01 chat, msg 12 | B | Yes | A full revamp with major design changes after replication. | none (superseded) | SUPERSEDED by REQ-036 | none | [VERIFIED] CR-0005, then CR-0006 | none |
| REQ-032 | 19 Oct | MOD-01 chat, msg 13 | A | Yes | Accept the audit's recommendations OD-1 to OD-28 except OD-11. For OD-11, keep the monitor uploads so analysts can load the latest monitor, and make them correct. | Each accepted OD built with tests; KI-058 and KI-076 fixed. | IN PROGRESS (the OD-11 fixes and many OD items are not built) | parsers, engine, UI | [VERIFIED] D-021; PR #5; KI-058 and KI-076 open | TA-13, TA-18 |

### 3.3 21 to 22 Oct: the new-build brief and the owner's answers

| REQ | Date | Source | WS | Acc. | Intended behaviour | Acceptance criteria | Status | Components | Evidence | Task |
|---|---|---|---|---|---|---|---|---|---|---|
| REQ-033 | 21 Oct | MOD-01 chat, msgs 14, 18 | A | Yes | List and accept OD-29 to OD-36. | Recorded; built items tested. | VERIFIED COMPLETE | engine | [VERIFIED] D-022; PR #7; OD-32 and OD-34 built in PR #9 | none |
| REQ-034 | 21 and 23 Oct | MOD-01 chat, msgs 16, 17, 26, 28 | B | Yes | Survey the MF Screener's data and write a monthly extraction prompt for the Screener owner. | Prompt delivered; packs received and validated. | VERIFIED COMPLETE (feedback to the Screener owner BLOCKED on the owner) | Screener data (private, class N) | [VERIFIED] packs received and validated 23 Oct (private note) | TC-19, PD-19 |
| REQ-035 | 21 to 27 Oct | MOD-01 chat, msgs 19, 23, 34 | C | Yes | Keep the owner informed: progress, links and ETA on request and after each milestone. | A report after each merge with links, ETA and verified labels. | VERIFIED COMPLETE (ongoing) | owner reports | [VERIFIED] replies of 22 and 27 Oct; switch-over ETA corrected to early January | TC-22 |
| REQ-036 | 21 Oct | MOD-01 chat, msg 15 (owner brief) | B | Yes | Build a clean new application with feature parity; keep the existing system until parity; reuse validated logic. | All parity rows at parity or accounted for; switch-over signed off. | IN PROGRESS | `app/`, `scripts/`, `tests/` | [VERIFIED] CR-0006; PRs #8, #10 to #15; M1.4 local only at 07a6460 | TB-01 to TB-23 |
| REQ-037 | 21 Oct | Owner brief, Phase 0 | B | Yes | Nine audit and design deliverables before building. | `docs/new-build/01` to `09` merged. | VERIFIED COMPLETE | `docs/new-build` | [VERIFIED] PR #10 (2a65a62) | TB-01 |
| REQ-038 | 21 Oct | Owner brief, Phase 1 | B, C | Yes | An organised repository, incremental commits, milestone pushes, a pre-push review, git state in the handover. | Each milestone pushed after a passing pre-push scan. | IN PROGRESS (M1.4 not pushed) | repo layout, release-check, prepush-scan | [VERIFIED] `feat/m1-4-overview` not on origin | TB-08, TB-06 |
| REQ-039 | 21 to 22 Oct | Owner brief Ph 1.3, 11.1; msgs 20, 22 | B | Yes | A public `monthly_updates/YYYY-MM` folder with approved non-client files; the licence covers every vendor file. | Folder filled each month by class rules; no class N file. | PLANNED (M11) | `monthly_updates/` | [VERIFIED] D-023, D-026; the folder holds only README and `_policy` | TB-18 |
| REQ-040 | 21 Oct | Owner brief, Phase 2 | B | Yes | One data and calculation model for screen, Excel and deck; stable ids; explicit missing-data statuses, never a silent zero. | One model feeds every output; statuses tested. | IN PROGRESS | `app/src/model`, engine | [VERIFIED] PR #13 | TB-03, TB-09 |
| REQ-041 | 21, 24, 27 Oct | Owner brief Ph 3; NB-01 chat, msgs 31 to 33 | B | Yes (approved 27 Oct 11:43 IST) | A one-page workspace in nine sections, with the tabs across the top for more width; later screens build on it. | Shell and tabs live on `/next/`; sections filled per milestone. | IN PROGRESS (shell and tabs VERIFIED COMPLETE) | `app/src/ui`, `sections.json` | [VERIFIED] PRs #12, #14 (c9ec1cc); D-037. The owner's message said "vertical"; built as top tabs, shown, and approved | TB-02, TB-04, TB-06 |
| REQ-042 | 21 Oct | Owner brief, Phase 4 | B | Yes | An MF Screener link that opens in a new tab; embedding only if allowed; no stored credential; an Excel fallback if access fails. | One static link; no credential anywhere; fallback built in M10. | VERIFIED COMPLETE (link); fallback PLANNED | `app/src/config/links.json` | [VERIFIED] D-027; live `/next/` has one Screener link | TB-17 |
| REQ-043 | 21 Oct | Owner brief, Phase 5 | B | Yes | A conditional Review Snapshot: Review Only by default; With Rebalancing only with a valid proposal. | Mode selector and both snapshots tested. | PLANNED | M5, M8 | [VERIFIED] [roadmap](../new-build/07-implementation-roadmap.md) | TB-12, TB-15 |
| REQ-044 | 21 Oct | Owner brief, Phase 6 | B | Yes | Allocation (client and advisor slides), equity, debt (items under 2% into Others), three rating buckets, selectors, history (Mar and Sep 2026), hybrid FoF look-through. | Each item built with known-answer tests and parity. | PLANNED (allocation slice IN PROGRESS in M1.4) | M1.4, M4, M12 | [VERIFIED] roadmap | TB-06, TB-11, TB-19 |
| REQ-045 | 21 Oct | Owner brief, Phase 7 | B | Yes | Holdings by value; MF quants from the Screener with an Excel fallback; performance layout and orders; no 2Y column on debt; debt indices. | Built and checked in browser QA. | PLANNED | M3, M10 | [VERIFIED] roadmap | TB-10, TB-17 |
| REQ-046 | 21 and 22 Oct | Owner brief Ph 8; msg 21 | B | Yes (D-030) | An observation engine (evidence, diagnosis, implication, action), editable, with approved thresholds; a fund pair overlaps from 35%. | Rule bank implemented with tests. | PLANNED | M5 | [VERIFIED] D-030; [observation-rule-bank.md](../new-build/observation-rule-bank.md) | TB-12, PD-31 |
| REQ-047 | 21 and 22 Oct | Owner brief Ph 8; msg 21 | A, B | Yes (D-029) | No en or em dash in presentation sentences; a missing value is a dash alone with a footnote. | A lint rule; no dash in generated sentences. | A: EXISTING DEFECT (KI-126, KI-135); B: IN PROGRESS | engine text, exporters; new-app formatter | [VERIFIED] D-029; KI-126 open | TA-25, PD-31, TB-06 |
| REQ-048 | 21 Oct | Owner brief, Phase 9 | B | Yes | An editable deck in the house style (Cambria 9 pt, fixed colours, 0.5 pt grey borders, tan Actionables); slide 8 pre and post CAGR; slide 9 redemption in units with rupees and no "Reinvest into" column. | Office acceptance passes; slides match the design system. | PLANNED (first slide C-08 in M1.4) | `app/src/exports/pptx` | [VERIFIED] D-031; [deck-design-system.md](../new-build/deck-design-system.md) | TB-15, TB-16 |
| REQ-049 | 21 Oct | Owner brief, Phase 10 | B | Yes | A structured, formula-driven Excel workbook that can be edited and re-uploaded with validation and recalculation. | Re-upload round trip tested. | PLANNED (writer spike passed in Excel, reported) | `app/src/exports/xlsx` | [UNCERTAIN] spike result reported by NB-01, not re-run | TB-13 |
| REQ-050 | 21 Oct | Owner brief, Phase 11 | B | Yes | A monthly update from one instruction; a product bank from the Investment Reckoner; idempotent; an update report. | One instruction runs the cycle and produces the report. | PLANNED (M11) | monthly engine | [VERIFIED] roadmap; the Reckoner file is still missing | TB-18, PD-33, PD-23 |
| REQ-051 | 21 Oct | Owner brief, Phase 12 | B, C | Yes | Keep the living PRD consistent; produce a dated monthly PRD and handover every cycle. | Each cycle's PRD passes `monthly-prd-check.mjs`. | IN PROGRESS | [PRD.md](../PRD.md), `docs/monthly-prds` | [VERIFIED] PRD.md §13 lines 331 to 333 stale; template and checker exist | TA-21, TB-21, TB-28 |
| REQ-052 | 21 Oct | Owner brief, Phases 13 to 15 | B | Yes | Reconciliation, unrounded maths, outlier flags with severities; deck, workbook and cross-output QA; the 24 acceptance cases. | AC-01 to AC-24 green before switch-over. | PLANNED | validation, tests | [VERIFIED] AC-22 has no test on main or on the M1.4 branch | TB-20, TB-22, TB-24 |
| REQ-053 | 21 Oct | Owner brief, Phase 16 | B | Yes | No automated rebalancing engine yet; keep current rebalancing and tax; prepare Phase 2 structures. | A Phase 2 readiness pack. | PLANNED | M8, M16 | [VERIFIED] roadmap | TB-15, TB-23 |
| REQ-054 | 21 Oct | Owner brief, context | B | Yes | Reference decks are design references only; their client data is never copied. | No client data from reference decks in any output or the repo. | IMPLEMENTED, NOT FULLY VERIFIED | docs, fixtures | [VERIFIED] the brief copy is sanitised; D-019 | none |
| REQ-055 | 21 Oct | Owner brief, context | B, C | Yes | A credential the owner holds is used only for authorised access and is never hardcoded, committed, logged, screenshotted or published; if access fails, use the Excel fallback. | No credential in the repo, logs or pages. | IMPLEMENTED, NOT FULLY VERIFIED | `links.json`, scans | [VERIFIED] D-027 (no credential stored) | none |
| REQ-056 | 22 Oct | MOD-01 chat, msgs 20, 21 | B | Yes | A drawdown comparison on index data; the owner supplies five Index TRI files monthly. | Drawdown built on TRI data. | PLANNED (M12) | M12 | [VERIFIED] D-023 point 2 | TB-19 |
| REQ-057 | 22 Oct | MOD-01 chat, msg 20 | B | Yes | Portfolio 3Y and 5Y return = fund returns weighted by holding. | Known-answer test. | PLANNED (M3) | engine | [VERIFIED] D-023 point 3 | TB-10 |
| REQ-058 | 22 Oct | MOD-01 chat, msg 20 | B | Yes | Direct-equity 1Y, 3Y and 5Y CAGR by the owner's calculator logic, with prices from monthly data and a price-file fallback. | Known-answer test against the owner's calculator. | PLANNED (M3, M10) | engine | [VERIFIED] D-023 point 4 | TB-10, TB-17 |
| REQ-059 | 22 Oct | MOD-01 chat, msg 21 | A, B, C | Yes | Keep a list of every file the owner uploads each month. | The list is current. | VERIFIED COMPLETE | [MONTHLY_UPDATE_GUIDE.md](../MONTHLY_UPDATE_GUIDE.md) | [VERIFIED] its "Files the owner supplies each month" table | none |
| REQ-060 | 22 Oct | MOD-01 chat, msg 21 | B | Yes (D-026) | Screener scores and ranks never appear in a public page; the owner uploads the pack each cycle; the pack is never committed. | No class N data in the repo or on Pages; the upload slot works. | IN PROGRESS (the live FUND_RANKS question is open) | `data/refdata/FUND_RANKS_CODES.json`, M10 | [VERIFIED] D-026, D-035 point 2; the live page still embeds the 15 Aug FUND_RANKS block | TB-17, TA-24, PD-26 |
| REQ-061 | 22 Oct | MOD-01 chat, msgs 21, 23 | B | Yes (D-032 amended by D-036) | A capital-gains upload in a format Claude chooses (built as the platform's export as is, plus a blank template). | Parser built to the D-036 design; tests pass. | IN PROGRESS (design VERIFIED COMPLETE; code PLANNED) | [capital-gains-upload.md](../new-build/capital-gains-upload.md), M7 | [VERIFIED] PR #15 (fb7f59c); reviewer approval 27 Oct (§10.10) | TB-05, TB-14, PD-16 |
| REQ-062 | 22 Oct | MOD-01 chat, msg 21 | C | Yes | No branch protection on main; Claude takes full charge of GitHub and the dashboard. | No ruleset; CLAUDE.md rule 8 followed by practice. | VERIFIED COMPLETE | GitHub settings | [VERIFIED] D-033; main unprotected (GitHub API, 28 Oct) | none (see IMP-C01) |
| REQ-063 | 22 Oct | MOD-01 chat, msg 23 | C | Yes | A separate chat for the new build so its progress is tracked separately. | NB-01 exists and owns the new build. | VERIFIED COMPLETE | chats | [VERIFIED] NB-01 created 22 Oct 21:47 IST | none |
| REQ-064 | 22 Oct | MOD-01 chat, msg 24 | A | INFERRED (lead rule D-028 explained; no objection) | The live page gets only calculation, data and security fixes; presentation changes go to the new build. | Live-page PRs stay in that scope. | VERIFIED COMPLETE (rule) | live-page scope | [VERIFIED] D-028 | all TA |

### 3.4 22 to 27 Oct: delivery rules, tax, KI-147 and the handover

| REQ | Date | Source | WS | Acc. | Intended behaviour | Acceptance criteria | Status | Components | Evidence | Task |
|---|---|---|---|---|---|---|---|---|---|---|
| REQ-065 | 22 Oct | NB-01 chat, msg 25 (written by MOD-01, started by the owner) | B, C | Yes | New-build delivery per milestone: one PR in worktree isolation, browser QA, financial review where calculations change, a security gate, `/next/` verified and the live page unchanged after each deploy, a report after each milestone. | Each milestone PR records all of these. | IN PROGRESS | process | [VERIFIED] PRs #14 and #15 followed it | TB-06, TB-07 |
| REQ-066 | 23 Oct | MOD-01 chat, msg 27 | A, B | Yes [INFERRED from the owner supplying it] | Use the owner's Taxation Reckoner TY2026-27 as the source for tax rules. | Live tax rules match the reckoner (D-040); the new design's table v1 matches. | A: IN PROGRESS (TA-03 not merged); B: design VERIFIED COMPLETE, M7 PLANNED | TAX_RULES, tax engine | [VERIFIED] D-040 and CR-0008 on the continuation branch only; D-036 table on main | TA-03, TB-14, PD-01 to PD-05 |
| REQ-067 | 24 Oct | NB-01 chat, msg 30 | A, B | Yes | KI-147, "no fallback": a Crore cell that is not a number is invalid, and the holding is excluded and listed. | Both readers apply it; the parity entries AG-13 and AG-14 are retired. | B: IN PROGRESS (D-039 point 1 on NB-01's local branch); A: PLANNED (TA-05, D-042) | both base-file readers | [VERIFIED] D-039 exists only on `feat/m1-4-overview`; D-041 point 4 on main still falls through to Lakh or rupees | TA-05, TB-06, PD-09 |
| REQ-068 | 27 Oct | MOD-01 chat, msgs 34, 35 | C | Yes | Explain any needed decision simply (so a 10-year-old could follow), record the answer and relay it to the right chat. | Each pending decision has a plain explanation; answers recorded as D or KI entries and relayed. | IMPLEMENTED, NOT FULLY VERIFIED (8 decisions put on 27 Oct; none answered) | [DECISION_LOG.md](DECISION_LOG.md) | [VERIFIED] DECISION_LOG.md section 2 | TC-09 |
| REQ-069 | 27 Oct | MOD-01 chat, msg 34 | B, C | Yes | The new build's architecture by section and sub-section, for the owner to approve each one. | The owner's approvals recorded per section and relayed to NB-01. | BLOCKED (page published: 17 sections, 83 sub-items; 0 approvals; its statuses are stale) | the blueprint approval page (private; location in the private supplement) | [VERIFIED] its approvals store was empty on 28 Oct | TC-10, PD-27 |
| REQ-070 | 27 Oct | MOD-01 chat, msg 35 | C | Yes | Stop all implementation; build and validate a full handover package; commit and push it safely; report; then stop. | Package committed and pushed after the scans; MOD-02 validates it. | IN PROGRESS | `docs/project-control`, private supplement | [VERIFIED] handover branch created at 6443826 | TC-01 |
| REQ-071 | 27 Oct | MOD-01 chat, msg 35 | C | Yes | Use the nine statuses consistently. | Every register uses only the nine. | IN PROGRESS | registers | [VERIFIED] this register | all |
| REQ-072 | 27 Oct | MOD-01 chat, msg 35 | C | Yes | Workstream A first, then B, without rolling back legitimate new-build work. | Sequencing follows the readiness rule; no new-build work is discarded. | PLANNED | sequencing | [INFERRED] the lead's merge readiness rule (DECISION_LOG.md section 1.3) applies it | TC-06 |
| REQ-073 | 27 Oct | MOD-01 chat, msg 35 | C | Yes | A Master Project Moderator (MOD-02) as the owner's single point of contact. | MOD-02 launched; it validates the handover. | PLANNED | chats | [VERIFIED] not created on 28 Oct | TC-02 |
| REQ-074 | 27 Oct | MOD-01 chat, msg 35 | C | Yes | An independent Codebase Integrity and Integration Guardian (ARC-01). | ARC-01 runs Gate B on every change. | PLANNED | chats | [VERIFIED] not created on 28 Oct | TC-04 |
| REQ-075 | 27 Oct | MOD-01 chat, msg 35 | C | Yes | Isolated worktrees or a single writer; file-ownership and active-change registers; change-impact and interface contracts; gates A to E; an integration and regression log. | Registers exist and are kept; each gate is recorded per change. | IN PROGRESS (worktree isolation practised; registers written in this package) | `docs/project-control` | [VERIFIED] absent on main; [VERIFIED] the T5 commit (0f1c5d3) warns that two implementer agents may have shared one worktree | TC-08 |
| REQ-076 | 27 Oct | MOD-01 chat, msg 35 | C | Yes | Hand over after three compactions or lost context, with a continuation branch, a copy-ready successor prompt and a message to the owner. | Continuation branch on origin; prompts and owner message ready; MOD-02 validates. | IN PROGRESS (MOD-01 is at 4 compactions, so overdue) | continuation branches, prompts | [VERIFIED] `continuation/ex-01-task-ta-03-20261027` at 0f1c5d3 on origin | TC-01 to TC-03 |
| REQ-077 | 27 Oct | MOD-01 chat, msg 35 | C | Yes | A chat registry, task register, requirements and change register, decision log, and dated, versioned handovers under `docs/handover` and `docs/project-control`. | Files committed and indexed. | IN PROGRESS | `docs/project-control`, `docs/handover` | [VERIFIED] both folders absent on main 6443826 | TC-08 |
| REQ-078 | 27 Oct | MOD-01 chat, msg 35 | C | Yes | No important information lives only in a chat; it is recorded in files, and in the repository when safe. | Every decision, number range and cross-chat agreement is in a file. | IN PROGRESS (gaps: the KI-147 answer is only on a local branch; number ranges and cross-chat agreements were only in private notes until this package) | docs, private supplement | [VERIFIED] DECISIONS.md on main has no KI-147 answer | TC-07, TC-14 |
| REQ-079 | 27 Oct | MOD-01 chat, msg 35 | C | Yes | Never discard, stash, reset or force work; make a labelled WIP checkpoint on the task's own branch; push only when the scan passes. | All work preserved off this machine; nothing forced. | IN PROGRESS (every worktree is clean and the TA-03 WIP is on origin, but NB-01's 26 commits exist on this laptop only) | git | [VERIFIED] 0f1c5d3 on origin; 07a6460, 4610684, be7f395 and 202f8f6 not on origin | TB-08 |

## 4. Governance and process requirements at a glance

These are the owner's rules about *how* the work is done. Each one maps to the requirements above and to the lead's
rulings of 28 Oct (DECISION_LOG.md section 1.3).

| Theme | Requirements | How it is applied from 28 Oct |
|---|---|---|
| Separate chats | REQ-063, REQ-073, REQ-074 | MOD-02 coordinates and is the owner's single contact; NB-01 builds B; EX-01 takes TA-03 and later TA tasks; ARC-01 guards integration. Planned chats are not yet created [VERIFIED]. |
| Who decides | REQ-002, REQ-062 | Owner: product and financial rules, "publish", acceptance. MOD-02: sequencing, task assignment, number allocation, the go to merge. Implementing chat: build, push, PR, merge after the go. ARC-01: Gate B, may block. |
| Merge rules | REQ-007, REQ-026, REQ-064, REQ-065 | D-017 and D-020: merge verified requested work after green CI, locally with `--no-ff` and the exact message; only after MOD-02's go, CI green and ARC-01's Gate B GO; then check Pages. |
| Merge order | REQ-072 | Readiness rule, not a fixed order: whichever change passes Gates A to D first merges first; the second takes main and keeps both sides' rows. |
| Publish gating | REQ-027 | A monthly refresh merges only after the owner replies "publish" (to be confirmed once: PD-30). |
| Plain-language decisions | REQ-068, REQ-025 | DECISION_LOG.md section 2 explains each pending decision plainly; answers are recorded and relayed. |
| Approvals page | REQ-069 | MOD-02 republishes the blueprint page with current statuses, then asks for approvals (TC-10). |
| File organisation | REQ-023, REQ-038, REQ-077 | Repository layout per CR-0006; project-control registers in this folder; private material only under `C:\dev\private`. |
| Truthful reporting | REQ-003, REQ-071 | Evidence labels and the nine statuses in every register and report. |
| Safety | REQ-009, REQ-055, REQ-079 | Push from the branch's own worktree with `PRD_PRIVACY_DENYLIST` exported; never `--no-verify`, never force-push; WIP checkpoints on the task branch. |
| This handover and future ones | REQ-070, REQ-076, REQ-077, REQ-078 | Hand over after 3 compactions or lost context: WIP checkpoint, continuation branch pushed with `-u`, registry updated, successor prompt, owner message; the outgoing chat then stops writing. |

## 5. Change register

| CR | Date | Subject | WS | Status on 28 Oct | Tasks | Evidence |
|---|---|---|---|---|---|---|
| [CR-0001](../change-requests/CR-0001-baseline-replication.md) | 14 Oct | Replicate the dashboard; repository, docs, GitHub | A | VERIFIED COMPLETE (acceptance check 7, the Office visual check, still Partial) | TA-00, TA-11 | [VERIFIED] 511f554 MD5 173F86CA… |
| [CR-0002](../change-requests/CR-0002-ki001-family-isolation.md) | 15 Oct | Fix KI-001; export prompt for the previous owner | A | VERIFIED COMPLETE | TA-00 | [VERIFIED] PR #1 (9f018e4), page MD5 F0EB0101… |
| [CR-0003](../change-requests/CR-0003-organise-and-monthly-process.md) | 15 Oct | Take in the first export; organise; monthly process; local link | A | VERIFIED COMPLETE | TA-00 | [VERIFIED] PR #2 (df25dcd) |
| [CR-0004](../change-requests/CR-0004-second-export-request.md) | 15 to 16 Oct | Second export request | A, C | IMPLEMENTED, NOT FULLY VERIFIED (received 23 Oct and taken in privately; independent check not rerun; index row stale) | TA-08, TC-16 | [VERIFIED] README.md line 21 still says "delivery awaited"; [UNCERTAIN] the 401 failure |
| [CR-0005](../change-requests/CR-0005-audit-fixes-and-redesign.md) | 16 Oct | Find and fix issues; audit | A | IN PROGRESS (audit batch 1 done; audit batches 2 to 7 NOT STARTED) | TA-01, TA-12 to TA-18 | [VERIFIED] PRs #3, #4, #6 |
| [CR-0006](../change-requests/CR-0006-new-build.md) | 21 Oct | The new build | B | IN PROGRESS (M1.1 to M1.3, tabs and the capital-gains design merged; M1.4 local only) | TB-01 to TB-28 | [VERIFIED] PRs #8, #10 to #15; README.md line 23 "M1.1 in progress" is stale |
| [CR-0007](../change-requests/CR-0007-legacy-batch-2a.md) | 21 to 22 Oct | Fix batch 2a (KI-124, OD-32, OD-34) | A | VERIFIED COMPLETE (the owner's confirmation of the settled details pending: PD-17) | TA-02 | [VERIFIED] PR #9 (bb413c4), MD5 911A0465… |
| CR-0008 (continuation branch only) | 24 Oct | Live tax rules per the TY2026-27 reckoner (KI-160 to KI-182, D-040) | A | IN PROGRESS: parts T1 to T4 IMPLEMENTED, NOT FULLY VERIFIED; T5 IN PROGRESS (unreviewed WIP) | TA-03, TA-07 | [VERIFIED] `CR-0008-live-tax-rules.md` on `continuation/ex-01-task-ta-03-20261027` 0f1c5d3; its line 551 "(none pushed)" is stale |
| [CR-0009](../change-requests/CR-0009-live-base-file-reading.md) | 27 Oct | Fix batch 4, base-file reading (KI-140 to KI-146, D-041) | A | VERIFIED COMPLETE (question 1 and the confirm-choices pending: PD-08, PD-42) | TA-04 | [VERIFIED] PR #16 = 6443826; live MD5 12B5E5727FCA01EF2EA162C59913F01D |
| CR-0010 (next free; MOD-02 allocates) | 23 Oct request | The owner's requests C2 to C6 from the second-export answers | A | NOT STARTED (not filed) | TA-09 | [VERIFIED] `git grep` finds no record |
| (no CR yet) | 27 Oct plan | Fix batch 5: KI-183, D-042 (no fallback on the live page), retire AG-13/AG-14 | A | PLANNED; MOD-02 decides whether it sits under CR-0009 or a new CR [UNCERTAIN] | TA-05 | [VERIFIED] no branch mentions it |

## 6. Suggested improvements

This section lists every improvement suggested so far: by the owner for the new build, by the owner for the live
page, by the previous owner, and by Claude. An improvement is not approved by being listed here. Approval comes
from the owner (product and financial rules) or from MOD-02 under D-033 (technical matters).

### 6.1 Improvements the owner asked for in the new build (51)

Origin is the owner in every row (the brief of 21 Oct or a later message). Status is on 28 Oct. [VERIFIED against
the roadmap, the merged PRs and NB-01's branch, 28 Oct.]

| # | Improvement (source) | Milestone | Status | Target task |
|---|---|---|---|---|
| 1 | One-page workspace in nine sections (brief Ph 3) | M1.2 | VERIFIED COMPLETE (shell); contents per rows below | TB-02 |
| 2 | Tabs across the top, full width (owner, 24 Oct; D-037) | PR #14 | VERIFIED COMPLETE | TB-04 |
| 3 | "MF Screener" link, new tab (brief Ph 4; D-027) | M1.2 | VERIFIED COMPLETE (live) | TB-02 |
| 4 | Embedded Screener view (brief Ph 4, optional) | none | SUPERSEDED (the Screener blocks embedding; D-027) | none |
| 5 | Base-file upload with stages, import report, validation (brief Ph 3 §1) | M1.4 | IN PROGRESS | TB-06, TB-07 |
| 6 | Portfolio overview: value, invested, gain, allocation, client and advisor allocation (brief Ph 3 §2) | M1.4 | IN PROGRESS | TB-06, TB-07 |
| 7 | KI-147 "no fallback" (owner, 24 Oct) | M1.4; live TA-05 | IMPLEMENTED, NOT FULLY VERIFIED (new build, local branch); PLANNED (live) | TB-06, TA-05 |
| 8 | Transactions (IRR) upload; XIRR against benchmark (brief Ph 3 §1) | M3 | PLANNED | TB-10 |
| 9 | Capital-gains upload in our format or the platform export (owner, 22 Oct; D-032, D-036) | M7 | design VERIFIED COMPLETE; code PLANNED | TB-05, TB-14 |
| 10 | Disclaimer and monthly files in the uploads (brief Ph 3 §1) | M9, M11 | PLANNED (M1.4 shows "not available") | TB-16, TB-18 |
| 11 | Analysts can upload the latest monitor (owner, OD-11, 19 Oct) | M2 | PLANNED | TB-09 |
| 12 | Screener pack upload each cycle, kept in the browser; track the monthly files (owner, 22 Oct; D-026) | M10 | slot PLANNED; file list VERIFIED COMPLETE | TB-17 |
| 13 | Portfolio 3Y and 5Y as weighted fund returns (owner, 22 Oct; D-023) | M3, M10 | PLANNED | TB-10 |
| 14 | Direct-equity 3Y and 5Y from prices by the owner's calculator (owner, 22 Oct; D-023) | M3, M10 | PLANNED | TB-10 |
| 15 | Drawdown comparison on Index TRI data (owner, 22 Oct; D-023) | M12 | PLANNED | TB-19 |
| 16 | Conditional Review Snapshot, Review Only and With Rebalancing (brief Ph 5) | M5, M8 | PLANNED | TB-12, TB-15 |
| 17 | Observation engine: evidence, diagnosis, implication, action; editable text (brief Ph 8) | M5 | PLANNED | TB-12 |
| 18 | One-slide SWOT (brief Ph 3 §3) | M5 | PLANNED | TB-12 |
| 19 | A fund pair overlaps from 35% (owner, 22 Oct; D-030) | M4, M5 | PLANNED | TB-11 |
| 20 | Missing value as a dash with a footnote; no dash in sentences (owner, 22 Oct; D-029) | all | IN PROGRESS (M1.4) | TB-06 |
| 21 | Four allocation slides into two, client level and advisor level (brief 6.1) | M4 | PLANNED | TB-11 |
| 22 | Fixed legend colours, grey outlines, horizontal legends, no gridlines (brief 6.1, Ph 9) | M1.4 then all | IN PROGRESS | TB-06 |
| 23 | Equity: market cap, sectors, top 3 sectors; no 2% rule on sectors (brief 6.2) | M4 | PLANNED | TB-11 |
| 24 | Debt items under 2% into "Others" with a note, no double count (brief 6.3) | M4 | PLANNED | TB-11 |
| 25 | Three credit-rating buckets (brief 6.4) | M4 | PLANNED (legacy KI-129 is an EXISTING DEFECT) | TB-11 |
| 26 | Client and advisor selectors for analytics and overlap (brief 6.5) | M4 | PLANNED | TB-11 |
| 27 | Historical analytics, Mar and Sep 2026 (brief 6.6) | M12 | PLANNED (backfill received) | TB-19 |
| 28 | Hybrid FoF look-through (brief 6.7) | M12 | engine PLANNED; real data BLOCKED (no FoF portfolios in the packs) | TB-19, PD-19 |
| 29 | Holdings sheet by value, distributor labels grouped, grey borders (brief 7.1, Ph 9) | M3 | PLANNED | TB-10 |
| 30 | MF quant metrics from the Screener with a fallback (brief 7.2) | M5, M10 | PLANNED | TB-12, TB-17 |
| 31 | Performance: centred columns, category order, no 2Y on debt, debt indices (brief 7.3) | M3 | PLANNED | TB-10 |
| 32 | Cambria 9 pt, native editable charts and tables (brief Ph 9) | M1.4 on, M9 | IN PROGRESS (C-08 only) | TB-06, TB-16 |
| 33 | Slide 8 pre and post CAGR projection (brief Ph 9) | M8 | PLANNED | TB-15 |
| 34 | Slide 9 redemption in units with rupees; no "Reinvest into" column (brief Ph 9) | M8 | PLANNED | TB-15 |
| 35 | Slide 6 Actionables in tan (brief Ph 9; D-031) | M8 | PLANNED | TB-15 |
| 36 | Slide 25 lighter grey borders (brief Ph 9; D-031) | M3 | PLANNED | TB-10 |
| 37 | Editable placeholder slides; logo lower right (brief Ph 9) | M9 | PLANNED | TB-16 |
| 38 | Market-update slides at the beginning (brief Ph 3 §8, Ph 9) | M9, M11 | PLANNED | TB-16, TB-18 |
| 39 | Annexure: one-pagers, product information, portfolio cost (brief Ph 3 §9) | M7, M9, M11 | PLANNED | TB-14, TB-16, TB-18 |
| 40 | Excel workbook with logical sheets and formulas (brief Ph 10) | M1.4 first sheets, M6 | IN PROGRESS (first sheets) | TB-06, TB-13 |
| 41 | Excel re-upload with validation, recalculation and a log (brief Ph 10) | M6 | PLANNED | TB-13 |
| 42 | Monthly update by one instruction; product bank from the Investment Reckoner (brief Ph 11) | M11 | PLANNED | TB-18, PD-33 |
| 43 | Public `monthly_updates/YYYY-MM/` tracked (brief Ph 1; D-023) | M11 | PLANNED (skeleton only) | TB-18 |
| 44 | Monthly PRD (sections A to I) and handover every cycle (brief Ph 12) | from 2026-10; M14 | PLANNED (template and checker VERIFIED COMPLETE) | TA-21, TB-21 |
| 45 | Reconciliation and a severity gate (brief Ph 13) | M1.4 basic, M13 | IN PROGRESS | TB-06, TB-20 |
| 46 | Outlier (six-sigma) checks (brief Ph 13) | M13 | PLANNED | TB-20 |
| 47 | The 24 acceptance cases (brief Ph 15) | each milestone | AC-01 IN PROGRESS; AC-22 NOT STARTED; others PLANNED | TB-22, TB-24 |
| 48 | Phase 2 groundwork: scenario model, unit records, proposal source (brief Ph 16) | M8, M16 | PLANNED | TB-15, TB-23 |
| 49 | Section-by-section architecture to approve (owner, 27 Oct) | blueprint page | page published; approvals BLOCKED (0 recorded) | TC-10, PD-27 |
| 50 | The owner's own issues list, "full revamp" (owner, 16 Oct) | CR-0006 open | BLOCKED (not sent) | TC-21, PD-34 |
| 51 | A separate chat to track the new build (owner, 22 Oct) | NB-01 | VERIFIED COMPLETE | none |

### 6.2 Improvements the owner asked for on the live page

| Id | Improvement | Origin | Status | Target task |
|---|---|---|---|---|
| IMP-O01 | C2: include hybrid funds' debt sleeves in average YTM and modified duration | Owner, 23 Oct (second-export answers) | NOT STARTED (no CR) | TA-09, PD-28 |
| IMP-O02 | C3: top 20 issuers with every rating group so they sum to 100% (KI-039) | Owner, 23 Oct | NOT STARTED | TA-09, PD-28 |
| IMP-O03 | C4 and C5: the ICICI fund aliases (KI-050), each alias approved under OD-5 | Owner, 23 Oct | NOT STARTED | TA-09, PD-36 |
| IMP-O04 | C6: embed the monthly PMS and AIF performance files | Owner, 23 Oct | NOT STARTED | TA-09, TA-10 |
| IMP-O05 | Make the monitor uploads correct (OD-11) | Owner, 19 Oct | NOT STARTED (KI-058, KI-076 open) | TA-13 |
| IMP-O06 | The accepted OD items not yet built (OD-1, 3, 4 in part, 5, 6, 8, 9, 10, 11, 13, 14, 15, 16, 18 to 24, 26, 35) | Owner, 19 and 21 Oct (D-021, D-022) | NOT STARTED | TA-18 |
| IMP-O07 | "No fallback" for Crore text on the live page (KI-147 answer applied to the live page) | Owner, 24 Oct | PLANNED | TA-05, PD-09 |

[VERIFIED: `git grep` finds no record of C2 to C6 on any branch; the OD build status is from KNOWN_ISSUES and the
audit decisions file. The C2 to C6 wording comes from the private intake note of the second export.]

### 6.3 The previous owner's promised features (by reference)

The previous owner promised 15 features that never shipped or shipped in part. They are listed in full in
[previous-owner-and-requirements.md §2.4](../new-build/inputs/previous-owner-and-requirements.md). The current owner
has not said which are still wanted (PD-32), so each is UNKNOWN / NEEDS INVESTIGATION. Where one overlaps later
work, the overlap is shown. [The overlaps are INFERRED from the item texts.]

| # | Feature (short name) | Overlaps with |
|---|---|---|
| 1 | Investment Reckoner fees for PMS and AIF cost | M11 product bank (TB-18) |
| 2 | Passive FoF look-through | brief 6.7 (TB-19) |
| 3 | Overlap matrix on the slides | KI-002, KI-003 (TA-15) |
| 4 | AI Analyst items (construction gap, minimum investment, exit load, weight sign-off, destination order, soft AMC target) | KI-029 (PD-37); M5 and M8 (TB-12, TB-15) |
| 5 | Exit Load file | none yet |
| 6 | The rest of the observation catalogue | M5 (TB-12) |
| 7 | Distributor-level IRR | M3 (TB-10) |
| 8 | Tax-rules upload slot and build script | D-036 dated table, M7 (TB-14) |
| 9 | Client rebalancing slides 6 and 7 | M8 (TB-15) |
| 10 | ICICI fund alias lines | C4, C5 (TA-09) |
| 11 | Weighted name matching for generic tokens | M2 matcher (TB-09) |
| 12 | AIF performance refresh | C6 (TA-09), monthly refresh (TA-10) |
| 13 | PMS and AIF look-through refresh | monthly refresh (TA-10) |
| 14 | Undecided UI questions (CVS reset, SOA name variants, hybrid debt sleeves, issuer top 30) | C2, C3 (TA-09) |
| 15 | Backend "vintage" ingestion and the private-organisation migration | none |

### 6.4 Improvements Claude proposed (not yet approved)

| Id | Improvement | Why | Origin | Status | Target task | Who approves |
|---|---|---|---|---|---|---|
| IMP-C01 | Protect `main` with required CI checks and no force-push | Today a mistaken force-push would rewrite public history unnoticed; AC-22 does not exist | Claude (handover investigation) | NOT STARTED (proposal) | none yet | Owner (it changes D-033) |
| IMP-C02 | Run CI on the TA-03 continuation branch now with `gh workflow run "Dashboard checks" --ref continuation/ex-01-task-ta-03-20261027`, or a draft PR | The branch has never run in CI; `ci.yml` accepts `workflow_dispatch` [VERIFIED ci.yml line 10] | Claude (critique) | NOT STARTED | TA-03 | MOD-02 |
| IMP-C03 | Regenerate the lockfile metadata (engines ">=24" in `package-lock.json` against ">=24.2" in `package.json`) | Keeps the toolchain record exact | Claude | NOT STARTED | TC-18 (next toolchain PR) | MOD-02 |
| IMP-C04 | Add `@types/node` so `scripts/*.ts` and `tests/**/*.ts` are type-checked | Only `app/src` is type-checked today (toolchain.md §2) | Claude (NB-01) | NOT STARTED (needs a recorded decision) | TB-25 | MOD-02 under D-033 |
| IMP-C05 | Upgrade SheetJS CE 0.18.5 (CVE-2023-30533, CVE-2024-22363) in the new app | Known vulnerabilities carried into M1.4 | Claude (NB-01, Q-12) | EXISTING DEFECT; upgrade NOT STARTED | TB-26 | MOD-02 (a D entry) |
| IMP-C06 | A Content-Security-Policy on the live page, and escaping of workbook text (KI-008) | The browser itself would enforce "no network" | Claude (audit batch 4) | NOT STARTED | TA-14 | MOD-02 (security fix under D-028) |
| IMP-C07 | Run `test-ai-analyst.js` in `pages.yml` too | Pages runs invariants, smoke and regression but not the AI Analyst test [VERIFIED pages.yml lines 46 to 50] | Claude | NOT STARTED | TC-18 (small CI PR) | MOD-02 |
| IMP-C08 | Guard `tools/render-slides.js` against writing outputs from a real base file inside the repository | It can take a real base file; outputs are ignored but would sit in the repo folder | Claude (architecture review) | NOT STARTED | TC-17 or TA-23 | MOD-02 |
| IMP-C09 | A port register and a launch entry for TA-03 browser QA (8099 live, 8100 new app, 8101 stale PR checkout, 8103 merged tabs worktree, 8106 M1.4, 8107 to 8126 NB-01 headless tests, 8133 to 8135 Workstream A QA (EX-01)) | Two chats can collide on a port; stale entries serve old code | Claude (critique) | NOT STARTED | TC-18 | MOD-02 |
| IMP-C10 | Keep `PRD_PRIVACY_DENYLIST` as a persistent user variable | Today every push must export it by hand or the scan runs generic rules only | Claude | NOT STARTED | TC-11 | Owner (PD-40) |
| IMP-C11 | Build AC-22 (force-push detection) or correct the documents that claim it | DECISIONS.md line 313, DEPLOYMENT.md line 45 and the roadmap claim it; ARCHITECTURE.md line 586 says "designed, not run" | Claude (critique) | NOT STARTED | TB-24 | MOD-02 |
| IMP-C12 | Extend `check-invariants.js` ENGINE_KEYS (amcKey, xirr and the tax branch's four new keys) | The check does not enforce the documented engine surface | Claude | EXISTING DEFECT (tooling) | TA-22 | MOD-02 |
| IMP-C13 | Reword the patch rebuild rule to "base MD5 plus this branch's new patches in order"; refresh `.blocks` and the legacy ARCHITECTURE line counts | The literal rule refuses on HEAD; citations drift | Claude | NOT STARTED | TA-23 | MOD-02 |
| IMP-C14 | Refresh the six agent definitions (qa-engineer's 17 checks and missing tools line; no mention of run-regression, data-extract, vendor-extract, prepush-scan, release-check) | Agents follow stale instructions | Claude | NOT STARTED | TC-17 | MOD-02 |
| IMP-C15 | Accept `continuation/` and `handover/` in release-check's branch pattern, or open those PRs from a `fix/` or `docs/` branch at the same commit | release-check only warns today [VERIFIED release-check.mjs lines 44, 271] | Claude | NOT STARTED | TC-23 | MOD-02 |
| IMP-C16 | A cross-reference, and later a mechanical comparison, between the legacy TAX_RULES and the new TR-1..TR-21 table | The two tables agree only by hand | Claude (coordination) | IN PROGRESS (cross-reference planned in the T5 docs) | TA-03, TB-14 | MOD-02; financial-domain-reviewer |
| IMP-C17 | A test that the block-marker strings copied in 7 places stay identical | No test cross-checks the copies | Claude (architecture review) | NOT STARTED | ARC-01 | MOD-02 |
| IMP-C18 | First push of each branch with `git push -u origin <branch>` (four local branches track `origin/main`) | A plain `git pull` would merge main in; a plain `git push` is refused | Claude | NOT STARTED | TC-18, TB-08 | MOD-02 |
| IMP-C19 | Preserve NB-01's local-only work off this laptop | 26 commits exist only here | Claude | NOT STARTED | TB-08 | MOD-02 under D-033 |
| IMP-C20 | Let the parity matrix count work that is already merged | It understates progress (rows for merged work read "not started") | Claude (NB-01 docs) | NOT STARTED | TB-28 | MOD-02 |
| IMP-C21 | Clean up stale worktrees and branches, only after TB-08 | 23 worktrees (22 besides the main checkout), many stale | Claude | NOT STARTED (report only) | TC-18 | Owner confirms any deletion |
| IMP-C22 | One KI id per build for the prototype-key defect (KI-151 new app, KI-183 live), cross-referenced | One defect has two ids | Claude | PLANNED | TB-27 | MOD-02 |
| IMP-C23 | Rerun the second export's independent check without working around authentication | It failed with HTTP 401 and was not rerun [UNCERTAIN] | Claude | UNKNOWN / NEEDS INVESTIGATION | TC-16 | MOD-02 |
| IMP-C24 | Republish the blueprint approval page with current statuses before asking for approvals | Section 0 still shows "In progress" | Claude | NOT STARTED | TC-10 | MOD-02 |
| IMP-C25 | Leave the 15 Aug FUND_RANKS scores in the live page until switch-over and never add newer ones | Removing them now drops live features; D-026 keeps new scores private | Claude (lead) | NOT STARTED (proposal) | TA-24 | Owner (PD-26) |

## 7. Change log of this file

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version, for the MOD-01 to MOD-02 handover |
| 30 Oct 2026 | MOD-01 (fixer pass) | REQ-055 worded as "a credential the owner holds" with no link to a pending decision; IMP-C09 ports 8133 to 8135 are Workstream A (EX-01); IMP-C21 worktree count; IMP-C25 status word |
