# Documentation

**New here?** Start with [HANDOVER.md](HANDOVER.md). Then read the repository's `CLAUDE.md`, the rules every
change follows.

## How to…

| I want to… | Read |
|---|---|
| understand the product and how to take it over | [HANDOVER.md](HANDOVER.md) |
| run the monthly data refresh (owner's part and Claude's part) | [MONTHLY_REFRESH.md](MONTHLY_REFRESH.md) |
| set up a laptop, run the dashboard locally | [DEVELOPMENT_SETUP.md](DEVELOPMENT_SETUP.md) |
| understand how `index.html` is built and where each calculation lives | [legacy/ARCHITECTURE.md](legacy/ARCHITECTURE.md) |
| test a change | [TESTING.md](TESTING.md) |
| publish, verify or roll back the live site | [DEPLOYMENT.md](DEPLOYMENT.md) |
| check a change for client data, names and secrets before pushing (privacy scan, pre-push hook), and the state of a release before it is merged (release check) | [new-build/safety-tooling.md](new-build/safety-tooling.md) |

## The new build (CR-0006)

A new application is being built beside `index.html`, which stays the review link until the new one reaches feature
parity. No application code exists yet; its folders (`app/`, `data/`, `product_bank/`, `monthly_updates/`) each have a
README saying what will go there.

| I want to… | Read |
|---|---|
| find the Phase 0 documents (brief, audit, architecture, parity matrix, roadmap, test plan, rule bank, deck design, open questions) | [new-build/README.md](new-build/README.md) |
| know what the new application must do | [PRD.md](PRD.md) (the living PRD) |
| understand how the new application is built: stack, layers, modules, engine, outputs, security, deployment | [ARCHITECTURE.md](ARCHITECTURE.md) |
| know which monthly files may be published (classes P, C and N) and how the monthly folder is laid out | [../monthly_updates/README.md](../monthly_updates/README.md) |
| look up an entity, field, metric path, missing-data status, unit or calculation definition | [DATA_DICTIONARY.md](DATA_DICTIONARY.md) (v0.1) |
| see how the monthly update will work in the new application | [MONTHLY_UPDATE_GUIDE.md](MONTHLY_UPDATE_GUIDE.md) (planned; today's process is [MONTHLY_REFRESH.md](MONTHLY_REFRESH.md)) |
| see every file the owner supplies each month: who sends it, where it goes, public or private, what it feeds | [MONTHLY_UPDATE_GUIDE.md, "Files the owner supplies each month"](MONTHLY_UPDATE_GUIDE.md#files-the-owner-supplies-each-month) (in use now) |
| see the owner's answers for the new build | [DECISIONS.md](DECISIONS.md) D-024 to D-033 ([new-build/owner-decisions-new-build.md](new-build/owner-decisions-new-build.md)) |
| write the monthly PRD at the end of a cycle | [monthly-prds/](monthly-prds/README.md) |

## Records

| Record | What it holds |
|---|---|
| [PROJECT_STATE.md](PROJECT_STATE.md) | where things stand now: blockers, next steps, backlog, open decisions |
| [change-requests/](change-requests/) | one file per request from the product owner: what was asked, decided, changed and verified |
| [refresh-log/](refresh-log/) | one file per monthly data refresh: inputs, counts, checks, what stayed stale |
| [monthly-prds/](monthly-prds/README.md) | one monthly PRD per completed cycle from the 2026-10 data month (brief Phase 12, sections A to I) |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | every known defect and limitation, with verification status |
| [audits/](audits/) | full audits of the dashboard: the issue register with evidence, and the owner decisions they need |
| [DECISIONS.md](DECISIONS.md) | the decision register: why things are the way they are |
| [REPLICATION_REPORT.md](REPLICATION_REPORT.md) | how the baseline was replicated on 14 Oct 2026 |
| `../CHANGELOG.md` | what changed, by date |

## From the previous owner

[previous-owner/](previous-owner/) holds the handover documents as received and the client-free knowledge
from their full export of 15 Oct 2026. These are background documents: where they disagree with the files
above, the files above are current.
