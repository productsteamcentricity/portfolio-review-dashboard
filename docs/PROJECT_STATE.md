# Project state

**Last updated:** 15 Oct 2026 — Stage B, change 1 (KI-001) in review.

## Current state
- **Live product:** `index.html` on `main` = production build `cab22e6` (MD5
  `173F86CAC1E5D0AC8FFD5A66042A3B4C`), data vintage 30 Sep 2026 (ranks 15 Aug, fund managers 31 Aug,
  PMS returns 31 Jul, AIF 30 Jun), served at https://productsteamcentricity.github.io/portfolio-review-dashboard/.
- **In review:** branch `fix/ki-001-reset-family-state` — the KI-001 fix (MD5 `F0EB0101…`), the
  anchored-patch helper and the family-isolation browser check. Merging to `main` republishes Pages and
  needs the owner's go-ahead (CLAUDE.md rule 8).
- **Repository:** `C:\dev\portfolio-review`; `origin` =
  https://github.com/productsteamcentricity/portfolio-review-dashboard (**public**, D-008). Commit
  identity: Products Team Centricity, GitHub noreply address.
- **Checks on the branch:** invariants pass (1 data warning, KI-027); smoke test 26/26; AI Analyst test
  16/17 (stale test, KI-010); family-isolation browser checks pass; single-family browser regression
  unchanged (61-slide deck, 15-sheet workbook, Fund IRR 13.09% vs 11.88%).
- **Previous owner's site:** stays live until the new build has been fully tested (owner, 15 Oct 2026).
- **Toolchain:** Node 24.21.0, Git 2.56.0.2, gh 2.102.0 in `C:\dev\tools` (user PATH).

## Blockers
| Blocker | Needed from | Unblocks |
|---|---|---|
| `buildtools/` (monthly refresh pipeline) | previous owner — full export requested with a prepared prompt (15 Oct 2026) | the October 2026 data refresh |
| Current `tools/test-ai-analyst.js` (8,402 bytes) | previous owner (same export) | a fully green, blocking AI Analyst test |
| Previous `CLAUDE.md`, July PRD, `migration-kit/`, anonymised base/IRR fixtures | previous owner (same export) | full trap history; realistic test files; KI-005 answer |

## Next steps
1. Owner: approve merging the KI-001 pull request (republishes the site).
2. Owner: approve protecting `main` with a ruleset (pull request + "Dashboard checks" required, no
   force-push or deletion) — a repository-settings change, see docs/DEPLOYMENT.md.
3. When the previous owner's export arrives: restore `buildtools/` (adjust its `targets` to the single
   `index.html`, fix `postcheck.js`'s hard-coded path), add a `refresh-operator` agent and a
   `docs/MONTHLY_REFRESH.md` runbook, dry-run the September rebuild (acceptance check 8); use the
   anonymised fixtures to settle KI-005.
4. Open one exported deck/workbook in PowerPoint/Excel (acceptance check 7).
5. After full testing of the new build: the owner schedules retiring the previous owner's site.

## Backlog (prioritised; each item needs the owner's go-ahead)
| Priority | Item | Type |
|---|---|---|
| P1 | Restore the monthly refresh pipeline (`buildtools/`) and run the Oct 2026 refresh | operations |
| P2 | KI-002 / KI-003 — overlap matrices missing from the exported deck | defect |
| P2 | KI-005 — confirm base-file XIRR units with an anonymised real file; add a magnitude guard if needed | data integrity |
| P2 | KI-035 — IPS profile and cost distributor carry from one family to the next | defect |
| P2 | KI-004 — decide the AMC-cap basis for the AI Analyst | product decision |
| P2 | KI-008 — escape rendered cell text; add a CSP meta tag that enforces "no network" | security |
| P2 | Replace the stale AI Analyst test; make it blocking in CI | quality |
| P3 | KI-006 / KI-007 — missing XIRR / invested value treated as 0 in totals | data integrity |
| P3 | KI-012 — limit identifying data kept in localStorage | privacy |
| P3 | KI-013, KI-022, KI-024, KI-031, KI-032 — upload consistency, tax dating, benchmark routing, reset | defects |
| P3 | KI-029 — AI Analyst signal weights sign-off | product decision |
| P4 | Low-severity items in KNOWN_ISSUES.md | defects |

## Change log pointer
See `CHANGELOG.md` and `git log`.
