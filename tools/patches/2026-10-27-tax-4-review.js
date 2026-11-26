/* ============================================================================
   2026-10-27 — tax batch, part T4: the financial re-review of part T3
   (CR-0008; decision D-040; Tax Reckoner TY 2026-27, law as on 19 Oct 2026).
   Edits the reference data (TAX_RULES), the engine script (07_engine.js), the
   exporters script (08_exporters.js) and the UI script (11_app_ui.js). Applies
   after 2026-10-27-tax-3-harvest.js.

   Fixed here (the re-review's finding F1, P2, on KI-182 / TX-23 and KI-175 / TX-16):
     Crypto set-off. Part T3 left crypto gains in the short-term pools at 30%, so a loss went
     to a crypto gain first (ranked above the 20% and 12.5% gains) and a crypto loss reduced
     other gains or showed as carry-forward, although whether set-off is allowed either way is
     the owner's open question (CR-0008 question 18; the reckoner is silent, and Sec 115BBH of
     the 1961 Act allowed none). Until the owner answers with an approved source the page
     takes the safe behaviour:
       - the Crypto row carries "noSetOff" and the basis in "noSetOffSource";
       - taxBuildHarvest gives a noSetOff pool no set-off slot, so no loss is set against a
         crypto gain and its tax is the same before and after; a crypto holding's own loss is
         kept out of the loss pools (ltLosses, stLosses), so it reduces no other gain and is
         never shown as carried forward; it is counted in noSetOffLoss (the crypto gain in
         noSetOffGain), and both are summed for the family like every other harvest figure;
       - a crypto holding at a loss is not a harvest candidate (selling it saves no tax here);
       - one sentence on the tab's harvest card and on the harvest slide says so.
     A book with no crypto is unchanged.

     node tools/patches/2026-10-27-tax-4-review.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

/* the Crypto row as part T3 wrote it (tools/patches/2026-10-27-tax-3-harvest.js, CRYPTO_SOURCE) */
const CRYPTO_SOURCE = 'Not in the Tax Reckoner TY 2026-27, which has no row for virtual digital assets. The 30% rate for any holding period is kept because the law is unchanged; for the owner to confirm.';
const NO_SET_OFF_SOURCE = 'No set-off either way until the owner rules (CR-0008, question 18): the Tax Reckoner TY 2026-27 is silent on virtual digital assets, and Sec 115BBH of the 1961 Act allowed no loss to be set against a crypto gain and no crypto loss to be set against other income or carried forward.';

