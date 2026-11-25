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

## D-036 — The capital-gains upload accepts the platform's export as it is (23 Oct 2026, lead under D-033; amends D-032)
**Context.** D-032 (the owner's answer to ND-8) asked for capital-gains statements in a template the app defines, and
allowed "the format of your choice". On 22 Oct 2026 the owner supplied a real statement: the "Capital Gain Report"
export of the wealth platform that also produces the base file. Profiled locally (counts and checks only, nothing
committed), it is one sheet with 29 named columns, one row per purchase lot consumed by a sale, a totals row and a
text block at its foot. It carries the investor's PAN inside the account name and the folio inside the instrument
name, marks grandfathered, indexed and merger lots through its acquisition columns, covers the client's whole
realised history, repeats some lots exactly (its own totals include the repeats) and leaves its tax columns empty.
**Decision.**
1. **The export is the format.** The capital-gains slot accepts that export as produced: columns found by header name
   (any order, aliases, extra columns ignored and listed), the totals row used to reconcile and the footer text never
   kept. The app's blank template has the same headers (and a Read Me) for statements from other sources; one reader
   serves both. A file without the required columns is still refused with them named (D-032 unchanged on that point;
   no per-issuer parsers).
2. **The PAN never enters the app.** It is removed from every text cell at read time, before any copy is kept;
   only the count of removals is recorded.
3. **The app computes indicative tax itself**, per lot, per person and per financial year (1 April to 31 March,
   from the sale date), from a dated tax-rule table that the financial-domain reviewer approves before any M7 code
   (given on 27 Oct 2026), with the analyst entering the slab rate, the surcharge rate and the regime per person and year (none has a
   default; totals are shown "before surcharge" until the surcharge rate is entered). Lot classes (merger,
   grandfathered, indexed cost shown, standard) come from the statement's acquisition columns, and the rule's cost
   basis governs; the tax class from the scheme for the year of sale (OD-17; its amendment by the dated table is an
   owner item of the design), not from the statement's Equity or Debt label alone; the term from OD-2 (strictly after
   the anniversary). Every figure assumes a resident individual.
4. **Repeated rows are never dropped silently:** the analyst answers per sale event (one folio, scheme and sale date),
   with "apply to all" as a shortcut, whether to count them as stated or once; until then the affected years' totals
   are INSUFFICIENT EVIDENCE.
