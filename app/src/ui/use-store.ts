// A Preact hook over the store (ui/store.ts): the component re-renders on every change of the state.

import { useEffect, useState } from 'preact/hooks';
import type { AppState, Store } from './store.ts';

export function useStore(store: Store): AppState {
  const [state, setState] = useState<AppState>(() => store.get());
  useEffect(() => {
    // A change between the first render and this subscription is picked up here.
    setState(store.get());
    return store.subscribe(() => setState(store.get()));
  }, [store]);
  return state;
}
