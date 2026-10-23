# Safety tooling (new build, milestone M1.1)

The repository is public: everything pushed is world-readable and stays in history. These scripts stop client
data, names, secrets and personal identifiers before they are pushed. They use Node 24 built-ins only (no
`npm install`) and live in `scripts/validation/`; their tests are in `tests/validation/`.

| Script | Does | Exit |
|---|---|---|
| `privacy-scan.mjs` | scans files, folders or only the changed lines of a diff for the rules below | 0 clean or warnings only, 1 a blocking hit, 2 usage error |
| `docs-links.mjs` | checks that every relative link and `#anchor` in the root `*.md` and `docs/**/*.md` resolves | 0 all resolve, 1 a broken link, 2 usage error |
| `prepush-scan.mjs` | everything to check before a push: privacy, file size, new binary files; prints a summary | 0 pass, 1 refused, 2 error |
| `scripts/hooks/pre-push` | git hook that runs `prepush-scan.mjs` for every branch or tag being pushed | non-zero refuses the push |
| `release-check.mjs` | the state a release (of the legacy page or of `/next/`) must be in before it is merged: remote, default branch, branch, clean tree, the legacy page's patch-script rule, push evidence; prints a report for the pull request | 0 pass or warnings only, 1 a failed check, 2 usage error or base not fetched |
| `monthly-prd-check.mjs` | a monthly PRD in `docs/monthly-prds/` has the template's sections A to I, no placeholder left, working links, no privacy or deny-list hit, and a handover refreshed in the same cycle | 0 pass, 1 a problem, 2 usage error or a template without A to I |

## Privacy rules

Output is one line per hit, `path:line:rule`, then `BLOCK` or `warn` and the reason. The matched text is not
printed unless you add `--show`, and secrets stay masked even then.

| Rule | Severity | Finds | Allowed |
|---|---|---|---|
| `email` | block | e-mail addresses | no-reply senders (`noreply@…`), the organisation's GitHub no-reply address, `git@github.com`, documentation domains (`example.com`, `*.example`, `*.test`, `*.invalid`), file names such as `logo@2x.png` |
| `pan` | block | Indian PAN pattern (five letters, four digits, one letter; fourth letter a holder type) | |
| `digit-run` | warn | 9 to 18 digit runs in a table row, a tab-separated line or right after "folio", "account", "demat" or "client id" (folio or account numbers) | decimals, hashes, numbers in prose |
| `github-token` | block | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_` tokens | the bare prefixes |
| `aws-key` | block | `AKIA…` access key ids | |
| `private-key` | block | `-----BEGIN … PRIVATE KEY-----` blocks | public keys |
| `password` | block | `password=` / `passwd=` / `pwd=` with a value | empty values, placeholders (`<…>`, `${…}`, `%…%`), code such as `password = form.value`, prose |
| `user-path` | block | `C:\Users\<name>`, `C:/Users/<name>`, `/c/Users/<name>`, `/mnt/c/Users/<name>` | placeholders: `<name>`, `%USERNAME%`, `Public`, `Default` |
| `onedrive-path` | block | an `OneDrive - <organisation>` folder inside a path | the placeholder `<organisation>` |
| `github-account` | block | URLs of GitHub accounts (`github.com/<account>`, `<account>.github.io`, raw and gist links) | accounts in the allow-list |
| `denylist` | block | a name on the private deny-list (below) | allowed phrases in the private file |

**Allow-list (public):** `scripts/validation/privacy-allowlist.json` lists the GitHub accounts that may appear
(the organisation, GitHub's `actions`, and the open-source libraries embedded in `index.html`), the generic
e-mail addresses, the binary paths approved for the push check, and exceptions (rule, path, exact text and a
reason). Every entry says why. It never holds a client, family or person name.

**Deny-list (private):** a text file outside the repository, read from the path in the environment variable
`PRD_PRIVACY_DENYLIST`. On the owner's laptop it is `C:\dev\private\privacy-denylist.txt`. One term per line,
matched case-insensitively as a whole word; `#` starts a comment; a line starting with `!` is an allowed phrase
(a public company or fund name that contains a listed name). **Never copy it, or any term from it, into the
repository.** Without the variable only the generic rules run, and every report says "deny-list NOT applied"
(that is the case in CI). If the variable is set but the file cannot be read, the scan stops with exit 2.
`index.html` is exempt from the deny-list only: its embedded reference data names listed companies and fund
managers who share names with it. Client holdings never enter `index.html` (they are uploaded at run time),
and each code change reaches it through a patch script in `tools/patches/`, which is scanned. Every other rule
still applies to `index.html`. The lead confirmed this exemption on 22 Oct 2026 (D-033), and a test pins it
(`tests/validation/privacy-scan.test.mjs`): the committed allow-list exempts `index.html` and, from M1.3, the
generated reference-data files below, and no other path.
**Milestone M1.3 (confirmed by the lead on 23 Oct 2026, D-035):** the reference-data files that `scripts/data-extract.ts` writes
from the same embedded data (`data/refdata/<BLOCK>.json`, one per block) are exempt for the same reason, each by its
exact path. `tests/parity/refdata.parity.test.ts` proves each file equal to the block in `index.html` and checks that
the exempt paths under `data/refdata/` are exactly the extractor's block files; `data/refdata/README.md` and
`VINTAGE.json` stay under the deny-list, and every generic rule still applies to all of them.

