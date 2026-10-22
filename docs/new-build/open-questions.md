# Open questions for the owner

Phase 0 deliverable 13. Draft of 21 Oct 2026, revised 22 Oct 2026 after the Phase 0 review, and revised again on
22 Oct 2026 for the decisions taken after the Phase 0 documents were written (D-022 merged, CR-0006, D-023, the MF
Screener data pack; change log at the end), and a third time on 22 Oct 2026 for the owner's answers to ND-1 to
ND-10 (D-024 to D-033). Every question raised by the eight Phase 0 investigations, by the architecture work and by the
review is listed once here. Question numbers are never reused: answered questions stay, marked as answered.

**Labels.**
- **ANSWERED** with the decision and its date: nothing more is needed.
- **Owner decision ND-n**: one of the ten items in `owner-decisions-new-build.md`, the questions that needed the owner.
  All ten were answered on 22 Oct 2026; their questions are now marked ANSWERED with the decision number.
- **Proceeding on default**: the recommendation is built as a provisional, configurable default and recorded as such.
  It does not stop work; the owner may still change it later, and the change is then a configuration edit.

**Sources** (Phase 0 investigator files, revised for publication on 22 Oct 2026 and to be committed under
`docs/new-build/inputs/`): [DA] `deck-a-spec.md` · [OP] `observation-patterns.md` · [IE] `inventory-engine-exports.md` ·
[IU] `inventory-ui-workflows.md` · [PO] `previous-owner-and-requirements.md` · [DS] `data-source-inventory.md` ·
[SC] `mf-screener.md` · [TE] `technology-evaluation.md` · [BRIEF] the owner's brief of 21 Oct 2026 (sanitised copy
`docs/new-build/00-owner-brief.md`, merged in PR #8). Repository records on `main` (`8cb320d`): `CLAUDE.md`,
`docs/DECISIONS.md` (D-nnn, including D-022 of 21 Oct and D-023 of 22 Oct 2026), `docs/audits/2026-10-19-decisions.md`
(OD-nn), `docs/KNOWN_ISSUES.md` (KI-nnn, including KI-124), `docs/change-requests/CR-0006-new-build.md`. Milestones M1
to M16 are defined in `07-implementation-roadmap.md`. The owner's answers of 22 Oct 2026 are recorded as D-024 to
D-033 in `docs/DECISIONS.md` (the proposals were in `03-architecture.md` §21).

**Summary.** 86 questions: 8 on publication and compliance, 9 on stack and process, 14 on data sources, 17 on deck
design, 12 on calculations, 10 on the observation engine, 5 on workflow, and 11 added by the review of 22 Oct
(section H).
- **21 answered:** Q-01, Q-02 (D-023), Q-03 (the brief), Q-11 (the brief; D-027), Q-18 (the Screener data pack
  contract), Q-27, Q-28 (the data pack), Q-36 (D-023 and the brief), Q-56 (D-022), Q-84 (the design reference was
  read); and on 22 Oct 2026 the eleven questions of ND-1 to ND-10: Q-06 (D-026), Q-09 (D-025), Q-10 (D-024), Q-16
  (D-028), Q-33 and Q-35 (D-031), Q-42 (D-029), Q-61 (D-030), Q-78 (D-032), Q-85 (D-024), Q-86 (D-033).
- **None needs the owner.** The owner gave Claude full charge of GitHub and the dashboard (D-033); open technical and
  process questions are decided by the lead and recorded.
- **65 proceed on default.** No other question blocks a milestone; the "Blocking" labels of the earlier drafts are
  withdrawn.

| Owner decision | Questions | Answer (22 Oct 2026) |
|---|---|---|
| ND-1 Screener scores and ranks in the public page | Q-06 | **D-026** (owner): never in a public page; an upload slot in section 1, the pack kept in the browser until a newer one |
| ND-2 npm for build tooling | Q-09 | **D-025** (lead): yes |
| ND-3 `/next/` public preview | Q-10 | **D-024** (lead): yes, superseding D-007 in part |
| ND-4 legacy change policy | Q-16 | **D-028** (lead): calculation, data and security fixes on the live page; presentation-only work in the new build |
| ND-5 missing-value marker | Q-42 | **D-029** (owner): the dash stays for missing values; no dashes in sentences |
| ND-6 observation thresholds | Q-61 | **D-030** (owner): approved, a fund pair overlapping from 35% |
| ND-7 slide 25 border grey, slide 6 tan | Q-33, Q-35 | **D-031** (lead): 0.5 pt `#D9D9D9`; tan `#DBC8B2` with the action word |
| ND-8 capital-gains statements | Q-78 | **D-032** (owner): uploaded in our own template |
| ND-9 no client use of `/next/` outputs before switch-over | Q-85 | **D-024** (lead): confirmed |
| ND-10 branch ruleset on `main` | Q-86 | **D-033** (owner): no ruleset; Claude takes full charge |

---

## A. Publication, licence and compliance

### Q-01 Vendor data licence: ANSWERED (D-023 point 1, 22 Oct 2026)
- **Question (as asked).** Who holds the Accord Fintech (ACE MF) contract, and does it allow (a) raw vendor files and
  (b) data derived from them in a public repository and on the public Pages site? The same question applied to NSE
  Indices TRI data used for the in-house risk ratios.
- **Answer.** The vendor licence allows publishing every Accord Fintech file: the monitor files, and (the owner,
  22 Oct 2026: "yes, the licence covers all Accord files") every other Accord file too: equity, hybrid and debt
  analytics, expense ratio, listed equity, fund manager and exit load. Every Accord file and the other approved
  monthly source files (Investment Reckoner, PMS and AIF one-pagers, market update slides, disclaimer, index data) are
  tracked publicly in `monthly_updates/YYYY-MM/`. The vendor-derived data embedded in `index.html` is permitted, which
  closes the D-008 question. Client data is never published. The MF Screener data pack is never published or embedded
  in a public build (D-026, owner, 22 Oct 2026).
- **Effect.** The data-class policy (D-026, `monthly_updates/_policy/publication-classes.json`) records every Accord
  file and the other approved roles as class P. The equity, hybrid and debt analytics, expense ratio, listed equity,
  fund manager and exit load files are tracked in `monthly_updates/YYYY-MM/` like the monitors (in `other-approved/`,
  `09-repository-and-docs-structure.md` §5); the earlier default (raw files kept privately, proven by SHA-256) is
  withdrawn.

### Q-02 Public tracking of `monthly_updates/`: ANSWERED (D-023 point 1, 22 Oct 2026)
- **Question (as asked).** The brief lists the MF Monitor and SIF Monitor among publicly tracked monthly files. Accept
  a split instead (public manifest, class P files committed, licensed files kept privately and proven by hash)?
- **Answer.** No split for the approved files: they are tracked publicly as the brief asks. Files above 50 MB
  (GitHub warns at 50 MB and refuses 100 MB), such as the 64 MB Investment Reckoner PPTX, are tracked as PDF, with the
  original kept in private storage (OneDrive, per D-023) and its SHA-256 recorded in the manifest.
- **Effect.** M11 commits approved files after the privacy scan; `.gitignore` gains a narrow allow-list for the
  approved roles; `MANIFEST.json` lists every file seen with its SHA-256, class and storage.

### Q-03 Investment Reckoner as the product-bank source: ANSWERED (the brief, 21 Oct 2026; publication per D-023)
- **Question (as asked).** Do you confirm reversing the 20 May 2026 decision ("ignore the Monthly Investment Reckoner as
  a data source"), so the Reckoner becomes the product-bank source? May it be published, and in which form?
- **Answer.** Yes: the brief asks for "a reusable product bank maintained from Investment Reckoner presentations and
  product material". The Reckoner is parsed from the PPTX XML and chart caches [PO §2.3 "Reversal"; DS §7.1]. It is an
  approved monthly source file under D-023 point 1, tracked as PDF while the PPTX exceeds 50 MB.

### Q-04 Approved PMS and AIF one-pagers: proceeding on default (partly settled by D-023 point 1)
- **Question.** Which one-pager decks are "approved" for the Annexure? (Whether AIF one-pagers may be public is settled
  by D-023 point 1: PMS and AIF one-pagers are approved monthly source files.)
- **Context.** One-pagers use the Reckoner card template, mix product types per deck and lag the Reckoner by one to two
  months [DS §1 item 6, §7.2].
- **Recommendation.** An approved list kept in `monthly_updates/_policy/approved-products.json` (product ids, not file
  names), maintained in the monthly pull request; only listed products reach the Annexure. **Proceeding on default.**

### Q-05 Fund-manager names in public data
- **Question.** May fund-manager names appear in the public product bank and the public dashboard?
- **Context.** They already do through `FUND_MGR` (11,522 stints) and `SIF_PERF.manager` [DS §1 item 11]; D-023
  permits the vendor-derived data.
- **Recommendation.** **Proceeding on default:** status quo (names as today); a public build without names (tenure and
  change dates only) stays a configuration option.

### Q-06 Screener-derived data in the public build: ANSWERED (D-026, owner, 22 Oct 2026; was ND-1)
- **Question.** The Screener is invitation-only and carries Centricity's own scores. May Screener scores, ranks and
  ratios be embedded in the new app's public build?
- **Context.** [SC §1; DS §1 item 14]. D-023 point 1 recommends that the MF Screener data pack stays private unless
  the Screener owner agrees.
- **Recommendation.** Keep the pack private: the analyst loads the month's pack at run time (session only, like the
  IRR file); the monthly engine publishes only its fingerprint and counts; nothing Screener-derived is embedded until
  the Screener owner agrees. See ND-1.
