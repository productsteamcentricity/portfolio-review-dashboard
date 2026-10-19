# Owner decisions from the 19 Oct 2026 audit

The audit ([`2026-10-19-full-audit.md`](2026-10-19-full-audit.md)) found 67 issues. Most can be fixed without a
product decision, and those fixes have started (batch order at the end of the register). The 28 questions below
need the product owner's answer. OD-26 to OD-28 were added by the review of fix batch 1a.

Each question has a **recommendation**, built on two rules:
- **CLAUDE.md rule 3:** never invent a number.
- **Your earlier decisions**, as recorded in the previous owner's decisions log.

**How to reply:** "accept all", or "accept all except OD-n: …".

## Owner's answer (19 Oct 2026)
"Accept all except OD-11." Every recommendation below is accepted as written (D-021), except:

- **OD-11, monitor uploads: keep them.** The analyst using the dashboard must be able to upload the latest
  MF Monitor and Direct Monitor. The upload therefore has to be made correct instead of removed:
  - **one parsing path:** an uploaded monitor is read by the same rules as the monthly refresh, so it gives the
    same AUM, debt fields (YTM, modified duration), Direct sheet mapping and categories (KI-026);
  - **expense ratios read as percent:** always divided by 100; values above 5% are dropped and counted
    (NEW-12, KI-058);
  - **the right slot:** a Direct file in the Regular slot, or the reverse, is rejected, and the status line names
    the plan type it detected (NEW-30, KI-076);
  - **the data date is visible:** the sidebar shows which monitor and date are in use (embedded or uploaded). An
    upload with the same or an older date than the embedded data gets a warning, and one click returns to the
    embedded data.

Follow-ups that the accepted answers leave with the owner:
- **OD-28:** ask the tax adviser for the current section reference under the Income-tax Act 2025.
- **OD-25 (optional):** turn on GitHub's "Keep my email addresses private".
- **OD-5:** new fund-name and AMC aliases are added only after the owner approves them. The first list comes
  with fix batch 1b.

