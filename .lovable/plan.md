

# Add RLS Policy for Current Chain Holders

## What's Already In Place

After reviewing the existing policies on `chain_links`, most of what you listed is already covered:

| Policy | Status |
|--------|--------|
| Chain starters can view all links | Already added (just now) |
| Participants can view chain links (passed_by/passed_to) | Already exists: "Users can view links they passed or received" |
| Users can insert links they passed | Already exists: "Users can insert links they passed" |
| **Current holders can view chain links** | **Missing - needs to be added** |

## What Needs to Be Done

Add one new RLS policy so that a user who is the `current_holder` of a chain can see all links in that chain, even if they haven't yet created their own link:

```sql
CREATE POLICY "Current holders can view chain links"
  ON public.chain_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ment_chains 
      WHERE ment_chains.chain_id = chain_links.chain_id 
      AND ment_chains.current_holder = auth.uid()::text
    )
  );
```

This is important because when a user receives a chain and opens "View Details," they need to see the full history before they've passed it forward.

## Testing After Migration

- Open the "test 10" chain details modal
- Confirm the skeleton loader disappears and chain links render
- Verify the initial compliment text appears in the timeline

