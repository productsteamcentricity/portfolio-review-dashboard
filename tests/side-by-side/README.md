# Side-by-side kit (test build 1)

The same book runs through the live page's engine (`index.html`, through `tools/engine-host.js`) and through the new
build (`app/src`). The kit compares the two field by field and lists every difference with its row in the
[feature parity matrix](../../docs/new-build/05-feature-parity-matrix.md). Owner: EX-03 (MOD-04, 26 Nov 2026; phase 2 MOD-05, 27 Nov 2026). It only
reads and calls `app/**`, `tests/helpers`, `tests/fixtures` and `tools/`, and changes nothing outside this folder.

## Run it

```bash
node tests/side-by-side/run.ts                       # the synthetic books
node --test tests/side-by-side/side-by-side.test.ts  # the same, as a test (part of npm test)
```

On a real file, **on this PC only**:

```bash
node tests/side-by-side/run.ts --base "<base file.xlsx>" --irr "<IRR file.xlsx>" --as-on "31 Oct 2026" --out "C:/Temp/sbs-report"
```

With `--base`, both `--out` and `--as-on` are required: the command refuses to guess.

- Give `--out` a folder outside OneDrive and outside the repository. With `--base` the command refuses a folder inside any
  working tree of the repository, the main checkout or a worktree (except under its git-ignored `test-data/`), and any
  path through OneDrive. Links and junctions are resolved first. The synthetic run writes to
  `test-data/side-by-side/<time>/`, which is git-ignored.
- Known limit: the guard knows only the kit's own repository and its worktrees. Run from an independent clone that sits
  inside another checkout's folder, it does not refuse that enclosing checkout. Choose `--out` with care there.
- The console output and the report name the base file. Keep them local too.
- With a real file, the report holds client data and carries a red "LOCAL ONLY" banner. Never commit, attach or send it.
- The kit reads the files and makes no network request.

## What it compares

| Section | Rows | Fields | Matrix rows |
|---|---|---|---|
| holdings | each included holding, keyed by client, instrument name, folio, product and distributor; a key twice on one side is a `duplicate-key` difference | the route (MF, PMS, AIF, SIF, STOCK, or `other (<class>)` for a non-MF class), the matched reference entry and its universe (a STOCK_RET key for a listed share), the market value, the holding's XIRR and BMXIRR; the new build's method is shown, not compared | E-15 (route), E-13, E-14 (match), E-21, E-25 or E-28 (XIRR) |
| performance | each fund row of the legacy performance view | 1Y/3Y/5Y and the benchmark's | E-31, E-30 |
| scopes | the family, each client and each adviser, with an IRR file | XIRR and benchmark XIRR | E-27, E-142 |
| contributions | the contributors, laggards and drags lists | rank, market value, contribution | E-29 |

How the kit reads each side:
- **XIRRs are fractions.** With an IRR file, a holding's XIRR is the transaction XIRR of its own flows (its client and
  instrument), or its base-file XIRR when it has no flows. That is the live page's rule and the new build's (D11).
  Without an IRR file, no scope XIRR is compared: the live page's client total is then a weighted average, not an XIRR.
- **Routing and matching are the real thing (phase 2, 27 Nov 2026).** The new side runs the wired resolver that `/next/`
  runs (`resolveHoldings` with `committedMatchContext()`: the shipped blocks and `data/owner/fund-aliases.json`), so
  routing (E-15), ISIN first, the owner's aliases (PD-36) and the stricter regime (OD-5 option B) are all compared. The
  legacy side reads its route from the engine's own `directEquity` and product class, and a listed share's key from
  `h.stockRet` (found by identity in `STOCK_RET`, never recomputed). Both sides write the same route strings, so a
  `route` difference is a real routing difference. The new build's method and confidence (`isin (exact)`,
  `alias-pin (pinned)`, `name-match (exact)`, `none (unmatched)`) are shown in the report only.
