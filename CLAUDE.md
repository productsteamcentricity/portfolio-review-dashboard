# CLAUDE.md — Centricity Portfolio Review Dashboard

Operating contract for every Claude Code session in this repo. Read it fully before acting.
Detail lives in `docs/` (map at the end). The product owner judges changes in the browser,
not by reading code, and owns every decision about product behaviour.

## What this is
One offline HTML file, `index.html` (~16.8 MB), that turns one client holdings workbook into an
HNI/UHNI portfolio review: 20 on-screen tabs, a PowerPoint deck (PptxGenJS) and an Excel workbook
(SheetJS). All libraries and ~10 MB of vendor reference data are embedded. There is no server, no
build step and no npm install. Repository: github.com/productsteamcentricity/portfolio-review-dashboard
(**public**); `.github/workflows/pages.yml` publishes index.html only to
https://productsteamcentricity.github.io/portfolio-review-dashboard/. Users: the Products Team analysts
and the monthly data owner.

## Non-negotiable rules
1. **`index.html` is the product. Never rewrite, reformat, prettify, minify, split or re-bundle it.**
   Change it only with a patch script in `tools/patches/<yyyy-mm-dd>-<slug>.js` built on
   `tools/patch-lib.js` (anchored, exactly-once, idempotent edits; refuses to break the file's
   invariants), committed with the change; then re-run `node tools/check-invariants.js`.
   Never open it in an editor or with the Edit/Write tools: it has 10 MB lines and **3 raw NUL bytes**
   inside the UI script (string-literal keys), which editors and tools can corrupt.
2. **No network calls, ever** (compliance: client holdings never leave the browser). No `fetch`,
   `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, remote `src`/`href`, LLM/API features.
   `check-invariants.js` enforces this on the app code and the page shell.
3. **Never invent a number.** An unmatched holding gets a blank, a footnote and a count. Never fill a
   gap with a guess, an average or another plan's figure; never use the all-in expense Ratio when the
   base expense ratio is missing.
4. **Matching rules are fixed** (`07_engine.js` normalize/matchInstrument/matchPMS): ≥3 shared tokens
   with ≥2 distinctive (or ≥2 with full containment), brand anchor never empty, product class (MF / PMS /
   AIF / SIF) never crossed, debt funds never get an equity benchmark (exceptions today: KI-024).
   Never lower a threshold. Measure any matching change both ways over the real universes before shipping.
5. **Five self-contained scripts** (engine 07, exporters 08, parsers 09, UI 11, boot 12) share only via
   `window.*` / `ENGINE.*`. A helper put in the wrong scope is silently `undefined`. Confirm the anchor's
   scope before inserting. Load order engine → exporters → parsers matters. Locate blocks by marker.
6. **Never commit client data** — the repository is public, so everything committed is world-readable
   and permanent: no base files, IRR sheets, decks, snapshots, vendor workbooks, client names,
   credentials or internal-only material. `.gitignore` blocks office/data formats. Test with `tools/make-sample-base.js` output; an
   anonymised real file only with the owner's approval, kept outside the repo, never committed.
7. **Financial changes need a financial review** (`financial-domain-reviewer` agent) and a test that
   checks the number against an independently known answer (see `tools/smoke-review.js`).
8. **Git**: work on a branch, push it and open a PR; keep `main` green. Owner's standing instruction
   (D-017): merge verified work the owner asked for once CI is green — merging republishes Pages. A data
   refresh is merged only after the owner has reviewed it. Record every request in
   `docs/change-requests/`. Never force-push, rewrite history, delete branches or bypass checks. Commit
   identity must be explicit (`user.useConfigOnly` is on; never let git invent an author email).
9. **Stage discipline**: implement only what the owner asked. Record other defects/ideas in
   `docs/KNOWN_ISSUES.md` or the backlog in `docs/PROJECT_STATE.md`; do not fix them on the side.

## Conventions the code actually uses (verified at baseline, see docs/ARCHITECTURE.md)
- Base file: header row found in the first 5 rows, columns matched by alias. **`XIRR (%)` / `BMXIRR (%)`
  are percent numbers** (8.79 = 8.79%) and are divided by 100 (`07_engine.js:736`); a %-formatted Excel
  cell (stored as 0.0879) would show 100× too small. `Allocation (%)` is read as a fraction. Money is
  ₹ / ₹ Lakh / ₹ Cr. by column label; Current Market Value (Cr.) is the basis of every weight.
- Excel dates read via SheetJS `cellDates` land ~10 s before local midnight in IST: date helpers shift
  +12 h before reading Y/M/D. Keep that. XIRR is actual/365, bisection to bracket width < 1e-12.
- AMC cap 20%: the AMC tab measures it on the **MF book**, the AI Analyst on **total CMV** (KI-004).
- Palette (`ENGINE.palette`): black #000000 · gold #BD9568 · tan #DBC8B2 · greyM #BFBFBF · greyL
  #D9D9D9 · white · red #931621 (negatives) · green #2E7D32 · bgYellow #FFF8E1 · brownText #5C3E17.
  Font Cambria everywhere. App chrome #F2F0EC. PPTX pagination constants are calibrated: change a font
  or padding → re-derive them and open the deck at every page boundary.

## Repo layout
```
index.html            the dashboard (the only runtime file; published to Pages)
README.md  CLAUDE.md  CHANGELOG.md
buildtools/           the monthly data-refresh pipeline (build → gate → splice); README.md inside; out/ ignored
tools/                engine-host.js (runs the shipped engine in Node) · check-invariants.js · smoke-review.js ·
                      make-sample-base.js · extract-blocks.js · test-ai-analyst.js · serve-dashboard.js +
                      open-dashboard.cmd (local preview) · render-slides.js · parse-fund-ranks.js ·
                      parse-fund-mgr.js · patch-lib.js + patches/ (every index.html change) · browser-checks/
