# Changelog

All notable changes. Dates are IST. `index.html` MD5 is recorded for every change to the product.

## [Unreleased]

### Added (new build, M2.1 sprint 2a: matcher corrections, opt-in; not wired into the page yet)
- **Owner fund aliases** (`data/owner/fund-aliases.json`, `engine/match/owner-aliases.ts`; KI-050, PD-36): the 16 renames the
  owner approved on 25 Nov 2026, each with public evidence and Regular and Direct targets; line 17 applies only to names
  saying "regular savings" (ICICI Pru Savings Fund shares its normalised key). Line 10 is on hold.
- **KI-036** (`MatchOptions.nullOnTies`): a candidate equal to the raw name wins first; Growth and IDCW of one scheme are told
  apart by the holding's own option ("Dividend Yield" is a category); any other tie gives no match.
- **KI-101** (`MatchOptions.houseTokens`): a fund house's words (the leading words at least 90% of its names share) and the
  holding's AMC words never count as distinctive; the thresholds are unchanged. The audit's idf weighting was measured and
  not adopted (it lost correct official AMFI names or added wrong matches).
- Measured both ways over the real universes (`tests/parity/matching-corrections.ts`, ledger with every changed answer;
  official AMFI names as a real-world recall corpus, `tests/parity/amfi-names.json`): self regressions 0; leave-one-out
  wrong matches 3,932 to 2,725; official names right 1,195 to 1,194 (one score tie the legacy won by candidate order).
- **Option B, the stricter regime** (`MatchOptions.absentFundGuard`; the owner chose it on 26 Nov 2026, on in
  `NEW_BUILD_MATCHING`, the preset the wiring will use): rejects a candidate that leaves a known rare word of the holding's
  name unmatched; measured 2,725 to 1,594 wrong matches for absent funds and 21 of 1,206 correct official names unmatched
  (mostly normaliser gaps; a measured follow-up aims to recover them).
- **KI-052, OD-23, KI-054** (`engine/match/rekey.ts`): FUND_RANKS_CODES and MF_RISK re-keyed onto MF_PERF keys by spelling
  and owner alias, never by fuzzy match (`tests/parity/rekey-ledger.json`, also the FUND_RANKS_CODES vintage record);
  the Direct twin only for the same scheme; the look-through key.
- **Fund ISIN map** (`engine/match/amfi-isin.ts`, `scripts/amfi-isin.ts`): from the monthly NAV fetch's ids file, ISINs of the
  form only, ambiguous ones left out; the crosswalk resolves a fund ISIN or AMFI code through FUND_RANKS_CODES and the
  official AMFI names, each re-keyed (opt-in: `MatchOptions.identifierJoin`, in `NEW_BUILD_MATCHING`). The first real file comes
  from the December refresh.

### Fixed (new build)
- **S3-1:** a merged holding whose rows carry different ISINs keeps none, with the Warning `base-file.isin-disagree`.


### Changed (records, registers-4, 26 Nov 2026: docs only; no change to `index.html`, `app/` or data)
- **`docs/project-control/DECISION_LOG.md`**: the owner's answers of 17 to 26 Nov 2026. PD-01, PD-04 and PD-44 accepted
  (25 Nov, "Accept all"); PD-16 answered except item 4, which stays with the tax adviser (26 Nov); PD-36 answered for
  the renamed-scheme list (16 aliases approved, line 10 held; C4 and C5 covered); PD-54 confirmed; PD-56 changed; the
  PD-30 publishes listed; PD-07 still open. PD-57 to PD-66 added with plain-language sections (PD-62 and PD-63 open).
  New section 2.4: owner decisions without a PD number (Stage 0, the D-7 labels and the bond label, the "ISIN" column
  for the new build only, the D-028 exception for matching corrections, the standing `/next/` rule, the M12a
  defaults, Q-12, matching option B, the one-time item 6 run, the Gate E acceptances, the test build target).
- **Chat registers**: CHAT-006 (MOD-03) handed over to CHAT-013 (MOD-04) on 25 Nov 2026, a planned early succession
  under PD-65; CHAT-010 NB-03, CHAT-011 NB-04 and CHAT-012 ARC-03 opened 24 and 25 Nov; ARC-02 (CHAT-008) is ARC-01's
  sole rule-10 successor; compactions from the transcripts' markers; next free number CHAT-014
  (`CHAT_REGISTRY.md`, `docs/coordination/CHAT_SUCCESSION_REGISTER.md`, `CONTEXT_COMPACTION_TRACKER.md`).
