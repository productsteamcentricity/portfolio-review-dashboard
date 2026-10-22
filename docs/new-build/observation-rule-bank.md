# Observation rule bank

Phase 0 deliverable 11. Draft of 21 Oct 2026, revised 22 Oct 2026 (Phase 0 review: root-question drivers, SWOT
quadrants, a complete legacy mapping, new positive rules and the catalogue areas the legacy never generated; then
D-023: weighted portfolio returns, direct-equity returns from prices, drawdowns on index data), and on 22 Oct 2026 for
the owner's answers: the threshold table approved with a fund pair overlapping from 35% (D-030), and the dash rule
for sentences (D-029); change log at the end of `open-questions.md`. Ready to implement in M5 (Review Only set) and M8
(rebalancing set).

**Basis.** The 28 observation types and the draft rules found in reference deck B [OP §2, §6], the legacy engine's 35
templates (`07_engine.js:1665-1978`, [OP §7; IE E-44, E-45]), reference deck A's Review Snapshot reasoning [DA §4
slide 4] and the brief's Phase 8. This file is public-safe: no client, family, entity or person names, no portfolio
figures; every example is a template with `{placeholders}`.

**Reasoning chain.** Every observation is **Evidence, Diagnosis, Implication, Action** (the brief's Phase 8; deck B's
dominant bullet skeleton [OP §3]):

```
**{Diagnosis as a short claim}.** {Evidence with two to four of this client's numbers},
so {implication in plain words}. {Action or decision to consider}.
```

**Modes.** RO = Portfolio Review Only; RB = Portfolio Review with Rebalancing. In RO an "action" is phrased as a
consideration and never names a destination fund (Q-63).

---

## 1. Observation record

```ts
// app/src/model/observation.ts (erasable TypeScript)
export type Evidence = {
  metric: string;              // metric path in the Review, e.g. 'lookthrough.equity.positions.total'
  value: number | string;      // unrounded number or a label
  unit: 'pct' | 'pp' | 'bp' | 'count' | 'ratio' | 'cr' | 'years' | 'label';
  source: string;              // source register id(s) or 'engine'
  asOf: string;                // ISO date of the data used
  coverage?: number;           // 0..1 share of the relevant CMV the metric covers
};
export type ObservationRecord = {
  id: string;                  // `${ruleId}@${ruleVersion}:${scopeKey}:${evidenceFingerprint}`
  ruleId: string; ruleVersion: number;
  mode: 'RO' | 'RB' | 'both';
  section: 'construction' | 'allocation' | 'concentration' | 'debt' | 'performance' | 'timing'
         | 'data-quality' | 'working' | 'rebalancing' | 'synthesis';
  severity: 'positive' | 'watch' | 'attention' | 'action';
  driver: 'risk' | 'return' | 'both' | 'none';      // which root question it answers (section 1.1)
  swot: ('S' | 'W' | 'O' | 'T')[];                  // quadrants it feeds, primary first; [] = not in the SWOT
  pointers: Partial<Record<'S' | 'W' | 'O' | 'T', string>>;  // one short pointer per quadrant (section 4 item 10)
  materiality: number;         // 0..100 (section 4)
  evidence: Evidence[];
  dataQuality: { status: 'OK' | 'PARTIAL COVERAGE' | 'STALE DATA' | 'INSUFFICIENT EVIDENCE'
                 | 'NOT AVAILABLE IN SUPPLIED DATA'; notes: string[] };
  parts: { evidence: string; diagnosis: string; implication: string; action?: string };
  textGenerated: string;       // composed from parts
  textEdited?: string;         // analyst edit; never changes evidence
  editedAt?: string;
  editStale?: boolean;         // evidence fingerprint changed after the edit
  suppressedReason?: string;   // duplicate, below materiality, gate failed
  houseViews?: string[];       // attached HV ids
};
```

A rule is:

```ts
export type Rule = {
  id: string; version: number; family: string; modes: ('RO' | 'RB')[]; section: ObservationRecord['section'];
  inputs: string[];                                      // metric paths, checked for presence before trigger
  gate: (r: Review) => { ok: boolean; qualifier?: string; status?: string };
  trigger: (r: Review, t: Thresholds) => boolean;
  evidence: (r: Review, t: Thresholds) => Evidence[];
  severity: (r: Review, t: Thresholds) => ObservationRecord['severity'];
  affectedShare: (r: Review) => number;                  // 0..1 of the book
  templates: { RO: Parts; RB?: Parts };                  // Parts = templates for the four parts
  driver: ObservationRecord['driver'];                   // fixed per rule (section 6.10)
  swot: (r: Review, t: Thresholds) => ObservationRecord['swot'];  // fixed per rule, or by severity where section 6.10 says so
  pointerTemplates: Partial<Record<'S' | 'W' | 'O' | 'T', string>>; // at most 18 words each; RO pointers name no destination fund
  legacy?: string[];                                     // legacy template ids it replaces (section 8), for the parity test
  suppresses?: string[];                                 // rule ids this rule makes redundant when it fires
  houseViews?: string[];
};
```

### 1.1 The two root questions

The brief's Phase 8 starts from "What drives portfolio risk?" and "What drives portfolio return?". Every rule
declares its `driver`, and the narrative slide (C-13), the screen and the workbook's Observations sheet group fired
rules under those two headings, in materiality order within each. The brief's list of topics maps to families:

| Root question | Brief topics | Rule families |
|---|---|---|
| What drives portfolio risk? | overlap; genuine diversification; asset allocation; market-cap and sector exposures; concentration; fragmented holdings; hidden exposures; liquidity | DIV-01 to DIV-07, DIV-11; ALL-01 to ALL-07; CON-01 to CON-04, CON-06 to CON-08; DEBT-02 to DEBT-05; TIME-02; REBH-01; THEME-01; POS-01, POS-02, POS-05 to POS-08 |
| What drives portfolio return? | fund selection; benchmark performance; cost of active management; concentration of returns | DIV-08 to DIV-10; ALL-08; CON-05, CON-09; DEBT-01; PERF-01 to PERF-11; FUND-02; AMC-01; TAX-01; POS-03, POS-04, POS-09 |
| Both, as rebalancing considerations | rebalancing considerations; trade-offs | REB-01 to REB-03, TIME-03 (RB only); every rule's Action part |

Qualifiers and data-quality rules (TIME-01, DQ-01, DQ-02) have driver "none": they change how other rules speak.

## 2. Metric paths used by the rules

The engine exports every metric below (the legacy engine computes several internally without exporting them [OP §7]).
Paths are the contract between `engine/` and `observations/`; `docs/DATA_DICTIONARY.md` defines each.

