# CR-0013: KI-301 (IRR-SI), the IRR cashflow file's since-inception sheets

- **Requested:** 26 Nov 2026 by the project moderator (MOD-04), urgent. Found by CHAT-010 (inferred from the code),
  flagged by CHAT-012, confirmed at runtime by EX-03 with a synthetic six-sheet file. Publish under the owner's
  delegation PD-67 when every gate passes (high client risk of the defect, low risk of the fix).
- **Built:** 26 Nov 2026 on branch `fix/irr-si-sheets` from `main` `5ec61f8`.
- **Status:** live: merged in PR #53 (main `8f34397`) on the owner's "Publish KI-301" (27 Nov 2026, 12:08 IST); page
  `6896AFEC8626BEB22357A258AB69508D`.

## Defect

The owner says analysts upload the platform's cashflow file as it is. It holds six sheets in this order: SI Xirr, SI
Bmxirr, YTD Xirr, YTD Bmxirr, QTD Xirr, QTD Bmxirr. `parseIRR` (parsers script) chose its fund sheet ("...Xirr") and
benchmark sheet ("...Bmxirr") by name, letting the last match win. So it took **QTD Xirr and QTD Bmxirr**, and every
transaction XIRR, client Grand Total, subtotal, the Fund IRR tree and the tax lots were computed from quarter-to-date
flows only, with no error. Confirmed through the live engine: fund rows from "QTD Xirr", benchmark rows from "QTD
Bmxirr". Workaround until live: keep only the SI pair in the uploaded file.

## Fix

- A sheet whose name says YTD, QTD, MTD or FYTD (a whole word) is never taken, by name or by the content fallback.
- Among the rest, a sheet whose name begins with SI as a word ("SI Xirr", "SI-Xirr", "SI_Xirr"; never "SIP Xirr") or
  with "Since Inception" is preferred: the first of each kind.
- Otherwise the legacy rule stands: the last fund and benchmark names, then the content fallback (renamed tabs).
- A file with period sheets only gives no fund rows, so the upload says it needs an SI Xirr sheet.

## Evidence

`tools/regression/IRR-SI-since-inception-sheets.js`, 19 known-answer checks in IST and UTC:
- The six-sheet file gives the same holding XIRRs, client Grand Totals and Fund IRR tree as a file with only the SI
  pair: the sample book's exact flows from `tools/make-sample-base.js`. A QTD-only file gives different figures. Each
  holding's XIRR and BMXIRR equal an independent XIRR (actual/365, bisection) of its own SI flows.
- An SI-only file and the legacy two-sheet file ("Xirr", "Bmxirr") give the same review as before.
- The sheet choice for the platform order and its reverse (SI last), SI- / SI_ / "Since Inception" names, "SIP Xirr", legacy
  names, MTD and FYTD, and period sheets only.
- The content fallback, with QTD tabs first.
- Run against the page before the fix, 7 of the checks fail.

## Review and follow-up

Financial review of 6c3074f: APPROVE WITH NOTES. Since inception is the right scope for every consumer (transaction
XIRRs, client and family figures, the Fund IRR tree, tax lots). Reviews built from six-sheet files before this fix should be
regenerated. Follow-up (not blocking; the platform's file always has the SI pair):
- the fund and benchmark sheets are chosen independently: when only one kind has an SI sheet, warn or refuse rather
  than pair periods silently; name the two sheets used in the upload status;
  (Gate B note N2 keeps this: with an SI fund sheet and no SI benchmark sheet, a legacy-named benchmark sheet could pair
  with SI flows);
- names such as 1Y, 3Y, FY26, Q2, H1, CYTD or "YTD2026" are not read as periods, nor a period word with no separator
  ("QTDXirr", Gate B note N1): with no SI sheet and more than one candidate of a kind, show the sheet taken or refuse,
  with a test for each.
- The new build is not affected: its reader (`app/src/ingest/irr-file.ts`) already prefers the SI sheets (CHAT-010,
  688c679, merged in PR #51). The SIP-name test and the pairing guard for it are on CHAT-010's branch (MOD-04, 26 Nov
  2026). The two items above stay for after December.

## Records

`CHANGELOG.md`, `docs/PROJECT_STATE.md`, `docs/KNOWN_ISSUES.md` (KI-301), this record.
