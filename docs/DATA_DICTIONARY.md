# Data dictionary (new application)

| | |
|---|---|
| Version | **v0.3**, 23 Oct 2026 (the financial review of M1.3; v0.2 was M1.3's shared model types in `app/src/model/`; v0.1 was M1.1 with the owner's answers D-024 to D-033) |
| Scope | the data model of the **new** Portfolio Review application. The legacy `index.html` is described in [legacy/ARCHITECTURE.md](legacy/ARCHITECTURE.md) and the conventions section of `CLAUDE.md`; how the new application is built is in [ARCHITECTURE.md](ARCHITECTURE.md) |
| Owns | every entity, field, metric path, missing-data status, unit and calculation definition of the new application ([09-repository-and-docs-structure.md](new-build/09-repository-and-docs-structure.md) §3). The PRD (§6), the architecture and the observation rule bank link here and do not restate these definitions |
| Built from | the Phase 0 architecture's model section ([03-architecture.md](new-build/03-architecture.md) §6, with §8, §9, §12, §16) and the record and metric-path sections of [observation-rule-bank.md](new-build/observation-rule-bank.md) (§1, §2) |
| Not here | data sources, roles, publication classes and freshness rules ([06-data-source-inventory.md](new-build/06-data-source-inventory.md)); observation thresholds (rule bank §3, to become `data/owner/observation-thresholds.json`); design tokens ([deck-design-system.md](new-build/deck-design-system.md)) |

**What v0 is.** The names, meanings and sources of every entity and field that Phase 0 specified. Field types,
enumerations and optionality are fixed in this file, in the same pull request, when each module is built (the shared
model in M1.3, then every milestone that adds fields or metrics). The "Phase 0 source" column says where each item
was specified, so a reviewer can check that nothing was added on the way.

**Implemented in M1.3** (types in `app/src/model/`, erasable TypeScript, constants only): the statuses and
`Value<T>` (§2, §3), identifiers (§4), `SourceFile` and import records (§5.1), `Holding` (§5.3), clients,
accounts, folios and ownership (§5.6), `ValidationResult` and analyst questions (§5.8) and `AuditEntry` (§5.14);
filled by the base-file reader `app/src/ingest/base-file.ts`. The other entities are still Phase 0 definitions.
`03` is `new-build/03-architecture.md`; `06` and `09` are the other Phase 0 deliverables; [DA], [IE] and [PO] are the
investigator files listed in [new-build/README.md](new-build/README.md); OD-nn are the audit decisions
([audits/2026-10-19-decisions.md](audits/2026-10-19-decisions.md)), D-nnn the [decision register](DECISIONS.md), Q-nn
and ND-n the [open questions](new-build/open-questions.md) and [owner decisions](new-build/owner-decisions-new-build.md).

---

## 1. Layers

The model has ten layers; a layer only reads the layers above it, and only L4 and L6 compute (full rules:
`03-architecture.md` §6.1).

| # | Layer | Entities (section of this file) |
|---|---|---|
| L1 | Source | `SourceFile` and raw rows with their position (5.1) |
| L2 | Normalised | `Holding`, `Transaction`, `RealisedGain`, `InstrumentRef`, `Client`, `Account`, `Folio`, `Ownership`, `Distributor` (5.2 to 5.6) |
| L3 | Validated | inclusion of each L2 record, `ValidationResult` (5.3, 5.8) |
| L4 | Calculated | `Review`: every metric a `Value<T>` with lineage; `LookThrough` per holding (5.7, 5.9, section 6) |
| L5 | Assumptions | `Assumptions` (5.10) |
| L6 | Scenarios | `RebalancingScenario` and the post-scenario `Review` from the same engine (5.11) |
| L7 | Observations | `Evidence`, `ObservationRecord`, the Review Snapshot (5.12) |
| L8 | Presentation | view-models and the `PresentationManifest` (5.13) |
| L9 | Excel | `WorkbookSpec` (5.13) |
| L10 | Audit | `AuditEntry` (5.14) |

## 2. Values and missing-data statuses

Every metric is a `Value<T>` (`03-architecture.md` §6.2):

| Kind | Fields | Meaning |
|---|---|---|
| `value` | `v`, `unit`, `prov`, optional `coverage`, optional `stale { asOf }` | a number or label. **Zero is a value.** A partial aggregate is a value with `coverage` below 1 and is shown with its coverage |
| `missing` | `status`, `reason`, optional `prov` | no value; `status` is one of the statuses below. A missing value is never printed as `0.00`, never estimated and never taken from another plan or source (`CLAUDE.md` rule 3) |

`Provenance` (`prov`): `sources` (source register ids), `method`, optional `asOf`, optional `vintage`.

Types (M1.3, `app/src/model/value.ts`): `Value<T> = PresentValue<T> | MissingValue`; `PresentValue<T>` is
`{ kind: 'value', v: T, unit: Unit, prov: Provenance, coverage?: number (0 to 1), stale?: { asOf: string } }`;
`MissingValue` is `{ kind: 'missing', status: MissingStatus, reason: string, prov?: Provenance }`. `Unit` is one of
`cr`, `pct`, `pp`, `bp`, `count`, `ratio`, `years`, `days`, `units` (units of a fund held), `date` (a DayNumber) and
`label`. A present number is always finite: NaN and Infinity are refused when the value is made
(`app/src/engine/value.ts`). The marker characters are in `app/src/config/formats.ts`, and
`app/src/views/format.ts` turns a value into cell text (the marker alone for every status, never `0.00`).

| Status | Meaning | Screen and slide | Workbook |
|---|---|---|---|
| (value 0) | a real zero | `0.00` | `0` |
| NOT DISCLOSED | the source deliberately does not state it (for example a product card without a benchmark) | `—` + footnote | blank cell + status column |
| NOT AVAILABLE IN SUPPLIED DATA | no supplied source carries it | `—` + footnote | blank + status |
| NOT APPLICABLE | meaningless for this item (YTM of an equity fund; score of an index fund) | `—` + footnote | blank + status |
| NOT COMPARABLE | bases differ (gross vs net, periods, plans) | `—` + footnote naming the bases | blank + status |
| HISTORICAL ONLY | only an older vintage exists; shown in historical views only | value with its date in historical views; `—` in current views | value in the Historical sheet only |
| CURRENT DATA NOT AVAILABLE | the current value is missing and the last known value is not used | `—` + footnote | blank + status |
| INSUFFICIENT EVIDENCE | not enough history or coverage to conclude (XIRR under 12 months, 3Y under 3 years) | `—` or absolute return, footnoted | blank + status |
| INVALID SOURCE DATA | present but failed validation | `—` + footnote; a validation result is raised | blank + status |
| STALE DATA | present but older than the freshness rule for its role (`06` §8) | value + "s" marker + footnote with its date | value + status |
| PARTIAL COVERAGE | an aggregate over a subset | value + "p" marker + coverage in the footnote | value + coverage column |

