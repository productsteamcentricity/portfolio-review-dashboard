# CR-0006: Build the next-generation Portfolio Review Dashboard

- **Requested:** 21 Oct 2026, by the product owner (a full brief; sanitised copy in
  [`../new-build/00-owner-brief.md`](../new-build/00-owner-brief.md): login details and client names removed).
- **Status:** Phase 0 (audit and architecture) in progress.

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
  - the vendor licence allows publishing the monitor files;
  - drawdown comparisons use index data;
  - portfolio 3Y and 5Y returns are the weighted average of the holdings' returns;
  - direct-equity returns come from stock prices, following the owner's Stock Price to Return Calculator.
- **MF Screener:** it blocks embedding, so it opens in a new tab. Its data arrives as a monthly data pack built by
  the Screener owner's exporter (contract `pr-datapack-v1`; the prompt is held in OneDrive `05 Data Requests`).

## Plan
1. **Phase 0:**
   - legacy audit and capability inventory;
   - architecture, reuse and migration plan;
   - feature-parity matrix and data-source inventory;
   - roadmap and regression test plan;
   - repository structure, living PRD, observation rule bank and deck design system.

   The documents go in `docs/new-build/`.
2. **Then milestones** as in the roadmap, each a PR with tests. The first is repository organisation, the app
   skeleton served next to the current dashboard, and the shared data model.

## Open
- **Owner:** your own list of issues with the existing dashboard (screenshots or notes).
- **Owner:** the monthly index return data (format and folder), for drawdown comparisons.
- **Screener owner:** run the data pack prompt and send the first pack and the backfill.
