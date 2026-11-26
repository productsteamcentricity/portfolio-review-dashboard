# Interface contracts: new-build modules

DRAFT, 24 Nov 2026, MOD-03 (CHAT-006); revised after the independent review. Labels: [V] verified, [I] inferred, [U] unknown.

**Relation to the existing register.** [docs/project-control/INTERFACE_CONTRACTS.md](../project-control/INTERFACE_CONTRACTS.md)
holds I-01..I-27 (live page, refdata, ledgers, vendored libraries, merge method, Pages). This file does not repeat them.
It continues the same I-series from **I-28** for the new build's engine modules, so one number never means two
things. registers-4 (OPS-02) adds one pointer row to the project-control file.

**Change rule for every contract here.** A contract file changes only in a PR whose title names the contract id. The
contract owner writes the change; every consumer listed is told before merge; additive changes (a new optional
field, a new function) need MOD-03's go; a breaking change (rename, removed field, changed meaning) needs MOD-03's
go, a Guardian review and every consumer updated in the same PR. A financial meaning change also needs the
financial-domain reviewer.

## 1. Contracts that exist today (verbatim names)

### 1.1 Declared contract files [V]

| File | Declares | Rule in the file |
|---|---|---|
| `app/src/model/review.ts` | `Review`, `ReviewRequest`, `ReviewGate`, `Totals`, `TotalsCounts`, `AllocationLine`, `AssetBlock`, `AssetAllocation`, `LiquidityAllocation`, `EntityColumn`, `EntityRow`, `EntityMatrix`, `HoldingMetrics`, `ReviewLabels`, `BuildStamp`, `LoadedBaseFile`, `LoadError`, `DisplayUnit`, `AssetKey`, `ASSET_ORDER` | line 2: "M1.4 contract file: units copy it byte for byte; only the engine unit changes it" |
| `app/src/views/overview-vm.ts` | `OverviewVM` (line 85) and its parts | line 2: same rule; "only the views unit changes it" |

**Cycle, not only a direction [V].** `model/review.ts:11` imports `BaseFileImport` from `../ingest/base-file.ts`, and
`ingest/base-file.ts:41-59` imports `model/*` and `engine/*` (`engine/classify/asset.ts`, `units`, `value`, `ids`,
`ownership`). `views/import-report.ts:6` and `views/notes.ts:11` also import types (`BaseFileImport`, `MoneyFinding`)
from `ingest/`. So the type graph runs model -> ingest -> model and engine. Rule from now: new import result types
(`IrrFileImport`, `CapitalGainsImport`, vendor parse types, pack types) live in `app/src/model/`, never in `ingest/`.
Decision C-01 (below) breaks the cycle before or with the first new model import type.

### 1.2 Model types (`app/src/model/*`) [V]

- `value.ts`: `Value<T>`, `PresentValue`, `MissingValue`, `Provenance`, `Unit`, `DayNumber`
- `status.ts`: `STATUS`, `MissingStatus`
- `ids.ts`: `Id<K>`, `SourceFileId`, `FamilyId`, `ClientId`, `DistributorId`, `AccountId`, `FolioId`, `HoldingId`,
  `ProductClass`, `ResolutionMethod`, `ResolutionConfidence`, `InstrumentRef`
- `holding.ts`: `Holding` (fields include `instrumentName`, `instrument: InstrumentRef | null`, `categoryLabel`,
  `assetClass`, `liquidity`), `AssetClass`, `Inclusion`, `MergeGap`, `ExclusionReason`
- `ownership.ts`: `Family`, `Client`, `Distributor`, `Account`, `Folio`, `Holder`, `Ownership`, `Plan`, `HoldingMode`
- `source.ts`: `SourceFile`, `SourceRole`, `UploadStage`, `PublicationClass`, `RowRef`, `SkippedRow`, `SheetAttempt`
- `validation.ts`: `ValidationResult`, `Severity`, `ValidationScope`, `AnalystQuestion`, `XirrUnitChoice`
- `audit.ts`: `AuditEntry`, `AuditKind`
- `MODEL_SCHEMA_VERSION`

### 1.3 Entry points [V]

