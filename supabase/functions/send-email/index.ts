import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SendEmailRequest {
  email_type: 'chain_received' | '1hr_warning' | 'milestone' | 'completed';
  recipient_email: string;
  recipient_id: string | null;
  chain_id: string;
  template_data: {
    recipient_name: string;
    chain_name: string;
    sender_name?: string;
    compliment_text?: string;
    chain_url: string;
  };
}

function buildChainReceivedEmail(data: SendEmailRequest['template_data']): { subject: string; html: string } {
  const subject = "🎉 Someone thinks you're awesome!";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="background-color:#22c55e;padding:30px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:28px;">🌿 Ment Shop</h1>
          <p style="color:#dcfce7;margin:8px 0 0;font-size:14px;">Spreading Kindness, One Compliment at a Time</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px 30px;">
          <h2 style="color:#166534;margin:0 0 20px;font-size:22px;">Hey ${escapeHtml(data.recipient_name)}! 💚</h2>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
            Great news – someone just sent you a kindness chain called <strong>"${escapeHtml(data.chain_name)}"</strong>!
          </p>
          ${data.compliment_text ? `
          <div style="background-color:#f0fdf4;border-left:4px solid #22c55e;padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
            <p style="color:#166534;font-size:16px;font-style:italic;margin:0;">"${escapeHtml(data.compliment_text)}"</p>
          </div>` : ''}
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 8px;">
            Now it's your turn to pass it forward!
          </p>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 30px;">
            ⏰ You have <strong>24 hours</strong> to add your own compliment and send it to someone who needs a smile!
          </p>
          <div style="text-align:center;margin:0 0 30px;">
            <a href="${escapeHtml(data.chain_url)}" style="display:inline-block;background-color:#22c55e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;">
              Pass It Forward →
            </a>
          </div>
          <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0;border-top:1px solid #e5e7eb;padding-top:20px;">
            P.S. Not sure what this is? It's a game where kindness spreads from person to person. Join the fun!
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background-color:#f9fafb;padding:20px 30px;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            Ment Shop – Spreading Kindness, One Compliment at a Time<br>
            Questions? Email <a href="mailto:info@mentshop.com" style="color:#22c55e;">info@mentshop.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildEmail(type: string, data: SendEmailRequest['template_data']): { subject: string; html: string } {
  switch (type) {
    case 'chain_received':
      return buildChainReceivedEmail(data);
    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[EMAIL DEBUG] send-email function invoked');

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('[EMAIL DEBUG] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SendEmailRequest = await req.json();
    console.log('[EMAIL DEBUG] Request body:', JSON.stringify({ ...body, template_data: { ...body.template_data } }));

    const { email_type, recipient_email, recipient_id, chain_id, template_data } = body;

    if (!email_type || !recipient_email || !template_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email_type, recipient_email, template_data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build email content
    const { subject, html } = buildEmail(email_type, template_data);
    console.log('[EMAIL DEBUG] Built email template, subject:', subject);

    // Send via Resend with 10s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let resendResponse;
    try {
      resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Ment Shop <hello@mentshop.com>',
          to: recipient_email,
          subject,
          html,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const resendData = await resendResponse.json();
    console.log('[EMAIL DEBUG] Resend response:', resendResponse.status, JSON.stringify(resendData));

    if (!resendResponse.ok) {
      console.error('[EMAIL DEBUG] Resend API error:', resendData);
      return new Response(
        JSON.stringify({ error: 'Resend API error', details: resendData }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { error: logError } = await adminClient
      .from('email_logs')
      .insert({
        email_type,
        recipient_email,
        recipient_id: recipient_id || null,
        chain_id: chain_id || null,
        resend_id: resendData.id || null,
        status: 'sent',
        metadata: { subject, template_data },
      });

    if (logError) {
      console.warn('[EMAIL DEBUG] Failed to log email:', logError);
    } else {
      console.log('[EMAIL DEBUG] Email logged successfully');
    }

    return new Response(
      JSON.stringify({ success: true, resend_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[EMAIL DEBUG] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
