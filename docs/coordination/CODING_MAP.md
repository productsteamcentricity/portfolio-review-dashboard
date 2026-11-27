# Coding map

DRAFT, 24 Nov 2026, MOD-03 (CHAT-006), principal architect; revised after the independent review. Charter PD-65 step 4. It changes how the work is organised,
not what is built: every module below comes from [07-implementation-roadmap.md](../new-build/07-implementation-roadmap.md),
[TASK_REGISTER.md](../project-control/TASK_REGISTER.md) or a recorded change request.

**Update, 26 Nov 2026 (registers-4, MOD-04):** main is `142a91d` (PR #40). Merged since the draft: A4 (PR #28), model
contracts-1 I-31, I-32, I-44, I-45 and C-01 (#29), M2.1a (#30), M2.3 sprint 3a (#31), LP-16 (#32), A5 (#33), M3a (#34), M7a
reader (#35), LP-01 TA-03 (#36), M10 (#37), M12a (#38), LP-19 runbook (#39), contracts-2 I-37 (#40) [V git log --first-parent origin/main]. The status
columns below are updated to that; the baseline paragraph that follows is the draft's of 24 Nov.

**Update, 27 Nov 2026 (registers-5, drafted by EX-03 for MOD-05):** main is `56a25fe` (PR #56). Merged since registers-4
(PR #42, `38476a9`), in merge order: M10 pre-wire tests (#43, `cedfd81`), the side-by-side kit (#44, `e851420`),
contracts-3 (#45, `2575196`), M2.1 sprint 2a (#46, `05625f2`), KI-032 live (#47, `9c5d46e`), the M2.1 normaliser
(#48, `c4fa383`), the refdata blocks of the M3b data side (#49, `5ec61f8`), the M3a wiring (#51, `7eb4d20`), the tax
engine R1 of M7a (#52, `0c979e8`), KI-301 live (#53, `8f34397`), LP-16b live (#50, `ad071e9`), the M2.1 wiring (#54,
`ee1e6d8`), the IRR template (#57, `bc3b8af`), the kit follow-up (#55, `97ca0ec`) and the runbook's risk chain (#56,
`56a25fe`); M11a (#41, `eb07cc3`) had merged just before registers-4 [V git log --first-parent origin/main]. The live
page is `04079A77` after LP-16b. Owners: CHAT-015 MOD-05 is the Moderator since 26 Nov 2026 and CHAT-014 EX-03 the
live-page chat (read "EX-02" below as EX-03); the status cells below are updated to that.

**Update, 27 Nov 2026 (registers-6, drafted by EX-03 for MOD-05):** main is `6973101` (PR #63). Merged since registers-5
(PR #58, `9c33de0`), in merge order: kit phase 2 (a), fund matching (#60, `3968489`), the M3b data engines (#61,
`7099f8f`, not wired), the M3b holdings and performance views (#59, `66742e7`), kit phase 2 (b), the performance tables
(#62, `100b5e2`) and kit phase 2 (c), AIF, SIF and the Diversified group (#63, `6973101`) [V git log --first-parent
origin/main]. Test build 1 is complete on `/next/` since PR #59; the owner's acceptance (Gate E) is pending. The live
page is unchanged (`04079A77`).

**Baseline [V] (24 Nov):** main `0e483b6` (PR #20, M1.4). `feat/m2-1-identifiers-matcher` at `aa9c943` (local only, 2 commits
ahead of main). `feat/m2-3-vendor-parsers` at `1e3d7df` (3 commits on top of `aa9c943`). TA-03 branch
`fix/legacy-batch-3-tax-cr-0008` at `d7683a0`, a committed merge of `8cb775e` and `0e483b6` (24 Nov 23:16), 86 commits
ahead of origin and unpushed; `8cb775e` is the tip of `continuation/ex-02-task-ta-03-20261109`.

**Phase approval:** read as met under PD-65 (see [README.md](README.md)); the text below is the draft's. Only M1.4 and M2 were approved when it was written. Every other module is
"needs phase approval" (PA) until the owner answers card question 1 (DEVELOPMENT_BACKLOG §4); the class (A/B/C) says
how it parallelises once approved, not that it may start.

**Labels:** [V] verified (file:line or commit), [I] inferred, [U] unknown. **Classes** (A/B/C) are defined in
[MODULE_DEPENDENCY_MAP.md](MODULE_DEPENDENCY_MAP.md). **Owners (corrected 26 Nov 2026):** the chats opened as CHAT-010 NB-03, CHAT-011 NB-04, CHAT-012 ARC-03 and CHAT-013 MOD-04 (the Moderator since 25 Nov; read "MOD-03" below as the Moderator); EX-03 has no number yet. As drafted: MOD-03 = CHAT-006 (Moderator, also codes);
EX-02 = CHAT-007 (live page); NB-02 = CHAT-009 (new build, M2); ARC-02 = CHAT-008 (Guardian, reviews only).
Chats marked PROPOSED are not open yet (see [FILE_OWNERSHIP_MAP.md](FILE_OWNERSHIP_MAP.md)): EX-03 (CHAT-010, live-page
records and runbook), NB-03 (CHAT-011, financial engines), NB-04 (CHAT-012, data platform), ARC-03 (CHAT-013, second
Guardian for the new build; not the rule-10 Guardian). Items of a PROPOSED chat wait on its opening (owner action if
MOD-03 cannot open it) or stay with MOD-03 until then. "Backend" here means the in-browser model, ingest, engine and exports, plus `scripts/`;
there is no server (architecture, D-024).

The 15 fields are split over two tables per group so that each stays readable: table 1 holds fields 1-7, table 2
repeats the Module ID and holds fields 8-15.

## 1. New build (Workstream B, `app/`, served at `/next/`)

### 1.1 Scope (fields 1-7)

| Module ID | Name | Purpose | Requirements | Frontend | Backend | Data dependencies |
|---|---|---|---|---|---|---|
| NB-M1.1 | Records and safety tooling | Records, baseline tag, scanners, release-check | REQ-009, REQ-037, REQ-038; AC-21 text, AC-22 | none | `scripts/validation/*`, `scripts/hooks/pre-push` | privacy allow-list; publication classes |
| NB-M1.2 | Toolchain, shell, build | One offline HTML file, `/next/` preview | REQ-013, REQ-041, REQ-042 | `ui/App`, nine-section shell | `scripts/build.mjs`, `check-next.mjs` | `app/vendor/MANIFEST.json` |
| NB-M1.3 | Model, base-file ingest, refdata | Shared types, base-file reader, refdata extraction | REQ-040, REQ-067; E-01..E-04 | none | `model/*`, `ingest/{workbook,cells,base-file,load-base}.ts`, `scripts/data-extract.ts` | `data/refdata/*` (21 blocks + VINTAGE) |
| NB-M1.4 | Overview vertical slice | Totals, allocation, entities, C-08, 7-sheet workbook | REQ-041, REQ-049, REQ-067; AC-01, W-1, W-9 | s1-uploads, s2-overview | `engine/{aggregate,classify,validate}/*`, `views/overview.ts`, `exports/{pptx,xlsx}/*` | base file; refdata |
| NB-FU | M1.x follow-ups | AC-22, TB-25, TB-27, TB-28, Guardian R1..R9, QA L-a..L-c, KI-190..KI-192, parity-matrix status hygiene | REQ-021 (AC-22) | none | CI, `scripts/*`, docs | parity matrix |
| NB-M2.1a | Crosswalk and matcher at parity (S1) | Port E-13/E-14 verbatim, AMC key, name lists, load-time crosswalk; no output change | REQ-032, REQ-040; E-13, E-14, E-20, E-89, E-90, E-104, E-125 | none (not imported yet) | `engine/match/{amc,crosswalk,instrument,name-lists,normalize,pms}.ts` | refdata universes; `FUND_RANKS_CODES` |
| NB-M2.1b | Matcher corrections (S2a) | Null on ties, aliases, house tokens, matched-to disclosure | E-13 (corrections), E-19, E-103, E-104; KI-036, KI-050, KI-052, KI-054, KI-101, KI-117 | E-19 disclosure in import report | `engine/match/*` | `data/owner/fund-aliases.json`, `amc-aliases.json` (not created) |
| NB-M2.2 | Classification and benchmarks (S2b) | Non-MF product classes, synonyms, liquidity as data, one benchmark table | E-15..E-18, E-30, E-91, E-92; KI-051; AC-11 | overview "Other, not classified" notice | `engine/classify/{product-class,direct-equity,commodity,liquidity}.ts` | `data/owner/category-benchmarks.json` (not created) |
| NB-M2.3 | Header-driven vendor parsers (S3) | E-06..E-11 by header name; OD-11 upload rules; ER scale check | REQ-017, REQ-032; E-06..E-11, U-08..U-10, W-4 | section 1 monitor slots | `ingest/vendor/{cells,mf-monitor,monitor-expense,sif-monitor}.ts` [V on 1e3d7df] + PMS, AIF, SOA, analytics readers | synthetic monitors (to build); SheetJS reader |
| NB-M3a | Returns core | IRR reader, XIRR, IRR tree, contributions, scope returns | REQ-045, REQ-057; E-05, E-26..E-29, E-109, E-142; KI-006, KI-047, KI-048, KI-186 | section 1 IRR slot (U-13) | `ingest/irr-file.ts`, `engine/returns/{xirr,irr-tree,contributions,scope}.ts` | IRR/transactions workbook (I-04) |
| NB-M3b | Holdings and performance | Holding sheets, performance, D-023 portfolio returns, stock CAGR | REQ-058; E-25, E-31, E-32, E-147, E-148; U-23, U-41, U-69; C-21, C-22, C-24 | sections 4, 5 | `engine/returns/{performance,portfolio-returns,stock-cagr}.ts`, `ingest/price-file.ts`, sheets Holdings, Performance, Fund IRR | `MF_PERF`, `MF_PERF_DIRECT`, `SIF_PERF`, `BENCH_RET`, `STOCK_RET`; uploaded monitor |
| NB-M4a | Look-through maths | Rating buckets, debt sub-2% Others, net equity, overlap matrix | REQ-044; E-34..E-40, E-115, E-116, E-134; AC-07, AC-08 | none | `engine/lookthrough/{equity,debt,ratings,others-rule}.ts`, `engine/overlap.ts` | `EQUITY_/HYBRID_/DEBT_ANALYTICS`, `STOCK_INFO`; `data/owner/rating-map.json` |
| NB-M4b | AMC, scopes, overlap UI | AMC concentration, client/advisor scopes, native overlap with all legacy controls | E-23, U-21, U-25, U-26, U-58; AC-02; KI-002, KI-095 | section 4, scope selector, overlap table | `engine/aggregate/amc.ts`, `engine/scope.ts`; C-09..C-11, C-15..C-17; 3 sheets | client SOA/bond uploads (M2.3 readers) |
| NB-M5a | Observation framework | Rule framework, composition, D-029 lint, threshold table, RO snapshot slots | REQ-043, REQ-047; U-59, U-61 | section 3 shell, mode selector | `observations/{framework,compose,lint,snapshot}.ts` | `data/owner/observation-thresholds.json` (D-030) |
| NB-M5b | Rules and snapshot outputs | Rule bank v1, index overlap, Quants current, C-07 RO, C-13, C-14, C-20 | REQ-046; E-131, E-132, E-146; AC-03 | section 3 | `observations/rules/*`, `engine/returns/quants.ts`; Observations sheet | `MF_RISK`, `MF_PERF`; `index-proxies.json` |
| NB-M6 | Excel model and re-upload | Assumptions sheet, protection, fingerprints, re-upload U-64 | REQ-049; E-122, U-48, U-64; AC-17; KI-021 | section 1 re-upload, conflict report | `exports/xlsx/*`, `ingest/workbook-reupload.ts` | the app's own workbook |
| NB-M7a | Capital gains and tax engine | Statement reader (PAN removed at read), lots, dated rules, roll-up, template | REQ-061, REQ-066; E-141, E-144, E-150..E-156; U-06, U-71, U-72; AC-18 | section 1 CG slot, template download; section 7 tax view | `ingest/capital-gains.ts`, `engine/tax/{classify,lots,lot-class,rules,rollup,harvest}.ts`, `exports/xlsx/cg-template.ts` | tax-rule table v1 (TR, LD, KA in `capital-gains-upload.md` §10); `cg-known-answers.json` (not created) |
| NB-M7b | Cost, IPS, CVS, MF Analysis | Cost chain, IPS, Current vs Sample, MF Analysis with one risk resolver | E-12, E-51, E-60, E-62, E-63; U-17, U-27, U-29..U-31; KI-053, KI-066..KI-068, KI-114 | sections 7, 9 | engine cost/IPS/CVS/MFA; C-12, C-18, C-19, C-25, C-26, C-34..C-38 | `MF_ER_TABLE`; `ips-profiles.json`, `cvs-assumptions.json` |
| NB-M8 | Rebalancing and RB review | Scenario model, plan UI, AI draft, post views, projection, redemption in units, transition, Actionables | REQ-043, REQ-048, REQ-053; U-32..U-40, U-42; E-145; AC-04, AC-05 | section 6 | `engine/scenario.ts`, `engine/ai-analyst/*`, `engine/projection.ts`; C-27..C-33, C-39 | `data/owner/ai-analyst.json` (the roadmap's M8 scope names no M11 input [V roadmap:300-322]) |
| NB-M9a | Deck frame | Cover, dividers, disclaimer, closing, manifest, picker | REQ-048; E-73, E-74, E-138; U-45, U-46, U-68 | picker, manifest preview | `exports/pptx/{manifest,build,xref}.ts`; C-01..C-06 | disclaimer (Q-07 default, owner to confirm); logos |
| NB-M9b | Deck completeness | Market update, every component in the manifest, AC-20 | E-137; U-62; AC-20; KI-124 class | section 8 market update | `ingest/market-update.ts` | monthly market-update images |
| NB-M10 | Screener data pack | `pr-datapack-v1` reader, schemas, browser store, fallback chain | REQ-034, REQ-060 (D-026); E-126, E-139; AC-16 | section 1 pack slot; sidebar status; absence messages | `ingest/screener-pack/*`, `services/screener-store.ts` | synthetic packs only in the repo; real packs never committed |
| NB-M11a | Monthly engine core | Locate, classify, fingerprint, competing-file rules, idempotency, report | REQ-039, REQ-050; E-128, E-129, E-136 (binary); AC-12, AC-21, AC-24 | none | `scripts/monthly-update/*`, `ingest/index-series.ts` | `monthly_updates/_policy/publication-classes.json` |
| NB-M11b | Product bank and extraction | Reckoner and one-pager extraction, product bank, exit loads, Annexure | REQ-059, REQ-083; E-112, E-140, E-144 (role); U-63; AC-13..AC-15 | section 9 Annexure selection | `product_bank/*`, `ingest/{exit-load,pptx-cards}.ts` | monthly vendor files (never committed except approved classes) |
| NB-M12a | Drawdown comparison | Max drawdown, peak, trough, recovery per index and blend | E-149; C-43 | section 4 | `engine/drawdown.ts` | index series (Index TRI files) |
| NB-M12b | History and FoF | Month-end holdings history, FoF look-through | REQ-056; E-117, E-118; U-66; AC-06, AC-09, AC-10 | section 4 history view | `engine/history.ts`, `engine/lookthrough/fof.ts`; C-42 | Screener backfill pack |
| NB-M13 | Validation hardening | Full catalogue, outliers, severity gate, error cards, audit log complete | REQ-014, REQ-052; E-123, E-124, E-135; U-56, U-67; AC-19 | error cards, full validation panel | `engine/validate/*`, `services/audit-log.ts` | none new |
| NB-M14 | Monthly PRD generator | Generate the monthly PRD and refresh HANDOVER | REQ-051; E-130; AC-23 | none | `scripts/docs/monthly-prd.ts` | M11 report, git state, test results |
| NB-M15 | Parity sign-off and switch-over | All rows at parity or accounted for; Pages switch | REQ-021, REQ-036 | `/` becomes the new app | `pages.yml` | parity matrix (385 rows) |
| NB-M16 | Phase 2 readiness pack | `ProposalSource`, missing data, AI Analyst seed | REQ-053 | none | docs | none |

### 1.2 Coordination (fields 1, 8-15)

| Module ID | Shared components | Dependencies | Interfaces (see [INTERFACE_CONTRACTS.md](INTERFACE_CONTRACTS.md)) | Complexity | Parallelisation | Implementation status | Owner | Testing requirements |
|---|---|---|---|---|---|---|---|---|
| NB-M1.1 | release-check, privacy scan | none | I-24, I-26 | S | A | Done; AC-22 missing [V: no test file] | MOD-03 (AC-22) | AC-22 ancestor check in CI |
| NB-M1.2 | build, check-next | M1.1 | I-27 | M | A | Done (PR #12) [V] | MOD-03 (TB-25) | typecheck of `scripts/*.ts`, `tests/**/*.ts` (TB-25) |
| NB-M1.3 | `model/*`, `make-books.ts` | M1.1 | I-01, I-06, existing model types | M | A | Done (PR #13) [V] | NB-02 | base-file parity ledger |
| NB-M1.4 | exports framework, views | M1.2, M1.3 | `Review`, `OverviewVM`, `WorkbookSpec`, `SlideManifest` | M | A | Done, merged `0e483b6`, Gate E accepted [V git; I record] | NB-02 | done; follow-ups in NB-FU |
| NB-FU | parity matrix, CI | none | I-15 | S each | A | Open [V TASK_REGISTER] | MOD-03, with EX-03 PROPOSED for docs | per item; AC-22 outside the refresh window (before 13 Dec or after the refresh merges) |
| NB-M2.1a | `make-books.ts`, parity ledgers, `tests/helpers/legacy-engine.ts` | M1.3; `tools/engine-host.js` (I-11) | I-28, I-43 | L | B (coded) | Merged (PR #30, `c1e1974`); owner Gate E accepted 25 Nov 2026 | NB-02 | corpus parity both ways; IST and UTC suites; 0 diffs mode (a), ties ledgered as KI-036 |
| NB-M2.1b | `engine/match/*` | M2.1a merged; live-page twin first under D-028 unless the owner records a new-build-first exception (a separate question: PD-28 covers only C2-C6 [V DECISION_LOG.md:668-680]); PD-36; S2-Q3 | I-28 (scheduled breaking change) | L | C | Sprint 2a merged (PR #46, `05625f2`), the normaliser (PR #48, `c4fa383`) and the wiring into section 1 (PR #54, `ee1e6d8`), registers-5. Owner answers 25 Nov: new build first (D-028 exception for matching corrections), PD-36 aliases (16 approved, line 10 held); 26 Nov: matching option B | NB-02 | ledger entry per changed match; owner sees sample-book changes (S2-Q3) |
| NB-M2.2 | product-class table (shared with LP-16, LP-15); `ProductClass` in `model/ids.ts:21` [V] | S1 merged (sprint order [V M2-PLAN-v2:183]); D-7 labels; KI-051 order (D-028 default live first) | I-29, I-40 | M | B, owner-blocked (classifier, new files only) / C (wiring, incl. liquidity as data: `liquidity.ts` is already wired [V engine/review.ts:18]) | Not started [V] | NB-02 | classification table; benchmark map (rows need the named approver [V M2-PLAN-v2:212]); conservation against M1.4 totals |
| NB-M2.3 | `ingest/vendor/cells.ts`, source register, `tests/helpers/legacy-engine.ts`, `tests/fixtures/make-monitors.ts` | stacked on S1 (`aa9c943`); shares `tests/helpers/legacy-engine.ts` [V git diff aa9c943 1e3d7df]; no code import of the matcher [V] | I-30, I-41 (wiring), I-43 | M | B | Sprint 3a merged (PR #31, `f8aa2af`), owner Gate E accepted 25 Nov 2026; upload buttons wait for the SheetJS 0.20.2 upgrade (Q-12, approved 26 Nov) | NB-02 | `tests/unit/ingest/mf-monitor.test.ts`; upload equals embedded; slot-swap rejection |
| NB-M3a | `model/returns`, `model/transactions`, `model/scope` types (written by MOD-03) | I-31, I-32, I-45 type files merged; the KI-186 acceptance part after LP-01 merges [V roadmap:210]; PA (P03-S03) | I-31, I-32, I-45, I-04, I-41 (wiring) | M | B | Merged (PR #34, `6f07cb8`), owner Gate E accepted 25 Nov 2026; wired (PR #51, `7eb4d20`: the returns view on `/next/`); the IRR template and aggregate (PR #57, `bc3b8af`) | NB-03 | XIRR known answers within 1e-6; IRR text dates in IST and UTC; `irr-reconcile`, `scope-returns` tests |
| NB-M3b | xlsx/pptx registration, `make-books.ts` | M3a, M2.1a, M2.3 (monitor), M2.2 (benchmarks) | I-28, I-30, I-31, I-35 | L | B | Merged for test build 1: the refdata blocks (PR #49, `5ec61f8`), the data engines `portfolio-returns` and `stock-cagr` (PR #61, `7099f8f`, not wired), the holdings and performance views (PR #59, `66742e7`) [V git log --first-parent origin/main]; owner Gate E pending; follow-ups: the IRR file's XIRRs in the holdings tables, the weighted 3Y and 5Y display, the conditions set at the review of PR #61 before the direct-equity CAGR (E-148) is wired: the per-stock provenance date, a figure date that does not depend on row order, wording, and the owner's answers on month labels against true days | NB-02 (views), NB-04 (data side) | `portfolio-returns`, `stock-cagr`, `coverage-footnote`; `c21-holdings`, `c22-performance`; AC-11 |
| NB-M4a | `model/lookthrough` types (new) | M1.3; stub resolver until M2.1a | I-33 | M | A/B | Not started | NB-02 | blocks sum to 100.00%; rating map covers every label; AC-07, AC-08 |
| NB-M4b | ui section 4, sheets | M4a, M2.1a (`amcKey`), M2.3; PA | I-28, I-33, I-35, I-45 | L | B | Not started | NB-02 | AC-02; `c17-overlap`; `overlap-controls`; `dimension-discipline` |
| NB-M5a | reuses or extends `exports/pptx/text-lint.ts` (D-029, on main [V]; MOD-03) | M1.4; I-35 for the RO snapshot slots; PA | I-34, I-35 | M | A (framework) / B (snapshot slots) | Not started | MOD-03 | lint test (D-029); threshold file test |
| NB-M5b | rule inputs from M3, M4 | M5a, M3b, M4a/b | I-31, I-33, I-34 | L | C | Not started | NB-03 after M7a | one test per rule (DIV-03 at 35.00% / 34.99%); `observations.parity`; AC-03; `c07-snapshot` |
| NB-M6 | xlsx writer, evaluator | M1.4; sheets of later milestones | I-35 | M | B | Foundations only [V] | MOD-03 | AC-17; `formulas.test.ts`; owner-run Office check (rule 10) |
| NB-M7a | `model/tax` types (written by MOD-03) | reader: M1.3 (roadmap start-now names only the reader [V roadmap:443]); engine: M3a (I-32, AC-18 reconciliation; merged), PD-16 (items 1, 2, 3, 5, 6, 7 answered 26 Nov; item 4 with the tax adviser) and LP-01 (merged in PR #36, so I-21 is stable: 34 rows in `data/refdata/TAX_RULES.json` on main [V]) | I-37, I-21, I-32, I-41 (wiring) | L | A (reader, template) / B (classify, lots, lot-class, rules, rollup, harvest) | Reader merged (PR #35, `9c43e4f`), owner Gate E accepted 25 Nov 2026; I-37 types on main (PR #40); tax engine R1 merged (PR #52, `0c979e8`); round 2 built, its full run pending [I MOD-05, 27 Nov 2026] | NB-03 | KA-1..KA-22; AC-18; `capital-gains`, `rules`, `lots`, `rollup`; no PAN-shaped string; financial-domain review |
| NB-M7b | MF Analysis verdicts (feed M8) | M3, M4, M2.1b (risk matcher; inherits its owner blockers: correction order, PD-36, S2-Q3); PD-05, PD-10; PA | I-31, I-33, I-36 | L | C | Not started | NB-03 | IPS, cost, CVS known answers; `cost-controls`, `cvs-controls`, `mfa-rationale` |
| NB-M8 | scenario through the same engine | M3, M5, M7; PD-37; PA | I-38 | L | C (types and redemption maths: A) | Not started | to be assigned | AC-04, AC-05; units x NAV = amount; test-ai-analyst TEST 1-5 ported |
| NB-M9a | pptx chrome, paginate, manifest | M1.4 | I-35 | M | B | Foundations only [V] | NB-02 or MOD-03 (I) | slide order per mode; no object below the footnote line; owner-run Office check |
| NB-M9b | every component | all component milestones | I-35 | L | C | Not started | to be assigned | AC-20 |
| NB-M10 | crosswalk (identity checks); third-source edits in M3b's `portfolio-returns`, `stock-cagr` (M10u, made by NB-02 after M3b) | M2.1a for cross-checks; PA. Unzip decided: the vendored JSZip [V roadmap:334; MANIFEST.json:136-140; postprocess.ts:272], passed through `ui/wiring.ts` [I] | I-36, I-41 (wiring) | M | A (parser, store) / B (cross-checks, M10u) | Merged (PR #37, `efbac4f`), owner Gate E accepted 26 Nov 2026; directory-defence tests merged (PR #43, `cedfd81`); not wired (pre-wiring conditions: directory-defence tests and a browser run on a real pack) | NB-04 | AC-16; `screener-store`, `screener-absent`, `screener-pack`; `check-next` finds no pack content |
| NB-M11a | shared parsers (M2.3) | none for core; M2.3 for extraction | I-39 | L | A (core) / C (extraction) | Merged (PR #41, `eb07cc3`) | NB-04 | AC-12, AC-21, AC-24 on synthetic files |
| NB-M11b | product record shape (shared with LP-15) | M11a, M2.3; owner D-0, D-2, D-8 | I-39, I-40 | L | C | Not started | NB-04 | AC-13..AC-15; `monthly-pipeline.parity` |
| NB-M12a | index-series type (I-44) | I-44 written; synthetic series; PA | I-44 | S | B | Merged (PR #38, `fba4b41`); owner Gate E pending; method defaults accepted 25 Nov (question 2, the index per asset class, open) | NB-04 | `drawdown.test.ts` known answers; `c43-drawdown` |
| NB-M12b | M10 store, M4 look-through; owns `engine/lookthrough/fof.ts` | M10, M4a; PA | I-33, I-36 | M | B | Not started; real data waits on PD-19 [I] | NB-04 | AC-06, AC-09, AC-10 |
| NB-M13 | gate, reconcile, audit log; `STATUS`, `ReviewGate`, `gateOf` consumed by every module | M1.4 framework; I-42 frozen first; each rule after its engine; PA (PHASE-05; tracker puts it after PHASE-04 [V tracker:234], roadmap alongside from M5 [V roadmap:457]: record the deviation) | I-41, I-42, `AuditEntry` | M | B (per rule) | Basic layer only [V] | MOD-03 | AC-19; publication gate blocks a Blocking result |
| NB-M14 | refresh-log format | M11a; first hand-written PRD (LP-19) | none new | M | B | Not started; only `monthly-prd-check.mjs` [V] | EX-03 PROPOSED | AC-23 |
| NB-M15 | everything | all; owner sign-off | all | M | C | 0 of 385 rows at "parity" [V] | MOD-03 | all 24 AC green; AC-22 over full history; workflow drill W-1..W-9 |
| NB-M16 | none | M8 | I-38 | S | C | Not started | MOD-03 | docs review |

## 2. Live page (Workstream A, `index.html`; D-016 patches only, D-028 scope)

Every `index.html` patch is Class C against every other: one at a time, take main after each merge, rebuild by
replaying `tools/patches/*` in file-name order (CLAUDE.md rebuild rule) [V].

### 2.1 Scope (fields 1-7)

| Module ID | Name | Purpose | Requirements | Frontend | Backend | Data dependencies |
|---|---|---|---|---|---|---|
| LP-01 | TA-03 tax batch (CR-0008) | Taxation fixes S1..S11 | REQ-029, REQ-066; KI-160..KI-186, KI-200..KI-214; D-040, D-043 | Taxation tab, tax slides | engine block 07, exporters 08, parsers 09, UI 11 via `tools/patches/2026-10-27-tax-*` | `REFDATA.TAX_RULES` (I-21) |
| LP-02 | TA-05 fix batch 5 | Prototype-key labels; D-042 money rule; retire AG-13/AG-14 | REQ-067; KI-183; D-042 | none | engine block 07 | aggregation ledger |
| LP-03 | TA-06 ISIN column | **Dropped (owner, 25 Nov 2026):** the "ISIN" column belongs to the new build's base file template only; the live page stays as it is (KI-184) | I-01 | none | none | none |
| LP-04 | TA-07 grandfathering | Step-up for lots bought before 1 Feb 2018 | KI-177 step 2 | Taxation tab | engine block 07 | adviser rule |
| LP-05 | TA-09 owner requests C2..C6 | Hybrid YTM/MD, top-20 issuers, aliases, PMS/AIF embedding | KI-039, KI-050 | analytics views | engine block 07 | alias list (PD-36) |
| LP-06 | TA-12..TA-18 audit batches | 12 open P0 defects | KI-049..KI-054, KI-056..KI-060, KI-064 [I parse of open state] | various | blocks 07-11 | refdata |
| LP-07 | TA-19 IPS verdicts | KI-066 | KI-066 | IPS view | engine | none |
| LP-08 | TA-24 FUND_RANKS on the live page | D-026 clean-up | D-026 | AI Analyst, MF Analysis | data block 04 | `FUND_RANKS` |
| LP-09 | TA-25 dashes and overlap threshold | KI-126, KI-135, D-030 | D-029, D-030 | text, overlap | engine | none |
| LP-10 | TA-26 Office-safe Step 3 | Scripted market-update slide export | rule 10, PD-49 | none | new script + guard test on its own new path | owner's Outlook deck |
| LP-11 | P01-S04 AI Analyst footnote dates | Correct data dates in footnotes | PD-63 | footnotes | blocks 07, 08, 11 | refdata dates |
| LP-12 | P02-S01 risk ratios step | Make the in-house risk computation a runbook step | REQ-084 | none | reviewed tools; `docs/MONTHLY_REFRESH.md` | monthly risk inputs |
| LP-13 | P02-S02 PMS/AIF returns from the Reckoner | Monthly PMS_PERF, AIF_PERF | REQ-082 | none | `buildtools/reckoner/` (new) | Reckoner grids |
| LP-14 | P02-S03 direct-equity returns | Returns for direct equity | REQ-085 | performance | refresh tools | price source (PD-62) |
| LP-15 | P02-S04 product list | Live-page matching against the product list | REQ-083 | none | reader, `splice_refresh.js`, engine patch | Reckoner; product record shape (I-39) |
| LP-16 | KI-051 non-MF classifier | Classify GIFT City, offshore, bonds, FD, REIT, InvIT, unlisted | KI-051 (P0) | allocation | `productClass` in block 07 | product-class table (I-40) |
| LP-17 | CR-0010 follow-ups | International terms, remaining pins, one STOCK_INFO row | CR-0010 | SWOT, matching | `ALIASES`, `EXACT_ONLY` via patch | alias approvals (PD-36) |
| LP-18 | PMS/AIF look-through refresh | 15 entries stuck at 31 Jul | Q-24 | analytics | small port script (CR) | managers' strategy workbook, never a client file |
| LP-19 | Docs and runbook | TA-08, TA-21 (2026-10 monthly PRD), TA-23, MONTHLY_REFRESH update, TB-27 (KI-184 is on `d7683a0` and reaches main with LP-01) | REQ-051 | none | docs only | none |
| LP-20 | TA-10 remainder and month archive | Two pager pages; archive October; open the November inbox (outside the repository) | REQ-017 | market update slides | none | owner's PDF or images |
| LP-21 | December 2026 refresh (November data) | Monthly data refresh, files due about 13-17 Dec [I] | REQ-017 | data blocks | `buildtools/*`, data blocks via refresh | all monthly files; owner's "publish" |
| LP-22 | TA-11 Office check of legacy outputs | Acceptance check 7 | rule 10 | none | none | owner-run |
| LP-23 | Live-page SheetJS security patch | TB-26 / CVE in SheetJS 0.18.5 | TB-26 | none | vendored block | SheetJS 0.20.2 (download needs the owner's yes) |
| OPS-01 | Merge identity and method | Merge identity restored to D-020 (local `--no-ff` merge) | D-020, KI-098 | none | none | none |
| OPS-02 | registers-4 | Records refresh: D-046, PD-57..PD-65 (sanitised), stale rows, CHAT_REGISTRY (ARC-02 as ARC-01's rule-10 successor), Guardian findings, this folder's links | records | none | `docs/project-control/*`, `docs/coordination/*` | none |
| OPS-03 | Repository housekeeping | Remove stale worktrees on the owner's word once their head is on origin; no branch deletion | FILE_OWNERSHIP rule 9; CLAUDE.md rule 8 | none | none | none |

### 2.2 Coordination (fields 1, 8-15)

| Module ID | Shared components | Dependencies | Interfaces | Complexity | Parallelisation | Implementation status | Owner | Testing requirements |
|---|---|---|---|---|---|---|---|---|
| LP-01 | CHANGELOG, DECISIONS, KNOWN_ISSUES, PROJECT_STATE; block 07; also `CLAUDE.md`, `data/refdata/TAX_RULES.json`, `VINTAGE.json`, `docs/TESTING.md` [V git diff 0e483b6 d7683a0] | owner PD-01, PD-04, PD-44 for Gate E | I-09, I-21, I-43 (moves the parity bases) | L | C | Merged (PR #36, `b1122d7`) after the owner's sign-off of 25 Nov (PD-01, PD-04, PD-44, PD-54); live | EX-02 | from-scratch replay of all patches in file-name order; KI-165/KI-179 data-pinned tests updated; full legacy list; browser QA; financial and security review |
| LP-02 | block 07; aggregation ledger | LP-01 merged | I-09, I-14 | S-M | C | Planned | EX-02 | probe-based regression; AG retire list |
| LP-03 | header rule shared with NB-M1.3 reader | none | I-01 | S | C | Dropped 25 Nov 2026 (owner: the template change is for the new build only) | none | base-file parity ledger in the same PR |
| LP-04 | block 07 | LP-01; PD-05 | I-21 | S-M | C | Blocked | EX-02 | adviser known answers |
| LP-05 | alias list | PD-28, PD-36 | I-09 | M | C | Blocked | EX-02 | known answers per request |
| LP-06 | blocks 07-11 | LP-01, LP-02 | I-09, I-17, I-18 | M each | C | Not started [V] | EX-02 | known-answer test per KI |
| LP-07 | IPS engine (twin of NB-M7b) | LP-01; PD-10 | I-09 | M | C | Blocked | EX-02 | IPS known answers |
| LP-08 | data block 04 | PD-26 | I-05, I-22 | S | C | Blocked | EX-02 | check-invariants |
| LP-09 | engine text | PD-31 | I-09 | S | C | Blocked | EX-02 | lint and overlap tests |
| LP-10 | guard test on its own new path outside `tests/exports/` (the existing `tests/exports/xlsx/office-scripts.test.ts` is M1.4's [V]) | PD-55; OPS-02 registers-4 merged, naming ARC-02 as ARC-01's sole rule-10 successor [V CLAUDE.md:83-84; registers-4 names ARC-02 ACTIVE in CHAT_REGISTRY] | rule 10 | M | B (owner-blocked) | Banner on main; script not started [V] | EX-03 PROPOSED | guard test; Guardian checklist; D entry with the script's SHA |
| LP-11 | blocks 07, 08, 11 | LP-01; PD-63 | I-09, I-17 | S | C | Not started | EX-02 | footnote date tests |
| LP-12 | refresh tools | PA (P02-S01 [V tracker:50]) | I-05 | S-M | A | Step written: the month scripts of item 6 installed 26 Nov 2026 and named in the runbook (PR #56, `56a25fe`) | EX-03 | Guardian review of tools |
| LP-13 | `buildtools/reckoner/` (with LP-15) | PHASE-02 approval, a CR, D-2, D-4 [V tracker:181, 252; STAGE2_PLAN_DRAFT:78; scope note:56]; a recorded decision for `buildtools/*` work off a refresh branch [V FILE_OWNERSHIP_AND_CHANGE_CONTROL.md:20]; synthetic fixtures only until D-2 | I-05 | M | C (owner-blocked) | Not started [V] | EX-03 PROPOSED (reader), EX-02 (merge) | fixtures; VINTAGE regenerated |
| LP-14 | refresh tools | PD-62 | I-05 | M | B | Blocked | EX-02 | known answers |
| LP-15 | product record shape (NB-M11b), class table (NB-M2.2) | LP-13; D-0, D-2, D-4, D-7, D-8, D-9 | I-39, I-40 | M-L | C | Scoped only | EX-02 | parity with the new-build table |
| LP-16 | product-class table | D-7; order per owner gate (D-028 default: LP-16 first, M2.2 ports [V DECISIONS.md:268-272; M2-PLAN-v2:185-189]) | I-40 | S-M | C | Merged (PR #32, `54de3c3`), live, with the owner's six D-7 labels; LP-16b, the platform's Product Name values, merged (PR #50, `ad071e9`), live; M2.2 ports both | EX-03 | ledger entry per class change |
| LP-17 | `ALIASES`, `EXACT_ONLY` (NB-02 ports within 5 working days) | PD-36 per alias; patch queue after LP-01 | I-09, I-28, I-43 | S | C | A4 merged (PR #28) and A5 merged (PR #33), both live; new matching corrections go to the new build first (D-028 exception, 25 Nov) | EX-02 | `cr0010-a2-pins.test.ts` |
| LP-18 | analytics data blocks | Q-24; patch queue after LP-01 | I-05 | S-M | C (owner-blocked) | Not started | EX-03 PROPOSED | VINTAGE dates correct |
| LP-19 | runbook, PRD template | none | none | S-M | A | Runbook merged (PR #39, `2005b1e`) and its risk chain (PR #56, `56a25fe`); monthly PRD part open | EX-03 | docs-links, privacy scan, `monthly-prd-check.mjs` |
| LP-20 | none | owner material | none | S | A (owner-blocked) | Pending [I] | MOD-03 | owner sees the pages |
| LP-21 | every open branch takes main afterwards | owner files; owner "publish" | I-05, I-06 | L | C (merge window) | Prepared: runbook on `main`, month scripts installed and re-hashed (27 Nov); waits for the owner's files | EX-03 | full refresh checks; Gate D MATCH |
| LP-22 | none | owner slot | rule 10 | S | A (owner-blocked) | Not started | MOD-03 | owner-run |
| LP-23 | vendored block | owner's yes to the download; patch queue after LP-01 | I-20 | S | C (owner-blocked) | Not started. The owner's yes to the SheetJS 0.20.2 download (Q-12, 26 Nov) was asked for the new build; a live-page patch is not decided | EX-02 | invariants; vendor hash |
| OPS-01 | every merge | owner only if the GitHub e-mail account setting is chosen | I-25 | S | A (partly owner-input) | Open: merge identity to be restored to D-020 [V git] | MOD-03 | release-check identity |
| OPS-02 | all records | after LP-01 merges | none | M | C (records) | registers-4 merged (PR #42, `38476a9`); registers-5 in progress (`docs/registers-5`, 27 Nov 2026) | MOD-05 (EX-03 drafts) | docs-links; prepush-scan with `PRD_PRIVACY_DENYLIST`; no private paths, session ids, vendor or inbox file hashes, or names |
| OPS-03 | worktrees | owner's word per worktree, after `git branch -r --contains <head>` shows its head on origin [V FILE_OWNERSHIP_AND_CHANGE_CONTROL.md:66-67]; no branch deletion [V CLAUDE.md:46] | none | S | owner-blocked | Not started; `aa9c943`, `1e3d7df` on no remote; TA-03 86 ahead; `wf_c3548c88-811-*`, `wf_ca03729e-33b-*` without upstream [V git] | MOD-03 | `git worktree list` before and after |
