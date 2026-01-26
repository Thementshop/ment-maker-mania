

## Add "Top Chains Today" Leaderboard

### Overview
Add a leaderboard component that displays the top-performing Ment Chains created or active today, ranked by their `links_count`. This adds a competitive, community-driven element to the Ment Chains feature.

### Current State
- The homepage Ment Chains section (`src/components/home/MentChainsSection.tsx`) displays a "Coming Soon" placeholder
- The detailed chains view exists at `src/components/chains/MentChainsSection.tsx` with tabs for Active, Your Turn, Queued, and Ended chains
- No global leaderboard or ranking system exists
- The `ment_chains` table has `links_count` and `created_at` columns needed for ranking

### Design Decisions

**Where to display the leaderboard:**
- Add it to the homepage's Ment Chains section, replacing or alongside the "Coming Soon" content
- Show top 5 chains to keep it compact and engaging

**What counts as "Today":**
- Chains created within the last 24 hours OR chains that are still active
- Ranked by `links_count` (number of times the chain was passed)

**Privacy considerations:**
- RLS currently only allows users to see chains they started or are the current holder of
- For a public leaderboard, we need to create a new RLS policy allowing read-only access to basic chain stats (chain_id, links_count, created_at, status) without exposing user IDs
- Or use aggregate data only (no specific chain details)

---

## Implementation Steps

### Step 1: Database - Add RLS Policy for Leaderboard
Create a new SELECT policy on `ment_chains` that allows all authenticated users to view basic leaderboard data:

```sql
-- Allow authenticated users to view active chains for leaderboard
CREATE POLICY "Users can view active chains for leaderboard"
ON public.ment_chains
FOR SELECT
TO authenticated
USING (status = 'active');
```

### Step 2: Create Hook for Top Chains
Create `src/hooks/useTopChains.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TopChain {
  chain_id: string;
  links_count: number;
  created_at: string;
  status: string;
}

export const useTopChains = (limit: number = 5) => {
  const [topChains, setTopChains] = useState<TopChain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTopChains = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get chains from the last 24 hours, ordered by links_count
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      
      const { data, error: fetchError } = await supabase
        .from('ment_chains')
        .select('chain_id, links_count, created_at, status')
        .eq('status', 'active')
        .gte('created_at', yesterday.toISOString())
        .order('links_count', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      setTopChains(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch top chains'));
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchTopChains();
  }, [fetchTopChains]);

  return { topChains, isLoading, error, refetch: fetchTopChains };
};
```

### Step 3: Create TopChainsLeaderboard Component
Create `src/components/chains/TopChainsLeaderboard.tsx`:

- Display a ranked list of top 5 chains
- Show rank medal (gold/silver/bronze for top 3)
- Display chain ID (formatted as #XXXX) and links count
- Show "No chains yet today" empty state
- Match the app's visual style with animations

```text
+------------------------------------------+
|  Top Chains Today            🏆          |
+------------------------------------------+
|  🥇  #4521  ─────────────  12 links     |
|  🥈  #0892  ─────────────   8 links     |
|  🥉  #3347  ─────────────   5 links     |
|   4  #1205  ─────────────   3 links     |
|   5  #7788  ─────────────   2 links     |
+------------------------------------------+
```

### Step 4: Update Home MentChainsSection
Modify `src/components/home/MentChainsSection.tsx` to include the leaderboard:

- Replace or augment the "Coming Soon" content
- Add the TopChainsLeaderboard component
- Keep the existing tagline and branding

---

## Technical Details

**Files to create:**
- `src/hooks/useTopChains.ts` - Hook for fetching top chains
- `src/components/chains/TopChainsLeaderboard.tsx` - Leaderboard UI component

**Files to modify:**
- `src/components/home/MentChainsSection.tsx` - Integrate leaderboard

**Database changes:**
- Add RLS policy to allow authenticated users to view active chains for leaderboard

**Dependencies:** None new - uses existing Supabase client and UI components

**Privacy note:** The leaderboard will show chain IDs and link counts but not reveal which specific users are involved in each chain.

