

# Simplify Chain Creation for Testing

## Current Problem

When starting a chain, the console shows "Step 1: Checking daily limit..." but never progresses. The Supabase query to `user_game_state` appears to hang indefinitely. This blocks the entire chain creation flow.

## Solution Overview

Make four key changes to enable testing without network-dependent operations blocking the flow:

---

## Changes

### 1. Lenient Recipient Validation

**Current**: Strict Zod validation requiring proper email format (`z.string().email()`)

**Change**: Accept any text as a valid recipient for testing

| Recipient Type | Current | New |
|----------------|---------|-----|
| Email | Must be valid email format | Any text containing `@` |
| Phone | Minimum 10 characters | Any text with at least 3 characters |
| Contact | Minimum 1 character | Any text with at least 1 character |

### 2. Add Query Timeouts with Fallbacks

Each database query will have a 5-second timeout using `Promise.race()`. If a query times out, we'll use sensible defaults instead of blocking:

| Query | Timeout Fallback |
|-------|------------------|
| Check daily limit (`user_game_state`) | Assume 0 chains started today |
| Check name availability (`used_chain_names`) | Assume name is available |

### 3. Skip Non-Critical Operations

Make these operations truly optional (fire-and-forget):
- **Claim chain name**: Already non-blocking, but wrap in try-catch to prevent any issues
- **Update user stats**: Make non-blocking - chain is created successfully even if stats update fails

### 4. Better Success/Error Feedback

- Add more detailed console logging for debugging
- Show clear success toast message when chain is created
- If errors occur, show specific error messages in toast

---

## Technical Implementation

### File: `src/components/chains/StartChainModal.tsx`

**A. Relax validation (lines 93-110)**:
```typescript
const validateRecipient = (): boolean => {
  // For testing: accept any non-empty input
  if (recipientType === 'email') {
    // Just check it has @ sign
    if (!recipientValue.includes('@')) {
      setRecipientError('Enter an email address (e.g., test@example.com)');
      return false;
    }
  } else if (recipientType === 'phone') {
    if (recipientValue.length < 3) {
      setRecipientError('Enter a phone number');
      return false;
    }
  } else {
    if (recipientValue.length < 1) {
      setRecipientError('Enter a name');
      return false;
    }
  }
  setRecipientError('');
  return true;
};
```

**B. Add query timeout helper**:
```typescript
const queryWithTimeout = async <T>(
  promise: PromiseLike<{ data: T; error: any }>,
  timeoutMs: number,
  fallbackData: T
): Promise<{ data: T; error: any }> => {
  const timeoutPromise = new Promise<{ data: T; error: any }>((resolve) => 
    setTimeout(() => {
      console.warn(`Query timed out after ${timeoutMs}ms, using fallback`);
      resolve({ data: fallbackData, error: null });
    }, timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
};
```

**C. Apply timeouts to all queries in `handleSend()`**:
- Step 1 (daily limit check): 5-second timeout, fallback to `{ chains_started_today: 0, last_chain_start_date: null }`
- Step 3 (create chain): No timeout change - this is critical
- Step 5 (create link): No timeout change - this is critical
- Step 6 (update stats): Make non-blocking with fire-and-forget

**D. Clear success message**:
```typescript
toast({
  title: "Chain Started! 🔥",
  description: `Your chain "${finalName}" has been created!`,
});
```

---

## Expected Behavior After Changes

1. Enter any text with `@` for email → validation passes
2. If daily limit check hangs → proceeds with default (allows creation)
3. If name check hangs → proceeds with name (assumes available)
4. Chain and first link are created (these are critical, keep error handling)
5. Stats update is fire-and-forget (won't block success)
6. Clear success message with confetti
7. Chain appears in dashboard

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/chains/StartChainModal.tsx` | Relax validation, add query timeouts, fire-and-forget for non-critical ops |

---

## Testing After Implementation

1. Open Start Chain modal
2. Enter any name (or skip)
3. Enter `test@example.com` as recipient
4. Select a category and compliment
5. Watch for console logs showing which steps complete
6. Success screen should appear with confetti
7. Check the Ment Chains dashboard - new chain should appear

