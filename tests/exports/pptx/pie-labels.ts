// The data labels of a pie chart part, read from its XML for the deck tests (D-039 point 6; deck-design-system.md
// §2.4): per data point, whether the label is deleted, its lines (the runs of its one paragraph, split at each line
// break), the wrap of its text body and the properties of every run and break; and the series defaults. Read here,
// beside the tests that pin the two-line labels, so they do not depend on how the shared slide inventory joins runs.

import { all, kid, kids, parseXml, path, type XmlNode } from '../../helpers/slide-inventory.ts';

export type RunProps = { size: number | null; font: string | null; colour: string | null };
export type PieLabel = {
  idx: number;
  deleted: boolean;
  /** The text of each line, in order; null for a deleted label. */
  lines: string[] | null;
  /** The wrap attribute of the label's text body, or null when it has none. */
  wrap: string | null;
  paragraphs: number;
  /** The properties of every run, then of every line break, in order. */
  runs: RunProps[];
  breaks: RunProps[];
  position: string | null;
  separator: string | null;
};
export type PieLabels = { labels: PieLabel[]; defaults: { wrap: string | null; separator: string | null; position: string | null } };

function props(rPr: XmlNode | undefined): RunProps {
  const c = path(rPr, 'a:solidFill', 'a:srgbClr');
  return {
    size: rPr?.attrs.sz ? Number(rPr.attrs.sz) / 100 : null,
    font: kid(rPr, 'a:latin')?.attrs.typeface ?? null,
    colour: c ? (c.attrs.val ?? '').toUpperCase() : null,
  };
}

/** The labels of the one pie series of a chart part. */
export function pieLabels(chartXml: string): PieLabels {
  const doc = parseXml(chartXml);
  const ser = all(doc, 'c:ser')[0];
  const dLbls = kid(ser, 'c:dLbls');
  const labels = kids(dLbls, 'c:dLbl').map((d): PieLabel => {
    const rich = path(d, 'c:tx', 'c:rich');
    const paras = kids(rich, 'a:p');
    const lines: string[] = [''];
    const runs: RunProps[] = [];
    const breaks: RunProps[] = [];
    for (const p of paras) {
      for (const el of p.children) {
        if (el.name === 'a:r') {
          lines[lines.length - 1] += kid(el, 'a:t')?.text ?? '';
          runs.push(props(kid(el, 'a:rPr')));
        } else if (el.name === 'a:br') {
          lines.push('');
          breaks.push(props(kid(el, 'a:rPr')));
        }
      }
    }
    const deleted = kid(d, 'c:delete')?.attrs.val === '1';
    return {
      idx: Number(kid(d, 'c:idx')?.attrs.val),
      deleted,
      lines: deleted || !rich ? null : lines,
      wrap: kid(rich, 'a:bodyPr')?.attrs.wrap ?? null,
      paragraphs: paras.length,
      runs,
      breaks,
      position: kid(d, 'c:dLblPos')?.attrs.val ?? null,
      separator: kid(d, 'c:separator')?.text ?? null,
    };
  });
  return {
    labels,
    defaults: {
      wrap: path(dLbls, 'c:txPr', 'a:bodyPr')?.attrs.wrap ?? null,
      separator: kid(dLbls, 'c:separator')?.text ?? null,
      position: kid(dLbls, 'c:dLblPos')?.attrs.val ?? null,
    },
  };
}

/** A label's text as it reads on the slide: its lines joined by a line feed; null for a deleted label. */
export function labelText(chartXml: string, idx: number): string | null {
  const l = pieLabels(chartXml).labels.find((x) => x.idx === idx);
  return l && !l.deleted && l.lines ? l.lines.join('\n') : null;
}

/** The view-model's label as the slide prints it: the category, a line feed, then the percent ('Equity\n59.3%'). */
export function onTwoLines(label: string | null): string | null {
  return label === null ? null : label.replace(/ (?=[^ ]+$)/, '\n');
}

/** The outline elements of a pie series before its data labels: the series' and each data point's a:ln. */
export function seriesLines(chartXml: string): string[] {
  const ser = chartXml.slice(chartXml.indexOf('<c:ser>'), chartXml.indexOf('<c:dLbls>'));
  return ser.match(/<a:ln\b[^>]*?(?:\/>|>[\s\S]*?<\/a:ln>)/g) ?? [];
}
