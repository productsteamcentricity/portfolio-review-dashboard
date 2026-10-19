/* ============================================================================
   2026-10-19 — Current vs Sample (CVS): hybrid split and plan refresh
   (audit of 19 Oct 2026, fix batch 1b; revised after the financial-domain review)

   KI-067 (audit NEW-21)  _cvsAllocate split EVERY hybrid holding by the
           portfolio's overall equity share (equityAnalytics.exposureCr /
           totalCMV, 0.5 when that was missing). A conservative hybrid in an
           equity-heavy book was booked ~97% equity; the error fed the CVS
           columns, the expected returns, the 3/5/10-year valuations and the
           CVS slide.
           Now each hybrid is split by its OWN equity sleeve (_cvsEqShare), read
           from the same reference records the look-through analytics use
           (07_engine.js), and only where the engine looks the holding through:
             - a Fund-of-Funds (the engine's own test, /\bfofs?\b|fund of funds?/i
               on name + category, as at the top of its look-through loop) is
               never looked through; no reference record is a FoF, so any match
               it carries is another scheme's record. It is Unallocated;
             - HYBRID_ANALYTICS[hyKey].eq.weight is the equity sleeve as a share
               of the whole fund (gross equity, hedged positions included, as in
               the look-through); a missing (null) weight is unknown, not 0;
             - a hybrid record with no equity sleeve (segregated portfolios,
               pure-debt plans) is all debt, as the engine counts it;
             - a hybrid the engine matched to EQUITY_ANALYTICS instead counts the
               sum of its market-cap mix (what the engine adds to equity exposure).
           The Sample column is allocated from the post-rebalancing model
           (rbPostAnalytics: the rebalanced rows put back through computeReview),
           so a proposed fund that is not held yet is looked up by name under
           the engine's own matching rules (rule 4) and gets its own sleeve too.
           A hybrid that is not split (rule 3) is an "Unallocated †" row on
           screen and on the slide, counted in the 100%, with a footnote naming
           the holdings. Its expected return is NOT assumed (OD-29, option b):
           the row has editable Exp. Return cells (current and sample), blank by
           default. While a column's cell is blank and its Unallocated share is
           above zero, that column's Grand Total expected return, inflation-
           adjusted return and 3/5/10-year valuations (and the Sample-vs-Current
           difference) show "—". The footnote says so: "No return is assumed for
           it, so the current expected return and valuations are shown as —." On
           SCREEN it also tells the analyst what to do ("The sample's Unallocated
           share follows the rebalancing plan and cannot be typed over." and
           "Enter an expected return for the unallocated share to see the
           totals."); the SLIDE is for the client and carries neither sentence
           (_cvsUnNote(ur, slide); the snapshot's unalloc.note is the slide's).
           A deck, picked-slides or single-slide export that includes the CVS
           slide while a column's Unallocated share is above zero and its return
           is blank is not blocked; its status line warns, in the warning style:
           "The Current vs Sample slide shows — for the current [and sample]
           totals: no expected return is set for the unallocated share (Current
           vs Sample tab)." (cvsExportWarning).
           A typed return is used as typed; it is kept like the other CVS
           cells (across plan refreshes, in __cvsLive) and cleared with them on
           a family reset (resetFamilyState drops __cvsLive).
           The rounding residual no longer lands on a row when part of the
           portfolio is unallocated.
   KI-068 (audit NEW-22)  renderCVS ran only from renderAll and Re-seed, so the
           Sample column and the CVS slide ignored the rebalancing plan until
           something re-rendered the page. renderRebal now refreshes the CVS tab
           at once and rbRecalc (every keystroke in the plan) once typing pauses
           (debounced, cvsRefreshSoon); the deck and single-slide exports flush a
           pending refresh first, so window._cvsSnapshot is current when the
           slide is built. A plan-driven refresh re-seeds only the Sample
           allocations the analyst has not typed and keeps every other cell on
           screen (typed values included) — but only for the table built for the
           same model. __cvsLive and the refresh timer are per-family state,
           cleared in resetFamilyState (D-015).
           Not changed here: a full re-render (renderAll after a recompute, or
           Re-seed) still rebuilds the table from the house defaults (KI-086).

     node tools/patches/2026-10-19-cvs-hybrid-split-and-refresh.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

/* The new code blocks are written as String.raw template literals: the text lands in
   index.html verbatim (any backslash kept as written, e.g. the \b of the FoF test), and a
   template literal's line breaks are LF whatever the line endings of this file. The dagger,
   the em dash and the rupee sign are UTF-8 characters, as elsewhere in index.html. None of
   these blocks contains a backtick or a dollar-brace. */
const R = String.raw;

