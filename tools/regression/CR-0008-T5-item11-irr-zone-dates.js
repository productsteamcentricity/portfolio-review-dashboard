/* ============================================================================
   CR-0008, tax batch part T5, item 11: an IRR date written with an explicit zone is read as the day it states.
   (ARC-01, C2 of its review of the change-impact contract; KI-186; interface I-04.)

     node tools/regression/CR-0008-T5-item11-irr-zone-dates.js

   Part T2 (TX-02) reads free text through Date and takes the machine-local calendar day. For text without a zone that is the day
   written, in every zone. For a date-time that names its own zone ("2023-04-01T00:00:00Z", "...T20:00:00Z", "...+05:30") it is the
   machine-local day of the instant, which is another day in some zones (main read the UTC date of the instant). Item 11 reads the day
   written in the text, so every form below reads as the day it states, in every zone.
   ("Without a zone" is not true of every text: Date parses the ISO year and year-month, "2023" and "2023-04", as UTC midnight, so they are the previous day west of UTC,
   in part T2 and here. Hour-only offsets, zone words such as UTC and a bare Z after a date are not taken by the pattern either; the second table pins them.)

   Only ISO-like date-times ("yyyy-mm-dd" or "yyyy-mm-dd hh:mm[:ss[.fff]]" followed by Z or +hh:mm, +hhmm) are read as written. Other text
   that names a zone, such as an RFC 2822 string ("Sat, 01 Apr 2023 20:00:00 GMT") or the text a JavaScript Date writes, still goes
   through Date and stays the machine-local day of the instant (KI-186 states it; ARC-01's condition f). The second table below pins that,
   so a later change to those forms must change this file too. Whether real IRR exports hold such strings is UNKNOWN (the sample files do not).

   The zone is set inside the test (process.env.TZ). A TZ value with a slash typed in Git Bash does not reach node on this laptop, so
   the shell cannot force these zones. Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E } = T.host();
const ZONES = ['Asia/Kolkata', 'UTC', 'America/New_York', 'America/Los_Angeles', 'Pacific/Auckland', 'Pacific/Honolulu', 'Pacific/Kiritimati', 'America/St_Johns'];
/* [the text of the date, the day it states] */
const FORMS = [
  ['2023-04-01', '2023-04-01'], ['2023/04/01', '2023-04-01'], ['01/04/2023', '2023-04-01'], ['01-04-2023', '2023-04-01'],
  ['01-Apr-2023', '2023-04-01'], ['1 Apr 2023', '2023-04-01'], ['April 1, 2023', '2023-04-01'], ['Apr 1 2023', '2023-04-01'],
  ['2023-04-01T00:00:00', '2023-04-01'], ['2023-04-01 00:00:00', '2023-04-01'],
  ['2023-04-01T00:00:00Z', '2023-04-01'], ['2023-04-01T20:00:00Z', '2023-04-01'], ['2023-04-01T00:00:00+05:30', '2023-04-01'], ['2023-04-01T23:30:00+05:30', '2023-04-01'],
  ['2023-03-31T23:30:00-05:00', '2023-03-31'], ['2023-04-02T00:30:00+13:00', '2023-04-02'], ['2024-02-29T20:00:00.000Z', '2024-02-29'], ['2023-12-31 23:59:59+0530', '2023-12-31'],
  /* the shapes the pattern also takes (delta review D2-F4): a lower-case t or z, blanks before the zone (also a no-break space), a fraction of any length, no seconds */
  ['2023-04-01t20:00:00z', '2023-04-01'], ['2023-04-01 20:00:00 +05:30', '2023-04-01'], ['2023-04-01 20:00:00\u00A0+05:30', '2023-04-01'],
  ['2023-04-01T20:00:00.1234567Z', '2023-04-01'], ['2023-04-01T20:00:00.123456+00:00', '2023-04-01'], ['2023-04-01T20:00Z', '2023-04-01']
];
const HDR = ['CLIENT NAME', 'INSTRUMENT NAME', 'ASSET CLASS', 'PRODUCT', 'FOLIO NO', 'TRXN_DATE', 'TRANSACTION TYPE', 'TYPE', 'PRICE', 'AMOUNT'];
const read = v => {
  const aoa = [HDR, ['Client A', 'Synthetic Fund', 'Equity', 'Mutual Funds', 'F1', v, 'Purchase', 'Transaction', 100, -1000]];
  const row = E.parsers.parseIRR(['SI Xirr'], n => aoa).fund[0];   /* a row whose date cannot be read is dropped */
  return row && row.d ? row.d.toISOString() : null;
};
/* text that names a zone but is not ISO-like: still read through Date, the machine-local day of the instant (not changed by item 11); [text, the day it writes] */
const RFC = [
  ['Sat, 01 Apr 2023 20:00:00 GMT', '2023-04-01'], ['Sat, 01 Apr 2023 00:00:00 GMT', '2023-04-01'], ['Sat, 01 Apr 2023 00:00:00 +0530', '2023-04-01'],
  ['Sat Apr 01 2023 20:00:00 GMT+0000 (Coordinated Universal Time)', '2023-04-01'],
  /* more text that names a zone, or no zone at all, and that the pattern does not take (delta review D2-F1, D2-F2); pinned as it is, so a change must change this file: an
     hour-only offset, a zone word, a date with a bare Z, and the ISO year and year-month, which Date parses as UTC midnight */
  ['2023-04-01 20:00:00+00', '2023-04-01'], ['2023-04-01 20:00:00 UTC', '2023-04-01'], ['2023-04-01Z', '2023-04-01'], ['2023-04', '2023-04-01'], ['2023', '2023-01-01']
];
const localDay = text => { const d = new Date(text); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString(); };
/* what Date refuses stays refused (the row is dropped, as before): item 11 changes the day a valid text reads as, never whether a text is accepted */
const REFUSED = ['2023-13-01T00:00:00Z', '2023-04-01T25:00:00Z', '2023-04-01T10:61:00Z', '2023-04-01T10:00:61Z', '2023-04-01T10:00:00+25:00',
  '2023-04-01T10:00:00+05:75', '2023-04-01T10:00:00 +05:30', '0000-00-00T00:00:00Z', '2023-4-1T10:00:00Z'];
