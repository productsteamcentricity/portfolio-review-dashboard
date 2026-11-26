/* ============================================================================
   CR-0008, tax batch part T5, item 10: an AIF called a "Listed AIF" is Category III.
   (CR-0008 question 17, answered 2 Nov 2026: yes, with a safe note; D-043. Question 24, answered 9 Nov 2026: "Restrict it":
   the data's label counts for the entry's own name only, "AIF" and brackets ignored; stage S10. Stage S11, ARC-01's
   pre-check of S10: the entry's stated Category I, II or III follows the same name equality.)

     node tools/regression/CR-0008-T5-item10-listed-aif.js

   11 of the 12 funds of the vendor's AIF universe (REFDATA.AIF_PERF, when this was written; the checks read the data and do
   not count it) carry the category "Listed AIF" and the twelfth "AIF (CAT III) - Listed Equity". Part T3 read a category that says neither Category I, II nor III as
   Category I or II (pass-through); item 4 of this part marked such an AIF "category not stated". Item 10: a
   holding called a Listed AIF, by its own category or by the category of the AIF_PERF entry it matched (when its
   name is the entry's own name, "AIF" and brackets ignored), is Category III, fund level (as KI-166), marked
   catRuled, and every surface says it is treated as Category III because it is called a Listed AIF, and asks for
   the category to be confirmed against the AIF's statement.

   The order of reading, in taxClassify, once:
     1. the AIF's own words (category, name, product): Category III, or Category I or II, as stated: no mark;
     2. else the category of the AIF_PERF entry the holding matched, read the same way, when the names are the same once
        "AIF" and brackets are ignored (stage S11; the same equality as step 3): as stated, no mark;
     3. else "Listed AIF" (the holding's category, or the entry's when the names are the same once "AIF" and brackets
        are ignored): Category III, marked catRuled;
     4. else nothing is stated anywhere: Category I or II, marked catAssumed (item 4).
   So a holding whose own words say Category II while the matched entry says "Listed AIF" is Category II, as stated.
   No figure of the harvest moves: a pass-through AIF and a fund-level AIF are both left out of it; the Listed AIF
   leaves "not classified" and enters "fund level".
   The label is read as written, and its boundaries are pinned AS BUILT (gate review of 2 Nov 2026, TQ-01; KI-171): only
   the whole label counts (an own category or an entry that says "Listed AIFs" or "Listed AIF - Series 2" does not, and
   "Unlisted AIF" never does). Since stage S10 (the owner's answer to question 24, 9 Nov 2026) the label of an entry that the
   loose name matcher gave to another fund no longer gives Category III: section 1a3 pins that, and the 11 genuine entries
   written "Name AIF" or "Name (AIF)" still count, one check for each, through the classifier and through the real matcher
   (section 1c); since stage S11 so does the Category III entry's own statement, one check for it in each of the two ways.
   No ruling covers the edges of the label's spelling; a later decision changes those checks.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const AS_ON = '2026-09-30';
const r = v => T.RS(v);
const R8377 = s => s.replace(/&#8377;/g, '₹');
const CAT3 = 'Equity AIF – Cat III (Listed Equity)', CAT3LS = 'Equity AIF – Cat III (Long Short)', DCAT3 = 'Debt AIF – Cat III';
const EQ12 = 'Equity AIF – Cat I/II', DB12 = 'Debt AIF – Cat I/II';
const keys = Object.keys(REF.AIF_PERF);
const listedKeys = keys.filter(k => REF.AIF_PERF[k].category === 'Listed AIF');
/* the engine's own pattern for a stated Category III (taxClassify), so a vendor spelling it reads is counted here too */
const CAT_III = /\bcat(egory)?[\s.:()\[\]{}\-\u2010-\u2015\u2212]*(iii|three|3)\b/i;
const cat3Keys = keys.filter(k => CAT_III.test(REF.AIF_PERF[k].category));
const LK = listedKeys[0], CK = cat3Keys[0];

/* ---------------- 1. the classifier ---------------- */
console.log('--- 1. taxClassify: a Listed AIF is Category III, marked ---');
const cls = h => E.taxClassify(Object.assign({ product: 'AIF', asset: 'Equity', category: '', name: 'Synthetic Opportunities Fund' }, h), REF);
const matched = (key, h) => cls(Object.assign({ name: key, perfSrc: 'AIF', perfKey: key }, h));
const stated3 = x => x.cls === CAT3 && !x.catRuled && !x.catAssumed;
const stated12 = x => x.cls === EQ12 && !x.catRuled && !x.catAssumed;
ok(listedKeys.length > 0 && cat3Keys.length > 0, 'AIF_PERF holds "Listed AIF" funds and a Category III fund (' + listedKeys.length + ' and ' + cat3Keys.length + ' of ' + keys.length + ' when this was written: 11, 1 and 12)');
ok(cls({ category: 'Listed AIF' }).cls === CAT3 && cls({ category: 'Listed AIF' }).catRuled === true && !cls({ category: 'Listed AIF' }).catAssumed,
  'a holding whose category is "Listed AIF": Category III, marked as ruled (not as assumed)');
ok(cls({ asset: 'Debt', category: 'Listed AIF' }).cls === DCAT3 && cls({ asset: 'Debt', category: 'Listed AIF' }).catRuled === true, 'a debt AIF called a Listed AIF: the Category III debt row, marked');
ok(['LISTED AIF', '  listed aif ', 'Listed  AIF'].every(c => cls({ category: c }).cls === CAT3 && cls({ category: c }).catRuled === true), 'case and spacing do not matter');
ok(cls({ category: 'Unlisted AIF' }).cls === EQ12 && cls({ category: 'Unlisted AIF' }).catAssumed === true && !cls({ category: 'Unlisted AIF' }).catRuled, '"Unlisted AIF" is not a Listed AIF: Category I or II, assumed');
/* AS BUILT (gate review of 2 Nov 2026, TQ-01; CR-0008 question 24, KI-171): only the whole label counts. A category that has more words after it, or a plural, is not the label: Category I or II,
   assumed, with the note. If a later decision reads such a category as a Listed AIF too, these checks change with the reader. */
