# product_bank/: the product bank

The products Centricity offers (mutual funds, PMS, AIF, SIF and others) with their terms, performance and portfolio
snapshots, built from the monthly Investment Reckoner and the PMS and AIF one-pagers (Q-03 answered: the Reckoner is
the product-bank source). **Empty until milestone M11**, when the monthly update engine writes it
([07-implementation-roadmap.md](../docs/new-build/07-implementation-roadmap.md)). The new application reads it for
proposed products, the Annexure product cards and product performance.

## What will be here

```
product_bank/
  schema/               the JSON schema of each record type
  products/<product_id>.json                 names (each spelling with its source), external ids, type, terms, fees,
                                             benchmark, managers
  performance/<product_id>/<as_on>.json      returns by period, with the period and return basis
  snapshots/<product_id>/<as_on>.json        top holdings, sectors, market cap, ratings (always partial coverage)
  source_register/<YYYY-MM>.json             every source file used: SHA-256, class, role, records added and updated
  pins.json             owner-approved links from a name to a product (names only propose)
```

## Rules

- Every field carries its source (file SHA-256, slide, table or chart, as-on date, extraction method). A field no
  source states carries a status, never a value inferred from the product's name.
- A product id is assigned by the bank, never derived from a name; a name match only proposes a link, and a pin in
  `pins.json` confirms it.
- Re-running a month changes nothing: a source file already in the register is a no-op.
- Publication follows the data classes of D-023 and D-026
  ([monthly_updates/README.md](../monthly_updates/README.md)); no client data, ever.

The design is in [ARCHITECTURE.md](../docs/ARCHITECTURE.md) §12 and the record fields in
[DATA_DICTIONARY.md](../docs/DATA_DICTIONARY.md) §5.15.
