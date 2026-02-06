
# Fix Supabase Query Timeouts

## Problem Identified

All Supabase queries from the JavaScript client are timing out (3s, 5s, 8s), but when I query the database directly via the admin API, responses are **instant** (under 100ms).

The issue is in how the `withTimeout` helper wraps the Supabase queries:

```typescript
await withTimeout(
  Promise.resolve(supabase.from('ment_chains').select('*')...),
  8000,
  'ment_chains query'
);
```

The `Promise.resolve()` immediately resolves with the query builder object (which is PromiseLike but not yet executing), then the timeout starts counting. The actual HTTP request may not start until later, or the client may be in a blocked state.

## Root Cause Analysis

The Supabase JS client can get stuck in certain states:
1. During token refresh cycles
2. When the auth state is changing
3. When there are network issues

The current `withTimeout` approach doesn't work correctly because:
- `Promise.resolve(queryBuilder)` may not trigger the HTTP request immediately
- The timeout race starts before the actual request begins

## Solution

Remove the `Promise.resolve()` wrapper entirely. The Supabase query builder IS already awaitable - just use it directly with a simpler timeout approach.

**New approach**: Create individual query functions that we can properly timeout, or restructure to not need `Promise.resolve()`.

## Changes

### File: `src/hooks/useMentChains.ts`

**Simplify the query execution** - Remove `Promise.resolve()` and call the queries directly:

```typescript
// BEFORE (broken)
const chainsResult = await withTimeout(
  Promise.resolve(
    supabase.from('ment_chains').select('*')...
  ),
  8000,
  'ment_chains query'
);

// AFTER (working)
const chainsPromise = supabase
  .from('ment_chains')
  .select('*')
  .or(`started_by.eq.${user.id},current_holder.eq.${user.id}`)
  .order('created_at', { ascending: false });

const chainsResult = await withTimeout(chainsPromise, 8000, 'ment_chains query');
```

The Supabase query builder returns a `PromiseLike` that can be directly passed to `Promise.race()` - no need for `Promise.resolve()`.

**Apply this fix to all 4 query locations:**

1. Line 73-84: Find expired chains query
2. Line 88-100: Update expired chains query  
3. Line 139-149: Main ment_chains query
4. Line 170-179: Profiles query
5. Line 196-206: Chain links query

### File: `src/utils/chainNames.ts`

**Same issue exists here** - The timeout wrapper pattern is the same. Apply the same fix:

```typescript
// BEFORE
const fetchPromise = supabase.from('used_chain_names').select('chain_name');
const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

// This is actually correct - fetchPromise IS the promise, not Promise.resolve(fetchPromise)
```

Actually `chainNames.ts` is already correct - it passes the query directly without `Promise.resolve()`.

## Summary of Changes

| File | Lines | Change |
|------|-------|--------|
| `src/hooks/useMentChains.ts` | 73-84 | Remove `Promise.resolve()` wrapper |
| `src/hooks/useMentChains.ts` | 88-100 | Remove `Promise.resolve()` wrapper |
| `src/hooks/useMentChains.ts` | 139-149 | Remove `Promise.resolve()` wrapper |
| `src/hooks/useMentChains.ts` | 170-179 | Remove `Promise.resolve()` wrapper |
| `src/hooks/useMentChains.ts` | 196-206 | Remove `Promise.resolve()` wrapper |

## Technical Explanation

The Supabase query builder (returned by `supabase.from().select()`) implements the `PromiseLike` interface with a `.then()` method. When you call `Promise.race([queryBuilder, timeout])`, JavaScript automatically calls `.then()` on the query builder, which triggers the HTTP request.

When you wrap it in `Promise.resolve(queryBuilder)`, it creates a new promise that resolves with the query builder as its value - but this doesn't trigger the HTTP request. The timing race then starts against a non-executing promise.

## Expected Result

After this fix:
- Queries will execute immediately when passed to `withTimeout`
- The 8-second timeout will only trigger if the actual HTTP request takes too long
- Chain list should load in ~100-500ms (based on direct query tests)
