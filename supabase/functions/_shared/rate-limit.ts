// ─────────────────────────────────────────────────────────────────────
// Shared daily rate-limit gate for send actions.
//
// Wraps the public.check_and_record_send() SQL function which atomically
// checks the caller's daily caps and, when allowed, records the send action
// in public.send_events.
//
// Tiers (enforced in SQL):
//   NEW accounts (<7 days):        10 sends/day, 25 recipients/day, 15 per send, 15 SMS/day
//   ESTABLISHED (8+ days, 0 reports): 30 sends/day, 100 recipients/day, 25 per send, 30 SMS/day
//
// One send action (single, group, or chain start) counts as exactly 1 send,
// and its recipient_count counts toward the daily recipients cap.
// ─────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export type SendType = 'single' | 'group' | 'chain';
export type SendChannel = 'email' | 'sms';

// Friendly, user-facing copy per limit hit (exact copy requested by product).
const MESSAGES: Record<string, string> = {
  daily_sends:
    "You've been busy today! Your daily send limit resets at midnight. Come back tomorrow and keep spreading the love.",
  daily_recipients:
    "That's a lot of kindness for one day! Your limit resets at midnight — save some sweetness for tomorrow.",
  per_send:
    "That's a big group! Try splitting it into a couple of sends — same love, just in batches.",
  daily_sms:
    "You've reached today's text limit — try email instead, or come back tomorrow.",
};

export interface RateLimitResult {
  allowed: boolean;
  errorCode?: string;
  message?: string;
}

// Checks + records a send action. Returns { allowed:false, errorCode, message }
// when a daily/per-send cap would be exceeded (nothing is recorded in that case).
export async function checkAndRecordSend(
  admin: AdminClient,
  userId: string,
  sendType: SendType,
  recipientCount: number,
  channel: SendChannel = 'email',
): Promise<RateLimitResult> {
  try {
    const { data, error } = await admin.rpc('check_and_record_send', {
      _user_id: userId,
      _send_type: sendType,
      _recipient_count: recipientCount,
      _channel: channel,
    });
    if (error) {
      // Fail-open on infrastructure errors so a transient DB hiccup never
      // blocks a legitimate act of kindness.
      console.error('[rate-limit] check_and_record_send failed:', error);
      return { allowed: true };
    }
    if (data?.allowed === true) return { allowed: true };
    const code = data?.error_code ?? 'daily_sends';
    return { allowed: false, errorCode: code, message: MESSAGES[code] ?? MESSAGES.daily_sends };
  } catch (err) {
    console.error('[rate-limit] check_and_record_send threw:', err);
    return { allowed: true };
  }
}
