/* ============================================================================
   KI-167 (TX-08) — the harvest is worked out per client; the family view is the
   sum of the clients' harvests, never one pooled set-off.

     node tools/regression/KI-167-per-client-harvest.js

   Tax Reckoner TY 2026-27, Exemptions & Set-off R10 (the Rs 1.25 lakh limit is "one limit
   per person per tax year"), R13 (carry-forward needs "the return" filed by its due date),
   R15-R16 (set-off rules). Set-off and carry-forward belong to the person who files the
   return, so one client's loss can never reduce another client's tax. Before the fix the
   Family Level harvest (the default on screen and in the deck) pooled every client's
   gains and losses: client B's Rs 30,000 short-term loss "saved" tax on client A's gain.
   D-040 (f).

   Known answers, as on 30 Sep 2026, each lot 100 units (equity funds, short term at 20%):
   S2  A: gain Rs 30,000 (100 -> 400); B: loss Rs 30,000 (400 -> 100). Family: before
       6,000, after 6,000, saving 0 (was 6,000); B carries Rs 30,000 forward.
   S3  one client holds both: before 6,000, after 0, saving 6,000 (unchanged).
   S4  A: gain 30,000; B: gain 10,000 and loss 30,000. Family saving 2,000 (was 6,000),
       short-term loss unused 20,000 (was 0), shown against client B.
   Cross: A's long-term loss of Rs 20,000 cannot touch B's short-term gain: saving 0.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E } = T.host();
const EQ = { product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund' };
const AS_ON = '2026-09-30', ST_BUY = '2026-04-01', LT_BUY = '2024-01-15';
const fund = (client, name, buyPx, nav, buy) => Object.assign({ client, name, nav, lots: [[buy || ST_BUY, 100, buyPx]] }, EQ);
const H = X => X.harvest;
const r = v => T.RS(v);
const SUM = ['taxBefore', 'taxAfter', 'saving', 'ltGains', 'stGains', 'ltLosses', 'stLosses', 'ltUsed', 'stUsed', 'ltUnused', 'stUnused',
  'unquantifiedPools', 'unquantifiedGain', 'slabSheltered', 's198Gains', 's198Left', 'exBefore', 'exAfter', 'exBeforeTax', 'exAfterTax'];
const addsUp = X => SUM.every(k => Math.abs((X.harvest[k] || 0) - X.clients.reduce((s, c) => s + (c.harvest[k] || 0), 0)) < 1e-12);

console.log('--- S2: client B\'s loss never meets client A\'s gain ---');
const s2 = new T.Book().add(fund('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 100, 400)).add(fund('Client B', 'Synthetic Focused Fund-Reg(G)', 400, 100)).tax(AS_ON);
const a2 = s2.clients.find(c => c.client === 'Client A').harvest, b2 = s2.clients.find(c => c.client === 'Client B').harvest;
ok(T.near(r(H(s2).taxBefore), 6000) && T.near(r(H(s2).taxAfter), 6000) && T.near(r(H(s2).saving), 0),
  'family: before Rs 6,000, after Rs 6,000, saving Rs 0 (got ' + r(H(s2).taxBefore) + ' / ' + r(H(s2).taxAfter) + ' / ' + r(H(s2).saving) + '; was a Rs 6,000 saving)');
ok(T.near(r(a2.saving), 0) && T.near(r(b2.saving), 0) && T.near(r(b2.stUnused), 30000) && T.near(r(H(s2).stUnused), 30000),
  'client A saving 0, client B saving 0 with Rs 30,000 unused; the family shows the same Rs 30,000 unused');
ok(H(s2).perClient === true && H(s2).byClient.length === 2 && H(s2).pools.every(p => p.client === 'Client A' || p.client === 'Client B'),
  'the family harvest is per client: two client harvests, every pool tagged with its client');
ok(addsUp(s2), 'every harvest figure of the family is the sum of the clients\' figures');

console.log('--- S3: one client holding both (control, unchanged) ---');
const s3 = new T.Book().add(fund('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 100, 400)).add(fund('Client A', 'Synthetic Focused Fund-Reg(G)', 400, 100)).tax(AS_ON);
ok(T.near(r(H(s3).taxBefore), 6000) && T.near(r(H(s3).taxAfter), 0) && T.near(r(H(s3).saving), 6000) && T.near(r(s3.clients[0].harvest.saving), 6000),
  'family and client both: before Rs 6,000, after 0, saving Rs 6,000');

console.log('--- S4: B\'s own gain absorbs part of B\'s loss; the rest is B\'s to carry forward ---');
const s4 = new T.Book().add(fund('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 100, 400))
  .add(fund('Client B', 'Synthetic Large Cap Fund-Reg(G)', 100, 200)).add(fund('Client B', 'Synthetic Focused Fund-Reg(G)', 400, 100)).tax(AS_ON);
const b4 = s4.clients.find(c => c.client === 'Client B').harvest;
ok(T.near(r(H(s4).saving), 2000) && T.near(r(b4.saving), 2000) && T.near(r(b4.taxBefore), 2000) && T.near(r(b4.taxAfter), 0),
  'family saving Rs 2,000 = client B\'s own (got ' + r(H(s4).saving) + '; was Rs 6,000 pooled)');
ok(T.near(r(H(s4).stUnused), 20000) && T.near(r(b4.stUnused), 20000), 'Rs 20,000 short-term loss unused, client B\'s (was 0 pooled)');
ok(addsUp(s4), 'S4: family = sum of clients, field by field');

console.log('--- a long-term loss of one client and a short-term gain of another ---');
const cx = new T.Book().add(fund('Client A', 'Synthetic Value Fund-Reg(G)', 300, 100, LT_BUY)).add(fund('Client B', 'Synthetic Flexi Cap Fund-Reg(G)', 100, 300)).tax(AS_ON);
ok(T.near(r(H(cx).ltLosses), 20000) && T.near(r(H(cx).saving), 0) && T.near(r(H(cx).taxAfter), 4000) && T.near(r(H(cx).ltUnused), 20000),
  'A\'s Rs 20,000 long-term loss is unused; B pays Rs 4,000 (20% of Rs 20,000); saving 0');

console.log('--- one client: the family harvest is that client\'s harvest ---');
const one = new T.Book().add(fund('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 100, 400)).add(fund('Client A', 'Synthetic Value Fund-Reg(G)', 100, 150, LT_BUY)).tax(AS_ON);
ok(SUM.every(k => Math.abs((one.harvest[k] || 0) - (one.clients[0].harvest[k] || 0)) < 1e-12) && one.harvest.pools.length === one.clients[0].harvest.pools.length,
  'every figure and pool of the family equals the single client\'s');

console.log('--- holdings with no client name are one group, counted ---');   /* a blank client cell (" " here; the harness fills an empty one) */
const un = new T.Book().add(fund(' ', 'Synthetic Flexi Cap Fund-Reg(G)', 100, 400)).add(fund(' ', 'Synthetic Focused Fund-Reg(G)', 400, 100)).add(fund('Client A', 'Synthetic Value Fund-Reg(G)', 100, 150)).tax(AS_ON);
ok(un.unnamedN === 2 && un.clients.some(c => c.client === '(unnamed)' && T.near(r(c.harvest.saving), 6000)), '2 holdings with no client name, set off as one group "(unnamed)" (saving Rs 6,000), and counted');

