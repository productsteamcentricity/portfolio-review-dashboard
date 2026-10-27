# Project state

**Last updated:** 27 Oct 2026.
- The full audit is done: 67 issues, see [`audits/`](audits/).
- Fixes are shipping in batches (CR-0005): batches 1a and 1b (the audit's whole batch 1) are done. Fix batch 2a
  (KI-124, OD-32 renamed fund houses, OD-34 "AMC not given", CR-0007) is merged (PR #9; `index.html` MD5
  `911A04659CB34383E478416B54E9C306`); its browser acceptance passed on 22 Oct 2026, and the QA found KI-127 and
  KI-128 (both also on main before the batch).
- **Tax batch (CR-0008, 27 Oct 2026):** the owner's TY 2026-27 Tax Reckoner is the source of record for the live
  page's taxation. The review found 23 discrepancies (KI-160 to KI-182); the lead's defaults are D-040, each open to the
  owner's confirmation. Part T1 (classification and the TAX_RULES rows: KI-162 to KI-165, KI-170, KI-172 to KI-174,
  KI-178 to KI-180) is committed on `fix/legacy-batch-3-tax` (`index.html` MD5 `5717A796…`, not pushed). Part T2
  (holding periods and lots: KI-160, KI-161, KI-176 and the disclosure step of KI-177) is committed on
  `fix/legacy-batch-3-tax-p2`, on top of T1 (`index.html` MD5 `AE70F78B…`, not pushed). Part T3 (the harvest per
  client, the Rs 1.25 lakh Sec 198 exemption with the analyst's "already used" input, the set-off order with the
  analyst's slab rate, AIF Category III at fund level, AIF Category I and II and PMS not split, the carry-forward
  wording and the crypto source: KI-166 to KI-169, KI-171, KI-175, KI-181, KI-182, with KI-130) and part T4 (the
  financial re-review of T3: crypto kept out of set-off until the owner rules, CR-0008 question 18; two figures in the
  records corrected) are committed on `fix/legacy-batch-3-tax-p3-r2`, on top of T2 (`index.html` MD5 `61FC0FB2…`,
  not pushed). 22 of the 23 findings are fixed and KI-177 in part; KI-177's step-up waits for the owner's rulings.
  The batch merges as one pull request after the check of part T4, the browser acceptance (with
  `family-isolation.js`'s new assumption-reset check) and the owner's answers to CR-0008 questions 17 and 18.
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
  - **Milestone M1.1 is complete once its last branch merges** (next step 4; the root README's two-apps section,
    the one item left over, is written in M1.2's records). Merged in PR #10 (`2a65a62`): the safety tooling
    (privacy scan, docs link check, pre-push scan and hook, CI job `next`;
    [`new-build/safety-tooling.md`](new-build/safety-tooling.md); the hook is active only after
    `git config core.hooksPath scripts/hooks`), the Phase 0 records and the living documents
    ([`DATA_DICTIONARY.md`](DATA_DICTIONARY.md) v0.1, [`MONTHLY_UPDATE_GUIDE.md`](MONTHLY_UPDATE_GUIDE.md) with the
    list of files the owner supplies each month, [`monthly-prds/`](monthly-prds/README.md)), with the owner's answers
    applied. The tag `legacy-baseline-782794f` is on the remote. The rest is on `chore/m1-1-rest-int`, ready for its
    pull request: the release check and the monthly PRD check with their CI steps, the folder skeleton (`app/`,
    `data/`, `product_bank/`, `monthly_updates/` with the publication classes), the living
    [`ARCHITECTURE.md`](ARCHITECTURE.md) with the legacy one moved to
    [`legacy/ARCHITECTURE.md`](legacy/ARCHITECTURE.md), and KI-129 to KI-139 (KI-138 already fixed by batch 2a).
    `CHANGELOG.md` stays at the repository root.
  - **M1.2 is integrated and ready for its pull request** on `feat/m1-2-int`, stacked on `chore/m1-1-rest-int`
    (local, not pushed): `feat/m1-2-toolchain-shell` (the npm toolchain, the one-file offline build with a hash CSP,
    `check-next.mjs`, the nine-section shell and the `/next/` preview; [`new-build/toolchain.md`](new-build/toolchain.md))
    merged with M1.1, the fix of QA defect D1 (focus on the section heading for every section link; links read
    "1 Uploads and inputs"), the Pages fallback (a failing preview never blocks the legacy page; `/next/` then shows a
    notice) and the records, with D-034. The built page: 42,280 bytes, SHA-256 `e74e8a07…`; the browser spike passes 49
    of 49 in headless Edge 155 and Chrome 155. Open: the by-hand browser QA of `toolchain.md` §9 on an analyst's
    profile, and the first CI and Pages runs (the Pages workflow runs only on GitHub).
  - **M1.3 is integrated and ready for its pull request** on `feat/m1-3-int`, stacked on `feat/m1-2-int` (local, not
    pushed): `feat/m1-3-model-ingest-r2` (the shared model, the workbook and base-file readers with the parity ledger
    `tests/parity/base-file-ledger.json`, the reference data in `data/refdata/`, fixtures and traceability; reviewed
    twice) merged on top of M1.2, the type check over M1.3's code with `"type": "module"`, the re-review's fixes
    (the asset class compared exactly, BF-26) and the records, with D-035 and KI-140 to KI-147. 234 of 234 tests
    pass in IST and UTC; the `/next/` build is unchanged. No application code is on `main` yet.
  - **M1.4 is next** (the first vertical slice: the portfolio overview end to end), starting with the rule for a
    Crore cell that is not a number (KI-147, an owner decision).
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
   - confirm the tax defaults of D-040 and answer CR-0008's questions (ELSS unlock day, the 29 Feb clamp, the marker
     of foreign shares in real base files, the 90/90 status of equity ETF FoFs, the AMC year-end classifications, the
     Valuation Date column of real base files, how the IRR sheet records a scheme merger, and the rulings the 31 Jan
     2018 grandfathering needs; from part T3: whether a base-file client is one assessee, the default slab rate and
     exemption already used, whether "Listed AIF" means Category III, and set-off against crypto, which part T4 keeps
     out of set-off until answered; questions 17 and 18 are needed before the batch merges); OD-28 is answered by the
     reckoner (Sec. 76, old 50AA);
   - answer M1.3's questions in [`DATA_DICTIONARY.md`](DATA_DICTIONARY.md) §8: unrecognised Asset Names such as
     "Gold" (BF-19), letter case of Asset Names (BF-26), a market value of 0, and, for M1.4, a Crore cell that is not
     a number beside a Lakh amount (KI-147);
   - count, privately, how often the real base files carry variant asset labels (letter case, spacing, synonyms):
     it sizes KI-145 and KI-146 on the live page.
   ND-1 to ND-10 were answered on 22 Oct 2026 (D-024 to D-033).
   OD-29 to OD-36 were accepted on 21 Oct 2026 (D-022); OD-32 (renamed fund houses) and OD-34 ("AMC not given")
   are built in fix batch 2a (PR #9, merged), with KI-124 (empty Home slide export).
4. **Claude: close M1.1** ([roadmap](new-build/07-implementation-roadmap.md), M1.1): push `chore/m1-1-rest-int`,
   attach the report of `node scripts/validation/release-check.mjs --after-push` to its pull request, and merge it
   once CI is green (D-017). The one other M1.1 item, the root README's section on the two applications and how to
   run both ([`new-build/09-repository-and-docs-structure.md`](new-build/09-repository-and-docs-structure.md) §6), is
   written in M1.2's records (`feat/m1-2-int`). `CHANGELOG.md` stays at the repository root (the lead's decision,
   22 Oct 2026).
5. **Claude: M1.2, then M1.3**, each merged as its own pull request after the one before. M1.2 (`feat/m1-2-int`):
   the browser QA by hand ([`new-build/toolchain.md`](new-build/toolchain.md) §9), push, the release-check report,
   merge once CI is green; then check the first Pages run (`/` byte-identical, `/next/` the preview, not the notice)
   as in [DEPLOYMENT.md](DEPLOYMENT.md). M1.3 (`feat/m1-3-int`): push, the release-check report, merge once CI is
   green; it needs no owner input to merge (its open questions wait in `DATA_DICTIONARY.md` §8). Then M1.4, the first
   vertical slice, with the items carried from M1.3 in its acceptance list (KI-147).
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
| P1 | The legacy `FUND_RANKS` block (fund ranks issued 15 Aug 2026) is an open item: whether the legacy page removes it now (a data change under D-028, which would also remove what uses it, such as the AI Analyst's rank signal) or keeps it until switch-over is to be decided by the lead under D-033 and recorded | decision, then a legacy data change |

## Records
- What the owner asked for: `docs/change-requests/`.
- Every monthly refresh: `docs/refresh-log/`.
- Every audit: `docs/audits/`.
- What changed: `CHANGELOG.md` and `git log`.
