/* ============================================================================
   2026-10-19 — KI-063 (audit NEW-17): "Apply plan to Portfolio Rebalancing"
   writes the whole release when a scheme is held in several plans or by
   several clients.

   The AI Analyst holds ONE position per scheme (07_engine aiaPositions): the
   Regular and Direct plans of a scheme, and the same scheme held by several
   clients, are merged under its vendor key, and a merged position is named
   after that key. Its releasePct is a share of the merged CMV. The Rebalancing
   tab has one row per holding name (rbFundIndex). The apply looked up only the
   position's own name, so a Direct sibling got no plan (AI released 4.58 Cr,
   the tab 3.46 Cr on the synthetic book) and a merged position whose name is
   no row's name was dropped entirely (2.35 vs 3.67 Cr), while the AI tab still
   said "Applied". All edits are in the UI script (11_app_ui); the engine
   already exposes rec.members with each member's own holding name, which is
   the tab's row key, so it is not changed.

   Edits
     1. aiaApplyToRebal: the overwrite prompt also counts a row narrowed to
        one client, because the apply now resets that (edit 2).
     2. aiaApplyToRebal: every member's own row (rec.members, by rbKey of the
        member's name) gets the position's action, releasePct, destinations and
        rationale, so the rows release exactly the position's amount, up to
        rounding. The row is set to all clients (client null): the release is a
        share of every client's holding of the scheme. A member with no row is
        listed by name and client; a row reached from two positions (two
        holdings whose names normalise alike) is listed too.
        When a Partial Rebalance is written to more than one row, each row's
        recommendation clause (aiaRowRecText, edit 4) states that row's own
        release (its CMV across all clients x the row's %, in the file's unit)
        and its %, and gives the position's release only as the combined total,
        so no row, on the tab or in the deck / XLSX Rationale column, presents
        the position's amount as its own. Single-row positions, Exit rows
        ("Redeem 100%") and Retain rows keep the engine's text unchanged.
     3. aiaApplyToRebal: the status line counts rows and holdings ("16 rows
        written for 12 holdings (8 rows for the 5 holdings that release
        money)"), names members with no row and rows shared by two positions,
        and warns, with both figures, when the Rebalancing tab's released total
        differs from the plan's by more than the plan's rounding. Names in the
        status line are escaped (aiaEsc).
     4. new aiaRebalCheck(P) and aiaRowRecText(), after aiaApplyToRebal.
        aiaRebalCheck returns two verdicts.
          ok      exact: the tab's released total (rbSummary over REBAL_ROWS,
                  which renderRebal and rbRecalc keep current) equals, to
                  1e-9 Cr, the sum over the plan's acting positions of each
                  member row's totalCmvCr x the position's % (from the tab's
                  own fund index, REBAL_FUNDS), and every member has a row.
                  The "Applied" badge uses this, so any later edit shows.
          agrees  bounded: the tab's total against P.summary.released, within
                  the plan's own rounding: 0.005 Cr per Exit (the plan rounds
                  the release to 0.01 Cr, the tab redeems the exact holding),
                  0.005% of the position per partial (releasePct is rounded to
                  0.01%), and 0.005 Cr on the total. Used only for the status
                  line's message.
        Returns null when the tab has no rows for the loaded model. It keeps
        no state, so resetFamilyState() needs nothing new.
     5. renderAIAnalyst: the "Applied" badge shows only while the tab holds
        exactly what the plan wrote; otherwise it says, in red, that the tab
        does not match the plan, and what each releases.

     node tools/patches/2026-10-19-apply-plan-members.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('KI-063 apply plan to every member row', [
  {
    label: 'KI-063 the overwrite prompt counts a row narrowed to one client',
    from: [
      "        if ((st.proposed && st.proposed.length) || st.rationaleEdited ||",
      "            (st.action && st.action !== 'Retain') || (Number(st.pctAlloc) || 0) !== 100) edited++;"
    ].join('\n'),
    to: [
      "        /* KI-063: the apply resets a row to all clients, so a client choice is work it overwrites */",
      "        if ((st.proposed && st.proposed.length) || st.rationaleEdited || st.client != null ||",
      "            (st.action && st.action !== 'Retain') || (Number(st.pctAlloc) || 0) !== 100) edited++;"
    ].join('\n')
  },
  {
    label: 'KI-063 write every member\'s own row with the position\'s plan',
    from: [
      "    var wrote = 0, missed = [];",
      "    P.recs.forEach(function(r){",
      "      var k;",
      "      try { k = rbKey({ name: r.name }); } catch (e){ return; }",
      "      if (!REBAL_FUNDS.byKey[k]){ missed.push(r.name); return; }",
      "      /* create the row the way the picker does, if the RM has not already */",
      "      var st = REBAL_STATE[k];",
      "      if (!st) st = REBAL_STATE[k] = { action: r.action, client: null, pctAlloc: 100,",
      "                                       proposed: [], rationale: '', rationaleEdited: false };",
      "      st.action = r.action;",
      "      st.pctAlloc = (r.action === 'Retain') ? 0 : Math.max(0, Math.min(100, r.releasePct));",
      "      st.proposed = (r.destinations || []).map(function(d){",
      "        return { fund: d.name, pct: r.release > 0 ? Math.round(d.amount / r.release * 1000) / 10 : 0 };",
      "      });",
      "      st.rationale = r.rationale.filter(function(x){ return x.kind !== 'destination'; })",
      "        .map(function(x){ return x.text; }).join(' ');",
      "      st.rationaleEdited = false;",
      "      wrote++;",
      "    });"
    ].join('\n'),
    to: [
      "    var missed = [], shared = [], owner = {}, posRows = [];",
      "    P.recs.forEach(function(r, ri){",
      "      /* KI-063: a position can be several base-file rows. aiaPositions merges a scheme's",
      "         Regular and Direct plans, and the same scheme held by several clients, under its",
      "         vendor key, so r.name need not be any row's name. Every member's own row gets the",
      "         position's plan; releasePct is a share of the merged CMV, so the rows together",
      "         release the position's amount, up to rounding. */",
      "      var mem = (r.members && r.members.length) ? r.members : [{ name: r.name, client: r.client }];",
      "      var keys = [], seen = {};",
      "      mem.forEach(function(m){",
      "        var mk = '';",
      "        try { mk = rbKey({ name: m.name }); } catch (e){ mk = ''; }",
      "        if (!mk || !REBAL_FUNDS.byKey[mk]){",
      "          var lbl = String(m.name) + (m.client ? ' (' + m.client + ')' : '');",
      "          if (missed.indexOf(lbl) < 0) missed.push(lbl);",
      "          return;",
      "        }",
      "        if (seen[mk]) return;",
      "        seen[mk] = 1; keys.push(mk);",
      "        /* two positions reaching one row (names that normalise alike): the later one is written */",
      "        if ((mk in owner) && owner[mk] !== ri && shared.indexOf(REBAL_FUNDS.byKey[mk].name) < 0)",
      "          shared.push(REBAL_FUNDS.byKey[mk].name);",
      "        owner[mk] = ri;",
      "      });",
      "      posRows[ri] = keys.length;",
      "      /* KI-063: a Partial Rebalance written to several rows states, on each row, that row's",
      "         own release and %, and the position's release only as the combined total */",
      "      var multi = keys.length > 1 && r.action === 'Partial Rebalance';",
      "      keys.forEach(function(k){",
      "        /* create the row the way the picker does, if the RM has not already */",
      "        var st = REBAL_STATE[k];",
      "        if (!st) st = REBAL_STATE[k] = { action: r.action, client: null, pctAlloc: 100,",
      "                                         proposed: [], rationale: '', rationaleEdited: false };",
      "        st.action = r.action;",
      "        st.client = null;   /* the release is a share of every client's holding of the scheme */",
      "        st.pctAlloc = (r.action === 'Retain') ? 0 : Math.max(0, Math.min(100, r.releasePct));",
      "        st.proposed = (r.destinations || []).map(function(d){",
      "          return { fund: d.name, pct: r.release > 0 ? Math.round(d.amount / r.release * 1000) / 10 : 0 };",
      "        });",
      "        st.rationale = r.rationale.filter(function(x){ return x.kind !== 'destination'; })",
      "          .map(function(x){",
      "            return (multi && x.kind === 'recommendation') ? aiaRowRecText(r, k, keys, st.pctAlloc) : x.text;",
      "          }).join(' ');",
      "        st.rationaleEdited = false;",
      "      });",
      "    });"
    ].join('\n')
  },
  {
    label: 'KI-063 status line: rows and holdings, members with no row, shared rows, and a totals warning',
    from: [
      "    try {",
      "      setStatus('AI Analyst plan applied to Portfolio Rebalancing: <b>' + wrote + '</b> holding'",
      "        + (wrote === 1 ? '' : 's') + ' written'",
      "        + (missed.length ? (', <b>' + missed.length + '</b> with no rebalancing row: ' + missed.slice(0, 3).join(', ')",
      "            + (missed.length > 3 ? ' and ' + (missed.length - 3) + ' more' : '')) : '')",
      "        + '. It is a draft — edit it there before exporting.', missed.length ? true : false);",
      "    } catch (e) {}"
    ].join('\n'),
    to: [
      "    /* KI-063: say so when the tab does not now release what the plan releases, to the plan's rounding */",
      "    var chk = null;",
      "    try { chk = aiaRebalCheck(P); } catch (e) {}",
      "    var off = !!(chk && !chk.agrees);",
      "    try {",
      "      var few = function(a){ return a.slice(0, 3).map(aiaEsc).join(', ')",
      "        + (a.length > 3 ? ' and ' + (a.length - 3) + ' more' : ''); };",
      "      /* rows on the tab, and the AI Analyst's holdings (positions) they were written for */",
      "      var isRel = function(a){ return a === 'Exit' || a === 'Partial Rebalance' || a === 'Top-Up'; };",
      "      var nRows = 0, nRelRows = 0, nPos = 0, nRelPos = 0;",
      "      Object.keys(owner).forEach(function(k){ nRows++; if (isRel(P.recs[owner[k]].action)) nRelRows++; });",
      "      P.recs.forEach(function(r, ri){ if (posRows[ri]){ nPos++; if (isRel(r.action)) nRelPos++; } });",
      "      setStatus('AI Analyst plan applied to Portfolio Rebalancing: <b>' + nRows + '</b> row'",
      "        + (nRows === 1 ? '' : 's') + ' written for <b>' + nPos + '</b> holding' + (nPos === 1 ? '' : 's')",
      "        + (nRelPos ? (' (<b>' + nRelRows + '</b> row' + (nRelRows === 1 ? '' : 's') + ' for the <b>' + nRelPos",
      "            + '</b> holding' + (nRelPos === 1 ? ' that releases' : 's that release') + ' money)') : '')",
      "        + (missed.length ? (', <b>' + missed.length + '</b> with no rebalancing row: ' + few(missed)) : '')",
      "        + (shared.length ? ('; <b>' + shared.length + '</b> row' + (shared.length === 1 ? '' : 's')",
      "            + ' reached by two positions, which carr' + (shared.length === 1 ? 'ies' : 'y') + ' the later one: ' + few(shared)) : '')",
      "        + (off ? ('. The Rebalancing tab releases <b>' + aiaCr(chk.tab, model.unit) + '</b> against the plan’s <b>'",
      "            + aiaCr(chk.ai, model.unit) + '</b>: check the rows there') : '')",
      "        + '. It is a draft — edit it there before exporting.', (missed.length || shared.length || off) ? true : false);",
      "    } catch (e) {}"
    ].join('\n')
  },
  {
    label: 'KI-063 aiaRebalCheck() and aiaRowRecText()',
    from: '\n  function renderTaxation(){',
    to: [
      '',
      '  /* KI-063: does the Rebalancing tab hold what this plan wrote? Two verdicts.',
      '     ok      exact: the tab releases, to 1e-9 Cr, what the rows the plan writes release (each',
      "             member row's CMV across all clients x the position's %, from the tab's own fund",
      '             index), and every member of an acting position has a row. Any edit on the tab, a',
      '             member with no row, or a row two acting positions share makes it false (a row',
      '             shared with a Retain position is named by the status line). The "Applied"',
      '             badge uses this.',
      "     agrees  bounded: the tab's total against the plan's own figure, within the plan's rounding.",
      '             Each release is rounded to 0.01 Cr (an Exit, which the tab redeems in full, can be',
      '             0.005 Cr apart), each releasePct to 0.01% (a partial can be 0.005% of its value',
      '             apart), and the total to 0.01 Cr. The status line uses this.',
      '     null when the tab has no rows for this model. Keeps no state. */',
      '  function aiaRebalCheck(P){',
      '    if (!P || !P.ok || !P.summary || !model || !REBAL_FUNDS || !REBAL_FUNDS.byKey || REBAL_TAG !== rbTag()) return null;',
      '    var tab = rbSummary(REBAL_ROWS || []).released, ai = Number(P.summary.released) || 0;',
      '    var want = 0, missing = 0, tol = 0.005 + 1e-9;',
      '    (P.recs || []).forEach(function(r){',
      "      if (r.action === 'Exit') tol += 0.005;",
      '      else if (r.release > 0) tol += ((Number(r.cmv) || 0) + 0.005) * 0.00005;',
      "      if (r.action !== 'Exit' && r.action !== 'Partial Rebalance' && r.action !== 'Top-Up') return;",
      '      var pct = Math.max(0, Math.min(100, Number(r.releasePct) || 0)), seen = {};',
      '      ((r.members && r.members.length) ? r.members : [{ name: r.name }]).forEach(function(m){',
      "        var k = '';",
      "        try { k = rbKey({ name: m.name }); } catch (e){ k = ''; }",
      '        if (!k || !REBAL_FUNDS.byKey[k]){ missing++; return; }',
      '        if (seen[k]) return;',
      '        seen[k] = 1;',
      '        want += (Number(REBAL_FUNDS.byKey[k].totalCmvCr) || 0) * (pct / 100);',
      '      });',
      '    });',
      '    return { tab: tab, ai: ai, want: want, missing: missing, tol: tol,',
      '             ok: !missing && Math.abs(tab - want) <= 1e-9, agrees: Math.abs(tab - ai) <= tol };',
      '  }',
      '',
      "  /* KI-063: the recommendation clause for one row of a Partial Rebalance written to several",
      "     rows (a scheme's Regular and Direct plans, or names that differ by client). The row's own",
      "     release (its CMV across all clients x the row's %, in the file's unit) and its % come",
      "     first; the position's release is given only as the combined total. */",
      '  function aiaRowRecText(r, k, keys, pct){',
      '    var U = model.unit, e = REBAL_FUNDS.byKey[k], p = Number(pct) || 0;',
      '    var own = (Number(e && e.totalCmvCr) || 0) * (p / 100);',
      '    var others = keys.filter(function(x){ return x !== k; })',
      '      .map(function(x){ return REBAL_FUNDS.byKey[x] ? REBAL_FUNDS.byKey[x].name : x; });',
      "    return 'Reduce by ' + aiaCr(own, U) + ' (' + p.toFixed(2) + '% of this holding). '",
      "      + 'With the scheme’s other row' + (others.length === 1 ? '' : 's') + ' (' + others.join('; ') + '), '",
      "      + 'the combined total reduction is ' + aiaCr(r.release, U)",
      '      + ((r.wt != null && r.targetWt != null)',
      "          ? (', taking the scheme from ' + Number(r.wt).toFixed(2) + '% to ' + Number(r.targetWt).toFixed(2) + '% of the portfolio')",
      "          : '')",
      "      + '.';",
      '  }',
      '',
      '  function renderTaxation(){'
    ].join('\n')
  },
  {
    label: 'KI-063 the "Applied" badge only while the tab holds exactly what the plan wrote',
    from: "    var applied = (window.__AIA_APPLIED === rbTag()) ? '<span class=\"aia-applied\">Applied to the Rebalancing tab.</span>' : '';",
    to: [
      "    /* KI-063: \"Applied\" only while the Rebalancing tab holds exactly what this plan wrote */",
      "    var applied = '';",
      "    if (window.__AIA_APPLIED === rbTag()){",
      "      var _rbChk = null;",
      "      try { _rbChk = aiaRebalCheck(P); } catch (e) {}",
      "      applied = (_rbChk && !_rbChk.ok)",
      "        ? '<span class=\"aia-applied\" style=\"color:#931621;\">Applied, but the Rebalancing tab does not match this plan: it releases '",
      "          + aiaCr(_rbChk.tab, U) + ' against this plan’s ' + aiaCr(_rbChk.ai, U) + '.</span>'",
      "        : '<span class=\"aia-applied\">Applied to the Rebalancing tab.</span>';",
      "    }"
    ].join('\n')
  }
]);