| Path | Meaning |
|---|---|
| `totals.cmv`, `totals.invested`, `totals.gain` | portfolio totals (Crore, unrounded; gain = CMV minus invested, OD-18) |
| `alloc.asset[k].pct`, `alloc.product[k].pct` | labelled allocation shares |
| `alloc.effectiveEquity.gross`, `.netOfHedges` | look-through equity share of the book (E-134, Q-50) |
| `holdings[i]` | holding: `id`, `label`, `category` (canonical), `assetClass`, `productClass`, `amcKey`, `clientId`, `distributorId`, `cmvPct`, `xirr`, `bmXirr`, `ageMonths`, `isPassive`, `isFoF`, `liquidity` |
| `schemes[j]` | holdings merged per scheme across plans and accounts (`cmvPct`, `accounts`, `categories`) |
| `lookthrough.equity.positions.total`, `.unique`, `.coverage` | stock positions and distinct companies |
| `lookthrough.equity.mcap.{large,mid,small,others}` | market-cap split of equity |
| `lookthrough.equity.sectors[]`, `.top10Pct`, `.tailUnder1Pct` | sectors, top-10 stock share, count of stocks under 1% |
| `lookthrough.equity.byFund[f].mcap` | per-fund equity-sleeve market cap |
| `lookthrough.debt.buckets`, `.detail`, `.ytm`, `.modDur`, `.lowYieldPct`, `.creditRiskPct` | debt look-through |
| `overlap.matrix`, `overlap.pairs[]`, `overlap.meanPair`, `overlap.hub` | pairwise overlap and statistics |
| `index.overlap[indexId]`, `index.activeShare[fundOrSleeve]`, `index.proxy[indexId]` | index comparisons via proxies (E-131) |
| `amc.rows[]`, `amc.top2Pct`, `amc.breaches[]` | AMC shares of the MF book |
| `clients[c].sharePct`, `.assetMix`, `.largestHolding` | entity structure (labels set by the analyst) |
| `irr.portfolio.{fund,bench,firstFlow}`, `irr.sleeve[s]`, `irr.product[p]` | transaction XIRR (when an IRR file is loaded) |
| `contrib.rows[]`, `contrib.total`, `contrib.drags[]` | contributions (allocation x XIRR) |
| `perf.byFund[f].{r1y,r3y,r5y,bm1y,bm3y,bm5y}` | trailing returns against the category benchmark |
| `perf.portfolio.{r3y,r5y}`, `.coverage`, `.source` | MF portfolio 3Y and 5Y returns: weighted average return of current holdings, funds without a return excluded and counted (D-023 point 3, E-147) |
| `de.cagr[stock].{r1y,r3y,r5y}`, `de.portfolio.{r1y,r3y,r5y}`, `.coverage` | direct-equity CAGR from adjusted month-end prices at exact anniversaries, and the allocation-weighted figure (D-023 point 4, E-148) |
| `drawdown.index[id].{maxDd,peak,trough,recoveryMonths}`, `drawdown.blend.*` | drawdowns on index data, per index and for a blend at current asset-class weights (D-023 point 2, E-149) |
| `risk.byFund[f].{alpha,sharpe,sortino,dc,sd}`, `risk.peer[cat]` | ratios and the peer basis (median, Q-51) |
| `quants.score.weighted`, `.coverage` | Portfolio Quants roll-up (E-132) |
| `flows.recentPct`, `flows.firstByHolding[i]` | timing of inflows (IRR file) |
| `ips.rows[]` | IPS bands and actuals for the selected profile |
| `alloc.classesPresent[]` | classes at or above `class_present_pct` among equity, debt, gold and commodities, international, alternatives (the legacy SWOT's five) |
| `mf.passivePct` | index funds and ETFs as a share of the MF book |
| `perf.atOrAboveBench.share`, `.coverage` | share of the CMV with return data held in funds at or ahead of their benchmark XIRR |
| `amc.quality[k]` | per house: value-weighted score of its held funds with coverage, share of its value behind benchmark on two tenors |
| `tax.unrealised.{st,lt}`, `tax.realisedFY.{st,lt,source}`, `tax.harvestableLoss`, `tax.exemptionUsed` | tax position (realised from the capital-gains statement or derived, section 6.7 of the architecture) |
| `flows.lastRebalance` | date of the last switch, redemption or transfer out (IRR file) |
| `equity.thematicPct` | thematic and sectoral funds as a share of equity |
| `scenario.valid`, `scenario.post.*`, `scenario.exits[]`, `scenario.tradeoffs` | RB only |

## 3. Threshold table

One versioned table: `data/owner/observation-thresholds.json` (`version`, `approvedBy` role, `approvedOn`, decision,
values). The values were proposed from deck B and the current engine [OP §6.1]. **The owner approved the table on
22 Oct 2026 with one change (D-030): a fund pair counts as overlapping from 35%** (proposed 30%; the legacy uses 40%);
very high stays at 50%. Version 1 of the table records `approvedBy` owner, `approvedOn` 2026-10-22 and D-030; each
later change is a versioned edit with its own approval.

| Key | Value (approved, D-030) | Seen in deck B | Engine today |
|---|---|---|---|
| `small_position_pct` | 1.50 (per scheme across the family, Q-62) | 1.5, 2, 3 | 1.50 SWOT; 2 AI floor |
| `amc_cap_pct` | 20 (MF book, OD-1) | 20 | 20 |
| `amc_top2_watch_pct` | 33 | "more than a third" | none |
| `amc_near_cap_pp` | 2 | | none |
| `overlap_pair_high_pct` / `overlap_pair_very_high_pct` | 35 / 50 (a pair at 35% or more counts as overlapping, D-030; proposed 30) | 30 counted, about 40 quoted | 40 SWOT; bands 15/30/50 |
| `overlap_cluster_min_funds` / `overlap_cluster_mean_pct` / `overlap_cluster_share_high` | 8 / 20 / 0.15 (share of pairs at or above `overlap_pair_high_pct`; the key was `overlap_cluster_share_30`) | | none |
| `overlap_hub_ratio` | 1.3 | | none |
| `low_overlap_pct` / `low_overlap_min_weight_pct` | 15 / 5 | | none |
| `multiplicity_flag` / `multiplicity_headline` / `multiplicity_many_schemes` | 2.0 / 2.5 / 12 | about 2 mentioned, 3 headline | none |
| `label_drift_large_pct` / `label_drift_min_funds` / `label_drift_min_book_pct` | 65 / 2 / 10 | mid 40s to high 70s | none |
| `fund_active_share_low_pct` | 40 | | none |
| `sleeve_active_share_low_pct` / `sleeve_as_drop_pp` | 50 / 10 | just under 50 | none |
| `index_outcome_gap_bp` / `index_outcome_active_min_pct` | 25 / 80 | | none |
| `top10_high_pct` / `top10_low_pct` / `single_stock_pct` | 60 / 20 / 10 | about 75 / about 15 | 60 / none / 10 |
| `top3_sector_pct` / `top2_sector_pct` / `single_sector_pct` | 50 / 45 / 35 | | 50 / none / 35 |
| `large_cap_led_pct` / `mid_small_tilt_pct` | 60 / 55 | | 60 / 55 |
| `asset_dominance_pct` / `effective_equity_dominance_pct` | 85 / 90 | | 85 / none |
| `effective_equity_gap_pp` | 10 | | none |
| `asset_absent_pct` / `asset_under_pct` | 2 / 5 | 0 to about 3 | 5 (2 REITs) |
| `low_yield_debt_pct` / `debt_material_pct` | 50 / 10 | | 50 / 10 |
| `debt_quality_hq_pct` / `debt_quality_min_pct` | 70 / 5 | | 50 |
| `small_credit_sleeve_pct` / `credit_heavy_pct` | 10 / 60 | | none |
| `debt_duplicate_min_schemes` | 3 | | none |
| `single_product_pct` / `multi_book_min_products` / `multi_book_min_pct` | 85 / 3 / 5 | | 85 / none |
| `entity_dominance_pct` | 60 | | none |
| `account_largest_pct` / `account_laggard_gap_pp` | 10 / 1.0 | | none |
| `open_ended_positive_pct` / `locked_attention_pct` | 95 / 20 | | 65 (SWOT strength) / 20 (SWOT threat); the observation card always prints the split (corrected 22 Oct; the earlier draft said 95) |
| `class_present_pct` / `diversified_min_classes` / `class_max_pct` | 2 / 3 / 85 | | 2 / 3 / 85 (SWOT strength) |
| `mcap_tier_min_pct` | 5 | | 5 (SWOT strength: spans large, mid, small) |
| `at_benchmark_share_pct` | 60 | | 60 (SWOT strength) |
| `passive_blend_min_pct` / `passive_blend_max_pct` / `passive_heavy_pct` | 10 / 75 / 80 | | 10 / 75 / 80 |
| `index_core_large_pct` / `index_core_midsmall_max_pct` | 55 / 25 | | 55 / 25 (SWOT opportunity: large cap through index funds) |
| `rotation_big_sleeve_pct` / `rotation_gap_pp` | 50 / 3 | | 50 / 3 (SWOT opportunity: sleeve rotation) |
| `top_n_small_list_pct` | 40 (top N when fewer than 10 stocks are listed) | | 40 |
| `amc_quality_min_book_pct` | 10 | | none |
| `st_gain_share_pct` / `harvestable_loss_min_pct` | 40 / 0.5 | | none |
| `rebalance_gap_months` | 24 | | none |
| `thematic_pct` | 15 (of equity) | | none |
| `perf_ahead_bp` / `perf_in_line_bp` | 50 / 50 | | none |
| `return_concentration_top2_pct` / `return_concentration_weight_pct` / `single_contrib_pct` | 40 / 30 / 15 | | none |
| `laggard_gap_pp` (to name a fund) | 1.0 | any shortfall | any shortfall; 2 pp AI red |
| `persistence_tenors` | 2 of 1Y/3Y/5Y | | none |
| `weight_quality_gap_pp` | 3 | | none |
| `peer_ratio_min_count` | 2 of alpha, Sharpe, downside capture | | AI uses medians |
| `materiality_min_weight_pct` | 1.0 | "barely moves the portfolio" | none |
| `winner_xirr_pct` / `winner_weight_pct` | 20 / 5 | | 20 / 5 |
| `direct_equity_min_pct` / `direct_vs_mf_gap_pp` | 15 / 3 | | none |
| `recent_money_pct` / `young_holding_months` | 50 / 12 | | none |
| `cluster_purchase_days` / `cluster_min_funds` | 90 / 3 | | none |
| `stale_valuation_days` | 92 | | none |
| `coverage_qualify` / `coverage_silent` | 0.80 / 0.50 | | none |
| `per_slide_max` / `per_slide_min` | 8 / 6 | | none |

## 4. Composition, gates and ranking

1. **Placeholder rule.** A sentence is emitted only if every placeholder is filled from `evidence`; a missing optional
   clause is dropped; a missing core metric records NOT AVAILABLE IN SUPPLIED DATA and the rule stays silent in the deck.
2. **Coverage gate.** Coverage below `coverage_qualify` adds "across the {coverage_pct} of {base} with look-through data";
   below `coverage_silent` the rule does not fire and records PARTIAL COVERAGE.
3. **Staleness.** A metric with STALE DATA adds "as on {as_of}" to the evidence clause; a rule whose core metric is
   stale beyond its role's limit stays silent and records STALE DATA.
4. **Materiality** = `affectedShare x severityWeight x 100`, with weights action 1.0, attention 0.8, watch 0.5,
   positive 0.4. Rules sort by materiality, then by section order.
5. **Per slide** 6 to 8 observations; the rest go to the workbook's Observations sheet and the screen.
6. **Suppression.** One rule, one sentence family: a rule listed in a fired rule's `suppresses` is suppressed with a
   reason (for example DIV-03 suppresses the pair clause of DIV-04 when the same pair is quoted).
7. **House views** (HV-01 to HV-03) attach only to the fired rules named in section 9, as dated blocks.
8. **Synthesis** (SYN-01) is always last and uses the two highest-materiality fired rules.
9. **Review Snapshot mapping:** "what is working" = top 4 `positive`; "what needs attention" = top 6 by materiality
   among `attention` and `action`; in RB the action tag is "In the plan" when the scenario addresses the rule's
   holdings, else "Next step". Materiality does **not** decide the mandatory facts (architecture §11): they come
   from the engine. And if no rule of the concentration (CON-01 to CON-06), overlap (DIV-03 to DIV-05) or fund-quality
   (PERF-05 to PERF-08, AMC-01) families fired, the attention area carries that family's neutral fact line, built
   from the same metrics ("No fund house exceeds the cap; the largest is {amc} at {pct}"), so those three findings
   are always present.
10. **SWOT composition (C-14).** Each fired rule contributes one pointer to each quadrant in its `swot` list, built
    from its pointer template (S from the evidence, W from the diagnosis, O from the action, T from the implication);
    at most 18 words, no en or em dash, same lint as section 5. A rule feeds at most two quadrants, and a W pointer and an O
    pointer from the same rule use different parts, so they never repeat each other. Each quadrant takes up to four
    pointers by materiality; an empty quadrant says "None identified on the data supplied" with a status footnote.
    The quadrant meanings: **S** an internal feature that serves the client's objectives; **W** an internal
    construction or selection weakness; **O** an improvement the client can choose (in RO never naming a destination
    fund, Q-63); **T** an exposure to an external event (market, sector, stock, fund house, manager, liquidity
    window) that could hurt the portfolio.

## 5. Lint (fails the build of the text, with the offending rule named)

- No en or em dash (U+2013, U+2014) in any sentence, pointer, title or footnote; hyphen-minus only inside numbers and
  compound words (D-029). Observation text never carries the missing-value dash either: a missing metric makes the
  clause drop or the rule stay silent (section 4 item 1); the dash appears only alone in a value cell or tile.
- No unfilled `{placeholder}`; no "NaN", "undefined", "null".
- No hindsight verbs or phrases: "missed opportunity", "could have", "should have", "would have" (Q-67).
- No product yield or return claim unless the product bank supplies it with a source and date.
- No named market event or geopolitical claim inside an observation (Q-65).
- No personal names or honorifics; entities by analyst-set labels (Q-68).
- No sentence of eight or more words repeated within a deck (deck B repeats 43 such sentences [OP §0 item 6]).
- In RO, no destination fund names and no "after rebalancing" figures.
- Negative numbers with a hyphen-minus, never the word "minus" or a Unicode minus sign (D-029).

## 6. Rules

Format: **Id Name** (status) · modes · section. Status: **v1** inputs exist, built in M5; **v1+** needs a gap closed
inside its milestone (named); **RB** built in M8; **blocked** needs data the system does not hold; **off** needs an
owner decision first. "Legacy" says what the engine has today [OP §6].

### 6.1 Construction and diversification

**DIV-01 Fund multiplicity** (v1) · both · construction
- Inputs: `lookthrough.equity.positions.total`, `.unique`, `.coverage`; equity and hybrid scheme count.
- Trigger: `total/unique >= multiplicity_flag`; severity attention when `>= multiplicity_headline` or schemes `>= multiplicity_many_schemes`, else watch.
- Affected share: equity look-through share of the book.
- E: "The {fund_count} equity and hybrid funds hold {total_positions} stock positions in only {unique_companies} companies,"
- D: "so each company is held {multiplicity} times on average."
- I: "Each extra fund mostly re-buys names already owned, and the managers' different calls start to cancel out."
- A: "Fewer funds, each with a distinct job, would keep the same exposure at lower cost and complexity."
- RB adds: "After the proposal, {post_total} positions resolve to {post_unique} companies ({post_multiplicity} times)."
- Tests: fires at 2.6 with 14 schemes; silent at 1.4; qualified at 70% coverage; silent at 40%.
- Legacy: counts exist; narrative missing.

**DIV-02 Category stacking** (v1) · both · construction
- Inputs: `holdings[].category` (canonical), `cmvPct`.
- Trigger: any category with 2 or more schemes; attention when 3 or more, or stacked categories hold 30% or more of equity.
- E: "{category_count_list}." D: "Each extra fund in a category the client already owns largely buys the same stocks again."
- I: "{stacked_pct} of the equity book sits in categories held two or more times." A: "Keeping the strongest one or two funds per category would remove the duplication."
- Legacy: partial (free-text category).

**DIV-03 High-overlap pair** (v1) · both · construction
- Inputs: `overlap.pairs[]`, fund weights, composite quality when available.
- Trigger: any pair at or above `overlap_pair_high_pct`; attention at `overlap_pair_very_high_pct`.
- E: "{fund_a} and {fund_b} share {pair_pct} of their holdings." D: "Two active fees are being paid for substantially the same portfolio."
- I: "The second fund adds little diversification." A (RO): "Consolidating the pair would keep the exposure with one fee." A (RB): "Consolidating into {stronger_fund} keeps the exposure with one fee."
- Legacy: exists (pair above 40%).

**DIV-04 Overlap cluster and hub fund** (v1) · both · construction
- Inputs: `overlap.matrix` upper triangle, `overlap.meanPair`, `overlap.hub`.
- Trigger: funds `>= overlap_cluster_min_funds` and (`meanPair >= overlap_cluster_mean_pct` or pairs at or above `overlap_pair_high_pct` (35%) `>= overlap_cluster_share_high` of pairs); hub when its mean overlap `>= overlap_hub_ratio x meanPair`.
- E: "The average pair of funds shares {mean_pair_pct} of its holdings, and {pairs_high} of the {pairs_total} pairs share {pair_high_pct} or more." (`{pair_high_pct}` is the approved threshold, today 35%.)
- D (hub): "{hub_fund} sits at the centre of the overlap: it shares {top3_overlap_list}, and {hub_avg_pct} on average with the other {n_others} funds."
- Suppresses: DIV-03 for the hub's pairs. Legacy: missing.

**DIV-05 Same-category cluster behaving as one** (v1) · both · construction
- Trigger: 3 or more funds in one category with every pairwise overlap at or above `overlap_pair_high_pct` (35%, D-030).
- E/D: "{n} {category} funds behave like one: they share {min_pct} to {max_pct} of their holdings with each other." I: "Holding {n} did not spread the risk." A: "One or two of them can carry the category."
- Legacy: missing.

**DIV-06 Low-overlap differentiators** (v1) · both · working
- Trigger: funds with mean overlap under `low_overlap_pct` and weight at least `low_overlap_min_weight_pct`.
- Text: "{fund_list} ({pct_of_book}) share only {min_pct} to {max_pct} of their holdings with the other funds, so they add genuinely different drivers."
- Severity positive. Legacy: missing.

**DIV-07 Hidden large-cap exposure (label drift)** (v1) · both · construction
- Inputs: `lookthrough.equity.byFund[f].mcap.large` (equity sleeve only, never the whole fund), category.
- Trigger: non-large-cap categories (flexi, focused, multi, contra, value, ELSS, thematic, hybrid) with large cap at or above `label_drift_large_pct`; at least `label_drift_min_funds` funds or `label_drift_min_book_pct` of the MF book.
- E: "{fund_list} carry {range} large cap in their equity sleeves." D: "They are effectively large-cap funds wearing different category labels."
- I: "Together they hold {pct_of_mf_book} of the mutual fund book in a segment where the top 100 names are common to almost every scheme."
- A: "Large cap is better held deliberately, through one low-cost index fund and one high-conviction manager." House view HV-01.
- Legacy: partial (data in REFDATA).

**DIV-08 Fund active share against its category index** (v1+, needs the index proxy map, Q-30) · both · construction
- Metric: active share = 100 minus the sum of min(fund weight, index weight), index proxied by a named index fund at a named date.
- Trigger: active fund with active share under `fund_active_share_low_pct`, or a large-cap active fund with negative 3Y alpha.
- Text: "{fund} holds about {index_like_pct} of its portfolio in line with the {index}, and its three-year alpha is {alpha}: active fees for index-like holdings."
- Footnote: proxy fund and date. Legacy: missing.

**DIV-09 Sleeve active share and book overlap with the broad index** (v1+, proxy map) · both · construction
- Trigger: sleeve active share under `sleeve_active_share_low_pct`, or `sleeve_as_drop_pp` below the lowest single fund's.
- E: "Individually the {n} {category} funds are {min_as} to {max_as} different from the {index}; combined, the sleeve is only {sleeve_as} different."
- I: "So {dup_share} of it now duplicates the index." Book clause: "By weight, {book_index_overlap} of the equity book is held exactly as the Nifty 500 holds it."
- RB: reported before and after. Legacy: missing.

**DIV-10 Index outcome at active fees** (v1, IRR file required) · both · performance
- Trigger: `abs(irr.portfolio.fund - irr.portfolio.bench) <= index_outcome_gap_bp` and active share of the book at least `index_outcome_active_min_pct`.
- Gate: INSUFFICIENT EVIDENCE if the first flow is under three years old.
- E: "Since {first_flow_year} the portfolio has compounded at {xirr} a year against {bm_xirr} had the same cash flows gone into each fund's own benchmark."
- D: "The return has come from the markets the money was invested in rather than from which funds were chosen." I: "The client is paying active fees and receiving an index outcome." HV-01.
- Legacy: partial (figures exist).

**DIV-11 Sub-scale positions** (v1) · both · construction
- Inputs: `schemes[].cmvPct` (per scheme across the family, Q-62).
- Trigger: 3 or more schemes below `small_position_pct`.
- E: "{n_small} of the {n_holdings} holdings each sit below {small_pct} of the portfolio, the smallest at {min_pct}." D: "Positions this size cannot move the portfolio."
- I: "They add line-item complexity without changing the overall exposure." A: "They are natural candidates to fold into larger holdings unless each has a distinct role."
- Legacy: exists (1.50%).

### 6.2 Allocation

**ALL-01 Effective equity against labelled equity** (v1) · both · allocation
- Inputs: `alloc.effectiveEquity.gross`, `.netOfHedges`, `alloc.asset.Equity.pct`, hybrid share and sleeve.
- Trigger: `netOfHedges - labelled >= effective_equity_gap_pp` (uses the net figure so hedged arbitrage equity never counts, Q-50).
- E: "Hybrid funds are {hybrid_pct} of the portfolio and hold about {hybrid_eq_pct} in stocks after excluding hedged positions,"
- D: "so around {effective_eq_pct} of the portfolio moves with the equity market, against {labelled_eq_pct} shown as equity."
- A: "Equity exposure is better sized on the look-through figure." Gate: hybrid look-through coverage. Legacy: partial (gross only).

**ALL-02 Single asset-class dominance** (v1) · both · allocation
- Trigger: one asset class at least `asset_dominance_pct`, or effective equity at least `effective_equity_dominance_pct`.
- Text: "The portfolio is {pct} {asset_class}, {profile_phrase}. A broad drawdown in that asset class would move almost the entire book together, which no amount of scheme-level diversification offsets." HV-03 as a dated block only.
- Legacy: exists.

**ALL-03 Missing or under-weight asset class** (v1; one instance per class) · both · allocation
- Classes: standalone debt, gold and commodities, global equity, REITs and InvITs, PMS and AIF, directly held bonds, unlisted.
- Trigger: share under `asset_absent_pct` (absent) or under `asset_under_pct` (under-weight), and within the IPS range when a profile is set (minimum 0% means "an option").
- Text: "There is no {asset_class} allocation today. {role_sentence}." Role sentences from a fixed bank keyed by class (debt: income and cushioning; gold: holds up when equity and debt are both under pressure; global: other economies, sectors and currencies).
- RB: states whether the proposal adds the class. HV-02 when two or more instances fire. Legacy: partial (name regex for global; replaced by category).

**ALL-04 Narrow international exposure** (v1+, needs a country attribute from the product bank, G-9) · both · allocation
- Trigger: all global exposure in one single-country fund. Text: "Global equity is limited to a single {country} focused fund at {pct}, giving country-specific rather than broad international diversification."

**ALL-05 Market-cap skew** (v1) · both · allocation
- Trigger: large cap at least `large_cap_led_pct`, or mid plus small at least `mid_small_tilt_pct`, or outside the IPS range.
- E: "Within equity, large cap is {lc}, mid cap {mc} and small cap {sc}." D: "{skew_phrase}." I (large led): "growth drivers are narrow." I (mid and small tilt): "that mix lifts growth potential but also deepens drawdowns."
- O pointer (the legacy SWOT opportunity, same trigger): when large cap is at least `index_core_large_pct` or mid plus small is under `index_core_midsmall_max_pct`: "Large cap can be held at low cost through index funds, leaving active fees for segments with room to add value." HV-01 attaches.
- Legacy: exists (card skew phrase; SWOT opportunity L-O7).

**ALL-08 Passive-heavy mutual fund book** (v1) · both · allocation
- Trigger: index funds and ETFs above `passive_heavy_pct` of the MF book. Severity watch.
- Text: "{passive_pct} of the mutual fund book is in index funds and ETFs, so returns will track the markets held; select active strategies in segments with demonstrated alpha could add a different return source." In RO no fund is named.
- Legacy: SWOT opportunity L-O4.

**ALL-06 Risk-profile fit** (v1 when an IPS profile is set) · both · allocation
- Trigger: equity or debt outside the selected profile's range. Silent with NOT AVAILABLE IN SUPPLIED DATA when no profile is chosen.
- Text: "If the family's risk appetite is {higher_lower} than this {profile_phrase} positioning suggests, the {sleeve} sleeve is materially {under_over} weight."
- Legacy: partial (UI only).

**ALL-07 Liquidity and lock-in** (v1) · both · working or allocation
- Positive when open-ended at least `open_ended_positive_pct`: "{open_pct} of the portfolio is in open-ended structures, so the family can rebalance or redeem without lock-in constraints."
- Attention when close-ended or locked-in at least `locked_attention_pct`: "Close-ended or structured instruments are {locked_pct}; their lock-in and redemption windows shape what can be rebalanced." RB: listed as an execution constraint.

### 6.3 Concentration

**CON-01 AMC cap breach** (v1) · both · concentration
- Trigger: any house above `amc_cap_pct` of the MF book.
- Text: "{amc} runs {pct} of the mutual fund book, past the {cap}% per-house cap. A manager exit, process change or strategy drift at that house would move the whole portfolio." A (RO): "Trimming toward the cap would cut house-level risk without disturbing the asset mix." A (RB): adds the post-proposal share.

**CON-02 Top-two houses or near the cap** (v1) · both · concentration
- Trigger: top two at least `amc_top2_watch_pct`, or the largest within `amc_near_cap_pp` of the cap. Severity watch.
- Text: "{amc_1} at {pct_1} and {amc_2} at {pct_2}: neither breaches the cap, but together they are more than a third of the mutual fund book, so new money is better directed to other houses."

**CON-03 Single product structure or several books in one asset class** (v1) · both · concentration
- Trigger: one product at least `single_product_pct`, or one asset class split across `multi_book_min_products` or more product types each at least `multi_book_min_pct`.
- Texts: "The portfolio is built entirely through {product}, {n_schemes} schemes in one product structure: every return driver and every risk runs through one product type." / "The {asset_class} allocation is not one book but {n_books}: {book_list}."
- O pointer (the legacy card and SWOT opportunity when one product is at least `single_product_pct`): "Other product structures, such as PMS or AIF strategies, could broaden the styles the portfolio holds." Product names only through HV-02, from the product bank's approved list with dated figures; never in RO.

**CON-04 Top-10 stock concentration** (v1) · both · concentration
- Trigger: top 10 at least `top10_high_pct` of equity, or one stock at least `single_stock_pct`; when the look-through lists fewer than 10 stocks, the top N at least `top_n_small_list_pct` (the legacy rule).
- Text: "The top 10 holdings are {top10_pct} of the equity portfolio, so a few companies drive the result."
- T pointer when one stock is at least `single_stock_pct`: "{stock} at {pct} of equity: a fall in one company would move the portfolio."

**CON-05 Top-10 dilution with a long tail** (v1) · both · concentration
- Trigger: top 10 at most `top10_low_pct` and DIV-01 fired.
- Text: "The top 10 underlying stocks are only {top10_pct} of equity, with {tail_n} stocks under 1%, so the real risk is not concentration but fragmentation: no single idea is large enough to lift the result."

**CON-06 Sector concentration** (v1) · both · concentration
- Trigger: top three at least `top3_sector_pct`, top two at least `top2_sector_pct`, or one sector at least `single_sector_pct`.
- Text: "{s1} at {p1} and {s2} at {p2} together make {p12}{and_s3}, so the portfolio effectively operates as a {n}-sector portfolio{by_construction}." "by construction" when sectoral funds are at least half of that exposure. Never applies the debt sub-2% rule.

**CON-07 Entity concentration** (v1) · both · concentration
- Trigger: 2 or more clients and one holds at least `entity_dominance_pct`, or one entity holds a single asset class only.
- Text: "{entity_label} holds {pct} of the family book{mix_note}; the other accounts hold {rest_pct}." Labels only (Q-68).

**CON-08 Same scheme across accounts** (v1) · both · concentration
- Trigger: a scheme held in 2 or more accounts. Text: "{scheme_list} each sit in {n} of the {n_accounts} accounts." Severity watch.

**CON-09 An account's largest position is a weak fund** (v1, IRR file) · both · concentration
- Trigger: the largest position of an account is at least `account_largest_pct` of it and trails its benchmark by at least `account_laggard_gap_pp`.
- Text: "In {account_label}, the single largest position, at {pct}, is {fund}, which trails its own benchmark by about {gap_bps} basis points since purchase."

### 6.4 Debt

**DEBT-01 Low-yield liquidity buckets** (v1) · both · debt
- Trigger: debt at least `debt_material_pct` of the book and low-yield share (liquid, money market, overnight, arbitrage, ultra short, low duration) at least `low_yield_debt_pct`.
- Text: "{low_yield_pct} of the debt sleeve sits in liquid, money market, arbitrage and ultra short funds, with an average duration of {dur} years and a yield of {ytm}. It protects capital and keeps cash within reach but adds little to returns." A: "If there is no near-term liquidity need, part of it could move to longer or higher-yielding mandates."

**DEBT-02 Debt quality summary** (v1) · both · working
- Trigger: debt at least `debt_quality_min_pct`; positive when bucket 1 (sovereign, AAA/A1+, cash) at least `debt_quality_hq_pct`.
- Text: "The debt sleeve itself is well built: sovereign and AAA or A1+ paper make up {hq_pct}, yield to maturity is {ytm} and modified duration {dur} years, so credit and rate risk are contained."

**DEBT-03 Debt scheme duplication** (v1+, target-maturity attribute) · both · debt
- Trigger: `debt_duplicate_min_schemes` or more debt or arbitrage schemes with one objective (liquidity; roll-down maturing within the same three years; banking and PSU or corporate bond).
- Text: "The debt and arbitrage allocation is spread across {n} schemes that often do the same job: {group_list}. A tighter set of differentiated mandates would cut duplication without giving up yield."

**DEBT-04 Small debt sleeve carrying credit risk** (v1) · both · debt
- Trigger: debt under `small_credit_sleeve_pct` of the book and at least `credit_heavy_pct` of it in credit-risk funds or bucket 3.
- Text: "Debt is only {debt_pct} of the book and sits mostly in credit-risk paper, so the stabilising sleeve carries credit risk of its own."

**DEBT-05 No standalone debt sleeve** (v1) · both · debt
- Trigger: standalone debt under `asset_absent_pct` while hybrids hold debt.
- Text: "There is no standalone debt sleeve. Hybrid funds hold debt internally but give no portfolio-level control over duration, credit quality or target weight."

### 6.5 Performance

**PERF-01 Headline against the blended benchmark** (v1) · both · performance
- Inputs: `irr.portfolio` when an IRR file is loaded, else the CMV-weighted grand rows, labelled.
- Trigger: always when a basis exists; verdict ahead (`>= perf_ahead_bp`), in line, behind.
- Gate: both sides on the same basis; the absolute return must reconcile to invested and current value, else DQ-02 fires instead.
- Text: "The portfolio has compounded at {xirr} XIRR against {bm_xirr} for a blended benchmark on the same cash flows, about {gap_bps} basis points {ahead_behind}, an absolute gain of {abs_return}."

**PERF-02 Sleeve and product attribution** (v1, IRR file) · both · performance
- Trigger: the sleeve with the largest excess return differs from the largest sleeve, or the largest sleeve is within 50 bp of its benchmark.
- Text: "{best_sleeve} is doing the heavy lifting: {w} of the book at {x} XIRR against {b}. The {largest_sleeve} sleeve, at {w2}, returns {x2} against {b2}, so excluding {best_sleeve} the portfolio only matches its benchmark."
- O pointer (the legacy SWOT "sleeve rotation", same trigger): when the largest sleeve is at least `rotation_big_sleeve_pct` of the book and another sleeve's XIRR is at least `rotation_gap_pp` higher: "The {largest_sleeve} sleeve anchors stability but caps upside against {best_sleeve}; the mix is worth revisiting against the risk profile." No hindsight wording (Q-67).

**PERF-03 Return concentration** (v1) · both · performance
- Trigger: top two contributors at least `return_concentration_top2_pct` of total contribution while holding at most `return_concentration_weight_pct` of the book, or one holding at least `single_contrib_pct`.
- Text: "{f1} at {w1} of the portfolio and {f2} at {w2} together contribute {c12} of the {c_total} points, so performance depends heavily on {n} schemes." Gate: contribution and total on the same CMV-weighted basis.

**PERF-04 Drags** (v1) · both · performance
- Trigger: any negative contribution. Text: "{drag_list} together cost {pts} points of return."

**PERF-05 Laggards on the client's own cash flows** (v1, IRR file or base-file XIRR) · both · performance
- Trigger: any holding behind its benchmark; name those at least `laggard_gap_pp` behind; TIME-01 guard for young holdings.
- Text: "{n_behind} of the {n_with_data} holdings with return data trail their own benchmark. Together they hold {behind_pct} of the {book_label}: {top3_list}."

**PERF-06 Persistent trailing laggards** (v1) · both · performance
- Trigger: a held fund behind its category benchmark on any of 1Y, 3Y or 5Y (severity watch, one evidence item per tenor, as the legacy threat bullets do); attention when behind on at least `persistence_tenors` tenors.
- Text (RO): "{fund_list} lag on both the {tenor_a} and {tenor_b} readings, so they warrant a switch review rather than continued monitoring." RB: links each fund to its action in the plan.

**PERF-07 Weight against quality inside a category** (v1) · both · performance
- Trigger: inside one category a higher-weight fund trails a lower-weight fund by at least `weight_quality_gap_pp` on 3Y.
- Text: "{weak_list} lag the same benchmark that {strong_list} beat comfortably: the better {category} managers are carrying the smaller cheques."

**PERF-08 Risk-adjusted metrics against peers, with materiality** (v1) · both · performance
- Trigger: a fund above or below the peer median on at least `peer_ratio_min_count` of alpha, Sharpe, downside capture.
- Text: "{fund} ranks {above_below} its category on alpha and Sharpe ({alpha} against {alpha_peer}, {sharpe} against {sharpe_peer}){materiality_clause}." Materiality clause under `materiality_min_weight_pct`: ", though at {weight} it barely moves the portfolio".

**PERF-09 Under-sized winner** (v1) · both · performance
- Trigger: sleeve XIRR at least `winner_xirr_pct` and weight under `winner_weight_pct`.
- Text: "{sleeve} is {w} of the book yet has been the best performing sleeve at {x} XIRR against {b}: right in direction but small in size. A strategic range, rather than a reaction to past returns, would let it matter." (Replaces the legacy hindsight wording, Q-67.)

**PERF-10 Direct equity against managed sleeves** (v1) · both · performance
- Trigger: direct equity at least `direct_equity_min_pct` of equity and behind the MF book by at least `direct_vs_mf_gap_pp`.
- Text: "Direct equity is what is holding the portfolio back: the direct book shows {de_ret} against {mf_ret} for the mutual fund book, pulling blended equity to {eq_ret}."
- Inputs (D-023): `de_ret` is `de.portfolio.r3y` (CAGR from adjusted month-end prices, allocation-weighted, coverage stated) and `mf_ret` is `perf.portfolio.r3y` (weighted average return of current holdings); both on the same tenor and as-on date, else the rule stays silent. Gate: each side's coverage at least `coverage_qualify`, else the sentence carries the coverage qualifier.

**PERF-11 PMS against TRI benchmarks** (v1, analyst-selected) · both · performance
- Shown only when PERF-10 fires or the analyst adds it; the client's own book row must be present; PMS data older than one quarter versus the portfolio date is STALE DATA.

**PERF-12 Drawdown and recovery** (M12, index data; D-023 point 2) · both · performance
- Inputs: `drawdown.index[*]` and `drawdown.blend` from the owner's monthly index data (G-1); never the portfolio's own history.
- Trigger: index data present for the indices behind the review's asset mix.
- Text: "On index data, {index} fell {max_dd} from {peak_date} to {trough_date} and took {recovery_months} months to regain its peak; a blend of indices at this portfolio's current mix of {mix_text} fell {blend_dd} over the same period." Footnote: "Index data; the blend uses today's weights and is not the portfolio's own history."
- Gate: the window and frequency of the series are stated; an index not yet recovered says so instead of a recovery figure.
- Placement: a context block under "What drives portfolio risk?" (C-43 carries the chart); it feeds no SWOT quadrant (section 6.10).

### 6.6 Timing, data quality, fund

**TIME-01 Recent money and short track records** (v1, IRR file) · both · timing
- Trigger: at least `recent_money_pct` invested in the last 12 months, or any holding under `young_holding_months` quoted with XIRR.
- Text: "Most of the money is recent: {recent_pct} was invested in the last {months} months, so annual return figures rest on {min_m} to {max_m} months of history. {fund} shows {xirr} a year but {abs} since purchase."
- Effect: PERF-05 and PERF-06 qualify or suppress young holdings.

**TIME-02 Clustered purchases** (v1, IRR file) · both · timing
- Trigger: `cluster_min_funds` or more funds in one category first bought within `cluster_purchase_days`. Text: "They were bought in the same market phase, between {d1} and {d2}, and all {n} show {sign} returns."

**TIME-03 Exit constraints on recent positions** (RB; blocked for exit loads until E-140, G-3) · RB · rebalancing
- Text: "This is a recent position: exiting now would realise short-term gains of {st_gain}{exit_load_clause}; {timing_option}."

**DQ-01 Stale valuation** (v1) · both · data-quality (analyst view and audit; not client text by default)
- Trigger: alternative or debt holdings whose CMV equals invested, or whose valuation date is older than `stale_valuation_days`.

**DQ-02 Non-reconciling aggregates** (v1) · both · data-quality
- Trigger: a group figure differs from its recomputation beyond tolerance; the figure is not used in text and an audit record is written.

**FUND-01 Fund size** (off until per-category AUM thresholds are set, Q-66).

**FUND-02 Manager change watch** (v1) · both · performance
- Inputs: manager history. Text: "{fund}'s lead manager changed on {date}; the track record before that date may not carry over." Severity watch.

### 6.7 What is working (positives for the Snapshot)

| Id | Trigger | Template | Legacy |
|---|---|---|---|
| POS-01 | largest house under the cap | "The largest fund house is {amc} at {pct} of the mutual fund book, inside the {cap}% limit." | exists |
| POS-02 | ALL-07 positive | as ALL-07 | exists |
| POS-03 | a sleeve at least 10% of the book and at least 0.5 pp ahead | "The {sleeve} sleeve ({w}) is ahead at {x} XIRR against {b}: that return engine is working." | exists |
| POS-04 | index funds 10% to 75% of the MF book | "{pct} of the mutual fund book sits in index funds, a fair balance between keeping costs down and reaching for alpha where it is available." | exists |
| POS-05 | DEBT-02 positive | as DEBT-02 | exists |
| POS-06 | DIV-06 | as DIV-06 | missing |
| POS-07 | at least `diversified_min_classes` classes in `alloc.classesPresent` (each at least `class_present_pct`) and neither equity nor debt at `class_max_pct` or more | "The allocation spans {class_list}, so the portfolio's return drivers do not rest on one asset class." | exists (SWOT strength L-S1) |
| POS-08 | large, mid and small cap each at least `mcap_tier_min_pct` of equity | "The equity sleeve spans large, mid and small caps ({lc}, {mc}, {sc}), spreading market-cap risk." | exists (SWOT strength L-S4) |
| POS-09 | `perf.atOrAboveBench.share` at least `at_benchmark_share_pct` | "{share} of the value with return data, across {n} holdings, is in funds at or ahead of their benchmark XIRR." Gate: IRR file or base-file XIRR; coverage stated | exists (SWOT strength L-S2) |

POS-04 keeps the legacy band (`passive_blend_min_pct` to `passive_blend_max_pct` of the MF book); its attention
counterpart above `passive_heavy_pct` is ALL-08.

### 6.8 With Rebalancing only (M8)

**REB-01 Construction before and after** (RB) · rebalancing
- Inputs: `scenario.post.*` computed by the same engine.
- Text: "The proposal follows this logic rather than simply cutting line items: the {n_before} active funds become {n_after} {allocation_clause}. {metric_pre_post_list}." Each pre/post pair is quoted only when both sides are computed; an honest trade-off clause is required when a metric worsens or barely moves ("overlap with the Nifty 500 eases only modestly, from {pre} to {post}").

**REB-02 The exited funds' record** (RB, IRR file) · rebalancing
- Text: "The {n} funds being exited have together earned {x} against {b} for their benchmarks." Needs subset XIRR over the exited instruments.

**REB-03 Trade-offs and constraints** (RB) · rebalancing
- Required whenever a sale realises short-term gains, crosses an exit-load window or touches a locked instrument: "{trade_off_sentence}."

### 6.9 Catalogue areas the legacy never generated (E-146, Q-83)

The legacy engine's own comment lists areas it deliberately did not generate (fund-house quality, tax efficiency,
rebalancing history, themes), and the previous owner's catalogue left them open [PO §2.4 item 6]. They become rules
whose inputs the new model holds; none states a thesis or names a market event.