**The missing-value marker is a dash (D-029).** On screen and on slides a missing value is shown as "—" (U+2014), as in
the legacy page (OD-13, OD-29), alone in its cell or tile and always with a footnote naming its status; "s" and "p"
mark STALE and PARTIAL values. The dash is a marker only: presentation sentences (titles, observations, footnotes,
labels, chart series names) never use an en or em dash. In the workbook a missing number is a blank cell with its
status in the next column, so formulas keep working. Renderers receive the status, never a pre-formatted string; the
marker characters are configuration.

## 3. Units, rounding and dates

| Item | Convention | Phase 0 source |
|---|---|---|
| Money | held in **Crore**, unrounded; displayed in the base file's unit (Crore, Lakh or rupees; rupee-only files in Crore from 1 Cr, else Lakh) through one formatter | `03` §6.7 |
| Percentages | held as **percent numbers** (8.79 means 8.79 %), unit `pct`, never as fractions (decided in M1.3, §8); two decimals for display; inflation one decimal | `03` §6.7; rule bank §1 (thresholds such as 35 are percent numbers) |
| Rounding | unrounded maths; rounding only in the renderer; Excel receives unrounded values with number formats | `03` §6.1 rule 3 |
| Dates | day numbers, converted from raw Excel serials by one timezone-free function (the legacy +12 h shift stays in the legacy only); tests run under `TZ=Asia/Kolkata` and `TZ=UTC`. M1.3: `DayNumber` = whole days since 1970-01-01; `app/src/engine/dates.ts` `excelSerialToDay` (1900 and 1904 systems; the phantom 29 Feb 1900 is refused; a serial within one minute of midnight counts as that midnight, which absorbs the 10-second drift SheetJS adds when it writes a local-time date in IST) | `03` §6.7 |
| Evidence units | `pct`, `pp`, `bp`, `count`, `ratio`, `cr` (Crore), `years`, `label` | rule bank §1 |
| Weights | on current market value (CMV); per-client sheets re-based to the client; scopes re-based to the scope | PRD §6 |

## 4. Identifiers

Stable identifiers first, names last: a name match only proposes, and an owner-approved alias pin confirms (OD-5).

| Entity | Identifier, in order of preference | Phase 0 source |
|---|---|---|
| Mutual fund, ETF, SIF scheme | ISIN (plan level) > AMFI scheme code > vendor key (MF Monitor display name, with rename history) > alias pin > name match (proposal only); joined in `data/identifiers/crosswalk.json` | `03` §6.3 |
| Listed stock | ISIN > normalised company key | `03` §6.3 |
| PMS, AIF, other products | `product_id` assigned by the product bank; never derived from a name | `03` §6.3, §12 |
| Index | canonical index id (for example `NIFTY_500_TRI`); constituents from the Screener pack when supplied, else a named proxy fund and date | `03` §6.3 |
| Client, account, distributor | per-review id (hash of the normalised label within the review) plus an analyst-set display label; never stored outside the review | `03` §6.3 |
| Folio | folio number as supplied (suffixes such as "/01" kept as a sub-account) + AMC key; a join key inside the review only: never on slides, in browser storage or in logs | `03` §6.3 |
| Holder | per-review id of a client label in a holder role (first, second, third holder; guardian) | `03` §6.3, §6.8 |
| Source file | SHA-256 | `03` §6.3 |
| Observation | `ruleId@version` + scope + evidence fingerprint | `03` §6.3; rule bank §1 |

M1.3 (`app/src/model/ids.ts`, `app/src/engine/ids.ts`): ids are strings typed by kind at compile time
(`SourceFileId`, `FamilyId`, `ClientId`, `DistributorId`, `AccountId`, `FolioId`, `HoldingId`). Per-review ids are a
prefix (`cl`, `ds`, `ac`, `fo`, `h`) and the first 12 hex digits of the FNV-1a 64-bit hash of the normalised key
(labels lower-cased with spaces collapsed), so a file read twice, or with its rows in another order, gives the same
ids. Keys: client and distributor by label; account by client and distributor (the plan joins in M2); folio by
account, AMC label and folio number (a blank folio number by its row); an included holding by the merge key
(client, instrument, product, distributor); an excluded holding by its sheet and row. `InstrumentRef` is as in §5.2
and is null on a holding until engine/match resolves it (M2).

## 5. Entities

### 5.1 `SourceFile` (L1)

| Field | Meaning | Phase 0 source |
|---|---|---|
| fingerprint | SHA-256 of the file; imports are idempotent by it | `03` §6.1, §6.3 |
| role | what the file is (base file, IRR file, monitor, Screener pack, index data, ...) | `03` §6.1, §13 |
| class | publication class P, C or N | `03` §6.1; `06` |
| asOn | the data date | `03` §6.1 |
| parserVersion | the parser that read it | `03` §6.1 |
| rows | raw rows, each with its position (file, sheet, row) | `03` §6.1 |
| stage | Upload, Validate, Preview, Review: the source register records each stage before a file feeds the review | `03` §13.1; PRD R-IN-9 |

Types (M1.3, `app/src/model/source.ts`): `id: SourceFileId` (SHA-256, lower-case hex, computed by the caller),
`fileName`, `role: SourceRole` (`base-file`, `irr-file`, `capital-gains`, `soa-lookthrough`, `bonds`, `price-file`,
`mf-monitor`, `mf-monitor-direct`, `sif-monitor`, `screener-pack`, `index-data`, `workbook-reupload`),
`class: 'P' | 'C' | 'N'`, `asOn: Value<DayNumber>`, `parserVersion` (for example `base-file@1`),
`stage: 'upload' | 'validate' | 'preview' | 'review'`, `bytes`. A raw row's position is a `RowRef`
`{ sourceId, sheet, row }` with the row number Excel shows. The raw cells are those of the workbook reader
(`app/src/ingest/workbook.ts`: numbers with their number format and a date flag, text, booleans, errors, formulas
kept beside their cached value).

**Import record of a base file** (`BaseFileImport`, `app/src/ingest/base-file.ts`): the sheet used and its header
row, every sheet tried and what was found (`used`, `no-header`, `no-rows`, `not-needed`), the column mapping, the
money unit of the file (`crore`, `lakh` or `rupee`), the holdings, clients, distributors, accounts, folios and
ownership, the **skipped rows** with their reason (`blank-row`, `repeated-header`, `total-row`,
`no-instrument-name`, each with its row and whether it carries an amount), the analyst questions, the validation
results, the audit entries and the counts (rows, holding rows, holdings, included, excluded, merged rows, skipped
rows by reason).

### 5.2 `InstrumentRef` (L2)

| Field | Meaning | Phase 0 source |
|---|---|---|
| productClass | `MF`, `SIF`, `PMS`, `AIF`, `ETF`, `EQUITY`, `BOND`, `OTHER`; never crossed by matching | `03` §6.2; `CLAUDE.md` rule 4 |
| isin, amfiCode, vendorKey, productId | identifiers, each optional | `03` §6.2 |
| nameKey | normalised display name; never a join key on its own | `03` §6.2 |
| resolution.method | `isin`, `amfi`, `vendor-key`, `product-id`, `alias-pin`, `name-match`, `none` | `03` §6.2 |
| resolution.confidence | `exact`, `pinned`, `proposed`, `unmatched`; optional `candidates` | `03` §6.2 |

