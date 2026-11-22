# New-build handover (Workstream B), 28 Oct 2026, version 1

**Written:** 28 Oct 2026 (IST) by MOD-01, the outgoing coordinating chat, on branch
`handover/mod-01-to-mod-02-20261028` (base `main` at `6443826`).
**For:** MOD-02 (the successor Moderator), NB-01 (the new-build chat, which continues under MOD-02) and, only if MOD-02
judges NB-01's context unreliable, its successor NB-02.
**Scope:** Workstream B only: the new application of CR-0006, previewed at `/next/`. The live page (Workstream A) has
its own handover, [EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md](EXISTING_DASHBOARD_HANDOVER_2026-10-28_v1.md); the
whole project is in [MASTER_HANDOVER_2026-10-28_v1.md](MASTER_HANDOVER_2026-10-28_v1.md).

**How to use this document.**
- It is a dated snapshot that stands on its own for Workstream B. The registers in
  [`docs/project-control/`](../project-control/README.md) own the ids, statuses and SHAs, and git wins over every
  document. Run the read-only checks in
  [REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md#verify-before-you-trust)
  before acting on any value here. A later state goes into a new dated version; this file is never rewritten.
- **Labels.** [VERIFIED] with its evidence (a SHA, a file and line, or a command); [INFERRED]; [UNCERTAIN]; [UNKNOWN].
  "Reported" means NB-01 said so in its state report of 27 Oct and nobody has re-run it.
- **Status words** are the owner's nine, defined in [project-control/README.md](../project-control/README.md#3-ids-and-status-words).
- **Nothing private is here.** Client data, file locations, anything about credentials, MF Screener pack contents,
  session details and the link to the owner's private approval page are in the private supplement,
  `C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md`, on the owner's laptop.
- The copy-ready message that resumes NB-01, and a full successor prompt for NB-02 in case it is needed, are in
  [continuations/NB-01_RESUME_NOTE_2026-10-28.md](continuations/NB-01_RESUME_NOTE_2026-10-28.md).

## Contents
0. [The state in twelve lines](#0-the-state-in-twelve-lines)
1. [The owner's brief and decisions](#1-the-owners-brief-and-decisions)
2. [Architecture and toolchain](#2-architecture-and-toolchain)
3. [Milestones M1.1 to M16 and the ETA](#3-milestones-m11-to-m16-and-the-eta)
4. [M1.4 in detail](#4-m14-in-detail)
5. [Improvements the owner asked for that are not built yet](#5-improvements-the-owner-asked-for-that-are-not-built-yet)
6. [The capital-gains design (D-036) and its open questions](#6-the-capital-gains-design-d-036-and-its-open-questions)
7. [Parity ledgers and coordination with Workstream A](#7-parity-ledgers-and-coordination-with-workstream-a)
8. [The blueprint approval page](#8-the-blueprint-approval-page)
9. [Local-only work and how to preserve it](#9-local-only-work-and-how-to-preserve-it)
10. [Ownership, numbering and ports](#10-ownership-numbering-and-ports)
11. [Risks](#11-risks)
12. [Owner decisions the new build waits for](#12-owner-decisions-the-new-build-waits-for)
13. [Stale new-build records](#13-stale-new-build-records)
14. [What this handover could not establish](#14-what-this-handover-could-not-establish)
15. [Change log](#15-change-log)

## 0. The state in twelve lines

1. **The preview is live and unchanged since 27 Oct.** `/next/` serves 46,905 bytes, SHA-256
   `0407eb12033ec8c1432fb787f9c5956200318c84f0172f3a4c8243a50ee73693`: the nine-section shell with tabs across the top,
   the preview banner and the single MF Screener link. The live page `/` is untouched by Workstream B: MD5
   `12B5E5727FCA01EF2EA162C59913F01D`, equal to `main`. [VERIFIED: size and hashes by `curl` with `sha256sum` and
   `md5sum` on 28 Oct, against `git show origin/main:index.html | md5sum`; the page's content (CSP, banner, one link)
   read by the workstream B investigation the same day]
2. **Merged so far:** Phase 0, M1.1, M1.2, M1.3, the tabs layout (D-037) and the capital-gains design (D-036): PRs #8,
   #10 to #15. [VERIFIED: `git log --merges --first-parent origin/main`]
3. **M1.4 is built but exists only on this laptop.** `feat/m1-4-overview` at `07a6460` (23 commits ahead of `main`) and
   three round-2 fixer commits G1 `4610684`, G2 `be7f395`, G3 `202f8f6`: 26 commits, never pushed, never run in CI,
   never scanned with the private deny-list. [VERIFIED: `git branch -r --contains 07a6460` empty; none of the four in
   `git ls-remote origin`, 28 Oct]
4. **The first step is preservation (TB-08):** a read-only pre-push scan, then a plain push of the four branches with no
   PR (section 9).
5. **The M1.4 head fails 4 tests**, all expected and fixed by G1. NB-01 counts 837 tests; an independent run counted
   773; the cause is [UNKNOWN] (section 4.3).
6. **Round 2:** G1 and G3 are IMPLEMENTED, NOT FULLY VERIFIED (reported test runs); G2 has never been tested.
7. **Left for M1.4:** integrate G1 to G3, docs, full checks, round-3 reviews, PR, merge, Pages check (section 4.5).
8. **NB-01 is WAITING** at a safe point since its state report of 27 Oct. It continues as NB-01 under MOD-02 unless
   MOD-02 judges its context unreliable. [VERIFIED: CHAT_REGISTRY; 1 compaction]
9. **Coordination with Workstream A:** the owner's KI-147 answer "no fallback" is built in the new app (D-039) and
   planned on the live page as D-042 (TA-05). The parity entries AG-13 and AG-14 retire with whichever of TA-05 or M1.4
   merges second. M1.4 and the tax batch TA-03 conflict in four documentation hunks. Merge order follows the
   readiness rule (section 7).
10. **Owner decisions:** none answered. PD-09 matters first for the new build, then PD-08, PD-11 to PD-16, PD-19, PD-27,
    PD-33 and PD-45 (section 12).
11. **The owner's blueprint approval page** has 17 sections, 83 sub-items and 0 approvals; some statuses on it are
    stale (section 8).
12. **ETA** (NB-01, 27 Oct): M1.4 about 5 Nov, now at risk; side-by-side testing from about 22 Dec; switch-over early
    January (section 3).

## 1. The owner's brief and decisions

### 1.1 The brief of 21 Oct 2026

The owner's brief is merged as a sanitised copy, [00-owner-brief.md](../new-build/00-owner-brief.md) (PR #8). Its
central rule: build a clean new application without losing any review capability the current dashboard has, and keep
the current system running until the new one reaches parity. [VERIFIED: the brief's GOAL section; REQ-036]

It has Phase 0 (audit and nine deliverables) and Phases 1 to 16. The roadmap maps them onto milestones
([07-implementation-roadmap.md](../new-build/07-implementation-roadmap.md) section 1) [VERIFIED]:

| Brief phase | Milestones |
|---|---|
| 0 Audit and new build | Phase 0 deliverables; M1.1 records them; M15 closes parity |
| 1 Git organisation and delivery | M1.1, every milestone, M11 (public monthly folder), M15 |
| 2 Single data and calculation model | M1.3 (model), M2 (identifiers), every engine milestone |
| 3 Information architecture (one page, nine sections) | M1.2 (shell), filled by M1.4 to M9 |
| 4 MF Screener access | M1.2 (link in a new tab, D-027), M10 (data pack) |
| 5 Conditional Review Snapshot | M5 (Review Only), M8 (with Rebalancing) |
| 6 Allocation, equity, debt, overlap | M1.4 (allocation), M4, M12 |
| 7 Holdings and performance | M3; quants in M5 and M10 |
| 8 Observation engine | M5 (v1), M8 |
| 9 PowerPoint output | M1.4 (first slide), M3 to M8, M9 (whole deck) |
| 10 Excel workbook | M1.4 (first sheets and writer), M6 (model and re-upload) |
| 11 Monthly update workflow | M2, M11 |
| 12 Monthly PRD and handover | M1.1 (template); a hand-written monthly PRD every cycle from the 2026-10 data month; M14 (generation) |
| 13 Financial validation and audit | every milestone, M13 |
| 14 QA | every milestone, M9, M15 |
| 15 Tests and acceptance (24 cases) | every milestone, M15 |
| 16 Phase 2 readiness | M8, M16 |

### 1.2 What the owner said about the new build after the brief

[VERIFIED: the owner's messages in both chats, read on 28 Oct; requirement ids in
[REQUIREMENTS_AND_CHANGE_REGISTER.md](../project-control/REQUIREMENTS_AND_CHANGE_REGISTER.md)]

| Date (IST) | Instruction | Recorded as |
|---|---|---|
| 16 Oct | The owner has found several issues with the existing dashboard and wants major design changes; the owner's own list was promised and has not arrived | REQ-030, PD-34 |
| 22 Oct | Vendor files may be published; drawdown is compared on index data; the portfolio's 3Y and 5Y returns are the weighted average of fund returns; direct-equity 3Y and 5Y come from prices by the owner's calculator | D-023 |
| 22 Oct | Answers to ND-1, ND-5, ND-6, ND-8 and ND-10: Screener scores never public and the pack uploaded each cycle; a dash alone for a missing value and never a dash in a sentence; a fund pair overlaps from 35%; the capital-gains format may be our own; no branch protection, Claude in full charge. The lead decided ND-2, ND-3, ND-4, ND-7 and ND-9 under D-033 | D-024 to D-033 |
| 22 Oct | A separate chat to build and track the new build | NB-01 (REQ-063) |
| 24 Oct | KI-147, in the owner's words: "no fallback". A Crore cell that is not a number makes the holding invalid; it is excluded and listed | D-039 point 1(a) (branch only); D-042 planned for the live page |
| 24 Oct | Section tabs to change; the message says "vertical", built as tabs across the top | D-037 |
| 27 Oct, 11:43 | The owner approved the tabs layout and asked for M1.4 to be built on it | D-037; TB-04 |
| 27 Oct | Progress, links and ETA; decisions explained in plain language; the new build's architecture divided into sections and sub-sections so the owner can approve each one | REQ-035, REQ-068, REQ-069 (the blueprint page, section 8) |
| 27 Oct, evening | Stop, hand over, and run the project with a Moderator, a Guardian, gates A to E and the registers | REQ-070 to REQ-079 |

The owner's KI-147 wording does not mention placeholders such as "NA". Treating them as blank is Claude's reading and
is put to the owner as PD-09. [VERIFIED: D-039 text on `feat/m1-4-overview`; DECISION_LOG PD-09]

### 1.3 Decisions that govern the new build

Full texts are in [docs/DECISIONS.md](../DECISIONS.md); the index is
[DECISION_LOG.md](../project-control/DECISION_LOG.md). [VERIFIED: decision headings on `origin/main`,
`feat/m1-4-overview` and the TA-03 continuation branch, 28 Oct]

| D | What it decides for the new build | By | Build status, 28 Oct | Where the text is |
|---|---|---|---|---|
| D-023 | Publishing vendor files; drawdown on index data; weighted 3Y and 5Y; direct-equity returns | owner | PLANNED (M3, M11, M12) | `main` |
| D-024 | Public `/next/` preview with a banner; nothing goes to clients before switch-over | lead (ND-3, ND-9) | banner VERIFIED COMPLETE; preview marker on exports IN PROGRESS (M1.4) | `main` |
| D-025 | npm for pinned build tooling | lead (ND-2) | VERIFIED COMPLETE | `main` |
| D-026 | Data classes P, C, N; the Screener pack and its scores are never public; the pack is uploaded each cycle and kept in the browser | owner (ND-1) and lead | slot PLANNED (M10) | `main` |
| D-027 | The MF Screener link is the only remote URL | owner's brief | VERIFIED COMPLETE (live) | `main` |
| D-028 | During the parallel run the live page takes calculation, data and security fixes only | lead (ND-4) | in force | `main` |
| D-029 | A missing value is a dash alone; sentences never contain a dash | owner (ND-5) | IN PROGRESS (M1.4) | `main` |
| D-030 | Observation thresholds; a fund pair overlaps from 35% | owner (ND-6) | PLANNED (M4, M5) | `main` |
| D-031 | 0.5 pt #D9D9D9 table borders; tan Actionables column | lead (ND-7) | tokens on the M1.4 branch; slides PLANNED | `main` |
| D-032 | Capital-gains statements in our own template | owner (ND-8) | amended by D-036 | `main` |
| D-033 | Claude in full charge of GitHub and the dashboard; no ruleset | owner (ND-10) | in force; its AC-22 claim is unbuilt (TB-24) | `main` |
| D-034 | Toolchain, one offline file, hash CSP; a failing preview never blocks the live page | lead | VERIFIED COMPLETE | `main` |
| D-035 | `data/refdata` generated in the repository; base-file conventions; BF-01 to BF-25 except BF-19 accepted | lead | VERIFIED COMPLETE (BF-19 and BF-26 with the owner) | `main` |
| D-036 | The capital-gains upload accepts the platform's export as it is, plus a blank template | lead | design VERIFIED COMPLETE; code PLANNED (M7) | `main` |
| D-037 | Section tabs across the top; the Screener link in the masthead | owner | VERIFIED COMPLETE | `main` |
| D-038 | Vendored libraries, the STORE zip, downloads under the CSP | lead | IMPLEMENTED, NOT FULLY VERIFIED | `feat/m1-4-overview` only (local) |
| D-039 | Portfolio overview rules 1 to 15, including KI-147 "no fallback" (point 1(a) is the owner's answer) | lead and owner | IMPLEMENTED, NOT FULLY VERIFIED | `feat/m1-4-overview` only (local) |
| D-040 | Live tax defaults (Workstream A); its cross-reference to the capital-gains design section 10 is planned | lead | IN PROGRESS (TA-03) | TA-03 continuation branch |
| D-041 | Live base-file reading (fix batch 4); its question 1 decides both builds (PD-08) | lead | live VERIFIED COMPLETE; new-build alignment (KI-148) IN PROGRESS on G1 | `main` |
| D-042 | Planned: the live page's "no fallback", amending D-041 point 4 | EX-01 writes it | PLANNED (TA-05) | not written |

Other id series used by the new build: TR-1 to TR-21, LD-1 to LD-42 and KA-1 to KA-22 (the capital-gains design);
BF-01 to BF-26 (base-file parity ledger); AG-01 to AG-14 (aggregation parity ledger, branch only); E- and U- rows of the
Phase 0 inventories; L1 to L29 and N1 to N19 (NB-01's round-1 and round-2 fix decisions for M1.4, kept in NB-01's
private working notes). [VERIFIED: DECISION_LOG section 1.2]

## 2. Architecture and toolchain

### 2.1 The eight architecture decisions

From [03-architecture.md](../new-build/03-architecture.md) section 1 [VERIFIED]:

| Id | Decision | State |
|---|---|---|
| A1 | TypeScript (erasable syntax only), Preact 10.29.x, bundled by esbuild 0.28.2 into **one offline HTML file**; npm for pinned tooling only | decided (D-025, D-034) |
| A2 | The runtime libraries are copied byte for byte from the live page: PptxGenJS 3.12.0 (with its JSZip), SheetJS CE 0.18.5, Chart.js 4.4.0, chartjs-plugin-datalabels 2.2.0, each pinned by SHA-256 | done on the M1.4 branch (D-038) |
| A3 | Excel is written by a small in-house SpreadsheetML writer, gated by a spike; ExcelJS 4.4.0 was the fallback | the spike passed in Excel on 27 Oct, so ExcelJS is not needed (reported in D-038) |
| A4 | One shared model and one engine produce every number; the screen, the deck and the workbook only render view-models | decided (brief) |
| A5 | Side by side: the new app at `/next/` with a banner; at parity the new app moves to `/` and the live page to `/legacy/` | decided (D-024) |
| A6 | A data-class policy (P publishable, C private until approved, N never) decides what is published | decided (D-023, D-026) |
| A7 | Stable identifiers first (ISIN, AMFI code, vendor key, product-bank id), names last; aliases need the owner's approval (OD-5) | decided |
| A8 | A typed missing-data status on every value; the dash on screen and slide always carries a footnote | decided (brief, D-029) |

### 2.2 Toolchain, build and serve

[VERIFIED: `package.json` and `.npmrc` on `main`; [REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md#runtimes-and-toolchain)]
- Node v24.21.0 and npm 11.19.0 in `C:\dev\tools\node` (D-006). Dev dependencies pinned exactly: esbuild 0.28.2,
  preact 10.29.8, typescript 7.0.2. `.npmrc`: `ignore-scripts=true`, `save-exact=true`, `fund=false`, `audit=false`.
  Always `npm ci`, never `npm install` (except a deliberate, reviewed pin change).
- `npm run typecheck` checks `app/src` only; `scripts/*.ts` and `tests/**/*.ts` are not type-checked until a recorded
  decision on `@types/node` (TB-25).
- `npm run build` writes `app/dist/index.html` (git-ignored), byte-deterministic, with the CSP meta tag first (script
  and style hashes, `connect-src 'none'`) and static navigation.
  `node scripts/validation/check-next.mjs --rebuild` checks the built page (no network API, one remote URL, the banner,
  no en or em dash in static text, the size budget) and that two builds are byte-identical.
- `node scripts/serve.mjs` serves the live page at `http://127.0.0.1:8100/` and the new app at `/next/` (launch
  configuration `next`).
- The M1.4 branch adds the npm scripts `vendor:extract`, `accept:office` (Office acceptance through COM, `--full`) and
  `accept:office:spike`. [VERIFIED: `git show feat/m1-4-overview:package.json`]
- Engines: `package.json` says node ">=24.2", the lockfile's root entry ">=24" (IMP-C03, TC-18).

### 2.3 CI, Pages and the safety tooling

[VERIFIED: [ARCHITECTURE_AND_DEPENDENCY_MAP.md](../project-control/ARCHITECTURE_AND_DEPENDENCY_MAP.md#8-ci-and-pages)]
- **CI job `next`** ("Dashboard checks"): privacy scan of the docs (generic rules only), docs links, monthly PRD check,
  `npm ci`, typecheck, build, `check-next --rebuild`, `node --test` in IST and in UTC, traceability,
  `data-extract --check`, then `release-check --ci`. M1.4 adds `vendor-extract --check`. CI runs on pull requests,
  pushes to `main` and by hand (`gh workflow run "Dashboard checks" --ref <branch>`), not on a plain branch push.
- **Pages** publishes `/` as a byte copy of `index.html` and `/next/` as the build only when `check-next` passed;
  otherwise `/next/` becomes a notice. A failing new app never blocks the live page (D-034). Pages runs on pushes to
  `main` that touch `index.html`, `app/**`, the package files, `scripts/build.mjs`, `check-next.mjs` or `pages.yml`.
- **Safety tooling on `main`** (VERIFIED COMPLETE, CI green): `privacy-scan.mjs`, `prepush-scan.mjs` with the
  `scripts/hooks/pre-push` hook, `docs-links.mjs`, `release-check.mjs`, `monthly-prd-check.mjs`, `traceability.mjs`,
  `check-next.mjs`. The private deny-list is read only through `PRD_PRIVACY_DENYLIST`, which is not set permanently
  (PD-40), so CI and any push without the variable use the generic rules only. **AC-22** (force-push detection) is
  described as CI-blocking in `docs/DECISIONS.md:313`, `docs/DEPLOYMENT.md:45` and the roadmap, but does not exist;
  `docs/ARCHITECTURE.md:586` says "designed, not run" (TB-24).

### 2.4 Module map

The modules on `main` and what M1.4 adds are listed in section 7 of
[ARCHITECTURE_AND_DEPENDENCY_MAP.md](../project-control/ARCHITECTURE_AND_DEPENDENCY_MAP.md).
The new app's living architecture is [docs/ARCHITECTURE.md](../ARCHITECTURE.md), its data model
[docs/DATA_DICTIONARY.md](../DATA_DICTIONARY.md), its living PRD [docs/PRD.md](../PRD.md). The shared interfaces with
the live page (base-file rules, money columns, merged folios, `data/refdata`, the parity ledgers, the vendored
libraries, the two tax-rule tables) are I-01 to I-27 in
[INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md).

## 3. Milestones M1.1 to M16 and the ETA

The ETA column is NB-01's estimate given to the owner on 27 Oct, after MOD-01 had first said about 15 Dec for
switch-over. The roadmap itself promises no dates. [VERIFIED: requirements investigation of both chats; the roadmap's
own wording] The assessment column is [INFERRED].

| Milestone (size) | What it delivers | Evidence | Status, 28 Oct | NB-01 ETA | Assessment |
|---|---|---|---|---|---|
| Phase 0 | Nine deliverables, rule bank, deck design system, open questions, sanitised brief | PR #8 (`8cb320d`, 22 Oct), PR #10 (`2a65a62`, 22 Oct) | VERIFIED COMPLETE | done | done |
| M1.1 (S) | Safety tooling, records, folder skeleton, living docs, baseline tag `legacy-baseline-782794f` | PRs #10, #11 (`2ea9ba6`, 23 Oct); tag on origin | VERIFIED COMPLETE, except AC-22 (TB-24 NOT STARTED) | done | done |
| M1.2 (M) | Pinned toolchain, one offline file with hash CSP, `check-next`, nine-section shell, `/next/` | PR #12 (`3b28779`, 23 Oct); `/next/` live | VERIFIED COMPLETE | done | done |
| M1.3 (M) | Single model, base-file reader, `data/refdata`, BF ledger, traceability | PR #13 (`517becf`, 23 Oct) | VERIFIED COMPLETE (KI-148 open; BF-19, BF-26 with the owner) | done | done |
| Layout (D-037) | Tabs across the top; Screener link in the masthead | PR #14 (`c9ec1cc`, 27 Oct 12:55); live SHA-256 `0407eb12...` | VERIFIED COMPLETE | 28 Oct | done a day early |
| M7 design (D-036) | Capital-gains upload design and tax-rule table v1 | PR #15 (`fb7f59c`, 27 Oct 15:17); reviewer approval in the design's section 10.10 | VERIFIED COMPLETE (design only) | 29 to 30 Oct | done early |
| **M1.4 (M)** | Sections 1 and 2, slide C-08, overview workbook, D-038, D-039, KI-147 | `feat/m1-4-overview` `07a6460`, LOCAL ONLY; round 2 on three local branches | **IN PROGRESS** | about 5 Nov | at risk: pause for the handover, integration, round-3 reviews, a likely second merge of `main` |
| M2 (L) | Crosswalk, matcher, classification, header parsers, monitor uploads (OD-11) | no code on any branch | PLANNED | about 14 Nov | tight |
| M3 (L) | IRR parser, XIRR, returns per scope, D-023 returns, holdings C-21, performance C-22, Fund IRR C-24 | none | PLANNED | about 14 Nov | tight |
| M4 (L) | Look-through, three rating buckets, debt items under 2%, AMC, scopes, overlap, four allocation slides into two | none | PLANNED | about 24 Nov | |
| M5 (L) | Observation engine v1, Review Only snapshot, SWOT, quants, mode selector | the rule bank document only | PLANNED | about 24 Nov | |
| M10 (M) | Screener pack parser, validation, browser store, upload slot | none; the first packs were received and validated privately on 23 Oct | PLANNED; real-data use partly BLOCKED (details private, class N; PD-19) | about 24 Nov | build on synthetic packs |
| M6 (M) | Excel model and re-upload | none | PLANNED | about 5 Dec | |
| M7 (L) | Taxation: capital-gains parser and tax engine to the D-036 design, cost, IPS, Current vs Sample, MF Analysis | design merged | PLANNED | about 5 Dec | owner items open; the built defaults let code start |
| M8 (L) | Rebalancing, scenario model, Review with Rebalancing, slides C-27, C-30 to C-33, C-39 | none | PLANNED | about 5 Dec | |
| M9 (L) | Deck manifest, market update first, logo, Office acceptance | none | PLANNED | about 15 Dec | |
| M11 (L) | Monthly update engine, product bank, public `monthly_updates/` | skeleton only (README and `_policy`) | PLANNED | about 15 Dec | the October refresh stays on the live pipeline (TA-10) |
| M12 (M) | Historical analytics, fund-of-funds look-through, drawdown | none | PLANNED; fund-of-funds real data BLOCKED (PD-19) | about 15 Dec | |
| M13 (M) | Validation catalogue, outlier checks, audit hardening | a basic gate on the M1.4 branch only | PLANNED | from about 22 Dec | |
| M14 (M) | Monthly PRD and handover generation | template and checker on `main` | PLANNED | from about 22 Dec | the first hand-written PRD (TA-21) comes after the October refresh |
| M15 (M) | Parity sign-off and switch-over | parity matrix on the branch: 385 rows, 49 in progress, 336 not started, none at parity | PLANNED (owner sign-off, REQ-021) | early January | |
| M16 (S) | Phase 2 readiness pack | none | PLANNED | not in the ETA list; the blueprint says "groundwork by early January" | |

[VERIFIED: merge commits and dates from `git log --merges --first-parent origin/main`; milestone scope from the roadmap
section 2; matrix counts by the workstream B investigation on the branch]

Side-by-side testing starts from about 22 Dec; switch-over needs every parity row at parity or accounted for and the
owner's sign-off. [VERIFIED: NB-01's ETA message; roadmap M15]

## 4. M1.4 in detail

The task card is [TASK_REGISTER.md, TB-06 and TB-07](../project-control/TASK_REGISTER.md#tb-06-and-tb-07-m14-and-its-round-2-fixes);
the active-change entries are sections 2 to 5 of
[ACTIVE_CHANGE_REGISTER.md](../project-control/ACTIVE_CHANGE_REGISTER.md).

### 4.1 Branches and commits

| Ref | Head (IST) | Worktree | Holds | On origin |
|---|---|---|---|---|
| `feat/m1-4-overview` | `07a6460` (27 Oct 19:22), a merge of `main` `6443826` | `.claude/worktrees/m14` | M1.4 units U1 to U5, round-1 fixes (FA, FB, FC, FD; decisions L1 to L29), the integration and records commit `6015190` (27 Oct 18:11), the merge of PR #16. 236 files, +27,324/-492 against `main` | **no**; upstream wrongly set to `origin/main` |
| `worktree-wf_bdc6c774-599-1` (G1) | `4610684` (27 Oct 20:53) | `.claude/worktrees/wf_bdc6c774-599-1` | Reader, notes and parity (N1 to N5, N10, N11): KI-148, AG retirements, KI-151 label grid, negative market value, holder letter case; 20 files | **no**; no upstream |
| `worktree-wf_bdc6c774-599-2` (G2) | `be7f395` (27 Oct 20:57) | `.claude/worktrees/wf_bdc6c774-599-2` | Workbook money and percent formats, the share row outside the filter, Office scripts (N7, N8, N9, N15); 20 files | **no**; no upstream |
| `worktree-wf_bdc6c774-599-3` (G3) | `202f8f6` (27 Oct 20:48) | `.claude/worktrees/wf_bdc6c774-599-3` | Screen labels and notes, the C-08 pie layout, safe replacements (N12, N13, N14); 23 files | **no**; no upstream |
| `worktree-wf_ca03729e-33b-2..6`, `worktree-wf_c3548c88-811-1..4` | various | stale worktrees | M1.4 units and round-1 fixers, all contained in the local `feat/m1-4-overview`; FC `94f5d5b` is also on `811-3` | no |

[VERIFIED: `git log -1` of each ref, `git diff --shortstat origin/main...feat/m1-4-overview`, `git diff --name-only
07a6460 <head>`, `git status --porcelain` = 0 lines in m14 and the three fixer worktrees, 28 Oct]

Each fixer commit sits directly on `07a6460`. The only file two fixers both change is `tests/fixtures/make-books.ts`
(G1 and G2). G2 also changes `tests/helpers/node-wiring.ts`, which G3 asked for through a shared-file request.
[VERIFIED: `git diff --name-only` of the three commits]

### 4.2 What M1.4 builds

[VERIFIED as content in git (D-038, D-039, KI-147, KI-150, KI-151 texts on `feat/m1-4-overview`); behaviour not re-run
in a browser by MOD-01]
- **Section 1, uploads:** the base-file Upload, Validate, Preview and Review stages; the import report; the as-on date;
  labels; logo; a basic validation panel; the source register.
- **Section 2, portfolio overview:** KPIs; the asset and product table; pies; client and distributor matrices; notes;
  downloads.
- **Slide C-08** (asset allocation) with fixed colours by category name; post-processing that corrects several
  PptxGenJS 3.12.0 output defects the live decks carry (KI-150).
- **The overview workbook:** Read Me and Controls, Source Register, Holdings (as loaded), Portfolio Overview (every
  aggregate a SUMIFS), Client and Distributor Allocation (when shown), Audit Log, and a hidden `_manifest`; written by
  an in-house SpreadsheetML writer and a deterministic STORE zip (D-038 point 6).
- **D-038:** the four libraries vendored byte for byte with pinned allowances, checked by
  `node scripts/vendor-extract.mjs --check` in CI.
- **D-039:** the overview rules 1 to 15, including the KI-147 money-column rule (section 7.2) and Maps for every group
  keyed by a name, so that a label such as "constructor" is an ordinary label (KI-151).
- **Shared files it changes** (each a hotspot in
  [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#shared-hotspots-coordinated-by-mod-02)):
  `.github/workflows/ci.yml` (+2 lines, `vendor-extract --check`), `package.json` (three npm scripts),
  `scripts/validation/check-next.mjs` (pinned allowances; 225 lines changed), `CLAUDE.md`, `docs/DECISIONS.md`,
  `docs/KNOWN_ISSUES.md`, `docs/PROJECT_STATE.md`, `docs/TESTING.md`, `CHANGELOG.md`. It does not change `index.html`
  or `data/`. [VERIFIED: `git diff --stat origin/main...feat/m1-4-overview`]
- After M1.4 merges, `/next/` grows to about 2 MB (the local M1.4 build was 1,991,388 bytes). [INFERRED from the
  integration log]

### 4.3 Verification so far

| Where | What was run | Result | Label |
|---|---|---|---|
| `6015190` (round 1, before `main` `6443826` was merged in) | `node --test` in IST and UTC; browser spike; `overview.cdp`; browser QA; financial review; Office acceptance through COM; security gate | 837/837; spike 149/149; overview.cdp 112/112; QA PASS with 6 Low items; financial review approved with Low items; Office 12/12 but verdict **FAIL** on one medium item (the share row inside the filter, fixed by G2's N7); security **NO-GO** only because `main` had moved | reported by NB-01 |
| `07a6460` (head) | `node --test` | NB-01: 837 tests, 833 pass. Independent IST run of 28 Oct on an archive copy: 773 tests, 769 pass. The same 4 failures in both: the aggregation ledger ("every entry used"), the AG-01/AG-13 check, the KI-147 legacy expectation, the vendor-extract MD5 pin (expects `911A0465`, finds `12B5E572`) | both counts [VERIFIED]; the cause of 773 versus 837 [UNKNOWN] |
| `07a6460` | `check-invariants --expect-md5 12B5E572...`, `vendor-extract --check`, `data-extract --check` | pass | reported by NB-01 |
| G1 `4610684` | `node --test` | 904 tests, 902 pass. The 2 failures (`gate.test.ts:39` and `as-on-change.test.ts:205`, which must use `syn-total-rows` instead of `syn-total-like`) are fixed by G1's shared-file requests | reported by NB-01 |
| G2 `be7f395` | nothing | never tested: the run was stopped before G2 reported | [VERIFIED: NB-01 report] |
| G3 `202f8f6` | `node --test` | 864 tests, 860 pass; the 4 failures are the known ones G1 fixes | reported by NB-01 |

**Never done on any M1.4 commit:** a CI run, the pre-push scan with the private deny-list, a push, a release-check
report, Office acceptance on the final head (PowerPoint has not yet opened the two-line pie labels), and round-3
reviews. [VERIFIED: `gh run list`; NB-01 report]

The 4 head failures come from PR #16 (fix batch 4), which changed the live page after M1.4's parity expectations were
written; G1 updates the ledger and replaces the MD5 pin with an equality check of the library blocks. [INFERRED from the
G1 diff and NB-01's report; the incident is row 3 of
[INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md#6-integration-incidents-and-regressions-so-far)]

### 4.4 NB-01's round-2 decisions and where they landed

| Decisions | Fixer | Where | Label |
|---|---|---|---|
| N1 to N5, N10, N11 | G1 | `4610684` | [VERIFIED: commit subject] |
| N6 | G1 | covered by G1's `tests/regression/ki-151-prototype-labels.test.ts`, whose header cites "N5 and N6" | [VERIFIED: file header] |
| N7, N8, N9, N15 | G2 | `be7f395` | [VERIFIED: commit subject] |
| N12, N13, N14 | G3 | `202f8f6` | [VERIFIED: commit subject] |
| N16 to N19 | none found | in no G1, G2 or G3 diff | [UNKNOWN: done, deferred or dropped] |

The decision texts (L1 to L29, N1 to N19) and each fixer's shared-file requests and docs text are in NB-01's private
working notes and workflow journals, which sit in temporary session folders (their locations are in the private
supplement). [VERIFIED: NB-01 report section b] They are the only full record of the round-2 instructions; see risk
B-02 in section 11.

### 4.5 What is left, in order

1. **Preserve the work off this laptop** (TB-08, section 9).
2. **Take `main` if it moved.** `git fetch origin`; if `main` has moved (for example the tax batch TA-03 merged), merge
   it into `feat/m1-4-overview` (a merge, never a rebase). As the second to merge, resolve `docs/DECISIONS.md` (1 hunk:
   keep D-038, D-039 and D-040 in number order), `docs/KNOWN_ISSUES.md` (2 hunks) and `docs/PROJECT_STATE.md`
   (1 hunk), keeping both sides' rows; check `CHANGELOG.md` and `docs/TESTING.md`, which merge without a conflict but
   can still lose order. [VERIFIED: `git merge-tree` of `6443826`, the TA-03 branch and `feat/m1-4-overview`, 28 Oct]
3. **Integrate round 2 one fixer at a time:** G1, then G2 (resolve `tests/fixtures/make-books.ts`), then G3, each with
   its shared-file requests (G1: the two test files above and `overview.cdp.mjs`; G3: `tests/helpers/node-wiring.ts`
   from G2). Run and report G2's tests for the first time. Say what happened to N16 to N19.
4. **Explain the test count** (773 versus 837) before the PR.
5. **Docs** (from the fixers' docs text): D-039 points; `DATA_DICTIONARY.md` sections 5.3 and 8 (the merged-folio
   text is stale after D-041); KI-148 marked FIXED in the new app; the KI-151 and KI-183 wording, each citing the other
   (TB-27); the `CLAUDE.md` line for `overview.cdp` and its "M1.4 is next" sentence; the MD5 records; the stale new-build
   docs of TB-28 (section 13).
6. **Full checks** (Gate C, [project-control/README.md](../project-control/README.md#gate-c-independent-verification)):
   `npm ci`, `npm run typecheck`, `npm run build` (size and SHA-256), `check-next --rebuild`, `vendor-extract --check`,
   `node tests/browser/next-spike.mjs`, `npm run accept:office` (verdict PASS), `node --test` in IST and in UTC with 0
   failures, `traceability.mjs`, `data-extract --check`, `docs-links.mjs`, the privacy scan with the deny-list,
   `check-invariants --expect-md5 <main's MD5>` (proves `index.html` unchanged), `release-check.mjs`, and the pre-push
   scan with the deny-list on the final head.
7. **Round-3 reviews:** browser QA by qa-engineer (PASS), the financial-domain-reviewer (approve), Office acceptance
   (PASS), the security-release-reviewer (GO), ARC-01's Gate B (GO).
8. **PR:** the change-impact contract, the release-check report, the AG corrections, KI-148 done, what stays open, and
   the SheetJS CE 0.18.5 risk (CVE-2023-30533, CVE-2024-22363; TB-26).
9. **Merge after MOD-02's "go to merge"**, green CI on both jobs and ARC-01's GO: the D-020 local `--no-ff` merge in the
   main checkout with the exact message, push `main`, then Pages: `/next/` size and SHA-256 equal the build, and the
   live `/` MD5 equals `main`'s `index.html` (unchanged).
10. **Send MOD-02 the final KI-147 AG ids** (expected AG-13 and AG-14) so TA-05 can retire them, or retire them in this
    PR if TA-05 merged first (section 7.3).

**Accept when** every item above is evidenced in the Gate A to D records of
[INTEGRATION_AND_REGRESSION_LOG.md](../project-control/INTEGRATION_AND_REGRESSION_LOG.md#8-gate-records). Formal
acceptance of new-app behaviour comes at the parity sign-off (M15); MOD-02 reports each milestone to the owner with
links and verified and unverified labels. [INFERRED from D-024 and the roadmap]

### 4.6 Questions NB-01 must answer when it resumes (TC-05)

1. What do G2's tests show?
2. What happened to decisions N16 to N19?
3. Why do the test counts differ (773 in an IST run on an archive copy, 837 in NB-01's run)?
4. Did anything change after the state report? NB-01's last assistant turn was 27 Oct 21:35 UTC (28 Oct 03:05 IST),
   after the report of about 15:30 UTC. [VERIFIED: timestamp-only transcript scan]
5. Did NB-01 receive MOD-01's cross-session message of 28 Oct? It has no reply and its content is [UNKNOWN] here.
6. Are the decision files and workflow journals still readable, and do they contain anything that must not be copied
   (client data, credentials)?

## 5. Improvements the owner asked for that are not built yet

The full list of 51 owner-asked improvements, with source, milestone, status and task, is
[REQUIREMENTS_AND_CHANGE_REGISTER.md section 6.1](../project-control/REQUIREMENTS_AND_CHANGE_REGISTER.md#61-improvements-the-owner-asked-for-in-the-new-build-51).
Below, the row numbers of that table are grouped by the milestone that delivers them. Built and live: rows 1 (nine-section
shell), 2 (tabs), 3 (Screener link) and 51 (the separate chat); row 4 (an embedded Screener view) is SUPERSEDED because
the Screener blocks embedding. [VERIFIED against the merged PRs and the M1.4 branch, 28 Oct]

| Milestone | Owner-asked improvements still to deliver (row: short name) | Status |
|---|---|---|
| M1.4 (built, local, not merged) | 5 base-file upload with stages and validation; 6 portfolio overview; 7 KI-147 "no fallback"; 20 dash with footnote, no dash in sentences; 22 fixed legend colours, grey outlines, no gridlines (C-08 first); 32 Cambria 9 pt, editable charts and tables (C-08 first); 40 workbook first sheets; 45 reconciliation and severity gate (basic) | IN PROGRESS, or IMPLEMENTED, NOT FULLY VERIFIED on the local branch |
| M2 | 11 analysts upload the latest monitor (OD-11) | PLANNED |
| M3 | 8 transactions upload and XIRR against benchmark; 13 portfolio 3Y and 5Y weighted; 14 direct-equity 3Y and 5Y by the owner's calculator; 29 holdings sheet by value, grouped labels, grey borders; 31 performance formatting; 36 slide 25 lighter borders | PLANNED |
| M4 | 19 overlap from 35%; 21 four allocation slides into two; 23 equity market cap and sectors; 24 debt items under 2% into "Others"; 25 three credit-rating buckets; 26 client and advisor selectors | PLANNED |
| M5 | 16 Review Snapshot, Review Only; 17 observation engine; 18 one-slide SWOT; 30 MF quant metrics with a fallback | PLANNED |
| M6 | 40 full workbook model; 41 re-upload with validation, recalculation and a log | PLANNED |
| M7 | 9 capital-gains upload (code); 39 annexure portfolio cost (part) | design VERIFIED COMPLETE; code PLANNED |
| M8 | 16 Review with Rebalancing; 33 slide 8 CAGR projection; 34 slide 9 redemption in units; 35 slide 6 tan Actionables; 48 scenario model and unit records (part) | PLANNED |
| M9 | 10 disclaimer in the uploads (part); 37 editable placeholder slides, logo lower right; 38 market update first; 39 annexure (part) | PLANNED |
| M10 | 12 the Screener pack slot each cycle (the monthly file list is done) | PLANNED |
| M11 | 10 monthly files in the uploads (part); 42 monthly update by one instruction, product bank from the Investment Reckoner (PD-33); 43 public `monthly_updates/YYYY-MM/` | PLANNED |
| M12 | 15 drawdown on Index TRI data; 27 historical analytics; 28 hybrid fund-of-funds look-through | PLANNED; fund-of-funds real data BLOCKED (PD-19) |
| M13 | 45 the full severity gate; 46 outlier checks | PLANNED |
| M14 | 44 monthly PRD and handover every cycle (template and checker done) | PLANNED |
| every milestone, M15 | 47 the 24 acceptance cases (AC-01 IN PROGRESS; AC-22 NOT STARTED) | PLANNED |
| M16 | 48 Phase 2 groundwork | PLANNED |
| no milestone | 49 the blueprint approvals (section 8); 50 the owner's own issue list, not yet sent (PD-34) | BLOCKED |

**Also to weigh.**
- The previous owner's 15 promised features overlap several rows; the owner has not said which are still wanted
  (PD-32). [REQUIREMENTS_AND_CHANGE_REGISTER.md section 6.3](../project-control/REQUIREMENTS_AND_CHANGE_REGISTER.md#63-the-previous-owners-promised-features-by-reference)
  maps each to a milestone.
- Improvements Claude proposed for the new build, none approved yet: `@types/node` and type-checking of scripts and
  tests (IMP-C04, TB-25); the SheetJS upgrade (IMP-C05, TB-26); AC-22 or corrected documents (IMP-C11, TB-24); a
  mechanical comparison of the two tax tables (IMP-C16); a cross-check test of the block-marker copies (IMP-C17);
  preserving the local-only work (IMP-C19, TB-08); letting the parity matrix count merged work (IMP-C20, TB-28); the
  lockfile engines (IMP-C03); republishing the blueprint (IMP-C24).
  [REQUIREMENTS_AND_CHANGE_REGISTER.md section 6.4](../project-control/REQUIREMENTS_AND_CHANGE_REGISTER.md#64-improvements-claude-proposed-not-yet-approved)

## 6. The capital-gains design (D-036) and its open questions

### 6.1 What it is

[VERIFIED: [capital-gains-upload.md](../new-build/capital-gains-upload.md) on `main`, merged in PR #15]
- **D-036 amends D-032.** The analyst uploads the platform's capital-gains export as it is, or a blank template with
  the same headers for statements from other sources; one reader serves both. The PAN never enters the app: it is
  removed from every text cell at read time and only the count of removals is kept (point 2). Indicative tax is worked
  out per lot, per person and per financial year, with the analyst entering the slab rate, the surcharge rate and the
  regime, none of which has a default (point 3). Repeated lot rows are never dropped silently: the analyst decides per
  sale event whether to count them as stated or once (point 4). [VERIFIED: D-036 text on `main`]
- The design covers reading the file, lots and lot classes, repeated rows, reconciliation with the statement's
  totals, the tax view, **a dated tax-rule table v1** (section 10), validation results, the blank template, a synthetic
  fixture generator with known answers KA-1 to KA-22, and the M7 tests.
- **Approval.** The financial-domain-reviewer approved the design and the table on 27 Oct after revisions (section
  10.10); M7 code may start on it (section 15). [VERIFIED]
- **No code yet.** The reader (`ingest/capital-gains.ts`) and the tax engine (`engine/tax/`) come in M7; the table
  becomes `data/owner/tax-rules.json` then. [VERIFIED: INTERFACE_CONTRACTS I-21]
- The owner's sample statement holds personal data. It stays outside the repository; its location is private.

### 6.2 The interpretation decisions TR-1 to TR-21

| Id | Subject | Id | Subject |
|---|---|---|---|
| TR-1 | A sale on the anniversary day is short term (OD-2), long-term figure shown beside | TR-12 | Surcharge, cess, slab, rebate, basic exemption |
| TR-2 | FY 2024-25 order of the Rs 1.25 lakh exemption between 10% and 12.5% gains | TR-13 | A resident individual is assumed |
| TR-3 | Cost Inflation Index series before FY 2017-18 | TR-14 | Coverage from 1 Oct 2004; open-ended rules |
| TR-4 | The 2025 switch of the "specified" fund definition | TR-15 | Per person, not per family |
| TR-5 | Scheme mergers versus switches | TR-16 | "Listed" for non-equity units from 23 Jul 2024 |
| TR-6 | International, gold and silver, other fund-of-funds and ETFs | TR-17 | ELSS |
| TR-7 | Hybrid, arbitrage and equity savings funds; the usual bucket from tax year 2026-27 (LD-11) | TR-18 | Fund-of-funds of equity ETFs (the 90/90 class) in FY 2018-19 |
| TR-8 | Dating rate changes; the Income-tax Act 2025 | TR-19 | Section labels and year terms |
| TR-9 | The annual exemption shown per lot | TR-20 | Transfer date and boundary lots |
| TR-10 | Set-off order across rates | TR-21 | Dividend and bonus stripping |
| TR-11 | The grandfathering input | | |

[VERIFIED: section 10 of the design; summary by the workstream B investigation]

### 6.3 Open items for the owner (section 15 of the design; PD-16)

| # | Item | Recommendation |
|---|---|---|
| 1 | Realised lots follow the dated legal table instead of the older OD-17 bands and OD-2's single 12-month test | accept |
| 2 | Is a sale exactly on the anniversary short term? Courts differ | keep OD-2 (short term) until the tax adviser answers |
| 3 | May the reader number the distinct PANs in one file, in memory only, to group one person's lots, discarding each PAN at once and never storing, logging or exporting it? | yes |
| 4 | Two questions for the tax adviser: a gazette copy of the FY 2016-17 index value, and how the old 20%-or-10% choice applies (per lot or on the year's total, before or after set-off) | ask the tax adviser |
| 5 | Ask the platform's support whether its export repeats lot rows on purpose | ask |
| 6 | LD-10: in FY 2024-25 the single Rs 1,25,000 exemption is applied first to the 12.5% gains (the client-favourable order), the other order shown in a note | confirm |
| 7 | LD-11: from tax year 2026-27, aggressive hybrid, arbitrage and equity savings funds default to equity-oriented, labelled as the owner's reckoner's usual bucket | confirm (the live page's T5 already matches) |

None was answered by 28 Oct. The built defaults let M7 start. [VERIFIED: design section 15; DECISION_LOG PD-16]

### 6.4 The 26 "to be confirmed" research items (section 10.9; PD-45)

The reviewer listed 26 points of tax law that could not be confirmed from primary sources. Each shows a dash or a
flag in the new build until confirmed. The five ranked first: the FY 2016-17 index value; the FY 2024-25 exemption
order; dividend stripping (TR-21); the "listed" flag for close-ended schemes (TR-16); fund-of-funds of equity ETFs sold
in FY 2018-19. Recommendation: send these five to the tax adviser and leave the rest flagged. [VERIFIED: 26 bullets
counted in section 10.9 on `main`, 28 Oct]

### 6.5 Where the two builds' tax rules meet

- **Two tables, no mechanical link.** The live page's `REFDATA.TAX_RULES` (25 rows on `main`, 34 on the TA-03 branch)
  and the new table TR-1 to TR-21 agree only by hand. [VERIFIED: INTERFACE_CONTRACTS I-21] The D-040 text in the TA-03
  docs will cross-reference design section 10 (an EX-01 item). Any rate or rule change in either table: the
  financial-domain-reviewer, a known-answer test, the owner for the rule, and the other table's owner told in the same
  week. Risk RR-11.
- **The dated usual bucket is aligned.** The live tax batch's part T5 applies the usual-bucket default (aggressive
  hybrid, arbitrage, equity savings) only when the valuation date is on or after 1 Apr 2026, and otherwise leaves the
  fund unclassified with a reason, to match TR-7 and LD-11. [VERIFIED: the T5 patch header on `0f1c5d3`; agreed between
  MOD-01 and NB-01 on 27 Oct]
- **Two open differences, each an owner decision:** a fund-of-funds holding one equity ETF (the live page assumes
  equity-oriented; the new build lets the analyst choose, TR-6 and TR-18): PD-06. The slab rate used to order set-off
  (the live page assumes 30%, labelled; the new build shows a dash until set, D-036 point 3): PD-07.

## 7. Parity ledgers and coordination with Workstream A

### 7.1 The parity ledgers

A parity ledger classifies every difference between the live engine and the new app on the synthetic fixtures. Every
difference must match exactly one active entry, every active entry must be used, and a retired entry keeps its former
pattern and names the decision of the live fix that removed the difference. [VERIFIED: INTERFACE_CONTRACTS I-13, I-14]

| Ledger | Where | Active | Retired | Waiting for the owner |
|---|---|---|---|---|
| Base file (BF), `tests/parity/base-file-ledger.json` | `main` | BF-01 to BF-14, BF-17, BF-19 | BF-15, BF-16, BF-18, BF-20 to BF-26 (by fix batch 4, D-041) | BF-19 unknown Asset Names (PD-11); BF-26 letter case of Asset Names, folded in both builds now (PD-12) |
| Aggregation (AG), `tests/parity/aggregation-ledger.json`, at `07a6460` | M1.4 branch only | AG-01 to AG-14, all counted as must-be-used (test line 75), so 4 tests fail | none | AG-07, AG-08, AG-10 cite BF-19 and BF-26 |
| Aggregation (AG) on G1 `4610684` | G1 only | AG-03, AG-04, AG-07, AG-09 to AG-14 | AG-01, AG-02, AG-05, AG-06, AG-08, **pinned** as the exact retired list at `aggregation.parity.test.ts:68` | AG-13 and AG-14 are the KI-147 entries |

[VERIFIED: `git show 4610684:tests/parity/aggregation.parity.test.ts` line 68 and `aggregation-ledger.json` lines 159
to 182; base-file ledger by the workstream B investigation]

### 7.2 KI-147: one owner rule, two builds

- **The owner's answer (24 Oct):** "no fallback". A Crore cell that is not a number makes the amount invalid; the
  holding is excluded and listed.
- **The new app (D-039 point 1, branch only):** (a) text that is not an amount in the column the reader would use is
  INVALID SOURCE DATA; a holding whose market value is invalid is excluded and listed, with the Warning
  `base-file.money-invalid`; (b) a blank Crore cell falls back to Lakh, then rupees (lead); (c) the placeholders "NA",
  "N/A", "-" and "nil" count as blank (lead); (d) a Warning when two columns disagree by more than 0.005 Cr; (e) the
  file's own gain or loss column only reaches the import report and the Audit Log. The rule applies to invested value,
  market value and gain alike. [VERIFIED: D-039 text on `feat/m1-4-overview`]
- **The live page today (D-041 point 4, on `main`):** a Crore cell with text is blanked and falls through to Lakh, then
  rupees. [VERIFIED]
- **Planned (TA-05, EX-01):** D-042 amends D-041 point 4 so the live page follows the owner's rule, mirroring D-039
  point 1 for invested value, market value and gain. Whether placeholders count as blank is **PD-09**; until the owner
  answers, both builds use the built default (placeholders blank). [VERIFIED: TASK_REGISTER TA-05; DECISION_LOG PD-09]
- **The ledger records the gap:** AG-13 (market value) and AG-14 (invested value and gain) on G1. [VERIFIED]

### 7.3 Who retires AG-13 and AG-14

TA-05 cannot start before TA-03 merges (both patch the same engine block), so M1.4 is likely to merge before TA-05
[INFERRED]. Either order is covered:

| If | Then | Owner |
|---|---|---|
| M1.4 merges before TA-05 | NB-01 sends MOD-02 the final KI-147 AG ids after integrating G1. TA-05's PR retires AG-13 and AG-14 in `tests/parity/aggregation-ledger.json`, with a reason naming D-042, **and** adds both to the pinned retired list in `aggregation.parity.test.ts` | EX-01 (TA-05) |
| TA-05 merges before M1.4 | `main` has no aggregation ledger yet, so when M1.4 takes `main` the two entries become unused. The M1.4 PR retires them and edits the pinned list | NB-01 (TB-06) |

Either way: in the same PR as the behaviour change; never add a "regression" entry at merge; run `node --test` in IST
and UTC on the merged result. [VERIFIED: the rule in INTERFACE_CONTRACTS I-14; FILE_OWNERSHIP_AND_CHANGE_CONTROL merge
readiness rule] Risk RR-04.

### 7.4 Other items shared with Workstream A

| Item | New app | Live page | What happens next |
|---|---|---|---|
| KI-148: merged folios and "Total" rows (I-03) | takes the first row's date and days; reads a "Total" row as a holding with a Warning; G1 aligns both to D-041 points 2 and 3 (not integrated) | earliest date; holding days recomputed or blank; "Total" rows skipped and counted | integrate G1; PD-08 (holding days when folios disagree) decides both builds |
| KI-151 (new app) and KI-183 (live page): a label equal to a built-in object word | handled with Maps (D-039 point 3); G1 adds a 7 by 5 label-grid test that cites KI-183 | `computeReview` throws or leaks text (reproduced 28 Oct) | one id per build, each citing the other (TB-27); EX-01 files KI-183 and fixes it in TA-05 |
| KI-184: the base file's ISIN column | not read | not read | EX-01 files KI-184; a fix needs a parity-ledger update (TA-06) |
| Vendored libraries (I-20) | copies of the live page's blocks 00 to 03 and the logos | those blocks never change | after G1, only a change to those blocks breaks `vendor-extract --check` (RR-05); a library upgrade changes only the new app's copy, under a D entry |
| MD5 pins (RR-06) | `vendor-extract.mjs:41` on the M1.4 branch pins `911A0465` | the page MD5 changes with every patch or refresh | G1 replaces the pin with block equality |
| Live patches to `parseBaseRows`, `computeReview` or REFDATA (RR-08) | parity tests, `data-extract --check` and refdata parity can turn the `next` job red | each such patch | the live PR updates the ledger entries in the same PR (precedent: fix batch 4 commits `bf2db99`, `b8a8d7f`) |
| The October refresh, TA-10 (RR-10) | parity fixtures and refdata run on new data | new data blocks spliced into `index.html`; `data/refdata` regenerated | any branch still open when it merges takes the new `main` |

Every known difference between the builds, with its decision or open question, is in
[KNOWN_ISSUES_AND_REGRESSION_RISKS.md section 6](../project-control/KNOWN_ISSUES_AND_REGRESSION_RISKS.md#6-where-the-two-builds-differ).

### 7.5 Merging alongside the tax batch (TA-03)

- **The readiness rule** (lead decision, 28 Oct): whichever change passes Gates A to D first merges first. The second
  takes `main`, keeps `docs/DECISIONS.md` in number order, keeps both sides' rows in `CHANGELOG.md`,
  `docs/PROJECT_STATE.md`, `docs/KNOWN_ISSUES.md` and `docs/TESTING.md`, and re-runs its full checks.
  [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#merge-readiness-rule)
- **M1.4 does not wait for TA-03.** TA-03 also needs the owner's answers to CR-0008 questions 17 and 18 (or acceptance
  of the safe defaults), so a fully verified M1.4 may merge first. [VERIFIED: the rule; master handover section 15]
- **Known overlap:** text conflicts in `docs/DECISIONS.md` (1 hunk), `docs/KNOWN_ISSUES.md` (2) and
  `docs/PROJECT_STATE.md` (1); no code file is changed by both; G1 to G3 share no file with TA-03. [VERIFIED:
  `git merge-tree`, 28 Oct; ACTIVE_CHANGE_REGISTER]

## 8. The blueprint approval page

- On 27 Oct the owner asked for the new build's architecture divided into sections and sub-sections so that each can
  be approved (REQ-069). It was published on 27 Oct as the owner's private approval page; **the link is in the
  private supplement**, never in this repository. A local copy is kept in the private handover folder.
- It has **17 sections (0 to 16) and 83 sub-items**. The page stores approvals, change requests and notes in its own
  store, and **no approval is recorded**: the store was empty on 28 Oct. [VERIFIED: the page's section list counted,
  and its store listed read-only, 28 Oct]
- **Stale on the page:** section 0 still says "In progress" and item 0.1 "being reviewed now", although the tabs merged
  on 27 Oct; the capital-gains design is done; M1.4's state has moved. Its timeline equals NB-01's ETA.
- **Next step (TC-10, PD-27):** MOD-02 republishes the page with the actual statuses (table below), then asks the owner
  to approve section by section, and relays each approval to NB-01. It is BLOCKED on the owner until then.

| Section (items) | Actual status, 28 Oct |
|---|---|
| 0 Layout and look (6) | tabs, banner, Screener button and offline: VERIFIED COMPLETE; review bar IN PROGRESS (M1.4); Screener date and mode PLANNED |
| 1 Uploads and inputs (11) | base file, labels and logo IN PROGRESS (M1.4); the rest PLANNED |
| 2 Portfolio overview (5) | 2.1 to 2.3 IN PROGRESS (M1.4, without XIRR); 2.4 (M4) and 2.5 (M7) PLANNED |
| 3 Portfolio observations (5) | PLANNED (M5, M8) |
| 4 Analytics and overlap (9) | PLANNED; fund-of-funds real data BLOCKED |
| 5 Holdings and performance (7) | PLANNED (M3, M5, M10) |
| 6 Rebalancing (8) | PLANNED (M8; one item in M7) |
| 7 Taxation (5) | design VERIFIED COMPLETE; code PLANNED (M7, M8) |
| 8 Market updates (1) | PLANNED |
| 9 Annexure (3) | PLANNED |
| 10 PowerPoint deck (4) | IN PROGRESS (C-08 only, on the branch) |
| 11 Excel workbook (3) | first sheets IN PROGRESS (M1.4); re-upload PLANNED |
| 12 Monthly update (5) | PLANNED |
| 13 Data rules and checks (4) | IN PROGRESS |
| 14 Security and privacy (3) | VERIFIED COMPLETE for the shell; per feature as built |
| 15 Testing and switch-over (3) | parity suites running (base file on `main`, aggregation on the branch); sign-off PLANNED |
| 16 Phase 2 (1) | PLANNED |

[VERIFIED: section titles and item counts from the page; statuses from git, 28 Oct]

## 9. Local-only work and how to preserve it

**The risk** [VERIFIED]: 26 commits (`feat/m1-4-overview` and G1 to G3, about 27,000 lines) exist only on this laptop.
Losing the disk or a worktree loses milestone M1.4. NB-01 did not push because some tests fail on the head. Pushing a
branch to this **public** repository publishes it even without a PR, so the scans and the security review come first.
Whether the scan passes is [UNKNOWN]: the vendored `app/vendor/*.js` files and `app/src/config/brand-logos.json` have no
deny-list exemption.

**The step (TB-08):** MOD-02 decides it under D-033; NB-01 does it. The master handover recommends authorising it
during step 0 [INFERRED]. The commands are in
[REPOSITORY_AND_ENVIRONMENT_STATE.md](../project-control/REPOSITORY_AND_ENVIRONMENT_STATE.md#local-only-work-and-the-preservation-step);
the copy-ready version is in the [resume note](continuations/NB-01_RESUME_NOTE_2026-10-28.md).
1. Read-only first: from each branch's own worktree, with `PRD_PRIVACY_DENYLIST` exported, run that worktree's
   `node scripts/validation/prepush-scan.mjs --base origin/main --head <sha>`. The script says of itself that it never
   changes the repository. [VERIFIED: its header]
2. The security-release-reviewer reviews what would be published (`origin/main..<head>`) and gives GO.
3. If every scan passes and the review is GO: `git push -u origin <branch>` from each branch's own worktree, no PR.
   CI does not run on a plain branch push and `main` is not touched. Never `--no-verify`, never a force-push.
4. If a scan blocks: never bypass it, never edit the allowlist alone. Report the exact findings to MOD-02. An allowlist
   entry by exact path is a policy change that needs MOD-02's decision and ARC-01's review (precedent: D-035 for
   `data/refdata`). A verified `git bundle` of the four refs in `C:\dev\private` sits on the same disk and that folder
   is not backed up [INFERRED], so it does not take the work off the laptop: ask the owner for an approved off-machine
   place.
5. **Also preserve the working notes** [INFERRED recommendation]: NB-01 copies its decision files (L1 to L29, N1 to
   N19) and each fixer's shared-file requests and docs text into the private handover folder
   (`C:\dev\private\handover\nb-01-scratch\`), after checking that they hold no client data and no credential. Never
   into the repository. A first copy of the files the private supplement lists (section 3.6) was made there on 30 Oct;
   NB-01 checks it and adds what it lacks.

**Accept when** `git ls-remote origin` shows `07a6460`, `4610684`, `be7f395` and `202f8f6` (or a verified bundle sits in
the owner-approved place), nothing was force-pushed, and MOD-02 has recorded the result in the registers.

## 10. Ownership, numbering and ports

[VERIFIED as written in [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md)
on this branch: lead decisions of 28 Oct]
- **Workstream B owns:** `app/**`, `scripts/build.mjs`, `scripts/serve.mjs`, `scripts/vendor-extract.mjs`,
  `scripts/lib/*`, `scripts/office/*`, `scripts/data-extract.ts` (its output `data/refdata/*` is shared), the new-app
  tests, `docs/new-build/*`, `docs/ARCHITECTURE.md`, `docs/DATA_DICTIONARY.md`, `docs/PRD.md`, CR-0006,
  `monthly_updates/*`, `product_bank/*`, the package files and the safety tooling code.
- **Never edits** `index.html` or Workstream A's files. A Workstream A fix may retire a BF or AG entry in its own PR
  (I-13, I-14). The shared hotspots (DECISIONS, KNOWN_ISSUES, PROJECT_STATE, CHANGELOG, TESTING, CLAUDE.md, the
  workflows, the policy files, the ledgers) follow the rules in the
  [hotspot table](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#shared-hotspots-coordinated-by-mod-02).
- **Numbers.** NB-01 keeps D-038 and D-039 (on its branch), then D-050 onward; KI-150 to KI-159 (KI-150 and KI-151 used
  on its branch), then KI-190 onward. KI-148 (in the closed fix-batch-4 range KI-140 to KI-149) is worked by NB-01 under
  TB-06 and TB-07; NB-01's report called it "MOD-01's range", which the 28 Oct allocation supersedes. Design ids TR, LD,
  KA, AG, E- and U- stay NB-01's. CR numbers come from MOD-02 (next free CR-0010). EX-01 holds D-042 to D-045 and
  KI-183 to KI-186; MOD-02 holds D-046 to D-049 and KI-187 to KI-189.
- **Ports.** `next` 8100; `next-m14` 8106; headless test ports 8107 to 8126 are NB-01's. 8099 serves the main checkout;
  8133 to 8135 are Workstream A's browser-QA ports. New ports from 8140 come from MOD-02.
  [Port register](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#port-register)
- **One task, one worktree, one branch, one writer.** NB-01's worktrees are `m14` and `wf_bdc6c774-599-1/-2/-3`. If
  NB-02 is ever started, NB-01 stops writing first.

## 11. Risks

Register ids RR-nn are in
[KNOWN_ISSUES_AND_REGRESSION_RISKS.md section 7](../project-control/KNOWN_ISSUES_AND_REGRESSION_RISKS.md#7-regression-risk-register).
The new-build risks B-01 to B-05 below are registered there as RR-25 to RR-29; that register is the one MOD-02 and
ARC-01 maintain.
B-nn ids are risks this document adds for MOD-02 to register. Likelihood and impact are [INFERRED].

| Id | Risk | Likelihood / impact | Mitigation | Owner |
|---|---|---|---|---|
| RR-01 | The M1.4 work exists only on this laptop | low per day, rising / high | TB-08 (section 9) | MOD-02 decides; NB-01 |
| B-01 (RR-25) | Pushing to the public repository publishes the branch: a missed deny-list term would be public at once (RR-16) | medium / high | deny-list exported in the pushing shell and seen in the scan output; security GO first; never `--no-verify` | NB-01 |
| B-02 (RR-26) | NB-01's decision files (N1 to N19, L1 to L29) and the fixers' shared-file requests live in temporary session folders; if lost, a successor must rebuild round 2 from the commits alone | low to medium / medium | copy them to the private handover folder after a client-data check (section 9, step 5); a first copy of the files the private supplement lists was made on 30 Oct, and NB-01 checks and completes it | NB-01; MOD-02 records it |
| RR-03 | Documentation conflicts with TA-03 (4 hunks) and rows lost in clean-merging files | certain for the second to merge / medium | the readiness rule; ARC-01 checks the merged files | the second to merge |
| RR-04 | AG-13 and AG-14 unused after "no fallback" reaches the live page; the pinned retired list | high / medium (CI red on `main`) | section 7.3 | EX-01 or NB-01 |
| RR-05, RR-06 | Library blocks and MD5 pins break the `next` job | low to high / low to medium | integrate G1; never change a live library block | NB-01 |
| RR-08 | A live patch to the reader, the review or REFDATA turns the `next` job red | medium / medium | live PRs run `node --test` in both zones and update the ledgers in the same PR | EX-01; ARC-01 |
| RR-10 | The October refresh changes `index.html` and `data/refdata` while M1.4 is open | certain when it happens / medium | take `main` after it merges; re-run parity | NB-01 |
| RR-11 | The two tax tables drift apart | medium / medium to high | the D-040 cross-reference; financial review of any change to either table; IMP-C16 | EX-01, NB-01 |
| RR-17 | `feat/m1-4-overview` tracks `origin/main`: a plain `git pull` merges `main` in, a plain `git push` is refused | medium / low to medium | first push with `git push -u origin feat/m1-4-overview` | NB-01 |
| RR-19 | `main` unprotected and AC-22 absent although documents claim it | low / high | CLAUDE.md rule 8 by practice; TB-24; IMP-C01 for the owner | MOD-02 |
| RR-20 | G1 and G2 conflict in `make-books.ts`; G2 untested; G1's 2 failures depend on shared-file requests; N16 to N19 unaccounted for | high / medium | integrate one fixer at a time; run G2's tests; record N16 to N19 | NB-01 |
| RR-21 | The test counts disagree (773 versus 837) | unknown / low to medium (a test group may not run) | explain before the PR | NB-01 |
| B-03 (RR-27) | SheetJS CE 0.18.5 carries CVE-2023-30533 and CVE-2024-22363 into the new app | already present / medium | state it in the M1.4 PR body; plan the upgrade under a D entry (TB-26, IMP-C05) | NB-01; MOD-02 |
| B-04 (RR-28) | Schedule: M1.4 about 5 Nov and M2 and M3 about 14 Nov are tight after the pause | medium / medium | report the ETA after each merge (TC-22) | MOD-02 |
| B-05 (RR-29) | NB-01's context: 1 compaction, idle since 27 Oct; its report predates its last turn | low / medium | it confirms its state against git before acting; MOD-02 judges reliability (resume note, part 3, item 5) | MOD-02 |
| RR-24 | Stale new-build documents mislead a successor | high / medium | section 13; fix in the M1.4 PR | NB-01 |

## 12. Owner decisions the new build waits for

None was answered by 28 Oct. Each is explained in plain language in
[DECISION_LOG.md section 2.3](../project-control/DECISION_LOG.md#23-each-decision-explained); MOD-02 asks the owner,
never NB-01 directly. "Meanwhile" is what the build does until the owner answers.

| PD | The question, simply | Meanwhile | Blocks |
|---|---|---|---|
| PD-09 | If the Crore cell holds "NA" or "-", do we look at the Lakh column (as if the cell were empty), or leave the holding out too? | placeholders count as empty, in both builds | the M1.4 PR wording; TA-05 (D-042) |
| PD-08 | When one fund sits in several folios with different ages, which holding-days figure does the one line show? | the oldest folio's age, blank when the folios disagree | the KI-148 alignment in G1 |
| PD-11 | Asset Names we do not know (for example Gold, Cash): show "Unknown" and list them, or map them to a class? | "Unknown" and listed | BF-19 |
| PD-12 | Treat "equity" and "Equity" as one Asset Name? | yes, folded in both builds | BF-26 |
| PD-13 | Treat client names that differ only in capital letters as one client? | no; kept apart with a warning | the new build |
| PD-14 | Is a market value of 0 "no value" or a real zero? | open in `DATA_DICTIONARY.md` section 8 on the branch | both readers |
| PD-15 | What if Product Name is empty? | "Unknown" with a warning [INFERRED as built] | the new build |
| PD-16 | The seven open items of the capital-gains design (section 6.3) | the built defaults | M7 |
| PD-45 | Send the 26 unconfirmed tax-law points (or the top five) to the tax adviser? | each shows a dash or a flag | M7 accuracy for old years |
| PD-06, PD-07 | The 90/90 fund-of-funds class and the slab rate for set-off: should the builds match? | the builds differ, each labelled | consistency |
| PD-19 | Send the Screener feedback and ask for fund-of-funds holdings? | synthetic packs only | M10, M12 real data |
| PD-27 | Approve the blueprint, section by section | no approvals | REQ-069 |
| PD-33 | Build the product bank from the Investment Reckoner (reverses the previous owner's 20 May rule)? | as the brief says, pending | M11 |
| PD-23 | Ask the previous owner for the missing files, including the Investment Reckoner | not asked | M11 |
| PD-32 | Which of the previous owner's 15 promised features are still wanted? | out of scope unless marked | scope |
| PD-34 | Will the owner still send the list of issues with the existing dashboard? | none | the full revamp scope |

Lead decisions for MOD-02 under D-033 (not for the owner): TB-08 preservation; who resumes M1.4 (NB-01 or NB-02); the
KI-151 and KI-183 wording (TB-27); `@types/node` (TB-25); AC-22 built or corrected (TB-24); the SheetJS upgrade (TB-26).

## 13. Stale new-build records

All on `main` at `6443826` unless noted [VERIFIED by file and line in
[KNOWN_ISSUES_AND_REGRESSION_RISKS.md section 8](../project-control/KNOWN_ISSUES_AND_REGRESSION_RISKS.md#8-stale-documents)].
Fix them in the M1.4 PR (TB-28), except where noted.

| Record | What it says | What is true |
|---|---|---|
| [PRD.md](../PRD.md) section 13 | 376 matrix rows; live MD5 `911A0465`; "owner decisions outstanding: none" | 385 rows on the branch; live MD5 `12B5E572`; many decisions open |
| [open-questions.md](../new-build/open-questions.md) | unchanged since 22 Oct | misses D-041 question 1, label case, the capital-gains section 15 items; KI-147 is answered |
| [DATA_DICTIONARY.md](../DATA_DICTIONARY.md) section 8, "Merged folios, first-row fields" | first-row date and days | stale after D-041; G1 has the fix |
| [05-feature-parity-matrix.md](../new-build/05-feature-parity-matrix.md) | merged work still "not started" | a row moves only when a test covers it, so progress is understated (IMP-C20) |
| [09-repository-and-docs-structure.md](../new-build/09-repository-and-docs-structure.md) | CHANGELOG moves to `docs/` | it stays at the root by the lead's decision of 22 Oct |
| `docs/DECISIONS.md:313`, `docs/DEPLOYMENT.md:45`, the roadmap, the regression test plan | AC-22 is CI-blocking from M1.2 | no AC-22 test exists (TB-24, or TC-15) |
| [PROJECT_STATE.md](../PROJECT_STATE.md) | M1.2 and M1.3 "ready for its pull request"; the first Screener pack is a blocker | merged 23 Oct; packs received 23 Oct (TC-15) |
| [CLAUDE.md](../../CLAUDE.md), section "New build" | "M1.4 is next" | M1.4 is in progress |
| [change-requests/README.md](../change-requests/README.md) | CR-0006 "M1.1 in progress" | M1.1 to M1.3, tabs and the design merged (TC-15) |
| The owner's private approval page | section 0 "In progress" | tabs merged 27 Oct (TC-10) |

## 14. What this handover could not establish

- Why the M1.4 head counts 773 tests in one run and 837 in NB-01's. [UNKNOWN]
- G2's test results; what happened to N16 to N19. [UNKNOWN]
- Whether NB-01 changed anything in its last turn (27 Oct 21:35 UTC) after its state report, and whether it saw
  MOD-01's message of 28 Oct. [UNKNOWN]
- Whether the pre-push scan passes on the M1.4 branches with the private deny-list. [UNKNOWN until step 1 of section 9]
- Whether NB-01's working notes are still on disk and free of client data. [UNKNOWN]
- Whether the local M1.4 build stays within `check-next`'s size budget after round 2. [UNKNOWN]
- Whether the owner asked for anything about the new build outside the two chats between 24 Oct and 27 Oct (PD-46).
  [UNKNOWN]
- The round-1 review results are NB-01's reports; none was re-run for this handover. [VERIFIED as reported only]

## 15. Change log

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | Version 1, for the MOD-01 to MOD-02 handover |
| 30 Oct 2026 | MOD-01 (fixer pass) | Version 1 corrected before validation: risks B-01 to B-05 registered as RR-25 to RR-29; B-05 points to the resume note's part 3, item 5; the working-notes folder is `nb-01-scratch`, with a first copy made on 30 Oct |
