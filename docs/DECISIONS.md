# Decision register

Newest last. Each decision records context, the choice, alternatives and consequences. A later
decision that changes an earlier one says "Supersedes D-xxx". Decisions taken by the previous owner
(May–Oct 2026) are summarised in `reference/PROJECT_HISTORY_Portfolio_Review_Dashboard.md` and the
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
**Context.** The source repo (`magazineishita1108-boop/Portfolio_Review_Dashboard`, public, 1 branch,
no tags) has client names in three commit messages (per the handover) and is public.
**Decision.** Do not import the old history. The baseline commit records its provenance (source repo,
commit `cab22e6747c02b87f0f95466874b3209edc5da22`, `index.html` MD5) in its message and in
`REPLICATION_REPORT.md`. **Consequence.** `git log` starts on 14 Oct 2026; earlier history is in
`docs/reference/PROJECT_HISTORY_Portfolio_Review_Dashboard.md`.

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