### 5.3 `Holding` (L2, with its L3 inclusion)

| Field | Meaning | Phase 0 source |
|---|---|---|
| id | per-review holding id | rule bank §2 (`holdings[i].id`) |
| instrument | `InstrumentRef` | `03` §6.1 |
| clientId, accountId, distributorId, folio | the holding's client, account (client + distributor + plan), distributor and folio | `03` §6.8 |
| assetClass | canonical asset; a blank asset is unknown, with a notice (never Equity); "Fixed Income" and "Debt Funds" are Debt | `03` §8 (OD-7) |
| category | canonical category | rule bank §2 |
| amcKey | the fund house; a blank AMC is shown as "AMC not given" | rule bank §2; `03` §8 (OD-34) |
| cmv | current market value, Crore, unrounded; holdings without it are excluded and listed | `03` §6.1, §8 (OD-8) |
| invested | invested value, Crore | `03` §16; PRD §6 |
| units | units held; with `cmv` gives the implied NAV ("implied NAV, base file") | `03` §8, §16 |
| xirr, bmXirr | the holding's return and benchmark return as given or computed; the analyst is asked when the file's XIRR values look like fractions (OD-3) | rule bank §2; `03` §7 |
| ageMonths, isPassive, isFoF, liquidity | holding attributes used by the rules | rule bank §2 |
| included | `included` or `excluded`, with the reasons; one invalid record never corrupts valid calculations | `03` §6.1 (L3) |

View-model fields derived from it (`cmvPct`, `label`) are metric paths (section 6). Duplicate folios merge as in the
legacy (E-02, KI-113).

**Fields as built in M1.3** (`app/src/model/holding.ts`; the base-file reader fills them):

| Field | Type | Rule |
|---|---|---|
| `id`, `sourceId` | `HoldingId`, `SourceFileId` | §4 |
| `rows` | `RowRef[]` | every base-file row in the holding, in file order (several when folios merged) |
| `instrumentName` | string | "Instrument Name" as given, spaces collapsed; a row without one is skipped and reported |
| `instrument` | `InstrumentRef \| null` | null until engine/match (M2) |
| `clientLabel`, `clientId`, `distributorLabel`, `distributorId` | string or null, id or null | a blank Client Name is warned |
| `accountId` | `AccountId` | §5.6 |
| `productLabel`, `product`, `productDefaulted` | string or null, string, boolean | a blank Product Name reads as "Mutual Funds", the legacy default, flagged and noted (Information) |
| `categoryLabel`, `amcLabel`, `liquidity` | string or null | as given |
| `assetLabel`, `assetClass` | string or null; `'Equity' \| 'Debt' \| 'Hybrid' \| 'Commodity' \| 'REITs/InvITs' \| null` | OD-7: the five classes of the legacy Asset Allocation (07_engine.js:1147 `assetOrder`: Equity, Debt, Hybrid, Commodity, REITs/InvITs; "Commodities" is Commodity) as labelled, ignoring letter case and spacing, around a slash too ("REITs / InvITs" is REITs/InvITs; folding letter case goes beyond OD-7, open, §8, BF-26); "Fixed Income" and "Debt Funds" are Debt; blank is unknown (null) with a Warning (OD-7); any other label is unknown too, the label kept, with a Warning (an extension of OD-7, open, §8) |
| `folios`, `folioIds` | string[], `FolioId[]` | folio numbers as supplied, one per merged row that has one |
| `purchaseDate` | `Value<DayNumber>` | an Excel serial or a text date (`YYYY-MM-DD`, `DD-MM-YYYY` with the legacy month-first swap above 12, `D Mon YYYY`); an impossible date is INVALID SOURCE DATA |
| `units` | `Value<number>`, unit `units` | the base the tax split reconciles a holding against (M7): the legacy reconciles base-file units with its unit FIFO and, when they are missing, switches to its rupee ledger (`amtMode`, 07_engine.js:393-405), which suits products priced in rupees (PMS, unlisted AIF) |
| `invested`, `cmv`, `fileGain` | `Value<number>`, unit `cr` | per row the Cr. column, else Lakh / 100, else rupees / 1e7 (the legacy precedence); `fileGain` is the file's own G/L, kept for reconciliation only (the gain shown is CMV minus invested, OD-18) |
| `xirr`, `bmXirr` | `Value<number>`, unit `pct` | OD-3: a percent-formatted cell is read as a percentage; an unformatted column whose values are all below 1.5 in size raises an analyst question and stays INSUFFICIENT EVIDENCE until answered; otherwise percent numbers |
| `holdingDays` | `Value<number>`, unit `days` | "Avg. Holding Days" |
| `mergeGaps` | `('invested' \| 'fileGain' \| 'units')[]` | the merged totals left missing because some merged folios have the value and others do not (a merge gap, KI-007, KI-113), in that order; empty for a one-row holding and when every folio or no folio has the value. Code reads this list, never the reason text; it is what tells a merge gap in units from a product without units (§8) |
| `inclusion` | `{ status: 'included' }` or `{ status: 'excluded', reasons: ['no-market-value'] }` | OD-8: a row without a market value in any unit is excluded and listed by name (Warning), never valued at zero. A market value that is not a number ("12abc", "1.25 Cr") is INVALID SOURCE DATA and counts as none; a market value of 0 is a real zero and the row is included, as in the legacy (open, §8) |

Text that is not a number is INVALID SOURCE DATA (Warning, counted by column); blank cells and placeholders ("NA",
"N/A", "-", "--", "nil") are NOT AVAILABLE IN SUPPLIED DATA. The file's Allocation (%) column is recognised but not
read: weights are computed from market values by the engine (KI-093, OD-22).

**Merging duplicate folios (E-02).** Included rows with the same client, instrument, product and distributor (exact
labels, as the legacy) merge into one holding: market value summed; invested value, file gain and units summed only
when every folio has one, otherwise missing (KI-007, KI-113; the rule for units is an M1.3 extension of KI-113). When
some folios have the value and others do not, the holding names that total in `mergeGaps`; when no folio has it, the
total is missing for the folios' own reason, as for a single row, and is not a gap. XIRR and BMXIRR weighted by
market value over the folios that have one, with the coverage recorded when some do not; purchase date, holding days, category, asset, AMC and liquidity from the first row, as the legacy (open item,
§8). A folio without a market value is excluded and listed on its own, never merged.

### 5.4 `Transaction` (L2)

