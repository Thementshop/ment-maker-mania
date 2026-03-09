

## Diagnosis

The error `"Lock broken by another request with the 'steal' option"` is a **Supabase auth token lock conflict**, not a database row lock. It occurs when two concurrent requests both try to refresh the auth token simultaneously.

**Root cause:** The debug `useEffect` on line 124 uses `supabase.from('chain_links')` (the JS client), which triggers an implicit auth token refresh. When the user clicks "Send", `handlePassChain` calls `supabase.auth.getSession()` at line 277. If the debug query's token refresh is still in-flight, the two requests race for the auth lock, and one gets the "steal" error.

## Plan

### 1. Convert debug chain_links query to REST API
- **File:** `src/components/chains/PassChainModal.tsx` (lines 123-161)
- Replace `supabase.from('chain_links')` with the existing `restApi()` helper or `fetch()` using the session token
- This eliminates the JS client auth lock contention entirely

### 2. Add ref-based double-submit guard
- **File:** `src/components/chains/PassChainModal.tsx`
- Add a `useRef(false)` called `isSubmitting` that gates entry to `handlePassChain`
- Set it `true` on entry, `false` in `finally` block
- This is a belt-and-suspenders guard alongside the existing `disabled={loading}` on the button

These two changes eliminate the auth lock race condition and prevent any edge-case double submissions.