ok(['Listed AIFs', 'Listed AIF - Series 2'].every(c => cls({ category: c }).cls === EQ12 && cls({ category: c }).catAssumed === true && !cls({ category: c }).catRuled),
  'an own category "Listed AIFs" or "Listed AIF - Series 2" is not the label "Listed AIF" (as built, CR-0008 question 24, KI-171): Category I or II, assumed, not ruled');
ok(cls({ category: '' }).cls === EQ12 && cls({ category: '' }).catAssumed === true && !cls({ category: '' }).catRuled, 'a blank category and no entry: Category I or II, assumed (item 4 stands)');

console.log('--- 1a. the AIF\'s own words win over the ruling ---');
ok(stated12(cls({ category: 'Listed AIF', name: 'Synthetic Growth Fund - Category II' })) && stated12(cls({ category: 'Listed AIF', name: 'Synthetic Credit Fund Cat I' })) &&
   stated12(cls({ category: 'Listed AIF', product: 'AIF Category II' })), 'Category I or II in the name or the product beats "Listed AIF": Category I or II, as stated, no mark');
ok(stated3(cls({ category: 'Listed AIF', name: 'Synthetic Opportunities Fund Cat III' })) && stated3(cls({ category: 'Listed AIF', product: 'AIF - Category III' })),
   'Category III in the name or the product beats "Listed AIF": Category III, as stated, no mark');
ok(['Category III', 'CAT-III', 'Cat. III', 'Category 3', 'Category Three', 'Category (III)', 'Category – III', 'AIF (CAT III) - Listed Equity'].every(c => stated3(cls({ category: c }))),
  'Category III in any of its spellings (dot, dash, en dash, bracket, 3, three) is stated');
ok(['Category I', 'Category 1', 'Cat One', 'CAT II', 'Cat-II', 'Category 2', 'Category Two', 'Category I & II'].every(c => stated12(cls({ category: c }))), 'Category I or II in any of its spellings is stated');
ok(['Category [III]', 'Category {III}', 'Cat [3]', 'AIF [Category III]'].every(c => stated3(cls({ category: c }))) && ['Category [II]', 'Category {I}', 'Cat [2]', 'AIF [Category II]'].every(c => stated12(cls({ category: c }))),
  'Category III, II or I inside square or curly brackets is stated, like round brackets (delta review D5-F2, D5-F3)');
ok(cls({ category: 'Category No. III' }).catAssumed === true && cls({ category: 'Category No. III' }).cls === EQ12,
  '"Category No. III" is not read (a boundary, pinned): Category I or II, assumed, with the note that asks for the statement');
ok(['Category/III', 'Category_III', 'Category #III', 'Category, III', 'Cat-[III]'].every(c => stated3(cls({ category: c }))) && ['Category/II', 'Category_I', 'Category #2', 'Category, I'].every(c => stated12(cls({ category: c }))),
  'a slash, an underscore, a hash or a comma between "category" and the number is read (delta review D1-F2)');
ok(['Category IV', 'Category 12', 'Category 1a', 'Category 3A', 'Category IIIB', 'Wildcat II Fund', 'Concat I Fund'].every(c => cls({ category: '', name: c }).catAssumed === true),
  'a number that only starts like one (IV, 12, 1a, 3A, IIIB) or a word that only ends in "cat" is not a category: nothing stated, assumed (delta review D1-F5)');
ok(cls({ category: 'Category I and Category III' }).cls === CAT3, 'when both are written, Category III is tested first, as before');
ok(cls({ category: '', name: 'Synthetic Wildcat III Fund' }).cls === EQ12 && cls({ category: '', name: 'Synthetic Wildcat III Fund' }).catAssumed === true,
  'a word that only ends in "cat" ("Wildcat III") is not a category: nothing stated, Category I or II, assumed');
ok(cls({ category: 'Category III - Long Short' }).cls === CAT3LS && cls({ asset: 'Debt', category: 'Category III' }).cls === DCAT3, 'Category III: the Long Short row and the debt row are kept (KI-166)');
ok(cls({ category: 'Category: III', name: 'Synthetic Wildcat III Fund', product: 'AIF - Cat III Long Short' }).cls === CAT3,
  'the Category III row is picked from the category and the name, as before: a product that says Long Short does not pick the Long Short row (delta review D6-3)');

console.log('--- 1a1. every separator, the word boundary and the forms that are not read (ARC-01, its mutants of the reader at stage S6) ---');
/* the characters the pattern accepts between "Cat"/"Category" and the number: a blank, a colon, a dot, round, square and curly brackets, a slash, an underscore, a hash, a comma, a hyphen,
   the dashes U+2010 to U+2015 and the minus sign U+2212; one assertion for each, so that a pattern that drops any one of them fails here */
const SEPS = [' ', ':', '.', '(', ')', '[', ']', '{', '}', '/', '_', '#', ',', '-', '\u2010', '\u2011', '\u2012', '\u2013', '\u2014', '\u2015', '\u2212'];
SEPS.forEach(s => {
  const u = 'U+' + ('0000' + s.charCodeAt(0).toString(16).toUpperCase()).slice(-4);
  ok(stated3(cls({ category: 'Category' + s + 'III' })) && stated12(cls({ category: 'Category' + s + 'II' })) && stated12(cls({ category: 'Cat' + s + '1' })) && stated3(cls({ category: 'CAT' + s + s + '3' })),
    'the separator ' + u + ' between "Category" and the number is read: Category III, II, and "Cat 1", as stated, no mark');
});
ok(['*', '+', ';', '|', '=', '~'].every(s => cls({ category: 'Category' + s + 'III' }).catAssumed === true && cls({ category: 'Category' + s + 'II' }).catAssumed === true),
  'a character that is not a separator (*, +, ; | = ~) between "Category" and the number is not read: nothing stated, assumed (a boundary, pinned)');
