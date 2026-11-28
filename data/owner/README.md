# Owner-maintained tables (`data/owner/`)

Tables the owner decides, each with its approval record inside the file (decision, date, who approved). A line
enters a table only after the owner's approval; nothing here is generated. See [data/README.md](../README.md).

| File | Content | Decision | Read by |
|---|---|---|---|
| `fund-aliases.json` | Renamed schemes (lines 1 to 17): an old scheme name and the renamed fund's Regular and Direct vendor keys, each line with public evidence and the rename date where known. Lines 18 to 22 are not renames: each is AMFI's official spelling of a scheme the vendor spells differently, tied to the target by the AMFI scheme code | PD-36 (OD-5), approved line by line by the owner: lines 1 to 9 and 11 to 17 on 25 Nov 2026, lines 18 to 22 on 28 Nov 2026 (each of those lines carries its own date and approver) | `app/src/engine/match/owner-aliases.ts` (sprint 2a, KI-050) |

## Fund aliases: rules

- **One line per owner-approved rename or spelling.** The key is the normalised old name; the parser refuses a line whose key is
  not `normalize(oldName)`, a repeated key, a line without evidence, or a target equal to its own old name.
- **An alias applies only where its target is among the candidates**, after the stable identifiers and the exact vendor
  key and before the exact normalised name. It never crosses product class.
- **Both plans:** a holding whose own name says Direct takes the `direct` target, any other the `regular` target.
- **`requiresPhrase`:** when present, the holding's own name must contain it as whole words. Line 17 has one: the
  matcher drops "regular" as a plan word, so "ICICI Pru Regular Savings Fund" shares its key with ICICI Pru Savings
  Fund, a different debt fund.
- **Before a new line goes to the owner,** run the collision scan (`tests/unit/match/owner-aliases.test.ts`, "collision
  scan"): no reference name other than the same scheme may share the key and pass the guard (MOD-04, 25 Nov 2026).
- **One direction only.** Never add the reverse of a line (line 14's note gives the reason).
