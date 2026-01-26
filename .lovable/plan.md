

## Add Auto-Expire Logic to useMentChains.ts

### Overview
Add automatic chain expiration logic that marks chains as "broken" when their timer expires. This ensures users never see stale chains with expired timers.

### Current State
- `fetchChains()` retrieves all chains but does not check for expired ones
- Expired chains remain with `status: 'active'` even after `expires_at` has passed
- UI shows "0:00" but database state is inconsistent

### Implementation

#### Step 1: Add checkAndExpireChains Function
Create a new function inside the hook that:
- Queries for all active chains with `expires_at < NOW()`
- Updates each expired chain with `status: 'broken'` and `broken_at: NOW()`

```typescript
const checkAndExpireChains = useCallback(async () => {
  if (!user) return;
  
  const now = new Date().toISOString();
  
  // Find expired chains that the user is involved with
  const { data: expiredChains } = await supabase
    .from('ment_chains')
    .select('chain_id')
    .eq('status', 'active')
    .lt('expires_at', now)
    .or(`started_by.eq.${user.id},current_holder.eq.${user.id}`);
  
  if (expiredChains && expiredChains.length > 0) {
    await supabase
      .from('ment_chains')
      .update({ 
        status: 'broken', 
        broken_at: now 
      })
      .in('chain_id', expiredChains.map(c => c.chain_id));
  }
}, [user]);
```

#### Step 2: Call checkAndExpireChains at Start of fetchChains
Modify `fetchChains()` to call the expiration check before fetching:

```typescript
const fetchChains = useCallback(async () => {
  if (!user) {
    setChains([]);
    setYourTurnChains([]);
    setIsLoading(false);
    return;
  }

  try {
    setIsLoading(true);
    setError(null);

    // Check and expire any chains that have timed out
    await checkAndExpireChains();

    // Fetch all chains the user is involved with
    const { data, error: fetchError } = await supabase
      // ... rest of existing fetch logic
```

---

## Technical Notes

**File to modify**: `src/hooks/useMentChains.ts`

**Changes summary**:
1. Add `checkAndExpireChains` function (lines ~45, before fetchChains)
2. Update `fetchChains` to call `checkAndExpireChains()` first (line ~53)
3. Add `checkAndExpireChains` to fetchChains dependency array

**Why this approach**:
- Client-side expiration check runs on every fetch
- Ensures user always sees accurate chain states
- Only affects chains the user is involved with (respects RLS)
- Simple implementation with no server-side cron needed

**Trade-off note**: This is client-triggered expiration. If a user never opens the app, their chain won't be marked broken until someone fetches it. A scheduled backend function could handle this more robustly in the future.

