# Known issues and regression risks

**Snapshot:** 28 Oct 2026 (IST), written by MOD-01 for the handover to MOD-02 on branch
`handover/mod-01-to-mod-02-20261028` (base `main` 6443826, PR #16).
**Owners from now on:** EX-01 files and fixes live-page defects (KI-183 to KI-186); NB-01 its own; MOD-02 allocates
new ranges; ARC-01 keeps the regression-risk register current at every Gate B.

[docs/KNOWN_ISSUES.md](../KNOWN_ISSUES.md) stays the authoritative defect register. This file summarises it, adds
the defects found but not yet filed, compares the two builds, and lists the risks that a change could break
something that works today. Related: [DECISION_LOG.md](DECISION_LOG.md),
[REQUIREMENTS_AND_CHANGE_REGISTER.md](REQUIREMENTS_AND_CHANGE_REGISTER.md).

Evidence labels: [VERIFIED] (with the evidence), [INFERRED], [UNCERTAIN], [UNKNOWN].

**Anchors** [VERIFIED 28 Oct]: `main` = `origin/main` = 6443826; live `/` = `index.html` on main, MD5
12B5E5727FCA01EF2EA162C59913F01D, 16,837,249 bytes (Pages verified 27 Oct; `/next/` 46,905 bytes); the tax batch
TA-03 on `continuation/ex-01-task-ta-03-20261027` at 0f1c5d3 (pushed; page MD5 5F1C2FC5…), whose parent 97a7d69
(`fix/legacy-batch-3-tax-p3-r2`, local only, contained in the continuation branch) has page MD5 0713C6BE….

## 1. Counts by status and priority

Two priority scales exist. KI-001 to KI-035 use High, Medium and Low; KI-036 to KI-046 and KI-026 are "inherited,
not re-tested"; from KI-047 on the scale is P0 (wrong numbers, data integrity or security that could reach a client)
to P3. "Other" is KI-044 (no longer reproduces) and KI-135 (duplicate of KI-126).

| Group | Main (the live page): fixed / partly / open / other | Continuation branch: fixed / partly / open / other |
|---|---|---|
| High (KI-001 to KI-003) | 1 / 0 / 2 / 0 | 1 / 0 / 2 / 0 |
| Medium | 2 / 0 / 10 / 0 | 2 / 0 / 10 / 0 (KI-022's text says fixed in T2; its heading is still under "open") |
| Low | 1 / 1 / 17 / 0 | 1 / 1 / 17 / 0 |
| Inherited (KI-036 to KI-046, KI-026) | 0 / 0 / 11 / 1 | 0 / 1 (KI-037) / 10 / 1 |
| P0 | 8 / 1 (KI-062) / 13 / 0 | 8 / 1 / 13 / 0 |
| P1 | 4 / 0 / 25 / 0 | 15 / 0 / 24 / 0 |
| P2 | 6 / 0 / 26 / 0 | 16 / 1 (KI-177) / 25 / 0 |
| P3 | 2 / 0 / 14 / 1 | 5 / 0 / 14 / 1 |
| No priority (KI-119, KI-138) | 2 / 0 / 0 / 0 | 2 / 0 / 0 / 0 |
| **Total** | **26 / 2 / 118 / 2 (148 ids)** | **50 / 4 / 115 / 2 (171 ids)** |

[VERIFIED: the P0 to P3 rows were re-parsed on 28 Oct from `git show origin/main:docs/KNOWN_ISSUES.md` and
`git show origin/continuation/ex-01-task-ta-03-20261027:docs/KNOWN_ISSUES.md`, with KI-114 and KI-120 ("Fixed in
fix batch 1b") counted as fixed and KI-135 as a duplicate. The High, Medium, Low and Inherited rows are from the
handover investigation's parse of the same files and were spot-checked.] The register holds KI-001 to KI-148 on main
and adds KI-160 to KI-182 on the continuation branch. KI-149 to KI-159 are not filed on main (NB-01 uses KI-150 and
KI-151 on its local branch). KI-183 and KI-184 are referenced but filed nowhere (section 5).

## 2. Open P0 issues on the live page

There are 13 open P0 issues plus KI-062 in part, the same on main and on the continuation branch. They are listed
one by one because a range would wrongly include KI-055, which fix batch 1a fixed. [VERIFIED: KNOWN_ISSUES.md on
main, the audit table.]

| KI | What goes wrong | Owner decision | Planned task |
|---|---|---|---|
| KI-049 | IRR aggregates are never reconciled to the base file or validated | OD-4 | TA-18 [INFERRED] |
| KI-050 | Renamed or legacy scheme names match a different fund | OD-5 (C4, C5 aliases) | TA-09, TA-18 [INFERRED] |
| KI-051 | Bonds, unlisted shares and MLDs are treated as mutual funds | OD-6 | TA-18 [INFERRED] |
| KI-052 | FUND_RANKS and MF_RISK are keyed under stale spellings, unseen by the AI Analyst | OD-23 | TA-12 |
| KI-053 | MF Analysis risk ratios come from two unanchored fuzzy matchers | none | TA-12 |
| KI-054 | The Direct-plan view substitutes or drops schemes | none | TA-12 |
| KI-056 | The vendor Debt Analytics file is misread in the bonds slot | none | TA-13 |
| KI-057 | Holdings with no market value are dropped silently | OD-8 | TA-18 [INFERRED]; see PD-14 |
| KI-058 | Uploaded monitor expense ratios are stored 100 times too large | OD-11 | TA-13 |
| KI-059 | A missing base expense ratio is filled with an unsourced estimate | OD-9 | TA-18 [INFERRED] |
| KI-060 | An expense-ratio override above 300 bps is cut 100 times on the next load | none | TA-13 |
| KI-064 | The Taxation rupee ledger misallocates long and short term (the PMS and AIF part is handled on the tax branch; switch-ins remain) | yes | TA-03 (part), TA-18 [INFERRED] |
| KI-066 | IPS compliance verdicts are wrong: the look-through basis and a negative hybrid remainder | OD-13 (accepted 19 Oct; status disputed) | TA-19, PD-10 |
| KI-062 (part) | AI Analyst degraded Exit: the bookkeeping is fixed; the fallback to Retain (OD-14) is not built | OD-14 | TA-18 [INFERRED] |

Task mapping: the audit's fix order names the issues of TA-12 (audit batch 2) to TA-17 (audit batch 7) [VERIFIED
[audits/2026-10-19-full-audit.md](../audits/2026-10-19-full-audit.md)]. Rows marked [INFERRED] are owner-decided OD
items the fix order does not place, so they sit in TA-18.

## 3. Open P1 issues on the live page

25 on main. The continuation branch has 24, because the tax batch fixes KI-130 (through KI-168). [VERIFIED as in
section 1.]

| KI | What goes wrong | Planned task |
|---|---|---|
| KI-069 | Taxation joins lots on exact names; the distributor split is ignored (OD-15) | TA-13 |
| KI-070 | Taxation ignores common transaction types (OD-16) | TA-13 |
| KI-071 | Two gain or loss definitions disagree (OD-18) | TA-18 [INFERRED] |
| KI-072 | Unmatched PMS, AIF and SIF rows are filed under mutual-fund buckets in the workbook | TA-12 |
| KI-073 | Missing benchmark series show as rows of dashes | TA-15 |
| KI-074 | The base loader can read the wrong sheet or header row (header only searched in rows 1 to 5) | TA-13 |
| KI-075 | The IRR parser silently drops or misdates rows | TA-13 |
| KI-076 | The Direct and Regular monitor slots can be swapped with no warning | TA-13 |
| KI-077 | The SOA Product Category must be exactly "PMS" or "AIF" | TA-13 |
| KI-078 | PPTX tables and panels sized by fixed counts overflow | TA-15 |
| KI-079 | Exports ignore the review's money unit (Lakh) | TA-15 |
| KI-080 | AI Analyst rounding and thresholds in absolute Rs Cr (OD-19) | TA-18 [INFERRED] |
| KI-081 | The CVS slide calls assumptions "IRR%" and omits the inflation rows | TA-15 |
| KI-082 | The deck drops MF Analysis disclosures and the client-scope label | TA-15 |
| KI-083 | PMS and AIF data are captioned with the mutual-fund date | TA-15 |
| KI-084 | The workbook's liquidity percent sits in the Investment Amount column | TA-15 |
| KI-085 | The workbook's analytics sheets lack vintage and coverage (OD-20) | TA-15 |
| KI-086 | CVS typed values revert to house defaults on a full redraw | TA-17 |
| KI-087 | A cleared as-on date becomes "20 May 2026" | TA-16 |
| KI-088 | Blocked browser storage blanks tabs and breaks the deck | TA-16 |
| KI-089 | Picking the same file again is ignored | TA-17 |
| KI-101 | A hybrid-tagged equity fund can match the wrong hybrid record on brand words | TA-12 [INFERRED] |
| KI-102 | An Exit whose destinations are all cut by the AMC cap stays an Exit with 100% unplaced (with OD-14) | TA-18 [INFERRED] |
| KI-129 | Non-credit labels (derivatives, ADR or GDR, "D") are counted as credit in the rating mix | unassigned (new build: TB-11) |
| KI-130 | Tax harvesting ignores the long-term exemption (fixed on the tax branch by KI-168) | TA-03 |

**Other open issues** on main, by id only (see KNOWN_ISSUES.md for each):
- High: KI-002 (Overlap slide has no matrix), KI-003 (post-rebalancing Overlap slide never produced); both TA-15.
- Medium: KI-004, KI-005, KI-008 (unescaped workbook text, no CSP; TA-14), KI-009, KI-012, KI-013, KI-022 (fixed on
  the tax branch), KI-024, KI-031, KI-032.
- Low: KI-011, KI-014, KI-016, KI-017, KI-018, KI-019, KI-020, KI-021, KI-023, KI-025, KI-027, KI-028, KI-029,
  KI-030, KI-033, KI-034, KI-035; KI-015 in part.
- Inherited: KI-026, KI-036 to KI-043, KI-045, KI-046.
- P2: KI-090 to KI-099, KI-103, KI-104, KI-108 to KI-111, KI-113, KI-115, KI-116, KI-121, KI-131 to KI-133, KI-139,
  and the new-app items KI-147 and KI-148.
- P3: KI-105 to KI-107, KI-117, KI-118, KI-122, KI-123, KI-125 to KI-128, KI-134, KI-136, KI-137.

## 4. What the tax batch fixes, and what stays broken until it merges

On the live page today all of these defects are still present. They are fixed only on the unmerged continuation
branch [VERIFIED KNOWN_ISSUES.md on 0f1c5d3]:
- KI-160 to KI-182 (the 23 tax findings TX-01 to TX-23): 22 fixed, KI-177 in part (its step-up waits for PD-05).
- KI-099 (ETF, index fund and FoF products skip the mutual-fund tax branch) and KI-130 (harvesting ignores the
  exemption).
- KI-037 in part, and both parts of KI-022 (part T2).

The batch is not verified as a whole: never run in CI, no browser QA of the combined page, and part T5 is an
unreviewed WIP checkpoint [VERIFIED CR-0008 line 503 and the 0f1c5d3 commit message]. See risk RR-09.

## 5. Defects found but not yet filed

| Proposed id | What goes wrong | Where | Evidence | File in | Fix in |
|---|---|---|---|---|---|
| KI-183 | `computeReview` throws when an Asset Name (4 of 5 test words; the fifth leaks text), Client, Category or Product Name (5 of 5) equals a built-in object word such as "constructor" or "toString"; AMC (1 of 5) and Distributor (4 of 5) names leak built-in text into the review; Instrument is unaffected | live page, engine block | [VERIFIED] reproduced 28 Oct on main (12B5E572) and on the T5 page with a synthetic probe kept in the private handover folder (`C:\dev\private\handover\mod-01-scratch\ki151-probe.js`) | TA-05 (until then NB-01's KI-151 docs may cite KI-183 as "planned") | TA-05 (prototype-safe maps) |
| KI-184 | `parseBaseRows` never reads the base file's ISIN column, so the foreign-share marker (D-040 point c) uses only the ISIN of the matched stock entry; the new reader does not read it either | live page, engine block | [VERIFIED] cited as a comment only in `tools/patches/2026-10-27-tax-5-followups.js` on 0f1c5d3: header item 8 at lines 49 to 50; the edit at lines 119 to 124 (its label on line 120) [VERIFIED: `git show 0f1c5d3:<path> \| cat -n`, 30 Oct] | TA-03 T5 docs | TA-06 (later; needs a parity-ledger update) |
| (KI-185 suggested) | `tools/check-invariants.js` ENGINE_KEYS omits `amcKey` and `xirr`, and the tax branch adds `taxClassify`, `taxApplyAssumptions`, `taxAssumeFor` and `taxDefaults` without updating it | tooling | [VERIFIED] check-invariants.js lines 47 to 49 on main | EX-01's range | TA-22 |
| (no id yet) | The documented rebuild rule ("check out `index.html`, then every patch in file-name order") cannot run on HEAD: 4 of 9 patches refuse, safely | docs and tooling | [VERIFIED] scratch replay on 28 Oct | none | TA-23 |

Priority for KI-183 is for EX-01 to set when filing. A real label equal to those words is unlikely, but the result
is a crash [INFERRED]. KI-183 is the live twin of NB-01's KI-151 (new app, handled with Maps on its branch); each
should cite the other (TB-27).

**Register entries to correct** (with TA-08 and TC-15) [VERIFIED by reading]:
- KI-006 still says "Open owner question OD-26" (line 105), but D-021 accepted OD-1 to OD-28 (PD-18).
- KI-022 sits under an open heading on the continuation branch though its text says both parts are fixed in T2.
- KI-066 is said to "wait for the owner's decision" although OD-13 was accepted; one clarifying answer is needed
  (PD-10).
- From the second export: close KI-046; KI-016 at 2.5%; KI-005 as a plain percent; KI-026 wording.
- KI-147 and KI-148 are new-app items in the live register. KI-148 is marked fixed by NB-01 when G1 is integrated.

## 6. Where the two builds differ

The live page and the new build should apply the same rules. These differences are known [VERIFIED from D-039,
D-040, D-041 and the base-file parity ledger unless marked].

| Topic | Live page | New build | Decision or open question | Task |
|---|---|---|---|---|
| Crore cell holding text (KI-147) | D-041 point 4: the text is blanked and the Lakh or rupee column is used | D-039 point 1(a): invalid, holding excluded and listed (the owner's "no fallback"); blank and placeholders fall back (1(b), 1(c)); applies to invested value, market value and gain | D-042 (planned) aligns the live page; PD-09 on placeholders | TA-05; AG-13 and AG-14 retire |
| Single equity-ETF fund-of-funds | Defaults to 90/90 (equity-oriented), labelled | The analyst chooses (TR-6, TR-18) | PD-06 | none until answered |
| Slab rate for ordering set-off | 30% assumed, labelled (D-040 e) | No default; a dash until set (D-036 point 3) | PD-07 | none until answered |
| Letter case of Asset Names | Folded since fix batch 4 (D-041 point 6) | Folded | Aligned; the owner may reverse both (BF-26, PD-12) | none |
| Letter case of client and distributor names | Exact label (after spaces are collapsed) | Exact label, with a warning when only case differs | Aligned in effect; PD-13 asks whether to fold | none |
| Merged folios: purchase date and holding days | Earliest date; oldest folio's age or blank (D-041 point 2) | First row's date and days (KI-148) | G1 aligns the new build (not integrated); PD-08 for both | TB-07 |
| Blank Asset Name | Equity (BF-14) | Unknown | Recorded in the parity ledger | none |
| Unknown Asset Names | Label kept as is | Unknown and listed | BF-19, PD-11 | none |
| "Total" rows | Skipped and counted in a notice (KI-142) | Read as a holding with a warning; G1 may change this [UNCERTAIN until integrated] | PD-42 (a) | TB-07 |
| Header search | First 5 rows | First 20 rows | Recorded; KI-074 open on the live page | TA-13 |
| ISIN column | Not read (KI-184) | Not read | Shared gap | TA-06 |
| Built-in object words as labels | Crash or leaked text (KI-183) | Handled (KI-151, Maps) | Fix the live page | TA-05 |
| Tax rule tables | REFDATA.TAX_RULES: 25 rows on main, 34 on the tax branch | TR-1 to TR-21 (design table v1) | Kept in step by hand; the dated usual bucket (TR-7, LD-11) is matched by part T5 | TA-03, TB-14 |
| Fund-pair overlap threshold | 40% | 35% (D-030) | PD-31 | TA-25 |
| Dashes in generated sentences | Present (KI-126, KI-135) | Not allowed (D-029) | PD-31 | TA-25 |

## 7. Regression-risk register

A regression is something that works today and breaks because of a change. Likelihood and impact are High, Medium
or Low, judged on 28 Oct [INFERRED unless the evidence column says otherwise]. ARC-01 reviews this register at each
Gate B and records changes in [INTEGRATION_AND_REGRESSION_LOG.md](INTEGRATION_AND_REGRESSION_LOG.md) in this folder.

| Id | Risk | Likelihood | Impact | Mitigation | Owner | Evidence |
|---|---|---|---|---|---|---|
| RR-01 | NB-01's M1.4 work (23 commits, about 27,000 lines) and three fixer commits exist only on this laptop; a disk or worktree loss loses the milestone | Low per day, rising with time | High | TB-08: read-only scan, then `git push -u origin <branch>` from each branch's own worktree with the deny-list set; if blocked, a verified bundle stored off the machine where the owner approves | MOD-02 decides; NB-01 pushes | [VERIFIED] `git ls-remote` lists none of `feat/m1-4-overview` 07a6460 (23 commits ahead of main), `worktree-wf_bdc6c774-599-1` 4610684, `-599-2` be7f395, `-599-3` 202f8f6 (all LOCAL ONLY) |
| RR-02 | TA-03 and TA-05 both patch the engine block; TA-05 written before TA-03 merges would need its anchors redone | High if started early | Medium (patch-lib refuses safely; rework) | TA-05 branches from main only after TA-03 merges (ruling R-3) | EX-01; MOD-02 | [VERIFIED] both patch `07_engine.js`; patch-lib refuses a partly present anchor |
| RR-03 | Shared documents conflict when TA-03 and M1.4 both merge: DECISIONS (1 hunk), KNOWN_ISSUES (2), PROJECT_STATE (1); CHANGELOG and TESTING merge without a conflict but rows can still be lost or misordered | Certain for whichever merges second | Medium (lost or wrong records) | The second to merge takes main, keeps decisions in number order and keeps both sides' rows in CHANGELOG, PROJECT_STATE, KNOWN_ISSUES and TESTING; ARC-01 checks the merged files at Gate B; `docs-links` | the implementing chat that merges second; ARC-01 | [VERIFIED] `git merge-tree` of 6443826, the continuation branch and `feat/m1-4-overview` |
| RR-04 | Parity ledger rule "every entry is used": when the live page goes "no fallback" (TA-05), AG-13 and AG-14 become unused and the test fails; G1 also pins the exact retired list | High (whichever of TA-05 and M1.4 lands second) | Medium (CI job `next` red on main) | The one that lands second retires AG-13 and AG-14 in `tests/parity/aggregation-ledger.json` and edits the pinned list in `aggregation.parity.test.ts` in the same PR; NB-01 sends the final AG ids after integrating G1 | EX-01 or NB-01; ARC-01 verifies | [VERIFIED] 4610684 `aggregation.parity.test.ts` line 68 pins AG-01, 02, 05, 06, 08 |
| RR-05 | Vendored library blocks: after G1, any change to the live page's library blocks 00 to 03 (Chart.js, datalabels, SheetJS, PptxGenJS) or the brand-logo block breaks `vendor-extract --check` in NB-01's CI | Low (legacy library blocks must never change) | Medium | Never change a legacy library block; any library upgrade (for example SheetJS, TB-26) changes only the new app's vendored copy, under a D entry | EX-01 for the live page; NB-01 | [VERIFIED] interface review of `scripts/vendor-extract.mjs` on `feat/m1-4-overview` |
| RR-06 | Tests and records pin page MD5s: on the M1.4 branch `vendor-extract.mjs` line 41 pins 911A0465…, so that test already fails against main; every live-page change or refresh changes the MD5 | High at every page change | Low to Medium (false red, stale records) | Integrate G1 (it pins only the library blocks); every PR that changes `index.html` records the new MD5 in its CR, PROJECT_STATE and TESTING and runs `check-invariants --expect-md5` | NB-01; the implementing chat | [VERIFIED] `vendor-extract.test.ts` lines 44 and 91 on `feat/m1-4-overview`; no whole-page MD5 pin in tests on main |
| RR-07 | Two agents writing in one worktree: the T5 checkpoint says two implementer agents may have run at once | Medium in multi-agent workflows | High (interleaved, unreviewed edits) | One writer per worktree (REQ-075); the active-change register; treat T5 as unreviewed: re-derive 5F1C2FC5 from 97a7d69 plus the patch and review every edit against the T5 scope | EX-01; ARC-01 | [VERIFIED] 0f1c5d3 commit message; [VERIFIED] the page re-derives to 5F1C2FC5 (handover investigation, 28 Oct) |
| RR-08 | A live-page patch to `parseBaseRows` or `computeReview`, or any REFDATA change, turns NB-01's CI red (parity ledgers, `data-extract --check`, refdata parity) | Medium | Medium | Live-page PRs run the full `node --test` in IST and UTC and `data-extract --check`; update the ledger entries in the same PR (fix batch 4 did) | EX-01; ARC-01 | [VERIFIED] interface review; batch 4 commits bf2db99, b8a8d7f edited the ledger |
| RR-09 | The tax batch has never run in CI and has no browser QA of the combined page; T5 is unreviewed | Certain gap today | High (client tax figures) | IMP-C02 (CI now via `workflow_dispatch` or a draft PR); the full TESTING list in IST and UTC on the final page; financial review of T5; browser QA including `family-isolation.js` and `cvs-refresh.js`; pre-push scan rerun on the final head; Gate B | EX-01 | [VERIFIED] `gh run list` shows no run for the branch; CR-0008 line 503 |
| RR-10 | The October refresh splices new REFDATA into `index.html`: any open branch must take the new main by merging origin/main into the branch (never rebase) and re-run its checks, `data/refdata` must be regenerated in the same change (D-035), and the AI Analyst test and NB-01's parity fixtures run on new data | Certain when it happens | Medium | Start the refresh from main after TA-03 and TA-05 merge; regenerate `data/refdata`; merge only after the owner's "publish" | EX-01 (refresh-operator agent); MOD-02 sequences | [VERIFIED] MONTHLY_REFRESH.md Step 8; D-035 |
| RR-11 | The two tax tables drift apart (legacy TAX_RULES and TR-1 to TR-21) | Medium | Medium to High | The D-040 cross-reference (T5 docs); the KI-170 test; a financial review whenever either table changes; a later mechanical comparison (IMP-C16) | EX-01 and NB-01; financial-domain-reviewer | [VERIFIED] no link in git; agreement is recorded only in private notes |
| RR-12 | `check-invariants` does not enforce the whole engine surface, so a dropped or renamed key goes unnoticed | Low | Medium | TA-22 (KI-185 suggested); never rename an ENGINE key | EX-01 | [VERIFIED] check-invariants.js lines 47 to 49 |
| RR-13 | The rebuild rule cannot run literally; `.blocks/` copies (21 Oct) and the legacy ARCHITECTURE line counts are stale, so code citations drift | High that someone follows it | Low (it refuses safely; confusion) | TA-23: reword to "base MD5 plus this branch's new patches in order"; run `tools/extract-blocks.js` before citing lines | EX-01; ARC-01 | [VERIFIED] [legacy ARCHITECTURE.md](../legacy/ARCHITECTURE.md) §2 shows 2,886, 2,208, 5,710 lines; today 3,275, 2,277, 6,046 |
| RR-14 | Block-marker strings are copied in 7 places and no test cross-checks them | Low | Medium (tools read the wrong block) | Never change a marker comment in `index.html`; if unavoidable, change every copy in the same PR; a cross-check test (IMP-C17) | ARC-01 | [VERIFIED] interface review |
| RR-15 | New per-family state not cleared in `resetFamilyState()` leaks one family's data into the next review (D-015); T3 adds a harvest-assumption reset that has not been run in a browser | Medium | High | Browser QA step 7 (`family-isolation.js`, 11 checks on the tax page) on the final TA-03 page | EX-01; qa-engineer | [VERIFIED] TESTING.md §4; CR-0008 "not verified" lists |
| RR-16 | A push without the private deny-list: the hook script runs from the main checkout but the scanner from the pushing worktree, and `PRD_PRIVACY_DENYLIST` is unset, so only the general rules run unless it is exported | Medium | High (a client name in a public repository) | Push each branch from its own worktree with the variable exported; check that the scan output says the deny-list was used; PD-40; never `--no-verify` | every implementing chat; security-release-reviewer | [VERIFIED] `core.hooksPath` is absolute; the variable is unset in the user environment |
| RR-17 | Four local branches track `origin/main`: a plain `git pull` merges main into them and a plain `git push` is refused | Medium | Low to Medium (an unwanted merge) | First push with `git push -u origin <branch>` | each branch's owner | [VERIFIED] `git for-each-ref` upstreams: `feat/m1-4-overview`, `fix/legacy-batch-3-tax`, `fix/legacy-batch-4-basefile`, the handover branch |
| RR-18 | release-check only warns on `continuation/` and `handover/` branch names | High (it will warn) | Low | Accept the warning, or open the PR from a `fix/` or `docs/` branch at the same commit (REC-03) | MOD-02 | [VERIFIED] release-check.mjs lines 44 and 271 |
| RR-19 | `main` is unprotected and AC-22 (force-push detection) does not exist although documents claim it | Low | High (public history rewritten unnoticed) | CLAUDE.md rule 8 by practice; build AC-22 or correct the documents (TB-24); IMP-C01 for the owner | NB-01 (TB-24); MOD-02 | [VERIFIED] GitHub API "Branch not protected"; `git grep AC-22` finds no test |
| RR-20 | G1 and G2 both edit `tests/fixtures/make-books.ts`; G2's tests never ran; G1's 2 failures depend on its shared-file requests; NB-01's decisions N16 to N19 appear in no commit | High (a conflict) | Medium | Integrate one fixer at a time; run and report G2's tests; apply the shared-file requests; record what happened to N16 to N19 | NB-01 | [VERIFIED] the branch diffs; [UNCERTAIN] N16 to N19 |
| RR-21 | M1.4 test totals disagree (773 tests in the handover's IST run, 837 in NB-01's report; the same 4 failures) | Unknown | Low to Medium (a missing test group would hide failures) | Explain the count before the M1.4 PR | NB-01 | [VERIFIED] both counts; cause [UNKNOWN] |
| RR-22 | Pages runs invariants, smoke and regression before publishing, but not the AI Analyst test | Low (CI runs it on the PR and on main) | Low | IMP-C07 | ARC-01 | [VERIFIED] pages.yml lines 46 to 50 |
| RR-23 | Deck pagination constants are calibrated; a font or padding change breaks page boundaries | Low under D-028 | Medium | Presentation changes go to the new build; any change re-derives the constants and opens every page boundary | EX-01 | [VERIFIED] CLAUDE.md conventions |
| RR-24 | Stale documents mislead a successor (section 8) | High | Medium | Correct them in the PRs that touch them, and in one docs PR after TA-03 and M1.4 merge (TA-08, TC-15) | MOD-02 | [VERIFIED] section 8 |
| RR-25 | (new-build risk B-01) Pushing to the public repository publishes the branch at once, even without a PR: a missed deny-list term would be public immediately (see RR-16) | Medium | High | Deny-list exported in the pushing shell and seen in the scan output; security-release-reviewer GO first; never `--no-verify` | NB-01 and every implementing chat | [VERIFIED] the repository is public (D-008); [NEW_BUILD_HANDOVER section 11](../handover/NEW_BUILD_HANDOVER_2026-10-28_v1.md#11-risks) |
| RR-26 | (B-02) NB-01's decision files (L1 to L29, N1 to N19) and the fixers' shared-file requests live in temporary session folders; if lost, a successor must rebuild round 2 from the commits alone | Low to Medium | Medium | Copy them privately after a client-data check. A first copy of the files the private supplement lists was made on 30 Oct (supplement section 3.6); NB-01 checks and completes it (resume note, step 2 e) | NB-01; MOD-02 records it | [VERIFIED] copy made 30 Oct (214 files); completeness [UNKNOWN] until NB-01 checks |
| RR-27 | (B-03) SheetJS CE 0.18.5 carries CVE-2023-30533 and CVE-2024-22363 into the new app | High (already present) | Medium | State it in the M1.4 PR body; plan the upgrade under a D entry (TB-26, IMP-C05) | NB-01; MOD-02 | [VERIFIED as a record] NEW_BUILD_HANDOVER section 11; TB-26 |
| RR-28 | (B-04) Schedule: M1.4 about 5 Nov and M2 and M3 about 14 Nov are tight after the pause | Medium | Medium | Report the ETA after each merge (TC-22) | MOD-02 | [INFERRED] from NB-01's ETA of 27 Oct and the pause since |
| RR-29 | (B-05) NB-01's context: 1 compaction, idle since 27 Oct; its state report predates its last turn | Low | Medium | NB-01 confirms its state against git before acting; MOD-02 judges its reliability (resume note, part 3, item 5) | MOD-02 | [VERIFIED] [CHAT_REGISTRY.md](CHAT_REGISTRY.md), NB-01 row |

## 8. Stale documents

Each line was read on `main` 6443826 on 28 Oct [VERIFIED by file and line].

| Document and place | What it says | What is true | Fix in |
|---|---|---|---|
| [CLAUDE.md](../../CLAUDE.md) line 99 | smoke test has "35 checks" | Correct for main today; becomes stale when TA-03 merges (36 checks) | the TA-03 PR's docs |
| [DECISIONS.md](../DECISIONS.md) line 313 (D-033), [DEPLOYMENT.md](../DEPLOYMENT.md) line 45, [roadmap](../new-build/07-implementation-roadmap.md) lines 113 and 409, [regression test plan](../new-build/08-regression-test-plan.md) line 269 | AC-22 detects a force-push, CI-blocking from M1.2 | No AC-22 test exists; [ARCHITECTURE.md](../ARCHITECTURE.md) line 586 already says "designed, not run", so the documents disagree with each other | TB-24 or TC-15 |
| [PROJECT_STATE.md](../PROJECT_STATE.md) lines 46 and 54 | M1.2 and M1.3 "ready for its pull request" | Merged as PRs #12 and #13 on 23 Oct | TC-15 |
| PROJECT_STATE.md line 73 | live page MD5 911A0465… after PR #9 | Live MD5 is 12B5E5727FCA01EF2EA162C59913F01D after PR #16 | TC-15 |
| PROJECT_STATE.md lines 67 and 96 | the second export is "expected this week" and is a blocker | Received 23 Oct | TA-08 |
| PROJECT_STATE.md line 97 | the first MF Screener pack is a blocker | Packs received and validated 23 Oct | TC-15 |
| [HANDOVER.md](../HANDOVER.md) lines 6 and 121 | last refreshed 23 Oct; main at 2a65a62 | main is 6443826 | TC-15, then each monthly cycle |
| [MONTHLY_REFRESH.md](../MONTHLY_REFRESH.md) lines 182 to 183 | the risk-ratio toolchain "has not arrived" | It arrived on 23 Oct with the second export | TA-08 (after PD-21) |
| MONTHLY_REFRESH.md line 25; [MONTHLY_UPDATE_GUIDE.md](../MONTHLY_UPDATE_GUIDE.md) line 49 | files arrive 13th to 17th | The owner's 23 Oct answer gives 11th to 17th | TA-08 |
| [change-requests/README.md](../change-requests/README.md) lines 21 and 23 | CR-0004 "delivery awaited"; CR-0006 "M1.1 in progress" | Received 23 Oct; M1.1 to M1.3, tabs and the design merged | TA-08, TC-15 |
| CR-0008 line 551 (continuation branch) | parts T1 to T4 "none pushed"; nothing on T5 | On origin through the continuation branch; T5 is a WIP checkpoint | the TA-03 T5 docs |
| [PRD.md](../PRD.md) lines 331 to 333 (§13) | live MD5 911A0465…; 376 matrix rows; "owner decisions outstanding: none" | 12B5E572…; 385 rows on NB-01's branch; many decisions pending | TB-28 |
| [open-questions.md](../new-build/open-questions.md) | unchanged since 22 Oct | Later questions (D-041 question 1, label case, capital-gains §15, KI-147) are missing | TB-28 |
| [DATA_DICTIONARY.md](../DATA_DICTIONARY.md) §8, "Merged folios, first-row fields" | first-row date and days | Stale after D-041; G1 has the fix, not integrated | TB-07 |
| [05-feature-parity-matrix.md](../new-build/05-feature-parity-matrix.md) | merged work still "not started" | Status moves only when a test covers a row, so progress is understated | TB-28 |
| [legacy ARCHITECTURE.md](../legacy/ARCHITECTURE.md) §2; `.blocks/` | baseline line counts; copies from 21 Oct | Current counts differ | TA-23 |
| `.claude/agents/qa-engineer.md` line 10 | the AI Analyst test has 17 checks; no `tools:` line | 24 checks | TC-17 |
| [09-repository-and-docs-structure.md](../new-build/09-repository-and-docs-structure.md) | CHANGELOG moves to `docs/` at M1.1 | It stays at the root by the lead's decision of 22 Oct | TB-28 |
| The blueprint approval page (private) | section 0 "In progress" | Tabs merged 27 Oct | TC-10 |

## 9. Change log of this file

| Date (IST) | By | Change |
|---|---|---|
| 28 Oct 2026 | MOD-01 | First version, for the MOD-01 to MOD-02 handover |
| 30 Oct 2026 | MOD-01 (fixer pass) | KI-183 is filed by TA-05 (probe location given); KI-184 line numbers corrected; RR-10 says merge, never rebase; the new-build risks B-01 to B-05 registered as RR-25 to RR-29 |
