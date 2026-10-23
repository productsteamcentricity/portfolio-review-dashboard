# monthly_updates/: the monthly source files (tracked)

The designated folder for the monthly source files of the Portfolio Review application (CR-0006). It is tracked in
this **public** repository: everything committed here is world-readable and stays in the history.

**Status (22 Oct 2026).** Only this README and [`_policy/`](_policy/publication-classes.json) exist. The monthly
update engine that fills the folder arrives with milestone M11. Until then the monthly refresh runs on the legacy
pipeline from the private monthly inbox ([MONTHLY_REFRESH.md](../docs/MONTHLY_REFRESH.md)), and `.gitignore` still
blocks office and data files everywhere, so nothing dropped here is committed until M11 adds an allow-list for the
approved role folders. The process itself is described in
[MONTHLY_UPDATE_GUIDE.md](../docs/MONTHLY_UPDATE_GUIDE.md), which owns it; this file holds only the instruction, the
layout and the drop rules.

## The one instruction (from M11)

> I have updated the files in the monthly_updates folder. Process the updates and prepare the current month's data.

The owner keeps dropping the month's files in the private monthly inbox; the update engine copies the approved ones
here after the privacy scan. Dropping them straight into this folder works too.

## Layout

```
monthly_updates/
  README.md                this file
  _policy/
    publication-classes.json   the classes below, per role (machine-readable; read by the update engine and,
                               from M11, by the pre-push scan)
  YYYY-MM/                 one folder per DATA month (as-on), never the month the files arrive (Q-26):
                           2026-10 holds the data as on 31 Oct 2026
    MANIFEST.json          every file seen: role, original name, size, SHA-256, as-on, class, storage, counts, issues
    UPDATE_REPORT.md       the update summary (no client data, no person names)
    mf-monitor/            Daily MF Monitor, Regular and Direct
    sif-monitor/           SIF Monitor
    reckoner/              Investment Reckoner (as PDF while the PPTX is above 50 MB)
    one-pagers/            PMS and AIF one-pagers of approved products
    market-update/         the Monthly Outlook deck
    disclaimer/            disclaimer, topic and closing material
    index-data/            the five Index TRI files
    other-approved/        the other Accord files (expense ratio, analytics, listed equity, fund manager,
                           exit load) and the owner-maintained tables (tax rules, IPS profiles)
```

`_policy/classification-rules.json` and `_policy/approved-products.json` are added in M11
([09-repository-and-docs-structure.md](../docs/new-build/09-repository-and-docs-structure.md) §5).

## Publication classes (D-023, D-026)

| Class | Which files | Here |
|---|---|---|
| **P** publishable | **every Accord Fintech file** (the licence covers all Accord files, D-026), the other approved monthly source files of D-023 point 1 (the index data among them) and **Centricity material** without client or personal data | committed in its role folder after the privacy scan |
| **C** private until approved | a source that is neither Accord nor Centricity material, until its owner agrees: today the in-house risk ratios and NAV data, the fund ranks, the PMS and AIF performance files and manager factsheets | never committed: kept privately, its SHA-256 recorded in `MANIFEST.json`; derived data may be embedded where D-023 permits |
| **N** never | **client data** (base files, IRR workbooks, statements, capital-gains statements, review decks and workbooks), personal data, credentials, and **the MF Screener data pack** | **never here.** A client file found in a monthly folder is quarantined and reported. The Screener pack is uploaded into the app and kept in the browser (D-026); only its fingerprint, contract version, cycle and counts go into `MANIFEST.json` |

The role-by-role list is [`_policy/publication-classes.json`](_policy/publication-classes.json); who sends each file
and what it feeds is in
[MONTHLY_UPDATE_GUIDE.md, "Files the owner supplies each month"](../docs/MONTHLY_UPDATE_GUIDE.md#files-the-owner-supplies-each-month).

## Drop rules

- One folder per data month, `YYYY-MM`; a file for another month goes in that month's folder.
- One file per role and month. Two different files for one role are competing files: the engine stops that role and
  reports both. A byte-identical copy of last month's file is a stale copy and is stopped too.
- A file above 50 MB is committed as PDF, with the original kept privately and its SHA-256 in `MANIFEST.json`
  (D-023). The pre-push scan refuses any file above 50 MB today; its warning above 20 MB (Q-14) arrives with the
  monthly-class rules in M11.
- Never put a client file, a person's details, a password or the Screener data pack here, even for a moment: a
  commit is public once pushed, and removing a file later does not remove it from the history.