- **Fund matching summary.** The report has a "Fund matching" section per case: how many holdings match alike, the count
  per class, and one line per holding that differs ("The live page matched A; the new build matched B by <method>. Why:
  <class>, <reference>"). On the synthetic books it can be quoted in the owner's test sheet; on a real file it stays
  on this PC like the rest of the report.
- **Client XIRRs.** A client XIRR is compared only when both sides have one from the IRR file. The live page's Grand Total
  for a client it cannot resolve is a weighted average and is skipped (listed in the notes). So is a new-build client with
  no flows.
- **The adviser XIRR** has no reference in the live page (`SB-02`). The kit shows it but cannot check it.
- **Units in the report:** XIRRs as percentages with the difference in basis points; market value in Crore; contributions
  in percentage points. "Not compared" counts the rows one engine cannot give yet.
- **Performance.** The new build has no performance view yet (E-31, E-147; M3b). The legacy rows are listed under
  `SB-01` and not compared. When M3b merges, `next.ts` fills `performance` and `SB-01` is retired.
- **Tolerance.** Numbers agree within 1e-9 relative plus 1e-12 absolute.

## The ledger (`sbs-ledger.json`)

Every difference must match an entry, or the test fails ("unclassified"). The fields are those of the parity ledgers
([../parity/README.md](../parity/README.md)), plus:
- `section`: holdings, performance, scopes, contributions or `*`;
- `kind`: field, only-legacy, only-new, not-built or `*`;
- the `legacy` and `new` patterns may be `{ "byField": { "<field>": <value> } }`: an entry over several fields then pins
  each field's own value (SB-13 to SB-17), so a different answer on either side is unclassified.

The class is `correction`, `improvement`, `not-built`, `accepted-difference`, `known-gap` or `regression`; a regression
is never merged. `known-gap`: the live page is right and the new build is not, under a decided regime, with the owner's
ruling still open; it passes, and its entry must say "not yet ruled on by the owner" (MOD-05, 27 Nov 2026). `accepted-difference` is an owner-accepted difference; reviewed at M15: the builds differ by an owner's decision,
and neither side is a defect (MOD-04, 26 Nov 2026). An entry that no case uses fails the test too, and so does a class
outside this list.

| Entry | Difference |
|---|---|
| SB-01 | performance not built in the new build yet (E-31, E-147) |
| SB-02 | the adviser XIRR exists only in the new build (E-142, D15) |
| SB-08 to SB-17 | case `matching-probe` (fund matching, phase 2): public scheme names from `tests/parity/matching-corrections-ledger.json`, each with its known answer there. **Corrections** (the live page matches another fund, the new build the right one): SB-08 the normaliser follow-up (Multi-Cap), SB-09 and SB-10 KI-036 (an IDCW plan matched to the Growth plan), SB-11 the normaliser (an AMFI "Exchange Traded Fund" name), SB-12 KI-050 with the owner's alias PD-36 line 1. **Accepted differences** under OD-5 option B (the owner's "Go ahead with the Stricter regime", 26 Nov 2026): SB-13 and SB-14, a Gold fund the live page matches to its sibling Gold ETF and the new build leaves unmatched (alias candidates). **Known gaps** SB-15 and SB-16: two of the 4 names the ledger still lists as regressed (the live page is right, the new build leaves them unmatched; SB-16 was newly lost by the normaliser follow-up); not yet ruled on by the owner (asked 27 Nov 2026); alias candidates (PD-36). **Improvement** SB-17: a listed share found only by its ISIN (E-13; KI-184, the live page never reads the ISIN column) |
| SB-04 to SB-07 | case `syn-standard-irr-variant`: the IRR file writes a client with a salutation. The live page joins it as a name variant (KI-032 fix), and the new build keys clients by their exact label (D9, kept by MOD-04 on 26 Nov 2026). So that client's holding XIRRs (SB-04), its client XIRR (SB-05), the family XIRR (SB-06; the new build leaves the IRR-only label out, OD-4) and the contributions (SB-07) differ. Class `accepted-difference` (owner-accepted difference; reviewed at M15): the owner decided on 26 Nov 2026 that the new build joins on exact names only, with a transactions template that carries them |

SB-03 (a client without flows borrowing another client's flows through the old fuzzy name join) was retired with the
KI-032 fix: the live page no longer joins Sample Client C to another Sample Client, and the probe book agrees.

## Expected on a real file (decided differences that no synthetic case covers yet)

On a real book, these show up as differences and may be unclassified until a fixture and a narrow `SB-nn` entry are added.
They are decided behaviour, not defects:
- **IRR-only clients:** in the IRR file but not the base file. The live page counts them in the family XIRR; the new build
  leaves them out and lists them (OD-4).
- **Invalid benchmark:** an instrument whose benchmark gives no rate leaves both the fund and benchmark sides in the new
  build, and stays in the live page (D14). **Kit limitation, not a new-build defect:** when such a holding's
  contribution line joins other holdings, the kit cannot read the holding's own XIRR (the new build does compute it,
  scope.ts step 6) and shows it as missing on the new side.
- **Benchmark-only series:** the live page's family and client benchmark XIRRs use every benchmark row (KI-048).
- **Client names:** the live page joins an IRR client by its exact name or by an unambiguous variant (a salutation,
  initials, a middle name: KI-032); the new build uses the exact label only (D9). The synthetic case is SB-04 to SB-07;
  on a real file such a client shows the same differences, unclassified until a narrow entry names that fixture.
- **Matching differences** beyond the probe book's ten (the matching-corrections ledger measures thousands): each needs a
  narrow entry with its class, as SB-08 to SB-17. Fund ISINs match only once `data/identifiers/amfi-isin.json` arrives
  (December refresh); until then only listed shares match by ISIN.
- **The all-negative guard of contributors** (E-29).

Read the matrix row and the ledger reference of each difference before calling it a defect.

## Files

| File | What it does |
|---|---|
| `shape.ts` | The common shape both sides are projected into. |
| `legacy.ts` | The live page's engine. |
| `next.ts` | The new build's modules (the wired matcher `resolveHoldings`). |
| `compare.ts` | The comparison, the matrix tags and the ledger match. |
| `report.ts` | Writes report.json and report.html. |
| `run.ts` | The command, the synthetic cases, the probe book (two distributors, a share, an FD, an NCD, a client without flows), the matching probe book (fund names with a known answer, an owner alias, two shares, one with an ISIN column, a REIT and an unlisted share) and the client-name variant case. |
| `side-by-side.test.ts` | The test. |
