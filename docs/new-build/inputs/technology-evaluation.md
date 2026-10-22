# Technology evaluation for the new Portfolio Review application

Phase 0 deliverable (input to "new application architecture" and "proposed repository structure").
Date: 21 Oct 2026. Baseline examined: `main` at `782794f`, the legacy single-file `index.html`
(16,817,827 bytes). Nothing in the repository was changed.

Evidence labels used throughout:

- **[V]** verified in this session by running a command or a probe on synthetic data;
- **[D]** stated in the repository's own documentation, not re-tested here;
- **[I]** inference or engineering judgement;
- **[U]** could not be verified (reason given in section 12).

---

## 1. Recommendation in one paragraph

Build the new application as **TypeScript source (erasable syntax only) in plain ES modules, bundled by
esbuild into ONE offline HTML file**, with a small Node build script that inlines (a) the vendored
runtime libraries verbatim, (b) the application bundle, (c) the reference data as non-executable JSON
blocks, and (d) a Content-Security-Policy meta tag with script hashes. Use **npm only for tooling**
(esbuild, TypeScript) plus one tiny runtime package (Preact) for the UI, all pinned exactly with a
lockfile. Keep the runtime libraries the analysts use today, **extracted byte-for-byte from the legacy
`index.html`** (PptxGenJS 3.12.0, SheetJS CE 0.18.5, Chart.js 4.4.0, datalabels 2.2.0), then upgrade
SheetJS to 0.20.2 or later for two published security fixes once the parity tests exist. Write the
formula-driven, styled Excel workbook with a **small in-house SpreadsheetML writer** (the embedded
SheetJS build cannot write styles or freeze panes; ExcelJS is the fallback). Test with the built-in
`node:test` runner directly on the TypeScript sources, plus OOXML inspection of every generated deck
and workbook, plus a legacy-versus-new parity suite that reuses `tools/engine-host.js`. Publish the
new app at `/next/` beside the untouched legacy page on the same GitHub Pages site.

If the owner prefers to keep "no npm install", the same layout works with option (a) (section 4.1);
the difference is a hand-written bundler and no CI type check.

---

## 2. Constraints that drive the choice

| Constraint | Source | Consequence for the stack |
|---|---|---|
| No network calls at runtime; enforced by `tools/check-invariants.js` | CLAUDE.md rule 2, D-001 context [D] | everything inlined; CSP `connect-src 'none'`; invariant scan of the built file |
| Opened from Pages, from the local server, and by double-click (`file://`) | ARCHITECTURE §1 [D] | one self-contained HTML file; no ES-module imports at runtime (relative module imports do not load from `file://`) [I] |
| Pages publishes only `index.html` today | `.github/workflows/pages.yml` [V] | workflow must stage a second file at `next/index.html` |
| Windows laptops, portable Node in the local toolchain folder | D-006 [D] | Node **v24.21.0**, npm **11.19.0**, npx 11.19.0 present [V]; npm registry reachable (`npm view` works) [V] |
| CI on GitHub Actions (Ubuntu, Node 24, `TZ=Asia/Kolkata`) | `ci.yml`, `pages.yml` [V] | `npm ci` step needed for the new app; legacy job can stay install-free |
| One calculation model for dashboard, PowerPoint and Excel | brief, Phase 2 | engine must be DOM-free and the only producer of numbers; exporters read only the model |
| PowerPoint: native editable charts and tables, Cambria, 9 pt | brief, Phase 9 | PptxGenJS (verified below) |
| Excel: formulas, styles, freeze panes, filters, no merged data cells, re-upload with recalculation | brief, Phase 10 | the embedded SheetJS cannot do styles or panes (verified below) |
| Legacy stays live until parity | brief 0.3/0.4, DEPLOYMENT.md [D] | side-by-side deploy; parity test harness |
| Public repository | D-008 [D] | no client data in fixtures; synthetic tests only; supply-chain hygiene matters |

---

## 3. What the legacy build actually contains (facts the new stack must match or beat)

### 3.1 Embedded runtime libraries [V]

Extracted from `index.html` by marker (read-only script; output kept in the session scratchpad):

| Library | Version (from banner) | Bytes | SHA-256 (first 16 hex) | Notes |
|---|---|---|---|---|
| Chart.js | 4.4.0 | 204,948 | `321e3a3fa98da4aa` | UMD build |
| chartjs-plugin-datalabels | 2.2.0 | 12,937 | `20c08f3d9c6d2ef7` | |
| SheetJS Community Edition | 0.18.5 (`XLSX.version`) | 881,727 | `c9506197caf809a0` | full build with codepage tables; **byte-identical to `buildtools/xlsx-embedded.js`** |
| PptxGenJS bundle | 3.12.0, built 2023-03-20 | 477,529 | `cd078ca9e91c6f9e` | bundles JSZip (reports `JSZip.version` 3.5.0) and core-js/@babel/polyfill |

