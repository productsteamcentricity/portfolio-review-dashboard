/* ============================================================================
   2026-10-27 — tax batch, part T2: holding periods and lots
   (CR-0008; decision D-040; Tax Reckoner TY 2026-27, law as on 19 Oct 2026).
   Edits the reference data (TAX_RULES), the engine script (07_engine.js), the
   exporters script (08_exporters.js), the parsers script (09_parsers.js) and the
   UI script (11_app_ui.js). Applies after 2026-10-27-tax-1-classification.js.

   Fixed here (TX-nn of the tax review of 24 Oct 2026 is KI-(159+nn)):
     KI-160 (TX-01)  a lot is long term when held MORE than the row's months: from the day
                     after the anniversary of its purchase, the months added in calendar
                     months and clamped to the month end (29 Feb 2024 + 12 months = 28 Feb
                     2025), compared as calendar days (D-040 b; the clamp is for the tax
                     adviser to confirm). It was a whole-month count with ">", so a lot needed
                     13 (or 25) whole months. taxMonthsBetween is removed (no other caller).
                     "Long term after" reads "More than N months" on the tab and the slides.
     KI-161 (TX-02)  Specified (Sec. 76) treatment only for units bought on or after 1 Apr
                     2023. The Specified rows carry "specifiedFrom" and "before"; older units
                     take their own TAX_RULES row (the general rule: long term after 24 months,
                     12 for a listed ETF, LTCG 12.5%, no exemption), so the harvest pools them
                     at 12.5% and a long-term loss on them is a long-term loss. New rows "Debt
                     MF bought before 1 Apr 2023" (debt funds, target maturity funds, debt ETFs
                     and debt FoFs, which all take the debt row) and "Hybrid MF (conservative)
                     bought before 1 Apr 2023". A holding with lots on both sides becomes two
                     records that add back to its CMV and Gain/Loss and count as one holding.
                     The SIF debt row keeps no date: SIFs began in 2025. irrParseDate reads a
                     free-text date as its calendar day (it was local midnight, the day before
                     in UTC on an IST machine).
     KI-176 (TX-17)  holding periods run to the base file's valuation date (D-040 a): its own
                     "Valuation Date" column when it has one (the latest date), else the
                     portfolio date set for the review ("As on"), read strictly as "d Mon yyyy",
                     never the built-in default; with neither, the IRR sheet's latest date as
                     before, and the tab says so. IRR trades dated after that date are left out
                     of FIFO and counted; the tab and the slide say when the IRR sheet runs to a
                     different date or trades were left out.
     KI-177 (TX-18)  step 1 only: lots of shares, equity-oriented fund units and REIT or InvIT
                     units bought before 1 Feb 2018 are counted per holding and disclosed (tab,
                     class slide, harvest slide, AI Analyst tax signal): they are on actual cost,
                     the 31 Jan 2018 grandfathered cost is not applied. No price is invented.

   Rebased on fix batch 4 (CR-0008, "Rebased on fix batch 4"): the TX-17 sentence on an unreconciled
   holding with no lots anchors on the end of that reason, and the same sentence follows batch 4's
   reason for a merged folio with blank units (KI-140), which is an unreconciled holding too.

     node tools/patches/2026-10-27-tax-2-holding-period.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

/* ---------------- reference data: TAX_RULES ---------------- */
/* Sources (Tax Reckoner TY 2026-27): Mutual Funds R17 ("units bought before 1 April 2023 follow
   the general rule (24 months, 12.5%)"), R26 (row #8: "any of the above, units bought BEFORE
   1 Apr 2023", Sec 197, up to 24 months (12 if listed ETF), STCG slab, LTCG 12.5%, no exemption);
   Master Summary #16 to #18 (R25 to R27); Hybrid Funds & FoFs R7 (J7) and R24 (J24). */
const PRE_DEBT = 'Debt MF bought before 1 Apr 2023';
const PRE_HYBRID = 'Hybrid MF (conservative) bought before 1 Apr 2023';
const LAST_ROW = '{"inst":"Foreign-listed shares (held directly)","months":24,"st":{"rate":null,"label":"Slab rate","period":"≤24"},"lt":{"rate":0.125,"label":"0.125","period":">24"}}';
const NEW_ROWS =
  ',{"inst":"' + PRE_DEBT + '","months":24,"listedEtfMonths":12,"boughtBefore":"2023-04-01","st":{"rate":null,"label":"Slab rate","period":"≤24 (≤12 if listed ETF)"},"lt":{"rate":0.125,"label":"0.125","period":">24 (>12 if listed ETF)"}}' +
  ',{"inst":"' + PRE_HYBRID + '","months":24,"boughtBefore":"2023-04-01","st":{"rate":null,"label":"Slab rate","period":"≤24"},"lt":{"rate":0.125,"label":"0.125","period":">24"}}';

