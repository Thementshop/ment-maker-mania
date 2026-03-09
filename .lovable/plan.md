
Goal: add end-to-end observability so we can prove exactly where “hey2” is being dropped (RPC claim call, REST query construction, backend row visibility, or UI filtering).

What I found from current code/state before implementation:
- `useMentChains` already calls `claim_chains_for_user` on every fetch (not just login), but it times out client-side after 3s.
- The backend visibility policy for chains already includes email matching (`lower(current_holder) = lower(auth.jwt()->>'email')`).
- The app currently has multiple pipeline stages where rows can be hidden after fetch (especially UUID-only checks in chain dashboard tab filters).
- Current logs are not granular enough to correlate one fetch cycle to one claim attempt and one raw response.

Implementation plan

1) Instrument backend claim function with structured logs (migration)
- File: new migration in `supabase/migrations/`
- Update `public.claim_chains_for_user(claiming_user_id uuid)` to emit detailed server logs:
  - function entry timestamp + `claiming_user_id`
  - resolved user email
  - candidate chain rows found for claiming (ids/names/status/current_holder)
  - rows updated in `ment_chains` (ids)
  - rows updated in `chain_links` (count)
  - total duration ms
  - explicit error log in exception block
- Keep return type and behavior compatible (`integer`) so existing frontend code does not break.
- Purpose: confirm whether claim actually runs, what it sees, and what it changes each call.

2) Add fetch-cycle correlation logging in `useMentChains`
- File: `src/hooks/useMentChains.ts`
- For every fetch run, generate `fetchDebugId` and log:
  - user identity inputs: `user.id`, `user.email`, `session.user?.email`, JWT email (decoded from access token for comparison)
  - exact OR filter string and full REST URL being requested
  - claim RPC lifecycle:
    - start
    - result vs timeout vs error
    - elapsed time
    - late resolution (if timed out locally but completes later)
  - raw REST payload before any local mapping/filtering
  - per-row diagnostics for each returned chain:
    - `matchesStartedBy`
    - `matchesHolderUuid`
    - `matchesHolderEmail`
    - `status`
  - final counts at each stage:
    - raw rows
    - rows mapped to typed chains
    - your-turn rows
- Purpose: prove whether “hey2” is absent from API response or dropped later.

3) Add UI pipeline logs where additional filtering occurs
- File: `src/components/chains/ChainDashboard.tsx`
- Add debug logs for:
  - incoming `chainData` IDs/names/current_holder/status
  - active-tab filtered IDs
  - your-turn detection results (and why each row passed/failed)
- Purpose: catch cases where rows are fetched but hidden by UUID-only client checks.

4) Verify backend policy state and visibility with direct SQL diagnostics
- During implementation validation, run read-only backend checks:
  - policy definitions for `ment_chains` (confirm email clause is active)
  - rows where `current_holder` is bdhp email or bdhp UUID (id/name/status/created_at)
  - sanity query showing which rows should match the intended OR condition
- Purpose: eliminate policy drift and confirm data shape.

5) Validation flow after instrumentation
- Fresh sign-in as bdhp account.
- Capture one fetch cycle using `fetchDebugId` and confirm:
  - claim call attempted (and backend log entry exists)
  - query includes both UUID + email conditions
  - raw API includes/excludes “hey2”
  - if raw includes “hey2” but UI doesn’t: fix client tab filters to dual-match UUID/email.
  - if raw excludes “hey2” and query email missing: fix email source fallback (`user.email` → `session.user.email`/JWT email).
- Keep debug logs prefixed (`[MentChainsDebug]`) so they are easy to grep and remove later.

Technical notes / guardrails
- I will not touch auto-generated integration files.
- No auth behavior changes; this is observability-first.
- Logging volume will be scoped and clearly prefixed so it can be rolled back cleanly after diagnosis.
