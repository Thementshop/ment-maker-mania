

## Add Account Settings for Profile Management

### Current State

Currently, there is **no way** for users to change their:
- Display name
- Email address
- Password

The avatar in the header is display-only with no click action. The database already has RLS policies allowing users to update their own profile, but no UI exists to use this capability.

---

### The Solution

Add a Settings modal accessible from the header avatar that allows users to manage their account.

---

### User Experience Flow

```text
Click avatar in header:
┌─────────────────────────────┐
│ ⚙️ Account Settings         │
├─────────────────────────────┤
│                             │
│ Display Name                │
│ [Current Name________] ✓    │
│                             │
│ Email                       │
│ [current@email.com__] ✓     │
│                             │
│ Change Password             │
│ [New Password_______]       │
│ [Confirm Password___] ✓     │
│                             │
│ ─────────────────────────── │
│ [Sign Out]                  │
└─────────────────────────────┘
```

---

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/AccountSettingsModal.tsx` | **NEW** - Modal with forms for each setting |
| `src/components/Header.tsx` | Make avatar clickable to open settings modal |
| `src/contexts/AuthContext.tsx` | Add `updateProfile`, `updateEmail`, `updatePassword` methods |

---

### Implementation Details

**1. AuthContext - Add new methods**

```typescript
interface AuthContextType {
  // ... existing ...
  updateProfile: (displayName: string) => Promise<{ error: Error | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}
```

- `updateProfile`: Updates the `profiles` table `display_name` field
- `updateEmail`: Uses `supabase.auth.updateUser({ email })` - sends confirmation email
- `updatePassword`: Uses `supabase.auth.updateUser({ password })`

**2. AccountSettingsModal - New component**

Features:
- Display name field with save button
- Email field with save button (note: requires email confirmation)
- Password change with new password + confirm password fields
- Sign out button at the bottom
- Each section saves independently
- Success/error toast notifications

**3. Header - Avatar interaction**

- Add state for modal open/close
- Wrap avatar in a clickable button
- Show visual indicator (like a gear icon overlay on hover)

---

### Security Considerations

- Password changes require the new password to be at least 6 characters
- Email changes send a confirmation email to the new address
- All updates use authenticated Supabase client (RLS protected)
- Display name updates go to the `profiles` table (already has RLS policy)

---

### Visual Design

The modal will match the existing app styling:
- Rounded corners with glass-like background
- Mint-themed buttons for primary actions
- Subtle animations using Framer Motion
- Form inputs matching the Auth page style

