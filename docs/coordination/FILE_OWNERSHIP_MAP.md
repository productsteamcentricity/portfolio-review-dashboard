# File ownership map: by chat

DRAFT, 24 Nov 2026, MOD-03 (CHAT-006); revised after the independent review. Labels: [V] verified, [I] inferred,
[U] unknown.

**This file extends [FILE_OWNERSHIP_AND_CHANGE_CONTROL.md](../project-control/FILE_OWNERSHIP_AND_CHANGE_CONTROL.md)
by reference.** That file stays the authority for areas, shared hotspots, the worktree isolation rule, the merge
readiness rule, the change-impact contract, ports and numbering. Its role names are older: read "Workstream A (EX-01)"
as the live-page chats below, "Workstream B (NB-01)" as the new-build chats, and "MOD-02" as MOD-03 [V: last verified
28 Oct; MOD-03 moderates since 17 Nov]. This file only assigns paths inside those areas to chats, so that several
chats can code at once.

## 1. Chats

| Chat | Role | Status |
|---|---|---|
| CHAT-015 MOD-05 | Moderator, integrator, writes every `app/src/model/**` file, codes contract types and wiring (from CHAT-013 MOD-04, 26 Nov 2026) | active |
| CHAT-013 MOD-04 | Moderator from 25 to 26 Nov 2026 (from CHAT-006 MOD-03) | historical record since 26 Nov 2026 |
| CHAT-014 EX-03 | Live page (`index.html` patches), refresh, the side-by-side test kit, live-page records and runbook (from CHAT-007 EX-02, 26 Nov 2026) | active |
| CHAT-007 EX-02 | Live page until 26 Nov 2026 | retired 26 Nov 2026 (three compactions) |
| CHAT-008 ARC-02 | Guardian: Gate B and Gate D reviews; ARC-01's sole rule-10 successor (CHAT_REGISTRY, registers-4); writes no product code | active |
| CHAT-009 NB-02 | New build: identifiers, ingest, classification, then M3b and M4 | active |
| CHAT-010 NB-03 | New build: financial engines (returns core, capital gains and tax); also `app/src/engine/scope.ts` | active (opened 24 Nov 2026) |
| CHAT-011 NB-04 | New build: data platform (Screener pack, monthly engine, drawdown, FoF) | active (opened 24 Nov 2026) |
| CHAT-012 ARC-03 | Second Guardian for the new build, same definition files, SHA-bound verdicts. **Not** the rule-10 Guardian (CLAUDE.md:83-84) | active (opened 24 Nov 2026) |

**Correction (registers-4, 26 Nov 2026).** The draft of 24 Nov proposed CHAT-010 to CHAT-013 for EX-03, NB-03, NB-04
and ARC-03. The chats actually opened as CHAT-010 NB-03, CHAT-011 NB-04, CHAT-012 ARC-03 and CHAT-013 MOD-04; EX-03 has
no number yet. Next free number: CHAT-014. Read "MOD-03" below as the Moderator (MOD-04 since 25 Nov 2026).

**Update (registers-5, 27 Nov 2026).** CHAT-014 is EX-03, the successor of CHAT-007 EX-02 (26 Nov 2026), and holds both
the EX-02 paths and the EX-03 paths below: read "EX-02" in §2 as EX-03 (CHAT-014). CHAT-015 MOD-05 is the Moderator
since 26 Nov 2026: read "MOD-03" below as MOD-05. Next free number: CHAT-016.

Chat numbers are never reused; the Moderator confirms each number when the chat opens. If MOD-03 cannot open a chat, it prepares the title and prompt and asks the owner to open it [V charter:27-28];
until a PROPOSED chat opens, its paths stay with MOD-03 and its items show "waits on CHAT-0xx opening".

## 2. Path globs to owning chat

Unlisted paths keep the owner given in FILE_OWNERSHIP_AND_CHANGE_CONTROL.md.

