## Findings

I audited both timer-extension code paths against your stated rule (pause tokens **add** time on top of remaining time):

**1. Single ment timer — `extend_single_ment_timer` RPC** ✅ Correct
```sql
SET recipient_expires_at = COALESCE(recipient_expires_at, now()) + INTERVAL '48 hours'
```
Adds 48h to the *current* `recipient_expires_at`. A ment with 6h left becomes 54h. Falls back to `now()+48h` only if expiry is null.

**2. Chain pause token — `usePauseTokens.usePauseToken()`** ❌ Bug
```ts
const newExpiresAt = new Date();
newExpiresAt.setHours(newExpiresAt.getHours() + 24);
.update({ expires_at: newExpiresAt.toISOString() })
```
This **overwrites** `expires_at` to `now()+24h`, ignoring remaining time. A chain with 3h left becomes 24h instead of 27h. (This also contradicts your new rule — the existing memory `pause-tokens-reset-rule` says "reset to 24h" and needs to be inverted.)

There's no server-side RPC for chain pausing — it's a direct table UPDATE from the client, so the fix lives in the hook (and is permitted by the chain UPDATE RLS policy).

## Plan

### 1. Fix chain pause-token to add 24h on top of remaining time
- Move chain pause to a new `extend_chain_timer(_chain_id uuid)` Postgres RPC (mirrors `extend_single_ment_timer`):
  - Validate auth + unlimited-or-tokens-available (same pattern).
  - `SET expires_at = GREATEST(expires_at, now()) + INTERVAL '24 hours'` so an already-expired chain doesn't get a partial extension.
  - Decrement `user_game_state.pause_tokens` + bump `total_tokens_used` only when not unlimited.
  - Return `{success, new_expires_at, unlimited, tokens_remaining}`.
- Update `src/hooks/usePauseTokens.ts` `usePauseToken()` to call the RPC instead of doing the local `setHours(+24)` overwrite.
- Update memory `mem://features/ment-chains/pause-tokens-reset-rule` → rename/rewrite as **"adds 24h on top of remaining time, never resets"**, mirroring single-ment behavior.

### 2. Frontend Vitest tests (`src/lib/__tests__/timer-math.test.ts`)
Pure-function tests for the additive math used in both flows:
- `extend(currentExpiry, hours)` with `currentExpiry > now` → returns `currentExpiry + hours` (within ms tolerance).
- `extend(currentExpiry, hours)` with `currentExpiry < now` (already-expired) → returns `now + hours`.
- Stacking: applying twice from `now+6h` with 48h adds → ends at `now+102h`.
- Edge cases: null/undefined expiry, exactly-now expiry, fractional remaining hours.

Also add minimal `gameStore` level tests (`src/store/__tests__/gameStore.levels.test.ts`):
- `getCurrentLevel(0|19|20|99|2499|2500|999999)` returns the right tier (boundary checks).
- `getNextLevel` returns null at level 25.
- `getProgressToNextLevel` is 0% at min, ~100% just before max, 100% capped at level 25.

(Adds vitest setup files only if not already present per the frontend-testing-setup guide.)

### 3. Edge-case Deno test against live RPCs (`supabase/functions/_tests/timer_extension_test.ts`)
Uses the dotenv pattern with a service-role-bypassing approach. For each timer:
- Seed a `sent_ments` row with `recipient_expires_at = now() + 6h`, call `extend_single_ment_timer`, assert returned `new_expires_at ≈ now + 54h` (±10s), and assert `pause_tokens` decremented by 1.
- Seed a `ment_chains` row with `expires_at = now() + 3h`, call new `extend_chain_timer`, assert `new_expires_at ≈ now + 27h`.
- Already-expired ment (`recipient_expires_at = now() - 1h`) → asserts new expiry is `now + 48h` (no negative carry).
- Unlimited-pause user → no token decrement, expiry still extends.
- Zero tokens & not unlimited → returns `{success:false, error:'no_tokens'}`, no DB mutation.

All inserts/cleanups use a dedicated test user created/torn-down inside the test (or fixture rows tagged with `id` we can delete after).

### 4. Documentation
- Update existing migration's comment header to reflect both RPCs are additive.
- Note the new behavior in the Pause Tokens section of `Store.tsx` helper text if it currently says "reset" anywhere.

## Out of Scope
- No UI redesign; only the helper-text wording fix if needed.
- No changes to the 48h default for new ments or 24h default for new chains.
- No changes to unlimited-Pause-Tokens stacking on profile (already correct).

## Files Touched
- New migration: `extend_chain_timer` RPC.
- Edit: `src/hooks/usePauseTokens.ts` (call RPC).
- New: `src/lib/__tests__/timer-math.test.ts`, `src/store/__tests__/gameStore.levels.test.ts`, `supabase/functions/_tests/timer_extension_test.ts`.
- Memory: rewrite `mem://features/ment-chains/pause-tokens-reset-rule`.
