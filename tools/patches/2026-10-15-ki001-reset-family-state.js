/* ============================================================================
   2026-10-15 — KI-001: a new client's base file inherits nothing from the
   previous review.

   Loading a second base file in the same tab used to keep the previous
   family's IRR / PMS-AIF (client SOA) / bonds uploads, its post-rebalancing
   look-through (cached on the rebalancing deltas alone, so two families with
   no actions shared one cache entry), its rebalancing plan (reset only inside
   renderRebal, which runs after renderAnalytics and renderCVS have read it),
   its slide-picker ticks, overlap selection and threshold, Taxation client
   scope and CVS edits. B's Excel export even carried a "Fund IRR" sheet built
   from A's IRR file.

   The fix
     - adds resetFamilyState() to the UI script, called when a base file
       replaces an already-loaded one (handle()) and when the loaded file is
       removed (dz-remove). The first base file of a session clears nothing,
       so a client upload made before it is kept. Market-data uploads
       (MF / Direct / SIF monitors, Market Update slides) are never cleared.
       The status line names any upload that was cleared.
     - clears the post-rebalancing cache on every recompute (loadModel), so it
       can never outlive the model it was computed from.

     node tools/patches/2026-10-15-ki001-reset-family-state.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('KI-001 reset family state', [
  {
    label: 'loadModel(): the post-rebalancing cache never outlives its model',
    from: '    anScope=null; anCache={};   // reset look-through scope on any (re)compute',
    to: [
      '    anScope=null; anCache={};   // reset look-through scope on any (re)compute',
      '    _rbAnCache=null; _rbAnTag=null;   // KI-001: the post-rebalancing look-through is recomputed with the model'
    ].join('\n')
  },
  {
    label: 'define resetFamilyState() inside the UI script, before deriveFamily()',
    from: '  function deriveFamily(fn,rows){',
    to: [
      "  /* KI-001: a new client's base file must inherit nothing from the previous review.",
      '     Runs when a base file replaces a loaded one and when the loaded file is removed,',
      '     never on the first load, so a client upload made before it is kept. The client',
      '     upload slots (IRR transactions; PMS / AIF analytics; bonds / debt analytics) return',
      '     to the embedded defaults, and the look-through, rebalancing, overlap, slide-picker,',
      '     CVS, taxation and AI-analyst state is dropped. Market-data uploads (MF / Direct /',
      '     SIF monitors, Market Update slides) are kept. Returns the uploads it cleared. */',
      '  function resetFamilyState(){',
      "    var cleared=[], lab=function(id){ var el=document.getElementById(id); return el?String(el.textContent||'').trim():''; };",
      '    model=null; currentRows=null;   /* first, so resetRef() does not recompute the old family */',
      "    if(activeRef.IRR){ resetRef('irr','rs-irr','Not uploaded'); cleared.push('IRR transactions'); }",
      "    if(lab('rs-pms')!=='Embedded default'){ resetRef('pms','rs-pms','Embedded default'); cleared.push('PMS / AIF analytics'); }",
      "    if(lab('rs-bonds')!=='Embedded default'){ resetRef('bonds','rs-bonds','Embedded default'); cleared.push('bonds / debt analytics'); }",
      '    anCharts.forEach(function(c){ try{ c.destroy(); }catch(e){} }); anCharts=[];',
      '    rbCharts.forEach(function(c){ try{ c.destroy(); }catch(e){} }); rbCharts=[];',
      '    anCache={}; anScope=null;',
      '    _rbAnCache=null; _rbAnTag=null; _ppHeld=null; _ppHeldTag=null;',
      '    REBAL_TAG=null; REBAL_SORT={k:null,dir:1}; REBAL_STATE={}; REBAL_FILTER=null; REBAL_OPEN=null;',
      "    REBAL_PICKQ=''; REBAL_PICKDIRTY=false; REBAL_NEW=[]; REBAL_NEWSEQ=0; REBAL_ROWS=[]; REBAL_FUNDS=null;",
      '    try{ rbACClose(); }catch(e){}',
      '    slidePickReset();',
      '    ovSel=null; ovTh=0; ovSelPost=null; ovThPost=0;',
      '    taxScope=null; __cvsAction=null;',
      '    try{ window.__taxScope=null; window.__cvsEdited={}; window._cvsSnapshot=null; window.__REBAL_DATA=null;',
      '         window.__PROPPERF_DATA=null; window.__AIA_DATA=null; window.__AIA_APPLIED=null; window.__COST_DATA=null;',
      '         window.__PORT_COST_FULL=null; window.__MFA_DATA=null; window._mfaRat={}; window.__REBAL_UNIV=null; }catch(e){}',
      '    return cleared;',
      '  }',
      '  function deriveFamily(fn,rows){'
    ].join('\n')
  },
  {
    label: 'handle(): reset when a base file replaces a loaded one, and say what was cleared',
    from: '        currentRows=rows; currentFamily=deriveFamily(f.name, rows); currentDate=pickedAsOn||deriveDate(f.name);\n        loadModel();',
    to: [
      '        var _cleared=currentRows?resetFamilyState():null;   /* KI-001: nothing carries over from the previous family */',
      '        currentRows=rows; currentFamily=deriveFamily(f.name, rows); currentDate=pickedAsOn||deriveDate(f.name);',
      '        loadModel();',
      "        if(_cleared&&_cleared.length) status.insertAdjacentHTML('beforeend',' <span style=\"color:#5C3E17\">Cleared from the previous file: '+_cleared.join(', ')+'. Upload this family\\u2019s files again if needed.</span>');"
    ].join('\n')
  },
  {
    label: 'dz-remove: removing the base file also clears the family state',
    from: '      currentRows=null; model=null;\n      charts.forEach(function(ch){try{ch.destroy();}catch(ex){}});charts=[];',
    to: '      currentRows=null; model=null; resetFamilyState();   /* KI-001 */\n      charts.forEach(function(ch){try{ch.destroy();}catch(ex){}});charts=[];'
  }
]);
