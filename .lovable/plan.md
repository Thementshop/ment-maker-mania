
# Fix: Stale User Data After Sign Out and Re-Login

## Problem
After signing out and signing back in as a different user, the homepage still shows the previous user's data (avatar "U", wrong game stats). 

## Root Cause
Two issues in the sign-out flow:

1. **`gameStateLoadedRef` is never reset on timeout path** -- When sign-out times out, the catch block clears localStorage but never calls `resetState()` or resets the ref. When the new user signs in, `loadUserGameState()` sees `gameStateLoadedRef.current === true` and skips loading the new user's data entirely.

2. **Hard redirect happens too soon** -- `window.location.href = '/auth'` fires immediately after sign-out (or timeout), before `onAuthStateChange` can run the cleanup logic (reset profile, reset game state, reset the ref). The page unloads mid-cleanup.

## Fix

### 1. AccountSettingsModal.tsx -- Proper cleanup before redirect
- In the `catch` block (timeout path), explicitly call `useGameStore.getState().resetState()` to clear stale game data
- Move the hard redirect into a small `setTimeout` to allow state cleanup to propagate

### 2. AuthContext.tsx -- Reset gameStateLoadedRef on user change
- In the `onAuthStateChange` handler, when a new user signs in, compare the user ID against the previously loaded one. If different, reset `gameStateLoadedRef` so game state is reloaded for the new user.
- This is a safety net so even if sign-out cleanup was incomplete, a fresh login always loads fresh data.

## Technical Details

**AccountSettingsModal.tsx** changes:
```typescript
const handleSignOut = async () => {
  setIsSigningOut(true);
  try {
    await Promise.race([
      signOut(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
  } catch {
    console.warn('Sign out timed out, clearing local session');
    localStorage.removeItem('sb-cjnukzmjenfvuopooumb-auth-token');
    useGameStore.getState().resetState();
  }
  onClose();
  // Small delay to let state cleanup propagate
  setTimeout(() => { window.location.href = '/auth'; }, 100);
};
```

**AuthContext.tsx** changes:
- Add a `loadedUserIdRef` to track which user's game state is loaded
- In `loadUserGameState`, check if userId changed (not just if already loaded)
- Reset both refs in the sign-out branch of `onAuthStateChange`

```typescript
const loadedUserIdRef = useRef<string | null>(null);

const loadUserGameState = async (userId: string) => {
  if (gameStateLoadedRef.current && loadedUserIdRef.current === userId) return;
  gameStateLoadedRef.current = true;
  loadedUserIdRef.current = userId;
  // ... load game state
};

// In onAuthStateChange, sign-out branch:
gameStateLoadedRef.current = false;
loadedUserIdRef.current = null;
```

This ensures switching users always triggers a fresh data load.