- **`docs/coordination/FILE_OWNERSHIP_MAP.md`**: `app/src/engine/scope.ts` to NB-03 (first consumer of I-45, decision
  D8 of 25 Nov; NB-02's M4b imports it); `tests/side-by-side/` to EX-02.
- **`docs/coordination/CODING_MAP.md`, both `INTERFACE_CONTRACTS.md`**: statuses for PRs #28 to #40; I-21 now 34
  rows on main; I-31, I-32, I-44, I-45 and C-01 on main (PR #29), I-37 (PR #40); a pointer row for I-28 to I-45.
- **KI-184 and TA-06**: no live fix planned; TA-06 and LP-03 dropped (the owner's "ISIN" column is for the new build's
  template only, 25 Nov 2026).
- **`docs/PROJECT_STATE.md`**: the records entry, the live page after PR #36, the data vintage, and the merged
  M2.3 sprint 3a, M10 and M12a.

### Changed (new build, model contracts-1: contracts I-31, I-32, I-44, I-45 and decision C-01; types only, `/next/` build byte-identical; merged 25 Nov 2026 in PR #29, entry added by registers-4)
- **`app/src/model/returns.ts`** (I-31): `XirrResult` with its gap and status mapping, `ReturnsCoverage`, the IRR tree
  nodes, the OD-4 reconciliation, unassigned flows, contributions, `ScopeReturns`, `WeightedReturn` (E-147, E-148).
- **`app/src/model/transactions.ts`** (I-32): `Transaction`, `IrrFileImport` and the free-text date rule (KI-186): a
  date written as text is that day in every time zone.
- **`app/src/model/index-series.ts`** (I-44): `IndexId`, `IndexSeries`, `IndexSeriesImport`.
- **`app/src/model/scope.ts`** (I-45): `Scope`, `ScopeKey`, `ScopeBasis` (the re-basing rule, Q-57).
- **Decision C-01**: `BaseFileImport`, `MoneyFinding` and their parts move from `ingest/base-file.ts` to
  `model/base-file.ts`, and `MoneyUnit` from `engine/units.ts` to `model/value.ts`; both old places re-export them, so
  no importer changed, and `model/` imports nothing outside `model/`.
- `tests/unit/model/contracts.test.ts`: the cycle broken, the re-exports intact, types only, contract ids cited, the
  I-32 date rule in IST and UTC.
### Added (new build, M11a monthly update engine core; the legacy refresh pipeline is unchanged)
- **`scripts/monthly-update/`** reads a month's files from the private inbox and `monthly_updates/YYYY-MM/`, classifies
  each by content, then structure, then name (client material detected first and quarantined, never copied; a name and
  content that disagree stop the file, and a name that looks like client material stops it even when the content is
  vendor data, so it is never staged and its name stays out of the committed files), fingerprints them (SHA-256 + role + key + month), stops a role on competing
  files or a stale copy of an earlier month, reports files whose as-on belongs to another month, validates the MF
  Screener data pack with the app's own reader and records only its fingerprint, contract version, cycle and counts
  (D-026), and writes `MANIFEST.json` and `UPDATE_REPORT.md` atomically. Dry run by default; a repeat run changes no byte
  (AC-24). Office files are read as zip and XML only. Checked privately on the real October inbox (dry run).
- Tests on synthetic files built at run time (`tests/fixtures/make-monthly-files.ts`): `unit/monthly-update/{classify,
  ledger,zip,report}`, `integration/monthly-update` (53 cases; AC-12, AC-21 pack in a tracked folder, AC-24).

### Changed (new build, model contracts-2: contract I-37 and the analyst question; types only, `/next/` build byte-identical)
- **`app/src/model/tax.ts`** (contract I-37): the lot and roll-up types of the capital-gains and tax engine
  (`RealisedGain`, `TaxInputs`, `Bucket`, `PersonYearTax`, `FamilyTaxYear`, `TaxPosition`, `HarvestResult` and their
  parts; DATA_DICTIONARY §5.5 and the `tax.*` paths of §6). Its header names the sources of record (statement lots:
  `data/owner/tax-rules.json` table v1; holdings, FIFO lots and harvesting: `data/refdata/TAX_RULES.json`, I-21; the
  agreement test between them) and the known-answer file `tests/fixtures/cg-known-answers.json` with its schema.
- **`app/src/model/value.ts`**: units `inr` (rupees, unrounded) and `inr-per-unit` (a price); Crore stays the basis of
  every weight.
- **`app/src/model/validation.ts`**: `AnalystQuestion` is a union on `kind` of `XirrUnitQuestion` and
  `CapitalGainsRepeatsQuestion`; `CgRepeatAnswer` moves into the model, and `ingest/capital-gains.ts` re-exports it and
  aliases `CgRepeatQuestion` to the model type. The base file's questions are typed `XirrUnitQuestion[]`, so the import
  report can render only XIRR-unit questions. `tests/unit/model/contracts.test.ts` covers I-37 and the union (10 tests).
### Changed (LP-19, the December refresh prep: docs only; no change to `index.html` or the pipeline)
- **`docs/MONTHLY_REFRESH.md` brought up to the October run** (refresh log 2026-10). This is a docs branch under
  MOD-04's exception to FILE_OWNERSHIP row 20, which allows the runbook to change only on a `data/YYYY-MM-refresh`
  branch.
  - Files: the vendor's benchmark exports (`Benchmarks`), the Investment Reckoner PDF (`Outlook export`), the pagers
    deck and Other Funds Analytics; niftyindices only as the fallback.
  - Step 3: Market Update slides from the Reckoner PDF with Windows' PDF renderer, no Office. The scripts are pinned
    by SHA-256 as ARC-02 reviewed them (render-pdf 958b095e GO on conditions C1 to C3; shrink
    530357e6 GO after the one-line fix). The PowerPoint COM snippet is removed.
  - Step 4: the in-house risk chain (tools, launch rule, inputs, hard stops).
  - Step 4b: the AmfiFetch ids file for the new build.
  - Step 7f: Other Funds analytics for carried look-throughs.
  - Step 8: IST and UTC with `run-regression` and `node --test`, the heavy-run lock, and a read-only FUND_RANKS_CODES
    rename check with its known answer (55 "renamed?", 0 "gone?").
  - Step 10: the archive with SHA-256 lists before and after.
  - Part 3 brought up to date.
- `docs/MONTHLY_UPDATE_GUIDE.md`: the same file list.
- `docs/refresh-log/2026-10.md` §8: published (PRs #21 to #36) and archived on 26 Nov 2026.
- `docs/refresh-log/TEMPLATE.md`: sections for slides, the risk chain, the ids file, Other Funds, the rank check and
  the archive.

### Added (new build, M12a drawdown engine on index data; not wired yet; the index for each asset class awaits the owner)
- **`app/src/engine/drawdown.ts`** (E-149, D-023 point 2): per index series the maximum peak-to-trough fall, its peak and
  trough days, the recovery day and the months to recover from the trough (or not yet recovered); a blend of series at
  given weights on the days every series has. `compareDrawdowns` applies the owner's answers of 25 Nov 2026 as named
  defaults: month-end points measured from the period's first day, months to recover counted in month-end steps, one
  common period for every index and the blend (returned so it can be shown), and monthly rebalancing to today's weights
  (`buy-and-hold` also built). Months with no point are listed per index and for the blend, and the result is flagged,
  never hidden. Which index stands for each asset class is still open with the owner, so the caller passes the weights.
  Built on the I-44 index-series type. Known-answer tests (`unit/engine/drawdown.test.ts`, 28 cases, IST and UTC),
  including the matrix's -30.00% case.

### Added (new build, M10 Screener data pack: reader and browser store; not wired into the page yet)
- **`app/src/ingest/screener-pack/`** reads an MF Screener data pack (contract `pr-datapack-v1`, D-026): the zip's central
  directory is checked against archive limits before anything is inflated (path traversal, entry count, nesting,
  encryption, declared sizes and ratio, local headers against the directory; inflation stops at the declared size);
  then the manifest (contract version, cycle, every entry listed, required files),
  each file's size, SHA-256, header cycle and record count, and a schema per file, including the contract's unit suffixes
  on every field. A refused pack gets one reason naming the file. Extensions seen in real packs (extra fields,
  off-contract status codes, the `equity_sleeve` basis, a provisional pack) are accepted with warnings. The backfill pack
  is read with its month-ends and earlier cycles. The vendored JSZip is passed in; no new library.
- **`app/src/services/screener-store.ts`** keeps an accepted pack in IndexedDB (`prd.next.v1.screener`): a newer cycle
  replaces it as a whole, an older one is refused, the same SHA-256 is a no-op, month-end holdings of replaced packs and
  the backfill stay as history (newest cycle wins per month-end), every read is SHA-256 checked, a quota error keeps
  nothing. No score, rank or pack figure is written outside the pack's own files; nothing leaves the browser.
- Tests on synthetic packs only (`tests/fixtures/make-screener-pack.ts`): `unit/ingest/screener-pack`,
  `unit/ingest/screener-pack-zip`, `unit/services/screener-store`, `integration/screener-pack-reimport`.
- **`scripts/validation/check-next.mjs`** fails the build on MF Screener pack content in any form (D-026): quoted or
  unquoted keys (a pack JSON bundled by esbuild), escaped JSON, the summary CSV header, the fixture marker
  (`tests/next/check-next-pack.test.mjs`).

### Fixed (fix batch 3: tax rules per the TY2026-27 reckoner, CR-0008)
- **Tax batch, stage S12 (CR-0008): ARC-02's Gate B points on d7683a0, settled conservatively (MOD-04, 25 Nov 2026), and
  foreign bonds.** `index.html` MD5 `8A233F94CA795FFA26029DC7CE6C744F` → `5EA6990734AB65C1C243B3990C234198` (patch
  `tools/patches/2026-11-25-tax-6-wording.js`; test `tools/regression/TA03-tax-6-gate-b.js`, 50 checks, 34 fail on d7683a0).
  - T1: the Crypto row's source note, shown on the Taxation tab, ends "to be confirmed with the tax adviser." instead of
    "for the owner to confirm." (a client may read "the owner" as the portfolio's owner); the latent set-off note records
    the decision of 2 Nov 2026 (D-043). `KI-182-crypto-source.js` asserts neither note names the owner.
  - T2: an AIF entry's category is read as a statement about the holding only when the two names are the same word for
    word (PD-54: letter case, punctuation, brackets and the word AIF ignored; no word dropped, replaced or de-duplicated).
    "X Income Opportunities Strategy" and "The X Opportunities Strategy" are no longer the entry "X Opportunities
    Strategy": Category I or II, assumed, with the note. No existing check changes.
  - T3: the tab's crypto set-off sentence says "(confirm with the tax adviser)", as the slide does.
  - A bond whose Product or Category names a foreign or US-dollar route (LRS, USD, US$, dollar, foreign, overseas,
    international, global, offshore, GIFT City, IFSC, eurobond) is no longer taxed as a domestic row (MLD, G-Sec,
    unlisted or listed bonds): no tax class, with the reason "No tax row is published for a foreign or US-dollar bond
    (held through the LRS, GIFT City or abroad). Confirm its tax with the tax adviser." (MOD-03 and MOD-04, with LP-16;
    widened and moved first by the financial review). "NCD", "Bonds" and "Debenture" keep their rows: the tax class is
    not read from LP-16's product labels.
  - A share whose Product or Category says offshore ("Offshore Equity Shares") is a foreign-listed share, as "foreign",
    "international" and "overseas" already were. Question 27 for the tax adviser covers foreign bonds and GIFT City shares.
- **Tax batch, part T5 (CR-0008, D-040, D-043): the follow-ups to parts T1 to T4, the owner's answers to questions 17,
  18 and 24, and the corrections from two reviews.** `index.html` MD5 `0713C6BEEFCB35D778730AB9BEF3E430` →
  `32CE9C58307178C4A76379AA6170C413` (16,898,566 → 16,917,748 bytes; patch `tools/patches/2026-10-27-tax-5-followups.js`).
  On branch `fix/legacy-batch-3-tax-cr-0008`, which carries the whole batch; the batch merges as one change.
  - Aggressive hybrid, arbitrage and equity savings funds take the reckoner's usual bucket only when the review is valued
    on or after 1 Apr 2026, labelled "usual bucket per the tax reckoner; confirm with the fund house"; before that date
    they are unclassified, with a reason (KI-170). Equity savings funds are now classed from that date; aggressive
    hybrid and arbitrage funds are no longer classed in a review valued earlier. The AI Analyst's tax signal follows the
    class, so a book that holds these funds can get different trims, target weights, action labels (an Exit can become a
    Partial) and plan summary (PD-50, CR-0008 question 21; D-040 has ARC-01's figures).
  - A fund called a Listed AIF is Category III, fund level, with a note that asks the analyst to confirm the category
    (question 17, D-043); an AIF whose category the file does not state stays Category I or II with a note; a fund's own
    stated category wins; the category the performance data gives is a statement about the fund only when the names
    are the same, "AIF" and brackets ignored (the name matcher is loose); the category is read once, in `taxClassify`;
    the data's Listed AIF label counts only for the fund of the entry's own name, "AIF" and brackets ignored (question
    24, stage S10; the same equality for the category the data states, stage S11; below).
    Question 18: crypto stays out of set-off, with no change to the rule or to any figure (two sentences were reworded,
    below).
    On the sample book no tax, LTCG, STCG, estimated tax, saving, harvest or total CMV moves; the not-classified CMV and
    gain move into a Fund level amount (2.7051 to 2.0535 Cr, new 0.6516 Cr).
  - An IRR date written with an explicit zone ("2023-04-01T20:00:00Z") is read as the day written in every time zone
    (KI-186, interface I-04); other zone text keeps the machine-local day.
  - The harvest inputs are text fields that read Indian and international digit grouping, a rupee sign, Rs, INR (with
    or without a dot), "/-", "/=", a trailing INR or Rs, a "%" in the slab rate and an exponent; no "-Rs 0.00"; the
    unreconciled table says why, and a sale with no price has its own reason; the class footnote fits the slide (KI-109) and the class and harvest slides count holdings in the singular and the plural; the wording
    says "the tax reckoner" because the AI Analyst slide goes to the client.
  - `ENGINE.taxDefaults` is frozen and `check-invariants` lists all 28 engine names and checks them both ways (KI-185). KI-184 is filed (the base
    file's ISIN column is not read; D-040 point (c) corrected). The independent review (8 reviewers, 51 findings) and
    the delta review of its corrections (6 reviewers) and ARC-01's pre-review of the stages are answered in CR-0008; KI-200 to KI-206 are the first review's
    open findings, KI-207 to KI-212 the delta review's and ARC-01's, and KI-213 and KI-214 were filed after the gate
    review (below).
  - The owner answered on 2 Nov 2026: the fund's own statement wins when an AIF's category is read (PD-47, D-043) and the AI
    Analyst keeps following the class, with the effects disclosed (PD-50, D-040). The two sentences that said crypto is kept out
    of set-off "pending" a ruling now state the rule (KI-182; no figure moves).
  - 4 new regression files (`CR-0008-T5-followups.js`, `CR-0008-T5-item10-listed-aif.js`,
    `CR-0008-T5-item11-irr-zone-dates.js`, `KI-185-engine-keys.js`); `KI-166` and `KI-169` (one assertion each), `KI-170`, `KI-171`, `KI-180` and
    `KI-182` changed. 47 files, 1,649 checks (1,619 before stage S10), pass in IST and UTC; `node --test` 234/234 (at
    stage S9); `smoke-review` 36/36; `test-ai-analyst` 24/24. The final head's results go into the pull request.
  - The five-reviewer review of the committed head (two financial-domain reviewers, a security and release reviewer, a
    documentation auditor and a test-quality auditor; 62 findings, 2 Nov 2026) is answered in CR-0008, "The gate reviews
    of the committed head". The page was unchanged by those corrections (`index.html` stayed
    `391E722FFDC585D8D614CA7029FB8EA1` until stage S10, below). The records were corrected (D-040, D-043, KNOWN_ISSUES, TESTING, PROJECT_STATE, legacy ARCHITECTURE, and `CLAUDE.md`, whose
    `smoke-review` count is now 36); 30 checks were added to `CR-0008-T5-followups.js` (130 in all) and 5 to
    `CR-0008-T5-item10-listed-aif.js` (90 in all), `KI-182-crypto-no-set-off.js` no longer pins the stale data text and
    `KI-185-engine-keys.js` cleans up after itself and plants a number, a string, a function and an object; there is one
    new question for the owner, CR-0008 question 24 (a fund that the loose name matcher only links to a Listed AIF
    entry; answered 9 Nov 2026, below), and two for the tax adviser, questions 25 and 26.
  - Stage S10 (9 Nov 2026), the owner's answer to question 24, "Restrict it (Recommended)": the data's Listed AIF label
    gives Category III only for the fund of the entry's own name ("AIF" and brackets ignored; all 11 genuine entries of
    the data are unchanged, also written "Name AIF" or "Name (AIF)"); a fund that the loose name matcher only links by a
    similar name is Category I or II, assumed, with the note (D-043, KI-166, KI-171). The Taxation tab's crypto
    sentence no longer cites the owner ("as the reckoner is silent on them", KI-182). No tax figure moves.
    `CR-0008-T5-item10-listed-aif.js` has 116 checks (90) and `KI-182-crypto-no-set-off.js` 33 (32). KI-213 (a dash in
    the AI Analyst's "Not assessed" reason) and KI-214 (the regression runner passes a test file that runs no checks)
    are filed.
  - Stage S11 (9 Nov 2026), ARC-01's pre-check of stage S10: the same name equality now serves step 2 of the AIF
    category reader. The category that the performance data states (Category I, II or III) counts for the fund of the
    entry's own name, "AIF" and brackets ignored, as the Listed AIF label already did at stage S10. Before, the one
    genuine Category III entry written "Name AIF" or "Name (AIF)" read as an assumed Category I or II while a Listed AIF
    written the same way read Category III. It is now Category III as the data states it (fund level, no note that it
    is called a Listed AIF, no assumed note); an entry that states Category I or II is a statement for those spellings
    too; a merely similar name still reads Category I or II, assumed, with the note; the 11 Listed AIF entries are
    unchanged (D-043, KI-166, KI-171). No tax, LTCG, STCG, estimated-tax, saving or harvest figure moves. `index.html`
    MD5 `98320D28…` → `32CE9C58…` (16,917,896 → 16,917,748 bytes; the engine block only);
    `CR-0008-T5-item10-listed-aif.js` has 119 checks (116).
- **Tax batch rebased on fix batch 4 (CR-0008): the branch merged `main` (PR #14 to #16) and its page was rebuilt**
  from main's page (fix batch 4) with the four tax patches in file-name order: `index.html` MD5
  `12B5E5727FCA01EF2EA162C59913F01D` → `0713C6BEEFCB35D778730AB9BEF3E430`. Parts T1, T3 and T4 apply unchanged. Part T2
  has two anchor revisions where the batches meet: the TX-17 sentence on an unreconciled holding with no lots anchors
  on the end of that reason (its one-line anchor occurred twice once fix batch 4, KI-140, added an unreconciled exit for
  a merged folio with blank units), and a new edit puts the same sentence after fix batch 4's reason for that holding,
  which is unreconciled too, when one of its IRR trades is dated after the valuation date. New checks: KI-176 (2),
  KI-166 (1: a merged AIF with blank units stays fund level) and KI-169 (2: a merged PMS with blank units is
  unreconciled; one whose folios all lack units stays not split). 43 regression files, 1,277 checks, pass in IST and
  UTC; detail in CR-0008, "Rebased on fix batch 4".
- **Tax batch, part T4 (CR-0008, D-040): the financial re-review of part T3. Crypto is kept out of set-off until the
  owner rules.** `index.html` MD5 `BB888D8E272AADE90291ED0A6ECA1721` → `61FC0FB25FB1429F805B140FBA6B308E` (patch
  `tools/patches/2026-10-27-tax-4-review.js`). On branch `fix/legacy-batch-3-tax-p3-r2` with part T3, on top of part
  T2; the batch merges as one change.
  - The Crypto row carries `noSetOff` and its basis (`noSetOffSource`): no loss is set against a crypto gain, which is
    taxed in full before and after; a crypto loss reduces no other gain, is never shown as carried forward and is not
    offered as a holding to sell. One sentence on the tab's harvest card and on the harvest slide says so (KI-182,
    KI-175; CR-0008 question 18). A book with no crypto is unchanged.
  - Known answer: a Rs 1,00,000 crypto gain, a Rs 20,000 equity short-term loss and a Rs 2,00,000 equity long-term
    gain save Rs 2,500 (part T3: Rs 6,000), crypto tax Rs 30,000 before and after; a Rs 1,00,000 crypto loss against a
    Rs 1,00,000 equity short-term gain saves 0 (part T3: Rs 20,000).
  - Corrections: the PMS probe's former saving is Rs 62,500, not Rs 63,000 (KI-169); the findings fixed are 22 of the
    23 and KI-177 in part, not 21; the part T2 entry below had lost its heading line.
  - `data/refdata/` regenerated. 1 regression file, `KI-182-crypto-no-set-off.js` (30 checks, 28 failing on the T3
    page); 36 files in all. `smoke-review` sums the two new harvest figures in its family check.
- **Tax batch, part T3 (CR-0008, D-040): the harvest, AIF and PMS treatment and the wording follow the TY 2026-27 Tax
  Reckoner.** `index.html` MD5 `AE70F78B0C89E57692EE9C71A2AC8358` → `BB888D8E272AADE90291ED0A6ECA1721` (patch
  `tools/patches/2026-10-27-tax-3-harvest.js`). On branch `fix/legacy-batch-3-tax-p3-r2`, on top of part T2; the batch
  merges as one change.
  - The harvest is worked out per client and the family view adds the clients' results; one client's loss is never set
    against another's gain, and the tab and slide say whose loss is left over (KI-167).
  - The Rs 1.25 lakh Sec 198 exemption applies per client after set-off, to listed shares, equity-oriented funds and
    REIT and InvIT units only, less the amount the analyst enters as already used this tax year (default 0); it has its
    own line in the pool table and the footnote no longer implies it for other gains (KI-168, closes KI-130).
  - Losses go first to the gains taxed at the highest rate: slab-rate gains are ranked at the analyst's slab rate
    (default 30%, never given a tax figure, the gains they shelter shown); gains inside the exemption are reached last;
    ties follow a fixed order (KI-175).
  - AIF Category III is taxed at fund level: no investor-level gain, loss or tax, its own "Fund level" amounts, out of
    the harvest (KI-166). AIF Category I and II are pass-through and a PMS is taxed per security: neither is split by
    the investor's own flows any more; both stay in the totals as not classified, out of the harvest, with a note
    (KI-171, KI-169).
  - Carry-forward reads "for up to eight tax years, provided the return is filed by the due date" on the tab and the
    slide (KI-181). The Crypto row keeps 30% for any period and states its source (KI-182).
  - Both assumptions (slab rate, exemption already used) are inputs per client on the Taxation tab, marked default
    until changed, stated on the harvest slide, and cleared when another family is loaded (`resetFamilyState`, KI-001).
  - The synthetic sample book: tax before harvesting Rs 0.267175 Cr → Rs 0.181787 Cr (its PMS and Category I/II AIF
    leave the long-term pools; each of the two clients' exemption applies); long term 5.547273 → 3.639173 Cr, not
    classified 0.797 → 2.7051 Cr.
  - TAX_RULES still 34 rows (fields `sec198`, `fundLevel`, `passThrough`, `perSecurity`, `source`; `data/refdata/`
    regenerated). 8 regression files (142 checks), each failing on the T2 page; 9 earlier tax tests state their
    figures with the exemption taken as used; 35 files in all. `smoke-review` 36 checks.
- **Tax batch, part T2 (CR-0008, D-040): holding periods and lots follow the TY 2026-27 Tax Reckoner.** `index.html`
  MD5 `5717A7967294FA13ED3A65111D80DA61` → `AE70F78B0C89E57692EE9C71A2AC8358` (patch
  `tools/patches/2026-10-27-tax-2-holding-period.js`). On branch `fix/legacy-batch-3-tax-p2`, on top of part T1; the
  batch merges as one change.
  - A lot is long term from the day after the anniversary of its purchase (more than 12 or 24 months), not after 13 or
    25 whole months; the months are calendar months, clamped to the month end (29 Feb to 28 Feb, for the tax adviser to
    confirm) (KI-160). "Long term after" reads "More than N months".
  - Debt fund units (with target maturity funds, debt ETFs and debt FoFs) and conservative hybrid units bought before
    1 Apr 2023 are no longer Specified: two new rows give them the general rule, long term after 24 months (12 for a
    listed ETF) at 12.5%; a holding bought on both sides of the date is split into two records that add back to it and
    count as one holding (KI-161). Free-text IRR dates are read as their calendar day.
  - Holding periods run to the base file's valuation date: its own Valuation Date column, else the portfolio date set
    for the review, else (with a note) the IRR sheet's latest date; IRR trades after it are left out of the lots and
    named (KI-176, with KI-022).
  - Lots of shares, equity-oriented funds and REIT or InvIT units bought before 1 Feb 2018 are counted and disclosed as
    measured on actual cost, without the 31 Jan 2018 step-up (KI-177, step 1; no figure changes).
  - TAX_RULES 32 → 34 rows (`data/refdata/` regenerated). 4 regression files (118 checks), each failing on the T1
    page; 27 files, 950 checks in all. The synthetic sample book's taxation is unchanged.
- **Tax batch, part T1 (CR-0008, D-040): the tax classes follow the TY 2026-27 Tax Reckoner.** `index.html` MD5
  `911A04659CB34383E478416B54E9C306` → `5717A7967294FA13ED3A65111D80DA61` (patch
  `tools/patches/2026-10-27-tax-1-classification.js`). On branch `fix/legacy-batch-3-tax`; it merges with the later
  parts of the batch, never alone (the 1 Apr 2023 rule of KI-161 is needed by the Specified rows it maps).
  - Listed Indian companies named "International", "Global" or "Overseas" are listed equity shares, not Global Funds
    (KI-162, 286 names); Equity, Shares and Stocks count as direct-equity products; a share with a foreign marker takes
    the new row "Foreign-listed shares (held directly)".
  - Gold and silver ETF FoFs are 24-month Commodity Mutual Funds (KI-163, 35 per plan); international funds and FoFs are
    Global Funds and international ETFs a new 12-month slab row (KI-164); funds of funds get their own branch: equity
    ETF FoF (new row), debt FoF (Sec. 76), general rule (new row) (KI-165).
  - Hybrids take the reckoner's buckets in three new rows that replace the obsolete 35% rows (KI-170); SIFs are classed
    by strategy in two new rows (KI-172); ELSS has a 3-year lock-in row, and locked units leave the long- and
    short-term amounts and the harvest (KI-173); REIT FoFs and index funds are not REIT units (KI-174); "ETF", "Index
    Fund" and "FoF" products are mutual funds for the tax classes, through the AMC tab's one test (KI-178, KI-099);
    retirement and children's funds are unclassified with the reason instead of equity (KI-179).
  - The debt row cites Sec. 76 (old 50AA) of the Income-tax Act 2025 (KI-180, OD-28); a class with no TAX_RULES row is
    unclassified with a reason. Every unclassified holding shows why on the Taxation tab and in the AI Analyst tax
    signal; the slides count them.
  - TAX_RULES 25 → 32 rows (`data/refdata/` regenerated). 11 regression files (333 checks), each failing on the
    previous page. The synthetic sample book's taxation is unchanged apart from the debt row's name.
  - Recorded: D-040 (the lead's defaults for the rules the reckoner leaves open, each open to the owner), KI-160 to
    KI-182, CR-0008.

### Added (new build, M2.3 sprint 3a: the MF Monitor read by header name; no change to `/next/` or `/`)
- **`app/src/ingest/vendor/`:** the shared cell readers and the Daily MF Monitor reader (Regular and Direct issues) with the
  monthly pipeline's rules, so an upload and the refresh read a monitor the same way (OD-11): AUM from the label row,
  market-cap shares, debt figures to 4 places, the Direct issue's unnamed sheets mapped to their category, benchmark rows.
  On the October 2026 monitors (read locally, never committed) it reproduces the embedded MF_PERF, MF_PERF_DIRECT and
  BENCH_RET exactly. Not called by the app yet; the upload buttons wait for the spreadsheet-reader decision.
- **The monitor's expense ratio (KI-058):** read from the "Ratio" header column, one scale decision per file (median
  below 0.05 means fractions), always stored as a fraction, values above 5% dropped and counted. It is the all-in ratio and
  is labelled so: never used for a missing base expense ratio (CLAUDE.md rule 3). October 2026: 2,125 Regular and 1,803
  Direct ratios read, percent scale, none above the cap.
- **The SIF Monitor (E-07):** read as the pipeline does: the benchmark group, index rows, rows with no category and no AUM
  and the disclaimer are not schemes; a Month End date is not a fund house. October 2026: equal to the embedded SIF_PERF
  (30 schemes).
- **The base file's ISIN column** (the owner's answer of 25 Nov 2026: ISIN first, then the name): any heading containing
  "ISIN" is read; a cell is kept only in the ISIN form; a file without the column reads exactly as before. Read only: no
  figure changes; the import report lists the column among those read when a file has one.
- **The PMS performance file (E-08, KI-033):** read by header name as the monthly pipeline reads it (returns as stated,
  never multiplied by 100; AUM from rupees to whole crore; duplicates by the normalised key; a missing column refuses the
  file). The monthly merge into the previous block stays with M11.
- **The portfolio analytics files (E-10, E-11):** the Equity, Debt and Hybrid Analytics read by header name instead of
  column position (the file repeats "Holding(%)" for the previous month; the first is read), with the legacy rules and the
  pipeline's tidy step: cash in the total only, issuers collapsed to their entity, ratings by label then basket, the issuer
  list cut to the top 30. Equal to the legacy positional parsers on synthetic files and 18 issuer spellings.
- **Tests:** `tests/unit/ingest/vendor/mf-monitor.test.ts` on synthetic issues; `tests/parity/monitor.parity.test.ts`
  against the browser's legacy parser, every difference a ledgered pipeline correction.

### Added (new build, M2.1 sprint 1: identifiers and the matcher at parity; no change to `/next/` or `/`)
- **`app/src/engine/match/`:** the legacy name normalisation, instrument and PMS matchers, the fund-house key
  (KI-061, OD-32, OD-34) and the three name lists (pins, blocks, exact-only: CR-0010 A2, A2b) ported at parity, and a
  crosswalk that resolves identifiers first (ISIN, AMFI scheme code, vendor key) and then the legacy name unit unchanged,
  built at load time from `data/refdata`. Nothing in the app calls it yet: the built page is byte-identical.
- **Tests:** `tests/parity/matching.parity.test.ts` compares the port with the live matcher over every candidate set the
  legacy uses (0 differences on the same candidates; in the shipped order only score ties, ledgered as KI-036); unit
  tests in `tests/unit/match/`; the CR-0010 A2, KI-061, OD-32 and OD-34 known answers in `tests/regression/`.

### Added (new build, M3a: the returns core; not wired into the page yet, `/next/` and `/` unchanged)
- **`app/src/engine/returns/xirr.ts`** (E-26): the legacy XIRR solver ported exactly, on whole days (KI-047: flows on one
  day have no rate). Equal to the shipped solver on 500 seeded random flow sets.
- **`app/src/ingest/irr-file.ts`** (E-05, E-142): the IRR file's fund and benchmark sheets read by header name, with the
  DISTRIBUTOR column, row kinds (OD-16), skipped rows with their reason, and repeated folios warned (OD-4).
- **`app/src/engine/returns/irr-tree.ts`** (E-27, E-28): the legacy IRR tree, clients by id; the benchmark joined by
  client and normalised instrument name, and instruments grouped on the same key.
- **`app/src/engine/returns/contributions.ts`** (E-29): contributors, laggards and drags as the legacy contribLag, with
  one correction: no line is called a contributor when every line is negative.
- **`app/src/engine/returns/scope.ts` and `app/src/engine/scope.ts`** (E-142, I-45): returns per family, client and
  advisor scope. A scope takes whole instruments, so its fund and benchmark XIRRs cover the same money; an advisor
  scope holding an instrument split between distributors is not reconciled until a rule shares it (Gate B of
  1bbca77). Clients with flows and no holding, redeemed instruments and invalid benchmarks are listed (OD-4); the
  unassigned line shows its share of the money paid in (D15). The reconcile tolerance (D13) is still to be set.
- **Tests:** unit tests for each module, `tests/regression/ki-047-xirr-same-day.test.ts`, and
  `tests/parity/contributions.parity.test.ts` against the legacy contribLag. The IRR parity ledger waits for a real
  export (TA-03, KI-186).

### Added (new build, M7a: the capital-gains statement reader and the blank template; not wired into the page yet)
- **`app/src/ingest/capital-gains.ts`** (E-150, D-036, design `docs/new-build/capital-gains-upload.md` §2 to §4, §6, §7,
  §11): the wealth platform's capital-gains export read as produced. Columns are found by header name in any order, and
  extra columns are listed. The instrument tag gives scheme, folio and asset, and the Account Name is split. Lot rows are
  told from the totals row; excluded lots and the footer text are never kept. Each lot gets its row checks, and the
  statement's totals are reconciled.
- **PAN removed at read time** (E-151, reader half): PAN tags and PAN-shaped tokens are removed from every text cell and
  sheet name before anything is kept. Only the counts are recorded.
- **Repeated lot rows** (E-153, reader half): found and reported by sale event and year, with the analyst's answer per
  event ("as stated", "once", "apply to all"); a year without an answer is INSUFFICIENT EVIDENCE.
- **Blank and unreadable cells** (MOD-04's R1, design §11): a blank required cell is reported per column, never read as
  0. A plain number in Sale Date is not a date. Review clients that differ only in letter case stay apart (D-039).
- **`app/src/exports/xlsx/cg-template.ts`** (E-156, design §12): the blank template with the export's 29 headers in
  order, date, money and unit formats as column defaults, a frozen header and a Read Me (how to enter a merger and a
  loss). It loads back through the reader without loss. The workbook writer gains an optional column-default style;
  the M1.4 workbooks are byte-identical (pinned by a test).
- Lot classes, the tax rules and the tax engine (E-152, E-154, E-155) stay owner-gated (PD-16, LP-01).
- **Tests:** `tests/unit/ingest/capital-gains.test.ts`, `tests/exports/xlsx/cg-template.test.ts` and
  `tests/exports/xlsx/column-default-style.test.ts`, on synthetic statements only (`tests/fixtures/make-cg-statements.ts`).

### Fixed (CR-0010 A3; not published until the owner says "publish")
- **The SWOT's international share no longer counts names that merely contain "us ".** "Plus" (the Income Plus Arbitrage
  funds of funds and others), Taurus, Abakkus, Focus, Marcellus, Citrus and Equirus are no longer international; "U.S." now is.
  Over 4,741 fund names: 278 → 117 (163 domestic names out, 2 genuine in, none genuine out). Patch
  `tools/patches/2026-11-22-intl-word-boundary.js`; test `tools/regression/CR0010-a3-intl-word-boundary.js`.

### Fixed (CR-0010 A5; not published until the owner says "publish")
- **The SWOT's international share no longer counts Indian companies held directly because their names say
  "International", "Global", "Overseas" or "World", and counts two overseas funds of funds on evidence.** A share whose
  STOCK_RET entry has an Indian company ISIN (INE..., IN9...) is domestic: over 10,439 company names held as direct
  equity, 360 → 63 (297 Indian companies out, none in; the overseas ETFs with INF ISINs stay). Baroda BNP Paribas Aqua
  FoF and ICICI Pru Strategic Metal and Energy Equity FoF (Regular, Direct) count: the vendor's Other Funds file shows
  97.59% and 99.42% overseas fund units; over 4,741 fund names 139 → 143. `index.html` MD5 `49207832…` → `2883FE7464AAC583AF6BBE2A41476300`
  on the branch; with LP-16 on main, `B7CA316F…` → `5B6776E8AFE2EFE94CF4DE93FA7C4D5A`.
  Patch `tools/patches/2026-11-25-a5-isin-domestic.js`; test `tools/regression/CR0010-a5-isin-domestic.js`.
  [CR-0010](docs/change-requests/CR-0010-other-funds-october.md).

### Fixed (CR-0010 A4; not published until the owner says "publish")
- **The SWOT's international share counts the overseas funds it missed** ("Intl.", Asian, Asia Pacific, ASEAN, Brazil,
  Europe, Hang Seng, NYSE FANG+, Emerging Markets, Off-shore) **and no longer counts "First Global", "SMC Global" or the
  "MSCI India Domestic & World Healthcare 45" index fund.** Over 4,741 fund names: 117 → 139 (27 in, 5 out, no genuine name
  out). A direct-equity holding keeps the A3 test, except an ETF held as a share, which takes the fund test. Patch `tools/patches/2026-11-24-intl-terms.js`; test
  `tools/regression/CR0010-a4-intl-terms.js`. [CR-0010](docs/change-requests/CR-0010-other-funds-october.md).

### Fixed (CR-0010 A2b; not published until the owner says "publish")
- **The AMC's own "The 30s Plan" / "The 40s Plan" spellings of Aditya Birla SL Retirement Fund** get their own fund's
  look-through and never Retirement Fund-50's returns: an ALIASES pin to their own hybrid entry plus exact-only (patch
  `tools/patches/2026-11-23-retirement-plan-pins.js`). Measured over every universe; nothing else moves.

### Fixed (LP-16, KI-051 P0; not published until the owner says "publish")
- **Six non-mutual-fund product types are their own product class, never a mutual fund** (the owner's labels, D-7): "GIFT City
  funds", "Offshore funds", "US-dollar bonds (through LRS)", "Fixed deposits", "REITs and InvITs", "Unlisted shares", read from the
  Product column without regard to letter case, by the rules in the new REFDATA key `PRODUCT_CLASS_RULES` (contract I-40; registered
  in `scripts/data-extract.ts` and `tools/check-invariants.js`; `data/refdata/PRODUCT_CLASS_RULES.json` generated). Such a holding
  no longer takes a mutual fund's, PMS's or AIF's look-through or returns, is never read as a listed stock, and is listed as
  excluded with its class instead of as unmatched; a share held directly (an unlisted share) keeps its zero fund fee on the Cost tab, its Direct Equity performance bucket and its IPS "Direct Unlisted investment" line and the SWOT's narrow name test for the international share. Every bond, NCD
  and debenture (rupee 54EC, tax-free, RBI and corporate NCDs included) takes "US-dollar bonds (through LRS)": the owner, 25 Nov
  2026, "No, keep as recorded"; the Taxation tab keeps its own tax classes. A product that also says ETF, MF or
  fund stays a mutual fund (OD-6); sovereign gold bonds and MLDs keep their old class until labelled. Patch
  `tools/patches/2026-11-25-lp16-product-classes.js`; test `tools/regression/LP16-KI051-product-classes.js`.

### Fixed (CR-0010 A2; not published until the owner says "publish")
- **Three holdings no longer take another fund's data.** Motilal Oswal Nasdaq 100 ETF no longer gets the Nifty 100 ETF's
  look-through (Indian large caps) or the Nasdaq 100 FOF's Direct-plan returns; Aditya Birla SL Global Emerging Opp Fund no
  longer gets Special Opportunities' (or the Arbitrage or Gilt Fund's) look-through; Aditya Birla SL Retirement Fund-40 and
  -30 (and "The 40s Plan") no longer show Retirement Fund-50's returns. Their own returns, Direct rows and look-through stay.
  These names now match only their own exact name (`EXACT_ONLY` in the engine; patch
  `tools/patches/2026-11-22-scoped-match-blocks.js`); measured over every universe, only wrong matches change, to none.
  Test `tools/regression/CR0010-a2-scoped-blocks.js`. [CR-0010](docs/change-requests/CR-0010-other-funds-october.md).

### Data (October 2026: 40 children's and retirement funds, CR-0010 A1; not published until the owner says "publish")
- **The 40 HYBRID_ANALYTICS look-throughs carried at 30 Sep 2026 now hold 31 Oct 2026 data**, from the vendor's "Other Funds
  Analytics" file through the monthly hybrid route (`buildtools/build_other_funds.js`, new; `build_refresh.js` exports
  `hybridFromAoa`, which `buildHybrid` now calls, output unchanged). Only those 40 keys change and their `vintage` tag goes; no
  other block or date changes. Known-answer check: the file's Sep-26 columns reproduce the embedded 30 Sep entries (debt
  40/40, equity 39/40, one vendor rename). `data/refdata/` regenerated. `index.html` MD5 `5995FA490D8043E51DA9E3CC5F45F621` →
  `27EF056BC1BEF56C12D4714642260A81` (data only, no code change). Test `tools/regression/CR0010-a1-other-funds-hybrid.js`.
  Log: [docs/refresh-log/2026-10.md](docs/refresh-log/2026-10.md), section 10; [CR-0010](docs/change-requests/CR-0010-other-funds-october.md).

