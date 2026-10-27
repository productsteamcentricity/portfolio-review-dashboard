# Capital-gains upload: the platform export and the blank template (D-036)

| | |
|---|---|
| Status | Design of 23 Oct 2026 for milestone M7 (CR-0006), revised on 27 Oct 2026 after a financial, a completeness and a security review, again the same day after the financial and completeness re-reviews, a third time after their approval reviews and a fourth time after the second approval reviews (the lead's decisions LD-1 to LD-42, §10.11); approved with its tax-rule table by the financial-domain reviewer on 27 Oct 2026 (§10.10). No code yet: `ingest/capital-gains.ts` and `engine/tax/` are built in M7 from this document |
| Decision | [D-036](../DECISIONS.md) (lead under D-033, amending D-032 within the owner's "the format of your choice") |
| Owned later by | the columns and the `RealisedGain` fields: [DATA_DICTIONARY.md](../DATA_DICTIONARY.md) §5.5 and §5.17; the dated tax-rule table: `data/owner/tax-rules.json` once M7 creates it (E-144); this document stays the design record |
| Built from | the structure of one capital-gains export the owner supplied on 22 Oct 2026, profiled locally with counts and checks only (no value, name, PAN, folio or amount from it appears in this repository); the dated tax-rule research of 23 to 27 Oct 2026 and its reviews (§10) |
| Not here | client data of any kind. Every example below is synthetic |

**In one paragraph.** The analyst uploads the wealth platform's "Capital Gain Report" export exactly as the platform
produces it: the reader finds its columns by header name (any order, extra columns ignored), removes the PAN the
moment the file is read, parses the folio out of the instrument name, recognises the totals row and the text block at
the foot of the sheet, and reconciles the lot rows with the statement's own totals. Statements from other sources go
into a blank template with the same headers, downloaded from the app. Because the export's tax columns are empty and
it covers the client's whole realised history, the app filters by financial year and computes indicative tax itself,
per lot and per person, from a dated rule table, with the slab rate, surcharge rate and tax regime that the analyst
enters for each person and year (none has a default). Every figure assumes a resident individual.

---

## 1. What the analyst uploads

| Input | Accepted | Notes |
|---|---|---|
| The platform's "Capital Gain Report" export (`.xlsx`) | as produced, without reformatting | the same platform that produces the base file; one sheet, header in row 1, no formulas, 29 columns (§2.3), a footer of a totals row and a merged text block |
| The app's blank capital-gains template (`.xlsx`) | filled by the analyst | the same 29 headers and a Read Me sheet (§12); for statements from registrars or other platforms, transferred one row per lot |
| Any other layout | refused | the import report names the required columns it could not find (D-032 unchanged on this point; no per-issuer parsers) |

The upload slot is the capital-gains slot of section 1, with the Upload, Validate, Preview and Review stages of every
other upload (architecture §13.1). The file is client data (class N): read in the browser, kept in the review's
memory only, never written to browser storage, never logged, never committed.

## 2. Reading the file

### 2.1 Sheet and header row
- The reader uses the workbook reader of M1.3 (`app/src/ingest/workbook.ts`, raw serial dates, cells with their number
  format) and its header search (`findHeaderRow`).
- **Sheet:** the first sheet whose header row (searched in the first 5 rows, as for the base file) contains every
  required column of §2.3. Other sheets are ignored and listed (Information). The platform names its sheet after the
  family; the sheet name is kept in the import record like the base file's and never shown on slides.
- **No sheet qualifies:** the file is refused (Blocking `capital-gains.no-header`), naming the required columns missing
  from the best candidate sheet.

### 2.2 Header matching
A header cell matches a column when, after normalising both sides, the texts are equal. Normalising: trim, collapse
inner spaces, ignore letter case, and treat `(₹)`, `(Rs)`, `(Rs.)`, `(INR)` and no unit as the same suffix. The
platform's money headers end with a trailing space ("Sell Amount (₹) "); normalising removes it. Aliases are listed in
§2.3; a column matched twice is an error (Blocking `capital-gains.duplicate-column`). Columns not in §2.3 are ignored
and listed (Information `capital-gains.columns-ignored`).

### 2.3 Columns

"Required" is one rule for both sources. "One of" means at least one column of the pair must be present.

| # | Header (as exported, trimmed) | Aliases | Required | Read as | Becomes | Use |
|---|---|---|---|---|---|---|
| 1 | Sale Date | Redemption Date, Date of Sale | yes | date (Excel serial; a text date is INVALID SOURCE DATA for that cell) | `saleDate` | marks a lot row (§2.4); the financial year (§8) |
| 2 | Account Name | | one of 2, 4 | text; the `[PAN: ...]` tag removed at read (§3) | `accountLabel`, `accountNote`: once the PAN tag is removed, `accountNote` is the text after the last " - " (for example "Held Away") and `accountLabel` the text before it; without " - " the whole text is `accountLabel` and `accountNote` is empty | joins the lot to a client when Client Name is absent (the name part, `accountLabel`) |
| 3 | Family Name | | no | text | not kept | compared, after the base file's label normalisation, with the review's family label (`Family.label`), and not compared while that label is unset; a statement naming another family is reported (Warning `capital-gains.family-differs`, §11); never used as a label |
| 4 | Client Name | Investor Name | one of 2, 4 | text | `clientId` (by normalised label, as the base file) | joins the lot to the review's client; the person whose tax is computed (§9.3); never on slides |
| 5 | Instrument Name | Scheme Name, Scheme | yes | text; the tag `[Folio No: <folio> \|\| Asset: <Equity or Debt>]` parsed out (§2.5) | `schemeLabel`, `folio`, `tagAsset` | the scheme (matched to the universe in M2 terms: a proposal only, OD-5) |
| 6 | Category Name | Category, Sub Category | one of 6, 7 | text (SEBI category) | `category` | the fund type through the category map (§10.5a), hence the default tax class (§9.1) |
| 7 | Asset Name | Asset Class | one of 6, 7 | text: Equity or Debt | `statementAsset` | a cross-check of the tax class; never the tax class on its own (§9.1) |
| 8 | Distributor Name | Distributor, ARN Name | no | text | `distributorId`, `accountId` (client and distributor, as the base file) | advisor scope |
| 9 | Purchase Date | Date of Purchase | yes | date | `purchaseDate` | term, rule lookup |
| 10 | Purchase Price (₹) | Purchase NAV | no | rupees per unit | `purchasePrice` | blank: Invested Value / Sale Unit, labelled derived; not derived when Sale Unit is not above 0 (NOT AVAILABLE IN SUPPLIED DATA) |
| 11 | Sale Price (₹) | Sale NAV, Redemption NAV | no | rupees per unit | `salePrice` | blank: Sell Amount / Sale Unit, labelled derived; not derived when Sale Unit is not above 0 (NOT AVAILABLE IN SUPPLIED DATA) |
| 12 | Sale Unit | Sale Units, Units Sold, Units | yes | number above 0 | `units` | |
| 13 | Sell Amount (₹) | Sale Amount, Sale Value, Redemption Amount | yes | rupees | `saleValue` | |
| 14 | Principal Repayment (₹) | | no | rupees | `statement.principalRepayment` | zero for mutual funds; a non-zero value on a mutual-fund lot is reported (bonds come later) |
| 15 | Invested Value (₹) | Purchase Value, Purchase Amount, Cost | yes | rupees | `purchaseValue` | the lot's actual cost |
| 16 | Realized G/L (₹) | Realised G/L, Realized Gain/Loss, Gain/Loss | no | rupees | `statement.realised` | checked against Sell Amount minus Invested Value |
| 17 | LTCG G/L (₹) | LTCG | no | rupees | `statement.ltcg` | the statement's own long-term split, shown beside the app's |
| 18 | STCG G/L (₹) | STCG | no | rupees | `statement.stcg` | the statement's own short-term split |
| 19 | Acquisition Date | | no | date | `statement.acquisitionDate` | the lot class (§5) |
| 20 | Acquisition Price (₹) | Acquisition NAV, Cost for Tax per Unit | no | rupees per unit | `statement.acquisitionPrice` | the lot class (§5) |
| 21 | Holding Terms | Holding Days, Holding Period (Days) | no | whole days | `statement.holdingDays` | checked against the dates |
| 22 | Interest Earned (₹) | | no | rupees | `statement.interest` | zero for mutual funds; non-zero on a mutual-fund lot is reported |
| 23 | XIRR (%) | | no | percent number | not kept | the lot's XIRR is not used anywhere (Information) |
| 24 to 29 | Pre Tax G/L (₹), Tax Amount (₹), Surcharge (₹), Cess (₹), Total Tax (₹), Post Tax G/L (₹) | | no | rupees | `statement.tax.*` | empty in the platform export; when a statement fills them they are shown beside the app's estimate and never used in its place |
| (extra) | Folio Number | Folio No, Folio | no | text | `folio` | for the blank template filled from other sources; takes precedence over the tag in column 5 |

Money is read in rupees. The model holds money in Crore (`DATA_DICTIONARY.md` §3), but `engine/tax/` computes in
rupees, because the tax thresholds and the known answers are in rupees, and converts to Crore only for display;
indexed and grandfathered costs per unit are never rounded, and known answers are compared to ₹0.01. Units keep every
decimal the cell holds (exports show one to three); dates are day numbers from the serial (no time zone); percent
numbers stay percent numbers.

### 2.4 Lot rows and the footer
- **A lot row** is a row below the header whose Sale Date cell is a date. One row is one purchase lot consumed by one
  sale (FIFO, as the platform matched it): a sale matched to three lots is three rows.
- **An excluded lot** is a row, other than the totals row, whose Sale Date cell is not a date (blank, or text such as
  a text date: INVALID SOURCE DATA) but which holds a number in Sell Amount, Invested Value or Realized G/L. It is
  excluded and listed (Warning `capital-gains.row-without-sale-date`) wherever it stands, between lot rows or after
  the last one: a lot row whose Sale Date is invalid text is an excluded lot, never footer, so no lot is dropped
  silently.
- **Between lot rows:** a blank row and a repeated header are skipped and counted (Information
  `capital-gains.rows-skipped`).
- **First cell** means the first non-empty cell of the row, in whatever column it stands (column A in the platform's
  layout, which is the Sale Date column).
- **The totals row** is the row after the last lot row whose first cell reads "Grand Total" or "Total" (normalised),
  whose Sale Date cell holds no date-like text and which holds numbers in money columns. When both a "Grand Total"
  and a "Total" row qualify, the "Grand Total" row is the totals row; when only "Total" rows qualify, the first one is.
  A qualifying row that is not the totals row (a subtotal) is an excluded lot. The totals row is used only for the
  reconciliation of §7.
- **The footer** is every other row after the last lot row: blank rows and the platform's merged text block over
  columns A to E. Footer rows are counted one per sheet row, from the first row after the last lot row to the sheet's
  last used row, leaving out the totals row and the excluded lots (Information `capital-gains.footer-skipped`, with
  the count). Their text is never parsed, stored, shown or logged (§3 says how PAN-shaped tokens in it are counted).

### 2.5 The instrument tag
`Sample Flexi Cap Fund - Regular Plan - Growth Option [Folio No: 91000001 || Asset: Equity]` (synthetic) gives the
scheme label `Sample Flexi Cap Fund - Regular Plan - Growth Option`, the folio `91000001` and the tag asset `Equity`.
Folio forms seen: digits, and digits with a "/" suffix (kept, as for the base file). Without a tag the whole text is
the scheme label and the folio is NOT AVAILABLE IN SUPPLIED DATA (unless the extra Folio Number column gives it). A tag
asset that differs from column 7 raises a Warning (`capital-gains.tag-asset-differs`). The folio is a join key inside
the review: never on slides, in browser storage or in logs (`DATA_DICTIONARY.md` §4). The export has no AMC column, so
until the scheme is matched (M2) the folio key is account, scheme label and folio number; it becomes account, AMC key
and folio number once the scheme is matched.

## 3. Personal data removed at read time

- **PAN.** The platform writes the PAN into Account Name as `<NAME> - Held Away[PAN: <PAN>]`. The reader removes the
  whole `[PAN: ...]` tag from Account Name, and replaces any PAN-shaped token (five letters, four digits, one letter;
  any letter case) in **any text cell of any row** with `[PAN removed]`, **before** the cell is kept anywhere, the raw
  L1 row included. The PAN is never held in the model, the source register, the audit log, the workbook, a slide,
  browser storage or a console message. The import record keeps only the count of removals (Information
  `capital-gains.pan-removed`).
- **The footer** is scanned for PAN-shaped tokens only to replace them; those tokens are counted separately, as footer
  removals, in the same Information result. The footer text itself is never kept (§2.4), so nothing it holds can
  leak.
- **No use of the PAN.** The reader does not compare, number or group by PAN tokens: the person is the client label
  (§9.3). Whether the reader may number distinct PANs within one file, in memory only, to group persons is an owner
  item (§15, item 3); until the owner answers, it does not.
- **Names.** Account Name, Client Name and Family Name are client data, used only to join lots to the review's clients
  (§11 reports a statement whose clients match none of them, and labels that may name one person twice). Client labels
  follow the base file's rules (analyst-set display labels, never on slides unless the analyst labels them).
- **Tests** prove that no PAN-shaped string reaches the import record, the model or the audit entries
  (`unit/ingest/capital-gains.test.ts`, M7), the workbook (`exports/xlsx/tax-transactions.test.ts`, M7, when the Tax
  and Transactions sheet is built) or the deck (`acceptance/ac-20` "no stale client data", extended to no PAN-shaped
  string with `cg-statement` loaded, gate M9, when the deck builder exists), using fixtures whose PAN-shaped tokens are
  assembled at run time (§13.3).

## 4. From a row to a realised lot

Each lot row becomes one `RealisedGain` (`DATA_DICTIONARY.md` §5.5) with `source: 'statement'`:

| Field | From |
|---|---|
| `saleDate`, `purchaseDate`, `units`, `saleValue`, `purchaseValue`, `salePrice`, `purchasePrice` | columns 1, 9, 12, 13, 15, 11, 10 (prices derived when blank, with `salePriceDerived` and `purchasePriceDerived` set and the lot labelled) |
| `clientId`, `accountId`, `distributorId`, `accountLabel`, `accountNote` | columns 4, 2 and 8 (§2.3); `clientId` is the person of §9.3 |
| `scheme`, `schemeLabel`, `folio`, `tagAsset`, `category`, `statementAsset` | columns 5, 6 and 7 and the extra Folio Number column (§2.3, §2.5); `scheme` is the `InstrumentRef`, null until the scheme is matched (M2) |
| `realised` | Sell Amount minus Invested Value: the economic gain, always computed; the stated Realized G/L is checked against it. A `non-taxable-transfer` row's gain is shown only in the year's non-taxable line and is left out of the year's realised total and of the IRR reconciliation, because the successor lots carry the original cost and would count it again; the exception is an event whose successor lots are `successor-reset` (§5), which keeps its realised gain. An event whose successor lots are partly `successor-reset` keeps its realised gain pro rata to the units that went to reset lots, measured at the merger value (the reset lots' Invested Value over the event's Sell Amount); a reset lot that the analyst gives its original date and cost no longer counts as reset. A `taxable-transfer` row's gain is realised like any sale's; a successor lot that still carries the original cost after it (`successor-not-reset`, §5) counts that gain again until the analyst re-bases it, and the amount counted twice is named. Known answers: a lot bought at 100, merged at 150, whose successor is sold at 180, gives a realised 80, counted once (KA-15); the taxable merger of KA-17 (§13.4) |
| `financialYear` | from the sale date (§8) |
| `lotClass` | §5 |
| `duplicateOf` | the first row of its group, when the row repeats another exactly (§6) |
| `statement` | the stated Realized G/L, LTCG, STCG, acquisition date and price, holding days, principal repayment, interest and tax columns, as read |
| `taxClass`, `listed`, `subType` | the scheme's tax facts for the year of sale (§9.1), copied to the lot: computed or set by the analyst, never read from the statement alone; `listed` is missing for a close-ended non-equity scheme without the analyst's flag |
| `term`, `costForTax`, `costBasis`, `taxableGain`, `ruleId` | computed by the engine (L4, §9), never read; `costBasis` is `none` for an exempt lot, a non-taxable transfer or a lot without a computable taxable gain (no valid key, tax class not set, listed flag missing, rule to be confirmed, cost input missing, or outside the rule table); a lot whose tax waits only for the slab or surcharge rate keeps its rule's basis, and an NE-LT-1 lot records the basis of its chosen leg (§9.3 step 1) |

**Row checks** (each failure a Warning `capital-gains.row-check-failed` naming the check, with its count; the row is
kept with its stated values and flagged):

| Check | Tolerance |
|---|---|
| Holding Terms equals Sale Date minus Purchase Date in days | exact |
| Sale Unit x Sale Price equals Sell Amount | ₹1 or 0.01% of Sell Amount, the larger |
| Sale Unit x Purchase Price equals Invested Value | ₹1 or 0.01% of Invested Value, the larger |
| Sell Amount minus Invested Value equals Realized G/L | ₹1 or 0.01% of Sell Amount, the larger |
| Purchase Date on or before Sale Date | exact (a same-day purchase and sale passes, with 0 holding days) |
| Sale Unit above 0 | exact |

A check runs only when every cell it reads holds a value; a blank optional cell (Holding Terms, Sale Price, Purchase
Price, Realized G/L) skips that check, and a derived price is not checked against the amount it was derived from.

Principal Repayment or Interest Earned not 0 on a mutual-fund lot raises the Warning
`capital-gains.nonzero-principal-or-interest`; a date or number cell that is not one is INVALID SOURCE DATA for that
cell (Warning `capital-gains.invalid-cells`).

## 5. Lot classes

The platform signals special lots through Acquisition Date and Acquisition Price. Each lot gets exactly one class, in
this order. **The rule's cost basis governs; the lot class only supplies inputs**: the cost for tax is always the one
of the lot's rule (§10.1), and the class is worked out again whenever the analyst sets or changes the scheme's tax
class (§9.1).

The **merger pattern** is: Acquisition Date equals Sale Date and differs from Purchase Date, Acquisition Price equals
Sale Price, and LTCG and STCG are both 0 (a merger at a zero gain matches too). LTCG and STCG must be present and 0;
a blank cell does not match. Acquisition Price is compared with the stated Sale Price exactly, or with a derived price
to ₹0.01 per unit. The merger-pattern rows of one sale event (§6) form a **merger event**.

| Class | Recognised by | Meaning | Cost for tax |
|---|---|---|---|
| `non-taxable-transfer` | the merger pattern, on an event that passes the date gate (sale date from 2015-04-01 for a scheme consolidation, from 2016-04-01 for a plan consolidation within one scheme) and that the analyst has not answered as taxable | a scheme merger or a consolidation of plans that the law does not treat as a transfer (s.47(xviii), (xix); 2025 Act s.70(1)(zj), (zk); §10.4, TR-5): the economic gain is real, the taxable gain is nil | not applicable: taxable gain 0 |
| `taxable-transfer` | the merger pattern on an event dated before the date gate (the default, with the Warning `capital-gains.merger-taxable`), or on an event the analyst answers as a taxable consolidation or an investor switch | a transfer taxed as a sale on the event date, under the rule for its class and holding on that date (TR-5) | the rule's basis, from the actual cost and the Purchase Date, as for any sale |
| `grandfathered` | equity tax class, Acquisition Date 31 Jan 2018, Purchase Date before 1 Feb 2018 | the statement's Acquisition Price is the unit's value on 31 Jan 2018 (section 112A grandfathering) | the value is used only when the lot's rule has the grandfathered cost basis (EQ-LT-2, EQ-LT-4, EQ-LT-6, EQ-LT-8): the higher of the actual cost and the lower of that value and the sale price, per unit (§10.2). On any other rule (for example a short-term sale, EQ-ST-2: s.55(2)(ac) covers only long-term s.112A assets) the value is ignored and the rule's basis applies (Information `capital-gains.grandfathered-value-ignored`) |
| `indexed-cost-shown` | non-equity tax class, Acquisition Date equals Purchase Date, Acquisition Price differs from Purchase Price | the statement shows an indexed cost per unit | the app's own indexed cost when the rule allows indexation (§10.3), compared with the statement's (Warning `capital-gains.gain-differs` beyond the §4 tolerance); otherwise the rule's basis, and the stated indexed cost is ignored (Information `capital-gains.indexed-cost-ignored`) |
| `standard` | Acquisition Date and Price equal Purchase Date and Price, or both blank | an ordinary lot | the rule's basis: actual cost, or cost indexed from the actual cost and the dates where the rule allows it |
| `other` | anything else | a pattern this design does not know | the rule's basis from the actual cost; the statement's split shown beside; Warning `capital-gains.lot-class-other` |

Notes:
- **Equity lots bought before 1 Feb 2018 and sold long term from 1 Apr 2018 in the `standard` class** carry no
  31 Jan 2018 value. The statement then kept the actual cost (correct when that cost is above the 31 Jan 2018 value)
  or did not supply the value; the app cannot tell which without NAV history. It computes the lot on the actual cost,
  labelled "31 Jan 2018 value not supplied; actual cost used; gain may be overstated" (Information
  `capital-gains.grandfathering-value-not-supplied`, with the count). The error can go one way only: the
  grandfathered cost is never below the actual cost, so the computed gain can be too high, never too low (TR-11). The
  dash is kept only for a lot that needs the s.55(2)(b) or s.90(9) input for the actual-cost leg: first held before
  1 Apr 2001, or marked by the analyst as received by gift or inheritance (Warning `capital-gains.cost-input-missing`).
- **Merger events** are listed for the analyst by event (scheme, date, lot count), with one High result
  `capital-gains.non-taxable-transfers` to acknowledge. For each event the analyst gives one of three answers (an
  audit entry): (1) a non-taxable consolidation (s.47(xviii) or (xix); 2025 Act s.70(1)(zj) or (zk)), offered only
  when the date gate holds; (2) a taxable consolidation (before those dates, between classes under the consolidation
  test, or between fund houses); (3) an investor-initiated switch (scheme to scheme, Regular to Direct, growth to
  IDCW). Answers 2 and 3 make the event's rows `taxable-transfer`. Until the analyst answers, an event dated from
  2016-04-01 is computed as non-taxable, an event dated 2015-04-01 to 2016-03-31 as non-taxable on the
  scheme-consolidation reading (a plan consolidation in that window is taxable: answer 2), and an earlier event as
  taxable (Warning `merger-taxable`); the High result stays open meanwhile. An event whose two schemes are known (once
  matched, M2) to belong to different fund houses also raises the Warning `capital-gains.cross-house-merger`. In the
  sample export every merger event is dated after 1 Apr 2016 (a private check that recorded no values), so its merger
  rows are the non-taxable class; the fixture still covers both sides of each date gate (§13.4).
- **Successor lots.** After a non-taxable event, the successor scheme's lots should carry the original cost and
  purchase date. A lot of the same account whose Purchase Date equals the date of a non-taxable event, in a scheme
  label other than the event's, is reported (Warning `capital-gains.successor-reset`), because its cost and holding
  period may have been reset to the merger: the gain is understated when the merger value is above the original cost
  (overstated when below), and the term may be wrongly short. The analyst sets its original purchase date and cost
  (an audit entry), or it is computed as stated and flagged (known answer KA-8, §13.4). The warning is raised only
  after a non-taxable event: after a taxable one, a successor lot that starts on the event date is correct.
- **Successor lots after a taxable event.** After a taxable event (by default, or answer 2 or 3), the successor's
  holding restarts on the event date at the merger value. The platform writes the merger pattern because it treats the
  event as non-taxable, so its successor lots will usually carry the original cost and purchase date. A lot of the same
  account in a scheme label other than the event's, whose Purchase Date is before the event date and equals a Purchase
  Date of the event's merger rows, and whose Sale Date is after the event date, is reported (Warning
  `capital-gains.successor-not-reset`): as stated, the merger gain is counted twice (once on the event, again in the
  lot) and the term may be wrongly long. An SIP instalment of another scheme bought on the same day also matches; the
  Warning lists the candidate lots by scheme, and the analyst re-bases only the successor's lots. The analyst re-bases
  a successor lot (an audit entry: purchase date = the event date, cost = S x V / W, where S and W are the Sell Amount
  and the Invested Value of the event's merger rows with that Purchase Date and V is the lot's Invested Value), or it
  is computed as stated and flagged, with the amount counted twice named: (S - W) x V / W (known answer KA-17, §13.4).
  The re-base applies the general principle that units received in a taxable consolidation cost their merger value,
  which is still to be confirmed (§10.4, §10.9).
- **Realised totals.** A non-taxable transfer's economic gain is shown in the year's non-taxable line only, never in
  its realised total, unless its successor lots are `successor-reset` (§4).

## 6. Repeated rows

- **Definition.** Two lot rows repeat each other when every one of their cells, as read, is equal (folio, dates,
  units, prices and amounts included). Genuine same-day lots that differ in any cell, such as two purchases on the
  same day with different units, are never repeats. Two genuine lots can also be equal in every cell (two SIP
  instalments of the same amount on the same day in one folio); the reader cannot tell them from a repeat, which is
  why the analyst answers per sale event.
- **Sale event.** A sale event is the set of lot rows of one folio (within its account: client and distributor), one
  scheme label and one sale date. An event is **wholly repeated** when each distinct row of it appears the same number
  of times k > 1, and **partly repeated** otherwise.
- **What a real export showed.** Some sales appeared several times with all their lots, others with only some lots
  repeated, and the statement's own totals row **included** the repeats. A lot cannot be sold twice, so whole repeated
  sales most likely duplicate one transaction; but the statement is the source of record, so the app does not decide
  alone.
- **Behaviour.** The import report lists the repeated rows by sale event (wholly or partly repeated, with the
  realised gain they carry per financial year) and asks **one question per sale event** (an analyst question, kind
  `capital-gains-repeats`, like OD-3's): **count its repeated rows as stated, or once**. "Apply to all" answers every
  open event the same way in one step; each answer is still recorded per event, as an audit entry. Until an event is
  answered, the realised and taxable totals of its financial year are INSUFFICIENT EVIDENCE (High
  `capital-gains.repeats-question`); the other years are unaffected. Nothing is dropped silently: with "once", the
  extra rows are kept in the import record, excluded and listed. When an IRR file is loaded, the units of each
  repeated event are compared with the IRR redemptions of that folio, scheme and date, and the report says which
  answer the IRR units support (a hint shown beside the question, never an answer).
- **Owner item.** Whether the platform repeats rows by design is a question for the platform's support, raised by the
  owner (§15, item 5).

## 7. Reconciliation with the statement's totals

Only the amount columns are reconciled: 13 (Sell Amount), 14 (Principal Repayment), 15 (Invested Value), 16
(Realized G/L), 17 (LTCG G/L), 18 (STCG G/L), 22 (Interest Earned) and 24 to 29 (the tax columns). The per-unit prices
(10, 11, 20), the units (12), the holding days (21) and XIRR (23) are never reconciled. For each amount column, the sum
over **all** lot rows as read (repeats included, the way the platform sums them; excluded lots of §2.4 left out) is
compared with the totals row's cell:
- an empty lot cell counts as 0, so a totals cell of 0 over a column whose lot cells are all empty is reconciled;
- a blank totals cell leaves that column "not reconciled" (named, never a mismatch);
- the tolerance is ₹1 per column plus ₹0.005 for each lot row summed (₹1 + ₹0.005 x n over n lot rows), which covers
  the export's rounding of each row to the paisa;
- within the tolerance the column is reconciled (Information `capital-gains.totals-reconciled`, naming the columns
  reconciled and those not reconciled); beyond it, High `capital-gains.totals-mismatch` names the column and the
  difference, and names the excluded lots, if any, as a possible cause.

A statement without a totals row is not reconciled (Information `capital-gains.no-totals-row`). Whether the stated tax
columns are empty is decided on the lot rows only (Information `capital-gains.stated-tax-columns-empty`), even when
the totals row holds 0 in some of them. The comparison uses the rows as read, before the repeated-rows answers, so it
tells the analyst whether the statement's own totals include the repeats.

## 8. Financial years and the tax view

- The financial year of a lot runs from 1 April to 31 March and is taken from its sale date (a lot sold on 31 Mar 2025
  is in FY 2024-25; on 1 Apr 2025 in FY 2025-26). Labels follow the law of the year: "FY 2025-26" and earlier under
  the Income-tax Act 1961, "Tax year 2026-27" and later under the Income-tax Act 2025; sections are shown with both
  numbers from tax year 2026-27, for example "Sec 76 (old 50AA)", "Sec 198 (old 112A)".
- The export is the client's lifetime realised history, so every tax figure is per financial year. The tax view shows
  the financial year of the review's as-on date and the one before by default; the analyst can pick any year in the
  file. Lifetime totals are shown only as a count of lots and years.
- The statement is the source of record for the realised gains of the years it covers (D-032). When an IRR file is
  also loaded, the two are reconciled per scheme and financial year (`03-architecture.md` §6.7; High on a difference
  beyond tolerance), unchanged by this design.

## 9. Indicative tax

Every figure in this section is labelled "Indicative, not tax advice; rules as in the tax-rule table of <date>;
resident individual assumed". The rule set used (its version date and the rule ids that applied) is shown with the
figures and on the workbook's Tax and Transactions sheet.

### 9.1 Tax class, listed flag and sub-type of a lot
Three classes: **equity-oriented fund**; **Specified mutual fund** (section 50AA, Sec 76 from tax year 2026-27, by
the test in force for the financial year of the sale, §10.3); **other non-equity fund** (the general rule: for
example international fund of funds, gold and silver funds, balanced hybrids). The class is a fact about the scheme
for the financial year of the sale, the fund house's year-end tax classification (TR-7), never read from the category
name alone. It comes from, in this order:
1. the analyst's class for the scheme and year (an audit entry), entered from the fund house's classification. For a
   scheme in a fund-of-funds category of §10.5a, or named as a fund of funds, the analyst's equity-oriented class is
   accepted only for sales from 2018-04-01, and it gives the 90/90 sub-type to that scheme's sales in that financial
   year only, without setting the per-scheme 90/90 flag (TR-6, TR-18); for an earlier sale it is refused, with the
   reason named;
2. the default of the statement's Category Name: the category map (§10.5a) gives the §10.5 fund type, and the fund
   type gives a class for the sale's window where its "Step-2 default" column says so (for example equity funds,
   debt funds, conservative and balanced hybrids, international fund of funds, gold and silver funds and ETFs). From
   tax year 2026-27, aggressive hybrid, arbitrage and equity savings funds default to equity-oriented, the usual
   bucket of the owner's reckoner, labelled "usual bucket per the owner's reckoner; confirm with the fund house"
   (Warning `capital-gains.usual-bucket-default`); balanced advantage and multi-asset funds have no default; before
   tax year 2026-27 none of these five has a default. Sectoral Funds and Thematic Funds default to equity-oriented,
   with the Warning `capital-gains.category-default-to-confirm` on every lot so classed, listed by scheme
   ("equity-oriented by its category; a fund investing mainly in foreign shares is not equity-oriented: confirm the
   class"). A Category Name the map does not hold maps to nothing (Warning `capital-gains.category-unmapped`) and goes
   to step 3;
3. the statement's own classification, labelled "statement's classification" (Warning
   `capital-gains.tax-class-from-statement`), for fund types without a default and for unmapped categories:
   "Equity" (Asset Name, else the tag) means equity-oriented; "Debt" means other non-equity only for units bought
   before 2023-04-01, where the Specified and the other non-equity classes share the same rows; for units bought from
   2023-04-01 "Debt" cannot tell a Specified fund from another non-equity fund, so the lot goes to step 4. A scheme in
   a fund-of-funds category of §10.5a, or named as a fund of funds, is never equity-oriented on the Equity label
   (TR-6): without the 90/90 flag it goes to step 4;
4. otherwise the lot's tax is the dash with "tax class not set" (Warning `capital-gains.tax-class-not-set`). A lot
   bought from 2023-04-01 that reaches this step also raises the Warning `capital-gains.specified-test-missing`: the
   Specified test of its year (TR-4) needs the fund's percentages from the fund house.

**Listed flag** (per scheme; it decides between the 12-month and the 24-month rows for non-equity sales from
2024-07-23, TR-16): the analyst's flag (an audit entry); otherwise listed when the scheme is an ETF by its name and not
a fund of funds; otherwise unlisted. The one exception: a close-ended non-equity scheme (known from the scheme data or
the analyst's close-ended mark, an audit entry) has no flag until the analyst sets one. Its lot sold from 2024-07-23
and held more than 12 and at most 24 months shows the dash (Warning `capital-gains.listed-flag-missing`), because a
listed close-ended scheme is long term after 12 months, but only when the lot's rule depends on the listed flag (the
general-rule non-equity rows from 2024-07-23); a close-ended Specified lot bought from 2023-04-01 (NE-50AA-1 to
NE-50AA-3, rows that do not depend on the flag) is computed. Where the figures are the same either way (held at most
12 or more than 24 months), the unlisted row's id is recorded, labelled "listed flag missing; same figures either
way".

**Sub-type** (per scheme; for a fund of funds classed by the analyst, per scheme and year, step 1): none; ELSS (from
the category map); or equity ETF fund of funds meeting the 90/90 test, an analyst flag (an audit entry) that sets the
class by sale date for every sale and, for sales in FY 2018-19, selects EQ-FOF-1 and EQ-FOF-2 (TR-18). A lot with the 90/90 sub-type is equity-oriented for sales from 2018-04-01 and other
non-equity before that (TR-18); steps 2 to 4 do not apply to it. To class a year otherwise, the analyst clears the
90/90 flag for that scheme (an audit entry) and then sets the class of each year (step 1).

**The rule key** is (tax class, listed flag, sub-type, purchase date, sale date). Valid keys: ELSS only with the
equity-oriented class; the 90/90 sub-type with the equity-oriented class from 2018-04-01 and with the other non-equity
class before it, where the NE rows apply; the sub-type selects rows only where §10 "How to read it" says so; the
listed flag may be missing only for a close-ended non-equity scheme; such a key maps to the unlisted row when the term
is the same either way (held at most 12 or more than 24 months, or a row marked neither), and to no row (the dash,
`listed-flag-missing`) when the lot's rule depends on the flag; purchase date on or before sale date; any other
combination is refused at input (an analyst's class or flag that would make one is not accepted, and the reason is
named). A statement lot whose purchase date is after its sale date has no valid key: it is kept and flagged
(`row-check-failed`), and its tax is the dash. Every valid key, other than a key with the listed flag missing whose
rule depends on the flag, maps to exactly one rate row of §10.1, which gives the term, the rate bucket and the cost
basis. ELSS lots also pass the lock-in check EQ-ELSS-1 (§10.1, "Checks").

**OD-17** (hybrids by equity share) is applied through the three buckets of §10.5 for sales from 2025-04-01: 65% or
more listed Indian equity is equity-oriented; more than 65% debt is Specified; anything else follows the general rule.
Earlier sales use the tests of the §10.5 definition table for their window: no Specified class before 2023-04-01, the
35% domestic-equity test for sales 2023-04-01 to 2025-03-31, and the s.10(38) equity test without a listing
requirement for sales before 2018-04-01 (and for s.111A until 2019-03-31): more than 50% for sales to 2006-05-31 and
more than 65% from 2006-06-01 (the §10.5 definition table). Using this dated statutory table for realised lots, in
place of OD-17's equity-share bands and OD-2's single 12-month test, is an owner item (§15, item 1).

A class that differs from the statement's Asset Name is reported (Warning `capital-gains.tax-class-differs`): for
example an international fund of funds that the platform labels Equity but taxes, correctly, with the non-equity
holding periods.

### 9.2 Term
Long term means held for more than the period in §10 for the lot's class and dates, counted in calendar months: a lot
is long term when its sale date is **strictly after** the anniversary (OD-2), so a sale on the anniversary itself is
short term. A purchase on 29 February has its anniversary on 28 February of a common year. When the app's term differs
from the statement's split (for example a sale on the exact anniversary that the statement treats as long term), the
lot is listed (Warning `capital-gains.term-differs`) and the app's term is used.

Every lot sold on the anniversary or on the day after it is flagged (Warning `capital-gains.anniversary-sale`, TR-1,
TR-20), so the analyst can check the date basis. For a sale on the anniversary itself the long-term figure (its rule,
taxable gain and tax as a long-term lot) is shown beside the lot, and the person-year summary shows the tax if those
lots were long term (`alternatives.anniversaryLongTerm`, `DATA_DICTIONARY.md` §6). Whether OD-2 stays for these sales
is an owner item (§15, item 2). A lot whose sale date is after the review's as-on date is flagged (Warning
`capital-gains.after-as-on-date`); a lot's age never goes negative.

