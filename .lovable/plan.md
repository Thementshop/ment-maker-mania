

# Fix: Auto-Select First Tab With Data

## Problem

The dashboard defaults to the "Active" tab, but the only chain ("test 10") has `status: "broken"` and appears under "Ended." So the Active tab correctly shows "No chains in this category yet."

This is not a data or RLS issue -- the chain data IS loading (1 chain fetched). It's a UX issue where the default tab has no matching chains.

## Solution

Update `ChainDashboard` to intelligently pick the default tab based on which categories have data, using this priority order:

1. **Your Turn** (most urgent -- needs action)
2. **Active** (ongoing chains)
3. **Queued** (waiting chains)
4. **Ended** (historical)

If no tabs have data, default to "Active" as before.

## Technical Changes

### File: `src/components/chains/ChainDashboard.tsx`

Add a `useMemo` or `useEffect` after `chainData` is computed to determine the best initial tab:

```typescript
const defaultTab = useMemo(() => {
  const hasYourTurn = chainData.some(c => c.current_holder === currentUserId && c.status === 'active' && !c.is_queued);
  const hasActive = chainData.some(c => c.status === 'active' && !c.is_queued);
  const hasQueued = chainData.some(c => c.is_queued);
  const hasEnded = chainData.some(c => c.status === 'broken');

  if (hasYourTurn) return 'yourTurn';
  if (hasActive) return 'active';
  if (hasQueued) return 'queued';
  if (hasEnded) return 'ended';
  return 'active';
}, [chainData, currentUserId]);
```

Then use a `useEffect` to set the active tab when data first loads:

```typescript
const [hasAutoSelected, setHasAutoSelected] = useState(false);

useEffect(() => {
  if (chainData.length > 0 && !hasAutoSelected) {
    setActiveTab(defaultTab);
    setHasAutoSelected(true);
  }
}, [chainData, defaultTab, hasAutoSelected]);
```

This ensures:
- On first load, the tab with data is shown automatically
- After the user manually switches tabs, their choice is respected
- If all tabs are empty, "Active" remains the default

## Files to Modify

1. `src/components/chains/ChainDashboard.tsx` -- add smart default tab selection

