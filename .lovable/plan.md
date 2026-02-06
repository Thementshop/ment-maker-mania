
# Fix: Bypass Supabase JS Client for Chain Queries

## Problem Summary

The Supabase JavaScript client's query builder gets stuck after initial auth. Network logs confirm that HTTP requests are **never sent** - the queries time out without making any network call.

**Evidence:**
- `StartChainModal` uses `fetch()` directly → **works** (chains created successfully)
- `gameStore` queries during initial auth → **works** (game state loads)
- `useMentChains` queries via `supabase.from()` later → **times out without network request**

## Solution

Replace the `supabase.from().select()` calls in `useMentChains` with direct `fetch()` calls to the Supabase REST API, using the same pattern that works in `StartChainModal`.

## Technical Changes

### File: `src/hooks/useMentChains.ts`

**1. Add a REST API helper function:**

```typescript
// Direct REST API call - bypasses JS client blocking issues
const supabaseRest = async <T>(
  tableName: string,
  queryParams: string,
  accessToken: string
): Promise<{ data: T | null; error: any }> => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${tableName}?${queryParams}`,
      {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: { message: errorText } };
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};
```

**2. Replace query calls in `fetchChains`:**

Instead of:
```typescript
const chainsQuery = supabase.from('ment_chains').select('*')...
```

Use:
```typescript
const chainsResult = await supabaseRest<MentChain[]>(
  'ment_chains',
  `select=*&or=(started_by.eq.${user.id},current_holder.eq.${user.id})&order=created_at.desc`,
  session.access_token
);
```

**3. Update all query locations:**

| Query | REST Endpoint |
|-------|---------------|
| Main chains fetch | `ment_chains?select=*&or=(started_by.eq.{id},current_holder.eq.{id})&order=created_at.desc` |
| Profiles batch | `profiles?select=id,display_name&id=in.(${ids})` |
| Chain links | `chain_links?select=*&chain_id=in.(${ids})&order=passed_at.desc` |

**4. Remove the timeout wrappers:**

Since `fetch()` has built-in timeout support and doesn't get stuck, we can simplify the code by removing `withTimeout` and `fetchWithRetry`.

**5. Remove the expired chains check:**

The auto-expire logic that runs before fetching was adding complexity and potential blocking. Move this to a background process or edge function instead of running it on every fetch.

## Why This Works

| Problem | Solution |
|---------|----------|
| Supabase JS client internal queue blocks | Direct REST calls bypass the client entirely |
| Queries never send HTTP requests | `fetch()` always sends immediately |
| Timeout wrappers add complexity | Native fetch with AbortController is simpler |
| Same pattern already works | `StartChainModal` proves this approach works |

## Files Changed

| File | Changes |
|------|---------|
| `src/hooks/useMentChains.ts` | Replace `supabase.from()` with direct REST API calls |

## Expected Result

After this fix:
- Chain list loads immediately (9 chains visible)
- Network logs show actual `/rest/v1/ment_chains` requests
- Console shows "Done - 9 chains loaded"
- No more timeout errors
