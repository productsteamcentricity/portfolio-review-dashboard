# Known issues

Register of defects and limitations. KI-001 to KI-046 were recorded at the handover (baseline `index.html` MD5
`173F86CA…`, source commit `cab22e6`). KI-047 to KI-098 were found by the **full audit of 19 Oct 2026**
([`audits/2026-10-19-full-audit.md`](audits/2026-10-19-full-audit.md)). KI-129 to KI-139 come from the Phase 0 audit
of the new build (CR-0006), [filed on 22 Oct 2026](#filed-from-the-new-build-audit-22-oct-2026). KI-140 to KI-147
come from milestone M1.3 of the new build, [filed on 23 Oct 2026](#found-by-milestone-m13-23-oct-2026). KI-160 to
KI-182 come from the [tax review of 24 Oct 2026](#found-by-the-tax-review-against-the-ty-2026-27-reckoner-24-oct-2026)
against the TY 2026-27 Tax Reckoner (CR-0008, D-040).

That audit re-tested most of the earlier entries:
- KI-006 and KI-007 are now reproduced at runtime.
- KI-044 no longer reproduces.
- KI-045 is contradicted in part.
- KI-008, KI-024 and KI-035 are wider than first recorded.

Fixed so far: KI-001, KI-010; in fix batch 1a KI-006, KI-047, KI-055 and KI-065; in fix batch 1b KI-007,
KI-048, KI-061, KI-062 (bookkeeping), KI-063, KI-067, KI-068, KI-100, KI-114 and KI-120; in fix batch 2a KI-112
(with OD-32 and OD-34), KI-124 and the Home part of KI-015, and with OD-32 KI-138 (filed after the fix); in tax batch T1
(CR-0008, branch `fix/legacy-batch-3-tax`, not yet merged) KI-162 to KI-165, KI-170, KI-172 to KI-174 and KI-178 to
KI-180, with KI-099 and the categorical part of KI-037; in tax batch T2 (branch `fix/legacy-batch-3-tax-p2`, not yet
merged) KI-160, KI-161 and KI-176, with KI-022, and the disclosure step of KI-177; in tax batch T3 (branch
`fix/legacy-batch-3-tax-p3-r2`, not yet merged) KI-166 to KI-169, KI-171, KI-175, KI-181 and KI-182, with KI-130 and
the PMS case of KI-064, and in T4 (the re-review of T3, the same branch) crypto kept out of set-off (KI-182). Fixes follow
the order in the audit register. The owner's decisions are in
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
on the intended basis. **Owner decision OD-1 (D-021): the mutual-fund book.** Fix batch 1b (KI-061) already keys
every AI Analyst AMC figure by fund house and moves it only with mutual-fund-book positions (a PMS/AIF/SIF/stock
trim or top-up never frees or uses a house's room). The cap itself is still 20% of total CMV until OD-1 is built.

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

### KI-007 — Missing invested value becomes 0 — **FIXED**
**Reported (code review)**; reproduced at runtime by the 19 Oct audit. A blank invested value was stored as 0
(`07_engine.js:764`): the holding showed 0.00, and Total Gain/Loss and Taxation counted its whole CMV as gain.

**Fixed** in fix batch 1b (`tools/patches/2026-10-19-invested-and-irr-join.js`):
- The value stays null and shows "—"; merged folios with any blank are blank.
- Invested value and gain/loss are totalled only over holdings that have one (review totals, Asset Allocation,
  client sheets). Partial figures, Absolute Return % included, carry ‡ and a footnote gives the count and share
  of CMV (screen, deck, workbook, Rebalancing Holding Sheet).
- Taxation takes its `glMissing` path; its Total Gain/Loss label and totals name the count.
- The gain/loss definition is unchanged (OD-18, market value minus invested value). On a ‡ row, invested +
  gain/loss no longer equals CMV, which is why the ‡ is there. Test: `tools/regression/KI-007-blank-invested.js`.

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
**Tax review (24 Oct 2026):** confirmed and split into KI-160 (TX-01, the anniversary rule) and KI-176 (TX-17, the
reference date); D-040 (a) and (b) set the defaults. **Both fixed in tax batch T2** (CR-0008): a lot is long term from
the day after its anniversary, and holding periods run to the base file's valuation date. The base file's Purchase
Date is still not used: the lots come from the IRR sheet.

### KI-024 — Benchmark routing edge cases
**Reported (code review).** The Debt MF bucket requires Asset exactly "Debt"; other labels ("Fixed
Income") route as equity and receive an equity benchmark; Debt PMS/AIF get Nifty 500 TRI; the commodity
rule runs before the debt rules (`07_engine.js:639-694, 952, 1372-1374`).

### KI-031 — Clearing an upload does not fully revert derived values
**Reported (code review).** After clearing the IRR upload, matched holdings keep the transaction XIRR
while the page says XIRR comes from the base file (`07_engine.js:1022`, `11_app_ui.js:224-231, 1360`);
after a reference reset, holdings that no longer contribute are not listed as excluded
(`07_engine.js:1147, 1234-1237`). Since fix batch 1b, holdings blanked by the KI-100 rule also stay blank after
the IRR upload is cleared. Workaround: reload the page.

### KI-032 — IRR client names resolved fuzzily
**Reported (code review).** Base-file clients are joined to IRR clients on ≥ 2 shared name tokens
(`07_engine.js:1012-1015`): a client could pick up a family member's flows when two names share tokens.
**Reproduced** with the synthetic book (fix batch 1b review): when Sample Client B has no IRR transactions it
resolves to Sample Client A on two shared tokens, and takes A's Grand Total and flows. Since fix batch 1b the
§ note shows that none of B's holdings matches an instrument, but the join itself still needs its own fix.

## Low

| ID | Status | Issue |
|---|---|---|
| KI-010 | **Fixed** 15 Oct 2026 (CR-0003) | `tools/test-ai-analyst.js` (repo copy, 8,163 bytes) failed 1 of 17: TEST 1 picked a fund *listed* in `FUND_RANKS` with status "1-3yr Warning", which the engine deliberately rates amber; funds with *no* entry correctly get "na". Replaced with the previous owner's current 8,402-byte version from their export (it defines "unscored" as no `FUND_RANKS` entry): 17/17 pass, and CI now runs it as a blocking check. |
| KI-011 | Reproduced | The handover's census one-liner uses `node -e`; under `-e`, `require/module/exports` are globals and the embedded UMD bundles break. Run engine code from a script file. |
| KI-014 | Reproduced | Deck order differs from tab order: AI Analyst and Taxation follow the Annexure divider (`08_exporters.js:1179-1409`), although `11_app_ui.js:266-268` says screen and deck never disagree. May be intended — owner to confirm. |
| KI-015 | Home part **fixed** (fix batch 2a, with KI-124) | Home tab "Download slide" gave an empty deck; Rebalancing too when no plan exists (`11_app_ui.js:334-338, 361`). Home now has no download bar, and a single-tab download whose deck would hold no slide is refused with a status message, whatever the tab. The Rebalancing case with no plan is not re-tested in the browser. |
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
| KI-037 (D5) | Hybrid MF positions never get a tax class (`taxClassOf` returns null), so they land in Taxation "unmapped" (seen in the smoke test too). **Fixed in part by KI-170** (tax batch T1): aggressive, balanced and conservative hybrids take their reckoner bucket; balanced advantage, dynamic asset allocation, equity savings, multi asset and life cycle funds stay unclassified by design (their bucket depends on the year's holdings), now with the reason shown. The smoke test's multi asset fund is one of them. |
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
| KI-048 | NEW-2 | P0 | calculation | **FIXED** (fix batch 1b) — Client-sheet asset/product XIRR/BMXIRR joined by IRR-file labels. Now the client's holdings joined by client + instrument, plus redeemed or unresolvable instruments placed by the IRR file's labels (the since-inception scope OD-4 keeps); unplaceable ones are footnoted § | OD-36 |
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
| KI-061 | NEW-15 | P0 | calculation | **FIXED** (fix batch 1b) — AI Analyst AMC cap bypassed by label mismatch. One canonical house key (`ENGINE.amcKey`); house figures move only with mutual-fund-book positions. Fix batch 2a adds the former house names (OD-32: "IDFC" is Bandhan, "L&T" is HSBC, and so on) and "AMC not given" for a blank or placeholder label (OD-34, KI-112) | OD-32 (built, 2a), OD-33 |
| KI-062 | NEW-16 | P0 | calculation | **FIXED (bookkeeping)** (fix batch 1b) — AI Analyst degraded Exit keeps stale unfunded / AMC-after. The behaviour (fall back to Retain with a note) is accepted as OD-14 and follows in a later batch | yes (OD-14) |
| KI-063 | NEW-17 | P0 | calculation | **FIXED** (fix batch 1b) — "Apply plan" writes part of the release. Every member row is written; per-row rationale; exact "Applied" badge | OD-31 |
| KI-064 | NEW-18 | P0 | calculation | Taxation rupee ledger misallocates LT/ST. The tax review adds the PMS case as KI-169 (TX-10, D-040 h). Tax batch T3: a PMS and a Category I, II or III AIF are no longer split at all (KI-169, KI-171, KI-166); the rupee ledger still splits other priceless holdings (switch-ins), so the rest stays open | yes |
| KI-065 | NEW-19 | P0 | calculation | **FIXED** (fix batch 1a) — Corporate/Dynamic Bond MFs taxed as listed bonds | no |
| KI-066 | NEW-20 | P0 | calculation | IPS compliance verdicts wrong | yes |
| KI-067 | NEW-21 | P0 | calculation | **FIXED** (fix batch 1b) — CVS splits hybrids by the portfolio-wide equity share. Now each by its own sleeve; FoFs and hybrids with no sleeve go to "Unallocated †" with a blank return | OD-29, OD-30 |
| KI-068 | NEW-22 | P0 | ui-state | **FIXED** (fix batch 1b) — CVS tab/slide ignore the rebalancing plan | no |
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
| KI-086 | NEW-40 | P1 | ui-state | CVS typed values revert to house defaults. Since fix batch 1b a plan refresh keeps them; a full re-render (recompute, Re-seed, reference upload) still resets them, the Unallocated returns to blank | no |
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
| KI-099 | P2 | calculation | **FIXED** with KI-178 (tax batch T1): one engine-scope test, `MF_BOOK_PRODUCT`, for the tax guards, the mutual-fund branch and the AMC tab. Was: products named "ETF(s)", "Index Fund(s)" or "Fund of Funds" (instead of "Mutual Fund(s)") skip the mutual-fund branch of `taxClassOf`: a G-Sec ETF / index fund is still taxed as a G-Sec, a bond ETF or FoF as a listed bond, and some debt ETFs / FoFs come out unclassified. Fix: one engine-scope "is a mutual-fund product" test (the AMC tab's `_isMFbook` pattern) for these guards and the MF branch. |
| KI-100 | P1 | calculation | **FIXED** (fix batch 1b, with KI-048): blank and counted in the § footnote. Was: with an IRR file loaded, a holding whose transaction XIRR cannot be computed (e.g. one-signed flows, a missing benchmark series) keeps its base-file XIRR under the "transaction-based" caption and disagrees with the Fund IRR sheet (`07_engine.js:1032`). Belongs with KI-048 / KI-049 (one reconciled set of flows). |

### Found while fixing (batch 1b reviews, 19 Oct 2026)

All pre-date fix batch 1b unless marked. The reviewers confirmed the synthetic books give the same numbers before
and after the batch, except where the fixes intend.

| KI | P | Kind | Issue |
|---|---|---|---|
| KI-101 | P1 | calculation | A Hybrid-tagged **equity** fund can match the wrong hybrid record on brand tokens alone: "Aditya Birla SL Midcap Fund(G)" tagged Hybrid gets "Aditya Birla SL Arbitrage Fund(G)", so its look-through and CVS split come from another fund. Matching rules are fixed (rule 4); needs a measured change. |
| KI-102 | P1 | calculation | HARD RULE 2 (an Exit needs a funded destination) is checked before the final AMC-cap cut, so an Exit whose destinations are all cut stays an Exit with 100% unplaced. Fix together with OD-14 (degraded Exit falls back to Retain). |
| KI-103 | P2 | ui text / exports | On a reduction spread over several Rebalancing rows (KI-063), the engine's position-level clauses are repeated on every row: "₹X Cr of this release could not be placed" (adding the rows overstates the unplaced amount) and the tax clause ("₹0.98 Cr of this holding is long term …" on a ₹0.63 Cr Direct row quotes the whole scheme's lots). Only the recommendation clause is per row. Say "of the combined position" on such rows, or split the clauses per row. |
| KI-104 | P2 | ui text / exports | Rationale units on Lakh files: the per-row clause uses the file's unit, while the engine's own text always says Cr (`07_engine.js:2849, 2882`), so one Rationale column can mix L and Cr. **Owner decision OD-35 (accepted 21 Oct 2026):** the file's unit everywhere, built with OD-19. |
| KI-105 | P3 | ui-state | Two holdings in different AI positions whose names normalise alike share one Rebalancing row; the acting position's % then applies to the whole row. The status line names it ("reached by two positions"). Low likelihood. |
| KI-106 | P3 | ui-state | After a client-scope analytics recompute, the family's mutual-fund rows can show their own AMC label instead of the house's one name in an AI recommendation's AMC name and impact text (`computeReview` mutates shared row objects). Numbers, keys and caps are unaffected. |
| KI-107 | P3 | calculation | A merged AI position takes its mutual-fund-book flag from its largest member. Not seen in practice (performance keys are per product class). |
| KI-108 | P2 | test | `aiaFloor2` floors float dust (0.4999999 → 0.49), so a top-up can come out 0.01 Cr low; the KI-061 §6 test pins 0.50 and could fail after a data refresh without a real defect. |
| KI-109 | P2 | output-pptx | Taxation holding-detail slide: with many unreconciled holdings (24 in a synthetic worst case) the footer's third line touches the black band. **Also the tax class slide (tax batch T2, 27 Oct 2026):** when every conditional footnote sentence applies at once (trades after the valuation date left out, units bought before 1 Apr 2023, lots before 1 Feb 2018, unreconciled and unclassified holdings, ELSS in lock-in), the footnote (606 characters there) runs to a third line that touches the band (rendered in PowerPoint on a synthetic 16-class book). A line holds about 260 characters, so it stays on two lines up to about 520. **Tax batch T3 (27 Oct 2026):** the class footnote adds two short conditional sentences (holdings not split or at fund level; the Crypto source, about 145 characters together); a synthetic 14-class family book with the IRR-date tag, units before 1 Apr 2023, a PMS, both AIF kinds and crypto rendered on two lines. The holding-detail footnote is unchanged (a sentence drafted for it made a third line and was dropped; the cells say "Not split" or "Fund level"). |
| KI-110 | P2 | output-pptx | Holdings slides assume names wrap to at most two lines. Without notes a page takes 13 rows; 13 two-line names end about 6.99 in, just past the one-line footer's top (still above the band). Names of about 85+ characters wrap to three lines: QA (19 Oct 2026) saw the notes box print over the Grand Total row (with an IRR file), and with only the ‡ note the Grand Total row run into the black band. Main overflows worse on the same book (Grand Total off the slide), so it is not a regression of fix batch 1b. Fix: measure row heights from the wrapped name length. |
| KI-111 | P2 | calculation | The Fund IRR tree joins clients by exact name; the client sheets normalise case and punctuation. A client spelled differently in the two IRR sheets gets a blank tree benchmark but a client-sheet one. |
| KI-112 | P2 | calculation | **FIXED** (fix batch 2a, OD-34). Mutual-fund rows with a blank AMC label formed one unnamed house: it could head the AI Analyst's "largest AMC after" with no name, and its cap was only half enforced. Now a label with no letter or digit, or a placeholder ("NA", "N/A", "N.A.", "Not Available", "Unknown", "Others", "Other", "-", "--"), is "AMC not given": a grey bar and a footnote with the count on the AMC tab, slide and workbook, outside every house's cap, still in the mutual-fund book total. The Observations and the AMC slide insight give its share and call the book well diversified only when the largest house would stay within the cap even holding all of it. Test: `tools/regression/OD-34-amc-not-given.js`. |
| KI-113 | P2 | calculation | Merged duplicate folios add up only the G/L values present, so a merged row's G/L can be partial (OD-18 work). |
| KI-114 | P1 | ui-state | **Fixed in fix batch 1b.** Every CVS input redrew the whole table on each keystroke, so the focus was lost after the first character ("12" typed at a normal pace became 1.00; confirmed in the browser). Typing now updates the figures only; the table redraws when the entry is committed (Enter, leaving the cell, spinner). Test: `tools/regression/KI-114-cvs-typing.js`. |
| KI-115 | P2 | output-pptx | CVS slide: the disclaimer (y 7.1 in) is partly covered by the black footer bar (7.23 in); difference cells print "-0 Cr" for differences under 0.5 Cr; the headers say "Curr./Prop. IRR%" while the screen says "Exp. Return %", which a client could read as realised IRR. |
| KI-116 | P2 | calculation | CVS bucket rules: an Equity-tagged SIF falls into Equity > Mutual Funds, and Hybrid-tagged PMS/AIF into the Mutual Funds rows; there is no Equity SIF row (OD-30). |
| KI-117 | P3 | data | `AMC_DISPLAY` lacks newer houses (Old Bridge, The Wealth Company, Angel One, JioBlackRock, Zerodha, Unifi, Capitalmind, Choice, Abakkus, Quantum, Templeton): an AI destination from such a house that is not yet held is named by its first word ("Old", "The"). Display only. |
| KI-118 | P3 | docs | The comment near `07_engine.js:1219` says no hybrid record carries `db.weight`; all 243 do, and 54 have eq + db ≠ 100 (arbitrage ~170–180). The code handles it. |
| KI-120 | P2 | ui text | AI Analyst executive summary named the wrong house beside the "largest AMC" figure: "largest AMC (360 ONE) 51.64% → 38.08%", where 51.64% is Aditya Birla Sun Life's share (`amcBeforeWho`) and only the after figure is 360 ONE's (`amcAfterWho`). Found by QA of fix batch 1b; also on main. **Fixed in fix batch 1b.** |
| KI-121 | P2 | ui text | The holdings caption says "XIRR/BMXIRR transaction-based" for a client whose § note says it has no IRR transactions (its figures are the base file's), on screen and on the slide. Word the caption per client. |
| KI-122 | P3 | output-pptx | Holdings slides can end a page with a group's subtotal rows and carry its only holding alone to the next page (an orphaned group header). |
| KI-123 | P3 | ui text / exports | The Rebalancing Holding Sheet Grand Total and the XLSX client-sheet invested/G-L totals carry no ‡ when they leave out a holding with no invested value (KI-007); the notes beside them explain it. |
| KI-119 | — | tooling | **Fixed in fix batch 1b.** Re-running an older patch on a newer build could silently insert a second copy of code (`2026-10-15-ki001-reset-family-state.js` re-inserted `resetFamilyState`), because a later patch had edited its text. `patch-lib.js` now refuses a partly-present patch; rebuild by replaying all patches from git in file-name order. |

### Found 21 Oct 2026 (owner's export)

| KI | P | Kind | Issue |
|---|---|---|---|
| KI-124 | P1 | output-pptx | **FIXED** (fix batch 2a). The Home tab's "Download slide" button produced an empty deck (0 slides). `ensureDlBtns` (`11_app_ui.js:365-369`) added a download bar to all 20 tabs, including Home, which has no slide; `tabHasContent` returned true for it, so `buildPPTX(..., "home")` wrote a deck with no slides. Seen in a downloaded "…_Home_….pptx" (39 KB, no slides). Now Home has no download bar, and `slidePPTX` refuses any single-tab deck with no slide (a status message, no download). Test: `tools/regression/KI-124-empty-slide-export.js`. |

### Found while fixing (batch 2a review, 22 Oct 2026)

Both pre-date fix batch 2a.

| KI | P | Kind | Issue |
|---|---|---|---|
| KI-125 | P3 | ui text / exports | On a book with no mutual funds at all, the AMC slide's insight still reads "AMC exposure is well diversified. The largest fund house is —, within the 20% per-AMC cap." (`08_exporters.js` INS.amc; the same claim, with dashes, before batch 2a). Building that slide also makes PptxGenJS log `"" is not a valid scheme color or hex RGB! "000000" used instead.` (seen in the browser QA of fix batch 2a; reproduced headlessly on main `EF2FF4F1…` and on `911A0465…`). Say that there is no mutual-fund book to measure, or leave the AMC slide out of such a deck. |
| KI-126 | P3 | ui text / exports | Generated prose still uses dashes as sentence punctuation in many places, for example the Observations product sentence ("selective PMS and AIF strategies — from Centricity's focused list — would …"), the overlap and performance slide insights, and several SWOT bullets. The owner's rule (22 Oct 2026): no dash inside a sentence; a dash only stands for a missing value. Batch 2a applied it to the AMC sentences and the AMC slide insight only. |

### Found by the browser QA of fix batch 2a (22 Oct 2026)

Both pre-date fix batch 2a: the same code is on main (`EF2FF4F1…`).

| KI | P | Kind | Issue |
|---|---|---|---|
| KI-127 | P3 | ui text | The AMC tab's breach note says "exceed" whatever the number of houses: "Breach: Bandhan (25.00%) exceed the 20% per-AMC cap." (`11_app_ui.js:577`, `renderAMC`). For one house it should read "exceeds". The AMC slide insight and the Observations sentence already say "breaches" for a single house (batch 2a). |
| KI-128 | P3 | output-pptx | The single-slide downloads from the rebalancing group's own buttons put the internal key in the file name: "Portfolio Review_<family>_rebalhold_<date>.pptx", "…_postan_…", "…_rbimpact_…". `tabLabel` (`11_app_ui.js:386`) looks only in `TABS` and falls back to the key; these groups' names ("Rebalancing Holding Sheet", "Post-Rebalancing Analytics", "Rebalancing Impact") are in `EXTRA_SLIDES` (`11_app_ui.js:316-322`). The same key would show in `slidePPTX`'s status messages for those groups. The slides themselves download correctly. |

### Filed from the new-build audit (22 Oct 2026)

The Phase 0 audit of the new build (CR-0006) found these on `782794f`: N-1 to N-10 in
[`new-build/01-legacy-system-audit.md`](new-build/01-legacy-system-audit.md) §5.3 (from the engine inventory,
[`new-build/inputs/inventory-engine-exports.md`](new-build/inputs/inventory-engine-exports.md) §10) and the Holdings
finding of the UI inventory (U-23). Each was re-checked on `main` at `2a65a62` (`index.html` MD5 `911A0465…`) before it
was filed, by reading the code (line numbers of that build's `.blocks/`) and, where marked **Reproduced**, by running
the shipped code headless on the embedded reference data or the synthetic book. N-n is KI-(128+n); U-23 is KI-139.
Priorities are proposed. On the live page these follow D-028: calculation, data and security fixes there,
presentation-only changes in the new build.

| KI | From | P | Kind | Issue |
|---|---|---|---|---|
| KI-129 | N-1 | P1 | calculation | Non-credit labels are counted as credit in the debt rating mix. `ratingGroup` (`07_engine.js:943-954`) places a label by its first letter, so "Derivatives" (D), "ADR/GDR" (A) and the defaulted grade "D" fall into "AA & Below", and the short-term "A2+(SO)" is placed by its letter, not by a mapping. **Reproduced** on the embedded data: "Derivatives" in 36 schemes (up to 23.42% of a scheme's debt rating mix), "D" in 4 (at 100%), "ADR/GDR" in 1, "A2+(SO)" in 1. It reaches the Analytics tab and slide, the post-rebalancing analytics, the IPS rating rows (`11_app_ui.js:4949`), the workbook's Debt Analytics sheet and the Observations' high-quality share (`07_engine.js:1742`). New build: three credit buckets with "Derivatives and hedges" and "Non-credit holdings" beside them (Q-46, M4); the legacy fix needs the mapping approved. |
| KI-130 | N-2 | P1 | calculation | Tax-loss harvesting ignores the long-term exemption. `buildHarvest` (`07_engine.js:495-525`) taxes every long-term gain at the long-term rate (`taxOf`, `:515`), while the footnote on the Taxation tab (`11_app_ui.js:4762`) and slide (`08_exporters.js:1706`) says 12.5% applies to gains above Rs. 1.25 lakh. The "tax before" and "tax after" figures therefore include tax on gains the exemption may cover. Confirmed (code). Needs an owner decision: the page does not know how much of the exemption was already used this year (Q-52), and applying it in full could understate the tax. New build: E-43 with Q-52 (M7). Confirmed by the tax review as KI-168 (TX-09); D-040 (f) sets the default (amount already used entered by the analyst, default 0). **FIXED** with KI-168 (tax batch T3): the exemption applies per client after set-off, less the amount the analyst enters. |
| KI-131 | N-3 | P2 | ui text / exports | One SWOT opportunity is unconditional: "Periodic rebalancing is recommended to keep the allocation aligned …" is added for every portfolio (`07_engine.js:1926`), so every Observations tab, SWOT slide and workbook carries it whatever the evidence. Confirmed (code). New build: removed, recorded in the parity ledger ([`new-build/observation-rule-bank.md`](new-build/observation-rule-bank.md) §8). On the live page it is wording, a presentation item under D-028. |
| KI-132 | N-4 | P2 | classification | `isDirectEquity` (`07_engine.js:619-623`) matches the letters "sip" anywhere in a product label that the mutual-fund, PMS, AIF and bond exclusions do not catch first, so a holding whose product reads "SIP" is classed as direct equity and enters the direct-equity look-through and stock returns. **Reproduced** by running the shipped function: "SIP" and "Gossip Ventures" give true, "Mutual Fund SIP" false. Fix with a word boundary, measured over real product labels both ways. |
| KI-133 | N-5 | P2 | output-pptx / data | When the Current vs Sample snapshot (`window._cvsSnapshot`, written by the CVS tab, `11_app_ui.js:5901`) is absent, the CVS slide falls back to a second, hard-coded copy of the house-default groups (`08_exporters.js:595-600`): every current allocation 0.00% beside the default returns. **Reproduced** headless (the smoke test's CVS slide is built from it); in the browser the tab renders before an export, so the fallback is reached only when the snapshot is missing (not seen in the browser). The two copies of the assumptions can drift. New build: one table, `data/owner/cvs-assumptions.json`, and the slide built from the engine. |
| KI-134 | N-6 | P3 | output-pptx | Single-tab downloads start with their section divider. **Reproduced** headless on the synthetic book: the Holdings, Analytics, Overlap, Cost, Fund IRR, Current vs Sample and MF Analysis downloads begin with the divider picture (Overlap: 2 slides, the divider and the matrix slide); Rebalancing with no plan gives the divider alone (the open part of KI-015). Whether a single-slide download carries its divider is a presentation choice; new build: the presentation manifest (M9). |
| KI-135 | N-7 | P3 | ui text / exports | **Same defect as KI-126, tracked there.** The 21 Oct inventory counted en or em dashes in 19 observation and SWOT lines, 15 AI Analyst template lines and 161 string-literal lines of the exporters at `782794f`. Fix batch 2a removed them from the AMC sentences only; they remain elsewhere on `main` (for example `07_engine.js:1917`). The dash stays only as the missing-value marker (D-029). |
| KI-136 | N-8 | P3 | code | Dead code: the exporters build an `INS.perf` sentence (`08_exporters.js:81`) that nothing reads. (`norm2`, `07_engine.js:94`, is unused too; already KI-028.) No effect on any output; dropped in the new build. |
| KI-137 | N-9 | P3 | pipeline | The monthly pipeline runs the page's own upload parsers: `buildtools/build_refresh.js` evaluates `ENGINE.parsers` out of `index.html` through `tools/engine-host.js` (lines 96, 151, 173-184), so a patch to `09_parsers.js` also changes the next refresh's output. Confirmed (code). Until M11, a parser change should be followed by the fidelity rebuild of an archived month (`build_refresh.js --verify`, which needs the private archive; `MONTHLY_REFRESH.md`). New build: one parsing path in `app/src/ingest/` (OD-11). |
| KI-138 | N-10 | — | calculation | **FIXED** in fix batch 2a (OD-32), before it was filed. At `782794f` the former fund-house names accepted in OD-32 were not aliases, so old and new labels got different house keys. Batch 2a added `AMC_RENAMED` (`07_engine.js:56-58`). Re-checked headless on `main`: `ENGINE.amcKey` gives one key for IDFC and Bandhan, L&T and HSBC, Reliance and Nippon India, DSP BlackRock and DSP, Birla Sun Life and Aditya Birla Sun Life, IIFL and 360 ONE. Test: `tools/regression/OD-32-renamed-amc.js`. The new build ports the table to `data/owner/amc-aliases.json` (M2.1). |
| KI-139 | U-23 | P2 | ui-state | The Holdings tab's "Download slide" button disappears after a presentation-column chip is toggled: `czHoldToggle` (`11_app_ui.js:613`) calls `renderHoldings`, which rewrites the whole section (`s.innerHTML=html`, `:658`), download bar included, and the bar is added back only by `ensureDlBtns` (`:365-370`) at the end of `renderAll` (`:536`). Confirmed (code); not checked in the browser. Also noted: the column choice (`window.CZHOLD`, `:597`) is not cleared by `resetFamilyState`, so it carries to the next family in the session (a presentation preference, no client data). New build: download buttons from the slide manifest (M9). |

### Found by milestone M1.3 (23 Oct 2026)

Milestone M1.3 of the new build (CR-0006) compared the new base-file reader with the legacy `parseBaseRows` on
synthetic books (the parity ledger [`tests/parity/base-file-ledger.json`](../tests/parity/base-file-ledger.json), whose
entries BF-nn are named in the Ledger column), and its financial re-review read the legacy code behind the
differences. Each legacy entry was re-checked on `index.html` MD5 `911A0465…` (`main` at `2a65a62`) by reading the
code (line numbers of that build's `.blocks/`) and, where marked **Reproduced**, by running the shipped code
headless on synthetic data. KI-140 to KI-145 are base-file reading defects of the legacy page and KI-146 their IPS
consequence; under D-028 they are live-page data fixes for a later legacy batch (D-035). KI-147 is a defect of the
new reader, for M1.4. "none" in the Ledger column means the new reader does not differ there, so no entry shows
it. Priorities are proposed; every entry is OPEN.

| KI | Ledger | P | Kind | Status | Issue |
|---|---|---|---|---|---|
| KI-140 | BF-18 | P2 | calculation | OPEN | Merged duplicate folios add up only the units present. When one folio of a holding has no units, `parseBaseRows` keeps the sum of the others (`07_engine.js:863`: `if(h.units!=null) m.units=(m.units||0)+(h.units||0)`), a partial figure. Units are the base the tax split reconciles each holding against (`07_engine.js:393-405`), so such a fund is reconciled against too few units. **Reproduced** headless: folios with 100 units and none merge to 100; none and 40 merge to 40. The units counterpart of KI-113 (gain and loss). The new reader leaves the merged units missing and names the gap in `Holding.mergeGaps` (D-035). |
| KI-141 | none | P3 | calculation | OPEN | A merged holding takes the purchase date and holding days of its first folio: the merge adds up the amounts and leaves `purchaseDate` and `days` as the first row's (`07_engine.js:838-867`). **Reproduced** headless: folios bought on 16 Jan 2023 (900 days) and 10 Mar 2025 (200 days) merge into one holding dated 16 Jan 2023 with 900 days. The new reader keeps the first row's values too, for now, and keeps every member row, so the engine can apply another rule (earliest date, unit-weighted holding period) once the owner decides (`DATA_DICTIONARY.md` §8, "Merged folios, first-row fields"). |
| KI-142 | none | P2 | data | OPEN | A row whose Instrument Name is "Total" or "Grand Total" is read as a holding when it has a market value: `parseBaseRows` skips only a row with no instrument name or no market value in any unit (`07_engine.js:806-810`), and the upload handler tests nothing more (`11_app_ui.js:59-60`). A total row of the whole book would double every total and halve every weight. **Reproduced** headless: a "Grand Total" row with 0.5 Cr is read as an Equity mutual fund of 0.5 Cr (asset and product defaulted); "Total" in the Client column with a blank Instrument Name is skipped. The new reader skips a total row without an instrument name, and reads a total-like name as a holding with a Warning (`base-file.total-like-name`, `tests/unit/ingest/base-file.test.ts`). |
| KI-143 | BF-21, BF-22, BF-23, BF-24 | P2 | data | OPEN | Text in a number cell is read up to the first character that is not part of a number, with no notice: `gn` uses `parseFloat` (`07_engine.js:799`) for every amount, units, XIRR, BMXIRR and holding days, so "12abc" reads as 12 and "1.25 Cr" as 1.25. **Reproduced** by the parity suite on `family-a-invalid-text` (legacy market values 1.25 and 12 Cr, invested 1.25 Cr, XIRR 12%, BMXIRR 1.25%) and headless. The new reader marks such a cell INVALID SOURCE DATA and counts it in a Warning (BR-2.5); a holding whose only market value is such text is excluded and listed (OD-8). |
| KI-144 | BF-25 | P3 | data | OPEN | An impossible text date rolls into the next month, with no notice: `fmtPD` builds the date with `new Date(year, month - 1, day)` (`07_engine.js:802`), so "31-02-2024" becomes 2 Mar 2024 (2024 is a leap year). **Reproduced** by the parity suite (`family-a-invalid-text`) and headless. The new reader marks the date INVALID SOURCE DATA (BR-2.5). |
| KI-145 | BF-26, BF-20, BF-15, BF-16 | P2 | calculation | OPEN | Asset Names that differ only in letter case or spacing, or by a synonym, become separate Asset Allocation rows. `parseBaseRows` keeps the label as written with its spaces collapsed (`ws()`, `07_engine.js:818`), and the allocation groups by that exact label: the five classes of `assetOrder` first, then every other label as a row of its own (`07_engine.js:1147-1159`); the client sheets group the same way (`:1271-1274`). **Reproduced** headless on the synthetic book `family-a-odd-asset-labels`: "Equity" 48.1662% and "EQUITY" 6.2063%; "Debt" 9.5113%, "Fixed Income" 7.4437% and "Debt Funds" 11.0015%; "REITs/InvITs" 1.2442% and "REITs / InvITs" 2.0573%. The IPS consequence is KI-146. The new reader reads each of these as its class (OD-7; folding letter case and spacing waits for the owner, `DATA_DICTIONARY.md` §8). Owner question: measure, privately, how common variant labels are in the real base files. |
| KI-146 | BF-26, BF-15, BF-16, BF-20 | P1 | calculation | OPEN | The IPS asset-class actuals take only the last matching Asset Allocation row: `eqCMV`, `debtCMV`, `hybridCMV`, `reitCMV` and `commodityCMV` are assigned, not summed (`11_app_ui.js:4871-4878`), and a row whose label matches none of the patterns, such as "Fixed Income", counts in no class. With the split rows of KI-145, on `family-a-odd-asset-labels` the equity CMV is 0.5427 Cr (the "EQUITY" row) instead of 4.7545 Cr (Equity 4.2118 plus EQUITY 0.5427), debt 0.962 Cr ("Debt Funds") instead of 2.4446 Cr (Debt 0.8317, Fixed Income 0.6509, Debt Funds 0.962), and REITs 0.1799 Cr instead of 0.2887 Cr. **Reproduced** with the allocation rows of the shipped engine run headless and the IPS loop replayed as written (the UI script does not run headless). The equity and debt CMVs are the IPS figures when the analytics have no data (`:4883-4884`) and set the hybrid slices (`:4887`, `:4929`); the REITs and commodity CMVs feed the IPS actuals directly (`:4890-4891`). KI-066 (NEW-20) does not cover this. Fix on the live page: sum the rows of each class. Owner question as KI-145. |
| KI-147 | none (new app) | P2 | data | OPEN | New app, M1.3 reader; for M1.4. `readMoney` (`app/src/ingest/base-file.ts:317-351`) values a holding from the Lakh or rupee column when the Crore cell holds text that is not a number: "12abc" in the Crore column with 1250 in the Lakh column gives 12.5 Cr, and "abc" with a stale 50 Lakh gives 0.5 Cr. **Reproduced** by running the reader on a two-column synthetic sheet. Nothing flags this on the holding (only the value's provenance names the Lakh column), and the file-level Warning (`:826-828`) counts the invalid cell without saying that another column was used. A Crore and a Lakh amount that are both numbers and disagree are not compared. M1.4 scope, in the roadmap's M1.4 acceptance: (a) the owner decides between the fallback, flagged on the holding, and treating the amount as INVALID SOURCE DATA; (b) a notice scoped to the holding that names the column used; (c) a unit test with both Crore and Lakh columns pinning the decided rule; (d) a clear `DATA_DICTIONARY.md` §5.3 sentence in place of "counts as none"; (e) the owner's call on cross-checking Crore against Lakh or rupees. |

### Found by the tax review against the TY 2026-27 reckoner (24 Oct 2026)

The owner supplied the Tax Reckoner for tax year 2026-27 (law as on 19 Oct 2026, Income-tax Act 2025 in force from
1 Apr 2026) as the source of record (CR-0008). A financial review compared it with the live page on `index.html` MD5
`911A0465…` (`main` at `517becf`) and found 23 discrepancies, TX-01 to TX-23; a second reviewer re-verified each from
the reckoner's cells, the TAX_RULES block and the shipped engine run headless on synthetic data, and confirmed all 23.
TX-nn is KI-(159+nn). The lead's defaults for the rules the reckoner leaves open are D-040, each open to the owner's
confirmation. Line numbers are those of the `.blocks/` after tax batch T1 (`index.html` MD5 `5717A796…`), and in the
rows fixed by tax batch T2, of the T2 build (`AE70F78B…`), in the rows fixed by tax batch T3, of the T3 build
(`BB888D8E…`), and in what tax batch T4 changed, of the T4 build (`61FC0FB2…`);
"Probe" figures are the review's synthetic known answers. Rates exclude surcharge and cess, as the page says.

| KI | TX | P | Kind | Status | Issue |
|---|---|---|---|---|---|
| KI-160 | TX-01 | P1 | calculation | **FIXED** (tax batch T2) | A lot turned long term only after 13 (or 25) whole months: `taxBucket` compared whole months with ">", so a lot one day to a month past its 12- or 24-month anniversary was short term. The reckoner: more than 12 months is long term, exactly 12 is short term (Master Summary R3; Change Log #2). Now `taxBucket(rule, buy, asOn, etf)` (`07_engine.js:430`, T2 build) compares calendar days: long term from the day after the anniversary, the months added in calendar months and clamped to the month end (D-040 b; 29 Feb 2024 + 12 months = 28 Feb 2025, for the tax adviser to confirm); `taxMonthsBetween` is removed. "Long term after" reads "More than N months" on the tab and slides. Probe: an equity fund bought 10 Oct 2025 and valued 23 Oct 2026 is LTCG Rs 5,000, Rs 625 of tax (was STCG, Rs 1,000). The first part of KI-022. Test: `tools/regression/KI-160-anniversary-rule.js`. |
| KI-161 | TX-02 | P1 | calculation | **FIXED** (tax batch T2) | Debt fund units bought before 1 Apr 2023 were always short term at slab; the reckoner gives them the general rule: long term after 24 months (12 for a listed ETF), LTCG 12.5%, no exemption (Mutual Funds R17, R26; Master Summary R25-R27; Hybrid Funds & FoFs R7, R24). Now the Specified rows (debt, and conservative hybrid) carry `specifiedFrom` 2023-04-01 and name the row for older units (`before`): new rows "Debt MF bought before 1 Apr 2023" (24 months, `listedEtfMonths` 12) and "Hybrid MF (conservative) bought before 1 Apr 2023" (24 months). Debt FoFs, target maturity funds and debt ETFs take the debt row, so they follow it too; the SIF debt row has no date (SIFs began in 2025). A holding with lots on both sides is two records (one `splitPart`) that add back to its CMV and Gain/Loss and count as one holding; an old lot at a loss is a long-term loss. `irrParseDate` reads a free-text date as its calendar day (on an IST machine "01-Apr-2023" was 31 Mar in UTC). Probe (the verifier's book, 30 Sep 2026): tax before Rs 875, after Rs 250, saving Rs 625 (was 0, 0, 0). Test: `tools/regression/KI-161-specified-from-2023.js`. |
| KI-162 | TX-03 | P1 | calculation | **FIXED** (tax batch T1) | A listed Indian company named "International", "Global" or "Overseas" was taxed as a Global Fund (24 months, short term at slab): the global test ran before the direct-equity test. 286 STOCK_INFO names (Coromandel International, KEC International, Indian Overseas Bank, Global Health). Now direct equity is tested first and the direct-equity product labels include Equity, Shares and Stocks (D-040 c): all 286 are Listed Equity Shares; a share with a positive foreign marker takes the new row "Foreign-listed shares (held directly)". The 29 foreign companies among the 286 carry no marker in the embedded data (no ISIN), so they are Listed Equity Shares; only NXP Semiconductors (a Dutch ISIN in STOCK_RET) is foreign-listed. Test: `tools/regression/KI-162-direct-equity-international.js`. |
| KI-163 | TX-04 | P1 | calculation | **FIXED** (tax batch T1) | Every gold or silver "ETF FoF" (35 per plan) took the 12-month Commodity ETF row; the reckoner gives an unlisted gold or silver FoF 24 months (Master Summary #20; Mutual Funds R31). The name now decides first; ticker names such as GOLDIETF, SILVERETF and GOLDBEES stay 12-month ETFs. Residual for the owner: a gold or silver fund whose Asset Name and category carry no commodity word is still an equity ETF or fund. Test: `tools/regression/KI-163-gold-silver-fof.js`. |
| KI-164 | TX-05 | P1 | calculation | **FIXED** (tax batch T1) | International funds were equity-oriented: the vendor category "Solution Oriented,ETFs,FOFs" made 6 international ETFs and 31 international FoFs or offshore funds (Regular plans) "Equity ETFs", and 2 international index funds were "Equity Mutual Funds" (12 months, STCG 20%). The reckoner: an international FoF or fund is 24 months at slab, an international ETF listed in India 12 months at slab (Master Summary #21, #22). Now Global Funds, or the new row "International ETFs (listed in India)"; the ETF label comes from the name only. Two international FoFs whose names carry no country (Baroda BNP Paribas Aqua, ICICI Pru Strategic Metal and Energy) take the FoF general rule, which has the same parameters. Test: `tools/regression/KI-164-international-funds.js`. |
| KI-165 | TX-06 | P1 | calculation | **FIXED** (tax batch T1) | There was no fund-of-funds test: all 58 FoFs of the vendor category "Debt Oriented" were always short term at slab (only 7 are debt FoFs), the 50 "Hybrid" FoFs were unclassified, and an FoF filed as "Fund of Funds" was an equity fund. Now one FoF branch comes first: international, gold or silver, debt by name, conservative (unclassified), single equity ETF FoF (new row "Equity ETF FoF (90/90)", 29 per plan, pending the 90/90 confirmation fund by fund), and the new row "Fund of Funds (general rule)" for the rest (22 plus 47 per plan). Test: `tools/regression/KI-165-fund-of-funds.js`. |
| KI-166 | TX-07 | P1 | calculation | **FIXED** (tax batch T3) | AIF Category III is taxed at fund level, nothing at investor level (Master Summary #25), but the page split its gain long and short term, taxed the long-short row at 39% in the harvest and set its losses off against other gains. Probe: a Rs 50 lakh gain added Rs 19,50,000 to "Estimated tax before harvesting". Now (D-040 d) the three Cat III rows are `fundLevel` (no months, no rate; the 39% all-in rate is gone): such a holding has no lot ageing and no reconciliation (`taxNotSplit`, `07_engine.js:627`, T3 build), its CMV and Gain/Loss are reported as fund level (`totals.fundLevelCmv`, `fundLevelGain`; LT + ST + not classified + fund level = CMV), apart from "not classified", and it never enters a gain pool, a loss pool or the harvest candidates. The tab and slides show "Fund level" (no more "> null months"), a Fund level column in the totals when one is held, a note, and the AI Analyst gives the reason with no long- or short-term text (verdict n/a). Probe now: tax 0; a Rs 30 lakh Cat III loss no longer "saves" Rs 3,75,000. Open for the owner: whether "Listed AIF" in AIF_PERF means Category III (it stays Cat I/II, now pass-through). Test: `tools/regression/KI-166-aif-cat-iii.js`. |
| KI-167 | TX-08 | P1 | calculation | **FIXED** (tax batch T3) | The Family Level harvest set every client's losses off against every other client's gains in one pool, though set-off and the exemption belong to each person's return (Exemptions & Set-off R10, R13-R16). Probe: client B's Rs 30,000 short-term loss "saved" Rs 11,700 against client A's gain. Now (D-040 f) each client's harvest is worked out on that client's records alone (`taxBuildHarvest`, `07_engine.js:534`, T3 build) and the family harvest is their sum, field by field, with pools and candidates listed per client (`taxSumHarvests`, `taxApplyAssumptions`, `:605`, `:618`). The tab lists pools with a Client column and says whose loss is left over; the family slide adds the clients' pools up by class and head and says the same; holdings with no client name are one group, counted (`unnamedN`). Probe now: saving 0; client B carries Rs 30,000 forward. Test: `tools/regression/KI-167-per-client-harvest.js`. |
| KI-168 | TX-09 | P1 | calculation | **FIXED** (tax batch T3, closes KI-130) | The Rs 1.25 lakh Sec 198 exemption was not applied (KI-130), and its footnote sat under Sec 197 pools where no exemption exists (Master Summary R3, column J; Exemptions & Set-off R10). Now (D-040 f) the rows of listed shares, equity-oriented funds (equity funds and ETFs, ELSS, equity-oriented hybrids, equity ETF FoFs, equity long-short SIFs, equity PMS) and REIT and InvIT units carry `sec198`; in each client's harvest the exemption, Rs 1,25,000 less the amount the analyst enters as already used this tax year (default 0; held to Rs 0 to 1,25,000), applies after set-off to the Sec 198 long-term gains left, in Cr on Lakh and Cr files alike. It has its own line in the pool table; the footnote names only Sec 198 gains and says other long-term gains are taxed in full; the input is on the tab, the amount on the slide. Probe: a Rs 1,00,000 equity gain is taxed 0 (was Rs 12,500), Rs 1,50,000 is Rs 3,125; two clients each keep their own limit. Test: `tools/regression/KI-168-sec198-exemption.js`. |
| KI-169 | TX-10 | P1 | calculation | **FIXED** (tax batch T3) | A PMS was split long and short term by the dates capital was contributed and taxed on CMV less capital; the reckoner taxes each security as if held directly (Master Summary #23). The figure double counted gains taxed earlier and could create a phantom harvest loss. Now (D-040 h, OD-12) the row "Equity PMS" is `perSecurity`: after its flows reconcile a PMS is not split (`07_engine.js:757`, T3 build); its CMV and Gain/Loss stay as not classified; it is out of the pools and the candidates. The tab and slides say "Not split", caption its Gain/Loss as on capital contributed, not a capital-gains figure, and a note states the reckoner's rule and the limitation (no security-level data). The 20% / 12.5% rates stay on the row. Probe: a Rs 0.05 Cr shortfall no longer "saves" Rs 62,500; the sample book's PMS (Rs 0.5065 Cr) leaves the long-term column. Security-level PMS statements are the new build's work (M7). Test: `tools/regression/KI-169-pms-not-split.js`. |
| KI-170 | TX-11 | P2 | calculation | **FIXED** (tax batch T1) | Every hybrid category except arbitrage was unclassified, and the three hybrid rows used the 35%-equity test that ended on 31 Mar 2025, with 20% short term where the reckoner says slab. Now the rows "Hybrid MF (equity-oriented)", "Hybrid MF (general rule)" and "Hybrid MF (Specified, Sec. 76)" replace them: aggressive hybrid (31 per plan), balanced hybrid and conservative hybrid (19 per plan) take their bucket (Hybrid Funds & FoFs R19-R24); balanced advantage, dynamic asset allocation, equity savings, multi asset and life cycle funds stay unclassified with the reason. Fixes the categorical part of KI-037. Test: `tools/regression/KI-170-hybrid-funds.js`. |
| KI-171 | TX-12 | P2 | calculation | **FIXED** (tax batch T3) | AIF Category I and II are pass-through, the holding period counted at AIF level per underlying asset (Master Summary #24), but the page aged the investor's own drawdowns at 24 months and put a 12.5% long-term figure in the harvest; the debt row showed long term at slab. Now (D-040 d) both rows are `passThrough` (no months; rate label "Pass-through"; "At AIF level, per asset"): no lot ageing or reconciliation, not split, its Gain/Loss not classified, out of the harvest, with a note naming the AIF's annual statement (Form 64C), which the page does not have. Probe: the sample book's Alchemy Leaders of Tomorrow no longer adds Rs 1,89,500 to tax before. Test: `tools/regression/KI-171-aif-cat-i-ii.js`. |
| KI-172 | TX-13 | P2 | calculation | **FIXED** (tax batch T1) | SIFs had no branch: all 30 strategies were unclassified under "Add a row for the product", and the AI Analyst called them unreconciled. Now by strategy name (Master Summary #26; Hybrid Funds & FoFs R41-R46): 10 equity long-short and sector rotation strategies take the new row "SIF (equity long-short)", debt long-short the new row "SIF (debt long-short, Specified)"; ex-top 100, hybrid and active asset allocator stay unclassified with the reason. Every unclassified holding now carries its reason on the Taxation tab and in the AI Analyst tax signal. Test: `tools/regression/KI-172-sif.js`. |
| KI-173 | TX-14 | P2 | calculation | **FIXED** (tax batch T1) | ELSS was an equity fund on the 12-month rule: units inside the 3-year lock-in showed as long or short term, "available for rebalancing", in the harvest pools and as harvest candidates (Master Summary #4: short term not possible). Now the row "ELSS (3-year lock-in)" (lockMonths 36): a lot is locked up to and including its third anniversary (D-040), counted as not classified and left out of the amounts available, the harvest and the candidates; the tab, the slides and the AI Analyst name the locked part. Probe: tax before Rs 500 and saving Rs 0 instead of Rs 625 and Rs 125. Test: `tools/regression/KI-173-elss-lock-in.js`. |
| KI-174 | TX-15 | P2 | calculation | **FIXED** (tax batch T1) | The REIT and InvIT tests ran on category and name for every product: two international REIT FoFs and three REIT index funds were "REIT Units" (12 months, 20%) and the US share Invitation Homes an InvIT. Now the REIT FoFs are international FoFs (Global Funds), the REIT index funds are unclassified with the reason, and units held directly keep their rows (CUBEINVIT and TVSINVIT still match). Test: `tools/regression/KI-174-reit-invit.js`. |
| KI-175 | TX-16 | P2 | calculation | **FIXED** (tax batch T3) | Slab-rate pools ranked last in the set-off (a null rate counted as -1), while the tab and slide said losses go to the highest-taxed gains first. Now (D-040 e) losses go first to the gains taxed at the highest rate, a slab-rate gain ranked at the analyst's slab rate per client (default 30%, the top slab, Tax Slabs & Surcharge R13; held to 0% to 30%) but never given a tax figure; the Sec 198 gains inside the unused exemption are taxed at 0% and reached last; at an equal rate the order is fixed (a slab-rate gain first, then other gains before Sec 198 gains, short term before long term, then by class name), never by holding size. The slab-rate gains a loss shelters are shown (`slabSheltered`), their saving not counted; "which is what maximises the saving" is gone. Probe: a Rs 2 lakh short-term loss now shelters a Rs 2 lakh slab gain at the default 30% (saving shown 0) and goes to the 20% gain at a 10% slab (saving Rs 40,000). Tax batch T4 (the re-review of T3): a crypto gain has no place in the order, so no loss reaches it (KI-182). Tests: `tools/regression/KI-175-set-off-order.js`, `KI-182-crypto-no-set-off.js`. |
| KI-176 | TX-17 | P2 | calculation | **FIXED** (tax batch T2) | Holding periods ran to the IRR file's latest transaction, not the base file's valuation date. Now (D-040 a) `taxRefDate` (`07_engine.js:476`, T2 build) picks the base file's own "Valuation Date" column when it has one (the latest date; `parseBaseRows` reads it as `valuationDate`), else the portfolio date set for the review ("As on"), read strictly as "d Mon yyyy" and never the built-in "20 May 2026"; with neither, the IRR sheet's latest date as before, and the tab says so. IRR trades dated after that date are left out of FIFO and counted (`later`); an unreconciled holding's reason says so. The tab and the class slide name the date's source, say when the IRR sheet ends earlier, and name the trades left out, also in one client's view. Probe: a lot bought 20 Sep 2025 with the IRR sheet ending 10 Sep 2026 and the portfolio date 24 Oct 2026 is long term (was short term); a purchase after the valuation date no longer leaves the holding unreconciled. The second part of KI-022. Test: `tools/regression/KI-176-valuation-date.js`. |
| KI-177 | TX-18 | P2 | calculation | **FIXED: disclosure** (tax batch T2); the step-up stays OPEN | Equity lots bought before 1 Feb 2018 are measured on actual cost; the reckoner allows the 31 Jan 2018 price as cost (Master Summary #1 note; Mutual Funds R45). The page has no 31 Jan 2018 prices. Step 1 is done: each holding with an open lot bought before 1 Feb 2018 in a class the grandfathering can cover (shares, equity-oriented fund units, REIT and InvIT units) carries `gfLots`; the Taxation tab names them and states that long-term gains and tax on those lots may be overstated, as do the class slide, the harvest slide and the AI Analyst tax signal. No figure changes and no price is guessed. Step 2 (the step-up itself) needs the owner's rulings on the formula, the Act 2025 section, the share price basis and the scope, and a source of 31 Jan 2018 prices and NAVs. Test: `tools/regression/KI-177-grandfathering-disclosure.js`. |
| KI-178 | TX-19 | P2 | calculation | **FIXED** (tax batch T1, with KI-099) | Products "ETF", "Index Fund(s)" or "FoF(s)" skipped the mutual-fund branch: a G-Sec ETF was taxed as a directly held G-Sec (12 months, 12.5%), a bond fund or ETF as a listed bond. One engine-scope test (`MF_BOOK_PRODUCT`, `07_engine.js:282`), the AMC tab's, now serves both. Probe: a G-Sec ETF lot of 15 May 2024 is short term at slab (it was Rs 625 long term). Pre-2023 lots follow KI-161 (tax batch T2). Test: `tools/regression/KI-178-mf-product-guard.js`. |
| KI-179 | TX-20 | P2 | calculation | **FIXED** (tax batch T1) | Retirement and children's funds were equity by default (12 months, 20%), including pure-debt and conservative plans; in the Direct list 23 retirement plans filed under "Debt Oriented" were always short term. The reckoner: a fund is classed by its holdings over the year, and solution-oriented schemes are being merged (Hybrid Funds & FoFs R11-R15, R27). Now unclassified with the reason (24 Regular, 41 Direct), until the owner supplies the AMC's classification. Test: `tools/regression/KI-179-solution-oriented.js`. |
| KI-180 | TX-21 | P3 | ui text / data | **FIXED** (tax batch T1) | The debt row cited Sec. 50AA of the 1961 Act; the Income-tax Act 2025 numbers it Sec. 76 (Section Map #15). Now "Debt Mutual Funds – Sec. 76 (old 50AA)" in TAX_RULES and in the classifier in one edit; a class with no TAX_RULES row is now unclassified with a reason instead of a position with no rule. Answers OD-28. Test: `tools/regression/KI-180-debt-row-section.js`. |
| KI-181 | TX-22 | P3 | ui text / exports | **FIXED** (tax batch T3) | The harvest note said losses "carry forward eight assessment years"; the 2025 Act says tax year, and the slide left out the condition that the return is filed by the due date (Exemptions & Set-off R13, R22). Now the tab and the slide say a loss left over "can be carried forward for up to eight tax years, provided the return is filed by the due date", which loss offsets which gains, and, in a family, whose loss it is. Taken on the live page with the per-client harvest it belongs to. Open for the owner: reviews valued before 1 Apr 2026 fall under the 1961 Act. Test: `tools/regression/KI-181-carry-forward-wording.js`. |
| KI-182 | TX-23 | P3 | data / calculation | **FIXED** (tax batch T3; set-off in T4) | The Crypto row (30%, any period) has no row in the reckoner. Now (D-040 g) the row keeps 30% for any holding period and carries its `source` ("Not in the Tax Reckoner TY 2026-27 … kept because the law is unchanged; for the owner to confirm"), shown on the tab and, in short, in the class slide's footnote. The re-review of part T3 (finding F1, P2) found the harvest still pooled crypto gains with other short-term gains, ranked at 30%, so a loss went to a crypto gain first and a crypto loss reduced other gains or showed as carry-forward. Tax batch T4 takes the safe behaviour until the owner answers CR-0008 question 18: the row carries `noSetOff` and its basis in `noSetOffSource` (the reckoner is silent; Sec 115BBH of the 1961 Act allowed no set-off either way and no carry-forward); in `taxBuildHarvest` (`07_engine.js:537`, T4 build) a crypto gain pool gets no set-off slot (taxed in full before and after), a crypto loss stays out of the loss pools (`noSetOffLoss`; never carried forward) and a crypto holding at a loss is not a candidate; the family sums `noSetOffGain` and `noSetOffLoss` like every other figure. One sentence on the tab's harvest card ("pending the owner's ruling") and on the harvest slide ("pending a ruling on their treatment", the deck being for the client) says so. Probe: a Rs 1,00,000 crypto gain, a Rs 20,000 equity short-term loss and a Rs 2,00,000 equity long-term gain: crypto tax Rs 30,000 before and after, saving Rs 2,500 (was Rs 6,000); a Rs 1,00,000 crypto loss against a Rs 1,00,000 equity short-term gain: saving 0 (was Rs 20,000), nothing carried forward. Tests: `tools/regression/KI-182-crypto-source.js`, `KI-182-crypto-no-set-off.js`. |
