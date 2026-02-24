

# Fix: Chains invisible due to RLS + non-blocking claim race condition

## Problem
When bdhp1971@gmail.com signs in, only 1 of 4 chains appears. The database has all 4, but RLS blocks 3 of them.

## Root Cause
1. The `ment_chains` RLS policy "Users can view chains they started or are current holder" checks `current_holder = auth.uid()::text` -- this only matches UUIDs, not email strings
2. Three chains still have `current_holder = 'bdhp1971@gmail.com'` (email) instead of the user's UUID
3. The `claim_chains_for_user` RPC (which converts emails to UUIDs) was made fire-and-forget in a previous fix to avoid stalling the UI
4. The claim is timing out after 3 seconds, so it never completes before the fetch
5. Result: RLS blocks the unclaimed chains because the email string doesn't match `auth.uid()::text`

## Fix: Two-part approach

### Part 1: Update RLS policy to also match by email (database migration)
Add an OR condition to the existing SELECT policy so it also checks if `current_holder` matches the user's email from `auth.jwt()`. This makes chains visible immediately even before claiming.

```sql
DROP POLICY "Users can view chains they started or are current holder" ON ment_chains;

CREATE POLICY "Users can view chains they started or are current holder"
  ON ment_chains FOR SELECT
  USING (
    auth.uid() = started_by
    OR current_holder = (auth.uid())::text
    OR lower(current_holder) = lower(auth.jwt()->>'email')
  );
```

### Part 2: Await the claim before fetching (code change)
In `src/hooks/useMentChains.ts`, change the claim from fire-and-forget back to awaited, but keep the 3-second timeout guard so it can't hang forever. This ensures emails get converted to UUIDs promptly.

Change lines 104-109 from fire-and-forget to:
```typescript
// Claim any unclaimed chains (await with timeout so RLS works)
await Promise.race([
  supabase.rpc('claim_chains_for_user', { claiming_user_id: user.id }),
  new Promise((resolve) => setTimeout(() => {
    console.warn('[useMentChains] claim timed out after 3s');
    resolve(null);
  }, 3000))
]).catch(err => console.warn('[useMentChains] claim failed (non-fatal):', err));
```

## Why both parts?
- The RLS fix ensures chains are visible **immediately** even if the claim hasn't run yet
- The awaited claim ensures emails get converted to UUIDs so the user can **interact** with the chain (pass it, use pause tokens)
- Together they eliminate the race condition entirely

## Risk
- Low risk. The RLS change adds a read-only OR condition -- it only affects SELECT visibility, not INSERT/UPDATE/DELETE
- The awaited claim has the same 3-second timeout, so worst case adds 3 seconds of latency on first load (only if claim is truly hanging)

