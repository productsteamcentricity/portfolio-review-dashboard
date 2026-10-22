# Project state

**Last updated:** 22 Oct 2026.
- The full audit is done: 67 issues, see [`audits/`](audits/).
- Fixes are shipping in batches (CR-0005): batches 1a and 1b (the audit's whole batch 1) are done. Legacy batch 2a
  (OD-32, OD-34, KI-124; D-022) is being built.
- **New build (CR-0006):** the owner's brief of 21 Oct 2026 asks for a clean new application with feature parity.
  - **Phase 0 is done.** The record is in [`new-build/`](new-build/README.md) (audit, capability inventory,
    architecture, reuse plan, parity matrix, data sources, roadmap, test plan, repository structure, rule bank, deck
    design system, open questions), and the living PRD is [`PRD.md`](PRD.md). **The owner answered ND-1 to ND-10 on
    22 Oct 2026** ([`new-build/owner-decisions-new-build.md`](new-build/owner-decisions-new-build.md)), recorded as
    D-024 to D-033, and gave Claude full charge of GitHub and the dashboard (D-033). In short: Screener scores and
    ranks never in a public page, the pack uploaded by the owner each cycle and kept in the browser (D-026); missing
    values keep the dash, sentences never use one (D-029); a fund pair overlaps from 35% (D-030); capital-gains
    statements in our own template (D-032); no branch ruleset (D-033). Data and return conventions are in D-023; the
    Index TRI files are its index data.
  - **Milestone M1.1 is ready for its pull request.** Built: the safety tooling (privacy scan, docs link check,
    pre-push scan and hook, CI job `next`; [`new-build/safety-tooling.md`](new-build/safety-tooling.md); the hook is
    active only after `git config core.hooksPath scripts/hooks`), the Phase 0 records and the living documents
    ([`DATA_DICTIONARY.md`](DATA_DICTIONARY.md) v0.1, [`MONTHLY_UPDATE_GUIDE.md`](MONTHLY_UPDATE_GUIDE.md) with the
    list of files the owner supplies each month, [`monthly-prds/`](monthly-prds/README.md)), with the owner's answers
    applied. None of it is pushed yet. The rest of M1.1 is in "Next steps".
- The owner answered the 28 audit decisions: all accepted except OD-11 (keep the monitor uploads, fixed), D-021.
- The previous owner's second export is expected this week (CR-0004).
- The October 2026 data refresh is due when the files arrive, around 13–17 Nov 2026.

## Current state
- **Live product.** https://productsteamcentricity.github.io/portfolio-review-dashboard/ is the permanent review
  link.
  - It serves `index.html` on `main`. After PR #6: MD5 `EF2FF4F198A41FE02404B3617CBAD36E`, 16,817,827 bytes, with the KI-001 fix and fix
    batches 1a and 1b.
  - After every deploy the live page is downloaded and its MD5 compared with `main` (batch 1a verified 19 Oct
    2026).
  - Data vintage: 30 Sep 2026, except ranks (15 Aug), fund managers (31 Aug), PMS returns (31 Jul) and AIF
    (30 Jun).
- **Repository.** `C:\dev\portfolio-review`; `origin` =
  https://github.com/productsteamcentricity/portfolio-review-dashboard (**public**, D-008).
  - Commits use Products Team Centricity with the GitHub no-reply address. Since 19 Oct this laptop's global git
    identity is the no-reply address too.
  - Merges are made locally with that identity, because GitHub's merge button records the account e-mail
    (KI-098).
- **Monthly refresh.** `buildtools/` was proved byte-identical on September (CR-0003). The process is in
  docs/MONTHLY_REFRESH.md, and the inbox `01 Monthly Updates\2026-10` is ready.
- **OneDrive project folder:** `…\Desktop\Claude Code-Portfolio Review Dashboard` (D-018).
- **Local preview:** `Open Dashboard.cmd` (OneDrive) or `tools/open-dashboard.cmd` opens http://127.0.0.1:8099.
  The server serves only the dashboard and `test-data/`.
- **Previous owner's site:** stays live until the new build has been fully tested (owner, 15 Oct 2026).

## Blockers
| Blocker | Needed from | Unblocks |
|---|---|---|
| The second export: risk toolchain, sources of record, real-format test fixtures, answers | Previous owner (prompt sent via Teams, CR-0004) | Monthly MF_RISK refresh; testing fixes against real file formats; several owner questions |
| The first MF Screener data pack and its holdings backfill | Screener owner (prompt in OneDrive `05 Data Requests`) | Real data for M10 (Screener metrics) and M12 (historical analytics, FoF look-through) |

## Next steps
1. **Claude:** ship the audit's remaining "fix now" batches (CR-0005), one PR each, with known-answer tests.
   Batch 1 (engine numbers) is done: 1a is PR #4, 1b is PR #6.
2. **Claude:** implement the owner's decisions (D-021), the register's group (b), in batches alongside the "fix
   now" list. This includes OD-11 (keep the monitor uploads and make them match the monthly refresh) and OD-14
   (a degraded Exit falls back to Retain).
3. **Owner:**
   - send your own list of issues;
   - ask the tax adviser about OD-28.
   ND-1 to ND-10 were answered on 22 Oct 2026 (D-024 to D-033).
   OD-29 to OD-36 were accepted on 21 Oct 2026 (D-022); OD-32 (renamed fund houses) and OD-34 ("AMC not given")
   are built in legacy batch 2a, with KI-124 (empty Home slide export).
4. **Claude: finish M1.1** ([roadmap](new-build/07-implementation-roadmap.md), M1.1):
   - push the safety tooling and the Phase 0 records and open their pull requests;
   - create and push the tag `legacy-baseline-782794f`;
   - `scripts/validation/release-check.mjs` and `scripts/validation/monthly-prd-check.mjs`;
   - the folder skeleton with READMEs (`app/`, `data/`, `product_bank/`, `monthly_updates/`);
   - the new `docs/ARCHITECTURE.md` from `new-build/03-architecture.md`, with the legacy one moved to `docs/legacy/`;
   - `CHANGELOG.md` moved to `docs/CHANGELOG.md`; the README's "two apps" section;
   - KNOWN_ISSUES N-1 to N-10 from KI-125; the full new-app section of `CLAUDE.md` (including D-024 to D-033: the
     "no npm install" rule is the legacy file's, D-025; the dash rule, D-029; the Screener pack store, D-026).
   Then M1.2 (toolchain and `/next/` preview, now decided) and M1.3 (shared model, base-file ingest); neither needs
   owner input.
5. **When the second export arrives:**
   - Claude verifies and files it;
   - restores the risk toolchain into the repository;
   - re-tests the fixes against the real-format fixtures.
6. **Around 13–17 Nov:** the October data refresh (docs/MONTHLY_REFRESH.md), followed by the first monthly PRD
   ([`monthly-prds/`](monthly-prds/README.md)) and a refresh of HANDOVER.md.
7. **Owner:** after full testing of the new build, schedule retiring the previous owner's site.
   (No ruleset will protect `main`: D-033.)

## Backlog
The prioritised backlog is the audit register's fix order (`audits/2026-10-19-full-audit.md`, end of the file):
- **(a) fix now:** clear-cut issues that survive the redesign, in 7 batches;
- **(b) owner-decided (answered 19 Oct 2026, D-021):** see the decisions file;
- **(c) in the redesign:** presentation-only items.

Other items:
| Priority | Item | Type |
|---|---|---|
| P1 | Risk-ratio computation in this repository (from the previous owner's toolchain) | operations |
| P2 | Expense-ratio sanity checks as a script (today a manual runbook step) | operations |
| P3 | KI-029: AI Analyst signal weights sign-off | product decision |
| P1 | The legacy `FUND_RANKS` block (fund ranks issued 15 Aug 2026) is an open item: whether the legacy page removes it now (a data change under D-028, which would also remove what uses it, such as the AI Analyst's rank signal) or keeps it until switch-over is to be decided by the lead under D-033 and recorded | decision, then a legacy data change |

## Records
- What the owner asked for: `docs/change-requests/`.
- Every monthly refresh: `docs/refresh-log/`.
- Every audit: `docs/audits/`.
- What changed: `CHANGELOG.md` and `git log`.
