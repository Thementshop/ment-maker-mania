// Hardcoded list of admin user IDs. The moderation dashboard at
// /admin/moderation is only accessible to these accounts and is never linked
// anywhere in the app — it is reached by typing the URL directly.
//
// NOTE: This client-side list only controls routing/UI. The real security is
// enforced server-side by the public.is_app_admin() database function, which the
// admin RPCs check before returning or mutating any data.
export const ADMIN_USER_IDS: string[] = [
  'eab629d4-d0af-4720-8c4d-753b11ab8f2e', // donna@mentshop.com (sole admin)
];

export function isAdminUserId(userId: string | null | undefined): boolean {
  return !!userId && ADMIN_USER_IDS.includes(userId);
}
