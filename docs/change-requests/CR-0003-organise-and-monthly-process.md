# CR-0003: Ingest the previous owner's export, organise everything, set up the monthly process

- **Requested:** 15 Oct 2026, by the product owner.
- **Status:** in review (PR pending).

## Request
1. The previous owner's replies are in OneDrive under `Previous Owner Files - Prompt Response`: three zips
   (T1, T2, T3), two Markdown files and a CSV. Take them in.
2. Create a sub-folder in the OneDrive project folder where the owner saves each month's update files, for
   Claude to pick up and refresh the dashboard.
3. Organise everything in the OneDrive project folder, and in GitHub, "extremely neatly and precisely":
   - everything in its own folder;
   - nothing lost to clutter;
   - a process anyone can follow.
4. The local link http://localhost:8099 does not work: find and fix the problem.
5. Explain the monthly update process: the owner's responsibilities, the files Claude needs, Claude's
   responsibilities.
6. Keep GitHub up to date and organised, with the record of every change the owner requests.

## Decisions
| Decision | What it settles |
|---|---|
| D-017 | Verified work the owner asked for is merged without asking again. Refreshes are reviewed by the owner first. |
| D-018 | The OneDrive layout: `01 Monthly Updates`, `02 Archive`, `03 Handover` and `99 Superseded`, with short names because of path limits. |
| D-019 | What from the export may be published: only client-free maintenance material, each file scanned first. |

## Changes

### OneDrive project folder (not in git)
- **Reorganised by moves only.** Nothing was deleted or edited. Every move is logged in
  `03 Handover\REORGANISATION_LOG_2026-10-15.csv`.
- **Top level:**
  - `README - Start Here.md`;
  - `Open Dashboard.cmd`;
  - `01 Monthly Updates` (inbox, checklist README, `2026-10` ready with `Analytics` and `Index TRI`);
  - `02 Archive` (2026-04 … 2026-09 plus `Reference`; all 75 vendor files of the handover verified by hash);
  - `03 Handover` (initial handover, export request, full export, follow-up request);
  - `99 Superseded - safe to delete` (verified duplicates).
- **14 Oct extraction.** The vendor folder extracted on 14 Oct had silently lost 21 files to the 260-character
  path limit. It was replaced by the complete T3 copy.
- **September slide exports.** These were tidied into the embedded set plus a labelled "first issue"
  subfolder. Duplicates went to `99 Superseded`.
- **Follow-up request to the previous owner.** Drafted in `03 Handover\2026-10-15 Follow-up request`. It asks
  for the risk-ratio toolchain, source files, T5 and answers to their open questions.

### Repository
- **Local preview:**
  - `serve-dashboard.js` moved to `tools/`;
  - added `tools/open-dashboard.cmd`, which starts the server if needed and opens the browser;
  - `.claude/launch.json` updated;
  - the server now serves only the dashboard and `test-data/`. It refuses other paths, such as refresh
    outputs, and refuses foreign Host headers (security review finding).
- **Documentation:**
  - `docs/README.md` (index);
  - `docs/MONTHLY_REFRESH.md` (the process and runbook);
  - `docs/change-requests/` (this record and CR-0001, CR-0002);
  - `docs/refresh-log/` (README, template, the September refresh reconstructed);
  - `docs/reference/` renamed `docs/previous-owner/handover/`.
- **Pipeline.** The monthly refresh pipeline was restored into `buildtools/`, adapted to the single
  `index.html` (see `buildtools/README.md`). Added `buildtools/intake_check.js`, the read-only intake check.
- **New agent.** The `refresh-operator` agent was added.
- **Updated docs:**
  - `KNOWN_ISSUES.md`: KI-005 rewritten; KI-036 to KI-046 added from the previous owner's knowledge dump;
  - `DECISIONS.md`: D-017 to D-019;
  - `CLAUDE.md`, `HANDOVER.md`, `DEVELOPMENT_SETUP.md`, `ARCHITECTURE.md`, `TESTING.md`, `PROJECT_STATE.md`,
    `CHANGELOG.md`.

## Verification
- **localhost:8099.**
  - Cause: nothing was listening. The preview server had been started by the previous Claude session and
    stopped with it.
  - After the fix: `Open Dashboard.cmd` starts the server and opens the page.
  - Probed with curl:
    - `/`, `/index.html` and the test files return 200;
    - `/.git/config`, `/CLAUDE.md`, `/buildtools/...` and traversal attempts return 404;
    - a foreign Host header returns 403.
  - A synthetic portfolio loads in the browser ("Loaded 13 holdings · 2 client(s)"), with no console errors.
- **Security review.** The `security-release-reviewer` agent first returned NO-GO: two lines of
  `docs/previous-owner/README.md` said where material containing client details is kept. Those lines and
  three similar location pointers were reworded, and the server was hardened as above.
- **Export.** T1–T3 match the export manifest. T3 holds all 75 vendor files of the 14 Oct handover, verified
  by SHA-256.
- **Intake check.** Run on `02 Archive\2026-09` (against 2026-08) and on 2026-08 (against 2026-07). It found
  every monthly file and the as-on dates, and flagged the re-saved workbooks. `--recheck` reported all 21
  inputs unchanged.
- **Fidelity rebuild.** The September data was rebuilt from `02 Archive\2026-09` with `build_refresh.js
  --verify` and compared with the embedded blocks. The results are in `docs/refresh-log/2026-09.md`.
- Repository checks, the privacy scan and CI: see the PR.
