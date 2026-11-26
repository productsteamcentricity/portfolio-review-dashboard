/* ============================================================================
   KI-032 — the IRR client join: exact, else a unique name variant, else none.

     node tools/regression/KI-032-irr-client-join.js

   Before the fix a base-file client with no exact name in the IRR file took
   whichever IRR client shared the most name words (at least two; the first in
   the file on a tie), so a client without transactions showed a family
   member's Grand Total XIRR and that member's transaction XIRRs on every
   holding whose name matched one of the member's instruments, and an
   individual could take an HUF's flows (owner's decision 26 Nov 2026,
   "Careful variant match"; tools/patches/2026-11-26-ki032-irr-client-join.js).

   Known answers. tools/make-sample-base.js writes two clients whose holdings
   are priced off constant-growth NAV paths and whose exact flows are in the IRR
   workbook. Each case below renames the clients in the base file and in the
   IRR flows (and drops or copies flows), runs the review, and checks:
   - the join counts (model.irrJoin);
   - a joined client: its Grand Total XIRR / BMXIRR equal this file's own
     bisection XIRR (actual/365) of the flows of the IRR client it must join,
     and each holding's XIRR / BMXIRR equal that IRR client's flows for the
     instrument of the same name (the synthetic names agree by construction);
   - a client that must not join: the Grand Total is the base file's
     CMV-weighted figure (xcov is set), every holding keeps its base-file XIRR /
     BMXIRR, and the § note says why, naming no one;
   - a variant join is named in the client's § note.
   Synthetic data only. Exit code 1 on any failure.
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');
const { build } = require('../make-sample-base.js');

const H = load();
const { XLSX, E } = H;
const fx = build(H);

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const aoa = (wb, n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
const base0 = aoa(XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true }), 'Base File');
const wbI = XLSX.read(fx.irrBuf, { type: 'buffer', cellDates: true });
const irr0 = E.parsers.parseIRR(wbI.SheetNames, n => aoa(wbI, n));
const META = { familyName: 'Sample Family', asOnDate: '30 Sep 2026' };
const A = 'Sample Client A', B = 'Sample Client B';
const CLI = base0[0].indexOf('Client Name');

/* independent XIRR: actual/365, plain bisection on [-99%, 1000%] to a 1e-14 bracket */
function myXirr(cf) {
  if (cf.length < 2 || !cf.some(c => c.a > 0) || !cf.some(c => c.a < 0)) return null;
  const t0 = Math.min(...cf.map(c => +c.d));
  if (!cf.some(c => +c.d > t0)) return null;
  const npv = r => cf.reduce((s, c) => s + c.a / Math.pow(1 + r, (c.d - t0) / 86400000 / 365), 0);
  let lo = -0.99, hi = 10, flo = npv(lo);
  if ((flo < 0) === (npv(hi) < 0)) return null;
  for (let i = 0; i < 300 && hi - lo > 1e-14; i++) {
    const m = (lo + hi) / 2, fm = npv(m);
    if ((flo < 0) !== (fm < 0)) hi = m; else { lo = m; flo = fm; }
  }
  return (lo + hi) / 2;
}
const near = (x, y) => (x == null && y == null) || (x != null && y != null && Math.abs(x - y) < 1e-6);

/* one case: base clients renamed (map old -> new), IRR flows renamed (map old -> new, or an array of new names to
   copy the flows under each), flows of some clients dropped */
function runCase(o) {
  const base = base0.map((r, i) => { const c = r.slice(); if (i > 0 && o.base[c[CLI]] !== undefined) c[CLI] = o.base[c[CLI]]; return c; });
  const ren = (list) => {
    const out = [];
    list.forEach(t => {
      if ((o.drop || []).indexOf(t.client) >= 0) return;
      const to = o.irr[t.client] !== undefined ? o.irr[t.client] : t.client;
      (Array.isArray(to) ? to : [to]).forEach(n => out.push(Object.assign({}, t, { client: n })));
    });
    return out;
  };
  const irr = { fund: ren(irr0.fund), bench: ren(irr0.bench), date: irr0.date };
  const rows = E.parseBaseRows(base.map(r => r.slice()));
  const baseX = {};
  rows.forEach(h => { baseX[h.client + '|' + h.name] = { x: h.xirrFrac, b: h.bmxirrFrac }; });
  const m = E.computeReview(rows, Object.assign({}, H.REF, { IRR: irr }), META);
  return { m, irr, baseX };
}

