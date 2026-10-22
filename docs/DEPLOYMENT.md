# Deployment

The dashboard is one static file. "Deploying" means making `index.html` available to analysts.

- Repository: https://github.com/productsteamcentricity/portfolio-review-dashboard (**public**, D-008)
- Site: https://productsteamcentricity.github.io/portfolio-review-dashboard/

## Channels
1. **GitHub Pages** (owner's choice, D-007, amended by D-024): `.github/workflows/pages.yml` publishes **two files
   and nothing else**: `index.html` at `/` (the legacy dashboard, byte for byte) and, from milestone M1.2 of the new
   build, the new app's one-file build at `/next/` (`next/index.html`, built from `app/`) with a "Preview, not for
   client use" banner. Docs are never served. It runs on a push to `main` that changes `index.html`, `app/`, the npm
   files (`package.json`, `package-lock.json`, `.npmrc`), `scripts/build.mjs`, `scripts/validation/check-next.mjs`
   or the workflow itself, and on manual dispatch. Its build job (read-only rights) runs the legacy gates
   (`tools/check-invariants.js`, `tools/smoke-review.js`, `tools/run-regression.js`), then `npm ci`, the new app's
   build and `scripts/validation/check-next.mjs --rebuild`, and stages both files; any failure stops the deployment
   (while the preview has no users a failing new build also blocks a legacy fix: fix forward). Only the separate
   deploy job, which runs no repository code, can write to Pages.
2. **The file itself**: analysts can open `index.html` from SharePoint/Teams or a local copy. It works
   fully offline.

## Who can see what
- The **repository is public**: anyone can read the code, the docs and the embedded data on github.com.
  Never commit client data, credentials or anything meant to stay internal.
- The **Pages site is public** and serves the dashboard and, at `/next/`, the new application's preview, nothing
  else. The preview carries no client data and no MF Screener data (D-026): both are uploaded in the browser.
- `index.html` embeds licensed vendor data, Centricity's advisory logic and third-party logos (as the
  previous owner's public site already did). The owner confirmed on 22 Oct 2026 that the licence allows
  publishing every Accord file, the monitor files included (D-023, D-026). Client data is never in the
  file: it is uploaded in the browser and never leaves it.
- If the repository is ever made private, Pages from a private repository needs a paid plan
  (GitHub Pro for a personal account, Team/Enterprise for an organisation).

## One-time setup
1. Pages source = **GitHub Actions**: Settings → Pages → Build and deployment, or
   `gh api -X POST repos/productsteamcentricity/portfolio-review-dashboard/pages -f build_type=workflow`.
   If a push reaches `main` before Pages is enabled, that Pages run fails at "configure-pages" —
   expected; re-run it after enabling.
2. Actions → "Publish dashboard to GitHub Pages" → Run workflow, if no deployment has run yet.
3. Branch protection: **not used.** The owner declined a ruleset on `main` and gave Claude full charge of
   GitHub and the dashboard (D-033, 22 Oct 2026). The rules in `CLAUDE.md` (pull requests, green CI before a
   merge, never force-push or delete branches) are followed by practice, and acceptance case AC-22 of the new
   build checks the history for force-pushes.

## Verify a deployment
The published file must be byte-identical to the commit's `index.html`:
```powershell
(Get-FileHash index.html -Algorithm MD5).Hash
$p = "$env:TEMP\pages_check.html"; curl.exe -sSL -o $p "https://productsteamcentricity.github.io/portfolio-review-dashboard/"; (Get-FileHash $p -Algorithm MD5).Hash; Remove-Item $p
```
Then open the URL, check the console is clean and the sidebar data dates are the expected ones.

The preview at `/next/` must be byte-identical to a build of the same commit (`npm ci`, `npm run build`; the build
prints the SHA-256, and so does the Pages build log):
```powershell
(Get-FileHash app\dist\index.html -Algorithm SHA256).Hash
$p = "$env:TEMP\pages_next_check.html"; curl.exe -sSL -o $p "https://productsteamcentricity.github.io/portfolio-review-dashboard/next/"; (Get-FileHash $p -Algorithm SHA256).Hash; Remove-Item $p
```
Then open `/next/`: the "Preview, not for client use" banner shows, the console is clean and the Network panel lists
the page only (`docs/new-build/toolchain.md`, section 9).

## Roll back
Revert the offending commit on `main` (`git revert <sha>`, PR, merge); the workflow republishes the
previous `index.html` and rebuilds the previous `/next/`. Never force-push `main`.

## The previous site
The previous owner's site (GitHub Pages on their personal account; the address is in their handover,
kept privately) still serves build `cab22e6` and **stays live until the new build has been fully tested**
(owner's decision, 15 Oct 2026). Retiring it is a separate, later step for the owner to schedule.
