
What “JWT expired” means:

- A JWT is the temporary login token the app sends with your request to prove you’re signed in.
- “JWT expired” means the token attached to the “save contact” request was too old, so the backend rejected it.
- In plain English: the app tried to save your contact using an expired login session.

What I can already tell from the logs:

- This is not a phone-format problem.
- This is not the contact form validation blocking the save.
- The request is reaching the backend, but it comes with an expired Bearer token, so it gets a 401 error before insert/RLS logic can succeed.
- The specific failing request is the POST to `user_contacts`, and the response is `PGRST303: JWT expired`.

Most likely root cause in this codebase:

- `AddContactForm` is using `session.access_token` from `AuthContext`.
- That session value appears to be stale at the moment the direct REST `fetch()` runs.
- Because this project intentionally bypasses some client SDK flows to avoid auth lock issues, it likely also needs a manual “get fresh token before REST call” step.

Plan to fix:

1. Add a small shared helper to safely get a fresh access token before any direct REST request.
   - If the current token is still valid, use it.
   - If expired or near expiry, refresh it first.
   - If refresh fails, show a clear “Your session expired, please sign in again” message.

2. Update `AddContactForm` to use that fresh-token helper instead of directly trusting `session.access_token`.

3. Improve error handling for 401s.
   - Detect `JWT expired` specifically.
   - Stop the spinner immediately.
   - Show a user-friendly toast explaining they need a refreshed session or re-login.

4. Check other direct REST calls in the app for the same pattern.
   - Contact loading
   - Chain/game state fetches
   - Any inserts/updates done with manual `fetch()`
   This bug may repeat elsewhere if they also rely on stale tokens.

5. Keep the current timeout safeguard, but make auth-expiry failures fail fast instead of looking like a hanging save.

Technical notes:

- The backend table itself appears to exist, because the request reaches it.
- The failure happens before a successful insert, so RLS may still be fine; auth is the immediate blocker.
- The console ref warnings from Framer Motion/Input are separate UI warnings and are not causing the save failure.

Expected result after fix:

- Saving a contact will either:
  - succeed normally with a refreshed token, or
  - immediately show “Your session expired. Please sign in again.” instead of hanging on “Saving...”
