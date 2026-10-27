# Change requests

One file per request from the product owner, numbered in order: `CR-NNNN-<slug>.md`. Each record holds:

- **Request:** what was asked, and when.
- **Scope:** the acceptance criteria and the non-goals.
- **Decisions:** what was decided, and by whom.
- **Changes:** files, commits and pull requests.
- **Verification:** what was tested and the results.
- **Status:** open, in review, done or superseded, with any follow-ups.

Monthly data refreshes are recorded separately in [`../refresh-log/`](../refresh-log/). Defects are tracked in
[`../KNOWN_ISSUES.md`](../KNOWN_ISSUES.md). Decisions that outlive one request also go to
[`../DECISIONS.md`](../DECISIONS.md).

| CR | Date | Request | Status |
|---|---|---|---|
| [CR-0001](CR-0001-baseline-replication.md) | 14 Oct 2026 | Replicate the existing dashboard, set up the repository, documentation and GitHub | Done |
| [CR-0002](CR-0002-ki001-family-isolation.md) | 15 Oct 2026 | Fix KI-001; write the full-export prompt for the previous owner | Done |
| [CR-0003](CR-0003-organise-and-monthly-process.md) | 15 Oct 2026 | Ingest the previous owner's export; organise OneDrive and GitHub; set up the monthly update process; fix the local link | Done (PR #2) |
| [CR-0004](CR-0004-second-export-request.md) | 15–16 Oct 2026 | Prepare the second export request for the previous owner (everything in one run, delivered over Teams) | Done; delivery awaited |
| [CR-0005](CR-0005-audit-fixes-and-redesign.md) | 16 Oct 2026 | Share the review link; find and fix the dashboard's issues; prepare the full redesign | In progress |
| [CR-0006](CR-0006-new-build.md) | 21 Oct 2026 | Build the next-generation dashboard: a clean new application with feature parity, per the owner's brief | Phase 0 delivered; M1.1 in progress |
| [CR-0007](CR-0007-legacy-batch-2a.md) | 21–22 Oct 2026 | Fix batch 2a: empty Home slide download (KI-124), renamed fund houses (OD-32), "AMC not given" (OD-34, KI-112) | Done (PR #9) |
| [CR-0008](CR-0008-live-tax-rules.md) | 24 Oct 2026 | Live-page tax rules follow the TY 2026-27 Tax Reckoner (KI-160 to KI-182, D-040) | In progress: part T1 built |