- **Answer.** Not possible: Screener scores and ranks are never in the public page, and the pack is never embedded in
  any public build or committed. The owner uploads the pack every cycle into the "MF Screener data pack" slot in
  section 1; the browser keeps it in IndexedDB until a newer pack is loaded, the sidebar shows its cycle date, and
  every screen, slide and sheet that needs it says so when it is absent (`03-architecture.md` §6.9). The legacy
  page's `FUND_RANKS` block is an open item (see `docs/PROJECT_STATE.md`).

### Q-07 Approved disclaimer source and text
- **Question.** Which file is the approved presentation disclaimer? Should it keep the e-mail confidentiality paragraph
  and the regulatory registration lines that reference deck A carries, and should it use the standard header chrome?
- **Context.** The dashboard's disclaimer image, reference deck A's native disclaimer and the Reckoner's disclaimer slide
  differ [DA §4 slide 40; DS §6 #26]. The source deck is still owed by the previous owner (T7). The disclaimer is an
  approved monthly source file under D-023 point 1.
- **Recommendation.** A versioned `disclaimer` file in `monthly_updates/YYYY-MM/disclaimer/` (class P), rendered as native
  editable text in the standard chrome. **Proceeding on default:** the current dashboard text, rendered natively.

### Q-08 The previous owner's public site
- **Question.** The original site still serves the build without the KI-001 fix and the embedded vendor data, from a
  personal account. Keep it live until the new build passes parity (your 15 Oct decision), or ask for it to be archived
  now?
- **Context.** [PO §1.3]. Analysts who still use the old link get the unfixed family-isolation behaviour.
- **Recommendation.** Ask the previous owner to archive it now and point analysts to the team site.
  **Proceeding on default:** your 15 Oct decision stands; this blocks no milestone.

## B. Stack, deployment and process

### Q-09 npm for build tooling: ANSWERED (D-025, lead under D-033, 22 Oct 2026; was ND-2)
- **Question.** May the new application use npm for build tooling (esbuild 0.28.2, TypeScript 7.0.2 or 6.0.3) and one
  small runtime package (Preact 10.29.x), exactly pinned with a committed lockfile and `ignore-scripts`? Today's "no npm
  install" rule describes the legacy file.
- **Context.** [TE §1, §4]. Node 24 already runs the TypeScript sources and tests with no install; only the browser
  bundle needs esbuild.
- **Recommendation.** Yes (D-025). If no, the same layout ships with a hand-written bundler (option (a), [TE §4.1]);
  M1.3 does not wait either way.
- **Answer.** Yes, as recommended (D-025). The hand-written bundler stays the fallback if npm or esbuild cannot run.

### Q-10 Public preview at `/next/`: ANSWERED (D-024, lead under D-033, 22 Oct 2026; was ND-3)
- **Question.** May the new app be published at `/next/` on the public Pages site, with a visible "Preview, not for
  client use" banner? Should the legacy page link to it?
- **Context.** D-007 says Pages publishes `index.html` only. Publishing `next/index.html` as well needs a decision that
  supersedes D-007 in part (proposed D-024; docs are still never served).
- **Recommendation.** Yes to `/next/` with the banner, recorded as D-024. No link from the legacy page until M5 (the
  first milestone with a complete Review Only slide set to preview); exports from `/next/` carry a "Preview build"
  marker until switch-over (Q-85, ND-9).
- **Answer.** Yes, as recommended (D-024, superseding D-007 in part).

### Q-11 MF Screener link exception: ANSWERED (the brief, 21 Oct 2026; recorded as D-027)
- **Question (as asked).** Approve one narrow exception to the no-remote-href rule for an MF Screener navigation item?
  New app only, or also the legacy page?
- **Answer.** The owner asked for a dedicated MF Screener navigation link in the brief. The Screener refuses to be
  framed and requires sign-in, so the item opens it in a new tab. It is recorded as a documented exception to the
  no-remote-URL rule (`CLAUDE.md` rule 2) for this one navigation link only (D-027): one allow-listed URL in
  `config/links.json`, an anchor with `target="_blank" rel="noopener noreferrer"`, no query string, no prefetch, no
  availability check; `scripts/check-next.mjs` allows that URL in that form and nowhere else. New app only: the legacy
  page receives no presentation changes (D-028) [SC §1, §2; `tools/check-invariants.js`].

### Q-12 SheetJS reader upgrade
- **Question.** May the SheetJS reader be upgraded from 0.18.5 to 0.20.2 or later (fixes CVE-2023-30533 and
  CVE-2024-22363, both on reading files)? It needs a one-time download from the SheetJS CDN, recorded with its hash.
- **Recommendation.** Yes, in M2, behind the date-handling tests. **Proceeding on default:** 0.18.5 until then,
  reading only files the analyst chose.

### Q-13 Excel writer fallback
- **Question.** If the in-house SpreadsheetML writer fails the spike (Excel repairs the file, or styles, frozen panes or
  recalculation do not work), may the build use ExcelJS 4.4.0 (MIT) instead?
- **Recommendation.** Yes. **Proceeding on default.**

### Q-14 Size and storage of monthly binaries
- **Question.** For files committed to `monthly_updates/`: plain git with a per-file cap, or Git LFS?
- **Recommendation.** Plain git, no LFS (its bandwidth quota would hit the Pages workflow). D-023 sets the large-file
  rule: a file above 50 MB is tracked as PDF with the original's SHA-256 recorded. **Proceeding on default** for the
  rest: the pre-push scanner refuses any file above 50 MB and warns above 20 MB; rendered market-update images at
  1920 x 1080 JPEG.

### Q-15 Browser test automation
- **Question.** Install Playwright (a large browser download), or keep manual preview checks plus a small
  zero-dependency Chrome DevTools driver?
- **Recommendation.** Zero-dependency driver from M9; manual preview checks before that. **Proceeding on default.**

### Q-16 Legacy changes during the parallel run: ANSWERED (D-028, lead under D-033, 22 Oct 2026; was ND-4)
- **Question.** While the new app is built, which CR-0005 fixes should the live page still receive?
- **Context.** Two apps to maintain is the largest delivery risk [TE §12 R5]. The owner approved the CR-0005 order
  (fix batches 2 to 7: reference-data joins, uploads and parsers, security, exports, robustness, UI wiring that changes
  deck numbers); D-021 schedules the group (b) fixes with those batches; D-022 (21 Oct) puts OD-32 and OD-34 in the
  next legacy batch, which is being built now as batch 2a with KI-124. Re-triaging them without an answer would break
  `CLAUDE.md` rule 9 (stage discipline).
- **Recommendation.** Keep fixing calculation, data and security issues on the live page while it is the review link;
  presentation-only improvements go to the new build (D-028). Batch 2a proceeds as decided. **Until you answer,
  CR-0005 stands as approved**, and every legacy fix is ported to the new app with the same known answer.
- **Answer.** As recommended (D-028): the CR-0005 batches continue without their presentation-only items, which move
  to the new build.

### Q-17 Retirement criteria
- **Question.** Accept these parity criteria for switching: every capability in `05-feature-parity-matrix.md` at
  "parity" or "accounted for", the 24 acceptance cases green, two consecutive real reviews produced from the new app and
  checked against the legacy outputs, and your sign-off. Then the new app moves to `/`, the legacy page to `/legacy/`.
- **Recommendation.** Accept, with the nine analyst workflows W-1 to W-9 also at parity (a browser drill by an analyst
  in M15). **Proceeding on default.**

## C. Data sources

### Q-18 Screener export route: ANSWERED (the data pack prompt, contract `pr-datapack-v1`, 22 Oct 2026)
- **Question (as asked).** Will the Screener's maintainers supply a per-cycle export for the Portfolio Review, and in
  which form?
- **Answer.** Yes, as a monthly data pack built by the Screener owner's exporter (CR-0006). The prompt, contract
  `pr-datapack-v1`, is held privately. Each cycle is one `pr-datapack_<cycle>.zip` with: `manifest.json`;
  `funds.json` (identity including AMFI code, ISINs, name variants and the Direct pairing; returns MTD to SI for the
  fund, its benchmark and its category; calendar years; risk 3Y and 1Y; rolling summaries; Centricity score, rank and
  the 22 parameter scores; portfolio character; asset split; debt profile; credit quality; issuer concentration;
  manager; flags); `holdings_<month_end>.json` (every holding row of every fund, all instrument types including
  `mf_units` for FoF look-through, with ISIN, sector, market-cap type and rating); `benchmarks.json` (returns, calendar
  years, risk, constituents where available); `categories.json` (averages, scoring weights); `stocks.json` (master by
  ISIN); `stock_prices_month_end.json` (72 months, split and bonus adjusted); `nav_month_end.json` (fund, Direct and
  benchmark month-end series); `managers.json`; `definitions.json`; `changes.json`; `funds_summary.csv`;
  `VALIDATION_REPORT.md`. A one-time backfill adds month-end holdings for 31 Mar to 31 Aug 2026 and earlier cycles.
  No credential is used, stored or relayed, and nothing logs in [SC §1].
- **Effect.** `ingest/screener-pack/` (M10) validates and loads the pack; the narrow CSV of the first draft is
  dropped. Its contents are never published or embedded in a public build (D-026).

### Q-19 Screener metric definitions and coverage
- **Question.** What are the Screener's ratio window, risk-free rate, return frequency, benchmark for beta, alpha and
  capture, 3Y rolling definition and score scale? Does it cover Direct plans, hybrid and debt ratios, PMS and AIF?
- **Context.** Needed to reconcile with the in-house `MF_RISK` (rf 4.5%, daily, square root of 252) before mixing.
- **Recommendation.** Read them from the pack's `definitions.json` and store them with each cycle's manifest.
  **Proceeding on default:** Screener ratios are shown separately from in-house ratios, never mixed in one column,
  unless the definitions match.

### Q-20 Portfolio Quants source of record
- **Question.** For the "Portfolio Quants" metrics (reference deck A slides 5 and 7): Screener first with the in-house
  risk workbook as fallback, or the reverse?
- **Recommendation.** Score, rank and status from the Screener pack (it owns them); ratios from the pack when loaded,
  else the in-house `MF_RISK`; returns per D-023 point 3; source and date shown per metric group.
  **Proceeding on default.**

### Q-21 Staleness of score and rank
- **Question.** When score and rank data is older than one Screener cycle, show it with its date and a STALE DATA flag,
  or suppress it?
- **Recommendation.** Show with date and STALE DATA for up to three cycles; suppress beyond that.
  **Proceeding on default.**

### Q-22 Stable identifiers in client files
- **Question.** Will base files and IRR exports carry ISIN or AMFI scheme codes? Can the exporting platform add them?
- **Context.** Name matching is the root of the P0 matching defects KI-050, KI-036, KI-054 [IE E-13, E-125]. The
  Screener pack's `funds.json` adds AMFI codes, ISINs and name variants to the crosswalk.
- **Recommendation.** Ask the platform; the new matcher uses identifiers first whenever present.
  **Proceeding on default.**

### Q-23 Competing September monitors and the richer SIF layout
- **Question.** Which September 2026 Direct MF Monitor is authoritative (two copies with different hashes exist)? Can
  the richer SIF layout (AMFI codes, NAV, per-scheme benchmark returns) replace the SIF Monitor monthly?
- **Recommendation.** The archived copy, unless you say otherwise; yes to the richer SIF layout.
  **Proceeding on default.**

### Q-24 PMS performance and PMS/AIF look-through files
- **Question.** Who produces `PMS_Scheme Performance` and `PMS & AIF Analytics`, under what terms, and how often?
- **Recommendation.** Name an owner per file in the monthly checklist. **Proceeding on default:** they stay occasional
  and are flagged STALE DATA when older than one quarter.

### Q-25 One product bank with the Investment Proposal Dashboard
- **Question.** Should the product bank be shared with the sister Investment Proposal Dashboard (one schema, one source
  of truth, reusing its Reckoner parsers)?
- **Recommendation.** Yes in principle: same schema from day one, built in this repository first, extracted to a shared
  package once both apps use it. **Proceeding on default.**

### Q-26 Monthly folder naming and drop location
- **Question.** Confirm `monthly_updates/YYYY-MM` is named by the data (as-on) month, decks filed one month before their
  title month. Confirm you keep dropping every file in your private monthly inbox (one `YYYY-MM` folder per data
  month, read through `PRD_MONTHLY_INBOX`), and the update engine copies approved files into the repository after its
  privacy scan.
- **Recommendation.** Confirm both. One drop location keeps the single monthly instruction unchanged.
  **Proceeding on default.**

### Q-27 Historical analytics: dates and sources: ANSWERED (the Screener data pack and its backfill, 22 Oct 2026)
- **Question (as asked).** The brief names March 2026 and September 2026, and the vendor archive starts at data month
  2026-04. Where do dated fund holdings come from, and how is the client side of a historical review supplied?
- **Answer.** Fund holdings as at each month-end from 31 Mar 2026 onward come from the Screener pack's
  `holdings_<month_end>.json` files: the one-time backfill covers 31 Mar to 31 Aug 2026 and earlier cycles, and each
  monthly pack adds its month. The April 2026 vendor "prior-month" block is not used.
- **Client side, proceeding on default.** Historical client holdings come only from a historical base file or from the
  transaction ledger with dated prices; current holdings are never presented as historical [BRIEF 6.6].

### Q-28 FoF look-through source: ANSWERED (the Screener data pack, 22 Oct 2026)
- **Question (as asked).** Where do the underlying-fund allocations of hybrid and passive funds of funds come from?
- **Answer.** From the pack's `mf_units` holding rows when supplied. Otherwise the FoF's look-through is NOT
  AVAILABLE IN SUPPLIED DATA: the portfolio-level figure shows PARTIAL COVERAGE, and nothing is estimated from names
  or factsheets. 197 of 2,130 `MF_PERF` names are FoFs [IE E-118; PO §2.2].

### Q-29 Exit-load file
- **Question.** The monthly Exit Load file arrives but is not consumed. Ingest it for redemption timing and switch costs?
- **Recommendation.** Yes, in M11, as free text plus parsed periods with a confidence flag. **Proceeding on default.**

### Q-30 Index constituents for index overlap
- **Question.** May index funds' full holdings proxy the indices (Nifty 50, 100, 500, Midcap 150, Smallcap 250,
  LargeMidcap 250) for "equity overlap with Nifty 500" and active share, with the proxy fund and its date named in the
  footnote?
