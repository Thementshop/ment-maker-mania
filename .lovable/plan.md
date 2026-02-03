

# Fix Chain Creation Timeout - Add Timeout to Critical Database Operations

## Problem Identified

Console logs show chain creation gets stuck at **"Step 4: Creating chain..."** and never completes. The `supabase.from('ment_chains').insert()` call has **no timeout protection**, so if the database query hangs, users wait until the 12-second global timeout fires.

The non-critical operations (Steps 1, 3, 5, 7) have timeout fallbacks, but the **critical** operations (Steps 4 and 6) still block indefinitely.

---

## Solution

Add timeout protection to the critical database operations, but instead of falling back to defaults, we'll throw a specific error that gives the user actionable feedback.

---

## Changes

### 1. Create a Timeout Wrapper for Critical Operations

Add a new helper that wraps critical queries with a timeout that throws on failure:

```typescript
const criticalQueryWithTimeout = async <T,>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  label: string
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
};
```

### 2. Apply Timeout to Step 4 (Create Chain)

Wrap the `ment_chains` insert with an 8-second timeout:

```typescript
// 4. Create chain (with 8s timeout)
console.log('Step 4: Creating chain...');
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

const { data: newChain, error: chainError } = await criticalQueryWithTimeout(
  supabase
    .from('ment_chains')
    .insert({...})
    .select()
    .single(),
  8000,
  'Chain creation'
);
```

### 3. Apply Timeout to Step 6 (Create First Link)

Wrap the `chain_links` insert with an 8-second timeout:

```typescript
// 6. Create first link (with 8s timeout)
const { error: linkError } = await criticalQueryWithTimeout(
  supabase
    .from('chain_links')
    .insert({...}),
  8000,
  'Link creation'
);
```

### 4. Better Error Messages

Update the catch block to show specific error messages:

```typescript
} catch (error: any) {
  clearTimeout(timeoutId);
  console.error('Chain creation failed:', error);
  
  const message = error.message.includes('timed out')
    ? 'Database is slow right now. Please try again.'
    : error.message || 'Something went wrong';
    
  toast({
    title: "Couldn't start chain",
    description: message,
    variant: "destructive"
  });
  setStep('name');
}
```

---

## Technical Details

### File: `src/components/chains/StartChainModal.tsx`

**Changes:**

| Line Range | Change |
|------------|--------|
| ~160-170 | Add `criticalQueryWithTimeout` helper function |
| 237-250 | Wrap `ment_chains` insert with 8-second timeout |
| 275-290 | Wrap `chain_links` insert with 8-second timeout |
| catch block | Update error message to show specific timeout message |

### Timeout Strategy

| Step | Operation | Timeout | On Timeout |
|------|-----------|---------|------------|
| 1 | Daily limit check | 5s | Use fallback (allow creation) |
| 3 | Name availability | 3s | Use fallback (assume available) |
| **4** | **Create chain** | **8s** | **Throw error** |
| 5 | Claim name | Fire-and-forget | No blocking |
| **6** | **Create link** | **8s** | **Throw error** |
| 7 | Update stats | Fire-and-forget | No blocking |

---

## Expected Behavior After Fix

1. User clicks "Start Chain" → modal shows "Starting your chain..."
2. Steps 1-3 complete quickly (with fallbacks if slow)
3. Step 4: If chain creation takes > 8 seconds → shows "Database is slow right now. Please try again."
4. Step 6: If link creation takes > 8 seconds → shows similar message
5. On success: Confetti, success toast, chain appears in dashboard
6. **No more indefinite hanging** - user always gets feedback within 8-10 seconds max

---

## Testing

1. Open Start Chain modal
2. Enter any chain name
3. Enter `test@example.com` as recipient
4. Select category and compliment
5. Watch console for "Step 4: Creating chain..."
6. Either: Success within 8 seconds, OR clear error message
7. Verify chain appears in dashboard on success

