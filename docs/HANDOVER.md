# Handover — start here

For a developer (or a Claude Code session) taking over the Centricity Portfolio Review Dashboard
without access to earlier conversations.

**Last refreshed:** 22 Oct 2026 (milestone M1.1 of the new build; the owner's answers D-024 to D-033). Refreshed at every milestone and at the end of every
monthly cycle from the 2026-10 data month ([monthly-prds/](monthly-prds/README.md)).

## 1. The product in brief
A single offline HTML file (`index.html`) that turns one client holdings workbook into a full HNI/UHNI
portfolio review: 20 tabs (Home, IPS Profile, Asset / Distributor / Client / AMC Allocation,
Observations, Holdings, Analytics, Overlap, Portfolio Cost, Fund IRR, Current vs Sample, MF Analysis,
Taxation, Centricity AI Analyst, Portfolio Rebalancing, Performance, Disclaimer, Thank You), a
PowerPoint deck in the Centricity house style and an Excel workbook. Users: Products Team analysts who
build reviews, and the data owner who refreshes the embedded vendor data monthly. Only the exports reach
partners and clients. Client data never leaves the browser.

Repository: https://github.com/productsteamcentricity/portfolio-review-dashboard (**public** — commit
nothing confidential). Site: https://productsteamcentricity.github.io/portfolio-review-dashboard/.
Local working copy on the Products team laptop: `C:\dev\portfolio-review` (outside OneDrive).

**A new application is being built** (CR-0006, the owner's brief of 21 Oct 2026): a clean rebuild with feature parity,
published beside `index.html`, which stays the review link until parity. Phase 0 (audit, architecture, parity matrix,
roadmap) was delivered on 22 Oct 2026; on 22 Oct 2026 the owner answered the ten open decisions (D-024 to D-033) and
gave Claude full charge of GitHub and the dashboard (D-033). Milestone M1.1 (safety tooling, records, living documents)
is ready for its pull request. No new application code exists yet.

## 2. Read in this order
1. `CLAUDE.md` — the rules and commands (10 minutes).
2. `docs/README.md` — the map of every document and record.
3. `docs/ARCHITECTURE.md` — how the file is built and where each calculation lives.
4. `docs/KNOWN_ISSUES.md` — what is broken or fragile.
5. `docs/PROJECT_STATE.md` — blockers, next steps, backlog.
6. `docs/MONTHLY_REFRESH.md` — the monthly data refresh: the owner's part and the runbook.
7. `docs/change-requests/` and `docs/refresh-log/` — what the owner asked for, and every refresh so far.
8. `docs/previous-owner/` — the previous owner's handover (functional spec §7; errata in
   `docs/REPLICATION_REPORT.md` §5), project history, and the knowledge dump from their full export
   (`knowledge/KNOWLEDGE_DUMP.md`; corrections to the handover in its §0.1).

For the new build, then:
1. `docs/new-build/README.md`: the Phase 0 record (the owner's brief, deliverables 01 to 09, the rule bank, the deck
   design system, the open questions, the investigator inputs) and which living document owns what.
2. `docs/PRD.md`: the living PRD (what the new application must do).
3. `docs/new-build/07-implementation-roadmap.md` and `docs/DECISIONS.md` D-024 to D-033: the milestones, and the
   owner's answers of 22 Oct 2026 to ND-1 to ND-10 (`docs/new-build/owner-decisions-new-build.md`).
4. `docs/DATA_DICTIONARY.md` and `docs/MONTHLY_UPDATE_GUIDE.md`: the new data model (v0.1), the planned monthly flow
   and the list of files the owner supplies each month.

## 3. Run and test
```bash
node tools/check-invariants.js      # structure, no-network, engine, data
node tools/smoke-review.js          # end-to-end on a synthetic book
node tools/serve-dashboard.js       # http://127.0.0.1:8099 (or double-click tools\open-dashboard.cmd)
node tools/make-sample-base.js      # synthetic files to upload (test-data/)
node scripts/validation/docs-links.mjs          # every relative link in the docs resolves
node --test "tests/**/*.test.mjs"               # tests of the new-build tooling
```
Setup details: `docs/DEVELOPMENT_SETUP.md`. Browser acceptance: `docs/TESTING.md` §4.

