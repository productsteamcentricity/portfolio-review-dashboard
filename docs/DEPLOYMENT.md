# Deployment

The dashboard is one static file. "Deploying" means making `index.html` available to analysts.

- Repository: https://github.com/productsteamcentricity/portfolio-review-dashboard (**public**, D-008)
- Site: https://productsteamcentricity.github.io/portfolio-review-dashboard/

## Channels
1. **GitHub Pages** (owner's choice, D-007): `.github/workflows/pages.yml` publishes **only
   `index.html`** whenever a push to `main` changes it (or on manual dispatch). Its build job (read-only
   rights) runs `tools/check-invariants.js` and `tools/smoke-review.js` and stages the file; a failure
   stops the deployment. Only the separate deploy job, which runs no repository code, can write to Pages.
2. **The file itself**: analysts can open `index.html` from SharePoint/Teams or a local copy. It works
   fully offline.

## Who can see what
- The **repository is public**: anyone can read the code, the docs and the embedded data on github.com.
  Never commit client data, credentials or anything meant to stay internal.
- The **Pages site is public** and serves the dashboard only.
- `index.html` embeds licensed vendor data, Centricity's advisory logic and third-party logos (as the
  previous owner's public site already did). The owner confirmed on 22 Oct 2026 that the licence allows
  publishing the vendor monitor files (D-023). Client data is never in the file: it is uploaded in the
  browser and never leaves it.
- If the repository is ever made private, Pages from a private repository needs a paid plan
  (GitHub Pro for a personal account, Team/Enterprise for an organisation).

## One-time setup
1. Pages source = **GitHub Actions**: Settings → Pages → Build and deployment, or
   `gh api -X POST repos/productsteamcentricity/portfolio-review-dashboard/pages -f build_type=workflow`.
   If a push reaches `main` before Pages is enabled, that Pages run fails at "configure-pages" —
   expected; re-run it after enabling.
2. Actions → "Publish dashboard to GitHub Pages" → Run workflow, if no deployment has run yet.
3. Protect `main` (recommended): Settings → Rules → new branch ruleset for `main`: require a pull
   request and the status check "Dashboard checks / checks", block force-pushes and deletion. The rules
   in `CLAUDE.md` assume this.

## Verify a deployment
The published file must be byte-identical to the commit's `index.html`:
```powershell
(Get-FileHash index.html -Algorithm MD5).Hash
$p = "$env:TEMP\pages_check.html"; curl.exe -sSL -o $p "https://productsteamcentricity.github.io/portfolio-review-dashboard/"; (Get-FileHash $p -Algorithm MD5).Hash; Remove-Item $p
```
Then open the URL, check the console is clean and the sidebar data dates are the expected ones.

## Roll back
Revert the offending commit on `main` (`git revert <sha>`, PR, merge); the workflow republishes the
previous `index.html`. Never force-push `main`.

## The previous site
The previous owner's site (GitHub Pages on their personal account; the address is in their handover,
kept privately) still serves build `cab22e6` and **stays live until the new build has been fully tested**
(owner's decision, 15 Oct 2026). Retiring it is a separate, later step for the owner to schedule.
