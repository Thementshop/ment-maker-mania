
Objective:
Stabilize post-login identity hydration so the app reliably shows the correct account (not “U”) and loads chains immediately after signing in.

What I found from investigation:
1) Login itself is successful.
- Auth request for brentanddonna@yahoo.com returns 200 with user id 83e6e380-5042-4fcd-b504-8e040f3dff3b.

2) Backend data is correct for that user.
- Profile row exists with display_name = “Donna Pursley”.
- Multiple chains exist for this user (both started and active).

3) UI still shows “U” and empty chains due frontend state flow, not missing backend records.
- Header initials come only from profile.display_name; if profile is null/delayed, it falls back to “U”.
- Account modal “Display Name” field is initialized once from profile and does not resync when profile arrives later.
- Chain hook logs show “[useMentChains] Fetching…” but no completion log, indicating a blocking/hanging async step before render updates.

Likely root cause:
A blocking call in the chain/auth startup flow is stalling hydration (especially around claim/profile fetch timing), while the UI has no resilient fallback for display name. So user is authenticated, but identity/chains display can appear “blank/stuck”.

Implementation plan:

1) Make avatar/name rendering resilient immediately after auth
- File: src/components/Header.tsx
- Change auth usage to include user from context.
- Compute display name with fallback priority:
  1. profile.display_name
  2. user.user_metadata.full_name
  3. local part of email
  4. “U”
- Use this resolved value for initials so the header never stays “U” when account info is available.

2) Sync Account Settings display-name input when profile loads asynchronously
- File: src/components/AccountSettingsModal.tsx
- Add useEffect to update local displayName state when profile/user changes.
- This fixes the confusing “Your display name” empty field for logged-in users whose profile arrives after initial render.

3) Prevent chain loading from being blocked by claim step
- File: src/hooks/useMentChains.ts
- Keep chain claim behavior, but make it non-blocking for initial render:
  - Run claim with a short timeout guard (or in background), then continue fetch.
  - If claim is slow/fails, continue to fetch chains anyway.
- Ensure fetch path always reaches success/error completion logs and state updates.
- This guarantees chain cards can render even when claim RPC is delayed.

4) Harden auth profile hydration to avoid “null profile” sticking
- File: src/contexts/AuthContext.tsx
- Add a safe profile hydration path:
  - Set a temporary fallback profile from user metadata immediately after session is available.
  - Then fetch DB profile and replace fallback when returned.
- Add timeout guard around profile fetch so auth UI cannot get stuck waiting.
- Maintain existing sign-out cleanup logic (already improved).

5) Add targeted debug logs (temporary, scoped)
- Files: AuthContext + useMentChains
- Log key checkpoints only:
  - auth session received
  - profile fallback set / profile DB resolved
  - claim started / claim timed out / claim done
  - chains fetch start / chains fetch done / fetch error
- This will let us verify the exact phase if any user still sees stale identity.

Validation plan (end-to-end):
1) Sign out fully, sign back in as brentanddonna@yahoo.com.
2) Verify immediately on home:
- Avatar shows initials for Donna (not “U”).
- Account Settings display name input is populated.
- Chain dashboard displays existing chains (not empty due to startup stall).
3) Switch accounts (logout/login with a different user), then switch back.
- Confirm avatar/chains always match the active account.
4) Re-test the compliment flow after identity is stable:
- Create chain with a specific compliment, log in as recipient, verify Pass It Forward shows expected compliment.

Scope and risk:
- No database schema changes needed.
- No policy changes needed.
- Changes are frontend/auth orchestration only, low-risk, focused on startup robustness and UI fallback behavior.