## 4. Making a change
1. Agree the objective and acceptance criteria with the owner; read the relevant code in `.blocks/`.
2. Branch from `main`. Change `index.html` only through a patch script in `tools/patches/` that uses
   `tools/patch-lib.js` (anchored, exactly-once replacements); confirm the scope (engine / exporters /
   parsers / UI / boot) of every anchor. The KI-001 patch is a worked example.
3. Financial logic: involve `financial-domain-reviewer`; add a check against a known answer.
4. Run the checks and the browser procedure; compare with the baseline results; update docs and
   CHANGELOG in the same branch.
5. `security-release-reviewer` reviews the staged diff (no client data, no secrets, no network calls), and
   `node scripts/validation/prepush-scan.mjs` passes (the pre-push hook runs it; `new-build/safety-tooling.md`).
6. Push the branch and open a PR; CI must pass. Work the owner asked for is merged once verified
   (D-017; Claude has full charge of GitHub and the dashboard, D-033, and no ruleset protects `main`, so the
   discipline of `CLAUDE.md` rule 8 is the protection); a merge that changes `index.html` republishes Pages
   automatically. Record the request in `docs/change-requests/`.

## 5. Monthly data refresh
`docs/MONTHLY_REFRESH.md`. The owner drops the month's files into the OneDrive inbox
(`…\Claude Code-Portfolio Review Dashboard\01 Monthly Updates\YYYY-MM`); Claude runs the pipeline in
`buildtools/` (survey → build → gate → splice on a `data/` branch → checks), writes
`docs/refresh-log/YYYY-MM.md`, and publishes after the owner approves. Never hand-edit the data blocks.
From the 2026-10 data month each completed cycle also gets a monthly PRD written from
`docs/monthly-prds/TEMPLATE.md` and a refresh of this handover. The new update engine's flow is planned in
`docs/MONTHLY_UPDATE_GUIDE.md` (milestone M11); until then the legacy process above applies. The files the owner
supplies each month (who sends each, where it goes, public or private, what it feeds) are tracked in one list there:
"Files the owner supplies each month".

## 6. Risks to keep in mind
- Silent wrong numbers are this project's historical failure mode: sums can be 100% and still wrong.
  Measure matching or data changes in both directions over the real universes.
- `index.html` is fragile to tooling: 10 MB lines, raw NUL bytes, exact-byte invariants.
- Client confidentiality: per-family state must be reset between clients (KI-001, fixed — keep
  `family-isolation.js` passing), KI-012 / KI-035 (localStorage), KI-008 (unescaped HTML). Never commit
  client files; test with synthetic data.
- Pages URLs are public to anyone holding the link (`docs/DEPLOYMENT.md`).

## 7. Agents available (`.claude/agents/`)
`dashboard-archaeologist` (read-only investigation) · `financial-domain-reviewer` (calculations and
data interpretation) · `implementation-engineer` (anchored patches) · `qa-engineer` (checks and
browser acceptance) · `security-release-reviewer` (pre-commit / pre-push gate) · `refresh-operator`
(runs a monthly refresh by the runbook; never publishes).

## 8. Git state (22 Oct 2026)
- `main` and `origin/main` at `8cb320d` (merge of PR #8: CR-0006 and D-023). `index.html` MD5
  `EF2FF4F198A41FE02404B3617CBAD36E`, unchanged since `782794f`.
- Milestone M1.1, local and not yet pushed: `feat/m1-1-safety-tooling` (the safety tooling) and, on top of it,
  `docs/m1-1-new-build-docs` (the Phase 0 records, the living documents and the owner's answers of 22 Oct 2026).
- Legacy fix batch 2a (OD-32, OD-34, KI-124; D-022) is being built on `fix/legacy-batch-2a`.
- Not created yet: the baseline tag `legacy-baseline-782794f` (M1.1).
- To resume: read section 2, then the next steps in `docs/PROJECT_STATE.md`.
