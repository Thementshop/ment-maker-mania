
# Enable Real-time Sync for Chain Links

## Summary

Currently, only the `ment_chains` table has real-time updates enabled. The `chain_links` table (which stores the history of who passed the chain to whom) does not sync live across browser tabs. This means if you're viewing a chain's history in one tab and someone passes it in another, you won't see the update until you close and reopen the modal.

---

## Changes Required

### 1. Database Migration
Add the `chain_links` table to the Supabase realtime publication:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.chain_links;
```

### 2. Update ChainDetailsModal Component
Add a real-time subscription so the chain history updates live:

| Current Behavior | New Behavior |
|------------------|--------------|
| Fetches links once when modal opens | Fetches once, then subscribes to live updates |
| Modal shows stale data | Modal auto-refreshes when new links are added |

**Code changes in `src/components/chains/ChainDetailsModal.tsx`:**
- Add a Supabase channel subscription for `chain_links` filtered by `chain_id`
- Refetch links when an INSERT event is detected
- Clean up subscription when modal closes

### 3. (Optional) Update useMentChains Hook
The main hook already listens to `ment_chains` changes. We can extend it to also listen for `chain_links` changes to refresh compliment data.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/` (new file) | Enable realtime for `chain_links` table |
| `src/components/chains/ChainDetailsModal.tsx` | Add real-time subscription for live history updates |

---

## Expected Result

After these changes:
1. Open the chain details modal in Tab A
2. In Tab B, pass the chain to someone else
3. Tab A automatically shows the new link in the Chain Flow timeline without refreshing

---

## Technical Details

The subscription will use Supabase's `postgres_changes` listener:

```typescript
const channel = supabase
  .channel(`chain_links_${chain.chain_id}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'chain_links',
      filter: `chain_id=eq.${chain.chain_id}`,
    },
    (payload) => {
      console.log('New link added:', payload);
      fetchChainLinks(); // Refresh the list
    }
  )
  .subscribe();
```

The cleanup function will unsubscribe when the modal closes to prevent memory leaks.