| Function | Location | Signature (short) |
|---|---|---|
| `readWorkbook` | `ingest/workbook.ts:68` | workbook bytes to sheets |
| `parseBaseFile` | `ingest/base-file.ts:713` | returns `BaseFileImport` (type at line 163) |
| `computeReview` | `engine/review.ts:64` | `(ReviewRequest, deps) => Review` |
| `reviewResults`, `applyAcknowledgements`, `gateOf` | `engine/validate/gate.ts:22, 60, 68` | results and `ReviewGate` |
| `buildOverviewVM` | `views/overview.ts:131` | `(Review) => OverviewVM` |
| `buildOverviewDeck` | `exports/pptx/deck.ts:62` | `(OverviewVM, DeckOptions, PptxLib)` |
| `buildOverviewWorkbook` | `exports/xlsx/overview-workbook.ts:272` | `(WorkbookInput)` |
| `writeWorkbook` | `exports/xlsx/writer.ts:156` | `(WorkbookSpec)` |
| `createStore`, `browserWiring` | `ui/store.ts:122`, `ui/wiring.ts:32` | store; `(BuildStamp) => Wiring` |

Spec types: `WorkbookSpec`, `SheetSpec`, `CellSpec` (`exports/xlsx/spec.ts`), `Fx`, `FormulaError`; `SlideManifest`,
`ManifestComponent` (`exports/pptx/manifest.ts:12, 14`); `PptxLib`, `DeckOptions` (`exports/pptx/deck.ts:15-16`) and
the `Pptx*` typings; `WorkbookInput` (`overview-workbook.ts:80`).

### 1.4 On open branches (not on main)

