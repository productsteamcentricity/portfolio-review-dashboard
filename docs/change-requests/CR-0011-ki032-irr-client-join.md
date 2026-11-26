# CR-0011: KI-032, the IRR client join: exact or a unique name variant, never a family member's or an HUF's flows

- **Requested:** 26 Nov 2026 by the owner, through the project moderator (MOD-04), on EX-03's plan: "Careful variant
  match (Recommended)"; "Yes, counts only (Recommended)" (a read-only measurement on the October files, counts only);
  "Before 13 Dec (Recommended)". MOD-04 decided that the new build keeps exact client labels (D9).
- **Built:** 26 Nov 2026 on branch `fix/ki032-irr-client-join` from `main` `e851420`.
- **Status:** in review. Live only on the owner's "publish".

## Request

On the live page a base-file client with no exact name in the IRR (transactions) file took whichever IRR client shared
the most name words, if at least two; a tie went to the first in the file. That join feeds the client's Grand Total
XIRR and BMXIRR, its asset and product subtotals, the placement of its redeemed instruments and every holding's
transaction XIRR. A client without transactions could therefore show a family member's figures (for example a wife
whose name carries her husband's), and an individual could take an HUF's. The figures were real but belonged to
someone else (rule 3). KI-032 recorded it; the side-by-side kit showed it on its probe book (SB-03).

## Scope

The engine's IRR block only (`07_engine.js`, `resolveClient` and two § note texts; `irrJoin` in the review model).
Nothing changes for a client whose name is in the IRR file exactly. The family Fund IRR tree, which groups by the IRR
file's own client labels, is unchanged. No reference data, matcher threshold or UI script changes.

## The rule

1. **Exact:** the normalised name (upper case, text in brackets dropped, punctuation as spaces) is an IRR client.
2. **Variant**, for a base client with no exact name, against the IRR clients that no base client names exactly:
   - salutations dropped: MR, MRS, MS, MISS, DR, SHRI, SRI, SMT, SHRIMATI, KUM, MASTER, LATE;
   - entity words equal on both sides: HUF, TRUST, LLP, PVT or PRIVATE, LTD or LIMITED, CO, FIRM, FOUNDATION, MINOR, and
     U/G or GUARDIAN;
   - every word of the shorter name is in the longer one, a single letter standing for a word with that initial, and
     the shorter name keeps at least two full words;
   - when the lengths differ, the first words agree as well, so "Priya Rajesh Shah" never takes "Rajesh Shah"'s flows;
   - unique both ways: one candidate for the base client, and that IRR client a candidate for no other base client.
3. **No join** otherwise: the base file's CMV-weighted XIRR and BMXIRR, as for a client without transactions. When the
   old rule would have joined, the client's § note adds why not: a different entity, more than one possible client, an
   IRR client that could also be another client, the IRR client already another client's exact name, or names that
   differ by more than a salutation, initials or a middle name. No name is printed.
4. A variant join is named in the client's § note ("joined to the IRR file's client by a name variant"). The counts
   (exact, variant, refused, none) are in the review model as `irrJoin`.

## Evidence

- `tools/regression/KI-032-irr-client-join.js`: 58 known-answer checks in IST and UTC. Every joined client's Grand
  Total and holdings equal an independent XIRR (actual/365, bisection) of the flows it must join; every client not
  joined keeps its base-file figures with the expected note. Cases: exact names; the reproduced family case; a family
  member only in the IRR file; an HUF; a salutation with an initial; a middle name; two candidates; one candidate
  shared by two clients; the synthetic book's own names (SB-03); no near name; the family tree unchanged.
- Side-by-side kit: SB-03 retired (the probe book agrees for the client without transactions); the new case
  `syn-standard-irr-variant` with SB-04 to SB-07 records the decided difference from the new build (D9, OD-4).
- Measurement on the October files (read only, counts only, on the owner's permission): see the pull request.

## Records

`docs/KNOWN_ISSUES.md` (KI-032 fixed), `CHANGELOG.md`, `docs/PROJECT_STATE.md`, this record.
