

# Keep-Alive Mechanism to Prevent Backend Pausing

## Problem
The backend was paused after 7 days of inactivity, causing the entire app to go down.

## Solution
Create a lightweight edge function that runs a simple database query, scheduled via pg_cron to execute every 3 days.

## Technical Details

### 1. Create Edge Function: `supabase/functions/keep-alive/index.ts`
- Simple function that queries `SELECT 1` from the database using the service role key
- Returns success/failure status with timestamp
- Includes standard CORS headers

### 2. Configure in `supabase/config.toml`
- Add `[functions.keep-alive]` with `verify_jwt = false` (called by cron, no user auth)

### 3. Schedule via pg_cron
- Use `cron.schedule()` to call the function every 3 days
- Uses `net.http_post()` to invoke the edge function with the anon key
- This keeps the database active and prevents the 7-day inactivity pause

### Files Changed
- `supabase/functions/keep-alive/index.ts` (new)
- `supabase/config.toml` (add function config)
- SQL insert for cron job scheduling

