

## Plan: Fix Jar Count Not Loading (Showing Default 25 Instead of 76)

### Problem
Your database has `jar_count = 76`, but the UI shows 25 (the Zustand default). The `loadGameState` function has a guard (`gameStateLoadedRef`) that prevents re-fetching. If the initial load races or silently fails, the jar stays at the default value with no retry mechanism.

### Root Cause
In `AuthContext.tsx`, both `onAuthStateChange` and `getSession` call `loadUserGameState`. The ref guard at line 97 prevents the second call. However, there's a subtle issue: `loadGameState` in the Zustand store catches errors but may not properly set the state if the Supabase query returns data but the component has already rendered with the default.

Additionally, the `[MINT DEBUG]` log from `loadGameState` isn't appearing in console, suggesting it either ran before the console capture window or didn't run at all.

### Fix

**`src/contexts/AuthContext.tsx`** — Make `loadUserGameState` more resilient:
- After `loadGameState` completes, verify the Zustand state actually updated by reading it back
- If jar_count is still 25 and it was supposed to load, retry once
- Add a console log to confirm the load completed with values

**`src/store/gameStore.ts`** — Add a defensive re-check:
- After the `loadGameState` try/catch, log the final state values so we can confirm data was received
- Ensure the `set()` call inside `loadGameState` runs even if one sub-query (pending_ments, world_counter) fails — currently they're all in one async block but each has independent error handling, which looks correct

### Minimal Fix (Preferred)
The simplest fix: remove the `gameStateLoadedRef` guard and instead use a `lastLoadedAt` timestamp to debounce (e.g., don't reload within 2 seconds). This ensures a page refresh or re-render always gets fresh data:

**`src/contexts/AuthContext.tsx`**:
- Replace `gameStateLoadedRef.current && loadedUserIdRef.current === userId` check with a time-based debounce
- This ensures if the first load silently failed, the second attempt from `getSession` still runs

### Files Changed
- `src/contexts/AuthContext.tsx` — fix load guard to allow retry on failure
- `src/store/gameStore.ts` — add post-load verification logging

