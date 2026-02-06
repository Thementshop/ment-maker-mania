

# Fix: Use AuthContext Session Instead of Calling getSession Directly

## Problem Identified

The console shows the fetch starts but immediately times out without ever showing "Session confirmed":
```
[useMentChains] Fetching chains...
Chain fetch timed out, clearing loading state
```

This means `await supabase.auth.getSession()` on line 135 is **blocking/hanging**.

**Root cause**: The Supabase JS client has an internal lock during auth state transitions. When `useMentChains` calls `supabase.auth.getSession()` directly, it can get stuck waiting for the AuthContext's competing `getSession()` call to complete first.

The project's memory explicitly states:
> "Components must access the current user session via the project's AuthContext rather than calling `supabase.auth.getSession()` directly."

## Solution

Replace the direct `supabase.auth.getSession()` call with using the session already available from `useAuth()`.

### Changes

**File: `src/hooks/useMentChains.ts`**

1. **Get session from AuthContext** - Already importing `useAuth`, just destructure `session` too:

```typescript
// Line 75: Add session to destructure
const { user, session } = useAuth();
```

2. **Remove blocking getSession call** - Use the session from context instead:

```typescript
// Lines 133-143: Replace getSession() call with context check
// BEFORE (blocks):
const { data: { session } } = await supabase.auth.getSession();
if (!session) { ... }

// AFTER (non-blocking):
if (!session) {
  console.warn('[useMentChains] No active session, skipping fetch');
  setChains([]);
  setYourTurnChains([]);
  setIsLoading(false);
  return;
}
console.log('[useMentChains] Session available, proceeding with fetch');
```

3. **Update fetchWithRetry** - Don't call getSession() on retry either:

```typescript
// Lines 23-27: Remove session refresh, just retry the query
const fetchWithRetry = async <T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  name: string,
  timeoutMs: number = 5000
): Promise<{ data: T | null; error: any }> => {
  try {
    const result = await withTimeout(queryFn(), timeoutMs, name);
    return result;
  } catch (err) {
    console.warn(`[useMentChains] ${name} failed, retrying...`);
    // Just retry without calling getSession (which blocks)
    return await withTimeout(queryFn(), timeoutMs, `${name} (retry)`);
  }
};
```

4. **Add session to useEffect dependency** - Ensure fetch triggers when session changes:

```typescript
// Line 299: Add session to dependency array
}, [user, session, fetchChains]);
```

## Why This Works

| Issue | Fix |
|-------|-----|
| `getSession()` blocks during auth transitions | Use session from AuthContext (already resolved) |
| Retry logic also calls blocking `getSession()` | Remove that call, just retry the query |
| Queries never fire | Without blocking, queries execute immediately |

## Expected Console Output After Fix

```
[useMentChains] Fetching chains...
[useMentChains] Session available, proceeding with fetch
[useMentChains] Checking expired chains...
[useMentChains] Fetching ment_chains...
[useMentChains] ment_chains fetched: 9 chains
[useMentChains] Fetching profiles...
[useMentChains] Done - 9 chains loaded
```

## Files to Change

| File | Changes |
|------|---------|
| `src/hooks/useMentChains.ts` | 1. Get `session` from `useAuth()`<br>2. Remove `await supabase.auth.getSession()` call<br>3. Use context session for the check<br>4. Remove `getSession()` from retry logic<br>5. Add `session` to useEffect deps |

