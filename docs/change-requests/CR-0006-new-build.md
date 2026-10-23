# CR-0006: Build the next-generation Portfolio Review Dashboard

- **Requested:** 21 Oct 2026, by the product owner (a full brief; sanitised copy in
  [`../new-build/00-owner-brief.md`](../new-build/00-owner-brief.md): login details and client names removed).
- **Status:** Phase 0 done (delivered on 22 Oct 2026; the owner answered ND-1 to ND-10 on 22 Oct 2026, recorded as
  D-024 to D-033). Milestone M1.1: the safety tooling and the Phase 0 records merged in PR #10 (`2a65a62`); the rest
  of M1.1, with the lead's records, is on `chore/m1-1-rest-int`, ready for its pull request (Changes, below). M1.2
  is integrated on `feat/m1-2-int`, stacked on it, with its records and D-034 (23 Oct 2026), ready for its own pull
  request after M1.1. M1.3 is integrated on `feat/m1-3-int`, stacked on M1.2, with its records, D-035 and KI-140 to
  KI-147 (23 Oct 2026), ready for its own pull request after M1.2. M1.4 is next.

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
- **23 Oct 2026, D-034 (lead under D-033):** the new app's toolchain as M1.2 built it (exact pins, lockfile, no
  install scripts, one deterministic offline file with a hash CSP, static navigation, vendored libraries checked by
  SHA-256), and the `/next/` preview never blocks the legacy page: when it cannot be built, Pages publishes a notice
  there and deploys the legacy page as usual.
