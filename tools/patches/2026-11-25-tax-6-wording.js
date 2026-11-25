/* ============================================================================
   2026-11-25 — tax-6 (TA-03, CR-0008): ARC-02's Gate B points on d7683a0, settled
   conservatively (MOD-04, 25 Nov 2026), and the LRS bond rule MOD-03 and MOD-04
   asked for with LP-16.

   T1 (MEDIUM): the Crypto row's source note, shown on the Taxation tab for any
      book that holds crypto, ended "for the owner to confirm." A client may read
      "the owner" as the portfolio's owner (S10 removed it from the crypto
      sentence for that reason). Now "to be confirmed with the tax adviser."
      (PD-52). The latent noSetOffSource ("until the owner rules") now records
      the decision instead: question 18 was answered on 2 Nov 2026 (D-043).
   T2 (MEDIUM): the step that reads an AIF entry's category as a statement about
      the holding compared the two names through the matcher's normalize(),
      which drops filler words, applies synonyms and removes repeated words, so
      "X Income Opportunities Fund" equalled "X Opportunities Fund". PD-54 says
      "an exact name (ignoring AIF and brackets)". The key is now that name word
      for word: letter case, punctuation and spacing (typography: a hyphen for an
      en dash), brackets and the word AIF are ignored; every other word must be
      the same, in the same order, none dropped, replaced or de-duplicated. A
      name with a word more, less or different is another fund: Category I or
      II, assumed, with the note.
   T3 (LOW): the tab's crypto set-off sentence now says "(confirm with the tax
      adviser)" while PD-52 is open, as the slide already does.
   LRS bonds (MOD-03, MOD-04, 25 Nov 2026, with LP-16): a bond whose Product names
      the LRS or the US dollar ("US-dollar bonds (through LRS)") is no longer
      taxed as a domestic "Listed Bonds / NCDs" row. The tax reckoner has no row
      for a bond held abroad, so it is left unclassified with its reason, as the
      tab does for P2P lending and a debt PMS. Domestic bonds and NCDs keep their
      rows: the tax class is not read from LP-16's product labels.

     node tools/patches/2026-11-25-tax-6-wording.js
   ========================================================================== */
'use strict';
const { applyPatch } = require('../patch-lib.js');

applyPatch('tax-6 Gate B wording, exact AIF name, LRS bonds', [
  {
    label: 'TAX_RULES Crypto source: "to be confirmed with the tax adviser", not "for the owner to confirm" (T1)',
    from: 'The 30% rate for any holding period is kept because the law is unchanged; for the owner to confirm.',
    to: 'The 30% rate for any holding period is kept because the law is unchanged; to be confirmed with the tax adviser.'
  },
  {
    label: 'TAX_RULES Crypto noSetOffSource: records the decision of 2 Nov 2026 (T1, latent)',
    from: 'No set-off either way until the owner rules (CR-0008, question 18): ',
    to: 'No set-off either way (CR-0008 question 18, decided 2 Nov 2026; D-043): '
  },
  {
    label: 'engine: the AIF name equality is the exact name word for word, AIF and brackets ignored (T2, PD-54)',
    from: '        var _nkAif=function(s){ return normalize(s).filter(function(t){ return t!=="aif"; }).join(" "); },\n',
    to: [
      String.raw`        /* tax-6 (T2): PD-54's exact name, word for word: letter case, punctuation, brackets and the word AIF are ignored; no word is`,
      String.raw`           dropped, replaced or de-duplicated, so "X Income Opportunities Fund" is not "X Opportunities Fund" */`,
      String.raw`        var _nkAif=function(s){ return String(s||"").toLowerCase().split(/[^a-z0-9]+/).filter(function(t){ return t&&t!=="aif"; }).join(" "); },`,
      ''
    ].join('\n')
  },
  {
    label: 'Taxation tab: the crypto set-off sentence says "(confirm with the tax adviser)" (T3)',
    from: 'Crypto gains and losses are kept out of set-off, as the reckoner is silent on them: ',
    to: 'Crypto gains and losses are kept out of set-off, as the reckoner is silent on them (confirm with the tax adviser): '
  },
  {
    label: 'TAX_WHY: the reason shown for a bond held abroad through the LRS',
    from: '    p2p:"No tax row is published for peer-to-peer lending.",\n',
    to: [
      '    p2p:"No tax row is published for peer-to-peer lending.",',
      '    lrsBond:"No tax row is published for a bond held abroad through the LRS. Confirm its tax with the tax adviser.",',
      ''
    ].join('\n')
  },
  {
    label: 'engine: a bond whose Product names the LRS or the US dollar is not a domestic listed bond',
    from: '    if (/unlisted/.test(p+c)) return K(/debt/.test(a) ? "Unlisted Bonds / NCDs" : "Unlisted Equity Shares");\n',
    to: [
      '    /* tax-6 (MOD-03, MOD-04 with LP-16): a bond held abroad through the LRS has no reckoner row; tested before the unlisted and listed bond rows */',
      '    if (!mfp && /(^|[^a-z])(lrs|usd|us[\\s-]*dollars?)([^a-z]|$)/.test(p) && /bond|ncd|debenture/.test(p+c)) return N(TAX_WHY.lrsBond);',
      '    if (/unlisted/.test(p+c)) return K(/debt/.test(a) ? "Unlisted Bonds / NCDs" : "Unlisted Equity Shares");',
      ''
    ].join('\n')
  }
]);
