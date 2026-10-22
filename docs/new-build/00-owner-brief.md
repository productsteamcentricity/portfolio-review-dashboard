# New build brief (owner, 21 Oct 2026) — sanitised copy

Sanitised: the MF Screener login details are removed (never stored anywhere); client names are replaced by
"reference deck A" (a 41-slide unit-based rebalancing review of one family) and "reference deck B" (a 21-slide
collection of portfolio-observation slides from several portfolios); the previous owner's site is "the original
dashboard". Otherwise the owner's text, condensed only where it repeated itself.

## ROLE
Senior full-stack engineer, financial analytics architect, investment research analyst, product designer,
PowerPoint automation specialist, Excel model developer, DevOps engineer and QA lead. Build the next-generation
Centricity Portfolio Review Dashboard as a clean, maintainable new application, using the existing dashboard as a
reference implementation and preserving its proven capabilities. Used by Centricity analysts to review client
portfolios, diagnose risks and return drivers, investigate MF overlap, examine holdings and performance, prepare
rebalancing, assess taxation and generate client-ready presentations.
Six perspectives: (1) analyst — less manual work, editable outputs without repairing layouts; (2) client — risks,
return drivers, inefficiencies, improvements, clear and evidence-based; (3) investment researcher — validated data,
appropriate benchmarks, defensible calculations; (4) software architect — clean architecture, reusable components,
maintainable calculation logic, reliable analytics/Excel/PowerPoint integration; (5) DevOps/documentation — Git
history, public repo organisation, versioning, monthly updates, handover docs; (6) quality/control — no lost
capability; every material calculation traceable, reproducible, auditable.

## GOAL
A new version that retains useful capabilities while improving analyst experience, analytics, observations,
presentation quality, monthly maintenance and auditability. Must provide: clean new architecture; preservation of
working review capabilities and useful presentation sections; single-page analyst workspace with logical sections
and tabs; client-level and advisor-level analytics and overlap; equity, debt, look-through and historical analytics;
a structured client-specific observation engine; conditional Review Snapshot (depends on whether rebalancing is
undertaken); editable client-ready PowerPoint; structured formula-driven Excel with traceable calculations; a
dedicated MF Screener navigation link; repeatable monthly update workflow from a designated folder; a reusable
product bank maintained from Investment Reckoner presentations and product material; public Git with regular safe
commits and pushes; a new monthly PRD and handover record every monthly cycle; comprehensive validation, source
tracking, reconciliation, exception handling and regression testing; a foundation for Phase 2 automated rebalancing.
Central requirement: a new build without loss of existing review capability. Rebuild cleanly, preserve the existing
system until the replacement demonstrates functional parity, reuse validated logic and materials, do not inherit
unnecessary technical debt.

## CONTEXT
1. Existing dashboard: the original dashboard (previous owner's published site) and a separate rebuild (this
   repository) based on the earlier owner's PRD and files; the previous owner may still provide more material. The
   existing application represents working investment-review functionality that must be retained. Inspect the local
   repository, PRD, source, Git history, docs, assets, calculation modules, presentation logic and handover files.
2. Reference presentations: reference deck A (report structure, asset allocation, observations, quantitative
   analysis, rebalancing, redemption, taxation, holdings, performance) and reference deck B (level of investment
   analysis and client-specific reasoning expected). Analytical and design references only: never copy their client
   data or observations into unrelated reports.
3. MF Screener: https://centricity-mf-dashboard.pages.dev/ (login required; the owner holds the credentials). Never
   hardcode or commit credentials; use an approved local secret mechanism for reusable automation; never put them in
   config, screenshots, logs, outputs or PRDs. If authentication fails, record the failure and fall back to the
   monthly Excel data; never circumvent authentication or claim data was retrieved when it was not.
4. Claude Artifact design reference (inspected 21 Oct 2026: it is the "One Digital Reckoner Console", a monthly
   data upload tool with the flow Upload → Validate → Preview → Review → Approve → Final Excel, browser-only
   processing; no portfolio-review layout or visual spec).