## Running them

```bash
# whole files or folders
node scripts/validation/privacy-scan.mjs docs README.md
# only the lines a change adds
node scripts/validation/privacy-scan.mjs --staged
node scripts/validation/privacy-scan.mjs --diff origin/main
# links
node scripts/validation/docs-links.mjs
# before a push (what the hook runs): the commits in origin/main..HEAD
node scripts/validation/prepush-scan.mjs
# before a pull request is merged: the release state; after the push, with the evidence from the remote
node scripts/validation/release-check.mjs --online
node scripts/validation/release-check.mjs --after-push
# a monthly PRD and its handover, at the end of each monthly cycle
node scripts/validation/monthly-prd-check.mjs
# the tests
node --test "tests/**/*.test.mjs" "tests/**/*.test.ts"
```

With the deny-list, in PowerShell: `$env:PRD_PRIVACY_DENYLIST = 'C:\dev\private\privacy-denylist.txt'` for the
session, or once for the user account:
`[Environment]::SetEnvironmentVariable('PRD_PRIVACY_DENYLIST', 'C:\dev\private\privacy-denylist.txt', 'User')`
(open a new terminal afterwards). In Git Bash: `export PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt`.

## What the pre-push scan checks

For the commits that would be pushed (from `origin/main`, or `--base <ref>`, to `HEAD`, or `--head <ref>`):

1. **Privacy** on every added text line, both in the net change and in each commit on its own (something added
   and removed again before the push is still published in history), and on every commit message and author
   and committer identity.
2. **Size:** any file over 50 MB is refused (`--max-mb` changes the limit). GitHub warns at 50 MB and rejects
   100 MB. The 50 MB limit stays (lead, 22 Oct 2026, D-033).
3. **New binary and data files** are refused: `xlsx`, `xls`, `csv`, `pptx`, `pdf`, `zip`, `png`, `jpg`, and the
   other office and data formats `.gitignore` blocks (`jpeg`, `xlsm`, `xlsb`, `ods`, `tsv`, `ppt`, `pptm`,
   `docx`, `doc`, `msg`, `7z`). Allowed: anything under `monthly_updates/YYYY-MM/` (the folder for approved
   monthly files, CR-0006; only its README and `_policy/` exist until M11), files already tracked on the base
   (existing assets), and paths listed in `binaryAllowPaths` of the allow-list.
4. A **summary**: commits, files, lines scanned, whether the deny-list was applied, and PASS or REFUSED.

If `origin/main` is missing or stale, run `git fetch origin` first; a missing base is an error, never a pass.

## What the release check checks

`release-check.mjs` reads the repository and never changes it, its remotes or the git configuration (brief Phase 1,
BR-1.1). Run it on the branch to be released, before the pull request is merged, and attach its report to the pull
request. Each line is PASS, WARN, FAIL or SKIP; any FAIL exits 1.

