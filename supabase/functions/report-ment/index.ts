import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Where Ment reports are sent for review.
const DONNA_EMAIL = 'info@mentshop.com';

function escapeHtml(s: string) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ─── Auth ───
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: reporter }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !reporter) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { ment_id, reason } = await req.json();
    if (!ment_id) {
      return json({ error: 'Missing ment_id' }, 400);
    }

    // ─── Look up the reported Ment ───
    const { data: ment } = await adminClient
      .from('sent_ments')
      .select('id, sender_id, recipient_email, compliment_text')
      .eq('id', ment_id)
      .maybeSingle();

    if (!ment) {
      return json({ error: 'Ment not found' }, 404);
    }

    const reportedUserId = ment.sender_id;

    // ─── Record the report ───
    const { error: insertError } = await adminClient
      .from('ment_reports')
      .insert({
        reported_ment_id: ment.id,
        reporter_user_id: reporter.id,
        reported_user_id: reportedUserId,
        reason: reason ?? null,
        status: 'pending',
      });
    if (insertError) {
      console.error('[REPORT-MENT] Insert error:', insertError);
      return json({ error: 'Failed to record report' }, 500);
    }

    // ─── Gather names/emails for the notification (best-effort) ───
    const [senderProfileRes, reporterProfileRes, senderUserRes] = await Promise.all([
      adminClient.from('profiles').select('display_name').eq('id', reportedUserId).maybeSingle(),
      adminClient.from('profiles').select('display_name').eq('id', reporter.id).maybeSingle(),
      adminClient.auth.admin.getUserById(reportedUserId),
    ]);

    const senderName = senderProfileRes.data?.display_name || 'Unknown';
    const senderEmail = senderUserRes.data?.user?.email || 'Unknown';
    const recipientName = reporterProfileRes.data?.display_name || reporter.email?.split('@')[0] || 'Unknown';
    const recipientEmail = reporter.email || ment.recipient_email || 'Unknown';
    const when = new Date().toISOString();

    // ─── Notify Donna via Resend (best-effort — report is already recorded) ───
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY) {
      try {
        const html = `
          <h2>Ment Report — Action Needed</h2>
          <p><strong>Reported compliment:</strong><br/>${escapeHtml(ment.compliment_text || '')}</p>
          <p><strong>Sender:</strong> ${escapeHtml(senderName)} (${escapeHtml(senderEmail)})</p>
          <p><strong>Recipient (reporter):</strong> ${escapeHtml(recipientName)} (${escapeHtml(recipientEmail)})</p>
          <p><strong>Reported at:</strong> ${escapeHtml(when)}</p>
          <p><strong>Ment ID:</strong> ${escapeHtml(ment.id)}</p>
        `;
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Ment Shop <info@mentshop.com>',
            to: [DONNA_EMAIL],
            subject: 'Ment Report — Action Needed',
            html,
          }),
        });
        if (!resp.ok) {
          console.error('[REPORT-MENT] Resend failed:', resp.status, await resp.text());
        }
      } catch (mailErr) {
        console.error('[REPORT-MENT] Resend threw:', mailErr);
      }
    } else {
      console.error('[REPORT-MENT] RESEND_API_KEY not configured');
    }

    return json({ success: true });
  } catch (error) {
    console.error('[REPORT-MENT] Error:', error);
    return json({ error: (error as Error).message || 'Internal server error' }, 500);
  }
});
