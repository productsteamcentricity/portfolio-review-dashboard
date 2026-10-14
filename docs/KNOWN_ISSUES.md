# Known issues

Register of defects and limitations in the baseline (`index.html` MD5 `173F86CA…`, source commit
`cab22e6`). **None of these is fixed in the baseline** — the replication changed no product code.
Fixes need the product owner's go-ahead (see the backlog in `PROJECT_STATE.md`).

**Status key**
- **Reproduced** — demonstrated at runtime during the 14 Oct 2026 replication.
- **Confirmed (code)** — verified by reading the code; not exercised at runtime.
- **Reported (code review)** — found by the archaeology review of the code; not yet verified.
- **Inherited** — listed by the previous owner in the handover (§11); not re-tested.

Code references point into `.blocks/` (`node tools/extract-blocks.js`), baseline line numbers.

## High

### KI-001 — A second client loaded in the same tab inherits the previous family's state
**Reproduced.** After reviewing family A and then loading family B's base file without reloading:
B's Analytics tab and Post-Rebalancing Overlap panel listed A's funds; B's Taxation tab kept A's
client scope ("Sample Client A"); A's IRR upload stayed active, so B's Fund IRR read
"transaction-based (as on 30 Sep 2026)" from A's file.
- Causes *(code review)*: post-rebalancing analytics cache keyed only on the rebalancing changes
  (`11_app_ui.js:3509-3523`, stored for export at `:3660-3676`); `__taxScope` never reset
  (`:3933, 4413, 4529`); the IRR upload lives in `activeRef.IRR` (`:191`), which loading a new base
  file (`handle()`, `:53-68`) never clears — the Client SOA upload persists the same way; the CVS tab
  is seeded before the rebalancing state resets (`:486-488, 2858-2859`).
- Impact: one family's holdings or client name can appear in another family's on-screen review and
  exported slides (Post-Rebalancing Analytics, Rebalancing Impact, Taxation titles). Confidentiality risk.
- **Workaround: reload the page (F5) before loading each new client's base file.**
- Repro: `docs/TESTING.md` §4 step 7 (uses `test-data/Sample_Base_File_B.xlsx`).
- Fix direction: reset all per-family state on base-file load (or reload the page on a new upload).

### KI-002 — Exported Overlap slide has no matrix
**Reproduced.** In the exported deck the "Overlap Matrix — Mutual Funds / PMS" slide holds only the
title, one insight line and the logo — no matrix image or table. Cause *(code review)*:
`08_exporters.js:414-418` references `ovTh`, `ovSel`, `overlapCanvas`, which exist only inside the UI
script; in strict mode that throws, and the error is swallowed. Workaround: paste a screenshot of the
on-screen matrix into the deck.

### KI-003 — "Post-Rebalancing Overlap Matrix" slide is never produced
**Reported (code review)**, consistent with the baseline export (no such slide in a full deck).
Same scope fault at `08_exporters.js:1131-1137`; the slide picker still offers the group (`11_app_ui.js:288`).

## Medium

### KI-004 — AMC 20% cap measured on two different bases
**Confirmed (code).** The AMC tab measures each AMC as a share of the **MF book**
(`07_engine.js:1075`); the AI Analyst caps at 20% of **total portfolio CMV** (`07_engine.js:2700`) and
mixes the two bases in its before/after figures (`:2377, 2548, 2632`). For a family with PMS / AIF /
direct equity, the analyst's plan can leave an AMC above 20% of the MF book. Needs a product decision
on the intended basis.

### KI-005 — Base-file XIRR units: code and handover disagree
**Confirmed (code).** `XIRR (%)` and `BMXIRR (%)` are read as **percent numbers** and divided by 100
(`07_engine.js:736`, comment "base file stores XIRR/BMXIRR as percent (e.g. 31.71)"); the in-app template
labels them `XIRR (%)`. The handover (§5.1) says they are fractions (0.0879 = 8.79%). There is no
magnitude check, so a file holding fractions — including an Excel cell formatted as % — shows returns
100× too small, silently. Owner to confirm how real base files store XIRR. (Allocation (%) *is* a fraction.)

### KI-006 — Missing XIRR counted as 0% in client-sheet totals
**Reported (code review).** Asset / product / grand-total rows weight XIRR by CMV but treat a missing
XIRR as 0 while keeping its CMV in the denominator (`07_engine.js:1092-1121`).

