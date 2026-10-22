# Reference deck A: slide-by-slide specification and design system

Phase 0 deliverable for the new Portfolio Review build. Reference deck A is a 41-slide family portfolio review
with unit-based rebalancing, the primary design and structure reference for the new deck. This document describes
it generically: components, purpose, layout, data fields, implied calculations, table and chart structure and
styling tokens. It holds no client names, portfolio values, holdings amounts or distributor names; those stay in
the private notes. Analytical and design reference only: none of its client data or wording may be reused.

Legend used throughout:
- **[V]** verified directly (rendered PNG of every slide, PPTX XML parsed shape by shape, or exporter source read).
- **[I]** inference from the evidence; to be confirmed.
- Mapping to the existing dashboard (`08_exporters.js` slide groups, `docs/ARCHITECTURE.md` §8):
  **EQ** exists-equivalent · **DIFF** exists-different · **NEW** not produced by the existing exporter.

Method [V]: every slide was rendered with PowerPoint (1600 x 900 PNG) and viewed; the PPTX was unzipped and parsed
with a small dependency-free inspector (shapes, geometry, fonts, sizes, fills, line colours, table cell borders,
merges, chart types, series colours, legends, labels, gridlines, embedded pictures). Coordinates below are in
points on the 960 x 540 pt canvas (13.333 x 7.5 in, 72 pt = 1 in), origin top-left.

---

## 1. Deck-level facts

| Item | Finding |
|---|---|
| Size and aspect [V] | 16:9 wide, 960 x 540 pt (PptxGenJS `LAYOUT_WIDE`, 13.333 x 7.5 in). |
| Provenance [V] | `docProps/core.xml` creator is the string the dashboard exporter sets (`pptx.author`, `08_exporters.js:57`), and content-slide shapes carry PptxGenJS names ("Shape 0", "Text 2", "Image 0"). The deck began as a dashboard export and was then edited and extended in PowerPoint (slides 4-13 carry hand-made shape names such as "Rectangle 9", "TextBox 13"). |
| Masters and layouts [V] | 3 masters, 1 layout each. Content slides use the PptxGenJS "DEFAULT" layout (master 1); cover and title slide use master 3 "Title Slide"; the disclaimer uses master 2 "Title Slide" (pattern-filled background, grey rule). |
| Theme [V] | All four theme parts are stock Office themes (Calibri / Aptos fonts, Office accent colours). No brand colours or Cambria in the theme: every colour and the Cambria face are set at run or shape level. Text an analyst adds by hand therefore defaults to Calibri and Office blue. |
| Fonts [V] | Cambria on every text run (3,229 runs). Chart XML also references Arial in default text properties of the pie and doughnut charts. |
| Font sizes in use [V] | 9 pt (1,033 runs), 7.5 (844), 10 (567), 8.5 (230), 8 (191), 6.5 (176), 11 (59), 22 (27, titles), 7 (23), 14, 13.5, 15, 9.5, 12.5, 28, 54, 20.5, 8.19 (shrunk text, non-standard). |
| Native vs picture [V] | 13 native PowerPoint charts (each with an embedded workbook, so editable), 29 native tables. 13 slides are, or are dominated by, raster pictures: cover, 4 section dividers, 5 market-update pages, thank-you (all full-slide), plus 2 overlap matrices (full-width rasters). |
| Hidden slides, notes [V] | None hidden; speaker notes empty. |
| File size [V] | About 5.6 MB, mostly the cover photo and market-update JPEGs. |
| Page numbers [V] | None on content slides. Page numbers appear only inside market-update images (baked in) and on the disclaimer (placeholder). |
| Earlier version [V] | A previous 40-slide version of the same review has the same order without the unit-based redemption plan slide (slide 11 here). From slide 11 on, its numbering is this deck's minus one. |

---

## 2. Design system extracted

### 2.1 Canvas, margins, grid [V]
- Content area: x 13 to 947 pt (0.18 to 13.15 in), y about 70 to 495 pt (between the header rule and the footnote).
- Two-column grids recur: left 13 to 488 pt and right 504 to 960 pt (asset allocation); left 13 to 466 pt and
  right 486 to 947 pt (analytics slides); 295 + 625 pt (snapshot).
- Inconsistency: hand-edited tables start anywhere from x 4.1 to 13 pt (holdings 4.1 to 5.4, performance 4.8 to
  6.1, rebalancing 9.5) and run past the right margin to about 954 pt. The exporter's margin is 0.18 in (13 pt).

### 2.2 Colour palette (hex, verified in XML)

| Token | Hex | Where used |
|---|---|---|
| ink / black | `#000000` | header bar, footer band, table header row, grand-total row, Exit action cell |
| gold (primary accent) | `#BD9568` | header rule, KPI top strip, section bands, label blocks, bar and column series, "INSIGHT" label, Debt series |
| gold ring (title art) | `#C69958` | donut ring on title slide and dividers (a second, slightly different gold) |
| tan | `#DBC8B2` | sleeve / category subtotal rows, Equity series, top-up shading (post quants), "after" header band |
| grey 75 | `#BFBFBF` | asset-level subtotal rows, Hybrid series |
| grey 85 (border) | `#D9D9D9` | default table borders, KPI tile outlines, product-level subtotal rows |
| grey band | `#8C8C8C` | "Before rebalancing" header band and "position before" band |
| warm border | `#E8E0D5` | rebalancing table inner borders (exporter: rebalancing and MF analysis tables) |
| cream 1 | `#FCFAF7` | KPI tile fill, evidence cards, zebra rows |
| cream 2 | `#FBF7F1` | chart panels on the asset allocation slide |
| sand | `#F4EEE6` | insight boxes, verdict banner, metric panels, zebra rows in top-holdings tables |
| stone 1 / 2 | `#F2F0EC` / `#F3F2F0` | zebra rows on redemption, transition, tax and unit-plan tables |
| honey | `#FFF8E1` | benchmark (TRI) rows on performance sheets |
| brown text | `#5C3E17` | benchmark row text, light overlap-cell text |
| negative red | `#931621` | negative numbers, negative headline metric, AMC cap breach |
| exit pink | `#FCE8E8` | rows proposed for exit (pre quants fund list; exporter holding sheet) |
| new green | `#E6F4E6` | new additions (post quants fund list, proposed-funds sheet) |
| text greys | `#222222` body, `#333333`, `#555555` KPI label, `#6B6B6B` footnote, `#777777` sub-label | |
| pie outline | `#F9F9F9` 0.75 pt | slice borders on pies and doughnut (near white) |
| gridline | `#888888` 1 pt (allocation charts), `#E6E6E6` (tax timeline) | |
| doughnut ramp | `#8C6B43`, `#BD9568`, `#C9A876`, `#DCC4A5`, `#BFBFBF`, `#D9D9D9`, `#E5DACB` | credit-rating categories in order |
| overlap heatmap | navy `#233140` background (exporter canvas constant); cells `#F2E9DC` (<15%), `#DCC4A5` (15-30%), `#C49A66` (30-50%), `#A87B45` (>50%), diagonal `#B98C5A` | raster only |
| exporter extras (not in deck A) | green `#2E7D32` (above universe average), commodity `#808080`, top-up `#FDE7EF` | |

### 2.3 Typography scale (Cambria throughout) [V]

