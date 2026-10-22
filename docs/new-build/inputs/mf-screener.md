# MF Screener integration (Phase 0 audit, conclusions)

The Centricity MF Screener is an invitation-only internal tool. This file keeps only the conclusions needed to
build the integration. The technical detail of the Screener's access control and its internal maintenance notes
are deliberately left out of the public repository.

## 1. Conclusions

| Question | Conclusion |
|---|---|
| Access | Sign-in required; every page and data file is behind the Screener's own login. |
| Embedding (iframe) | Not possible: the Screener refuses to be framed by another site. Link out only. |
| Data access | No public data. The data comes as a monthly **data pack** that the Screener owner exports (contract `pr-datapack-v1`). The owner uploads it into the dashboard each cycle (D-026). |
| Credentials | Claude never types, stores or relays the Screener password. Nothing in the dashboard or its build uses a credential for the Screener. |
| Publication | Screener scores, ranks and the pack itself never go into a public page or the repository (D-026). |

## 2. Navigation link (new tab)

**Placement:** a permanent item "MF Screener" in the app's top navigation bar, after the nine section tabs,
with an external-link icon. It is visible before any upload and does not depend on an import or a model.

**Markup:**

```html
<a class="nav-external" href="https://centricity-mf-dashboard.pages.dev/"
   target="_blank" rel="noopener noreferrer"
   aria-label="MF Screener (opens in a new tab; sign-in required)"
   title="Opens the Centricity MF Screener in a new tab. Sign-in required.">MF Screener</a>
```

**Rules:**

1. **New tab only.** The current tab is never navigated, so uploads, analyst inputs and the open section stay
   as they are.
2. **Nothing leaves the dashboard.** The URL is a constant with no query string or fragment: no fund names,
   AMFI codes, client identifiers or values. `noreferrer` stops the Portfolio Review address being sent;
   `noopener` stops the new tab reaching back into the dashboard window.
3. **No background traffic.** No `preconnect`, `prefetch`, favicon fetch or availability check.
4. **One config value.** The URL lives in one configuration entry, not in components.
5. **Compliance check, narrowed rather than dropped.** The new app's no-network check allows exactly this one
   URL, only inside an `<a>` with `target="_blank"` and `rel="noopener noreferrer"`. Any other remote URL, or
   this URL anywhere else (`fetch`, `src`, `iframe`, CSS `url()`), still fails (D-027).
6. **Exports.** No link inside the PowerPoint. The Excel "Read Me and Controls" sheet names the Screener as a
   source with its cycle date, as plain text.
7. **Legacy app.** The link is for the new app only.
8. **When it fails.** If the network or the login blocks access, that happens in the new tab only.

## 3. "Portfolio Quants" metrics and their sources

Reference deck A's analytics slides (slide 5 pre-rebalancing, slide 7 post-rebalancing) show:
- **Headline tiles:** funds held; weighted Centricity Score (with the share of value that is scored); weighted
  3Y return; weighted 3Y Sharpe; weighted 3Y alpha; equity overlap with Nifty 500.
- **Category table:** Category, Funds, ₹ Cr, % Total, Score, 1Y, 3Y, 5Y, Beta, SD, Alpha, Sortino, Sharpe,
  Down Cap., 3Y Roll.
- **Fund table:** Fund, % Total, Score, 3Y.

| Deck metric | Source in the new app | Note |
|---|---|---|
| Score, rank, status | Screener pack `funds.json` (score, rank in category, status) | Passive funds are not scored; unscored is not a negative signal. Category rank only. |
| 1Y, 3Y, 5Y returns | MF Monitor (or the pack's returns) under D-023 point 3's source order | Weighted over funds that have the return; coverage footnoted. |
| Beta, SD, Alpha, Sortino, Sharpe, Down Cap. | Screener pack `funds.json` 3Y risk block | Hybrid and debt rows are covered by the pack where the Screener computes them. |
| 3Y Roll | Screener pack rolling summary | Unit normalised at ingest. |
| Equity overlap with Nifty 500 | Pack `benchmarks.json` constituents, where supplied | Otherwise not available, shown as "—" with a footnote. |
| AUM | MF Monitor | MF Monitor stays primary. |

Dates differ: Screener cycles fall on the 15th, the MF Monitor on month-end. Every metric group carries its own
source-and-date note, as deck A already does.

## 4. Fallback when no valid pack is loaded

| Metric group | Fallback | Shown when absent |
|---|---|---|
| Returns, AUM, market-cap mix, expense ratio, manager | MF Monitor, as today | — |
| Beta, SD, Alpha, Sortino, Sharpe, Down Cap., 3Y Roll | In-house risk ratios where available, labelled with their date | "—" with a footnote |
| Score, rank, status | none in a public page | "Load the MF Screener data pack" in the app; "—" in exports |
| Equity overlap with Nifty 500 | none | "—" with a footnote |

The MF Monitor cannot stand in for the Screener on its own: it carries no risk ratios, no score or rank and no
AMFI code.

## 5. Ingest checks (summary)

The pack's own contract and validation are in the prompt sent to the Screener owner (`pr-datapack-v1`). On the
dashboard side:
- columns and fields resolved by name and asserted;
- AMFI codes unique;
- the cycle date read from the manifest, never the file name;
- score ranges and `rank ≤ rank_of` checked;
- units normalised;
- a coverage report;
- the pack's fingerprint recorded, so loading the same cycle twice changes nothing.

Joins go by AMFI code and ISIN; names are only for display.