ok(['Bobcat 1', 'Tomcat 2', 'Scat Three', 'Bobcat III', '9Cat I', 'Wildcat II', 'Concat I'].every(n => cls({ category: '', name: n }).catAssumed === true) &&
   ['Fund-Cat I', 'Fund (Cat II)', 'Fund/Cat 1', 'Fund CAT_III'].every(n => cls({ category: '', name: n }).catAssumed !== true),
  'the word boundary before "cat": "Bobcat 1", "Tomcat 2", "Scat Three", "9Cat I" are not categories (assumed); "Fund-Cat I", "(Cat II)", "/Cat 1", "Fund CAT_III" are');
ok(stated12(cls({ category: 'Category II/III' })) && cls({ category: 'AIF-III' }).catAssumed === true && cls({ category: 'AIF-III' }).cls === EQ12,
  'data points for the financial reviewer, pinned as they are built: "Category II/III" is read as Category II (the first number), as stated; "AIF-III" is read as nothing: Category I or II, assumed (KI-171)');

console.log('--- 1a2. the entry counts as a statement about the same fund only (delta review D1-F1, D1-F3, D1-F5) ---');
const FX = Object.assign({}, REF.AIF_PERF, { 'Synthetic Alpha Strategy Fund': { category: 'Category II' }, 'Synthetic Beta Strategy Fund': { category: 'Cat 1' }, 'Synthetic Gamma Strategy Fund': { category: 'Category IV' },
  'Synthetic Delta Strategy Fund': { category: 'AIF (CAT III) - Long Short' }, 'Synthetic Listed Strategy Fund': { category: 'Listed AIF' },
  'Synthetic Plural Label Fund': { category: 'Listed AIFs' }, 'Synthetic Series Label Fund': { category: 'Listed AIF - Series 2' }, 'Synthetic Unlisted Label Fund': { category: 'Unlisted AIF' } });
const REFX = Object.assign({}, REF, { AIF_PERF: FX });
const mx = (name, key, h) => E.taxClassify(Object.assign({ product: 'AIF', asset: 'Equity', category: '', name, perfSrc: 'AIF', perfKey: key }, h), REFX);
ok(stated12(mx('Synthetic Alpha Strategy Fund', 'Synthetic Alpha Strategy Fund')) && stated12(mx('Synthetic Beta Strategy Fund', 'Synthetic Beta Strategy Fund')) && mx('Synthetic Gamma Strategy Fund', 'Synthetic Gamma Strategy Fund').catAssumed === true,
  'an entry that says Category II or Cat 1 is a statement for the same fund (Category I or II, no mark); one that says Category IV is read as nothing: assumed');
ok(mx('Synthetic Delta Strategy Fund', 'Synthetic Delta Strategy Fund').cls === CAT3LS && !mx('Synthetic Delta Strategy Fund', 'Synthetic Delta Strategy Fund').catRuled, 'an entry that says Category III Long Short gives the Long Short row, as stated');
ok(mx('Synthetic Delta Sibling Fund 2', 'Synthetic Delta Strategy Fund').cls === EQ12 && mx('Synthetic Delta Sibling Fund 2', 'Synthetic Delta Strategy Fund').catAssumed === true && !mx('Synthetic Delta Sibling Fund 2', 'Synthetic Delta Strategy Fund').catRuled,
  'a sibling the matcher maps to the Long Short entry does not take its Long Short row: Category I or II, assumed, with the note (the entry is read only for the fund of the same name)');
/* the entry's category text has its own patterns, so each separator is tried there too (ARC-01: the entry-label branches were not reached by its mutants) */
const hex4 = s => ('0000' + s.charCodeAt(0).toString(16).toUpperCase()).slice(-4);
const ENT = {};
SEPS.forEach(s => { const u = hex4(s);
  ENT['Synthetic Sep3x' + u + ' Fund'] = { category: 'Category' + s + 'III' }; ENT['Synthetic Sep2x' + u + ' Fund'] = { category: 'Category' + s + 'II' };
  ENT['Synthetic Sep1x' + u + ' Fund'] = { category: 'Cat' + s + '1' }; ENT['Synthetic Sep4x' + u + ' Fund'] = { category: 'CAT' + s + s + '3' };
  ENT['Synthetic Sep5x' + u + ' Fund'] = { category: 'Cat' + s + s + '2' }; });
Object.assign(ENT, { 'Synthetic Word3 Fund': { category: 'Category Three' }, 'Synthetic Word2 Fund': { category: 'Category Two' }, 'Synthetic Word1 Fund': { category: 'Cat One' },
  'Synthetic Bob3 Fund': { category: 'Bobcat III' }, 'Synthetic Wild2 Fund': { category: 'Wildcat II' }, 'Synthetic Star3 Fund': { category: 'Category*III' }, 'Synthetic Junk2 Fund': { category: 'Category X II' } });
const REFXS = Object.assign({}, REF, { AIF_PERF: Object.assign({}, FX, ENT) });
const mxs = name => E.taxClassify({ product: 'AIF', asset: 'Equity', category: '', name, perfSrc: 'AIF', perfKey: name }, REFXS);
const badEnt = SEPS.filter(s => !(stated3(mxs('Synthetic Sep3x' + hex4(s) + ' Fund')) && stated12(mxs('Synthetic Sep2x' + hex4(s) + ' Fund')) && stated12(mxs('Synthetic Sep1x' + hex4(s) + ' Fund')) &&
  stated3(mxs('Synthetic Sep4x' + hex4(s) + ' Fund')) && stated12(mxs('Synthetic Sep5x' + hex4(s) + ' Fund')))).map(hex4);
