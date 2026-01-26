
## Fix: Persistent Spinning Mint Loading State

### Root Cause Analysis

After tracing through the code, I found **multiple issues** causing the infinite loading:

1. **Double `loadGameState` calls**: Both `onAuthStateChange` and `getSession` call `loadGameState`, which can overlap and cause race conditions
2. **Auth loading blocks everything**: `ProtectedRoute` shows spinner while `AuthContext.isLoading` is `true`, and `setIsLoading(false)` only runs after all async operations complete
3. **No timeout on AuthContext loading**: While gameStore has a 10s timeout, the AuthContext has no such protection

---

### The Solution

Fix the AuthContext to have a more robust loading flow:

| Change | Description |
|--------|-------------|
| Add timeout to AuthContext | Prevent infinite loading if Supabase auth check hangs |
| Decouple auth loading from game loading | Auth should complete and show the page; game data loads in background |
| Remove duplicate loadGameState calls | Only call once per session, not from both listeners |
| Add loading guard | Prevent multiple simultaneous loadGameState calls |

---

### Files to Modify

**1. `src/contexts/AuthContext.tsx`**
- Add a timeout for the initial auth check
- Set `isLoading: false` earlier (before game data loads)
- Add a flag to prevent duplicate game state loads

```tsx
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gameStateLoaded, setGameStateLoaded] = useState(false);  // NEW

  // ... existing fetchProfile ...

  useEffect(() => {
    let isSubscribed = true;  // Track component mount
    
    // Timeout to prevent infinite loading
    const authTimeout = setTimeout(() => {
      if (isSubscribed && isLoading) {
        console.warn('Auth check timed out, proceeding without auth');
        setIsLoading(false);
      }
    }, 5000);  // 5 second timeout

    const loadUserGameState = async (userId: string) => {
      // Only load once
      if (gameStateLoaded) return;
      setGameStateLoaded(true);
      
      try {
        await useGameStore.getState().loadGameState(userId);
        useGameStore.getState().subscribeToWorldCounter();
      } catch (error) {
        console.error('Failed to load game state:', error);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isSubscribed) return;
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // Set auth as complete FIRST - don't wait for game data
        setIsLoading(false);
        clearTimeout(authTimeout);
        
        if (newSession?.user) {
          const userProfile = await fetchProfile(newSession.user.id);
          setProfile(userProfile);
          // Load game state in background (don't block auth)
          loadUserGameState(newSession.user.id);
        } else {
          setProfile(null);
          setGameStateLoaded(false);
          useGameStore.getState().resetState();
          useGameStore.getState().unsubscribeFromWorldCounter();
        }
      }
    );

    // Initial session check - but don't duplicate the game state load
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!isSubscribed) return;
      
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setIsLoading(false);  // Auth check complete
      clearTimeout(authTimeout);
      
      if (existingSession?.user) {
        const userProfile = await fetchProfile(existingSession.user.id);
        if (isSubscribed) setProfile(userProfile);
        loadUserGameState(existingSession.user.id);
      }
    });

    return () => {
      isSubscribed = false;
      clearTimeout(authTimeout);
      subscription.unsubscribe();
      useGameStore.getState().unsubscribeFromWorldCounter();
    };
  }, []);
  
  // ... rest of component unchanged ...
};
```

**2. `src/pages/Index.tsx`**
- Remove the loading check that shows spinner
- Show the page immediately with default values
- Data updates reactively when loaded

```tsx
// Remove lines 49-60 (the isLoading check)
// The page will render with default values and update when data loads
```

---

### Why This Works

```text
Current (broken):
┌────────────────────────────┐
│ AuthProvider mounts        │
│ isLoading = true           │
│ ProtectedRoute: spinner    │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ getSession + onAuthChange  │
│ both call loadGameState    │ ← Race condition, can hang
│ wait for all to complete   │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Index renders              │
│ gameStore.isLoading check  │ ← Another spinner!
└────────────────────────────┘

After fix:
┌────────────────────────────┐
│ AuthProvider mounts        │
│ isLoading = true           │
│ 5s timeout safety net      │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ getSession completes       │
│ setIsLoading(false)        │ ← Auth done IMMEDIATELY
│ game state loads in bg     │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│ Index renders IMMEDIATELY  │
│ Shows default values       │
│ Updates when data loads    │ ← Smooth experience
└────────────────────────────┘
```

---

### Summary

| Issue | Fix |
|-------|-----|
| Double loadGameState calls | Add `gameStateLoaded` flag to prevent duplicate calls |
| Auth loading blocks page | Set `isLoading: false` immediately after session check, before game data loads |
| No auth timeout | Add 5-second timeout that forces `isLoading: false` |
| Index.tsx spinner | Remove the gameStore.isLoading check - show content immediately |
