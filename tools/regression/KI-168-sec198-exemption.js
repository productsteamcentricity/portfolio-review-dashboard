/* ============================================================================
   KI-168 (TX-09, closes KI-130) — the Rs 1.25 lakh Sec 198 exemption, per person
   and per tax year, applied after set-off; the analyst enters the part already
   used (default 0).

     node tools/regression/KI-168-sec198-exemption.js

   Tax Reckoner TY 2026-27, Master Summary R3 ("Equity LTCG under Sec 198 is taxed at 12.5%
   only above Rs 1.25 lakh a year, one limit shared across shares, equity funds and business
   trust units") and column J (Rs 1.25 lakh on R8 shares, R10 equity funds, R11 ELSS, R12
   equity ETFs, R13 equity ETF FoF, R18 aggressive hybrid, R38 REIT, R39 InvIT; R37 SIF only
   if equity-taxed; "None" on every Sec 197 row); Exemptions & Set-off R10 ("Losses are set
   off FIRST; the Rs 1.25 lakh threshold then applies to the remaining Sec 198 gains").
   Before the fix every long-term gain was taxed at 12.5% in full (KI-130) and the footnote
   implied an exemption for Sec 197 gains too. D-040 (f).

   Known answers (as on 30 Sep 2026, long-term lots bought 15 Jan 2024; gains are units x
   price in rupees, tax 12.5% of the part above Rs 1,25,000):
     equity fund gain Rs 1,00,000 -> 0;  Rs 1,25,000 -> 0;  Rs 1,25,001 -> Rs 0.125;
     Rs 1,50,000 -> Rs 3,125 (was 12,500 / 15,625 / 15,625.13 / 18,750);
     gain 1,00,000 and a long-term loss 1,00,000 -> 0 / 0 / 0 (was 12,500 / 0 / 12,500);
     equity +1,50,000, listed bond +1,00,000, long-term loss -1,00,000, in either size
       order: before 15,625, after 3,125, saving 12,500;
     a global fund (Sec 197) gain 1,00,000 -> 12,500 (no exemption);
     two clients with 1,00,000 each -> family 0 (one pooled limit would give 9,375);
     already used Rs 50,000 on a 1,00,000 gain -> 3,125; already used 1,25,000 -> 12,500.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const AS_ON = '2026-09-30', LT = '2024-01-15', ST = '2026-05-01';
const EQ = { product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund' };
const r = v => T.RS(v);
const eq = (client, name, units, px, nav, buy) => Object.assign({ client, name, nav, lots: [[buy || LT, units, px]] }, EQ);
/* the one client's own harvest (each book below has one client, unless said) */
const H = (book, A) => book.tax(AS_ON, null, A).clients[0].harvest;
const row = i => REF.TAX_RULES.find(x => x.inst === i);

console.log('--- TAX_RULES: the Sec 198 rows ---');
const S198 = ['Listed Equity Shares', 'Equity Mutual Funds', 'Equity ETFs', 'Equity PMS', 'REIT Units', 'InvIT Units',
  'Hybrid MF (equity-oriented)', 'Equity ETF FoF (90/90)', 'ELSS (3-year lock-in)', 'SIF (equity long-short)'];
ok(S198.every(i => row(i) && row(i).sec198 === true && row(i).lt.rate === 0.125), 'sec198 on the 10 rows of listed shares, equity-oriented funds and REIT and InvIT units, each LTCG 12.5%');
const marked = REF.TAX_RULES.filter(x => x.sec198).map(x => x.inst).sort();
ok(JSON.stringify(marked) === JSON.stringify(S198.slice().sort()), 'and on no other row: no Sec 197 row, no AIF row (' + marked.length + ' rows)');

