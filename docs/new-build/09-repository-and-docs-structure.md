# Repository and documentation structure

Phase 0 deliverable 9. Draft of 21 Oct 2026, revised 22 Oct 2026 (Phase 0 review, then D-022, CR-0006 and D-023)
and 22 Oct 2026 (the owner's answers, D-024 to D-033; change log at the end of `open-questions.md`). The target layout of the public repository
`productsteamcentricity/portfolio-review-dashboard`, reconciling what exists on `main` (`782794f` verified listing;
`8cb320d` adds `docs/new-build/00-owner-brief.md`, CR-0006, D-022, D-023 and KI-124) with the
brief's suggested structure (Phase 1) and the chosen stack (`03-architecture.md` §3, §5). Rule: **one source of truth
per fact**; where two documents would overlap, one owns the content and the other links to it.

## 1. Final tree

```
README.md                         what the repository holds, the two apps during the parallel run, how to run, links
CLAUDE.md                         operating contract; legacy rules scoped to index.html; a section for the new app
index.html                        LEGACY app at / until M15, then /legacy/; changed only by tools/patches/ (calculation, data and security fixes, D-028)
package.json  package-lock.json  .npmrc         new app tooling (exact pins, ignore-scripts)          [M1.2]
.gitignore  .gitattributes                      .gitattributes unchanged (* -text, D-005)

app/                              NEW application source                                              [M1.2]
  index.template.html  tsconfig.json
  vendor/                         vendored libraries + MANIFEST.json (version, source, SHA-256, licence)
  assets/                         logos and the cover photo (hashed)
  src/ model/ ingest/ engine/ observations/ views/ exports/{pptx,xlsx}/ ui/ services/ config/ main.tsx

data/                             reference data the app embeds                                        [M1.3]
  refdata/                        one JSON file per block + VINTAGE.json (data month, per-block as-on dates)
  owner/                          owner-maintained tables, versioned, each with an approval record:
                                  ips-profiles, cvs-assumptions, tax-rules, observation-thresholds,
                                  category-benchmarks, rating-map, fund-aliases, amc-aliases, index-proxies
  identifiers/crosswalk.json      ISIN, AMFI code, vendor key, product id, rename history
  history/YYYY-MM/                compact previous vintages (fund holdings history comes from the private Screener packs, Q-27)

product_bank/                     product bank from the Reckoner (Q-03 answered; data-class policy D-023, D-026) [M11]
  schema/  products/  performance/  snapshots/  source_register/  pins.json

monthly_updates/                  the designated monthly folder (tracked)                              [M1.1 README, M11]
  README.md                       the one instruction, drop rules, what is committed and what is not
  _policy/                        classification-rules.json, publication-classes.json, approved-products.json
  _inbox/                         git-ignored local drop zone (optional)
  YYYY-MM/                        DATA month (as-on), never the ship month (Q-26)
    MANIFEST.json                 every file seen: role, original name, size, SHA-256, as-on, class, storage, counts, issues
    UPDATE_REPORT.md              generated update summary (no client data, no person names)
    mf-monitor/  sif-monitor/  reckoner/  one-pagers/  market-update/  disclaimer/  index-data/  other-approved/
                                  approved files (D-023 point 1), committed after the privacy scan; every Accord
                                  file is class P (D-026), the non-monitor ones in other-approved/; a file above
                                  50 MB as PDF (the Reckoner), its original's SHA-256 in MANIFEST.json
                                  (never here: the Screener data pack, client files)

scripts/                          new tooling                                                          [M1.2 onward]
  build.mjs  check-next.mjs  serve.mjs  test.mjs  vendor-extract.mjs  data-extract.ts
  monthly-update/                 run.ts classify.ts fingerprint.ts extract/ product-bank.ts legacy-splice.ts report.ts
  validation/                     prepush-scan.mjs  privacy-scan.mjs  docs-links.mjs  release-check.mjs
                                  monthly-prd-check.mjs                               [M1.1, before the first push]
                                  traceability.mjs                                    [M1.3, with the first tests]
                                  (the deny-list of names is a private local file named by PRD_PRIVACY_DENYLIST; never here)
  monthly-update/parity-local.ts  private re-derivation check against the legacy pipeline   [M11]
  office/                         accept-pptx.ps1  accept-xlsx.ps1   (local; short paths)
  docs/                           monthly-prd.ts                                      [M14]

tests/                            new app tests (synthetic data only)                                   [M1.3 onward]
  unit/  regression/  parity/{golden/, ledger.json, README.md}  exports/{pptx,xlsx}/  integration/
  acceptance/  monthly/  browser/  fixtures/  helpers/

tools/                            LEGACY tooling, unchanged until M15 (engine-host.js also serves tests/parity)
  check-invariants.js  smoke-review.js  test-ai-analyst.js  run-regression.js  make-sample-base.js  extract-blocks.js
  engine-host.js  serve-dashboard.js  open-dashboard.cmd  render-slides.js  parse-fund-ranks.js  parse-fund-mgr.js
  patch-lib.js  patches/  regression/  browser-checks/
buildtools/                       LEGACY monthly pipeline; runs until M11 replaces it; retired at M15

docs/
  README.md                       index of every document (owner of the "where is what" map)
  PRD.md                          living product requirements (brief 12.1)                              [M1.1]
  ARCHITECTURE.md                 the new app's architecture (from 03-architecture.md)                  [M1.1]
  DATA_DICTIONARY.md              every entity, field, metric path, status and unit                       [M1.1 v0]
  MONTHLY_UPDATE_GUIDE.md         the monthly process for the new engine; links MONTHLY_REFRESH.md until M11
  HANDOVER.md                     start here: how to resume (links, not copies, of state)
  CHANGELOG.md                    moved from the root (one changelog)                                    [M1.1]
  PROJECT_STATE.md                the "now" page: status, blockers, next steps (the only place for these)
  DECISIONS.md  KNOWN_ISSUES.md  TESTING.md  DEPLOYMENT.md  DEVELOPMENT_SETUP.md
  monthly-prds/                   TEMPLATE.md [M1.1]; YYYY-MM-Portfolio-Review-PRD.md, one per completed monthly
                                  cycle: hand-written from the 2026-10 data month (Q-76), generated from M14
  new-build/                      00-owner-brief.md (exists, PR #8); Phase 0 deliverables 01 to 09, PRD draft, rule
                                  bank, deck design system, open questions, owner-decisions-new-build.md [M1.1]
    inputs/                       the eight Phase 0 investigator files as revised on 22 Oct 2026 (no folder map of
                                  private storage, no client-folder description, no personal account URL, no
                                  client-derived figures); every file passes prepush-scan.mjs with the private deny-list
  legacy/                         ARCHITECTURE.md (moved), MONTHLY_REFRESH.md (moved at M11), REPLICATION_REPORT.md
  audits/  change-requests/  refresh-log/  previous-owner/        unchanged

.claude/ agents/  launch.json     add a launch entry for the new app's local server
.github/workflows/ ci.yml (adds job `next`)  pages.yml (stages / and /next/)
dist/                             build output (git-ignored)
test-data/                        generated fixtures (git-ignored, as today)
```

## 2. Reconciliation with the brief's suggested structure

| Brief suggestion | Here | Why |
|---|---|---|
| `app/{components,pages}` | `app/src/ui/` | Preact components and the nine sections |
| `app/analytics` | `app/src/engine/` | the single calculation layer |
| `app/observations` | `app/src/observations/` | unchanged name |
| `app/data` | `app/src/model/` (types) and root `data/` (values) | types belong with code; values are reviewed as data diffs |
| `app/exports` | `app/src/exports/{pptx,xlsx}/` | unchanged name |
| `app/configuration` | `app/src/config/` | presentation and behaviour constants; owner tables live in `data/owner/` |
| `app/services` | `app/src/services/` | unchanged name |
| (not suggested) | `app/src/ingest/`, `app/src/views/` | parsing and presentation selection are separate layers (brief Phase 2) |
| `public/{assets,templates,approved-reference-material}` | `app/assets/`; templates generated from schemas; approved material in `monthly_updates/YYYY-MM/` | GitHub Pages serves only the built file, so a `public/` folder would be a second copy |
| `monthly_updates/YYYY-MM/` | same, with `_policy/` and a manifest | tracked: the approved files of D-023 point 1 |
| `product_bank/{products,performance,source_register}` | same, plus `snapshots/`, `schema/`, `pins.json` | performance and portfolio snapshots are separate records [DS §10] |
| `docs/{PRD,ARCHITECTURE,DATA_DICTIONARY,MONTHLY_UPDATE_GUIDE,HANDOVER,CHANGELOG}.md`, `monthly-prds/` | same | the existing `docs/` set is kept and reconciled (section 3) |
| `tests/{unit,integration,regression,fixtures}` | same, plus `parity/`, `exports/`, `acceptance/`, `monthly/`, `browser/`, `helpers/` | parity is a release requirement (brief 0.4) |
| `scripts/{monthly-update,validation}` | same, plus `office/`, `docs/` and build scripts | |
| `package.json` | root | tooling only (D-025) |

## 3. Documents: who owns what (no duplicate sources of truth)

| Fact | Owned by | Others |
|---|---|---|
| What the product must do; users; modes; design standards; constraints | `docs/PRD.md` | ARCHITECTURE links to it |
| How the new app is built; layers; modules; security; deployment model | `docs/ARCHITECTURE.md` | |
| How the legacy app is built | `docs/legacy/ARCHITECTURE.md` (moved, frozen) | |
| Field, metric, status and unit definitions | `docs/DATA_DICTIONARY.md` | PRD and the rule bank link to it |
| Calculation decisions and owner answers | `docs/DECISIONS.md` (D-nnn), `docs/audits/*-decisions.md` (OD-nn) | PRD cites them, never restates them in full |
| Known defects | `docs/KNOWN_ISSUES.md` | |
| Current status, blockers, next steps | `docs/PROJECT_STATE.md` | HANDOVER links to it; monthly PRDs snapshot it |
| How to resume a session | `docs/HANDOVER.md` | |
| The monthly process (new engine) | `docs/MONTHLY_UPDATE_GUIDE.md` | `monthly_updates/README.md` holds only the instruction and drop rules |
| The monthly process (legacy pipeline) | `docs/MONTHLY_REFRESH.md`, then `docs/legacy/` at M11 | |
| What changed | `docs/CHANGELOG.md` and git history | |
| One monthly cycle's record | `docs/monthly-prds/YYYY-MM-...md` (human record, sections A to I) | built from `monthly_updates/YYYY-MM/UPDATE_REPORT.md` (machine facts) |
| Legacy refresh records | `docs/refresh-log/` (frozen after the last legacy refresh) | |
| Each owner request | `docs/change-requests/CR-nnnn-*.md` | |
| Test procedures and results | `docs/TESTING.md` | `08-regression-test-plan.md` becomes its new-app section |
| Deployment, Pages, rollback | `docs/DEPLOYMENT.md` | |
| Palette and type scale | `app/src/config/tokens.json` | deck design system and PRD reference it |
| Category order, benchmark map, rating map, thresholds | `config/` and `data/owner/` (one file each) | the four legacy benchmark maps collapse into one |
| Observation thresholds | `data/owner/observation-thresholds.json` | the rule bank documents meaning only |
| Slide order and inclusion | `app/src/config/slide-manifest.json` | the deck design system documents the default |

The Phase 0 deliverables in `docs/new-build/` are a dated record (CR-0006). After M1.1, the living documents above own
the content; `docs/new-build/README.md` says so, so the two do not drift.

## 4. Living documents

| Document | Created | Updated when | Content outline |
|---|---|---|---|
| `docs/PRD.md` | M1.1 | every milestone that changes behaviour; every monthly cycle if requirements change | brief 12.1 (see `PRD.md` draft) |
| `docs/ARCHITECTURE.md` | M1.1 | every milestone touching structure | `03-architecture.md` |
| `docs/DATA_DICTIONARY.md` | M1.1 (v0) | every milestone adding fields or metrics | entities, fields, metric paths, statuses, units, sources, identifiers |
| `docs/MONTHLY_UPDATE_GUIDE.md` | M1.1 (stub), complete at M11 | each process change | the one instruction; folder convention; classification; what happens; how to read the report; failures and how to resume |
| `docs/HANDOVER.md` | exists | every milestone and every monthly cycle from 2026-10 (checked by `monthly-prd-check.mjs`, then AC-23) | read order, run and test, git state, open blockers (links), how to resume |
| `docs/CHANGELOG.md` | moved at M1.1 | every merged unit | Keep-a-Changelog style, with milestone and PR |
| `docs/monthly-prds/YYYY-MM-Portfolio-Review-PRD.md` | first for the 2026-10 cycle, hand-written from `TEMPLATE.md` (Q-76); generated from M14 | once per completed monthly cycle | sections A to I of the brief's Phase 12 |
| `docs/PROJECT_STATE.md` | exists | every working session | status, blockers, next steps |

## 5. `monthly_updates/`: location and what is tracked

- **Location:** repository root, `monthly_updates/YYYY-MM/` by data month (Q-26).
- **Drop point:** the owner keeps dropping files in the private monthly inbox (one place, unchanged habit); the update
  engine reads it through `PRD_MONTHLY_INBOX` and copies approved files into the repository folder after the privacy
  scan. Dropping directly into the repository folder also works.
- **Tracked in git (D-023 point 1, D-026):** `README.md`, `_policy/`, `MANIFEST.json`, `UPDATE_REPORT.md`, and the
  approved monthly source files in their role folders: `mf-monitor/` (Regular and Direct), `sif-monitor/`, `reckoner/`
  (as PDF while the PPTX exceeds 50 MB), `one-pagers/` (PMS and AIF, approved products), `market-update/`,
  `disclaimer/`, `index-data/`, `other-approved/`. Every Accord file is class P (the owner confirmed on 22 Oct 2026
  that the licence covers all Accord files), so the analytics, expense ratio, listed equity, fund manager and exit load
  files are tracked too, in `other-approved/`.
- **Never tracked:** the MF Screener data pack (class N, never published or embedded, D-026; its fingerprint, contract
  version and counts are in the manifest); class C workbooks whose role is not yet approved (the in-house risk ratios
  and the fund ranks: proven by hash until approved); the original of any file above 50 MB (its SHA-256 is recorded);
  class N files (client material), which are quarantined and reported, never copied.
- **`.gitignore` change (M11):** keep the global blocks for office and image formats, and add a narrow negated
  allow-list for the approved role folders above. `prepush-scan.mjs` rejects a client pattern, a Screener pack, a file
  of an unapproved role or a file above 50 MB under `monthly_updates/`.
- **Size:** plain git, no LFS; a file above 50 MB is tracked as PDF with the original's SHA-256 recorded (D-023); the
  scanner warns above 20 MB (Q-14 default).

## 6. Changes to existing files

| File | Change | Milestone |
|---|---|---|
| `README.md` | Two apps during the parallel run; how to run both; link to `docs/README.md`; changelog link | M1.1 |
| `CLAUDE.md` | Rules 1 and 5 scoped to the legacy `index.html`; new section for the app (stack, layers, commands, the MF Screener link exception (D-027), the data-class policy (D-026, implementing D-023)) | M1.1, M1.2 |
| `CHANGELOG.md` | Moved to `docs/CHANGELOG.md` with history intact (`git mv`) | M1.1 |
| `docs/ARCHITECTURE.md` | Moved to `docs/legacy/ARCHITECTURE.md`; new file from `03-architecture.md` | M1.1 |
| `docs/MONTHLY_REFRESH.md` | Unchanged until M11; then moved to `docs/legacy/` | M11 |
| `docs/TESTING.md` | New-app section from `08-regression-test-plan.md` | M1.3 |
| `docs/DEPLOYMENT.md` | `/next/` channel; switch-over and rollback | M1.2, M15 |
| `docs/KNOWN_ISSUES.md` | KI-124 is already on `main` (PR #7); N-1 to N-10 filed from KI-125 | M1.1 |
| `docs/DECISIONS.md` | D-022 and D-023 are already on `main` (PR #7, PR #8); D-024 to D-033, the owner's answers of 22 Oct 2026 to ND-1 to ND-10 (architecture §21), recorded at M1.1 | M1.1 onward |
| `docs/change-requests/CR-0006-new-build.md` | exists (PR #8); status updated as Phase 0 is delivered and at each milestone | M1.1 onward |
| `docs/new-build/` | exists with `00-owner-brief.md`; Phase 0 deliverables, `inputs/` and a `README.md` added | M1.1 |
| `.github/workflows/ci.yml` | Job `next`: zero-dependency form (scan, docs links, `node --test`) | M1.1 |
| `.github/workflows/ci.yml` | Job `next` extended: `npm ci`, typecheck, build, invariants | M1.2 |
| `.github/workflows/pages.yml` | Stage `/` and `/next/`; widened trigger paths (D-024 supersedes D-007 in part) | M1.2 |
| `.claude/launch.json` | Local server entry for the new app | M1.2 |
| `.gitignore` | `dist/`, `node_modules/` (already), monthly allow-list | M1.2, M11 |

## 7. Branch, commit and release conventions (unchanged, restated)

Branches `feature/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>` from `main`; conventional commit prefixes
(`feat:`, `fix:`, `test:`, `docs:`, `chore:`); one PR per milestone unit; CI green; merge locally with the no-reply
identity (D-020) per D-017; never force-push, rewrite history or delete branches (`CLAUDE.md` rule 8); every push
reported with evidence (SHA, `git ls-remote`). Tags: the annotated tag `legacy-baseline-782794f` on `782794f`, created
and pushed in M1.1 (in its scope and acceptance in `07-implementation-roadmap.md`), and `next-vX.Y.Z` on releases of
the new app. AC-22 inspects history from the baseline tag onward.