5. Public Git and monthly update policy: the repository is public. The designated monthly update folder and its
   approved non-client source materials are intended to be tracked in the public repository (Investment Reckoner
   presentations, PMS one-pagers, AIF one-pagers, MF Monitor, SIF Monitor, Market Update slides, approved disclaimer
   material, other approved non-client files). Safety check before publishing: never client portfolio data,
   confidential client presentations, credentials, tokens, personal data or unauthorised material; if a sensitive
   file appears, stop that publication and report. Organise so approved monthly inputs, code, product data, docs,
   tests and changelogs are easy to locate.

## PHASE 0: AUDIT AND NEW BUILD
0.1 Inspect before changing: repo structure and remotes, branch and uncommitted changes, architecture and framework,
PRD/README/handoff/technical docs, analytics and calculation engines, upload and file processing, client-level and
advisor-level views, overlap analysis, PPTX and Excel exports, rebalancing and taxation, supporting product files,
charts, templates, assets, data schemas and benchmark mappings, build and deployment config, known errors and
incomplete functionality. Determine what works, what needs improvement, what cannot be verified (missing inputs).
0.2 Feature inventory baseline. For each feature: name, purpose, implementation location, required inputs,
calculations, dashboard output, PowerPoint output, Excel output, status, dependencies and limitations, regression
tests needed. Classify: working, partially working, broken, missing, dependent on unavailable source material.
0.3 Clean new application with well-organised architecture; do not default to patching the old rebuild; do not
delete or replace the existing system before functional parity. Keep the new app clearly separated (dedicated app
directory, reference branch, tagged baseline or similar). Retain access to the old app until its capabilities are
ported or accounted for. Reuse selectively: proven calculation logic, working analytics, validated schemas, design
assets and templates, correct benchmark and product mappings, working overlap calculations, slide-generation
routines, Excel-generation logic, analyst workflows, relevant docs. Do not copy the legacy architecture blindly;
evaluate each reuse for correctness, maintainability and compatibility.
0.4 Feature parity is a release requirement: before retiring or archiving the old app, demonstrate the new one
generates the same essential reviews; classify output differences as intentional improvement, correction, or
regression; never drop a feature because it is hard to migrate; document blockers and fallbacks.
0.5 Deliverables: (1) legacy system audit, (2) existing capability inventory, (3) new application architecture,
(4) reuse and migration plan, (5) feature-parity matrix, (6) data-source inventory, (7) implementation roadmap,
(8) regression test plan, (9) proposed repository and documentation structure. Then implement; do not stop at
planning.

## PHASE 1: GIT REPOSITORY ORGANISATION AND DELIVERY
Mandatory, continuous. Inspect remotes, URL, default branch, working state; do not guess or overwrite remote config;
preserve unrelated work. Organise the repo (suggested: app/{components,pages,analytics,observations,data,exports,
configuration,services}, public/{assets,templates,approved-reference-material}, monthly_updates/YYYY-MM/,
product_bank/{products,performance,source_register}, docs/{PRD.md,ARCHITECTURE.md,DATA_DICTIONARY.md,
MONTHLY_UPDATE_GUIDE.md,HANDOVER.md,CHANGELOG.md,monthly-prds/}, tests/{unit,integration,regression,fixtures},
scripts/{monthly-update,validation}, .gitignore, README.md, package.json) — a starting point, adapted to the stack,
no redundant folders or duplicate sources of truth. monthly_updates/YYYY-MM/ is tracked in public Git (not
gitignored), clearly dated; keep credentials, client data and confidential reports out. Commit incrementally with
meaningful messages (feat:/fix:/test:/docs:), coherent tested units. Push tested milestones regularly; follow
existing branch/review conventions; never force-push or rewrite history; report actual blockers; never claim a push
without confirmation. Before every public push check: no client data, no secrets, no unintended generated reports or
temp files, no confidential documents, intended monthly files included, .gitignore correct, build and tests pass,
intended files staged, no unrelated changes. Handover records branch, latest commit, remote, push state, pending
changes, deployment limitations.

