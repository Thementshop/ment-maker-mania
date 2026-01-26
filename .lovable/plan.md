

## Fix: Add Login Option for Returning Users

### The Problem

Your account exists and is fully confirmed, but the Auth page only shows "Create Your Account" with no login option. When your browser session was cleared during debugging, you had no way to sign back in.

The current design says "Your session is saved automatically — no need to log in again!" but sessions can expire or be cleared, leaving returning users stuck.

---

### The Solution

Add a toggle between Sign Up and Sign In modes on the Auth page. This maintains the clean "native app" feel while giving returning users a way back in.

---

### User Experience Flow

```text
First-time visitor:
┌─────────────────────────┐
│ Create Your Account     │  ← Default view
│ [Sign up form]          │
│                         │
│ Already have account?   │
│ [Sign in instead]       │
└─────────────────────────┘

Returning user (clicks "Sign in"):
┌─────────────────────────┐
│ Welcome Back!           │
│ [Email + Password]      │
│                         │
│ New here?               │
│ [Create account]        │
└─────────────────────────┘
```

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Add toggle between signup and login modes |

---

### Implementation Details

1. Add `isLoginMode` state to toggle between signup and login views
2. Create a simpler login form (just email + password)
3. Add toggle links at the bottom of each form
4. Use the existing `signIn` method from AuthContext (already available)

---

### Code Changes

**`src/pages/Auth.tsx`**

- Add state: `const [isLoginMode, setIsLoginMode] = useState(false);`
- Import `signIn` from useAuth (already exists in AuthContext)
- Add login form handler that calls `signIn(email, password)`
- Conditionally render signup or login form based on mode
- Add toggle link: "Already have an account? Sign in" / "New here? Create account"

---

### Visual Design

The login form will be simpler than signup:
- **Login**: Email + Password only (no display name, no confirm password)
- **Signup**: Display Name + Email + Password + Confirm Password

Both forms will have the same styling with the animated mint logo and mint-themed button.

