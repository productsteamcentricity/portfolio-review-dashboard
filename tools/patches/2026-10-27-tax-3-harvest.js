/* ============================================================================
   2026-10-27 — tax batch, part T3: the harvest, the AIF and PMS treatment, and
   the wording (CR-0008; decision D-040; Tax Reckoner TY 2026-27, law as on
   19 Oct 2026). Edits the reference data (TAX_RULES), the engine script
   (07_engine.js), the exporters script (08_exporters.js) and the UI script
   (11_app_ui.js). Applies after 2026-10-27-tax-2-holding-period.js.

   Fixed here (TX-nn of the tax review of 24 Oct 2026 is KI-(159+nn)):
     KI-166 (TX-07)  AIF Category III is taxed at fund level (Master Summary #25): the three
                     Cat III rows are "fundLevel" (no months, no 39% rate). Such a holding has no
                     lot ageing and no reconciliation; its CMV and Gain/Loss are reported as fund
                     level (totals.fundLevelCmv, fundLevelGain), apart from "not classified", and
                     never enter a gain pool, a loss pool or the harvest candidates (D-040 d).
     KI-167 (TX-08)  The harvest is worked out per client, on that client's records alone, and
                     the family harvest is the SUM of the clients' harvests (pools listed per
                     client), never one pooled set-off across the family (D-040 f). The tab and
                     slide say whose loss is left over; holdings with no client name are counted.
     KI-168 (TX-09)  The Rs 1.25 lakh Sec 198 exemption: the rows of listed shares, equity-oriented
                     funds and REIT and InvIT units carry "sec198"; in each client's harvest the
                     exemption (Rs 1.25 lakh less the amount the analyst enters as already used
                     this tax year, default 0) applies after set-off to the Sec 198 long-term gains
                     left (Master Summary R3, column J; Exemptions & Set-off R10); held in Cr on Lakh
                     and Cr files alike. Its own line in the pool table; the footnote names only Sec
                     198 gains. Closes KI-130.
     KI-169 (TX-10)  A PMS (row "Equity PMS", now "perSecurity") is not split into long and short
                     term: the IRR sheet holds only capital flows, while the reckoner taxes each
                     security as if held directly (Master Summary #23; OD-12; D-040 h). Its CMV and
                     Gain/Loss stay in the totals as not classified; it leaves the harvest pools and
                     candidates; the tab and slides say why.
     KI-171 (TX-12)  AIF Category I and II are pass-through (Master Summary #24): both rows are
                     "passThrough" (no months; rate label "Pass-through"); no lot ageing, no
                     investor-level figure, out of the harvest, with a note (D-040 d).
     KI-175 (TX-16)  Set-off order: losses go first to the gains taxed at the highest rate; a
                     slab-rate gain is ranked at the analyst's slab rate (default 30%, the top slab,
                     Tax Slabs & Surcharge R13) but is never given a tax figure; Sec 198 gains inside
                     the unused exemption are taxed at 0% and reached last (D-040 e). Ties are broken
                     by a fixed order, never by holding size. The text says how.
     KI-181 (TX-22)  "eight tax years, provided the return is filed by the due date" on the tab and
                     the slide (Exemptions & Set-off R13, R15, R16, R22).
     KI-182 (TX-23)  The Crypto row carries its source: no reckoner row; 30% for any holding period
                     kept as the law is unchanged (D-040 g). Shown on the tab and the class slide.
   The analyst's two assumptions (slab rate, exemption already used) are per client, on the
   Taxation tab, stated on the harvest slide; they are per-family state, cleared by
   resetFamilyState() (KI-001, D-015).

     node tools/patches/2026-10-27-tax-3-harvest.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');
/* index.html writes some characters as backslash-u escapes; these constants rebuild them, so this file holds the
   escapes as code rather than as text an editor might turn into the characters themselves */
const BS = String.fromCharCode(92), EM = BS + 'u2014', LDQ = BS + 'u201c', RDQ = BS + 'u201d', LSQ = BS + 'u2018', RSQ = BS + 'u2019', INR = BS + 'u20B9';

/* ---------------- reference data: TAX_RULES ---------------- */
/* sec198: Master Summary column J "Rs 1.25 lakh a year (shared)" (R8 shares, R10 equity funds, R11 ELSS,
   R12 equity index funds and ETFs, R13 equity ETF FoF, R18 aggressive hybrid, R38 REIT, R39 InvIT), R34 PMS
   "on equity (shared)", R37 SIF "only if equity-taxed". */
const S198 = ['Listed Equity Shares', 'Equity Mutual Funds', 'Equity ETFs', 'REIT Units', 'InvIT Units',
  'Hybrid MF (equity-oriented)', 'Equity ETF FoF (90/90)', 'SIF (equity long-short)'];
const FUND_LEVEL = '"months":null,"fundLevel":true,"st":{"rate":null,"label":"Fund-level","period":"Fund level"},"lt":{"rate":null,"label":"Fund-level","period":"Fund level"}}';
const PASS_THROUGH = '"months":null,"passThrough":true,"st":{"rate":null,"label":"Pass-through","period":"At AIF level, per asset"},"lt":{"rate":null,"label":"Pass-through","period":"At AIF level, per asset"}}';
const CRYPTO_SOURCE = 'Not in the Tax Reckoner TY 2026-27, which has no row for virtual digital assets. The 30% rate for any holding period is kept because the law is unchanged; for the owner to confirm.';

const DATA_EDITS = S198.map(inst => ({
  label: 'TAX_RULES: "' + inst + '" is a Sec 198 row (TX-09)',
  from: '{"inst":"' + inst + '","months":12,',
  to: '{"inst":"' + inst + '","months":12,"sec198":true,'
})).concat([
  {
    label: 'TAX_RULES: "ELSS (3-year lock-in)" is a Sec 198 row (TX-09)',
    from: '{"inst":"ELSS (3-year lock-in)","months":12,"lockMonths":36,',
    to: '{"inst":"ELSS (3-year lock-in)","months":12,"lockMonths":36,"sec198":true,'
  },
  {
    label: 'TAX_RULES: "Equity PMS" is taxed per security, a Sec 198 row (TX-10, TX-09)',
    from: '{"inst":"Equity PMS","months":12,',
    to: '{"inst":"Equity PMS","months":12,"sec198":true,"perSecurity":true,'
  },
  {
    label: 'TAX_RULES: "Equity AIF – Cat I/II" is pass-through (TX-12)',
    from: '{"inst":"Equity AIF – Cat I/II","months":24,"st":{"rate":null,"label":"Slab rate","period":"≤24"},"lt":{"rate":0.125,"label":"0.125","period":">24"}}',
    to: '{"inst":"Equity AIF – Cat I/II",' + PASS_THROUGH
  },
  {
    label: 'TAX_RULES: "Debt AIF – Cat I/II" is pass-through (TX-12)',
    from: '{"inst":"Debt AIF – Cat I/II","months":24,"st":{"rate":null,"label":"Slab rate","period":"≤24"},"lt":{"rate":null,"label":"Slab rate","period":">24"}}',
    to: '{"inst":"Debt AIF – Cat I/II",' + PASS_THROUGH
  },
  {
    label: 'TAX_RULES: "Equity AIF – Cat III (Listed Equity)" is fund level (TX-07)',
    from: '{"inst":"Equity AIF – Cat III (Listed Equity)","months":12,"st":{"rate":null,"label":"Fund-level","period":"≤12"},"lt":{"rate":null,"label":"Fund-level","period":">12"}}',
    to: '{"inst":"Equity AIF – Cat III (Listed Equity)",' + FUND_LEVEL
  },
  {
    label: 'TAX_RULES: "Equity AIF – Cat III (Long Short)" is fund level, the 39% rate dropped (TX-07)',
    from: '{"inst":"Equity AIF – Cat III (Long Short)","months":null,"alwaysShort":true,"st":{"rate":0.39,"label":"0.39","period":"Always treated as Short Term"},"lt":{"rate":0.39,"label":"0.39","period":"Always treated as Short Term"}}',
    to: '{"inst":"Equity AIF – Cat III (Long Short)",' + FUND_LEVEL
  },
  {
    label: 'TAX_RULES: "Debt AIF – Cat III" is fund level (TX-07)',
    from: '{"inst":"Debt AIF – Cat III","months":24,"st":{"rate":null,"label":"Fund-level","period":"≤24"},"lt":{"rate":null,"label":"Fund-level","period":">24"}}',
    to: '{"inst":"Debt AIF – Cat III",' + FUND_LEVEL
  },
  {
    label: 'TAX_RULES: the Crypto row carries its source (TX-23)',
    from: '{"inst":"Crypto","months":null,"anyPeriod":true,',
    to: '{"inst":"Crypto","months":null,"anyPeriod":true,"source":"' + CRYPTO_SOURCE + '",'
  }
]);

