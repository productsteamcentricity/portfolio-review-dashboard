# Coordination (owner charter PD-65, 24 Nov 2026)

How the build is organised: what each module is, what it depends on, who owns which files, and what can be built in
parallel. Maintained by the Moderator (MOD-03). The product scope is unchanged; these files change how it is built.

| File | What it holds |
|---|---|
| [CODING_MAP.md](CODING_MAP.md) | Every module (new build NB-M*, live page LP-*, operations OPS-*) with its 15 fields |
| [MODULE_DEPENDENCY_MAP.md](MODULE_DEPENDENCY_MAP.md) | Class A (independent), B (partly dependent), C (interdependent); the graph; what starts now |
| [INTERFACE_CONTRACTS.md](INTERFACE_CONTRACTS.md) | Contracts I-28 onward (I-01 to I-27 stay in `docs/project-control/`) |
| [FILE_OWNERSHIP_MAP.md](FILE_OWNERSHIP_MAP.md) | Which chat writes which paths; shared-file rules (extends `docs/project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md`) |
| [CRITICAL_PATH.md](CRITICAL_PATH.md) | The steps that gate switch-over and the live page through the December window |
| [DEVELOPMENT_BACKLOG.md](DEVELOPMENT_BACKLOG.md) | The prioritised queue of executable tasks and the owner-blocked items with their fallbacks |
| [CONTEXT_COMPACTION_TRACKER.md](CONTEXT_COMPACTION_TRACKER.md) | Verified compaction count per chat (succession at three) |
| [CHAT_SUCCESSION_REGISTER.md](CHAT_SUCCESSION_REGISTER.md) | Predecessor and successor of every chat |
| [MODEL_ROUTING_LOG.md](MODEL_ROUTING_LOG.md) | Which model tier does which kind of work |

Existing records are not duplicated: the chat registry is `docs/project-control/CHAT_REGISTRY.md`, decisions are in
`docs/project-control/DECISION_LOG.md` and `docs/DECISIONS.md`, tasks in `docs/project-control/TASK_REGISTER.md`.

**Phase approval.** Where a row says "phase approval" (PA), read it as met: under PD-65 the Moderator starts roadmap
milestones inside the approved scope without a separate owner approval (Moderator decision, 24 Nov 2026). What still
needs the owner: business and financial-logic decisions listed as owner-blocked, and each sprint's demonstrated output
(Gate E) before it is marked complete. The live page goes live only on the owner's word.
