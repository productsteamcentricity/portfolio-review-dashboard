/* ============================================================================
   2026-10-19 — Fix batch 1b: blank invested value (KI-007) and the client-sheet
   IRR join (KI-048, with KI-100). Audit of 19 Oct 2026, CR-0005.
   Revised after the financial review (round 2).

   KI-007  A blank Invested Value was stored as 0 (parseBaseRows: invCr: _inv||0).
           The holding showed 0.00 invested, the review's Total Gain/Loss
           (CMV - invested) counted its whole market value as gain, and Taxation
           treated it as all gain with glMissing = 0, so nothing warned.
           Now:
           - invCr stays null when the cell is blank; merging duplicate folios
             leaves the merged holding without an invested value when any folio
             has none (and its invR blank with it).
           - Invested value and gain/loss are totalled only over the holdings that
             have an invested value: the review totals (Total Gain/Loss = CMV -
             invested over those holdings; the gain/loss definitions themselves are
             unchanged, OD-18 is pending), the Asset Allocation rows and the client
             sheets' asset / product / grand-total rows. A sum with no invested
             value at all is null ("—"), never 0.
           - Every aggregate carries invMissing (the count); each client and the
             review carry invNote, a footnote marked ‡ naming the count and the
             share of CMV, when invMissing > 0.
           - Taxation needs no engine change: with invCr null its existing
             glMissing path runs (gain unknown, not the whole CMV). Its Total
             Gain/Loss KPI names the count, and the totals (deck slide and tab)
             say the G/L columns leave those holdings out.
           - AI Analyst: a merged position with a member without an invested value
             has none (null, never a partial sum or 0); recs report inv null.
           - Displays: "—" for a missing invested value; partial subtotals marked ‡
             on the Holdings tab (invested, gain/loss, absolute return), the Asset
             Allocation tab and their slides; the footnote in the sub-lines, slide
             footers and the workbook (client sheets, Asset Allocation sheet); the
             workbook writes "—" for a null invested value / gain-loss, as the Fund
             IRR sheet already does for blanks. The Rebalancing Holding Sheet shows
             "—" for the holding and its note names the count (screen and slide
             share that note).
   KI-048  (audit NEW-2) The client sheets' asset / product XIRR and BMXIRR grouped
           IRR flows by the IRR file's own ASSET CLASS / PRODUCT labels (caV /
           capV), while computeIRRtree joins by client + instrument. A benchmark
           sheet labelled all "Equity", "Mutual Fund" vs "Mutual Funds", or
           "EQUITY" gave wrong figures or fell back silently to CMV weighting, and
           contradicted the workbook's Fund IRR sheet. Now each asset / product
           subtotal is the XIRR / BMXIRR of the flows of the IRR instruments in
           that bucket, each once:
           - those the client's own base holdings in the bucket resolve to (the
             matchInstrument join irrInstr uses), whatever the IRR file's labels;
           - plus the client's IRR instruments that no holding resolves to (fully
             redeemed, or a name matchInstrument cannot resolve), placed by the IRR
             file's own SI Xirr asset / product labels normalised to the sheet's
             rows (case, spacing, punctuation, singular / plural). This keeps the
             since-inception scope the sheets had before the fix and that the
             Grand Total and the Fund IRR sheet use (OD-4 is not decided here).
             Their benchmark joins by client + instrument. An instrument that
             cannot be placed (blank, conflicting or unmatched label) stays in the
             Grand Total and is counted in the § note with its rupee flows.
           caV / capV are removed. When the client has no IRR transactions at all,
           its sheet keeps the CMV-weighted base-file path as before (now
           footnoted §). When it has transactions, every subtotal is transaction-
           based: one with no instrument, or whose flows give no rate, is blank,
           never a base-file fall-back. The client's § note says, case by case,
           what the transaction figures include beyond its holdings and what is
           blank: instruments included by label (count and ₹ flows), instruments
           that could not be placed, benchmark series without fund flows,
           holdings with no transactions / matching no instrument, subtotals with
           no instrument or no rate, holdings whose rates cannot be computed.
           Where the base file's and the IRR file's labels coincide, every client-
           sheet asset / product / grand-total row equals its Fund IRR sheet row.
   KI-100  Falls out of the same join: a holding that resolves to IRR transactions
           now takes its transaction XIRR / BMXIRR even when the flows give no rate
           (blank, counted in the § note), instead of keeping the base file's
           figure under the "transaction-based" caption. A holding with no
           transactions in the IRR file keeps the base file's figures, and the §
           note says so with the count and share of CMV.
           Note (KI-031, unchanged): the override still writes to the parsed rows,
           so after the IRR upload is cleared, holdings keep the transaction
           figures (and now the blanks) until the page is reloaded.
   Deck    The holdings slides' †, ‡ and § notes get room: with any note, the
           footer caption and the notes share one bottom-anchored box sized to
           their text, and the page carries fewer rows so the table stops above it.
           Without notes the calibrated layout (13 rows, one-line footer) is
           unchanged.

     node tools/patches/2026-10-19-invested-and-irr-join.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

/* verbatim text: what is typed here is what goes into index.html (JS escapes such as
   \u0001 stay as escapes in the shipped source); CRLF from an editor is normalised */
const L = (s, ...v) => String.raw(s, ...v).replace(/\r\n/g, '\n');

