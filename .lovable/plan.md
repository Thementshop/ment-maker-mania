

# Fix: Chain Not Appearing After New User Signup

## Root Cause

When a chain is passed forward, the `current_holder` field is set to a **text identifier** (name, email, or phone number) — not a UUID. When the recipient signs up and gets a new UUID, there is no mechanism to match that UUID back to the `current_holder` string. The dashboard query filters by `current_holder = user.id`, so the chain never appears.

## Solution: Chain Claiming After Authentication

Add a "claim chains" step that runs automatically after a user signs in or signs up. It checks if any active chains have `current_holder` matching the user's email, and updates them to the user's UUID.

### 1. Database Function: `claim_chains_for_user`

Create a database function that:
- Takes a user UUID as input
- Looks up the user's email from `auth.users`
- Finds all active `ment_chains` where `current_holder` matches the email (case-insensitive)
- Updates those chains' `current_holder` to the user's UUID
- Returns the number of chains claimed

```sql
CREATE OR REPLACE FUNCTION public.claim_chains_for_user(claiming_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email text;
  claimed_count integer;
BEGIN
  -- Get user's email
  SELECT email INTO user_email FROM auth.users WHERE id = claiming_user_id;
  
  IF user_email IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Update chains where current_holder matches user's email
  UPDATE ment_chains
  SET current_holder = claiming_user_id::text
  WHERE lower(current_holder) = lower(user_email)
    AND status = 'active';
  
  GET DIAGNOSTICS claimed_count = ROW_COUNT;
  RETURN claimed_count;
END;
$$;
```

This is a `SECURITY DEFINER` function because it needs to read from `auth.users` (which normal users can't access).

### 2. AuthContext: Call claim function after sign-in/sign-up

In `src/contexts/AuthContext.tsx`, add a call to `claim_chains_for_user` inside the `loadUserGameState` function (or alongside it) so it runs once per session after authentication:

```typescript
const claimChains = async (userId: string) => {
  try {
    const { data, error } = await supabase.rpc('claim_chains_for_user', {
      claiming_user_id: userId
    });
    if (data && data > 0) {
      console.log(`Claimed ${data} chain(s) for user`);
    }
  } catch (err) {
    console.error('Failed to claim chains:', err);
  }
};
```

Call this inside `onAuthStateChange` after setting the user, right alongside `loadUserGameState`.

### 3. ChainPage: Auto-redirect after claiming

In `src/pages/ChainPage.tsx`, when a logged-in user views a chain where `current_holder` matches their email but not their UUID, trigger the claim and re-fetch the chain data. This ensures the page immediately shows the "Pass It Forward" CTA instead of the public view.

The query already re-fetches on auth changes since `user` is a dependency. After the claim runs in AuthContext, the chain page query will re-run and find the user is now the current holder.

### Flow After Fix

1. User A passes chain to "bob@example.com"
2. Bob opens chain link -- sees public view with "Sign In to Participate"
3. Bob signs up with bob@example.com
4. Auth completes -- `claim_chains_for_user` runs automatically
5. Chain's `current_holder` updates from "bob@example.com" to Bob's UUID
6. Bob is redirected back to `/chain/[id]` (via `returnTo`)
7. Chain page detects Bob is `current_holder` -- shows "Pass It Forward" CTA
8. Dashboard shows the chain in "Your Turn" tab

### Files Changed

| File | Change |
|------|--------|
| New migration | `claim_chains_for_user` database function |
| `src/contexts/AuthContext.tsx` | Call `claim_chains_for_user` on auth |
| `src/pages/ChainPage.tsx` | Add `user` to query key so it re-fetches after login |

### Edge Cases Handled

- **Case-insensitive matching**: Email comparison uses `lower()` to handle "Bob@Email.com" vs "bob@email.com"
- **Multiple chains**: If the same email is the current holder of multiple chains, all get claimed
- **No email match**: Function returns 0 gracefully, no errors
- **Already claimed**: If `current_holder` is already a UUID, it won't match an email pattern, so no double-claiming
- **Non-email identifiers**: Names and phone numbers won't match the email lookup, which is expected. A future enhancement could also match phone numbers if stored in user metadata

