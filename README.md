# Centricity Portfolio Review Dashboard

A self-contained, offline browser tool for building HNI / UHNI / Family-Office portfolio
reviews. Upload a client holdings file and the dashboard produces asset allocation, AMC
concentration, holdings, fund analytics, an overlap matrix, performance, and
transaction-based IRR — all exportable to PowerPoint and Excel in the Centricity house style.

The entire app is a single `index.html` (all libraries embedded — Chart.js, SheetJS,
PptxGenJS). It runs fully offline; use Chrome or Edge (the browsers it is tested in).

## Live link

The dashboard is published at:

    https://productsteamcentricity.github.io/portfolio-review-dashboard/

(Settings → Pages → Build and deployment → Source: **GitHub Actions**. The `pages.yml`
workflow publishes `index.html` and, at `/next/`, the preview of the new application (D-024), nothing else;
never use "Deploy from a branch", which would publish the whole repository. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).)

## Two applications during the parallel run

The dashboard above (`index.html`) is the review link. A new Portfolio Review application (CR-0006) is being built
beside it, in `app/`, and previewed at

    https://productsteamcentricity.github.io/portfolio-review-dashboard/next/

with a "Preview, not for client use" banner: nothing from the preview goes to a client until the new application
reaches feature parity and replaces the dashboard (D-024). If the preview cannot be built for a commit, that address
shows a short notice instead and the dashboard is published as usual (D-034).

To run both on your machine (Node 24):

    npm ci           # the new application's pinned build tooling; the dashboard needs none
    npm run build    # app/dist/index.html, one offline file (double-click it to open it)
    npm run serve    # http://127.0.0.1:8100/ (the dashboard) and http://127.0.0.1:8100/next/ (the new application)

The dashboard alone needs no install: open `index.html`, or run `node tools/serve-dashboard.js`
(http://127.0.0.1:8099). Details: [docs/new-build/toolchain.md](docs/new-build/toolchain.md).

## How to use

1. Open the dashboard (the live link above, or download `index.html` and open it locally).
2. Click **Choose base file** and upload the client holdings workbook (`.xlsx`).
   Use the in-app **Download base-file template** button to get a workbook with the
   correct column headings, then paste your data under them.
3. Pick the **Portfolio date** ("As on"; defaults to today, IST).
4. Optionally upload fresher reference data in the Reference data panel:
   Daily MF Monitor, SIF Monitor, Direct MF Monitor, IRR Transactions, PMS / Bonds analytics.
5. Review the tabs and download the **PPTX** / **XLSX** from the toolbar.

> **Loading the next client's base file starts a clean review.** The previous family's IRR,
> PMS / AIF and bonds uploads, rebalancing plan and selections are cleared, and the status line
> says what was cleared, so upload the new family's files after its base file
> (docs/KNOWN_ISSUES.md, KI-001).

## Features

- Asset and liquidity allocation; per-AMC concentration with the 20% house cap flagged
- Per-client holdings sheets with XIRR vs benchmark
- MF / PMS / AIF / SIF performance, with a Regular / Direct plan toggle
- Fund analytics (market-cap, sector, credit-rating) and a fund overlap matrix with
  Asset / Product / Category quick-select
- Transaction-based Fund IRR and Benchmark IRR at Portfolio / Client / Asset / Product /
  Instrument levels (XIRR, actual/365), with each fund's benchmark index shown
- One-click PowerPoint and Excel export

## Data and privacy

- All processing happens in the browser. Uploaded client data never leaves the machine
  and is never sent to any server.
- Reference fund data is embedded for convenience and can be refreshed via the upload panel.

## For maintainers

Start with [docs/HANDOVER.md](docs/HANDOVER.md) and [CLAUDE.md](CLAUDE.md). Every document is
listed in [docs/README.md](docs/README.md). Before and after any change:

    node tools/check-invariants.js    # structure, no network calls, engine, reference data
    node tools/smoke-review.js        # end-to-end check on a synthetic portfolio
    node tools/test-ai-analyst.js     # AI Analyst acceptance rules

| Folder | Holds |
|---|---|
| `tools/` | checks, the local preview server (`open-dashboard.cmd`), and `patches/`, the only way `index.html` changes |
| `buildtools/` | the monthly data-refresh pipeline ([docs/MONTHLY_REFRESH.md](docs/MONTHLY_REFRESH.md)) |
| `docs/` | how it works, decisions, known issues, change requests, refresh logs, the previous owner's handover |
| `app/`, `data/`, `product_bank/`, `monthly_updates/` | the new application (CR-0006), built beside `index.html`; each folder has a README; `app/` holds the page shell from milestone M1.2 and the shared model and base-file reader from M1.3, and `data/refdata/` the reference data extracted from `index.html` (M1.3) ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)) |
| `scripts/`, `tests/` | the new build's tooling and tests: the safety checks and `check-next.mjs` in `scripts/validation/`, the build, the local server and the reference-data extractor in `scripts/`; the new application's unit and parity tests in `tests/` ([docs/new-build/safety-tooling.md](docs/new-build/safety-tooling.md), [docs/new-build/toolchain.md](docs/new-build/toolchain.md)) |
| `package.json`, `package-lock.json`, `.npmrc` | the new application's pinned build tooling, installed with `npm ci` (D-025); the legacy page needs none of it |

Never commit client files or vendor workbooks. `index.html` is changed only through anchored
patch scripts or the refresh pipeline, never by hand.

Built for the Centricity WealthTech Products team.
