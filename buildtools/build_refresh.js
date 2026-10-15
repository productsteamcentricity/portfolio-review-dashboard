/* ============================================================================
   build_refresh.js — rebuild the monthly reference-data blocks from the
   Products-team source workbooks, using the SHIPPED runtime parsers
   (ENGINE.parsers, evaluated straight out of index.html) plus the documented
   build-time rules that the lost tools/parse-performance.js and
   tools/aggregate-analytics.js applied on top of them:

     MF_PERF / MF_PERF_DIRECT
       - AUM comes from the column labelled "AUM (Cr.)", found by scanning the
         header row and then UPWARD (on the debt and FoF sheets the label sits
         three rows above the header, and the header cell is a date serial).
         The runtime parser's fallback lands on the stale "in Rs.(Cr)" corpus
         column on those sheets — measured against July: 590 disagreements.
       - `mcap` is attached to every record (nulls where the sheet lacks a column).
       - `debt` {YTM, AvgMat, ModDur} (4 dp) is attached on ANY sheet, and only
         when at least one of the three is present — an all-null block would
         count toward "N funds" on the Debt Analytics card while adding nothing.
       - Benchmark rows go to BENCH_RET (runtime behaviour). Index rows the
         runtime cannot recognise as benchmarks (no "- TRI") stay in MF_PERF
         exactly as before, flagged `bm:true` (the flag is unused downstream).
     EQUITY / DEBT / HYBRID look-through
       - runtime parseEquitySide / parseDebtSide, sector labels whitespace-
         collapsed (the embedded blocks are), DEBT entries carry no `weight`
         (the embedded block never did), HYBRID.db is built from every row
         whose Asset is not "Equity" — debt AND cash — which is what makes
         eq.weight + db.weight partition the fund (238/240 July match).
       - the 15 PMS/AIF look-throughs (pcls) are carried forward — no SOA file
         this month.
     STOCK_INFO   fund-derived majority vote, then the direct-equity master
                  (add missing, upgrade "Others"), then back-fill from the
                  previous block so coverage never shrinks.
     STOCK_RET    one record per normalised company; among duplicate rows the
                  one with the most populated returns wins, later rows on ties
                  (7,968/8,386 July identity vs 7,917 for first-wins).
     MF_ER_TABLE  overlay: r = Base Expratio (fallback Ratio), d = Direct Plan
                  Base Expratio (fallback Direct Plan Ratio); direct-plan sibling
                  keys updated via the engine's own regKeyToDir convention.
     FUND_MGR     exact / normalised name match only against this month's
                  MF_PERF + SIF_PERF keys — no fuzzy matching: a manager
                  history landing on a different fund is a fabrication.
     SIF_PERF     runtime parseSIF plus the junk-row filter (benchmark group,
                  index rows, vendor disclaimer) that the parser patch adds.

   Usage:
     node buildtools/build_refresh.js --src "<month folder>" --slides <jpeg dir>
          --date "31 Aug 2026" --out buildtools/out/aug2026_blocks.json
     node buildtools/build_refresh.js --src "<July folder>" --date "31 Jul 2026" --verify
          (rebuilds July and reports agreement with the embedded blocks)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('../tools/engine-host.js');

/* ---------- helpers shared with the runtime parsers (same definitions) ---------- */
const clean = v => v == null ? '' : String(v).trim();
function num(v){ if(v==null) return null; if(typeof v==='number') return Math.round(v*1e6)/1e6;
  const s=String(v).trim(); if(['','-','—','NA','N/A','#N/A'].indexOf(s)>=0) return null;
  const f=parseFloat(s.replace(/,/g,'')); return isNaN(f)?null:Math.round(f*1e6)/1e6; }
const r4 = x => x==null ? null : Math.round(x*1e4)/1e4;
const normco = s => String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\b(ltd|limited|the|inc|corp|co|of|india)\b/g,' ').replace(/\s+/g,' ').trim();
const ws1 = s => String(s==null?'':s).replace(/\s+/g,' ').trim();
const normName = s => String(s==null?'':s).toLowerCase().replace(/[^a-z0-9]+/g,'');

function findHeader(rows){ for(let i=0;i<Math.min(20,rows.length);i++){ const r=rows[i]||[]; if(r[0]&&String(r[0]).trim().toLowerCase().indexOf('scheme name')>=0) return i; } return -1; }
function colInRow(row, names){ const r=row||[]; for(let j=0;j<r.length;j++){ const c=clean(r[j]).toLowerCase(); if(names.indexOf(c)>=0) return j; } return -1; }
function colUpward(rows, h, names){ for(let i=h;i>=0;i--){ const j=colInRow(rows[i], names); if(j>=0) return j; } return -1; }

function argv(name, dflt){ const i=process.argv.indexOf('--'+name); return i>=0 && process.argv[i+1] && !process.argv[i+1].startsWith('--') ? process.argv[i+1] : (process.argv.indexOf('--'+name)>=0 ? true : dflt); }

