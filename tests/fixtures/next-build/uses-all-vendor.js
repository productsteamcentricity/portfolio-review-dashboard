// Test entry (M1.4) that imports every vendored library of app/vendor/MANIFEST.json through its vendor:<name> form,
// the JSZip alias included, so the full page can be checked before the units that use them merge:
//   - tests/next/check-next.test.mjs builds it and runs check-next on it (pinned allowances, size budget);
//   - tests/browser/next-spike.mjs opens it under its CSP, from disk and served: each library runs the way the app
//     will use it (a Chart.js pie with the datalabels plugin, a SheetJS workbook written and read back, a PptxGenJS
//     deck with a native chart written to bytes, the deck read back with JSZip), with no CSP violation, no console
//     warning and the built-ins still native; and the two buttons save the bytes through app/src/services/download.ts.
// Synthetic values only.
import Chart from 'vendor:chartjs';
import ChartDataLabels from 'vendor:chartjs-datalabels';
import XLSX from 'vendor:sheetjs';
import PptxGenJS from 'vendor:pptxgenjs';
import JSZip from 'vendor:jszip';
import { downloadBytes, PPTX_MIME, XLSX_MIME } from '../../../app/src/services/download.ts';

const root = document.getElementById('app');
const status = {};
const report = (key, value) => {
  status[key] = value;
  root.dataset.spike = JSON.stringify(status);
};

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function addButton(id, label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = id;
  b.textContent = label;
  b.addEventListener('click', onClick);
  root.appendChild(b);
}

async function run() {
  report('globals', [Chart, ChartDataLabels, XLSX, PptxGenJS, JSZip].map((g) => typeof g).join(','));

  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  root.appendChild(canvas);
  Chart.register(ChartDataLabels);
  const chart = new Chart(canvas, {
    type: 'pie',
    data: { labels: ['Equity', 'Debt'], datasets: [{ data: [59.3, 40.7], backgroundColor: ['#DBC8B2', '#BD9568'] }] },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: { position: 'bottom' },
        datalabels: { formatter: (v, ctx) => `${ctx.chart.data.labels[ctx.dataIndex]} ${v}%` },
      },
    },
  });
  report('chart', chart.getDatasetMeta(0).data.length);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Asset', 'CMV'], ['Equity', 1.99], ['Debt', 0.9]]), 'Sheet1');
  const workbook = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  const back = XLSX.read(workbook, { type: 'array' });
  report('sheetjs', `${back.SheetNames.join(',')} ${XLSX.utils.sheet_to_json(back.Sheets.Sheet1).length}`);

  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();
  slide.addText('Spike', { x: 0.5, y: 0.3, w: 4, h: 0.5, fontFace: 'Cambria' });
  slide.addChart(pptx.ChartType.pie, [{ name: 'Asset', labels: ['Equity', 'Debt'], values: [59.3, 40.7] }], { x: 0.5, y: 1, w: 4, h: 3 });
  const deck = await pptx.write({ outputType: 'uint8array' });
  const zip = await JSZip.loadAsync(deck);
  report('pptx', Object.keys(zip.files).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n)).length);

  window.__spikeFiles = { 'spike.xlsx': toBase64(workbook), 'spike.pptx': toBase64(deck) };
  addButton('download-xlsx', 'Download workbook', () => downloadBytes(workbook, 'spike.xlsx', XLSX_MIME));
  addButton('download-pptx', 'Download deck', () => downloadBytes(deck, 'spike.pptx', PPTX_MIME));
  report('done', true);
}

run().catch((e) => report('error', String((e && e.message) || e)));