- **Context.** No index constituents are held today; full look-through holdings exist for index funds [OP §0 item 4].
  The pack's `benchmarks.json` carries constituents where available [SC §3].
- **Recommendation.** Constituents from the pack when supplied; otherwise the index-fund proxy, named with its date.
  **Proceeding on default.**

### Q-31 The previous owner's second export
- **Question.** Will you chase the second export (risk toolchain, sources of record such as IPS profiles, Rebalancing
  Rules, `Logic.txt`, Fund Ranks, topic and disclaimer slide sources, `ANSWERS.md`, real-format fixtures) before the
  mid-November refresh?
- **Context.** The incoming folder was empty on 21 Oct [PO §4.3, §4.5]. Without the toolchain `MF_RISK` stays at 30 Sep.
- **Recommendation.** **Proceeding on default:** the request stays open (CR-0004). `MF_RISK` keeps its 30 Sep 2026
  values with STALE DATA; once a Screener pack is loaded, its 3Y and 1Y risk metrics are the first source for the
  ratios (Q-20). M16 lists whatever rules have not arrived as missing inputs.

## D. Presentation and deck design

### Q-32 Deck order, cover and title slides, and the Home download
- **Question.** Which order should the full deck use? Should it have a cover and a title slide? Should Home have a
  download at all (KI-124: today it downloads an empty deck)?
