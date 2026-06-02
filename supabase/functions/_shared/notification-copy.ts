// ─────────────────────────────────────────────────────────────────────
// Centralized notification copy for ALL outgoing delivery channels
// (email, SMS, WhatsApp, push, and any future channel).
//
// RULE: Sender identity is NEVER revealed in any outgoing notification.
// The sender is only revealed AFTER the recipient unwraps the ment
// inside the app (MentPage.tsx). That's the surprise payoff.
//
// Any new delivery channel MUST import from this file so wording stays
// consistent and the no-sender rule is automatically enforced.
// ─────────────────────────────────────────────────────────────────────

export const REVEAL_SENDER_IN_NOTIFICATION = false;

export const NOTIFICATION_COPY = {
  single_ment: {
    // Used for: email subject, SMS text, WhatsApp preview, push title
    subject: 'Someone is thinking of you right now 💚',
    // Used for: email headline + body, SMS/WhatsApp message body
    body: 'Someone thought of you and wrapped something kind just for you.',
    // Short CTA copy
    cta: 'Unwrap Your Ment',
    // Eyebrow / pre-header used in email shell
    eyebrow: 'A Ment Just Arrived',
  },
  chain_received: {
    subject: '⏰ Someone added you to a kindness chain — you have 48 hours!',
    body: "A chain of kindness just landed in your hands and it is SO excited to meet you. You have 48 hours to pass it forward to someone wonderful — and when you do, you become part of our World Kindness Tracker — where every single act of sweetness gets counted. Keep the chain going, beautiful human.",
    cta: 'Reveal Your Compliment',
    eyebrow: 'A Chain Just Reached You',
  },
} as const;

// Build SMS / WhatsApp / future channel message bodies.
// Sender is intentionally NOT a parameter — it must never be included.
export function buildSingleMentShortMessage(revealUrl: string): string {
  return `${NOTIFICATION_COPY.single_ment.subject}\n\n${NOTIFICATION_COPY.single_ment.body}\n\nTap to unwrap: ${revealUrl}`;
}

export function buildChainShortMessage(revealUrl: string): string {
  return `${NOTIFICATION_COPY.chain_received.subject}\n\n${NOTIFICATION_COPY.chain_received.body}\n\nTap to reveal: ${revealUrl}`;
}
