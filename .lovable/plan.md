
# Investigate and Fix Database Request Hanging Issue

## Problem Summary
Chain creation times out after 30+ seconds (15s × 2 attempts), even though:
- The database is healthy and responds instantly to server-side queries
- Authentication is working (token refresh succeeds)
- RLS policies are correctly configured
- The retry logic is working as designed

The key insight is that **network logs show no `ment_chains` POST requests** - only auth token refreshes. This means the requests are either hanging in pending state or being aborted before completion.

## Root Cause Analysis

The issue is likely one of these:

1. **Request never completing** - The Supabase SDK might be waiting for something that never comes back
2. **AbortController conflict** - If there's an AbortController being used elsewhere that's canceling requests
3. **Browser connection limit** - Too many pending connections to the same domain

## Solution: Add AbortController with Manual Timeout Control

Instead of racing promises, we should use an AbortController which properly cancels the fetch request when the timeout expires. This is the recommended pattern for HTTP request timeouts.

### Changes

**File: `src/components/chains/StartChainModal.tsx`**

1. **Create a fetch wrapper with AbortController support**

```typescript
const fetchWithAbort = async <T,>(
  operation: () => Promise<{ data: T | null; error: any }>,
  timeoutMs: number,
  label: string
): Promise<{ data: T | null; error: any }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`${label}: Aborting after ${timeoutMs}ms`);
    controller.abort();
  }, timeoutMs);

  try {
    const result = await operation();
    clearTimeout(timeoutId);
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return { data: null, error: { message: `${label} timed out` } };
    }
    throw error;
  }
};
```

2. **Simplify the retry logic to work with the new wrapper**

```typescript
const retryOperation = async <T,>(
  operation: () => Promise<{ data: T | null; error: any }>,
  timeoutMs: number,
  operationName: string,
  maxRetries: number = 1
): Promise<{ data: T | null; error: any }> => {
  let lastResult: { data: T | null; error: any } = { data: null, error: null };
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    console.log(`${operationName}: Attempt ${attempt + 1}/${maxRetries + 1}`);
    
    const result = await fetchWithAbort(operation, timeoutMs, operationName);
    
    if (result.data && !result.error) {
      console.log(`${operationName}: Attempt ${attempt + 1} succeeded`);
      return result;
    }
    
    lastResult = result;
    console.warn(`${operationName}: Attempt ${attempt + 1} failed:`, result.error?.message);
    
    if (attempt < maxRetries) {
      console.log(`${operationName}: Retrying in 1 second...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return lastResult;
};
```

3. **Update Step 4 to use the new retry pattern**

```typescript
const result = await retryOperation(
  () => supabase
    .from('ment_chains')
    .insert(chainPayload)
    .select()
    .single(),
  15000,
  'Chain creation',
  1
);

if (result.error || !result.data) {
  throw new Error(`Failed to create chain: ${result.error?.message || 'Unknown error'}`);
}
const newChain = result.data;
```

4. **Add diagnostic logging for the fetch request**

```typescript
console.log('Step 4: Sending request to:', import.meta.env.VITE_SUPABASE_URL);
console.log('Step 4: Request timestamp:', new Date().toISOString());
// ... the insert call
console.log('Step 4: Got response at:', new Date().toISOString());
console.log('Step 4: Response:', JSON.stringify(result, null, 2));
```

## Why This Helps

| Before | After |
|--------|-------|
| `Promise.race()` can leave orphaned requests running | `AbortController` properly cancels the HTTP request |
| Network tab shows hanging requests | Requests are cleanly terminated |
| Server may see duplicate inserts from orphaned requests | Only one request per attempt |

## Alternative Investigation: Edge Function Approach

If the direct database approach continues to fail, we can create a backend function that:
1. Accepts the chain creation parameters
2. Inserts directly using the service role (bypasses role timeout limits)
3. Returns the created chain

This would look like:

```
POST /functions/v1/create-chain
Body: { chainName, recipientId, compliment }
```

This bypasses any browser-to-Supabase network issues by routing through the edge function.

## Recommended Next Step

First, implement the AbortController fix. If that doesn't resolve the issue, we'll create an edge function to handle chain creation server-side.