- **Context.** Reference deck A is verdict-first and ends with the market update; the exporter puts the market update
  first and has no cover [DA §3; IU U-45].
- **Recommendation.** Cover, title, market update, Review Snapshot, portfolio overview, observations, analytics and
  overlap, holdings and performance, rebalancing (only with a valid plan), taxation, annexure, disclaimer, closing.
  Home has no download. The order is configuration (`config/slide-manifest.json`). **Proceeding on default.**

### Q-33 Holdings sheet borders ("slide 25"): ANSWERED (D-031, lead under D-033, 22 Oct 2026; was ND-7)
- **Question.** Does "slide 25: lighter grey borders" mean the holdings sheets (slide 26 of the 41-slide deck, slide 25
  of the earlier 40-slide version)? Which grey: 0.5 pt `#D9D9D9` (the exporter's) or `#E8E0D5`?
- **Recommendation.** Holdings sheets; 0.5 pt `#D9D9D9` on every table, one token for the whole deck. See ND-7.
- **Answer.** As recommended (D-031).

### Q-34 Holdings sort and distributor grouping
- **Question.** Keep the asset class and product grouping and sort by current value within each product, merging only
  adjacent identical distributor labels? Or one global sort by value across the sheet?
- **Context.** A global sort interleaves distributors and breaks the merges [DA §4 slides 26 to 28; PO §2.3].
- **Recommendation.** Keep the grouping (subtotals are useful), sort by CMV descending within each product, merge
  adjacent identical distributor labels on slides only, never in Excel. **Proceeding on default.**

### Q-35 Actionables column: ANSWERED (D-031, lead under D-033, 22 Oct 2026; was ND-7)
- **Question.** One tan for every action (`#DBC8B2`, black bold text), or per-action colours? Should the cell carry the
  action word or the short rationale, as reference deck A does?
- **Recommendation.** One tan for all actions; the cell shows the action word; the rationale keeps its own column.
  See ND-7.
- **Answer.** As recommended (D-031): tan `#DBC8B2`, black bold text showing the action word.

### Q-36 Slide 8 pre/post projection: ANSWERED (D-023 point 3 and the brief, 22 Oct 2026)
- **Question (as asked).** Which basis for the pre and post 3Y and 5Y CAGR, and where are analyst-entered expected
  returns for alternate products recorded? Should the projection replace the composition table or sit on its own slide?
- **Answer.** The pre and post 3Y and 5Y returns are weighted historical returns: each fund's 3Y or 5Y return weighted
  by its share of the pre or post portfolio (D-023 point 3; source order: the MF Monitor the analyst uploads for the
  review, else the latest monthly MF Monitor, else the MF Screener data pack). A fund without a return is left out of
  the weights and the coverage is footnoted, never counted as 0%. The figures are labelled "weighted average return of
  current holdings" and "historical". Illustrative values after 3 and 5 years = current value x (1 + r)^n, with the
  rupee difference (the brief). Products without history (PMS, AIF and others) use the analyst's expected return,
  entered in the Assumptions inputs (screen and workbook) and labelled "illustrative". Every figure carries
  "illustrative, not a guarantee".
- **Placement, proceeding on default.** Its own component (C-31) after the composition table (C-30).

### Q-37 Slide 9 redemption plan styling
- **Question.** What should the "borders highlighting differences" highlight: rows whose plan changed since the last
  saved version, rows that differ between execution dates, or something else? Should the rupee plan and the unit plan
  (reference deck A slides 9 and 11) become one slide?
- **Recommendation.** One component (units with the INR amount). **Proceeding on default:** a 1 pt gold outline marks
  each execution-date block; a different meaning is a styling change.

### Q-38 Market Update slides
- **Question.** Keep them as supplied images, or import them as native slides from the monthly Market Update deck? Keep
  "no logo" on them? Should the analyst preview, reorder or exclude them per review?
- **Recommendation.** v1: images rendered from the monthly deck at update time, no logo (decision of 27 Aug), with
  preview and exclude per review; native import evaluated after M9. **Proceeding on default.**

### Q-39 Logo placement and lock-up
- **Question.** Confirm: content slides keep the logo top-right on the header bar; placeholder and divider slides carry
  it at the lower right without a black plate. Which lock-up is approved (deck A uses two)?
- **Recommendation.** Confirm placement; the lock-up is the one the analyst picks in the app.
  **Proceeding on default.**

### Q-40 Slide picker semantics
- **Question.** Should a picker deck always include the Disclaimer; may the Market Update and Thank You be left out;
  should every section divider appear when one of its slides is picked; should a single-section download include its
  divider (N-6)?
- **Recommendation.** Disclaimer always (compliance). Market Update and Thank You on by default in full and picker decks,
  off in single-section downloads. Dividers whenever a picked slide sits in their section; none in single-section
  downloads. **Proceeding on default.**

### Q-41 Placement of AI Analyst and Taxation (KI-014)
- **Recommendation.** Follow the screen: AI Analyst inside Rebalancing, Taxation in its own section.
  **Proceeding on default.**

### Q-42 Formatting conventions: ANSWERED (D-029, owner, 22 Oct 2026; was ND-5)
- **Question.** Missing-value marker, date format, digit grouping, negative numbers.
- **Context.** Deck A uses a hyphen, the exporter an em dash, and the brief bars dashes in presentation writing
  [DA §2.6; OP §4]. Two accepted decisions prescribe the dash: OD-13 ("—", not a breach, when a family has no unlisted
  holdings) and OD-29 ("—" totals while a Current vs Sample return is blank).
- **Recommendation.** Missing values show "n.a." with a footnote naming the status (not available in supplied data, not
  applicable, stale ...); dates "D Mon YYYY"; Indian digit grouping for rupee amounts and units; negatives with a
  hyphen-minus and red `#931621`. In the new app this replaces the dash that OD-13 and OD-29 prescribe; their substance
  is kept (no breach shown, no invented total), and the legacy page keeps its dash. Recorded as D-029. The marker is
  one setting, so the build proceeds on it and the answer changes configuration, not code. See ND-5.
- **Answer.** The "n.a." proposal is declined. Missing values are shown as a dash, "—", as today (OD-13, OD-29),
  alone in the cell with a footnote naming the status. The no-dash rule applies to sentences only: presentation prose
  never uses an en or em dash. The other conventions stand as recommended (lead): dates "D Mon YYYY", Indian digit
  grouping, negatives with a hyphen-minus in red `#931621` (D-029).

### Q-43 Minimum table font size
- **Recommendation.** 9 pt default; 8 pt minimum for dense analytic tables (Quants fund list); otherwise paginate.
  **Proceeding on default.**

### Q-44 Observation slide text budget
- **Recommendation.** About 450 words per slide at 10 to 11 pt, continuing on a "(2/2)" slide rather than shrinking
  the font. **Proceeding on default.**

### Q-45 Performance sheet groups and columns
- **Question.** Where do ELSS, Dividend Yield, Contra and Value go (the brief's order drops them)? Global and Fund of
  Funds as their own groups? Remove the 2Y column from Debt MF only, or also from PMS and Direct Equity? Keep 10Y and SI?
- **Recommendation.** ELSS, Dividend Yield, Contra and Value inside "Diversified equity" with their own benchmark rows;
  Global and FoF as the last two groups; remove 2Y from Debt MF only; keep 10Y and SI. **Proceeding on default.**

### Q-46 Credit-rating buckets
- **Question.** In the proposed three buckets (Sovereign + AAA/A1+ + cash equivalents; Unrated; AA+ to B), where do
  non-credit items found in debt sleeves go (MF units, REITs and InvITs, deposits, gold and silver, equity)? Should
  derivative positions inside hybrid debt sleeves and D-rated segregated portfolios be separate lines? Keep the seven
  current groups as table detail?
- **Context.** N-1: "Derivatives" (36 hybrid schemes, up to 23.42% of a debt sleeve), "D", "ADR/GDR" and "A2+(SO)" fall
  into "AA & Below" today [IE E-37, §10].
- **Recommendation.** Three credit buckets plus two lines outside them: "Derivatives and hedges" and "Non-credit
  holdings"; "Default (D)" flagged inside bucket 3; the seven groups kept as detail in the table and workbook.
  **Proceeding on default.**

### Q-47 Scope of the debt sub-2% "Others" rule
- **Recommendation.** Applies to the issuer and sector charts and the rating-detail chart, with a note below the chart
  and full detail in the table; never to the three-bucket chart; never to equity sectors. **Proceeding on default.**

### Q-48 Fund IRR tree on screen and in the deck
- **Recommendation.** On screen yes, in section 5 (today it exists only in Excel); in the deck as an optional Annexure
  component. Contributors and laggards move to section 4 (Q-77). **Proceeding on default.**

## E. Calculations and policies

### Q-49 Gain definitions
- **Question.** OD-18 decided "market value minus invested value, everywhere". Reference deck A shows two gain figures
  (the KPI is unrealised gain; the holdings total includes realised gains on units sold earlier). Confirm that realised
  gains appear only where transactions support them, in a separately labelled column.
- **Recommendation.** Confirm. **Proceeding on default.**

### Q-50 Net equity for hedged hybrids
- **Question.** For arbitrage and balanced advantage funds, should look-through equity be net of hedges? OD-30(a) built
  gross equity, pending your answer.
- **Context.** Arbitrage equity sleeves are 65% to 80% of CMV (median 71%); this inflates effective equity, IPS
  compliance and equity analytics for books holding them [OP G-6].
- **Recommendation.** Allocations and analytics stay gross (OD-30a); the "effective equity" observation and IPS row show
  a second, labelled figure that excludes arbitrage funds' hedged equity. **Proceeding on default.**

### Q-51 Peer basis for risk ratios
- **Recommendation.** Category median everywhere (robust to outliers), labelled; today MF Analysis uses means and the AI
  Analyst medians. The pack's `categories.json` averages are shown only where labelled as averages.
  **Proceeding on default.**

### Q-52 Long-term capital gains exemption in the harvesting estimate (N-2)
- **Recommendation.** Apply the exemption per client (assessee) only when a capital-gains statement shows how much is
  used this year (E-141), or the analyst confirms it is unused; otherwise state "exemption not applied" on the slide.
  **Proceeding on default.**

### Q-53 IPS "Single AMC 0 to 25%" against the 20% house cap
- **Recommendation.** The house cap (20% of the MF book, OD-1) governs; the IPS row shows it.
  **Proceeding on default.**

### Q-54 Transition-plan bucket rule
- **Question.** Are the bucket thresholds (tax on a full exit at most 2.5% of value; more than 4% and the fund is sound)
  and the "sound fund" test (score above category average and positive 3Y alpha) fixed policy or per-review inputs?
- **Recommendation.** Per-review analyst inputs with these defaults, stored in the scenario. **Proceeding on default.**

### Q-55 AI Analyst in the new app
- **Question.** Port the rules-driven AI Analyst now (its weights are an unsigned proposal, KI-029), or hold it for the
  Phase 2 rebalancing engine?
- **Recommendation.** Port it in M8 as a labelled "draft proposal" that feeds the analyst's plan, excluded from the
  default deck until the weights are signed off. The constraints held on 4 Sep are Q-81. **Proceeding on default.**

### Q-56 OD-29 to OD-36: ANSWERED (D-022, 21 Oct 2026)
- **Question (as asked).** Accept OD-29 to OD-36 as built (CVS unallocated row, hybrid details, pro-rata apply plan,
  fund-house list, group products outside the cap, "AMC not given", file unit everywhere, Grand Total placement of
  redeemed funds)?
- **Answer.** You accepted all eight on 21 Oct 2026. It is recorded as **D-022**, merged to `main` in PR #7
  (`3a9491a`) with KI-124 (the empty Home deck) and the CR-0005 update. OD-32 (renamed fund houses as aliases) and
  OD-34 ("AMC not given") are in the next legacy fix batch, being built now as batch 2a, and are also built in M2.1;
  OD-35 comes with OD-19.
- **Action.** None. The as-built behaviour is the parity reference.

### Q-57 Advisor level
- **Question.** Does "advisor level" mean the base file's Distributor Name column? Should analytics and overlap re-base
  to one distributor, as the Cost tab's filter does? Should advisor-level views also show **returns** (transaction
  XIRR, benchmark XIRR, the IRR tree and contributors per distributor)?
- **Context.** Distributor-level IRR was built once ad hoc (25 Sep) and never became a feature; the IRR parser ignores
  the IRR file's DISTRIBUTOR column [PO §2.4 item 7] (E-142).
- **Recommendation.** Yes to all three: the IRR parser reads DISTRIBUTOR; flows without a distributor are shown as an
  "unassigned" line, never spread; a scope whose flows do not reconcile shows INSUFFICIENT EVIDENCE for XIRR.
  **Proceeding on default.**

### Q-58 Post-rebalancing views
- **Recommendation.** Post-rebalancing analytics, holding sheet and impact appear only in "Review with Rebalancing" mode
  with a valid plan (today they show the current portfolio under post-rebalancing titles). **Proceeding on default.**

### Q-59 Workbook inputs accepted on re-upload
- **Recommendation.** Review mode, IPS profile, Regular/Direct switch, expected returns (category and alternate
  products), inflation, expense-ratio overrides, rebalancing actions and amounts, observation text edits. Holdings and
  transactions are never accepted from the workbook (they come from client files). **Proceeding on default.**

### Q-60 XIRR in the workbook
- **Recommendation.** XIRR figures are engine values (the engine solves them by bisection) with the cash-flow table and
  an Excel `XIRR` check column; all other arithmetic is live formulas. **Proceeding on default.**

## F. Observation engine

### Q-61 Threshold table: ANSWERED (D-030, owner, 22 Oct 2026; was ND-6)
- **Question.** Approve the default threshold table in `observation-rule-bank.md` §3 (one place, versioned). Key values:
  small position 1.50%; label drift 65% large cap of the equity sleeve; top-two fund houses one third of the MF book;
  overlap pair 30% (high) and 50% (very high); top-10 stocks 60% (high) and 20% (dilution).
- **Context.** Deck B uses 1.5%, 2% and 3% for the same finding; the engine's thresholds were never approved [OP §6.1;
  PO §2.2]. Five rows of the rule bank's legacy table (§8) carry threshold changes that the parity ledger will record:
  the open-ended strength from 65% to 95% (L-S3, and the liquidity card L-C8), the overlap pair from 40% to 30%
  (L-W2, L-O3), and the debt high-quality phrase from 50% to 70% (L-C3).
