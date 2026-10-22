# Legacy capability inventory, part 2: UI and analyst workflows

Phase 0 deliverable (owner's brief §0.2, "existing capability inventory"). Part 2 covers the user interface script
(`11_app_ui.js`), the boot script (`12_boot.js`), the page shell, and every analyst interaction, with the exports each
one feeds. Part 1 (engine, parsers, data) is a separate inventory; this file refers to it only where a UI feature
depends on it.

- **Baseline inspected:** repository `productsteamcentricity/portfolio-review-dashboard` (local clone), branch
  `main`, commit `782794f` (index.html MD5
  `EF2FF4F1…`, the build after PR #6). Read-only.
- **Code references** are to the reading copies made by `node tools/extract-blocks.js` (`.blocks/`, git-ignored),
  e.g. `11_app_ui.js:365`. Line numbers are valid for `782794f` only.
- **Stable ids:** U-01 … U-56. Ids are never reused; a later inventory adds U-57 onwards.
- **Privacy:** synthetic data only. No client, family, person or firm names from client material.

## How this was verified

| Method | What it covers | Marked in the text as |
|---|---|---|
| Reading the shipped code in `.blocks/` | every entry | *(code)* |
| A headless probe (`phase0/legacyUi-scripts/probe-slide-groups.js`) that loads the **shipped** engine and exporters out of `index.html` through `tools/engine-host.js`, builds the synthetic book of `tools/make-sample-base.js` in memory, and builds the deck once per slide-group key, plus the workbook | slide counts per group, the empty Home deck, the workbook's sheet list | *(probe)* |
| The repository's records: `docs/KNOWN_ISSUES.md`, `docs/audits/2026-10-19-full-audit.md`, `docs/audits/2026-10-19-decisions.md`, `docs/TESTING.md`, `docs/HANDOVER.md`, `docs/previous-owner/` | status evidence, owner decisions, analyst use | *(KI-nnn / OD-nn / doc)* |

**Not done:** no browser session was run for this inventory (the page was not served or clicked). Every on-screen
behaviour below is read from the code; where the earlier audit reproduced it in a browser the KI says so. The probe
cannot reach groups whose content is computed in the UI script (see U-53), so their headless counts understate the
browser.

**Status key** (brief §0.2): **working** · **partial** (works with known defects or gaps) · **broken** (the output is
wrong or missing) · **missing** (the capability does not exist) · **dependent** (needs material that is not available).

**Reuse key:** **port logic** (keep the calculation, move it into the shared model, add tests) · **port design** (keep
the behaviour and layout idea, rebuild the code) · **fix then port** (a defect must be fixed first, with a test) ·
**rewrite** (rebuild from the requirement; legacy is reference only) · **drop**.

**Daily use:** "daily" means the documents describe it as part of every review (no usage telemetry exists; see
"Analyst workflows" at the end).

---

## Summary table

| Id | Capability | Status | Daily | Reuse |
|---|---|---|---|---|
| U-01 | App shell: three columns, stacked sections | working | yes | port design |
| U-02 | Right-hand section nav, scroll-spy, Home button | working | yes | port design |
| U-03 | Status line and toolbar meta | partial | yes | rewrite |
| U-04 | Base-file upload and removal | partial | yes | fix then port |
| U-05 | Portfolio as-on date picker | partial | yes | fix then port |
| U-06 | Base-file template download | partial | occasional | port design |
| U-07 | Logo choice (two house logos or upload) | partial | yes | port design |
| U-08 | Daily MF Monitor upload | broken | occasional (OD-11) | fix then port |
| U-09 | Direct MF Monitor upload | broken | occasional (OD-11) | fix then port |
| U-10 | SIF Monitor upload | partial | occasional | fix then port |
| U-11 | PMS / AIF Analytics (Client SOA) upload and template | partial | per review with PMS/AIF | fix then port |
| U-12 | Bonds / Debt Analytics upload and template | partial | per review with bonds | fix then port |
| U-13 | IRR Transactions upload | partial | yes | fix then port |
| U-14 | Market Update slides upload | broken (×) | monthly | rewrite |
| U-15 | Data-date display | partial | yes | rewrite |
| U-16 | Home tab | partial (screen) / broken (export, KI-124) | yes | rewrite |
| U-17 | IPS Profile tab and profile selector | broken | yes | fix then port |
| U-18 | Asset Allocation tab | partial | yes | port logic |
| U-19 | Distributor Allocation tab (advisor level) | partial | yes | port logic |
| U-20 | Client Allocation tab | partial | yes | port logic |
| U-21 | AMC Allocation tab | partial | yes | fix then port |
| U-22 | Observations and SWOT tab | partial | yes | port logic (seed for the observation engine) |
| U-23 | Holdings tab and presentation-column chips | partial | yes | fix then port |
| U-24 | Analytics tab: equity and debt look-through | partial | yes | fix then port |
| U-25 | Analytics scope selector (Family / Client) | partial; advisor scope missing | yes (multi-client families) | port design |
| U-26 | Overlap tab: matrix, selection, threshold, PNG | partial (screen) / broken (deck) | yes | fix then port |
| U-27 | Portfolio Cost tab: plan, distributor, ER overrides | broken | yes | fix then port |
| U-28 | Fund IRR tab (contributors and laggards) | partial | yes (with IRR) | port logic |
| U-29 | Current vs Sample tab | partial | yes | fix then port |
| U-30 | MF Analysis tab and rationale modal | broken | yes | fix then port |
| U-31 | Taxation tab and scope strip | broken | yes (with IRR) | fix then port |
| U-32 | Centricity AI Analyst tab | partial | unknown | fix then port |
| U-33 | AI Analyst "Apply plan to Portfolio Rebalancing" | working | unknown | port logic |
| U-34 | Rebalancing: action boxes and fund picker | working | yes (when rebalancing) | port design |
| U-35 | Rebalancing worksheet table | partial | yes (when rebalancing) | port logic + rewrite UI |
| U-36 | Already-held detection for proposed funds | working | yes (when rebalancing) | port logic |
| U-37 | Rebalancing Holding Sheet | partial | yes (when rebalancing) | port logic |
| U-38 | Post-Rebalancing Analytics | partial | yes (when rebalancing) | port logic |
| U-39 | Rebalancing Impact (current vs post) | partial | yes (when rebalancing) | port logic |
| U-40 | Post-Rebalancing Overlap Matrix | partial (screen) / broken (deck) | when rebalancing | fix then port |
| U-41 | Performance tab and Regular / Direct toggle | partial | yes | fix then port |
| U-42 | Performance: Proposed Funds block | partial | yes (when rebalancing) | port logic |
| U-43 | Disclaimer | working | yes | port design (asset) |
| U-44 | Thank You | working | yes | port design (asset) |
| U-45 | Per-tab "Download slide (PPTX)" | partial; broken for Home (KI-124) | yes | rewrite |
| U-46 | Slide picker | partial | yes | rewrite |
| U-47 | Full PowerPoint export | partial | yes | rewrite on a manifest |
| U-48 | Excel workbook export | partial | yes | rewrite |
| U-49 | Presentation flow and deck order | partial (KI-014) | yes | port design |
| U-50 | Per-family state reset | partial | yes (every second family) | port design + extend |
| U-51 | localStorage use | broken (persists across families) | yes | rewrite (OD-10) |
| U-52 | Cross-tab couplings and render order | working (fragile) | implicit | rewrite |
| U-53 | UI-scope calculations handed to exporters through window globals | working (fragile, untestable) | implicit | rewrite |
| U-54 | HTML escaping of workbook text | broken (KI-008) | implicit | rewrite |
| U-55 | Offline, no-network operation | working | implicit | keep as a requirement |
| U-56 | Renderer error isolation | partial | implicit | rewrite |

---

## A. Shell and navigation

### U-01 App shell: three columns, stacked sections
- **Purpose:** one-page analyst workspace: inputs on the left, the review in the middle, navigation and slide picking
  on the right.
- **Location:** `html_shell.html:340-417`; `11_app_ui.js:425-534` (`renderAll`); sidebar collapse
  `12_boot.js:10-29`.
- **Inputs:** none.
- **Behaviour:** all 20 sections (`TABS`, `11_app_ui.js:312`) render one under the other; the DOM order is the scroll
  order and the deck order (U-49). A legacy tab strip `#tabs` is still built (`:432-437`) but hidden
  (`html_shell.html:408`, `display:none`); its buttons switch an `.active` class nothing uses. The left sidebar
  collapses on desktop and slides in on screens ≤ 768 px. Cambria throughout; chrome `#F2F0EC`.
- **Outputs:** screen only.
- **Status:** working.
- **Limitations:** every upload, as-on change or reference reset re-renders all 20 sections. The hidden tab strip is
  dead UI.
- **Tests today:** TESTING §4 step 4 (every `#s-home` … `#s-thank` has content), manual.
- **Tests needed:** a render test per section on a synthetic book (no console error, non-empty, figures equal the
  model); layout checks at desktop, tablet and phone widths.
- **Reuse:** port design (single page, logical sections, right nav; brief Phase 3 asks for nine sections).

### U-02 Right-hand section nav, scroll-spy and Home button
- **Purpose:** jump to any section; see where you are; host the slide picker (U-46).
- **Location:** `11_app_ui.js:444-515`.
- **Behaviour:** "⇧ Home" scrolls to the top; a "SECTIONS" label; one header per section (Portfolio Update, Portfolio
  Holdings & Analytics, Rebalancing Opportunities, Annexure, `:306-311`); one row per tab, with the label scrolling to
  its section and a separate checkbox (U-46). Home has a label and no checkbox (`:473-478`). A single-distributor or
  single-client family shows "Single Distributor" / "Single Client" instead of that tab, and the section is hidden
  (`:430-441`, `:470-471`). Extra slide groups show as indented rows (U-46). Scroll-spy highlights the visible
  section (`IntersectionObserver`, `:504-515`).
- **Outputs:** screen.
- **Status:** working.
- **Limitations:** Disclaimer and Thank You appear without a section header (they belong to no section). The AI
  Analyst row sits under Rebalancing Opportunities while its slides follow the Annexure divider (KI-014).
- **Tests today:** none automated.
- **Tests needed:** nav lists every rendered section once, in flow order; hidden single-entity sections are not
  listed as slides.
- **Reuse:** port design.

### U-03 Status line and toolbar meta
- **Purpose:** tell the analyst what loaded, what did not match, what was cleared, and where exports went.
- **Location:** `11_app_ui.js:51` (`setStatus`), `:79-85`, `:65`; toolbar `html_shell.html:397-401`.
- **Behaviour:** after a load: "Loaded N holdings · C client(s) · CMV …" plus, in red, every unmatched holding by
  name; after a family switch, the uploads that were cleared (KI-001); export results and failures; the CVS export
  warning (KI-067). The meta label reads "— <family>, as on <date>".
- **Status:** partial: the status line is one HTML string, overwritten by the next message; names are inserted
  unescaped (KI-008); several data-quality facts the audit wants surfaced (KI-057 holdings with no CMV, KI-074 wrong
  sheet) are not reported.
- **Tests today:** TESTING §4 step 4 checks the load message by eye.
- **Tests needed:** a structured import report (counts, unmatched, excluded, cleared) asserted in tests.
- **Reuse:** rewrite as the brief's import-status panel (Phase 3 §1, Phase 13 severities).

---

## B. Sidebar inputs

### U-04 Base-file upload and removal
- **Purpose:** load one family's holdings workbook; everything else derives from it.
- **Location:** `html_shell.html:354-365`; `11_app_ui.js:11-29` (drop zone, ×), `:53-70` (`handle`), `:71-86`
  (`loadModel`), `:286-294` (`deriveFamily`, `deriveDate`).
- **Inputs:** one `.xlsx`/`.xls`; sheet "Base File" or the first sheet; header row and columns found by the engine
  (`E.parseBaseRows`, part 1).
- **Behaviour:** click or drag-and-drop. If no rows parse: "No holdings rows found…" and the previous family stays.
  Otherwise, when a family was already loaded, `resetFamilyState()` runs first (U-50). The **family label** comes from
  the file name ("Portfolio Update_ … Family") or else from the last word of the first client's name + " Family"
  (`:286-293`); there is no field to edit it. The as-on date comes from the picker (U-05), else the file name, else
  today. `E.computeReview` builds the model; all sections render; the page scrolls to the top. × clears the model,
  runs the family reset, empties the sections and hides the toolbar.
- **Outputs:** the model behind every section and export; file names of every export use the family label and date.
- **Status:** partial.
  - KI-089 (reproduced): picking the same file again (after × or after editing it) fires no change event, so a
    corrected file is silently ignored; the input value is never reset (`:16`).
  - KI-074: wrong sheet / header row gives a misleading error. KI-057: rows with no CMV are dropped silently (OD-8:
    exclude and list). KI-005: XIRR columns stored as fractions read 100× too small (OD-3: ask the analyst).
  - The "no rows" message says "19 standard columns"; the template has 18 (U-06).
- **Tests today:** `smoke-review.js` (parse, units, unmatched surfacing); `tools/browser-checks/family-isolation.js`
  (load, replace, remove); `tools/regression/KI-007-blank-invested.js`.
- **Tests needed:** re-pick of the same file; wrong sheet; header in row 6; fraction XIRR file; editable family label;
  a real file-chooser path (the browser check dispatches a synthetic event, which is why KI-089 escaped it).
- **Reuse:** fix then port (parser is part 1; the upload UI is rewritten as section 1 "Uploads and inputs").
- **Daily:** yes (HANDOVER §1; previous-owner HANDOVER §1).

### U-05 Portfolio as-on date picker
- **Purpose:** the "Portfolio as on" date printed on every slide, footnote and file name.
- **Location:** `html_shell.html:367-370`; `11_app_ui.js:33-39`.
- **Behaviour:** defaults to today in IST; a change recomputes the whole model when a file is loaded. Requested by
  the owner (DECISIONS_LOG, 26 May: template download and IST picker overriding the file-name date).
- **Status:** partial.
  - KI-087 / audit NEW-41 (reproduced): clearing the field makes the engine fall back to a hard-coded "20 May 2026"
    (`07_engine.js:936`); typing a year recomputes on each keystroke.
  - KI-019 (reproduced): any date change wipes the rebalancing plan and the slide-picker ticks because the plan's
    fingerprint includes the date (`rbTag`, `11_app_ui.js:2482-2486`, reset at `:2889-2890`); the nav still shows the
    old ticks. **OD-24: keep the plan and picks on a same-family date change.**
- **Tests needed:** empty / invalid / partial dates rejected; plan and picks survive a date change (OD-24).
- **Reuse:** fix then port.
- **Daily:** yes.

### U-06 Base-file template download
- **Purpose:** give advisers a blank workbook with the expected headers.
- **Location:** `11_app_ui.js:40-48`.
- **Behaviour:** writes "Centricity Base File Template.xlsx", sheet "Base File", 18 headers (Client Name, Instrument
  Name, Purchase Date, AMC, Liquidity, Category Name, Asset Name, Product Name, Distributor Name, Units, Invested /
  Market / Gain in ₹ and Cr., XIRR (%), BMXIRR (%)).
- **Status:** partial: it omits Folio No, Allocation (%) and Avg. Holding Days, which the 19-column spec lists; a file
  built from it exports a blank Allocation column (KI-093 / NEW-47; OD-22 renames the sheet and computes values).
  Several headers carry a trailing space.
- **Tests needed:** a file made from the template loads with zero warnings.
- **Reuse:** port design; generate the template from the same schema the parser uses.

### U-07 Logo choice
- **Purpose:** brand the deck with one of two house logos or an uploaded image.
- **Location:** `html_shell.html:372-378`; `12_boot.js:2-6`; consumers `08_exporters.js:85` (slide header),
  `:98-108` (dividers), `11_app_ui.js:4806-4814` (Disclaimer).
- **Behaviour:** sets the global `BRAND_LOGO`; every content slide carries it top right, dividers on a black plate,
  the Disclaimer on screen and in the deck. Market Update slides never carry a logo (owner, 27 Aug); Thank You is
  untouched.
- **Status:** partial: KI-020, the page-header logo does not change; the on-screen Disclaimer keeps the old logo until
  the next full re-render *(code, inferred)*. The choice is not remembered and not reset per family.
- **Tests needed:** logo appears on every content slide and the Disclaimer, never on Market Update slides.
- **Reuse:** port design (brief Phase 9: logo lower-right on placeholder slides; confirm placement).
- **Daily:** yes (DECISIONS_LOG, 29 May).

### U-08 Daily MF Monitor upload (Regular)
- **Purpose:** replace the embedded scheme returns, benchmark returns and expense ratios with a newer monitor.
- **Location:** `html_shell.html:386`; `11_app_ui.js:98-127` (upload), `:212-215` (×).
- **Behaviour:** `parseMonitor` (part 1) replaces `MF_PERF` and `BENCH_RET`; the UI also scrapes an expense-ratio
  column into `MF_PERF[].er`; the performance date comes from the file name, else the file. × restores the embedded
  data. Kept across families (market data).
- **Status:** broken.
  - KI-058 (reproduced): ER values ≤ 1 are kept as fractions, so 0.75 (%) becomes 75% (`:120`).
  - KI-026 (reproduced): the upload degrades the data relative to the monthly refresh (AUM on FoF sheets, debt
    fields, Direct sheet mapping, categories). KI-076: a Direct file is accepted in the Regular slot.
  - KI-013: the AI Analyst, MF Analysis, cost-tab risk data and the exporters' MF Analysis read the embedded data,
    not the upload, so one review mixes two vintages.
  - **OD-11 (owner): keep the upload, made correct** (one parsing path with the monthly refresh, ER ÷ 100 with
    values > 5% dropped and counted, slot type checked, data date visible, warning when not newer).
- **Tests needed:** upload of the archived September monitor reproduces the embedded block exactly; slot-swap
  rejection; ER units.
- **Reuse:** fix then port (single parser shared with the monthly pipeline).

### U-09 Direct MF Monitor upload
- **Location:** `html_shell.html:390`; `11_app_ui.js:163-190`, `:225-226`.
- **Behaviour:** as U-08 for `MF_PERF_DIRECT`; feeds the Performance Direct toggle (U-41) and the Cost tab's Direct
  mode (U-27). The direct date comes from the file name only; a file name without a date leaves it blank *(code)*.
- **Status:** broken: same defects as U-08 (KI-058, KI-026, KI-076), plus KI-054 (the Direct view substitutes or drops
  schemes). OD-11 applies.
- **Reuse:** fix then port.

### U-10 SIF Monitor upload
- **Location:** `html_shell.html:389`; `11_app_ui.js:156-162`, `:221-224`.
- **Behaviour:** `parseSIF` replaces `SIF_PERF`; date from the file name or the file; × restores the embedded block.
- **Status:** partial: KI-026 (the month-end date lands in the unused `amc` field).
- **Reuse:** fix then port.

### U-11 PMS / AIF Analytics (Client SOA) upload and template
- **Purpose:** add look-through holdings for a client's PMS/AIF schemes (client statement of account), or replace
  PMS/AIF performance.
- **Location:** `html_shell.html:387`; `11_app_ui.js:137-155`, `:216-218`, template `:257`.
- **Inputs:** one of three layouts, detected from the first row: Client SOA (Product Category · Scheme Name · Company
  Name · Corrected Name · Holding(%) · Sector · ISIN · SEBI Mcap) → `parseSOA`; otherwise `parsePMS` in
  "performance" mode (replaces `PMS_PERF` / `AIF_PERF`) or "holdings" mode.
- **Behaviour:** SOA schemes are merged into `EQUITY_ANALYTICS` tagged `uploaded` so they win over the embedded
  look-through of the same scheme. A client upload: cleared on a family switch (U-50). "Template ↓" downloads the
  8-column SOA header.
- **Status:** partial: KI-077 (Product Category must be exactly "PMS"/"AIF"); KI-033 (performance layout read by
  column position, always ×100); KI-026 (`parsePAsheet` expects the older layout); × clears the whole slot, including
  a performance file uploaded through it (KI-001 note). Debt or hybrid PMS/AIF stay excluded from look-through.
- **Tests needed:** each of the three layouts; lower-case product category; family switch clears it.
- **Reuse:** fix then port; split "client look-through" from "PMS/AIF performance" into two clear inputs.
- **Daily:** per review that holds PMS/AIF (HANDOVER §5.2).

### U-12 Bonds / Debt Analytics upload and template
- **Purpose:** look-through for directly held bonds / NCDs (or a debt analytics sheet).
- **Location:** `html_shell.html:388`; `11_app_ui.js:128-136`, `:219-220`, template `:256`.
- **Inputs:** a simple 4-column sheet (Instrument Name · % Allocation · Rating · Issuer) → `parseAdditionalDebt`;
  otherwise a full debt sheet → `parseDebtSide`.
- **Behaviour:** merged into `DEBT_ANALYTICS`; cleared on a family switch.
- **Status:** partial: KI-056 (reproduced) a vendor Debt Analytics file in this slot is misread; KI-023 ratings with
  an agency prefix fall into the wrong bucket.
- **Reuse:** fix then port.

### U-13 IRR Transactions upload
- **Purpose:** transaction history for transaction-based XIRR / benchmark XIRR, the Fund IRR tree, Taxation lots and
  the AI Analyst's LTCG signal.
- **Location:** `html_shell.html:391`; `11_app_ui.js:191-196`, `:227-228`.
- **Inputs:** the IRR workbook (needs an "SI Xirr" sheet), parsed by `parseIRR`.
- **Behaviour:** sets `activeRef.IRR`; the model recomputes; holdings captions switch to "transaction-based (as on
  …)". An IRR file uploaded before the first base file is kept (`irrBeforeBase()` check). Cleared on a family switch.
- **Outputs:** U-23 holdings XIRR/BMXIRR, U-28 Fund IRR, U-31 Taxation, XLSX "Fund IRR" sheet (U-48).
- **Status:** partial: KI-075 (rows dropped or misdated); KI-032 (client names joined fuzzily; reproduced); KI-111;
  KI-049 (aggregates not reconciled to the base file); KI-031 (clearing leaves derived values); KI-070 (common
  transaction types ignored; OD-16). KI-048 and KI-100 fixed in batch 1b.
- **Tests today:** `smoke-review.js` (XIRR equals the exact answer within 1e-6); `KI-048-irr-join.js`;
  `family-isolation.js`.
- **Reuse:** fix then port.
- **Daily:** yes when the adviser supplies the sheet (TESTING §4; HANDOVER §13 check 6).

### U-14 Market Update slides upload
- **Purpose:** replace the month's market-update slides that open every deck.
- **Location:** `html_shell.html:391` (row `rs-mkt`); `12_boot.js:8` (upload); `11_app_ui.js:229-231`, `:242` (×).
- **Inputs:** one or more images (JPEG/PNG), read as data URLs in the order the file chooser returns them.
- **Behaviour:** overwrites the global `MARKET_UPDATE_IMAGES`, which the exporter places after the Market Update
  divider in every full or picker deck (`08_exporters.js:140-145`). There is no on-screen preview, reorder or exclude.
- **Status:** broken for ×: KI-009, the reset writes `activeRef.MARKET_UPDATE_IMAGES`, which nothing reads; the label
  returns to "Embedded default" while the uploaded images stay in the deck. The embedded label ("Oct 2026") is a
  string in the UI code that the monthly splice rewrites (`buildtools/splice_refresh.js:95-98`).
- **Tests needed:** upload, preview, reorder, reset restores the embedded set; the deck's first slides equal the set
  shown.
- **Reuse:** rewrite (brief Phase 3 §8 and Phase 11: market updates come from the monthly folder; keep a per-review
  override with a preview).

### U-15 Data-date display
- **Purpose:** show which data vintage the review uses.
- **Location:** `html_shell.html:358` (Analytics / Perf dates in the drop zone), `:386-391` (slot labels);
  `11_app_ui.js:8-9`, `:84-85`.
- **Status:** partial: the MF Monitor slot shows only "Embedded default" (no date); KI-083 PMS/AIF data captioned
  with the MF date; KI-034 the deck's performance footnote shows the Regular date when Direct is selected; OD-11 asks
  for "which monitor and date are in use" to be visible.
- **Reuse:** rewrite as a source register (brief Phase 2: source files, import records, staleness statuses).

---

## C. Sections (the 20 `TABS`)

Order and keys from `11_app_ui.js:312`. PPTX counts are from the probe (synthetic book, headless); "divider" means the
count includes a section divider.

### U-16 Home (`home`)
- **Purpose:** landing surface.
- **Location:** `11_app_ui.js:3920-3930`.
- **Behaviour:** renders only a "PORTFOLIO UPDATE" title block between two brand lines. No KPI, no data dates, no
  family name. The comment above it still says `renderMktUpdate`.
- **Outputs:** screen only; the deck has no Home or cover slide (the first slide is the Market Update divider).
- **Status:** partial on screen; **broken export (KI-015 / KI-124, confirmed)**: see U-45.
- **Reuse:** rewrite: the new overview section (brief Phase 3 §1-2: import status, reporting dates, Review Snapshot
  mode). A cover slide is an owner question.

### U-17 IPS Profile (`ips`)
- **Purpose:** compare the portfolio with the Investment Policy Statement band of the selected risk profile.
- **Location:** `window.getIPSData` `11_app_ui.js:4829-5077` (the calculation lives in the UI script);
  `renderIPS` `:5078-5170`; slide `08_exporters.js:160-210`.
- **Inputs:** model; equity and debt look-through; the Cost tab's full-portfolio weighted cost and its
  Regular/Direct mode (`window.__PORT_COST_FULL`, `:5002-5004`); profile from `localStorage.ips_profile_idx`
  (default Balanced).
- **Behaviour:** 28 rows (asset class, equity type and market cap, unlisted, global, credit buckets, duration,
  concentration, closed-ended, real estate, cash, portfolio cost) × 5 profiles; a profile `<select>` redraws the table
  and is remembered. Each row shows IPS range, actual and "Within" or the deviation.
- **Outputs:** screen; PPTX "IPS Profile Compliance" (paginated at 27 rows, so a 2/2 slide carries one row, KI-018;
  the probe shows 0 slides headless because `getIPSData` is UI-scope); no XLSX sheet.
- **Status:** broken: KI-066 (P0, reproduced) compliance verdicts wrong; KI-042 (BBB & below always 0%, unlisted
  denominator counts debt AIFs); KI-035 the profile carries from one family to the next; KI-028 a dead
  `window.IPS_PROFILES` table with different bands (`:3880-3907`) invites editing the wrong table; KI-088 blocked
  storage blanks the tab. **OD-13:** measure on CMV including hybrid sleeves; "—" when there are no unlisted holdings.
  **OD-10:** profile per family only.
- **Tests needed:** known-answer test per row on a synthetic book; profile per family; storage blocked.
- **Reuse:** fix then port the band table and actuals into the model.
- **Daily:** yes (first content slide of the deck).

### U-18 Asset Allocation (`asset`)
- **Location:** `11_app_ui.js:541-561`; slide `08_exporters.js:211-248`; XLSX "Asset Allocation".
- **Behaviour:** KPIs (Invested ‡, CMV, Gain/Loss ‡, holdings, clients); asset → product table with Investment
  Amount, CMV and % CMV; pies by asset class and by liquidity / structure.
- **Outputs:** PPTX 1 slide; XLSX sheet.
- **Status:** partial: KI-078 / NEW-32 the deck table is sized by fixed counts and hides the Grand Total; KI-091 pie
  labels in whole percent; KI-084 the XLSX liquidity % sits in the Investment Amount column; KI-007 fixed (‡ for
  partial invested values).
- **Reuse:** port logic; brief §6.1 consolidates the four allocation slides into two.
- **Daily:** yes.

### U-19 Distributor Allocation (`distalloc`), the advisor-level allocation
- **Location:** `renderAlloc` `11_app_ui.js:1437-1523`; slides `08_exporters.js:249-290`; XLSX "Distributor
  Allocation".
- **Behaviour:** asset → product table with one column per distributor and a total; a 100% stacked bar of asset mix
  per distributor. With a single distributor the section is hidden and the nav says "Single Distributor".
- **Status:** partial: KI-092 / NEW-46, the deck still exports the two slides the screen hides (**OD-21: leave them
  out**); KI-094 the XLSX stores pre-rounded values without a number format.
- **Reuse:** port logic (brief §6.1: one advisor-level slide with charts and tables together).

### U-20 Client Allocation (`clalloc`)
- As U-19 with one column per family member (`renderClientAlloc`, `:1524`); hidden for a single client. Same status
  and decisions (KI-092, KI-094, OD-21).

### U-21 AMC Allocation (`amc`)
- **Location:** `11_app_ui.js:572-589`; slide `08_exporters.js:292-303`; XLSX "AMC Allocation".
- **Behaviour:** horizontal bar of each fund house's share of the **mutual-fund book**, a dashed 20% cap line,
  breaches in red with a note.
- **Status:** partial: KI-004 (two bases between this tab and the AI Analyst; OD-1 chose the MF book); KI-112 rows
  with a blank AMC form one unnamed house (OD-34: show "AMC not given"); KI-117 newer houses missing from display
  names.
- **Reuse:** fix then port.

### U-22 Observations and SWOT (`obs`)
- **Purpose:** client-facing commentary.
- **Location:** text generated in the engine (`07_engine.js:1666-1978`, rule-based sentences); screen
  `11_app_ui.js:1402-1435`; PPTX 3 slides; XLSX "Observations".
- **Behaviour:** four "Current Portfolio" cards (asset, product, AMC, liquidity) and a four-quadrant SWOT. Read-only:
  the analyst cannot edit, suppress or add a point on screen *(code)*.
- **Status:** partial: works as rule-based text; not editable; inserted as HTML without escaping (KI-008). Brief
  Phase 8 replaces it with an evidence → diagnosis → implication → action observation engine that the analyst can
  edit without altering the calculation.
- **Reuse:** port the triggers as seed rules; rewrite the narrative layer.
- **Daily:** yes.

### U-23 Holdings (`holdings`) and presentation-column chips
- **Location:** `11_app_ui.js:591-657` (`CZHOLD` registry, chips, `renderHoldings`); slides `08_exporters.js:309-410`;
  XLSX one sheet per client.
- **Behaviour:** one card per client: asset → product → holding rows with Instrument, Purchase Date, Distributor,
  Invested, CMV, Gain/Loss, Allocation %, XIRR %, BMXIRR %, Absolute Return %. Ten chips choose the columns for the
  screen **and** the deck (Instrument Name locked). Footnote marks: † partial XIRR coverage (KI-006), ‡ partial
  invested (KI-007), § IRR join (KI-048).
- **Status:** partial.
  - KI-110 / KI-122 holdings slides overflow or orphan a group header; KI-121 caption says "transaction-based" for a
    client with no IRR transactions; KI-123 ‡ missing on some totals; KI-005 units.
  - **New (code, not browser-verified):** toggling a column chip re-renders the section through `renderHoldings`,
    which does not draw the download bar, and `ensureDlBtns()` runs only at the end of `renderAll` (`:533`), so the
    Holdings "Download slide" button disappears until the next full render.
  - The column choice (`window.CZHOLD`) survives a family switch in the same session (not in U-50's list).
- **Tests needed:** chip toggle keeps the download button; chosen columns appear in the slide; pagination with long
  names and notes.
- **Reuse:** fix then port. Brief §7.1: sort by value, group repeated distributor labels.
- **Daily:** yes.

### U-24 Analytics (`analytics`): equity and debt look-through
- **Location:** `11_app_ui.js:744-814`; disclosure `fundBox` `:696-743`; slides `08_exporters.js:411-423`; XLSX
  "Equity Analytics", "Debt Analytics".
- **Behaviour:** Equity: total and unique stock counts, market-cap bar, top-10 sectors bar, top underlying holdings.
  Debt: average modified duration and YTM (pure debt MFs only), credit-rating doughnut, top 20 issuers. Each block
  sums to 100.00%. A collapsible "N of M holdings included" disclosure lists, by product class, what each holding was
  matched to ("matched as") and why any were excluded. The section also hosts U-38 to U-40.
- **Status:** partial: KI-030 overlap/look-through on stored top holdings; KI-041 top holdings aggregate raw names
  (duplicates, TREPS); KI-039 issuer normalisation differs from the build; KI-023 rating prefixes; KI-101 / KI-051
  wrong matches feed it; KI-085 the XLSX lacks vintage and coverage. Historical analytics (brief §6.6) and hybrid FoF
  look-through (§6.7): **missing**.
- **Reuse:** fix then port.
- **Daily:** yes.

### U-25 Analytics scope selector (Family / Client); advisor scope
- **Location:** `11_app_ui.js:660-669` (`analyticsSrc`), `:772-782`, `:805`.
- **Behaviour:** shown only for families with ≥ 2 clients: "Family Level" plus one button per client. A client scope
  recomputes the model for that client's rows (cached) and re-draws only the equity and debt look-through. The
  single-slide download of Analytics uses the scope (file name suffix); **the full deck and the workbook stay at
  family level** (`dlppt` passes `model`, `:6017`). Decision 19 Jun: the selector re-scopes only look-through.
- **Status:** partial; **advisor (distributor) scope: missing.** Distributor appears only as the Distributor
  Allocation tab (U-19), the Cost tab filter (U-27) and an overlap quick-select (U-26), which selects funds without
  re-basing. KI-082 the deck drops the client-scope label; KI-106 AMC labels after a client recompute.
- **Reuse:** port design; brief §6.5 asks for client and advisor selectors on analytics and overlap.

### U-26 Overlap (`overlap`): matrix, selection, threshold, PNG
- **Location:** `11_app_ui.js:821-951` (`renderOverlapPanel`, `buildOvMatrix`, `overlapCanvas`, `downloadOvImage`);
  slide `08_exporters.js:425-436`; XLSX "Overlap Matrix".
- **Behaviour:** Σ min(weight A, weight B) across stored holdings, ≥ 99.5% shown as 100; one checkbox per eligible
  fund; a "show only pairs ≥ x%" slider; quick-select by Asset Class, Product Class, Category, Client or Distributor
  (chips, union of ticked values; selection only, weights not re-based); counts; colour legend; "Download overlap as
  PNG" (dark canvas). Needs ≥ 2 eligible funds.
- **Status:** partial on screen, **broken in the deck**.
  - KI-002 (reproduced): the overlap slide has a title, insight and footer but **no matrix**: the exporter calls
    `overlapCanvas`, `ovSel`, `ovTh`, which exist only in the UI script; the strict-mode error is swallowed
    (`08_exporters.js:430-433`). The on-screen selection therefore never reaches the deck.
  - KI-095 / NEW-49 (reproduced): the two panels' "Clear" chips share the id `ovClr`, so the main panel's Clear does
    nothing and the post-rebalancing one resets the main matrix; the PNG prints the main threshold.
  - KI-030: stored holdings may be a fund's top 30, so overlap of broad funds is understated.
- **Tests today:** `smoke-review.js` (matrix square, symmetric, 100 on the diagonal).
- **Tests needed:** the deck slide shows the selected funds at the selected threshold; panel isolation.
- **Reuse:** fix then port (one renderer used by screen, PNG and slide).
- **Daily:** yes.

### U-27 Portfolio Cost (`cost`): plan mode, distributor filter, ER overrides
- **Location:** `11_app_ui.js:5173-5444` (ER resolution and weighting live in the UI script); slide
  `08_exporters.js:440-537` via `window.__COST_DATA`; no XLSX sheet.
- **Inputs:** holdings; ER sources in order: manual override → `MF_ER_TABLE` base ER → monitor ER → category estimate
  → PMS 150 / AIF 250 bps; `localStorage` `cost_mode`, `cost_distributor`, `cost_overrides`.
- **Behaviour:** Regular / Direct buttons (also re-render IPS); a Distributor `<select>` that re-bases weights, KPIs and
  the slide to one distributor; KPIs (weighted bps, ER %, estimated annual cost, coverage); a table grouped MF / SIF /
  PMS / AIF / Other with per-scheme ER inputs in bps (change = override, double-click = reset).
- **Status:** broken.
  - KI-059 (P0): a missing base ER is filled with an unsourced estimate (**OD-9: leave blank with a footnote**).
  - KI-060 (P0): an override above 300 bps is divided by 100 on the next load (`:5177`).
  - KI-016: the note says "AIF default = 200 bps" (code uses 250) and that ERs come from the MF Monitor.
  - KI-012 / KI-035: mode, distributor and overrides (keyed by instrument name) persist across families and sessions
    (**OD-10: per family only; one shared Regular/Direct switch for Cost, IPS and Performance**).
  - KI-088 (reproduced): `localStorage.getItem('cost_mode')` is unguarded (`:5218`); blocked storage blanks the tab
    and breaks the deck.
  - KI-013: risk data read from the embedded `REFDATA`.
  - *(code)* the subtotal and grand-total "ER (bps)" cells add up the ERs of the schemes, a figure with no meaning;
    "Est. Annual Cost" is always printed as "Rs … Cr" whatever the file's unit (cf. KI-079).
- **Tests needed:** known-answer weighted cost; override round-trip at 350 bps; per-family reset; storage blocked.
- **Reuse:** fix then port the cost calculation into the model (brief Phase 3 §9 puts cost analysis in the Annexure).
- **Daily:** yes.

### U-28 Fund IRR (`irr`)
- **Location:** `11_app_ui.js:1369-1401`; slide `08_exporters.js:538-568`; XLSX "Fund IRR" `08_exporters.js:2102-2114`.
- **Behaviour:** top 5 contributors and top 5 laggards by contribution (allocation × fund XIRR), caption
  "transaction-based (as on …)" or "taken from the base file". **The full IRR tree (Total Portfolio → Client → Asset
  → Product → Instrument, fund vs benchmark) exists only in the XLSX sheet**, and only with an IRR upload; the screen
  and the deck never show it.
- **Status:** partial: KI-049 aggregates not reconciled; audit side lead, negative contributions can be listed as
  "top contributors"; KI-090 negative figures dark red on black.
- **Reuse:** port logic; add the tree to screen and deck (owner question).

### U-29 Current vs Sample (`cvs`)
- **Location:** `11_app_ui.js:5447-5991` (bucketing, sums and inputs in the UI script); slide
  `08_exporters.js:571-738` via `window._cvsSnapshot`; no XLSX sheet.
- **Inputs:** model; the rebalancing plan; house return assumptions hard-coded in `CVS_GROUPS` (`:5482-5509`);
  Portfolio CMV (₹ Cr) and Inflation (%) inputs (`localStorage` `cvs_cmv` with a family|date|CMV signature, `cvs_infl`
  default 6.5).
- **Behaviour:** Debt / Equity / Commodity / REITs rows with current and sample allocation % and expected return %,
  weighted returns, inflation-adjusted figures, rupee differences. Every cell is editable (tan when edited). "Reset to
  Actual" restores the current column; "Re-seed from rebalancing plan" discards typed sample values. The sample
  column follows the rebalancing plan (KI-068 fixed); hybrids split by their own sleeve, FoFs and sleeve-less hybrids
  go to "Unallocated †" with a blank return (KI-067 fixed); typing keeps focus (KI-114 fixed). Exports warn when an
  unallocated share has no return.
- **Status:** partial: KI-086 typed values reset on a full re-render; KI-043 inflation-adjusted return never
  reconciled with the owner's Excel; KI-081 / KI-115 slide headers say "IRR%", disclaimer under the footer, "-0 Cr";
  KI-116 bucket rules; OD-29 / OD-30 pending (accepted as shipped).
- **Tests today:** `KI-067-cvs-hybrid-split.js`, `KI-068-cvs-refresh.js`, `KI-114-cvs-typing.js` (UI cut out by anchor,
  `regression/lib/cvs-harness.js`); `tools/browser-checks/cvs-refresh.js` (four checks).
- **Reuse:** fix then port the calculation; it is the nearest legacy feature to reference deck A's pre/post
  projection slide (brief Phase 9, slide 8).
- **Daily:** yes.

### U-30 MF Analysis (`mfanalysis`) and rationale modal
- **Location:** `11_app_ui.js:1560-2117` (matching, universe averages and rationale text in the UI script); slides
  `08_exporters.js:739-989` (a second, different matcher); no XLSX sheet.
- **Inputs:** equity MF holdings (Asset = Equity, Product = Mutual Fund, non-equity categories excluded by regex);
  `REFDATA.MF_RISK`, `MF_BENCHMARKS` (embedded, not session uploads); `DATA_DATES.risk`.
- **Behaviour:** KPIs (funds, CMV, categories, with risk data, with 3Y rolling); one table per category in SEBI order
  (Beta, SD, Alpha, Sortino, Sharpe, Corr, Information Ratio, Down capture, 3Y rolling) with a universe-average row
  and benchmark rows, green / red against the universe; the same fund held by several clients is one row; a
  five-year age gate blanks young or unresolved funds and counts them; a "Rationale" button opens a modal with
  paragraphs and an overall verdict. Its output feeds the rebalancing rationale draft (`window.__MFA_DATA`, `:2115`,
  read at `:2577`).
- **Status:** broken.
  - KI-053 (P0): two unanchored matchers; the screen's `fuzzyMatch` (`:1589-1603`) and the exporter's `_fuzzy`
    (`08_exporters.js:754-761`) use different rules, so screen and deck can attach different funds' ratios.
  - KI-052 stale spellings; KI-054 Direct view; KI-026 `MF_BENCHMARKS` legacy values (Beta 1.00, Down capture 100%,
    blanks); KI-013 ignores uploads; KI-082 the deck drops the young/unresolved disclosure; KI-092 the deck orders
    categories by CMV.
- **Tests needed:** one matcher, tested both ways over the universe (rule 4); screen = deck.
- **Reuse:** fix then port (brief §7.2 sources these metrics from the MF Screener or the monthly Excel fallback).
- **Daily:** yes.

### U-31 Taxation (`tax`) and scope strip
- **Location:** `11_app_ui.js:3936-3985`, `:4557-4804`; engine `computeTaxation` (part 1); slides
  `08_exporters.js:1454-1735`; no XLSX sheet. The comment at `:3931-3935` still says "screen only — no PPTX slide";
  the slides exist.
- **Inputs:** the IRR upload (FIFO lots); `TAX_RULES`.
- **Behaviour:** without IRR: a notice that nothing is estimated. With IRR: a scope strip (Family Level / each
  client; the deck exports the scope on screen, `window.__taxScope`); KPIs (LTCG, STCG, total gain/loss, unclassified);
  roll-ups by product and asset; a "By tax class" table whose rows expand to their instruments; a harvesting card; a
  "By Holding" table with LTCG/STCG units, amounts available for rebalancing and lots.
- **Outputs:** screen; PPTX (5 slides in the probe); no XLSX.
- **Status:** broken: KI-064 (P0) rupee ledger misallocates LT/ST; KI-069 lot join on exact names (OD-15
  apportion by units); KI-070 transaction types (OD-16); KI-022 holding period to the IRR file's last date (**OD-2:
  more than 12 months to the review's as-on date**); KI-037 hybrids unmapped (OD-17); KI-099; KI-109 slide footer;
  OD-12 PMS/AIF "not split"; OD-28 section reference. KI-065 fixed.
- **Tests today:** `smoke-review.js` (reconciliation; LTCG + STCG + unclassified = CMV; KI-065 classes).
- **Reuse:** fix then port (brief Phase 3 §7: preserve transaction- and unit-based tax calculations).
- **Daily:** yes when an IRR sheet is supplied.

### U-32 Centricity AI Analyst (`aia`)
- **Location:** `11_app_ui.js:3987-4403`; engine `aiaCompute` (part 1); slides `08_exporters.js:1234-1453` and XLSX
  "AI Analyst" (`:2201-2248`), both read `window.__AIA_DATA`.
- **Behaviour:** deterministic rules (no LLM, no network). Executive summary (released, redeployed, unplaced,
  holdings assessed), before / after effects coloured by direction (overlap, largest AMC, …), action boxes, the plan
  table, holding-by-holding evidence, a "Not assessed" list, and a methodology panel (eight weighted rules, data
  vintages, caveats).
- **Status:** partial: computes on the **embedded** `REF`, not the session data (`:4088`, KI-013); KI-004 / OD-1 cap
  basis; KI-029 weights never signed off; KI-080 thresholds in absolute ₹ Cr (OD-19); KI-102, KI-103, KI-104,
  KI-105, KI-106, KI-107, KI-112, KI-117; KI-061, KI-062 (bookkeeping), KI-063, KI-120 fixed. Screen places it in
  Rebalancing Opportunities; the deck after the Annexure divider (KI-014).
- **Tests today:** `tools/test-ai-analyst.js` (24 checks, CI); regression KI-061, KI-062, KI-063, KI-120.
- **Reuse:** fix then port; brief Phase 16 defers the automated rebalancing engine to Phase 2, so keep it behind the
  manual plan.
- **Daily:** unknown (no record of how often analysts use it).

### U-33 AI Analyst "Apply plan to Portfolio Rebalancing"
- **Location:** `11_app_ui.js:4366-4402`, `aiaApplyToRebal` `:4405-4516`, `aiaRebalCheck` `:4517-4542`.
- **Behaviour:** asks for confirmation if the Rebalancing tab already holds edits; writes actions, amounts,
  destinations and per-row rationale for every member row (Regular and Direct, several clients; pro rata, OD-31); the
  status line reports "N rows written for M holdings"; an "Applied" badge stays green only while the Rebalancing tab
  equals the plan, and turns red with both release figures when the analyst changes it.
- **Status:** working (fix batch 1b); OD-14 (degraded Exit falls back to Retain) not yet built.
- **Tests today:** `KI-063-apply-plan.js`; TESTING §4 step 9 (manual).
- **Reuse:** port logic (Phase 2 interface between an automated proposal and the analyst's plan).

### U-34 Portfolio Rebalancing (`rebal`): action boxes and fund picker
- **Location:** `11_app_ui.js:2288-2328` (actions, colours), `:2685-2880` (boxes, picker, autocomplete), `:2881-3084`
  (`renderRebal`), `:3743-3906` (event wiring).
- **Behaviour:** five boxes (Exit, Retain, Partial Rebalance, New Addition, Top-Up) with count, amount and % of
  portfolio, and the names in each. "+ Add fund" opens a multi-select picker of every unique holding grouped Asset ·
  Product, with type-to-filter, a tick for funds in this box and a badge for funds in another; "Done" closes it.
  "+ Add new instrument" (New Addition) adds a free-text row. Clicking a box header filters the table; a chip clears
  the filter. The plan starts empty; the state is keyed by normalised instrument name.
- **Status:** working; KI-019 the plan is wiped on an as-on date change (OD-24: keep).
- **Reuse:** port design (brief Phase 3 §6 preserves fund selection; the Phase 16 scenario model replaces the state
  object).
- **Daily:** yes when the review includes rebalancing (reference deck A).

### U-35 Rebalancing worksheet table
- **Location:** `11_app_ui.js:2928-3065` (table), `:3138-3227` (`rbRecalc`, live totals), `:2290-2361` (sorting),
  `:2527-2644` (rationale draft), `:2791-2856` (proposed-fund universe and autocomplete), `:3233-3395` (deltas and
  rebalanced holdings).
- **Behaviour:** 14 columns: Client (a selector when several clients hold the fund: "All clients (combined)" or one
  client, which drives the amount), Instrument, Category, Product Class, Asset Class, Amount and % Allocation
  (interlinked), Actionables (a select, with "Remove from plan"), Proposed Funds (several per row; autocomplete over
  `MF_ER_TABLE`, the performance universes and 143 hand-listed extra products in `window.REBAL_FUND_EXTRAS`
  (`:2123-2267`: SIF, GIFT City, PMS, AIF, PE/VC names)), proposed Category / Product / Asset (guessed from the
  reference data), Amount / % per proposed fund (interlinked, with a Σ ≠ 100% warning), Rationale (auto-drafted from
  % of portfolio, MF Analysis, Performance vs benchmark and client XIRR; "Re-draft"; analyst wording is never
  overwritten). Totals for instruments and proposals, an "Unallocated" row, sortable headers (third click restores
  the natural order), and a summary strip (Total CMV, Amount Being Rebalanced = Exit + Partial + Top-Up, %, Proposed,
  Unallocated). Typing recalculates without a re-render.
- **Outputs:** screen; PPTX `rebal` slides; XLSX "Portfolio Rebalancing" sheet (both from `window.__REBAL_DATA`,
  `rbStash` `:3686-3740`).
- **Status:** partial: KI-013 the autocomplete universe is built once per session (`window.__REBAL_UNIV`), so later
  uploads are missed; KI-096 benchmark index rows ("Average", "NIFTY 500") offered as funds; KI-103, KI-104, KI-105
  rationale and row-merge issues; KI-019. The extra-product list is a snapshot inside UI code (it belongs in the
  brief's product bank, Phase 11).
- **Tests today:** KI-063 regression (apply); none for editing, sorting, interlinked inputs or totals.
- **Tests needed:** amount ↔ % round-trip; Σ warning; totals = Σ rows; sort keeps row identity; plan survives date
  change; exported rows equal screen rows.
- **Reuse:** port the plan arithmetic into the scenario model; rewrite the UI.

### U-36 Already-held detection for proposed funds
- **Location:** `11_app_ui.js:995-1078` (`ppGuard`, `ppHeldIndex`, `rbHeldMatch`, held clause).
- **Behaviour:** a proposed fund that is already in the portfolio (exact name, else `matchInstrument` plus a brand and
  Jaccard guard calibrated against measured false positives) gets a green "Existing" badge in the table, the box
  lists and the proposed-funds performance; the rationale gains "Top-up recommended in an existing holding: …" or
  "Reallocation suggested to an existing holding: …" (or a separate note if the analyst edited the text).
- **Status:** working.
- **Tests needed:** the guard's measured pairs as a fixed test set.
- **Reuse:** port logic.

### U-37 Rebalancing Holding Sheet (`rebalhold`)
- **Location:** `11_app_ui.js:3426-3540`; slide `08_exporters.js:1101-1149`; no XLSX sheet.
- **Behaviour:** current holdings with the plan applied: Client, Instrument, Invested, CMV, % Allocation, signed
  Proposed Amount, Total Rebalanced CMV, Rebalanced % Allocation, Deviation; asset / product / item / grand levels; rows
  tinted by action; a fund held by several clients is split per client; a reconciliation note. Its own "Download
  slide" button.
- **Status:** partial: KI-123 missing ‡ on the Grand Total; pagination never opened by a person (previous owner D9).
  Exports even when there is no plan (it then equals current holdings).
- **Reuse:** port logic; brief §7.1 sort by value and group repeated distributor labels.

### U-38 Post-Rebalancing Analytics (`postan`)
- **Location:** `11_app_ui.js:3541-3685` (shown inside the Analytics section); slides `08_exporters.js:1150-1166`.
- **Behaviour:** recomputes the review on the rebalanced holdings and draws a full copy of the equity and debt
  look-through (own charts); proposed funds without look-through are excluded and named in red. **Shown whether or
  not a plan exists** (with no plan it equals the current portfolio, by design, `:3550-3553`).
- **Status:** partial: always present on screen and in the full deck even for a review without rebalancing; the
  brief's conditional Review Snapshot (Phase 5) needs it to follow the review mode.
- **Reuse:** port logic.

### U-39 Rebalancing Impact (`rbimpact`)
- **Location:** `11_app_ui.js:3565-3579`, `:3654-3684`; slides `08_exporters.js:1184-1218`.
- **Behaviour:** current vs post tables for market cap, sectors and top holdings (equity) and rating, sector and
  issuers (debt), with the change in red / green.
- **Status:** partial: KI-017, no checkbox of its own in the slide picker (reachable only through the section
  checkbox, U-46); the Debt card has no download button *(code)*; no XLSX.
- **Reuse:** port logic (brief Phase 5 "quantified pre/post changes").

### U-40 Post-Rebalancing Overlap Matrix (`rbovlp`)
- **Location:** `11_app_ui.js:793-803` (panel under U-38, own selection state `OVST_POST`, `:828-830`); slide
  `08_exporters.js:1170-1183`.
- **Behaviour:** the same overlap panel as U-26 on the rebalanced portfolio, with its own ticks and threshold and a
  PNG download. No "Download slide" button of its own.
- **Status:** partial on screen (KI-095 Clear cross-wired, PNG prints the main threshold); **broken in the deck**
  (KI-003): `rbPostAnalytics` is UI-scope, so the exporter returns before adding a slide; a picker deck with only this
  group contains just the "Rebalancing Opportunities" divider (probe: 1 slide).
- **Reuse:** fix then port (brief Phase 5 "changes in overlap").

### U-41 Performance (`perf`) and Regular / Direct toggle
- **Location:** `11_app_ui.js:952-983` (`filterPerfBuckets`), `:1303-1366`; slides `08_exporters.js:1736-1785`; XLSX
  "Performance".
- **Behaviour:** one table per bucket (Equity MF, Hybrid MF, Debt MF, Commodity MF, PMS, AIF, SIF, Direct Equity;
  `07_engine.js:613-621`) with category sub-headers and benchmark rows; columns per bucket (`BUCKET_DEFS`), market-cap split for equity, YTM / average
  maturity / modified duration for debt. Funds with no return are dropped on screen and in the deck, not in the XLSX
  (owner, 7 Jul). When Direct data exist, a Regular / Direct switch changes the table, and the deck and workbook follow
  it.
- **Status:** partial: KI-054 Direct view substitutes or drops schemes; KI-073 missing benchmark series shown as
  all-dash rows; KI-034 footnote date; KI-083 PMS/AIF date; KI-024 benchmark routing; KI-097 `MF_CAT_BM` unused. Brief
  §7.3 asks for a fixed category order, centred columns and no 2Y debt column. The Cost tab has its own separate
  Regular / Direct switch (OD-10: one shared switch).
- **Reuse:** fix then port.
- **Daily:** yes (Annexure).

### U-42 Performance: Proposed Funds (`proposedperf`)
- **Location:** `11_app_ui.js:1177-1301` (inside `#perf-proposed` under U-41); slides `08_exporters.js:1786-1894`.
- **Behaviour:** every fund typed into Proposed Funds, de-duplicated, resolved to an MF → PMS → AIF → SIF record
  (exact key first, then a guarded fuzzy match) with the matched key printed under the name; "Existing" tag for held
  funds; unresolved names listed with the reason (in the fund master but no published performance, or a custom
  entry). Follows the Regular / Direct switch. Own "Download slide" button.
- **Status:** partial: with no proposals, the button downloads an empty deck *(code; probe 0 slides)*; KI-096.
- **Reuse:** port logic.

### U-43 Disclaimer (`disc`)
- **Location:** `11_app_ui.js:4806-4815`; slide `08_exporters.js:1895-1906`.
- **Behaviour:** the supplied slide image (`TOPIC_SLIDES.disc`) with the chosen logo laid over it; always in a full or
  picker deck (U-46).
- **Status:** working; a wording change needs a new image export (KNOWLEDGE_DUMP §7).
- **Reuse:** port design; brief Phase 11 refreshes disclaimer material monthly from the approved folder.

### U-44 Thank You (`thank`)
- **Location:** `11_app_ui.js:4817-4823`; slide `08_exporters.js:1907-…`. Supplied image, untouched.
- **Status:** working. **Reuse:** port design (asset).

---

## D. Exports

### U-45 Per-tab "Download slide (PPTX)", including the Home defect (KI-124)
- **Purpose:** one section as its own small deck (owner decisions 19 Jun and 29 Jun: "each tab has its own
  single-slide download, plus the full deck").
- **Location:** `dlBar` `11_app_ui.js:361-364`; `ensureDlBtns` `:365-369`; click delegation `:30`; `slidePPTX`
  `:397-424`; `tabHasContent` `:386-396`; section buttons `.rbdl` (`rebalhold`, `postan`, `rbimpact`, `proposedperf`)
  wired by `rbWireDl` `:3419-3424`; exporter gating `08_exporters.js:30-53`.
- **Behaviour:** some renderers draw their own bar (`ips`, `analytics`, `cost`, `cvs`, `tax`, `aia`, `rebal`, `perf`);
  at the end of every `renderAll`, `ensureDlBtns()` walks **all 20 `TABS`** and inserts a bar into every section that
  lacks one, so Home, Asset, Distributor, Client, AMC, Observations, Holdings, Overlap, Fund IRR, MF Analysis,
  Disclaimer and Thank You get theirs this way. A click calls `slidePPTX(key)`: needs a model; flushes a pending CVS
  refresh; refuses with "No exportable content" only for `analytics`, `overlap`, `distalloc`, `clalloc`, `irr`,
  `rebal`, `tax`, `aia` when empty (every other key, including `home`, counts as having content); names the file
  "Portfolio Review_<family>_<tab>[ (<client scope>)]_<date>.pptx"; calls `buildPPTX(model, Ppt, key)`. With a single
  key, `ALWAYS()` is false (`08_exporters.js:45-48`), so no Market Update, Disclaimer or Thank You is added (decision 29
  Jul), but section dividers opened by `SHOW_ANY` are (`:307`, `:569`).
- **KI-124 (confirmed):**
  - *(code)* `ensureDlBtns` adds the bar to `#s-home` because it iterates `TABS`, whose first entry is `['home','Home']`
    (`:312`, `:367-368`); the right nav deliberately gives Home no checkbox (`:473-474`, "the landing surface, not a
    slide") but the button logic has no such exclusion.
  - *(code)* `tabHasContent('home')` falls through to `return true` (`:395`); `buildPPTX` has no `SHOW('home')` block
    anywhere (all gates listed at `08_exporters.js:140-1907`), and `only==='home'` matches neither `ALWAYS()` nor the
    `disc` / `thank` special cases (`:1895`, `:1907`).
  - *(probe)* `buildPPTX(model, PptxGenJS, 'home')` on the shipped exporter returns a deck with **0 slides** (39,841
    bytes, the same size as every other empty deck); the status line then reports "Slide downloaded: Portfolio
    Review_<family>_Home_<date>.pptx" as a success.
  - Earlier record: KI-015 (code review, 14 Oct) and the audit's deferred list "(c) KI-015 (empty Home deck)". KI-124
    is not yet written into `docs/KNOWN_ISSUES.md` at `782794f`.
- **Other empty or near-empty single-slide downloads:**
  - `proposedperf` with no proposed funds: 0 slides *(code; probe)*.
  - `aia` when the tab has not computed a plan: 0 slides *(probe; in the browser the tab normally computes first)*.
  - `rebal` with no plan: only the "Rebalancing Opportunities" divider *(probe 1 slide; KI-015)*.
  - `overlap`: a slide without the matrix (KI-002).
  - `postan` and `rebalhold` with no plan export the current portfolio under post-rebalancing titles *(code)*.
  - `distalloc` / `clalloc` for a single distributor or client: the section is hidden, so its button is too, but the
    deck still exports it (KI-092).
- **Holdings:** the button vanishes after a column chip toggle (U-23, code).
- **Status:** partial; broken for Home.
- **Tests today:** `smoke-review.js` builds 19 single-tab decks and checks they do not throw; it **excludes `home`** and
  checks no slide count, which is how KI-124 passed CI.
- **Tests needed:** for every section that offers a download, the deck has ≥ 1 content slide (not only a divider); no
  download offered where there is no slide; a success message only when slides were produced.
- **Reuse:** rewrite: the new build should derive download buttons and the deck from one slide manifest (brief Phase 9
  "map these to slide components, not hardcoded slide numbers").

### U-46 Slide picker
- **Location:** `11_app_ui.js:314-354` (`EXTRA_SLIDES`, `SLIDE_PICK`, `slideRows`), `:371-383` (`rnavSyncHeads`),
  `:455-499` (checkboxes); spec: previous owner's `IMPLEMENT_Presentation_Flow_and_SlidePicker.md` (28 Jul).
- **Behaviour:** a checkbox per tab (not Home) and per extra group (Rebalancing Holding Sheet, Post-Rebalancing
  Analytics, Post-Rebalancing Overlap Matrix under Rebalancing; Performance — Proposed Funds under Performance); a
  checkbox per section that ticks all its rows (indeterminate when partly ticked); "N slides selected" or "All slides
  (nothing selected)". **Nothing ticked = the full deck.** The ticks feed the "Download Full PowerPoint" button
  (U-47). Reset on a family switch and on any plan reset.
- **Status:** partial.
  - KI-017: "Rebalancing Impact" has no checkbox (`:490` only lets `rebalhold` and `postan` extras hang under
    `rebal`); the section checkbox does include it (`slideRows` chains extras).
  - KI-019 (reproduced): after an as-on change the ticks stay visible but `SLIDE_PICK` was emptied, so the export is
    something else.
  - *(code)* Disclaimer, Thank You and the Market Update slides are in **every** picker deck (`ALWAYS()` is true for an
    array), so the Disclaimer and Thank You checkboxes change nothing, and the Market Update cannot be left out.
    *(probe)* a picker list of only `['home']` gives 9 slides: Market Update divider, six Market Update images,
    Disclaimer, Thank You.
  - *(code)* the "Portfolio Update" and "Annexure" dividers are emitted only for the full deck (`!only`,
    `08_exporters.js:147`, `:1220`); the 28 Jul spec says a divider appears whenever a slide of its section is picked.
  - The selection is not remembered between sessions (by design) and cannot be saved as a named set.
- **Tests needed:** each pick produces exactly those slides in flow order with their section's divider; KI-017,
  KI-019 cases.
- **Reuse:** rewrite on the slide manifest.
- **Daily:** yes (owner decisions 28-29 Jul).

### U-47 Full PowerPoint export
- **Location:** `11_app_ui.js:5998-6024` (`dlppt`); `08_exporters.js:30-1918` (`buildPPTX`).
- **Behaviour:** flushes CVS, applies the on-screen overlap selection to `model.overlapView` (unused by the slide,
  KI-002), builds the deck from the picker (U-46) or everything, downloads "Portfolio Review_<family>_<date>.pptx".
  The button says "Download Full PowerPoint" even when only picked slides are exported. Full deck flow: Market Update
  divider and images, Portfolio Update divider, IPS, Asset, Distributor, Client, AMC, Observations; Holdings &
  Analytics divider, Holdings, Analytics, Overlap, Cost, Fund IRR; Rebalancing Opportunities divider, CVS, MF Analysis,
  Rebalancing, Holding Sheet, Post-Rebalancing Analytics, Post-Rebalancing Overlap, Rebalancing Impact; Annexure
  divider, AI Analyst, Taxation, Performance, Proposed Funds; Disclaimer; Thank You.
- **Outputs:** baseline browser deck 61 slides / 8.7 MB (TESTING §2, synthetic book); headless 50 slides (probe; the
  UI-computed groups are absent headless).
- **Status:** partial: KI-002, KI-003, KI-014 order, KI-078 / NEW-32 fixed-count overflow, KI-079 money unit, KI-082,
  KI-083, KI-090, KI-091, KI-092, KI-110; never opened in PowerPoint by a person for some groups (TESTING §5). Only one
  Review Snapshot mode exists (none); brief Phase 5 adds two.
- **Tests today:** `smoke-review.js` (≥ 30 slides, no throw); browser procedure §4 step 5.
- **Tests needed:** slide manifest per mode; overflow check at every pagination boundary; same figures as screen.
- **Reuse:** rewrite on a manifest; port the slide builders that pass review.
- **Daily:** yes.

### U-48 Excel workbook export
- **Location:** `11_app_ui.js:6025-6031` (`dlxls`); `08_exporters.js:1918-2262` (`buildXLSX`).
- **Behaviour:** "Portfolio Review_<family>_<date>.xlsx" with Base File, Asset Allocation, AMC Allocation, Distributor
  Allocation, Client Allocation, one sheet per client, Equity Analytics, Debt Analytics, Overlap Matrix, Performance
  (unfiltered), Fund IRR (IRR tree, only with an IRR upload), Observations, Portfolio Rebalancing, and AI Analyst when
  that tab has computed (probe: 14 sheets headless; TESTING baseline 15 in the browser). Values, not formulas.
- **Not exported to Excel:** IPS, Portfolio Cost, Current vs Sample, MF Analysis, Taxation, Rebalancing Holding Sheet,
  Post-Rebalancing Analytics, Rebalancing Impact, Proposed Funds performance *(code)*.
- **Status:** partial: KI-021 fails on client names with `: \ / ? * [ ]` or a shared 31-character prefix; KI-072
  unmatched PMS/AIF/SIF filed under MF buckets; KI-084, KI-085, KI-093, KI-094; no formulas, inputs or audit log
  (brief Phase 10); no re-upload of an edited workbook.
- **Tests today:** `smoke-review.js` (core sheets exist); `family-isolation.js` (no previous family in the workbook).
- **Reuse:** rewrite to the brief's Phase 10 structure; port the sheet contents that are correct.
- **Daily:** yes.

### U-49 Presentation flow and deck order
- **Location:** `TAB_SECTIONS` and `TABS` `11_app_ui.js:296-312`; exporter order `08_exporters.js:140-1918`.
- **Behaviour:** one array orders the sections, the nav and (by intent) the deck; the comment claims screen and deck
  "can never disagree".
- **Status:** partial: KI-014 (reproduced) the deck places AI Analyst and Taxation after the Annexure divider, while the
  screen has them in Rebalancing Opportunities, and the screen order cvs → mfanalysis → tax → aia → rebal differs from
  the deck's cvs → mfanalysis → rebal … → aia → tax.
- **Reuse:** port design; brief Phase 3 and Phase 9 define a new nine-section flow and market updates first.

---

## E. State, couplings and cross-cutting behaviour

### U-50 Per-family state reset (KI-001)
- **Location:** `resetFamilyState` `11_app_ui.js:258-285`; callers `:19` (×) and `:62` (a base file replacing a loaded
  one).
- **Clears:** IRR, PMS/AIF and bonds uploads (slots back to embedded); analytics scope and cache; post-rebalancing
  cache; rebalancing state, sort, filter, picker, new rows, autocomplete; slide picks; both overlap selections and
  thresholds; taxation scope; CVS action, live table, edits and snapshot; the window stashes read by exporters
  (`__REBAL_DATA`, `__PROPPERF_DATA`, `__AIA_DATA`, `__AIA_APPLIED`, `__COST_DATA`, `__PORT_COST_FULL`, `__MFA_DATA`,
  `_mfaRat`, `__REBAL_UNIV`). The status line names the uploads it cleared.
- **Keeps (by design):** MF / Direct / SIF monitors and Market Update uploads; logo; as-on date.
- **Keeps (not by design, code):** every `localStorage` setting (U-51); the Holdings column choice (`window.CZHOLD`);
  ER overrides in memory (`window.COST_OVERRIDES`).
- **Status:** partial: the session part works (`family-isolation.js` 9/9, reproduced fixed); the persisted part
  conflicts with **OD-10 (per family only)** and KI-035. A corrected file for the same family also clears its client
  uploads and plan (documented behaviour).
- **Tests today:** `tools/browser-checks/family-isolation.js` (`isolation()`, `irrBeforeBase()`,
  `removeThenReload()`).
- **Reuse:** port design; in the new build every per-review value belongs to one review object that is replaced as a
  whole.

### U-51 localStorage use
| Key | Written by | Read by | Holds | Cleared |
|---|---|---|---|---|
| `ips_profile_idx` | IPS select `11_app_ui.js:5166` | IPS tab `:5149`, IPS slide `08_exporters.js:164` | profile 0-4 | never |
| `cost_mode` | Cost buttons `:5415-5416` | Cost tab `:5218` (unguarded) | regular / direct | never |
| `cost_distributor` | Cost select `:5418` | Cost tab `:5233` | a distributor name | when "All" is chosen |
| `cost_overrides` | ER inputs `:5183` | load `:5173-5182` (divides values > 0.03 by 100, KI-060) | instrument name → ER | double-click per row |
| `cvs_cmv`, `cvs_cmv_sig` | CVS inputs `:5887` | CVS `:5690-5691` | CMV and family\|date\|CMV | "Reset to Actual" removes, then re-writes (KI-012) |
| `cvs_infl` | CVS inputs `:5887` | CVS `:5696`, CVS slide `08_exporters.js:579` | inflation % | never |
- **Status:** broken against OD-10: settings and identifying fragments (a distributor, instrument names, a family
  signature and portfolio value) persist across families and sessions (KI-012, KI-035); blocked storage blanks Cost,
  IPS and CVS and breaks the deck (KI-088, reproduced). Holdings, folios and units are never stored.
- **Reuse:** rewrite: per-review state in the review object; browser storage only for harmless conveniences, behind
  one guarded helper.

### U-52 Cross-tab couplings and render order
- **Location:** `_renderFns` `11_app_ui.js:516-532`; `renderRebal` `:3078-3083`; `rbStash` `:3689-3696`; cost → IPS
  `:5415-5416`.
- **Behaviour:** order matters: Cost renders before IPS (IPS reads the cost); MF Analysis before Rebalancing (the
  rationale draft reads `__MFA_DATA`); Rebalancing before AI Analyst (the "Applied" check). A rebalancing change
  re-renders Analytics (post-rebalancing blocks), CVS (sample column, debounced) and the AI Analyst; a Performance plan
  switch re-renders Proposed Funds; a Cost mode switch re-renders IPS.
- **Status:** working, fragile: the dependencies are implicit in call order, and a reorder silently changes outputs.
- **Reuse:** rewrite as explicit derived state from one model (brief Phase 2).

### U-53 Calculations in the UI script, handed to exporters through window globals
- **Facts (code):** the IPS actuals (`window.getIPSData`), the cost ER resolution and weighting (`__COST_DATA`), the CVS
  bucketing and sums (`_cvsSnapshot`), the MF Analysis matching and universe averages (`__MFA_DATA`, plus a second
  matcher inside the exporter), the rebalancing deltas, holding sheet, post-rebalancing model and impact
  (`__REBAL_DATA`), the proposed-funds resolution (`__PROPPERF_DATA`), the taxation scope (`__taxScope`) and the AI
  Analyst plan (`__AIA_DATA`) are computed or stashed in `11_app_ui.js`; the exporters read them from `window`
  (`08_exporters.js:164, 442, 574, 991, 1102, 1151, 1185, 1235, 1457, 1787, 2147, 2201`). Overlap (KI-002) and
  post-rebalancing overlap (KI-003) break because they reach for UI functions that are not on `window`.
- **Consequences:** headless tests cannot produce these slides (probe: IPS, AI Analyst, Proposed Funds 0 slides;
  rebalancing groups divider-only); screen and deck can diverge where the exporter recomputes (MF Analysis, cost
  fallback); a slide built before its tab renders silently omits content.
- **Status:** working in the browser, fragile and largely untested.
- **Reuse:** rewrite: one calculated model consumed by screen, PPTX and XLSX (brief Phase 2 "no duplicated calculation
  logic").

### U-54 HTML escaping of workbook text
- **Status:** broken: KI-008, many renderers insert names and text from workbooks without escaping (`11_app_ui.js:78,
  602, 815, 828, 1316, 1352, 1413, 5211, 5634` in the original record, and e.g. `renderObs`, `renderIRR`, `renderAlloc`,
  cost rows at this commit). Some newer blocks escape (`rbEsc`, `fbxEsc`, `taxEsc`, `aiaEsc`), so practice is mixed.
- **Reuse:** rewrite: escape by default; add a Content-Security-Policy that forbids network access.

### U-55 Offline, no-network operation
- **Facts:** every library and data block is embedded; no fetch / XHR / WebSocket / beacon (`tools/check-invariants.js`
  enforces it on the app code and shell); client data never leaves the browser (CLAUDE.md rule 2). Downloads use
  `Blob` + object URLs (`11_app_ui.js:5993-5997`) or `XLSX.writeFile`.
- **Status:** working (TESTING §3 check 9).
- **Reuse:** keep as a requirement of the new build; the brief's MF Screener link (Phase 4) opens a new tab and must
  not send review data.

### U-56 Renderer error isolation
- **Location:** `11_app_ui.js:529-532`.
- **Behaviour:** each section renderer runs in its own try/catch and logs "[Centricity] Error in render…" to the
  console; the section stays blank with no message on the page.
- **Status:** partial: a failure is invisible to the analyst unless DevTools is open (the 28 Jul spec warns "never judge
  by eye").
- **Reuse:** rewrite: show a visible error card with the section name and keep exports from shipping a blank section.

---

## Analyst workflows the new build must preserve

No usage telemetry exists, so frequency is taken from the documents. "Every review" means the documents describe it as
the normal path; "conditional" means it depends on the client's holdings or files.

| # | Workflow | Ids | Evidence | Frequency |
|---|---|---|---|---|
| W-1 | Open the page, upload the client base file, set the as-on date and logo, read the load message and unmatched list | U-04, U-05, U-07, U-03 | previous-owner HANDOVER §1 ("opens the file …, uploads the client base file, reviews the tabs, and exports"); DECISIONS_LOG 26 May, 29 May; TESTING §4 | every review |
| W-2 | Add the client's IRR sheet for transaction XIRR, Fund IRR and Taxation | U-13, U-28, U-31 | HANDOVER §5.2, §13 check 6; TESTING §4 | most reviews (when supplied) |
| W-3 | Add client PMS/AIF statement look-through and direct bonds | U-11, U-12 | HANDOVER §5.2; KNOWLEDGE_DUMP §3.5 ("an uploaded SOA always beats the embedded look-through") | conditional |
| W-4 | Upload a newer MF / Direct / SIF monitor than the embedded month | U-08, U-09, U-10 | OD-11 ("the analyst using the dashboard must be able to upload the latest MF Monitor and Direct Monitor") | occasional, owner-required |
| W-5 | Review the sections top to bottom; switch Regular / Direct; scope look-through to a client; select overlap funds and threshold; set the IPS profile; override ERs; edit Current vs Sample | U-17 to U-31, U-41 | DECISIONS_LOG 26 May, 19 Jun, 30 Jun, 7 Jul; TESTING §4 | every review |
| W-6 | Build a rebalancing plan by hand (boxes, picker, amounts, proposed funds, rationale) or apply the AI Analyst draft and edit it; check the Holding Sheet, post-rebalancing analytics and proposed-fund performance | U-32 to U-42 | PROJECT_HISTORY 25-29 Jul, 1-4 Sep; TESTING §4 step 9; brief (reference deck A is a rebalancing review) | reviews with rebalancing |
| W-7 | Export the full deck, or tick slides and export a subset, or download one section's slide | U-45, U-46, U-47 | DECISIONS_LOG 19 Jun, 29 Jun ("each tab has its own single-slide download, plus the full deck"), 28-29 Jul (picker) | every review |
| W-8 | Export the Excel workbook | U-48 | HANDOVER §1; TESTING §2 | every review |
| W-9 | Load the next family in the same tab without leaking the previous one | U-50 | KI-001 (High); D-015 | every session with more than one family |

---

## Gaps against the owner's brief (UI side)

| Brief item | Legacy | Status |
|---|---|---|
| Advisor-level analytics and overlap selectors (§6.5) | Analytics scope is Family / Client only; overlap has a distributor quick-select without re-basing; Cost has a distributor filter | missing (advisor scope) |
| Conditional Review Snapshot, two modes (Phase 5) | No mode; post-rebalancing blocks always shown | missing |
| MF Screener navigation item (Phase 4) | none | missing |
| Editable observations (Phase 8) | read-only text | missing |
| Historical analytics with dated snapshots (§6.6) | none | missing |
| Excel with inputs, formulas, audit log; re-upload (Phase 10) | values-only workbook, 13-14 sheets | missing |
| Import status, missing files, validation errors (Phase 3 §1) | one status line | partial |
| Market updates previewed and first in the deck (Phase 3 §8) | first in the deck, no preview | partial |
| Single shared Regular / Direct switch (OD-10) | two independent switches (Cost, Performance) | partial |

---

## Tests: what exists for the UI, what the new build needs

**Exists (at `782794f`):** `smoke-review.js` (engine + every single-tab deck except Home builds without throwing; no
slide-count assertion); `test-ai-analyst.js`; regression tests KI-007, KI-048, KI-061, KI-062, KI-063, KI-067, KI-068,
KI-114, KI-120 (the CVS ones cut UI code out by anchor); browser console checks `family-isolation.js` and
`cvs-refresh.js` (manual). Nothing tests the slide picker, the per-tab buttons, the uploads' UI paths, overlap
interactions, cost overrides, IPS, MF Analysis on screen, rebalancing editing, the holding sheet, localStorage, or
renderer failures.

**Needed (each tied to its id):**
1. Slide manifest test: for each section and each Review Snapshot mode, the set and order of slides; every offered
   download produces ≥ 1 content slide; Home offers none or produces its defined slide (U-45, U-46, U-47, U-49).
2. Screen = deck = workbook for every material figure on the synthetic book (U-17 to U-42, U-53).
3. Per-review isolation including persisted settings (U-50, U-51; OD-10), with storage blocked (KI-088).
4. Upload paths through a real file chooser, same-file re-pick, slot-type rejection, reset restores embedded data
   (U-04, U-08 to U-14).
5. Rebalancing arithmetic: amount ↔ %, Σ checks, totals, unallocated, sort stability, apply-plan equality, plan kept on
   a date change (U-33 to U-37; OD-24).
6. Overlap selection reaches PNG and slide; two panels isolated (U-26, U-40).
7. Rendering failures are visible on the page (U-56); escaping of hostile cell text (U-54).

---

## Notes on sources

- Owner decisions OD-1 … OD-36: `docs/audits/2026-10-19-decisions.md` (all accepted except OD-11, which the owner
  changed to "keep the monitor uploads, made correct").
- The previous owner's specification of the flow and picker (28 Jul) and their handover are background; where they
  differ from the code, this inventory reports the code at `782794f`.
- The headless probe and its output are kept outside this public folder (`phase0/legacyUi-scripts/`); they contain no
  client data.