/* ---------------- engine (07): the bucket test and its helpers ---------------- */
const OLD_BUCKET = String.raw`  /* Whole months between two dates, the basis the rules are written on. */
  function taxMonthsBetween(from,to){
    if(!(from instanceof Date)||!(to instanceof Date)) return null;
    var m=(to.getUTCFullYear()-from.getUTCFullYear())*12+(to.getUTCMonth()-from.getUTCMonth());
    if (to.getUTCDate()<from.getUTCDate()) m--;
    return m;
  }

  /* Long-term or short-term for one lot under one rule. */
  function taxBucket(rule,mons){
    if(!rule) return null;
    if(rule.alwaysShort) return "STCG";
    if(rule.anyPeriod)   return "STCG";     /* one rate either way; reported as STCG */
    if(rule.months==null||mons==null) return null;
    return mons>rule.months ? "LTCG" : "STCG";
  }
`;
const NEW_BUCKET = String.raw`  /* TX-01 (KI-160), D-040 (b): "more than N months". A lot is long term from the day after the
     anniversary of its purchase: N calendar months added to the purchase date, clamped to the
     month end (taxAnniv), so a lot bought on 29 Feb reaches its 12-month anniversary on 28 Feb (the
     clamp is for the tax adviser to confirm). Exactly N months is still short term (Master Summary
     R3; Change Log #2). Days are compared as UTC calendar days, never as raw timestamps. */
  function taxDayNum(d){ return (d instanceof Date&&!isNaN(d))?Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()):null; }
  /* Long-term or short-term for one lot under one rule, to the date asOn. etf takes the row's
     listedEtfMonths where it has one (TX-02: a listed debt ETF bought before 1 Apr 2023). */
  function taxBucket(rule,buy,asOn,etf){
    if(!rule) return null;
    if(rule.alwaysShort) return "STCG";
    if(rule.anyPeriod)   return "STCG";     /* one rate either way; reported as STCG */
    var mo=(etf&&rule.listedEtfMonths)?rule.listedEtfMonths:rule.months, on=taxDayNum(asOn);
    if(mo==null||on==null||taxDayNum(buy)==null) return null;
    return on>taxAnniv(buy,mo) ? "LTCG" : "STCG";
  }
  /* TX-02 (KI-161): a listed ETF, for the 12-month form of the general rule (Mutual Funds R26;
     Master Summary #18). A fund of funds never is one: a Bharat Bond ETF FoF takes 24 months. */
  function taxListedEtf(h){
    var n=String(h.name||"").toLowerCase(), c=String(h.category||"").toLowerCase(), p=String(h.product||"").toLowerCase().trim();
    if (TAX_FOF_NAME.test(n) || /\b(fund of funds?|fofs?)\b/.test(c)) return false;
    return /\betf\b|bees|exchange traded/.test(n+" "+c) || /^etfs?$/.test(p);
  }
  /* TX-18 (KI-177): the classes the 31 Jan 2018 grandfathering can cover (shares, equity-oriented
     fund units and business trust units; old Sec 112A). The page holds no 31 Jan 2018 price, so a
     lot bought before 1 Feb 2018 stays on actual cost and is counted and disclosed, never stepped up. */
  var TAX_GF_CLASSES=/^(Listed Equity Shares|Equity Mutual Funds|Equity ETFs|ELSS \(3-year lock-in\)|Hybrid MF \(equity-oriented\)|Equity ETF FoF \(90\/90\)|Equity PMS|REIT Units|InvIT Units)$/;
  var TAX_GF_DAY=Date.UTC(2018,1,1);
  /* TX-17 (KI-176): calendar dates, read without a time-zone shift, as UTC midnight */
  var TAX_MONTH_IX={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  function taxYMD(y,m,d){ var x=new Date(Date.UTC(y,m,d)); return (y>1900&&x.getUTCFullYear()===y&&x.getUTCMonth()===m&&x.getUTCDate()===d)?x:null; }
  /* "d Mon yyyy", the form of the portfolio date (the date picker and the file name give it) */
  function taxParseDMY(s){
    var m=/^\s*(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?,?\s+(\d{4})\s*$/.exec(String(s==null?"":s));
    var mo=m?TAX_MONTH_IX[m[2].toLowerCase()]:null;
    return (mo==null)?null:taxYMD(+m[3],mo,+m[1]);
  }
  /* a base-file date cell: a SheetJS date (10 s before local midnight, so shifted 12 h first, as
     fmtPD does), an Excel serial, "yyyy-mm-dd", "dd-mm-yyyy" (day first) or "d Mon yyyy" */
  function taxCellDay(v){
    if(v==null||v==="") return null;
    if(v instanceof Date){ if(isNaN(v)) return null; var s=new Date(v.getTime()+43200000); return taxYMD(s.getFullYear(),s.getMonth(),s.getDate()); }
    if(typeof v==="number") return (v>0&&v<2958466)?new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000):null;
    var t=String(v).trim(), m=/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/.exec(t);
    if(m) return taxYMD(+m[1],+m[2]-1,+m[3]);
    m=/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(t);
    if(m) return taxYMD(+m[3],+m[2]-1,+m[1]);
    return taxParseDMY(t.replace(/[-\/]/g," "));
  }
  /* TX-17 (KI-176), D-040 (a): holding periods run to the base file's valuation date, the date of
     its market values and gains: the base file's own "Valuation Date" column when it has one (the
     latest date in it), else the portfolio date set for the review ("As on", printed on the slides
     as "Portfolio as on"), read strictly and never the built-in default; with neither, the IRR
     sheet's latest date, as before, and the tab says so. */
  function taxRefDate(rows, REF, asOnText){
    var irr=(REF&&REF.IRR&&REF.IRR.date instanceof Date)?REF.IRR.date:null, v=null;
    (rows||[]).forEach(function(h){ var d=h&&h.valuationDate; if(d instanceof Date&&!isNaN(d)&&(!v||d>v)) v=d; });
    var p=taxParseDMY(asOnText);
    if(v) return {date:v, source:"base", portfolio:p};
    if(p) return {date:p, source:"portfolio", portfolio:p};
    return {date:irr, source:irr?"irr":null, portfolio:null};
  }
  function taxFmtDay(d){ return d.getUTCDate()+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]+" "+d.getUTCFullYear(); }
  /* an unreconciled holding's reason, when some of its trades were left out as later than asOn */
  function taxWithLater(reason,n,asOn){
    return String(reason||"").replace(/\.?\s*$/,".")+" "+n+" IRR transaction"+(n===1?"":"s")+" for this holding dated after "+
      taxFmtDay(asOn)+", the date holding periods run to, "+(n===1?"is":"are")+" left out.";
  }
`;

