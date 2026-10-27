# Parity tests

The new application against the legacy page (`index.html`), on synthetic data only
([08-regression-test-plan.md](../../docs/new-build/08-regression-test-plan.md) §5.4). The legacy engine runs headless
through `tools/engine-host.js` (from a script file, never `node -e`, KI-011).

| Test | Ledger |
|---|---|
| `base-file.parity.test.ts` (with `base-file-compare.ts`) | `base-file-ledger.json` |
| `aggregation.parity.test.ts` (with `aggregation-compare.ts`) | `aggregation-ledger.json` |
| `refdata.parity.test.ts` | none: the extracted reference data must equal the embedded blocks exactly |

## The ledger

Every difference between the legacy output and the new one is a ledger entry; an unclassified difference fails the
test, and so does an entry no fixture uses. Each entry has:

| Field | Meaning |
|---|---|
| `id` | `BF-nn` for the base file |
| `kind` | `field` (a compared field differs), `field-not-carried` (a legacy field the new model does not keep), `holding-only-in-new`, `holding-only-in-legacy`, `order`, `unit-hint` |
| `field` | the legacy field name, for the field kinds |
| `fixtures` | the fixture ids where the difference is expected, or `"*"` |
| `legacy`, `new` | value patterns: an exact JSON value, `"*"` for any value, `{"type": "number"}`, or `{"timesLegacy": k}` (the new value is k times the legacy one) |
| `class` | `correction` (a known defect fixed: a KI or OD is named), `improvement` (a requirement changes the output), `regression` (a defect of the new code: never merged, fix it instead) |
| `reference` | the decision or issue the difference rests on (OD-n, KI-n, D-n, BR-n.n) |
| `description` | one plain paragraph, no en or em dash |

Before comparing, representation is normalised (`base-file-compare.ts` `projectNew`): labels as strings, XIRR as a
fraction, Crore amounts, the purchase date as "D Mon YYYY", folios joined by "/", the asset as the new class (null
when unknown, never the label as given, so an unrecognised label shows as a difference). The class is compared with
the legacy label exactly. The legacy label is already whitespace-normalised (`ws()`, `07_engine.js:818`), and its
letter case matters to the legacy: it lower-cases the label where it routes a holding (for example `isCommodity`,
`07_engine.js:626`, and `bucketOf`, `:1605`), but its Asset Allocation keys on the exact label
(`07_engine.js:1150-1159`), and the IPS reads the allocation rows by assignment (`11_app_ui.js:4871-4878`). So
"EQUITY" beside "Equity" is a second allocation row in the legacy and one class in the new reader (BF-26,
[KI-145](../../docs/KNOWN_ISSUES.md#found-by-milestone-m13-23-oct-2026)). What remains is behaviour.

To add an entry: make the new behaviour, run the test to see the unmatched difference, and add the narrowest entry
that matches it (name the fixture; prefer an exact legacy value) with its decision. Improvements that change a
client-facing number are listed in the pull request for the owner.

## The aggregation ledger

`aggregation.parity.test.ts` runs the legacy `computeReview` (from a script file, through `tools/engine-host.js`, on
the rows of `parseBaseRows`) and the new `engine/review.ts` on the same fixtures: the variants of the synthetic book
and of `tools/make-sample-base.js`'s book, that script's two files, and the overview variants of
`tests/fixtures/make-books.ts` (`overviewVariants`) except `hostile`, whose labels (`constructor`, `__proto__`) break
the legacy engine, which keys its allocation on a plain object. It compares the totals (`totalCMV`, `totalInv`,
`totalGL`, `invMissing`), the Asset Allocation rows, the liquidity pie and the client and distributor matrices, at
1e-9 relative plus 1e-12 absolute, after projecting both sides into one shape (`aggregation-compare.ts`). Entries are
`AG-nn`, with the fields of the table above and these differences:

| Field | Meaning |
|---|---|
| `kind` | `total` (the review totals and the Grand Total row), `asset-row`, `product-row`, `row-order` (the order of the rows both sides have, or of the matrix columns), `liquidity`, `matrix-col`, `matrix-cell` (a cell, or a matrix row present on one side only), `column-label` (the not-given column, labelled with the dash in the legacy), or `"*"` for any |
| `field` | `cmv`, `invested`, `gain`, `withoutInvested`, `pct`, `presence`, `row-presence`, `order` or `label`; one, a list, or absent for any |
| `key` | the row: the class, "class / product", the liquidity label, "level: column", "level: row @ column", or "client rows" for an order; exact, a list, or a regular expression between slashes |
| `legacy`, `new` | value patterns: an exact JSON value, `"*"`, or `{"type": "number"}` |

The ledger has no regression. Its corrections follow from the base-file entries they name (BF-nn): a holding the new
reader excludes or reads into another class moves the totals, the percentages and the matrix cells with it. The
improvements are the D-039 rules (one asset order in the matrices; the not-given column label).

## Golden files

Calculations that live in the legacy UI script cannot run headless; their parity uses golden files captured from
the page in the browser on the synthetic books (`golden/`, from the milestone that ports them). None exist yet.
