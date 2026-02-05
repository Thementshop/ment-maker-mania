

# Fix Chain Creation - Use AuthContext Session

## Problem Identified

Through browser debugging, I discovered that **`supabase.auth.getSession()` is hanging indefinitely**. The console shows:
- `"Getting session..."` is logged
- `"Session retrieved:"` **never appears**
- No network request is made to the edge function

This is a known issue with the Supabase JS client where `getSession()` can hang when the client is in certain states (e.g., during token refresh).

## Root Cause

The `StartChainModal` component already uses `useAuth()` which provides access to the session via AuthContext, but the code is making a **redundant call** to `supabase.auth.getSession()` instead of using the session that's already available.

**Current code (line 38):**
```typescript
const { user, profile } = useAuth();  // ← session is NOT destructured!
```

**Current code (lines 162-163):**
```typescript
console.log('Getting session...');
const { data: { session } } = await supabase.auth.getSession();  // ← HANGS!
```

## Solution

Use the session from AuthContext directly instead of calling `getSession()`:

1. Add `session` to the destructured values from `useAuth()`
2. Remove the `getSession()` call entirely
3. Use the cached session for the Authorization header

## Changes

### File: `src/components/chains/StartChainModal.tsx`

**Line 38: Destructure session from useAuth**
```typescript
// Before
const { user, profile } = useAuth();

// After  
const { user, profile, session } = useAuth();
```

**Lines 160-168: Remove getSession call and use cached session**
```typescript
// Before
try {
  // Get session (Supabase auto-refreshes tokens via autoRefreshToken: true)
  console.log('Getting session...');
  const { data: { session } } = await supabase.auth.getSession();
  console.log('Session retrieved:', session ? 'yes' : 'no');
  if (!session?.access_token) {
    console.error('No active session');
    throw new Error('Please log in to start a chain.');
  }

// After
try {
  // Use session from AuthContext (already managed and auto-refreshed)
  console.log('Using cached session from AuthContext');
  if (!session?.access_token) {
    console.error('No active session');
    throw new Error('Please log in to start a chain.');
  }
  console.log('Session available:', !!session.access_token);
```

## Why This Will Work

| Issue | Fix |
|-------|-----|
| `getSession()` hangs indefinitely | No longer called - uses cached session |
| Token might be stale | AuthContext has `onAuthStateChange` listener that auto-updates session |
| Network request blocking | No network request needed - session is already in memory |

## Technical Details

The AuthContext already:
1. Calls `getSession()` once on app load (line 112)
2. Listens to `onAuthStateChange` for all auth events (line 86)
3. Updates the session state automatically when tokens are refreshed
4. Provides the session via React context

By using this cached session, we bypass the hanging `getSession()` call entirely while still getting a valid, auto-refreshed token.

