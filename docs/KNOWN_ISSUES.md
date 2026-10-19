# Known issues

Register of defects and limitations. KI-001 to KI-046 were recorded at the handover (baseline `index.html` MD5
`173F86CA…`, source commit `cab22e6`). KI-047 to KI-098 were found by the **full audit of 19 Oct 2026**
([`audits/2026-10-19-full-audit.md`](audits/2026-10-19-full-audit.md)).

That audit re-tested most of the earlier entries:
- KI-006 and KI-007 are now reproduced at runtime.
- KI-044 no longer reproduces.
- KI-045 is contradicted in part.
- KI-008, KI-024 and KI-035 are wider than first recorded.

Fixed so far: KI-001, KI-010, and in fix batch 1a KI-006, KI-047, KI-055 and KI-065. Fixes follow the order in the audit register. The owner's decisions are in
[`audits/2026-10-19-decisions.md`](audits/2026-10-19-decisions.md): all recommendations accepted on 19 Oct 2026
except OD-11 (D-021).

**Status key**
- **Reproduced** — demonstrated at runtime during the 14 Oct 2026 replication.
- **Confirmed (code)** — verified by reading the code; not exercised at runtime.
- **Reported (code review)** — found by the archaeology review of the code; not yet verified.
- **Inherited** — listed by the previous owner in the handover (§11); not re-tested.

Code references point into `.blocks/` (`node tools/extract-blocks.js`), baseline line numbers.

## High

### KI-001 — A second client loaded in the same tab inherited the previous family's state — **FIXED**
**Fixed** on branch `fix/ki-001-reset-family-state` (patch `tools/patches/2026-10-15-ki001-reset-family-state.js`,
`index.html` MD5 `173F86CA…` → `F0EB0101…`); live once merged and deployed.
**Was reproduced** at baseline: after reviewing family A and then loading family B's base file without
reloading, B's Analytics tab and Post-Rebalancing Overlap panel listed A's funds; B's Taxation tab kept
A's client scope; A's IRR upload stayed active, so B's Fund IRR was "transaction-based" from A's file and
**B's Excel export carried a "Fund IRR" sheet built from A's IRR file, with A's client names**.
- Causes: the post-rebalancing look-through was cached on the rebalancing deltas alone
  (`11_app_ui.js:3509-3523`), so two families with no actions shared one entry; client uploads
  (`activeRef.IRR`, `:191`; client SOA merged into `EQUITY_ANALYTICS`, `:143`; bonds merged into
  `DEBT_ANALYTICS`, `:132`) were never cleared by `handle()` (`:53-68`); the rebalancing plan reset only
  inside `renderRebal` (`:2859`), which runs after `renderAnalytics` and `renderCVS` had read it
  (`:482-494`); the Taxation scope, slide-picker ticks, overlap selection/threshold and CVS edits were
  never reset.
- Fix: `resetFamilyState()` runs when a base file replaces a loaded one and when the loaded file is
  removed (×). It returns the IRR, PMS/AIF and bonds slots to the embedded defaults and drops the
  look-through, rebalancing, overlap, slide-picker, CVS, taxation and AI-analyst state; market-data
  uploads (MF / Direct / SIF monitors, Market Update) are kept; the status line names what was cleared.
  The post-rebalancing cache is also cleared on every recompute. The first base file of a session clears
  nothing, so client uploads made before it are kept.
- Behaviour to know: loading a corrected file for the same family also clears its IRR / PMS-AIF / bonds
  uploads and its rebalancing plan (re-upload them); the PMS/AIF and bonds slots are cleared whole,
  including a PMS/AIF performance or debt-monitor file uploaded through them.
- Verified: `tools/browser-checks/family-isolation.js` — `isolation()` fails at baseline and passes
  after the fix (9/9); `irrBeforeBase()` and `removeThenReload()` pass; single-family results
  unchanged (61-slide deck, 15-sheet workbook, Fund IRR 13.09% vs 11.88%, no console errors, no
  network requests).

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