/* checks one base client: joined to IRR client `to` (its flows are the original flows of `from`), or not joined */
function checkClient(tag, r, name, to, from, notePart) {
  const cl = r.m.clients.find(c => c.name === name);
  if (!cl) { ok(false, tag + ': client ' + name + ' on the sheet'); return; }
  const g = cl.rows.find(x => x.level === 'grand');
  const hold = r.m.holdings.filter(h => h.client === name);
  if (to) {
    const fF = irr0.fund.filter(t => t.client === from), fB = irr0.bench.filter(t => t.client === from);
    const tx = myXirr(fF), tb = myXirr(fB);
    ok(g.xcov == null && near(g.xirr, tx * 100) && near(g.bmxirr, tb * 100),
      tag + ': ' + name + ' Grand Total = the XIRR / BMXIRR of the flows it must join (' + (tx * 100).toFixed(4) + '% / ' + (tb * 100).toFixed(4) + '%)');
    let n = 0, good = 0;
    hold.forEach(h => {
      const fi = fF.filter(t => t.instrument === h.name), bi = fB.filter(t => t.instrument === h.name);
      if (!fi.length) return;
      n++;
      if (near(h.xirrFrac, myXirr(fi)) && near(h.bmxirrFrac, myXirr(bi))) good++;
    });
    ok(n > 0 && good === n, tag + ': ' + name + ' holdings take the transaction XIRR of the joined client (' + good + '/' + n + ')');
  } else {
    ok(g.xcov != null, tag + ': ' + name + ' Grand Total is the base file\'s CMV-weighted figure (no join)');
    const kept = hold.filter(h => { const b = r.baseX[h.client + '|' + h.name]; return b && near(h.xirrFrac, b.x) && near(h.bmxirrFrac, b.b); }).length;
    ok(hold.length > 0 && kept === hold.length, tag + ': ' + name + ' holdings keep the base file\'s XIRR / BMXIRR (' + kept + '/' + hold.length + ')');
  }
  if (notePart) ok(String(cl.irrNote || '').indexOf(notePart) >= 0, tag + ': ' + name + ' § note says "' + notePart + '"');
  if (notePart !== undefined && !to) ok(!/sample|shah|mehta|rajesh|priya|anil|meera|iyer/i.test(String(cl.irrNote || '').replace(/^§ /, '')), tag + ': the note names no one');
}
const counts = (tag, r, want) => ok(JSON.stringify(r.m.irrJoin) === JSON.stringify(want), tag + ': join counts ' + JSON.stringify(r.m.irrJoin) + ' = ' + JSON.stringify(want));

/* 0. exact names: unchanged behaviour */
let r = runCase({ base: {}, irr: {} });
counts('exact', r, { exact: 2, variant: 0, refused: 0, none: 0 });
checkClient('exact', r, A, A, A);
checkClient('exact', r, B, B, B);

/* 1. KI-032 as reproduced: a family member without transactions shares two words with a client that has them */
r = runCase({ base: { [A]: 'Rajesh Kumar Shah', [B]: 'Priya Rajesh Shah' }, irr: { [A]: 'Rajesh Kumar Shah' }, drop: [B] });
counts('family member', r, { exact: 1, variant: 0, refused: 1, none: 0 });
checkClient('family member', r, 'Rajesh Kumar Shah', 'Rajesh Kumar Shah', A);
checkClient('family member', r, 'Priya Rajesh Shah', null, null, 'Not joined to a client in the IRR file: the IRR client with a similar name is another client\'s exact name');

/* 2. the same, with the other member only in the IRR file: the first names differ, so no join */
r = runCase({ base: { [A]: 'Priya Rajesh Shah' }, irr: { [A]: 'Rajesh Shah' } });
counts('IRR-only member', r, { exact: 1, variant: 0, refused: 1, none: 0 });
checkClient('IRR-only member', r, 'Priya Rajesh Shah', null, null, 'Not joined to a client in the IRR file: the names differ by more than a salutation, initials, a middle name or the word order');

/* 3. an individual never takes an HUF's flows */
r = runCase({ base: { [A]: 'Rajesh Shah' }, irr: { [A]: 'Rajesh Shah HUF' } });
counts('HUF', r, { exact: 1, variant: 0, refused: 1, none: 0 });
checkClient('HUF', r, 'Rajesh Shah', null, null, 'Not joined to a client in the IRR file: the IRR client with a similar name is a different entity or holder');