## PHASE 2: SINGLE DATA AND CALCULATION ARCHITECTURE
One shared model for dashboard, Excel and PowerPoint. Representations for: clients and families; accounts, folios,
ownership; advisors and distributors; funds, schemes, securities, products (MF, SIF, PMS, AIF, direct equity, bonds,
others); quantities, units, transaction lots, NAV, valuation dates; invested and current value; unrealised and
realised G/L; categories and benchmarks; performance periods; underlying holdings and look-through; historical
snapshots; analyst inputs and assumptions; observation rules; rebalancing scenarios; tax calculations; product-bank
entries; source files, import records, validation results; presentation outputs and audit records. Stable
identifiers wherever available, not names alone. Separate layers: source, normalised, validated, calculated metrics,
analyst assumptions, scenario outputs, observation content, presentation rendering, Excel rendering, audit and
validation records; no duplicated calculation logic. Missing data statuses distinguish zero, unavailable, invalid,
stale, not applicable, partial: NOT DISCLOSED, NOT AVAILABLE IN SUPPLIED DATA, NOT APPLICABLE, NOT COMPARABLE,
HISTORICAL ONLY, CURRENT DATA NOT AVAILABLE, INSUFFICIENT EVIDENCE, INVALID SOURCE DATA, STALE DATA, PARTIAL
COVERAGE. Never silently use zero or outdated values.

## PHASE 3: DASHBOARD INFORMATION ARCHITECTURE (single page, nine sections)
1 Uploads and inputs (existing uploads; holdings, transactions, capital gains, disclaimer, monthly files; import
status, reporting dates, missing files, validation errors). 2 Portfolio overview (summary snapshot, asset
allocation, client-level and advisor-level allocations, IPS, figures). 3 Portfolio observations (Review Snapshot,
risk and return analysis, what is working, what needs attention, quantified findings, one-slide SWOT in concise
pointers). 4 Analytics and overlap (existing equity and debt analytics, MF overlap, client/advisor views, historical
analytics, contributors and laggards, look-through; all additive). 5 Holdings and performance (holdings, MF quant
data, MF and SIF performance, PMS performance, direct equity, benchmarks). 6 Rebalancing (preserve fund selection,
proposals, schedules, analytics; new automated engine deferred to Phase 2). 7 Taxation (preserve transaction- and
unit-based tax calculations). 8 Market updates (monthly material; market-update slides at the beginning of the
exported deck). 9 Annexure (approved PMS and AIF one-pagers, product information, supporting analysis, portfolio
cost analysis). Consistent navigation and layouts; no useful functionality deleted.

## PHASE 4: MF SCREENER ACCESS
A visible navigation item "MF Screener" linking to the Screener, opening in a new tab, preserving dashboard state,
not dependent on any import. Optional embedded view only if authorised, secure and reliable (check iframe support);
never bypass authentication or browser security. Use credentials only for authorised access; never hardcode or
publish; recurring automation via environment variables or another approved secure mechanism. Prefer structured
data or authorised exports over visual scraping; on failure use the monthly MF Monitor Excel, record the source and
limitations.

## PHASE 5: CONDITIONAL REVIEW SNAPSHOT
Explicit analyst-selected mode: "Portfolio Review Only" (default for a new review) or "Portfolio Review with
Rebalancing" (only with a valid proposal). Review Only: current value, invested value and unrealised G/L, asset
allocation, market-cap and sector exposures, performance and benchmark comparisons, risk-adjusted metrics where
meaningful, concentration, overlap and fund quality findings; no pre/post improvements or implied rebalance. With
Rebalancing: principal issues, weaknesses addressed, quantified pre/post changes, construction improvements, changes
in overlap, fund quality or risk measures where supported, trade-offs and risks, tax, liquidity and execution
constraints, conclusions and next steps; select the most material metrics. Mode updates the Snapshot, summaries,
presentation manifest and audit records; missing proposal data → no unsupported post-rebalancing comparisons;
switching modes never changes current portfolio data or uses a separate engine; only one Snapshot in the deck.

