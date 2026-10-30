# Repository and environment state

Snapshot: **28 Oct 2026 (IST)**, taken read-only by MOD-01 and its investigators (no fetch, checkout, stash, prune or write in any
repository or worktree). Maintained by **MOD-02** with **ARC-01**.

**Do not trust this snapshot blindly.** Git is the authority. Run the [verify-before-you-trust block](#verify-before-you-trust) first and
record any difference in [INTEGRATION_AND_REGRESSION_LOG.md](INTEGRATION_AND_REGRESSION_LOG.md).

**Evidence labels:** [VERIFIED] (command given), [INFERRED], [UNCERTAIN], [UNKNOWN]. Sources: `git`, `gh` (read-only API) and `curl` on
28 Oct, unless a line says otherwise.

## Anchors

| Anchor | Value | Evidence |
|---|---|---|
| main = origin/main | **6443826** "Merge pull request #16 from productsteamcentricity/fix/legacy-batch-4-basefile-r2" (27 Oct 18:13 IST) | [VERIFIED: `git rev-parse`, `git ls-remote origin`] |
| Live page `/` | **16,837,249 bytes, MD5 12B5E5727FCA01EF2EA162C59913F01D**, equal to `git show origin/main:index.html`. Pages last modified 27 Oct 2026 12:44:48 GMT | [VERIFIED: curl download and MD5 by the repo-env investigation, 28 Oct; Pages verified 27 Oct after the merge] |
| Live preview `/next/` | **46,905 bytes**, MD5 b4f23c7e55e7baab25086c14f2d0448c; byte-identical to the PR #14 build; unchanged since PR #14 | [VERIFIED: curl; `git diff 4813482 6443826 -- app scripts package.json package-lock.json data` is empty] |
| TA-03 continuation | `continuation/ex-01-task-ta-03-20261027` at **0f1c5d3** (pushed, equal to origin), parent **97a7d69**. Page MD5 0713C6BE at 97a7d69, 5F1C2FC5 at 0f1c5d3 | [VERIFIED: `git ls-remote`, `git rev-parse 0f1c5d3^1`, `git show <sha>:index.html \| md5sum`] |
| NB-01 M1.4 | `feat/m1-4-overview` at **07a6460**, **LOCAL ONLY**, 23 commits ahead of origin/main | [VERIFIED: `git rev-list --count origin/main..feat/m1-4-overview` = 23; `git branch -r --contains 07a6460` empty] |
| NB-01 round-2 fixers | `worktree-wf_bdc6c774-599-1/-2/-3` at **4610684 / be7f395 / 202f8f6**, **LOCAL ONLY** | [VERIFIED: `git rev-parse`; not in `git ls-remote origin`] |
| Handover branch | `handover/mod-01-to-mod-02-20261028`, based on 6443826, local | [VERIFIED: `git rev-parse`] |

Site addresses: live page `https://productsteamcentricity.github.io/portfolio-review-dashboard/`, preview `.../next/`.
Repository: `https://github.com/productsteamcentricity/portfolio-review-dashboard`.

## Remote, tags, stash, hooks, identity

- **Remote:** one, `origin` = `https://github.com/productsteamcentricity/portfolio-review-dashboard.git` (fetch and push). It has 18 heads
  (main plus 17 branches), the `HEAD` symref, the tag and `refs/pull/1..16/head`; every SHA equals the local remote-tracking ref
  [VERIFIED: `git ls-remote --heads origin` lists 18 lines, re-run 30 Oct]. All 17 non-main remote branches are merged into main,
  except the TA-03 continuation branch [VERIFIED: `git merge-base --is-ancestor` for each, 30 Oct].
- **Tag:** one, `legacy-baseline-782794f`, an annotated tag pointing at 782794f (the PR #6 merge, page EF2FF4F1), on origin too. It marks
  the page after fix batch 1b, which the new build uses as its legacy baseline; it is **not** the Stage A baseline (root 511f554)
  [VERIFIED: `git cat-file -t`, `git rev-parse legacy-baseline-782794f^{commit}`].
- **Stash:** empty (the stash is shared by all worktrees) [VERIFIED: `git stash list`].
- **Pre-push hook:** `core.hooksPath` = `C:\dev\portfolio-review\scripts\hooks`, an **absolute** path in `.git/config`, so every worktree
  uses the hook script from the **main checkout**. The hook runs `scripts/validation/prepush-scan.mjs` from the **pushing worktree**
  against `<remote>/main`, so each branch must be pushed from its own worktree. It refuses the push if node is not on PATH
  [VERIFIED: `git config --get core.hooksPath`; `scripts/hooks/pre-push`].
- **Deny-list:** `PRD_PRIVACY_DENYLIST` is **not set** persistently: unset in Git Bash, in PowerShell and in the user environment
  [VERIFIED, 28 Oct]. Without it the scans run the generic rules only. Export it before every push
  (Git Bash: `export PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt`; PowerShell: see
  [docs/new-build/safety-tooling.md](../new-build/safety-tooling.md)). Setting it persistently is a standing configuration change that
  needs the owner's OK (PD-40).
- **Identity:** `user.name` "Products Team Centricity" with the account's GitHub no-reply address; `user.useConfigOnly=true` (D-008).
  `push.default` unset, so git uses `simple`. Global `core.autocrlf=false` (D-005) [VERIFIED: `git config`].
- **gh:** signed in as `productsteamcentricity` through the Windows keyring, scopes `repo`, `workflow`, `gist`, `read:org`. Never print
  or copy the token [VERIFIED: `gh auth status`, repo-env investigation].

### Upstream hazard

Four local branches track `origin/main` instead of a branch of their own name: `feat/m1-4-overview`, `fix/legacy-batch-3-tax`,
`fix/legacy-batch-4-basefile` and `handover/mod-01-to-mod-02-20261028` [VERIFIED: `git for-each-ref` upstream field].
- A plain `git push` is refused under `simple` (the names differ).
- A plain `git pull` would merge main into the branch.
- So the first push of any branch is `git push -u origin <branch>`, which also fixes the upstream [INFERRED from git semantics].

## GitHub settings

[VERIFIED: `gh api`, 28 Oct]
- Repository **public**, default branch `main`.
- **main is not protected** (the protection endpoint returns 404) and there are **no rulesets**. This is the owner's choice (D-033).
  Force-push detection (AC-22) is described in some documents but is not built (TB-24).
- Merge commits, squash and rebase are all allowed; `delete_branch_on_merge` is false. The project merges locally with `--no-ff` (D-020).
- **Pages** is built by a workflow (`build_type: workflow`), HTTPS enforced.
- No open pull request; PRs #1..#16 are all merged, the latest #16 on 27 Oct 2026 12:43:57 UTC [VERIFIED: `gh pr list --state all`].

## CI and Pages workflows

**`.github/workflows/ci.yml`, "Dashboard checks"** [VERIFIED: file on main]
- Triggers: push to main, every pull request, and `workflow_dispatch` (so a branch can be checked by hand:
  `gh workflow run "Dashboard checks" --ref <branch>`). Permissions: contents read.
- Job `checks` (TZ Asia/Kolkata, Node 24): `tools/check-invariants.js`, `smoke-review.js`, `test-ai-analyst.js`, `run-regression.js`.
- Job `next`, in order: privacy scan of docs and root Markdown (generic rules only); docs links; monthly PRD check; `npm ci`;
  typecheck; build; `check-next.mjs --rebuild`; `node --test` in IST and in UTC; traceability; `scripts/data-extract.ts --check`;
  fetch main; `release-check.mjs --ci` (last on purpose). NB-01's M1.4 branch adds `vendor-extract.mjs --check` before the fetch.

**`.github/workflows/pages.yml`, "Publish dashboard to GitHub Pages"** [VERIFIED: file on main]
- Triggers: push to main touching `index.html`, `app/**`, `package.json`, `package-lock.json`, `.npmrc`, `scripts/build.mjs`,
  `scripts/validation/check-next.mjs` or `pages.yml`; also `workflow_dispatch`. Concurrency group "pages".
- Build job: the legacy gates `check-invariants`, `smoke-review`, `run-regression` must pass (`test-ai-analyst` is **not** run here).
  The new-app steps (`npm ci`, build, `check-next`) are non-blocking (D-034). `index.html` is copied byte for byte and checked with `cmp`.
  `/next/` is the build only if `check-next` passed, otherwise a static notice.
- Deploy job runs no repository code.

**Latest runs** [VERIFIED: `gh run list`, 28 Oct]
- Dashboard checks on push to main 6443826: success, 27 Oct 2026 12:43:58 UTC (run 40506084298).
- Pages on push to main 6443826: success, every step including the new-app install, build and check (run 40506084394).
- Dashboard checks on the PR #16 head 08b1c9f: success (run 40505712922).
- All 25 listed runs succeeded. The only annotation is a runner notice that `ubuntu-latest` moves to Ubuntu 26.
- **No run has ever happened on the TA-03 continuation branch**, nor on any NB-01 local branch.

## Branches

There are 80 local branches: 38 named and 42 `worktree-wf_*` [VERIFIED: repo-env investigation, `git for-each-ref`].

| Group | Branch @ head | Upstream | Behind / ahead of origin/main | On a remote? | Holds | Action |
|---|---|---|---|---|---|---|
| Main | `main` @ 6443826 | origin/main | 0 / 0 | yes | the live state | none |
| Handover | `handover/mod-01-to-mod-02-20261028` @ 6443826 | origin/main (hazard) | 0 / 0 | no | this package once committed | push with `-u` (TC-01) |
| **Pushed, unmerged** | `continuation/ex-01-task-ta-03-20261027` @ 0f1c5d3 | its own origin branch | 0 / 5 | yes | TA-03: T1 c459f8d, T2 92c7c83, T3+T4 5581d90, rebase merge 97a7d69, T5 WIP 0f1c5d3 | EX-01 continues (TA-03) |
| **Local only, unique work** | `feat/m1-4-overview` @ 07a6460 | origin/main (hazard) | 0 / 23 | **no** | M1.4 units U1..U5, fix round FA/FB/FC/FD, integration, docs, merge of PR #16 | **preserve first** (TB-08) |
| **Local only, unique work** | `worktree-wf_bdc6c774-599-1` @ 4610684 (G1) | none | 0 / 24 | **no** | round-2 fix G1 | preserve (TB-08) |
| **Local only, unique work** | `worktree-wf_bdc6c774-599-2` @ be7f395 (G2) | none | 0 / 24 | **no** | round-2 fix G2 (untested) | preserve (TB-08) |
| **Local only, unique work** | `worktree-wf_bdc6c774-599-3` @ 202f8f6 (G3) | none | 0 / 24 | **no** | round-2 fix G3 | preserve (TB-08) |
| Local only, contained in the pushed continuation branch | `fix/legacy-batch-3-tax` @ c459f8d; `fix/legacy-batch-3-tax-p2` @ 92c7c83; `fix/legacy-batch-3-tax-p3-r2` @ 97a7d69 | origin/main (hazard); none; none | 14/1; 14/2; 0/4 | through the continuation branch | T1; T2; T1..T4 rebased | nothing unique; keep until TA-03 merges |
| Local only, contained only in the local `feat/m1-4-overview` | `worktree-wf_ca03729e-33b-2..6` @ 43bff28, f2e83e6, a9630b6, bd12cb9, 93f2126; `worktree-wf_c3548c88-811-1..4` @ f7e9ba8, 8d8448f, eaa67aa, c06205c | none | 9/1 each; 7/13 (811-3: 7/14) | no | M1.4 units U1..U5; round-1 fixers FA, FB, FC, FD and tests. FC commit 94f5d5b is also held by `811-3` [VERIFIED: `git merge-base --is-ancestor`] | only as safe as `feat/m1-4-overview` |
| Superseded | `fix/b1b-ki007-ki048` (+`-r2`) @ a577679 / 7bbe51e; `fix/b1b-ki061-ki062` (+`-r2`) @ f3c7acb / 0abe484; `fix/b1b-ki063` (+`-r2`) @ f0c2fcf / b37efee; `fix/b1b-ki067-ki068` (+`-r2`) @ aa77b75 / 1dfc73f | none | 51 / 1..2 | no | fix batch 1b drafts; their content reached main in 741373a (PR #6); the patch scripts differ only in the date lines of the header [VERIFIED: blob comparison] | nothing unique [INFERRED]; remove only on the owner's word |
| Merged (no action) | 24 more named branches from PRs #1..#16 (for example `fix/legacy-batch-4-basefile-r2` @ 08b1c9f, `docs/cg-template-spec` @ 81f2d9c, `feat/next-top-tabs` @ 4813482); `fix/legacy-batch-4-basefile` @ 7869676 still tracks origin/main (hazard); 30 merged `worktree-wf_*` branches | various | n / 0 | most yes | nothing unique | housekeeping later (TC-18) |

## Worktrees

23 worktrees: the main checkout, 21 under `.claude/worktrees/`, and `C:\dev\pr-review`. **Every one is clean** (0 staged, 0 unstaged,
0 untracked); none is locked; `git worktree prune --dry-run` lists nothing [VERIFIED: `git worktree list`, `git status --porcelain`
in each, 28 Oct].

| Worktree (under `C:\dev\portfolio-review` unless absolute) | Branch @ head | Chat | Unique unpushed work | State |
|---|---|---|---|---|
| main checkout | `main` @ 6443826 | shared | none | in sync with origin/main; not a work area |
| `.claude/worktrees/handover` | `handover/mod-01-to-mod-02-20261028` @ 6443826 | MOD-01 → MOD-02 | none yet | ACTIVE (TC-01) |
| `.claude/worktrees/wf_c9c8da96-497-10` | `continuation/ex-01-task-ta-03-20261027` @ 0f1c5d3 | MOD-01 → EX-01 | none (pushed) | ACTIVE (TA-03) |
| `.claude/worktrees/wf_c9c8da96-497-1` | `fix/legacy-batch-3-tax` @ c459f8d | MOD-01 | none | stale |
| `.claude/worktrees/wf_c9c8da96-497-2` | `fix/legacy-batch-4-basefile` @ 7869676 | MOD-01 | none (merged) | stale |
| `.claude/worktrees/wf_c9c8da96-497-3` | `fix/legacy-batch-3-tax-p2` @ 92c7c83 | MOD-01 | none | stale |
| `.claude/worktrees/wf_c9c8da96-497-5` | `fix/legacy-batch-4-basefile-r2` @ 08b1c9f | MOD-01 | none (merged, PR #16) | stale |
| `.claude/worktrees/m14` | `feat/m1-4-overview` @ 07a6460 | NB-01 | **23 commits** | ACTIVE, unpushed |
| `.claude/worktrees/wf_bdc6c774-599-1` | G1 @ 4610684 | NB-01 | **1 commit** | pending integration |
| `.claude/worktrees/wf_bdc6c774-599-2` | G2 @ be7f395 | NB-01 | **1 commit** | pending integration |
| `.claude/worktrees/wf_bdc6c774-599-3` | G3 @ 202f8f6 | NB-01 | **1 commit** | pending integration |
| `.claude/worktrees/wf_c3548c88-811-1..4` (4 worktrees) | round-1 fixers | NB-01 | none beyond the local `feat/m1-4-overview` | stale |
| `.claude/worktrees/wf_ca03729e-33b-2..6` (5 worktrees) | M1.4 units | NB-01 | none beyond the local `feat/m1-4-overview` | stale |
| `.claude/worktrees/cg-spec` | `docs/cg-template-spec` @ 81f2d9c | NB-01 | none (PR #15) | stale |
| `.claude/worktrees/tabs` | `feat/next-top-tabs` @ 4813482 | NB-01 | none (PR #14); its `app/dist` equals the live `/next/` | stale; still served on port 8103 |
| `C:\dev\pr-review` | detached @ 2a65a62 (PR #10 merge, 22 Oct) | shared PR testing | none | stale; still served on port 8101 |

Chat ownership of worktrees is [INFERRED] from commit subjects and the chats' own reports.

**Ignored local content** (never commit): `.blocks/` reading copies (stale since 21 Oct; line citations drift), `buildtools/out/`
(refresh intermediates, see `.gitignore`), `test-data/` (presumed synthetic from names and `.gitignore`; not opened), `node_modules/`,
`app/dist/`. Ignored test-data exists in the main checkout, in `m14` and in `C:\dev\pr-review` [VERIFIED: `git status --ignored`].

## Runtimes and toolchain

[VERIFIED, 28 Oct]
- **Toolchain location:** `C:\dev\tools` (D-006), outside OneDrive and outside the repository. Node and npm in `C:\dev\tools\node`,
  PortableGit in `C:\dev\tools\git`, gh in `C:\dev\tools\gh\bin`; installers kept in `C:\dev\tools\_downloads`. Both Git Bash and
  PowerShell find node, npm, gh and git there. Run node as `C:/dev/tools/node/node.exe` if PATH lacks it.
- **Versions:** node **v24.21.0**, npm **11.19.0**, git **2.56.0.windows.2**, gh **2.102.0**.
- **`package.json`:** name `centricity-portfolio-review`, private, `"type": "module"`, **engines node ">=24.2"**; scripts typecheck, build,
  check, test, serve; devDependencies pinned exactly: esbuild 0.28.2, preact 10.29.8, typescript 7.0.2.
- **`package-lock.json`:** lockfileVersion 3; its root entry says engines node **">=24"**, which disagrees slightly with `package.json`
  (the lockfile metadata was probably not regenerated [INFERRED]; TC-18).
- **`.npmrc`:** `ignore-scripts=true`, `save-exact=true`, `fund=false`, `audit=false`.
- `tools/package.json` and `buildtools/package.json` only set `"type": "commonjs"` for the legacy scripts.

## Launch configurations

| Where | Name | Port | Serves | State |
|---|---|---|---|---|
| repo `.claude/launch.json` (tracked) | `dashboard` | 8099 | `node tools/serve-dashboard.js` (relative to the checkout) | current [VERIFIED] |
| repo `.claude/launch.json` | `next` | 8100 | `node scripts/serve.mjs` | current [VERIFIED] |
| the session project folder's `launch.json` (outside the repo; path in the private supplement) | `dashboard` | 8099 | main checkout | current [VERIFIED] |
| same | `dashboard-pr` | 8101 | `C:\dev\pr-review` | stale target (PR #10) [VERIFIED] |
| same | `next-tabs` | 8103 | `tabs` worktree | stale target (merged) [VERIFIED] |
| same | `next-m14` | 8106 | `m14` worktree | current for M1.4 [VERIFIED] |

There is **no entry for the TA-03 worktree**; add one before TA-03 browser QA (port 8133 recommended). The full port register is in
[FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](FILE_OWNERSHIP_AND_CHANGE_CONTROL.md#port-register).

## Local-only work and the preservation step

**Risk** [VERIFIED]: NB-01's work exists only on this laptop: `feat/m1-4-overview` (23 commits, 236 files, +27,324/-492 against main)
and the three round-2 fixer commits, **26 commits in all**. None is on origin; CI and the deny-list pre-push scan have never run on them.
Losing the disk or a worktree loses milestone M1.4. NB-01 chose not to push because some tests fail on the head [VERIFIED: NB-01 report].
The vendored `app/vendor/*.js` and `app/src/config/brand-logos.json` have no deny-list exemption, so whether the scan passes is
[UNKNOWN].

**Recommended preservation step** (TB-08; a lead decision for MOD-02 under D-033; NB-01 executes):

1. **Read-only first: ask the scanner.** From each branch's **own** worktree, with the deny-list exported, run its own scanner. It reads
   git objects and writes nothing [INFERRED from the script's usage].

   ```bash
   export PRD_PRIVACY_DENYLIST=/c/dev/private/privacy-denylist.txt
   cd /c/dev/portfolio-review/.claude/worktrees/m14               && node scripts/validation/prepush-scan.mjs --base origin/main --head 07a6460
   cd /c/dev/portfolio-review/.claude/worktrees/wf_bdc6c774-599-1 && node scripts/validation/prepush-scan.mjs --base origin/main --head 4610684
   cd /c/dev/portfolio-review/.claude/worktrees/wf_bdc6c774-599-2 && node scripts/validation/prepush-scan.mjs --base origin/main --head be7f395
   cd /c/dev/portfolio-review/.claude/worktrees/wf_bdc6c774-599-3 && node scripts/validation/prepush-scan.mjs --base origin/main --head 202f8f6
   ```

2. **If the scan passes**, NB-01 pushes on MOD-02's instruction, each from its own worktree, with no PR (main is unaffected):
   `git push -u origin feat/m1-4-overview` from `m14`, then `git push -u origin worktree-wf_bdc6c774-599-1` (and `-2`, `-3`) from their
   worktrees. Never `--no-verify`, never a force-push.
3. **If the scan blocks**, do not bypass it. Report the finding to MOD-02. A `git bundle` of the four refs (checked with
   `git bundle verify`) can be made, but a bundle in `C:\dev\private` sits on the same disk and that folder is not backed up
   [INFERRED], so it does not take the work off this laptop. Ask the owner for an approved off-machine location for the bundle.
4. **Accept when** `git ls-remote origin` shows 07a6460, 4610684, be7f395 and 202f8f6 (or a verified bundle sits in the
   owner-approved location), and nothing was force-pushed.

## Verify before you trust

Run this read-only block first (Git Bash). Expected values are in the comments. Record every mismatch before assigning work.

```bash
cd /c/dev/portfolio-review
node --version                                    # v24.21.0
git status --short --branch                       # "## main...origin/main" and nothing else
git ls-remote origin refs/heads/main refs/heads/continuation/ex-01-task-ta-03-20261027
                                                  # 6443826... (main) and 0f1c5d3... (continuation)
git rev-parse main origin/main | cut -c1-7        # 6443826 twice
git rev-parse --short 0f1c5d3^1                   # 97a7d69
git rev-parse feat/m1-4-overview worktree-wf_bdc6c774-599-1 worktree-wf_bdc6c774-599-2 worktree-wf_bdc6c774-599-3 | cut -c1-7
                                                  # 07a6460 4610684 be7f395 202f8f6 (unless NB-01 has moved on)
git branch -r --contains 07a6460                  # empty until TB-08 is done
git rev-list --left-right --count origin/main...feat/m1-4-overview   # 0 23
git worktree list | wc -l                         # 23
for w in $(git worktree list --porcelain | sed -n 's/^worktree //p'); do
  printf '%s %s\n' "$(git -C "$w" status --porcelain | wc -l)" "$w"; done          # 0 for every worktree
git stash list | wc -l                            # 0
git config --get core.hooksPath                   # C:\dev\portfolio-review\scripts\hooks
git for-each-ref --format='%(refname:short) -> %(upstream:short)' refs/heads | grep ' -> origin/main$'
                                                  # main plus the four hazard branches
echo "${PRD_PRIVACY_DENYLIST:-unset}"             # unset unless exported in this shell
gh pr list --state open                           # empty, unless a PR was opened after 28 Oct
gh run list --limit 4                             # latest runs succeeded on 6443826
git show origin/main:index.html | md5sum          # 12b5e5727fca01ef2ea162c59913f01d
curl -s https://productsteamcentricity.github.io/portfolio-review-dashboard/ | md5sum       # the same MD5
curl -s https://productsteamcentricity.github.io/portfolio-review-dashboard/next/ | wc -c  # 46905
```

If main has moved since 28 Oct (a merge after this snapshot), the live MD5 must equal the new main's `index.html`, and this file and the
[ACTIVE_CHANGE_REGISTER.md](ACTIVE_CHANGE_REGISTER.md) must be updated.

## Change log of this file

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First snapshot for the MOD-01 to MOD-02 handover |
| 30 Oct 2026 | MOD-01 (fixer pass) | Remote head count corrected (18 heads: main plus 17); the two `git rev-parse` lines of the verify block now work (`--short` takes one ref only) |
