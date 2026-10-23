// Ownership: holders, mode of holding and attribution (architecture §6.8; PRD R-IN-8; E-143; Q-79).
//
// Rules: a holding is attributed to its first holder (the row's client, as the legacy does through the client
// column) and is never split unless the analyst records shares. Without holder columns the client is the sole
// first holder with share 100, and joint holders and the mode are NOT AVAILABLE IN SUPPLIED DATA.

import type { ClientId, FolioId } from '../model/ids.ts';
import type { Holder, HoldingMode, Ownership } from '../model/ownership.ts';
import type { Provenance } from '../model/value.ts';
import { STATUS } from '../model/status.ts';
import { missing, present } from './value.ts';

/** The client a holding's value is attributed to: its first holder. */
export function attributedClient(o: Ownership): ClientId {
  return o.firstHolder.clientId;
}

/** The default record when the file has no holder columns. */
export function defaultOwnership(folioId: FolioId, clientId: ClientId, prov: Provenance): Ownership {
  return {
    folioId,
    firstHolder: {
      role: 'first',
      clientId,
      share: present(100, 'pct', { ...prov, method: 'sole holder: the base file has no holder columns' }),
    },
    jointHolders: missing(STATUS.NOT_AVAILABLE, 'the base file has no holder columns', prov),
    mode: missing(STATUS.NOT_AVAILABLE, 'the base file has no holder columns', prov),
    source: 'default-sole-holder',
  };
}

/**
 * The record read from holder columns. `joint` lists the second and third holders and the guardian found on the
 * row, in that order. Shares are not in the file: a sole holder has 100; with joint holders every share is
 * NOT AVAILABLE IN SUPPLIED DATA (the holding is still attributed to the first holder, never split).
 */
export function ownershipFromColumns(
  folioId: FolioId,
  clientId: ClientId,
  joint: ReadonlyArray<{ role: 'second' | 'third' | 'guardian'; clientId: ClientId }>,
  mode: { kind: 'read'; value: HoldingMode } | { kind: 'blank' } | { kind: 'unrecognised'; text: string },
  prov: Provenance,
): Ownership {
  const noShares = (): Holder['share'] =>
    missing(STATUS.NOT_AVAILABLE, 'holder shares are not in the base file', prov);
  const sole = joint.length === 0;
  const firstHolder: Holder = {
    role: 'first',
    clientId,
    share: sole ? present(100, 'pct', { ...prov, method: 'sole holder: no joint holder in the holder columns' }) : noShares(),
  };
  const jointHolders = present<Holder[]>(
    joint.map((j) => ({ role: j.role, clientId: j.clientId, share: noShares() })),
    'label',
    { ...prov, method: 'base-file holder columns' },
  );
  let modeValue: Ownership['mode'];
  if (mode.kind === 'read') modeValue = present(mode.value, 'label', { ...prov, method: 'base-file mode of holding' });
  else if (mode.kind === 'unrecognised') {
    modeValue = missing(STATUS.INVALID_SOURCE, `mode of holding not recognised: "${mode.text}"`, prov);
  } else if (sole) {
    modeValue = present<HoldingMode>('single', 'label', { ...prov, method: 'no joint holder in the holder columns' });
  } else modeValue = missing(STATUS.NOT_AVAILABLE, 'the mode of holding is blank', prov);
  return { folioId, firstHolder, jointHolders, mode: modeValue, source: 'holder-columns' };
}

/**
 * Reads a mode-of-holding cell. Registrar spellings: Single, Sole, SI; Joint, Jointly, JO, JT; Anyone or
 * Survivor, Either or Survivor, AS, ES. Returns null for anything else.
 */
export function parseHoldingMode(text: string): HoldingMode | null {
  const k = text.replace(/[^a-z]+/gi, ' ').trim().toLowerCase();
  if (k === 'single' || k === 'sole' || k === 'si') return 'single';
  if (k === 'joint' || k === 'jointly' || k === 'jo' || k === 'jt') return 'joint';
  if (k === 'as' || k === 'es' || /^(any ?one|anyone|either) (or )?survivor$/.test(k)) return 'anyone-or-survivor';
  return null;
}