## PHASE 6: ASSET ALLOCATION, EQUITY, DEBT, OVERLAP
6.1 Consolidate the existing four asset allocation slides into two: client-level allocation (charts and tables
together) and advisor-level allocation (charts and tables together); retain all other useful slides. Fixed legend
colours, consistent grey pie outlines, horizontal legends, no unnecessary gridlines, consistent chart sizes,
reconciled totals. 6.2 Equity: preserve and enhance market-cap allocation, sector analysis, top-three sector
concentration, underlying holdings, concentration and historical analytics; do not apply the debt sub-2% rule to
equity sectors. 6.3 Debt: consolidate eligible debt components below 2% into "Others" where appropriate, keep full
detail, explanatory note below the pie, no double counting, chart/table/totals reconcile, correct debt denominator,
never combine incompatible dimensions. 6.4 Credit-rating buckets (proposed): (1) Sovereign, AAA/A1+ and cash
equivalents; (2) Unrated; (3) AA+ through B. Verify source rating definitions; mutually exclusive, documented; flag
unclassifiable scales or instruments. 6.5 Client-level and advisor-level selectors for analytics and overlap;
preserve existing MF overlap, equity overlap, debt analysis, current/proposed comparisons. 6.6 Historical analytics
from actual dated data or stored snapshots (including March 2026 and September 2026 where available); show source
dates, as-of date, coverage; never present current holdings as historical. 6.7 Hybrid FoF look-through: net equity
and debt via underlying funds where allocations are available; extensible framework for other products with
underlying holdings; keep wrapper-level classification, prevent double counting, report partial or unavailable
look-through.

## PHASE 7: HOLDINGS AND PERFORMANCE
7.1 Holding sheet sorted by current value descending; group/merge repeated distributor labels where it improves
PowerPoint readability, keeping detail; consistent grey borders, spacing, naming, chart/table order. 7.2 MF
quantitative metrics (the "Portfolio Quants" content of reference deck A, slides 5 and 7) sourced from the Screener
subject to availability and validation; monthly Excel fallback; track metric names, values, periods, benchmarks,
source and dates. 7.3 Performance sheets: centre all columns except Instrument Name (overrides the general numeric
alignment). Equity MF order: index; large-cap; diversified equity; mid-cap; small-cap; thematic and sectoral
combined; global; Fund of Funds — with benchmarks and explicit category mappings. Hybrid: low to high risk, from
arbitrage to aggressive hybrid. Debt: low to high risk, from overnight to high duration; remove the two-year column;
include relevant debt indices.

## PHASE 8: PORTFOLIO OBSERVATION ENGINE
An observation bank driven by calculations and portfolio conditions, starting from "What drives portfolio risk?" and
"What drives portfolio return?": overlap, genuine diversification, asset allocation, market-cap and sector
exposures, fund selection, benchmark performance, concentration, fragmented holdings, hidden exposures, liquidity,
rebalancing considerations. Each rule: defined inputs, trigger conditions, supporting metrics, data-quality
requirements, narrative instructions, audit information. Reasoning: Evidence → Diagnosis → Portfolio implication →
Action or decision to consider. Client-specific evidence, no generic commentary. Adapts to the Snapshot mode. Natural
professional language; never en or em dashes in presentation writing; no unsupported claims, repetitive AI-style
wording or duplication. Analyst can inspect and edit an observation without altering the calculation.

