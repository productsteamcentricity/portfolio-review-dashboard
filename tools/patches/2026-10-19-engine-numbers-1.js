/* ============================================================================
   2026-10-19 — Engine numbers, batch 1 (audit of 19 Oct 2026, CR-0005)

   KI-047  XIRR invented for flows that all fall on one date. With every flow on
           the same day the NPV is the same at every rate, so no rate of return
           exists; the bisection stopped at its bracket edge (10000%) and the
           Newton branch returned its 10% starting guess. xirr() now returns null
           when the flows span no time, and the Newton branch accepts only a
           converged root (relative step 1e-9) whose NPV is negligible relative to
           the flows. Genuine roots outside the bisection bracket are still found.
           xirr is also exposed on ENGINE so tests can call it directly.
   KI-055  Hybrid funds' underlying stocks were scaled by the equity-sleeve weight
           twice. In HYBRID_ANALYTICS a stock's weight is already a share of the
           whole fund (for all 238 hybrids, sum(stocks) = eq.weight exactly), so it
           takes st[1]/100 x CMV; the market-cap and sector mixes, which are shares
           of the sleeve, keep the x weight.
   KI-006  A blank base-file XIRR / BMXIRR counted as 0% in the client-sheet
           asset, product and grand-total rows (the CMV-weighted path used when no
           IRR aggregate exists): blanks were summed as 0 and divided by the whole
           CMV. Each average is now taken over the CMV that has a value (blank when
           none does). Rows on that path carry xcov / bcov (% of CMV with a value);
           a partial average is marked † on the Holdings tab and the holdings
           slides, and every client sheet with one carries a footnote with the
           count of holdings left out (rule 3: a blank, a footnote and a count),
           on screen, in the deck and in the workbook.
   KI-065  Corporate Bond, Dynamic Bond and gilt mutual funds (and G-Sec ETFs)
           matched the listed-bond / G-Sec tax rows, which are tested before the
           mutual-fund branch. Those rows now apply only to holdings that are not
           mutual funds. A mutual fund is a debt fund (Sec. 50AA) when its asset tag
           says Debt / Fixed Income, its category is a debt category, or its name
           marks it as a G-Sec / SDL / gilt fund; an equity : G-Sec blend named by
           its ratio (e.g. "… G-Sec 75:25") is left unclassified rather than
           guessed, because its row depends on its equity share.

     node tools/patches/2026-10-19-engine-numbers-1.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('Engine numbers batch 1 (KI-047, KI-055, KI-006, KI-065)', [
  /* ---------------- KI-047: xirr ---------------- */
  {
    label: 'KI-047 xirr: no rate for flows on a single date',
    from: '    var yrs=[],amt=[]; for(i=0;i<cfs.length;i++){ yrs.push((cfs[i].d-t0)/86400000/365); amt.push(cfs[i].a); }\n',
    to: [
      '    var yrs=[],amt=[],span=0,scale=0; for(i=0;i<cfs.length;i++){ yrs.push((cfs[i].d-t0)/86400000/365); amt.push(cfs[i].a); if(yrs[i]>span)span=yrs[i]; scale+=Math.abs(cfs[i].a); }',
      '    /* KI-047: when every flow falls on one date the NPV is the same at every rate, so no',
      '       rate of return exists. The search used to stop at its bracket edge (10000%) or at its',
      '       10% starting guess and show that as the XIRR. */',
      '    if(!(span>0)) return null;',
      ''
    ].join('\n')
  },
  {
    label: 'KI-047 xirr: the Newton branch accepts only a converged, genuine root',
    from: [
      '    if(flo*fhi>0){ var r=0.1; for(i=0;i<100;i++){ var f=npv(r),d=0,j;',
      '      for(j=0;j<amt.length;j++) d+= -yrs[j]*amt[j]/Math.pow(1+r,yrs[j]+1);',
      '      if(d===0) break; var rn=r-f/d; if(rn<=-0.9999) rn=(-0.9999+r)/2; if(Math.abs(rn-r)<1e-9){ r=rn; break; } r=rn; }',
      '      return Math.abs(npv(r))<1?r:null; }'
    ].join('\n'),
    to: [
      '    if(flo*fhi>0){ var r=0.1,conv=false; for(i=0;i<100;i++){ var f=npv(r),d=0,j;',
      '      for(j=0;j<amt.length;j++) d+= -yrs[j]*amt[j]/Math.pow(1+r,yrs[j]+1);',
      '      if(d===0) break; var rn=r-f/d; if(rn<=-0.9999) rn=(-0.9999+r)/2; if(Math.abs(rn-r)<1e-9*Math.max(1,Math.abs(r))){ r=rn; conv=true; break; } r=rn; }',
      '      /* KI-047: a zero derivative or an exhausted loop is not a root; accept only a converged',
      '         rate (relative step, so very large genuine rates still converge) whose NPV is',
      '         negligible relative to the size of the flows */',
      '      return (conv && Math.abs(npv(r))<=1e-6*scale)?r:null; }'
    ].join('\n')
  },
  {
    label: 'KI-047 expose xirr on ENGINE (for tests)',
    from: '    computeTaxation:computeTaxation, taxClassOf:taxClassOf,\n',
    to: '    computeTaxation:computeTaxation, taxClassOf:taxClassOf, xirr:xirr,\n'
  },

  /* ---------------- KI-055: hybrid stocks ---------------- */
  {
    label: 'KI-055 hybrid stocks are shares of the whole fund: scale by CMV only',
    from: '          e.stocks.forEach(function(st){ addPct(eq_stock,st[0],st[1]/100*w*Cv); eq_stock_mcap[st[0]]=st[2]; addUniq(st[0],"hyb"); });',
    to: [
      '          /* KI-055: a hybrid stock\'s weight is already a share of the WHOLE fund (sum(stocks) = eq.weight',
      '             in HYBRID_ANALYTICS), unlike mcap/sector above, which are shares of the equity sleeve */',
      '          e.stocks.forEach(function(st){ addPct(eq_stock,st[0],st[1]/100*Cv); eq_stock_mcap[st[0]]=st[2]; addUniq(st[0],"hyb"); });'
    ].join('\n')
  },

  /* ---------------- KI-006: blank XIRR in client-sheet subtotals ---------------- */
  {
    label: 'KI-006 asset accumulator tracks the CMV that has an XIRR / BMXIRR',
    from: '        var A=aM[a]||(aM[a]={inv:0,cmv:0,gl:0,wx:0,wb:0,prods:{}});',
    to: '        var A=aM[a]||(aM[a]={inv:0,cmv:0,gl:0,wx:0,wb:0,cx:0,cb:0,prods:{}});'
  },
  {
    label: 'KI-006 asset sums skip blank values',
    from: '        A.wx += (h.xirrFrac||0)*h.cmvCr; A.wb += (h.bmxirrFrac||0)*h.cmvCr;',
    to: [
      '        /* KI-006: a blank XIRR / BMXIRR is not 0%: average over the CMV that has a value */',
      '        if(h.xirrFrac!=null){ A.wx+=h.xirrFrac*h.cmvCr; A.cx+=h.cmvCr; }',
      '        if(h.bmxirrFrac!=null){ A.wb+=h.bmxirrFrac*h.cmvCr; A.cb+=h.cmvCr; }'
    ].join('\n')
  },
  {
    label: 'KI-006 product accumulator tracks the CMV that has an XIRR / BMXIRR',
    from: '        var P=A.prods[p]||(A.prods[p]={inv:0,cmv:0,gl:0,wx:0,wb:0,items:[]});',
    to: '        var P=A.prods[p]||(A.prods[p]={inv:0,cmv:0,gl:0,wx:0,wb:0,cx:0,cb:0,items:[]});'
  },
  {
    label: 'KI-006 product sums skip blank values',
    from: '        P.wx += (h.xirrFrac||0)*h.cmvCr; P.wb += (h.bmxirrFrac||0)*h.cmvCr;',
    to: [
      '        if(h.xirrFrac!=null){ P.wx+=h.xirrFrac*h.cmvCr; P.cx+=h.cmvCr; }',
      '        if(h.bmxirrFrac!=null){ P.wb+=h.bmxirrFrac*h.cmvCr; P.cb+=h.cmvCr; }'
    ].join('\n')
  },
  {
    label: 'KI-006 grand-total accumulators',
    from: '      var outRows=[]; var gx=0, gb=0;',
    to: '      var outRows=[]; var gx=0, gb=0, gcx=0, gcb=0;'
  },
  {
    label: 'KI-006 asset row: average over covered CMV; coverage only on the CMV-weighted path',
    from: '            alloc:A.cmv/ctot*100, xirr:(_va&&_va.f!=null)?_va.f*100:(A.cmv?A.wx/A.cmv*100:null), bmxirr:(_va&&_va.b!=null)?_va.b*100:(A.cmv?A.wb/A.cmv*100:null)});\n          gx+=A.wx; gb+=A.wb;',
    to: [
      '            alloc:A.cmv/ctot*100, xirr:(_va&&_va.f!=null)?_va.f*100:(A.cx?A.wx/A.cx*100:null), bmxirr:(_va&&_va.b!=null)?_va.b*100:(A.cb?A.wb/A.cb*100:null),',
      '            xcov:(_va&&_va.f!=null)?null:(A.cmv?A.cx/A.cmv*100:null), bcov:(_va&&_va.b!=null)?null:(A.cmv?A.cb/A.cmv*100:null)});',
      '          gx+=A.wx; gb+=A.wb; gcx+=A.cx; gcb+=A.cb;'
    ].join('\n')
  },
  {
    label: 'KI-006 product row: average over covered CMV; coverage only on the CMV-weighted path',
    from: '              alloc:P.cmv/ctot*100, xirr:(_vp&&_vp.f!=null)?_vp.f*100:(P.cmv?P.wx/P.cmv*100:null), bmxirr:(_vp&&_vp.b!=null)?_vp.b*100:(P.cmv?P.wb/P.cmv*100:null)});',
    to: [
      '              alloc:P.cmv/ctot*100, xirr:(_vp&&_vp.f!=null)?_vp.f*100:(P.cx?P.wx/P.cx*100:null), bmxirr:(_vp&&_vp.b!=null)?_vp.b*100:(P.cb?P.wb/P.cb*100:null),',
      '              xcov:(_vp&&_vp.f!=null)?null:(P.cmv?P.cx/P.cmv*100:null), bcov:(_vp&&_vp.b!=null)?null:(P.cmv?P.cb/P.cmv*100:null)});'
    ].join('\n')
  },
  {
    label: 'KI-006 grand total: average over covered CMV; coverage only on the CMV-weighted path',
    from: '        alloc:100, xirr:(_vg&&_vg.f!=null)?_vg.f*100:(ctot?gx/ctot*100:null), bmxirr:(_vg&&_vg.b!=null)?_vg.b*100:(ctot?gb/ctot*100:null)});',
    to: [
      '        alloc:100, xirr:(_vg&&_vg.f!=null)?_vg.f*100:(gcx?gx/gcx*100:null), bmxirr:(_vg&&_vg.b!=null)?_vg.b*100:(gcb?gb/gcb*100:null),',
      '        xcov:(_vg&&_vg.f!=null)?null:(ctot?gcx/ctot*100:null), bcov:(_vg&&_vg.b!=null)?null:(ctot?gcb/ctot*100:null)});'
    ].join('\n')
  },
  {
    label: 'KI-006 each client carries a coverage footnote when a subtotal averages only part of its CMV',
    from: '      return {name:cn, totalCMV:ctot, totalInv:C2.inv, rows:outRows};',
    to: [
      '      /* KI-006 (rule 3: a blank, a footnote and a count): name how many holdings a partial subtotal leaves out */',
      '      var _part=outRows.some(function(r){ return r.level!=="item" && ((r.xcov!=null&&r.xcov<99.995)||(r.bcov!=null&&r.bcov<99.995)); });',
      '      var covNote=null;',
      '      if(_part){',
      '        var _nx=C2.rows.filter(function(h){return h.xirrFrac==null;}).length, _nb=C2.rows.filter(function(h){return h.bmxirrFrac==null;}).length;',
      '        var _fx=function(v){ return (Math.round(v*100)/100).toFixed(2); };',
      '        covNote="\\u2020 Averages only holdings with a value: "+_nx+" without XIRR ("+_fx(ctot?gcx/ctot*100:0)+"% of CMV covered), "+_nb+" without BMXIRR ("+_fx(ctot?gcb/ctot*100:0)+"%).";',
      '      }',
      '      return {name:cn, totalCMV:ctot, totalInv:C2.inv, rows:outRows, covNote:covNote};'
    ].join('\n')
  },
  /* displays: Holdings tab (UI script) */
  {
    label: 'KI-006 Holdings tab marks a partial XIRR subtotal with †',
    from: "          if(c.key==='xirr') return '<td>'+pe(r.xirr)+'</td>';",
    to: "          if(c.key==='xirr') return '<td>'+pe(r.xirr)+((r.level!=='item'&&r.xirr!=null&&r.xcov!=null&&r.xcov<99.995)?'\\u2020':'')+'</td>';   /* KI-006 */"
  },
  {
    label: 'KI-006 Holdings tab marks a partial BMXIRR subtotal with †',
    from: "          if(c.key==='bmxirr') return '<td>'+pe(r.bmxirr)+'</td>';",
    to: "          if(c.key==='bmxirr') return '<td>'+pe(r.bmxirr)+((r.level!=='item'&&r.bmxirr!=null&&r.bcov!=null&&r.bcov<99.995)?'\\u2020':'')+'</td>';   /* KI-006 */"
  },
  {
    label: 'KI-006 Holdings tab sub-line carries the coverage footnote',
    from: "'XIRR/BMXIRR CMV-weighted.')+'</div>'+",
    to: "'XIRR/BMXIRR CMV-weighted.')+(cl.covNote?' '+cl.covNote:'')+'</div>'+   /* KI-006: engine text, numbers only */"
  },
  /* displays: holdings slides (exporters script) */
  {
    label: 'KI-006 holdings slide: the percent cell can carry a marker',
    from: 'function pc(v){ var t=num(v)?"—":(Math.round(v*100)/100).toFixed(2)+"%"; return cell(t,{align:"right",fill:{color:fill},color:(!num(v)&&v<0)?C.red:fg,bold:bold}); }',
    to: 'function pc(v,mark){ var t=num(v)?"—":(Math.round(v*100)/100).toFixed(2)+"%"+(mark||""); return cell(t,{align:"right",fill:{color:fill},color:(!num(v)&&v<0)?C.red:fg,bold:bold}); }'
  },
  {
    label: 'KI-006 holdings slide marks a partial XIRR subtotal with †',
    from: 'if(c.key==="xirr") return pc(r.xirr);',
    to: 'if(c.key==="xirr") return pc(r.xirr,(r.level!=="item"&&r.xcov!=null&&r.xcov<99.995)?"\\u2020":"");   /* KI-006 */'
  },
  {
    label: 'KI-006 holdings slide marks a partial BMXIRR subtotal with †',
    from: 'if(c.key==="bmxirr") return pc(r.bmxirr);',
    to: 'if(c.key==="bmxirr") return pc(r.bmxirr,(r.level!=="item"&&r.bcov!=null&&r.bcov<99.995)?"\\u2020":"");   /* KI-006 */'
  },
  {
    label: 'KI-006 holdings slide footer carries the coverage footnote',
    from: '"XIRR/BMXIRR are CMV-weighted.")+" Portfolio as on "+model.meta.asOnDate+".");',
    to: '"XIRR/BMXIRR are CMV-weighted.")+" Portfolio as on "+model.meta.asOnDate+"."+(cl.covNote?" "+cl.covNote:""));   /* KI-006 */'
  },
  /* displays: client sheets in the workbook (exporters script) */
  {
    label: 'KI-006 client sheet ends with the coverage footnote',
    from: '      cl.rows.forEach(function(r){ ch.push([(r.level==="item"?"   ":"")+r.label,r.dist||"",(r.level==="item"?(r.pdate||""):""),model.unit.v(r.inv),model.unit.v(r.cmv),model.unit.v(r.gl),r.alloc,r.xirr,r.bmxirr]); });',
    to: [
      '      cl.rows.forEach(function(r){ ch.push([(r.level==="item"?"   ":"")+r.label,r.dist||"",(r.level==="item"?(r.pdate||""):""),model.unit.v(r.inv),model.unit.v(r.cmv),model.unit.v(r.gl),r.alloc,r.xirr,r.bmxirr]); });',
      '      if(cl.covNote){ ch.push([]); ch.push([cl.covNote]); }   /* KI-006 */'
    ].join('\n')
  },

  /* ---------------- KI-065: debt mutual funds' tax class ---------------- */
  {
    label: 'KI-065 the G-Sec row is for holdings that are not mutual funds',
    from: '    if (/g-?sec|government securit/.test(c+n)) return "Government Securities / G-Secs";',
    to: [
      '    /* KI-065: gilt / G-Sec / bond mutual funds and ETFs are debt mutual funds (Sec. 50AA), not',
      '       directly held securities: these rows apply only when the product is not a mutual fund */',
      '    if (!/mutual fund/.test(p) && /g-?sec|government securit/.test(c+n)) return "Government Securities / G-Secs";'
    ].join('\n')
  },
  {
    label: 'KI-065 the listed-bond row is for holdings that are not mutual funds',
    from: '    if (/bond|ncd|debenture/.test(p+c)) return "Listed Bonds / NCDs";',
    to: '    if (!/mutual fund/.test(p) && /bond|ncd|debenture/.test(p+c)) return "Listed Bonds / NCDs";'
  },
  {
    label: 'KI-065 a mutual fund is a debt fund by asset tag, debt category or G-Sec name',
    from: '      if (/debt/.test(a)) return "Debt Mutual Funds – Sec. 50AA";',
    to: [
      '      /* KI-065: a debt fund by asset tag, by SEBI debt category, or by a G-Sec / SDL / gilt name, so a',
      '         mis-tagged asset (e.g. "Fixed Income", or blank, which parses as Equity) does not make it equity.',
      '         An equity : G-Sec blend named by its ratio ("… G-Sec 75:25") needs its equity share to pick a row. */',
      '      var _gsecName=/g-?sec|government securit|\\bsdl\\b|\\bgilt\\b/.test(n), _ratio=/\\b\\d{2}\\s*:\\s*\\d{2}\\b/.test(n);',
      '      if (/debt|fixed income/.test(a) || /\\bdebt\\b|bond|gilt|g-?sec|liquid|overnight|money market|duration|credit risk|banking\\s*(and|&)\\s*psu|floater|floating rate|target maturity|fixed maturity|\\bfmp\\b/.test(c) || (_gsecName && !_ratio)) return "Debt Mutual Funds – Sec. 50AA";',
      '      if (_gsecName && _ratio) return null;'
    ].join('\n')
  },
]);
