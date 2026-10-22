# PowerPoint design system and slide component catalogue

Phase 0 deliverable 12. Draft of 21 Oct 2026, revised 22 Oct 2026 (Phase 0 review, then D-023) and 22 Oct 2026 (the
owner's answers: D-026, D-029, D-030, D-031; change log at the end of `open-questions.md`). The design tokens, building blocks and the 43 slide components of the new
deck, derived from reference deck A [DA], reference deck B's layout patterns [OP §5], the legacy exporter
(`08_exporters.js`, [IE §5, §6]) and the brief's Phase 9. Reference deck A is an analytical and design reference only:
none of its client data or wording is reused, and nothing here identifies a client.

Implementation: `app/src/exports/pptx/` (architecture §15). Tokens live in `app/src/config/tokens.json` and are shared
by the screen, the deck and the workbook. Items that follow a default are marked with their owner question (Q-nn);
the owner decisions ND-1 to ND-10 were answered on 22 Oct 2026 and are cited by their decision numbers (D-024 to
D-033).

---

## 1. Canvas and chrome

| Item | Specification | Source |
|---|---|---|
| Canvas | 16:9, 960 x 540 pt (13.333 x 7.5 in, PptxGenJS `LAYOUT_WIDE`) | [DA §1] |
| Content area | x 13 to 947 pt; y 70 to 495 pt | [DA §2.1] |
| Grids | two columns 13-466 / 486-947 (analytics); 13-488 / 504-947 (allocation); 295 + 625 (snapshot) | [DA §2.1] |
| Header bar | (0, 0) 960 x 64.8 pt, `#000000` | [DA §2.4]; exporter `base()` |
| Header rule | (0, 63.4) 960 x 3.6 pt, gold `#BD9568` | same |
| Title | (13, 10.1) 738 x 47.5 pt; Cambria 22 pt bold, white, upper case, anchored middle | same |
| Logo, content slides | (768, 13) 178.8 x 38.9 pt, right edge at 946.8 pt, white logo on the bar (Q-39) | same |
| Logo, placeholder slides (cover excluded, title, dividers, closing) | lower right, right edge 946.8 pt, bottom 520 pt, no black plate (brief Phase 9; Q-39) | [I] |
| Footer band | (0, 520.6) 960 x 19.4 pt, `#000000`, empty | same |
| Footnote | (13, 498.2) 931 x 18.7 pt; Cambria 8 pt italic `#6B6B6B`; sources, as-on dates, method, status markers | same |
| Market Update pages | no logo (owner decision of 27 Aug) | [PO §3.5] |
| Theme | Cambria as heading and body theme fonts; palette as theme accents so text added by hand matches (verified in the M9 spike) | [DA §7 item 8] |

No object may extend below the footnote line (y 495 pt) or outside x 13 to 947 pt; a test checks every slide.

## 2. Tokens

### 2.1 Colour

| Token | Hex | Use |
|---|---|---|
| `ink` | `#000000` | header and footer bars, table header row, grand total row |
| `gold` | `#BD9568` | header rule, KPI strip, section bands, label blocks, single-series bars, Debt |
| `goldRing` | `#C69958` | title and divider artwork ring |
| `tan` | `#DBC8B2` | sleeve and category subtotal rows, Equity, Actionables cells (D-031), analyst input cells (Excel) |
| `grey75` | `#BFBFBF` | asset-class subtotal rows, Hybrid, chart slice outlines |
| `grey85` | `#D9D9D9` | table borders (the one border token), KPI outlines, product subtotal rows |
| `greyBand` | `#8C8C8C` | "before" bands |
| `warmBorder` | `#E8E0D5` | retired as a table border (one border token, D-031); kept for the overlap legend |
| `cream` | `#FCFAF7` | KPI fill, evidence cards, zebra rows |
| `panel` | `#FBF7F1` | chart panels |
| `sand` | `#F4EEE6` | insight boxes, verdict banner, metric panels |
| `stone` | `#F2F0EC` | zebra rows on plan tables; app chrome |
| `honey` | `#FFF8E1` | benchmark (TRI) rows |
| `brown` | `#5C3E17` | benchmark row text |
| `negative` | `#931621` | negative numbers and breaches only, never a category colour |
| `positive` | `#2E7D32` | "above peer" marks only |
| `exit` | `#FCE8E8` | rows proposed for exit |
| `new` | `#E6F4E6` | new additions |
| `topup` | `#DBC8B2` | top-ups (one colour across screen, deck and workbook; replaces the exporter's `#FDE7EF`) |
| `commodity` | `#808080` | Commodity |
| Text greys | `#222222` body, `#555555` KPI label, `#6B6B6B` footnote, `#777777` sub-label | |
| Rating ramp | `#8C6B43`, `#BD9568`, `#C9A876`, `#DCC4A5`, `#BFBFBF`, `#D9D9D9`, `#E5DACB` | rating detail and other ordered categories |
| Overlap heat | `#F2E9DC` under 15%, `#DCC4A5` from 15% to under 35%, `#C49A66` from 35% to under 50%, `#A87B45` 50% and above, diagonal `#B98C5A` on white; the 35% and 50% boundaries are the overlapping and very-high pair thresholds of D-030 (the legacy bands were 15/30/50) | C-17 (native table, white ground) |

**Fixed category colours** (chosen by category name, never by position; the legacy pie assigned by position, so Debt
and Hybrid swapped colours between slides [DA §2.7]): Equity `tan`, Hybrid `grey75`, Debt `gold`, Commodity
`commodity`, REITs/InvITs `#8C6B43`, Alternatives `#C9A876`, Cash `#E5DACB`, Unknown `#D9D9D9`.

### 2.2 Typography (Cambria throughout)

| Role | Size and style |
|---|---|
| Slide title | 22 pt bold white upper case (one standard; deck A's 20.5 pt exception removed) |
| Title slide | 28 pt bold (report name, date), 54 pt bold (family label) |
| Divider title | 40 pt bold black, native text |
| Panel heading | 11 pt bold black with a gold block |
| Table caption | 8.5 pt bold upper case; optional 7 pt italic note |
| Section band | 9.5 pt bold white upper case on gold (or `greyBand` for "before") |
| KPI value / label | 13.5 pt bold / 7.5 pt `#555555`; comparison line 7 pt italic |
| Snapshot figure / caption | 15 pt bold / 7.5 pt |
| Body and bullets | 9 pt default; narrative observation slides 10 to 11 pt justified, bold lead sentence (Q-44) |
| Table header and body | 9 pt default (brief Phase 9); 8 pt only in components declared dense (C-19, the C-20 fund list, Q-43); otherwise paginate |
| Footnote | 8 pt italic `#6B6B6B` |

Every text run's size must equal the token for its role in this table; a size that is not a token, or 8 pt body text in
a component not declared dense, fails the QA check (section 8 item 3).

### 2.3 Tables (one style)

| Element | Rule |
|---|---|
| Borders | 0.5 pt `#D9D9D9` on every cell edge; optional 1 pt `ink` outer frame on plan tables only. No all-black grids (the holdings sheets' 1 pt black grid is the "slide 25" item, D-031) |
| Header row | `ink` fill, white bold, centred |
| Subtotals | asset class `grey75` bold; product `grey85` bold; category or sleeve `tan` bold |
| Grand total | `ink` fill, white bold, repeated on each page of a paginated table |
| Zebra | `cream` on long lists |
| Benchmark rows | `honey` fill, italic, `brown` text |
| Alignment | numbers centred on presentation tables; the first column (instrument, category, fund) left; performance sheets centre every column except Instrument Name (brief 7.3) |
| Row heights | from measured text (one or two lines), never a fixed count |
| Merges | only adjacent identical distributor labels on holdings slides (Q-34); never in Excel |
| Missing values | a dash, "—", alone and centred in the cell, plus a footnote naming the status, as in the legacy deck (OD-13, OD-29); STALE and PARTIAL values carry "s" and "p" markers (D-029; architecture §6.4) |
| Coverage footnotes | a weighted return or CAGR computed over part of the holdings (D-023 points 3 and 4) carries the "p" marker and a footnote: coverage %, the count excluded and why, the source and its date, and the label "weighted average return of current holdings"; an excluded item is never shown as 0% |
| Negatives | hyphen-minus and `negative` red |

### 2.4 Charts (native, editable, with embedded workbooks)

| Rule | Value |
|---|---|
| Colours | fixed by category name (section 2.1), written per data point |
| Pie and doughnut outlines | 0.75 pt `grey75` on every slice (brief: consistent grey outlines; deck A used near-white `#F9F9F9`) |
| Labels | category and percent with one decimal (KI-091); labels under 2% suppressed, the value stays in the legend and table |
| Legend | horizontal, bottom, Cambria 9 pt |
| Gridlines | none, unless an axis needs a scale (stacked 100% bars keep a 0 to 100 axis without gridlines) |
| Sizes | one panel size per chart role (pie 220 x 190 pt; bar panel 454 x 144 pt; level chart 458 x 245 pt) |
| Totals | chart values come from the same view-model as the table beside them and must reconcile |
| Sub-2% rule | debt issuer, sector and rating-detail charts fold components under 2% into "Others" with a note under the chart; never equity sectors (brief 6.2, 6.3; Q-47) |
| One dimension, one basis | every chart shows categories of one dimension (rating bucket, rating, issuer, sector, instrument type, market cap, duration bucket) on one basis (equity exposure, debt exposure, MF book or total CMV), named in the panel title or caption; "Others" names its dimension ("Other issuers under 2%"); "Derivatives and hedges" and "Non-credit holdings" are separate bars or table lines beside the credit-bucket doughnut, never slices of it; never combine incompatible dimensions (brief 6.3; architecture §9 rule 8) |

### 2.5 Text rules (presentation writing)

No en or em dashes in any sentence, title, footnote, label, note or chart series name (D-029). The one dash on a slide
is the missing-value marker "—", alone in a table cell or tile and generated from a status, with the status in the
footnote; it never appears inside text. Dates "D Mon YYYY"; Indian digit grouping for rupee amounts and units; money in the file's unit with "(Cr.)" or "(L)" in
headers; percentages with 2 decimals; "pp" for allocation changes; units to 3 decimals; cross-references by component
name, resolved to slide numbers at export (never hard-coded "slide 9"). A lint test fails the export test suite on any
breach.

## 3. Building blocks

| Block | Spec | Exporter equivalent |
|---|---|---|
| KPI tile | 154 x 47.5 pt; `cream` fill; 0.75 pt `grey85`; 4 pt gold top strip; value 13.5 pt bold; label 7.5 pt; optional comparison line (wide variant 149.7 pt for six tiles) | `kpi()` |
| Section label | 8.6 x 17.3 pt gold block + 11 pt bold text | `sectionLabel()` |
| Section band | content width x 18.7 pt, gold or `greyBand`, 9.5 pt bold white caption | new |
| Insight box | `sand` rounded rectangle, 0.75 pt gold outline, 6.5 pt gold left bar; label 8.5 pt bold gold; text 9.5 pt | `insight()` |
| Verdict banner | full width x 36 pt, insight style; label, headline 11.5 pt bold, one sentence 10.5 pt | new |
| Evidence card | 295 x 67 pt, `cream`, 5 pt gold left bar; figure 15 pt bold; sentence 9.5 pt | new |
| Attention row | 625 x 44 pt; 108 pt metric panel (`sand`); diagnosis 10 pt bold; evidence 8.5 pt; action tag after a 2.5 pt gold rule | new |
| Before/after strip | full width x 47.5 pt, `sand` with gold outline; up to six metrics "before -> after" | new |
| Facts strip (RO Snapshot) | full width x 50 pt, two rows of tiles (cream, 0.75 pt `grey85`); eleven fixed slots F1 to F11 of architecture §11 (value 11 pt bold, label 7.5 pt); a slot without data shows the dash "—" with its status in the footnote, never disappears | new |
| Trade-offs and constraints box (RB Snapshot) | insight style, three labelled lines: tax (estimated plan tax), liquidity (lock-ins, exit-load windows or their status), execution (transactions and dates) | new |
| Chart panel | rounded rectangle, white or `panel`, 0.75 pt `grey85`; title 11 pt bold | exists |

## 4. Component catalogue

Each component takes a view-model and a layout box, and declares: inclusion rule, variants, pagination, data fields and
footnote content. "Deck A" gives the reference slide; "Legacy" the exporter group.

| Id | Component | Purpose and layout | Variants | Inclusion | Deck A | Legacy |
|---|---|---|---|---|---|---|
| C-01 | `cover` | Brand cover photo (supplied artwork, no client data) | none | full deck (Q-32) | 1 | none |
| C-02 | `title` | Report type, family label, review date; native shapes (grey circle, gold ring, black rule and band); logo lower right | RO / RB report name | full deck | 2 | none |
| C-03 | `section-divider` | Native divider with editable title; logo lower right | per section | only when the section has at least one slide; never two in a row; none in single-section downloads (Q-40) | 20, 24, 25, 34 | dividers (images) |
| C-04 | `market-update` | Monthly market pages from the folder, in folder order, analyst may exclude | images (v1) or native (Q-38) | first section after the title | 35-39 | Market Update images |
| C-05 | `disclaimer` | Approved disclaimer text, native, standard chrome | none | every full and picker deck (Q-40) | 40 | image |
| C-06 | `closing` | Thank-you slide, native, logo lower right | none | full deck | 41 | image |
| C-07 | `review-snapshot` | Verdict banner; RO: the facts strip (current and invested value, unrealised G/L, asset mix, market cap, top sectors, performance against benchmark, risk-adjusted metrics, concentration, overlap, fund quality); up to 4 "what is working" cards; up to 6 attention rows (Evidence, Diagnosis, Implication, Action) that always cover concentration, overlap and fund quality (a fired rule or the neutral fact line). RB: principal issues with "In the plan" / "Next step" tags, the "what the plan changes" strip (both sides computed only), the trade-offs and constraints box, conclusions and next steps; footnote with sources | RO (default) / RB | exactly one per deck | 4 | none |
| C-08 | `asset-allocation` | 3 KPIs (invested, CMV, unrealised gain/loss), asset and product table, asset-class pie and liquidity pie, insight box | scope | always | 3 | `asset` |
| C-09 | `alloc-level-client` | Client-level table and 100% stacked chart on one slide | scope | 2 or more clients (OD-21) | 17 (half) | `clalloc` (2 slides) |
| C-10 | `alloc-level-advisor` | Distributor-level table and chart on one slide | scope | 2 or more distributors | 17 (half) | `distalloc` (2 slides) |
| C-11 | `amc-allocation` | Horizontal bar of each house's share of the MF book, 20% cap line, breaches in red, "AMC not given" row | scope | MF holdings present | 18 | `amc` |
| C-12 | `ips-compliance` | IPS band, actual, within or deviation, per row | profile | IPS profile chosen | none | `ips` |
| C-13 | `observations-narrative` | Ranked observations as bullets under two headings, "What drives portfolio risk" and "What drives portfolio return" (each rule's `driver`), one text box per heading, (1/2) and (2/2) continuation | RO / RB; topic deep-dive | fired rules | 13 | `obs` |
| C-14 | `swot` | One slide, four quadrants of up to four concise pointers each, taken from fired rules through each rule's `swot` quadrants and pointer templates (rule bank §1, §4 item 10, §8); an empty quadrant says "None identified on the data supplied" with its status | RO / RB | fired rules | none | `obs` SWOT (2 slides) |
| C-15 | `analytics-equity` | Stock counts, market-cap column, top sectors bar (top three highlighted), top 20 holdings, coverage line | current / post; scope | equity look-through present | 15, 21 | `analytics`, `postan` |
| C-16 | `analytics-debt` | Duration and YTM KPIs; three-bucket doughnut plus lines outside the buckets; rating detail; top issuers with "Others" note | current / post; scope | debt look-through present | 16, 22 | same |
| C-17 | `overlap-matrix` | Native table with heat fills, numbered funds, selection and threshold, pair footnote, index overlap line | current / post | 2 or more eligible funds | 14, 23 | `overlap`, `rbovlp` (broken) |
| C-18 | `mf-equity-overview` | 3 KPIs, category table, CMV bar by category | scope | equity MFs present | 19 | `mfanalysis` summary |
| C-19 | `mf-analysis-category` | Per category: funds with Beta, SD, Alpha, Sortino, Sharpe, down capture, 3Y rolling against the peer median (Q-51), benchmark rows, age-gate counts | per category | risk data present | none | `mfanalysis` pages |
| C-20 | `portfolio-quants` | Six wide KPIs (funds, weighted score with % of value scored, weighted 3Y return of current holdings with its coverage (D-023 point 3), 3Y Sharpe, 3Y alpha, equity overlap with Nifty 500); category table (Score, 1Y, 3Y, 5Y, Beta, SD, Alpha, Sortino, Sharpe, Down Cap, 3Y Roll); fund list; source and date per metric group; without a stored Screener pack the score and rank cells show the dash with the footnote "Screener data not supplied for this review" and the ratios name their fallback source (D-026) | current / proposed (with comparison line) | MF holdings present | 5, 7 | none (partly `mfanalysis`) |
| C-21 | `holdings-sheet` | Per client: asset, product, instrument rows; Purchase Date, Distributor, Invested, CMV, Gain/Loss, Allocation %, XIRR %, BMXIRR %, Absolute Return %; sort by CMV within product; distributor merges; grand total on each page | per client; column choice | always | 26-28 | `holdings` |
| C-22 | `performance-sheet` | Per bucket; equity groups Index, Large, Diversified, Mid, Small, Thematic and Sectoral, Global, FoF with benchmark rows; hybrid and debt by risk; Debt MF without 2Y; centred columns | Equity, Hybrid, Debt, Commodity, PMS, AIF, SIF, Direct Equity (1Y, 3Y, 5Y CAGR from adjusted month-end prices with the price dates in the footnote, D-023 point 4); Regular / Direct | bucket has holdings | 29-32 | `perf` |
| C-23 | `proposed-funds-performance` | As C-22 for proposed funds; "matched to" line; held funds marked; a "no performance data" page variant | as C-22 | RB with proposals | 33 | `proposedperf` |
| C-24 | `fund-irr` | Top contributors and laggards (analytics section, brief Phase 3 section 4; Q-77); optional IRR tree page (Annexure, Q-48) | contributors / tree; scope (family, client, distributor) | IRR data present | none | `irr` |
| C-25 | `cost-analysis` | Weighted cost KPIs; per instrument base ER and contribution; blanks with footnote (OD-9) | plan switch; scope | always (Annexure) | 12 (part) | `cost` |
| C-26 | `current-vs-sample` | Current and sample allocation with expected returns, values after 3, 5, 10 years, inflation-adjusted, illustrative label | none | analyst opens it | none | `cvs` |
| C-27 | `rebal-proposal` | Client, instrument, amount, Actionables (tan `#DBC8B2`, black bold action word, D-031), proposed funds, amount / %, rationale; totals; unallocated note | none | RB | 6 | `rebal` |
| C-28 | `rebal-holding-sheet` | Holdings with the plan applied: signed proposed amount, rebalanced CMV and allocation, deviation | none | RB | none | `rebalhold` |
| C-29 | `rebal-impact` | Current vs post: market cap, sectors, holdings; ratings, sectors, issuers | equity / debt | RB | none | `rbimpact` |
| C-30 | `prepost-composition` | Before and after by category: schemes, value, % of portfolio, change in value and pp | none | RB | 8 | none |
| C-31 | `prepost-projection` | Current value; pre and post 3Y and 5Y returns weighted over the pre and post fund sets with coverage (D-023 point 3); illustrative values after 3 and 5 years; rupee difference; analyst expected returns for products without history; "historical" and "illustrative" labels; never a guarantee | none | RB (Q-36 answered) | none (brief) | `cvs` partly |
| C-32 | `redemption-plan` | Instrument, units, reference NAV or price, estimated value (INR), timing (execution dates), rationale; units and INR together; date-block outlines (Q-37); no "Reinvest into" column (calculation kept in the model) | none | RB with unit data | 9, 11 | none |
| C-33 | `transition-plan` | Buckets by tax cost and timing with cumulative tax; schedule by date and financial year; analyst thresholds stated | none | RB, analyst opts in (Q-54) | 10 | none |
| C-34 | `tax-lt-st` | Long vs short term by class with KPIs | scope | IRR data | none | `tax` |
| C-35 | `tax-totals` | Roll-ups by product and asset | scope | IRR data | none | `tax` |
| C-36 | `tax-holding-detail` | Per holding units and amounts LT/ST, lots | scope | IRR data | none | `tax` |
| C-37 | `tax-harvesting` | Pools, set-off order, exemption note (Q-52) | scope | IRR data | none | `tax` |
| C-38 | `tax-losses` | Holdings at a loss | scope | IRR data | none | `tax` |
| C-39 | `tax-plan-impact` | Financial-year position; "execute all now" vs phased plan; harvest effect; value turning long-term by month (stacked column) | none | RB | 12 | none |
| C-40 | `ai-analyst` | Draft plan summary, source to destination pairs, rationale, not assessed; "draft" label | pages | analyst includes it (Q-55) | none | `aia` |
| C-41 | `annexure-product` | Approved PMS/AIF product card or one-pager from the product bank, with its as-on dates and return basis | per product | approved list (Q-04) | none | none |
| C-42 | `historical-analytics` | Same structure as C-08/C-15/C-16 for a dated snapshot, with as-on and coverage | per date | historical data present (fund holdings from the Screener pack, Q-27) | none | none |
| C-43 | `drawdown-comparison` | Native line chart of index levels with the drawdown periods shaded, and a table per index and for the blend at current asset-class weights: maximum drawdown, peak and trough dates, months to recover or "not yet recovered"; footnote "index data; the blend uses today's weights and is not the portfolio's own history" and the data source and date (D-023 point 2) | indices chosen from the review's asset mix | index data present (Q-69 default) | none (reference deck B) | none |

## 5. Brief slide rules mapped to components

| Brief rule (Phase 9 and others) | Component | Implementation |
|---|---|---|
| Cambria default, 9 pt table and body | all | tokens §2.2; minimum 8 pt for dense tables |
| Fixed legend colours, consistent outlines, grey borders, no full-slide placeholder images | all charts and tables; C-01 to C-06 | tokens §2.1, §2.3, §2.4; native dividers and closing |
| "Slide 8": pre/post 3Y and 5Y CAGR, illustrative values after 3 and 5 years, rupee difference, alternate-product returns, historical vs illustrative | C-31 (after C-30) | `engine/projection.ts`; D-023 point 3 (Q-36 answered) |
| "Slide 9": redemption in units with INR; instrument, units, reference NAV, estimated value, timing, rationale; borders highlighting differences; no "Reinvest into" column, calculation kept | C-32 | `engine/tax/redemption.ts`; Q-37 |
| "Slide 6": Actionables from black to tan | C-27 | `tan` fill, black bold action word (D-031) |
| "Slide 25": lighter grey borders | C-21 (and the single border token everywhere) | 0.5 pt `#D9D9D9` (D-031) |
| Holding sheet sorted by value, repeated distributor labels grouped | C-21 | sort within product; adjacent merges on slides only (Q-34) |
| Placeholder slides editable, logo lower right | C-02, C-03, C-06 | native shapes and text |
| Market-update slides at the beginning | C-04 | manifest order (Q-32) |
| Conditional Review Snapshot per mode, only one in the deck | C-07 | manifest allows one instance |
| Four allocation slides into two | C-09, C-10 | chart and table together |
| Debt sub-2% into Others with a note; full detail kept | C-16 | §2.4 sub-2% rule |
| Equity: top-three sector concentration; never the sub-2% rule | C-15 | top three highlighted with their combined share |
| Performance: centre all but Instrument Name; order; no 2Y | C-22 | §2.3 alignment; `config/category-order.json` |
| Portfolio Quants (deck A slides 5, 7) with source tracking | C-20 | per-metric source and date in the footnote |
| Map to components, not hard-coded slide numbers | manifest and cross-references | `exports/pptx/xref.ts` |
| No en or em dashes in presentation writing (sentences); the dash only as the missing-value marker (D-029) | all | lint (§2.5) |
| No excessive text boxes, redundant shapes, duplicated metrics or full-slide placeholder images (brief Phase 9) | all | QA §8 items 2 and 7 |
| No overflow or overlaps, no unintended watermarks, no stale client data (brief Phase 14) | all | QA §8 items 4 to 6 and 11 |
| Debt: never combine incompatible dimensions (brief 6.3) | C-16, C-29 | §2.4 "One dimension, one basis" |
| Drawdown comparison on index data (D-023 point 2) | C-43 | `engine/drawdown.ts`; labelled as index data |

## 6. Presentation manifest (default order, configurable)

Order recommended in Q-32; each line lists components in order. A section appears only with content; its divider
(C-03) only then.

1. Opening: C-01 cover, C-02 title.
2. Market update: C-03, C-04.
3. Review Snapshot: C-07 (RO or RB).
4. Portfolio overview: C-03, C-08, C-09, C-10, C-11, C-12.
5. Observations: C-13, C-14.
6. Analytics and overlap: C-03, C-15, C-16, C-17, C-24 (contributors and laggards), C-18, C-19, C-20 (current), C-42
   (when historical data is used), C-43 (when index data is present).
7. Holdings and performance: C-03, C-21, C-22.
8. Rebalancing (RB only): C-03, C-20 (proposed), C-27, C-30, C-31, C-32, C-33, C-39, C-28, C-15 and C-16 (post),
   C-17 (post), C-29, C-23, C-40 (if included), C-26 (if opened).
9. Taxation: C-34 to C-38.
10. Annexure: C-03, C-25, C-41, C-24 tree page (optional).
11. Closing: C-05 disclaimer, C-06 closing.

Picker decks and single-section downloads follow Q-40. Every download button is generated from this manifest, so a
button exists only where at least one content slide would be produced (KI-124 class).

## 7. Pagination

Tables paginate by measured row heights, using a committed Cambria width table (`exports/pptx/measure.ts`) measured
once in the browser and used identically in Node tests. Header row and grand total repeat on every page; titles carry
"(n/N)"; a group header never ends a page (KI-122); text slides continue on "(2/2)" instead of shrinking the font.

## 8. QA checks run on every generated deck (tests/exports/pptx)

1. Slide order and count per mode and scope against the manifest; exactly one Review Snapshot; market updates first.
2. Every chart native with an embedded workbook; every data table native; pictures only for C-01, C-04 (v1) and the
   logos; no full-slide placeholder image.
3. Fonts Cambria; title 22 pt; every text run at its role's token size (section 2.2): body and table text 9 pt, 8 pt
   only in components declared dense; legend colours by category name; slice outline `#BFBFBF`.
4. No object outside the content area or below y 495 pt; footnote present on content slides.
5. **No overlapping objects.** Bounding boxes of the objects on a slide do not intersect, except the layering each
   component declares (text on its panel, a label on its card, a chart inside its chart panel, the logo on the
   header bar).
6. **No unintended watermark.** No rotated or semi-transparent text, no picture or full-slide shape behind content,
   no background picture on a master or layout; the only permitted marker is "Preview build, not for client use" in
   the footnote band, present exactly when the build channel is "preview" (architecture §15).
7. **No excessive text boxes, redundant shapes or duplicated metrics.** Text boxes per slide within the component's
   declared budget; no empty, zero-size or off-slide text box or shape; no two shapes with identical geometry and
   fill; each metric of the cross-output registry printed at most once per slide, except declared repeats (a
   paginated table's grand total).
8. No en or em dash in any text run, except a run that is exactly the missing-value marker "—" in a table cell or
   tile generated from a status, with that status in the footnote (D-029); no "slide n" literal in text; no missing
   value printed as a number.
9. Logo placement by component type; none on market-update pages.
10. Figures in the deck equal the view-model (cross-output test); charts and tables obey one dimension and one basis
    (section 2.4).
11. **No stale client data after a family switch.** A deck built after loading a second family contains no label,
    name or amount of the first in slide text, notes, alternative text, embedded chart workbooks or file properties
    (`integration/export-isolation.test.ts`, AC-20).
12. Local Office acceptance (M9, and whenever an exporter changes): the deck opens in PowerPoint without repair; PNG
    export of every slide reviewed.