- **Recommendation.** Approve as a set, including those changes; each later change is a versioned edit. The rules are
  built on these defaults. See ND-6.
- **Answer.** Approved with one change: a fund pair counts as overlapping from 35% (not 30%, not the legacy 40%);
  very high stays at 50%; the other changes stand, so L-W2 and L-O3 move from 40% to 35% (D-030).

### Q-62 Aggregation level of the small-position rule
- **Recommendation.** Per scheme across the family (Regular and Direct and all accounts merged); the 2% rebalancing floor
  stays separate. **Proceeding on default.**

### Q-63 Naming destinations in Review Only mode
- **Recommendation.** Review Only may say "consolidate" or "trim toward the cap" but names destination funds only in
  Review with Rebalancing. **Proceeding on default.**

### Q-64 House views
- **Recommendation.** "Index the large-cap core" and "strategic sleeves" appear only as dated blocks attached to a fired
  rule, never in every review; the "Nifty rarely negative over five to seven years" claim only with a computed
  statistic (from the monthly index data, D-023 point 2). **Proceeding on default.**

### Q-65 Market commentary inside observations
- **Recommendation.** Only a dated block quoted from that month's Market Update file; never named events inside an
  observation. **Proceeding on default.**

### Q-66 Fund size as a trigger
- **Recommendation.** Not in v1 (FUND-01 stays off) unless you set per-category AUM thresholds.
  **Proceeding on default.**

### Q-67 Hindsight wording
- **Recommendation.** Replace "missed opportunity ... could have substantially enhanced returns" with "right in
  direction but small in size" plus a strategic range. **Proceeding on default.**

### Q-68 Entity labels
- **Recommendation.** Observations refer to accounts by an analyst-set label ("Account 1", "Trust", "Company"), never by
  a person's name or honorific. **Proceeding on default.**

### Q-69 Drawdown and recovery slide
- **Question.** Is the drawdown comparison (reference deck B) required? Which index history source, and is the
  "multi-asset portfolio" the client's book or a model portfolio?
- **Decided by D-023 point 2 (22 Oct 2026).** The drawdown comparison is done on index data, not on the client
  portfolio's history, and you supply index return data every month. **Source confirmed on 22 Oct 2026 (owner):** the
  five Index TRI files already supplied each month in the month's `Index TRI` folder (D-023 addendum).
