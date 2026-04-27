
# Pre-Launch Hardening Plan

Infrastructure-only. No user-facing behavior changes. Five workstreams.

---

## 1. Email Queue (decouple send-a-ment / create-chain from Resend)

Add a durable Postgres-backed queue between any code that wants to send an email and the actual Resend call. Spikes get absorbed; failures get retried; nothing is dropped silently.

**New table: `email_queue`**
- `id uuid pk`, `email_type text`, `recipient_email text`, `payload jsonb` (full template_data), `chain_id uuid null`
- `status text` — `pending | processing | sent | failed | dlq` (default `pending`)
- `attempts int default 0`, `max_attempts int default 5`
- `next_attempt_at timestamptz default now()`, `locked_at timestamptz null`, `locked_by text null`
- `last_error text null`, `created_at`, `updated_at`
- Indexes: `(status, next_attempt_at)`, `(recipient_email)`
- RLS: enable, no public policies (service role only).

**Producer change**
- `send-a-ment`, `create-chain`, `send-completed-email`, `send-milestone-email`, `check-expiring-chains` stop calling `send-email` directly. Instead they `INSERT` a row into `email_queue` with the full payload. This is one fast local DB write — the hot path returns immediately.

**Consumer: new edge function `process-email-queue`** (verify_jwt = false)
- Claims a batch of up to 10 rows where `status='pending' AND next_attempt_at <= now()` using `UPDATE ... RETURNING` with `FOR UPDATE SKIP LOCKED`, sets `status='processing'`, `locked_at=now()`.
- For each row: invokes existing `send-email` logic (refactor `send-email/index.ts` to export a `sendEmail(payload)` function reused by both the HTTP handler and the worker).
- On success → `status='sent'`.
- On failure → `attempts++`, exponential backoff `next_attempt_at = now() + (2^attempts * 30s)`, status back to `pending`. After `max_attempts` → `status='dlq'` and a row written to the new `error_log` table (see §4).
- On Resend 429 → respect `Retry-After`, do not increment attempts past 1 for that cycle.

**Schedule via pg_cron (every 15 seconds via 4 staggered minute jobs, or every minute with batch size 40)**
- One pg_cron job calls `process-email-queue` every minute. Throughput: ~40 emails/min default, easily tunable by changing batch size.

**Janitor**
- Daily pg_cron job: delete `sent` rows older than 7 days; keep `dlq` rows for 30 days for inspection.

---

## 2. Lazy / cached auth-token generation

Today `send-a-ment` calls `auth.admin.listUsers()` then `auth.admin.generateLink()` synchronously for every send. `listUsers()` returns the entire user table — this gets catastrophically slow past a few thousand users and is also rate-limited.

**Changes to `send-a-ment` (and same pattern in `create-chain` for chain emails):**

a. **Stop calling `listUsers()`.** Replace with a direct lookup:
```sql
select id from auth.users where lower(email) = lower($1) limit 1
```
via `adminClient.from('auth.users')` won't work — instead use a SECURITY DEFINER RPC `get_user_id_by_email(_email text)` returning uuid. O(1) indexed lookup.

b. **Move token generation out of the hot path.** Two options, we'll do both:
- **Lazy**: do not generate the magic-link token at send time at all. Instead, the email reveal URL becomes `/ment/:id?auto=1`. When the recipient clicks it, the `MentPage` calls a new lightweight edge function `issue-reveal-token` which (i) confirms the ment exists, (ii) confirms the recipient email matches, (iii) generates the magic link token then, (iv) redirects with `?token=...`. This pushes the expensive auth call to click-time (1 per actual open) instead of send-time (1 per send, even un-opened).
- **Cache**: add a `recipient_login_tokens` table `(email pk, hashed_token text, expires_at timestamptz)`. `issue-reveal-token` checks cache first; if a non-expired token exists, reuse it. TTL = 1 hour (matches Supabase magic link lifetime).

Auth-token generation drops from "every send" to "every actual click, and only for users without a fresh cached token." Expected reduction: 80–95% of current calls.

---

## 3. Cloud instance sizing recommendation

I cannot read your Cloud → Overview directly. Based on the workload profile (write-heavy: chain inserts, jar updates, realtime broadcasts on `world_kindness_counter`, queue polling every minute, plus Resend fan-out), here is the concrete recommendation for **1,000 concurrent users**:

| Setting | Recommended | Why |
|---|---|---|
| Compute size | **Small ($15/mo) → Medium ($60/mo)** | Default Micro (1GB / shared CPU) will saturate CPU on Realtime + queue worker. Medium gives 4GB RAM, 2 dedicated vCPU — handles ~200 concurrent DB connections comfortably. |
| Connection pooler | **Transaction mode, pool size 200** | Edge functions are short-lived; transaction pooling maximizes reuse. |
| Direct connections | Keep ≤ 20 | Reserve for migrations + pg_cron. |
| Realtime concurrent connections | Verify limit ≥ 1,500 | One subscriber per active user for `world_kindness_counter`. |
| Disk | 8 GB SSD is fine for launch | Email queue + logs grow slowly with janitor in place. |
| PITR | Enable (7-day) | Cheap insurance pre-launch. |

