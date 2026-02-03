

# Fix Chain Creation Timeout - Missing Error Handling

## Problem Identified

The chain creation times out after 15 seconds because **step 5** (claiming chain name) has no error handling. The code at lines 217-224 doesn't capture or throw errors:

```typescript
// Current code - NO ERROR HANDLING!
if (chainName.trim() && newChain) {
  await supabase
    .from('used_chain_names')
    .insert({
      chain_name: finalName,
      chain_id: newChain.chain_id
    });
}
```

If this insert fails or hangs, it silently blocks the entire chain creation, triggering the timeout.

---

## Root Cause

The `used_chain_names` INSERT has an RLS policy that requires a subquery:
```sql
EXISTS (SELECT 1 FROM ment_chains WHERE chain_id = ... AND started_by = auth.uid())
```

This policy check can be slow, especially if the `ment_chains` insert at step 4 hasn't fully committed yet.

---

## Solution

### 1. Add Error Handling for Chain Name Claim

Capture and handle errors from the `used_chain_names` insert:

```typescript
// 5. Claim chain name if custom
if (chainName.trim() && newChain) {
  const { error: nameError } = await supabase
    .from('used_chain_names')
    .insert({
      chain_name: finalName,
      chain_id: newChain.chain_id
    });
  
  // Don't throw - name claiming is non-critical
  // Chain is created successfully even if name claim fails
  if (nameError) {
    console.error('Error claiming chain name:', nameError);
  }
}
```

### 2. Make Name Claiming Non-Blocking

Since the chain is already created successfully at this point, a name claim failure shouldn't block the entire operation. The chain will still work - the name just won't be "reserved."

### 3. Add Debug Logging

Add console logs before each database operation so we can identify exactly where the hang occurs:

```typescript
console.log('Step 1: Checking daily limit...');
// ... query
console.log('Step 2: Checking name availability...');
// ... query
console.log('Step 3: Creating chain...');
// etc.
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/chains/StartChainModal.tsx` | Add error handling to step 5 (chain name claim), add debug logging for all steps |

---

## Code Changes

In `handleSend()`:

1. Add error handling for `used_chain_names` insert (make it non-blocking)
2. Add console.log statements before each database call
3. Keep the 15-second global timeout as a safety net

---

## Expected Result

After these changes:
1. Chain creation will complete successfully even if name claiming fails
2. Console logs will show exactly which step is slow for debugging
3. Users won't be blocked by the non-critical name claiming step