/* ---------- source file discovery ---------- */
function findFiles(src){
  const root = fs.readdirSync(src).filter(f=>/\.xlsx$/i.test(f) && !f.startsWith('~$'));
  const anDir = path.join(src,'Analytics');
  const an = fs.existsSync(anDir) ? fs.readdirSync(anDir).filter(f=>/\.xlsx$/i.test(f) && !f.startsWith('~$')) : [];
  const pick = (list, re, base) => { const hits=list.filter(f=>re.test(f)); if(hits.length>1) throw new Error('ambiguous '+re+' : '+hits.join(' | ')); return hits.length? path.join(base,hits[0]) : null; };
  return {
    monReg: pick(root, /^Daily MF Monitor(?!.*Direct).*\.xlsx$/i, src),
    monDir: pick(root, /^Daily MF Monitor.*Direct.*\.xlsx$/i, src),
    sif:    pick(root, /^SIF Monitor/i, src),
    er:     pick(root, /^Expense Ratio/i, src),
    exit:   pick(root, /^Exit Load/i, src),
    stockRet: pick(root, /^Listed Direct Equity/i, src),
    fmgr:   pick(root, /^Fund Manager/i, src),
    eqAn:   pick(an, /^Equity Analytics/i, anDir),
    hyAn:   pick(an, /^Hybrid Analytics/i, anDir),
    dbAn:   pick(an, /^Debt Analytics/i, anDir),
    stockMaster: pick(an, /^Listed Direct Equity/i, anDir),
  };
}

/* ---------- MF Monitor ---------- */
function buildMonitor(X, E, file, regular){
  const wb = X.read(fs.readFileSync(file), {type:'buffer', cellDates:true});
  const get = n => X.utils.sheet_to_json(wb.Sheets[n], {header:1, raw:true});
  const p = E.parsers.parseMonitor(wb.SheetNames, get);
  const stats = { sheets: wb.SheetNames.length, schemes: Object.keys(p.MF_PERF).length, bench: Object.keys(p.BENCH_RET).length, aumFromLabel:0, aumOverridden:0, aumKept:0, debtBlocks:0, mcapAttached:0, bm:0, benchTriPreferred:0, sheetMapped:0, sheetUnmapped:0 };
  const isBenchName = low => low.indexOf(' - tri')>=0 || ['bse 500','bse sensex','bse sensex next 50','nifty 50'].indexOf(low)>=0 || ['crisil composite bond index','crisil liquid debt index','crisil short term bond index'].indexOf(low)>=0 || /^crisil .* index$/.test(low) || low.indexOf('domestic price of')>=0 || /price of (physical\s+)?(gold|silver)/.test(low);
  const normbench = x => String(x).toLowerCase().replace(/\btri\b/g,'').replace(/[^a-z0-9]/g,'');
  wb.SheetNames.forEach(sh => {
    const rows = get(sh); const h = findHeader(rows); if (h<0) return;
    const hdr = rows[h]||[];
    const cA = colUpward(rows, h, ['aum (cr.)','aum (cr)']);
    const cL = colInRow(hdr,['large cap']), cM=colInRow(hdr,['mid cap']), cS=colInRow(hdr,['small cap']), cO=colInRow(hdr,['others']);
    const cY = colInRow(hdr,['ytm (%)','ytm']), cAM=colInRow(hdr,['average maturity years','average maturity']), cMD=colInRow(hdr,['modified duration years','modified duration']);
    const m={}; hdr.forEach((c,j)=>{ if(c!=null) m[clean(c).toLowerCase()]=j; }); const cc=n=>(n in m)?m[n]:-1;
    const c1m=cc('1 month'),c3m=cc('3 months'),c6m=cc('6 months'),c1y=cc('1 year'),c2y=cc('2 years'),c3y=cc('3 years'),c5y=cc('5 years'),c10y=cc('10 years'),csi=cc('since inception');
    for (let i=h+1;i<rows.length;i++){
      const r = rows[i]||[]; const nm = clean(r[0]); if(!nm) continue; const low=nm.toLowerCase();
      /* The runtime keeps the FIRST row it sees for a benchmark key, and the price index
         ("NIFTY 50") precedes its total-return twin ("NIFTY 50 - TRI") in sheet order, so
         the TRI series was never stored. Prefer the TRI row whenever both exist. */
      if (isBenchName(low) && /\btri\b/.test(low)){ const key=normbench(nm); const cur=p.BENCH_RET[key];
        if (cur && !/\btri\b/i.test(cur.name)){ p.BENCH_RET[key]={name:nm, r:{'1M':num(r[c1m]),'3M':num(r[c3m]),'6M':num(r[c6m]),'1Y':num(r[c1y]),'2Y':num(r[c2y]),'3Y':num(r[c3y]),'5Y':num(r[c5y]),'10Y':num(r[c10y]),'SI':num(r[csi])}}; stats.benchTriPreferred++; } }
      const rec = p.MF_PERF[nm]; if(!rec || rec.sheet!==sh) continue;
      if (cA>=0){ const v=num(r[cA]); if(v!=null){ if(rec.aum==null) stats.aumFromLabel++; else if(Math.abs(rec.aum-v)>1e-9) stats.aumOverridden++; else stats.aumKept++; rec.aum=v; } }
      rec.mcap = { Large: cL>=0?num(r[cL]):null, Mid: cM>=0?num(r[cM]):null, Small: cS>=0?num(r[cS]):null, Others: cO>=0?num(r[cO]):null }; stats.mcapAttached++;
      const dY = cY>=0?r4(num(r[cY])):null, dAM = cAM>=0?r4(num(r[cAM])):null, dMD = cMD>=0?r4(num(r[cMD])):null;
      if (dY!=null || dAM!=null || dMD!=null){ rec.debt={YTM:dY, AvgMat:dAM, ModDur:dMD}; stats.debtBlocks++; } else delete rec.debt;
    }
  });
  /* The Direct issue leaves four sheets unnamed ("Sheet43", "Others", "Sheet 44",
     "Sheet 45"); its Home index is misaligned by one and cannot be used positionally.
     A direct plan takes the category (sheet) and kind of its regular-plan sibling,
     which is what the embedded block has always carried. */
  if (regular){ const vote={}; const pending=[];
    Object.keys(p.MF_PERF).forEach(k => { const rec=p.MF_PERF[k]; if(!/^(sheet\s*\d+|others)$/i.test(rec.sheet)) return;
      const sib = regular[k.replace(/\(G\)-Direct Plan$/,'-Reg(G)')] || regular[k];
      if (sib && sib.sheet){ const v=vote[rec.sheet]||(vote[rec.sheet]={}); v[sib.sheet+''+sib.type]=(v[sib.sheet+''+sib.type]||0)+1; rec.sheet=sib.sheet; rec.type=sib.type; stats.sheetMapped++; }
      else pending.push(rec); });
    /* a direct-only plan with no regular sibling takes the category most of its sheet-mates resolved to */
    pending.forEach(rec => { const v=vote[rec.sheet]; if(!v){ stats.sheetUnmapped++; return; } const best=Object.keys(v).sort((a,b)=>v[b]-v[a])[0].split(''); rec.sheet=best[0]; rec.type=best[1]; stats.sheetMappedByMajority=(stats.sheetMappedByMajority||0)+1; }); }
  Object.keys(p.MF_PERF).forEach(k => { const rec=p.MF_PERF[k]; const allNullMcap = !rec.mcap || Object.values(rec.mcap).every(v=>v==null);
    if (rec.aum==null && !rec.inception && allNullMcap && !/fund|etf|fof|plan|scheme|\(g\)/i.test(k)){ rec.bm=true; stats.bm++; } });
  stats.bench = Object.keys(p.BENCH_RET).length;
  return { MF_PERF: p.MF_PERF, BENCH_RET: p.BENCH_RET, date: p.date, stats };
}

