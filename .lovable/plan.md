

# Add Authentication Debugging to Chain Creation

## Problem
The chain creation times out at Step 4, and we need to verify if it's an authentication issue. Currently there's a basic `if (!user)` check, but we need more detailed logging to see exactly what's being sent to the database.

## Changes

### File: `src/components/chains/StartChainModal.tsx`

**1. Enhanced auth check with detailed logging (before Step 1)**

Add comprehensive auth debugging right after `setStep('sending')`:

```typescript
setStep('sending');

// === AUTH DEBUG START ===
console.log('=== AUTH DEBUG ===');
console.log('user object:', user);
console.log('user.id:', user?.id);
console.log('profile:', profile);
console.log('Auth status:', user ? 'AUTHENTICATED' : 'NOT AUTHENTICATED');

if (!user?.id) {
  toast({
    title: "Not authenticated",
    description: "Your session may have expired. Please refresh and try again.",
    variant: "destructive"
  });
  setStep('name');
  return;
}
// === AUTH DEBUG END ===
```

**2. Log the exact payload before Step 4 insert**

Add logging right before the `ment_chains` insert:

```typescript
// 4. Create chain (with 15s timeout)
console.log('Step 4: Creating chain...');
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

// Log exact values being sent
const chainPayload = {
  chain_name: finalName,
  started_by: user.id,
  current_holder: recipientValue.trim(),
  expires_at: expiresAt.toISOString(),
  status: 'active',
  share_count: 1,
  tier: 'small',
  links_count: 1
};
console.log('Step 4: Payload being sent:', chainPayload);
console.log('Step 4: user.id type:', typeof user.id);
console.log('Step 4: user.id value:', user.id);
```

**3. Add timestamp logging for timeout debugging**

```typescript
console.log('Step 4: Request starting at:', new Date().toISOString());
const { data: newChain, error: chainError } = await criticalQueryWithTimeout(...);
console.log('Step 4: Response received at:', new Date().toISOString());
```

## What This Will Show

After these changes, the console will display:
- Whether `user` object exists
- The exact `user.id` value (should be a UUID)
- The complete payload being sent to the database
- Timestamps showing when the request starts and when (if) it completes

## Expected Console Output

```
=== AUTH DEBUG ===
user object: {id: "abc123...", email: "test@example.com", ...}
user.id: abc123-def456-...
profile: {display_name: "Test User", ...}
Auth status: AUTHENTICATED
Step 1: Checking daily limit...
...
Step 4: Creating chain...
Step 4: Payload being sent: {chain_name: "...", started_by: "abc123...", ...}
Step 4: user.id type: string
Step 4: user.id value: abc123-def456-...
Step 4: Request starting at: 2026-02-05T18:30:00.000Z
```

If `user.id` is `undefined` or the auth status shows `NOT AUTHENTICATED`, that's the problem and the user will see a clear error message instead of a timeout.

