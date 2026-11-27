# Critical path

DRAFT, 24 Nov 2026, MOD-03 (CHAT-006); revised after the independent review. Labels: [V] verified, [I] inferred,
[U] unknown.

**Phase approval [V OWNER_DECISIONS_MOD-03.md:35, :47].** Only M1.4 (P03-S01, complete) and M2 (P03-S02) are approved.
Steps 3 onward start only after the owner answers whether PD-65 lets MOD-03 start milestones beyond M2 without a
per-phase approval (owner card), or approves the phase.

## 1. New build to switch-over

The roadmap's chain (07-implementation-roadmap.md §4) is a plan order [V]. The code dependencies are looser [I]:

```
M2.1a S1 merge -> M3b performance -> M4b scopes and overlap -> M5b rules and snapshot -> M8 rebalancing -> M9b deck -> M15
        ^ M3a returns core (B), M4a look-through maths, M5a framework run in parallel before it
M3a -> M7a engine; M7a and M7b cost/IPS/CVS/MFA feed M8; M6, M10, M11, M12, M13, M14 run off the path
```

**Status, 27 Nov 2026 (registers-6) [V git log --first-parent origin/main]:** test build 1 is complete on `/next/`: M2.1
(wired, PR #54), M3a (wired, PR #51) and M3b (views PR #59; data engines PR #61, not wired) are merged, and the side-by-side
kit compares the two builds on fund matching and every performance bucket (PRs #60, #62, #63). The owner's acceptance
(Gate E) is pending. Next on this path: the M3b follow-up, the conditions set at the review of PR #61 before the direct-equity CAGR (E-148) is wired (the per-stock provenance date, a figure date that does not depend on row order, wording, and the owner's answers on month labels against true days); and M7a round 2 (tax). The table below is
the draft's of 24 Nov.

| Step | Gate to pass | Owner | Earliest | Blocked by |
|---|---|---|---|---|
| 1. M2.1 S1 merged | Gate B GO bound to `aa9c943` [V ARC-02-state.md:187-189]; Gates C, D next; owner demo and "publish" (Gate E) before the merge | NB-02, ARC-02, MOD-03, owner | target Fri 11 Dec [I from the M2 sprint plan] | OPS-01 merge identity; owner "publish" |
| 2. I-28 row ("types frozen, semantics versioned"), I-29 widening decision, I-30 with C-01, I-41, I-42, I-43 on main | contract PRs; byte-identical `/next/` for C-01; independent Gate C | MOD-03 | week of 30 Nov [I] | none for the M2-tied contracts; I-31, I-32, I-33, I-35, I-45 wait on phase approval |
| 3. M3a returns core | Gates A-E, financial review | NB-03 PROPOSED | after phase approval, the chat opening, and the I-31, I-32, I-45 type files | phase approval; chat opening (owner action if needed); the KI-186 acceptance part waits on LP-01 merging [V roadmap:210] |
| 4. M3b performance | Gates A-E | NB-02 | after step 1, M2.3 and M3a | M2.3 merge; phase approval |
| 5. M4a/M4b | Gates A-E | NB-02 | after step 4 | phase approval; Q-24 for real PMS/AIF data only |
| 6. M5b | Gates A-E | NB-03 or MOD-03 | after steps 4-5 | phase approval (D-030 approved) |
| 7. M7a/M7b | Gates A-E, financial review | NB-03 | M7a reader after phase approval; M7a engine after M3a (I-32) | **M7a:** PD-16 items 1 to 7 (1, 2, 6, 7 calculation logic; 3 privacy; 4, 5 outside answers) [V DECISION_LOG.md:548-560]; LP-01 merged so I-21 is stable [V project-control/INTERFACE_CONTRACTS.md:57]. **M7b:** M2.1b and its owner blockers (correction-order question, PD-36, S2-Q3), PD-05, PD-10 |
| 8. M8 | Gates A-E | to be assigned | after 6, 7 | PD-37 (default yes); phase approval. No M11 dependency: the roadmap's M8 scope names none [V roadmap:300-322] |
| 9. M9b, M15 | AC-20; all 24 AC; owner sign-off | MOD-03 | last | REQ-021 sign-off, PD-26, PD-32 |

**Biggest risks on this path:**
1. **M2.1 S2a (matcher corrections) sits behind the live page's queue.** Under D-028 a calculation correction goes to the
   live page first [V DECISIONS.md:268-272; M2-PLAN-v2:185-189]; new-build first needs an owner exception, and PD-28 as
   written covers only C2-C6 [V DECISION_LOG.md:668-680]. The live queue is LP-01 then LP-02. Mitigation: M3b and M4
   build on S1 (parity matcher); S2a is recorded in I-28 as a scheduled breaking change, and consumers re-baseline their
   known answers in the S2a PR; the owner card asks the correction-order question separately from PD-28.
2. **0 of 385 parity rows are at "parity"** [V]. Mitigation: each milestone moves its rows when its ledger proves them
   (NB-FU), so M15 is not one large audit.
3. **Review throughput.** One Guardian and one heavy test process at a time limit merges [I]. Mitigation: ARC-03
   PROPOSED for the new build (not the rule-10 Guardian); one heavy run at a time.
4. **Planned inputs not in git:** `data/owner/*`, the KA known-answer file [V]. (Unzip is not a risk: the vendored JSZip
   is decided [V roadmap:334].)
5. **Phase approval.** Without the owner's answer, nothing beyond M2 starts [V OWNER_DECISIONS_MOD-03.md:35].

## 2. Live page through the December window

**Status, 27 Nov 2026 (registers-5) [V git log --first-parent origin/main]:** steps 1 to 5 are done: LP-01 (TA-03)
merged in PR #36 and registers-4 in PR #42. Since then KI-032 (PR #47), KI-301 (PR #53) and LP-16b (PR #50) went live
on the owner's word (live page `04079A77`), and the runbook's risk chain merged (PR #56), so step 6's preparation is
done: the refresh waits for the owner's files (about 13 to 17 Dec). Step 7 stays after the window. The table below is
the draft's of 24 Nov.

| Step | Owner | When | Blocked by |
|---|---|---|---|
| 1. LP-01 take-main: done, committed as `d7683a0` (merge of `8cb775e` and `0e483b6`, 24 Nov 23:16; 86 commits ahead of origin, unpushed) [V git] | EX-02 | done | none |
| 2. LP-01 Gate A with a from-scratch replay of `tools/patches/*` in file-name order (the tax patches dated 2026-10-27 now sort before three patches from 22-23 Nov that also edit block 07 [V names; I risk]); the replay moves the I-43 parity bases | EX-02 | this week | none |
| 3. LP-01 Gates B, C, D | ARC-02, MOD-03 | before 13 Dec if possible | OPS-01 |
| 4. LP-01 Gate E and publish | owner | before 13 Dec, otherwise after the window | PD-01, PD-04, PD-44; the owner's "publish" |
| 5. OPS-02 registers-4 merged (sanitised; names ARC-02 as ARC-01's rule-10 successor) | MOD-03 | right after LP-01 | step 4 |
| 6. December refresh (LP-21): runbook updated (LP-19, merged before about 13 Dec), October archived, November inbox open | EX-02 (MOD-03 or EX-03 PROPOSED for the runbook before the window) | prep now; files due about 13-17 Dec [I] | owner files; "publish" |
| 7. LP-02 TA-05, then LP-06 batches | EX-02 | after the window | step 4 |

**Window rule [V owner M2 approval: sprints "pause for the monthly refresh windows", OWNER_DECISIONS_MOD-03.md:47; dates I]:**
no code merges during the refresh window (about 13-19 Dec); every open branch takes main after the refresh merges.
M2.1 S1 aims to merge before it. AC-22 (CI change) is scheduled outside the window: before 13 Dec or after the
refresh merges.