/* ---------------- engine (07): the per-holding lot split ---------------- */
const OLD_LOTS_A = String.raw`      var scale=(baseU!=null&&fifoU>0)?(baseU/fifoU):1;
      var ltU=0, stU=0, unknown=0, lockU=0, oldest=null, newest=null, buckets=[];
      L.forEach(function(x){
        var u=x.u*scale, mons=taxMonthsBetween(x.d,asOn), b=taxBucket(rule,mons);
        /* TX-14: an ELSS lot inside its lock-in cannot be sold: neither long nor short term */
        if(b && taxLocked(rule,x.d,asOn)) b="LOCKED";
        if(!oldest||x.d<oldest) oldest=x.d;
        if(!newest||x.d>newest) newest=x.d;
        /* the lot's own purchase cost, in Cr: units x purchase price on the
           unit ledger; on the rupee ledger the lot IS its cost */
        var costRaw=amtMode ? (u/1e7) : (u*x.px/1e7);
        buckets.push({b:b,u:u,costRaw:costRaw});
        if(b==="LTCG"){ ltU+=u; } else if(b==="STCG"){ stU+=u; } else { unknown+=u; if(b==="LOCKED") lockU+=u; }
      });
      var totU=ltU+stU+unknown;
      var per=totU>0?(cmv/totU):0;                      /* value lots at the base file's own NAV */
`;
const NEW_LOTS_A = String.raw`      var scale=(baseU!=null&&fifoU>0)?(baseU/fifoU):1;
      /* TX-02 (KI-161): Specified (Sec. 76) treatment covers only units bought on or after the row's
         specifiedFrom date (1 Apr 2023). Older units follow the row its "before" names (the general
         rule: long term after 24 months, 12 for a listed ETF, LTCG 12.5%; Mutual Funds R17, R26;
         Master Summary #17, #18; Hybrid Funds & FoFs R7, R24). A holding with lots on both sides
         becomes two records, one per class (part 0 its own class, part 1 the older units), which
         add back to its CMV and Gain/Loss. */
      var preRule=(rule.specifiedFrom&&rule.before&&byName[rule.before])||null;
      var sfDay=preRule?taxDayNum(taxCellDay(rule.specifiedFrom)):null;
      if(sfDay==null) preRule=null;
      var etf=taxListedEtf(h), gfCls=TAX_GF_CLASSES.test(cls);
      var tl=0, ts=0, tk=0, buckets=[];
      L.forEach(function(x){
        var u=x.u*scale, part=(preRule&&taxDayNum(x.d)<sfDay)?1:0, lr=part?preRule:rule;
        var b=taxBucket(lr,x.d,asOn,etf);
        /* TX-14: an ELSS lot inside its lock-in cannot be sold: neither long nor short term */
        if(b && taxLocked(lr,x.d,asOn)) b="LOCKED";
        /* the lot's own purchase cost, in Cr: units x purchase price on the
           unit ledger; on the rupee ledger the lot IS its cost */
        var costRaw=amtMode ? (u/1e7) : (u*x.px/1e7);
        /* TX-18 (KI-177): gf marks a lot bought before 1 Feb 2018 in a class grandfathering can cover */
        buckets.push({b:b,u:u,costRaw:costRaw,d:x.d,part:part,gf:gfCls&&taxDayNum(x.d)<TAX_GF_DAY});
        if(b==="LTCG"){ tl+=u; } else if(b==="STCG"){ ts+=u; } else { tk+=u; }
      });
      var totU=tl+ts+tk;
      var per=totU>0?(cmv/totU):0;                      /* value lots at the base file's own NAV */
`;
const OLD_LOTS_B = String.raw`      var costRawTot=buckets.reduce(function(s,x){ return s+x.costRaw; },0);
      var costScale=(inv!=null&&costRawTot>0)?(inv/costRawTot):null;
      var ltG=null, stG=null, unkG=null, lockG=null;
      if(costScale!=null){
        ltG=0; stG=0; unkG=0; lockG=0;
        buckets.forEach(function(x){
          var gain=x.u*per - x.costRaw*costScale;
          if(x.b==="LTCG") ltG+=gain; else if(x.b==="STCG") stG+=gain; else { unkG+=gain; if(x.b==="LOCKED") lockG+=gain; }
        });
      }
      rec.ltUnits=ltU; rec.stUnits=stU; rec.unknownUnits=unknown;
      rec.ltCmv=ltU*per; rec.stCmv=stU*per; rec.unknownCmv=unknown*per;
      rec.ltGain=ltG; rec.stGain=stG; rec.unknownGain=unkG;
      /* TX-14: the part of an ELSS holding inside its lock-in (a part of the unknown amounts above) */
      if(rule.lockMonths){ rec.lockedUnits=lockU; rec.lockedCmv=lockU*per; rec.lockedGain=lockG; }
      rec.oldest=oldest; rec.newest=newest; rec.rule=rule;
      out.positions.push(rec);
`;
const NEW_LOTS_B = String.raw`      var costRawTot=buckets.reduce(function(s,x){ return s+x.costRaw; },0);
      var costScale=(inv!=null&&costRawTot>0)?(inv/costRawTot):null;
      var parts=[0,1].filter(function(p){ return buckets.some(function(x){ return x.part===p; }); });
      var base0={}; for(var _q in rec){ if(Object.prototype.hasOwnProperty.call(rec,_q)) base0[_q]=rec[_q]; }
      var cmvLeft=cmv, glLeft=gl, uLeft=baseU;
      parts.forEach(function(p,pi){
        var r=rec, own=buckets.filter(function(x){ return x.part===p; }), lastPart=(pi===parts.length-1), rr=p?preRule:rule;
        if(pi){ r={}; for(var _j in base0){ if(Object.prototype.hasOwnProperty.call(base0,_j)) r[_j]=base0[_j]; } r.splitPart=true; }
        var ltU=0, stU=0, unknown=0, lockU=0, oldest=null, newest=null, gfLots=0, pu=0;
        own.forEach(function(x){
          if(x.b==="LTCG"){ ltU+=x.u; } else if(x.b==="STCG"){ stU+=x.u; } else { unknown+=x.u; if(x.b==="LOCKED") lockU+=x.u; }
          if(!oldest||x.d<oldest) oldest=x.d;
          if(!newest||x.d>newest) newest=x.d;
          if(x.gf) gfLots++;
          pu+=x.u;
        });
        var ltG=null, stG=null, unkG=null, lockG=null;
        if(costScale!=null){
          ltG=0; stG=0; unkG=0; lockG=0;
          own.forEach(function(x){
            var gain=x.u*per - x.costRaw*costScale;
            if(x.b==="LTCG") ltG+=gain; else if(x.b==="STCG") stG+=gain; else { unkG+=gain; if(x.b==="LOCKED") lockG+=gain; }
          });
        }
        if(parts.length>1){
          /* TX-02: each part carries its own units, CMV and Gain/Loss; the last takes the remainder,
             so the two add back to the holding exactly. splitPart (the second) is never counted as
             another holding. */
          r.cmv=lastPart?cmvLeft:pu*per; cmvLeft-=r.cmv;
          if(gl!=null){ r.gl=(lastPart||ltG==null)?glLeft:(ltG+stG+unkG); glLeft-=r.gl; }
          if(!amtMode){ r.baseUnits=lastPart?uLeft:pu; uLeft-=r.baseUnits; r.fifoUnits=pu/scale; }
          r.lots=own.length;
        }
        r.cls=rr.inst;
        r.ltUnits=ltU; r.stUnits=stU; r.unknownUnits=unknown;
        r.ltCmv=ltU*per; r.stCmv=stU*per; r.unknownCmv=unknown*per;
        r.ltGain=ltG; r.stGain=stG; r.unknownGain=unkG;
        /* TX-14: the part of an ELSS holding inside its lock-in (a part of the unknown amounts above) */
        if(rr.lockMonths){ r.lockedUnits=lockU; r.lockedCmv=lockU*per; r.lockedGain=lockG; }
        /* TX-18: open lots bought before 1 Feb 2018, on actual cost (no 31 Jan 2018 step-up) */
        if(gfLots) r.gfLots=gfLots;
        r.oldest=oldest; r.newest=newest; r.rule=rr;
        out.positions.push(r);
      });
`;