**AMC-01 Fund-house quality** (v1+, needs score coverage from the stored Screener data pack, D-026; STALE DATA labelled; silent without a pack) · both · concentration
- Inputs: `amc.quality[k]` for houses holding at least `amc_quality_min_book_pct` of the MF book.
- Trigger: weak when a house's held funds sit in the bottom third of their categories by value-weighted score, or at
  least half its value trails benchmark on two tenors; strong when in the top third with no such laggards.
- Text (weak): "{amc} runs {pct} of the mutual fund book, and its funds held here score in the bottom third of their categories ({coverage} of its value scored)." Positive form for strong houses.
- Gate: score coverage of the house's value at least `coverage_qualify`, else silent with PARTIAL COVERAGE.

**TAX-01 Tax efficiency** (v1 with an IRR file or a capital-gains statement) · both · performance
- Inputs: `tax.unrealised.{st,lt}`, `tax.realisedFY`, `tax.harvestableLoss`, `tax.exemptionUsed`.
- Triggers: (a) short-term gains are at least `st_gain_share_pct` of unrealised gains on holdings other rules flag for
  action (exits now would be taxed at short-term rates; the months to long-term are stated); (b) harvestable losses
  of at least `harvestable_loss_min_pct` of CMV while realised gains exist this financial year; (c) the long-term
  exemption is unused this year and long-term gains are available (only when the statement shows it, or the analyst
  confirms it, Q-52).
