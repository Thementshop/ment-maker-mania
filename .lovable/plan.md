
# Plan: Connect ChainDashboard to Real Database Data

## Overview
Replace the mock chain data in `ChainDashboard.tsx` with real chains fetched from the database via the `useMentChains` hook, and create test chains in the database.

---

## Part 1: Update useMentChains Hook

### 1.1 Enhance the MentChain Interface
Add display name fields to the `MentChain` interface:
- `started_by_display_name?: string`
- `current_holder_display_name?: string`

### 1.2 Modify fetchChains to Join with Profiles
Update the Supabase query to join the `ment_chains` table with `profiles` to get the starter's display name:

```text
Query approach:
1. Fetch chains the user is involved with
2. For each chain, lookup started_by in profiles to get display_name
3. For current_holder:
   - If it's a UUID (registered user), lookup in profiles
   - If it's email/phone/name (unregistered), use it directly
```

---

## Part 2: Update ChainDashboard.tsx

### 2.1 Replace Mock Data with useMentChains Hook
```text
Current:
  const mockChains = useMemo(() => getMockChains(currentUserId), [currentUserId]);

Replace with:
  const { chains, isLoading, error, refetch } = useMentChains();
```

### 2.2 Update Data Transformation
Map `MentChain[]` from the hook to `ChainData[]` expected by `ChainCardNew`:
- Handle null/undefined values for optional fields
- Provide fallbacks for display names
- Set proper default tier if null

### 2.3 Add Loading and Error States
- Show loading spinner while chains are being fetched
- Display error message if fetch fails
- Show empty state when no chains exist

### 2.4 Wire Up Chain Refresh
Connect `onChainPassed` and `onSuccess` callbacks to `refetch()` to update the list after mutations.

---

## Part 3: Create Test Chains in Database

### 3.1 Test Chain Data
Insert 3 test chains with varying states:

| Chain Name | Status | Share Count | Current Holder | Timer |
|------------|--------|-------------|----------------|-------|
| Kindness Wave | active | 12 | Current user (your turn) | 14 hours |
| Love Loop | active | 45 | test@example.com | 3 hours |
| Joy Express | broken | 8 | previous holder | Expired |

### 3.2 Insert Chain Links
Create corresponding chain_links entries to establish history:
- First link for each chain showing initial pass

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useMentChains.ts` | Add display name fields, enhance query with profile joins |
| `src/components/chains/ChainDashboard.tsx` | Replace mock data with hook, add loading/error states |

---

## Technical Details

### Profile Lookup Strategy
Since `current_holder` can be:
1. A UUID (if passed to a registered user)
2. An email address
3. A phone number
4. A name

We need conditional logic:
- Try to match `current_holder` against `profiles.id` 
- If no match found, treat it as the display value itself (email/phone/name)

### Query Optimization
Use a single query with a LEFT JOIN to profiles on `started_by`:
```sql
SELECT mc.*, p.display_name as started_by_display_name
FROM ment_chains mc
LEFT JOIN profiles p ON mc.started_by = p.id
WHERE mc.started_by = $userId OR mc.current_holder = $userId
```

Since Supabase JS client doesn't directly support this join pattern for non-foreign-key relationships, we'll:
1. Fetch chains first
2. Batch fetch profile display names for unique user IDs
3. Map display names back to chains

---

## Expected Outcome
- ChainDashboard shows real chains from the database
- Real-time updates work when chains are passed/created
- Test chains appear immediately after creation
- "Your Turn" tab correctly shows chains where you're the current holder
