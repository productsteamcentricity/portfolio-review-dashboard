# Replication report — baseline of 14 Oct 2026

What was received, what was reproduced, how it was verified, what differs from the source, and what is
still outstanding. Written at the end of Stage A (baseline replication); no product code was changed.

## 1. Outcome in one paragraph
The dashboard was replicated byte-for-byte: `index.html` is identical to the source repository's
`main` at commit `cab22e6747c02b87f0f95466874b3209edc5da22` **and** to the file the live GitHub Pages
site serves (16,765,556 bytes; MD5 `173F86CAC1E5D0AC8FFD5A66042A3B4C`; SHA-256 `389587b1…8f3b`). It runs
locally in the browser and headlessly in Node; every handover acceptance check that the received
material allows passes, except the visual Office check (pending a human) and the refresh-pipeline dry
run (pipeline not received). The repository was set up at `C:\dev\portfolio-review` with documentation,
checks, CI, a Pages workflow and project agents, committed in three reviewable commits and pushed to
the owner's new **public** repository `productsteamcentricity/portfolio-review-dashboard` (D-008),
whose Pages workflow publishes the dashboard.

## 2. Source inventory (materials received)

| Item | Received as | Verified |
|---|---|---|
| Source repository | `Portfolio_Review_Dashboard-main (1).zip` — GitHub archive, 8 files (10 entries incl. 2 folders) | zip comment = commit `cab22e6…`; = HEAD of `main` of the public repo `magazineishita1108-boop/Portfolio_Review_Dashboard` (1 branch, 0 tags) |
| Live site | `https://magazineishita1108-boop.github.io/Portfolio_Review_Dashboard/` | serves a byte-identical `index.html` (SHA-256 match), last modified 14 Oct 2026 08:39 GMT |
| Handover PRD | `HANDOVER_PRD_Centricity_Portfolio_Review.md` (41,559 bytes) | read in full; kept verbatim in `docs/reference/` |
| Project history | `PROJECT_HISTORY_Portfolio_Review_Dashboard.md` (18,054 bytes) | read in full; kept verbatim in `docs/reference/` |
| Vendor data archive | `For Centricity Portfolio Review Portal.zip` (171.7 MB; 55 files, Apr–Sep 2026 month folders) | inventoried only; licensed data, stays on OneDrive, never committed |
| Chat history | not received as transcripts | the project history document is a reconstruction from the previous owner's records |

**Not received** (named in handover §2.2 as required or recommended): `buildtools/` (the monthly refresh
pipeline, 21 scripts), the previous `CLAUDE.md`, `PRD_Centricity_Portfolio_Review_Dashboard.md` (July
as-built spec), the current `tools/test-ai-analyst.js` (8,402 bytes), `serve-dashboard.js` and
`.claude/launch.json` (recreated), `IMPLEMENT_AI_Analyst_Tab.md`, `refresh_scripts/`,
`Rebalancing_Proposed_Fund_Universe.json` (its 143 names are already inside `index.html`),
`migration-kit/`, `CONVERSATION_SUMMARY_Portfolio_Review_Dashboard.md`, a dummy base file (replaced by
the synthetic generator).

## 3. What was done
1. Inventoried the inputs; read the handover and history; checked the zip's commit SHA, the source
   repository's metadata and the live site's bytes.
2. Verified `index.html`: size, MD5, 13 real script blocks (+1 literal), tail, LF-only, no BOM; census of
   every reference-data block against handover §6.3 (all counts match); no network API in app code.
3. Two read-only archaeology reviews of the engine/parsers and the UI/exporters against every handover
   claim (results folded into ARCHITECTURE.md and KNOWN_ISSUES.md).
4. Installed a portable toolchain (owner-approved): Node 24.21.0, Git 2.56.0.2, gh 2.102.0, SHA-256
   verified; `core.autocrlf=false`.
5. Created the repository outside OneDrive and imported the 8 source files; verified each byte-identical.
6. Applied the handover's mandatory setup fix (`tools/engine-host.js` ROOT) and sanitised two client
   references (D-003).
7. Ran the engine headlessly; characterised the one AI Analyst test failure (stale test, KI-010).
8. Built synthetic test data with exact-answer XIRRs; wrote `check-invariants`, `smoke-review`,
   `extract-blocks`; recreated `serve-dashboard.js`.
9. Browser acceptance in the built-in Chromium: load, upload base + IRR, all 20 tabs, console, network,
   PPTX and XLSX exports (captured in memory), cross-family check.
