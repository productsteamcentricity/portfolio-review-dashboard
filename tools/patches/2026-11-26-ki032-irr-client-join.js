/* ============================================================================
   2026-11-26 — KI-032: the IRR client join, made one-to-one and unambiguous
   (owner, 26 Nov 2026 ~17:00 IST, relayed by MOD-04: "Careful variant match";
   plan C:\dev\private\ex03\ki032\PLAN-KI032-IRR-CLIENT-JOIN-2026-11-26.md).

   Before: resolveClient (engine, IRR block) joined a base-file client with no
   exact name in the IRR file to whichever IRR client shared the most name
   words, if at least two; a tie went to the first in the file, and nothing
   stopped a client taking a family member's or an HUF's flows. That one
   function feeds the client's Grand Total XIRR (irrCli), its subtotals
   (irrAgg), the placement of its redeemed instruments (irrPlace) and every
   holding's transaction XIRR (irrKey / irrInstr). Rule 3: the figures were
   real, but someone else's.

   After, decided once per review, before any figure:
   1. exact: the normalised name (nc) is an IRR client: unchanged;
   2. variant, for a base client with no exact name, against the IRR clients
      no base client names exactly: salutations dropped (MR, MRS, MS, MISS, DR,
      SHRI, SRI, SMT, SHRIMATI, KUM, MASTER, LATE); entity words must agree (HUF,
      TRUST, LLP, PVT/PRIVATE, LTD/LIMITED, CO, FIRM, FOUNDATION, MINOR, U/G or
      GUARDIAN); every word of the shorter name is in the longer one, a single
      letter standing for a word with that initial, the shorter name keeping at
      least two full words; when the lengths differ, the first words agree too
      (so "Priya Rajesh Shah" never takes "Rajesh Shah"'s flows); and the pairing
      is unique both ways (one candidate for the base client, and that IRR
      client a candidate for no other base client);
   3. otherwise no join: the base file's CMV-weighted figures, as for a client
      without transactions, and the client's § note says why when the old rule
      would have joined (a different entity, more than one possible client, an
      IRR client that could also be another base client, the IRR client already
      another client's exact name, or names that differ by
      more than a salutation, initials or a middle name). No name is printed.
   A variant join is named in the client's § note. The counts (exact, variant,
   refused, none) are in the review model as irrJoin. The family Fund IRR tree
   (computeIRRtree) groups by the IRR file's own client labels and is unchanged.

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
    label: 'engine: resolveClient, one-to-one and unambiguous (KI-032)',
    from: '      var resolveClient=function(cn){ var k=nc(cn); if(cliKeys[k])return k;\n' +
          '        var bt=k.split(" ").filter(Boolean), best=null, bestn=0;\n' +
          '        cliList.forEach(function(ck){ var ct=ck.split(" "), n=0; bt.forEach(function(x){ if(ct.indexOf(x)>=0)n++; }); if(n>bestn){bestn=n;best=ck;} });\n' +
          '        return bestn>=2?best:null; };\n',
    to: `      /* KI-032: the client join is decided once, before any figure: the exact normalised name; else a unique variant
         (salutations dropped, entity words equal, the shorter name contained in the longer with initials, the first
         words equal when the lengths differ, one candidate each way); else none. The old rule (two shared words, first
         in the file on a tie) is kept only to say in the client's note why a near name was not joined. */
      var _oldBest=function(k){ var bt=k.split(" ").filter(Boolean), best=null, bestn=0;
        cliList.forEach(function(ck){ var ct=ck.split(" "), n=0; bt.forEach(function(x){ if(ct.indexOf(x)>=0)n++; }); if(n>bestn){bestn=n;best=ck;} });
        return bestn>=2?best:null; };
      var _SAL={MR:1,MRS:1,MS:1,MISS:1,DR:1,SHRI:1,SRI:1,SMT:1,SHRIMATI:1,KUM:1,MASTER:1,LATE:1};
      var _ENT={HUF:"HUF",TRUST:"TRUST",LLP:"LLP",PVT:"PVT",PRIVATE:"PVT",LTD:"LTD",LIMITED:"LTD",CO:"CO",FIRM:"FIRM",FOUNDATION:"FOUNDATION",MINOR:"MINOR",UG:"UG",GUARDIAN:"UG"};
      var _parts=function(k){ var w=k.split(" ").filter(Boolean), out=[], ent={};
        for(var i=0;i<w.length;i++){ var x=w[i];
          if(x==="U"&&w[i+1]==="G"){ ent.UG=1; i++; continue; }
          if(_SAL[x]) continue;
          if(_ENT[x]){ ent[_ENT[x]]=1; continue; }
          out.push(x); }
        return {w:out, e:Object.keys(ent).sort().join(" ")}; };
      var _fits=function(S,L){ if(S.length>L.length) return false;
        if(S.filter(function(x){ return x.length>1; }).length<2) return false;
        var used=L.map(function(){ return false; });
        var take=function(ok){ for(var j=0;j<L.length;j++) if(!used[j]&&ok(L[j])){ used[j]=true; return true; } return false; };
        for(var i=0;i<S.length;i++){ var s=S[i]; if(s.length>1&&!take(function(y){ return y===s; })) return false; }
        for(i=0;i<S.length;i++){ var c=S[i]; if(c.length===1&&!take(function(y){ return y===c; })&&!take(function(y){ return y.charAt(0)===c; })) return false; }
        if(S.length<L.length){ var a=S[0], b=L[0]; if(!(a===b||(a.length===1&&b.charAt(0)===a)||(b.length===1&&a.charAt(0)===b))) return false; }
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
          else if(_ent[k]) why="the IRR client with a similar name is a different entity (HUF, trust, company or minor)";
          else if(ob&&_claimed[ob]) why="the IRR client with a similar name is another client's exact name";
          else if(ob) why="the names differ by more than a salutation, initials or a middle name";
          j={key:null, how:why?"refused":"none", why:why}; }
        _join[k]=j; irrJoinCounts[j.how]++; });
      var resolveClient=function(cn){ var k=nc(cn); if(cliKeys[k])return k; var j=_join[k]; return j?j.key:null; };
      irrJoinOf=function(cn){ return _join[nc(cn)]||null; };
