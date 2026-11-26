# CR-0012: LP-16b, the platform's Product Name values

- **Requested:** 26 Nov 2026 by the owner, through the project moderator (MOD-04), typed about 18:25 IST:
  - "Treat Global Exposure as both Offshore Funds and Gift City Funds";
  - Bonds: "Rupee bonds and NCDs (Recommended)";
  - P2P Lending: "Debt; but it won't be there in any of the portfolios";
  - Unlisted-Direct maps to Unlisted shares, and AIF-Listed to Listed AIF (D-043).
- **Built:** 26 Nov 2026 on branch `fix/lp16b-platform-product-names` from `main` `2575196`; main `9c5d46e` (KI-032)
  merged in, page rebuilt on KI-032's page (D-016).
- **Status:** in review. Live only on the owner's "publish".

## Request

The wealth platform's base-file exports write their own Product Name values, which analysts cannot retype: Mutual
Funds, Direct Equity, PMS, SIF, Unlisted-Direct, AIF-Listed, Global Exposure, Bonds, P2P Lending (generic categories,
from the owner's real exports; no client data here). LP-16 (D-7) classed the owner's own six labels, and the live page
must read the platform's names in the same way.

## What changes

| Platform value | Before | After |
|---|---|---|
| Mutual Funds, Direct Equity, PMS, SIF | MF, listed share, PMS, SIF | unchanged |
| Unlisted-Direct | label Unlisted shares, but treated as a fund (no "share" word): fund fee, SWOT asset, international test | an unlisted share held directly, as "Unlisted Shares" |
| AIF-Listed | AIF; tax Category I/II assumed | AIF; tax a Listed AIF, Category III with its note (D-043) |
| Global Exposure | looked up as a mutual fund (unmatched) | GIFT City funds when the name says GIFT or IFSC, else Offshore funds (this is how the owner's "both" is read); no performance lookup; tax unchanged |
| Bonds | "US-dollar bonds (through LRS)" (every bond, 25 Nov rule); tax Listed Bonds / NCDs | "Rupee bonds and NCDs"; tax unchanged |
| a bond saying USD, US$, US (a whole word), dollar or LRS (product or name) | US-dollar label; no tax row only when the product or category said so | US-dollar label; no tax row also when the name says so |
| P2P Lending | looked up as a mutual fund (unmatched); no tax row | its own class "P2P lending" (Debt), no lookup; no tax row |

The rules stay data (`PRODUCT_CLASS_RULES`, contract I-40, one source for both builds), with two optional fields:
`nameAny` (words the instrument name must contain) and `andAny` (words the product or the name must contain); a "$" in a
keyword is kept, and a currency word (usd, us, us$) may be followed by a figure ("US$500mn", "USD5.25"). The owner's
option read "USD, US or LRS", so a whole-word "US" counts too ("Plus" and "Bus" do not; MOD-04 on CHAT-008's Gate B
note, 26 Nov 2026); both rules apply only to bond rows. The tax rule that publishes no row for a foreign bond applies
to a product or category that says bond, NCD or debenture; it keeps reading foreign, offshore, GIFT City and similar
words in the product or category, and reads only USD, US$, US, dollar or LRS in the name, because an Indian issuer
named "Global" or "International" is not a foreign route (MOD-04 approved this reading, 26 Nov 2026). A fund, AIF or
PMS named "... Bond ..." keeps its own row.

Open owner questions (today's behaviour kept; financial review of LP-16b): a bond whose category names a foreign route
keeps the rupee label but has no tax row; GIFT or IFSC in a bond's name alone keeps the listed bond rows; a fund named
under the product "Bonds" (for example a bond ETF) takes the rupee bond label and rows, as before LP-16b.

## Evidence

- `tools/regression/LP16b-platform-product-names.js`: 99 known-answer checks in IST and UTC, covering:
  - one holding per platform value, with its class, the performance lookup, the look-through listing, heldShare and
    directEquity, and the tax row or the reason;
  - the edge cases: GIFT or IFSC in the name, USD, US$, dollar and LRS, a "Global" issuer, a bond fund, an SGB, an MLD,
    "AIF-Unlisted"; a whole-word "US" in a bond's name (and "Plus", "Bus"); a figure after US$ or USD; a fund, AIF or
    PMS named "... Bond ..."; a foreign category;
    an SGB and an MLD under "Bonds"; a GIFT City bond name;
  - the rule fields read from the data.
- `tools/regression/LP16-KI051-product-classes.js` follows the new bond rule (the 25 Nov rule it pinned is changed by the
  owner).
- The side-by-side kit's copy of the routing rule reads the new fields (its route drift guard).

## Records

`CHANGELOG.md`, `docs/PROJECT_STATE.md`, this record. Contract I-40 gains `nameAny` and `andAny` (MOD-04 records the
addendum and tells the new-build chats).