### KI-007 — Missing invested value becomes 0
**Reported (code review).** A blank invested value is stored as 0 (`07_engine.js:764`): the whole CMV
is then treated as gain in totals and in Taxation (`:325-326, 396`).

### KI-008 — Workbook text rendered as HTML without escaping
**Reported (code review).** Many renderers insert cell text into the page unescaped (e.g.
`11_app_ui.js:78, 602, 815, 828, 1316, 1352, 1413, 5211, 5634`). A crafted cell could inject markup or
script — including a request that would break the no-network guarantee. Likelihood is low (inputs are
internal and vendor files). Fix direction: escape on render, plus a Content-Security-Policy meta tag
(`connect-src 'none'; img-src data: blob:`) so the browser itself enforces "no network".

### KI-009 — Market Update "×" does not restore the embedded slides
**Reported (code review).** An upload overwrites the global image list (`12_boot.js:8`); the reset
writes to an unused field (`11_app_ui.js:226-228`) and the label still says "Embedded default"
(`:239`). Workaround: reload the page.

### KI-012 — Identifying fragments persist in localStorage
**Reported (code review).** `cvs_cmv_sig` stores `family|asOn|CMV`, `cvs_cmv` a portfolio value,
`cost_distributor` a distributor, `cost_overrides` instrument names. They survive across sessions on the
analyst's machine; "Reset to Actual" removes and immediately re-writes them (`11_app_ui.js:5663-5665`).
Holdings, folios and units are never stored.

