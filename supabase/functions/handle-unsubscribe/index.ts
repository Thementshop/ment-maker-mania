// handle-unsubscribe
// One-click / one-tap unsubscribe endpoint. Handles BOTH:
//   • the List-Unsubscribe header one-click (POST from Gmail/Yahoo/Apple)
//   • the /unsubscribe page load (POST from the browser)
//
// Auth: the token IS the authentication. No login required. verify_jwt = false.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get('token')?.trim();
    let source = url.searchParams.get('source')?.trim();

    // Also accept token/source from a JSON body (used by the /unsubscribe page).
    if (!token && req.method === 'POST') {
      try {
        const body = await req.json();
        token = (body?.token ?? '').toString().trim();
        source = source || (body?.source ?? '').toString().trim();
      } catch (_e) {
        // no/invalid body — fall through to missing_token handling
      }
    }
    source = source || 'email_link';

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'missing_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve the email for this token.
    const { data: tokenRow } = await admin
      .from('email_opt_out_tokens')
      .select('email')
      .eq('token', token)
      .maybeSingle();

    if (!tokenRow?.email) {
      return new Response(
        JSON.stringify({ error: 'invalid_token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email = tokenRow.email.trim();

    // Idempotent: if already opted out, do nothing.
    const { data: existing } = await admin
      .from('do_not_contact')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (!existing) {
      const { error: insertErr } = await admin
        .from('do_not_contact')
        .insert({ email, opt_out_token: token, source });
      // Ignore unique-violation races (23505) — someone else opted out concurrently.
      if (insertErr && insertErr.code !== '23505') {
        console.error('[handle-unsubscribe] insert failed:', insertErr);
        return new Response(
          JSON.stringify({ error: 'insert_failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('[handle-unsubscribe] Opted out:', email, 'source:', source);
    return new Response(
      JSON.stringify({ success: true, email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[handle-unsubscribe] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
