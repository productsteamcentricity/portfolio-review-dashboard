# Architecture and dependency map

**Written:** 28 Oct 2026 (IST) by MOD-01 for the handover to MOD-02. **Baseline:** `main` at `6443826` (PR #16), live
page MD5 `12B5E5727FCA01EF2EA162C59913F01D`. Branch-only content is marked with the branch and its head SHA.

**What this file is.** One map that covers both products in this repository, the live page and the new app, and shows
who depends on what. It is for MOD-02, ARC-01 and every implementing chat before they touch a shared file. It does not
replace the detailed architecture documents, which stay authoritative for their product:

- the live page: [`docs/legacy/ARCHITECTURE.md`](../legacy/ARCHITECTURE.md);
- the new app: [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md);
- the data model: [`docs/DATA_DICTIONARY.md`](../DATA_DICTIONARY.md);
- the exact shape and change rule of each shared interface: [INTERFACE_CONTRACTS.md](INTERFACE_CONTRACTS.md).

**Labels.** [VERIFIED] means checked on 28 Oct 2026 with the command or file named. [INFERRED] means reasoned from
verified facts. [UNCERTAIN] and [UNKNOWN] mean the evidence is incomplete.

**Method.** Block structure and line numbers come from a fresh `tools/extract-blocks.js` run on a scratch copy of
`index.html` at MD5 `12B5E572` (outside the repository). The repository's own `.blocks/` reading copies are from
21 Oct and are stale (section 12), so do not cite them.

## 1. The system at a glance

| Product | What it is | Served at | Owner workstream | State on 28 Oct |
|---|---|---|---|---|
| Live page | `index.html`, one offline 16.8 MB file used by analysts for client reviews | GitHub Pages `/` | A (live page) | MD5 `12B5E572`, 16,837,249 bytes, equal to `main` [VERIFIED: download of `/` on 28 Oct 07:08 UTC, MD5 and size match `git show origin/main:index.html`] |
| New app | A clean rebuild (CR-0006) in `app/`, built into one offline file | GitHub Pages `/next/`, with a "Preview, not for client use" banner (D-024) | B (new build) | 46,905 bytes, SHA-256 `0407eb12...` (MD5 `b4f23c7e...`), unchanged since PR #14 [VERIFIED: download of `/next/` on 28 Oct] |

Both products live in one public repository and share one CI workflow, one Pages workflow, the reference data and
several tests. That sharing is the source of most cross-workstream risk (section 11).

## 2. The live page: 13 script blocks

The page is one HTML file with 13 real `<script>` blocks (a naive count finds 14, because the PptxGenJS block holds a
literal `<script`). Tools find each block by a **marker string** in its first characters, never by position (CLAUDE.md
rule 5). [VERIFIED: extract-blocks on the scratch copy; `tools/check-invariants.js:29-43`]

| # | Block | Marker (as in `tools/check-invariants.js:29-43`) | Content | Size | Kind |
|---|---|---|---|---|---|
| 00 | chartjs | `Chart.js v` | Chart.js 4.4.0 | 204,948 chars | vendored library |
| 01 | datalabels | `chartjs-plugin-datalabels` | chartjs-plugin-datalabels 2.2.0 | 12,937 chars | vendored library |
| 02 | sheetjs | `xlsx.js (C) 2013-present SheetJS` | SheetJS CE 0.18.5 | 639,123 chars | vendored library |
| 03 | pptxgenjs | `PptxGenJS 3.` | PptxGenJS 3.12.0, which bundles JSZip | 477,376 chars | vendored library |
| 04 | refdata | `window.REFDATA =` | 21 reference blocks including `DATA_DATES` | 10,080,353 chars | data |
| 05 | dividers | `var DIVIDERS=` | section divider images | 175,818 chars | data |
| 06 | logos | `var BRAND_LOGOS=` | logos, Market Update images, topic slides | 3,184,680 chars | data |
| 07 | engine | `Pure compute + PPTX/XLSX builders` | the calculation engine, `window.ENGINE` | 3,275 lines | app code |
| 08 | exporters | `EXPORTERS (PPTX via PptxGenJS` | `ENGINE.buildPPTX`, `ENGINE.buildXLSX` | 2,277 lines | app code |
| 09 | parsers | `RUNTIME REFERENCE PARSERS` | `ENGINE.parsers`, `window.MFA_GATE` | 430 lines | app code |
| 10 | er_table | `window.MF_ER_TABLE=` | base expense ratios, 14,644 keys | 981,363 chars | data |
| 11 | app_ui | `var REF = window.REFDATA, E = window.ENGINE;` | the UI: 20 tabs, uploads, state | 6,046 lines, 3 raw NUL bytes | app code |
| 12 | boot | `function setLogo(` | logo and Market Update upload | 31 lines | app code |

Sizes and line counts: [VERIFIED by the architecture investigator's scratch extraction of `12B5E572`, 28 Oct].

### 2.1 Scopes and load order
- The five app scripts (07, 08, 09, 11, 12) are self-contained. They share state **only** through `window.*` and
  `ENGINE.*`. A helper put in the wrong scope is silently `undefined` (CLAUDE.md rule 5).
- Load order matters: engine (07), then exporters (08), then parsers (09). The UI (11) runs after all three.
- The UI starts with `activeRef = JSON.parse(JSON.stringify(REF))` (block 11 line 5): a session copy of the embedded
  reference data that sidebar uploads replace for the session only.

### 2.2 The ENGINE API (block 07)
- The engine is one IIFE. Its `API` object is at block 07 line 3262 and holds 21 keys: `palette, FONT, amcDisplay,
  amcKey, normalize, matchInstrument, matchPMS, resolveBench, benchmarkFor, bucketDefs, parseBaseRows, assetLabel,
  computeReview, computeTaxation, taxClassOf, xirr, aiaCompute, aiaWeights, aiaAmcCap, aiaOvBands, fmt`. [VERIFIED]
- Key functions: `parseBaseRows` (line 782), `assetLabel` (771), `computeReview` (1052), `computeTaxation` (339),
  `taxClassOf` (278), `xirr` (983), `amcKey` (84). [VERIFIED]
- The exporters add `ENGINE.buildPPTX` and `ENGINE.buildXLSX` (block 08 lines 2271-2272). The parsers add
  `ENGINE.parsers` with 9 functions (block 09 line 426). [VERIFIED]
- The tax batch (TA-03, branch `continuation/ex-01-task-ta-03-20261027` at `0f1c5d3`) adds `taxClassify`,
  `taxApplyAssumptions`, `taxAssumeFor` and `taxDefaults`. [VERIFIED: `tax-1` patch line 461, `tax-3` patch line 817]
- `tools/check-invariants.js` checks only part of this surface: its `ENGINE_KEYS` (lines 47-49) omit `amcKey` and
  `xirr`, and the tax branch does not add its four keys (TA-22, EXISTING DEFECT in the tooling). [VERIFIED]

### 2.3 Exporters (block 08)
- `buildPPTX(model, PptxGenJS, only)`: `only` is undefined (full deck), a string (one group) or an array (the slide
  picker). 22 group keys. The pagination constants are calibrated by hand: a font or padding change means re-deriving
  them and opening every page boundary (CLAUDE.md conventions). [VERIFIED]
- `buildXLSX(model, XLSX)`: 14 fixed sheets plus one sheet per client, names cut to 31 characters, no Taxation sheet.
  [VERIFIED]
- Both read data the UI publishes on `window` (section 2.5) as well as `DIVIDERS`, `BRAND_LOGO`, `TOPIC_SLIDES` and
  `MARKET_UPDATE_IMAGES`.

### 2.4 Parsers (block 09)
- `ENGINE.parsers`: `parseEquitySide, parseDebtSide, parseMonitor, parseSIF, parsePMS, parseIRR, fmtDate,
  parseAdditionalDebt, parseSOA` (line 426). [VERIFIED]
- `parseIRR` (line 365) reads the IRR transactions workbook: the fund sheet's name contains "XIRR", the benchmark
  sheet's "BMXIRR", and the header is found in the first 20 rows by alias lists. [VERIFIED]
- `window.MFA_GATE` (line 94) is the MF Analysis age gate the exporters read. [VERIFIED]

### 2.5 The UI (block 11)
- 20 tabs; uploads of the base file, IRR workbook and sidebar reference files.
- `resetFamilyState()` (line 270) runs when a base file is loaded over another or removed. It clears every
  per-family variable and the exporter globals `__taxScope, __cvsEdited, _cvsSnapshot, __REBAL_DATA, __PROPPERF_DATA,
  __AIA_DATA, __AIA_APPLIED, __COST_DATA, __PORT_COST_FULL, __MFA_DATA, _mfaRat, __REBAL_UNIV` (D-015, KI-001).
  [VERIFIED: block 11 lines 270-291]
- It publishes `window.getIPSData` (line 4839), `window.filterPerfBuckets` (972) and `window.COST_OVERRIDES` (5186)
  for the exporters. [VERIFIED]
- It keeps 7 `localStorage` keys between sessions (INTERFACE_CONTRACTS.md, I-07). They are not cleared by
  `resetFamilyState()`; KI-012 records what they hold. [VERIFIED]

### 2.6 Vendored library blocks (00 to 03, plus 06)
- The four libraries are shipped byte for byte and are never edited. JSZip is not a block of its own: it is inside
  PptxGenJS. [VERIFIED]
- They are a shared interface since M1.4: the new app vendors the same bytes (D-038, branch `feat/m1-4-overview` only).
  `scripts/vendor-extract.mjs` reads blocks 00 to 03 and the logos of block 06 from `index.html` and writes
  `app/vendor/*.js`, `app/vendor/MANIFEST.json` and `app/src/config/brand-logos.json`. Its `--check` runs in CI on
  that branch (`ci.yml` line 74 there). [VERIFIED by `git show feat/m1-4-overview`]
- On `main`, `app/vendor/MANIFEST.json` lists no library. [VERIFIED]

## 3. Live-page tooling (CommonJS, `tools/`)

| Tool | Does | Reads | Notes |
|---|---|---|---|
| `tools/engine-host.js` | `load()` returns `{XLSX, Ppt, E, REF}`; `build(base, meta)` runs the shipped blocks in a Node vm | blocks 02-10 by marker (lines 21-29) | Unchanged since 14 Oct. Run engine code from a script file, never `node -e` (KI-011). Also used by NB-01's tests |
| `tools/check-invariants.js` | structure, no network, ENGINE surface, REFDATA keys, data dates, look-through sums; `--expect-md5 <hash>` | all 13 blocks by marker | CI and Pages gate |
| `tools/smoke-review.js` + `tools/make-sample-base.js` | end-to-end on a synthetic book of 13 holdings and 2 clients | engine-host | 35 checks on `main`; 36 on the tax branch |
| `tools/test-ai-analyst.js` | AI Analyst rules on the real embedded data | engine-host | 24 checks; CI only, not in Pages |
| `tools/run-regression.js` | runs every `tools/regression/*.js` known-answer test | engine-host, cut UI code | 19 files on `main`, 44 on the tax branch |
| `tools/browser-checks/family-isolation.js`, `cvs-refresh.js` | console checks in a real browser | the served page | qa-engineer, for UI and export changes |
| `tools/extract-blocks.js` | writes reading copies to `.blocks/` | all blocks by marker (lines 32-46) | its chartjs marker differs slightly from check-invariants' (line 33 vs 30) |
| `tools/render-slides.js` | renders decks to `.pptx` | engine-host and a base file | **client-data hazard** if pointed at a real file; outputs are git-ignored and must stay local |
| `tools/patch-lib.js` + `tools/patches/*.js` | the only way code in `index.html` changes (D-016) | `index.html` | see section 4 |
| `tools/serve-dashboard.js` | serves the page on 127.0.0.1:8099 (another port as an argument) | `index.html` | preview config `dashboard` |

[VERIFIED: `git ls-files tools` and the files' headers at `6443826`]

## 4. The patch-script rule (D-016, CLAUDE.md rule 1)
- `index.html` is never opened in an editor. Code changes only through a committed script
  `tools/patches/<yyyy-mm-dd>-<slug>.js` built on `tools/patch-lib.js`.
- `patch-lib.js` applies anchored replacements: each anchor must occur exactly once, a fully applied patch is a no-op,
  and a partly present patch is refused. It refuses to write a file that breaks the invariants (script count 14,
  tail, LF line endings, no BOM, NUL count) and prints the MD5 before and after.
- Data blocks change only through `buildtools` (section 5), on a `data/YYYY-MM-refresh` branch.
- After every patch: `node tools/check-invariants.js`, then the full check list in
  [`docs/TESTING.md`](../TESTING.md).
- **The documented rebuild rule does not run on today's HEAD** (TA-23, EXISTING DEFECT in docs and tooling).
  CLAUDE.md says to rebuild with `git checkout -- index.html` and every patch in file-name order. On `main`, 5 of the
  9 patches report "already applied" and 4 refuse because later patches rewrote their anchors. The refusal is safe
  (the file is unchanged), but a fail-fast replay stops. What actually reproduces a page is **the parent page's MD5
  plus the branch's new patches in order**, which is how `0713C6BE` and `5F1C2FC5` were reproduced.
  [VERIFIED by the architecture investigator's scratch replay, 28 Oct]

## 5. Monthly refresh toolchain (`buildtools/`)
- Written by the previous owner, restored on 15 Oct (CR-0003) and proved byte-identical on the September data.
  Procedure: [`docs/MONTHLY_REFRESH.md`](../MONTHLY_REFRESH.md); scripts: [`buildtools/README.md`](../../buildtools/README.md).
- Order each month: `intake_check.js` (inbox) → `survey_month.js` (vendor drift) → `build_refresh.js` (blocks) →
  `check_blocks.js` (the gate) → `splice_refresh.js --data-only` (writes REFDATA, MF_ER_TABLE, slides and labels into
  `index.html`) → `postcheck.js`, then `build_risk.js`, `build_stockret.js` and `refresh_pms_perf.js` when their files
  exist, each built immediately before its own splice.
- `snapshot_client.js` and `compare_snapshots.js` take a real base file; their outputs hold client holdings and stay in
  git-ignored `buildtools/out/`.
- Every splice is followed by `node tools/check-invariants.js`, and **`node scripts/data-extract.ts` in the same
  change** so `data/refdata/` stays equal to the page (D-035). The refresh merges only after the owner replies
  "publish" (D-017, PD-30).
- The risk-ratio toolchain received with the previous owner's second export is not in the repository; where it may
  live is pending owner decision PD-21 (TA-20). [VERIFIED: not tracked; decision open]

## 6. Reference data extraction (`data/refdata/`)
- `scripts/data-extract.ts` reads blocks 04 (`REFDATA`) and 10 (`MF_ER_TABLE`) by marker (line 99) and parses them as
  JSON, never as code. It writes 20 block files with sorted keys and LF endings, plus `VINTAGE.json` (schema
  `refdata-vintage-v1`, data month `2026-09`). [VERIFIED]
- `FUND_RANKS` is reduced to `FUND_RANKS_CODES.json` (scheme name to AMFI code only); `FUND_RANKS_META` is not
  extracted. Scores and ranks never enter the new app's files (D-026). [VERIFIED: `data-extract.ts` lines 36-38]
- The extractor imports `app/src/engine/dates.ts`, so the extraction of legacy data depends on new-app code.
  [VERIFIED]
- CI runs `node scripts/data-extract.ts --check` (`ci.yml` line 72): any change to the page's data blocks that does
  not regenerate `data/refdata/` in the same change fails CI. [VERIFIED]
- `TAX_RULES` has 25 records on `main` and 34 on the tax branch, so TA-03 regenerates `TAX_RULES.json` and
  `VINTAGE.json`. [VERIFIED: `VINTAGE.json` on both refs]

## 7. The new app (`app/`, CR-0006)

### 7.1 Modules on `main` (`6443826`)
| Folder | Holds | Notes |
|---|---|---|
| `app/src/config/` | `formats.ts`, `links.json` (the one MF Screener link, D-027), `sections.json` (the nine sections), `tokens.json` | config only |
| `app/src/engine/` | `dates.ts`, `ids.ts`, `ownership.ts`, `units.ts`, `value.ts`, `classify/asset.ts` | pure functions |
| `app/src/ingest/` | `base-file.ts` (the new base-file reader), `cells.ts`, `workbook.ts` | reads SheetJS output |
| `app/src/model/` | 9 files: holdings, ids, ownership, source, status, validation, value, audit, index | the single data model (D-035) |
| `app/src/ui/`, `views/`, `main.tsx` | Preact shell (`App.tsx`, `shell.css`), `views/format.ts` | nine tabs across the top (D-037) |
| `app/src/types/vendor.d.ts` | types for `vendor:<name>` imports | |
| `app/vendor/MANIFEST.json` | vendored libraries with SHA-256; empty list on `main` | |

[VERIFIED: `git ls-files app` at `6443826`]

### 7.2 What M1.4 adds (branch `feat/m1-4-overview` at `07a6460`, LOCAL ONLY)
- `engine/aggregate/*` (allocation, entities, sum, totals), `engine/review.ts`, `engine/validate/{gate,reconcile}.ts`,
  `engine/classify/liquidity.ts`, `ingest/load-base.ts`, `model/review.ts`.
- `exports/pptx/*` (the C-08 slide and components), `exports/xlsx/*` (an in-house SpreadsheetML writer and 7 sheets),
  `exports/zip/*` (STORE zip and CRC-32), `exports/ooxml/namespaces.ts`.
- `services/*` (audit-log, clock, download, sha256, storage); `ui/components/*` and `ui/sections/*`; `views/*`.
- `config/money-columns.ts` (`MONEY_COLUMN_RULE`, D-039 point 1), `brand-logos.json`, `disclaimer.json`,
  `slide-manifest.json`.
- `app/vendor/*.js` and licences (D-038), `scripts/vendor-extract.mjs`, `scripts/lib/legacy-blocks.mjs`,
  `scripts/office/*` (Office acceptance through COM, `npm run accept:office`).
- In total 236 files, +27,324 / -492 lines against `main`. [VERIFIED: `git diff --stat origin/main...feat/m1-4-overview`]
- The round-2 fixes G1 (`4610684`), G2 (`be7f395`) and G3 (`202f8f6`) sit on their own local branches, one commit
  each, not yet integrated. [VERIFIED]

### 7.3 Build and serve
- `scripts/build.mjs` (esbuild 0.28.2) builds one readable IIFE into `app/dist/index.html` (git-ignored) with
  `build-manifest.json`. A `vendor:<name>` import is inlined only when used, after its SHA-256 matches the manifest.
  `tokens.json` and `shell.css` go into one `<style>`. The navigation (nine tabs and the Screener link) is static
  HTML. The CSP meta tag comes first, with script and style hashes and `connect-src 'none'`. The output is
  byte-deterministic. [VERIFIED: file header and `check-next --rebuild` in CI]
- `scripts/serve.mjs` binds 127.0.0.1:8100 and serves `/` (the live page) and `/next/` (the build) only, with a Host
  check. Preview config `next`. [VERIFIED]
- `scripts/validation/check-next.mjs --rebuild` checks the built page (CSP, no network API, one remote URL, banner,
  no en or em dash in static text, size budget) and that two fresh builds are byte-identical. [VERIFIED]
- Ports in use on this laptop: see the port register in
  [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md).

## 8. CI and Pages

### 8.1 `ci.yml`, "Dashboard checks"
- Triggers: push to `main`, every pull request, and `workflow_dispatch` (lines 6-10). A pushed feature branch without a
  PR gets no run unless someone dispatches one: `gh workflow run "Dashboard checks" --ref <branch>`. [VERIFIED]
- Job `checks` (TZ Asia/Kolkata): `check-invariants`, `smoke-review`, `test-ai-analyst`, `run-regression`
  (lines 27-33).
- Job `next`, in order: privacy scan of `docs` and `*.md`; docs links; monthly PRD check; `npm ci`; typecheck; build;
  `check-next --rebuild`; `node --test` under IST and under UTC; traceability; `data-extract --check`; fetch `main`;
  `release-check --ci` last (lines 47-79). M1.4 adds `vendor-extract --check` before the fetch. [VERIFIED]

### 8.2 `pages.yml`, "Publish dashboard to GitHub Pages"
- Triggers: push to `main` touching `index.html`, `app/**`, `package.json`, `package-lock.json`, `.npmrc`,
  `scripts/build.mjs`, `scripts/validation/check-next.mjs` or `pages.yml`; also `workflow_dispatch`. Docs-only merges
  do not republish. [VERIFIED: path filter at line 15; no Pages run exists for the docs-only merges]
- The build job first runs the blocking legacy gates: `check-invariants`, `smoke-review`, `run-regression`. It does
  **not** run `test-ai-analyst` (CI does). [VERIFIED]
- Then `npm ci`, build and `check-next`, each `continue-on-error`, each only after the one before succeeded (D-034).
- Staging (lines 72-106): `index.html` is copied to `_site/index.html` and compared byte for byte with `cmp`.
  `_site/next/index.html` is the build only when `check-next` passed; otherwise it is a static, CSP-locked notice "The
  new application could not be installed, built or checked for commit <sha>" and a `::warning::` in the log. Hashes
  are printed with `sha256sum`. **A failing new app never blocks the live page** (D-034). [VERIFIED]
- The deploy job has `pages: write` and `id-token: write` and runs no repository code. [VERIFIED]

## 9. Tests and validation scripts

| Area | Where | Run by |
|---|---|---|
| Live page known answers | `tools/smoke-review.js`, `tools/test-ai-analyst.js`, `tools/regression/*.js` | CI `checks`; Pages (not the AI test) |
| Repository safety | `scripts/validation/privacy-scan.mjs`, `prepush-scan.mjs` (pre-push hook), `release-check.mjs`, `docs-links.mjs`, `monthly-prd-check.mjs`, `traceability.mjs` | CI `next`, the hook, before every merge |
| New-app build | `scripts/validation/check-next.mjs`, `tests/next/*.test.mjs`, `tests/browser/next-spike.mjs` (local, headless) | CI `next`; spike before build, CSP or layout changes |
| New-app units and parity | `tests/unit/**`, `tests/parity/*` (base-file and refdata parity against the live engine through engine-host) | CI `next`, IST and UTC |
| Policy | `tests/validation/publication-classes.test.mjs` on `monthly_updates/_policy/publication-classes.json` | CI `next` |
| M1.4 only | `tests/exports/**`, `tests/integration/**`, `tests/regression/**`, `tests/acceptance/**`, `aggregation.parity.test.ts`, `tests/unit/scripts/vendor-extract.test.ts` | CI `next` once merged; Office acceptance local |

- Every test file starts with a `// covers:` line naming parity-matrix rows (`traceability.mjs`). [VERIFIED]
- `node --test` counts: 234 on `main` and on the tax branch at `97a7d69` (recorded in its commit message). On
  `feat/m1-4-overview` NB-01 reports 837 tests with 833 passing; an independent IST run counted 773 with 769
  passing; the same 4 failures in both. The cause of the difference is [UNKNOWN].

## 10. Dependency diagram (text)

```
                        LEGACY index.html (Workstream A; code only via tools/patches + patch-lib; data only via buildtools splice)
  +---------------------------------------------------------------------------------------------------------------+
  | 00 Chart.js  01 datalabels  02 SheetJS  03 PptxGenJS(+JSZip) | 04 REFDATA  05 DIVIDERS  06 BRAND_LOGOS  10 MF_ER_TABLE |
  |        \__________\____________\______________\_____ used by UI 11 and exporters 08                          |
  | 07 ENGINE (window.ENGINE) <--- REF passed in ---- 04, 10                                                        |
  |    |--> 08 EXPORTERS: +buildPPTX/+buildXLSX; read UI window.__* globals, DIVIDERS, BRAND_LOGO, TOPIC_SLIDES      |
  |    |--> 09 PARSERS:   +ENGINE.parsers, window.MFA_GATE                                                          |
  | 11 UI: activeRef = copy(REFDATA); uploads -> parsers; parseBaseRows -> computeReview -> 20 tabs, PPTX, XLSX     |
  |        resetFamilyState() clears per-family state; 7 localStorage keys persist                                  |
  | 12 BOOT: logo, Market Update images                                                                              |
  +---------------------------------------------------------------------------------------------------------------+
        ^ every reader finds blocks by MARKER (7 copies of the markers, see INTERFACE_CONTRACTS I-08)
        |
  tools/engine-host.js (vm-runs 02..10) <-- check-invariants, smoke-review(+make-sample-base), test-ai-analyst,
        |                                    run-regression(tools/regression/*), render-slides
        |                                <-- NB-01: tests/fixtures/make-books.ts -> tests/parity/base-file.parity,
        |                                    refdata.parity; [m14] aggregation.parity; [G1] ki-148 test
  tools/extract-blocks.js -> .blocks/ (reading copies, STALE since 21 Oct)
  tools/patch-lib.js <-- tools/patches/*.js (writes index.html code)
  buildtools/* (monthly: intake -> survey -> build -> gate -> splice --data-only) (writes index.html data)
        |
  scripts/data-extract.ts (reads 04, 10 as JSON; imports app/src/engine/dates.ts) -> data/refdata/*.json + VINTAGE.json
        -> CI next: data-extract --check; tests/parity/refdata.parity
  [m14] scripts/lib/legacy-blocks.mjs + scripts/vendor-extract.mjs (reads 00..03, 06) -> app/vendor/*.js, MANIFEST.json,
        app/src/config/brand-logos.json -> CI next: vendor-extract --check
  tests/helpers/sheetjs.ts (runs block 02 in a vm); [m14] tests/helpers/pptxgenjs.ts (block 03)

  NEW APP app/src (Workstream B):
     config --> model <-- ingest (base-file, workbook) <-- engine (dates, units, ids, ownership, classify,
                                                                  [m14] aggregate, review, validate)
            --> views --> ui (Preact)  [m14] --> exports/pptx (PptxGenJS via vendor:)  exports/xlsx (in-house writer + STORE zip)
     scripts/build.mjs (esbuild; vendor:<name> checked by SHA-256; CSP; static nav) --> app/dist/index.html
     scripts/validation/check-next.mjs (--rebuild); scripts/serve.mjs (/ and /next/ on 127.0.0.1:8100)

  CI ci.yml:     checks [legacy gates]  +  next [privacy, docs-links, monthly-prd, npm ci, typecheck, build, check-next,
                 tests IST+UTC, traceability, data-extract --check, ([m14] vendor-extract --check), release-check --ci]
  Pages pages.yml: legacy gates (blocking) -> npm ci/build/check-next (non-blocking) -> _site/index.html (byte copy)
                   + _site/next/index.html (build, or the notice)

  GOVERNANCE: CLAUDE.md rules; .claude/agents/*; scripts/hooks/pre-push (hook script from the main checkout, scanner
              from the pushing worktree); privacy-allowlist.json + private deny-list; publication-classes.json;
              DECISIONS D-016, D-017, D-020, D-028, D-033, D-034, D-035, D-041 (D-038, D-039 branch only)
```

## 11. Downstream consumers per component

| Component | Changed by | Consumers that can break | Check that catches it |
|---|---|---|---|
| Block markers in `index.html` | nobody (frozen) | engine-host, check-invariants, extract-blocks, data-extract, sheetjs helper; on m14 legacy-blocks, vendor-extract, pptxgenjs helper | check-invariants; every tool fails to load |
| `parseBaseRows` (07) | Workstream A patch | `computeReview`, every tab, both exports; NB-01's base-file parity test and ledger | run-regression; `tests/parity/base-file.parity.test.ts` (CI `next`) |
| `computeReview` (07) | Workstream A patch | every tab and export; m14 aggregation parity (AG ledger) | smoke, regression; aggregation parity on m14 |
| `computeTaxation`, tax classes, `TAX_RULES` | Workstream A (TA-03) | Taxation tab and slides, AI Analyst tax signal, `data/refdata/TAX_RULES.json` | KI-160..182 regression; financial review; data-extract --check |
| ENGINE keys | Workstream A | exporters, parsers, UI, tools | check-invariants (partial: TA-22) |
| UI `window.__*` globals | Workstream A | exporters | smoke (full deck), family-isolation.js |
| `REFDATA` / `MF_ER_TABLE` data | monthly refresh | engine, UI, exporters, test-ai-analyst, data/refdata, NB-01 refdata parity | check_blocks gate, check-invariants, data-extract --check |
| Library blocks 00-03, logos 06 | nobody (frozen) | live page; new app through vendor-extract (m14) | vendor-extract --check (m14); m14 test pinning MD5 `911A0465` already fails until G1 lands |
| `tools/engine-host.js` | frozen | all legacy tools; NB-01 fixtures and parity tests | every tool |
| `tools/make-sample-base.js` | Workstream A | smoke, QA, NB-01 `make-books.ts` (mirrors it) | smoke known answers; NB-01 fixtures |
| `data/refdata/*` | generated only | new app (later milestones), refdata parity test | data-extract --check |
| `app/src/ingest/base-file.ts` | Workstream B | new model, parity tests | base-file parity, unit tests |
| `scripts/build.mjs`, CSP, `pages.yml` | Workstream B (pages.yml by lead decision D-034) | `/next/`; Pages staging of `/` | check-next, pages-workflow test |
| `ci.yml` | both workstreams | every PR | CI itself |
| Shared docs (DECISIONS, KNOWN_ISSUES, PROJECT_STATE, CHANGELOG, TESTING, CLAUDE.md) | both workstreams | every chat's understanding | docs-links; merge-tree simulation by ARC-01 |

## 12. High-risk files

| File or area | Why it is high risk | Rule |
|---|---|---|
| `index.html` | 16.8 MB product, 10 MB lines, 3 raw NUL bytes; editors corrupt it; every reader depends on markers | patch scripts only (D-016); never open it in an editor |
| Block 07 engine | TA-03 (tax) and TA-05 (batch 5) both patch it; parity tests of the new app read its output | one engine patch branch at a time; TA-05 starts from `main` after TA-03 merges |
| `tests/parity/*-ledger.json` and the parity tests | written by both workstreams; "every active entry used" fails on any unused entry | retire entries in the same PR as the legacy fix; on m14 also edit the pinned retired list (`aggregation.parity.test.ts:68` at G1) |
| `data/refdata/*` | generated; CI fails if not equal to the page | regenerate in the same change (D-035), never hand-edit |
| `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`, `docs/PROJECT_STATE.md` | merge-tree of TA-03 with M1.4 gives conflicts: 1, 2 and 1 hunks | second to merge takes `main`, keeps number order and both sides' rows |
| `CHANGELOG.md`, `docs/TESTING.md` | edited by both; merge cleanly today | keep both sides' rows |
| `.github/workflows/ci.yml` | both workstreams edit it; M1.4 adds a step | ARC-01 review of any change |
| `app/vendor/*`, `MANIFEST.json` (m14) | must equal the legacy blocks byte for byte | vendor-extract only; a version change needs a recorded decision |
| `scripts/hooks/pre-push`, `scripts/validation/*` | the privacy controls of a public repository | never weaken to make a push pass; never `--no-verify` |
| `tools/check-invariants.js` | the legacy gate; its ENGINE_KEYS are incomplete (TA-22) | additive changes with ARC-01 review |
| `.claude/agents/*.md` | the specialist reviewers' instructions; legacy-only and stale (TC-17) | refresh in a small reviewed PR |

## 13. Known drift in the documents this map summarises
- `.blocks/` reading copies date from 21 Oct; engine, exporters and UI copies differ from today's blocks.
  [VERIFIED by MD5 comparison]
- [`docs/legacy/ARCHITECTURE.md`](../legacy/ARCHITECTURE.md) section 2 gives baseline line counts (2,886 / 2,208 /
  5,710); today's are 3,275 / 2,277 / 6,046, so `07_engine.js:NNN` citations there drift. [VERIFIED]
- CLAUDE.md says smoke has 35 checks: true on `main`, becomes 36 when TA-03 merges, so the TA-03 PR updates it.
  [VERIFIED]
- The agent definitions name none of `run-regression`, `data-extract`, `vendor-extract`, `prepush-scan` or
  `release-check`, and qa-engineer still says the AI test has 17 checks (now 24) (TC-17). [VERIFIED]
- AC-22 force-push detection is described as active in `docs/DECISIONS.md:313` and `docs/DEPLOYMENT.md:45`, but
  `docs/ARCHITECTURE.md:586` says it is designed and not built, and no such check exists (TB-24). [VERIFIED]