/* 4. a salutation and an initial: joined, and said so */
r = runCase({ base: { [A]: 'Mr. Anil K. Mehta' }, irr: { [A]: 'ANIL KUMAR MEHTA' } });
counts('salutation + initial', r, { exact: 1, variant: 1, refused: 0, none: 0 });
checkClient('salutation + initial', r, 'Mr. Anil K. Mehta', 'ANIL KUMAR MEHTA', A, 'joined to the IRR file\'s client by a name variant');
checkClient('salutation + initial', r, B, B, B);

/* 5. a middle name more in the IRR file: joined */
r = runCase({ base: { [A]: 'Anil Mehta' }, irr: { [A]: 'Anil Kumar Mehta' } });
counts('middle name', r, { exact: 1, variant: 1, refused: 0, none: 0 });
checkClient('middle name', r, 'Anil Mehta', 'Anil Kumar Mehta', A, 'joined to the IRR file\'s client by a name variant');

/* 6. two IRR clients could be the base client: no join (the old rule took the first in the file) */
r = runCase({ base: { [A]: 'Anil Mehta' }, irr: { [A]: ['Anil Kumar Mehta', 'Anil Raj Mehta'] } });
counts('two candidates', r, { exact: 1, variant: 0, refused: 1, none: 0 });
checkClient('two candidates', r, 'Anil Mehta', null, null, 'Not joined to a client in the IRR file: more than one client in the IRR file could be this client');

/* 7. one IRR client could be either of two base clients: neither joins */
r = runCase({ base: { [A]: 'Anil Mehta', [B]: 'Anil Kumar R Mehta' }, irr: { [A]: 'Anil Kumar Mehta' }, drop: [B] });
counts('shared candidate', r, { exact: 0, variant: 0, refused: 2, none: 0 });
checkClient('shared candidate', r, 'Anil Mehta', null, null, 'Not joined to a client in the IRR file: the IRR client with a similar name could also be another client');
checkClient('shared candidate', r, 'Anil Kumar R Mehta', null, null, 'Not joined to a client in the IRR file: the IRR client with a similar name could also be another client');

/* 8. the synthetic book's own names, B without transactions (the side-by-side kit's SB-03 case): "Sample Client B"
   shares two words with "Sample Client A", which is A's exact name, so B is not joined (the old rule took A's flows) */
r = runCase({ base: {}, irr: {}, drop: [B] });
counts('sample names', r, { exact: 1, variant: 0, refused: 1, none: 0 });
checkClient('sample names', r, B, null, null, 'Not joined to a client in the IRR file: the IRR client with a similar name is another client\'s exact name');

/* 9. no IRR client near the name: the plain "no transactions" note, unchanged */
r = runCase({ base: { [B]: 'Meera Iyer' }, irr: {}, drop: [B] });
counts('no transactions', r, { exact: 1, variant: 0, refused: 0, none: 1 });
checkClient('no transactions', r, 'Meera Iyer', null, null, '§ No transactions for this client in the IRR file: XIRR/BMXIRR are the base file\'s, CMV-weighted.');
ok(String(r.m.clients.find(c => c.name === 'Meera Iyer').irrNote).indexOf('Not joined') < 0, 'no transactions: no "Not joined" sentence when no IRR client was near');

/* Round 2 (financial review of d12eeeb): the marker words in brackets, the H.U.F. and U/G spellings, other holders
   (a minor, a guardian, a joint name, junior / senior, a late holder), the word order, initials first, M/S and Smt. */
