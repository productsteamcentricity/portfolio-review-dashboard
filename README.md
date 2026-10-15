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
workflow publishes `index.html` only; never use "Deploy from a branch", which would publish
the whole repository. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).)

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

Start with [docs/HANDOVER.md](docs/HANDOVER.md) and [CLAUDE.md](CLAUDE.md). Before and after any
change:

    node tools/check-invariants.js    # structure, no network calls, engine, reference data
    node tools/smoke-review.js        # end-to-end check on a synthetic portfolio

Never commit client files or vendor workbooks. `index.html` is changed only through anchored
patch scripts, never by hand.

Built for the Centricity WealthTech Products team.
