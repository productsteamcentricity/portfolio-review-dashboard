# From the previous owner

The dashboard was built between May and Oct 2026 by its previous owner, working with Claude (Cowork, then
Claude Code). They handed it over in two steps. This folder holds the parts that are **free of client data and
useful for maintenance** (D-019). Everything else is kept privately by the owner, exactly as received.

These are background documents. Where they disagree with the current docs (`docs/HANDOVER.md`,
`docs/KNOWN_ISSUES.md`, `docs/MONTHLY_REFRESH.md` …), the current docs win. Known corrections:
- `docs/REPLICATION_REPORT.md` §5;
- `knowledge/KNOWLEDGE_DUMP.md` §0.1.

## Published here

| File | What it is |
|---|---|
| [`handover/HANDOVER_PRD_Centricity_Portfolio_Review.md`](handover/HANDOVER_PRD_Centricity_Portfolio_Review.md) | The handover and product spec (14 Oct 2026): architecture, the 20 tabs, the refresh runbook as they ran it, the rules. |
| [`handover/PROJECT_HISTORY_Portfolio_Review_Dashboard.md`](handover/PROJECT_HISTORY_Portfolio_Review_Dashboard.md) | How the project evolved, May–Oct 2026. |
| [`knowledge/KNOWLEDGE_DUMP.md`](knowledge/KNOWLEDGE_DUMP.md) | Everything known that the handover did not say. It covers the refresh as actually performed, every source file and its quirks, manual steps, alias tables, the reasoning behind hard-coded values, base-file formats and units, the slides, and tooling traps. **Public copy:** §4.2–4.4, §8 and §10 are left out. |
| [`knowledge/DECISIONS_LOG.md`](knowledge/DECISIONS_LOG.md) | Every product, data and engineering decision, May–Oct 2026, with who decided and what it superseded. **Public copy:** two phrases shortened. |

The refresh pipeline from the export is in `buildtools/` (see its README). The current AI Analyst test
replaced the stale `tools/test-ai-analyst.js` (KI-010).

## Kept private (not in this repository)

| Material | Why it is not published |
|---|---|
| The export's report, inventory and manifest | Describe the previous owner's machine and folders |
| T1: the earlier specs, build and fix prompts, the old `CLAUDE.md`, PRD drafts, backend notes, migration kit | Not suitable for publication; superseded by this repository's docs. |
| T1: the previous owner's copies of `index.html` and the tools | Superseded. Their `index.html` is the baseline (MD5 `173F86CA…`) without the KI-001 fix. |
| T2: `SESSION_INDEX.md`, session notes, Claude configuration | Working notes per session |
| T3: vendor data (Accord Fintech) | Licensed third-party data |
| The full `KNOWLEDGE_DUMP.md` and `DECISIONS_LOG.md` | The parts left out of the public copies |

Not received (still with the previous owner):
- T4, which stays with them by design;
- T5, the backups;
- the risk-ratio toolchain (`C:\Temp\navwork`) and some source files. These are asked for in the follow-up
  request.
