# Owner decisions for the new build (answered 22 Oct 2026)

Phase 0, 22 Oct 2026. These were the only questions that needed the owner: ten items, ND-1 to ND-10, covering eleven
of the 86 questions in `open-questions.md`. Everything else in that file is either answered (D-022, D-023, the brief,
CR-0006) or **proceeding on default**: the recommended default is built as a configurable setting and recorded, so
the work does not wait.

**Answered on 22 Oct 2026.** The owner answered ND-1, ND-5, ND-6, ND-8 and ND-10, and gave Claude full charge of
GitHub and the dashboard (D-033); the lead decided the items the owner did not comment on (ND-2, ND-3, ND-4, ND-7,
ND-9) under D-033. Every answer is recorded in `docs/DECISIONS.md` as D-024 to D-033, and the matching questions in
`open-questions.md` are marked "answered". Each section below keeps the question and recommendation as asked and adds
the answer.

| Item | Answer | Decided by | Decision |
|---|---|---|---|
| ND-1 | Screener scores and ranks never in the public page; the owner uploads the pack every cycle into an upload slot; the browser keeps it until a newer pack | owner | D-026 |
| ND-2 | Yes: npm for pinned, dev-time build tooling | lead | D-025 |
| ND-3 | Yes: `/next/` with the "Preview, not for client use" banner | lead | D-024 |
| ND-4 | Calculation, data and security fixes on the live page; presentation-only work in the new build | lead | D-028 |
| ND-5 | No: missing values keep the dash; only sentences never use a dash | owner | D-029 |
| ND-6 | Approved, with a fund pair overlapping from 35% | owner | D-030 |
| ND-7 | 0.5 pt `#D9D9D9` borders; Actionables tan `#DBC8B2` with the action word in black | lead | D-031 |
| ND-8 | Statements uploaded in a template of our choosing, like the base-file template | owner | D-032 |
| ND-9 | Yes: nothing from `/next/` is used for a client before switch-over | lead | D-024 |
| ND-10 | No ruleset; Claude takes full charge of GitHub and the dashboard | owner | D-033 |

**How it was asked.** Reply "accept all", or "accept all except ND-n: ...", as with the audit decisions (D-021). Each
answer is recorded in `docs/DECISIONS.md` (the decision numbers proposed in `03-architecture.md` §21 start at D-024,
because D-022 and D-023 are taken).