| Role | Size / weight / colour |
|---|---|
| Slide title | 22 pt bold, white, upper case, left, vertically centred in the header bar (one slide: 20.5 pt) |
| Title slide | 54 pt bold black (family line), 28 pt bold (report name and date), centred |
| Section-divider title | baked into the picture (serif bold, about 40 pt equivalent) |
| Disclaimer title | 28 pt bold white (master 2 style) |
| Panel / section heading | 11 pt bold black, with a gold block to its left |
| Small-caps table caption | 8.5 pt bold black upper case, optional 7 pt italic grey note |
| Section band text | 9 to 9.5 pt bold white upper case on a gold or grey band |
| KPI value | 13.5 pt bold black (14 pt on the quants slides) |
| KPI label | 7.5 pt, `#777777` or `#555555`; comparison sub-label 7 pt italic `#777777` |
| Snapshot big figure | 15 pt bold (negative in red); caption 7.5 pt `#6B6B6B` |
| Body / bullets | 8 to 9.5 pt black or `#222222`; bold lead-in phrase, then regular text; "•" bullets |
| Narrative slide | 11 pt justified, key sentences bold |
| Table header | bold white on black, same size as the body (7.5 to 10 pt) |
| Table body | 6.5 to 10 pt (6.5 pt on the quants fund list is below a readable minimum) |
| Footnote | 7.5 to 8 pt italic `#6B6B6B`, left, at y 498 pt |

### 2.4 Slide chrome (content slides) [V]

| Element | Geometry (pt) | Style |
|---|---|---|
| Header bar | (0, 0) 960 x 64.8 | `#000000`, no line |
| Header rule | (0, 63.4) 960 x 3.6 | `#BD9568` |
| Title box | (13, 10.1) 738 x 47.5 | 22 pt bold white, upper case, anchor middle |
| Logo | (768, 13) 178.8 x 38.9; right edge 946.8 (13.15 in), centred on the bar | white logo PNG on transparent background |
| Footer band | (0, 520.6) 960 x 19.4 | `#000000`, empty (no page number, no confidentiality line) |
| Footnote | (13, 498.2) 931 x 18.7 | 8 pt italic `#6B6B6B`; source, as-on date and method notes |

The exporter's `base()` (`08_exporters.js:78-92`) draws exactly this chrome; deck A keeps it on every content slide.

### 2.5 Reusable building blocks [V]

| Block | Spec |
|---|---|
| KPI tile | 154 x 47.5 pt (2.14 x 0.66 in), gap 8.6 pt; fill `#FCFAF7`, 0.75 pt `#D9D9D9` outline; 4 pt gold top strip; value 13.5 pt bold; label 7.5 pt `#777777`. Wide variant (quants): six tiles of 149.7 pt, value 14 pt, label 7.5 pt `#555555`, optional 7 pt italic comparison line ("Pre-rebalancing: x"). Exporter `kpi()`. |
| Section label | 8.6 x 17.3 pt gold block + 11 pt bold black text. Exporter `sectionLabel()`. |
| Section band | full content width x 18.7 pt, `#BD9568` (or `#8C8C8C` for the "before" side), 9 to 9.5 pt bold white upper-case caption. Used on slides 8 to 12 (hand-made). |
| Insight box | round rectangle `#F4EEE6`, 0.75 pt gold outline, 6.5 pt gold left bar; "INSIGHT" 8.5 pt bold gold, then 9.5 pt `#222222` text. Exporter `insight()`. |
| Verdict banner | same as insight box, full width, 36 pt tall: label "OUR VIEW" 8.5 pt bold gold, headline 11.5 pt bold black, supporting sentence 10.5 pt. |
| Evidence card | 295 x 67 pt, `#FCFAF7`, 0.75 pt `#D9D9D9`, 5 pt gold left bar; figure 15 pt bold; explanation 9.5 pt `#222222`. |
| Attention row | 625 x 44 pt white, 0.75 pt `#D9D9D9`; left metric panel 108 pt `#F4EEE6` (figure 15 pt bold, caption 7.5 pt); diagnosis 10 pt bold + evidence 8.5 pt; action tag after a 2.5 pt gold rule: tag word 7 pt bold gold ("IN THE PLAN" / "NEXT STEP"), action 9 pt bold black. |
| Before/after strip | full width x 47.5 pt, `#F4EEE6` with gold outline; caption block; up to six metrics, each "label" 7.5 pt `#777777` over "before 11 pt grey → after 12.5 pt bold black" (gold arrow), separated by 0.7 pt gold rules; a closing "NEXT STEPS" block. |
| Chart panel | round rectangle, white (analytics) or `#FBF7F1` (asset allocation), 0.75 to 1 pt `#D9D9D9`; panel title 11 pt bold centred or above-left. |

### 2.6 Table style [V]

| Row type | Fill / text |
|---|---|
| Header | `#000000`, white bold; centred (first column left on analytic tables) |
| Asset-class subtotal | `#BFBFBF`, bold (holdings, asset allocation) |
| Product subtotal | `#D9D9D9`, bold (holdings) |
| Category / sleeve subtotal | `#DBC8B2`, bold (quants, composition, retained row) |
| Grand total | `#000000`, white bold |
| Body | white; zebra `#F4EEE6`, `#FCFAF7`, `#F2F0EC` or `#F3F2F0` depending on slide |
| Benchmark (TRI) | `#FFF8E1`, italic, `#5C3E17` |
| Group header (performance) | `#D9D9D9` bold, label in first cell, empty cells across |
| Action shading | exit `#FCE8E8`; new addition `#E6F4E6`; top-up `#DBC8B2` in deck A (`#FDE7EF` in the exporter: inconsistent) |
| Actionables cell (rebalancing) | `#000000` fill, white bold (brief: change to tan) |
| Negative numbers | `#931621` |

Borders observed, five variants [V]:
1. 0.5 pt `#D9D9D9` on every edge: exporter default (quants, composition, redemption, transition, tax, analytics lists).
2. 1 pt `#D9D9D9`: asset allocation table.
3. 0.5 pt `#E8E0D5` inner plus 1 pt black outer frame: rebalancing table.
4. 1 pt black on every edge: holdings sheets, performance sheets, levels allocation tables, unit-based plan (all hand-edited; the exporter emits 0.5 pt `#D9D9D9` for these).
5. none on chrome shapes.

Alignment [V]: centred numbers on hand-edited tables (holdings, performance, allocation, rebalancing); right-aligned
numbers on exporter-native lists (top holdings, issuers, MF overview, tax). Performance sheets mix centre, right and
default-left within one column (benchmark rows right-aligned, fund rows centred).

Number and text formats [V]: ₹ Cr with 2 decimals (either "₹x.xx Cr" in the cell or bare numbers with "(Cr.)" in the
header); tax in ₹ L; percentages 2 decimals with "%"; allocation changes in "pp"; units with 3 decimals. Missing values
shown as "-" (hyphen) in deck A; the exporter emits "—" (em dash). Dates appear in three formats: "DD-MM-YYYY"
(performance inception), "D Mon YYYY" (holdings purchase date, footnotes), "Mon-YY" (charts). Digit grouping mixes
Western ("1,234,567.890" units) and Indian ("1,08,325" AUM; "3,41,180.848" units in text).

### 2.7 Chart style [V]

