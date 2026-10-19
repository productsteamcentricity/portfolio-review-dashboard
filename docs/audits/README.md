# Audits

Each audit gets two files, named by date:
- **the register:** every issue found, with evidence, fix approach and priority;
- **the decision sheet:** the questions only the product owner can answer, each with a recommendation.

Issues are also listed in [`../KNOWN_ISSUES.md`](../KNOWN_ISSUES.md) under permanent KI numbers. When a fix ships,
its entry there is marked fixed with the PR.

| Date | Scope | Files | Result |
|---|---|---|---|
| 19 Oct 2026 | The whole dashboard: calculations, parsing, PowerPoint and Excel exports, UI state, security, embedded data. Seven area auditors; every finding reproduced independently before it was kept. | [register](2026-10-19-full-audit.md) · [decisions](2026-10-19-decisions.md) | 67 issues: 52 new (KI-047 … KI-098) and 15 known. 32 P0, 26 P1, 9 P2. 25 owner questions. |

The reproduction scripts from the 19 Oct audit used only synthetic portfolios and archived vendor data, never
client data. They are kept with the audit evidence in the OneDrive project folder, not in this repository.
Each fix adds its own regression test under `tools/`.
