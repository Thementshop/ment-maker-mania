// Lazy magic-link token issuer. Called from MentPage when ?auto=1 is in the URL.
// Returns a hashed_token if (and only if) the recipient already has an account.
// Caches tokens for 1 hour in recipient_login_tokens to avoid hammering auth.admin.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { logError } from '../_shared/error-log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const { ment_id } = await req.json();
    if (!ment_id) {
      return new Response(JSON.stringify({ error: 'ment_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up the recipient email from sent_ments
    const { data: ment, error: mentErr } = await admin
      .from('sent_ments')
      .select('recipient_email')
      .eq('id', ment_id)
      .maybeSingle();

    if (mentErr || !ment?.recipient_email) {
      return new Response(JSON.stringify({ has_token: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email = ment.recipient_email.toLowerCase();

    // Check cache
    const { data: cached } = await admin
      .from('recipient_login_tokens')
      .select('hashed_token, expires_at')
      .eq('email', email)
      .maybeSingle();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return new Response(
        JSON.stringify({ has_token: true, token: cached.hashed_token }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Confirm the user actually has an account (cheap RPC; avoids listUsers).
    const { data: existingUserId } = await admin.rpc('get_user_id_by_email', { _email: email });
    if (!existingUserId) {
      return new Response(JSON.stringify({ has_token: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate fresh token
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      await logError({
        source: 'issue-reveal-token',
        errorType: 'token_generation_failed',
        severity: 'error',
        recipientEmail: email,
        mentId: ment_id,
        message: linkErr?.message ?? 'No hashed_token returned',
      });
      return new Response(JSON.stringify({ has_token: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = linkData.properties.hashed_token;
    const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString(); // 55min (token TTL is 1h)

    // Upsert cache
    await admin
      .from('recipient_login_tokens')
      .upsert({ email, hashed_token: token, expires_at: expiresAt }, { onConflict: 'email' });

    return new Response(
      JSON.stringify({ has_token: true, token }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[issue-reveal-token] Fatal:', err);
    await logError({
      source: 'issue-reveal-token',
      errorType: 'worker_crash',
      severity: 'critical',
      message: (err as Error).message ?? String(err),
    });
    return new Response(JSON.stringify({ has_token: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