| Chart | Type and settings |
|---|---|
| Asset class, liquidity | pie; `varyColors`; slice outline 0.75 pt `#F9F9F9`; labels category + percent, centre, white bold 10 pt, format `0%` (whole percent, cf. KI-091); legend bottom, 9 pt. Colours assigned by series index, not by category. |
| Credit rating | doughnut, hole 50%; seven-step brown/gold/grey ramp (2.2); labels category + percent 8 pt `#222222`; legend bottom 8 pt. Small slices (1 to 2%) produce overlapping labels. |
| Market-cap mix | clustered column, one series gold; value labels `0.00"%"` 9 pt; value axis deleted; no gridlines. |
| Top sectors, AMC, equity MF categories | clustered bar (horizontal), gold; value labels; no gridlines; AMC chart keeps a value axis (0 to max); breaches red. |
| Allocation by distributor / client | stacked column per entity, 100% basis; Equity `#DBC8B2`, Hybrid `#BFBFBF`, Debt `#BD9568`; labels `0.00"%"` 8 pt bold; value axis 0 to 100 step 25 with 1 pt `#888888` gridlines; axis title "% of CMV"; category labels rotated; legend bottom 10 pt. |
| Value turning long-term (tax) | stacked column by month, two series (gold, tan) by financial year; legend top; light gridlines `#E6E6E6`; 6.5 to 7 pt. |
| Overlap matrix | not a chart: raster PNG of the dashboard canvas (navy background), not editable. |

Legend colour conflict [V]: on the asset allocation pie Debt is grey and Hybrid is gold; on the allocation-by-level
charts Hybrid is grey and Debt is gold (the owner-approved palette: Equity tan, Hybrid grey, Debt gold, Commodity
`#808080`). The exporter's pie uses `chartColors` by position (`08_exporters.js:236-237`), so the colour follows the
order of the data, not the category.

### 2.8 Divider, cover, market, disclaimer and closing styles [V]
- Section dividers (4) and the cover and closing slides are full-slide pictures. Divider artwork: white ground,
  pale grey circle, gold ring top-left, black vertical rule near the right edge, black bottom band, bold serif title.
  The logo is stamped top-right on a black rounded plate (139 x 30.2 pt logo at (807.8, 11.5)), per the exporter's
  `stampLogo()`. Titles are baked into the picture and cannot be edited.
- The title slide (slide 2) reproduces the divider artwork with native, editable shapes (ellipse at 26% alpha,
  donut `#C69958`, 3 pt black connector at x 888.6, black bottom band) and native text.
- Market-update pages are full-slide JPEGs of a separate monthly deck with a different header style (black bar,
  light grey-blue rule, larger title, page number bottom-right, no logo).
- The disclaimer uses master 2: pattern-filled background, grey (not gold) rule, 28 pt title, 14 pt justified body
  in a lightly outlined box, slide number bottom-right, no logo. It is native text (the exporter instead places a
  supplied image and stamps the logo).

---

## 3. Deck order and mapping

| # | Component | Title pattern | Build | Existing exporter group | Map |
|---|---|---|---|---|---|
| 1 | Cover | (brand cover photo) | picture | none (exporter has no cover) | NEW |
| 2 | Title slide | PORTFOLIO REVIEW / family / date | native shapes | none | NEW |
| 3 | Asset allocation | ASSET ALLOCATION | native | `asset` | EQ |
| 4 | Review Snapshot (with rebalancing) | PORTFOLIO OBSERVATIONS | native, 99 shapes | `obs` (cards A-D + SWOT) | NEW |
| 5 | Portfolio Quants, current | PRE-REBALANCING PORTFOLIO ANALYTICS | native | `mfanalysis` per-category pages (partial) | DIFF |
| 6 | Rebalancing proposal table | PORTFOLIO REBALANCING | native | `rebal` | DIFF |
| 7 | Portfolio Quants, proposed | POST-REBALANCING PORTFOLIO ANALYTICS | native | none | NEW |
| 8 | Pre/post composition | REBALANCE & WHY: PRE & POST PORTFOLIO ANALYSIS | native | `rbimpact` / `rebalhold` / `cvs` (partial) | DIFF |
| 9 | Redemption plan (₹) | REDEMPTION PLAN: HOW MUCH TO REDEEM AND WHERE IT GOES | native | none (tax engine has lots) | NEW |
| 10 | Transition plan (buckets) | TRANSITION PLAN: FOUR BUCKETS OVER 12 MONTHS | native | none | NEW |
| 11 | Redemption plan (units) | UNIT-BASED REDEMPTION PLAN: WHAT TO SELL, AND WHEN | native | none (tax detail has LT/ST units) | NEW |
| 12 | Cost and tax impact | PORTFOLIO COST & TAXATION IMPACT ANALYSIS | native + chart | `tax` (totals, harvesting), `cost` | DIFF |
| 13 | Narrative observations | PORTFOLIO OBSERVATIONS: OVERDIVERSIFICATION & OVERLAP | native text | `obs` cards | DIFF |
| 14 | Overlap matrix, current | OVERLAP MATRIX: CURRENT PORTFOLIO | raster | `overlap` | EQ |
| 15 | Equity analytics, current | PORTFOLIO ANALYTICS: EQUITY | native + 2 charts | `analytics` | EQ |
| 16 | Debt analytics, current | PORTFOLIO ANALYTICS: DEBT | native + doughnut | `analytics` | EQ |
| 17 | Allocation by distributor and client | ASSET ALLOCATION | native + 2 charts | `distalloc` + `clalloc` (4 slides) | DIFF |
| 18 | AMC allocation | AMC ALLOCATION (ACROSS MUTUAL FUNDS) | native chart | `amc` | EQ |
| 19 | Equity MF overview | MUTUAL FUND ANALYSIS: EQUITY PORTFOLIO OVERVIEW | native + chart | `mfanalysis` summary | EQ |
| 20 | Divider | Rebalancing Opportunities | picture + logo | `sectionDivider('rebal')` | EQ |
| 21 | Equity analytics, proposed | POST-REBALANCING ANALYTICS: EQUITY | native | `postan` | EQ |
| 22 | Debt analytics, proposed | POST-REBALANCING ANALYTICS: DEBT | native | `postan` | EQ |
| 23 | Overlap matrix, proposed | OVERLAP MATRIX: POST-REBALANCING PORTFOLIO | raster | `rbovlp` | EQ |
| 24 | Divider | Annexure | picture + logo | annexure divider | EQ |
| 25 | Divider | Portfolio Holdings & Analytics | picture + logo | `sectionDivider('holdings')` | EQ |
| 26-28 | Holdings sheet (1/3 to 3/3) | PORTFOLIO HOLDINGS - client (n/N) | native table | `holdings` | DIFF |
| 29-30 | Performance, Equity MF (1/2, 2/2) | PERFORMANCE SHEET: EQUITY MF | native table | `perf` | DIFF |
| 31 | Performance, Hybrid MF | PERFORMANCE SHEET: HYBRID MF | native table | `perf` | DIFF |
| 32 | Performance, Debt MF | PERFORMANCE SHEET: DEBT MF | native table | `perf` | DIFF |
| 33 | Performance, proposed funds | PERFORMANCE SHEET: PROPOSED NEW FUNDS | native table | `proposedperf` | DIFF |
| 34 | Divider | Market Update | picture + logo | market divider | EQ (position differs) |
| 35-39 | Market update pages | Equity, Equity (flows), Debt, Commodity, Overall | pictures | `MARKET_UPDATE_IMAGES` | EQ (position differs) |
| 40 | Disclaimer | DISCLAIMER | native text | disclaimer image | DIFF |
| 41 | Closing | THANK YOU | picture | thank-you image | EQ |

Totals [V]: 19 EQ, 15 DIFF, 7 NEW.

Structural observations [V]:
- Market update sits at the end (slides 34-39). The exporter already puts the market divider and pages first
  (`08_exporters.js:140-145`), which is what the brief asks for.
