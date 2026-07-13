// ─────────────────────────────────────────────────────────────────────
// Shared do-not-contact / unsubscribe helpers.
//
// Every email that goes to a RECIPIENT (someone who received a Ment or a
// chain because another user sent it to them) must:
//   1. Be skipped if the recipient is on the do_not_contact list.
//   2. Carry a one-tap unsubscribe link + List-Unsubscribe headers.
//
// This does NOT apply to transactional emails to the sender's own account
// (password reset, email verification, etc.).
// ─────────────────────────────────────────────────────────────────────

import { getAppBaseUrl } from './app-url.ts';

// deno-lint-ignore no-explicit-any
type AdminClient = any;

// Base URL for the public unsubscribe page (GET). Sourced from the APP_BASE_URL
// environment variable so it only needs to change in one place (see app-url.ts)
// when TMS moves to the custom domain (mentshop.com).
export const APP_BASE_URL = getAppBaseUrl();

// Returns true if this email address has permanently opted out.
export async function isOptedOut(admin: AdminClient, email: string): Promise<boolean> {
  if (!email) return false;
  try {
    const { data } = await admin
      .from('do_not_contact')
      .select('id')
      .ilike('email', email.trim())
      .maybeSingle();
    return !!data;
  } catch (err) {
    // Fail-open on lookup errors: better to deliver than to silently drop a
    // legitimate email because of a transient DB hiccup.
    console.error('[opt-out] isOptedOut lookup failed:', err);
    return false;
  }
}

// Returns a stable opt-out token for this email, creating one if needed.
export async function getOrCreateOptOutToken(admin: AdminClient, email: string): Promise<string | null> {
  const normalized = (email || '').trim();
  if (!normalized) return null;
  try {
    const { data: existing } = await admin
      .from('email_opt_out_tokens')
      .select('token')
      .ilike('email', normalized)
      .maybeSingle();
    if (existing?.token) return existing.token;

    const token = crypto.randomUUID();
    const { error: insertErr } = await admin
      .from('email_opt_out_tokens')
      .insert({ email: normalized, token });
    if (insertErr) {
      // Possible race: another send created it first. Re-read.
      const { data: again } = await admin
        .from('email_opt_out_tokens')
        .select('token')
        .ilike('email', normalized)
        .maybeSingle();
      return again?.token ?? null;
    }
    return token;
  } catch (err) {
    console.error('[opt-out] getOrCreateOptOutToken failed:', err);
    return null;
  }
}

// Permanently add an email to the do-not-contact list. Idempotent.
export async function addToDoNotContact(
  admin: AdminClient,
  email: string,
  source: string,
): Promise<void> {
  const normalized = (email || '').trim();
  if (!normalized) return;
  try {
    const { data: existing } = await admin
      .from('do_not_contact')
      .select('id')
      .ilike('email', normalized)
      .maybeSingle();
    if (existing) return;

    const token = (await getOrCreateOptOutToken(admin, normalized)) ?? crypto.randomUUID();
    const { error } = await admin
      .from('do_not_contact')
      .insert({ email: normalized, opt_out_token: token, source });
    if (error && error.code !== '23505') {
      console.error('[opt-out] addToDoNotContact failed:', error);
    }
  } catch (err) {
    console.error('[opt-out] addToDoNotContact threw:', err);
  }
}

// The public unsubscribe page (GET) the HTML link points to.
export function buildUnsubscribePageUrl(token: string): string {
  return `${APP_BASE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

// The one-click POST endpoint used by the List-Unsubscribe header.
export function buildUnsubscribePostUrl(token: string): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  return `${supabaseUrl}/functions/v1/handle-unsubscribe?token=${encodeURIComponent(token)}&source=email_header`;
}

// Small muted unsubscribe footer appended to the bottom of recipient emails.
export function buildUnsubscribeHtml(token: string): string {
  const pageUrl = buildUnsubscribePageUrl(token);
  return `
  <tr><td style="padding:0 30px 28px;text-align:center;">
    <p style="color:#b0b0b0;font-size:11px;line-height:1.6;margin:0;">
      Don't want to receive Ments by email?<br>
      <a href="${pageUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe with one tap</a>
    </p>
  </td></tr>`;
}

// Resend headers that surface a native "Unsubscribe" button in Gmail/Yahoo/Apple.
export function buildUnsubscribeHeaders(token: string): Record<string, string> {
  const postUrl = buildUnsubscribePostUrl(token);
  return {
    'List-Unsubscribe': `<${postUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
