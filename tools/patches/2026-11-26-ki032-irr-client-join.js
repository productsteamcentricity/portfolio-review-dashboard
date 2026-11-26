/* ============================================================================
   2026-11-26 — KI-032: the IRR client join, made one-to-one and unambiguous
   (owner, 26 Nov 2026 ~17:00 IST, relayed by MOD-04: "Careful variant match";
   plan C:\dev\private\ex03\ki032\PLAN-KI032-IRR-CLIENT-JOIN-2026-11-26.md;
   round 2 after the financial review of d12eeeb).

   Before: resolveClient (engine, IRR block) joined a base-file client with no
   exact name in the IRR file to whichever IRR client shared the most name
   words, if at least two; a tie went to the first in the file, and nothing
   stopped a client taking a family member's or an HUF's flows. That one
   function feeds the client's Grand Total XIRR (irrCli), its subtotals
   (irrAgg), the placement of its redeemed instruments (irrPlace) and every
   holding's transaction XIRR (irrKey / irrInstr). Rule 3: the figures were
   real, but someone else's. Also, the client key (nc) dropped any text in
   brackets, so "X (HUF)" was the exact key of "X": the individual took the
   HUF's flows, and an IRR file holding both merged them on the client sheet.

   After:
   0. the client key keeps the marker words written in brackets ("(HUF)",
      "(H.U.F.)", "(Minor)", "(U/G)" ...; any other bracketed text is still
      dropped), reads "&" as AND, and reads the letters H U F as HUF and U G as
      UG. A name with none of these keys exactly as before.
   1. exact: the key is an IRR client's key: unchanged;
   2. variant, for a base client with no exact key, against the IRR clients no
      base client keys exactly: salutations dropped (MR, MRS, MS, MISS, DR, SHRI,
      SRI, SMT, SHRIMATI, KUM, MASTER); marker words must agree on both sides
      (HUF or KARTA; TRUST; LLP; PVT or PRIVATE; LTD or LIMITED; CO; FIRM;
      FOUNDATION; MINOR; UG, GUARDIAN, THRU or THROUGH; JR or JUNIOR; SR or
      SENIOR; LATE; AND, a joint name); every word of the shorter name is in the
      longer one, a single letter standing for a word with that initial, the
      shorter name keeping at least two full words; when the lengths differ,
      the first words agree (exactly or as an initial), the last words agree,
      and the longer name has at most one more full word (a middle name), so
      "Priya Rajesh Shah" never takes "Rajesh Shah"'s flows; and the pairing is
      unique both ways (one candidate for the base client, and that IRR client
      a candidate for no other base client);
   3. otherwise no join: the base file's CMV-weighted figures. When the old rule
      would have joined, the client's § note says it was not joined and why (a
      different entity or holder, more than one possible client, an IRR client
      that could also be another client, the IRR client already another client's
      exact name, or names that differ by more than a salutation, initials, a
      middle name or the word order). No name is printed.
   A variant join is named in the client's § note. Each client sheet carries
   how it joined (irrJoin), and the review model the counts (exact, variant,
   refused, none). The family Fund IRR tree (computeIRRtree) groups by the IRR
   file's own client labels and is unchanged.

     node tools/patches/2026-11-26-ki032-irr-client-join.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('KI-032 IRR client join', [
  {
    label: 'engine: defaults of the join lookups (KI-032)',
    from: '    var irrAgg=function(){return null;}, irrCli=function(){return null;}, irrInstr=function(){return null;}, irrPlace=function(){return null;};   /* irrPlace: KI-048 */\n',
    to: '    var irrAgg=function(){return null;}, irrCli=function(){return null;}, irrInstr=function(){return null;}, irrPlace=function(){return null;};   /* irrPlace: KI-048 */\n' +
        '    var irrJoinOf=function(){return null;}, irrJoinCounts=null;   /* KI-032: how each base client joined the IRR file */\n',
  },
  {
    label: 'engine: the client key keeps bracketed marker words, & as AND (KI-032)',
    from: String.raw`      var nc=function(x){ return String(x||"").toUpperCase().replace(/\(.*?\)/g," ").replace(/[^A-Z0-9]+/g," ").trim(); };
`,
    to: String.raw`      /* KI-032: the client key. Text in brackets is dropped except the marker words (an HUF, a minor, a guardian ...),
         which name a different holder; "&" reads as AND; the letters H U F read as HUF and U G as UG. A name with none
         of these keys exactly as before. */
      var _MK={HUF:"HUF",KARTA:"HUF",TRUST:"TRUST",LLP:"LLP",PVT:"PVT",PRIVATE:"PVT",LTD:"LTD",LIMITED:"LTD",CO:"CO",FIRM:"FIRM",FOUNDATION:"FOUNDATION",MINOR:"MINOR",UG:"UG",GUARDIAN:"UG",THRU:"UG",THROUGH:"UG",JR:"JR",JUNIOR:"JR",SR:"SR",SENIOR:"SR",LATE:"LATE",AND:"AND"};
      var _toks=function(s){ return s.replace(/[^A-Z0-9]+/g," ").trim().split(" ").filter(Boolean); };
      var _seq=function(w){ var o=[]; for(var i=0;i<w.length;i++){
          if(w[i]==="H"&&w[i+1]==="U"&&w[i+2]==="F"){ o.push("HUF"); i+=2; continue; }
          if(w[i]==="U"&&w[i+1]==="G"){ o.push("UG"); i++; continue; }
          o.push(w[i]); } return o; };
      var nc=function(x){ var s=String(x||"").toUpperCase().replace(/&/g," AND ").replace(/\(([^)]*)\)/g,function(_m,inner){
          return " "+_seq(_toks(inner)).filter(function(t){ return _MK[t]; }).join(" ")+" "; });
        return _seq(_toks(s)).join(" "); };
`,
  },
  {
    label: 'engine: resolveClient, one-to-one and unambiguous (KI-032)',
    from: '      var resolveClient=function(cn){ var k=nc(cn); if(cliKeys[k])return k;\n' +
          '        var bt=k.split(" ").filter(Boolean), best=null, bestn=0;\n' +
          '        cliList.forEach(function(ck){ var ct=ck.split(" "), n=0; bt.forEach(function(x){ if(ct.indexOf(x)>=0)n++; }); if(n>bestn){bestn=n;best=ck;} });\n' +
          '        return bestn>=2?best:null; };\n',
    to: `      /* KI-032: the client join is decided once, before any figure: the exact key; else a unique variant (salutations
         dropped, marker words equal, the shorter name contained in the longer with initials, and when the lengths differ
         the first and last words equal and at most one more full word; one candidate each way); else none. The old rule
         (two shared words, first in the file on a tie) is kept only to say in the client's note why a near name was not
         joined. */
      var _oldBest=function(k){ var bt=k.split(" ").filter(Boolean), best=null, bestn=0;
        cliList.forEach(function(ck){ var ct=ck.split(" "), n=0; bt.forEach(function(x){ if(ct.indexOf(x)>=0)n++; }); if(n>bestn){bestn=n;best=ck;} });
        return bestn>=2?best:null; };
      var _SAL={MR:1,MRS:1,MS:1,MISS:1,DR:1,SHRI:1,SRI:1,SMT:1,SHRIMATI:1,KUM:1,MASTER:1};
      var _parts=function(k){ var out=[], ent={};
        k.split(" ").filter(Boolean).forEach(function(x){ if(_SAL[x]) return; if(_MK[x]){ ent[_MK[x]]=1; return; } out.push(x); });
        return {w:out, e:Object.keys(ent).sort().join(" ")}; };
      var _ini=function(a,b){ return a===b||(a.length===1&&b.charAt(0)===a)||(b.length===1&&a.charAt(0)===b); };
      var _fits=function(S,L){ if(S.length>L.length) return false;
        if(S.filter(function(x){ return x.length>1; }).length<2) return false;
        var used=L.map(function(){ return false; });
        var take=function(ok){ for(var j=0;j<L.length;j++) if(!used[j]&&ok(L[j])){ used[j]=true; return true; } return false; };
        for(var i=0;i<S.length;i++){ var s=S[i]; if(s.length>1&&!take(function(y){ return y===s; })) return false; }
        for(i=0;i<S.length;i++){ var c=S[i]; if(c.length===1&&!take(function(y){ return y===c; })&&!take(function(y){ return y.charAt(0)===c; })) return false; }
        if(S.length<L.length){
          if(!_ini(S[0],L[0])||S[S.length-1]!==L[L.length-1]) return false;
          if(L.filter(function(y,j){ return !used[j]&&y.length>1; }).length>1) return false; }
        return true; };
      var _variant=function(a,b){ return _fits(a,b)||_fits(b,a); };
      var _baseK={}; rows.forEach(function(h){ var k=nc(h.client); if(k) _baseK[k]=1; });
      var _bases=Object.keys(_baseK), _claimed={};
      _bases.forEach(function(k){ if(cliKeys[k]) _claimed[k]=1; });
      var _P={}; cliList.forEach(function(c){ _P[c]=_parts(c); });
      var _cand={}, _ent={}, _by={};
      _bases.forEach(function(k){ if(cliKeys[k]) return; var p=_parts(k), c=[], ne=0;
        cliList.forEach(function(ic){ if(_claimed[ic]) return; var q=_P[ic]; if(!_variant(p.w,q.w)) return;
          if(p.e===q.e){ c.push(ic); (_by[ic]||(_by[ic]=[])).push(k); } else ne++; });
        _cand[k]=c; _ent[k]=ne; });
      var _join={}; irrJoinCounts={exact:0, variant:0, refused:0, none:0};
      _bases.forEach(function(k){ var j;
        if(cliKeys[k]) j={key:k, how:"exact"};
        else if(_cand[k].length===1&&_by[_cand[k][0]].length===1) j={key:_cand[k][0], how:"variant"};
        else { var ob=_oldBest(k), why=null;
          if(_cand[k].length>1) why="more than one client in the IRR file could be this client";
          else if(_cand[k].length) why="the IRR client with a similar name could also be another client";
          else if(_ent[k]) why="the IRR client with a similar name is a different entity or holder (an HUF, trust, company, minor, guardian, joint, junior, senior or late holder)";
          else if(ob&&_claimed[ob]) why="the IRR client with a similar name is another client's exact name";
          else if(ob&&_P[ob].e!==_parts(k).e) why="the IRR client with a similar name is a different entity or holder (an HUF, trust, company, minor, guardian, joint, junior, senior or late holder)";
          else if(ob) why="the names differ by more than a salutation, initials, a middle name or the word order";
          j={key:null, how:why?"refused":"none", why:why}; }
        _join[k]=j; irrJoinCounts[j.how]++; });
      var resolveClient=function(cn){ var k=nc(cn); if(cliKeys[k])return k; var j=_join[k]; return j?j.key:null; };
      irrJoinOf=function(cn){ return _join[nc(cn)]||null; };
`,
  },
  {
    label: 'engine: client note when a near IRR client was refused (KI-032)',
    from: '        if(!irrCli(cn)) irrNote="§ No transactions for this client in the IRR file: XIRR/BMXIRR are the base file\'s, CMV-weighted.";\n',
    to: '        if(!irrCli(cn)){ var _jr=irrJoinOf(cn); irrNote=(_jr&&_jr.how==="refused")?("§ Not joined to a client in the IRR file: "+_jr.why+". XIRR/BMXIRR are the base file\'s, CMV-weighted."):"§ No transactions for this client in the IRR file: XIRR/BMXIRR are the base file\'s, CMV-weighted."; }   /* KI-032 */\n',
  },
  {
    label: 'engine: client note when the join was a name variant (KI-032)',
    from: '          var _x=_px||{placed:0,aOnly:0,unplaced:0,benchOnly:0}, _ext=_x.placed+_x.unplaced, _np=[];\n',
    to: '          var _x=_px||{placed:0,aOnly:0,unplaced:0,benchOnly:0}, _ext=_x.placed+_x.unplaced, _np=[];\n' +
        '          if((irrJoinOf(cn)||{}).how==="variant") _np.push("joined to the IRR file\'s client by a name variant (a salutation, initials, a middle name or the word order)");   /* KI-032 */\n',
  },
  {
    label: 'engine: how each client sheet joined (KI-032)',
    from: '      return {name:cn, totalCMV:ctot, totalInv:C2.ni?C2.inv:null, rows:outRows, covNote:covNote, invMissing:C2.im, invNote:invNote, irrNote:irrNote};\n',
    to: '      return {name:cn, totalCMV:ctot, totalInv:C2.ni?C2.inv:null, rows:outRows, covNote:covNote, invMissing:C2.im, invNote:invNote, irrNote:irrNote, irrJoin:IRRO?((irrJoinOf(cn)||{}).how||null):null};   /* irrJoin: KI-032 */\n',
  },
  {
    label: 'engine: the join counts in the review model (KI-032)',
    from: '      irr:irrTree, irrActive:!!IRRO, irrAsOn:irrAsOn,\n',
    to: '      irr:irrTree, irrActive:!!IRRO, irrAsOn:irrAsOn, irrJoin:irrJoinCounts,\n',
  },
]);
