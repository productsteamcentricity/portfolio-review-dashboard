# New application architecture

Phase 0 deliverable 3. Draft of 21 Oct 2026 for the owner's review, revised 22 Oct 2026 (Phase 0 review, then the
decisions D-022, D-023 and CR-0006 and the MF Screener data pack) and on 22 Oct 2026 (the owner's answers, D-024 to
D-033; change log at the end of `open-questions.md`). It describes the **new** Centricity Portfolio Review application
(CR-0006). The legacy single file (`index.html`, last changed in commit `782794f`; `main` is at `8cb320d` with
docs-only changes since) stays live, receiving calculation, data and security fixes only (D-028), until the new
application reaches the parity defined in `05-feature-parity-matrix.md`.

**Sources.** Investigator files [DA] deck-a-spec, [OP] observation-patterns, [IE] inventory-engine-exports,
[IU] inventory-ui-workflows, [PO] previous-owner-and-requirements, [DS] data-source-inventory, [SC] mf-screener,
[TE] technology-evaluation (all to be committed under `docs/new-build/inputs/`); the owner's brief [BRIEF]
(`docs/new-build/00-owner-brief.md`); repository records `CLAUDE.md`, D-nnn (D-023 for publication and return
methods), OD-nn, KI-nnn, CR-0006. Owner questions are Q-nn in `open-questions.md`; the ten owner decisions ND-1 to
ND-10 (`owner-decisions-new-build.md`) were answered on 22 Oct 2026 as D-024 to D-033; milestones M-n in
`07-implementation-roadmap.md`.

**Evidence tags.** [V] verified by an investigator or in this session (named). [I] design choice or inference.

---

## 1. The decisions in one page

