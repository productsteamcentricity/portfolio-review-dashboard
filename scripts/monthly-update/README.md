# scripts/monthly-update: the monthly update engine (new build, M11)

M11a, the engine core: locate the month's files, classify them, fingerprint them, apply the competing-file and
stale-copy rules, quarantine client material, validate the MF Screener data pack, and write
`monthly_updates/YYYY-MM/MANIFEST.json` and `UPDATE_REPORT.md`. Extraction into `data/` and `product_bank/` (M11b) and
the index-series reader come later. The October 2026 refresh still runs on the legacy pipeline (`buildtools/`,
`docs/MONTHLY_REFRESH.md`); this engine does not touch it.

```
node scripts/monthly-update/run.ts --month 2026-10 [--inbox <dir>] [--repo <dir>] [--write]
```

- `--inbox` (or the environment variable `PRD_MONTHLY_INBOX`): the private monthly inbox; the engine reads
  `<inbox>/YYYY-MM/` and the repository's `monthly_updates/YYYY-MM/`.
- A dry run by default: it prints the report (with file names, for the analyst) and writes nothing. `--write` stages
  new class P files into their role folders and writes the manifest and the committed report (which names only class
  P files). Writes are atomic (a temporary file, then a rename). A repeat run that adds nothing changes no byte.
- The engine does not run the privacy scan on what it writes: run `node scripts/validation/privacy-scan.mjs` on the
  written files before committing (the console says so; the pre-push scan is the backstop).
- A file whose name looks like client material is never staged, even when its content is vendor data: it stops as
  `name-content-mismatch` (or is quarantined), and its name appears only in the console report.
- An as-on date belongs to the data month when it falls inside the month or in the first `AS_ON_GRACE_DAYS` (10) days
  after it (monitors are dated on the first working days); otherwise the file is `other-month`.
- Entries read whole to sniff an inbox file are capped at 64 MB each (`MAX_SNIFF_ENTRY_BYTES`); a sheet is read only
  from its start (at most 8 MB, `SNIFF_PREFIX_BYTES`, for its first rows), so the real 67 MB analytics sheet costs 8 MB.
  Every entry inflates only up to its declared size.
- Classes and role folders come from `monthly_updates/_policy/publication-classes.json` (D-023, D-026). The Screener
  pack (class N) is validated by the app's own reader and recorded by fingerprint, contract version, cycle and counts
  only; it is never copied. A class N file inside `monthly_updates/` fails the run.
- Office files are read as zip and XML only (CLAUDE.md rule 10). No network.

| File | Does |
|---|---|
| `types.ts` | roles, statuses, the manifest record (contract I-39 part 1) |
| `zip.ts` | central directory and single-entry inflation; the JSZip subset for the pack reader |
| `sniff.ts` | sheet names, header text, shared strings, slide text |
| `classify.ts` | content, then structure, then name; client detection first |
| `ledger.ts` | fingerprint rules, the manifest |
| `report.ts` | `UPDATE_REPORT.md` |
| `run.ts` | the command |

Tests: `tests/unit/monthly-update/`, `tests/integration/monthly-update.test.ts` (synthetic files from
`tests/fixtures/make-monthly-files.ts`, built in temporary folders).
