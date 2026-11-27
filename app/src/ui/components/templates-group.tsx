// The Templates group of section 1 (NB-05; parity row U-06): the blank base file template and the blank transactions
// (IRR) file template, each a workbook with its Read Me, built in the browser on request (exports/xlsx/base-template.ts,
// exports/xlsx/irr-template.ts through the store and the wiring's download path). No file is needed first, and nothing
// of the family's data goes into either. The IRR slot keeps its own template button (MOD-05's D3). The capital-gains
// template joins with one more button when its upload is wired (NB-03's M7a).

import type { Store } from '../store.ts';

export function TemplatesGroup({ store }: { store: Store }) {
  return (
    <div class="upload-slot">
      <p class="field-help">
        For a file put together by hand. The platform's holding report and cashflow report can be uploaded as they come;
        each template is that layout, blank, with a Read Me of the columns and the rules.
      </p>
      <div class="actions">
        <button type="button" id="download-base-template" class="btn" onClick={() => store.downloadBaseTemplate()}>
          Download a blank base file template
        </button>
        <button type="button" id="download-irr-template-2" class="btn" onClick={() => store.downloadIrrTemplate()}>
          Download a blank transactions (IRR) file template
        </button>
      </div>
    </div>
  );
}
