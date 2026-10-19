/* ============================================================================
   cvs-refresh.js — browser checks for the Current vs Sample (CVS) tab:
     KI-068  the Sample column and the CVS slide follow the rebalancing plan
             (renderRebal at once, rbRecalc after a pause, exports flush first),
             and cells typed into the CVS table survive a plan refresh;
     KI-067  each hybrid is split by its own equity sleeve; a hybrid with no
             sleeve data, or a Fund-of-Funds, is shown as "Unallocated †" with
             a footnote. Its Exp. Return cells start blank and, while blank,
             the column's Grand Total return, inflation-adjusted return and
             valuations show "—" (OD-29); a typed return is used and survives
             a plan refresh. The screen footnote asks the analyst for the
             return; the slide footnote only says the totals are shown as —,
             and an export of the CVS slide (single slide or deck) while a
             return is blank warns in the status line without blocking.

   How to run
     1. node tools/make-sample-base.js       (writes test-data/, git-ignored)
     2. node tools/serve-dashboard.js        -> open http://127.0.0.1:8099
     3. Paste this whole file into the browser console (or a browser tool's
        JavaScript runner). It defines window.cvsChecks.
     4. Run each check on a freshly loaded page (reload in between):
          await cvsChecks.planRefresh()    Sample_Base_File.xlsx from test-data/
          await cvsChecks.hybridSplit()    a two-fund workbook built in the page
          await cvsChecks.unallocated()    a workbook with an invented hybrid, built in the page
          await cvsChecks.fof()            a workbook with a hybrid-tagged Fund-of-Funds, built in the page
   Each returns { pass, checks[] }. Only synthetic data is used; planRefresh
   fetches the synthetic file from the local server, the dashboard itself makes
   no network request. Exports are captured in memory (downloads are not saved).
   On the build before the fix, planRefresh, hybridSplit, unallocated and fof
   fail.

   Expected values (two decimals) come from the synthetic book of
   tools/make-sample-base.js and the embedded HYBRID_ANALYTICS sleeve of
   360 ONE Multi Asset Allocation Fund (23.30%); they match the known-answer
   tests in tools/regression/KI-067-cvs-hybrid-split.js and KI-068-cvs-refresh.js.
   ========================================================================== */
