// `funds_summary.csv` (contract §5.11): a convenience copy for a human check, not used for figures. The reader only
// confirms its columns by name, in any order (extra columns ignored), and counts its rows against the manifest.
// RFC 4180: comma separated, double-quoted fields may hold commas, line breaks and doubled quotes. Pure.

export type CsvCheck = { ok: true; rows: number; extraColumns: string[] } | { ok: false; reason: string };

/** Splits CSV text into rows of fields. Blank trailing lines are dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  while (rows.length > 0 && rows[rows.length - 1]!.every((f) => f === '')) rows.pop();
  return rows;
}

/** Checks the header holds every required column (trimmed, case ignored) and counts the data rows. */
export function checkCsv(text: string, required: readonly string[]): CsvCheck {
  const rows = parseCsv(text);
  if (rows.length === 0) return { ok: false, reason: 'the file is empty' };
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const missing = required.filter((c) => !header.includes(c.toLowerCase()));
  if (missing.length > 0) return { ok: false, reason: `missing column${missing.length > 1 ? 's' : ''} ${missing.join(', ')}` };
  const width = header.length;
  for (let r = 1; r < rows.length; r++) {
    if (rows[r]!.length !== width) return { ok: false, reason: `row ${r + 1} has ${rows[r]!.length} fields; the header has ${width}` };
  }
  const extraColumns = header.filter((h) => !required.some((c) => c.toLowerCase() === h));
  return { ok: true, rows: rows.length - 1, extraColumns };
}
