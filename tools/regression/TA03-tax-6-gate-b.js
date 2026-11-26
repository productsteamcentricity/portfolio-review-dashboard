/* ============================================================================
   tax-6 (TA-03, CR-0008): ARC-02's Gate B points on d7683a0, settled
   conservatively (MOD-04, 25 Nov 2026), and the LRS bond rule (MOD-03 and
   MOD-04, with LP-16). T1 is checked in KI-182-crypto-source.js and T3 in
   KI-182-crypto-no-set-off.js.

   Known answers (synthetic holdings; the AIF names are the public AIF_PERF
   entries' own):
     T2. PD-54, "an exact name (ignoring AIF and brackets)": an AIF entry's
         category is read as a statement about the holding only when the two
         names are the same word for word once letter case, punctuation,
         brackets and the word AIF are ignored. Before, the matcher's
         normalize() dropped filler words and applied synonyms, so "X Income
         Opportunities Strategy" and "The X Opportunities Strategy" were the
         entry "X Opportunities Strategy" (Category III, ruled); now they are
         Category I or II, assumed, with the note. A hyphen for the entry's en
         dash, capitals, extra spaces, "Name AIF" and "Name (AIF)" are still the
         entry.
     LRS. A bond whose Product or Category names a foreign or US-dollar route
         ("US-dollar bonds (through LRS)", "USD Bonds", "Foreign Bonds", "GIFT
         City Bonds", "Eurobonds", "Bonds" with Category "USD Bonds (LRS)") is
         not taxed as a domestic row, also when its Category says Government
         Securities or MLD (the financial review of S12): no class, with the
         reason "No tax row is published for a foreign or US-dollar bond (held
         through the LRS, GIFT City or abroad). Confirm its tax with the tax
         adviser.", shown on the Taxation tab. Controls: "NCD", "Bonds" and
         "Debenture" stay Listed Bonds / NCDs, "Unlisted Bonds" stays Unlisted
         Bonds / NCDs, a domestic G-Sec and MLD keep their rows, "US Stocks
         (LRS)" stays a foreign-listed share, a mutual fund product is untouched.
     OFFSHORE. "Offshore Equity Shares" is a foreign-listed share (the review
         of S12); before, it was a domestic listed share.
     node tools/regression/TA03-tax-6-gate-b.js
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const CAT3 = 'Equity AIF – Cat III (Listed Equity)', EQ12 = 'Equity AIF – Cat I/II';
const cls = (nm, key, h) => E.taxClassify(Object.assign({ product: 'AIF', asset: 'Equity', category: '', name: nm, perfSrc: 'AIF', perfKey: key }, h || {}), REF);
const ruled3 = x => x.cls === CAT3 && x.catRuled === true && !x.catAssumed;
const asm = x => x.cls === EQ12 && x.catAssumed === true && !x.catRuled;

/* T2 */
const K = 'Buoyant Capital – Opportunities Strategy';
ok(REF.AIF_PERF[K] && REF.AIF_PERF[K].category === 'Listed AIF', 'T2. the entry "' + K + '" is a Listed AIF in the data');
[K, K + ' AIF', K + ' (AIF)', K.toUpperCase(), K.replace(/ /g, '  '), K.replace('–', '-'), K.replace(' – ', ' ')].forEach(n =>
  ok(ruled3(cls(n, K)), 'T2. "' + n + '" is the entry, word for word: Category III, ruled'));
['Buoyant Capital – Income Opportunities Strategy', 'The ' + K, K + ' Fund', K + ' Ltd'].forEach(n =>
  ok(asm(cls(n, K)), 'T2. "' + n + '" has a word more than the entry: another fund, Category I or II, assumed, with the note'));
/* every Listed AIF entry in the data: a word inserted inside the name is another fund */
Object.keys(REF.AIF_PERF).filter(k => REF.AIF_PERF[k].category === 'Listed AIF').forEach(k => {
  const w = k.split(' '), n = [w[0], 'Income'].concat(w.slice(1)).join(' ');
  ok(ruled3(cls(k, k)) && asm(cls(n, k)), 'T2. entry "' + k + '": its own name is Category III, ruled; "' + n + '" is assumed');
});