/* ---------- SIF Monitor ---------- */
function sifJunk(nm, aum, inception, cat, hasCatCol){
  const low = nm.toLowerCase();
  if (nm.length > 120) return true;                                   /* vendor disclaimer paragraph */
  if (/accord fintech|disclaimer/i.test(low)) return true;
  if (aum==null && !inception && (low.indexOf(' - tri')>=0 || /^(nifty|bse|crisil|s&p|sensex)\b/.test(low) || /\b(index|tri)$/.test(low))) return true;
  if (hasCatCol && !cat && aum==null) return true;                    /* no category, no AUM: not a scheme row */
  return false;
}
function buildSIF(X, E, file){
  const wb = X.read(fs.readFileSync(file), {type:'buffer', cellDates:true});
  const get = n => X.utils.sheet_to_json(wb.Sheets[n], {header:1, raw:true});
  const p = E.parsers.parseSIF(wb.SheetNames, get);
  const out = {}; const dropped = [];
  /* the runtime parser has no junk filter yet; apply the same rule the patch adds */
  const rows = get(wb.SheetNames[0]); const h=findHeader(rows); const hdr=rows[h]||[]; const hasCat = colInRow(hdr,['category'])>=0;
  let skipGroup=false; const groupSkipped=new Set();
  for (let i=h+1;i<rows.length;i++){ const nm=clean((rows[i]||[])[0]); if(!nm) continue; if(/^category\s*:/i.test(nm)){ skipGroup=/bench/i.test(nm); continue; } if(skipGroup) groupSkipped.add(nm); }
  Object.keys(p.SIF_PERF).forEach(k => { const r=p.SIF_PERF[k];
    if (groupSkipped.has(k) || sifJunk(k, r.aum, r.inception, r.category, hasCat)) { dropped.push(k.slice(0,60)); return; }
    /* the runtime maps `amc` from a "Month End" column; from Sep 2026 that column carries the
       month-end DATE, not a fund house. Nothing reads SIF .amc, but a date is not an AMC. */
    if (r.amc && /\bGMT[+-]\d{4}\b/.test(r.amc) && !isNaN(Date.parse(r.amc))) r.amc='';
    out[k]=r; });
  return { SIF_PERF: out, date: p.date, stats: { parsed: Object.keys(p.SIF_PERF).length, kept: Object.keys(out).length, dropped } };
}

/* ---------- analytics ---------- */
function collapseKeys(o){ const r={}; Object.keys(o).forEach(k=>{ const k2=ws1(k); r[k2]=(r[k2]||0)+o[k]; }); Object.keys(r).forEach(k=>r[k]=r4(r[k])); return r; }
function tidyEq(d){ d.mcap=collapseKeys(d.mcap); d.sector=collapseKeys(d.sector); d.stocks=d.stocks.map(s=>[ws1(s[0]), s[1], ws1(s[2])]); return d; }
function tidyDb(d, keepWeight){ d.sector=collapseKeys(d.sector); d.rating=collapseKeys(d.rating); const io={}; Object.keys(d.issuer).forEach(k=>{ io[ws1(k)]=d.issuer[k]; }); d.issuer=io; if(!keepWeight) delete d.weight; return d; }
function aoaOf(X, file){ const wb=X.read(fs.readFileSync(file),{type:'buffer',cellDates:true}); return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true}); }