console.log('--- the boundary: one client, one equity fund, long term ---');
const g100 = H(new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 200)));
const g125 = H(new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 225)));
const g125x = H(new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 125001, 100, 101)));
const g150 = H(new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 250)));
ok(T.near(r(g100.taxBefore), 0) && T.near(r(g100.exBefore), 100000), 'gain Rs 1,00,000: tax 0, all inside the exemption (was Rs 12,500)');
ok(T.near(r(g125.taxBefore), 0) && T.near(r(g125.exBefore), 125000), 'gain Rs 1,25,000: tax 0 (was Rs 15,625)');
ok(Math.abs(g125x.taxBefore * 1e7 - 0.125) < 1e-6, 'gain Rs 1,25,001: tax Rs 0.125 (12.5% of Re 1) (got ' + g125x.taxBefore * 1e7 + ')');
ok(T.near(r(g150.taxBefore), 3125) && T.near(r(g150.taxAfter), 3125) && T.near(r(g150.saving), 0), 'gain Rs 1,50,000: tax Rs 3,125 = 12.5% of Rs 25,000 (was Rs 18,750)');
ok(T.near(g150.exAvail, 0.0125, 1e-12) && T.near(r(g150.exBeforeTax), 15625), 'the exemption is 0.0125 Cr in the engine; it saves Rs 15,625 here');

console.log('--- losses first, then the exemption ---');
const c2 = H(new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 200)).add(eq('Client A', 'Synthetic Value Fund-Reg(G)', 1000, 200, 100)));
ok(T.near(r(c2.taxBefore), 0) && T.near(r(c2.taxAfter), 0) && T.near(r(c2.saving), 0) && T.near(r(c2.ltUsed), 100000),
  'gain Rs 1,00,000 and long-term loss Rs 1,00,000: 0 / 0 / 0, the loss is used (was a Rs 12,500 "saving")');
const BOND = { product: 'Bonds', asset: 'Debt', category: 'Corporate Bond' };
const mix = (eqUnits, eqNav, bdUnits, bdNav) => new T.Book()
  .add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', eqUnits, 100, eqNav))
  .add(Object.assign({ client: 'Client A', name: 'Synthetic 8% NCD 2030', nav: bdNav, lots: [[LT, bdUnits, 100]] }, BOND))
  .add(eq('Client A', 'Synthetic Value Fund-Reg(G)', 1000, 200, 100));
const c3 = H(mix(1000, 250, 10000, 110)), c4 = H(mix(10000, 115, 1000, 200));   /* case 3: the bond is the larger holding; case 4: the equity fund */
ok(T.near(r(c3.taxBefore), 15625) && T.near(r(c3.taxAfter), 3125) && T.near(r(c3.saving), 12500),
  'case 3 (bond larger): before Rs 15,625, after Rs 3,125, saving Rs 12,500 (got ' + [c3.taxBefore, c3.taxAfter, c3.saving].map(r).join(' / ') + ')');
ok(T.near(r(c4.taxBefore), 15625) && T.near(r(c4.taxAfter), 3125) && T.near(r(c4.saving), 12500),
  'case 4 (equity larger): the same, the result never depends on holding size (got ' + [c4.taxBefore, c4.taxAfter, c4.saving].map(r).join(' / ') + ')');
const c5 = H(new T.Book().add({ client: 'Client A', name: 'Synthetic US Equity FoF-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'FoFs (Overseas)', nav: 200, lots: [[LT, 1000, 100]] }));
ok(T.near(r(c5.taxBefore), 12500) && T.near(r(c5.exBefore), 0), 'a global fund (Sec 197) gain Rs 1,00,000: Rs 12,500, no exemption');

console.log('--- per person: two clients ---');
const c6 = new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 200)).add(eq('Client B', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 200)).tax(AS_ON);
ok(T.near(r(c6.harvest.taxBefore), 0) && c6.clients.every(c => T.near(r(c.harvest.exBefore), 100000)),
  'two clients with Rs 1,00,000 each: family Rs 0, each inside their own exemption (one limit for the family would give Rs 9,375; was Rs 25,000)');

console.log('--- the analyst\'s input: the exemption already used this tax year ---');
const b1 = new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 200));
const u50 = H(b1, { clients: { 'Client A': { usedRs: 50000 } } }), uAll = H(b1, { clients: { 'Client A': { usedRs: 125000 } } });
ok(T.near(r(u50.taxBefore), 3125) && u50.assume.usedRs === 50000 && !u50.assume.usedDefault, 'Rs 50,000 already used on a Rs 1,00,000 gain: Rs 3,125 (12.5% of Rs 25,000); not the default');
ok(T.near(r(uAll.taxBefore), 12500), 'the whole Rs 1,25,000 already used: Rs 12,500, the figure before the fix');
const dflt = H(b1, { clients: { 'Client A': { usedRs: '' } } });
ok(dflt.assume.usedRs === 0 && dflt.assume.usedDefault && dflt.assume.slabPct === 30 && dflt.assume.slabDefault && T.near(r(dflt.taxBefore), 0),
  'blank is the default: Rs 0 used, slab 30%, both marked default');