/* ---------------- engine (07): the per-client harvest, at engine scope ---------------- */
const ENGINE_HARVEST = String.raw`  /* =========================================================================
     TAX HARVESTING, per client (tax batch T3; CR-0008; D-040 e, f)
     TX-08 (KI-167): set-off and the exemption belong to each person's own return, so a harvest is
       worked out on one client's records alone, and the family harvest is the SUM of the clients'
       harvests, never one pooled set-off across the family (Exemptions & Set-off R10, R13-R16).
     TX-09 (KI-168, KI-130): long-term gains of the rows marked sec198 (listed shares, equity-oriented
       funds, REIT and InvIT units) are taxed at 12.5% only above Rs 1.25 lakh a year, one limit per
       person, applied AFTER losses are set off (Master Summary R3, column J; Exemptions & Set-off
       R10). The analyst enters the amount already used this tax year (default 0). The limit is held
       in Cr, the engine's unit, on Lakh and Cr files alike.
     TX-16 (KI-175): losses go first to the gains taxed at the highest rate (Exemptions & Set-off R15).
       A slab-rate gain is ranked at the analyst's slab rate (default 30%, the top slab before
       surcharge and cess, Tax Slabs & Surcharge R13) and is never given a tax figure. The Sec 198
       gains inside the unused exemption are taxed at 0%, so losses reach them last; a loss left over
       after every other gain still goes to them, as set-off comes before the exemption. At an equal
       rate the order is fixed (a slab-rate gain first, then other gains before Sec 198 gains, short
       term before long term, then by class name), never by the size of a holding.
     ========================================================================= */
  var TAX_S198_EXEMPT_RS=125000;
  var TAX_HARVEST_DEFAULTS={slabPct:30, slabMaxPct:30, usedRs:0, exemptRs:TAX_S198_EXEMPT_RS};
  /* the analyst's assumptions for one client: A.clients[client] = {slabPct, usedRs}; missing or blank = default */
  function taxAssumeFor(A, client){
    var cl=(A&&A.clients)||null, a=(cl&&Object.prototype.hasOwnProperty.call(cl,client)&&cl[client])||{};
    var s=Number(a.slabPct), u=Number(a.usedRs);
    var slab=(a.slabPct!=null&&a.slabPct!==""&&isFinite(s))?Math.min(TAX_HARVEST_DEFAULTS.slabMaxPct,Math.max(0,s)):TAX_HARVEST_DEFAULTS.slabPct;
    var used=(a.usedRs!=null&&a.usedRs!==""&&isFinite(u))?Math.min(TAX_S198_EXEMPT_RS,Math.max(0,u)):TAX_HARVEST_DEFAULTS.usedRs;
    return {slabPct:slab, usedRs:used, exemptRs:TAX_S198_EXEMPT_RS,
            slabDefault:slab===TAX_HARVEST_DEFAULTS.slabPct, usedDefault:used===TAX_HARVEST_DEFAULTS.usedRs};
  }
  /* one client's harvest, from that client's classes and records */
  function taxBuildHarvest(byClass, positions, client, A){
    var as=taxAssumeFor(A,client), slab=as.slabPct/100;
    var exAvail=Math.max(0,as.exemptRs-as.usedRs)/1e7;
    var pools=[], ltLoss=0, stLoss=0;
    (byClass||[]).forEach(function(g){
      /* a class with no investor-level split (g.notSplit: TX-07, TX-10, TX-12) has no gain or loss
         here: summarise never pools its records */
      var lt=(g.rule&&g.rule.lt)||{}, st=(g.rule&&g.rule.st)||{};
      var lr=(lt.rate!=null)?lt.rate:null, sr=(st.rate!=null)?st.rate:null;
      if(g.ltPos>1e-9) pools.push({b:'LT',cls:g.cls,client:client,gross:g.ltPos,left:g.ltPos,rate:lr,label:lt.label||'',s198:!!(g.rule&&g.rule.sec198)});
      if(g.stPos>1e-9) pools.push({b:'ST',cls:g.cls,client:client,gross:g.stPos,left:g.stPos,rate:sr,label:st.label||'',s198:false});
      ltLoss+=g.ltNeg; stLoss+=g.stNeg;
    });
    var byCls=function(a,b){ return a.cls<b.cls?-1:(a.cls>b.cls?1:0); };
    var s198=pools.filter(function(p){ return p.b==='LT'&&p.s198; }).sort(byCls);
    var G=s198.reduce(function(s,p){ return s+p.gross; },0);
    var er=s198.reduce(function(m,p){ return Math.max(m,p.rate||0); },0);   /* 12.5% on every Sec 198 row */
    var band=Math.min(G,exAvail);
    /* slots: each pool at its rank; the Sec 198 long-term pools as two slots, the part above the
       exemption at its rate and the part inside it at 0% */
    var slots=[];
    pools.forEach(function(p){ if(!(p.b==='LT'&&p.s198)) slots.push({b:p.b,rank:(p.rate!=null?p.rate:slab),slab:p.rate==null,s198:false,key:p.cls,pools:[p],amt:p.gross}); });
    if(s198.length){
      slots.push({b:'LT',rank:er,slab:false,s198:true,key:'',pools:s198,amt:G-band});
      slots.push({b:'LT',rank:0,slab:false,s198:true,key:'',pools:s198,amt:band});
    }
    var order=function(a,b){
      if(b.rank!==a.rank) return b.rank-a.rank;
      if(a.slab!==b.slab) return a.slab?-1:1;
      if(a.s198!==b.s198) return a.s198?1:-1;
      if(a.b!==b.b) return a.b==='ST'?-1:1;
      return a.key<b.key?-1:(a.key>b.key?1:0);
    };
    function spend(amount, eligible){
      var rest=amount;
      eligible.sort(order).forEach(function(sl){
        if(rest<=1e-12||sl.amt<=1e-12) return;
        var take=Math.min(sl.amt,rest), r=take; sl.amt-=take; rest-=take;
        sl.pools.forEach(function(p){ if(r<=0) return; var q=Math.min(p.left,r); p.left-=q; r-=q; });
      });
      return amount-rest;
    }
    var usedLt=spend(ltLoss,slots.filter(function(sl){ return sl.b==='LT'; }));   /* LT loss -> LT gains only (Sec 108, 111) */
    var usedSt=spend(stLoss,slots);                                              /* ST loss -> either head */
    var taxOf=function(key){ return pools.reduce(function(s,p){ return s+((p.rate!=null)?p[key]*p.rate:0); },0); };
    var R=s198.reduce(function(s,p){ return s+p.left; },0);
    var exB=Math.min(G,exAvail), exA=Math.min(R,exAvail);
    var before=taxOf('gross')-exB*er, after=taxOf('left')-exA*er;
    var slabP=pools.filter(function(p){ return p.rate==null; });
    return {
      client:client, assume:as, exAvail:exAvail, exRate:er,
      s198Gains:G, s198Left:R, exBefore:exB, exAfter:exA, exBeforeTax:exB*er, exAfterTax:exA*er,
      ltGains:pools.filter(function(p){return p.b==='LT';}).reduce(function(s,p){return s+p.gross;},0),
      stGains:pools.filter(function(p){return p.b==='ST';}).reduce(function(s,p){return s+p.gross;},0),
      ltLosses:ltLoss, stLosses:stLoss, ltUsed:usedLt, stUsed:usedSt,
      ltUnused:ltLoss-usedLt, stUnused:stLoss-usedSt,
      taxBefore:before, taxAfter:after, saving:before-after, pools:pools,
      unquantifiedPools:slabP.length,
      unquantifiedGain:slabP.reduce(function(s,p){return s+p.gross;},0),
      slabSheltered:slabP.reduce(function(s,p){return s+(p.gross-p.left);},0),
      candidates:(positions||[]).filter(function(r){
          return !r.notSplit && ((r.ltGain!=null&&r.ltGain<0)||(r.stGain!=null&&r.stGain<0)); })
        .map(function(r){ return {name:r.name, client:r.client, cls:r.cls, cmv:r.cmv,
          ltLoss:(r.ltGain!=null&&r.ltGain<0)?-r.ltGain:0,
          stLoss:(r.stGain!=null&&r.stGain<0)?-r.stGain:0 }; })
        .sort(function(a,b){ return (b.ltLoss+b.stLoss)-(a.ltLoss+a.stLoss); })
    };
  }
  /* the family harvest: the clients' harvests added up, field by field; pools and candidates listed per client */
  var TAX_HARVEST_SUM=['taxBefore','taxAfter','saving','ltGains','stGains','ltLosses','stLosses','ltUsed','stUsed','ltUnused','stUnused',
    'unquantifiedPools','unquantifiedGain','slabSheltered','s198Gains','s198Left','exBefore','exAfter','exBeforeTax','exAfterTax'];
  function taxSumHarvests(list){
    var H={perClient:true, byClient:list, pools:[], candidates:[], exRate:0};
    TAX_HARVEST_SUM.forEach(function(k){ H[k]=0; });
    list.forEach(function(h){
      TAX_HARVEST_SUM.forEach(function(k){ H[k]+=(h[k]||0); });
      H.pools=H.pools.concat(h.pools); H.candidates=H.candidates.concat(h.candidates);
      H.exRate=Math.max(H.exRate,h.exRate||0);
    });
    H.candidates.sort(function(a,b){ return (b.ltLoss+b.stLoss)-(a.ltLoss+a.stLoss); });
    return H;
  }
  /* (re)build every client's harvest and the family sum on a computed taxation T, with the
     analyst's assumptions A; the Taxation tab calls it again when an assumption changes */
  function taxApplyAssumptions(T, A){
    if(!T||!T.clients) return T;
    T.taxAssume=A||null;
    T.harvest=taxSumHarvests(T.clients.map(function(c){ return (c.harvest=taxBuildHarvest(c.byClass,c.positions,c.client,A)); }));
    return T;
  }
  /* TX-07, TX-10, TX-12 (D-040 d, h): a holding with no investor-level long- or short-term split.
     kind: "fundLevel" (Category III AIF: CMV and Gain/Loss reported as fund level), "passThrough"
     (Category I and II AIF) or "pms" (both kept as not classified). Lots are for information only. */
  function taxNotSplit(rec, rule, L, kind, cmv, gl){
    var oldest=null, newest=null, fl=(kind==="fundLevel");
    (L||[]).forEach(function(x){ if(!oldest||x.d<oldest) oldest=x.d; if(!newest||x.d>newest) newest=x.d; });
    rec.notSplit=kind; if(fl) rec.fundLevel=true;
    rec.ltUnits=null; rec.stUnits=null; rec.unknownUnits=null;
    rec.ltCmv=0; rec.stCmv=0; rec.unknownCmv=fl?0:cmv;
    rec.ltGain=null; rec.stGain=null; rec.unknownGain=fl?null:gl;
    rec.oldest=oldest; rec.newest=newest; rec.rule=rule;
    return rec;
  }

  function computeTaxation(rows, REF, asOn, assume){
    var RULES=(REF.TAX_RULES||[]), byName={};
`;

/* the old nested harvest, summariser and client views of computeTaxation (07_engine.js:694-805, T2 build) */
const OLD_SUMMARY = String.raw`    function taxRollup(list, keyOf, labelOf){
      var m={}, order=[];
      list.forEach(function(r){
        var k=keyOf(r); if(k==null||k==='') k='(unspecified)';
        if(!m[k]){ m[k]={key:k, label:labelOf?labelOf(r,k):k, cmv:0, gl:0, ltCmv:0, stCmv:0,
                          ltGain:0, stGain:0, unclassGain:0, n:0}; order.push(k); }
        var g=m[k];
        g.cmv+=r.cmv; if(!r.splitPart) g.n++;   /* TX-02: a holding split at 1 Apr 2023 counts once */
        if(r.gl!=null) g.gl+=r.gl;
        g.ltCmv+=(r.ltCmv||0); g.stCmv+=(r.stCmv||0);
        if(r.ltGain!=null){ g.ltGain+=r.ltGain; g.stGain+=r.stGain; g.unclassGain+=(r.unknownGain||0); }
        else if(r.gl!=null){ g.unclassGain+=r.gl; }
      });
      return order.map(function(k){ return m[k]; }).sort(function(a,b){ return b.cmv-a.cmv; });
    }

    function buildHarvest(byClass, positions){
      var pools=[], ltLoss=0, stLoss=0;
      byClass.forEach(function(g){
        var lr=(g.rule&&g.rule.lt&&g.rule.lt.rate!=null)?g.rule.lt.rate:null;
        var sr=(g.rule&&g.rule.st&&g.rule.st.rate!=null)?g.rule.st.rate:null;
        if(g.ltPos>1e-9) pools.push({b:'LT',cls:g.cls,gross:g.ltPos,left:g.ltPos,rate:lr,label:(g.rule&&g.rule.lt)?g.rule.lt.label:''});
        if(g.stPos>1e-9) pools.push({b:'ST',cls:g.cls,gross:g.stPos,left:g.stPos,rate:sr,label:(g.rule&&g.rule.st)?g.rule.st.label:''});
        ltLoss+=g.ltNeg; stLoss+=g.stNeg;
      });
      var rank=function(a,b){ return (b.rate==null?-1:b.rate)-(a.rate==null?-1:a.rate); };
      function spend(amount,eligible){
        var pool=amount;
        eligible.slice().sort(rank).forEach(function(p){
          if(pool<=1e-9) return;
          var take=Math.min(p.left,pool); p.left-=take; pool-=take;
        });
        return amount-pool;
      }
      var usedLt=spend(ltLoss,pools.filter(function(p){ return p.b==='LT'; }));   /* LT loss -> LT gains only */
      var usedSt=spend(stLoss,pools);                                            /* ST loss -> either head */
      var taxOf=function(key){ return pools.reduce(function(s,p){ return s+((p.rate!=null)?p[key]*p.rate:0); },0); };
      var before=taxOf('gross'), after=taxOf('left');
      var unquant=pools.filter(function(p){ return p.rate==null; });
      return {
        ltGains:pools.filter(function(p){return p.b==='LT';}).reduce(function(s,p){return s+p.gross;},0),
        stGains:pools.filter(function(p){return p.b==='ST';}).reduce(function(s,p){return s+p.gross;},0),
        ltLosses:ltLoss, stLosses:stLoss, ltUsed:usedLt, stUsed:usedSt,
        ltUnused:ltLoss-usedLt, stUnused:stLoss-usedSt,
        taxBefore:before, taxAfter:after, saving:before-after, pools:pools,
        unquantifiedPools:unquant.length,
        unquantifiedGain:unquant.reduce(function(s,p){return s+p.gross;},0),
        candidates:positions.filter(function(r){
            return (r.ltGain!=null&&r.ltGain<0)||(r.stGain!=null&&r.stGain<0); })
          .map(function(r){ return {name:r.name, client:r.client, cls:r.cls, cmv:r.cmv,
            ltLoss:(r.ltGain!=null&&r.ltGain<0)?-r.ltGain:0,
            stLoss:(r.stGain!=null&&r.stGain<0)?-r.stGain:0 }; })
          .sort(function(a,b){ return (b.ltLoss+b.stLoss)-(a.ltLoss+a.stLoss); })
      };
    }

    function summarise(pos, unrec, unmap){
      var t={cmv:0,gl:0,glMissing:0,ltcgCmv:0,stcgCmv:0,unclassCmv:0,ltcgGain:0,stcgGain:0,unclassGain:0,lockedCmv:0,lockedGain:0,lockedN:0};
      var clsTot={};
      pos.forEach(function(r){
        t.cmv+=r.cmv;
        if(r.gl!=null) t.gl+=r.gl; else if(!r.splitPart) t.glMissing++;   /* TX-02: one holding, two records */
        t.ltcgCmv+=(r.ltCmv||0); t.stcgCmv+=(r.stCmv||0); t.unclassCmv+=(r.unknownCmv||0);
        if(r.lockedCmv>0){ t.lockedCmv+=r.lockedCmv; t.lockedN++; if(r.lockedGain!=null) t.lockedGain+=r.lockedGain; }   /* TX-14 */
        if(r.ltGain!=null){ t.ltcgGain+=r.ltGain; t.stcgGain+=r.stGain; t.unclassGain+=(r.unknownGain||0); }
        else if(r.gl!=null){ t.unclassGain+=r.gl; }
        var g=clsTot[r.cls]||(clsTot[r.cls]={cls:r.cls,rule:r.rule,cmv:0,ltCmv:0,stCmv:0,gl:0,
                                             ltGain:0,stGain:0,n:0,ltPos:0,ltNeg:0,stPos:0,stNeg:0});
        g.cmv+=r.cmv; g.ltCmv+=(r.ltCmv||0); g.stCmv+=(r.stCmv||0); g.n++;
        if(r.gl!=null) g.gl+=r.gl;
        if(r.ltGain!=null){ g.ltGain+=r.ltGain; g.stGain+=r.stGain;
          /* pooled at position level: a loss-making holding is a harvest
             candidate even inside a class that nets positive */
          if(r.ltGain>0) g.ltPos+=r.ltGain; else g.ltNeg+=-r.ltGain;
          if(r.stGain>0) g.stPos+=r.stGain; else g.stNeg+=-r.stGain; }
      });
      /* unreconciled and unmapped hold real money — they count toward CMV and
         Gain/Loss, and all of it sits in the unclassified bucket */
      unrec.concat(unmap).forEach(function(r){
        t.cmv+=r.cmv; t.unclassCmv+=r.cmv;
        if(r.gl!=null){ t.gl+=r.gl; t.unclassGain+=r.gl; } else t.glMissing++;
      });
      /* holdings, not records: a holding split at 1 Apr 2023 (TX-02) is one holding */
      t.nPos=pos.filter(function(r){ return !r.splitPart; }).length; t.nHold=t.nPos+unrec.length+unmap.length;
      var byClass=Object.keys(clsTot).map(function(k){ return clsTot[k]; })
        .sort(function(a,b){ return b.cmv-a.cmv; });
      var all=pos.concat(unrec,unmap);
      return {
        totals:t, byClass:byClass,
        byProduct:taxRollup(all,function(r){ return r.product||r.pcls||''; }),
        byAsset:  taxRollup(all,function(r){ return r.asset||''; }),
        harvest:  buildHarvest(byClass,pos)
      };
    }

    var _fam=summarise(out.positions,out.unreconciled,out.unmapped);
    out.totals=_fam.totals; out.byClass=_fam.byClass;
    out.byProduct=_fam.byProduct; out.byAsset=_fam.byAsset; out.harvest=_fam.harvest;

    /* per-client views: the same summariser over each client's own records, so
       the client figures add back to the family figures by construction */
    var _order=[], _seen={};
    out.positions.concat(out.unreconciled,out.unmapped).forEach(function(r){
      var c=r.client||'(unnamed)'; if(!_seen[c]){ _seen[c]=1; _order.push(c); }
    });
    var _pick=function(arr,c){ return arr.filter(function(r){ return (r.client||'(unnamed)')===c; }); };
    out.clients=_order.map(function(c){
      var p=_pick(out.positions,c), u=_pick(out.unreconciled,c), m=_pick(out.unmapped,c);
      var s=summarise(p,u,m);
      return {client:c, positions:p, unreconciled:u, unmapped:m,
              totals:s.totals, byClass:s.byClass, byProduct:s.byProduct, byAsset:s.byAsset, harvest:s.harvest};
    }).sort(function(a,b){ return b.totals.cmv-a.totals.cmv; });
`;

