# Project state

**Last updated:** 14 Oct 2026 — end of Stage A (baseline replication).

## Current state
- **Product:** `index.html` = production build `cab22e6` (MD5 `173F86CAC1E5D0AC8FFD5A66042A3B4C`),
  data vintage 30 Sep 2026 (ranks 15 Aug, fund managers 31 Aug, PMS returns 31 Jul, AIF 30 Jun).
  Byte-identical to the previous owner's live Pages site. No product change since handover.
- **Repository:** `C:\dev\portfolio-review`; `origin` = https://github.com/productsteamcentricity/portfolio-review-dashboard
  (**public**, D-008); baseline in three commits on `main` (see `git log`). Site:
  https://productsteamcentricity.github.io/portfolio-review-dashboard/ (verify each deployment by MD5,
  DEPLOYMENT.md). Commit identity: Products Team Centricity, GitHub noreply address.
- **Checks:** invariants pass (1 data warning, KI-027); smoke test 26/26; AI Analyst test 16/17
  (stale test, KI-010); browser acceptance pass except the visual Office check.
- **Toolchain:** Node 24.21.0, Git 2.56.0.2, gh 2.102.0 in `C:\dev\tools` (user PATH).

## Blockers
| Blocker | Needed from | Unblocks |
|---|---|---|
| `buildtools/` (monthly refresh pipeline) | previous owner | the October 2026 data refresh |
| Current `tools/test-ai-analyst.js` (8,402 bytes) | previous owner | a fully green, blocking AI Analyst test |
| Previous `CLAUDE.md`, July PRD, `migration-kit/` | previous owner | full trap history; CI ideas |

## Next steps
1. Owner: approve protecting `main` with a ruleset (pull request + "Dashboard checks" required, no
   force-push or deletion) — a repository-settings change, see docs/DEPLOYMENT.md.
2. Owner: obtain the missing handover files; then restore `buildtools/` (adjust its `targets` to the
   single `index.html`, fix `postcheck.js`'s hard-coded path), add a `refresh-operator` agent and a
   `docs/MONTHLY_REFRESH.md` runbook, and dry-run the September rebuild (acceptance check 8).
3. First code change (recommended): fix KI-001 (per-family state reset) behind the full check suite.
4. Open one exported deck/workbook in PowerPoint/Excel (acceptance check 7).
5. Ask the previous owner to retire the old public Pages site and repository.

## Backlog (prioritised; each item needs the owner's go-ahead)
| Priority | Item | Type |
|---|---|---|
| P1 | KI-001 — reset per-family state when a new base file loads (confidentiality) | defect |
| P1 | Restore the monthly refresh pipeline (`buildtools/`) and run the Oct 2026 refresh | operations |
| P2 | KI-002 / KI-003 — overlap matrices missing from the exported deck | defect |
| P2 | KI-005 — confirm base-file XIRR units with an anonymised real file; add a magnitude guard if needed | data integrity |
| P2 | KI-004 — decide the AMC-cap basis for the AI Analyst | product decision |
| P2 | KI-008 — escape rendered cell text; add a CSP meta tag that enforces "no network" | security |
| P2 | Replace the stale AI Analyst test; make it blocking in CI | quality |
| P3 | KI-006 / KI-007 — missing XIRR / invested value treated as 0 in totals | data integrity |
| P3 | KI-012 — limit identifying data kept in localStorage | privacy |
| P3 | KI-013, KI-022, KI-024, KI-031, KI-032 — upload consistency, tax dating, benchmark routing, reset | defects |
| P3 | KI-029 — AI Analyst signal weights sign-off | product decision |
| P4 | Low-severity items in KNOWN_ISSUES.md | defects |
| P4 | A reusable anchored-patch helper for `index.html` changes (write it with the first code change) | tooling |

## Change log pointer
See `CHANGELOG.md`. Commit SHAs are recorded there once the baseline is committed.
