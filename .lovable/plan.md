
# Fix: Chains Dashboard Infinite Loading Issue

## Root Cause Analysis

The chains dashboard shows a perpetual spinner because of **two issues**:

### Issue 1: Test Data Mismatch
The test chains were created with user ID `2ed84311-c745-4915-905c-ddbf847994e7`, but you're likely logged in as user `83e6e380-5042-4fcd-b504-8e040f3dff3b`. The RLS policy blocks access because:
- `started_by` doesn't match your user ID
- `current_holder` doesn't match your user ID

Result: The query returns **zero chains**, but the UI should show an empty state, not a spinner.

### Issue 2: Profiles RLS Policy Too Restrictive
The `useMentChains` hook tries to fetch display names for all chain participants:
```typescript
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, display_name')
  .in('id', Array.from(userIds));
```

But the profiles RLS policy only allows:
```sql
SELECT ... WHERE auth.uid() = id  -- Can only view YOUR OWN profile
```

This means when fetching other users' display names, the query fails or returns empty, potentially causing issues.

---

## Fix Plan

### Step 1: Update Test Chains to Use Current User
Update the existing test chains to use the correct user ID so they appear for the logged-in user.

```sql
UPDATE ment_chains 
SET started_by = '83e6e380-5042-4fcd-b504-8e040f3dff3b',
    current_holder = '83e6e380-5042-4fcd-b504-8e040f3dff3b'
WHERE chain_name = 'Kindness Wave';

UPDATE ment_chains 
SET started_by = '83e6e380-5042-4fcd-b504-8e040f3dff3b'
WHERE chain_name IN ('Love Loop', 'Joy Express');

UPDATE chain_links
SET passed_by = '83e6e380-5042-4fcd-b504-8e040f3dff3b'
WHERE chain_id IN (
  SELECT chain_id FROM ment_chains 
  WHERE started_by = '2ed84311-c745-4915-905c-ddbf847994e7'
);
```

### Step 2: Add RLS Policy for Profile Visibility
Create a new RLS policy that allows authenticated users to view basic profile info (display names) of other users. This is needed for chain cards to show who started/holds a chain.

```sql
CREATE POLICY "Authenticated users can view all display names" 
  ON profiles FOR SELECT
  TO authenticated
  USING (true);
```

**Note**: This is a common pattern for social apps. Only `display_name` is shown on chain cards - no sensitive data is exposed.

### Step 3: Add Error Boundary to useMentChains
Ensure the hook's `fetchChains` always sets `isLoading = false` even if profile fetching fails:

```typescript
// In useMentChains.ts fetchChains():
try {
  // ... existing fetch logic
} catch (err) {
  setError(err instanceof Error ? err : new Error('Failed to fetch chains'));
} finally {
  setIsLoading(false); // Already exists - but verify no code path skips this
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| Database | Update test chains to use correct user ID |
| Database | Add profiles RLS policy for display name visibility |
| `src/hooks/useMentChains.ts` | Add defensive error handling (optional, for robustness) |

---

## Expected Result
After these changes:
1. The "Kindness Wave" chain appears in "Active" and "Your Turn" tabs
2. "Love Loop" appears in "Active" (held by test@example.com)  
3. "Joy Express" appears in "Ended" (broken chain)
4. Chain cards display starter names correctly
5. No more infinite spinner
