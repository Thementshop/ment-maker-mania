/**
 * Get a fresh access token, refreshing if expired/near-expiry.
 * Bypasses supabase-js client methods to avoid auth lock contention.
 */
export async function getFreshAccessToken(): Promise<string | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Read tokens from localStorage (where supabase-js persists them)
  const storageKey = `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const accessToken: string | undefined = parsed?.access_token;
  const refreshToken: string | undefined = parsed?.refresh_token;
  const expiresAt: number | undefined = parsed?.expires_at; // unix seconds

  if (!accessToken || !refreshToken) return null;

  // If token is still valid (>60s remaining), return it
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt && expiresAt > now + 60) {
    return accessToken;
  }

  // Token expired or near-expiry — refresh via REST
  console.log('[freshToken] Token expired/near-expiry, refreshing...');
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      console.error('[freshToken] Refresh failed:', res.status);
      return null;
    }

    const data = await res.json();
    if (!data.access_token) return null;

    // Persist refreshed session back to localStorage so supabase-js picks it up
    localStorage.setItem(storageKey, JSON.stringify(data));
    console.log('[freshToken] Token refreshed successfully');
    return data.access_token;
  } catch (err) {
    console.error('[freshToken] Refresh exception:', err);
    return null;
  }
}
