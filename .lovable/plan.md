

## Fix: Infinite Loading State - Root Cause Found

### The Problem

The homepage is stuck showing the spinning mint because of two separate loading states that aren't properly coordinated:

| Component | Loading State Source | Initial Value |
|-----------|---------------------|---------------|
| `ProtectedRoute` | `AuthContext.isLoading` | `true` |
| `Index.tsx` | `gameStore.isLoading` | `true` |

When an authenticated user visits `/`:
1. `ProtectedRoute` shows spinner while `AuthContext.isLoading` is `true`
2. Auth completes, `AuthContext.isLoading` becomes `false`
3. User passes through to `Index.tsx`
4. `Index.tsx` shows spinner while `gameStore.isLoading` is `true`
5. The gameStore starts with `isLoading: true` **before** `loadGameState` is even called
6. If anything prevents `loadGameState` from running or completing, the spinner stays forever

### The Fix

Change the gameStore's initial state to have `isLoading: false` instead of `true`. The loading spinner should only show **after** `loadGameState` explicitly sets it to `true`.

---

### Files to Modify

| File | Change |
|------|--------|
| `src/store/gameStore.ts` | Change `initialState.isLoading` from `true` to `false` |

---

### Code Change

```typescript
// In src/store/gameStore.ts, line 75-83

const initialState = {
  jarCount: 25,
  totalSent: 0,
  currentLevel: 1,
  pendingMents: [],
  worldKindnessCount: 0,
  isLoading: false,  // Changed from true to false
  userId: null,
};
```

---

### Why This Works

```text
Before (broken):
┌─────────────────────┐
│ Store initializes   │
│ isLoading = true    │ ← Already loading before anything happens
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Index.tsx renders   │
│ Shows spinner...    │ ← Stuck if loadGameState never called
└─────────────────────┘

After (fixed):
┌─────────────────────┐
│ Store initializes   │
│ isLoading = false   │ ← Ready state
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Index.tsx renders   │
│ Shows content OR    │ ← Shows default content
│ loadGameState runs  │
│ sets isLoading=true │ ← Then shows spinner briefly
│ completes           │
│ sets isLoading=false│ ← Then shows real content
└─────────────────────┘
```

---

### Technical Details

The timeout and finally block we added in the previous fix are still valuable for handling slow/failed database connections. This change ensures:

1. The initial render shows content (with default values) instead of a spinner
2. When `loadGameState` is called, it will briefly show the spinner
3. The timeout ensures it never hangs more than 10 seconds
4. The finally block guarantees `isLoading: false` after completion

This is a **one-line fix** that resolves the infinite loading issue.

