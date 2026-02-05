

# Fix Chain Creation Hanging on Session Refresh

## Problem Identified

Through browser debugging, I discovered that the chain creation is **not reaching the edge function call at all**. The code stops executing at line 162:

```javascript
const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
```

The console logs show:
- "Chain name: @info's Chain"  
- "Recipient: Test User"  

But the next expected log "Calling create-chain edge function..." **never appears**.

## Root Cause

The `refreshSession()` method was added in the previous fix attempt to get a "fresh token", but this method:
- Makes a network request to Supabase Auth
- Can hang indefinitely if there's a network issue
- Blocks the entire chain creation flow

The original `getSession()` method returns immediately from cache, while `refreshSession()` requires a network round-trip that can stall.

## Solution

Revert to using `getSession()` but add proper handling:
1. Use `getSession()` to get the cached session immediately
2. The Supabase client already handles token refresh automatically via `autoRefreshToken: true` in the client config
3. Add a simple check that the token exists, not that it's "fresh"

## Changes

### File: `src/components/chains/StartChainModal.tsx`

**Lines 160-166: Replace refreshSession with getSession**

Change from:
```typescript
// Force refresh the session to get a fresh token
const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
if (refreshError || !session?.access_token) {
  console.error('Session refresh failed:', refreshError);
  throw new Error('Session expired. Please log in again.');
}
```

To:
```typescript
// Get session (Supabase auto-refreshes tokens)
console.log('Getting session...');
const { data: { session } } = await supabase.auth.getSession();
console.log('Session retrieved:', session ? 'yes' : 'no');
if (!session?.access_token) {
  console.error('No active session');
  throw new Error('Please log in to start a chain.');
}
```

## Why This Will Work

| Issue | Fix |
|-------|-----|
| `refreshSession()` makes network request that hangs | `getSession()` returns immediately from cache |
| No timeout on session refresh | Removes the blocking call entirely |
| Token might be stale | Supabase client has `autoRefreshToken: true` which handles this automatically |

## Additional Logging

Adding `console.log('Getting session...')` before and after will help confirm the flow is working and identify if any other step is blocking.

