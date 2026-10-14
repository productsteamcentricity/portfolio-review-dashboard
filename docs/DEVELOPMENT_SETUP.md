# Development setup

The dashboard itself needs only a browser: double-click `index.html`. Everything below is for
maintaining it (tests, previews, data refreshes, git).

## Prerequisites
| Tool | Version in use | Notes |
|---|---|---|
| Windows 11 | — | PowerShell 5.1 is the default shell |
| Node.js | 24.21.0 LTS | built-ins only; **no `npm install`** |
| Git | 2.56.0.windows.2 | `core.autocrlf=false` (see below) |
| GitHub CLI `gh` | 2.102.0 | repo creation, PRs, Pages settings |
| Chrome or Edge | current | the analysts' browser |
| Microsoft PowerPoint | — | only for exporting the monthly Outlook slides to JPEG and for visual deck checks |
| Python | 3.14 (already installed) | optional; not used by the project |

On this laptop the three dev tools are portable builds in `C:\dev\tools\{node,git,gh}` (owner-approved,
checksums verified, D-006), on the **user** PATH as `C:\dev\tools\node`, `C:\dev\tools\git\cmd`,
`C:\dev\tools\gh\bin`. A program that was already running when PATH changed (for example the Claude
desktop app) does not see it until restarted; in such a session prefix commands with
`$env:Path = 'C:\dev\tools\node;C:\dev\tools\git\cmd;C:\dev\tools\gh\bin;' + $env:Path`.

To set up a fresh machine: install Node.js 24 LTS and Git for Windows (official installers, or the same
portable builds), then:

```powershell
git config --global core.autocrlf false
git clone https://github.com/productsteamcentricity/portfolio-review-dashboard.git C:\dev\portfolio-review
```

Keep the clone **outside OneDrive** (OneDrive corrupts `.git`). Sign in once with
`gh auth login --web --scopes workflow` and `gh auth setup-git` (the `workflow` scope is needed to push
changes to `.github/workflows/`). Set the commit identity per repository — the repository is public, so
use the account's noreply address, never a personal email:

```powershell
git config user.name "Products Team Centricity"
git config user.email "342556594+productsteamcentricity@users.noreply.github.com"
git config user.useConfigOnly true
```

## Verify a checkout
```bash
node tools/check-invariants.js
node tools/smoke-review.js
```
Both must end "all … passed/hold". If the MD5 printed by `check-invariants` differs from the commit
you expect, the checkout was altered (usually by line-ending conversion): fix the checkout, not the file.

## Run the dashboard locally
- Double-click `index.html`, or
- `node serve-dashboard.js` and open http://127.0.0.1:8099 (bound to localhost only), or
- in Claude Code, the preview configuration `dashboard` in `.claude/launch.json`.

Synthetic test files: `node tools/make-sample-base.js` writes `test-data/Sample_Base_File.xlsx` and
`test-data/Sample_IRR_Transactions.xlsx` (git-ignored, no client data).

## Reading the code
`node tools/extract-blocks.js` writes the engine, exporters, parsers, UI and boot scripts plus the page
shell to `.blocks/` (git-ignored). Search and cite those (`07_engine.js:736`). Never search or open
`index.html` directly: it has 10 MB lines and raw NUL bytes, so editors struggle and grep stops early.

## Claude Code
Open sessions in `C:\dev\portfolio-review` so `CLAUDE.md`, `.claude/launch.json` and the agents in
`.claude/agents/` load. Machine-local permissions go in `.claude/settings.local.json` (git-ignored).

## Where the data lives
- Vendor workbooks (licensed, never committed) are kept on OneDrive. The archive received at handover is
  extracted at `…\Desktop\Claude Code-Portfolio Review Dashboard\For Centricity Portfolio Review Portal\`
  with one folder per month (Apr–Sep 2026); the refresh pipeline finds files by name prefix.
- Client base files and IRR sheets stay on the analysts' machines / SharePoint, never in the repo.

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| `node` or `git` not recognised | PATH not picked up yet: open a new terminal, restart the app, or use the per-command prefix above |
| MD5 differs right after clone | line endings converted: check `git config core.autocrlf` is `false`, re-clone |
| A `node -e "...require('./tools/engine-host.js')..."` one-liner throws inside PptxGenJS | run it from a script file (KI-011) |
| grep finds nothing in the UI code | search `.blocks/` (NUL bytes make tools treat `index.html` as binary, KI-025) |
| `@babel/polyfill is loaded more than once` printed by a tool | harmless: the PptxGenJS bundle was evaluated twice in one Node process |
| Browser pane cannot download the deck | capture the blob instead (docs/TESTING.md §4) or use a normal browser |
