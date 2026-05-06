## Goal

Set up Stripe payments for The Ment Shop with 5 one-time products, then wire them into the existing Token Store with full purchase fulfillment, monthly purchase limit on Mint Boost, and an "unlimited Pause Tokens" mode that bypasses token decrement.

## Step 1 — Create products in Stripe (test environment)

One `batch_create_product` call covering all 5 SKUs. All one-time purchases (no `recurring_interval`), `quantity_min=1`, `quantity_max=1`. Stable snake_case IDs that match across sandbox and live:

| price_id | Display name | Amount |
|---|---|---|
| `pause_tokens_20` | 20 Pause Tokens | $2.50 |
| `pause_tokens_50` | 50 Pause Tokens | $5.00 |
| `pause_tokens_100` | 100 Pause Tokens | $7.50 |
| `pause_tokens_unlimited_year` | 1 Year Unlimited Pause Tokens | $19.50 |
| `mint_boost` | Mint Boost — 25 Mints | $4.00 |

After creation, set tax codes via Stripe API (required for the +0.5% tax calculation you chose):
- All Pause Token SKUs → `txcd_10000000` (general digital goods)
- Mint Boost → `txcd_10000000` (general digital goods)

## Step 2 — Database (already migrated)

`profiles` already has `pause_tokens_unlimited`, `pause_tokens_unlimited_expires_at`, `mint_boost_last_purchased_at`. A `payment_events` table is in place for webhook idempotency. No further migrations.

## Step 3 — Backend edge functions

Three new functions, all with `verify_jwt = false` in `supabase/config.toml`:

1. **`_shared/stripe.ts`** — gateway-routed `createStripeClient(env)` + `verifyWebhook(req, env)` HMAC verifier (per Lovable Stripe utility pattern).
2. **`create-checkout`** — accepts `{ priceId, userId, customerEmail, returnUrl, environment }`. For `mint_boost`, server-side guard: read `profiles.mint_boost_last_purchased_at` and reject with 409 if it's in the current calendar month. Adds `automatic_tax: { enabled: true }` (matches your "tax calculation only" choice). Returns embedded checkout `clientSecret`.
3. **`payments-webhook`** — handles `checkout.session.completed` (Stripe core event for one-time payments). Looks up `userId` and `priceId` from session metadata + line items, deduplicates via `payment_events.event_id`, then fulfills:
   - `pause_tokens_20|50|100` → increment `profiles.pause_tokens` and `user_game_state.pause_tokens` by 20/50/100
   - `pause_tokens_unlimited_year` → set `pause_tokens_unlimited = true`; if existing `pause_tokens_unlimited_expires_at` is in the future, add 365 days to it; otherwise set to `now() + 365 days` (stacking behavior)
   - `mint_boost` → add 25 to `user_game_state.jar_count`; set `profiles.mint_boost_last_purchased_at = now()`

## Step 4 — App-wide unlimited Pause Tokens behavior

Add helper `isPauseTokensUnlimited(profile)` (true when flag set AND expiry > now). Update:
- `usePauseTokens` hook — expose `unlimited: boolean`, treat balance as ∞ for UI, skip decrement in `usePauseToken`/`extend_single_ment_timer` paths when unlimited.
- DB function `extend_single_ment_timer` — short-circuit token deduction when unlimited.
- Anywhere the gold coin token count renders, show "∞" when unlimited.

## Step 5 — Token Store UI rebuild (`src/pages/Store.tsx`)

Two clean sections, mobile-first, brand styling (Screamin' Green accents, gold coin asset):

**Section 1 — "Get more time with Pause Tokens"**
- 4 cards (20 / 50 / 100 / Unlimited Year) with the existing gold Pause Token coin
- Each card: name, quantity, price, "Get Tokens" CTA → opens embedded checkout
- Unlimited card visually elevated (best value badge)

**Section 2 — "Boost your jar"**
- Single Mint Boost card: "25 Mints — $4.00", "Add to your jar" CTA
- If `mint_boost_last_purchased_at` is in current calendar month: button disabled, label "Available [Month 1]" (first of next month), helper text below: "1 Mint Boost available per month"

UI rules enforced:
- Words "buy"/"purchase" never appear in copy (use "Get", "Add", "Unlock")
- No header nav entry for the store (already accessed via chain cards & MentPage)
- No subscription UI, no separate pricing page
- After successful checkout return: toast "Your Pause Tokens have been added! 💚" or "25 mints added to your jar! 💚", then close store/back to previous page
- Test-mode banner at top of store while in sandbox

## Step 6 — Checkout return handling

`/checkout/return` page reads `session_id`, polls user's profile/game state for ~5s for the fulfillment update, then shows success toast and routes back to the previous context (chain card → chain dashboard, MentPage → MentPage, store → store).

## Step 7 — Merch placeholder

No code. Just a memory note that physical merch will be added later via Shopify (Stripe + Lovable's seamless flow doesn't handle physical with shipping cleanly).

## Test checklist (sandbox, with card `4242 4242 4242 4242`)

1. Each Pause Token tier opens checkout and increments correct quantity post-payment
2. Unlimited Year sets `pause_tokens_unlimited = true` and expiry ≈ now+365d; second purchase pushes expiry to ≈ now+730d
3. While unlimited active: token UI shows ∞, extending a single Ment / chain does not decrement balance
4. Mint Boost adds 25 to jar count, sets `mint_boost_last_purchased_at`, and a second attempt in the same calendar month is blocked at the UI (disabled button) AND server (409 from create-checkout)
5. Success toasts render correctly for both purchase paths
6. Store layout is clean at 375px and 1024px viewports

## Out of scope

- Going live (separate user-driven flow via Payments dashboard)
- Refunds UI
- Physical merch (deferred)

## Technical details

- Stripe SDK pinned `stripe@22.0.2`, API version `2026-03-25.dahlia`
- `EmbeddedCheckoutProvider` + `EmbeddedCheckout` from `@stripe/react-stripe-js@6.2.0`, `@stripe/stripe-js@9.2.0`
- All Stripe API calls routed through `connector-gateway.lovable.dev/stripe` via `createStripeClient`
- Webhook handler reads `?env=sandbox|live` and uses matching `PAYMENTS_*_WEBHOOK_SECRET` for HMAC verification
- Client-side mint-boost gating reads from existing `profiles` SELECT (already permitted by RLS)
- All fulfillment writes happen in webhook with service role key (bypasses RLS)