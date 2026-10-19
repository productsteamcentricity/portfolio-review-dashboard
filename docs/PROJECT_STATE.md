# Project state

**Last updated:** 19 Oct 2026.
- The full audit is done: 67 issues, see [`audits/`](audits/).
- Fixes are starting in batches (CR-0005).
- The previous owner's second export is expected this week (CR-0004).
- The October 2026 data refresh is due when the files arrive, around 13–17 Nov 2026.

## Current state
- **Live product.** https://productsteamcentricity.github.io/portfolio-review-dashboard/ is the permanent review
  link.
  - It serves `index.html` on `main`: MD5 `F0EB0101E27DD165A23A62CF548E26A2`, 16,768,244 bytes, with the KI-001 fix.
  - Verified identical to `main` on 16 Oct 2026.
  - Data vintage: 30 Sep 2026, except ranks (15 Aug), fund managers (31 Aug), PMS returns (31 Jul) and AIF
    (30 Jun).
- **Repository.** `C:\dev\portfolio-review`; `origin` =
  https://github.com/productsteamcentricity/portfolio-review-dashboard (**public**, D-008).
  - Commits use Products Team Centricity with the GitHub no-reply address. Since 19 Oct this laptop's global git
    identity is the no-reply address too.
  - Merges are made locally with that identity, because GitHub's merge button records the account e-mail
    (KI-098).
- **Monthly refresh.** `buildtools/` was proved byte-identical on September (CR-0003). The process is in
  docs/MONTHLY_REFRESH.md, and the inbox `01 Monthly Updates\2026-10` is ready.
- **OneDrive project folder:** `…\Desktop\Claude Code-Portfolio Review Dashboard` (D-018).
- **Local preview:** `Open Dashboard.cmd` (OneDrive) or `tools/open-dashboard.cmd` opens http://127.0.0.1:8099.
  The server serves only the dashboard and `test-data/`.
- **Previous owner's site:** stays live until the new build has been fully tested (owner, 15 Oct 2026).

## Blockers
| Blocker | Needed from | Unblocks |
|---|---|---|
| The second export: risk toolchain, sources of record, real-format test fixtures, answers | Previous owner (prompt sent via Teams, CR-0004) | Monthly MF_RISK refresh; testing fixes against real file formats; several owner questions |
| 25 product decisions from the audit | Owner (`audits/2026-10-19-decisions.md`; "accept all" is enough) | The register's group (b) fixes |
| Accord Fintech licence: may the embedded vendor data be on a public site? | Owner (whoever holds the vendor contract) | Certainty about the public Pages site (D-008) |

## Next steps
1. **Claude:** ship the audit's "fix now" batches (CR-0005), one PR each, with known-answer tests. The first
   batch is engine numbers.
2. **Owner:**
   - answer the audit decisions;
   - send your own list of issues;
   - give the redesign direction.
3. **Claude:** propose the redesign architecture: source files that build the same single offline page. Start it
   after approval.
4. **When the second export arrives:**
   - Claude verifies and files it;
   - restores the risk toolchain into the repository;
   - re-tests the fixes against the real-format fixtures.
5. **Around 13–17 Nov:** the October data refresh (docs/MONTHLY_REFRESH.md).
6. **Owner:** approve protecting `main` with a ruleset (docs/DEPLOYMENT.md).
7. **Owner:** after full testing of the new build, schedule retiring the previous owner's site.

## Backlog
The prioritised backlog is the audit register's fix order (`audits/2026-10-19-full-audit.md`, end of the file):
- **(a) fix now:** clear-cut issues that survive the redesign, in 7 batches;
- **(b) after owner decisions:** see the decisions file;
- **(c) in the redesign:** presentation-only items.

Other items:
| Priority | Item | Type |
|---|---|---|
| P1 | Risk-ratio computation in this repository (from the previous owner's toolchain) | operations |
| P2 | Expense-ratio sanity checks as a script (today a manual runbook step) | operations |
| P3 | KI-029: AI Analyst signal weights sign-off | product decision |

## Records
- What the owner asked for: `docs/change-requests/`.
- Every monthly refresh: `docs/refresh-log/`.
- Every audit: `docs/audits/`.
- What changed: `CHANGELOG.md` and `git log`.