/* screen and slide */
const model = new T.Book().add(fund('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 100, 400)).add(fund('Client B', 'Synthetic Large Cap Fund-Reg(G)', 100, 200))
  .add(fund('Client B', 'Synthetic Focused Fund-Reg(G)', 400, 100)).review(AS_ON);
const mH = model.taxation.harvest;
ok(T.near(r(mH.saving), 2000) && T.near(r(mH.stUnused), 20000), 'the review gives the same per-client figures (saving Rs 2,000, Rs 20,000 unused)');
(async () => {
  try {
    const tx = T.text(T.renderTaxTab(model));
    ok(/one client’s loss is never set against another client’s gain/.test(tx), 'Taxation tab: the family figures add up the clients\' results, never one client\'s loss against another\'s gain');
    ok(/Client Gain pool Rate Gain Loss set off/.test(tx), 'Taxation tab: the pool table has a Client column in the family view');
    ok(/of losses cannot be set off this year: Client B ₹0\.00 Cr\. Each can be carried forward in that person’s own return for up to eight tax years, provided the return is filed by the due date/.test(tx),
      'Taxation tab: says whose loss is left over, carried forward in that person\'s own return');
    const txB = T.text(T.renderTaxTab(model, 'Client B'));
    ok(!/Client Gain pool/.test(txB) && /It can be carried forward for up to eight tax years/.test(txB), 'one client\'s view: no Client column; "It can be carried forward"');
    const sl = await T.taxSlidesText(model);
    ok(/Set-off is worked out for each client on their own and added up; one client’s loss is never set against another client’s gain/.test(sl),
      'harvest slide: per-client set-off stated');
    ok(/cannot be set off this year \(Client B ₹0\.00 Cr\)\. It can be carried forward for up to eight tax years in that person’s own return/.test(sl),
      'harvest slide: whose loss is left over');
    const tu = T.text(T.renderTaxTab(new T.Book().add(fund(' ', 'Synthetic Flexi Cap Fund-Reg(G)', 100, 400)).add(fund('Client A', 'Synthetic Value Fund-Reg(G)', 100, 150)).review(AS_ON)));
    ok(/1 holding has no client name; they are treated as one person for the set-off and the exemption/.test(tu), 'Taxation tab: holdings with no client name are counted');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
