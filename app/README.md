# app/: the new application (CR-0006)

The new Portfolio Review application is built here, beside the legacy `index.html` at the repository root. The legacy
page stays the review link until the new application reaches the parity defined in
[05-feature-parity-matrix.md](../docs/new-build/05-feature-parity-matrix.md).

**No application code exists yet (22 Oct 2026).** The toolchain, the page shell with the nine sections and the build
arrive in milestone M1.2; the shared model and the base-file ingest in M1.3
([07-implementation-roadmap.md](../docs/new-build/07-implementation-roadmap.md)).

## What will be here

```
app/
  index.template.html   the page shell: CSP placeholder, mount point, data-block slots
  tsconfig.json         strict, erasable TypeScript syntax only, no emit
  vendor/               libraries taken byte for byte from the legacy page, with MANIFEST.json (version, source,
                        SHA-256, licence)
  assets/               logos and the cover photo
  src/
    model/              types only: identifiers, statuses, Value<T>, sources, holdings, review, scenario, audit
    ingest/             parsers shared by the browser and the monthly update engine (by header name)
    engine/             the only place numbers are calculated: pure functions, no DOM, no globals
    observations/       rule bank, thresholds, composition, lint, Review Snapshot
    views/              view-models: selection, order, labels, units, footnotes (no arithmetic)
    exports/pptx/       PowerPoint components, theme, pagination, manifest
    exports/xlsx/       the workbook writer, sheets and formula builder
    ui/                 Preact sections and inputs, rendering view-models
    services/           files in and out, browser storage, the MF Screener pack store, audit log
    config/             tokens, category orders, slide manifest, the MF Screener link
```

How these parts fit together is in [ARCHITECTURE.md](../docs/ARCHITECTURE.md); what the application must do is in
[PRD.md](../docs/PRD.md); every field, metric and status is defined in
[DATA_DICTIONARY.md](../docs/DATA_DICTIONARY.md).

## Rules for code here

- **One engine.** Only `src/engine/` computes; the screen, the deck and the workbook render the same values.
- **Never invent a number.** A missing value is a status, shown as a dash ("—") alone in its cell with a footnote
  (D-029); presentation sentences never contain an en or em dash.
- **No network at run time.** The built page is one offline file. The single exception is the "MF Screener" navigation
  link, which opens in a new tab (D-027).
- **No client data in the repository.** Tests use synthetic fixtures only; the MF Screener data pack is never
  embedded or committed (D-026).
- The legacy rules for `index.html` (patch scripts only, five scopes) do not apply here; this folder gets its own build
  checks with its code in M1.2.

## How it is published

From M1.2 the build writes `dist/next/index.html` (git-ignored) and GitHub Pages serves it at `/next/` with a
"Preview, not for client use" banner; nothing exported from the preview is used for a client before switch-over
(D-024).