- Text (b): "{loss_amount} of unrealised losses could be set off against {gain_amount} of gains already realised this financial year." Amounts in the file's unit; never a tax recommendation beyond the arithmetic.

**REBH-01 Rebalancing history** (v1 with an IRR file) · both · allocation
- Inputs: `flows.lastRebalance`, IPS rows or ALL-02/ALL-05 results.
- Trigger: no switch, redemption or transfer out for at least `rebalance_gap_months` while an allocation sits outside
  its IPS range or ALL-02 or ALL-05 fired.
- Text: "The last switch or redemption in the transaction history was on {date}, and {sleeve} now sits at {pct} against a range of {range}." No hindsight wording.

**THEME-01 Thematic and sectoral exposure** (v1) · both · concentration
- Inputs: `equity.thematicPct` (canonical categories), the sectors those funds carry.
- Trigger: thematic and sectoral funds at least `thematic_pct` of equity.
- Text: "Thematic and sectoral funds are {pct} of equity, concentrated in {sector_list}, so a downturn in those themes would weigh on the whole equity book."

### 6.10 Driver and SWOT quadrants per rule

Pointer templates are defined with each rule; this table fixes which quadrants a rule feeds (primary first).

| Driver | Quadrants | Rules |
|---|---|---|
| risk | S | DIV-06, DEBT-02, POS-01, POS-02 (ALL-07 positive), POS-05, POS-06, POS-07, POS-08 |
| risk | W, O | DIV-01, DIV-02, DIV-03, DIV-07, DIV-11, ALL-05, CON-03 |
| risk | W | DIV-04, DIV-05, ALL-01, ALL-06, CON-07, CON-08, DEBT-03, DEBT-05, TIME-02, REBH-01 |
| risk | W, T | ALL-02, CON-01, CON-04, CON-06 |
| risk | T | ALL-07 (attention), CON-02, DEBT-04, THEME-01 |
| risk | O | ALL-03, ALL-04 |
| return | S | POS-03, POS-04, POS-09; PERF-01, PERF-08 and AMC-01 when positive |
| return | W | DIV-08, DIV-09, CON-05, CON-09, DEBT-01, PERF-05, PERF-07, PERF-10; PERF-01, PERF-08, PERF-11 and AMC-01 when negative |
| return | W, O | DIV-10, PERF-02, TAX-01 |
| return | O | ALL-08, PERF-09 |
| return | T | PERF-03, PERF-04, PERF-06, FUND-02 |
| none | none | TIME-01, TIME-03, DQ-01, DQ-02, FUND-01, PERF-12, REB-01 to REB-03 (RB rules feed the Snapshot, not the SWOT) |