ok(badEnt.length === 0, 'every separator (' + SEPS.length + ' characters) in the performance entry\'s own category text is read for the fund of that name, singly and twice in a row: Category III, II, "Cat 1", "CAT  3" and "Cat  2" as stated, no mark' +
  (badEnt.length ? ' (not: U+' + badEnt.join(', U+') + ')' : ''));
ok(stated3(mxs('Synthetic Word3 Fund')) && stated12(mxs('Synthetic Word2 Fund')) && stated12(mxs('Synthetic Word1 Fund')),
  'an entry that says "Category Three", "Category Two" or "Cat One" is a statement for the fund of that name, as the fund\'s own words are');
ok(['Synthetic Bob3 Fund', 'Synthetic Wild2 Fund', 'Synthetic Star3 Fund', 'Synthetic Junk2 Fund'].every(n => mxs(n).catAssumed === true),
  'an entry that says "Bobcat III", "Wildcat II", "Category*III" or "Category X II" states no category: Category I or II, assumed, with the note');
ok(stated3(mx(CK.toUpperCase(), CK)) && stated3(mx(CK + ' ', CK)), 'the same name in another letter case or with a trailing space is the same fund: the Category III entry is a statement');
ok(mx('Synthetic Alpha Sibling Fund 2', 'Synthetic Alpha Strategy Fund').catAssumed === true && mx('Synthetic Alpha Sibling Fund 2', 'Synthetic Alpha Strategy Fund').cls === EQ12,
  'a sibling the loose matcher maps to an entry that says Category II is not told it is Category II: assumed, with the note');
const sib = mx(CK + ' Series 7', CK);
ok(sib.catAssumed === true && sib.cls === EQ12, 'a sibling series of the Category III entry (its name and "Series 7") is not unmarked Category III: assumed, with the note');
ok(mx('Synthetic Listed Sibling Fund 2', 'Synthetic Listed Strategy Fund').catAssumed === true && mx('Synthetic Listed Sibling Fund 2', 'Synthetic Listed Strategy Fund').cls === EQ12 && !mx('Synthetic Listed Sibling Fund 2', 'Synthetic Listed Strategy Fund').catRuled,
  'a sibling the matcher maps to a Listed AIF entry is not Category III since the owner\'s answer of 9 Nov 2026 (question 24, restrict): Category I or II, assumed, with the note (stage S10; before it this was Category III, ruled)');
/* AS BUILT (gate review of 2 Nov 2026, TQ-01; KI-171): the entry's label is read like the holding's own, the whole label only. An entry that says "Listed AIFs" or
   "Listed AIF - Series 2" is not the label, and an entry that says "Unlisted AIF" is not a Listed AIF (a missing start anchor would rule it Category III): for the fund of
   that name and for a sibling, Category I or II, assumed, with the note. Today's data holds none of these labels; the data guard in section 1b fails if a refresh brings one. */
const lab = (k, sib) => mx(sib ? k + ' 2' : k, k), notLabel = x => x.cls === EQ12 && x.catAssumed === true && !x.catRuled;
ok(['Synthetic Plural Label Fund', 'Synthetic Series Label Fund'].every(k => notLabel(lab(k)) && notLabel(lab(k, true))),
  'an entry labelled "Listed AIFs" or "Listed AIF - Series 2" is not the label "Listed AIF" (as built, KI-171): Category I or II, assumed, not ruled, for the fund of that name and for a sibling');
ok(notLabel(lab('Synthetic Unlisted Label Fund')) && notLabel(lab('Synthetic Unlisted Label Fund', true)),
  'an entry labelled "Unlisted AIF" is not a Listed AIF: Category I or II, assumed, not ruled, for the fund of that name and for a sibling');
/* the Long Short row is read from an entry only for the fund of the same name, also when the holding's own category is the label (the sibling above has a blank category and never reaches this line) */
const lsSib = mx('Synthetic Delta Sibling Fund 2', 'Synthetic Delta Strategy Fund', { category: 'Listed AIF' });
ok(lsSib.cls === CAT3 && lsSib.catRuled === true && !lsSib.catAssumed,
  'own category "Listed AIF" and a sibling the matcher maps to the Long Short entry: the Listed Equity row, ruled (the fund\'s own words say Listed AIF; the entry\'s Long Short wording picks the row only for the fund of the same name)');
ok(stated12(mx('Synthetic Growth Fund', 'Synthetic Listed Strategy Fund', { category: 'Category II' })) && stated3(mx('Synthetic Growth Fund', 'Synthetic Delta Strategy Fund', { category: 'Category III' })) && stated12(mx(CK, CK, { category: 'Category II' })),
  'the fund\'s own Category II or III beats any entry, even the Category III entry of the same name');
ok(mx('Synthetic Listed Strategy Fund', 'Synthetic Listed Strategy Fund', { category: 'Unlisted AIF' }).catAssumed === true && !mx('Synthetic Listed Strategy Fund', 'Synthetic Listed Strategy Fund', { category: 'Unlisted AIF' }).catRuled,
  'an own category that says Unlisted AIF is not overruled by the entry\'s Listed AIF label: assumed, with the note');

console.log('--- 1a3. the owner\'s answer to question 24 (9 Nov 2026, "Restrict it"): the entry\'s Listed AIF label counts for the entry\'s own name only, "AIF" and brackets ignored (stage S10) ---');
/* A fund the loose name matcher only links by a similar name (another fund of the house, a real-estate fund, a series) is Category I or II, assumed, with the note: its own category says nothing
   or something else, and the entry's label is a statement about another fund. The same name once "AIF" and brackets are ignored is the same fund. */