The design is [new-build/capital-gains-upload.md](new-build/capital-gains-upload.md); the columns go into
`DATA_DICTIONARY.md` §5.17 and the parity matrix gains rows E-150 to E-156, U-71 and U-72.
**Alternatives.** Our own column set, with analysts retyping the export into it (rejected: slow, error-prone, and the
export already has every field the tax view needs); a parser per registrar (rejected by D-032); trusting the
statement's Equity or Debt label for tax (rejected: international fund of funds are labelled Equity but taxed as
non-equity, and hybrids follow OD-17); dropping exact repeats (rejected: the statement is the source of record and
its totals include them).
**Consequences.** M7 builds `ingest/capital-gains.ts`, the tax engine and the template download from that design; the
tax-rule table and the design were approved by the financial-domain reviewer on 27 Oct 2026, as the design's change log records. The design was revised on 27 Oct 2026 after a financial, a completeness and a security
review, again the same day after the financial and completeness re-reviews, a third time after their approval
reviews and a fourth time after the second approval reviews (its §10.11). The owner is asked to raise the repeated rows with the platform's support, and to answer the
design's other owner items (its §15).
## D-037 — Section tabs across the top, in the look of the owner's design reference (24 Oct 2026, owner)
**Context.** M1.2 built the new app's shell with the nine sections listed in a navigation column beside the section
(17rem wide). Phase 0 had read the brief's design reference, a Claude Artifact upload console, as a workflow reference
with no layout to follow (`ARCHITECTURE.md` §13.1, Q-84). On 24 Oct 2026 the owner asked for the section tabs across
the top, as that console shows them, so that analysts have more width to work in, and for the app to be built on
that layout from now on.
**Decision.**
1. **Layout.** The header holds, in order: the preview banner (D-024, still first and still in view on a wide
   screen), the black masthead with the 4 px gold rule, and the nine section tabs in one row across the top. The
   section below uses the full page width (up to 90rem). The tab row never wraps: where the nine tabs do not fit it
   scrolls sideways, so the header keeps one height (one row from 1280 px). The app measures the pinned header and
   keeps a focused heading, and the target of the skip link, just below it. On a narrow screen (52rem or less)
   nothing is pinned (the 375 px item carried from M1.2's QA: a sticky header covered a focused heading).
   Amended by D-039 point 15 (27 Oct 2026, M1.4; worded in its second fix round): a section opened from its tab
   places its review bar, not its heading, just below the pinned header (the browser checks pin the measured gap at 8
   to 20 px), with the focused heading under the bar.
2. **The MF Screener link** (D-027) is a navigation item at the right end of the masthead, in its own `<nav>`, so
   the tab row is the sections only. It is still the one remote URL, in one static anchor.
3. **The reference's look** for the screen from now on: Cambria; tabs on a sand ground with the current tab black
   with white text; black table headers in small uppercase letters with zebra rows; bordered groups with a sand header;
   dashed upload slots; status chips; a black footer bar. Colours come from `app/src/config/tokens.json` only.
4. **The Screener pack's cycle date and status** (D-026) show in the masthead beside the Screener link, since there is
   no sidebar.
**Alternatives.** Keeping the column (rejected by the owner: it takes width from every section); the Screener link at
the end of the tab row (tried: at 1440 px it pushed the row onto two lines).
**Consequences.** `shell.css`, the page template and `scripts/build.mjs` (`navHtml` for the tabs, `screenerHtml` for
the link) change; the shell tests now expect the link in the masthead; `ARCHITECTURE.md` §6.9 and §7, `DATA_DICTIONARY.md`
§5.16, the PRD and `toolchain.md` say masthead where they said sidebar or column. Every later milestone builds its
screens in this layout.

## D-038 — Vendored libraries, the workbook zip and downloads under the CSP (27 Oct 2026, lead under D-033)
**Context.** Milestone M1.4 (the portfolio overview: section 1 uploads, section 2 overview, slide C-08 and the overview
workbook) is the first to run the four libraries of the legacy page in the new app. As they stand, SheetJS holds
`<!--` and PptxGenJS holds `<script`, which the build's inline rule refused; both carry dozens of URLs, and PptxGenJS
also holds `XMLHttpRequest` and `importScripts`, which `check-next.mjs` refused. Architecture A2 requires byte-for-byte
copies, so the libraries cannot be edited to pass. The workbook writer must write the Office Open XML namespace names,
which the source scan refused as remote URLs. PptxGenJS's and SheetJS's `writeFile` set a style attribute on their
anchor, which `style-src` refuses.
**Decision.**
1. **Extracted, pinned, checked.** `scripts/vendor-extract.mjs` copies Chart.js 4.4.0 (SHA-256 `321e3a3f...`),
   chartjs-plugin-datalabels 2.2.0 (`20c08f3d...`), SheetJS CE 0.18.5 (`c9506197...`) and PptxGenJS 3.12.0
   (`cd078ca9...`) byte for byte from the blocks of `index.html` into `app/vendor/`, with their licence texts in
   `app/vendor/licences/`. Each `MANIFEST.json` entry cites the index.html MD5 it came from. JSZip ships inside
   PptxGenJS and is imported as `vendor:jszip`, an alias of that entry. The built-in logos are extracted the same way
   into `app/src/config/brand-logos.json`. `node scripts/vendor-extract.mjs --check` recomputes the files, hashes,
   allowances and logos from `index.html` and fails on any difference; CI runs it.
2. **The inline rule for vendored files only.** A vendored file is refused for `</script`, and for `<!--` only when
   `<script` follows it later in the same text (the pair that breaks HTML parsing). The app script keeps the strict
   rule: no `<!--` and no `<script` at all.
3. **Pinned allowances.** Each manifest entry has an `allow` block: the inline sequences, the network-API names with
   exact counts (PptxGenJS: `XMLHttpRequest` 1, `importScripts` 1), the scheme URLs (Chart.js 2, datalabels 1;
   SheetJS and PptxGenJS 72 and 56 distinct URLs, 82 and 138 occurrences), each pinned with its count, and the URLs
   of its licence text. `check-next.mjs` identifies each
   executable script by its SHA-256 and applies a block only inside the script whose hash is that library's. A
   library must equal its file in `app/vendor/` and hold exactly what its block pins. The app script must be the only
   other script, and it comes last; no network API is allowed in it. `connect-src 'none'` stays the run-time guard.
4. **OOXML namespace names.** The seven names the workbook writer writes are allowed only as quoted strings in the app
   script, and in the sources only in `app/src/exports/ooxml/namespaces.ts`.
5. **Pure layers.** The model, ingest, engine, views and exports read no browser global: no `window.`, `document.`,
   `globalThis.`, `localStorage.`, `sessionStorage.` or `indexedDB.` there (U-53). The source scan also matches these
   words in comments. The exporters take the libraries as arguments; only `app/src/ui/wiring.ts` imports SheetJS and
   PptxGenJS, and only `app/src/ui/chart-lib.ts` imports Chart.js.
6. **The workbook zip.** The overview workbook is zipped by an in-house, synchronous, deterministic STORE writer with
   CRC-32 (`app/src/exports/zip/`), every entry dated 1980-01-01, so Node and the browser write the same bytes. This
   amends the wording of A3. JSZip, from the PptxGenJS bundle, is used only to post-process the deck.
7. **Downloads.** Every file is saved by `app/src/services/download.ts`: a Blob behind an object URL, an anchor
   created in code and hidden by its `hidden` property, clicked and removed. The object URL is revoked 30 seconds
   later, not at once, so that a browser still reading the Blob does not cancel the download. The libraries'
   `writeFile` helpers are never used; the deck is written with `write({ outputType: 'uint8array' })` and a logo is
   passed as a data URI.
8. **build-info** also carries `buildId` (16 hex digits of the SHA-256 over the executable scripts in page order, each
   followed by a NUL byte) and the SHA-256 of each library, so the deck and the workbook can name the exact build.
**Alternatives.** Editing the libraries to pass the rules (rejected: A2); loosening the page-wide rules (rejected: a
network API in the app script would pass unseen); JSZip for the workbook (rejected: it stamps the current time and
works asynchronously); ExcelJS 4.4.0 (Q-13, the fallback if Excel had repaired the in-house writer's output; not
needed, spike gate R1 passed in Excel on 27 Oct 2026).
**Consequences.** A library change is visible in review as a change of hash and pinned counts. The browser spike
(`tests/browser/next-spike.mjs`) proves the four libraries run under the CSP from disk and served, with no violation
or console message, and that both Blob downloads save the page's bytes with no request (Edge and Chrome). core-js
2.6.11 inside PptxGenJS replaces `Function.prototype.toString` page-wide; Promise and `Array.prototype.includes` stay
the browser's own (recorded for the security review, no action). `CLAUDE.md`, `toolchain.md` sections 5 and 8 and
`ARCHITECTURE.md` sections 3, 17 and 18 describe the rules.

## D-039 — The portfolio overview rules (27 Oct 2026, lead under D-033; point 1(a) the owner's answer of 24 Oct 2026)
**Context.** M1.4 builds the totals, the asset, product, liquidity, client and distributor allocations, slide C-08 and
the overview workbook from one view-model. The rules below settle what the brief and the earlier decisions leave
open; every difference from the legacy is a classified entry of `tests/parity/aggregation-ledger.json` (AG-01 to
AG-14, no regression; AG-01, AG-02, AG-05, AG-06 and AG-08 retired in the second fix round, the live page having
followed the new reader in D-041; the display rounding of point 13 is a classified difference outside the ledgers).
KI-147 (the reader's money columns) was left for M1.4 by D-035. The same day the browser QA
and the financial, Office and security reviews of the integrated branch found defects; the lead's fix round
(CR-0006) amends points 1, 2, 3, 5, 6, 7, 8, 9 and 12 and adds points 13 to 15. In that round the lead decided the
display rounding (point 13), the raw label as join key (point 3), the letter case of client and distributor labels
(point 3), the workbook's money format and share row (point 5), the pie label threshold (point 6), the file's own
gain or loss (point 1(e)) and the Read Me wording (point 7). The second fix round (the lead's decisions N1 to N19 of
27 Oct 2026, integrated on 2 Nov 2026 with the owner's rule for the Office acceptance of 2 Nov 2026) amends points
2, 3, 5, 6, 9, 12, 13, 14 and 15 and adds points 16 to 20: the total rows and merged folios of D-041 points 2 and 3
(KI-148), negative market values, joint-holder labels and the Office acceptance under the owner's rule.
**Decision.**
1. **Money columns (KI-147).** `MONEY_COLUMN_RULE` (`app/src/config/money-columns.ts`) is
   `{ invalidText: 'invalid-source', crossCheckToleranceCr: 0.005 }`. The reader takes the Crore column, then Lakh,
   then rupees, and acts on the column it would use:
   (a) **the owner's answer, 24 Oct 2026, "no fallback"**: text that is not an amount (a percent included) makes the
   amount INVALID SOURCE DATA. No later column is read in its place. A holding whose market value is invalid is
   excluded and listed (OD-8), with the Warning `base-file.money-invalid`, scoped to the holdings, naming the column
   and the rows. An invalid invested value leaves the holding included without one (counted in
   `totals.counts.invalidInvested`);
   (b) the lead's decision, confirmed by the owner on 2 Nov 2026 (PD-09): a blank Crore cell is not text, so the
   reader takes the Lakh, then the rupee column, with the Information notice `base-file.money-column-used` naming the
   column used and the column passed over;
   (c) the lead's decision, confirmed by the owner on 2 Nov 2026 (PD-09) for "NA", "N/A", "-" and "nil": a
   placeholder in the Crore cell counts as blank (then Lakh, then rupees), and `base-file.money-column-used` names the
   placeholder; any other text makes the value invalid. The reader's other placeholders ("n.a.", "n.a", "none", "not
   available", "--" and a lone en or em dash character) count the same way, as built: confirmed by the owner on
   9 Nov 2026 (PD-51);
   (d) the lead's decision: when the amount used and a later column's amount for the same field are both numbers and
   differ by more than 0.005 Cr (plus 1e-9), the Warning `base-file.money-disagree` names both columns, and the amount
   used is kept.
   The rule applies to invested value, market value and gain alike. There is no fallback mode and no
   `base-file.money-fallback`.
   (e) the lead's decision (fix round): for the file's own gain or loss, which no figure uses (OD-18), the results
   `base-file.money-invalid` and `base-file.money-disagree` are Information (auto-resolved, resolved), and their
   message ends "no figure uses the file's gain or loss (OD-18)". They are listed in the import report's validation
   panel and the Audit Log and never become a note. For the market and invested values they stay Warnings, so the
   two rule ids carry two severities.
   The notes of the overview count the holdings whose figure the rule changes (KI-147, point 9).
2. **Totals and gain.** Totals cover included holdings only. Invested is the sum over included holdings that have an
   invested value; gain is the CMV of those same holdings minus that invested (OD-18), never the file's gain/loss,
   which appears only in Holdings (as loaded); absolute return is gain / invested x 100 over the same holdings. Below
   full coverage these carry the share of CMV covered and show the "p" marker with a note. When no included holding
   has an invested value they are NOT AVAILABLE IN SUPPLIED DATA (INVALID SOURCE DATA when every one is invalid),
   never 0. The percent of CMV is NOT APPLICABLE when the total CMV is 0; absolute return when invested is 0;
   invested coverage on a line whose CMV is 0. Allocation lines follow the same rule line by line. Liquidity lines
   with a CMV of 0 or less are left out, as in the legacy pie. When the share of CMV covered is missing (a total CMV
   of 0) or outside 0 to 100 (negative values), the partial note counts holdings instead: "p: invested value, gain
   and absolute return cover the 4 of 6 holdings that have an invested value." ("that has" for one). A liquidity
   table with no line (every holding excluded) is replaced by the pies' kind of sentence with the liquidity pie's
   status: "No liquidity line to show: not available in supplied data." (second fix round, N12).
3. **One asset order.** Equity, Debt, Hybrid, Commodity, REITs/InvITs, Unknown, in the asset table, the pie and the
   client and distributor matrices; only classes present get a row. The unknown row is labelled "Unknown", comes last,
   is coloured #D9D9D9, and a note lists the labels read as unknown. Products within a class are ordered by CMV,
   highest first, ties in file order. Holdings without a client or distributor go to a column labelled "Client not
   given" or "Distributor not given". Groups keyed by names are held in Maps, so a label such as "constructor" is an
   ordinary label (KI-151).
   **Labels as join keys (the lead's decisions, fix round).** The engine's label as read is the join key
   everywhere: an allocation row's `product` and its new `liquidity` field, figure keys, the workbook's product and
   liquidity keys (P01, L01) and the liquidity colours. `plainText` (which turns an en or em dash into a hyphen)
   applies to the text shown only, so two labels that print alike ("A (en dash) B" and "A - B") keep their own rows,
   keys and SUMIFS. Clients and distributors are keyed on the label as the file spells it, after the whitespace
   collapse the legacy applies (its `ws()`), because the legacy keys its matrices on that exact label: letter case is
   not folded. Labels that differ only in letter case stay separate clients or distributors (their own matrix
   columns, counted apart in the Clients KPI) and raise the Warning `base-file.entity-case-variant`, one per level,
   listing the sets of labels and scoped to their holdings. Whether to fold letter case is put to the owner (point
   12).
   **Screen words (second fix round, N12).** The client and distributor column headers show the labels as the file
   spells them, with no upper case, so two labels that differ only in letter case stay apart on screen. The group note
   counts the named clients (or distributors) as the Clients KPI does, and gives the "not given" column in words:
   "2 clients, and 2 holdings with no client" ("1 holding" in the singular). A hidden matrix whose only column is
   "Client not given" reads "No client named", with the line "No included holding names a client: no client matrix is
   shown, and the workbook has no Client Allocation sheet." It never reads "Single client".
4. **Single client or distributor (OD-21) across outputs.** With fewer than two clients (or distributors) holding
   included holdings, the screen hides that matrix behind one line, and the workbook leaves out its sheet; the Read
   Me says why.
5. **The workbook.** Sheets in order: Read Me and Controls, Source Register, Holdings (as loaded), Portfolio
   Overview, Client Allocation and Distributor Allocation (only when shown), Audit Log and a hidden, protected
   `_manifest`. Portfolio Overview is one table with a Block column (asset and product rows, the Grand Total, the
   liquidity rows, the liquidity percent always in the % CMV column). Every aggregate is a SUMIFS over the holdings,
   with criteria only on canonical asset classes, the generated keys (P01, L01, C01, D01; C00 and D00 when not given)
   and Yes/No flags; its cached value is the view-model's figure. A missing value is a blank cell with its status,
   never a formula. Cambria 9; money in Indian grouping through
   `[>=9999999.995]##\,##\,##\,##0.00;[>=99999.995]##\,##\,##0.00;##,##0.00`, units the same with three decimals and
   the conditions at `.9995` (the lead's decisions, fix round, and second fix round, N8: each condition sits at the
   rounding edge of its section, so 99,999.995 reads "1,00,000.00" and 9,999,999.995 "1,00,00,000.00", as on screen;
   measured in Excel 16.0 build 20527 on 27 Oct 2026). Excel allows two conditions, so known limits stay (N16):
   amounts at or below -1,00,000 fall in the third section and take the system locale's grouping ("-100,000.00");
   beyond the format's nine placeholders (1,00,00,00,000 or more in the display unit, never a real amount) the
   leftmost placeholder takes the extra digits ("100,00,00,000.00"). Percent `#,##0.00"%"` (N9): "1,900.00%", the
   screen's text below 1,00,000% (from 1,00,000% Excel shows "100,000.00%", the screen "1,00,000.00%"); dates
   `d mmm yyyy`; negatives in #931621 by conditional formatting; thin #D9D9D9
   borders; inline strings with a quote prefix when they start with = + - @, a tab or a carriage return; values
   unrounded with number formats. `_manifest` lists each formula's hash and the cell of each view-model figure (the
   cross-output join).
   **Fix round.** (a) The lead's decision: the "Share of family (%)" row of Client and Distributor Allocation stays
   below the Grand Total but outside the autoFilter range, its `_xlnm._FilterDatabase` name and the negative red
   (`SheetSpec.tableRows`). Second fix round (N7): one blank row, written as no row at all (`SheetSpec.rows` takes an
   empty array for it), sits between the Grand Total and the share row, because Excel extends a filter to a row that
   touches it when it opens a file: with the share row directly below the Grand Total it read A1:G12, hid the share
   row under a filter on column A and moved it to row 2 on a sort (Office acceptance, 27 Oct 2026). The Office
   acceptance compares each sheet's `AutoFilter.Range.Address(False, False)` with the file's range.
   (b) The Exclusion Reason of Holdings (as loaded) follows the market value's status, as
   the import report words it: "Market value not a number (invalid source data, OD-8)" or "No market value (OD-8)".
   (c) The Source Register records the Review stage for an accepted file: `review.sources[0].stage` is `review`.
   **The writer's interface as built (U5).** A formula reference (`Fx` cell) is relative unless `absCol` or
   `absRow` is set; `ColumnSpec.key` is the name formulas use for a column (the header when not set, unique in the
   sheet); `SheetSpec.rowStyles` merges a style per data row (a bold asset row) under each cell's own style;
   `SheetSpec.tableRows` limits the filter and the conditional formats to the first rows; the workbook input carries
   `entityKeys` (each client and distributor id with its generated key, C01 or D01, C00 and D00 when not given);
   Client and Distributor Allocation end each row with a Status column naming the status of a blank figure; and
   `_manifest` has one `figure <key>` row per view-model figure, with the cell it is written to.
6. **Chart labels and colours.** A pie label is the category and its percent to one decimal ("Equity 59.3%"), and no
   label is drawn under 2.00%: the value stays in the legend and the table. The lead's decision (fix round): a slice
   gets a label when its share, rounded to two decimals by the display rule (point 13), is 2.00 or more, so the
   table and the chart agree (1.995 is labelled "2.0%", 1.994 is not). A pie with one slice draws no label, on screen
   and on the slide: the legend and the table carry its 100%. Colours are fixed by category name: Equity
   tan, Hybrid grey75, Debt gold, Commodity #808080, REITs/InvITs #8C6B43, Alternatives #C9A876, Cash #E5DACB, Unknown
   #D9D9D9; liquidity Open Ended gold, Close Ended grey75, other labels the rating ramp in alphabetical order (KI-150).
   On screen the labels sit outside the pie on the white panel (#222222 on white, 15.9:1); labels inside slices failed
   4.5:1 on Commodity and REITs. On screen (fix round) each pie keeps the same 32 px band above and below for its
   labels (6 px offset, 4 px padding on each side, one 12 px line at 1.2), and the legend starts below that band: a
   blank layout box of the band's height sits between the pie and the legend. Left and right room is the longest
   label drawn, measured on the canvas, plus 18 px, and never less than 64 px. Below 360 px of canvas width a label
   is the percent alone ("59.3%"). A pie with one slice draws no label and no outline. The rules live in
   `app/src/ui/pie-config.ts`. On the slide each label is written as text from the view-model, not built by
   PowerPoint from the value. It is set on two lines: in each data label the text body is `<a:bodyPr wrap="none"/>`,
   then the category run, a line break (`<a:br/>` with the run's properties), then the percent run, and the
   separator is a new line, so a label reset in PowerPoint reads the same. PowerPoint caps a pie label's width: in
   the Office acceptance of 27 Oct 2026 "Commodity 3.9%" broke as "Commodi / ty 3.9%", and `wrap="none"` alone
   clipped "Unknown 27.8%" at the chart edge. On the slide a pie with one slice also has no slice outline
   (`<a:ln><a:noFill/></a:ln>` on the slice and the series): the outline of the 360 degree slice showed as a radius
   at 12 o'clock. A label that would read under 4.5:1 on its slice is placed outside it. Declared
   repeats on C-08: the KPI invested value and CMV with the Grand Total row, and the asset pie labels with the table's
   % CMV. The deck title in the file properties is the family label followed by "Portfolio overview".
   Second fix round: from 5 categories a C-08 pie's legend wraps to two rows, and the pie takes a manual plot layout
   (inner target, edge modes) that leaves 26 pt between the pie and the legend's top: a 106.1 pt circle at x 0.2589,
   y 0.0868, w 0.4823, h 0.5584 of the 220 x 190 pt chart (`C08_LAYOUT.piePlot`, `piePlotLayout`; N13); with fewer
   categories PowerPoint places the pie. In PowerPoint the six-class decks with a slice at 6 o'clock
   (`tests/exports/pptx/pie-6-oclock.ts`) showed that label clear of the legend, about 11 pt between the texts against
   2.5 pt before (the fixer's run on its own branch, 27 Oct 2026). The deck post-processing replaces only with
   functions, never with replacement strings, so a label holding `$&`, `$'` or `$$` is written as it reads (N14). As
   built (N16): the labels of adjacent small slices may sit close together on screen and on the slide; their text
   never overlaps, and this is accepted.
7. **Preview marker.** "Preview build, not for client use" sits in the black footer band of every slide (white Cambria
   8 pt italic), in the first data row of the Read Me (row 2, under the frozen header), and file names end in
   `_PREVIEW`, exactly when the build channel is preview.
8. **C-08 in M1.4** carries the three KPIs (Invested Value, Current Market Value, Unrealised Gain/Loss), the asset and
   product table over continuation pages and the two pies; the insight box waits for the observation engine (M5).
   The liquidity rule of the legacy (`07_engine.js:607-615`) is ported as it is (E-18); M2.2 turns it into data.
   The C-08 footnote is the as-on date, then the view-model's notes that the page's figures refer to, in the
   view-model's order, each sentence once. The slide words nothing of its own: the excluded holdings are the
   view-model's "excluded" note. A chart with nothing to show reads "Chart not drawn: " and its status as
   `STATUS_PHRASE` words it, for example "Chart not drawn: not applicable.".
9. **Validation and the export gate.** A failed reconciliation is Blocking (tolerance 1e-9 relative plus 1e-12
   absolute); `review.as-on-missing` is Blocking (there is never a fallback date, KI-087); `review.no-included-holdings`
   is Blocking; `review.total-like-holding` is High (KI-142). A High result blocks exports until the analyst
   acknowledges it in the basic validation panel, which writes an audit entry. Reader Warnings that touch overview
   figures become notes. U-67 in full stays in M13. The KI-147 money notes (fix round, the financial reviewer's
   fix) count distinct holdings whose figure the rule changes: a market value, or the invested value of an included
   holding, from the reader's findings (`BaseFileImport.moneyFindings`), never from rule results and never from the
   file's gain or loss. They name the column as the file heads it, name later columns by their unit only when the
   file has them, give the tolerance in the display unit ("0.005 Crore", "0.5 Lakh") and agree in number; each is
   attached only to the KPI whose figure it changes. For example: '1 holding has a market value in "Current Market
   Value (Lakh)" that is not a number: it is invalid source data.' The Warning `base-file.entity-case-variant`
   (point 3) is listed in the validation panel and the Audit Log and makes no note. As built (second fix round, N16):
   `base-file.total-row-skipped` (point 16) and `base-file.negative-market-value` (point 18) make no note either; a
   note of `entity-case-variant` would print client labels in the footnote, a skipped total row changes no figure,
   and the left-out lines of a negative market value have their own notes (point 18). The validation panel still files
   these three Warnings under its "Footnoted" effect; that wording is left for the next round.
10. **Scope.** U-06 (the base-file template) moves to M7. "Disclaimer in use" shows NOT AVAILABLE IN SUPPLIED DATA
    until the monthly folder arrives (M11). Matching arrives in M2. Family scope only. Family and client labels are
    editable. The built-in logos ship (the generic scan is clean on them; the private deny-list runs before the push).
11. **The Audit Log** lists audit entries, then validation results by rule, severity, status, decision and count,
    without message text. An export entry records the file kind, SHA-256 and size; in its file name the family label
    is replaced by `<family label>`.
12. **Open owner items.** BF-19 (an unrecognised Asset Name is Unknown), BF-26 (letter case and spacing folded) and a
    market value of exactly 0 (a real zero, included) stay on the M1.3 defaults; their ledger entries say "pending
    owner" (`DATA_DICTIONARY.md` §8). Beside BF-26 the owner is asked whether to fold letter case for client and
    distributor labels (point 3; until then they are kept as spelt, as in the legacy).
    Second fix round (N16): since fix batch 4 the live
    page folds the letter case of Asset Names too (D-041 point 6), so BF-26 is no longer a difference from the live
    page, and the owner's question stays open for both builds; the client and distributor question also covers the
    joint-holder columns (point 19).
13. **Display rounding (the lead's decision, fix round).** Every figure is shown by one formatter
    (`views/format.ts`: `excelFixed`, `displayRounded`, `formatIndian`). It rounds as Excel shows a cell: first to 15
    significant digits, then half up on that decimal, on the decimal digits and never on the binary double. So 1.005
    shows 1.01, 0.145 shows 0.15, 2.675 shows 2.68, -1.005 shows -1.01, and 35.67499999999998 (family-a's Hybrid
    absolute return, (0.5427 - 0.4) / 0.4 x 100) shows 35.68%. A value that rounds to zero is shown without a sign;
    an Excel build may show -0.00 (not seen on Excel 16.0 build 20527 on 27 Oct 2026: -0.004, -0.001, -1e-10, -1e-16
    and -2.8e-17 show "0.00" and "0.00%"), a known limit (N16), and the Office check ignores only that sign.
    The Office acceptance compares Excel's
    `Range.Text` of every `_manifest` figure with the screen's text. At half-way values the text differs from the
    legacy page, which rounds the binary value (0.145 shows 0.14 there): a classified difference outside the parity
    ledgers, recorded in `DATA_DICTIONARY.md` §8 (second fix round, K2). Accepted by the owner for the new app on
    2 Nov 2026 (PD-48): 35.675% shows 35.68% in the new app, 35.67% on the live page. Family-a's Mutual Funds product
    row under Hybrid shows the same 35.68%.
14. **Section 1, the base-file slot (fix round).** A reader refusal is a sentence built from its `LoadError` kind,
    never the reader's text: "Refused: the file is 21.0 MB; the limit is 20 MB." ("just over 20 MB" where one
    decimal cannot show the excess); "Refused: the workbook has 41 sheets; the limit is 40."; 'Refused: the sheet
    "<name>" has more than 4,00,000 filled cells; the limit is 4,00,000 on one sheet.'; "Refused: the file could
    not be read as an Excel workbook." A file read with no holding, or with an open Blocking reader result (no
    header row, no holding row, no market value column), is refused too: the error state, the "Refused" chip, the
    reader's sentence and Accept not available. An exception of the reader or the engine is `review-failed`: "The
    file could not be reviewed: an internal error stopped the review." with its technical detail, never
    "unreadable". After a refusal the Accept reason is "The file was refused: choose another base file." Before
    Accept the source register lists the base file at Preview, as the stage strip shows it (Validate for a file
    refused or failed there); after Accept it lists the review's sources (stage Review). A missing data date in the
    source register is the dash alone in its cell; its status is read to screen readers and named in a footnote: "A
    dash in the Data date column marks a missing date: not available in supplied data." The import report shows the
    base file's full 64-hex SHA-256 in monospace, wrapping in its cell; the source register keeps the 12-digit form
    with the full hash in its title. With no included holding the client and distributor groups read "No included
    holding" in both the note and the line, never "Single client". The review bar names the base file only when the
    file was read and not refused: a refused file reads "Base file refused", a file whose review failed "Base file not
    reviewed", and with no file the bar reads "No base file loaded" (`ui/upload-slot.ts` `barFileName` and
    `barFileStatus`; second fix round, N12).
15. **Focus and the review bar (fix round).** The focus never falls to the body. After a pick or Remove it goes to
    the new file input. Accept and the downloads are `aria-disabled` (`aria-busy` while a file is prepared), not
    disabled, and ignore clicks while not available. An answered XIRR question moves the focus to the next question,
    else to the import report heading; an acknowledged result moves it to the next Acknowledge, else to the
    validation heading. Opening a section from its tab places the review bar just below the pinned header, with
    the focused heading under it: the browser spike and `overview.cdp.mjs` pin the measured gap at 8 to 20 px (12 px
    at 1440 and 1366 px, where the section starts at the top of the page and the scroll clamps there; second fix
    round, N12). Where nothing is pinned (52rem or less) the review bar is 16 px from the top. This amends the wording
    of D-037 point 1.
16. **Total rows (second fix round, N1; D-041 point 3, KI-148).** The reader skips a row whose Instrument Name is
    "Total" or "Grand Total" (any letter case, spaces collapsed; the live page's rule `^(grand ?)?total$`), as the
    live page does. The skip reason is `total-row`, and one Warning, `base-file.total-row-skipped` (decision KI-142),
    names the rows: '2 rows named "Total" or "Grand Total" in the Instrument Name column were skipped as total rows,
    not read as holdings (rows 5 and 9).' Those rows are not counted again in the Information
    `base-file.skipped-total-row`, which stays for blank-name total rows (KI-074). A fund whose name only begins with
    "Total" is still a holding; it still raises `base-file.total-like-name`, and so the High
    `review.total-like-holding` (point 9; its fixture is now `syn-total-rows`). This replaces the M1.3 reading of
    such a row as a holding with a Warning.
17. **Merged folios (second fix round, N2; D-041 point 2, KI-148).** A merged holding takes the earliest purchase
    date of its folios, whatever the row order (the first such folio on a tie). Its holding days: when every folio
    with holding days has a date and they count to one date within a day (`MERGED_DAYS_TOLERANCE`), the earliest
    folio's own figure, or, when it has none, the days from its date to that date; with no dated folio, equal
    holding days stand; otherwise blank (INSUFFICIENT EVIDENCE) with the Information `base-file.merge-days-blank`
    (decision D-041) in the live page's sentence; no folio with days gives blank days and no notice. Only the
    workbook's Holdings (as loaded) shows them ("Avg. Holding Days" and its Status). The owner's question 1 of D-041
    stays open for both builds.
18. **Negative market value (second fix round, N10; the lead's decision, which the owner may revisit).** The reader
    reads a negative market value as written and raises the Warning `base-file.negative-market-value` (decision
    D-039), naming the holdings; the numbers match the live page. The overview adds two fixed notes after "unknown",
    carried by the pies' share figures, so the C-08 footnote has them: "Asset classes with a market value of 0 or
    less are left out of the pie: Commodity." (only while the total CMV is above 0; a class at exactly 0 too) and
    "Liquidity lines with a market value of 0 or less are left out: T+3." Limit: when every liquidity line is left
    out, the liquidity pie reads "Chart not drawn" and the slide footnote does not carry the liquidity sentence (the
    screen and the Read Me do).
19. **Joint-holder labels (second fix round, N11).** `base-file.entity-case-variant` considers only the labels that
    key a holding's client or distributor. A joint-holder label that differs from such a client only in letter case
    is not linked to it, with the Information `base-file.holder-case-variant` ('The joint holder "SAMPLE CLIENT B" is
    not linked to "Sample Client B": the letter case differs.', decision D-039, scoped to the holdings whose folios
    name that holder).
20. **Office acceptance under the owner's rule (the owner's standing rule of 2 Nov 2026, K1; it replaces the stop
    rules of N15).** The Office scripts attach only to an Excel or PowerPoint already running (the task list first,
    then `GetActiveObject`; never a new instance), open only their own synthetic file, read-only and without a window
    (in Excel only that workbook's window is hidden, and the owner's active workbook and window are re-activated
    when they still exist), change no application option, recalculate only their own workbook, close only that file
    in a finally block, and never quit, stop or kill Office or run a watchdog. With no instance running the case is
    NOT RUN, with the paths of the files for the owner to open by hand, never a pass; on a hang the run abandons and
    reports TIMEOUT with the path of the file left open, for the owner to close. The damaged-file negative controls
    are never run against the owner's Office. N15's 75 s wait and its checked last-resort stop are withdrawn with
    it. `docs/TESTING.md` §6.1 and each script's header state the rule; `tests/exports/xlsx/office-scripts.test.ts`
    pins it from the scripts' text.
**Alternatives.** The fallback to the Lakh value, flagged on the holding (the lead's earlier default for KI-147;
rejected by the owner); the legacy asset order Equity, Hybrid, Debt in the matrices (rejected: no record supports it);
PowerPoint's own pie labels with its separator and rounding (rejected: the slide would not show the screen's text);
rounding with `toFixed` on the binary double (the first M1.4 formatter; rejected in the fix round: screen and slide
differed from Excel's text at half-way values); folding the letter case of client and distributor labels (the M1.3
reader's rule; rejected in the fix round until the owner answers: it changed client numbers against the legacy with
no ledger entry); the money format `#,##0.00` (rejected in the fix round: a Lakh book above 1,00,000 L read in
Western grouping in Excel only); reading a "Total" or "Grand Total" row as a holding with a Warning (the M1.3
reader; replaced in the second fix round by the live page's skip, so one total row never doubles a figure).
**Consequences.** KI-147 is fixed in the new app; KI-007, KI-020, KI-021, KI-071, KI-078, KI-084, KI-087, KI-089,
KI-091, KI-092, KI-093, KI-094 and KI-150 are fixed there too (the legacy page is unchanged, D-028). `DATA_DICTIONARY.md` §5.3, §5.8, §5.13 and §6,
`ARCHITECTURE.md` §14 and §15 and `deck-design-system.md` describe the rules; the parity ledger lists the corrections
that change client numbers. The fix round adds its tests: `tests/unit/views/rounding.test.ts` against an oracle
written apart (`tests/helpers/excel-text.ts`), `tests/regression/ki-147-money-notes.test.ts`,
`tests/unit/ingest/entity-case.test.ts`, `tests/exports/xlsx/dash-labels.test.ts` and `acceptance-cases.test.ts`,
`tests/exports/pptx/c08-wired.test.ts`, `tests/unit/ui/pie-config.test.ts` and `upload-slot.test.ts`, the
legacy-minus-new check of AG-01 and AG-13 (of AG-13 and AG-14 from the second fix round) in
`tests/parity/aggregation.parity.test.ts`, and the cross-unit tests
`tests/integration/upload.test.ts` (U-04), `as-on-change.test.ts` (U-05), `tests/workflows/w-01-load-family.test.ts`
(W-1) and `tests/acceptance/ac-01-standard-review.test.ts` (AC-01: family-a, family-a-lakh and family-a-rupee end to
end against sums of the file's own money column), with the browser check `tests/browser/overview.cdp.mjs`. The
case-variant and dash-label fixtures show no difference from the legacy beyond AG-11. The second fix round adds
`tests/regression/ki-148-total-rows.test.ts` and `ki-148-merged-dates.test.ts` (the live page's KI-141 and KI-142
known answers through both readers), `tests/regression/ki-151-prototype-labels.test.ts` (7 label fields by 5
Object.prototype names, 35 books), `tests/unit/views/negative-cmv.test.ts`, the N11 cases of `entity-case.test.ts`,
`tests/unit/exports/xlsx-number-formats.test.ts`, `tests/exports/xlsx/office-scripts.test.ts`,
`tests/exports/pptx/pie-plot-layout.test.ts` and `postprocess-replace.test.ts`, `tests/unit/ui/overview-words.test.ts`
and `tests/browser/cdp-port.test.mjs`. Its parity re-run against the live page after fix batch 4 retires AG-01,
AG-02, AG-05, AG-06 and AG-08 (D-041) and rewords AG-04, AG-09, AG-13 and AG-14; the total-row, merged-date and
negative market value fixtures show no difference. KI-148 is fixed in the new app.

## D-040 — Live-page tax rules follow the TY2026-27 reckoner (24 Oct 2026, lead under D-033; CR-0008)
**Context.** The owner supplied `India_Taxation_Reckoner_TY2026-27.xlsx` (law as on 19 Oct 2026; the Income-tax Act
2025 in force from 1 Apr 2026) as the source of record for the current tax year. A financial review compared it with
the live page's Taxation tab, slides and AI Analyst tax signal and found 23 discrepancies, TX-01 to TX-23, each
re-verified (all confirmed); they are KI-160 to KI-182 (TX-nn is KI-(159+nn)). Under D-028 they are calculation and
data fixes for the live page. Some fixes need a rule the reckoner leaves open; the lead set a default for each, and
**every default below is open to the owner's confirmation** (and the tax adviser's, where marked).
**Decision.** Where the review's verifier gave a corrected fix it is followed; in addition:
- **(a) Reference date.** Holding periods run to the base file's valuation date (the date of the market values and
  gains), not to the latest IRR transaction. IRR transactions dated after it are left out of FIFO, with a notice
  (TX-17, KI-176).
- **(b) "More than N months".** A lot is long term strictly after its anniversary: the threshold in calendar months is
  added to the purchase date, clamped to the month end (29 Feb 2024 + 12 months = 28 Feb 2025), and the lot is long
  term from the next day (TX-01, KI-160). The clamp is for the tax adviser to confirm.
- **(c) Shares held directly.** A foreign-listed share is 24 months, short term at slab, long term 12.5%, no
  exemption, only on a positive marker: an ISIN not starting with IN (the ISIN of the matching reference entry; the
  base file's own ISIN column is not read, KI-184), or a product or category label naming foreign,
  international, US or overseas equity. Every other direct equity is Listed Equity Shares, and direct-equity product
  labels such as Equity, Shares and Stocks count as direct equity (TX-03, KI-162). The reckoner has no row for
  foreign-listed shares.
- **(d) AIFs.** Category III is taxed at fund level: no investor-level gain, loss or tax, kept out of the harvest
  pools, with a plain note (TX-07, KI-166). Category I and II pass through per the AIF's annual statement: no
  investor-level tax figure is computed and they are kept out of the harvest pools, with a note (TX-12, KI-171).
  Amended by D-043 (2 and 9 Nov 2026): a fund called a Listed AIF is treated as Category III, with a note to confirm
  the category against the AIF's statement; a category the fund states itself wins; the performance data's Listed AIF
  label counts only for the fund of the entry's own name.
- **(e) Set-off order.** Short-term losses go first against the gains taxed at the highest rate. Slab-rate gains are
  ranked at an analyst-set slab rate that defaults to 30% and is shown as an assumption (TX-16, KI-175).
- **(f) The Rs 1.25 lakh exemption** is per client (person) and per tax year, shared across listed shares,
  equity-oriented funds and REIT and InvIT units. The harvest assumes it is unused unless the analyst enters the
  amount already used this tax year (default 0), and says so (TX-09, KI-168). Set-off and the exemption are never
  pooled across a family: the family view sums the per-client results (TX-08, KI-167).
- **(g) Crypto and virtual digital assets** keep 30% for any holding period (the reckoner has no row; the law is
  unchanged), with the source noted in the row (TX-23, KI-182).
- **(h) PMS** is taxed per security as if held directly (TX-10, OD-12, KI-169): the verifier's corrected fix within
  what the base file and IRR sheet can express, with the limitation stated where per-security data is missing.
- Where a fix needs data the page does not have (annual holdings tests, 31 Jan 2018 prices for grandfathering, the
  AMC's year-end classification), the page discloses it and takes the safe behaviour the verifier proposes; it never
  invents a number.

Settled while building part T1 (classification and the TAX_RULES rows, 27 Oct 2026), within the decisions above,
for the owner to confirm or change:
- **Usual buckets.** Hybrid funds take the reckoner's bucket for their SEBI category: aggressive hybrid
  equity-oriented, balanced hybrid the general rule, conservative hybrid Specified. Balanced advantage, dynamic asset
  allocation, multi asset and life cycle funds, and retirement and children's funds, stay
  unclassified with the reason until the AMC's year-end classification is an input. (Part T5 amends this for
  aggressive hybrid, arbitrage and equity savings funds: they take the reckoner's usual bucket from 1 Apr 2026 and
  are unclassified before it; see "Settled while building part T5" below.) SIFs are classed by strategy
  name: equity long-short and sector rotation equity-oriented, debt long-short Specified; ex-top 100, hybrid and active
  asset allocator unclassified. A single equity ETF or BeES fund of funds is "Equity ETF FoF (90/90)", pending the
  owner's or AMC's confirmation fund by fund; other multi-ETF or index FoFs (Bharat 22, ESG sector leaders, multi
  factor) follow the general rule; a conservative FoF stays unclassified.
- **Class names.** SIFs get their own rows ("SIF (equity long-short)", "SIF (debt long-short, Specified)") with the
  same parameters as the mutual-fund rows, so no slide calls a SIF a mutual fund; the debt row cites Sec. 76 (old
  50AA) of the Income-tax Act 2025 (answers OD-28); US treasury and US debt FoFs are international FoFs (Global
  Funds), not Specified.
- **ELSS lock-in.** A lot is locked up to and including the third anniversary of its purchase and can be sold from the
  next day. Locked units count as not classified: in the holding's CMV and Gain/Loss, out of the long- and short-term
  columns, the amounts available for rebalancing and tax harvesting.
- **REIT and InvIT funds.** A fund is recognised by its name (index fund, ETF, FoF) or a fund product other than plain
  "Mutual Funds", so a REIT held directly whose blank Product parses as "Mutual Funds" stays a REIT unit.

Settled while building part T2 (holding periods and lots, 27 Oct 2026), within the decisions above, for the owner to
confirm or change:
- **Where the valuation date comes from (a).** The base file's own "Valuation Date" column when it has one (the latest
  date in it), else the portfolio date the analyst sets for the review ("As on", printed as "Portfolio as on"), read
  strictly as "d Mon yyyy" and never the built-in default; with neither, the IRR sheet's latest date, as before, with a
  note. When the base file has no such column the portfolio date is taken as its valuation date (consistent with
  OD-2), and the tab says when the IRR sheet ends before it. Trades after the date are left out of the lots, counted
  and named.
- **The month-end clamp (b)** applies to the long-term rule as it already did to the ELSS lock-in: a lot bought on 29 Feb
  reaches its 12- or 24-month anniversary on 28 Feb and is long term from 1 Mar (for the tax adviser to confirm).
- **Units bought before 1 Apr 2023** of a Specified fund take their own class, one per Specified row: "Debt MF bought
  before 1 Apr 2023" (24 months, 12 for a listed ETF: "ETF" or "BeES" in the name or category and no "FoF") and "Hybrid
  MF (conservative) bought before 1 Apr 2023" (24 months), both STCG at slab and LTCG 12.5% with no exemption (Mutual
  Funds R26). The SIF debt row has no date rule (SIFs began in 2025). A holding with lots on both sides of the date is
  two records that add back to it exactly and count as one holding.
- **The 1 Feb 2018 disclosure (TX-18 step 1)** covers the classes of old Sec 112A: listed shares, equity-oriented fund
  units (equity funds and ETFs, ELSS, equity-oriented hybrids, equity ETF FoFs, equity PMS) and REIT and InvIT units.
  It is shown only when such a lot is open; no figure changes until the owner rules on step 2.
- **Labels.** "Long term after" reads "More than N months", the reckoner's own words.

Settled while building part T3 (the harvest, AIF and PMS treatment, the wording, 27 Oct 2026), within the decisions
above, for the owner to confirm or change:
- **The two assumptions (e, f) are per client**, entered on the Taxation tab's harvest card: the slab rate used to
  order the set-off (default 30%, held to 0% to 30%, before surcharge and cess) and the Sec 198 exemption already used
  this tax year (default Rs 0, held to Rs 0 to 1,25,000). A value equal to the default is shown as "(default)"; blank
  restores it. Both are stated on the harvest slide. They are per-family state, cleared when another family loads.
- **Slab-rate gains are ranked, never quantified.** A loss set against a slab-rate gain saves tax at the client's slab
  rate; that saving is not in "Estimated tax saved", and the amount sheltered is shown beside the "floor" warning.
- **The exemption in the order of set-off.** The Sec 198 gains inside the unused exemption count as taxed at 0%, so
  losses reach them after every other gain; a loss still left then goes to them (set-off comes before the exemption, so
  it is not carried forward while gains remain). At an equal rate the order is fixed: a slab-rate gain first (so the
  saving shown is never the larger figure), then other gains before Sec 198 gains, short term before long term, then
  by class name; never by the size of a holding. The total is the same whichever 12.5% pool a loss reaches first.
- **Sec 198 rows**: listed shares, equity funds and ETFs, ELSS, equity-oriented hybrids, equity ETF FoFs, equity
  long-short SIFs, equity PMS, REIT and InvIT units (Master Summary column J). Not AIF Category I or II: the page cannot
  see the listed-equity part of a pass-through gain (the review's question 3).
- **Not split, three kinds.** A Category III AIF is "fund level": no lot ageing, no reconciliation, its CMV and
  Gain/Loss in their own totals and column. A Category I or II AIF is "pass-through" and a PMS "per security": neither
  is split, both stay in "not classified", both are out of the harvest; a Cat I/II AIF needs no lot reconciliation, a
  PMS still reconciles its capital flows (as the verifier's tests require). The Cat I/II rows stay two rows (rate label
  "Pass-through"); the PMS row keeps 20% / 12.5% (listed equity held directly). For the AI Analyst such a holding is
  "n/a" with the reason.
- **Holdings with no client name** are one group, treated as one person for the set-off and the exemption, and counted
  on the tab and the slide.
- **Crypto is kept out of set-off** (part T4, after the financial re-review of part T3 found that part T3 left crypto
  gains in the short-term pools, ranked at 30%, so a loss went to them first): the page takes the safe behaviour, as the
  owner has ruled on CR-0008 question 18 (answered 2 Nov 2026: keep no set-off, D-043); whether the Income-tax Act 2025
  allows set-off stays a question for the tax adviser (question 25). The Crypto row carries `noSetOff` and its
  basis (the reckoner is silent; Sec 115BBH of the 1961 Act allowed no set-off either way and no carry-forward). No
  loss is set against a crypto gain, which is taxed in full before and after; a crypto loss reduces no other gain, is
  never shown as carried forward and is not offered as a holding to sell; a crypto gain and a crypto loss of one client
  do not net. The tab's harvest card and the harvest slide say so in one sentence. If the owner allows set-off, the
  flag comes off the row and the ranking at 30% applies again.
- **The carry-forward sentence** says "tax years" for every review (the review's question on reviews valued before 1
  Apr 2026 is open).

Settled while building part T5 (the follow-ups to parts T1 to T4, the owner's answers of 2 Nov 2026 and the
independent review, 2 Nov 2026), within the decisions above, for the owner to confirm or change:
- **The usual bucket, dated (the new build's TR-7 and LD-11).** Aggressive hybrid, arbitrage and equity savings funds
  take the reckoner's usual bucket (Master Summary rows 16 to 18, column P; Hybrid Funds & FoFs D19 to D21):
  "Hybrid MF (equity-oriented)" for aggressive hybrid and equity savings, "Equity Mutual Funds" for arbitrage, each
  labelled "usual bucket per the tax reckoner; confirm with the fund house" on the tab, the class slide and the AI
  Analyst, but only when the tax reference date (a) is on or after 1 Apr 2026. Before it they are unclassified, with a
  reason saying the AMC's classification for that year is needed. The reckoner calls the bucket equity-oriented only
  while 65% or more of the fund is in listed Indian equity on average over the tax year, so the AMC's year-end
  classification stays the check. A mutual fund whose name says arbitrage is read as an arbitrage fund when no earlier
  test claims it (for example a fund-of-funds name, a global category, a gold asset, a non-fund product, or a balanced,
  aggressive or conservative hybrid or equity savings category or name does), so a fund with a blank category, or filed
  as Debt or Liquid, is one. Part T1 had classed aggressive hybrid and arbitrage always and left equity savings
  unclassified always.
  The new build's design states the same rule (TR-7, LD-11; [`new-build/capital-gains-upload.md`
  §10.5](new-build/capital-gains-upload.md#105-tax-class-by-fund-type)); its label says "the owner's reckoner", which
  the live page does not use because its AI Analyst slide goes to the client (below).
- **The reference date is the assumed sale date.** The harvest reads "If the book were sold on <date>", so the
  valuation date (a) is the date of sale that the new build's TR-7 gates on; a review valued before 1 Apr 2026 asks
  about a sale before the usual bucket applied.
- **The AI Analyst moves with the class (PD-50).** The AI Analyst's tax signal has weight 7 in its composite (score 22,
  performance 18, risk 15, overlap 13, manager 10, weight 10, tax 7, impact 5), so the class a fund takes, and for the
  three fund kinds the review date, change what the AI Analyst does with a book that holds them: the composite, the
  target-weight band, the trim, the action label (Exit, Partial, Retain) and with it the number of exits, top-up
  candidacy, the plan summary, and through "Apply plan to Portfolio Rebalancing" the Rebalancing tab and its exports.
  The signal scores only a holding that has a split class; a usual-bucket holding is green when 75% or more of it is
  long term and amber otherwise, never red; without an IRR file nothing changes. Measured on a synthetic stress book:
  one fund's release 0.37 to 0.54 Cr and its target weight 6 to 3. ARC-01 measured it again on 2 Nov 2026 (not repeated
  by EX-01): the composite moves 0 to +6.75 points for long-term lots and -10.94 to +1.32 for short-term lots; on 98
  usual-bucket funds, each held once at 8.33% in a 12-fund synthetic book with only the as-on date changing, the target
  weight or trim differs for 15 funds and the action for 2 with long-term lots, and for 4 and 4 with short-term lots; one
  equity savings fund is an Exit of 1.00 Cr on 31 Mar 2026 (tax not assessed) and a Partial of 0.16 Cr on 31 Jul 2026
  (tax green). The financial-domain reviewer's own scan at the gate review (2 Nov 2026), built like ARC-01's (each of the
  98 usual-bucket funds, filed under the asset class the scan assumed (Hybrid, and Debt for an arbitrage fund; what real
  base files carry for these funds is UNKNOWN), held once at 8.33% in a 12-fund synthetic book with 11 Flexi Cap
  companions, only the as-on date, 31 Mar against 31 Jul 2026, changing), found the same pattern and the same kinds of
  fund: with long-term lots the composite moves 0.00 to +6.75 points, the target weight or trim differs for 13 funds and
  the action for 1; with short-term lots it moves -10.94 to +2.01 points, the target weight or trim differs for 4 funds
  and the action for 4. The counts depend on how the other signals place a composite relative to the 70 and 50 band
  edges and on each position's size against the target weights of those bands (10, 6 and 3 percent; the scans hold every
  fund at 8.33 percent, so only a crossing of the 70 edge flips an action): reviewer C's own scan (a third
  financial-domain reviewer, 3 Nov 2026), with the single asset-class tag of the target fund changed to Equity, gave the
  same composite extremes as ARC-01's (0.00 to +6.75 and -10.94 to +1.32 points) but a target weight or trim that
  differs for 15 funds and an action for 12 with long-term lots (1 and 1 with short-term lots); the pattern, which is
  what the owner decided on, holds in both. The first reviewer could not reproduce the stress-book figures above, the
  Exit-to-Partial example or the 9 of 264 against 21 of 504 count; they stay ARC-01's. Before 1 Apr 2026 part T5 takes away a class that the live page gives an
  arbitrage fund in every review (main) and that parts T1 to T4 give an arbitrage and an aggressive hybrid fund, so for
  a review valued earlier the tax signal of those funds goes from assessed to not assessed. Any fund that has a class
  and an IRR history but no reference data is assessed on three of the eight signals (weight, tax, impact), can score
  100 of 100 and can be named a Top-Up destination: this is not specific to the three usual-bucket kinds (an ordinary
  fund the page has no data on does the same on main, as the reviewer found). Parts T1 and T5 add kinds that now have
  a class, aggressive hybrid (T1) and equity savings (T5), and for the three kinds the review date switches it on and
  off (KI-212). The same weight moves ordinary funds when their lots change (ARC-01 counts 9 of 264 cases that "flip",
  against 21 of 504 for usual-bucket funds), so this is the design of the signal, not a defect of part T5. An amber
  verdict (mostly short-term lots) scores 50 of 100, so it lowers a composite that is above 50 without it and raises
  one that is below 50 (the +2.01 above is a fund whose other signals average 25.64), and it always scores below a green
  verdict; the AI Analyst therefore trims at least as much when lots are short term as when they are long term, and
  more when the composite crosses a band edge, which is the costly direction to sell. Until stage S8 a code comment
  above `aiaSigTax` called tax "never a reason to act"; it now says what the weight does. Built: the signal uses the
  class, as it does for every other fund. The alternative,
  "not assessed until the analyst confirms the class", is one line in `aiaSigTax` (the page has no control to confirm a
  class, so "until confirmed" is more than one line) and takes the arbitrage score away from the live page. The owner
  answered on 2 Nov 2026 (PD-50, CR-0008 question 21): "Keep and disclose." The signal stays as built, this paragraph is
  the disclosure, and the alternative stays a one-line change.
- **An AIF's category is read once** (D-043): the fund's own words, then the performance data's category for the fund
  it matched (when the holding's name is the entry's own name once normalised with "AIF" and brackets ignored: the
  page's name matcher is loose, and a sibling series is not told its category by it), then "Listed AIF" (Category III,
  with a note: the holding's own category, or the matched entry's label when the holding's name is the entry's own name
  with "AIF" and brackets ignored, the owner's answer to question 24 of 9 Nov 2026), else Category I or II assumed, with
  a note. An own category that says unlisted blocks the Listed AIF label of a matched entry.
- **IRR dates with an explicit zone.** A date-time with a zone in the IRR sheet ("2023-04-01T20:00:00Z",
  "2023-04-01T00:00:00+05:30") is read as the day written, the same in every time zone (part T2 read the machine-local
  day of the instant, which is another day in some zones; main read the UTC date). Only text that the browser's Date
  accepts is read at all, so an impossible date-time is still dropped. Other zone-named text, such as an RFC 2822
  string, stays the machine-local day (KI-186). The new build's IRR reader (M3) is not built; it is planned to read free
  text as written and to state its own rule for strings with an explicit zone (R-11). A Z time
  that is an Indian local midnight written in UTC ("2026-03-31T18:30:00.000Z") reads as 31 Mar, as it did on `main`
  (part T2 read 1 Apr on an Indian machine); which day a Z time means is the owner's call if a real export shows one.
- **The harvest inputs** are text fields. Indian or international digit grouping, a leading rupee sign, Rs, Rs. or
  INR (with or without the dot), a trailing "/-", "/=", INR or Rs, a "%" in the slab-rate field and an exponent are
  read; an entry that is not a number once those marks are removed (blank, text, a zero-width space, a number too
  large to hold) restores the default, with no message beside the field (a known gap).
- **A sale, switch out or transfer out with no price** (and a stated amount) never reaches the unit ledger. A holding
  whose history then gives more units than the base file says that such a row in the sheet carries no price, instead of
  saying a sale is missing.
- **Client-facing wording** says "the tax reckoner", never "the owner's reckoner": the AI Analyst slide and the
  workbook's AI Analyst sheet go to the client.
**Alternatives.** Leaving every hybrid and SIF unclassified until an AMC classification exists (rejected for the
categories whose bucket is fixed by their SEBI limits); mapping funds by plan name (rejected: wrong for 3 of 7
retirement plans on the review's measure); a fund whitelist for the international test (rejected: it loses
international funds with a blank product).
**Consequences.** CR-0008 implements the fixes in parts on `fix/legacy-batch-3-tax`; part T1 is KI-162 to KI-165,
KI-170, KI-172 to KI-174 and KI-178 to KI-180; part T2 (`fix/legacy-batch-3-tax-p2`) is KI-160, KI-161, KI-176 and
step 1 of KI-177; part T3 (`fix/legacy-batch-3-tax-p3-r2`) is KI-166 to KI-169, KI-171, KI-175, KI-181 and KI-182, with
KI-130; part T4 (the same branch) keeps crypto out of set-off after the re-review (KI-182, KI-175). Part T5
(`fix/legacy-batch-3-tax-cr-0008`, the branch that merges the whole batch) carries the follow-ups above, the owner's
answers to questions 17, 18 and 24 (D-043), KI-184 to KI-186 and the known issues its reviews filed (KI-200 to KI-206
from the independent review; KI-207 to KI-212 from the delta review and ARC-01's pre-review; KI-213 and KI-214 from the
gate review). The owner's and tax adviser's questions are listed in CR-0008. The new build ports each rule with
the same known answer (D-028).

## D-041 — Live-page base-file reading fixes (27 Oct 2026, lead under D-033)
**Context.** The parity work of milestone M1.3 found how the live page's `parseBaseRows` misreads some base files
(KI-140 to KI-145) and how the IPS then takes the wrong asset-class figures (KI-146, P1). Under D-028 the live page
takes such data and calculation fixes. Before building them the lead measured, privately and read-only, how often the
cases occur in the real base files on the owner's laptop (counts only, no file or value copied; the counts are in
`change-requests/CR-0009-live-base-file-reading.md`). In 32 base files with 1,705 holding rows there was no variant
Asset Name, no synonym, no total row, no text in a number cell and no impossible date. There were 65 groups of
duplicate folios in 19 files: none with a folio lacking units, 44 whose folios carry different purchase dates, 18 of
them with the earliest date on a later row. Of the 316 rows that have both a purchase date and holding days, only 190
count to their file's most common date, and no file reaches 90%: the "Avg. Holding Days" column behaves as an average
holding period, not as days since the purchase date.
**Decision.** Fix batch 4 (CR-0009, `tools/patches/2026-10-27-basefile-reading.js`) changes the live page as follows.
1. **Merged units (KI-140).** Units of merged folios are summed only when every folio has them; otherwise they are
   blank, never a partial sum (KI-113 extended to units, as D-035 accepted for the new reader), and the holding is
   marked. Taxation never reconciles such a holding on its invested value, the path meant for products priced in
   rupees: it leaves it unsplit, with the reason. This is the live page's answer to D-035's M7 rule ("not split, with
   its status"); the new build decides its own in M7. A holding whose folios all lack units is unchanged.
2. **Merged purchase date and holding days (KI-141).** A merged holding takes the earliest purchase date of its
   folios, whatever the row order. Its holding days are recomputed from that date: a folio's purchase date plus its
   holding days is the date the file counts to, and when every folio with holding days has a date and they count to
   the same date (within a day), the merged days run from the earliest purchase date to that date. Folios without
   purchase dates and with the same holding days keep that figure. Otherwise the merged days are blank, never one
   folio's figure. The figure so kept is the oldest folio's age on the date the file counts to: like the rejected
   as-on-date rule below, it is not an average of the folios. A merged holding whose folios were bought on different
   dates can therefore lose its holding days. Measured on the real base files for the financial review (counts only,
   CR-0009): 6 of the 12 merged holdings that carry holding days lose them, each with different holding days across
   its folios (3 bought on different dates, 3 without purchase dates); the 6 whose folios agree keep them; none
   changes to another figure. Only the workbook's "Base File" sheet shows them ("Avg. Holding Days") and no
   calculation reads them. The new reader keeps the first row's date and days (`DATA_DICTIONARY.md` §8, "Merged
   folios, first-row fields"), so the new build must align with this rule, or the owner chooses another for both
   (question 1 below).
3. **Total rows (KI-142).** A row whose Instrument Name is "Total" or "Grand Total" (any letter case, spaces trimmed)
   is skipped and counted in a notice. A fund whose name only begins with "Total" is still a holding. The new reader
   reads such a name as a holding with a Warning; on the live page a total row is never added to the book.
4. **Numbers (KI-143).** A number cell counts only when all of it is a number, with the new reader's rule: digits with
   thousands commas or spaces, a sign (the minus sign U+2212 too), a decimal part, an exponent, and a trailing "%"
   only in XIRR and BMXIRR. Anything else is blank, never 0, and a warning names each column with its count and the
   holdings left out for want of a market value. Text that says "not available" ("NA", "-", "nil") stays blank without
   a notice. A Crore cell so blanked falls through to the Lakh or rupee column, as a blank one does and as the new
   reader does today (KI-147 decides that rule for the new build in M1.4).
5. **Dates (KI-144).** A text date that does not exist ("31-02-2024", "31 Feb 2024") is blank with a warning naming
   the column; it used to roll into the next month. The formats read do not change.
6. **Asset Names (KI-145).** `ENGINE.assetLabel` reads the five classes of the Asset Allocation (Equity, Debt, Hybrid,
   Commodity, REITs/InvITs) without regard to letter case or spacing, "Fixed Income" and "Debt Funds" as Debt (OD-7)
   and "Commodities" as Commodity (as the live page's commodity test and the new reader already do). Any other label
   keeps the first form written in the file, so its case variants are one row too; a blank one is still Equity (the
   new reader's OD-7 rule for blanks stays out of the live page, BF-14), and an unrecognised one keeps its label
   (BF-19, open with the owner). Every reader of the asset follows: the allocation, the client sheets, analytics
   routing, performance buckets and benchmarks, tax classes and the IRR placement of unreached instruments. Folding
   the letter case is the owner's open question BF-26; the lead applies it on the live page, where a split row is a
   wrong number today, and the owner may reverse it for both builds.
7. **IPS actuals (KI-146).** The IPS adds up every Asset Allocation row of a class and reads each label as its class
   first. Its hybrid remainder is not changed: with look-through data it hands equity and debt the look-through does
   not cover to REITs and Commodities (KI-066), and summed class rows make that larger on a book with split labels
   (`family-a-odd-asset-labels`: REITs 2.06% to 7.40%, Commodities 14.37% to 32.22%, against true shares of 3.30% and
   14.37%; CR-0009). It waits for the owner's KI-066 decision.
8. **Notices.** `parseBaseRows` returns its notices, one plain sentence each, and the status line shows them after the
   load summary, escaped. Total rows, unreadable cells, impossible dates and units left blank are warnings; holding
   days left blank and labels read as a class are information. A row that repeats the header is skipped before its
   cells are read and gives no notice (the financial review; it had given a false warning).
**Question for the owner (1): the "Avg. Holding Days" of a merged holding.** One fund held in several folios shows as
one line. Should that line carry (a) the oldest folio's age counted to the file's own date, blank when the folios'
figures do not agree on one date (as built; 6 merged holdings on today's files show blank); (b) an average of the
folios' holding days weighted by units; or (c) the first row's figure, as before? The answer applies to both builds.
**Alternatives.** For holding days: the review's as-on date minus the earliest purchase date (rejected: the as-on date
is the analyst's, not the file's; the chosen rule is no more an average than this one, since it too gives the oldest
folio's age, counted to the file's own date instead); a unit-weighted average of the folios' holding days (the other
choice `DATA_DICTIONARY.md` §8 names, and the only one of these that is an average; not taken, kept for the owner);
the first row's figure (rejected: it depends on the row order). For total rows: reading them with a warning, as the new reader does (rejected for the
live page: one total row doubles every figure). For Asset Names: folding them only in the Asset Allocation (rejected:
the routing, client sheets, IPS and tax classes read the same label, and would disagree with it).
**Consequences.** `index.html` MD5 `911A04659CB34383E478416B54E9C306` → `558A50F356406B2237AF247179A2186E`, then
`12B5E5727FCA01EF2EA162C59913F01D` with the financial review's patch (`tools/patches/2026-10-27-basefile-review.js`).
Known issues KI-140 to KI-146 are fixed, each with a known-answer test in `tools/regression/`. The parity ledger
retires BF-15, BF-16, BF-18 and BF-20 to BF-26: the live page now behaves as the new reader there, and a retired entry
matches nothing, so the difference coming back fails the parity test. Points 2 and 3 open differences no parity
fixture exercises yet; the ledger notes list them and KI-148 tracks them for M1.4. The new build must align
`DATA_DICTIONARY.md` §5.3 and §8 with point 2 (and consider point 3) before its reader ships: their "as the legacy"
wording on merged purchase dates and holding days is stale once this merges. The owner's questions BF-19 and BF-26
stay open for both, with question 1 above.

## D-043 — The owner's answers on the AIF category, on crypto set-off and on a fund linked to a Listed AIF only by name (2 and 9 Nov 2026; PD-02, PD-03, PD-54; CR-0008)
**Context.** CR-0008 left two questions to the owner. Question 17: the performance data labels 11 of the 12 AIFs it
holds "Listed AIF", which states no SEBI category, and the live page (part T3) treated an AIF whose category it could
not read as Category I or II (pass-through). Question 18: whether crypto gains and losses can be set off under the Act
in force from 1 Apr 2026 (D-040 (g)); the page kept crypto out of set-off meanwhile (part T4). The owner answered both
on 2 Nov 2026 through the lead. The gate review of part T5 then raised a third, CR-0008 question 24 (point 2, step 3
below): whether the Listed AIF ruling also covers a fund that the page's loose name matcher only links to a Listed AIF
entry. The owner answered it on 9 Nov 2026 through the moderator (PD-54).
**Decision.**
1. **Question 17: yes.** A fund called a "Listed AIF" is treated as Category III (taxed inside the fund; no
   investor-level gain, loss or tax; kept out of the harvest), and the page says so in a safe note that asks the
   analyst to confirm the category against the AIF's statement (on the tab, the class slide and the AI Analyst; the
   harvest slide's "Left out" line only names the treatment). The owner's words: "Yes and still put a safe note".
2. **How the page reads an AIF's category** (`taxClassify`, one place, four steps):
   1. the fund's own words (its category, name and product): Category III, else Category I or II, as stated, with no
      mark;
   2. else the category of the performance-data entry the holding matched (the page's own matcher links the holding to
      the entry before it computes tax), when the holding's name is the entry's own name once normalised with the word
      "AIF" and brackets ignored (the same equality as step 3, stage S11); the matcher is loose, so a sibling series it
      maps to the entry is not told the entry's category. "AIF (CAT III) - Listed Equity" is Category III, as stated;
   3. else "Listed AIF": the holding's own category says so, or the matched entry's category says so and the holding's
      name is the entry's own name once normalised with the word "AIF" and brackets ignored ("Name AIF" and "Name
      (AIF)" are the entry "Name"). An own category that says unlisted blocks the entry's label, and only the whole
      label Listed AIF counts, in any letter case and with any blanks around or between the words, so "Listed AIFs" or
      "AIF (Listed)" do not. Category III, fund level, marked as treated by this answer, with the note. A fund that the
      loose name matcher only links to such an entry by a similar name (another fund of the same house, a series, a
      real-estate fund) is not told the entry's label: it falls to step 4. The owner answered this as CR-0008
      question 24 on 9 Nov 2026 (PD-54, relayed by the moderator). The option, as put to him: "your Category III ruling applies
      only if the fund's own words say 'Listed AIF', or its name matches the performance entry's name exactly (ignoring
      'AIF' and brackets); a merely similar name stays Category I or II with the caution note". His answer: "Restrict it
      (Recommended)". Built in stage S10 of part T5; the 11 genuine entries of the data keep their ruling, also when the
      name is written "Name AIF" or "Name (AIF)". Since stage S11 the same equality serves step 2;
   4. else nothing states a category: Category I or II, pass-through, marked as assumed, with a note (part T5 item 4).
   A fund whose own words say Category I or II while the performance data calls it a Listed AIF is therefore Category I
   or II, as stated, with no note. The words that count are cat or category followed by III, II, I, three, two, one, 3,
   2 or 1, with spaces, dots, colons, brackets (round, square or curly), slashes, underscores, hashes, commas or dashes
   (the Unicode dashes and the minus sign too) between. "AIF-II" and "Category No. III" are not read ("AIF-II" because
   a series number such as "Fund III" would then be taken for a category); such a fund falls to step 4 and its note
   asks for confirmation. The owner confirmed this order in plain words on 2 Nov 2026 (PD-47): "The fund's own
   statement wins and second order win is my ruling." Read as the moderator read it: the file's own words first; then
   the category of the matched performance entry; then the Listed AIF ruling (Category III, with the mark); then
   nothing stated, Category I or II assumed.
3. **Question 18: keep "no set-off".** Crypto gains and losses stay out of set-off and a crypto loss is not carried
   forward, as in part T4 (D-040 (g)). No figure changes; the two sentences that said "pending" a ruling (the tab's
   harvest card, the harvest slide) now state the rule (stage S9 of part T5, KI-182). Stage S10 then took "as the owner
   has ruled" out of the tab's sentence, which now says "as the reckoner is silent on them" (FDR-A F7: an analyst may
   show the screen to a client, who may read "the owner" as the portfolio's owner); the slide's sentence names no owner.
**Measured effect (question 17, the standard synthetic sample book).** No tax, LTCG, STCG, estimated tax, saving,
harvest or total CMV moves. The Listed AIF's CMV and Gain/Loss move out of "not classified" into a "Fund level" amount:
the not-classified CMV 2.7051 Cr becomes 2.0535 Cr, the not-classified gain 0.8051 Cr becomes 0.6535 Cr, and Fund
level shows a new 0.6516 Cr (gain 0.1516 Cr). The Left-out lists name the AIFs by what they are treated as.
**Alternatives.** Keep Category I or II for a Listed AIF (the default of part T3; the answer replaces it). Treat every
Listed AIF as Category III with no note (rejected: the owner asked for a safe note, and the performance data states no
category). Let the label override a category the fund states itself (not taken: step 1 is the conservative reading and
keeps a stated Category I or II as pass-through; the owner confirmed on 2 Nov 2026 that the fund's own statement wins).
Count the entry's Listed AIF label through any match that the loose name matcher makes (the lead's reading of the
answer to question 17, built until stage S10; the owner restricted it on 9 Nov 2026). Keep step 2 at the strict same
name while step 3 ignores "AIF" and brackets (stage S10 as first built; not taken: ARC-01's pre-check of stage S10
found the Category III entry written "Name AIF" read as an assumed Category I or II, the wrong direction and
inconsistent with step 3).
**Consequences.** Amends D-040 (d); D-040 (g) and question 18 are unchanged. The tests that asserted the old reading
move with it: `KI-171-aif-cat-i-ii.js` (the sample book's Listed AIF is Category III, fund level) and
`KI-180-debt-row-section.js` (every TAX_RULES row is still reached, with an equity Category II case added; the sample
book's totals as above). A new `CR-0008-T5-item10-listed-aif.js` pins the four steps, the debt and long-short rows and
every surface; `KI-182-crypto-no-set-off.js` follows the new wording of the crypto sentences. Stage S10 (question 24)
changes step 3 of the reader and one sentence of the tab: the item 10 file pins the loose link and the spellings of the
entry's name and checks each of the 11 genuine entries through the classifier and through the real matcher (116
checks), and `KI-182-crypto-no-set-off.js` follows the tab sentence that no longer cites the owner (33 checks). Stage
S11 (ARC-01's pre-check of stage S10) applies the same name equality to step 2; the item 10 file has 119 checks (three
more: the Category III entry through the classifier and through the real matcher, and fixture entries that state
Category II and Category III Long Short). The new build ports the same four steps, with the same name equality ("AIF"
and brackets ignored) for step 2 and for step 3 as restricted, when it ports AIF treatment (M7). D-042 is reserved for
fix batch 5.
**The owner's sign-off of the tax batch, 25 Nov 2026 (~19:30 IST; relayed by MOD-04).**
- PD-01: the eight defaults of D-040, (a) to (h), are accepted as built.
- PD-04 and PD-44: "Accept all". This covers the built defaults for CR-0008 questions 2 to 11, 13 to 16, 19 and 20 and
  the other defaults settled while building. MOD-04 summarised them for the owner as 24 items, the last two being stage
  S12's foreign bonds and offshore shares.
- PD-54: stage S12's word-for-word key for the name equality (letter case, punctuation, brackets and the word "AIF"
  ignored; no word dropped, replaced or de-duplicated) is within the 9 Nov answer "Restrict it".
- Bonds: no tax figure for a bond whose Product or Category names a US-dollar or LRS route is acceptable for now. Under
  the owner's LP-16 label that is every bond, NCD and debenture, each shown with its reason.
- For the tax adviser: questions 2, 3, 13, 14, 15 and 27.
- Publish: "Publish when green".
- Questions 23, 25 and 26 were not part of this sign-off and stay as recorded in CR-0008.