## 7. House views and synthesis (attached, never generated as findings)

| Id | Attach when | Content and source requirement |
|---|---|---|
| HV-01 core-satellite | DIV-07, DIV-08 or DIV-10 fires, or ALL-05's O pointer fires (large cap at least `index_core_large_pct`, or mid plus small under `index_core_midsmall_max_pct`, the legacy trigger) | "Hold the large-cap core through index funds and pay active fees where managers have room to add value." The "Nifty rarely negative over five to seven years" claim only with a computed rolling-return statistic (G-1) |
| HV-02 strategic sleeves | ALL-02, or two or more ALL-03 instances | Role sentences from the fixed bank; product suggestions only from the product bank with dated figures |
| HV-03 market context | ALL-02 | Quoted from that month's Market Update file with its date; never hard-coded events |
| SYN-01 takeaway | always, last | "The main weakness is not {weaker_rule_phrase}, but {top_rule_phrase}." and "Simplify before adding new products: {top_actions}." built from the two highest-materiality fired rules |

## 8. Legacy templates mapped to rules

Every legacy trigger, read from the engine at `782794f` (`07_engine.js:1665-1978`: four observation-card groups and
the four SWOT lists), has one row. `parity/observations.parity.test.ts` builds a synthetic book that meets each
row's legacy condition, runs both engines, and requires the new rule to fire in the stated quadrant, or the ledger to
hold the stated class. "Same" means same trigger and threshold; any other class is a recorded change.

