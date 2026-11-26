# Project state

**Last updated:** 26 Nov 2026 (registers-4, MOD-04).
- **Records (26 Nov 2026, registers-4, docs only):** the decision log carries the owner's answers of 17 to 26 Nov
  (PD-01, PD-04, PD-44 accepted; PD-16 answered except item 4; PD-36 for the renamed-scheme list; PD-54 confirmed;
  PD-56 changed; PD-57 to PD-66; and the decisions without a PD number: the D-7 labels, the "ISIN" column for the new
  build only, the D-028 exception for matching corrections, the standing `/next/` rule, the M12a defaults, Q-12,
  matching option B). The chat registers show CHAT-013 MOD-04 as the Moderator since 25 Nov 2026 (CHAT-006 MOD-03
  handed over under PD-65); the next free chat number is CHAT-014. The coding map and interface contracts show what
  merged in PRs #28 to #40. KI-184 stays filed with no live fix planned (TA-06, LP-03 dropped).
- **Model contracts-1 (PR #29, 25 Nov 2026; types only, `/next/` build byte-identical):** I-31 `model/returns.ts`,
  I-32 `model/transactions.ts` (with the free-text date rule of KI-186), I-44 `model/index-series.ts`, I-45
  `model/scope.ts`, and decision C-01 (`BaseFileImport`, `MoneyFinding` and `MoneyUnit` moved into `model/`, the old
  places re-export them). This entry was missing when the PR merged and is added by registers-4.
- The full audit is done: 67 issues, see [`audits/`](audits/).
- Fixes are shipping in batches (CR-0005): batches 1a and 1b (the audit's whole batch 1) are done. Fix batch 2a
  (KI-124, OD-32 renamed fund houses, OD-34 "AMC not given", CR-0007) is merged (PR #9; `index.html` MD5
  `911A04659CB34383E478416B54E9C306`); its browser acceptance passed on 22 Oct 2026, and the QA found KI-127 and
  KI-128 (both also on main before the batch).
- **Fix batch 4, base-file reading (CR-0009, D-041), is accepted and merged** (PR #16; 27 Oct 2026: financial review, browser
  acceptance and security gate passed; branch `fix/legacy-batch-4-basefile-r2`): KI-140 to KI-146, the
  reading defects the new build's parity work found, fixed on the live page (merged units and purchase dates, total
  rows, text in number cells, impossible dates, Asset Name variants, and the P1 IPS actuals), each with a known-answer
  regression test; the review added the skip of a repeated header row (no false warning); `index.html` MD5
  `12B5E5727FCA01EF2EA162C59913F01D` on `main`. A private census of the 32 real base files on the laptop found none
  of these cases except merged folios: 18 merged holdings take an earlier purchase date and 6 lose their "Avg.
  Holding Days". Open for the owner: question 1 of D-041 (holding days of merged folios) and the other choices in
  CR-0009 (total rows skipped, letter case folded); KI-066 (the IPS hybrid remainder, which KI-146's sums make larger
  on books with split labels). For the new build: KI-148 (M1.4: fixture cases for D-041 points 2 and 3; align
  `DATA_DICTIONARY.md` §5.3 and §8, whose "as the legacy" wording is stale once this merges).
- **Tax batch (CR-0008, 27 Oct 2026):** the owner's TY 2026-27 Tax Reckoner is the source of record for the live
  page's taxation. The review found 23 discrepancies (KI-160 to KI-182); the lead's defaults are D-040, each open to the
  owner's confirmation. Part T1 (classification and the TAX_RULES rows: KI-162 to KI-165, KI-170, KI-172 to KI-174,
  KI-178 to KI-180) is committed on `fix/legacy-batch-3-tax` (`index.html` MD5 `5717A796…`, not pushed). Part T2
  (holding periods and lots: KI-160, KI-161, KI-176 and the disclosure step of KI-177) is committed on
  `fix/legacy-batch-3-tax-p2`, on top of T1 (`index.html` MD5 `AE70F78B…`, not pushed). Part T3 (the harvest per
  client, the Rs 1.25 lakh Sec 198 exemption with the analyst's "already used" input, the set-off order with the
  analyst's slab rate, AIF Category III at fund level, AIF Category I and II and PMS not split, the carry-forward
  wording and the crypto source: KI-166 to KI-169, KI-171, KI-175, KI-181, KI-182, with KI-130) and part T4 (the
  financial re-review of T3: crypto kept out of set-off until the owner rules, CR-0008 question 18 (answered 2 Nov 2026:
  keep no set-off, D-043); two figures in the records corrected) are committed on `fix/legacy-batch-3-tax-p3-r2`, on top
  of T2 (`index.html` MD5 `61FC0FB2…`).
  The branch then merged `main` with fix batch 4 (PR #16) and its page was rebuilt from main's page with the four
  tax patches, two anchors of part T2 revised where the batches meet (CR-0008, "Rebased on fix batch 4"; `index.html` MD5
  `0713C6BE…`). Part T5 (2 Nov 2026: the follow-ups to T1 to T4, the owner's answers to questions 17, 18 and 24, and the
  corrections from an independent review; D-043) is committed on `fix/legacy-batch-3-tax-cr-0008`, the branch that
  carries the whole batch (`index.html` MD5 `32CE9C58…`): the usual bucket of aggressive hybrid, arbitrage and equity
  savings funds applies only from 1 Apr 2026 (KI-170), a Listed AIF is Category III with a safe note (question 17; since
  the owner's answer to question 24 on 9 Nov 2026, only for a fund of the performance entry's own name), crypto
  stays out of set-off (question 18), an IRR date with an explicit zone is the day written (KI-186), the harvest inputs
  read digit grouping and currency marks, and KI-184 to KI-186 and KI-200 to KI-214 are filed. 22 of the 23 findings
  are fixed and KI-177 in part; KI-177's step-up waits for the owner's rulings. The five-reviewer review of the
  committed head (62 findings, 2 Nov 2026) is answered in CR-0008: the corrections were in the records and the tests
  only (page `391E722F…`); on 9 Nov 2026 the owner answered question 24 ("Restrict it (Recommended)") and stage S10
  changed the page for it; stage S11 (ARC-01's pre-check of stage S10) then applied the same name equality to the
  performance entry's stated category (`32CE9C58…`). The regression suite is 47 files and 1,649 checks. Open for the owner:
  question 23 (IRR dates); for the tax adviser: questions 25 and 26. The final head's check results go into the pull
  request. The batch merges as one pull request after the gate reviews and the browser acceptance (with
  `family-isolation.js`'s assumption-reset check); the slide geometry for a table of 13 or more classes in PowerPoint
  has not been run.
  **25 Nov 2026:**
  - Stage S12 (ARC-02's Gate B points T1 to T3, foreign bonds and offshore shares; ARC-02 GO on 153ccb2) is done.
  - The owner signed off the batch: PD-01, PD-04, PD-44 and PD-54 accepted; "Publish when green". The tax-adviser
    questions are 2, 3, 13, 14, 15 and 27 (D-043, CR-0008).
  - The branch took main 9c43e4f, with LP-16 and A5 live: `index.html` MD5 `08CAC338E0F4468FDC82D032DACA7B5D`.
  - MOD-04 publishes on a green Step 8 and ARC-02's delta GO.
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
  - **M1.4, the portfolio overview, is integrated** on `feat/m1-4-overview` (D-038, D-039). On
    `/next/`, section 1 reads a base file through Upload, Validate, Preview and Review, with the import report, the
    as-on date, the family and client labels, the logo, a basic validation panel and the source register; section 2
    shows the headline figures, the asset and product table, the asset class and liquidity pies and the client and
    distributor allocation, with notes; the overview deck (slide C-08) and the overview workbook download once the
    export gate is clear. Every figure comes from one view-model, and a test proves screen, slide and sheet show the
    same text. The four legacy libraries are vendored byte for byte (D-038). KI-147 follows the owner's answer of
    24 Oct 2026 (no fallback, D-039 point 1). Spike gate R1 passed in Excel. The browser QA and the financial,
    Office and security reviews ran on 27 Oct 2026, and the lead's fix round (D-039 points 1 to 15) is merged on the
    branch: display rounding as Excel, the KI-147 notes by holding, raw labels as join keys, client and distributor
    letter case kept with a Warning, Indian money format, the review bar, the screen and slide pies, focus, refusal
    sentences, and the M1.4 cross-unit tests (L26): upload, as-on-change, W-1 and AC-01 (38 tests), with the browser
    check `tests/browser/overview.cdp.mjs`. `npm run accept:office --full` passed on the numbers fixer's branch on
    27 Oct 2026 (6 workbooks, 6 decks), before the owner's Office rule. **The second fix round is integrated** on
    `feat/m1-4-overview` (2 Nov 2026; D-039 points 16 to 20): the reader skips total rows and dates merged folios as
    the live page does (D-041 points 2 and 3; KI-148 fixed in the new app); negative market values are warned and noted;
    joint-holder letter case is reported; the parity is re-run against the live page after fix batch 4 (AG-01, AG-02,
    AG-05, AG-06 and AG-08 retired); the KI-151 guard is pinned by a 7 by 5 grid; the workbook formats sit at the
    rounding edge and a blank row keeps the share row out of the filter; sections 1 and 2 word the matrices, the
    empty liquidity table and a refused file; the C-08 pie clears a two-row legend; and the Office acceptance follows
    the owner's rule of 2 Nov 2026 (attach only; never start, quit or kill Office; NOT RUN with the file paths when
    Office is not running; after a TIMEOUT no further case of that application starts; the edit check runs only
    while Excel is in manual calculation). On the integrated head the suite passes 1,012 of 1,012 tests under IST and
    under UTC (948 of 948 without node_modules, the "(needs npm ci)" suites skipped); the spike 149 of 149;
    overview.cdp 124 of 124.
    **Round 3 is under way** (2 Nov 2026): QA passed `5a4d4c0`, and the financial-domain reviewer approved it,
    naming D-039 point 13 (the owner accepted the half-way rounding for the new app, PD-48). Fixed after it on the
    branch: the security gate's F-1 (the Office runner starts each script through a PowerShell wrapper, so the run's
    exit never ends a script that still holds a file open) and QA's D1 (a file the browser cannot read is refused
    and clears the previous review). KI-190 to KI-192 are filed for a follow-up. The Office acceptance was NOT RUN
    for all 18 cases on 2 Nov 2026 (Office was not running, and the session's execution policy refuses scripts; the
    runner never overrides it): the owner to choose between accepting NOT RUN, opening Office and allowing scripts
    for one run, or opening some of the files by hand. Then the security re-review, ARC-01 at Gate B and the pull
    request. **M2 is next** (instrument matching).
- The owner answered the 28 audit decisions: all accepted except OD-11 (keep the monitor uploads, fixed), D-021.
- The previous owner's second export is expected this week (CR-0004).
- The October 2026 data refresh is due when the files arrive, around 13–17 Nov 2026.

## Current state
- **Live product.** https://productsteamcentricity.github.io/portfolio-review-dashboard/ is the permanent review
  link.
  - It serves `index.html` on `main`. After PR #36 (TA-03, 26 Nov 2026): MD5 `08CAC338E0F4468FDC82D032DACA7B5D`,
    16,408,172 bytes, with the October 2026 refresh, CR-0010, LP-16, A5 and the tax batch. (After PR #16 it was
    `12B5E5727FCA01EF2EA162C59913F01D`.) New-build merges leave `index.html` unchanged.
  - In review: LP-16b, the platform's Product Name values (CR-0012, branch `fix/lp16b-platform-product-names`): page
    `5EFA338421B879D3C9A16F51A751AC5A`, 16,409,786 bytes; live on the owner's "publish", before 13 Dec 2026.
  - After every deploy the live page is downloaded and its MD5 compared with `main` (batch 1a verified 19 Oct
    2026).
  - Data vintage: 31 Oct 2026 (October refresh: analytics, performance and risk), except ranks (15 Aug), fund managers
    (31 Aug), PMS returns (31 Jul) and AIF (30 Jun).
- **Repository.** `C:\dev\portfolio-review`; `origin` =
  https://github.com/productsteamcentricity/portfolio-review-dashboard (**public**, D-008).
  - Commits use Products Team Centricity with the GitHub no-reply address. Since 19 Oct this laptop's global git
    identity is the no-reply address too.
  - Merges are made locally with that identity, because GitHub's merge button records the account e-mail
    (KI-098).
- **Monthly refresh.** `buildtools/` was proved byte-identical on September (CR-0003). The process is in
  docs/MONTHLY_REFRESH.md, brought up to the October run by LP-19 on 26 Nov 2026.
  - October 2026 is published and was archived on 26 Nov 2026 (`02 Archive\2026-10`; refresh log 2026-10 §8).
  - The inbox `01 Monthly Updates\2026-11` is ready for the December refresh (data as on 30 Nov 2026).
  - The PDF slide scripts are reviewed by ARC-02 (render-pdf 958b095e GO on conditions; shrink 530357e6 GO after its
    one-line fix).
  - Before that window, one item remains: month-parameterised risk scripts, a separate toolchain item.
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
     exemption already used; questions 17 ("Listed AIF" is Category III) and 18 (crypto stays out of set-off) were
     answered on 2 Nov 2026, D-043, and questions 21 (the AI Analyst keeps following the class, PD-50) and 22 (the
     fund's own AIF category wins, PD-47) the same day, and question 24 (the Listed AIF ruling counts only for the fund
     of the performance entry's own name: "Restrict it (Recommended)", D-043) on 9 Nov 2026; from part T5 one is open
     for the owner: whether real IRR exports name a zone in their dates (question 23), and two are for the tax adviser:
     whether the Income-tax Act 2025 keeps the four rules the page applies to virtual digital assets (30 percent, no
     set-off of a loss against a gain on them, no set-off or carry-forward of their loss, no netting of one asset's gain
     against another's loss; question 25), and whether the Category III AIF sentence should carry the reckoner's clause
     on determinate trusts (question 26));
     OD-28 is answered by the reckoner (Sec. 76, old 50AA);
   - answer M1.3's questions in [`DATA_DICTIONARY.md`](DATA_DICTIONARY.md) §8: unrecognised Asset Names such as
     "Gold" (BF-19), letter case of Asset Names (BF-26) and a market value of 0 (M1.4 runs on the M1.3 defaults;
     KI-147 was answered on 24 Oct 2026, D-039), and, from M1.4, whether to fold letter case for client and
     distributor labels, joint-holder columns included (kept as spelt today, as in the legacy), and question 1 of
     D-041 (the holding days of merged folios, for both builds);
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
4. **Claude: M1.4** (`feat/m1-4-overview`): the browser QA, the financial, Office and security reviews, the lead's
   fix round (27 Oct 2026) and its second fix round (integrated on `feat/m1-4-overview`, 2 Nov 2026) are done; in
   round 3, QA passed and the financial-domain reviewer approved `5a4d4c0` (D-039 point 13 by name), and F-1 and D1
   are fixed after it. Left: the owner's choice for the Office acceptance (NOT RUN for all 18 cases on 2 Nov 2026:
   accept NOT RUN, allow scripts for one run with Office open, or open some files by hand), the security re-review,
   ARC-01 at Gate B; then CI, the release-check report, the pull request (body drafted:
   the SheetJS CE 0.18.5 risk carried, CVE-2023-30533 and CVE-2024-22363, Q-12, TB-26; the corrections that change
   client numbers; KI-148 done; the rollback; what stays open), the merge after MOD-02's go and ARC-01's GO, and
   the Pages check (`/` byte-identical to `index.html`, `/next/` the overview). Recorded as built (D-039): labels of
   adjacent small pie slices may sit close together; the Warnings that make no note; Excel's money format limit at or
   below -1,00,000 and a possible -0.00. Open for the lead: the validation panel files those Warnings under
   "Footnoted"; `base-file.total-like-name` still makes a fund named "Total Return ..." High; the C-08 plot layout
   starts at 5 categories (a long 4-label legend or a one-row legend is not covered).
5. **Claude: M2**, instrument matching ([roadmap](new-build/07-implementation-roadmap.md)). Sprint 1 of M2.1 (identifiers and
   the matcher at parity, no output change) merged in PR #30 and was accepted on 25 Nov 2026. Sprint 3a (the vendor files
   read by header name: MF Monitor, its all-in expense ratio, SIF Monitor, PMS performance, the analytics files; and the
   base file's ISIN column, read only) merged in PR #31 and was accepted on 25 Nov 2026; the upload buttons wait for the
   SheetJS 0.20.2 upgrade (Q-12, approved by the owner on 26 Nov 2026). Sprint 2a (matcher corrections, under the owner's
   "new build first" exception to D-028 of 25 Nov 2026) is on `feat/m2-2a-match-corrections`: the owner's 16 fund aliases
   (PD-36), no answer decided by candidate order (KI-036), fund-house words never distinctive (KI-101), the re-key of ranks
   and risk ratios (KI-052, OD-23), the same-scheme Direct twin (KI-054), the fund ISIN map and code join, merged rows with
   different ISINs (S3-1), and the stricter regime (option B) the owner chose on 26 Nov 2026 (`NEW_BUILD_MATCHING`); all
   opt-in at the engine, measured both ways (`tests/parity/matching-corrections-ledger.json`), not wired into the page
   yet. Sprint 2b (the product-class table, after the live page's LP-16, now merged) follows.
   Beside M2, the data-platform items (NB-04): M10, the MF Screener data pack reader and browser store, merged in
   PR #37 and accepted on 26 Nov 2026 (not wired); M11a, the monthly update engine core, on its own branch
   (`feat/m11a-monthly-engine`); M12a, the drawdown engine on index data, merged in PR #38, owner Gate E pending (the
   owner's answers of 25 Nov 2026 are its defaults;
   which index stands for each asset class, the part-month recovery rule, flagging missing months and the tie rule
   wait for the owner).

   **Claude: M3a**, the returns core (XIRR, the IRR file reader, the IRR tree, contributors and laggards, returns per
   family, client and advisor scope), is merged (PR #34) and accepted by the owner (Gate E), not wired into the page yet. Open before it reaches
   the page: the reconcile tolerance (D13), how an instrument split between distributors is shared, and the owner
   questions in its Gate A report. The IRR parity ledger waits for a real export (TA-03, KI-186).

   **Claude: M7a**, the capital-gains statement reader (PAN removed at read time, repeated lots reported, blank cells
   reported) and the blank template, is merged (PR #35) and accepted by the owner (Gate E), not wired into the page yet. Lot classes,
   the tax rules and the tax engine stay owner-gated (PD-16, LP-01).
   Model contracts-1 (PR #29, types only): I-31, I-32, I-44, I-45 and decision C-01. Model contracts-2 (PR #40, types
   only): contract I-37 (`app/src/model/tax.ts`) and the analyst question as a union on its kind.
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
| P1 | The legacy page's base-file reading defects found by M1.3: KI-146 (the IPS takes only the last allocation row of a class) and KI-140 to KI-145 (partial merged units, first-folio dates, total rows read as holdings, text read by `parseFloat`, impossible dates rolled, variant asset labels split into rows); live-page data fixes under D-028, measured on the real base files first. Fixed in fix batch 4 (CR-0009, D-041), merged in PR #16 (`6443826`) | legacy fix batch |
| P3 | The legacy page's PptxGenJS pie colours (KI-150), found by M1.4 and avoided in the new app; and the live page's prototype-label defect, KI-183 (Workstream A; labels such as "constructor" break the review), whose new-app guard KI-151 is pinned by the 7 by 5 grid | legacy fix batch |
| P1 | The legacy `FUND_RANKS` block (fund ranks issued 15 Aug 2026) is an open item: whether the legacy page removes it now (a data change under D-028, which would also remove what uses it, such as the AI Analyst's rank signal) or keeps it until switch-over is to be decided by the lead under D-033 and recorded | decision, then a legacy data change |

## Records
- What the owner asked for: `docs/change-requests/`.
- Every monthly refresh: `docs/refresh-log/`.
- Every audit: `docs/audits/`.
- What changed: `CHANGELOG.md` and `git log`.