| Check | Fails when | Warns when |
|---|---|---|
| `remote-url` | `origin`'s fetch or push URL is not the recorded repository (`productsteamcentricity/portfolio-review-dashboard` on GitHub, in any URL form), or carries a user name or token (never printed) | |
| `default-branch` | the remote's default branch is not `main` (read from `refs/remotes/origin/HEAD`; `--online` asks the remote) | it is not known locally |
| `base` | | with `--online`, `origin/main` is not the remote's `main` (run `git fetch origin`) |
| `branch` | HEAD is detached, or on `main` | the name does not follow `feature/`, `feat/`, `fix/`, `docs/`, `chore/`, `data/` or `test/` |
| `working-tree` | anything is staged, modified, untracked or unmerged | |
| `commits` | | the branch is not ahead of `origin/main`, is behind it, or a commit subject has no conventional prefix |
| `local-files` | the change adds a local or generated file (`test-data/`, `.blocks/`, `buildtools/out/`, `dist/`, `.env`, backups, an exported client deck name …) | |
| `legacy-page` | `index.html` changed without a patch script in `tools/patches/` in the same change and not on a `data/` refresh branch (`CLAUDE.md` rule 1); with `--expect-md5`, its MD5 at HEAD differs | |
| `records` | | `CHANGELOG.md` or `docs/PROJECT_STATE.md` did not change |
| `identity` | | `user.useConfigOnly` is off (`CLAUDE.md` rule 8) |
| `pushed` | with `--after-push`: the branch is not on the remote, or the remote has another commit than HEAD | |

The report ends with the change: commits, files by area (legacy page, legacy tooling, new application, monthly folder,
scripts and CI, tests, documentation) and `git diff --stat` against `origin/main`. A legacy release that changes
`index.html` still needs the legacy suites and the browser acceptance of `docs/TESTING.md` before it is merged.

## What the monthly PRD check checks

`monthly-prd-check.mjs` checks every `docs/monthly-prds/YYYY-MM-Portfolio-Review-PRD.md` (or the files given):
the file name and the title's data month; the nine section headings of `TEMPLATE.md`, exactly as written, once each, in
order and none empty (the headings are read from the template, so the two cannot drift); no template placeholder left
(`<…>` in prose, a code span holding only `<…>`, `YYYY-MM`, `DD Mon YYYY`); every relative link and anchor; the privacy
rules, with the private deny-list when `PRD_PRIVACY_DENYLIST` is set; and the handover (`docs/HANDOVER.md`, or
`--handover`): its "**Last refreshed:**" date is on or after the "cycle completed" date of the PRD's Cycle line, and for
the newest cycle it names the latest commit of section I. `--no-handover` skips the handover for a draft. With no
monthly PRD yet it passes and says so.

## Enabling the hook

The hook is in the repository but git does not use it until you say so, once per clone:

```bash
git config core.hooksPath scripts/hooks
```

From then on every `git push` runs the scan and is refused when it finds a problem. Git runs the hook with its
own `sh`, so `node` must be on the PATH that git sees (on this laptop the toolchain in `C:\dev\tools` is on the
user PATH), and `PRD_PRIVACY_DENYLIST` must be set for the user account (above) for the deny-list to apply.
When a push is refused, remove the finding from the local commits before pushing again. Do not bypass the hook
(`--no-verify`) for client data, names or secrets: what is pushed cannot be taken back.

## In CI

The `next` job of `.github/workflows/ci.yml` runs on every pull request and every push to `main`: the privacy
scan of `docs/` and the root Markdown with the generic rules (the deny-list is local only), the link check, the
monthly PRD check, then the new application's steps from M1.2 (`npm ci`, the type check, the build and
`check-next.mjs --rebuild`; [toolchain.md](toolchain.md)), the tests under `TZ=Asia/Kolkata` and `TZ=UTC`, and last
the release check with `--ci`. The checkout is shallow, so a step fetches `main` first. In its CI form the release check takes the branch from
`GITHUB_HEAD_REF` (a pull request) or `GITHUB_REF_NAME` (a push), the default branch from the event, treats a push to
`main` as the merged state, and skips the identity check; it runs after the tests, so a test that leaves a file in the
working tree fails it. The existing `checks` job (the legacy app) is unchanged.

## Limits

- Text only. The contents of office files, PDFs and images are not read; M11 adds that and the rules for file
  classes under `monthly_updates/`.
- The rules are patterns. They find likely leaks; they do not prove a file is clean. The review of the staged
  diff (`security-release-reviewer`) still applies.
- Commits already on GitHub are not changed. The history before this change still holds the previous owner's
  account address and one merge author address (KI-098); history is never rewritten.
