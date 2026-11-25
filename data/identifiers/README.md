# Identity data (`data/identifiers/`)

Curated identity data for the new application's crosswalk (`app/src/engine/match/crosswalk.ts`; architecture §6.3;
roadmap M2.1). Only data a person decides or a source states goes here, each entry with its source and date:

| File (when it exists) | Content | Who decides |
|---|---|---|
| (moved) | Fund-name aliases live in [`data/owner/fund-aliases.json`](../owner/README.md) (16 lines, PD-36, 25 Nov 2026); fund-house aliases (KI-117) will join `data/owner/` | The owner, line by line (OD-5, PD-36) |
| `renames.json` | Scheme rename history (old name, new name, date, public evidence: an AMC notice, AMFI or the vendor data) | Recorded from public evidence; none yet |
| `amfi-codes.json` | The AMFI scheme code map (DS-H4), when received, with its source and date | Data owner |

What is **not** here:

- The crosswalk itself. It is built at load time from `data/refdata` (FUND_RANKS scheme codes, STOCK_RET ISINs), so a
  monthly refresh never has to regenerate a file of the new build (M2 plan v2, 23 Nov 2026).
- The live page's own name lists (ALIASES pins and blocks, EXACT_ONLY). They are ported as code in
  `app/src/engine/match/name-lists.ts` and checked against `index.html` by `tests/unit/match/name-lists.test.ts`, never
  copied here by hand.
- Screener scores or ranks (D-026), and client data of any kind (CLAUDE.md rule 6).
