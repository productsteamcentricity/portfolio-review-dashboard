# Project state

**Last updated:** 15 Oct 2026. The monthly process is set up (CR-0003, in review). The next event is the October
2026 refresh, when the files arrive around 13–17 Nov 2026.

## Current state
- **Live product.**
  - `index.html` on `main` is commit `9f018e4`, MD5 `F0EB0101E27DD165A23A62CF548E26A2`, 16,768,244 bytes.
  - It contains the KI-001 fix (CR-0002).
  - Data vintage: 30 Sep 2026, except ranks (15 Aug), fund managers (31 Aug), PMS returns (31 Jul) and AIF
    (30 Jun).
  - Served at https://productsteamcentricity.github.io/portfolio-review-dashboard/. After the merge, the live
    file was verified to equal `main` by SHA-256.
- **In review.** Branch `chore/organise-repo-and-monthly-process` (CR-0003):
  - the refresh pipeline restored into `buildtools/` and proved on September (every block byte-identical);
  - the monthly runbook and the intake check;
  - the reorganised docs;
  - the preview server moved to `tools/`;
  - the current AI Analyst test (17/17, now blocking in CI).

  `index.html` is unchanged.
- **Repository:** `C:\dev\portfolio-review`; `origin` =
  https://github.com/productsteamcentricity/portfolio-review-dashboard (**public**, D-008). Commits are made as
  Products Team Centricity with the GitHub noreply address.
- **OneDrive project folder:** `…\Desktop\Claude Code-Portfolio Review Dashboard` (D-018).
  - `01 Monthly Updates\2026-10` is ready for the October files.
  - `02 Archive` holds Apr–Sep 2026.
  - `03 Handover` holds everything received.
- **Local preview:** `Open Dashboard.cmd` in the OneDrive folder, or `tools/open-dashboard.cmd`, starts the
  server if needed and opens http://127.0.0.1:8099.
- **Previous owner's site:** stays live until the new build has been fully tested (owner, 15 Oct 2026).
- **Toolchain:** Node 24.21.0, Git 2.56.0.2, gh 2.102.0 in `C:\dev\tools` (user PATH). PowerPoint and Excel 16
  (COM) are available for the slide export.

## Blockers
| Blocker | Needed from | Unblocks |
|---|---|---|
| Risk-ratio toolchain (`C:\Temp\navwork` on the previous owner's machine) | Previous owner (follow-up request drafted in `03 Handover\2026-10-15 Follow-up request`, not yet sent) | Refreshing MF_RISK each month. Until then it stays at 30 Sep 2026. |
| Sources for FUND_RANKS, FUND_MGR, PMS/AIF performance, the SOA look-through workbook | Owner / Products team (who produces each is among the questions in the follow-up request) | Refreshing those blocks (stale since Jun–Aug) |
| Accord Fintech licence: may the embedded vendor data be on a public site? | Owner (whoever holds the vendor contract) | Certainty about the public Pages site (D-008) |

## Next steps
1. **CR-0003:** CI green on the PR, then merge (D-017), then verify the live site is unchanged.
2. **Owner:** send the follow-up request to the previous owner. It is in OneDrive under
   `03 Handover\2026-10-15 Follow-up request`.
3. **Owner, around 13–17 Nov 2026:**
   - put the October files in `01 Monthly Updates\2026-10`;
   - put the five TRI files in `Index TRI`;
   - tell Claude.
4. **Claude:** run the October refresh by docs/MONTHLY_REFRESH.md, then the owner reviews and approves
   publication.
5. **Owner:** approve protecting `main` with a ruleset: pull request plus "Dashboard checks" required, no
   force-push or deletion. This is a settings change; see docs/DEPLOYMENT.md.
6. **Owner:** open one exported deck and workbook in PowerPoint and Excel (acceptance check 7).
7. **Owner:** after full testing of the new build, schedule retiring the previous owner's site.

## Backlog (prioritised; each item needs the owner's go-ahead)
| Priority | Item | Type |
|---|---|---|
| P1 | October 2026 data refresh (when the files arrive) | operations |
| P1 | Risk-ratio computation in this repository (from the previous owner's toolchain, or rebuilt from KNOWLEDGE_DUMP §1.1 / §2.2) | operations |
| P2 | KI-002 / KI-003 — overlap matrices missing from the exported deck | defect |
| P2 | KI-005 — base-file XIRR arrives both as percent and as fraction: magnitude guard (both forms seen) | data integrity |
| P2 | KI-035 — IPS profile and cost distributor carry from one family to the next | defect |
| P2 | KI-004 — decide the AMC-cap basis for the AI Analyst (and the IPS "Single AMC 0–25%" band) | product decision |
| P2 | KI-008 — escape rendered cell text; add a CSP meta tag that enforces "no network" | security |
| P2 | Expense-ratio sanity checks as a script (today a manual runbook step) | operations |
| P3 | KI-006 / KI-007 — missing XIRR / invested value treated as 0 in totals | data integrity |
| P3 | KI-012 — limit identifying data kept in localStorage | privacy |
| P3 | KI-013, KI-022, KI-024, KI-031, KI-032, KI-036–KI-046 — upload consistency, tax dating, benchmark routing, reset, inherited items | defects |
| P3 | KI-029 — AI Analyst signal weights sign-off | product decision |
| P4 | Low-severity items in KNOWN_ISSUES.md | defects |

## Records
- What the owner asked for: `docs/change-requests/`.
- Every monthly refresh: `docs/refresh-log/`.
- What changed: `CHANGELOG.md` and `git log`.
