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
test, and so does an active (not retired) entry no fixture uses. Each entry has:

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
| `retired` | only when a legacy fix made the live page behave as the new reader: why, naming the decision (D-n). A retired entry matches nothing, so the difference coming back fails the test, and it need not be used |
| `legacyBefore` | with `retired`: the legacy pattern before that fix (`legacy` then holds what the live page gives now) |

Fix batch 4 (D-041, CR-0009) retired BF-15, BF-16, BF-18 and BF-20 to BF-26 (KI-140, KI-143, KI-144, KI-145).

### Known differences no fixture exercises

Fix batch 4 also opened two differences that no fixture shows, so the test cannot see them (tracked as
[KI-148](../../docs/KNOWN_ISSUES.md#found-by-milestone-m13-23-oct-2026), for M1.4):

| D-041 | Live page | New reader | Why no fixture shows it |
|---|---|---|---|
| point 2, merged purchase date and holding days | the earliest purchase date of the folios; holding days recomputed from it, blank when the folios do not count to one date | the first row's purchase date and holding days (`DATA_DICTIONARY.md` §5.3 and §8) | `family-a-merged-folios` gives every folio of a holding the same date and days |
| point 3, an Instrument Name "Total" or "Grand Total" | skipped, with a warning | read as a holding, with a Warning | `family-a-skipped-rows` has a total row only with a blank Instrument Name, which both skip |

Neither is a ledger entry yet: a fixture case would need a class for a legacy fix the new reader has not followed,
and the ledger has only `correction`, `improvement` and `regression`. M1.4 adds the fixture cases with the owner's
answer to D-041 question 1 (the holding days of a merged holding) and the new build's rule for total rows, and either
aligns the reader or ledgers what still differs.

Before comparing, representation is normalised (`base-file-compare.ts` `projectNew`): labels as strings, XIRR as a
fraction, Crore amounts, the purchase date as "D Mon YYYY", folios joined by "/", the asset as the new class (null
when unknown, never the label as given, so an unrecognised label shows as a difference). The class is compared with
the legacy label exactly. Until fix batch 4 the legacy kept the label as written (spaces collapsed), so "EQUITY"
beside "Equity" was a second allocation row in the legacy and one class in the new reader (BF-26,
[KI-145](../../docs/KNOWN_ISSUES.md#found-by-milestone-m13-23-oct-2026)). Since D-041 the legacy reads the label as its
class too (`ENGINE.assetLabel`: letter case, spacing and the OD-7 synonyms folded); a blank label is still Equity
there (BF-14) and an unrecognised one keeps its label (BF-19). What remains is behaviour.

To add an entry: make the new behaviour, run the test to see the unmatched difference, and add the narrowest entry
that matches it (name the fixture; prefer an exact legacy value) with its decision. Improvements that change a
client-facing number are listed in the pull request for the owner.

## Golden files

Calculations that live in the legacy UI script cannot run headless; their parity uses golden files captured from
the page in the browser on the synthetic books (`golden/`, from the milestone that ports them). None exist yet.
