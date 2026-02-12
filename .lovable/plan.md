

# Fix: Chain Details Modal Shows Blank "Chain Flow" Section

## Problem Identified

When clicking "View Details" on a chain card, the "Chain Flow" section shows blank because the `ChainDetailsModal` component uses the standard Supabase JS client to fetch chain links, which is subject to a known deadlock issue where requests hang without being sent.

**Evidence:**
- Network requests show no `chain_links` fetch was made when the modal opens
- The `useMentChains` hook already solved this problem using a `supabaseRest` helper that makes direct HTTP fetch calls
- Data exists in the database (1 link for this chain)

## Root Cause

The `ChainDetailsModal.tsx` fetches data using:
```typescript
const { data, error } = await supabase
  .from('chain_links')
  .select('*')
  .eq('chain_id', chain.chain_id)
  .order('passed_at', { ascending: true });
```

This hangs due to the Supabase JS client internal request queue issue.

## Solution

Refactor `ChainDetailsModal` to use the same REST API approach that works in `useMentChains`, with two options:

**Option A (Recommended):** Use the `getChainLinks` function from `useMentChains` hook
- Cleanest approach - reuses existing working code
- Requires passing the function as a prop or using the hook

**Option B:** Add the `supabaseRest` helper directly to ChainDetailsModal
- More self-contained but duplicates code

I'll implement **Option A** since it avoids code duplication.

---

## Implementation Steps

### Step 1: Update ChainCardNew to pass getChainLinks

Modify `ChainCardNew.tsx` to accept an optional `getChainLinks` prop and pass it to `ChainDetailsModal`.

### Step 2: Update ChainDetailsModal to accept and use getChainLinks

- Add `getChainLinks` as an optional prop to `ChainDetailsModalProps`
- If provided, use it instead of the direct Supabase client call
- Keep a fallback inline REST call for when used standalone (e.g., from ChainPage)

### Step 3: Update ChainDashboard to pass the function through

Ensure `ChainDashboard` passes `getChainLinks` from `useMentChains` down through the component tree.

---

## Technical Details

### ChainDetailsModal Changes

```typescript
interface ChainDetailsModalProps {
  chain: { /* existing fields */ };
  isOpen: boolean;
  onClose: () => void;
  getChainLinks?: (chainId: string) => Promise<ChainLink[]>; // NEW
}
```

**Fallback REST implementation** (for standalone usage):
```typescript
async function fetchViaRest(chainId: string, accessToken: string) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chain_links?select=*&chain_id=eq.${chainId}&order=passed_at.asc`,
    {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    }
  );
  return response.json();
}
```

### ChainCardNew Changes

Add prop to interface and pass through:
```typescript
interface ChainCardNewProps {
  // ... existing props
  getChainLinks?: (chainId: string) => Promise<ChainLink[]>;
}

// In the component
<ChainDetailsModal
  chain={...}
  isOpen={showDetailsModal}
  onClose={() => setShowDetailsModal(false)}
  getChainLinks={getChainLinks}
/>
```

### ChainDashboard Changes

Pass `getChainLinks` from hook to each `ChainCardNew`:
```typescript
const { chains, getChainLinks, ... } = useMentChains();

// In render
<ChainCardNew
  chain={chain}
  getChainLinks={getChainLinks}
  // ... other props
/>
```

---

## Additional Fix: RLS Policy Enhancement

Currently, chain starters can only see links where they were `passed_by`. Once the chain grows beyond the first pass, they won't see subsequent links. 

**New RLS policy needed:**
```sql
CREATE POLICY "Chain starters can view all links in their chains"
  ON public.chain_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ment_chains 
      WHERE ment_chains.chain_id = chain_links.chain_id 
      AND ment_chains.started_by = auth.uid()
    )
  );
```

This ensures the chain starter can always view the complete chain flow.

---

## Files to Modify

1. `src/components/chains/ChainDetailsModal.tsx` - Add REST fallback, accept getChainLinks prop
2. `src/components/chains/ChainCardNew.tsx` - Accept and pass through getChainLinks prop  
3. `src/components/chains/ChainDashboard.tsx` - Pass getChainLinks from hook to ChainCardNew
4. Database migration - Add RLS policy for chain starters to view all chain links

