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
still applies to `index.html`. The lead confirmed this exemption on 22 Oct 2026 (D-033), and a test pins it: the
committed allow-list exempts `index.html` and no other path (`tests/validation/privacy-scan.test.mjs`).

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
# the tests
node --test "tests/**/*.test.mjs"
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
   monthly files, CR-0006; it does not exist yet), files already tracked on the base (existing assets), and
   paths listed in `binaryAllowPaths` of the allow-list.
4. A **summary**: commits, files, lines scanned, whether the deny-list was applied, and PASS or REFUSED.

If `origin/main` is missing or stale, run `git fetch origin` first; a missing base is an error, never a pass.

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
scan of `docs/` and the root Markdown with the generic rules (the deny-list is local only), the link check, and
the tests under `TZ=Asia/Kolkata` and `TZ=UTC`. The existing `checks` job (the legacy app) is unchanged.

## Limits

- Text only. The contents of office files, PDFs and images are not read; M11 adds that and the rules for file
  classes under `monthly_updates/`.
- The rules are patterns. They find likely leaks; they do not prove a file is clean. The review of the staged
  diff (`security-release-reviewer`) still applies.
- Commits already on GitHub are not changed. The history before this change still holds the previous owner's
  account address and one merge author address (KI-098); history is never rewritten.
