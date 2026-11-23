// The clock injected into the reader, the engine and the audit log (architecture §16): an ISO 8601 timestamp.
// Tests pass a fixed clock, so every audit entry is deterministic.

export type Clock = () => string;

/** The system time, in UTC. */
export const systemClock: Clock = () => new Date().toISOString();

/** A clock that always gives the same time. */
export function fixedClock(iso: string): Clock {
  return () => iso;
}