function buildEquity(X, E, file, stockAcc){
  const aoa=aoaOf(X,file); const eq=E.parsers.parseEquitySide(aoa,'Equity',stockAcc);
  Object.keys(eq).forEach(k=>tidyEq(eq[k])); return eq;
}
function buildDebt(X, E, file){
  const aoa=aoaOf(X,file); const db=E.parsers.parseDebtSide(aoa);
  Object.keys(db).forEach(k=>tidyDb(db[k], false)); return db;
}
function buildHybrid(X, E, file, stockAcc){
  const aoa=aoaOf(X,file);
  const eq=E.parsers.parseEquitySide(aoa,'Equity',stockAcc);
  const nonEq=[aoa[0]].concat(aoa.slice(1).filter(r=>r && clean(r[9])!=='Equity'));
  const db=E.parsers.parseDebtSide(nonEq);
  const out={};
  Object.keys(eq).forEach(k=>{ (out[k]=out[k]||{}).eq=tidyEq(eq[k]); });
  Object.keys(db).forEach(k=>{ (out[k]=out[k]||{}).db=tidyDb(db[k], true); });
  return out;
}

/* ---------- stock master ---------- */
function buildStockInfo(X, stockAcc, masterFile, prev){
  const out={}; const st={fund:0, masterAdded:0, masterUpgraded:0, backfilled:0};
  const vote = (m, preferNonOthers) => { let best=null, bc=-1; Object.keys(m).forEach(k=>{ const c=m[k]; const kk=ws1(k)||'Others'; if(c>bc || (c===bc && preferNonOthers && best==='Others' && kk!=='Others')){ best=kk; bc=c; } }); return best||'Others'; };
  Object.keys(stockAcc).forEach(k=>{ const a=stockAcc[k]; out[k]=[vote(a.m,true), vote(a.s,false)]; st.fund++; });
  if (masterFile){ const aoa=aoaOf(X, masterFile); const hdr=(aoa[0]||[]).map(c=>clean(c).toLowerCase());
    const cN=hdr.indexOf('company name'), cS=hdr.indexOf('cd_sector'), cM=hdr.findIndex(c=>/mcap allocation|sebi mcap/.test(c));
    if(cN<0||cM<0) throw new Error('direct-equity master: columns not found: '+JSON.stringify(hdr));
    aoa.slice(1).forEach(r=>{ if(!r) return; const k=normco(r[cN]); if(!k) return; const mc=ws1(r[cM])||'Others', sec=ws1(cS>=0?r[cS]:'')||'Others';
      if(!out[k]){ out[k]=[mc,sec]; st.masterAdded++; } else if(out[k][0]==='Others' && mc!=='Others'){ out[k][0]=mc; st.masterUpgraded++; } }); }
  Object.keys(prev||{}).forEach(k=>{ if(!out[k]){ out[k]=prev[k]; st.backfilled++; } });
  return { STOCK_INFO: out, stats: st };
}
function buildStockRet(X, file){
  /* header found by name: the 30 Sep 2026 issue leaves three blank rows above it */
  const aoaAll=aoaOf(X,file); let h0=aoaAll.findIndex((r,i)=>i<20 && r && r.some(c=>/^company name$/i.test(clean(c)))); if(h0<0) h0=0;
  const aoa=aoaAll.slice(h0); const hdr=(aoa[0]||[]).map(c=>clean(c));
  const cN=hdr.findIndex(c=>/^company name$/i.test(c)), cI=hdr.findIndex(c=>/isin/i.test(c));
  const find=re=>hdr.findIndex(c=>re.test(c));
  const c3=find(/_3M$/), c6=find(/_6M$/), c1=find(/_1Y$/), c2=find(/_2Y_CAGR$/), c3y=find(/_3Y_CAGR$/), c5=find(/_5Y_CAGR$/);
  if([cN,c3,c6,c1,c2,c3y,c5].some(c=>c<0)) throw new Error('stock returns: columns not found: '+JSON.stringify(hdr.slice(0,12)));
  const asOn=(/_(\d{1,2}[A-Za-z]{3}\d{4})_/.exec(hdr[c3])||[])[1]||'';
  const out={}; const cnt={};
  aoa.slice(1).forEach(r=>{ if(!r||!r[cN]) return; const k=normco(r[cN]); if(!k) return;
    const rec={n:String(r[cN]), r:{'3M':r4(num(r[c3])),'6M':r4(num(r[c6])),'1Y':r4(num(r[c1])),'2Y':r4(num(r[c2])),'3Y':r4(num(r[c3y])),'5Y':r4(num(r[c5]))}, isin:cI>=0?clean(r[cI]):''};
    const c=Object.values(rec.r).filter(v=>v!=null).length;
    if(!(k in out) || c>=cnt[k]){ out[k]=rec; cnt[k]=c; } });
  return { STOCK_RET: out, asOn, rows: aoa.length-1 };
}