### 9.3 From lots to tax for a financial year
Tax is computed **per person**, never pooled across the family: losses, set-off and the annual exemption belong to one
person (TR-15). **The person is the `clientId` of §2.3**: the normalised Client Name, else the name part of Account
Name (`accountLabel`). The normalisation folds letter case and spacing, as for the base file, so labels that differ
only in those are one person. Two different client labels in one file raise the Warning
`capital-gains.person-ambiguous` ("possibly one person"), with counts only, for the analyst to check, by this test:
after folding letter case and spacing and dropping a leading honorific (Mr, Mrs, Ms, Dr, Shri, Smt, with or without a
full stop), they are possibly one person when their words pair up in order, a one-letter word (with or without a full
stop) pairing with any word that starts with that letter, and one label may carry extra one-letter words; two
different one-letter words never pair. So "Sample Client A" and "S Client A" are possibly one person; "Sample Client A" and "Sample Client B" are not.
A lot whose client matches no client of the review is kept as its own person by its `clientId`, computed separately,
listed under "clients not in the review", and never pooled with a review client or added to the family sum
(`clients-unmatched`, §11). The family view shows the per-person results of the review's clients side by side and
their sum, labelled "sum of separate computations"; the sum is PARTIAL COVERAGE when any person's figure is (step 2).

**Rates and regime, per person and per financial year.** The analyst enters, for each person and each financial year,
each value an audit entry: the **slab rate** (the person's marginal rate; no default); the **surcharge rate** (no
default; the entry is limited to the year's maximum in §10.7: 10% for FY 2004-05 to FY 2008-09, nil for FY 2009-10 to
FY 2012-13, when nothing is asked, 10% for FY 2013-14 and FY 2014-15, 12% for FY 2015-16, 15% for FY 2016-17 to
FY 2018-19, 37% from FY 2019-20, or 25% under the new regime from FY 2023-24); and, from FY 2023-24, the **regime**
(old or new), so that the right surcharge maximum applies (TR-12). From FY 2023-24, while the regime is not entered, a
surcharge entry above 25% is held (kept, not applied) and the person's totals are shown "before surcharge (regime not
set)"; an entry of 25% or less applies under either regime.

**Taxpayer.** Every figure is labelled "resident individual assumed" (TR-13). Lots of a minor (whose gains are clubbed
with a parent's income), of an HUF, of joint holders and of a non-resident are flagged, when the ownership data or the
analyst marks them (the analyst's mark is per person or per lot, an audit entry; Warning
`capital-gains.assessee-flagged`), and are not computed differently.

1. Each lot is mapped to exactly one rule of §10.1 by its rule key (§9.1: tax class, listed flag, sub-type, purchase
   date and sale date), giving its term, rate bucket and cost basis; its taxable gain is sale value minus cost for tax
   (non-taxable transfers 0; section 10(38) exempt lots kept in their own "exempt" line). A lot whose rule needs an
   input still to be confirmed (for example the FY 2016-17 index, EQ-FOF-2, the exemption from tax year 2027-28)
   shows the dash with the rule id (Warning `capital-gains.rule-to-be-confirmed`); a lot sold before 1 Oct 2004 shows
   the dash with NOT APPLICABLE (Warning `capital-gains.outside-rule-table`). For NE-LT-1 (sales up to 2014-07-10)
   both figures are computed per lot on signed amounts, 20% of the indexed gain and 10% of the unindexed gain. The lot
   goes into the bucket of the lower figure (on equal positive figures, the 20% leg), so a lot with an indexed loss
   always takes the 20% leg and brings its indexed loss to set-off. Set-off and the `gain-differs` comparison use the
   gain of the chosen leg. The choice is made per lot, as the per-asset reading, before set-off; the year's-total
   figure is shown beside it (step 8); which is lower depends on the year's losses (KA-19, KA-20, KA-22). It is
   flagged for the tax adviser (Information `capital-gains.old-law-choice`; §15, item 4).
2. Gains and losses are totalled per person and per rate bucket of the year. Lots whose tax is the dash because they
   have no computable taxable gain (tax class not set, rule to be confirmed, listed flag missing, cost input missing,
   outside the rule table, no valid key) enter no rate bucket. The person-year's set-off, exemption and tax are
   computed over the other lots and are PARTIAL COVERAGE (`DATA_DICTIONARY.md` §2: the value with the "p" marker; the
   footnote names the count of lots left out and their economic gain, `realised`). Likewise, while the slab rate is
   not set, the total tax leaves out the slab buckets and is PARTIAL, except where step 3 makes the figures the dash.
   A family sum is PARTIAL when any person's figure is. A PARTIAL figure is never shown as a complete total (known
   answer KA-21).
3. Losses are set off within the year by §10.6 (TR-10). **Long-term losses are set off first**, only against
   long-term gains, highest rate first (section 112A or Sec 198 gains inside the unused exemption last). **Short-term
   losses are then set off** against the remaining gains of either term, **highest-taxed first, slab-rate gains
   included** at the person's slab rate. This order gives the lowest tax for the year for the rate buckets as formed
   (NE-LT-1 legs chosen per lot, step 1) and leaves any unabsorbed loss short term where possible (known answer
   KA-18). For the ranking, section 112A (Sec 198) gains up to the person's unused annual exemption count as 0% and
   come last; among equal rates, the loss is set against non-exempt gains
   first (known answer KA-13). Losses on EQ-LT-1 exempt sales are ignored. The order needs the slab rate: while it is
   not set and a short-term loss meets slab-rate gains, the person's taxable amounts after set-off and their tax are
   the dash with "slab rate not set" (known answer KA-12). A loss left after set-off is reported against the person,
   by term, and not carried forward (§9.4).
4. The annual exemption of the year applies to the section 112A (Sec 198 from tax year 2026-27) gains that remain
   after set-off (§10.2); it is one limit per person, shared across all such gains. In FY 2024-25 the single
   ₹1,25,000 is applied first to the 12.5% gains and only the rest to the 10% gains, the order more favourable to the
   client and consistent with set-off; the figure under the other order is shown in a note, and both are labelled
   "order not set by the Act" (TR-2, known answer KA-9).
5. Tax = the sum over buckets of the taxable amount times its rate; slab-rate buckets use the person's **slab rate**
   for the year, which has no default: until it is set, their tax is the dash with NOT AVAILABLE IN SUPPLIED DATA
   ("slab rate not set").
6. Surcharge = the person's surcharge rate for the year, capped for capital gains as §10.7 says for the year and the
   regime (TR-12). Until the rate is entered, every total is shown "before surcharge (rate not set)"; from FY 2023-24,
   while the regime is not entered and the entry is above 25%, every total is shown "before surcharge (regime not
   set)"; in a year whose maximum is nil the surcharge is 0 and nothing is asked. Cess at the year's rate (§10.7) on
   tax plus surcharge (on tax alone while a total is before surcharge, labelled the same way).
7. The statement's own LTCG and STCG totals for the year are shown beside the app's, with the count of lots on which
   they differ and why (term, grandfathering, class, indexation).
8. Alternatives are shown beside the person-year result: the tax if the anniversary-day lots were long term (§9.2);
   in FY 2024-25, the tax under the other exemption order (step 4); and, in a year with NE-LT-1 lots, the year's-total
   figure: the year's tax computed twice, set-off (TR-10) included, once with every NE-LT-1 lot on its 20% leg and
   once with every one on its 10% leg; the lower is shown as the year's-total figure (step 1, KA-19, KA-20, KA-22).

### 9.4 Not computed
Carry-forward of losses from earlier years (it depends on the returns filed) and of this year's unabsorbed losses
(reported, not carried), the resident's unused basic exemption against section 111A and 112A gains, the section 87A
rebate, and surcharge thresholds and marginal relief (the analyst enters the rate). Each is named in a footnote on
the tax view.

## 10. Tax-rule table v1 (dated)

