// Synthetic IRR files and capital-gains statements for the realised-gains reconciliation (NB-M7a S5; parity row E-141,
// AC-18; design capital-gains-upload.md §13.2 `cg-statement-mismatch`). The matrix names `cg-statement-mismatch` against
// `irr-a`; M3's `irr-a` does not exist yet, so `irr-realised` below stands in for it: an IRR fund sheet of two clients,
// and `cg-statement-mismatch` built from its redemptions by FIFO (worked by hand in the comments), then one scheme's lot
// altered. Synthetic data only: clients "Sample Client A" and "Sample Client B", schemes "Sample ... Fund", folios from
// 91600000. Read back by the real readers (parseIrrFile, parseCapitalGains), end to end.

import type { SheetJS } from '../helpers/sheetjs.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseIrrFile } from '../../app/src/ingest/irr-file.ts';
import type { IrrFileImport } from '../../app/src/model/transactions.ts';
import type { SourceFileId } from '../../app/src/model/ids.ts';
import { FUND_HEADER, dateCell, fundRow, toWorkbook } from './make-irr-files.ts';
import type { Cell } from './make-irr-files.ts';
import type { KaLot } from './make-cg-tax-lots.ts';
import { CLIENT_A, CLIENT_B } from './make-cg-statements.ts';

export const IRR_SRC = 'e'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-11-26T00:00:00.000Z';
const D1 = 'Sample Distributor 1';

export const SCHEME = {
  BLUE: 'Sample Bluechip Fund - Regular Plan - Growth',
  FLEXI: 'Sample Flexi Cap Fund - Regular Plan - Growth',
  OLD: 'Sample Contra Fund - Regular Plan - Growth',
  NEW: 'Sample Small Cap Fund - Regular Plan - Growth',
  FOCUSED: 'Sample Focused Fund - Regular Plan - Growth',
  VALUE: 'Sample Value Fund - Regular Plan - Growth',
  MID: 'Sample Midcap Opportunities Fund - Regular Plan - Growth',
} as const;

type Ymd = readonly [number, number, number];

/** A fund flow: paid in negative, paid out positive (the file's sign); price null leaves the cell blank. */
export function flow(client: string, name: string, ymd: Ymd, type: string | null, price: number | null, amount: number, o: { folio?: string; rowType?: string } = {}): Cell[] {
  return fundRow(client, name, o.folio ?? '', 'Equity', dateCell(ymd[0], ymd[1], ymd[2]), type, o.rowType ?? null, price, amount, D1);
}

/**
 * `irr-realised` (stands in for `irr-a`). Hand-worked FIFO on units:
 *  A, Bluechip: SIP 10 Jan 2024 100 u at 100 (10,000); SIP 10 Jun 2024 80 u at 125 (10,000); Redemption 15 Mar 2025
 *     15,840 at 132 = 120 u: 100 u of lot 1 (cost 10,000, sale 13,200, realised 3,200) and 20 u of lot 2 (cost 2,500,
 *     sale 2,640, realised 140). FY 2024-25: 3,340.
 *  A, Flexi Cap: Purchase 1 Apr 2023 200 u at 50 (10,000); Switch Out 1 Aug 2025 4,000 at 80 = 50 u (cost 2,500,
 *     realised 1,500). FY 2025-26: 1,500.
 *  A, Contra: Purchase 1 Jul 2019 100 u at 100 (10,000); Switch Out 10 Nov 2023 15,000 at 150 = 100 u (realised 5,000):
 *     the merger into Small Cap (a non-taxable consolidation in the statement). FY 2023-24.
 *  A, Small Cap: Switch In 10 Nov 2023 15,000 at 150 (100 u), not sold.
 *  A, Focused: Purchase 1 Apr 2024 100 u at 20 (2,000); Redemption 1 Oct 2025 1,500 at 30 = 50 u (cost 1,000,
 *     realised 500). FY 2025-26; not in the statement (IRR-only).
 *  B, Midcap: Purchase 1 May 2024 100 u at 100 (10,000); Redemption 1 Sep 2025 2,400 at 120 = 20 u (cost 2,000,
 *     realised 400). FY 2025-26; the statement has no lot of B.
 * `opts.sellNew` adds A's Small Cap redemption of 4 May 2026, 18,000 at 180 = 100 u: derived cost 15,000 (the merger
 * value of the switch in), realised 3,000, Tax year 2026-27.
 */