| Id | Legacy template and trigger | Legacy place | New rule (quadrant) | Parity class |
|---|---|---|---|---|
| L-C1 | Asset mix with a risk-profile phrase (equity 85/60/40 bands); always printed | card | facts strip F4; ALL-02 (W) when one class is at least 85%; ALL-06 when an IPS profile is set | improvement: a descriptive sentence becomes a fact and conditional rules |
| L-C2 | Market-cap split with a skew phrase (large at least 60: large-cap led; mid plus small at least 55: tilt) | card | ALL-05 (W) at the same thresholds; facts strip F5 | same |
| L-C3 | Debt YTM, duration and quality (debt at least 5%; high quality at least 50% phrase) | card | DEBT-02 (S) | threshold change: high quality 70%, debt 5% (D-030) |
| L-C4 | Product split; always printed | card | asset-allocation component C-08 (table) | improvement: a fact, not an observation |
| L-C5 | One product at least 85%, with PMS/AIF strategies from the focused list | card | CON-03 (W) and its O pointer; names only through HV-02 | same trigger; names only from the product bank (improvement) |
| L-C6 | AMC breach above 20% of the MF book, with "trim and redeploy into houses already held" | card | CON-01 (W, T) | same trigger; RO names no destination house (Q-63, improvement) |
| L-C7 | No breach: largest house and its share | card | POS-01 (S) | same |
| L-C8 | Liquidity split; always printed (or "not available") | card | C-08 liquidity pie; ALL-07 positive (S) at 95% and attention (T) at 20% | threshold change for the positive (D-030); the split stays a fact |
| L-S1 | At least 3 of equity, debt, gold and commodities, international, alternatives each at least 2%, with equity and debt each under 85% | strength | POS-07 (S) | same |
| L-S2 | At least 60% of the matched CMV in funds at or ahead of their benchmark XIRR | strength | POS-09 (S) | same |
| L-S3 | Open-ended at least 65% | strength | POS-02 / ALL-07 positive (S) | threshold change 65 to 95 (D-030) |
| L-S4 | Large, mid and small cap each at least 5% of equity | strength | POS-08 (S) | same |
| L-S5 | Index funds and ETFs 10% to 75% of the MF book | strength | POS-04 (S) | same |
| L-S6 | Best sleeve at least 10% of the book and at least 0.5 pp ahead of its blended benchmark | strength | POS-03 (S) | same |
| L-W1 | One bullet listing concentration facts: a class at least 85%, a product at least 85%, AMC breaches, top-three sectors at least 50% (else one sector at least 35%), one stock at least 10% | weakness | ALL-02, CON-03, CON-01, CON-06, CON-04 (W each) | improvement: one pointer per fact instead of one long bullet |
| L-W2 | Any fund pair above 40% overlap | weakness | DIV-03 (W) | threshold change: above 40 to 35 or more (D-030) |
| L-W3 | Top 10 stocks at least 60% of equity (top N at least 40% when fewer than 10 are listed) | weakness | CON-04 (W) | same |
| L-W4 | Holdings trailing their benchmark XIRR, named | weakness | PERF-05 (W) | same trigger; names only those at least 1.0 pp behind (`laggard_gap_pp`), the count covers all |
| L-W5 | At least 3 holdings each under 1.50% | weakness | DIV-11 (W) | same (per scheme across the family, Q-62) |
| L-W6 | Debt at least 10% and low-yield buckets at least 50% of debt | weakness | DEBT-01 (W) | same |
| L-O1 | Classes under 5% (REITs and InvITs under 2%) | opportunity | ALL-03 (O), one instance per class | same; one pointer per class |
| L-O2 | One product at least 85%: add PMS and AIF strategies from the focused list | opportunity | CON-03 O pointer (+ HV-02) | same trigger |
| L-O3 | Fund pairs above 40%: consolidate | opportunity | DIV-03 O pointer | threshold change: above 40 to 35 or more (D-030) |
| L-O4 | Index funds and ETFs above 80% of the MF book | opportunity | ALL-08 (O) | same |
| L-O5 | "Periodic rebalancing is recommended", unconditional | opportunity | none | **removed** (N-3): correction |
| L-O6 | At least 3 holdings under 1.50%: consolidate | opportunity | DIV-11 O pointer | same |
| L-O7 | Large cap at least 55% or mid plus small under 25%: large cap through index funds | opportunity | ALL-05 O pointer and HV-01 | same; the "Nifty rarely negative" claim only with a computed statistic (G-1) |
| L-O8 | Gold and commodities between 0% and 5% while a commodity holding's XIRR is at least 20% | opportunity | PERF-09 (O) | method change: sleeve XIRR instead of the best single holding; hindsight wording removed (Q-67) |
| L-O9 | Largest sleeve at least 50% while another sleeve's XIRR is at least 3 pp higher | opportunity | PERF-02 O pointer | same |
| L-T1 | One sector at least 35% or one stock at least 10% of equity | threat | CON-06, CON-04 T pointers | same |
| L-T2 | AMC breach | threat | CON-01 T pointer | same |
| L-T3 | Close-ended or structured at least 20% | threat | ALL-07 attention (T) | same |
| L-T4 | Funds behind their category benchmark on trailing 1Y | threat | PERF-06 (T), 1Y evidence | same |
| L-T5 | The same on 3Y | threat | PERF-06 (T), 3Y evidence | same |
| L-T6 | The same on 5Y | threat | PERF-06 (T), 5Y evidence | same |
| L-T7 | Holdings with a negative weighted contribution to portfolio IRR | threat | PERF-04 (T) | same |