const NEW_SUMMARY = String.raw`    function taxRollup(list, keyOf, labelOf){
      var m={}, order=[];
      list.forEach(function(r){
        var k=keyOf(r); if(k==null||k==='') k='(unspecified)';
        if(!m[k]){ m[k]={key:k, label:labelOf?labelOf(r,k):k, cmv:0, gl:0, ltCmv:0, stCmv:0,
                          ltGain:0, stGain:0, unclassGain:0, fundGain:0, n:0}; order.push(k); }
        var g=m[k];
        g.cmv+=r.cmv; if(!r.splitPart) g.n++;   /* TX-02: a holding split at 1 Apr 2023 counts once */
        if(r.gl!=null) g.gl+=r.gl;
        g.ltCmv+=(r.ltCmv||0); g.stCmv+=(r.stCmv||0);
        if(r.fundLevel){ if(r.gl!=null) g.fundGain+=r.gl; }   /* TX-07: a Category III AIF, taxed at fund level */
        else if(r.ltGain!=null){ g.ltGain+=r.ltGain; g.stGain+=r.stGain; g.unclassGain+=(r.unknownGain||0); }
        else if(r.gl!=null){ g.unclassGain+=r.gl; }
      });
      return order.map(function(k){ return m[k]; }).sort(function(a,b){ return b.cmv-a.cmv; });
    }

    /* The harvest is not built here: it is per client (taxApplyAssumptions, TX-08). */
    function summarise(pos, unrec, unmap){
      var t={cmv:0,gl:0,glMissing:0,ltcgCmv:0,stcgCmv:0,unclassCmv:0,ltcgGain:0,stcgGain:0,unclassGain:0,lockedCmv:0,lockedGain:0,lockedN:0,
             fundLevelCmv:0,fundLevelGain:0,fundLevelN:0,
             notSplit:{fundLevel:{n:0,cmv:0,gl:0},passThrough:{n:0,cmv:0,gl:0},pms:{n:0,cmv:0,gl:0}}};
      var clsTot={};
      pos.forEach(function(r){
        t.cmv+=r.cmv;
        if(r.gl!=null) t.gl+=r.gl; else if(!r.splitPart) t.glMissing++;   /* TX-02: one holding, two records */
        var g=clsTot[r.cls]||(clsTot[r.cls]={cls:r.cls,rule:r.rule,cmv:0,ltCmv:0,stCmv:0,gl:0,
                                             ltGain:0,stGain:0,n:0,ltPos:0,ltNeg:0,stPos:0,stNeg:0});
        g.cmv+=r.cmv; g.n++;
        if(r.gl!=null) g.gl+=r.gl;
        /* TX-07, TX-10, TX-12 (D-040 d, h): no investor-level split, so never in a gain or loss pool.
           A Category III AIF is fund level (CMV + LT + ST + not classified + fund level = total CMV);
           a Category I or II AIF and a PMS stay in the not classified amounts. */
        if(r.notSplit){
          var ns=t.notSplit[r.notSplit]; if(ns){ ns.n++; ns.cmv+=r.cmv; if(r.gl!=null) ns.gl+=r.gl; }
          g.notSplit=r.notSplit;
          if(r.fundLevel){ t.fundLevelCmv+=r.cmv; t.fundLevelN++; if(r.gl!=null) t.fundLevelGain+=r.gl; }
          else { t.unclassCmv+=(r.unknownCmv||0); if(r.gl!=null) t.unclassGain+=r.gl; }
          return;
        }
        t.ltcgCmv+=(r.ltCmv||0); t.stcgCmv+=(r.stCmv||0); t.unclassCmv+=(r.unknownCmv||0);
        if(r.lockedCmv>0){ t.lockedCmv+=r.lockedCmv; t.lockedN++; if(r.lockedGain!=null) t.lockedGain+=r.lockedGain; }   /* TX-14 */
        if(r.ltGain!=null){ t.ltcgGain+=r.ltGain; t.stcgGain+=r.stGain; t.unclassGain+=(r.unknownGain||0); }
        else if(r.gl!=null){ t.unclassGain+=r.gl; }
        g.ltCmv+=(r.ltCmv||0); g.stCmv+=(r.stCmv||0);
        if(r.ltGain!=null){ g.ltGain+=r.ltGain; g.stGain+=r.stGain;
          /* pooled at position level: a loss-making holding is a harvest
             candidate even inside a class that nets positive */
          if(r.ltGain>0) g.ltPos+=r.ltGain; else g.ltNeg+=-r.ltGain;
          if(r.stGain>0) g.stPos+=r.stGain; else g.stNeg+=-r.stGain; }
      });
      /* unreconciled and unmapped hold real money — they count toward CMV and
         Gain/Loss, and all of it sits in the unclassified bucket */
      unrec.concat(unmap).forEach(function(r){
        t.cmv+=r.cmv; t.unclassCmv+=r.cmv;
        if(r.gl!=null){ t.gl+=r.gl; t.unclassGain+=r.gl; } else t.glMissing++;
      });
      /* holdings, not records: a holding split at 1 Apr 2023 (TX-02) is one holding */
      t.nPos=pos.filter(function(r){ return !r.splitPart; }).length; t.nHold=t.nPos+unrec.length+unmap.length;
      var byClass=Object.keys(clsTot).map(function(k){ return clsTot[k]; })
        .sort(function(a,b){ return b.cmv-a.cmv; });
      var all=pos.concat(unrec,unmap);
      return {
        totals:t, byClass:byClass,
        byProduct:taxRollup(all,function(r){ return r.product||r.pcls||''; }),
        byAsset:  taxRollup(all,function(r){ return r.asset||''; })
      };
    }

    var _fam=summarise(out.positions,out.unreconciled,out.unmapped);
    out.totals=_fam.totals; out.byClass=_fam.byClass;
    out.byProduct=_fam.byProduct; out.byAsset=_fam.byAsset;

    /* per-client views: the same summariser over each client's own records, so the client figures
       add back to the family figures by construction. The harvest is different (TX-08, KI-167, D-040
       f): set-off and the Sec 198 exemption belong to each person's own return, so each client's
       harvest is worked out on that client's records alone and the family harvest is their SUM
       (taxApplyAssumptions), never one set-off pooled across the family. */
    var _order=[], _seen={};
    out.positions.concat(out.unreconciled,out.unmapped).forEach(function(r){
      var c=r.client||'(unnamed)'; if(!_seen[c]){ _seen[c]=1; _order.push(c); }
    });
    var _pick=function(arr,c){ return arr.filter(function(r){ return (r.client||'(unnamed)')===c; }); };
    out.clients=_order.map(function(c){
      var p=_pick(out.positions,c), u=_pick(out.unreconciled,c), m=_pick(out.unmapped,c);
      var s=summarise(p,u,m);
      return {client:c, positions:p, unreconciled:u, unmapped:m,
              totals:s.totals, byClass:s.byClass, byProduct:s.byProduct, byAsset:s.byAsset};
    }).sort(function(a,b){ return b.totals.cmv-a.totals.cmv; });
    /* holdings with no client name are one group, so one person for the set-off and the exemption: counted */
    out.unnamedN=out.positions.concat(out.unreconciled,out.unmapped).filter(function(r){ return !r.client&&!r.splitPart; }).length;
    taxApplyAssumptions(out,assume);
`;

/* ---------------- engine (07): the AI Analyst tax signal ---------------- */
const AIA_NS = String.raw`    /* TX-07, TX-10, TX-12 (D-040 d, h): no investor-level split, so the reason and no long- or short-term figures */
    if (acc.nsN && acc.nsN === acc.n){
      ev.cls = acc.cls;
      return aiaSig("tax", "Tax", "na", ev, ({
        fundLevel: "A Category III AIF is taxed inside the fund: the investor receives a post-tax amount that is not taxed again, so there is no investor-level long- or short-term gain (Tax Reckoner TY 2026-27, #25).",
        passThrough: "A Category I or II AIF passes its income through to the investor, with the holding period counted at the AIF's level for each underlying asset, as its annual statement (Form 64C) reports; that statement is not loaded, so the gain is not split into long and short term (Tax Reckoner TY 2026-27, #24).",
        pms: "A PMS holds securities in the investor's own demat account, each taxed as if held directly from its own purchase date (Tax Reckoner TY 2026-27, #23); the IRR sheet holds only the capital put in and taken out, so the gain is not split into long and short term."
      })[acc.ns] || "This holding is not split into long and short term.");
    }
    var pos = acc;
`;