### KI-005 — Base-file XIRR units: real files arrive in both forms
**Confirmed (code), and confirmed by the previous owner's records.** `XIRR (%)` and `BMXIRR (%)` are read as
**percent numbers** and divided by 100 (`07_engine.js:736`); the in-app template labels them `XIRR (%)`.
Real client exports have arrived **both** as plain percent (8.79; July 2026 files, and the anonymised
20 May 2026 fixture) **and** as fractions (0.182 for 18.2%; a 6 Oct 2026 export), probably depending on the
report version or how the file was saved (`docs/previous-owner/knowledge/KNOWLEDGE_DUMP.md` §6.3). With a
fraction file and no IRR upload, every XIRR shows **100× too small**, silently. An IRR upload overwrites the
base-file XIRR for matched holdings, so it masks the problem. **Check every new base file:** click an XIRR
cell and read the formula bar. Fix direction: a per-column magnitude test (treat as fractions when the
column's max |value| ≤ 1.5), as `parseSOA` already does for Holding(%). Allocation (%) is read as a fraction
and only used in the Excel export.

### KI-006 — Missing XIRR counted as 0% in client-sheet totals — **FIXED**
**Reported (code review)**; reproduced at runtime by the 19 Oct audit. Asset / product / grand-total rows
weighted XIRR by CMV but treated a missing XIRR as 0 while keeping its CMV in the denominator
(`07_engine.js:1092-1121`).

**Fixed** in fix batch 1a (`tools/patches/2026-10-19-engine-numbers-1.js`):
- Each average is taken over the CMV that has a value.
- Partial subtotals are marked † on the Holdings tab and the holdings slides.
- The client sheet, slide and workbook carry a footnote with the count left out.

Open owner question OD-26: should a row's fund and benchmark average cover the same holdings?

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
| KI-010 | **Fixed** 15 Oct 2026 (CR-0003) | `tools/test-ai-analyst.js` (repo copy, 8,163 bytes) failed 1 of 17: TEST 1 picked a fund *listed* in `FUND_RANKS` with status "1-3yr Warning", which the engine deliberately rates amber; funds with *no* entry correctly get "na". Replaced with the previous owner's current 8,402-byte version from their export (it defines "unscored" as no `FUND_RANKS` entry): 17/17 pass, and CI now runs it as a blocking check. |
| KI-011 | Reproduced | The handover's census one-liner uses `node -e`; under `-e`, `require/module/exports` are globals and the embedded UMD bundles break. Run engine code from a script file. |
| KI-014 | Reproduced | Deck order differs from tab order: AI Analyst and Taxation follow the Annexure divider (`08_exporters.js:1179-1409`), although `11_app_ui.js:266-268` says screen and deck never disagree. May be intended — owner to confirm. |
| KI-015 | Reported (code review) | Home tab "Download slide" gives an empty deck; Rebalancing too when no plan exists (`11_app_ui.js:334-338, 361`). |
| KI-016 | Reported (code review) | Cost note says "AIF default = 200 bps"; the code uses 250 bps (`11_app_ui.js:5256` vs `5170`, `08_exporters.js:449`). The same note says ERs come from the MF Monitor, but the embedded ER table is consulted first. |
| KI-017 | Reported (code review) | "Rebalancing Impact" has no checkbox of its own in the slide picker (`11_app_ui.js:456`). |
| KI-018 | Reproduced | IPS table has 28 rows vs 27 per slide, so "IPS Profile Compliance (2/2)" carries a single row. |
| KI-019 | Reported (code review) | Changing the as-on date wipes the rebalancing plan and the slide-picker ticks (`11_app_ui.js:39, 2450, 2859`). |
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
| KI-035 | Confirmed (code) | Two persisted settings carry from one family to the next (and across sessions): the IPS risk profile (`ips_profile_idx`, `11_app_ui.js:4997, 5014`; slide `08_exporters.js:164`) and the Cost tab's distributor filter (`cost_distributor`, `:5081, 5266`). A family reviewed after another uses the previous family's IPS profile unless the analyst changes it — a correctness risk for the IPS tab and slide. Not part of KI-001 (localStorage, by design today). |

## Inherited from the previous owner's knowledge dump (15 Oct 2026, not re-tested)
Source: `docs/previous-owner/knowledge/KNOWLEDGE_DUMP.md` §4.1 (their numbering in brackets). Items already
covered above are omitted (D1 = KI-005, D2 = KI-004, D3 = KI-002/003, D9 = TESTING acceptance check 7,
D17 = KI-028, D25 = KI-012).

| ID | Issue |
|---|---|
| KI-036 (D4) | `matchInstrument` breaks ties on `Object.keys()` order: re-serialising a block flipped 3 of 1,419 matches. |
| KI-037 (D5) | Hybrid MF positions never get a tax class (`taxClassOf` returns null), so they land in Taxation "unmapped" (seen in the smoke test too). |
| KI-038 (D6) | The July aggregator defaulted a missing debt rating to AAA (against never-fabricate); check whether `buildtools/build_refresh.js` kept that default. |
| KI-039 (D7) | Issuer top-30 normalisation differs between the build (rescale top 30 to 100) and the browser (divide by the full total). Owner decision pending. |
| KI-040 (D10) | Loss slides print sub-lakh losses as ₹0.00 Cr; detail pages leave ~1.4" unused. |
| KI-041 (D11) | "Top Underlying Holdings" aggregates raw names (duplicates, shows TREPS) while the unique-stock KPI de-duplicates. |
| KI-042 (D14, D15, D16) | IPS: "BBB & below" always 0% (BBB is folded into "AA & Below"); the unlisted denominator counts debt AIFs; the Real Estate row's actual is unverified. |
| KI-043 (D20) | CVS inflation-adjusted return 7.99% vs the owner's Excel ~9.84%, never reconciled. |
| KI-044 (D21) | Large & Mid Cap benchmark row may be blank in MF Analysis since Nifty LargeMidcap 250 was removed (12 Jun). **No longer reproduces** (audit 19 Oct 2026: `MF_BENCHMARKS` now holds Nifty 500 - TRI). |
| KI-045 (D22, D23, D24) | Data gaps by design or vendor: a large-cap fund missing from the vendor equity analytics; some funds have MF_RISK only as IDCW rows; two MF_ER_TABLE keys still on the all-in ratio (no base ever published). **Contradicted in part** (audit 19 Oct 2026): Growth holdings of IDCW-only funds get the IDCW row, not blanks; see KI-053. |
| KI-046 (D8) | A "dashboard not opening" report (25 Aug) was never reproduced; the double-click (`file://`) path has never been tested by Claude. (The 15 Oct "localhost not working" report had a different cause: the preview server only runs during a Claude session; fixed with `tools/open-dashboard.cmd`.) |

## KI-026 — Inherited from the previous owner (handover §11, not re-tested)
- `AIF_PERF` (12 records, 30 Jun 2026): no source file has ever been supplied.
- `PMS_PERF` returns at 31 Jul 2026; `mcap`, `category`, `inception` carried from older builds; PMS names
  drift monthly (matched on a normalised key). PMS/AIF inception dates may be ±1 day.
- `MF_BENCHMARKS`: legacy values of unknown provenance; Beta/Down-capture rendered 1.00 / 100%,
  alpha/corr/IR blank.
- `FUND_RANKS` at 15 Aug 2026, Regular plans only; "unscored" means no entry and is not a negative signal.
- In-browser `parsePAsheet` assumes the older PMS/AIF sheet layout.
- An uploaded MF Monitor takes AUM from a stale column on FoF sheets (the embedded block does not). The audit
  found the upload degrades more than this (register KI-026). **Owner decision OD-11 (D-021):** the upload stays,
  and is to be made to match the monthly refresh.
- An uploaded SIF Monitor puts the month-end date into the unused `amc` field.
- 35 arbitrage / equity-savings hybrids report eq + db > 105%; the engine falls back to 100 − eq.
- Within one AMC, generic tokens can still carry a match (e.g. Nifty Metal ETF → Nifty 100 ETF); a fix
  needs idf-weighted tokens measured both ways — do not "fix" with a stop-list.
- Exit load is deliberately not consumed; the AI Analyst reports it as absent.
- ~28 index ETFs ship vendor-published, split-corrupted 3Y risk stats; nulling them is an owner decision.
- `Centricity_Portfolio_CMS.html` is obsolete and must not be used (it embeds a July copy of the dashboard).

## Found by the full audit of 19 Oct 2026

Found and independently reproduced by the 19 Oct 2026 audit. The evidence, fix approach and owner questions for each
entry are in [`audits/2026-10-19-full-audit.md`](audits/2026-10-19-full-audit.md) under its audit ID. The owner
decisions are in [`audits/2026-10-19-decisions.md`](audits/2026-10-19-decisions.md). Priority: **P0** = wrong numbers,
data integrity or security that could reach a client; **P1** = output defects and robustness; **P2** = minor.
Status: **Reproduced** unless marked fixed.

| KI | Audit ID | P | Kind | Issue | Owner decision |
|---|---|---|---|---|---|
| KI-047 | NEW-1 | P0 | calculation | **FIXED** (fix batch 1a) — XIRR solver invents 10000% / 10% for same-day flows | no |
| KI-048 | NEW-2 | P0 | calculation | Client-sheet asset/product XIRR/BMXIRR joined by IRR-file labels | no |
| KI-049 | NEW-3 | P0 | calculation | IRR aggregates not reconciled to the base file or validated | yes |
| KI-050 | NEW-4 | P0 | calculation | Renamed/legacy scheme names matched to a different fund | yes |
| KI-051 | NEW-5 | P0 | data | Bonds, unlisted shares, MLDs treated as MFs | yes |
| KI-052 | NEW-6 | P0 | data | FUND_RANKS / MF_RISK keyed under stale spellings | partly (renames) |
| KI-053 | NEW-7 | P0 | calculation | MF Analysis risk ratios from two unanchored matchers | no |
| KI-054 | NEW-8 | P0 | calculation | Direct-plan view substitutes or drops schemes | no |
| KI-055 | NEW-9 | P0 | calculation | **FIXED** (fix batch 1a) — Hybrid underlying stocks scaled twice | no |
| KI-056 | NEW-10 | P0 | parsing | Vendor Debt Analytics file misread in the bonds slot | no |
| KI-057 | NEW-11 | P0 | data | Holdings with no CMV dropped silently | yes |
| KI-058 | NEW-12 | P0 | parsing | Uploaded monitor ERs stored 100x too large | no |
| KI-059 | NEW-13 | P0 | data | Missing base ER filled with an unsourced estimate | yes |
| KI-060 | NEW-14 | P0 | data | ER override above 300 bps cut 100x on next load | no |
| KI-061 | NEW-15 | P0 | calculation | AI Analyst AMC cap bypassed by label mismatch | no |
| KI-062 | NEW-16 | P0 | calculation | AI Analyst degraded Exit keeps stale unfunded / AMC-after | yes (behaviour) |
| KI-063 | NEW-17 | P0 | calculation | "Apply plan" writes part of the release | no |
| KI-064 | NEW-18 | P0 | calculation | Taxation rupee ledger misallocates LT/ST | yes |
| KI-065 | NEW-19 | P0 | calculation | **FIXED** (fix batch 1a) — Corporate/Dynamic Bond MFs taxed as listed bonds | no |
| KI-066 | NEW-20 | P0 | calculation | IPS compliance verdicts wrong | yes |
| KI-067 | NEW-21 | P0 | calculation | CVS splits hybrids by the portfolio-wide equity share | no (rule 3) |
| KI-068 | NEW-22 | P0 | ui-state | CVS tab/slide ignore the rebalancing plan | no |
| KI-069 | NEW-23 | P1 | calculation | Taxation lot join: exact names, distributor split | yes (apportionment) |
| KI-070 | NEW-24 | P1 | calculation | Taxation ignores common transaction types | yes |
| KI-071 | NEW-25 | P1 | calculation | Two G/L definitions disagree | yes |
| KI-072 | NEW-26 | P1 | output-xlsx | Unmatched PMS/AIF/SIF filed under MF buckets | no |
| KI-073 | NEW-27 | P1 | data | Missing benchmark series shown as all-dash rows | yes (series) |
| KI-074 | NEW-28 | P1 | robustness | Base loader: wrong sheet/header row, misleading error | no |
| KI-075 | NEW-29 | P1 | parsing | IRR parser silently drops or misdates rows | no |
| KI-076 | NEW-30 | P1 | robustness | Direct/Regular monitor slots swappable with no warning | no |
| KI-077 | NEW-31 | P1 | parsing | SOA Product Category must be exactly "PMS"/"AIF" | no |
| KI-078 | NEW-32 | P1 | output-pptx | PPTX tables/panels sized by fixed counts overflow | no |
| KI-079 | NEW-33 | P1 | output-pptx | Exports ignore the review's money unit | no |
| KI-080 | NEW-34 | P1 | calculation | AI Analyst rounding/thresholds in absolute ₹ Cr | yes |
| KI-081 | NEW-35 | P1 | output-pptx | CVS slide calls assumptions "IRR%", omits inflation rows | no |
| KI-082 | NEW-36 | P1 | output-pptx | Deck drops MF Analysis disclosures and client-scope label | no |
| KI-083 | NEW-37 | P1 | output-pptx | PMS/AIF data captioned with the MF date | no |
| KI-084 | NEW-38 | P1 | output-xlsx | XLSX liquidity % in the Investment Amount column | no |
| KI-085 | NEW-39 | P1 | output-xlsx | XLSX analytics sheets lack vintage and coverage | yes (deck) |
| KI-086 | NEW-40 | P1 | ui-state | CVS typed values revert to house defaults | no |
| KI-087 | NEW-41 | P1 | ui-state | Cleared as-on date becomes "20 May 2026" | no |
| KI-088 | NEW-42 | P1 | robustness | Blocked browser storage blanks tabs, breaks the deck | no |
| KI-089 | NEW-43 | P1 | ui-state | Re-picking the same file is ignored | no |
| KI-090 | NEW-44 | P2 | output-pptx | Negative figures dark red on black | no |
| KI-091 | NEW-45 | P2 | output-pptx | Pie/doughnut labels whole-percent | no |
| KI-092 | NEW-46 | P2 | output-pptx | Deck category order; single-distributor slides exported | yes |
| KI-093 | NEW-47 | P2 | output-xlsx | XLSX Base File Allocation blank/unreliable | yes |
| KI-094 | NEW-48 | P2 | output-xlsx | XLSX allocation sheets pre-rounded | no |
| KI-095 | NEW-49 | P2 | ui-state | Overlap panels' Clear buttons cross-wired | no |
| KI-096 | NEW-50 | P2 | data | Benchmark index rows offered as funds in the picker | no |
| KI-097 | NEW-51 | P2 | data | MF_CAT_BM documented but never read | no |
| KI-098 | NEW-52 | P2 | security-privacy | Gmail address in public commit history | yes |

### Found while fixing (batch 1a review, 19 Oct 2026)

Both pre-date the fixes; the reviewers confirmed the shipped code behaves the same before and after the batch.

| KI | P | Kind | Issue |
|---|---|---|---|
| KI-099 | P2 | calculation | Products named "ETF(s)", "Index Fund(s)" or "Fund of Funds" (instead of "Mutual Fund(s)") skip the mutual-fund branch of `taxClassOf`: a G-Sec ETF / index fund is still taxed as a G-Sec, a bond ETF or FoF as a listed bond, and some debt ETFs / FoFs come out unclassified. Fix: one engine-scope "is a mutual-fund product" test (the AMC tab's `_isMFbook` pattern) for these guards and the MF branch. |
| KI-100 | P1 | calculation | With an IRR file loaded, a holding whose transaction XIRR cannot be computed (e.g. one-signed flows, a missing benchmark series) keeps its base-file XIRR under the "transaction-based" caption and disagrees with the Fund IRR sheet (`07_engine.js:1032`). Belongs with KI-048 / KI-049 (one reconciled set of flows). |
