// Hardcoded list of admin user IDs (Donna's accounts). The moderation dashboard
// at /admin/moderation is only accessible to these accounts and is never linked
// anywhere in the app — it is reached by typing the URL directly.
//
// NOTE: This client-side list only controls routing/UI. The real security is
// enforced server-side by the public.is_app_admin() database function, which the
// admin RPCs check before returning or mutating any data.
export const ADMIN_USER_IDS: string[] = [
  '2ed84311-c745-4915-905c-ddbf847994e7', // info@mentshop.com
  '83e6e380-5042-4fcd-b504-8e040f3dff3b', // brentanddonna@yahoo.com
  'de4ed14c-de2c-4b93-bb4b-1cbcf94ff150', // bdhp@gmail.com
];

export function isAdminUserId(userId: string | null | undefined): boolean {
  return !!userId && ADMIN_USER_IDS.includes(userId);
}
