// covers: U-18 U-19 D-039 KI-091 (M1.4 fix L2: the pies on screen)
// The Chart.js configuration of the section 2 pies (app/src/ui/pie-config.ts), read without a canvas: the same band
// above and below the pie, the legend placed below the band, the side room from the longest label drawn (at least
// 64 px), the percent alone below 360 px of canvas width, and no label and no outline on a pie of one slice. Text
// widths come from a fake measure of 7 px per character, so every padding below is worked out by hand.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Figure, PieChart, PieSlice } from '../../../app/src/views/overview-vm.ts';
import type { LayoutBox, PieContext } from '../../../app/src/ui/pie-config.ts';
import {
  LEGEND_WEIGHT, PIE_FONT_SIZE, PIE_LABEL_BAND, PIE_LABEL_OFFSET, PIE_LABEL_PADDING, PIE_LINE_HEIGHT, PIE_NARROW_PX,
  PIE_SIDE_MIN, labelBandBox, pieConfig, piePadding, sidePadding, sliceLabel,
} from '../../../app/src/ui/pie-config.ts';
import { AS_ON_30_SEP_2026, fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';

/** 7 px per character: "Commodity 3.9%" (14 characters) is 98 px. */
const measure = (text: string): number => text.length * 7;

function pctFigure(v: number, text: string): Figure {
  const value = { kind: 'value' as const, v, unit: 'pct' as const, prov: { sources: [], method: 'test' } };
  return { key: `pie.${text}`, value, shown: value, display: { text, marker: null, footnoteStatus: null, negative: false }, notes: [] } as unknown as Figure;
}
function slice(category: string, colour: string, v: number, text: string, label: string | null): PieSlice {
  return { category, colour, pct: pctFigure(v, text), label };
}

/** The asset pie of the synthetic book (hand-worked shares: tests/helpers/sample-review.ts). */
const ASSET: PieChart = {
  id: 'asset', title: 'Asset allocation', emptyStatus: null,
  slices: [
    slice('Equity', '#DBC8B2', 59.26036385326573, '59.26%', 'Equity 59.3%'),
    slice('Debt', '#BD9568', 26.722338204592898, '26.72%', 'Debt 26.7%'),
    slice('Hybrid', '#BFBFBF', 10.110348941246645, '10.11%', 'Hybrid 10.1%'),
    slice('Commodity', '#808080', 3.9069490008947207, '3.91%', 'Commodity 3.9%'),
  ],
};
const ONE: PieChart = {
  id: 'liquidity', title: 'Liquidity', emptyStatus: null,
  slices: [slice('Open Ended', '#BD9568', 100, '100.00%', 'Open Ended 100.0%')],
};
/** Commodity under 2.00%: the view-model gives it no label (D-039 point 6). */
const SMALL: PieChart = {
  id: 'asset', title: 'Asset allocation', emptyStatus: null,
  slices: [
    slice('Equity', '#DBC8B2', 98.47, '98.47%', 'Equity 98.5%'),
    slice('Commodity', '#808080', 1.53, '1.53%', null),
  ],
};

type Config = {
  data: { labels: string[]; datasets: Array<{ data: number[]; backgroundColor: string[]; borderWidth: number }> };
  plugins: Array<{ id?: string; beforeInit?: (chart: unknown) => void }>;
  options: {
    layout: { padding: (c: PieContext) => { top: number; bottom: number; left: number; right: number } };
    plugins: {
      legend: { position: string; weight: number };
      datalabels: {
        display: (c: PieContext) => boolean;
        formatter: (v: number, c: PieContext) => string;
        offset: number;
        padding: number;
        font: { size: number; lineHeight: number };
      };
    };
  };
};

function config(pie: PieChart): { cfg: Config; boxes: LayoutBox[]; datalabels: object } {
  const boxes: LayoutBox[] = [];
  const datalabels = { id: 'datalabels' };
  const cfg = pieConfig(pie, { datalabels, addBox: (_chart, box) => boxes.push(box), measure }) as unknown as Config;
  return { cfg, boxes, datalabels };
}
const at = (width: number, dataIndex?: number): PieContext => (dataIndex === undefined ? { chart: { width } } : { chart: { width }, dataIndex });

describe('the label band above and below the pie', () => {
  test('one band of 32 px holds a label: 6 px offset + 2 x 4 px padding + one line of 12 px x 1.2 = 28.4 px', () => {
    assert.equal(PIE_LABEL_BAND, 32);
    assert.ok(PIE_LABEL_OFFSET + 2 * PIE_LABEL_PADDING + PIE_FONT_SIZE * PIE_LINE_HEIGHT <= PIE_LABEL_BAND);
    const { cfg } = config(ASSET);
    const dl = cfg.options.plugins.datalabels;
    assert.equal(dl.offset, 6);
    assert.equal(dl.padding, 4);
    assert.equal(dl.font.size, 12);
    assert.equal(dl.font.lineHeight, 1.2);
  });

  test('the bottom padding equals the top at every width', () => {
    const { cfg } = config(ASSET);
    for (const w of [300, 359, 360, 600, 900]) {
      const p = cfg.options.layout.padding(at(w));
      assert.equal(p.top, 32, `top at ${w}`);
      assert.equal(p.bottom, p.top, `bottom at ${w}`);
    }
  });

  test('the legend starts below the label band: a blank box of the band height sits between the pie and the legend', () => {
    const { cfg, boxes, datalabels } = config(ASSET);
    assert.equal(cfg.plugins[0], datalabels, 'the datalabels plugin');
    const band = cfg.plugins[1]!;
    assert.equal(band.id, 'prdLabelBand');
    const chart = {};
    band.beforeInit!(chart);
    assert.equal(boxes.length, 1);
    const box = boxes[0]!;
    assert.equal(box.position, 'bottom');
    assert.equal(cfg.options.plugins.legend.position, 'bottom');
    assert.equal(cfg.options.plugins.legend.weight, LEGEND_WEIGHT);
    // Chart.js places the bottom boxes in ascending weight from the pie downwards: the band first, then the legend.
    assert.ok(box.weight < cfg.options.plugins.legend.weight);
    assert.equal(box.isHorizontal(), true);
    assert.equal(box.fullSize, false);
    box.update(480);
    assert.equal(box.height, 32);
    assert.equal(box.width, 480);
    assert.doesNotThrow(() => box.draw());
    assert.notEqual(labelBandBox(), labelBandBox(), 'each chart gets its own box');
  });
});

describe('the side room and the labels at a canvas width', () => {
  test('wide canvas: the room is the longest label (Commodity 3.9%, 98 px) + 6 + 8 + 4 = 116 px on each side', () => {
    assert.equal(sidePadding(ASSET, 600, measure), 116);
    assert.deepEqual(piePadding(ASSET, 600, measure), { top: 32, bottom: 32, left: 116, right: 116 });
    const { cfg } = config(ASSET);
    assert.deepEqual(cfg.options.layout.padding(at(600)), { top: 32, bottom: 32, left: 116, right: 116 });
  });

  test('below 360 px the label is the percent alone, and the side room falls to the 64 px floor (59.3%: 35 + 18 = 53)', () => {
    assert.equal(PIE_NARROW_PX, 360);
    assert.deepEqual([0, 1, 2, 3].map((i) => sliceLabel(ASSET, i, 359)), ['59.3%', '26.7%', '10.1%', '3.9%']);
    assert.deepEqual([0, 1, 2, 3].map((i) => sliceLabel(ASSET, i, 360)), ['Equity 59.3%', 'Debt 26.7%', 'Hybrid 10.1%', 'Commodity 3.9%']);
    assert.equal(sidePadding(ASSET, 359, measure), PIE_SIDE_MIN);
    assert.equal(PIE_SIDE_MIN, 64);
    const { cfg } = config(ASSET);
    const dl = cfg.options.plugins.datalabels;
    assert.equal(dl.formatter(59.26, at(359, 0)), '59.3%');
    assert.equal(dl.formatter(59.26, at(600, 0)), 'Equity 59.3%');
    assert.equal(dl.display(at(359, 3)), true);
    assert.deepEqual(cfg.options.layout.padding(at(359)), { top: 32, bottom: 32, left: 64, right: 64 });
  });

  test('the room follows the longest label drawn: Debt 26.7% alone (70 px) needs 88 px; its percent alone keeps the floor', () => {
    const debtOnly: PieChart = { ...ASSET, slices: [ASSET.slices[1]!, { ...ASSET.slices[0]!, label: null }] };
    assert.equal(sidePadding(debtOnly, 600, measure), 88);
    assert.equal(sidePadding(debtOnly, 300, measure), 64, '26.7%: 35 + 18 = 53, below the floor');
  });

  test('a slice under 2.00% has no label (the view-model gives none) and takes no room', () => {
    const { cfg } = config(SMALL);
    const dl = cfg.options.plugins.datalabels;
    assert.equal(dl.display(at(600, 1)), false);
    assert.equal(dl.formatter(1.53, at(600, 1)), '');
    assert.equal(dl.display(at(600, 0)), true);
    assert.equal(sidePadding(SMALL, 600, measure), Math.max(64, 12 * 7 + 18), 'Equity 98.5%: 84 + 18 = 102');
  });
});

describe('a pie of one slice', () => {
  test('draws no label and no outline; the legend and the table carry its 100%', () => {
    const { cfg } = config(ONE);
    assert.equal(sliceLabel(ONE, 0, 900), null);
    assert.equal(cfg.options.plugins.datalabels.display(at(900, 0)), false);
    assert.equal(cfg.options.plugins.datalabels.formatter(100, at(900, 0)), '');
    assert.equal(cfg.data.datasets[0]!.borderWidth, 0);
    assert.equal(sidePadding(ONE, 900, measure), 64);
    assert.equal(config(ASSET).cfg.data.datasets[0]!.borderWidth, 1, 'two or more slices keep their 1 px outline');
  });
});

describe('the pies of a real review (syn-standard, read by the reader and computed by the engine)', () => {
  test('asset labels Equity 59.3%, Debt 26.7%, Hybrid 10.1%, Commodity 3.9% in the D-039 colours; liquidity one slice, unlabelled', () => {
    const run = reviewOf(nodeWiring(), fixtureById('syn-standard'), { asOn: AS_ON_30_SEP_2026 });
    const asset = run.vm.charts.asset;
    const { cfg } = config(asset);
    assert.deepEqual(cfg.data.labels, ['Equity', 'Debt', 'Hybrid', 'Commodity']);
    assert.deepEqual(cfg.data.datasets[0]!.backgroundColor, ['#DBC8B2', '#BD9568', '#BFBFBF', '#808080']);
    assert.deepEqual(asset.slices.map((_s, i) => cfg.options.plugins.datalabels.formatter(0, at(600, i))),
      ['Equity 59.3%', 'Debt 26.7%', 'Hybrid 10.1%', 'Commodity 3.9%']);
    // Hand-worked shares (rupees / 1e7): Equity 1.987 of 3.353 Cr.
    assert.ok(Math.abs(cfg.data.datasets[0]!.data[0]! - 59.26036385326573) < 1e-9);
    const liq = run.vm.charts.liquidity;
    assert.equal(liq.slices.length, 1);
    assert.equal(liq.slices[0]!.category, 'Open Ended');
    const l = config(liq).cfg;
    assert.equal(l.options.plugins.datalabels.display(at(600, 0)), false);
    assert.equal(l.data.datasets[0]!.borderWidth, 0);
  });

  test('no label holds an en or em dash (D-029)', () => {
    for (const pie of [ASSET, ONE, SMALL]) {
      pie.slices.forEach((_s, i) => {
        for (const w of [300, 600]) assert.doesNotMatch(sliceLabel(pie, i, w) ?? '', /[–—]/);
      });
    }
  });
});
