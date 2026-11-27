// Section 4, Analytics and overlap (M3a wiring, NB-03; parity rows U-25, U-28, U-58, U-69): for test build 1 the whole
// returns view (scope picker, headline, IRR tree, contributors and notes) from the returns view-model the store keeps
// beside the review (PLAN-04 option B). Empty until a base file and a transactions (IRR) file are accepted.

import type { AppState, Store } from '../store.ts';
import { ReturnsView } from '../components/returns-view.tsx';
import { RETURNS_EMPTY, scopeOf } from '../../views/returns.ts';

export function S4Analytics({ store, state }: { store: Store; state: AppState }) {
  const vm = state.irr.vm;
  const scope = vm && state.review ? scopeOf(vm, state.irr.scopeKey) : null;
  if (!vm || !scope) {
    return (
      <div class="empty-state">
        <p class="empty-lead">{RETURNS_EMPTY}</p>
      </div>
    );
  }
  return <ReturnsView vm={vm} scope={scope} onScope={(key) => store.dispatch({ type: 'scope-picked', key })} />;
}