### Data (October 2026 risk ratios, TA-10; not published until the owner says "publish")
- **MF_RISK refreshed to 31 Oct 2026, computed in-house** (PD-61) from the vendor NSE TRI export and the AMFI October NAVs;
  the last trading day is Fri 30 Oct 2026 (log section 9). 1,088 funds; risk ratios 966 → 981; 3Y rolling 433 → 439; 151
  flags. `DATA_DATES.risk` "30 Sep 2026" → "31 Oct 2026"; `data/refdata/` regenerated. `index.html` MD5
  `A6AD7B104521D0ABE95ADA61B61E615E` → `5995FA490D8043E51DA9E3CC5F45F621` (data only, no code change). Log:
  [docs/refresh-log/2026-10.md](docs/refresh-log/2026-10.md), section 9.

### Data (Market Update slides, TA-10 Step 3; not published until the owner says "publish")
- **The Market Update slides are the November 2026 Reckoner's pages 5 to 10 (October data), labelled "Nov 2026" (6).**
  They were rendered from the owner's PDF; the two new pager pages follow later. No REFDATA change. `index.html` MD5
  `5995FA490D8043E51DA9E3CC5F45F621` → `5A9D56DA43CE21F1BAB9DD65218AE346` (738,136 bytes smaller). Log:
  [docs/refresh-log/2026-10.md](docs/refresh-log/2026-10.md), section 4b.

