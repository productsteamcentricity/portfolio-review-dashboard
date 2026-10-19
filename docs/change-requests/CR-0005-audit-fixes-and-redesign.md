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
| — | — | — | — |

## Open
- **Owner:** answer the 25 decisions (or "accept all").
- **Owner:** send their own list of issues, with a screenshot or note each.
- **Owner:** give redesign direction.
