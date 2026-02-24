

# Fix: Stale Profile Across Account Switches

## What's Actually Happening

The email is **not truncated** -- the database has the full `bdhp1971@gmail.com` stored correctly for all 3 chains. What you saw as "bdhp1971" was likely the avatar's fallback text (it takes the part before the `@` sign to show initials).

The real remaining bug: when you sign out as one user and sign back in as another, the **old user's profile sticks around** because the code only sets a fallback profile "if one isn't already set" -- but one IS already set from the previous user.

## Root Cause

In `AuthContext.tsx`, line 125:
```
setProfile(prev => prev ?? { ... })
```

The `??` operator means "only use the fallback if prev is null." But after switching accounts, `prev` still holds the old user's profile (it wasn't cleared fast enough), so the new user's fallback is skipped entirely. The old initials ("U" from a previous session) persist.

## Fix (1 file change)

**src/contexts/AuthContext.tsx** -- In the `onAuthStateChange` handler, when a new session arrives:

1. **Always set** the fallback profile for the current user (remove the `?? ` guard)
2. Compare the new user ID against the previous one -- if different, also reset `gameStateLoadedRef` and `loadedUserIdRef` so game state reloads

Change from:
```typescript
setProfile(prev => prev ?? {
  id: newSession.user.id,
  display_name: meta?.full_name || newSession.user.email?.split('@')[0] || null,
  avatar_url: meta?.avatar_url || null,
});
```

Change to:
```typescript
setProfile({
  id: newSession.user.id,
  display_name: meta?.full_name || newSession.user.email?.split('@')[0] || null,
  avatar_url: meta?.avatar_url || null,
});
```

Apply the same fix in the `getSession()` initial check block (around line 159).

Also add a user-change detection at the top of the auth state handler:
```typescript
if (newSession?.user && loadedUserIdRef.current && loadedUserIdRef.current !== newSession.user.id) {
  // Different user signing in -- reset stale state
  gameStateLoadedRef.current = false;
  loadedUserIdRef.current = null;
}
```

This ensures switching accounts always shows the correct identity immediately.

