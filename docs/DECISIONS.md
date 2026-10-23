# Decision register

Newest last. Each decision records context, the choice, alternatives and consequences. A later
decision that changes an earlier one says "Supersedes D-xxx". Decisions taken by the previous owner
(May–Oct 2026) are summarised in `previous-owner/handover/PROJECT_HISTORY_Portfolio_Review_Dashboard.md` and the
handover; the most important of them are restated as rules in `CLAUDE.md`.

## D-001 — The git repository is the working folder, outside OneDrive (14 Oct 2026)
**Context.** The previous owner kept three byte-identical copies of the dashboard (`index.html`,
`Portfolio_Review.html`, `github-repo/index.html`) because the working folder was not version-controlled
and lived in OneDrive (which corrupts `.git`).
**Decision.** One repository at `C:\dev\portfolio-review` holds the dashboard, tools, docs and agent
definitions. There is a single `index.html`; `Portfolio_Review.html` and `github-repo/` are dropped.
**Alternatives.** Recreate the three-copy layout (keeps `buildtools/` scripts unchanged but keeps the
sync problem and leaves docs/tools unversioned).
**Consequences.** When `buildtools/` arrives, the `targets` arrays in `splice_refresh.js`,
`patch_dates.js` and `patch_riskdate.js` must be reduced to `index.html`. Supersedes handover §3 step 2.

## D-002 — Start the new repository from a fresh history (14 Oct 2026)
**Context.** The source repo (the previous owner's `Portfolio_Review_Dashboard`, public, 1 branch,
no tags) has client names in three commit messages (per the handover) and is public.
**Decision.** Do not import the old history. The baseline commit records its provenance (source repo,
commit `cab22e6747c02b87f0f95466874b3209edc5da22`, `index.html` MD5) in its message and in
`REPLICATION_REPORT.md`. **Consequence.** `git log` starts on 14 Oct 2026; earlier history is in
`docs/previous-owner/handover/PROJECT_HISTORY_Portfolio_Review_Dashboard.md`.

## D-003 — Sanitise the imported files (14 Oct 2026)
**Decision.** Remove a client-name pattern from `.gitignore` and a client name from a usage comment in
`tools/render-slides.js`; harden `.gitignore` to block every office/data format, vendor folders,
`buildtools/out/`, backups and local settings. **Consequence.** No runtime effect; `index.html` untouched.

## D-004 — Make `tools/engine-host.js` resolve the repo, not a personal path (14 Oct 2026)
**Decision.** `ROOT = path.join(__dirname, '..')`, as the handover (§3 step 3) prescribes. Required for
any Node tooling to run.

## D-005 — Line endings are never converted (14 Oct 2026)
**Decision.** `.gitattributes` `* -text` and global `core.autocrlf=false` (PortableGit ships `true`).
**Why.** A CRLF conversion silently changes `index.html` and its MD5.

## D-006 — Portable toolchain in `C:\dev\tools` (14 Oct 2026, approved by the owner)
**Context.** The laptop had no Node, Git, GitHub CLI or winget. **Decision.** Official builds, checksums
verified: Node.js 24.21.0 (zip, nodejs.org), PortableGit 2.56.0.2 (git-for-windows), GitHub CLI
2.102.0; added to the user PATH. No admin rights needed. **Consequence.** New terminals find the tools;
an already-running Claude Code app needs a restart (or the per-command PATH prefix in `CLAUDE.md`).

## D-007 — Publish only `index.html` to GitHub Pages, from a workflow (14 Oct 2026, owner chose Pages)
**Context.** The owner chose to keep a Pages link. "Deploy from branch" publishes the whole repo root,
which now includes internal docs, tools and agent definitions. **Decision.** `.github/workflows/pages.yml`
stages only `index.html` and deploys it after the invariants and smoke test pass; Pages source =
"GitHub Actions". **Alternatives.** Deploy from branch (exposes docs); a separate `gh-pages` branch
(manual, error-prone); no Pages (SharePoint/Teams distribution). **Consequences.** The Pages site serves the dashboard only, never the docs as web pages; the
repository itself is public (D-008). Should the repository become private later, Pages then needs a
paid plan. Supersedes handover §3 step 7.