**Update, 26 Nov 2026 (registers-4):** both items below are now on main: M2.1 S1 (PR #30) and M2.3 sprint 3a (PR #31).
Model contracts-1 (PR #29) added `model/base-file.ts` (C-01), `model/returns.ts` (I-31), `model/transactions.ts` (I-32),
`model/index-series.ts` (I-44) and `model/scope.ts` (I-45); contracts-2 (PR #40) added `model/tax.ts` (I-37).

- **M2.1 S1, `aa9c943`, `app/src/engine/match/` [V]:** `Crosswalk`, `CrosswalkSources`, `Universe`, `UniverseName`,
  `ResolveQuery` (`{ name; amc?; isin?; amfiCode? }`), `buildCrosswalk` (crosswalk.ts:113), `resolveInstrument`
  returning `InstrumentRef` (crosswalk.ts:165), `matchInstrument` and `matchInstrumentDetail` (instrument.ts:98, 69),
  `MatchDetail`, `MatchStep`, `matchPMS` (pms.ts:61), `amcKey` (amc.ts:97), `amcDisplay`, `PINS`, `BLOCKS`,
  `EXACT_ONLY`, `aliasFor`, `normalize`, `nameKey`.
- **M2.3 S3a, `1e3d7df`, `app/src/ingest/vendor/` [V]:** `MonitorParse`, `MonitorScheme`, `MonitorBenchmark`,
  `MonitorKind`, `ReturnPeriods`, `parseMfMonitor`; `MonitorExpense`, `EXPENSE_CAP`, `readMonitorExpense`;
  `SifScheme`, `SifParse`, `parseSifMonitor`; shared cell helpers `Aoa`, `findHeader`, `headerMap`, `col`.

## 2. Contracts to fix before Category C work starts

"Freeze" means: the type file is on main (or in the PR that merges first), listed here with its version, and its
consumers code against it.

**Who writes `app/src/model/**` (one rule).** MOD-03 writes every file under `app/src/model/`. The chat named in the
"Specifies / implements" column specifies the contract's content (proposes the types) and implements the code behind
it; it does not write the model file. Non-model files of a contract (for example `engine/match/*`) belong to the
implementing chat, as in [FILE_OWNERSHIP_MAP.md](FILE_OWNERSHIP_MAP.md) §2.

**Phase approval** (read as met under PD-65 since 24 Nov 2026; the rest of this paragraph is the draft's). Contracts for milestones beyond M2 (I-31 to I-39, I-44, I-45) are written only once the owner
answers the phase-approval question (MODULE_DEPENDENCY_MAP §1). I-28, I-29, I-30, I-41, I-42 and I-43 are tied to M2
and can be written now.

| Id | Contract | Planned file | Specifies / implements | Consumers | Freeze by | Decision needed (who) |
|---|---|---|---|---|---|---|
| I-28 | Instrument resolution: `InstrumentRef` semantics, `resolveInstrument`, `ResolveQuery`, `matchInstrument`, `matchPMS`, `amcKey`. **Types frozen, semantics versioned** | `engine/match/*` (on `aa9c943`) | NB-02 | M2.3, M3b, M4b, M7b, M10, M11b; live LP-17 port rule | types at the M2.1 S1 merge | **Scheduled breaking change:** S2a (null on ties KI-036, aliases, house tokens) changes `matchInstrument` and `resolveInstrument` outputs; consumers re-baseline their known answers in the S2a PR. Alias additions (PINS, `EXACT_ONLY` under PD-36 [V name-lists.ts:21-37]) are additive under the change rule; live-port rule (b), 5 working days [V M2-PLAN-v2:34-38]. (a) meaning of `confidence: 'proposed'` (MOD-03, routine); (b) whether callers pass the base file's ISIN: answered by the owner on 25 Nov 2026, the new build reads a column headed "ISIN", ISIN first, name fallback. `ResolveQuery.isin` and `amfiCode` already exist [V crosswalk.ts:131-145], so (b) concerns callers, not the type |
| I-29 | Product class and the product-class table | `model/ids.ts` (`ProductClass`, a closed union of MF, SIF, PMS, AIF, ETF, EQUITY, BOND, OTHER [V ids.ts:21]) + `engine/classify/product-class.ts` + data table. There is no `Holding.productClass` [V holding.ts] | NB-02 | S1 matcher (crosswalk.ts:26, 39, 50 [V]), M1.4 overview, M3b, M4, M7, LP-16 | widening decided before I-28 freezes; table before M2.2 wiring | labels for GIFT City, offshore, bonds, FD, REIT, InvIT, unlisted (owner: D-7, answered 25 Nov 2026: six labels, every bond under "US-dollar bonds (through LRS)"; built live in LP-16, PR #32); whether new non-MF classes widen `ProductClass` (a breaking I-28 type change after freeze) or map to `OTHER` plus a sub-class (MOD-03, routine, decided before the S1 merge); table shape (MOD-03) |
| I-30 | Vendor parse results | `model/vendor.ts` (moved from `ingest/vendor/*` at freeze) | NB-02 | M3b (E-147 first source), M4b, M11a/b | M2.3 merge | moves together with C-01 (MOD-03, routine) |
| I-31 | Returns result: XIRR value with `Value<T>`, coverage, scope, unassigned flows | `model/returns.ts` | NB-03 | M3a, M3b, M5b, M7b, M8, M13 | **types on main** (contracts-1, PR #29, 25 Nov 2026) | coverage representation and the "INSUFFICIENT EVIDENCE" status (MOD-03, inside architecture §6) |
| I-32 | IRR / transactions import (`IrrFileImport`) and the free-text date rule | `model/transactions.ts` | NB-03 | M3a, M7a (realised-gains reconciliation, AC-18), M8 | **types on main** (contracts-1, PR #29, with C-01) | none new (I-04 aliases; KI-186 rule; the KI-186 comparison waits on LP-01) |
| I-33 | Look-through result (equity, debt, rating buckets, Others rule, net equity, overlap matrix) | `model/lookthrough.ts` | NB-02 | M4a, M4b, M5b, M7b (IPS), M12b | before M4a code | rating buckets Q-46: owner default to confirm [V open-questions.md:423-433] |
| I-34 | Observation evidence input and fingerprint | `model/observation.ts` | MOD-03 | M5b, M6 (editable text), M8 | before M5b | none (rule bank and D-030 approved) |
| I-35 | Workbook sheet and slide component registration | `exports/xlsx/registry.ts`, `exports/pptx/manifest.ts` | MOD-03 | M3b, M5a (snapshot slots), M6, M9a, every milestone adding a sheet or slide | before M3b, M5a snapshot slots, M6, M9a | today a new sheet edits `overview-workbook.ts` and `sheet-names.ts` [V lines 17-31]; registry choice (MOD-03, routine). It refactors merged M1.4 code: byte-identical `/next/` build and outputs required (`check-next --rebuild`, snapshots); Gate C on this PR by the Guardian or an independent agent |
| I-36 | Screener pack store API and pack types | `services/screener-store.ts`, `model/screener-pack.ts` | NB-04 | M10u (third source in M3b files), M5b (Quants), M7b, M12b | before M10 wiring | none: unzip is decided, the vendored JSZip [V roadmap:334; app/vendor/MANIFEST.json:136-140; used on main, postprocess.ts:272, deck.ts:15], passed in through `ui/wiring.ts` [I]. Any other library is a recorded decision put to the owner (libraries come only from `scripts/vendor-extract.mjs`; pinned versions change only by a recorded decision [V CLAUDE.md:221-224]) |
| I-37 | Tax lot and roll-up types; `cg-known-answers.json` location and schema; source of record for tax rules | `model/tax.ts`; known-answer file | NB-03 | M7a/b, M8 (C-39), M6 | **types on main** (contracts-2, PR #40, 26 Nov 2026: `model/tax.ts`, units `inr` and `inr-per-unit`, `AnalystQuestion` a union on `kind`); before M7a engine code | The `model/tax.ts` header names the sources of record (statement lots: `data/owner/tax-rules.json` table v1; holdings, FIFO lots and harvesting: `data/refdata/TAX_RULES.json`, I-21; the agreement test between them) and the known-answer file `tests/fixtures/cg-known-answers.json` with its schema. PD-16 items 1 to 7 (owner; items 1, 2, 6, 7 are calculation logic, item 3 privacy) [V DECISION_LOG.md:548-560]; file location (MOD-03). Two tables exist: `data/refdata/TAX_RULES.json` (generated from `index.html`, EX-02; 36 lines on `d7683a0`, 41 changed lines in its take-main [V]) and `data/owner/tax-rules.json` (NB-03 [V 04-reuse-and-migration-plan.md:96]). I-37 names the source of record and requires a parity test between them [I drift risk] |
| I-38 | `ProposalSource` and scenario types | `model/scenario.ts` | to be assigned | M8, M16 | before M8 | PD-37 weights in force (owner, default yes) |
| I-39 | Monthly file role and manifest record; product record shape | `scripts/monthly-update/types.ts`, `product_bank/` schema | NB-04 | M11b, M14, LP-13, LP-15 | before M11b | what the public repo may show from the Reckoner (owner: D-0, D-2) |
| I-40 | One product-class table for both builds | data file read by M2.2 and by the live `productClass` | set by the owner gate; no chat "leads" until then | LP-15, LP-16, M11b | before LP-16 and M2.2 | **Done for KI-051 (25 Nov 2026):** LP-16 merged first (PR #32), M2.2 ports its known answers. For fund-matching corrections the owner made the opposite exception (new build first). As drafted: **Class C, owner gate.** D-028 default: LP-16 first (live patch), M2.2 ports the known answers [V DECISIONS.md:268-272; M2-PLAN-v2:185-189]. New-build first only by an owner exception recorded for KI-051; PD-28 as written covers only C2-C6 [V DECISION_LOG.md:668-680], so the owner card asks a separate question. Coupling rule (b) makes any live `productClass` change trigger an NB-02 port within 5 working days [V M2-PLAN-v2:34-38] |
| I-41 | Review extension slots and validation intake for module results | `model/review.ts` (extension slots on `ReviewRequest` and `Review`), `engine/validate/gate.ts` (intake API beside `ReviewResultsInput`) | MOD-03 | M2.3 (monitor), M3a (IRR file), M7a (CG statement), M10 (pack), every later module | before any module's wiring | today `ReviewRequest` holds only loaded, asOn, labels, acknowledged, answers [V model/review.ts:84-90] and the gate input is fixed to base issues and totals [V gate.ts:10-16]. Wiring stays C, serialised by MOD-03 |
| I-42 | Status vocabulary and validation shapes | `model/status.ts` (`STATUS`), `model/validation.ts` (`ValidationResult`), `model/review.ts` (`ReviewGate`), `gateOf` (gate.ts:68) | MOD-03 | every module; M13 | before M13 changes them | M13 changes go through this contract's change rule |
| I-43 | Legacy-coupling basis for parity tests | `tests/parity/matching-basis.json`, `tests/parity/matching-ledger.json`, `tests/parity/monitor-ledger.json`, `tests/helpers/legacy-engine.ts` (`monitorParserSlice`) | NB-02 (consumer side); producers: EX-02 | S1 matching parity (engine-block SHA and index basis [V matching-basis.json]), S3 monitor parity (parser-slice SHA [V monitor.parity.test.ts:31]) | at the S1 merge | M2 plan coupling rules (a) to (d) [V M2-PLAN-v2:30-40]. Producers: LP-01 and every live patch to blocks 07 or 09 move the bases; NB-02 re-bases or ledgers within 5 working days |
| I-44 | Index series type | `model/index-series.ts` | NB-04 | M11a (`ingest/index-series.ts`, roadmap:373 [V]), M12a | **types on main** (contracts-1, PR #29) | none |
| I-45 | Scope definition (client, advisor, distributor scope keys; re-basing; Q-57) | `model/scope.ts` | NB-02 | M3a (`engine/returns/scope.ts`), M4b (`engine/scope.ts`; written by NB-03 as the first consumer, decision D8 of 25 Nov 2026; NB-02 imports it) | **types on main** (contracts-1, PR #29) | scope keys and re-basing rule (MOD-03, within the recorded Q-57 answer) [I: E-142 and M4b share it] |

**Decision C-01 (MOD-03, routine; done in contracts-1, PR #29, 25 Nov 2026, with the `/next/` build byte-identical):** move `BaseFileImport` and `MoneyFinding` into `model/` in a no-behaviour PR,
before or together with the first new model import type (I-30 `model/vendor.ts` at the M2.3 merge; at the latest before
I-32). Required: byte-identical `/next/` build and outputs (`check-next --rebuild`, snapshots), and Gate C by the
Guardian or an independent agent, since MOD-03 writes and merges the PR.