## PHASE 9: POWERPOINT OUTPUT
Cambria default, 9 pt table/body (subject to readability); fixed legend colours, consistent outlines, restrained
grey borders, coherent spacing, native editable components; no excessive text boxes, redundant shapes, duplicated
metrics or full-slide placeholder images. Reference deck A slide 8: current value, pre/post three- and five-year
CAGR, illustrative pre/post values after three and five years, rupee difference; analyst-entered expected returns
for alternate products; historical vs illustrative projections clearly distinguished, never guarantees. Slide 9:
redemption in units with INR amount; instrument, units, reference NAV/price, estimated value, timing, rationale;
borders highlighting differences; remove the "Reinvest into" column but keep the underlying calculation. Slide 6:
Actionables column from black to tan. Slide 25: lighter grey borders. Holding sheet: sort by value, group repeated
distributor labels. Placeholder slides: editable elements, logo at the lower-right. Market-update slides at the
beginning. Conditional Review Snapshot per mode. Map these to slide components, not hardcoded slide numbers.

## PHASE 10: EXCEL WORKBOOK
Logical sections: Read Me and Controls; Source Inputs; Portfolio Overview; Observations; Equity Analytics; Debt
Analytics; Overlap; Historical Analytics; Holdings; Performance; Rebalancing; Tax and Transactions; Market Updates;
Annexure; Assumptions and Audit Log (final structure sensible for the architecture). Identifiable inputs, formulas,
outputs; number formats, filters, freeze panes; no redundant tabs or unexplained numbers; no merged cells in data
ranges. Re-upload of an edited workbook: validate structure, identify supported input changes, recalculate dependent
outputs, report formula conflicts, refresh presentation content, log changes.