/* ---------------- engine (07): the AI Analyst tax signal ---------------- */
const AIA_GF = [
  '    /* TX-18 (KI-177): lots bought before 1 Feb 2018 are on actual cost (no 31 Jan 2018 step-up) */',
  '    if (acc.gf){ ev.pre2018Lots = acc.gf;',
  '      bits.push("lots bought before 1 Feb 2018 are measured on actual cost, without the 31 Jan 2018 grandfathered cost, so the long-term gain and tax may be overstated"); }',
  ''
].join('\n');

/* ---------------- exporters (08): the tax slides ---------------- */
/* The exporter writes typographic quotes and dashes as JS escapes; Q and DASH are those escapes as
   text (a backslash, then u2019 or u2014), so the anchors match the page byte for byte. */
const Q = '\\' + 'u2019', DASH = '\\' + 'u2014';
const SLIDE_NOTES = String.raw`
      /* TX-17 (KI-176): where the IRR sheet ends on another date, or later trades were left out */
      var _fd=function(d){ return d.getUTCDate()+' '+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]+' '+d.getUTCFullYear(); };
      var _dt=[];
      if(T.asOnSource==='irr') _dt.push('the IRR sheet${Q}s latest date, as no valuation date was given');
      else if(T.irrThrough instanceof Date && T.asOn instanceof Date && T.irrThrough<T.asOn) _dt.push('IRR sheet to '+_fd(T.irrThrough));
      if(T.later&&T.later.n) _dt.push(T.later.n+' later IRR transaction'+(T.later.n===1?'':'s')+' left out');
      var taxDateTag=_dt.length?(' ('+_dt.join('; ')+')'):'';
      /* TX-02 (KI-161): a class of units bought before 1 Apr 2023; TX-18 (KI-177): lots before 1 Feb 2018 */
      var preSpec=T.byClass.some(function(g){ return g.rule&&g.rule.boughtBefore; });
      var gfN=T.positions.filter(function(r){ return r.gfLots>0; }).length;
`;