- **Recommendation.** **Proceeding on default** for the presentation: component C-43 and rule PERF-12 (M12) show, for
  the indices relevant to the review and for a blend of them at the review's current asset-class weights, the maximum
  drawdown, the peak and trough dates and the months to recover, labelled "index data; the blend uses today's weights
  and is not the portfolio's own history". The Index TRI files are parsed by header name; their columns are confirmed
  on the first files read.

### Q-70 Up-capture
- **Recommendation.** Weighted up-capture (deck A's before/after strip) only when the Screener pack supplies it; the
  in-house workbook has down capture only. **Proceeding on default.**

## G. Workflow and usage

### Q-71 Section usage
- **Question.** Which sections do analysts use in every review, which occasionally, and is the AI Analyst used? There is
  no usage record.
- **Recommendation.** A five-minute answer from two analysts; it orders M7 to M9. **Proceeding on default:** the order
  in the roadmap.

### Q-72 Family label and persistence
- **Question.** Should the analyst type the family name used on slides and file names (today it is guessed from the
  file name)? Should the logo and the holdings column choice persist per review, per session or across sessions?
- **Recommendation.** Editable family and entity labels per review; logo remembered per browser; column choice per
  review. **Proceeding on default.**

### Q-73 The "Actioanables" header
- **Question.** Is the deliberate misspelling still needed to round-trip into the team's own rebalancing workbook?
- **Recommendation.** Not in the new workbook (its own re-upload replaces the round-trip); unchanged in the legacy.
  **Proceeding on default.**

### Q-74 Phase 2 starting rules
- **Question.** Is reference deck A the follow-on of the previous owner's 6 Oct ad-hoc rebalancing slides? Should their
  rules (R1 to R7) and settings (overlap 45%, return gap 3 pp, small-position floor 0.60%, a gain cap per tranche,
  tranches 42 days apart) seed Phase 2? Can you obtain `Logic.txt`?
- **Recommendation.** Use them as documented inputs to the Phase 2 methodology, never as defaults, until you approve
  them. **Proceeding on default;** it concerns only M16.

### Q-75 Reaching the Screener from the office
- **Question.** Some automated requests to the Screener did not get through from this machine. Do analysts reach it
  reliably in their browsers?
- **Recommendation.** No action unless analysts report a problem; it affects opening the Screener link, not the
  dashboard (the data arrives as a pack). **Proceeding on default.**

## H. Added by the Phase 0 review (22 Oct 2026)

### Q-76 Monthly PRD and handover before M14
- **Question.** The brief asks for a monthly PRD and a handover refresh every completed cycle. Generation is automated
  only in M14. May each cycle until then, starting with the 2026-10 data month (files due 13 to 17 Nov, processed on the
  legacy pipeline), get a hand-written `docs/monthly-prds/YYYY-MM-Portfolio-Review-PRD.md` from a template (sections A
  to I) plus a `docs/HANDOVER.md` refresh, checked by a script for the sections and for privacy?
- **Recommendation.** Yes. The template and the check script are built in M1.1. **Proceeding on default.**

### Q-77 Section placement: contributors and laggards; the disclaimer input
- **Question.** The brief puts "contributors and laggards" in section 4 (Analytics and overlap) and a "disclaimer"
  input in section 1. The first draft put contributors in section 5 with the Fund IRR tree and left the disclaimer out
  of section 1. Confirm the brief's placement?
- **Recommendation.** Follow the brief: contributors and laggards in section 4 for every scope; the full IRR tree stays
  in section 5 with the holdings. Section 1 shows the disclaimer in use (version, date, source in the monthly folder)
  and accepts a session override only for a file whose fingerprint is on the approved list (an unapproved file is
  refused, so no unreviewed compliance text reaches a deck). **Proceeding on default.**

### Q-78 Capital-gains statement format: ANSWERED (D-032, owner, 22 Oct 2026; was ND-8)
- **Question.** The brief lists a capital-gains upload in section 1; the legacy page has none. Which statements will
  analysts upload (the registrars' capital-gains statements, the platform's realised gain report, or both), and can a
  blank or anonymised sample of each layout be supplied? Client files cannot be used to learn a layout.
- **Recommendation.** Supply one blank or anonymised sample per layout; only its header layout is recorded and the
  tests use a synthetic statement built from it. Until then the slot, the `RealisedGain` model, the reconciliation with
  IRR-derived gains and the statuses are built and tested on synthetic statements, and realised gains are labelled
  "derived from transactions". The statement, when supported, is the source of record for a financial year (it carries
  the issuer's lot matching and grandfathered cost). See ND-8.
- **Answer.** Analysts upload capital-gains statements in a template of our choosing, as with the base-file template;
  the owner's sample format may inform it but is not required (D-032). The new app defines the template (one row per
  realised lot; columns, units and dates proposed in `docs/DATA_DICTIONARY.md` §5.17 and fixed in M7), offers it blank
  for download and parses only it. The statement stays the source of record for a financial year.

### Q-79 Ownership: joint holders and the tax assessee
- **Question.** Will base files carry holder columns (first, second and third holder, guardian, mode of holding)? For
  tax, may lots be grouped by the first holder as the assessee?
- **Context.** The base file has a client name, folio and distributor per row only (verified in the code). The brief
  asks for "accounts, folios, ownership".
- **Recommendation.** Read holder columns when present; otherwise the client is the sole holder and joint holders are
  NOT AVAILABLE IN SUPPLIED DATA. Group tax lots by the first holder, to be confirmed with the tax adviser together
  with OD-28. Holder names never appear on slides. **Proceeding on default.**

### Q-80 Undecided legacy UI items (the previous owner's list, item 14)
- **Question.** Four items were never decided: (a) merging name variants of the same portfolio in client statements;
  (b) whether hybrid debt sleeves count in the average YTM and modified duration; (c) issuer normalisation of the
  top-30 issuer lists; (d) Current vs Sample "Reset to Actual" and "Re-seed from plan": one button or both?
- **Recommendation.** (a) Merge only through product-bank pins (never by fuzzy name); (b) keep today's headline (pure
  debt funds) and add a second, labelled figure including hybrid debt sleeves; (c) one issuer table, with the top-30
  truncation reported as coverage (KI-039); (d) keep both buttons, as today. **Proceeding on default.**

### Q-81 AI Analyst constraints held on 4 Sep
- **Question.** The minimum-investment constraint (coded, inactive) and a soft AMC target were put on hold on 4 Sep.
  Port them, or drop them?
- **Recommendation.** Port both as named constraints in `data/owner/ai-analyst.json`, off by default, so today's plan
  is unchanged and Phase 2 can switch them on (E-145). **Proceeding on default.**

### Q-82 Tax-rules maintenance and the compliance summary
- **Question.** The previous owner never built a tax-rules upload or published the promised tax-rules summary for
  compliance sign-off. Should rules change through a Tax Rules workbook in the monthly folder (reviewed in the
  monthly pull request), with a generated summary for compliance, rather than a per-review upload slot?
- **Recommendation.** Yes: rules are firm-wide, so they belong to the monthly update, not to a review; the summary is
  generated from `data/owner/tax-rules.json` with effective dates (E-144). **Proceeding on default.**

### Q-83 Observation areas the legacy never generated
- **Question.** Fund-house quality, tax efficiency, rebalancing history and themes were part of the previous owner's
  observation catalogue but never generated. Build them as rules (AMC-01, TAX-01, REBH-01, THEME-01 in the rule bank)?
- **Recommendation.** Yes, each with the data gate the rule bank states (score coverage; an IRR file or a
  capital-gains statement; the transaction history; canonical categories). **Proceeding on default.**

### Q-84 The Claude Artifact design reference: ANSWERED (the artifact was read, 22 Oct 2026)
- **Question (as asked).** May the brief's fourth context item, a monthly data upload console, be shared so that the
  evaluation in `03-architecture.md` §13.1 can be confirmed?
- **Answer.** It was read. It is the "One Digital Reckoner Console", a monthly upload tool with the flow Upload,
  Validate, Preview, Review, Approve, Final Excel, processing in the browser only, with no portfolio-review layout or
  visual spec. Its stage flow is used for section 1 uploads and the monthly approval (`03-architecture.md` §13.1);
  the screen layout follows the nine-section structure and the deck design system.

### Q-85 Client use of new-app outputs before switch-over: ANSWERED (D-024, lead under D-033, 22 Oct 2026; was ND-9)
- **Question.** The first draft let analysts take individual new-app slides into legacy client decks before parity.
  That would mix two engines and possibly two data vintages in one client deck. Confirm instead that nothing exported
  from `/next/` is used for a client before switch-over?