No vendor bundle calls `fetch`; the PptxGenJS bundle contains one `XMLHttpRequest` path (used only
when an image is given by path or URL instead of data) and five `Function(...)` constructor calls in
its polyfills [V]. The 19 Oct audit tested a meta CSP without `'unsafe-eval'` on a copy and the exports
were unchanged (61 slides, 15 sheets) [D], so those polyfill paths are not reached in practice.

### 3.2 How the legacy exports use them [V]

- PowerPoint (`08_exporters.js`): 8 native charts (5 bar, 2 pie, 1 doughnut), 29 native tables,
  12 images. Two of the images are the **overlap matrices, rendered from a canvas to PNG**, so they are
  not editable in PowerPoint.
- Excel (`buildXLSX`): values, number formats and column widths only. **No cell styles, no formulas,
  no freeze panes, no filters.**
- The exporters read data the UI publishes on `window` (`__REBAL_DATA` 5 reads, `__PROPPERF_DATA` 3,
  `__AIA_DATA` 3, `__taxScope`, `__COST_DATA`, `_cvsSnapshot`, `rbPostAnalytics`, plus overlap selection
  globals). Calculations for Current vs Sample, post-rebalancing analytics and cost live in the UI script,
  which is why the regression suite has to cut UI code out of `index.html` by anchors and run it on a
  fake DOM (`tools/regression/lib/cvs-harness.js`). **The legacy app does not have one calculation model
  today**; the new architecture must move every one of these calculations into the engine.
- The UI script contains 63 `innerHTML` occurrences (KI-008 context: unescaped workbook text, no CSP).

### 3.3 Other facts [V]

- Repository: branch `main`, commit `782794f`, working tree clean; 5 commits have touched `index.html`.
- `.gitignore` blocks `*.xlsx *.xlsm *.xls *.csv *.pptx *.pdf *.docx *.png *.jpg *.zip` everywhere.
  The brief wants `monthly_updates/YYYY-MM/` (PowerPoint, PDF, Excel) tracked publicly, so the new
  layout needs an explicit, reviewed exception (section 7.4).
- Office on this laptop: Excel and PowerPoint (Office16) are installed; LibreOffice is not; Edge and
  Chrome are installed.

---

## 4. Options compared

### 4.1 Option (a): zero dependencies (vendored libraries + plain ES modules + custom Node build)

