

# Fix Chain Creation Hanging on Supabase Queries

## Problem Identified

The chain creation is stuck because multiple Supabase queries are timing out:

1. **`getAvailableChainNames()`** - Already has a 5-second timeout, but is timing out (visible in console logs)
2. **`isChainNameAvailable()`** - Has **NO timeout**, so if the database query hangs, the entire chain creation hangs forever

When you enter a custom chain name like "Sunrise Smilers", the code must check if that name is available before proceeding. This query is hanging indefinitely.

---

## Root Cause

The `used_chain_names` table queries are consistently timing out. This suggests either:
- Network latency between browser and database
- RLS policy overhead on the `used_chain_names` table

---

## Solution

### 1. Add Timeout to `isChainNameAvailable()`

Currently (no timeout):
```typescript
export async function isChainNameAvailable(name: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('used_chain_names')
    .select('chain_name')
    .eq('chain_name', name.trim())
    .maybeSingle();
  // ...
}
```

Fixed (with 5-second timeout):
```typescript
export async function isChainNameAvailable(name: string): Promise<boolean> {
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Timeout checking name')), 5000)
  );
  
  const fetchPromise = supabase
    .from('used_chain_names')
    .select('chain_name')
    .eq('chain_name', name.trim())
    .maybeSingle();
  
  const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
  // If timeout occurs, assume name is available to avoid blocking
  // ...
}
```

### 2. Add Global Timeout to Chain Creation

Wrap the entire `handleSend()` operation in a 15-second timeout to prevent infinite hangs regardless of which query fails.

### 3. Optimistic Fallback for Name Checking

If the name availability check times out, allow the chain creation to proceed (optimistically assume available). The unique constraint on `used_chain_names` will catch duplicates if they occur.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/chainNames.ts` | Add timeout to `isChainNameAvailable()` |
| `src/components/chains/StartChainModal.tsx` | Add global timeout wrapper for `handleSend()` |

---

## Code Changes Summary

**chainNames.ts:**
- Add 5-second timeout with `Promise.race()` to `isChainNameAvailable()`
- Return `true` (assume available) on timeout to avoid blocking

**StartChainModal.tsx:**
- Wrap `handleSend()` async logic in a 15-second timeout
- Show error toast and reset to name step if timeout occurs

---

## Expected Result

After these changes:
1. If any database query takes longer than 5 seconds, it will timeout gracefully
2. If the entire chain creation takes longer than 15 seconds, users see an error message
3. No more infinite spinning - the modal will always either succeed or show an error