const clamp = H(b1, { clients: { 'Client A': { usedRs: 200000, slabPct: 45 } } }), neg = H(b1, { clients: { 'Client A': { usedRs: -5, slabPct: -1 } } });
ok(clamp.assume.usedRs === 125000 && clamp.assume.slabPct === 30 && neg.assume.usedRs === 0 && neg.assume.slabPct === 0, 'inputs are held to Rs 0 to 1,25,000 and 0% to 30%');
const TT = b1.tax(AS_ON);
E.taxApplyAssumptions(TT, { clients: { 'Client A': { usedRs: 125000 } } });
ok(T.near(r(TT.harvest.taxBefore), 12500) && T.near(r(TT.clients[0].harvest.taxBefore), 12500), 'taxApplyAssumptions works an existing taxation out again (the tab\'s path)');

console.log('--- a short-term loss and the exemption ---');
const st = H(new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 250)).add(eq('Client A', 'Synthetic Focused Fund-Reg(G)', 1000, 150, 100, ST)));
ok(T.near(r(st.taxBefore), 3125) && T.near(r(st.taxAfter), 0) && T.near(r(st.saving), 3125) && T.near(r(st.stUnused), 0) && T.near(r(st.exAfter), 100000),
  'gain Rs 1,50,000 and a short-term loss Rs 50,000: the loss takes the Rs 25,000 above the exemption, then Rs 25,000 inside it; tax 3,125 to 0; nothing carried forward');
const big = H(new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 150)).add(eq('Client A', 'Synthetic Value Fund-Reg(G)', 1000, 180, 100)));
ok(T.near(r(big.taxBefore), 0) && T.near(r(big.ltUnused), 30000) && T.near(r(big.exAfter), 0), 'loss Rs 80,000 larger than the gain Rs 50,000: tax 0, Rs 30,000 carried forward');
const none = H(new T.Book().add(eq('Client A', 'Synthetic Value Fund-Reg(G)', 1000, 180, 100)));
ok(T.near(r(none.taxBefore), 0) && T.near(r(none.ltGains), 0) && none.s198Gains === 0, 'no gains: no tax, no exemption line');

console.log('--- a Lakh file gives the same rupees ---');
const lb = new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 250));
const HEADL = ['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'AMC', 'Product Name', 'Distributor Name',
  'Units', 'Invested Value (Lakh)', 'Current Market Value (Lakh)', 'Total Gain/Loss (Lakh)'];
const rowsL = E.parseBaseRows([HEADL].concat(lb.rows.map(x => x.slice(0, 8).concat([x[8] * 100, x[9] * 100, x[10] * 100]))));
const hl = E.computeTaxation(rowsL, lb.ref(null), T.D(AS_ON)).clients[0].harvest;
ok(rowsL.unitHint === 'L' && T.near(r(hl.taxBefore), 3125) && T.near(hl.exAvail, 0.0125, 1e-12), 'Lakh file: Rs 3,125, the exemption still 0.0125 Cr (never scaled)');