- **Recommendation.** Confirm. Exports from a preview build carry a "Preview build, not for client use" marker. An
  earlier release would be a recorded decision for a whole section at once (same engine and vintage for every figure
  in that section). See ND-9.
- **Answer.** Confirmed (D-024): nothing exported from `/next/` is used for a client before switch-over.

### Q-86 Branch protection on `main`: ANSWERED (D-033, owner, 22 Oct 2026; was ND-10)
- **Question.** May a GitHub ruleset on `main` block force-pushes and branch deletion and require the `checks` and
  `next` jobs? It is already listed as pending in `docs/DEPLOYMENT.md`.
- **Recommendation.** Yes. AC-22 detects a force-push on the remote even without it (ancestry of every reported SHA),
  but the ruleset prevents one. No change to repository settings until you approve. See ND-10.
- **Answer.** Not required: no ruleset. The owner gives Claude full charge of GitHub and the dashboard (D-033).
  `CLAUDE.md` rule 8 still applies, and AC-22 checks the history for force-pushes.

## Change log of this document

### Third revision of 22 Oct 2026: the owner's answers to ND-1 to ND-10

The owner answered ND-1, ND-5, ND-6, ND-8 and ND-10, confirmed the index data and gave Claude full charge of GitHub
and the dashboard; the lead decided ND-2, ND-3, ND-4, ND-7 and ND-9 under that charge. Recorded as D-024 to D-033.

| Item | What changed | Where |
|---|---|---|
| A1 | Q-06, Q-09, Q-10, Q-16, Q-33, Q-35, Q-42, Q-61, Q-78, Q-85, Q-86 marked ANSWERED with their decisions; the summary now counts 21 answered, none open with the owner, 65 on default | this document; `owner-decisions-new-build.md` |
| A2 | D-024 to D-033 recorded (D-026 and D-027 with them); the "proposed" decision table of the architecture becomes a record | `docs/DECISIONS.md`; `03` §1, §21 |
| A3 | ND-1: the MF Screener data pack slot in section 1, kept in the browser's IndexedDB until a newer pack; cycle date in the sidebar; absence messages; never embedded or committed | `03` §4, §6.6, §6.9, §7, §13, §17; `05` E-126; `06` DS-S1, DS-S2; `07` M10, M11; `08` AC-16, §5.6; `PRD` R-IN-10, R-IN-12; `DATA_DICTIONARY` §5.16; `MONTHLY_UPDATE_GUIDE` |
| A4 | ND-5: the dash stays as the missing-value marker; no en or em dash in sentences; every "n.a." proposal replaced | `03` §1 A8, §6.4, §10, §14; `DATA_DICTIONARY` §2; `deck-design-system.md` §2.3, §2.5, C-07, §8; rule bank §5; `PRD` §7, R-OB-2; `04` §6; `08` AC-01, §5.5, §5.6 |
| A5 | ND-6: thresholds approved; overlapping fund pair from 35% (very high 50%); legacy L-W2 and L-O3 move from 40% to 35%; the overlap heat band boundary follows | rule bank §3, DIV-04, DIV-05, §8; `03` §10, §11; `PRD` §6; `deck-design-system.md` §2.1; `08` §5.6 |
| A6 | ND-7: border 0.5 pt `#D9D9D9`, Actionables tan `#DBC8B2` with the action word | `deck-design-system.md`; `05` BR-9.4, BR-9.5; `07` M3, M8 |
| A7 | ND-8: the capital-gains template (proposed columns for M7) and its parser; no per-issuer layouts | `03` §6.10, §7, §22; `DATA_DICTIONARY` §5.5, §5.17; `07` M7; `08` AC-18, fixtures, §5.6; `05` E-141; `06` DS-C8; `PRD` R-IN-6 |
| A8 | ND-10 and full charge: no ruleset; AC-22 stays the force-push check | `08` AC-22, §6; `docs/DEPLOYMENT.md` |
| A9 | Index data: the five Index TRI files of the monthly inbox (D-023 addendum) | Q-69; `03` §7, §13, §22; `06` DS-H3; rule bank §9; `07` M11, M12 |
| A10 | The monthly upload list ("Files the owner supplies each month") | `docs/MONTHLY_UPDATE_GUIDE.md` |
| A11 | Q-01: the owner confirmed on 22 Oct 2026, "yes, the licence covers all Accord files". Every Accord file is class P and tracked in `monthly_updates/YYYY-MM/` (the non-monitor ones in `other-approved/`); the default that kept the analytics, expense ratio, listed equity, fund manager and exit load files private, proven by hash, is withdrawn | Q-01; `docs/DECISIONS.md` D-023 point 1, D-026 point 1; `06` publication classes, §2; `09` §2, §5; `data-source-inventory.md` status; `docs/MONTHLY_UPDATE_GUIDE.md`; `docs/MONTHLY_REFRESH.md`; `docs/DEPLOYMENT.md`; `CLAUDE.md`; `CR-0006` |
| A12 | The MF Screener is described only as an invitation-only tool that requires sign-in and refuses to be framed; the legacy `FUND_RANKS` block (fund ranks issued 15 Aug 2026) is an open item in `docs/PROJECT_STATE.md`; the Screener data pack is class N (D-026 point 1); citations of `mf-screener.md` point to its five sections | Q-01, Q-06, Q-11, Q-18, Q-19, Q-30; `owner-decisions-new-build.md` ND-1; `01`, `02`, `03`, `05`, `06`, `09`; `data-source-inventory.md`; `docs/DECISIONS.md` D-026; `docs/PROJECT_STATE.md`; `docs/MONTHLY_UPDATE_GUIDE.md`; `CHANGELOG.md` |

### Second revision of 22 Oct 2026: decisions taken after the Phase 0 documents were written

Files are in `docs/new-build/` unless named otherwise (the PRD draft is committed as `docs/PRD.md`).

