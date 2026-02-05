
# Fix Endless Spinner After Chain Creation

## Problem Identified

After chain creation succeeds and confetti shows, the flow triggers a chain list refresh:

1. Modal sets `step = 'success'` → Confetti shows ✓
2. After 2.5 seconds, `onSuccess()` is called
3. `onSuccess` calls `handleChainCreated()` in ChainDashboard
4. `handleChainCreated()` calls `refetch()` → triggers `fetchChains()` in useMentChains
5. **`fetchChains()` sets `isLoading = true`** and ChainDashboard shows spinner
6. `fetchChains()` makes multiple Supabase queries that hang indefinitely

Additionally, the **realtime subscription** also calls `fetchChains()` when it detects the new chain insert - this fires BEFORE the modal even closes, starting another fetch that can hang.

## Root Cause

The `fetchChains()` function in `useMentChains.ts` makes **4 sequential database queries**:
1. `checkAndExpireChains()` - finds and updates expired chains
2. `ment_chains` table query
3. `profiles` table query  
4. `chain_links` table query

If any query hangs (due to the same Supabase client issues), the loading state never clears. The 10-second timeout exists but may not be triggering correctly.

## Solution

### 1. Add timeout protection to each query in `fetchChains()`

Wrap each Supabase query with a Promise.race timeout so no single query can block forever.

### 2. Don't set loading=true on realtime-triggered refetch

When the realtime subscription triggers a refetch, don't show the loading spinner - just update data silently in the background.

### 3. Add console logs to track which query is stuck

## Changes

### File: `src/hooks/useMentChains.ts`

**Add a helper function for query timeouts (after line 4)**
```typescript
// Helper to add timeout to any promise
const withTimeout = <T>(promise: Promise<T>, ms: number, name: string): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
};
```

**Update fetchChains to accept a silent mode parameter (line 88)**
```typescript
const fetchChains = useCallback(async (silent = false) => {
  if (!user) {
    setChains([]);
    setYourTurnChains([]);
    setIsLoading(false);
    return;
  }

  try {
    // Only show loading spinner if not a silent refresh
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);
    
    console.log('[useMentChains] Fetching chains...');
```

**Wrap each query with timeout and logging (lines 100-155)**
```typescript
// Check and expire any chains that have timed out (with timeout)
console.log('[useMentChains] Checking expired chains...');
await withTimeout(checkAndExpireChains(), 5000, 'checkAndExpireChains');
console.log('[useMentChains] Expired chains checked');

// Fetch all chains the user is involved with (with timeout)
console.log('[useMentChains] Fetching ment_chains...');
const { data, error: fetchError } = await withTimeout(
  supabase
    .from('ment_chains')
    .select('*')
    .or(`started_by.eq.${user.id},current_holder.eq.${user.id}`)
    .order('created_at', { ascending: false }),
  8000,
  'ment_chains query'
);
console.log('[useMentChains] ment_chains fetched:', data?.length || 0, 'chains');
```

**Update realtime subscription to use silent mode (line 217)**
```typescript
(payload) => {
  console.log('Chain updated:', payload);
  fetchChains(true); // Silent refresh - don't show loading spinner
}
```

**Update the refetch return to support both modes (line 411)**
```typescript
refetch: (silent?: boolean) => fetchChains(silent ?? false),
```

## Why This Fixes the Endless Spinner

| Issue | Fix |
|-------|-----|
| Individual queries can hang forever | Each query has 5-8 second timeout |
| Realtime triggers loading spinner | Silent mode updates data without spinner |
| No visibility into which query hangs | Console logs for each step |
| 10 second global timeout not granular enough | Per-query timeouts catch issues faster |

## Expected Console Output (Success)
```
[useMentChains] Fetching chains...
[useMentChains] Checking expired chains...
[useMentChains] Expired chains checked
[useMentChains] Fetching ment_chains...
[useMentChains] ment_chains fetched: 5 chains
[useMentChains] Fetching profiles...
[useMentChains] Profiles fetched
[useMentChains] Fetching chain_links...
[useMentChains] Chain links fetched
[useMentChains] Done - 5 chains loaded
```

## Expected Console Output (Timeout)
```
[useMentChains] Fetching chains...
[useMentChains] Checking expired chains...
Error: checkAndExpireChains timed out after 5000ms
```
