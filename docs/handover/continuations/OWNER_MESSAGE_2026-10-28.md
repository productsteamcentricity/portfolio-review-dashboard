# Message to the owner: please start MOD-02 (28 Oct 2026)

From MOD-01, the chat titled "Portfolio Review Dashboard architecture".

## 1. Why a new chat is needed

This chat has had its memory compacted 4 times. Your rule is to hand over after 3, because each compaction can make a
chat forget details. So this chat has stopped all building work. It will not change any code from now on. A new
chat, **MOD-02**, takes over as your single point of contact.

Nothing is lost:
- **The live dashboard is unchanged** and matches GitHub exactly. [VERIFIED: the live page and `main` have the same
  fingerprint, MD5 `12B5E572...`, 28 Oct]
- **The tax work in progress is saved on GitHub**, on its own branch, `continuation/ex-01-task-ta-03-20261027`.
  A new chat, EX-01, will finish it. [VERIFIED: GitHub shows the branch at `0f1c5d3`, 28 Oct]
- **The new-build chat's latest work is on this laptop only** (4 branches; nothing is left unsaved inside them).
  Saving it to GitHub is MOD-02's first job, through the new-build chat. [VERIFIED: none of the 4 is on GitHub, 28 Oct]
- **Everything the new chats need is written down**: in the project records under `docs/project-control/` and
  `docs/handover/`, and, for anything private, in a private note on this laptop.

## 2. What to do now (about 5 minutes)

1. Open the Claude app on this laptop.
2. Start a **new Claude Code chat** the same way you started this one, in the **same project folder**: the same
   folder you used to start this chat. Using the same folder lets the new chat share this project's memory.
3. Open the prompt file, either:
   - on this laptop, in Notepad:
     `C:\dev\portfolio-review\.claude\worktrees\handover\docs\handover\continuations\MOD-01_TO_MOD-02_SUCCESSOR_PROMPT_2026-10-28.md`
   - or on GitHub, once MOD-01 has uploaded the handover branch:
     `https://github.com/productsteamcentricity/portfolio-review-dashboard/blob/handover/mod-01-to-mod-02-20261028/docs/handover/continuations/MOD-01_TO_MOD-02_SUCCESSOR_PROMPT_2026-10-28.md`
4. Copy everything from the line `=== BEGIN MOD-02 SUCCESSOR PROMPT (28 Oct 2026) ===` down to the line
   `=== END MOD-02 SUCCESSOR PROMPT ===`. Paste it as the first message of the new chat and send it. There is nothing
   to fill in.