**Start at Small**, watch the CPU graph for 48 hours after launch, jump to Medium if sustained CPU > 60%. Do not start on Micro — the queue worker + realtime alone will eat it.

---

## 4. Error monitoring table

**New table: `error_log`**
- `id uuid pk`, `created_at timestamptz default now()`
- `source text` — e.g. `send-email`, `process-email-queue`, `issue-reveal-token`, `send-a-ment`, `create-chain`
- `error_type text` — `email_failed`, `token_generation_failed`, `queue_dlq`, `resend_rate_limit`, `db_error`, `unknown`
- `recipient_email text null`, `chain_id uuid null`, `ment_id uuid null`
- `message text`, `context jsonb` (stack, payload, response body)
- `severity text` — `warn | error | critical`
- Index `(created_at desc)`, `(source, error_type)`. RLS service-role only.

**Wired into:**
- `process-email-queue` writes on every Resend failure and every DLQ event.
- `send-a-ment`, `create-chain` write on token generation failure (currently silently swallowed).
- `send-email` writes on Resend non-2xx.
- `issue-reveal-token` writes on missing user / generation failure.

**Inspection**
- You query `select * from error_log where created_at > now() - interval '1 hour' order by created_at desc;` directly in the Cloud SQL editor. No UI built in this pass — you said inspect-able, not dashboard. (We can add a `/admin/errors` page later if desired.)

---

## 5. Health-check edge function

**New edge function: `health-check`** (verify_jwt = false, GET)

Returns JSON:
```json
{
  "status": "ok" | "degraded" | "down",
  "timestamp": "...",
  "checks": {
    "database": { "ok": true, "latency_ms": 12 },
    "email_provider": { "ok": true, "latency_ms": 180 },
    "edge_runtime": { "ok": true },
    "email_queue": { "ok": true, "pending": 4, "dlq": 0, "oldest_pending_age_s": 12 },
    "recent_errors_5m": 2
  }
}
```

Implementation:
- DB: `select 1` against `world_kindness_counter` with 2s timeout.
- Email provider: `GET https://api.resend.com/domains` with the API key, 3s timeout. Counts 2xx as healthy.
- Email queue: count of `pending` and `dlq` rows, oldest pending age. Flags `degraded` if `oldest_pending_age_s > 300` or `dlq > 10`.
- Recent errors: count of `error_log` rows in last 5 min, severity ≥ error. Flags `degraded` if > 20.
- `status` = worst of all checks. HTTP 200 always (so uptime monitors can parse the body); use `status` field for alerting.

Hook this up later to UptimeRobot / BetterStack with one HTTP check — pre-launch you can curl it manually.

---

## Technical summary (file-level)

**New files**
- `supabase/functions/process-email-queue/index.ts`
- `supabase/functions/issue-reveal-token/index.ts`
- `supabase/functions/health-check/index.ts`
- `supabase/functions/_shared/send-email-core.ts` (extracted from current `send-email/index.ts`)
- `supabase/functions/_shared/error-log.ts` (helper: `logError({ source, type, ... })`)

**Modified files**
- `supabase/functions/send-a-ment/index.ts` — replace direct `send-email` fetch with `email_queue` insert; remove `listUsers()`/`generateLink()` from hot path.
- `supabase/functions/create-chain/index.ts` — same.
- `supabase/functions/send-completed-email/index.ts`, `send-milestone-email/index.ts`, `check-expiring-chains/index.ts` — enqueue instead of direct send.
- `supabase/functions/send-email/index.ts` — keep HTTP handler as thin wrapper around `send-email-core.ts` (backward compatible).
- `supabase/config.toml` — add `[functions.process-email-queue]`, `[functions.issue-reveal-token]`, `[functions.health-check]` blocks with `verify_jwt = false`.
- `src/pages/MentPage.tsx` — when URL has `?auto=1` (no token yet), call `issue-reveal-token`, then continue. Existing `?token=` path unchanged.

**Migrations**
- Create `email_queue`, `error_log`, `recipient_login_tokens` tables with RLS.
- `get_user_id_by_email(text)` SECURITY DEFINER function.
- pg_cron: every-minute job → `process-email-queue`; daily janitor.

**Zero user-facing change**
- Same email arrives, same content, same auto-login, same reveal page. The only observable difference is that on cold-start cache misses, the very first click on a magic link adds ~300ms for token generation — invisible alongside the page load.

---

## Rollout order

1. Migrations (tables + RPC + RLS).
2. Deploy `health-check` first — gives you a baseline before anything changes.
3. Deploy `send-email-core` refactor (no behavior change).
4. Deploy `process-email-queue` + cron — but keep producers calling `send-email` directly for now.
5. Switch producers to enqueue. Watch `email_queue` drain.
6. Deploy `issue-reveal-token` + MentPage `?auto=1` path. Keep old `?token=` path working for in-flight emails.
7. Remove `listUsers()`/`generateLink()` from `send-a-ment` and `create-chain`.

Each step is independently reversible.

---

Approve and I'll implement in this order. Total: ~6 new files, ~6 modified files, 1 migration.