`,
  },
  {
    label: 'engine: client note when a near IRR client was refused (KI-032)',
    from: '        if(!irrCli(cn)) irrNote="§ No transactions for this client in the IRR file: XIRR/BMXIRR are the base file\'s, CMV-weighted.";\n',
    to: '        if(!irrCli(cn)){ var _jr=irrJoinOf(cn); irrNote="§ No transactions for this client in the IRR file: XIRR/BMXIRR are the base file\'s, CMV-weighted."+(_jr&&_jr.how==="refused"?" An IRR client with a similar name was not joined: "+_jr.why+".":""); }   /* KI-032 */\n',
  },
  {
    label: 'engine: client note when the join was a name variant (KI-032)',
    from: '          var _x=_px||{placed:0,aOnly:0,unplaced:0,benchOnly:0}, _ext=_x.placed+_x.unplaced, _np=[];\n',
    to: '          var _x=_px||{placed:0,aOnly:0,unplaced:0,benchOnly:0}, _ext=_x.placed+_x.unplaced, _np=[];\n' +
        '          if((irrJoinOf(cn)||{}).how==="variant") _np.push("joined to the IRR file\'s client by a name variant (a salutation, initials or a middle name)");   /* KI-032 */\n',
  },
  {
    label: 'engine: the join counts in the review model (KI-032)',
    from: '      irr:irrTree, irrActive:!!IRRO, irrAsOn:irrAsOn,\n',
    to: '      irr:irrTree, irrActive:!!IRRO, irrAsOn:irrAsOn, irrJoin:irrJoinCounts,\n',
  },
]);
