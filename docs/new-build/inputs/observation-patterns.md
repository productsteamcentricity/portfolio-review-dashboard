# Portfolio observation patterns and draft observation rule bank

Phase 0 research note, 21 Oct 2026. Draft for owner review.

**Basis.** Reference deck B (a 21-slide collection of portfolio-observation slides written by Centricity
analysts for about eleven client portfolios), read slide by slide from PowerPoint renders and from the slide
XML; the current engine at commit `782794f` (`.blocks/07_engine.js`, the observations and SWOT block at lines
1665 to 1978 and the AI Analyst at lines 2035 onwards); the exporters (`.blocks/08_exporters.js`); and the
shipped reference data (`window.REFDATA`), probed read-only through `tools/engine-host.js`.

**Public-safe.** This file contains no client, family, entity or person names, no portfolio values, holding
amounts, folio numbers or client transaction dates, and no distributor or advisor firm names. Every example is
a generic template with placeholders. The client-specific evidence behind it is kept outside the repository.

**Conventions.** Placeholders are written `{like_this}`. "RO" means the Review Snapshot mode *Portfolio Review
Only*; "RB" means *Portfolio Review with Rebalancing*. "Engine today" says whether the current engine already
supplies an input: **Exists** (a field of the review model or REFDATA), **Partial** (computed inside
`computeReview` but not exported, or available only in the UI layer, or with a known defect), **Missing**.
Following the house rule for presentation writing, no en or em dashes are used anywhere in this file or in the
templates.

---

## 0. Summary

1. Deck B shows what "client-specific reasoning" means in practice: every bullet states a diagnosis as a
   claim, backs it with two to four numbers from this client's own book, translates the numbers into a plain
   consequence ("so the average company is bought three times over"), and ends with an action to consider.
   The canonical chain is Evidence, Diagnosis, Implication, Action, exactly as the brief asks.
2. Twenty-eight observation types recur (section 2). The most frequent are missing asset classes or
   single-asset-class risk (on 12 of 21 slides), fund selection and laggards (10), overdiversification and
   overlap (9), market-cap skew (9), sub-scale positions (9) and AMC concentration (8).
3. Deck B was partly built on the current dashboard: nine slides use the exporter's own slide frame, and
   several sentences match the engine's SWOT templates almost word for word. The analysts then added, by hand,
   the analysis the engine does not produce: overlap statistics read off the matrix image, active share
   against an index proxy, hidden large-cap exposure behind other category labels, look-through equity through
   hybrids, persistence of laggards across tenors, return concentration, timing of inflows, entity and account
   structure, and pre/post rebalancing outcomes. That added layer is the gap the new observation engine has to
   close (section 7).
4. The reference data can already support most of that layer. Verified: equity look-through now holds full
   holdings (1,144 schemes, median 50 and up to 1,003 stocks each, weights summing to a median 98.9%), so the
   engine comment that only the top 30 holdings are stored is stale; index funds with full constituent lists
   can proxy the indices (Nifty 50: 26 funds, Nifty 100: 3, Nifty 500: 6, Midcap 150: 15, Smallcap 250: 11,
   LargeMidcap 250: 5); MF_PERF carries AUM and a market-cap field for all 2,130 schemes; MF_RISK carries
   alpha, Sharpe, Sortino, beta and downside capture for 966 schemes; PMS_PERF carries trailing returns for 721
   strategies.
5. Three things in deck B cannot be produced from any data the system holds today: the drawdown and recovery
   comparison (no daily index or portfolio series), portfolio trailing CAGR over three and five years (no
   value history), and exit loads (held nowhere, as the engine itself records).
6. Deck B also shows what to avoid: 43 sentences of eight or more words appear on two or more slides (107
   occurrences), including a dated geopolitical paragraph pasted into five slides for four different clients;
   thresholds for the same finding vary between slides (a "small position" is 1.5%, 2% or 3%); one
   recommendation (index the large-cap core) is given whatever the market-cap mix; and some claims have no
   evidence on the slide. The rule bank fixes these with one threshold table, sourced house-view blocks, and an
   evidence requirement on every sentence.
7. The current engine's 35 observation templates contain em or en dashes in 8 places and one unconditional
   bullet ("Periodic rebalancing is recommended...") that fires for every portfolio; both break the brief.

---

## 1. What reference deck B contains (structure only)

| Property | Finding |
|---|---|
| Slides | 21; about 11 distinct portfolios; most portfolios get a two-slide pair |
| Content | 18 slides are a single text box of bullets; 1 table slide (PMS performance); 1 chart plus table slide (drawdown); 1 slide with two bar charts (overlap and fund counts) |
| Templates | (G) the dashboard's own slide frame, 9 slides: black 0.90 in title bar, 0.05 in gold rule, 22 pt bold capitals title, logo top right, black 0.27 in footer bar, optional 8 pt italic source line at 6.92 in. (M) a manual template, 12 slides: 28 pt title, slide number, numbered section headings |
| Text density | 147 to 736 words per slide, median 457; 3 to 15 paragraphs |
| Type | Cambria throughout; body 10 to 13 pt (most often 12 pt); bold emphasis on 12% to 54% of words |
| Alignment | body justified on 20 of 21 slides |
| Mode | almost entirely Review Only; one slide closes with the outcome of a rebalancing proposal |
| Speaker notes | used on two slides, to record method and sources (useful precedent for an audit trail) |
| Charts | line chart (drawdown from peak, four series, legend at bottom, no gridlines); clustered bars (unique vs total stock positions per book; number of funds by category), data labels on, no gridlines |
| Tables | PMS performance with a grouped "Market Allocation" header, group rows for strategy type and for benchmarks, benchmark rows in bold italic; drawdown table with declines in red |

---

## 2. Observation type catalogue

Each type lists where it appears, the evidence and metrics used, the trigger the analysts appear to apply,
the data it needs, the reasoning chain, phrasing templates and layout. Slide numbers refer to deck B.

### OT-01 Overdiversification: many funds, few different exposures
- **Seen on:** slides 1, 3, 7, 8, 10, 11, 14, 15 (7 portfolios).
- **Evidence and metrics:** number of funds and of SEBI categories; total stock positions across all equity
  and hybrid funds; unique companies; the ratio between them ("each company is held {n} times"); top-10 stock
  share as a cross-check.
