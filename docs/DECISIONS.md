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
1. **Publication.** The vendor licence allows publishing the monitor files. Approved monthly source files will be
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
