# Project state

**Last updated:** 27 Oct 2026.
- The full audit is done: 67 issues, see [`audits/`](audits/).
- Fixes are shipping in batches (CR-0005): batches 1a and 1b (the audit's whole batch 1) are done. Fix batch 2a
  (KI-124, OD-32 renamed fund houses, OD-34 "AMC not given", CR-0007) is merged (PR #9; `index.html` MD5
  `911A04659CB34383E478416B54E9C306`); its browser acceptance passed on 22 Oct 2026, and the QA found KI-127 and
  KI-128 (both also on main before the batch).
- **New build (CR-0006):** the owner's brief of 21 Oct 2026 asks for a clean new application with feature parity.
  - **Phase 0 is done.** The record is in [`new-build/`](new-build/README.md) (audit, capability inventory,
    architecture, reuse plan, parity matrix, data sources, roadmap, test plan, repository structure, rule bank, deck
    design system, open questions), and the living PRD is [`PRD.md`](PRD.md). **The owner answered ND-1 to ND-10 on
    22 Oct 2026** ([`new-build/owner-decisions-new-build.md`](new-build/owner-decisions-new-build.md)), recorded as
    D-024 to D-033, and gave Claude full charge of GitHub and the dashboard (D-033). In short: Screener scores and
    ranks never in a public page, the pack uploaded by the owner each cycle and kept in the browser (D-026); missing
    values keep the dash, sentences never use one (D-029); a fund pair overlaps from 35% (D-030); capital-gains
    statements as the wealth platform's own export, accepted as produced, with a blank template of the same headers
    for other sources (D-032 as amended by D-036, 23 Oct 2026; design in
    [`new-build/capital-gains-upload.md`](new-build/capital-gains-upload.md), revised 27 Oct 2026 after three
    reviews, two re-reviews, two approval reviews and two second approval reviews, the design and its tax-rule table approved by the financial-domain reviewer on 27 Oct 2026); no branch ruleset (D-033). Data and return conventions are in D-023; the
    Index TRI files are its index data.
  - **Milestones M1.1, M1.2 and M1.3 are merged** (PRs #10 to #13, the last at `517becf`): the safety tooling and the
    Phase 0 records (M1.1), the pinned toolchain, the one-file offline build with a hash CSP, `check-next.mjs`, the
    nine-section shell and the `/next/` preview (M1.2, D-034), and the shared model, the base-file reader with its
    parity ledger and `data/refdata/` (M1.3, D-035).
  - **Layout (D-037, the owner's request of 24 Oct 2026):** the nine section tabs run across the top in the look of
    the owner's design reference, the MF Screener link sits in the masthead and each section uses the full width
    (PR #14, `c9ec1cc`).
  - **M1.4, the portfolio overview, is integrated** on `feat/m1-4-overview` (local, not pushed; D-038, D-039). On
    `/next/`, section 1 reads a base file through Upload, Validate, Preview and Review, with the import report, the
    as-on date, the family and client labels, the logo, a basic validation panel and the source register; section 2
    shows the headline figures, the asset and product table, the asset class and liquidity pies and the client and
    distributor allocation, with notes; the overview deck (slide C-08) and the overview workbook download once the
    export gate is clear. Every figure comes from one view-model, and a test proves screen, slide and sheet show the
    same text. The four legacy libraries are vendored byte for byte (D-038). KI-147 follows the owner's answer of
    24 Oct 2026 (no fallback, D-039 point 1). Spike gate R1 passed in Excel; the browser spike passes 141 of 141.
    Still to do before the merge: the independent browser QA, the financial and security reviews, the private
    deny-list scan, `npm run accept:office --full` on the wired deck and workbook, then push, CI and the pull
    request. **M2 is next** (instrument matching).
- The owner answered the 28 audit decisions: all accepted except OD-11 (keep the monitor uploads, fixed), D-021.
- The previous owner's second export is expected this week (CR-0004).
- The October 2026 data refresh is due when the files arrive, around 13–17 Nov 2026.

## Current state
- **Live product.** https://productsteamcentricity.github.io/portfolio-review-dashboard/ is the permanent review
  link.
  - It serves `index.html` on `main`. After PR #9: MD5 `911A04659CB34383E478416B54E9C306`, 16,826,633 bytes, with the
    KI-001 fix and fix batches 1a, 1b and 2a.
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
  The server serves only the dashboard and `test-data/`. With M1.2, `npm run serve` (preview configuration `next`)
  serves the dashboard at http://127.0.0.1:8100/ and the new app's build at `/next/`.
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
   - ask the tax adviser about OD-28;
   - answer M1.3's questions in [`DATA_DICTIONARY.md`](DATA_DICTIONARY.md) §8: unrecognised Asset Names such as
     "Gold" (BF-19), letter case of Asset Names (BF-26) and a market value of 0 (M1.4 runs on the M1.3 defaults;
     KI-147 was answered on 24 Oct 2026, D-039);
   - count, privately, how often the real base files carry variant asset labels (letter case, spacing, synonyms):
     it sizes KI-145 and KI-146 on the live page;
   - ask the wealth platform's support whether its capital-gains export repeats lot rows by design (D-036; the
     sample repeated whole sales, and its own totals include the repeats);
   - answer the other owner items of the capital-gains design
     ([`new-build/capital-gains-upload.md`](new-build/capital-gains-upload.md) §15): the dated rule table in place of
     OD-17's bands and OD-2's single 12-month test; anniversary-day sales; numbering PANs in memory to group persons;
     for the tax adviser, the FY 2016-17 index and the old-law 10% or 20% choice; and confirming the lead's two
     defaults (the FY 2024-25 exemption order, and the reckoner's usual bucket from tax year 2026-27).
   ND-1 to ND-10 were answered on 22 Oct 2026 (D-024 to D-033).
   OD-29 to OD-36 were accepted on 21 Oct 2026 (D-022); OD-32 (renamed fund houses) and OD-34 ("AMC not given")
   are built in fix batch 2a (PR #9, merged), with KI-124 (empty Home slide export).
4. **Claude: M1.4** (`feat/m1-4-overview`): the independent browser QA at 1440 x 900, 1366 x 768 and 375 x 812
   (Blob downloads served and from a double-clicked copy), the financial review of the totals, gain, allocation,
   KI-147 and SUMIFS semantics, the security review of the allowances, CSP, downloads and storage, the private
   deny-list scan (`prepush-scan.mjs` with `PRD_PRIVACY_DENYLIST`, app/vendor and the logos included), and
   `npm run accept:office` on the wired deck and workbook; then push, the release-check report, merge once CI is
   green (D-017), and check the Pages deploy (`/` byte-identical to `index.html`, `/next/` the overview).
5. **Claude: M2**, instrument matching ([roadmap](new-build/07-implementation-roadmap.md)).
6. **When the second export arrives:**
   - Claude verifies and files it;
   - restores the risk toolchain into the repository;
   - re-tests the fixes against the real-format fixtures.
7. **Around 13–17 Nov:** the October data refresh (docs/MONTHLY_REFRESH.md), followed by the first monthly PRD
   ([`monthly-prds/`](monthly-prds/README.md)) and a refresh of HANDOVER.md, both checked by
   `scripts/validation/monthly-prd-check.mjs`. From M1.3 the runbook's Step 8 regenerates `data/refdata/` from the
   spliced page in the same change, or CI fails (D-035).
8. **Owner:** after full testing of the new build, schedule retiring the previous owner's site.
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
| P1 | The legacy page's base-file reading defects found by M1.3: KI-146 (the IPS takes only the last allocation row of a class) and KI-140 to KI-145 (partial merged units, first-folio dates, total rows read as holdings, text read by `parseFloat`, impossible dates rolled, variant asset labels split into rows); live-page data fixes under D-028, measured on the real base files first | legacy fix batch |
| P3 | The legacy page's PptxGenJS pie colours (KI-150) and the Asset Name "constructor" that breaks `computeReview` (KI-151), both found by M1.4; avoided in the new app | legacy fix batch |
| P1 | The legacy `FUND_RANKS` block (fund ranks issued 15 Aug 2026) is an open item: whether the legacy page removes it now (a data change under D-028, which would also remove what uses it, such as the AI Analyst's rank signal) or keeps it until switch-over is to be decided by the lead under D-033 and recorded | decision, then a legacy data change |

## Records
- What the owner asked for: `docs/change-requests/`.
- Every monthly refresh: `docs/refresh-log/`.
- Every audit: `docs/audits/`.
- What changed: `CHANGELOG.md` and `git log`.