/* ---------------- UI (11): the harvest card ---------------- */
const OLD_UI_HARVEST = String.raw`    var H=T.harvest||null, harvestHtml='';
    if(H && (H.ltLosses>1e-9 || H.stLosses>1e-9 || H.taxBefore>1e-9)){
      var poolRows=H.pools.slice().sort(function(a,b){ return b.gross-a.gross; }).map(function(p){
        var used=p.gross-p.left;
        return '<tr><td>'+taxEsc(p.cls)+'<span class="taxsub">'+(p.b==='LT'?'Long term':'Short term')+'</span></td>'+
          '<td class="n">'+(p.rate!=null?(p.rate*100).toFixed(p.rate*100%1?2:0)+'%':taxEsc(p.label||'${EM}'))+'</td>'+
          '<td class="n">'+U.m(p.gross)+'</td>'+
          '<td class="n">'+(used>1e-9?'-'+U.m(used):'${EM}')+'</td>'+
          '<td class="n">'+U.m(p.left)+'</td>'+
          '<td class="n">'+(p.rate!=null?U.m(p.left*p.rate):taxEsc(p.label||'${EM}'))+'</td></tr>';
      }).join('');
      var unusedNote='';
      if(H.ltUnused>1e-9||H.stUnused>1e-9){
        unusedNote='<div class="taxwarn" style="margin-top:10px;">'+
          U.m(H.ltUnused+H.stUnused)+' of losses cannot be absorbed by this year&rsquo;s gains'+
          (H.ltUnused>1e-9?' ('+U.m(H.ltUnused)+' long term, which can only be set against long-term gains)':'')+
          '. Unabsorbed losses carry forward eight assessment years if the return is filed on time.</div>';
      }
      var candRows=H.candidates.slice(0,25).map(function(c){
        return '<tr><td>'+taxEsc(c.name)+'<span class="taxsub">'+taxEsc(c.client)+' &middot; '+taxEsc(c.cls)+'</span></td>'+
          '<td class="n">'+U.m(c.cmv)+'</td>'+
          '<td class="n"'+(c.ltLoss>0?' style="color:#931621;"':'')+'>'+(c.ltLoss>0?U.m(c.ltLoss):'${EM}')+'</td>'+
          '<td class="n"'+(c.stLoss>0?' style="color:#931621;"':'')+'>'+(c.stLoss>0?U.m(c.stLoss):'${EM}')+'</td></tr>';
      }).join('');
      harvestHtml='<div class="card"><h3>Tax Harvesting</h3>'+
        '<div class="sub">If the book were liquidated today. A short-term loss may be set against both short- and long-term gains; a long-term loss only against long-term gains. '+
          'Losses are applied to the highest-taxed gains first, which is what maximises the saving.</div>'+
        '<div style="display:flex;gap:10px;margin:2px 0 14px;">'+
          '<div class="taxkpi"><div class="v">'+U.m(H.taxBefore)+'</div><div class="l">Estimated tax before harvesting</div></div>'+
          '<div class="taxkpi"><div class="v">'+U.m(H.taxAfter)+'</div><div class="l">After setting off available losses</div></div>'+
          '<div class="taxkpi" style="background:#BD9568;"><div class="v" style="color:#FFFFFF;">'+U.m(H.saving)+'</div><div class="l" style="color:#FFF8E1;">Estimated tax saved</div></div>'+
        '</div>'+
        '<div style="overflow:auto;"><table class="taxt"><thead><tr><th>Gain pool</th><th class="n">Rate</th>'+
          '<th class="n">Gain</th><th class="n">Loss set off</th><th class="n">Taxable after</th><th class="n">Tax after</th></tr></thead>'+
          '<tbody>'+poolRows+'</tbody>'+
          '<tfoot><tr><td colspan="2">Losses available &mdash; '+U.m(H.ltLosses)+' long term, '+U.m(H.stLosses)+' short term</td>'+
          '<td class="n">'+U.m(H.ltGains+H.stGains)+'</td><td class="n">-'+U.m(H.ltUsed+H.stUsed)+'</td>'+
          '<td class="n">'+U.m(H.ltGains+H.stGains-H.ltUsed-H.stUsed)+'</td><td class="n">'+U.m(H.taxAfter)+'</td></tr></tfoot>'+
          '</table></div>'+
        unusedNote+
        (H.unquantifiedPools?'<div class="taxwarn" style="margin-top:10px;">'+H.unquantifiedPools+' gain pool'+(H.unquantifiedPools===1?'':'s')+
          ' totalling '+U.m(H.unquantifiedGain)+' carry a rate the rules state as a word (Slab rate, Fund-level), so no tax figure is computed for '+
          (H.unquantifiedPools===1?'it':'them')+'. The tax and saving above are therefore a floor, not the whole book.</div>':'')+
        (candRows?('<h4 style="margin:14px 0 4px;">Holdings sitting at a loss</h4>'+
          '<div class="sub">The positions a harvest would sell, largest loss first'+(H.candidates.length>25?' &mdash; top 25 of '+H.candidates.length:'')+'.</div>'+
          '<div style="overflow:auto;"><table class="taxt"><thead><tr><th>Holding</th><th class="n">CMV '+taxEsc(cap)+'</th>'+
          '<th class="n">Long-term loss</th><th class="n">Short-term loss</th></tr></thead><tbody>'+candRows+'</tbody></table></div>')
         :'<div class="sub" style="margin-top:10px;">No holding is currently at a loss, so there is nothing to harvest.</div>')+
        '<div style="font-family:Cambria,serif;font-size:10.5px;color:#5C3E17;margin-top:12px;line-height:1.5;">'+
          '* Rate of 12.5% to be levied on long-term capital gains exceeding Rs. 1.25 lakh provided Securities Transaction Tax (&lsquo;STT&rsquo;) is paid on transfer of such units.<br>'+
          '** Tax implication excludes cess &amp; surcharge'+
          (_gf.length?'<br>*** Lots bought before 1 Feb 2018 are measured on actual cost; the 31 Jan 2018 grandfathered cost is not applied, so long-term gains and tax on those lots may be overstated.':'')+
        '</div>'+
        '</div>';
    }
`;

const NEW_UI_HARVEST = String.raw`    /* TX-07, TX-10, TX-12 (D-040 d, h): holdings with no investor-level long- or short-term split, and why */
    var _nsT=t.notSplit||{fundLevel:{n:0,cmv:0,gl:0},passThrough:{n:0,cmv:0,gl:0},pms:{n:0,cmv:0,gl:0}}, _nsp=[];
    var _pl=function(n,one,many){ return n+' '+(n===1?one:many); };
    if(_nsT.fundLevel.n) _nsp.push(_pl(_nsT.fundLevel.n,'Category III AIF is','Category III AIFs are')+' taxed inside the fund: the investor receives a post-tax amount that is not taxed again, so there is no investor-level long- or short-term gain (Tax Reckoner TY 2026-27, #25). '+
      'CMV '+U.m(_nsT.fundLevel.cmv)+' and Gain/Loss '+gm(_nsT.fundLevel.gl)+' are shown as fund level, apart from the not classified amounts, and do not enter the investor&rsquo;s set-off.');
    if(_nsT.passThrough.n) _nsp.push(_pl(_nsT.passThrough.n,'Category I or II AIF is','Category I or II AIFs are')+' pass-through: income keeps its character and is taxed in the investor&rsquo;s hands, with the holding period counted at the AIF&rsquo;s level for each underlying asset, as its annual statement (Form 64C) reports (Tax Reckoner TY 2026-27, #24). '+
      'That statement is not loaded, so the Gain/Loss ('+gm(_nsT.passThrough.gl)+') is not split, is counted as not classified and is left out of tax harvesting.');
    if(_nsT.pms.n) _nsp.push(_pl(_nsT.pms.n,'PMS holds','PMS hold')+' securities in the investor&rsquo;s own demat account, each taxed as if held directly, from its own purchase date (Tax Reckoner TY 2026-27, #23). '+
      'The IRR sheet holds only the capital put in and taken out, so a PMS is not split into long and short term. Its Gain/Loss ('+gm(_nsT.pms.gl)+') is on capital contributed, not a capital-gains figure: it includes gains already realised and taxed inside the PMS and retained income, and is net of fees, which the conservative view does not deduct. '+
      'It is counted as not classified and left out of tax harvesting.');
    var nsNote=_nsp.length?('<div class="taxnote">'+_nsp.join(' ')+'</div>'):'';
    /* TX-23 (D-040 g): a tax row whose rate has no reckoner row carries its source */
    var _src=T.byClass.filter(function(g){ return g.rule&&g.rule.source; });
    var srcNote=_src.length?('<div class="taxnote">'+_src.map(function(g){ return taxEsc(g.cls)+': '+taxEsc(g.rule.source); }).join(' ')+'</div>'):'';
    var H=T.harvest||null, harvestHtml='', asClients=[];
    if(H && (H.ltGains+H.stGains>1e-9 || H.ltLosses>1e-9 || H.stLosses>1e-9)){
      /* TX-08 (KI-167, D-040 f): the family view lists each client's own harvest; the family figures are their sum */
      var hl=H.perClient?(H.byClient||[]):[H], multi=hl.length>1;
      asClients=hl.map(function(h){ return h.client; });
      var rp=function(r){ return (r*100).toFixed(r*100%1?2:0)+'%'; };
      var rs=function(v){ return '&#8377;'+Number(v||0).toLocaleString('en-IN'); };
      var cc=function(h){ return multi?('<td>'+taxEsc(h.client)+'</td>'):''; };
      /* TX-09, TX-16 (D-040 e, f): the analyst's assumptions for each client; a default says so */
      var asRows=hl.map(function(h,i){
        var a=h.assume||{};
        return '<tr><td>'+taxEsc(h.client)+'</td>'+
          '<td class="n"><input class="taxas" data-ci="'+i+'" data-k="slabPct" type="number" min="0" max="30" step="any" value="'+a.slabPct+'" style="width:60px;text-align:right;font-family:Cambria,serif;"> %'+(a.slabDefault?' (default)':'')+'</td>'+
          '<td class="n">&#8377; <input class="taxas" data-ci="'+i+'" data-k="usedRs" type="number" min="0" max="'+a.exemptRs+'" step="any" value="'+a.usedRs+'" style="width:100px;text-align:right;font-family:Cambria,serif;">'+(a.usedDefault?' (default)':'')+'</td>'+
          '<td class="n">'+rs(Math.max(0,(a.exemptRs||0)-(a.usedRs||0)))+'</td></tr>';
      }).join('');
      var asHtml='<div class="taxnote"><b>Assumptions for this harvest</b>, set by the analyst for each client; they change only the harvest. '+
        'The slab rate, 0 to 30% before surcharge and cess, only orders the set-off: slab-rate gains get no tax figure. '+
        'The Sec 198 exemption is &#8377;1.25 lakh per person per tax year, shared across listed shares, equity-oriented funds and REIT and InvIT units; enter the part already used this tax year, by gains realised earlier in the year or held elsewhere. '+
        'Until changed, a client is taken at the default slab rate with the whole exemption unused.'+
        '<table class="taxt" style="margin-top:6px;"><thead><tr><th>Client</th><th class="n">Slab rate for the set-off order</th><th class="n">Sec 198 exemption already used this tax year</th><th class="n">Exemption left</th></tr></thead><tbody>'+asRows+'</tbody></table>'+
        (H.s198Gains>1e-9?('<div style="margin-top:6px;">The exemption covers '+U.m(H.exBefore)+' of long-term gains before set-off and '+U.m(H.exAfter)+' after'+(multi?', each client within their own':'')+'.</div>'):'')+
        '</div>';
      var poolRows=hl.map(function(h){
        var rws=h.pools.slice().sort(function(a,b){ return b.gross-a.gross; }).map(function(p){
          var used=p.gross-p.left;
          return '<tr>'+cc(h)+'<td>'+taxEsc(p.cls)+'<span class="taxsub">'+(p.b==='LT'?'Long term':'Short term')+'</span></td>'+
            '<td class="n">'+(p.rate!=null?rp(p.rate)+(p.s198?'*':''):taxEsc(p.label||'${EM}'))+'</td>'+
            '<td class="n">'+U.m(p.gross)+'</td>'+
            '<td class="n">'+(used>1e-9?'-'+U.m(used):'${EM}')+'</td>'+
            '<td class="n">'+U.m(p.left)+'</td>'+
            '<td class="n">'+(p.rate!=null?U.m(p.left*p.rate):taxEsc(p.label||'${EM}'))+'</td></tr>';
        }).join('');
        /* TX-09: the exemption on its own line, so the pool cells add up to the figures above */
        if(h.s198Gains>1e-9) rws+='<tr>'+cc(h)+'<td><i>Less: Sec 198 exemption</i><span class="taxsub">'+rs(h.assume?h.assume.exemptRs:0)+' a year less '+rs(h.assume?h.assume.usedRs:0)+' already used</span></td>'+
          '<td class="n">'+rp(h.exRate)+'*</td><td class="n"></td><td class="n"></td>'+
          '<td class="n">-'+U.m(h.exAfter)+'</td><td class="n">-'+U.m(h.exAfterTax)+'</td></tr>';
        return rws;
      }).join('');
      var unusedNote='';
      var _un=hl.filter(function(h){ return h.ltUnused+h.stUnused>1e-9; });
      if(_un.length){
        /* TX-08, TX-22 (KI-181): whose loss is left over, and the carry-forward rule with its condition */
        unusedNote='<div class="taxwarn" style="margin-top:10px;">'+U.m(H.ltUnused+H.stUnused)+' of losses cannot be set off this year'+
          (multi?(': '+_un.map(function(h){ return taxEsc(h.client)+' '+U.m(h.ltUnused+h.stUnused)+(h.ltUnused>1e-9?' ('+U.m(h.ltUnused)+' long term)':''); }).join('; '))
                :(H.ltUnused>1e-9?' ('+U.m(H.ltUnused)+' long term)':''))+
          '. '+(multi?'Each can be carried forward in that person&rsquo;s own return':'It can be carried forward')+' for up to eight tax years, provided the return is filed by the due date. '+
          'A short-term loss can then be set off against any capital gain; a long-term loss only against long-term gains.</div>';
      }
      var _lo=[];
      if(_nsT.pms.n) _lo.push(_nsT.pms.n+' PMS ('+U.m(_nsT.pms.cmv)+')');
      if(_nsT.passThrough.n) _lo.push(_pl(_nsT.passThrough.n,'Category I or II AIF','Category I or II AIFs')+' ('+U.m(_nsT.passThrough.cmv)+')');
      if(_nsT.fundLevel.n) _lo.push(_pl(_nsT.fundLevel.n,'Category III AIF','Category III AIFs')+' ('+U.m(_nsT.fundLevel.cmv)+')');
      var loNote=_lo.length?('<div class="sub" style="margin-top:8px;">Left out of the harvest, as they have no investor-level long- or short-term split (see the notes above): '+_lo.join(', ')+'.</div>'):'';
      var unnNote=T.unnamedN?('<div class="sub" style="margin-top:6px;">'+_pl(T.unnamedN,'holding has','holdings have')+' no client name; they are treated as one person for the set-off and the exemption.</div>'):'';
      var candRows=H.candidates.slice(0,25).map(function(c){
        return '<tr><td>'+taxEsc(c.name)+'<span class="taxsub">'+taxEsc(c.client)+' &middot; '+taxEsc(c.cls)+'</span></td>'+
          '<td class="n">'+U.m(c.cmv)+'</td>'+
          '<td class="n"'+(c.ltLoss>0?' style="color:#931621;"':'')+'>'+(c.ltLoss>0?U.m(c.ltLoss):'${EM}')+'</td>'+
          '<td class="n"'+(c.stLoss>0?' style="color:#931621;"':'')+'>'+(c.stLoss>0?U.m(c.stLoss):'${EM}')+'</td></tr>';
      }).join('');
      harvestHtml='<div class="card"><h3>Tax Harvesting</h3>'+
        '<div class="sub">If the book were sold on '+taxEsc(asOn)+'. Set-off and the &#8377;1.25 lakh exemption belong to each person&rsquo;s own return, so each client&rsquo;s harvest is worked out on that client&rsquo;s holdings alone'+
          (multi?'; the family figures add up the clients&rsquo; results, and one client&rsquo;s loss is never set against another client&rsquo;s gain':'')+'. '+
          'A short-term loss may be set against short- and long-term gains; a long-term loss only against long-term gains. '+
          'Losses go first to the gains taxed at the highest rate, with slab-rate gains ranked at the slab rate assumed below. '+
          'Sec 198 long-term gains inside the exemption are taxed at 0%, so losses reach them last; the exemption then applies to what is left.</div>'+
        asHtml+
        '<div style="display:flex;gap:10px;margin:2px 0 14px;">'+
          '<div class="taxkpi"><div class="v">'+U.m(H.taxBefore)+'</div><div class="l">Estimated tax before harvesting</div></div>'+
          '<div class="taxkpi"><div class="v">'+U.m(H.taxAfter)+'</div><div class="l">After setting off available losses</div></div>'+
          '<div class="taxkpi" style="background:#BD9568;"><div class="v" style="color:#FFFFFF;">'+U.m(H.saving)+'</div><div class="l" style="color:#FFF8E1;">Estimated tax saved</div></div>'+
        '</div>'+
        '<div style="overflow:auto;"><table class="taxt"><thead><tr>'+(multi?'<th>Client</th>':'')+'<th>Gain pool</th><th class="n">Rate</th>'+
          '<th class="n">Gain</th><th class="n">Loss set off</th><th class="n">Taxable after</th><th class="n">Tax after</th></tr></thead>'+
          '<tbody>'+poolRows+'</tbody>'+
          '<tfoot><tr><td colspan="'+(multi?3:2)+'">Losses available: '+U.m(H.ltLosses)+' long term, '+U.m(H.stLosses)+' short term</td>'+
          '<td class="n">'+U.m(H.ltGains+H.stGains)+'</td><td class="n">-'+U.m(H.ltUsed+H.stUsed)+'</td>'+
          '<td class="n">'+U.m(H.ltGains+H.stGains-H.ltUsed-H.stUsed-(H.exAfter||0))+'</td><td class="n">'+U.m(H.taxAfter)+'</td></tr></tfoot>'+
          '</table></div>'+
        unusedNote+
        (H.unquantifiedPools?'<div class="taxwarn" style="margin-top:10px;">'+H.unquantifiedPools+' gain pool'+(H.unquantifiedPools===1?'':'s')+
          ' totalling '+U.m(H.unquantifiedGain)+' '+(H.unquantifiedPools===1?'is':'are')+' taxed at the slab rate, so no tax figure is computed for '+(H.unquantifiedPools===1?'it':'them')+
          (H.slabSheltered>1e-9?('; losses set off against '+(H.unquantifiedPools===1?'it':'them')+' ('+U.m(H.slabSheltered)+') save tax at the client&rsquo;s slab rate, which is not in the saving above'):'')+
          '. The tax and saving above are therefore a floor, not the whole book.</div>':'')+
        loNote+unnNote+
        (candRows?('<h4 style="margin:14px 0 4px;">Holdings sitting at a loss</h4>'+
          '<div class="sub">The positions a harvest would sell, largest loss first'+(H.candidates.length>25?' (the top 25 of '+H.candidates.length+')':'')+'.</div>'+
          '<div style="overflow:auto;"><table class="taxt"><thead><tr><th>Holding</th><th class="n">CMV '+taxEsc(cap)+'</th>'+
          '<th class="n">Long-term loss</th><th class="n">Short-term loss</th></tr></thead><tbody>'+candRows+'</tbody></table></div>')
         :'<div class="sub" style="margin-top:10px;">No holding is currently at a loss, so there is nothing to harvest.</div>')+
        '<div style="font-family:Cambria,serif;font-size:10.5px;color:#5C3E17;margin-top:12px;line-height:1.5;">'+
          '* Long-term gains under Sec 198 (listed equity shares, equity-oriented funds, REIT and InvIT units, where Securities Transaction Tax is paid) are taxed at 12.5% only above &#8377;1.25 lakh a year: one limit per person, applied after losses are set off. Other long-term gains are taxed at 12.5% on the whole gain.<br>'+
          '** Tax implication excludes cess &amp; surcharge'+
          (_gf.length?'<br>*** Lots bought before 1 Feb 2018 are measured on actual cost; the 31 Jan 2018 grandfathered cost is not applied, so long-term gains and tax on those lots may be overstated.':'')+
        '</div>'+
        '</div>';
    }
`;

