

# Fix Chain Loading Failure After Timeout

## Problem Identified

When you reload the page, the console shows:
```
[useMentChains] Error: checkAndExpireChains timed out after 5000ms
```

This causes the entire chain loading to fail because:

1. The `checkAndExpireChains()` function times out after 5 seconds
2. This throws an error that propagates to the main `fetchChains` try/catch
3. `setError()` is called, which triggers the error state in the UI
4. **The code stops completely** - no chains are ever fetched
5. The error UI only shows "Failed to load chains" + "Try Again" button (no "Start Chain" button visible)

## Root Cause

The `checkAndExpireChains` timeout is treated as a fatal error that blocks ALL chain loading. But this function is just a "nice to have" optimization - if it fails, we should still try to load the chains.

Additionally, the inner `checkAndExpireChains` function makes Supabase queries WITHOUT the `withTimeout` wrapper, so it can hang indefinitely. When wrapped with `withTimeout` in `fetchChains`, the 5-second timeout kicks in but then crashes everything.

## Solution

### 1. Make `checkAndExpireChains` non-blocking (fail gracefully)

Wrap the `checkAndExpireChains` call in a try/catch so its failure doesn't stop the main chain loading:

```typescript
// Don't let expire check block main loading
try {
  console.log('[useMentChains] Checking expired chains...');
  await withTimeout(checkAndExpireChains(), 5000, 'checkAndExpireChains');
  console.log('[useMentChains] Expired chains checked');
} catch (expireError) {
  console.warn('[useMentChains] Expire check failed (non-fatal):', expireError);
  // Continue loading chains anyway
}
```

### 2. Add timeout to the inner Supabase queries in `checkAndExpireChains`

The `checkAndExpireChains` function itself has two sequential Supabase queries with no timeout protection. Add the `withTimeout` helper to those inner queries:

```typescript
const checkAndExpireChains = useCallback(async () => {
  if (!user) return;
  
  const now = new Date().toISOString();
  
  try {
    // Find expired chains (with timeout)
    const { data: expiredChains } = await withTimeout(
      Promise.resolve(
        supabase
          .from('ment_chains')
          .select('chain_id')
          .eq('status', 'active')
          .lt('expires_at', now)
          .or(`started_by.eq.${user.id},current_holder.eq.${user.id}`)
      ),
      3000,
      'find expired chains'
    );
    
    if (expiredChains && expiredChains.length > 0) {
      // Update expired chains (with timeout)
      await withTimeout(
        Promise.resolve(
          supabase
            .from('ment_chains')
            .update({ status: 'broken', broken_at: now })
            .in('chain_id', expiredChains.map(c => c.chain_id))
        ),
        3000,
        'update expired chains'
      );
      
      console.log(`Auto-expired ${expiredChains.length} chains`);
    }
  } catch (err) {
    // Log but don't throw - this is a background optimization
    console.warn('Error expiring chains (non-fatal):', err);
  }
}, [user]);
```

### 3. Update ChainDashboard error state to still show "Start Chain" button

Even when there's an error loading chains, users should still be able to start a new chain:

```tsx
// Error state - but still allow starting chains
if (error) {
  return (
    <div className="w-full">
      {/* Header with Start Chain button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          🔥 Ment Chains
        </h2>
        <Button
          onClick={handleStartChain}
          className="rounded-full bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-1" />
          Start Chain
        </Button>
      </div>
      
      {/* Error message with retry */}
      <div className="text-center py-12">
        <p className="text-destructive font-medium">Failed to load chains</p>
        <Button onClick={() => refetch()} variant="outline" className="mt-4">
          Try Again
        </Button>
      </div>
      
      {/* Start Chain Modal */}
      <StartChainModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onSuccess={handleChainCreated}
      />
    </div>
  );
}
```

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/useMentChains.ts` | 1. Make `checkAndExpireChains` catch its own errors<br>2. Wrap inner queries with `withTimeout`<br>3. Wrap outer call in try/catch so it fails gracefully |
| `src/components/chains/ChainDashboard.tsx` | Update error state to include header with "Start Chain" button and the modal |

## Expected Behavior After Fix

| Scenario | Before | After |
|----------|--------|-------|
| Expire check times out | Entire page shows error, no Start Chain button | Chains still load, warning logged |
| All queries time out | Error state, no Start Chain button | Error state WITH Start Chain button visible |
| Database is slow | 5s timeout crashes everything | Graceful fallback, user can retry |