### Data (October 2026 refresh, TA-10; not published until the owner says "publish")
- **Performance and analytics refreshed to the October 2026 files, labelled "31 Oct 2026"** (the owner's words: "Use the 2 Nov
  files", "Show 31 Oct"). The true price days are in the log only: the Regular and SIF monitors are as on Mon 2 Nov 2026 and
  the Direct monitor as on Fri 30 Oct 2026. MF_PERF 2,130 → 2,144, MF_PERF_DIRECT 1,765 → 1,775, SIF_PERF 30, BENCH_RET 108,
  EQUITY_ANALYTICS 1,144 → 1,161, HYBRID_ANALYTICS 243 → 244 (40 carried at 30 Sep 2026 vintage), DEBT_ANALYTICS 486 → 490,
  STOCK_INFO 8,684 → 8,695; `data/refdata/` regenerated. Risk stays 30 Sep 2026; PMS, AIF, fund ranks, fund managers, expense
  ratios, stock returns and the Market Update slides are unchanged. `index.html` MD5 `12B5E5727FCA01EF2EA162C59913F01D` →
  `A6AD7B104521D0ABE95ADA61B61E615E` (data only, no code change). Log: [docs/refresh-log/2026-10.md](docs/refresh-log/2026-10.md).
- **Pipeline:** `buildtools/build_refresh.js` carries a still-listed scheme's last look-through also in an analytics-only build,
  never carries a renamed scheme (15 "Zerodha" keys became "Zerodha CASE"), and counts a Regular key the monitors list only as
  its Direct plan as listed (17 retirement funds; without it 9 holdings matched a sibling fund). Test
  `tools/regression/TA10-analytics-carry-forward.js` (26 checks).
- **Test:** `tools/regression/KI-067-cvs-hybrid-split.js` takes its known answers from the embedded hybrid sleeve weights, so it
  follows each refresh (the 30 Sep audit figures stay in its header).

### Changed
- **The new app's layout (CR-0006, D-037, the owner's request of 24 Oct 2026): the nine section tabs run across the
  top** in the look of the owner's design reference, and each section uses the full page width. The black masthead
  with the gold rule carries the MF Screener link at its right; the preview banner stays first and in view on a wide
  screen; on a narrow screen nothing is pinned and the tab row scrolls sideways (which also fixes M1.2's QA note of
  a header covering a focused heading at 375 px). The tab row never wraps (one row from 1280 px; narrower, it scrolls
  sideways, bringing the current tab into view), and the app keeps a focused heading, the skip link's target and a
  section address opened directly below the pinned header, without moving the page when focus enters the header.
  A tab reached with the keyboard is brought fully into its row, the focused current tab shows a gold ring, and the
  skip link no longer scrolls the page. The headless browser spike now runs at 1440 x 900 and checks the layout at
  1440, 1366, 1280, 1024 and 375 px (99 of 99 pass). The `/next/` build: 46,905 bytes, SHA-256 `0407eb12…`
  (deterministic). `index.html` is unchanged (MD5 `911A04659CB34383E478416B54E9C306`).