/* LRS bonds */
const WHY = 'No tax row is published for a foreign or US-dollar bond (held through the LRS, GIFT City or abroad). Confirm its tax with the tax adviser.';
const bond = (p, h) => E.taxClassify(Object.assign({ product: p, asset: 'Debt', category: '', name: 'Synthetic Corp 5.25% Bond 2030' }, h || {}), REF);
['US-dollar bonds (through LRS)', 'USD Bonds', 'Bonds (LRS)', 'US Dollar Bond', 'NCDs (LRS)', 'Foreign Bonds', 'Overseas Bonds', 'International Bonds',
  'Global Bonds', 'Offshore Bonds', 'Off-shore Bonds', 'US$ Bonds', 'Dollar Bonds', 'GIFT City Bonds', 'IFSC Bonds', 'Eurobonds'].forEach(p => {
  const x = bond(p); ok(x.cls === null && x.why === WHY, 'LRS. "' + p + '": no class, with the foreign-bond reason (got ' + x.cls + ')');
});
[['Bonds', { category: 'USD Bonds (LRS)' }], ['US-dollar bonds (through LRS)', { category: 'Government Securities' }],
  ['US-dollar bonds (through LRS)', { name: 'Synthetic US Treasury G-Sec 2030' }], ['US-dollar bonds (through LRS)', { category: 'Market Linked Debenture' }]]
  .forEach(([p, h]) => { const x = bond(p, h); ok(x.cls === null && x.why === WHY, 'LRS. "' + p + '" with ' + JSON.stringify(h) + ': the foreign-bond reason, before the Category, G-Sec and MLD rows (got ' + x.cls + ')'); });
ok(bond('G-Sec', { category: 'Government Securities' }).cls === 'Government Securities / G-Secs' && bond('MLD', { category: 'Market Linked Debenture' }).cls === 'MLD',
  'LRS. control: a domestic G-Sec and an MLD keep their rows');
ok(E.taxClassify({ product: 'Offshore Equity Shares', asset: 'Equity', category: '', name: 'Synthetic Overseas Corp' }, REF).cls === 'Foreign-listed shares (held directly)' &&
   E.taxClassify({ product: 'Equity Shares', asset: 'Equity', category: '', name: 'HDFC Bank Ltd.' }, REF).cls === 'Listed Equity Shares',
  'OFFSHORE. "Offshore Equity Shares" is a foreign-listed share (control: an Indian listed share stays a listed equity share)');
ok(bond('NCD').cls === 'Listed Bonds / NCDs' && bond('Bonds').cls === 'Listed Bonds / NCDs' && bond('Debenture').cls === 'Listed Bonds / NCDs',
  'LRS. control: "NCD", "Bonds" and "Debenture" stay Listed Bonds / NCDs');
ok(bond('Unlisted Bonds').cls === 'Unlisted Bonds / NCDs', 'LRS. control: "Unlisted Bonds" stays Unlisted Bonds / NCDs');
ok(E.taxClassify({ product: 'US Stocks (LRS)', asset: 'Equity', category: '', name: 'Synthetic US Corp' }, REF).cls === 'Foreign-listed shares (held directly)',
  'LRS. control: "US Stocks (LRS)" is not a bond: a foreign-listed share, as before');
ok(bond('Mutual Funds', { name: 'Synthetic USD Bond Fund', category: 'Corporate Bond Fund' }).cls !== null &&
   bond('Mutual Funds', { name: 'Synthetic USD Bond Fund', category: 'Corporate Bond Fund' }).why !== WHY, 'LRS. control: a mutual fund product is untouched');
{ const m = new T.Book().add({ client: 'Client A', name: 'Synthetic Corp 5.25% USD Bond 2030', product: 'US-dollar bonds (through LRS)', asset: 'Debt', category: '', nav: 101, lots: [['2025-01-15', 100, 100]] }).review('2026-09-30');
  const tx = T.text(T.renderTaxTab(m));
  ok(tx.indexOf(WHY) >= 0 && !/Listed Bonds \/ NCDs/.test(tx), 'LRS. Taxation tab: the bond is shown with the LRS reason, not as a listed bond'); }

done();
