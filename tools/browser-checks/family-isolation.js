/* ============================================================================
   family-isolation.js — browser regression checks for KI-001 (a second client
   loaded in the same tab must inherit nothing from the first).

   How to run
     1. node tools/make-sample-base.js       (writes test-data/, git-ignored)
     2. node tools/serve-dashboard.js        -> open http://127.0.0.1:8099
     3. Paste this whole file into the browser console (or a browser tool's
        JavaScript runner). It defines window.familyChecks.
     4. Run each check on a freshly loaded page (reload in between):
          await familyChecks.isolation()
          await familyChecks.irrBeforeBase()
          await familyChecks.removeThenReload()
   Each returns { pass, checks[] }. Only synthetic files are used, fetched
   from the local server; the dashboard itself makes no network request.
   On the baseline build (before the KI-001 fix) isolation() fails.
   ========================================================================== */
(function () {
  'use strict';
  var A_MARKERS = ['Sample Client A', 'Sample Client B', 'Aditya Birla SL', '360 ONE', '2Point2',
    'ABB India', 'Alchemy', 'Altiva', 'Sample Unknown'];
  /* sections built only from the loaded family's holdings and uploads; the AI Analyst,
     Rebalancing autocomplete and Performance tabs may legitimately name other funds */
  var FAMILY_SECTIONS = ['s-asset', 's-distalloc', 's-clalloc', 's-amc', 's-obs', 's-holdings', 's-analytics',
    's-overlap', 's-overlap-post', 's-cost', 's-irr', 's-cvs', 's-tax'];

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function waitFor(pred, ms, what) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 15000)) { try { if (pred()) return true; } catch (e) {} await sleep(150); }
    throw new Error('timed out waiting for ' + what);
  }
  async function put(inputId, url) {
    var blob = await (await fetch(url, { cache: 'no-store' })).blob();
    var dt = new DataTransfer();
    dt.items.add(new File([blob], url.split('/').pop(), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    var el = document.getElementById(inputId);
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function statusLine() { return (document.body.innerText.match(/Loaded \d+ holdings[^\n]*/) || [''])[0]; }
  function text(id) { var el = document.getElementById(id); return el ? el.innerText : ''; }
  function result(checks) { return { pass: checks.every(function (c) { return c.pass; }), checks: checks }; }
  async function loadBase(url, n) {
    await put('file', url);
    await waitFor(function () { return new RegExp('Loaded ' + n + ' holdings').test(statusLine()); }, 20000, url + ' to load');
    await sleep(1500);
  }
  async function uploadIrr() {
    await put('up-irr', '/test-data/Sample_IRR_Transactions.xlsx');
    await waitFor(function () { return /^Uploaded:/.test(text('rs-irr')); }, 20000, 'the IRR upload');
    await sleep(1500);
  }
  /* the workbook the toolbar exports, captured in memory (downloads may be blocked) */
  async function exportedSheetNames() {
    var caps = [], orig = URL.createObjectURL;
    URL.createObjectURL = function (b) { caps.push(b); return orig.apply(this, arguments); };
    try {
      document.getElementById('dlxls').click();
      await waitFor(function () { return caps.length > 0; }, 15000, 'the Excel export');
      var wb = XLSX.read(new Uint8Array(await caps[caps.length - 1].arrayBuffer()), { type: 'array' });
      return wb.SheetNames;
    } finally { URL.createObjectURL = orig; }
  }

  /* A (with IRR, Taxation scope = Sample Client A, a slide ticked) then B: nothing of A may remain */
  async function isolation() {
    await loadBase('/test-data/Sample_Base_File.xlsx', 13);
    await uploadIrr();
    var scopeBtn = Array.prototype.find.call(document.querySelectorAll('#s-tax button'), function (b) { return /^Sample Client A/.test(b.innerText); });
    if (scopeBtn) { scopeBtn.click(); await sleep(1200); }
    var scopeSetBefore = window.__taxScope === 'Sample Client A';
    var tick = document.querySelector('.rnav-cb[data-slide]:not(:checked)');
    if (tick) { tick.click(); await sleep(500); }
    var tickedBefore = document.querySelectorAll('.rnav-cb[data-slide]:checked').length;
    await loadBase('/test-data/Sample_Base_File_B.xlsx', 4);
    var statusB = statusLine();               /* read now: an export replaces the status line */
    var leaks = [];
    FAMILY_SECTIONS.forEach(function (id) {
      var t = text(id);
      A_MARKERS.forEach(function (m) { if (t.indexOf(m) >= 0) leaks.push(id + ': "' + m + '"'); });
    });
    var sheets = await exportedSheetNames();
    return result([
      { name: 'precondition: Taxation scope set to Sample Client A and ' + tickedBefore + ' slide(s) ticked for family A', pass: scopeSetBefore && tickedBefore > 0 },
      { name: 'family B loaded: ' + statusB, pass: /Loaded 4 holdings/.test(statusB) },
      { name: 'status line says the previous IRR upload was cleared', pass: /Cleared from the previous file: IRR transactions/.test(statusB) },
      { name: 'no family-A fund or client name in any family section', pass: leaks.length === 0, detail: leaks },
      { name: 'Taxation scope reset (window.__taxScope = ' + JSON.stringify(window.__taxScope) + ')', pass: !window.__taxScope },
      { name: 'IRR upload cleared (label: "' + text('rs-irr') + '")', pass: text('rs-irr') === 'Not uploaded' },
      { name: 'Fund IRR no longer transaction-based', pass: text('s-irr').indexOf('transaction-based') < 0 },
      { name: 'slide-picker ticks cleared', pass: document.querySelectorAll('.rnav-cb[data-slide]:checked').length === 0 },
      { name: 'Excel export has no "Fund IRR" sheet (' + sheets.length + ' sheets)', pass: sheets.indexOf('Fund IRR') < 0, detail: sheets }
    ]);
  }

  /* on a fresh page: an IRR file uploaded BEFORE the first base file must be kept */
  async function irrBeforeBase() {
    await uploadIrr();
    await loadBase('/test-data/Sample_Base_File.xlsx', 13);
    return result([
      { name: 'IRR label kept after the first base file (' + text('rs-irr') + ')', pass: /^Uploaded:/.test(text('rs-irr')) },
      { name: 'Fund IRR is transaction-based', pass: text('s-irr').indexOf('transaction-based') >= 0 },
      { name: 'nothing reported as cleared on a first load', pass: !/Cleared from the previous file/.test(statusLine()) }
    ]);
  }

  /* load A with IRR, remove the base file (x), upload the IRR again, load A again: the new upload is kept */
  async function removeThenReload() {
    await loadBase('/test-data/Sample_Base_File.xlsx', 13);
    await uploadIrr();
    document.getElementById('dz-remove').click();
    await sleep(800);
    var clearedOnRemove = text('rs-irr') === 'Not uploaded' && !window.__taxScope;
    await uploadIrr();
    await loadBase('/test-data/Sample_Base_File.xlsx', 13);
    return result([
      { name: 'removing the base file cleared the client uploads', pass: clearedOnRemove },
      { name: 'IRR uploaded after removal is kept (' + text('rs-irr') + ')', pass: /^Uploaded:/.test(text('rs-irr')) },
      { name: 'Fund IRR is transaction-based', pass: text('s-irr').indexOf('transaction-based') >= 0 }
    ]);
  }

  window.familyChecks = { isolation: isolation, irrBeforeBase: irrBeforeBase, removeThenReload: removeThenReload };
})();
