# Architecture (new application)

| | |
|---|---|
| Status | The living architecture of the new Portfolio Review application (CR-0006), from milestone M1.1 (22 Oct 2026). Every milestone that changes the structure updates it in the same pull request. |
| Scope | How the new application is built: stack, layers, modules, engine structure, outputs, the monthly engine, security, build and deployment. The legacy `index.html` is described in [legacy/ARCHITECTURE.md](legacy/ARCHITECTURE.md). |
| Not here | What the product must do: [PRD.md](PRD.md). Entities, fields, metric paths, missing-data statuses, units and calculation definitions: [DATA_DICTIONARY.md](DATA_DICTIONARY.md). Data sources and their publication classes: [06-data-source-inventory.md](new-build/06-data-source-inventory.md) and [publication-classes.json](../monthly_updates/_policy/publication-classes.json). Observation rules and thresholds: [observation-rule-bank.md](new-build/observation-rule-bank.md). Deck tokens and components: [deck-design-system.md](new-build/deck-design-system.md). Decisions: [DECISIONS.md](DECISIONS.md). |
| Built from | [03-architecture.md](new-build/03-architecture.md), the Phase 0 record (draft of 21 Oct 2026, revised on 22 Oct 2026 with the owner's answers D-024 to D-033). The record stays as it was, apart from M1.2's notes of what the build changed and verified (output path, CSP, IndexedDB, commands); its evidence tags and investigator citations are not repeated here. |
| Section numbers | The same as in `03-architecture.md`, so "architecture §6.9" names the same topic in both. |

**Where the build stands (23 Oct 2026).** Milestone M1.1 built the safety tooling in
`scripts/validation/` (privacy scan, docs link check, pre-push scan and hook, release check, monthly PRD check) with its
tests in `tests/validation/` and the CI job `next`, and the folder skeleton with a README in each new folder (`app/`,
`data/`, `product_bank/`, `monthly_updates/` with `_policy/publication-classes.json`). Milestone M1.2 built the pinned
toolchain, the page shell with the nine sections as empty states, the one-file build (`scripts/build.mjs`) and its
invariant check (`scripts/validation/check-next.mjs`), and the `/next/` preview; its facts and spike results are in
[toolchain.md](new-build/toolchain.md). Milestone M1.3 built the shared model (`app/src/model/`), the workbook and
base-file readers (`app/src/ingest/`) with the engine helpers they use (`app/src/engine/`: dates, units, asset
classes, identifiers, ownership), the reference data in `data/refdata/` (extracted from `index.html` by
`scripts/data-extract.ts` and checked equal, D-035), the base-file parity ledger and the traceability report; no
page uses them yet. Next is M1.4 (the portfolio overview end to end); see
[07-implementation-roadmap.md](new-build/07-implementation-roadmap.md) and [PROJECT_STATE.md](PROJECT_STATE.md).

---

## 1. The decisions in one page

| # | Decision | Why | Status |
|---|---|---|---|
| A1 | **Stack:** TypeScript (erasable syntax only) in plain ES modules; Preact for the UI; esbuild bundles everything into **one offline HTML file**; a Node build script inlines the vendored libraries, the reference data (non-executable JSON blocks) and a CSP meta tag with script hashes. npm only for pinned build tooling plus Preact. Tests run with `node --test` on the `.ts` sources. | Keeps what compliance needs (offline, no network, client data never leaves the browser, opens by double-click) and removes the legacy's root causes: no types, no module boundaries, unescaped DOM, calculations in UI code. | D-025. Fallback: the same layout with a hand-written bundler. |
| A2 | **Runtime libraries vendored byte for byte from the legacy page**, each with its SHA-256 in `app/vendor/MANIFEST.json`. | Same behaviour as the analysts' tool; nothing to download. | Recommended |
| A3 | **Excel written by a small in-house SpreadsheetML writer** on the vendored JSZip, gated by a spike (opens without repair; styles, frozen panes, filters, recalculation). ExcelJS is the fallback. | The embedded SheetJS Community Edition writes formulas and filters but drops styles and frozen panes. | Spike in M1.4; fallback per Q-13 |
| A4 | **One shared model and one engine** produce every number. Screen, PowerPoint and workbook render view-models of that model; no exporter computes and no renderer reads global state. | The legacy exporters read UI globals, the root of KI-002 and KI-003, and half the legacy deck cannot be tested headless. | Brief Phase 2 |
| A5 | **Side by side:** the new app is built to `app/dist/index.html` (M1.2; staged by Pages as `next/index.html`) and published at `/next/` with a "Preview, not for client use" banner; the legacy page stays at `/`. At parity the new app moves to `/` and the legacy page to `/legacy/`. | Preserve the old app until parity; one Pages site. | D-024 (supersedes D-007 in part) |
| A6 | **The data-class policy decides what is published and embedded** (P publishable, C private until approved, N never). The MF Screener data pack is never embedded in a build or committed. | D-023 point 1 and D-026. | Decided |
| A7 | **Stable identifiers first, names last.** ISIN, AMFI scheme code, vendor key and product-bank id are resolved before any name matching; a name match only proposes, and an owner-approved alias pins it (OD-5). | Name matching is the root of the P0 defects KI-036, KI-050, KI-052, KI-054. | Decided |
| A8 | **A typed missing-data status on every value.** The dash stays the on-screen and on-slide marker of a missing value, always with a footnote naming its status; sentences never use an en or em dash. | Brief Phase 2; D-029; `CLAUDE.md` rule 3. | Decided |

## 2. Constraints carried forward

| Constraint | How the architecture meets it |
|---|---|
| No network calls at run time; client holdings never leave the browser (`CLAUDE.md` rule 2) | CSP `connect-src 'none'`; a build-time scan of the built file; one allow-listed navigation link, the MF Screener (D-027) |
| One file that opens from Pages, a local server and by double-click | a single self-contained HTML file; no module imports at run time |
| Never invent a number (rule 3) | `Value<T>` with statuses; renderers cannot print a missing value as zero |
| Matching thresholds never lowered, product class never crossed, debt never given an equity benchmark (rule 4) | one matcher module with a corpus test measured both ways (M2) |
| Per-family isolation (KI-001, D-015) and per-family settings (OD-10) | one `Review` object, replaced as a whole; browser storage only for conveniences, namespaced |
| Public repository; nothing confidential committed (rule 6, D-019, D-020, D-023) | the data-class policy; the pre-push scan; synthetic fixtures only |
| Financial changes reviewed and tested against known answers (rule 7) | known-answer tests per engine module; the parity ledger |
| Branches, pull requests, verified merges, never a force-push (rule 8, D-017, D-033) | one pull request per milestone unit; the release check; AC-22 (designed; not built in M1.2) |
| Cambria, the house palette, 2 decimals, money held in Crore and shown in the file's unit | shared tokens and one formatter for all three renderers |
| One parsing path for uploads and the monthly pipeline (OD-11) | parsers in `app/src/ingest/`, imported by the browser bundle and the Node update engine |

## 3. Technology stack

| Layer | Choice | Version (exact pin) | Licence |
|---|---|---|---|
| Language | TypeScript, erasable syntax only (no `enum`, namespaces or parameter properties); `tsc --noEmit` only | 7.0.2 (6.0.3 as fallback) | Apache-2.0 |
| Tooling and tests | Node.js, running `node --test` on `.ts` files directly | 24.21.0 (portable, D-006) | MIT |
| Bundler | esbuild, IIFE output, readable (not minified) | 0.28.2 | MIT |
| UI | Preact (JSX, escape by default) | 10.29.8 | MIT |
| PowerPoint | PptxGenJS (vendored), native charts and tables | 3.12.0 | MIT |
| Excel writing | in-house SpreadsheetML writer on the vendored JSZip (ExcelJS 4.4.0 fallback) | n/a | project |
| Excel reading | SheetJS Community Edition (vendored) | 0.18.5, then 0.20.2 or later (Q-12) | Apache-2.0 |
| On-screen charts | Chart.js and chartjs-plugin-datalabels (vendored), screen only | 4.4.0 / 2.2.0 | MIT |
| Package hygiene | committed `package-lock.json`; `.npmrc` with `ignore-scripts=true`, `save-exact=true`, `fund=false` and `audit=false`; `npm ci` only; all three packages are `devDependencies` (M1.2, [toolchain.md](new-build/toolchain.md) §1) | | |

Rejected: Vite, React, Svelte or Solid, Deno, Electron or Tauri, any server-side generation (client data would leave
the browser), HyperFormula (GPL-3.0-only).

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

Nothing in the browser talks to a server. The monthly update engine runs on the maintainer's machine, reads local
files only and never logs in anywhere. The MF Screener data pack reaches the app in two ways that share one parser:
the monthly engine validates it and publishes only its fingerprint, contract version and counts; the owner uploads the
same zip into the app every Screener cycle and the browser keeps it (§6.9).

## 5. Directory layout

The legacy files keep their paths (Pages, CI and the patch tooling depend on them). The full target tree and the
owner of each document are in [09-repository-and-docs-structure.md](new-build/09-repository-and-docs-structure.md).

| Folder | Holds | Since |
|---|---|---|
| `index.html`, `tools/`, `buildtools/` | the legacy page, its checks and patch scripts, the legacy monthly pipeline (retired at M15) | before CR-0006 |
| `app/` | the new application: `index.template.html`, `tsconfig.json`, `vendor/`, `assets/`, `src/` with `model/`, `ingest/`, `engine/`, `observations/`, `views/`, `exports/pptx/`, `exports/xlsx/`, `ui/`, `services/`, `config/` ([app/README.md](../app/README.md)) | README in M1.1; the template, `tsconfig.json`, `vendor/MANIFEST.json` and the shell (`main.tsx`, `ui/`, `config/`, `types/`) in M1.2; `model/`, `ingest/`, the first `engine/` helpers and `views/format.ts` in M1.3 |
| `data/` | reference data as JSON: `refdata/` with `VINTAGE.json`, `owner/` tables with approval records, `identifiers/crosswalk.json`, `history/YYYY-MM/` ([data/README.md](../data/README.md)) | README in M1.1; `refdata/` with `VINTAGE.json` in M1.3 (D-035) |
| `product_bank/` | `schema/`, `products/`, `performance/`, `snapshots/`, `source_register/`, `pins.json` ([product_bank/README.md](../product_bank/README.md)) | README in M1.1; records from M11 |
| `monthly_updates/` | `_policy/` and one `YYYY-MM/` folder per data month with `MANIFEST.json`, `UPDATE_REPORT.md` and the class P files in role folders ([monthly_updates/README.md](../monthly_updates/README.md)) | README and `_policy/` in M1.1; files from M11 |
| `scripts/` | `validation/` (M1.1; `check-next.mjs` in M1.2; `traceability.mjs` in M1.3); `build.mjs` and `serve.mjs` (M1.2); data extraction, `data-extract.ts` (M1.3); vendor extraction (M1.4); `monthly-update/` (M11); `office/` (local acceptance); `docs/` (M14) | M1.1 |
| `tests/` | `validation/` (M1.1); `next/`, `browser/` and `fixtures/next-build/` (M1.2); `unit/`, `parity/`, `fixtures/make-books.ts` and `helpers/` (M1.3); regression, more unit and parity, exports, integration, acceptance, monthly, fixtures, helpers | M1.1 |
| `app/dist/` | build output (git-ignored; M1.2 put it beside the sources, not at the root) | M1.2 |
| `package.json`, `package-lock.json`, `.npmrc` | the pinned build tooling (D-025, D-034); `"type": "module"`, with `tools/` and `buildtools/` kept CommonJS by their own `package.json` (M1.3 integration) | M1.2 |

The brief's suggested names map as follows: `components` and `pages` become `ui/`, `analytics` becomes `engine/`,
`data` splits into `model/` (types) and the root `data/` (values), `configuration` is `config/`; `ingest/` and
`views/` are added because parsing and presentation selection are separate layers (brief Phase 2).

## 6. The single data and calculation model

### 6.1 Layers

Each layer is a separate set of immutable objects and reads only the layers above it. The entity of each layer is
defined in [DATA_DICTIONARY.md](DATA_DICTIONARY.md) §1 and §5.

| # | Layer | Produced by |
|---|---|---|
| L1 | Source: source files (fingerprint, role, class, as-on, parser version) and raw rows with their position | `ingest/` |
| L2 | Normalised: holdings, transactions, realised gains, instruments, clients, accounts, folios, ownership, distributors | `ingest/`, `engine/match`, `engine/classify` |
| L3 | Validated: each record included or excluded with reasons; validation results | `engine/validate` |
| L4 | Calculated: the `Review`, every metric a `Value<T>` with lineage | `engine/` |
| L5 | Assumptions: review mode, scope, IPS profile, plan switch, expected returns, overrides, labels | UI or workbook re-upload |
| L6 | Scenarios: the rebalancing scenario and the post-scenario `Review` from the **same** engine | UI, AI Analyst draft, re-upload |
| L7 | Observations: records with evidence references, generated text and analyst edits; the Review Snapshot | `observations/` |
| L8 | Presentation: view-models and the presentation manifest; PowerPoint rendering | `views/`, `exports/pptx/` |
| L9 | Excel: the workbook specification and its rendering | `exports/xlsx/` |
| L10 | Audit: imports, validation decisions, mode switches, edits, exports, build manifest | `services/audit-log.ts` |

Rules:
1. **Only L4 and L6 compute.** `views/` selects, orders and labels; renderers format. A number shown in two outputs
   comes from the same `Value`.
2. **Switching modes never changes L1 to L4.** Review Only and Review with Rebalancing differ only in L6 to L8.
3. **Unrounded maths, rounding at the renderer.** Excel receives unrounded values with number formats.
4. **One invalid record never corrupts valid calculations:** exclusion is per record, with a reason and a count.

### 6.2 Types

`model/` holds types and constants only, with a schema version. `Value<T>` (a value with unit, provenance, optional
coverage and staleness, or a missing status with a reason) and the status list are defined in
[DATA_DICTIONARY.md](DATA_DICTIONARY.md) §2; every entity in §5. A zero is a value, never a status.

### 6.3 Stable identifiers

Identifiers are resolved in a fixed order of preference (for a fund: ISIN, AMFI scheme code, vendor key with rename
history, alias pin, then a name match that only proposes); the full table is in
[DATA_DICTIONARY.md](DATA_DICTIONARY.md) §4. `data/identifiers/crosswalk.json` joins them; renames are history rows,
so a renamed scheme is a lookup, not a fuzzy match. Identity fields from a loaded Screener pack enter the crosswalk
only through the same pins. Matching keeps the legacy rules (`CLAUDE.md` rule 4), adds house-token exclusion and idf
weighting, returns null on ties instead of the first key (KI-036), never crosses product class, and every change is
measured both ways over the real universes before it ships.

### 6.4 Missing values

The statuses and their meanings are in [DATA_DICTIONARY.md](DATA_DICTIONARY.md) §2. How they are shown (D-029):
renderers receive the status, never a pre-formatted string, so a status cannot be printed as `0.00`. On screen and on
slides a missing value is the dash "—" alone in its cell or tile, with a footnote naming the status; "s" and "p" mark
STALE and PARTIAL values; the marker characters are configuration (`config/formats`). In the workbook a missing number
is a blank cell with its status in the next column, so formulas keep working. A build-time lint fails on any en or em
dash in generated presentation text; the only dash allowed is the marker itself.

### 6.5 Scope: family, client and advisor

`Scope = { kind: 'family' } | { kind: 'client', ids } | { kind: 'advisor', distributorIds }`. Every calculated view is
`compute(rows filtered by scope, reference, assumptions)`: weights re-based within the scope, totals reconciled to the
family. The same function serves analytics, overlap, AMC, cost and returns (transaction XIRR, benchmark XIRR, the IRR
tree and contributors per scope), so the advisor-level views and the cost tab's distributor filter are one mechanism
(Q-57). Distributor-level returns need the IRR file's DISTRIBUTOR column; flows without a distributor are reported on
an "unassigned" line, never spread, and a scope whose flows do not reconcile to its holdings shows INSUFFICIENT
EVIDENCE for XIRR (OD-4 per scope). Exports carry the scope in titles and file names; results are cached per scope.

### 6.6 The review object and per-review state

A `Review` session object holds L1 to L10 for one family. Loading another base file replaces it as a whole (the KI-001
rule, D-015). Per-family settings live in the review (OD-10); browser storage holds only conveniences (logo choice,
collapsed panels), namespaced `prd.next.v1.` behind guarded helpers (KI-088). Market-data uploads (monitors, the
market update override, the analyst's price file) are session-level and survive a family switch; none is written to
browser storage. The one exception is the MF Screener data pack and its backfill, kept in IndexedDB until a newer pack
(§6.9); a family switch never clears them. A same-family as-on date change keeps the scenario and slide picks (OD-24).

### 6.7 Units, rounding and dates

Money is held in Crore, unrounded, and shown in the file's unit through one formatter; dates are day numbers converted
from raw Excel serials by one time-zone-free function (the legacy +12 h shift stays in the legacy page); tests run
under `TZ=Asia/Kolkata` and `TZ=UTC`. Gain and loss is CMV minus invested everywhere (OD-18). Realised gains come from
the client's capital-gains statement when one is uploaded (§6.10), else from redemptions in the IRR file matched FIFO
("derived from transactions"); when both exist the engine reconciles them per scheme and financial year and a
difference beyond tolerance raises a High result. The definitions are in [DATA_DICTIONARY.md](DATA_DICTIONARY.md) §3
and §7.

### 6.8 Ownership: clients, accounts, folios and holders

The model separates `Client`, `Account` (client, distributor and plan), `Folio` and `Ownership` (holders in order, mode
of holding, optional shares); fields in [DATA_DICTIONARY.md](DATA_DICTIONARY.md) §5.6. Without holder columns the
row's client is the sole first holder and joint holders are NOT AVAILABLE IN SUPPLIED DATA. Allocations and
client-level views attribute a holding to its first holder and never split it unless the analyst records shares;
taxation groups lots by the assessee, taken as the first holder (Q-79); joint holders appear on screen and in the
workbook's Holdings (as loaded) sheet, never on slides. Ownership data is client data (§17 item 6).

### 6.9 The MF Screener data pack slot (D-026)

Screener scores and ranks are never in a public page: the pack is never embedded in any build and never committed.

| Aspect | Design (M10) |
|---|---|
| Slot | section 1, "MF Screener data pack", for `pr-datapack_<cycle>.zip` (contract `pr-datapack-v1`) and, once, the holdings backfill; the Upload, Validate, Preview and Review stages of every upload (§13.1) |
| Validation | `ingest/screener-pack/` checks contract version, cycle, file list, per-file SHA-256, counts and schemas with the vendored JSZip; a failing pack is refused with the reason and nothing is stored |
| Storage | `services/screener-store.ts` writes the accepted pack to IndexedDB (`prd.next.v1.screener`), keyed by cycle and SHA-256, until a newer cycle replaces it as a whole; an older cycle is refused, the same SHA-256 is a no-op; month-end holdings of replaced packs and the backfill are kept as history (Q-27); the analyst can remove it; a family switch never clears it |
| Sidebar | the stored cycle date and its status: "validated pack" (SHA-256 in the published manifest), "not in the published manifest", STALE DATA (Q-21) or "not loaded" |
| Absence | every screen that needs the pack names it and the slot; slides and sheets use the named fallback source or show the dash with "Screener data not supplied for this review"; score and rank have no other source; the export dialog warns |
| Scope | IndexedDB belongs to one browser profile and origin: the Pages site, the local preview and a double-clicked copy each load the pack once per cycle; the M1.2 spike found IndexedDB available under `file://` and served, kept across a reload and a browser restart (headless Edge 155 and Chrome 155), as best-effort storage; every local file shares the one `file://` origin ([toolchain.md](new-build/toolchain.md) §6) |
| Never | in `localStorage`, logs or exports beyond the figures a review uses; sent anywhere; in a build (`scripts/validation/check-next.mjs` fails on pack content, from M10); committed |

### 6.10 The capital-gains template (D-032)

Capital-gains statements are uploaded in a template the app defines, as the base file is; no issuer's own layout is
parsed. Section 1 offers the blank template (a header row and a Read Me sheet); `ingest/capital-gains.ts` reads it by
header name, one row per realised lot, money in rupees converted to Crore, and refuses a file without the required
columns, naming them. The proposed columns are in [DATA_DICTIONARY.md](DATA_DICTIONARY.md) §5.17, fixed in M7.

## 7. Module responsibilities

| Module | Responsibility | Must not |
|---|---|---|
| `model/` | types and constants; schema version | contain logic |
| `ingest/workbook.ts` | SheetJS wrapper: raw serials, formulas and cached values, sheet and header discovery by name, size limits | interpret business meaning |
| `ingest/base-file.ts` | base file to holdings: aliases, units by column label, the XIRR unit question (OD-3), blank asset unknown (OD-7), rows without CMV excluded and listed (OD-8), folio merge | guess units silently |
| `ingest/irr-file.ts` | fund and benchmark flows, transaction types (OD-16), the DISTRIBUTOR column, skipped rows by reason | drop rows silently |
| `ingest/capital-gains.ts` | the capital-gains template to realised-gain records; the blank template (§6.10) | read a file not in the template |
| `ingest/disclaimer.ts` | the disclaimer in use; a session override only for an approved fingerprint | accept unapproved text |
| `ingest/` vendor parsers (MF and SIF Monitor, expense ratio, analytics, listed equity, fund manager, risk ratios, fund ranks, PMS and AIF performance) | vendor and in-house files to reference records **by header name**, with the monthly pipeline's rules | read columns by position (KI-033) |
| `ingest/soa-lookthrough.ts`, `bonds.ts` | client look-through uploads; ambiguous formats refused (KI-056, KI-077) | overwrite reference data |
| `ingest/screener-pack/` | the Screener pack (§6.9), shared by the browser slot and the monthly engine; idempotent by SHA-256 | log in, fetch, or accept a pack whose manifest, counts or schema disagree |
| `ingest/index-series.ts` | the five Index TRI files (D-023 point 2) by header name; ambiguous layouts refused | infer an index from a file name |
| `ingest/price-file.ts` | the analyst's price file for stocks the pack does not cover | accept unadjusted prices without a flag |
| `ingest/pptx-cards.ts`, `market-update.ts` | Reckoner and one-pager slides to product-bank records; the market update deck (Node only) | infer facts from names |
| `ingest/workbook-reupload.ts` | re-uploaded workbook: manifest check, inputs, formula-conflict report | accept holdings edits |
| `engine/match/`, `engine/classify/` | normalisation, crosswalk, matchers, alias table; product class (OD-6), asset (OD-7), liquidity, direct equity, commodity | lower thresholds; cross product class |
| `engine/aggregate/` | totals; allocation by asset, product, client and distributor; AMC (OD-1, OD-33, OD-34); holdings sheets | |
| `engine/returns/` | XIRR (ported as is), IRR tree with OD-4 reconciliation, contributions, benchmarks, performance, Portfolio Quants; MF portfolio 3Y and 5Y weighted returns and direct-equity CAGR, both with coverage (D-023 points 3 and 4) | mix bases; count a missing return as 0% |
| `engine/drawdown.ts` | drawdown and recovery on index series, per index and for a blend at today's weights (D-023 point 2) | use the client portfolio's history |
| `engine/lookthrough/`, `engine/overlap.ts` | look-through (§9); pairwise and index overlap | double count |
| `engine/tax/` | classification (OD-17, OD-27), FIFO lots (OD-12, OD-15), realised gains (statement first, reconciled), exemption already used (Q-52), harvesting, redemption units by date, lots by assessee | |
| `engine/ownership.ts` | clients, accounts, folios, holders; attribution to the first holder | split a holding without recorded shares |
| `engine/cost.ts`, `ips.ts`, `projection.ts` | cost chain (OD-9), IPS compliance (OD-13), Current vs Sample and the pre/post projection | estimate a missing expense ratio |
| `engine/scenario.ts`, `engine/ai-analyst/` | apply a scenario and recompute with the same engine; the ported rules-driven draft proposal (Q-55) | use a second engine; publish without the analyst |
| `engine/history.ts` | pair a historical base file with the same month-end's fund holdings (Q-27) | present current holdings as historical |
| `engine/validate/` | validation rules, reconciliation, outliers, the publication gate (§16) | |
| `observations/` | rule bank, thresholds, composition, lint, Snapshot (§10, §11) | compute new metrics |
| `views/` | one view-model per component and sheet | do arithmetic beyond selection and ordering |
| `exports/pptx/`, `exports/xlsx/` | §15 and §14 | read globals; write user text into formulas |
| `ui/` | sections, inputs and inspectors rendering view-models | calculate |
| `services/` | files in and out, storage, the Screener pack store, audit log, an injectable clock | use the network; store client data |

## 8. Calculation engine

The engine is a set of pure functions of (normalised rows, reference vintage, assumptions, scope). The orchestrator
`engine/review.ts` builds the `Review` in a fixed order and records each step's inputs for lineage. Every legacy
calculation has a target module and a reuse decision in
[04-reuse-and-migration-plan.md](new-build/04-reuse-and-migration-plan.md), and the legacy tests' known answers are
ported with it. Every calculation definition, including each one that changes from the legacy (the AMC cap basis,
gain and loss, realised gains, long-term holding, blank asset, missing CMV and expense ratio, IRR reconciliation,
benchmarks, credit-rating buckets, the debt "Others" fold, performance order, Portfolio Quants, the portfolio 3Y and
5Y return, direct-equity returns, drawdown, index overlap, the projection), is in
[DATA_DICTIONARY.md](DATA_DICTIONARY.md) §7 with its decision.

## 9. Look-through framework

A **provider** per product family returns exposures for one holding, or a status: `equity-vendor`, `hybrid-vendor`,
`debt-vendor`, `soa-upload`, `bonds-upload`, `direct-equity`, `fof`, `index-proxy` or `none`; each result carries its
as-on date and coverage (the record is in [DATA_DICTIONARY.md](DATA_DICTIONARY.md) §5.7).

1. **One provider per holding**, chosen by product class and category; a wrapper keeps its own classification in
   allocation tables, and only analytics use the look-through.
2. **Funds of funds** (M12): the underlying-fund weights from the Screener pack's `mf_units` rows times each underlying
   fund's own look-through; partial coverage reported; never counted twice; without those rows NOT AVAILABLE IN
   SUPPLIED DATA, never estimated (Q-28).
3. **Hybrid sleeves** keep the legacy split (KI-055) and report gross equity; a net-of-hedges figure for arbitrage
   funds is a separate, labelled metric (Q-50).
4. **An uploaded client statement beats embedded vendor data** for the same scheme, tagged with its own date.
5. **Aggregation** normalises each block over its exposure base and reconciles to 100.00%; truncated lists get an
   "Others" remainder; the sub-2% debt fold applies to debt charts only.
6. **Coverage** is reported per block and per scope; below the observation threshold, rules qualify or stay silent.
7. **Index constituents and proxies** use the same provider shape (Q-30).
8. **Never combine incompatible dimensions.** Every series declares one dimension and one basis; the view-model
   builder rejects a series mixing two (a rating bucket beside an issuer, a percentage of the debt sleeve beside a
   percentage of the portfolio); non-credit lines sit beside the credit buckets, never inside them (Q-46). A unit test
   on every view-model, and AC-07 and AC-08, check it.

## 10. Observation engine

The full specification is [observation-rule-bank.md](new-build/observation-rule-bank.md). A rule is data plus pure
functions: its inputs (metric paths), a trigger, the evidence it cites (metric, value, unit, source, as-on, coverage)
and templates for Evidence, Diagnosis, Implication and Action per mode. Each rule declares a driver ("risk", "return"
or both), so observations answer "What drives portfolio risk?" and "What drives portfolio return?", and the SWOT
quadrants it feeds. Thresholds live in one versioned table (`data/owner/observation-thresholds.json`), approved on
22 Oct 2026 with a fund pair overlapping from 35% (D-030). A clause is emitted only when every placeholder is filled
from evidence; below 80% coverage it is qualified, below 50% the rule stays silent. Composition ranks by materiality,
6 to 8 per slide; the lint forbids en and em dashes in sentences (D-029), hindsight verbs, unsourced product claims,
unfilled placeholders, repeated sentences and personal names. An analyst edit changes the text, not the evidence; if
the evidence changes later, the edit is flagged for re-checking. Every edit is an audit entry.

## 11. Review Snapshot modes

| | Portfolio Review Only (default) | Portfolio Review with Rebalancing |
|---|---|---|
| Available | always | only with a valid scenario: amounts reconcile, every released amount has a destination or a "cash" line, the post-scenario `Review` computes without blocking errors |
| Content | the mandatory facts below, each a value or a status; verdict; what is working (up to 4 cards); what needs attention (up to 6 rows); next steps without destinations (Q-63); no pre/post figure | the mandatory RB slots below, with the verdict, cards and attention rows tagged "In the plan" or "Next step" |
| Deck | one `review-snapshot` component, RO variant; no rebalancing section | one `review-snapshot`, RB variant; the rebalancing section and post-rebalancing components |
| Switching | never touches L1 to L4; recorded in the audit log and the presentation manifest | same |
| Missing proposal data | n/a | the selector refuses RB and names the failing checks; no unsupported post figure is ever shown |

**Mandatory Review Only facts** (brief Phase 5), on a fixed strip, each a value with its as-on date or a status with a
footnote, never dropped (paths as in [DATA_DICTIONARY.md](DATA_DICTIONARY.md) §6):

| # | Fact | Metric |
|---|---|---|
| F1, F2, F3 | current value, invested value, unrealised gain or loss and its % of invested (OD-18) | `totals.cmv`, `totals.invested`, `totals.gain` |
| F4 | asset allocation (a compact bar with fixed category colours) | `alloc.asset[*].pct` |
| F5 | market-cap exposure, with coverage | `lookthrough.equity.mcap.{large,mid,small}` |
| F6 | sector exposure: the top three sectors and their combined share | `lookthrough.equity.sectors` |
| F7 | performance against benchmarks: portfolio XIRR against benchmark XIRR on the same flows, else the weighted 3Y return of current holdings against the weighted category benchmark on the same funds, basis named | from the IRR file, else D-023 point 3 |
| F8 | risk-adjusted metrics where meaningful: value-weighted Sharpe and alpha with the share of value covered | Portfolio Quants |
| F9 | concentration: the largest fund house's share of the MF book against the 20% cap, and the top-10 stock share | AMC and look-through |
| F10 | overlap: the highest pair and the share of pairs at or above the threshold (35%, D-030) | overlap |
| F11 | fund quality: value-weighted score with the share of value scored, and the MF book's share in funds behind their benchmark on two tenors | Portfolio Quants, performance |

Concentration, overlap and fund quality are also always present as findings: when no rule in that family fires, the
neutral fact line stands in ("No pair of funds shares 35% or more of its holdings"). An attention row that does not
fit moves to the observations section, never a fact.

**Mandatory Review with Rebalancing slots:** (1) principal issues; (2) weaknesses addressed, each tagged with its plan
line; (3) quantified pre/post changes and construction improvements, only where both sides are computed; (4) changes
in overlap, fund quality or risk measures, or their status; (5) trade-offs and risks; (6) tax, liquidity and execution
constraints (plan tax, exit-load windows or their status, lock-ins, transaction count and dates); (7) conclusions and
next steps. A slot without supporting data shows a status, never a figure from elsewhere.

## 12. Product bank

Stored under `product_bank/` ([product_bank/README.md](../product_bank/README.md); records in
[DATA_DICTIONARY.md](DATA_DICTIONARY.md) §5.15):

| Part | Key | Rules |
|---|---|---|
| `products/<product_id>.json` | bank-assigned `product_id` | every field carries its source file (SHA-256), slide, table or chart, as-on and extraction method; a field no source states carries a status, never an inference from the name |
| `performance/<product_id>/<as_on>.json` | product, as-on, source | returns with their period and return basis; never compared across bases |
| `snapshots/<product_id>/<as_on>.json` | product, portfolio as-on | always PARTIAL COVERAGE (top-N) |
| `source_register/<YYYY-MM>.json` | SHA-256 | every source file used; an existing fingerprint is a no-op |

A name match only proposes a link; a pin in `product_bank/pins.json` confirms it. The legacy UI's hard-coded proposed
products become bank entries (M11). The Investment Reckoner is the product-bank source (Q-03). Publication follows
D-023 and D-026.

## 13. Monthly update engine

Operated by one instruction ("I have updated the files in the monthly_updates folder. Process the updates and prepare
the current month's data."); Node scripts in `scripts/monthly-update/` that import the app's parsers. The process for
the owner is in [MONTHLY_UPDATE_GUIDE.md](MONTHLY_UPDATE_GUIDE.md), the folder in
[monthly_updates/README.md](../monthly_updates/README.md).

1. **Locate** the active data month in the private inbox (`PRD_MONTHLY_INBOX`) and in `monthly_updates/YYYY-MM/`.
2. **Classify** each file by content signature, then structure, then name; a disagreement stops that file; client
   material is quarantined (class N). Roles include `screener_pack` and `index_data`.
3. **Fingerprint** (SHA-256, role, data month): the same fingerprint is a no-op; two files for one role are competing
   files and stop the role; a copy of last month's file is a stale copy and stops.
4. **Validate** dates, header drift, row-count floors and integrity tests, and privacy-scan every class P file; the
   Screener pack is validated against its contract and reported as "rejected: reason" when it fails.
5. **Extract and normalise** to `data/` and `product_bank/` through the crosswalk. The Screener pack's contents never
   go to `data/`: only its fingerprint, contract version, cycle and counts go into `MANIFEST.json`.
6. **Preserve history** in `data/history/<YYYY-MM>/`.
7. **Recalculate and reconcile:** parity and regression suites on the new vintage; synthetic reviews before and after.
8. **Report** in `UPDATE_REPORT.md` and `MANIFEST.json`; it never says "success" when a step failed.
9. **Legacy adapter:** until retirement, the same data is spliced into `index.html` so both apps carry one vintage;
   a refresh is merged only after the owner says "publish".
10. **Parity with the legacy pipeline** before it is replaced: a synthetic month in CI, a private re-derivation of
    2026-09 compared by hash with the embedded blocks, and the first live month run by both pipelines.
11. **Monthly PRD and handover:** every completed cycle writes `docs/monthly-prds/YYYY-MM-Portfolio-Review-PRD.md`
    and refreshes `docs/HANDOVER.md`; until M14 generates it, it is written by hand from the template and checked by
    `scripts/validation/monthly-prd-check.mjs` (built in M1.1; §17 item 9).

### 13.1 Stage flow

Section 1 uploads and the monthly update follow the stages of the owner's design reference (the One Digital Reckoner
Console, Q-84): **Upload**, **Validate** (structure, dates, identifiers; a severity per result), **Preview** (rows read,
rows excluded with reasons, matches disclosed, the as-on date), **Review** (the analyst accepts or removes the file;
for the monthly update, the owner reads the report and the pull request), **Approve** (the owner's "publish", monthly
update only) and **Final**. Only an accepted file feeds the review; the source register records each stage. The
reference has no portfolio-review layout; the screen follows the nine sections and the deck design system.

## 14. Excel model

One table per sheet, so filters and frozen panes work:

| # | Sheet | Editable on re-upload |
|---|---|---|
| 1 | Read Me and Controls (purpose, review id, scope, mode, vintages, sources, how to edit and re-upload) | no |
| 2 | Source Register | no |
| 3 | Holdings (as loaded), with ids, ownership and statuses | no (changes reported as unsupported) |
| 4 | Assumptions (named input cells) | yes |
| 5 | Portfolio Overview (`SUMIFS` over Holdings) | no |
| 6 | Observations | the edited-text column |
| 7, 8, 9 | Equity Analytics, Debt Analytics, Overlap | no |
| 10 | Historical Analytics (with the index drawdown table) | no |
| 11, 12, 13 | Holdings, Performance (weighted returns by `SUMPRODUCT` with coverage), Fund IRR (with an Excel `XIRR` check column) | no |
| 14 | Rebalancing (scenario inputs; post weights and projection by formula) | the inputs |
| 15, 16 | Tax and Transactions, Cost | the cost override, through Assumptions |
| 17, 18, 19 | Market Updates, Annexure, Audit Log | no |
| 20 | `_manifest` (hidden, protected): schema version, build id, review fingerprint, named inputs, formula fingerprints | no |

Conventions: Cambria 9 pt; black header row with white bold text; 0.5 pt grey borders; frozen header; a filter on every
data table; numbers stored as numbers, with statuses in their own column and never a dash in a numeric column; no
merged cells in data ranges; `fullCalcOnLoad`; user text written as inline strings, never as formulas; sheet names
sanitised and unique (KI-021).

**Re-upload** (M6): the workbook must belong to the loaded review (`_manifest`); supported inputs are extracted,
formula conflicts and unsupported changes reported, the engine recomputes, its results are compared with Excel's
cached values, and every changed input is an audit entry. The engine stays the only calculator.

**How "no formula errors" is proved:** formulas come only from a typed builder whose references resolve at build time
to declared tables, columns and named inputs, using an allow-listed function subset; in CI a small evaluator for that
subset computes every formula cell and compares it with the engine value (1e-9 relative), also after the AC-17 edits;
locally, `scripts/office/accept-xlsx.ps1` opens the workbook in Excel through COM, recalculates fully and compares,
whenever an exporter or a sheet's view-model changes. The Excel `XIRR` check column is verified by that local step only.

## 15. PowerPoint component library

Catalogue and tokens: [deck-design-system.md](new-build/deck-design-system.md).

- **Components** (`exports/pptx/components/C-nn-<name>.ts`) take a view-model and a layout box and emit PptxGenJS calls.
- **Presentation manifest** (`config/slide-manifest.json`): sections, components, inclusion rules (data present, mode,
  scope) and dividers only for sections with content. The same manifest drives the full deck, the slide picker and the
  per-section downloads, so a download exists only where a slide would (the KI-124 class).
- **No hard-coded slide numbers:** text refers to components, resolved after pagination.
- **Theme:** Cambria as theme fonts and the brand colours as theme accents, so text added by hand matches.
- **Pagination** from a committed Cambria width table, identical in Node tests and the browser; tables split by
  measured row heights with header rows repeated.
- **Native and editable:** native charts with embedded workbooks and native tables; pictures only for supplied artwork.
- **Market updates first**, then one Review Snapshot per deck in the selected mode.
- **Build channel marker:** exports from a build not released for client use carry "Preview build, not for client use"
  in every slide's footnote band and the workbook's Read Me (D-024); a release build carries none.
- **Export isolation:** a deck or workbook is built only from the current `Review`; embedded chart workbooks, notes and
  alternative text come from the same view-model, so nothing of a previous family survives (AC-20).

## 16. Validation, severity, reconciliation and audit

| Severity | Effect | Examples |
|---|---|---|
| Blocking | no client deck or workbook until resolved | unreadable base file; totals fail reconciliation; review fingerprint mismatch on re-upload; a client file in the monthly folder |
| High | export only after the analyst acknowledges it (an audit entry) | unmatched holdings above 5% of CMV; IRR flows not reconciled to the base file; a missing benchmark for a held category; stale reference data for a shown metric |
| Warning | footnoted automatically | partial look-through coverage; XIRR for a holding under 12 months; an outlier; a weighted return or CAGR with coverage under 100%; a refused or missing Screener pack where a component needs it |
| Information | logged | carried-forward vintages; alias pins used |

**Reconciliation** on every review and in tests: values from rows to totals per client and scope; units times implied
NAV equal CMV; allocations sum to 100.00%; look-through blocks; rating groups; pre/post totals; tax lots back to
holdings; redemption amounts; and cross-output consistency: a registry of material figures is read back from the
screen view-model, the deck and the workbook and must agree after display rounding. **Outliers:** robust z-scores
(median and MAD), flagged at six sigma with at least 30 comparable points; unusual is not an error. **Audit log:**
imports, validation decisions, mode and scope switches, edits, re-uploads, exports (file name and SHA-256) and the
build manifest; exported in the workbook, never sent anywhere.

## 17. Security

1. **CSP** as the first element of `<head>`: `default-src 'none'`, scripts and the style element by hash only,
   `img-src data: blob:`, `connect-src 'none'`, no objects, frames, workers, manifests, base URI or form actions, and
   no `font-src` (Cambria is a local font). As built in M1.2 (stricter than the Phase 0 text, which had `style-src
   'unsafe-inline'` and `font-src data:`); the M1.2 spike ran the page under it from `file://` and served, in Edge 155
   and Chrome 155 ([toolchain.md](new-build/toolchain.md) §4, §6, §8).
2. **Data blocks** are `<script type="application/json">` with `<` escaped, read with `JSON.parse`.
3. **Escaping by default** through Preact; a build-time invariant fails on `innerHTML`, `outerHTML`,
   `insertAdjacentHTML`, `document.write`, `dangerouslySetInnerHTML`, `eval` or `new Function` in `app/src`, and on any
   network API or URL in the built file except the allow-listed link.
4. **The MF Screener link** (D-027): one constant in `config/links.json`, an anchor with `target="_blank"
   rel="noopener noreferrer"`, no query string, no prefetch, no availability check; the one exception to the
   no-remote-URL rule.
5. **Uploaded files are untrusted:** size and sheet-count limits, the SheetJS reader upgraded for its published CVEs
   (Q-12), prototype-pollution-safe objects, a formula-injection guard on every string written to Excel.
6. **Storage:** namespaced keys, guarded access, no holdings, folios, values or names in browser storage; the only
   dataset kept is the Screener pack (market data) in its own IndexedDB database.
7. **Supply chain:** exact pins, lockfile review, `ignore-scripts`, vendored libraries checked against their SHA-256 at
   every build, a deterministic build.
8. **Secrets:** none in the repository, logs, outputs or PRDs; the Screener data arrives as a file pack, so no Screener
   credential exists anywhere.
9. **Repository safety tooling** (built in M1.1, [new-build/safety-tooling.md](new-build/safety-tooling.md)), Node
   built-ins only: `privacy-scan.mjs` (client-data and secret patterns, local user paths, personal account URLs, and a
   private deny-list of names named by `PRD_PRIVACY_DENYLIST`, never committed); `prepush-scan.mjs` and the pre-push
   hook (privacy of every added line, commit message and identity; size; new binary files); `docs-links.mjs`;
   `release-check.mjs` (remote, default branch, branch, clean tree, the legacy page's patch-script rule, push
   evidence); `monthly-prd-check.mjs` (§13 step 11). M11 extends the pre-push scan to office files, the monthly
   classes of `monthly_updates/_policy/publication-classes.json` and the 20 MB warning.

## 18. Build, test, deploy and the legacy app

Commands (built in M1.2 unless marked planned; [toolchain.md](new-build/toolchain.md) §2):

| Command | Does |
|---|---|
| `npm ci` | installs exactly the lockfile, scripts disabled |
| `npm run typecheck` | `tsc -p app/tsconfig.json` (strict, `erasableSyntaxOnly`, `noEmit`): all of `app/src`, from M1.3 with `model/`, `ingest/`, `engine/` and `views/`; the Node-side `.ts` in `scripts/` and `tests/` is not type-checked yet ([toolchain.md](new-build/toolchain.md) §2) |
| `npm test` | `node --test "tests/**/*.test.mjs" "tests/**/*.test.ts"` (the `.ts` tests run from source by Node's type stripping, M1.3); CI runs it under `TZ=Asia/Kolkata` and `TZ=UTC` (`npm run test:utc` was not added) |
| `npm run parity` (planned) | new engine against the legacy engine (`tools/engine-host.js`) with the parity ledger; from M1.3 the base-file and reference-data parity tests (`tests/parity/`) run inside `npm test`, with one ledger per area (`tests/parity/base-file-ledger.json`) |
| `node scripts/validation/traceability.mjs` | every test file names the parity-matrix rows it covers; a row in progress or later without a test fails (M1.3) |
| `node scripts/data-extract.ts [--check]` | writes `data/refdata/*.json` from the blocks of `index.html`, or checks them equal (M1.3) |
| `npm run build` | `scripts/build.mjs` to `app/dist/index.html` and `app/dist/build-manifest.json` (git-ignored); prints the size and SHA-256 |
| `npm run check` | `scripts/validation/check-next.mjs`: CSP first, hashes match, no network, one allowed link, banner, size budget, a scan of `app/src`; `-- --rebuild` for the deterministic build |
| `npm run serve` | `scripts/serve.mjs`, 127.0.0.1:8100: legacy at `/`, new at `/next/` |
| `node tests/browser/next-spike.mjs` | the CSP, network and IndexedDB gates in headless Edge or Chrome (local only) |
| `npm run update -- <YYYY-MM>` (planned, M11) | the monthly update engine (local; `PRD_MONTHLY_INBOX`) |
| `npm run accept:office` (planned) | local only: open the latest exports in Excel and PowerPoint through COM |

**CI today** (`.github/workflows/ci.yml`): the job `checks` runs the legacy gates (invariants, smoke, AI Analyst,
regression) unchanged; the job `next` runs the privacy scan of the documentation, the docs link check and the monthly
PRD check (Node built-ins only), then `npm ci`, the type check, the build, `check-next.mjs --rebuild`,
`node --test "tests/**/*.test.mjs" "tests/**/*.test.ts"` under IST and UTC (from M1.3 with the new app's unit and
parity tests), the traceability report, `data-extract.ts --check` and, last, the release check in its CI form. Later
milestones add export structure and acceptance tests. **Pages:** from M1.2 `pages.yml` stages `_site/index.html`
(legacy, byte for byte) and `_site/next/index.html` (new) (D-024). The legacy gates block the deployment; the new
app's steps (`npm ci`, build, `check-next.mjs --rebuild`) never do: when one fails, `/next/` gets a static notice
that the preview could not be built for that commit, the log a warning, and the legacy page deploys as usual (D-034,
[DEPLOYMENT.md](DEPLOYMENT.md)).

**Coexistence:** the legacy page is the review link until parity (Q-17); nothing exported from `/next/` is used for a
client before switch-over; the live page receives calculation, data and security fixes and presentation-only work goes
to the new build (D-028); every legacy fix is ported with the same known answer; both apps carry one data vintage; the
parity ledger classifies every output difference, and an unclassified one fails CI.

## 19. Size and performance budget

Libraries about 1.6 MB, data and images about 14 MB, application code under 1 MB: about 17 MB, as today. Reference
data is parsed once from JSON blocks; `computeReview` stays under 500 ms at 50 holdings; scope results are cached;
exports run on demand. The build fails above 25 MB.

## 20. Phase 2 readiness

The scenario model carries what an automated rebalancing engine needs: unit-level lots and eligibility dates,
redemption schedules by date, destinations with product class and asset constraints, transition buckets, the AI
Analyst as a pluggable proposal source, and recomputation through the same engine. The AI Analyst constraints held
since 4 Sep are ported as named constraints, off by default (Q-81). `ProposalSource.propose(review, constraints)` is
defined in M8; no decision engine is built now.

## 21. Decisions

The decisions behind this design are recorded in [DECISIONS.md](DECISIONS.md), which owns them: D-023 (publication
and return methods), D-024 (the `/next/` preview), D-025 (npm for build tooling), D-026 (data classes; the Screener
pack never public), D-027 (the MF Screener link), D-028 (what the live page receives), D-029 (the missing-value dash),
D-030 (observation thresholds), D-031 (borders and Actionables), D-032 (the capital-gains template), D-033
(Claude's charge of GitHub and the dashboard), D-034 (the toolchain, the one-file build and the preview that never
blocks the legacy page) and D-035 (reference data in the repository and the base-file reading conventions). The
owner's audit decisions are OD-nn in
[audits/2026-10-19-decisions.md](audits/2026-10-19-decisions.md); the open questions are Q-nn in
[open-questions.md](new-build/open-questions.md).

## 22. Not verified yet

Each is a gate of the milestone named, and this section is updated when it closes:

- Excel opening the in-house writer's output without repair (M1.4 spike); PowerPoint rendering of the components and
  theme XML post-processing (M9).
- A real double-click of the built page on an analyst's own browser profile (the M1.2 spikes ran headless; the browser
  QA steps of [toolchain.md](new-build/toolchain.md) §9).
- The capital-gains template's columns (D-032; a proposal, not yet tried by analysts; M7).
- The MF Screener data pack: no pack has been received, so its parser and limits are designed against the contract
  only, and its size in IndexedDB is unmeasured (M10).
- The exact columns of the Index TRI files (known from the data-source survey; confirmed on the first files read, M11).
- The remote force-push check of AC-22 (designed, not run; not done in M1.2).

Closed by the M1.2 spikes (22 Oct 2026, [toolchain.md](new-build/toolchain.md) §6): `npm ci` and esbuild on this
laptop; the hash-based CSP under `file://` and served; IndexedDB kept under `file://` and served across a reload and a
browser restart (headless Edge 155 and Chrome 155).