applyPatch('2026-10-27 tax batch T4: crypto kept out of set-off (re-review F1; CR-0008, D-040)', [

  /* ---------------- reference data: TAX_RULES ---------------- */
  {
    label: 'TAX_RULES: the Crypto row is kept out of set-off, with the basis in the row (TX-23)',
    from: '{"inst":"Crypto","months":null,"anyPeriod":true,"source":"' + CRYPTO_SOURCE + '",',
    to: '{"inst":"Crypto","months":null,"anyPeriod":true,"source":"' + CRYPTO_SOURCE + '","noSetOff":true,"noSetOffSource":"' + NO_SET_OFF_SOURCE + '",'
  },

  /* ---------------- engine (07): taxBuildHarvest ---------------- */
  {
    label: 'engine: the harvest header names the crypto rule (TX-23)',
    from: '       term before long term, then by class name), never by the size of a holding.\n' +
          '     ========================================================================= */\n' +
          '  var TAX_S198_EXEMPT_RS=125000;\n',
    to: '       term before long term, then by class name), never by the size of a holding.\n' +
        '     TX-23 (KI-182; the re-review of part T3): a row marked noSetOff (Crypto) is kept out of set-off\n' +
        '       until the owner rules (CR-0008 question 18): no loss is set against its gain, which is taxed\n' +
        '       in full before and after, and its own loss reduces no other gain and is not carried forward.\n' +
        '     ========================================================================= */\n' +
        '  var TAX_S198_EXEMPT_RS=125000;\n'
  },
  {
    label: 'engine: a noSetOff pool is marked; its loss stays out of the loss pools and is counted on its own (TX-23)',
    from: String.raw`    var pools=[], ltLoss=0, stLoss=0;
    (byClass||[]).forEach(function(g){
      /* a class with no investor-level split (g.notSplit: TX-07, TX-10, TX-12) has no gain or loss
         here: summarise never pools its records */
      var lt=(g.rule&&g.rule.lt)||{}, st=(g.rule&&g.rule.st)||{};
      var lr=(lt.rate!=null)?lt.rate:null, sr=(st.rate!=null)?st.rate:null;
      if(g.ltPos>1e-9) pools.push({b:'LT',cls:g.cls,client:client,gross:g.ltPos,left:g.ltPos,rate:lr,label:lt.label||'',s198:!!(g.rule&&g.rule.sec198)});
      if(g.stPos>1e-9) pools.push({b:'ST',cls:g.cls,client:client,gross:g.stPos,left:g.stPos,rate:sr,label:st.label||'',s198:false});
      ltLoss+=g.ltNeg; stLoss+=g.stNeg;
    });
`,
    to: String.raw`    var pools=[], ltLoss=0, stLoss=0, nsoGain=0, nsoLoss=0;
    (byClass||[]).forEach(function(g){
      /* a class with no investor-level split (g.notSplit: TX-07, TX-10, TX-12) has no gain or loss
         here: summarise never pools its records */
      var lt=(g.rule&&g.rule.lt)||{}, st=(g.rule&&g.rule.st)||{};
      var lr=(lt.rate!=null)?lt.rate:null, sr=(st.rate!=null)?st.rate:null;
      /* TX-23: a noSetOff row (Crypto) keeps its gain pool, taxed in full, and its loss out of set-off */
      var nso=!!(g.rule&&g.rule.noSetOff);
      if(g.ltPos>1e-9) pools.push({b:'LT',cls:g.cls,client:client,gross:g.ltPos,left:g.ltPos,rate:lr,label:lt.label||'',s198:!!(g.rule&&g.rule.sec198),noSetOff:nso});
      if(g.stPos>1e-9) pools.push({b:'ST',cls:g.cls,client:client,gross:g.stPos,left:g.stPos,rate:sr,label:st.label||'',s198:false,noSetOff:nso});
      if(nso){ nsoGain+=g.ltPos+g.stPos; nsoLoss+=g.ltNeg+g.stNeg; return; }
      ltLoss+=g.ltNeg; stLoss+=g.stNeg;
    });
`
  },
  {
    label: 'engine: a noSetOff pool gets no set-off slot, so no loss reaches it (TX-23)',
    from: String.raw`    pools.forEach(function(p){ if(!(p.b==='LT'&&p.s198)) slots.push(`,
    to: String.raw`    pools.forEach(function(p){ if(!(p.b==='LT'&&p.s198)&&!p.noSetOff) slots.push(`
  },
  {
    label: 'engine: the harvest reports the noSetOff gain and loss; a noSetOff holding is not a candidate (TX-23)',
    from: String.raw`      slabSheltered:slabP.reduce(function(s,p){return s+(p.gross-p.left);},0),
      candidates:(positions||[]).filter(function(r){
          return !r.notSplit && ((r.ltGain!=null&&r.ltGain<0)||(r.stGain!=null&&r.stGain<0)); })
`,
    to: String.raw`      slabSheltered:slabP.reduce(function(s,p){return s+(p.gross-p.left);},0),
      noSetOffGain:nsoGain, noSetOffLoss:nsoLoss,   /* TX-23: Crypto, kept out of set-off */
      /* a holding at a loss in a noSetOff class (Crypto) is not a candidate: selling it saves no tax here */
      candidates:(positions||[]).filter(function(r){
          return !r.notSplit && !(r.rule&&r.rule.noSetOff) && ((r.ltGain!=null&&r.ltGain<0)||(r.stGain!=null&&r.stGain<0)); })
`
  },
  {
    label: 'engine: the family harvest sums the noSetOff gain and loss too (TX-08, TX-23)',
    from: "    'unquantifiedPools','unquantifiedGain','slabSheltered','s198Gains','s198Left','exBefore','exAfter','exBeforeTax','exAfterTax'];\n",
    to: "    'unquantifiedPools','unquantifiedGain','slabSheltered','s198Gains','s198Left','exBefore','exAfter','exBeforeTax','exAfterTax',\n" +
        "    'noSetOffGain','noSetOffLoss'];\n"
  },

  /* ---------------- UI (11): the harvest card ---------------- */
  {
    label: 'Taxation tab: a crypto loss alone still shows the harvest card, to say it is kept out (TX-23)',
    from: "    var H=T.harvest||null, harvestHtml='', asClients=[];\n" +
          "    if(H && (H.ltGains+H.stGains>1e-9 || H.ltLosses>1e-9 || H.stLosses>1e-9)){\n",
    to: "    var H=T.harvest||null, harvestHtml='', asClients=[];\n" +
        "    if(H && (H.ltGains+H.stGains>1e-9 || H.ltLosses>1e-9 || H.stLosses>1e-9 || H.noSetOffLoss>1e-9)){\n"
  },
  {
    label: 'Taxation tab: the sentence on crypto and set-off (TX-23)',
    from: String.raw`      var unnNote=T.unnamedN?('<div class="sub" style="margin-top:6px;">'+_pl(T.unnamedN,'holding has','holdings have')+' no client name; they are treated as one person for the set-off and the exemption.</div>'):'';
`,
    to: String.raw`      var unnNote=T.unnamedN?('<div class="sub" style="margin-top:6px;">'+_pl(T.unnamedN,'holding has','holdings have')+' no client name; they are treated as one person for the set-off and the exemption.</div>'):'';
      /* TX-23 (KI-182; CR-0008 question 18): the Crypto row is kept out of set-off until the owner rules */
      var nsoNote=(H.noSetOffGain>1e-9||H.noSetOffLoss>1e-9)?('<div class="taxwarn" style="margin-top:10px;">Crypto gains and losses are kept out of set-off pending the owner&rsquo;s ruling, as the reckoner is silent on them: '+
        'no loss is set against a crypto gain'+(H.noSetOffGain>1e-9?' ('+U.m(H.noSetOffGain)+', taxed in full before and after)':'')+
        ', and a crypto loss'+(H.noSetOffLoss>1e-9?' ('+U.m(H.noSetOffLoss)+')':'')+' reduces no other gain, is not carried forward and is not listed as a holding to sell.</div>'):'';
`
  },
  {
    label: 'Taxation tab: the crypto sentence rendered before the holdings left out',
    from: '        loNote+unnNote+\n',
    to: '        nsoNote+loNote+unnNote+\n'
  },

  /* ---------------- exporters (08): the harvest slide ---------------- */
  {
    label: 'harvest slide: a crypto loss alone still makes the slide, to say it is kept out (TX-23)',
    from: '      if(H && (H.ltGains+H.stGains>1e-9 || H.ltLosses>1e-9 || H.stLosses>1e-9)){\n' +
          '        var s2=base("Tax Harvesting"+_scopeTag);\n',
    to: '      if(H && (H.ltGains+H.stGains>1e-9 || H.ltLosses>1e-9 || H.stLosses>1e-9 || H.noSetOffLoss>1e-9)){\n' +
        '        var s2=base("Tax Harvesting"+_scopeTag);\n'
  },
  {
    label: 'harvest slide: the sentence on crypto and set-off (TX-23)',
    from: "        var _lo=[];\n        if(_ns.pms.n) _lo.push(_ns.pms.n+' PMS');\n",
    to: "        /* TX-23 (KI-182; CR-0008 question 18): the Crypto row is kept out of set-off until a ruling */\n" +
        "        if(H.noSetOffGain>1e-9||H.noSetOffLoss>1e-9) nt.push('Crypto gains and losses are kept out of set-off pending a ruling on their treatment: no loss is set against a crypto gain'+\n" +
        "          (H.noSetOffGain>1e-9?(' ('+U.m(H.noSetOffGain)+', taxed in full)'):'')+', and a crypto loss'+(H.noSetOffLoss>1e-9?(' ('+U.m(H.noSetOffLoss)+')'):'')+' reduces no other gain and is not carried forward.');\n" +
        "        var _lo=[];\n        if(_ns.pms.n) _lo.push(_ns.pms.n+' PMS');\n"
  }
]);