5. Rename the new chat to exactly: `MOD-02 | Project-Wide | Master Project Moderator | ACTIVE`
6. If the new chat asks for access to `C:\dev\portfolio-review`, allow it. That is where the code lives.
7. From now on, talk only to MOD-02. Leave this chat and the new-build chat ("Build the new Portfolio Review
   dashboard") as they are. Do not give either of them new work; MOD-02 will tell the new-build chat what to do.

MOD-02 will first check the records against GitHub. It will not change anything in the product until that check is
done.

## 3. What MOD-02 will ask you to do next

- **Create two more chats**, the same way as above, each with its own prompt file from the folder
  `C:\dev\portfolio-review\.claude\worktrees\handover\docs\handover\continuations\`:
  - **ARC-01**, the reviewer that checks every change before it goes live. File
    `ARC-01_BOOTSTRAP_PROMPT_2026-10-28.md`; title `ARC-01 | Project-Wide | Codebase Integrity & Integration Guardian | ACTIVE`.
  - **EX-01**, the chat that finishes the tax work on the live dashboard. File
    `EX-01_TASK-TA-03_SUCCESSOR_PROMPT_2026-10-28.md`; title
    `EX-01 | Workstream A (existing dashboard) | Existing-dashboard implementation | ACTIVE`.
- **Perhaps paste one message into the new-build chat**, if MOD-02 cannot reach it directly. MOD-02 will give you
  the exact text.
- **Answer some decisions**, one at a time (section 4).

## 4. Decisions waiting for you

None of these has been answered yet. Each one is explained simply, with the options and a recommendation, in the
[decision log](../../project-control/DECISION_LOG.md) (section 2.3). MOD-02 will ask them one at a time. These matter
first:

| Decision | In one line | Recommendation |
|---|---|---|
| PD-02 and PD-03 | The tax work cannot go live until you answer two tax questions: are the "Listed AIF" funds Category III, and can crypto gains and losses be offset? | Reply "accept the safe defaults for questions 17 and 18". The page then says the AIF category is assumed and keeps crypto separate, and the tax work can go live once its checks pass |
| PD-09 | You said "no fallback" for a Crore cell that is not a number. Should "NA", "N/A", "-" or "nil" count as an empty cell (so the Lakh or rupee amount is used)? | Yes, so both dashboards behave the same |
| PD-08 | When one fund sits in several folios, which holding period should its single line show? | The oldest folio's, left blank when the folios disagree (as built) |
| PD-20 and PD-21 | May Claude download the public AMFI NAV file each month for the risk figures, and where may the risk tool live on this laptop? | Yes; a short local folder outside OneDrive and outside the code folder |
| PD-30 | Confirm that a monthly data update goes live only after you reply "publish". | Confirm |
| PD-27 | Review and approve the plan for the new dashboard, section by section, on your private approval page. | MOD-02 will first update the page, then ask you |

Some things only you can do, and MOD-02 will ask about them privately: approving the deletion of some temporary local
copies (PD-39), keeping a safety setting switched on permanently on this laptop (PD-40), and an optional
security step for a credential you hold (PD-41). The details are in the private note named below.

## 5. Where everything is

| What | Where |
|---|---|
| The prompt for MOD-02 | `C:\dev\portfolio-review\.claude\worktrees\handover\docs\handover\continuations\MOD-01_TO_MOD-02_SUCCESSOR_PROMPT_2026-10-28.md` ([open](MOD-01_TO_MOD-02_SUCCESSOR_PROMPT_2026-10-28.md)) |
| The main handover document | `C:\dev\portfolio-review\.claude\worktrees\handover\docs\handover\MASTER_HANDOVER_2026-10-28_v1.md` ([open](../MASTER_HANDOVER_2026-10-28_v1.md)) |
| The index of all handover files | `C:\dev\portfolio-review\.claude\worktrees\handover\docs\handover\README.md` ([open](../README.md)) |
| The handover branch (documents only, no code) | `handover/mod-01-to-mod-02-20261028`; on GitHub after MOD-01 uploads it: `https://github.com/productsteamcentricity/portfolio-review-dashboard/tree/handover/mod-01-to-mod-02-20261028` |
| The tax work branch (code, saved on GitHub) | `continuation/ex-01-task-ta-03-20261027`: `https://github.com/productsteamcentricity/portfolio-review-dashboard/tree/continuation/ex-01-task-ta-03-20261027` |
| Work that is on this laptop only | The new-build chat's 4 branches (milestone M1.4 and three fixes); MOD-02 has them saved to GitHub first |
| The private note | `C:\dev\private\handover\PRIVATE_SUPPLEMENT_2026-10-28.md` (where your own copy is kept is in the chat message, not in this file) |
| The live dashboard (unchanged) | `https://productsteamcentricity.github.io/portfolio-review-dashboard/` |

After the handover branch is approved and merged, the same documents are also in `C:\dev\portfolio-review\docs\handover\`
and on GitHub on the main branch.

## 6. How this message reaches you

- This file is the summary. When MOD-01 sends it to you in the chat, it pastes the full MOD-02 prompt (from its
  `BEGIN` line to its `END` line) inline right after it, so you can also copy the prompt straight from the chat.
- The two GitHub links to the handover branch (section 2, step 3, and section 5) are sent only if
  `git ls-remote origin refs/heads/handover/mod-01-to-mod-02-20261028` shows the branch on GitHub at that moment.
  If it does not, they are left out and you use the file on this laptop.
- The chat message also tells you where your own copy of the private note is kept. That location is never written in
  a project file, because the project files are public.
