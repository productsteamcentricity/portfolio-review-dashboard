# Reference data (`data/refdata/`)

The reference data the new application embeds, one JSON file per block of the legacy page's embedded data
(roadmap milestone M1.3; parity rows E-89 to E-108 in
[05-feature-parity-matrix.md](../../docs/new-build/05-feature-parity-matrix.md)). Every file except this README is
**generated**: never edit one by hand.

```bash
node scripts/data-extract.ts           # rewrite every file from index.html
node scripts/data-extract.ts --check   # exit 1 unless the files equal what would be written
```

## What is here

| File | Content |
|---|---|
| `<BLOCK>.json` | one block of `window.REFDATA` in `index.html` (for example `MF_PERF.json`), or `MF_ER_TABLE.json` from `window.MF_ER_TABLE` |
| `FUND_RANKS_CODES.json` | the AMFI scheme code of every fund in the legacy `FUND_RANKS` block, and nothing else (see below) |
| `VINTAGE.json` | the data month, the legacy `DATA_DATES` as they are, and per file: record count, SHA-256, data source, publication class and as-on date |

**Not extracted.** `FUND_RANKS` holds the Products Team's fund scores and ranks. Screener scores and ranks are never
committed or published by the new application (D-026); they come only from the MF Screener data pack the owner
uploads into the app. The new application keeps the scheme codes only, as the identifier crosswalk's input (E-104,
milestone M2.1), so `FUND_RANKS_CODES.json` maps each fund name to its AMFI code and carries no category, rank,
score, count or status. `FUND_RANKS_META` (the ranks cycle and the counts of ranked funds) is not extracted; its
cycle date is `DATA_DATES.ranks`. `DATA_DATES` itself lives in `VINTAGE.json` (`legacyDataDates`, E-107).

## Format

Deterministic, so a monthly change reads as a line diff: object keys sorted at every level, arrays in their order,
one top-level entry per line, LF line ends and a final newline. Values are those of the embedded block: the parity
test `tests/parity/refdata.parity.test.ts` proves each file deep-equal to the object the legacy page runs on (read
through `tools/engine-host.js`), and the files byte-equal to the extractor's output. The legacy key order is not kept
(keys are sorted), so code must never depend on the order of an object's keys.

## As-on dates

A block's `asOn` in `VINTAGE.json` comes from the `DATA_DATES` key the legacy refresh pipeline advances when it
rebuilds that block (`buildtools/build_refresh.js`, `build_risk.js`, and the ranks cycle): `analytics` for
`EQUITY_ANALYTICS`, `performance` for `MF_PERF` and `BENCH_RET`, `direct`, `sif`, `fmgr`, `risk` and `ranks`. Every
other block records no date in the embedded data, so its `asOn` is null with the status NOT AVAILABLE IN SUPPLIED
DATA; no date is assumed. The data month is the month of `DATA_DATES.performance`.

## Publication

The files hold the same data `index.html` already publishes. Each block's data source and class are recorded in
`VINTAGE.json` from [06-data-source-inventory.md](../../docs/new-build/06-data-source-inventory.md): the Accord
blocks are class P (D-023, D-026); `MF_RISK`, `PMS_PERF` and `AIF_PERF` are derived from class C sources whose
derived data may be published; the fund ranks are reduced to scheme codes. No client data is ever here.

The private deny-list of the pre-push scanner is not applied to the generated block files, for the reason it is
not applied to `index.html` (D-033): the public vendor data names listed companies and fund managers. Every generic
rule still applies, and this README and `VINTAGE.json` are scanned in full
([safety-tooling.md](../../docs/new-build/safety-tooling.md)).