const asm = x => x.cls === EQ12 && x.catAssumed === true && !x.catRuled, ruled3 = x => (x.cls === CAT3 || x.cls === CAT3LS) && x.catRuled === true && !x.catAssumed;
ok(asm(mx('Synthetic Real Estate Opportunities Fund', 'Synthetic Listed Strategy Fund', { category: 'Real Estate' })) && asm(mx('Synthetic Real Estate Opportunities Fund', 'Synthetic Listed Strategy Fund')) &&
   asm(mx('Synthetic Listed Strategy Fund II', 'Synthetic Listed Strategy Fund')) && asm(mx('Synthetic Listed Strategy Fund Series 2', 'Synthetic Listed Strategy Fund')) && asm(mx('Synthetic Listed Strategy Fund AIF II', 'Synthetic Listed Strategy Fund')) &&
   (x => x.cls === DB12 && x.catAssumed === true && !x.catRuled)(mx('Synthetic Listed Strategy Credit Fund', 'Synthetic Listed Strategy Fund', { asset: 'Debt' })),
  'a loose link is not the entry: a real-estate fund, "II", "Series 2" and "AIF II" of a Listed AIF entry are Category I or II, assumed, with the note (a debt holding takes the debt row, still assumed)');
ok(['Synthetic Listed Strategy Fund', 'Synthetic Listed Strategy Fund AIF', 'Synthetic Listed Strategy Fund (AIF)', 'SYNTHETIC LISTED STRATEGY FUND (aif)', 'Synthetic Listed Strategy Fund ( AIF )', 'Synthetic Listed Strategy (AIF) Fund']
     .every(nm => ruled3(mx(nm, 'Synthetic Listed Strategy Fund'))),
  'the entry\'s own name written "Name", "Name AIF", "Name (AIF)", in capitals, with spaces inside the brackets or with AIF inside the name is the same fund once "AIF" and brackets are ignored: Category III, ruled');
ok(ruled3(mx('Synthetic Real Estate Opportunities Fund', 'Synthetic Listed Strategy Fund', { category: 'Listed AIF' })) && ruled3(mx('Synthetic Listed Sibling Fund 2', 'Synthetic Listed Strategy Fund', { category: 'listed aif' })) &&
   asm(mx('Synthetic Listed Sibling Fund 2', 'Synthetic Listed Strategy Fund', { category: 'Unlisted AIF' })),
  'the fund\'s own words still decide: an own category "Listed AIF" is Category III, ruled, whatever the entry or the name; an own category "Unlisted AIF" never is');
const dbl = (nm, key, h) => E.taxClassify(Object.assign({ product: 'AIF', asset: 'Equity', category: '', name: nm, perfSrc: 'AIF', perfKey: key }, h), REF);
/* the data, one check for each genuine entry (11 when this was written; the loop reads whatever the data holds): its own name, "Name AIF" and "Name (AIF)" count; a series or a second fund does not
   (the sibling words are "Series 2" and an unused word: the matcher's normaliser drops a repeated word, so "Name II" of an entry that already ends in II is the same name) */
listedKeys.forEach((k, i) => {
  ok([k, k + ' AIF', k + ' (AIF)'].every(nm => ruled3(dbl(nm, k))) && [k + ' Series 2', k + ' Zeta', k + ' AIF Zeta'].every(nm => asm(dbl(nm, k))),
    'Listed AIF entry ' + (i + 1) + ' of ' + listedKeys.length + ': its name, "Name AIF" and "Name (AIF)" are Category III, ruled; "Name Series 2", "Name Zeta" and "Name AIF Zeta" are Category I or II, assumed');
});
ok(listedKeys.length >= 1, 'the data holds at least one Listed AIF entry for the checks above (it held 11 when stage S10 was written)');
/* stage S11 (ARC-01's pre-check of S10): step 2 uses the same name equality, so a genuine Category III entry written "Name AIF" or "Name (AIF)" is read as stated, not as an assumed Category I or II */
cat3Keys.forEach((k, i) => {
  ok([k, k + ' AIF', k + ' (AIF)'].every(nm => stated3(dbl(nm, k))) && [k + ' Series 2', k + ' Zeta', k + ' AIF Zeta'].every(nm => asm(dbl(nm, k))),
    'Category III entry ' + (i + 1) + ' of ' + cat3Keys.length + ': its name, "Name AIF" and "Name (AIF)" are Category III, as stated by the data, no mark; "Name Series 2", "Name Zeta" and "Name AIF Zeta" are Category I or II, assumed');
});
ok(stated12(mx('Synthetic Alpha Strategy Fund AIF', 'Synthetic Alpha Strategy Fund')) && stated12(mx('Synthetic Alpha Strategy Fund (AIF)', 'Synthetic Alpha Strategy Fund')) && asm(mx('Synthetic Alpha Strategy Fund AIF Zeta', 'Synthetic Alpha Strategy Fund')) &&
   stated3(mx('Synthetic Delta Strategy Fund (AIF)', 'Synthetic Delta Strategy Fund', { category: 'Category III' })) && mx('Synthetic Delta Strategy Fund (AIF)', 'Synthetic Delta Strategy Fund').cls === CAT3LS,
  'an entry that says Category II is a statement for "Name AIF" and "Name (AIF)" too, one that says Category III Long Short gives its row for them, and "Name AIF Zeta" is another fund: assumed');

console.log('--- 1b. the entry the holding matched ---');
const lh = matched(LK), ch = matched(CK);
ok(lh.cls === CAT3 && lh.catRuled === true && !lh.catAssumed, 'a blank category matched to an entry that says "Listed AIF": Category III, marked as ruled');
ok(stated3(ch), 'a blank category matched to "AIF (CAT III) - Listed Equity": Category III, as stated by the data, no mark');
ok(stated12(matched(LK, { category: 'Category II' })) && stated12(matched(LK, { name: LK + ' - Category II' })),
  'own words say Category II while the matched entry says "Listed AIF": Category II, as stated, no mark');
