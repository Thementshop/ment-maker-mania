
# Fix CORS Headers in Edge Function

## Problem
The chain creation is stuck spinning because the browser's preflight (OPTIONS) request is being rejected. The network tab shows "No results" for the create-chain request because the browser never sends the actual POST request after the preflight fails.

The edge function's CORS headers are missing several headers that the Supabase JavaScript client sends automatically.

## Root Cause

**Current CORS headers in edge function:**
```javascript
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
```

**Required CORS headers (per Supabase documentation):**
```javascript
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

The Supabase JS client automatically includes platform/runtime tracking headers, and when the browser's preflight check sees these headers aren't allowed, it blocks the request entirely.

## Solution

Update the CORS headers in `supabase/functions/create-chain/index.ts` to include all required headers.

## Changes

### File: `supabase/functions/create-chain/index.ts`

**Line 3-6: Update corsHeaders**

```typescript
// Before
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// After
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

## Why This Fixes It

| Before | After |
|--------|-------|
| Browser sends OPTIONS preflight | Browser sends OPTIONS preflight |
| Server responds with limited allowed headers | Server responds with all required headers |
| Browser sees missing headers, blocks request | Browser approves, sends actual POST |
| No network request visible, infinite spin | Request completes, chain created |

## Technical Details

When a browser makes a cross-origin request with custom headers, it first sends an OPTIONS request to check if the server allows those headers. The Supabase JS client automatically adds tracking headers like `x-supabase-client-platform`. If those aren't in the `Access-Control-Allow-Headers` list, the browser silently blocks the main request.

This is a single-line fix that will immediately resolve the spinning issue.