The 8 legacy templates with en or em dashes [OP §7] are rewritten without them. Rules with no legacy row (for example
DIV-01, DIV-04, AMC-01, TAX-01) are new and are tested only by their own unit tests.

## 9. Data gaps and what they block

| Gap | Needed for | Closed by |
|---|---|---|
| G-1 index history for rolling returns and drawdowns | HV-01 claim, PERF-12 | the five Index TRI files the owner supplies monthly (D-023 point 2 and its addendum of 22 Oct 2026), M11 role, M12 rule |
| G-2 portfolio value history | no longer needed: drawdowns use index data (D-023 point 2) and portfolio 3Y and 5Y returns are the weighted average of current holdings (D-023 point 3) | closed by D-023 |
| G-3 exit loads | TIME-03, REB-03 | E-140 (M11, Q-29) |
| G-4 index to index-fund proxy map | DIV-08, DIV-09, quants | M5 (Q-30) |
| G-5 canonical category on every holding | DIV-02, DIV-05, DIV-07, PERF-07 | M2 crosswalk |
| G-6 net equity for hedged hybrids | ALL-01, IPS | M4 (E-134, Q-50) |
| G-7 first and last purchase dates from transactions | TIME-01, TIME-02 | M3 (IRR parser) |
| G-8 valuation date per holding | DQ-01 | M1.3 (base-file column if present), else CMV = invested test |
| G-9 country focus of global funds | ALL-04 | product bank (M11) |
| G-10 product facts for suggestions | HV-02 | product bank (M11) |

