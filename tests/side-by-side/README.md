# Side-by-side kit (test build 1)

The same book runs through the live page's engine (`index.html`, through `tools/engine-host.js`) and through the new
build (`app/src`). The kit compares the two field by field and lists every difference with its row in the
[feature parity matrix](../../docs/new-build/05-feature-parity-matrix.md). Owner: EX-02 (MOD-04, 26 Nov 2026). It only
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
- The console output and the report name the base file. Keep them local too.
- With a real file, the report holds client data and carries a red "LOCAL ONLY" banner. Never commit, attach or send it.
- The kit reads the files and makes no network request.

## What it compares

| Section | Rows | Fields | Matrix rows |
|---|---|---|---|
| holdings | each included holding, keyed by client, instrument name, folio, product and distributor; a key twice on one side is a `duplicate-key` difference | the route (the universe it is looked up in, or none), the matched fund and its universe (MF, PMS, AIF, SIF), the market value, the holding's XIRR and BMXIRR | E-15 (route: the kit's own check), E-13, E-14 (match), E-21, E-25 or E-28 (XIRR) |
| performance | each fund row of the legacy performance view | 1Y/3Y/5Y and the benchmark's | E-31, E-30 |
| scopes | the family, each client and each adviser, with an IRR file | XIRR and benchmark XIRR | E-27, E-142 |
| contributions | the contributors, laggards and drags lists | rank, market value, contribution | E-29 |

How the kit reads each side:
- **XIRRs are fractions.** With an IRR file, a holding's XIRR is the transaction XIRR of its own flows (its client and
  instrument), or its base-file XIRR when it has no flows. That is the live page's rule and the new build's (D11).
  Without an IRR file, no scope XIRR is compared: the live page's client total is then a weighted average, not an XIRR.
- **Routing is not tested.** The new build does not route a holding yet (E-15), so the kit copies the live page's rule
  for both sides: direct equity and LP-16's non-MF classes are not looked up; otherwise PMS, AIF, SIF or MF. A matching
  difference is therefore a matcher difference, never a routing one. To catch the copy drifting from `index.html`, each
  holding also carries its `route`: on the legacy side it comes from the engine's own `directEquity` and product class,
  and on the new side from the copy. A `route` difference (E-15) means the copy is stale. Fix `next.ts`; never classify it.
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
- `kind`: field, only-legacy, only-new, not-built or `*`.

The class is `correction`, `improvement`, `not-built` or `regression`; a regression is never merged. An entry that no
case uses fails the test too.

| Entry | Difference |
|---|---|
| SB-01 | performance not built in the new build yet (E-31, E-147) |
| SB-02 | the adviser XIRR exists only in the new build (E-142, D15) |
| SB-03 | a client with no IRR flows: the live page borrows another client's flows by its fuzzy name match (KI-032; the new build keys clients by id, D9) |

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
- **Client names:** the live page matches IRR clients by two shared words; the new build uses the exact client (D9, KI-032).
- **Matching by ISIN first** in the new build (E-13, E-19).
- **The all-negative guard of contributors** (E-29).

Read the matrix row and the ledger reference of each difference before calling it a defect.

## Files

| File | What it does |
|---|---|
| `shape.ts` | The common shape both sides are projected into. |
| `legacy.ts` | The live page's engine. |
| `next.ts` | The new build's modules. |
| `compare.ts` | The comparison, the matrix tags and the ledger match. |
| `report.ts` | Writes report.json and report.html. |
| `run.ts` | The command, the synthetic cases and the probe book (two distributors, a share, an FD, an NCD, a client without flows). |
| `side-by-side.test.ts` | The test. |
