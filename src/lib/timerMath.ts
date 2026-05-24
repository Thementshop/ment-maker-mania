/**
 * Pure helper mirroring server-side chain timer extension behavior.
 * Single Ments no longer have a timer — only chains do.
 *
 * Server equivalent:
 *   extend_chain_timer -> expires_at = GREATEST(expires_at, now()) + 48h
 */

export function extendChainExpiry(
  current: Date | string,
  now: Date = new Date()
): Date {
  const base = new Date(current);
  // GREATEST(expires_at, now): an already-expired chain extends from now, not the past.
  const start = base.getTime() > now.getTime() ? base : now;
  return new Date(start.getTime() + 48 * 60 * 60 * 1000);
}