/* ---------------- exporters (08): the harvest slide ---------------- */
const GF_FOOT = 'Lots bought before 1 Feb 2018 are measured on actual cost; the 31 Jan 2018 grandfathered cost is not applied, so long-term gains and tax on those lots may be overstated.';
const OLD_X_HARVEST = String.raw`      var H=T.harvest;
      if(H && (H.ltLosses>1e-9 || H.stLosses>1e-9 || H.taxBefore>1e-9)){
        var s2=base("Tax Harvesting"+_scopeTag);
        kpi(s2,kx,1.06,kw,U.m(H.taxBefore),"Estimated tax before harvesting");
        kpi(s2,kx+kw+kg,1.06,kw,U.m(H.taxAfter),"After setting off available losses");
        kpi(s2,kx+(kw+kg)*2,1.06,kw,U.m(H.saving),"Estimated tax saved");
        var h2=["Gain pool","Head","Rate","Gain","Loss set off","Taxable after","Tax after"];
        var r2=[h2.map(function(h,i){ return cell(h,{bold:true,color:"FFFFFF",fill:C.black,align:i?'center':'left'}); })];
        H.pools.slice().sort(function(a,b){ return b.gross-a.gross; }).slice(0,13).forEach(function(p){
          var used=p.gross-p.left;
          r2.push([
            cell(p.cls,{align:'left'}),
            cell(p.b==='LT'?'Long term':'Short term',{align:'center'}),
            cell(p.rate!=null?((p.rate*100).toFixed(p.rate*100%1?2:0)+'%'):(p.label||'${EM}'),{align:'center'}),
            cell(U.m(p.gross),{align:'right'}),
            cell(used>1e-9?('-'+U.m(used)):'${EM}',{align:'right',color:(used>1e-9?C.green:'000000')}),
            cell(U.m(p.left),{align:'right'}),
            cell(p.rate!=null?U.m(p.left*p.rate):(p.label||'${EM}'),{align:'right'})
          ]);
        });
        s2.addTable(r2,{x:0.18,y:1.94,w:13.0,colW:[3.40,1.50,1.50,1.75,1.85,1.50,1.50],rowH:0.30,
          fontFace:F,border:{type:'solid',pt:0.3,color:'D9D9D9'},valign:'middle'});
        var yNote=Math.min(6.25, 2.24+0.30*(r2.length));
        s2.addText('Losses available: '+U.m(H.ltLosses)+' long term, '+U.m(H.stLosses)+' short term. '+
          'A short-term loss may be set against both heads; a long-term loss only against long-term gains. Losses are applied to the highest-taxed gains first.'+
          ((H.ltUnused>1e-9||H.stUnused>1e-9)?(' '+U.m(H.ltUnused+H.stUnused)+' cannot be absorbed this year and carries forward eight assessment years.'):'')+
          (H.unquantifiedPools?(' '+H.unquantifiedPools+' pool(s) totalling '+U.m(H.unquantifiedGain)+' carry a word rate, so the tax shown is a floor.'):''),
          {x:0.18,y:yNote,w:13.0,h:0.42,fontFace:F,fontSize:8.5,color:'5C3E17',valign:'top'});
        foot(s2,'* Rate of 12.5% to be levied on long-term capital gains exceeding Rs. 1.25 lakh provided Securities Transaction Tax (${LSQ}STT${RSQ}) is paid on transfer of such units.   '+
          '** Tax implication excludes cess & surcharge'+(gfN?'   *** ` + GF_FOOT + String.raw`':''));
`;

