/**
 * Pure helpers mirroring server-side timer extension behavior.
 * Used by tests to verify the additive (NOT reset) Pause Token rule.
 *
 * Server equivalents:
 *   extend_single_ment_timer  -> recipient_expires_at = COALESCE(recipient_expires_at, now()) + 48h
 *   extend_chain_timer        -> expires_at = GREATEST(expires_at, now()) + 24h
 */

export function extendMentExpiry(
  current: Date | string | null | undefined,
  now: Date = new Date()
): Date {
  const base = current ? new Date(current) : now;
  // COALESCE: if null, use now. (Does NOT clamp past dates — mirrors RPC.)
  return new Date(base.getTime() + 48 * 60 * 60 * 1000);
}

export function extendChainExpiry(
  current: Date | string,
  now: Date = new Date()
): Date {
  const base = new Date(current);
  // GREATEST(expires_at, now): an already-expired chain extends from now, not the past.
  const start = base.getTime() > now.getTime() ? base : now;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}