| # | Decision | Reason | Status |
|---|---|---|---|
| A1 | **Stack:** TypeScript (erasable syntax only) in plain ES modules; Preact 10.29.x for the UI; esbuild 0.28.2 bundles everything into **one offline HTML file**; a Node build script inlines the vendored libraries, the reference data (as non-executable JSON blocks) and a CSP meta tag with script hashes. npm is used for pinned build tooling only (esbuild, TypeScript) plus Preact. Tests run with `node --test` directly on the `.ts` sources. | Keeps the compliance property that matters (offline, no network, client data never leaves the browser, opens by double-click) while removing the root causes of the legacy defects: no type checking, no module boundaries, hand-written unescaped DOM, calculations hidden in UI code [TE §1, §4.4; IU U-53, U-54]. | Decided (D-025, 22 Oct 2026). Fallback if npm or esbuild cannot run: the same layout with a hand-written bundler [TE §4.1]. |
| A2 | **Runtime libraries are vendored byte-for-byte from the legacy page:** PptxGenJS 3.12.0 (with its JSZip), SheetJS CE 0.18.5 (reader; upgrade to 0.20.2+ after Q-12), Chart.js 4.4.0, chartjs-plugin-datalabels 2.2.0, each listed with its SHA-256 in `app/vendor/MANIFEST.json`. | Same behaviour as the analysts' current tool, no download needed for parity [TE §3.1 V]. | Recommended |
| A3 | **Excel is written by a small in-house SpreadsheetML writer** on the JSZip inside PptxGenJS, gated by a spike (opens in Excel without repair; styles, frozen panes, filters, recalculation). ExcelJS 4.4.0 (MIT) is the fallback. | The embedded SheetJS CE writes formulas and filters but drops styles and frozen panes [TE §5.1 V]. A 94-line spike script (9,844 bytes, recounted 22 Oct 2026) already writes a styled, formula-driven 4,169-byte workbook that SheetJS reads back [TE §5.2 V; Excel opening not verified]. | Recommended; fallback needs Q-13 |
| A4 | **One shared model and one engine** produce every number. The screen, the PowerPoint and the workbook are renderers of view-models built from that model. No exporter computes, and no renderer reads global state. | The legacy exporters read nine UI globals; that is the root cause of KI-002 and KI-003 and makes half the deck untestable headless [IE E-49; IU U-53]. Brief Phase 2. | Decided (brief) |
| A5 | **Side-by-side deployment:** the new app is built to `app/dist/index.html` (M1.2) and published at `/next/` on the existing Pages site with a "Preview" banner; the legacy `index.html` stays at `/`. At parity the new app moves to `/` and the legacy to `/legacy/`. | Brief 0.3/0.4: preserve the old app until parity; one Pages site, no new hosting [TE §7.1]. Publishing a second file changes D-007 ("Pages publishes `index.html` only"); D-024 supersedes D-007 in part. | Decided (D-024; Q-17 default) |
| A6 | **Data-class policy drives what is published.** Every source file has a class (P publishable, C private until approved, N never) and a storage location. The build embeds only what the policy allows; an internal-only build is a configuration switch. | D-023 point 1 settles publication: every Accord file (class P, D-026) and the other approved monthly source files are tracked publicly, the vendor-derived data may be embedded, client data never, files above 50 MB as PDF with the original's SHA-256. The MF Screener data pack is never embedded in a public build or committed: it is uploaded into the app and kept in the browser (D-026, section 6.9) [DS §1, §8]. | Decided (D-023, D-026) |
| A7 | **Stable identifiers first, names last.** ISIN, AMFI scheme code, vendor key and product-bank id are resolved before any name matching; name matching only proposes and is pinned by an owner-approved alias table (OD-5). | Name matching is the root of the P0 defects KI-050, KI-036, KI-054, KI-052 [IE E-13, E-32; SC §5]. | Decided (OD-5) + recommended |
| A8 | **A typed missing-data status on every value** (the brief's ten statuses plus zero). The dash stays as the on-screen and on-slide marker of a missing value, now always with a footnote naming its status; sentences never use an en or em dash (D-029). | Brief Phase 2; D-029; "never invent a number" (`CLAUDE.md` rule 3). | Decided (brief, D-029) |

---

## 2. Constraints carried forward

| Constraint | Source | How the architecture meets it |
|---|---|---|
| No network calls at runtime; client holdings never leave the browser | `CLAUDE.md` rule 2; previous owner's founding rule [PO §2.1] | CSP `connect-src 'none'`; build-time scan of the built file; one allow-listed navigation link (the MF Screener, a documented exception, D-027; Q-11 answered by the brief) |
| One file that opens from Pages, from a local server and by double-click | [TE §2] | Single self-contained HTML; no runtime module imports |
| Never invent a number | `CLAUDE.md` rule 3 | `Value<T>` statuses; renderers cannot print a missing value as zero |
| Matching thresholds never lowered; product class never crossed; debt never gets an equity benchmark | `CLAUDE.md` rule 4 | Matcher module with a measured corpus test both ways (M2) |
| Per-family isolation (KI-001, D-015) and per-family settings only (OD-10) | D-015, OD-10 | One `Review` object replaced as a whole; browser storage only for conveniences, namespaced |
| Public repository; nothing confidential committed; published docs never say where client files are kept and carry no local paths | `CLAUDE.md` rule 6, D-019, D-020, D-023 | Data-class policy; pre-push scanner (E-136) from the first push (M1.1); synthetic fixtures only |
| Financial changes need a financial review and a known-answer test | `CLAUDE.md` rule 7 | Every engine module ships with known-answer tests; parity ledger |
| Git on branches, PRs, merge verified requested work (D-017); never force-push | `CLAUDE.md` rule 8 | Each milestone is one PR or a short series |
| Cambria, the house palette, 2 decimals, money maths in Crore, display in the file's unit | [PO §3.3, §3.5] | Shared tokens and one formatter used by all three renderers |
| The monthly pipeline uses the app's parsers (one parsing path, OD-11, N-9) | [IE N-9]; OD-11 | Parsers live in `app/src/ingest/` and are imported by both the browser bundle and the Node update engine |

---

## 3. Technology stack

| Layer | Choice | Version (exact pin) | Licence | Notes |
|---|---|---|---|---|
| Language | TypeScript, erasable syntax only (no `enum`, no namespaces, no parameter properties) | 7.0.2 (`tsc --noEmit` only), 6.0.3 as a JavaScript-only fallback | Apache-2.0 | Node 24 strips the types natively, so tests and Node scripts need no build [TE §4.1 V] |
| Runtime for tooling and tests | Node.js | 24.21.0 (portable, D-006) | MIT | `node --test` on `.ts` files [TE §4.1 V] |
| Bundler | esbuild | 0.28.2 | MIT | IIFE output, readable (not minified) for auditability |
| UI | Preact (JSX, escape-by-default) | 10.29.8 | MIT | Preact 11 adopted later, deliberately |
| PowerPoint | PptxGenJS (vendored) | 3.12.0 | MIT | Native charts with embedded workbooks, native tables [TE §6 V] |
| Excel writing | In-house SpreadsheetML writer on the vendored JSZip | n/a | project | Fallback ExcelJS 4.4.0 [TE §5.2] |
| Excel reading | SheetJS Community Edition (vendored) | 0.18.5, then 0.20.2+ (Q-12) | Apache-2.0 | Reads uploads and re-uploaded workbooks |
| On-screen charts | Chart.js + datalabels (vendored) | 4.4.0 / 2.2.0 | MIT | Screen only; exports use native PowerPoint charts |
| Package hygiene | `package-lock.json` committed; `.npmrc` with `ignore-scripts=true`, `save-exact=true`; `npm ci` only | | | [TE §4.2] |

Rejected: Vite (larger tree, features not needed), React (Preact is enough), Svelte/Solid, Deno, Electron/Tauri
(installation), any server-side generation (client data would leave the browser), HyperFormula (GPL-3.0-only)
[TE §4.3, §5.3].

---

## 4. System context

```
                    +---------------------------- analyst's browser (offline) ----------------------------+
 client files ----> | Uploads & inputs --> ingest --> normalise --> validate --> ENGINE (calculate)         |
 (base, IRR, cap.   |       |                                                     |                         |
  gains, PMS/AIF    |  analyst inputs (assumptions, mode, scope, scenario, edits)-+--> observations         |
  SOA, bonds,       |                                                             |                         |
  price file,       |                    view-models (presentation model) <-------+                         |
  workbook)         |                      |              |              |                                  |
 Screener data ---> |                   screen        PowerPoint       Excel        audit log              |
 pack (private,     +---------------------------------------------------------------------------------------+
 kept in the                    ^ embedded at build time: reference data vintage (monitors, analytics, index
 browser, D-026)                | series), product bank, owner tables, market-update and disclaimer material,
                                | vendored libraries, the Screener pack fingerprints (never its contents, D-026)
 monthly_updates/YYYY-MM  ----> | monthly update engine (Node, local): classify, fingerprint, parse (same parsers),
 + private monthly inbox        | validate (including the Screener pack), normalise ids, write data/ and
   (originals, Screener pack)   | product_bank/, update report
                                |
 GitHub repository (public) ----> CI: typecheck, tests, parity, build, invariants --> Pages: / (legacy), /next/ (new)
```

Nothing in the browser talks to a server. The monthly update engine runs on the maintainer's machine (Node), reads
local files only, and never logs in anywhere [SC §1]. The MF Screener data pack (`pr-datapack_<cycle>.zip`, contract
`pr-datapack-v1`) reaches the app in two ways that share one parser: the monthly engine validates it and publishes
only its fingerprint, contract version and counts in `MANIFEST.json`; the owner uploads the same zip into the "MF
Screener data pack" slot in section 1 once per Screener cycle, the browser keeps it in IndexedDB until a newer pack
is loaded, and the page shows "validated pack" when its SHA-256 matches the manifest (section 6.9). The pack's
contents are never embedded in a public build and never committed (D-026, the owner's answer to ND-1).

---

## 5. Directory layout

Adapted from the brief's suggestion (Phase 1) and the technology evaluation [TE §10]. The legacy files keep their
paths (Pages, CI and the patch tooling depend on them). Full tree and documentation set: `09-repository-and-docs-structure.md`.

```
index.html                 legacy app, served at / until retirement (calculation, data and security fixes only, D-028)
tools/ buildtools/         legacy tooling and refresh pipeline (frozen; retired after parity)

app/                       NEW application (served at /next/)
  index.template.html      page shell: CSP placeholder, mount point, data-block slots
  tsconfig.json            strict, erasableSyntaxOnly, noEmit, jsx react-jsx, jsxImportSource preact
  vendor/                  vendored libraries + MANIFEST.json (version, source, SHA-256, licence)
  src/
    model/                 types only: identifiers, statuses, Value<T>, sources, holdings, transactions,
                           reference vintage, review, assumptions, scenario, observation, validation, audit,
                           presentation manifest
    ingest/                parsers shared by browser and monthly engine (header-driven, never positional)
    engine/                pure calculations, no DOM, no globals (sections 8 to 9)
    observations/          rule bank, thresholds, composition, lint, Review Snapshot builder
    views/                 presentation model: selection, ordering, labels, units, footnotes (no maths)
    exports/pptx/          component library, theme, chrome, measurement, pagination, manifest, cross-references
    exports/xlsx/          SpreadsheetML writer, styles, workbook spec, sheets, manifest sheet, re-upload map
    ui/                    Preact app: nav (with MF Screener link), nine sections, inspectors, state store
    services/              file input, downloads, namespaced storage, the Screener pack store (IndexedDB,
                           D-026), audit log, clock
    config/                tokens (palette, type scale), category orders, slide manifest, links, formats
    main.tsx
data/                      reference data as JSON (one file per block, with VINTAGE.json), owner tables
                           (versioned, with approval record), identifier crosswalk, compact history
product_bank/              schema, products, performance, portfolio snapshots, source register
monthly_updates/           README, _policy/, YYYY-MM/ (MANIFEST.json, UPDATE_REPORT.md, class P folders)
scripts/                   build, check, serve, vendor and data extraction, monthly-update/, validation/,
                           office/ (local Excel/PowerPoint acceptance), docs/ (monthly PRD generator)
tests/                     unit, integration, regression, parity, exports, acceptance, monthly, fixtures, helpers
app/dist/                  build output (git-ignored; M1.2 put it beside the sources, not at the root)
```

Mapping to the brief: `components` and `pages` become `ui/`; `analytics` becomes `engine/`; `data` splits into
`model/` (types) and the root `data/` (values); `configuration` is `config/`; `observations`, `exports` and `services`
keep their names; `ingest/` and `views/` are added because parsing and presentation selection are separate layers in
the brief's Phase 2.

---

## 6. The single data and calculation model

### 6.1 Layers

The brief's Phase 2 layers, each a separate set of immutable objects. A layer only reads the layers above it.

| # | Layer | Content | Produced by | Lives in |
|---|---|---|---|---|
| L1 | **Source** | `SourceFile` records (fingerprint, role, class, as-on, parser version) and raw rows with their position (file, sheet, row) | `ingest/` | `model/source.ts` |
| L2 | **Normalised** | `Holding`, `Transaction`, `RealisedGain` (from a capital-gains statement, E-141), `InstrumentRef`, `Client`, `Account`, `Folio`, `Ownership` (holders and shares, section 6.8), `Distributor`, canonical asset/product/category, money in Crore, dates as day numbers | `ingest/` + `engine/match`, `engine/classify` | `model/holding.ts`, `model/transaction.ts`, `model/ownership.ts` |
| L3 | **Validated** | Each normalised record tagged `included` or `excluded` with reasons; `ValidationResult` list (severity, blocks publication, resolution) | `engine/validate` | `model/validation.ts` |
| L4 | **Calculated** | `Review`: every metric as `Value<T>` with lineage (inputs, method, vintage) | `engine/` (pure) | `model/review.ts` |
| L5 | **Assumptions** | Analyst inputs: review mode, scope, IPS profile, plan switch, expected returns, inflation, ER overrides, thresholds version, labels | UI or workbook re-upload | `model/assumptions.ts` |
| L6 | **Scenarios** | `RebalancingScenario` (actions, amounts, units by date, destinations) and the post-scenario `Review` computed by the **same** engine | UI, AI Analyst draft, re-upload | `model/scenario.ts` |
| L7 | **Observations** | `ObservationRecord` (rule, evidence refs into L4/L6, generated text, analyst edit) and the Review Snapshot | `observations/` | `model/observation.ts` |
| L8 | **Presentation** | View-models and the `PresentationManifest` (which components, which order, which mode); PPTX rendering | `views/`, `exports/pptx/` | `model/manifest.ts` |
| L9 | **Excel** | `WorkbookSpec` (sheets, named inputs, formulas, styles, manifest sheet) and its rendering | `exports/xlsx/` | |
| L10 | **Audit** | `AuditEntry` list: imports, validation decisions, mode switches, edits, exports (with file hash), build manifest | `services/audit-log.ts` | `model/audit.ts` |

Rules:
1. **Only L4 and L6 compute.** `views/` selects, orders and labels; renderers format. A number that appears in two
   outputs comes from the same `Value`.
2. **Switching modes never changes L1 to L4** (brief Phase 5). Review Only and Review with Rebalancing differ only in L6
   to L8.
3. **Unrounded maths, rounding at the renderer** (brief Phase 13). Excel receives unrounded values with number formats.
4. **One invalid record never corrupts valid calculations:** exclusion is per record, with a reason and a count.

### 6.2 Core types (erasable TypeScript, abbreviated)

```ts
// model/status.ts
export const STATUS = {
  NOT_DISCLOSED: 'NOT DISCLOSED',
  NOT_AVAILABLE: 'NOT AVAILABLE IN SUPPLIED DATA',
  NOT_APPLICABLE: 'NOT APPLICABLE',
  NOT_COMPARABLE: 'NOT COMPARABLE',
  HISTORICAL_ONLY: 'HISTORICAL ONLY',
  CURRENT_NOT_AVAILABLE: 'CURRENT DATA NOT AVAILABLE',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT EVIDENCE',
  INVALID_SOURCE: 'INVALID SOURCE DATA',
  STALE: 'STALE DATA',
  PARTIAL: 'PARTIAL COVERAGE',
} as const;
export type MissingStatus = typeof STATUS[keyof typeof STATUS];

// model/value.ts
export type Provenance = { sources: string[]; method: string; asOf?: string; vintage?: string };
export type Value<T> =
  | { kind: 'value'; v: T; unit: Unit; prov: Provenance; coverage?: number; stale?: { asOf: string } }
  | { kind: 'missing'; status: MissingStatus; reason: string; prov?: Provenance };
// zero is a value (kind 'value', v 0); a partial aggregate is a value with coverage < 1 and is shown with its coverage

// model/ids.ts
export type InstrumentRef = {
  productClass: 'MF' | 'SIF' | 'PMS' | 'AIF' | 'ETF' | 'EQUITY' | 'BOND' | 'OTHER';
  isin?: string; amfiCode?: string; vendorKey?: string; productId?: string;
  nameKey: string;                                    // normalised display name, never a join key on its own
  resolution: { method: 'isin' | 'amfi' | 'vendor-key' | 'product-id' | 'alias-pin' | 'name-match' | 'none';
                confidence: 'exact' | 'pinned' | 'proposed' | 'unmatched'; candidates?: string[] };
};
```

`Holding`, `Transaction`, `Review`, `RebalancingScenario`, `ObservationRecord`, `ValidationResult` and `AuditEntry` are
specified field by field in `docs/DATA_DICTIONARY.md` (created in M1.1, extended by every milestone).

### 6.3 Stable identifiers

| Entity | Identifier, in order of preference | Source | Notes |
|---|---|---|---|
| Mutual fund / ETF / SIF scheme | ISIN (plan level) > AMFI scheme code > vendor key (MF Monitor display name, with rename history) > alias pin > name match (proposal only) | client file if present (Q-22); AMFI code map (1,088 rows); `FUND_RANKS.code`; the richer SIF layout; the Screener pack's `funds.json` (AMFI code, ISINs, name variants, Direct pairing) [DS §3 #3, §4 #15] | `data/identifiers/crosswalk.json` joins them; renames are history rows, so OD-23 (ranks under new names) is a lookup, not a fuzzy match; the pack's identity fields enter the crosswalk only through the same pins (a loaded pack proposes, it does not overwrite) |
| Listed stock | ISIN > normalised company key | `STOCK_RET` carries ISIN [IE E-102]; SOA uploads carry ISIN; the Screener pack's `stocks.json` (master by ISIN) | Fixes duplicate companies in top holdings (KI-041); the ISIN also joins month-end prices for direct-equity returns (D-023 point 4) |
| PMS, AIF, other products | `product_id` assigned by the product bank; names[] with sources | product bank [DS §10.1] | Never derived from a name |
| Index | canonical index id (for example `NIFTY_500_TRI`) + constituents from the Screener pack's `benchmarks.json` when supplied, else a proxy fund id and date | `data/owner/category-benchmarks.json`, index proxy map (Q-30), the owner's monthly index data (D-023 point 2) | One table replaces four legacy benchmark maps; the same id keys the index series used for drawdowns |
| Client, account, distributor | per-review ids (hash of normalised label within the review) + analyst-set display labels | base file | Never stored outside the review; labels editable (Q-68, Q-72) |
| Folio | folio number as supplied (normalised: suffixes such as "/01" kept as a sub-account) + AMC key | base file, IRR file, capital-gains statement | Client data: used only as a join key inside the review; never shown on slides, never in browser storage or logs |
| Holder | per-review id of a client label in a holder role (first, second, third holder; guardian) | base file holder columns when present (Q-79) | When no holder column exists, the row's client is the first and only holder, recorded with status NOT AVAILABLE IN SUPPLIED DATA for joint holders |
| Source file | SHA-256 | every file | Idempotent imports and monthly updates |
| Observation | `ruleId@version` + scope + evidence fingerprint | observation engine | Edits survive recomputation only if the evidence is unchanged |

Matching keeps the legacy rules (`CLAUDE.md` rule 4), adds house-token exclusion and idf weighting, returns null on
ties instead of the first key (KI-036), never crosses product class, and every change is measured both ways over the
real universes before it ships.

### 6.4 Missing-data statuses: meaning and display

| Status | Meaning | Screen and slide | Workbook |
|---|---|---|---|
| (value 0) | a real zero | `0.00` | `0` |
| NOT DISCLOSED | the source deliberately does not state it (for example a product card without a benchmark) | `—` + footnote | blank cell + status column |
| NOT AVAILABLE IN SUPPLIED DATA | no supplied source carries it | `—` + footnote | blank + status |
| NOT APPLICABLE | meaningless for this item (YTM of an equity fund; score of an index fund) | `—` + footnote | blank + status |
| NOT COMPARABLE | bases differ (gross vs net, periods, plans) | `—` + footnote naming the bases | blank + status |
| HISTORICAL ONLY | only an older vintage exists; shown in historical views only | value with its date in historical views; `—` in current views | value in Historical sheet only |
| CURRENT DATA NOT AVAILABLE | the current value is missing and the last known value is not used | `—` + footnote | blank + status |
| INSUFFICIENT EVIDENCE | not enough history or coverage to conclude (XIRR under 12 months, 3Y under 3 years) | `—` or absolute return, footnoted | blank + status |
| INVALID SOURCE DATA | present but failed validation | `—` + footnote; validation record raised | blank + status |
| STALE DATA | present but older than the freshness rule for its role | value + "s" marker + footnote with its date | value + status |
| PARTIAL COVERAGE | aggregate over a subset | value + "p" marker + coverage in the footnote | value + coverage column |

**Missing-value marker (D-029, the owner's answer to ND-5).** A missing value is shown on screen and on slides as a
dash, "—" (U+2014), as in the legacy page (OD-13, OD-29), alone in its cell or tile and always with a footnote naming
the status; "s" and "p" mark STALE and PARTIAL values. The marker characters are configuration (`config/formats`).
Renderers get the status, never a pre-formatted string, so a status cannot be printed as `0.00`. In the workbook a
missing number is a blank cell with the status in the next column (section 14), so formulas keep working. **No dash in
sentences:** a build-time lint fails on any en or em dash (U+2013, U+2014) in generated presentation text (titles,
observations, footnotes, labels, chart series names, notes); the only dash allowed is the marker itself, as the whole
content of a value cell or tile rendered from a status.

### 6.5 Scope: family, client and advisor

`Scope = { kind: 'family' } | { kind: 'client', ids } | { kind: 'advisor', distributorIds }`. Every calculated view is
`compute(rows filtered by scope, reference, assumptions)`: weights re-based within the scope, totals reconciled to the
family. The same function serves analytics, overlap, AMC, cost **and returns** (transaction XIRR, benchmark XIRR, the
IRR tree and contributors per scope), so the advisor-level selectors the brief asks for (6.5) and the Cost tab's
distributor filter are one mechanism (Q-57). Distributor-level returns (E-142, the previous owner's unshipped item 7)
need the IRR file's DISTRIBUTOR column, which `ingest/irr-file.ts` reads (the legacy parser ignores it); flows without a
distributor are reported in an "unassigned" line with their share, never spread across distributors, and a scope whose
flows do not reconcile to its holdings shows INSUFFICIENT EVIDENCE for XIRR instead of a figure (OD-4 rules per scope).
Exports carry the scope in titles and file names. Results are cached per scope.

### 6.6 The review object and per-review state

A `Review` session object holds L1 to L10 for one family. Loading another base file replaces it as a whole (the KI-001
rule, D-015). Per-family settings live in the review (OD-10); browser storage holds only conveniences (logo choice,
collapsed panels), namespaced `prd.next.v1.` and wrapped in guarded helpers (KI-088). Market data uploads (monitors,
Market Update override, the analyst's price file) are session-level and survive a family switch, as today; none of
them is written to browser storage. The one exception is the MF Screener data pack and its backfill (market data, no
client data): the browser keeps them in IndexedDB until a newer pack is loaded (section 6.9, D-026), and a family
switch never clears them. A same-family as-on date change keeps the scenario and slide picks (OD-24).

### 6.7 Units, rounding and dates

Money is held in Crore (number, unrounded); display uses the file's unit (Crore, Lakh or rupees; rupee-only files in
Crore from 1 Cr, else Lakh) through one formatter [PO §3.3]. Percentages at 2 decimals; inflation at 1. Dates are day
numbers converted from raw Excel serials by one timezone-free function (replacing the legacy +12 h shift, which stays
in the legacy only); tests run under `TZ=Asia/Kolkata` and `TZ=UTC`. Gain/loss = CMV minus invested everywhere (OD-18).
Realised gains are labelled separately (Q-49) and come from one of two sources, each named in the output: the client's
capital-gains statement when one is uploaded in the app's template (section 6.10; the source of record for a
financial year: the issuer's own lot matching and grandfathered cost, E-141), else redemptions in the IRR file matched FIFO by the engine ("derived from
transactions"). When both are present the engine reconciles them per scheme and financial year; a difference beyond
tolerance raises a High validation result and both figures are shown. Long-term = more than 12 months to the review's
as-on date (OD-2).

### 6.8 Ownership: clients, accounts, folios and holders

The brief (Phase 2) asks for accounts, folios and ownership. The model separates them:

| Entity | Meaning | Source today | Notes |
|---|---|---|---|
| `Client` | a person or entity in the family, shown by an analyst-set label (Q-68) | base file "Client Name" | the investor of record for the row |
| `Account` | client + distributor + plan (Regular or Direct) | base file | the unit of the client-level and advisor-level scopes |
| `Folio` | folio number within an AMC, belonging to one account | base file, IRR file, capital-gains statement | duplicate folios merge as today (E-02, KI-113) |
| `Ownership` | the folio's holders in order (first, second, third; guardian for a minor), the mode of holding (single, joint, anyone or survivor) and an optional share per holder | holder columns only when the file has them (Q-79); none today (V) | default: the client is the sole first holder with share 100% and joint holders NOT AVAILABLE IN SUPPLIED DATA |

Rules: allocations and client-level views attribute a holding to its first holder (as the legacy does through the
client column), never split it unless the analyst records shares; taxation groups lots by the assessee, taken as the
first holder pending the tax adviser's confirmation (Q-79, alongside OD-28); joint holders and shares appear on screen
and in the workbook's Holdings (as loaded) sheet, never on slides; ownership data is client data and follows the
storage rules of section 17 item 6.

### 6.9 The MF Screener data pack slot (D-026, the owner's answer to ND-1)

Screener scores and ranks are never in a public page: the pack is never embedded in any build and never committed.
The owner uploads it every Screener cycle into the app, and the browser keeps it. [I: design for M10 unless stated]

| Aspect | Design |
|---|---|
| Slot | Section 1 has an "MF Screener data pack" upload slot for `pr-datapack_<cycle>.zip` (contract `pr-datapack-v1`) and, once, the holdings backfill pack. It follows the Upload, Validate, Preview, Review stages of every upload (section 13.1) |
| Validation | `ingest/screener-pack/` reads the zip with the vendored JSZip and checks the contract version, cycle, file list, per-file SHA-256, counts and schemas (section 7). A failing pack is refused with the reason and nothing is stored |
| Storage | After the Review stage, `services/screener-store.ts` writes the accepted pack to the browser's IndexedDB (database `prd.next.v1.screener`), keyed by cycle and SHA-256. It stays there until a newer cycle is loaded, which replaces it as a whole. An older cycle is refused with a message naming the stored cycle; the same SHA-256 is a no-op. The month-end holdings files of replaced packs and the backfill are kept as history, because historical analytics need earlier month-ends (Q-27); every other file of a replaced pack is dropped. The analyst can remove the stored pack in section 1. A family switch never clears it |
| Sidebar | The sidebar shows the stored pack's cycle date ("MF Screener data: cycle D Mon YYYY") and its status: "validated pack" when its SHA-256 matches the published `MANIFEST.json`, "not in the published manifest" otherwise, STALE DATA when it is behind the reference vintage (shown with its date for up to three cycles, suppressed beyond, Q-21), or "not loaded" |
| Absence | When no pack is stored, every screen that needs it names the missing pack and the slot ("MF Screener data pack not loaded: scores, ranks and Screener ratios are not shown"). Slides and sheets use the metric's fallback source, named (MF Monitor, in-house risk workbook, analyst's price file), or show the dash with the status NOT AVAILABLE IN SUPPLIED DATA and a footnote that reads as a statement ("Screener data not supplied for this review"). Scores and ranks have no other source in the new app. The export dialog lists the components without Screener data (a Warning, section 16) |
| Scope of storage | IndexedDB belongs to one browser profile and one origin: a pack loaded on the Pages site is not visible to the local preview or to a copy opened by double-click, and the reverse; each loads it once per cycle. The M1.2 spike found IndexedDB available under `file://` and served, kept across a reload and a browser restart, in Edge 155 and Chrome 155 (headless), as best-effort storage; every local file shares the one `file://` origin [V: `toolchain.md` §6] |
| Never | written to `localStorage`, logs or exports beyond the figures a review uses; sent anywhere; embedded in a build (the build check fails on any pack content, `scripts/validation/check-next.mjs`, from M10); committed. Only the pack's fingerprint, contract version, cycle and counts are published, by the monthly engine |

The size of a real pack in IndexedDB (every fund's month-end holdings) is measured with the first pack (M10); if the
browser's quota is exceeded the store refuses the pack with a clear message instead of keeping part of it.

### 6.10 The capital-gains template (D-032, the owner's answer to ND-8)

Capital-gains statements are uploaded in a template the app defines, as the base file is today; the owner's sample
format may inform it but is not required, and no issuer's own layout is parsed. Section 1 offers the blank template
for download (generated by the app: a header row and a Read Me sheet with each column's meaning, unit and an
example), and `ingest/capital-gains.ts` reads it by header name (aliases allowed, as for the base file). The template
holds one row per realised lot: a sale matched to two purchase lots is two rows. Money is in rupees, units to three
decimals, dates as Excel dates; the engine converts money to Crore. The proposed columns are in
`docs/DATA_DICTIONARY.md` §5.17 and are fixed in M7 [I: proposal]. A file without the required columns is refused with
the missing columns named.

---

## 7. Module responsibilities

| Module | Responsibility | Must not |
|---|---|---|
| `model/` | Types and constants only; schema version | contain logic |
| `ingest/workbook.ts` | Wrap SheetJS: read with raw serials, formulas and cached values; sheet and header discovery by name; size limits | interpret business meaning |
| `ingest/base-file.ts` | Base file to L2 holdings (aliases, units by column label, OD-3 XIRR unit question, OD-7 blank asset unknown, OD-8 exclude and list rows without CMV, folio merge) | guess units silently |
| `ingest/irr-file.ts` | Fund and benchmark flows, transaction types (OD-16), the DISTRIBUTOR column when present (E-142), skipped-row report by reason | drop rows silently |
| `ingest/capital-gains.ts` | Client capital-gains statement in the Centricity capital-gains template (DS-C8, E-141, D-032; section 6.10) to `RealisedGain` records (scheme, folio, sale date, units, sale value, cost and its basis, purchase date, short or long term, gain, financial year derived from the sale date), by header name; the blank template for download | guess a layout; read a file that is not in the template (it is refused with the missing columns named) |
| `ingest/disclaimer.ts` | The disclaimer in use (from the monthly folder) and a session override accepted only for an approved fingerprint (Q-77) | accept unapproved text |
| `ingest/mf-monitor.ts`, `sif-monitor.ts`, `expense-ratio.ts`, `equity-analytics.ts`, `hybrid-analytics.ts`, `debt-analytics.ts`, `listed-equity.ts`, `fund-manager.ts`, `risk-ratios.ts`, `fund-ranks.ts`, `pms-performance.ts`, `aif-performance.ts` | Vendor and in-house files to reference records, **by header name**, with the monthly pipeline's rules (AUM look-up, debt sub-block, Direct sheet mapping, ER as percent with values above 5% dropped and counted) | read columns by position (KI-033, [DS §1 item 9]) |
| `ingest/soa-lookthrough.ts`, `bonds.ts` | Client look-through uploads, with format detection that refuses ambiguous files (KI-056, KI-077) | overwrite reference data |
| `ingest/screener-pack/` | The MF Screener data pack, contract `pr-datapack-v1` (`manifest.json`, `funds.json`, `holdings_<month_end>.json`, `benchmarks.json`, `categories.json`, `stocks.json`, `stock_prices_month_end.json`, `nav_month_end.json`, `managers.json`, `definitions.json`, `changes.json`, `funds_summary.csv`, `VALIDATION_REPORT.md`): unzip with the vendored JSZip; check the contract version, cycle, file list, per-file SHA-256 and record counts against the manifest; validate each file against its schema; read the pack's own validation report; normalise units; cross-check identities with the crosswalk; idempotent by the pack's SHA-256 (a re-import changes nothing); used by the browser (the section 1 slot, stored by `services/screener-store.ts`, section 6.9) and the monthly engine (validation and fingerprint) | log in, fetch, or accept a pack whose manifest, counts or schema disagree; store the pack anywhere but the IndexedDB store |
| `ingest/index-series.ts` | The index data of D-023 point 2: the five Index TRI files the owner already supplies each month in the month's `Index TRI` folder (Nifty 50, 100, 500, Midcap 150, Smallcap 250; daily rows of index name, date and total return index value per the data-source survey [DS]), by header name; columns confirmed on the first files read and refused when ambiguous | infer an index from a file name |
| `ingest/price-file.ts` | The analyst's price file for stocks the pack does not cover (for example the Stock Price to Return Calculator's Fetch Price sheet): ISIN or symbol, date, adjusted price | accept unadjusted prices without a flag |
| `ingest/pptx-cards.ts`, `market-update.ts` | Reckoner and one-pager slides (tables, chart caches) to product-bank records; Market Update deck to slide images and metadata (Node only) | infer facts from names |
| `ingest/workbook-reupload.ts` | Re-uploaded workbook: manifest check, input extraction, formula-conflict report | accept holdings edits |
| `engine/match/` | Normalisation, identifier crosswalk, instrument and PMS matchers, alias table | lower thresholds; cross product class |
| `engine/classify/` | Product class (OD-6), asset (OD-7), liquidity, direct equity (N-4 fixed), commodity | |
| `engine/aggregate/` | Totals, allocation by asset/product/client/distributor, AMC (OD-1, OD-33, OD-34), holdings sheets | |
| `engine/returns/` | XIRR (ported as-is), IRR tree with OD-4 reconciliation, contributions, benchmarks (one table), performance buckets and order, Portfolio Quants roll-up; `portfolio-returns.ts` (MF portfolio 3Y and 5Y weighted returns, D-023 point 3) and `stock-cagr.ts` (direct-equity 1Y, 3Y and 5Y CAGR from month-end prices, D-023 point 4), both with coverage | mix bases; count a missing return as 0% |
| `engine/drawdown.ts` | Drawdown and recovery on index series (D-023 point 2): maximum drawdown, peak and trough dates, months to recover, per index and for a blend at the review's current asset-class weights | use the client portfolio's history |
| `engine/lookthrough/` | Section 9 | double count |
| `engine/overlap.ts` | Pairwise overlap, pair statistics, index overlap | |
| `engine/tax/` | Classification (OD-17, OD-27), FIFO lots (units ledger first, OD-12 "not split", OD-15 apportion), realised gains for the financial year (statement first, else derived, reconciled; section 6.7), exemption already used (Q-52), roll-ups, harvesting, redemption units by date, transition buckets; lots grouped by assessee (section 6.8) | |
| `engine/ownership.ts` | Clients, accounts, folios and holders (section 6.8); attribution to the first holder | split a holding without recorded shares |
| `engine/cost.ts`, `ips.ts`, `projection.ts` | Cost chain (OD-9), IPS compliance (OD-13), Current vs Sample and pre/post projection (D-023 point 3; Q-36 answered) | estimate a missing ER |
| `engine/scenario.ts` | Apply a scenario to holdings (amounts and units), recompute with the same engine, deltas | use a second engine |
| `engine/ai-analyst/` | Ported rules-driven draft proposal (Q-55) | publish without the analyst |
| `engine/history.ts` | Pair a historical base file with the fund holdings of the same month-end (the Screener pack's `holdings_<month_end>.json`, available from 31 Mar 2026, Q-27) and the nearest reference vintage; coverage | present current holdings as historical |
| `engine/validate/` | Validation rules, reconciliation, outlier checks, publication gate | |
| `observations/` | Rule bank, thresholds, composition, lint, Snapshot (section 10, 11) | compute new metrics (they come from the engine) |
| `views/` | One view-model per component and sheet: rows, labels, footnotes, statuses, scope label, unit | do arithmetic beyond selection and ordering |
| `exports/pptx/` | Section 15 | read globals |
| `exports/xlsx/` | Section 14 | write user text into formulas |
| `ui/` | Sections, inputs, inspectors; renders view-models | calculate |
| `services/` | Files in and out, storage, the Screener pack store (`screener-store.ts`, IndexedDB, section 6.9), audit log, clock (injectable for tests) | network; store client data |

---

## 8. Calculation engine

The engine is a set of pure functions of `(normalised rows, reference vintage, assumptions, scope)`. The orchestrator
`engine/review.ts` builds the `Review` in a fixed order and records each step's inputs for lineage. Every legacy
calculation listed in `02-capability-inventory.md` has a target module and a reuse decision in
`04-reuse-and-migration-plan.md`; the known answers of the legacy tests are ported with them.

Definitions that change from the legacy, each already decided or recommended:

| Item | New definition | Authority |
|---|---|---|
| AMC cap | 20% of the mutual-fund book, breach strictly above 20.00%, same basis everywhere including the AI Analyst; group PMS/AIF/stocks outside the cap; blank AMC shown as "AMC not given" | OD-1, OD-33, OD-34 |
| Gain/loss | CMV minus invested, everywhere | OD-18 |
| Realised gain | from the capital-gains statement (in the Centricity template, D-032) when supplied, else derived from IRR-file redemptions (FIFO); source named; reconciled when both exist | brief Phase 2; Q-49; D-032 |
| Long-term holding | more than 12 months to the review's as-on date | OD-2 |
| Blank asset | unknown, with a notice (not Equity); "Fixed Income", "Debt Funds" are Debt | OD-7 |
| Missing CMV | excluded and listed | OD-8 |
| Missing base ER | blank with a footnote; no estimates | OD-9 |
| IRR reconciliation | redeemed instruments and IRR-only clients per OD-4; invalid benchmark excluded on both sides | OD-4 |
| Subtotal fund vs benchmark | averaged over holdings that have both values; fund-only average with coverage | OD-26 |
| Benchmarks | one table; arbitrage to Nifty 50 Arbitrage; BAF, multi-asset, equity savings, gold, silver, global "no benchmark" until named | OD-7 |
| Credit ratings | explicit mapping table over every label present; three buckets plus "Derivatives and hedges" and "Non-credit holdings" lines; seven-group detail kept | brief 6.4; Q-46 |
| Debt "Others" | components under 2% of the debt exposure folded into "Others" on charts, full detail in tables, note below the chart; folding happens inside one dimension only, and the label names it ("Other issuers under 2%") | brief 6.3; Q-47; section 9 rule 8 |
| Performance order | Index, Large, Diversified (incl. ELSS, Dividend Yield, Contra, Value per Q-45), Mid, Small, Thematic and Sectoral, Global, FoF; hybrid low to high risk; debt overnight to long duration; no 2Y for Debt MF | brief 7.3; Q-45 |
| Portfolio Quants | value-weighted over funds with the metric; coverage reported ("x% of value scored"); missing never zero; score, rank and ratios from the Screener pack when loaded, else the MF Monitor and the in-house risk workbook for ratios (score and rank have no other source: the dash and its footnote, D-026), source and date per metric group | [DA §4 slide 5]; Q-20 (default); D-026 |
| Portfolio 3Y and 5Y return (mutual funds) | sum over funds with a return of (weight x return) divided by the sum of their weights, where weight = the fund's share of the MF value; a fund without a 3Y or 5Y return (for example too young) is left out of the weights, never counted as 0%, and the coverage is footnoted ("3Y covers x% of MF value; n funds without a 3Y return excluded"). **Source order:** the MF Monitor the analyst uploads for the review; else the latest monthly MF Monitor in the embedded vintage; else the MF Screener data pack. One figure uses one primary source; a fund missing there is filled from the next source only when that source has the same as-on date, otherwise it is excluded and counted in the footnote. Label: "weighted average return of current holdings", never the portfolio's realised return | D-023 point 3; `CLAUDE.md` rule 3; KI-006 |
| Direct-equity returns | per stock, CAGR(n) = (P(as-on) / P(as-on minus n years))^(1/n) minus 1 for n = 1, 3, 5, on split- and bonus-adjusted month-end prices (the Screener pack's `stock_prices_month_end.json`, 72 months); else the analyst's price file. Dates are the exact anniversaries of the review's as-on date (29 Feb maps to 28 Feb); a price is taken on that date or the nearest earlier date in the series within 7 calendar days, otherwise that tenor is missing for the stock. Portfolio figure = allocation-weighted over the stocks that have the tenor; stocks without enough history are excluded and footnoted with the coverage (the workbook's IFERROR-to-0% is not copied). Replaces the vendor return columns of `STOCK_RET` for these tenors; differences go to the parity ledger | D-023 point 4 |
| Drawdown comparison | on index data only (the Index TRI files the owner supplies monthly, D-023 addendum): per index and for a blend of indices at the review's current asset-class weights, the maximum peak-to-trough fall, the peak and trough dates and the months from trough back to the previous peak (or "not yet recovered"); labelled "index data; the blend uses today's weights and is not the portfolio's own history" | D-023 point 2; Q-69 (default) |
| Index overlap | sum over stocks of min(portfolio equity weight, index weight); index constituents from the Screener pack's `benchmarks.json` when supplied, else proxied by a named index fund at a named date | [DA §4 slide 5]; Q-30 (default) |
| Pre/post projection | pre and post 3Y and 5Y returns = the portfolio 3Y and 5Y return above, computed over the pre and post fund sets (historical, with coverage); products without history use the analyst's expected return (illustrative); illustrative value(n) = current value x (1 + r)^n with the rupee difference; every figure labelled and marked "illustrative, not a guarantee" | D-023 point 3; brief Phase 9; Q-36 (answered) |
| Reference NAV for unit plans | CMV / units at the as-on date ("implied NAV, base file"), or a dated NAV where supplied | [I] |

---

## 9. Look-through framework

A **provider** per product family returns exposures for one holding or a status:

```ts
type LookThrough = {
  holdingId: string; provider: 'equity-vendor' | 'hybrid-vendor' | 'debt-vendor' | 'soa-upload' | 'bonds-upload'
    | 'direct-equity' | 'fof' | 'index-proxy' | 'none';
  asOf: string; coverage: number;                     // share of the holding's CMV explained
  equity?: { stocks: Exposure[]; mcap: Mix; sectors: Mix };   // weights as % of the holding
  debt?: { issuers: Exposure[]; ratings: Mix; sectors: Mix };
  other?: Mix;                                         // gold, REITs/InvITs, cash, derivatives
  via?: string[];                                      // wrapper chain, e.g. FoF -> underlying fund
  status?: MissingStatus; reason?: string;
};
```

Rules:
1. **Each holding routes to exactly one provider** (product class and canonical category decide); a wrapper keeps its own
   classification in allocation tables (brief 6.7), and only analytics use the look-through.
2. **FoF provider** (new, M12): multiplies the FoF's underlying-fund weights (the Screener pack's `mf_units` holding
   rows, Q-28) by each underlying fund's own look-through; reports partial coverage; never counts the FoF and its
   underlying fund twice. Without `mf_units` rows the FoF's look-through is NOT AVAILABLE IN SUPPLIED DATA, never
   estimated from names or factsheets.
3. **Hybrid sleeves** keep the legacy split (KI-055 fix) and report gross equity; a net-of-hedges figure for arbitrage
   funds is a separate, labelled metric (Q-50).
4. **Uploaded client SOA beats embedded vendor data** for the same scheme (DL 4 Sep), tagged with its own date.
5. **Aggregation** normalises each block over its exposure base (equity CMV, debt CMV) and reconciles to 100.00%;
   truncated lists (top sectors, top holdings) get an "Others" remainder that reconciles; the debt sub-2% rule applies to
   debt charts only (brief 6.2, 6.3).
6. **Coverage** is reported per block and per scope; below the observation threshold, rules qualify or stay silent
   (rule bank §4).
7. **Index constituents and proxies** use the same provider shape (Q-30): the Screener pack's benchmark constituents
   when supplied, else a named index fund, so active share and index overlap are ordinary look-through comparisons.
8. **Never combine incompatible dimensions** (brief 6.3). Every chart and table series declares one `dimension`
   (credit rating, rating bucket, issuer, sector, instrument type, market cap, duration bucket) and one `basis` (the
   denominator: equity exposure, debt exposure, MF book or total CMV). The view-model builder rejects a series whose
   categories come from two dimensions (for example a rating bucket and an issuer, or "Derivatives and hedges" inside
   a credit-rating pie), or whose values use two bases (for example % of the debt sleeve beside % of the portfolio).
   Non-credit lines ("Derivatives and hedges", "Non-credit holdings", Q-46) are shown beside the credit buckets, never
   inside them; "Others" folds components of one dimension only and says which; a holding's debt sleeve and a direct
   bond are summed only after both are expressed on the same basis. The check is a unit test on every view-model and
   an assertion of AC-07 and AC-08.

---

## 10. Observation engine

Full specification: `observation-rule-bank.md`. Summary:

- A **rule** is data plus three pure functions: `inputs` (metric paths in the `Review`), `trigger(review, thresholds)`,
  `evidence(review)` returning `Evidence[]` (metric, value, unit, source, as-on, coverage), and templates for the four
  parts **Evidence, Diagnosis, Implication, Action** per mode (Review Only, Review with Rebalancing).
- **Root questions and SWOT.** Every rule declares a `driver` ("risk", "return" or both), so the observations answer
  the brief's two root questions, "What drives portfolio risk?" and "What drives portfolio return?", under those
  headings; and a `swot` list (one or two of Strengths, Weaknesses, Opportunities, Threats) with a short pointer
  template per quadrant, so the one-slide SWOT (C-14) is built from fired rules by an explicit mapping (rule bank §1,
  §4 item 10, §8).
- **Thresholds** live in one versioned table (`data/owner/observation-thresholds.json`), approved by the owner on
  22 Oct 2026 with a fund pair overlapping from 35% (D-030).
- **Data-quality gates:** a clause is emitted only if every placeholder is filled from evidence; coverage under 80% adds
  a qualifier; under 50% the rule stays silent and records PARTIAL COVERAGE.
- **Composition:** rank by materiality (share of the book affected times severity); 6 to 8 per slide, the rest in the
  workbook; one rule, one sentence family (duplicates suppressed); house views attached only to fired rules (Q-64).
- **Lint:** no en or em dashes in any sentence (D-029), no hindsight verbs, no unsourced product claims, no unfilled
  placeholders, no sentence repeated across slides, no personal names (entity labels only, Q-68).
- **Editing:** the analyst edits `textEdited`; the evidence and the calculation do not change. If the evidence
  fingerprint changes after an edit, the edit is flagged "evidence changed, please re-check" instead of being kept
  silently. Every edit is an audit entry.

## 11. Review Snapshot modes

| | Portfolio Review Only (default) | Portfolio Review with Rebalancing |
|---|---|---|
| Available | always | only with a **valid** scenario: amounts reconcile, every released amount has a destination or an explicit "cash" line, the post-scenario `Review` computed without blocking errors |
| Content | **mandatory facts** (below), each a value or a status, never silently dropped; verdict; what is working (up to 4 evidence cards); what needs attention (up to 6 rows of Evidence, Diagnosis, Implication); next steps without destinations (Q-63); no pre/post figures, no implied rebalance | **mandatory RB slots** (below) plus the verdict, cards and attention rows with action tags "In the plan" / "Next step" |
| Deck | one `review-snapshot` component in RO variant; rebalancing section omitted | one `review-snapshot` in RB variant; rebalancing section and post-rebalancing components included |
| Switching | never touches L1 to L4; recorded in the audit log and the presentation manifest | same |
| Missing proposal data | n/a | the mode selector refuses RB and names the failing checks; no unsupported post figures are ever shown |

**Mandatory Review Only facts** (brief Phase 5). Rule materiality chooses the cards and attention rows, but it does not
choose these: a fixed "portfolio facts" strip carries every item, each as a value with its as-on date or as a status
with a footnote (for example INSUFFICIENT EVIDENCE for risk-adjusted metrics under three years of history).

| # | Item | Metric (view-model path) |
|---|---|---|
| F1 | Current value | `totals.cmv` |
| F2 | Invested value | `totals.invested` |
| F3 | Unrealised gain/loss | `totals.gain` and % of invested (OD-18) |
| F4 | Asset allocation | `alloc.asset[*].pct` (compact bar with fixed category colours) |
| F5 | Market-cap exposure | `lookthrough.equity.mcap.{large,mid,small}` with coverage |
| F6 | Sector exposure | top-three sectors and their combined share (`lookthrough.equity.sectors`) |
| F7 | Performance against benchmarks | portfolio XIRR against benchmark XIRR on the same flows (IRR file), else the weighted average 3Y return of current holdings (D-023 point 3, with coverage) against the weighted category benchmark on the same funds, labelled with its basis |
| F8 | Risk-adjusted metrics, where meaningful | value-weighted Sharpe and alpha from Portfolio Quants with "% of value covered" (E-132) |
| F9 | Concentration | largest fund house share of the MF book against the 20% cap, and the top-10 stock share |
| F10 | Overlap | highest pair and the share of pairs at or above the high-overlap threshold |
| F11 | Fund quality | value-weighted score with "% of value scored", and the share of the MF book in funds behind their benchmark on two tenors |

Each of concentration, overlap and fund quality also appears as a finding: if no rule in that family fired, the
attention area carries the neutral fact line for it ("No pair of funds shares 35% or more of its holdings", the
overlapping-pair threshold of D-030), so the
three findings the brief names are always present. Geometry: verdict banner 36 pt, facts strip two rows of
tiles (50 pt), cards and attention rows below; the measured-fit test proves the slide fits, and an attention row that
does not fit moves to the observations section, never a fact.

**Mandatory Review with Rebalancing slots** (brief Phase 5): (1) principal issues: the top attention rows; (2)
weaknesses addressed: each tagged "In the plan" with the plan line that addresses it; (3) quantified pre/post changes
and construction improvements: the "what the plan changes" strip of up to six metrics where **both** sides are
computed (funds, AMC maximum, overlap, top-10 share, value-weighted score, effective equity); (4) changes in overlap,
fund quality or risk measures where supported (status when not); (5) trade-offs and risks (REB-03); (6) tax, liquidity
and execution constraints: estimated tax on the plan (C-39), exit-load windows (status until E-140), lock-ins (ALL-07),
number of transactions and execution dates; (7) conclusions and next steps (SYN-01 and the next-step list). A slot
without supporting data shows a status, never a figure from elsewhere.

The component follows the fixed slots of reference deck A slide 4 [DA §4 slide 4], built as one component with fixed
geometry instead of free text boxes.

## 12. Product bank

Schema from [DS §10]; stored under `product_bank/`:

| Part | Key | Content | Rules |
|---|---|---|---|
| `products/<product_id>.json` | `product_id` (bank-assigned) | names[] (each spelling with its source), external ids (AMFI code, vendor key; ISIN and SEBI registration when a source states them), product type, Centricity section, structure, terms, fees, house flags, benchmark name, managers (Q-05) | every field carries `source_file` (SHA-256), slide, table or chart, as-on and extraction method; a field no source states carries a status, never an inference from the name |
| `performance/<product_id>/<as_on>.json` | `product_id` + as-on + source | returns by period with `period_basis` (absolute under 1Y, else annualised) and `return_basis` (gross, net, TWRR, pre-tax) | never compared across bases |
| `snapshots/<product_id>/<as_on>.json` | `product_id` + portfolio as-on | top holdings, sectors, market cap, ratings, countries, unlisted companies | always PARTIAL COVERAGE (top-N) |
| `source_register/<YYYY-MM>.json` | SHA-256 | every source file used, class, role, records added and updated | idempotent: an existing fingerprint is a no-op |

Name matching only **proposes** a link to an existing product; confirmation is a pin in
`product_bank/pins.json` (the sister project's precedent). The 143 hard-coded proposed products in the legacy UI
(`REBAL_FUND_EXTRAS`) become bank entries (M11). The Investment Reckoner is the product-bank source (the brief; Q-03
answered). Publication of bank content follows the data-class policy (D-023 point 1; manager names per Q-05, default).

## 13. Monthly update engine

Operated by one instruction ("I have updated the files in the monthly_updates folder. Process the updates and prepare
the current month's data."). Node scripts in `scripts/monthly-update/`, importing the app's parsers (one parsing path):

1. **Locate** the active data month: the newest `YYYY-MM` with unprocessed files in the private monthly inbox (path
   from an environment variable, `PRD_MONTHLY_INBOX`) and in `monthly_updates/YYYY-MM/` (Q-26).
2. **Classify** each file by content signature, then structure, then name [DS §9]; a name and content disagreement stops
   that file. Client material is quarantined and reported, never copied (class N). Two roles are added for the 22 Oct
   decisions: `screener_pack` (a zip whose `manifest.json` names contract `pr-datapack-v1`) and `index_data` (the five
   Index TRI files the owner already supplies in the month's `Index TRI` folder, D-023 point 2 and its addendum).
3. **Fingerprint** (SHA-256 + role + data month). Same fingerprint: no-op. Two fingerprints for one role and month:
   **competing files**, the role stops and both are reported. A byte-identical copy of last month's file: stale copy,
   stops.
4. **Validate** dates (in-file as-on vs name), header drift against last month, row-count floors, integrity tests (sums
   to 100, ER units, `Sortino >= Sharpe`), privacy scan of every class P file. The Screener pack is validated by
   `ingest/screener-pack/` (contract version, file list, per-file SHA-256, counts, schemas, its own
   `VALIDATION_REPORT.md`, identity cross-checks against the crosswalk and the MF Monitor); a pack that fails is
   reported as "rejected: reason" and the review falls back (AC-16).
5. **Extract and normalise** to `data/` (reference vintage, including `data/refdata/index-series.json` from the index
   data) and `product_bank/`, resolving identifiers through the crosswalk; carry-forward only under the legacy rules
   (same key, tagged with its vintage). The Screener pack's contents are never written to `data/` (D-026): only its
   fingerprint, contract version, cycle and counts go into `MANIFEST.json`.
6. **Preserve history:** the previous vintage moves to `data/history/<YYYY-MM>/` in compact form (the blocks historical
   analytics needs). Fund holdings history comes from the Screener packs' month-end holdings (from 31 Mar 2026, the
   one-time backfill; Q-27), kept in the browser's Screener store with the pack (section 6.9).
7. **Recalculate and reconcile:** run the parity and regression suites on the new vintage; compare the synthetic
   reviews before and after; report material changes.
8. **Report:** `monthly_updates/YYYY-MM/UPDATE_REPORT.md` and `MANIFEST.json`: files processed, rejected or unrecognised,
   products added or changed, performance updated, snapshots created, market-update and disclaimer versions, missing
   files, data-quality issues, Screener pack status ("supplied and validated", "not supplied", "rejected: reason"),
   index data status, files above 50 MB tracked as PDF with the original's SHA-256 (D-023), outputs refreshed, items
   for analyst review. It never says "success" when a step failed.
9. **Legacy adapter:** until retirement, `scripts/monthly-update/legacy-splice.ts` writes the same data into the legacy
   `index.html` through the existing splice rules, so both apps carry the same vintage. Refreshes are merged only after
   the owner's review ("publish"), as today.
10. **Parity with the legacy pipeline.** The legacy `buildtools/` pipeline reproduced the embedded September 2026 data
    byte for byte [D: `docs/refresh-log/2026-09.md`]. The new engine must do the same before it replaces it:
    (a) in CI, `tests/parity/monthly-pipeline.parity.test.ts` runs the legacy build scripts and the new engine on the
    same synthetic vendor month and compares every produced block after canonical JSON normalisation (differences
    classified in the ledger); (b) locally and privately, `scripts/monthly-update/parity-local.ts --month 2026-09`
    re-derives every reference block from the archived licensed files (read through `PRD_MONTHLY_ARCHIVE`, never
    copied) and compares canonical hashes with the blocks embedded in the legacy `index.html`; it writes only block
    names, record counts, hashes and the classification of each difference, never values; (c) the first live month
    is run by both pipelines and compared the same way before the legacy pipeline is retired.
11. **Monthly PRD and handover.** Every completed cycle produces `docs/monthly-prds/YYYY-MM-Portfolio-Review-PRD.md`
    (sections A to I) and refreshes `docs/HANDOVER.md`. Until M14 automates it, the maintainer writes it by hand from
    `docs/monthly-prds/TEMPLATE.md` (created in M1.1), starting with the 2026-10 data month, and
    `scripts/validation/monthly-prd-check.mjs` checks the sections and runs the privacy scan (Q-76).

### 13.1 Design reference: the Claude Artifact upload console

The brief's fourth context item is a Claude Artifact, the "One Digital Reckoner Console": a monthly upload tool with
the flow Upload, Validate, Preview, Review, Approve, Final Excel, processing in the browser only, with no
portfolio-review layout or visual spec. It was read on 22 Oct 2026 (Q-84 answered); the evaluation below stands.

| Aspect of the reference | Used in the new app | Not used |
|---|---|---|
| Stage flow Upload, Validate, Preview, Review, Approve, Final Excel | **Section 1 uploads** follow the same stages: Upload (file picked), Validate (structure, dates, identifiers; severity per result), Preview (rows read, rows excluded with reasons, matched-to disclosures, the as-on date), Review (the analyst accepts or removes the file), and only then does the file feed the review; the source register records each stage. **Monthly update** follows it end to end: Upload (files dropped in the monthly folder), Validate (classification, fingerprints, competing files), Preview (`UPDATE_REPORT.md` with the before and after summary), Review (the owner reads the report and the pull request), Approve (the owner's "publish"), Final (the merged reference vintage and product bank; the update report is the "final Excel" equivalent and the reference workbook can be exported from it) | |
| Browser-only processing | consistent with the offline rule: client files never leave the browser | |
| Layout and visuals | | no portfolio-review layout or visual spec exists in it; the screen follows the nine-section structure and the deck design system |

## 14. Excel model

Sheet structure (adapted from the brief's Phase 10 list; one table per sheet so filters and frozen panes work):

| # | Sheet | Content | Editable on re-upload |
|---|---|---|---|
| 1 | Read Me and Controls | purpose, review id, scope, mode, data vintages, sources (MF Screener named as plain text with its cycle date), how to edit and re-upload, colour key | no |
| 2 | Source Register | every source file: role, name, date, SHA-256, class, status | no |
| 3 | Holdings (as loaded) | the brief's "Source Inputs": computed values of the holdings as loaded, one row per holding with ids, ownership and statuses; the sheet keeps the name the owner accepted in OD-22 | no (changes reported as unsupported) |
| 4 | Assumptions | named input cells (mode, IPS profile, plan switch, expected returns, alternate-product returns, inflation, ER overrides, thresholds version); unlocked, tan | yes |
| 5 | Portfolio Overview | allocation by asset, product, client, distributor; AMC; IPS rows; KPIs; `SUMIFS` over Holdings | no (formulas) |
| 6 | Observations | rule id, evidence values, generated text, edited text | edited text column |
| 7 | Equity Analytics | market cap, sectors, top holdings, counts, coverage | no |
| 8 | Debt Analytics | ratings (buckets and detail), issuers, sectors, YTM, duration, coverage | no |
| 9 | Overlap | matrix, pair list, index overlap | no |
| 10 | Historical Analytics | dated snapshots with as-on and coverage; the index drawdown table (index data, D-023 point 2) | no |
| 11 | Holdings | calculated holding rows (weights, gain by formula, XIRR engine values) | no |
| 12 | Performance | trailing returns, benchmarks, Portfolio Quants metrics with source and date per metric; the MF portfolio 3Y and 5Y weighted returns by `SUMPRODUCT` over the funds with a return, with the coverage cell and source per fund (D-023 point 3); direct-equity 1Y, 3Y and 5Y CAGR per stock from the prices used (both dates and prices shown) and the weighted portfolio figure with coverage (D-023 point 4) | no |
| 13 | Fund IRR | IRR tree; flows; engine XIRR plus an Excel `XIRR` check column (Q-60) | no |
| 14 | Rebalancing | scenario inputs (action, amount or %, destinations, units by date), post weights and pre/post projection by formula | yes (inputs) |
| 15 | Tax and Transactions | lots, long/short-term, realised gains by source (statement or derived) with the reconciliation, harvesting, plan tax impact | no |
| 16 | Cost | ER per holding, weighted cost by formula | override column via Assumptions |
| 17 | Market Updates | list of market-update and disclaimer material used, with dates | no |
| 18 | Annexure | product-bank entries referenced in the review | no |
| 19 | Audit Log | validation results (severity, decision), edits, exports, build manifest | no |
| 20 | `_manifest` (hidden, protected) | schema version, build id, review fingerprint, map of named inputs and editable ranges, fingerprint of every formula cell | no |

Conventions: Cambria 9 pt; black header row with white bold text; 0.5 pt grey borders; frozen header row (and first
column where useful); autofilter on every data table; number formats `#,##0.00;[Red]-#,##0.00` and `0.00"%"`;
**no merged cells in data ranges**; numbers stored as numbers, statuses in a separate column, never a dash in a numeric
column (the dash marker of D-029 is for the screen and slides; in the workbook a missing number is a blank cell with
its status beside it); `fullCalcOnLoad` set; user text written as inline strings, never as formulas (formula injection guard); sheet
names sanitised and unique (KI-021).

**Re-upload** (M6): read with SheetJS (formulas and cached values); verify `_manifest` (schema version, review
fingerprint: the workbook must belong to the loaded review); extract supported inputs; report formula conflicts (a
formula cell replaced by a constant or a different formula) and unsupported changes; recompute with the engine; compare
the engine's results with Excel's cached values and report differences; refresh view-models and outputs; write an audit
entry per changed input. The engine stays the only calculator; Excel formulas mirror it.

**How "no formula errors" is proved** (brief Phases 10 and 14; R6 in [TE §12]). Neither SheetJS nor ExcelJS
calculates formulas and HyperFormula is rejected (GPL), so CI uses three checks of its own, and Excel itself stays a
local differential check:
1. **Formulas are built, not typed.** The writer accepts formulas only from a typed builder (`exports/xlsx/formula.ts`)
   whose references point at declared tables, columns and named inputs of the `WorkbookSpec`. At build time every
   reference is resolved: a missing sheet or name, a range outside its table, or a self-reference fails the export
   (no `#REF!` or `#NAME?` can be written). Only an allow-listed function subset can be emitted (SUM, SUMIFS,
   SUMPRODUCT, IF, AND, OR, MIN, MAX, ABS, ROUND, arithmetic and comparison; `XIRR` only in the check column).
2. **Formula results are evaluated in CI.** `tests/helpers/formula-eval.ts`, a small in-house evaluator for exactly
   that subset (no dependency; `@formulajs/formulajs` 4.6.1, MIT, is the alternative now that npm is allowed, D-025), evaluates
   every formula cell of the generated workbook from its inputs and compares the result with the engine value within
   1e-9 relative; any error value (`#DIV/0!`, `#VALUE!`, `#N/A`) or mismatch fails. This replaces "cached values equal
   the engine", which only proved the writer copied engine values.
3. **Edits are checked too.** The same evaluator runs on the workbook after the AC-17 edits (an input changed, a
   formula replaced), so a re-uploaded workbook's dependent cells are proved consistent.
4. **Excel recalculation (local).** `scripts/office/accept-xlsx.ps1` opens the workbook through COM from a short path,
   forces a full recalculation, scans every cell for error values and compares Excel's results with the evaluator's.
   It runs whenever `exports/xlsx/**` or a sheet's view-model changes (a release-gate item, `08` §7), not only at
   M1.4, M6, M9 and M15; a difference is a bug in the evaluator or the builder and blocks the release.
The Excel `XIRR` check column is the one formula the evaluator does not compute; it is verified by step 4 only.

## 15. PowerPoint component library

Full catalogue and tokens: `deck-design-system.md`. Architecture:

- **Components** (`exports/pptx/components/C-nn-<name>.ts`) take a view-model and a layout box and emit PptxGenJS calls.
  43 components (cover, title, divider, market update, disclaimer, closing, Review Snapshot, allocation, analytics,
  overlap as a native table, quants, holdings, performance, rebalancing, redemption, tax, annexure product card,
  drawdown comparison ...).
- **Presentation manifest** (`config/slide-manifest.json` + `exports/pptx/manifest.ts`): sections in order, components
  per section, inclusion conditions (data present, mode, scope), and the divider rule (a divider only when its section
  has content). The same manifest drives the full deck, the slide picker and per-section downloads, so a download button
  exists only where a component would produce a slide (fixes the KI-124 class).
- **No hard-coded slide numbers:** text refers to components (`{ref:redemption-plan}`), resolved to slide numbers after
  pagination.
- **Theme:** Cambria as theme heading and body font; brand colours as theme accents (theme XML post-processed through
  the vendored JSZip, verified in the M9 spike), so text added by hand in PowerPoint matches the brand [DA §7 item 8].
- **Pagination:** deterministic, from a committed Cambria width table measured once in the browser, used identically in
  Node tests and the browser; tables split by measured row heights with header rows repeated (replaces the fixed-count
  pagination behind KI-078, KI-110, KI-122).
- **Native and editable:** charts are native with embedded workbooks; tables are native; full-slide pictures only for
  supplied artwork (cover photo, market-update pages pending Q-38). Dividers, title and closing are native shapes with
  editable text; logo lower-right on placeholder slides, top-right on content slides (Q-39).
- **Market updates first** (after cover and title, Q-32); one Review Snapshot per deck in the selected mode.
- **Build channel marker.** A deck or workbook exported from a build that is not released for client use (the
  `/next/` preview before switch-over) carries "Preview build, not for client use" in the footnote band of every slide
  and in the workbook's Read Me; a release build carries none. This is the only permitted watermark-like text, and the
  QA checks assert it (`deck-design-system.md` §8).
- **Export isolation.** A deck or workbook is built only from the current `Review` object; embedded chart workbooks,
  speaker notes and alternative text are generated from the same view-model, so nothing from a previously loaded
  family can survive in an export (tested in AC-20 and `integration/export-isolation.test.ts`).

## 16. Validation, severity, reconciliation and audit

**Severity model** (brief Phase 13):

| Severity | Effect | Examples |
|---|---|---|
| Blocking | no client deck or workbook can be exported until resolved | base file unreadable; totals fail reconciliation beyond tolerance; review fingerprint mismatch on re-upload; a client file found in the monthly folder |
| High | export allowed only after the analyst acknowledges it; the acknowledgement is an audit entry | unmatched holdings above 5% of CMV; IRR flows not reconciled to the base file; a missing benchmark for a held category; stale reference data for a shown metric |
| Warning | footnoted automatically | partial look-through coverage; a holding younger than 12 months quoted with XIRR; an outlier flag; a weighted 3Y or 5Y return or a direct-equity CAGR whose coverage is below 100%; a Screener pack refused at load (the fallback source is named); no Screener pack stored while a component in the deck uses one (section 6.9) |
| Information | logged only | carried-forward vintages; alias pins used |

Each `ValidationResult` records rule id, scope, message, severity, `blocksPublication`, `resolution`
(`auto-resolved` / `analyst-decision` / `none`) and status.

**Reconciliation suite** (run on every review and in tests): invested and current value (rows to totals, per client, per
scope); units x implied NAV = CMV; unrealised gain; allocations sum to 100.00%; equity and debt subtotals; look-through
blocks; rating groups; performance periods and benchmarks present; pre/post totals (a pure switch keeps total value);
tax lots add back to holdings; redemption amounts = units x reference NAV; and **cross-output consistency**: a registry
of material figures (`totals.cmv`, `totals.invested`, `alloc.asset.*`, `amc.*`, `xirr.portfolio`, ...) is read back from
the screen view-model, the PPTX (slide text inventory) and the XLSX (cell values) and must agree after display rounding.

**Outlier checks:** robust z-scores (median and MAD) per category for monthly reference changes and per holding for
values; flag at six sigma where at least 30 comparable points exist; flagged values keep their source and need review;
unusual is not an error.

**Audit log:** imports (file hash, rows read, rows excluded by reason), validation decisions, mode and scope switches,
analyst edits (before and after), re-uploads, exports (file name, SHA-256 of the produced file, manifest), the build
manifest (commit, data vintages, library hashes). Exported in the workbook's Audit Log sheet; never sent anywhere.

## 17. Security

1. **CSP meta tag** as the first element of `<head>`: `default-src 'none'; script-src 'sha256-...'; style-src
   'sha256-...'; img-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';
   frame-src 'none'; worker-src 'none'; manifest-src 'none'`. Script and style hashes computed by the build, so no
   `'unsafe-inline'` [TE §8]; no `font-src` (Cambria is a local font, so `default-src 'none'` applies). As built in
   M1.2 (the Phase 0 text had `style-src 'unsafe-inline'` and `font-src data:`; `toolchain.md` §8). The M1.2 spike
   ran the page under this CSP from `file://` and served, in Edge 155 and Chrome 155 [V: `toolchain.md` §6].
2. **Data blocks** are `<script type="application/json">` with `<` escaped, parsed with `JSON.parse`.
3. **Escaping by default** through Preact. A build-time invariant fails on `innerHTML`, `outerHTML`,
   `insertAdjacentHTML`, `document.write`, `dangerouslySetInnerHTML`, `eval`, `new Function` in `app/src`, and on any
   network API or URL in the built file except the allow-listed navigation link.
4. **MF Screener link:** one constant in `config/links.json`; `<a target="_blank" rel="noopener noreferrer">`, no
   query string, no prefetch, no availability check; the invariant allows this URL only in that form. It is the one
   documented exception to the no-remote-URL rule (D-027): the owner asked for the link in the brief and the
   Screener refuses to be framed and requires sign-in, so it opens in a new tab (Q-11 answered) [SC §1, §2].
5. **Uploaded files** are untrusted: size and sheet-count limits, SheetJS reader upgraded for the published CVEs (Q-12),
   prototype-pollution-safe object creation, formula-injection guard on every string written to Excel.
6. **Storage:** namespaced keys, guarded access, no holdings, folios, values or names in browser storage (OD-10). The
   only dataset kept in browser storage is the MF Screener data pack (market data, no client data), in its own
   IndexedDB database (section 6.9, D-026).
7. **Supply chain:** exact pins, lockfile review, `ignore-scripts`, vendored libraries verified against their SHA-256 at
   every build; deterministic build (same inputs, same hash).
8. **Secrets:** none in the repository, logs, outputs or PRDs. Screener data arrives as a file pack (Q-18 answered),
   so no Screener credential or token is used, stored or documented anywhere; nothing logs in. The pack itself is
   written only to its IndexedDB store (section 6.9), never to `localStorage`, logs or exports beyond the figures a
   review uses, and never into a build.
9. **Pre-push scanner** (`scripts/validation/prepush-scan.mjs`), built in M1.1 before the first push: client-data
   patterns (PAN, e-mail, phone, folio, ARN and registration numbers, honorific plus name, rupee amounts with units,
   client and folio headers), secret patterns, local user paths, personal GitHub account URLs, and a deny-list of
   client, family and person names. The deny-list itself is private: it is read from a local file named
   by `PRD_PRIVACY_DENYLIST` (outside the repository) and is never committed; in CI, where that file does not exist,
   only the generic patterns run and the report says so. M11 extends the scanner to binaries (office files are
   unzipped and their text parts scanned), file classes under `monthly_updates/` and size caps.

## 18. Build, test, deploy and the legacy app

| Command | Does |
|---|---|
| `npm ci` | installs the lockfile (scripts disabled) |
| `npm run typecheck` | `tsc --noEmit -p app` |
| `npm test` | `node --test` over `tests/**/*.test.ts` with `TZ=Asia/Kolkata`; `npm run test:utc` with `TZ=UTC` |
| `npm run parity` | new engine vs legacy engine (`tools/engine-host.js`) on the synthetic books against `tests/parity/ledger.json` |
| `npm run build` | `scripts/build.mjs` -> `app/dist/index.html` + `build-manifest.json` (M1.2; staged by Pages as `next/index.html`) |
| `npm run check` | `scripts/validation/check-next.mjs`: CSP first, hashes match, no network, one allowed link, banner, size budget; `--rebuild` for the deterministic build (M1.2; `toolchain.md` §5) |
| `npm run serve` | `scripts/serve.mjs`, 127.0.0.1:8100: legacy at `/`, new at `/next/` |
| `npm run update -- <YYYY-MM>` | monthly update engine (local; needs `PRD_MONTHLY_INBOX`) |
| `npm run accept:office` | local only: open the latest exports in Excel and PowerPoint through COM from a short path |

**CI:** the existing `ci.yml` job stays as it is (legacy gates); a second job `next` is added in M1.1 in a
zero-dependency form (Node 24 only: privacy scan of the diff, docs link check, `node --test` over `tests/`,
traceability once tests exist) and extended in M1.2 with `npm ci`, typecheck, build and invariants; later milestones
add parity, export structure and acceptance tests. **Pages:** `pages.yml` stages `_site/index.html` (legacy) and
`_site/next/index.html` (new) after both gate sets pass; this supersedes D-007's "publish `index.html` only" in part
(D-024, 22 Oct 2026). While the preview has no users, a failing new build blocks the
deploy (fix forward); once analysts rely on it, the new-app steps stage `next/` only when they pass, so a legacy
hot-fix is never blocked [TE §7.1].

**Coexistence rules:** the legacy page is the review link until parity (Q-17); nothing exported from `/next/` is used
for a client before switch-over (the build channel marker, section 15; D-024); the live page receives calculation,
data and security fixes and presentation-only improvements go to the new build (D-028), so the CR-0005 fix batches
(2 to 7, D-021) continue without their presentation-only items, and legacy batch 2a (OD-32 and OD-34 with KI-124,
D-022) proceeds; every legacy fix is ported to the new app with the same known answer; both apps carry the
same data vintage through the legacy splice adapter; the parity ledger classifies every output difference as
intentional improvement, correction or regression, and an unclassified difference fails CI.

## 19. Size and performance budget

Libraries about 1.6 MB, data and images about 14 MB (today's blocks), application code under 1 MB: about 17 MB, as
today [TE §11]. Reference data is parsed once from JSON blocks (faster than today's 10 MB object literal, which took
about 767 ms [PO §2.5]). `computeReview` stays under 500 ms at 50 holdings; scope results are cached; exports run on
demand. The build fails above a 25 MB budget.

## 20. Phase 2 readiness (brief Phase 16)

The scenario model already carries what an automated rebalancing engine needs: unit-level lots and eligibility dates
(long-term, exit-load windows), per-date redemption schedules, destinations with product class and asset constraints,
transition buckets with analyst thresholds (Q-54), the AI Analyst as a pluggable "proposal source", and pre/post
recomputation through the same engine. The AI Analyst constraints the previous owner held on 4 Sep (the coded but
inactive minimum-investment constraint, and a soft AMC target) are ported as named constraints in
`data/owner/ai-analyst.json`, off by default exactly as today, so Phase 2 can switch them on (E-145, Q-81). The interface `ProposalSource.propose(review, constraints) -> RebalancingScenario`
is defined in M8; no decision engine is built now.

## 21. Decisions recorded (D-024 to D-033, 22 Oct 2026)

D-022 (the owner's acceptance of OD-29 to OD-36, merged in PR #7) and D-023 (publishing vendor files and the return
methods, 22 Oct 2026, merged in PR #8 with CR-0006) were taken first, so the new-app decisions start at D-024. The new
build itself (a clean app beside the legacy page, which stays the review link until parity) is recorded by CR-0006, so
the earlier separate "build beside the legacy" proposal is folded into D-024. The owner answered ND-1 to ND-10 on
22 Oct 2026 and gave Claude full charge of GitHub and the dashboard (D-033); the lead decided the items the owner did
not comment on. All are recorded in `docs/DECISIONS.md`:

| Id | Decision | Decided by |
|---|---|---|
| D-024 | The new app is published beside the legacy page at `/next/` with a "Preview, not for client use" banner: Pages publishes `index.html` (legacy) and `next/index.html` (new), **superseding D-007 in part** ("publish `index.html` only") and keeping its rule that docs are never served; the legacy stays the review link until parity (Q-17); nothing exported from `/next/` is used for a client before switch-over | lead under D-033: ND-3 (Q-10), ND-9 (Q-85) |
| D-025 | Stack A1 to A3 (npm for pinned, dev-time build tooling plus Preact) | lead under D-033: ND-2 (Q-09) |
| D-026 | Data-class policy and the `monthly_updates/` layout that implement D-023 point 1; the MF Screener data pack never embedded in a public build or committed: an upload slot in section 1, kept in the browser's IndexedDB until a newer pack, cycle date in the sidebar, absence messages (section 6.9) | owner: ND-1 (Q-06); the class policy by the lead (D-023) |
| D-027 | MF Screener navigation link: a documented exception to `CLAUDE.md` rule 2 for this one link, new tab, new app only | the owner's brief (Q-11) |
| D-028 | Legacy change policy during the parallel run: calculation, data and security fixes stay on the live page; presentation-only improvements go to the new build | lead under D-033: ND-4 (Q-16) |
| D-029 | Missing values shown as a dash ("—") with a status footnote, as today (OD-13, OD-29); no en or em dash in sentences; dates "D Mon YYYY", Indian digit grouping, red negatives with a hyphen-minus | owner: ND-5 (Q-42); the other conventions by the lead |
| D-030 | Observation thresholds approved; a fund pair counts as overlapping from 35% (very high 50%) | owner: ND-6 (Q-61) |
| D-031 | Table border 0.5 pt `#D9D9D9`; Actionables cells tan `#DBC8B2` with the action word in black bold | lead under D-033: ND-7 (Q-33, Q-35) |
| D-032 | Capital-gains statements uploaded in the app's own template (section 6.10); no per-issuer parsers | owner: ND-8 (Q-78) |
| D-033 | Claude takes full charge of GitHub and the dashboard; no branch ruleset on `main` | owner: ND-10 (Q-86) |

`CLAUDE.md` gains a section for the new app (rules 1 and 5 stay scoped to the legacy `index.html`). The threshold
approval (D-030) is also recorded in the threshold table itself (`approvedBy`, `approvedOn`, the decision id).

## 22. What is verified, inferred or unverified here

- **Verified (by the investigators, named):** library versions and hashes, PptxGenJS chart and table capabilities,
  SheetJS write limits, Node 24 type stripping, toolchain presence [TE §3, §5, §6]; legacy globals and broken slides
  [IE §5, §6; IU U-53]; Screener access constraints [SC §1]; data-source facts [DS].
- **Inferred (design choices):** everything in sections 5 to 21 that is not a recorded owner decision.
- **Not verified:** Excel opening the in-house writer's output; PowerPoint rendering of probe decks; an editable title
  placeholder in a PptxGenJS master; theme XML post-processing [TE §13]. Each is a gate in the first spikes (M1.4,
  M9). Also not verified: the capital-gains template (D-032; its columns are a proposal, not yet tried by analysts);
  the remote force-push check of AC-22 (designed, not run); the MF Screener data pack (the contract is written, no
  pack has been received, so the pack parser and its limits are designed against the contract only); the pack's size
  in IndexedDB (section 6.9); the exact columns of the Index TRI files (known from the data-source survey, not re-read
  for this design).
- **Verified in the M1.2 spike (22 Oct 2026, `toolchain.md` §6):** `npm ci` and esbuild on this laptop; the
  hash-based CSP under `file://` and served; IndexedDB kept under `file://` and served (headless Edge 155 and Chrome
  155; a real double-click on an analyst's profile is the browser QA step).
- **Verified in the 22 Oct review:** the writer spike's size (94 lines, 9,844 bytes; output 4,169 bytes); the legacy
  page has no capital-gains or realised-gain handling and no holder columns (code search of the reading copies).
- **Verified on 22 Oct 2026 (read-only):** `main` is at `8cb320d` (PR #7 and PR #8 merged, docs only), `index.html`
  still has MD5 `ef2ff4f198a41fe02404b3617cbad36e`; D-022, D-023, KI-124 and CR-0006 are on `main`.