- The "Rebalancing Opportunities" divider (20) comes after the rebalancing content (5-12) and before the
  post-rebalancing analytics; the Annexure divider (24) is immediately followed by another divider (25).
- The analysis order is "verdict first": snapshot and rebalancing (4-13) precede the current-portfolio analytics
  (14-19), unlike the exporter's order (allocation, observations, holdings, analytics, rebalancing, annexure).
- Body text cites slide numbers ("slide 9", "slides 8 and 9"); these break when slides move. The brief requires
  component references, not slide numbers.
- Exporter groups absent from deck A (must stay available, see §6).

---

## 4. Slide-by-slide specification

Common to all content slides: chrome of §2.4; footnote naming every source and its as-on date; Cambria; tokens of §2.

### Slide 1. Cover (NEW)
- Purpose: brand opener.
- Build [V]: one full-slide JPEG (brand photo with logo card). No editable elements.
- Spec for the new deck: keep as a supplied brand asset from the approved monthly or brand folder; no client data.

### Slide 2. Title slide (NEW)
- Purpose: report name, client family, review date.
- Layout [V]: native shapes reproducing the divider artwork (grey circle, gold ring `#C69958`, black vertical rule,
  black bottom band). Text box at (12.6, 70.1) 893 x 400: "PORTFOLIO REVIEW" 28 pt bold, family name 54 pt bold,
  date 28 pt bold right-aligned with an ordinal superscript. A slide-number placeholder sits off-canvas at the top.
- Fields: report type (Portfolio Review / Review with Rebalancing), family or client display name, review date.
- New deck: native placeholders bound to the review model; logo at the lower-right (brief), not on a black plate.

### Slide 3. Asset allocation (EQ, `asset`)
- Purpose: invested vs current value and the split by asset class and product, plus liquidity structure.
- Layout [V]: three KPI tiles at y 76 (Invested Value, Current Market Value, gain tile); section label
  "Allocation by Asset Class & Product" at y 143; table (13, 168.5) 475 x 190, columns 180/104/119/72 pt; right
  column two chart panels (504, 72) 456 x 210 and (504, 289) 456 x 189 in `#FBF7F1`, each with an 11 pt title and a
  pie; insight box (13, 428) 475 x 66; footnote.
- Table: Asset Class | Investment Amount (Cr.) | Current Market Value (Cr.) | % CMV. Rows: asset-class subtotal
  (`#BFBFBF` bold), product rows (white), grand total (black). 9 pt, all cells centred, 1 pt `#D9D9D9` borders, 23 pt rows.
- Charts: pie of asset classes (% of CMV); pie of liquidity / structure (open-ended, closed-ended, listed and so on).
- Calculations: Σ invested and Σ CMV by asset class and product over current holdings; % CMV = CMV / total CMV;
  gain tile. Deck A labels the tile "Unrealised Gain" and shows CMV minus invested value, while the holdings sheets'
  "Total Gain/Loss" includes realised gains on units sold earlier; the exporter labels the tile "Total Gain / Loss"
  (`08_exporters.js:216`). The two definitions give materially different figures in the reference deck.
- Insight text: risk profile from the equity share (exporter rule: ≥85% aggressive, ≥60% growth-oriented, ≥40%
  balanced, else conservative) plus the market-cap mix.
- Gaps against the brief: pie colours follow data order (Debt and Hybrid swap colours versus slide 17); whole-percent
  labels; near-white slice outlines (brief: consistent grey outlines); legend is horizontal at the bottom (meets brief).

### Slide 4. Review Snapshot, "with rebalancing" mode (NEW; replaces / extends `obs`)
- Purpose: one-page verdict: what drives return and risk, what works, what needs attention, what the plan changes.
  This is the reference for the brief's conditional Review Snapshot (Phase 5) and the observation engine (Phase 8).
- Layout [V] (99 shapes, 6 groups, many free text boxes):
  1. Verdict banner (13, 74.9) 932 x 36: "OUR VIEW" + one-line headline + one supporting sentence.
  2. Two section labels at y 121: "What is working" (x 13) and "What needs attention" (x 320).
  3. Left column: four evidence cards (295 x 67, pitch 72.7 pt from y 148). Each: one headline figure (or a
     slash-separated triple) and one explanatory sentence.
  4. Right column: six attention rows (625 x 44, pitch 48.2 pt from y 148). Each: metric panel (figure + caption),
     diagnosis headline, one or two evidence sentences, action tag ("IN THE PLAN" or "NEXT STEP").
  5. "WHAT THE PLAN CHANGES" strip (13, 439) 932 x 47.5: six before → after metrics and a "NEXT STEPS" block.
  6. Two-line source footnote, bottom-anchored at y 490.
