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
   Amended by D-039 point 15 (27 Oct 2026, M1.4): a section opened from its tab places its review bar, not its
   heading, 16 px below the pinned header, with the focused heading under the bar.
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
AG-14, no regression). KI-147 (the reader's money columns) was left for M1.4 by D-035. The same day the browser QA
and the financial, Office and security reviews of the integrated branch found defects; the lead's fix round
(CR-0006) amends points 1, 2, 3, 5, 6, 7, 8, 9 and 12 and adds points 13 to 15. In that round the lead decided the
display rounding (point 13), the raw label as join key (point 3), the letter case of client and distributor labels
(point 3), the workbook's money format and share row (point 5), the pie label threshold (point 6), the file's own
gain or loss (point 1(e)) and the Read Me wording (point 7).
**Decision.**
1. **Money columns (KI-147).** `MONEY_COLUMN_RULE` (`app/src/config/money-columns.ts`) is
   `{ invalidText: 'invalid-source', crossCheckToleranceCr: 0.005 }`. The reader takes the Crore column, then Lakh,
   then rupees, and acts on the column it would use:
   (a) **the owner's answer, 24 Oct 2026, "no fallback"**: text that is not an amount (a percent included) makes the
   amount INVALID SOURCE DATA. No later column is read in its place. A holding whose market value is invalid is
   excluded and listed (OD-8), with the Warning `base-file.money-invalid`, scoped to the holdings, naming the column
   and the rows. An invalid invested value leaves the holding included without one (counted in
   `totals.counts.invalidInvested`);
   (b) the lead's decision: a blank Crore cell is not text, so the reader takes the Lakh, then the rupee column, with
   the Information notice `base-file.money-column-used` naming the column used and the column passed over;
   (c) the lead's decision: a placeholder in the Crore cell ("NA", "N/A", "-", "nil" and the rest of the reader's
   placeholders) counts as blank, and `base-file.money-column-used` names the placeholder;
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
   and absolute return cover the 4 of 6 holdings that have an invested value." ("that has" for one).
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
4. **Single client or distributor (OD-21) across outputs.** With fewer than two clients (or distributors) holding
   included holdings, the screen hides that matrix behind one line, and the workbook leaves out its sheet; the Read
   Me says why.