## D-008 — Repository ownership, visibility and commit identity (14 Oct 2026, owner decisions)
**Context.** The owner first chose a private repository in a Centricity GitHub organisation, then
created a dedicated Products-team GitHub account (`productsteamcentricity`, free plan). On the free
plan GitHub Pages cannot publish from a private repository.
**Decision.** **Public** repository `productsteamcentricity/portfolio-review-dashboard` with free Pages
(the owner was told that everything in a public repo — docs, tools, agents and the embedded licensed
vendor data — is visible to anyone). Commits are authored as "Products Team Centricity" with the
account's GitHub noreply address `342556594+productsteamcentricity@users.noreply.github.com`, so no
real mailbox appears in the public history. The repository sets `user.useConfigOnly=true`: git refuses
to commit rather than invent an author email from the Windows sign-in.
**Alternatives.** Private repo with GitHub Pro (paid) or in an organisation on GitHub Team (paid);
private repo without Pages (share `index.html` via SharePoint/Teams). Supersedes the earlier
private-organisation choice and handover §12's recommendation.
**Consequences.** `index.html` and its embedded data were already public through the previous owner's
repository and site, so that exposure is unchanged; the docs, tools and handover documents are newly
public. Nothing confidential may ever be committed (client data, credentials, internal-only material).
Moving to a private repository later is possible but cannot recall copies already made.

## D-009 — Development tooling added alongside the baseline (14 Oct 2026)
**Decision.** Add `tools/check-invariants.js`, `tools/smoke-review.js`, `tools/make-sample-base.js`,
`tools/extract-blocks.js` and a recreated `serve-dashboard.js` (+ `.claude/launch.json`). They read
`index.html`; none changes it. **Why.** The handover's checks were manual and its reference tests
(`refresh_scripts/`) were not transferred; every future change needs a fast, repeatable gate.

## D-010 — The code is the source of truth for implemented behaviour (14 Oct 2026)
**Decision.** Where the handover and the code disagree about what the dashboard *does*, the docs
describe the code and record the conflict (e.g. base-file XIRR units, KI-005). Whether the code or the
handover reflects the *intended* behaviour is a product decision for the owner.

## D-011 — Baseline defects are documented, not fixed (14 Oct 2026)
**Decision.** Stage A changed no product code. Defects found during replication are in
`KNOWN_ISSUES.md` with verification status; fixes are proposed in `PROJECT_STATE.md` for the owner to
approve one at a time.

## D-012 — Continuous integration (14 Oct 2026)
**Decision.** `.github/workflows/ci.yml` runs the invariants and the smoke test (blocking) and the stale
AI Analyst test (non-blocking, KI-010) on pushes to `main` and on every pull request (feature branches
are checked through their PR, so CI does not run twice), with `TZ=Asia/Kolkata` so date handling
matches the analysts' machines. Replace the stale test, then make it blocking. The Pages workflow is
split into a read-only build job and a deploy job that alone holds `pages: write` / `id-token: write`.

## D-013 — Git history replaces `.pre_<tag>` backups (14 Oct 2026)
**Decision.** Before a change, commit or branch; the commit is the backup. `.pre_*` files stay
git-ignored in case the refresh pipeline writes them. Supersedes handover §10 rule 6.

## D-014 — Project subagents (14 Oct 2026)
**Decision.** Five agents in `.claude/agents/`: `dashboard-archaeologist`, `financial-domain-reviewer`,
`implementation-engineer`, `qa-engineer`, `security-release-reviewer`. The lead session acts as
principal architect, documentation owner and release maintainer (it runs the git operations). Add a
`refresh-operator` agent when `buildtools/` arrives. Agent findings are evidence to verify, not
conclusions.