/* screen and slide */
const scr = mix(1000, 250, 10000, 110);
const m = scr.review(AS_ON), mU = scr.review(AS_ON, { taxAssume: { clients: { 'Client A': { usedRs: 25000 } } } });
(async () => {
  try {
    const R8377 = s => s.replace(/&#8377;/g, '₹');   /* the tab writes the rupee sign as an HTML entity */
    const tx = R8377(T.text(T.renderTaxTab(m))), raw = T.renderTaxTab(m);
    ok(/Less: Sec 198 exemption ₹1,25,000 a year less ₹0 already used 12\.50%\*/.test(tx), 'Taxation tab: the exemption on its own line, ₹1,25,000 less ₹0 used, at 12.50%*');
    ok(/Equity Mutual Funds Long term 12\.50%\* /.test(tx) && /Listed Bonds \/ NCDs Long term 12\.50% /.test(tx), 'Taxation tab: "*" on the Sec 198 pool only, not on the bond pool');
    ok(/only above ₹1\.25 lakh a year: one limit per person, applied after losses are set off\. Other long-term gains are taxed at 12\.5% on the whole gain/.test(tx),
      'Taxation tab: the footnote names Sec 198 gains only and says other long-term gains are taxed in full');
    ok(/data-k="slabPct"[^>]*value="30"/.test(raw) && /data-k="usedRs"[^>]*value="0"/.test(raw) && /% \(default\)/.test(tx), 'Taxation tab: the two inputs, 30% and ₹0, marked default');
    ok(/The exemption covers ₹0\.01 Cr of long-term gains before set-off and ₹0\.01 Cr after/.test(tx), 'Taxation tab: what the exemption covers, before and after');
    const txU = R8377(T.text(T.renderTaxTab(mU)));
    ok(/less ₹25,000 already used/.test(txU) && !/₹ +\(default\)/.test(txU), 'Taxation tab: an entered amount is shown, not marked default');
    const sl = await T.taxSlidesText(m);
    ok(/Assumptions set by the analyst: slab rate 30% \(default\), Sec 198 exemption already used this tax year ₹0 \(default\)/.test(sl), 'harvest slide: the assumptions, stated as defaults');
    ok(/Less: Sec 198 exemption Long term 12\.50%\*/.test(sl), 'harvest slide: the exemption line');
    ok(/\* Sec 198 long-term gains \(listed shares, equity-oriented funds, REIT and InvIT units, STT paid\) are taxed at 12\.5% only above ₹1\.25 lakh a year: one limit per person, after losses are set off\. Other long-term gains are taxed at 12\.5% on the whole gain/.test(sl),
      'harvest slide: the footnote');
    const slU = await T.taxSlidesText(mU);
    ok(/Sec 198 exemption already used this tax year ₹25,000\./.test(slU), 'harvest slide: an entered amount, not marked default');
    /* the tab's inputs, live: client A (Rs 1,50,000 gain) and client B (Rs 1,00,000) */
    const live = new T.Book()
      .add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 250)).add(eq('Client B', 'Synthetic Large Cap Fund-Reg(G)', 1000, 100, 200)).review(AS_ON);
    const L = T.taxTabLive(live), fam = () => r(live.taxation.harvest.taxBefore);
    ok(fam() === 3125 && L.input(0, 'usedRs').value === '0' && L.input(1, 'slabPct').value === '30', 'tab inputs: one row per client, Rs 0 and 30%; family tax Rs 3,125 (A 3,125 + B 0)');
    L.set(0, 'usedRs', '125000');
    ok(fam() === 18750 && r(live.taxation.clients.find(c => c.client === 'Client A').harvest.taxBefore) === 18750 && L.input(0, 'usedRs').value === '125000' &&
       L.window.__taxAssume && L.window.__taxAssume.clients['Client A'].usedRs === 125000,
      'typing Rs 1,25,000 for client A works the harvest out again: A Rs 18,750, family Rs 18,750; the tab shows the value');
    L.set(0, 'usedRs', '');
    ok(fam() === 3125 && !('usedRs' in L.assume().clients['Client A']), 'clearing the field restores the default (Rs 3,125)');
    L.set(1, 'slabPct', '50');
    ok(live.taxation.harvest.byClient.every(h => h.assume.slabPct === 30) && L.input(1, 'slabPct').value === '30', 'a slab rate of 50% is held to 30%');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
