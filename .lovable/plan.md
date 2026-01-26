

## Fix: Infinite Loading State on Homepage

### Root Cause
When an authenticated user visits the homepage, the `Index.tsx` component checks `isLoading` from `useGameStore()` and shows a spinning mint while loading. The `loadGameState()` function in the game store is either:
1. Taking too long to complete
2. Silently failing without setting `isLoading: false`
3. Getting stuck on one of the database queries

### Solution
Add defensive timeout handling and ensure `isLoading` always gets set to `false`, even if the database queries fail or hang.

---

### Changes to Make

**1. `src/store/gameStore.ts`**
- Add a timeout wrapper around the database queries
- Ensure `isLoading: false` is always set, even on timeout
- Add better error handling and logging

```tsx
loadGameState: async (userId: string) => {
  set({ isLoading: true, userId });
  
  // Add timeout to prevent infinite loading
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Load timeout')), 10000)
  );
  
  try {
    await Promise.race([
      (async () => {
        // existing database queries...
      })(),
      timeout
    ]);
  } catch (error) {
    console.error('Error loading game state:', error);
  } finally {
    // ALWAYS set isLoading to false
    set(state => ({ ...state, isLoading: false }));
  }
}
```

**2. `src/store/gameStore.ts` - Fix `resetState()`**
- Change `resetState` to NOT reset `isLoading` to `true`
- This prevents the case where logging out and logging back in causes infinite loading

```tsx
resetState: () => {
  set({
    ...initialState,
    isLoading: false, // Override to prevent infinite loading
  });
}
```

---

### Technical Details

| File | Changes |
|------|---------|
| `src/store/gameStore.ts` | Add timeout wrapper, fix `resetState()`, add `finally` block |

### How This Fixes the Issue

1. **Timeout Protection**: If database queries hang, the timeout will fire after 10 seconds and force `isLoading: false`
2. **Finally Block**: Guarantees `isLoading` is set to `false` regardless of success/failure
3. **Reset State Fix**: Prevents `isLoading: true` from persisting after logout/login cycles

### No Changes Needed To

- `src/pages/Index.tsx` - Loading logic is fine
- `src/contexts/AuthContext.tsx` - Auth flow is correct
- Database schema or RLS policies - They're working correctly

