# CR-0005: Share the review link, find and fix the dashboard's issues, prepare the redesign

- **Requested:** 16 Oct 2026, by the product owner.
- **Status:** in progress.

## Request
1. **Share the working link** that will be used for reviews, so testing can start.
2. **Find any possible issues and start fixing them.** The owner has also found several issues with the existing
   dashboard.
3. **Ultimate aim:** build the review dashboard here, then make improvements. These include major design changes
   (a full revamp) and fixes to the outputs.
4. Question: start now, or wait for the previous owner's files?

## Answers and decisions
- **The review link** is https://productsteamcentricity.github.io/portfolio-review-dashboard/.
  - It is the permanent address: every approved change and monthly refresh publishes there.
  - It is public to anyone who has the link.
  - On 16 Oct 2026 it was verified to serve `main` exactly (MD5 `F0EB0101…`).
- **Start now.** Nothing in the fixes or the redesign depends on the previous owner's files. Those files add the
  monthly risk-ratio refresh and real-format test fixtures.
- **Order of work:**
  1. Fix calculation, data, export and security issues first. These fixes survive any redesign.
  2. Defer purely visual fixes to the redesign.
  3. Start the redesign by restructuring the single 16.8 MB file into source files that build the same offline
     page. This needs the owner's approval first.

## Audit (19 Oct 2026)
- **Scale:** seven area auditors, 72 findings, every one independently reproduced.
- **Result:** 67 issues (52 new, KI-047 … KI-098), with 25 owner questions.
- **Files:**
  - [`../audits/2026-10-19-full-audit.md`](../audits/2026-10-19-full-audit.md): register, evidence, fix approach;
  - [`../audits/2026-10-19-decisions.md`](../audits/2026-10-19-decisions.md): the 25 questions with recommendations.

## Fixes
Shipped in batches, each on its own branch and PR, with known-answer tests. Financial changes are reviewed first
(rule 7). The order is the register's "fix now" list:
1. engine numbers;
2. reference-data joins;
3. uploads and parsers;
4. security;
5. exports;
6. robustness;
7. UI wiring that changes deck numbers.

| Batch | PR | Issues | Status |
|---|---|---|---|
| 1a. Engine numbers (first part of batch 1; the rest of batch 1 follows as 1b) | #4 | KI-047 (XIRR solver), KI-055 (hybrid stocks), KI-006 (partial XIRR coverage), KI-065 (debt MF tax) | fixed; smoke 35/35; financial review approved; raised OD-26 to OD-28 and KI-099, KI-100 |
| 1b. Engine numbers, rest of batch 1 | #6 | KI-007 (blank invested), KI-048 + KI-100 (client-sheet IRR join), KI-061 (AMC house key), KI-062 (degraded Exit bookkeeping), KI-063 (Apply plan), KI-067 + KI-068 + KI-114 (Current vs Sample), KI-120 (AI summary house name) | fixed; two financial reviews per group; browser and PowerPoint QA passed; raised OD-29 to OD-36 and KI-101 to KI-123 |

## Open
- **Owner (answered 19 Oct 2026):** all 28 decisions accepted except OD-11. The monitor uploads stay and are to
  be made correct (D-021).
- **Owner (answered 21 Oct 2026):** OD-29 to OD-36 all accepted (D-022). OD-32 and OD-34 still to build.
- **Owner:** send their own list of issues, with a screenshot or note each.
- **Owner (21 Oct 2026):** redesign direction given as a full new-build brief (a clean new application with feature
  parity, conditional Review Snapshot, observation engine, formula-driven Excel, monthly update workflow, MF Screener
  link). Phase 0 (audit, architecture, parity matrix, roadmap) is in progress; it gets its own change request.
