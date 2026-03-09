

## Current State

- **Create chain**: Creator gets +5 mints ✅, first recipient gets +1 mint ✅ (lines 168-191 in `create-chain/index.ts`)
- **Pass chain**: Sender gets +1 mint ✅, but **recipient gets nothing** ❌

## Plan

### 1. Award +1 mint to recipient when a chain is passed (`PassChainModal.tsx`)

After the sender's +1 mint award succeeds (around the existing `jar_count` PATCH), add a second REST API call to award +1 mint to the recipient — but only if the recipient is a registered user (same pattern as `create-chain`).

Since `PassChainModal` runs client-side and can't use the service role key to look up users by email, we have two options:

**Option A (simpler):** Just try to look up the recipient's `user_game_state` by checking the `profiles` table for a matching email — but profiles don't store emails.

**Option B (recommended):** Move the recipient mint award into the `create-chain` pattern: use a lightweight edge function or do it via the admin client. Since we already have the pattern in `create-chain`, the cleanest approach is to add the recipient award logic directly in `PassChainModal` using a REST API call to a new RPC function that handles it server-side.

**Simplest approach:** Add a new database function `award_mint_to_email(email text)` that:
1. Looks up the user by email in `auth.users` (SECURITY DEFINER)
2. Increments their `jar_count` by 1 if found
3. Returns whether it succeeded

Then call this via REST RPC from `PassChainModal` after the pass succeeds.

### Implementation Steps

1. **Create DB function** `award_mint_to_email(_email text)` — SECURITY DEFINER, looks up user in `auth.users`, increments `user_game_state.jar_count` by 1
2. **Update `PassChainModal.tsx`** — After successful chain pass + sender mint award, call `rpc/award_mint_to_email` via REST with the recipient's email/value (fire-and-forget, non-blocking)
3. **Update `create-chain/index.ts`** — Optionally refactor to use the same DB function for consistency (low priority)

