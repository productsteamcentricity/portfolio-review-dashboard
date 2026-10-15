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
| [CR-0003](CR-0003-organise-and-monthly-process.md) | 15 Oct 2026 | Ingest the previous owner's export; organise OneDrive and GitHub; set up the monthly update process; fix the local link | In review |
