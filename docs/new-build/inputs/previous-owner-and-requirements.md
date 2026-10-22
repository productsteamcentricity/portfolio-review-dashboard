# Previous owner's system and requirements (Phase 0 input)

Prepared 21 Oct 2026 for the new-build audit. Read-only work: nothing in the repository, OneDrive or the
decks was changed.

**Evidence tags used below**

| Tag | Meaning |
|---|---|
| **[V]** | Verified by me on 21 Oct 2026, with the method named (download + hash, code read in `.blocks/`, file listing). |
| **[D]** | Documented by the previous owner or in this repository's docs; I did not re-test it. The source is cited. |
| **[I]** | My inference from the evidence. Check before relying on it. |

**Sources.** Public (in this repository): `docs/previous-owner/handover/HANDOVER_PRD_Centricity_Portfolio_Review.md`
("HANDOVER"), `docs/previous-owner/handover/PROJECT_HISTORY_Portfolio_Review_Dashboard.md` ("HISTORY"),
`docs/previous-owner/knowledge/KNOWLEDGE_DUMP.md` ("KD"), `docs/previous-owner/knowledge/DECISIONS_LOG.md`
("DL", cited by row date), `docs/REPLICATION_REPORT.md`, `docs/HANDOVER.md`, `docs/DECISIONS.md` (D-nnn),
`docs/audits/2026-10-19-decisions.md` (OD-nn), `docs/KNOWN_ISSUES.md` (KI-nnn), `CHANGELOG.md`.
Private (the previous owner's export, not published): the July as-built PRD ("PRD-Jul"), the previous
`CLAUDE.md`, the founding build prompt (21 May), the asset-allocation design prompt (27 May), the backend
decision and roadmap (11 Sep, "BACKEND"), the session notes and their group summaries, and the full KD (its
§4.2 to §4.4, §8 and §10 are left out of the public copy). Where a private source is cited, its content is
summarised here without client data.

---

## 1. The original site compared with this repository's baseline

### 1.1 Facts

| Item | Original dashboard (previous owner's public site) | This repository (`main` at `782794f`) |
|---|---|---|
| Served file | 16,765,556 bytes, MD5 `173F86CAC1E5D0AC8FFD5A66042A3B4C`, Last-Modified 14 Oct 2026 08:39 GMT **[V]** (downloaded 21 Oct 2026) | 16,817,827 bytes, MD5 `EF2FF4F198A41FE02404B3617CBAD36E`, Last-Modified 19 Oct 2026 10:23 GMT **[V]** (downloaded; equals local `index.html`) |
| Source commit | `cab22e6` (14 Oct 2026); no push since 14 Oct 08:38 UTC; repository public, Pages on, not archived **[V]** (public GitHub API, unauthenticated) | `511f554` imported `cab22e6` byte for byte; four later commits changed `index.html` **[V]** (`git log -- index.html`) |
| Same as the handover baseline? | **Yes.** Identical MD5 to the handover's stated baseline and to the previous owner's own working copies in the export **[V]** | No: baseline plus fixes (below) |
| Tabs | 20, same keys and order **[V]** (`var TABS` read from both files) | 20, identical |
| Extra slide groups | Rebalancing Holding Sheet, Post-Rebalancing Analytics, Post-Rebalancing Overlap Matrix, Rebalancing Impact, Performance (Proposed Funds) **[V]** | Identical **[V]** |
| Data dates | `DATA_DATES` analytics / performance / direct / SIF / risk = 30 Sep 2026; ranks 15 Aug 2026; fund managers 31 Aug 2026; Market Update "Oct 2026 (6)" **[V]** | Identical **[V]** |
| Embedded data | REFDATA block (10,081,440 chars), dividers, logos and the 6 Market Update images, expense-ratio table **[V]** | **Byte-identical** blocks **[V]** (per-block MD5) |
| Page shell (HTML/CSS outside scripts) | 32,732 chars **[V]** | Identical **[V]** |

### 1.2 What differs
Of the 13 script blocks, 10 are byte-identical (the four libraries, reference data, dividers, logos and
slides, runtime parsers, expense-ratio table, boot). Only three differ **[V]**:

| Block | Original | Repository | Changed by |
|---|---|---|---|
| Core engine | 175,488 chars | 196,512 | KI-001 reset; fix batch 1a (KI-047 XIRR same-day flows, KI-055 hybrid stocks scaled twice, KI-006 partial XIRR coverage, KI-065 debt MF tax); fix batch 1b (KI-007, KI-048, KI-061, KI-062, KI-063, KI-067, KI-068, KI-100, KI-114, KI-120) **[D]** `CHANGELOG.md` |
| Exporters | 154,445 | 160,371 | same batches (footnotes †/‡/§, Holdings slide notes box, CVS) **[D]** |
| Application UI | 370,687 | 396,008 | same batches **[D]** |

So the two sites are **the same build with the same data**, and the repository adds correctness fixes only.
No feature was added or removed, and no data was refreshed since the handover **[V]** (the October data refresh
has not run: `docs/refresh-log/` holds only 2026-09).

### 1.3 Consequences for the new build
- The original site still serves the **unfixed** build, including KI-001: a second family loaded in the same
  tab inherited the first family's state, and the Excel export could carry the previous family's Fund IRR
  sheet with that family's client names **[D]** KI-001. The owner decided on 15 Oct 2026 to keep it live until
  the new build is fully tested **[D]** `docs/REPLICATION_REPORT.md` §7, `docs/PROJECT_STATE.md`. Analysts who
  still use the old link get the unfixed behaviour **[I]**.
- The original site is a public Pages site on a personal account and embeds the licensed vendor data; the
  previous owner's own advisers flagged this on 11 Sep as a vendor-licence exposure **[D]** BACKEND "STOP"
  section; DL 11 Sep. The licence question is still open **[D]** `docs/PROJECT_STATE.md` blockers.
- Feature parity for the new build can therefore be measured against **either** site for features, but against
  this repository for numbers (the fixes change figures on purpose) **[I]**.

### 1.4 Other systems the previous owner built (not on the site)

| System | State | Relevance |
|---|---|---|
| `Centricity_Portfolio_CMS.html` (15 Jul) | Obsolete. Carries a 15 Jul copy of the dashboard; using it would regress three months of fixes. Embeds a password hash and a GitHub-token push path **[D]** HANDOVER §2.3, KD §0/§8 (private) | Do not reuse. Its validation-gate idea (dates advanced, counts within tolerance, sums to 100, key formats, null-heavy blocks) lives on in `buildtools/check_blocks.js` **[D]** PRD-Jul §12.2 |
| Web app (Node/Express + PGlite, 27 Jul) | Built, then left: not under git, last synced 19 Aug, insecure admin (inverted admin check, CORS reflects any origin) **[D]** KD §4.2 P12 (private), BACKEND §1 | A previous attempt at a "new architecture". Its vintage table design (one published vintage per data month) was judged sound **[D]** BACKEND §1.1 |
| Backend decision and roadmap (11 Sep, 26-agent review) | Recommendation only, never started **[D]** DL 11 Sep "pending" | See §2.5: its constraints apply directly to the new build |
| `migration-kit/` (private-repo plan, CI checks, hooks) | Superseded by D-008 (public repo) and this repository's CI **[D]** | Reference only |
| `buildtools/` refresh pipeline (17 Sep) | Restored here and proved byte-identical on September data **[D]** CHANGELOG 15 Oct, `docs/refresh-log/2026-09.md` | Reuse its rules (§3.7) |
| Risk-ratio toolchain (C#/PowerShell, outside the project) | **Not received.** Requested in the second export (CR-0004); the incoming folder was empty on 21 Oct **[V]** (listing) | Without it, `MF_RISK` cannot be refreshed in October **[D]** `docs/PROJECT_STATE.md` |
| MF Screener | A **separate** project with its own repository, described in the previous owner's notes as not part of this dashboard **[D]** session notes (June); no link to it exists anywhere in the dashboard code **[V]** (no URL in `.blocks/`) | The brief's "MF Screener" navigation item is new (§2.3) |

---

## 2. Requirements and decisions still relevant to the new build

### 2.1 Founding principles (held from May to October; restated by both owners)
1. **One offline file, no server, no network calls; client data never leaves the browser.** A compliance
   property, not an implementation detail **[D]** HANDOVER §0 rule 4 and §14; DL 22 May (inline every
   library), 26 Jul (client holdings never stored server-side); `CLAUDE.md` rule 2. Enforced today by
   `tools/check-invariants.js`, which fails on any `http(s)://` in application code and any remote `src`/`href`
   in the page shell **[V]** (read the script).
2. **Never invent a number.** An unmatched holding gets a blank, a footnote and a count; a missing value is
   null, never 0; never a guess, an average or another plan's figure **[D]** HANDOVER §0 rule 5, §14; DL 26 May
   (spec B.6 80% AAA / 20% SOV fallback refused), 27 Jul, 24 Jun; OD-8, OD-9, OD-29.
3. **House style on screen and in every export**: Cambria, black/gold palette **[D]** HISTORY §1.
4. **Measure before shipping** any matching or data change, in both directions, over the real universes **[D]**
   HANDOVER §8.
5. **Only the exports reach partners and clients**; the screen is the analyst's review surface **[D]** HANDOVER §1;
   PRD-Jul §2, §4 (personas: Products Team analyst, data owner, RM/Partner as deck consumer, client never touches
   the tool).

### 2.2 Decisions by area (status at 21 Oct 2026)

| Area | Decision | Source | Status |
|---|---|---|---|
| AMC concentration | 20% per fund house, measured on the **mutual-fund book**; breach is strictly > 20.00% | DL 21 May, 1 Sep; OD-1, OD-32 to OD-34; code `breach:pct>20.0` **[V]** | Current. The AI Analyst still caps on total CMV until OD-1 is built **[D]** KI-004 |
| AMC cap vs IPS | IPS template says "Single AMC 0–25%"; house cap 20%; never reconciled | KD §0.1 C10, §5.2 | **Open** |
| Matching | ≥3 shared tokens with ≥2 distinctive, or ≥2 when one name contains the other; brand anchor never empty; product class never crossed; never lower the threshold; exceptions only via an alias table | HANDOVER §8; DL 20 May, 26 May, 19–20 Aug | Current; OD-5 adds owner-approved aliases kept in the repository |
| Plans | Never join across plans (IDCW vs Growth) for ranks, manager history or risk | DL 1 Sep; KD §3.2 | Current |
| Hybrids | Split by actual equity/debt sleeve weights; never double count | DL 22 May | Current (KI-055 fixed a double scaling) |
| FoFs | Excluded from look-through and overlap; kept in allocation, AMC, performance | DL 26 May; code **[V]** (`07_engine.js` FoF regex) | Current; resolving FoFs to underlying funds (spec B.5) was **left open** |
| Commodity | Pure commodity funds excluded from look-through; gold inside hybrids stays | DL 15 Jun | Current |
| Cash | Fund cash/TREPS counted in market-cap "Others"; excluded from stock lists and overlap | DL 21 May, 6 Aug | Current |
| Overlap | Σ min(wA, wB) over **all** stored holdings, actual weights, no re-normalisation; ≥99.5 clamped to 100; bands 15/30/50 | DL 25–26 Jun, 7 Jul; KD §5.7 | Current |
| Contributors/laggards | Contribution = % allocation × fund XIRR; laggards = lowest contribution | DL 16 Jul | Current |
| XIRR | Actual/365; bisection on bracket width < 1e-12, Newton fallback; never filter tiny flows | HANDOVER §8; DL 10 Sep | Current (KI-047 fixed same-day flows) |
| Base-file XIRR units | Docs say fractions; code divides by 100 (percent); real files arrive both ways | KD §6.3; KI-005; OD-3 (ask the analyst, never guess) | **Open defect** until OD-3 is built |
| Benchmarks | Debt funds never take an equity benchmark; one benchmark per fund for every relative metric; risk map Large→Nifty 100, Mid→Midcap 150, Small→Smallcap 250, else Nifty 500 TRI | DL 21 Aug, 27 Jul, 14 Jul | Current; OD-7 adds arbitrage → Nifty 50 Arbitrage and "no benchmark" for several hybrid/commodity/global categories |
| Credit ratings | Seven groups: SOV · AAA/A1+ · AA+ · AA & Below · Others · UNRATED · Cash & Equivalents | DL 5 Jun; code `rgrank` **[V]** | Current (brief proposes three groups, §2.3) |
| Debt analytics | Avg YTM / Mod. Duration from **pure debt MFs only**; debt view = rating distribution + Top 20 issuers (sector breakdown removed 15 Jun) | DL 15 Jun; exporter `analyticsDebtSlide` **[V]** | Current. HANDOVER §7 still lists a debt "sector" card: an erratum **[V]** |
| Expense ratio | **Base** expense ratio for both plans; PMS 1.5%, AIF 2.5% flat when no data | DL 6 Oct, 3 Jul | Current; OD-9 removes category estimates; the Investment Reckoner fee data was requested and **never supplied** |
| Cost totals | Subtotal ER = arithmetic sum of group ERs (owner: "total like CMV and weight") | DL 3 Jul | Current, flagged "verify still wanted" by the previous owner |
| Taxation | FIFO over the IRR history, units ledger where a price exists, rupee ledger always; LT/ST apportioned to the file's G/L; >12 months = long term; STCL vs both heads, LTCL vs LTCG; no ₹1.25 lakh exemption, cess or surcharge (owner footnotes verbatim); no indexation or grandfathering | KD §5.4; DL 25–27 Aug; OD-2, OD-12, OD-15 to OD-18, OD-27, OD-28 | Current, with the OD changes pending |
| AI Analyst | Deterministic rules, no LLM, no network; weights 22/18/15/13/10/10/7/5 are a proposal **never signed off** | DL 1 Sep; KI-029 | Weights open; guideline/audit items "on hold" since 4 Sep |
| Rebalancing | Five action boxes (Exit, Retain, Partial, New Addition, Top-Up); proposed amount negative for money out; holding sheet covers every holding of every client and reconciles to zero deviation | PRD-Jul §8.2; DL 27 Jul | Current; amounts in money and %, never units **[V]** (`r.amtCr = r.baseCr × pctAlloc/100` in `11_app_ui.js`; no unit or NAV field in the tab's code) |
| Observations | "1. Current Portfolio + 2. SWOT" from the owner's pointer catalogue; every bullet conditional on data; thresholds (85/60/40 profile, >40% overlap pair, ≥60% beating benchmark, gold <5%, ≥50% low-yield debt) are Claude's defaults, never approved | DL 7 Jul, 16 Jul; KD §5.7 | Thresholds **open** |
| IPS | Bands exactly as the owner's `IPS_ Profiles.xlsx` (28 rows × 5 profiles); hybrids split into net classes; default profile Balanced; "Nil" deviation when in range | DL 28–30 Jun, 3 Jul; KD §5.3 | Current; OD-13 changes the basis to CMV with hybrid sleeves |
| Repository and release | Previous: push only on the owner's explicit word; three byte-identical copies | DL 26 Jul, 3 Jul | **Superseded** by D-001 (single copy), D-016 (patch scripts), D-017 (merge verified requested work) |

### 2.3 The new brief against the previous owner's decisions

| Brief item | Previous owner's position | Relation |
|---|---|---|
| Single offline workspace, nine sections | 20 tabs in a 5-section flow (Market Update, Portfolio Update, Holdings & Analytics, Rebalancing Opportunities, Annexure) **[V]** `TAB_SECTIONS` | Restructure; every current tab must map somewhere |
| "MF Screener" navigation link, new tab | No link exists **[V]**; "no remote src/href" is an explicit rule (HANDOVER §0 rule 4; `CLAUDE.md` rule 2; `check-invariants.js` fails on it **[V]**) | **Conflict.** Needs an explicit, documented exception (a plain link, no client data in the URL) and an invariant change |
| Screener data via credentials | Never attempted; the previous owner's monthly inputs were vendor workbooks **[D]** KD §2 | New; belongs in the refresh tooling, never in the client page **[I]** |
| Monthly vendor files tracked in public Git (`monthly_updates/YYYY-MM/`, incl. MF Monitor and SIF Monitor) | "Vendor workbooks are licensed third-party data. Keep them on OneDrive/SharePoint" (HANDOVER §2.3, §14); D-018/D-019 keep them private; licence question unanswered (KD §10 Q11, private) | **Conflict** to resolve before any vendor file is committed |
| Product bank from the Investment Reckoner | "Ignore the Monthly Investment Reckoner as a data source" (DL 20 May: no sector or holdings data). Notes describe it as ~114 slides whose PMS/AIF tables tie exactly to the PMS & AIF Performance file **[D]** session notes (June) | **Reversal** of a recorded owner decision; confirm |
| PMS and AIF one-pagers in the Annexure | Never mentioned in the previous owner's material **[V]** (searched the knowledge files) | New |
| Four allocation slides into two (client level, advisor level, chart and table together) | The deck has the Asset Allocation summary plus **four** level slides: Distributor table, Distributor chart, Client table, Client chart **[V]** (`allocSlides`); the 27 May design prompt calls the distributor view "Advisory Level" | Change of an existing design. A single distributor or client hides its view on screen (DL 26 Jun) but the deck still exports it (KI-092); OD-21 decided to leave it out of the deck too |
| Fixed legend colours | Equity tan `#DBC8B2`, Hybrid grey `#BFBFBF`, Debt gold `#BD9568`, Commodity `#808080`; no red for categories **[V]** exporter palette; DL 27 May | Keep |
| Debt components below 2% into "Others" | No such rule; issuers shown as a Top 20 table **[V]** | New |
| Credit-rating buckets: (1) SOV + AAA/A1+ + cash, (2) Unrated, (3) AA+ to B | Seven groups (DL 5 Jun). The IPS guide already treats AAA as AAA/A1+ **plus** cash **[D]** KD §5.3 | Change; decide where "Others" (MF units, preference shares, REITs/InvITs) goes, and whether the seven groups stay as detail |
| Client- and advisor-level selectors for analytics and overlap | Family/client scope selector re-scopes **only** equity and debt look-through (DL 19 Jun); overlap quick-select by client and distributor (DL 19 Aug); Cost tab distributor filter (DL 16 Jul); distributor-level IRR was ad hoc only, never a feature **[D]** KD §3.5 | Partial; extend |
| Historical analytics (March and September 2026) | No snapshots kept; each refresh replaces the data. Vendor analytics files carry a prior-month `Holding(%)` block that "must never be used as a fallback" **[D]** DL 27 Jul | New. The archive holds data months 2026-04 to 2026-09 only **[V]** (listing); no March 2026 month folder |
| Hybrid FoF look-through | FoFs excluded by owner rule (DL 26 May); spec B.5 "resolve passive FoFs" left open | Was requested once, never built |
| Holding sheet sorted by value | Invested before CMV; asset order Equity > Debt > Hybrid > Commodity > REITs/InvITs; products and instruments by CMV descending (DL 4 Jun); one sheet per client, re-based to that client (DL 21 May) | Mostly present; confirm whether the asset grouping stays |
| Equity MF order: index, large, diversified, mid, small, thematic + sectoral, global, FoF | Products Team order (DL 19 Aug), in code **[V]** `PERF_GROUPS`: Index · Large · Diversified (L&MC, Flexi, Multi, Focused) · Mid · Small · Thematic/Sectoral · ELSS · Dividend Yield · Contra · Value | Change: ELSS, Dividend Yield, Contra, Value have no place in the brief's list; Global and FoF are new groups |
| Hybrid low to high risk; debt overnight to high duration | Hybrid and debt buckets list categories in first-seen order **[V]** (`07_engine.js` perf grouping) | New |
| Remove the debt two-year column | Debt MF columns 1M 3M 6M 1Y **2Y** 3Y 5Y SI; PMS and Direct Equity also carry 2Y **[V]** `BUCKET_DEFS` | Change; scope to Debt MF only? |
| Cambria, 9 pt body | Cambria everywhere; table cell default 9 pt; tables range 6.8 to 9.5 pt; titles 22 pt bold caps; footer 8 pt italic **[V]** exporter | Mostly present |
| Logo lower-right on placeholder slides | Logo top-right on every content slide (right-anchored at x = 13.15 in); Market Update slides carry **no** logo; dividers keep their stamp; Disclaimer gets the picked logo; Thank You as supplied **[D]** DL 2 Jun, 27 Aug; KD §7 | New placement for one slide type; keep the other rules |
| Market updates at the beginning | Already first (5-section flow, DL 29 Jul) | Present |
| No en or em dashes in presentation writing | The previous owner's 6 Oct ad-hoc slides were QA'd for "no em dashes" **[D]** session note 6 Oct; but the dashboard deck uses "—" for missing values (founding prompt rule) and at least 19 slide titles contain an em or en dash **[V]** (exporter) | **Conflict** with the existing missing-value placeholder; needs a new placeholder |
| Review Snapshot (conditional on rebalancing) | Not a dashboard feature. The previous owner built one **ad hoc** on 6 Oct for a client: "Review Snapshot (what is working / needs attention / what the plan changes)", returns and risk kept vs redeemed, recommended redemptions, redemption in five tranches **[D]** session note 6 Oct | The concept originates there **[I]** |
| Slide 8 pre/post CAGR and illustrative values | Current vs Sample: expected return per category from the owner's template, valuation = CMV × (1+r)^N for N = 3/5/10, inflation-adjusted return **[D]** KD §5.8 | Partial precursor; the inflation-adjusted figure was never reconciled with the owner's Excel (KI-043) |
| Slide 9 redemption in units | Dashboard rebalancing is ₹/% based; units exist only in the Taxation lot ledger **[V]**. The 6 Oct ad-hoc planner worked from lots and units **[D]** | New to the dashboard; part of the ad-hoc logic survives (§2.4 item 9) |
| Actionables column black to tan | Exit actions are filled black `#000000` in the Actionables column of the Portfolio Rebalancing slide **[V]** `REBAL_BOXCOL` | Likely the item meant **[I]** |
| Formula-driven Excel, re-upload | Values only (`aoa_to_sheet`), number formats `#,##0.00;[Red]-#,##0.00` and `0.00"%"`, no formulas, freeze panes or filters **[V]** `buildXLSX`; no re-upload path | New |
| Monthly PRD and handover per cycle | Previous practice: a dated refresh log per refresh (data-date transitions, per-block counts, blocks left stale and why, rejected files, validation, final MD5 and size) and a dated `CLAUDE.md` entry **[D]** HANDOVER §9.6 | Extend |
| Missing-data statuses (NOT DISCLOSED, STALE DATA …) | Blank + footnote + count; `vintage` tag on carried-forward look-throughs; staleness lines in refresh output **[D]** | Formalises the existing rule |

### 2.4 Requested or promised features that never shipped, or shipped partially
1. **Investment Reckoner fees for PMS/AIF cost.** Requested 27 Jun, never supplied; flat 1.5% / 2.5% used
   instead **[D]** DL 27 Jun, 3 Jul; KD §4.2 P13 (private).
2. **Passive FoF look-through (spec B.5).** Left open since 26 May **[D]** DL 26 May.
3. **Overlap Matrix on the slides.** The exported Overlap slide has no matrix and the Post-Rebalancing Overlap
   slide is never produced (scope fault), although both appear on screen and in the picker **[D]** KI-002,
   KI-003; first suspected by the previous owner on 11 Sep (KD §4.1 D3) and never checked by them.
4. **AI Analyst items:** the portfolio-construction-gap trigger (no target allocation exists), the minimum
   investment constraint (coded, inactive), exit load (shown absent), weight sign-off, destination ordering and a
   soft AMC target; "guideline/audit items" put on hold on 4 Sep **[D]** KD §4.2 P1–P3, P15; DL 1–4 Sep.
5. **Exit Load file.** Offered 17 Sep, not requested; the file arrives monthly and is not consumed **[D]** DL 17 Sep.
6. **About a third of the owner's observation catalogue** is not generated: risk-profile fit, AMC quality, tax
   efficiency, rebalancing history, themes **[D]** KD §5.7.
7. **Distributor-level IRR.** Built ad hoc (25 Sep), never a dashboard feature; the IRR parser ignores the
   DISTRIBUTOR column **[D]** KD §3.5.
8. **Tax rules upload slot and build script.** Never built; a rule change is a hand-written splice. The promised
   tax-rule summary for compliance sign-off was never published **[D]** KD §2.3, §4.3 (private).
9. **The 6 Oct client rebalancing slides.** Slides 1–5 delivered; slides 6–7 (proposed funds, portfolio after
   rebalancing) waited for the Products team's buy list. The four scripts lived in a session scratchpad: the exit
   rules (R1–R7) and the lot/tax/tranche planner survive in the export; the dataset and slide builders do not
   **[V]** (file listing). The rule specification itself (`Logic.txt`) is not in the export or OneDrive **[V]**.
10. **ICICI Bluechip / Contra alias lines.** Offered 20 Aug ("say the word"), never added; both still resolve to the
    wrong funds **[D]** KD §3.2. Now governed by OD-5.
11. **idf-weighted name matching** for the same-AMC generic-token residual (e.g. Nifty Metal ETF → Nifty 100 ETF)
    **[D]** HANDOVER §8; DL 20 Aug "pending".
12. **AIF performance refresh.** One source file ever (30 Jun 2026); "update in two minutes if a file is sent"
    never happened **[D]** KD §0.1 C5.
13. **PMS/AIF look-through refresh** is not in `buildtools/` (only a reference script with dead paths) **[D]** KD
    §0.1 C9.
14. **Undecided UI questions:** CVS "Reset to Actual" vs "Re-seed" (one button or both), merging same-portfolio SOA
    name variants, hybrid debt sleeves in Avg YTM / Mod. Duration, issuer top-30 normalisation **[D]** KD §4.2 P5–P7,
    KI-039.
15. **Backend "vintage" ingestion mill** (11 Sep) and the private-org migration: recommended, never started
    **[D]** DL 11 Sep.

### 2.5 Constraints from the previous owner's backend review that bind any new architecture [D] BACKEND
- **Posture.** Keep client data in the browser. Sending even scheme names to a server was judged a legal question
  (DPDPA, AMFI Code confidentiality) for a ~1 MB saving; persisting holdings server-side makes the firm a data
  fiduciary with a large compliance build. The IRR sheet is the most sensitive input (a complete transaction ledger).
- **Offline property.** An RM can produce a deck at a client's office with no network by opening one file. Every
  server design gives this up.
- **Key insertion order changes matches.** `matchInstrument` breaks ties on candidate order (`Object.keys` of the
  embedded block); re-serialising a block changed 3 of 1,419 matches. Any rebuild must keep extracted order or fix
  the tie rule, and add a tie-detection gate (also KI-036).
- **Exporter purity.** `buildXLSX(model, XLSX)` is pure; `buildPPTX` reads about nine application globals (overlap
  threshold and selection, rebalancing, CVS, IPS, cost, AI Analyst, taxation scope, slide picks). A clean build
  must pass these through an explicit model.
- **Load cost.** Evaluating the embedded reference data took ~767 ms, more than the whole review computation
  (`computeReview` 233 ms at 25 holdings). Page weight was judged acceptable for offline use.
- **Two upload slots are dual-purpose** (PMS/AIF: vendor analytics or a client SOA; bonds likewise). A misfiled
  client SOA could be baked into published reference data. Any ingestion tool needs an explicit client-data gate.
- **Dead or misleading blocks:** `MF_CAT_BM` has no consumer (KI-097); a stale `window.IPS_PROFILES` holds invented
  bands (KI-028).

---

## 3. Analyst workflows and conventions to preserve

### 3.1 The review workflow [D] PRD-Jul §4; HANDOVER §1, §7; code [V] where marked
1. Open the page in Chrome or Edge (double-click or the Pages link). Optionally upload market data (MF Monitor,
   Direct Monitor, SIF Monitor, Market Update slides) and client data (IRR transactions, PMS/AIF SOA, bonds). Each
   slot shows its embedded default and date; × restores it.
2. Upload one client base file. The family name and date come from the file name when it follows
   `Portfolio Update_<Mr/Mrs/Ms> <name> Family_<dd(th) Month yyyy>`; otherwise the family is derived from the first
   client's surname and the date defaults to today **[V]** (`deriveFamily`, `deriveDate`). The IST "Portfolio as on"
   picker overrides the file-name date (DL 26 May).
3. Review the tabs; choose the IPS profile, Regular/Direct mode, overlap threshold and selection, scope selectors,
   CVS assumptions; set rebalancing actions and proposed funds; edit rationales.
4. Tick slides in the picker (nothing ticked = full deck). Export the full deck, one tab as a slide, or the Excel
   workbook. Files are named `Portfolio Review_<Family>_<DD Mon YYYY>.pptx` / `.xlsx`, and
   `Portfolio Review_<Family>_<Tab><scope>_<date>.pptx` for one tab **[V]** (`11_app_ui.js`).
5. A blank template downloads as `Centricity Base File Template.xlsx` **[V]**.
6. A new base file clears all family state (KI-001 fix, D-015) **[D]**; the original site does not.

### 3.2 Inputs [D] HANDOVER §5; KD §6
- Base file: sheet `Base File` or the first sheet; header row found within the first 5 rows; columns matched **by
  name, not position**; product class taken at its word from `Product Name` (singular and plural forms tolerated).
- IRR sheet: `SI Xirr` (required) and `SI Bmxirr`; base rows join 1:1 to "Closing Holding" rows; known data quirks
  (duplicate folios, placeholder ₹0.001 rows, missing benchmark rows) are flagged, never altered (DL 10 Sep, OD-4).
- The files are re-saved by people while analysis runs: hash inputs before each run and before delivery (KD §6.4).

### 3.3 Units, rounding and formats
- Money maths in **₹ Crore**; display in the unit written in the base file (₹, Lakh or Crore), with a rupee-only
  file shown in Crore when total CMV ≥ 1 Cr, else Lakh **[D]** DL 2 Jun; KD §5.8.
- **Two decimals everywhere**; the inflation label stays at one decimal; minimum-investment labels stay round **[D]**
  DL 20 May, 29 Jun.
- CMV (`Current Market Value (Cr.)`) is the basis of every weight; per-client sheets re-base to that client **[D]**.
- Every look-through block (market cap, sector, rating) sums to exactly 100.00%; issuer lists are top 30 and do not
  **[D]** REPLICATION_REPORT §5.
- Absolute return = Gain ÷ Invested × 100 **[D]** DL 15 Jun.
- Excel formats `#,##0.00;[Red]-#,##0.00` and `0.00"%";[Red]-0.00"%"`; sheet names cut to 31 characters **[V]**.
- Compute unrounded and round for display (the CVS grand total is nudged to exactly 100.00 by largest remainder,
  ≤0.02 pp) **[D]** KD §5.8.
- "None held" shows 0.00% and "no data" shows a dash, deliberately distinguished in IPS **[D]** DL 3 Jul.

### 3.4 Order and naming
- Deck order: Market Update divider and monthly slides first; Portfolio Update (IPS, Asset, Distributor, Client, AMC,
  Observations); Holdings & Analytics (Holdings, Analytics, Overlap, Cost, Fund IRR); Rebalancing Opportunities
  (CVS, MF Analysis, Taxation, AI Analyst, Rebalancing and its extra groups); Annexure (Performance); Disclaimer;
  Thank You **[V]** `TAB_SECTIONS`; DL 29 Jul. (KI-014 notes the AI Analyst and Taxation slides currently export after
  the Annexure divider; owner to confirm.)
- Market Update, Disclaimer and Thank You ("ALWAYS" slides) go in the full deck and picker selections, not in a
  single-tab download **[D]** DL 29 Jul.
- Slide numbers removed (DL 16 Jul); INSIGHT boxes removed from holdings and performance slides (DL 15 Jun); the
  "Universe Avg / Benchmark" qualifier text removed from screen and deck (DL 19 Aug).
- Performance tables drop instruments with no data on screen and in the deck, not in the Excel (DL 7 Jul); nothing
  wraps except the scheme name (DL 19 Aug); Nifty Next 50 appears only when held; Diversified shows three
  benchmarks **[V]** `PERF_GROUPS`.
- Every data slide carries its data-date footnote ("Performance as on X & Analytics as on Y"); the date is the one in
  the vendor file name or `--date`, not the in-file "As on" **[D]** DL 20 May, 25 May.

### 3.5 Design
- **Cambria** everywhere, screen and exports **[V]** `ENGINE.FONT`.
- Palette `ENGINE.palette`: black `#000000` · gold `#BD9568` · tan `#DBC8B2` · greyM `#BFBFBF` · greyL `#D9D9D9` ·
  white `#FFFFFF` · red `#931621` · green `#2E7D32` · bgYellow `#FFF8E1` · brownText `#5C3E17` **[V]**. Red only for
  negatives and breaches, never decorative, never a category colour; negative returns never gold **[D]** HANDOVER §10.
- Slide chrome: black header bar with white ALL-CAPS title (22 pt bold), logo top-right, black footer, 8 pt italic
  grey footnote; 13.333 × 7.5 in **[V]**. Tables: black header and grand-total rows, light-grey `#D9D9D9` subtotal
  rows, thin grey borders **[D]** asset-allocation design prompt (27 May); exporter **[V]**.
- Deliberate exceptions: overlap colours (navy `#233140`, diagonal `#B98C5A`, gradient `#F2E9DC/#DCC4A5/#C49A66/
  #A87B45`, text `#5C3E17` / `#1A1A1A`), rebalancing tints (Exit `#FCE8E8`, Partial `#FFF8E1`, Top-Up `#FDE7EF`, New
  `#E6F4E6`), action boxes (Exit black, Retain gold, Partial tan, New greyL, Top-Up greyM), app chrome `#F2F0EC`
  **[D]** KD §5.7–5.8; `REBAL_BOXCOL` **[V]**. 63 colour literals sit outside the palette as recorded debt **[D]**
  PRD-Jul §11.4.
- Two house logo variants plus custom upload; logo right-anchored by its true aspect ratio **[D]** DL 29 May, 2 Jun.
- Supplied slides (Market Update, dividers, Disclaimer, Thank You) are embedded **as PowerPoint exported them**,
  unedited; errors are flagged to the owner, never corrected by Claude **[D]** DL 29 Jul, 27 Aug, 20 Jul; KD §7.

### 3.6 Data-integrity rules the analysts rely on
- Unmatched holdings are counted and footnoted; excluded holdings are listed by product class (DL 20 Aug).
- Product class is a hard boundary: "DO NOT EVER CHANGE THE PRODUCT CLASS" (owner, DL 20 Aug).
- An uploaded client SOA always beats the embedded look-through (DL 4 Sep).
- Regular + Direct of one scheme merge by performance key with a CMV-weighted XIRR labelled approximate (DL 2 Sep).
- Folio merge key = client + instrument + product + distributor; merged XIRR CMV-weighted (DL 4 Jun).
- Liquidity: a `Liquidity` column overrides every rule; unlisted/pre-IPO and AIFs are close-ended (DL 4 Jun; code
  `liquidityClass` **[V]**). FDs, SIFs and unlisted NCDs were never decided (session notes, June).

### 3.7 Monthly refresh conventions [D] HANDOVER §9; KD §1–§2; `docs/MONTHLY_REFRESH.md`
- Data for month M arrives around the 13th–17th of M+1; the owner sends the files (no reminder, by choice). The
  Market Update label is M+1 (the Outlook issued in M+1 carries month-M data).
- Files are found by **file-name prefix** and columns by **header name**; never hard-code offsets; survey drift
  against last month first; two files on one prefix stop the build ("ambiguous").
- Re-issues with the same file name are common: compare size, MD5, modified time and workbook properties; diff
  numerically, not textually.
- The embedded default must equal what a runtime upload of the same file produces (run the shipped parsers).
- Build-time rules: AUM searched upward from the header; debt sub-block only when a value exists; Direct unnamed
  sheets mapped via their Regular sibling; hybrid debt = all non-equity rows; carry-forward only for a scheme still
  in the monitor under the same key, tagged `vintage`; SIF look-through never carried; stock master merges, never
  replaces; expense ratio is an accumulating overlay with two integrity tests; `MF_RISK` category coverage asserted.
- Manual steps: five Nifty TRI files downloaded by hand (the site is bot-protected); Outlook slides exported via
  PowerPoint COM to 1920 × 1080 JPEGs on a short local path, each image looked at.
- Write up every refresh: data-date transitions, per-block counts, blocks left stale and why, rejected files,
  validation results, final MD5 and size.

---

## 4. Known gaps the previous owner documented

### 4.1 Data that stays old until a file arrives [D] HANDOVER §6.3, §11; [V] for the dates in `DATA_DATES`
| Block | Vintage | Why |
|---|---|---|
| `FUND_RANKS` | 15 Aug 2026; Regular plans only; "unscored" means no entry | No issue since 15 Aug; the producer was never named |
| `FUND_MGR` | 31 Aug 2026 | Irregular file |
| `PMS_PERF` | 31 Jul 2026 returns; market cap, category and inception carried from older builds; the "31 Aug" issue was a re-saved July file | Source and preparer unclear |
| `AIF_PERF` | 30 Jun 2026, 12 funds | One source file ever |
| 15 PMS/AIF look-throughs | 31 Jul 2026 | No newer SOA workbook; no pipeline step |
| `MF_BENCHMARKS` | Legacy, unknown provenance; Beta 1.00 / Down-capture 100% definitional | No tool produces it |
| `MF_RISK` | 30 Sep 2026, computed **in-house** from AMFI NAVs and hand-downloaded TRI files, not a vendor file (KD §0.1 C1) | Toolchain outside the project, not received |

### 4.2 Defects and doubts (previous owner's list, mapped to this repository)
| Previous owner's item | Now | Status |
|---|---|---|
| XIRR/BMXIRR units both ways (KD §4.1 D1, §6.3) | KI-005, OD-3 | Open |
| AI Analyst mixed AMC denominators (D2) | KI-004, KI-061 | Partly fixed; OD-1 to build |
| Overlap matrix missing from slides (D3) | KI-002, KI-003 | Open |
| Tie-break on key order (D4) | KI-036 | Open |
| Hybrid MF tax rows unreachable (D5) | KI-037, OD-17 | Open |
| Missing rating defaulted to AAA in the July aggregator (D6); PRD-Jul §9 also states "default missing rating to AAA" | KI-038 | To check in `buildtools/` |
| Issuer top-30 normalisation differs build vs browser (D7) | KI-039 | Owner decision |
| "Dashboard not opening", `file://` never tested (D8) | KI-046 | Unreproduced |
| PPTX never opened by a human for several groups (D9) | `docs/TESTING.md`; batch 1b QA | Partly closed |
| Sub-lakh losses print ₹0.00 Cr (D10); Top Underlying Holdings not de-duplicated (D11) | KI-040, KI-041 | Open |
| IPS: AMC 0–25% vs 20% (D13); BBB folded into AA & Below (D14); unlisted denominator counts debt AIFs (D15); Real Estate row (D16); dead invented bands (D17) | KI-042, KI-028, OD-13 | Open |
| CVS inflation-adjusted 7.99% vs the owner's Excel ~9.84% (D20) | KI-043 | Never reconciled |
| `cvs_cmv` and other settings carried across clients | KI-012, KI-035, OD-10 | Open (OD-10: per family only) |
| In-browser PMS/AIF sheet parser assumes the old layout; uploaded monitor AUM and SIF `.amc` quirks; 35 arbitrage/equity-savings hybrids with eq + db > 105% | HANDOVER §11; KI-026, KI-033 | Open; OD-11 keeps the uploads and requires them fixed |
| ~28 index ETFs with split-corrupted 3Y stats shipped as computed | KD §2.2; DL 18 Sep | Owner decision never taken |
| Analytics vendor date row a month behind the file name (June) | DL 27 Jul (P8) | Never resolved |

### 4.3 Single points of failure and manual work [D] KD §1.1, §3.1
- The risk-ratio toolchain exists only on the previous owner's machine; exact script arguments were never written
  down.
- TRI downloads, Outlook slide export, topic-slide export, expense-ratio sanity checks, the Fund Ranks splice
  (undocumented wrapper, KD §3.4) and any tax-rule change are manual.
- Sources of record not received: the IPS profiles workbook, the Rebalancing Rules document, `Logic.txt`, Fund Ranks,
  Fund Manager history, the Investment Reckoner and the topic/disclaimer slide decks **[V]** (not found by name in
  the export or the OneDrive project folder). `Tax Rules_2026.xlsx` is in the archive **[V]**. All are requested in
  the second export (CR-0004).

### 4.4 Corrections the previous owner made to their own documents [D] KD §0.1; REPLICATION_REPORT §5
The risk file is in-house, not vendor (C1); base-file XIRR units (C4); one AIF file was supplied (C5); 20 tabs, not
18 (C7); base-ER switch on 6 Oct, not 28 Sep (C8); the PMS/AIF look-through tool exists only as a reference
script (C9); IPS vs AMC cap (C10). Handover errata: Purchase Date does not feed Taxation (lots are dated from the IRR
sheet); the IRR upload is not required for the Fund IRR tab; the template has 18 columns, not 19; deck order differs
from tab order for AI Analyst and Taxation; the AI Analyst cap used total CMV.

### 4.5 Questions only the previous owner could answer (30, KD §10, private copy)
Grouped: base-file units and the exporting platform; sign-off of AI Analyst weights, ordering and a soft AMC target;
origin of the 20% cap and the IPS 25% band; owners of the IPS bands, tax rules, the 4.5% risk-free rate and the CVS
expected-return defaults; whether the observation thresholds were ever approved; the vendor contract and whether the
licence allows a public site; who sends each monthly file and when; the PMS performance, AIF and SOA sources; the
risk toolchain arguments; split-NAV ETFs; repository and CMS clean-up; the web app's future. The answers were
requested as `ANSWERS.md` in the second export (CR-0004) and have **not** arrived **[V]** (empty incoming folder,
21 Oct).

---

## 5. What I could not verify, and why
- **The reference decks.** I did not open them (outside this task). The links between reference deck A and the
  previous owner's 6 Oct ad-hoc rebalancing slides, and between "slide 6 Actionables" and the rebalancing slide's
  black Exit cells, are inferences.
- **The fix list per block.** I verified that only the engine, exporter and UI blocks differ between the two sites;
  the list of fixes in them comes from `CHANGELOG.md`, and I did not re-run each fix.
- **Base-file units in current exports** (KI-005). No real-format fixture is available.
- **Anything in the second export** (risk toolchain, sources of record, `ANSWERS.md`, fixtures): not received.
- **Historical March 2026 data.** The archive starts at data month 2026-04. Whether the April vendor analytics files
  carry a usable 31 Mar 2026 prior-month block is untested (and the previous owner ruled that block must never be
  used as a fallback).
- **Whether the vendor licence permits public hosting**: an open business question.
- **The original site's runtime behaviour.** I compared bytes and code, not a browser session on the old site; the
  KI-001 leak there is documented, not re-run.
- **Vendor file contents.** I listed archive file names only; I did not open licensed vendor workbooks.
