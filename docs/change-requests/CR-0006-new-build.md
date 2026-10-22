# CR-0006: Build the next-generation Portfolio Review Dashboard

- **Requested:** 21 Oct 2026, by the product owner (a full brief; sanitised copy in
  [`../new-build/00-owner-brief.md`](../new-build/00-owner-brief.md): login details and client names removed).
- **Status:** Phase 0 done (delivered on 22 Oct 2026; the owner answered ND-1 to ND-10 on 22 Oct 2026, recorded as
  D-024 to D-033). Milestone M1.1 is ready for its pull request.

## Request
Build a clean new application that keeps every capability of the existing dashboard and improves it:
- a single-page analyst workspace in nine sections;
- one shared data and calculation model for the screen, the Excel workbook and the PowerPoint deck;
- client-level and advisor-level analytics and overlap, look-through (including hybrid funds of funds) and history;
- a calculation-driven observation engine;
- a Review Snapshot that depends on whether rebalancing is proposed;
- an editable client-ready deck and a formula-driven Excel workbook that can be edited and re-uploaded;
- an MF Screener link;
- a monthly update workflow run from `monthly_updates/YYYY-MM/` with a product bank;
- a monthly PRD and handover;
- validation, audit trail and regression tests throughout.

The existing dashboard stays the review link until the new one reaches feature parity. Phase 2 (an automated
rebalancing method) is out of scope; the data structures for it are in scope.

## Decisions so far
- **22 Oct 2026, D-023:**
  - the vendor licence allows publishing every Accord file (the monitor files and, as the owner confirmed later the
    same day, every other Accord file);
  - drawdown comparisons use index data;
  - portfolio 3Y and 5Y returns are the weighted average of the holdings' returns;
  - direct-equity returns come from stock prices, following the owner's Stock Price to Return Calculator.
- **MF Screener:** it blocks embedding, so it opens in a new tab. Its data arrives as a monthly data pack built by
  the Screener owner's exporter (contract `pr-datapack-v1`; the prompt is held in OneDrive `05 Data Requests`).
- **22 Oct 2026, the owner's answers to ND-1 to ND-10** (`docs/DECISIONS.md`; the owner gave Claude full charge of
  GitHub and the dashboard, so the lead decided the items the owner did not comment on):
  - D-024: public preview at `/next/` with a "Preview, not for client use" banner; nothing exported from it is used
    for a client before switch-over;
  - D-025: npm for pinned, dev-time build tooling;
  - D-026: the data classes; Screener scores and ranks never in a public page: the owner uploads the Screener data
    pack every cycle into a section 1 slot, and the browser keeps it until a newer pack;
  - D-027: the MF Screener link, recorded;
  - D-028: the live page keeps calculation, data and security fixes; presentation-only work goes to the new build;
  - D-029: missing values keep the dash; sentences never use one;
  - D-030: observation thresholds approved, with a fund pair overlapping from 35%;
  - D-031: 0.5 pt `#D9D9D9` borders; Actionables tan `#DBC8B2` with the action word;
  - D-032: capital-gains statements uploaded in the app's own template;
  - D-033: no branch ruleset; Claude takes full charge of GitHub and the dashboard.
  - The five Index TRI files of the monthly inbox are the index data for drawdown comparisons (D-023 addendum), and
    the files the owner supplies each month are tracked in `docs/MONTHLY_UPDATE_GUIDE.md`.

## Plan
1. **Phase 0 (done, 22 Oct 2026):**
   - legacy audit and capability inventory;
   - architecture, reuse and migration plan;
   - feature-parity matrix and data-source inventory;
   - roadmap and regression test plan;
   - repository structure, living PRD, observation rule bank and deck design system.

   The documents are in `docs/new-build/` (index: [`../new-build/README.md`](../new-build/README.md)); the living PRD
   is [`../PRD.md`](../PRD.md). The ten owner decisions (ND-1 to ND-10,
   [`../new-build/owner-decisions-new-build.md`](../new-build/owner-decisions-new-build.md)) were answered on
   22 Oct 2026; every other question proceeds on its default.
2. **Then milestones** as in the roadmap ([`../new-build/07-implementation-roadmap.md`](../new-build/07-implementation-roadmap.md)),
   each a PR with tests. The first is repository organisation, the app skeleton served next to the current dashboard,
   and the shared data model.

## Changes
| Milestone | What | Branch | State |
|---|---|---|---|
| M1.1 | Safety tooling: privacy scan, docs link check, pre-push scan and hook, CI job `next` ([`../new-build/safety-tooling.md`](../new-build/safety-tooling.md)) | `feat/m1-1-safety-tooling` | committed, not yet pushed |
| M1.1 | Phase 0 records: the deliverables and investigator inputs in `docs/new-build/`, the living PRD, `DATA_DICTIONARY.md` v0, `MONTHLY_UPDATE_GUIDE.md`, the monthly PRD template | `docs/m1-1-new-build-docs` | committed, not yet pushed |
| M1.1 | The owner's answers of 22 Oct 2026 applied: D-024 to D-033 in `DECISIONS.md`; the deliverables, PRD 0.4 and `DATA_DICTIONARY.md` v0.1 updated (Screener pack slot, dash rule, 35% overlap, capital-gains template); the monthly upload list in `MONTHLY_UPDATE_GUIDE.md` | `docs/m1-1-new-build-docs` | ready for the pull request |

Still to do in M1.1: the baseline tag, the release and monthly PRD check scripts, the folder skeleton, the new
`ARCHITECTURE.md` (legacy one moved), the changelog move, KNOWN_ISSUES N-1 to N-10, and the new-app section of
`CLAUDE.md` (`docs/PROJECT_STATE.md`, next steps).

## Open
- **Owner:** your own list of issues with the existing dashboard (screenshots or notes).
- **Screener owner:** run the data pack prompt and send the first pack and the backfill.
- **Answered on 22 Oct 2026:** ND-1 to ND-10 (D-024 to D-033); the index data for drawdown comparisons is the five
  Index TRI files already in each month's inbox (D-023 addendum).