/* ---------- expense ratios ---------- */
function regKeyToDir(rk){ const m=/^(.+)-Reg\(G\)$/.exec(rk||''); return m ? m[1]+'(G)-Direct Plan' : null; }
function buildER(X, file, prev){
  /* The header row is found by name, not assumed at row 0: the Sep 2026 issue prepends a
     ">>CTB Output" banner and a group-header row (header on row 3) and reorders the columns. */
  const aoaAll=aoaOf(X,file); let h0=aoaAll.findIndex((r,i)=>i<20 && r && clean(r[0]).toLowerCase()==='scheme name'); if(h0<0) h0=0;
  const aoa=aoaAll.slice(h0); const hdr=(aoa[0]||[]).map(c=>clean(c).toLowerCase());
  const ci=l=>hdr.indexOf(l); const cN=ci('scheme name'), cB=ci('base expratio'), cDB=ci('direct plan base expratio'), cDR=ci('direct plan ratio'), cR=ci('ratio');
  if([cN,cB,cDB,cDR,cR].some(c=>c<0)) throw new Error('expense ratio: columns not found: '+JSON.stringify(hdr));
  const pct=v=>{ const x=num(v); return x==null?null:Math.round(x*100)/10000; };
  const T=JSON.parse(JSON.stringify(prev||{})); const st={rows:0, updated:0, added:0, sibUpdated:0, sibAdded:0, rNull:0, keptPrior:0, skippedEmpty:0, rotated:0, dirOverReg:0};
  /* expense ratios change slowly: a null in this month's issue keeps last month's value
     rather than blanking it, and a row with neither ratio never creates a key */
  aoa.slice(1).forEach(r=>{ if(!r) return; const nm=clean(r[cN]); if(!nm) return; st.rows++; let _clearD=false;
    /* BASE expense ratio for BOTH plans. The vendor publishes Base Expratio (the AMC fee) and
       Ratio (that plus GST and the other levies); the Cost tab has always documented .r/.d as
       the base figures, and this builder had the precedence inverted, so every TER shown was
       the all-in Ratio. Base-first also loses nothing: in the Aug 2026 issue no row carries a
       Ratio without a Base, and 6 carry a Base without a Ratio. */
    /* The vendor occasionally ships a row with its columns rotated. Aug 2026 states
       WSIF Equity Long-Short Fund-Reg(G) as 2.9 / 2.1 / 0.39 / 4.92 — a direct BASE of
       2.10 above its own direct RATIO of 0.39, which cannot happen: the base is the fee
       before GST and the other levies, so it is bounded by the all-in figure. July has the
       same fund the right way round (2.1 / 0.39 / 2.96 / 4.98). Taken at face value that row
       publishes a 2.10% direct ER against a true 0.39%. A side that fails the test is DROPPED,
       never corrected or guessed — dropping it lets the carry-forward below keep the last good
       published value, and the count is reported. */
    const _bR=num(r[cB]), _rR=num(r[cR]), _bD=num(r[cDB]), _rD=num(r[cDR]);
    /* Test A — a base above its own ratio is impossible, and it proves the row's columns are
       not where the header says they are, which indicts every cell in that row. So the WHOLE
       row is skipped and the carry-forward keeps the last good issue. */
    if((_bR!=null && _rR!=null && _bR>_rR) || (_bD!=null && _rD!=null && _bD>_rD)){ st.rotated++; return; }
    let rr=pct(_bR!=null?_bR:_rR); let dd=pct(_bD!=null?_bD:_rD); if(rr==null) st.rNull++;
    /* Test B — a direct plan cannot cost more than its own regular plan; that is what direct
       means. Jul and Aug 2026 both state LIC MF Gilt Fund-Reg(G) with no Direct Plan Base and a
       Direct Plan Ratio of 1.70 against a regular Ratio of 1.09, and the fund's own direct-plan
       row reads 0.59. Here the prior months carry the same defect, so the failing side is
       CLEARED rather than carried: the Cost tab then falls through to the Direct MF Monitor,
       which publishes a real figure, instead of showing an impossible one. */
    if(rr!=null && dd!=null && dd>rr){ st.dirOverReg++; dd=null; _clearD=true; }
    const old=T[nm]||null;
    if(rr==null && old && old.r!=null){ rr=old.r; st.keptPrior++; }
    if(dd==null && !_clearD && old && old.d!=null){ dd=old.d; }
    if(rr==null && dd==null){ st.skippedEmpty++; return; }
    if(old) st.updated++; else st.added++; T[nm]={r:rr, d:dd};
    const dk=regKeyToDir(nm) || (/\(G\)$/.test(nm) && T[nm+'-Direct Plan'] ? nm+'-Direct Plan' : null);
    if(dk && dd!=null){ if(T[dk]) st.sibUpdated++; else st.sibAdded++; T[dk]={r:dd, d:null}; } });
  return { MF_ER_TABLE: T, stats: st };
}