(function () {
  'use strict';
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function waitFor(pred, ms, what) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 15000)) { try { if (pred()) return true; } catch (e) {} await sleep(150); }
    throw new Error('timed out waiting for ' + what);
  }
  function putBlob(inputId, blob, name) {
    var dt = new DataTransfer();
    dt.items.add(new File([blob], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    var el = document.getElementById(inputId);
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function put(inputId, url) {
    putBlob(inputId, await (await fetch(url, { cache: 'no-store' })).blob(), url.split('/').pop());
  }
  function statusLine() { return (document.body.innerText.match(/Loaded \d+ holdings[^\n]*/) || [''])[0]; }
  function result(checks) { return { pass: checks.every(function (c) { return c.pass; }), checks: checks }; }
  function near(a, b, tol) { return typeof a === 'number' && !isNaN(a) && Math.abs(a - b) <= (tol == null ? 0.006 : tol); }
  async function loaded(n, what) {
    await waitFor(function () { return new RegExp('Loaded ' + n + ' holdings').test(statusLine()); }, 30000, what);
    await sleep(1500);
  }

  /* a base file built in the page with the embedded SheetJS: rows [name, category, asset, amc, cmvCr] */
  var HDR = ['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'Folio No', 'AMC', 'Product Name', 'Distributor Name', 'Units',
    'Invested Value (₹)', 'Market Value (₹)', 'Total Gain/Loss (₹)', 'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Total Gain/Loss (Cr.)',
    'Allocation (%)', 'XIRR (%)', 'BMXIRR (%)', 'Avg. Holding Days', 'Purchase Date'];
  function workbook(spec) {
    var tot = spec.reduce(function (s, r) { return s + r[4]; }, 0);
    var aoa = [HDR].concat(spec.map(function (r, i) {
      var rs = r[4] * 1e7;
      return ['Synthetic Client', r[0], r[1], r[2], 'SYN-' + (1001 + i), r[3], 'Mutual Funds', 'Centricity', 1000,
        rs * 0.8, rs, rs * 0.2, r[4] * 0.8, r[4], r[4] * 0.2, r[4] / tot, 10, 9, 500, new Date(2024, 0, 15)];
    }));
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }), 'Base File');
    return new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]);
  }

  /* CVS state: the slide snapshot, the on-screen inputs, the table rows */
  function snap(gi, ri, f) { var s = window._cvsSnapshot; return (s && s.groups[gi] && s.groups[gi].rows[ri]) ? s.groups[gi].rows[ri][f] : null; }
  function cvsInput(g, r, field) { return document.querySelector('#s-cvs .cvs-num[data-g="' + g + '"][data-r="' + r + '"][data-field="' + field + '"]'); }
  function screenVal(g, r, field) { var el = cvsInput(g, r, field); return el ? parseFloat(el.value) : null; }
  /* typing then committing (Enter / leaving the cell fires change): since KI-114 only the commit redraws */
  function typeCvs(g, r, field, v) { var el = cvsInput(g, r, field); if (!el) return false; el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  function tableRow(label) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#s-cvs table.cvs-tbl tr'));
    var tr = rows.find(function (x) { return x.cells.length && x.cells[0].innerText.trim() === label; });
    return tr ? Array.prototype.map.call(tr.cells, function (c) { return c.innerText.trim(); }) : null;
  }
  function cvsText() { var e = document.getElementById('s-cvs'); return e ? e.innerText : ''; }
  /* the Unallocated row's Exp. Return cells (KI-067 / OD-29): k = 'cr' (current) or 'pr' (sample) */
  function unInput(k) { return document.querySelector('#s-cvs .cvs-num[data-un="' + k + '"]'); }
  function typeUn(k, v) { var el = unInput(k); if (!el) return false; el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  function tableRowStarting(prefix) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#s-cvs table.cvs-tbl tr'));
    var tr = rows.find(function (x) { return x.cells.length && x.cells[0].innerText.trim().indexOf(prefix) === 0; });
    return tr ? Array.prototype.map.call(tr.cells, function (c) { return c.innerText.trim(); }) : null;
  }

  /* the rebalancing plan, driven through its own controls */
  async function exitFund(re) {
    document.querySelector('#s-rebal .rb-addbtn[data-a="Exit"]').click(); await sleep(400);
    var opt = Array.prototype.find.call(document.querySelectorAll('#s-rebal .rb-pick[data-a="Exit"] .rb-po'), function (el) { return re.test(el.innerText); });
    if (!opt) throw new Error('no Exit picker entry for ' + re);
    opt.click(); await sleep(300);
    document.querySelector('#s-rebal .rb-pdone[data-a="Exit"]').click(); await sleep(1200);
  }
  function setExitPct(v) {   /* the % box of the (only) plan row: fires rbRecalc */
    var el = document.querySelector('#s-rebal .rb-pct'); if (!el) return false;
    el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); return true;
  }

  /* exports, captured in memory; returns the CVS slide's text runs */
  async function capture(trigger) {
    var caps = [], orig = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function (b) { caps.push(b); return orig.apply(this, arguments); };
    HTMLAnchorElement.prototype.click = function () {};
    try { trigger(); await waitFor(function () { return caps.length > 0; }, 180000, 'the PPTX export'); }
    finally { URL.createObjectURL = orig; HTMLAnchorElement.prototype.click = origClick; }
    var zip = await window.JSZip.loadAsync(await caps[caps.length - 1].arrayBuffer());
    var names = Object.keys(zip.files).filter(function (n) { return /^ppt\/slides\/slide\d+\.xml$/.test(n); });
    for (var i = 0; i < names.length; i++) {
      var x = await zip.file(names[i]).async('string');
      if (x.indexOf('CURRENT VS SAMPLE PORTFOLIO') >= 0) {
        return (x.match(/<a:t>[^<]*<\/a:t>/g) || []).map(function (s) {
          return s.replace(/<\/?a:t>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        });
      }
    }
    return [];
  }
  /* the status line an export leaves (KI-067: a warning while an Unallocated return is blank) */
  function statusEl() { return document.getElementById('status'); }
  function statusText() { var e = statusEl(); return e ? e.innerText.trim() : ''; }
  function statusIsWarn() { var e = statusEl(); return !!e && /\bwarn\b/.test(e.className); }
  function statusWarns(w) { return statusIsWarn() && statusText().indexOf(w) >= 0; }
  function slideCvsOnly() { var b = document.querySelector('#s-cvs .dlslide[data-tab="cvs"]'); if (!b) throw new Error('no CVS slide button'); b.click(); }
  function slideDeck() { document.getElementById('dlppt').click(); }
  /* [Curr alloc, Curr ret, Prop alloc, Prop ret, delta] of a row of a group on the slide */
  function slideRow(t, group, label) {
    var g = group ? t.indexOf(group) : 0, i = t.indexOf(label, g < 0 ? 0 : g);
    return i < 0 ? null : t.slice(i + 1, i + 6);
  }

  /* KI-068 on the synthetic sample book */
  async function planRefresh() {
    await put('file', '/test-data/Sample_Base_File.xlsx');
    await loaded(13, 'Sample_Base_File.xlsx to load');
    var c = [];
    c.push({ name: 'no plan: Sample = Current, Equity MF 50.85 (own hybrid sleeve; 52.43 before KI-067)', pass: near(snap(1, 0, 'ca'), 50.85) && near(snap(1, 0, 'pa'), 50.85) });

    var typed = typeCvs(1, 1, 'propAlloc', 15.5); await sleep(300);
    typed = typeCvs(1, 0, 'currRet', 13) && typed; await sleep(300);
    c.push({ name: 'typed Equity PMS Sample 15.50% and Equity MF Exp. Return 13.00%', pass: typed && snap(1, 1, 'pa') === 15.5 && snap(1, 0, 'cr') === 13 });

    await exitFund(/360 ONE Flexicap/i);       /* picker + Done -> renderRebal */
    var rel = window.__REBAL_DATA && window.__REBAL_DATA.summary && window.__REBAL_DATA.summary.released;
    c.push({ name: 'plan: Exit 360 ONE Flexicap (released ' + rel + ' Cr)', pass: near(rel, 0.6509, 0.0001) });
    c.push({ name: 'renderRebal refreshed the Sample column: Equity MF 46.90, Debt MF 27.31 (snapshot ' + snap(1, 0, 'pa') + ' / ' + snap(0, 0, 'pa') + ')', pass: near(snap(1, 0, 'pa'), 46.90) && near(snap(0, 0, 'pa'), 27.31) });
    c.push({ name: 'on screen: Sample Equity MF input shows 46.90 (' + screenVal(1, 0, 'propAlloc') + ')', pass: near(screenVal(1, 0, 'propAlloc'), 46.90) });
    c.push({ name: 'typed cells kept: Equity PMS Sample ' + snap(1, 1, 'pa') + ', Equity MF Exp. Return ' + snap(1, 0, 'cr'), pass: snap(1, 1, 'pa') === 15.5 && snap(1, 0, 'cr') === 13 });
    c.push({ name: 'Current column unchanged (Equity MF ' + snap(1, 0, 'ca') + ')', pass: near(snap(1, 0, 'ca'), 50.85) });

    /* rbRecalc: refreshed after the typing pause */
    setExitPct(50);
    var before = snap(1, 0, 'pa');
    await sleep(800);
    c.push({ name: 'rbRecalc (exit 50%): not re-rendered on the keystroke (' + before + '), refreshed after the pause: Equity MF 48.95 (' + snap(1, 0, 'pa') + ')', pass: near(before, 46.90) && near(snap(1, 0, 'pa'), 48.95) && near(screenVal(1, 0, 'propAlloc'), 48.95) });

    /* an export right after a keystroke flushes the pending refresh */
    setExitPct(75);
    var pending = snap(1, 0, 'pa');
    var t1 = await capture(slideCvsOnly);
    var r1 = slideRow(t1, 'Equity', 'Mutual Funds');
    c.push({ name: 'single-slide export right after a keystroke (exit 75%): slide Equity MF ' + (r1 && r1[0]) + ' -> ' + (r1 && r1[2]) + ' (expected 50.85% -> 47.94%; snapshot before the export ' + pending + ')', pass: near(pending, 48.95) && !!r1 && r1[0] === '50.85%' && r1[2] === '47.94%' });
    var p1 = slideRow(t1, 'Equity', 'PMS');
    c.push({ name: 'slide keeps the typed Equity PMS Sample (' + (p1 && p1[2]) + ')', pass: !!p1 && p1[2] === '15.50%' });

    setExitPct(100);
    pending = snap(1, 0, 'pa');
    var t2 = await capture(slideDeck);
    var r2 = slideRow(t2, 'Equity', 'Mutual Funds');
    c.push({ name: 'full deck export right after a keystroke (exit 100%): slide Equity MF ' + (r2 && r2[0]) + ' -> ' + (r2 && r2[2]) + ' (expected 50.85% -> 46.90%; snapshot before the export ' + pending + ')', pass: near(pending, 47.94) && !!r2 && r2[0] === '50.85%' && r2[2] === '46.90%' });

    /* Re-seed still hands the typed Sample cells back to the plan */
    document.getElementById('cvs-reseed-btn').click(); await sleep(800);
    c.push({ name: 'Re-seed: Equity PMS Sample back to the plan, 15.52 (' + snap(1, 1, 'pa') + ')', pass: near(snap(1, 1, 'pa'), 15.52) });
    return result(c);
  }

  /* KI-067: 80% HDFC Large Cap + 20% ABSL Conservative Hybrid (own sleeve 20.40%) */
  async function hybridSplit() {
    putBlob('file', workbook([['HDFC Large Cap Fund(G)', 'Large Cap Fund', 'Equity', 'HDFC', 8.0],
      ['Aditya Birla SL Conservative Hybrid Fund(G)', 'Conservative Hybrid Fund', 'Hybrid', 'Aditya', 2.0]]), 'CVS_Check_Hybrid_Split.xlsx');
    await loaded(2, 'the in-page workbook to load');
    var g = tableRow('Grand Total');
    return result([
      { name: 'Equity MF 84.08 / Debt MF 15.92 (shipped 96.82 / 3.18): ' + snap(1, 0, 'ca') + ' / ' + snap(0, 0, 'ca'), pass: near(snap(1, 0, 'ca'), 84.08) && near(snap(0, 0, 'ca'), 15.92) },
      { name: 'Grand Total current: 100.00% at 12.85% (shipped 13.77%): ' + JSON.stringify(g), pass: !!g && g[1] === '100.00%' && g[2] === '12.85%' },
      { name: 'no Unallocated row when every hybrid has a sleeve', pass: !tableRow('Unallocated †') }
    ]);
  }

  /* KI-067: a hybrid with no sleeve data is Unallocated, on screen and on the slide; its
     expected return is blank until entered (OD-29), and the totals show "—" meanwhile.
     Known answers: 80% x 14.00% + 20% x 9.00% = 13.00%; after the plan exits the hybrid the
     sample is 100% Equity MF at 14.00%. */
  async function unallocated() {
    putBlob('file', workbook([['HDFC Large Cap Fund(G)', 'Large Cap Fund', 'Equity', 'HDFC', 8.0],
      ['Zzyzx Notional Balanced Hybrid Fund(G)', 'Balanced Advantage Fund', 'Hybrid', 'Zzyzx', 2.0]]), 'CVS_Check_Unallocated.xlsx');
    await loaded(2, 'the in-page workbook to load');
    var NEED = /Enter an expected return for the unallocated share to see the totals/;
    var TYPED = /The sample's Unallocated share follows the rebalancing plan and cannot be typed over/;
    var SHOWN = 'No return is assumed for it, so the current and sample expected returns and valuations are shown as —.';
    var WARN = 'The Current vs Sample slide shows — for the current and sample totals: no expected return is set for the unallocated share (Current vs Sample tab).';
    var c = [], u = tableRow('Unallocated †'), g = tableRow('Grand Total'), ia = tableRowStarting('Inflation-Adjusted Return'), v3 = tableRow('Valuation After 3Y — Nominal');
    c.push({ name: 'Equity MF 80.00 / Debt MF 0.00: the unknown hybrid is not split (' + snap(1, 0, 'ca') + ' / ' + snap(0, 0, 'ca') + ')', pass: near(snap(1, 0, 'ca'), 80) && near(snap(0, 0, 'ca'), 0) });
    c.push({ name: 'on screen: Unallocated † row 20.00% / [blank cell] / 20.00% / [blank cell] (' + JSON.stringify(u) + ')',
      pass: !!u && u[1] === '20.00%' && u[3] === '20.00%' && !!unInput('cr') && unInput('cr').value === '' && !!unInput('pr') && unInput('pr').value === '' });
    c.push({ name: 'on screen: Grand Total 100.00% / — / 100.00% / — while the return is blank (' + JSON.stringify(g) + ')', pass: !!g && g[1] === '100.00%' && g[2] === '—' && g[3] === '100.00%' && g[4] === '—' });
    c.push({ name: 'on screen: inflation-adjusted return and 3Y valuation — (' + JSON.stringify([ia, v3]) + ')', pass: !!ia && ia[1] === '—' && ia[2] === '—' && !!v3 && v3[1] === '—' && v3[2] === '—' });
    c.push({ name: 'on screen: footnote names the fund, says the sample\'s share cannot be typed over and asks for the return',
      pass: /Unallocated: 1 hybrid holding \(Zzyzx Notional Balanced Hybrid Fund\(G\)\) has no equity \/ debt sleeve/.test(cvsText()) && TYPED.test(cvsText()) && NEED.test(cvsText()) });
    var t = await capture(slideCvsOnly), r = slideRow(t, null, 'Unallocated †'), gt = slideRow(t, null, 'Grand Total');
    c.push({ name: 'slide: Unallocated row ' + JSON.stringify(r), pass: !!r && r[0] === '20.00%' && r[1] === '—' && r[2] === '20.00%' && r[3] === '—' && r[4] === '+0.00%' });
    c.push({ name: 'slide: Grand Total ' + JSON.stringify(gt && gt.slice(0, 4)), pass: !!gt && gt[0] === '100.00%' && gt[1] === '—' && gt[2] === '100.00%' && gt[3] === '—' });
    c.push({ name: 'slide: footnote says the totals are shown as — and carries no instruction to the analyst',
      pass: t.some(function (x) { return /Unallocated: 1 hybrid holding/.test(x) && x.indexOf(SHOWN) >= 0 && !NEED.test(x) && !TYPED.test(x); }) });
    c.push({ name: 'single-slide export: not blocked; the status line warns in the warning style: "' + statusText() + '"', pass: statusWarns(WARN) && /Slide downloaded/.test(statusText()) });
    t = await capture(slideDeck);
    c.push({ name: 'full deck export: the status line warns likewise: "' + statusText() + '"', pass: statusWarns(WARN) && /PowerPoint downloaded/.test(statusText()) && t.length > 0 });

    var typed = typeUn('cr', 9); await sleep(300);
    typed = typeUn('pr', 9) && typed; await sleep(300);
    g = tableRow('Grand Total');
    c.push({ name: 'typed 9.00 into both Unallocated Exp. Return cells: Grand Total 13.00% / 13.00% (' + JSON.stringify(g) + ')', pass: typed && !!g && g[2] === '13.00%' && g[4] === '13.00%' });
    t = await capture(slideCvsOnly); r = slideRow(t, null, 'Unallocated †'); gt = slideRow(t, null, 'Grand Total');
    c.push({ name: 'slide: Unallocated 9.00% / 9.00%, Grand Total 13.00% / 13.00% (' + JSON.stringify([r, gt && gt.slice(0, 4)]) + ')',
      pass: !!r && r[1] === '9.00%' && r[3] === '9.00%' && !!gt && gt[1] === '13.00%' && gt[3] === '13.00%' && !t.some(function (x) { return NEED.test(x); }) });
    c.push({ name: 'export with both returns entered: no warning ("' + statusText() + '")', pass: /Slide downloaded/.test(statusText()) && !statusIsWarn() && !/no expected return is set/.test(statusText()) });

    await exitFund(/Zzyzx Notional Balanced/i);
    u = tableRow('Unallocated †'); g = tableRow('Grand Total');
    c.push({ name: 'plan exits the unknown hybrid: Unallocated 20.00% -> 0.00%, Sample Equity MF 100.00 (' + JSON.stringify(u) + ', ' + snap(1, 0, 'pa') + ')', pass: !!u && u[1] === '20.00%' && u[3] === '0.00%' && near(snap(1, 0, 'pa'), 100) });
    c.push({ name: 'the typed return survives the plan refresh: Grand Total 13.00% / 14.00% (' + JSON.stringify(g) + ', input ' + (unInput('cr') && unInput('cr').value) + ')',
      pass: !!unInput('cr') && unInput('cr').value === '9.00' && !!g && g[2] === '13.00%' && g[4] === '14.00%' });
    return result(c);
  }

  /* KI-067 review case: a hybrid-tagged Fund-of-Funds is never looked through by the engine, so
     it is Unallocated (it matches another scheme's record, ICICI Pru Arbitrage Fund: 94.23 / 5.77
     before the review) */
  async function fof() {
    putBlob('file', workbook([['HDFC Large Cap Fund(G)', 'Large Cap Fund', 'Equity', 'HDFC', 8.0],
      ['ICICI Pru Income plus Arbitrage Omni FOF(G)', 'FoF Domestic', 'Hybrid', 'ICICI', 2.0]]), 'CVS_Check_FoF.xlsx');
    await loaded(2, 'the in-page workbook to load');
    var u = tableRow('Unallocated †'), g = tableRow('Grand Total');
    return result([
      { name: 'Equity MF 80.00 / Debt MF 0.00 (' + snap(1, 0, 'ca') + ' / ' + snap(0, 0, 'ca') + '; 94.23 / 5.77 before the review)', pass: near(snap(1, 0, 'ca'), 80) && near(snap(0, 0, 'ca'), 0) },
      { name: 'Unallocated † 20.00% / 20.00% (' + JSON.stringify(u) + ')', pass: !!u && u[1] === '20.00%' && u[3] === '20.00%' },
      { name: 'Grand Total returns — until a return is entered (' + JSON.stringify(g) + ')', pass: !!g && g[2] === '—' && g[4] === '—' },
      { name: 'footnote names the FoF and says Fund-of-Funds are not looked through',
        pass: /ICICI Pru Income plus Arbitrage Omni FOF\(G\)\) has no equity \/ debt sleeve in the look-through data \(Fund-of-Funds are not looked through\)/.test(cvsText()) }
    ]);
  }

  window.cvsChecks = { planRefresh: planRefresh, hybridSplit: hybridSplit, unallocated: unallocated, fof: fof };
})();
