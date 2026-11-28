# Identity data (`data/identifiers/`)

Curated identity data for the new application's crosswalk (`app/src/engine/match/crosswalk.ts`; architecture §6.3;
roadmap M2.1). Only data a person decides or a source states goes here, each entry with its source and date:

| File (when it exists) | Content | Who decides |
|---|---|---|
| (moved) | Fund-name aliases live in [`data/owner/fund-aliases.json`](../owner/README.md) (21 lines, PD-36: 16 of 25 Nov 2026 and lines 18 to 22 of 28 Nov 2026); fund-house aliases (KI-117) will join `data/owner/` | The owner, line by line (OD-5, PD-36) |
| `renames.json` | Scheme rename history (old name, new name, date, public evidence: an AMC notice, AMFI or the vendor data) | Recorded from public evidence; none yet |
| `amfi-isin.json` | Fund ISIN to AMFI scheme code, and code to official name, written by `scripts/amfi-isin.ts` from the monthly NAV fetch's ids file (MOD-04's decision of 25 Nov 2026, option (a); public AMFI data). ISINs of the form `^IN[A-Z0-9]{10}$` only; an ISIN on several codes is left out and listed. Not written yet: the first real file comes from the December refresh | The refresh operator fetches; NB-02 writes the file |

What is **not** here:

- The crosswalk itself. It is built at load time from `data/refdata` (FUND_RANKS scheme codes, STOCK_RET ISINs), so a
  monthly refresh never has to regenerate a file of the new build (M2 plan v2, 23 Nov 2026).
- The live page's own name lists (ALIASES pins and blocks, EXACT_ONLY). They are ported as code in
  `app/src/engine/match/name-lists.ts` and checked against `index.html` by `tests/unit/match/name-lists.test.ts`, never
  copied here by hand.
- Screener scores or ranks (D-026), and client data of any kind (CLAUDE.md rule 6).