applyPatch('CVS hybrid split and plan refresh (KI-067, KI-068)', [
  /* ---------------- KI-068: module-level refresh helpers (UI script) ---------------- */
  {
    label: 'KI-068 CVS refresh helpers and the live-table record',
    from: '  var __cvsAction=null;\n',
    to: R`  var __cvsAction=null;
  /* KI-068: the Sample column follows the rebalancing plan. renderRebal refreshes the CVS
     tab at once; rbRecalc (every keystroke in the plan) refreshes it once typing pauses;
     a deck export flushes a pending refresh first, so the slide never shows a stale plan.
     __cvsLive is the table on screen (the model it was built for, its rows and the returns
     typed into its Unallocated row), so a plan refresh keeps every cell the analyst typed.
     Both are per-family state, cleared in resetFamilyState (D-015). */
  var __cvsLive=null, __cvsRefreshT=null;
  function cvsCancelRefresh(){ if(__cvsRefreshT!=null){ try{ clearTimeout(__cvsRefreshT); }catch(e){} __cvsRefreshT=null; } }
  function cvsRefreshFromPlan(){
    cvsCancelRefresh();
    try{ renderCVS({fromPlan:true}); }
    catch(e){ try{ console.error('[Centricity] Current vs Sample refresh failed:', e); }catch(e2){} }
  }
  function cvsRefreshSoon(){ cvsCancelRefresh(); __cvsRefreshT=setTimeout(cvsRefreshFromPlan, 250); }
  function cvsFlush(){ if(__cvsRefreshT!=null) cvsRefreshFromPlan(); }
  /* KI-067 / OD-29: the status-line warning for an export that includes the CVS slide while its
     totals are unknown: a column's Unallocated share is above zero and its expected return is
     blank, so the slide shows — for that column's totals. 'only' is what buildPPTX is given
     (undefined: the full deck; a list: the picked slides; a tab key: one slide). '' when the CVS
     slide is not exported or no return is blank. Read after cvsFlush(); never blocks the export. */
  function cvsExportWarning(only){
    if(only!=null&&(Object.prototype.toString.call(only)==='[object Array]'?only.indexOf('cvs')<0:only!=='cvs')) return '';
    var u=window._cvsSnapshot&&window._cvsSnapshot.unalloc; if(!u) return '';
    var cols=[];
    if(Number(u.ca)>0&&u.cr==null) cols.push('current');
    if(Number(u.pa)>0&&u.pr==null) cols.push('sample');
    if(!cols.length) return '';
    return 'The Current vs Sample slide shows — for the '+cols.join(' and ')+' totals: no expected return is set for the unallocated share (Current vs Sample tab).';
  }
`
  },
  {
    label: 'KI-068 renderCVS takes an option: a refresh driven by the plan',
    from: '  function renderCVS(){\n',
    to: '  function renderCVS(opts){   /* opts.fromPlan: a refresh driven by the rebalancing plan (KI-068) */\n'
  },

  /* ---------------- KI-067: each hybrid by its own sleeve ---------------- */
  {
    label: 'KI-067 _cvsEqShare: a hybrid\'s own equity share, or null when unknown (FoF, no sleeve data)',
    from: '    /* One allocator, used for the current column and again for the sample\n',
    to: R`    /* KI-067: a hybrid's OWN equity share, from the same reference records the look-through
       analytics use (07_engine.js), and only where the engine looks the holding through:
       - a Fund-of-Funds (the engine's own test, at the top of its look-through loop) is never
         looked through, and no reference record is a FoF, so any hyKey / eqKey it carries is
         another scheme's record: unknown;
       - HYBRID_ANALYTICS eq.weight is the equity sleeve as a share of the whole fund (gross
         equity, hedged positions included, as in the look-through); a missing weight is
         unknown, not 0;
       - a hybrid record with no equity sleeve (segregated portfolios, pure-debt plans) is all
         debt, as the engine counts it;
       - a hybrid the engine matched to the equity universe instead counts the sum of its
         market-cap mix, which is what the engine adds to equity exposure.
       Unknown (null): the holding is shown as Unallocated (rule 3). It used to be split at the
       portfolio's overall equity share, or 50/50. */
    function _cvsIsFoF(h){ return !!h&&/\bfofs?\b|fund of funds?/i.test((h.name||'')+' '+(h.category||'')); }
    function _cvsEqShare(h){
      if(!h||_cvsIsFoF(h)) return null;
      var HY=(activeRef&&activeRef.HYBRID_ANALYTICS)||{}, EQ=(activeRef&&activeRef.EQUITY_ANALYTICS)||{};
      var hy=h.hyKey?HY[h.hyKey]:null;
      if(hy){
        if(hy.eq){ if(hy.eq.weight==null) return null; var w=Number(hy.eq.weight); return (isFinite(w)&&w>=0&&w<=100)?w/100:null; }
        return hy.db?0:null;
      }
      var eq=h.eqKey?EQ[h.eqKey]:null;
      if(eq&&eq.mcap){
        var s=0; for(var k in eq.mcap){ if(Object.prototype.hasOwnProperty.call(eq.mcap,k)) s+=Number(eq.mcap[k])||0; }
        return (isFinite(s)&&s>0)?Math.min(1,s/100):null;
      }
      return null;
    }

    /* One allocator, used for the current column and again for the sample
`
  },
  {
    label: 'KI-067 _cvsAllocate: split by the own sleeve; unknown sleeve stays Unallocated',
    from: [
      '      (rowsArr||[]).forEach(function(h){',
      '        var cmv=h.cmvCr||0;',
      '        var b=_cvsBucket(h);',
      '        if(b){ acc[b[0]][b[1]]+=cmv; return; }',
      '        /* Hybrid — split by the actual equity sleeve weight */',
      '        var eqSlice=(model.equityAnalytics&&model.equityAnalytics.hasData&&model.totalCMV)?',
      '          (model.equityAnalytics.exposureCr/(model.totalCMV||1)):0.5;',
      '        if(!(eqSlice>=0&&eqSlice<=1)) eqSlice=0.5;',
      '        acc[1][0]+=cmv*eqSlice;     /* Equity MF sleeve */',
      '        acc[0][0]+=cmv*(1-eqSlice); /* Debt MF sleeve */',
      '      });',
      '      var flat=[];',
      '      acc.forEach(function(g,gi){ g.forEach(function(v,ri){ acc[gi][ri]=Math.round(v/tot*10000)/100; flat.push([gi,ri]); }); });',
      '      /* same residual rule as before: give rounding drift to the largest row */',
      '      var sum=0; flat.forEach(function(p){ sum+=acc[p[0]][p[1]]; });',
      '      if(sum>0 && Math.abs(sum-100)<0.5){',
      '        var big=flat[0];',
      '        flat.forEach(function(p){ if(acc[p[0]][p[1]]>acc[big[0]][big[1]]) big=p; });',
      '        acc[big[0]][big[1]]=Math.round((acc[big[0]][big[1]]+(100-sum))*100)/100;',
      '      }',
      '      return {pct:acc, total:tot};',
      ''
    ].join('\n'),
    to: R`      var unCr=0, unNames=[], unFof=false;
      (rowsArr||[]).forEach(function(h){
        var cmv=h.cmvCr||0;
        var b=_cvsBucket(h);
        if(b){ acc[b[0]][b[1]]+=cmv; return; }
        /* Hybrid. KI-067: split by the fund's OWN equity sleeve (_cvsEqShare); with no
           sleeve data, or for a Fund-of-Funds, the amount stays Unallocated rather than
           being estimated */
        var eqS=_cvsEqShare(h);
        if(eqS==null){ unCr+=cmv; if(unNames.indexOf(h.name)<0) unNames.push(h.name); if(_cvsIsFoF(h)) unFof=true; return; }
        acc[1][0]+=cmv*eqS;     /* Equity MF sleeve */
        acc[0][0]+=cmv*(1-eqS); /* Debt MF sleeve */
      });
      var flat=[];
      acc.forEach(function(g,gi){ g.forEach(function(v,ri){ acc[gi][ri]=Math.round(v/tot*10000)/100; flat.push([gi,ri]); }); });
      var unPct=Math.round(unCr/tot*10000)/100;
      /* same residual rule as before: give rounding drift to the largest row. The
         Unallocated share counts toward the 100, so it is never absorbed into a row. */
      var sum=unPct; flat.forEach(function(p){ sum+=acc[p[0]][p[1]]; });
      if(sum>0 && Math.abs(sum-100)<0.5){
        var big=flat[0];
        flat.forEach(function(p){ if(acc[p[0]][p[1]]>acc[big[0]][big[1]]) big=p; });
        acc[big[0]][big[1]]=Math.round((acc[big[0]][big[1]]+(100-sum))*100)/100;
      }
      return {pct:acc, total:tot, unPct:unPct, unCr:unCr, unNames:unNames, unFof:unFof};
`
  },
  {
    label: 'KI-067 Sample column allocated from the post-rebalancing model (engine matches proposed funds)',
    from: [
      '    var _cvsProp=null;',
      "    try{ _cvsProp=_cvsAllocate((typeof rbRebalancedHoldings==='function')?rbRebalancedHoldings():(model.holdings||[])); }",
      '    catch(e){ _cvsProp=null; }',
      ''
    ].join('\n'),
    to: R`    var _cvsProp=null;
    try{
      /* KI-067: the post-rebalancing model (rbPostAnalytics: the rebalanced rows put back
         through computeReview) carries the engine's own match for every row, so a proposed
         fund that is not held yet is looked up by name under the engine's matching rules
         and a proposed hybrid is split by its own sleeve too. Without it: the rebalanced
         rows, where a proposed hybrid has no match and stays Unallocated. */
      var _cvsPm=(typeof rbPostAnalytics==='function')?rbPostAnalytics():null;
      _cvsProp=_cvsAllocate((_cvsPm&&_cvsPm.holdings&&_cvsPm.holdings.length)?_cvsPm.holdings:
        ((typeof rbRebalancedHoldings==='function')?rbRebalancedHoldings():(model.holdings||[])));
    }
    catch(e){ _cvsProp=null; }
`
  },
  {
    label: 'KI-067 the Unallocated share of each column and its footnote',
    from: '    /* percentages and the residual rule now live in _cvsAllocate above */\n',
    to: R`    /* KI-067: what each column holds in hybrids that are not split (no sleeve data, or a
       Fund-of-Funds, which is never looked through). Shown as its own Unallocated row with a
       footnote that names them (rule 3: a blank, a footnote and a count), counted in the 100%.
       Its allocation is not editable (the Sample side is the plan's rows). Its expected return
       is the analyst's to enter, blank by default (OD-29): while a column's return is blank and
       its Unallocated share is above zero, that column's totals are unknown and show "—". */
    var _cvsUn={ca:_cvsCur.unPct||0, pa:(_cvsProp&&_cvsProp.total>0)?(_cvsProp.unPct||0):0, names:[], note:'', any:false};
    (_cvsCur.unNames||[]).concat((_cvsProp&&_cvsProp.total>0&&_cvsProp.unNames)||[]).forEach(function(n){ if(_cvsUn.names.indexOf(n)<0) _cvsUn.names.push(n); });
    _cvsUn.any=(_cvsCur.unCr>0)||!!(_cvsProp&&_cvsProp.total>0&&_cvsProp.unCr>0);
    if(_cvsUn.any){
      var _unN=_cvsUn.names.length, _unF=!!(_cvsCur.unFof||(_cvsProp&&_cvsProp.total>0&&_cvsProp.unFof));
      _cvsUn.note='† Unallocated: '+_unN+' hybrid holding'+(_unN===1?'':'s')+' ('+_cvsUn.names.slice(0,5).join('; ')+(_unN>5?'; and '+(_unN-5)+' more':'')+') '+
        (_unN===1?'has':'have')+' no equity / debt sleeve in the look-through data'+(_unF?' (Fund-of-Funds are not looked through)':'')+', so '+
        _cvsUn.ca.toFixed(2)+'% of the current portfolio and '+_cvsUn.pa.toFixed(2)+'% of the sample are not split between Equity and Debt.';
    }
    /* the return part of the footnote follows the Exp. Return cells of the Unallocated row. The
       screen note also tells the analyst what to do (the sample's share cannot be typed over;
       enter a return to see the totals). The slide note (slide=true) is read by the client and
       states only what the slide shows. */
    function _cvsUnNote(ur, slide){
      if(!_cvsUn.any) return '';
      var given=[], blank=[];
      [['current',_cvsUn.ca,ur&&ur.cr],['sample',_cvsUn.pa,ur&&ur.pr]].forEach(function(c){
        if(!(c[1]>0)) return;
        if(c[2]==null) blank.push(c[0]); else given.push(c[2].toFixed(2)+'% ('+c[0]+')');
      });
      var t=_cvsUn.note+(slide?'':' The sample\'s Unallocated share follows the rebalancing plan and cannot be typed over.');
      if(given.length) t+=' Expected return entered for it: '+given.join(', ')+'.';
      if(blank.length) t+=' No return is assumed for '+(given.length?'the '+blank[0]+' share':'it')+', so the '+blank.join(' and ')+' expected return'+(blank.length>1?'s':'')+
        ' and valuations are shown as —.'+(slide?'':' Enter an expected return for the unallocated share to see the totals.');
      return t;
    }
    /* percentages and the residual rule now live in _cvsAllocate above */
`
  },
  {
    label: 'KI-067 totals: the Unallocated share is in the 100%; its return is the typed one, or the totals are unknown',
    from: [
      '        ca+=r.currAlloc; pa+=r.propAlloc;',
      '      }); });',
      '      var infl=inflPct/100, cadjRet=(1+cr)/(1+infl)-1, padjRet=(1+pr)/(1+infl)-1;',
      '      var vals={currRet:cr,propRet:pr,currAlloc:ca,propAlloc:pa,cadjRet:cadjRet,padjRet:padjRet};',
      '      YEARS.forEach(function(y){',
      "        vals['cn'+y]=cmv*Math.pow(1+cr,y); vals['cr'+y]=cmv*Math.pow(1+cadjRet,y);",
      "        vals['pn'+y]=cmv*Math.pow(1+pr,y); vals['pr'+y]=cmv*Math.pow(1+padjRet,y);",
      "        vals['dn'+y]=vals['pn'+y]-vals['cn'+y];",
      '      });',
      '      return vals;',
      '    }',
      '',
      "    function fPct(v){ return v.toFixed(2)+'%'; }",
      "    function fCr(v){ return '₹ '+v.toFixed(1)+' Cr'; }",
      "    function fBadge(v){ var cls=v>=0?'pos':'neg'; return '<span class=\"cvs-badge '+cls+'\">'+(v>=0?'+':'')+v.toFixed(1)+' Cr</span>'; }",
      ''
    ].join('\n'),
    to: R`        ca+=r.currAlloc; pa+=r.propAlloc;
      }); });
      ca+=_cvsUn.ca; pa+=_cvsUn.pa;   /* KI-067: the Unallocated share is part of the 100% */
      /* KI-067 / OD-29: the Unallocated share earns the return typed into its row. While that
         cell is blank and the share is above zero the column's return is unknown (null): its
         Grand Total return, inflation-adjusted return and valuations show "—" (rule 3). */
      var ur=cvsUnRet||{};
      if(_cvsUn.ca>0) cr=(ur.cr==null)?null:cr+_cvsUn.ca*ur.cr/10000;
      if(_cvsUn.pa>0) pr=(ur.pr==null)?null:pr+_cvsUn.pa*ur.pr/10000;
      var infl=inflPct/100, cadjRet=(cr==null)?null:(1+cr)/(1+infl)-1, padjRet=(pr==null)?null:(1+pr)/(1+infl)-1;
      var vals={currRet:cr,propRet:pr,currAlloc:ca,propAlloc:pa,cadjRet:cadjRet,padjRet:padjRet};
      YEARS.forEach(function(y){
        vals['cn'+y]=(cr==null)?null:cmv*Math.pow(1+cr,y); vals['cr'+y]=(cr==null)?null:cmv*Math.pow(1+cadjRet,y);
        vals['pn'+y]=(pr==null)?null:cmv*Math.pow(1+pr,y); vals['pr'+y]=(pr==null)?null:cmv*Math.pow(1+padjRet,y);
        vals['dn'+y]=(cr==null||pr==null)?null:vals['pn'+y]-vals['cn'+y];
      });
      return vals;
    }

    function fPct(v){ return v.toFixed(2)+'%'; }
    function fRet(v){ return v==null?'—':fPct(v*100); }   /* KI-067: an unknown return (OD-29) is "—" */
    function fCr(v){ return v==null?'—':'₹ '+v.toFixed(1)+' Cr'; }
    function fBadge(v){ if(v==null) return '—'; var cls=v>=0?'pos':'neg'; return '<span class="cvs-badge '+cls+'">'+(v>=0?'+':'')+v.toFixed(1)+' Cr</span>'; }
`
  },
  {
    label: 'KI-067 CVS table: the Unallocated row above the Grand Total, with blank Exp. Return cells',
    from: '      /* ---- GRAND TOTAL ---- */\n',
    to: R`      /* KI-067: hybrids that are not split, outside the groups. The allocation is not
         editable; the Exp. Return cells start blank and are the analyst's to fill (OD-29). */
      if(_cvsUn.any){
        var _ur=cvsUnRet||{};
        var unFld=function(k){
          var v=_ur[k];
          return '<td style="text-align:center;padding:2px 5px">'+
            '<input type="number" class="cvs-num" data-un="'+k+'" '+
            'title="Expected return for the unallocated share. While blank, no return is assumed and the '+(k==='cr'?'current':'sample')+' totals show —" '+
            'placeholder="—" value="'+(v==null?'':v.toFixed(2))+'" step="0.25" min="0" max="100">'+
            '</td>';
        };
        h+='<tr class="lvl-asset" title="Hybrid holdings not split between Equity and Debt: no sleeve in the look-through data, or a Fund-of-Funds">'+
          '<td>Unallocated †</td>'+
          '<td style="text-align:center">'+_cvsUn.ca.toFixed(2)+'%</td>'+
          unFld('cr')+
          '<td style="text-align:center">'+_cvsUn.pa.toFixed(2)+'%</td>'+
          unFld('pr')+
          '</tr>';
      }
      /* ---- GRAND TOTAL ---- */
`
  },
  {
    label: 'KI-067 Grand Total returns: "—" while unknown',
    from: [
      "        '<td style=\"text-align:center\">'+fPct(sums.currRet*100)+'</td>'+",
      "        '<td style=\"text-align:center;color:'+paCol+'\">'+paDisp+'</td>'+",
      "        '<td style=\"text-align:center\">'+fPct(sums.propRet*100)+'</td>'+",
      ''
    ].join('\n'),
    to: [
      "        '<td style=\"text-align:center\">'+fRet(sums.currRet)+'</td>'+",
      "        '<td style=\"text-align:center;color:'+paCol+'\">'+paDisp+'</td>'+",
      "        '<td style=\"text-align:center\">'+fRet(sums.propRet)+'</td>'+",
      ''
    ].join('\n')
  },
  {
    label: 'KI-067 inflation-adjusted returns: "—" while unknown',
    from: [
      "        '<td colspan=\"2\" style=\"text-align:center\">'+fPct(sums.cadjRet*100)+'</td>'+",
      "        '<td colspan=\"2\" style=\"text-align:center\">'+fPct(sums.padjRet*100)+'</td>'+",
      ''
    ].join('\n'),
    to: [
      "        '<td colspan=\"2\" style=\"text-align:center\">'+fRet(sums.cadjRet)+'</td>'+",
      "        '<td colspan=\"2\" style=\"text-align:center\">'+fRet(sums.padjRet)+'</td>'+",
      ''
    ].join('\n')
  },
  {
    label: 'KI-067 footnote under the table; KI-068 a plan refresh keeps the cells on screen',
    from: "      h+='</tbody></table>';\n      return h;\n    }\n\n    var cvsGroups=JSON.parse(JSON.stringify(CVS_GROUPS));\n",
    to: R`      h+='</tbody></table>';
      /* KI-067: the footnote naming the Unallocated holdings (escaped: the names come from the workbook) */
      if(_cvsUn.any) h+='<p style="font-family:Cambria,serif;font-size:11px;color:#5C3E17;margin:8px 0 0;">'+rbEsc(_cvsUnNote(cvsUnRet))+'</p>';
      return h;
    }

    var cvsGroups=JSON.parse(JSON.stringify(CVS_GROUPS));
    /* KI-067 / OD-29: the expected returns typed into the Unallocated row (null = blank, the default) */
    var cvsUnRet={cr:null, pr:null};
    /* KI-068: a refresh driven by the rebalancing plan re-seeds only the Sample allocations
       the analyst has not typed; every other cell keeps what is on screen, typed values
       (the Unallocated returns too) included. Only for the table built for this same model:
       a recompute or another family starts again from the seed. */
    if(opts&&opts.fromPlan&&__cvsLive&&__cvsLive.model===model){
      cvsGroups.forEach(function(g,gi){ g.rows.forEach(function(r,ri){
        var o=__cvsLive.groups[gi]&&__cvsLive.groups[gi].rows[ri]; if(!o) return;
        r.currAlloc=o.currAlloc; r.currRet=o.currRet; r.propRet=o.propRet;
        if(window.__cvsEdited&&window.__cvsEdited[gi+'|'+ri]) r.propAlloc=o.propAlloc;
      }); });
      if(__cvsLive.unRet){ cvsUnRet.cr=__cvsLive.unRet.cr; cvsUnRet.pr=__cvsLive.unRet.pr; }
    }
    __cvsLive={model:model, groups:cvsGroups, unRet:cvsUnRet};
`
  },
  {
    label: 'KI-067 the slide snapshot carries the Unallocated share, its typed returns and the footnote',
    from: '      }),cmv:cmv,infl:infl};\n',
    to: '      }),cmv:cmv,infl:infl,\n' +
        '      /* KI-067: the slide shows the Unallocated row, its returns (null = blank) and the footnote from here;\n' +
        '         the note is the slide\'s wording (for the client: no instructions to the analyst) */\n' +
        '      unalloc:_cvsUn.any?{ca:_cvsUn.ca,pa:_cvsUn.pa,cr:cvsUnRet.cr,pr:cvsUnRet.pr,note:_cvsUnNote(cvsUnRet,true)}:null};\n'
  },
  {
    label: 'KI-067 the Unallocated Exp. Return cells: blank clears, a number is used as typed',
    from: [
      '        function sync(){',
      '          var gi=+this.dataset.g, ri=+this.dataset.r, field=this.dataset.field;',
      ''
    ].join('\n'),
    to: R`        function sync(redraw){
          /* KI-067 / OD-29: an Exp. Return cell of the Unallocated row. Blank clears it (no return
             assumed: that column's totals show "—"); a number is used as typed, like the other cells */
          if(this.dataset&&this.dataset.un){
            var uk=this.dataset.un; if(uk!=='cr'&&uk!=='pr') return;
            var us=String(this.value==null?'':this.value).trim();
            if(us==='') cvsUnRet[uk]=null;
            else { var uv=parseFloat(us); if(isNaN(uv)) return; cvsUnRet[uk]=Math.max(0,Math.round(uv*100)/100); }
            if(redraw) rebuildCVS();
            return;
          }
          var gi=+this.dataset.g, ri=+this.dataset.r, field=this.dataset.field;
`
  },
  {
    /* KI-114: every keystroke redrew the whole table, which replaced the cell being typed in, so the
       focus was lost after the first character ("12" typed slowly became 1.00). Typing now updates
       the figures only; the table is redrawn when the entry is committed. */
    label: 'KI-114 CVS cells: redraw on commit (Enter, leaving the cell, spinner), not on every keystroke',
    from: [
      '            rebuildCVS();',
      '          }',
      '        }',
      '        inp.oninput=sync;',
      '        inp.onchange=sync;',
      ''
    ].join('\n'),
    to: [
      '            if(redraw) rebuildCVS();',
      '          }',
      '        }',
      '        /* KI-114: typing updates the figures without redrawing the table (a redraw replaces the cell',
      '           and dropped the focus after the first keystroke); the table, its totals and the slide snapshot',
      '           are redrawn when the entry is committed: Enter, leaving the cell, or a spinner step ("change") */',
      '        inp.oninput=function(){ sync.call(this,false); };',
      '        inp.onchange=function(){ sync.call(this,true); };',
      ''
    ].join('\n')
  },
  {
    label: 'KI-067 the CVS note says how hybrids are split',
    from: "'Current Portfolio Alloc % is derived from base-file holdings using the same asset / product mapping as the Asset Allocation tab. '+\n",
    to: "'Current Portfolio Alloc % is derived from base-file holdings using the same asset / product mapping as the Asset Allocation tab. '+\n" +
        "        'Each hybrid fund is split between Equity and Debt Mutual Funds by its own equity sleeve in the look-through data; a hybrid with no sleeve data, or a Fund-of-Funds, is shown as Unallocated and never estimated, and its Exp. Return stays blank (totals shown as —) until you enter one. '+   /* KI-067 */\n"
  },

  /* ---------------- KI-068: the plan drives the CVS tab ---------------- */
  {
    label: 'KI-068 renderRebal refreshes the CVS tab',
    from: '    try{ renderAnalytics(); }catch(e){}\n  }\n\n  /* display helper: 2 dp for the input boxes, full precision stays in state */\n',
    to: '    try{ renderAnalytics(); }catch(e){}\n' +
        '    /* KI-068: the Current vs Sample tab (and its slide) is driven by this plan too */\n' +
        '    cvsRefreshFromPlan();\n' +
        '  }\n\n  /* display helper: 2 dp for the input boxes, full precision stays in state */\n'
  },
  {
    label: 'KI-068 rbRecalc refreshes the CVS tab once typing pauses',
    from: [
      "    var ue=document.getElementById('rb-s-un'); if(ue) ue.className='rb-sv'+(Math.abs(sum.unallocated)>1e-9?' neg':'');",
      '    rbStash(rows, boxes, sum);',
      '    try{ renderProposedPerf(); }catch(e){}',
      '    /* the post-rebalancing analytics live on the Analytics tab but are driven',
      '       by this plan, and the tab strip only scrolls — it never re-renders. */',
      '    try{ renderAnalytics(); }catch(e){}',
      '  }',
      ''
    ].join('\n'),
    to: [
      "    var ue=document.getElementById('rb-s-un'); if(ue) ue.className='rb-sv'+(Math.abs(sum.unallocated)>1e-9?' neg':'');",
      '    rbStash(rows, boxes, sum);',
      '    try{ renderProposedPerf(); }catch(e){}',
      '    /* the post-rebalancing analytics live on the Analytics tab but are driven',
      '       by this plan, and the tab strip only scrolls — it never re-renders. */',
      '    try{ renderAnalytics(); }catch(e){}',
      '    /* KI-068: so is the Current vs Sample tab; debounced, as this runs on every keystroke */',
      '    cvsRefreshSoon();',
      '  }',
      ''
    ].join('\n')
  },
  {
    label: 'KI-068 resetFamilyState drops the live CVS table (typed cells and Unallocated returns) and a pending refresh',
    from: '    taxScope=null; __cvsAction=null;\n',
    to: '    taxScope=null; __cvsAction=null; __cvsLive=null; cvsCancelRefresh();   /* KI-068: the live CVS table (typed cells, Unallocated returns) and a pending refresh */\n'
  },
  {
    label: 'KI-068 single-slide export lands a pending CVS refresh first; KI-067 notes a blank Unallocated return',
    from: "    var mdl=(tabKey==='analytics')?analyticsSrc():model;\n",
    to: "    try{ cvsFlush(); }catch(e){}   /* KI-068: a pending plan refresh of the CVS tab lands before the slide is built */\n" +
        "    var _cvsW=''; try{ _cvsW=cvsExportWarning(tabKey); }catch(e){}   /* KI-067 / OD-29: the CVS slide's totals are — */\n" +
        "    var mdl=(tabKey==='analytics')?analyticsSrc():model;\n"
  },
  {
    label: 'KI-067 single-slide export: the status line warns when the CVS slide shows — for its totals',
    from: "        triggerDownload(blob, fn); setStatus('Slide downloaded: <b>'+fn+'</b>');\n",
    to: "        triggerDownload(blob, fn);\n" +
        "        setStatus('Slide downloaded: <b>'+fn+'</b>'+(_cvsW?(' <span style=\"color:#931621\">'+_cvsW+'</span>'):''), !!_cvsW);   /* KI-067 */\n"
  },
  {
    label: 'KI-068 deck export lands a pending CVS refresh first; KI-067 notes a blank Unallocated return',
    from: "    if(!Ppt){ setStatus('PowerPoint engine not available in this browser session. Try reopening the file.',true); return; }\n",
    to: "    if(!Ppt){ setStatus('PowerPoint engine not available in this browser session. Try reopening the file.',true); return; }\n" +
        "    try{ cvsFlush(); }catch(e){}   /* KI-068: the CVS slide reads window._cvsSnapshot; land a pending plan refresh first */\n" +
        "    var _cvsW=''; try{ _cvsW=cvsExportWarning(slidePickArg()); }catch(e){}   /* KI-067 / OD-29: the CVS slide's totals are — */\n"
  },
  {
    label: 'KI-067 deck export: the status line warns when the CVS slide shows — for its totals',
    from: "        triggerDownload(blob, fn); setStatus('PowerPoint downloaded: <b>'+fn+'</b>'); done();\n",
    to: "        triggerDownload(blob, fn);\n" +
        "        setStatus('PowerPoint downloaded: <b>'+fn+'</b>'+(_cvsW?(' <span style=\"color:#931621\">'+_cvsW+'</span>'):''), !!_cvsW);   /* KI-067 */\n" +
        "        done();\n"
  },

  /* ---------------- KI-067: the CVS slide (exporters script) ---------------- */
  {
    label: 'KI-067 CVS slide: the Unallocated row; its typed return, or unknown column totals',
    from: '      /* Grand total */\n      tblRows.push([\n',
    to: R`      /* KI-067: hybrids that are not split (no sleeve data, or a Fund-of-Funds) are their own
         row, in the allocation totals. Its return is the one typed on screen (OD-29); while that
         is blank and the share is above zero, the column's return is unknown (null) and its
         Grand Total return and valuations are shown as "—" (rule 3). */
      var _un=(_snap&&_snap.unalloc)?_snap.unalloc:null;
      if(_un){
        var _uca=Number(_un.ca)||0, _upa=Number(_un.pa)||0, _ud=_upa-_uca;
        var _ucr=(_un.cr==null||!isFinite(Number(_un.cr)))?null:Number(_un.cr);
        var _upr=(_un.pr==null||!isFinite(Number(_un.pr)))?null:Number(_un.pr);
        caTot+=_uca; paTot+=_upa;
        if(_uca>0) crTot=(_ucr==null)?null:crTot+_uca*_ucr/10000;
        if(_upa>0) prTot=(_upr==null)?null:prTot+_upa*_upr/10000;
        var _uO={fill:{color:'FFF8E1'},valign:'middle',fontFace:F,fontSize:7,border:{pt:0.3,color:'D9D9D9'}};
        tblRows.push([
          {text:'Unallocated †',                         options:Object.assign({},_uO,{align:'left',bold:true})},
          {text:_uca.toFixed(2)+'%',                     options:Object.assign({},_uO,{align:'center'})},
          {text:(_ucr==null?'—':_ucr.toFixed(2)+'%'),    options:Object.assign({},_uO,{align:'center'})},
          {text:_upa.toFixed(2)+'%',                     options:Object.assign({},_uO,{align:'center'})},
          {text:(_upr==null?'—':_upr.toFixed(2)+'%'),    options:Object.assign({},_uO,{align:'center'})},
          {text:(_ud>=0?'+':'')+_ud.toFixed(2)+'%',      options:Object.assign({},_uO,{align:'center',color:_ud>0?'2a7a2a':(_ud<0?'931621':'000000')})}
        ]);
      }
      /* Grand total */
      tblRows.push([
`
  },
  {
    label: 'KI-067 CVS slide: Grand Total current return "—" while unknown',
    from: "        {text:(crTot*100).toFixed(2)+'%',options:",
    to: "        {text:(crTot==null?'—':(crTot*100).toFixed(2)+'%'),options:"
  },
  {
    label: 'KI-067 CVS slide: Grand Total sample return "—" while unknown',
    from: "        {text:(prTot*100).toFixed(2)+'%',options:",
    to: "        {text:(prTot==null?'—':(prTot*100).toFixed(2)+'%'),options:"
  },
  {
    label: 'KI-067 CVS slide: valuations "—" while the column return is unknown',
    from: [
      '        var cn=cmv*Math.pow(1+crTot,y); var pn=cmv*Math.pow(1+prTot,y); var dn=pn-cn;',
      "        var dnClr=dn>=0?'2a7a2a':'931621';",
      ''
    ].join('\n'),
    to: [
      '        /* KI-067: an unknown column return (OD-29) gives no valuation and no difference: "—" */',
      '        var cn=(crTot==null)?null:cmv*Math.pow(1+crTot,y); var pn=(prTot==null)?null:cmv*Math.pow(1+prTot,y);',
      '        var dn=(cn==null||pn==null)?null:pn-cn;',
      "        var dnClr=(dn==null)?'000000':(dn>=0?'2a7a2a':'931621');",
      ''
    ].join('\n')
  },
  {
    label: 'KI-067 CVS slide: current valuation cell',
    from: "          {text:'Rs '+cn.toFixed(0)+' Cr',",
    to: "          {text:(cn==null?'—':'Rs '+cn.toFixed(0)+' Cr'),"
  },
  {
    label: 'KI-067 CVS slide: sample valuation cell',
    from: "          {text:'Rs '+pn.toFixed(0)+' Cr',",
    to: "          {text:(pn==null?'—':'Rs '+pn.toFixed(0)+' Cr'),"
  },
  {
    label: 'KI-067 CVS slide: valuation difference cell',
    from: "          {text:(dn>=0?'+':'')+dn.toFixed(0)+' Cr',options:",
    to: "          {text:(dn==null?'—':(dn>=0?'+':'')+dn.toFixed(0)+' Cr'),options:"
  },
  {
    label: 'KI-067 CVS slide: the Unallocated footnote, right of the table',
    from: "      s.addText('Illustrative projections based on assumed returns. Not a guarantee of future performance.'",
    to: "      /* KI-067: the footnote naming the Unallocated holdings (and, while a return is blank, that the totals are shown as —;\n" +
        "         the snapshot carries the slide's wording, with no instructions to the analyst), in the free column right of the table */\n" +
        "      if(_un&&_un.note) s.addText(String(_un.note),{x:9.3,y:1.22,w:3.85,h:2.8,fontFace:F,fontSize:8,italic:true,color:'6B6B6B',align:'left',valign:'top'});\n" +
        "      s.addText('Illustrative projections based on assumed returns. Not a guarantee of future performance.'"
  }
]);