How it would work: source as ES modules (JavaScript with JSDoc types, or erasable TypeScript run by
Node's built-in type stripping); a Node script turns the module graph into one classic script and inlines
it with the vendored libraries and the data.

What I verified about the enablers [V]:

- Node 24.21.0 runs `.ts` files with erasable types natively (`process.features.typescript` is
  `"strip"`; a `node:test` file importing a `.ts` module passed). `enum` is rejected
  (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`), so the code must stay in the erasable subset.
- `module.stripTypeScriptTypes()` exists and works, but prints an **ExperimentalWarning**: a build that
  depends on it depends on an experimental API.
- Node 24 has no bundler. Turning ES modules into one script needs import/export rewriting, scope
  isolation and dependency ordering: roughly 200 to 300 lines of parser-adjacent code that the project
  would own forever [I].

Pros: no npm, no lockfile, no native binaries, CI stays install-free, nothing new to audit.
Cons: a home-made bundler (the riskiest piece of code in the project, and not a business feature); no
type checking in CI (only in the editor); JSX not available, so the UI is hand-written DOM code where
escaping and focus/state preservation must be engineered by hand (the legacy KI-008, KI-086 and KI-114
show what that costs); the experimental type-stripping API.

### 4.2 Option (b): npm toolchain, pinned (recommended, in a minimal form)

| Package | Role | Version to pin [V: npm view] | Published | Licence |
|---|---|---|---|---|
| esbuild | bundle TS/TSX into one IIFE string | 0.28.2 | 2026-08-08 | MIT |
| typescript | type-check only (`tsc --noEmit`) | 7.0.2 (native compiler) or 6.0.3 (last JS-based) | 2026-07-08 / 2026-04-16 | Apache-2.0 |
| preact | UI rendering, escapes text by default | 10.29.8 (11.0.0 shipped 2026-09-30; adopt later) | 2026-08-01 | MIT |

Runtime libraries are **not** taken from npm in phase 1: they are the vendored files extracted from the
legacy page (identical behaviour, no download needed), listed in a hash manifest and inlined verbatim.

Pros: a battle-tested bundler; real type checking of the shared model (statuses such as NOT DISCLOSED /
STALE DATA / PARTIAL COVERAGE are exactly what types are good at); JSX components with escape-by-default;
tests still run natively on the `.ts` sources with `node --test` (no build needed to test the engine).
Cons: an `npm ci` step; esbuild and TypeScript 7 ship **platform-native executables** (optional
dependencies such as `@esbuild/win32-x64`, `@typescript/typescript-win32-x64`) [V], which endpoint
security on a managed laptop could block [I]; supply-chain surface (three packages and their platform
binaries; esbuild has a `postinstall` script [V]).

Mitigations: exact versions and a committed lockfile; `.npmrc` with `ignore-scripts=true` and
`save-exact=true`; `npm ci` (never `npm install`) in CI; lockfile changes reviewed like code; type
checking can run in CI only if `tsc` is blocked locally; `tsc` 6.0.3 as a JavaScript-only fallback.

### 4.3 Option (c): others considered

| Candidate | Verdict | Why |
|---|---|---|
| Vite + a single-file plugin | not recommended | larger dependency tree (Rollup, plugins) for features we do not need (dev server, HMR); same esbuild underneath [I] |
| React | not recommended | Preact gives the same model at a fraction of the size [I] |
| Lit / uhtml / htm (tagged templates, no JSX) | acceptable alternative | escape by default without a JSX step; weaker type checking of templates [I] |
| Svelte / Solid | not recommended | compiler-specific tooling and fewer maintainers familiar with it [I] |
| Deno (single executable: test, bundle, type-check) | not recommended now | a second runtime beside the Node-based refresh pipeline [I] |
| Electron / Tauri desktop app | rejected | needs installation on analyst laptops; breaks the review-link distribution [I] |
| Server-side generation (Python python-pptx/openpyxl, Node service) | rejected | client holdings would leave the browser (rule 2) |
| Playwright for browser tests | optional, needs approval | `playwright-core` 1.64.1 is on npm [V]; browser downloads are large; a zero-dependency Chrome DevTools Protocol driver is possible with Node 24's global `WebSocket` [V present] and the installed Edge/Chrome [U not built] |

### 4.4 Decision matrix [I]

| Criterion | (a) zero-dep | (b) minimal npm | Vite stack |
|---|---|---|---|
| One offline file, `file://`, Pages | yes | yes | yes |
| Bundler risk owned by the project | high | low | low |
| Type checking in CI | no | yes | yes |
| UI escape-by-default and focus-safe re-render | hand-made | Preact | Preact/React |
| Supply-chain surface | none | 3 packages + 2 native binaries | dozens of packages |
| CI complexity | lowest | `npm ci` + cache | `npm ci` + more |
| Fit with "Claude maintains it" | good | good | fair |
| **Overall** | fallback | **recommended** | no |

---

## 5. Excel: what can write a formula-driven, styled workbook?

### 5.1 The embedded SheetJS CE 0.18.5, probed on a synthetic sheet [V]

| Feature | Written? | Evidence in the generated OOXML |
|---|---|---|
| Formulas with cached values | **yes** | `<c r="D4"><f>SUM(D2:D3)</f><v>5250</v></c>` |
| Number formats (`cell.z`) | **yes** | built-in id 4 for `#,##0.00` (the legacy export also relies on custom formats such as `0.00"%"`, which it writes today [D]) |
| Autofilter | **yes** | `<autoFilter ref="A1:D3"/>` plus the `_xlnm._FilterDatabase` defined name |
| Merges | yes (we must not use them in data ranges) | `<mergeCell ref="A7:D7"/>` |
| Column widths | yes | `<col … customWidth="1"/>` |
| **Fonts, fills, borders, alignment (`cell.s`)** | **no** | `styles.xml` has one Calibri 12 font, no solid fill, no border; the style object is dropped |
| **Freeze panes** (`!freeze`, `!views`, `!pane` tried) | **no** | `<sheetView workbookViewId="0" rightToLeft="0"/>` with no `<pane>` |
| `calcPr` (force recalculation on open) | no | `workbook.xml` has no `calcPr` |
| Read back formulas | yes | `{ f: "SUM(D2:D3)", v: 5250 }` |
| Recalculate after an input changes | **no** | after editing B2, D2 still holds the old cached value |

So this build is a **community build, not a style-capable fork**. It remains a good **reader** (many input
formats, formulas and cached values come back).

**Security note [V via public advisories]:** SheetJS CE 0.18.5 is affected by CVE-2023-30533 (prototype
pollution when reading a crafted file, fixed in 0.19.3) and CVE-2024-22363 (regular-expression denial of
service, fixed in 0.20.2). Both concern **reading** untrusted files; export-only use is unaffected. The
npm `xlsx` package stops at 0.18.5 [V]; fixed builds are distributed from the SheetJS CDN, which needs an
approved download. The same version is also used by `buildtools/` [V]. Sources:
[SheetJS advisory CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533),
[GitLab advisory CVE-2024-22363](https://advisories.gitlab.com/npm/xlsx/CVE-2024-22363/),
[CVE-2024-22363 summary](https://cvefeed.io/vuln/detail/CVE-2024-22363).

### 5.2 Writers compared

| Writer | Styles | Freeze panes | Formulas | Defined names, validation | Reads back | Maintenance [V npm] | Verdict |
|---|---|---|---|---|---|---|---|
| SheetJS CE 0.18.5 (embedded) | no | no | yes | names partly | yes | npm copy frozen at 0.18.5 | reader only |
| SheetJS CE 0.20.x (CDN) | no [I] | not known [U] | yes | partly | yes | maintained on CDN | reader (upgrade target) |
| SheetJS Pro | yes | yes | yes | yes | yes | commercial licence | not evaluated (cost) |
| xlsx-js-style 1.2.0 | yes | not known [U] | yes | partly | yes | fork of 0.18.5, last published 2022 | no |
| ExcelJS 4.4.0 | yes | yes | yes | yes | yes, incl. styles | **last stable 2023-10-19**; one prerelease 2024-12-20; Node path pulls archiver, unzipper, tmp, uuid … | **fallback** |
| **In-house SpreadsheetML writer** on the JSZip already inside PptxGenJS | yes | yes | yes | yes | via SheetJS | owned by the project | **recommended, after a spike gate** |

Spike of the in-house writer [V]: a 4,169-byte workbook with two sheets ("Inputs", "Holdings"),
Cambria 9 pt, black header fill with white bold text, 0.5 pt grey (BFBFBF) borders, centred numbers,
custom number formats, an unlocked tan-filled input cell, frozen header row, autofilter, defined names
(`ExpReturn`, `Years`), formulas that use those names, a total row, and
`<calcPr fullCalcOnLoad="1"/>`. The embedded SheetJS read it back with its sheets, defined names,
formulas and cached values intact. **Opening it in Excel was not verified** (section 12): the scratchpad
path is 262 characters and Excel refuses paths over its limit; Excel would not open it over a local
HTTP server either. The spike script is 94 lines (9,844 bytes; several long lines) including the stylesheet
[V, recounted 22 Oct 2026; an earlier draft said about 170 lines]; a production version with a
style registry, data validation, sheet protection of formula cells and a hidden manifest sheet is
estimated at 500 to 800 lines [I].

### 5.3 Re-upload with recalculation: design [I, grounded in the probes]

Neither SheetJS nor ExcelJS calculates formulas [V for SheetJS]. The engine therefore stays the only
calculator:

1. Every generated workbook carries a hidden manifest sheet: schema version, build id, the map of
   editable input cells (by defined name) and a fingerprint of each formula cell.
2. On re-upload: read with SheetJS (`cellFormula: true`); validate structure against the manifest;
   extract supported inputs; report **formula conflicts** (a formula cell replaced by a constant or a
   different formula); recompute with the shared engine; compare the engine's results with Excel's own
   cached values (Excel recalculates when the analyst saves) and report differences; log every change.
3. Arithmetic that Excel does identically (sums, weights, pre/post values, tax arithmetic) is written as
   formulas. Iterative results (XIRR, which the engine solves by bisection) are written as engine values
   labelled as such, with the cash-flow table and an optional Excel `XIRR` check column, because Excel's
   solver can fail or differ on edge cases [I].
4. Never write user text into a formula; strings are written as typed inline strings, so a cell that
   starts with `=` is not executed on open [I].
5. Do not use HyperFormula to evaluate formulas in the browser: it is **GPL-3.0-only** [V npm]. If a
   test-time evaluator is wanted, `@formulajs/formulajs` 4.6.1 (MIT) plus a small parser for the
   handful of functions we generate is enough [I].
6. *Revision of 22 Oct 2026 (Phase 0 review).* Point 5 is adopted as a test-time check: CI evaluates every
   generated formula with a small in-house evaluator restricted to the function subset the writer may emit,
   and compares each result with the engine value; Excel recalculation through COM stays a local
   differential check of that evaluator. Details: `03-architecture.md` §14, `08-regression-test-plan.md` §2.

---

## 6. PowerPoint: PptxGenJS capability check

Probe with the **embedded 3.12.0 build** on synthetic data, then the generated OOXML inspected [V]:

| Requirement | Result |
|---|---|
| Native pie, doughnut, bar charts | `<c:pieChart>`, `<c:doughnutChart>`, `<c:barChart>`; each chart carries its own embedded workbook (3 charts, 3 `ppt/embeddings/*.xlsx`), so "Edit Data" works in PowerPoint |
| Fixed legend/slice colours | every colour of `chartColors` written per data point (`<c:dPt>` with `srgbClr`) |
| Consistent grey pie outlines | `dataBorder: {pt: 1, color: 'BFBFBF'}` gives `<a:ln w="12700">…BFBFBF` on every slice |
| Horizontal legend at the bottom, Cambria 9 pt | `<c:legendPos val="b"/>`, legend `defRPr sz="900"` Cambria |
| No unnecessary gridlines | bar chart with `valGridLine/catGridLine: {style: 'none'}` has no `majorGridlines` |
| Native tables, Cambria 9 pt | `<a:tbl>`, runs `sz="900"`, `typeface="Cambria"` |
| Restrained grey borders | `<a:lnL w="6350">…BFBFBF` (0.5 pt) on each side |
| Header fill (black) and tan cells | `solidFill 000000` / `DBC8B2` in `tcPr` |
| Slide master with lower-right logo | master objects written to the layout, logo as `<p:pic>` |
| Long tables split across slides | `autoPage` turned 80 data rows into 4 slides (24/26/26/8 rows) with the header row repeated |
| Editable title placeholder in the master | **not confirmed**: my probe's title placeholder did not appear in the layout XML; recheck in the spike [U] |

Consequences [I]:

- The overlap matrix can become a native table with per-cell fills (heat colours) instead of a PNG.
- `autoPage` estimates text width with character weights; the legacy overflow defects (KI-078, KI-110,
  KI-122) argue for our own deterministic pagination: a committed Cambria width table measured once in the
  browser (`measureText`), used identically in Node tests and in the browser.
- PptxGenJS 4.0.1 (2025-06-26) is available [V]; its release notes list module-resolution changes but no
  explicit breaking-change section [V web search, inconclusive; the PptxGenJS release notes, linked from the
  `pptxgenjs` package page on npm]. Stay on 3.12.0 for parity; evaluate 4.x
  later behind the deck-structure snapshots.
- Market Update slides are images today (`MARKET_UPDATE_IMAGES`, 6) [D]. If they must become editable,
  slides would have to be copied from the monthly PowerPoint into the generated deck (OOXML slide merge,
  for example with `pptx-automizer` 0.9.4, MIT [V npm], not evaluated) [U]. Owner question.

---

## 7. Deployment

### 7.1 Serving `/next/` beside the legacy page

GitHub Pages serves a directory index, so `_site/next/index.html` is reachable at `…/next/`. Because the
built file is self-contained, no relative asset paths need rewriting [I]. Artifact-based deployment
(`upload-pages-artifact` + `deploy-pages`) does not run Jekyll [I].

Changes to `pages.yml` [I]:

```yaml
on:
  push:
    branches: [main]
    paths: [index.html, app/**, data/**, scripts/build.mjs, package.json, package-lock.json,
            .github/workflows/pages.yml]
  workflow_dispatch:
jobs:
  build:
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 24, cache: npm }
      # legacy gates, unchanged
      - run: node tools/check-invariants.js
      - run: node tools/smoke-review.js
      - run: node tools/run-regression.js
      # new application gates
      - run: npm ci                 # .npmrc: ignore-scripts=true
      - run: npm run typecheck
      - run: npm test
      - run: npm run build          # writes dist/next/index.html deterministically
      - run: npm run check          # invariants on the built file
      - name: Stage both pages
        run: |
          mkdir -p _site/next
          cp index.html _site/index.html
          cp dist/next/index.html _site/next/index.html
      - uses: actions/upload-pages-artifact@v5
        with: { path: _site }
  deploy: # unchanged: no repository code, only pages: write + id-token: write
```

`ci.yml` gets a second job (`next`) with the same new-app steps, so the legacy job's status and the
existing required check stay independent [I].

Coupling risk: one Pages deployment publishes both files, so a failing new-app build would block an
urgent legacy fix. Options: (1) accept it (fix forward); (2) give the new-app steps
`continue-on-error` and stage `next/` only when they pass (the preview then disappears until fixed).
Recommendation: (1) while the preview has no users, (2) once analysts rely on it [I].

### 7.2 Local use

`scripts/serve.mjs` (replacing nothing; the legacy `tools/serve-dashboard.js` stays) binds 127.0.0.1 and
serves `/` (legacy) and `/next/` (built file) only. Double-click of `dist/next/index.html` works the same
way as the legacy file because nothing is loaded at runtime [I; `file://` with a hash-based CSP is U].

### 7.3 Same-origin storage

On Pages both apps share one origin (and every other Pages site of the same account); on `file://`
Chromium-based browsers share one storage origin for local files [I]. The new app must prefix every
storage key (for example `prd.next.v1.`), and, per OD-10, keep family data per family only [D].

### 7.4 Public monthly folder versus `.gitignore`

The current `.gitignore` blocks every office and image format [V]. Tracking `monthly_updates/YYYY-MM/`
needs negation rules limited to that folder plus a pre-commit scan (file types, size, a deny-list of client
markers). GitHub rejects files over 100 MB and warns from 50 MB [I]; decide whether large monthly PDFs or
decks go in plain git or Git LFS (owner question).

---

## 8. Security design

1. **CSP meta**, first element of `<head>` (Pages cannot set headers) [D: KI-008 audit]:
   `default-src 'none'; script-src 'sha256-…' …; style-src 'unsafe-inline'; img-src data: blob:;
   font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none';
   form-action 'none'; base-uri 'none'`. The build computes the script hashes, so `'unsafe-inline'` is
   **not** needed for scripts (the legacy cannot do this because of its inline handlers). `frame-ancestors`
   is ignored in a meta tag [I].
2. **Data as non-executable JSON blocks** (`<script type="application/json">`, `<` escaped as `\u003c`),
   read with `JSON.parse`: no hash needed, nothing executable, faster to parse than a 10 MB object literal [I].
3. **Escape by default**: Preact renders text as text; the invariant check fails the build on
   `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `dangerouslySetInnerHTML`, `eval`,
   `new Function` in `app/src`, and on any network API or URL in the built file except an allow-list of
   navigation links (the MF Screener link, `target="_blank" rel="noopener noreferrer"`).
4. Optional hardening to try in the spike: `require-trusted-types-for 'script'`, which makes any
   string-to-HTML sink throw [U].
5. Supply chain: exact pins, lockfile, `ignore-scripts`, vendor files checked against a SHA-256 manifest
   at every build.
6. SheetJS reader upgrade to 0.20.2 or later early in the build (CVE-2023-30533, CVE-2024-22363), behind
   the date-handling tests (the legacy depends on a +12 h shift for SheetJS `cellDates`, CLAUDE.md [D]; the
   new app should read raw date serials and convert them with one pure, timezone-free function [I]).
7. Secrets for any monthly automation (MF Screener) never in the repository: environment variables
   filled at run time from a per-user DPAPI-protected credential (built into Windows PowerShell), names
   documented, values never [I].

---

## 9. Testing approach

| Layer | Tool | What it proves |
|---|---|---|
| Unit (engine, model, matching, XIRR, tax, look-through, observations) | `node --test` on `.ts` sources (no build) [V works] | known answers, statuses (NOT AVAILABLE, STALE …), unrounded maths |
| Regression | one known-answer test per KI, ported from `tools/regression/` | fixed defects stay fixed; UI-cut harnesses disappear because the logic moves into the engine |
| Parity | new engine vs legacy engine (`tools/engine-host.js`) on the synthetic books | every difference classified (improvement, correction, regression) in a committed ledger; unclassified difference fails |
| PPTX structure | build in Node; unzip with the vendored JSZip; normalise each slide to a JSON inventory (objects, positions, fonts, sizes, colours, chart types, table dimensions) committed as snapshots | slide order, Snapshot mode, legend colours, Cambria 9 pt, no object below the footer band |
| XLSX structure | build in Node; read back with SheetJS; parse sheet XML | sheet order, header rows, number formats, frozen panes, filters, no merges in data ranges, formulas present where expected, no `#REF!`/`#DIV/0!` cached, formula results equal engine values |
| Invariants | `scripts/check-next.mjs` on the built file | no network, CSP present and first, hashes match, vendor hashes, size budget, deterministic build (build twice, same hash) |
| Browser | manual checks via the preview (as today); optional zero-dependency CDP driver or Playwright (approval) | no console errors, no network requests, uploads, exports |
| Office acceptance (local, per release) | PowerShell COM scripts for Excel and PowerPoint | file opens without repair, recalculates, slide PNGs for visual review |

Practical notes [V]:

- A reusable OOXML inspector needs only the JSZip copy inside the vendored PptxGenJS bundle (used for
  every probe in this evaluation).
- Office COM cannot open files whose full path exceeds Excel's limit: the session scratchpad path (262
  characters) was refused. Office acceptance must write to a short local path (D-018 already
  notes the 218-character limit for Excel) [V/D].
- Run unit tests under both `TZ=Asia/Kolkata` and `TZ=UTC`, as `smoke-review` does today [D].
- Synthetic fixtures only (generator ported from `tools/make-sample-base.js`); anonymised real files stay
  outside the repository.

---

## 10. Proposed directory layout for this stack

The legacy files stay exactly where they are (Pages, CI and the patch tooling depend on their paths).

```
index.html                    legacy app (unchanged; served at /)
tools/  buildtools/           legacy tooling (unchanged until retirement)

app/                          the new application (served at /next/)
  index.template.html         page shell: CSP placeholder, mount point, data-block slots
  tsconfig.json               strict, erasableSyntaxOnly, noEmit, jsx: react-jsx, jsxImportSource: preact
  src/
    model/                    types of the shared model, identifiers, data-status values, schema versions
    ingest/                   base file, IRR, monitors, SOA, bonds parsers (SheetJS); validation records
    engine/                   pure calculations: matching, valuation, allocation, look-through, overlap,
                              performance, XIRR, taxation, rebalancing scenario (no DOM, no globals)
    observations/             rule bank: inputs, triggers, evidence, narrative templates, audit fields
    exports/
      pptx/                   masters, theme, slide components, pagination (Cambria width table)
      xlsx/                   workbook spec, SpreadsheetML writer, styles registry, re-upload reader
    ui/                       Preact components; nine sections; state store (no calculations)
    services/                 file input, blob download, namespaced storage, audit log
    config/                   palette, fonts, category orders, benchmark maps, slide manifest
    main.tsx                  entry point
  vendor/                     pptxgenjs-3.12.0.bundle.js, xlsx-0.18.5.full.js (then 0.20.x),
                              chart-4.4.0.umd.js, chartjs-plugin-datalabels-2.2.0.js,
                              MANIFEST.json (version, source, SHA-256, licence)

data/                         reference data as JSON, one file per block (reviewable monthly diffs)
monthly_updates/YYYY-MM/      approved non-client inputs (tracked; .gitignore exception)
product_bank/                 products/, performance/, source_register/

scripts/
  build.mjs                   esbuild + inlining + CSP hashes + build manifest -> dist/next/index.html
  check-next.mjs              invariants on the built file
  serve.mjs                   127.0.0.1: legacy at /, new at /next/
  vendor-extract.mjs          extracts the exact libraries from legacy index.html and records hashes
  monthly-update/             successor of buildtools/ (writes data/; a legacy adapter splices the same
                              JSON into index.html until retirement)
  office/                     PowerShell COM acceptance scripts (local only)

tests/
  unit/  integration/  regression/  parity/  exports/  fixtures/ (synthetic only)  helpers/ (ooxml.ts)

dist/                         build output (git-ignored; built in CI)
package.json  package-lock.json  .npmrc
```

Mapping to the brief's suggestion: `components` and `pages` become `ui/`; `analytics` becomes `engine/`;
`data` splits into `model/` (types) and the root `data/` (values); `configuration` is `config/`; the rest
keep their names.

---

## 11. Build and test commands

New application (PowerShell or Bash, repository root):

| Command | Does |
|---|---|
| `npm ci` | installs exactly the lockfile (scripts disabled by `.npmrc`) |
| `npm run typecheck` | `tsc --noEmit -p app` |
| `npm test` | `node scripts/test.mjs`: sets `TZ=Asia/Kolkata`, runs `node --test` over `tests/**/*.test.ts` |
| `npm run test:utc` | the same under `TZ=UTC` |
| `npm run build` | `node scripts/build.mjs` -> `dist/next/index.html` and `dist/next/build-manifest.json` |
| `npm run check` | `node scripts/check-next.mjs dist/next/index.html` |
| `npm run parity` | new engine versus legacy engine on the synthetic books, against the parity ledger |
| `npm run serve` | `node scripts/serve.mjs` -> `http://127.0.0.1:8100/` (legacy) and `/next/` |
| `npm run accept:office` | local only: open the latest exports in Excel and PowerPoint via COM |

Legacy commands are unchanged (`node tools/check-invariants.js`, `smoke-review.js`, `test-ai-analyst.js`,
`run-regression.js`). Engine code that loads the legacy blocks still runs from script files, never
`node -e` (KI-011) [D].

Build script outline (`scripts/build.mjs`) [I]:

1. Verify every file in `app/vendor/` against `MANIFEST.json` (SHA-256).
2. esbuild: entry `app/src/main.tsx`, `bundle: true`, `format: 'iife'`, `platform: 'browser'`,
   target ES2022, JSX automatic with Preact, `write: false`, readable output (the page is data-dominated,
   minifying the code saves little and costs auditability).
3. Read `data/*.json`; minify; escape `<`; embed as `application/json` blocks; images as data URIs.
4. Assemble the template; refuse any inline script containing `</script`; compute SHA-256 of each
   executable inline script; write the CSP meta.
5. Write a build manifest (commit, data dates, library versions and hashes) that the app shows in an
   "About and audit" panel.
6. Deterministic output: no timestamps except the commit date (`SOURCE_DATE_EPOCH`).

Expected size [I]: about 1.6 MB of libraries (measured sizes above) plus about 14 MB of data and images
(REFDATA 10.1 M chars, logos and slides 3.2 M, ER table 1.0 M [D/V block sizes]), similar to today.

---

## 12. Risks

| # | Risk | Likelihood / impact [I] | Mitigation |
|---|---|---|---|
| R1 | In-house XLSX writer produces a file Excel "repairs" | medium / high | spike gate: open in Excel via COM with no repair, styles and panes visible, recalculation correct; ExcelJS 4.4.0 as fallback |
| R2 | Native binaries (esbuild, TypeScript 7) blocked on a managed laptop | low / medium | type-check in CI only; TypeScript 6.0.3 (JavaScript) fallback; option (a) bundler as last resort |
| R3 | npm supply chain | low / high | three packages, exact pins, lockfile review, `ignore-scripts`, runtime libraries vendored with hashes |
| R4 | SheetJS upgrade changes date or number parsing | medium / high | read raw serials; date known-answer tests in two timezones; parity suite before switching |
| R5 | Two apps to maintain during the parallel run (legacy patches, two refresh outputs) | high / medium | one data source (`data/*.json`) with a legacy splice adapter; freeze legacy features, fix only defects |
| R6 | Excel formulas and engine drift apart (same rule implemented twice) | medium / high | export tests compare every formula's result with the engine value; XIRR kept as engine values |
| R7 | PowerPoint layout overflow (legacy KI-078, KI-110) | medium / medium | deterministic pagination from a width table; slide inventory snapshots; PNG review per release |
| R8 | Pages deployment couples both apps | medium / medium | section 7.1 options |
| R9 | Storage key collisions between apps on one origin | medium / low | namespaced keys, per-family state only |
| R10 | `file://` behaviour with a hash-based CSP untested | low / medium | test double-click in Edge and Chrome in the first spike |
| R11 | Public monthly folder leaks a client file | low / high | folder-scoped `.gitignore` exception, pre-commit scanner, review of every staged binary |
| R12 | Preact 11 and TypeScript 7 are recent majors | low / low | pin Preact 10.29.x; upgrade deliberately with tests |
| R13 | Licensing | low / medium | all chosen packages MIT or Apache-2.0 [V npm]; JSZip is dual MIT/GPL (use under MIT) [I]; avoid HyperFormula (GPL-3.0-only) |

### First spike (gates before committing to the stack) [I]

1. `scripts/vendor-extract.mjs` + manifest; build a "hello" page with Preact, one vendored library and one
   JSON data block; open it from Pages-like local server and by double-click with the CSP active.
2. In-house writer: workbook opens in Excel with no repair; frozen panes, filters, styles visible;
   change an input, recalculation correct; save in Excel and re-upload through SheetJS with the manifest.
3. PptxGenJS: master with an editable title placeholder and lower-right logo; native overlap table;
   open in PowerPoint and export PNGs.
4. `npm ci` on this laptop and in CI; esbuild and `tsc` run under the laptop's security policy.

---

## 13. What could not be verified, and why

- **Excel opening the in-house workbook**: Excel refuses the session scratchpad path (262 characters, over
  its limit); writing to a shorter path was outside this task's write permissions; Excel opened over a local
  HTTP server issued only `OPTIONS` requests and failed. Styles, panes and recalculation in Excel are
  therefore unverified (structure verified with SheetJS read-back).
- **PowerPoint rendering of the probe decks**: not opened in PowerPoint (same path limit; also avoided
  interfering with other sessions using PowerPoint). XML structure verified only.
- **Editable title placeholder in a PptxGenJS master**: not emitted in my probe; probably a probe error.
- **`npm ci` / esbuild / TypeScript behaviour on this laptop**: nothing was installed (task rule).
- **Freeze panes in SheetJS CE 0.20.x and xlsx-js-style**: not tested (no downloads).
- **CSP with script hashes under `file://`, Trusted Types, and a CDP browser driver**: not built.
- **ExcelJS browser bundle size and behaviour under the CSP**: not downloaded.
- **PptxGenJS 4.x changes**: release notes inconclusive.
- **SheetJS advisories** were confirmed through a web search of public advisory pages, not by `npm audit`
  (that would require an install-like lockfile step).

---

## 14. Questions for the owner

1. May the new application use npm for build tooling (esbuild, TypeScript) and one small runtime package
   (Preact), pinned with a lockfile? Today's rule "no npm install" describes the legacy file. If not,
   option (a) applies.
2. Is `/next/` on the public Pages site acceptable for the preview (with a visible "preview" banner), and
   should the legacy page link to it?
3. May the SheetJS reader be upgraded to 0.20.2 or later (security fixes)? It needs a one-time download
   from the SheetJS CDN, recorded with its hash.
4. Market Update slides: acceptable as full-slide images (as today), or must they be native, editable
   slides copied from the monthly PowerPoint (a larger piece of work)?
5. Which workbook cells may analysts edit and re-upload (expected returns, rebalancing percentages,
   expense-ratio overrides, observation text, others)? This fixes the re-upload schema.
6. Is it acceptable that XIRR figures in the workbook are engine-computed values (with an Excel `XIRR`
   check column) while all other arithmetic is live formulas?
7. Monthly binaries in the public repository: plain git with a size limit, or Git LFS (bandwidth quota)?
8. Browser automation: install Playwright (large browser download) or keep manual preview checks plus a
   zero-dependency driver?