- **23 Oct 2026, D-035 (lead under D-033):** the reference data in the repository (`data/refdata/`, extracted from
  `index.html` and checked equal; fund ranks reduced to scheme codes; the generated block files exempt from the
  private deny-list as `index.html` is; the classes of `MF_RISK`, `PMS_PERF`, `AIF_PERF` and `MF_BENCHMARKS`) and the
  base-file reading conventions (the parity ledger's corrections BF-01 to BF-25 accepted, BF-18 as KI-113 extended
  to units; BF-19 and BF-26 wait for the owner).

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
| M1.1 | Safety tooling: privacy scan, docs link check, pre-push scan and hook, CI job `next` ([`../new-build/safety-tooling.md`](../new-build/safety-tooling.md)) | `feat/m1-1-safety-tooling` | merged in PR #10 (`2a65a62`) |
| M1.1 | Phase 0 records: the deliverables and investigator inputs in `docs/new-build/`, the living PRD, `DATA_DICTIONARY.md` v0, `MONTHLY_UPDATE_GUIDE.md`, the monthly PRD template | `docs/m1-1-new-build-docs` | merged in PR #10 (`2a65a62`) |
| M1.1 | The owner's answers of 22 Oct 2026 applied: D-024 to D-033 in `DECISIONS.md`; the deliverables, PRD 0.4 and `DATA_DICTIONARY.md` v0.1 updated (Screener pack slot, dash rule, 35% overlap, capital-gains template); the monthly upload list in `MONTHLY_UPDATE_GUIDE.md`; the new-app section of `CLAUDE.md` | `docs/m1-1-new-build-docs` | merged in PR #10 (`2a65a62`) |
| M1.1 | The baseline tag `legacy-baseline-782794f` on `782794f` | (tag) | on the remote (`git ls-remote --tags origin`, 22 Oct 2026) |
| M1.1 | The rest of M1.1: `release-check.mjs` and `monthly-prd-check.mjs` with their tests and CI steps; the folder skeleton (`app/`, `data/`, `product_bank/`, `monthly_updates/` with `_policy/publication-classes.json`); the new [`../ARCHITECTURE.md`](../ARCHITECTURE.md), the legacy one moved to [`../legacy/ARCHITECTURE.md`](../legacy/ARCHITECTURE.md); N-1 to N-10 and U-23 filed as KI-129 to KI-139 | `chore/m1-1-rest` | ready for its pull request, carried by `chore/m1-1-rest-int` |
| M1.1 | The lead's records for the rest of M1.1: `CHANGELOG.md`, `docs/PROJECT_STATE.md`, `docs/HANDOVER.md` (refreshed for the end of M1.1), the PRD's §13 status; `CLAUDE.md`, `docs/HANDOVER.md` and three project agents point at the moved legacy architecture, and `CLAUDE.md` names the new one and the two new checks | `chore/m1-1-rest-int` (on `chore/m1-1-rest`) | ready for its pull request |
| M1.2 | The toolchain (esbuild 0.28.2, TypeScript 7.0.2, Preact 10.29.8, pinned, lockfile, `.npmrc`), `scripts/build.mjs` (one offline `app/dist/index.html` with a hash CSP), `scripts/validation/check-next.mjs`, `scripts/serve.mjs`, the nine-section shell with the Screener pack slot, the CI steps and `/next/` in `pages.yml`, tests and the browser spike ([`../new-build/toolchain.md`](../new-build/toolchain.md)) | `feat/m1-2-toolchain-shell` | reviewed; carried by `feat/m1-2-int` |
| M1.2 | Integration on top of M1.1: the merge (conflicts resolved keeping both sides; CI job `next` in one order with the release check last); the fix of QA defect D1 (Enter or a click on any section link moves focus to its heading; links read "1 Uploads and inputs"); the Pages fallback (a failing preview never blocks the legacy page, D-034); the records: D-034, `CLAUDE.md` (the new app's working rules), the living architecture, DEPLOYMENT, the root README's two-apps section, HANDOVER, PROJECT_STATE, CHANGELOG, the PRD's §13 | `feat/m1-2-int` (on `chore/m1-1-rest-int`) | ready for its pull request after M1.1's; the browser QA by hand (`toolchain.md` §9) and the first CI and Pages runs are still to come |
| M1.3 | The shared model (`app/src/model/`), the workbook and base-file readers (`app/src/ingest/`) and their engine helpers, `scripts/data-extract.ts` with `data/refdata/` and `VINTAGE.json`, `scripts/validation/traceability.mjs`, the fixture generator, unit and parity tests with the ledger BF-01 to BF-25; the financial review's fixes (REITs/InvITs, merge gaps, the asset class compared honestly, invalid text) | `feat/m1-3-model-ingest-r2` | reviewed twice; carried by `feat/m1-3-int` |
| M1.3 | Integration on top of M1.2: the merge (CI job `next` with M1.3's tests in both zones, traceability and `data-extract.ts --check`); the type check over M1.3's code, `"type": "module"` with the legacy tooling kept CommonJS, `// covers:` headers for M1.2's tests; the re-review's fixes (the asset class compared exactly, BF-26); the records: D-035, KI-140 to KI-147, `CLAUDE.md`, the living architecture, DATA_DICTIONARY §8, the roadmap's M1.4 items, MONTHLY_REFRESH Step 8, HANDOVER, PROJECT_STATE, CHANGELOG, the PRD's §13 | `feat/m1-3-int` (on `feat/m1-2-int`) | ready for its pull request after M1.2's |

`CHANGELOG.md` stays at the repository root rather than moving to `docs/` as `09-repository-and-docs-structure.md` §6
planned (the lead's decision, 22 Oct 2026). Still to do in M1.1: its last pull request (push `chore/m1-1-rest-int`,
attach the report of `release-check.mjs --after-push` to the pull request, merge it once CI is green, D-017). The root
README's section on the two applications during the parallel run and how to run both (`09` §6), proposed for M1.2's
records, is written on `feat/m1-2-int`. After M1.3, M1.4 (the first vertical slice: the portfolio overview end to
end) is next; its acceptance list carries KI-147 from M1.3.

## Open
- **Owner:** your own list of issues with the existing dashboard (screenshots or notes).
- **Screener owner:** run the data pack prompt and send the first pack and the backfill.
- **Owner, from M1.3** ([`../DATA_DICTIONARY.md`](../DATA_DICTIONARY.md) §8): unrecognised Asset Names such as
  "Gold" (BF-19); letter case of Asset Names (BF-26); a market value of 0; for M1.4, a Crore cell that is not a
  number beside a Lakh amount (KI-147); and a private count of variant asset labels in the real base files (KI-145,
  KI-146).
- **Answered on 22 Oct 2026:** ND-1 to ND-10 (D-024 to D-033); the index data for drawdown comparisons is the five
  Index TRI files already in each month's inbox (D-023 addendum).