ok(stated3(matched(LK, { category: 'Category III' })), 'own words say Category III while the matched entry says "Listed AIF": Category III, as stated, no mark');
ok(stated3(matched(CK, { category: 'Listed AIF' })), 'own category "Listed AIF" while the entry says Category III: Category III, as stated by the data, no mark');
ok(matched(LK, { category: 'Listed AIF' }).catRuled === true, 'own category "Listed AIF" and the entry says it too: ruled');
ok(cls({ perfSrc: 'MF', perfKey: LK }).cls === EQ12 && cls({ perfSrc: 'MF', perfKey: LK }).catAssumed === true && cls({ perfSrc: 'AIF', perfKey: 'No Such Fund' }).catAssumed === true && cls({ perfKey: LK }).catAssumed === true,
  'an entry counts only when the holding matched an AIF entry: another source, an unknown key, or none is nothing stated');
const all = keys.map(k => [k, matched(k), cls({ category: REF.AIF_PERF[k].category, name: k })]);
ok(all.filter(x => x[1].catRuled && x[1].cls === CAT3).length === listedKeys.length && all.filter(x => x[1].cls === CAT3 && !x[1].catRuled && !x[1].catAssumed).length === cat3Keys.length &&
   all.filter(x => x[2].catRuled && x[2].cls === CAT3).length === listedKeys.length && all.every(x => !x[1].catAssumed && !x[2].catAssumed),
  'AIF_PERF, matched or by its category: every Listed AIF fund is Category III, ruled; every Category III fund is Category III, stated; none is assumed');

/* ---------------- 2. the review: the record, the totals, the tab, the slides, the AI Analyst ---------------- */
const aif = (name, category, cost, cmv, asset) => ({ client: 'Client A', name, product: 'AIF', asset: asset || 'Equity', category, noUnits: true, nav: cmv, lots: [['2024-03-15', 1, cost]] });
const flexi = { client: 'Client A', name: 'Synthetic Flexi Cap Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund', nav: 300, lots: [['2024-01-10', 1000, 100]] };
const withListed = () => new T.Book()
  .add(aif('Synthetic Listed Opportunities Fund', 'Listed AIF', 5000000, 6000000))                  /* ruled: Rs 0.60 Cr */
  .add(aif('Synthetic Listed Credit Fund', 'Listed AIF', 2000000, 2500000, 'Debt'))                  /* ruled, debt: Rs 0.25 Cr */
  .add(aif('Synthetic Private Equity Fund II', 'Category II', 10000000, 12000000))                   /* stated Category II: Rs 1.20 Cr */
  .add(aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 5000000, 10000000))            /* stated Category III: Rs 1.00 Cr */
  .add(aif('Synthetic Unstated Category Fund', '', 3000000, 4000000))                                /* assumed: Rs 0.40 Cr */
  .add(flexi);
const without = () => new T.Book().add(aif('Synthetic Private Equity Fund II', 'Category II', 10000000, 12000000)).add(aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 5000000, 10000000))
  .add(aif('Synthetic Unstated Category Fund', '', 3000000, 4000000)).add(flexi);
console.log('--- 1c. the real name matcher: the genuine Listed AIFs written "Name AIF" or "Name (AIF)" are still Category III (owner\'s answer to question 24, stage S10) ---');
/* One check for each Listed AIF entry of the data (11 when this was written): a base file's holding is linked to the entry by the page's own matcher, as a client's file would be, and the three spellings
   of the name are Category III, ruled. This is the claim the owner's answer rests on ("all 11 genuine entries written Name AIF or Name (AIF) still count"); a change of the matcher or of the data that breaks it fails here. */
listedKeys.forEach((k, i) => {
  const names = [k, k + ' AIF', k + ' (AIF)'], pm = new T.Book().add(aif(names[0], '', 5000000, 6000000)).add(aif(names[1], '', 5000000, 6000000)).add(aif(names[2], '', 5000000, 6000000)).review(AS_ON).taxation.positions;
  ok(names.every(nm => { const p = pm.find(q => q.name === nm); return !!p && p.catRuled === true && (p.cls === CAT3 || p.cls === CAT3LS) && p.notSplit === 'fundLevel'; }),
    'Listed AIF entry ' + (i + 1) + ' of ' + listedKeys.length + ' through the real matcher: its name, "Name AIF" and "Name (AIF)" are linked to it and are Category III, fund level, ruled');
});
/* the Category III entries of the data (stage S11): written "Name AIF" or "Name (AIF)" they are Category III as stated by the data, no mark, fund level */
cat3Keys.forEach((k, i) => {
  const names = [k, k + ' AIF', k + ' (AIF)'], pm = new T.Book().add(aif(names[0], '', 5000000, 6000000)).add(aif(names[1], '', 5000000, 6000000)).add(aif(names[2], '', 5000000, 6000000)).review(AS_ON).taxation.positions;
  ok(names.every(nm => { const p = pm.find(q => q.name === nm); return !!p && !p.catRuled && !p.catAssumed && (p.cls === CAT3 || p.cls === CAT3LS) && p.notSplit === 'fundLevel'; }),
    'Category III entry ' + (i + 1) + ' of ' + cat3Keys.length + ' through the real matcher: its name, "Name AIF" and "Name (AIF)" are Category III as the data states, no mark, fund level');
});
console.log('--- 2. the review ---');
const m = withListed().review(AS_ON), TX = m.taxation, ns = TX.totals.notSplit, pos = n => TX.positions.find(p => p.name === n);
const lo = pos('Synthetic Listed Opportunities Fund'), lc = pos('Synthetic Listed Credit Fund'), c2 = pos('Synthetic Private Equity Fund II'), ls = pos('Synthetic Long Short Fund'), un = pos('Synthetic Unstated Category Fund');
ok(lo.cls === CAT3 && lo.notSplit === 'fundLevel' && lo.catRuled === true && !lo.catAssumed && lc.cls === DCAT3 && lc.notSplit === 'fundLevel' && lc.catRuled === true,
  'the records: the equity and the debt Listed AIF are fund level and carry catRuled');