/* ---------------- UI (11): the Taxation tab notes ---------------- */
const TAB_NOTES = String.raw`    /* TX-17 (KI-176), D-040 (a): the date holding periods run to, and anything that differs from it */
    var taxFd=function(d){ return (d instanceof Date)?(d.getUTCDate()+' '+TAX_MON[d.getUTCMonth()]+' '+d.getUTCFullYear()):''; };
    var taxSrc=T.asOnSource==='base'?'the base file&rsquo;s valuation date':(T.asOnSource==='portfolio'?'the portfolio date of this review':(T.asOnSource==='irr'?'the IRR sheet&rsquo;s latest date':''));
    var _dn=[];
    if(T.asOnSource==='irr') _dn.push('No valuation date was found: the base file has no Valuation Date column and the portfolio date could not be read, so holding periods run to the IRR sheet&rsquo;s latest date.');
    if(T.asOnSource==='base' && T.portfolioDate instanceof Date && T.asOn instanceof Date && T.portfolioDate.getTime()!==T.asOn.getTime())
      _dn.push('The portfolio date of this review is '+taxEsc(taxFd(T.portfolioDate))+'; holding periods use the base file&rsquo;s own valuation date, '+taxEsc(asOn)+', the date of its market values and gains.');
    if(T.asOnSource!=='irr' && T.irrThrough instanceof Date && T.asOn instanceof Date && T.irrThrough<T.asOn)
      _dn.push('The IRR sheet runs only to '+taxEsc(taxFd(T.irrThrough))+', so a purchase or sale after that date is not in the lots.'+
        (T.asOnSource==='portfolio'?' If the base file is valued on '+taxEsc(taxFd(T.irrThrough))+', set the portfolio date (As on) to that date.':''));
    if(T.later && T.later.n){
      var _ln=T.later.names||[];
      _dn.push(T.later.n+' IRR transaction'+(T.later.n===1?'':'s')+' dated after '+taxEsc(asOn)+' '+(T.later.n===1?'is':'are')+' left out of the lots ('+
        taxEsc(_ln.slice(0,3).join('; '))+(_ln.length>3?' and '+(_ln.length-3)+' more':'')+'), so each holding is measured as it stood on that date.');
    }
    var dateNote=_dn.length?('<div class="taxnote">'+_dn.join(' ')+'</div>'):'';
    /* TX-02 (KI-161): the 1 Apr 2023 purchase-date rule, when the book holds a Specified class or units bought before that date */
    var specNote=T.byClass.some(function(g){ return g.rule&&(g.rule.specifiedFrom||g.rule.boughtBefore); })
      ?('<div class="taxnote">Debt fund units (including target maturity funds, debt ETFs and debt funds of funds) and conservative hybrid fund units bought on or after 1 Apr 2023 are Specified (Sec. 76): always short term, at the slab rate. '+
        'Units bought before 1 Apr 2023 follow the general rule: long term after 24 months (12 for a listed ETF), at 12.5%, with no exemption. '+
        'They are shown in their own class, so a holding bought on both sides of that date appears in two classes and is counted once.</div>'):'';
    /* TX-18 (KI-177): lots bought before 1 Feb 2018 are on actual cost; the page holds no 31 Jan 2018 price */
    var _gf=T.positions.filter(function(r){ return r.gfLots>0; });
    var gfNote=_gf.length?('<div class="taxnote">'+_gf.length+' holding'+(_gf.length===1?' has':'s have')+' lots of shares, equity-oriented fund units or REIT and InvIT units bought before 1 Feb 2018 ('+
      taxEsc(_gf.slice(0,5).map(function(r){ return r.name; }).join('; '))+(_gf.length>5?' and '+(_gf.length-5)+' more':'')+'). '+
      'Lots bought before 1 Feb 2018 are measured on actual cost; the 31 Jan 2018 grandfathered cost is not applied, so long-term gains and tax on those lots may be overstated.</div>'):'';
`;
const GF_FOOT = 'Lots bought before 1 Feb 2018 are measured on actual cost; the 31 Jan 2018 grandfathered cost is not applied, so long-term gains and tax on those lots may be overstated.';