## D-015 — What a new base file clears (15 Oct 2026, KI-001 fix, owner-approved change)
**Decision.** A base file loaded over an already-loaded one, or the removal (×) of the loaded file,
clears everything that belongs to a family: the client upload slots (IRR transactions; PMS / AIF
analytics; bonds / debt analytics) and the look-through, rebalancing, overlap, slide-picker, CVS,
taxation and AI-analyst state. Market-data uploads (MF / Direct / SIF monitors, Market Update slides)
are kept. The first base file of a session clears nothing, so uploads made before it are kept.
**Alternatives.** Reload the page on every new base file (loses market-data uploads, worse UX); keep
client uploads when the new file has the same clients (convenient, but a wrong match would leak).
**Consequences.** Re-loading a corrected file for the same family clears its uploads and plan; the
status line names what was cleared. The PMS/AIF and bonds slots are cleared whole, because they do not
record whether an upload was client data or market data.

## D-016 — Every change to index.html is a committed patch script (15 Oct 2026)
**Decision.** `tools/patch-lib.js` applies anchored, exactly-once, idempotent replacements and refuses
to write a file that breaks the invariants (script count, tail, LF, no BOM, NUL bytes). Each change is
a script in `tools/patches/` committed with it, so the history shows exactly what changed and the
change can be re-applied. Supersedes the handover's template scripts (`buildtools/patch_*.js`).

## D-017 — Standing instruction: keep GitHub up to date (15 Oct 2026, owner)
**Context.** The owner asked that everything be pushed to GitHub, organised, with the data for every
requested change. **Decision.** Work is pushed on a branch and merged into `main` by pull request as soon as
it is verified (CI green, checks in TESTING.md done), without asking again each time. Each owner request has
a record in `docs/change-requests/`, each monthly refresh in `docs/refresh-log/`. **Unchanged:** product
behaviour changes and data refreshes still happen only when the owner asks for them, and the owner reviews
a refresh before it is merged (MONTHLY_REFRESH.md). Supersedes the "merge only on the owner's go-ahead"
wording of CLAUDE.md rule 8 for verified work the owner requested.

## D-018 — Project folder layout in OneDrive (15 Oct 2026)
**Decision.** The OneDrive folder `Claude Code-Portfolio Review Dashboard` holds only non-code material:
`01 Monthly Updates` (the owner's inbox, one `YYYY-MM` folder per data month), `02 Archive` (processed
vendor data by data month), `03 Handover` (everything received from the previous owner, as received) and
`99 Superseded - safe to delete`. Code stays in `C:\dev\portfolio-review`; the unpacked export is in
`C:\dev\handover-export`. **Why short names:** the folder's own path is 128 characters; Windows skips files
past 260 characters (21 vendor files were silently lost that way on 14 Oct) and Excel cannot open paths past
218 characters. **Consequence.** Month folders are `YYYY-MM` only; vendor file names are never changed.

## D-019 — What from the previous owner's export may be published (15 Oct 2026)
**Decision.** The public repository receives only material that is free of client data and useful for
maintenance: the refresh pipeline (`buildtools/`), current tools, and reviewed documents under
`docs/previous-owner/`. Everything else (vendor data, Cowork and scratchpad outputs, session notes, the web
app, backups) stays private, off GitHub. Every imported file is scanned for client names, personal data and
credentials before it is committed. Published docs never say which private files hold client data, or where
such files are kept.

## D-020 — Audits, and how pull requests are merged (19 Oct 2026)
**Context.** The first full audit produced a register of 67 issues, with reproduction scripts. GitHub's web merge
(and its merge API with the no-reply address) records the account's own e-mail as the merge author (KI-098).
**Decision.**
- **Audit records.** Each audit has a public register and decision sheet in `docs/audits/`, without local paths
  or personal data. Its private evidence (full register and reproduction scripts) goes in OneDrive
  `04 Audits\<date>`. Every issue gets a permanent KI number in `KNOWN_ISSUES.md`.
- **Merges.** Pull requests are merged locally (`git merge --no-ff`, message "Merge pull request #N …") with the
  repository's no-reply identity, and pushed. GitHub then marks the PR merged. This happens after CI is green,
  as under D-017. This laptop's global git identity is also the no-reply address.