ok(c2.notSplit === 'passThrough' && !c2.catRuled && !c2.catAssumed && ls.notSplit === 'fundLevel' && !ls.catRuled && !ls.catAssumed && un.notSplit === 'passThrough' && un.catAssumed === true && !un.catRuled,
  'a stated Category II, a stated Category III and an unstated category keep their records, with their own marks');
ok(ns.fundLevel.n === 3 && ns.fundLevel.ruledN === 2 && T.near(r(ns.fundLevel.cmv), 18500000) && T.near(r(ns.fundLevel.ruledCmv), 8500000) &&
   ns.passThrough.n === 2 && ns.passThrough.assumedN === 1 && T.near(r(ns.passThrough.cmv), 16000000) && T.near(r(ns.passThrough.assumedCmv), 4000000),
  'the totals: 3 fund-level AIFs (Rs 1.85 Cr), 2 of them ruled (Rs 0.85 Cr); 2 pass-through (Rs 1.60 Cr), 1 of them assumed (Rs 0.40 Cr)');
const mw = without().review(AS_ON), Hh = TX.harvest, Hw = mw.taxation.harvest;
ok(T.near(r(Hh.taxBefore), r(Hw.taxBefore)) && T.near(r(Hh.ltGains), r(Hw.ltGains)) && T.near(r(Hh.stGains), r(Hw.stGains)) && Hh.pools.length === Hw.pools.length,
  'the harvest does not move: the Listed AIFs are left out of it, as they were');
ok(T.near(r(TX.totals.unclassCmv), r(mw.taxation.totals.unclassCmv)) && T.near(r(TX.totals.cmv), r(mw.taxation.totals.cmv) + 8500000),
  'the Listed AIFs are not in "not classified"; they are in the total');

