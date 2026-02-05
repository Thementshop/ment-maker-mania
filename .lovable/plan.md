

# Fix Chain Creation - Increase Timeout for Database Operations

## Problem

Testing revealed the chain creation process hangs at **Step 4 (Creating chain)**. The 8-second timeout fires before the `ment_chains` INSERT can complete, causing the entire flow to fail.

Console logs from the test:
```
Step 1: Checking daily limit...
Step 1 complete: {chains_started_today: 0, last_chain_start_date: null}
Step 2: Using chain name: test chain 1
Step 3: Checking name availability...
Step 3 complete, available: true
Step 4: Creating chain...
[8 seconds pass... timeout fires]
```

The database appears to be experiencing latency (possibly cold starts or network delays), and our 8-second timeout is too aggressive.

---

## Solution

Increase timeouts to accommodate slower database responses while still providing reasonable user feedback.

### Changes

| Current Timeout | New Timeout | Step |
|-----------------|-------------|------|
| 5s | 5s | Step 1: Daily limit check (fallback on timeout) |
| 3s | 3s | Step 3: Name availability check (fallback on timeout) |
| **8s** | **15s** | Step 4: Create chain (critical) |
| **8s** | **15s** | Step 6: Create link (critical) |
| 12s | **25s** | Global safety timeout |

### File to Modify

`src/components/chains/StartChainModal.tsx`

1. **Line ~175**: Increase global timeout from 12s to 25s
2. **Line ~260**: Increase Step 4 timeout from 8s to 15s  
3. **Line ~305**: Increase Step 6 timeout from 8s to 15s

### Code Changes

```typescript
// Line ~175: Global timeout
const timeoutId = setTimeout(() => {
  toast({...});
  setStep('name');
}, 25000); // Was 12000

// Line ~260: Step 4 - Create chain
const { data: newChain, error: chainError } = await criticalQueryWithTimeout(
  supabase.from('ment_chains').insert({...}).select().single(),
  15000, // Was 8000
  'Chain creation'
);

// Line ~305: Step 6 - Create link
const { error: linkError } = await criticalQueryWithTimeout(
  supabase.from('chain_links').insert({...}),
  15000, // Was 8000
  'Link creation'
);
```

---

## Expected Result

After this change:
- Database operations have 15 seconds to complete (accommodates cold starts)
- User sees "Starting your chain..." spinner during processing
- If still slow after 15s, user gets a specific "database is slow" message
- If everything times out after 25s, user gets a clear error message to retry

---

## Alternative Consideration

If timeouts continue to be an issue, we could consider:
1. Adding a retry mechanism that automatically retries once on timeout
2. Showing a progress indicator with step-by-step status
3. Investigating why Supabase queries are slow (RLS optimization, indexes, etc.)