## D-021 — The owner's answers to the audit decisions (19 Oct 2026)
**Context.** The audit of 19 Oct 2026 put 28 questions to the owner (OD-1 to OD-28 in
`audits/2026-10-19-decisions.md`), each with a recommendation.
**Decision.** The owner accepted every recommendation except OD-11. For OD-11 the in-browser MF Monitor and
Direct Monitor uploads **stay**, so that the analyst can load the latest monitor. They are to be made correct:
one parsing path shared with the monthly refresh, expense ratios read as percent, wrong-slot files rejected, and
the data date in use shown with a way back to the embedded data.
**Consequence.** The register's group (b) fixes are unblocked and are scheduled with the "fix now" batches.
KI-026, KI-058 (NEW-12) and KI-076 (NEW-30) become fixes of the upload path instead of its removal.

## D-022 — The owner's answers to the batch-1b questions (21 Oct 2026)
**Context.** The financial reviews of fix batch 1b raised eight questions (OD-29 to OD-36 in
`audits/2026-10-19-decisions.md`); each fix shipped with the recommended behaviour.
**Decision.** The owner accepted all eight:
- OD-29: no return assumed for the Current vs Sample "Unallocated" share until the analyst enters one;
- OD-30: gross equity for hedged hybrids; the multi-asset remainder as Debt MF; a Hybrid SIF Unallocated;
- OD-31: "Apply plan" cuts every plan and client of a scheme pro rata;
- OD-32: the fund-house alias list as built, plus the renamed houses;
- OD-33: a PMS, AIF, SIF or listed stock of a group sits outside that fund house's 20% cap;
- OD-34: blank AMC rows show as "AMC not given";
- OD-35: rationale text in the file's unit (with OD-19);
- OD-36: a redeemed fund whose label matches no current row counts in the Grand Total only, footnoted.
**Consequence.** OD-32 and OD-34 are built in the next fix batch; OD-35 with OD-19. The rest is already in
production (PR #6).

## D-023 — Publishing vendor files, and how portfolio returns are calculated (22 Oct 2026)
**Context.** The new-build brief (CR-0006) asks for the monthly source files, including the MF and SIF Monitors,
to be tracked in the public repository; earlier records treated the vendor data as licensed and kept it out of git
(the open question under D-008). The brief also needs portfolio-level 3Y and 5Y returns, a drawdown comparison and
returns for direct equity.
**Decision (owner, 22 Oct 2026):**
1. **Publication.** The vendor licence allows publishing the monitor files, and (owner, 22 Oct 2026) every other
   Accord Fintech file too: analytics, expense ratio, listed equity and the rest. Approved monthly source files will be
   tracked in `monthly_updates/YYYY-MM/` once that folder is set up (CR-0006, Phase 1). The vendor-derived data
   embedded in `index.html` is permitted, which closes the D-008 question. Client data is never published.
   - **Recommended:** the MF Screener data pack stays private unless the Screener owner agrees. The Screener is
     invitation-only and carries Centricity's own scores.
   - **Recommended:** files above 50 MB (GitHub warns at 50 MB and refuses 100 MB), such as the Investment Reckoner
     PPTX, are tracked as PDF, with the original kept in OneDrive and its SHA-256 recorded.
2. **Drawdown comparison** is done on index data, not on the client portfolio's history. The owner supplies index
   return data every month.
3. **Portfolio 3Y and 5Y returns (mutual funds)** are the average of each fund's 3Y and 5Y return, weighted by its
   share of the portfolio.
   - **Source:** the MF Monitor the analyst uploads for the review if there is one, otherwise the latest monthly
     data: the MF Monitor, or the MF Screener data pack.
   - **Missing returns:** following CLAUDE.md rule 3 and KI-006, a fund without a 3Y or 5Y return (for example, too
     young) is left out of the weights and the coverage is footnoted. It is never counted as 0%.
   - **Label:** "weighted average return of current holdings", not the portfolio's realised return.
4. **Direct equity returns** follow the owner's Stock Price to Return Calculator:
   - **Stock return:** 1Y, 3Y and 5Y CAGR = (price on the as-on date ÷ price n years earlier)^(1/n) − 1;
   - **Portfolio:** each stock's return weighted by its share of the direct-equity holdings.
   - **Differences from the workbook,** because the dashboard is offline and must not invent numbers:
     - prices come from the monthly data (the Screener data pack's split- and bonus-adjusted month-end prices)
       instead of Excel's online stock feed;
     - the start dates are the exact anniversaries of the review's as-on date (or the nearest earlier trading day);
     - a stock without enough history is left out and footnoted, never counted as 0%.
   - **Fallback** for stocks the data does not cover: the analyst can upload a price file (for example the
     calculator's Fetch Price sheet).
**Consequence.** CLAUDE.md, MONTHLY_REFRESH and DEPLOYMENT now point here. The Screener data pack prompt asks for
month-end stock price history.
**Addendum (owner, 22 Oct 2026).** The index data of point 2 is the five Index TRI files (Nifty 50, Nifty 100,
Nifty 500, Nifty Midcap 150, Nifty Smallcap 250) that the owner already puts in each month's `Index TRI` folder.

## D-024 — The new app is previewed publicly at `/next/` (22 Oct 2026, lead under D-033; ND-3, ND-9)
**Context.** CR-0006 builds the new app beside `index.html`; D-007 publishes `index.html` only (Q-10, Q-85).
**Decision.** Pages publishes `index.html` at `/` (the legacy page, the review link until parity) and
`next/index.html` at `/next/` (the new app) with a visible "Preview, not for client use" banner. Docs are still never
served. Nothing exported from `/next/` is used for a client before switch-over: every preview export carries
"Preview build, not for client use". The legacy page links to the preview from M5 at the earliest. At switch-over
(M15) the new app moves to `/` and the legacy page to `/legacy/`. Supersedes D-007 in part.
**Consequence.** `pages.yml` stages both files from milestone M1.2.

## D-025 — npm for the new app's build tooling (22 Oct 2026, lead under D-033; ND-2)
**Decision.** The new app uses npm for pinned, development-time build tooling (esbuild 0.28.2; TypeScript 7.0.2, or
6.0.3 as a fallback) plus Preact 10.29.x, bundled into the page: exact versions, a committed lockfile,
`ignore-scripts=true`, `npm ci` only. Nothing is downloaded when the page runs; it stays one offline HTML file. The
"no npm install" rule in `CLAUDE.md` describes the legacy `index.html`. The stack is architecture A1 to A3
(`new-build/03-architecture.md`). **Fallback** if npm or esbuild cannot run on the maintainer's laptop: the same
layout with a hand-written bundler.

## D-026 — Data classes, and the MF Screener data pack stays out of public pages (22 Oct 2026; the Screener rule by the owner, ND-1; the class policy by the lead, implementing D-023)
**Context.** D-023 point 1 lets the approved monthly source files be published. The MF Screener is invitation-only
and carries Centricity's own scores (Q-06).
**Decision.**
1. **Classes.** Every source file has a class: P publishable (every Accord Fintech file: the owner confirmed on
   22 Oct 2026 that the licence covers all Accord files, not only the monitors; the other approved monthly source
   files of D-023; and Centricity material without client data); C private until approved (a source that is neither
   Accord nor Centricity material, until its licence is confirmed); N never (client data, personal data,
   credentials, the MF Screener data pack). From M11 class P files are tracked in `monthly_updates/YYYY-MM/`, a file above 50 MB as PDF with the
   original's SHA-256 recorded; the policy file is `monthly_updates/_policy/publication-classes.json`.
2. **Screener scores and ranks are never in a public page (owner).** The MF Screener data pack is never embedded in
   any public build and never committed. The owner uploads it every Screener cycle: the new app has an "MF Screener
   data pack" upload slot in section 1; the pack is read and validated in the browser and kept in that browser's
   IndexedDB until a newer pack is loaded; its cycle date shows in the sidebar; every screen, slide and sheet that
   needs it says so when no pack is loaded. The monthly update may validate the pack and publish only its
   fingerprint, contract version, cycle and counts.
**Consequences.** Design in `new-build/03-architecture.md` §6.9. The legacy `FUND_RANKS` block (fund ranks issued
15 Aug 2026) is an open item in `PROJECT_STATE.md`.

## D-027 — The MF Screener link (the owner's brief, 21 Oct 2026; recorded 22 Oct 2026)
**Decision.** The new app has an "MF Screener" navigation item that opens the Screener in a new tab: one allow-listed
URL in `config/links.json`, an anchor with `target="_blank" rel="noopener noreferrer"`, no query string, no prefetch,
no availability check. It is the one documented exception to `CLAUDE.md` rule 2, in the new app only (the Screener
blocks embedding; no credential is used or stored). The build check allows that URL in that form and nowhere else
(Q-11).

## D-028 — What the live page receives during the parallel run (22 Oct 2026, lead under D-033; ND-4)
**Decision.** While `index.html` is the review link it keeps receiving calculation, data and security fixes, because
analysts and clients see those numbers now. Presentation-only improvements (layout, styling, slide order, wording) go
to the new build only. Legacy batch 2a (D-022) proceeds; the CR-0005 batches continue without their presentation-only
items. Every legacy fix is ported to the new app with the same known answer.

## D-029 — Missing values show a dash; sentences never use one (22 Oct 2026, owner; ND-5)
**Context.** The brief bans dashes in presentation writing; OD-13 and OD-29 show "—" for a value that is not there.
Phase 0 proposed "n.a." instead (Q-42); the owner declined.
**Decision.** In the new app, as in the legacy page, a missing value is shown as a dash, "—", alone in its cell or
tile, with a footnote naming its status (for example "not available in supplied data", "not applicable"). The no-dash
rule applies to sentences only: presentation prose (titles, observations, footnotes, labels, chart series names) never
uses an en or em dash. In the workbook a missing number is a blank cell with its status in the next column, so
formulas keep working. The other conventions of Q-42 stand as recommended (lead): dates "D Mon YYYY", Indian digit
grouping for rupee amounts and units, negatives with a hyphen-minus in red `#931621`.

## D-030 — Observation thresholds approved; a fund pair overlaps from 35% (22 Oct 2026, owner; ND-6)
**Decision.** The threshold table in `new-build/observation-rule-bank.md` §3 is approved with one change: a fund pair
counts as overlapping (high) from 35%, not the proposed 30% and not the legacy 40%; very high stays at 50%. The other
proposed changes stand: the open-ended strength moves from 65% to 95% (L-S3, L-C8) and the debt high-quality phrase
from 50% to 70% (L-C3). The table's first version records this approval; each later change is a versioned edit with
its own approval.
**Consequence.** The parity ledger records the legacy rows L-W2 and L-O3 as a threshold change from 40% to 35%.

## D-031 — Table borders and the Actionables column (22 Oct 2026, lead under D-033; ND-7)
**Decision.** One table border for the whole deck: 0.5 pt `#D9D9D9` (the holdings sheets' "slide 25" item). The
rebalancing slide's Actionables cells (the "slide 6" item) are tan `#DBC8B2` with black bold text showing the action
word (Exit, Retain, Partial, New Addition, Top-Up); the rationale keeps its own column.

## D-032 — Capital-gains statements come in our own template (22 Oct 2026, owner; ND-8)
**Context.** The brief asks for a capital-gains upload; client files cannot be used to learn issuers' layouts (Q-78).
**Decision.** Analysts upload capital-gains statements in a template the new app defines, as they do with the
base-file template. The owner's sample format may inform it but is not required. One row per realised lot, money in
rupees, dates as Excel dates; the app offers the blank template for download, reads it by header name and refuses a
file that is not in it, naming the missing columns. The proposed columns (`DATA_DICTIONARY.md` §5.17) are fixed in
M7.
**Consequence.** No per-issuer parsers. The statement stays the source of record for a financial year's realised
gains; without one they are labelled "derived from transactions".

## D-033 — Claude takes charge of GitHub and the dashboard; no branch ruleset (22 Oct 2026, owner; ND-10)
**Context.** ND-10 proposed a ruleset on `main` (Q-86). The owner declined it and gave Claude full charge of GitHub
and the dashboard. Extends D-017.
**Decision.** Claude (the lead session) runs the repository and the dashboard: branches, pull requests, merges,
repository settings, releases, and the technical and process questions the owner leaves open. Each such decision is
recorded here as "lead, under D-033". No ruleset protects `main`; `CLAUDE.md` rule 8 still applies (no force-push, no
history rewrite, no branch deletion, merge only with green CI), and acceptance case AC-22 detects a force-push after
the fact. Unchanged unless the owner says otherwise: the owner's own answers prevail, and a data refresh is merged
after the owner's "publish" (D-017).
**First lead decisions (22 Oct 2026).** D-024, D-025, D-028, D-031 and the Q-42 conventions in D-029; `index.html`
stays exempt from the private deny-list only (its embedded public vendor data names listed companies and fund
managers; every other scan rule applies to it); the redactions of local user and organisation names in the previous
owner's published documents stand; the push size limit stays 50 MB.

## D-034 — New-app toolchain and preview publishing (23 Oct 2026, lead under D-033)
**Context.** Milestone M1.2 built the new app's toolchain, its one-file build and the `/next/` preview (D-024, D-025;
`new-build/toolchain.md`, whose section 8 lists where the build departs from the Phase 0 design). M1.2's Pages
workflow stopped the whole deployment when the new app failed to install, build or pass its check ("fix forward"), so
a broken preview would also have held back a legacy fix.
**Decision.**
1. **Toolchain.** esbuild 0.28.2 bundles. TypeScript 7.0.2 type-checks only (`noEmit`, `erasableSyntaxOnly`: the
   sources use erasable syntax only, with no `enum`, namespace or parameter property); the 6.0.3 fallback of D-025
   was not needed. Preact 10.29.8 is the UI library, bundled into the page. All three are `devDependencies` pinned to
   exact versions with a committed `package-lock.json`; `.npmrc` sets `ignore-scripts=true` and `save-exact=true`,
   and `fund=false` and `audit=false`, so an install runs no package script and makes no audit or funding call.
   Installs use `npm ci` only.
2. **One offline file.** `scripts/build.mjs` writes `app/dist/index.html` (git-ignored; Pages stages it as
   `next/index.html`). Its CSP meta tag, the first element of `<head>`, allows the inline scripts and the style
   element by SHA-256 only and sets `connect-src 'none'`. The build is deterministic: the same sources give the same
   bytes (`check-next.mjs --rebuild`). A vendored library is inlined only when a module imports it as `vendor:<name>`,
   and only after its SHA-256 matches `app/vendor/MANIFEST.json`.
3. **Static navigation.** The build writes the nine section links and the single MF Screener link (D-027) as static
   HTML, so the page reads without scripts and the one remote URL is checked in its exact form.
4. **The preview never blocks the legacy page.** In `pages.yml` the legacy gates (invariants, smoke, regression)
   stay blocking. `npm ci`, the build and `check-next.mjs --rebuild` may fail without failing the job, each running
   only after the one before it succeeded. The build is published at `/next/` only when all three passed; otherwise
   `/next/` gets a short static notice (the banner "Preview, not for client use.", "The preview could not be built for
   this commit", no script, no remote URL), the log gets a warning, and the legacy page deploys as usual. This
   replaces M1.2's "fix forward" note.
**Alternatives.** Keeping a failing preview blocking (rejected: a preview without users must not delay a legacy fix);
a second Pages workflow for `/next/` (rejected: each Pages deployment replaces the whole site, so two workflows would
remove each other's page).
**Consequences.** CI (`ci.yml`, job `next`) still fails on any of these steps, so a pull request that breaks the
preview is not merged (D-017); the Pages fallback covers what reaches `main` anyway. `DEPLOYMENT.md` describes the
notice, `CLAUDE.md` lists the new app's working rules, and the differences from the Phase 0 design in `toolchain.md`
section 8 are confirmed.

## D-035 — Reference data in the repository and base-file reading conventions (23 Oct 2026, lead under D-033)
**Context.** Milestone M1.3 built the new application's shared model, its base-file reader with a parity ledger
against the legacy `parseBaseRows` (`tests/parity/base-file-ledger.json`), and `data/refdata/`, the reference data
the legacy page embeds, as one JSON file per block (`scripts/data-extract.ts`). Its financial review and re-review
(23 Oct 2026) left the lead to decide whether generated data lives in the public repository and under which scan
rules, the class of each block, and which of the reader's differences from the legacy are accepted.
**Decision.**
1. **Extracted, never edited.** `data/refdata/*.json` is written deterministically from the blocks of `index.html`
   by `scripts/data-extract.ts` (keys sorted, one top-level entry per line, LF) and checked equal to them: CI runs
   `node scripts/data-extract.ts --check`, and `tests/parity/refdata.parity.test.ts` proves each file deep-equal to
   the block the legacy page runs on. `VINTAGE.json` records the data month, the legacy `DATA_DATES` and, per file,
   the record count, SHA-256, source, class and as-on date (null with a status when the page records none).
2. **Fund ranks: scheme codes only.** `FUND_RANKS` is reduced to `FUND_RANKS_CODES.json`, fund name to AMFI scheme
   code, with no score, rank, status or metadata; `FUND_RANKS_META` is not extracted (D-026).
3. **Deny-list exemption.** The generated block files are exempt from the private deny-list scan for the reason
   `index.html` is (D-033): their public vendor data names listed companies and fund managers. Each is exempt by
   its exact path in `scripts/validation/privacy-allowlist.json`; a test pins the exempt paths under
   `data/refdata/` to the extractor's block files; every generic rule still applies to them; `data/refdata/README.md`
   and `VINTAGE.json` are scanned with the deny-list.
4. **Classes.** The `MF_RISK`, `PMS_PERF` and `AIF_PERF` blocks are publishable, class P as data in
   `data/refdata/`: derived data that D-023 permits and that `index.html` already publishes. Their source files keep
   the class that `06-data-source-inventory.md` and `publication-classes.json` give them (DS-H2, DS-P1 and DS-P2,
   class C until approved; the producer of DS-P1 is still to be named, Q-24), which is why `VINTAGE.json` records
   each block as a derived block of a class C source that is published.
5. **`MF_BENCHMARKS`** has no known source (no tool produces it; `02-capability-inventory.md` E-93, KI-026): class
   C until its source is confirmed (D-026). It stays in `data/refdata/` because `index.html` already publishes the
   same five rows; E-93 replaces it in M7.
6. **The base-file parity ledger.** The corrections BF-01 to BF-25 except BF-19 are accepted: BF-18 (merged units
   left missing when a folio has none, the gap named in `Holding.mergeGaps`) as an extension of KI-113 to units,
   with the M7 requirement of `DATA_DICTIONARY.md` §8 (a unit-priced holding with a merge gap in units is never
   reconciled by amount). BF-19 (an unrecognised Asset Name such as "Gold" becomes unknown with a notice, beyond
   OD-7) waits for the owner's confirmation, and so does BF-26, which the re-review added (letter case of Asset
   Names folded).
**Alternatives.** Reading the blocks out of `index.html` at build time (rejected: no reviewable data diff, and the
new application would depend on the legacy file until M11); committing `FUND_RANKS` whole (rejected: D-026);
applying the deny-list to the generated files with every public namesake allow-listed (rejected: thousands of
vendor names, and an allow-list that long would hide a real hit).
**Consequences.** `safety-tooling.md` and `data/refdata/README.md` record the exemption as confirmed. A data
refresh that changes `index.html` regenerates `data/refdata/` in the same change (`MONTHLY_REFRESH.md` Step 8),
or CI fails. The legacy reading defects the parity work found are KI-140 to KI-145, with their IPS consequence
KI-146: live-page data fixes for a later legacy batch (D-028). The new reader's money-column fallback is KI-147,
decided in M1.4. The owner's questions are in `DATA_DICTIONARY.md` §8.
