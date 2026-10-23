# data/: reference data the new application embeds

Reference data for the new application, as reviewable JSON. From milestone M1.3, `refdata/` holds the blocks the
legacy `index.html` embeds today, extracted by `scripts/data-extract.ts` and checked equal to the embedded ones
([refdata/README.md](refdata/README.md), D-035); from M11 the monthly update engine writes here from the monthly
source files ([07-implementation-roadmap.md](../docs/new-build/07-implementation-roadmap.md)).

## What will be here

```
data/
  refdata/              one JSON file per reference block (fund performance, analytics, expense ratios, index
                        series ...) and VINTAGE.json (the data month and each block's as-on date)
  owner/                owner-maintained tables, each versioned with its approval record: IPS profiles, Current vs
                        Sample assumptions, tax rules, observation thresholds (approved, D-030), category benchmarks,
                        rating map, fund and AMC aliases, index proxies
  identifiers/
    crosswalk.json      ISIN, AMFI scheme code, vendor key and product id, with rename history
  history/YYYY-MM/      compact previous vintages, for historical analytics
```

The fields of every block are defined in [DATA_DICTIONARY.md](../docs/DATA_DICTIONARY.md); where each block comes from
is in [06-data-source-inventory.md](../docs/new-build/06-data-source-inventory.md).

## What never goes here

- **Client data** of any kind (CLAUDE.md rule 6). Client files are uploaded into the application at review time and
  stay in the browser.
- **The MF Screener data pack** or anything taken from it (D-026): it is uploaded into the application and kept in the
  browser; fund holdings history comes from the stored packs, not from this folder.
- Raw class C files (the in-house risk ratios, the fund ranks, PMS and AIF performance): only data derived from them,
  where D-023 permits ([monthly_updates/README.md](../monthly_updates/README.md)).

Vendor-derived data may be published and embedded (D-023 point 1). Changes to `data/` are reviewed as data diffs, and
a monthly refresh is merged only after the owner says "publish" (D-017).