const NEW_X_HARVEST = String.raw`      var H=T.harvest;
      /* TX-08, TX-09, TX-16, TX-22 (CR-0008; D-040 e, f): each client's harvest is that client's own and the
         family figures are their sum. The family slide adds the clients' pools up by class and head (each
         after its own set-off), states the analyst's assumptions and says whose loss is left over. */
      if(H && (H.ltGains+H.stGains>1e-9 || H.ltLosses>1e-9 || H.stLosses>1e-9)){
        var s2=base("Tax Harvesting"+_scopeTag);
        kpi(s2,kx,1.06,kw,U.m(H.taxBefore),"Estimated tax before harvesting");
        kpi(s2,kx+kw+kg,1.06,kw,U.m(H.taxAfter),"After setting off available losses");
        kpi(s2,kx+(kw+kg)*2,1.06,kw,U.m(H.saving),"Estimated tax saved");
        var _hl=H.perClient?(H.byClient||[]):[H], _multi=_hl.length>1;
        var _rp=function(r){ return (r*100).toFixed(r*100%1?2:0)+'%'; };
        var _rs=function(v){ return '${INR}'+Number(v||0).toLocaleString('en-IN'); };
        var _pm={}, _po=[];
        _hl.forEach(function(h){ (h.pools||[]).forEach(function(p){
          var k=p.b+'|'+p.cls, q=_pm[k];
          if(!q){ q=_pm[k]={b:p.b,cls:p.cls,rate:p.rate,label:p.label,s198:p.s198,gross:0,left:0}; _po.push(q); }
          q.gross+=p.gross; q.left+=p.left; }); });
        _po.sort(function(a,b){ return b.gross-a.gross; });
        var _s198=H.s198Gains>1e-9;
        /* the note under the table: assumptions, the method, the exemption, carry-forward, the floor, holdings left out */
        var _asOf=function(h){ var a=h.assume||{}; return 'slab rate '+a.slabPct+'%'+(a.slabDefault?' (default)':'')+', Sec 198 exemption already used this tax year '+_rs(a.usedRs)+(a.usedDefault?' (default)':''); };
        var _same=_hl.every(function(h){ return _asOf(h)===_asOf(_hl[0]); });
        var nt=['Assumptions set by the analyst'+((_multi&&_same)?' for each client':'')+': '+(_same?_asOf(_hl[0]):_hl.map(function(h){ return h.client+', '+_asOf(h); }).join('; '))+
            '. The slab rate only orders the set-off; slab-rate gains get no tax figure.',
          'Losses available: '+U.m(H.ltLosses)+' long term, '+U.m(H.stLosses)+' short term.'+
            (_multi?' Set-off is worked out for each client on their own and added up; one client${RSQ}s loss is never set against another client${RSQ}s gain.':'')+
            ' A short-term loss may be set against both heads; a long-term loss only against long-term gains. Losses go first to the gains taxed at the highest rate; Sec 198 gains inside the exemption are reached last.'];
        if(_s198) nt.push('The Sec 198 exemption'+(_multi?' (each client${RSQ}s own)':'')+' covers '+U.m(H.exBefore)+' of long-term gains before set-off and '+U.m(H.exAfter)+' after.');
        var _un=_hl.filter(function(h){ return h.ltUnused+h.stUnused>1e-9; });
        if(_un.length) nt.push(U.m(H.ltUnused+H.stUnused)+' cannot be set off this year'+(_multi?(' ('+_un.map(function(h){ return h.client+' '+U.m(h.ltUnused+h.stUnused); }).join('; ')+')'):'')+
          '. It can be carried forward for up to eight tax years'+(_multi?' in that person${RSQ}s own return':'')+', provided the return is filed by the due date; a short-term loss can then be set off against any capital gain, a long-term loss only against long-term gains.');
        if(H.unquantifiedPools) nt.push(H.unquantifiedPools+' pool(s) totalling '+U.m(H.unquantifiedGain)+' are at the slab rate, so the tax shown is a floor'+
          (H.slabSheltered>1e-9?('; losses set against them ('+U.m(H.slabSheltered)+') save tax at the slab rate, not counted above'):'')+'.');
        var _lo=[];
        if(_ns.pms.n) _lo.push(_ns.pms.n+' PMS');
        if(_ns.passThrough.n) _lo.push(_ns.passThrough.n+' Cat I/II AIF'+(_ns.passThrough.n===1?'':'s'));
        if(_ns.fundLevel.n) _lo.push(_ns.fundLevel.n+' Cat III AIF'+(_ns.fundLevel.n===1?'':'s'));
        if(_lo.length) nt.push('Left out, as not split into long and short term: '+_lo.join(', ')+'.');
        if(T.unnamedN) nt.push(T.unnamedN+' holding(s) with no client name are treated as one person.');
        /* rows from the band left above the note: a pool whose name wraps counts as a taller row */
        var _TOP=1.94, _BOT=6.86, _CH=215;
        var _rh=function(p){ return String(p.cls).length>46?0.45:0.30; };
        var _nh=function(extra){ return Math.ceil((nt.join(' ').length+extra)/_CH)*0.15+0.06; };
        var _fit=function(nh){ var y=_TOP+0.30+(_s198?0.30:0), n=0; while(n<_po.length && y+_rh(_po[n])+0.10+nh<=_BOT){ y+=_rh(_po[n]); n++; } return n; };
        var _n=_fit(_nh(0));
        if(_n<_po.length){ _n=_fit(_nh(95)); nt.push('Showing the largest '+_n+' of '+_po.length+' gain pools; the figures above cover all of them.'); }
        var h2=["Gain pool","Head","Rate","Gain","Loss set off","Taxable after","Tax after"];
        var r2=[h2.map(function(h,i){ return cell(h,{bold:true,color:"FFFFFF",fill:C.black,align:i?'center':'left'}); })];
        var _yt=_TOP+0.30;
        _po.slice(0,_n).forEach(function(p){
          var used=p.gross-p.left;
          r2.push([
            cell(p.cls,{align:'left'}),
            cell(p.b==='LT'?'Long term':'Short term',{align:'center'}),
            cell(p.rate!=null?(_rp(p.rate)+(p.s198?'*':'')):(p.label||'${EM}'),{align:'center'}),
            cell(U.m(p.gross),{align:'right'}),
            cell(used>1e-9?('-'+U.m(used)):'${EM}',{align:'right',color:(used>1e-9?C.green:'000000')}),
            cell(U.m(p.left),{align:'right'}),
            cell(p.rate!=null?U.m(p.left*p.rate):(p.label||'${EM}'),{align:'right'})
          ]);
          _yt+=_rh(p);
        });
        /* TX-09: the exemption on its own line, so the pool cells add up to the figures above */
        if(_s198){ r2.push([
            cell('Less: Sec 198 exemption'+(_multi?' (each client${RSQ}s own)':''),{align:'left',italic:true}),
            cell('Long term',{align:'center',italic:true}),
            cell(_rp(H.exRate||0)+'*',{align:'center',italic:true}),
            cell('',{}), cell('',{}),
            cell('-'+U.m(H.exAfter),{align:'right',italic:true}),
            cell('-'+U.m(H.exAfterTax),{align:'right',italic:true})
          ]); _yt+=0.30; }
        s2.addTable(r2,{x:0.18,y:_TOP,w:13.0,colW:[3.40,1.50,1.50,1.75,1.85,1.50,1.50],rowH:0.30,
          fontFace:F,border:{type:'solid',pt:0.3,color:'D9D9D9'},valign:'middle'});
        var _hN=_nh(0);
        s2.addText(nt.join(' '),{x:0.18,y:Math.min(_yt+0.10,_BOT-_hN),w:13.0,h:_hN,fontFace:F,fontSize:8.5,color:'5C3E17',valign:'top'});
        foot(s2,'* Sec 198 long-term gains (listed shares, equity-oriented funds, REIT and InvIT units, STT paid) are taxed at 12.5% only above ${INR}1.25 lakh a year: one limit per person, after losses are set off. Other long-term gains are taxed at 12.5% on the whole gain.   '+
          '** Tax implication excludes cess & surcharge'+(gfN?'   *** ` + GF_FOOT + String.raw`':''));
`;

