# Development backlog

DRAFT, 24 Nov 2026, MOD-03 (CHAT-006); revised after the independent review. The continuous queue of charter PD-65
("never idle"). Ordered by what unblocks the most. Module IDs as in [CODING_MAP.md](CODING_MAP.md); task ids (TA-, TB-)
as in [TASK_REGISTER.md](../project-control/TASK_REGISTER.md), which keeps each task's full card. Labels: [V] verified,
[I] inferred, [U] unknown.

**Rule:** a blocked item never blocks the queue. When an item waits on the owner, its pure parts are done now in
their own worktree and the blocked part is gated (not wired, not merged) until the answer comes.

**Scope rule:** "executable now" holds only approved M2 sprints, contract types tied to M2, gates-only work (TA-03 under
PD-64) and routine operations. The owner has approved only P03-S01 and P03-S02 [V OWNER_DECISIONS_MOD-03.md:35, :47];
everything else is in §2 as "needs phase approval" until the owner answers card question 1.

**Before any draft goes to `docs/coordination/`:** run `prepush-scan.mjs` with `PRD_PRIVACY_DENYLIST` exported (path
only, never read) and `docs-links.mjs`; `PROPOSED-WORKSTREAMS.md` stays private.

## 1. Executable now (priority order)

| # | Task | Module | Owner | Class | Unblocks | Isolation |
|---|---|---|---|---|---|---|
| 1 | TA-03: take-main done (`d7683a0` [V]); Gate A with a from-scratch file-name-order replay proof; then Gates B-D (gates only, PD-64) | LP-01 | EX-02 | C | LP-02, LP-04, LP-06, LP-11, OPS-02, I-21 stability (M7a), KI-186 comparison for M3a | TA-03 worktree only |
| 2 | Restore the merge identity and method to D-020 before the next merge (record wording: "merge identity restored to D-020") | OPS-01 | MOD-03; owner only if the GitHub e-mail account setting is chosen | A (partly owner-input) | every merge | none |
| 3 | M2.1 S1: Gate B GO at `aa9c943` [V ARC-02-state.md:187-189]; Gates C and D; owner demo and "publish" (Gate E, owner input) before the merge [V OWNER_DECISIONS_MOD-03.md:47; M2-PLAN-v2:25]; push, PR, merge | NB-M2.1a | ARC-02, MOD-03, owner | B | M2.3, M3b, M4b, I-28 | m2-1 worktree |
| 4 | M2-tied contracts: I-28 row ("types frozen, semantics versioned", S2a scheduled breaking change); I-29 widening decision before the S1 merge; I-30 with C-01 (`BaseFileImport`, `MoneyFinding` into `model/`, byte-identical `/next/`); I-41 Review extension and intake; I-42 status and gate shapes; I-43 legacy-coupling basis. Independent Gate C on MOD-03's own PRs | contracts | MOD-03 | A | M2.3 wiring, every later module | own branch `feat/contracts-*` |
| 5 | M2.3 S3 parsers continue (PMS, AIF, SOA, analytics) on synthetic files; upload buttons stay off; stacked on S1 | NB-M2.3 | NB-02 | B | M3b E-147 source, M4b uploads, M11 extraction | m2-3 worktree |
| 6 | Runbook update for the December refresh (MONTHLY_REFRESH: Other Funds, NSE converter, PDF slide route); merged before about 13 Dec, then EX-02 alone writes these files during the window | LP-19 | MOD-03 until EX-03 opens (waits on CHAT-010 opening) | A | the December refresh | docs branch |
| 7 | One consolidated owner card (charter format: What needs my decision / Why it matters / Impact / Recommendation / My decision), contents in §4 | all owner-blocked items | MOD-03 | none | §2 and §3 | none |
| 8 | 2026-10 monthly PRD and HANDOVER refresh (TA-21); TA-08; TA-23; TB-27 (KI-184 is not filed separately: it is on `d7683a0` and reaches main with LP-01 [V KNOWN_ISSUES.md:525 there]) | LP-19 | MOD-03 until EX-03 opens | A | M14 | docs branch, after #1 merges (hot records) |
| 9 | Parity hygiene for the approved M1.4: move its rows to "parity" where the ledger proves it; U-01, U-02, U-57 | NB-FU | MOD-03 (EX-03 once open) | A | M15 | docs branch |
| 10 | registers-4: D-046, PD-57..PD-65, CHAT_REGISTRY (ARC-02 as ARC-01's sole rule-10 successor), stale rows, Guardian findings, pointer rows to this folder. **Sanitise:** no private paths, session ids, file hashes of vendor or inbox files, or names; prepush-scan with `PRD_PRIVACY_DENYLIST` before the push | OPS-02 | MOD-03 (EX-03 may draft) | C | records accuracy; LP-10 | merge right after LP-01 |
| 11 | AC-22 ancestor check in CI, outside the refresh window (before 13 Dec or after the refresh merges) | NB-FU | MOD-03 | A | M15 | own branch |

## 2. Needs phase approval, or waits on a dependency

Items marked **PA** need the owner's phase approval (or a yes to card question 1); none starts before it.

| Task | Module | Owner | Waits on |
|---|---|---|---|
| 5a. M3a returns core: XIRR and IRR known answers (KI-006, KI-047, KI-048) | NB-M3a | NB-03 PROPOSED (waits on CHAT-011 opening) | PA (P03-S03); I-31, I-32, I-45; KI-186 part on LP-01 |
| 5b. KA known-answer file from KA-1..KA-22 (`cg-known-answers.json`) | NB-M7a | NB-03 PROPOSED | PA; PD-16 items 1, 2, 6, 7; LP-01 merged (I-21) |
| M7a reader (`ingest/capital-gains.ts`, blank template) | NB-M7a | NB-03 PROPOSED | PA |
| M7a engine (lots, rules, rollup, harvest) on the PD-16 defaults; no merge | NB-M7a | NB-03 PROPOSED | PA; M3a (I-32); merge after PD-16 answers and LP-01 |
| M2.2 classifier (new files only, not wired) | NB-M2.2 | NB-02 | S1 merged (sprint 2 order [V M2-PLAN-v2:183]); D-7; KI-051 order (owner) |
| M3b performance, holdings, C-21, C-22, C-24 | NB-M3b | NB-02 | PA; #3, #5, M3a |
| M4a, M4b | NB-M4a/b | NB-02 | PA; #3; I-33, I-45 |
| M5a framework (reuses `exports/pptx/text-lint.ts`); snapshot slots after I-35 | NB-M5a | MOD-03 | PA |
| M10 parser, schemas and store on a synthetic pack (vendored JSZip, decided) | NB-M10 | NB-04 PROPOSED (waits on CHAT-012 opening) | PA |
| M11a engine core; M12a drawdown on synthetic series (after I-44) | NB-M11a, NB-M12a | NB-04 PROPOSED | PA |
| M13 outliers and severity gate, per rule after its engine; I-42 first; deviation from the tracker recorded | NB-M13 | MOD-03 | PA (PHASE-05) |
| M6 Assumptions sheet, protection, re-upload structure check | NB-M6 | MOD-03 or NB-04 | PA; I-35; owner-run Office check at Gate C |
| M9a cover, dividers, disclaimer (Q-07 default to confirm), closing, picker | NB-M9a | NB-02 or MOD-03 | PA; I-35; owner-run Office check |
| LP-12 risk ratios runbook step | LP-12 | EX-03 PROPOSED | PA (P02-S01) |
| TA-05 fix batch 5 | LP-02 | EX-02 | #1 merged |
| Audit batches TA-12..TA-18 (12 open P0) | LP-06 | EX-02 | LP-02; one patch at a time |
| M5b rules and snapshot | NB-M5b | NB-03 or MOD-03 | PA; M3b, M4 |
| M7b, M8, M9b, M11b, M12b, M14 | see CODING_MAP | see CODING_MAP | PA; see [CRITICAL_PATH.md](CRITICAL_PATH.md) |

## 3. Owner-blocked (isolated)

| Item | Blocked by | What runs now instead | Isolation |
|---|---|---|---|
| NB-M2.1b matcher corrections | correction-order question (KI-036, KI-050, KI-051: live first under D-028, or new-build first?; PD-28 as written covers only C2-C6 [V DECISION_LOG.md:668-680]), PD-36, S2-Q3 | alias evidence list (docs) | no branch until answered |
| NB-M2.2 classifier and wiring | D-7 labels; KI-051 order (D-028 default: LP-16 first) | none | not imported by the overview |
| NB-M2.3 upload buttons | owner's yes to the SheetJS 0.20.2 download | parsers on vendored 0.18.5 | buttons not in the shell |
| NB-M7a engine merge | PD-16 items 1 to 7; LP-01 merged | engine on the defaults (after PA) | no merge |
| NB-M7b | M2.1b blockers, PD-05, PD-10 | none | none |
| NB-M9a disclaimer; NB-M4a/I-33 rating buckets | Q-07, Q-46 (defaults to confirm) [V open-questions.md:117-125, 423-433] | defaults | none |
| NB-M10, NB-M12b real data | PD-19; Index TRI files | synthetic packs and series (after PA) | real data never in the repo (D-026) |
| NB-M11b publication of Reckoner content | D-0, D-2, D-8 | none | nothing published |
| NB-M15 | REQ-021 sign-off, PD-26, PD-32 | parity hygiene (#9) | none |
| LP-01 Gate E | PD-01, PD-04, PD-44 (default: accept as built) | Gates A-D | branch not merged |
| LP-03 ISIN column (KI-184) | owner's ISIN answer; LP-01 merged (patch queue) | none | none |
| LP-04 grandfathering | PD-05 | none | none |
| LP-05 owner requests C2..C6 | PD-28, PD-36 | file the CR only | none |
| LP-07 IPS verdicts | PD-10 | none | none |
| LP-08 FUND_RANKS | PD-26 | none | none |
| LP-09 dashes and overlap | PD-31 | none | none |
| LP-10 Office-safe Step 3 | PD-55; OPS-02 merged (rule-10 successor named) | the PDF route as an option for the owner | no script merged |
| LP-11 footnote dates | PD-63 | none | after LP-01 |
| LP-13 Reckoner reader | PHASE-02 approval, a CR, D-2, D-4 [V tracker:181, 252; STAGE2_PLAN_DRAFT:78; scope note:56] | none (synthetic fixtures only once approved) | no real grid content in the repo until D-2 |
| LP-14 direct-equity returns | PD-62 | none | none |
| LP-15 product list | D-0, D-2, D-4, D-7, D-8, D-9 | none | no merge |
| LP-16 KI-051 | D-7; KI-051 order | none | none |
| LP-17 international terms and aliases | owner term list; PD-36 per alias; patch queue after LP-01 | measure only | none |
| LP-18 look-through refresh | Q-24 (managers' strategy workbook); patch queue | none | never a client file |
| LP-20 two pager pages | owner's PDF or images | none | none |
| LP-22 TA-11 Office check | owner-run | none | none |
| LP-23 SheetJS security patch | owner's yes to the download; patch queue | none | none |
| OPS-03 housekeeping | owner's word per worktree | list worktrees whose head is on origin (`git branch -r --contains`) | no branch deleted (CLAUDE.md rule 8); much work is not on origin [V: `aa9c943`, `1e3d7df` on no remote; TA-03 86 ahead; `wf_c3548c88-811-*`, `wf_ca03729e-33b-*` without upstream] |

## 4. Owner card contents (one card, charter format, with defaults)

1. Does PD-65 let MOD-03 start roadmap milestones beyond M2 (M3 onward, PHASE-01/02/04/05 sprints) without a
   per-phase approval? Until answered, they show "needs phase approval".
2. Matcher and classifier corrections (KI-036, KI-050, KI-051): live first under D-028, or new-build first? (separate
   from PD-28, which covers C2-C6).
3. PD-01, PD-04, PD-44 (LP-01 Gate E); the ISIN question; D-7 labels; PD-28 (C2-C6); PD-36 batch; S2-Q3.
4. PD-16 items 1 to 7 (M7a tax logic and PAN grouping); PD-05; PD-10.
5. Defaults to confirm: Q-46 rating buckets; Q-07 disclaimer text.
6. PD-55 or the PDF route; pager pages; international terms; Q-24; D-0, D-2, D-4; SheetJS download.
7. December file list.
8. OPS-03: permission per worktree whose head is on origin; no branch deletion.
9. Chat openings: CHAT-010 EX-03, and (after question 1) CHAT-011 NB-03, CHAT-012 NB-04, CHAT-013 ARC-03, with title
   and prompt ready if MOD-03 cannot open them.
10. OPS-01, only if the GitHub e-mail account setting is the chosen route.