### KI-013 — Some views ignore uploaded reference data
**Reported (code review).** AI Analyst (`11_app_ui.js:4049`), MF Analysis (`:1532`), cost-tab risk
data (`:5071`) and the exporter's MF Analysis slides / cost fallback (`08_exporters.js:427-438, 699,
767`) read the embedded `REFDATA`, not the session upload. The proposed-fund autocomplete does read
uploads, but builds its list once and caches it in `window.__REBAL_UNIV` (`11_app_ui.js:2758, 2772`),
so uploads made after first use are missed.

### KI-022 — Taxation dating conventions
**Reported (code review).** Holding periods run to the IRR file's latest transaction, not the review's
as-on date (`07_engine.js:1838`, `09_parsers.js:422`); the base file's Purchase Date is not used.
Months are whole months with a strict ">" (`07_engine.js:259-273`), so under a 12-month rule a lot held
12 months and a few days is short-term. Confirm against the intended tax treatment.

### KI-024 — Benchmark routing edge cases
**Reported (code review).** The Debt MF bucket requires Asset exactly "Debt"; other labels ("Fixed
Income") route as equity and receive an equity benchmark; Debt PMS/AIF get Nifty 500 TRI; the commodity
rule runs before the debt rules (`07_engine.js:639-694, 952, 1372-1374`).

### KI-031 — Clearing an upload does not fully revert derived values
**Reported (code review).** After clearing the IRR upload, matched holdings keep the transaction XIRR
while the page says XIRR comes from the base file (`07_engine.js:1022`, `11_app_ui.js:224-231, 1360`);
after a reference reset, holdings that no longer contribute are not listed as excluded
(`07_engine.js:1147, 1234-1237`). Workaround: reload the page.

### KI-032 — IRR client names resolved fuzzily
**Reported (code review).** Base-file clients are joined to IRR clients on ≥ 2 shared name tokens
(`07_engine.js:1012-1015`): a client could pick up a family member's flows when two names share tokens.

## Low

| ID | Status | Issue |
|---|---|---|
| KI-010 | Reproduced | `tools/test-ai-analyst.js` (repo copy, 8,163 bytes) fails 1 of 17: TEST 1 picks a fund *listed* in `FUND_RANKS` with status "1-3yr Warning", which the engine deliberately rates amber; funds with *no* entry correctly get "na". The current 8,402-byte version is with the previous owner. CI runs it non-blocking. |
| KI-011 | Reproduced | The handover's census one-liner uses `node -e`; under `-e`, `require/module/exports` are globals and the embedded UMD bundles break. Run engine code from a script file. |
| KI-014 | Reproduced | Deck order differs from tab order: AI Analyst and Taxation follow the Annexure divider (`08_exporters.js:1179-1409`), although `11_app_ui.js:266-268` says screen and deck never disagree. May be intended — owner to confirm. |
| KI-015 | Reported (code review) | Home tab "Download slide" gives an empty deck; Rebalancing too when no plan exists (`11_app_ui.js:334-338, 361`). |
| KI-016 | Reported (code review) | Cost note says "AIF default = 200 bps"; the code uses 250 bps (`11_app_ui.js:5256` vs `5170`, `08_exporters.js:449`). The same note says ERs come from the MF Monitor, but the embedded ER table is consulted first. |
| KI-017 | Reported (code review) | "Rebalancing Impact" has no checkbox of its own in the slide picker (`11_app_ui.js:456`). |
| KI-018 | Reproduced | IPS table has 28 rows vs 27 per slide, so "IPS Profile Compliance (2/2)" carries a single row. |
| KI-019 | Reported (code review) | Changing the as-on date wipes the rebalancing plan (`11_app_ui.js:39, 2450, 2859`). |
| KI-020 | Reported (code review) | Picking a logo does not update the header logo (`12_boot.js:2, 7`). |
| KI-021 | Reported (code review) | Excel export fails for client names with `: \ / ? * [ ]` or two names sharing their first 31 characters (`08_exporters.js:1890, 1935`). |
| KI-023 | Reported (code review) | Ratings with an agency prefix ("CRISIL AAA", "ICRA AAA") fall into the wrong rating bucket (`07_engine.js:881-882`). |
| KI-025 | Reproduced | `index.html` has 3 raw NUL bytes (UI string keys) and 51,671 U+FFFD in SheetJS's codepage tables; grep/ripgrep treat it as binary and silently stop. Search `.blocks/` instead. |
| KI-027 | Reproduced | `EQUITY_ANALYTICS` sector mix of "UTI Infrastructure Fund-Reg(IDCW)" sums to 99.912 (tolerance 0.05) — vendor data; recheck at the next refresh. |
| KI-028 | Reported (code review) | Dead `window.IPS_PROFILES` (`11_app_ui.js:3841-3868`) holds IPS bands that disagree with the live table (`:4680-4709`); `norm2` (`07_engine.js:37`) is unused. Risk: someone edits the wrong table. |
| KI-029 | Confirmed (code) | AI Analyst signal weights are marked in code as "a proposal … awaiting Products Team sign-off" (`07_engine.js:1895-1907`). Open product decision. |
| KI-030 | Confirmed (code) | Overlap uses stored holdings, which may be a fund's top 30 only, so broad funds' overlap is understated (`07_engine.js:1342-1343`). |
| KI-033 | Reported (code review) | PMS/AIF performance upload is read by column position and always ×100 (`09_parsers.js:214-220`): sensitive to vendor layout changes. |
| KI-034 | Reported (code review) | PPTX performance footnote always shows the Regular-plan date, even with Direct selected (`08_exporters.js:1735`). |

## KI-026 — Inherited from the previous owner (handover §11, not re-tested)
- `AIF_PERF` (12 records, 30 Jun 2026): no source file has ever been supplied.
- `PMS_PERF` returns at 31 Jul 2026; `mcap`, `category`, `inception` carried from older builds; PMS names
  drift monthly (matched on a normalised key). PMS/AIF inception dates may be ±1 day.
- `MF_BENCHMARKS`: legacy values of unknown provenance; Beta/Down-capture rendered 1.00 / 100%,
  alpha/corr/IR blank.
- `FUND_RANKS` at 15 Aug 2026, Regular plans only; "unscored" means no entry and is not a negative signal.
- In-browser `parsePAsheet` assumes the older PMS/AIF sheet layout.
- An uploaded MF Monitor takes AUM from a stale column on FoF sheets (the embedded block does not).
- An uploaded SIF Monitor puts the month-end date into the unused `amc` field.
- 35 arbitrage / equity-savings hybrids report eq + db > 105%; the engine falls back to 100 − eq.
- Within one AMC, generic tokens can still carry a match (e.g. Nifty Metal ETF → Nifty 100 ETF); a fix
  needs idf-weighted tokens measured both ways — do not "fix" with a stop-list.
- Exit load is deliberately not consumed; the AI Analyst reports it as absent.
- ~28 index ETFs ship vendor-published, split-corrupted 3Y risk stats; nulling them is an owner decision.
- `Centricity_Portfolio_CMS.html` is obsolete and must not be used (it embeds a July copy of the dashboard).