applyPatch('Fix batch 1b: blank invested value (KI-007), client-sheet IRR join (KI-048, KI-100)', [
  /* ======================= engine (07) — KI-007 ======================= */
  {
    label: 'KI-007 parse: a blank invested value stays null',
    from: L`        invCr: _inv||0,`,
    to: L`        invCr: _inv,   /* KI-007: a blank invested value stays blank (null), never 0 */`
  },
  {
    label: 'KI-007 merge: a folio without an invested value leaves the merged holding without one',
    from: L`        m.invCr=(m.invCr||0)+(h.invCr||0);`,
    to: L`        m.invCr=(m.invCr==null||h.invCr==null)?null:(m.invCr+h.invCr);   /* KI-007: one folio without an invested value leaves the merged holding without one */`
  },
  {
    label: 'KI-007 merge: the rupee invested value follows',
    from: L`        if(h.invR!=null) m.invR=(m.invR||0)+(h.invR||0);`,
    to: L`        if(m.invCr==null) m.invR=null; else if(h.invR!=null) m.invR=(m.invR||0)+(h.invR||0);`
  },
  {
    label: 'KI-007 review totals: invested over the holdings that have one, with a count',
    from: L`    var totalCMV=0, totalInv=0;
    rows.forEach(function(h){ totalCMV+=h.cmvCr; totalInv+=h.invCr; });`,
    to: L`    /* KI-007: invested value (and so Total Gain/Loss = CMV - invested) is totalled only over the
       holdings that have an invested value; the others are counted and footnoted, never added as 0 */
    var totalCMV=0, totalInv=0, invCmv=0, invMissing=0;
    rows.forEach(function(h){ totalCMV+=h.cmvCr; if(h.invCr!=null){ totalInv+=h.invCr; invCmv+=h.cmvCr; } else invMissing++; });`
  },
  {
    label: 'KI-007 asset allocation: sums skip a blank invested value and count it',
    from: L`      var A=aMap[a]||(aMap[a]={inv:0,cmv:0,prods:{}});
      A.inv+=h.invCr; A.cmv+=h.cmvCr;
      var P=A.prods[p]||(A.prods[p]={inv:0,cmv:0}); P.inv+=h.invCr; P.cmv+=h.cmvCr;`,
    to: L`      var A=aMap[a]||(aMap[a]={inv:0,cmv:0,ni:0,im:0,prods:{}});
      var P=A.prods[p]||(A.prods[p]={inv:0,cmv:0,ni:0,im:0});
      A.cmv+=h.cmvCr; P.cmv+=h.cmvCr;
      /* KI-007: a blank invested value is left out of the sums and counted */
      if(h.invCr!=null){ A.inv+=h.invCr; A.ni++; P.inv+=h.invCr; P.ni++; } else { A.im++; P.im++; }`
  },
  {
    label: 'KI-007 asset allocation: asset row',
    from: L`        aaRows.push({level:"asset",label:a,inv:A.inv,cmv:A.cmv,pct:A.cmv/totalCMV*100});`,
    to: L`        aaRows.push({level:"asset",label:a,inv:A.ni?A.inv:null,cmv:A.cmv,pct:A.cmv/totalCMV*100,invMissing:A.im});`
  },
  {
    label: 'KI-007 asset allocation: product row',
    from: L`          aaRows.push({level:"product",label:p,inv:P.inv,cmv:P.cmv,pct:P.cmv/totalCMV*100});`,
    to: L`          aaRows.push({level:"product",label:p,inv:P.ni?P.inv:null,cmv:P.cmv,pct:P.cmv/totalCMV*100,invMissing:P.im});`
  },
  {
    label: 'KI-007 asset allocation: grand total',
    from: L`    aaRows.push({level:"grand",label:"Grand Total",inv:totalInv,cmv:totalCMV,pct:100});`,
    to: L`    aaRows.push({level:"grand",label:"Grand Total",inv:(rows.length>invMissing)?totalInv:null,cmv:totalCMV,pct:100,invMissing:invMissing});`
  },
  {
    label: 'KI-048 the display unit is set before the client sheets (their § note quotes rupee flows)',
    from: L`    /* ---- PER-CLIENT HOLDING SHEETS ---- */`,
    to: L`    var _uh = (opts && opts.unitHint) || (rows && rows.unitHint) || _unitHint || 'Cr';   /* KI-048: set here, before the client sheets, whose § note quotes rupee flows */
    if (_uh==='auto') _uh = (totalCMV>=1) ? 'Cr' : 'L';   // raw-rupee-only files: pick by portfolio size
    var unit = mkUnit(_uh);

    /* ---- PER-CLIENT HOLDING SHEETS ---- */`
  },
  {
    label: 'KI-048 the display unit: its old place, after the allocation breakdowns',
    from: L`    var _uh = (opts && opts.unitHint) || (rows && rows.unitHint) || _unitHint || 'Cr';
    if (_uh==='auto') _uh = (totalCMV>=1) ? 'Cr' : 'L';   // raw-rupee-only files: pick by portfolio size
    var unit = mkUnit(_uh);
    return {`,
    to: L`    /* unit (the display unit) is set before the client sheets (KI-048) */
    return {`
  },
  {
    label: 'KI-007 per-client map: invested and gain/loss over the holdings that have an invested value',
    from: L`    rows.forEach(function(h){ var c=ws(h.client)||"—"; if(!cmap[c]){cmap[c]={cmv:0,inv:0,rows:[]}; clientNames.push(c);} cmap[c].cmv+=h.cmvCr; cmap[c].inv+=h.invCr; cmap[c].rows.push(h); });`,
    to: L`    rows.forEach(function(h){ var c=ws(h.client)||"—"; if(!cmap[c]){cmap[c]={cmv:0,inv:0,gl:0,icmv:0,ni:0,im:0,rows:[]}; clientNames.push(c);} cmap[c].cmv+=h.cmvCr;
      /* KI-007: invested value and gain/loss only over the holdings that have an invested value */
      if(h.invCr!=null){ cmap[c].inv+=h.invCr; cmap[c].gl+=(h.glCr||0); cmap[c].icmv+=h.cmvCr; cmap[c].ni++; } else cmap[c].im++;
      cmap[c].rows.push(h); });`
  },
  {
    label: 'KI-007 client sheet: asset accumulator (and the holdings in the bucket, for KI-048)',
    from: L`        var A=aM[a]||(aM[a]={inv:0,cmv:0,gl:0,wx:0,wb:0,cx:0,cb:0,prods:{}});
        A.inv+=h.invCr; A.cmv+=h.cmvCr; A.gl+=(h.glCr||0);`,
    to: L`        var A=aM[a]||(aM[a]={inv:0,cmv:0,gl:0,ni:0,im:0,wx:0,wb:0,cx:0,cb:0,prods:{},hs:[]});
        /* KI-007: invested value and gain/loss are summed only over holdings that have an invested value */
        A.cmv+=h.cmvCr; A.hs.push(h); if(h.invCr!=null){ A.inv+=h.invCr; A.gl+=(h.glCr||0); A.ni++; } else A.im++;`
  },
  {
    label: 'KI-007 client sheet: product accumulator',
    from: L`        var P=A.prods[p]||(A.prods[p]={inv:0,cmv:0,gl:0,wx:0,wb:0,cx:0,cb:0,items:[]});
        P.inv+=h.invCr; P.cmv+=h.cmvCr; P.gl+=(h.glCr||0);`,
    to: L`        var P=A.prods[p]||(A.prods[p]={inv:0,cmv:0,gl:0,ni:0,im:0,wx:0,wb:0,cx:0,cb:0,items:[]});
        P.cmv+=h.cmvCr; if(h.invCr!=null){ P.inv+=h.invCr; P.gl+=(h.glCr||0); P.ni++; } else P.im++;`
  },
  {
    label: 'KI-048 client sheet: place the instruments no holding resolves to; count blank subtotals by cause',
    from: L`      var outRows=[]; var gx=0, gb=0, gcx=0, gcb=0;`,
    to: L`      var outRows=[]; var gx=0, gb=0, gcx=0, gcb=0, irrNone=0, irrNoRate=0, irrGBlank=false;
      /* KI-048: this client's IRR instruments that none of its holdings resolves to, placed by the IRR file's labels */
      var _px=irrPlace(cn,C2.rows,aM);`
  },

  /* ======================= engine (07) — KI-048 / KI-100 ======================= */
  {
    label: 'KI-048 irrPlace defaults to nothing when no IRR file is loaded',
    from: L`    var irrAgg=function(){return null;}, irrCli=function(){return null;}, irrInstr=function(){return null;};`,
    to: L`    var irrAgg=function(){return null;}, irrCli=function(){return null;}, irrInstr=function(){return null;}, irrPlace=function(){return null;};   /* irrPlace: KI-048 */`
  },
  {
    label: 'KI-048 IRR flows keyed by client + instrument only (the label-keyed caV / capV go)',
    from: L`      var caV =mapx(grp(_F,function(t){return nc(t.client)+"||"+(t.asset||"");}), grp(_B,function(t){return nc(t.client)+"||"+(t.asset||"");}));
      var capV=mapx(grp(_F,function(t){return nc(t.client)+"||"+(t.asset||"")+"||"+(t.product||"");}), grp(_B,function(t){return nc(t.client)+"||"+(t.asset||"")+"||"+(t.product||"");}));
      var ciV =mapx(grp(_F,function(t){return nc(t.client)+"||"+t.instrument;}), grp(_B,function(t){return nc(t.client)+"||"+t.instrument;}));`,
    to: L`      /* KI-048: the client sheets' asset / product subtotals are no longer grouped by the IRR file's own
         ASSET CLASS / PRODUCT labels, which need not match the base file or each other (an SI Bmxirr
         sheet labelled all "Equity", "Mutual Fund" vs "Mutual Funds", "EQUITY"). Flows are keyed by
         client + instrument only, the join computeIRRtree uses, and irrAgg below builds each subtotal
         from the instruments in that bucket. */
      var gFi=grp(_F,function(t){return nc(t.client)+"||"+t.instrument;}), gBi=grp(_B,function(t){return nc(t.client)+"||"+t.instrument;});
      var ciV =mapx(gFi,gBi);`
  },
  {
    label: 'KI-048 one holding -> IRR instrument join; subtotals over a bucket\'s instruments; placement by label',
    from: L`      irrInstr=function(h){ var rc=resolveClient(h.client); if(!rc)return null;
        var names=instrCache[rc]||(instrCache[rc]=Object.keys(cliInstr[rc]));
        var mi=matchInstrument(h.name,h.amc,names); if(!mi)return null; return ciV[rc+"||"+mi]||null; };
      irrAgg=function(cn,a,p){ var rc=resolveClient(cn); if(!rc)return null; var key=rc+"||"+(a||"")+(p!=null?"||"+p:""); return (p!=null?capV:caV)[key]||null; };`,
    to: L`      var keyMemo={};
      var irrKey=function(h){ var mk=String(h.client)+"\u0001"+h.name+"\u0001"+(h.amc||""); if(mk in keyMemo) return keyMemo[mk];
        var rc=resolveClient(h.client), mi=null;
        if(rc){ var names=instrCache[rc]||(instrCache[rc]=Object.keys(cliInstr[rc])); mi=matchInstrument(h.name,h.amc,names); }
        return (keyMemo[mk]=mi?rc+"||"+mi:null); };
      irrInstr=function(h){ var k=irrKey(h); return k?(ciV[k]||null):null; };
      /* KI-048: null when the client has no IRR transactions (its sheet keeps the CMV-weighted base-file
         figures); otherwise the XIRR / BMXIRR of the flows of every IRR instrument in the bucket, each once:
         those its holdings (hs) resolve to, and those irrPlace put there by label (xk). Blank when there is
         none or the flows give no rate (KI-100), never a fall-back to the base file. */
      irrAgg=function(cn,hs,xk){ var rc=resolveClient(cn); if(!rc)return null; var seen={},f=[],b=[],n=0;
        var add=function(k){ if(!k||seen[k])return; seen[k]=1; n++;
          (gFi[k]||[]).forEach(function(x){ f.push(x); }); (gBi[k]||[]).forEach(function(x){ b.push(x); }); };
        hs.forEach(function(h){ add(irrKey(h)); }); (xk||[]).forEach(add);
        return {f:n?xirr(f):null, b:b.length?xirr(b):null, n:n}; };
      /* KI-048 (the since-inception scope the sheets had before the fix; OD-4 is not decided here): a
         client's IRR instruments that none of its holdings resolves to (fully redeemed, or named so that
         matchInstrument cannot resolve them) still count in its subtotals, as they do in its Grand Total and
         on the Fund IRR sheet. They are placed by the IRR file's own SI Xirr ASSET CLASS / PRODUCT labels,
         matched to the sheet's asset / product rows exactly or, failing that, ignoring case, spacing,
         punctuation and singular / plural ("EQUITY" -> Equity, "Mutual Fund" -> Mutual Funds). An instrument
         whose label is blank, differs between its rows, or matches no row (or two) is not placed in that row
         and is counted in the client's § note with its rupee flows, never dropped silently. Its benchmark
         joins by client + instrument, as in computeIRRtree. */
      var nl=function(s){ return String(s==null?"":s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(function(w){
        return (w.length>4&&/ies$/.test(w))?w.slice(0,-3)+"y":((w.length>3&&/[^s]s$/.test(w))?w.slice(0,-1):w); }).join(" "); };
      var labs={};
      _F.forEach(function(t){ var k=nc(t.client)+"||"+t.instrument, L=labs[k]||(labs[k]={a:{},p:{}}); L.a[nl(t.asset)]=t.asset; L.p[nl(t.product)]=t.product; });
      var pickRow=function(raw,names){ var r=String(raw==null?"":raw).trim(); if(!r) return null; if(names.indexOf(r)>=0) return r;
        var k=nl(r), hit=names.filter(function(x){ return nl(x)===k; }); return hit.length===1?hit[0]:null; };
      irrPlace=function(cn,hs,aM){ var rc=resolveClient(cn); if(!rc) return null; var reached={};
        hs.forEach(function(h){ var k=irrKey(h); if(k) reached[k]=1; });
        var o={a:{},p:{},placed:0,aOnly:0,unplaced:0,pIn:0,pOut:0,uIn:0,uOut:0,benchOnly:0};
        Object.keys(cliInstr[rc]).forEach(function(ins){ var k=rc+"||"+ins; if(reached[k]) return;
          var L=labs[k], ak=Object.keys(L.a), pk=Object.keys(L.p), fin=0, fout=0;
          (gFi[k]||[]).forEach(function(x){ if(x.a<0) fin-=x.a; else fout+=x.a; });
          var a=(ak.length===1)?pickRow(L.a[ak[0]],Object.keys(aM)):null;
          if(a==null){ o.unplaced++; o.uIn+=fin/1e7; o.uOut+=fout/1e7; return; }
          (o.a[a]||(o.a[a]=[])).push(k); o.placed++; o.pIn+=fin/1e7; o.pOut+=fout/1e7;
          var p=(pk.length===1)?pickRow(L.p[pk[0]],Object.keys(aM[a].prods)):null;
          if(p==null){ o.aOnly++; return; }
          var ap=a+"\u0001"+p; (o.p[ap]||(o.p[ap]=[])).push(k); });
        Object.keys(gBi).forEach(function(k){ if(k.indexOf(rc+"||")===0 && !gFi[k]) o.benchOnly++; });
        return o; };`
  },
  {
    label: 'KI-100 a holding with IRR transactions takes their rates, blank when they give none',
    from: L`      rows.forEach(function(h){ var r=irrInstr(h); if(r){ if(r.f!=null)h.xirrFrac=r.f; if(r.b!=null)h.bmxirrFrac=r.b; } });`,
    to: L`      /* KI-100: a holding that resolves to IRR transactions shows their XIRR / BMXIRR, and a blank
         (footnoted on its client sheet) when they give no rate, instead of keeping the base file's figure
         under the "transaction-based" caption */
      rows.forEach(function(h){ var r=irrInstr(h); if(r){ h.xirrFrac=r.f; h.bmxirrFrac=r.b; } });`
  },
  {
    label: 'KI-048 / KI-007 client sheet: asset row',
    from: L`          var _va=irrAgg(cn,a,null);
          outRows.push({level:"asset",label:a,inv:A.inv,cmv:A.cmv,gl:A.gl,
            alloc:A.cmv/ctot*100, xirr:(_va&&_va.f!=null)?_va.f*100:(A.cx?A.wx/A.cx*100:null), bmxirr:(_va&&_va.b!=null)?_va.b*100:(A.cb?A.wb/A.cb*100:null),
            xcov:(_va&&_va.f!=null)?null:(A.cmv?A.cx/A.cmv*100:null), bcov:(_va&&_va.b!=null)?null:(A.cmv?A.cb/A.cmv*100:null)});`,
    to: L`          /* KI-048: the IRR instruments of this client's own holdings in the bucket (client + instrument join),
             plus those placed here by label; null = the client has no IRR transactions (CMV-weighted base-file
             path, as before) */
          var _va=irrAgg(cn,A.hs,_px&&_px.a[a]);
          outRows.push({level:"asset",label:a,inv:A.ni?A.inv:null,cmv:A.cmv,gl:A.ni?A.gl:null,invMissing:A.im,
            alloc:A.cmv/ctot*100, xirr:_va?(_va.f!=null?_va.f*100:null):(A.cx?A.wx/A.cx*100:null), bmxirr:_va?(_va.b!=null?_va.b*100:null):(A.cb?A.wb/A.cb*100:null),
            xcov:_va?null:(A.cmv?A.cx/A.cmv*100:null), bcov:_va?null:(A.cmv?A.cb/A.cmv*100:null)});
          if(_va){ if(!_va.n) irrNone++; else if(_va.f==null||_va.b==null) irrNoRate++; }`
  },
  {
    label: 'KI-048 / KI-007 client sheet: product row',
    from: L`            var _vp=irrAgg(cn,a,p);
            outRows.push({level:"product",label:p,inv:P.inv,cmv:P.cmv,gl:P.gl,
              alloc:P.cmv/ctot*100, xirr:(_vp&&_vp.f!=null)?_vp.f*100:(P.cx?P.wx/P.cx*100:null), bmxirr:(_vp&&_vp.b!=null)?_vp.b*100:(P.cb?P.wb/P.cb*100:null),
              xcov:(_vp&&_vp.f!=null)?null:(P.cmv?P.cx/P.cmv*100:null), bcov:(_vp&&_vp.b!=null)?null:(P.cmv?P.cb/P.cmv*100:null)});`,
    to: L`            var _vp=irrAgg(cn,P.items,_px&&_px.p[a+"\u0001"+p]);
            outRows.push({level:"product",label:p,inv:P.ni?P.inv:null,cmv:P.cmv,gl:P.ni?P.gl:null,invMissing:P.im,
              alloc:P.cmv/ctot*100, xirr:_vp?(_vp.f!=null?_vp.f*100:null):(P.cx?P.wx/P.cx*100:null), bmxirr:_vp?(_vp.b!=null?_vp.b*100:null):(P.cb?P.wb/P.cb*100:null),
              xcov:_vp?null:(P.cmv?P.cx/P.cmv*100:null), bcov:_vp?null:(P.cmv?P.cb/P.cmv*100:null)});
            if(_vp){ if(!_vp.n) irrNone++; else if(_vp.f==null||_vp.b==null) irrNoRate++; }`
  },
  {
    label: 'KI-048 / KI-007 client sheet: grand total',
    from: L`      outRows.push({level:"grand",label:"Grand Total",inv:C2.inv,cmv:ctot,gl:C2.rows.reduce(function(s,h){return s+(h.glCr||0);},0),
        alloc:100, xirr:(_vg&&_vg.f!=null)?_vg.f*100:(gcx?gx/gcx*100:null), bmxirr:(_vg&&_vg.b!=null)?_vg.b*100:(gcb?gb/gcb*100:null),
        xcov:(_vg&&_vg.f!=null)?null:(ctot?gcx/ctot*100:null), bcov:(_vg&&_vg.b!=null)?null:(ctot?gcb/ctot*100:null)});`,
    to: L`      outRows.push({level:"grand",label:"Grand Total",inv:C2.ni?C2.inv:null,cmv:ctot,gl:C2.ni?C2.gl:null,invMissing:C2.im,
        alloc:100, xirr:_vg?(_vg.f!=null?_vg.f*100:null):(gcx?gx/gcx*100:null), bmxirr:_vg?(_vg.b!=null?_vg.b*100:null):(gcb?gb/gcb*100:null),
        xcov:_vg?null:(ctot?gcx/ctot*100:null), bcov:_vg?null:(ctot?gcb/ctot*100:null)});
      if(_vg&&(_vg.f==null||_vg.b==null)) irrGBlank=true;`
  },
  {
    label: 'KI-007 / KI-048 each client carries its invested-value and IRR footnotes',
    from: L`      return {name:cn, totalCMV:ctot, totalInv:C2.inv, rows:outRows, covNote:covNote};`,
    to: L`      /* KI-007 (rule 3: a blank, a footnote and a count): holdings without an invested value */
      var _f2=function(v){ return (Math.round(v*100)/100).toFixed(2); };
      var invNote=C2.im?("‡ Invested value, gain/loss and absolute return count only the holdings that have an invested value: "+C2.im+" holding"+(C2.im>1?"s":"")+" without one ("+_f2(ctot?(ctot-C2.icmv)/ctot*100:0)+"% of CMV)."):null;
      /* KI-048 / KI-100: what the transaction-based figures include beyond the holdings, and what is blank, case by case */
      var irrNote=null;
      if(IRRO){
        if(!irrCli(cn)) irrNote="§ No transactions for this client in the IRR file: XIRR/BMXIRR are the base file's, CMV-weighted.";
        else {
          var _nu=0,_ucmv=0,_nn=0; C2.rows.forEach(function(h){ var r=irrInstr(h); if(!r){ _nu++; _ucmv+=h.cmvCr; } else if(r.f==null||r.b==null) _nn++; });
          var _x=_px||{placed:0,aOnly:0,unplaced:0,benchOnly:0}, _ext=_x.placed+_x.unplaced, _np=[];
          var _pl=function(n,one,many){ return n+" "+(n>1?many:one); };
          if(_x.placed) _np.push(_pl(_x.placed,"instrument","instruments")+" not held or not matched to a holding "+(_x.placed>1?"are":"is")+" included by the IRR file's labels ("+unit.m(_x.pIn)+" invested, "+unit.m(_x.pOut)+" redeemed or closing value"+(_x.aOnly?("; "+_x.aOnly+" in an asset subtotal only, no product row matching "+(_x.aOnly>1?"their product labels":"its product label")):"")+")");
          if(_x.unplaced) _np.push(_pl(_x.unplaced,"instrument","instruments")+" not held or not matched to a holding could not be placed in a subtotal by "+(_x.unplaced>1?"their":"its")+" labels and "+(_x.unplaced>1?"count":"counts")+" only in the Grand Total ("+unit.m(_x.uIn)+" invested, "+unit.m(_x.uOut)+" redeemed or closing value)");
          if(_x.benchOnly) _np.push(_x.benchOnly+" benchmark series with no fund transactions "+(_x.benchOnly>1?"count":"counts")+" only in the Grand Total BMXIRR");
          if(_nu) _np.push(_pl(_nu,"holding","holdings")+" ("+_f2(ctot?_ucmv/ctot*100:0)+"% of CMV) "+(_ext
            ?((_nu>1?"match":"matches")+" no instrument in the IRR file and "+(_nu>1?"show":"shows")+" the base file's XIRR/BMXIRR; any transactions "+(_nu>1?"they have":"it has")+" are among the instruments above")
            :((_nu>1?"have":"has")+" no transactions for this client in the IRR file and "+(_nu>1?"show":"shows")+" the base file's XIRR/BMXIRR")));
          if(irrNone) _np.push(_pl(irrNone,"subtotal","subtotals")+" blank: none of "+(irrNone>1?"their":"its")+" holdings matches an instrument in the IRR file"+(_ext?(", and no unmatched instrument is labelled for "+(irrNone>1?"them":"it")):""));
          if(irrNoRate) _np.push(_pl(irrNoRate,"subtotal","subtotals")+" with XIRR or BMXIRR blank: no rate from "+(irrNoRate>1?"their":"its")+" transactions or benchmark series");
          if(irrGBlank) _np.push("Grand Total XIRR or BMXIRR blank: no rate from the client's transactions or benchmark series");
          if(_nn) _np.push(_pl(_nn,"holding","holdings")+" whose XIRR or BMXIRR cannot be computed from "+(_nn>1?"their":"its")+" transactions or benchmark series, left blank");
          if(_np.length) irrNote="§ Transaction-based XIRR/BMXIRR: "+_np.join("; ")+".";
        }
      }
      return {name:cn, totalCMV:ctot, totalInv:C2.ni?C2.inv:null, rows:outRows, covNote:covNote, invMissing:C2.im, invNote:invNote, irrNote:irrNote};`
  },
  {
    label: 'KI-007 review: Total Gain/Loss over the holdings with an invested value; count and footnote',
    from: L`      unit:unit, totalCMV:totalCMV, totalInv:totalInv, totalGL: totalCMV-totalInv,`,
    to: L`      /* KI-007: Total Gain/Loss = CMV - invested, both over the holdings that have an invested value */
      unit:unit, totalCMV:totalCMV, totalInv:(rows.length>invMissing)?totalInv:null, totalGL:(rows.length>invMissing)?(invCmv-totalInv):null,
      invMissing:invMissing, invNote:invMissing?("‡ Invested value and gain/loss total only the holdings that have an invested value: "+invMissing+" holding"+(invMissing>1?"s":"")+" without one ("+(Math.round((totalCMV?(totalCMV-invCmv)/totalCMV*100:0)*100)/100).toFixed(2)+"% of CMV)."):null,`
  },
  {
    label: 'KI-007 AI Analyst: a position with a member without an invested value has none',
    from: L`g.cmvCr += (h.cmvCr || 0); g.invCr += (h.invCr || 0); g.glCr += (h.glCr || 0);`,
    to: L`g.cmvCr += (h.cmvCr || 0); g.glCr += (h.glCr || 0);
      /* KI-007: a member without an invested value leaves the position without one (blank, never 0) */
      g.invCr = (g.invCr == null || h.invCr == null) ? null : g.invCr + h.invCr;`
  },
  {
    label: 'KI-007 AI Analyst: recs report a missing invested value as null',
    from: L`inv: aiaR2(it.h.invCr || 0), gl: aiaR2(it.h.glCr || 0),`,
    to: L`inv: it.h.invCr == null ? null : aiaR2(it.h.invCr), gl: aiaR2(it.h.glCr || 0),   /* KI-007 */`
  },

  /* ======================= exporters (08) ======================= */
  {
    label: 'KI-007 holdings slide: the money cell can carry a marker',
    from: L`function mc(v){ var t=model.unit.t(v); return cell(t,{align:"right",fill:{color:fill},color:(!num(v)&&v<0)?C.red:fg,bold:bold}); }`,
    to: L`function mc(v,mark){ var t=model.unit.t(v)+(num(v)?"":(mark||"")); return cell(t,{align:"right",fill:{color:fill},color:(!num(v)&&v<0)?C.red:fg,bold:bold}); }`
  },
  {
    label: 'KI-007 holdings slide marks a partial invested subtotal with ‡',
    from: L`if(c.key==="inv") return mc(r.inv);`,
    to: L`if(c.key==="inv") return mc(r.inv,(r.level!=="item"&&r.invMissing)?"‡":"");   /* KI-007 */`
  },
  {
    label: 'KI-007 holdings slide marks a partial gain/loss subtotal with ‡',
    from: L`if(c.key==="gl") return mc(r.gl);`,
    to: L`if(c.key==="gl") return mc(r.gl,(r.level!=="item"&&r.invMissing)?"‡":"");   /* KI-007 */`
  },
  {
    label: 'KI-007 holdings slide marks a partial absolute return with ‡ (same holdings as the ‡ invested value)',
    from: L`          if(c.key==="absret") return pc((r.inv!=null&&!isNaN(r.inv)&&r.inv!==0)?(r.gl/r.inv*100):null);`,
    to: L`          if(c.key==="absret") return pc((r.inv!=null&&!isNaN(r.inv)&&r.inv!==0)?(r.gl/r.inv*100):null,(r.level!=="item"&&r.invMissing)?"‡":"");   /* KI-007 */`
  },
  {
    label: 'KI-006 / KI-007 / KI-048 holdings slide: rows per page leave room for the notes box',
    from: L`      var per=13, pages=Math.ceil(itemRows.length/per);`,
    to: L`      /* KI-006 / KI-007 / KI-048: the †, ‡ and § notes can run to several lines. When a client has any, the
         footer caption and its notes share one box sized to their text, bottom-anchored on the one-line
         footer's own bottom edge (7.18), so a line more than estimated grows upward, never into the black band
         at 7.23. Measured on a PowerPoint render (8pt Cambria italic, 12.93 in box): about 262 characters and
         0.133 in a line, so HF_CPL=220 and HF_LH=0.14 over-estimate the box; 0.1 in is its top and bottom
         inset. The table then gets the band from 1.12 to the box's top, at HF_ROW a row: the tallest row the
         table draws in practice, an instrument name wrapping to two lines (0.40 in on the same render), with
         the header and the grand total. Without notes the layout is unchanged: 13 rows, the one-line footer. */
      var HF_CPL=220, HF_LH=0.14, HF_ROW=0.40;
      var _hn=[cl.covNote,cl.invNote,cl.irrNote].filter(Boolean);
      var _hc="*Allocation re-based to "+cl.name+"'s portfolio (CMV "+model.unit.m(cl.totalCMV)+"). "+(model.irrActive?("XIRR/BMXIRR transaction-based (as on "+model.irrAsOn+")."):"XIRR/BMXIRR are CMV-weighted.")+" Portfolio as on "+model.meta.asOnDate+".";
      var _hh=_hn.length?([_hc].concat(_hn).reduce(function(s,t){ return s+Math.ceil(t.length/HF_CPL); },0)*HF_LH+0.1):0;
      var per=_hn.length?Math.max(3,Math.min(13,Math.floor((7.18-_hh-1.12)/HF_ROW+1e-9)-2)):13, pages=Math.ceil(itemRows.length/per);`
  },
  {
    label: 'KI-006 / KI-007 / KI-048 holdings slide footer: caption and notes in one box sized to the text',
    from: L`        foot(s,"*Allocation re-based to "+cl.name+"'s portfolio (CMV "+model.unit.m(cl.totalCMV)+"). "+(model.irrActive?("XIRR/BMXIRR transaction-based (as on "+model.irrAsOn+")."):"XIRR/BMXIRR are CMV-weighted.")+" Portfolio as on "+model.meta.asOnDate+"."+(cl.covNote?" "+cl.covNote:""));   /* KI-006 */`,
    to: L`        if(!_hn.length) foot(s,_hc);
        else s.addText([_hc].concat(_hn).map(function(t,i,a){ return {text:t,options:{breakLine:i<a.length-1}}; }),
          {x:0.18,y:7.18-_hh,w:W-0.4,h:_hh,fontFace:F,fontSize:8,italic:true,color:"6B6B6B",align:"left",valign:"bottom"});   /* KI-006, KI-007, KI-048 */`
  },
  {
    label: 'KI-007 asset slide: Invested KPI marked when the total leaves holdings out',
    from: L`kpi(s,kx,1.06,kw,model.unit.m(model.totalInv),"Invested Value");`,
    to: L`kpi(s,kx,1.06,kw,model.unit.m(model.totalInv),"Invested Value"+(model.invMissing?"‡":""));   /* KI-007 */`
  },
  {
    label: 'KI-007 asset slide: Total Gain / Loss KPI marked likewise',
    from: L`kpi(s,kx+2*(kw+kg),1.06,kw,model.unit.m(model.totalGL),"Total Gain / Loss");`,
    to: L`kpi(s,kx+2*(kw+kg),1.06,kw,model.unit.m(model.totalGL),"Total Gain / Loss"+(model.invMissing?"‡":""));   /* KI-007 */`
  },
  {
    label: 'KI-007 asset slide: a partial invested row is marked ‡',
    from: L`          cell(model.unit.t(r.inv),{align:"center",color:col2,fill:{color:fill},bold:bold}),`,
    to: L`          cell(model.unit.t(r.inv)+((r.invMissing&&r.inv!=null)?"‡":""),{align:"center",color:col2,fill:{color:fill},bold:bold}),   /* KI-007 */`
  },
  {
    label: 'KI-007 asset slide footer carries the footnote',
    from: L`foot(s,"*Portfolio as on "+model.meta.asOnDate+".");`,
    to: L`foot(s,"*Portfolio as on "+model.meta.asOnDate+"."+(model.invNote?" "+model.invNote:""));   /* KI-007 */`
  },
  {
    label: 'KI-007 taxation slide: Total Gain/Loss KPI names the holdings without an invested value',
    from: L`kpi(s,kx+(kw+kg)*2,1.06,kw,gm(t.gl),"Total Gain/Loss (unclassified "+gm(t.unclassGain)+")");`,
    to: L`kpi(s,kx+(kw+kg)*2,1.06,kw,gm(t.gl),"Total Gain/Loss (unclassified "+gm(t.unclassGain)+(t.glMissing?"; "+t.glMissing+" without invested value":"")+")");   /* KI-007 */`
  },
  {
    label: 'KI-007 taxation totals slide: a line under the grand total names the holdings the G/L columns leave out',
    from: L`        st.addTable(gr,{x:0.18,y:gy,w:13.0,colW:[4.30,1.20,1.60,1.55,1.55,1.55,1.25],rowH:0.30,fontFace:F,
          border:{type:'solid',pt:0.3,color:'D9D9D9'},valign:'middle'});`,
    to: L`        st.addTable(gr,{x:0.18,y:gy,w:13.0,colW:[4.30,1.20,1.60,1.55,1.55,1.55,1.25],rowH:0.30,fontFace:F,
          border:{type:'solid',pt:0.3,color:'D9D9D9'},valign:'middle'});
        /* KI-007: below the grand total (worst case two rows of WORST; GBOT keeps it well above the footer) */
        if(t.glMissing) st.addText("Gain/Loss columns leave out "+t.glMissing+" holding"+(t.glMissing>1?"s":"")+" without an invested value; "+(t.glMissing>1?"their":"its")+" CMV and holding count are included.",
          {x:0.18,y:gy+2*WORST+0.06,w:13.0,h:0.24,fontFace:F,fontSize:8,italic:true,color:"6B6B6B",align:"left"});`
  },
  {
    label: 'KI-007 workbook Asset Allocation: "—" for no invested value, footnote under the table',
    from: L`    model.assetAllocation.rows.forEach(function(r){ aa.push([(r.level==="product"?"   ":"")+r.label,model.unit.v(r.inv),model.unit.v(r.cmv),r.pct]); });`,
    to: L`    model.assetAllocation.rows.forEach(function(r){ aa.push([(r.level==="product"?"   ":"")+r.label,r.inv==null?"—":model.unit.v(r.inv),model.unit.v(r.cmv),r.pct]); });
    if(model.invNote){ aa.push([]); aa.push([model.invNote]); }   /* KI-007 */`
  },
  {
    label: 'KI-007 / KI-048 workbook client sheet: "—" for no invested value / gain-loss; footnotes at the end',
    from: L`      cl.rows.forEach(function(r){ ch.push([(r.level==="item"?"   ":"")+r.label,r.dist||"",(r.level==="item"?(r.pdate||""):""),model.unit.v(r.inv),model.unit.v(r.cmv),model.unit.v(r.gl),r.alloc,r.xirr,r.bmxirr]); });
      if(cl.covNote){ ch.push([]); ch.push([cl.covNote]); }   /* KI-006 */`,
    to: L`      /* KI-007: a missing invested value (or gain/loss) reads "—", as on screen */
      cl.rows.forEach(function(r){ ch.push([(r.level==="item"?"   ":"")+r.label,r.dist||"",(r.level==="item"?(r.pdate||""):""),r.inv==null?"—":model.unit.v(r.inv),model.unit.v(r.cmv),r.gl==null?"—":model.unit.v(r.gl),r.alloc,r.xirr,r.bmxirr]); });
      if(cl.covNote){ ch.push([]); ch.push([cl.covNote]); }   /* KI-006 */
      if(cl.invNote||cl.irrNote){ if(!cl.covNote) ch.push([]); if(cl.invNote) ch.push([cl.invNote]); if(cl.irrNote) ch.push([cl.irrNote]); }   /* KI-007, KI-048 */`
  },

  /* ======================= UI (11) ======================= */
  {
    label: 'KI-007 Holdings tab marks a partial invested subtotal with ‡',
    from: L`if(c.key==='inv') return '<td'+neg(r.inv)+'>'+model.unit.t(r.inv)+'</td>';`,
    to: L`if(c.key==='inv') return '<td'+neg(r.inv)+'>'+model.unit.t(r.inv)+((r.level!=='item'&&r.inv!=null&&r.invMissing)?'‡':'')+'</td>';   /* KI-007 */`
  },
  {
    label: 'KI-007 Holdings tab marks a partial gain/loss subtotal with ‡',
    from: L`if(c.key==='gl') return '<td'+neg(r.gl)+'>'+model.unit.t(r.gl)+'</td>';`,
    to: L`if(c.key==='gl') return '<td'+neg(r.gl)+'>'+model.unit.t(r.gl)+((r.level!=='item'&&r.gl!=null&&r.invMissing)?'‡':'')+'</td>';   /* KI-007 */`
  },
  {
    label: 'KI-007 Holdings tab marks a partial absolute return with ‡',
    from: L`          if(c.key==='absret'){ var a=czAbsRet(r); return '<td'+neg(a)+'>'+pe(a)+'</td>'; }`,
    to: L`          if(c.key==='absret'){ var a=czAbsRet(r); return '<td'+neg(a)+'>'+pe(a)+((r.level!=='item'&&a!=null&&r.invMissing)?'‡':'')+'</td>'; }   /* KI-007 */`
  },
  {
    label: 'KI-007 / KI-048 Holdings tab sub-line carries the invested-value and IRR footnotes',
    from: L`(cl.covNote?' '+cl.covNote:'')+'</div>'+   /* KI-006: engine text, numbers only */`,
    to: L`(cl.covNote?' '+cl.covNote:'')+(cl.invNote?' '+cl.invNote:'')+(cl.irrNote?' '+cl.irrNote:'')+'</div>'+   /* KI-006, KI-007, KI-048: engine text, numbers only */`
  },
  {
    label: 'KI-007 Asset Allocation tab marks a partial invested row with ‡',
    from: L`return '<tr class="'+cls+'"><td>'+r.label+'</td><td>'+m.unit.t(r.inv)+'</td><td>'+m.unit.t(r.cmv)+'</td><td>'+r.pct.toFixed(2)+'%</td></tr>';`,
    to: L`return '<tr class="'+cls+'"><td>'+r.label+'</td><td>'+m.unit.t(r.inv)+((r.invMissing&&r.inv!=null)?'‡':'')+'</td><td>'+m.unit.t(r.cmv)+'</td><td>'+r.pct.toFixed(2)+'%</td></tr>';   /* KI-007 */`
  },
  {
    label: 'KI-007 Asset Allocation tab: Invested KPI marked',
    from: L`'<div class="kpi"><div class="v">'+m.unit.m(m.totalInv)+'</div><div class="l">Invested</div></div>'+`,
    to: L`'<div class="kpi"><div class="v">'+m.unit.m(m.totalInv)+'</div><div class="l">Invested'+(m.invMissing?'‡':'')+'</div></div>'+   /* KI-007 */`
  },
  {
    label: 'KI-007 Asset Allocation tab: Total Gain/Loss KPI marked',
    from: L`'<div class="kpi"><div class="v"'+neg(m.totalGL)+'>'+m.unit.m(m.totalGL)+'</div><div class="l">Total Gain/Loss</div></div>'+`,
    to: L`'<div class="kpi"><div class="v"'+neg(m.totalGL)+'>'+m.unit.m(m.totalGL)+'</div><div class="l">Total Gain/Loss'+(m.invMissing?'‡':'')+'</div></div>'+`
  },
  {
    label: 'KI-007 Asset Allocation tab sub-line carries the footnote',
    from: L`'<div class="card"><h3>Asset Allocation</h3><div class="sub">*Portfolio as on '+m.meta.asOnDate+'</div>'+`,
    to: L`'<div class="card"><h3>Asset Allocation</h3><div class="sub">*Portfolio as on '+m.meta.asOnDate+(m.invNote?' '+m.invNote:'')+'</div>'+`
  },
  {
    label: 'KI-007 Rebalancing Holding Sheet: count holdings without an invested value',
    from: L`    var totCMV=0, totInv=0;
    (currentRows||[]).forEach(function(h){ totCMV+=(Number(h.cmvCr)||0); totInv+=(Number(h.invCr)||0); });`,
    to: L`    var totCMV=0, totInv=0, rbInvMiss=0;
    (currentRows||[]).forEach(function(h){ totCMV+=(Number(h.cmvCr)||0); totInv+=(Number(h.invCr)||0); });`
  },
  {
    label: 'KI-007 Rebalancing Holding Sheet: a blank invested value is counted, not added as 0',
    from: L`      it.inv+=(Number(h.invCr)||0); it.cmv+=(Number(h.cmvCr)||0);`,
    to: L`      if(h.invCr==null){ it.im=(it.im||0)+1; rbInvMiss++; } else it.inv+=(Number(h.invCr)||0); it.cmv+=(Number(h.cmvCr)||0);   /* KI-007 */`
  },
  {
    label: 'KI-007 Rebalancing Holding Sheet: the holding shows "—"',
    from: L`            items.push([n,it.inv,it.cmv,dv,(e?e.action:null)]);`,
    to: L`            items.push([n,(it.im?null:it.inv),it.cmv,dv,(e?e.action:null)]);   /* KI-007: "—" when a holding has no invested value */`
  },
  {
    label: 'KI-007 Rebalancing Holding Sheet: the note (screen and slide) names the count',
    from: L`    return {rows:out, totCMV:totCMV, totDelta:totDelta, totReb:totReb, note:msg, warn:warn};`,
    to: L`    if(rbInvMiss) msg+=' Invested Value totals only the holdings that have one; '+rbInvMiss+' holding'+(rbInvMiss>1?'s':'')+' without an invested value '+(rbInvMiss>1?'show':'shows')+' —.';   /* KI-007 */
    return {rows:out, totCMV:totCMV, totDelta:totDelta, totReb:totReb, note:msg, warn:warn};`
  },
  {
    label: 'KI-007 Taxation tab: Total Gain/Loss KPI names the holdings without an invested value',
    from: L`'</div><div class="l">Total Gain/Loss &middot; not classified '+gm(t.unclassGain)+'</div></div>'+`,
    to: L`'</div><div class="l">Total Gain/Loss &middot; not classified '+gm(t.unclassGain)+(t.glMissing?' &middot; '+t.glMissing+' without invested value':'')+'</div></div>'+   /* KI-007 */`
  },
  {
    label: 'KI-007 Taxation tab: a line under the grand total names the holdings the G/L columns leave out',
    from: L`        '<td class="n"'+gcol(t.gl)+'>'+gm(t.gl)+'</td></tr></tbody></table></div>';`,
    to: L`        '<td class="n"'+gcol(t.gl)+'>'+gm(t.gl)+'</td></tr></tbody></table></div>'+
      (t.glMissing?'<div class="sub" style="margin:6px 0 0;">Gain/Loss columns leave out '+t.glMissing+' holding'+(t.glMissing>1?'s':'')+' without an invested value; '+(t.glMissing>1?'their':'its')+' CMV and holding count are included.</div>':'');   /* KI-007 */`
  },
]);