## 10. Build order and tests

- **M5 (v1, Review Only):** DIV-01 to DIV-07, DIV-10, DIV-11, ALL-01 to ALL-03, ALL-05 to ALL-08, CON-01 to CON-09,
  DEBT-01, DEBT-02, DEBT-04, DEBT-05, PERF-01 to PERF-11, TIME-01, TIME-02, DQ-01, DQ-02, FUND-02, POS-01 to POS-09,
  THEME-01, REBH-01 (with an IRR file), HV-01 to HV-03, SYN-01. **v1+ in M5** after the proxy map: DIV-08, DIV-09;
  AMC-01 once score coverage is measured.
- **M7:** TAX-01 (needs the tax position, the capital-gains statement or the IRR file).
- **Later:** DEBT-03 and ALL-04 (product-bank attributes, M11); REB-01 to REB-03 and TIME-03 (M8); FUND-01 (Q-66);
  PERF-12 (M12, once index data is loaded).
- **Tests per rule** (`tests/unit/observations/<family>.test.ts`): fires on a synthetic book built to trigger it; silent
  just below the threshold; qualifies at partial coverage; silent below the coverage floor; RO text has no destination
  and no post figure; text passes lint; evidence values equal the engine's metrics; its `driver` and `swot` values
  equal section 6.10. Composition tests: ranking, per-slide cap, suppression, edit survives recomputation only with
  unchanged evidence; the SWOT has at most four pointers per quadrant and no W and O pointer of one rule repeat each
  other; the RO Snapshot always covers concentration, overlap and fund quality. Parity test: section 8.
