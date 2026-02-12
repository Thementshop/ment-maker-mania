

# Fix: Make Chain Landing Page Publicly Accessible

## Problem

The chain exists ("Flow Test", active, ID `4a9defe5-...`), but unauthenticated visitors get "Chain not found" because the RLS policies on `ment_chains` all require `auth.uid()`. Without a logged-in session, the SELECT returns zero rows.

The route itself is already public (no `ProtectedRoute` wrapper), so this is purely a database access issue.

## Root Cause

Current `ment_chains` SELECT policies:
- "Users can view chains they started or are current holder" -- requires `auth.uid()`
- "Users can view active chains for leaderboard" -- allows `status = 'active'` but still requires authentication due to `RESTRICTIVE` policy type

Since all policies are `RESTRICTIVE` (not permissive), an anonymous user with no `auth.uid()` gets no rows.

## Solution

### 1. Add a PERMISSIVE RLS policy for public single-chain lookup

Create a new **permissive** SELECT policy that allows anyone (including anonymous/unauthenticated users) to read a single active chain by its ID:

```sql
CREATE POLICY "Anyone can view active chains by id"
  ON public.ment_chains
  FOR SELECT
  USING (status = 'active');
```

Wait -- the existing "Users can view active chains for leaderboard" policy already has `USING (status = 'active')` but it's marked as `RESTRICTIVE` (`Permissive: No`). The fix is to convert this to a PERMISSIVE policy so it works without authentication:

```sql
-- Drop the restrictive version
DROP POLICY "Users can view active chains for leaderboard" ON public.ment_chains;

-- Recreate as permissive
CREATE POLICY "Anyone can view active chains"
  ON public.ment_chains
  FOR SELECT
  TO public
  USING (status = 'active');
```

This allows unauthenticated users to see active chains (which is already the intent of the leaderboard policy).

### 2. Add a PERMISSIVE policy on `profiles` for public display names

The chain page fetches profile display names for `started_by`. The current `profiles` SELECT policies require authentication. We need public read access:

```sql
-- Already has "Authenticated users can view all profiles" (restrictive)
-- Add a permissive policy for public name lookups
CREATE POLICY "Anyone can view profile display names"
  ON public.profiles
  FOR SELECT
  TO public
  USING (true);
```

### 3. Update ChainPage.tsx query to work without auth

The current `useQuery` in `ChainPage.tsx` fetches `chain_links` for the received compliment, but this is only needed for authenticated current holders. The public view should skip that query gracefully (it already checks `if (user && ...)`), so no code change needed there.

However, add console logging for debugging:

```typescript
// In the queryFn, add:
console.log('Fetching chain:', chainId, 'User:', user?.id || 'anonymous');
```

### 4. Ensure the `chain_links` query doesn't break for anonymous users

The chain page only queries `chain_links` when `user` exists and is the current holder. This is already guarded, so no change needed.

## Summary of Changes

1. **Database migration**: Drop restrictive leaderboard policy, recreate as permissive; add permissive profiles policy
2. **ChainPage.tsx**: Add debug console.log for chain fetch (minor)

## Files to Modify

1. New SQL migration (2 policy changes)
2. `src/pages/ChainPage.tsx` (add console logging)