10. Documentation, decision register, known issues, CI and Pages workflows, five project agents.

## 4. Differences between the source and this repository

| File | Change | Effect on the product |
|---|---|---|
| `index.html` | **none** | — |
| `README.md` | maintainer section and analyst safety notice added; Pages instruction corrected (the original "Build from branch" would now publish the whole repository); browser and date-label wording aligned with the UI | none |
| `.gitignore` | client-name pattern removed; hardened (office/data formats, vendor folders, backups, local settings) | none |
| `tools/engine-host.js` | `ROOT` = repo root instead of the previous owner's OneDrive path | Node tooling can run |
| `tools/render-slides.js` | client name in a usage comment replaced by `<client name>` | none |
| added | `.gitattributes`, `serve-dashboard.js`, `.claude/`, `.github/workflows/`, `docs/`, `CLAUDE.md`, `CHANGELOG.md`, `tools/check-invariants.js`, `tools/smoke-review.js`, `tools/make-sample-base.js`, `tools/extract-blocks.js` | none (development only; Pages publishes `index.html` alone) |
| not carried | `Portfolio_Review.html` and `github-repo/` copies | single working copy (D-001) |

Git history: **not** imported — fresh repository with provenance recorded (D-002).

## 5. Handover document errata found during verification
The handover remains the best narrative of the project, but these statements do not match the code or
the files:

| Handover | Finding |
|---|---|
| §5.1: base-file XIRR / BMXIRR are fractions (0.0879 = 8.79%) | the engine reads them as percent numbers and divides by 100 (`07_engine.js:736`); template header `XIRR (%)` (KI-005). Allocation is a fraction. |
| §3 step 5: census with `node -e "…require('./tools/engine-host.js')…"` | fails under `-e` (UMD bundles); works from a script file (KI-011) |
| §3 step 1: `index.html` has 11,732 line endings | it has 11,752 (LF only); the MD5 matches, so this is a typo |
| §5.2: IRR upload "required for the Fund IRR tab" | the tab falls back to base-file XIRR without it; the upload is required for Taxation and transaction XIRR |
| §5.1: 19-column base file | the in-app template has 18 columns (no Folio No / Allocation / Holding Days); all are optional to the parser |
| §7: tab order "is also the deck order" | AI Analyst and Taxation are exported after the Annexure divider (KI-014) |
| §7 / §8: AMC cap 20% of MF CMV | true for the AMC tab; the AI Analyst uses total CMV (KI-004) |
| §8: "every analytics block normalises to exactly 100.00%" | true for market-cap / sector / rating mixes (verified on every embedded record but one, KI-027); issuer lists are top-30 and do not sum to 100 |
| §5.2 slot table | sidebar order is mon, pms, bonds, sif, dir, irr, mkt; the Market Update reset does not restore the embedded slides (KI-009) |
| §5.1 / §7: optional Purchase Date feeds the Taxation tab | Purchase Date is parsed and displayed only (`07_engine.js:759`); Taxation dates its lots from the IRR sheet (KI-022) |

## 6. Verification summary
See `docs/TESTING.md` §2–3 for every result. In short: invariants hold (1 data warning); smoke test
26/26; AI Analyst test 16/17 (stale test); browser load, review, IRR, exports and network audit pass;
visual Office check not yet done; refresh pipeline blocked. An independent review of the docs, tools
and workflows before the first commit found four blocking and ~25 minor issues; all were corrected
(or, for the staged-file finding, shown to be the intended three-commit sequence).

## 7. Outstanding (needs the owner)
1. Approve protecting `main` with a ruleset (pull request + "Dashboard checks" required, no
   force-push) — a repository-settings change.
2. From the previous owner: `buildtools/`, the current `tools/test-ai-analyst.js`, the previous
   `CLAUDE.md`, the July PRD, `migration-kit/`, `refresh_scripts/` (reference). Without `buildtools/`
   the October data refresh cannot be run as before.
3. Decide on KI-001 fix (recommended first change), KI-004 (AMC basis), KI-005 (confirm base-file XIRR
   units with an anonymised real file), KI-029 (AI Analyst weights sign-off).
4. Ask the previous owner to unpublish the old Pages site and delete or archive that repository (its
   commit messages contain client names).
5. Open one exported deck and workbook in PowerPoint/Excel to complete acceptance check 7.
