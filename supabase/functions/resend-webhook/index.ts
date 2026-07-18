// resend-webhook
// Receives Resend email event webhooks (delivered, bounced, complained, opened,
// clicked). Records every event in email_events and reacts to complaints/bounces:
//   • complained  → alert Donna + permanently add to do_not_contact
//   • bounced (2nd time for same address) → add to do_not_contact
//
// Auth: for now all POSTs are accepted; headers are logged so signature
// verification can be added later. verify_jwt = false.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { addToDoNotContact } from '../_shared/opt-out.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALERT_TO = 'donna@mentshop.com';
const ALERT_FROM = 'The Ment Shop <hello@mentshop.com>';

// Extract the recipient email from a Resend webhook data payload.
function extractRecipient(data: Record<string, unknown>): string {
  const to = data?.to;
  if (Array.isArray(to) && to.length > 0) return String(to[0]);
  if (typeof to === 'string') return to;
  if (typeof data?.email === 'string') return data.email as string;
  return '';
}

async function sendComplaintAlert(resendKey: string, recipient: string, when: string) {
  try {
    const html = `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
        <h2 style="margin:0 0 12px;">🚨 Spam Complaint on TMS</h2>
        <p>A recipient marked a Ment email as spam.</p>
        <p><strong>Recipient:</strong> ${recipient}<br>
        <strong>When:</strong> ${when}</p>
        <p>They have been automatically added to the do-not-contact list and will
        never receive another email from TMS.</p>
        <p>Please review the <strong>Email Health</strong> section of the admin
        dashboard to keep an eye on the complaint rate.</p>
      </div>`;
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: ALERT_FROM,
        to: ALERT_TO,
        subject: 'ALERT: Spam Complaint on TMS',
        html,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[resend-webhook] Alert email failed [${resp.status}]: ${body}`);
    }
  } catch (err) {
    console.error('[resend-webhook] Alert email threw:', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Log headers so signature verification can be added later.
    const headerObj: Record<string, string> = {};
    req.headers.forEach((v, k) => { headerObj[k] = v; });
    console.log('[resend-webhook] headers:', JSON.stringify(headerObj));

    const payload = await req.json().catch(() => null);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'invalid_json' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawType: string = payload.type || payload.event || '';
    const eventType = rawType.replace(/^email\./, '').trim(); // e.g. "complained"
    const data = (payload.data || {}) as Record<string, unknown>;
    const recipient = extractRecipient(data);
    const emailId = (data?.email_id as string) || (data?.id as string) || null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Record every event.
    const { error: insertErr } = await admin.from('email_events').insert({
      email_id: emailId,
      recipient_email: recipient || 'unknown',
      event_type: eventType || 'unknown',
      event_data: payload,
    });
    if (insertErr) console.error('[resend-webhook] event insert failed:', insertErr);

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    // ─── Complaint: alert + permanent opt-out ───
    if (eventType === 'complained' && recipient) {
      await addToDoNotContact(admin, recipient, 'complaint');
      if (RESEND_API_KEY) {
        await sendComplaintAlert(RESEND_API_KEY, recipient, new Date().toISOString());
      } else {
        console.error('[resend-webhook] RESEND_API_KEY missing — cannot send complaint alert');
      }
    }

    // ─── Bounce: opt out on the 2nd bounce for the same address ───
    if (eventType === 'bounced' && recipient) {
      const { count } = await admin
        .from('email_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'bounced')
        .ilike('recipient_email', recipient);
      // count includes the row we just inserted.
      if ((count ?? 0) >= 2) {
        await addToDoNotContact(admin, recipient, 'bounce');
        console.log('[resend-webhook] 2nd bounce — opted out:', recipient);
      } else {
        console.log('[resend-webhook] 1st bounce — monitoring:', recipient);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[resend-webhook] Error:', err);
    // Still return 200 so Resend doesn't hammer retries on a parse edge case,
    // but log loudly. (Genuine 5xx only for unexpected throws we can't absorb.)
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
