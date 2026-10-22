# Monthly PRDs

One file per **completed monthly cycle**, named `YYYY-MM-Portfolio-Review-PRD.md` by the **data month** (`2026-10` =
data as on 31 Oct 2026, the same convention as [`../refresh-log/`](../refresh-log/README.md) and, later,
`monthly_updates/YYYY-MM/`). The brief's Phase 12 asks for one every cycle, with sections A to I, so that a future
session can resume from the living PRD, the latest monthly PRD, the handover, the README and git alone.

- **How it is written.** By hand from [`TEMPLATE.md`](TEMPLATE.md) for each cycle from the **2026-10** data month (files
  due 13 to 17 Nov 2026, processed by the legacy pipeline) until milestone M14 generates it (Q-76, proceeding on its
  default). The template's section headings are fixed: the planned check script and, from M14, the acceptance test
  AC-23 look for them.
- **Handover in the same cycle.** Each cycle also refreshes [`../HANDOVER.md`](../HANDOVER.md): its "last refreshed"
  date becomes the cycle's, and its git-state section matches section I of the monthly PRD.
- **Checks before committing.** `node scripts/validation/privacy-scan.mjs docs/monthly-prds` with the private
  deny-list (`PRD_PRIVACY_DENYLIST`, see [`../new-build/safety-tooling.md`](../new-build/safety-tooling.md)) and
  `node scripts/validation/docs-links.mjs`. `scripts/validation/monthly-prd-check.mjs` (sections A to I present, the
  handover refreshed, privacy) is planned in M1.1 and not built yet.

## What it holds, and what it does not

The monthly PRD is the human record of the whole project at the end of a cycle. It links to the other records instead
of copying them:

| Record | Holds | The monthly PRD |
|---|---|---|
| [`../PRD.md`](../PRD.md) | what the product must do (living) | names the PRD version in force; lists requirement changes |
| [`../PROJECT_STATE.md`](../PROJECT_STATE.md) | the "now" page: status, blockers, next steps | snapshots it at the cycle's end |
| [`../refresh-log/YYYY-MM.md`](../refresh-log/README.md) | the legacy pipeline's run: inputs, counts, checks, stale blocks | summarises and links it |
| `monthly_updates/YYYY-MM/UPDATE_REPORT.md` (from M11) | the update engine's machine facts | summarises and links it |
| [`../../CHANGELOG.md`](../../CHANGELOG.md) and git | every change | lists the cycle's changes by heading, with PR numbers |

**Public repository.** Never client holdings, values, names, folios or file contents; never credentials or the values
of environment variables (names only); people by role ("the owner", "the analyst"), never by name; no local paths and
no description of where client files are kept (D-019, D-020). Project figures (counts, MD5s, commit SHAs, test
results) are fine.

## Cycles

| Data month | Monthly PRD | Written | Notes |
|---|---|---|---|
| 2026-10 | not yet written | | the first cycle (files due 13 to 17 Nov 2026) |
