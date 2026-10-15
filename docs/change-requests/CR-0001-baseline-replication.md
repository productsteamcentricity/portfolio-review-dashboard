# CR-0001: Baseline replication and repository setup

- **Requested:** 14 Oct 2026, by the product owner (the master project brief).
- **Status:** done.

## Request
Replicate the existing Portfolio Review Dashboard on this laptop exactly, without redesigning it. Establish a
reproducible environment, documentation and specialist agents. Transfer the project to the owner's own GitHub
repository. Then stop and wait for further requests.

## Decisions (owner, 14–15 Oct 2026)
- Portable Node.js / Git / GitHub CLI in `C:\dev\tools` (D-006).
- Repository in a new public account, `productsteamcentricity/portfolio-review-dashboard`, with free GitHub
  Pages (D-008, superseding the first choice of a private organisation repository).
- Commits under "Products Team Centricity" with the GitHub noreply address (D-008).
- Fresh history, with the old commit messages left out because they contain client names (D-002).

## Changes
- Commits `511f554` (import of `cab22e6`, two client-name scrubs), `a4f8d0d` (portable tooling, checks, CI,
  Pages workflow) and `af96042` (docs and agents), pushed to `main` on 15 Oct 2026.
- Full account: [`../REPLICATION_REPORT.md`](../REPLICATION_REPORT.md).

## Verification
- `index.html` is byte-identical to the previous owner's build and live site: MD5 `173F86CA…`, same SHA-256.
- Invariants and smoke test pass; browser acceptance and network audit pass.
- The new site served the identical file after the first Pages deployment.