## PHASE 11: MONTHLY UPDATE WORKFLOW
Operated by one instruction ("I have updated the files in the monthly_updates folder. Process the updates and
prepare the current month's data."); no prompt rewriting or code edits monthly. Folder monthly_updates/YYYY-MM/,
publicly tracked for approved non-client files. Recognise Investment Reckoner presentations, PMS and AIF one-pagers,
MF Monitor, SIF Monitor, Market Update slides, disclaimer material, other approved files. Engine: locate the active
folder; classify files; validate files and dates; extract fields; normalise product, fund and benchmark identifiers;
update the product bank from the Investment Reckoner; update MF and SIF Monitor performance; update PMS and AIF
references; refresh market-update and disclaimer material; preserve history; recalculate; validate and reconcile;
identify missing or conflicting files; produce an update summary; refresh outputs when requested. Product bank keyed
by stable identifiers; add new products, update existing, keep source history, no duplicates from naming
differences; performance history separate from descriptions; no facts inferred from a product name. Idempotent:
re-running never duplicates products, performance records, slides or snapshots; track source file, reporting date,
import version, fingerprint, records added/updated, validation issues, output changes; unresolved competing files
reported. Update report: files processed, rejected/unrecognised, products added/changed, performance updated,
snapshots created, market updates and disclaimers refreshed, missing files, data-quality issues, Screener retrieval
failures, outputs refreshed, items for analyst review; never claim success when processing or validation failed.

## PHASE 12: MONTHLY PRD AND HANDOVER
Living docs/PRD.md (application, users, structure, requirements, data flows, calculations, design standards,
reporting modes, monthly process, tests, constraints), kept consistent with the implementation. Every completed
monthly cycle: docs/monthly-prds/YYYY-MM-Portfolio-Review-PRD.md with (A) project state: version, reporting month,
branch, latest commit, structure, implementation status; (B) changes: features, improvements, bugs fixed,
calculation, presentation, workbook, pipeline, documentation changes; (C) source files and monthly data: types,
names and dates, product updates, MF/SIF Monitor updates, PMS/AIF material, market-update and disclaimer versions,
missing or rejected files, data-quality limits — never client holdings, values, credentials or confidential data;
(D) current functionality and the feature-parity checklist; (E) technical details: modules, changed calculation
definitions, schema and configuration changes, environment variable names (never values), build and test commands,
deployment and external dependencies; (F) tests and verification: tests run, results, reconciliation, PPTX and
Excel validation, build status, known defects, outstanding data issues; (G) decisions and assumptions; (H) next
steps and Phase 2 readiness; (I) Git and transfer: latest commit, push state, app location, folder convention,
steps to resume in another session. Maintain docs/HANDOVER.md, docs/MONTHLY_UPDATE_GUIDE.md, docs/CHANGELOG.md and
the monthly PRD. A future session must be able to resume from the living PRD, latest monthly PRD, handover, README
and Git state alone.

## PHASE 13: FINANCIAL VALIDATION AND AUDITABILITY
Reconcile invested and current value; units and NAV/price; unrealised and realised gains; allocations and totals;
equity and debt subtotals; look-through; debt rating groups; performance periods and benchmarks; pre/post figures;
tax and redemption; dashboard/Excel/PowerPoint consistency. Compute unrounded, round for display only. Outlier
checks (six-sigma flags where statistically meaningful); unusual is not automatically an error — keep the source,
record the test, require review. Handle missing data, duplicate files, conflicting names, incomplete benchmarks,
partial look-through, invalid denominators, unexpected categories, incomplete tax lots, stale external data,
inconsistent workbooks, presentation overflow; one invalid record never silently corrupts valid calculations.
Severity: Blocking, High, Warning, Information; record whether each blocks publication, auto-resolves or needs an
analyst decision.

## PHASE 14: QA
PowerPoint: required slides and order, correct Snapshot mode, market updates first, no stale client data, correct
benchmarks, category ordering, legend colours, alignments, editable elements, chart/table consistency, no overflow
or overlaps, no unintended watermarks, logo placement, opens and renders. Excel: sheet names and order, input and
formula structure, no formula errors, data integrity, number formats, reconciled totals, editability, unmerged data
ranges, re-upload and recalculation. Cross-output: material figures agree across dashboard, workbook, deck unless
scope or date legitimately differs (record why). Deployment: builds and deploys on the existing hosting or a
documented replacement; approved monthly files tracked; client data, credentials and private reports excluded;
before every push inspect the diff, status, scan for secrets, confirm only intended data is published.

## PHASE 15: TESTS AND ACCEPTANCE
Test legacy preservation and every new feature: (1) standard review generation; (2) client- and advisor-level
analytics; (3) Review Only; (4) Review with Rebalancing; (5) missing or inconsistent proposals; (6) current and
historical analytics; (7) debt with sub-2% components; (8) debt without them; (9) Hybrid FoF full look-through;
(10) partial; (11) missing benchmarks; (12) duplicate monthly files; (13) updated Investment Reckoner; (14) updated
PMS/AIF one-pagers; (15) updated MF and SIF Monitor; (16) failed Screener access; (17) Excel changes and re-upload;
(18) incomplete tax and transaction data; (19) extreme values; (20) PowerPoint editability and rendering; (21) public
Git exclusion checks; (22) incremental commits and pushes; (23) monthly PRD and handover generation; (24) repeating a
monthly update without duplicates. Synthetic or anonymised data for automated tests. Complete only when existing
functionality is preserved, new features work, the monthly workflow succeeds, outputs reconcile and the repo is
clean and documented.

## PHASE 16: PHASE 2 READINESS
Do not build the advanced rebalancing decision engine now. Preserve current rebalancing and taxation. Establish data
structures, scenario model, pre/post calculations, unit-based records, validation and interfaces for the next
phase's methodology. Document Phase 2 requirements and dependencies in the PRD and handover.

## FINAL EXECUTION
Start with the audit and the new architecture. Preserve the existing application until essential capabilities are
demonstrated in the new build. Implement in controlled phases; after each: run tests, check regressions, verify
calculations and traceability, inspect PPTX and Excel, update docs and changelog, commit, push where permitted,
record the actual Git outcome. Process each monthly update with the folder convention; produce the monthly PRD and
handover each cycle. Never report a feature complete before it is implemented and tested; never claim a push or
deployment without verification.
