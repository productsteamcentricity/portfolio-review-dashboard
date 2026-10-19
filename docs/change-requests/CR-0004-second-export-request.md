# CR-0004: Second export request to the previous owner

- **Requested:** 15–16 Oct 2026, by the product owner.
- **Status:** done. The prompt is ready to send. Delivery from the previous owner is awaited, expected the week of
  19 Oct.

## Request
1. Prepare the exact file the previous owner runs in their Claude Code, to extract everything still on their
   machine and in their Claude. That includes all data that may be needed in future.
2. The files come back as Teams attachments, not through an upload link. Prepare the message to send with it.
3. Leave out requests that are not part of the extraction: revoking the old GitHub token, and redirecting the
   monthly files. The aim is one complete delivery, so the new build can be loaded and tested.

## What was produced (OneDrive, not in this public repository)
- `03 Handover\2026-10-15 Follow-up request\PROMPT_Previous_Owner_Second_Export.md`. It asks for:
  - **T6:** the risk-ratio toolchain, its README, the inputs of the Aug and Sep runs, and a regression proving it
    reproduces September;
  - **T5:** the three backup archives;
  - **T7:** the sources of record (Fund Ranks, Fund Manager history, PMS / AIF / SOA, IPS, rules, tax, slides,
    templates);
  - **T8:** Claude memory notes, released templates, leftover code, and the web-app database;
  - **T9:** three anonymised test fixtures in real formats, including one with XIRR stored as fractions;
  - **`ANSWERS.md`:** written answers to their 30 open questions and to 10 of ours.
- `Teams message to the previous owner.txt`: the message to send with it.
- `03 Handover\Second export (incoming)`: where the received files are saved.

## Verification
The prompt went through three independent review rounds. Each finding was adversarially verified and every
confirmed one was applied (37, then 20, then 8).

The main safeguards:
- The toolchain is test-run only in a sealed scratch copy: no network, and a before/after snapshot of the
  original folders.
- Originals are never opened in Office; the deny list is extended as new folders are read; and client names
  given in answers are replaced by labels.
- Their Claude never sends anything and never searches mail, SharePoint or the web.
- Nothing in it raises decisions about the existing repository, site, CMS or web app.
