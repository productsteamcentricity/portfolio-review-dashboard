# Interface contracts

**Written:** 28 Oct 2026 (IST) by MOD-01 for the handover to MOD-02. **Kept by:** MOD-02 (single writer), with ARC-01
reviewing every change. **Baseline:** `main` at `6443826`; live page MD5 `12B5E572`. Line numbers in `index.html` blocks
come from a fresh `tools/extract-blocks.js` run on that page (the repository's `.blocks/` copies are stale, see
[ARCHITECTURE_AND_DEPENDENCY_MAP.md](ARCHITECTURE_AND_DEPENDENCY_MAP.md) section 13).

**What this file is.** Every data structure, function, file format or rule that more than one component, chat or
build depends on. Before a chat changes one of them it finds the row here, tells the consumers listed, and follows the
change rule. If compatibility cannot be shown, integration waits (owner's 27 Oct instructions, section 12). The
detailed definitions stay in their own documents, which remain authoritative: [`docs/DATA_DICTIONARY.md`](../DATA_DICTIONARY.md)
for the new model, [`docs/legacy/ARCHITECTURE.md`](../legacy/ARCHITECTURE.md) for the live page, and
[`docs/DECISIONS.md`](../DECISIONS.md) for every rule cited by its D number.

**Labels.** [VERIFIED] means checked on 28 Oct 2026 in the file and line given. [INFERRED], [UNCERTAIN] and [UNKNOWN]
as in the other registers. "m14" means branch `feat/m1-4-overview` at `07a6460` (LOCAL ONLY); "G1" means
`worktree-wf_bdc6c774-599-1` at `4610684` (LOCAL ONLY); "tax branch" means
`continuation/ex-01-task-ta-03-20261027` at `0f1c5d3` (on origin).

**Owner names used below.**
- **WS-A chat**: the Workstream A implementing chat. EX-01 once it is launched; MOD-02 holds the role until then.
- **WS-B chat**: NB-01 (the new-build chat).
- **Owner**: the product owner (product and financial-rule decisions).
- **Lead**: MOD-02, deciding under D-033 where a rule is a technical choice.

**The general change rule.** For every interface below:
1. The changing chat writes a change-impact contract (template in
   [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md)) naming the interface id (I-nn).
2. ARC-01 reviews it at Gate B and checks every consumer listed here.
3. The consumers' owners are told before integration; their tests run in the same PR's CI.
4. This file is updated after the merge by MOD-02, with the new version and line numbers.

## 1. Summary table

| Id | Interface | Owner | Consumers | File and line | Version on 28 Oct | Change rule (consult) |
|---|---|---|---|---|---|---|
| I-01 | Base-file columns, header and row rules | WS-A (live reader); WS-B (new reader, data dictionary) | analysts' real base files; `computeReview`; the new model; base-file parity test | block 07 `parseBaseRows` line 782; `app/src/ingest/base-file.ts:48` (`HEADER_SCAN_ROWS`), `:71` (`FIELD_PREDICATES`); DATA_DICTIONARY 5.3 and 8 | live scans 5 header rows, new reader 20; ISIN column read by neither (KI-184) | section 2.1; the other workstream, ARC-01, financial-domain-reviewer for any value change; owner for BF-19, BF-26, L7 |
| I-02 | Money columns and text in number cells (D-041 point 4, D-039 point 1, D-042 planned) | WS-A (live); WS-B (new); owner (the rule) | both readers; every money figure; AG ledger | block 07 `parseBaseRows`; m14 `app/src/config/money-columns.ts:19` (`MONEY_COLUMN_RULE`) | builds differ today: live falls through, new marks invalid | section 2.2; owner (PD-09), ARC-01, WS-B, financial-domain-reviewer |
| I-03 | Merged duplicate folios | WS-A (live); WS-B (new) | holdings, units, Taxation path, workbook "Base File" sheet | block 07 `parseBaseRows`; D-041 points 1-2; DATA_DICTIONARY 8 | differ: live takes earliest date (D-041), new first row (KI-148, fixed on G1 only) | section 2.3; owner (PD-08) |
| I-04 | IRR / transactions workbook | WS-A (live); WS-B (new reader, M3) | `parseIRR` → IRR tree, Fund IRR, Taxation lots | block 09 `parseIRR` line 365; DATA_DICTIONARY 5.4 | alias lists as in the code; new reader not built | alias additions only; known-answer XIRR tests; financial-domain-reviewer |
| I-05 | `window.REFDATA` (block 04) and `window.MF_ER_TABLE` (block 10) | monthly refresh (data); WS-A (TAX_RULES and owner tables by patch) | engine, UI `activeRef`, exporters, test-ai-analyst, data-extract, NB-01 refdata parity | `tools/check-invariants.js:52-55` (`REF_KEYS`, `DATE_KEYS`); `scripts/data-extract.ts:29` | 21 keys; 7 data dates; data month Sep 2026 (ranks 15 Aug, fund managers 31 Aug) | section 2.4; owner "publish" for data; ARC-01 and WS-B for a key change |
| I-06 | `data/refdata/*.json` and `VINTAGE.json` | generated; extractor owned by WS-B | refdata parity test, CI `data-extract --check`, new app (later milestones) | `scripts/data-extract.ts` (schema line 206); `data/refdata/` | `refdata-vintage-v1`; 20 block files; TAX_RULES 25 records (34 on the tax branch) | never hand-edit; regenerate in the same change (D-035) |
| I-07 | `localStorage` keys (7) | WS-A | the live UI across sessions | block 11 lines 5162-5995 (section 2.6) | unchanged since baseline | section 2.6; security-release-reviewer (KI-012) |
| I-08 | Block marker strings | WS-A (frozen) | 7 readers (section 2.7) | `tools/check-invariants.js:29-43` and 6 copies | unchanged since baseline | never change; if unavoidable, every copy in one PR, ARC-01 and WS-B |
| I-09 | ENGINE API (`window.ENGINE`) and parser surface | WS-A | exporters, parsers, UI, all `tools/*`, NB-01 parity tests | block 07 line 3262; block 08 lines 2271-2272; block 09 line 426; `check-invariants.js:47-51` | 21 engine keys + `buildPPTX`, `buildXLSX`, `parsers` (9); tax branch adds 4 | section 2.8; additive only |
| I-10 | UI → exporter `window` globals | WS-A | `buildPPTX`, `buildXLSX` | block 11 lines 286-287, 972, 4839, 5186; reset at line 270 | as on `main` | new per-family state cleared in `resetFamilyState()`; `family-isolation.js` passes (D-015) |
| I-11 | `tools/engine-host.js` API | WS-A (frozen) | every legacy tool; NB-01 `tests/fixtures/make-books.ts` and parity tests | `tools/engine-host.js:14` (`load`), `:45` (`build`) | `load()` → `{XLSX, Ppt, E, REF}`; `build(base, meta)`; unchanged since 14 Oct | frozen; any change needs MOD-02 coordination, ARC-01 and WS-B |
| I-12 | Synthetic book | WS-A | smoke, QA, NB-01 fixtures (mirror it) | `tools/make-sample-base.js` (`build`, `buildFamilyB`, `AS_ON`) | 13 holdings, 2 clients, exact XIRR | change values only with both known-answer sets updated in one PR |
| I-13 | Base-file parity ledger (BF) | WS-B; WS-A retires entries its fixes remove | `tests/parity/base-file.parity.test.ts` (CI `next`) | `tests/parity/base-file-ledger.json`; test lines 85-90 | `parity-ledger-v1`; BF-01..BF-26 | section 2.9 |
| I-14 | Aggregation parity ledger (AG) | WS-B | `aggregation.parity.test.ts` | m14 `tests/parity/aggregation-ledger.json`; m14 test line 75; G1 test line 68 | AG-01..AG-14 (branch only); G1 retires AG-01, 02, 05, 06, 08 | section 2.9; retiring also edits the pinned list |
| I-15 | Parity matrix and `// covers:` traceability | WS-B | `traceability.mjs` (CI `next`) | `docs/new-build/05-feature-parity-matrix.md`; first line of every test file | 385 rows on m14 [VERIFIED by the workstream B investigator] | every test names its rows; every row in progress or later has a test |
| I-16 | Publication classes policy | owner and lead (D-023, D-026) | `tests/validation/publication-classes.test.mjs`; M11 engine and pre-push rules later | `monthly_updates/_policy/publication-classes.json` | `schemaVersion` 1, updated 2026-10-22, classes P, C, N | a change is a policy change and needs the decision it rests on |
| I-17 | Legacy PPTX output | WS-A | analysts and clients; `render-slides.js`; regression tests | block 08 `buildPPTX(model, PptxGenJS, only)` | 22 group keys; calibrated pagination | section 2.10; D-028 scope |
| I-18 | Legacy XLSX output | WS-A | analysts; regression tests | block 08 `buildXLSX(model, XLSX)` | 14 fixed sheets + one per client; names cut to 31 chars; no Taxation sheet | section 2.10 |
| I-19 | New-app PPTX and XLSX output | WS-B | `/next/` users (preview only) | m14 `app/src/exports/*`, `app/src/config/slide-manifest.json` | C-08 slide and overview workbook (branch only) | Office acceptance `npm run accept:office` with verdict PASS before merge |
| I-20 | Four vendored libraries | frozen in the live page; WS-B vendors them | live page; new-app build; `check-next` allowances | blocks 00-03 (+ logos in 06); m14 `scripts/vendor-extract.mjs:49-70`; `app/vendor/MANIFEST.json` | Chart.js 4.4.0, datalabels 2.2.0, SheetJS CE 0.18.5, PptxGenJS 3.12.0 (+JSZip alias) | section 2.11 |
| I-21 | Tax-rule tables (two) | WS-A (`REFDATA.TAX_RULES`); WS-B (TR-1..TR-21) | Taxation tab, slides, AI Analyst tax signal; M7 tax engine | `REFDATA.TAX_RULES`, `data/refdata/TAX_RULES.json`; [`capital-gains-upload.md`](../new-build/capital-gains-upload.md) section 10 | live 25 rows on `main`, 34 on the tax branch; new table v1 | section 2.12; financial-domain-reviewer; owner for rules |
| I-22 | Fund ranks: public page versus codes only | lead (D-026); owner (PD-26) | live AI Analyst and MF Analysis; new-app crosswalk (M2) | `REFDATA.FUND_RANKS`; `data/refdata/FUND_RANKS_CODES.json`; `data-extract.ts:36-38` | 1,262 entries; codes only in `data/refdata` | scores and ranks never in new files or public new pages |
| I-23 | MF Screener link | lead (D-027) | the build (static anchor) | `app/src/config/links.json` | one URL | the only remote URL; no module imports it; `check-next` enforces |
| I-24 | `PRD_PRIVACY_DENYLIST` contract | lead (D-033) | `privacy-scan.mjs`, `prepush-scan.mjs`, the pre-push hook | `scripts/validation/privacy-scan.mjs:17-19, 31, 106-129`; `scripts/hooks/pre-push`; `privacy-allowlist.json` | set per push; not set persistently (PD-40) | section 2.13 |
| I-25 | D-020 merge message and method | lead (D-020) | GitHub PR state; history readers | `docs/DECISIONS.md` D-020; merge `6443826` | as in section 2.14 | unchanged unless a new decision |
| I-26 | Branch names | lead | `release-check.mjs` | `scripts/validation/release-check.mjs:44` (`BRANCH_RE`), `:271` | `feature/ feat/ fix/ docs/ chore/ data/ test/`; others WARN | continuation and handover prefixes only WARN (TC-23) |
| I-27 | Pages staging | lead (D-007, D-024, D-034) | the live link `/`, the preview `/next/` | `.github/workflows/pages.yml:72-106`; `tests/next/pages-workflow.test.mjs` | `/` byte copy; `/next/` build or notice | change with MOD-02's go and ARC-01 review; the workflow test pins it |

## 2. Details and change rules

### 2.1 I-01 Base-file columns, header and row rules
- **Live reader.** `parseBaseRows` (block 07 line 782) scans the first 5 rows for the header. It reads the columns
  by alias; Allocation is recognised but not read (KI-093). [VERIFIED: architecture investigation]
- **New reader.** `app/src/ingest/base-file.ts` scans 20 rows (`HEADER_SCAN_ROWS`, line 48) and maps columns with
  `FIELD_PREDICATES` (line 71): the legacy aliases plus four joint-holder columns. [VERIFIED]
- **Rules both follow today (D-041 on the live page since PR #16).** A "Total" or "Grand Total" Instrument Name row
  is skipped and counted (live) or read with a warning (new). An impossible text date is blank with a warning. Asset
  Names are read as their class without regard to letter case or spacing on the live page (BF-26 is open with the
  owner); a blank Asset Name is Equity on the live page (BF-14) and Unknown in the new reader; an unrecognised name
  keeps its label (BF-19, open with the owner).
- **Not read by either reader:** the ISIN column (KI-184, to be filed by EX-01 from its range).
- **Change rule.** A change to either reader updates, in the same PR: the base-file parity ledger (retire or add the
  entry), `docs/DATA_DICTIONARY.md` (new reader) or `docs/legacy/ARCHITECTURE.md` (live reader), and a known-answer
  regression test. Consult ARC-01, the other workstream, and the financial-domain-reviewer for any value change.
  Owner questions BF-19, BF-26, L7 and PD-08 decide rules for **both** builds.

### 2.2 I-02 Money columns and text in number cells
- **Precedence in both builds:** Crore, then Lakh, then rupees. XIRR and BMXIRR are percent numbers. [VERIFIED]
- **Live page, D-041 point 4 (on `main`).** A number cell counts only when all of it is a number. A Crore cell with
  other text is blanked and **falls through** to Lakh, then rupees. "NA", "-" and "nil" stay blank without a notice.
  [VERIFIED: `docs/DECISIONS.md` D-041]
- **New app, D-039 point 1 (m14 only).** (a) The owner's "no fallback" of 24 Oct: a Crore cell with text that is not
  a number makes the amount invalid; the holding is excluded and listed. (b) A blank Crore cell falls back to Lakh,
  then rupees (lead). (c) The placeholders "NA", "N/A", "-" and "nil" count as blank (lead). `MONEY_COLUMN_RULE =
  { invalidText: 'invalid-source', crossCheckToleranceCr: 0.005 }` (`money-columns.ts:19`). [VERIFIED by
  `git show feat/m1-4-overview`]
- **The difference is ledgered** as AG-13 and AG-14 on G1 (`aggregation-ledger.json` lines 159 and 171). [VERIFIED]
- **Planned change (TA-05, EX-01):** D-042 amends D-041 point 4 so the live page follows the owner's rule. D-039
  point 1 applies to invested value, market value and gain alike, so D-042 mirrors all three. Whether placeholders
  count as blank is owner decision **PD-09**; until it is answered, the built lead default (placeholders blank) is
  what both sides use. [VERIFIED: D-039 text on m14; INFERRED: the mirror requirement]
- **Change rule.** The rule belongs to the owner. The live change (TA-05) and the new-app rule must match; whichever of
  TA-05 or M1.4 merges second retires AG-13 and AG-14 **and** edits the pinned retired list (section 2.9). Consult
  ARC-01, WS-B and the financial-domain-reviewer.

### 2.3 I-03 Merged duplicate folios
- **Merge key in both builds:** client, instrument, product and distributor. [VERIFIED]
- **Live page (D-041 points 1 and 2).** Units are summed only when every folio has them, otherwise blank and the
  holding is left unsplit in Taxation. The merged holding takes the earliest purchase date; holding days are
  recomputed when the folios count to the same date, otherwise blank. [VERIFIED]
- **New app.** Takes the first row's date and days (KI-148). G1 fixes this, not yet integrated. [VERIFIED: NB-01
  state report and G1 commit subject]
- **Open:** D-041 question 1 (PD-08), the rule for holding days when folios disagree, decides both builds.

### 2.4 I-05 `window.REFDATA` and `window.MF_ER_TABLE`
- **Keys.** `REF_KEYS` (`check-invariants.js:52-54`): FUND_RANKS, FUND_RANKS_META, FUND_MGR, FUND_MGR_META,
  TAX_RULES, DATA_DATES, EQUITY_ANALYTICS, HYBRID_ANALYTICS, DEBT_ANALYTICS, MF_PERF, MF_PERF_DIRECT, PMS_PERF,
  AIF_PERF, BENCHMARKS, BENCH_RET, STOCK_INFO, STOCK_RET, MF_RISK, MF_BENCHMARKS, MF_CAT_BM, SIF_PERF.
  `DATE_KEYS` (line 55): analytics, performance, direct, ranks, fmgr, sif, risk. [VERIFIED]
- **Change rule for data.** Only through `buildtools` on a `data/YYYY-MM-refresh` branch: the gate, then
  `splice_refresh.js --data-only`, then `check-invariants`, then `node scripts/data-extract.ts` in the same change
  (D-035). The merge waits for the owner's "publish" (D-017, PD-30).
- **Change rule for a key.** Adding or renaming a key changes `REF_KEYS`, `data-extract.ts` `REFDATA_KEYS` (line 29;
  the extractor throws on a changed key set, line 167), the data dictionary and this row, in one PR, with ARC-01 and
  WS-B consulted.
- **`TAX_RULES`** is the exception: its rows change by patch with the tax batch (I-21).

### 2.5 I-06 `data/refdata/*`
- 20 block files (sorted keys, LF), `VINTAGE.json` (`schema: refdata-vintage-v1`, `dataMonth: 2026-09`) and a README.
  `FUND_RANKS` becomes `FUND_RANKS_CODES.json`; `FUND_RANKS_META` is not extracted (`data-extract.ts:36-38`).
  [VERIFIED]
- The privacy allow-list exempts exactly these generated files from the deny-list scan (they hold public vendor data
  with common names); the refdata parity test checks that the exemptions cover exactly these files. [VERIFIED: test
  header]
- **Change rule.** Never hand-edit. Regenerate with `node scripts/data-extract.ts` and confirm with `--check`. A change
  to the extractor itself is WS-B's, reviewed by ARC-01.

### 2.6 I-07 The seven `localStorage` keys (block 11)
| Key | Holds | Written / read at |
|---|---|---|
| `ips_profile_idx` | chosen IPS profile index | 5162, 5179 |
| `cost_overrides` | instrument-name cost overrides (JSON) | 5187, 5193, 5196 |
| `cost_mode` | `regular` or `direct` | 5231, 5428, 5429 |
| `cost_distributor` | a distributor name | 5246, 5431 |
| `cvs_cmv` | a portfolio value | 5704, 5900, removed 5995 |
| `cvs_cmv_sig` | a signature of family, as-on date and CMV that guards `cvs_cmv` | 5703, 5900, removed 5995 |
| `cvs_infl` | inflation assumption (default 6.5) | 5709, 5900 |

- They persist across sessions and are **not** cleared by `resetFamilyState()`. KI-012 records that some hold
  identifying fragments. Holdings, folios and units are never stored. [VERIFIED]
- **Change rule.** A new key, or new content in a key, needs the security-release-reviewer (privacy) and ARC-01. Never
  store holdings, folios, units or client names. Per-family values must be guarded by a family signature or cleared on
  a family change (D-015).

### 2.7 I-08 Block marker strings
The 13 markers are in section 2 of [ARCHITECTURE_AND_DEPENDENCY_MAP.md](ARCHITECTURE_AND_DEPENDENCY_MAP.md). They are
copied in 7 places [VERIFIED]:

| Copy | Location | Blocks |
|---|---|---|
| 1 | `tools/check-invariants.js:29-43` (`MARKERS`) | all 13 |
| 2 | `tools/engine-host.js:21-29` | 02 to 10 (9 markers) |
| 3 | `tools/extract-blocks.js:32-46` (`NAMES`) | all 13; its chartjs marker is looser than copy 1 |
| 4 | `scripts/data-extract.ts:99` | REFDATA and MF_ER_TABLE (a generic `window.<name> =` pattern) |
| 5 | `tests/helpers/sheetjs.ts:47` | SheetJS |
| 6 | m14 `scripts/lib/legacy-blocks.mjs` | library and logo blocks, copied from copy 1 |
| 7 | m14 `tests/helpers/pptxgenjs.ts` | PptxGenJS |

No test checks that the copies agree. **Change rule:** never change a marker comment in `index.html`. If it is
unavoidable, update every copy in the same PR, with ARC-01's Gate B and WS-B told first.

### 2.8 I-09 ENGINE API and parser surface
- **Engine keys (block 07 line 3262):** `palette, FONT, amcDisplay, amcKey, normalize, matchInstrument, matchPMS,
  resolveBench, benchmarkFor, bucketDefs, parseBaseRows, assetLabel, computeReview, computeTaxation, taxClassOf, xirr,
  aiaCompute, aiaWeights, aiaAmcCap, aiaOvBands, fmt`. Then `buildPPTX` and `buildXLSX` (block 08 lines 2271-2272) and
  `parsers` (block 09 line 426): `parseEquitySide, parseDebtSide, parseMonitor, parseSIF, parsePMS, parseIRR, fmtDate,
  parseAdditionalDebt, parseSOA`. [VERIFIED]
- **What `check-invariants` enforces:** `ENGINE_KEYS` (lines 47-49, 22 names) and `PARSER_KEYS` (lines 50-51). It does
  not list `amcKey` or `xirr` (TA-22, EXISTING DEFECT). [VERIFIED]
- **Tax branch additions:** `taxClassify` (and a third, optional date argument to `taxClassOf`), `taxApplyAssumptions`,
  `taxAssumeFor`, `taxDefaults`; `check-invariants.js` unchanged there. [VERIFIED: tax-1 patch line 461, tax-3 patch
  line 817, T5 patch header item 1]
- **Change rule.** Additive only; never rename or remove a key. Add new keys to `ENGINE_KEYS` in the same PR (fixing
  TA-22 when convenient) and update the ENGINE contract in `docs/legacy/ARCHITECTURE.md` section 3. A change to what
  `parseBaseRows` or `computeReview` return is also a change to I-01, I-02 and the parity ledgers: consult WS-B.

### 2.9 I-13 and I-14 Parity ledgers and the "every entry used" rule
- **Format:** `parity-ledger-v1`. Each entry classifies one kind of difference between the live engine and the new app
  on the synthetic fixtures.
- **The rule (both ledgers):** every difference matches exactly one active entry; every active entry is used by at
  least one fixture; a retired entry matches nothing and keeps its former legacy pattern and a reason naming the
  decision of the legacy fix. [VERIFIED: `base-file.parity.test.ts:85-90`; G1 `aggregation.parity.test.ts:61-64`]
- **BF ledger (on `main`):** BF-01..BF-26; fix batch 4 retired the entries its fix removed (commits `bf2db99`,
  `b8a8d7f`, the precedent for a Workstream A chat editing this Workstream B file). [VERIFIED]
- **AG ledger (m14 and G1 only):** AG-01..AG-14. On m14 the test counts **all** entries as must-be-used (line 75), so
  4 tests fail there today. G1 adds retired support and **pins the exact retired list** at line 68:
  `['AG-01', 'AG-02', 'AG-05', 'AG-06', 'AG-08']`. AG-13 and AG-14 are the KI-147 money-rule difference (I-02).
  [VERIFIED]
- **Change rule.** A legacy fix that removes a difference retires the entry **in the same PR**, with the reason naming
  the D number. Retiring an AG entry also edits the pinned list. The AG ids are final only after NB-01 integrates G1;
  TA-05 uses the ids NB-01 confirms. Never add a `regression` class entry at merge.

### 2.10 I-17 and I-18 Legacy PPTX and XLSX outputs
- `buildPPTX(model, PptxGenJS, only)`: `only` is undefined (full deck), a group key, or an array of keys. 22 group keys:
  aia, amc, analytics, asset, clalloc, cost, cvs, distalloc, holdings, ips, irr, mfanalysis, obs, overlap, perf, postan,
  proposedperf, rbimpact, rbovlp, rebal, rebalhold, tax. [VERIFIED]
- `buildXLSX(model, XLSX)`: Base File, Asset Allocation, AMC Allocation, Distributor Allocation, Client Allocation, one
  sheet per client, Equity Analytics, Debt Analytics, Overlap Matrix, Performance, Fund IRR, Observations, Portfolio
  Rebalancing, AI Analyst. Names are cut to 31 characters. [VERIFIED]
- **Change rule.** Under D-028 the live page takes calculation, data and security fixes only; presentation-only changes
  go to the new build. A font or padding change re-derives the pagination constants and opens every page boundary.
  Any export change needs browser acceptance (TESTING section 4) and opening the files in PowerPoint and Excel (TA-11
  is the open handover check).

### 2.11 I-20 Vendored libraries
| Library | Block | Version | SHA-256 (m14 `vendor-extract.mjs`) |
|---|---|---|---|
| Chart.js | 00 | 4.4.0 | `321e3a3fa98da4aaa957d10be57cbb514de0989eed8f9d726b5d05902cd01904` |
| chartjs-plugin-datalabels | 01 | 2.2.0 | `20c08f3d9c6d2ef76df6d6a6f1127c0013339fe32add24222276c398c6308c38` |
| SheetJS CE | 02 | 0.18.5 | `c9506197caf809a075b6dee1da0d36fb19da7158ffe8a88e7b0c96c5d8623c99` |
| PptxGenJS (with JSZip as alias `vendor:jszip`) | 03 | 3.12.0 | `cd078ca9e91c6f9e061ee0a3c310d6ff157c3a71b1dea7f40fd53818017266ff` |

- `vendor-extract.mjs --check` recomputes everything in memory and fails on any difference (m14 `ci.yml` line 74).
  [VERIFIED]
- On m14 a unit test pins the page MD5 the libraries came from (`LEGACY_MD5 = '911A0465...'`, `vendor-extract.mjs:41`)
  and fails against today's `12B5E572`. G1 replaces that pin with block equality (N4), so after G1 only a change to
  blocks 00 to 03 or the logos block breaks the new app's checks. [VERIFIED]
- SheetJS CE 0.18.5 carries CVE-2023-30533 and CVE-2024-22363 (TB-26, EXISTING DEFECT, to be stated in the M1.4 PR).
- **Change rule.** The live page's library blocks never change. A version change in the new app is a recorded decision
  (D-025, D-034, D-038) with ARC-01 and security review.

### 2.12 I-21 Two tax-rule tables
- **Live:** `REFDATA.TAX_RULES`, 25 rows on `main`, 34 on the tax branch with new flags (`sec198`, `perSecurity`,
  `passThrough`, `fundLevel`, `before`, `specifiedFrom`, `noSetOff`, `noSetOffSource`, `source`, `lockMonths`,
  `boughtBefore`, `listedEtfMonths`) and renamed `inst` labels. [VERIFIED: architecture investigation; VINTAGE records]
- **New:** the dated table v1, TR-1..TR-21 with LD-1..LD-42 and KA-1..KA-22, in
  [`capital-gains-upload.md`](../new-build/capital-gains-upload.md) section 10; it becomes `data/owner/tax-rules.json`
  in M7.
- **Nothing links them mechanically.** Agreement is kept by hand (rates agree; the dated usual-bucket rule TR-7/LD-11
  is mirrored by T5 item 1). The D-040 cross-reference to section 10 is a TA-03 T5 docs item. [VERIFIED: T5 patch
  header; INFERRED: no automated link]
- **Change rule.** Any rate or rule change: financial-domain-reviewer, a known-answer test, the owner for the rule
  itself, and the other table's owner told in the same week.

### 2.13 I-24 The private deny-list contract (`PRD_PRIVACY_DENYLIST`)
- The variable names a text file **outside** the repository, one term per line, `#` for comments, matched as a whole
  word without regard to case (`privacy-scan.mjs:17-19`). If it is set but unreadable the scan errors (line 118). The
  summary says whether it was applied (lines 126-129). On this laptop the file is the one named in
  [`docs/new-build/safety-tooling.md`](../new-build/safety-tooling.md). [VERIFIED]
- The pre-push hook (`scripts/hooks/pre-push`) runs `prepush-scan.mjs` of **the pushing worktree** against
  `<remote>/main`, and refuses the push if node is missing. The hook script itself comes from the main checkout through
  the absolute `core.hooksPath`. [VERIFIED]
- The variable is **not** set persistently (PD-40); export it in the shell before every push. CI never has the list
  and runs the generic rules only.
- Exemptions are by exact path in `scripts/validation/privacy-allowlist.json` (`denylistExemptPaths`, 21 entries; no
  binary allowances). [VERIFIED]
- **Change rule.** Never copy a deny-list term into the repository, a test or public text. Never push with
  `--no-verify`. A new exemption needs a lead decision, ARC-01 and the security-release-reviewer; the vendored
  libraries of M1.4 have no exemption and whether their text passes the private scan is [UNKNOWN] until NB-01 runs it.

### 2.14 I-25 The D-020 merge method and message
- Merge locally with `git merge --no-ff` on `main` in the main checkout, under the repository's no-reply identity,
  after CI is green, ARC-01 has given its Gate B GO and MOD-02 has said "go to merge"; then push `main`. PRs #2 to #16 were merged this way; PR #1 was
  merged on GitHub and pulled, which is how KI-098 was found. [VERIFIED: `git reflog show main`]
- The message, exactly as on `6443826` and `fb7f59c` [VERIFIED]:

```text
Merge pull request #N from productsteamcentricity/<branch>

<the pull request title>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

- GitHub then marks the PR merged. A web or API merge would record the wrong author e-mail (KI-098).

## 3. Change log of this file

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version for the handover to MOD-02 (I-01 to I-27) |
| 30 Oct 2026 | MOD-01 (fixer pass) | I-25 lists ARC-01's Gate B GO among the merge conditions (lead decision 4) |