| Path glob | Owner | Notes |
|---|---|---|
| `index.html`, `tools/patches/**`, `tools/regression/**`, `tools/*.js`, `tools/browser-checks/**` | EX-02 | D-016 patches only; D-028 scope. `tools/engine-host.js` (`load()`, `build()`) and `tools/make-sample-base.js` (`build`, `buildFamilyB`, `AS_ON`) are frozen APIs that new-build fixtures and parity tests depend on [V FILE_OWNERSHIP_AND_CHANGE_CONTROL.md:19] |
| `buildtools/**`, `docs/refresh-log/**`, `docs/MONTHLY_REFRESH.md`, data blocks via the refresh | EX-02 alone during a refresh window, on `data/YYYY-MM-refresh` only [V FILE_OWNERSHIP_AND_CHANGE_CONTROL.md:20] | outside a window: EX-03 (or MOD-03 until it opens) for runbook text, merged before about 13 Dec; one writer per file per window |
| `buildtools/reckoner/**` | EX-03 | owner-blocked (LP-13); work off a refresh branch needs a recorded decision first, because the current control allows `buildtools/*` changes only on a refresh branch; synthetic fixtures only until D-2 |
| `docs/monthly-prds/**`, `docs/HANDOVER.md` | EX-03 | MOD-03 reviews |
| `app/src/engine/match/**`, `data/identifiers/**` | NB-02 | contract I-28 |
| `app/src/ingest/vendor/**` | NB-02 | contract I-30 |
| `app/src/engine/classify/<new files>`, `data/owner/fund-aliases.json`, `data/owner/amc-aliases.json` | NB-02 | alias rows need PD-36 per alias. Existing classify files (`liquidity.ts`, `asset.ts`, on main and wired into the M1.4 overview [V ls-tree; engine/review.ts:18]) change only as wiring (Class C, MOD-03 integrates) |
| `data/owner/category-benchmarks.json` | NB-02 | owner-governed: rows need the named approver [V M2-PLAN-v2:212] |
| `app/src/engine/lookthrough/**` except `fof.ts`, `app/src/engine/overlap.ts`, `app/src/engine/aggregate/amc.ts`, `data/owner/rating-map.json` | NB-02 (M4) | contract I-33 (types written by MOD-03) |
| `app/src/engine/scope.ts` | NB-03 | first consumer of I-45 (decision D8, 25 Nov 2026, on NB-03's M3a plan); NB-02's M4b imports it and does not edit it |
| `app/src/engine/lookthrough/fof.ts`, `app/src/engine/history.ts` | NB-04 (M12b) | contract I-33 |
| `app/src/engine/returns/performance.ts` | NB-02 (M3b) | NB-02 also makes M10's third-source edits in this file (M10u) |
| `app/src/engine/returns/{portfolio-returns,stock-cagr}.ts` | NB-04 (M3b data side; registers-5, 27 Nov 2026) | E-147, E-148; not on `main` yet [V 27 Nov] |
| `app/src/ingest/price-file.ts` | not built | no price-file reader in test build 1; built after it, once the owner supplies the file layout (registers-5) |
| `app/src/engine/returns/{xirr,irr-tree,contributions,scope}.ts`, `app/src/ingest/irr-file.ts` | NB-03 (M3a) | contracts I-31, I-32, I-45 |
| `app/src/exports/xlsx/irr-template.ts`, `app/src/engine/returns/irr-aggregate.ts` | NB-03 | the blank transactions (IRR) file template and the IRR tree's client, asset and product aggregate, both from PR #57 [V git log, 27 Nov] |
| `app/src/ingest/capital-gains.ts`, `app/src/engine/tax/**`, `data/owner/tax-rules.json`, the KA known-answer file, `app/src/exports/xlsx/cg-template.ts` | NB-03 (M7a) | financial-domain review mandatory; I-37 parity with `data/refdata/TAX_RULES.json` (EX-02) |
| `app/src/ingest/screener-pack/**`, `app/src/services/screener-store.ts` | NB-04 (M10) | no pack content ever committed (D-026) |
| `scripts/monthly-update/**`, `product_bank/**`, `app/src/ingest/index-series.ts`, `app/src/engine/drawdown.ts` | NB-04 (M11a, M12a) | contracts I-39, I-44 |
| `app/src/model/**` | MOD-03 writes every file | the chat named in INTERFACE_CONTRACTS §2 specifies the contract and proposes changes |
| `app/src/observations/**` (framework) | MOD-03 (M5a) | rules folder assigned at M5b |
| `app/src/exports/pptx/text-lint.ts` | MOD-03 | the existing D-029 lint [V on main]; M5a reuses or extends it |
| `app/src/engine/validate/**`, `app/src/services/audit-log.ts` | MOD-03 (M13) | contracts I-41, I-42 |
| `app/src/exports/xlsx/{spec,writer,registry}.ts`, `app/src/exports/pptx/{manifest,deck,chrome,paginate,measure}.ts`, `app/src/config/slide-manifest.json` | MOD-03 | contract I-35; milestone chats add their own sheet and component files |
| `app/src/exports/xlsx/sheets/<new>.ts`, `app/src/exports/pptx/components/<new>.ts` | the milestone's chat | one new file per sheet or component |
| `app/src/ui/sections/s<N>-*.tsx` (new sections 3 to 9) | the milestone's chat that first fills the section | a second chat adding to a section asks MOD-03 |
| `app/src/ui/{App,store}.tsx?`, `app/src/ui/wiring.ts`, `app/src/ui/sections/s1-uploads.tsx`, `app/src/ui/components/**`, `app/src/views/overview*.ts` | MOD-03 integrates (hotspots) | rule: one new component file plus one appended line per slot. `s1-uploads.tsx` exists [V] and will get slots from M2.3 (NB-02), M3a and M7a (NB-03), M10 (NB-04), M6 (MOD-03). `wiring.ts` is the only file that may import SheetJS or PptxGenJS [V CLAUDE.md:229]. Existing components (`upload-stages`, `import-report`, `validation-panel`, `source-register`, `disclaimer` and others [V ls-tree]) change only through MOD-03 |
| `tests/side-by-side/**` | EX-03 (CHAT-014) | the side-by-side test kit (live page against `/next/`); other chats read and call it only |
| `tests/<kind>/<area>/**` | the chat owning `<area>` | every test starts with its `// covers:` line. `tests/exports/xlsx/office-scripts.test.ts` is M1.4's (exports owner) [V on main]; the TA-26 guard test (LP-10) gets its own new path outside `tests/exports/`, owned by EX-03 |
| `.github/workflows/**`, `CLAUDE.md`, `.claude/agents/**`, `package.json`, `package-lock.json`, `scripts/build.mjs`, `scripts/check-next.mjs`, `scripts/validation/**` | MOD-03 | Guardian review for any change. Known cross-area change: LP-01's head `d7683a0` already edits `CLAUDE.md`, `data/refdata/TAX_RULES.json`, `data/refdata/VINTAGE.json` and `docs/TESTING.md` [V git diff 0e483b6 d7683a0]; accepted as part of LP-01 |
| `docs/coordination/**`, `docs/project-control/**`, `docs/new-build/07-implementation-roadmap.md` | MOD-03 | EX-03 may draft. Exception: NB-02's in-flight roadmap edit on `aa9c943` [V] is accepted |

## 3. Shared files: rule for touching them

The hotspot table of FILE_OWNERSHIP_AND_CHANGE_CONTROL.md applies (DECISIONS, KNOWN_ISSUES, CHANGELOG, PROJECT_STATE,
TESTING, refdata, parity ledgers, workflows, CLAUDE.md). Added for parallel new-build work:

| Shared file | Rule |
|---|---|
| `tests/fixtures/make-books.ts`, `tests/fixtures/make-monitors.ts` (new on `1e3d7df` [V]) | Add new builder functions only; never change an existing book's or monitor's values (they are known answers for other chats). A change to an existing one is a MOD-03 PR with every affected test updated |
| `tests/helpers/legacy-engine.ts` (new on `aa9c943`, extended on `1e3d7df` [V]) | Append helpers only; NB-02 owns it; contract I-43 |
| `tests/parity/README.md` (edited by both S1 and S3 [V]) | Append; second to merge takes main |
| `docs/new-build/05-feature-parity-matrix.md` | Each branch edits only the rows of its own E-/U-/C- ids. The second branch to merge takes main and keeps both sides |
| `docs/new-build/08-regression-test-plan.md`, `docs/ARCHITECTURE.md`, `docs/DATA_DICTIONARY.md` (S1 edits all three [V git diff 0e483b6 aa9c943]) | MOD-03 owns; milestone branches append their own rows or sections; second to merge takes main |
| `tests/parity/*-ledger.json`, `tests/parity/*-basis.json` | Each branch adds or retires only its own entries; ids from its allocated range; bases move only under I-43 |
| `app/src/model/**` contract files | MOD-03 writes them, in a PR whose title names the contract id (see [INTERFACE_CONTRACTS.md](INTERFACE_CONTRACTS.md)) |
| `exports` registries (I-35), `ui/App`, `ui/sections/s1-uploads.tsx`, `ui/wiring.ts` | Append one line per new sheet, component, slot or section; MOD-03 resolves conflicts |
| CHANGELOG, PROJECT_STATE, KNOWN_ISSUES, DECISIONS | As today: append, own number range, second to merge takes main. MOD-03 allocates ranges to the new chats when they open and records them in the numbering table of FILE_OWNERSHIP_AND_CHANGE_CONTROL.md |

## 4. Worktrees, ports and heavy runs

- One chat, one task, one worktree, one branch (isolation rule there, unchanged). New chats push from their own worktree.
- No branch is deleted (CLAUDE.md rule 8 [V line 46]). A worktree is removed only on the owner's word, after
  `git branch -r --contains <head>` shows its head on origin [V FILE_OWNERSHIP_AND_CHANGE_CONTROL.md:66-67].
- Ports for new chats come from 8140 upward (rule there). Proposed: EX-03 8140-8149, NB-03 8150-8159, NB-04 8160-8169 [I].
- **Heavy test runs:** one full IST plus UTC suite on the machine at a time, across all chats. A chat runs the full
  Step 8 only on the head it names for review; lighter runs use the affected test folders [I from the bottleneck audit:
  overlapping runs took hours instead of minutes].
- Never write in another chat's worktree; reviews use `git show` or the Guardian's own scratch worktrees.
