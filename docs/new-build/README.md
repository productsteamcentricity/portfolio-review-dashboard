# New build (CR-0006): Phase 0 record

This folder holds the record of Phase 0 of the new Portfolio Review application
([CR-0006](../change-requests/CR-0006-new-build.md)): the owner's brief, the Phase 0 deliverables (draft of 21 Oct
2026, revised twice on 22 Oct 2026 for the owner's review, and on 22 Oct 2026, before M1.1 was merged, for the owner's
answers to ND-1 to ND-10, D-024 to D-033), the eight investigator files they were built from, and the notes on the
safety tooling. The legacy `index.html` stays the review link until the new application reaches the
parity defined in [05-feature-parity-matrix.md](05-feature-parity-matrix.md).

**A dated record; the living documents own the content.** From milestone M1.1 the living documents below own each
fact ([09-repository-and-docs-structure.md](09-repository-and-docs-structure.md) §3, one source of truth per fact).
The deliverables here are not edited to follow later work; a change is made in the living document. Answers to the
open questions are recorded in [DECISIONS.md](../DECISIONS.md) and marked "answered" in
[open-questions.md](open-questions.md).

| Topic | Owned now by | Phase 0 source |
|---|---|---|
| What the product must do | [docs/PRD.md](../PRD.md) (the living PRD; draft 0.4 with the owner's answers) | the PRD draft, committed there directly |
| Field, metric, status and unit definitions | [docs/DATA_DICTIONARY.md](../DATA_DICTIONARY.md) (v0.1) | `03-architecture.md` §6, §8, §16; `observation-rule-bank.md` §1, §2 |
| The monthly process, and the files the owner supplies each month | [docs/MONTHLY_UPDATE_GUIDE.md](../MONTHLY_UPDATE_GUIDE.md) (new engine, planned; the tracked list of monthly files, in use now); [docs/MONTHLY_REFRESH.md](../MONTHLY_REFRESH.md) (legacy pipeline, in use) | `03-architecture.md` §13 |
| The monthly PRD | [docs/monthly-prds/](../monthly-prds/README.md) | the brief's Phase 12 |
| How the new application is built | [03-architecture.md](03-architecture.md) until it becomes `docs/ARCHITECTURE.md`, when today's (legacy) [ARCHITECTURE.md](../ARCHITECTURE.md) moves to `docs/legacy/` (`09` §6; not done yet) | `03-architecture.md` |
| Status, blockers, next steps | [docs/PROJECT_STATE.md](../PROJECT_STATE.md) | `07-implementation-roadmap.md` |
| Decisions | [docs/DECISIONS.md](../DECISIONS.md) (D-024 to D-033 for the new build) | [owner-decisions-new-build.md](owner-decisions-new-build.md) (ND-1 to ND-10, answered 22 Oct 2026) |

## The owner's brief

| File | What it is |
|---|---|
| [00-owner-brief.md](00-owner-brief.md) | The owner's brief of 21 Oct 2026, sanitised (no login details, no client names), merged in PR #8 |

## Phase 0 deliverables

| File | What it is |
|---|---|
| [01-legacy-system-audit.md](01-legacy-system-audit.md) | What the legacy application is, what works, what does not and what cannot be verified (brief §0.1) |
| [02-capability-inventory.md](02-capability-inventory.md) | One table of every legacy capability (E-nn engine and exports, U-nn UI and workflows) and the capabilities the brief adds (brief §0.2) |
| [03-architecture.md](03-architecture.md) | The new application's architecture: stack, layers, data and calculation model, modules, engine, look-through, observations, Snapshot modes, product bank, monthly engine, Excel model, PowerPoint library, validation, security, deployment |
| [04-reuse-and-migration-plan.md](04-reuse-and-migration-plan.md) | For each capability: what is reused, how, where it lands and in which milestone; the legacy side during the parallel run |
| [05-feature-parity-matrix.md](05-feature-parity-matrix.md) | The release requirement (brief §0.4): 376 rows that must reach parity or be accounted for before the legacy page is retired |
| [06-data-source-inventory.md](06-data-source-inventory.md) | Every data source: producer, cadence, identifiers, consumers, ingestion, gaps, publication class |
| [07-implementation-roadmap.md](07-implementation-roadmap.md) | Milestones M1 to M16 mapped to the brief's phases, with scope, acceptance and what waits on the owner |
| [08-regression-test-plan.md](08-regression-test-plan.md) | Legacy preservation tests, the 24 acceptance cases (AC-01 to AC-24), fixtures and CI gates |
| [09-repository-and-docs-structure.md](09-repository-and-docs-structure.md) | The target repository layout and which document owns which fact |
| [observation-rule-bank.md](observation-rule-bank.md) | The observation rules: record format, metric paths, thresholds, templates and the legacy mapping |
| [deck-design-system.md](deck-design-system.md) | PowerPoint design tokens, building blocks, the 43 slide components and the QA checks |
| [open-questions.md](open-questions.md) | All 86 questions raised in Phase 0 (Q-01 to Q-86), with answers and defaults; its change log records each revision (21 and 22 Oct 2026) |
| [owner-decisions-new-build.md](owner-decisions-new-build.md) | The ten decisions put to the owner (ND-1 to ND-10) and the answers of 22 Oct 2026 (D-024 to D-033); everything else proceeds on its default |
| [../PRD.md](../PRD.md) | The PRD draft, committed as the living PRD |

## Investigator inputs (`inputs/`)

The eight Phase 0 investigations the deliverables cite by key, in their revised, public-safe form of 22 Oct 2026
(folder maps of private storage, client-folder descriptions, a personal account URL and client-derived example figures
removed). The working copy of the brief made during Phase 0 is not committed: `00-owner-brief.md` replaces it.

| Key | File | What it is |
|---|---|---|
| [DA] | [inputs/deck-a-spec.md](inputs/deck-a-spec.md) | Reference deck A (a 41-slide review with unit-based rebalancing) described generically, slide by slide: components, layout, implied calculations, styling |
| [OP] | [inputs/observation-patterns.md](inputs/observation-patterns.md) | Observation patterns from reference deck B and the legacy engine's templates; the draft rule bank |
| [IE] | [inputs/inventory-engine-exports.md](inputs/inventory-engine-exports.md) | Legacy capability inventory, part 1: engine, parsers, exporters, reference data, libraries |
| [IU] | [inputs/inventory-ui-workflows.md](inputs/inventory-ui-workflows.md) | Legacy capability inventory, part 2: UI and analyst workflows |
| [PO] | [inputs/previous-owner-and-requirements.md](inputs/previous-owner-and-requirements.md) | The previous owner's system, requirements and unfinished items |
| [DS] | [inputs/data-source-inventory.md](inputs/data-source-inventory.md) | Data-source survey and publication classification (merged into `06`) |
| [SC] | [inputs/mf-screener.md](inputs/mf-screener.md) | MF Screener integration audit, done without logging in |
| [TE] | [inputs/technology-evaluation.md](inputs/technology-evaluation.md) | Technology evaluation: stack, bundling, Excel and PowerPoint libraries, security, deployment |

The scripts and probe output the investigators mention (for example a headless slide-group probe) stayed in their
working folders and are not committed; they held no client data.

## Safety tooling

| File | What it is |
|---|---|
| [safety-tooling.md](safety-tooling.md) | The privacy scan, docs link check, pre-push scan and hook built in M1.1: rules, allow-list, private deny-list, how to run them |

## Toolchain and build (M1.2)

| File | What it is |
|---|---|
| [toolchain.md](toolchain.md) | The pinned npm tooling (esbuild, TypeScript, Preact), the one-file build and its CSP, the invariants `check-next.mjs` enforces, the spike results (CSP and IndexedDB from disk and served), the built file's size and SHA-256, and the browser QA steps |

Every file in this folder passed `scripts/validation/privacy-scan.mjs` with the private deny-list and
`scripts/validation/docs-links.mjs` before it was committed (22 Oct 2026, and again after the revision of 22 Oct 2026).