| Item | What changed | Where |
|---|---|---|
| R1 | Documents location is `docs/new-build/` (CR-0006), with the investigator files in `docs/new-build/inputs/`; the sanitised brief is `docs/new-build/00-owner-brief.md` (PR #8), so `brief-public.md` is no longer committed | every deliverable that named the old location; `07` M1.1; `09` §1, §3, §6 |
| R2 | D-022 (PR #7) and D-023 (22 Oct) are taken: proposed new-app decisions are D-024 to D-029. The earlier "build beside the legacy" proposal is folded into D-024 (the new build itself is recorded by CR-0006) | `03` §21 and every cross-reference; `01`, `05` BR-0.3, `07`, `09` §6 |
| R3 | M1.1 no longer merges the records branch, creates CR-0006 or files KI-124 (all done on `main`, `8cb320d`) | `07` M1.1, §3; `01` §2.1, §5.3; `08` §5.3; `09` §6 |
| R4 | Answered: Q-01, Q-02 (D-023), Q-03, Q-11 (the brief), Q-18 (the data pack contract), Q-27, Q-28 (the data pack), Q-36 (D-023 point 3 and the brief), Q-56 (D-022, merged), Q-84 (the artifact was read) | this document |
| R5 | `owner-decisions-new-build.md` written: ND-1 to ND-10; every other open question marked "proceeding on default"; the Blocking table replaced | new file; this document |
| R6 | MF Screener data pack (`pr-datapack-v1`) integrated as a data source: inventory row, ingest module, session load, monthly validation and fingerprint, historical holdings, FoF `mf_units`, stock prices, tests and fixtures | `06` DS-S2, §8, §11; `03` §4, §6.3, §7, §9, §13, §17; `05` E-126; `07` M10, M11, M12; `08` §3, §4, §5.5; `02`, `04` |
| R7 | D-023 methods: MF portfolio 3Y and 5Y weighted returns with source order and coverage footnote (E-147); direct-equity CAGR from month-end prices with exact anniversaries and footnoted exclusions (E-148) | `03` §7, §8; `02`, `04`, `05` §D; `07` M3, M10; `08` §5.5; `PRD` R-HP-6, R-HP-7, §6; `deck-design-system.md` C-20, C-22, C-31; rule bank PERF-10 |
| R8 | Drawdown comparison on index data (E-149, C-43, PERF-12 unblocked in M12) and the index data as a monthly role | `03` §7, §8, §13; `06` DS-H3; `07` M11, M12; `08` §5.5; `PRD` R-AN-11; `deck-design-system.md` C-43, §6; rule bank PERF-12, §9 |
| R9 | Privacy: folder maps of private storage and the "Desktop copy" reference removed; the Reckoner Console brand named (a Centricity brand) | `01` §2.4; `06` DS-M9; `data-source-inventory.md` header, §1, §2, §8, §12; Q-23, Q-26 |
| R10 | Counts recounted by script: `02` 219 rows (W 61, P 97, B 17, M 34, D 10; fix 79, as-is 35, rewrite 34, new 47, port logic 12, port design 10, keep 1, drop 1); `05` 376 rows (A 73, B 40, C 56, D 50, E 31, F 93, G 24, H 9), all "not started"; 86 questions (10 answered, 11 in ND-1 to ND-10, 65 proceeding on default) | `01` §1, `02` §1, §2, `04` §1, `05` §I, `PRD` §13, this document |

### First revision of 22 Oct 2026: answering the Phase 0 review (items P1 to P5, G1 to G16, C1 to C10)

"Investigator files" are the eight files now in `docs/new-build/inputs/`. Rows that the second revision superseded are marked.

| Item | What changed | Where |
|---|---|---|
| P1 | Two house-logo labels removed (a firm name from a client deck) | `inventory-ui-workflows.md` U-07 |
| P2, C2 | Local folder map, client-folder descriptions and a local export path removed; product material described by kind only; "client-named folders" generalised; M1.1 commits only the revised files after the private scan | `data-source-inventory.md` header, §1 items 10 and 12, §2.3, §2.4, §8, §11; `06` DS-C7; `07` M1.1; `09` §1 |
| P3 | Link containing an individual's GitHub user name replaced by "the release notes linked from the npm package page" | `technology-evaluation.md` §6 |
| P4 | Client-derived example figures replaced by placeholders | `observation-patterns.md` (three places) |
| P5 | Public copy of the brief written (superseded by R1: the sanitised brief is `docs/new-build/00-owner-brief.md`) | `brief-public.md` (working copy, not committed) |
| G1 | Capital-gains statement: DS-C8, ingest module, realised-gain model and reconciliation, Section 1 input, E-141, AC-18 cases, fixtures, Q-78 | `06`, `03` §6.1, §6.7, §7, §8, §14, `PRD` R-IN-6, R-TX-1, `02`, `04`, `05`, `07` M7, `08` |
| G2 | Mandatory Review Only facts F1 to F11 and the three findings; mandatory RB slots; AC-03 and AC-04 assert presence | `03` §11, `PRD` R-OB-5, R-OB-6, §8, `deck-design-system.md` C-07 and blocks, rule bank §4 item 9, `08` AC-03, AC-04, `07` M5, M8 |
| G3 | `driver` and `swot` on rules and records; root-question taxonomy; SWOT composition; complete legacy mapping L-C1 to L-T7 with parity classes; new rules POS-07 to POS-09, ALL-08, ALL-05/CON-03/PERF-02/CON-04 pointers, PERF-06 per tenor; corrected open-ended threshold row | `observation-rule-bank.md` §1, §1.1, §2, §3, §4, §6, §8, §10; `03` §10; `05` E-44, E-45; `08` §5.4; Q-61 |
| G4 | Hand-written monthly PRD and handover every cycle from 2026-10; template and check script in M1.1; Q-76 | `07` §1, M1.1, M11, §5; `03` §13; `09` §1, §4; `PRD` R-MU-4; `08` AC-23, §7 |
| G5, C4 | Pre-push scanner (text mode), privacy scan, docs links, release check and monthly PRD check in M1.1; traceability in M1.3; binaries in M11; CI job `next` from M1.1; AC-21 gate split | `07` principle 5, M1.1, M1.3, M11; `03` §17, §18; `08` §2, AC-21, §6, §7; `09` §1, §6; `04` E-136; `05` E-136, BR-1.1, BR-1.6 |
| G6, C6 | Typed formula builder, in-house formula evaluator in CI, evaluation after edits, Excel recalculation as a local differential check whenever an exporter changes | `03` §14; `08` §2, §7, §8, §9; `07` M1.4, M6; `technology-evaluation.md` §5.3 item 6 |
| G7 | QA for watermarks, overlaps, stale client data after a family switch, text-box budget, redundant shapes, duplicated metrics, 9 pt by role token | `deck-design-system.md` §2.2, §5, §8; `08` AC-20; `07` M9; `03` §15; `05` BR-14.1 |
| G8 | Claude Artifact design reference evaluated (stage flow adopted for section 1 and the monthly approval); Q-84 (superseded by R4 and R9: the artifact was read and is named) | `03` §13.1; `01` §2.4, §8; `06` DS-M9; `PRD` R-IN-9, §9 |
| G9 | Sub-feature tests for U-26, U-27, U-29, U-30, U-35; workflow tests W-1 to W-9 and parity rows (section H of `05`); M15 drill | `08` §2, §3.1, §5.3.1; `05` C rows, §H; `07` M4, M7, M8, M15; `02` header |
| G10 | Legacy pipeline parity: synthetic CI test, private re-derivation of 2026-09, first live month run by both | `03` §13 step 10; `08` §2, §5.4, §8; `05` E-129; `07` M11; `04` §4; `PRD` R-MU-5 |
| G11 | E-142 distributor returns (Q-57 widened), E-144 tax rules (Q-82), E-145 AI constraints (Q-81), E-146 catalogue rules (Q-83), undecided UI items (Q-80) | `02`, `04`, `05`, `03` §6.5, §20, `06`, rule bank §6.9, `07` M3, M7, M8 |
| G12 | "One dimension, one basis" rule for charts and tables; AC-07 and AC-08 assert it | `03` §8, §9 rule 8; `deck-design-system.md` §2.4, §5; `PRD` R-AN-9; `08` AC-07, AC-08; `07` M4 |
| G13 | Contributors and laggards in section 4, tree in section 5; disclaimer input in section 1; Q-77 | `PRD` §3, R-AN-10, R-IN-7; `deck-design-system.md` C-24, §6; `04` U-28; `05` U-28, E-29 |
| G14 | Baseline tag in M1.1 scope and acceptance | `07` M1.1; `09` §7; `05` BR-0.3 |
| G15 | AC-22 remote force-push check (ancestry and the repository activity list) and Q-86; AC-23 checks the handover refresh | `08` AC-22, AC-23, §6; `07` M1.2, M14, M15 |
| G16 | Ownership model (clients, accounts, folios, holders, assessee); E-143; Q-79 | `03` §6.1, §6.3, §6.8, §7; `06` DS-C1; `PRD` R-IN-8; `02`, `04`, `05`, `07` M1.3, `08` fixtures |
| C1 | D-022 and KI-124 recognised (then on an unmerged branch; superseded by R2 and R3: merged in PR #7, new decisions D-024 to D-029); Q-56 answered; N-1 to N-10 to be filed from KI-125; branch counts 24 local, 7 remote | `01` §1, §2.1, §5.3; `03` §21; `07` M1.1; `09` §6; `05` BR-0.3; `08` §5.3; Q-56 |
| C3 | Proposed D-024 supersedes D-007 in part (Pages publishes two files) | `03` A5, §18, §21; Q-10; `07` M1.2; `09` §6 |
| C5 | AC-22 CI-blocking from M1.2 in both plans; M15 re-runs it | `07` M1.2, M15; `08` AC-22 |
| C7 | No client use of `/next/` outputs before switch-over; build channel marker; Q-85 | `07` principle 2, M1.4, M3, §5; `03` §15, §18; `04` §5; `PRD` §11 |
| C8 | Q-16 made a decision point for any change to the CR-0005 batch plan; legacy keeps CR-0005 and D-022 items; OD-32 and OD-34 in both builds | Q-16; `03` intro, §5, §18, §21; `04` §4, §5; `07` principle 1, M2.1, §3, §5; `09` §1; `PRD` §13; `08` §9; `01` §7 |
| C9 | Sheet 3 keeps the OD-22 name "Holdings (as loaded)"; Q-42 states that "n.a." replaces the OD-13 and OD-29 dash in the new app only | `03` §14; `04` E-76; `05` E-76; `07` M1.4; Q-42; `01` §7 |
| C10 | Writer spike size corrected to 94 lines (9,844 bytes); the review's re-run of the legacy suites recorded as the evidence | `03` A3, §22; `technology-evaluation.md` §5.2; `01` §3 |
| Counts | Recounted after the first revision (superseded by R10) | `01` §1, `02` §1, §2, `04` §1, `05` §I, `PRD` §13 |