const saved = process.env.TZ;
const rfcMoved = [];
ZONES.forEach(z => {
  process.env.TZ = z;
  const local = new Date(2023, 3, 1);
  const off = -local.getTimezoneOffset();
  const bad = FORMS.filter(([text, day]) => read(text) !== day + 'T00:00:00.000Z').map(([text]) => text);
  ok(bad.length === 0, z + ' (offset ' + off + ' min): all ' + FORMS.length + ' forms read as the day written, at UTC midnight' + (bad.length ? ' (not: ' + bad.join(' | ') + ')' : ''));
  const badRfc = RFC.filter(([text]) => read(text) !== localDay(text)).map(([text]) => text);
  ok(badRfc.length === 0, z + ': ' + RFC.length + ' forms the pattern does not take (RFC 2822 and Date text, zone words, an hour-only offset, a bare Z, the ISO year and year-month) stay the machine-local day of the instant, as part T2 reads them' + (badRfc.length ? ' (not: ' + badRfc.join(' | ') + ')' : ''));
  RFC.forEach(([text, day]) => { if (localDay(text) !== day + 'T00:00:00.000Z') rfcMoved.push(z + ': ' + text); });
  const kept = REFUSED.filter(s => read(s) !== null);
  ok(kept.length === 0, z + ': ' + REFUSED.length + ' impossible ISO-like date-times (month 13, hour 25, minute 61, offset +25:00, year 0000 ...) are still dropped' + (kept.length ? ' (read: ' + kept.join(' | ') + ')' : ''));
});
if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved;
ok(rfcMoved.length > 0, 'those forms really are zone-dependent (KI-186): ' + rfcMoved.length + ' of ' + (RFC.length * ZONES.length) + ' (zone, form) pairs read another day than the one written');
ok(read('not a date') === null && read('') === null, 'text that is not a date still reads as no date (its row is dropped, as before)');
done();