### Added
- **Milestone M1.4 of the new build (CR-0006): the portfolio overview.** Section 1 reads a base file through its
  Upload, Validate, Preview and Review stages, and section 2 shows the headline figures, the allocations and the pies;
  the overview deck (slide C-08) and the overview workbook download from it. Every number on screen, slide and sheet
  is a figure of one view-model (D-038, D-039). The `/next/` build, after round 3: 2,003,039 bytes, SHA-256
  `b5756412…` (deterministic, build id `2418a5b671cd7622`), with the four vendored libraries inlined.
  M1.4 leaves `index.html` unchanged (MD5 `12B5E5727FCA01EF2EA162C59913F01D`, main after PR #16); the libraries were vendored
  from `911A04659CB34383E478416B54E9C306`. CLAUDE.md keeps one Office rule text (rule 10); the new-build paragraph
  points to it.
  - Platform (D-038). Chart.js 4.4.0, chartjs-plugin-datalabels 2.2.0, SheetJS CE 0.18.5 and PptxGenJS 3.12.0 are
    vendored byte for byte from `index.html` (`scripts/vendor-extract.mjs`, `--check` in CI); licence texts are in
    `app/vendor/licences/`. The build accepts vendored files under the HTML parsing rule and the jszip alias, and
    writes `buildId` and each library's SHA-256 in build-info. `check-next` adds pinned per-library allowances, the
    OOXML namespace names, a licence-URL rule and the pure-layer globals rule (U-53). New
    `app/src/services/download.ts`: CSP-safe Blob downloads, the object URL revoked after 30 s. The built-in logos are
    extracted to `app/src/config/brand-logos.json`. The browser spike drives the keys through a CDP helper
    (`tests/browser/lib/cdp.mjs`): R8's gates (a real Shift+Tab walk, focus-ring contrast, controls scrolled clear of
    the pinned header, section 1's file and date inputs included) and the four-library page from disk and served,
    whose Blob downloads save the page's bytes with no request: 141 of 141.
  - Engine. The KI-147 money-column rule: there is no fallback for text that is not an amount (the owner's answer of
    24 Oct 2026); a blank or placeholder Crore cell takes the Lakh value with a notice, and Crore and Lakh amounts more
    than 0.005 Cr apart are warned. `computeReview` gives totals over included holdings (gain is CMV minus invested
    over the holdings with an invested value), the asset allocation in one order with Unknown last, liquidity by the
    legacy rule, client and distributor matrices with "not given" columns, reconciliation, the export gate, the audit
    log and the review fingerprint. Tests: the overview variants of the synthetic books, the hand-worked
    `OVERVIEW_ANSWERS`, and the aggregation parity ledger AG-01 to AG-14 with no regression.
  - Section 1, Uploads and inputs: the base file through its stages, with an import report (the sheet and header row
    used, the sheets tried, the money unit, the counts, the skipped rows by reason, the excluded holdings by name, the
    XIRR question with one-click answers, and "Instrument matching arrives in M2"); the as-on date (never a fallback,
    KI-087); the family and client labels; the logo (built in or uploaded, kept in this browser); "Disclaimer in use"
    (not available in supplied data until M11); a basic validation panel with Acknowledge on High results; and the
    source register.
  - Section 2, Portfolio overview: headline figures, the asset and product allocation table, the asset class and
    liquidity pies, the client and distributor allocation (hidden behind one line for a single client or
    distributor, OD-21), the notes, and the downloads, disabled with the gate's reasons until the review may be
    exported. One formatter (`views/format.ts`) and one overview view-model (`views/overview.ts`) serve the screen,
    the slide and the workbook; chart colours are fixed by category name (KI-150).
  - The look of the owner's design reference (D-037, R4): a review bar under the tabs (logo, family label, as-on
    date), bordered groups with a sand header band, dashed upload slots, stage pills, status chips, ledger KPI tiles,
    and black-header tables that scroll inside their own box on a phone; the tab row's scrollbar is slim and keeps a
    focused tab's ring clear. `tokens.json` gains the deck design system tokens and the status colours.
  - The overview deck: slide C-08 Asset Allocation with three KPIs (Invested Value, Current Market Value, Unrealised
    Gain/Loss, OD-18), the asset and product table over continuation pages with the header and the Grand Total on
    every page, and the asset class and liquidity pies with colours fixed by category name, labels to one decimal and
    no label under 2%. Cambria throughout; the preview marker in the footer band of a preview build; native, editable
    charts with their workbooks; the same view-model and clock give byte-identical files.
  - The overview workbook, written by an in-house deterministic STORE zip and SpreadsheetML writer
    (`app/src/exports/xlsx`, D-038 amends A3) with a typed formula builder: Read Me and Controls, Source Register,
    Holdings (as loaded), Portfolio Overview, Client and Distributor Allocation (only for two or more, OD-21), Audit
    Log and a hidden `_manifest`. Every aggregate is a SUMIFS over the holdings by generated keys, cached at the
    view-model figure; a missing figure is a blank cell with its status. An independent formula evaluator checks every
    formula in the tests. Spike gate R1 passed in Excel on 27 Oct 2026, so the ExcelJS fallback (Q-13) is not needed;
    the Office acceptance scripts are `npm run accept:office` (local only).
  - Integration: `app/src/ui/wiring.ts` joins the reader, the engine and both exporters to the page;
    `tests/helpers/node-wiring.ts` builds the same wiring in Node; `tests/integration/overview.test.ts`,
    `cross-output.test.ts` (one figure, one text on screen, slide and sheet) and `labels.test.ts` (labels in every
    output, never in the audit; the family switch leaves nothing behind).
  - Fixed in the new app (the legacy page is unchanged, D-028): KI-007, KI-020, KI-021, KI-071, KI-078, KI-084,
    KI-087, KI-089, KI-091, KI-092, KI-093, KI-094, KI-147 and, in the second fix round, KI-148. Filed for the legacy
    page: KI-150 (PptxGenJS random pie colours). KI-151 is the new app's guard against labels such as "constructor"
    (groups in Maps, pinned by a 7 by 5 grid); the live page's defect is KI-183 (Workstream A).
  - **Fix round, 27 Oct 2026** (CR-0006; the lead's decisions after the browser QA and the financial, Office and
    security reviews; D-039 points 1 to 15, D-037 point 1 amended, D-038's counts):
    - Numbers and Excel. Display rounding agrees with Excel (half up on the 15-significant-digit decimal; 0.145 shows
      0.15, family-a's Hybrid absolute return 35.68%). The KI-147 notes count the holdings whose figure changes, name
      the file's column and never come from the file's gain or loss, which only reaches the import report and the
      Audit Log. Labels with an en or em dash no longer break the workbook (the raw label is the join key). Client
      and distributor letter case is kept, as in the legacy, with a Warning for labels that differ only in case.
      Workbook money is in Indian grouping. The pie label threshold applies to the displayed share. The share row of
      the client and distributor sheets sits outside the filter and the red. The source register records the Review
      stage. The Exclusion Reason follows the market value's status. The partial invested note counts holdings when
      the share is meaningless. The Office scripts' quit and stop rules of this round were replaced in the
      second fix round by the owner's rule of 2 Nov 2026 (below);
      the Office acceptance adds syn-negative-gain (red at I2), the date
      format at R2, a Lakh book above 1,00,000 L and Excel's `Range.Text` of every figure compared with the screen.
      `npm run accept:office --full` passed on the FC branch: 6 workbooks and 6 decks.
    - Sections 1 and 2. The review bar stays in view when a section opens from its tab. Pie labels no longer collide
      with the legend or get cut off at the canvas edge, and the percent alone shows on a narrow canvas. A one-slice
      pie shows no label or radius line. The source register and the stage strip agree (Preview before Accept).
      Keyboard focus is kept after every action. A file with no holding is refused, and refusals read as plain
      sentences; an internal error reads "could not be reviewed", never "unreadable". A missing date is the dash
      alone with a footnote. The import report shows the full SHA-256.
    - Slide C-08. The pie labels sit on two lines, the category then the percent, in a text body that never wraps,
      so PowerPoint no longer breaks a label inside a word ("Commodi / ty 3.9%"). A pie of one slice has no label and
      no outline. The footnote states the excluded holdings once, in the view-model's words. A chart not drawn names
      its status in words ("Chart not drawn: not applicable.").
    - Tests: the M1.4 cross-unit tests. `tests/integration/upload.test.ts` (U-04): the upload limits at and one past
      20 MB, 40 sheets and 400,000 cells on a sheet; unreadable files; a refused file builds no review; re-picking the
      same file (KI-089). `tests/integration/as-on-change.test.ts` (U-05): a changed date recomputes the review id,
      the as-on note and the Read Me and keeps labels and figures; a cleared date is Blocking with no fallback
      (KI-087). `tests/workflows/w-01-load-family.test.ts` (W-1). `tests/acceptance/ac-01-standard-review.test.ts`
      (AC-01): family-a and its Lakh and rupee variants against sums of the file's own money column; deck and
      workbook equal to the screen; one display unit; house style D-029. New browser check
      `tests/browser/overview.cdp.mjs` (112 of 112, served and from disk); the spike now 149 of 149. The suite: 837
      tests under IST and under UTC. The parity matrix has 49 rows in progress (AC-01 and W-1 added).
  - **Second fix round, integrated 2 Nov 2026** (CR-0006; the lead's decisions N1 to N19 of 27 Oct 2026 and the
    owner's Office rule of 2 Nov 2026; D-039 points 16 to 20, D-037 point 1 reworded):
    - Reader and parity. The base-file reader skips rows named Total or Grand Total and dates merged folios by their
      earliest purchase date, as the live page does (D-041 points 2 and 3; KI-148 fixed in the new app). A negative
      market value is warned, and the overview notes the pie slices and liquidity lines left out at a market value
      of 0 or less. A joint-holder label in another letter case is reported, not linked. The parity re-run against
      the live page after fix batch 4 retires AG-01, AG-02, AG-05, AG-06 and AG-08 and rewords AG-04, AG-09, AG-13
      and AG-14 (KI-147 now differs from the live page by design). A 7 by 5 grid of label fields and
      Object.prototype names pins the KI-151 guard. Tests no longer pin the live page's MD5 (N4).
    - Workbook. The "Share of family (%)" row sits one blank row below the Grand Total, so Excel no longer takes it
      into the Client and Distributor Allocation filter (N7). Money and units read in Indian grouping at the
      rounding edge ("1,00,000.00", never "100,000.00" or "100,00,000.00"), and percents of 1,000 or more read as on
      screen ("1,900.00%") (N8, N9).
    - Sections 1 and 2, and slide C-08. Client and distributor column headers show the labels as the file spells
      them; the group notes count named clients and put the rest in words ("2 clients, and 2 holdings with no
      client"); an empty liquidity table is a sentence; the review bar never names a refused file ("Base file
      refused") (N12). From 5 categories the C-08 pie leaves 26 pt above its two-row legend, so a label at 6
      o'clock no longer sits on the legend (N13). The deck post-processing replaces with functions, so labels
      holding $ patterns are written as they read (N14). The browser checks retry the DevToolsActivePort read on
      EBUSY, EPERM and ENOENT, and pin the review-bar gap at 8 to 20 px.
    - Office acceptance under the owner's rule (K1). The scripts attach only to an Excel or PowerPoint already
      running, open only their own synthetic file read-only without a window, change no application option, close
      only that file and never quit, stop or kill Office; with no instance running the result is NOT RUN with the
      paths of the files for the owner to open, never a pass, and the damaged-file negative controls are never run
      against the owner's Office. Excel hides its own workbook window at once after the open, so frozen panes are
      checked in the file only. After the first TIMEOUT of an application no later case of it is started (NOT RUN,
      "not attempted: Office did not answer"), and the Excel edit check runs only in manual calculation (in automatic
      calculation, Excel's default, it is reported "not checked in Excel", never as a pass). The run builds 8
      workbooks and 10 decks (the six-class decks syn-pie6-reits and syn-pie6-hybrid, and the cases syn-six-classes
      and syn-big-return). On 2 Nov 2026 the run was NOT RUN for all 18 cases (Office was not running, and the
      session's execution policy refuses scripts; the runner never overrides it).
    - Tests: 1,012 of 1,012 under IST and under UTC with node_modules, 948 of 948 without (the four "(needs npm
      ci)" suites skipped); the spike 149 of 149 and overview.cdp 124 of 124.
  - **Round 3, 2 Nov 2026** (CR-0006; QA passed and the financial-domain reviewer approved `5a4d4c0`, naming D-039
    point 13; the owner accepted the half-way rounding for the new app, PD-48):
    - The Office runner (the security gate's F-1). On Windows, Node keeps the processes it spawns in a job object
      that ends them when Node exits, so a script abandoned at a TIMEOUT was ended with the run and could leave its
      synthetic workbook open, hidden, in the owner's Excel. `run-acceptance.ts` now spawns, not detached, only a
      PowerShell wrapper passed as `-EncodedCommand`, which starts the script with `Start-Process` (hidden, its
      output and errors redirected to two logs), waits for it and passes its exit code through. The script is
      outside Node's job, so it runs on to its own deadline and closes its file; nothing kills anything. No
      execution policy argument: a refusal is NOT RUN with its reason, read from both logs. Proven with a sleep
      child outside the suite and outside Office (abandoned after 2 s, it outlived Node and wrote its marker file).
    - Section 1 (QA's D1). A file the browser cannot read (gone from the disk) is refused ("Refused: the file
      could not be read as an Excel workbook.", the review bar "Base file refused") and clears the previous
      review, as a new pick does; it used to leave the old review on screen with an unhandled error. The logo
      picker says "The logo file could not be read: choose it again."
    - Records: KI-190 (badly grouped text reads as an amount), KI-191 ("Grand-Total" read as a holding with no
      result) and KI-192 (pies drawn with a negative total market value) are filed for a follow-up; D-039 point
      13 records the owner's acceptance (PD-48).
    - Tests: 1,017 of 1,017 under IST and under UTC with node_modules, 953 of 953 without (the four "(needs npm
      ci)" suites skipped); the spike 149 of 149 and overview.cdp 128 of 128.
  - **Rule 10 as amended, 9 Nov 2026:** the Office scripts read no name or path of a document they did not open, so
    the Excel script no longer remembers or re-activates the owner's workbook and window and no longer scans Excel's
    repair logs in the temporary folder, and a static guard in `tests/exports/xlsx/office-scripts.test.ts` pins it
    (`docs/TESTING.md` section 6.1, point 9).
- **The capital-gains upload design for M7 (CR-0006, D-036, amending D-032).** Documents only; no code, `/next/` and
  `index.html` unchanged. The upload accepts the wealth platform's "Capital Gain Report" export as produced (columns
  by header name, PAN removed at read time, folio parsed from the instrument name, totals row reconciled, footer text
  never kept, exactly repeated rows put to the analyst), with a blank template of the same headers for other sources;
  lots are classed (non-taxable or taxable consolidation, grandfathered, indexed cost shown, standard, other) and indicative tax is computed per person and
  financial year from the dated tax-rule table v1 (§10, approved by the financial-domain reviewer on 27 Oct 2026), with the slab rate, surcharge rate and regime the analyst enters per person and year.
  Revised on 27 Oct 2026 after a financial, a completeness and a security review (the design's §10.11: decision ids
  TR-n, the rule key with the listed flag and sub-type, the category map, the merger date gates, one repeats answer
  per sale event, the footer and totals rules, set-off and exemption order, the validation ids, the known answers and
  the tests), and again the same day after the financial and completeness re-reviews (long-term losses set off before
  short-term losses, successor lots after a taxable merger, the Sectoral and Thematic default flagged, funds of funds
  never equity-oriented on the statement's Equity label, the valid rule keys, known answers KA-18 and KA-19, and the
  lead's two defaults put to the owner), a third time after their approval reviews (the old-law NE-LT-1 choice
  made per lot before set-off, with known answer KA-20; a person-year with lots not computed shown as PARTIAL
  COVERAGE, known answer KA-21; the analyst's class on a fund of funds; the successor re-base formula; each fixture's
  analyst inputs recorded), and a fourth time after the second approval reviews (no claim that the per-lot NE-LT-1
  choice is the lower, with the year's-total figure shown beside it, known answer KA-22; the 90/90 class per year).
  Approved by the financial-domain reviewer on 27 Oct 2026. Design: `docs/new-build/capital-gains-upload.md`, with its synthetic fixture generator;
  `docs/DATA_DICTIONARY.md` v0.4 (§3, §5.5, §5.17, §6, §7, §8), PRD 0.5 (R-IN-6, R-TX-3), parity rows E-141, E-150 to
  E-156, U-71, U-72 and BR-3.1 (385 rows), the test plan's capital-gains fixtures, cases and test rows (§4, §5.6,
  AC-20), the roadmap's M7 scope and acceptance, D-036.
- **Milestone M1.3 of the new build (CR-0006): the shared model, the base-file reader, the reference data and the
  parity ledger.** No page uses them yet: the `/next/` shell builds to the same bytes (42,280 bytes, SHA-256
  `e74e8a07…`). `index.html` is unchanged (MD5 `911A04659CB34383E478416B54E9C306`).
  - The shared model (`app/src/model/`, erasable TypeScript, types and constants only): the missing-data statuses and
    `Value<T>`, identifiers, source files and import records, holdings, clients, accounts, folios and ownership,
    validation results and analyst questions, audit entries (`docs/DATA_DICTIONARY.md` v0.3).
  - The workbook reader (`app/src/ingest/workbook.ts`: raw Excel serials, number formats kept, formulas with their
    cached values) and the base-file reader (`app/src/ingest/base-file.ts`): the header searched over 20 rows and
    every sheet, with a report of the rows skipped (KI-074); money in Crore from the Crore, Lakh or rupee column;
    XIRR as percent numbers, the analyst asked when a column could hold fractions (OD-3); a holding without a market
    value excluded and listed (OD-8); a blank Asset Name unknown, never Equity (OD-7), and REITs/InvITs the fifth
    class; text that is not a number or a date marked INVALID SOURCE DATA; duplicate folios merged with no partial
    totals (KI-007, KI-113), each gap named in `Holding.mergeGaps`. Helpers in `app/src/engine/`: dates without time
    zones, units, asset classes, identifiers, ownership.
  - `data/refdata/`: the 20 reference blocks of `index.html` as JSON with `VINTAGE.json`, written by
    `scripts/data-extract.ts` and checked equal to the page (D-035); `FUND_RANKS` reduced to AMFI scheme codes
    (D-026); `MF_BENCHMARKS` recorded as class C until its source is confirmed. The generated block files are exempt
    from the private deny-list as `index.html` is, each by its exact path, pinned by a test.
  - Tests run from source by Node's type stripping, under IST and UTC: unit tests against answers worked out by
    hand, a time-zone test, and the parity suite: the new reader against the legacy `parseBaseRows` on 18 synthetic
    books (generated by `tests/fixtures/make-books.ts`, never committed), every difference classified in
    `tests/parity/base-file-ledger.json` (BF-01 to BF-26), and the reference data deep-equal to the embedded blocks.
    `scripts/validation/traceability.mjs` checks that every test names the parity-matrix rows it covers.
  - The financial review and its re-review: the asset class compared exactly with the legacy label, which exposed
    "EQUITY" beside "Equity" (BF-26); the owner's open questions in `DATA_DICTIONARY.md` §8.
  - CI job `next`: the tests run `"tests/**/*.test.mjs"` and `"tests/**/*.test.ts"` in IST and UTC, then the
    traceability report and `node scripts/data-extract.ts --check`, before the release check.
  - Integration with M1.2 (`feat/m1-3-int`): the type check covers `app/src/model`, `ingest`, `engine` and `views`
    (one type-only fix); `package.json` sets `"type": "module"`, and `tools/package.json` and
    `buildtools/package.json` keep the legacy tooling CommonJS; `engines` asks for Node 24.2 or later; M1.2's tests
    carry their `// covers:` headers.
- **Milestone M1.2 of the new build (CR-0006): the toolchain, the one-file build and the nine-section shell, previewed
  at `/next/`.** The first application code. `index.html` is unchanged (MD5 `911A04659CB34383E478416B54E9C306`).
  - Pinned npm tooling (D-025, D-034): esbuild 0.28.2, TypeScript 7.0.2 (type check only, erasable syntax) and
    Preact 10.29.8, all `devDependencies` at exact versions with a committed `package-lock.json`; `.npmrc` disables
    install scripts and the audit and fund calls; `npm ci` only.
  - `scripts/build.mjs`: one offline file, `app/dist/index.html` (git-ignored), with a CSP meta tag first in `<head>`
    that allows the inline script and style by SHA-256 and sets `connect-src 'none'`; deterministic; the navigation and
    the single MF Screener link (D-027) written as static HTML; vendored libraries (none yet) inlined only when
    imported as `vendor:<name>` and checked against `app/vendor/MANIFEST.json`. Built on 23 Oct 2026: 42,280 bytes,
    SHA-256 `e74e8a07ca1008152a2429439c9677ff3d00b96ed39e75d9723ca7b60b63a3bb`.
  - `scripts/validation/check-next.mjs`: the built page's invariants (CSP, no network API, no remote URL but the
    Screener link in its exact form, the "Preview, not for client use" banner, no en or em dash in static text, clean
    bytes, size budget), a scan of `app/src` for DOM sinks and network APIs, and with `--rebuild` a byte-identical
    rebuild. `scripts/serve.mjs` serves the legacy page at `/` and the new app at `/next/` on 127.0.0.1:8100.
  - The shell (`app/src`): the nine sections of the PRD as empty states saying what arrives in which milestone, the MF
    Screener data pack slot in section 1 (M10), hash navigation, the house palette and Cambria.
  - Tests in `tests/next/` (build determinism, the vendored-library mechanism, every check-next rule against a planted
    violation, the shell, the Pages workflow) and the browser spike `tests/browser/next-spike.mjs` (headless Edge and
    Chrome, from disk and served: the CSP runs the page and blocks a wrong hash and a `fetch`, one request only,
    keyboard and mouse navigation, IndexedDB kept across a reload and a restart): 49 of 49 in Edge 155 and Chrome 155.
  - QA defect D1, fixed before the merge: Enter or a click on the link of the section already on screen, or after the
    skip link, left keyboard focus on the page; every activation of a section link now moves focus to the section's
    heading, and each link's accessible name reads "1 Uploads and inputs" (it read "1Uploads and inputs").
  - CI job `next`: after the privacy scan, the docs links and the monthly PRD check, `npm ci`, the type check, the
    build and `check-next.mjs --rebuild`, then the tests in IST and UTC and, last, the release check.
  - Pages (`pages.yml`): `/next/` publishes the new app beside the legacy page (D-024). The legacy gates stay
    blocking, but a failure to install, build or check the new app never blocks the legacy page: `/next/` then shows
    a short static notice and the log a warning (D-034, replacing M1.2's "fix forward" note).
  - `docs/new-build/toolchain.md`, the M1.2 record: packages, commands, the build, the invariants, the spike results
    and the browser QA steps.
- **The rest of milestone M1.1 of the new build (CR-0006): the release checks, the folder skeleton and the living
  architecture.** `index.html` is unchanged (MD5 `911A04659CB34383E478416B54E9C306`).
  - `scripts/validation/release-check.mjs` (BR-1.1), read-only: the state a release of the legacy page or of `/next/`
    must be in before its merge. It checks the recorded remote (no token in its URLs), the default branch, a named
    branch other than `main`, a clean working tree, the commits ahead of and behind `origin/main` (conventional
    prefixes), no local or generated file in the change, `index.html` changed only with a patch script in
    `tools/patches/` or on a `data/` refresh branch (`--expect-md5` pins it), `CHANGELOG.md` and `PROJECT_STATE.md`
    changed with the release, and the commit identity setting; `--after-push` checks the remote's copy of the branch
    (`git ls-remote`) and `--ci` reads the branch names from GitHub. It prints the change by area and
    `git diff --stat`, the report attached to the pull request.
  - `scripts/validation/monthly-prd-check.mjs` (Q-76; AC-23 from M14): each
    `docs/monthly-prds/YYYY-MM-Portfolio-Review-PRD.md` has its month in the file name and title, the nine sections A
    to I of `TEMPLATE.md` in order and none empty, no template placeholder left, working links and no privacy or
    deny-list hit, and `docs/HANDOVER.md` was refreshed in the same cycle.
  - Tests in `tests/validation/` (throwaway git projects with a bare remote; a synthetic monthly PRD fixture). The CI
    job `next` gains two steps: the monthly PRD check and, last, the release check in its CI form, after fetching
    `main` (the checkout is shallow). The `checks` job is unchanged.
  - The folder skeleton, READMEs only: `app/` (code from M1.2), `data/` (M1.3), `product_bank/` (M11) and
    `monthly_updates/` (the `YYYY-MM` layout and the drop rules), with
    `monthly_updates/_policy/publication-classes.json`: the publication classes of D-023 and D-026 by role (every
    Accord file and Centricity material class P; client data and the MF Screener data pack class N, never
    committed), pinned by a test to the decisions and to the pre-push scan's month-folder pattern and size limit.
  - `docs/ARCHITECTURE.md` is now the new application's living architecture, condensed from
    `docs/new-build/03-architecture.md` (kept as the dated Phase 0 record) with the same section numbers; field and
    calculation definitions stay in `DATA_DICTIONARY.md`.
  - KNOWN_ISSUES: KI-129 to KI-139, the Phase 0 audit's N-1 to N-10 and the Holdings download-bar finding U-23, each
    re-checked on `main` at `2a65a62` before it was filed. KI-135 is the same defect as KI-126 and is tracked there;
    KI-138 (former fund-house names not aliased) was already fixed by fix batch 2a (OD-32) and is filed as fixed.
- **The owner's answers to the new-build decisions (22 Oct 2026), milestone M1.1.** Documentation and one test;
  `index.html` is unchanged.
  - DECISIONS D-024 to D-033: the `/next/` preview and no client use of its exports (D-024); npm for build tooling
    (D-025); data classes, with every Accord file publishable (the owner confirmed that the licence covers all Accord
    files), MF Screener scores and ranks never in a public page and the pack uploaded by the owner into a section 1
    slot and kept in the browser until a newer pack (D-026); the MF Screener link (D-027); the live
    page's fix policy (D-028); missing values keep the dash, sentences never use one (D-029); thresholds approved with
    a fund pair overlapping from 35% (D-030); borders and the Actionables tan (D-031); capital-gains statements in our
    own template (D-032); full charge of GitHub and the dashboard, no branch ruleset (D-033). D-023 gains an addendum:
    the five Index TRI files are its index data.
  - `docs/MONTHLY_UPDATE_GUIDE.md`: "Files the owner supplies each month", the single tracked list (who sends each
    file, when, where it goes, public or private, what it feeds), with the new build's additions; MONTHLY_REFRESH and
    the docs index point to it.
  - A privacy-scan test pinning the deny-list exemption to `index.html` alone, with the generic rules still applied
    to it.
- **Phase 0 of the new build (CR-0006), recorded in milestone M1.1.** Documentation only; `index.html` is unchanged.
  - `docs/new-build/`: the Phase 0 deliverables of 21 Oct 2026, revised on 22 Oct 2026 (legacy system audit,
    capability inventory, architecture, reuse and migration plan, feature-parity matrix, data-source inventory,
    implementation roadmap, regression test plan, repository and docs structure, observation rule bank, deck design
    system, open questions, and the ten decisions still open with the owner, ND-1 to ND-10), beside the owner's
    brief; a `README.md` that indexes them and says which living document owns each fact.
  - `docs/new-build/inputs/`: the eight investigator files in their public-safe form.
  - Living documents: `docs/PRD.md` (the PRD, draft 0.3 for the owner's review), `docs/DATA_DICTIONARY.md` (v0: the
    new data model's entities, fields, metric paths, statuses, units and calculation definitions),
    `docs/MONTHLY_UPDATE_GUIDE.md` (the planned monthly flow; today's process stays `docs/MONTHLY_REFRESH.md`), and
    `docs/monthly-prds/` (the README and the sections A to I template for the monthly PRD, from the 2026-10 cycle).
  - Every new file passed the privacy scan with the private deny-list and the docs link check.
- **Safety tooling for the new build (CR-0006, milestone M1.1)**, Node 24 built-ins only, described in
  `docs/new-build/safety-tooling.md`. `index.html` is unchanged.
  - `scripts/validation/privacy-scan.mjs`: scans files, or only the lines a change adds (`--staged`,
    `--diff <base>`), for e-mail addresses, PAN patterns, tokens, private keys, passwords, local user paths,
    OneDrive organisation paths and personal GitHub account URLs, with folio-like digit runs as warnings; a
    public allow-list (`privacy-allowlist.json`) and an optional private deny-list of names named by
    `PRD_PRIVACY_DENYLIST`, kept outside the repository.
  - `scripts/validation/docs-links.mjs`: every relative link and anchor in the root and `docs/` Markdown resolves.
  - `scripts/validation/prepush-scan.mjs` and the hook `scripts/hooks/pre-push` (enable with
    `git config core.hooksPath scripts/hooks`): privacy on every added line, commit message and identity of
    the commits to be pushed, no file over 50 MB, no new binary or data file outside `monthly_updates/YYYY-MM/`.
  - Tests in `tests/validation/` (`node --test "tests/**/*.test.mjs"`), and a CI job `next` that runs the privacy
    scan of the documentation, the link check and the tests in IST and UTC. The `checks` job is unchanged.
- **The full audit of 19 Oct 2026** (CR-0005), under `docs/audits/`:
  - the issue register, with 67 issues, their evidence and fix approach;
  - the owner-decision sheet, with 25 questions and a recommendation for each.
- KNOWN_ISSUES: KI-047 to KI-098, the 52 new issues from the audit. Status updates for KI-006, KI-007 and KI-044
  (no longer reproduces), and for KI-045 (contradicted in part).
- Change requests CR-0004 (the second export request) and CR-0005 (audit, fixes and redesign).

### Changed
- **New build records for M1.3:** DECISIONS D-035 (the reference data in the repository: extracted from
  `index.html` and checked equal, fund ranks reduced to scheme codes, the deny-list exemption of the generated
  files, the classes of `MF_RISK`, `PMS_PERF`, `AIF_PERF` and `MF_BENCHMARKS`; the base-file ledger's corrections
  BF-01 to BF-25 except BF-19 accepted, BF-18 as KI-113 extended to units, BF-19 and BF-26 waiting for the owner);
  KNOWN_ISSUES KI-140 to KI-147 (the legacy page's base-file reading defects that the parity work exposed and their
  IPS consequence, live-page data fixes for a later legacy batch under D-028; KI-147 the new reader's money-column
  fallback, for M1.4); CLAUDE.md (M1.3, the generated reference data, the parity ledgers and `// covers:` lines, the
  repository layout); the living architecture (status, §5 layout, §18 commands and CI, §21); HANDOVER (refreshed
  for M1.3), PROJECT_STATE, CR-0006, the PRD's §13 status, DATA_DICTIONARY §8, the safety-tooling note (the
  exemption confirmed; the CI job's M1.3 steps), `app/README.md`, `data/README.md`, `data/refdata/README.md`, the
  root README, MONTHLY_REFRESH (Step 8 regenerates `data/refdata/` after a splice), the test plan's ledger file
  names and the roadmap (the M1.4 items carried from M1.3).
- **New build records for M1.2:** DECISIONS D-034 (the toolchain, the one-file build, static navigation, and the
  preview never blocking the legacy page); CLAUDE.md (Pages publishes `index.html` and `/next/`, the repository
  layout, and the new app's working rules: `npm ci`, the type check, the build, `check-next.mjs`, no network API, no
  `innerHTML` or `eval` in `app/src`, the single Screener link, vendored libraries only through `vendor:<name>` with a
  SHA-256 in `app/vendor/MANIFEST.json`, `serve.mjs`); the living architecture (what M1.2 built, §5, §17, §18,
  §22); DEPLOYMENT (the fallback notice); the root README (the two applications during the parallel run and how to
  run both, the last M1.1 item); HANDOVER (refreshed for M1.2), PROJECT_STATE, CR-0006, the PRD's §13 status,
  `app/README.md`, TESTING and the safety-tooling notes; the `security-release-reviewer` agent's Pages check.
- **The legacy architecture moved to `docs/legacy/ARCHITECTURE.md` (M1.1)**, a pure rename in a commit of its own so
  that `git log --follow` keeps its history. Every link follows it: `docs/README.md`, the PRD, DATA_DICTIONARY,
  MONTHLY_UPDATE_GUIDE, REPLICATION_REPORT, `docs/new-build/README.md`, CLAUDE.md (conventions and repository
  layout), HANDOVER (reading order) and three project agents (`dashboard-archaeologist`, `financial-domain-reviewer`
  and `implementation-engineer`; the pointer only).
- **`CHANGELOG.md` stays at the repository root**, rather than moving to `docs/CHANGELOG.md` as
  `docs/new-build/09-repository-and-docs-structure.md` §6 planned (the lead's decision, 22 Oct 2026).
- **New build records at the end of M1.1:** CLAUDE.md (the new architecture in the "New build" list, the release
  check before a merge, the monthly PRD check, the Screener pack kept in the browser until a newer one (D-026), the
  new folders in the repository layout), HANDOVER (refreshed 23 Oct 2026: status, reading order, git state),
  PROJECT_STATE (M1.1 complete once this branch merges, M1.2 and M1.3 next), CR-0006 (Changes, and what is left of
  M1.1), the PRD's §13 status, the root README's folder table, `docs/README.md`, TESTING (the two checks and their
  tests), the safety-tooling notes and the monthly PRD README.
- **New build documents updated for the owner's answers (22 Oct 2026):** the architecture (the Screener pack slot and
  browser store, §6.9; the capital-gains template, §6.10; the dash rule; §21 now a record), the rule bank (35% pair
  threshold, approved table, lint), the deck design system (dash marker, heat bands at 35% and 50%, D-031 tokens), the
  roadmap (M1.2 can start; M7, M10, M11 and the "what waits" table), the test plan (new section 5.6, AC-16, AC-18,
  AC-22, CI gates), the parity matrix, the data-source inventory, the reuse plan, the open questions (eleven questions
  answered; a third change log) and the owner decisions (answers added). PRD 0.4, DATA_DICTIONARY v0.1 (stored
  Screener pack §5.16, capital-gains template §5.17), CR-0006 (Phase 0 done, M1.1 ready for its PR), PROJECT_STATE,
  HANDOVER, DEPLOYMENT (no ruleset; `/next/` from M1.2) and the safety-tooling notes. "n.a." is no longer proposed
  anywhere. The new app takes only scheme codes from the Fund Ranks workbook; the legacy `FUND_RANKS` block (fund
  ranks issued 15 Aug 2026) is an open item in PROJECT_STATE.
- **New build records (M1.1):** HANDOVER (a "last refreshed" date, the new-build reading order, the monthly PRD duty,
  a git-state section), PROJECT_STATE (Phase 0 delivered, M1.1 in progress, new blockers and next steps), CR-0006
  (Phase 0 done; changes so far), `docs/README.md` (the new documents) and CLAUDE.md (a short "New build" section
  pointing to them).
- **Privacy fixes found by the new scan:** the previous owner's personal GitHub account address (DECISIONS D-002,
  DEPLOYMENT, REPLICATION_REPORT), their local user name in two paths (previous-owner handover) and the
  organisation's OneDrive folder name (previous-owner knowledge dump) are replaced by descriptions or placeholders.
  Earlier commits still hold them; history is not rewritten.
- **CR-0006, the new build:** the owner's brief of 21 Oct 2026 (sanitised copy in `docs/new-build/00-owner-brief.md`).
- **D-023 (22 Oct 2026):** the vendor licence allows publishing every Accord file (the monitor files first; the owner
  confirmed later the same day that the licence covers all Accord files), which closes the open question under
  D-008. Drawdown comparisons use index data. Portfolio 3Y and 5Y returns are the weighted average of the holdings'
  returns, with missing returns left out and footnoted. Direct-equity returns follow the owner's stock price
  calculator. CLAUDE.md, MONTHLY_REFRESH, DEPLOYMENT and `.gitignore` comments updated; the licence blocker removed
  from PROJECT_STATE.
- **Owner decisions OD-29 to OD-36 accepted (D-022, 21 Oct 2026).** OD-32 (renamed fund houses as aliases) and
  OD-34 ("AMC not given" for a blank AMC) are to be built; OD-35 comes with OD-19.
- KNOWN_ISSUES: KI-124, the Home tab's "Download slide" gives an empty deck (found in an export on 21 Oct 2026).
- **Owner decisions recorded (D-021):** all 28 audit recommendations accepted except OD-11. The MF and Direct
  Monitor uploads stay, and are to be fixed to match the monthly refresh.
- CR-0003 marked done; PROJECT_STATE rewritten around the audit's fix order.

### Fixed (fix batch 1a: engine numbers, the first part of the audit's batch 1, CR-0005)
`index.html` MD5 `F0EB0101…` → `FB6676DCEEDEA162318CDA02FEB86AA9` (16,771,979 bytes), by the patch
`tools/patches/2026-10-19-engine-numbers-1.js`.
- **KI-047, XIRR solver:** flows that all fall on one day now give no XIRR instead of a wrong one. The Newton step
  reports a rate only when it has converged and the NPV is near zero; otherwise the bisection result or nothing.
- **KI-055, hybrid look-through stocks:** a hybrid fund's top stocks were scaled by its equity weight twice, which
  understated them in Stock Exposure and Overlap. Each is now its share of the fund.
- **KI-006, partial XIRR coverage:** a subtotal's XIRR and BMXIRR now average only holdings that have a value,
  instead of counting the others as 0%. Partial figures carry a †, and a footnote gives the coverage (on screen, on
  the Holdings slide and in the client's Excel sheet). Question OD-26 asks whether fund and benchmark should cover
  the same holdings.
- **KI-065, taxation of debt mutual funds:** debt fund categories (gilt, liquid, money market, duration, credit
  risk, Banking & PSU, floater, target maturity, FMP) and G-Sec/SDL/gilt-named funds are taxed under Sec. 50AA
  instead of as listed bonds or equity. Equity : G-Sec blends ("… 75:25") stay unclassified (OD-27, KI-037).
- Smoke test: 26 → 35 checks, with known answers for each fix. New `tools/run-regression.js` runs the per-issue
  tests of later batches in CI and before every publish.
- Decisions OD-26 to OD-28 added; KI-099 and KI-100 recorded (found while fixing, not regressions).

### Fixed (fix batch 1b: the rest of the audit's batch 1, CR-0005)
`index.html` MD5 `FB6676DC…` → `EF2FF4F198A41FE02404B3617CBAD36E` (16,817,827 bytes), by four patches replayed from `main` in
file-name order: `2026-10-19-ai-analyst-amc-bookkeeping.js`, `-apply-plan-members.js`, `-cvs-hybrid-split-and-refresh.js`
and `-invested-and-irr-join.js`. Each fix had two financial reviews and known-answer tests that fail on the old build.
- **KI-007, blank invested value:** shown as "—" instead of 0.00, and left out of invested and gain/loss totals
  instead of counting the whole market value as gain. Partial totals carry ‡ with a footnote giving the count and
  share of CMV (screen, deck, workbook). Taxation treats the gain as unknown and names the count.
- **KI-048, client-sheet IRR subtotals:** built from the client's own holdings joined to the IRR file by client and
  instrument, so they no longer depend on the IRR file's asset/product spelling ("Equity", "EQUITY", "Mutual Fund").
  Redeemed or unmatched instruments still count (the since-inception scope of OD-4), placed by the IRR file's labels;
  anything that cannot be placed is listed in a § footnote. Client sheets reproduce the earlier figures whenever the
  labels were consistent.
- **KI-100:** a holding whose transactions give no rate is blank and footnoted, instead of showing the base file's
  figure as "transaction-based". Such holdings drop out of the Observations counts and the AI Analyst return signals.
- **Holdings slides:** a client's †/‡/§ notes get their own box above the black band, and that client's pages
  carry fewer rows (10–12 instead of 13). Slides without notes are unchanged.
- **KI-061, AMC cap and fund-house names:** one fund-house key, whatever the label ("HDFC", "HDFC Mutual Fund";
  "PPFAS", "Parag Parikh"; "ABSL", "Aditya Birla Sun Life"). The AI Analyst could take a house from 19% to 29%; it
  now stays within 20%, and the AMC tab shows one row per house. House figures move only with mutual-fund holdings:
  trimming or topping up a PMS, AIF, SIF or listed stock never frees or uses a fund house's room (OD-33).
- **KI-062, degraded Exit bookkeeping:** the unplaced amount is what the Exit actually releases ("₹7.50 Cr
  released … ₹7.80 Cr unplaced" could appear), and "largest AMC after" is read off the final plan. The behaviour
  itself (fall back to Retain, OD-14) follows in a later batch.
- **KI-120, AI Analyst summary:** named the after-plan house beside the before-plan "largest AMC" figure; each
  figure now carries its own house.
- **KI-063, Apply plan to Portfolio Rebalancing:** every holding of a position (Regular and Direct plans, several
  clients) gets the plan's release %, so the Rebalancing tab releases what the AI plan does (it released 3.46 vs
  4.58 Cr, and 2.35 vs 3.67 Cr, on synthetic books). Each row of a split reduction states its own amount; the status
  line counts rows and holdings; the "Applied" badge turns red with both figures once the tab no longer matches.
- **KI-067, Current vs Sample hybrid split:** each hybrid is split by its own equity sleeve, not the portfolio's
  (80% large cap + 20% conservative hybrid: 84.08 / 15.92, was 96.82 / 3.18). Funds of funds and hybrids with no
  sleeve data go to an "Unallocated †" row. Its expected return starts blank and, until the analyst types one, the
  totals and 3/5/10-year values show "—" (OD-29); the analyst is warned before exporting such a deck.
- **KI-068, Current vs Sample follows the plan:** the Sample column and slide refresh when the rebalancing plan
  changes, keeping typed cells; exports apply a pending refresh first.
- **KI-114, typing in Current vs Sample cells:** every keystroke redrew the table and dropped the focus, so "12"
  typed at a normal pace became 1.00. Typing now updates the figures only; the table and totals redraw when the
  entry is committed (Enter, leaving the cell, or a spinner step).
- **Tooling:** `tools/patch-lib.js` refuses a patch that is only partly present (a later patch rewrote its text),
  instead of silently re-inserting code (KI-119). AI Analyst acceptance test 17 → 24 checks; nine regression test
  files in `tools/regression/` (380 checks); browser check `tools/browser-checks/cvs-refresh.js`.
- **Docs:** decisions OD-29 to OD-36 (answered by the as-built behaviour unless the owner says otherwise);
  KI-101 to KI-123 recorded (found while fixing; none caused by this batch).

### Fixed (fix batch 4: base-file reading, CR-0009)
`index.html` MD5 `911A04659CB34383E478416B54E9C306` → `558A50F356406B2237AF247179A2186E` (16,836,871 bytes), by the
patch `tools/patches/2026-10-27-basefile-reading.js` (engine and UI scripts), then →
`12B5E5727FCA01EF2EA162C59913F01D` (16,837,249 bytes) by `tools/patches/2026-10-27-basefile-review.js` (engine), the
financial review's fix. The reading defects the new build's parity work found (M1.3, D-035), fixed on the live page
under D-028; the choices are D-041.
- **KI-140, merged units:** duplicate folios add up units only when every folio has them; otherwise the units are
  blank, never a partial sum, and Taxation leaves the fund unsplit with its reason instead of matching it on invested
  value.
- **KI-141, merged purchase date:** a merged holding shows its earliest purchase date, whatever the row order; its
  holding days are recomputed from it when the folios count to one date, and are blank otherwise. So a merged holding
  whose folios were bought on different dates can lose its "Avg. Holding Days": the figure becomes the oldest folio's
  age on the file's own count date, or blank (D-041 point 2; owner question 1).
- **KI-142, total rows:** a row named "Total" or "Grand Total" is skipped, not added to the book as a holding.
- **KI-143, text in number cells:** "12abc" or "1.25 Cr" is blank, never read as 12 or 1.25; the status line names the
  columns and counts the holdings left out.
- **KI-144, impossible dates:** "31-02-2024" is blank, no longer 2 Mar 2024.
- **KI-145, Asset Names:** "EQUITY" and "Equity", "REITs / InvITs" and "REITs/InvITs" are one Asset Allocation row;
  "Fixed Income" and "Debt Funds" are Debt (OD-7), so such funds are also routed, benchmarked and taxed as debt
  funds; "Commodities" is Commodity. `ENGINE.assetLabel` is new.
- **KI-146 (P1), IPS actuals:** each asset class adds up all its allocation rows (it kept only the last); on the
  synthetic book `family-a-odd-asset-labels` the equity CMV is 4.7545 Cr instead of 0.5427 Cr. With look-through
  data (the live page's normal state) that book's IPS actuals move from Equity 47.31%, Debt 9.51%, REITs 2.06%,
  Commodities 14.37%, Listed Equity 201.8% to 39.86%, 20.51%, 7.40%, 32.22%, 136.4% (true CMV shares 54.37%, 27.96%,
  3.30%, 14.37%): the IPS hybrid remainder (KI-066, open with the owner) hands equity and debt the look-through does
  not cover to REITs and Commodities, and the summed class rows make that larger. Not changed in this batch.
- **Notices:** each case above shows a plain sentence on the status line after the load summary, escaped.
- **A row that repeats the header** (financial review): skipped before its cells are read and not counted, so its
  column labels are no longer reported as text in number cells and as a holding left out (a false warning on the
  synthetic book `family-a-skipped-rows`); the rows read are unchanged.
- **Census (private, counts only):** 32 real base files with 1,705 holding rows show none of these cases except
  merged folios: 18 merged holdings take an earlier purchase date (16 in files the live page reads today), and 6 lose
  their "Avg. Holding Days" (3 in files read today), each a holding whose folios carry different holding days; the 6
  merged holdings whose folios all carry the same holding days keep them. CR-0009 has the counts.
- **Tests:** seven regression files, `KI-140-merged-units.js` to `KI-146-ips-actuals.js` (136 checks at first, 150
  after the financial review; 19 files, 649 checks in all), each failing on `main`. The new build's parity ledger retires BF-15,
  BF-16, BF-18 and BF-20 to BF-26 (the live page now agrees with the new reader there; a retired entry matches nothing)
  and lists the two differences D-041 opens that no fixture exercises yet (KI-148, for M1.4); 234 of 234 tests pass
  in IST and UTC. `check-invariants` lists `assetLabel` in the engine surface.
- **Browser acceptance** (27 Oct 2026, commit `b8a8d7f`, synthetic data): passed; recorded in CR-0009.

### Fixed (fix batch 2a: KI-124, OD-32 and OD-34, CR-0007)
`index.html` MD5 `EF2FF4F1…` → `911A04659CB34383E478416B54E9C306` (16,826,633 bytes), by the patch
`tools/patches/2026-10-22-legacy-batch-2a.js` (the first build of the batch, `F7123A83…`, was revised after its
financial review).
- **KI-124, empty slide download:** the Home tab's "Download slide" wrote a deck with no slides. Home has no download
  bar now, and any single-tab download whose deck would be empty is refused with a status message.
- **OD-32, renamed fund houses:** a former name counts as the current house: IDFC is Bandhan, L&T (also "L and T",
  "Larsen and Toubro") is HSBC, Reliance (also "Reliance Nippon", "Reliance Nippon Life") is Nippon India, DSP
  BlackRock is DSP, Birla Sun Life (also "Birla SL") is Aditya Birla Sun Life, IIFL is 360 ONE. The AMC tab, the AI
  Analyst cap and the summary measure the house as one, and its mutual-fund rows show the current name. A stock or
  PMS with such a name keeps its own label and counts in no house.
- **OD-34 and KI-112, mutual funds with no AMC:** a blank label, or a placeholder ("NA", "N/A", "N.A.", "Not
  Available", "Unknown", "Others", "Other", "-", "--"), is "AMC not given". It was one unnamed house that could be a
  breach and head the AI Analyst's largest AMC. Now it is a grey bar with a count and footnote on the AMC tab, slide
  and workbook, outside every house's cap but still in the mutual-fund book total; the AI Analyst shows those rows as
  "AMC not given" and adds a caveat.
- **AMC sentence and AMC slide insight (financial review):** with holdings that have no AMC, both give their share
  and say "well diversified" only if the largest house would stay within the 20% cap even if it held all of them.
  Otherwise they say diversification cannot be confirmed; with no AMC on any mutual fund, that concentration cannot
  be assessed. The insight is now written as plain sentences for every book (its dashes became full stops) and says
  "breaches" for a single house.
- **Tests:** three regression files (`KI-124-empty-slide-export.js`, `OD-32-renamed-amc.js`,
  `OD-34-amc-not-given.js`; 12 files, 499 checks in all). The nine OD-34 checks added after the financial review
  fail on the first build and pass on this one. Nine more, after the financial re-review, pin the "well
  diversified" boundary (18.00% + 2.00% not given is cap-safe, 18.10% + 2.00% is not, on the breach test's own
  arithmetic) and the wording (one house "breaches"; main's no-breach sentence unchanged; no en or em dash).
  `smoke-review` adds any "AMC not given" share to its AMC sum.
- **Browser acceptance** (22 Oct 2026, commit `a777490`, synthetic data): passed; recorded in CR-0007.
- **Docs:** KI-125 and KI-126 recorded (both pre-date the batch); after the browser QA, KI-125 extended (a PptxGenJS
  colour warning) and KI-127 and KI-128 recorded (both also on main).

## 2026-10-15 — Repository organised, monthly refresh restored (PR #2, merged as `df25dcd`)

Organise the repository and set up the monthly refresh (CR-0003). `index.html` is unchanged
(MD5 `F0EB0101E27DD165A23A62CF548E26A2`).

### Added
- `buildtools/`: the monthly data-refresh pipeline, restored from the previous owner's export. Two scripts
  were adapted:
  - `splice_refresh.js` writes the single `index.html`;
  - `postcheck.js` takes the month folder as an argument.

  The pipeline was proved on the September 2026 data: the rebuild is byte-identical to the live blocks, and a
  real splice leaves `index.html` unchanged. See `buildtools/README.md`.
- `buildtools/intake_check.js`: a read-only check of a month's inbox. It reports expected files, hashes, as-on
  dates, stale copies, re-saved workbooks (people shown as "person N") and the TRI downloads, and writes a
  manifest that is rechecked before the splice.
- `docs/MONTHLY_REFRESH.md`: the monthly process, covering the owner's part and Claude's runbook.
- `docs/README.md`: a documentation index.
- New records folders:
  - `docs/change-requests/`: CR-0001 to CR-0003;
  - `docs/refresh-log/`: README, template, and the September refresh with its fidelity rebuild.
- `docs/previous-owner/`:
  - README;
  - public copies of the previous owner's `KNOWLEDGE_DUMP.md` and `DECISIONS_LOG.md` (sensitive sections left
    out, D-019).
- `.claude/agents/refresh-operator.md`.
- `tools/open-dashboard.cmd`: double-click to start the local server if needed and open the dashboard.
- Decisions D-017 (keep GitHub up to date; merge verified requested work), D-018 (OneDrive layout) and D-019
  (what from the export may be published).
- KNOWN_ISSUES: KI-005 rewritten (both unit forms seen); KI-036 to KI-046 from the previous owner's notes.

### Changed
- `serve-dashboard.js` moved to `tools/`, and `.claude/launch.json` updated.
- The local server now serves only the dashboard and the files in `test-data/` (everything else returns 404,
  including `buildtools/out/`). It also accepts only requests addressed to `127.0.0.1` or `localhost`, which
  blocks DNS rebinding.
- `docs/reference/` renamed to `docs/previous-owner/handover/`.
- `tools/test-ai-analyst.js` replaced with the previous owner's current version. It passes 17/17, and CI now
  runs it as a blocking check.
- `CLAUDE.md` updated:
  - rule 8 follows D-017;
  - the repository layout includes `buildtools/` and the new docs folders;
  - the monthly refresh is described.
- `HANDOVER.md`, `DEVELOPMENT_SETUP.md`, `ARCHITECTURE.md`, `TESTING.md` and `PROJECT_STATE.md` updated.

### Fixed
- **KI-010:** the stale AI Analyst test (see Changed).
- **Local link http://127.0.0.1:8099 not working.** The preview server had stopped with the Claude session that
  started it. `Open Dashboard.cmd` now starts it on demand.

## 2026-10-15 — KI-001 fix (PR #1, merged as `9f018e4`)

### Fixed
- **KI-001**: loading a second client's base file in the same tab no longer inherits anything from the
  previous review (client IRR / PMS-AIF / bonds uploads, post-rebalancing look-through, rebalancing plan,
  slide-picker ticks, overlap selection, Taxation scope, CVS edits — and the "Fund IRR" sheet of the
  Excel export). The status line names any upload that was cleared. `index.html` MD5
  `173F86CAC1E5D0AC8FFD5A66042A3B4C` → `F0EB0101E27DD165A23A62CF548E26A2`
  (`tools/patches/2026-10-15-ki001-reset-family-state.js`).

### Added
- `tools/patch-lib.js`: anchored, idempotent, invariant-checked edits to `index.html`; one script per
  change in `tools/patches/`.
- `tools/browser-checks/family-isolation.js`: browser regression checks for KI-001.

### Changed
- CI workflow comment corrected (runs on pushes to `main` and on pull requests).

## 2026-10-14 — Baseline replication (Stage A)
Product unchanged: `index.html` is byte-identical to the previous owner's production build
(`cab22e6`, MD5 `173F86CAC1E5D0AC8FFD5A66042A3B4C`, 16,765,556 bytes, data vintage 30 Sep 2026).
New home: public repository `productsteamcentricity/portfolio-review-dashboard`, fresh history
(D-002, D-008), published to https://productsteamcentricity.github.io/portfolio-review-dashboard/.

### Added
- `CLAUDE.md` operating contract; `docs/` (architecture, setup, testing, deployment, decisions, known
  issues, project state, replication report, handover); the previous owner's handover and project
  history in `docs/previous-owner/handover/`.
- `tools/check-invariants.js`, `tools/smoke-review.js`, `tools/make-sample-base.js`,
  `tools/extract-blocks.js`; recreated `serve-dashboard.js` and `.claude/launch.json`.
- CI (`.github/workflows/ci.yml`) and a Pages workflow that publishes `index.html` only
  (`.github/workflows/pages.yml`).
- Project subagents in `.claude/agents/`.
- `.gitattributes` (`* -text`).

### Changed
- `tools/engine-host.js`: `ROOT` resolves to the repository instead of a personal OneDrive path.
- `.gitignore`: client-name pattern removed; blocks office/data formats, vendor folders, backups.
- `tools/render-slides.js`: client name removed from a usage comment.
- `README.md`: maintainer section and analyst safety notice.

### Known issues
34 baseline issue entries (KI-001–KI-034) recorded in `docs/KNOWN_ISSUES.md`; most important: KI-001 (reload the page
between clients), KI-002/003 (overlap matrices missing from exported decks).

## Before 2026-10-14 — previous owner
May 2026 first build → June analytics, overlap, IRR → July CMS, rebalancing, PMS universe → Aug AI
Analyst, Taxation, base expense ratio, XIRR solver fix, `buildtools/` pipeline, date fix,
product-class matching → Sep/Oct data refreshes to 30 Sep 2026. Full narrative:
`docs/previous-owner/handover/PROJECT_HISTORY_Portfolio_Review_Dashboard.md`.