const ENT = 'Not joined to a client in the IRR file: the IRR client with a similar name is a different entity or holder';
const refusedEntity = (tag, baseName, irrName) => {
  const rr = runCase({ base: { [A]: baseName }, irr: { [A]: irrName } });
  counts(tag, rr, { exact: 1, variant: 0, refused: 1, none: 0 });
  checkClient(tag, rr, baseName, null, null, ENT);
};
/* 11. "(HUF)" in brackets is an HUF, not the individual (before: the exact key of the individual) */
refusedEntity('(HUF) in brackets', 'Rajesh Shah', 'Rajesh Shah (HUF)');
/* 12. the individual and the HUF both in the IRR file: two clients, their flows kept apart */
r = runCase({ base: { [A]: 'Rajesh Shah', [B]: 'Rajesh Shah (HUF)' }, irr: { [A]: 'Rajesh Shah', [B]: 'Rajesh Shah (HUF)' } });
counts('individual and HUF', r, { exact: 2, variant: 0, refused: 0, none: 0 });
checkClient('individual and HUF', r, 'Rajesh Shah', 'Rajesh Shah', A);
checkClient('individual and HUF', r, 'Rajesh Shah (HUF)', 'Rajesh Shah (HUF)', B);
/* 13. H.U.F. spelt with stops */
refusedEntity('H.U.F.', 'Rajesh Shah', 'Rajesh Shah H.U.F.');
/* 14. a minor, in brackets */
refusedEntity('(Minor)', 'Aarav Shah', 'Aarav Shah (Minor)');
/* 15. a guardian: U/G and Thru */
refusedEntity('U/G', 'Aarav Shah', 'Aarav Shah U/G Rajesh Shah');
refusedEntity('Thru', 'Aarav Shah', 'Aarav Shah Thru Rajesh Shah');
/* 16. a joint name */
refusedEntity('joint name', 'Rajesh Shah', 'Rajesh Shah & Priya Shah');
/* 17. junior, and a late holder */
refusedEntity('Jr', 'Rajesh Shah', 'Rajesh Shah Jr');
refusedEntity('Late', 'Rajesh Shah', 'Late Rajesh Shah');
refusedEntity('Karta', 'Rajesh Shah', 'Rajesh Shah Karta');
/* 18. the surname first, the same words: joined, and said so */
r = runCase({ base: { [A]: 'Shah Rajesh' }, irr: { [A]: 'Rajesh Shah' } });
counts('word order', r, { exact: 1, variant: 1, refused: 0, none: 0 });
checkClient('word order', r, 'Shah Rajesh', 'Rajesh Shah', A, 'by a name variant (a salutation, initials, a middle name or the word order)');
/* 19. Smt. dropped as a salutation: joined */
r = runCase({ base: { [A]: 'Smt. Priya Shah' }, irr: { [A]: 'PRIYA SHAH' } });
counts('Smt', r, { exact: 1, variant: 1, refused: 0, none: 0 });
checkClient('Smt', r, 'Smt. Priya Shah', 'PRIYA SHAH', A, 'joined to the IRR file\'s client by a name variant');
/* 20. initials first (one full word only): never joined */
r = runCase({ base: { [A]: 'K S Ramesh' }, irr: { [A]: 'Kothandaraman Subramaniam Ramesh' } });
counts('initials first', r, { exact: 1, variant: 0, refused: 0, none: 1 });
checkClient('initials first', r, 'K S Ramesh', null, null, '§ No transactions for this client in the IRR file');
/* 21. M/S: not joined (its letters are not a first name) */
r = runCase({ base: { [A]: 'M/S ABC Traders' }, irr: { [A]: 'ABC Traders' } });
counts('M/S', r, { exact: 1, variant: 0, refused: 1, none: 0 });
checkClient('M/S', r, 'M/S ABC Traders', null, null, 'Not joined to a client in the IRR file: the names differ');
/* 22. two more words in the longer name: not joined (one middle name at most) */
r = runCase({ base: { [A]: 'Anil Mehta' }, irr: { [A]: 'Anil Kumar Raj Mehta' } });
counts('two middle names', r, { exact: 1, variant: 0, refused: 1, none: 0 });
checkClient('two middle names', r, 'Anil Mehta', null, null, 'Not joined to a client in the IRR file: the names differ');
/* 23. punctuation and spacing: still the exact key (the key of a name without markers is unchanged) */
r = runCase({ base: { [A]: 'SAMPLE CLIENT-A.' }, irr: {} });
counts('punctuation', r, { exact: 2, variant: 0, refused: 0, none: 0 });
checkClient('punctuation', r, 'SAMPLE CLIENT-A.', A, A);
/* 24. each client sheet says how it joined */
r = runCase({ base: { [A]: 'Mr. Anil K. Mehta' }, irr: { [A]: 'ANIL KUMAR MEHTA' }, drop: [B] });
ok(r.m.clients.find(c => c.name === 'Mr. Anil K. Mehta').irrJoin === 'variant' && r.m.clients.find(c => c.name === B).irrJoin === 'none', 'client sheets carry irrJoin (variant, none)');

/* 10. the family Fund IRR tree groups by the IRR file's own labels: the same with and without the renames */
const famXirr = (rr) => { const t = (rr.m.irr || []).find(x => x.level === 0); return t ? [t.fund, t.bench] : null; };
const f0 = famXirr(runCase({ base: {}, irr: {} })), f1 = famXirr(runCase({ base: { [A]: 'Rajesh Shah' }, irr: { [A]: 'Rajesh Shah HUF' } }));
ok(f0 && f1 && near(f0[0], f1[0]) && near(f0[1], f1[1]), 'family Fund IRR tree: unchanged by the client join');

console.log(fail ? `\n${fail} check(s) FAILED` : '\nall KI-032 checks passed');
process.exit(fail ? 1 : 0);