(async () => {
  try {
    const tx = R8377(T.text(T.renderTaxTab(m)));
    console.log('--- 2a. the Taxation tab ---');
    ok(/Synthetic Listed Opportunities Fund Equity AIF – Cat III \(Listed Equity\) called a Listed AIF: treated as Category III/.test(tx) &&
       /Synthetic Listed Credit Fund Debt AIF – Cat III called a Listed AIF: treated as Category III/.test(tx), 'the By Holding rows say they are called a Listed AIF and treated as Category III');
    ok(!/Synthetic Long Short Fund Equity AIF – Cat III \(Long Short\) called a Listed AIF/.test(tx) && !/Synthetic Private Equity Fund II Equity AIF – Cat I\/II called a Listed AIF/.test(tx), 'a stated Category III or II holding does not');
    ok(tx.indexOf('3 Category III AIFs are taxed inside the fund') >= 0 &&
       tx.indexOf('2 of them are treated as Category III because they are called Listed AIFs in the file or the performance data. Confirm the category against the AIF’s statement.') >= 0,
      'the Category III note says 2 of the 3 are treated as Category III because they are called Listed AIFs, and to confirm the category');
    ok(/Left out of the harvest.*: 1 Category I or II AIF \(₹1\.20 Cr\), 1 AIF treated as Category I or II \(₹0\.40 Cr\), 1 Category III AIF \(₹1\.00 Cr\), 2 AIFs treated as Category III \(₹0\.85 Cr\)\./.test(tx),
      'left out of the harvest: the Listed AIFs are named apart ("2 AIFs treated as Category III"), not as Category III AIFs');
    ok(!/\b(ruled|ruling|owner)\b/i.test(tx), 'no sentence of the tab says the owner ruled');

    console.log('--- 2b. the slides ---');
    const sl = await T.taxSlidesText(m);
    ok(/Not split: Cat I\/II AIFs \(per underlying asset\)\. Cat III AIFs: fund level\. 1 AIF is treated as Cat I\/II because the file states no Category I, II or III: confirm it against the AIF’s statement\. 2 AIFs are treated as Cat III \(fund level\) because they are called Listed AIFs: confirm against the AIF’s statement\./.test(sl),
      'class slide footnote: the Cat I/II sentence, then "2 AIFs are treated as Cat III (fund level) because they are called Listed AIFs: confirm against the AIF’s statement"');
    ok(/Left out, as not split into long and short term: 1 Cat I\/II AIF \(₹1\.20 Cr\), 1 AIF treated as Cat I\/II \(₹0\.40 Cr\), 1 Cat III AIF \(₹1\.00 Cr\), 2 AIFs treated as Cat III \(₹0\.85 Cr\)\./.test(sl),
      'harvest slide: left out names the Listed AIFs apart ("2 AIFs treated as Cat III (₹0.85 Cr)")');
    ok(!/\b(ruled|ruling|owner)\b/i.test(sl), 'no slide says the owner ruled');

    console.log('--- 2c. the AI Analyst ---');
    const sig = n => T.aiaTaxSignal(m.holdings.find(x => x.name === n), m);
    const sLo = sig('Synthetic Listed Opportunities Fund'), sLs = sig('Synthetic Long Short Fund'), sC2 = sig('Synthetic Private Equity Fund II'), sUn = sig('Synthetic Unstated Category Fund');
    ok(sLo.verdict === 'na' && /^This AIF is called a Listed AIF, so it is treated as Category III; confirm the category against the AIF's statement\. A Category III AIF is taxed inside the fund/.test(sLo.text),
      'a Listed AIF says so, and asks for the statement (got: ' + sLo.text.slice(0, 150) + ')');
    ok(/^A Category III AIF is taxed inside the fund/.test(sLs.text) && /^A Category I or II AIF passes its income through/.test(sC2.text) && /^The file does not state Category I, II or III for this AIF, so it is treated as Category I or II/.test(sUn.text),
      'a stated Category III, a stated Category II and an unstated category read as before');
    ok(![sLo, sLs, sC2, sUn].some(x => /\b(ruled|ruling|owner)\b/i.test(x.text)), 'no AI Analyst sentence says the owner ruled');

    console.log('--- 3. one Listed AIF, and one matched to the data ---');
    const one = new T.Book().add(aif('Synthetic Listed Opportunities Fund', 'Listed AIF', 5000000, 6000000)).add(flexi).review(AS_ON);
    const tx1 = R8377(T.text(T.renderTaxTab(one))), sl1 = await T.taxSlidesText(one);
    ok(tx1.indexOf('1 Category III AIF is taxed inside the fund') >= 0 && tx1.indexOf('It is treated as Category III because it is called a Listed AIF in the file or the performance data. Confirm the category against the AIF’s statement.') >= 0 &&
       /Left out of the harvest.*: 1 AIF treated as Category III \(₹0\.60 Cr\)\./.test(tx1), 'Taxation tab, one Listed AIF: "It is treated as Category III because it is called a Listed AIF…", and the left-out list');
    ok(/Gain\/Loss\. Rates stated as words depend on the assessee or the fund’s own filing\. 1 AIF is treated as Cat III \(fund level\) because it is called a Listed AIF: confirm against the AIF’s statement\./.test(sl1) && !/Cat III AIFs: fund level/.test(sl1) &&
       /Left out, as not split into long and short term: 1 AIF treated as Cat III \(₹0\.60 Cr\)\./.test(sl1), 'slides, one Listed AIF: the sentence, with no separate "Cat III AIFs: fund level"');
    /* two Listed AIFs and no other fund-level AIF (gate review of 2 Nov 2026, TQ-03): every fund-level AIF is ruled, so the note says "They are", not "It is" or "2 of them are" */
    const two = new T.Book().add(aif('Synthetic Listed Opportunities Fund', 'Listed AIF', 5000000, 6000000)).add(aif('Synthetic Listed Credit Fund', 'Listed AIF', 2000000, 2500000, 'Debt')).add(flexi).review(AS_ON);
    const tx2 = R8377(T.text(T.renderTaxTab(two)));
    ok(tx2.indexOf('2 Category III AIFs are taxed inside the fund') >= 0 && tx2.indexOf(' They are treated as Category III because they are called Listed AIFs in the file or the performance data. Confirm the category against the AIF’s statement.') >= 0 &&
       !/It is treated as Category III|of them (is|are) treated as Category III/.test(tx2), 'Taxation tab, two Listed AIFs and no other fund-level AIF: "They are treated as Category III because they are called Listed AIFs …"');
    const viaData = new T.Book().add(aif(LK, '', 5000000, 6000000)).add(aif(CK, '', 5000000, 7000000)).add(aif('Synthetic Reviewed Fund', 'Category II', 5000000, 6000000)).add(flexi).review(AS_ON);
    const vp = n => viaData.taxation.positions.find(p => p.name === n);
    ok(vp(LK) && vp(LK).cls === CAT3 && vp(LK).catRuled === true && vp(CK) && vp(CK).cls === CAT3 && !vp(CK).catRuled && !vp(CK).catAssumed && vp('Synthetic Reviewed Fund').notSplit === 'passThrough',
      'through the review: a blank-category holding that matches a Listed AIF entry is ruled; one that matches the Category III entry is Category III as stated');
    /* ARC-01's case 3 on every surface: a blank category and a matched entry that says "Listed AIF" gets the safe note; the holding that matched the
       Category III entry (case 4) is Category III as stated and carries no note */
    const txV = R8377(T.text(T.renderTaxTab(viaData))), slV = await T.taxSlidesText(viaData), sigV = n => T.aiaTaxSignal(viaData.holdings.find(x => x.name === n), viaData).text;
    ok(txV.indexOf(LK + ' Equity AIF – Cat III (Listed Equity) called a Listed AIF: treated as Category III') >= 0 && txV.indexOf(CK + ' Equity AIF – Cat III (Listed Equity) called a Listed AIF') < 0 &&
       txV.indexOf('1 of them is treated as Category III because it is called a Listed AIF in the file or the performance data. Confirm the category against the AIF’s statement.') >= 0,
      'matched label, blank category: the tab marks the Listed AIF and carries the safe note; the holding that matched the Category III entry is not marked');
    ok(/ Cat III AIFs: fund level\. 1 AIF is treated as Cat III \(fund level\) because it is called a Listed AIF: confirm against the AIF’s statement\./.test(slV) &&
       /Left out, as not split into long and short term: .*1 Cat III AIF \(₹0\.70 Cr\), 1 AIF treated as Cat III \(₹0\.60 Cr\)\./.test(slV),
      'matched label, blank category: the class slide and the harvest slide carry the safe note');
    ok(/^This AIF is called a Listed AIF, so it is treated as Category III; confirm the category against the AIF's statement\. A Category III AIF is taxed inside the fund/.test(sigV(LK)) &&
       /^A Category III AIF is taxed inside the fund/.test(sigV(CK)), 'matched label, blank category: the AI Analyst carries the safe note; the Category III entry\'s holding reads as stated');
    const mixed = new T.Book().add(aif(LK, 'Category II', 5000000, 6000000)).add(flexi).review(AS_ON);
    ok(mixed.taxation.positions.find(p => p.name === LK).cls === EQ12 && !mixed.taxation.positions.find(p => p.name === LK).catRuled && !mixed.taxation.positions.find(p => p.name === LK).catAssumed,
      'through the review: own category Category II while the entry says "Listed AIF" reads as Category II, as stated');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