- **Trigger implied:** ratio of positions to unique companies of about 2 is mentioned as context ("already
  held through roughly two schemes"); about 3 or more is the headline. Usually with 12 or more equity schemes.
- **Data needed:** look-through holdings for every equity and hybrid fund (and PMS where available); the
  coverage of that look-through.
- **Reasoning:** E: {total_positions} positions resolve to {unique_companies} companies. D: fund count has
  grown faster than distinct exposure. I: each extra fund mostly re-buys names already owned, managers' calls
  cancel out, fees are paid several times for the same stock. A: consolidate to fewer funds with distinct jobs.
- **Phrasing:** "The {fund_count} equity and hybrid funds hold {total_positions} stock positions in only
  {unique_companies} companies, so each company is held {multiplicity} times on average." / "This is
  overdiversification: fund count has risen faster than differentiated exposure."
- **Layout:** lead bullet of the construction slide (1/2); optionally a two-bar chart "unique vs total stock
  positions" per book (slide 14).

### OT-02 Category stacking
- **Seen on:** slides 3, 8, 10, 11, 15.
- **Evidence:** count of schemes per SEBI category ("five mid caps, three large & mid caps, two each in ...");
  share of the equity book in the stacked categories.
- **Trigger implied:** two or more schemes in one category; headline when three or more, or when the stacked
  categories hold a large share of the book.
- **Data needed:** a canonical SEBI category per holding (not the free-text base-file category).
- **Reasoning:** E: {n} schemes in {category}. D: each extra fund in a category already owned buys the same
  stocks again. I: risk stacks in one segment rather than spreading. A: keep the strongest one or two per
  category.
- **Phrasing:** "Category duplication compounds the problem: {category_count_list}." / "Each extra fund in a
  category the client already owns largely buys the same stocks again."
- **Layout:** bullet after OT-01; bar chart "number of funds by category" (slide 14).

### OT-03 Pairwise overlap and overlap clusters
- **Seen on:** slides 1, 3, 7, 8, 10, 11, 19.
- **Evidence:** the highest overlapping pairs with their percentage; for large books, the average pairwise
  overlap, the number of pairs at 30% or more out of all pairs, and the "hub" fund with the highest average
  overlap against the rest; same-category clusters ("three balanced advantage funds behave like one"); and the
  reverse case, funds with low overlap that add genuinely different drivers.
- **Trigger implied:** pairs from about 40% are quoted as material; 30% is used as the counting line; the
  engine's bands are under 15 low, 15 to 30 moderate, 30 to 50 high, above 50 very high.
- **Data needed:** the overlap matrix (exists) plus pair statistics (one analyst read 210 values off the matrix
  image to compute them).
- **Reasoning:** E: {fund_a} and {fund_b} share {pair_overlap_pct} of holdings. D: two active fees for
  substantially the same portfolio. I: no diversification benefit from the second fund. A: consolidate into
  the stronger of the pair.
- **Phrasing:** "The average pair of funds shares {mean_pair_overlap_pct} of its holdings, and {pairs_30} of
  the {pairs_total} pairs share 30% or more." / "{hub_fund} sits at the centre of the overlap: it shares
  {top3_overlap_list} and {hub_avg_overlap_pct} on average with the other {n_others} funds."

### OT-04 Hidden large-cap exposure behind other labels
- **Seen on:** slides 8, 10, 11.
- **Evidence:** large-cap share of each flexi, focused, multi-cap, contra, thematic and hybrid fund; how many
  such funds and how much money "chase the same top 100 names".
- **Trigger implied:** inconsistent across slides (from the mid 40s to the high 70s, in percent), so it needs a
  single owner-set threshold. One slide applied it to equity savings funds using the share of the whole fund,
  which mixes in their arbitrage and debt sleeves.
- **Data needed:** market-cap split of each fund's equity sleeve; category.
- **Reasoning:** E: {n} schemes in other categories carry {large_cap_share_range} large cap. D: they are
  effectively large-cap funds wearing different labels. I: the large-cap segment, where the top 100 names are
  common to almost every scheme, is held several times over. A: hold large cap deliberately through one index
  fund and one high-conviction manager.
- **Phrasing:** "{fund_list} are all effectively large cap vehicles wearing different names. Together these
  {n} schemes hold {pct_of_mf_book} of the mutual fund book."

### OT-05 Index-like active funds and the index outcome
- **Seen on:** slides 3 (in depth), 1, 8.
- **Evidence:** "different from the index" (active share) of each fund against its category index, proxied by
  index-fund holdings; the same measure for a whole sleeve after combining funds (combined sleeves look more
  like the index than any single fund); the share of the equity book held as the Nifty 500 holds it; weighted
  three-year alpha of a sleeve; portfolio XIRR against the XIRR of the same cash flows in each fund's
  benchmark; count of holdings behind their own benchmark.
- **Trigger implied:** combined sleeve active share under 50% ("more than half of it now duplicates the
  index"); portfolio return within a few basis points of the benchmark return while most of the book is in
  active funds.
- **Data needed:** index constituent weights (index-fund proxy), full look-through, MF_RISK alpha, transaction
  flows and benchmark flows.
- **Reasoning:** E: combined active share {sleeve_active_share_pct} against {index_name}; sleeve return
  {sleeve_xirr} vs {index_xirr}. D: the client is paying active fees and receiving an index outcome. I:
  differentiation is being paid for on less than half the book. A: where active managers have not added value,
  hold the exposure through a lower-cost index fund; pay active fees only for funds that are genuinely
  different from their benchmark and from each other.
- **Phrasing:** "Individually the {n} {category} funds are {min_as} to {max_as} different from the {index};
  combined, the sleeve is only {sleeve_as} different, so {dup_share} of it now duplicates the index."

### OT-06 Fragmentation: sub-scale positions
- **Seen on:** slides 4, 7, 8, 10, 11, 15, 17, 18, 20.
- **Evidence:** number of holdings below a weight threshold, the smallest weight.
- **Trigger implied:** 1.50% on most slides, 2% in boilerplate, 3.00% on one slide. The engine uses 1.50% for
  SWOT and 2% as the AI Analyst floor. Needs one owner-set number.
- **Data needed:** weights at the right aggregation level (scheme across the family, or each account row).
- **Reasoning:** E: {n_small} of {n_holdings} holdings each sit below {small_pct}. D: positions this size cannot
  move the portfolio. I: monitoring and rebalancing complexity without changing exposure; conviction diluted.
  A: fold them into larger holdings unless each has a distinct role.

### OT-07 Look-through allocation differs from the labels
- **Seen on:** slide 1 (headline), slide 17 (debt and hybrid together as "defensive").
- **Evidence:** hybrid share of the book; their average equity sleeve; resulting effective equity share
  against the labelled equity share.
- **Trigger implied:** effective equity materially above the label (one slide: roughly double).
- **Data needed:** hybrid equity sleeve weights, **net** of hedged positions for arbitrage and balanced
  advantage funds (see section 7, data gap G-6).
- **Reasoning:** E: hybrids are {hybrid_pct} of the book and hold about {hybrid_eq_pct} in stocks. D: they
  carry more equity than the label shows. I: about {effective_equity_pct} of the portfolio moves with the
  equity market against {labelled_equity_pct} shown as equity. A: size equity on the look-through figure.

### OT-08 Fund-house (AMC) concentration
- **Seen on:** slides 2, 7, 8, 11, 15, 17, 18, 19.
- **Evidence:** largest house's share of the mutual fund book against the 20% house cap; the top two houses
  combined; near-cap cases ("neither breaches the cap, but together they are more than a third").
- **Trigger implied:** above 20% is a breach; top two combined above about a third is called out even without
  a breach; within-cap is reported as a positive.
- **Reasoning:** E: {amc_1} runs {amc_1_pct} of the mutual fund book and {amc_2} a further {amc_2_pct}. D: two
  houses drive {top2_pct}. I: a manager exit, process change or strategy drift at either house would move the
  whole portfolio. A: trim toward the cap and redeploy into quality houses already held; direct new money to
  other houses.

### OT-09 Product-structure concentration
- **Seen on:** slides 8, 11, 17.
- **Evidence:** share of the book in one product type ("100% mutual funds across {n} schemes"); or one asset
  class split into several "books" (mutual funds, unlisted, one PMS, direct stocks).
- **Reasoning:** E: {top_product_pct} in {product}. D: every return driver and every risk runs through one
  product type. I: no direct bonds, alternatives or real assets to balance it. A: consider selected PMS, AIF or
  direct bond allocations where suitable for the book's size.

### OT-10 Underlying stock concentration, or its opposite
- **Seen on:** slides 1, 3, 4, 8, 10, 11, 14, 15.
- **Evidence:** top-10 stock share of the equity sleeve.
- **Trigger implied:** two-sided. High (above about 60%, typically a direct-equity book) means concentration
  risk. Low (about 15%) with a long sub-1% tail means dilution: "no single idea is large enough to lift the
  result". The engine only has the high side.
- **Phrasing:** "The top 10 underlying stocks are only {top10_pct} of equity, with a long sub-1% tail, so the
  real risk is not concentration but fragmentation."

### OT-11 Sector concentration
- **Seen on:** slides 1, 4, 8, 20.
- **Evidence:** top two or three sectors' combined share; a single sector (banks) share; how much of it is
  deliberate (sectoral funds' share of the book).
- **Trigger implied:** top three about 50% or more becomes a "three-sector portfolio"; top two about 45% a
  "two-sector portfolio by construction". A top five of about 57% was called balanced.

### OT-12 Market-cap skew
- **Seen on:** slides 4, 7, 8, 10, 11, 15, 17, 19, 20.
- **Evidence:** large, mid, small (and others) share of the equity sleeve; per book where a family has several.
- **Trigger implied:** large cap about 60% or more is "large-cap oriented" (add mid and small through active
  funds or PMS); mid plus small about 70% or more "lifts growth potential but deepens drawdowns"; a balanced mix
  prompts a deeper look ("appears balanced; however a deeper analysis reveals...").
- **Note:** the recommendation "build large cap through index funds, keep active management for mid and small
  caps" is applied on slides with high and with low large-cap shares alike, so it is a house view (OT-28), not
  a consequence of the skew.

### OT-13 Entity and account structure within a family
- **Seen on:** slides 2, 11, 12, 14 to 16.
- **Evidence:** each entity's or account's share of the family book and its product mix; the same scheme held
  in several accounts; each account's largest position and whether that fund is a laggard; side-by-side
  metrics for two books (for example a family book and a corporate book).
- **Reasoning:** E: {entity} holds {entity_pct} of the family book; {scheme} appears in {n_accounts} accounts.
  D: the family's risk sits with one entity / one scheme is duplicated across accounts. I: {implication}. A:
  review account-level construction, not only the consolidated view.
- **Phrasing:** "The smallest portfolio in the family is carrying its biggest single bet in one of the weaker
  funds on the shelf." (account-level largest position that trails its benchmark).

### OT-14 Missing or under-weight asset classes, and single-asset-class risk
- **Seen on:** slides 4, 5, 7, 9, 12, 13, 15, 16, 18, 19, 20, 21.
- **Evidence:** absence or small weight of debt, bonds or NCDs, gold or commodities, global equity, REITs or
  InvITs, PMS, AIFs, unlisted, PE or VC; equity share of the book.
- **Trigger implied:** absent (0%) or under about 2% to 5%; "underweights rather than absences" is used when a
  class exists but is small.
- **Reasoning:** E: {asset_class} is {pct} of the book. D: the portfolio depends on one return driver. I: a
  broad equity drawdown moves almost the whole book together. A: build strategic sleeves with target ranges and
  rebalancing rules (equity for growth, high-quality debt for income and stability, gold for diversification).
- **Caution:** deck B attaches the same dated geopolitical paragraph to this finding on five slides. That
  paragraph belongs in the monthly market-update block, dated and sourced, not inside a client observation.

### OT-15 Debt sleeve: yield drag, quality, duplication, credit concentration
- **Seen on:** slides 1, 4, 9, 17.
- **Evidence:** share of the debt sleeve in arbitrage, liquid, money market, overnight, low and ultra short
  duration; average yield to maturity and duration; share of sovereign and AAA or A1+; number of debt schemes
  doing the same job (several liquid, money market and arbitrage funds; several roll-down target maturity
  funds; overlapping banking and PSU and corporate bond funds); a small debt sleeve that sits mostly in one
  credit risk fund.
- **Trigger implied:** low-yield share above half the debt sleeve (the engine uses 50% with debt at 10% of the
  book or more); duplication when three or more debt schemes share an objective.
- **Reasoning:** "Debt keeps capital safe but adds little return" / "The debt sleeve itself is well built and
  is not the concern. The real issue is fragmentation." Action: consolidate into a tighter set of
  differentiated mandates; if there is no near-term liquidity need, consider higher-yielding debt options from
  the product bank.

### OT-16 Risk-profile fit
- **Seen on:** slides 17, 18 (conditional language), 19 ("an aggressive risk profile").
- **Evidence:** equity, hybrid and debt shares against the client's risk appetite.
- **Phrasing:** conditional: "if the family's risk appetite is higher, the equity sleeve is materially
  under-weight"; "if the family's horizon and risk appetite allow, gradually rotating part of the debt book..."
- **Data needed:** the analyst-selected IPS profile (today a UI-only control).

### OT-17 Liquidity and lock-in
- **Seen on:** slides 2, 8, 17, 19.
- **Evidence:** open-ended share; locked-in instruments and their weight.
- **Phrasing:** "{open_pct} of the portfolio is in open-ended funds; only {locked_item} ({locked_pct}) is
  locked in." Usually framed as a positive or a constraint on rebalancing.

### OT-18 Headline performance and attribution by sleeve or product
- **Seen on:** slides 2, 3, 5, 7, 9, 10, 12, 18, 21.
- **Evidence:** portfolio XIRR since inception (including redeemed funds) against a blended benchmark XIRR,
  gap in basis points, absolute return; the same for equity, hybrid, debt sleeves and for PMS, MF, bonds,
  unlisted; "excluding PMS, the portfolio only matches its benchmark".
- **Reasoning:** E: {portfolio_xirr} against {benchmark_xirr}, {gap_bps} basis points. D: benchmark-beating,
  but the excess is carried by {sleeve} rather than the large {main_sleeve} book. I: performance depends on a
  narrow part of the book. A: strengthen the weak sleeve rather than add products.
- **Data quality:** the same basis on both sides (transaction XIRR against benchmark XIRR of the same flows);
  deck B mixes a CMV-weighted figure with a since-inception XIRR on two slides.

### OT-19 Return concentration: contributors and drags
- **Seen on:** slides 2, 9, 10, 12, 14, 16.
- **Evidence:** contribution of each holding (weight times XIRR); the top one or two contributors' share of the
  total against their share of the book ("close to half the total return from just over a quarter of the
  book"); a single holding's share (for example an unlisted stake); negative contributors and their combined
  cost in points.
- **Phrasing:** "{fund} is {weight_pct} of the portfolio but the largest contributor to return
  ({contrib_pts} points, XIRR {xirr} against {bm_xirr} for its benchmark)."

### OT-20 Fund selection
- **Seen on:** slides 2, 3, 9, 10, 11, 12, 14, 16, 18, 21.
- **Evidence:** (a) holdings behind their own benchmark on the client's cash flows: count, worst gaps, and the
  share of the book they hold ("nearly half the portfolio's active fees are buying below-benchmark outcomes");
  (b) trailing 1, 3 and 5 year returns against the category benchmark, and **persistence**: the same funds
  lagging on two or more tenors are "long-running laggards", which "warrant a switch decision rather than
  continued monitoring"; (c) **weight against quality** inside a category ("the better small cap managers are
  carrying the smaller cheques"); (d) alpha, Sharpe and downside capture against the category, always with a
  materiality qualifier ("though at {amount} it barely moves the portfolio"); (e) occasionally fund size (AUM)
  as a reason a strategy's flexibility has eroded.
- **Trigger implied:** any XIRR shortfall is counted; a gap that also shows on trailing tenors turns a watch
  into a switch.

### OT-21 Under-sized winners
- **Seen on:** slides 5, 9, 12, 20.
- **Evidence:** a small sleeve (commodity, global) with the best return in the book.
- **Phrasing to keep:** "the allocation has been right in direction but too small". **Phrasing to avoid:**
  "a significant missed opportunity ... could have substantially enhanced returns" (hindsight, implies chasing
  a past winner).

### OT-22 Direct equity against professionally managed sleeves
- **Seen on:** slides 6, 19, 21.
- **Evidence:** absolute return of the direct-equity book against the mutual fund book; blended equity return;
  a PMS performance table (1Y, 2Y, 3Y, 5Y, since inception, market-cap mix) against Nifty 50, Midcap 150 and
  Smallcap 250 TRI.
- **Data quality:** the PMS slide concludes that all PMS beat the direct portfolio but shows no direct-portfolio
  row, and its PMS data is several months older than the portfolio date. The rule requires the comparison row
  and the data date.

### OT-23 Drawdown and recovery comparison
- **Seen on:** slide 13.
- **Evidence:** drawdown-from-peak series for Nifty 50, Midcap 150, Smallcap 250 TRI and a multi-asset
  portfolio over about ten years; table of peak date, maximum decline, recovery date, days and months to
  recover.
- **Data quality:** "days to recover" on the slide is counted from the trough, not from the peak shown, and the
  trough date is missing; the multi-asset series is not identified as the client's or a model portfolio.

### OT-24 Timing of inflows and track-record maturity
- **Seen on:** slides 1, 2, 9, 10, 19.
- **Evidence:** share of invested money put in during the last year; money invested on a few dates; holding
  period behind each XIRR; annualised return against return since purchase for short holdings; funds in one
  category bought in the same market phase; recent additions that are too young to judge; exit load on a recent
  position.
- **Phrasing:** "A short, weak stretch looks bigger when annualised: {fund} shows {xirr} a year but
  {abs_return} since purchase. One period is not a thesis, and managers are better judged over a full market
  cycle." / "too young to judge, but currently diluting returns" / "We would suggest revisiting this after a
  couple of quarters."

### OT-25 Data and valuation quality
- **Seen on:** slides 2 (speaker notes), 5, 16, 21.
- **Evidence:** alternative holdings whose invested and market values have not moved (stale valuation);
  group-level XIRR rows that do not reconcile with their components and were therefore not used.
- **Use:** these become data-quality flags and audit notes; they suppress or qualify other observations.

### OT-26 What is working
- **Seen on:** slides 2, 7, 9, 10, 17, 19.
- **Examples:** within the AMC cap; nearly all open-ended; a sleeve clearly ahead of its benchmark ("the return
  engines are working"); debt quality and duration well contained; a sensible active and passive blend;
  low-overlap funds that add genuinely different drivers; a quiet outperformer (bonds).
- **Use:** the Review Snapshot needs a "what is working" list; deck B places these inside the same bullets as
  the weaknesses ("benchmark-beating, but...").

### OT-27 Rebalancing outcome (With Rebalancing only)
- **Seen on:** slide 3 (closing bullet).
- **Evidence:** fund count before and after; asset allocation unchanged; combined active share before and
  after; overlap with the Nifty 500 before and after; share now in index funds; the exited funds' combined
  record against their benchmarks.
- **Phrasing:** "The proposed rebalancing follows this logic rather than simply cutting line items. The
  {n_before} active funds become {n_after} without changing the asset allocation..." and an honest trade-off:
  "Overlap with the Nifty 500 eases only modestly, from {pre} to {post}, and that is by design."

### OT-28 House views and market context (content blocks, not observations)
- **Seen on:** slides 4, 7, 9, 10, 11, 13, 15, 16, 19, 20.
- **Content:** core-satellite (index the large-cap core, active MF, PMS or AIF for mid and small caps); strategic
  sleeves (debt, gold, global, real assets, alternatives); the claim that the Nifty rarely delivers negative
  returns over five and seven years; geopolitical context; product suggestions (Hybrid SIFs, debt PMS, AIFs,
  bonds, NCDs, MLDs) with yield expectations.
- **Treatment:** keep as reusable, dated, sourced blocks attached only when a triggering observation fires; the
  rolling-return claim needs its own computed statistic; product yield claims must come from the product bank.

---

## 3. Reasoning chain: how deck B composes a bullet

The dominant bullet skeleton (most visible on the dashboard-frame slides):

```
**{Diagnosis stated as a short claim}.** {Evidence 1 with a number} and {evidence 2 with a number},
so {implication in plain words}. {Action to consider, or the decision it raises}.
```

- **Evidence** always names this client's funds, sleeves or accounts and quotes two to four figures.
- **Diagnosis** is a short, quotable claim that would be false for a different client ("Three balanced
  advantage funds behave like one.", "Different labels, same companies.", "Debt keeps capital safe but adds
  little return.", "Direct equity, not the professionally managed sleeves, is what is holding the portfolio
  back.").
- **Implication** is introduced by "so", "which means", "meaning", or a ratio translation ("about {x} times",
  "the average stock is bought through {n} different schemes", "{share} of the total return from {weight} of
  the book").
- **Action** uses a small verb set: consolidate, trim toward the cap, redeploy into houses already held,
  replace persistent laggards, index the core, establish a sleeve, revisit after a couple of quarters, make a
  switch decision rather than continue monitoring.
- **Contrast openers** carry the "deeper analysis" move: "The market cap mix looks balanced ..., so the real
  risk is not concentration but fragmentation."; "appears balanced ... However, a deeper analysis reveals ...".
- **Synthesis bullet** closes a section: "The main weakness is not insufficient holdings, but too many
  overlapping and low-impact positions."; "Simplify before adding new products: ...".
- **Ordering:** by money affected, largest first; construction and risk on slide 1/2, performance, timing and
  takeaway on slide 2/2.

---

## 4. Tone and phrasing patterns

**Keep**
- Plain, direct, professional sentences; first person plural for recommendations ("we would consolidate").
- Numbers to two decimals for percentages; "about", "roughly", "close to" for rounded figures; basis points for
  small gaps ("roughly 81 basis points"); "{x} of the {y} holdings" for counts; ranges written "38% to 45%".
- Materiality qualifiers on fund-level points that do not move the book.
- Explicit uncertainty where the data is thin ("too young to judge", "not yet enough of a track record").
- Conditional framing for anything that depends on the client's risk appetite or liquidity needs.

**Avoid (all seen in deck B)**
- Verbatim boilerplate across clients (dated geopolitics; "allocating less than 2% at the portfolio level
  leads to over-diversification ..."; "the Nifty has a low probability of delivering negative returns over 5-
  and 7-year periods").
- Hindsight ("missed opportunity", "could have substantially enhanced returns").
- Unsupported product claims (target gross yields of alternative products) and claims without the comparison
  on the slide.
- Jargon or loaded labels ("spray and pray").
- En and em dashes in titles and text (found on 12 slides and in all four chart series names), and three
  different ways of writing a negative number (hyphen, U+2212 minus, the word "minus").
- Mixed bases (a CMV-weighted contribution quoted against a since-inception XIRR).
- Personal names and honorifics for family members; use the account or entity label the analyst assigns.
- Spelling slips that a style check would catch ("susceptible systematic risk", "ReITs/InVITs").

---

## 5. Layout patterns

- **Two-slide split** for one portfolio: "PORTFOLIO OBSERVATIONS: CURRENT PORTFOLIO (1/2)" covers construction,
  overlap, concentration and allocation gaps; "(2/2)" covers performance, contribution, timing, liquidity and
  the takeaway. Topic-titled single slides are used for a deep dive ("OVERDIVERSIFICATION & OVERLAP",
  "DRAWDOWN COMPARISON", "EQUITY PMS PERFORMANCE ANALYSIS").
- **Section headings:** numbered ("1. High Equity Concentration & Market Cap Skew:") in the manual template;
  underlined run-in headings ("Overdiversification and Overlap:") in the dashboard frame. Typical section set:
  construction and overdiversification; concentration and market-cap skew; debt; missing asset classes;
  performance; takeaway.
- **Bullets:** 5 to 8 per section, one blank line between bullets, bold lead sentence or bold key figures.
- **Source line:** 8 pt italic at the foot ("Portfolio as on {date}. XIRR vs benchmark XIRR: client
  transactions since {first_flow_month}. Overlap: screener holdings as on {date}; indices proxied by index fund
  holdings."). Speaker notes record the method.
- **Charts:** at most two per slide, placed above a shorter text block; data labels on; legend at the bottom;
  no gridlines; tan and grey for paired series.
- **Recommended for the new build:** one text box per section (editable), body 10 to 11 pt so that about 450
  words fit; overflow continues on a "(2/2)" slide rather than shrinking the font (the current SWOT exporter
  steps the font down to 7 pt, audit NEW-32).

---

## 6. Draft observation rule bank

### 6.1 Shared definitions

**Observation record** (one per fired rule; the analyst edits `text` without touching `evidence`):

```
{ id, ruleId, ruleVersion, mode: "RO" | "RB" | "both", section, materiality (0 to 100),
  severity: "positive" | "watch" | "attention" | "action",
  evidence: [{ metric, value, unit, sourceField, asOf, coveragePct }],
  dataQuality: { status, notes },            // statuses from the brief: NOT AVAILABLE IN SUPPLIED DATA,
                                             // PARTIAL COVERAGE, STALE DATA, INSUFFICIENT EVIDENCE, ...
  textGenerated, textEdited, editedBy, editedAt, suppressedReason }
```

**Threshold table** (one place, owner-approved; values below are the defaults proposed from deck B and the
current engine):

| Key | Proposed default | Seen in deck B | Engine today |
|---|---|---|---|
| `small_position_pct` | 1.50 | 1.50, 2, 3 | 1.50 (SWOT), 2 (AI Analyst floor) |
| `amc_cap_pct` | 20 (mutual fund book, OD-1) | 20 | 20 |
| `amc_top2_watch_pct` | 33 | "more than a third" | none |
| `overlap_pair_high_pct` / `very_high` | 30 / 50 | 30 counted, about 40 quoted | 40 (SWOT); 15/30/50 bands |
| `multiplicity_flag` / `headline` | 2.0 / 2.5 | about 2 mentioned, 3 headline | none |
| `label_drift_large_pct` | 65 (of the equity sleeve) | mid 40s to high 70s, inconsistent | none |
| `sleeve_active_share_low_pct` | 50 | just under 50 called duplication | none |
| `top10_high_pct` / `top10_low_pct` | 60 / 20 | about three quarters (high); about 15 (low) | 60 (high only) |
| `top3_sector_pct` / `single_sector_pct` | 50 / 35 | close to 60 called three-sector | 50 / 35 |
| `large_cap_led_pct` / `mid_small_tilt_pct` | 60 / 55 | about two thirds and above / about three quarters | 60 / 55 |
| `asset_absent_pct` / `asset_under_pct` | 2 / 5 | 0 to about 3 | 5 (2 for REITs) |
| `low_yield_debt_pct` (debt at least 10% of book) | 50 | about 70 to over 90 | 50 |
| `recent_money_pct` / `young_holding_months` | 50 / 12 | most money in the last 2 to 9 months | none |
| `laggard_gap_pp` (to name a fund) | 0 (count), 1.0 (name) | any shortfall | any shortfall (SWOT); 2 pp red (AI Analyst) |
| `persistence_tenors` | 2 of 1Y/3Y/5Y | "lags on both 3 and 5 year" | one bullet per tenor |
| `winner_xirr_pct` / `winner_weight_pct` | 20 / 5 | | 20 / 5 |
| `materiality_min_weight_pct` | 1.0 | "barely moves the portfolio" | none |
| `index_outcome_gap_bp` | 25 | about 1 bp on one slide | none |

**Composition rules** (apply to every rule):
1. A sentence is emitted only if every placeholder in it is filled from `evidence`; otherwise the clause is
   dropped, and if the core metric is missing the rule records `NOT AVAILABLE IN SUPPLIED DATA` and stays silent
   in the deck.
2. Coverage below 80% of the relevant CMV adds a qualifier ("across the {coverage_pct} of equity with
   look-through data"); below 50% the rule does not fire and records `PARTIAL COVERAGE`.
3. Rules are ranked by materiality (share of the book affected times severity); the deck shows the top 6 to 8
   per slide and the rest go to the Excel Observations sheet.
4. One rule, one sentence family: a later rule that restates a fired rule's evidence is suppressed (prevents the
   duplication deck B shows between slides of the same client).
5. No en or em dashes, no hindsight verbs, no product yield claims unless the product bank supplies them with a
   source and date.

### 6.2 Construction and diversification

**DIV-01 Fund multiplicity (overdiversification)**
- Inputs: `equityAnalytics.totalStockCount`, `equityAnalytics.uniqueStockCount`, `uniqueStockSrc`, count of
  equity and hybrid holdings with look-through (`equityAnalytics.funds`), `equityAnalytics.excluded`.
- Trigger: `total/unique >= multiplicity_flag`; headline at `>= multiplicity_headline` or with 12 or more
  equity schemes.
- Metrics: multiplicity, fund count, SEBI category count, top-10 share (from CON-04/05).
- Data quality: look-through coverage of equity CMV at least 80%; PMS look-through flagged if absent.
- Narrative: E "The {fund_count} equity and hybrid funds hold {total_positions} stock positions in only
  {unique_companies} companies." D "so each company is held {multiplicity} times on average." I "Each extra
  fund mostly re-buys names already owned, and the managers' different calls start to cancel out." A "Fewer
  funds, each with a distinct job, would keep the same exposure at lower cost and complexity."
- Modes: RO and RB (RB adds after-proposal multiplicity).
- Engine today: **Exists** (counts, shown as KPI tiles on the equity analytics slide, sheet and tab); ratio and
  narrative **Missing** (no observation uses the counts).

**DIV-02 Category stacking**
- Inputs: holdings with canonical category (`REF.MF_PERF[perfKey].sheet` or `REF.FUND_RANKS[...].cat`), `cmvCr`.
- Trigger: any category with 2 or more schemes; headline when 3 or more, or stacked categories at least 30% of
  the equity book.
- Narrative: E "{category_count_list}." D "Each extra fund in a category the client already owns largely buys
  the same stocks again." I "{stacked_pct} of the equity book sits in categories held two or more times." A
  "Keep the strongest one or two funds per category."
- Modes: both. Engine today: **Partial** (base-file `category` is free text; canonical category exists only via
  REFDATA lookups in the AI Analyst).

**DIV-03 High-overlap pair**
- Inputs: `overlap.matrix`, `overlap.funds`, `overlap.meta`, AI Analyst composite for "which is weaker".
- Trigger: any pair at or above `overlap_pair_high_pct`.
- Narrative: E "{fund_a} and {fund_b} share {pair_pct} of their holdings." D "Two active fees are being paid for
  substantially the same portfolio." A "Consolidating into {stronger_fund} keeps the exposure with one fee."
- Modes: both. Engine today: **Exists** (SWOT names the top pair above 40%; AI Analyst overlap signal names the
  counterparty).

**DIV-04 Overlap cluster statistics and hub fund**
- Inputs: `overlap.matrix` (upper triangle), fund weights.
- Trigger: at least 8 funds in the matrix and (mean pairwise overlap at least 20% or pairs at 30% or more at
  least 15% of pairs); hub when one fund's average overlap with the rest is at least 1.3 times the mean.
- Narrative: "The average pair of funds shares {mean_pair_pct} of its holdings, and {pairs_30} of the
  {pairs_total} pairs share 30% or more." / "{hub_fund} sits at the centre of the overlap: it shares
  {top3_overlap_list}, and {hub_avg_pct} on average with the other {n_others} funds."
- Modes: both. Engine today: **Missing** (an analyst computed these by hand from the matrix image).

**DIV-05 Same-category cluster behaving as one**
- Inputs: overlap within a category group, purchase dates (TIME-02), XIRR of each.
- Trigger: 3 or more funds in one category with every pairwise overlap at least 30%.
- Narrative: "{n} {category} funds behave like one: they share {min_pct} to {max_pct} of their holdings with each
  other{_and_with_index}. Holding {n} did not spread the risk."
- Modes: both. Engine today: **Missing**.

**DIV-06 Low-overlap differentiators (positive)**
- Inputs: average overlap of each fund against the rest.
- Trigger: funds with average overlap under 15% holding at least 5% of the book.
- Narrative: "{fund_list} ({pct_of_book}) share only {min_pct} to {max_pct} of their holdings with the other
  funds, so they add genuinely different drivers."
- Modes: both (feeds "what is working"). Engine today: **Missing**.

**DIV-07 Hidden large-cap exposure (label drift)**
- Inputs: per-fund market-cap split of the equity sleeve (`REF.EQUITY_ANALYTICS[eqKey].mcap`,
  `REF.HYBRID_ANALYTICS[hyKey].eq.mcap`, or `REF.MF_PERF[perfKey].mcap`), canonical category, `cmvCr`.
- Trigger: non-large-cap categories (flexi, focused, multi, contra, value, ELSS, thematic, hybrid) with large
  cap at or above `label_drift_large_pct` of the **equity sleeve**; fire when 2 or more such funds or at least
  10% of the mutual fund book.
- Narrative: E "{fund_list} carry {range} large cap." D "They are effectively large cap funds wearing different
  category labels." I "Together they hold {pct_of_mf_book} of the mutual fund book in a segment where the top
  100 names are common to almost every scheme." A "Large cap is better held deliberately, through one low-cost
  index fund and one high-conviction manager."
- Modes: both. Engine today: **Partial** (inputs exist in REFDATA; not attached per holding in the model).

**DIV-08 Fund active share against its category index**
- Inputs: fund holdings (`REF.EQUITY_ANALYTICS[eqKey].stocks`), index proxy holdings (an index fund for the
  category benchmark in `REF.MF_CAT_BM`), name normalisation (`normCo`).
- Metric: active share = 100 minus the sum of min(fund weight, index weight).
- Trigger: active fund with active share under 40%, or a large-cap active fund with negative three-year alpha
  (`REF.MF_RISK[perfKey].alpha`).
- Narrative: "{fund} holds about {index_like_pct} of its portfolio in line with the {index}, and the large cap
  sleeve has a weighted three-year alpha of {alpha}: active fees for index-like holdings."
- Modes: both. Engine today: **Missing** (data exists: 107 index funds, full holdings; a category to proxy-fund
  map is needed).

**DIV-09 Combined sleeve active share and book overlap with the broad index**
- Inputs: CMV-weighted union of holdings per sleeve (the engine's internal `eq_stock` vector, exported in full),
  index proxies.
- Trigger: sleeve active share under `sleeve_active_share_low_pct`, or below the lowest single fund's active
  share by 10 points or more.
- Narrative: "Individually the {n} {category} funds are {min_as} to {max_as} different from the {index};
  combined, the sleeve is only {sleeve_as} different, so more than half of it now duplicates the index." /
  "By weight, {book_index_overlap} of the equity book is held exactly as the Nifty 500 holds it."
- Modes: both; in RB it is reported before and after. Engine today: **Missing** (only the top 20 aggregated
  stocks are exported).

**DIV-10 Index outcome at active fees**
- Inputs: portfolio fund XIRR and benchmark XIRR from the IRR file (`model.irr`, total level), share of the book
  in active funds, holdings behind benchmark (PERF-05).
- Trigger: `abs(portfolio_xirr - benchmark_xirr) <= index_outcome_gap_bp` and active share of the book at least
  80%.
- Narrative: "Since {first_flow_year} the portfolio has compounded at {xirr} a year against {bm_xirr} had the
  same cash flows gone into each fund's own benchmark. The return has come from the markets the money was
  invested in rather than from which funds were chosen: the client is paying active fees and receiving an index
  outcome."
- Data quality: transaction IRR file required; mark `INSUFFICIENT EVIDENCE` if the earliest flow is under three
  years old. Modes: both. Engine today: **Partial** (figures exist; rule missing).

**DIV-11 Sub-scale positions (fragmentation)**
- Inputs: `holdings[].cmvCr`, `totalCMV`; aggregation level per owner decision (scheme across the family, or
  account row).
- Trigger: 3 or more holdings below `small_position_pct`.
- Narrative: "{n_small} of the {n_holdings} holdings each sit below {small_pct} of the portfolio, the smallest
  {min_pct}. Positions this size add line-item complexity without changing the overall exposure and are
  natural candidates to fold into larger holdings."
- Modes: both. Engine today: **Exists** (SWOT weakness and opportunity at 1.50%; AI Analyst weight floor 2%).

### 6.3 Allocation

**ALL-01 Effective equity against labelled equity**
- Inputs: `equityAnalytics.exposureCr`, `totalCMV`, labelled equity share from `assetAllocation.rows`, hybrid
  CMV and equity sleeve weights.
- Trigger: effective minus labelled at least 10 percentage points of the book.
- Data quality: must use **net** directional equity for arbitrage and balanced advantage funds (gap G-6);
  report look-through coverage.
- Narrative: "Hybrid funds are the biggest holding, and they carry more equity than the label shows: they are
  {hybrid_pct} of the portfolio and hold about {hybrid_eq_pct} in stocks, so around {effective_eq_pct} of the
  portfolio moves with the equity market, against {labelled_eq_pct} shown as equity."
- Modes: both. Engine today: **Partial** (exposure exists; it counts arbitrage funds' hedged equity, a median
  71% of their CMV, as equity; verified in REFDATA and at `07_engine.js:1005`).

**ALL-02 Single asset-class dominance**
- Inputs: `assetAllocation.rows` (asset level), effective equity (ALL-01).
- Trigger: one asset class at least 85% of the book (engine), or effective equity at least 90%.
- Narrative: "The portfolio is {pct} {asset_class}, {profile_phrase}. Concentration in one asset class leaves
  it exposed to systematic risk that no amount of scheme-level diversification can offset: a broad drawdown
  moves almost the entire book together." Attach HV-03 only as a dated block.
- Modes: both. Engine today: **Exists** (SWOT concentration fact; profile phrase thresholds 85/60/40).

**ALL-03 Missing or under-weight asset class** (one instance per class)
- Inputs: shares of debt (standalone), gold and commodities, global equity, REITs and InvITs, PMS and AIF,
  bonds and NCDs held directly, unlisted.
- Trigger: share under `asset_absent_pct` (absent) or under `asset_under_pct` (under-weight), and the class is
  within the client's IPS range (if an IPS profile is set and the range minimum is 0%, phrase as an option).
- Narrative: "There is no {asset_class} allocation{_today}. {role_sentence_from_bank}." The role sentence comes
  from a fixed bank keyed by class (debt: income and cushioning; gold: holds up when equity and debt are both
  under pressure; global: other economies, sectors and currencies).
- Modes: both; in RB, state whether the proposal adds the class. Engine today: **Partial** (computed inside
  SWOT, not exported; global exposure detected by a name regex, not by category).

**ALL-04 Narrow international exposure**
- Inputs: global holdings and their country or region focus.
- Trigger: all global exposure in one single-country fund.
- Narrative: "Global equity is limited to a single {country} focused fund at {pct}, giving country-specific
  rather than broad international diversification."
- Modes: both. Engine today: **Missing** (no country field; needs a product-bank attribute).

**ALL-05 Market-cap skew**
- Inputs: `equityAnalytics.mcap`; IPS ranges for large, mid, small (`getIPSData`, UI).
- Trigger: large cap at least `large_cap_led_pct`, or mid plus small at least `mid_small_tilt_pct`, or outside
  the IPS range for the selected profile.
- Narrative: E "Within equity, large cap is {lc}, mid cap {mc} and small cap {sc}." D "{skew_phrase}." I (large
  led) "growth drivers are narrow" / (mid and small tilt) "that mix lifts growth potential but also deepens
  drawdowns". A "{action_from_house_view}".
- Modes: both. Engine today: **Exists** (skew phrase in Current Portfolio; IPS comparison in the UI).

**ALL-06 Risk-profile fit**
- Inputs: analyst-selected IPS profile, effective equity, debt, hybrid shares.
- Trigger: equity or debt outside the profile's range.
- Narrative: conditional: "If the family's risk appetite is {higher_lower} than this {profile_phrase}
  positioning suggests, the {sleeve} sleeve is materially {under_over}-weight."
- Data quality: no profile selected means the rule stays silent (`NOT AVAILABLE IN SUPPLIED DATA`).
- Modes: both. Engine today: **Partial** (IPS lives in the UI only; the engine deliberately does not generate
  it).

**ALL-07 Liquidity and lock-in**
- Inputs: `liqPie`, `holdings[].liquidity`, product class.
- Trigger: positive when open-ended at least 95%; attention when close-ended or locked-in at least 20%.
- Narrative: "{open_pct} of the portfolio is in open-ended funds; only {locked_list} ({locked_pct}) is locked
  in." / "Close-ended or structured instruments are {locked_pct}; their lock-in and redemption windows shape
  what can be rebalanced."
- Modes: both; RB uses it as an execution constraint. Engine today: **Exists**.

### 6.4 Concentration

**CON-01 AMC cap breach**
- Inputs: `amc.rows`, `amc.breaches`, `amc.mfTotal`.
- Trigger: any house above `amc_cap_pct` of the mutual fund book.
- Narrative: "{amc} runs {pct} of the mutual fund book, past the {cap}% per-house cap. A fund-manager exit,
  process change or strategy drift at that house would move the whole portfolio. Trimming toward the cap and
  redeploying into quality houses already held ({dest_list}) would cut house-level risk without disturbing the
  asset mix."
- Modes: RO states the breach and the consideration; RB quantifies the house share after the proposal.
- Engine today: **Exists** (Current Portfolio and Threats; AI Analyst impact signal).

**CON-02 Top-two houses combined, or near the cap**
- Inputs: `amc.rows`.
- Trigger: top two combined at least `amc_top2_watch_pct`, or the largest within 2 points of the cap.
- Narrative: "{amc_1} at {pct_1} and {amc_2} at {pct_2}: neither breaches the cap, but together they are more
  than a third of the mutual fund book. New money is better directed to houses outside these two."
- Modes: both. Engine today: **Missing** (trivial from existing rows).

**CON-03 Single product structure, or several books in one asset class**
- Inputs: `assetAllocation.rows` (product level), product class per holding.
- Trigger: one product at least 85% (engine), or one asset class split across 3 or more product types each at
  least 5%.
- Narrative: "The portfolio is built entirely through {product}, {n_schemes} schemes and a single product
  structure. This keeps the book open-ended and liquid, but every return driver, and every risk, runs through
  one product type." / "The family book is {eq_pct} equity, and it is not one equity book, it is {n_books}:
  {book_list}."
- Modes: both. Engine today: **Exists** (single product); multi-book phrasing **Missing**.

**CON-04 Top-10 stock concentration**
- Inputs: `equityAnalytics.stocks` (top 20).
- Trigger: top 10 at least `top10_high_pct` of the equity sleeve, or a single stock at least 10%.
- Narrative: "The top 10 holdings are {top10_pct} of the equity portfolio, exposing it to significant
  concentration risk."
- Modes: both. Engine today: **Exists** (SWOT weakness; the hybrid stock double-scaling of audit NEW-9 is fixed
  in the code under KI-055).

**CON-05 Top-10 dilution with a long tail**
- Inputs: as CON-04, plus count of stocks under 1% of equity.
- Trigger: top 10 at most `top10_low_pct` and DIV-01 fired.
- Narrative: "The top 10 underlying stocks are only {top10_pct} of equity, with a long sub-1% tail, so the real
  risk is not concentration but fragmentation: no single idea is large enough to lift the result."
- Modes: both. Engine today: **Missing**.

**CON-06 Sector concentration**
- Inputs: `equityAnalytics.sectors`; share of sectoral and thematic funds.
- Trigger: top three at least `top3_sector_pct`, top two at least 45%, or one sector at least
  `single_sector_pct`.
- Narrative: "{s1} at {p1} and {s2} at {p2} together make {p12}{_and_s3}, so the portfolio effectively operates
  as a {n}-sector portfolio{_by_construction}." Add "by construction" when sectoral funds are at least half of
  that exposure.
- Modes: both. Engine today: **Exists** (three-sector and single-sector facts); "by construction" **Missing**.

**CON-07 Entity concentration within a family**
- Inputs: `clients[]` (name, totalCMV, product mix), `allocByClient`.
- Trigger: 2 or more clients and one holds at least 60%, or one entity holds a single asset class only.
- Narrative: "{entity_label} holds {pct} of the family book{_mix_note}; {other_entities} hold {rest_pct}."
  Entities are referred to by the label the analyst sets (for example "Entity A", "Company", "Account 3"), never
  by personal name.
- Modes: both. Engine today: **Exists** (per-client totals); rule **Missing**.

**CON-08 Same scheme across accounts**
- Inputs: holdings grouped by `perfKey` across `client` (the AI Analyst's `aiaPositions` merge), `overlap.meta.clients`.
- Trigger: a scheme held in 2 or more accounts.
- Narrative: "{scheme_list} each sit in {n} of the {n_accounts} personal accounts."
- Modes: both. Engine today: **Partial** (merge exists in the AI Analyst).

**CON-09 An account's largest position is a weak fund**
- Inputs: per-client largest holding, its XIRR gap and trailing gaps.
- Trigger: the largest position in an account is at least 10% of that account and trails its benchmark by at
  least 1 pp.
- Narrative: "In {account_label}, the single largest position, at {pct}, is {fund}, a fund lagging its own
  benchmark by roughly {gap_bps} basis points since purchase."
- Modes: both. Engine today: **Missing**.

### 6.5 Debt

**DEBT-01 Low-yield liquidity buckets**
- Inputs: debt holdings' canonical category, `debtAnalytics.avgYTM`, `avgModDur`.
- Trigger: debt at least 10% of the book and low-yield share at least `low_yield_debt_pct`.
- Narrative: "{low_yield_pct} of the debt sleeve sits in liquid, money market, arbitrage and ultra short funds,
  with an average duration of {dur} years and a yield of {ytm}. It protects capital and keeps cash within reach,
  but it will not add much to returns. If there is no near-term liquidity need, part of it can move to
  higher-yielding options from the product bank."
- Modes: both. Engine today: **Exists** (SWOT weakness; category matched by regex on name and category).

**DEBT-02 Debt quality summary**
- Inputs: `debtAnalytics.ratings`, `avgYTM`, `avgModDur`.
- Trigger: debt at least 5% of the book; positive when sovereign plus AAA/A1+ at least 70%.
- Narrative: "The debt sleeve itself is well built: sovereign and AAA or A1+ paper make up {hq_pct}, average
  yield to maturity is {ytm} and modified duration {dur} years, so credit and interest-rate risk are well
  contained."
- Modes: both. Engine today: **Exists** (Current Portfolio sentence at 50%).

**DEBT-03 Debt scheme duplication**
- Inputs: debt holdings' category, target maturity (from scheme name or product bank), issuer overlap
  (`REF.DEBT_ANALYTICS[...].issuer`), arbitrage fund overlap (equity sleeves).
- Trigger: 3 or more debt or arbitrage schemes sharing an objective (liquidity; roll-down maturing within the
  same three years; banking and PSU or corporate bond).
- Narrative: "The debt and arbitrage allocation is spread across roughly {n} schemes that often do the same job:
  {group_list}. Consolidating these into a tighter set of differentiated mandates would cut duplication and ease
  monitoring without giving up yield."
- Modes: both. Engine today: **Missing** (no debt overlap; target maturity not modelled).

**DEBT-04 Small debt sleeve carrying credit risk**
- Inputs: debt holdings' category and ratings.
- Trigger: debt under 10% of the book and at least 60% of it in credit risk funds or AA and below.
- Narrative: "Debt is only {debt_pct} and sits almost entirely in one credit risk fund, which means the
  stabilising sleeve carries credit risk of its own."
- Modes: both. Engine today: **Missing**.

**DEBT-05 No standalone debt sleeve**
- Inputs: asset allocation, hybrid debt sleeves.
- Trigger: standalone debt under `asset_absent_pct` while hybrids hold debt internally.
- Narrative: "The current allocation has no standalone debt sleeve. Hybrid funds hold debt internally but do not
  offer portfolio-level control over duration, credit quality or target weight."
- Modes: both. Engine today: **Missing** (under-representation covers the absence, not this nuance).

### 6.6 Performance

**PERF-01 Headline against blended benchmark**
- Inputs: `model.irr` total row (fund, bench) when `irrActive`; else CMV-weighted grand rows; `totalGL`,
  `totalInv`.
- Trigger: always fires when a basis is available (it is the headline), with a verdict band: ahead at least
  50 bp, in line within 50 bp, behind.
- Data quality: both sides on the same basis; state the basis and first-flow date in the source line; never
  combine a CMV-weighted figure with a transaction XIRR.
- Narrative: "The portfolio has compounded at {xirr} XIRR against a blended benchmark of {bm_xirr}, roughly
  {gap_bps} basis points {ahead_behind}, turning {invested} invested into {current} ({abs_return} absolute
  gain)."
- Modes: both. Engine today: **Exists** (values); validation that absolute return reconciles to invested and
  current value **Missing** (deck B has one slide where it does not).

**PERF-02 Sleeve and product attribution**
- Inputs: XIRR and benchmark XIRR per asset class and per product (client rows `level: asset/product`; family
  level needs flows aggregated across clients).
- Trigger: the sleeve or product with the largest excess return differs from the largest sleeve, or the
  largest sleeve is within 50 bp of its benchmark.
- Narrative: "{best_sleeve} is doing the heavy lifting: {w} of the book at {x} XIRR versus {b}. The
  {largest_sleeve} sleeve, largest at {w2}, returns {x2} against {b2}, so excluding {best_sleeve} the portfolio
  only matches its benchmark."
- Modes: both. Engine today: **Partial** (per-client sleeve rows exist; family-level sleeve XIRR is computed
  inside SWOT on a CMV-weighted basis only).

**PERF-03 Return concentration**
- Inputs: `contribLag.contributors` (contribution = weight times XIRR), CMV-weighted total.
- Trigger: top two contributors at least 40% of total contribution while holding at most 30% of the book; or
  one holding at least 15% of total contribution.
- Narrative: "{f1} at {w1} of the portfolio ({x1} XIRR) and {f2} at {w2} ({x2}) together contribute {c12} of the
  {c_total} points, close to {share_phrase} of the total return from {weight_phrase} of the book. That is
  {skill_or_luck_phrase}, but performance now depends heavily on {n} schemes."
- Data quality: contribution and total on the same CMV-weighted basis.
- Modes: both. Engine today: **Exists** (contributors); share-of-total **Missing**.

**PERF-04 Drags**
- Inputs: `contribLag.drags`.
- Trigger: any negative contribution.
- Narrative: "The {group_label} pulls the other way: {drag_list} together cost {pts} points."
- Modes: both. Engine today: **Exists** (Threats bullet).

**PERF-05 Laggards on the client's own cash flows**
- Inputs: `holdings[].xirrFrac`, `bmxirrFrac`, `cmvCr`.
- Trigger: any holding behind; name those at least `laggard_gap_pp` behind.
- Narrative: "{n_behind} of the {n_with_data} holdings with return data trail their own benchmark{_on_flows}.
  Together they hold {behind_pct} of the {book_label}, so {share_phrase} of the active fees are buying
  below-benchmark outcomes: {top3_list}."
- Data quality: TIME-01 guard (a holding under 12 months shows absolute return, not XIRR).
- Modes: both. Engine today: **Exists** (count and names); weight share **Missing**.

**PERF-06 Persistent trailing laggards**
- Inputs: `performance.buckets` fund and benchmark rows for 1Y, 3Y, 5Y.
- Trigger: a held fund behind its category benchmark on at least `persistence_tenors` tenors.
- Narrative: "{fund_list} lag on both the {tenor_a} and {tenor_b} reading, so they are long-running laggards
  that warrant a switch decision rather than continued monitoring."
- Modes: RO "warrant review"; RB links to the proposal's action for each fund.
- Engine today: **Partial** (one bullet per tenor; no persistence logic).

**PERF-07 Weight against quality inside a category**
- Inputs: held funds in the same canonical category, their weights, trailing returns, `FUND_RANKS`, composite.
- Trigger: within a category, a fund with higher weight trails a lower-weight fund by at least 3 pp on 3Y.
- Narrative: "{weak_list} lag the same benchmark that {strong_list} beat comfortably: the better {category}
  managers are carrying the smaller cheques."
- Modes: both. Engine today: **Missing**.

**PERF-08 Risk-adjusted metrics against the category, with materiality**
- Inputs: `REF.MF_RISK[perfKey]` (alpha, sharpe, sortino, dc, sd), peer basis (see owner question Q8),
  weight.
- Trigger: a fund above or below the peer value on at least two of alpha, Sharpe, downside capture.
- Narrative: "{fund} ranks {above_below} its category on alpha and Sharpe ({alpha} against {alpha_peer},
  {sharpe} against {sharpe_peer}){_downside}{_materiality}."; materiality clause when weight under
  `materiality_min_weight_pct`: "though at {weight} it barely moves the portfolio".
- Modes: both. Engine today: **Exists** (AI Analyst risk signal, medians; MF Analysis uses means).

**PERF-09 Under-sized winner**
- Inputs: sleeve XIRR and benchmark (commodity, global), weight.
- Trigger: sleeve XIRR at least `winner_xirr_pct` and weight under `winner_weight_pct`.
- Narrative: "{sleeve} is {w} of the book yet has been the best performing sleeve at {x} XIRR against {b}, so the
  allocation has been right in direction but small in size. A strategic range, rather than a reaction to past
  returns, would let it matter."
- Modes: both. Engine today: **Exists** (commodity only; current wording uses hindsight).

**PERF-10 Direct equity against managed sleeves**
- Inputs: direct-equity holdings' invested and current value, MF book, PMS book; horizon returns.
- Trigger: direct equity at least 15% of equity and its absolute return or XIRR behind the MF book by at least
  3 pp.
- Narrative: "Direct equity, not the professionally managed sleeves, is what is holding the portfolio back: the
  direct book shows {de_ret} against {mf_ret} for the mutual fund book, pulling blended equity to {eq_ret}."
- Modes: both. Engine today: **Partial** (values exist; no comparison).

**PERF-11 PMS performance against TRI benchmarks (table plus two bullets)**
- Inputs: `REF.PMS_PERF` (r 1Y to SI, aum, inception, mcap), `REF.BENCH_RET`, and the client's direct-equity
  book on the same horizons.
- Trigger: analyst-selected strategies from the product bank, shown only when PERF-10 fires or on request.
- Data quality: the comparison row for the client's book must be present; PMS data date shown; data older than
  the portfolio date by more than one quarter flagged `STALE DATA`.
- Modes: both. Engine today: **Partial** (PMS and index returns exist; direct-equity horizon returns missing).

**PERF-12 Drawdown and recovery**
- Inputs: daily TRI series for the relevant indices; the portfolio's or a named model portfolio's value series.
- Metrics: peak date, trough date, maximum decline, recovery date, days peak to trough, days trough to
  recovery.
- Modes: both. Engine today: **Missing** (no time series in REFDATA; `BENCH_RET` holds trailing returns only).

### 6.7 Timing and data quality

**TIME-01 Recent money and short track records**
- Inputs: IRR file fund flows (`REF.IRR.fund`, dated), `holdings[].purchaseDate`, `days`.
- Trigger: at least `recent_money_pct` of invested money in the last 12 months, or any holding under
  `young_holding_months` quoted with an XIRR.
- Narrative: "Most of the money is new: {recent_pct} was invested in the last {months} months, so annual return
  figures rest on {min_m} to {max_m} months of history. A short, weak stretch looks bigger when annualised:
  {fund} shows {xirr} a year but {abs} since purchase."
- Effect on other rules: PERF-05 and PERF-06 qualify or suppress young holdings.
- Modes: both. Engine today: **Partial** (flows and purchase dates exist; after folio merging only the first
  folio's purchase date is kept).

**TIME-02 Clustered purchases in one market phase**
- Inputs: first-flow date per holding, category.
- Trigger: 3 or more funds in one category first bought within 90 days.
- Narrative: "They were bought in the same market phase, between {d1} and {d2}, and all {n} show {sign}
  returns."
- Modes: both. Engine today: **Missing**.

**TIME-03 Exit constraints on recent positions (RB)**
- Inputs: holding age, exit load schedule, short-term gain (`taxation.positions`).
- Trigger: a proposed exit on a holding inside its exit-load period or mostly short-term.
- Narrative: "Since this is a recent position, exiting now would incur an exit load of {load} and short-term
  gains of {st_gain}; {timing_option}."
- Modes: RB only. Engine today: **Partial** (tax split exists; exit loads are held nowhere).

**DQ-01 Stale valuation**
- Inputs: invested and current value, valuation date per holding (new), product class.
- Trigger: alternative or debt holdings whose current value equals invested value, or whose valuation date is
  older than one quarter.
- Narrative (audit and analyst view, not client text by default): "{holding_list} show no movement between
  invested and market value; their valuations may be stale."
- Modes: both. Engine today: **Missing**.

**DQ-02 Non-reconciling aggregates**
- Inputs: group XIRR rows against components; absolute return against invested and current value.
- Trigger: a group figure differing from its recomputation by more than a tolerance.
- Effect: the group figure is not used in text; an audit record is written. Engine today: **Partial** (coverage
  footnotes exist; no reconciliation test).

**FUND-01 Fund size (owner decision)**
- Inputs: `REF.MF_PERF[perfKey].aum`, category.
- Trigger: owner-set AUM thresholds per category (flexi, mid and small cap).
- Narrative: "With AUM past {aum}, the fund's flexibility advantage may be narrowing." Keep as a watch item.
- Engine today: **Partial** (AUM exists; no rule).

**FUND-02 Manager change watch**
- Inputs: `REF.FUND_MGR` stints. Engine today: **Exists** (AI Analyst rule 5). Narrative unchanged.

### 6.8 What is working (positives feeding the Review Snapshot)

| ID | Trigger | Template | Engine today |
|---|---|---|---|
| POS-01 | largest house under the cap | "The largest fund house is {amc} at {pct} of the mutual fund book, inside the {cap}% limit." | Exists |
| POS-02 | open-ended at least 95% | "{pct} of the portfolio is in open-ended structures, so the family can rebalance or redeem without lock-in constraints." | Exists |
| POS-03 | a sleeve at least 10% of the book and at least 0.5 pp ahead | "The {sleeve} sleeve ({w}) is ahead at {x} XIRR versus {b}: the return engine is working." | Exists |
| POS-04 | index funds 10% to 75% of the mutual fund book | "{pct} of the mutual fund book sits in index funds, a fair balance between keeping costs down and reaching for alpha where it is available." | Exists |
| POS-05 | DEBT-02 positive | as DEBT-02 | Exists |
| POS-06 | DIV-06 | as DIV-06 | Missing |

### 6.9 With Rebalancing only

**REB-01 Construction before and after**
- Inputs: the proposal (AI Analyst plan or analyst plan), recomputed model on the post-trade holdings with the
  same engine.
- Metrics: fund count, active fund count, asset allocation (must be unchanged unless intended), multiplicity
  (DIV-01), sleeve active share (DIV-09), book overlap with the broad index, index-fund share, AMC shares, sub-scale
  count, overlap pairs at 30% or more.
- Narrative: "The proposed rebalancing follows this logic rather than simply cutting line items: the
  {n_before} active funds become {n_after} without changing the asset allocation. {metric_pre_post_list}." Each
  pre/post pair is quoted only when both sides are computed.
- Engine today: **Partial** (AI Analyst has portfolio-level before and after for AMC, weights and overlap; no
  active share or multiplicity).

**REB-02 The exited funds' record**
- Inputs: flows of the exited funds aggregated, their benchmark flows.
- Narrative: "The {n} funds being exited have together earned {x} against {b} for their benchmarks."
- Engine today: **Missing** (subset XIRR over chosen instruments).

**REB-03 Trade-offs and constraints**
- Inputs: taxation (long and short term), exit loads (missing), lock-ins, liquidity.
- Narrative: "{trade_off_sentence}." Required in RB whenever a sale crystallises short-term gains or loads.
- Engine today: **Partial**.

### 6.10 House views and context blocks (attached, never generated as findings)

| ID | Attach when | Source requirement |
|---|---|---|
| HV-01 core-satellite | DIV-07, DIV-08 or DIV-10 fires, or ALL-05 with large cap at least 60% | a computed rolling-return statistic for the index (gap G-1) before quoting "low probability of negative returns over five and seven years" |
| HV-02 strategic sleeves | ALL-02 or two or more ALL-03 instances fire | role sentences from a fixed bank; product suggestions only from the product bank with dated figures |
| HV-03 market context | ALL-02 fires | the current month's Market Update file, quoted with its date; never hard-coded event names |
| SYN-01 takeaway | always, last bullet | built from the two highest-materiality fired rules: "The main weakness is not {weaker_rule_phrase}, but {top_rule_phrase}." and a "Simplify before adding new products: {top_actions}." line |

---

## 7. Coverage map: current engine against the rule bank

**Current engine (07_engine.js lines 1665 to 1978):** 35 templates (9 Current Portfolio, 6 Strengths, 6
Weaknesses, 9 Opportunities, 5 Threats, one of which is emitted once per tenor). Mapping:

| Engine template | Rule |
|---|---|
| asset mix and risk profile, market-cap skew | ALL-02, ALL-05 |
| debt YTM, duration, quality | DEBT-02 |
| product split; single product to PMS/AIF | CON-03 |
| AMC breach, trim and redeploy; within cap | CON-01, POS-01 |
| liquidity split | ALL-07, POS-02 |
| diversified across 3 or more classes | (positive; keep) |
| at least 60% of CMV at or above benchmark | POS-03 variant |
| spans large, mid, small | (positive; keep) |
| active and passive blend | POS-04 |
| best sleeve | POS-03 |
| concentration facts (asset, product, AMC, top-3 sector, stock) | ALL-02, CON-03, CON-01, CON-06, CON-04 |
| overlap pair above 40% | DIV-03 |
| top 10 stocks at least 60% | CON-04 |
| holdings trailing benchmark XIRR | PERF-05 |
| sub-1.50% holdings | DIV-11 |
| low-yield debt | DEBT-01 |
| under-represented classes | ALL-03 |
| consolidate overlapping schemes | DIV-03 action |
| passive above 80% | (keep as POS/attention) |
| **periodic rebalancing recommended (unconditional)** | remove: fires for every portfolio |
| large cap through index funds | HV-01 |
| commodity winner | PERF-09 (reword) |
| sleeve rotation | ALL-06 with PERF-02 |
| sector or stock concentration threat | CON-06, CON-04 |
| AMC-specific risk | CON-01 |
| close-ended at least 20% | ALL-07 |
| trailing 1Y, 3Y, 5Y laggards | PERF-06 |
| negative contributors | PERF-04 |

**Rules with no observation template in the engine today (27; several already have their inputs, see "Engine
today" on each rule):** DIV-01 (narrative), DIV-04, DIV-05, DIV-06, DIV-07, DIV-08, DIV-09, DIV-10, ALL-01
(net equity), ALL-04, ALL-06 (in the engine), CON-02, CON-05, CON-07, CON-08, CON-09, DEBT-03, DEBT-04,
DEBT-05, PERF-03 (share of total), PERF-07, PERF-10, PERF-12, TIME-01, TIME-02, DQ-01, REB-02.

**Defects in the current templates to fix in the new engine:**
- Em or en dashes in 8 templates: the market-cap skew suffix (line 1689), the single-product sentence (1714),
  missing Liquidity column (1736), the strengths share sentence (1763), the concentration weakness (1804), the
  PMS/AIF opportunity (1859), the index-fund opportunity's "5 to 7 year" range, written with an en dash (1876),
  the AMC threat (1904). The AI
  Analyst narratives also use em dashes.
- One unconditional bullet (line 1868) contradicts the block's own rule that every bullet fires only on a
  condition.
- Internal values are not exported (gold, debt, international, alternatives and REIT shares; passive share;
  low-yield share; sleeve XIRRs; full aggregated stock vector; pair list), so the deck, the workbook and any
  new rule cannot reuse them without recomputing.
- International exposure is detected by a fund-name regex ("china", "us ", "world"...), not by category.
- Two peer bases for risk ratios: the MF Analysis tab uses category **means**, the AI Analyst uses category
  **medians**.
- The comment at line 1528 says look-through stores only the top 30 holdings per fund; the shipped data holds
  full portfolios (verified), so overlap and unique-stock counts are on full holdings.

### 7.1 Field inventory for the rule bank

| Input | Where today | Status |
|---|---|---|
| Holdings: client, name, category, asset, product, AMC, distributor, units, invested, current, gain, liquidity, XIRR, BMXIRR, holding days, purchase date | `model.holdings[]` | Exists (purchase date is a display string, first folio only) |
| Canonical SEBI category per holding | `REF.MF_PERF[perfKey].sheet`, `REF.FUND_RANKS[perfKey].cat`, `REF.MF_RISK[perfKey].cat` | Partial (three sources; not on the holding) |
| Look-through equity: market cap, sectors, top 20 stocks, unique and total counts, contributing funds, exclusions | `model.equityAnalytics` | Exists |
| Full aggregated stock vector, per-sleeve vectors | internal `eq_stock` | Partial |
| Per-fund market-cap split | `REF.EQUITY_ANALYTICS[k].mcap`, `REF.HYBRID_ANALYTICS[k].eq.mcap`, `REF.MF_PERF[k].mcap` | Exists in REFDATA |
| Index constituents | index-fund proxies in `REF.EQUITY_ANALYTICS` (for example 26 Nifty 50, 6 Nifty 500, 15 Midcap 150, 11 Smallcap 250 index funds) | Partial (needs a benchmark to proxy map) |
| Overlap matrix and holders | `model.overlap` | Exists |
| Debt: sectors, rating groups, issuers, YTM, duration | `model.debtAnalytics`, `REF.DEBT_ANALYTICS`, `REF.MF_PERF[k].debt` | Exists |
| AMC rows and breaches (mutual fund book) | `model.amc` | Exists |
| Client and distributor allocations | `model.clients`, `allocByClient`, `allocByDistributor` | Exists |
| Transaction XIRR tree and flows | `model.irr`, `REF.IRR` | Exists when an IRR file is loaded |
| Contribution, contributors, drags | `model.contribLag` | Exists |
| Trailing returns by tenor with category benchmark | `model.performance.buckets` | Exists (empty rows for arbitrage, BAF, equity savings, gold, global per audit NEW-27) |
| Risk ratios and peers | `REF.MF_RISK`, AI Analyst peer tables | Exists |
| Fund rank and score | `REF.FUND_RANKS` (524 of 1,262 ranked) | Exists |
| Manager history | `REF.FUND_MGR` | Exists |
| Fund AUM | `REF.MF_PERF[k].aum` | Exists |
| Expense ratios, portfolio cost | `window.MF_ER_TABLE`, Portfolio Cost tab | Partial (UI layer) |
| PMS, AIF, SIF performance | `REF.PMS_PERF`, `REF.AIF_PERF`, `REF.SIF_PERF` | Exists |
| Index trailing returns | `REF.BENCH_RET` (108 indices) | Exists |
| Tax lots, long and short term split | `model.taxation` | Exists when transactions are loaded |
| IPS profile | `getIPSData` (UI) | Partial |
| Rebalancing plan, before and after | `ENGINE.aiaCompute`, CVS snapshot | Partial |

### 7.2 Data gaps (new inputs the rule bank needs)

- **G-1** Index history long enough to compute rolling-return statistics (for HV-01) and daily TRI series for
  drawdowns (PERF-12).
- **G-2** A value series for the client portfolio (stored snapshots) or a named model portfolio, for drawdown
  and for trailing three and five year CAGR.
- **G-3** Exit-load schedules per scheme (TIME-03, REB-03).
- **G-4** A benchmark-index to index-fund proxy map (DIV-08, DIV-09), with the proxy and its as-of date
  recorded in the evidence.
- **G-5** A canonical category on every holding, with the source recorded.
- **G-6** Net directional equity for hedged hybrids. Verified: the 40 arbitrage funds carry an equity sleeve of
  65% to 80% of CMV (median 71%) in `HYBRID_ANALYTICS`, balanced advantage funds a median 72%; the engine adds
  these sleeves to equity exposure (`07_engine.js:1005`, `1362` to `1370`), so look-through equity and the IPS
  "effective equity" overstate directional equity for books holding arbitrage or heavily hedged funds.
- **G-7** First and last purchase date per holding from transactions (not the first folio's display string).
- **G-8** A valuation date per holding (stale-value detection).
- **G-9** Country or region focus for global funds (product bank attribute).
- **G-10** Product-bank facts (target yields, strategy roles) for any product suggestion in an observation.

---

## 8. Open questions for the owner

1. **Small-position threshold:** one number for the whole system? Deck B uses 1.5%, 2% and 3%; the engine uses
   1.5% (SWOT) and 2% (AI Analyst floor). Proposed: 1.5% for observations, 2% stays the rebalancing floor.
   And is it measured per scheme across the family or per account row?
2. **Hidden large cap:** what large-cap share of the equity sleeve makes a non-large-cap fund "effectively large
   cap"? Deck B used values from about 44% to above 78%. Proposed 65%.
3. **Top-two houses:** should "two houses together above a third of the mutual fund book" be a standard watch
   item even without a 20% breach?
4. **Review Only and specific switches:** in Review Only mode, may an observation name a destination fund
   ("consolidate into the flexi cap fund already held"), or is that an implied rebalance the brief excludes?
   Proposed: RO may say "consolidate" and "trim toward the cap" but names destinations only in RB.
5. **House views:** should "index the large-cap core" and "strategic debt, gold and global sleeves" appear as
   triggered house-view blocks (proposed), or in every review as deck B does?
6. **Market context:** may client observations carry market commentary at all? Proposed: only a dated block
   from the month's Market Update, never named events inside an observation.
7. **Net equity:** for balanced advantage and arbitrage funds, should look-through equity be net of hedges?
   This changes effective equity, IPS compliance and the equity analytics for any book holding them.
8. **Peer basis for risk ratios:** category mean (MF Analysis today) or median (AI Analyst today)? Deck B says
   "category averages".
9. **Drawdown slide:** is it required in the new deck? If so, which index history source, and is the
   "multi-asset portfolio" the client's book or a Centricity model portfolio?
10. **Fund size:** should AUM ever trigger an observation (deck B argued a large flexi cap fund had lost its
    flexibility)? If yes, per-category thresholds are needed.
11. **Hindsight wording:** confirm that "missed opportunity" phrasing on past winners is to be replaced by "right
    in direction but small in size" plus a strategic range.
12. **Negative numbers:** one style for presentation text: a hyphen-minus ("-1.23%") or the word "minus"?
13. **Text budget:** confirm about 450 words per observation slide at 10 to 11 pt with a "(2/2)" continuation,
    rather than the 9 pt body size the brief mentions for tables.
14. **Entity labels:** how should family members and entities be named on slides? Deck B uses first names with
    honorifics; proposed: an analyst-set account label per client.

---

## 9. Verification log

**Verified (by reading or running, 21 Oct 2026)**
- Deck B: 21 slides, rendered to PNG through PowerPoint COM and read; text, tables, charts (types, series,
  categories) and speaker notes parsed from the slide XML; per-slide word counts, font sizes, bold shares and
  justification computed from the XML; repeated-sentence count computed (43 distinct sentences, 107
  occurrences); dash characters counted per slide.
- The dashboard-frame geometry of nine slides matches `base()` and `foot()` in `08_exporters.js` (lines 78 to
  121) exactly.
- Engine observation code read in full (lines 1665 to 1978) and AI Analyst rules 1 to 8 read; template counts
  and dash occurrences counted from `.blocks/07_engine.js`.
- REFDATA probed through `tools/engine-host.js` (read-only): key list, data dates, look-through depth, index
  proxies, MF_PERF, MF_RISK, PMS_PERF, BENCH_RET, HYBRID_ANALYTICS sleeve weights.

**Inferred (not proven)**
- That the dashboard-frame slides were exported from the dashboard and rewritten by hand, and that some
  sentences were pasted from the engine's SWOT output (the wording and geometry match; authorship is not
  recorded).
- The trigger values listed as "implied by deck B" are read from where the analysts chose to comment; they are
  not stated thresholds.
- That arbitrage and balanced advantage equity sleeves in REFDATA are gross of hedges (consistent with the
  values and with KI-118's note that arbitrage eq plus db is about 170 to 180, but the vendor definition was not
  checked).

**Not verified**
- The client figures in deck B against their source base files (not supplied for this task); internal
  inconsistencies were found by arithmetic on the slides' own numbers only.
- How the drawdown series and the "multi-asset portfolio" in deck B were produced (the embedded chart workbooks
  were not opened).
- Whether REFDATA's category-level `MF_BENCHMARKS` risk rows are benchmark statistics or category averages
  (a sample row has beta 0.9991 and correlation 0.9999, which suggests the index itself).
- Exit loads: absent per the engine's own comment (`07_engine.js:2523` to `2526`); REFDATA keys contain no
  exit-load table, but vendor files outside the build were not searched.