**Already decided, not asked again.** The OD-29 to OD-36 answers (D-022, 21 Oct 2026; OD-32 and OD-34 are in legacy
fix batch 2a, being built now, with KI-124); the new build itself (CR-0006, merged in PR #8); publication of the
approved monthly source files, the index basis for drawdowns, portfolio 3Y and 5Y returns and direct-equity returns
(D-023, 22 Oct 2026); the MF Screener data pack (contract `pr-datapack-v1`) and the Screener link opening in a new tab
(CR-0006 and the brief).

The questions as asked on 22 Oct 2026:

| Item | Question in short | Recommendation | Blocks |
|---|---|---|---|
| ND-1 | Screener scores and ranks in the public review page (Q-06) | Keep the data pack private; load it per review | whether M10 embeds Screener data |
| ND-2 | npm for build tooling (Q-09) | Yes, pinned and dev-time only | M1.2 toolchain |
| ND-3 | Public preview at `/next/` (Q-10; D-024) | Yes, with a "Preview, not for client use" banner | M1.2 deployment of the preview |
| ND-4 | What the live page still receives (Q-16) | Calculation, data and security fixes only | any change to the CR-0005 batch plan |
| ND-5 | "n.a." instead of a dash (Q-42; D-029) | Yes, in the new app only | recording D-029 |
| ND-6 | Observation thresholds (Q-61) | Approve the table as a set | client use of observations |
| ND-7 | Slide 25 border grey and slide 6 tan (Q-33, Q-35) | `#D9D9D9`; one tan `#DBC8B2` with the action word | final styling of two components |
| ND-8 | Capital-gains statement samples (Q-78) | One blank or anonymised sample per layout | the M7 parser per issuer layout |
| ND-9 | No client use of `/next/` outputs before switch-over (Q-85) | Confirm | the rule analysts follow in previews |
| ND-10 | Branch ruleset on `main` (Q-86) | Yes | a repository setting only |

---

### ND-1 May Screener scores and ranks appear inside the public review page? (Q-06): ANSWERED, D-026

- **Question.** The MF Screener is invitation-only and carries Centricity's own scores. D-023 recommends that its data
  pack stays private unless the Screener owner agrees. Should the new app's public page embed Screener scores, ranks
  and ratios?
- **Recommendation.** No, until the Screener owner agrees in writing. The pack is never committed. The analyst loads
  the month's `pr-datapack_<cycle>.zip` in section 1 for each review (session only, never stored, like the IRR file);
  the monthly update engine validates the same pack and publishes only its fingerprint and counts, so the page can
  show "validated pack" when the analyst loads it. Ask the Screener owner once; if they agree, embedding is a
  configuration change. The legacy page's `FUND_RANKS` block is not changed without your decision.
- **Blocks.** Only the choice to embed Screener data in M10. The pack's ingest, validation, session load and every
  calculation that uses it are built on the default.
- **Answer (owner, 22 Oct 2026): D-026.** Not possible: Screener scores and ranks are never in the public page, and
  the pack is never embedded in any public build or committed. The owner uploads the pack every cycle. The new app has
  an "MF Screener data pack" upload slot in section 1; the pack is read and validated in the browser and kept in that
  browser's local storage (IndexedDB) until a newer pack is loaded, with its cycle date shown in the sidebar; every
  screen, slide and sheet that needs it says so when it is absent (`03-architecture.md` §6.9). The legacy page's
  `FUND_RANKS` block is an open item (see `docs/PROJECT_STATE.md`).

### ND-2 May the new app use npm for its build tools? (Q-09): ANSWERED, D-025

- **Question.** May the new app use npm for pinned, development-time build tools (esbuild 0.28.2; TypeScript 7.0.2,
  or 6.0.3 as a fallback) plus one small library bundled into the page (Preact 10.29.x)? Versions are exact, the
  lockfile is committed and install scripts are disabled. Nothing is downloaded when the page runs: it stays one
  offline HTML file. Today's "no npm install" rule describes the legacy file.
- **Recommendation.** Yes, recorded with the stack decision (D-025).
- **Blocks.** The M1.2 toolchain. If no, the same layout ships with a hand-written bundler (more code to maintain);
  the model, parsers, engine and tests (M1.3, M2 onward) do not wait either way.
- **Answer (lead under D-033, 22 Oct 2026): D-025.** Yes, as recommended.

### ND-3 May the new app be previewed publicly at `/next/`? (Q-10): ANSWERED, D-024

- **Question.** May the new app be published at `/next/` on the existing public Pages site, with a visible "Preview,
  not for client use" banner, while the legacy page stays at `/`? This supersedes D-007 ("publish `index.html` only")
  in part: Pages would publish `index.html` and `next/index.html`, and docs are still never served.
- **Recommendation.** Yes, recorded as D-024. No link from the legacy page until M5 (the first milestone with a
  complete Review Only slide set to preview).
- **Blocks.** The M1.2 deployment of the preview. Building and local preview on 127.0.0.1 proceed.
- **Answer (lead under D-033, 22 Oct 2026): D-024.** Yes, as recommended; D-024 supersedes D-007 in part.

### ND-4 What should the live page still receive while the new app is built? (Q-16): ANSWERED, D-028

- **Question.** The live page stays the review link until the new app reaches parity. Should it keep receiving every
  CR-0005 fix batch (2 to 7), or only some?
- **Recommendation.** Keep fixing calculation, data and security issues on the live page while it is the review link,
  because analysts and clients see those numbers now. Presentation-only improvements (layout, styling, slide order,
  wording) go to the new build only. Legacy fix batch 2a (OD-32, OD-34 and KI-124, D-022) proceeds as decided. Every
  legacy fix is ported to the new app with the same known answer. Recorded as D-028.
- **Blocks.** Any change to the CR-0005 batch plan. Until you answer, CR-0005 stands as approved (`CLAUDE.md` rule 9).
- **Answer (lead under D-033, 22 Oct 2026): D-028.** As recommended: the live page keeps receiving calculation, data
  and security fixes while it is the review link; presentation-only improvements go to the new build only.

### ND-5 May the new app show "n.a." instead of a dash for missing values? (Q-42): ANSWERED, D-029 (no: the dash stays)

- **Question.** The brief bans dashes in presentation writing. Two accepted decisions prescribe a dash: OD-13 (no
  unlisted holdings) and OD-29 (totals while a Current vs Sample return is blank). May the new app show "n.a." with a
  footnote naming the reason (for example "not available in supplied data", "not applicable", "stale") wherever a value
  is missing, and use "D Mon YYYY" dates, Indian digit grouping and red negatives with a hyphen-minus?
- **Recommendation.** Yes, in the new app only, recorded as D-029. The substance of OD-13 and OD-29 is kept (no breach
  shown, no invented total); the legacy page keeps its dash.
- **Blocks.** Recording D-029. The marker is one setting, so the build proceeds and your answer changes configuration,
  not code.
- **Answer (owner, 22 Oct 2026): D-029.** No. Missing values are shown as a dash, "—", as today (OD-13, OD-29), with a
  footnote naming the status; "n.a." is not used. The no-dash rule applies to sentences only: presentation prose never
  uses an en or em dash. The date, digit-grouping and negative-number conventions stand as recommended (lead).

### ND-6 Do you approve the observation thresholds? (Q-61): ANSWERED, D-030 (approved, overlap pair at 35%)

- **Question.** The observation engine fires on thresholds kept in one versioned table
  (`observation-rule-bank.md` §3). The legacy engine's thresholds were never approved, and reference deck B uses 1.5%,
  2% and 3% for the same finding. Key values: small position 1.50%; label drift when large cap is 65% of an equity
  sleeve; the top two fund houses at one third of the MF book; fund-pair overlap 30% (high) and 50% (very high);
  top-10 stocks 60% (high) and 20% (dilution). Five legacy triggers change: the "open-ended" strength moves from 65%
  to 95% (L-S3, and the liquidity card L-C8), the fund-pair overlap from 40% to 30% (L-W2, L-O3), and the debt
  high-quality phrase from 50% to 70% (L-C3).
- **Recommendation.** Approve the table as a set, including the five changes. Each later change is a versioned edit
  with its approval recorded in the table.
- **Blocks.** Client use of the new observations (switch-over, M15). The rules are built and tested on these defaults
  from M5.
- **Answer (owner, 22 Oct 2026): D-030.** Approved with one change: a fund pair counts as overlapping from 35% (not
  30% as proposed, not 40% as in the legacy); very high stays at 50%. The other proposed changes stand, so the legacy
  fund-pair trigger moves from 40% to 35% (L-W2, L-O3).

### ND-7 Which grey for the holdings borders, and which tan for the Actionables? (Q-33, Q-35): ANSWERED, D-031

- **Question.** The brief asks for lighter grey borders on "slide 25" (the holdings sheets: slide 26 of reference deck
  A's 41 slides, slide 25 of its earlier 40-slide version) and for the Actionables cells on "slide 6" to change from
  black to tan. Which grey: the exporter's 0.5 pt `#D9D9D9` or the warmer `#E8E0D5`? One tan for every action or a
  colour per action? Should the cell carry the action word (Exit, Retain, Partial, New Addition, Top-Up) or the short
  rationale that deck A puts there?
- **Recommendation.** 0.5 pt `#D9D9D9` as the one table border for the whole deck; one tan, `#DBC8B2`, with black bold
  text for every action; the cell shows the action word and the rationale keeps its own column.
- **Blocks.** Final styling of the holdings sheet (C-21, M3) and the rebalancing proposal (C-27, M8). Both are built
  with these values; a different answer is a token change.
- **Answer (lead under D-033, 22 Oct 2026): D-031.** As recommended: holdings-sheet borders 0.5 pt `#D9D9D9`; the
  Actionables column tan `#DBC8B2` with black text showing the action word.

### ND-8 Can you supply blank or anonymised capital-gains statement samples? (Q-78): ANSWERED, D-032

- **Question.** The brief asks for a capital-gains upload in section 1; the legacy page has none. Which statements
  will analysts upload (the registrars' capital-gains statements, the platform's realised-gain report, or both)? Can
  you supply one blank or anonymised sample of each layout? Client files cannot be used to learn a layout.
- **Recommendation.** One blank template or anonymised sample per layout (names, folios, PAN and amounts removed or
  replaced). Only its header layout is recorded; the tests use a synthetic statement built from it, and the sample
  itself is never committed. Until then realised gains are labelled "derived from transactions".
- **Blocks.** The M7 parser for each issuer's layout. The upload slot, the realised-gain model, the reconciliation with
  IRR-derived gains and the statuses are built and tested on synthetic statements now.
- **Answer (owner, 22 Oct 2026): D-032.** The owner attached a sample statement format and said the format can be
  changed: analysts upload the statement in a format of our choosing, as with the base-file template. The new app
  defines a capital-gains template (one row per realised lot; columns, units and dates proposed in
  `docs/DATA_DICTIONARY.md` §5.17, fixed in M7) and one parser for it; no per-issuer layouts are parsed. The sample
  itself is not committed.

### ND-9 Do you confirm that nothing from `/next/` is used for a client before switch-over? (Q-85): ANSWERED, D-024

- **Question.** Analysts will preview the new app's slides as milestones land. Using a single new-app slide in a
  legacy client deck would mix two engines and possibly two data vintages in one client document. Do you confirm that
  nothing exported from `/next/` is used for a client before switch-over?
- **Recommendation.** Confirm. Every slide and workbook exported from the preview carries "Preview build, not for
  client use" until switch-over. An earlier release would be a recorded decision for a whole section at once (same
  engine and vintage for every figure in that section). Recorded with D-024.
- **Blocks.** Nothing in the build; it sets the rule analysts follow from the first exportable slide (M1.4).
- **Answer (lead under D-033, 22 Oct 2026): D-024.** Confirmed: nothing exported from `/next/` is used for a client
  before switch-over.

### ND-10 May a branch ruleset protect `main`? (Q-86): ANSWERED, D-033 (no ruleset)

- **Question.** May a GitHub ruleset on `main` block force-pushes and branch deletion and require the `checks` and
  `next` CI jobs to pass before a merge? It is already listed as pending in `docs/DEPLOYMENT.md`.
- **Recommendation.** Yes. AC-22 detects a force-push after the fact (every reported commit must remain an ancestor
  of `main`); the ruleset prevents one.
- **Blocks.** Only the repository setting itself, which a repository admin applies after your yes. No milestone
  waits.
- **Answer (owner, 22 Oct 2026): D-033.** Not required. The owner gives Claude full charge of GitHub and the dashboard
  (extending D-017). `CLAUDE.md` rule 8 still applies (no force-push, no history rewrite, merge only with green CI), and
  AC-22 checks the history for force-pushes.

---

**Not questions (already requested; nothing to decide now).** The monthly index return data for drawdown comparisons:
**answered on 22 Oct 2026**, it is the five Index TRI files the owner already puts in each month's `Index TRI` folder
(D-023 addendum). Still to come: your own list of issues with the live dashboard (CR-0006 "Open"); the first data pack
and the holdings backfill from the Screener owner. Each is built against a default and reported as "not supplied"
until it arrives.