| Field | Meaning | Phase 0 source |
|---|---|---|
| fund flows and benchmark flows | dated amounts from the IRR file; the benchmark flows invest the same amounts in the fund's own benchmark | `03` §7; PRD §6 |
| type | every known transaction type (OD-16) | `03` §7 |
| distributor | the IRR file's DISTRIBUTOR column, when present; flows without one are reported as "unassigned" | `03` §6.5, §7 (E-142) |
| folio, units | lot data used by taxation (units ledger first; rupee-only lots "not split", OD-12) | `03` §7 (`engine/tax/`) |

Rows that are skipped are reported by reason, never dropped silently (`03` §7).

### 5.5 `RealisedGain` (L2)

From the client's capital-gains statement in the app's template (section 5.17; E-141, D-032), else derived from
IRR-file redemptions by FIFO.

| Field | Meaning | Phase 0 source |
|---|---|---|
| scheme, folio | the instrument and folio | `03` §7 |
| saleDate, units, saleValue | the redemption | `03` §7 |
| cost, costBasis | cost and its basis (for example grandfathered cost) | `03` §6.7, §7 |
| purchaseDate | the lot's purchase date | `03` §7 |
| term | short or long term; long term is more than 12 months to the review's as-on date (OD-2) | `03` §7, §8 |
| gain, financialYear | the realised gain and the financial year it belongs to | `03` §7 |
| source | `statement` or `derived from transactions`, named in every output; when both exist they are reconciled per scheme and financial year, and a difference beyond tolerance raises a High validation result | `03` §6.7 |

### 5.6 `Client`, `Account`, `Folio`, `Ownership`, `Distributor` (L2)

| Entity | Meaning | Phase 0 source |
|---|---|---|
| `Client` | a person or entity in the family, shown by an analyst-set label (Q-68); the investor of record for the row | `03` §6.8 |
| `Account` | client + distributor + plan (Regular or Direct); the unit of the client-level and advisor-level scopes | `03` §6.8 |
| `Folio` | folio number within an AMC, belonging to one account | `03` §6.8 |
| `Ownership` | the folio's holders in order (first, second, third; guardian for a minor), the mode of holding (single, joint, anyone or survivor) and an optional share per holder. Default when the file has no holder columns: the client is the sole first holder with share 100% and joint holders are NOT AVAILABLE IN SUPPLIED DATA | `03` §6.8 (Q-79) |
| `Distributor` | the distributor label of the base file or IRR file | `03` §6.1, §6.5 |

Ownership data is client data: it is shown on screen and in the workbook's "Holdings (as loaded)" sheet, never on
slides, and never in browser storage (`03` §6.8, §17 item 6).

