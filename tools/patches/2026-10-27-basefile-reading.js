/* ============================================================================
   2026-10-27: legacy fix batch 4, base-file reading (KI-140 to KI-146; CR-0009, D-041)
   Edits in the engine script (07_engine.js) and the UI script (11_app_ui.js).
   Applies after the 2026-10-22 patch. Found by the new build's parity work (M1.3,
   tests/parity/base-file-ledger.json, D-035); the live page now reads these cases as
   the new reader does, except KI-142, where the live page skips the row.

   KI-140  Merged duplicate folios add up units only when every folio has them. One
           folio without units leaves the merged units blank (KI-113 extended to units,
           D-035), never a partial sum, and marks the holding (unitsGap). Taxation does
           not reconcile such a fund on invested value (D-035's rule for a unit-priced
           holding with a merge gap in units): it is unsplit, with a reason.
   KI-141  A merged holding is dated by its EARLIEST purchase date, whatever the row
           order, and its holding days are recomputed from that date: a folio's purchase
           date plus its holding days is the date the file counts to; when every folio
           with holding days has a date and they count to the same date (within a day),
           the merged days run from the earliest purchase date to it. Folios with no
           purchase date and the same holding days keep that figure. Otherwise the
           merged days are blank, never one folio's figure (D-041).
   KI-142  A row whose Instrument Name is "Total" or "Grand Total" (any case, spaces
           trimmed) is skipped with a notice; it used to be read as a holding.
   KI-143  A number cell counts only when all of it is a number (sign, digits, thousands
           commas, decimals, exponent; a trailing "%" in XIRR / BMXIRR). "12abc" and
           "1.25 Cr" used to be read by parseFloat as 12 and 1.25; they are now blank with
           a notice naming the column. A market value so blanked falls through to the
           next money column, as a blank one does (the new reader's order, KI-147).
   KI-144  A text date that does not exist ("31-02-2024", "31 Feb 2024") is blank with a
           notice; new Date() used to roll it into the next month.
   KI-145  Asset Names that differ from a class only in letter case or spacing, or by an
           OD-7 synonym ("Fixed Income", "Debt Funds" are Debt; "Commodities" is
           Commodity), are read as the class: ENGINE.assetLabel. One Asset Allocation row
           per class; the client sheets, analytics routing, performance buckets and tax
           classes follow. Other labels keep their first written form in the file. The IRR
           placement of unreached instruments reads its label the same way.
   KI-146  The IPS asset-class actuals add up every matching Asset Allocation row (they
           kept only the last) and read each label as its class first; getIPSData also
           returns the class sums (classCMV) for the record and the regression test.
   Notices: parseBaseRows returns rows.notices ({text, warn}); loadModel shows them on
   the status line, escaped (they quote column headers and labels from the file).
   This script is ASCII only: characters such as the em dash are built with
   String.fromCharCode.

     node tools/patches/2026-10-27-basefile-reading.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

const R = String.raw;

applyPatch('Legacy fix batch 4: base-file reading (KI-140 to KI-146)', [
  /* ---------------- engine (07) ---------------- */
  {
    label: 'KI-145 assetLabel(): one written form per asset class (module scope, before parseBaseRows)',
    from: R`  /* ===========================================================================
     PARSE base-file rows (array of arrays, first row = header)`,
    to: R`  /* ---- KI-145 (OD-7): one written form per asset class ----
     The Asset Allocation, the client sheets and the IPS group holdings by Asset Name. A label that
     differs from one of the five classes only in letter case or spacing ("EQUITY", "REITs / InvITs"),
     or that OD-7 names as a synonym ("Fixed Income" and "Debt Funds" are Debt; "Commodities" is
     Commodity, as isCommodity already reads it), is read as that class. Any other label keeps its own
     name; with a "seen" map, its variants in case or spacing take the first form written. A blank
     label gives "" (parseBaseRows still reads a blank as Equity). */
  var ASSET_CANON={"equity":"Equity","debt":"Debt","hybrid":"Hybrid","commodity":"Commodity","commodities":"Commodity",
    "reits/invits":"REITs/InvITs","fixed income":"Debt","debt funds":"Debt"};
  function assetLabel(s,seen){
    var w=ws(s); if(!w) return "";
    var k=w.replace(/ ?\/ ?/g,"/").toLowerCase(), own=Object.prototype.hasOwnProperty;
    if(own.call(ASSET_CANON,k)) return ASSET_CANON[k];
    if(seen){ if(!own.call(seen,k)) seen[k]=w; return seen[k]; }
    return w;
  }

  /* ===========================================================================
     PARSE base-file rows (array of arrays, first row = header)`
  },
  {
    label: 'KI-143 gn / gnPct: a number cell counts only when all of it is a number',
    from: R`    function gn(r,c){ var v=gv(r,c); if(v==null||v==="") return null; var f=parseFloat(String(v).replace(/,/g,"")); return isNaN(f)?null:f; }
    function gnPct(r,c){ var v=gn(r,c); return v!=null ? v/100 : null; }`,
    to: R`    /* KI-143: a number cell counts only when ALL of it is a number: a sign, digits with thousands commas
       or spaces, a decimal part, an exponent, and in the XIRR / BMXIRR columns a trailing "%". parseFloat
       used to read "12abc" as 12 and "1.25 Cr" as 1.25. Such a cell is now blank (never 0) and counted for
       a notice naming its column. Text meaning "not available" ("NA", "-", "nil" ...) is blank with no
       notice, as before. KI-144: a text date that does not exist is blank, with a notice (fmtPD). */
    var _ri=-1, _badCell={}, _badNum={}, _badDate={}, _own=function(o,k){ return Object.prototype.hasOwnProperty.call(o,k); };
    var _NUM=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    var _NA={"na":1,"n/a":1,"n.a.":1,"n.a":1,"nil":1,"none":1,"not available":1,"-":1,"--":1};
    _NA[String.fromCharCode(8212)]=1; _NA[String.fromCharCode(8211)]=1;   /* an em or en dash alone */
    var _MINUS=new RegExp(String.fromCharCode(8722),"g");                 /* the minus sign U+2212 */
    function _bad(c,tally){ var k=_ri+":"+c; if(_badCell[k]) return; _badCell[k]=1; var h=ws((aoa[hi]||[])[c])||("column "+(c+1)); tally[h]=(tally[h]||0)+1; }
    function gnx(r,c,pct){ var v=gv(r,c); if(v==null||v==="") return null;
      if(typeof v==="number") return isFinite(v)?v:null;
      if(typeof v!=="string"){ _bad(c,_badNum); return null; }
      var t=ws(v); if(t===""||_own(_NA,t.toLowerCase())) return null;
      var s=t.replace(/[\s,]/g,"").replace(_MINUS,"-"); if(pct && s.charAt(s.length-1)==="%") s=s.slice(0,-1);
      var f=_NUM.test(s)?Number(s):NaN; if(!isFinite(f)){ _bad(c,_badNum); return null; } return f; }
    function gn(r,c){ return gnx(r,c,false); }
    function gnPct(r,c){ var v=gnx(r,c,true); return v!=null ? v/100 : null; }`
  },
  {
    label: 'KI-141 / KI-144 date helpers: the day number of each purchase date; impossible dates are blank',
    from: R`    function _fmtPDd(d){ var M=`,
    to: R`    /* the day number (UTC days since 1 Jan 1970) of the calendar date fmtPD last read, null when none:
       the merge compares the purchase dates of duplicate folios with it (KI-141) */
    var _pdDay=null;
    function _dayOf(y,m,d){ if(!(m>=1&&m<=12&&d>=1&&d<=31)) return null; var t=Date.UTC(y,m-1,d), b=new Date(t); return (b.getUTCFullYear()===y&&b.getUTCMonth()===m-1&&b.getUTCDate()===d)?Math.round(t/86400000):null; }
    var _MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12,january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
    /* KI-144: a text date is read only when it exists ("31-02-2024" used to become 2 Mar 2024) */
    function _pdYMD(y,m,d){ if(_dayOf(y,m,d)==null){ _bad(col.pdate,_badDate); return ""; } return _fmtPDd(new Date(y,m-1,d)); }
    function _fmtPDd(d){ _pdDay=_dayOf(d.getFullYear(),d.getMonth()+1,d.getDate()); var M=`
  },
  {
    label: 'KI-141 fmtPD: reset the day number for each cell',
    from: R`    function fmtPD(v){ if(v==null||v==="") return "";`,
    to: R`    function fmtPD(v){ _pdDay=null; if(v==null||v==="") return "";`
  },
  {
    label: 'KI-144 fmtPD: year-first text dates are checked',
    from: R`if(m) return _fmtPDd(new Date(+m[1],+m[2]-1,+m[3]));`,
    to: R`if(m) return _pdYMD(+m[1],+m[2],+m[3]);`
  },
  {
    label: 'KI-144 fmtPD: day-first text dates are checked; "D Mon YYYY" text is checked and kept as written',
    from: R`if(mm>12){var t=dd;dd=mm;mm=t;} return _fmtPDd(new Date(+m[3],mm-1,dd)); } return s; }`,
    to: R`if(mm>12){var t=dd;dd=mm;mm=t;} return _pdYMD(+m[3],mm,dd); } m=/^(\d{1,2})[ -]([A-Za-z]{3,9})[ ,-]+(\d{4})$/.exec(ws(s)); if(m&&_own(_MON,m[2].toLowerCase())){ var _k=_dayOf(+m[3],_MON[m[2].toLowerCase()],+m[1]); if(_k==null){ _bad(col.pdate,_badDate); return ""; } _pdDay=_k; } return s; }`
  },
  {
    label: 'KI-142 / KI-145 counters and the asset reader, before the row loop',
    from: R`    var rows=[];
    for (var ri=hi+1; ri<aoa.length; ri++){`,
    to: R`    var rows=[], _totalRows=0, _lostMv=0, _seenAsset={}, _assetRead={};
    /* KI-145: the Asset Name as its class (assetLabel); a blank one is still Equity, as before */
    function _asset(v){ var w=ws(v); if(!w) return "Equity"; var a=assetLabel(w,_seenAsset); if(a!==w) _assetRead[w]=a; return a; }
    for (var ri=hi+1; ri<aoa.length; ri++){`
  },
  {
    label: 'KI-142 a "Total" / "Grand Total" row is skipped; KI-143 a holding whose market value is not a number is counted',
    from: R`      var nm = ws(gv(r,col.name)); if(!nm) continue;
      var cmv = pickCr(r,col.cmvCr,col.mvLk,col.mvR);
      if (cmv==null) continue; // skip totals/blank rows w/o CMV (in ANY unit)`,
    to: R`      var nm = ws(gv(r,col.name)); if(!nm) continue;
      /* KI-142: a total row of the book is never a holding (it would double every total) */
      if (/^(grand ?)?total$/i.test(nm)){ _totalRows++; continue; }
      _ri=ri;
      var cmv = pickCr(r,col.cmvCr,col.mvLk,col.mvR);
      if (cmv==null){ if(_badCell[ri+":"+col.cmvCr]||_badCell[ri+":"+col.mvLk]||_badCell[ri+":"+col.mvR]) _lostMv++; continue; } // skip totals/blank rows w/o CMV (in ANY unit)`
  },
  {
    label: 'KI-145 the asset is read as its class',
    from: R`        asset: ws(gv(r,col.asset))||"Equity",`,
    to: R`        asset: _asset(gv(r,col.asset)),   /* KI-145: "EQUITY", "Fixed Income" ... read as their class */`
  },
  {
    label: 'KI-141 each row keeps the day number of its purchase date for the merge',
    from: R`        purchaseDate: fmtPD(gv(r,col.pdate)),`,
    to: R`        purchaseDate: fmtPD(gv(r,col.pdate)),
        _pd: _pdDay,   /* KI-141: its day number, for the merge below (removed there) */`
  },
  {
    label: 'KI-140 / KI-141 the first folio of a holding records its own date, days and units',
    from: R`        _seen[k]=h; _merged.push(h);`,
    to: R`        h._mem=[{pd:h._pd, pds:h.purchaseDate, days:h.days, units:h.units}];   /* KI-140, KI-141: each folio's own figures */
        _seen[k]=h; _merged.push(h);`
  },
  {
    label: 'KI-140 units are no longer summed as they come; every folio records its own',
    from: R`        if(h.units!=null) m.units=(m.units||0)+(h.units||0);`,
    to: R`        m._mem.push({pd:h._pd, pds:h.purchaseDate, days:h.days, units:h.units});   /* units, date and days: set below (KI-140, KI-141) */`
  },
  {
    label: 'KI-140 / KI-141 merged units, earliest purchase date and recomputed holding days',
    from: R`      delete h._xWt; delete h._xCmv; delete h._bWt; delete h._bCmv;
    });
    rows=_merged;`,
    to: R`      delete h._xWt; delete h._xCmv; delete h._bWt; delete h._bCmv;
      var M=h._mem; delete h._mem; delete h._pd;
      if(!M||M.length<2) return;
      /* KI-140 (KI-113 extended to units, D-035): units add up only when every folio has them. A folio
         without units leaves the merged units blank, never a partial sum, and marks the holding so that
         Taxation does not reconcile a fund priced in units on its invested value instead. */
      var withU=M.filter(function(x){ return x.units!=null; });
      if(withU.length===M.length){ var su=M[0].units; for(var i=1;i<M.length;i++) su=su+M[i].units; h.units=su; }
      else { h.units=null; if(withU.length){ h.unitsGap=true; _unitsGap++; } }
      /* KI-141 (D-041): the merged holding is dated by its EARLIEST purchase date, whatever the row order,
         and its holding days are recomputed from that date. A folio's purchase date plus its holding days
         is the date the file counts to; when every folio with holding days has a date and they count to
         the same date (within a day), the merged days run from the earliest purchase date to that date.
         Folios with no purchase date and the same holding days keep that figure. Otherwise the merged
         days are blank, never one folio's figure. */
      var dated=M.filter(function(x){ return x.pd!=null; }), e=null;
      dated.forEach(function(x){ if(!e||x.pd<e.pd) e=x; });
      if(e) h.purchaseDate=e.pds;
      var withD=M.filter(function(x){ return x.days!=null; });
      if(!withD.length){ h.days=null; return; }
      if(!e){ var same=withD.length===M.length && withD.every(function(x){ return x.days===withD[0].days; });
        h.days=same?withD[0].days:null; if(!same) _daysBlank++; return; }
      var refs=withD.filter(function(x){ return x.pd!=null; }).map(function(x){ return x.pd+x.days; });
      if(refs.length===withD.length && Math.max.apply(null,refs)-Math.min.apply(null,refs)<=1) h.days=(e.days!=null)?e.days:(refs[0]-e.pd);
      else { h.days=null; _daysBlank++; }
    });
    rows=_merged;`
  },
  {
    label: 'KI-140 / KI-141 merge counters',
    from: R`    // Finalise weighted XIRR and clean up accumulators`,
    to: R`    // Finalise weighted XIRR and clean up accumulators
    var _unitsGap=0, _daysBlank=0;`
  },
  {
    label: 'notices for the status line (KI-140 to KI-145)',
    from: R`    rows.unitHint = _unitHint;
    return rows;`,
    to: R`    rows.unitHint = _unitHint;
    /* Fix batch 4: what was read differently from the file as written, one plain sentence each, for the
       status line (warn: the analyst should look). Column headers and labels are quoted from the file. */
    var _n=[], _s=function(n,one,many){ return n===1?one:many; }, _q=function(t){ return '"'+t+'"'; };
    var _cnt=function(o){ return Object.keys(o).map(function(h){ return _q(h)+" ("+o[h]+")"; }).join(", "); };
    var _sum=function(o){ var t=0; Object.keys(o).forEach(function(h){ t+=o[h]; }); return t; };
    var _nb=_sum(_badNum), _nd=_sum(_badDate), _ar=Object.keys(_assetRead);
    if(_totalRows) _n.push({warn:true, text:_totalRows+" "+_s(_totalRows,"row","rows")+' named "Total" or "Grand Total" in the Instrument Name column '+
      _s(_totalRows,"was skipped as a total row, not read as a holding.","were skipped as total rows, not read as holdings.")});
    if(_nb) _n.push({warn:true, text:_nb+" "+_s(_nb,"cell holds","cells hold")+" text that is not a number and "+_s(_nb,"is","are")+" read as blank: "+_cnt(_badNum)+"."+
      (_lostMv?" "+_lostMv+" "+_s(_lostMv,"holding has","holdings have")+" no other market value and "+_s(_lostMv,"is","are")+" left out.":"")});
    if(_nd) _n.push({warn:true, text:_nd+" "+_s(_nd,"date","dates")+" in the "+Object.keys(_badDate).map(_q).join(", ")+" column "+_s(_nd,"does","do")+
      " not exist (such as 31-02-2024) and "+_s(_nd,"is","are")+" left blank."});
    if(_unitsGap) _n.push({warn:true, text:_unitsGap+" merged "+_s(_unitsGap,"holding has a folio","holdings have a folio")+
      " without units: the units are left blank, not a partial sum, and Taxation does not split "+_s(_unitsGap,"it","them")+"."});
    if(_daysBlank) _n.push({warn:false, text:_daysBlank+" merged "+_s(_daysBlank,"holding has folios","holdings have folios")+
      " whose holding days do not count to one date: the holding days are left blank."});
    if(_ar.length) _n.push({warn:false, text:"Asset Names read as their class: "+_ar.map(function(w){ return _q(w)+" as "+_assetRead[w]; }).join("; ")+"."});
    rows.notices = _n;
    return rows;`
  },
  {
    label: 'KI-140 Taxation: a fund with a merge gap in units is never matched on invested value',
    from: R`      var amtMode=!(baseU>0), unitBase=baseU, pxGap=false;`,
    to: R`      var amtMode=!(baseU>0)&&!h.unitsGap, unitBase=baseU, pxGap=false;   /* KI-140: blank merged units are not a product priced in rupees */`
  },
  {
    label: 'KI-140 Taxation: nor through the priceless-buy path',
    from: R`      if(!amtMode && noPxBuy[_k] && (!L.length || _drift()>0.01)){`,
    to: R`      if(!amtMode && !h.unitsGap && noPxBuy[_k] && (!L.length || _drift()>0.01)){`
  },
  {
    label: 'KI-140 Taxation: such a fund is unsplit, with its reason',
    from: R`      if(!cls){ out.unmapped.push(rec); return; }`,
    to: R`      if(!cls){ out.unmapped.push(rec); return; }
      if(h.unitsGap){ rec.reason="Units are blank: a merged folio of this holding has no units in the base file, so they cannot be checked against the transaction history. No split is shown rather than one on a partial unit count.";
                      out.unreconciled.push(rec); return; }`
  },
  {
    label: 'KI-145 IRR placement reads the IRR file\'s asset label as its class too',
    from: R`var a=(ak.length===1)?pickRow(L.a[ak[0]],Object.keys(aM)):null;`,
    to: R`var a=(ak.length===1)?pickRow(assetLabel(L.a[ak[0]])||L.a[ak[0]],Object.keys(aM)):null;   /* KI-145 */`
  },
  {
    label: 'ENGINE.assetLabel',
    from: R`    parseBaseRows:parseBaseRows, computeReview:computeReview,`,
    to: R`    parseBaseRows:parseBaseRows, assetLabel:assetLabel, computeReview:computeReview,`
  },

  /* ---------------- UI (11) ---------------- */
  {
    label: 'base-file notices helpers, before loadModel()',
    from: R`  function loadModel(){`,
    to: R`  /* Fix batch 4 (KI-140 to KI-145): the base-file reader's notices (rows skipped, cells left blank, Asset
     Names read as their class) on the status line, escaped: they quote column headers and labels */
  function baseNotes(rows){ var n=(rows&&rows.notices)||[]; if(!n.length) return '';
    return '<br><span style="color:#5C3E17">'+n.map(function(x){ return String(x.text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }).join('<br>')+'</span>'; }
  function baseNotesWarn(rows){ return ((rows&&rows.notices)||[]).some(function(x){ return x.warn; }); }
  function loadModel(){`
  },
  {
    label: 'loadModel(): the notices follow the load summary',
    from: R`' All holdings matched to reference data.'),unm>0);`,
    to: R`' All holdings matched to reference data.')+baseNotes(currentRows),unm>0||baseNotesWarn(currentRows));`
  },
  {
    label: 'KI-146 IPS actuals: every row of a class adds up, each label read as its class',
    from: R`    (model.assetAllocation.rows||[]).forEach(function(r){
      if(r.level!=='asset') return;
      var L=(r.label||'').toLowerCase();
      if(/equity/i.test(L)&&!/reit|invit/i.test(L)) eqCMV=r.cmv||0;
      else if(/^debt/i.test(L)) debtCMV=r.cmv||0;
      else if(/hybrid/i.test(L)) hybridCMV=r.cmv||0;
      else if(/reit|invit/i.test(L)) reitCMV=r.cmv||0;
      else if(/commodity|commodit|gold/i.test(L)) commodityCMV=r.cmv||0;
    });`,
    to: R`    /* KI-146: every Asset Allocation row of a class adds to its actual (only the last one used to count),
       and each label is read as its class first (ENGINE.assetLabel: "Fixed Income" is Debt) */
    (model.assetAllocation.rows||[]).forEach(function(r){
      if(r.level!=='asset') return;
      var L=String(E.assetLabel?E.assetLabel(r.label):(r.label||'')).toLowerCase(), v=r.cmv||0;
      if(/equity/i.test(L)&&!/reit|invit/i.test(L)) eqCMV+=v;
      else if(/^debt/i.test(L)) debtCMV+=v;
      else if(/hybrid/i.test(L)) hybridCMV+=v;
      else if(/reit|invit/i.test(L)) reitCMV+=v;
      else if(/commodity|commodit|gold/i.test(L)) commodityCMV+=v;
    });`
  },
  {
    label: 'KI-146 getIPSData returns the class sums',
    from: R`    return {profs:PROFS,rows:IPS_ROWS,actuals:ACTUALS,parseRange:parseIpsRangeNew,fmtActual:fmtActual,getDeviation:getDeviation};`,
    to: R`    return {profs:PROFS,rows:IPS_ROWS,actuals:ACTUALS,parseRange:parseIpsRangeNew,fmtActual:fmtActual,getDeviation:getDeviation,
      classCMV:{equity:eqCMV,debt:debtCMV,hybrid:hybridCMV,reit:reitCMV,commodity:commodityCMV}};   /* KI-146 */`
  }
]);
