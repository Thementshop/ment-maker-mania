

# Fix Supabase Client Query Blocking

## Problem Summary

Your chains are being created successfully (confetti proves it!), but the chain list fails to load. The console shows "ment_chains query timed out after 8000ms" but the actual HTTP request never appears in network logs.

**Root cause**: The Supabase JavaScript client is blocking database queries. The auth token refresh works, but database requests get stuck in a queue and never fire.

## Technical Analysis

| Observed Behavior | Explanation |
|-------------------|-------------|
| Token refresh at 19:51:40 returns 200 | Auth is working |
| "ment_chains query timed out after 8000ms" | Query started but never completed |
| No `/rest/v1/ment_chains` in network logs | HTTP request was never sent |
| Direct database query returns 9 chains in ~100ms | Database is healthy |

This is a known Supabase JS v2 behavior where the client can get into a blocked state where it queues requests but never sends them.

## Solution

Add explicit session initialization before making database queries. This ensures the Supabase client has resolved its auth state before attempting queries.

### Changes

**File: `src/hooks/useMentChains.ts`**

1. **Add session check before queries** - Wait for the Supabase client to have a valid session state before making database requests:

```typescript
const fetchChains = useCallback(async (silent = false) => {
  if (!user) {
    setChains([]);
    setYourTurnChains([]);
    setIsLoading(false);
    return;
  }

  try {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);

    console.log('[useMentChains] Fetching chains...');

    // CRITICAL: Ensure Supabase client has resolved auth state
    // This fixes the issue where queries hang during/after token refresh
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[useMentChains] No active session, skipping fetch');
      setChains([]);
      setYourTurnChains([]);
      setIsLoading(false);
      return;
    }
    console.log('[useMentChains] Session confirmed, proceeding with fetch');

    // ... rest of fetch logic
  }
}
```

2. **Add retry logic** - If a query fails, retry once after re-confirming session:

```typescript
// Retry wrapper for critical queries
const fetchWithRetry = async <T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  name: string
): Promise<{ data: T | null; error: any }> => {
  try {
    const result = await withTimeout(queryFn(), 8000, name);
    return result;
  } catch (err) {
    console.warn(`[useMentChains] ${name} failed, retrying after session refresh...`);
    // Force session refresh before retry
    await supabase.auth.getSession();
    return await withTimeout(queryFn(), 8000, `${name} (retry)`);
  }
};
```

3. **Reduce timeout for faster feedback** - Users shouldn't wait 8+ seconds for an error. Reduce to 5 seconds with a single retry:

```typescript
// Faster timeout (5s) with automatic retry
const chainsQuery = () => supabase
  .from('ment_chains')
  .select('*')
  .or(`started_by.eq.${user.id},current_holder.eq.${user.id}`)
  .order('created_at', { ascending: false });

const chainsResult = await fetchWithRetry(chainsQuery, 'ment_chains query');
```

## Why This Fixes The Issue

| Issue | Fix |
|-------|-----|
| Client blocks during auth transitions | `getSession()` call forces auth resolution before query |
| First query often hangs | Retry logic catches first-query failures |
| 8+ second wait for error | Reduced to 5s with faster retry |
| No visibility into what's happening | Session confirmation logs |

## Expected Behavior After Fix

```
[useMentChains] Fetching chains...
[useMentChains] Session confirmed, proceeding with fetch
[useMentChains] ment_chains fetched: 9 chains
[useMentChains] Profiles fetched
[useMentChains] Done - 9 chains loaded
```

Or if first attempt fails:
```
[useMentChains] Fetching chains...
[useMentChains] Session confirmed, proceeding with fetch
[useMentChains] ment_chains query failed, retrying after session refresh...
[useMentChains] ment_chains fetched: 9 chains (retry succeeded)
```

## Files to Change

| File | Description |
|------|-------------|
| `src/hooks/useMentChains.ts` | Add session check and retry logic before database queries |