Researched from primary sources, verified three times and reconciled by the financial-domain reviewer on 27 Oct 2026,
then revised the same day after the financial, completeness and security reviews (the lead's decisions, §10.11). It was
approved by the financial-domain reviewer on 27 Oct 2026 for M7 (§10.10). **Indicative, not tax advice.** The table
becomes `data/owner/tax-rules.json` in M7 (E-144, E-154), with the category map of §10.5a as its `categoryDefaults`;
until then this section is the record.

**How to read it.**
- **The rule key** is (tax class, listed flag, sub-type, purchase date, sale date) (§9.1), and every valid key (§9.1)
  maps to exactly one rate row of §10.1, except a key with the listed flag missing whose rule depends on the flag,
  which maps to none (the dash, §9.1). The tax class is one of the three of §10.5. The listed flag selects between the rows
  marked "unlisted unit" (NE-ST-3, NE-LT-4, NE-ST-4, NE-LT-5) and "listed unit" (NE-ST-3L, NE-LT-4L, NE-ST-4L,
  NE-LT-5L); a row marked neither applies to both. The sub-type is none, ELSS or equity ETF fund of funds (90/90): for
  sales in FY 2018-19 the 90/90 sub-type selects EQ-FOF-1 and EQ-FOF-2 in place of EQ-ST-2, EQ-LT-2 and EQ-LT-3; in
  every other window the equity rows apply to all three sub-types (a 90/90 fund of funds sold before 2018-04-01 is of
  the other non-equity class, TR-18). Rules are keyed by sale date; where the law depends on the purchase date
  (grandfathering, section 50AA and Sec 76) the purchase window is part of the key. Sales before 1 Oct 2004 are outside
  the table (`outside-rule-table`). Checks that carry no rate of their own (the ELSS lock-in) are listed after the
  table.
- **Long term means strictly after the anniversary** (OD-2): the anniversary is the date N calendar months after the
  purchase date with the same day number, or the last day of that month when it has no such day (a 29 February
  purchase). A lot sold on the anniversary itself is short term; it is flagged and its long-term figure is shown beside
  it, because two decisions read the law the other way (decision TR-1 below).
- Rates exclude surcharge and cess (§10.7). Slab means the slab rate the analyst enters for the person and year
  (§9.3). "Per person": every limit, set-off and exemption belongs to one client, never to the family (TR-15).
- For sales from 1 Apr 2026 the source of record is the owner's **India Investment Taxation Reckoner, Tax Year
  2026-27** (law as on 19 Oct 2026; Centricity material, class P under D-026), cited by title and as "Reckoner
  TY2026-27, sheet!cell"; earlier rows cite the Act, the Finance Acts and CBDT material on the Income Tax Department's
  site. A dash in a cell means "to be confirmed" (§10.9).
- **Decision ids.** The interpretation decisions of this design are TR-1 to TR-21. The live page's own tax review
  numbers its items TX-01 to TX-23; it is cited as "the live-page tax review (register TX-nn)". That register is kept
  with the live page's working records, outside this repository, and holds no client data.

### 10.1 The dated rules

| Rule id | Tax class | Sale date from | Sale date to | Purchase date condition | Long term when | Rate (short) | Rate (long) | Annual exemption | Cost basis | Sections (1961 Act; 2025 Act) | Source |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EQ-ST-1 | equity-oriented fund | 2004-10-01 | 2008-03-31 | any | strictly after the 12-month anniversary (OD-2); this row applies on or before it | 10% | - | - | actual | 1961: s.111A(1), s.2(42A) first proviso; 2025: not in force | https://www.incometaxindia.gov.in/w/section-111a-5 ; https://www.incometaxindia.gov.in/w/247-notification-247-date-of-issue-28/9/2004 ; https://www.incometaxindia.gov.in/w/section-2-12 ; OD-2 per Reckoner TY2026-27, Change Log & Sources!E7 |
| EQ-ST-2 | equity-oriented fund (FY 2018-19 sales: not a 90/90 ETF FoF, see EQ-FOF-1) | 2008-04-01 | 2024-07-22 | any | strictly after the 12-month anniversary (OD-2); this row applies on or before it | 15% | - | - | actual | 1961: s.111A(1)(i) (Finance Act 2008, AY 2009-10), s.111A(1)(i)(a) for transfers before 2024-07-23, s.2(42A); 2025: not in force | https://www.thc.nic.in/Central%20Governmental%20Acts/Finance%20Act,%202008.pdf ; https://www.incometaxindia.gov.in/w/section-111a-21 (footnotes 36, 37) ; https://www.incometaxindia.gov.in/w/section-111a-15 (footnote 63) |
| EQ-ST-3 | equity-oriented fund | 2024-07-23 | 2026-03-31 | any | strictly after the 12-month anniversary (OD-2); this row applies on or before it | 20% | - | - | actual | 1961: s.111A(1)(i)(b), s.2(42A); 2025: not in force | https://www.incometaxindia.gov.in/w/section-111a-21 ; https://pib.gov.in/PressReleasePage.aspx?PRID=2036604 ; Reckoner FY2025-26, Mutual Funds!G8 (supporting) |
| EQ-ST-4 | equity-oriented fund | 2026-04-01 | - | any | strictly after the 12-month anniversary (OD-2); this row applies on or before it | 20% | - | - | actual | 1961 equivalent: s.111A; 2025: s.196(1)(i), s.196(5), s.2(101)(b)(iii) | Reckoner TY2026-27, Master Summary!D10, F10, G10, H10; Mutual Funds!F7, G7, H7; Change Log & Sources!E7 ; https://www.incometaxindia.gov.in/w/section-196-78 ; https://www.incometaxindia.gov.in/w/section-2-1 |
| EQ-LT-1 | equity-oriented fund | 2004-10-01 | 2018-03-31 | any | strictly after the 12-month anniversary (OD-2) | - | 0% (exempt) | whole gain exempt, no threshold | not needed (gain exempt) | 1961: s.10(38), s.2(42A); 2025: not in force | https://www.incometaxindia.gov.in/w/section-10-11 ; https://www.incometaxindia.gov.in/w/section-10-62 ; https://itatonline.org/info/cbdt-issues-faqs-on-taxation-of-ltcg-as-per-finance-bill-2018/ |
| EQ-LT-2 | equity-oriented fund (FY 2018-19 sales: not a 90/90 ETF FoF, see EQ-FOF-2) | 2018-04-01 | 2024-03-31 | on or before 2018-01-31 | strictly after the 12-month anniversary (OD-2) | - | 10% | Rs 1,00,000 per person per FY on aggregate s.112A gains after set-off, shared with gains outside the statement (TR-9) | grandfathered: higher of actual cost and lower of FMV on 2018-01-31 and sale value; actual-cost leg subject to s.55(2)(b) | 1961: s.112A(2)(i), s.55(2)(ac); 2025: not in force | https://www.incometaxindia.gov.in/w/section-112a-61 ; https://www.incometaxindia.gov.in/w/section-55-64 ; https://itatonline.org/info/cbdt-issues-faqs-on-taxation-of-ltcg-as-per-finance-bill-2018/ |
| EQ-LT-3 | equity-oriented fund (FY 2018-19 sales: not a 90/90 ETF FoF, see EQ-FOF-2) | 2018-04-01 | 2024-03-31 | on or after 2018-02-01 | strictly after the 12-month anniversary (OD-2) | - | 10% | Rs 1,00,000 per person per FY on aggregate s.112A gains after set-off, shared with gains outside the statement (TR-9) | actual | 1961: s.112A(2)(i); 2025: not in force | https://www.incometaxindia.gov.in/w/section-112a-61 ; https://www.incometaxindia.gov.in/w/section-112a-62 ; https://www.incometaxindia.gov.in/w/section-112a-58 |
| EQ-LT-4 | equity-oriented fund | 2024-04-01 | 2024-07-22 | on or before 2018-01-31 | strictly after the 12-month anniversary (OD-2) | - | 10% | Rs 1,25,000 per person for FY 2024-25, one limit shared by EQ-LT-4 to EQ-LT-7 (order: TR-2) | grandfathered (s.55(2)(ac)); actual-cost leg subject to s.55(2)(b) | 1961: s.112A(2)(i)(a) and proviso, s.55(2)(ac); 2025: not in force | https://www.incometaxindia.gov.in/w/section-112a-59 ; https://pib.gov.in/PressReleasePage.aspx?PRID=2036604 ; https://www.incometaxindia.gov.in/w/section-55-64 |
| EQ-LT-5 | equity-oriented fund | 2024-04-01 | 2024-07-22 | on or after 2018-02-01 | strictly after the 12-month anniversary (OD-2) | - | 10% | Rs 1,25,000 per person for FY 2024-25, one limit shared by EQ-LT-4 to EQ-LT-7 (order: TR-2) | actual | 1961: s.112A(2)(i)(a) and proviso; 2025: not in force | https://www.incometaxindia.gov.in/w/section-112a-59 ; https://pib.gov.in/PressReleasePage.aspx?PRID=2036604 |
| EQ-LT-6 | equity-oriented fund | 2024-07-23 | 2026-03-31 | on or before 2018-01-31 | strictly after the 12-month anniversary (OD-2) | - | 12.5% | Rs 1,25,000 per person per FY (FY 2024-25 shared with EQ-LT-4 and EQ-LT-5) | grandfathered (s.55(2)(ac)); actual-cost leg subject to s.55(2)(b) | 1961: s.112A(2)(i)(b), s.55(2)(ac); 2025: not in force | https://www.incometaxindia.gov.in/w/section-112a-59 ; https://www.incometaxindia.gov.in/w/section-112a-60 ; https://pib.gov.in/PressReleasePage.aspx?PRID=2036604 ; Reckoner FY2025-26, Mutual Funds!H8, I8 (supporting) |
| EQ-LT-7 | equity-oriented fund | 2024-07-23 | 2026-03-31 | on or after 2018-02-01 | strictly after the 12-month anniversary (OD-2) | - | 12.5% | Rs 1,25,000 per person per FY (FY 2024-25 shared with EQ-LT-4 and EQ-LT-5) | actual | 1961: s.112A(2)(i)(b); 2025: not in force | https://www.incometaxindia.gov.in/w/section-112a-59 ; https://www.incometaxindia.gov.in/w/section-112a-60 ; Reckoner FY2025-26, Mutual Funds!H8, I8 (supporting) |
| EQ-LT-8 | equity-oriented fund | 2026-04-01 | - | on or before 2018-01-31 | strictly after the 12-month anniversary (OD-2) | - | 12.5% | Rs 1,25,000 per person per tax year on aggregate s.198 gains after set-off, one limit shared with listed shares and business trust units (TR-9) | grandfathered: same formula (2025 Act s.90(7), s.90(8)(b), subject to s.90(9)) | 1961 equivalent: s.112A, s.55(2)(ac); 2025: s.198(2)(a), s.198(1)(c)(ii), s.90(7), s.90(8)(b) | Reckoner TY2026-27, Master Summary!G10, I10, J10, P8; Mutual Funds!A45; Exemptions & Set-off!D10, F10 ; https://www.incometaxindia.gov.in/w/section-198-78 ; https://www.incometaxindia.gov.in/w/section-90-114 |
| EQ-LT-9 | equity-oriented fund | 2026-04-01 | - | on or after 2018-02-01 | strictly after the 12-month anniversary (OD-2) | - | 12.5% | Rs 1,25,000 per person per tax year on aggregate s.198 gains after set-off, one limit shared with listed shares and business trust units (TR-9) | actual | 1961 equivalent: s.112A; 2025: s.198(2)(a), s.2(101)(b)(iii) | Reckoner TY2026-27, Master Summary!G10, I10, J10, K10; Exemptions & Set-off!D10, F10 ; https://www.incometaxindia.gov.in/w/section-198-78 |
| EQ-FOF-1 | FoF of domestic equity ETFs meeting the 90/90 test (FY 2018-19: equity-oriented for s.112A and s.2(42A) only) | 2018-04-01 | 2019-03-31 | any | strictly after the 12-month anniversary (OD-2); this row applies on or before it | slab | - | - | actual | 1961: s.2(42A) Explanation 4 (s.112A meaning from AY 2019-20); s.111A not applicable (its Explanation used the s.10(38) meaning until AY 2020-21); 2025: not in force | https://www.incometaxindia.gov.in/w/section-2-60 (footnote 5) ; https://www.incometaxindia.gov.in/w/section-111a-15 (footnote 63) ; https://www.indiabudget.gov.in/budget2019-20/doc/memo.pdf |
| EQ-FOF-2 | FoF of domestic equity ETFs meeting the 90/90 test | 2018-04-01 | 2019-03-31 | any | strictly after the 12-month anniversary (OD-2) | - | - | - | - | 1961: s.112A only if STT was paid on the transfer, otherwise s.112; 2025: not in force | to be confirmed |
| NE-ST-1 | other non-equity fund or specified (debt) mutual fund (every non-equity unit; the specified class did not exist yet) | 2004-10-01 | 2014-07-10 | any | strictly after the 12-month anniversary (OD-2), listed or not; this row applies on or before it | slab | - | - | actual | 1961: s.2(42A) first proviso (unit of a s.10(23D) mutual fund, from 1988-04-01), second proviso for 2014-04-01 to 2014-07-10; 2025: not in force | https://www.incometaxindia.gov.in/w/section-2-12 ; https://www.incometaxindia.gov.in/w/section-2-2 ; https://www.incometaxindia.gov.in/w/section-2-50 |
| NE-LT-1 | other non-equity fund or specified (debt) mutual fund (every non-equity unit) | 2004-10-01 | 2014-07-10 | any | strictly after the 12-month anniversary (OD-2) | - | lower of 20% of indexed gain and 10% of unindexed gain, chosen per lot on signed amounts, before set-off (§9.3 step 1; tax adviser to confirm, §15) | - | indexed (CII 1981-82 base) for the 20% leg, actual for the 10% leg | 1961: s.112(1)(a) and proviso ('listed securities or unit', from 2000-04-01), second proviso for 2014-04-01 to 2014-07-10, s.48 second proviso and Explanation (iii); 2025: not in force | https://www.incometaxindia.gov.in/w/section-112-10 ; https://www.incometaxindia.gov.in/w/section-112-21 ; https://www.incometaxindia.gov.in/w/section-112-54 ; https://www.incometaxindia.gov.in/w/section-115ab-12 ; https://www.incometaxindia.gov.in/w/section-48-21 |
| NE-ST-2 | other non-equity fund; specified (debt) mutual fund unit bought before 2023-04-01 | 2014-07-11 | 2024-07-22 | specified (debt) units: before 2023-04-01; other non-equity units: any | strictly after the 36-month anniversary (OD-2), listed or unlisted; this row applies on or before it | slab | - | - | actual | 1961: s.2(42A) main clause (36 months), first proviso narrowed by Finance (No. 2) Act 2014 from AY 2015-16; 2025: not in force | https://www.incometaxindia.gov.in/w/section-2-56 (footnotes 21 to 23) ; https://www.incometaxindia.gov.in/w/section-2-63 ; https://www.incometaxindia.gov.in/w/section-2-66 (footnote 10) |
| NE-LT-2 | other non-equity fund or specified (debt) mutual fund (every non-equity unit) | 2014-07-11 | 2017-03-31 | any | strictly after the 36-month anniversary (OD-2) | - | 20% of indexed gain | - | indexed (CII 1981-82 base); sales in FY 2016-17 need CII 2016-17, a dash until confirmed | 1961: s.112(1)(a)(ii), proviso limited to listed securities other than a unit, s.48 second proviso and Explanation (iii); 2025: not in force | https://www.incometaxindia.gov.in/w/section-112-54 (footnote 63) ; https://www.incometaxindia.gov.in/w/section-48-55 |
| NE-LT-3 | other non-equity fund; specified (debt) mutual fund unit bought before 2023-04-01 | 2017-04-01 | 2024-07-22 | specified (debt) units: before 2023-04-01; other non-equity units: any | strictly after the 36-month anniversary (OD-2) | - | 20% of indexed gain | - | indexed (CII 2001-02 base; base year 2001-02 when first held earlier; FMV on 2001-04-01 at the assessee's option for units held before then) | 1961: s.112(1)(a)(ii)(A), s.48 Explanation (iii) as amended by Finance Act 2017 w.e.f. 2018-04-01, s.55(2)(b)(i); 2025: not in force | https://www.incometaxindia.gov.in/w/section-48-56 (footnote 95) ; https://www.incometaxindia.gov.in/w/section-48-64 ; https://www.incometaxindia.gov.in/w/section-55-64 ; https://www.incometaxindia.gov.in/w/section-112-103 |
| NE-ST-3 | other non-equity fund, unlisted unit; specified (debt) unit bought before 2023-04-01, unlisted | 2024-07-23 | 2026-03-31 | specified (debt) units: before 2023-04-01; other non-equity units: any | strictly after the 24-month anniversary (OD-2); this row applies on or before it | slab | - | - | actual | 1961: s.2(42A) ('twenty-four' for 'thirty-six', Finance (No. 2) Act 2024 w.r.e.f. 2024-07-23); 2025: not in force | https://www.incometaxindia.gov.in/w/section-2-66 (footnotes 9 to 12) ; Reckoner FY2025-26, Mutual Funds!E19, E30, E31 (supporting) |
| NE-ST-3L | other non-equity fund, unit listed on a recognised stock exchange in India (ETF or other listed scheme); specified (debt) unit bought before 2023-04-01, listed | 2024-07-23 | 2026-03-31 | specified (debt) units: before 2023-04-01; other non-equity units: any | strictly after the 12-month anniversary (OD-2); this row applies on or before it | slab | - | - | actual | 1961: s.2(42A) first proviso with '(other than a unit)' omitted w.r.e.f. 2024-07-23, Explanation 2 (SCRA s.2(h)); 2025: not in force | https://www.incometaxindia.gov.in/w/section-2-66 (footnote 10) ; https://www.incometaxindia.gov.in/w/section-2-65 ; Reckoner FY2025-26, Mutual Funds!E29 (supporting) |
| NE-LT-4 | other non-equity fund, unlisted unit; specified (debt) unit bought before 2023-04-01, unlisted | 2024-07-23 | 2026-03-31 | specified (debt) units: before 2023-04-01; other non-equity units: any | strictly after the 24-month anniversary (OD-2) | - | 12.5% | - | actual (no indexation) | 1961: s.112(1)(a)(ii)(B); s.48 second proviso limited to transfers before 2024-07-23; 2025: not in force | https://www.incometaxindia.gov.in/w/section-112-103 ; https://www.incometaxindia.gov.in/w/section-48-64 ; Reckoner FY2025-26, Mutual Funds!F19, H19, F30, H30, F31, H31 (supporting) |
| NE-LT-4L | other non-equity fund, listed unit (ETF or other listed scheme); specified (debt) unit bought before 2023-04-01, listed | 2024-07-23 | 2026-03-31 | specified (debt) units: before 2023-04-01; other non-equity units: any | strictly after the 12-month anniversary (OD-2) | - | 12.5% | - | actual (no indexation) | 1961: s.112(1)(a)(ii)(B), s.2(42A) first proviso; 2025: not in force | https://www.incometaxindia.gov.in/w/section-112-103 ; https://www.incometaxindia.gov.in/w/section-2-66 ; Reckoner FY2025-26, Mutual Funds!F29, H29 (supporting) |
| NE-ST-4 | other non-equity fund, unlisted unit; specified (debt) unit bought before 2023-04-01, unlisted | 2026-04-01 | - | specified (debt) units: before 2023-04-01; other non-equity units: any | strictly after the 24-month anniversary (OD-2); this row applies on or before it | slab | - | - | actual | 1961 equivalent: s.2(42A); 2025: s.2(101)(a) | Reckoner TY2026-27, Master Summary!F14, H14, F26, H26, F30, H30, F31, H31; Mutual Funds!F26, H26, F31, F32, F34; Hybrid Funds & FoFs!E8, G8, A64 ; https://www.incometaxindia.gov.in/w/section-2-1 |
| NE-ST-4L | other non-equity fund, listed unit (ETF or other listed scheme); specified (debt) unit bought before 2023-04-01, listed | 2026-04-01 | - | specified (debt) units: before 2023-04-01; other non-equity units: any | strictly after the 12-month anniversary (OD-2); this row applies on or before it | slab | - | - | actual | 1961 equivalent: s.2(42A) first proviso; 2025: s.2(101)(b)(i) | Reckoner TY2026-27, Master Summary!F29, H29, F32, H32, P27; Mutual Funds!F26, F30, F33 ; https://www.incometaxindia.gov.in/w/section-2-1 |
| NE-LT-5 | other non-equity fund, unlisted unit; specified (debt) unit bought before 2023-04-01, unlisted | 2026-04-01 | - | specified (debt) units: before 2023-04-01; other non-equity units: any | strictly after the 24-month anniversary (OD-2) | - | 12.5% | - | actual (no indexation; s.72(2) indexes only item B of the s.197(3) formula, land or building) | 1961 equivalent: s.112, s.48; 2025: s.197(1)(b), s.72 | Reckoner TY2026-27, Master Summary!G14, I14, G26, I26, J26, K26, G30, I30, G31, I31; Hybrid Funds & FoFs!F8, H8; Exemptions & Set-off!A24 ; https://www.incometaxindia.gov.in/w/section-197-78 ; https://www.incometaxindia.gov.in/w/section-72-127 |
| NE-LT-5L | other non-equity fund, listed unit (ETF or other listed scheme); specified (debt) unit bought before 2023-04-01, listed | 2026-04-01 | - | specified (debt) units: before 2023-04-01; other non-equity units: any | strictly after the 12-month anniversary (OD-2) | - | 12.5% | - | actual (no indexation) | 1961 equivalent: s.112; 2025: s.197(1)(b), s.2(101)(b)(i) | Reckoner TY2026-27, Master Summary!G29, I29, J29, G32, I32, P27; Mutual Funds!G26, I26, G30, I30, G33, I33 ; https://www.incometaxindia.gov.in/w/section-197-78 |
| NE-50AA-1 | specified (debt) mutual fund, 35% test: not more than 35% of total proceeds in equity shares of domestic companies | 2023-04-01 | 2025-03-31 | on or after 2023-04-01 | never: deemed short term whatever the holding period | slab | - | - | actual (no indexation; STT not deductible) | 1961: s.50AA (Finance Act 2023 w.e.f. AY 2024-25), Explanation (ii) original; 2025: not in force | https://www.incometaxindia.gov.in/w/section-50aa-2 (footnotes 60, 61) ; Reckoner TY2026-27, Hybrid Funds & FoFs!A62, J25 |
| NE-50AA-2 | specified (debt) mutual fund, 65% test: more than 65% in debt and money market instruments, or 65% or more in units of such a fund | 2025-04-01 | 2026-03-31 | on or after 2023-04-01 | never: deemed short term whatever the holding period | slab | - | - | actual (no indexation; STT not deductible) | 1961: s.50AA, Explanation (ii) as substituted by Finance (No. 2) Act 2024 w.e.f. 2026-04-01 (AY 2026-27); 2025: not in force | https://www.incometaxindia.gov.in/w/section-50aa-2 ; Reckoner TY2026-27, Change Log & Sources!E9, G9; Hybrid Funds & FoFs!A62 ; Reckoner FY2025-26, Mutual Funds!A3, A16 (supporting) |
| NE-50AA-3 | specified (debt) mutual fund, Sec 76 (old 50AA), 65% test of s.76(5)(b) | 2026-04-01 | - | on or after 2023-04-01 | never: deemed short term whatever the holding period | slab | - | - | actual (no indexation; STT not deductible, s.76(4)) | 1961 equivalent: s.50AA; 2025: Sec 76 (old 50AA): s.76(1), s.76(2)(a), s.76(3), s.76(5)(b) | Reckoner TY2026-27, Master Summary!D25, E25, F25, G25, H25, I25; Mutual Funds!A3, A17; Hybrid Funds & FoFs!C7, D7, J7; Section Map!C19, D19 ; https://www.incometaxindia.gov.in/w/section-76-106 |

**Checks** (no rate of their own; each runs beside the rate row of the lot's key, so `rules.test.ts` can assert
exactly one rate row per key):

| Check id | Applies to | Check | Result | Sections (1961 Act; 2025 Act) | Source |
|---|---|---|---|---|---|
| EQ-ELSS-1 | equity-oriented fund, sub-type ELSS, sales from 2004-10-01; each instalment from its own allotment date (ELSS 2005 units allotted from 2005-11-03) | a sale on or before the 36-month anniversary of the allotment (inside the lock-in) is not expected, the death of the holder excepted (the nominee or heir may withdraw after one year) | Warning `capital-gains.elss-early-sale`; the lot keeps the rate row of its key and is not silently taxed as short term (an ELSS lot sold after the lock-in is taxed under the EQ-LT row for its sale date) | 1961: s.80C(2)(xiii) and ELSS 2005; 2025: s.123 | Reckoner TY2026-27, Master Summary!C11, F11, G11, I11; Mutual Funds!E10, F10, G10; Section Map!D32 ; https://www.incometaxindia.gov.in/w/226-notification-226-date-of-issue-3/11/2005 (para 3(d), 3(e)) |

### 10.2 Equity-oriented funds: the annual exemption and grandfathering

| Financial year | Annual exemption | Source |
|---|---|---|
| FY 2004-05 | Sales 2004-10-01 to 2005-03-31: long-term gain fully exempt u/s 10(38), no threshold | https://www.incometaxindia.gov.in/w/section-10-11 ; https://www.incometaxindia.gov.in/w/247-notification-247-date-of-issue-28/9/2004 |
| FY 2005-06 | Fully exempt u/s 10(38); no threshold | https://www.incometaxindia.gov.in/w/section-10-15 |
| FY 2006-07 | Fully exempt u/s 10(38); no threshold | https://www.incometaxindia.gov.in/w/section-10-17 |
| FY 2007-08 | Fully exempt u/s 10(38); no threshold | https://www.incometaxindia.gov.in/w/section-10-19 |
| FY 2008-09 | Fully exempt u/s 10(38); no threshold | https://www.incometaxindia.gov.in/w/section-10-22 |
| FY 2009-10 to FY 2016-17 | Fully exempt u/s 10(38); no threshold | https://www.incometaxindia.gov.in/w/section-10-62 |
| FY 2017-18 | Fully exempt u/s 10(38), including sales 2018-02-01 to 2018-03-31; no threshold | https://www.incometaxindia.gov.in/w/section-10-62 ; https://itatonline.org/info/cbdt-issues-faqs-on-taxation-of-ltcg-as-per-finance-bill-2018/ (Q9, Q11) |
| FY 2018-19 | s.112A: Rs 1,00,000 per person exempt; excess at 10% | https://www.incometaxindia.gov.in/w/section-112a-61 |
| FY 2019-20 | s.112A: Rs 1,00,000 per person; excess at 10% | https://www.incometaxindia.gov.in/w/section-112a-62 |
| FY 2020-21 | s.112A: Rs 1,00,000 per person; excess at 10% | https://www.incometaxindia.gov.in/w/section-112a-55 |
| FY 2021-22 | s.112A: Rs 1,00,000 per person; excess at 10% | https://www.incometaxindia.gov.in/w/section-112a-56 |
| FY 2022-23 | s.112A: Rs 1,00,000 per person; excess at 10% | https://www.incometaxindia.gov.in/w/section-112a-57 |
| FY 2023-24 | s.112A: Rs 1,00,000 per person; excess at 10% | https://www.incometaxindia.gov.in/w/section-112a-58 |
| FY 2024-25 | s.112A: Rs 1,25,000 per person once on the aggregate of gains from sales before 2024-07-23 (10%) and on or after 2024-07-23 (12.5%); allocation order not stated in the Act (TR-2) | https://www.incometaxindia.gov.in/w/section-112a-59 ; https://pib.gov.in/PressReleasePage.aspx?PRID=2036604 |
| FY 2025-26 | s.112A: Rs 1,25,000 per person; excess at 12.5% | https://www.incometaxindia.gov.in/w/section-112a-60 ; Reckoner FY2025-26, Mutual Funds!I8 (supporting) |
| FY 2026-27 (tax year, Income-tax Act 2025) | s.198: Rs 1,25,000 per person per tax year, one limit shared across listed shares, equity-oriented fund units and business trust units, applied to s.198 gains left after set-off; excess at 12.5% | Reckoner TY2026-27, Exemptions & Set-off!D10, F10; Master Summary!A3, J10 ; https://www.incometaxindia.gov.in/w/section-198-78 |
| FY 2027-28 onward | - | to be confirmed (no Finance Act for tax year 2027-28 yet; outside the dataset) |

- **TR-9. How is the annual equity exemption shown when tax is computed per lot?** Apply the Rs 1,00,000 or Rs 1,25,000 once per person per FY (tax year from 2026-27) to that person's aggregate s.112A or s.198 gains left after set-off, as a separate year line; never allocate it to lots and never pool it across family members (TR-15). Label the line: the limit is shared with listed shares, other equity-oriented units and business trust units outside this statement, so part of it may already be used. Per-lot figures are gain x rate before the exemption, surcharge and cess, labelled indicative. For sales 2018-04-01 to 2025-03-31 the same after-set-off order is applied as an indicative policy.
- **TR-2. FY 2024-25: in what order is the single Rs 1,25,000 equity exemption applied to gains taxed at 10% (sales 2024-04-01 to 2024-07-22) and at 12.5% (sales 2024-07-23 to 2025-03-31)?** The law sets no order. Default (labelled 'indicative, order not set by the Act'): the taxpayer-favourable order, consistent with set-off (TR-10): apply the exemption first to the 12.5% gains (EQ-LT-6, EQ-LT-7) and only the remainder to the 10% gains (EQ-LT-4, EQ-LT-5). Also show the figure under the other order (10% gains first) in a note of the FY 2024-25 summary. The two differ by at most Rs 3,125 (Rs 1,25,000 x 2.5 points) before surcharge and cess. Applied per person (TR-15). Known answer KA-9 (§13.4). (Revised 27 Oct 2026, LD-10; for the owner to confirm, §15 item 6.)
- **TR-11. What input does grandfathering need and what if it is missing?** For EQ-LT-2, EQ-LT-4, EQ-LT-6 and EQ-LT-8 (units bought on or before 2018-01-31; the live-page tax review, register TX-18) the FMV is the scheme's NAV on 2018-01-31 (listed units: highest quoted price that day or the last earlier traded day), per scheme, plan and option, from a dated source. Taxable cost = higher of actual cost and the lower of FMV and sale value. When the statement supplies the 31 Jan 2018 value (the `grandfathered` lot class, §5), it is used. When it does not, the lot is computed on the actual cost and labelled '31 Jan 2018 value not supplied; actual cost used; gain may be overstated', with an Information count (`grandfathering-value-not-supplied`): the grandfathered cost is never below the actual cost, so the gain can only be too high. Lots first held before 2001-04-01, or received by gift or inheritance, need the s.55(2)(b) or s.90(9) input for the actual-cost leg: only for these is the tax a dash (Warning `cost-input-missing`). The value is used only under EQ-LT-2, EQ-LT-4, EQ-LT-6 and EQ-LT-8; on any other rule it is ignored (§5). (Revised 27 Oct 2026, LD-5, LD-7.)
- **TR-17. How are ELSS lots treated?** ELSS units are equity-oriented. Each instalment is locked in for three years from its own allotment date, so a realised ELSS lot is taxed under the EQ-LT row for its sale date. The lock-in is the check EQ-ELSS-1 (§10.1, "Checks"), not a rate row: an ELSS sale in the statement on or before the 36-month anniversary is flagged as a data issue or a death case (nominee or heir may withdraw after one year; Warning `elss-early-sale`); it keeps the rate row of its key and is not silently taxed as short term.
- **TR-18. How is a FoF of domestic equity ETFs (90/90) treated in FY 2018-19, when the sections used different definitions?** Take the class per section for sales 2018-04-01 to 2019-03-31: 12-month holding (s.2(42A) Explanation 4 with the s.112A meaning); short-term gains at slab (EQ-FOF-1), because s.111A still used the s.10(38) meaning; long-term gains not computed (EQ-FOF-2, dash) until the STT position of its redemptions is confirmed. Sales before 2018-04-01 use the non-equity rows; sales from 2019-04-01 use the EQ rows. The 90/90 sub-type sets the class by sale date (§9.1), so the key (equity-oriented, 90/90, sale before 2018-04-01) is never produced; an analyst's equity-oriented class on a fund of funds is accepted only for sales from 2018-04-01, gives the 90/90 sub-type to that scheme's sales in that financial year only, without setting the per-scheme 90/90 flag, and is refused for an earlier sale (§9.1 step 1). (Revised 27 Oct 2026, LD-27; the analyst's class, LD-35, LD-41.)

### 10.3 Non-equity funds: the Specified fund tests, indexation and the Cost Inflation Index

| Sale window | Indexation | Source |
|---|---|---|
| Sale 2004-10-01 to 2017-03-31 | CII 1981-82 base series. Indexed cost = cost x CII(FY of sale) / CII(FY first held, or FY 1981-82 if later). Used by NE-LT-1 (20% leg) and NE-LT-2. FY 2016-17 index pending, so FY 2016-17 sales are not indexed until confirmed. | https://www.incometaxindia.gov.in/w/section-48-21 ; https://www.incometaxindia.gov.in/w/section-48-55 |
| Sale 2017-04-01 to 2024-07-22 | CII 2001-02 base series; base year FY 2001-02 when first held earlier (cost may be FMV on 2001-04-01 at the assessee's option; the app uses the statement's cost, labelled, Information `pre-base-year-cost`). Used by NE-LT-3. | https://www.incometaxindia.gov.in/w/section-48-56 (footnote 95: Act 7 of 2017 w.e.f. 2018-04-01) ; https://www.incometaxindia.gov.in/w/section-48-64 ; https://www.incometaxindia.gov.in/w/section-55-64 |
| Sale 2024-07-23 to 2026-03-31 | No indexation for MF units (s.48 second proviso limited to transfers before 2024-07-23). | https://www.incometaxindia.gov.in/w/section-48-64 (footnote 48b) |
| Sale from 2026-04-01 | No indexation for MF units. 2025 Act s.72(2) applies indexed cost only to item B of the s.197(3) formula (land or building acquired before 2024-07-23, resident individual or HUF). | Reckoner TY2026-27, Exemptions & Set-off!A24; Master Summary!K25, K26, K29 ; https://www.incometaxindia.gov.in/w/section-72-127 |
| Equity-oriented funds | Never indexed in any window (exempt to 2018-03-31; s.112A and s.198 deny indexation). | https://www.incometaxindia.gov.in/w/section-112a-59 ; https://www.incometaxindia.gov.in/w/section-198-78 ; Reckoner TY2026-27, Master Summary!K10 |

**Cost Inflation Index, 1981-82 base** (transfers up to 31 Mar 2017):

| Financial year | Index | Source |
|---|---|---|
| FY 1981-82 | 100 | https://www.incometaxindia.gov.in/w/section-48-21 (footnote 50; principal notification S.O. 709(E) dated 1998-08-20) |
| FY 1982-83 | 109 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1983-84 | 116 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1984-85 | 125 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1985-86 | 133 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1986-87 | 140 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1987-88 | 150 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1988-89 | 161 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1989-90 | 172 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1990-91 | 182 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1991-92 | 199 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1992-93 | 223 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1993-94 | 244 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1994-95 | 259 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1995-96 | 281 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1996-97 | 305 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1997-98 | 331 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1998-99 | 351 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 1999-00 | 389 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 2000-01 | 406 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 2001-02 | 426 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 2002-03 | 447 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 2003-04 | 463 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 2004-05 | 480 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 2005-06 | 497 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 2006-07 | 519 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 2007-08 | 551 | https://www.incometaxindia.gov.in/w/section-48-21 footnote 50 |
| FY 2008-09 | 582 | https://www.incometaxindia.gov.in/w/section-48-12 (CII footnote) |
| FY 2009-10 | 632 | https://www.incometaxindia.gov.in/w/section-48-12 CII footnote |
| FY 2010-11 | 711 | https://www.incometaxindia.gov.in/w/section-48-12 CII footnote |
| FY 2011-12 | 785 | https://www.incometaxindia.gov.in/w/section-48-12 CII footnote |
| FY 2012-13 | 852 | https://www.incometaxindia.gov.in/w/section-48-12 CII footnote |
| FY 2013-14 | 939 | https://www.incometaxindia.gov.in/w/section-48-55 (CII footnote) |
| FY 2014-15 | 1024 | https://www.incometaxindia.gov.in/w/section-48-55 CII footnote; Notification 31/2014 [F. No. 142/3/2014-TPL], S.O. 1498(E) dated 2014-06-11, serial 34: https://www.incometaxindia.gov.in/w/notification-no.-31/2014-f.-no.-142/3/2014-tpl-/so-1498-e-section-48-explanation-v-of-the-income-tax-act-1961-capital-gains-computation-of-notified-cost-inflation-index-for-financial-year-2014-15 |
| FY 2015-16 | 1081 | https://www.incometaxindia.gov.in/w/section-48-55 CII footnote |
| FY 2016-17 | - | to be confirmed (Notification 42/2016, S.O. 1948(E), 2016-06-02: gazette and department copies not found; only secondary reproductions seen) |

**Cost Inflation Index, 2001-02 base** (transfers from 1 Apr 2017; for mutual fund units only until 22 Jul 2024):

| Financial year | Index | Source |
|---|---|---|
| FY 2001-02 | 100 | https://www.incometaxindia.gov.in/w/cost-inflation-index ; https://www.incometaxindia.gov.in/w/cost-inflation-index-3 ; principal notification S.O. 1790(E) dated 2017-06-05 per the gazette text of Notification 70/2025 (https://www.incometaxindia.gov.in/documents/d/guest/notification-70-2025-pdf); the number 44/2017 seen only in secondary sources |
| FY 2002-03 | 105 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2003-04 | 109 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2004-05 | 113 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2005-06 | 117 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2006-07 | 122 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2007-08 | 129 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2008-09 | 137 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2009-10 | 148 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2010-11 | 167 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2011-12 | 184 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2012-13 | 200 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2013-14 | 220 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2014-15 | 240 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2015-16 | 254 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2016-17 | 264 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2017-18 | 272 | https://www.incometaxindia.gov.in/w/cost-inflation-index |
| FY 2018-19 | 280 | https://www.incometaxindia.gov.in/w/cost-inflation-index ; https://www.incometaxindia.gov.in/w/section-48-59 footnote 31 (notification number not verified) |
| FY 2019-20 | 289 | https://www.incometaxindia.gov.in/w/cost-inflation-index ; https://www.incometaxindia.gov.in/w/section-48-59 footnote 31 (notification number not verified) |
| FY 2020-21 | 301 | https://www.incometaxindia.gov.in/w/cost-inflation-index ; https://www.incometaxindia.gov.in/w/section-48-59 footnote 31 (notification number not verified) |
| FY 2021-22 | 317 | https://www.incometaxindia.gov.in/w/cost-inflation-index ; https://www.incometaxindia.gov.in/w/section-48-60 footnote 41 (notification number not verified) |
| FY 2022-23 | 331 | https://www.incometaxindia.gov.in/w/cost-inflation-index ; https://www.incometaxindia.gov.in/w/section-48-61 footnote 96 (notification number not verified) |
| FY 2023-24 | 348 | https://www.incometaxindia.gov.in/w/cost-inflation-index ; https://www.incometaxindia.gov.in/w/section-48-63 footnote 55a (notification metadata not verified) |
| FY 2024-25 | 363 | https://www.incometaxindia.gov.in/w/cost-inflation-index ; S.O. 2103(E) dated 2024-05-24 per the gazette note in https://www.incometaxindia.gov.in/documents/d/guest/notification-70-2025-pdf |
| FY 2025-26 | 376 | Notification 70/2025, S.O. 2954(E) dated 2025-07-01 (s.48 Explanation (v)): https://www.incometaxindia.gov.in/w/cost-inflation-index-3 ; Reckoner TY2026-27, Exemptions & Set-off!A33, Master Summary!P60 ; Reckoner FY2025-26, Exemptions & Set-off!A31 (supporting) |
| FY 2026-27 (tax year) | 384 | Reckoner TY2026-27, Exemptions & Set-off!A33; Master Summary!K60; Change Log & Sources!E30 ; Notification 85/2026, S.O. 3889(E) dated 2026-07-15 under 2025 Act s.72(8)(a): https://www.incometaxindia.gov.in/documents/d/guest/notification-no-85-2026-pdf ; https://www.incometaxindia.gov.in/w/cost-inflation-index (not used for MF units: no indexation after 2024-07-22) |

| Window | Holding period | Source |
|---|---|---|
| Equity-oriented fund, all sales from 2004-10-01 | 12 months; long term only strictly after the 12-month anniversary (OD-2) | https://www.incometaxindia.gov.in/w/section-2-12 ; https://www.incometaxindia.gov.in/w/section-2-66 ; https://www.incometaxindia.gov.in/w/section-2-1 ; Reckoner TY2026-27, Master Summary!F10, G10 |
| FoF of domestic equity ETFs (90/90) | Sales to 2014-07-10: 12 months (any MF unit); 2014-07-11 to 2018-03-31: 36 months (fails the s.10(38) meaning); from 2018-04-01: 12 months (s.2(42A) Explanation 4 takes the s.112A meaning) | https://www.incometaxindia.gov.in/w/section-2-60 (footnote 5) ; https://www.incometaxindia.gov.in/w/section-2-56 |
| Non-equity units, sales 2004-10-01 to 2014-07-10 | 12 months (unit of a s.10(23D) mutual fund, listed or not) | https://www.incometaxindia.gov.in/w/section-2-12 ; https://www.incometaxindia.gov.in/w/section-2-2 ; https://www.incometaxindia.gov.in/w/section-2-50 |
| Non-equity units, sales 2014-07-11 to 2024-07-22 | 36 months, listed or unlisted | https://www.incometaxindia.gov.in/w/section-2-56 (footnotes 21 to 23) ; https://www.incometaxindia.gov.in/w/section-2-66 (footnote 10) |
| Non-equity units, sales 2024-07-23 to 2026-03-31 | 24 months unlisted; 12 months for a unit itself listed on a recognised stock exchange in India (ETFs; any other listed scheme per TR-16) | https://www.incometaxindia.gov.in/w/section-2-66 ; Reckoner FY2025-26, Mutual Funds!E29, E30 (supporting) |
| Non-equity units, sales from 2026-04-01 | 24 months unlisted; 12 months listed (2025 Act s.2(101)(a), (b)(i)); MF units unlisted unless an ETF by default | Reckoner TY2026-27, Master Summary!A3, F26, F29; Mutual Funds!F26; Hybrid Funds & FoFs!A64 ; https://www.incometaxindia.gov.in/w/section-2-1 |
| Specified (debt) units acquired from 2023-04-01 | Deemed short term whatever the holding (s.50AA; 2025 Act s.76) | https://www.incometaxindia.gov.in/w/section-50aa-2 ; https://www.incometaxindia.gov.in/w/section-76-106 ; Reckoner TY2026-27, Master Summary!F25 |
| ELSS units (ELSS 2005) | Locked in for three years from the allotment of each instalment; on the holder's death the nominee or heir may withdraw after one year | https://www.incometaxindia.gov.in/w/226-notification-226-date-of-issue-3/11/2005 (para 3(d), 3(e)) ; Reckoner TY2026-27, Master Summary!C11 |
| Counting rule (OD-2, TR-1) | Anniversary = the date N calendar months after the purchase date with the same day number, or the last day of that month if it has no such day. Long term only when the sale date is strictly after the anniversary; a sale on or before it is short term. Compare calendar dates, never whole-month counts or raw timestamps | OD-2 ; Reckoner TY2026-27, Change Log & Sources!E7, Master Summary!A3 ; the live-page tax review (register TX-01, its corrected fix) |

- **TR-3. Which CII series applies to sales before FY 2017-18?** Use the 1981-82 base series for transfers up to 2017-03-31 and the 2001-02 base series for transfers 2017-04-01 to 2024-07-22 (base year 2001-02 when first held earlier, with the 2001-04-01 FMV option); no indexation for MF units from 2024-07-23 or under the 2025 Act. Indexed cost = cost x CII of the sale year / CII of the later of the year first held and the series' base year (FY 1981-82 or FY 2001-02). For units first held before the base year the cost may be the FMV on the base date at the assessee's option; the statement does not supply it, so the statement's cost is used and the lot is labelled (Information `pre-base-year-cost`). The FY 2016-17 index in the 1981 series is not yet confirmed from a primary source, so NE-LT-2 lots sold in FY 2016-17 show a dash (Warning `rule-to-be-confirmed`; the gazette copy is an owner item, §15, item 4). Where the statement shows an indexed figure built on the 2001 series for a pre-2017 sale, show the app's figure and flag the difference (Warning `gain-differs`; the two series differ, for example, by about 0.29% for a lot bought in FY 2005-06 and sold in FY 2012-13, and by about 0.05% for KA-3b's lot, known answer KA-16, §13.4). (Revised 27 Oct 2026, LD-16.)
- **TR-4. Specified mutual fund definition switch in 2025: which definition applies to a unit bought from 2023-04-01?** Apply the definition in force for the financial year of the sale: the 35% domestic-equity test for sales 2023-04-01 to 2025-03-31 (NE-50AA-1) and the 65% debt test for sales from 2025-04-01 (NE-50AA-2, then Sec 76 (old 50AA) in NE-50AA-3). The acquisition condition (on or after 2023-04-01) does not change, and older units always follow the general rule (the live-page tax review, register TX-02). Take the fund's percentages (annual average of daily closing figures) for the FY of sale from the AMC's year-end classification; if missing and no default of §10.5 applies, show a dash and flag (Warning `specified-test-missing`, §9.1 step 4).
- **TR-16. When is a non-equity unit 'listed' for the 12-month rule from 2024-07-23?** Use a per-scheme flag 'units listed on a recognised stock exchange in India', part of the rule key (§9.1). The flag is the analyst's (an audit entry); otherwise listed when the scheme is an ETF by its name and not a fund of funds; otherwise unlisted (other MF units are unlisted by default, Reckoner TY2026-27 Hybrid Funds & FoFs!A64; FoFs are never listed). A close-ended scheme whose units are listed (for example an FMP) is listed only when the scheme data or the analyst says so; if the flag is missing for a close-ended non-equity scheme sold from 2024-07-23 with a holding of more than 12 and at most 24 months, show a dash and flag (Warning `listed-flag-missing`) only when the lot's rule depends on the listed flag (the general-rule non-equity rows from 2024-07-23); a close-ended Specified lot bought from 2023-04-01 (NE-50AA-1 to NE-50AA-3) is computed. ETF versus FoF is decided on the scheme name, not on a mixed category label (the live-page tax review, register TX-04, TX-05). (Revised 27 Oct 2026, LD-2; the dash narrowed by LD-29.)

### 10.4 Special events: mergers, switches and others

| Event | Treatment | Source |
|---|---|---|
| Scheme consolidation on or before 2015-03-31 | Taxable transfer on the consolidation date at the rule for the class and holding on that date; flag rows shown with zero taxable gain | https://www.indiabudget.gov.in/budget2015-2016/ub2015-16/memo/mem1.pdf ; https://www.incometaxindia.gov.in/w/section-47-55 |
| Scheme consolidation from 2015-04-01, both schemes the same class | Not a transfer (s.47(xviii); 2025 Act s.70(1)(zj)); cost carried over (s.49(2AD); s.73(1) Table Sl. 8); holding includes the old units (s.2(42A) Expl 1(i)(hd); s.2(101)(c)(B)(VII)); only under the SEBI consolidation process. 'Same class' uses the consolidation test: more than 65% in equity shares of domestic companies, listing not required (s.47(xviii) Explanation (c); 2025 s.70(2) Table Sl. 10(c)), not the rate-table test | https://www.incometaxindia.gov.in/w/section-47-64 ; https://www.incometaxindia.gov.in/w/section-49-64 ; https://www.incometaxindia.gov.in/w/section-70-123 ; https://www.incometaxindia.gov.in/w/section-73-122 ; Reckoner TY2026-27, Mutual Funds!A43 |
| Scheme consolidation from 2015-04-01, cross class | Taxable transfer on the consolidation date; flag zero-gain rows; needs the class of both schemes on that date | https://www.incometaxindia.gov.in/w/section-47-64 ; https://www.incometaxindia.gov.in/w/section-70-123 |
| Plan consolidation on or before 2016-03-31 | Taxable transfer on the consolidation date | https://www.indiabudget.gov.in/budget2016-2017/ub2016-17/memo/mem1.pdf ; https://www.incometaxindia.gov.in/w/section-47-56 |
| Plan consolidation within one scheme from 2016-04-01 | Not a transfer (s.47(xix); 2025 Act s.70(1)(zk)); cost carried over (s.49(2AF); s.73(1) Table Sl. 10); holding includes old units (s.2(42A) Expl 1(i)(hg); s.2(101)(c)(B)(IX)) | https://www.incometaxindia.gov.in/w/section-47-56 ; https://www.incometaxindia.gov.in/w/section-49-56 ; https://www.incometaxindia.gov.in/w/section-70-123 ; https://www.incometaxindia.gov.in/w/section-73-122 |
| Investor-initiated switch (any date): scheme to scheme, regular to direct, growth to IDCW | A sale: taxed as a redemption of the switched-out lot; switched-in units are a new acquisition on the switch date at the switched amount | Reckoner TY2026-27, Mutual Funds!A43; Hybrid Funds & FoFs!A66 ; https://www.mutualfundssahihai.com/en/can-i-switch-investments-from-one-scheme-to-another-of-a-mutual-fund |
| FIFO matching | Each SIP instalment has its own purchase date; redemptions matched first in, first out (the statement already does this) | Reckoner TY2026-27, Mutual Funds!A44 |
| New units received in a taxable consolidation | - | to be confirmed; meanwhile the analyst's re-base of a `successor-not-reset` lot (§5, TR-5) applies the general principle, cost = merger value |
| Segregated portfolio units (sales from 2019-04-01) | Cost = original cost x NAV of assets moved to the segregated portfolio / NAV of the whole portfolio just before segregation; main portfolio cost reduced by the same amount; holding includes the original units (s.49(2AG), (2AH), s.2(42A) Expl 1(i)(hh); 2025 Act s.73(1) Sl. 11, 12, s.2(101)(c)(B)(X)). Segregated units sold in FY 2018-19: flag | https://www.incometaxindia.gov.in/w/section-49-57 ; https://www.incometaxindia.gov.in/w/section-73-122 ; https://www.indiabudget.gov.in/budget2020-21/doc/memo.pdf |
| Bonus units | Cost nil; holding from allotment (s.55(2)(aa)(iiia), s.2(42A) Expl 1(i)(f); 2025 Act s.90(5)(b), s.90(6)(d), s.2(101)(c)(C)(IV)) | https://www.incometaxindia.gov.in/w/section-55-64 ; https://www.incometaxindia.gov.in/w/section-90-114 |
| Bonus stripping (1961 s.94(8); 2025 s.175(9), (10)) | Units bought within 3 months before the record date and sold within 9 months after it, with bonus units still held: the whole loss is ignored and becomes the cost of the bonus units still held | https://www.incometaxindia.gov.in/w/section-175-80 (read in this review) ; https://www.incometaxindia.gov.in/w/section-94-64 |
| Dividend stripping (1961 s.94(7); 2025 s.175(8)) | Units bought within 3 months before the record date and sold within 9 months after it: loss ignored up to the dividend or income, only where that income is exempt. Bites on IDCW exempt up to 2020-03-31 (s.10(35)); not on taxable IDCW from 2020-04-01. Reckoner TY2026-27 Mutual Funds!A47 states the rule without the exempt-income condition of s.175(8)(c); this design follows the Act | https://www.incometaxindia.gov.in/w/section-175-80 (s.175(8)(c), read in this review) ; https://www.incometaxindia.gov.in/w/section-94-64 ; https://www.indiabudget.gov.in/budget2020-21/doc/memo.pdf |
| IDCW payout rows | Not capital gains; exclude. Received up to 2020-03-31 exempt (s.10(35), fund paid s.115R tax); from 2020-04-01 taxable as ordinary income at slab (Reckoner TY2026-27 Mutual Funds!B39 to I39) | https://www.indiabudget.gov.in/budget2020-21/doc/memo.pdf ; Reckoner TY2026-27, Mutual Funds!B39, H39 |
| IDCW reinvestment units | - | to be confirmed (the app uses the statement's lot date and cost meanwhile) |
| ELSS sale on or before the 36-month anniversary | Flag (check EQ-ELSS-1, §10.1); normal ELSS units cannot be sold in the lock-in (death of the holder excepted) | https://www.incometaxindia.gov.in/w/226-notification-226-date-of-issue-3/11/2005 ; Reckoner TY2026-27, Master Summary!F11 |
| STT condition (equity-oriented) | Redemption to the fund is STT-chargeable (Finance (No. 2) Act 2004 s.98 Table Sl. 5; 0.001% per Reckoner TY2026-27 Mutual Funds!A48); units need STT only on transfer (s.112A(1)(b); 2025 s.198(1)(c)(ii)); assume met for redemptions, flag off-market transfers | https://www.incometaxindia.gov.in/w/section-98-55 ; https://www.incometaxindia.gov.in/w/section-198-78 ; Reckoner TY2026-27, Mutual Funds!A48; Equity F&O Buyback!C12 |

- **TR-5. Scheme mergers versus investor switches: which rows are taxable?** A merger row is non-taxable only if it is (a) a scheme consolidation under the SEBI (Mutual Funds) Regulations process on or after 2015-04-01 with both schemes in the same class under the consolidation test (more than 65% in domestic equity shares, listing not required; s.47(xviii) Explanation (c), 2025 s.70(2) Table Sl. 10(c)), or (b) a plan consolidation within one scheme on or after 2016-04-01. For those, exclude the merger-out row from tax and carry the original purchase dates and costs into the new units. Every other merger row and every investor-initiated switch (scheme to scheme, regular to direct, growth to IDCW) is a transfer taxed as a redemption on that date, the units received starting a new holding at the switched amount. Flag zero-gain merger rows that fail (a) or (b) (Warning `merger-taxable`), and flag cross-fund-house mergers for review (Warning `cross-house-merger`). The app recognises a merger row by the pattern of §5 (Acquisition Date equals Sale Date and differs from Purchase Date; Acquisition Price equals Sale Price; LTCG and STCG 0), applies the date gates of (a) and (b) by default, and asks the analyst for one of three answers per event: non-taxable consolidation (s.47(xviii) or (xix); 2025 s.70(1)(zj) or (zk)), taxable consolidation, or investor switch. A successor lot whose cost and date were reset to the merger is flagged only after a non-taxable event (`successor-reset`): its gain is understated when the merger value is above the original cost (overstated when below) and its term may be wrongly short. After a taxable event (by default, or answer 2 or 3), a lot of the same account in a scheme label other than the event's, whose Purchase Date is before the event date and equals a Purchase Date of the event's merger rows, and whose Sale Date is after the event date, is reported (Warning `successor-not-reset`): its holding should restart on the event date at the merger value. An SIP instalment of another scheme bought on the same day also matches; the Warning lists the candidate lots by scheme, and the analyst re-bases only the successor's lots. The analyst re-bases a successor lot (an audit entry: purchase date = event date, cost = S x V / W, where S and W are the Sell Amount and the Invested Value of the event's merger rows with that Purchase Date and V is the lot's Invested Value; the amount counted twice is (S - W) x V / W), or it is computed as stated and flagged, with the double-counted amount named (known answer KA-17, §5). The re-base uses the general principle (cost = merger value), still to be confirmed (§10.4, §10.9). (Revised 27 Oct 2026, LD-8; successor lots after a taxable event, LD-25; the re-base formula, LD-37.)
- **TR-21. Dividend and bonus stripping.** Apply bonus stripping (1961 s.94(8); 2025 s.175(9), (10)) when record-date data is available: ignore the loss on units bought within 3 months before the record date and sold within 9 months after it while bonus units are held, and add it to the bonus units' cost. Apply dividend stripping (s.94(7); s.175(8)) only where the IDCW was exempt, i.e. record dates up to 2020-03-31. Without record-date data, flag candidate lots and compute normally (Warning `stripping-candidate`): a loss on a lot held 12 months or less, either of an IDCW or dividend option sold by 2020-12-31 (dividend stripping) or of a scheme for which the statement shows bonus units, lots at a cost of 0 (bonus stripping).

### 10.5 Tax class by fund type

The class is a fact about the scheme for the financial year of the sale (the fund house's year-end tax classification),
never read from the category name alone. The "Step-2 default" column says whether a fund type gives the default class
of §9.1 step 2: yes only where the law leaves no choice, and, from tax year 2026-27, for the three usual buckets of
LD-11; and for Sectoral and Thematic Funds, with the Warning `category-default-to-confirm` (LD-26); where it says "no
default", the class comes from the analyst or the statement (§9.1 steps 1 and 3). The
Category Name text of the statement reaches a fund type only through the category map of §10.5a.

| Fund type | Tax class | Step-2 default (§9.1) | Source |
|---|---|---|---|
| Three buckets, sales from 2025-04-01 (the live-page tax review, register TX-11) | Equity-oriented: 65% or more listed Indian equity (FoF only by the 90/90 ETF route). Specified: more than 65% debt and money market, or a FoF with 65% or more in such funds; applies only to units bought from 2023-04-01, older units follow the general rule. General rule: everything else, 24 months (12 if listed), STCG at slab, LTCG 12.5%, no exemption | n/a (the test itself) | Reckoner TY2026-27, Hybrid Funds & FoFs!A5 to J8, A11 to A15; Master Summary!A4; Mutual Funds!A3, A42 |
| Specified test, sales 2023-04-01 to 2025-03-31 | 35% or less of total proceeds in equity shares of domestic companies, units bought from 2023-04-01 (NE-50AA-1) | n/a (the test itself) | https://www.incometaxindia.gov.in/w/section-50aa-2 ; Reckoner TY2026-27, Hybrid Funds & FoFs!A62, J25; Master Summary!P22 |
| Debt funds (overnight, liquid, money market, ultra short, low duration, duration, gilt, corporate bond, banking and PSU, credit risk, floater, sectoral debt) | Specified under both tests: units bought from 2023-04-01 use NE-50AA rules; units bought before 2023-04-01 use the NE rules for the sale date (24 months unlisted from 2024-07-23) (the live-page tax review, register TX-02) | yes: Specified | Reckoner TY2026-27, Master Summary!A25 to I26; Mutual Funds!A17, B19 to I26 ; https://www.incometaxindia.gov.in/w/section-50aa-2 ; https://www.incometaxindia.gov.in/w/section-76-106 |
| Debt ETFs, target maturity index funds, Bharat Bond ETF, debt FoFs (65% or more in debt funds) | Specified for units bought from 2023-04-01. Units bought before 2023-04-01: from 2024-07-23 long term strictly after 12 months for a listed ETF, 24 months for an index fund or FoF, at 12.5% | yes: Specified, where the category map gives this type | Reckoner TY2026-27, Master Summary!A27, P27; Mutual Funds!B23, B24, F26; Hybrid Funds & FoFs!J34 |
| Conservative hybrid | Specified (debt above 65%; SEBI 75 to 90% debt) for units bought from 2023-04-01, under both tests; units bought before 2023-04-01: general rule | yes: Specified | Reckoner TY2026-27, Master Summary!A21, P21; Hybrid Funds & FoFs!D24, J24 ; https://www.incometaxindia.gov.in/w/section-50aa-2 |
| Balanced hybrid (SEBI 2026 category, 40 to 60% equity, no arbitrage) | General rule always (can be neither equity-oriented nor Specified) | yes: other non-equity | Reckoner TY2026-27, Master Summary!A20, P20; Hybrid Funds & FoFs!D23, J23 |
| Aggressive hybrid, sales from 2026-04-01 | Equity-oriented (65% equity floor); confirm with the AMC's year-end classification | yes: equity-oriented, the usual bucket per the owner's reckoner, with the Warning `usual-bucket-default` (LD-11) | Reckoner TY2026-27, Master Summary!A18, P18; Hybrid Funds & FoFs!D21 |
| Arbitrage, sales from 2026-04-01 | Equity-oriented: hedged equity counts toward the 65% test (reckoner position) | yes: equity-oriented, the usual bucket per the owner's reckoner, with the Warning `usual-bucket-default` (LD-11) | Reckoner TY2026-27, Master Summary!A16, P16; Hybrid Funds & FoFs!C6, D19 |
| Equity savings, sales from 2026-04-01 | Equity-oriented while the annual average stays at 65% or more; a year below 65% moves that year's sales to the general rule | yes: equity-oriented, the usual bucket per the owner's reckoner, with the Warning `usual-bucket-default` (LD-11) | Reckoner TY2026-27, Master Summary!A17, P17; Hybrid Funds & FoFs!D20, J20 |
| Balanced advantage or dynamic asset allocation | Fund-specific: most are equity-oriented by topping up with arbitrage; others general rule. No default | no default | Reckoner TY2026-27, Master Summary!A19, P19; Hybrid Funds & FoFs!D22, J22 |
| Multi-asset allocation | Any of the three buckets by the year's holdings. A fund with 35% or less domestic equity was Specified under the 35% test for FY 2023-24 and 2024-25 sales (units bought from 2023-04-01); from 2025-04-01 Specified only if debt exceeds 65% | no default | Reckoner TY2026-27, Master Summary!A22, P22; Hybrid Funds & FoFs!D25, J25 ; https://www.incometaxindia.gov.in/w/section-50aa-2 |
| Aggressive hybrid, arbitrage, equity savings, sales before 2026-04-01 | No default; take the AMC's classification for the FY of sale (TR-7) | no default | https://www.incometaxindia.gov.in/w/section-112a-59 ; https://www.incometaxindia.gov.in/w/section-10-17 (statutory tests); TR-7 |
| Gold or silver ETF (listed) | Never equity-oriented. Units bought from 2023-04-01 and sold by 2025-03-31: NE-50AA-1. Other lots: NE rows by sale date; listed, so 12 months from 2024-07-23 (NE-ST-3L, NE-LT-4L, NE-ST-4L, NE-LT-5L), 36 months 2014-07-11 to 2024-07-22, 12 months before (the live-page tax review, register TX-04) | yes: other non-equity; Specified for units bought from 2023-04-01 and sold 2023-04-01 to 2025-03-31 | Reckoner TY2026-27, Master Summary!A29 to I29, P29; Mutual Funds!B30 to I30 ; https://www.incometaxindia.gov.in/w/section-50aa-2 ; https://www.incometaxindia.gov.in/w/section-2-66 |
| Gold or silver fund of funds (unlisted) | As gold ETF, but unlisted: 24 months from 2024-07-23 (NE-ST-3, NE-LT-4, NE-ST-4, NE-LT-5) (the live-page tax review, register TX-04) | yes: other non-equity; Specified for units bought from 2023-04-01 and sold 2023-04-01 to 2025-03-31 | Reckoner TY2026-27, Master Summary!A30 to I30; Mutual Funds!B31 to I31; Hybrid Funds & FoFs!D35 |
| International or global fund of funds (unlisted) | Never equity-oriented (foreign shares do not count). Specified under the 35% test for FY 2023-24 and 2024-25 sales of units bought from 2023-04-01; otherwise NE rows; 24 months and STCG at slab from 2024-07-23 (the live-page tax review, register TX-05) | yes: other non-equity; Specified for units bought from 2023-04-01 and sold 2023-04-01 to 2025-03-31 | Reckoner TY2026-27, Master Summary!A31 to I31, P31; Hybrid Funds & FoFs!D36 ; https://www.incometaxindia.gov.in/w/section-112a-59 ; https://www.incometaxindia.gov.in/w/section-50aa-2 |
| International ETF listed in India | As international FoF but listed: 12 months from 2024-07-23, STCG at slab, LTCG 12.5%, no exemption (the live-page tax review, register TX-05) | yes: other non-equity; Specified for units bought from 2023-04-01 and sold 2023-04-01 to 2025-03-31 | Reckoner TY2026-27, Master Summary!A32 to I32, P32; Mutual Funds!B33 to I33 ; https://www.incometaxindia.gov.in/w/section-2-66 |
| FoF of domestic equity ETFs meeting the 90/90 test | Equity-oriented for s.112A from 2018-04-01, for the 12-month rule from 2018-04-01, for s.111A from 2019-04-01 (FY 2018-19 short term: EQ-FOF-1, long term: EQ-FOF-2); other non-equity fund for sales before 2018-04-01. Only route by which a FoF is equity-oriented (the live-page tax review, register TX-06) | no default: the 90/90 sub-type is an analyst flag (§9.1) | Reckoner TY2026-27, Master Summary!A13, P13; Hybrid Funds & FoFs!D31, J31 ; https://www.incometaxindia.gov.in/w/section-112a-61 ; https://www.incometaxindia.gov.in/w/section-2-60 ; https://www.incometaxindia.gov.in/w/section-111a-15 |
| FoF of active equity funds (not ETFs), class | Never equity-oriented (s.112A Explanation (a) requires an exchange-traded underlying fund). Sales from 2025-04-01: general rule, 24 months, slab, 12.5% (not Specified unless 65% or more in debt funds) | no default (depends on the year's holdings) | Reckoner TY2026-27, Master Summary!A14 to I14, P14; Hybrid Funds & FoFs!D32 ; https://www.incometaxindia.gov.in/w/section-112a-59 ; https://www.incometaxindia.gov.in/w/section-50aa-2 |
| FoF of active equity funds, units bought from 2023-04-01 and sold 2023-04-01 to 2025-03-31 | - | no default (to be confirmed) | to be confirmed (Specified under the 35% test on a plain reading only) |
| Income plus arbitrage FoF | General rule (less than 65% in debt funds); becomes Specified for a year in which debt funds reach 65% | no default | Reckoner TY2026-27, Master Summary!A23, P23; Hybrid Funds & FoFs!D33, J33 |
| Multi-asset or asset allocator FoF | Usually general rule; Specified if 65% or more sits in debt funds | no default | Reckoner TY2026-27, Hybrid Funds & FoFs!D37, J37 |
| Domestic equity funds, index funds, domestic equity ETFs, ELSS | Equity-oriented (65% or more in listed domestic equity shares); ELSS lock-in per EQ-ELSS-1 | yes: equity-oriented for the equity categories of §10.5a (ELSS also sets the sub-type; Sectoral and Thematic Funds with the Warning `category-default-to-confirm`); index funds and ETFs get no default from the map (the scheme decides, TR-6) | Reckoner TY2026-27, Master Summary!A10, A11, A12; Mutual Funds!B7 to B12 ; https://www.incometaxindia.gov.in/w/section-112a-59 ; https://www.incometaxindia.gov.in/w/section-198-78 |
| Life cycle funds (SEBI 2026) and solution oriented funds (discontinued 2026, merged) | Bucket changes with the year's holdings; merged schemes follow the new scheme's bucket after the merger (merger by the AMC is not a transfer) | no default | Reckoner TY2026-27, Hybrid Funds & FoFs!D26, J26, D27, J27 |

| Window | Equity-oriented fund definition | Source |
|---|---|---|
| s.10(38) Explanation, 2004-10-01 to 2006-05-31 | More than 50% of total proceeds in equity shares of domestic companies (listing not required); scheme u/s 10(23D); annual average of monthly averages of opening and closing figures. Used by s.10(38), s.111A and s.2(42A) | https://www.incometaxindia.gov.in/w/section-10-11 ; https://www.incometaxindia.gov.in/w/section-10-15 |
| s.10(38) Explanation, from 2006-06-01 | More than 65% (Finance Act 2006 w.e.f. 2006-06-01). Governs s.10(38) to 2018-03-31, s.2(42A) Explanation 4 for sales to 2018-03-31, and s.111A for sales to 2019-03-31 | https://www.incometaxindia.gov.in/w/section-10-17 (footnote 44a) ; https://www.incometaxindia.gov.in/w/section-111a-15 (footnote 63) ; https://www.incometaxindia.gov.in/w/section-2-60 (footnote 5) |
| s.112A Explanation (a), s.112A sales from 2018-04-01 | Minimum 65% of total proceeds in equity shares of domestic companies listed on a recognised stock exchange; fund of funds: at least 90% in units of an exchange-traded fund that itself holds at least 90% in such shares; annual average of monthly averages | https://www.incometaxindia.gov.in/w/section-112a-61 ; https://www.thc.nic.in/Central%20Governmental%20Acts/Finance%20Act,%202018.pdf |
| s.2(42A) Explanation 4 switched to the s.112A definition | Act 13 of 2018 w.e.f. 2019-04-01, i.e. FY 2018-19 transfers: the 12-month rule for a 'unit of an equity oriented fund' uses the s.112A meaning from 2018-04-01 | https://www.incometaxindia.gov.in/w/section-2-60 (Year 2019 text, footnote 5, read in this review) |
| s.111A switched to the s.112A definition | Act 23 of 2019 w.e.f. 2020-04-01 (AY 2020-21), i.e. short-term sales from 2019-04-01. FY 2018-19 short-term sales still use the s.10(38) test, so a 90/90 ETF FoF was equity-oriented for s.112A and s.2(42A) but not for s.111A in FY 2018-19 (EQ-FOF-1) | https://www.incometaxindia.gov.in/w/section-111a-15 (footnote 63) ; https://www.indiabudget.gov.in/budget2019-20/doc/memo.pdf |
| 2025 Act s.198(8), from 2026-04-01 | Same 65% listed domestic equity test and 90/90 FoF test; s.196(5) cross-refers. Reckoner position for TY 2026-27: hedged arbitrage positions count; foreign shares, gold, silver, REITs and InvITs do not; measured as the annual average of monthly opening and closing figures | Reckoner TY2026-27, Hybrid Funds & FoFs!C6, D6; Master Summary!A4; Mutual Funds!A3 ; https://www.incometaxindia.gov.in/w/section-198-78 ; https://www.incometaxindia.gov.in/w/section-196-78 |
| s.47(xviii) Explanation (c) (scheme consolidation) | Uses the s.10(38) meaning (more than 65% in equity shares of domestic companies, listing not required); 2025 Act s.70(2) Table Sl. 10(c) repeats more than 65% | https://www.incometaxindia.gov.in/w/section-47-64 ; https://www.incometaxindia.gov.in/w/section-70-123 |
| SEBI categories (circular SEBI/HO/IMD/DF3/CIR/P/2017/114, 2017-10-06) | Aggressive hybrid 65 to 80% equity and equity related; arbitrage minimum 65% equity and equity related; equity savings minimum 65% equity and equity related plus minimum 10% debt; balanced advantage or dynamic asset allocation: no floor; conservative hybrid 10 to 25% equity; FoF minimum 95% in underlying fund. SEBI 'equity related instruments' is wider than the tax test. 2026 framework changes per Reckoner TY2026-27 Hybrid Funds & FoFs!C19 to C27 | https://www.sebi.gov.in/sebi_data/attachdocs/oct-2017/1509103633344.pdf ; Reckoner TY2026-27, Hybrid Funds & FoFs!C19 to C27 |

- **TR-6. Tax class of global or international FoFs and ETFs, gold and silver FoFs and ETFs, and other FoFs.** Never equity-oriented, except a FoF of domestic equity ETFs meeting the 90/90 test (the live-page tax review, register TX-06). Sales before 2023-04-01: ordinary non-equity rules. Sales 2023-04-01 to 2025-03-31: specified under the 35% test, so units bought from 2023-04-01 use NE-50AA-1 and older units use NE-ST-2, NE-LT-3, NE-ST-3 or NE-LT-4. Sales from 2025-04-01: other non-equity. Unlisted FoFs (gold, silver, international, active equity, income plus arbitrage) are long term only strictly after the 24-month anniversary; listed ETFs (gold, silver, international) strictly after the 12-month anniversary; LTCG 12.5%, STCG at slab (the live-page tax review, register TX-04, TX-05). A FoF with 65% or more in debt funds stays specified. Whether a scheme is a FoF or an ETF is decided on the scheme, never on a category label that mixes the two. A FoF is never equity-oriented on the statement's Equity label (§9.1 step 3); only the 90/90 sub-type or the analyst's class for a sale from 2018-04-01, which gives the 90/90 sub-type to that scheme's sales in that financial year only, without setting the per-scheme 90/90 flag, makes it so (§9.1 step 1). (Revised 27 Oct 2026, LD-27; the analyst's class, LD-35, LD-41.)
- **TR-7. Tax class of hybrid funds (aggressive, balanced, conservative, balanced advantage, multi-asset), arbitrage and equity savings funds.** The class is a scheme-level fact for each FY of sale, taken from the AMC's year-end tax classification or the statement's own tax tag, never inferred from the SEBI category name. Three buckets (the live-page tax review, register TX-11): equity-oriented at 65% or more listed Indian equity; specified at more than 65% debt (units bought from 2023-04-01; older units the general rule); the general rule for the rest. For sales from 2026-04-01 the reckoner's usual buckets are: arbitrage, equity savings and aggressive hybrid equity-oriented; balanced hybrid general rule; conservative hybrid specified; balanced advantage and multi-asset fund-specific. From tax year 2026-27 the first three default to equity-oriented, labelled 'usual bucket per the owner's reckoner; confirm with the fund house' with a Warning (`usual-bucket-default`), because under s.198(8) the class depends on the fund (the SEBI floor counts equity-related instruments, which is wider than the tax test); balanced advantage and multi-asset keep no default. Before 2026-04-01 none of them has a default. The order of sources is §9.1's: the analyst's class, then the default, then the statement's classification with a Warning; if none gives a class, compute nothing for that lot (dash) and flag it (`tax-class-not-set`). (Revised 27 Oct 2026, LD-11; for the owner to confirm, §15 item 7.)

### 10.5a Category Name to fund type (the category map, `categoryDefaults`)

The statement's Category Name (column 6) reaches a §10.5 fund type only through this map, which covers the whole SEBI
category list (the circular of §10.5 with the Flexi Cap category of 2020 and the 2026 changes noted in §10.5), written
in the platform's form: SEBI's name in the plural with "Funds". **Matching:** both sides are normalised (trim, inner
spaces collapsed, letter case ignored, a trailing "Fund" or "Funds" dropped) and must then be equal; there is no
partial or loose matching. A name the map does not hold maps to nothing (Warning `capital-gains.category-unmapped`) and
the lot goes to §9.1 step 3. Platform variants found later are added as aliases with the owner's approval, as for the
OD-5 aliases. The map becomes `categoryDefaults` in `data/owner/tax-rules.json`; `rules.test.ts` asserts that every key
maps to exactly one fund type or to "no default".

| Category Name (key, platform form) | SEBI group | Fund type (§10.5) | Default class (§9.1 step 2) |
|---|---|---|---|
| Multi Cap Funds; Flexi Cap Funds; Large Cap Funds; Large and Mid Cap Funds; Mid Cap Funds; Small Cap Funds; Dividend Yield Funds; Value Funds; Contra Funds; Focused Funds | equity | domestic equity funds | equity-oriented |
| Sectoral Funds; Thematic Funds | equity | domestic equity funds | equity-oriented, with the Warning `category-default-to-confirm` on every lot so classed, listed by scheme: a sectoral or thematic fund that invests mainly in foreign shares fails the test (TR-6), and the analyst sets its class (step 1) |
| ELSS; ELSS Funds | equity | domestic equity funds, ELSS | equity-oriented, sub-type ELSS (check EQ-ELSS-1) |
| Overnight Funds; Liquid Funds; Ultra Short Term Funds; Ultra Short Duration Funds; Low Duration Funds; Money Market Funds; Short Duration Funds; Medium Duration Funds; Medium to Long Duration Funds; Long Duration Funds; Dynamic Bond Funds; Corporate Bond Funds; Credit Risk Funds; Banking and PSU Funds; Gilt Funds; Gilt Funds with 10 Year Constant Duration; Gilt Fund with 10 Year Constant Duration; Floater Funds; Sectoral Debt Funds | debt | debt funds | Specified (the rows for units bought before 2023-04-01 are the non-equity rows, §10.1) |
| Conservative Hybrid Funds | hybrid | conservative hybrid | Specified |
| Balanced Hybrid Funds | hybrid | balanced hybrid | other non-equity |
| Aggressive Hybrid Funds | hybrid | aggressive hybrid | sales before 2026-04-01: no default; from tax year 2026-27: equity-oriented, "usual bucket per the owner's reckoner; confirm with the fund house" (Warning `usual-bucket-default`) |
| Arbitrage Funds | hybrid | arbitrage | as aggressive hybrid |
| Equity Savings Funds | hybrid | equity savings | as aggressive hybrid |
| Dynamic Asset Allocation Funds; Balanced Advantage Funds | hybrid | balanced advantage or dynamic asset allocation | no default |
| Multi Asset Allocation Funds | hybrid | multi-asset allocation | no default |
| Retirement Funds; Children's Funds; Life Cycle Funds | solution oriented (life cycle from 2026) | life cycle and solution oriented funds | no default |
| Index Funds; ETFs; Exchange Traded Funds; Other ETFs; Index Funds/ETFs | other: index funds and ETFs | mixed: equity, debt (target maturity) and international index funds and ETFs share these names | no default (the scheme decides, TR-6) |
| Gold ETFs; Silver ETFs | other: ETFs | gold or silver ETF (listed) | other non-equity; Specified for units bought from 2023-04-01 and sold 2023-04-01 to 2025-03-31 |
| Global Funds; FoFs Overseas; Fund of Funds Overseas | other: fund of funds overseas | international or global fund of funds (an international ETF listed in India by its name, listed flag of §9.1) | other non-equity; Specified for units bought from 2023-04-01 and sold 2023-04-01 to 2025-03-31 |
| FoFs Domestic; Fund of Funds Domestic; FoFs (Overseas/Domestic) | other: fund of funds domestic | mixed: equity ETF (90/90), gold, silver, debt, multi-asset and active equity funds of funds share these names | no default (the scheme decides; the 90/90 sub-type is an analyst flag); never equity-oriented on the statement's Equity label (§9.1 step 3, TR-6) |

### 10.6 Set-off and carry-forward

| Item | Rule | Source |
|---|---|---|
| Whose losses (the live-page tax review, register TX-08) | Per person: set-off, carry-forward and the annual equity exemption are computed for each client separately and never pooled across a family; the family view adds up each person's result | Reckoner TY2026-27, Exemptions & Set-off!D10, A13 ; the live-page tax review (register TX-08) |
| Short-term capital loss | Against any capital gain of the same year; unabsorbed loss carried forward 8 years (tax years from 2026-27) against any capital gains (1961 s.70(2), s.74; 2025 s.108, s.111) | Reckoner TY2026-27, Exemptions & Set-off!C15, E15 ; https://www.incometaxindia.gov.in/w/section-70-64 ; https://www.incometaxindia.gov.in/w/section-108-103 ; https://www.incometaxindia.gov.in/w/section-111-102 |
| Order of the two kinds of loss | Long-term losses first, against long-term gains, highest rate first; short-term losses then against the remaining gains of either term (TR-10). This order gives the lowest tax for the year for the rate buckets as formed (NE-LT-1 legs chosen per lot, §9.3 step 1) and leaves any unabsorbed loss short term where possible (known answer KA-18) | TR-10 (app policy) |
| Short-term loss order (the live-page tax review, register TX-16) | Against the gains taxed at the highest rate first, slab-rate gains included (TR-10) | Reckoner TY2026-27, Exemptions & Set-off!F15 ; the live-page tax review (register TX-16) |
| Long-term capital loss | Only against long-term gains, any asset (an equity long-term loss can absorb non-equity LTCG), same year and 8 years forward (1961 s.70(3), s.74; 2025 s.108, s.111) | Reckoner TY2026-27, Exemptions & Set-off!C16, D16, E16, F16; Change Log & Sources!E57 ; https://www.incometaxindia.gov.in/w/section-70-64 |
| Loss on equity-oriented units sold 2018-02-01 to 2018-03-31 (s.10(38) exempt) | Not set off or carried forward | https://itatonline.org/info/cbdt-issues-faqs-on-taxation-of-ltcg-as-per-finance-bill-2018/ (Q23) |
| Loss on equity-oriented units sold 2004-10-01 to 2018-01-31 (s.10(38) exempt) | - | to be confirmed (app policy TR-10 ignores it) |
| Loss on equity-oriented units sold from 2018-04-01 | Eligible long-term loss | https://itatonline.org/info/cbdt-issues-faqs-on-taxation-of-ltcg-as-per-finance-bill-2018/ (Q24) |
| Equity threshold after set-off, sales from 2025-04-01 | Losses are set off first; the Rs 1,25,000 threshold then applies to the remaining s.112A or s.198 gains | Reckoner TY2026-27, Exemptions & Set-off!F10; Change Log & Sources!E57 (marked Corrected, so it covers FY 2025-26) |
| Equity threshold after set-off, sales 2018-04-01 to 2025-03-31 | - | to be confirmed (same statutory structure; the app applies the same order as an indicative policy, TR-9) |
| Carry-forward condition and wording | Return filed by the due date; from tax year 2026-27 say '8 tax years', before that 'eight assessment years' (the live-page tax review, register TX-22) | Reckoner TY2026-27, Exemptions & Set-off!A13, A22 ; the live-page tax review (register TX-22) |
| Brought-forward losses | Not in the statement; not applied; a note says so | TR-10 |

- **TR-10. In what order are current-year losses set off across gains taxed at different rates?** Per person and per FY or tax year (TR-15). (1) Losses on EQ-LT-1 exempt sales are ignored. (2) Long-term losses are set off first, only against long-term gains, highest rate first (s.112A or s.198 gains inside the unused exemption last). (3) Short-term losses are then set off against the remaining gains of either term, highest rate first, slab-rate gains included (the live-page tax review, register TX-16). Slab-rate gains are ranked at the slab rate the analyst enters for the person and year; while none is entered and a short-term loss meets slab-rate gains, the person's taxable amounts after set-off and their tax are the dash with 'slab rate not set' (§9.3 step 3). This order gives the lowest tax for the year for the rate buckets as formed (NE-LT-1 legs chosen per lot, §9.3 step 1) and leaves any unabsorbed loss short term where possible: in known answer KA-18 (FY 2023-24) it gives tax Rs 0, where setting the short-term loss first would give Rs 7,800.00 with cess and leave Rs 50,000 of long-term loss unabsorbed. (4) s.112A or s.198 gains inside the person's unused annual exemption count as 0% and are ranked last, since the exemption applies after set-off. Among gains at equal rates, the loss is set against non-exempt gains first (known answer KA-13: a long-term loss of Rs 1,00,000 beside Rs 1,00,000 of s.112 gain and Rs 1,00,000 of s.112A gain, both at 12.5%, gives tax Rs 0, not Rs 12,500). (5) Brought-forward losses are not in the statement and are not applied; a note says so. Every figure is labelled indicative. (Revised 27 Oct 2026, LD-3, LD-6; the order of the two kinds of loss, LD-24; the buckets as formed, LD-33.)
- **TR-15. Are set-off, carry-forward and the annual exemption computed per person or per family?** Per person (the assessee). Because the PAN is removed at read time and never used (§3), the person is the client id of §2.3: the normalised Client Name, else the name part of Account Name; labels that may name one person twice raise the Warning `person-ambiguous`, and grouping by PAN is an owner item (§15, item 3). The family view adds up each client's own results; set-off is never re-run across clients, harvest pools are tagged by client, and unabsorbed losses are reported against the person whose return carries them.

### 10.7 Surcharge and cess

| Financial year | Cess | Source |
|---|---|---|
| FY 2004-05 to FY 2006-07 (sales 2004-10-01 to 2007-03-31) | Education Cess 2% of (income-tax + surcharge); no marginal relief | https://www.incometaxindia.gov.in/w/memorandum-149 ; memorandum-150 ; memorandum-151 ; memorandum-152 |
| FY 2007-08 to FY 2017-18 | Education Cess 2% plus Secondary and Higher Education Cess 1% (total 3%) of (income-tax + surcharge) | https://www.incometaxindia.gov.in/w/memorandum-152 ; https://www.indiabudget.gov.in/budget2018-2019/ub2018-19/memo/memo.pdf |
| FY 2018-19 to FY 2025-26 | Health and Education Cess 4% of (income-tax + surcharge), replacing both earlier cesses | https://www.indiabudget.gov.in/budget2018-2019/ub2018-19/memo/memo.pdf ; https://www.indiabudget.gov.in/budget2025-26/doc/memo.pdf ; Reckoner FY2025-26, Master Summary!A3 (supporting) |
| FY 2026-27 (tax year, Income-tax Act 2025) | Health and Education Cess 4% of (income-tax + surcharge); no marginal relief | Reckoner TY2026-27, Master Summary!A3; Tax Slabs & Surcharge!A2, E42 to E48 ; https://www.indiabudget.gov.in/doc/memo.pdf |

| Financial year | Surcharge for individuals and HUFs | Source |
|---|---|---|
| FY 2004-05 | 10% where total income exceeds Rs 8,50,000 (marginal relief); maximum 10%, no cap needed | https://www.incometaxindia.gov.in/w/memorandum-149 |
| FY 2005-06 to FY 2008-09 | 10% where total income exceeds Rs 10,00,000 | https://www.incometaxindia.gov.in/w/memorandum-150 ; memorandum-151 ; memorandum-152 ; memorandum-153 ; memorandum-154 |
| FY 2009-10 to FY 2012-13 | Nil | https://www.incometaxindia.gov.in/w/memorandum-155 ; memorandum-158 |
| FY 2013-14 to FY 2014-15 | 10% where total income exceeds Rs 1 crore | https://www.incometaxindia.gov.in/w/memorandum-158 ; memorandum-159 |
| FY 2015-16 | 12% where total income exceeds Rs 1 crore | https://www.indiabudget.gov.in/budget2015-2016/ub2015-16/memo/mem1.pdf |
| FY 2016-17 | 15% where total income exceeds Rs 1 crore | https://www.indiabudget.gov.in/budget2016-2017/ub2016-17/memo/mem1.pdf |
| FY 2017-18 to FY 2018-19 | 10% (above Rs 50 lakh to Rs 1 crore), 15% (above Rs 1 crore); maximum 15%, cap not relevant | https://www.indiabudget.gov.in/budget2017-2018/ub2017-18/memo/memo.pdf ; https://www.indiabudget.gov.in/budget2018-2019/ub2018-19/memo/memo.pdf |
| FY 2019-20 | 10%, 15%, 25% (above Rs 2 crore), 37% (above Rs 5 crore). After the Taxation Laws (Amendment) Act 2019, for the whole year: 25% and 37% bands tested on total income excluding s.111A and s.112A gains, and surcharge on tax on those gains capped at 15%. s.112 and slab-rate gains not capped | https://www.indiabudget.gov.in/budget2019-20/doc/memo.pdf ; https://www.indiabudget.gov.in/budget2020-21/doc/memo.pdf |
| FY 2020-21 to FY 2021-22 | Same bands; dividend added to the capped category (cap 15% on dividend, s.111A, s.112A) | https://www.indiabudget.gov.in/budget2021-22/doc/memo.pdf ; https://www.indiabudget.gov.in/budget2022-23/doc/memo.pdf |
| FY 2022-23 | 15% cap extended to s.112 long-term gains (cap covers dividend, s.111A, s.112, s.112A) | https://www.indiabudget.gov.in/budget2022-23/doc/memo.pdf ; https://www.indiabudget.gov.in/budget2023-24/doc/memo.pdf |
| FY 2023-24 to FY 2025-26 | New regime (s.115BAC(1A)): 37% band not applicable, maximum 25%. Old regime keeps 37%. 15% cap on dividend, s.111A, s.112, s.112A in both | https://www.indiabudget.gov.in/budget2023-24/doc/memo.pdf ; https://www.indiabudget.gov.in/budget2025-26/doc/memo.pdf ; Reckoner FY2025-26, Tax Slabs & Surcharge!A35 (supporting) |
| FY 2026-27 (tax year, 2025 Act) | Nil up to Rs 50 lakh; 10% above Rs 50 lakh to Rs 1 crore; 15% above Rs 1 crore to Rs 2 crore; 25% above Rs 2 crore to Rs 5 crore; above Rs 5 crore 37% (old regime option) or 25% (default regime, s.202). Surcharge on tax on dividend and on gains under ss.196, 197, 198 capped at 15%; slab-rate income (including Specified MF gains) bears the normal surcharge. Marginal relief applies at each threshold (not applied by the app) | Reckoner TY2026-27, Tax Slabs & Surcharge!A31, B33 to E37; Master Summary!A3 ; https://www.indiabudget.gov.in/doc/memo.pdf |
| Not capped (all years) | Slab-rate gains (non-equity short-term gains, s.50AA and s.76 gains) bear the general surcharge rate, up to 37% (old regime) or 25% (new regime from FY 2023-24); s.112 long-term gains uncapped before FY 2022-23 | Cap provisos in the memoranda above ; Reckoner TY2026-27, Tax Slabs & Surcharge!A31 |

- **TR-12. Surcharge, cess, slab-rate gains, rebate and basic exemption shortfall.** Table rates exclude surcharge and cess. The slab rate, the surcharge rate and, from FY 2023-24, the regime (old or new) are entered per person and per financial year, each an audit entry; none has a default. The surcharge entry is limited to the maximum of its year in the table above (10%, nil, 10%, 12%, 15%, then 37%, or 25% for new-regime clients from FY 2023-24); the app then caps it at 15% on tax on the capped categories of the sale's FY (s.111A and s.112A from FY 2019-20, dividend from FY 2020-21, s.112 from FY 2022-23, ss.196 to 198 from tax year 2026-27), then applies cess from the cess table on tax plus surcharge, without marginal relief, labelled indicative. Until the surcharge rate is entered, every total is shown 'before surcharge (rate not set)'; from FY 2023-24, while the regime is not entered, an entry above 25% is held and every total is shown 'before surcharge (regime not set)'; in a year whose maximum is nil the surcharge is 0 and nothing is asked. Slab-rate gains (including specified MF gains, which bear normal surcharge) are shown as gains marked 'slab'; tax on them is computed only once the analyst enters the slab rate. (Revised 27 Oct 2026, LD-3, LD-4; the regime not entered, LD-30.) The s.87A or s.156 rebate and the resident basic exemption shortfall are not applied.

### 10.8 Other interpretation decisions

- **TR-1. Anniversary sale: is a lot sold on the same calendar date 12 (or 24, 36) months after purchase short term or long term?** Short term. Owner decision OD-2 (the live-page tax review, register TX-01): a lot is long term only when the sale date is strictly after the N-month anniversary. The anniversary is the date N calendar months after the purchase date with the same day number; where that month has no such day (a 29 February purchase), the last day of that month. The test compares calendar dates built from year, month and day, never a count of whole months or raw timestamps. Lots sold on the anniversary day are flagged (Warning `anniversary-sale`), and the long-term figure is shown beside them as the alternative, because the Delhi High Court reads the law the other way; the person-year summary also shows the tax if those lots were long term (§9.2). Keeping OD-2 or following the court is an owner item (§15, item 2).
- **TR-8. How are rate changes dated, and how is the move to the Income-tax Act 2025 handled?** Key every rule by sale date. Under the 1961 Act an amendment w.e.f. 1 April of year Y (AY Y to Y+1) governs sales from 1 April of Y minus 1; the July 2024 changes split by transfer date at 2024-07-23; the s.10(38) 65% definition took effect mid-year on 2006-06-01. Sales from 2026-04-01 use the 2025 Act, which works by tax year with no one-year lag: read each commencement clause (for example Notification 85/2026 applies to tax year 2026-27 from 2026-04-01) rather than applying the Y minus 1 rule. MF rates, thresholds and holding periods are unchanged across the switch.
- **TR-13. Which taxpayer is assumed?** A resident individual: every figure is labelled 'resident individual assumed'. Lots of a minor (whose gains are clubbed with a parent's income and share the parent's exemption), of an HUF, of joint holders and of a non-resident (whose rules differ, for example 1961 s.112(1)(c), TDS under 2025 s.393(2)) are flagged when the ownership data or the analyst marks them (Warning `assessee-flagged`), and are not computed differently. (Revised 27 Oct 2026, LD-14.)
- **TR-14. Coverage and the open-ended last rules.** Rules cover sales from 2004-10-01 (start of STT, s.10(38) and s.111A); earlier sales are flagged as out of range. Rules from 2026-04-01 are open-ended and rechecked after each Finance Act. The Taxation and Other Laws (Amendment) Act 2026 (Act 21 of 2026, assent 2026-08-17, deemed in force 2026-04-01) does not touch s.2(101), s.70, s.72, s.76, s.90 or ss.196 to 198. Cess and surcharge for tax year 2027-28 onward are not in the table until a Finance Act sets them.
- **TR-19. Which section labels and year terms does the app show?** Show 2025 Act sections with the old number in brackets for sales from 2026-04-01, for example 'Sec 76 (old 50AA)', 'Sec 198 (old 112A)'; show 1961 sections for earlier sales. Use 'tax year' from 2026-27 and 'FY' or 'assessment year' before it; carry-forward text says '8 tax years' for losses from tax year 2026-27. Labels use no en or em dash.
- **TR-20. Which date is the transfer date of a redemption, and how are boundary lots handled?** Use the statement's sale or redemption date as the transfer date. Flag every lot whose sale date is the anniversary or the day after it (Warning `anniversary-sale`), and every lot dated after the review's as-on date (Warning `after-as-on-date`), so the analyst can check the date basis; never let a lot's age go negative.

Holding-period examples (OD-2):

| Purchase and sale | Term | Source |
|---|---|---|
| Bought 2004-09-29, sold 2005-09-29 (12-month asset) | App (OD-2): short term, sale on the anniversary; flagged. The Delhi High Court held these actual units long term (Bharti Gupta Ramola v. CIT); the app shows that as the alternative | OD-2 ; Reckoner TY2026-27, Change Log & Sources!E7 ; https://delhihighcourt.nic.in/app/downloadOrderbByDate/ITA/1234/2011/12-04-2012 |
| Bought 2024-09-17, sold 2025-09-17 (12-month asset) | Short term (sale on the anniversary, OD-2); flagged | OD-2 ; Reckoner TY2026-27, Change Log & Sources!E7 |
| Bought 2024-09-17, sold 2025-09-18 (12-month asset) | Long term (strictly after the anniversary) | OD-2 ; Reckoner TY2026-27, Master Summary!A3 |
| Bought 2024-09-17, sold 2025-09-16 (12-month asset) | Short term | OD-2 ; Reckoner TY2026-27, Master Summary!A3 |
| Bought 2024-02-29, sold 2025-02-28 or 2025-03-01 (12-month asset) | App rule: anniversary clamped to 2025-02-28; sale on 2025-02-28 short term, 2025-03-01 long term (legal authority for the clamp to be confirmed) | the live-page tax review (register TX-01, its corrected fix) ; OD-2 |
| Unlisted non-equity unit bought 2023-01-10, sold 2025-01-10 | Short term at slab (sale on the 24-month anniversary, OD-2); sold 2025-01-11 it is long term at 12.5% (not a specified unit since bought before 2023-04-01) | OD-2 ; https://www.incometaxindia.gov.in/w/section-2-66 ; https://www.incometaxindia.gov.in/w/section-112-103 |

Section numbers, Income-tax Act 1961 to Income-tax Act 2025:

| Topic | Sections | Source |
|---|---|---|
| Commencement | Income-tax Act 2025 from 2026-04-01 (s.1(3)); 1961 Act repealed (s.536(1)); previous operation and liabilities for tax years beginning before 2026-04-01 saved (s.536(2)) | https://www.incometaxindia.gov.in/w/section-1-1 ; https://www.incometaxindia.gov.in/w/section-536-2 ; Reckoner TY2026-27, Master Summary!A2 |
| s.2(42A) short-term capital asset | s.2(101) | https://www.incometaxindia.gov.in/w/section-2-1 ; Reckoner TY2026-27, Section Map!C5, D5 |
| s.2(42A) Expl 1(i)(hd) / (hg) / (hh) / (f) | s.2(101)(c)(B)(VII) / (B)(IX) / (B)(X) / (C)(IV) | https://www.incometaxindia.gov.in/w/section-2-1 |
| s.47 (incl. 47(xviii), 47(xix)) transactions not transfer | s.70 (s.70(1)(zj), s.70(1)(zk); definitions s.70(2) Table Sl. 10 and 11) | https://www.incometaxindia.gov.in/w/section-70-123 ; Reckoner TY2026-27, Section Map!C17, D17 |
| s.48 computation, indexation, CII | s.72 (CII s.72(8)(a), base year s.72(8)(b); indexed cost only for item B of the s.197(3) formula via s.72(2)) | https://www.incometaxindia.gov.in/w/section-72-127 ; Reckoner TY2026-27, Section Map!C18, D18 |
| s.49(2AD), (2AF), (2AG), (2AH) cost rules | s.73(1) Table Sl. 8, 10, 11, 12 | https://www.incometaxindia.gov.in/w/section-73-122 |
| s.50AA specified mutual fund and market linked debenture | s.76; label 'Sec 76 (old 50AA)' (the live-page tax review, register TX-21) | https://www.incometaxindia.gov.in/w/section-76-106 ; Reckoner TY2026-27, Section Map!C19, D19 |
| s.55(2)(ac) grandfathered cost; s.55(2)(b) pre-2001 and previous-owner cost | s.90(7) and s.90(8); s.90(9)(a) and (b) | https://www.incometaxindia.gov.in/w/section-90-114 |
| s.55(2)(aa)(iiia) bonus cost nil | s.90(5)(b) with s.90(6)(d) | https://www.incometaxindia.gov.in/w/section-90-114 |
| s.70, s.71, s.74 set-off and carry forward | s.108, s.109, s.111 | https://www.incometaxindia.gov.in/w/section-108-103 ; https://www.incometaxindia.gov.in/w/section-111-102 ; Reckoner TY2026-27, Section Map!C27 to D29 |
| s.80C (ELSS deduction) | s.123 (old regime only) | Reckoner TY2026-27, Section Map!C32, D32; Master Summary!D11, P11 |
| s.87A rebate | s.156 (s.198(7) bars it against s.198 tax) | https://www.incometaxindia.gov.in/w/section-198-78 ; Reckoner TY2026-27, Section Map!C37, D37 |
| s.94(7) and s.94(8) dividend and bonus stripping | s.175(8) (dividend stripping, exempt income only) and s.175(9), (10) (bonus stripping) | https://www.incometaxindia.gov.in/w/section-175-80 (read in this review) |
| s.111A / s.112 / s.112A | s.196 / s.197 / s.198 | https://www.incometaxindia.gov.in/w/section-196-78 ; https://www.incometaxindia.gov.in/w/section-197-78 ; https://www.incometaxindia.gov.in/w/section-198-78 ; Reckoner TY2026-27, Section Map!C38 to D40 |
| s.112A Explanation (a) equity-oriented fund | s.198(8) | https://www.incometaxindia.gov.in/w/section-198-78 ; Reckoner TY2026-27, Master Summary!P13 |
| s.115BAC new regime | s.202 | https://www.indiabudget.gov.in/doc/memo.pdf ; Reckoner TY2026-27, Section Map!C42, D42 |
| s.10(38) | No equivalent (withdrawn for transfers from 2018-04-01) | https://www.incometaxindia.gov.in/w/section-10-62 |
| 'Previous year' and 'assessment year' | 'Tax year' from 2026-27 (the live-page tax review, register TX-22) | Reckoner TY2026-27, Exemptions & Set-off!A22; Master Summary!A2 |

### 10.9 To be confirmed

Each item shows a dash in the table, or is flagged in the app, until it is confirmed:

- CII FY 2016-17 (1981-82 base): candidate value 1125 appears only in secondary reproductions (taxguru.in/?p=501105, taxheal.com/?p=11007) of Notification 42/2016, S.O. 1948(E), 2016-06-02. No gazette or department copy was found (department site search for 'S.O. 1948(E)' and the s.48 Year 2017 text checked in this review). The table shows a dash, so NE-LT-2 lots sold 2016-04-01 to 2017-03-31 are not computed until confirmed (the gazette copy is an owner item for the tax adviser, §15, item 4).
- FY 2018-19 STT on redemptions of 90/90 ETF FoFs: when the Chapter VII (STT) definition of equity-oriented fund moved off s.10(38) was not traced, so whether s.112A or s.112 applied to their long-term gains (EQ-FOF-2) is unknown.
- FY 2024-25 order of applying the single Rs 1,25,000 between 10% and 12.5% equity gains: no CBDT circular or ITR utility rule found (TR-2); the app takes the taxpayer-favourable order and shows the other in a note (LD-10), for the owner to confirm (§15, item 6).
- NE-LT-1 (sales up to 2014-07-10): whether the lower of 20% with indexation and 10% without is chosen per lot or on the year's total, whether before or after set-off, and which gain then enters set-off. The app chooses per lot, on signed amounts, before set-off (LD-15, LD-33, LD-40), as the per-asset reading; the year's-total figure is shown beside it; which is lower depends on the year's losses (KA-19, KA-20, KA-22); until the tax adviser answers (§15, item 4).
- Equity threshold applied after set-off for sales 2018-04-01 to 2025-03-31: same statutory structure, but stated by the reckoner only for FY 2025-26 onward.
- Losses on s.10(38) exempt equity sales before 2018-02-01: CBDT FAQ Q23 covers only 2018-02-01 to 2018-03-31; the exempt-source principle and case law were not read.
- 29 February purchases: the month-end clamp of the anniversary follows the live-page tax review (register TX-01); no legal authority.
- Anniversary-day sales: OD-2 departs from Bharti Gupta Ramola (Delhi HC) and ITAT Mumbai in Kuwait Investment Authority (read through a fetch summary); registrar and ITR utility treatment not checked.
- Date of transfer for MF redemptions (request, NAV or payout date) not researched (TR-20).
- Which year's annual average decides specified status under s.50AA or s.76: the FY of sale is assumed.
- FoF of active equity funds bought from 2023-04-01 and sold 2023-04-01 to 2025-03-31: specified under the 35% test on a plain reading only.
- Hedged arbitrage equity counting toward the 65% test: stated by the reckoner for TY 2026-27 without a statutory citation; no primary source for earlier years (no default before 2026-04-01).
- SCRA s.2(h)(id) (MF units are securities) and the SEBI listing requirement for close-ended schemes were not read in primary text (TR-16).
- Grandfathered FMV for units received in a tax-neutral consolidation after 2018-01-31 in exchange for units bought before 2018-02-01: no unit-specific rule found.
- Cross-fund-house scheme mergers under s.47(xviii) or s.70(1)(zj): not researched.
- Cost of new units received in a taxable consolidation, and cost of IDCW reinvestment units: general principle only; the app uses the statement's lot cost meanwhile, and the analyst's re-base of a `successor-not-reset` lot (§5, TR-5) applies the general principle (cost = merger value).
- Date from which 1961 s.94(8) applied to MF units: not checked.
- ELSS: lock-in of units allotted before 2005-11-03 (ELSS 1992) and the gazette publication date of ELSS 2005 not read; holding period of a nominee's or heir's redemption not researched.
- CII notification numbers not read in primary text (values verified): 44/2017, the FY 2018-19 to FY 2020-21 notifications, 73/2021, 62/2022, 39/2023 (S.O. 2571(E), 2023-06-12) and 44/2024.
- Finance Act 2026 (Act 4 of 2026) enacted text not read; 'no MF capital-gains change' rests on the Bill memorandum, the department's 2026 section texts, Act 21 of 2026, the HSBC reckoner and the owner's reckoner.
- FY 2027-28 onward: exemption, rates, cess and surcharge not set.
- 87A rebate against special-rate gains under the new regime for FY 2023-24 and FY 2024-25 (litigation) and the exact 2025 Act s.156 wording not verified.
- Dates of the Taxation Laws (Amendment) Ordinance 2019 and Act 2019 not verified (their effect for all of FY 2019-20 is verified).
- Segregated portfolio units sold in FY 2018-19: treatment unresolved, flag only.
- FMV on 1981-04-01 option for assets held before 1981 (relevant to NE-LT-1 and NE-LT-2 only for very old UTI units): not read.
- Statutory texts were read as the department's consolidated versions, which carry a 'not legal documents' disclaimer; the Finance Act 2014, 2017, 2023 and 2024 texts were not opened. The 2025 Act s.2(101) was read only in the 2025 edition.

### 10.10 Review record
- 27 Oct 2026: researched (three researchers), drafted, verified by three adversarial verifiers against primary
  sources, and reconciled by the financial-domain reviewer with the owner's reckoner, OD-2 and the live-page tax
  review.
- 27 Oct 2026: reviewed for the financial domain, for completeness and for security (verdicts: changes needed, gaps,
  go); revised with the lead's decisions LD-1 to LD-23 (§10.11).
- 27 Oct 2026: re-reviewed for the financial domain (changes needed: the order of the two kinds of loss, successor
  lots after a taxable merger, the Sectoral and Thematic default, funds of funds labelled Equity; every key of §10.1
  checked to map to exactly one rate row, and KA-1 to KA-17 recomputed) and for completeness (gaps); revised with the
  lead's decisions LD-24 to LD-32 (§10.11).
- 27 Oct 2026: approval reviews for the financial domain (changes needed: NE-LT-1 per lot can exceed the year's-total
  figure when a loss meets NE-LT-1 gains, KA-20; a person-year with lots not computed is PARTIAL COVERAGE; the analyst's
  class on a fund of funds; the re-base formula; every valid key of §10.1 scanned and KA-1 to KA-19 recomputed) and
  for completeness (gaps); revised with the lead's decisions LD-33 to LD-39 (§10.11).
- 27 Oct 2026: second approval reviews for the financial domain (changes needed: the NE-LT-1 "lower or equal"
  condition does not hold on the per-lot computation, KA-22; the leg on equal figures; a fund of funds that passes
  the 90/90 test in one year and fails it in another) and for completeness (gaps: the same NE-LT-1 condition);
  revised with the lead's decisions LD-40 to LD-42 (§10.11).
- Approval for M7: given on 27 Oct 2026. After the fourth revision (LD-40 to LD-42) the financial-domain reviewer
  approved the design and §10 for M7 code, recomputing KA-19, KA-20 and KA-22 with an independent set-off engine; the
  owner and tax-adviser items of §15 stay open.

### 10.11 The lead's decisions of 27 Oct 2026

Taken by the lead on the three reviews of 27 Oct 2026 (LD-1 to LD-23), on the financial and completeness re-reviews
of the same day (LD-24 to LD-32), on their approval reviews (LD-33 to LD-39) and on the second approval reviews
(LD-40 to LD-42); where two reviewers proposed different fixes for one point, the financial
reviewer's was used. Each is applied in the sections named.

| Id | Decision | Applied in |
|---|---|---|
| LD-1 | The design's interpretation decisions are TR-1 to TR-21 (formerly TX-1 to TX-21, which clashed with the live-page register's TX-01 to TX-23); the register is cited as "the live-page tax review (register TX-nn)", never with a local path | §10 "How to read it"; every TR reference |
| LD-2 | The rule key is (tax class, listed flag, sub-type in none, equity ETF fund of funds (90/90) or ELSS, purchase date, sale date), mapping to exactly one rate row. The listed flag is the analyst's, else listed for an ETF by name that is not a fund of funds, else unlisted, except a close-ended non-equity scheme sold from 2024-07-23 and held 12 to 24 months without a flag, which shows the dash (only where the lot's rule depends on the flag, LD-29). The 90/90 sub-type is an analyst flag. EQ-ELSS-1 leaves the rate table for a list of checks | §9.1, §9.3 step 1, §10 "How to read it", §10.1 "Checks", TR-16, TR-17 |
| LD-3 | With no slab rate entered, the §9.3 dash wins and TR-10's "ranked first" sentence is deleted. The slab rate, surcharge rate and regime are entered per person and per financial year; the slab rate has no default | §9.3, TR-10, TR-12 |
| LD-4 | The surcharge rate has no default: until it is entered, tax is shown "before surcharge" and labelled so; the regime (old or new) is asked per person and year so that the right maximum applies | §9.3 step 6, TR-12 |
| LD-5 | Grandfathering without the 31 Jan 2018 value: computed on actual cost, labelled "31 Jan 2018 value not supplied; actual cost used; gain may be overstated" (Information count); the dash only for lots needing the s.55(2)(b) or s.90(9) input (first held before 1 Apr 2001, gift or inheritance) | §5, TR-11 |
| LD-6 | Set-off ranking: s.112A and s.198 gains inside the unused exemption rank at 0% and last; among equal rates, losses go against non-exempt gains first (KA-13) | §9.3 step 3, TR-10 |
| LD-7 | The rule's cost basis governs the cost for tax; the lot class only supplies inputs | §5, TR-11 |
| LD-8 | Mergers: date gates (2015-04-01 scheme, 2016-04-01 plan); three answers; the successor-reset wording and direction; the pattern "Acquisition Date equals Sale Date and differs from Purchase Date"; the template's Read Me says how to enter a merger, and `cg-template-filled` holds one merger row | §5, §12, §13.2, TR-5 |
| LD-9 | Repeated rows: one answer per sale event, with "apply to all" as a shortcut; a sale event is one folio, scheme and sale date; genuine same-day lots that differ in any cell are never repeats | §6 |
| LD-10 | FY 2024-25: the exemption goes first against the 12.5% gains (the taxpayer-favourable order, consistent with set-off); the other order's figure is shown in a note; labelled "order not set by the Act" | §9.3 step 4, TR-2, §10.9, §15 item 6 |
| LD-11 | From tax year 2026-27, aggressive hybrid, arbitrage and equity savings funds default to equity-oriented, labelled "usual bucket per the owner's reckoner; confirm with the fund house", with a Warning; balanced advantage and multi-asset keep no default; before tax year 2026-27, none of them has a default | §9.1, §10.5, §10.5a, TR-7, §15 item 7 |
| LD-12 | A category map from the platform's Category Name to the §10.5 fund types for the whole SEBI category list, in the platform's form, matched exactly after normalising; an unknown name maps to nothing (Warning) | §10.5a, §9.1 step 2 |
| LD-13 | The person is the client id (normalised Client Name, else the name part of Account Name); labels that differ only in letter case or spacing are one person; a Warning when two different labels may name one person (initials or honorifics, the test of §9.3, LD-32); grouping by PAN is an owner question, not designed in | §3, §9.3, TR-15, §15 item 3 |
| LD-14 | Residents only: every figure labelled "resident individual assumed"; lots of minors, HUFs, joint holders and non-residents flagged, not computed differently | §9, §9.3, TR-13 |
| LD-15 | NE-LT-1 (the old-law 10% or 20% choice) is applied per lot, on signed amounts, before set-off, as the per-asset reading; the year's-total figure is shown beside it; which is lower depends on the year's losses (KA-19, KA-20, KA-22; LD-28, LD-33, LD-40); set-off on the chosen gain; flagged for the tax adviser | §9.3 step 1, §10.1, §10.9, §15 item 4 |
| LD-16 | Indexation base floor: units first held before FY 2001-02 (2001 series) or FY 1981-82 (1981 series) use the base year; the FMV option is not supplied, so the statement's cost is used, labelled | TR-3, §10.3, `DATA_DICTIONARY.md` §7 |
| LD-17 | Footer details from a private check of the sample (no values): empty lot cells sum as 0; a blank total is "not reconciled" and a 0 total over empty cells is reconciled; per-unit prices are never reconciled; the tolerance is ₹1 per column plus ₹0.005 per row summed; the first footer row reading "Total" is the totals row only with no Sale Date-like text and numbers in money columns; a lot row whose Sale Date is invalid text is an excluded lot with a Warning, never footer | §2.4, §7, §13.2 |
| LD-18 | The sample's merger events are dated after 1 Apr 2016 (private check), so its merger rows are the non-taxable class; the fixture still covers both sides of each date gate | §5, §13.4 |
| LD-19 | Nothing says "approved" until the financial-domain reviewer approves this revision; D-036, the parity matrix and the roadmap say "to be approved before any M7 code"; the change log will record the approval | header, §10, §10.10, §15; D-036, E-154, roadmap M7 |
| LD-20 | The owner's reckoner is cited by title and sheet!cell (Centricity material, class P under D-026); the stripping note is phrased neutrally | §10 "How to read it", §10.4 |
| LD-21 | Tax metric paths are keyed by person and year, with exemption, unabsorbed-loss and long-term alternative lines; the `RealisedGain` field names follow this design | `DATA_DICTIONARY.md` §5.5, §6 |
| LD-22 | Stale wording fixed: BR-3.1, PROJECT_STATE, the CHANGELOG's section list, and the missing-value marker written "the dash" in sentences | those files; this document |
| LD-23 | Tests: rows for `rules`, `lots`, `rollup`, `cg-import` and `tax-view` in the test plan; every rule id of §11 mapped to a fixture and a test; the financial review's known answers in §13.4 as the content of `cg-known-answers.json`; the workbook and deck PAN assertions moved to the milestones that build them (M7 workbook, M9 deck); the missing fixture cases added | §13, §14; `08-regression-test-plan.md` |
| LD-24 | Loss order: long-term losses are set off first, against long-term gains, highest rate first (s.112A or Sec 198 gains inside the unused exemption last); short-term losses then against the remaining gains, highest-taxed first, slab included; known answer KA-18 | §9.3 step 3, §10.6, TR-10, §13.4, `DATA_DICTIONARY.md` §7 |
| LD-25 | Successor lots after a taxable merger event: a lot that still carries the original cost and date is reported (Warning `successor-not-reset`) and re-based by the analyst (purchase date = event date, cost = merger value) or computed as stated and flagged, the double-counted amount named; the Read Me gives successor lots their original dates and costs only after a non-taxable consolidation; KA-17 extended with the successor, as stated and re-based | §4, §5, TR-5, §11, §12, §13.4, §14 |
| LD-26 | Sectoral and Thematic Funds keep the equity-oriented default, with a Warning on every lot it classes, listed by scheme (`category-default-to-confirm`) | §9.1 step 2, §10.5, §10.5a, §11, §13.4, §14 |
| LD-27 | A fund of funds is never equity-oriented through the statement's Equity label; it is equity-oriented only with the 90/90 sub-type (sales from 2018-04-01; other non-equity before, TR-18) or the analyst's class for a sale from 2018-04-01, which gives the 90/90 sub-type to that scheme's sales in that financial year only, without setting the per-scheme 90/90 flag (LD-35, LD-41) | §9.1, §10.5a, §13.4, §14 |
| LD-28 | NE-LT-1 per lot is "the per-asset reading" (not "conservative"); the year's-total figure is shown beside it; which is lower depends on the year's losses (KA-19, KA-20, KA-22; LD-33, LD-40); for `gain-differs` the chosen leg's gain is compared | §9.3 steps 1 and 8, LD-15, §10.9, §11, §13.4 |
| LD-29 | The listed-flag dash only where the lot's rule depends on the flag (the general-rule non-equity rows from 2024-07-23); a close-ended Specified lot is computed | §9.1, TR-16, §11, §13.4 |
| LD-30 | Surcharge while the regime is not entered (from FY 2023-24): an entry above 25% is held, and totals stay "before surcharge (regime not set)" | §9.3, TR-12, §13.4, §14 |
| LD-31 | LD-10 (the FY 2024-25 exemption order) and LD-11 (the reckoner's usual bucket as the default from tax year 2026-27) are lead decisions for the owner to confirm | §15 items 6 and 7 |
| LD-32 | The completeness re-review applied as written: the `cg-template-filled` columns and the merger pattern's blank and derived cells; the `person-ambiguous` test defined; the analyst's marks in the tax view and the tests; the old metric paths defined from the per-person paths; the joint and minor marks set by the test; the family label compared; unmatched clients as their own person; both units x price checks; the ingest test runs the engine; valid rule keys; the fixtures' as-on date 30 Sep 2026; no counts from the sample | §2.3, §4, §5, §6, §9.1, §9.3, §10.5, §11, §13, §14; `DATA_DICTIONARY.md` §4, §5.5, §6; parity rows E-153, E-155, U-72; `08-regression-test-plan.md` |
| LD-33 | NE-LT-1: both figures per lot on signed amounts, the lot in the bucket of the lower figure (a lot with an indexed loss always takes the 20% leg), the choice made before set-off; which of the per-lot and the year's-total figures is lower depends on the year's losses (KA-19, KA-20, KA-22; LD-40); the year's-total figure is the year's tax computed twice with set-off, every NE-LT-1 lot on its 20% leg and then on its 10% leg, the lower shown; set-off gives the lowest tax "for the rate buckets as formed"; a property test (removed by LD-40) | §9.3 steps 1, 3 and 8, §10.1, §10.6, TR-10, §10.9, LD-15, LD-28, §11, §13.4, §14, §15 item 4; `DATA_DICTIONARY.md` §6, §7 |
| LD-34 | Lots without a computable taxable gain enter no rate bucket; the person-year's set-off, exemption and tax are computed over the other lots and are PARTIAL COVERAGE, the count and the economic gain of the lots left out named; the total tax is PARTIAL while the slab rate is not set; a family sum is PARTIAL when any person's figure is (KA-21) | §9.3, §13.4, §14; `DATA_DICTIONARY.md` §6, §7; parity rows E-155, U-72 |
| LD-35 | The analyst's equity-oriented class on a fund of funds is accepted only for sales from 2018-04-01 and gives the 90/90 sub-type to that scheme's sales in that financial year only, without setting the per-scheme 90/90 flag (LD-41); for an earlier sale it is refused, with the reason named | §9.1, TR-6, TR-18, LD-27, §14; `DATA_DICTIONARY.md` §7; parity row E-152 |
| LD-36 | The 90/90 flag sets the class by sale date for every sale; to class a year otherwise, the analyst clears the 90/90 flag for that scheme (an audit entry); the "unless the analyst sets the class for that year" wording is deleted | §9.1 |
| LD-37 | Re-base of a `successor-not-reset` lot: cost = S x V / W, the amount counted twice (S - W) x V / W; only lots sold after the event date are candidates; a same-day SIP lot of another scheme is listed but not re-based; the re-base uses the general principle, to be confirmed; a successor test with a ratio other than 1 | §5, TR-5, §10.4, §10.9, §11, §13.4, §14 |
| LD-38 | A key with the listed flag missing whose figures are the same either way records the unlisted row's id, labelled "listed flag missing; same figures either way"; the §10.5 default sentence names Sectoral and Thematic Funds | §9.1, §10.5 |
| LD-39 | The completeness approval review applied as written: each fixture's analyst inputs recorded and its validation results expected without and with them; `costBasis` `none` only without a computable taxable gain; the listed flag missing only for a close-ended non-equity scheme, and its keys; a blank optional cell skips its row check; the rule bank's tax paths read per person (a follow-up for the rule bank's owner); LD-13 reworded and the honorific's full stop; the fixtures' client labels and the successor lots of the taxable merger events | §4, §9.1, §9.3, §11, §13.1, §13.2, §13.4, §14, §15; `DATA_DICTIONARY.md` §5.5, §6, §8; `08-regression-test-plan.md` |
| LD-40 | NE-LT-1: every claim that the per-lot choice gives a tax lower than or equal to the year's-total figure is removed, and so is the property test that rested on it. The choice stays per lot, as the per-asset reading, on signed amounts, before set-off; the year's-total figure is shown beside it (§9.3 step 8); which is lower depends on the year's losses. KA-19, KA-20 and KA-22 (the financial reviewer's, a short-term equity loss beside an NE-LT-1 lot) are plain known answers with both figures. On equal positive figures the lot takes the 20% leg (a lots test of the reviewer's tie lot: Rs 710.00 on both legs, gain Rs 3,550.00 taken) | §9.3 steps 1 and 8, §10.9, LD-15, LD-28, LD-33, §11, §13.4, §14, §15 item 4; `DATA_DICTIONARY.md` §7; parity row E-155; `08-regression-test-plan.md`; roadmap M7 |
| LD-41 | The financial reviewer's fix for funds of funds applied as written: the analyst's equity-oriented class on a fund of funds gives the 90/90 sub-type to that scheme's sales in that financial year only, without setting the per-scheme 90/90 flag, so a fund can pass the 90/90 test in one year and fail it in another; with the flag cleared, the analyst sets the class of each year; a lots test with the flag cleared, the equity-oriented class for FY 2019-20 and the other non-equity class for FY 2021-22 (lots bought 1 Jun 2018, sold 1 Aug 2019 and 1 Aug 2021: EQ-LT-3 and NE-LT-3) | §9.1 step 1 and "Sub-type", TR-6, TR-18, LD-27, LD-35, §14; `DATA_DICTIONARY.md` §7; parity row E-152; `08-regression-test-plan.md` |
| LD-42 | Known answers are compared to ₹0.01 on the unrounded total; tax and cess are not rounded separately (KA-20: unrounded Rs 706.2857, Rs 706.29) | §13.4, §14; `08-regression-test-plan.md` |

## 11. Validation results

| Rule id (`capital-gains.`) | Severity | When |
|---|---|---|
| `no-header` | Blocking | no sheet has the required columns; the file is refused, naming them (§2.1) |
| `duplicate-column` | Blocking | two header cells match one column (§2.2) |
| `no-lots` | Blocking | a header but no lot row (for example the unfilled template) |
| `repeats-question` | High | a sale event with repeated rows has no answer yet; its year is INSUFFICIENT EVIDENCE (§6) |
| `totals-mismatch` | High | an amount column does not reconcile with the totals row within the tolerance; names the column, the difference and any excluded lots (§7) |
| `non-taxable-transfers` | High | merger events to answer: non-taxable consolidation, taxable consolidation or investor switch (§5) |
| `clients-unmatched` | High or Warning | High when no lot's client matches a client of the review (a statement of another family); Warning when only some do not. An unmatched lot is kept as its own person by its `clientId`, computed separately, listed under "clients not in the review", and never pooled with a review client or added to the family sum (§9.3) |
| `family-differs` | Warning | the Family Name column names a family other than the review's: compared, after the base file's label normalisation, with the review's family label (`Family.label`); not compared while the label is unset (§2.3) |
| `row-without-sale-date` | Warning | an excluded lot: a row other than the totals row with amounts but no date in Sale Date, between lot rows or after the last one (§2.4) |
| `invalid-cells` | Warning | a date or number cell that is not one (INVALID SOURCE DATA) |
| `row-check-failed` | Warning | one per row check of §4 (holding days, Sell Amount, Invested Value, Realized G/L, date order, Sale Unit above 0), with its count |
| `nonzero-principal-or-interest` | Warning | Principal Repayment or Interest Earned not 0 on a mutual-fund lot |
| `tag-asset-differs` | Warning | the instrument tag's asset differs from Asset Name (§2.5) |
| `person-ambiguous` | Warning | two different client labels are "possibly one person": after folding letter case and spacing and dropping a leading honorific (Mr, Mrs, Ms, Dr, Shri, Smt, with or without a full stop), their words pair up in order, a one-letter word (with or without a full stop) pairing with any word that starts with that letter, and one label may carry extra one-letter words; two different one-letter words never pair (§9.3) |
| `assessee-flagged` | Warning | a lot of a minor, an HUF, joint holders or a non-resident, computed as a resident individual's (§9.3, TR-13) |
| `lot-class-other` | Warning | a lot of the `other` class (§5) |
| `merger-taxable` | Warning | a merger event dated before the date gate, taxed as a sale by default, or a zero-gain merger row that fails TR-5 (a) or (b) (§5) |
| `cross-house-merger` | Warning | a merger event between two fund houses (§5, TR-5) |
| `successor-reset` | Warning | after a non-taxable event, a successor lot whose purchase date is the event date (§5) |
| `successor-not-reset` | Warning | after a taxable event, a lot of the same account in another scheme whose purchase date is before the event date and equals a purchase date of the event's merger rows, and whose sale date is after the event date: the candidate lots listed by scheme (a same-day SIP lot of another scheme matches too); computed as stated, the amount counted twice, (S - W) x V / W, named, until the analyst re-bases the successor's lots (§5, TR-5) |
| `cost-input-missing` | Warning | a lot under a grandfathered rule that needs the s.55(2)(b) or s.90(9) input (first held before 1 Apr 2001, or a gift or inheritance): its tax is the dash (§5, TR-11) |
| `category-unmapped` | Warning | the Category Name is not in the category map (§10.5a) |
| `category-default-to-confirm` | Warning | a Sectoral Funds or Thematic Funds lot classed equity-oriented by its category, listed by scheme: "equity-oriented by its category; a fund investing mainly in foreign shares is not equity-oriented: confirm the class" (§9.1 step 2) |
| `usual-bucket-default` | Warning | an aggressive hybrid, arbitrage or equity savings lot sold from tax year 2026-27, classed by the reckoner's usual bucket (§9.1) |
| `tax-class-from-statement` | Warning | the class comes from the statement's own classification (§9.1 step 3) |
| `tax-class-not-set` | Warning | no class for the lot (for example a fund of funds labelled Equity without the 90/90 flag): its tax is the dash with "tax class not set" (§9.1 steps 3 and 4) |
| `specified-test-missing` | Warning | a lot bought from 2023-04-01 without a class: the Specified test of its year needs the fund's percentages (§9.1 step 4, TR-4) |
| `listed-flag-missing` | Warning | a lot of a close-ended non-equity scheme without the listed flag, sold from 2024-07-23 and held more than 12 and at most 24 months, whose rule depends on the flag (the general-rule non-equity rows from 2024-07-23): its tax is the dash; a close-ended Specified lot (NE-50AA rows) is computed and not flagged (§9.1, TR-16) |
| `tax-class-differs` | Warning | the app's class differs from the statement's Asset Name (§9.1) |
| `term-differs` | Warning | the app's term differs from the statement's split (§9.2) |
| `anniversary-sale` | Warning | a sale on the anniversary or the day after it; for the anniversary itself the long-term figure is shown beside (§9.2, TR-1, TR-20) |
| `after-as-on-date` | Warning | a lot sold after the review's as-on date (§9.2, TR-20) |
| `elss-early-sale` | Warning | an ELSS lot sold on or before the 36-month anniversary (check EQ-ELSS-1, TR-17) |
| `gain-differs` | Warning | the app's taxable gain differs from the statement's LTCG or STCG beyond the §4 tolerance (for example grandfathering or indexation); on an NE-LT-1 lot the gain compared is that of the chosen leg (§9.3 step 1) |
| `stripping-candidate` | Warning | a loss that may fall under dividend or bonus stripping, without record-date data; computed normally (TR-21) |
| `rule-to-be-confirmed` | Warning | a lot whose rule needs an input still to be confirmed (for example the FY 2016-17 index, EQ-FOF-2, the exemption from tax year 2027-28): its tax is the dash with the rule id (§9.3, §10.9) |
| `outside-rule-table` | Warning | a lot sold before 1 Oct 2004, which no rule covers: its tax is the dash with NOT APPLICABLE |
| `sheet-used` | Information | the sheet read, and the other sheets ignored (§2.1) |
| `columns-ignored` | Information | the headers not in §2.3 (§2.2) |
| `pan-removed` | Information | the count of PAN tags and tokens removed, footer removals counted separately (§3) |
| `rows-skipped` | Information | blank rows and repeated headers between lot rows, counted (§2.4) |
| `footer-skipped` | Information | footer rows, counted one per sheet row; their text not kept (§2.4) |
| `totals-reconciled` | Information | the amount columns reconciled, and those whose total is blank (§7) |
| `no-totals-row` | Information | no totals row, so nothing is reconciled (§7) |
| `stated-tax-columns-empty` | Information | the stated tax columns are empty on every lot row (§7) |
| `lot-classes` | Information | the count of lots per class (§5) |
| `derived-prices` | Information | prices derived from amounts and units (§2.3) |
| `indexed-cost-ignored` | Information | a stated indexed cost on a lot whose rule does not index (§5) |
| `grandfathered-value-ignored` | Information | a 31 Jan 2018 value on a lot whose rule is not grandfathered (§5) |
| `grandfathering-value-not-supplied` | Information | pre-1 Feb 2018 equity lots sold long term from 1 Apr 2018 without the 31 Jan 2018 value: actual cost used, gain may be overstated (§5) |
| `pre-base-year-cost` | Information | a lot first held before the index series' base year: the statement's cost used (TR-3) |
| `old-law-choice` | Information | NE-LT-1 lots: the lower figure taken per lot, on signed amounts, before set-off, as the per-asset reading; the year's-total figure is shown beside it; which is lower depends on the year's losses (KA-19, KA-20, KA-22); for the tax adviser to confirm (§9.3 step 1) |
| `xirr-not-used` | Information | the lot XIRR column is not used (§2.3) |

Every message is a plain sentence without an en or em dash (D-029) and carries no PAN, folio or amount of a single
lot; counts and financial years only.

## 12. The blank template and its Read Me

- Generated by the app on request (section 1, "Download the blank capital-gains template"); no binary is committed.
- Sheet "Capital Gains": row 1 holds the 29 headers of §2.3 in the export's order (trimmed), dates formatted
  `dd-mmm-yyyy`, money `#,##0.00`, units `#,##0.000`; frozen header; no data rows.
- Sheet "Read Me": one row per column (required or not, what to enter, the unit), and these instructions: one row per
  purchase lot consumed by a sale; money in rupees; put the folio as `[Folio No: <folio>]` after the scheme name, or in
  an added Folio Number column; never enter a PAN (any PAN-shaped text is removed when the file is read); leave
  Acquisition Date and Acquisition Price blank unless the issuer states a different cost for tax (31 Jan 2018 value or
  an indexed cost); for a scheme merger or a plan consolidation (which registrar statements show as a redemption or a
  switch out), enter Acquisition Date = Sale Date, Acquisition Price = Sale Price, LTCG G/L = 0 and STCG G/L = 0, so
  that the app reads the row as a merger event (§5) and does not tax it as a sale; give the successor scheme's lots
  their original purchase dates and costs only after a non-taxable consolidation (a scheme consolidation from 1 Apr
  2015 between schemes of the same class, or a plan consolidation within one scheme from 1 Apr 2016, §10.4); after any
  other event (an earlier consolidation, a cross-class one, or an investor switch) they take the merger date and the
  merger value; leave the tax columns blank (the app computes them).
- A filled template is read by the same reader as the export; there is one parser.

## 13. Synthetic fixture generator

### 13.1 Where and how
`tests/fixtures/make-cg-statements.ts`, in the style of `tests/fixtures/make-books.ts`: TypeScript run by Node 24,
written with the test SheetJS helper (`tests/helpers/sheetjs.ts`), deterministic (no clock, no randomness: a fixed
case list), dates written as whole Excel serials with the format `dd\-mmm\-yyyy`, money headers with the export's
trailing space. It writes `.xlsx` files to the git-ignored `test-data/new-build/` at test time; only the generator and
a small known-answer file, `tests/fixtures/cg-known-answers.json`, are committed. Every name, folio and amount is
invented: clients "Sample Client A" and "Sample Client B" of `family-a`, distributors "Sample Distributor 1" to "3",
schemes "Sample ... Fund", folios from `91000001`. The sheet is named after the synthetic family label ("Family A"), as
the platform names its sheet, and the Family Name column carries the same label. The review is `family-a` with its
as-on date of 30 Sep 2026, and the tests set its family label (`Family.label`) to "Family A"; every `cg-statement` lot
is sold on or before that date. `cg-known-answers.json` also records, for each fixture, the analyst inputs the tests
apply: the 90/90, close-ended, gift or inheritance and assessee marks; the scheme classes; the merger and repeats
answers; and the slab rate, surcharge rate and regime per person-year. Each fixture's expected validation results are
listed twice: for the bare import (no inputs, so `repeats-question` and `non-taxable-transfers` open) and with the
recorded inputs applied.

### 13.2 Fixtures

| Fixture | What it is | Proves |
|---|---|---|
| `cg-statement` | the platform layout with every case of §13.4; one blank row before the footer; a totals row reading "Grand Total" in column A that sums all lot rows (repeats included), fills the amount columns only, and holds 0 in Pre Tax G/L, Tax Amount and Surcharge and nothing in Cess, Total Tax and Post Tax G/L, over lot cells that are all empty in those six columns; and a merged A to E text block of eight rows holding synthetic text with a PAN-shaped token | §2 to §9 end to end; the totals reconciled (the 0 totals over empty cells too) while `stated-tax-columns-empty` still fires |
| `cg-statement-reordered` | the same lots with the columns shuffled, two extra columns, a note sheet before the data sheet, a title row above the header (header in row 3), headers without the trailing space and with "(Rs.)" | header matching; `sheet-used` and `columns-ignored`; equal lots to `cg-statement` |
| `cg-statement-duplicate-column` | `cg-statement` with both a Sale Date and a Redemption Date column | Blocking `duplicate-column` |
| `cg-template-blank` | the blank template from the app, unfilled | Blocking `no-lots` |
| `cg-template-filled` | the blank template from the app, filled with only the required columns plus Category Name, a Folio Number column, and the Sale Price, LTCG G/L and STCG G/L columns, filled only on the one merger row (Sale Price equal to Acquisition Price, LTCG 0, STCG 0); no tax columns; Acquisition Date and Price only on that merger row, entered as the Read Me says (§12), a non-taxable plan consolidation dated after 1 Apr 2016 whose successor lots carry the original dates and costs; no footer | the template round trip; derived prices labelled (`derived-prices`); `no-totals-row`; no `row-check-failed`; standard lots and one merger event (LD-8) |
| `cg-statement-mismatch` | built from the redemptions of `irr-a` by FIFO when M3's IRR fixture exists, then one scheme's lots altered | reconciliation with IRR-derived gains (AC-18) |
| `cg-statement-not-template` | a registrar-style layout (scheme, redemption date, amount, no units, no purchase date, no invested value) | refused, the missing required columns named (`no-header`) |
| `cg-statement-footer-mismatch` | `cg-statement` with one total off by ₹100, a subtotal row reading "Total" above the "Grand Total" row, and a last lot row whose Sale Date is invalid text | High `totals-mismatch` naming the column and the excluded lots; the "Grand Total" row taken as the totals row; the subtotal and the invalid row reported as excluded lots (`row-without-sale-date`), never footer |
| `cg-statement-bad-cells` | a text date and a text number (`invalid-cells`); a holding-days mismatch, a Sale Unit x Sale Price mismatch, a Sale Unit x Purchase Price mismatch, a Realized G/L off by ₹5, a purchase date after the sale date and a Sale Unit of 0 (`row-check-failed`, one count per check; no price derived on the Sale Unit 0 row); a non-zero Interest Earned and a non-zero Principal Repayment; a tag asset that differs; a row with amounts and no sale date between lot rows; a blank row and a repeated header between lots (`rows-skipped`); one lot of a client outside `family-a`, "Other Client Z" (Warning `clients-unmatched`; computed as its own person, listed under "clients not in the review", never in the family sum); the client labels "Sample Client A" and "S Client A" (`person-ambiguous`; "S Client A" is not a client of the review either, so it also counts towards `clients-unmatched`); a lot the test marks as held jointly (the analyst's mark of §9.3; `family-a` has no holder data and no shared folio) and a lot of a person the test marks as a minor (`assessee-flagged`); a lot whose acquisition columns match no class (`lot-class-other`); a Category Name not in the map (`category-unmapped`); a sale dated 2004-09-30 (`outside-rule-table`); a lot sold after the review's as-on date (`after-as-on-date`) | each Warning of §11 named here, with its count; valid rows unaffected |
| `cg-statement-other-family` | the clients "Other Client X" and "Other Client Y", which match none of `family-a`, and a Family Name other than the review's; no pair of labels in these fixtures is possibly one person except Sample Client A and S Client A | High `clients-unmatched`; Warning `family-differs` |

### 13.3 PAN-shaped tokens
The pre-push privacy scan blocks PAN-shaped strings in the repository (AC-21), so the generator holds **no PAN-shaped
literal**: it assembles each token at run time from a letter table and digits (for example by character codes), and
uses a different token per client. The tests then assert that no PAN-shaped string appears in the import record, the
model and the audit entries (`unit/ingest/capital-gains.test.ts`, M7), the generated workbook
(`exports/xlsx/tax-transactions.test.ts`, M7) and the deck (`acceptance/ac-20`, gate M9), each in the milestone that
builds it (§3).

### 13.4 Cases in `cg-statement`
Each case is built from its intended class and answer (units, prices, dates), so its expected term, cost for tax,
taxable gain and rule id are written into `cg-known-answers.json` by hand, independently of the engine.

The known answers are listed after the table. The lots use public SEBI category names in the platform's form, at least
one per group of §10.5a. Unless a case says otherwise, the person's surcharge is entered as 0% (or the year's maximum is
nil) and the slab rate is as stated.

| Case | Lots (expected rule, term and result) |
|---|---|
| Sheet and family | the sheet is named "Family A" and the Family Name column carries it (§13.1) |
| Equity, ordinary | short term; long term sold in FY 2019-20 (10%); long term sold after 23 Jul 2024 (12.5%) |
| Equity, FY 2024-25 split | KA-9: long-term gains sold before and after 23 Jul 2024 in the same year, together above ₹1.25 lakh, so the exemption order of §9.3 step 4 matters |
| Equity, grandfathered | KA-1 (sale above the value), KA-2a (sale below the value, above cost), KA-2b (sale below actual cost: a loss); a lot bought before 1 Feb 2018 whose actual cost is above the value, shown as `standard` (`grandfathering-value-not-supplied`); a lot bought in Jan 2018 with acquisition date 31 Jan 2018 and sold within 12 months after 1 Apr 2018 (EQ-ST-2 on actual cost, `grandfathered-value-ignored`); a lot bought in Mar 2000 and sold in FY 2019-20 (the dash, `cost-input-missing`) |
| Equity, before 2018 | KA-14: a short-term lot sold before 1 Apr 2008 (EQ-ST-1, 10%, cess 2%); a long-term lot sold before 1 Apr 2018 (exempt, EQ-LT-1) and one at a loss (ignored in set-off); a short-term lot sold in FY 2008-09 (15%) |
| Equity, 22 or 23 Jul 2024 | KA-14: short-term sales on 22 Jul 2024 (EQ-ST-2, 15%) and 23 Jul 2024 (EQ-ST-3, 20%) |
| Anniversaries | KA-7: a sale on the exact anniversary that the statement splits as long term (short term, `term-differs`, `anniversary-sale`, the long-term figure beside); a sale on the day after (long term in both, `anniversary-sale`); the 29 Feb 2024 purchase sold on 28 Feb 2025 and on 1 Mar 2025 |
| Same day | an equity lot bought and sold on one day: short term, 0 holding days, no row check fails |
| Debt before 11 Jul 2014 | KA-3a (the 10% leg lower) and KA-3b (the 20% indexed leg lower), with both figures in the known answers (`old-law-choice`); their two figures taken as one person-year give KA-19 (`rollup.test.ts` only); KA-3a's lot with an indexed-loss lot in the same year gives KA-20 (`rollup.test.ts` only) |
| Debt, 10 or 11 Jul 2014 | a non-equity lot held more than 12 and less than 36 months, sold on 10 Jul 2014 (NE-LT-1, long term) and on 11 Jul 2014 (NE-ST-2, short term) |
| Debt, 11 Jul 2014 to 22 Jul 2024 | held 13 to 36 months (short term, NE-ST-2); held 25 to 36 months and sold before 23 Jul 2024 (short term, NE-ST-2); KA-4: held more than 36 months with the statement's indexed acquisition price (2001 series, within tolerance, no `gain-differs`) |
| Debt before FY 2017-18, 2001-series price | KA-16: KA-3b's lot (sold in FY 2013-14, the 20% leg chosen) with the statement's 2001-series indexed price, the app on the 1981 series (`gain-differs`); an NE-LT-2 lot sold in FY 2015-16 (computed); one sold in FY 2016-17 (the dash, `rule-to-be-confirmed`); one sold on 1 Apr 2017 (NE-LT-3, the 2001 series) |
| Debt first held before the base year | a non-equity lot bought in FY 1999-2000 and sold in FY 2018-19 (NE-LT-3 from the FY 2001-02 index, statement's cost, `pre-base-year-cost`) |
| Debt after 23 Jul 2024 | bought before 1 Apr 2023, held more than 24 months (NE-LT-4, 12.5%) |
| Section 50AA | KA-5: (i) bought 1 Apr 2023, deemed short term (NE-50AA-2); (ii) bought 31 Mar 2023 (NE-LT-4); (iii) the (ii) lot sold on its 24-month anniversary (NE-ST-3, `anniversary-sale`, the long-term figure beside); a unit bought from 1 Apr 2023 and sold before 1 Apr 2025 (NE-50AA-1) |
| International fund of funds labelled Equity | KA-6 (a) and (b) (`tax-class-differs` on both); bought before 1 Apr 2023, sold after 23 Jul 2024, held more than 24 months (NE-LT-4, 12.5%) |
| Listed or unlisted from 23 Jul 2024 | a gold ETF (listed by its name) and a gold fund of funds (unlisted), both bought before 1 Apr 2023, held 13 to 23 months and sold after 23 Jul 2024: NE-LT-4L (12.5%) and NE-ST-3 (slab); a close-ended debt scheme, close-ended by the analyst's mark, bought before 1 Apr 2023, held 13 to 23 months and sold after 23 Jul 2024 without a listed flag (the dash, `listed-flag-missing`); a close-ended Specified debt scheme lot bought from 1 Apr 2023, held 13 to 23 months and sold between 23 Jul 2024 and 31 Mar 2025 without a listed flag (computed: NE-50AA-1 at slab, no `listed-flag-missing`) |
| Hybrids labelled Equity | an aggressive hybrid sold in FY 2024-25 (statement's classification, `tax-class-from-statement`); a balanced advantage fund, the same; a conservative hybrid bought from 1 Apr 2023 (Specified by the category map, `tax-class-differs`); one scheme whose class the analyst overrides (an audit entry); an aggressive hybrid sold in tax year 2026-27 (equity-oriented, `usual-bucket-default`); a multi-asset fund labelled Debt and bought from 1 Apr 2023 (the dash, `tax-class-not-set`, `specified-test-missing`) |
| Sectoral and thematic | a Thematic Funds lot classed equity-oriented by the category map (`category-default-to-confirm`, listed by scheme), then the same scheme set by the analyst to other non-equity for its year (an audit entry; the lot moves to the non-equity row of its dates) |
| ELSS | an ELSS lot sold after its lock-in (the EQ-LT row of its sale date); one sold inside the lock-in (`elss-early-sale`) |
| Funds of funds | lots of a scheme the analyst flags 90/90, sold in FY 2018-19 short term (EQ-FOF-1, slab) and long term (EQ-FOF-2, the dash, `rule-to-be-confirmed`), and one sold in FY 2017-18 within 36 months of purchase (other non-equity by TR-18, NE-ST-2, slab); a domestic fund of funds (Category Name "FoFs Domestic") labelled Equity, without the 90/90 flag and bought before 1 Apr 2023 (never equity-oriented on the label: the dash, `tax-class-not-set`) |
| Indexed cost shown on a short-term debt lot | the stated indexed price is ignored (`indexed-cost-ignored`) |
| Mergers | KA-8: a non-taxable event dated after 1 Apr 2016, its successor lots with the original purchase dates and costs (realised counted once, KA-15), and the `successor-reset` variant, which is its own merger event (another scheme pair and date); KA-17: a scheme merger dated before 1 Apr 2015 (taxable by default, `merger-taxable`, taxed as a sale on its date under its rule), with its successor lot carrying the original date and cost (`successor-not-reset`, computed as stated; re-based by the analyst in `lots.test.ts`); an event dated between 1 Apr 2015 and 31 Mar 2016 (non-taxable on the scheme-consolidation reading, then answered as a plan consolidation: taxable); an event answered as an investor switch, Regular to Direct (taxable); an event between two fund houses (`cross-house-merger`). In `cg-statement` only the KA-17 event has a successor lot carrying the original date; the other taxable events have no successor lots in the file, and no other lot of the same account shares a Purchase Date with a taxable event's merger rows. The KA-17 successor sold in two lots, with an unrelated scheme's lot bought on the same day, is in `lots.test.ts` only (KA-17) |
| Repeats | one sale event repeated twice, one three times, one four times, and one partly repeated; two genuine same-day lots with different units (not repeats); two genuine lots equal in every cell in one event, answered "as stated" for that event while another event is answered "once"; "apply to all" over the rest |
| Losses | KA-12 (a short-term loss beside slab-rate gains: slab 30%, slab 10%, slab not set giving the dash); KA-13 (the exemption tie); KA-18 (a short-term and a long-term loss in one year: long-term losses set off first) |
| Two persons | KA-10: two separate computations, never pooled |
| Partial coverage | KA-21 (`rollup.test.ts` and `tax-view.test.ts`, on exactly its lots): a person-year with a lot whose tax is the dash, PARTIAL, and the family sum PARTIAL; a person-year with the slab rate not set and a slab gain, PARTIAL. In `cg-statement`, every person-year holding a lot without a computable taxable gain is PARTIAL, recorded with its hand-worked totals |
| Surcharge and cess | KA-11 (the 15% cap, and 25% on the slab gain); cess at 2% (KA-14), 3% (KA-3a) and 4% (KA-4); a person-year with no surcharge entered ("before surcharge (rate not set)"); a new-regime person-year from FY 2023-24 whose entry is limited to 25%; a person-year from FY 2023-24 with the regime not entered and a surcharge entry above 25% (the entry held; "before surcharge (regime not set)") |
| Stripping candidate | a loss on a lot of an IDCW option held under 12 months and sold in FY 2019-20 (`stripping-candidate`, computed normally) |
| Year boundaries | sales on 31 Mar 2025 and 1 Apr 2025; sales on 31 Mar 2026 and 1 Apr 2026 (FY 2025-26 against Tax year 2026-27: EQ-LT-7 against EQ-LT-9, NE-50AA-2 against NE-50AA-3, and the "Sec 198 (old 112A)" and "Sec 76 (old 50AA)" labels) |
| Tax year 2026-27 | equity short term (EQ-ST-4) and long term (EQ-LT-9, the KA-8 successor) and one Specified lot (NE-50AA-3) sold after 1 Apr 2026 |
| Units and rounding | units with 1, 2 and 3 decimals; Sell Amount and Invested Value off the unit products by up to 3 paise (within tolerance, no Warning) |
| Accounts | a folio of the digits/digits form (91000002/12); Sample Client A's lots under "Sample Distributor 1", "2" and "3" (three accountIds, one per-person computation); every Account Name in the form "<name> - Held Away[PAN: <token>]" (accountLabel "<name>", accountNote "Held Away"), and one Account Name without the note (accountNote empty) |
| PAN | every Account Name carries a PAN-shaped token; the footer text holds another, counted as a footer removal |

#### Known answers (the content of `cg-known-answers.json`)

Synthetic values, computed by hand, independently of the engine: by the financial reviewer (KA-1 to KA-14; in the
re-review, KA-11's lots, KA-16 as revised, the KA-17 successor, KA-18 and the figures of KA-19; in the approval
review, KA-20, the KA-17 successor in two lots and the figures of KA-21 (a); in the second approval review, KA-22), by
the completeness reviewer (KA-15) and for the revisions (KA-17; KA-21 (b) and the family sum of KA-21 (a)). KA-9 to
KA-13 and KA-18 to KA-22 are person-year answers: each
holds only when the lots listed are the person's only lots in that year, so `rollup.test.ts` asserts each on exactly
its lots (the file lists them). In
`cg-statement`, where the cases share persons and years, the expected person-year totals are worked out by hand from
all the lots of each person-year and recorded separately in the same file; so are those of
`cg-statement-bad-cells`, where the client not in the review is its own person, outside the family sum (§9.3).
Answers are compared to ₹0.01 (§2.3) on the unrounded total: tax and cess are not rounded separately.

- **KA-1** Grandfathered, sale above the 31 Jan 2018 value (EQ-LT-6). Equity-oriented. Bought 15 Jun 2016: 1,000
  units at Rs 40.00 (Invested Rs 40,000.00). Acquisition Date 31 Jan 2018, Acquisition Price Rs 50.00. Sold 16 Jun
  2025 (FY 2025-26): 1,000 at Rs 80.00 (Rs 80,000.00). Long term; lot class grandfathered. Cost for tax 1,000 x
  max(40, min(50, 80)) = Rs 50,000.00. Taxable gain Rs 30,000.00; economic gain Rs 40,000.00. Tax before exemption
  12.5% = Rs 3,750.00.
- **KA-2a** Grandfathered, sale below the value but above cost (EQ-LT-2). Bought 10 Mar 2017: 500 at Rs 30.00
  (Rs 15,000.00). Acquisition 31 Jan 2018 at Rs 45.00. Sold 20 May 2019 (FY 2019-20): 500 at Rs 42.00
  (Rs 21,000.00). Cost for tax 500 x max(30, min(45, 42)) = Rs 21,000.00. Taxable gain Rs 0.00; economic gain
  Rs 6,000.00.
- **KA-2b** Grandfathered, sale below actual cost (EQ-LT-2). Same purchase and acquisition price as KA-2a. Sold
  22 Jun 2020 (FY 2020-21): 500 at Rs 25.00 (Rs 12,500.00). Cost for tax 500 x max(30, min(45, 25)) = Rs 15,000.00.
  Long-term loss of Rs 2,500.00, eligible for set-off; economic gain also minus Rs 2,500.00.
- **KA-3a** Old index series, NE-LT-1, the 10% leg is lower. Debt fund. Bought 1 Aug 2005 (FY 2005-06, CII 497):
  1,000 at Rs 10.00. Sold 3 Sep 2012 (FY 2012-13, CII 852): 1,000 at Rs 25.00 (Rs 25,000.00). Indexed cost
  10,000 x 852/497 = Rs 17,142.86; indexed gain Rs 7,857.14. 20% leg Rs 1,571.43; 10% leg on Rs 15,000 = Rs 1,500.00.
  Tax Rs 1,500.00. Surcharge nil (FY 2012-13); cess 3% Rs 45.00; total Rs 1,545.00.
- **KA-3b** Old index series, NE-LT-1, the 20% indexed leg is lower. Bought 15 Apr 2009 (FY 2009-10, CII 632): 1,000
  at Rs 10.00. Sold 15 May 2013 (FY 2013-14, CII 939): 1,000 at Rs 16.00. Indexed cost 10,000 x 939/632 =
  Rs 14,857.59; indexed gain Rs 1,142.41. 20% leg Rs 228.48; 10% leg Rs 600.00. Tax Rs 228.48.
- **KA-4** 2001 index series, NE-LT-3, indexed cost shown. Debt fund bought before 1 Apr 2023. Bought 11 Jun 2018
  (FY 2018-19, CII 280): 1,500 at Rs 20.00 (Rs 30,000.00); Acquisition Date 11 Jun 2018, Acquisition Price
  Rs 23.6429. Sold 16 Aug 2022 (FY 2022-23, CII 331): 1,500 at Rs 26.00 (Rs 39,000.00). Long term. The app's indexed
  cost 30,000 x 331/280 = Rs 35,464.29; taxable gain Rs 3,535.71; 20% = Rs 707.14; cess 4% Rs 28.29. The statement's
  1,500 x 23.6429 = Rs 35,464.35 is within tolerance, so no `gain-differs`.
- **KA-5** Section 50AA, debt fund still Specified after the 2025 switch. (i) Bought 1 Apr 2023: 1,000 at Rs 100.00.
  Sold 15 Apr 2025 at Rs 116.00. NE-50AA-2: deemed short term although held more than 24 months. Taxable
  Rs 16,000.00 at slab: the dash with the slab rate unset; Rs 4,800.00 at 30%. (ii) Same units and prices bought
  31 Mar 2023 and sold 15 Apr 2025: NE-LT-4, long term (after the 24-month anniversary of 31 Mar 2025), 12.5% =
  Rs 2,000.00. (iii) The (ii) lot sold on 31 Mar 2025: NE-ST-3, short term at slab, flagged as an anniversary-day
  sale, with Rs 2,000.00 shown as the long-term alternative.
- **KA-6** The 2025 Specified switch, international fund of funds labelled Equity. Bought 10 Apr 2023: 800 at
  Rs 25.00. (a) 400 sold 28 Mar 2025 (FY 2024-25) at Rs 30.00: Specified under the 35% test, NE-50AA-1, gain
  Rs 2,000.00 at slab. (b) 400 sold 12 May 2025 (FY 2025-26) at Rs 32.00: other non-equity, unlisted, long term
  (after 10 Apr 2025), NE-LT-4, gain Rs 2,800.00 x 12.5% = Rs 350.00. Both lots raise `tax-class-differs`.
- **KA-7** Anniversary. Equity. Bought 17 Sep 2024: 1,000 at Rs 50.00. Sold 17 Sep 2025 at Rs 60.00: short term
  (OD-2), EQ-ST-3, Rs 10,000.00 x 20% = Rs 2,000.00, flagged. The statement shows it as LTCG, so `term-differs` is
  raised; the long-term alternative is EQ-LT-7, Rs 1,250.00 before exemption. Sold 18 Sep 2025 instead: long term,
  EQ-LT-7, Rs 1,250.00 before exemption (flagged as the day after). A 29 Feb 2024 purchase: sold 28 Feb 2025 is short
  term (EQ-ST-3); sold 1 Mar 2025 long term (EQ-LT-7).
- **KA-8** Merger and successor. Scheme M (equity) bought 1 Jul 2019: 2,000 at Rs 15.00 (Rs 30,000.00). Merger row
  10 Nov 2023: 2,000 at Rs 22.00 (Rs 44,000.00); Acquisition Date 10 Nov 2023, Acquisition Price Rs 22.00, LTCG 0,
  STCG 0, Realized Rs 14,000.00. Result: `non-taxable-transfer`, taxable Rs 0.00, Rs 14,000.00 in the non-taxable
  line. Successor scheme N: 1,000 units, Purchase Date 1 Jul 2019, Rs 30.00 (Rs 30,000.00), sold 4 May 2026 (tax year
  2026-27) at Rs 50.00: long term, EQ-LT-9 "Sec 198 (old 112A)", taxable Rs 20,000.00, Rs 2,500.00 before exemption.
  Successor-reset variant, its own merger event (scheme M2 into N2, the same purchase, units and prices as M, the
  merger row dated 13 Nov 2023; successor Purchase Date 13 Nov 2023, 1,000 units at Rs 44.00, sold 3 Jun 2024 at
  Rs 50.00): Warning `successor-reset` raised; as stated, EQ-ST-2 15% x Rs 6,000.00 = Rs 900.00, and the event keeps
  its realised gain of Rs 14,000.00; with the original date and cost (1 Jul 2019, Rs 30,000.00) that the analyst sets,
  it is EQ-LT-5 10% x Rs 20,000.00 = Rs 2,000.00 before exemption, the lot no longer counts as reset, and the event's
  Rs 14,000.00 returns to the non-taxable line.
- **KA-9** FY 2024-25 split exemption (the person's only lots that year). Lot P: bought 10 May 2022, 1,000 at
  Rs 100.00, sold 14 Jun 2024 at Rs 180.00, EQ-LT-5, Rs 80,000.00 at 10%. Lot Q: bought 10 May 2022, 1,000 at
  Rs 100.00, sold 16 Dec 2024 at Rs 190.00, EQ-LT-7, Rs 90,000.00 at 12.5%. One exemption of Rs 1,25,000. Default
  order (LD-10, TR-2: the 12.5% gains first): Rs 45,000.00 at 10% = Rs 4,500.00; with cess Rs 4,680.00. The other
  order, shown in a note (the 10% gains first): Rs 45,000.00 at 12.5% = Rs 5,625.00; with cess Rs 5,850.00.
  Difference Rs 1,125.00, within the most the two orders can differ, Rs 1,25,000 x 2.5 points = Rs 3,125.
- **KA-10** Two persons, FY 2025-26 (each person's only lots that year). Client A: bought 5 Apr 2021, 2,000 at
  Rs 100.00, sold 11 Aug 2025 at Rs 175.00, EQ-LT-7, gain Rs 1,50,000.00; (1,50,000 - 1,25,000) x 12.5% =
  Rs 3,125.00; cess Rs 125.00; total Rs 3,250.00. Client B: bought 5 Apr 2021, 1,000 at Rs 100.00, sold 11 Aug 2025
  at Rs 240.00, gain Rs 1,40,000.00; tax Rs 1,875.00; total Rs 1,950.00. Family view, as a sum of separate
  computations: Rs 5,000.00 tax (Rs 5,200.00 with cess). Pooling the family (wrong) would give Rs 20,625.00.
- **KA-11** Surcharge cap (rollup unit test). One person in FY 2025-26 whose only lots are KA-10 Client A's lot
  (EQ-LT-7, gain Rs 1,50,000.00) and KA-5(i)'s lot (NE-50AA-2, gain Rs 16,000.00); surcharge entered as 25% (within
  the maximum of either regime), either regime, slab 30%. s.112A tax Rs 3,125.00, surcharge capped at 15% = Rs 468.75. Specified gain Rs 16,000.00 at slab
  = Rs 4,800.00, surcharge 25% = Rs 1,200.00. Total surcharge Rs 1,668.75. Cess 4% on Rs 9,593.75 = Rs 383.75. Total
  Rs 9,977.50.
- **KA-12** Short-term loss next to slab gains (the person's only lots in FY 2023-24). Equity bought 2 May 2023,
  1,000 at Rs 150.00, sold 1 Nov 2023 at Rs 100.00: short-term loss of Rs 50,000.00 (EQ-ST-2). Specified debt bought
  3 Apr 2023, 8,000 at Rs 100.00, sold 1 Feb 2024 at Rs 110.00: Rs 80,000.00 at slab (NE-50AA-1). Equity bought
  2 May 2023, 1,000 at Rs 100.00, sold 1 Nov 2023 at Rs 130.00: Rs 30,000.00 at 15%. At slab 30%, the loss goes
  against the slab gain first: Rs 9,000.00 + Rs 4,500.00 = Rs 13,500.00. At slab 10%, the loss goes against the 15%
  gain first and the rest against the slab gain: Rs 60,000 x 10% = Rs 6,000.00. Slab rate unset: the person's
  taxable amounts after set-off and their tax are the dash with "slab rate not set" (§9.3 step 3, LD-3).
- **KA-13** Long-term loss and the exemption tie (the person's only lots in FY 2024-25, all sold 2 Sep 2024). Equity
  bought 1 Jun 2022, 1,000 at Rs 200.00, sold at Rs 100.00: long-term loss of Rs 1,00,000.00 (EQ-LT-7). Debt bought
  1 Jun 2021, 10,000 at Rs 10.00, sold at Rs 20.00: Rs 1,00,000.00 (NE-LT-4, 12.5%). Equity bought 1 Jun 2022, 1,000
  at Rs 100.00, sold at Rs 200.00: Rs 1,00,000.00 (EQ-LT-7). TR-10 sets the loss against the debt gain; the equity
  gain falls within the exemption. Tax Rs 0.00. Setting the loss against the equity gain instead would give
  Rs 12,500.00.
- **KA-14** Cess at 2% and the boundaries. Equity bought 2 May 2005, 1,000 at Rs 20.00, sold 1 Dec 2005 at Rs 25.00:
  EQ-ST-1, Rs 5,000.00 x 10% = Rs 500.00; cess 2% Rs 10.00; total Rs 510.00. Equity bought 2 Jan 2017 and sold
  15 Mar 2018: EQ-LT-1, goes to the exempt line (a loss on it is ignored in set-off). Short-term equity sold 22 Jul
  2024: EQ-ST-2 at 15%; sold 23 Jul 2024: EQ-ST-3 at 20%.
- **KA-15** Merger counted once. A lot bought at 100, merged at 150 (a non-taxable event) and its successor sold at
  180: the realised gain is 80, counted once. With the original cost carried, the merger row's 50 stays in the
  non-taxable line and the successor's 80 is realised; with a `successor-reset` lot (cost 150), the merger row keeps
  its 50 and the successor's 30 is added. The correct taxable gain is 80 on the original holding period; with the
  reset cost it is 30, understated by 50, and the term may become short.
- **KA-16** Index series, on a lot whose 20% leg is chosen. KA-3b's lot (bought 15 Apr 2009, 1,000 at Rs 10.00; sold
  15 May 2013 at Rs 16.00, Rs 16,000.00) with Acquisition Date 15 Apr 2009 and a 2001-series Acquisition Price of
  Rs 14.8649 (10 x 220/148, rounded to four places), so `indexed-cost-shown`; the statement's LTCG is Rs 1,135.14
  (16,000 minus the indexed cost 10,000 x 220/148 = Rs 14,864.86). The app, on the 1981 series, chooses the 20% leg:
  indexed cost Rs 14,857.59, gain Rs 1,142.41, the gain compared (§9.3 step 1). The difference of Rs 7.27 is above the
  tolerance of Rs 1.60 (0.01% of Sell Amount, above ₹1), so `gain-differs` is raised. (KA-3a's lot is not used here:
  its 10% leg is chosen, so its comparison would differ for another reason.)
- **KA-17** A merger before the date gate (written for this revision, by hand). A debt scheme bought 1 Jun 2012:
  1,000 units at Rs 10.00 (Rs 10,000.00). Merger row 15 Jan 2015 (FY 2014-15): 1,000 at Rs 12.00 (Rs 12,000.00);
  Acquisition Date 15 Jan 2015, Acquisition Price Rs 12.00, LTCG 0, STCG 0. Before 2015-04-01, so `taxable-transfer`
  by default with the Warning `merger-taxable`: a sale on 15 Jan 2015 on or before the 36-month anniversary
  (1 Jun 2015), NE-ST-2, taxable Rs 2,000.00 at slab: the dash with the slab rate unset; at 30% (surcharge 0%) tax
  Rs 600.00, cess 3% Rs 18.00, total Rs 618.00. Its successor (a lot of the same account in the successor scheme):
  1,000 units with Purchase Date 1 Jun 2012 and Invested Value Rs 10,000.00, the original date and cost, sold 2 Jun
  2025 (FY 2025-26) at Rs 15.00 (Rs 15,000.00). As stated: Warning `successor-not-reset`, gain Rs 5,000.00, of which
  Rs 2,000.00 (the merger gain) is named as counted twice; realised over the two years Rs 7,000.00 against an economic
  gain of Rs 5,000.00; NE-LT-4 (unlisted, bought before 1 Apr 2023, held more than 24 months), Rs 5,000.00 x 12.5% =
  Rs 625.00. Re-based by the analyst (purchase 15 Jan 2015, cost S x V / W = 12,000 x 10,000 / 10,000 =
  Rs 12,000.00, an audit entry): gain Rs 3,000.00, NE-LT-4, Rs 375.00; realised total Rs 5,000.00 (Rs 2,000.00 in
  FY 2014-15 and Rs 3,000.00 in FY 2025-26). Successor in two lots (`lots.test.ts` only; written by the financial
  approval review): the same successor sold as 600 units (Invested Value Rs 6,000.00, Sell Amount Rs 9,000.00) and
  400 units (Rs 4,000.00, Rs 6,000.00), both on 2 Jun 2025. Re-based costs Rs 7,200.00 and Rs 4,800.00, gains
  Rs 1,800.00 and Rs 1,200.00; as stated, the amounts counted twice are Rs 1,200.00 and Rs 800.00. A lot of an
  unrelated scheme in the same account bought on 1 Jun 2012 and sold after the event (an SIP instalment) is listed as
  a candidate by `successor-not-reset` but not re-based.
- **KA-18** Loss order (written by the financial re-review, by hand; the person's only lots in FY 2023-24, surcharge
  0%, cess 4%). (1) Equity bought 2 May 2023, 1,000 at Rs 150.00, sold 1 Nov 2023 at Rs 100.00: short-term loss of
  Rs 50,000.00 (EQ-ST-2). (2) Equity bought 1 Jun 2021, 1,000 at Rs 200.00, sold 1 Dec 2023 at Rs 150.00: long-term
  loss of Rs 50,000.00 (EQ-LT-3). (3) Debt bought 1 Jun 2020 (CII 301), 301 units at Rs 100.00 (Rs 30,100.00), Sell
  Amount Rs 84,800.00 on 1 Dec 2023 (CII 348): indexed cost Rs 34,800.00, gain Rs 50,000.00 at 20% (NE-LT-3).
  (4) Equity bought 2 May 2023, 1,000 at Rs 100.00, sold 1 Nov 2023 at Rs 150.00: Rs 50,000.00 at 15% (EQ-ST-2).
  Long-term losses first (TR-10): the long-term loss absorbs the 20% gain and the short-term loss the 15% gain; tax
  Rs 0.00, nothing unabsorbed. The other order (short-term first), shown only to explain: the short-term loss absorbs
  the 20% gain, the long-term loss finds no long-term gain left, tax Rs 7,500.00 + cess Rs 300.00 = Rs 7,800.00, with
  Rs 50,000.00 of long-term loss unabsorbed. No slab rate is needed.
- **KA-19** NE-LT-1 per lot against the year's total (`rollup.test.ts` only: the figures of KA-3a and KA-3b given to
  the roll-up as two lots of one person-year). 20% legs Rs 1,571.43 and Rs 228.48; 10% legs Rs 1,500.00 and Rs 600.00.
  Per lot (the app, LD-15): Rs 1,500.00 + Rs 228.48 = Rs 1,728.48. On the year's total, shown beside (§9.3 step 8):
  min(Rs 1,799.91, Rs 2,100.00) = Rs 1,799.91, higher by Rs 71.43.
- **KA-20** NE-LT-1 with a loss in the year (written by the financial approval review, by hand; `rollup.test.ts`
  only: the person's only lots in FY 2012-13, surcharge nil, cess 3%). Lot A is KA-3a's lot: the 10% leg, gain
  Rs 15,000.00. Lot B, another debt scheme: 1,000 units bought 1 Aug 2005 at Rs 10.00 and sold 3 Sep 2012 at Rs 9.00
  (Rs 9,000.00). Its indexed cost is Rs 17,142.86, so its legs are minus Rs 1,628.57 (20% of an indexed loss of
  Rs 8,142.86) and minus Rs 100.00 (10% of a loss of Rs 1,000.00): lot B takes the 20% leg and brings its indexed loss
  of Rs 8,142.86 to set-off. Per lot (the app): Rs 15,000.00 minus Rs 8,142.86 = Rs 6,857.14 at 10% = Rs 685.71, cess
  Rs 20.57, total Rs 706.29 (unrounded Rs 706.2857). The year's-total figure (§9.3 step 8):
  with every NE-LT-1 lot on its 20% leg the indexed net is minus Rs 285.71 and the tax Rs 0.00; on its 10% leg the
  unindexed net is Rs 14,000.00 and the tax Rs 1,400.00; the lower, Rs 0.00, is shown beside, lower than the per-lot
  figure. Had lot B taken the 10% leg, it would bring only Rs 1,000.00 to set-off: tax Rs 1,400.00, total
  Rs 1,442.00.
- **KA-21** Partial coverage (`rollup.test.ts` and `tax-view.test.ts`; FY 2025-26, surcharge 0%, cess 4%). (a) One
  person whose only lots are KA-10 Client A's lot (EQ-LT-7, gain Rs 1,50,000.00) and a lot of a domestic fund of
  funds (Category Name "FoFs Domestic") labelled Equity, without the 90/90 flag: bought 5 Apr 2021, 1,000 units at
  Rs 100.00, sold 11 Aug 2025 at Rs 120.00, economic gain Rs 20,000.00, tax the dash (`tax-class-not-set`: its rate
  and its share of the exemption depend on the class). The person's figures: tax Rs 3,125.00, cess Rs 125.00, total
  Rs 3,250.00, PARTIAL COVERAGE, footnote "1 lot not computed, economic gain Rs 20,000.00". With KA-10 Client B beside (computed in full,
  total Rs 1,950.00), the family sum is Rs 5,000.00 of tax, Rs 5,200.00 with cess, PARTIAL. (b) KA-11's lots
  (EQ-LT-7, gain Rs 1,50,000.00; NE-50AA-2, gain Rs 16,000.00 at slab) with the slab rate not set and surcharge 0%:
  tax Rs 3,125.00, cess Rs 125.00, total Rs 3,250.00, PARTIAL, the slab bucket of Rs 16,000.00 left out with "slab
  rate not set" (no loss, so step 3 does not make the figures the dash).
- **KA-22** NE-LT-1 beside a short-term equity loss (written by the financial second approval review, by hand;
  `rollup.test.ts` only: the person's only lots in FY 2012-13, surcharge nil, cess 3%). (1) Equity bought 1 Mar 2012,
  1,000 at Rs 50.00, sold 1 Aug 2012 at Rs 60.00: EQ-ST-2, gain Rs 10,000.00. (2) Equity bought 1 Mar 2012, 1,000 at
  Rs 50.00, sold 1 Aug 2012 at Rs 45.00: EQ-ST-2, loss Rs 5,000.00. (3) Debt bought 1 Aug 2005, 1,000 at Rs 10.00,
  sold 3 Sep 2012 at Rs 24.30 (Rs 24,300.00), NE-LT-1: indexed cost Rs 17,142.86, so the 20% leg is Rs 1,431.43 on
  Rs 7,157.14 and the 10% leg Rs 1,430.00 on Rs 14,300.00; the 10% leg is taken. Per lot (the app): the short-term
  loss goes to the 15% gain, Rs 750.00 + Rs 1,430.00 = Rs 2,180.00, cess Rs 65.40, total Rs 2,245.40. The year's-total
  figure (§9.3 step 8): with the NE-LT-1 lot on its 20% leg the loss goes to the 20% gain first, (Rs 7,157.14 minus
  Rs 5,000.00) x 20% + Rs 1,500.00 = Rs 1,931.43 (Rs 1,989.37 with cess); on its 10% leg Rs 2,180.00; the lower,
  Rs 1,931.43, is shown beside, lower than the per-lot figure.

## 14. Tests for M7 (additions to `08-regression-test-plan.md`)
- `tests/unit/ingest/capital-gains.test.ts` (M7): each fixture of §13.2 gives its expected import record; header
  matching; the totals row, the excluded lots and the footer; tag parsing and the Account Name split; row checks;
  the repeated-rows questions per sale event (unanswered, as stated, once, "apply to all"); the PAN assertions on the
  import record, the model and the audit entries (§3); "Sample Client A" and "Sample Client B" never raise
  `person-ambiguous`.
- `tests/unit/tax/rules.test.ts` (M7): every rate row of §10.1 by its boundary dates (the day before, the day, the
  day after); every valid key (§9.1) of tax class, listed flag and sub-type, for every date from 1 Oct 2004, maps to
  exactly one rate row, and the checks (EQ-ELSS-1) never count as one; the three listed-flag-missing cases (the
  unlisted row, its id labelled "listed flag missing; same figures either way", where the term is the same either way;
  a row marked neither; no row, the dash, where the rule depends on the flag); the key (equity-oriented, 90/90, sale
  before 2018-04-01) is never produced, and the other invalid combinations are refused at input; both CII series, with the
  base-year floor; the category map of §10.5a (every key maps to exactly one fund type or to "no default"; an unknown
  name maps to nothing); the cess and the surcharge maximum by year; and every rule id that the coverage table below
  assigns to this file.
- `tests/unit/tax/lots.test.ts` (M7): the per-lot known answers KA-1 to KA-8 and KA-14 to KA-17 (the KA-17
  successor both as stated, with `successor-not-reset` and the amount counted twice, and re-based by the analyst; the
  successor in two lots, re-based costs Rs 7,200.00 and Rs 4,800.00, gains Rs 1,800.00 and Rs 1,200.00, amounts counted
  twice Rs 1,200.00 and Rs 800.00, and the unrelated same-day SIP lot listed but not re-based); each lot class; the merger date gates and the three answers; `successor-reset` only after a non-taxable event and
  `successor-not-reset` only after a taxable one; the 31 Jan 2018 value used only under its rules; the tax class,
  listed flag and sub-type of §9.1 (the Sectoral and Thematic default with `category-default-to-confirm`; a fund of
  funds labelled Equity without the 90/90 flag never equity-oriented; a 90/90 lot sold in FY 2017-18 other
  non-equity; an analyst's equity-oriented class on a fund of funds refused for an FY 2017-18 sale, and giving
  EQ-FOF-1 (slab) for an FY 2018-19 short-term sale; with the 90/90 flag cleared, the analyst's equity-oriented class
  for FY 2019-20 and other non-equity class for FY 2021-22, on lots bought 1 Jun 2018 and sold 1 Aug 2019 and
  1 Aug 2021, giving EQ-LT-3 and NE-LT-3; the listed-flag dash only where the rule depends on the flag); an NE-LT-1
  lot with equal positive figures taking the 20% leg (1,000 units bought 1 Aug 2005 at Rs 4.97 and sold 3 Sep 2012 at
  Rs 12.07: Rs 710.00 on both legs, gain Rs 3,550.00 taken, not Rs 7,100.00); each analyst mark changes the result as
  §5, §9.1 and §9.3 say (the gift or inheritance mark, the close-ended mark, the minor, HUF, joint-holder or
  non-resident mark, the original date and cost of a `successor-reset` lot, the re-base of a `successor-not-reset`
  lot); the KA-8 reset lot given its original date and cost gives EQ-LT-5, Rs 2,000.00; and every rule id that the
  coverage table below assigns to this file.
- `tests/unit/tax/rollup.test.ts` (M7): the person-year known answers KA-9 to KA-13 and KA-18 to KA-22 on exactly
  their lots, and KA-15 (the realised and nonTaxable lines); KA-20 (per lot Rs 685.71, total Rs 706.29; the year's
  total Rs 0.00; lot B on the 20% leg); KA-22 (per lot Rs 2,180.00, total Rs 2,245.40; the year's-total figure
  Rs 1,931.43, Rs 1,989.37 with cess); KA-21 (the PARTIAL
  person-year, Rs 3,250.00 with 1 lot not computed, and the PARTIAL family sum; the PARTIAL total while the slab rate
  is not set); long-term losses set off before short-term losses; the
  set-off ranking with the exemption at 0% and the tie rule; the FY 2024-25 order and its note; slab rate unset gives
  the dash; surcharge not entered gives "before surcharge"; from FY 2023-24 with the regime not entered, an entry above
  25% held and "before surcharge (regime not set)"; the surcharge maximum by year and regime (a new-regime entry
  limited to 25%); the 15% cap; cess by year; the anniversary alternative; NE-LT-1 per lot, with the year's-total
  figure beside (KA-19, KA-20, KA-22); a client not in the review computed as its own person and left out of the family sum; and
  every rule id that the coverage table below assigns to this file.
- `tests/unit/views/cg-import.test.ts` (M7, U-71): the import report lists the columns used and ignored, the PAN
  removals (cells and footer), the footer rows skipped, the reconciliation per column and the lot classes; the
  repeats questions answered both ways, per event and with "apply to all", each with its audit entry; each merger
  event given one of the three answers; the blank template download.
- `tests/unit/views/tax-view.test.ts` (M7, U-72): the as-on financial year and the one before by default; any year
  in the file selectable; the slab rate, surcharge rate and regime per person and year, and a surcharge entry above
  25% held while the regime is not entered ("before surcharge (regime not set)"); the per-scheme class, listed flag
  and 90/90 flag set by the analyst as audit entries; per lot, the gift or inheritance mark and, on a
  `successor-reset` lot, the original purchase date and cost, and on a `successor-not-reset` lot, the re-base to the
  event date and the merger value; per scheme, the close-ended mark; per person or lot, the minor, HUF, joint-holder
  or non-resident mark; each an audit entry; the rule-table date and the rule ids shown; the statement's split beside
  the app's; INSUFFICIENT EVIDENCE for a year with an unanswered repeat event; a PARTIAL person-year shown with the
  "p" marker and its footnote, never as a complete total (KA-21: "1 lot not computed, economic gain Rs 20,000.00"),
  and the family sum PARTIAL; "resident individual assumed".
- `tests/integration/realised-gains-reconcile.test.ts` (M7, E-141): `cg-statement-mismatch` against `irr-a` raises
  the High result and shows both figures; non-taxable transfers are left out of the realised side.
- `tests/exports/xlsx/cg-template.test.ts` (M7, E-156): the 29 headers in export order; the `dd-mmm-yyyy`,
  `#,##0.00` and `#,##0.000` formats; the frozen header; the Read Me rows, the merger instruction included; no data
  rows.
- `tests/exports/xlsx/tax-transactions.test.ts` (M7): the Tax and Transactions sheet shows the rule set and holds no
  PAN-shaped string with `cg-statement` loaded.
- `tests/acceptance/ac-18-incomplete-tax.test.ts` (M7): the statement cases already listed there, plus `cg-statement`
  with a repeats question unanswered.
- `tests/acceptance/ac-20-pptx-editability.test.ts` (gate M9): "no stale client data" extended: with `cg-statement`
  loaded, no PAN-shaped string anywhere in the deck.
- **Validation results by id.** `cg-known-answers.json` holds, for each fixture, the expected validation results by
  rule id, with severity and count; `capital-gains.test.ts` runs the reader and `engine/tax/` over each fixture,
  without and then with the fixture's recorded analyst inputs (§13.1), and compares both sets exactly, and a coverage
  assertion fails when any rule id of §11 appears in no fixture's expected
  results. The table below is that coverage.
- Both time zones (`TZ=Asia/Kolkata`, `TZ=UTC`), as every test.

| Rule id (`capital-gains.`) | Fixture (case of §13.4, or §13.2) | Test (`tests/unit/`) |
|---|---|---|
| `no-header` | `cg-statement-not-template` | `ingest/capital-gains` |
| `duplicate-column` | `cg-statement-duplicate-column` | `ingest/capital-gains` |
| `no-lots` | `cg-template-blank` | `ingest/capital-gains` |
| `repeats-question` | `cg-statement` (Repeats) | `ingest/capital-gains`, `views/cg-import`; AC-18 |
| `totals-mismatch` | `cg-statement-footer-mismatch` | `ingest/capital-gains` |
| `non-taxable-transfers` | `cg-statement` (Mergers); `cg-template-filled` | `tax/lots`, `views/cg-import` |
| `clients-unmatched` | High: `cg-statement-other-family`; Warning: `cg-statement-bad-cells` | `ingest/capital-gains`, `tax/rollup` (an unmatched client computed as its own person, never in the family sum); AC-18 |
| `family-differs` | `cg-statement-other-family` | `ingest/capital-gains` |
| `row-without-sale-date` | `cg-statement-bad-cells`, `cg-statement-footer-mismatch` | `ingest/capital-gains` |
| `invalid-cells` | `cg-statement-bad-cells` | `ingest/capital-gains` |
| `row-check-failed` | `cg-statement-bad-cells` (each check) | `ingest/capital-gains` |
| `nonzero-principal-or-interest` | `cg-statement-bad-cells` | `ingest/capital-gains` |
| `tag-asset-differs` | `cg-statement-bad-cells` | `ingest/capital-gains` |
| `person-ambiguous` | `cg-statement-bad-cells` | `ingest/capital-gains` |
| `assessee-flagged` | `cg-statement-bad-cells` | `tax/lots` |
| `lot-class-other` | `cg-statement-bad-cells` | `tax/lots` |
| `merger-taxable` | `cg-statement` (Mergers, before 1 Apr 2015) | `tax/lots` |
| `cross-house-merger` | `cg-statement` (Mergers, two fund houses) | `tax/lots` |
| `successor-reset` | `cg-statement` (Mergers, KA-8 variant) | `tax/lots` |
| `successor-not-reset` | `cg-statement` (Mergers, KA-17 successor) | `tax/lots` |
| `cost-input-missing` | `cg-statement` (Equity, grandfathered, bought Mar 2000) | `tax/lots` |
| `category-unmapped` | `cg-statement-bad-cells` | `tax/lots`, `tax/rules` |
| `category-default-to-confirm` | `cg-statement` (Sectoral and thematic) | `tax/lots` |
| `usual-bucket-default` | `cg-statement` (Hybrids labelled Equity) | `tax/lots` |
| `tax-class-from-statement` | `cg-statement` (Hybrids labelled Equity) | `tax/lots` |
| `tax-class-not-set` | `cg-statement` (Hybrids labelled Equity, multi-asset; Funds of funds, the domestic fund of funds labelled Equity) | `tax/lots` |
| `specified-test-missing` | `cg-statement` (Hybrids labelled Equity, multi-asset) | `tax/lots` |
| `listed-flag-missing` | `cg-statement` (Listed or unlisted) | `tax/lots` |
| `tax-class-differs` | `cg-statement` (International fund of funds; Hybrids) | `tax/lots` |
| `term-differs` | `cg-statement` (Anniversaries) | `tax/lots` |
| `anniversary-sale` | `cg-statement` (Anniversaries; Section 50AA) | `tax/lots`, `tax/rollup` |
| `after-as-on-date` | `cg-statement-bad-cells` | `tax/lots` |
| `elss-early-sale` | `cg-statement` (ELSS) | `tax/lots` |
| `gain-differs` | `cg-statement` (Debt before FY 2017-18, KA-16) | `tax/lots` |
| `stripping-candidate` | `cg-statement` (Stripping candidate) | `tax/lots` |
| `rule-to-be-confirmed` | `cg-statement` (Debt before FY 2017-18, FY 2016-17 lot; Funds of funds, EQ-FOF-2) | `tax/rules`, `tax/lots` |
| `outside-rule-table` | `cg-statement-bad-cells` | `tax/lots` |
| `sheet-used` | `cg-statement`, `cg-statement-reordered` | `ingest/capital-gains` |
| `columns-ignored` | `cg-statement-reordered` | `ingest/capital-gains` |
| `pan-removed` | `cg-statement` (PAN) | `ingest/capital-gains`, `views/cg-import` |
| `rows-skipped` | `cg-statement-bad-cells` | `ingest/capital-gains` |
| `footer-skipped` | `cg-statement` | `ingest/capital-gains` |
| `totals-reconciled` | `cg-statement` | `ingest/capital-gains` |
| `no-totals-row` | `cg-template-filled` | `ingest/capital-gains` |
| `stated-tax-columns-empty` | `cg-statement` | `ingest/capital-gains` |
| `lot-classes` | `cg-statement` | `ingest/capital-gains`, `views/cg-import` |
| `derived-prices` | `cg-template-filled` | `ingest/capital-gains` |
| `indexed-cost-ignored` | `cg-statement` (Indexed cost shown on a short-term debt lot) | `tax/lots` |
| `grandfathered-value-ignored` | `cg-statement` (Equity, grandfathered, short term) | `tax/lots` |
| `grandfathering-value-not-supplied` | `cg-statement` (Equity, grandfathered, `standard`) | `tax/lots` |
| `pre-base-year-cost` | `cg-statement` (Debt first held before the base year) | `tax/lots` |
| `old-law-choice` | `cg-statement` (Debt before 11 Jul 2014) | `tax/lots`, `tax/rollup` |
| `xirr-not-used` | `cg-statement` | `ingest/capital-gains` |

## 15. Open items
- **Approval.** §10 and the design, as revised on 27 Oct 2026, were approved by the financial-domain reviewer on 27 Oct 2026 (§10.10); M7 code may
  start on them. The items below stay open.
- **Owner items.** Questions for the owner, with a recommendation: this design does not decide items 1 to 5, and
  items 6 and 7 are lead decisions applied meanwhile, for the owner to confirm:

| # | Item | Recommendation |
|---|---|---|
| 1 | OD-17 and OD-2 amendment: realised lots, and later the unrealised and harvesting views (E-41 to E-43, so that one scheme is never in two tax buckets on two screens), follow the dated statutory rule table of §10 (three buckets by year; 24 months for unlisted non-equity units; Specified units never long term) instead of OD-17's equity-share bands and OD-2's single 12-month test (`DATA_DICTIONARY.md` §7, "Long-term holding") | accept |
| 2 | Anniversary-day sales: keep OD-2 (short term), with the long-term figure shown beside each such lot (TR-1), or follow the Delhi High Court (2012) and the ITAT Mumbai bench (2024), whose reading the platform's export also takes | keep OD-2 until the tax adviser answers |
| 3 | PAN-based person grouping: may the reader number the distinct PANs within one file (Person 1..n) in memory only, the PAN itself discarded at once and never stored, logged or exported, so that one person spelt two ways shares one exemption and two people with one name are kept apart? | yes |
| 4 | For the tax adviser: the gazette or department copy of the FY 2016-17 index in the 1981 series (secondary sources give 1125; until then FY 2016-17 NE-LT-2 sales show the dash); and whether the old-law choice between 20% with indexation and 10% without (NE-LT-1) is made per lot or on the year's total, and whether the choice is made before or after set-off (KA-20), and which gain then enters set-off (the app chooses per lot, on signed amounts, before set-off meanwhile, LD-15, LD-33, LD-40: the per-asset reading; the year's-total figure is shown beside it; which is lower depends on the year's losses, KA-19, KA-20, KA-22) | ask the tax adviser |
| 5 | Ask the platform's support whether its export repeats lot rows by design (§6) | ask |
| 6 | A lead decision for the owner to confirm (LD-10, LD-31): in FY 2024-25 the single ₹1,25,000 exemption is applied first to the 12.5% gains, the order more favourable to the client and consistent with set-off, with the other order's figure in a note and both labelled "order not set by the Act" (TR-2, KA-9) | confirm |
| 7 | A lead decision for the owner to confirm (LD-11, LD-31): from tax year 2026-27, aggressive hybrid, arbitrage and equity savings funds default to equity-oriented, the usual bucket of the owner's reckoner, labelled "usual bucket per the owner's reckoner; confirm with the fund house" with the Warning `usual-bucket-default` (this changes their lots from "no default" to equity-oriented; TR-7) | confirm |

- **The reviewer's open items of §10.9**, ranked: the FY 2016-17 index (item 4); the FY 2024-25 exemption order, now
  the taxpayer-favourable one with the other shown (TR-2); the reckoner states dividend stripping without the
  exempt-income condition of s.175(8)(c), for the owner to note (TR-21); the "listed" flag for close-ended schemes
  (TR-16); fund of funds of equity ETFs sold in FY 2018-19 (EQ-FOF-2).
- The analysts try the blank template in M7 (roadmap risk "template slow to fill").
- **Follow-up for the rule bank's owner** (like DS-C8, a dated Phase 0 record left as it is): key the rule bank's §2
  inputs row for `tax.exemptionUsed` and `tax.harvestableLoss`, and TAX-01, by person. Until then
  `DATA_DICTIONARY.md` §6 reads those paths as the per-person paths and TAX-01 is evaluated per person (§8 there).

## Change log

| Date | Change |
|---|---|
| 23 Oct 2026 | Created (D-036): the platform export accepted as is, the blank template with the same headers, PAN removal, lot classes, repeated rows, reconciliation, financial years, indicative tax, the fixture generator |
| 24 Oct 2026 | Tax per person, never pooled (§9.3); set-off against the highest-taxed gains first; year and section labels (§8); from the live-page tax review |
| 27 Oct 2026 | §10, the dated tax-rule table v1, reviewed (sources, verifications, reconciliation with the owner's reckoner TY 2026-27 and OD-2); §9.1 takes the class from the fund house's classification (TR-7); §15 owner items |
| 27 Oct 2026 (revision) | The financial, completeness and security reviews applied with the lead's decisions LD-1 to LD-23 (§10.11): decision ids TR-n; the rule key with the listed flag and the sub-type, and EQ-ELSS-1 as a check (§9.1, §10.1); the category map (§10.5a) and the Step-2 default column (§10.5); the merger date gates, three answers and the corrected successor-reset direction (§5); the cost basis of the rule governing (§5); one repeats answer per sale event (§6); the totals row, excluded lots and footer (§2.4, §7); the person key, rates and regime per person and year, no surcharge default, the set-off tie, the FY 2024-25 favourable order, NE-LT-1 per lot, residents assumed (§9.3); the validation ids (§11); the fixtures, cases and known answers KA-1 to KA-17 (§13); the tests and their coverage of §11 (§14); the owner items (§15). §10 is not yet approved |
| 27 Oct 2026 (second revision) | The financial and completeness re-reviews applied with the lead's decisions LD-24 to LD-32 (§10.11): long-term losses set off before short-term losses (§9.3, TR-10, KA-18); successor lots after a taxable merger (`successor-not-reset`, §5, TR-5, the Read Me, KA-17 extended); the Sectoral and Thematic default with a Warning (`category-default-to-confirm`); funds of funds never equity-oriented on the Equity label, and the 90/90 class by sale date (§9.1); the valid rule keys (§9.1); NE-LT-1 per lot as the per-asset reading, with the year's-total figure beside (KA-19); the listed-flag dash only where the rule depends on the flag; the surcharge held while the regime is not entered; the `person-ambiguous` test, unmatched clients as their own person and the family label compared (§9.3, §11); the merger pattern's blank and derived cells (§5); the fixtures' as-on date, columns and marks (§13); KA-11 and KA-16 made concrete; the tests and the analyst's marks (§14); LD-10 and LD-11 put to the owner (§15, items 6 and 7). §10 is not yet approved |
| 27 Oct 2026 (third revision) | The financial and completeness approval reviews applied with the lead's decisions LD-33 to LD-39 (§10.11): NE-LT-1 legs chosen per lot on signed amounts before set-off, the leg of a loss lot, the year's-total figure computed with set-off, and "lower or equal" only where no loss meets NE-LT-1 gains (§9.3, TR-10, §11, §15 item 4, KA-20); lots without a computable taxable gain left out of the rate buckets and the person-year and family sum marked PARTIAL COVERAGE (§9.3, KA-21); the analyst's equity-oriented class on a fund of funds only from 2018-04-01, setting the 90/90 sub-type, and the 90/90 flag cleared to class a year otherwise (§9.1); the re-base formula and the successor candidates (§5, TR-5, KA-17 in two lots); the listed flag missing in the valid keys (§9.1); `costBasis` `none` narrowed and blank cells skipping row checks (§4); each fixture's analyst inputs recorded and its results expected without and with them (§13.1, §14); the fixtures' client labels and successor lots (§13.2, §13.4); the rule bank's tax paths read per person (§15). §10 is not yet approved |
| 27 Oct 2026 (fourth revision) | The financial and completeness second approval reviews applied with the lead's decisions LD-40 to LD-42 (§10.11): every claim that NE-LT-1 per lot gives a tax lower than or equal to the year's-total figure removed, with its property test; NE-LT-1 per lot as the per-asset reading, the year's-total figure shown beside it, which is lower depending on the year's losses, and the 20% leg on equal positive figures (§9.3 steps 1 and 8, §10.9, §11, §15 item 4); KA-19, KA-20 and the new KA-22 as plain known answers with both figures (§13.4, §14); the analyst's equity-oriented class on a fund of funds giving the 90/90 sub-type to that scheme's sales in that financial year only, without setting the per-scheme 90/90 flag (§9.1, TR-6, TR-18, §14); known answers compared to ₹0.01 on the unrounded total, tax and cess not rounded separately (§13.4, KA-20). §10 is not yet approved |
| 27 Oct 2026 (approval) | The financial-domain reviewer approved the design and the tax-rule table v1 for M7 code (§10.10); owner and tax-adviser items stay open (§15) |