applyPatch('Tax batch T2: holding periods and lots (CR-0008)', [
  /* ---------------- reference data ---------------- */
  {
    label: 'TAX_RULES: the debt row is Specified only from 1 Apr 2023 (TX-02)',
    from: '{"inst":"Debt Mutual Funds – Sec. 76 (old 50AA)","months":null,"alwaysShort":true,',
    to: '{"inst":"Debt Mutual Funds – Sec. 76 (old 50AA)","months":null,"alwaysShort":true,"specifiedFrom":"2023-04-01","before":"' + PRE_DEBT + '",'
  },
  {
    label: 'TAX_RULES: the conservative hybrid row is Specified only from 1 Apr 2023 (TX-02)',
    from: '{"inst":"Hybrid MF (Specified, Sec. 76)","months":null,"alwaysShort":true,',
    to: '{"inst":"Hybrid MF (Specified, Sec. 76)","months":null,"alwaysShort":true,"specifiedFrom":"2023-04-01","before":"' + PRE_HYBRID + '",'
  },
  {
    label: 'TAX_RULES: two rows for units bought before 1 Apr 2023 (TX-02)',
    from: LAST_ROW + '],"DATA_DATES":',
    to: LAST_ROW + NEW_ROWS + '],"DATA_DATES":'
  },

  /* ---------------- engine (07) ---------------- */
  {
    label: 'engine: taxBucket tests the anniversary to the day (TX-01); date and ETF helpers (TX-02, TX-17, TX-18)',
    from: OLD_BUCKET,
    to: NEW_BUCKET
  },
  {
    label: 'engine: computeTaxation records trades left out and the IRR sheet end (TX-17)',
    from: '             totals:{cmv:0,gl:0,glMissing:0,ltcgCmv:0,stcgCmv:0,unclassCmv:0,ltcgGain:0,stcgGain:0,unclassGain:0}, byClass:[], noPrice:0, txnCount:TX.length};\n',
    to: '             totals:{cmv:0,gl:0,glMissing:0,ltcgCmv:0,stcgCmv:0,unclassCmv:0,ltcgGain:0,stcgGain:0,unclassGain:0}, byClass:[], noPrice:0, txnCount:TX.length,\n' +
        '             later:{n:0,names:[]}, irrThrough:(REF.IRR&&REF.IRR.date)||null};   /* TX-17: trades after asOn left out; the IRR sheet\'s own end */\n' +
        '    var asDay=taxDayNum(asOn), laterK={};\n'
  },
  {
    label: 'engine: a trade dated after the valuation date is left out of FIFO (TX-17)',
    from: '      var px=t.price, k=K(t.client,t.instrument);\n      if(t.a==null||isNaN(t.a)) return;\n',
    to: '      var px=t.price, k=K(t.client,t.instrument);\n      if(t.a==null||isNaN(t.a)) return;\n' +
        '      /* TX-17 (KI-176), D-040 (a): a trade dated after the date holding periods run to is not part of\n' +
        '         the holding the base file values: it is left out of the lots, and counted */\n' +
        '      if(asDay!=null&&taxDayNum(t.d)!=null&&taxDayNum(t.d)>asDay){ out.later.n++; laterK[k]=(laterK[k]||0)+1; if(out.later.names.indexOf(t.instrument)<0) out.later.names.push(t.instrument); return; }\n'
  },
  {
    /* Rebased on fix batch 4 (CR-0008, "Rebased on fix batch 4"): batch 4 (KI-140, D-041) added an unreconciled
       exit for a merged folio with blank units, ahead of the no-lots one. Its reason is batch 4's; CR-0008 says an
       unreconciled holding's reason also says when some of its trades were left out, so the same TX-17 sentence
       follows it. The anchor is batch 4's own closing line, with the end of its reason. */
    label: 'engine: an unreconciled holding says when trades were left out (TX-17), merged units blank (KI-140)',
    from: ' No split is shown rather than one on a partial unit count.";\n' +
          '                      out.unreconciled.push(rec); return; }\n',
    to: ' No split is shown rather than one on a partial unit count.";\n' +
        '                      if(laterK[_k]) rec.reason=taxWithLater(rec.reason,laterK[_k],asOn);   /* TX-17 */\n' +
        '                      out.unreconciled.push(rec); return; }\n'
  },
  {
    label: 'engine: an unreconciled holding says when trades were left out (TX-17), no lots',
    /* Rebased on fix batch 4: the anchor carries the line before it, the end of the no-lots reason, since
       batch 4's blank-units exit (above) closes with a line that contains the old one-line anchor. */
    from: '                                           :"No purchase transactions in the IRR history");\n' +
          '                     out.unreconciled.push(rec); return; }\n',
    to: '                                           :"No purchase transactions in the IRR history");\n' +
        '                     if(laterK[_k]) rec.reason=taxWithLater(rec.reason,laterK[_k],asOn);   /* TX-17 */\n' +
        '                     out.unreconciled.push(rec); return; }\n'
  },
  {
    label: 'engine: an unreconciled holding says when trades were left out (TX-17), units differ',
    from: '        out.unreconciled.push(rec); return;\n      }\n      var scale=',
    to: '        if(laterK[_k]) rec.reason=taxWithLater(rec.reason,laterK[_k],asOn);   /* TX-17 */\n' +
        '        out.unreconciled.push(rec); return;\n      }\n      var scale='
  },
  {
    label: 'engine: lots bucketed by date and by the 1 Apr 2023 rule (TX-01, TX-02, TX-18)',
    from: OLD_LOTS_A,
    to: NEW_LOTS_A
  },
  {
    label: 'engine: a holding with lots on both sides of 1 Apr 2023 becomes two records (TX-02)',
    from: OLD_LOTS_B,
    to: NEW_LOTS_B
  },
  {
    label: 'engine: roll-ups count a split holding once (TX-02)',
    from: '        g.cmv+=r.cmv; g.n++;\n',
    to: '        g.cmv+=r.cmv; if(!r.splitPart) g.n++;   /* TX-02: a holding split at 1 Apr 2023 counts once */\n'
  },
  {
    label: 'engine: a split holding without an invested value is counted once (TX-02, KI-007)',
    from: '        if(r.gl!=null) t.gl+=r.gl; else t.glMissing++;\n',
    to: '        if(r.gl!=null) t.gl+=r.gl; else if(!r.splitPart) t.glMissing++;   /* TX-02: one holding, two records */\n'
  },
  {
    label: 'engine: totals carry the holding counts (TX-02)',
    from: '      var byClass=Object.keys(clsTot).map(function(k){ return clsTot[k]; })\n',
    to: '      /* holdings, not records: a holding split at 1 Apr 2023 (TX-02) is one holding */\n' +
        '      t.nPos=pos.filter(function(r){ return !r.splitPart; }).length; t.nHold=t.nPos+unrec.length+unmap.length;\n' +
        '      var byClass=Object.keys(clsTot).map(function(k){ return clsTot[k]; })\n'
  },
  {
    label: 'engine: switch-in counts skip the second part of a split holding (TX-02)',
    from: '    out.viaSwitchIn=out.positions.filter(function(p){ return p.viaSwitchIn; }).length;\n    out.viaNoPrice=out.positions.filter(function(p){ return p.pxGap; }).length;\n',
    to: '    out.viaSwitchIn=out.positions.filter(function(p){ return p.viaSwitchIn&&!p.splitPart; }).length;\n    out.viaNoPrice=out.positions.filter(function(p){ return p.pxGap&&!p.splitPart; }).length;\n'
  },
  {
    label: 'engine: base file Valuation Date column (TX-17)',
    from: '      liq:    find(function(h){return h==="liquidity"||(h.indexOf("liquid")>=0 && h.indexOf("structure")<0);})\n    };\n',
    to: '      liq:    find(function(h){return h==="liquidity"||(h.indexOf("liquid")>=0 && h.indexOf("structure")<0);}),\n' +
        '      vdate:  find(function(h){return h.indexOf("valuation")>=0 && (h.indexOf("date")>=0||h.indexOf("dt")>=0);})   /* TX-17 */\n    };\n'
  },
  {
    label: 'engine: each holding keeps the base file valuation date (TX-17)',
    from: '        days: gn(r,col.days)\n      });\n',
    to: '        days: gn(r,col.days),\n' +
        '        valuationDate: taxCellDay(gv(r,col.vdate))   /* TX-17 (KI-176): the base file\'s own valuation date, when it has the column */\n      });\n'
  },
  {
    label: 'engine: computeReview measures holding periods to the valuation date (TX-17)',
    from: '      taxation:(function(){ try{ return computeTaxation(rows,REF,(REF.IRR&&REF.IRR.date)||null); }\n',
    to: '      taxation:(function(){ try{ var _rd=taxRefDate(rows,REF,opts.asOnDate), _tx=computeTaxation(rows,REF,_rd.date);   /* TX-17, D-040 (a) */\n' +
        '                                 _tx.asOnSource=_rd.source; _tx.portfolioDate=_rd.portfolio; return _tx; }\n'
  },
  {
    label: 'engine: AI Analyst tax signal counts a split holding once',
    from: '    var acc = { ltCmv: 0, stCmv: 0, ltGain: null, stGain: null, cls: "", n: 0, lockCmv: 0 };\n',
    to: '    var acc = { ltCmv: 0, stCmv: 0, ltGain: null, stGain: null, cls: "", n: 0, lockCmv: 0, gf: 0 };\n'
  },
  {
    label: 'engine: AI Analyst tax signal, the split part and lots before 1 Feb 2018',
    from: '      if (!names[p.name]) continue;\n      acc.n++;\n',
    to: '      if (!names[p.name]) continue;\n      if (!p.splitPart) acc.n++;   /* TX-02: a holding split at 1 Apr 2023 is one holding */\n      acc.gf += (p.gfLots || 0);\n'
  },
  {
    label: 'engine: AI Analyst tax signal takes the class of the holding, not of its split part',
    from: '      if (!acc.cls) acc.cls = p.cls || "";\n',
    to: '      if (!acc.cls && !p.splitPart) acc.cls = p.cls || "";\n'
  },
  {
    label: 'engine: AI Analyst tax signal names lots before 1 Feb 2018 (TX-18)',
    from: '    /* green when a sale can be funded almost entirely from the long-term\n',
    to: AIA_GF + '    /* green when a sale can be funded almost entirely from the long-term\n'
  },

  /* ---------------- parsers (09) ---------------- */
  {
    label: 'parsers: a free-text IRR date is its calendar day at UTC midnight (TX-02)',
    from: '    var d=new Date(s); return isNaN(d)?null:d;\n  }\n  function parseIRR(sheetNames, getAOA){\n',
    to: '    /* TX-02: Date reads free text as local midnight (18:30 the day before in UTC, on an IST machine);\n' +
        '       take its local calendar day at UTC midnight, as the branches above return */\n' +
        '    var d=new Date(s); return isNaN(d)?null:new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));\n  }\n  function parseIRR(sheetNames, getAOA){\n'
  },

  /* ---------------- exporters (08) ---------------- */
  {
    label: 'tax slides: the client scope carries the valuation-date fields (TX-17)',
    from: '      var T=_cv?{hasData:true,asOn:_all.asOn,txnCount:_all.txnCount,positions:_cv.positions,\n',
    to: '      var T=_cv?{hasData:true,asOn:_all.asOn,txnCount:_all.txnCount,positions:_cv.positions,\n' +
        '                 asOnSource:_all.asOnSource,irrThrough:_all.irrThrough,later:_all.later,\n'
  },
  {
    label: 'tax slides: "Long term after" reads "More than N months" (TX-01, TX-02)',
    from: String.raw`        return '> '+r.months+' months'+(r.lockMonths?(' ('+(r.lockMonths%12?r.lockMonths+'-mo':(r.lockMonths/12)+'-yr')+' lock-in)'):''); };
`,
    to: String.raw`        return 'More than '+r.months+' months'+(r.listedEtfMonths?(' ('+r.listedEtfMonths+' if listed ETF)'):'')+(r.lockMonths?(' ('+(r.lockMonths%12?r.lockMonths+'-mo':(r.lockMonths/12)+'-yr')+' lock-in)'):''); };
`
  },
  {
    label: 'tax slides: the date, 1 Apr 2023 and 1 Feb 2018 notes (TX-17, TX-02, TX-18)',
    from: '        : model.meta.asOnDate;\n\n      var s=base("Taxation \\u2014 Long Term vs Short Term"+_scopeTag);\n',
    to: '        : model.meta.asOnDate;\n' + SLIDE_NOTES + '\n      var s=base("Taxation \\u2014 Long Term vs Short Term"+_scopeTag);\n'
  },
  {
    label: 'tax class slide footnote: the date, 1 Apr 2023 and 1 Feb 2018 notes',
    from: String.raw`      foot(s,'*Holding periods measured to '+asOn+' from each lot${Q}s own purchase date, FIFO over '+T.txnCount+
        ' transactions. LTCG + STCG add back to each holding${Q}s Gain/Loss. Rates stated as words depend on the assessee or the fund${Q}s own filing.'+
`,
    to: String.raw`      foot(s,'*Holding periods measured to '+asOn+taxDateTag+' from each lot${Q}s own purchase date, FIFO over '+T.txnCount+
        ' transactions. LTCG + STCG add back to each holding${Q}s Gain/Loss. Rates stated as words depend on the assessee or the fund${Q}s own filing.'+
        (preSpec?' Units bought before 1 Apr 2023 have their own class (general rule).':'')+
        (gfN?' Lots bought before 1 Feb 2018 are at actual cost (no 31 Jan 2018 step-up).':'')+
`
  },
  {
    label: 'tax totals slide: holdings counted once (TX-02)',
    from: '        var nHold=T.positions.length+T.unreconciled.length+T.unmapped.length;\n',
    to: '        var nHold=(t.nHold!=null)?t.nHold:(T.positions.length+T.unreconciled.length+T.unmapped.length);   /* TX-02: a split holding counts once */\n'
  },
  {
    label: 'tax holding-detail slide: the grand total counts holdings once (TX-02)',
    from: String.raw`            cell('GRAND TOTAL'+(_sc?(' ${DASH} '+_sc):'')+'  ${DASH}  '+T.positions.length+' holding'+(T.positions.length===1?'':'s'),
`,
    to: String.raw`            cell('GRAND TOTAL'+(_sc?(' ${DASH} '+_sc):'')+'  ${DASH}  '+((t.nPos!=null)?t.nPos:T.positions.length)+' holding'+(((t.nPos!=null)?t.nPos:T.positions.length)===1?'':'s'),
`
  },
  {
    label: 'tax harvest slide footer: lots before 1 Feb 2018 (TX-18)',
    from: "          '** Tax implication excludes cess & surcharge');\n",
    to: "          '** Tax implication excludes cess & surcharge'+(gfN?'   *** " + GF_FOOT + "':''));\n"
  },

  /* ---------------- UI (11): Taxation tab ---------------- */
  {
    label: 'Taxation tab: the client scope carries the valuation-date fields (TX-17)',
    from: '    return c ? {hasData:true, asOn:T.asOn, txnCount:T.txnCount, noPrice:T.noPrice,\n',
    to: '    return c ? {hasData:true, asOn:T.asOn, txnCount:T.txnCount, noPrice:T.noPrice,\n' +
        '                asOnSource:T.asOnSource, portfolioDate:T.portfolioDate, irrThrough:T.irrThrough, later:T.later,\n'
  },
  {
    label: 'Taxation tab: "Long term after" reads "More than N months" (TX-01, TX-02)',
    from: "    return '&gt; '+r.months+' months'+(r.lockMonths?('; '+(r.lockMonths%12?r.lockMonths+'-month':(r.lockMonths/12)+'-year')+' lock-in per instalment'):'');\n",
    to: "    return 'More than '+r.months+' months'+(r.listedEtfMonths?(' ('+r.listedEtfMonths+' if listed ETF)'):'')+(r.lockMonths?('; '+(r.lockMonths%12?r.lockMonths+'-month':(r.lockMonths/12)+'-year')+' lock-in per instalment'):'');\n"
  },
  {
    label: 'Taxation tab: the date, 1 Apr 2023 and 1 Feb 2018 notes (TX-17, TX-02, TX-18)',
    from: "      'The status is tested again every year, so confirm it with the AMC&rsquo;s year-end tax classification.</div>'):'';\n    var H=T.harvest||null, harvestHtml='';\n",
    to: "      'The status is tested again every year, so confirm it with the AMC&rsquo;s year-end tax classification.</div>'):'';\n" + TAB_NOTES + "    var H=T.harvest||null, harvestHtml='';\n"
  },
  {
    label: 'Taxation tab: the grand total counts holdings once (TX-02)',
    from: "        '<tbody><tr class=\"taxg\" style=\"cursor:default;\"><td>'+(T.positions.length+T.unreconciled.length+T.unmapped.length)+' holdings</td>'+\n",
    to: "        '<tbody><tr class=\"taxg\" style=\"cursor:default;\"><td>'+((t.nHold!=null)?t.nHold:(T.positions.length+T.unreconciled.length+T.unmapped.length))+' holdings</td>'+\n"
  },
  {
    label: 'Taxation tab: harvest footnote, lots before 1 Feb 2018 (TX-18)',
    from: "          '** Tax implication excludes cess &amp; surcharge'+\n        '</div>'+\n",
    to: "          '** Tax implication excludes cess &amp; surcharge'+\n          (_gf.length?'<br>*** " + GF_FOOT + "':'')+\n        '</div>'+\n"
  },
  {
    label: 'Taxation tab: the reference date named, and the anniversary rule stated (TX-17, TX-01)',
    from: "      '<div class=\"sub\">Holding periods measured to '+taxEsc(asOn)+' from each lot&rsquo;s own purchase date, using FIFO over '+T.txnCount+' transactions in the IRR sheet. '+\n",
    to: "      '<div class=\"sub\">Holding periods measured to '+taxEsc(asOn)+(taxSrc?' ('+taxSrc+')':'')+' from each lot&rsquo;s own purchase date, using FIFO over '+T.txnCount+' transactions in the IRR sheet. '+\n" +
        "        'A lot is long term when held for more than its class&rsquo;s period, that is from the day after the anniversary of its purchase date (a lot bought on 29 Feb reaches its anniversary on 28 Feb). '+\n"
  },
  {
    label: 'Taxation tab: the three notes rendered after the ELSS and usual-bucket notes',
    from: "      kpi+\n      swNote+\n      lockNote+bucketNote+\n      rollups+\n",
    to: "      kpi+\n      swNote+\n      lockNote+bucketNote+\n      dateNote+specNote+gfNote+\n      rollups+\n"
  }
]);