5. **The workbook.** Sheets in order: Read Me and Controls, Source Register, Holdings (as loaded), Portfolio
   Overview, Client Allocation and Distributor Allocation (only when shown), Audit Log and a hidden, protected
   `_manifest`. Portfolio Overview is one table with a Block column (asset and product rows, the Grand Total, the
   liquidity rows, the liquidity percent always in the % CMV column). Every aggregate is a SUMIFS over the holdings,
   with criteria only on canonical asset classes, the generated keys (P01, L01, C01, D01; C00 and D00 when not given)
   and Yes/No flags; its cached value is the view-model's figure. A missing value is a blank cell with its status,
   never a formula. Cambria 9; money in Indian grouping through the units' conditional pattern
   `[>=10000000]##\,##\,##\,##0.00;[>=100000]##\,##\,##0.00;##,##0.00` (the lead's decision, fix round: a Lakh book
   above 1,00,000 L reads as on screen; Excel allows two conditions, so amounts at or below -1,00,000 and from
   99,999.995 to 99,999.999 fall in the third section and take the system locale's grouping); percent `0.00"%"`;
   units in Indian grouping; dates `d mmm yyyy`; negatives in #931621 by conditional formatting; thin #D9D9D9
   borders; inline strings with a quote prefix when they start with = + - @, a tab or a carriage return; values
   unrounded with number formats. `_manifest` lists each formula's hash and the cell of each view-model figure (the
   cross-output join).
   **Fix round.** (a) The lead's decision: the "Share of family (%)" row of Client and Distributor Allocation stays
   below the Grand Total but outside the autoFilter range, its `_xlnm._FilterDatabase` name and the negative red
   (`SheetSpec.tableRows`). (b) The Exclusion Reason of Holdings (as loaded) follows the market value's status, as
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
   (point 3) is listed in the validation panel and the Audit Log and makes no note.
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
13. **Display rounding (the lead's decision, fix round).** Every figure is shown by one formatter
    (`views/format.ts`: `excelFixed`, `displayRounded`, `formatIndian`). It rounds as Excel shows a cell: first to 15
    significant digits, then half up on that decimal, on the decimal digits and never on the binary double. So 1.005
    shows 1.01, 0.145 shows 0.15, 2.675 shows 2.68, -1.005 shows -1.01, and 35.67499999999998 (family-a's Hybrid
    absolute return, (0.5427 - 0.4) / 0.4 x 100) shows 35.68%. A value that rounds to zero is shown without a sign;
    Excel shows -0.00, and the Office check ignores only that sign. The Office acceptance compares Excel's
    `Range.Text` of every `_manifest` figure with the screen's text. At half-way values the text differs from the
    legacy page, which rounds the binary value (0.145 shows 0.14 there).
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
    holding" in both the note and the line, never "Single client".
15. **Focus and the review bar (fix round).** The focus never falls to the body. After a pick or Remove it goes to
    the new file input. Accept and the downloads are `aria-disabled` (`aria-busy` while a file is prepared), not
    disabled, and ignore clicks while not available. An answered XIRR question moves the focus to the next question,
    else to the import report heading; an acknowledged result moves it to the next Acknowledge, else to the
    validation heading. Opening a section from its tab places the review bar 16 px below the pinned header, with
    the focused heading under it; where nothing is pinned (52rem or less) the review bar is 16 px from the top. This
    amends the wording of D-037 point 1.
**Alternatives.** The fallback to the Lakh value, flagged on the holding (the lead's earlier default for KI-147;
rejected by the owner); the legacy asset order Equity, Hybrid, Debt in the matrices (rejected: no record supports it);
PowerPoint's own pie labels with its separator and rounding (rejected: the slide would not show the screen's text);
rounding with `toFixed` on the binary double (the first M1.4 formatter; rejected in the fix round: screen and slide
differed from Excel's text at half-way values); folding the letter case of client and distributor labels (the M1.3
reader's rule; rejected in the fix round until the owner answers: it changed client numbers against the legacy with
no ledger entry); the money format `#,##0.00` (rejected in the fix round: a Lakh book above 1,00,000 L read in
Western grouping in Excel only).
**Consequences.** KI-147 is fixed in the new app; KI-007, KI-020, KI-021, KI-071, KI-078, KI-084, KI-087, KI-089,
KI-091, KI-092, KI-093, KI-094 and KI-150 are fixed there too (the legacy page is unchanged, D-028). `DATA_DICTIONARY.md` §5.3, §5.8, §5.13 and §6,
`ARCHITECTURE.md` §14 and §15 and `deck-design-system.md` describe the rules; the parity ledger lists the corrections
that change client numbers. The fix round adds its tests: `tests/unit/views/rounding.test.ts` against an oracle
written apart (`tests/helpers/excel-text.ts`), `tests/regression/ki-147-money-notes.test.ts`,
`tests/unit/ingest/entity-case.test.ts`, `tests/exports/xlsx/dash-labels.test.ts` and `acceptance-cases.test.ts`,
`tests/exports/pptx/c08-wired.test.ts`, `tests/unit/ui/pie-config.test.ts` and `upload-slot.test.ts`, the
legacy-minus-new check of AG-01 and AG-13 in `tests/parity/aggregation.parity.test.ts`, and the cross-unit tests
`tests/integration/upload.test.ts` (U-04), `as-on-change.test.ts` (U-05), `tests/workflows/w-01-load-family.test.ts`
(W-1) and `tests/acceptance/ac-01-standard-review.test.ts` (AC-01: family-a, family-a-lakh and family-a-rupee end to
end against sums of the file's own money column), with the browser check `tests/browser/overview.cdp.mjs`. The
case-variant and dash-label fixtures show no difference from the legacy beyond AG-11.
