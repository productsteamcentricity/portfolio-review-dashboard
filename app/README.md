# app/: the new application (CR-0006)

The new Portfolio Review application is built here, beside the legacy `index.html` at the repository root. The legacy
page stays the review link until the new application reaches the parity defined in
[05-feature-parity-matrix.md](../docs/new-build/05-feature-parity-matrix.md).

**What exists (M1.2, M1.3):** the toolchain, the page shell with the nine sections as empty states and the
build. `scripts/build.mjs` bundles these sources into one offline HTML file, `app/dist/index.html` (git-ignored), that
Pages publishes at `/next/` with a "Preview, not for client use" banner (D-024). M1.3 added the shared model
(`src/model/`), the workbook and base-file readers (`src/ingest/`), the engine helpers they use (`src/engine/`) and
`src/views/format.ts`; no page uses them yet. M1.4 builds the first vertical slice on them
([07-implementation-roadmap.md](../docs/new-build/07-implementation-roadmap.md)).

```
npm ci              # the pinned tooling, from the lockfile
npm run typecheck   # TypeScript, no emit
npm run build       # app/dist/index.html
npm run check       # the built page's invariants (CSP, no network, one allowed link, banner)
npm test            # every test, .mjs and .ts (run it under TZ=UTC too)
npm run serve       # http://127.0.0.1:8100/next/
```

## What is here, and what will be

```
app/
  index.template.html   the page shell: CSP placeholder, mount point, data-block slots (M1.2)
  tsconfig.json         strict, erasable TypeScript syntax only, no emit (M1.2)
  vendor/               libraries taken byte for byte from the legacy page, with MANIFEST.json (version, source,
                        SHA-256, licence); the manifest exists from M1.2, the shell uses no library yet
  assets/               logos and the cover photo
  dist/                 the build output, git-ignored (M1.2)
  src/
    main.tsx            the entry point (M1.2)
    types/              declarations for the vendor:<name> imports (M1.2)
    model/              types only: identifiers, statuses, Value<T>, sources, holdings, review, scenario, audit
    ingest/             parsers shared by the browser and the monthly update engine (by header name)
    engine/             the only place numbers are calculated: pure functions, no DOM, no globals
    observations/       rule bank, thresholds, composition, lint, Review Snapshot
    views/              view-models: selection, order, labels, units, footnotes (no arithmetic)
    exports/pptx/       PowerPoint components, theme, pagination, manifest
    exports/xlsx/       the workbook writer, sheets and formula builder
    ui/                 Preact sections and inputs, rendering view-models (M1.2: App.tsx and shell.css)
    services/           files in and out, browser storage, the MF Screener pack store, audit log
    config/             tokens, category orders, slide manifest, the MF Screener link (M1.2: links.json,
                        sections.json, tokens.json)
```

How these parts fit together is in [ARCHITECTURE.md](../docs/ARCHITECTURE.md) (the Phase 0 record is
[03-architecture.md](../docs/new-build/03-architecture.md)); what the application must do is in
[PRD.md](../docs/PRD.md); every field, metric and status is defined in
[DATA_DICTIONARY.md](../docs/DATA_DICTIONARY.md). Toolchain, build design, invariants and the M1.2 spike results:
[toolchain.md](../docs/new-build/toolchain.md).

## Rules for code here

- **One engine.** Only `src/engine/` computes; the screen, the deck and the workbook render the same values.
- **Never invent a number.** A missing value is a status, shown as a dash ("—") alone in its cell with a footnote
  (D-029; `CLAUDE.md` rule 3), never a zero; presentation sentences never contain an en or em dash.
- **No network at run time.** The built page is one offline file. The single exception is the "MF Screener" navigation
  link, which opens in a new tab (D-027); it lives only in `src/config/links.json` and the build writes it into the
  page.
- **Checked by `scripts/validation/check-next.mjs`** (architecture section 17): no network API, no remote URL, no
  `innerHTML`, `eval` or similar, no inline style attribute, no client data in browser storage.
- **Vendored libraries** only through `import X from 'vendor:<name>'`, each with its SHA-256 in
  `vendor/MANIFEST.json`; the build checks the hash and inlines the file only when a module imports it.
- **No client data in the repository.** Tests use synthetic fixtures only; the MF Screener data pack is never
  embedded or committed (D-026).
- The legacy rules for `index.html` (patch scripts only, five scopes) do not apply here; the rules above are this
  folder's own (`CLAUDE.md`, "New build").

## How it is published

The build writes `app/dist/index.html` (git-ignored) and GitHub Pages serves it at `/next/` with a
"Preview, not for client use" banner; nothing exported from the preview is used for a client before switch-over
(D-024). If the preview cannot be installed, built or checked for a commit, Pages publishes a short static notice at
`/next/` instead and the legacy page still deploys (D-034, [DEPLOYMENT.md](../docs/DEPLOYMENT.md)).