/* ---------- fund managers ---------- */
function buildFundMgr(X, file, keys){
  const wb=X.read(fs.readFileSync(file),{type:'buffer', raw:true}); const aoa=X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true});
  const hdr=(aoa[0]||[]).map(c=>clean(c).toLowerCase()); const ci=l=>hdr.indexOf(l);
  const cN=ci('scheme name'), cI=ci('inception date'), cM=ci('fund manager'), cF=ci('from date'), cT=ci('to date');
  if([cN,cI,cM,cF,cT].some(c=>c<0)) throw new Error('fund manager: columns not found: '+JSON.stringify(hdr));
  const ser=v=>(typeof v==='number'&&isFinite(v)) ? new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000).toISOString().slice(0,10) : null;
  const raw=[]; let seps=0, badDate=0;
  aoa.slice(1).forEach(r=>{ if(!r) return; const a=r[cN]; if(a==null||clean(a)==='') return; if(/^\s*Scheme Name\s*:/i.test(String(a))){ seps++; return; }
    const m=clean(r[cM]); if(!m) return; if(typeof r[cF]!=='number'||typeof r[cT]!=='number'){ badDate++; return; }
    raw.push({name:clean(a), mgr:m, inc:r[cI], from:r[cF], to:r[cT]}); });
  if(badDate) throw new Error(badDate+' stint rows carry a non-serial date');
  let maxTo=-Infinity; raw.forEach(s=>{ if(s.to>maxTo) maxTo=s.to; }); const asOf=ser(maxTo);
  const BLOCK={'Aditya Birla SL ELSS Tax Saver Fund(IDCW)':1,'Aditya Birla SL Large & Mid Cap Fund-Reg(IDCW)':1};
  const byNorm={}; keys.forEach(k=>{ const n=normName(k); if(!(n in byNorm)) byNorm[n]=k; });
  const bySrc={}; raw.forEach(s=>(bySrc[s.name]=bySrc[s.name]||[]).push(s));
  /* The universe issue (Aug 2026: 2,101 schemes) reports an OPEN stint's "To Date" as the
     date that scheme was last collected — 1,580 schemes at 31 Jul, 481 at 31 Aug, 38 at
     30 Jun — not as one file-wide as-of. tools/parse-fund-mgr.js was written for the
     curated 104-scheme issue where every open stint carried the same date, and its
     file-max rule would leave 1,618 schemes with no serving manager. A stint is therefore
     current when its To equals ITS OWN SCHEME's latest To. */
  const out={}; const st={separators:seps, stints:raw.length, schemes:Object.keys(bySrc).length, exact:0, viaReg:0, blocked:0, unmatched:0, serving:0, collisions:0, toDates:{}};
  Object.keys(bySrc).forEach(src=>{ let key=null;
    if(BLOCK[src]){ st.blocked++; return; }
    const dm=/^(.+)\(G\)-Direct Plan$/.exec(src);                         /* direct-only funds the monitor now lists as -Reg(G) */
    if(byNorm[normName(src)]){ key=byNorm[normName(src)]; st.exact++; }
    else if(dm && byNorm[normName(dm[1]+'-Reg(G)')]){ key=byNorm[normName(dm[1]+'-Reg(G)')]; st.viaReg++; }
    else { key=src; st.unmatched++; }
    if(out[key]){ st.collisions++; return; }
    const list=bySrc[src]; let inc=null; for(const s of list){ const v=ser(s.inc); if(v){ inc=v; break; } }
    let schemeMax=-Infinity; list.forEach(s=>{ if(s.to>schemeMax) schemeMax=s.to; }); const smIso=ser(schemeMax); st.toDates[smIso]=(st.toDates[smIso]||0)+1;
    const stints=list.map(s=>{ const rec={m:s.mgr, from:ser(s.from), to:ser(s.to), cur:s.to===schemeMax}; if(rec.cur) st.serving++; return rec; })
      .sort((a,b)=>(a.from<b.from?1:a.from>b.from?-1:(a.m<b.m?-1:1)));
    const rec={stints}; if(inc) rec.inc=inc; if(key!==src) rec.src=src; out[key]=rec; });
  return { FUND_MGR: out, FUND_MGR_META: {asOf, schemes:Object.keys(out).length, stints:raw.length, serving:st.serving}, stats: st };
}

/* ---------- slides ---------- */
function buildSlides(dir){
  const files=fs.readdirSync(dir).filter(f=>/^slide\d+\.jpe?g$/i.test(f)).sort((a,b)=>parseInt(a.match(/\d+/)[0])-parseInt(b.match(/\d+/)[0]));
  if(!files.length) throw new Error('no slideN.jpg files in '+dir);
  return files.map(f=>'data:image/jpeg;base64,'+fs.readFileSync(path.join(dir,f)).toString('base64'));
}

/* ---------- July fidelity report ---------- */
function agree(label, mine, emb, tol){
  const mk=Object.keys(mine), ek=Object.keys(emb); const es=new Set(ek), ms=new Set(mk);
  let same=0, close=0, diff=0; const ex=[];
  const deepClose=(a,b)=>{ if(a===b) return true; if(typeof a==='number'&&typeof b==='number') return Math.abs(a-b)<=tol; if(a==null||b==null) return a==b; if(typeof a!=='object'||typeof b!=='object') return false;
    if(Array.isArray(a)!==Array.isArray(b)) return false; const ka=Object.keys(a), kb=Object.keys(b); if(ka.length!==kb.length) return false; return ka.every(k=>deepClose(a[k],b[k])); };
  mk.forEach(k=>{ if(!es.has(k)) return; if(JSON.stringify(mine[k])===JSON.stringify(emb[k])) same++; else if(deepClose(mine[k],emb[k])) close++; else { diff++; if(ex.length<2) ex.push(k); } });
  console.log(`  ${label.padEnd(18)} mine ${String(mk.length).padStart(5)}  emb ${String(ek.length).padStart(5)}  identical ${same}  within-tol ${close}  differ ${diff}  onlyMine ${mk.filter(k=>!es.has(k)).length}  onlyEmb ${ek.filter(k=>!ms.has(k)).length}` + (ex.length?('  e.g. '+ex.join(' ; ')):''));
}