export function irrRealisedRows(opts: { sellNew?: boolean } = {}): Cell[][] {
  return [
    ...(opts.sellNew ? [flow(CLIENT_A, SCHEME.NEW, [2026, 5, 4], 'Redemption', 180, 18000)] : []),
    flow(CLIENT_A, SCHEME.BLUE, [2024, 1, 10], 'SIP', 100, -10000),
    flow(CLIENT_A, SCHEME.BLUE, [2024, 6, 10], 'SIP', 125, -10000),
    flow(CLIENT_A, SCHEME.BLUE, [2025, 3, 15], 'Redemption', 132, 15840),
    flow(CLIENT_A, SCHEME.FLEXI, [2023, 4, 1], 'Purchase', 50, -10000),
    flow(CLIENT_A, SCHEME.FLEXI, [2025, 8, 1], 'Switch Out', 80, 4000),
    flow(CLIENT_A, SCHEME.OLD, [2019, 7, 1], 'Purchase', 100, -10000),
    flow(CLIENT_A, SCHEME.OLD, [2023, 11, 10], 'Switch Out', 150, 15000),
    flow(CLIENT_A, SCHEME.NEW, [2023, 11, 10], 'Switch In', 150, -15000),
    flow(CLIENT_A, SCHEME.FOCUSED, [2024, 4, 1], 'Purchase', 20, -2000),
    flow(CLIENT_A, SCHEME.FOCUSED, [2025, 10, 1], 'Redemption', 30, 1500),
    flow(CLIENT_B, SCHEME.MID, [2024, 5, 1], 'Purchase', 100, -10000),
    flow(CLIENT_B, SCHEME.MID, [2025, 9, 1], 'Redemption', 120, 2400),
  ];
}

/** An IRR file of fund rows, read back by the real reader. */
export function irrImport(rows: Cell[][], xlsx: SheetJS = loadSheetJS()): IrrFileImport {
  return parseIrrFile(readWorkbook(xlsx, toWorkbook(xlsx, [{ name: 'Tax Xirr', rows: [FUND_HEADER, ...rows] }])), { sourceId: IRR_SRC, now: NOW });
}

const lot = (scheme: string, category: string, folio: string, buy: Ymd, sell: Ymd, units: number, buyNav: number, sellNav: number, extra: Partial<KaLot> = {}): KaLot =>
  ({ scheme, asset: 'Equity', category, folio, buy, sell, units, buyNav, sellNav, ...extra });

/**
 * `cg-statement-mismatch`: the statement of A built from `irr-realised` by FIFO, then altered:
 *  0, 1  Bluechip, the two FIFO lots of the 15 Mar 2025 redemption; lot 0 carries Rs 0.50 more Sell Amount (13,200.50,
 *        within the tolerance): realised 3,200.50 + 140 = 3,340.50 against the derived 3,340;
 *  2     Flexi Cap, the switch out of 1 Aug 2025 at 84 instead of 80 (the altered lot): sale 4,200, realised 1,700
 *        against the derived 1,500 (beyond the tolerance);
 *  3     Contra, the merger row of 10 Nov 2023 (Acquisition Date = Sale Date, Acquisition Price = Sale Price, LTCG and
 *        STCG 0): a non-taxable transfer, its 5,000 left out of the realised total (no successor-reset lot);
 *  4     Value, sold 1 Dec 2024 (10 u, 40 to 55: realised 150): not in the IRR file (statement-only).
 * `opts.flexiSellNav` puts the Flexi Cap lot back to 80 (no mismatch); `opts.repeatBlue` writes lot 1 twice, exactly
 * (an unanswered repeat event: FY 2024-25 INSUFFICIENT EVIDENCE); `opts.sellNew` adds the Small Cap successor sold 4 May
 * 2026: 'carried', the original cost carried (bought 1 Jul 2019 at 100, 100 u at 180: realised 8,000, KA-15's reading);
 * 'reset', bought on the merger day at 150 (a successor-reset lot, KA-15-reset: realised 3,000, and the merger row then
 * keeps its 5,000 in the realised total).
 */
export function mismatchStatementLots(opts: { flexiSellNav?: number; repeatBlue?: boolean; flexiLabel?: string; sellNew?: 'carried' | 'reset' } = {}): KaLot[] {
  const blue1 = lot(SCHEME.BLUE, 'Large Cap Funds', '91600001', [2024, 6, 10], [2025, 3, 15], 20, 125, 132);
  return [
    lot(SCHEME.BLUE, 'Large Cap Funds', '91600001', [2024, 1, 10], [2025, 3, 15], 100, 100, 132, { sellOffset: 0.5 }),
    blue1,
    ...(opts.repeatBlue ? [blue1] : []),
    lot(opts.flexiLabel ?? SCHEME.FLEXI, 'Flexi Cap Funds', '91600002', [2023, 4, 1], [2025, 8, 1], 50, 50, opts.flexiSellNav ?? 84),
    lot(SCHEME.OLD, 'Contra Funds', '91600003', [2019, 7, 1], [2023, 11, 10], 100, 100, 150, { over: { acqDate: [2023, 11, 10], acqPrice: 150, ltcg: 0, stcg: 0 } }),
    lot(SCHEME.VALUE, 'Value Funds', '91600004', [2022, 6, 1], [2024, 12, 1], 10, 40, 55),
    ...(opts.sellNew === 'carried' ? [lot(SCHEME.NEW, 'Small Cap Funds', '91600005', [2019, 7, 1], [2026, 5, 4], 100, 100, 180)] : []),
    ...(opts.sellNew === 'reset' ? [lot(SCHEME.NEW, 'Small Cap Funds', '91600005', [2023, 11, 10], [2026, 5, 4], 100, 150, 180)] : []),
  ];
}