| # | Question | Recommendation | Issues |
|---|---|---|---|
| OD-1 | Which basis governs the 20% AMC cap: the mutual-fund book or the whole portfolio? | **The mutual-fund book** (your 21 May choice, reaffirmed 1 Sep), used the same way in the AMC tab and the AI Analyst. | KI-004 |
| OD-2 | When does a holding become long-term? | **More than 12 months** (strictly after the anniversary), measured to the **review's as-on date**, not the IRR file's date. | KI-022 |
| OD-3 | A base file with no % formatting on the XIRR column, whose values are all below 1.5: percent or fraction? | **Ask the analyst** (a one-click choice in the status line), and never guess. Cells formatted as % are read automatically. | KI-005 |
| OD-4 | IRR reconciliation: redeemed instruments, invalid benchmark series, duplicate folios | **Redeemed instruments:**<br>• base-file clients: include them in since-inception totals, with a footnote;<br>• IRR-only clients: leave them out, and list them.<br>**Invalid benchmark:** exclude the instrument from both sides, with a footnote.<br>**Duplicate folios:** flag them, never alter them. | NEW-3 |
| OD-5 | Tighten fund-name matching? Some wrong matches will then show as "unmatched". Who keeps the rename table? | **Yes, tighten.** The rename/alias table lives in the repository; you approve additions, and Claude maintains it. | NEW-4, KI-036 |
| OD-6 | Which product labels are not mutual funds? | **Not mutual funds:** bond, NCD, debenture, unlisted, MLD / market-linked, FD, REIT, InvIT and SGB, unless the product text also says ETF, MF or fund. | NEW-5 |
| OD-7 | Asset synonyms and missing benchmarks | **Asset:** "Fixed Income" and "Debt Funds" count as Debt; a blank asset stays *unknown*, with a notice, instead of becoming Equity.<br>**Benchmarks:** arbitrage funds use Nifty 50 Arbitrage. BAF, multi-asset, equity savings, gold, silver and global funds show *no benchmark* (footnoted) until the Products team names a series. | KI-024, NEW-27 |
| OD-8 | A holding with no market value | **Exclude it and list it** (count and names) in the status line and a footnote. Never show it at zero. | NEW-11 |
| OD-9 | No base expense ratio from the vendor | **Leave it blank, with a footnote,** and exclude it from coverage. Drop the category estimates and the all-in fallback. | NEW-13, KI-016 |
| OD-10 | Should cost mode and ER overrides persist across families or sessions? One Regular/Direct switch? | **Per family only:** cleared when a new family loads, nothing carried between sessions. **One shared Regular/Direct switch** for Cost, IPS and Performance. | KI-035, KI-012 |
| OD-11 | Keep the in-browser MF Monitor and Direct Monitor uploads? | **Owner's answer: keep them, made correct (see above).** Original recommendation: **remove them.** The monthly refresh embeds the same data correctly, while these uploads degrade it (AUM, debt fields, expense ratios). Keep the client uploads: IRR, PMS/AIF look-through, bonds. | KI-026, NEW-12, NEW-30 |
| OD-12 | PMS/AIF tax split, where only rupee amounts are known | **Show "not split"** for those holdings, with a note. Do not apportion pro rata. | NEW-18 |
| OD-13 | IPS compliance basis; a family with no unlisted holdings | **Measure on CMV**, including the hybrid sleeves. With no unlisted holdings, show "—", not a breach. | NEW-20 |
| OD-14 | AI Analyst Exit with no destination fund | **Fall back to Retain, with a note.** Never release money that has nowhere to go. | NEW-16 |
| OD-15 | Tax lots when the IRR file has no folio numbers but the fund sits with two distributors | **Apportion by units**, labelled "apportioned". | NEW-23 |
| OD-16 | IRR transaction types | **Widen now** to the known types (top-up, STP, SWP, SIP, stock-in, transfer-in). Unrecognised types are counted and named; confirm against a real export when the test files arrive. **Stock-in / transfer-in date:** the original purchase date if given, else the transfer date, labelled. | NEW-24 |
| OD-17 | Tax treatment of hybrid funds | **By equity share**, using the Hybrid rows of your Tax Rules sheet: 65% or more equity follows the equity rules, 35–65% the middle row, under 35% debt. Needs a tax/compliance check. | KI-037 |
| OD-18 | One gain/loss definition | **Market value minus invested value**, everywhere. The file's own G/L column appears only in the echoed base-file sheet. | NEW-25 |
| OD-19 | AI Analyst rounding and minimum action size for small (Lakh) books | **Scale with the portfolio:** thresholds as a % of CMV; amounts kept in full and rounded only for display (₹1,000 steps for Lakh books). | NEW-34 |
| OD-20 | List excluded holdings in the deck? | **Yes, one footnote line:** count and ₹ value, not a full list. | NEW-39 |
| OD-21 | Allocation slides for a family with a single distributor or client | **Leave them out**, as the screen does. | NEW-46 |
| OD-22 | The Excel "Base File" sheet: echo the upload, or show computed values? | **Computed values**, with the sheet renamed "Holdings (as loaded)". | NEW-47 |
| OD-23 | Show the 15 Aug fund ranks of renamed schemes under their new names? | **Yes**, same scheme (same AMFI code), labelled with the rank date. | NEW-6 |
| OD-24 | Keep the rebalancing plan and slide picks when only the as-on date changes for the same family? | **Keep them.** | KI-019 |
| OD-25 | The account's Gmail address is in one public merge commit | **Accept it:** history cannot be rewritten under rule 8. Optionally turn on GitHub's "Keep my email addresses private". Claude now merges with the no-reply address, and this laptop's global git identity has been switched to it. | NEW-52 |
| OD-26 | When some holdings have an XIRR but no BMXIRR (common for PMS, AIF and direct equity), should a subtotal's fund and benchmark figures cover the **same** holdings? Raised by the financial review of fix batch 1a. | **Yes**, for the comparison: average both over holdings that have both values, as the Observations already do. Also show the fund-only average with its coverage. Today each figure covers its own holdings and the † footnote states the coverage. | KI-006 |
| OD-27 | A mutual fund whose debt nature shows only in its name (G-Sec, SDL, gilt), with an equity or blank asset tag: debt fund, or unclassified? | **Debt fund (Sec. 50AA)**, as fix batch 1a does. Funds named as an equity : G-Sec blend ("… 75:25") are left unclassified until their equity share decides the row (KI-037). | KI-065 |
| OD-28 | The Taxation rules cite "Sec. 50AA" (Income-tax Act 1961). From FY 2026-27 the Income-tax Act 2025 applies. | **Ask the tax adviser** for the current section reference, then update the Tax Rules sheet. The rates are unaffected. | Taxation |
