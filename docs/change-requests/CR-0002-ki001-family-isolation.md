# CR-0002: Fix KI-001, and request a full export from the previous owner

- **Requested:** 15 Oct 2026, by the product owner: "go ahead and fix KI-001 first and simultaneously create
  a prompt for the previous owner…"
- **Status:** done.

## Request
1. Fix KI-001: a second client's base file loaded in the same browser tab inherited the previous family's
   state.
2. Write a prompt the previous owner can run in their Claude to export everything about the project,
   including what is only needed later. The owner later asked that it say nothing about retiring or deleting
   the existing dashboard, which happens only after full testing of the new build.

## Decisions
- D-015: what a new base file clears. Client uploads and all per-family state are cleared; market-data
  uploads are kept; the first load clears nothing.
- D-016: every change to `index.html` is a committed patch script that uses `tools/patch-lib.js`.

## Changes
- PR [#1](https://github.com/productsteamcentricity/portfolio-review-dashboard/pull/1), merged as `9f018e4`
  on 15 Oct 2026. It contains `ba0650d` (CI comment), `99b306b` (patch helper and browser check), `4579cd5`
  (the fix, `index.html` MD5 `173F86CA…` → `F0EB0101…`) and `c59e54c` (docs).
- The export prompt is in OneDrive, under `03 Handover\2026-10-15 Export request\` (not in this public
  repository).

## Verification
- `tools/browser-checks/family-isolation.js`: `isolation()` failed before the fix and passes 9/9 after it;
  `irrBeforeBase()` and `removeThenReload()` pass.
- Single-family results are unchanged: 61-slide deck, 15-sheet workbook, Fund IRR 13.09% vs 11.88%.
- CI passed. After the merge, the live site served the merged file: SHA-256 match, 16,768,244 bytes.
- The previous owner ran the prompt and delivered T1–T3 on 15 Oct 2026 (CR-0003).
