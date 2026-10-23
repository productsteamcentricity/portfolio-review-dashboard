# Parity tests

The new application against the legacy page (`index.html`), on synthetic data only
([08-regression-test-plan.md](../../docs/new-build/08-regression-test-plan.md) §5.4). The legacy engine runs headless
through `tools/engine-host.js` (from a script file, never `node -e`, KI-011).

| Test | Ledger |
|---|---|
| `base-file.parity.test.ts` (with `base-file-compare.ts`) | `base-file-ledger.json` |
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

## Golden files

Calculations that live in the legacy UI script cannot run headless; their parity uses golden files captured from
the page in the browser on the synthetic books (`golden/`, from the milestone that ports them). None exist yet.
