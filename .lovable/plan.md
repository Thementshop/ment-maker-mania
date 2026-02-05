
# Add Automatic Retry Logic for Chain Creation

## Problem
Chain creation times out after 15 seconds, even though the database is responsive. The logs show requests are sent but responses aren't received in time. Adding automatic retry logic will give the operation a second chance before showing an error.

## Solution
Wrap the critical database operations (Steps 4 and 6) in a retry helper that automatically attempts the operation again if the first try times out.

## Changes

### File: `src/components/chains/StartChainModal.tsx`

**1. Add a retry helper function (near the top of the component)**

```typescript
const retryWithTimeout = async <T,>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string,
  maxRetries: number = 1
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${operationName}: Attempt ${attempt + 1}/${maxRetries + 1} starting...`);
      const result = await criticalQueryWithTimeout(operation(), timeoutMs, operationName);
      console.log(`${operationName}: Attempt ${attempt + 1} succeeded`);
      return result;
    } catch (error: any) {
      lastError = error;
      console.warn(`${operationName}: Attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries && error.message?.includes('timed out')) {
        console.log(`${operationName}: Retrying in 1 second...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  throw lastError;
};
```

**2. Update Step 4 (chain creation) to use retry logic**

Replace the current `criticalQueryWithTimeout` call:
```typescript
// Before
const { data: newChain, error: chainError } = await criticalQueryWithTimeout(
  supabase.from('ment_chains').insert(chainPayload).select().single(),
  15000,
  'Chain creation'
);

// After
const { data: newChain, error: chainError } = await retryWithTimeout(
  () => supabase.from('ment_chains').insert(chainPayload).select().single(),
  15000,
  'Chain creation',
  1  // 1 retry = 2 total attempts
);
```

**3. Update Step 6 (link creation) to use retry logic**

Replace the current `criticalQueryWithTimeout` call:
```typescript
// Before
const { error: linkError } = await criticalQueryWithTimeout(
  supabase.from('chain_links').insert({...}),
  15000,
  'Link creation'
);

// After  
const { error: linkError } = await retryWithTimeout(
  () => supabase.from('chain_links').insert({
    chain_id: newChain.chain_id,
    passed_by: user.id,
    passed_to: recipientValue.trim(),
    received_compliment: '',
    sent_compliment: compliment,
    was_forwarded: false
  }),
  15000,
  'Link creation',
  1  // 1 retry = 2 total attempts
);
```

**4. Update the global timeout to accommodate retries**

Change from 25 seconds to 45 seconds to allow for 2 attempts at each critical step:
```typescript
// Before
const timeoutId = setTimeout(() => {...}, 25000);

// After
const timeoutId = setTimeout(() => {...}, 45000);
```

## Expected Console Output with Retry

```
Step 4: Creating chain...
Chain creation: Attempt 1/2 starting...
Chain creation: Attempt 1 failed: Chain creation timed out
Chain creation: Retrying in 1 second...
Chain creation: Attempt 2/2 starting...
Chain creation: Attempt 2 succeeded
Step 4 complete, chain created: abc123...
```

## Technical Details

| Setting | Value |
|---------|-------|
| Per-attempt timeout | 15 seconds |
| Retry delay | 1 second |
| Max retries | 1 (2 total attempts) |
| Global timeout | 45 seconds |
| Steps with retry | Step 4 (chain insert), Step 6 (link insert) |

## Why This Helps
- If the first request is slow due to a cold start or network hiccup, the second attempt often succeeds
- Users only see an error after both attempts fail
- Logging shows exactly which attempt succeeded or failed