- Fields and metrics used (generic): since-inception portfolio XIRR vs benchmark XIRR on the same cash flows;
  asset-class split; market-cap split of equity; share of the portfolio kept and its 3Y return; count of active vs
  passive funds; stock positions vs unique companies; pairwise fund overlap; a sleeve's overlap with its index
  (index proxied by an index fund's holdings); sleeve XIRR vs index; value-weighted 3Y alpha of a sleeve; number of
  funds trailing their benchmark on the client's cash flows; score quartile counts; debt share. Strip metrics:
  holdings count, weighted 3Y return, weighted Sharpe, weighted 3Y alpha, weighted up-capture, equity overlap with
  Nifty 500 (pre → post).
- Reasoning pattern [V]: each attention row is Evidence (metric panel) → Diagnosis (headline) → Implication
  (evidence sentence) → Action (tag). This matches the brief's Phase 8 chain and should be the observation-rule
  output schema.
- Mode rules for the new build [I, from the brief]: Review Only drops the action tags that imply a plan, the
  "funds we keep" card and the before/after strip; With Rebalancing shows them only when a valid proposal exists.
- Data sources named in the footnote: client transactions (XIRR), screener holdings (overlap), Centricity MF Screener
  (scores, alpha, capture, ratios), MF Monitor (returns).
- Gaps: built from free text boxes and groups with misaligned offsets; should be a component with fixed slots.

### Slide 5. Portfolio Quants, current portfolio (DIFF; brief: "Portfolio Quants" pre)
- Purpose: category-level, value-weighted quantitative profile of the current fund book, with each fund's score
  and 3Y return; the base for the pre/post comparison.
- Layout [V]: six wide KPI tiles at y 70.6 (Funds held; Weighted Centricity Score with "x% of value scored";
  Weighted 3Y return (annualised); Weighted 3Y Sharpe ratio; Weighted 3Y alpha; Equity overlap with Nifty 500).
  Left table (13, 139) 591 x 268 with caption "CATEGORY ALLOCATION AND WEIGHTED ANALYTICS"; right table
  (615, 139) 332 x 269 with caption "FUND ALLOCATION (shaded: proposed exit)"; gold band "WHAT THE CURRENT
  PORTFOLIO LOOKS LIKE" at y 412; three bold-lead bullets (8.19 pt, shrunk) at y 431; footnote.
- Category table: Category | Funds | ₹ Cr | % Total | Score | 1Y | 3Y | 5Y | Beta | SD | Alpha | Sortino | Sharpe |
  Down Cap. | 3Y Roll. Column widths 116.6 then 28.8 to 38.9 pt. Rows: EQUITY subtotal (tan), the equity categories
  held, HYBRID subtotal, DEBT subtotal, TOTAL PORTFOLIO (black). 7.5 pt, 17.6 pt rows, 0.5 pt `#D9D9D9`, first
  column left, others centred; negatives red. Category order here is alphabetical (Flexi Cap, Focused, Index, Large
  & Mid Cap, Large Cap, Mid Cap, Multi Cap, Sectoral & Thematic, Small Cap) with the overseas FoF last, which differs
  from the performance-sheet order (slides 29-30) and from the composition table (slide 8, same alphabetical order).
  The new build should use one category order everywhere. The same category rows stay on the post-plan version
  even when empty (0 funds, "-").
- Fund table: Fund | % Total | Score | 3Y; one row per fund at 6.5 pt, 9.2 pt rows; exits shaded `#FCE8E8`.
- Calculations implied: per category, Σ CMV and count; every metric value-weighted over the funds that have the
  metric (coverage tracked: "x% of value scored"; "-" means not available, never zero). Score = Centricity Screener
  score (%). Returns 1Y/3Y/5Y annualised from the MF Monitor; Beta, SD, Alpha, Sortino, Sharpe, Down capture, 3Y
  rolling from the Screener (3Y window, each fund against its own benchmark). Equity overlap with Nifty 500 =
  Σ over stocks of min(portfolio equity weight, index weight), index proxied by an index fund's holdings.
- Existing dashboard: `mfanalysis` per-category slides show per-fund Beta, SD, Alpha, Sortino, Sharpe, Down
  capture, 3Y rolling against a universe average (equity MFs only, no weighting, no score, no hybrid/debt rows, no
  KPI tiles); the AI Analyst reads Centricity scores and ranks. The weighted roll-up, score coverage and index
  overlap are new.
- Brief: source from the Screener subject to availability and validation, with the monthly Excel fallback; track
  metric name, value, period, benchmark, source and date (Phase 7.2).

### Slide 6. Rebalancing proposal table (DIFF, `rebal`; brief: Actionables black → tan)
- Purpose: per holding, the action and where the money goes.
- Layout [V]: one table (9.5, 71.4) 937 x 417, columns 159/259/89/120/219/92 pt; footnote.
- Columns: Client | Instruments Name | Amount | Actionables | Proposed Funds | Amount / %. One row per holding acted
  on; multi-destination rows list each proposed fund and "₹x Cr / y%" on separate lines; Grand Total row (black)
  with Σ amount and Σ proposed. 9 pt, all centred; borders 0.5 pt `#E8E0D5` inside and a 1 pt black frame.
- Actionables cell [V]: black fill, white bold, holding a short rationale ("Stronger mid-cap fund") rather than
  the action keyword. Brief: change to tan (`#DBC8B2` with black text is the palette's tan; confirm).
- Calculations: Σ amount = Σ proposed; split percentages sum to 100% per row (exporter shows "Σ x%" when not).
- Exporter differences: the exporter has 8 columns (adds % Allocation and Rationale), page totals and an
  "Unallocated" note, 7.5 pt, action-coloured boxes (`BOXC`: Exit black, Retain gold, Partial tan, New grey,
  Top-Up grey). Deck A dropped two columns and moved the rationale into the action cell.
- Footnote states actionables are adviser inputs, not system recommendations.

### Slide 7. Portfolio Quants, proposed portfolio (NEW; brief: "Portfolio Quants" post)
- Same component as slide 5, computed on the post-plan holdings.
- Differences [V]: KPI tiles carry a 7 pt italic "Pre-rebalancing: x" comparison line; category rows that empty out
  stay listed with 0 funds and "-"; fund list shading: new addition `#E6F4E6`, top-up `#DBC8B2`; band "WHAT CHANGES
  AFTER REBALANCING" with three bullets (fewer funds/same breadth, better funds per sleeve, the trade-off).
- Calculations: post-plan weights = current CMV − redeemed + reinvested per fund; metrics re-weighted the same way;
  funds without stock-level data are named and excluded from the look-through counts.
- Must state that post figures are the proposed funds' trailing record, not a forecast.

### Slide 8. Pre/post composition (DIFF; brief asks for pre/post CAGR and illustrative values here)
- Purpose [V]: show that the plan consolidates funds without changing the asset allocation.
- Layout [V]: gold band caption at y 70; two header bands above the table: "BEFORE REBALANCING" (`#8C8C8C`) and
  "AFTER REBALANCING" (gold); table (13, 116.6) 933 x 232, 8 pt, 15.5 pt rows; four bold-lead bullets (9 pt) at
  y 356; footnote.
- Columns: Category | No. of Schemes | Value (₹ Cr) | % of Portfolio (before) | No. of Schemes | Value (₹ Cr) |
  % of Portfolio (after) | Change (₹ Cr) | Change (pp). Rows: EQUITY subtotal, categories, HYBRID, DEBT, TOTAL.
- Calculations: before/after Σ value and count per category; change = after − before; pp = percentage-point
  change of total portfolio; totals must reconcile (total value unchanged by a pure switch).
- Brief requirement (not present in deck A [V]): current value; pre and post 3Y and 5Y CAGR; illustrative pre and
  post values after 3 and 5 years; rupee difference; analyst-entered expected returns for alternate products
  (PMS/AIF and so on); historical vs illustrative clearly distinguished; never a guarantee.
  Implied formula: illustrative value(n) = current value × (1 + CAGR)^n, CAGR = value-weighted trailing 3Y or 5Y
  return of the pre or post fund set (or the analyst's expected return where no history applies); difference =
  post − pre. The weighted 3Y and 5Y returns already exist on slides 5 and 7 (TOTAL PORTFOLIO row).
- Existing dashboard: `cvs` (Current vs Sample) computes allocation-weighted returns from assumed category returns
  and valuations after 3, 5 and 10 years (`08_exporters.js:571-686`); `rebalhold` and `rbimpact` show
  current vs post weights. The brief's slide 8 is closest to `cvs` but must use fund-level CAGR.

### Slide 9. Redemption plan in rupees (NEW; brief: units + INR, remove "Reinvest into")
- Purpose [V]: per fund, how much to redeem, when, the estimated tax, and where it goes.
- Layout [V]: gold band caption (counts of exits, harvests and retained funds, basis date); table (13, 92.9)
  934 x 311, 7.5 pt, 13.1 pt rows, 0.5 pt `#D9D9D9`, zebra `#F2F0EC`; three bold-lead bullets (8 pt); footnote.
- Columns [V]: Fund | Current value | Action (Full exit / Sell and buy back / Retain) | Bucket | Amount to redeem |
  amount by execution date (three columns: now, +6 months, +12 months) | Est. tax (₹ L) | Reinvest into | Rationale.
  Last rows: "Retained: n funds" (tan) and Total portfolio (black).
- Calculations: amount by date from the unit plan × NAV at the basis date; tax per fund = taxable gain of the lots
  sold × rate × (1 + surcharge) × (1 + cess) (footnote parameters: 12.5% LTCG, 15% surcharge, 4% cess, resident
  individual, exemption already used, none assumed next year); totals computed before rounding; reinvestment keeps
  the asset mix constant at every step.
- Brief changes: show redemption in units with the INR amount; columns instrument, units, reference NAV or price,
  estimated value, timing, rationale; "borders highlighting differences" (meaning to be confirmed); remove the
  "Reinvest into" column but keep the reinvestment calculation in the model (it feeds slides 6, 7 and 8).

### Slide 10. Transition plan, buckets over 12 months (NEW)
- Purpose [V]: group exits into buckets by tax cost and timing, with cumulative tax.
- Layout [V]: two gold bands; table 1 (13, 91.4) 934 x 157: Bucket | When | Funds | Value | Redeemed | Gains |
  Losses | Net gain = taxable | Tax | Cumulative redeemed | Cumulative tax | Why this bucket (bucket cells tan,
  totals black). Table 2 (13, 278.6) 934 x 105: Date | Financial year | What is sold | Redeemed and reinvested |
  Cumulative redeemed | Tax | Cumulative tax. Four bold-lead bullets; footnote.
- Bucket rule [V, stated on the slide as analyst-set thresholds]: Bucket 1 = tax on a full exit ≤ 2.5% of value;
  Bucket 2 = loss harvest (sell and buy back); Bucket 4 = tax > 4% of value and the fund is sound (score above
  category average and positive 3Y alpha), deferred into the next financial year; Bucket 3 = the rest. The slide
  says the rule is a workbook formula so thresholds can be changed.
- Timing rule: no short-term sales and no exit loads: each lot waits until it is long-term; SIPs into exit funds stop
  first and are redirected.
- Calculations: per bucket Σ value, Σ gains, Σ losses, net taxable, tax; cumulative columns; per date Σ redeemed
  and tax; financial-year split.
- This is the Phase 2 "unit-based records and scenario" foundation the brief asks to prepare, not to automate yet.

### Slide 11. Unit-based redemption plan (NEW)
- Purpose [V]: units to redeem per fund on each execution date.
- Layout [V]: gold band caption; table (13, 92.9) 934 x 364, 10 pt, 17 pt rows, 1 pt black borders on every cell,
  zebra `#F3F2F0`; black call-out bar (13, 465) 934 x 27 for the loss harvest (units sold and bought back, reference
  NAV, value); footnote. Title 20.5 pt and no anchor (the only slide off the 22 pt standard).
- Columns: Fund to exit | Bucket (B1/B3/B4) | units now | units at +6 months | units at +12 months | Total units to
  exit | Reinvest into.
- Calculations: FIFO lot ledger per folio from client transactions; a lot becomes eligible when long-term (more than
  12 months for equity funds) and past its exit-load window; units per date = Σ eligible units at that date; total =
  Σ units in all lots.
- Existing dashboard: `tax` holding detail already shows Units, LTCG units, STCG units and amounts available per
  holding (`08_exporters.js:1552-1660`); the date-bucketed schedule is new.

### Slide 12. Cost and taxation impact (DIFF, `tax` and `cost` in part)
- Purpose [V]: compare "execute all now" with the phased plan, show the financial year's realised position and the
  loss-harvest effect.
- Layout [V]: grey band "FY position before rebalancing" over a 2-column table (13, 95.8) 328 x 118 (Metric |
  Amount, right-aligned amounts); a sand text box (8.5 pt); gold band "Proposed rebalancing: tax impact" over a
  3-column table (356, 95.8) 590 x 186 (Metric | Execute all now | Four-bucket plan; TOTAL COST row tan);
  gold band over a harvest table (13, 316.8) 544 x 49 (Without harvest | With harvest | Difference) and three
  bullets; gold band over a stacked-column chart (567, 316.8) 380 x 179 (value turning long-term by month, by FY).
- Fields: realised LTCG on equity funds and on overseas FoF, realised STCL, exemption status, tax already booked,
  redemptions this FY; value redeemed per FY, long-term gains, short-term gains or losses, loss harvest, tax per FY
  (incl. surcharge and cess), exit loads, stamp duty on purchases (0.005%), total cost, cost as % of value moved.
- Calculations: tax by section of the Income-tax Act 2025 (footnote cites ss.196, 197, 198 replacing old 111A, 112,
  112A; STCG 20%, LTCG 12.5%); loss set-off order (short-term loss against both heads; long-term loss only against
  long-term gains); harvest saving = Δ taxable LTCG × effective rate − stamp duty on buy-back; monthly schedule of
  units turning long-term valued at the basis NAV.
- Existing dashboard: `tax` gives LT/ST split, totals by product and asset class, harvest candidates (holdings at a
  loss); `cost` gives weighted TER. Plan-vs-now comparison and the FY position table are new.

### Slide 13. Narrative observations: over-diversification and overlap (DIFF, `obs`)
- Purpose [V]: long-form reasoning behind the snapshot (evidence → diagnosis → implication → action).
- Layout [V]: one text box (10.3, 69) 945 x 407, 11 pt justified, seven bullets separated by blank paragraphs,
  key sentences bold; footnote.
- Content pattern: portfolio vs benchmark XIRR; positions vs unique stocks; category stacking; a sleeve's active
  share vs its index; duplicate holdings between named funds; weighted alpha; share of equity held like the index;
  funds trailing their benchmark; top-10 concentration; the design principle of the plan; what changes and why
  index overlap only eases modestly.
- New build: generated by the observation engine (rules with inputs, triggers, metrics, data-quality gates), never
  free text; editable wording without changing calculations.

### Slide 14. Overlap matrix, current (EQ, `overlap`)
- Build [V]: full-width raster (0, 63.6) 960 x 413 of the dashboard's canvas: navy `#233140`, gold title "OVERLAP
  MATRIX — MUTUAL FUNDS / PMS", subtitle with the formula, numbered fund rows with full names, numbered columns,
  bucket legend; footnote names the highest-overlap pair.
- Calculation: overlap(A, B) = Σ over common stocks of min(weight in A, weight in B); diagonal 100; ≥ 99.5 shown as
  100 (`07_engine.js:1314-1362`); buckets <15 / 15-30 / 30-50 / >50.
- Gap against the brief: not editable (brief: native editable components); colour logic is a heatmap on navy, out of
  step with the white deck. A native table with conditional fills would meet the brief.

### Slide 15. Equity analytics, current (EQ, `analytics`)
- Layout [V]: KPI tiles "Total Number of Stocks", "Total Unique Number of Stocks"; "Market-Cap Allocation
  (% of equity)" column chart panel (14.4, 149) 454 x 144; "Top Sectors (% of equity)" bar chart panel
  (14.4, 326) 454 x 140 (top 10); "Top Underlying Holdings | % Eq" table (486, 75.6) 461 x 386, top 20, zebra
  `#F4EEE6`, 8.5 pt, right-aligned values; insight box (largest sector, top-10 share); footnote with the counting
  rule (a company held in two schemes counts twice in "total", once in "unique"; cash and TREPS excluded).
- Calculation: look-through weights = Σ over funds of fund CMV share × stock weight in fund (equity sleeve of hybrids
  included); market-cap buckets Large / Mid / Small / Others; sector totals.
- Brief: add top-three sector concentration; never apply the debt sub-2% rule to sectors.

### Slide 16. Debt analytics, current (EQ, `analytics`)
- Layout [V]: KPI tiles "Avg Modified Duration (yrs)", "Avg YTM"; "Credit Rating Distribution" doughnut panel
  (14.4, 174) 454 x 317; "Top Issuers | % Debt" table, top 20.
- Categories [V]: SOV, AAA/A1+, AA+, AA & Below, Others, UNRATED, Cash & Equivalents.
- Calculation: CMV-weighted issuer and rating mix of the debt exposure (pure debt funds and the debt sleeve of
  hybrids); duration and YTM CMV-weighted over pure debt funds only (footnote states the fund count).
- Brief: fold eligible components below 2% into "Others" with a note below the pie and full detail kept in the
  table; proposed three rating buckets (Sovereign + AAA/A1+ + cash equivalents; Unrated; AA+ to B); correct debt
  denominator; no double counting.

### Slide 17. Allocation by distributor and by client (DIFF, `distalloc` + `clalloc`; brief: "four into two")
- Build [V]: one slide holding both levels: two tables at y 75.6 (distributor-level 458 x 166, client-level
  459 x 166) and two stacked-column charts at y 253 (458 x 245 each). Tables 10 pt, 1 pt black borders, asset rows
  `#D9D9D9` bold, product rows indented, grand total black.
- Table columns: Asset Class | one column per distributor (or client) | Grand Total; values in ₹ Cr.
- Charts: one stacked bar per entity, % of that entity's CMV by asset class (Equity tan, Hybrid grey, Debt gold),
  0 to 100 axis with gridlines, rotated labels, legend bottom.
- Exporter today [V]: four slides: per level a table slide (white 0.5 pt borders, right-aligned) and a chart slide
  (`08_exporters.js:249-289`).
- Brief: two slides, client-level (chart and table together) and advisor-level (chart and table together); fixed
  legend colours; grey pie outlines; horizontal legends; no unnecessary gridlines (the 1 pt `#888888` gridlines are
  candidates for removal); consistent chart sizes; reconciled totals. Suppress a level with a single entity
  (KI-092) or show it as a table only.

### Slide 18. AMC allocation (EQ, `amc`)
- Layout [V]: white chart panel (24.5, 82) 911 x 346 with a horizontal bar chart (AMC share of the mutual-fund
  book, descending, value labels `0.00"%"`, value axis shown, no gridlines); insight box; footnote with the 20% per-AMC
  cap and red for breaches.
- Calculation: Σ CMV by canonical AMC key / Σ MF CMV (`07_engine.js:1114+`).

### Slide 19. Equity MF overview (EQ, `mfanalysis` summary)
- Layout [V]: three KPI tiles (Total Equity MF CMV, Equity MF Funds, SEBI Categories); table (13, 144) 432 x 266:
  Category | # Funds | CMV (Cr.) | % of Equity MF, zebra `#FCFAF7`, 9 pt, Total row black; bar chart panel
  (471.6, 82.8) 472 x 414 of CMV by category, descending.
- Calculation: equity MFs only, excluding the overseas FoF (stated in the footnote); % = category CMV / Σ equity MF.
- Deck A relabelled exporter text ("% of MF Book" → "% of Equity MF", "Total MF Funds" → "Equity MF Funds").

### Slides 20, 24, 25, 34. Section dividers (EQ; brief: placeholder slides editable, logo lower-right)
- Build [V]: full-slide picture with the title baked in; logo on a black rounded plate top-right.
- New deck: native divider layout (artwork shapes as on slide 2, editable title text), logo at the lower-right,
  no black plate; dividers emitted only when a following section exists (avoid two in a row, as slides 24-25).

### Slides 21, 22. Equity and debt analytics, proposed (EQ, `postan`)
- Same components as slides 15 and 16, computed on the rebalanced holdings; footnote states the basis and names any
  proposed fund without look-through data (excluded from the mixes). The post debt doughnut shows several 1-2%
  slices with colliding labels: the sub-2% rule applies here too.

### Slide 23. Overlap matrix, proposed (EQ, `rbovlp`)
- Same raster component as slide 14 on the post-plan fund set; footnote compares the highest pair before and after
  and lists funds without stock-level data.

### Slides 26-28. Holdings sheets (DIFF, `holdings`; brief: sort by value, group distributors, grey borders)
- Layout [V]: one table per page, near full width (x 4 to 954 pt), 10 pt, 1 pt black borders on every cell,
  header 37 to 39 pt tall, item rows 28 pt (two-line names), subtotal rows 17 to 26 pt; footnote.
- Columns [V]: Instrument Name | Purchase Date | Distributor | Invested Value (Cr.) | Current Market Value (Cr.) |
  Total Gain/Loss (Cr.) | Allocation % | XIRR % | BMXIRR % | Absolute Return %.
- Rows [V]: asset class (`#BFBFBF` bold) → product (`#D9D9D9` bold) → items; Grand Total (black) repeated on every
  page. Asset order Equity, Debt, Hybrid (engine `assetOrder`, `07_engine.js:1125`). Items sorted by CMV
  descending within product (`07_engine.js:1261`).
- Distributor grouping [V]: the Distributor column is vertically merged (rowSpan) over consecutive identical labels
  (a single merge can span most of a page); the exporter writes the label on every row.
- Calculations: purchase date = earliest across folios; XIRR and BMXIRR transaction-based; Total Gain/Loss and
  Absolute Return include units and funds sold earlier (footnote); allocation re-based to the client.
- Brief: sort by current value descending; group repeated distributor labels where it helps readability while
  keeping detail; consistent restrained grey borders (the 1 pt black grid is the hand edit to replace; the
  exporter's 0.5 pt `#D9D9D9` is the likely target); consistent spacing and naming.
- Open point [I]: a global value sort interleaves distributors and breaks merges. Options: merge only runs of
  identical adjacent labels, or sort by value within distributor. Owner decision needed.

### Slides 29-32. Performance sheets (DIFF, `perf`; brief: category order, centre all but the name, drop 2Y)
- Layout [V]: one table per page (x about 5, y 70), 9 pt, 1 pt black borders, 19.4 to 21.6 pt rows; footnote
  ("Benchmark (TRI) rows are shaded. Annualised for ≥1Y. Missing data shown as -.").
- Equity and hybrid columns: Scheme | Inception | AUM (Cr.) | 3M | 6M | 1Y | 3Y | 5Y | 10Y | SI | Large | Mid |
  Small | Others. Debt columns: Scheme | Inception | AUM (Cr.) | 1M | 3M | 6M | 1Y | 2Y | 3Y | 5Y | SI | YTM |
  Avg Mat | Mod Dur.
- Row structure: group header (`#D9D9D9` bold) → funds → benchmark rows (`#FFF8E1`, italic, brown).
- Equity group order [V]: Index Funds (Nifty 50 TRI) → Large Cap (Nifty 100 TRI) → Diversified (large & mid,
  flexi, multi, focused; benchmarks Nifty LargeMidcap 250, Nifty 500 Multicap 50:25:25, Nifty 500) → Mid Cap
  (Nifty Midcap 150) → Small Cap (Nifty Smallcap 250) → Thematic / Sectoral (Nifty 500) → Global Funds (no
  benchmark row). This is the engine's `PERF_GROUPS` order (`07_engine.js:636-651`).
- Hybrid order [V]: Dynamic Asset Allocation → Aggressive Hybrid. Debt [V]: groups follow the categories held, each
  with its CRISIL benchmark row. Several hybrid and debt benchmark rows show "-" because that month's MF Monitor
  values were unusable or absent; the new build needs a status code for this, not a bare dash.
- Alignment [V]: fund cells centred, benchmark-row Inception and AUM right-aligned, some cells default-left.
- Brief: centre all columns except the instrument name; equity order index; large-cap; diversified equity;
  mid-cap; small-cap; thematic and sectoral combined; global; Fund of Funds (a separate last group); hybrid low to
  high risk (arbitrage → aggressive); debt low to high risk (overnight → long duration); remove the 2Y column; include
  relevant debt indices.
- Exporter differences: 7.5 pt, right-aligned numbers, 0.5 pt `#D9D9D9`, "—" for missing.

### Slide 33. Performance, proposed new funds (DIFF, `proposedperf`)
- Same table component as slides 29-31 for the proposed funds, grouped by category with benchmarks; footnote
  explains a fund listed under a different name in the MF Monitor and points to the existing-fund sheet for top-ups.
- Exporter differences: the exporter adds a "matched to: key · source" line per fund, a "Proposed (Cr)" column,
  green rows for funds already held, and a "No Performance Data" page.

### Slides 35-39. Market update pages (EQ; brief: market updates at the beginning)
- Build [V]: five full-slide JPEGs: global indices and Nifty monthly change, monthly SIP flows, sector top/bottom;
  institutional (FII / DII) flows; debt (yields, macro boxes, G-Sec curve); commodity (gold); overall outlook.
- New deck: first section of the deck (exporter already does this); import as supplied artwork or as native slides
  from the monthly Market Update deck (owner decision); source and month recorded in the update log.

### Slide 40. Disclaimer (DIFF)
- Build [V]: native text on master 2 (pattern background, grey rule, 28 pt title), 14 pt justified body in a lightly
  outlined box; no logo; slide-number placeholder. Body includes regulatory registration lines and an e-mail
  confidentiality paragraph.
- New deck: approved presentation disclaimer from the monthly folder, native editable text in the standard chrome,
  logo per brand rule.

### Slide 41. Closing (EQ)
- Build [V]: full-slide picture "THANK YOU" with a different logo tagline from the content slides.

---

## 5. Components the brief cites, cross-referenced

| Brief item | Deck A slide(s) | State in deck A [V] | Required change (brief) | New component |
|---|---|---|---|---|
| "Portfolio Quants" pre/post (slides 5, 7) | 5, 7 | category-weighted quant table, fund list with score, six KPI tiles, bullets | Screener-sourced with Excel fallback; metric provenance tracked | `quants` (mode current / proposed) |
| Rebalancing table, "Actionables" (slide 6) | 6 | Actionables cells black fill, white bold | black → tan | `rebal-proposal` |
| Pre/post CAGR and illustrative values (slide 8) | 8 (composition only); 5 and 7 hold the weighted 3Y/5Y returns | no CAGR projection on slide 8 | current value, pre/post 3Y and 5Y CAGR, values after 3 and 5 years, rupee difference, analyst returns for alternate products, illustrative wording | `prepost-projection` (+ keep composition table) |
| Redemption plan (slide 9) | 9 (₹) and 11 (units) | rupees on 9, units on 11, both with "Reinvest into" | units with INR amount; instrument, units, reference NAV, estimated value, timing, rationale; drop "Reinvest into" from the slide, keep the calculation | `redemption-plan` (merges 9 and 11) |
| Slide 25 "lighter grey borders" | 25 is a divider picture with no table [V]; 26 is the first holdings sheet with 1 pt black borders [V] | | lighter grey borders | `holdings` border token [I: the brief's 25 is this deck's 26; in the previous 40-slide version slide 25 is that holdings sheet] |
| Four asset-allocation slides into two | exporter: 4 (distributor table + chart, client table + chart); deck A: 1 combined (17) | | client-level (chart + table) and advisor-level (chart + table) | `alloc-level` × 2 |
| Holdings sheets: distributor grouping, sort | 26-28 | sorted by CMV within product; distributor vertically merged | sort by value; group repeated distributor labels; grey borders | `holdings` |
| Performance sheets: category order, alignment | 29-33 | order already index → large → diversified → mid → small → thematic → global; mixed alignment; 2Y on debt | centre all but name; add FoF group; hybrid and debt risk order; drop 2Y | `performance` |
| Market update | 34-39 at the end | pictures | at the beginning | `market-update` |
| Placeholder / image slides, logo position | 1, 20, 24, 25, 34, 41 | full-slide pictures; logo top-right on a black plate | editable elements; logo lower-right; no full-slide placeholder images | `divider`, `cover`, `closing` |
| Disclaimer | 40 | native text, different master and chrome | approved monthly disclaimer material | `disclaimer` |
| Conditional Review Snapshot | 4 | "with rebalancing" version only | two modes, one snapshot in the deck | `review-snapshot` |
| Debt sub-2% into Others | 16, 22 | 7 rating categories, small slices collide | consolidate below 2% with a note; three rating buckets proposed | `debt-analytics` |
| Fixed legend colours, grey pie outlines, no needless gridlines | 3, 16, 17, 22 | colour by position; near-white outlines; 1 pt gridlines | fixed category → colour map; grey outlines; drop gridlines | chart theme |
| Cambria 9 pt body | all | Cambria everywhere; body 6.5 to 10 pt | 9 pt default, subject to readability | type scale |
| No en/em dashes in presentation writing | titles, footnotes | deck A uses colons and hyphens; exporter titles and missing-value cells use "—" | remove "—" and "–" from generated text | text rules |

---

## 6. Existing exporter groups not present in deck A (keep available)

`ips` (IPS profile compliance), `cost` (portfolio cost analysis), `irr` (top contributors and laggards), `cvs`
(current vs sample), `mfanalysis` per-category pages (per-fund quant metrics vs universe), `rebalhold` (rebalancing
holding sheet), `rbimpact` (current vs post mix tables), `aia` (AI Analyst plan, rationale, not-assessed pages), the
standard `tax` pages (LT vs ST, totals, holding detail, tax harvesting, holdings at a loss), the observation cards
A-D and the two SWOT slides, the portfolio divider, and the proposed-funds "No Performance Data" page. Deck A
omits them by choice; the brief forbids losing them, so the new deck needs them as selectable components.

---

## 7. Design-system decisions to make for the new deck (from the inconsistencies found)

1. One border token for tables: 0.5 pt light grey (`#D9D9D9`, or the warmer `#E8E0D5`), optional 1 pt outer frame;
   no all-black grids.
2. One tan for action emphasis (`#DBC8B2`) and one top-up colour across screen, deck and workbook.
3. Category → colour map fixed by name (Equity `#DBC8B2`, Hybrid `#BFBFBF`, Debt `#BD9568`, Commodity `#808080`,
   others from the doughnut ramp), applied to every chart.
4. Pie and doughnut outlines grey (not `#F9F9F9`); labels with one decimal or a stated whole-percent rule (KI-091).
5. Minimum table text size (the quants fund list runs at 6.5 pt; the brief's default is 9 pt).
6. One missing-value marker (deck A "-", exporter "—"; the brief bars dashes in writing) and footnoted status codes
   for the brief's missing-data categories.
7. One date format and one digit-grouping convention (Indian or Western) for amounts and units.
8. Brand theme in the PPTX (Cambria theme fonts, palette as theme accents) so hand-added text matches.
9. Native, editable overlap matrix and dividers; logo placement rule (content slides top-right on the bar;
   placeholder slides lower-right).
10. Slide references inside text by component name, resolved at export, never fixed numbers.

---

## 8. What was verified, inferred, or not verified

Verified: every statement marked [V]: all 41 slides rendered and viewed; XML parsed for fonts, sizes, colours,
geometry, borders, merges, charts (13 native, with embedded workbooks), pictures (cover, 4 dividers, 5 market pages,
closing, 2 overlap rasters); exporter and engine line references read in `.blocks/` at commit 782794f.

Inferred: the brief's "slide 25" means the first holdings sheet; the exporter (not deck A) is the base for the new
build's chrome; the Review Snapshot mode rules; the CAGR projection formula for the brief's slide 8.

Not verified: the numbers inside the deck (only the redemption and transition totals were re-added and agree within
rounding); whether the exporter's `DIVIDERS.portfolio` picture is a cover (the embedded images in `index.html` were
not extracted); the Screener metric definitions behind Score, up/down capture and 3Y rolling (login required, not
attempted); the exact meaning of "borders highlighting differences" for the redemption slide; the source of the
"Equity overlap with Nifty 500" figure (no such calculation in the exporter or engine, so it came from outside the
dashboard, probably the analysis workbook).
