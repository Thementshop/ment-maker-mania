// ─────────────────────────────────────────────────────────────────────
// Single source of truth for the app's public base URL used in emails,
// reveal links, unsubscribe links, and SMS. Configured via the APP_BASE_URL
// environment variable so it can be changed in ONE place when TMS moves to a
// custom domain (e.g. https://mentshop.com).
// ─────────────────────────────────────────────────────────────────────

const FALLBACK_BASE_URL = 'https://ment-maker-mania.lovable.app';

export function getAppBaseUrl(): string {
  const fromEnv = Deno.env.get('APP_BASE_URL');
  const trimmed = (fromEnv || '').trim().replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : FALLBACK_BASE_URL;
}

// Convenience constant for modules that just need the value at import time.
export const APP_BASE_URL = getAppBaseUrl();