**Types as built in M1.3** (`app/src/model/ownership.ts`, `app/src/engine/ownership.ts`): `Family { id, label }`;
`Client { id, label, displayLabel }` (the label first seen; the analyst's display label, null until set);
`Distributor { id, label }`; `Account { id, clientId, distributorId, plan }` (plan `Regular` or `Direct`, null until
M2); `Folio { id, number, amcLabel, accountId }`; `Holder { role: 'first' | 'second' | 'third' | 'guardian',
clientId, share: Value<number> (pct) }`; `Ownership { folioId, firstHolder, jointHolders: Value<Holder[]>, mode:
Value<'single' | 'joint' | 'anyone-or-survivor'>, source: 'holder-columns' | 'default-sole-holder' }`.
A holding is attributed to the first holder of its folio, the row's client (`attributedClient`). Without holder
columns: the first holder's share is 100 and joint holders and mode are NOT AVAILABLE IN SUPPLIED DATA. With holder
columns: joint holders become clients the analyst can label; with any joint holder every share is NOT AVAILABLE
(never split); a row whose holder cells are blank is a sole holding (share 100, mode single).

**Optional holder columns (proposal, Q-79; no base file has them today).** Read by header, case-insensitive:
"Second Holder" (also "2nd Holder", "Joint Holder", "Joint Holder 1", "Holder 2", with an optional "Name"),
"Third Holder" (also "3rd Holder", "Joint Holder 2", "Holder 3"), "Guardian" or "Guardian Name", and
"Mode of Holding" or "Holding Mode" (Single, Sole, SI; Joint, Jointly, JO, JT; Anyone or Survivor, Either or
Survivor, AS, ES; anything else is INVALID SOURCE DATA with a Warning).

### 5.7 `LookThrough` (L4 input, one per holding)

| Field | Meaning | Phase 0 source |
|---|---|---|
| holdingId | the holding | `03` §9 |
| provider | exactly one of `equity-vendor`, `hybrid-vendor`, `debt-vendor`, `soa-upload`, `bonds-upload`, `direct-equity`, `fof`, `index-proxy`, `none` | `03` §9 |
| asOf, coverage | the data date and the share of the holding's CMV explained | `03` §9 |
| equity | stocks, market-cap mix and sector mix, weights as % of the holding | `03` §9 |
| debt | issuers, rating mix and sector mix | `03` §9 |
| other | gold, REITs and InvITs, cash, derivatives | `03` §9 |
| via | the wrapper chain (for example FoF to underlying fund) | `03` §9 |
| status, reason | a missing-data status when there is no look-through | `03` §9 |

Every chart and table series built from look-through declares one `dimension` and one `basis` (equity exposure, debt
exposure, MF book or total CMV) and never mixes two (`03` §9 rule 8; PRD R-AN-9).

### 5.8 `ValidationResult` (L3)

| Field | Meaning | Phase 0 source |
|---|---|---|
| ruleId, scope, message | which check, where, what | `03` §16 |
| severity | Blocking (no client export until resolved), High (export after the analyst acknowledges it), Warning (footnoted), Information (logged) | `03` §16 |
| blocksPublication | whether it blocks export | `03` §16 |
| resolution | `auto-resolved`, `analyst-decision` or `none` | `03` §16 |
| status | the result's status (its values are fixed with the type) | `03` §16 |

Types (M1.3, `app/src/model/validation.ts`): `id` (`ruleId:n`), `ruleId` (for example
`base-file.no-market-value`), `scope` (`file`, `sheet`, `column`, `rows` with their `RowRef`s, or `holdings` with
their ids), `message` (a plain sentence, no en or em dash), `severity: 'Blocking' | 'High' | 'Warning' |
'Information'`, `blocksPublication` (true exactly for Blocking), `resolution: 'auto-resolved' | 'analyst-decision' |
'none'`, `status: 'open' | 'acknowledged' | 'resolved'`, optional `decision` (the OD, KI or D id the rule implements)
and `count`.

**Analyst question** (`AnalystQuestion`): `{ id, kind: 'xirr-unit', field: 'xirr' | 'bmXirr', sheet, column,
options: ['percent', 'fraction'], prompt, evidence: { values, maxAbs }, decision: 'OD-3' }`. While it is open, a
High result (`analyst-decision`, `open`) stands and the column's values are missing; the answer is passed back to the
reader, which records an Information result (`resolved`) and a `validation-decision` audit entry.

Base-file results in M1.3: Blocking `no-header`, `no-holdings`, `no-market-value-column`; High
`xirr-unit-question`; Warning `no-market-value` (OD-8), `blank-asset` and `unrecognised-asset` (OD-7),
`blank-client`, `total-like-name`, `invalid-cells`, `holders-conflict`, `mode-unrecognised`, and
`skipped-no-instrument-name` when such a row carries an amount; Information `sheet-used`, `xirr-percent-format`,
`xirr-unit-answered`, `asset-synonym`, `product-defaulted`, `merged-folios`, `merge-incomplete` and the other
skipped-row reports.

### 5.9 `Review` (L4) and `Scope`

`Review` is the session object for one family. It holds L1 to L10, and every metric in it is a `Value<T>` with lineage
(inputs, method, vintage). Loading another base file replaces it as a whole (KI-001, D-015); a same-family as-on change
keeps the scenario and slide picks (OD-24). Its metrics are the paths of section 6. (`03` §6.1, §6.6)

`Scope` is `family`, `client` (ids) or `advisor` (distributor ids). Every calculated view is computed on the rows of the
scope, with weights re-based within it and totals reconciled to the family; the same mechanism serves analytics,
overlap, AMC, cost and returns. (`03` §6.5)

### 5.10 `Assumptions` (L5)

Analyst inputs, from the UI or a re-uploaded workbook: review mode, scope, IPS profile, plan switch (Regular or
Direct), expected returns (including returns for products without history), inflation, expense-ratio overrides,
thresholds version, labels. (`03` §6.1, §14 sheet 4)

### 5.11 `RebalancingScenario` (L6)

Actions (five: the legacy plan's), amounts or percentages (interlinked), units by date, destinations (with product class
and asset constraints), and the post-scenario `Review` computed by the same engine. A scenario is **valid** when the
amounts reconcile, every released amount has a destination or an explicit "cash" line, and the post-scenario review has
no Blocking result; only a valid scenario enables the "Review with Rebalancing" mode. (`03` §6.1, §11, §20; PRD R-RB-1)

### 5.12 `Evidence` and `ObservationRecord` (L7)

`Evidence`: `metric` (a metric path, section 6), `value` (unrounded number or label), `unit` (section 3), `source`
(source register ids or `engine`), `asOf`, optional `coverage` (0 to 1 of the relevant CMV).

`ObservationRecord`:

| Field | Meaning |
|---|---|
| id | `${ruleId}@${ruleVersion}:${scopeKey}:${evidenceFingerprint}` |
| ruleId, ruleVersion | the rule that fired |
| mode | `RO`, `RB` or `both` |
| section | `construction`, `allocation`, `concentration`, `debt`, `performance`, `timing`, `data-quality`, `working`, `rebalancing`, `synthesis` |
| severity | `positive`, `watch`, `attention`, `action` |
| driver | `risk`, `return`, `both` or `none`: which root question it answers |
| swot, pointers | SWOT quadrants it feeds (primary first) and one short pointer per quadrant |
| materiality | 0 to 100 |
| evidence | `Evidence[]` |
| dataQuality | `OK`, `PARTIAL COVERAGE`, `STALE DATA`, `INSUFFICIENT EVIDENCE` or `NOT AVAILABLE IN SUPPLIED DATA`, with notes |
| parts | evidence, diagnosis, implication, optional action |
| textGenerated, textEdited, editedAt, editStale | generated text, the analyst's edit (never changes evidence), and a flag when the evidence changed after the edit |
| suppressedReason, houseViews | why it was suppressed (duplicate, below materiality, gate failed); attached house views |

Rule definitions and their fields are in the rule bank (§1).

### 5.13 `PresentationManifest` (L8) and `WorkbookSpec` (L9)

`PresentationManifest`: which components, in which order, for which mode; inclusion conditions (data present, mode,
scope) and the divider rule; one manifest drives the full deck, the slide picker and the per-section downloads.
(`03` §6.1, §15)

`WorkbookSpec`: sheets, named inputs, formulas (from the typed builder only), styles and the hidden `_manifest` sheet
(schema version, build id, review fingerprint, map of named inputs and editable ranges, fingerprint of every formula
cell). The sheet list is `03` §14. (`03` §6.1, §14)

### 5.14 `AuditEntry` (L10)

One entry per: import (file hash, rows read, rows excluded by reason), validation decision, mode or scope switch,
analyst edit (before and after), re-upload (each changed input), export (file name, SHA-256 of the produced file,
manifest), and the build manifest (commit, data vintages, library hashes). Exported in the workbook's Audit Log sheet;
never sent anywhere. (`03` §16)

Types (M1.3, `app/src/model/audit.ts`): `{ id, at (ISO 8601 from an injected clock), kind: 'import' |
'validation-decision' | 'mode-switch' | 'scope-switch' | 'edit' | 'reupload' | 'export' | 'build', summary,
detail: Record<string, string | number | boolean | null>, sourceId? }`. Entries carry counts, hashes and
decisions only: never client names, folio numbers, amounts or sheet names.

### 5.15 Monthly and product-bank records

| Record | Fields | Phase 0 source |
|---|---|---|
| `monthly_updates/YYYY-MM/MANIFEST.json`, one entry per file seen | role, original name, size, SHA-256, as-on, class, storage, counts, issues; for the Screener pack only its fingerprint, contract version, cycle and counts | `09` §1, §5; `03` §13 |
| `product_bank/products/<product_id>.json` | names (each spelling with its source), external ids, product type, Centricity section, structure, terms, fees, house flags, benchmark name, managers; every field carries its source file (SHA-256), location, as-on and extraction method | `03` §12 |
| `product_bank/performance/<product_id>/<as_on>.json` | returns by period with `period_basis` (absolute under 1Y, else annualised) and `return_basis` (gross, net, TWRR, pre-tax); never compared across bases | `03` §12 |
| `product_bank/snapshots/<product_id>/<as_on>.json` | top holdings, sectors, market cap, ratings, countries, unlisted companies; always PARTIAL COVERAGE | `03` §12 |
| `product_bank/source_register/<YYYY-MM>.json` | every source file used: class, role, records added and updated | `03` §12 |

### 5.16 Stored MF Screener data pack (browser, D-026)

The pack the owner uploads into section 1's "MF Screener data pack" slot, kept in the browser's IndexedDB (database
`prd.next.v1.screener`) until a newer cycle is loaded. Never embedded in a build, never committed, never in
`localStorage` or logs. (`03` §6.9)

| Field | Meaning | Source |
|---|---|---|
| cycle | the pack's cycle date, from its `manifest.json`; shown in the sidebar | `03` §6.9 |
| sha256 | fingerprint of the zip; loading the same value again changes nothing | `03` §6.9, §7 |
| contractVersion | `pr-datapack-v1` | `03` §7 |
| counts | record counts per file, as checked against the manifest | `03` §7 |
| loadedAt | when the pack passed the Review stage | `03` §6.9, §13.1 |
| validated | whether its SHA-256 matches the published `MANIFEST.json` ("validated pack") | `03` §4, §6.9 |
| role | `current` (the newest cycle; a newer cycle replaces it) or `history` (the month-end holdings of replaced packs and of the backfill, kept for historical analytics) | `03` §6.9 |
| holdingsMonthEnds | the month-end dates whose fund holdings are stored | `03` §6.9 (Q-27) |

### 5.17 Capital-gains template (D-032; proposal for M7)

Analysts upload capital-gains statements in this template, as they do with the base-file template; the app offers it
blank for download with a Read Me sheet, reads it by header name (aliases allowed) and refuses a file without the
required columns, naming them. **One row per realised lot:** a sale matched to two purchase lots is two rows. Money in
rupees with two decimals (converted to Crore by the engine), units to three decimals, dates as Excel dates. The
columns below are a **proposal**, fixed in M7 when `ingest/capital-gains.ts` is built (`03` §6.10). [I]

| # | Column | Required | Type and unit | Meaning |
|---|---|---|---|---|
| 1 | Client Name | yes | text | the client as named in the base file; joins the row to the review's client; never shown on slides |
| 2 | Folio Number | recommended | text | the folio as printed (suffixes such as "/01" kept); a join key inside the review only |
| 3 | Scheme Name | yes | text | the scheme as named on the statement |
| 4 | ISIN | no | text, 12 characters | the preferred identifier when the statement prints it |
| 5 | Sale Type | no | text: Redemption, Switch Out, SWP, STP Out, Other | the kind of sale |
| 6 | Sale Date | yes | date | the date of the sale; the financial year (1 April to 31 March) is derived from it |
| 7 | Units Sold | yes | number, 3 decimals | units of this lot sold |
| 8 | Sale Value (₹) | yes | number, rupees | proceeds for these units |
| 9 | Purchase Date | yes | date | the lot's purchase date |
| 10 | Purchase Value (₹) | yes | number, rupees | the lot's actual cost for these units |
| 11 | Cost for Tax (₹) | no | number, rupees | the cost the gain is computed on when it differs from the purchase value (for example grandfathered cost); blank means the purchase value |
| 12 | Cost Basis | no | text: Actual, Grandfathered, Indexed | how Cost for Tax was set |
| 13 | Term | no | text: Short, Long | the issuer's classification; blank means derived from the purchase and sale dates under the tax-rules table, and labelled as derived |
| 14 | Gain (₹) | no | number, rupees; negative for a loss | as stated; blank means Sale Value minus Cost for Tax; a stated gain that differs from that beyond the tolerance set in M7 raises a validation result |
| 15 | Statement Source | no | text | who issued the figures (for example the registrar or the platform), for the source register |

Each row becomes a `RealisedGain` (section 5.5) with source `statement`. A statement covers whole financial years: the
reconciliation with gains derived from the IRR file runs per scheme and financial year (`03` §6.7).

## 6. Metric paths

The contract between `engine/` and `observations/`, the view-models and the cross-output consistency check. Every
path is a `Value<T>` in the `Review` (rule bank §2; `03` §11, §16).

| Path | Meaning |
|---|---|
| `totals.cmv`, `totals.invested`, `totals.gain` | portfolio totals (Crore, unrounded; gain = CMV minus invested, OD-18) |
| `alloc.asset[k].pct`, `alloc.product[k].pct` | labelled allocation shares |
| `alloc.effectiveEquity.gross`, `.netOfHedges` | look-through equity share of the book (E-134, Q-50) |
| `alloc.classesPresent[]` | classes at or above `class_present_pct` among equity, debt, gold and commodities, international, alternatives |
| `holdings[i]` | holding: `id`, `label`, `category` (canonical), `assetClass`, `productClass`, `amcKey`, `clientId`, `distributorId`, `cmvPct`, `xirr`, `bmXirr`, `ageMonths`, `isPassive`, `isFoF`, `liquidity` |
| `schemes[j]` | holdings merged per scheme across plans and accounts (`cmvPct`, `accounts`, `categories`) |
| `lookthrough.equity.positions.total`, `.unique`, `.coverage` | stock positions and distinct companies |
| `lookthrough.equity.mcap.{large,mid,small,others}` | market-cap split of equity |
| `lookthrough.equity.sectors[]`, `.top10Pct`, `.tailUnder1Pct` | sectors, top-10 stock share, count of stocks under 1% |
| `lookthrough.equity.byFund[f].mcap` | per-fund equity-sleeve market cap |
| `lookthrough.debt.buckets`, `.detail`, `.ytm`, `.modDur`, `.lowYieldPct`, `.creditRiskPct` | debt look-through |
| `overlap.matrix`, `overlap.pairs[]`, `overlap.meanPair`, `overlap.hub` | pairwise overlap and statistics |
| `index.overlap[indexId]`, `index.activeShare[fundOrSleeve]`, `index.proxy[indexId]` | index comparisons via proxies (E-131) |
| `amc.rows[]`, `amc.top2Pct`, `amc.breaches[]` | AMC shares of the MF book |
| `amc.quality[k]` | per house: value-weighted score of its held funds with coverage, share of its value behind benchmark on two tenors |
| `clients[c].sharePct`, `.assetMix`, `.largestHolding` | entity structure (labels set by the analyst) |
| `irr.portfolio.{fund,bench,firstFlow}`, `irr.sleeve[s]`, `irr.product[p]` | transaction XIRR (when an IRR file is loaded) |
| `contrib.rows[]`, `contrib.total`, `contrib.drags[]` | contributions (allocation x XIRR) |
| `perf.byFund[f].{r1y,r3y,r5y,bm1y,bm3y,bm5y}` | trailing returns against the category benchmark |
| `perf.portfolio.{r3y,r5y}`, `.coverage`, `.source` | MF portfolio 3Y and 5Y returns: weighted average return of current holdings (section 7) |
| `perf.atOrAboveBench.share`, `.coverage` | share of the CMV with return data held in funds at or ahead of their benchmark XIRR |
| `de.cagr[stock].{r1y,r3y,r5y}`, `de.portfolio.{r1y,r3y,r5y}`, `.coverage` | direct-equity CAGR per stock and the allocation-weighted figure (section 7) |
| `drawdown.index[id].{maxDd,peak,trough,recoveryMonths}`, `drawdown.blend.*` | drawdowns on index data, per index and for a blend at current asset-class weights (section 7) |
| `risk.byFund[f].{alpha,sharpe,sortino,dc,sd}`, `risk.peer[cat]` | ratios and the peer basis (median, Q-51) |
| `quants.score.weighted`, `.coverage` | Portfolio Quants roll-up (E-132) |
| `mf.passivePct` | index funds and ETFs as a share of the MF book |
| `equity.thematicPct` | thematic and sectoral funds as a share of equity |
| `flows.recentPct`, `flows.firstByHolding[i]`, `flows.lastRebalance` | timing of inflows and the date of the last switch, redemption or transfer out (IRR file) |
| `ips.rows[]` | IPS bands and actuals for the selected profile |
| `tax.unrealised.{st,lt}`, `tax.realisedFY.{st,lt,source}`, `tax.harvestableLoss`, `tax.exemptionUsed` | tax position (realised gains from the statement or derived, section 5.5) |
| `scenario.valid`, `scenario.post.*`, `scenario.exits[]`, `scenario.tradeoffs` | Review with Rebalancing only |

The mandatory facts F1 to F11 of the Review Only Snapshot map to these paths in [ARCHITECTURE.md](ARCHITECTURE.md) §11 (from `03-architecture.md` §11).

## 7. Calculation definitions

The PRD (§6) summarises these; this table is the full definition. Each was decided by the owner or recommended in
Phase 0 (authority column). A change to any of them is a financial change (`CLAUDE.md` rule 7).

| Item | Definition | Authority |
|---|---|---|
| Weights | on current market value; per-client sheets re-based to the client; scopes re-based to the scope | [PO §3.3] |
| Unrealised gain/loss | CMV minus invested, everywhere | OD-18 |
| Realised gain/loss | from the capital-gains statement when supplied in the app's template (section 5.17; the source of record for a financial year), else derived from IRR-file redemptions by FIFO; source named; reconciled per scheme and financial year when both exist | Q-49; D-032 |
| Absolute return | gain / invested x 100 | the previous owner's [decisions log](previous-owner/knowledge/DECISIONS_LOG.md), 15 Jun |
| XIRR | actual/365, bisection to a bracket width below 1e-12, Newton fallback (the legacy solver, ported as is) | [IE E-26] |
| Benchmark XIRR | the client's cash flows invested in each fund's own benchmark | [IE E-27] |
| Subtotal fund vs benchmark | averaged over the holdings that have both values; a fund-only average carries its coverage | OD-26 |
| IRR reconciliation | redeemed instruments and IRR-only clients per OD-4; an invalid benchmark is excluded on both sides; a scope whose flows do not reconcile to its holdings shows INSUFFICIENT EVIDENCE | OD-4 |
| Long-term holding | more than 12 months to the review's as-on date | OD-2 |
| AMC cap | 20% of the mutual-fund book; breach strictly above 20.00%; the same basis everywhere, including the AI Analyst; group PMS, AIF and stocks outside the cap; a blank AMC is "AMC not given" | OD-1, OD-33, OD-34 |
| Blank asset | unknown, with a notice (not Equity); "Fixed Income" and "Debt Funds" are Debt | OD-7 |
| Missing CMV | the holding is excluded and listed | OD-8 |
| Missing base expense ratio | blank with a footnote; no estimates | OD-9 |
| Benchmarks | one table; arbitrage to Nifty 50 Arbitrage; BAF, multi-asset, equity savings, gold, silver and global have "no benchmark" until named | OD-7 |
| Overlap | sum over common stocks of min(weight in A, weight in B); the diagonal is 100; at least 99.5 is shown as 100 | [IE E-40] |
| Index overlap and active share | as overlap, against index constituents from the Screener pack when supplied, else a named index-fund proxy at a named date; active share = 100 minus index overlap | Q-30 |
| Look-through blocks | each block normalised over its exposure base (equity CMV, debt CMV) and summing to 100.00%; truncated lists get an "Others" remainder that reconciles | [PO §3.3]; `03` §9 |
| Credit ratings | an explicit mapping table over every label present; three buckets plus "Derivatives and hedges" and "Non-credit holdings" lines beside them; the seven-group detail kept | brief 6.4; Q-46 |
| Debt "Others" | components under 2% of the debt exposure folded into "Others" on charts (full detail in tables, a note below the chart), within one dimension only, named ("Other issuers under 2%"); never applied to equity sectors | brief 6.3; Q-47 |
| Effective equity | gross, with a separate figure excluding hedged arbitrage equity | OD-30a; Q-50 |
| Performance order | Index, Large, Diversified (with ELSS, Dividend Yield, Contra, Value), Mid, Small, Thematic and Sectoral, Global, FoF; hybrid low to high risk; debt overnight to long duration; no 2Y column for Debt MF | brief 7.3; Q-45 |
| Portfolio Quants | value-weighted over the funds that have the metric; coverage reported ("x% of value scored"); missing never zero; score, rank and ratios from the stored Screener pack (section 5.16), else the MF Monitor and the in-house risk workbook for the ratios; score and rank have no other source and show the dash with a footnote when no pack is stored; source and date per metric group | [DA §4 slide 5]; Q-20; D-026 |
| Portfolio 3Y and 5Y return (mutual funds) | sum over funds with a return of (weight x return) divided by the sum of their weights, where weight = the fund's share of the MF value. A fund without a 3Y or 5Y return is left out of the weights, never counted as 0%, and the coverage is footnoted ("3Y covers x% of MF value; n funds without a 3Y return excluded"). Source order: the MF Monitor the analyst uploads for the review; else the latest monthly MF Monitor in the embedded vintage; else the MF Screener data pack. One figure uses one primary source; a fund missing there is filled from the next source only when that source has the same as-on date, otherwise it is excluded and counted in the footnote. Label: "weighted average return of current holdings", never the portfolio's realised return | D-023 point 3; KI-006 |
| Direct-equity returns | per stock, CAGR(n) = (P(as-on) / P(as-on minus n years))^(1/n) minus 1 for n = 1, 3, 5, on split- and bonus-adjusted month-end prices (the Screener pack's `stock_prices_month_end.json`, 72 months), else the analyst's price file. Dates are the exact anniversaries of the review's as-on date (29 Feb maps to 28 Feb); a price is taken on that date or the nearest earlier date in the series within 7 calendar days, otherwise that tenor is missing for the stock. Portfolio figure = allocation-weighted over the stocks that have the tenor; stocks without enough history are excluded and footnoted with the coverage (the calculator workbook's IFERROR-to-0% is not copied) | D-023 point 4 |
| Drawdown comparison | on index data only (the five Index TRI files the owner supplies monthly, D-023 and its addendum): per index and for a blend of indices at the review's current asset-class weights, the maximum peak-to-trough fall, the peak and trough dates and the months from trough back to the previous peak (or "not yet recovered"); labelled "index data; the blend uses today's weights and is not the portfolio's own history" | D-023 point 2; Q-69 |
| Pre/post projection | pre and post 3Y and 5Y returns = the portfolio 3Y and 5Y return above over the pre and post fund sets (historical, with coverage); products without history use the analyst's expected return (illustrative); illustrative value(n) = current value x (1 + r)^n, with the rupee difference; every figure labelled "illustrative, not a guarantee" | D-023 point 3; brief Phase 9; Q-36 |
| Reference NAV for unit plans | CMV / units at the as-on date ("implied NAV, base file"), or a dated NAV where supplied | `03` §8 (design choice) |
| Rounding | unrounded maths; rounding only for display; two decimals | brief Phase 13 |

## 8. Open in v0

- **Types and enumerations** of the entities not yet built (from M2 onward, with the module that produces them).
- **Percent representation: decided in M1.3.** A `pct` value is a percent number (8.79 means 8.79 %), as the rule
  bank's thresholds and the workbook's `0.00"%"` format already assume; fractions appear only inside a calculation.
  The base-file reader converts on the way in (OD-3).
- **Merged folios, first-row fields (M1.3, open).** The purchase date and holding days of a merged holding are the
  first row's, as in the legacy; the earliest purchase date or a unit-weighted holding period may be wanted. The
  member rows are kept (`rows`), so the engine can compute either when the owner decides.
- **Blank Product Name (M1.3, open).** Read as "Mutual Funds", as the legacy does, flagged on the holding and noted;
  no decision covers it.
- **Unrecognised Asset Names (M1.3, open; question for the owner, D-035).** OD-7 decided the blank case (unknown, never
  Equity) and two synonyms. The reader also leaves any other label unknown, kept as given, with a Warning, because
  reading it as a class would be a guess; that extends OD-7 beyond the blank case. The legacy kept such a label as
  the asset: its own Asset Allocation row after the five ordered classes (07_engine.js:1147-1159), and for a mutual
  fund the Equity MF performance and benchmark bucket unless its name or category marks a commodity fund
  (07_engine.js:1599-1609). Parity entry BF-19 ("Gold"). Question: should labels such as Gold, Equity Funds, Hybrid
  Funds, Alternatives, Cash, Real Estate or International stay unknown, or map to a class (which)? REITs/InvITs is
  not in question: it is the fifth class of the legacy allocation order and is read as labelled.
- **Letter case and spacing of Asset Names (M1.3 re-review, open; the owner confirms BF-26).** The reader reads an
  Asset Name without regard to letter case or spacing: "  EQUITY  " is Equity, "REITs / InvITs" is REITs/InvITs.
  OD-7 decided only the blank case and two synonyms, so folding letter case goes beyond it. The legacy kept the label
  as written (spaces collapsed): "EQUITY" became an Asset Allocation row beside "Equity", and the IPS took only the
  last of such rows (KNOWN_ISSUES KI-145 and KI-146). Parity entry BF-26. Questions for the owner: confirm the
  folding; and measure, privately, how common variant labels (letter case, spacing, synonyms) are in the real base
  files, which sizes KI-145 and KI-146 on the live page.
- **A Crore cell that is not a number beside a Lakh or rupee amount (M1.3 re-review; decided in M1.4).** §5.3 says
  a market value that is not a number "counts as none"; today the reader then takes the Lakh or rupee column of
  the same row, as the legacy `pickCr` order does, without a notice on the holding (KNOWN_ISSUES KI-147). The rule,
  the notice, a unit test and a clear §5.3 sentence are M1.4 acceptance items
  ([07-implementation-roadmap.md](new-build/07-implementation-roadmap.md) M1.4).
- **Units of merged folios and the tax base (M1.3; BF-17 (KI-113) and BF-18 (KI-113 extended to units) accepted by the lead, D-035).** Base-file units are
  the base the legacy tax split reconciles each holding against (07_engine.js:393-405); when a holding has no units,
  that split switches to the rupee ledger (`amtMode`), which suits products priced in rupees (PMS, unlisted AIF). The
  legacy summed the units the merged folios had, so a fund with one folio lacking units was reconciled against too
  few units. The reader leaves merged units missing instead (KI-113 extended to units, BF-18) and names the gap in
  `Holding.mergeGaps`. **Requirement for M7:** a unit-priced holding with a merge gap in units is never reconciled by
  amount; the tax engine tells the gap from a product without units by `mergeGaps`, never by the reason text. How
  such a holding is reconciled instead (on the folios whose units are known, or not split, with its status) is
  decided in M7. The merged file gain left missing (BF-17) is shown nowhere: the gain shown is CMV minus invested
  (OD-18).
- **A market value of 0 (OD-8 question, open; question for the owner).** OD-8 excludes and lists a holding with no
  market value and never shows it at zero. A market value of 0, written as a number, is read today as a real zero and
  the holding is included, as in the legacy (the legacy skipped only a row with no number in any market value
  column); `tests/unit/ingest/base-file.test.ts` pins this. Question: is a market value of 0 "no market value" under
  OD-8 (excluded and listed), or a real zero (included)?
- **Cross-output registry name:** `03-architecture.md` §16 lists `xirr.portfolio` among the figures checked across
  outputs; the rule bank's path for the same figure is `irr.portfolio.fund`. This dictionary uses the rule bank's
  form; the registry is aligned when it is built (M13).
- **Thresholds** used by metric paths (for example `class_present_pct`) are values in the threshold table, not
  definitions. The owner approved the table on 22 Oct 2026 (D-030); a fund pair counts as overlapping from 35%.
- **Capital-gains template columns** (section 5.17) are a proposal until M7.

## Change log

| Version | Date | Change |
|---|---|---|
| v0 | 22 Oct 2026 | Created at M1.1 from the Phase 0 architecture (§6, §8, §9, §12, §16) and the observation rule bank (§1, §2) |
| v0.1 | 22 Oct 2026 | The owner's answers: the dash as the missing-value marker, never in sentences (§2, D-029); the stored MF Screener data pack (§5.16, D-026); the capital-gains template, proposed for M7 (§5.17, §5.5, D-032); thresholds approved (§8, D-030); the Index TRI files as the drawdown index data (§7) |
| v0.1 (links) | 22 Oct 2026 | Links only (M1.1): the legacy architecture moved to `legacy/ARCHITECTURE.md`; `ARCHITECTURE.md` is now the new application's, and the F1 to F11 mapping of §6 points there; definitions unchanged |
| v0.2 | 22 Oct 2026 | Milestone M1.3: types of `Value<T>`, units and dates (§2, §3), identifiers (§4), `SourceFile` and the base-file import record (§5.1), `Holding` with the reader's rules and the folio merge (§5.3), ownership and the proposed holder columns (§5.6), validation results and analyst questions (§5.8), audit entries (§5.14); percent numbers decided (§3, §8); two open items (§8) |
| v0.3 | 23 Oct 2026 | M1.3 financial review: REITs/InvITs is the fifth asset class, as in the legacy allocation order (§5.3); `Holding.mergeGaps` tells a merge gap from a value no folio has, and units are named as the tax reconciliation base (§5.3); a market value that is not a number counts as none, and 0 is a real zero (§5.3); three open questions for the owner: unrecognised Asset Names, merged units and the M7 requirement, a market value of 0 (§8) |
| v0.3 (re-review) | 23 Oct 2026 | Open items only, definitions unchanged (M1.3 re-review): folding the letter case of Asset Names goes beyond OD-7 and waits for the owner (§5.3, §8, BF-26); a Crore cell that is not a number beside a Lakh or rupee amount, decided in M1.4 (§8, KI-147) |
| v0.3 (D-035) | 23 Oct 2026 | Status only (§8): BF-17 (KI-113) and BF-18 (KI-113 extended to units) accepted by the lead (D-035); BF-19 and BF-26 wait for the owner |