docs/                 README.md (index) · HANDOVER · MONTHLY_REFRESH · ARCHITECTURE · DEVELOPMENT_SETUP · TESTING ·
                      DEPLOYMENT · DECISIONS · KNOWN_ISSUES · PROJECT_STATE · REPLICATION_REPORT ·
                      change-requests/ · refresh-log/ · previous-owner/ (handover docs and knowledge, as received)
.claude/              launch.json (preview server) · agents/ (project subagents)
.github/workflows/    ci.yml (checks on main and PRs) · pages.yml (publishes index.html only)
```
Not in git (yet): vendor data and the owner's inbox live in OneDrive. The licence allows publishing the monitor
files (D-023), so approved monthly source files move to a tracked `monthly_updates/YYYY-MM/` with CR-0006 Phase 1;
client data never goes in git. OneDrive (`…\Claude Code-Portfolio Review Dashboard\`
`01 Monthly Updates\YYYY-MM`, `02 Archive\YYYY-MM`, `03 Handover`); the previous owner's unpacked export is
in `C:\dev\handover-export`. Monthly refresh: docs/MONTHLY_REFRESH.md (`refresh-operator` agent).

## Commands (Windows; toolchain in C:\dev\tools, on the user PATH)
In a Claude Code PowerShell call, prepend the toolchain if `node` is not found:
`$env:Path = 'C:\dev\tools\node;C:\dev\tools\git\cmd;C:\dev\tools\gh\bin;' + $env:Path`
- `node tools/check-invariants.js [--expect-md5 <hash>]` — structure, no-network, engine surface, data sums
- `node tools/smoke-review.js` — end-to-end engine + exporters on a synthetic book (35 checks)
- `node tools/test-ai-analyst.js` — AI Analyst acceptance rules on the embedded data (24 checks, CI-blocking)
- `node tools/run-regression.js [KI-nnn]` — known-answer test of each fixed issue (`tools/regression/`, CI-blocking)
- `node tools/make-sample-base.js` — synthetic base + IRR files and a second family to `test-data/`
- `node tools/extract-blocks.js` — reading copies of the code blocks in `.blocks/` (cite as `07_engine.js:736`)
- `tools/browser-checks/family-isolation.js` — paste into the browser console on the local preview and
  run `await familyChecks.isolation()` (then `irrBeforeBase()`, `removeThenReload()` on fresh pages);
  `tools/browser-checks/cvs-refresh.js` likewise (`cvsChecks.planRefresh()`, `hybridSplit()`, `unallocated()`, `fof()`)
- `node tools/serve-dashboard.js` → http://127.0.0.1:8099 (or preview config `dashboard` in .claude/launch.json);
  test a PR branch from its own worktree (e.g. `C:\dev\pr-review`) served on another port, e.g. `serve-dashboard.js 8101`
- A patch that is partly present stops without writing: a later patch rewrote its text. Never force it; rebuild
  with `git checkout -- index.html` and every script in `tools/patches/` in file-name order.
- Run engine code from a **script file**, never `node -e`: under `-e`, `require/module/exports` are
  globals and the embedded UMD bundles take their CommonJS path and break (KI-011).
- Search code in `.blocks/`, not `index.html` (the NUL bytes make grep/ripgrep treat it as binary).

## Workflow for every change (detail in docs/HANDOVER.md)
1. Restate objective, acceptance criteria and non-goals; read the relevant docs and code first.
2. Branch `feature/<slug>` or `fix/<slug>` from `main`.
3. Implement via an anchored Node patch script (rule 1); keep the change minimal.
4. Run `check-invariants`, `smoke-review`, `test-ai-analyst`; for UI/export changes run the browser
   acceptance steps in docs/TESTING.md (upload the synthetic files, check tabs, console, network,
   exports). Distinguish new failures from known ones.
5. Update CHANGELOG.md, PROJECT_STATE.md and any affected doc in the same change.
6. Have `security-release-reviewer` check the staged diff (no client data, no secrets, no unrelated
   files); commit, push the branch, open a PR, report the commit SHA and PR link. Merge per rule 8, and
   write or update the request's record in `docs/change-requests/`.

## Per-family state (KI-001)
Loading a base file over a loaded one, or removing it (×), runs `resetFamilyState()` (UI script): the
IRR, PMS/AIF and bonds uploads return to defaults and all family state is dropped; market-data uploads
stay. Any new per-family state you add must be cleared there too, and `family-isolation.js` must pass.

## Docs map
`docs/README.md` indexes everything. Start with docs/HANDOVER.md; the monthly process is
docs/MONTHLY_REFRESH.md. The previous owner's handover, knowledge dump and decisions log are in
`docs/previous-owner/` (background; errata in REPLICATION_REPORT.md §5 and KNOWLEDGE_DUMP §0.1).