function main(){
  const src=argv('src'), date=argv('date'), out=argv('out'), slidesDir=argv('slides'), verify=argv('verify',false)===true;
  if(!src||!date) throw new Error('usage: --src <folder> --date "31 Aug 2026" [--slides <dir>] [--out file.json] [--verify]');
  const H=load(); const X=H.XLSX, E=H.E, REF=H.REF;
  const F=findFiles(src); console.log('sources:'); Object.keys(F).forEach(k=>console.log('  '+k.padEnd(12)+(F[k]?path.basename(F[k]):'— (not supplied)')));
  const t0=Date.now(); const report={date, sources:{}}; Object.keys(F).forEach(k=>report.sources[k]=F[k]?path.basename(F[k]):null);
  const B={};
  if(F.monReg){ const m=buildMonitor(X,E,F.monReg); B.MF_PERF=m.MF_PERF; B.BENCH_RET=m.BENCH_RET; report.monReg=Object.assign({date:m.date},m.stats); console.log('MF_PERF', JSON.stringify(report.monReg)); }
  if(F.monDir){ const m=buildMonitor(X,E,F.monDir,B.MF_PERF||REF.MF_PERF); B.MF_PERF_DIRECT=m.MF_PERF; report.monDir=Object.assign({date:m.date},m.stats); console.log('MF_PERF_DIRECT', JSON.stringify(report.monDir)); }
  if(F.sif){ const s=buildSIF(X,E,F.sif); B.SIF_PERF=s.SIF_PERF; report.sif=s.stats; console.log('SIF_PERF', JSON.stringify(s.stats)); }
  const stockAcc={};
  if(F.eqAn){ B.EQUITY_ANALYTICS=buildEquity(X,E,F.eqAn,stockAcc); const carried=Object.keys(REF.EQUITY_ANALYTICS).filter(k=>REF.EQUITY_ANALYTICS[k].pcls); carried.forEach(k=>{ if(!B.EQUITY_ANALYTICS[k]) B.EQUITY_ANALYTICS[k]=REF.EQUITY_ANALYTICS[k]; }); report.equity={schemes:Object.keys(B.EQUITY_ANALYTICS).length, pmsAifCarried:carried.length}; console.log('EQUITY_ANALYTICS', JSON.stringify(report.equity)); }
  if(F.hyAn){ B.HYBRID_ANALYTICS=buildHybrid(X,E,F.hyAn,stockAcc); const n=Object.keys(B.HYBRID_ANALYTICS); report.hybrid={schemes:n.length, withEq:n.filter(k=>B.HYBRID_ANALYTICS[k].eq).length, withDb:n.filter(k=>B.HYBRID_ANALYTICS[k].db).length}; console.log('HYBRID_ANALYTICS', JSON.stringify(report.hybrid)); }
  if(F.dbAn){ B.DEBT_ANALYTICS=buildDebt(X,E,F.dbAn); report.debt={schemes:Object.keys(B.DEBT_ANALYTICS).length}; console.log('DEBT_ANALYTICS', JSON.stringify(report.debt)); }
  /* Coverage gaps: a scheme that is still listed in this month's monitor under the SAME
     key but is absent from every analytics file supplied this month keeps last month's
     look-through, tagged with its vintage (the PMS precedent in CLAUDE.md). Renamed or
     closed schemes are never carried — a stale key would shadow the fresh one in the
     fuzzy-match pool. Aug 2026: 23 children's / retirement schemes left the vendor's
     Hybrid file while staying in the monitor. */
  if(B.EQUITY_ANALYTICS && B.HYBRID_ANALYTICS && B.DEBT_ANALYTICS && (B.MF_PERF||B.MF_PERF_DIRECT)){
    const inAny=k=>B.EQUITY_ANALYTICS[k]||B.HYBRID_ANALYTICS[k]||B.DEBT_ANALYTICS[k];
    /* Deliberately MF monitors only. The Sep 2026 analytics issue dropped every SIF scheme (29 in
       Aug, 0 in Sep), but SIF look-through rows carry no product class, so a SIF HOLDING never
       reaches them ("No SIF look-through data exists") — carried forward they would only sit in
       the mutual-fund match pool as false-positive candidates. */
    const stillListed=k=>(B.MF_PERF||REF.MF_PERF)[k]||(B.MF_PERF_DIRECT||REF.MF_PERF_DIRECT)[k];
    const prevDate=(REF.DATA_DATES||{}).analytics||''; report.carried={};
    [['EQUITY_ANALYTICS',REF.EQUITY_ANALYTICS],['HYBRID_ANALYTICS',REF.HYBRID_ANALYTICS],['DEBT_ANALYTICS',REF.DEBT_ANALYTICS]].forEach(([name,prev])=>{
      const carried=[]; Object.keys(prev).forEach(k=>{ if(prev[k].pcls||inAny(k)||!stillListed(k)) return; B[name][k]=Object.assign({}, prev[k], {vintage: prev[k].vintage||prevDate}); carried.push(k); });
      report.carried[name]=carried; if(carried.length) console.log(name+' carried forward at '+prevDate+' vintage: '+carried.length+' — '+carried.join(' | ')); });
  }
  if(F.eqAn||F.hyAn){ const si=buildStockInfo(X,stockAcc,F.stockMaster,REF.STOCK_INFO); B.STOCK_INFO=si.STOCK_INFO; report.stockInfo=Object.assign({total:Object.keys(si.STOCK_INFO).length},si.stats); console.log('STOCK_INFO', JSON.stringify(report.stockInfo)); }
  if(F.stockRet){ const sr=buildStockRet(X,F.stockRet); B.STOCK_RET=sr.STOCK_RET; report.stockRet={total:Object.keys(sr.STOCK_RET).length, rows:sr.rows, asOn:sr.asOn}; console.log('STOCK_RET', JSON.stringify(report.stockRet)); }
  if(F.er){ const er=buildER(X,F.er,global.MF_ER_TABLE); B.MF_ER_TABLE=er.MF_ER_TABLE; report.er=Object.assign({total:Object.keys(er.MF_ER_TABLE).length, prev:Object.keys(global.MF_ER_TABLE||{}).length},er.stats); console.log('MF_ER_TABLE', JSON.stringify(report.er)); }
  if(F.fmgr){ const keys=Object.keys(B.MF_PERF||REF.MF_PERF).concat(Object.keys(B.SIF_PERF||{})); const fm=buildFundMgr(X,F.fmgr,keys); B.FUND_MGR=fm.FUND_MGR; B.FUND_MGR_META=fm.FUND_MGR_META; report.fmgr=Object.assign({},fm.FUND_MGR_META,fm.stats); console.log('FUND_MGR', JSON.stringify(report.fmgr)); }
  if(slidesDir){ B.MARKET_UPDATE_IMAGES=buildSlides(slidesDir); report.slides=B.MARKET_UPDATE_IMAGES.length; console.log('MARKET_UPDATE_IMAGES', report.slides); }
  B.DATA_DATES=Object.assign({}, REF.DATA_DATES, F.eqAn?{analytics:date}:{}, F.monReg?{performance:date}:{}, F.monDir?{direct:date}:{}, F.fmgr?{fmgr:date}:{}, F.sif?{sif:date}:{});
  report.DATA_DATES=B.DATA_DATES; console.log('DATA_DATES', JSON.stringify(B.DATA_DATES));
  console.log('built in '+((Date.now()-t0)/1000).toFixed(1)+'s');

  if(verify){
    console.log('\n== agreement with the embedded blocks (tolerance 0.002 on numbers) ==');
    if(B.MF_PERF) agree('MF_PERF', B.MF_PERF, REF.MF_PERF, 0.002);
    if(B.MF_PERF_DIRECT) agree('MF_PERF_DIRECT', B.MF_PERF_DIRECT, REF.MF_PERF_DIRECT, 0.002);
    if(B.BENCH_RET) agree('BENCH_RET', B.BENCH_RET, REF.BENCH_RET, 0.002);
    if(B.EQUITY_ANALYTICS) agree('EQUITY_ANALYTICS', B.EQUITY_ANALYTICS, REF.EQUITY_ANALYTICS, 0.002);
    if(B.HYBRID_ANALYTICS) agree('HYBRID_ANALYTICS', B.HYBRID_ANALYTICS, REF.HYBRID_ANALYTICS, 0.002);
    if(B.DEBT_ANALYTICS) agree('DEBT_ANALYTICS', B.DEBT_ANALYTICS, REF.DEBT_ANALYTICS, 0.002);
    if(B.STOCK_INFO) agree('STOCK_INFO', B.STOCK_INFO, REF.STOCK_INFO, 0);
    if(B.STOCK_RET) agree('STOCK_RET', B.STOCK_RET, REF.STOCK_RET, 0.002);
    if(B.MF_ER_TABLE) agree('MF_ER_TABLE', B.MF_ER_TABLE, global.MF_ER_TABLE, 0.00005);
    if(B.FUND_MGR) agree('FUND_MGR', B.FUND_MGR, REF.FUND_MGR, 0);
    if(B.MF_PERF){ /* the two documented regressions, asserted */
      const debt=Object.values(B.MF_PERF).filter(r=>r.debt).length, allNull=Object.values(B.MF_PERF).filter(r=>r.debt&&r.debt.YTM==null&&r.debt.AvgMat==null&&r.debt.ModDur==null).length;
      const aumNull=Object.values(B.MF_PERF).filter(r=>r.aum==null&&!r.bm).length;
      console.log(`  MF_PERF debt blocks ${debt} (all-null ${allNull})  aum-null non-benchmark records ${aumNull}`); }
  }
  if(out){ fs.writeFileSync(out, JSON.stringify({blocks:B, report})); console.log('wrote '+out+' ('+fs.statSync(out).size.toLocaleString()+' bytes)'); }
}
if(require.main===module) main();
module.exports = { buildER, buildStockRet, regKeyToDir, aoaOf, clean, num };
