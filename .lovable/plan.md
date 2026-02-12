

# Fix: Chain Landing Page Stuck Loading for Anonymous Users

## Problem

The chain page uses `supabase.from('ment_chains').select(...)` (the Supabase JS client), which hangs/deadlocks for anonymous users with no session. The dashboard already solved this exact problem by using direct `fetch()` calls to the REST API.

## Solution

Replace the Supabase JS client calls in `ChainPage.tsx` with direct REST API `fetch()` calls (matching the pattern in `useMentChains.ts`), plus a 15-second timeout via `AbortController`.

## Changes to `src/pages/ChainPage.tsx`

### 1. Replace the `queryFn` internals (lines ~40-87)

Switch from `supabase.from(...)` to direct `fetch()` calls against the Supabase REST API:

```typescript
queryFn: async (): Promise<ChainData | null> => {
  if (!chainId) return null;
  console.log('[ChainPage] Starting chain fetch...', chainId, 'User:', user?.id || 'anonymous');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const token = session?.access_token || apiKey; // Use anon key if no session

    // Fetch chain
    const chainRes = await fetch(
      `${baseUrl}/rest/v1/ment_chains?select=*&chain_id=eq.${chainId}`,
      {
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.pgrst.object+json', // single object
        },
        signal: controller.signal,
      }
    );

    if (!chainRes.ok) throw new Error(`Chain fetch failed: ${chainRes.status}`);
    const chainData = await chainRes.json();
    console.log('[ChainPage] Chain data received:', chainData);

    // Fetch profiles for display names
    const userIds = [chainData.started_by];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(chainData.current_holder)) {
      userIds.push(chainData.current_holder);
    }

    const profileRes = await fetch(
      `${baseUrl}/rest/v1/profiles?select=id,display_name&id=in.(${userIds.join(',')})`,
      {
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }
    );
    const profiles = profileRes.ok ? await profileRes.json() : [];
    const profileMap = new Map(profiles.map((p: any) => [p.id, p.display_name || 'Anonymous']));

    // Fetch received compliment only if logged-in current holder
    let receivedCompliment: string | undefined;
    if (user && chainData.current_holder === user.id && session) {
      const linksRes = await fetch(
        `${baseUrl}/rest/v1/chain_links?select=sent_compliment&chain_id=eq.${chainId}&order=passed_at.desc&limit=1`,
        {
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );
      const links = linksRes.ok ? await linksRes.json() : [];
      receivedCompliment = links[0]?.sent_compliment;
    }

    return {
      ...chainData,
      started_by_display_name: profileMap.get(chainData.started_by) || 'Anonymous',
      current_holder_display_name: uuidRegex.test(chainData.current_holder)
        ? profileMap.get(chainData.current_holder) || 'Anonymous'
        : chainData.current_holder,
      received_compliment: receivedCompliment,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('[ChainPage] Fetch timed out after 15s');
      throw new Error('Request timed out');
    }
    console.error('[ChainPage] Error fetching chain:', err);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
},
```

### Key differences from current code

1. Uses `fetch()` directly instead of `supabase.from()` -- bypasses the JS client deadlock
2. Uses the anon key as the Bearer token when there is no session (anonymous users)
3. Adds a 15-second `AbortController` timeout so it never spins forever
4. Adds detailed console logs at each stage: starting, data received, errors
5. Uses `Accept: application/vnd.pgrst.object+json` header for single-row responses (replaces `.single()`)

### No other files need changes

The RLS policies are already correct (permissive "Anyone can view active chains" was added in the previous migration). The issue is purely the Supabase JS client hanging for anonymous users.