applyPatch('2026-10-27 tax batch T3: the harvest, AIF and PMS treatment, wording (CR-0008, D-040)', DATA_EDITS.concat([

  /* ---------------- engine (07) ---------------- */
  {
    label: 'engine: the per-client harvest, the assumptions and taxNotSplit at engine scope; computeTaxation takes the assumptions (TX-08, TX-09, TX-16)',
    from: '  function computeTaxation(rows, REF, asOn){\n    var RULES=(REF.TAX_RULES||[]), byName={};\n',
    to: ENGINE_HARVEST
  },
  {
    label: 'engine: a Category III AIF is fund level, a Category I or II AIF pass-through: no lots, no reconciliation (TX-07, TX-12)',
    from: String.raw`      if(!cls||!rule){ rec.reason=cls?("No row in the tax rules covers the class ${LDQ}"+cls+"${RDQ}."):(_tc.why||""); out.unmapped.push(rec); return; }
`,
    to: String.raw`      if(!cls||!rule){ rec.reason=cls?("No row in the tax rules covers the class ${LDQ}"+cls+"${RDQ}."):(_tc.why||""); out.unmapped.push(rec); return; }
      /* TX-07 (KI-166), TX-12 (KI-171), D-040 (d): a Category III AIF is taxed inside the fund and a
         Category I or II AIF passes through per underlying asset (Master Summary #25, #24): neither has
         an investor-level long- or short-term gain the page can compute, so no lot ageing and no
         reconciliation (its lots are for information only), and never in the harvest */
      if(rule.fundLevel||rule.passThrough){ out.positions.push(taxNotSplit(rec,rule,L,rule.fundLevel?"fundLevel":"passThrough",cmv,gl)); return; }
`
  },
  {
    label: 'engine: a PMS is not split, after its capital flows reconcile (TX-10)',
    from: '      var scale=(baseU!=null&&fifoU>0)?(baseU/fifoU):1;\n',
    to: String.raw`      /* TX-10 (KI-169), D-040 (h), OD-12: a PMS is taxed per security as if held directly (Master
         Summary #23); the IRR sheet holds only its capital flows, so it is not split into long and short
         term (no apportioning) and stays out of the harvest. Its CMV and Gain/Loss stay as not classified. */
      if(rule.perSecurity){ out.positions.push(taxNotSplit(rec,rule,L,"pms",cmv,gl)); return; }
      var scale=(baseU!=null&&fifoU>0)?(baseU/fifoU):1;
`
  },
  {
    label: 'engine: the summariser keeps not-split holdings out of the pools; the harvest per client, the family harvest their sum (TX-07, TX-08, TX-10, TX-12)',
    from: OLD_SUMMARY,
    to: NEW_SUMMARY
  },
  {
    label: 'engine: computeReview passes the analyst\'s harvest assumptions (TX-09, TX-16)',
    from: 'computeTaxation(rows,REF,_rd.date);   /* TX-17, D-040 (a) */',
    to: 'computeTaxation(rows,REF,_rd.date,opts.taxAssume);   /* TX-17, D-040 (a); TX-09, TX-16: the analyst\'s harvest assumptions */'
  },
  {
    label: 'engine: AI Analyst tax signal counts not-split holdings (TX-07, TX-10, TX-12)',
    from: '    var acc = { ltCmv: 0, stCmv: 0, ltGain: null, stGain: null, cls: "", n: 0, lockCmv: 0, gf: 0 };\n',
    to: '    var acc = { ltCmv: 0, stCmv: 0, ltGain: null, stGain: null, cls: "", n: 0, lockCmv: 0, gf: 0, nsN: 0, ns: "" };\n'
  },
  {
    label: 'engine: AI Analyst tax signal notes a not-split holding',
    from: '      if (!p.splitPart) acc.n++;   /* TX-02: a holding split at 1 Apr 2023 is one holding */\n',
    to: '      if (!p.splitPart) acc.n++;   /* TX-02: a holding split at 1 Apr 2023 is one holding */\n' +
        '      if (p.notSplit && !p.splitPart){ acc.nsN++; acc.ns = p.notSplit; }   /* TX-07, TX-10, TX-12 */\n'
  },
  {
    label: 'engine: AI Analyst tax signal gives a not-split holding its reason, no long- or short-term text (TX-07, TX-10, TX-12)',
    from: '    var pos = acc;\n',
    to: AIA_NS
  },
  {
    label: 'engine: API exposes taxApplyAssumptions, taxAssumeFor and the defaults',
    from: '    computeTaxation:computeTaxation, taxClassOf:taxClassOf, taxClassify:taxClassify, xirr:xirr,\n',
    to: '    computeTaxation:computeTaxation, taxClassOf:taxClassOf, taxClassify:taxClassify, xirr:xirr,\n' +
        '    taxApplyAssumptions:taxApplyAssumptions, taxAssumeFor:taxAssumeFor, taxDefaults:TAX_HARVEST_DEFAULTS,\n'
  },

  /* ---------------- exporters (08): taxation slides ---------------- */
  {
    label: 'slides: one client\'s view carries the count of holdings with no client name (TX-08)',
    from: '                 asOnSource:_all.asOnSource,irrThrough:_all.irrThrough,later:_all.later,\n',
    to: '                 asOnSource:_all.asOnSource,irrThrough:_all.irrThrough,later:_all.later,unnamedN:(_cv&&_cv.client===\'(unnamed)\')?_all.unnamedN:0,\n'
  },
  {
    label: 'slides: "Long term after" for fund-level, pass-through and per-security rows (TX-07, TX-10, TX-12)',
    from: "      var lta=function(r){ if(!r) return '\\u2014'; if(r.alwaysShort) return 'Always short term'; if(r.anyPeriod) return 'Any period';\n" +
          "        return 'More than '+r.months+' months'+",
    to: "      var lta=function(r){ if(!r) return '\\u2014'; if(r.fundLevel) return 'Fund level'; if(r.passThrough) return 'At AIF level, per asset'; if(r.alwaysShort) return 'Always short term'; if(r.anyPeriod) return 'Any period';\n" +
        "        return (r.perSecurity?'Per security, more':'More')+' than '+r.months+' months'+"
  },
  {
    label: 'slides: not-split counts, the cell label and the Crypto source (TX-07, TX-10, TX-12, TX-23)',
    from: '      var gfN=T.positions.filter(function(r){ return r.gfLots>0; }).length;\n',
    to: '      var gfN=T.positions.filter(function(r){ return r.gfLots>0; }).length;\n' + String.raw`      /* TX-07, TX-10, TX-12 (D-040 d, h): holdings with no investor-level split; TX-23: a row whose source is noted */
      var _ns=t.notSplit||{fundLevel:{n:0},passThrough:{n:0},pms:{n:0}};
      var _nsl=function(k){ return k==='fundLevel'?'Fund level':'Not split'; };
      var _nsCells=function(k,o){ var c=[]; for(var i=0;i<6;i++) c.push(cell(_nsl(k),o)); return c; };
      /* kept short: the class footnote holds about two lines (KI-109); the tab gives the full reasons and source */
      var _nsb=[];
      if(_ns.pms.n) _nsb.push('PMS (per security)');
      if(_ns.passThrough.n) _nsb.push('Cat I/II AIFs (per underlying asset)');
      var _nsFoot=(_nsb.length?(' Not split: '+_nsb.join(', ')+'.'):'')+(_ns.fundLevel.n?' Cat III AIFs: fund level.':'');
      var _srcFoot=T.byClass.filter(function(g){ return g.rule&&g.rule.source; }).map(function(g){ return ' '+g.cls+': no tax reckoner row; '+rt(g.rule.st)+' kept, the law being unchanged.'; }).join('');
`
  },
  {
    label: 'slides: the Total Gain/Loss tile names the fund-level part (TX-07)',
    from: '      kpi(s,kx+(kw+kg)*2,1.06,kw,gm(t.gl),"Total Gain/Loss (unclassified "+gm(t.unclassGain)+(t.glMissing?',
    to: '      kpi(s,kx+(kw+kg)*2,1.06,kw,gm(t.gl),"Total Gain/Loss (unclassified "+gm(t.unclassGain)+(t.fundLevelN?"; fund level "+gm(t.fundLevelGain):"")+(t.glMissing?'
  },
  {
    label: 'slides: class table shows Not split or Fund level in the long- and short-term cells',
    from: "          cell(gm(g.ltGain),{align:'right',color:(g.ltGain<0?C.red:'000000')}),\n" +
          "          cell(gm(g.stGain),{align:'right',color:(g.stGain<0?C.red:'000000')}),\n",
    to: "          g.notSplit?cell(_nsl(g.notSplit),{align:'center',color:'5C3E17'}):cell(gm(g.ltGain),{align:'right',color:(g.ltGain<0?C.red:'000000')}),\n" +
        "          g.notSplit?cell(_nsl(g.notSplit),{align:'center',color:'5C3E17'}):cell(gm(g.stGain),{align:'right',color:(g.stGain<0?C.red:'000000')}),\n"
  },
  {
    label: 'slides: class footnote names not-split holdings and the Crypto source',
    from: "        (t.lockedCmv>1e-12?(' ELSS units still in lock-in ('+U.m(t.lockedCmv)+') are unclassified and not harvested.'):''));\n",
    to: "        (t.lockedCmv>1e-12?(' ELSS units still in lock-in ('+U.m(t.lockedCmv)+') are unclassified and not harvested.'):'')+_nsFoot+_srcFoot);\n"
  },
  {
    label: 'slides: totals tables get a Fund level column when a Category III AIF is held (TX-07)',
    from: '        var cw=[1.58,0.60,0.84,0.82,0.82,0.82,0.82];\n',
    to: '        var _fl=!!t.fundLevelN;   /* TX-07: Category III AIFs, taxed at fund level, have their own column */\n' +
        '        var cw=_fl?[1.32,0.60,0.76,0.72,0.72,0.72,0.72,0.74]:[1.58,0.60,0.84,0.82,0.82,0.82,0.82];\n'
  },
  {
    label: 'slides: totals tables header',
    from: '          var h=[title,"Holdings","CMV","LTCG G/L","STCG G/L","Unclass.","Total G/L"];\n',
    to: '          var h=[title,"Holdings","CMV","LTCG G/L","STCG G/L","Unclass."].concat(_fl?["Fund level"]:[],["Total G/L"]);\n'
  },
  {
    label: 'slides: totals tables rows',
    from: "              cell(gm(g.unclassGain),{align:'right',fontSize:7,color:(g.unclassGain<0?C.red:'000000')}),\n" +
          "              cell(gm(g.gl),{align:'right',fontSize:7,color:(g.gl<0?C.red:'000000')})\n" +
          "            ]);\n",
    to: "              cell(gm(g.unclassGain),{align:'right',fontSize:7,color:(g.unclassGain<0?C.red:'000000')})\n" +
        "            ].concat(_fl?[cell(gm(g.fundGain),{align:'right',fontSize:7,color:(g.fundGain<0?C.red:'000000')})]:[],\n" +
        "              [cell(gm(g.gl),{align:'right',fontSize:7,color:(g.gl<0?C.red:'000000')})]));\n"
  },
  {
    label: 'slides: grand total header',
    from: '        var gh=[(_sc?_sc:"Family")+" — grand total","Holdings","CMV","LTCG G/L","STCG G/L","Unclassified","Total G/L"];\n',
    to: '        var gh=[(_sc?_sc:"Family")+" — grand total","Holdings","CMV","LTCG G/L","STCG G/L","Unclassified"].concat(_fl?["Fund level"]:[],["Total G/L"]);\n'
  },
  {
    label: 'slides: grand total row and widths',
    from: "            cell(gm(t.unclassGain),{align:'right',bold:true,fill:'DBC8B2',color:(t.unclassGain<0?C.red:'000000')}),\n" +
          "            cell(gm(t.gl),{align:'right',bold:true,fill:'DBC8B2',color:(t.gl<0?C.red:'000000')}) ]];\n" +
          "        st.addTable(gr,{x:0.18,y:gy,w:13.0,colW:[4.30,1.20,1.60,1.55,1.55,1.55,1.25],rowH:0.30,fontFace:F,\n",
    to: "            cell(gm(t.unclassGain),{align:'right',bold:true,fill:'DBC8B2',color:(t.unclassGain<0?C.red:'000000')}) ]\n" +
        "            .concat(_fl?[cell(gm(t.fundLevelGain),{align:'right',bold:true,fill:'DBC8B2',color:(t.fundLevelGain<0?C.red:'000000')})]:[],\n" +
        "              [cell(gm(t.gl),{align:'right',bold:true,fill:'DBC8B2',color:(t.gl<0?C.red:'000000')})]) ];\n" +
        "        st.addTable(gr,{x:0.18,y:gy,w:13.0,colW:_fl?[3.70,1.00,1.45,1.40,1.40,1.40,1.40,1.25]:[4.30,1.20,1.60,1.55,1.55,1.55,1.25],rowH:0.30,fontFace:F,\n"
  },
  {
    label: 'slides: totals footnote, the not-split holdings and the fund level column',
    from: "          '(no reconciled lot history, no tax class, or ELSS units in lock-in), carried at the total.'+\n",
    to: "          '(no reconciled lot history, no tax class, ELSS units in lock-in, or a PMS or Cat I/II AIF, which is not split), carried at the total.'+\n" +
        "          (_fl?' Fund level is the Gain/Loss of Cat III AIFs, taxed inside the fund.':'')+\n"
  },
  {
    label: 'slides: holding detail, a not-split class banner',
    from: "            cell(U.m(g.ltCmv),{bold:true,fontSize:7,fill:'DBC8B2',align:'right'}),\n" +
          "            cell(gm(g.ltGain),{bold:true,fontSize:7,fill:'DBC8B2',align:'right',color:(g.ltGain<0?C.red:'000000')}),\n" +
          "            cell('',bo),\n" +
          "            cell(U.m(g.stCmv),{bold:true,fontSize:7,fill:'DBC8B2',align:'right'}),\n" +
          "            cell(gm(g.stGain),{bold:true,fontSize:7,fill:'DBC8B2',align:'right',color:(g.stGain<0?C.red:'000000')}),\n",
    to: "            g.notSplit?cell(_nsl(g.notSplit),{bold:true,fontSize:7,fill:'DBC8B2',align:'center'}):cell(U.m(g.ltCmv),{bold:true,fontSize:7,fill:'DBC8B2',align:'right'}),\n" +
        "            g.notSplit?cell(_nsl(g.notSplit),{bold:true,fontSize:7,fill:'DBC8B2',align:'center'}):cell(gm(g.ltGain),{bold:true,fontSize:7,fill:'DBC8B2',align:'right',color:(g.ltGain<0?C.red:'000000')}),\n" +
        "            cell('',bo),\n" +
        "            g.notSplit?cell(_nsl(g.notSplit),{bold:true,fontSize:7,fill:'DBC8B2',align:'center'}):cell(U.m(g.stCmv),{bold:true,fontSize:7,fill:'DBC8B2',align:'right'}),\n" +
        "            g.notSplit?cell(_nsl(g.notSplit),{bold:true,fontSize:7,fill:'DBC8B2',align:'center'}):cell(gm(g.stGain),{bold:true,fontSize:7,fill:'DBC8B2',align:'right',color:(g.stGain<0?C.red:'000000')}),\n"
  },
  {
    label: 'slides: holding detail, a not-split holding row',
    from: String.raw`              cell(dt(r.newest),{align:'center',fontSize:7}),
              cell(r.amtMode?'${EM}':un(r.ltUnits),{align:'right',fontSize:7}),
              cell(U.m(r.ltCmv),{align:'right',fontSize:7}),
              cell(gm(r.ltGain),{align:'right',fontSize:7,color:(r.ltGain<0?C.red:'000000')}),
              cell(r.amtMode?'${EM}':un(r.stUnits),{align:'right',fontSize:7}),
              cell(U.m(r.stCmv),{align:'right',fontSize:7}),
              cell(gm(r.stGain),{align:'right',fontSize:7,color:(r.stGain<0?C.red:'000000')}),
              cell(String(r.lots),{align:'center',fontSize:7})
            ]);
`,
    to: String.raw`              cell(dt(r.newest),{align:'center',fontSize:7})
            ].concat(r.notSplit?_nsCells(r.notSplit,{align:'center',fontSize:6.5,color:'5C3E17'}):[
              cell(r.amtMode?'${EM}':un(r.ltUnits),{align:'right',fontSize:7}),
              cell(U.m(r.ltCmv),{align:'right',fontSize:7}),
              cell(gm(r.ltGain),{align:'right',fontSize:7,color:(r.ltGain<0?C.red:'000000')}),
              cell(r.amtMode?'${EM}':un(r.stUnits),{align:'right',fontSize:7}),
              cell(U.m(r.stCmv),{align:'right',fontSize:7}),
              cell(gm(r.stGain),{align:'right',fontSize:7,color:(r.stGain<0?C.red:'000000')})
            ],[cell(String(r.lots),{align:'center',fontSize:7})]));
`
  },
  {
    label: 'slides: the harvest per client, the exemption line, the assumptions and the carry-forward wording (TX-08, TX-09, TX-16, TX-22)',
    from: OLD_X_HARVEST,
    to: NEW_X_HARVEST
  },

  /* ---------------- UI (11): Taxation tab ---------------- */
  {
    label: 'Taxation tab: the analyst\'s harvest assumptions are per-family state (TX-09, TX-16)',
    from: '  var taxScope=null;\n  function taxView(T){\n',
    to: '  var taxScope=null;\n' +
        '  /* TX-09, TX-16 (D-040 e, f): the analyst\'s harvest assumptions for this family, per client: the slab rate the\n' +
        '     set-off is ordered by and the Sec 198 exemption already used this tax year. Per-family state: resetFamilyState\n' +
        '     clears it (KI-001). Keys are client names, so the map has no prototype. */\n' +
        '  var taxAssume={clients:Object.create(null)};\n' +
        '  function taxView(T){\n'
  },
  {
    label: 'Taxation tab: resetFamilyState clears the assumptions (KI-001, D-015)',
    from: '    taxScope=null; __cvsAction=null; __cvsLive=null; cvsCancelRefresh();',
    to: '    taxScope=null; taxAssume={clients:Object.create(null)}; __cvsAction=null; __cvsLive=null; cvsCancelRefresh();'
  },
  {
    label: 'Taxation tab: resetFamilyState clears the window mirror',
    from: '    try{ window.__taxScope=null; window.__cvsEdited={};',
    to: '    try{ window.__taxScope=null; window.__taxAssume=null; window.__cvsEdited={};'
  },
  {
    label: 'loadModel passes the assumptions to the review',
    from: '    model=E.computeReview(currentRows,activeRef,{familyName:currentFamily,asOnDate:currentDate});\n',
    to: '    model=E.computeReview(currentRows,activeRef,{familyName:currentFamily,asOnDate:currentDate,taxAssume:taxAssume});   /* TX-09, TX-16 */\n'
  },
  {
    label: 'Taxation tab: one client\'s view carries the count of holdings with no client name',
    from: "                asOnSource:T.asOnSource, portfolioDate:T.portfolioDate, irrThrough:T.irrThrough, later:T.later,\n",
    to: "                asOnSource:T.asOnSource, portfolioDate:T.portfolioDate, irrThrough:T.irrThrough, later:T.later,\n" +
        "                unnamedN:(c.client==='(unnamed)')?T.unnamedN:0,\n"
  },
  {
    label: 'Taxation tab: "Long term after" for fund-level, pass-through and per-security rows; the not-split labels',
    from: "    if(r.alwaysShort) return 'Always short term';\n    if(r.anyPeriod) return 'Any period';\n    return 'More than '+r.months+' months'+",
    to: "    if(r.fundLevel) return 'Fund level';                  /* TX-07: Category III AIF */\n" +
        "    if(r.passThrough) return 'At AIF level, per asset';   /* TX-12: Category I and II AIF */\n" +
        "    if(r.alwaysShort) return 'Always short term';\n    if(r.anyPeriod) return 'Any period';\n" +
        "    return (r.perSecurity?'Per security, more':'More')+' than '+r.months+' months'+"
  },
  {
    label: 'Taxation tab: helpers for a holding with no investor-level split (TX-07, TX-10, TX-12)',
    from: '  function taxU(v){',
    to: String.raw`  /* TX-07, TX-10, TX-12 (D-040 d, h): a holding with no investor-level long- or short-term split */
  function taxNsLabel(k){ return k==='fundLevel'?'Fund level':'Not split'; }
  function taxNsLong(k){ return k==='fundLevel'?'Fund level: taxed inside the fund, nothing at investor level'
    :(k==='passThrough'?'Not split: passed through per underlying asset (the AIF&rsquo;s annual statement)':'Not split: taxed per security, as if held directly'); }
  function taxNsSub(r){ return (r&&r.notSplit==='pms')?'<span class="taxsub">Gain/Loss on capital contributed: not a capital-gains figure</span>':''; }
  function taxU(v){`
  },
  {
    label: 'Taxation tab: the window mirror of the assumptions',
    from: '    try{ window.__taxScope=taxScope; }catch(e){}\n',
    to: '    try{ window.__taxScope=taxScope; window.__taxAssume=taxAssume; }catch(e){}\n'
  },
  {
    label: 'Taxation tab: the six split cells, or why there is no split',
    from: "    var gcol=function(v){ return (v!=null&&v<0)?' style=\"color:#931621;\"':''; };\n",
    to: "    var gcol=function(v){ return (v!=null&&v<0)?' style=\"color:#931621;\"':''; };\n" + String.raw`    /* TX-07, TX-10, TX-12: a holding with no investor-level split says why, across the six split columns */
    var taxSplitCells=function(r){
      if(r.notSplit) return '<td class="n" colspan="6" style="text-align:center;color:#5C3E17;">'+taxNsLong(r.notSplit)+'</td>';
      return '<td class="n">'+(r.amtMode?'${EM}':taxU(r.ltUnits))+'</td><td class="n">'+U.m(r.ltCmv)+'</td><td class="n"'+gcol(r.ltGain)+'>'+gm(r.ltGain)+'</td>'+
        '<td class="n">'+(r.amtMode?'${EM}':taxU(r.stUnits))+'</td><td class="n">'+U.m(r.stCmv)+'</td><td class="n"'+gcol(r.stGain)+'>'+gm(r.stGain)+'</td>';
    };
`
  },
  {
    label: 'Taxation tab: the Total Gain/Loss tile names the fund-level part (TX-07)',
    from: "(t.lockedCmv>1e-12?' (of which ELSS in lock-in '+gm(t.lockedGain)+')':'')+(t.glMissing?",
    to: "(t.lockedCmv>1e-12?' (of which ELSS in lock-in '+gm(t.lockedGain)+')':'')+(t.fundLevelN?' &middot; Category III AIFs at fund level '+gm(t.fundLevelGain)+' on '+U.m(t.fundLevelCmv):'')+(t.glMissing?"
  },
  {
    label: 'Taxation tab: class drop-down rows, the PMS caption and the split cells',
    from: "        return '<tr><td>'+taxEsc(r.name)+'<span class=\"taxsub\">'+taxEsc(r.category||r.product)+'</span></td>'+\n" +
          "          '<td>'+taxEsc(r.client)+'</td>'+\n" +
          "          '<td class=\"n\">'+uCell+'</td>'+\n" +
          "          '<td class=\"n\">'+taxD(r.oldest)+'</td><td class=\"n\">'+taxD(r.newest)+'</td>'+\n" +
          "          '<td class=\"n\">'+(r.amtMode?'—':taxU(r.ltUnits))+'</td><td class=\"n\">'+U.m(r.ltCmv)+'</td><td class=\"n\"'+gcol(r.ltGain)+'>'+gm(r.ltGain)+'</td>'+\n" +
          "          '<td class=\"n\">'+(r.amtMode?'—':taxU(r.stUnits))+'</td><td class=\"n\">'+U.m(r.stCmv)+'</td><td class=\"n\"'+gcol(r.stGain)+'>'+gm(r.stGain)+'</td>'+\n",
    to: "        return '<tr><td>'+taxEsc(r.name)+'<span class=\"taxsub\">'+taxEsc(r.category||r.product)+'</span>'+taxNsSub(r)+'</td>'+\n" +
        "          '<td>'+taxEsc(r.client)+'</td>'+\n" +
        "          '<td class=\"n\">'+uCell+'</td>'+\n" +
        "          '<td class=\"n\">'+taxD(r.oldest)+'</td><td class=\"n\">'+taxD(r.newest)+'</td>'+\n" +
        "          taxSplitCells(r)+\n"
  },
  {
    label: 'Taxation tab: class rows show Not split or Fund level in the long- and short-term cells',
    from: "        '<td class=\"n\"'+gcol(g.ltGain)+'>'+gm(g.ltGain)+'</td><td class=\"n\"'+gcol(g.stGain)+'>'+gm(g.stGain)+'</td>'+\n",
    to: "        (g.notSplit?('<td class=\"n\" style=\"color:#5C3E17;\">'+taxNsLabel(g.notSplit)+'</td><td class=\"n\" style=\"color:#5C3E17;\">'+taxNsLabel(g.notSplit)+'</td>')\n" +
        "          :('<td class=\"n\"'+gcol(g.ltGain)+'>'+gm(g.ltGain)+'</td><td class=\"n\"'+gcol(g.stGain)+'>'+gm(g.stGain)+'</td>'))+\n"
  },
  {
    label: 'Taxation tab: by-holding rows, the PMS caption and the split cells',
    from: String.raw`      return '<tr><td>'+taxEsc(r.name)+'<span class="taxsub">'+taxEsc(r.cls)+'</span></td>'+
        '<td>'+taxEsc(r.client)+'</td>'+
        '<td class="n">'+(r.amtMode?'${EM}':taxU(r.baseUnits))+'</td>'+
        '<td class="n">'+(r.amtMode?'${EM}':taxU(r.ltUnits))+'</td><td class="n">'+U.m(r.ltCmv)+'</td><td class="n"'+gcol(r.ltGain)+'>'+gm(r.ltGain)+'</td>'+
        '<td class="n">'+(r.amtMode?'${EM}':taxU(r.stUnits))+'</td><td class="n">'+U.m(r.stCmv)+'</td><td class="n"'+gcol(r.stGain)+'>'+gm(r.stGain)+'</td>'+
`,
    to: String.raw`      return '<tr><td>'+taxEsc(r.name)+'<span class="taxsub">'+taxEsc(r.cls)+'</span>'+taxNsSub(r)+'</td>'+
        '<td>'+taxEsc(r.client)+'</td>'+
        '<td class="n">'+(r.amtMode?'${EM}':taxU(r.baseUnits))+'</td>'+
        taxSplitCells(r)+
`
  },
  {
    label: 'Taxation tab: roll-ups get a Fund level column when a Category III AIF is held (TX-07)',
    from: '    var rollTbl=function(title,arr){\n',
    to: '    var _fl=!!t.fundLevelN;   /* TX-07: Category III AIFs, taxed at fund level, have their own column */\n    var rollTbl=function(title,arr){\n'
  },
  {
    label: 'Taxation tab: roll-up rows',
    from: "          '<td class=\"n\"'+gcol(g.unclassGain)+'>'+gm(g.unclassGain)+'</td>'+\n" +
          "          '<td class=\"n\"'+gcol(g.gl)+'>'+gm(g.gl)+'</td></tr>';\n",
    to: "          '<td class=\"n\"'+gcol(g.unclassGain)+'>'+gm(g.unclassGain)+'</td>'+\n" +
        "          (_fl?'<td class=\"n\"'+gcol(g.fundGain)+'>'+gm(g.fundGain)+'</td>':'')+\n" +
        "          '<td class=\"n\"'+gcol(g.gl)+'>'+gm(g.gl)+'</td></tr>';\n"
  },
  {
    label: 'Taxation tab: roll-up header',
    from: "        '<th class=\"n\">Unclassified</th><th class=\"n\">Total G/L</th></tr></thead><tbody>'+body+'</tbody></table></div></div>';\n",
    to: "        '<th class=\"n\">Unclassified</th>'+(_fl?'<th class=\"n\">Fund level</th>':'')+'<th class=\"n\">Total G/L</th></tr></thead><tbody>'+body+'</tbody></table></div></div>';\n"
  },
  {
    label: 'Taxation tab: grand total header',
    from: "        '<th class=\"n\">STCG G/L</th><th class=\"n\">Unclassified</th><th class=\"n\">Total G/L</th></tr></thead>'+\n",
    to: "        '<th class=\"n\">STCG G/L</th><th class=\"n\">Unclassified</th>'+(_fl?'<th class=\"n\">Fund level</th>':'')+'<th class=\"n\">Total G/L</th></tr></thead>'+\n"
  },
  {
    label: 'Taxation tab: grand total row',
    from: "        '<td class=\"n\"'+gcol(t.unclassGain)+'>'+gm(t.unclassGain)+'</td>'+\n" +
          "        '<td class=\"n\"'+gcol(t.gl)+'>'+gm(t.gl)+'</td></tr></tbody></table></div>'+\n",
    to: "        '<td class=\"n\"'+gcol(t.unclassGain)+'>'+gm(t.unclassGain)+'</td>'+\n" +
        "        (_fl?'<td class=\"n\"'+gcol(t.fundLevelGain)+'>'+gm(t.fundLevelGain)+'</td>':'')+\n" +
        "        '<td class=\"n\"'+gcol(t.gl)+'>'+gm(t.gl)+'</td></tr></tbody></table></div>'+\n"
  },
  {
    label: 'Taxation tab: the harvest per client, the assumptions, the exemption line, the notes (TX-07 to TX-10, TX-12, TX-16, TX-22, TX-23)',
    from: OLD_UI_HARVEST,
    to: NEW_UI_HARVEST
  },
  {
    label: 'Taxation tab: the method sentence names the words used as rates and the holdings not split',
    from: "        'Rates shown as words (Slab rate, Fund-level) are stated that way in the tax-rules file and depend on the assessee or the fund&rsquo;s own filing.</div>'+\n",
    to: "        'Rates shown as words (Slab rate, Fund-level, Pass-through) are stated that way in the tax-rules file and depend on the assessee or the fund&rsquo;s own filing.'+\n" +
        "        (_nsp.length?' PMS and AIF holdings are not split by these lots; the notes below say why.':'')+'</div>'+\n"
  },
  {
    label: 'Taxation tab: the not-split and source notes rendered after the date notes',
    from: '      dateNote+specNote+gfNote+\n',
    to: '      dateNote+specNote+gfNote+nsNote+srcNote+\n'
  },
  {
    label: 'Taxation tab: an assumption changed works every client\'s harvest out again (TX-09, TX-16)',
    from: "    Array.prototype.forEach.call(s.querySelectorAll('.taxscope button'),function(b){\n" +
          "      b.onclick=function(){ taxScope=b.getAttribute('data-sc')||null; renderTaxation(); };\n" +
          "    });\n",
    to: "    Array.prototype.forEach.call(s.querySelectorAll('.taxscope button'),function(b){\n" +
        "      b.onclick=function(){ taxScope=b.getAttribute('data-sc')||null; renderTaxation(); };\n" +
        "    });\n" + String.raw`    /* TX-09, TX-16 (D-040 e, f): the analyst's assumptions; blank (or not a number) restores the default */
    Array.prototype.forEach.call(s.querySelectorAll('input.taxas'),function(inp){
      inp.onchange=function(){
        var c=asClients[+inp.getAttribute('data-ci')], k=inp.getAttribute('data-k');
        if(c==null||(k!=='slabPct'&&k!=='usedRs')) return;
        var v=String(inp.value==null?'':inp.value).trim();
        var A=Object.prototype.hasOwnProperty.call(taxAssume.clients,c)?taxAssume.clients[c]:(taxAssume.clients[c]={});
        if(v===''||!isFinite(Number(v))) delete A[k]; else A[k]=Number(v);
        try{ E.taxApplyAssumptions(model.taxation, taxAssume); }catch(e){ console.error(e); }
        renderTaxation();
      };
    });
`
  }
]));
